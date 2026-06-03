import { Home, Users, Receipt, Package, Menu, CheckCircle2, AlertTriangle, XCircle, Truck, Zap, Car, ClipboardList, Building, MoreHorizontal, Plus, type LucideIcon } from 'lucide-react';
import type { StaffFeatureKey } from '@/lib/staffAccess';

/* ─── Crop Statuses ─────────────────────────── */
export const CROP_STATUSES = [
  { value: 'growing', label: 'Growing', color: '#10B981' },
  { value: 'harvested', label: 'Harvested', color: '#1B6CA8' },
  { value: 'partial_harvest', label: 'Partial Harvest', color: '#F59E0B' },
  { value: 'crop_failed', label: 'Crop Failed', color: '#EF4444' },
  { value: 'price_distress', label: 'Price Distress', color: '#F97316' },
] as const;

export type CropStatusValue = (typeof CROP_STATUSES)[number]['value'];

/* ─── Risk Statuses ─────────────────────────── */
export const RISK_STATUSES = [
  { value: 'reliable', label: 'Reliable', color: '#10B981', icon: CheckCircle2 },
  { value: 'monitor', label: 'Monitor', color: '#F59E0B', icon: AlertTriangle },
  { value: 'risky', label: 'Risky', color: '#EF4444', icon: XCircle },
] as const;

export type RiskStatusValue = (typeof RISK_STATUSES)[number]['value'];

/* ─── Payment Methods ───────────────────────── */
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value'];

/* ─── Expense Categories ────────────────────── */
export const EXPENSE_CATEGORIES = [
  { value: 'transport', label: 'Transport', icon: Truck },
  { value: 'rent', label: 'Rent', icon: Building },
  { value: 'staff', label: 'Staff Salary', icon: Users },
  { value: 'electricity', label: 'Electricity', icon: Zap },
  { value: 'vehicle', label: 'Vehicle', icon: Car },
  { value: 'other', label: 'Other', icon: ClipboardList },
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]['value'];

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  featureKey?: StaffFeatureKey;
  isCenter?: boolean;
  alwaysVisible?: boolean;
}

/* ─── Andhra Pradesh Districts ──────────────── */
export const AP_DISTRICTS = [
  'Anantapur',
  'Chittoor',
  'East Godavari',
  'Eluru',
  'Guntur',
  'Kakinada',
  'Krishna',
  'Kurnool',
  'Nandyal',
  'NTR',
  'Palnadu',
  'Parvathipuram Manyam',
  'Prakasam',
  'Srikakulam',
  'Sri Potti Sriramulu Nellore',
  'Tirupati',
  'Visakhapatnam',
  'Vizianagaram',
  'West Godavari',
  'YSR Kadapa',
  'Anakapalli',
  'Alluri Sitharama Raju',
  'Bapatla',
  'Konaseema',
  'Sri Sathya Sai',
] as const;

/* ─── Bottom Navigation Items ───────────────── */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: Home, featureKey: 'dashboard' },
  { path: '/farmers', label: 'Farmers', icon: Users, featureKey: 'farmerList' },
  { path: '/bills/new', label: 'Bill', icon: Plus, isCenter: true, featureKey: 'newBill' },
  { path: '/inventory', label: 'Stock', icon: Package, featureKey: 'inventory' },
  { path: '/more', label: 'More', icon: MoreHorizontal, alwaysVisible: true },
] as const;

/* ─── Ageing Buckets ────────────────────────── */
export const AGEING_BUCKETS = [
  { value: '0-30', label: '0–30 days', color: '#10B981', bgColor: '#D1FAE5' },
  { value: '31-60', label: '31–60 days', color: '#F59E0B', bgColor: '#FEF3C7' },
  { value: '61-90', label: '61–90 days', color: '#F97316', bgColor: '#FFEDD5' },
  { value: '90+', label: '90+ days', color: '#EF4444', bgColor: '#FEE2E2' },
] as const;
