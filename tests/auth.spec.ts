import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*login/);

    await expect(page.getByText('AquaDealer')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in to your shop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});

test.describe('Admin Authentication', () => {
  test('loads admin login page', async ({ page }) => {
    await page.goto('/admin/login');

    await expect(page).toHaveURL(/.*admin\/login/);
    await expect(page.getByText('Admin Portal')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});
