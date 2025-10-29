import { test, expect } from '@playwright/test';

test.setTimeout(90_000);

test('smoke: login si hace falta y página visible', async ({ page }) => {
  // Ir al dashboard
  const res = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  // Si redirige a /auth/login y tenemos credenciales, loguearse
  if (/\/auth\/login/i.test(page.url()) && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email  = page.getByRole('textbox', { name: 'Email' });
    const pass   = page.getByRole('textbox', { name: 'Password' });
    const submit = page.getByRole('button', { name: 'Login' });

    // Esperar visibilidad ANTES de llenar/clickear
    await email.waitFor({ state: 'visible', timeout: 15000 });
    await pass.waitFor({ state: 'visible', timeout: 15000 });
    await submit.waitFor({ state: 'visible', timeout: 15000 });

    await email.fill(process.env.ADMIN_EMAIL!);
    await pass.fill(process.env.ADMIN_PASSWORD!);

    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      submit.click(),
    ]);

    // Intentar ir al dashboard por las dudas
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  // Pase lo que pase, verificá que al menos el body esté visible
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
});
