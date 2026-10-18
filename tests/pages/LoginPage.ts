import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signupLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.text-red-600');
    this.signupLink = page.locator('a[href="/signup"]');
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.page.locator('h1')).toContainText('Welcome back');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectErrorMessage(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async expectValidationError(message: string) {
    await expect(this.page.locator('.text-red-500', { hasText: message })).toBeVisible();
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL(/\/patients/);
  }
}
