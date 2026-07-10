import React from 'react';
import { useParams } from 'react-router-dom';
import { BookPage, bookDateLabel, bookTime, useBookDate } from '../components/BookPage';
import { BookBanner, BookEmpty, BookLoading, BookRow, BookStat, bookMoney, formatQty, paidBadge, paymentModeLabel } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

export const BookProductDetailPage: React.FC = () => {
  const date = useBookDate();
  const { productId } = useParams<{ productId: string }>();
  const decodedId = decodeURIComponent(productId || '');
  const { data: book, isLoading } = useDailyBook(date);

  const product = book?.products.find((p) => p.productId === decodedId);

  // Every bill line for this product, with its parent bill.
  const sales = React.useMemo(() => {
    if (!book) return [];
    const rows: {
      billId: string;
      billNumber: string;
      createdAt: string;
      farmerKey: string | null;
      farmerName: string;
      village: string | null;
      quantity: number;
      amount: number;
      paymentType: string | null;
      balanceDue: number;
      total: number;
    }[] = [];
    for (const bill of book.bills) {
      for (const item of bill.bill_items || []) {
        const itemProductId = item.product_id || `snapshot:${item.product_name_snapshot || 'unknown'}`;
        if (itemProductId !== decodedId) continue;
        rows.push({
          billId: bill.id,
          billNumber: bill.bill_number,
          createdAt: bill.created_at,
          farmerKey: bill.farmer_id,
          farmerName: bill.farmers?.name || bill.farmer_name_snapshot || 'Walk-in customer',
          village: bill.farmers?.village || null,
          quantity: Number(item.quantity || 0),
          amount: Number(item.total_price || 0),
          paymentType: bill.payment_type,
          balanceDue: Number(bill.balance_due || 0),
          total: Number(bill.total || 0),
        });
      }
    }
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [book, decodedId]);

  const shareText = product
    ? `${product.name} — ${bookDateLabel(date)}\n` +
      `${formatQty(product.quantity, product.unit)} · ${product.farmerCount} farmers · ${bookMoney(product.revenue)}\n` +
      sales.map((s) => `${s.farmerName}: ${formatQty(s.quantity, product.unit)} = ${bookMoney(s.amount)}`).join('\n')
    : undefined;

  return (
    <BookPage
      title={product?.name || 'Product'}
      date={date}
      backTo={`/book/products?date=${date}`}
      crumbs={[
        { label: 'Daily Book', to: `/book?date=${date}` },
        { label: 'Products', to: `/book/products?date=${date}` },
        { label: product?.name || '…' },
      ]}
      shareText={shareText}
    >
      {isLoading ? (
        <BookLoading />
      ) : !product ? (
        <BookEmpty message="This product has no sales on this day." />
      ) : (
        <>
          <div className="book-rule-thin flex items-center gap-2 pb-3 pt-1">
            <BookStat icon="📦" tint="teal" value={formatQty(product.quantity, product.unit)} label="sold" />
            <BookStat
              icon="👨‍🌾"
              tint="orange"
              value={String(product.farmerCount)}
              label={product.farmerCount === 1 ? 'farmer' : 'farmers'}
            />
            <BookStat icon="₹" tint="blue" value={bookMoney(product.revenue)} label="total sales" />
          </div>

          <BookBanner tone={product.unpaidBillCount > 0 ? 'unpaid' : 'paid'}>
            {product.unpaidBillCount > 0
              ? `✗ ${bookMoney(product.unpaidAmount)} unpaid`
              : '✓ Fully paid today'}
          </BookBanner>

          {sales.map((sale) => (
            <BookRow
              key={`${sale.billId}-${sale.amount}-${sale.quantity}`}
              to={
                sale.farmerKey
                  ? `/book/farmers/${sale.farmerKey}?date=${date}`
                  : `/book/bills/${sale.billId}?date=${date}`
              }
              accent={sale.balanceDue > 0 ? 'unpaid' : 'paid'}
            >
              <div className="book-num text-xs font-bold text-[color:var(--book-ink-soft)]">
                {bookTime(sale.createdAt)}
              </div>
              <div className="mt-0.5 text-sm font-extrabold uppercase">
                {sale.farmerName}
                {sale.village ? <span className="font-semibold normal-case"> · {sale.village}</span> : null}
              </div>
              <div className="book-num mt-0.5 text-xs">
                {formatQty(sale.quantity, product.unit)} · {bookMoney(sale.amount)} ·{' '}
                {paymentModeLabel(sale.paymentType)} · {paidBadge(sale.balanceDue, sale.total)}
              </div>
              <div className="book-num mt-0.5 text-xs text-[color:var(--book-ink-soft)]">
                Bill #{sale.billNumber}
              </div>
            </BookRow>
          ))}
        </>
      )}
    </BookPage>
  );
};

export default BookProductDetailPage;
