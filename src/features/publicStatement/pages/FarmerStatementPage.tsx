import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Droplet, FileText, IndianRupee, Phone, Receipt,
  ChevronDown, ChevronUp, Tag, Package, CheckCircle2,
  AlertCircle, Clock, Share2, Copy, Check, Search,
  X, Filter, SlidersHorizontal, TrendingDown, TrendingUp,
  Calendar, Banknote,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════ */

interface BillItem {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  mrp: number | null;
  medicine_discount_percentage: number | null;
  gst_rate: number | null;
  gst_amount: number | null;
  total_price: number;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  total: number;
  balance_due: number;
  items: BillItem[];
  is_verified?: boolean;
  delivery_pin?: string;
  is_adjustment?: boolean;
  branch_name?: string | null;
}

interface Payment {
  receipt_number: string | null;
  method: string | null;
  payment_date: string;
  amount: number;
  branch_name?: string | null;
}

interface PublicStatement {
  shop_name: string;
  shop_phone: string | null;
  shop_address: string | null;
  shop_district: string | null;
  farmer_name: string;
  village: string | null;
  total_due: number;
  bills: Bill[];
  payments: Payment[];
  generated_at: string;
}

type PaymentFilter = 'all' | 'paid' | 'unpaid';
type SortOrder = 'newest' | 'oldest';
type ActiveTab = 'bills' | 'payments' | 'summary';

/* ═══════════════════════════════════════════════════
   Design tokens
═══════════════════════════════════════════════════ */
const P = 'var(--color-primary)';
const P_LIGHT = 'var(--color-surface)';

/* ═══════════════════════════════════════════════════
   Small Helpers
═══════════════════════════════════════════════════ */
const pill = (active: boolean, label: string, onClick: () => void, color = P) => (
  <button
    key={label}
    onClick={onClick}
    className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
    style={active
      ? { background: color, color: '#fff' }
      : { background: '#f1f5f9', color: '#64748b' }
    }
  >
    {label}
  </button>
);

