import { chromium } from '@playwright/test';
import 'dotenv/config';

export default async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(process.env.BASE_URL! + '/dashboard', { waitUntil: 'domcontentloaded' });

    if (/\/auth\/login/i.test(page.url()) && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const email = page.getByRole('textbox', { name: 'Email' });
      const pass  = page.getByRole('textbox', { name: 'Password' });
      const submit = page.getByRole('button', { name: 'Login' });
      await email.fill(process.env.ADMIN_EMAIL);
      await pass.fill(process.env.ADMIN_PASSWORD);
      await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), submit.click()]);
      if (!/\/dashboard/i.test(page.url())) {
        await page.goto(process.env.BASE_URL! + '/dashboard', { waitUntil: 'domcontentloaded' });
      }
    }
  } finally {
    await page.context().storageState({ path: 'storageState.json' });
    await browser.close();
  }
};
