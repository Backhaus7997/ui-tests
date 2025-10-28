import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async assertLoaded() {
    const title = this.page.locator('[data-testid="dashboard-title"]');
    if (await title.count() > 0) {
      await expect(title).toBeVisible();
    } else {
      await expect(this.page.locator('h1')).toHaveText(/dashboard/i);
    }
  }
}