import { test, expect, Page, Locator } from '@playwright/test';

/* ==== Timings ==== */
const T = { TEST: 70_000, WAIT: 3_000, DIALOG: 7_000, TYPE: 1 };
test.setTimeout(T.TEST);

/* ==== Helpers ==== */
const rEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function firstVisible(page: Page, locs: Locator[], timeout = T.WAIT): Promise<Locator | null> {
  for (const loc of locs) { try { await expect(loc).toBeVisible({ timeout }); return loc; } catch {} }
  return null;
}
async function mustVisible(page: Page, locs: Locator[], msg: string, timeout = T.WAIT): Promise<Locator> {
  const loc = await firstVisible(page, locs, timeout);
  expect(loc, msg).toBeTruthy();
  return loc!;
}
async function fillText(input: Locator, value: string) {
  await input.click({ force: true });
  await input.fill('');
  await input.type(value, { delay: T.TYPE });
  await input.press('Tab').catch(() => {});
}

/* ==== Navegación a Componentes ==== */
async function gotoComponentes(page: Page) {
  const menu = await mustVisible(page, [
    page.getByRole('link', { name: /^Componentes$/i }),
    page.locator('nav a:has-text("Componentes")'),
    page.locator('a[href*="component"]').filter({ hasText: /componentes/i }),
  ], 'No encontré el menú "Componentes"');
  await Promise.all([
    page.waitForURL(/\/component(\/grid)?/i, { timeout: 8000 }).catch(()=>{}),
    menu.click(),
  ]);
}

/* ==== Alta mínima (solo si hace falta) ==== */
async function openNuevoComponente(page: Page): Promise<Locator> {
  const btn = await mustVisible(page, [
    page.getByRole('button', { name: /nuevo\s+componente/i }),
    page.locator('button:has-text("Nuevo Componente")'),
    page.locator('a:has-text("Nuevo Componente")'),
  ], 'No encontré "Nuevo Componente"', 3000);

  await Promise.all([
    page.waitForSelector('.ant-modal-content:visible, .drawer:visible, .Drawer:visible, form:visible', { timeout: 7000 }),
    btn.click({ force: true }),
  ]);

  return await mustVisible(page, [
    page.getByRole('dialog'),
    page.locator('.ant-modal-content:visible, .drawer:visible, .Drawer:visible'),
    page.locator('form:visible').first(),
  ], 'No abrió el formulario de alta', 2000);
}

async function pickTipoRueda(cont: Locator): Promise<boolean> {
  const page = cont.page();
  const antTrigger = cont.locator('label:has-text("Tipo")').locator('..').locator('.ant-select-selector').first();
  if (await antTrigger.isVisible().catch(()=>false)) {
    await antTrigger.click({ force: true });
    const drop = page.locator('.ant-select-dropdown:visible');
    await expect(drop).toBeVisible({ timeout: 2000 });
    await drop.locator('.ant-select-item-option:has-text("Rueda")').first().click({ force: true });
    return true;
  }
  const trigger = await firstVisible(page, [
    cont.getByRole('combobox', { name: /^tipo$/i }),
    cont.locator('label:has-text("Tipo")').locator('..').locator('[role="combobox"], input[aria-haspopup="listbox"]').first(),
  ]);
  if (!trigger) return false;
  await trigger.click({ force: true });
  const list = await firstVisible(page, [
    page.locator('[role="listbox"]:visible'),
    page.locator('.ant-select-dropdown:visible'),
  ], 2500);
  if (!list) return false;
  const opt = await firstVisible(page, [
    list.locator('[role="option"]:has-text("Rueda")'),
    list.locator('.ant-select-item-option:has-text("Rueda")'),
  ]);
  if (!opt) return false;
  await opt.click({ force: true });
  return true;
}

async function crearComponenteDemo(page: Page): Promise<string> {
  const cont = await openNuevoComponente(page);
  const nombre = `Demo QA ${Date.now()}`;
  const iNombre = await mustVisible(page, [
    cont.getByLabel(/^nombre$/i),
    cont.locator('label:has-text("Nombre")').locator('..').locator('input:visible').first(),
  ], 'Campo Nombre');
  await fillText(iNombre, nombre);

  const iClave = await firstVisible(page, [
    cont.getByLabel(/^clave$/i),
    cont.locator('label:has-text("Clave")').locator('..').locator('input:visible').first(),
  ]);
  if (iClave) await fillText(iClave, `DEM-${String(Date.now()).slice(-6)}`);

  await pickTipoRueda(cont);

  const guardar = await mustVisible(page, [
    cont.getByRole('button', { name: /guardar|crear/i }),
    cont.locator('button:has-text("Guardar")').first(),
  ], 'No encontré Guardar/Crear');
  await guardar.click();
  await cont.waitFor({ state: 'hidden', timeout: 10_000 }).catch(()=>{});
  return nombre;
}

