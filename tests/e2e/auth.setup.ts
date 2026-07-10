import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';
import { DEALER_EMAIL, DEALER_PASSWORD, getTestDb, sweepStaleE2EData } from './helpers/db';

setup('authenticate as the E2E dealer', async ({ page }) => {
  // Verify the seeded account works and clear leftovers from crashed runs.
  const db = await getTestDb();
  await sweepStaleE2EData(db);

  await page.goto('/login');
  await page.getByPlaceholder('Enter your email or mobile number').fill(DEALER_EMAIL);
  await page.getByPlaceholder('Enter your password').fill(DEALER_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();

  // A fully-onboarded dealer lands on the dashboard; /onboarding here means
  // the seed script has not stamped onboarding_progress.
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/onboarding/);

  await page.context().storageState({ path: STORAGE_STATE });
});
