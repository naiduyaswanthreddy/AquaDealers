import React from 'react';
import { BookPage, bookDateLabel, bookTime, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookRow, bookMoney } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

export const BookFarmersPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const farmers = book?.farmers || [];

  const shareText = book
    ? `👨‍🌾 Farmers — ${bookDateLabel(date)}\n` +
      (farmers.length
        ? farmers.map((f) => `${f.name}: ${bookMoney(f.total)}${f.unpaidToday > 0 ? ' (due)' : ''}`).join('\n')
        : 'No farmer visits.')
    : undefined;

  return (
    <BookPage
      title="Farmers Today"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Farmers' }]}
      shareText={shareText}
    >
      {isLoading ? (
        <BookLoading />
      ) : farmers.length === 0 ? (
        <BookEmpty message="No farmer visits on this day." />
      ) : (
        <>
          <p className="book-num pb-1 text-sm font-bold">
            {farmers.length} {farmers.length === 1 ? 'farmer' : 'farmers'} visited
          </p>
          {farmers.map((farmer) => (
            <BookRow
              key={farmer.key}
              to={
                farmer.farmerId
                  ? `/book/farmers/${farmer.farmerId}?date=${date}`
                  : `/book/bills/${farmer.key.replace('walkin:', '')}?date=${date}`
              }
              accent={farmer.unpaidToday > 0 ? 'unpaid' : 'paid'}
            >
              <div className="text-sm font-extrabold uppercase">
                {farmer.name}
                {farmer.village ? <span className="font-semibold normal-case"> · {farmer.village}</span> : null}
              </div>
              <div className="book-num mt-0.5 text-xs">
                {bookMoney(farmer.total)} · {farmer.billCount} {farmer.billCount === 1 ? 'bill' : 'bills'} ·{' '}
                {farmer.unpaidToday > 0 ? (
                  <span className="font-bold text-[color:var(--book-red)]">
                    ✗ {bookMoney(farmer.unpaidToday)} due today
                  </span>
                ) : (
                  <span className="font-bold text-[color:var(--book-green)]">✓ Paid</span>
                )}
              </div>
              <div className="book-num mt-0.5 text-xs text-[color:var(--book-ink-soft)]">
                First visited: {bookTime(farmer.firstBillAt)}
              </div>
              {farmer.farmerId && farmer.outstanding > 0 ? (
                <div className="book-num mt-0.5 text-xs font-bold text-[#b45309]">
                  Total outstanding: {bookMoney(farmer.outstanding)}
                </div>
              ) : null}
            </BookRow>
          ))}
        </>
      )}
    </BookPage>
  );
};

export default BookFarmersPage;
