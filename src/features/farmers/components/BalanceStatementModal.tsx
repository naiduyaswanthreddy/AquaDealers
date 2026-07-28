import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Eye, MessageCircle, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { DatePicker } from '@/components/ui/DatePicker';
import { useFarmerStatement } from '../hooks/useFarmerLedger';
import { formatCurrency } from '@/lib/utils';
import { generateFarmerStatementPdfBlob, shareFarmerStatementViaWhatsApp, downloadFarmerStatementPdf } from '../utils/farmerStatementPdf';
import { useAuthStore } from '@/stores/authStore';

interface BalanceStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
}

const BalanceStatementModal: React.FC<BalanceStatementModalProps> = ({
  isOpen,
  onClose,
  farmerId
}) => {
  const { t } = useTranslation();
  const dealer = useAuthStore(s => s.user);
  
  // Default to last 30 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { data: statement, isLoading } = useFarmerStatement(farmerId, startDate, endDate);
  const [isExporting, setIsExporting] = useState(false);

  const handlePreview = async () => {
    if (!statement) return;
    const previewWindow = window.open('', '_blank');
    try {
      setIsExporting(true);
      const blob = await generateFarmerStatementPdfBlob(statement, dealer, startDate, endDate);
      const url = URL.createObjectURL(blob);
      if (previewWindow) previewWindow.location.href = url;
      else window.open(url, '_blank');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow?.close();
      console.error('Failed to preview statement:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!statement) return;
    try {
      setIsExporting(true);
      await downloadFarmerStatementPdf(statement, dealer, startDate, endDate);
    } catch (error) {
      console.error('Failed to download statement:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!statement) return;
    try {
      setIsExporting(true);
      await shareFarmerStatementViaWhatsApp(statement, dealer, startDate, endDate);
    } catch (error) {
      console.error('Failed to share statement:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Balance Statement"
      footerButtons={statement ? [
        { label: 'Preview', variant: 'outline', onClick: handlePreview, loading: isExporting },
        { label: 'Download PDF', variant: 'outline', onClick: handleDownload, loading: isExporting },
        { label: 'Share via WhatsApp', variant: 'primary', onClick: handleShare, loading: isExporting },
      ] : undefined}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">From Date</label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="From Date"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">To Date</label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="To Date"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : statement ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <span className="text-sm text-slate-500">Opening Balance</span>
                <p className="text-lg font-bold mt-1">{formatCurrency(statement.openingBalance)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <span className="text-sm text-slate-500">Closing Balance</span>
                <p className="text-lg font-bold text-primary mt-1">{formatCurrency(statement.closingBalance)}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <span className="text-sm text-red-600">Total Debits (Bills)</span>
                <p className="text-lg font-bold text-red-700 mt-1">{formatCurrency(statement.totalDebit)}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <span className="text-sm text-emerald-600">Total Credits (Paid)</span>
                <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(statement.totalCredit)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <span className="text-sm text-amber-700">Returned Value</span>
                <p className="text-lg font-bold text-amber-800 mt-1">{formatCurrency(statement.totalReturns || 0)}</p>
                <p className="mt-1 text-xs text-amber-700">Returned items reduce the balance separately from payments.</p>
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            Failed to load statement data.
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BalanceStatementModal;
