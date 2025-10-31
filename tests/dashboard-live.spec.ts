import { test, expect } from '@playwright/test';

test('live: abrir dashboard con contenido', async ({ page }) => {
  // 1) Ir directo al dashboard (ya estás logueado por global-setup)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  // 2) Esperar a que desaparezca un posible loader/spinner (tolerante)
  const loader = page.locator(
    '[data-testid*="loader" i], [data-testid*="loading" i], ' +
    '[class*="loader" i], [class*="loading" i], [class*="spinner" i], ' +
    '[role="progressbar"]'
  );
  await loader.first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});

  // 3) Confirmar que hay algo típico del dashboard visible (varios candidatos)
  const candidatos = [
    page.getByRole('button', { name: /editar dashboard/i }),
    page.getByRole('heading').first(),
    page.locator('[data-testid="dashboard-title"]'),
    page.locator('text=/Activos|Componentes|Insumos|Programas|Solicitudes/i').first()
  ];

  let ok = false;
  for (const loc of candidatos) {
    try {
      await expect(loc).toBeVisible({ timeout: 8000 });
      ok = true;
      break;
    } catch {}
  }
  expect(ok).toBeTruthy();

  // 4) Dejarlo visible un ratito para mostrarle a tu jefe
  await page.waitForTimeout(5000);
});
