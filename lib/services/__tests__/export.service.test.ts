import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../export.service';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createMockSupabase() {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single', 'maybeSingle', 'is'];
  for (const m of methods) {
    chainable[m] = vi.fn().mockImplementation(() => chainable);
  }

  const from = vi.fn().mockReturnValue(chainable);

  const storageDownload = vi.fn();
  const storage = {
    from: vi.fn().mockReturnValue({
      download: storageDownload,
    }),
  };

  const supabase = { from, storage } as unknown as SupabaseClient;
  return { supabase, from, chainable, storageDownload, storage };
}

// ---------- fixtures ----------
const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const PATIENT_ID = '00000000-0000-0000-0000-000000000002';

const sampleFiles = [
  {
    id: 'f1',
    patient_id: PATIENT_ID,
    owner_id: OWNER_ID,
    file_name: 'xray.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    storage_path: `${OWNER_ID}/${PATIENT_ID}/xray.pdf`,
    folder_id: null,
    tags: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'f2',
    patient_id: PATIENT_ID,
    owner_id: OWNER_ID,
    file_name: 'bloodwork.pdf',
    file_size: 2048,
    mime_type: 'application/pdf',
    storage_path: `${OWNER_ID}/${PATIENT_ID}/bloodwork.pdf`,
    folder_id: null,
    tags: ['lab'],
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  },
];

// ---------- tests ----------
describe('ExportService', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let service: ExportService;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    service = new ExportService(mock.supabase, OWNER_ID);
  });

  describe('exportPatientFiles', () => {
    it('should return error when file listing fails', async () => {
      // Mock FileRepository.listByPatient to return an error
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await service.exportPatientFiles(PATIENT_ID);

      expect(result.data).toBeNull();
      expect(result.error).toBe('Database error');
      expect(result.fileCount).toBe(0);
    });

    it('should return error when no files exist for patient', async () => {
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.order.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await service.exportPatientFiles(PATIENT_ID);

      expect(result.data).toBeNull();
      expect(result.error).toBe('No files to export');
      expect(result.fileCount).toBe(0);
    });

    it('should return error when null files returned', async () => {
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.order.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.exportPatientFiles(PATIENT_ID);

      expect(result.data).toBeNull();
      expect(result.error).toBe('No files to export');
      expect(result.fileCount).toBe(0);
    });

    it('should generate a ZIP with all patient files', async () => {
      // Mock file listing
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.order.mockResolvedValueOnce({
        data: sampleFiles,
        error: null,
      });

      // Mock storage downloads
      const mockBlob1 = new Blob(['xray-data'], { type: 'application/pdf' });
      const mockBlob2 = new Blob(['blood-data'], { type: 'application/pdf' });
      mock.storageDownload
        .mockResolvedValueOnce({ data: mockBlob1, error: null })
        .mockResolvedValueOnce({ data: mockBlob2, error: null });

      const result = await service.exportPatientFiles(PATIENT_ID);

      expect(result.error).toBeNull();
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.fileCount).toBe(2);
      expect(mock.storage.from).toHaveBeenCalledWith('patient-files');
    });

    it('should handle partial download failures gracefully', async () => {
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.order.mockResolvedValueOnce({
        data: sampleFiles,
        error: null,
      });

      // First file succeeds, second fails
      const mockBlob = new Blob(['xray-data'], { type: 'application/pdf' });
      mock.storageDownload
        .mockResolvedValueOnce({ data: mockBlob, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Download failed' } });

      const result = await service.exportPatientFiles(PATIENT_ID);

      expect(result.error).toBeNull();
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.fileCount).toBe(1); // Only 1 of 2 succeeded
    });

    it('should return error when all downloads fail', async () => {
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.order.mockResolvedValueOnce({
        data: sampleFiles,
        error: null,
      });

      // Both files fail to download
      mock.storageDownload
        .mockResolvedValueOnce({ data: null, error: { message: 'Fail 1' } })
        .mockResolvedValueOnce({ data: null, error: { message: 'Fail 2' } });

      const result = await service.exportPatientFiles(PATIENT_ID);

      expect(result.data).toBeNull();
      expect(result.error).toBe('Failed to download any files');
      expect(result.fileCount).toBe(0);
    });
  });
});
