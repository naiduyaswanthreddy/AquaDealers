import { supabase } from '@/lib/supabase';
import { hashPin } from '@/lib/utils';
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
  staff: {
    id: string;
    name: string;
    phone: string | null;
    branchIds: string[];
    permissions: StaffPermissions;
    defaultRoute: string;
  };
}

const STAFF_SELECT_FIELDS = 'id,dealer_id,name,phone,pin_hash,branch_ids,permissions,is_active,last_login_at,created_at,updated_at';

function normalizeBranchIds(branchIds?: string[]): string[] {
  return [...new Set((branchIds ?? []).filter(Boolean))];
}

function normalizePermissions(permissions?: Partial<StaffPermissions>): StaffPermissions {
  return { ...STAFF_DEFAULT_PERMISSIONS, ...(permissions ?? {}) } as StaffPermissions;
}

function buildStaffSessionRoute(permissions: StaffPermissions): string {
  return getStaffDefaultRoute(permissions);
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
  const pinHash = await hashPin(input.pin);
  const payload: StaffMemberInsert = {
    dealer_id: input.dealerId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    pin_hash: pinHash,
    branch_ids: normalizeBranchIds(input.branchIds),
    permissions: normalizePermissions(input.permissions),
    is_active: input.isActive ?? true,
  };

  const { data, error } = await supabase
    .from('staff_members')
    .insert(payload)
    .select(STAFF_SELECT_FIELDS)
    .single();

  if (error) throw error;
  return data as StaffMember;
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
    updates.pin_hash = await hashPin(input.pin);
  }

  const { data, error } = await supabase
    .from('staff_members')
    .update(updates)
    .eq('id', staffId)
    .eq('dealer_id', dealerId)
    .select(STAFF_SELECT_FIELDS)
    .single();

  if (error) throw error;
  return data as StaffMember;
}

export async function resolveStaffPortalContext(
  shopSlug: string,
  branchSlug: string
): Promise<StaffPortalContext> {
  const { data, error } = await supabase.rpc('staff_portal_context', {
    p_shop_slug: shopSlug,
    p_branch_slug: branchSlug,
  });

  if (error) throw error;
  return data as StaffPortalContext;
}

export async function verifyStaffPortalPin(
  shopSlug: string,
  branchSlug: string,
  pin: string
): Promise<StaffPortalLoginResult> {
  const pinHash = await hashPin(pin);
  const { data, error } = await supabase.rpc('staff_portal_login', {
    p_shop_slug: shopSlug,
    p_branch_slug: branchSlug,
    p_pin_hash: pinHash,
  });

  if (error) throw error;
  return data as StaffPortalLoginResult;
}

export function buildStaffLink(origin: string, shopName: string, branchName: string): string {
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

  return `${origin}/${shopSlug}/${branchSlug}/staff`;
}
