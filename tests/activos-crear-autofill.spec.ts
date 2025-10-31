import { test, expect, Locator, Page } from '@playwright/test';

const now = Date.now();
const NOMBRE = `Activo demo ${now}`;
const CODIGO = `ACT-${now.toString().slice(-6)}`;
const DESCR  = 'Creado automáticamente por Playwright (demo)';

async function waitLoaderGone(page: Page) {
  const loader = page.locator(
    '[data-testid*="loader" i], [data-testid*="loading" i], ' +
    '[class*="loader" i], [class*="loading" i], [class*="spinner" i], ' +
    '[role="progressbar"]'
  );
  await loader.first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
}

async function clickFirst(page: Page, locs: Locator[], timeout = 8000) {
  for (const loc of locs) {
    try { await expect(loc).toBeVisible({ timeout }); await loc.click(); return true; } catch {}
  }
  return false;
}

async function labelFor(page: Page, loc: Locator) {
  // intenta conseguir label por "for" o aria-labelledby
  const id = await loc.getAttribute('id');
  if (id) {
    const text = await page.locator(`label[for="${id}"]`).first().innerText().catch(()=>null);
    if (text) return text.trim();
  }
  const lb = await loc.getAttribute('aria-labelledby');
  if (lb) {
    const text = await page.locator(`#${lb}`).first().innerText().catch(()=>null);
    if (text) return text.trim();
  }
  const aria = await loc.getAttribute('aria-label');
  if (aria) return aria.trim();
  const ph = await loc.getAttribute('placeholder');
  if (ph) return ph.trim();
  const name = await loc.getAttribute('name');
  if (name) return name.trim();
  return '';
}

function looksLike(label: string, re: RegExp) {
  return re.test(label.toLowerCase());
}

async function fillFormGenerico(page: Page, form: Locator) {
  const results: string[] = [];

  // 1) Native <select>
  const selects = form.locator('select:visible:not([disabled])');
  for (let i = 0; i < await selects.count(); i++) {
    const s = selects.nth(i);
    const lab = (await labelFor(page, s)).toLowerCase();
    try {
      await s.selectOption({ index: 1 });
      results.push(`select ✔ ${lab || '(sin label)'}`);
    } catch { results.push(`select ✖ ${lab}`); }
  }

  // 2) Custom comboboxes
  const combos = form.locator('[role="combobox"]:visible, [data-testid*="select" i]:visible, .ant-select-selector:visible, .MuiSelect-select:visible');
  for (let i = 0; i < await combos.count(); i++) {
    const c = combos.nth(i);
    try {
      await c.click({ delay: 50 });
      const opt = page.locator('[role="option"]:visible').first()
        .or(page.locator('.ant-select-item-option:visible').first())
        .or(page.locator('.MuiAutocomplete-option:visible').first());
      await opt.click({ timeout: 3000 });
      const lab = await labelFor(page, c);
      results.push(`combobox ✔ ${lab || '(sin label)'}`);
    } catch { /* seguimos */ }
  }

  // 3) Inputs tipo texto / número / fecha / checkbox
  const inputs = form.locator('input:visible:not([type="hidden"]):not([readonly]), textarea:visible:not([readonly])');
  for (let i = 0; i < await inputs.count(); i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute('type')) || 'text';
    const lab  = (await labelFor(page, el)).toLowerCase();

    try {
      if (type === 'checkbox') {
        const checked = await el.isChecked().catch(()=>false);
        if (!checked) await el.check();
        results.push(`checkbox ✔ ${lab}`);
        continue;
      }
      if (type === 'radio') {
        // tomar la primera opción del grupo
        await el.check().catch(()=>{});
        results.push(`radio ✔ ${lab}`);
        continue;
      }
      if (type === 'number') {
        await el.fill('');
        await el.type('100'); // valor por defecto
        results.push(`number ✔ ${lab}`);
        continue;
      }
      if (type === 'date') {
        // ISO suele funcionar en inputs type=date
        await el.fill('');
        await el.type('2025-10-01');
        results.push(`date ✔ ${lab}`);
        continue;
      }

      // Texto / textarea: elegir contenido según label
      let value = 'DEMO';
      if (looksLike(lab, /nombre|name|título|titulo/)) value = NOMBRE;
      else if (looksLike(lab, /c(ó|o)digo|code/))     value = CODIGO;
      else if (looksLike(lab, /descripci(ó|o)n|description/)) value = DESCR;
      else if (looksLike(lab, /precio|costo|valor|monto/)) value = '100000';

      await el.fill('');
      await el.type(value);
      results.push(`${type}/text ✔ ${lab || '(sin label)'} = ${value}`);
    } catch {
      results.push(`${type} ✖ ${lab}`);
    }
  }

  console.log('AUTOFILL_RESULTS', results);
}

test('crear activo (autofill): dashboard → Activos → Nuevo → completar todo y crear', async ({ page }) => {
  // 1) Dashboard (ya logueado)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await waitLoaderGone(page);

  // 2) Ir a Activos
  const menuOk = await clickFirst(page, [
    page.getByRole('link', { name: /^Activos$/i }),
    page.getByRole('menuitem', { name: /Activos/i }),
    page.locator('nav a:has-text("Activos")'),
    page.locator('[data-testid="menu-activos"], a[href*="activo"]'),
  ], 10000);
  expect(menuOk).toBeTruthy();
  await waitLoaderGone(page);

  // 3) Nuevo Activo
  const nuevoOk = await clickFirst(page, [
    page.getByRole('button', { name: /nuevo activo/i }),
    page.getByRole('link',   { name: /nuevo activo/i }),
    page.locator('button:has-text("Nuevo Activo")'),
    page.locator('a:has-text("Nuevo Activo")'),
    page.locator('[data-testid="new-asset"], [data-testid="nuevo-activo"]'),
  ], 10000);
  expect(nuevoOk).toBeTruthy();
  await waitLoaderGone(page);

  // 4) Rellenar el formulario de alta (todo lo visible)
  const form = page.locator('form:visible').first();
  await expect(form).toBeVisible({ timeout: 10000 });
  await fillFormGenerico(page, form);

  // 5) Crear / Guardar
  const submitOk = await clickFirst(page, [
    page.getByRole('button', { name: /crear\s+activo/i }),
    page.getByRole('button', { name: /^crear$/i }),
    page.getByRole('button', { name: /guardar/i }),
    page.locator('button:has-text("Crear Activo")'),
    page.locator('button:has-text("Crear")'),
    page.locator('button:has-text("Guardar")'),
    page.locator('[data-testid="submit"], [data-testid="save"], [data-testid="create-asset"]'),
  ], 10000);
  expect(submitOk).toBeTruthy();

  await waitLoaderGone(page);

  // 6) Verificación de éxito (toast o que aparezca el nombre)
  const ok = await page.locator(':text("creado"), :text("guardado"), :text("exitos")').first().isVisible().catch(()=>false)
         || await page.getByText(NOMBRE, { exact: false }).first().isVisible().catch(()=>false)
         || await page.getByRole('heading', { name: new RegExp(NOMBRE, 'i') }).isVisible().catch(()=>false);

  expect(ok).toBeTruthy();

  // 7) Dejar visible un momento
  await page.waitForTimeout(4000);
});
