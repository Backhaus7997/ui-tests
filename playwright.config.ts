import 'dotenv/config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 1,
  workers: 4,
  use: {
    baseURL: process.env.BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: 'storageState.json'
  },
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  globalSetup: require.resolve('./tests/global-setup'),
  // Si querés que Playwright levante tu app automáticamente, descomenta:
  // webServer: {
  //   command: 'npm run dev', // o 'docker compose up -d'
  //   url: process.env.BASE_URL!,
  //   reuseExistingServer: true,
  //   timeout: 120_000
  // }
});