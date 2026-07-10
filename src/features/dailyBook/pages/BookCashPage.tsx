import React from 'react';
import { cn } from '@/lib/utils';
import { BookPage, bookDateLabel, bookTime, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookSection, bookMoney } from '../components/bookUi';
import { useDailyBook } from '../hooks/useDailyBook';

const methodTag = (method: string): string => {
  if (method === 'upi') return ' (UPI)';
  if (method === 'cheque') return ' (Cheque)';
  if (method === 'other') return ' (Other)';
  return '';
};

export const BookCashPage: React.FC = () => {
  const date = useBookDate();
  const { data: book, isLoading } = useDailyBook(date);

  const shareText = book
    ? `💵 Cash Summary — ${bookDateLabel(date)}\n` +
      `Opening: ${bookMoney(book.openingCash)}\n` +
      `Closing: ${bookMoney(book.closingCash)}`
    : undefined;

  const nonCashIn = (book?.cashLines || [])
    .filter((l) => l.direction === 'in' && l.method !== 'cash')
    .reduce((sum, l) => sum + l.amount, 0);

  const cashIn = (book?.cashLines || []).filter((l) => l.direction === 'in');
  const cashOut = (book?.cashLines || []).filter((l) => l.direction === 'out');

  const renderLine = (line: NonNullable<typeof book>['cashLines'][number]) => {
    const countsInDrawer = line.method === 'cash';
    return (
      <div key={line.id} className="book-dashed py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="book-num text-xs font-bold text-[color:var(--book-ink-soft)]">
              {bookTime(line.time)}
            </span>
            <span className="ml-2 text-sm font-semibold">
              {line.label}
              <span className="text-xs text-[color:var(--book-ink-soft)]">{methodTag(line.method)}</span>
            </span>
          </div>
          <span
            className={cn(
              'book-num shrink-0 text-sm font-black',
              line.direction === 'in' ? 'text-[color:var(--book-green)]' : 'text-[color:var(--book-red)]',
              !countsInDrawer && 'opacity-60'
            )}
          >
            {line.direction === 'in' ? '+' : '−'}
            {bookMoney(line.amount)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <BookPage
      title="Cash Summary"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Cash' }]}
      shareText={shareText}
      showPrint
    >
      {isLoading ? (
        <BookLoading />
      ) : !book ? (
        <BookEmpty />
      ) : (
        <>
          <div className="flex items-baseline justify-between border-b-2 border-[color:var(--book-rule)] pb-2">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--book-ink-soft)]">
              Opening Balance
            </span>
            <span className="book-num text-sm font-black">{bookMoney(book.openingCash)}</span>
          </div>

          {book.cashLines.length === 0 ? (
            <BookEmpty message="No money moved on this day." />
          ) : (
            <>
              {cashIn.length > 0 ? (
                <>
                  <BookSection
                    title="Cash In"
                    className="!border-l-[color:var(--book-green)] !text-[color:var(--book-green)]"
                  />
                  {cashIn.map(renderLine)}
                </>
              ) : null}
              {cashOut.length > 0 ? (
                <>
                  <BookSection
                    title="Cash Out"
                    className="!border-l-[color:var(--book-red)] !text-[color:var(--book-red)]"
                  />
                  {cashOut.map(renderLine)}
                </>
              ) : null}
            </>
          )}

          {nonCashIn > 0 ? (
            <p className="mt-3 text-xs text-[color:var(--book-ink-soft)]">
              {bookMoney(nonCashIn)} came by UPI/cheque — shown faded because it is not in the drawer.
            </p>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between border-t-2 border-[color:var(--book-rule)] pt-3">
            <span className="text-xs font-black uppercase tracking-[0.1em]">Closing Balance (drawer)</span>
            <span className="book-num text-lg font-black">{bookMoney(book.closingCash)}</span>
          </div>
        </>
      )}
    </BookPage>
  );
};

export default BookCashPage;
