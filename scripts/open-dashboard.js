const { chromium } = require('@playwright/test');
require('dotenv').config();

(async () => {
  const base = (process.env.BASE_URL || '').trim();
  const browser = await chromium.launch({ headless: false, args: ['--incognito'] });
  const context = await browser.newContext({ storageState: 'storageState.json' });
  const page = await context.newPage();
  await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' });
  console.log('✅ Dashboard abierto. Cerrá la ventana cuando termines la demo.');
})();