/* ==== Grilla: filtro + fila + eliminar ==== */
async function filterByNombre(page: Page, texto: string) {
  const filtro = await firstVisible(page, [
    page.locator('thead tr input').first(),
    page.locator('input[placeholder*="buscar" i]').first(),
    page.locator('input[type="search"]').first(),
  ], 1200);
  if (filtro) {
    await filtro.fill('');
    await filtro.type(texto, { delay: T.TYPE });
    await page.keyboard.press('Enter').catch(()=>{});
    await page.waitForTimeout(250);
  }
}

function rowByNombreContains(page: Page, texto: string): Locator {
  const re = new RegExp(texto, 'i'); // contiene “demo”
  return page.locator('tr:not(.dx-header-row), .dx-row:not(.dx-header-row)')
             .filter({ has: page.getByText(re) }).first();
}
async function nombreDeFila(row: Locator): Promise<string> {
  // Asumimos 1ª columna = Nombre
  const cell = row.locator('td').first();
  return (await cell.innerText().catch(()=> '')).trim();
}

async function clickEliminarDeFila(page: Page, row: Locator) {
  const del = await firstVisible(page, [
    row.getByRole('button', { name: /eliminar|borrar|delete/i }),
    row.locator('button[aria-label*="eliminar" i], button[title*="eliminar" i], button[aria-label*="borrar" i], button[title*="borrar" i]'),
    row.locator('button.ant-btn-dangerous'),
    row.locator('button').filter({ has: page.locator('svg,i[class*="delete"], .anticon-delete') }).first(),
  ], 2000);
  const btn = del || (await (async () => {
    const all = row.locator('button');
    const n = await all.count().catch(()=>0);
    return n ? all.nth(n - 1) : null;
  })());
  expect(btn, 'No encontré el botón Eliminar en la fila').toBeTruthy();
  await btn!.click({ force: true });
}

async function eliminarConNota(page: Page, nota: string) {
  const drawer = await mustVisible(page, [
    page.getByRole('dialog', { name: /eliminar/i }),
    page.locator('.MuiDrawer-paper:visible, .drawer:visible, .Drawer:visible, .ant-drawer:visible').filter({ hasText: /eliminar/i }),
  ], 'No se abrió el drawer de Eliminar', T.DIALOG);

  const notas = await mustVisible(page, [
    drawer.getByLabel(/^notas/i),
    drawer.locator('textarea:visible').first(),
  ], 'No encontré el campo Notas *');
  await fillText(notas, nota);

  const guardar = await mustVisible(page, [
    drawer.getByRole('button', { name: /guardar\s*cambios/i }),
    drawer.locator('button:has-text("Guardar Cambios")').first(),
  ], 'No encontré "Guardar Cambios"');
  await guardar.click();

  await drawer.waitFor({ state: 'hidden', timeout: 8_000 }).catch(()=>{});
}

/* ==== TEST: eliminar el primero que contenga “demo” ==== */
test('Componentes: eliminar un componente cuyo nombre contenga "demo"', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await gotoComponentes(page);

  // 1) Buscar por “demo”
  await filterByNombre(page, 'demo');
  let row = rowByNombreContains(page, 'demo');

  // Si no hay ninguno, creo uno “Demo QA …”
  if (!await row.isVisible().catch(()=>false)) {
    const creado = await crearComponenteDemo(page);
    await gotoComponentes(page);
    await filterByNombre(page, creado); // filtra por el nombre exacto creado
    row = rowByNombreContains(page, rEsc(creado));
  }

  // 2) Tomo el nombre exacto de esa fila (para verificar después)
  const nombreObjetivo = await nombreDeFila(row);
  expect(nombreObjetivo, 'No pude leer el nombre del componente').toBeTruthy();

  // 3) Eliminar con nota
  await clickEliminarDeFila(page, row);
  await eliminarConNota(page, `Borrado por test E2E (objetivo: ${nombreObjetivo}).`);

  // 4) Verificación: ya no está
  await gotoComponentes(page);
  await filterByNombre(page, nombreObjetivo);
  await expect(rowByNombreContains(page, rEsc(nombreObjetivo))).toHaveCount(0, { timeout: 6000 });

  // (opcional) toast
  const toast = await firstVisible(page, [
    page.getByText(/eliminad|borrad|éxito|exitos/i),
    page.locator('.ant-message, .Toastify__toast, .ant-notification').filter({ hasText: /eliminad|borrad/i }),
  ], 1500);
  if (toast) await expect(toast).toBeVisible();
});