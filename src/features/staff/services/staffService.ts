import { supabase } from '@/lib/supabase';
import { STAFF_DEFAULT_PERMISSIONS, getStaffDefaultRoute } from '@/lib/staffAccess';
import type { StaffMember, StaffMemberInsert, StaffPermissions } from '@/types/database';

export interface StaffCreateInput {
  dealerId: string;
  name: string;
  phone?: string | null;
  pin: string;
  branchIds?: string[];
  permissions?: StaffPermissions;
  isActive?: boolean;
}

export interface StaffUpdateInput {
  name: string;
  phone?: string | null;
  branchIds?: string[];
  permissions: StaffPermissions;
  isActive: boolean;
  pin?: string | null;
}

export interface StaffPortalContext {
  dealerId: string;
  shopName: string;
  branchId: string;
  branchName: string;
  shopSlug: string;
  branchSlug: string;
  portalUrl: string;
}

export interface StaffPortalLoginResult extends StaffPortalContext {
  sessionToken: string;
  staff: {
    id: string;
    name: string;
    phone: string | null;
    branchIds: string[];
    permissions: StaffPermissions;
    defaultRoute: string;
  };
}

const STAFF_SELECT_FIELDS = 'id,dealer_id,name,phone,pin_hash,access_token,branch_ids,permissions,is_active,last_login_at,created_at,updated_at';

function normalizeBranchIds(branchIds?: string[]): string[] {
  return [...new Set((branchIds ?? []).filter(Boolean))];
}

function normalizePermissions(permissions?: Partial<StaffPermissions>): StaffPermissions {
  return { ...STAFF_DEFAULT_PERMISSIONS, ...(permissions ?? {}) } as StaffPermissions;
}

function buildStaffSessionRoute(permissions: StaffPermissions): string {
  return getStaffDefaultRoute(permissions);
}

// Two staff of the same dealer cannot share a PIN (unique index on the hash);
// surface that as a readable message instead of a raw Postgres error.
function toFriendlyStaffError(error: { code?: string; message?: string }): Error {
  if (error?.code === '23505') {
    return new Error('This PIN is already used by another staff member. Please choose a different PIN.');
  }
  return new Error(error?.message || 'Unable to save staff member.');
}

export async function listStaffMembers(dealerId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_members')
    .select(STAFF_SELECT_FIELDS)
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as StaffMember[];
}

export async function createStaffMember(input: StaffCreateInput): Promise<StaffMember> {
  const payload: StaffMemberInsert = {
    dealer_id: input.dealerId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    // Raw PIN — the staff_hash_pin_on_write DB trigger bcrypts it in place.
    pin_hash: input.pin,
    branch_ids: normalizeBranchIds(input.branchIds),
    permissions: normalizePermissions(input.permissions),
    is_active: input.isActive ?? true,
  };

  const { data, error } = await supabase
    .from('staff_members')
    .insert(payload)
    .select(STAFF_SELECT_FIELDS)
    .single();

  if (error) throw toFriendlyStaffError(error);
  return data as StaffMember;
}

export async function deleteStaffMember(staffId: string, dealerId: string): Promise<void> {
  // Hard delete — CASCADE clears staff_sessions and staff_login_attempts.
  // Historical bills / payments retain their branch_id and their record of
  // "who logged in when" via the audit trail — nothing on those tables
  // references staff_members.id, so no orphans.
  const { error } = await supabase
    .from('staff_members')
    .delete()
    .eq('id', staffId)
    .eq('dealer_id', dealerId);
  if (error) throw toFriendlyStaffError(error);
}

export async function updateStaffMember(
  staffId: string,
  dealerId: string,
  input: StaffUpdateInput
): Promise<StaffMember> {
  const updates: Record<string, unknown> = {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    branch_ids: normalizeBranchIds(input.branchIds),
    permissions: normalizePermissions(input.permissions),
    is_active: input.isActive,
  };

  if (input.pin) {
    // Raw PIN — DB trigger bcrypts it. Writing the same pin_hash value also
    // triggers session revocation for this staff, forcing a re-login.
    updates.pin_hash = input.pin;
  }

  const { data, error } = await supabase
    .from('staff_members')
    .update(updates)
    .eq('id', staffId)
    .eq('dealer_id', dealerId)
    .select(STAFF_SELECT_FIELDS)
    .single();

  if (error) throw toFriendlyStaffError(error);
  return data as StaffMember;
}

async function fetchClientIp(): Promise<string | null> {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.ip === 'string' ? j.ip : null;
  } catch { return null; }
}

export async function resolveStaffPortalContext(
  shopSlug: string,
  branchSlug: string,
  accessToken: string | null,
): Promise<StaffPortalContext> {
  const { data, error } = await supabase.rpc('staff_portal_context_v2', {
    p_shop_slug: shopSlug,
    p_branch_slug: branchSlug,
    p_access_token: accessToken,
  });

  if (error) throw error;
  return data as StaffPortalContext;
}

export async function verifyStaffPortalPin(
  shopSlug: string,
  branchSlug: string,
  pin: string,
  accessToken: string | null,
): Promise<StaffPortalLoginResult> {
  const clientIp = await fetchClientIp();
  const { data, error } = await supabase.rpc('staff_portal_login', {
    p_shop_slug: shopSlug,
    p_branch_slug: branchSlug,
    p_pin: pin,
    p_access_token: accessToken,
    p_client_ip: clientIp,
  });

  if (error) throw error;
  return data as StaffPortalLoginResult;
}

export async function rotateStaffAccessToken(staffId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_staff_access_token', { p_staff_id: staffId });
  if (error) throw error;
  return data as string;
}

export function buildStaffLink(origin: string, shopName: string, branchName: string, accessToken?: string): string {
  const shopSlug = shopName
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const branchSlug = branchName
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const base = `${origin}/${shopSlug}/${branchSlug}/staff`;
  return accessToken ? `${base}?t=${accessToken}` : base;
}
