import { type Page, type Locator, expect } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  // Profile Editor locators
  readonly displayNameInput: Locator;
  readonly specialtyInput: Locator;
  readonly slugInput: Locator;
  readonly saveProfileButton: Locator;
  readonly successMessage: Locator;

  // Team locators
  readonly teamEmailInput: Locator;
  readonly teamRoleSelect: Locator;
  readonly teamAccessSelect: Locator;
  readonly inviteButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.displayNameInput = page.locator('#displayName');
    this.specialtyInput = page.locator('#specialty');
    this.slugInput = page.locator('#slug');
    this.saveProfileButton = page.getByRole('button', { name: /Save Profile/i });
    this.successMessage = page.locator('text=Profile saved!');

    this.teamEmailInput = page.locator('#staff-email');
    this.teamRoleSelect = page.locator('#staff-role');
    this.teamAccessSelect = page.locator('#staff-permissions');
    this.inviteButton = page.getByRole('button', { name: 'Invite' });
  }

  async goto(section?: 'profile' | 'team' | 'billing') {
    if (section) {
      await this.page.goto(`/settings/${section}`);
    } else {
      await this.page.goto('/settings');
    }
  }

  async updateProfile(data: { displayName?: string; specialty?: string; slug?: string }) {
    if (data.displayName) await this.displayNameInput.fill(data.displayName);
    if (data.specialty) await this.specialtyInput.fill(data.specialty);
    if (data.slug) await this.slugInput.fill(data.slug);
    await this.saveProfileButton.click();
  }

  async expectProfileSaved() {
    await expect(this.successMessage).toBeVisible();
  }

  async inviteTeamMember(email: string, role: 'receptionist' | 'assistant' = 'receptionist', permissions: 'view' | 'edit' = 'view') {
    await this.teamEmailInput.fill(email);
    await this.teamRoleSelect.selectOption(role);
    await this.teamAccessSelect.selectOption(permissions);
    await this.inviteButton.click();
  }
}
