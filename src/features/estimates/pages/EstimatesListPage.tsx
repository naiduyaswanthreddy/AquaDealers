import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useEstimates } from '../hooks/useEstimate';

const PAGE_SIZE = 20;

const EstimatesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setOffset(0);
  }, []);

  const { data, isLoading } = useEstimates({
    dealerId: user?.id || '',
    limit: PAGE_SIZE,
    offset,
    search: search || undefined,
  });

  const estimates = data?.estimates ?? [];
  const totalCount = data?.total_count ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <PageShell>
      <PageHeader
        title="Estimates"
        description="Price quotes for your farmers"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/estimates/new')}
          >
            New Estimate
          </Button>
        }
      />

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <SearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder="Search by farmer or estimate number…"
      />

      {/* ── Loading skeleton ────────────────────────────────────────── */}
      {isLoading && (
        <SectionCard>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 py-3.5"
              style={{ borderTop: i > 0 ? '1px solid rgba(217,229,238,0.7)' : undefined }}
            >
              <Skeleton variant="circle" width={40} height={40} className="flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="40%" height={14} />
                <Skeleton variant="text" width="60%" height={12} />
              </div>
              <Skeleton variant="text" width={72} height={14} />
              <Skeleton variant="rect" width={16} height={16} className="rounded-full flex-shrink-0" />
            </div>
          ))}
        </SectionCard>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!isLoading && estimates.length === 0 && (
        <EmptyState
          icon={search ? FileText : FileText}
          title={search ? 'No results found' : 'No estimates yet'}
          description={
            search
              ? `No estimates match "${search}". Try a different search term.`
              : 'Create your first price quote for a farmer. Estimates don\'t affect stock or dues.'
          }
          action={
            !search ? (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => navigate('/estimates/new')}
              >
                Create first estimate
              </Button>
            ) : undefined
          }
        />
      )}

      {/* ── List ────────────────────────────────────────────────────── */}
      {!isLoading && estimates.length > 0 && (
        <>
          {/* Result summary */}
          <p className="text-xs font-semibold text-text-muted px-0.5">
            {search
              ? `${totalCount} result${totalCount !== 1 ? 's' : ''} for "${search}"`
              : `${totalCount} estimate${totalCount !== 1 ? 's' : ''} total`}
          </p>

          {/* Desktop table */}
          <SectionCard className="hidden lg:block p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-border"
                  style={{ background: 'rgba(231,245,255,0.6)' }}
                >
                  <th className="px-5 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-text-muted">
                    Estimate #
                  </th>
                  <th className="px-5 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-text-muted">
                    Farmer
                  </th>
                  <th className="px-5 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-text-muted">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-right text-[0.68rem] font-bold uppercase tracking-widest text-text-muted">
                    Total
                  </th>
                  <th className="px-5 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-text-muted">
                    Status
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {estimates.map((e, i) => (
                  <tr
                    key={e.id}
                    className="group cursor-pointer transition-colors hover:bg-surface"
                    style={{ borderTop: i > 0 ? '1px solid rgba(217,229,238,0.5)' : undefined }}
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
                        <span className="font-semibold text-text-primary">{e.farmer_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-text-secondary">{formatDate(e.estimate_date)}</td>
                    <td className="px-5 py-4 text-right font-bold text-text-primary tabular-nums">
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
                      <ChevronRight className="h-4 w-4 text-border group-hover:text-primary transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>

          {/* Mobile cards */}
          <SectionCard className="lg:hidden p-0 overflow-hidden">
            {estimates.map((e, i) => (
              <Link
                key={e.id}
                to={`/estimates/${e.id}`}
                className="flex items-center gap-3 px-4 py-4 hover:bg-surface transition-colors active:bg-surface-muted"
                style={{ borderTop: i > 0 ? '1px solid rgba(217,229,238,0.5)' : undefined }}
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
                  <p className="text-sm font-semibold text-text-primary mt-0.5 truncate">{e.farmer_name}</p>
                  <p className="text-xs text-text-muted">{formatDate(e.estimate_date)}</p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-bold text-sm text-text-primary tabular-nums">
                    {formatCurrency(e.total)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-border" />
                </div>
              </Link>
            ))}
          </SectionCard>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-text-muted font-medium">
                Page {currentPage} of {totalPages} · {totalCount} estimates
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                  disabled={offset + PAGE_SIZE >= totalCount}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

export default EstimatesListPage;
