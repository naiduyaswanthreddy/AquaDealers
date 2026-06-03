import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, MessageCircle, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, DateRangeFilter } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import { useStockLedgerReport } from '../hooks/useStockReport';
import { useAuthStore } from '@/stores/authStore';
import { downloadStockReportPdf, shareStockReportViaWhatsApp } from '../utils/stockReportPdf';

export const StockReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dealer = useAuthStore((s) => s.user);

  const now = useMemo(() => new Date(), []);
  const defaultFirstDay = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const defaultLastDay = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const [startDate, setStartDate] = useState(defaultFirstDay);
  const [endDate, setEndDate] = useState(defaultLastDay);
  const [isExporting, setIsExporting] = useState(false);

  const { data: reportItems = [], isLoading } = useStockLedgerReport(startDate, endDate);

  const handleShareReport = async () => {
    try {
      setIsExporting(true);
      await shareStockReportViaWhatsApp(reportItems, dealer, startDate, endDate);
    } catch (error) {
      console.error('Failed to share stock report', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setIsExporting(true);
      await downloadStockReportPdf(reportItems, dealer, startDate, endDate);
    } catch (error) {
      console.error('Failed to download stock report', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Ledger Report"
        description="View item movements and farmer allocations within a selected period."
        action={
          <div className="flex gap-2">
            <Button onClick={() => navigate(-1)} variant="secondary" leftIcon={<ArrowLeft className="h-4.5 w-4.5" />}>
              Back
            </Button>
            <Button 
              onClick={handleDownloadReport} 
              variant="outline" 
              loading={isExporting}
              disabled={reportItems.length === 0}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              leftIcon={<Download className="h-4.5 w-4.5" />}
            >
              Download PDF
            </Button>
            <Button 
              onClick={handleShareReport} 
              loading={isExporting}
              disabled={reportItems.length === 0}
              className="bg-[#25D366] hover:bg-[#1da851] text-white border-transparent"
              leftIcon={<MessageCircle className="h-4.5 w-4.5" />}
            >
              Share Report
            </Button>
          </div>
        }
      />

      <div className="mb-6 max-w-sm">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
        />
      </div>

      <SectionCard>
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : reportItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
               <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Movements Found</h3>
            <p className="text-slate-500 mt-1">There were no items sold in the selected date range.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reportItems.map(item => (
              <div key={item.inventoryId} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-lg">{item.productName}</h3>
                  <div className="text-sm font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                     {item.totalOut} Sold
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {item.farmers.map((farmer, idx) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 hover:bg-slate-50">
                      <span className="font-medium text-slate-700">{farmer.farmerName}</span>
                      <span className="font-bold text-slate-900">{farmer.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
};

export default StockReportPage;
