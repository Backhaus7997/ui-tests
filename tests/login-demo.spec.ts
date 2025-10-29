import { test, expect } from '@playwright/test';
import 'dotenv/config';

// este spec no usa sesiones guardadas
test.use({ storageState: undefined });
test.setTimeout(90_000);

test('demo: login si hace falta (o ya logueado)', async ({ page }) => {
  const base = (process.env.BASE_URL || '').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const pass  = (process.env.ADMIN_PASSWORD || '').trim();

  await page.goto(`${base}/auth/login?returnTo=%2Fdashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(()=>{});

  // 👉 si ya estás dentro, mostrar dashboard y listo
  if (/\/dashboard/i.test(page.url())) {
    console.log('Ya estabas logueado; muestro el dashboard.');
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1000);
    return;
  }

  // caso login local simple (si aparece)
  const emailInput = page.getByRole('textbox', { name: /email/i })
    .or(page.locator('input[type="email"], input[name*="email" i]')).first();
  const passInput  = page.getByRole('textbox', { name: /password|contraseña/i })
    .or(page.locator('input[type="password"], input[name*="pass" i]')).first();
  const submit     = page.getByRole('button', { name: /login|ingresar|sign in/i })
    .or(page.locator('button[type="submit"], input[type="submit"]')).first();

  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await passInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);
  await passInput.fill(pass);

  await Promise.all([
    page.waitForLoadState('networkidle').catch(()=>{}),
    submit.click().catch(()=>{})
  ]);

  if (!/\/dashboard/i.test(page.url())) {
    await passInput.press('Enter');
    await page.waitForLoadState('networkidle').catch(()=>{});
  }

  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(800);
});
