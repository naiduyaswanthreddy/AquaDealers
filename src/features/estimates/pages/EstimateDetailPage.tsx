import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, FileText } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import { useEstimateDetail } from '../hooks/useEstimate';
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

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Estimate" onBack={() => navigate('/estimates')} />
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
      </PageShell>
    );
  }

  if (!estimate) {
    return (
      <PageShell>
        <PageHeader title="Estimate" onBack={() => navigate('/estimates')} />
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
          Estimate not found.
        </div>
      </PageShell>
    );
  }

  // Shape estimate into the bill-like object the templates expect
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
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePrint}
            className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
            style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
          >
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        }
      />

      {/* Estimate banner */}
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 print:hidden">
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

      {/* Invoice template */}
      <div className="flex justify-start md:justify-center overflow-x-auto bg-slate-100 rounded-xl mb-12 w-full mt-4 print:overflow-visible print:bg-white print:m-0 print:rounded-none">
        <MobileZoomableContainer>
          <div className="bg-white shadow-lg overflow-hidden shrink-0 mx-auto bill-print-frame-inner" style={{ width: '794px', minHeight: '1123px' }}>
            <Template bill={billData} dealer={dealer} settings={templateSettings} type="bill" />
          </div>
        </MobileZoomableContainer>
      </div>
    </PageShell>
  );
};

export default EstimateDetailPage;
