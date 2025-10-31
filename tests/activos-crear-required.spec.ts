import { test, expect, Page, Locator } from '@playwright/test';

test.setTimeout(120_000); // 2 minutos

// ---- helpers ----
async function waitLoaderGone(page: Page) {
  const loader = page.locator(
    '[data-testid*="loader" i], [data-testid*="loading" i], ' +
    '[class*="loader" i], [class*="loading" i], [class*="spinner" i], ' +
    '[role="progressbar"]'
  );
  await loader.first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
}

async function firstVisible(page: Page, locs: Locator[], timeout = 10_000) {
  for (const loc of locs) {
    try { await expect(loc).toBeVisible({ timeout }); return loc; } catch {}
  }
  return null;
}

async function clickFirst(page: Page, locs: Locator[], timeout = 10_000) {
  const loc = await firstVisible(page, locs, timeout);
  if (!loc) return false;
  await loc.click();
  return true;
}

// Campos de texto "planos"
async function fillByLabel(page: Page, labels: RegExp[], value: string) {
  const cands: Locator[] = [];
  for (const re of labels) {
    cands.push(page.getByLabel(re));
    cands.push(page.getByPlaceholder(re));
    cands.push(page.getByRole('textbox', { name: re }));
  }
  // fallbacks genéricos
  cands.push(page.locator('input[type="text"]:visible').first());
  const loc = await firstVisible(page, cands, 8_000);
  if (!loc) return false;
  await loc.fill('');
  await loc.type(value);
  return true;
}

// Autocomplete/combobox (texto que abre lista de opciones)
async function pickFromAutocomplete(page: Page, labels: RegExp[], typed = 'a') {
  const openers: Locator[] = [];
  for (const re of labels) {
    openers.push(page.getByRole('combobox', { name: re }));
    openers.push(page.getByLabel(re));
    openers.push(page.getByPlaceholder(re));
    openers.push(page.getByRole('textbox', { name: re }));
  }
  // fallbacks comunes
  openers.push(page.locator('[data-testid*="select" i]:visible'));
  openers.push(page.locator('.ant-select-selector:visible, .MuiSelect-select:visible'));
  const input = await firstVisible(page, openers, 8_000);
  if (!input) return false;

  await input.click({ delay: 50 });
  // escribir algo para disparar opciones (si es textbox)
  await input.fill('').catch(() => {});
  await input.type(typed).catch(() => {});

  // esperar y elegir primera opción visible (DevExtreme/Ant/MUI)
  const option = await firstVisible(page, [
    page.locator('[role="option"]:visible').first(),
    page.locator('.dx-list-item:visible').first(),
    page.locator('.ant-select-item-option:not(.ant-select-item-option-disabled):visible').first(),
    page.locator('.MuiAutocomplete-option:visible').first(),
    page.locator('li:visible').first(),
  ], 5_000);

  if (option) {
    await option.click();
    return true;
  }

  // fallback por teclado
  await page.keyboard.press('ArrowDown').catch(()=>{});
  await page.keyboard.press('Enter').catch(()=>{});
  return true;
}

// Número y fecha
async function setNumber(page: Page, labels: RegExp[], value: string) {
  const cands: Locator[] = [];
  for (const re of labels) {
    cands.push(page.getByLabel(re));
    cands.push(page.getByPlaceholder(re));
  }
  cands.push(page.locator('input[type="number"]:visible'));
  const loc = await firstVisible(page, cands, 8_000);
  if (!loc) return false;
  await loc.fill('');
  await loc.type(value);
  return true;
}

async function setDate(page: Page, labels: RegExp[], human: string, iso: string) {
  const cands: Locator[] = [];
  for (const re of labels) {
    cands.push(page.getByLabel(re));
    cands.push(page.getByPlaceholder(re));
  }
  cands.push(page.locator('input[type="date"]:visible'));
  const loc = await firstVisible(page, cands, 8_000);
  if (!loc) return false;
  await loc.fill('');
  try { await loc.type(human); return true; } catch {}
  try { await loc.fill(''); await loc.type(iso); return true; } catch {}
  return false;
}

