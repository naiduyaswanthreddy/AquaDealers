import React, { useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Printer, MessageCircle } from 'lucide-react';
import { useBillDetails } from '../hooks/useBilling';
import { formatCurrency, formatDate, formatDateTime, getBillSignature } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import SignatureRenderer from '../components/SignatureRenderer';
import { SignatureStroke } from '@/types/database';
import { downloadBillPdf, shareBillPdfViaWhatsApp } from '@/lib/billPdfGenerator';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useBranchStore } from '@/stores/branchStore';
import { InvoiceTemplates } from '@/features/billing/components/templates';
import { MobileZoomableContainer } from '@/features/billing/components/MobileZoomableContainer';
import { EditBillModal } from '../components/EditBillModal';
import { EditBillConfirmationModal } from '../components/EditBillConfirmationModal';
import { BillAuditHistory } from '../components/BillAuditHistory';
import { PlanGate } from '@/components/auth/PlanGate';
import { Edit } from 'lucide-react';



const BillDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { data: bill, isLoading, error } = useBillDetails(id || '');
  const dealer = useAuthStore(s => s.user);
  const { getActiveBranchId, getTemplateSettings } = useBranchStore();
  
  const hasProPlus = dealer?.plan === 'pro_plus' || useSubscriptionStore.getState().hasFeature('custom_templates');
  const branchId = getActiveBranchId() || 'default';
  const templateSettings = getTemplateSettings(branchId);
  const Template = InvoiceTemplates[templateSettings.invoiceTemplate] || InvoiceTemplates.template1;

  const [isGenerating, setIsGenerating] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<any[]>([]);
  
  const backTo = typeof location.state?.from === 'string' ? location.state.from : '/bills';

  const queryParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const shouldPrint = queryParams.get('print') === 'true';

  React.useEffect(() => {
    if (bill && shouldPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [bill, shouldPrint]);

  const shouldEdit = queryParams.get('edit') === 'true';
  React.useEffect(() => {
    if (bill && shouldEdit && bill.type !== 'adjustment' && hasProPlus) {
      setIsEditModalOpen(true);
      // Remove query param
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [bill, shouldEdit, hasProPlus]);

  const handleDownloadPDF = async () => {
    if (!bill) return;
    try {
      setIsGenerating(true);
      await downloadBillPdf(bill, dealer);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    if (!bill) return;
    try {
      setIsGenerating(true);
      await shareBillPdfViaWhatsApp(bill, dealer, bill.farmer?.phone);
    } catch (err) {
      console.error('Failed to share PDF', err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl">
        <p>{t('common.error')}</p>
        <Button onClick={() => navigate(backTo)} className="mt-4">
          {t('common.back', 'Go Back')}
        </Button>
      </div>
    );
  }

  const billSignature = getBillSignature(bill);

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow={t('billing.invoiceDetails', 'Invoice Details')}
        title={bill.bill_number}
        onBack={() => navigate(backTo)}
        action={
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Printer className="w-4 h-4 text-white" />}
              onClick={handlePrint}
              className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
              style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
            >
              {t('billing.printInvoice', 'Print Invoice')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<MessageCircle className="w-4 h-4 text-white" />}
              onClick={handleShareWhatsApp}
              className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
              style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
            >
              Share WhatsApp
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              leftIcon={<Download className="w-4 h-4 text-white" />}
              onClick={handleDownloadPDF}
              loading={isGenerating}
              className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
              style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
            >
              {t('billing.downloadInvoice')}
            </Button>
            {bill.type !== 'adjustment' && hasProPlus && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Edit className="w-4 h-4 text-white" />}
                  onClick={() => setIsEditModalOpen(true)}
                  className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
                  style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
                >
                  Edit Bill
                </Button>
            )}
          </div>
        }
      />

      {hasProPlus ? (
        <div className="flex justify-start md:justify-center overflow-x-auto bg-slate-100 rounded-xl mb-12 w-full">
          <MobileZoomableContainer>
            <div className="bg-white shadow-lg overflow-hidden shrink-0 mx-auto" style={{ width: '794px', minHeight: '1123px' }}>
              <Template bill={bill} dealer={dealer} settings={templateSettings} type="bill" billSignature={billSignature} />
            </div>
          </MobileZoomableContainer>
          
          <div className="max-w-4xl mx-auto w-full px-6">
            {(bill as any).is_edited && (
              <BillAuditHistory billId={bill.id} />
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="border-b border-gray-100 pb-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {bill.type === 'adjustment' ? 'RATE ADJUSTMENT' : t('billing.invoice', 'INVOICE')}
              </h1>
              <p className="text-gray-500 mt-1">{bill.bill_number}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm text-gray-500 mb-1">{t('billing.date')}</p>
              <p className="font-bold text-gray-900">{formatDateTime(bill.created_at)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-sm text-gray-500 mb-2">{t('billing.billedTo')}</p>
            <h3 className="font-bold text-gray-900 text-lg">
              {bill.farmer_name_snapshot || t('billing.walkInCustomer', 'Walk-in Customer')}
            </h3>
            {bill.farmer_gstin && (
              <p className="text-sm text-gray-600 mt-1">GSTIN: {bill.farmer_gstin}</p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-3 px-4 font-bold text-gray-900 text-sm uppercase">{t('billing.item')}</th>
                <th className="py-3 px-4 font-bold text-gray-900 text-sm uppercase text-right">HSN</th>
                <th className="py-3 px-4 font-bold text-gray-900 text-sm uppercase text-right">{t('billing.qty')}</th>
                <th className="py-3 px-4 font-bold text-gray-900 text-sm uppercase text-right">MRP</th>
                <th className="py-3 px-4 font-bold text-gray-900 text-sm uppercase text-right">{t('billing.rate')}</th>
                <th className="py-3 px-4 font-bold text-gray-900 text-sm uppercase text-right">GST %</th>
                <th className="py-3 px-4 font-bold text-gray-900 text-sm uppercase text-right">{t('billing.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bill.bill_items?.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{item.product_name_snapshot}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 text-right">{item.hsn_code_snapshot || '-'}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{item.quantity}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 text-right">{item.mrp ? formatCurrency(item.mrp) : '-'}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 text-right">{item.gst_rate}%</td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full sm:w-1/2 lg:w-1/3 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('billing.subtotal')}</span>
              <span className="font-medium">{formatCurrency(bill.subtotal)}</span>
            </div>
            
            {bill.cgst_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">CGST</span>
                <span className="font-medium">{formatCurrency(bill.cgst_amount)}</span>
              </div>
            )}
            
            {bill.sgst_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">SGST</span>
                <span className="font-medium">{formatCurrency(bill.sgst_amount)}</span>
              </div>
            )}

            {bill.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>{t('billing.discount')}</span>
                <span>-{formatCurrency(bill.discount_amount)}</span>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
              <span>{t('billing.total')}</span>
              <span className="text-blue-700">{formatCurrency(bill.total)}</span>
            </div>

            <div className="flex justify-between text-sm pt-2">
              <span className="text-gray-500">{t('billing.amountPaid')}</span>
              <span className="font-medium text-green-600">{formatCurrency(bill.amount_paid)}</span>
            </div>

            {bill.balance_due > 0 && (
              <div className="flex justify-between text-sm pt-1">
                <span className="text-gray-500">{t('billing.balanceDue')}</span>
                <span className="font-bold text-red-600">{formatCurrency(bill.balance_due)}</span>
              </div>
            )}
          </div>
        </div>

        {billSignature?.signature_data?.length ? (
          <div className="mt-8 grid gap-3 border-t border-gray-100 pt-6 sm:max-w-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Customer Signature</p>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <SignatureRenderer strokes={billSignature.signature_data} className="h-24 w-full" />
            </div>
            <p className="text-xs font-medium text-gray-500">
              Signed by {billSignature.signer_name || bill.farmer_name_snapshot || 'Customer'}
            </p>
          </div>
        ) : null}
        
        {(bill as any).is_edited && (
          <BillAuditHistory billId={bill.id} />
        )}
      </div>
      )}

      {isEditModalOpen && bill && bill.bill_items && (
        <EditBillModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          bill={bill as any}
          items={bill.bill_items as any}
          onConfirm={(edits) => {
            setPendingEdits(edits);
            setIsEditModalOpen(false);
            setIsConfirmModalOpen(true);
          }}
        />
      )}

      {isConfirmModalOpen && bill && (
        <EditBillConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          bill={bill as any}
          edits={pendingEdits}
          onSuccess={() => {
            setIsConfirmModalOpen(false);
            window.location.reload();
          }}
        />
      )}
    </PageShell>
  );
};

export default BillDetailsPage;
