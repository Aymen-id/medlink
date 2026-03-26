import type { SupabaseClient } from '@supabase/supabase-js';
import { FileRepository } from '@/lib/repositories/file.repository';
import JSZip from 'jszip';

export type ExportResult = {
  data: Blob | null;
  error: string | null;
  fileCount: number;
};

export class ExportService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string,
  ) {}

  /**
   * Generates a ZIP file containing all files for a given patient.
   * Verifies ownership through the FileRepository (defense-in-depth).
   */
  async exportPatientFiles(patientId: string): Promise<ExportResult> {
    const repo = new FileRepository(this.supabase, this.ownerId);

    // Fetch all files across all folders for this patient
    const { data: files, error } = await repo.listByPatient(patientId);

    if (error) {
      return { data: null, error, fileCount: 0 };
    }

    if (!files || files.length === 0) {
      return { data: null, error: 'No files to export', fileCount: 0 };
    }

    const zip = new JSZip();
    let downloadedCount = 0;

    // Download files concurrently and add to ZIP
    await Promise.all(
      files.map(async (f) => {
        const { data: fileData } = await this.supabase.storage
          .from('patient-files')
          .download(f.storagePath);

        if (fileData) {
          // Prefix with ID to prevent name collisions
          zip.file(`${f.id}_${f.fileName}`, fileData);
          downloadedCount++;
        }
      }),
    );

    if (downloadedCount === 0) {
      return { data: null, error: 'Failed to download any files', fileCount: 0 };
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    return { data: zipBlob, error: null, fileCount: downloadedCount };
  }
}
