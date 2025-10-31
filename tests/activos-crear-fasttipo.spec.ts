import { test, expect, Page, Locator } from '@playwright/test';

/** ========= Timings rápidos y ajustables ========= */
const T = { TEST: 60_000, WAIT: 3_000, DIALOG: 6_000, TYPE: 1 };
test.setTimeout(T.TEST);

/** ========= Helpers base ========= */
async function firstVisible(page: Page, locs: Locator[], timeout = T.WAIT): Promise<Locator | null> {
  for (const loc of locs) {
    try { await expect(loc).toBeVisible({ timeout }); return loc; } catch {}
  }
  return null;
}

/** Garantiza locator (con mensaje) y estrecha tipo a Locator */
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
const rEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Forzar valor nativo + eventos (React/Ant/etc.) */
async function setNativeValue(input: Locator, value: string) {
  await input.evaluate((el, v) => {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc?.set?.call(el as HTMLInputElement, v);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

/** ========= Abrir “Nuevo Activo” ultra-rápido ========= */
async function openNuevoActivoRapido(page: Page): Promise<Locator> {
  const btn = await mustVisible(
    page,
    [
      page.locator('button:has-text("Nuevo Activo")').first(),
      page.getByRole('button', { name: /nuevo\s+activo/i }),
      page.locator('a:has-text("Nuevo Activo")').first(),
    ],
    'No encontré "Nuevo Activo"',
    3000
  );

  await Promise.all([
    page.waitForSelector('.ant-modal-content:visible, .drawer:visible, .Drawer:visible, form:visible', { timeout: 7000 }),
    btn.click({ force: true }),
  ]);

  return await mustVisible(
    page,
    [
      page.getByRole('dialog'),
      page.locator('.ant-modal-content:visible, .drawer:visible, .Drawer:visible'),
      page.locator('form:visible').first(),
    ],
    'No abrió el formulario de alta',
    2000
  );
}

/** ========= Tipo = “Máquina” (prioriza Ant Select) ========= */
async function pickTipoMaquina(cont: Locator) {
  const page = cont.page();

  // Ant Select directo
  const antTrigger = cont.locator('label:has-text("Tipo")').locator('..').locator('.ant-select-selector').first();
  let antVisible = false;
  try { await expect(antTrigger).toBeVisible({ timeout: 800 }); antVisible = true; } catch {}
  if (antVisible) {
    await antTrigger.click({ force: true });
    const antDrop = page.locator('.ant-select-dropdown:visible');
    await expect(antDrop).toBeVisible({ timeout: 2000 });
    await antDrop
      .locator('.ant-select-item-option:has-text("Máquina"), .ant-select-item-option:has-text("Maquina")')
      .first().click({ force: true });
    const pill = cont.locator('label:has-text("Tipo")').locator('..').locator('.ant-select-selection-item:visible').first();
    const val = nrm(await pill.innerText().catch(() => ''));
    return val.includes('maquina');
  }

  // Fallback genérico
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
    dropdown.locator('[role="option"]:has-text("Máquina")'),
    dropdown.locator('[role="option"]:has-text("Maquina")'),
    dropdown.locator('.ant-select-item-option:has-text("Máquina")'),
    dropdown.locator('.ant-select-item-option:has-text("Maquina")'),
  ], 1500);
  if (!option) return false;

  await option.click({ force: true });
  const display = await firstVisible(page, [
    cont.locator('label:has-text("Tipo")').locator('..').locator('.ant-select-selection-item:visible'),
  ], 800);
  if (!display) return true;
  const val = nrm(await display.innerText().catch(() => ''));
  return val.includes('maquina');
}

/** ========= Notas (textarea o contenteditable) ========= */
async function writeNotas(cont: Locator, texto: string) {
  const page = cont.page();
  const area = await firstVisible(page, [
    cont.getByPlaceholder(/escribe tus notas/i),
    cont.locator('textarea:visible').first(),
    cont.locator('[contenteditable="true"]:visible').first(),
    cont.getByRole('textbox').filter({ hasText: /escribe tus notas/i }),
  ]);
  if (!area) return false;
  await area.click({ force: true });
  try { await area.fill(texto); }
  catch { await page.keyboard.type(texto, { delay: T.TYPE }); }
  await page.keyboard.press('Tab').catch(()=>{});
  return true;
}

/** ========= Toggle “Es una herramienta” ========= */
async function setHerramienta(cont: Locator, on = true) {
  const page = cont.page();
  const row = cont.locator('text=/^\\s*Es una herramienta\\s*$/i').first().locator('..');
  const sw = await firstVisible(page, [
    row.locator('[role="switch"]'),
    row.locator('input[type="checkbox"]'),
    row.locator('.ant-switch, .MuiSwitch-root'),
  ], 1200);
  if (!sw) return false;

  const aria = await sw.getAttribute('aria-checked').catch(()=>null);
  const checked = aria ? aria === 'true' :
    await sw.evaluate(el => (el as any).checked ?? el.classList.contains('ant-switch-checked')).catch(()=>false);

  if ((on && !checked) || (!on && checked)) {
    await sw.click({ force: true });
    await page.waitForTimeout(120);
  }
  return true;
}

/** ========= Ubicación con stock (expande por ruta + pill morada + fallback “primer almacén”) ========= */
async function setUbicacionStock(cont: Locator, ...nombres: string[]) {
  const page = cont.page();
  const objetivos = nombres.length ? nombres : ['Almacen Central Bs As'];

  // 1) Abrir el picker
  const trigger = await firstVisible(page, [
    cont.getByLabel(/^ubicaci(ó|o)n/i),
    cont.locator('label:has-text("Ubicación")').locator('..')
        .locator('[role="button"], input, .ant-select-selector').first(),
  ], 1500);
  if (!trigger) return false;
  await trigger.click({ force: true });

  // 2) Drawer / Popover
  const picker = await mustVisible(
    page,
    [
      page.locator('.MuiDrawer-paper:visible'),
      page.locator('.dx-overlay-content:visible'),
      page.getByRole('dialog').filter({ hasText: /buscar/i }),
    ],
    'No abrió el selector de Ubicación',
    T.DIALOG
  );

  // ---- helpers internos ----
  const qPill = '.ant-tag, .MuiChip-root, .MuiChip-clickable, [class*="chip"]:not([disabled])';

  /** hace expand sobre una fila con texto (chevron/keyboard/expander genérico) */
  async function expandLabel(label: string) {
    const re = new RegExp(`^\\s*${rEsc(label)}\\s*$`, 'i');

    const row = await firstVisible(page, [
      picker.getByText(re).first(),
      picker.locator('li,div,button,[role="treeitem"]').filter({ hasText: re }).first(),
    ], 1200);
    if (!row) return false;

    // 1) foco + ArrowRight (muchos árboles lo soportan)
    try {
      await row.click({ force: true });
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(120);
    } catch {}

    // 2) chevron cercano
    const chevron = await firstVisible(page, [
      row.locator('button[aria-label*="expand" i]'),
      row.locator('.dx-treeview-toggle-item-visibility'),
      row.locator('.MuiTreeItem-iconContainer button'),
      row.locator('.ant-tree-switcher, .ant-tree-switcher_close'),
    ], 500);
    if (chevron) {
      try { await chevron.click({ force: true }); await page.waitForTimeout(150); } catch {}
    }

    return true;
  }

  /** expande TODO lo que vea (emergencia) */
  async function expandAllVisible(rounds = 3) {
    for (let r = 0; r < rounds; r++) {
      const toggles = picker.locator(
        'button[aria-label*="expand" i], .dx-treeview-toggle-item-visibility, .MuiTreeItem-iconContainer button, .ant-tree-switcher'
      );
      const n = await toggles.count().catch(()=>0);
      if (!n) break;
      for (let i = 0; i < Math.min(20, n); i++) {
        try { await toggles.nth(i).click({ force: true }); } catch {}
      }
      await page.waitForTimeout(160);
    }
  }

  /** intenta elegir un almacén por nombre exacto */
  async function pickAlmacen(nombre: string) {
    const re = new RegExp(`^\\s*${rEsc(nombre)}\\s*$`, 'i');

    // buscador (si existe)
    const busc = await firstVisible(page, [
      picker.getByPlaceholder(/buscar/i),
      picker.locator('input[type="search"], input[placeholder*="buscar" i]').first(),
    ], 600);
    if (busc) {
      await busc.fill('');
      await busc.type(nombre, { delay: T.TYPE });
      await page.keyboard.press('Enter').catch(()=>{});
      await page.waitForTimeout(180);
    }

    const candidato = await firstVisible(page, [
      picker.getByRole('button', { name: re }),
      picker.locator(`${qPill}:has-text("${nombre}")`).first(),
      picker.getByText(re).and(picker.locator(qPill)).first(),
    ], 1500);
    if (!candidato) return false;

    try { await candidato.click({ force: true }); }
    catch {
      const h = await candidato.elementHandle();
      if (!h) return false;
      await h.evaluate((el: any) => (el as HTMLElement).click());
    }

    // Guardar Cambios si aparece
    const save = await firstVisible(page, [
      picker.getByRole('button', { name: /guardar\s+cambios/i }),
      picker.getByRole('button', { name: /^guardar$/i }),
    ], 600);
    if (save) await save.click({ force: true });

    // Validación
    const ok = await firstVisible(page, [
      cont.locator('label:has-text("Ubicación")').locator('..').locator(`:text-is("${nombre}")`).first(),
    ], 1500);
    return !!ok;
  }

  /** si todo falla, toma la primera “píldora morada” visible */
  async function pickPrimerAlmacenVisible() {
    const pill = await firstVisible(page, [ picker.locator(qPill).first() ], 1200);
    if (!pill) return false;
    const nombre = (await pill.innerText().catch(()=> '')).trim();
    if (!nombre) return false;

    try { await pill.click({ force: true }); } catch { return false; }

    const save = await firstVisible(page, [
      picker.getByRole('button', { name: /guardar\s+cambios/i }),
      picker.getByRole('button', { name: /^guardar$/i }),
    ], 600);
    if (save) await save.click({ force: true });

    const ok = await firstVisible(page, [
      cont.locator('label:has-text("Ubicación")').locator('..').locator(`:text-is("${nombre}")`).first(),
    ], 1500);
    return !!ok;
  }

  // 3) Ruta guiada (lo más común en tus pantallas)
  await expandLabel('ARGENTINA').catch(()=>{});
  await expandLabel('Buenos Aires').catch(()=>{});

  // 4) Intento por nombres pedidos
  for (const n of objetivos) {
    if (await pickAlmacen(n)) return true;
  }

  // 5) Expand-all y reintentar
  await expandAllVisible(3);
  for (const n of objetivos) {
    if (await pickAlmacen(n)) return true;
  }

  // 6) Último recurso: primer almacén morado visible
  if (await pickPrimerAlmacenVisible()) return true;

  return false;
}

/** ========= FECHA ========= */
async function locateFecha(cont: Locator) {
  const page = cont.page();
  const input = await firstVisible(page, [
    cont.getByLabel(/^fecha(\s*y\s*hora)?$/i),
    cont.locator('label:has-text("Fecha")').locator('..').locator('input:visible').first(),
    cont.locator('.ant-picker-input input:visible').first(),
    cont.locator('input[placeholder*="fecha" i]:visible').first(),
    cont.locator('input[type="text"]:visible').first(),
  ]);
  const icon = await firstVisible(page, [
    cont.locator('.ant-picker-suffix:visible'),
    cont.locator('button:has(svg[aria-label*="calendar" i])'),
    cont.locator('svg[aria-label*="calendar" i]').first(),
  ], 500);
  return { input, icon };
}

async function clearMaskHard(input: Locator) {
  await input.click({ force: true });
  await input.press('Meta+a').catch(()=>{});
  await input.press('Control+a').catch(()=>{});
  await input.press('Backspace').catch(()=>{});
  await input.fill('');
}

async function typeDateDigits(input: Locator, d:number, m:number, y:number, hh?:number, mm?:number) {
  const dd  = String(d).padStart(2, '0');
  const MM  = String(m).padStart(2, '0');
  const yy2 = String(y).slice(-2);
  const yyyy = String(y);
  const HH  = hh != null ? String(hh).padStart(2,'0') : '';
  const mm2 = mm != null ? String(mm).padStart(2,'0') : '';

  // Limpieza agresiva (anti “31/” pre-seteado)
  await clearMaskHard(input);
  const pre = (await input.inputValue().catch(()=> '')).trim();
  if (/^31\//.test(pre) && d !== 31) await clearMaskHard(input);

  for (const ch of `${dd}${MM}${yy2}${HH}${mm2}`) await input.type(ch, { delay: T.TYPE });
  await input.press('Tab').catch(()=>{});
  await input.blur().catch(()=>{});

  const okNow = await (async () => {
    const val = (await input.inputValue().catch(()=> '')).trim();
    const mDate = /\b(\d{2})\/(\d{2})\/(\d{2}|\d{4})\b/.exec(val);
    const okTime = (hh != null && mm != null) ? /\b\d{2}:\d{2}\b/.test(val) : true;
    if (!mDate || !okTime) return false;
    const [_, day, mon, year] = mDate;
    return day === dd && mon === MM && (year === yy2 || year === yyyy);
  })();
  if (okNow) return true;

  const time = (hh != null && mm != null) ? ` ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}` : '';
  for (const candidate of [`${dd}/${MM}/${yyyy}${time}`, `${dd}/${MM}/${yy2}${time}`]) {
    await setNativeValue(input, candidate);
    const val = (await input.inputValue().catch(()=> '')).trim();
    const okT = (hh != null && mm != null) ? /\b\d{2}:\d{2}\b/.test(val) : true;
    if (val.includes(`${dd}/${MM}/`) && okT) return true;
  }
  return false;
}

async function openCalendar(input: Locator, icon: Locator | null) {
  const page = input.page();
  if (icon) { await icon.click({ force: true }); }
  else {
    await input.click({ force: true });
    await input.press('ArrowDown').catch(()=>{});
    await page.waitForTimeout(60);
  }
  const pop = await firstVisible(page, [
    page.locator('.ant-picker-dropdown:visible'),
    page.getByRole('dialog').filter({ has: page.locator('[role="grid"], table') }),
    page.locator('.dx-overlay-content:visible'),
  ], T.DIALOG);
  return pop;
}

async function navigateMonthYear(pop: Locator, m:number, y:number) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const page = pop.page();
  const header = pop.locator('.ant-picker-header-view, .dx-calendar-caption, .MuiPickersCalendarHeader-label').first();
  const nextBtn = pop.locator('.ant-picker-header-next-btn, button[aria-label*="next"], .dx-calendar-next-view').first();
  const prevBtn = pop.locator('.ant-picker-header-prev-btn, button[aria-label*="prev"], .dx-calendar-previous-view').first();

  async function getMY() {
    const txt = (await header.innerText().catch(()=> '')).toLowerCase();
    const idx = meses.findIndex(x => txt.includes(x)) + 1;
    const yy = parseInt((txt.match(/\d{4}/)?.[0] || ''),10);
    return { m: idx || m, y: yy || y };
  }

  for (let i=0;i<30;i++){
    const { m:cm, y:cy } = await getMY();
    if (cm === m && cy === y) break;
    const diff = (y - cy) * 12 + (m - cm);
    if (diff > 0) await nextBtn.click({ force:true }); else await prevBtn.click({ force:true });
    await page.waitForTimeout(80);
    if (i === 29) throw new Error('No pude llegar al mes/año solicitado');
  }
}

async function pickFechaCalendar(cont: Locator, d:number, m:number, y:number, hh?:number, mm?:number) {
  const { input, icon } = await locateFecha(cont);
  if (!input) return false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const pop = await openCalendar(input, icon);
    if (!pop) return false;

    await navigateMonthYear(pop, m, y);

    const dayInner = pop
      .locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled) .ant-picker-cell-inner')
      .filter({ hasText: String(d) })
      .first();

    await expect(dayInner).toBeVisible({ timeout: 1500 });
    await dayInner.click({ force: true });

    if (hh != null && mm != null) {
      const H = String(hh).padStart(2,'0');
      const M = String(mm).padStart(2,'0');
      const hourCol = pop.locator('.ant-picker-time-panel-column').nth(0);
      const minCol  = pop.locator('.ant-picker-time-panel-column').nth(1);
      if (await hourCol.isVisible().catch(()=>false))
        await hourCol.locator(`.ant-picker-time-panel-cell-inner:text-is("${H}")`).first().click({ force:true }).catch(()=>{});
      if (await minCol.isVisible().catch(()=>false))
        await minCol.locator(`.ant-picker-time-panel-cell-inner:text-is("${M}")`).first().click({ force:true }).catch(()=>{});
    }

    const okBtn = await firstVisible(pop.page(), [
      pop.getByRole('button', { name: /^ok$/i }),
      pop.getByRole('button', { name: /^aceptar$/i }),
      pop.locator('.ant-picker-ok button'),
    ], 600);
    if (okBtn) await okBtn.click({ force:true }); else await pop.page().keyboard.press('Enter').catch(()=>{});
    await pop.waitFor({ state: 'hidden', timeout: 4000 }).catch(()=>{});

    const dd  = String(d).padStart(2,'0');
    const MM  = String(m).padStart(2,'0');
    const yy2 = String(y).slice(-2);
    const yyyy = String(y);
    const time = (hh != null && mm != null) ? ` ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}` : '';

    let val = (await input.inputValue().catch(()=> '')).trim();
    let ok = (val.includes(`${dd}/${MM}/`) && (hh == null || /\b\d{2}:\d{2}\b/.test(val)));
    if (ok) return true;

    for (const candidate of [`${dd}/${MM}/${yyyy}${time}`, `${dd}/${MM}/${yy2}${time}`]) {
      await setNativeValue(input, candidate);
      val = (await input.inputValue().catch(()=> '')).trim();
      const okT = (hh != null && mm != null) ? /\b\d{2}:\d{2}\b/.test(val) : true;
      if (val.includes(`${dd}/${MM}/`) && okT) return true;
    }
  }
  return false;
}

