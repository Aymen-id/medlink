import { test, expect } from '../../fixtures/auth';

test.describe('Public Profile — Unauthenticated Access', () => {
  test('should return 404 for non-existent doctor handle', async ({ page }) => {
    const response = await page.goto('/non-existent-dr-profile-99999');
    expect(response?.status()).toBe(404);
  });
});
