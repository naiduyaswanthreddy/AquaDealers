import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

/** Uppercase ruled section header with the teal left border. */
export const BookSection: React.FC<{ title: string; className?: string }> = ({ title, className }) => (
  <div className={cn('book-section-title mb-1 mt-5', className)}>{title}</div>
);

/** One dashed-separated entry. Pass `to` to make it a tappable row with the → arrow. */
export const BookRow: React.FC<{
  to?: string;
  /** router state passed along with `to` — e.g. { from } so the target page can return here */
  state?: Record<string, unknown>;
  onClick?: () => void;
  accent?: 'paid' | 'unpaid' | null;
  children: React.ReactNode;
}> = ({ to, state, onClick, accent, children }) => {
  const navigate = useNavigate();
  const tappable = !!to || !!onClick;

  const accentClass =
    accent === 'paid'
      ? 'border-l-[3px] border-l-[#1A7A4A] pl-2.5'
      : accent === 'unpaid'
      ? 'border-l-[3px] border-l-[#C0392B] pl-2.5'
      : '';

  const body = (
    <div className="flex items-center gap-2">
      <div className={cn('min-w-0 flex-1', accentClass)}>{children}</div>
      {tappable ? <ChevronRight className="h-4 w-4 shrink-0 text-[#8a8168]" /> : null}
    </div>
  );

  if (!tappable) return <div className="book-row">{body}</div>;

  return (
    <button
      type="button"
      className="book-row book-row--tap focus-ring"
      onClick={() => (to ? navigate(to, state ? { state } : undefined) : onClick?.())}
    >
      {body}
    </button>
  );
};

/** ₹ amount in register mono digits, rounded to whole rupees. */
export const BookMoney: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <span className={cn('book-num font-bold', className)}>{formatCurrency(Math.round(value))}</span>
);

/** Blank-register empty state. */
export const BookEmpty: React.FC<{ message?: string; action?: React.ReactNode }> = ({
  message = 'No entries on this day.',
  action,
}) => (
  <div className="book-empty rounded-lg">
    <p className="text-sm font-semibold">{message}</p>
    {action ? <div className="book-no-print mt-3">{action}</div> : null}
  </div>
);

export const BookLoading: React.FC = () => (
  <div className="flex items-center justify-center py-16 text-[color:var(--book-ink-soft)]">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>
);

const STAT_TINTS = {
  teal: 'bg-[rgba(14,80,72,0.1)]',
  orange: 'bg-[rgba(224,138,0,0.14)]',
  blue: 'bg-[rgba(29,91,191,0.1)]',
} as const;

/** One of the stat chips at the top of a detail page: tinted icon + value + label. */
export const BookStat: React.FC<{
  icon: string;
  tint?: keyof typeof STAT_TINTS;
  value: string;
  label: string;
}> = ({ icon, tint = 'teal', value, label }) => (
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <span className={cn('book-icon', STAT_TINTS[tint])}>{icon}</span>
    <div className="min-w-0">
      <div className="book-num truncate text-sm font-black leading-tight">{value}</div>
      <div className="truncate text-[0.68rem] font-semibold text-[color:var(--book-ink-soft)]">{label}</div>
    </div>
  </div>
);

/** Full-width paid/unpaid banner, like "✓ Fully paid today" in the reference. */
export const BookBanner: React.FC<{ tone: 'paid' | 'unpaid'; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <div
    className={cn(
      'my-2 rounded-lg border px-3 py-2 text-sm font-bold',
      tone === 'paid'
        ? 'border-[#bfe0cb] bg-[#e9f5ec] text-[color:var(--book-green)]'
        : 'border-[#f0c4bd] bg-[#fdedea] text-[color:var(--book-red)]'
    )}
  >
    {children}
  </div>
);

const ACTION_COLORS = {
  green: 'bg-[color:var(--book-green)]',
  blue: 'bg-[color:var(--book-blue)]',
  orange: 'bg-[color:var(--book-orange)]',
  red: 'bg-[color:var(--book-red)]',
} as const;

/** Filled rounded action button (WhatsApp / New Bill / Collect / Print…). */
export const bookActionClass = (color: keyof typeof ACTION_COLORS): string =>
  cn(
    'focus-ring flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90',
    ACTION_COLORS[color]
  );

/** "4 × 25kg" when the unit is a pack size, "30 bags" when it's a word. */
export const formatQty = (quantity: number, unit?: string | null): string => {
  const u = (unit || 'units').trim();
  return /^\d/.test(u) ? `${quantity} × ${u}` : `${quantity} ${u}`;
};

/** Whole-rupee display for summary lines — paise only add noise in the daybook. */
export const bookMoney = (value: number): string => formatCurrency(Math.round(value));

export const paymentModeLabel = (paymentType?: string | null): string => {
  const mode = (paymentType || '').toLowerCase();
  if (mode === 'credit') return '📒 Udhar';
  if (mode === 'upi' || mode === 'gpay' || mode === 'phonepe' || mode === 'paytm') return '📱 UPI';
  if (mode === 'cheque' || mode === 'check') return '🏦 Cheque';
  return '💵 Cash';
};

export const paidBadge = (balanceDue: number, total: number): React.ReactElement => {
  if (balanceDue <= 0) return <span className="font-bold text-[color:var(--book-green)]">✓ Paid</span>;
  if (balanceDue >= total) return <span className="font-bold text-[color:var(--book-red)]">✗ Unpaid</span>;
  return (
    <span className="font-bold text-[#b45309]">⚠ {bookMoney(balanceDue)} due</span>
  );
};
