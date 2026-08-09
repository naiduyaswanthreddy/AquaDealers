import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useEstimates } from '../hooks/useEstimate';

const PAGE_SIZE = 20;

const EstimatesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useEstimates({
    dealerId: user?.id || '',
    limit: PAGE_SIZE,
    offset,
  });

  const estimates = data?.estimates ?? [];
  const totalCount = data?.total_count ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <PageShell>
      <PageHeader
        title="Estimates"
        action={
          <button
            type="button"
            onClick={() => navigate('/estimates/new')}
            className="flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)', boxShadow: '0 4px 12px rgba(0,82,204,0.3)' }}
          >
            <Plus className="h-4 w-4" />
            New Estimate
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* ── Loading skeleton ─────────────────────────────────── */}
        {isLoading && (
          <div className="rounded-2xl bg-white border border-[#d9e5ee] overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(20,54,84,0.06)' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-[#f0f7ff]' : ''}`}>
                <div className="h-9 w-9 rounded-full bg-[#e7f5ff] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-24 rounded-full bg-[#e7f5ff] animate-pulse" />
                  <div className="h-3 w-36 rounded-full bg-[#f0f7ff] animate-pulse" />
                </div>
                <div className="h-4 w-16 rounded-full bg-[#e7f5ff] animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
        {!isLoading && estimates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{ background: 'linear-gradient(135deg,#e7f5ff,#d8eefc)' }}
            >
              <FileText className="h-9 w-9 text-[#0052cc]" />
            </div>
            <div>
              <p className="font-bold text-[#173042] text-base">No estimates yet</p>
              <p className="text-sm text-[#8ba0af] mt-1">Create a price quote for a farmer</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/estimates/new')}
              className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)', boxShadow: '0 4px 12px rgba(0,82,204,0.25)' }}
            >
              <Plus className="h-4 w-4" />
              Create first estimate
            </button>
          </div>
        )}

        {/* ── List ─────────────────────────────────────────────── */}
        {!isLoading && estimates.length > 0 && (
          <>
            {/* Desktop table */}
            <div
              className="hidden lg:block rounded-2xl bg-white border border-[#d9e5ee] overflow-hidden"
              style={{ boxShadow: '0 4px 16px rgba(20,54,84,0.06)' }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0f7ff]" style={{ background: '#f8fbff' }}>
                    <th className="px-5 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-[#8ba0af]">Estimate #</th>
                    <th className="px-5 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-[#8ba0af]">Farmer</th>
                    <th className="px-5 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-[#8ba0af]">Date</th>
                    <th className="px-5 py-3.5 text-right text-[0.68rem] font-bold uppercase tracking-widest text-[#8ba0af]">Total</th>
                    <th className="px-5 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-[#8ba0af]">Status</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((e, i) => (
                    <tr
                      key={e.id}
                      className="group cursor-pointer transition-colors hover:bg-[#f0f7ff]"
                      style={{ borderTop: i > 0 ? '1px solid #f0f7ff' : undefined }}
                      onClick={() => navigate(`/estimates/${e.id}`)}
                    >
                      <td className="px-5 py-4">
                        <span
                          className="font-mono text-xs font-bold px-2 py-1 rounded-lg"
                          style={{ background: '#e7f5ff', color: '#0052cc' }}
                        >
                          {e.estimate_number}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)' }}
                          >
                            {e.farmer_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-[#173042]">{e.farmer_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#5d7486]">{formatDate(e.estimate_date)}</td>
                      <td className="px-5 py-4 text-right font-bold text-[#173042] tabular-nums">
                        {formatCurrency(e.total)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold"
                          style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}
                        >
                          Price Quote
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <ChevronRight className="h-4 w-4 text-[#d9e5ee] group-hover:text-[#0052cc] transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div
              className="lg:hidden rounded-2xl bg-white border border-[#d9e5ee] overflow-hidden"
              style={{ boxShadow: '0 4px 16px rgba(20,54,84,0.06)' }}
            >
              {estimates.map((e, i) => (
                <Link
                  key={e.id}
                  to={`/estimates/${e.id}`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-[#f0f7ff] transition-colors"
                  style={{ borderTop: i > 0 ? '1px solid #f0f7ff' : undefined }}
                >
                  {/* avatar */}
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)' }}
                  >
                    {e.farmer_name?.[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-mono text-[0.7rem] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: '#e7f5ff', color: '#0052cc' }}
                      >
                        {e.estimate_number}
                      </span>
                      <span
                        className="text-[0.65rem] font-bold rounded-full px-2 py-0.5"
                        style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}
                      >
                        Price Quote
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#173042] mt-0.5 truncate">{e.farmer_name}</p>
                    <p className="text-xs text-[#8ba0af]">{formatDate(e.estimate_date)}</p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-bold text-sm text-[#173042] tabular-nums">{formatCurrency(e.total)}</span>
                    <ChevronRight className="h-4 w-4 text-[#d9e5ee]" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8ba0af]">
                  Page {currentPage} of {totalPages} · {totalCount} estimates
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#e7f5ff', color: '#0052cc' }}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={offset + PAGE_SIZE >= totalCount}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#e7f5ff', color: '#0052cc' }}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
};

export default EstimatesListPage;
