import { test, expect } from '@playwright/test';

test('demo: abre dashboard (auto-login por token)', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(1200);
});
