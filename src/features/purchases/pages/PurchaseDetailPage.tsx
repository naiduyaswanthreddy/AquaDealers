import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarRange,
  CircleDollarSign,
  PackageCheck,
  ReceiptText,
  Truck,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, EmptyState, Skeleton } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { purchaseService } from '../services/purchaseService';

const PurchaseDetailPage: React.FC = () => {
  const { purchaseId = '' } = useParams<{ purchaseId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const backTo = typeof location.state?.from === 'string' ? location.state.from : '/inventory';

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-detail', user?.id || '', purchaseId],
    queryFn: () => {
      if (!user?.id) throw new Error('No dealer ID');
      return purchaseService.getPurchaseDetail(purchaseId, user.id);
    },
    enabled: !!user?.id && !!purchaseId,
  });

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-48 rounded-[32px]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-[30px]" />
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <EmptyState
          icon={ReceiptText}
          title="Purchase record not found"
          description="We could not load this purchase record. It may not exist anymore or may not belong to the current dealer."
          action={
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Go Back
            </Button>
          }
        />
      </PageShell>
    );
  }

  const { purchase, product, supplier, linkedLot, linkedMovements } = data;
  const linkedLotPurchaseDate = linkedLot?.stock_purchases?.purchase_date || purchase.purchase_date;

  return (
    <PageShell>
      <PageHeader
        title={purchase.invoice_number || 'Purchase Record'}
        eyebrow="Purchase Detail"
        onBack={() => navigate(backTo)}
        description={
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
              {product?.type || 'Stock Purchase'}
            </span>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${purchase.is_paid ? 'bg-emerald-400 text-emerald-950' : 'bg-amber-400 text-amber-950'}`}>
              {purchase.is_paid ? 'Paid' : 'Pending Payment'}
            </span>
            {supplier?.name && (
              <span className="inline-flex items-center rounded-full border border-white/30 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white">
                {supplier.name}
              </span>
            )}
          </div>
        }
      />

      <section className="relative z-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Purchase Date',
            value: formatDate(purchase.purchase_date),
            icon: CalendarRange,
            tone: 'bg-sky-100 text-sky-600',
          },
          {
            label: 'Quantity',
            value: `${purchase.quantity} x ${product?.unit || 'units'}`,
            icon: PackageCheck,
            tone: 'bg-emerald-100 text-emerald-600',
          },
          {
            label: 'Cost / Unit',
            value: purchase.cost_price_per_unit ? formatCurrency(purchase.cost_price_per_unit) : 'N/A',
            icon: CircleDollarSign,
            tone: 'bg-amber-100 text-amber-600',
          },
          {
            label: 'Total Amount',
            value: purchase.total_amount ? formatCurrency(purchase.total_amount) : 'N/A',
            icon: ReceiptText,
            tone: 'bg-violet-100 text-violet-600',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_14px_32px_rgba(148,163,184,0.12)]"
          >
            <div className="flex items-center justify-between">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                {card.label}
              </div>
              <div className={`rounded-full p-2 ${card.tone}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-[1.4rem] font-black tracking-[-0.05em] text-slate-900">
              {card.value}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(148,163,184,0.14)]">
          <div className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-sky-700/70">
            Purchase Summary
          </div>
          <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-900">
            Product and supplier information
          </h2>

          <div className="mt-4 grid gap-2.5 sm:gap-3 md:grid-cols-2">
            <div className="rounded-[18px] bg-slate-50/80 p-3.5 sm:p-4 border border-slate-100">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                Product
              </div>
              <div className="mt-1.5 text-lg font-black tracking-[-0.03em] text-slate-900">
                {product?.name || 'Unknown Product'}
              </div>
              <div className="mt-0.5 text-[0.8rem] font-semibold text-slate-500">
                {product?.company || 'No company'} {product?.type ? `· ${product.type}` : ''}
              </div>
            </div>

            <div className="rounded-[18px] bg-slate-50/80 p-3.5 sm:p-4 border border-slate-100">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                Supplier
              </div>
              <div className="mt-1.5 text-lg font-black tracking-[-0.03em] text-slate-900">
                {supplier?.name || 'Supplier not linked'}
              </div>
              <div className="mt-0.5 text-[0.8rem] font-semibold text-slate-500">
                {supplier?.company || supplier?.phone || 'No extra supplier details'}
              </div>
            </div>

            <div className="rounded-[18px] bg-slate-50/80 p-3.5 sm:p-4 border border-slate-100">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                MRP
              </div>
              <div className="mt-1.5 text-lg font-black tracking-[-0.03em] text-slate-900">
                {purchase.mrp ? formatCurrency(purchase.mrp) : 'N/A'}
              </div>
            </div>

            <div className="rounded-[18px] bg-slate-50/80 p-3.5 sm:p-4 border border-slate-100">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                Batch
              </div>
              <div className="mt-1.5 text-lg font-black tracking-[-0.03em] text-slate-900">
                {purchase.batch_number || 'Not specified'}
              </div>
              <div className="mt-0.5 text-[0.8rem] font-semibold text-slate-500">
                Expiry {purchase.expiry_date ? formatDate(purchase.expiry_date) : 'not tracked'}
              </div>
            </div>

            <div className="rounded-[18px] bg-slate-50/80 p-3.5 sm:p-4 border border-slate-100 md:col-span-2">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                Notes
              </div>
              <div className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-700">
                {purchase.notes || 'No purchase notes recorded.'}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(148,163,184,0.14)]">
          <div className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-sky-700/70">
            Linked Lot
          </div>
          <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-900">
            Tracked inventory lot
          </h2>

          {linkedLot ? (
            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                <Truck className="h-4 w-4" />
                Lot Snapshot
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] bg-white px-3 py-3">
                  <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                    Lot ID
                  </div>
                  <div className="mt-2 break-all text-sm font-bold text-slate-900">{linkedLot.id}</div>
                </div>
                <div className="rounded-[20px] bg-white px-3 py-3">
                  <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                    Remaining
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-900">
                    {linkedLot.remaining_quantity} {product?.unit || 'units'}
                  </div>
                </div>
                <div className="rounded-[20px] bg-white px-3 py-3">
                  <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                    Purchase Date
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-900">
                    {formatDate(linkedLotPurchaseDate)}
                  </div>
                </div>
                <div className="rounded-[20px] bg-white px-3 py-3">
                  <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                    Cost Price
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-900">
                    {linkedLot.cost_price ? formatCurrency(linkedLot.cost_price) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={PackageCheck}
              title="Tracked lot not available"
              description="This purchase does not currently have a linked lot snapshot to display."
              className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60"
            />
          )}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(148,163,184,0.14)]">
        <div className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-sky-700/70">
          Related Inventory Movements
        </div>
        <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-900">
          Stock movement created by this purchase
        </h2>

        <div className="mt-5 space-y-3">
          {linkedMovements.length ? (
            linkedMovements.map((movement) => (
              <div key={movement.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success" className="normal-case tracking-[0.02em]">
                        Stock Purchased
                      </Badge>
                      {movement.lot_id ? (
                        <Badge variant="neutral" className="normal-case tracking-[0.02em]">
                          Lot linked
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 text-sm font-bold text-slate-900">
                      {movement.notes || 'No note provided'}
                    </div>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {formatDateTime(purchase.purchase_date)}
                    </div>
                  </div>
                  <div className="text-right text-emerald-700">
                    <div className="text-lg font-black tracking-[-0.03em]">+{movement.quantity_change}</div>
                    <div className="text-xs font-bold uppercase tracking-[0.12em]">{product?.unit || 'units'}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No linked movement rows"
              description="This purchase does not have an inventory movement record available to display."
              className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60"
            />
          )}
        </div>
      </section>
    </PageShell>
  );
};

export default PurchaseDetailPage;
