import { test, expect } from '../../fixtures/auth';

test.describe('Patients — Files and Detail Protection', () => {
  test('should redirect unauthenticated users accessing patient details to /login', async ({ page }) => {
    await page.goto('/patients/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/login/);
  });

  test('export ZIP endpoint rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/patients/00000000-0000-0000-0000-000000000000/export');
    expect([401, 307, 308]).toContain(response.status());
  });
});
