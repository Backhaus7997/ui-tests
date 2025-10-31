import { test, expect, Page, Locator } from '@playwright/test';

test.setTimeout(180_000);

// ---------- SPEED-UPS por test ----------
async function speedUp(page: Page) {
  // 1) Bloquear trackers/analytics/chat que ralentizan
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/(google-analytics|googletagmanager|doubleclick|facebook|hotjar|clarity|intercom|onesignal|firebaseinstallations|gcm\.googleapis|segment\.io)/i.test(url)) {
      return route.abort();
    }
    route.continue();
  });
  // 2) Apagar animaciones/transiciones
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      transition: none !important;
      animation: none !important;
      scroll-behavior: auto !important;
    }
  `});
}

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

async function stickyFill(input: Locator, value: string) {
  await input.scrollIntoViewIfNeeded().catch(()=>{});
  await input.click({ force: true }).catch(()=>{});
  await input.focus().catch(()=>{});
  await input.fill('');
  await input.type(value, { delay: 12 });
  try { await input.press('Tab'); } catch {}
}

async function pickFirstOptionFromOpenList(page: Page) {
  const opt = await firstVisible(page, [
    page.locator('[role="option"]:visible').first(),
    page.locator('.dx-list-item:visible').first(),
    page.locator('.ant-select-item-option:not(.ant-select-item-option-disabled):visible').first(),
    page.locator('.MuiAutocomplete-option:visible').first(),
    page.locator('li:visible').first(),
  ], 5000);
  if (opt) { await opt.click(); return true; }
  await page.keyboard.press('ArrowDown').catch(()=>{});
  await page.keyboard.press('Enter').catch(()=>{});
  return true;
}

async function openComboTipoYElegir(page: Page, cont: Locator) {
  // Acepta "Tipo", "Tipo *", "Tipo de Activo", etc.
  const labelSel = /^tipo\b/i;
  // Nodo del campo (label + input)
  const fieldWrap = await firstVisible(page, [
    cont.locator('*:has(> label:has-text("Tipo"))').first(),
    cont.locator('*:has(> label:has-text("tipo"))').first()
  ], 8000);

  const opener = await firstVisible(page, [
    cont.getByRole('combobox', { name: labelSel }),
    cont.getByLabel(labelSel),
    cont.getByPlaceholder(labelSel),
    fieldWrap ? fieldWrap.locator('[role="combobox"], input:visible:not([readonly])').first()
              : cont.getByRole('combobox').first()
  ], 8000);
  if (!opener) return false;

  await opener.scrollIntoViewIfNeeded().catch(()=>{});
  await opener.click({ force: true }).catch(()=>{});

  // click en icono de desplegar si existe (DevExtreme/Ant/MUI)
  const arrow = await firstVisible(page, [
    fieldWrap ? fieldWrap.locator('.dx-dropdowneditor-button, .dx-dropdowneditor-icon').first() : page.locator('.dx-dropdowneditor-button, .dx-dropdowneditor-icon').first(),
    fieldWrap ? fieldWrap.locator('.ant-select-arrow').first() : page.locator('.ant-select-arrow').first(),
    fieldWrap ? fieldWrap.locator('.MuiSelect-icon').first() : page.locator('.MuiSelect-icon').first()
  ], 800);
  if (arrow) await arrow.click({ force: true }).catch(()=>{});

  // si no aparece lista, tipeamos una letra para disparar opciones
  await opener.type('a', { delay: 10 }).catch(()=>{});

  const picked = await pickFirstOptionFromOpenList(page);
  await waitLoaderGone(page);
  return picked;
}

async function setFechaRobusta(page: Page, cont: Locator) {
  // Intento 1: input con máscara / placeholder
  const fechaInput = await firstVisible(page, [
    cont.getByPlaceholder(/^\d{2}\/\d{2}\/\d{2}\s*\d{2}:\d{2}$/i), // ej 00/00/00 00:00
    cont.getByPlaceholder(/DD\/MM\/YY\s*hh?:mm/i),
    cont.getByLabel(/fecha\s*y\s*hora/i),
    cont.getByLabel(/^fecha$/i),
    cont.locator('input[type="datetime-local"]:visible'),
    cont.locator('input[type="text"][inputmode="numeric"]:visible'), // algunos datebox
    cont.locator('.dx-texteditor-input:visible')
  ], 8000);
  if (!fechaInput) return false;

  // abrir pop-up calendario si existe
  const calBtn = await firstVisible(page, [
    fechaInput.locator('xpath=ancestor::*[self::div or self::span][1]').locator('.dx-dropdowneditor-button, .dx-dropdowneditor-icon, .ant-picker-suffix, .MuiIconButton-root').first(),
    cont.locator('.dx-dropdowneditor-button, .dx-dropdowneditor-icon, .ant-picker-suffix, .MuiIconButton-root').first()
  ], 1000);
  if (calBtn) await calBtn.click({ force: true }).catch(()=>{});

  // Escribir con formato (DD/MM/YY HH:mm) → 29/10/25 10:30
  await stickyFill(fechaInput, '29/10/25 10:30');

  // Si aparece el calendario, confirmar OK/Aceptar
  const picker = await firstVisible(page, [
    page.locator('.dx-overlay-content:visible, .ant-picker-dropdown:visible, .MuiPickersPopper-root:visible, .react-datepicker:visible')
  ], 1200);
  if (picker) {
    // Elegir día 29 (por si exige click explícito)
    const dia = await firstVisible(page, [
      picker.locator('text=29').first(),
      picker.locator('.dx-calendar-cell:has-text("29")').first()
    ], 500);
    if (dia) await dia.click().catch(()=>{});

    const okBtn = await firstVisible(page, [
      picker.getByRole('button', { name: /^ok$|^aceptar$/i }),
      picker.locator('button:has-text("OK")'),
      picker.locator('button:has-text("Aceptar")'),
      page.getByRole('button', { name: /^ok$|^aceptar$/i })
    ], 1200);
    if (okBtn) await okBtn.click().catch(()=>{});
  }

  // Validar que quedó algo con pinta de fecha
  const val = await fechaInput.inputValue().catch(()=> '');
  if (val && /\d{2}\/\d{2}\/\d{2,4}/.test(val)) return true;

  // Intento 2 (último recurso): setear value por JS y disparar eventos
  const handle = await fechaInput.elementHandle();
  if (!handle) return false;
  await page.evaluate((el) => {
    const v = '29/10/25 10:30';
    (el as HTMLInputElement).value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }, handle);
  return true;
}

test('crear activo: Tipo (lista) + Nombre + Clave + Fecha (rápido y robusto)', async ({ page }) => {
  await speedUp(page);

  const uniq = Date.now().toString();
  const nombre = `Activo demo ${uniq}`;
  const clave  = `CLV-${uniq.slice(-6)}`;

  // 1) Dashboard
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await waitLoaderGone(page);

  // 2) Ir a Activos
  const activos = await firstVisible(page, [
    page.getByRole('link', { name: /^Activos$/i }),
    page.getByRole('menuitem', { name: /Activos/i }),
    page.locator('nav a:has-text("Activos")'),
    page.locator('[data-testid="menu-activos"], a[href*="activo"]'),
  ]);
  expect(activos).toBeTruthy();
  await activos!.click();
  await waitLoaderGone(page);

  // 3) Nuevo Activo
  const nuevo = await firstVisible(page, [
    page.getByRole('button', { name: /nuevo activo/i }),
    page.getByRole('link',   { name: /nuevo activo/i }),
    page.locator('button:has-text("Nuevo Activo")'),
    page.locator('a:has-text("Nuevo Activo")'),
    page.locator('[data-testid="new-asset"], [data-testid="nuevo-activo"]'),
  ], 20000);
  expect(nuevo).toBeTruthy();
  await nuevo!.click({ delay: 40 });
  await waitLoaderGone(page);

  // 4) Contenedor del formulario
  const cont = await firstVisible(page, [
    page.getByRole('dialog'),
    page.locator('.ant-modal-content, .MuiDialog-paper, .dx-overlay-content, .drawer, .Drawer'),
    page.locator('form:visible').first(),
  ], 20000);
  expect(cont, 'No encontré el contenedor de Alta').toBeTruthy();

  // 5) TIPO (obligatorio)
  expect(await openComboTipoYElegir(page, cont!),'No pude seleccionar "Tipo"').toBeTruthy();

  // 6) NOMBRE (obligatorio)
  const nombreInput = await firstVisible(page, [
    cont!.getByLabel(/^nombre$/i),
    cont!.locator('*:has(> label:has-text("Nombre")) input:visible')
  ], 8000);
  expect(nombreInput, 'No encontré input "Nombre"').toBeTruthy();
  await stickyFill(nombreInput!, nombre);

  // 7) CLAVE (completar aunque sea opcional)
  const claveInput = await firstVisible(page, [
    cont!.getByLabel(/^clave$/i),
    cont!.locator('*:has(> label:has-text("Clave")) input:visible')
  ], 8000);
  if (claveInput) await stickyFill(claveInput, clave);

  // 8) FECHA (mini calendario / máscara)
  expect(await setFechaRobusta(page, cont!), 'No pude completar "Fecha"').toBeTruthy();

  // 9) Guardar / Crear
  const crear = await firstVisible(page, [
    cont!.getByRole('button', { name: /crear\s+activo/i }),
    cont!.getByRole('button', { name: /^crear$/i }),
    cont!.getByRole('button', { name: /guardar/i }),
    cont!.locator('button:has-text("Crear Activo")'),
    cont!.locator('button:has-text("Crear")'),
    cont!.locator('button:has-text("Guardar")'),
    cont!.locator('[data-testid="submit"], [data-testid="save"], [data-testid="create-asset"]'),
  ], 15000);
  expect(crear, 'No encontré botón Crear/Guardar').toBeTruthy();
  await crear!.scrollIntoViewIfNeeded().catch(()=>{});
  await crear!.click({ delay: 40 });

  // 10) Verificar
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(()=>{});
  await waitLoaderGone(page);

  const ok =
    await page.locator(':text("creado"), :text("guardado"), :text("éxito"), :text("exitos")').first().isVisible().catch(()=>false);

  if (!ok) {
    await test.info().attach('form-state', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
  expect(ok).toBeTruthy();

  await page.waitForTimeout(800);
});
