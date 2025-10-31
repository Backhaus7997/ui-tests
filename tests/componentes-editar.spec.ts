import { test, expect, Page, Locator } from '@playwright/test';

/* ========== Timings ========== */
const T = { TEST: 60_000, WAIT: 3_000, DIALOG: 7_000, TYPE: 1 };
test.setTimeout(T.TEST);

/* ========== Helpers mínimos ========== */
async function firstVisible(page: Page, locs: Locator[], timeout = T.WAIT): Promise<Locator | null> {
  for (const loc of locs) {
    try { await expect(loc).toBeVisible({ timeout }); return loc; } catch {}
  }
  return null;
}
async function mustVisible(page: Page, locs: Locator[], msg: string, timeout = T.WAIT): Promise<Locator> {
  const l = await firstVisible(page, locs, timeout);
  expect(l, msg).toBeTruthy();
  return l!;
}
async function fillText(input: Locator, value: string) {
  await input.click({ force: true });
  await input.fill('');
  await input.type(value, { delay: T.TYPE });
  await input.press('Tab').catch(() => {});
}

/* ========== Navegación a Componentes ========== */
async function gotoComponentes(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  const menu = await mustVisible(
    page,
    [
      page.getByRole('link', { name: /^Componentes$/i }),
      page.locator('nav a:has-text("Componentes")'),
      page.locator('a[href*="/dashboard/component"]').first(),
    ],
    'No encontré el menú Componentes'
  );
  await menu.click();
  // Esperar que cargue la grilla
  await mustVisible(
    page,
    [
      page.locator('.dx-datagrid, .dx-datagrid-rowsview'),
      page.getByRole('grid'),
    ],
    'No cargó la grilla de Componentes',
    T.DIALOG
  );
}

/* ========== Buscar fila que contenga "demo" ========== */
async function findRowConDemo(page: Page): Promise<Locator | null> {
  // 1) Intento directo: alguna fila visible con "demo"
  const row = await firstVisible(
    page,
    [
      page.locator('.dx-datagrid-rowsview .dx-row').filter({ hasText: /demo/i }).first(),
      page.locator('tr').filter({ hasText: /demo/i }).first(),
      page.getByRole('row', { name: /demo/i }).first(),
    ],
    2000
  );
  if (row) return row;

  // 2) Fallback: usar filtro de la columna "Nombre" si existe
  const filtro = await firstVisible(
    page,
    [
      page.locator('.dx-datagrid-headers .dx-datagrid-filter-row .dx-texteditor-input:visible').first(),
      page.locator('.dx-searchbox input:visible').first(),
      page.locator('thead input:visible').first(),
    ],
    1500
  );
  if (filtro) {
    await filtro.fill('');
    await filtro.type('demo');
    await page.keyboard.press('Enter').catch(()=>{});
    await page.waitForTimeout(300);
    return await firstVisible(
      page,
      [
        page.locator('.dx-datagrid-rowsview .dx-row').filter({ hasText: /demo/i }).first(),
        page.locator('tr').filter({ hasText: /demo/i }).first(),
      ],
      2000
    );
  }
  return null;
}

