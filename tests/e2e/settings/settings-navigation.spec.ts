import { test, expect } from '../../fixtures/auth';

test.describe('Settings — Navigation & Route Protection', () => {
  test('should redirect unauthenticated users from /settings to /login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated users from /settings/profile to /login', async ({ page }) => {
    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated users from /settings/team to /login', async ({ page }) => {
    await page.goto('/settings/team');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated users from /settings/billing to /login', async ({ page }) => {
    await page.goto('/settings/billing');
    await expect(page).toHaveURL(/\/login/);
  });
});
