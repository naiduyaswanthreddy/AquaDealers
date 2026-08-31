import React from 'react';
import { getLocalDateString } from '@/lib/utils';
import { BookDateNav, BookPage, bookDateLabel, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookMoney, BookRow, bookMoney } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';
import { useBranchStore } from '@/stores/branchStore';

export const DailyBookPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);
  const { activeBranch, isAllBranches } = useBranchStore();
  const outstandingDues = book?.farmers.reduce((sum, farmer) => sum + Number(farmer.outstanding || 0), 0) ?? 0;

  const shareText = book
    ? `📔 Daily Book — ${bookDateLabel(date)}\n` +
      `Sales: ${bookMoney(book.totals.salesTotal)} (${book.totals.billCount} bills)\n` +
      `Received: ${bookMoney(book.totals.receivedTotal)}\n` +
      `Returns: ${bookMoney(book.totals.returnsTotal)}\n` +
      `Expenses: ${bookMoney(book.totals.expensesTotal)}\n` +
      `Cash in hand: ${bookMoney(book.closingCash)}`
    : undefined;

  const hasAnything =
    !!book &&
    (book.bills.length > 0 ||
      book.payments.length > 0 ||
      book.returns.length > 0 ||
      book.expenses.length > 0 ||
      book.stockReceipts.length > 0 ||
      book.cashEntries.length > 0);

  return (
    <BookPage title="Daily Book" subtitle={isAllBranches ? 'All shops' : activeBranch?.name || 'Current shop'} date={date} shareText={shareText} backTo="/more">
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
          <BookRow to={`/book/sales?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-base font-extrabold">
                <span className="book-icon">🧾</span> Sales
              </span>
              <span className="book-num text-base font-bold">
                {book.bills.length} bills · {bookMoney(book.totals.salesTotal)}
              </span>
            </div>
          </BookRow>

          <BookRow to={`/book/collections?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">💰</span> Collections
              </span>
              <BookMoney value={book.totals.receivedTotal} className="text-base font-bold" />
            </div>
          </BookRow>

          {book.returns.length > 0 ? (
            <BookRow to="/returns">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                  <span className="book-icon">↩</span> Returns
                </span>
                <span className="book-num text-base font-bold">{book.returns.length} · {bookMoney(book.totals.returnsTotal)}</span>
              </div>
            </BookRow>
          ) : null}

          <BookRow to={`/book/cash?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-base font-extrabold">
                <span className="book-icon">💵</span> Counter Cash
              </span>
              <BookMoney value={book.dayCashMove} className="text-xl font-black" />
            </div>
          </BookRow>

          <BookRow to={`/book/products?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">📋</span> Products Sold
              </span>
              <span className="book-num text-base font-bold">
                {book.products.length} · {bookMoney(book.totals.salesTotal)}
              </span>
            </div>
          </BookRow>

          {book.stockReceipts.length > 0 ? (
            <BookRow to={`/book/stock?date=${date}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                  <span className="book-icon">📦</span> Stock Received
                </span>
                <span className="book-num text-base font-bold">{book.stockReceipts.length} deliveries</span>
              </div>
            </BookRow>
          ) : null}

          <BookRow to={`/book/stock-position?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">🧮</span> Stock Movement
              </span>
            </div>
          </BookRow>

          {book.expenses.length > 0 ? (
            <BookRow to={`/book/expenses?date=${date}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                  <span className="book-icon">🏪</span> Expenses
                </span>
                <BookMoney value={book.totals.expensesTotal} className="text-base font-bold" />
              </div>
            </BookRow>
          ) : null}

          <BookRow to={`/book/farmers?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">👨‍🌾</span> Farmers
              </span>
              <span className="book-num text-base font-bold">{book.farmers.length} today</span>
            </div>
          </BookRow>

          <BookRow to={`/book/closing?date=${date}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
                <span className="book-icon">📊</span> Day Closing
              </span>
              <BookMoney value={book.totals.salesTotal} className="text-base font-bold" />
            </div>
          </BookRow>

          <BookDateNav date={date} />
        </>
      ) : null}
    </BookPage>
  );
};

export default DailyBookPage;
