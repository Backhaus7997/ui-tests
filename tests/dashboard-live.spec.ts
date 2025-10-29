import { test, expect } from '@playwright/test';

// usa TU sesión guardada
test.use({ storageState: 'storageState.json' });

test('live: abrir dashboard con sesión de admin', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(1500); // que se vea en pantalla
  // Si querés manipular a mano desde el inspector: descomenta la línea de abajo
  // await page.pause();
});
