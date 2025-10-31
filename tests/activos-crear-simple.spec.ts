import { test, expect, Locator, Page } from '@playwright/test';

test.setTimeout(120_000);

async function waitLoaderGone(page: Page) {
  const loader = page.locator(
    '[data-testid*="loader" i], [data-testid*="loading" i], ' +
    '[class*="loader" i], [class*="loading" i], [class*="spinner" i], ' +
    '[role="progressbar"]'
  );
  await loader.first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
}

async function firstVisible(page: Page, locs: Locator[], timeout = 12000) {
  for (const loc of locs) {
    try { await expect(loc).toBeVisible({ timeout }); return loc; } catch {}
  }
  return null;
}

async function clickFirst(page: Page, locs: Locator[], timeout = 12000) {
  const loc = await firstVisible(page, locs, timeout);
  if (!loc) return false;
  await loc.click();
  return true;
}

async function pickFirstOption(page: Page) {
  // DevExtreme / Ant / MUI / ARIA
  const option = await firstVisible(page, [
    page.locator('[role="option"]:visible').first(),
    page.locator('.dx-list-item:visible').first(),
    page.locator('.ant-select-item-option:not(.ant-select-item-option-disabled):visible').first(),
    page.locator('.MuiAutocomplete-option:visible').first(),
    page.locator('li:visible').first(),
    page.locator('[id*="option"]:visible').first(),
  ], 4000);
  if (option) { await option.click(); return true; }
  // Fallback por teclado
  await page.keyboard.press('ArrowDown').catch(()=>{});
  await page.keyboard.press('Enter').catch(()=>{});
  return true;
}

test('crear activo (simple): dashboard → Activos → Nuevo → completar y guardar', async ({ page }) => {
  const uniq = Date.now().toString();
  const nombre = `Activo demo ${uniq}`;
  const codigo = `ACT-${uniq.slice(-6)}`;

  page.on('console', m => console.log('[PAGE]', m.type(), m.text()));

  // 1) Dashboard
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await waitLoaderGone(page);

  // 2) Ir a Activos
  expect(await clickFirst(page, [
    page.getByRole('link', { name: /^Activos$/i }),
    page.getByRole('menuitem', { name: /Activos/i }),
    page.locator('nav a:has-text("Activos")'),
    page.locator('[data-testid="menu-activos"], a[href*="activo"]'),
  ])).toBeTruthy();
  await waitLoaderGone(page);

  // 3) Nuevo Activo
  expect(await clickFirst(page, [
    page.getByRole('button', { name: /nuevo activo/i }),
    page.getByRole('link',   { name: /nuevo activo/i }),
    page.locator('button:has-text("Nuevo Activo")'),
    page.locator('a:has-text("Nuevo Activo")'),
    page.locator('[data-testid="new-asset"], [data-testid="nuevo-activo"]'),
  ])).toBeTruthy();
  await waitLoaderGone(page);

  // 4) Agarrar contenedor del formulario (modal/drawer/region)
  const cont = await firstVisible(page, [
    page.getByRole('dialog'),
    page.locator('.ant-modal-content, .MuiDialog-paper, .dx-overlay-content, .drawer, .Drawer'),
    page.locator('form:visible').first(),          // fallback si no hay dialog
    page.locator('main:visible').first(),          // último recurso
  ]);
  expect(cont, 'No encontré el contenedor del formulario').toBeTruthy();

  // 5) Completar inputs de texto visibles (scope al contenedor)
  const textInputs = cont!.locator('input[type="text"]:visible:not([readonly]):not([disabled])');
  const textCount = await textInputs.count();
  if (textCount >= 1) await textInputs.nth(0).fill(nombre);   // Nombre
  if (textCount >= 2) await textInputs.nth(1).fill(codigo);   // Código
  // textarea (Descripción)
  const ta = cont!.locator('textarea:visible:not([readonly]):not([disabled])').first();
  if (await ta.count()) await ta.fill('Creado automáticamente por Playwright (demo).');

  // 6) Combos / autocompletes visibles → abrir y elegir 1ra opción (tomamos hasta 4 por si hay varios)
  const combos = cont!.locator('[role="combobox"]:visible, .ant-select-selector:visible, .MuiSelect-select:visible, [data-testid*="select" i]:visible');
  const comboN = Math.min(await combos.count(), 4);
  for (let i = 0; i < comboN; i++) {
    try {
      const c = combos.nth(i);
      await c.click({ delay: 50 });
      await pickFirstOption(page);
      await waitLoaderGone(page);
    } catch { /* seguimos */ }
  }

  // 7) Selects nativos
  const selects = cont!.locator('select:visible:not([disabled])');
  const selN = Math.min(await selects.count(), 3);
  for (let i = 0; i < selN; i++) {
    try { await selects.nth(i).selectOption({ index: 1 }); } catch {}
  }

  // 8) Números y fechas (si aparecen)
  // number
  const nums = cont!.locator('input[type="number"]:visible:not([readonly])');
  if (await nums.count()) { try { await nums.first().fill('100000'); } catch {} }
  // date
  const dates = cont!.locator('input[type="date"]:visible:not([readonly])');
  if (await dates.count()) {
    try { await dates.first().fill('2025-10-01'); } catch {}
  }

  // 9) Guardar / Crear dentro del contenedor
  expect(await clickFirst(page, [
    cont!.getByRole('button', { name: /crear\s+activo/i }),
    cont!.getByRole('button', { name: /^crear$/i }),
    cont!.getByRole('button', { name: /guardar/i }),
    cont!.locator('button:has-text("Crear Activo")'),
    cont!.locator('button:has-text("Crear")'),
    cont!.locator('button:has-text("Guardar")'),
    cont!.locator('[data-testid="submit"], [data-testid="save"], [data-testid="create-asset"]'),
  ])).toBeTruthy();

  await waitLoaderGone(page);

  // 10) Verificar éxito (toast o ver el nombre en la pantalla siguiente)
  const ok =
    await page.locator(':text("creado"), :text("guardado"), :text("éxito"), :text("exitos")').first().isVisible().catch(()=>false)
    || await page.getByText(nombre, { exact: false }).first().isVisible().catch(()=>false)
    || await page.getByRole('heading', { name: new RegExp(nombre, 'i') }).isVisible().catch(()=>false);

  if (!ok) {
    await test.info().attach('form-state', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
  expect(ok).toBeTruthy();

  // 11) Dejarlo visible un toque para la demo
  await page.waitForTimeout(3000);
});
