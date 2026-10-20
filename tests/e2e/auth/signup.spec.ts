import { test, expect } from '../../fixtures/auth';

test.describe('Authentication — Signup Flow', () => {
  test('should display signup form with all required fields', async ({ signupPage }) => {
    await signupPage.goto();
    await expect(signupPage.displayNameInput).toBeVisible();
    await expect(signupPage.emailInput).toBeVisible();
    await expect(signupPage.passwordInput).toBeVisible();
    await expect(signupPage.submitButton).toBeVisible();
  });

  test('should show validation errors when submitted with empty fields', async ({ signupPage }) => {
    await signupPage.goto();
    await signupPage.submitButton.click();

    await signupPage.expectValidationError('Name must be at least 2 characters');
  });

  test('should show validation error for password under 6 characters', async ({ signupPage }) => {
    await signupPage.goto();
    await signupPage.displayNameInput.fill('Dr. Test');
    await signupPage.emailInput.fill('test@medilink.test');
    await signupPage.passwordInput.fill('123');
    await signupPage.submitButton.click();

    await signupPage.expectValidationError('Password must be at least 6 characters');
  });

  test('should navigate to login page when clicking Sign In link', async ({ signupPage, page }) => {
    await signupPage.goto();
    await signupPage.loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
