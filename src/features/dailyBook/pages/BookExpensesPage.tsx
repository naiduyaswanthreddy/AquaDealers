import React from 'react';
import { Link } from 'react-router-dom';
import { BookPage, bookTime, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookRow, bookMoney } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

export const BookExpensesPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const expenses = book?.expenses || [];
  const total = book?.totals.expensesTotal || 0;

  return (
    <BookPage
      title="Expenses"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Expenses' }]}
    >
      {isLoading ? (
        <BookLoading />
      ) : expenses.length === 0 ? (
        <BookEmpty
          message="No expenses on this day."
          action={
            <Link to="/expenses" className="text-xs font-bold underline">
              Add an expense →
            </Link>
          }
        />
      ) : (
        <>
          {expenses.map((expense) => (
            <BookRow key={expense.id}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="book-num text-xs font-bold text-[color:var(--book-ink-soft)]">
                    {bookTime(expense.created_at)}
                  </span>
                  <span className="ml-2 text-sm font-semibold">
                    {expense.description || expense.category || 'Expense'}
                  </span>
                </div>
                <span className="book-num shrink-0 text-sm font-black text-[#C0392B]">
                  −{bookMoney(Number(expense.amount))}
                </span>
              </div>
            </BookRow>
          ))}
          <div className="mt-3 flex items-baseline justify-between border-t-2 border-[color:var(--book-rule)] pt-3">
            <span className="text-xs font-black uppercase tracking-[0.1em]">Total Spent</span>
            <span className="book-num text-base font-black">{bookMoney(total)}</span>
          </div>
          <div className="book-no-print mt-4 text-center">
            <Link to="/expenses" className="text-xs font-bold underline">
              Add / manage expenses →
            </Link>
          </div>
        </>
      )}
    </BookPage>
  );
};

export default BookExpensesPage;
