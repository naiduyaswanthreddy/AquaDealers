import React, { useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Printer, MessageCircle, CheckCircle2, Undo2, KeyRound, Copy, Check, Tag } from 'lucide-react';
import { useBillDetails } from '../hooks/useBilling';
import { formatCurrency, formatDate, formatDateTime, getBillSignature } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui';
import SignatureRenderer from '../components/SignatureRenderer';
import { SignatureStroke } from '@/types/database';
import { downloadBillPdf, shareInvoiceImageViaWhatsApp } from '@/lib/billPdfGenerator';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useBranchStore } from '@/stores/branchStore';
import { InvoiceTemplates } from '@/features/billing/components/templates';
import { MobileZoomableContainer } from '@/features/billing/components/MobileZoomableContainer';
import { EditBillModal } from '../components/EditBillModal';
import { EditBillConfirmationModal } from '../components/EditBillConfirmationModal';
import { useBillReturns } from '../hooks/useBillReturns';
import { BillAuditHistory } from '../components/BillAuditHistory';
import { PlanGate } from '@/components/auth/PlanGate';
import { Edit } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { billingKeys } from '../hooks/useBilling';
import { toast } from 'sonner';
import { billingService } from '../services/billingService';
import { openWhatsAppText } from '@/lib/whatsAppService';
import { deliveryPinMessage } from '@/lib/whatsAppMessages';

const BillDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { data: bill, isLoading, error } = useBillDetails(id || '');
  const dealer = useAuthStore(s => s.user);
  const { getActiveBranchId, getTemplateSettings } = useBranchStore();
  const queryClient = useQueryClient();

  // Use the hook selector (not .getState()) so this re-renders when the plan loads async
  const hasFeature = useSubscriptionStore(s => s.hasFeature);
  const hasProPlus = dealer?.plan === 'pro_plus' || hasFeature('custom_templates');
  const branchId = getActiveBranchId() || 'default';
  const templateSettings = getTemplateSettings(branchId);
  const Template = InvoiceTemplates[templateSettings.invoiceTemplate] || InvoiceTemplates.template1;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<any[]>([]);
  const [pendingBillDate, setPendingBillDate] = useState<string>('');
  const [pendingPayment, setPendingPayment] = useState<{ amount_paid: number; payment_type: string | null } | undefined>();
  
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyPin, setVerifyPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementReason, setSettlementReason] = useState('');
  const [isApplyingSettlement, setIsApplyingSettlement] = useState(false);
  const [billNumberCopied, setBillNumberCopied] = useState(false);
  const { data: existingReturns = [] } = useBillReturns(id);

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
    if (bill && shouldEdit && bill.type !== 'adjustment') {
      setIsEditModalOpen(true);
      // Remove query param
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [bill, shouldEdit]);

  const handleDownloadPDF = async () => {
    if (!bill) return;
    try {
      setIsGenerating(true);
      await downloadBillPdf(bill, dealer);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    if (!bill) return;
    const phone = bill.farmer_phone_snapshot || (bill as any).farmers?.phone;
    if (!phone) {
      toast.error(
        `${bill.farmer_name_snapshot || 'This farmer'} doesn't have a phone number. Add one in their profile first.`,
        { duration: 5000 }
      );
      return;
    }
    try {
      setIsSharing(true);
      await shareInvoiceImageViaWhatsApp(bill, dealer, 'print-content', phone);
    } catch (err) {
      console.error('Failed to share invoice', err);
      toast.error('Failed to generate invoice image. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleVerifySubmit = async () => {
    if (!bill || !dealer?.id) return;
    if (verifyPin.length !== 4) {
      toast.error('Please enter a 4-digit PIN');
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await billingService.verifyDeliveryPin(bill.id, dealer.id, verifyPin);
      if (isValid) {
        toast.success('Bill verified successfully!');
        queryClient.invalidateQueries({ queryKey: billingKeys.detail(bill.id) });
        queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
        setIsVerifyModalOpen(false);
        setVerifyPin('');
      } else {
        toast.error('Invalid PIN. Please try again.');
      }
    } catch (err) {
      toast.error('Failed to verify bill');
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleApplySettlement = async () => {
    if (!bill || !dealer?.id) return;
    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid discount amount');
      return;
    }
    if (amount > bill.total) {
      toast.error('Settlement discount cannot exceed bill total');
      return;
    }
    setIsApplyingSettlement(true);
    try {
      await billingService.applySettlementDiscount({
        dealer_id: dealer.id,
        bill_id: bill.id,
        amount,
        reason: settlementReason || null,
      });
      toast.success('Settlement discount applied');
      queryClient.invalidateQueries({ queryKey: billingKeys.detail(bill.id) });
      queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      queryClient.invalidateQueries({ queryKey: ['farmer'] });
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      setIsSettlementModalOpen(false);
      setSettlementAmount('');
      setSettlementReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply settlement discount');
    } finally {
      setIsApplyingSettlement(false);
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

  const handleCopyBillNumber = () => {
    navigator.clipboard.writeText(bill.bill_number).then(() => {
      setBillNumberCopied(true);
      setTimeout(() => setBillNumberCopied(false), 2000);
    });
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow={t('billing.invoiceDetails', 'Invoice Details')}
        title={bill.bill_number}
        description={
          (bill as any).branch_name_snapshot ? (
            <span className="inline-flex items-center rounded bg-sky-100 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-sky-800 ring-1 ring-sky-300">
              Branch · {(bill as any).branch_name_snapshot}
            </span>
          ) : undefined
        }
        onBack={() => navigate(backTo)}
        action={
          <div className="flex flex-wrap justify-start xl:justify-end gap-2.5">
            {bill.is_verified === false && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => setIsVerifyModalOpen(true)}
                className="rounded-[24px] bg-amber-500 hover:bg-amber-600 text-white font-bold border-none shadow-amber-500/20 px-5 sm:px-6"
              >
                Verify Delivery
              </Button>
            )}
            {bill.status !== 'cancelled' && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Undo2 className="w-4 h-4" />}
                onClick={() => navigate('/returns', {
                  state: {
                    returnContext: {
                      farmer: bill.farmers,
                      billDate: bill.bill_date,
                      items: (bill.bill_items || []).map((item: any) => ({
                        product_id: item.product_id,
                        name: item.product_name_snapshot || 'Item',
                        quantity: item.quantity,
                        unmatched_unit_price: item.unit_price,
                      })),
                    },
                  },
                })}
              >
                Return
              </Button>
            )}
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
              loading={isSharing}
              disabled={isSharing}
              className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
              style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
            >
              {isSharing ? 'Generating…' : 'Share on WhatsApp'}
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
            {bill.type !== 'adjustment' && !hasProPlus && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Edit className="w-4 h-4 text-white" />}
                  onClick={() => toast.info('Editing bills is a Pro+ feature. Upgrade your plan to enable it.')}
                  className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
                  style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
                >
                  Edit Bill
                </Button>
            )}
            {bill.status !== 'cancelled' && bill.type !== 'adjustment' && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Tag className="w-4 h-4 text-white" />}
                onClick={() => {
                  setSettlementAmount(String(bill.settlement_discount_amount > 0 ? bill.settlement_discount_amount : ''));
                  setSettlementReason(bill.settlement_discount_reason || '');
                  setIsSettlementModalOpen(true);
                }}
                className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
                style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
              >
                Settlement Discount
              </Button>
            )}
          </div>
        }
      />

      {bill.is_verified === false && (
        <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-amber-800">
                <KeyRound className="w-3.5 h-3.5" /> Waiting for delivery verification
              </div>
              <p className="mt-1 text-[13px] font-semibold text-slate-700">
                Ask the farmer for the 4-digit delivery PIN they see on their share-balance link,
                then enter it here to mark this bill verified.
              </p>
            </div>
            <Button type="button" variant="primary" size="sm" leftIcon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setIsVerifyModalOpen(true)}>
              Enter PIN to verify
            </Button>
          </div>
        </div>
      )}

      {hasProPlus ? (
        <div className="flex justify-start md:justify-center overflow-x-auto bg-slate-100 rounded-xl mb-12 w-full print:overflow-visible print:bg-white print:m-0 print:rounded-none">
          <MobileZoomableContainer>
            <div className="bg-white shadow-lg overflow-hidden shrink-0 mx-auto bill-print-frame-inner" style={{ width: '794px', minHeight: '1123px' }}>
              <Template bill={bill} dealer={dealer} settings={templateSettings} type="bill" billSignature={billSignature} />
            </div>
          </MobileZoomableContainer>

          <div className="max-w-4xl mx-auto w-full px-6 print:hidden">
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

            {bill.settlement_discount_amount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Settlement Discount</span>
                <span>-{formatCurrency(bill.settlement_discount_amount)}</span>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
              <span>{bill.settlement_discount_amount > 0 ? 'Bill Total (before discount)' : t('billing.total')}</span>
              <span className="text-blue-700">{formatCurrency(bill.total)}</span>
            </div>

            {bill.settlement_discount_amount > 0 && (
              <div className="flex justify-between text-base font-bold">
                <span className="text-gray-700">Effective Total</span>
                <span className="text-blue-700">{formatCurrency(bill.total - bill.settlement_discount_amount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm pt-2">
              <span className="text-gray-500">{t('billing.amountPaid')}</span>
              <div className="flex items-center gap-2">
                {bill.payment_type && (
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{bill.payment_type}</span>
                )}
                <span className="font-medium text-green-600">{formatCurrency(bill.amount_paid)}</span>
              </div>
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
              <SignatureRenderer strokes={billSignature.signature_data} className="h-24 w-full" captureWidth={billSignature.canvas_width} captureHeight={billSignature.canvas_height} />
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

      {/* Modals */}
      {bill.type !== 'adjustment' && hasProPlus && (
        <>
          <EditBillModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            bill={bill as any}
            items={bill.bill_items as any}
            onConfirm={(edits, billDate, payment) => {
              setPendingEdits(edits);
              setPendingBillDate(billDate);
              setPendingPayment(payment);
              setIsEditModalOpen(false);
              setIsConfirmModalOpen(true);
            }}
          />
          <EditBillConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            bill={bill as any}
            edits={pendingEdits}
            billDate={pendingBillDate}
            payment={pendingPayment}
            onSuccess={() => {
              setIsConfirmModalOpen(false);
              queryClient.invalidateQueries({ queryKey: billingKeys.detail(id || '') });
              queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
              queryClient.invalidateQueries({ queryKey: ['inventory'] });
              queryClient.invalidateQueries({ queryKey: ['farmers'] });
              queryClient.invalidateQueries({ queryKey: ['farmer'] });
              queryClient.invalidateQueries({ queryKey: ['financials'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['farmer-items'] });
              queryClient.invalidateQueries({ queryKey: ['reports'] });
            }}
          />
        </>
      )}

      {existingReturns.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-600">
            <Undo2 className="w-4 h-4" /> Returns on this bill
          </div>
          <div className="space-y-2">
            {existingReturns.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <div className="font-bold text-slate-800">
                    {r.return_number}
                    {r.branch_name && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-600 uppercase tracking-wider">{r.branch_name}</span>}
                  </div>
                  <div className="text-emerald-700 font-bold tabular-nums">− {formatCurrency(Number(r.total_amount))}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatDate(r.return_date)}{r.notes ? ` · ${r.notes}` : ''}</div>
                <ul className="mt-1 text-xs text-slate-600">
                  {r.items.map((it: any) => (
                    <li key={it.id}>• {it.product_name || 'item'} × {Number(it.quantity)} = {formatCurrency(Number(it.total_price))}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settlement Discount Modal */}
      <Modal
        isOpen={isSettlementModalOpen}
        onClose={() => {
          setIsSettlementModalOpen(false);
          setSettlementAmount('');
          setSettlementReason('');
        }}
        title="Apply Settlement Discount"
      >
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">
            Enter the amount the farmer is paying less than the bill total. The bill total stays unchanged — this discount reduces the effective amount owed.
          </p>
          {bill && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Bill Total</span>
                <span>{formatCurrency(bill.total)}</span>
              </div>
              {parseFloat(settlementAmount) > 0 && (
                <div className="flex justify-between font-bold text-emerald-600">
                  <span>Settlement Discount</span>
                  <span>-{formatCurrency(parseFloat(settlementAmount) || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>Effective Total</span>
                <span>{formatCurrency(Math.max(0, bill.total - (parseFloat(settlementAmount) || 0)))}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Discount Amount</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</div>
              <input
                type="number"
                min="0"
                max={bill?.total}
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                placeholder="0.00"
                className="pl-9 w-full rounded-xl border border-slate-300 py-3 text-lg font-black shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Reason <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              type="text"
              value={settlementReason}
              onChange={(e) => setSettlementReason(e.target.value)}
              placeholder="e.g. Negotiated settlement, rounding"
              className="w-full rounded-xl border border-slate-300 py-2.5 px-4 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsSettlementModalOpen(false);
                setSettlementAmount('');
                setSettlementReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleApplySettlement}
              loading={isApplyingSettlement}
              disabled={!settlementAmount || parseFloat(settlementAmount) < 0}
            >
              Apply Discount
            </Button>
          </div>
        </div>
      </Modal>

      {/* Verify Delivery PIN Modal */}
      <Modal
        isOpen={isVerifyModalOpen}
        onClose={() => {
          setIsVerifyModalOpen(false);
          setVerifyPin('');
        }}
        title="Verify Delivery"
      >
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-6">
            Ask the farmer or driver for the 4-digit Delivery PIN. Entering it here will permanently mark this bill as delivered and verified.
          </p>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Delivery PIN</label>
            <input
              type="text"
              maxLength={4}
              value={verifyPin}
              onChange={(e) => setVerifyPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 1234"
              className="text-center text-3xl font-black tracking-[0.25em] w-full rounded-xl border-slate-300 py-4 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="mt-8 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsVerifyModalOpen(false);
                setVerifyPin('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 bg-amber-500 hover:bg-amber-600 border-none"
              onClick={handleVerifySubmit}
              loading={isVerifying}
              disabled={verifyPin.length !== 4}
            >
              Verify Now
            </Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
};

const DeliveryPinBanner: React.FC<{
  pin: string;
  farmerPhone?: string | null;
  farmerName?: string | null;
  shopName?: string | null;
  onVerifyClick: () => void;
}> = ({ pin, farmerPhone, farmerName, shopName, onVerifyClick }) => {
  const [copied, setCopied] = React.useState(false);
  const digits = String(pin).split('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(pin); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success('PIN copied'); }
    catch { toast.error('Copy failed'); }
  };
  const whatsApp = () => {
    const msg = deliveryPinMessage(farmerName ?? null, pin, shopName || 'our shop');
    openWhatsAppText(farmerPhone ?? null, msg);
  };
  return (
    <div className="mb-6 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-blue-800">
            <KeyRound className="w-3.5 h-3.5" /> Delivery PIN — bill is <span className="text-amber-700">not verified yet</span>
          </div>
          <p className="mt-1 text-[12px] font-semibold text-slate-600">
            Share this PIN with the driver / farmer. When the goods are delivered, enter it here to mark the bill verified.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              {digits.map((d, i) => (
                <div key={i} className="flex h-10 w-9 items-center justify-center rounded-lg bg-white text-xl font-black text-blue-900 shadow-inner ring-2 ring-blue-200 tabular-nums">{d}</div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={copy} leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={whatsApp} leftIcon={<MessageCircle className="w-4 h-4" />} className="border-[#25D366]/30 text-[#1DA851] hover:bg-[#25D366]/10">
              WhatsApp PIN
            </Button>
          </div>
        </div>
        <Button type="button" variant="primary" size="sm" leftIcon={<CheckCircle2 className="w-4 h-4" />} onClick={onVerifyClick}>
          Enter PIN to verify
        </Button>
      </div>
    </div>
  );
};

export default BillDetailsPage;
