import { test } from '@playwright/test';
import path from 'path';

test('capture login and register screenshots', async ({ page }) => {
  // Login Page
  await page.goto('/login');
  await page.waitForTimeout(1000); // wait for transitions
  await page.screenshot({
    path: 'C:/Users/N.yaswanth Reddy/.gemini/antigravity/brain/211dfac5-451b-4414-a007-8b24e0ff7653/login_screenshot.png',
    fullPage: true
  });

  // Register Page
  await page.goto('/register');
  await page.waitForTimeout(1000); // wait for transitions
  await page.screenshot({
    path: 'C:/Users/N.yaswanth Reddy/.gemini/antigravity/brain/211dfac5-451b-4414-a007-8b24e0ff7653/register_screenshot.png',
    fullPage: true
  });
});
