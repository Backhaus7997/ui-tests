import { test, expect } from '@playwright/test';
import 'dotenv/config';

test.use({ storageState: undefined });
test.setTimeout(120_000);

test('debug: verificar inputs usados y request de login', async ({ page }) => {
  const base = process.env.BASE_URL!;
  const emailV = (process.env.ADMIN_EMAIL || '').trim();
  const passV  = (process.env.ADMIN_PASSWORD || '').trim();

  // Limpio sesión y voy al login directo
  await page.context().clearCookies();
  await page.goto(`${base}/auth/logout`).catch(()=>{});
  await page.goto(`${base}/auth/login?returnTo=%2Fdashboard`, { waitUntil: 'domcontentloaded' });

  // 1) Tomo el botón visible (Login/Ingresar) y subo al bloque contenedor
  const submit = page.locator('button:visible:has-text("Login"), button:visible:has-text("Ingresar"), button:visible:has-text("Sign in"), input[type="submit"]:visible').first();
  await submit.waitFor({ state: 'visible', timeout: 20000 });

  let scope = submit;
  for (let i=0;i<8;i++) scope = scope.locator('..');
  // dentro del scope buscamos inputs visibles
  const email = scope.locator('input[type="email"]:visible, input[name*="email" i]:visible, input[placeholder*="email" i]:visible').first();
  const pass  = scope.locator('input[type="password"]:visible, input[name*="pass" i]:visible, input[placeholder*="password" i]:visible, input[placeholder*="contraseña" i]:visible').first();

  // Si no aparecen, probá buscar en iframes:
  if (!(await email.count()) || !(await pass.count())) {
    for (const f of page.frames()) {
      const e = f.locator('input[type="email"]:visible, input[name*="email" i]:visible').first();
      const p = f.locator('input[type="password"]:visible, input[name*="pass" i]:visible').first();
      if (await e.count() && await p.count()) { 
        await test.step('Usando inputs dentro de iframe', async () => {});
        // @ts-ignore
        // @ts-ignore
        (global as any)._email = e; (global as any)._pass = p; (global as any)._submit = f.locator('button:visible:has-text("Login"), button:visible:has-text("Ingresar"), input[type="submit"]:visible').first();
        break;
      }
    }
  }

  const E = (global as any)._email || email;
  const P = (global as any)._pass  || pass;
  const S = (global as any)._submit|| submit;

  await E.waitFor({ state: 'visible', timeout: 20000 });
  await P.waitFor({ state: 'visible', timeout: 20000 });

  // 2) Pintamos los elementos para verlos en el inspector
  await E.evaluate(el => (el as HTMLElement).style.outline = '3px solid red');
  await P.evaluate(el => (el as HTMLElement).style.outline = '3px solid blue');
  await S.evaluate(el => (el as HTMLElement).style.outline = '3px solid green');

  // 3) Escribimos “como humano” y validamos eco
  await E.click({ clickCount: 3 }); await E.fill('');
  await E.type(emailV, { delay: 50 });
  await P.click({ clickCount: 3 }); await P.fill('');
  await P.type(passV, { delay: 50 });

  const echoEmail = await E.inputValue();
  const echoPassLen = (await P.inputValue()).length;
  console.log('ECHO -> email:', echoEmail, 'passLen:', echoPassLen);

  // 4) Log de requests POST para ver si se manda algo al loguear
  const posts: Array<{url:string; body?:string}> = [];
  page.on('request', req => {
    if (req.method() === 'POST') posts.push({ url: req.url(), body: (req.postData() || '').slice(0,300) });
  });

  // 5) Enviar
  await S.click();
  await page.waitForLoadState('networkidle').catch(()=>{});
  if (/\/auth\/login/i.test(page.url())) {
    await P.press('Enter');
    await page.waitForLoadState('networkidle').catch(()=>{});
  }

  console.log('POSTs tras submit:', posts);

  // 6) Resultado
  if (/\/auth\/login/i.test(page.url())) {
    await page.screenshot({ path: 'login-debug.png', fullPage: true }).catch(()=>{});
    throw new Error('Sigo en login. Mirá login-debug.png y la consola para ver ECHO y POSTs.');
  }

  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
});
