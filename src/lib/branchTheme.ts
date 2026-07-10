/**
 * Branch theme colors. Each branch can pick one; the active branch's color
 * becomes the app's primary color (headers, buttons, accents) so the dealer
 * always sees at a glance which shop they are working in.
 *
 * The default AquaDealers blue is listed first and used whenever a branch has
 * no color set or "All Shops" is selected.
 */

export interface BranchColorOption {
  value: string; // stored in branches.color (the primary hex)
  label: string;
  primary: string;
  light: string;
  dark: string;
}

export const DEFAULT_BRANCH_COLOR: BranchColorOption = {
  value: '#0052cc',
  label: 'Aqua Blue (Default)',
  primary: '#0052cc',
  light: '#3385ff',
  dark: '#003380',
};

export const BRANCH_COLORS: BranchColorOption[] = [
  DEFAULT_BRANCH_COLOR,
  { value: '#16a34a', label: 'Green', primary: '#16a34a', light: '#4ade80', dark: '#15803d' },
  { value: '#ea580c', label: 'Orange', primary: '#ea580c', light: '#fb923c', dark: '#c2410c' },
  { value: '#0e7f8a', label: 'Teal', primary: '#0e7f8a', light: '#2fb3bf', dark: '#0b5566' },
  { value: '#7c3aed', label: 'Purple', primary: '#7c3aed', light: '#a78bfa', dark: '#5b21b6' },
  { value: '#e11d48', label: 'Rose', primary: '#e11d48', light: '#fb7185', dark: '#9f1239' },
  { value: '#334155', label: 'Slate', primary: '#334155', light: '#64748b', dark: '#1e293b' },
];

export const getBranchColorOption = (color?: string | null): BranchColorOption =>
  BRANCH_COLORS.find((c) => c.value === color) || DEFAULT_BRANCH_COLOR;

/**
 * Applies (or resets) the branch color by overriding the theme's primary CSS
 * variables. Passing null/undefined/the default restores the stylesheet values.
 */
export function applyBranchTheme(color?: string | null): void {
  const root = document.documentElement;

  if (!color || color === DEFAULT_BRANCH_COLOR.value) {
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-primary-light');
    root.style.removeProperty('--color-primary-dark');
    return;
  }

  const option = getBranchColorOption(color);
  root.style.setProperty('--color-primary', option.primary);
  root.style.setProperty('--color-primary-light', option.light);
  root.style.setProperty('--color-primary-dark', option.dark);
}
