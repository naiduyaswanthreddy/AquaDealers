import React from 'react';
import { BookPage, bookDateLabel, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, bookMoney, formatQty } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

export const BookSalesPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const bills = book?.bills || [];

  const shareText = book
    ? `🧾 Sales — ${bookDateLabel(date)}\n` +
      (bills.length
        ? bills.map(b => {
            const farmerName = b.farmers?.name || b.farmer_name_snapshot || 'Walk-in';
            const items = (b.bill_items || []).map(i => `  ${i.products?.name || i.product_name_snapshot || 'Item'}: ${formatQty(i.quantity, i.products?.unit || '')}`).join('\n');
            return `${farmerName} — ${bookMoney(b.total)}\n${items}`;
          }).join('\n\n')
        : 'No sales.')
    : undefined;

  return (
    <BookPage
      title="Sales"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Sales' }]}
      shareText={shareText}
    >
      {isLoading ? (
        <BookLoading />
      ) : bills.length === 0 ? (
        <BookEmpty message="No sales on this day." />
      ) : (
        <>
          <p className="book-num pb-1 text-sm font-bold">
            {bills.length} {bills.length === 1 ? 'bill' : 'bills'} · {bookMoney(book!.totals.salesTotal)}
          </p>
          {bills.map((bill) => {
            const farmerName = bill.farmers?.name || bill.farmer_name_snapshot || 'Walk-in';
            const items = bill.bill_items || [];
            return (
              <div key={bill.id} className="book-row py-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-base font-extrabold text-[color:var(--book-ink)]">{farmerName}</span>
                  <span className="book-num text-base font-bold shrink-0">{bookMoney(bill.total)}</span>
                </div>
                {items.length > 0 ? (
                  <div className="mt-1.5 space-y-0.5 pl-1 border-l-2 border-[color:var(--book-rule)]">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-[color:var(--book-ink)]">
                          {item.products?.name || item.product_name_snapshot || 'Item'}
                        </span>
                        <span className="book-num text-sm text-[color:var(--book-ink-soft)] shrink-0">
                          {formatQty(item.quantity, item.products?.unit || '')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {Number(bill.balance_due || 0) > 0 ? (
                  <div className="book-num mt-1 text-sm font-bold text-[color:var(--book-red)]">
                    ✗ {bookMoney(bill.balance_due!)} due
                  </div>
                ) : (
                  <div className="mt-1 text-sm font-bold text-[color:var(--book-green)]">✓ Paid</div>
                )}
              </div>
            );
          })}
        </>
      )}
    </BookPage>
  );
};

export default BookSalesPage;
