import {
  FileBarChart,
  GitBranch,
  Home,
  Package,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  Users2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Dealer } from '@/types/database';
import { slugify } from '@/lib/utils';

export type StaffAccessMode = 'visible' | 'disabled' | 'hidden';

export type StaffFeatureKey =
  | 'dashboard'
  | 'billHistory'
  | 'newBill'
  | 'farmerList'
  | 'addFarmer'
  | 'inventory'
  | 'suppliers'
  | 'cashbook'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'branches'
  | 'staffManagement';

export interface StaffFeatureDefinition {
  key: StaffFeatureKey;
  label: string;
  description: string;
  route: string;
  icon: LucideIcon;
  color: string;
}

export interface StaffNavDefinition {
  path: string;
  label: string;
  icon: LucideIcon;
  featureKey?: StaffFeatureKey;
  center?: boolean;
  alwaysVisible?: boolean;
}

export interface StaffDealerProfileInput {
  dealerId: string;
  shopName: string;
}

export interface StaffPermissions extends Record<StaffFeatureKey, StaffAccessMode> {}

export const STAFF_FEATURES: StaffFeatureDefinition[] = [
  {
    key: 'newBill',
    label: 'Add Bill',
    description: 'Create invoices and finish the billing flow.',
    route: '/bills/new',
    icon: ReceiptText,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    key: 'addFarmer',
    label: 'Add Farmer',
    description: 'Register new farmers from the staff portal.',
    route: '/farmers/new',
    icon: Users2,
    color: 'bg-primary/10 text-primary',
  },
  {
    key: 'billHistory',
    label: 'Bills',
    description: 'View bill history and open invoice details.',
    route: '/bills',
    icon: ReceiptText,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    key: 'farmerList',
    label: 'Farmers',
    description: 'Browse farmer records and ledgers.',
    route: '/farmers',
    icon: Users,
    color: 'bg-sky-100 text-sky-700',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Open stock and medicine inventory pages.',
    route: '/inventory',
    icon: Package,
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    description: 'Manage supplier records and purchases.',
    route: '/suppliers',
    icon: Users2,
    color: 'bg-primary/10 text-primary',
  },
  {
    key: 'cashbook',
    label: 'Cash Book',
    description: 'Record cash movements and view cashbook entries.',
    route: '/cashbook',
    icon: PiggyBank,
    color: 'bg-success-light text-success',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    description: 'Track shop expenses and vouchers.',
    route: '/expenses',
    icon: Wallet,
    color: 'bg-danger-light text-danger',
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Open GST and business reports.',
    route: '/reports',
    icon: FileBarChart,
    color: 'bg-info-light text-primary',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Change shop profile and app preferences.',
    route: '/settings',
    icon: Settings,
    color: 'bg-warning-light text-warning',
  },
  {
    key: 'branches',
    label: 'Branches',
    description: 'Manage branch records and switch between locations.',
    route: '/branches',
    icon: GitBranch,
    color: 'bg-surface text-text-primary',
  },
  {
    key: 'staffManagement',
    label: 'Staff',
    description: 'Create staff profiles, assign branches, and manage PINs.',
    route: '/staff',
    icon: ShieldCheck,
    color: 'bg-emerald-100 text-emerald-700',
  },
];

export const STAFF_DEFAULT_PERMISSIONS: StaffPermissions = {
  dashboard: 'hidden',
  billHistory: 'hidden',
  newBill: 'visible',
  farmerList: 'hidden',
  addFarmer: 'visible',
  inventory: 'hidden',
  suppliers: 'hidden',
  cashbook: 'hidden',
  expenses: 'hidden',
  reports: 'hidden',
  settings: 'hidden',
  branches: 'hidden',
  staffManagement: 'hidden',
};

export const STAFF_NAV_ITEMS: StaffNavDefinition[] = [
  { path: '/', label: 'Home', icon: Home, featureKey: 'dashboard' },
  { path: '/farmers', label: 'Farmers', icon: Users, featureKey: 'farmerList' },
  { path: '/bills/new', label: 'Bill', icon: Plus, featureKey: 'newBill', center: true },
  { path: '/inventory', label: 'Stock', icon: Package, featureKey: 'inventory' },
  { path: '/more', label: 'More', icon: ShieldCheck, alwaysVisible: true },
];

export function getStaffFeatureMode(
  featureKey: StaffFeatureKey,
  permissions: Partial<StaffPermissions> | null | undefined,
  isStaffMode: boolean
): StaffAccessMode {
  if (!isStaffMode) return 'visible';
  return permissions?.[featureKey] ?? STAFF_DEFAULT_PERMISSIONS[featureKey];
}

export function isStaffFeatureVisible(
  featureKey: StaffFeatureKey,
  permissions: Partial<StaffPermissions> | null | undefined,
  isStaffMode: boolean
): boolean {
  return getStaffFeatureMode(featureKey, permissions, isStaffMode) === 'visible';
}

export function getStaffDefaultRoute(permissions: Partial<StaffPermissions> | null | undefined): string {
  if ((permissions?.newBill ?? STAFF_DEFAULT_PERMISSIONS.newBill) === 'visible') return '/bills/new';
  if ((permissions?.addFarmer ?? STAFF_DEFAULT_PERMISSIONS.addFarmer) === 'visible') return '/farmers/new';
  if ((permissions?.billHistory ?? STAFF_DEFAULT_PERMISSIONS.billHistory) === 'visible') return '/bills';
  if ((permissions?.farmerList ?? STAFF_DEFAULT_PERMISSIONS.farmerList) === 'visible') return '/farmers';
  return '/more';
}

export function buildStaffPortalPath(shopName: string, branchName: string): string {
  return `/${slugify(shopName)}/${slugify(branchName)}/staff`;
}

export function buildStaffPortalUrl(shopName: string, branchName: string, origin = window.location.origin): string {
  return `${origin}${buildStaffPortalPath(shopName, branchName)}`;
}

export function buildStaffDealerProfile(input: StaffDealerProfileInput): Dealer {
  const now = new Date().toISOString();

  return {
    id: input.dealerId,
    name: input.shopName,
    shop_name: input.shopName,
    phone: '',
    email: null,
    address: null,
    district: null,
    state: 'Andhra Pradesh',
    gstin: null,
    drug_license_no: null,
    language: 'en',
    plan: 'staff',
    plan_expires_at: null,
    is_active: true,
    gst_billing_enabled: true,
    bill_signature_enabled: true,
    pin_hash: null,
    pin_timeout_minutes: 0,
    avatar_url: null,
    created_at: now,
  };
}
