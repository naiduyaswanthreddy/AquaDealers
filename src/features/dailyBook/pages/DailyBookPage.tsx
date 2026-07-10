import React from 'react';
import { getLocalDateString } from '@/lib/utils';
import { BookDateNav, BookPage, bookDateLabel, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookMoney, BookRow, bookMoney } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

export const DailyBookPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const shareText = book
    ? `📔 Daily Book — ${bookDateLabel(date)}\n` +
      `Sales: ${bookMoney(book.totals.salesTotal)} (${book.totals.billCount} bills)\n` +
      `Received: ${bookMoney(book.totals.receivedTotal)}\n` +
      `Expenses: ${bookMoney(book.totals.expensesTotal)}\n` +
      `Cash in hand: ${bookMoney(book.closingCash)}`
    : undefined;

  const hasAnything =
    !!book &&
    (book.bills.length > 0 ||
      book.payments.length > 0 ||
      book.expenses.length > 0 ||
      book.stockReceipts.length > 0 ||
      book.cashEntries.length > 0);

  return (
    <BookPage title="Daily Book" date={date} shareText={shareText} backTo="/more">
      {isLoading ? (
        <BookLoading />
      ) : !hasAnything ? (
        <>
          <BookEmpty
            message={
              date === getLocalDateString()
                ? 'No entries yet today. Start by creating a bill →'
                : 'No entries on this day.'
            }
          />
          <BookDateNav date={date} />
        </>
      ) : book ? (
        <>
          <BookRow to={`/book/cash?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">💵</span> Cash in Hand
              </span>
              <BookMoney value={book.closingCash} className="text-base" />
            </div>
            <p className="mt-0.5 pl-[2.35rem] text-xs text-[color:var(--book-ink-soft)]">
              Every rupee in and out today, line by line
            </p>
          </BookRow>

          <BookRow to={`/book/products?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">📋</span> Products Sold
              </span>
              <span className="book-num text-sm font-bold">
                {book.products.length} · {bookMoney(book.totals.salesTotal)}
              </span>
            </div>
            <p className="mt-0.5 pl-[2.35rem] text-xs text-[color:var(--book-ink-soft)]">
              What went out of the shop, and who bought it
            </p>
          </BookRow>

          <BookRow to={`/book/farmers?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">👨‍🌾</span> Farmers
              </span>
              <span className="book-num text-sm font-bold">{book.farmers.length} today</span>
            </div>
            <p className="mt-0.5 pl-[2.35rem] text-xs text-[color:var(--book-ink-soft)]">
              Everyone who visited, in the order they came
            </p>
          </BookRow>

          {book.totals.receivedTotal > 0 ? (
            <BookRow to={`/book/cash?date=${date}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                  <span className="book-icon">💰</span> Collections
                </span>
                <BookMoney value={book.totals.receivedTotal} className="text-sm" />
              </div>
              <p className="mt-0.5 pl-[2.35rem] text-xs text-[color:var(--book-ink-soft)]">
                {book.totals.oldCollections > 0
                  ? `${bookMoney(book.totals.oldCollections)} of it against old dues`
                  : 'All received against today’s bills'}
              </p>
            </BookRow>
          ) : null}

          {book.stockReceipts.length > 0 ? (
            <BookRow to={`/book/stock?date=${date}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                  <span className="book-icon">📦</span> Stock Received
                </span>
                <span className="book-num text-sm font-bold">{book.stockReceipts.length} deliveries</span>
              </div>
            </BookRow>
          ) : null}

          <BookRow to={`/book/stock-position?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">🧮</span> Stock Position
              </span>
            </div>
            <p className="mt-0.5 pl-[2.35rem] text-xs text-[color:var(--book-ink-soft)]">
              Opening → sold → received → closing, per product
            </p>
          </BookRow>

          {book.expenses.length > 0 ? (
            <BookRow to={`/book/expenses?date=${date}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                  <span className="book-icon">🏪</span> Expenses
                </span>
                <BookMoney value={book.totals.expensesTotal} className="text-sm" />
              </div>
            </BookRow>
          ) : null}

          <BookRow to={`/book/closing?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">📊</span> Day Closing
              </span>
              <BookMoney value={book.totals.salesTotal} className="text-sm" />
            </div>
            <p className="mt-0.5 pl-[2.35rem] text-xs text-[color:var(--book-ink-soft)]">
              The bottom-of-the-page totals, print-ready for your CA
            </p>
          </BookRow>

          <BookDateNav date={date} />
        </>
      ) : null}
    </BookPage>
  );
};

export default DailyBookPage;
