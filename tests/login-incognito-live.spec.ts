import { test, expect } from '@playwright/test';
import 'dotenv/config';

/** Abre Chrome en incógnito SIN usar sesión, para mostrar la pantalla de login
 *  y dejarte loguear a mano en vivo (con el inspector).
 */
test.use({
  storageState: undefined,
  headless: false,
  channel: 'chrome',
  launchOptions: { args: ['--incognito'] },
});

test('live: mostrar login en incógnito y entrar', async ({ page }) => {
  const base = (process.env.BASE_URL || '').trim();
  // ir directo al login
  await page.goto(`${base}/auth/login?returnTo=%2Fdashboard`, { waitUntil: 'domcontentloaded' });

  // PAUSA: vos completás el login en la ventana
  await page.pause();

  // cuando toques "Resume", validamos el dashboard
  await page.waitForURL(/\/dashboard/i, { timeout: 60000 });
  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(1200);
});
