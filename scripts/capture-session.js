const { chromium } = require('@playwright/test');
require('dotenv').config();
(async () => {
  const base = (process.env.BASE_URL || '').trim();
  if (!base) throw new Error('Falta BASE_URL en .env');
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await browser.newPage();
  await page.goto(`${base}/auth/login?returnTo=%2Fdashboard`);
  console.log('➡️ Logueate MANUALMENTE. Cuando veas /dashboard, volvé y apretá Enter…');
  process.stdin.resume();
  process.stdin.once('data', async () => {
    await page.context().storageState({ path: 'storageState.json' });
    console.log('✅ Sesión guardada en storageState.json');
    await browser.close(); process.exit(0);
  });
})();
