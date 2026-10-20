import { type Page, type Locator, expect } from '@playwright/test';

export class PatientsPage {
  readonly page: Page;
  readonly newPatientButton: Locator;
  readonly savePatientButton: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly dobInput: Locator;
  readonly phoneInput: Locator;
  readonly genderInput: Locator;
  readonly emailInput: Locator;
  readonly patientTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPatientButton = page.getByRole('button', { name: /New Patient|Add your first patient/i });
    this.savePatientButton = page.getByRole('button', { name: 'Save Patient' });
    this.firstNameInput = page.locator('#firstName');
    this.lastNameInput = page.locator('#lastName');
    this.dobInput = page.locator('#dateOfBirth');
    this.phoneInput = page.locator('#phone');
    this.genderInput = page.locator('#gender');
    this.emailInput = page.locator('#email');
    this.patientTable = page.locator('table');
  }

  async goto() {
    await this.page.goto('/patients');
  }

  async openNewPatientDialog() {
    await this.newPatientButton.first().click();
    await expect(this.page.getByRole('heading', { name: 'Add New Patient' })).toBeVisible();
  }

  async createPatient(data: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    phone?: string;
    gender?: string;
    email?: string;
  }) {
    await this.openNewPatientDialog();
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    if (data.dateOfBirth) await this.dobInput.fill(data.dateOfBirth);
    if (data.phone) await this.phoneInput.fill(data.phone);
    if (data.gender) await this.genderInput.fill(data.gender);
    if (data.email) await this.emailInput.fill(data.email);
    await this.savePatientButton.click();
  }

  async expectPatientInList(name: string) {
    await expect(this.page.locator('table')).toContainText(name);
  }

  async clickPatient(name: string) {
    await this.page.locator('table tr', { hasText: name }).click();
  }
}
