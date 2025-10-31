import { test, expect, Page, Locator } from '@playwright/test';

async function waitLoaderGone(page: Page) {
  const loader = page.locator(
    '[data-testid*="loader" i], [data-testid*="loading" i], ' +
    '[class*="loader" i], [class*="loading" i], [class*="spinner" i], ' +
    '[role="progressbar"]'
  );
  await loader.first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
}

async function firstVisible(page: Page, locs: Locator[], timeout = 8000) {
  for (const loc of locs) {
    try { await expect(loc).toBeVisible({ timeout }); return loc; } catch {}
  }
  return null;
}

async function clickFirst(page: Page, locs: Locator[], timeout = 8000) {
  const loc = await firstVisible(page, locs, timeout);
  if (!loc) return false;
  await loc.click();
  return true;
}

async function fillTextByHints(page: Page, hints: RegExp[], value: string, timeout = 6000) {
  const candidates: Locator[] = [];
  for (const h of hints) {
    candidates.push(page.getByLabel(h));
    candidates.push(page.getByPlaceholder(h));
    candidates.push(page.getByRole('textbox', { name: h }));
  }
  // Fallbacks por name/aria-label/placeholder
  candidates.push(page.locator('input[name*="nombre" i], input[aria-label*="nombre" i], input[placeholder*="nombre" i]').first());
  candidates.push(page.locator('input[name*="codigo" i], input[aria-label*="código" i], input[placeholder*="código" i]').first());
  const loc = await firstVisible(page, candidates, timeout);
  if (!loc) return false;
  await loc.click();
  await loc.fill('');
  await loc.fill(value);
  return true;
}

async function fillTextAreaByHints(page: Page, hints: RegExp[], value: string, timeout = 6000) {
  const candidates: Locator[] = [];
  for (const h of hints) {
    candidates.push(page.getByLabel(h));
    candidates.push(page.getByPlaceholder(h));
    candidates.push(page.getByRole('textbox', { name: h }));
  }
  candidates.push(page.locator('textarea'));
  const loc = await firstVisible(page, candidates, timeout);
  if (!loc) return false;
  await loc.click();
  await loc.fill('');
  await loc.fill(value);
  return true;
}

async function setNumberByHints(page: Page, hints: RegExp[], value: string, timeout = 6000) {
  const candidates: Locator[] = [];
  for (const h of hints) {
    candidates.push(page.getByLabel(h));
    candidates.push(page.getByPlaceholder(h));
  }
  candidates.push(page.locator('input[type="number"]'));
  const loc = await firstVisible(page, candidates, timeout);
  if (!loc) return false;
  await loc.click();
  await loc.fill('');
  await loc.type(value);
  return true;
}

async function setDateByHints(page: Page, hints: RegExp[], value: { human: string, iso: string }, timeout = 6000) {
  const candidates: Locator[] = [];
  for (const h of hints) {
    candidates.push(page.getByLabel(h));
    candidates.push(page.getByPlaceholder(h));
  }
  candidates.push(page.locator('input[type="date"]'));
  const loc = await firstVisible(page, candidates, timeout);
  if (!loc) return false;
  await loc.click();
  // intento 1: formato humano (DD/MM/AAAA)
  try { await loc.fill(''); await loc.type(value.human); return true; } catch {}
  // intento 2: ISO (AAAA-MM-DD)
  try { await loc.fill(''); await loc.type(value.iso); return true; } catch {}
  return false;
}

async function selectFirstOption(page: Page, container: Locator) {
  // Intenta abrir (combobox o select custom)
  await container.click();
  // Opción por ARIA
  const option = await firstVisible(page, [
    page.locator('[role="option"]'),
    page.locator('[data-testid*="option" i]'),
    page.locator('[id*="option" i]'),
    page.locator('.MuiAutocomplete-option, .ant-select-item-option, .select__option'), // libs comunes
    page.locator('li:visible, div[role="listbox"] div:visible').first(),
  ], 4000);
  if (option) { await option.click(); return true; }
  // fallback de teclado
  await page.keyboard.press('ArrowDown').catch(()=>{});
  await page.keyboard.press('Enter').catch(()=>{});
  return true;
}

async function chooseByLabelOrCombobox(page: Page, hints: RegExp[], timeout = 6000) {
  // Native <select>
  for (const h of hints) {
    const sel = page.getByLabel(h);
    try {
      await expect(sel).toBeVisible({ timeout });
      await sel.selectOption({ index: 1 }).catch(()=>{});
      return true;
    } catch {}
  }
  // Combobox ARIA o custom
  const containers: Locator[] = [];
  for (const h of hints) {
    containers.push(page.getByRole('combobox', { name: h }));
    containers.push(page.getByLabel(h));
    containers.push(page.locator('[data-testid*="select" i]'));
  }
  const cont = await firstVisible(page, containers, timeout);
  if (!cont) return false;
  return await selectFirstOption(page, cont);
}

