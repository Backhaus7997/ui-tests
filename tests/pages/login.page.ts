import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async login(email: string, password: string) {
    const emailInput = this.page.getByLabel(/email/i).or(this.page.getByTestId('login-email'));
    const passInput  = this.page.getByLabel(/password|contraseña/i).or(this.page.getByTestId('login-password'));
    const loginBtn   = this.page.getByRole('button', { name: /ingresar|login|entrar/i }).or(this.page.getByTestId('login-submit'));

    await emailInput.fill(email);
    await passInput.fill(password);
    await loginBtn.click();
  }
}