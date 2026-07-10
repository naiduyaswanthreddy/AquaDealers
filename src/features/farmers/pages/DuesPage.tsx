import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarClock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button, EmptyState, SearchBar, Skeleton } from '@/components/ui';
import { FilterBar } from '@/components/layout/FilterBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import DuesFarmerRow from '../components/DuesFarmerRow';
import AgeingBlocks, { AgeingBucketKey } from '../components/AgeingBlocks';
import FollowUpModal from '../components/FollowUpModal';
import { useFarmers, useDuesAgeing } from '../hooks/useFarmers';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { shareDuesReportViaWhatsApp, downloadDuesReportPdf } from '../utils/duesReportPdf';
import { Download, MessageCircle } from 'lucide-react';
import type { Farmer } from '@/types/database';
import type { DuesAgeingRow } from '../services/farmerService';

const bucketAmount = (row: DuesAgeingRow, bucket: AgeingBucketKey): number => {
  switch (bucket) {
    case '0-30':
      return Number(row.amount_0_30);
    case '31-60':
      return Number(row.amount_31_60);
    case '61-90':
      return Number(row.amount_61_90);
    case '90+':
      return Number(row.amount_90_plus);
  }
};

export const DuesPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<AgeingBucketKey | null>(null);
  const [followUpFarmer, setFollowUpFarmer] = useState<Farmer | null>(null);
  const dealer = useAuthStore(s => s.user);

  const { data: allFarmers = [], isLoading } = useFarmers({
    search: search || undefined,
    sortBy: 'total_due', // Let useFarmers sort it
  });
  const { data: ageingRows = [] } = useDuesAgeing();

  const ageingByFarmer = useMemo(() => {
    const map = new Map<string, DuesAgeingRow>();
    ageingRows.forEach((row) => map.set(row.farmer_id, row));
    return map;
  }, [ageingRows]);

  const portfolioAgeing = useMemo(() => {
    const totals = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    ageingRows.forEach((row) => {
      totals['0-30'] += Number(row.amount_0_30);
      totals['31-60'] += Number(row.amount_31_60);
      totals['61-90'] += Number(row.amount_61_90);
      totals['90+'] += Number(row.amount_90_plus);
    });
    return totals;
  }, [ageingRows]);

  // Filter only farmers with dues and sort them descending (highest dues first)
  const farmersWithDues = useMemo(() => {
    let result = allFarmers.filter((farmer) => farmer.total_due > 0);
    if (selectedBucket) {
      result = result.filter((farmer) => {
        const row = ageingByFarmer.get(farmer.id);
        return row ? bucketAmount(row, selectedBucket) > 0 : false;
      });
    }
    return result.sort((a, b) => b.total_due - a.total_due);
  }, [allFarmers, selectedBucket, ageingByFarmer]);

  const totalDuesAmount = useMemo(() => {
    return farmersWithDues.reduce((sum, f) => sum + (f.total_due || 0), 0);
  }, [farmersWithDues]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const followUpsDue = useMemo(
    () =>
      allFarmers
        .filter((f) => f.total_due > 0 && f.follow_up_date && f.follow_up_date <= todayStr)
        .sort((a, b) => (a.follow_up_date || '').localeCompare(b.follow_up_date || '')),
    [allFarmers, todayStr]
  );

  const listRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: farmersWithDues.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 100, // Adjust estimated size of DuesFarmerRow
    overscan: 5,
  });

  const hasFilters = !!search || !!selectedBucket;

  const handleShareReport = async () => {
    try {
      setIsExporting(true);
      await shareDuesReportViaWhatsApp(farmersWithDues, dealer);
    } catch (error) {
      console.error('Failed to share dues report', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setIsExporting(true);
      await downloadDuesReportPdf(farmersWithDues, dealer);
    } catch (error) {
      console.error('Failed to download dues report', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow={t('nav.financials', 'Financials')}
        title={t('dashboard.outstandingDues', 'Outstanding Dues')}
        description={t('farmers.duesDescription', 'Monitor and manage pending payments from farmers.')}
        action={
          <div className="flex gap-2">
            <Button onClick={() => navigate(-1)} variant="secondary" leftIcon={<ArrowLeft className="h-4.5 w-4.5" />}>
              {t('common.back', 'Back')}
            </Button>
            <Button
              onClick={handleDownloadReport}
              variant="outline"
              loading={isExporting}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              leftIcon={<Download className="h-4.5 w-4.5" />}
            >
              Download PDF
            </Button>
            <Button
              onClick={handleShareReport}
              loading={isExporting}
              className="bg-[#25D366] hover:bg-[#1da851] text-white border-transparent"
              leftIcon={<MessageCircle className="h-4.5 w-4.5" />}
            >
              Share Report
            </Button>
          </div>
        }
      />

      <SectionCard className="space-y-4">
        {/* KPI Summary */}
        <div className="flex flex-col gap-1 mb-2">
          <span className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            {t('farmers.totalOutstanding', 'Total Outstanding')}
          </span>
          <span className="text-4xl font-extrabold text-danger">
            {formatCurrency(totalDuesAmount)}
          </span>
          {selectedBucket ? (
            <span className="text-xs font-bold text-slate-500">
              Showing farmers with dues aged {selectedBucket} days — tap the block again to clear.
            </span>
          ) : null}
        </div>

        <AgeingBlocks
          ageing={portfolioAgeing}
          selected={selectedBucket}
          onSelect={setSelectedBucket}
        />

        <FilterBar>
          <div className="filter-bar__grow">
            <SearchBar value={search} onChange={setSearch} placeholder={t('farmers.searchPlaceholder', 'Search by name, phone or village')} />
          </div>
        </FilterBar>
      </SectionCard>

      {followUpsDue.length > 0 && (
        <SectionCard
          title={t('farmers.followUpsDue', 'Follow-ups due')}
          description={t('farmers.followUpsDueDescription', 'Farmers who promised to pay by today')}
        >
          <div className="space-y-2">
            {followUpsDue.map((farmer) => (
              <div
                key={farmer.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/farmers/${farmer.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <CalendarClock className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{farmer.name}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">
                      Promised {farmer.promised_amount ? formatCurrency(farmer.promised_amount) : 'to pay'} by {formatDate(farmer.follow_up_date!)}
                      {farmer.follow_up_note ? ` — ${farmer.follow_up_note}` : ''}
                    </div>
                  </div>
                </button>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-extrabold text-rose-600">{formatCurrency(farmer.total_due)}</div>
                  <button
                    type="button"
                    onClick={() => setFollowUpFarmer(farmer)}
                    className="text-[11px] font-black text-sky-600 hover:underline"
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={`${farmersWithDues.length} ${t('farmers.farmerWithDues', 'farmer with dues')}${farmersWithDues.length === 1 ? '' : 's'}`}
        description={hasFilters ? t('farmers.filteredResults', 'Filtered results') : t('farmers.rankedDues', 'Farmers ranked by highest outstanding balance')}
      >
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : !farmersWithDues.length ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? t('common.noMatches', 'No matches found') : t('farmers.noDues', 'No outstanding dues!')}
            description={
              hasFilters
                ? t('farmers.tryChangingSearch', 'Try changing your search or ageing filter.')
                : t('farmers.allCleared', 'All your farmers have cleared their balances.')
            }
          />
        ) : (
          <div ref={listRef} className="max-h-[60dvh] overflow-y-auto pr-1">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const farmer = farmersWithDues[virtualRow.index];
                const ageingRow = ageingByFarmer.get(farmer.id);
                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 w-full"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="pb-3">
                      <DuesFarmerRow
                        farmer={farmer}
                        oldestDueDays={ageingRow ? ageingRow.oldest_due_days : null}
                        onFollowUp={setFollowUpFarmer}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {followUpFarmer && (
        <FollowUpModal
          isOpen={!!followUpFarmer}
          onClose={() => setFollowUpFarmer(null)}
          farmer={followUpFarmer}
        />
      )}
    </PageShell>
  );
};

export default DuesPage;
