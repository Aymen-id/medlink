import { type Page, type Locator, expect } from '@playwright/test';

export class SearchPage {
  readonly page: Page;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input[data-testid="search-input"]');
  }

  async goto(query?: string) {
    if (query) {
      await this.page.goto(`/search?q=${encodeURIComponent(query)}`);
    } else {
      await this.page.goto('/search');
    }
  }

  async searchFromTopBar(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  async expectResult(name: string) {
    await expect(this.page.locator(`text=${name}`).first()).toBeVisible();
  }

  async expectEmptyResults() {
    await expect(this.page.locator('text=No results')).toBeVisible();
  }

  async clickResult(name: string) {
    await this.page.locator('a', { hasText: name }).first().click();
  }
}
