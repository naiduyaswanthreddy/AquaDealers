import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button, EmptyState, SearchBar, Skeleton } from '@/components/ui';
import { FilterBar } from '@/components/layout/FilterBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import FarmerCard from '../components/FarmerCard';
import { useFarmers } from '../hooks/useFarmers';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { shareDuesReportViaWhatsApp, downloadDuesReportPdf } from '../utils/duesReportPdf';
import { Download, MessageCircle } from 'lucide-react';

export const DuesPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const dealer = useAuthStore(s => s.user);
  
  const { data: allFarmers = [], isLoading } = useFarmers({
    search: search || undefined,
    sortBy: 'total_due', // Let useFarmers sort it
  });

  // Filter only farmers with dues and sort them descending (highest dues first)
  const farmersWithDues = useMemo(() => {
    return allFarmers
      .filter((farmer) => farmer.total_due > 0)
      .sort((a, b) => b.total_due - a.total_due);
  }, [allFarmers]);

  const totalDuesAmount = useMemo(() => {
    return farmersWithDues.reduce((sum, f) => sum + (f.total_due || 0), 0);
  }, [farmersWithDues]);

  const listRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: farmersWithDues.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 100, // Adjust estimated size of FarmerCard
    overscan: 5,
  });

  const hasFilters = !!search;

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
        </div>

        <FilterBar>
          <div className="filter-bar__grow">
            <SearchBar value={search} onChange={setSearch} placeholder={t('farmers.searchPlaceholder', 'Search by name, phone or village')} />
          </div>
        </FilterBar>
      </SectionCard>

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
                ? t('farmers.tryChangingSearch', 'Try changing your search.')
                : t('farmers.allCleared', 'All your farmers have cleared their balances.')
            }
          />
        ) : (
          <div ref={listRef} className="max-h-[60dvh] overflow-y-auto pr-1">
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const farmer = farmersWithDues[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 w-full"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="pb-3">
                      <FarmerCard farmer={farmer} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
};

export default DuesPage;
