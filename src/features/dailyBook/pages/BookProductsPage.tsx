import React from 'react';
import { BookPage, bookDateLabel, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookRow, BookSection, bookMoney, formatQty } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';
import type { BookProductSummary } from '../types';

const CATEGORY_LABELS: Record<string, string> = {
  feed: 'Feed Bags',
  medicine: 'Medicines',
  other: 'Other Products',
};

const ProductRow: React.FC<{ product: BookProductSummary; date: string }> = ({ product, date }) => (
  <BookRow
    to={`/book/products/${encodeURIComponent(product.productId)}?date=${date}`}
    accent={product.unpaidBillCount > 0 ? 'unpaid' : 'paid'}
  >
    <div className="text-sm font-extrabold">{product.name}</div>
    <div className="book-num mt-0.5 text-xs text-[color:var(--book-ink-soft)]">
      {formatQty(product.quantity, product.unit)} · {product.farmerCount}{' '}
      {product.farmerCount === 1 ? 'farmer' : 'farmers'} · {bookMoney(product.revenue)}
    </div>
    <div className="mt-0.5 text-xs font-bold">
      {product.unpaidBillCount > 0 ? (
        <span className="text-[color:var(--book-red)]">
          ✗ {bookMoney(product.unpaidAmount)} unpaid on {product.unpaidBillCount} bill
          {product.unpaidBillCount > 1 ? 's' : ''}
        </span>
      ) : (
        <span className="text-[color:var(--book-green)]">✓ Fully paid</span>
      )}
    </div>
  </BookRow>
);

export const BookProductsPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const grouped = React.useMemo(() => {
    const groups = new Map<string, BookProductSummary[]>();
    for (const product of book?.products || []) {
      const key = product.type === 'feed' || product.type === 'medicine' ? product.type : 'other';
      groups.set(key, [...(groups.get(key) || []), product]);
    }
    return ['feed', 'medicine', 'other'].filter((k) => groups.has(k)).map((k) => ({
      key: k,
      label: CATEGORY_LABELS[k],
      products: groups.get(k)!,
    }));
  }, [book?.products]);

  const totalUnits = (book?.products || []).reduce((sum, p) => sum + p.quantity, 0);

  const shareText = book
    ? `📋 Products Sold — ${bookDateLabel(date)}\n` +
      (book.products.length
        ? book.products.map((p) => `${p.name}: ${formatQty(p.quantity, p.unit)} = ${bookMoney(p.revenue)}`).join('\n') +
          `\nTotal: ${bookMoney(book.totals.salesTotal)}`
        : 'No sales.')
    : undefined;

  return (
    <BookPage
      title="Products Sold"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Products' }]}
      shareText={shareText}
    >
      {isLoading ? (
        <BookLoading />
      ) : !book || book.products.length === 0 ? (
        <BookEmpty />
      ) : (
        <>
          <p className="book-num pb-1 text-sm font-bold">
            {book.products.length} products · {totalUnits} units · {bookMoney(book.totals.salesTotal)} total
          </p>
          {grouped.map((group) => (
            <React.Fragment key={group.key}>
              <BookSection title={group.label} />
              {group.products.map((product) => (
                <ProductRow key={product.productId} product={product} date={date} />
              ))}
            </React.Fragment>
          ))}
        </>
      )}
    </BookPage>
  );
};

export default BookProductsPage;
