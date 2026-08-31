import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, FileText, Share2, Download, MessageCircle, X, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { generateBillPdfBlob } from '@/lib/billPdfGenerator';
import { sharePdfViaWhatsApp } from '@/lib/whatsAppService';
import { useEstimateDetail } from '../hooks/useEstimate';
import { useEstimateCartStore } from '../stores/estimateCartStore';
import type { EstimateCartItem } from '../types';
import { InvoiceTemplates } from '@/features/billing/components/templates';
import { MobileZoomableContainer } from '@/features/billing/components/MobileZoomableContainer';

export const EstimateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dealer = useAuthStore(s => s.user);
  const { getActiveBranchId, getTemplateSettings } = useBranchStore();

  const branchId = getActiveBranchId() || 'default';
  const templateSettings = getTemplateSettings(branchId);
  const Template = InvoiceTemplates[templateSettings.invoiceTemplate] || InvoiceTemplates.template1;

  const { data: estimate, isLoading } = useEstimateDetail(dealer?.id ?? '', id ?? '');
  const loadEstimateForEditing = useEstimateCartStore(s => s.loadEstimateForEditing);

  const [showShare, setShowShare] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const handleEdit = () => {
    if (!estimate) return;
    const cartItems: EstimateCartItem[] = estimate.items.map(item => {
      const base = item.discount_percentage > 0 && item.discount_percentage < 100
        ? Number((item.unit_price / (1 - item.discount_percentage / 100)).toFixed(2))
        : item.unit_price;
      return {
        product_id:          item.product_id ?? item.id,
        product_name:        item.product_name,
        hsn_code:            item.hsn_code,
        product_type:        'product',
        unit:                '',
        quantity:            item.quantity,
        base_unit_price:     base,
        unit_price:          item.unit_price,
        discount_percentage: item.discount_percentage,
        gst_rate:            item.gst_rate,
      };
    });
    loadEstimateForEditing({
      estimateId:     estimate.id,
      farmerId:       estimate.farmer_id,
      farmerName:     estimate.farmer_name_snapshot ?? '',
      items:          cartItems,
      discountAmount: estimate.discount_amount,
      gstEnabled:     estimate.gst_amount > 0,
      notes:          estimate.notes ?? '',
      estimateDate:   estimate.estimate_date,
    });
    navigate('/estimates/new');
  };

  const handlePrint = () => window.print();

  const getPdfBlob = async (): Promise<Blob | null> => {
    try {
      setIsGenerating(true);
      return await generateBillPdfBlob(estimate, dealer);
    } catch (err) {
      toast.error('Failed to generate PDF. Please try again.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    setShowShare(false);
    const blob = await getPdfBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estimate_${estimate?.estimate_number ?? 'EST'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('PDF downloaded.');
  };

  const handleWhatsApp = async () => {
    setShowShare(false);
    let farmerPhone: string | null = null;
    if (estimate?.farmer_id) {
      const { data } = await supabase
        .from('farmers')
        .select('phone')
        .eq('id', estimate.farmer_id)
        .single();
      farmerPhone = data?.phone ?? null;
    }

    const blob = await getPdfBlob();
    if (!blob) return;

    const fallback = `*Estimate ${estimate?.estimate_number}*\nFarmer: ${estimate?.farmer_name_snapshot}\nTotal: ₹${estimate?.total}`;
    await sharePdfViaWhatsApp(blob, `Estimate_${estimate?.estimate_number}.pdf`, fallback, farmerPhone);
  };

  /* ── Loading state ──────────────────────────────────────── */
  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Estimate" onBack={() => navigate('/estimates')} />
        <div className="flex flex-col gap-4">
          {/* Banner skeleton */}
          <div className="rounded-2xl border border-border bg-amber-50/60 px-4 py-3 flex items-center gap-3">
            <Skeleton variant="circle" width={36} height={36} className="flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="30%" height={13} />
              <Skeleton variant="text" width="55%" height={11} />
            </div>
          </div>
          {/* Invoice preview skeleton */}
          <div className="rounded-2xl overflow-hidden border border-border">
            <Skeleton variant="rect" width="100%" height={560} className="rounded-2xl" />
          </div>
        </div>
      </PageShell>
    );
  }

  /* ── Not found state ────────────────────────────────────── */
  if (!estimate) {
    return (
      <PageShell>
        <PageHeader title="Estimate" onBack={() => navigate('/estimates')} />
        <div className="section-card flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #fee2e2, #fecaca)' }}
          >
            <AlertTriangle className="h-8 w-8 text-danger" />
          </div>
          <div>
            <p className="font-bold text-text-primary text-base">Estimate not found</p>
            <p className="text-sm text-text-muted mt-1">
              This estimate may have been deleted or you don't have access.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/estimates')}
            className="text-sm font-bold text-primary hover:underline underline-offset-2"
          >
            Back to Estimates
          </button>
        </div>
      </PageShell>
    );
  }

  const billData = {
    bill_number: estimate.estimate_number,
    bill_date: estimate.estimate_date,
    farmer_name_snapshot: estimate.farmer_name_snapshot,
    branch_name_snapshot: estimate.branch_name_snapshot,
    is_estimate: true,
    subtotal: estimate.subtotal,
    discount_amount: estimate.discount_amount,
    cgst_amount: estimate.gst_amount / 2,
    sgst_amount: estimate.gst_amount / 2,
    total: estimate.total,
    amount_paid: 0,
    balance_due: 0,
    payment_type: null,
    notes: estimate.notes,
    bill_items: estimate.items.map(item => ({
      id: item.id,
      product_name_snapshot: item.product_name,
      hsn_code_snapshot: item.hsn_code,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percentage: item.discount_percentage,
      gst_rate: item.gst_rate,
      total_price: item.total_price,
      mrp: null,
      unit: null,
    })),
  };

  return (
    <PageShell width="wide">
      <PageHeader
        title={estimate.estimate_number}
        onBack={() => navigate('/estimates')}
        action={
          <div className="flex items-center gap-2 print:hidden">
            {/* Edit button */}
            <button
              type="button"
              onClick={handleEdit}
              className="flex items-center gap-1.5 rounded-[24px] px-4 py-2 text-xs font-semibold text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)' }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>

            {/* Download button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex items-center gap-1.5 rounded-[24px] px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)' }}
            >
              {isGenerating ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download
            </button>

            {/* Share button + dropdown */}
            <div className="relative" ref={shareRef}>
              <button
                type="button"
                onClick={() => setShowShare(v => !v)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 rounded-[24px] px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)' }}
              >
                {isGenerating ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                {isGenerating ? 'Generating…' : 'Share'}
              </button>

              {showShare && (
                <>
                  {/* backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowShare(false)} />
                  {/* dropdown */}
                  <div
                    className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl bg-white border border-border overflow-hidden"
                    style={{ boxShadow: '0 12px 28px rgba(20,54,84,0.15)' }}
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                      <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Share as</p>
                      <button onClick={() => setShowShare(false)} className="text-text-muted hover:text-text-primary">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface">
                        <Download className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Download PDF</p>
                        <p className="text-[0.68rem] text-text-muted">Save to device</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleWhatsApp}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors border-t border-border/50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Share on WhatsApp</p>
                        <p className="text-[0.68rem] text-text-muted">Download + open farmer chat</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setShowShare(false); handlePrint(); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors border-t border-border/50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
                        <Printer className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Print</p>
                        <p className="text-[0.68rem] text-text-muted">Open print dialog</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {/* Estimate banner */}
      <div className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 print:hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <FileText className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <div className="text-sm font-black text-amber-800">This is an Estimate</div>
          <div className="text-xs font-medium text-amber-700">
            No stock was deducted · No dues were added to this farmer
          </div>
        </div>
      </div>

      {/* Invoice template — id required for PDF generation */}
      <div className="flex justify-start md:justify-center overflow-x-auto bg-slate-100 rounded-xl mb-12 w-full print:overflow-visible print:bg-white print:m-0 print:rounded-none">
        <MobileZoomableContainer>
          <div
            id="print-content"
            className="bg-white shadow-lg overflow-hidden shrink-0 mx-auto bill-print-frame-inner"
            style={{ width: '794px', minHeight: '1123px' }}
          >
            <Template bill={billData} dealer={dealer} settings={templateSettings} type="bill" />
          </div>
        </MobileZoomableContainer>
      </div>
    </PageShell>
  );
};

export default EstimateDetailPage;
