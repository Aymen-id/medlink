import { type Page, type Locator, expect } from '@playwright/test';

export class PatientDetailPage {
  readonly page: Page;
  readonly filesTab: Locator;
  readonly notesTab: Locator;
  readonly uploadFileButton: Locator;
  readonly fileInput: Locator;
  readonly tagsInput: Locator;
  readonly uploadSubmitButton: Locator;
  readonly newFolderButton: Locator;
  readonly folderNameInput: Locator;
  readonly createFolderSubmitButton: Locator;
  readonly noteTextarea: Locator;
  readonly saveNoteButton: Locator;
  readonly exportZipButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filesTab = page.getByRole('tab', { name: 'Files & Folders' });
    this.notesTab = page.getByRole('tab', { name: 'Appointment Notes' });
    this.uploadFileButton = page.getByRole('button', { name: /Upload File/i });
    this.fileInput = page.locator('input#file');
    this.tagsInput = page.locator('input#tags');
    this.uploadSubmitButton = page.locator('button[type="submit"]:has-text("Upload")');
    this.newFolderButton = page.getByRole('button', { name: /New Folder/i });
    this.folderNameInput = page.locator('input[placeholder="Folder Name"]');
    this.createFolderSubmitButton = page.locator('button[type="submit"]:has-text("Create Folder")');
    this.noteTextarea = page.locator('textarea');
    this.saveNoteButton = page.getByRole('button', { name: 'Save Note' });
    this.exportZipButton = page.getByRole('link', { name: 'Export All Files (ZIP)' });
  }

  async goto(patientId: string) {
    await this.page.goto(`/patients/${patientId}`);
  }

  async uploadFile(filePath: string, tags?: string) {
    await this.uploadFileButton.click();
    await this.fileInput.setInputFiles(filePath);
    if (tags) {
      await this.tagsInput.fill(tags);
    }
    // Listen for alert if upload fails or succeeds
    const dialogPromise = this.page.waitForEvent('dialog', { timeout: 10_000 }).catch(() => null);
    await this.uploadSubmitButton.click();
    const dialog = await dialogPromise;
    if (dialog) {
      const message = dialog.message();
      await dialog.accept();
      return message;
    }
    return null;
  }

  async expectFileInList(fileName: string) {
    await expect(this.page.locator('table')).toContainText(fileName);
  }

  async createFolder(name: string) {
    await this.newFolderButton.click();
    await this.folderNameInput.fill(name);
    await this.createFolderSubmitButton.click();
  }

  async expectFolderInList(name: string) {
    await expect(this.page.locator('table')).toContainText(name);
  }

  async switchToNotesTab() {
    await this.notesTab.click();
    await expect(this.noteTextarea).toBeVisible();
  }

  async addNote(content: string) {
    await this.switchToNotesTab();
    await this.noteTextarea.fill(content);
    await this.saveNoteButton.click();
  }

  async expectNoteInTimeline(content: string) {
    await expect(this.page.locator('div', { hasText: content }).first()).toBeVisible();
  }
}
