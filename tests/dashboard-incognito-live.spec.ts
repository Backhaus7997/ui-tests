import { test, expect } from '@playwright/test';
import 'dotenv/config';

/** Abre el navegador en modo incógnito usando tu storageState (sesión guardada).
 *  Nota: usa el Chromium de Playwright (no necesita --channel).
 */
test.use({
  storageState: 'storageState.json',
  headless: false,
  launchOptions: { args: ['--incognito'] },
});

test('live: dashboard en incógnito con sesión guardada', async ({ page }) => {
  const base = (process.env.BASE_URL || '').trim();
  await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(1200); // que se vea un toque
});
