import { type Page, type Locator, expect } from '@playwright/test';

export class SignupPage {
  readonly page: Page;
  readonly displayNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.displayNameInput = page.locator('#displayName');
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.text-red-600');
    this.loginLink = page.locator('a[href="/login"]');
  }

  async goto() {
    await this.page.goto('/signup');
    await expect(this.page.locator('h1')).toContainText('Create your account');
  }

  async signup(displayName: string, email: string, password: string) {
    if (displayName) await this.displayNameInput.fill(displayName);
    if (email) await this.emailInput.fill(email);
    if (password) await this.passwordInput.fill(password);
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

  async expectSuccess() {
    await expect(this.page).toHaveURL(/\/patients/);
  }
}