test('crear activo: dashboard → Activos → Nuevo Activo → completar y guardar', async ({ page }) => {
  const uniq = Date.now().toString();
  const nombre = `Activo demo ${uniq}`;
  const codigo = `ACT-${uniq.slice(-6)}`;

  // 1) Dashboard
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await waitLoaderGone(page);

  // 2) Ir a "Activos"
  const entroMenu = await clickFirst(page, [
    page.getByRole('link', { name: /^Activos$/i }),
    page.getByRole('menuitem', { name: /Activos/i }),
    page.locator('nav a:has-text("Activos")'),
    page.locator('[data-testid="menu-activos"], a[href*="activo"]'),
  ], 10000);
  expect(entroMenu).toBeTruthy();

  await waitLoaderGone(page);

  // 3) Click "Nuevo Activo"
  const nuevoOk = await clickFirst(page, [
    page.getByRole('button', { name: /nuevo activo/i }),
    page.getByRole('link', { name: /nuevo activo/i }),
    page.locator('button:has-text("Nuevo Activo")'),
    page.locator('a:has-text("Nuevo Activo")'),
    page.locator('[data-testid="new-asset"], [data-testid="nuevo-activo"]'),
  ], 10000);
  expect(nuevoOk).toBeTruthy();

  await waitLoaderGone(page);

  // 4) Completar campos comunes del ABM
  // Nombre
  await fillTextByHints(page, [/^nombre(\s+del\s+activo)?$/i, /^name$/i, /título/i], nombre);

  // Código
  await fillTextByHints(page, [/^c(ó|o)digo$/i, /^code$/i], codigo);

  // Descripción
  await fillTextAreaByHints(page, [/^descripci(ó|o)n$/i, /^description$/i], 'Creado automáticamente por Playwright (demo).');

  // Categoría / Tipo (select)
  await chooseByLabelOrCombobox(page, [/^categor(í|i)a$/i, /^tipo$/i, /clase/i]);

  // Ubicación
  await chooseByLabelOrCombobox(page, [/^ubicaci(ó|o)n$/i, /^location$/i, /sede/i]);

  // Responsable
  await chooseByLabelOrCombobox(page, [/^responsable$/i, /asignado a/i, /t(é|e)cnico/i, /owner/i]);

  // Proveedor (si aplica)
  await chooseByLabelOrCombobox(page, [/^proveedor$/i, /supplier/i]);

  // Estado
  await chooseByLabelOrCombobox(page, [/^estado$/i, /^status$/i]);

  // Fecha de compra / alta
  await setDateByHints(page, [/^fecha(\s+de)?\s+(compra|alta)$/i, /^fecha$/i, /^date$/i], { human: '01/10/2025', iso: '2025-10-01' });

  // Costo
  await setNumberByHints(page, [/^costo$/i, /^precio$/i, /^valor$/i, /monto/i], '100000');

  // Vida útil (meses)
  await setNumberByHints(page, [/^vida\s*útil/i, /^vida\s*util/i, /(meses|months)/i], '12');

  // 5) Guardar / Crear
  const creo = await clickFirst(page, [
    page.getByRole('button', { name: /crear\s+activo/i }),
    page.getByRole('button', { name: /^crear$/i }),
    page.getByRole('button', { name: /guardar/i }),
    page.locator('button:has-text("Crear Activo")'),
    page.locator('button:has-text("Crear")'),
    page.locator('button:has-text("Guardar")'),
    page.locator('[data-testid="submit"], [data-testid="save"], [data-testid="create-asset"]'),
  ], 10000);
  expect(creo).toBeTruthy();

  // 6) Confirmación (toast o navegación)
  // Intento 1: toast de éxito
  const okToast = await firstVisible(page, [
    page.locator('[role="status"]:has-text("exitos")'),
    page.locator('.toast:has-text("creado")'),
    page.locator(':text("Activo creado"), :text("creado exitosamente"), :text("guardado")'),
  ], 6000);

  // Intento 2: redirección a detalle o listado con el nombre recién creado
  const okDetalle = await firstVisible(page, [
    page.locator(`text="${nombre}"`).first(),
    page.getByRole('heading', { name: new RegExp(nombre, 'i') }),
  ], 6000);

  expect(!!okToast || !!okDetalle).toBeTruthy();

  // 7) Dejar visible un toque para demo
  await page.waitForTimeout(4000);
});