import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Droplet, FileText, IndianRupee, Phone, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';

interface StatementTransaction {
  type: 'bill' | 'payment';
  ref: string;
  date: string;
  amount: number;
  balance: number | null;
}

interface PublicStatement {
  shop_name: string;
  shop_phone: string | null;
  shop_address: string | null;
  shop_district: string | null;
  farmer_name: string;
  village: string | null;
  total_due: number;
  transactions: StatementTransaction[];
  generated_at: string;
}

/**
 * Read-only balance statement a farmer opens from a WhatsApp link — no login.
 * Access is controlled by the unguessable share token in the URL.
 */
const FarmerStatementPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [statement, setStatement] = useState<PublicStatement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        setStatus('not_found');
        return;
      }
      const { data, error } = await supabase.rpc('get_farmer_public_statement', {
        p_token: token,
      });
      if (cancelled) return;
      if (error) {
        setStatus('error');
        return;
      }
      if (!data) {
        setStatus('not_found');
        return;
      }
      setStatement(data as PublicStatement);
      setStatus('ready');
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (status === 'not_found' || status === 'error' || !statement) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <FileText className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Statement not available</h1>
        <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
          {status === 'error'
            ? 'Something went wrong while loading this statement. Please try again.'
            : 'This link is invalid or has been disabled. Please ask your dealer for a new link.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-10">
      {/* Shop header */}
      <header className="bg-gradient-to-br from-sky-600 to-sky-800 px-5 pb-16 pt-8 text-white">
        <div className="mx-auto flex max-w-xl items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Droplet className="h-5 w-5" />
              </div>
              <h1 className="truncate text-lg font-black tracking-tight">{statement.shop_name}</h1>
            </div>
            {statement.shop_address || statement.shop_district ? (
              <p className="mt-2 text-xs font-semibold text-white/70">
                {[statement.shop_address, statement.shop_district].filter(Boolean).join(', ')}
              </p>
            ) : null}
          </div>
          {statement.shop_phone ? (
            <a
              href={`tel:${statement.shop_phone}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-xs font-black transition-all active:scale-95"
            >
              <Phone className="h-3.5 w-3.5" />
              Call Shop
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto -mt-10 max-w-xl px-4">
        {/* Balance card */}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
            Balance Statement
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">{statement.farmer_name}</div>
          {statement.village ? (
            <div className="text-xs font-semibold text-slate-500">{statement.village}</div>
          ) : null}

          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Current Balance Due
            </div>
            <div className={`mt-1 text-3xl font-black ${statement.total_due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatCurrency(statement.total_due)}
            </div>
            {statement.total_due <= 0 && (
              <div className="mt-1 text-xs font-bold text-emerald-600">All clear — no dues!</div>
            )}
          </div>
          <div className="mt-3 text-[11px] font-semibold text-slate-400">
            As on {formatDate(statement.generated_at)} — issued by {statement.shop_name}
          </div>
        </section>

        {/* Transactions */}
        <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
            Recent Bills &amp; Payments
          </div>
          {statement.transactions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm font-medium text-slate-500">
              No transactions yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {statement.transactions.map((tx, index) => (
                <div key={`${tx.type}-${tx.ref}-${index}`} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        tx.type === 'bill' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {tx.type === 'bill' ? <Receipt className="h-4 w-4" /> : <IndianRupee className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">
                        {tx.type === 'bill' ? 'Bill' : 'Payment'} · {tx.ref}
                      </div>
                      <div className="text-xs font-semibold text-slate-400">{formatDate(tx.date)}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-black tabular-nums ${tx.type === 'bill' ? 'text-slate-900' : 'text-emerald-600'}`}>
                      {tx.type === 'bill' ? '' : '−'}{formatCurrency(tx.amount)}
                    </div>
                    {tx.type === 'bill' && tx.balance !== null && Number(tx.balance) > 0 ? (
                      <div className="text-[11px] font-bold text-rose-500">
                        {formatCurrency(Number(tx.balance))} pending
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs font-semibold text-slate-400">
          Powered by{' '}
          <Link to="/" className="font-black text-sky-600 hover:underline">
            AquaDealers
          </Link>
        </footer>
      </main>
    </div>
  );
};

export default FarmerStatementPage;
