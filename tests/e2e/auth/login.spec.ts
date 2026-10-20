import { test, expect } from '../../fixtures/auth';

test.describe('Authentication — Login Flow', () => {
  test('should display login page with email, password fields and sign in button', async ({ loginPage }) => {
    await loginPage.goto();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('should show validation error on invalid email', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.emailInput.fill('invalid-email');
    await loginPage.passwordInput.fill('Password123!');
    await loginPage.submitButton.click();

    await loginPage.expectValidationError('Invalid email address');
  });

  test('should show error banner when entering non-existent credentials', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('nobody_exists_12345@medilink.test', 'WrongPassword123!');
    await loginPage.expectErrorMessage();
  });

  test('should have a working link to the signup page', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });
});
