import { test, expect } from '../../fixtures/auth';
import { PatientsPage } from '../../pages/PatientsPage';

test.describe('Patients — Management and Protection', () => {
  test('should redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display patient creation modal fields properly when opened', async ({ authenticatedPage }) => {
    const patientsPage = new PatientsPage(authenticatedPage);
    await patientsPage.goto();

    await expect(authenticatedPage).toHaveURL(/\/patients/);
    await patientsPage.openNewPatientDialog();
    await expect(patientsPage.firstNameInput).toBeVisible();
    await expect(patientsPage.lastNameInput).toBeVisible();
    await expect(patientsPage.dobInput).toBeVisible();
    await expect(patientsPage.savePatientButton).toBeVisible();
  });
});
