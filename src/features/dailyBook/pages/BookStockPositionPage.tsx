import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BookPage, bookDateLabel, useBookDate } from '../components/BookPage';
import { BookEmpty, BookLoading, BookSection } from '../components/bookUi';
import { useStockPosition } from '../hooks/useDailyBook';
import type { BookStockPositionRow } from '../types';

const GRID = 'grid grid-cols-[minmax(0,1fr)_3.5rem_3rem_3.5rem_3.5rem] items-baseline gap-x-2';

const Num: React.FC<{ value: number; strong?: boolean }> = ({ value, strong }) => (
  <span
    className={cn(
      'book-num text-right text-xs',
      strong ? 'font-black' : 'font-semibold',
      value === 0 && !strong && 'text-[color:var(--book-ink-soft)] opacity-60'
    )}
  >
    {value}
  </span>
);

const PositionRow: React.FC<{
  row: BookStockPositionRow;
  date: string;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ row, date, navigate }) => (
  <button
    type="button"
    onClick={() =>
      navigate(`/inventory/${row.inventoryId}`, {
        state: { from: `/book/stock-position?date=${date}` },
      })
    }
    className="book-row book-row--tap focus-ring w-full text-left"
  >
    <div className={GRID}>
      <span className="truncate text-sm font-extrabold">{row.name}</span>
      <Num value={row.opening} />
      <Num value={row.sold} />
      <Num value={row.received} />
      <Num value={row.closing} strong />
    </div>
  </button>
);

export const BookStockPositionPage: React.FC = () => {
  const date = useBookDate();
  const navigate = useNavigate();
  const { data: rows, isLoading } = useStockPosition(date);

  const moved = (rows || []).filter((r) => r.sold + r.received > 0);
  const idle = (rows || []).filter((r) => r.sold + r.received === 0);

  const shareText = moved.length
    ? `📦 Stock Position — ${bookDateLabel(date)}\n` +
      moved
        .map((r) => `${r.name}: ${r.opening} → ${r.closing} (sold ${r.sold}, received ${r.received})`)
        .join('\n')
    : undefined;

  return (
    <BookPage
      title="Stock Position"
      date={date}
      backTo={`/book?date=${date}`}
      crumbs={[{ label: 'Daily Book', to: `/book?date=${date}` }, { label: 'Stock Position' }]}
      shareText={shareText}
      showPrint
    >
      {isLoading ? (
        <BookLoading />
      ) : !rows || rows.length === 0 ? (
        <BookEmpty message="No products in inventory yet." />
      ) : (
        <>
          {/* Column headers */}
          <div
            className={cn(
              GRID,
              'border-b border-[color:var(--book-rule)] pb-1.5 pt-1 text-[0.6rem] font-black uppercase tracking-[0.1em] text-[color:var(--book-ink-soft)]'
            )}
          >
            <span>Product</span>
            <span className="text-right">Opening</span>
            <span className="text-right">Sold</span>
            <span className="text-right">Received</span>
            <span className="text-right">Closing</span>
          </div>

          {moved.length > 0 ? (
            <>
              <BookSection title="Moved Today" />
              {moved.map((row) => (
                <PositionRow key={row.inventoryId} row={row} date={date} navigate={navigate} />
              ))}
            </>
          ) : (
            <BookEmpty message="No stock moved on this day." />
          )}

          {idle.length > 0 ? (
            <>
              <BookSection title="No Movement" className="opacity-80" />
              {idle.map((row) => (
                <PositionRow key={row.inventoryId} row={row} date={date} navigate={navigate} />
              ))}
            </>
          ) : null}

          <p className="book-no-print mt-4 text-center text-xs font-bold text-[color:var(--book-green)]">
            Tap any product to see full stock history
          </p>
        </>
      )}
    </BookPage>
  );
};

export default BookStockPositionPage;
