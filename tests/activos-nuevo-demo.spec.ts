import { test, expect, Locator, Page } from '@playwright/test';

// Helper: espera y hace click en el primer locator que exista/sea visible
async function clickFirstVisible(page: Page, locators: Locator[], timeout = 8000) {
  for (const loc of locators) {
    try {
      await expect(loc).toBeVisible({ timeout });
      await loc.click();
      return true;
    } catch {}
  }
  return false;
}

test('live: ir a Activos y presionar "Nuevo Activo"', async ({ page }) => {
  // 1) Entrar al dashboard (ya estás logueado por el global-setup)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  // 2) (Opcional) Esperar a que se vaya el loader si aparece
  const loader = page.locator(
    '[data-testid*="loader" i], [data-testid*="loading" i], ' +
    '[class*="loader" i], [class*="loading" i], [class*="spinner" i], ' +
    '[role="progressbar"]'
  );
  await loader.first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});

  // 3) Ir a "Activos" desde el menú lateral
  const candidatosMenu = [
    page.getByRole('link',     { name: /^Activos$/i }),
    page.getByRole('menuitem', { name: /Activos/i }),
    page.locator('nav :text("Activos")'),                       // Playwright text engine
    page.locator('a:has-text("Activos")'),
    page.locator('[data-testid="menu-activos"], [href*="activo"]'),
  ];
  const entroMenu = await clickFirstVisible(page, candidatosMenu, 10000);
  expect(entroMenu).toBeTruthy(); // si no encuentra el botón del menú, falla aquí

  // 4) Confirmar que cargó la vista de Activos (buscamos algo típico de esa pantalla)
  const algoDeActivos = [
    page.getByRole('heading', { name: /Activos/i }).first(),
    page.locator('[data-testid="activos-title"]'),
    page.locator('text=/Activos/i').first(),
  ];
  expect(
    await clickFirstVisible(page, algoDeActivos, 8000)
  ).toBeTruthy(); // sólo usamos el helper para "esperar a que exista algo de Activos"

  // 5) Click en "Nuevo Activo" (tolerante a variaciones)
  const nuevoBtnCandidatos = [
    page.getByRole('button', { name: /nuevo activo/i }),
    page.getByRole('link',   { name: /nuevo activo/i }),
    page.locator('button:has-text("Nuevo Activo")'),
    page.locator('a:has-text("Nuevo Activo")'),
    page.locator('[data-testid="new-asset"], [data-testid="nuevo-activo"]'),
  ];
  const clickeoNuevo = await clickFirstVisible(page, nuevoBtnCandidatos, 10000);
  expect(clickeoNuevo).toBeTruthy();

  // 6) Ver que se abrió la pantalla / modal de alta (buscamos algún campo o título típico)
  const altaAbierta = [
    page.getByRole('heading', { name: /nuevo activo|crear activo|alta de activo/i }).first(),
    page.getByRole('textbox', { name: /nombre|código|descripcion/i }).first(),
    page.locator('[data-testid="asset-form"], [data-testid="create-asset"]'),
  ];
  expect(
    await clickFirstVisible(page, altaAbierta, 8000)
  ).toBeTruthy();

  // 7) Dejarlo visible un instante para la demo
  await page.waitForTimeout(4000);
});
