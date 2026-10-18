import { test, expect } from '../../fixtures/auth';

test.describe('Search — Protection and Validation', () => {
  test('should redirect unauthenticated users visiting /search to /login', async ({ page }) => {
    await page.goto('/search?q=test');
    await expect(page).toHaveURL(/\/login/);
  });
});