/* ========== Click en el lápiz de esa fila ========== */
async function clickEditOnRow(row: Locator): Promise<void> {
  const page = row.page();

  // Asegurar visibilidad de la fila y de los action-buttons
  try { await row.scrollIntoViewIfNeeded(); } catch {}
  try { await row.hover({ force: true }); } catch {}
  await page.waitForTimeout(80);

  // 1) Heurística por posición: botón con aria-label=Editar que caiga dentro del alto de la fila
  const rowBox = await row.boundingBox();
  if (rowBox) {
    const edits = page.locator(
      'button[aria-label*="editar" i], [role="button"][aria-label*="editar" i]'
    );
    const n = await edits.count();
    for (let i = 0; i < n; i++) {
      const btn = edits.nth(i);
      try {
        await expect(btn).toBeVisible({ timeout: 800 });
        const box = await btn.boundingBox();
        if (!box) continue;
        const centerY = box.y + box.height / 2;
        const withinRowY =
          centerY >= rowBox.y - 2 && centerY <= rowBox.y + rowBox.height + 2;
        if (withinRowY) {
          await btn.click({ force: true });
          // Verificá que abrió el editor (form con Nombre + Guardar Cambios)
          const ok = await firstVisible(page, [
            page.locator('form:visible').filter({ has: page.getByLabel(/^nombre$/i) }).first(),
            page.getByRole('button', { name: /guardar\s+cambios/i }).first(),
          ], 1500);
          if (ok) return;
        }
      } catch { /* probamos el siguiente */ }
    }
  }

  // 2) Fallback: buscar dentro de la fila (por si el botón sí es hijo directo)
  const editInRow = await firstVisible(page, [
    row.getByRole('button', { name: /editar/i }).first(),
    row.locator('button[aria-label*="editar" i], button[title*="editar" i]').first(),
    row.locator('td:last-child button').first(),
  ], 1200);

  if (editInRow) {
    await editInRow.click({ force: true });
    const ok = await firstVisible(page, [
      page.locator('form:visible').filter({ has: page.getByLabel(/^nombre$/i) }).first(),
      page.getByRole('button', { name: /guardar\s+cambios/i }).first(),
    ], 1500);
    if (ok) return;
  }

  throw new Error('No encontré el botón de editar (lápiz) en la fila');
}

/* ========== Editar Nombre y Clave (no tocar Tipo) ========== */
async function editarCamposYGuardar(page: Page) {
  // Espera al ABM (página o drawer)
  const cont = await mustVisible(
    page,
    [
      page.locator('form:visible').first(),
      page.getByRole('dialog').locator('form').first(),
      page.locator('.ant-modal-content form:visible').first(),
      page.locator('.MuiDrawer-paper:visible form').first(),
    ],
    'No se abrió el formulario de edición',
    T.DIALOG
  );

  // Inputs
  const nombre = await mustVisible(
    page,
    [
      cont.getByLabel(/^nombre$/i),
      cont.locator('label:has-text("Nombre")').locator('..').locator('input:visible').first(),
    ],
    'No encontré el campo Nombre'
  );
  const clave = await firstVisible(
    page,
    [
      cont.getByLabel(/^clave$/i),
      cont.locator('label:has-text("Clave")').locator('..').locator('input:visible').first(),
    ],
    1500
  );

  // Nuevos valores (pequeño sufijo)
  const stamp = Date.now().toString().slice(-4);
  const oldNombre = await nombre.inputValue().catch(()=> '');
  await fillText(nombre, `${oldNombre} - edit${stamp}`);
  if (clave) {
    const oldClave = await clave.inputValue().catch(()=> '');
    await fillText(clave, `${oldClave}-E${stamp}`);
  }

  // Guardar Cambios
  const guardar = await mustVisible(
    page,
    [
      cont.getByRole('button', { name: /guardar\s+cambios/i }),
      cont.getByRole('button', { name: /^guardar$/i }),
    ],
    'No encontré el botón Guardar Cambios'
  );
  await guardar.click({ force: true });

  // Espera retorno a grilla o cierre de drawer
  await Promise.race([
    page.waitForURL(/\/dashboard\/component(\/grid)?/i, { timeout: 8000 }).catch(()=>{}),
    cont.waitFor({ state: 'hidden', timeout: 8000 }).catch(()=>{}),
  ]);
}

/* ========== TEST ========== */
test('Componentes: editar un item que contenga "demo" (modificar Nombre y Clave, dejar Tipo)', async ({ page }) => {
  await gotoComponentes(page);

  const row = await findRowConDemo(page);
  expect(row, 'No encontré ningún componente con "demo" en el nombre').toBeTruthy();

  await clickEditOnRow(row!);
  await editarCamposYGuardar(page);

  // Verificación suave: grilla visible de nuevo
  const grid = await firstVisible(page, [page.locator('.dx-datagrid, .dx-datagrid-rowsview'), page.getByRole('grid')], 4000);
  expect(grid, 'No volvió a la grilla luego de guardar').toBeTruthy();
});