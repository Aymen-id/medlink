import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { PatientsPage } from '../pages/PatientsPage';
import { PatientDetailPage } from '../pages/PatientDetailPage';
import { SearchPage } from '../pages/SearchPage';
import { SettingsPage } from '../pages/SettingsPage';
import { PublicProfilePage } from '../pages/PublicProfilePage';
import { requireLogin } from '../helpers/require-login';

type MediLinkFixtures = {
  loginPage: LoginPage;
  signupPage: SignupPage;
  patientsPage: PatientsPage;
  patientDetailPage: PatientDetailPage;
  searchPage: SearchPage;
  settingsPage: SettingsPage;
  publicProfilePage: PublicProfilePage;
  authenticatedPage: Page;
};

export const test = base.extend<MediLinkFixtures>({
  loginPage: async ({ page }, provide) => {
    await provide(new LoginPage(page));
  },
  signupPage: async ({ page }, provide) => {
    await provide(new SignupPage(page));
  },
  patientsPage: async ({ page }, provide) => {
    await provide(new PatientsPage(page));
  },
  patientDetailPage: async ({ page }, provide) => {
    await provide(new PatientDetailPage(page));
  },
  searchPage: async ({ page }, provide) => {
    await provide(new SearchPage(page));
  },
  settingsPage: async ({ page }, provide) => {
    await provide(new SettingsPage(page));
  },
  publicProfilePage: async ({ page }, provide) => {
    await provide(new PublicProfilePage(page));
  },

  authenticatedPage: async ({ browser }, provide) => {
    const context=await browser.newContext();
    try {
      const page=await context.newPage();
      await requireLogin(page,{ email:process.env.TEST_USER_EMAIL,password:process.env.TEST_USER_PASSWORD });
      await provide(page);
    } finally { await context.close(); }
  },
});

export { expect } from '@playwright/test';
