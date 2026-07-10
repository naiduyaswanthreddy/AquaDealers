import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate } from '@/lib/utils';
import { BookPage, bookDateLabel, bookTime, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookRow, BookSection, bookActionClass, bookMoney, paidBadge, paymentModeLabel } from '../components/bookUi';
import { useFarmerDayView } from '../hooks/useDailyBook';
import type { BookBill } from '../types';

const itemsSummary = (bill: BookBill): string =>
  (bill.bill_items || [])
    .map((item) => `${item.products?.name || item.product_name_snapshot || 'Item'} × ${item.quantity}`)
    .join(', ') || 'No items';

const riskBadge = (risk: string): string => {
  const normalized = (risk || '').toLowerCase();
  if (normalized.includes('high') || normalized.includes('risk')) return '🔴 High risk';
  if (normalized.includes('watch') || normalized.includes('medium')) return '🟡 Watch';
  return '🟢 Reliable';
};

export const BookFarmerPage: React.FC = () => {
  const date = useBookDate();
  const { farmerId } = useParams<{ farmerId: string }>();
  const { data, isLoading } = useFarmerDayView(farmerId, date);

  const farmer = data?.farmer;

  const shareText = farmer
    ? `${farmer.name} — ${bookDateLabel(date)}\n` +
      (data!.todayBills.length
        ? data!.todayBills.map((b) => `Bill #${b.bill_number}: ${bookMoney(Number(b.total))}`).join('\n') + '\n'
        : '') +
      `Outstanding: ${bookMoney(Number(farmer.total_due || 0))}`
    : undefined;

  return (
    <BookPage
      title={farmer?.name || 'Farmer'}
      date={date}
      crumbs={[
        { label: 'Daily Book', to: `/book?date=${date}` },
        { label: 'Farmers', to: `/book/farmers?date=${date}` },
        { label: farmer?.name || '…' },
      ]}
      shareText={shareText}
    >
      {isLoading ? (
        <BookLoading />
      ) : !farmer ? (
        <BookEmpty message="Farmer not found." />
      ) : (
        <>
          <div className="book-rule-thin pb-2 text-xs font-semibold text-[color:var(--book-ink-soft)]">
            {[farmer.village, farmer.pond_acres ? `${farmer.pond_acres} acres` : null, riskBadge(farmer.risk_status)]
              .filter(Boolean)
              .join(' · ')}
          </div>

          <BookSection title="Today" />
          {data!.todayBills.length === 0 ? (
            <p className="book-dashed py-3 text-sm text-[color:var(--book-ink-soft)]">No bills on this day.</p>
          ) : (
            data!.todayBills.map((bill) => (
              <BookRow
                key={bill.id}
                to={`/book/bills/${bill.id}?date=${date}&from=farmer`}
                accent={Number(bill.balance_due) > 0 ? 'unpaid' : 'paid'}
              >
                <div className="text-sm font-bold">{itemsSummary(bill)}</div>
                <div className="book-num mt-0.5 text-xs">
                  {bookMoney(Number(bill.total))} · {paymentModeLabel(bill.payment_type)} ·{' '}
                  {paidBadge(Number(bill.balance_due), Number(bill.total))}
                </div>
                <div className="book-num mt-0.5 text-xs text-[color:var(--book-ink-soft)]">
                  Bill #{bill.bill_number} · {bookTime(bill.created_at)}
                </div>
              </BookRow>
            ))
          )}

          <BookSection title="Outstanding Balance" />
          {Number(farmer.total_due) > 0 ? (
            <div className="book-dashed py-3">
              <p className="book-num text-sm font-black text-[#C0392B]">
                {bookMoney(Number(farmer.total_due))} pending
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--book-ink-soft)]">
                Collect from the farmer's full ledger below.
              </p>
            </div>
          ) : (
            <p className="book-dashed py-3 text-sm font-bold text-[color:var(--book-green)]">
              ✓ Nothing pending — account is clear
            </p>
          )}

          <BookSection title="Recent History" />
          {data!.recentBills.length === 0 ? (
            <p className="book-dashed py-3 text-sm text-[color:var(--book-ink-soft)]">No earlier bills.</p>
          ) : (
            data!.recentBills.map((bill) => (
              <BookRow key={bill.id} to={`/book/bills/${bill.id}?date=${date}&from=farmer`}>
                <div className="book-num text-xs">
                  <span className="font-bold">{formatDate(bill.bill_date)}</span> · {itemsSummary(bill)}
                </div>
                <div className="book-num mt-0.5 text-xs">
                  {bookMoney(Number(bill.total))} · {paidBadge(Number(bill.balance_due), Number(bill.total))}
                </div>
              </BookRow>
            ))
          )}

          <div className="book-no-print mt-6 grid grid-cols-3 gap-2 text-center">
            {farmer.phone ? (
              <a
                href={`https://wa.me/91${farmer.phone.replace(/\D/g, '').slice(-10)}`}
                target="_blank"
                rel="noreferrer"
                className={bookActionClass('green')}
              >
                📲 WhatsApp
              </a>
            ) : (
              <span className={`${bookActionClass('green')} cursor-not-allowed opacity-40`}>📲 WhatsApp</span>
            )}
            <Link to="/bills/new" className={bookActionClass('blue')}>
              🧾 New Bill
            </Link>
            <Link
              to={`/farmers/${farmer.id}`}
              state={{ from: `/book/farmers/${farmer.id}?date=${date}` }}
              className={bookActionClass('orange')}
            >
              💰 Collect
            </Link>
          </div>
        </>
      )}
    </BookPage>
  );
};

export default BookFarmerPage;
