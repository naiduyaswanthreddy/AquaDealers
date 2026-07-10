import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Printer, Share2 } from 'lucide-react';
import { cn, getLocalDateString } from '@/lib/utils';
import { Calendar } from '@/components/ui/Calendar';
import { shiftDate } from '../hooks/useDailyBook';

export function useBookDate(): string {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get('date');
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getLocalDateString();
}

export const bookDateLabel = (date: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export const bookTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');

export interface BookCrumb {
  label: string;
  to?: string;
}

interface BookPageProps {
  title: string;
  date: string;
  crumbs?: BookCrumb[];
  shareText?: string;
  showPrint?: boolean;
  backTo?: string;
  children: React.ReactNode;
}

/**
 * The shared "page in a register" shell: cream paper, ruled top bar,
 * breadcrumb, and a page-turn animation on every navigation.
 */
export const BookPage: React.FC<BookPageProps> = ({
  title,
  date,
  crumbs,
  shareText,
  showPrint,
  backTo,
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleBack = () => {
    // Prefer real history back so the reader returns to the exact page they
    // came from (product → farmer → bill unwinds correctly). backTo is only
    // the fallback for deep links opened fresh.
    const historyIndex = (window.history.state && window.history.state.idx) || 0;
    if (historyIndex > 0) {
      navigate(-1);
    } else {
      navigate(backTo || `/book?date=${date}`);
    }
  };

  const handleDatePicked = (picked: string) => {
    setCalendarOpen(false);
    if (!picked || picked === date) return;
    // Stay on the same book page, just turn to the chosen day.
    navigate(`${location.pathname}?date=${picked}`, { replace: true });
  };

  const handleShare = () => {
    if (!shareText) return;
    const encoded = encodeURIComponent(shareText);
    if (navigator.share) {
      navigator.share({ text: shareText }).catch(() => {
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
      });
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  // Swipe right anywhere on the page turns back, like flipping to the
  // previous page of a physical register.
  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx > 72 && Math.abs(dx) > Math.abs(dy) * 2) handleBack();
  };

  const visibleCrumbs = crumbs && crumbs.length > 3 ? [{ label: '…' }, ...crumbs.slice(-2)] : crumbs;

  return (
    <div className="book-paper">
      <div
        className="book-sheet mx-auto w-full max-w-3xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div key={location.pathname + location.search} className="book-page-enter px-4 pb-24 pt-4 lg:px-8 lg:pb-12">
          {/* Header: back / centered title + date / actions, over a double teal rule */}
          <div className="book-head pb-2.5">
            <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-start gap-1 sm:grid-cols-[4.5rem_1fr_4.5rem]">
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back"
                className="book-no-print focus-ring -ml-1 mt-0.5 h-9 w-9 justify-self-start rounded-lg p-2 hover:bg-[rgba(212,201,168,0.3)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0 text-center">
                <h1 className="book-serif truncate text-lg font-bold uppercase tracking-[0.14em] text-[color:var(--book-accent)]">
                  {title}
                </h1>
                <button
                  type="button"
                  onClick={() => setCalendarOpen(true)}
                  aria-label="Pick a date"
                  title="Pick a date"
                  className="focus-ring mt-0.5 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 hover:bg-[rgba(212,201,168,0.3)]"
                >
                  <span className="text-xs font-bold tracking-[0.04em] text-[color:var(--book-ink-soft)]">
                    {bookDateLabel(date)}
                  </span>
                  <ChevronDown className="book-no-print h-3.5 w-3.5 text-[color:var(--book-ink-soft)]" />
                </button>
              </div>

              <div className="flex items-center gap-1 justify-self-end">
                {showPrint ? (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    aria-label="Print this page"
                    className="book-no-print focus-ring mt-0.5 rounded-lg p-2 hover:bg-[rgba(212,201,168,0.3)]"
                  >
                    <Printer className="h-4.5 w-4.5" />
                  </button>
                ) : null}
                {shareText ? (
                  <button
                    type="button"
                    onClick={handleShare}
                    aria-label="Share this page"
                    className="book-no-print focus-ring mt-0.5 rounded-lg p-2 hover:bg-[rgba(212,201,168,0.3)]"
                  >
                    <Share2 className="h-4.5 w-4.5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          {visibleCrumbs && visibleCrumbs.length > 1 ? (
            <div className="book-no-print book-rule-thin flex items-center gap-1 overflow-x-auto py-2 text-xs font-semibold text-[color:var(--book-ink-soft)]">
              {visibleCrumbs.map((crumb, idx) => (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {idx > 0 ? <span className="shrink-0 opacity-60">›</span> : null}
                  {crumb.to ? (
                    <Link to={crumb.to} className="shrink-0 whitespace-nowrap hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="shrink-0 whitespace-nowrap text-[color:var(--book-ink)]">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : null}

          <div className="pt-3">{children}</div>
        </div>
      </div>

      {/* The same calendar used everywhere else in the app, opened as a modal. */}
      {calendarOpen
        ? createPortal(
            <div className="book-no-print fixed inset-0 z-[99] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => setCalendarOpen(false)} aria-hidden="true" />
              <div className="relative z-[100] animate-in fade-in zoom-in-95 duration-200">
                <Calendar value={date} maxDate={getLocalDateString()} onChange={handleDatePicked} />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

/**
 * ← Yesterday   [TODAY]   Tomorrow → — the date pager at the bottom of the index page.
 * Date flips REPLACE the history entry: flipping through a week of pages and
 * pressing back must not replay every date, it should leave the book in one step.
 */
export const BookDateNav: React.FC<{ date: string; basePath?: string }> = ({ date, basePath = '/book' }) => {
  const navigate = useNavigate();
  const today = getLocalDateString();
  const isToday = date === today;

  return (
    <div className="book-no-print mt-6 flex items-center justify-between border-t-2 border-[color:var(--book-rule)] pt-4 text-sm font-bold">
      <button
        type="button"
        onClick={() => navigate(`${basePath}?date=${shiftDate(date, -1)}`, { replace: true })}
        className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-[rgba(212,201,168,0.25)]"
      >
        <ChevronLeft className="h-4 w-4" /> Yesterday
      </button>
      {!isToday ? (
        <button
          type="button"
          onClick={() => navigate(basePath, { replace: true })}
          className="focus-ring rounded-full border-2 border-[color:var(--book-accent)] px-4 py-1 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--book-accent)] hover:bg-[rgba(22,101,92,0.08)]"
        >
          Today
        </button>
      ) : (
        <span className="rounded-full bg-[color:var(--book-accent)] px-4 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#fdf8e9]">
          Today
        </span>
      )}
      <button
        type="button"
        onClick={() => navigate(`${basePath}?date=${shiftDate(date, 1)}`, { replace: true })}
        disabled={isToday}
        className={cn(
          'focus-ring flex items-center gap-1 rounded-lg px-2 py-1.5',
          isToday ? 'cursor-not-allowed opacity-40' : 'hover:bg-[rgba(212,201,168,0.25)]'
        )}
      >
        Tomorrow <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
