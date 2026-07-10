import { test as base, expect, Locator, Page } from '@playwright/test';
import { getTestDb, TestData } from './helpers/db';

interface Fixtures {
  /** Per-test data factory; everything it creates is deleted on teardown. */
  data: TestData;
}

export const test = base.extend<Fixtures>({
  data: async ({}, use, testInfo) => {
    const db = await getTestDb();
    const tag = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
    const data = new TestData(db, tag);
    try {
      await use(data);
    } finally {
      await data.cleanup();
    }
  },
});

export { expect };

/**
 * Several controls render twice (mobile + desktop layouts) with identical
 * accessible names; only one is visible at the current viewport.
 */
export function visibleButton(page: Page, name: string | RegExp): Locator {
  return page.getByRole('button', { name }).filter({ visible: true }).first();
}

export const money = (value: unknown) => Number(value ?? 0);
