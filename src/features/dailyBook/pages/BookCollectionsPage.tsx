import React from 'react';
import { cn } from '@/lib/utils';
import { BookPage, bookDateLabel, bookTime, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, bookMoney } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

const methodTag = (method: string): string => {
  if (method === 'upi') return ' (UPI)';
  if (method === 'cheque') return ' (Cheque)';
  if (method === 'other') return ' (Other)';
  return '';
};

// All money received today, across every payment method — cash, UPI, cheque, other.
// Counter Cash (BookCashPage) intentionally shows cash-only since that's the drawer balance.
export const BookCollectionsPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const received = (book?.cashLines || []).filter((l) => l.direction === 'in');
  const total = received.reduce((sum, l) => sum + l.amount, 0);

  const shareText = book
    ? `💰 Collections — ${bookDateLabel(date)}\n` + `Total received: ${bookMoney(total)}`
    : undefined;

  return (
    <BookPage
      title="Collections"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Collections' }]}
      shareText={shareText}
      showPrint
    >
      {isLoading ? (
        <BookLoading />
      ) : !book ? (
        <BookEmpty />
      ) : received.length === 0 ? (
        <BookEmpty message="No collections on this day." />
      ) : (
        <>
          {received.map((line) => (
            <div key={line.id} className="book-dashed py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="book-num text-xs font-bold text-[color:var(--book-ink-soft)]">
                    {bookTime(line.time)}
                  </span>
                  <span className="ml-2 text-sm font-semibold">
                    {line.label}
                    {methodTag(line.method)}
                  </span>
                </div>
                <span className={cn('book-num shrink-0 text-base font-black text-[color:var(--book-green)]')}>
                  +{bookMoney(line.amount)}
                </span>
              </div>
            </div>
          ))}

          <div className="mt-4 flex items-baseline justify-between border-t-2 border-[color:var(--book-rule)] pt-3">
            <span className="text-sm font-black uppercase tracking-[0.08em]">Total Received</span>
            <span className="book-num text-2xl font-black">{bookMoney(total)}</span>
          </div>
        </>
      )}
    </BookPage>
  );
};

export default BookCollectionsPage;
