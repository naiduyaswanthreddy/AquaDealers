import { format, formatDistanceToNow, differenceInDays, addDays, parseISO, isToday, isYesterday } from 'date-fns';

/**
 * Format a number as Indian Rupees: ₹1,00,000
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date as DD-MM-YYYY
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd-MM-yyyy');
}

/**
 * Format date and time as DD-MM-YYYY HH:mm
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd-MM-yyyy HH:mm');
}

/**
 * Format as relative date: 'today', 'yesterday', '3 days ago', etc.
 */
export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;

  if (isToday(d)) return 'today';
  if (isYesterday(d)) return 'yesterday';

  const days = differenceInDays(new Date(), d);
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Classname joiner — filters out falsy values and joins with space
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Convert text into a URL-safe slug.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get initials from a name (first letter of first two words)
 */
export function getInitials(name: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Estimate harvest date by adding 120 days to stocking date
 */
export function estimateHarvestDate(stockingDate: Date): Date {
  return addDays(stockingDate, 120);
}

/**
 * Get number of days a payment is overdue (negative = not yet due)
 */
export function getDaysOverdue(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return differenceInDays(new Date(), d);
}

/**
 * Get ageing bucket label from number of days
 */
export function getAgeingBucket(days: number): '0-30' | '31-60' | '61-90' | '90+' {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/**
 * Simple hash function for the PIN (SHA-256 via Web Crypto API).
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
