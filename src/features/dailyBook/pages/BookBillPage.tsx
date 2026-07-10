import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BookPage, bookTime, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, bookActionClass, paymentModeLabel } from '../components/bookUi';
import { useBookBill } from '../hooks/useDailyBook';

const TotalLine: React.FC<{ label: string; value: number; strong?: boolean; balance?: boolean }> = ({
  label,
  value,
  strong,
  balance,
}) => (
  <div className={cn('flex items-baseline justify-between py-1', strong && 'border-t border-[color:var(--book-rule)] pt-2')}>
    <span className={cn('text-xs font-bold uppercase tracking-[0.1em]', strong ? 'text-[color:var(--book-ink)]' : 'text-[color:var(--book-ink-soft)]')}>
      {label}
    </span>
    <span
      className={cn(
        'book-num text-sm font-black',
        balance && (value > 0 ? 'text-[color:var(--book-red)]' : 'text-[color:var(--book-green)]')
      )}
    >
      {formatCurrency(value)}
    </span>
  </div>
);

const BILL_GRID = 'grid grid-cols-[minmax(0,1fr)_2.75rem_4.25rem_5.25rem] items-baseline gap-x-2';

export const BookBillPage: React.FC = () => {
  const date = useBookDate();
  const { billId } = useParams<{ billId: string }>();
  const { data: bill, isLoading } = useBookBill(billId);

  const isCancelled = bill?.status === 'cancelled';

  const shareText = bill
    ? `🧾 Bill #${bill.bill_number} — ${formatDate(bill.bill_date)}\n` +
      `${bill.farmers?.name || bill.farmer_name_snapshot || 'Walk-in'}\n` +
      (bill.bill_items || [])
        .map(
          (item) =>
            `${item.products?.name || item.product_name_snapshot} ${item.quantity} × ${formatCurrency(Number(item.unit_price))} = ${formatCurrency(Number(item.total_price))}`
        )
        .join('\n') +
      `\nTotal: ${formatCurrency(Number(bill.total))} · Paid: ${formatCurrency(Number(bill.amount_paid))} · Balance: ${formatCurrency(Number(bill.balance_due))}`
    : undefined;

  return (
    <BookPage
      title={bill ? `Bill #${bill.bill_number}` : 'Bill'}
      date={date}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: bill ? `Bill #${bill.bill_number}` : '…' }]}
      shareText={shareText}
      showPrint
    >
      {isLoading ? (
        <BookLoading />
      ) : !bill ? (
        <BookEmpty message="Bill not found." />
      ) : (
        <div className={cn(isCancelled && 'opacity-60')}>
          <div className="book-rule-thin pb-2 text-xs font-semibold text-[color:var(--book-ink-soft)]">
            <span className="font-extrabold uppercase text-[color:var(--book-ink)]">
              {bill.farmers?.name || bill.farmer_name_snapshot || 'Walk-in customer'}
            </span>
            {bill.farmers?.village ? ` · ${bill.farmers.village}` : ''} · {bookTime(bill.created_at)}
          </div>

          {isCancelled ? (
            <div className="book-dashed py-3 text-sm font-black uppercase tracking-[0.1em] text-[#C0392B]">
              Cancelled{bill.cancelled_reason ? ` — ${bill.cancelled_reason}` : ''}
            </div>
          ) : null}

          {/* Item table: ITEM · QTY · RATE · AMOUNT, like a printed invoice */}
          <div className={cn(BILL_GRID, 'border-b border-[color:var(--book-rule)] pb-1.5 pt-2 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[color:var(--book-ink-soft)]')}>
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
          </div>
          {(bill.bill_items || []).map((item) => (
            <div key={item.id} className={cn(BILL_GRID, 'book-dashed py-2.5', isCancelled && 'line-through')}>
              <span className="truncate text-sm font-extrabold">
                {item.products?.name || item.product_name_snapshot || 'Item'}
              </span>
              <span className="book-num text-right text-xs">{item.quantity}</span>
              <span className="book-num text-right text-xs">{formatCurrency(Number(item.unit_price))}</span>
              <span className="book-num text-right text-sm font-bold">{formatCurrency(Number(item.total_price))}</span>
            </div>
          ))}

          <div className={cn('mt-3', isCancelled && 'line-through')}>
            <TotalLine label="Subtotal" value={Number(bill.subtotal)} />
            {Number(bill.gst_amount) > 0 ? <TotalLine label="GST" value={Number(bill.gst_amount)} /> : null}
            {Number(bill.discount_amount) > 0 ? <TotalLine label="Discount" value={-Number(bill.discount_amount)} /> : null}
            <TotalLine label="Total" value={Number(bill.total)} strong />
            <TotalLine label={`Paid (${paymentModeLabel(bill.payment_type).replace(/^[^ ]+ /, '')})`} value={Number(bill.amount_paid)} />
            <TotalLine label="Balance Due" value={Number(bill.balance_due)} strong balance />
          </div>

          <div className="book-no-print mt-6 grid grid-cols-2 gap-2 text-center">
            <Link
              to={`/bills/${bill.id}`}
              state={{ from: `/book/bills/${bill.id}?date=${date}` }}
              className={bookActionClass('green')}
            >
              🖨️ Print / WhatsApp
            </Link>
            {bill.farmer_id ? (
              <Link to={`/book/farmers/${bill.farmer_id}?date=${date}`} className={bookActionClass('blue')}>
                👨‍🌾 Farmer's Page
              </Link>
            ) : (
              <span className={`${bookActionClass('blue')} cursor-not-allowed opacity-40`}>Walk-in customer</span>
            )}
          </div>
        </div>
      )}
    </BookPage>
  );
};

export default BookBillPage;