// ---- test ----
test('crear activo (requeridos): dashboard → Activos → Nuevo → completar y crear', async ({ page }) => {
  const uniq = Date.now().toString();
  const nombre = `Activo demo ${uniq}`;
  const codigo = `ACT-${uniq.slice(-6)}`;

  page.on('console', m => console.log('[PAGE]', m.type(), m.text()));

  await test.step('Dashboard', async () => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await waitLoaderGone(page);
  });

  await test.step('Ir a Activos', async () => {
    const ok = await clickFirst(page, [
      page.getByRole('link', { name: /^Activos$/i }),
      page.getByRole('menuitem', { name: /Activos/i }),
      page.locator('nav a:has-text("Activos")'),
      page.locator('[data-testid="menu-activos"], a[href*="activo"]'),
    ], 12_000);
    expect(ok).toBeTruthy();
    await waitLoaderGone(page);
  });

  await test.step('Nuevo Activo', async () => {
    const ok = await clickFirst(page, [
      page.getByRole('button', { name: /nuevo activo/i }),
      page.getByRole('link',   { name: /nuevo activo/i }),
      page.locator('button:has-text("Nuevo Activo")'),
      page.locator('a:has-text("Nuevo Activo")'),
      page.locator('[data-testid="new-asset"], [data-testid="nuevo-activo"]'),
    ], 12_000);
    expect(ok).toBeTruthy();
    await waitLoaderGone(page);
  });

  await test.step('Completar campos mínimos', async () => {
    // Texto plano
    expect(await fillByLabel(page, [/^nombre(\s+del\s+activo)?$/i, /^name$/i, /t(í|i)tulo/i], nombre)).toBeTruthy();
    expect(await fillByLabel(page, [/^c(ó|o)digo$/i, /^code$/i], codigo)).toBeTruthy();
    await fillByLabel(page, [/^descripci(ó|o)n$/i, /^description$/i], 'Creado automáticamente por Playwright (demo).');

    // Autocompletes (abre y elige primera opción)
    await pickFromAutocomplete(page, [/^categor(í|i)a$/i, /^tipo$/i, /clase/i], 'a');
    await pickFromAutocomplete(page, [/^ubicaci(ó|o)n$/i, /^location$/i], 'a');
    await pickFromAutocomplete(page, [/^responsable$/i, /asignado a/i, /t(é|e)cnico/i], 'a');
    await pickFromAutocomplete(page, [/^proveedor$/i, /supplier/i], 'a');
    await pickFromAutocomplete(page, [/^estado$/i, /^status$/i], 'a');

    // Fechas / números (si existen)
    await setDate(page, [/^fecha(\s+de)?\s+(compra|alta)$/i, /^fecha$/i, /^date$/i], '01/10/2025', '2025-10-01').catch(()=>{});
    await setNumber(page, [/^costo$/i, /^precio$/i, /^valor$/i, /monto/i], '100000').catch(()=>{});
    await setNumber(page, [/^vida\s*útil/i, /^vida\s*util/i, /(meses|months)/i], '12').catch(()=>{});
  });

  await test.step('Crear/Guardar', async () => {
    const ok = await clickFirst(page, [
      page.getByRole('button', { name: /crear\s+activo/i }),
      page.getByRole('button', { name: /^crear$/i }),
      page.getByRole('button', { name: /guardar/i }),
      page.locator('button:has-text("Crear Activo")'),
      page.locator('button:has-text("Crear")'),
      page.locator('button:has-text("Guardar")'),
      page.locator('[data-testid="submit"], [data-testid="save"], [data-testid="create-asset"]'),
    ], 12_000);
    expect(ok).toBeTruthy();
  });

  await test.step('Verificación', async () => {
    await waitLoaderGone(page);
    const ok =
      await page.locator(':text("creado"), :text("guardado"), :text("éxito"), :text("exitos")').first().isVisible().catch(()=>false)
      || await page.getByText(nombre, { exact: false }).first().isVisible().catch(()=>false)
      || await page.getByRole('heading', { name: new RegExp(nombre, 'i') }).isVisible().catch(()=>false);

    if (!ok) {
      await test.info().attach('form-state', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
    expect(ok).toBeTruthy();
    await page.waitForTimeout(3000);
  });
});
