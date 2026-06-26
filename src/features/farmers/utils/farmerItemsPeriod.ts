import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns';
import type { FarmerItemsPeriod } from '../types/farmerItems';

const toDateInput = (date: Date) => format(date, 'yyyy-MM-dd');

export const FARMER_ITEMS_PERIODS: Array<{ value: FarmerItemsPeriod; label: string }> = [
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-season', label: 'This Season' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export function getFarmerItemsPeriodRange(
  period: FarmerItemsPeriod,
  stockingDate?: string | null,
  today = new Date()
): { startDate: string; endDate: string } {
  const endDate = toDateInput(today);

  switch (period) {
    case 'this-week':
      return {
        startDate: toDateInput(startOfWeek(today, { weekStartsOn: 1 })),
        endDate: toDateInput(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case 'this-month':
      return { startDate: toDateInput(startOfMonth(today)), endDate: toDateInput(endOfMonth(today)) };
    case 'last-month': {
      const previousMonth = subMonths(today, 1);
      return {
        startDate: toDateInput(startOfMonth(previousMonth)),
        endDate: toDateInput(endOfMonth(previousMonth)),
      };
    }
    case 'this-season':
      return { startDate: stockingDate || toDateInput(subMonths(today, 3)), endDate };
    case 'last-6-months':
      return { startDate: toDateInput(subMonths(today, 6)), endDate };
    case 'this-year':
      return { startDate: toDateInput(startOfYear(today)), endDate };
    case 'custom':
      return { startDate: toDateInput(subMonths(today, 3)), endDate };
    case 'last-3-months':
    default:
      return { startDate: toDateInput(subMonths(today, 3)), endDate };
  }
}