/* ═══════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════ */
const FarmerStatementPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  /* ── Remote state ── */
  const [statement, setStatement] = useState<PublicStatement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');

  /* ── UI state ── */
  const [activeTab, setActiveTab] = useState<ActiveTab>('bills');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [expandedBillItems, setExpandedBillItems] = useState<Record<string, BillItem[]>>({});
  const [loadingBillItems, setLoadingBillItems] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [billLimitReached, setBillLimitReached] = useState(false);

  /* ── Filter state (all client-side — no extra DB calls) ── */
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState<PaymentFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!statement) return;
    try {
      setIsDownloadingPdf(true);
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const margin = 15;
      let y = margin;
      const width = doc.internal.pageSize.getWidth();
      const contentWidth = width - 2 * margin;
      
      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(0, 82, 204); // Navy/Blue
      doc.text(statement.shop_name.toUpperCase(), margin, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const shopDetails = [
        statement.shop_phone ? `Phone: ${statement.shop_phone}` : null,
        [statement.shop_address, statement.shop_district].filter(Boolean).join(', ')
      ].filter(Boolean).join(' | ');
      y += 6;
      doc.text(shopDetails, margin, y);
      
      y += 8;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, width - margin, y);
      
      // Farmer Info
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(23, 48, 66);
      doc.text(`Farmer: ${statement.farmer_name}`, margin, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (statement.village) {
        y += 5;
        doc.text(`Village: ${statement.village}`, margin, y);
      }
      
      const dateText = `As on: ${new Date(statement.generated_at).toLocaleDateString()}`;
      doc.text(dateText, width - margin, y, { align: 'right' });
      
      // Balance Card
      y += 8;
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 16, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 16, 'S');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('OUTSTANDING DUE BALANCE', margin + 5, y + 10);
      
      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38); // Red
      const formattedBalance = `Rs. ${statement.total_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      doc.text(formattedBalance, width - margin - 5, y + 11, { align: 'right' });
      
      // Bills Section
      y += 24;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(23, 48, 66);
      doc.text('BILL LISTING', margin, y);
      
      // Table Header
      y += 6;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 8, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('DATE', margin + 3, y + 5);
      doc.text('BILL NUMBER', margin + 28, y + 5);
      doc.text('BILL TOTAL', margin + 85, y + 5, { align: 'right' });
      doc.text('BALANCE DUE', margin + 125, y + 5, { align: 'right' });
      doc.text('STATUS', width - margin - 3, y + 5, { align: 'right' });
      
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      
      statement.bills.forEach((bill: any) => {
        if (y > 270) {
          doc.addPage();
          y = margin;
        }
        
        const dateStr = new Date(bill.bill_date).toLocaleDateString();
        doc.text(dateStr, margin + 3, y + 5);
        doc.text(bill.bill_number, margin + 28, y + 5);
        doc.text(`Rs. ${bill.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + 85, y + 5, { align: 'right' });
        doc.text(`Rs. ${bill.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + 125, y + 5, { align: 'right' });
        
        const isPaid = bill.balance_due <= 0;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isPaid ? 22 : 220, isPaid ? 163 : 38, isPaid ? 74 : 38);
        doc.text(isPaid ? 'PAID' : 'PENDING', width - margin - 3, y + 5, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        
        y += 8;
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, width - margin, y);
      });
      
      // Payments Section
      if (statement.payments.length > 0) {
        y += 10;
        if (y > 250) {
          doc.addPage();
          y = margin;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(23, 48, 66);
        doc.text('PAYMENT HISTORY', margin, y);
        
        // Table Header
        y += 6;
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, contentWidth, 8, 'F');
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('DATE', margin + 3, y + 5);
        doc.text('PAYMENT METHOD / REF', margin + 28, y + 5);
        doc.text('AMOUNT RECEIVED', width - margin - 3, y + 5, { align: 'right' });
        
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        
        statement.payments.forEach((payment: any) => {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          
          const dateStr = new Date(payment.payment_date).toLocaleDateString();
          doc.text(dateStr, margin + 3, y + 5);
          
          const methodStr = [
            payment.method ? payment.method.toUpperCase() : 'CASH',
            payment.receipt_number ? `(${payment.receipt_number})` : null
          ].filter(Boolean).join(' ');
          doc.text(methodStr, margin + 28, y + 5);
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(22, 163, 74);
          doc.text(`- Rs. ${payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, width - margin - 3, y + 5, { align: 'right' });
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          
          y += 8;
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, y, width - margin, y);
        });
      }
      
      doc.save(`${statement.farmer_name}_statement.pdf`);
      toast.success('Statement PDF downloaded!');
    } catch (err) {
      console.error('Failed to generate PDF', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  /* ══════════════════════════════
     Data loading — single RPC call (works for anonymous users)
     No re-fetches on filter change (all filtering is local)
  ══════════════════════════════ */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) { setStatus('not_found'); return; }
      try {
        const { data, error } = await supabase.rpc('get_farmer_public_statement', {
          p_token: token,
        });

        if (error || !data) {
          if (error) console.error('Public Statement RPC Error:', error);
          setStatus('not_found');
          return;
        }

        const txns = (data.transactions || []) as Array<{
          type: string; ref: string; date: string;
          amount: number; balance: number | null; branch?: string | null;
          is_verified?: boolean; delivery_pin?: string | null;
        }>;

        const bills: Bill[] = txns
          .filter((t) => t.type === 'bill' || t.type === 'adjustment')
          .map((t, i) => ({
            id: `bill-${i}`,
            bill_number: t.ref,
            bill_date: t.date,
            total: Number(t.amount),
            balance_due: Number(t.balance ?? 0),
            items: [],
            is_adjustment: t.type === 'adjustment',
            branch_name: t.branch ?? null,
            is_verified: t.is_verified,
            delivery_pin: t.delivery_pin ?? undefined,
          }));

        const payments: Payment[] = txns
          .filter((t) => t.type === 'payment')
          .map((t) => ({
            receipt_number: t.ref,
            method: null,
            payment_date: t.date,
            amount: Number(t.amount),
            branch_name: t.branch ?? null,
          }));

        setBillLimitReached(bills.length >= 50 || payments.length >= 50);

        setStatement({
          shop_name: data.shop_name || 'Your Dealer',
          shop_phone: data.shop_phone || null,
          shop_address: data.shop_address || null,
          shop_district: data.shop_district || null,
          farmer_name: data.farmer_name,
          village: data.village || null,
          total_due: Number(data.total_due) || 0,
          bills,
          payments,
          generated_at: data.generated_at || new Date().toISOString(),
        });
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [token]);

  /* ══════════════════════════════
     Client-side derived data  — O(n) on max 200 bills, negligible
  ══════════════════════════════ */
  const filteredBills = useMemo(() => {
    if (!statement) return [];
    let list = [...statement.bills];

    // Date range
    if (dateFrom) list = list.filter(b => b.bill_date >= dateFrom);
    if (dateTo)   list = list.filter(b => b.bill_date <= dateTo);

    // Pay status
    if (payFilter === 'paid')   list = list.filter(b => b.balance_due <= 0);
    if (payFilter === 'unpaid') list = list.filter(b => b.balance_due > 0);

    // Search by bill number or product name
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(b =>
        b.bill_number.toLowerCase().includes(q) ||
        b.items.some(i => i.product_name_snapshot?.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortOrder === 'oldest') list = [...list].reverse();

    return list;
  }, [statement, dateFrom, dateTo, payFilter, search, sortOrder]);

  const filteredPayments = useMemo(() => {
    if (!statement) return [];
    let list = [...statement.payments];
    if (dateFrom) list = list.filter(p => p.payment_date >= dateFrom);
    if (dateTo)   list = list.filter(p => p.payment_date <= dateTo);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        (p.receipt_number || '').toLowerCase().includes(q) ||
        (p.method || '').toLowerCase().includes(q)
      );
    }
    if (sortOrder === 'oldest') list = [...list].reverse();
    return list;
  }, [statement, dateFrom, dateTo, search, sortOrder]);

  /* ── Summary numbers for active filter ── */
  const summary = useMemo(() => {
    const totalBilled  = filteredBills.reduce((s, b) => s + b.total, 0);
    const totalPending = filteredBills.reduce((s, b) => s + Math.max(0, b.balance_due), 0);
    const totalPaid    = filteredPayments.reduce((s, p) => s + p.amount, 0);
    const paidCount    = filteredBills.filter(b => b.balance_due <= 0).length;
    const unpaidCount  = filteredBills.filter(b => b.balance_due > 0).length;
    return { totalBilled, totalPending, totalPaid, paidCount, unpaidCount };
  }, [filteredBills, filteredPayments]);

  const hasFilters = dateFrom || dateTo || payFilter !== 'all' || search;
  const clearFilters = () => {
    setDateFrom(''); setDateTo('');
    setPayFilter('all'); setSearch('');
  };

  /* ══════════════════════════════
     Actions
  ══════════════════════════════ */
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExpandBill = async (bill: Bill) => {
    if (expandedBillId === bill.id) {
      setExpandedBillId(null);
      return;
    }
    setExpandedBillId(bill.id);
    // Already fetched
    if (expandedBillItems[bill.id]) return;
    setLoadingBillItems(bill.id);
    try {
      const { data, error } = await supabase.rpc('get_public_bill_items', {
        p_token: token,
        p_bill_number: bill.bill_number
      });
      if (!error && data) {
        setExpandedBillItems(prev => ({ ...prev, [bill.id]: data as BillItem[] }));
      }
    } catch (e) {
      console.error('Failed to fetch bill items', e);
    } finally {
      setLoadingBillItems(null);
    }
  };

  const handleWhatsAppShare = () => {
    if (!statement) return;
    const text = encodeURIComponent(
      `My balance at ${statement.shop_name}: ${formatCurrency(statement.total_due)}\nView statement: ${window.location.href}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  /* ══════════════════════════════
     Loading / Error states
  ══════════════════════════════ */
  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200"
          style={{ borderTopColor: P }} />
        <p className="text-sm font-semibold text-slate-400">Loading statement…</p>
      </div>
    );
  }

  if (status !== 'ready' || !statement) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <FileText className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Statement not available</h1>
        <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
          {status === 'error'
            ? 'Something went wrong. Please try again.'
            : 'Invalid or expired link. Ask your dealer for a new one.'}
        </p>
      </div>
    );
  }

  const isPaidUp = statement.total_due <= 0;

  /* ══════════════════════════════
     RENDER
  ══════════════════════════════ */
  return (
    <div className="min-h-dvh bg-[#f0f4f8] pb-14 font-sans antialiased">

      {/* ─── Hero Header ─── */}
      <header
        className="relative overflow-hidden px-5 pb-24 pt-10 text-white"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)' }}
      >
        <div className="absolute -right-8 -top-8 h-44 w-44 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-4 h-24 w-24 rounded-full bg-white/5" />
        <div className="absolute right-4 bottom-8 h-16 w-16 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-xl">
          {/* Shop row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-extrabold tracking-tight">{statement.shop_name}</h1>
                {(statement.shop_address || statement.shop_district) && (
                  <p className="text-[11px] font-medium text-white/60 truncate mt-0.5">
                    {[statement.shop_address, statement.shop_district].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Farmer chip */}
          <div className="mt-5 flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              {statement.farmer_name}
              {statement.village ? ` · ${statement.village}` : ''}
            </span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-14 max-w-xl space-y-3 px-4">

        {/* ─── Balance Card ─── */}
        <section className="rounded-[24px] bg-white p-5 shadow-xl shadow-slate-200/70 border border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Balance Due</p>
              <p className={`mt-1 text-4xl font-extrabold tabular-nums tracking-tight leading-none ${isPaidUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(statement.total_due)}
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                {isPaidUp
                  ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> All clear — no dues!</>
                  : <><AlertCircle className="h-3.5 w-3.5 text-rose-400" /> As on {formatDate(statement.generated_at)}</>
                }
              </p>
            </div>
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isPaidUp ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              {isPaidUp ? <CheckCircle2 className="h-7 w-7 text-emerald-500" /> : <AlertCircle className="h-7 w-7 text-rose-500" />}
            </div>
          </div>

          {/* Mini stat row */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2.5" style={{ background: P_LIGHT }}>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: P }}>Total Billed</p>
              <p className="mt-0.5 text-[13px] font-extrabold text-slate-800 tabular-nums">{formatCurrency(statement.bills.reduce((s,b) => s+b.total, 0))}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Paid</p>
              <p className="mt-0.5 text-[13px] font-extrabold text-slate-800 tabular-nums">{formatCurrency(statement.payments.reduce((s,p) => s+p.amount, 0))}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Bills</p>
              <p className="mt-0.5 text-[13px] font-extrabold text-slate-800">{statement.bills.length}</p>
            </div>
          </div>

          {/* CTA row */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95 cursor-pointer">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>

            <button onClick={handleDownloadPdf} disabled={isDownloadingPdf}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95 cursor-pointer disabled:opacity-50">
              <FileText className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
              {isDownloadingPdf ? 'Loading...' : 'Download PDF'}
            </button>

            {statement.shop_phone && (
              <a href={`https://wa.me/91${statement.shop_phone}`} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold text-white transition-all active:scale-95 text-center justify-center"
                style={{ background: '#25D366' }}>
                <Phone className="h-3.5 w-3.5" /> Call Shop
              </a>
            )}
          </div>
        </section>

        {/* ─── Tabs ─── */}
        <div className="flex gap-1 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-100">
          {(['bills', 'payments', 'summary'] as ActiveTab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 rounded-xl py-2.5 text-xs font-bold capitalize transition-all"
              style={activeTab === tab ? { background: P, color: 'white' } : { color: '#64748b' }}>
              {tab === 'bills' ? `Bills (${statement.bills.length})` :
               tab === 'payments' ? `Payments (${statement.payments.length})` :
               'Summary'}
            </button>
          ))}
        </div>

        {/* ─── Filter Panel (Bills + Payments) ─── */}
        {activeTab !== 'summary' && (
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            {/* Search row */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={activeTab === 'bills' ? 'Search bill no. or product…' : 'Search payment…'}
                className="flex-1 bg-transparent py-1 text-sm text-slate-800 placeholder:text-slate-400 outline-none font-medium"
              />
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${showFilters ? 'text-white' : 'text-slate-500 bg-slate-100'}`}
                style={showFilters ? { background: P, color: 'white' } : {}}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
                {hasFilters && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-rose-400 inline-block" />}
              </button>
            </div>

            {/* Expanded filters */}
            {showFilters && (
              <div className="px-3 py-3 space-y-3 border-b border-slate-100 bg-slate-50/50">
                {/* Date range */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Date Range
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 mb-1 block">From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 mb-1 block">To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                  {/* Date quick picks */}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[
                      { label: 'This Month', fn: () => {
                        const n = new Date(); const y = n.getFullYear(); const m = String(n.getMonth()+1).padStart(2,'0');
                        setDateFrom(`${y}-${m}-01`); setDateTo(`${y}-${m}-${String(new Date(y,n.getMonth()+1,0).getDate()).padStart(2,'0')}`);
                      }},
                      { label: 'Last 30 days', fn: () => {
                        const to = new Date(); const from = new Date(); from.setDate(from.getDate()-30);
                        setDateFrom(from.toISOString().split('T')[0]); setDateTo(to.toISOString().split('T')[0]);
                      }},
                      { label: 'Last 3 months', fn: () => {
                        const to = new Date(); const from = new Date(); from.setMonth(from.getMonth()-3);
                        setDateFrom(from.toISOString().split('T')[0]); setDateTo(to.toISOString().split('T')[0]);
                      }},
                      { label: 'This Year', fn: () => {
                        const y = new Date().getFullYear();
                        setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`);
                      }},
                    ].map(({ label, fn }) => (
                      <button key={label} onClick={fn}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment status (only for bills tab) */}
                {activeTab === 'bills' && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                      <Banknote className="h-3 w-3" /> Payment Status
                    </p>
                    <div className="flex gap-1.5">
                      {pill(payFilter === 'all',    'All Bills',  () => setPayFilter('all'))}
                      {pill(payFilter === 'unpaid', 'Pending',    () => setPayFilter('unpaid'), '#dc2626')}
                      {pill(payFilter === 'paid',   'Paid',       () => setPayFilter('paid'),   '#16a34a')}
                    </div>
                  </div>
                )}

                {/* Sort */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Sort</p>
                  <div className="flex gap-1.5">
                    {pill(sortOrder === 'newest', 'Newest First', () => setSortOrder('newest'))}
                    {pill(sortOrder === 'oldest', 'Oldest First', () => setSortOrder('oldest'))}
                  </div>
                </div>

                {/* Clear all */}
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors">
                    <X className="h-3.5 w-3.5" /> Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Active filter chips */}
            {hasFilters && !showFilters && (
              <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 scrollbar-none">
                <Filter className="h-3 w-3 text-slate-400 shrink-0" />
                {dateFrom && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">From {formatDate(dateFrom)}</span>}
                {dateTo && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">To {formatDate(dateTo)}</span>}
                {payFilter !== 'all' && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 capitalize">{payFilter}</span>}
                {search && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">"{search}"</span>}
                <button onClick={clearFilters} className="ml-auto shrink-0 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Filter result summary bar */}
            {(hasFilters || filteredBills.length !== statement.bills.length) && activeTab === 'bills' && (
              <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 bg-slate-50 border-t border-slate-100">
                Showing {filteredBills.length} of {statement.bills.length} bills
                {payFilter === 'unpaid' && ` · Pending: ${formatCurrency(summary.totalPending)}`}
                {payFilter === 'paid' && ` · Paid total: ${formatCurrency(summary.totalBilled)}`}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════
            BILLS TAB
        ════════════════════ */}
        {activeTab === 'bills' && (
          <section className="space-y-2.5">
            {/* ⚠️ Warn when the 200-bill silent cap is hit */}
            {billLimitReached && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Showing only the most recent 50 bills and 50 payments. For the complete statement, please contact your dealer directly.
                </p>
              </div>
            )}
            {filteredBills.length === 0 && (

              <div className="rounded-2xl bg-white px-5 py-12 text-center border border-slate-100 shadow-sm">
                <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">No bills match your filters</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="mt-3 text-xs font-bold" style={{ color: P }}>
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {filteredBills.map((bill) => {
              const isExpanded = expandedBillId === bill.id;
              const isPending  = bill.balance_due > 0;

              return (
                <div key={bill.id}
                  className="overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm">

                  {/* Bill row — tap to expand */}
                  <button
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
                    onClick={() => handleExpandBill(bill)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isPending ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                        <Receipt className={`h-5 w-5 ${isPending ? 'text-rose-500' : 'text-emerald-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {bill.bill_number}
                          {bill.branch_name && (
                            <span className="ml-2 inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
                              {bill.branch_name}
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mt-0.5">
                          <Clock className="h-3 w-3" /> {formatDate(bill.bill_date)}
                          <span className="mx-1 text-slate-200">·</span>
                          <span className="text-slate-400">{bill.is_adjustment ? 'Rate adjustment' : (expandedBillItems[bill.id] || []).length > 0 ? `${expandedBillItems[bill.id].length} items` : 'Tap to view items'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(bill.total)}</p>
                        {isPending
                          ? <p className="text-[11px] font-bold text-rose-500">{formatCurrency(bill.balance_due)} due</p>
                          : <p className="text-[11px] font-bold text-emerald-600">✓ Paid</p>
                        }
                      </div>
                      <span className="text-slate-300">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    </div>
                  </button>

                  {/* Delivery PIN — only shown to the farmer while the bill
                       is unverified. This is the shared secret they hand back
                       to the dealer on delivery to prove receipt. */}
                  {bill.is_verified === false && bill.delivery_pin && (
                    <div className="mx-3 mb-3 rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-800">
                        Delivery PIN — share only after receiving goods
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <div className="flex gap-1.5">
                          {String(bill.delivery_pin).split('').map((d, idx) => (
                            <div key={idx} className="flex h-10 w-9 items-center justify-center rounded-lg bg-white text-xl font-black text-blue-900 shadow-inner ring-2 ring-blue-200 tabular-nums">{d}</div>
                          ))}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600 flex-1 min-w-0">
                          Tell your shopkeeper this PIN when goods reach you. They will enter it to confirm delivery.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Expanded items ── */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                        <span>Product</span>
                        <span className="text-center">Qty</span>
                        <span className="text-right">Total</span>
                      </div>

                      {loadingBillItems === bill.id && (
                        <div className="flex items-center justify-center gap-2 px-4 py-5 text-sm text-slate-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200" style={{ borderTopColor: P }} />
                          Loading items…
                        </div>
                      )}

                      {!loadingBillItems && (expandedBillItems[bill.id] || []).length === 0 && loadingBillItems !== bill.id && (
                        <p className="px-4 py-4 text-center text-sm text-slate-400">No items found.</p>
                      )}

                      {(expandedBillItems[bill.id] || []).map((item, idx) => {
                        const disc  = Number(item.medicine_discount_percentage || 0);
                        const mrp   = Number(item.mrp || 0);
                        const price = Number(item.unit_price || 0);
                        const showDisc = disc > 0 && mrp > 0 && Math.abs(mrp - price) > 0.01;

                        return (
                          <div key={item.id || idx}
                            className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 border-t border-slate-50 items-start">
                            {/* Product col */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <p className="text-xs font-bold text-slate-800 truncate">{item.product_name_snapshot}</p>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  ₹{price.toFixed(2)}/unit
                                </span>
                                {showDisc && (
                                  <>
                                    <span className="text-[10px] text-slate-300 line-through">₹{mrp.toFixed(2)}</span>
                                    <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white bg-emerald-500">
                                      <Tag className="h-2.5 w-2.5" />{disc}% off
                                    </span>
                                  </>
                                )}
                              </div>
                              {Number(item.gst_rate || 0) > 0 && (
                                <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                                  GST {item.gst_rate}% · ₹{Number(item.gst_amount || 0).toFixed(2)}
                                </p>
                              )}
                            </div>
                            {/* Qty col */}
                            <div className="pt-0.5 text-center">
                              <span className="inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-black"
                                style={{ background: P_LIGHT, color: P }}>
                                ×{Number(item.quantity)}
                              </span>
                            </div>
                            {/* Total col */}
                            <div className="pt-0.5 text-right">
                              <p className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(item.total_price)}</p>
                            </div>
                          </div>
                        );
                      })}

                    {/* Bill footer */}
                      <div className="px-4 py-3 border-t border-dashed border-slate-200 bg-slate-50 space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                          <span>Bill Total</span>
                          <span className="tabular-nums">{formatCurrency(bill.total)}</span>
                        </div>
                        {bill.balance_due > 0 ? (
                          <div className="flex justify-between text-sm font-black text-rose-600 border-t border-slate-200 pt-2">
                            <span>Balance Due</span>
                            <span className="tabular-nums">{formatCurrency(bill.balance_due)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-emerald-600 border-t border-slate-200 pt-2">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Fully Paid
                          </div>
                        )}
                        
                        {/* PIN Display for Unverified Bills */}
                        {bill.is_verified === false && bill.delivery_pin && (
                          <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                              <span className="text-xs font-bold text-amber-700">Delivery PIN</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black tracking-[0.2em] text-slate-900">{bill.delivery_pin}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600/70">Share this with driver</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* ════════════════════
            PAYMENTS TAB
        ════════════════════ */}
        {activeTab === 'payments' && (
          <section className="overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm">
            {filteredPayments.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <IndianRupee className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">No payments match filters</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPayments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                        <IndianRupee className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">
                          {p.method ? p.method.charAt(0).toUpperCase() + p.method.slice(1) : 'Payment'}
                          {p.receipt_number ? ` · ${p.receipt_number}` : ''}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> {formatDate(p.payment_date)}
                          {p.branch_name && (
                            <span className="ml-1 inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
                              {p.branch_name}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-600 tabular-nums">−{formatCurrency(p.amount)}</p>
                      <p className="text-[10px] font-bold text-emerald-500">Received</p>
                    </div>
                  </div>
                ))}
                {/* Payments total */}
                <div className="flex justify-between px-4 py-3 bg-emerald-50">
                  <span className="text-sm font-black text-slate-700">Total Paid</span>
                  <span className="text-sm font-black text-emerald-700 tabular-nums">
                    {formatCurrency(filteredPayments.reduce((s, p) => s + p.amount, 0))}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ════════════════════
            SUMMARY TAB
        ════════════════════ */}
        {activeTab === 'summary' && (
          <section className="space-y-3">
            {/* Overall summary card */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100" style={{ background: P_LIGHT }}>
                <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: P }}>Account Summary</p>
              </div>
              {(() => {
                const billed = statement.bills.reduce((s,b)=>s+b.total,0);
                const paid   = statement.payments.reduce((s,p)=>s+p.amount,0);
                // A bill can also be settled without a payment row - settlement
                // discount, write-off, return. Without this residual on screen
                // "Billed - Paid" never equals "Balance Due" and the farmer sees
                // three numbers that don't add up. Meaningless once the RPC's
                // 50-row cap truncates either list, so hide it there.
                const relief = billed - paid - statement.total_due;
                const showRelief = !billLimitReached && Math.abs(relief) >= 1;
                return (
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Total Bills', value: statement.bills.length.toString(), icon: Receipt, color: 'text-slate-600' },
                  { label: 'Total Billed', value: formatCurrency(billed), icon: TrendingUp, color: 'text-slate-600' },
                  { label: 'Total Paid', value: formatCurrency(paid), icon: TrendingDown, color: 'text-emerald-600' },
                  ...(showRelief ? [{ label: relief > 0 ? 'Discount / Adjustment' : 'Extra Charges', value: formatCurrency(Math.abs(relief)), icon: Tag, color: 'text-indigo-600' }] : []),
                  { label: 'Balance Due', value: formatCurrency(Math.max(0, statement.total_due)), icon: AlertCircle, color: statement.total_due > 0 ? 'text-rose-600' : 'text-emerald-600' },
                  { label: 'Fully Paid Bills', value: String(statement.bills.filter(b=>b.balance_due<=0).length), icon: CheckCircle2, color: 'text-emerald-600' },
                  { label: 'Pending Bills', value: String(statement.bills.filter(b=>b.balance_due>0).length), icon: Clock, color: 'text-amber-600' },
                  { label: 'Total Payments', value: statement.payments.length.toString(), icon: Banknote, color: 'text-slate-600' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                      <span className="text-sm font-semibold text-slate-600">{label}</span>
                    </div>
                    <span className={`text-sm font-black tabular-nums ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
                );
              })()}
            </div>

            {/* Products bought summary */}
            {(() => {
              // Aggregate product totals across all bills — client-side, no DB call
              const productMap = new Map<string, { qty: number; total: number }>();
              statement.bills.forEach(b => b.items.forEach(i => {
                const key = i.product_name_snapshot;
                const cur = productMap.get(key) || { qty: 0, total: 0 };
                productMap.set(key, { qty: cur.qty + i.quantity, total: cur.total + i.total_price });
              }));
              const products = Array.from(productMap.entries())
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.total - a.total);

              if (products.length === 0) return null;
              return (
                <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100" style={{ background: P_LIGHT }}>
                    <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: P }}>Products Purchased</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {products.slice(0, 10).map(({ name, qty, total }) => (
                      <div key={name} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0 flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(total)}</p>
                          <p className="text-[10px] font-semibold text-slate-400">×{qty} units</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* Footer */}
        <footer className="py-4 text-center">
          <p className="text-[11px] font-semibold text-slate-400">
            Generated {formatDate(statement.generated_at)} · {statement.shop_name}
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Powered by{' '}
            <Link to="/" className="font-black" style={{ color: P }}>AquaDealers</Link>
          </p>
        </footer>
      </main>
    </div>
  );
};

export default FarmerStatementPage;