async function setFechaPreferEscribir(cont: Locator, d:number, m:number, y:number, hh?:number, mm?:number) {
  const { input } = await locateFecha(cont);
  if (!input) return false;

  let ok = await typeDateDigits(input, d, m, y, hh, mm);
  const val = await input.inputValue().catch(()=> '');
  if (!ok || (/^31\//.test(val) && d !== 31)) {
    ok = await pickFechaCalendar(cont, d, m, y, hh, mm);
  }
  return ok;
}

/** ========= TEST principal ========= */
test('Activos: Nuevo → Tipo=Máquina + Nombre + Clave + Herramienta + Notas + Ubicación + Fecha (25/12/2025 05:32)', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

  const menu = await mustVisible(
    page,
    [
      page.getByRole('link', { name: /^Activos$/i }),
      page.locator('nav a:has-text("Activos")'),
      page.locator('a[href*="activo"]:has-text("Activos")'),
    ],
    'No encontré el menú Activos'
  );
  await menu.click();

  const cont = await openNuevoActivoRapido(page);

  expect(await pickTipoMaquina(cont), 'No pude seleccionar Tipo = "Máquina"').toBeTruthy();

  const nombre = await mustVisible(
    page,
    [
      cont.getByLabel(/^nombre$/i),
      cont.locator('label:has-text("Nombre")').locator('..').locator('input:visible').first(),
    ],
    'Campo Nombre'
  );
  await fillText(nombre, `Activo demo ${Date.now()}`);

  const clave = await firstVisible(page, [
    cont.getByLabel(/^clave$/i),
    cont.locator('label:has-text("Clave")').locator('..').locator('input:visible').first(),
  ]);
  if (clave) await fillText(clave, `CLV-${String(Date.now()).slice(-6)}`);

  expect(await setHerramienta(cont, true), 'No pude activar "Es una herramienta"').toBeTruthy();

  expect(await writeNotas(cont, 'Notas auto: creado por Playwright (demo).')).toBeTruthy();

  expect(
    await setUbicacionStock(
      cont,
      'Almacen Central Bs As',
      'CorrientesStock',
      'Chubut01',
      'Chubutt',
      'Tierra del Fuego'
    ),
    'No pude seleccionar la Ubicación'
  ).toBeTruthy();

  expect(
    await setFechaPreferEscribir(cont, 25, 12, 2025, 5, 32),
    'No pude setear la fecha 25/12/2025 05:32'
  ).toBeTruthy();

  const crear = await mustVisible(
    page,
    [
      cont.getByRole('button', { name: /crear\s+activo/i }),
      cont.getByRole('button', { name: /^crear$/i }),
      cont.getByRole('button', { name: /guardar/i }),
      cont.locator('button:has-text("Crear Activo"), button:has-text("Crear"), button:has-text("Guardar")').first(),
    ],
    'No encontré el botón Crear/Guardar'
  );
  await crear.click();

  await cont.waitFor({ state:'hidden', timeout: 12_000 }).catch(()=>{});
  expect(await cont.isVisible().catch(()=>false)).toBeFalsy();
});