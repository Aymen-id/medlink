import { type Page, type Locator, expect } from '@playwright/test';

export class PublicProfilePage {
  readonly page: Page;
  readonly doctorName: Locator;
  readonly specialty: Locator;
  readonly credentials: Locator;
  readonly clinicAddress: Locator;
  readonly contactButton: Locator;
  readonly bookButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.doctorName = page.locator('h1');
    this.specialty = page.locator('div:has(> svg) span.text-lg');
    this.credentials = page.locator('div:has(> svg) span.text-sm');
    this.clinicAddress = page.locator('div:has(> svg) span.text-sm');
    this.contactButton = page.locator('a:has-text("Contact"), button:has-text("Contact")');
    this.bookButton = page.locator('a:has-text("Book Appointment")');
  }

  async goto(slug: string) {
    await this.page.goto(`/${slug}`);
  }

  async expectDoctorName(name: string) {
    await expect(this.doctorName).toContainText(name);
  }

  async expectSpecialty(specialty: string) {
    await expect(this.specialty).toContainText(specialty);
  }

  async expectBookingButtonVisible() {
    await expect(this.bookButton).toBeVisible();
  }
}
