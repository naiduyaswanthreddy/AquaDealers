import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  Receipt,
  Package,
  Wallet,
  PiggyBank,
  Users2,
  FileBarChart,
  GitBranch,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui';

interface RouteConfig {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

const ROUTE_MAPS: Record<string, RouteConfig> = {
  '/bills/new': {
    title: 'New Billing (Smart POS)',
    description:
      'Phase 5: Create superfast digital bills with full GST options, print invoices, and send WhatsApp receipts to farmers.',
    icon: Receipt,
    color: 'from-amber-500 to-orange-600',
  },
  '/bills': {
    title: 'Bill History',
    description:
      'Phase 5: Search and filter past bills, track cash vs credit sales, and print duplicate receipts.',
    icon: Receipt,
    color: 'from-blue-500 to-indigo-600',
  },
  '/stock': {
    title: 'Stock Inventory',
    description:
      'Phase 6: Complete stock management, purchase additions, supplier mapping, min stock alerts, and batch expiry tracking.',
    icon: Package,
    color: 'from-sky-500 to-blue-600',
  },
  '/cashbook': {
    title: 'Cash Book Ledger',
    description:
      'Phase 7: Daily cash closing balances, credit collections, manual adjustments, and direct bank/UPI deposits tallying.',
    icon: PiggyBank,
    color: 'from-emerald-500 to-teal-600',
  },
  '/expenses': {
    title: 'Shop Expenses',
    description:
      'Phase 7: Track transport costs, staff salaries, rent, electricity, and vehicle upkeep with digital receipt attachments.',
    icon: Wallet,
    color: 'from-red-500 to-rose-600',
  },
  '/suppliers': {
    title: 'Suppliers Registry',
    description:
      'Phase 8: Manage distributor balances, purchase bills, payment history, and credit ledger for feed/medicine suppliers.',
    icon: Users2,
    color: 'from-cyan-500 to-blue-600',
  },
  '/reports': {
    title: 'GST & Business Reports',
    description:
      'Phase 8: Auto-calculated monthly GSTR-1 ledgers, output vs input tax liability sheets, and top farmer credit summaries.',
    icon: FileBarChart,
    color: 'from-violet-500 to-purple-600',
  },
  '/branches': {
    title: 'Branch Management',
    description:
      'Phase 10: Seamlessly link multiple retail shops under one dealer, assign staff, and see unified business metrics.',
    icon: GitBranch,
    color: 'from-teal-500 to-emerald-600',
  },
  '/settings': {
    title: 'App Settings',
    description:
      'Phase 9: Set printer papers, customize invoice logos, configure WhatsApp reminders, and set staff permissions.',
    icon: Settings,
    color: 'from-slate-500 to-slate-700',
  },
  '/dues': {
    title: 'Outstanding Dues Ledger',
    description:
      'Phase 4/7: Comprehensive overview of all outstanding farmer balances, aging buckets, and print summaries.',
    icon: HelpCircle,
    color: 'from-orange-500 to-red-600',
  },
};

export const PlaceholderPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Find configuration for the current route, fallback to default
  const config = ROUTE_MAPS[location.pathname] || {
    title: 'Feature Coming Soon',
    description: 'We are working hard to bring this feature to your AquaDealers app in the next auto-update.',
    icon: Sparkles,
    color: 'from-primary to-primary-light',
  };

  const IconComponent = config.icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-6 text-center animate-fade-in">
      {/* Dynamic Colored Icon */}
      <div className={`w-20 h-20 rounded-3xl bg-gradient-to-tr ${config.color} text-white flex items-center justify-center shadow-lg mb-6`}>
        <IconComponent className="w-10 h-10" />
      </div>

      <h1 className="text-2xl font-extrabold text-text-primary tracking-tight mb-2">
        {config.title}
      </h1>

      {/* Premium Badge */}
      <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs font-semibold text-amber-800 mb-6 shadow-sm">
        <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
        Coming in Next Update
      </div>

      <p className="text-sm text-text-secondary leading-relaxed max-w-sm mb-8">
        {config.description}
      </p>

      {/* Actions */}
      <div className="w-full max-w-[200px] flex flex-col gap-3">
        <Button
          variant="secondary"
          onClick={() => navigate(-1)}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          fullWidth
        >
          Go Back
        </Button>
      </div>
    </div>
  );
};

export default PlaceholderPage;
