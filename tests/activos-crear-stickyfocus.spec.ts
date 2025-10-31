import { test, expect, Locator, Page } from '@playwright/test';

test.setTimeout(180_000); // 3 min por la lentitud que comentaste

async function waitLoaderGone(page: Page) {
  const loader = page.locator(
    '[data-testid*="loader" i], [data-testid*="loading" i], ' +
    '[class*="loader" i], [class*="loading" i], [class*="spinner" i], ' +
    '[role="progressbar"]'
  );
  await loader.first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
}

async function firstVisible(page: Page, locs: Locator[], timeout = 15000) {
  for (const loc of locs) {
    try { await expect(loc).toBeVisible({ timeout }); return loc; } catch {}
  }
  return null;
}

async function stickyFocusFill(input: Locator, value: string) {
  // hace scroll, click forzado, focus y escribe con pausas
  await input.scrollIntoViewIfNeeded().catch(()=>{});
  await input.click({ force: true }).catch(()=>{});
  await input.focus().catch(()=>{});
  await input.fill('');
  await input.type(value, { delay: 20 });
  // blur para disparar validaciones
  try { await input.press('Tab'); } catch {}
}

async function pickFirstOption(page: Page) {
  const option = await firstVisible(page, [
    page.locator('[role="option"]:visible').first(),
    page.locator('.dx-list-item:visible').first(),
    page.locator('.ant-select-item-option:not(.ant-select-item-option-disabled):visible').first(),
    page.locator('.MuiAutocomplete-option:visible').first(),
    page.locator('li:visible').first(),
  ], 4000);
  if (option) { await option.click(); return true; }
  await page.keyboard.press('ArrowDown').catch(()=>{});
  await page.keyboard.press('Enter').catch(()=>{});
  return true;
}

test('crear activo (sticky focus): dashboard → Activos → Nuevo → completar y guardar', async ({ page }) => {
  const uniq = Date.now().toString();
  const nombre = `Activo demo ${uniq}`;
  const codigo = `ACT-${uniq.slice(-6)}`;

  page.on('console', m => console.log('[PAGE]', m.type(), m.text()));

  // 1) Dashboard
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await waitLoaderGone(page);

  // 2) Ir a Activos
  expect(await (async () => {
    const ok = await firstVisible(page, [
      page.getByRole('link', { name: /^Activos$/i }),
      page.getByRole('menuitem', { name: /Activos/i }),
      page.locator('nav a:has-text("Activos")'),
      page.locator('[data-testid="menu-activos"], a[href*="activo"]'),
    ]);
    if (!ok) return false;
    await ok.click();
    return true;
  })()).toBeTruthy();
  await waitLoaderGone(page);

  // 3) Nuevo Activo (puede tardar)
  expect(await (async () => {
    const nuevo = await firstVisible(page, [
      page.getByRole('button', { name: /nuevo activo/i }),
      page.getByRole('link',   { name: /nuevo activo/i }),
      page.locator('button:has-text("Nuevo Activo")'),
      page.locator('a:has-text("Nuevo Activo")'),
      page.locator('[data-testid="new-asset"], [data-testid="nuevo-activo"]'),
    ], 20000);
    if (!nuevo) return false;
    await nuevo.click({ delay: 50 });
    await waitLoaderGone(page);
    return true;
  })()).toBeTruthy();

  // 4) Contenedor del formulario
  const cont = await firstVisible(page, [
    page.getByRole('dialog'),
    page.locator('.ant-modal-content, .MuiDialog-paper, .dx-overlay-content, .drawer, .Drawer'),
    page.locator('form:visible').first(),
    page.locator('main:visible').first(),
  ], 20000);
  expect(cont, 'No encontré el contenedor del formulario de Alta').toBeTruthy();

  // 5) Completar campos de texto visibles (Nombre / Código / Descripción)
  const textInputs = cont!.locator('input[type="text"]:visible:not([readonly]):not([disabled])');
  const textCount = await textInputs.count();

  if (textCount >= 1) await stickyFocusFill(textInputs.nth(0), nombre); // Nombre
  if (textCount >= 2) await stickyFocusFill(textInputs.nth(1), codigo); // Código

  const textareas = cont!.locator('textarea:visible:not([readonly]):not([disabled])');
  if (await textareas.count()) {
    await stickyFocusFill(textareas.first(), 'Creado automáticamente por Playwright (demo).');
  }

  // 6) Combos/autocompletes: intentamos 2 para no trabarnos
  const combos = cont!.locator('[role="combobox"]:visible, .ant-select-selector:visible, .MuiSelect-select:visible, [data-testid*="select" i]:visible');
  const comboN = Math.min(await combos.count(), 2);
  for (let i = 0; i < comboN; i++) {
    try {
      const c = combos.nth(i);
      await c.scrollIntoViewIfNeeded().catch(()=>{});
      await c.click({ delay: 50 });
      await page.waitForTimeout(150);
      await pickFirstOption(page);
      await waitLoaderGone(page);
    } catch {}
  }

  // 7) Números y fecha (si existen)
  const num = cont!.locator('input[type="number"]:visible:not([readonly])').first();
  if (await num.count()) await stickyFocusFill(num, '100000');

  const date = cont!.locator('input[type="date"]:visible:not([readonly])').first();
  if (await date.count()) await stickyFocusFill(date, '2025-10-01');

  // 8) Guardar / Crear
  expect(await (async () => {
    const btn = await firstVisible(page, [
      cont!.getByRole('button', { name: /crear\s+activo/i }),
      cont!.getByRole('button', { name: /^crear$/i }),
      cont!.getByRole('button', { name: /guardar/i }),
      cont!.locator('button:has-text("Crear Activo")'),
      cont!.locator('button:has-text("Crear")'),
      cont!.locator('button:has-text("Guardar")'),
      cont!.locator('[data-testid="submit"], [data-testid="save"], [data-testid="create-asset"]'),
    ], 15000);
    if (!btn) return false;
    await btn.scrollIntoViewIfNeeded().catch(()=>{});
    await btn.click({ delay: 50 });
    return true;
  })()).toBeTruthy();

  // 9) Espera larga para el alta (me dijiste que tarda mucho)
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{});
  await waitLoaderGone(page);

  // 10) Verificación de éxito (toast o nombre)
  const ok =
    await page.locator(':text("creado"), :text("guardado"), :text("éxito"), :text("exitos")').first().isVisible().catch(()=>false)
    || await page.getByText(nombre, { exact: false }).first().isVisible().catch(()=>false)
    || await page.getByRole('heading', { name: new RegExp(nombre, 'i') }).isVisible().catch(()=>false);

  if (!ok) {
    await test.info().attach('form-state', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
  expect(ok).toBeTruthy();

  await page.waitForTimeout(2000);
});
