import { test, expect, Page, Locator } from '@playwright/test';

/** ==== Timings rápidos (podés ajustarlos) ==== */
const T = { TEST: 60_000, WAIT: 3_000, DIALOG: 6_000, TYPE: 1 };
test.setTimeout(T.TEST);

/** ==== Helpers cortos y robustos ==== */
async function firstVisible(page: Page, locs: Locator[], timeout = T.WAIT): Promise<Locator | null> {
  for (const loc of locs) {
    try { await expect(loc).toBeVisible({ timeout }); return loc; } catch {}
  }
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
const nrm = (s?: string | null) => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim();

/** ==== Abrir “Nuevo Componente” ultra-rápido ==== */
async function openNuevoComponente(page: Page): Promise<Locator> {
  // Menú "Componentes"
  const menu = await mustVisible(page, [
    page.getByRole('link', { name: /^Componentes$/i }),
    page.locator('nav a:has-text("Componentes")'),
    page.locator('a[href*="componente"]:has-text("Componentes")'),
  ], 'No encontré el menú "Componentes"');
  await menu.click();

  // Botón "Nuevo Componente"
  const btn = await mustVisible(page, [
    page.getByRole('button', { name: /nuevo\s+componente/i }),
    page.locator('button:has-text("Nuevo Componente")'),
    page.locator('a:has-text("Nuevo Componente")'),
  ], 'No encontré "Nuevo Componente"', 3000);

  // Click + esperar formulario (modal/drawer/form)
  await Promise.all([
    page.waitForSelector('.ant-modal-content:visible, .drawer:visible, .Drawer:visible, form:visible', { timeout: 7000 }),
    btn.click({ force: true }),
  ]);

  // Contenedor del alta
  return await mustVisible(page, [
    page.getByRole('dialog'),
    page.locator('.ant-modal-content:visible, .drawer:visible, .Drawer:visible'),
    page.locator('form:visible').first(),
  ], 'No abrió el formulario de alta', 2000);
}

/** ==== Seleccionar Tipo = "Rueda" (Ant/MUI/listbox) ==== */
async function pickTipoRueda(cont: Locator): Promise<boolean> {
  const page = cont.page();

  // Ant Select directo por label "Tipo"
  const antTrigger = cont.locator('label:has-text("Tipo")').locator('..').locator('.ant-select-selector').first();
  if (await antTrigger.isVisible({ timeout: 800 }).catch(() => false)) {
    await antTrigger.click({ force: true });
    const antDrop = page.locator('.ant-select-dropdown:visible');
    await expect(antDrop).toBeVisible({ timeout: 2000 });
    await antDrop.locator('.ant-select-item-option:has-text("Rueda")').first().click({ force: true });

    const pill = cont.locator('label:has-text("Tipo")').locator('..').locator('.ant-select-selection-item:visible').first();
    const val = nrm(await pill.innerText().catch(() => ''));
    return val.includes('rueda');
  }

  // Fallback genérico con ARIA (combobox/listbox)
  const trigger = await firstVisible(page, [
    cont.getByRole('combobox', { name: /^tipo$/i }),
    cont.locator('label:has-text("Tipo")').locator('..')
        .locator('[role="combobox"], input[aria-haspopup="listbox"]').first(),
  ], 1500);
  if (!trigger) return false;

  await trigger.click({ force: true });

  const dropdown = await firstVisible(page, [
    page.locator('[role="listbox"]:visible'),
    page.locator('.ant-select-dropdown:visible'),
  ], 3000);
  if (!dropdown) return false;

  const option = await firstVisible(page, [
    dropdown.locator('[role="option"]:has-text("Rueda")'),
    dropdown.locator('.ant-select-item-option:has-text("Rueda")'),
  ], 1500);
  if (!option) return false;

  await option.click({ force: true });

  // Validación liviana
  const display = await firstVisible(page, [
    cont.locator('label:has-text("Tipo")').locator('..').locator('.ant-select-selection-item:visible'),
  ], 800);
  if (!display) return true;
  const val = nrm(await display.innerText().catch(() => ''));
  return val.includes('rueda');
}

/** ==== TEST: Crear nuevo componente (Nombre, Clave, Tipo=Rueda) ==== */
test('Componentes: Nuevo → Nombre + Clave + Tipo=Rueda → Guardar', async ({ page }) => {
  // Requiere que ya tengas auto-login por global-setup (abre /dashboard autenticado)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

  const cont = await openNuevoComponente(page);

  // Nombre (obligatorio)
  const nombre = await mustVisible(page, [
    cont.getByLabel(/^nombre$/i),
    cont.locator('label:has-text("Nombre")').locator('..').locator('input:visible').first(),
  ], 'Campo "Nombre" no encontrado');
  await fillText(nombre, `Componente demo ${Date.now()}`);

  // Clave (texto simple)
  const clave = await mustVisible(page, [
    cont.getByLabel(/^clave$/i),
    cont.locator('label:has-text("Clave")').locator('..').locator('input:visible').first(),
  ], 'Campo "Clave" no encontrado');
  await fillText(clave, `CMP-${String(Date.now()).slice(-6)}`);

  // Tipo = Rueda
  expect(await pickTipoRueda(cont), 'No pude seleccionar Tipo = "Rueda"').toBeTruthy();

  // Guardar / Crear
  const guardar = await mustVisible(page, [
    cont.getByRole('button', { name: /crear\s+componente/i }),
    cont.getByRole('button', { name: /^crear$/i }),
    cont.getByRole('button', { name: /guardar/i }),
    cont.locator('button:has-text("Crear Componente"), button:has-text("Crear"), button:has-text("Guardar")').first(),
  ], 'No encontré el botón Crear/Guardar');
  await guardar.click();

  // Señal de éxito: se cierra el modal/drawer o aparece un toast
  await cont.waitFor({ state: 'hidden', timeout: 12_000 }).catch(()=>{});
  const closed = !(await cont.isVisible().catch(()=>false));

  // Fallback: verificar toast o la fila en la grilla
  let ok = closed;
  if (!ok) {
    const toast = await firstVisible(page, [
      page.locator('.ant-message-notice, .Toastify__toast, [role="status"]').filter({ hasText: /cread(o|a)|guardad(o|a)|éxito/i }),
    ], 1500);
    ok = !!toast;
  }
  expect(ok, 'No tengo confirmación de que se creó el componente').toBeTruthy();
});