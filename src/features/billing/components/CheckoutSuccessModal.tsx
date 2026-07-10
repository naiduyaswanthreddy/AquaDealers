import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, MessageCircle, Printer, ArrowRight, Sparkles, FileText, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useBillDetails } from '../hooks/useBilling';
import { useAuthStore } from '@/stores/authStore';
import { shareBillPdfViaWhatsApp } from '@/lib/billPdfGenerator';
import { useBranchStore } from '@/stores/branchStore';
import { InvoiceTemplates } from '@/features/billing/components/templates';
import { getBillSignature } from '@/lib/utils';

interface CheckoutSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  billId: string;
  billNumber: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  farmerName: string | null;
  billDate: string;
  isOffline?: boolean;
  onStartNewBill: () => void;
}

export const CheckoutSuccessModal: React.FC<CheckoutSuccessModalProps> = ({
  isOpen,
  onClose,
  billId,
  billNumber,
  totalAmount,
  amountPaid,
  balanceDue,
  farmerName,
  billDate,
  isOffline = false,
  onStartNewBill,
}) => {
  const { t } = useTranslation();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const dealer = useAuthStore(s => s.user);
  // Offline bills only exist on this device — there is no server bill to fetch.
  const { data: bill } = useBillDetails(isOffline ? '' : billId);
  const branchId = useBranchStore(state => state.getActiveBranchId()) || dealer?.id || '';
  const templateSettings = useBranchStore(state => state.getTemplateSettings(branchId));
  const Template = InvoiceTemplates[templateSettings.invoiceTemplate as keyof typeof InvoiceTemplates] || InvoiceTemplates.template1;

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handlePrint = () => {
    window.open(`/bills/${billId}?print=true`, '_blank');
  };

  const handleShareWhatsApp = async () => {
    if (!bill) return;
    try {
      setIsSharing(true);
      await shareBillPdfViaWhatsApp(bill, dealer, bill.farmer?.phone);
    } catch (error) {
      console.error('Failed to share PDF:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} hideCloseButton title="">
      <div className="relative flex flex-col items-center text-center py-2 overflow-hidden">
        
        {/* Simple CSS Confetti using a pseudo-element pattern if needed, but a pulse/scale animation works well too */}
        <div className={`transition-all duration-700 ease-out transform ${showConfetti ? 'scale-100 opacity-100' : 'scale-90 opacity-0'} absolute inset-0 pointer-events-none flex justify-center`}>
           <div className="absolute top-10 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(46,216,163,0.15)_0%,transparent_60%)] -z-10" />
        </div>

        {/* Animated Checkmark */}
        <div className="relative mb-5 mt-2">
          <div className={`absolute inset-0 scale-[1.3] animate-pulse rounded-full blur-md ${isOffline ? 'bg-amber-100/60' : 'bg-emerald-100/50'}`} />
          <div className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-[24px] ${
            isOffline
              ? 'bg-amber-50 text-amber-500 shadow-[0_8px_24px_rgba(245,158,11,0.2)] ring-1 ring-amber-200/50'
              : 'bg-emerald-50 text-emerald-500 shadow-[0_8px_24px_rgba(16,185,129,0.2)] ring-1 ring-emerald-200/50'
          }`}>
            {isOffline ? <CloudOff className="h-9 w-9" strokeWidth={2.5} /> : <CheckCircle2 className="h-9 w-9" strokeWidth={2.5} />}
            {!isOffline && <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-amber-400 animate-bounce" />}
          </div>
        </div>

        <h2 className="text-[22px] font-black text-slate-900 tracking-tight">
          {isOffline ? t('billing.billSavedOffline', 'Saved Offline!') : t('billing.billSaved', 'Invoice Saved!')}
        </h2>
        <p className="mt-1.5 text-[13px] font-medium text-slate-500">{t('billing.billNumberIs', 'Invoice Number')} <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded ml-1">{billNumber}</span></p>

        {isOffline && (
          <div className="mt-3 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800 text-left">
            {t(
              'billing.offlineSyncNote',
              'No internet right now. This bill is safely stored on this device and will sync automatically — the final invoice number will be assigned then.'
            )}
          </div>
        )}

        {/* Receipt Overview Card */}
        <div className="mt-6 w-full rounded-[20px] border border-slate-200 bg-slate-50 p-4.5 text-[13px] text-left space-y-3.5 shadow-sm">
          <div className="flex justify-between border-b border-slate-200/80 pb-3">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">{t('billing.customer', 'Customer')}</span>
            <span className="font-bold text-slate-900">{farmerName || 'Walk-in Customer'}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">{t('billing.totalAmount', 'Total Amount')}</span>
              <span className="font-bold text-slate-800">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">{t('billing.amountPaid', 'Amount Paid')}</span>
              <span className="font-bold text-emerald-600">{formatCurrency(amountPaid)}</span>
            </div>
          </div>

          <div className="flex justify-between border-t border-slate-200 pt-3">
            {balanceDue > 0 ? (
              <>
                <span className="font-bold text-slate-800">{t('billing.balanceDue', 'Balance Due')}</span>
                <span className="font-black text-rose-500">{formatCurrency(balanceDue)}</span>
              </>
            ) : (
              <>
                <span className="font-bold text-slate-800">Status</span>
                <span className="font-black text-emerald-500 flex items-center gap-1">
                   <CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid
                </span>
              </>
            )}
          </div>
        </div>

        {/* Links & Quick Actions — need the synced server bill, so hidden for offline saves */}
        {!isOffline && (
          <>
            <div className="w-full mt-4 flex items-center justify-between px-2">
               <Link to={`/bills/${billId}`} className="text-[13px] font-bold text-primary hover:text-[#2a8dcb] flex items-center gap-1 group">
                 <FileText className="w-4 h-4" /> View Details <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
               </Link>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                leftIcon={<Printer className="h-4 w-4" />}
                onClick={handlePrint}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                fullWidth
              >
                {t('billing.printInvoice', 'Print')}
              </Button>
              <Button
                type="button"
                variant="outline"
                leftIcon={<MessageCircle className="h-4 w-4" />}
                className="border-[#25D366]/30 bg-[#25D366]/5 text-[#1DA851] hover:bg-[#25D366]/10"
                onClick={handleShareWhatsApp}
                loading={isSharing}
                fullWidth
              >
                WhatsApp
              </Button>
            </div>
          </>
        )}

        {/* Primary Checkout Finish Button */}
        <div className="mt-4 w-full">
          <Button
            type="button"
            variant="primary"
            rightIcon={<ArrowRight className="h-4 w-4" />}
            onClick={onStartNewBill}
            className="h-[46px] text-[15px] font-bold shadow-[0_4px_14px_rgba(20,103,159,0.25)]"
            fullWidth
          >
            {t('billing.startNewBill', 'Start New Bill')}
          </Button>
        </div>
      </div>
      
      {/* Hidden template for PDF generation */}
      {bill && dealer && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
           <div id="print-content-wrapper" className="bg-white" style={{ width: '794px', minHeight: '1123px' }}>
             <Template 
               bill={bill} 
               dealer={dealer} 
               settings={templateSettings} 
               type="invoice" 
               billSignature={getBillSignature(bill)} 
             />
           </div>
        </div>
      )}
    </Modal>
  );
};
