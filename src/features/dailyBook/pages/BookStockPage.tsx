import React from 'react';
import { BookPage, bookTime, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookRow, bookMoney, formatQty } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

export const BookStockPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const receipts = book?.stockReceipts || [];

  return (
    <BookPage
      title="Stock Received"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Stock Received' }]}
    >
      {isLoading ? (
        <BookLoading />
      ) : receipts.length === 0 ? (
        <BookEmpty message="No stock received on this day." />
      ) : (
        receipts.map((receipt) => (
          <BookRow key={receipt.id} to={`/purchases/${receipt.id}`} state={{ from: `/book/stock?date=${date}` }}>
            <div className="book-num text-xs font-bold text-[color:var(--book-ink-soft)]">
              {bookTime(receipt.created_at)}
            </div>
            <div className="mt-0.5 text-sm font-extrabold">{receipt.products?.name || 'Product'}</div>
            <div className="book-num mt-0.5 text-xs">
              {formatQty(Number(receipt.quantity), receipt.products?.unit)}
              {receipt.total_amount ? ` · ${bookMoney(Number(receipt.total_amount))}` : ''}
              {receipt.suppliers?.name ? ` · from ${receipt.suppliers.name}` : ''}
            </div>
            {receipt.invoice_number ? (
              <div className="book-num mt-0.5 text-xs text-[color:var(--book-ink-soft)]">
                Invoice {receipt.invoice_number}
              </div>
            ) : null}
          </BookRow>
        ))
      )}
    </BookPage>
  );
};

export default BookStockPage;
