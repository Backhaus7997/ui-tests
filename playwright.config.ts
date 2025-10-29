import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: require.resolve('./tests/global-setup'),
  use: {
    baseURL: process.env.BASE_URL,
    storageState: 'storageState.json', // todos los tests arrancan logueados
    headless: false,
  },
});
