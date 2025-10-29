import { test, expect } from '@playwright/test';
import 'dotenv/config';

// Demo visible: abre navegador y teclea lento
test.use({ storageState: undefined, launchOptions: { headless: false, slowMo: 60 } });
test.setTimeout(120_000);

const isMs = (url: string) => /login\.microsoftonline\.com|live\.com|microsoft/i.test(url);

async function hardLogout(page: any, base: string) {
  await page.context().clearCookies().catch(()=>{});
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${base}/auth/logout`).catch(()=>{});
  // Logout global de Microsoft (por si había sesión viva)
  for (const u of [
    'https://login.microsoftonline.com/logout.srf',
    'https://login.microsoftonline.com/common/oauth2/logout',
    'https://login.microsoftonline.com/common/oauth2/v2.0/logout'
  ]) { await page.goto(u).catch(()=>{}); }
}

async function loginMicrosoft(page: any, email: string, pass: string) {
  // "Elegir cuenta" si aparece
  const pick = page.locator('div[role="button"] >> text=' + JSON.stringify(email));
  if (await pick.count()) await pick.first().click();

  // Email -> Next
  const emailInput = page.locator('input[name="loginfmt"], #i0116');
  if (await emailInput.count()) {
    await emailInput.fill(email);
    await page.locator('#idSIButton9, button:has-text("Next")').first().click();
  }

  // Password -> Sign in
  const passInput = page.locator('input[name="passwd"], #i0118');
  await passInput.waitFor({ state: 'visible', timeout: 20000 });
  await passInput.fill(pass);
  await page.locator('#idSIButton9, button:has-text("Sign in"), button:has-text("Ingresar")').first().click();

  // "Stay signed in?"
  const stay = page.locator('text=/Stay signed in\\?|¿Permanecer conectado\\?/i');
  if (await stay.count()) {
    const noBtn  = page.locator('#idBtn_Back, button:has-text("No")').first();
    const yesBtn = page.locator('#idSIButton9, button:has-text("Yes")').first();
    if (await noBtn.count()) await noBtn.click(); else if (await yesBtn.count()) await yesBtn.click();
  }

  await page.waitForLoadState('networkidle').catch(()=>{});
}

async function loginLocal(page: any, email: string, pass: string) {
  // Anclamos por el botón y subimos al bloque para usar "sus" inputs
  const submit = page.locator(
    'button:visible:has-text("Login"), button:visible:has-text("Ingresar"), button:visible:has-text("Sign in"), input[type="submit"]:visible'
  ).first();
  await submit.waitFor({ state: 'visible', timeout: 20000 });

  let scope = submit;
  for (let i = 0; i < 6; i++) scope = scope.locator('..');

  const emailInput = scope.locator(
    'input[type="email"]:visible, input[name*="email" i]:visible, input[placeholder*="email" i]:visible'
  ).first();
  const passInput  = scope.locator(
    'input[type="password"]:visible, input[name*="pass" i]:visible, input[placeholder*="password" i]:visible, input[placeholder*="contraseña" i]:visible'
  ).first();

  await emailInput.waitFor({ state: 'visible', timeout: 20000 });
  await passInput.waitFor({ state: 'visible', timeout: 20000 });

  await emailInput.fill(''); await emailInput.type(email, { delay: 50 });
  await passInput.fill('');  await passInput.type(pass,  { delay: 50 });

  await Promise.all([
    page.waitForLoadState('networkidle').catch(()=>{}),
    submit.click().catch(()=>{})
  ]);

  if (/\/auth\/login/i.test(page.url())) {
    await passInput.press('Enter');
    await page.waitForLoadState('networkidle').catch(()=>{});
  }
}

test('auto-login demo: mostrar login y entrar al dashboard', async ({ page }) => {
  const base  = (process.env.BASE_URL || '').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const pass  = (process.env.ADMIN_PASSWORD || '').trim();
  if (!base || !email || !pass) throw new Error('Faltan BASE_URL / ADMIN_EMAIL / ADMIN_PASSWORD en .env');

  await hardLogout(page, base);

  await page.goto(`${base}/auth/login?returnTo=%2Fdashboard&ts=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400); // que se vea la pantalla de login

  if (isMs(page.url())) {
    await loginMicrosoft(page, email, pass);
  } else {
    const msBtn = page.locator('button:has-text("Microsoft"), a:has-text("Microsoft"), [data-provider="microsoft"]');
    if (await msBtn.count()) {
      await msBtn.first().click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await loginMicrosoft(page, email, pass);
    } else {
      await loginLocal(page, email, pass);
    }
  }

  if (!/\/dashboard/i.test(page.url())) {
    await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(()=>{});
  }

  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(1200); // que se vea el dashboard
});
