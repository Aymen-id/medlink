// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { ExportService } from '../export.service';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createMockSupabase() {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'range', 'single', 'maybeSingle', 'is'];
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
    size_bytes: 9,
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
    size_bytes: 10,
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
    it('extracts a representative 16 MiB archive byte-for-byte',async()=>{
      const started=performance.now(),rss=process.memoryUsage().rss;
      const sources=[Buffer.alloc(8*1024*1024,13),Buffer.alloc(8*1024*1024,97)];
      mock.chainable.range.mockResolvedValueOnce({ data:sampleFiles.map((file,index)=>({ ...file,size_bytes:sources[index].length })),error:null });
      for(const source of sources) mock.storageDownload.mockResolvedValueOnce({ data:new Blob([source]),error:null });
      const result=await service.exportPatientFiles(PATIENT_ID);
      expect(result.error).toBeNull();
      const zip=await JSZip.loadAsync(await new Response(result.data).arrayBuffer());
      expect(Buffer.compare(await zip.file('f1_xray.pdf')!.async('nodebuffer'),sources[0])).toBe(0);
      expect(Buffer.compare(await zip.file('f2_bloodwork.pdf')!.async('nodebuffer'),sources[1])).toBe(0);
      process.stdout.write(`Local 16 MiB export: ${Math.round(performance.now()-started)} ms, RSS delta ${Math.round((process.memoryUsage().rss-rss)/1024/1024)} MiB\n`);
    });
    it('rejects oversized synchronous exports before downloading',async()=>{
      mock.chainable.range.mockResolvedValueOnce({ data:[{ ...sampleFiles[0],size_bytes:101*1024*1024 }],error:null });
      const result=await service.exportPatientFiles(PATIENT_ID);
      expect(result.error).toContain('100 MiB');
      expect(mock.storageDownload).not.toHaveBeenCalled();
    });
    it('bounds concurrent downloads to three',async()=>{
      mock.chainable.range.mockResolvedValueOnce({ data:Array.from({ length:10 },(_,index)=>({ ...sampleFiles[0],id:`file-${index}`,size_bytes:1 })),error:null });
      let active=0,maximum=0;
      mock.storageDownload.mockImplementation(async()=>{ active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return { data:new Blob(['x']),error:null }; });
      const result=await service.exportPatientFiles(PATIENT_ID);
      expect(result.error).toBeNull();expect(maximum).toBeLessThanOrEqual(3);
      await new Response(result.data).arrayBuffer();
    });
    it('should return error when file listing fails', async () => {
      // Mock FileRepository.listByPatient to return an error
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.range.mockResolvedValueOnce({
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
      mock.chainable.range.mockResolvedValueOnce({
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
      mock.chainable.range.mockResolvedValueOnce({
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
      mock.chainable.range.mockResolvedValueOnce({
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
      expect(result.data).toBeInstanceOf(ReadableStream);
      const bytes=await new Response(result.data).arrayBuffer();
      const zip=await JSZip.loadAsync(bytes);
      expect(await zip.file('f1_xray.pdf')?.async('uint8array')).toEqual(new TextEncoder().encode('xray-data'));
      expect(await zip.file('f2_bloodwork.pdf')?.async('uint8array')).toEqual(new TextEncoder().encode('blood-data'));
      expect(result.fileCount).toBe(2);
      expect(mock.storage.from).toHaveBeenCalledWith('patient-files');
    });

    it('fails explicitly rather than returning an incomplete archive', async () => {
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.range.mockResolvedValueOnce({
        data: sampleFiles,
        error: null,
      });

      // First file succeeds, second fails
      const mockBlob = new Blob(['xray-data'], { type: 'application/pdf' });
      mock.storageDownload
        .mockResolvedValueOnce({ data: mockBlob, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Download failed' } });

      const result = await service.exportPatientFiles(PATIENT_ID);

      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
      expect(result.fileCount).toBe(0);
    });

    it('should return error when all downloads fail', async () => {
      mock.chainable.eq.mockReturnValue(mock.chainable);
      mock.chainable.range.mockResolvedValueOnce({
        data: sampleFiles,
        error: null,
      });

      // Both files fail to download
      mock.storageDownload
        .mockResolvedValueOnce({ data: null, error: { message: 'Fail 1' } })
        .mockResolvedValueOnce({ data: null, error: { message: 'Fail 2' } });

      const result = await service.exportPatientFiles(PATIENT_ID);

      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.fileCount).toBe(0);
    });
  });
});
