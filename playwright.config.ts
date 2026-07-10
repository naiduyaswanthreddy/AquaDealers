import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Optional overrides for the E2E suite (Supabase target + test dealer creds).
// See .env.e2e.example. Falls back to the live project baked into the app.
dotenv.config({ path: path.resolve(import.meta.dirname, '.env.e2e') });

export const STORAGE_STATE = path.resolve(
  import.meta.dirname,
  'playwright/.auth/dealer.json'
);

export default defineConfig({
  testDir: './tests',
  // The money-path suite shares one dealer account and the backend rate-limits
  // writes per user (30/min), so everything runs on a single worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /e2e[\\/]auth\.setup\.ts/,
    },
    {
      // Money-critical flows: billing, stock purchase, farmer payment.
      // Requires a seeded test dealer — see scripts/seed-test-dealer.mjs.
      name: 'e2e',
      testMatch: /e2e[\\/].*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'chromium',
      testIgnore: /e2e[\\/]/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      testIgnore: /e2e[\\/]/,
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      ...(process.env.VITE_SUPABASE_URL
        ? { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL }
        : {}),
      ...(process.env.VITE_SUPABASE_ANON_KEY
        ? { VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY }
        : {}),
    },
  },
});
