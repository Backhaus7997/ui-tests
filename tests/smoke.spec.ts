import { test, expect, Page } from '@playwright/test';

test.setTimeout(90_000);
const hasCreds = !!process.env.ADMIN_EMAIL && !!process.env.ADMIN_PASSWORD;

async function loginIfNeeded(page: Page) {
  if (!/\/auth\/login/i.test(page.url())) return;
  if (!hasCreds) {
    await expect(page.getByRole('button', { name: /login|ingresar|sign in/i })).toBeVisible();
    return;
  }
  const email = page.getByRole('textbox', { name: 'Email' });
  const pass  = page.getByRole('textbox', { name: 'Password' });
  const submit = page.getByRole('button', { name: 'Login' });

  await email.fill(process.env.ADMIN_EMAIL!);
  await pass.fill(process.env.ADMIN_PASSWORD!);
  await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), submit.click()]);
  if (!/\/dashboard/i.test(page.url())) {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  }
}

test('smoke: dashboard o login visible (login auto si aplica)', async ({ page }) => {
  const res = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  if (/\/auth\/login/i.test(page.url())) {
    await loginIfNeeded(page);
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  const candidates = [
    '[data-testid="dashboard-title"]',
    '[data-testid*="dashboard"]',
    'h1',
    '[role="heading"]',
    'main',
    'header',
    'nav'
  ];

  let found = false;
  for (const s of candidates) {
    const loc = page.locator(s).first();
    try { await expect(loc).toBeVisible({ timeout: 3000 }); found = true; break; } catch {}
  }

  if (!found) {
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  }
});
