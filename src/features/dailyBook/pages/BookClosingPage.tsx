import React from 'react';
import { BookPage, bookDateLabel, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookSection, bookMoney, formatQty } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

const Line: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between py-1">
    <span className="text-sm font-semibold text-[color:var(--book-ink-soft)]">{label}</span>
    <span className="book-num text-sm font-bold">{value}</span>
  </div>
);

export const BookClosingPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const totals = book?.totals;
  const changePct =
    totals && totals.yesterdaySales > 0
      ? Math.round(((totals.salesTotal - totals.yesterdaySales) / totals.yesterdaySales) * 100)
      : null;

  const shareText = totals
    ? `📊 Day Closing — ${bookDateLabel(date)}\n` +
      `Bills: ${totals.billCount}\n` +
      `Total Sales: ${bookMoney(totals.salesTotal)}\n` +
      `Cash: ${bookMoney(totals.cashSales)} · UPI: ${bookMoney(totals.upiSales)} · Udhar: ${bookMoney(totals.creditGiven)}\n` +
      `Money In: ${bookMoney(totals.receivedTotal)}\n` +
      `Expenses: ${bookMoney(totals.expensesTotal)} · Supplier Paid: ${bookMoney(totals.supplierPaid)}`
    : undefined;

  // Per-product stock movement for the day: OUT from bills, IN from purchases.
  const stockMoves = React.useMemo(() => {
    if (!book) return [];
    const map = new Map<string, { name: string; unit: string; out: number; in: number }>();
    for (const product of book.products) {
      map.set(product.productId, { name: product.name, unit: product.unit, out: product.quantity, in: 0 });
    }
    for (const receipt of book.stockReceipts) {
      const key = receipt.product_id;
      const existing = map.get(key);
      if (existing) existing.in += Number(receipt.quantity || 0);
      else
        map.set(key, {
          name: receipt.products?.name || 'Product',
          unit: receipt.products?.unit || 'units',
          out: 0,
          in: Number(receipt.quantity || 0),
        });
    }
    return [...map.values()];
  }, [book]);

  return (
    <BookPage
      title="Day Closing"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Closing' }]}
      shareText={shareText}
      showPrint
    >
      {isLoading ? (
        <BookLoading />
      ) : !book || !totals ? (
        <BookEmpty />
      ) : (
        <>
          <BookSection title="Sales" className="mt-2" />
          <div className="book-dashed pb-2">
            <Line label="Total Bills" value={String(totals.billCount)} />
            <Line label="Cash Sales" value={bookMoney(totals.cashSales)} />
            <Line label="UPI Sales" value={bookMoney(totals.upiSales)} />
            <Line
              label={`Udhar Given (${totals.creditFarmers} ${totals.creditFarmers === 1 ? 'farmer' : 'farmers'})`}
              value={bookMoney(totals.creditGiven)}
            />
            <Line label="Total Revenue" value={bookMoney(totals.salesTotal)} />
          </div>

          <BookSection title="Money Received Today" />
          <div className="book-dashed pb-2">
            <Line label="Against Today's Bills" value={bookMoney(totals.receivedTotal - totals.oldCollections)} />
            <Line label="Old Collections" value={bookMoney(totals.oldCollections)} />
            <Line label="Total In" value={bookMoney(totals.receivedTotal)} />
          </div>

          <BookSection title="Money Paid Today" />
          <div className="book-dashed pb-2">
            <Line label="Expenses" value={bookMoney(totals.expensesTotal)} />
            <Line label="Supplier Paid" value={bookMoney(totals.supplierPaid)} />
            <Line label="Total Out" value={bookMoney(totals.expensesTotal + totals.supplierPaid)} />
          </div>

          {stockMoves.length > 0 ? (
            <>
              <BookSection title="Stock Moved" />
              <div className="book-dashed pb-2">
                {stockMoves.map((move) => (
                  <div key={move.name} className="book-num flex items-baseline justify-between py-1 text-xs">
                    <span className="min-w-0 flex-1 truncate pr-2 font-semibold">{move.name}</span>
                    <span>
                      OUT {formatQty(move.out, move.unit)} · IN {move.in}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <BookSection title="vs Yesterday" />
          <div className="pb-2">
            <Line label="Yesterday" value={bookMoney(totals.yesterdaySales)} />
            <Line label="Today" value={bookMoney(totals.salesTotal)} />
            {changePct !== null ? (
              <p className={`book-num mt-1 text-sm font-black ${changePct >= 0 ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                {changePct >= 0 ? '↑' : '↓'} {Math.abs(changePct)}%
              </p>
            ) : null}
          </div>

          <div className="book-no-print mt-4 text-center text-xs text-[color:var(--book-ink-soft)]">
            Use the print icon above to print or save this page as PDF for your CA.
          </div>
        </>
      )}
    </BookPage>
  );
};

export default BookClosingPage;
