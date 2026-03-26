import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileRepository } from '../file.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createChainable() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'ilike', 'contains', 'or', 'order', 'range', 'single'];
  for (const m of methods) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
}

function createMockSupabase() {
  const chainable = createChainable();

  const storageBucket = {
    upload: vi.fn(),
    remove: vi.fn(),
    createSignedUrl: vi.fn(),
    getPublicUrl: vi.fn(),
  };

  const storage = {
    from: vi.fn().mockReturnValue(storageBucket),
  };

  const rpc = vi.fn();
  const from = vi.fn().mockReturnValue(chainable);
  const supabase = { from, storage, rpc } as unknown as SupabaseClient;

  return { supabase, from, chainable, storage, storageBucket, rpc };
}

// ---------- fixtures ----------
const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const PATIENT_ID = '00000000-0000-0000-0000-000000000010';
const FOLDER_ID = '00000000-0000-0000-0000-000000000020';

const sampleFile = {
  id: '00000000-0000-0000-0000-000000000100',
  patient_id: PATIENT_ID,
  folder_id: null,
  file_name: 'blood-results.pdf',
  storage_path: `${OWNER_ID}/${PATIENT_ID}/blood-results.pdf`,
  mime_type: 'application/pdf',
  size_bytes: 102400,
  tags: ['lab', 'blood'],
  created_at: '2025-01-01T00:00:00Z',
};

// ---------- tests ----------
describe('FileRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let repo: FileRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    repo = new FileRepository(mock.supabase, OWNER_ID);
  });

  // -------- UPLOAD --------
  describe('upload', () => {
    it('should upload file to storage and insert a record into patient_files', async () => {
      const fileBuffer = new ArrayBuffer(1024);
      const file = new File([fileBuffer], 'blood-results.pdf', { type: 'application/pdf' });

      mock.storageBucket.upload.mockResolvedValueOnce({
        data: { path: `${OWNER_ID}/${PATIENT_ID}/blood-results.pdf` },
        error: null,
      });
      mock.chainable.single.mockResolvedValueOnce({ data: sampleFile, error: null });

      const result = await repo.upload({
        patientId: PATIENT_ID,
        file,
        folderId: null,
        tags: ['lab', 'blood'],
      });

      expect(mock.storage.from).toHaveBeenCalledWith('patient-files');
      expect(mock.storageBucket.upload).toHaveBeenCalledWith(
        expect.stringContaining(`${OWNER_ID}/${PATIENT_ID}/`),
        file,
        expect.objectContaining({ contentType: 'application/pdf' }),
      );
      expect(mock.from).toHaveBeenCalledWith('patient_files');
      expect(mock.chainable.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: PATIENT_ID,
          file_name: 'blood-results.pdf',
          tags: ['lab', 'blood'],
        }),
      );
      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should return error when storage upload fails', async () => {
      const file = new File([''], 'fail.pdf', { type: 'application/pdf' });

      mock.storageBucket.upload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Storage quota exceeded' },
      });

      const result = await repo.upload({ patientId: PATIENT_ID, file });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Storage quota exceeded');
    });

    it('should return error when DB insert fails after successful upload', async () => {
      const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });

      mock.storageBucket.upload.mockResolvedValueOnce({
        data: { path: 'some/path' },
        error: null,
      });
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await repo.upload({ patientId: PATIENT_ID, file });

      expect(result.data).toBeNull();
      expect(result.error).toBe('DB error');
    });

    it('should include folderId when provided', async () => {
      const file = new File(['data'], 'scan.jpg', { type: 'image/jpeg' });

      mock.storageBucket.upload.mockResolvedValueOnce({
        data: { path: 'some/path' },
        error: null,
      });
      mock.chainable.single.mockResolvedValueOnce({ data: { ...sampleFile, folder_id: FOLDER_ID }, error: null });

      await repo.upload({ patientId: PATIENT_ID, file, folderId: FOLDER_ID });

      expect(mock.chainable.insert).toHaveBeenCalledWith(
        expect.objectContaining({ folder_id: FOLDER_ID }),
      );
    });
  });

  // -------- LIST BY PATIENT --------
  describe('listByPatient', () => {
    it('should list files for a specific patient', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [sampleFile],
        error: null,
      });

      const result = await repo.listByPatient(PATIENT_ID);

      expect(mock.from).toHaveBeenCalledWith('patient_files');
      expect(mock.chainable.select).toHaveBeenCalled();
      expect(mock.chainable.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].fileName).toBe('blood-results.pdf');
      expect(result.error).toBeNull();
    });

    it('should filter by folderId when provided', async () => {
      mock.chainable.order.mockResolvedValueOnce({ data: [], error: null });

      await repo.listByPatient(PATIENT_ID, { folderId: FOLDER_ID });

      expect(mock.chainable.eq).toHaveBeenCalledWith('folder_id', FOLDER_ID);
    });

    it('should filter root-level files (no folder) when folderId is null', async () => {
      mock.chainable.order.mockResolvedValueOnce({ data: [], error: null });

      await repo.listByPatient(PATIENT_ID, { folderId: null });

      expect(mock.chainable.is).toHaveBeenCalledWith('folder_id', null);
    });

    it('should return error on failure', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Select error' },
      });

      const result = await repo.listByPatient(PATIENT_ID);

      expect(result.data).toEqual([]);
      expect(result.error).toBe('Select error');
    });
  });

  // -------- SEARCH --------
  describe('search', () => {
    it('should search files by name across all patient files for the owner', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [sampleFile],
        error: null,
      });

      const result = await repo.search('blood');

      expect(mock.from).toHaveBeenCalledWith('patient_files');
      expect(mock.chainable.ilike).toHaveBeenCalledWith('file_name', '%blood%');
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('should return empty array for no matches', async () => {
      mock.chainable.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await repo.search('nonexistent');

      expect(result.data).toEqual([]);
    });
  });

  // -------- SEARCH BY TAGS --------
  describe('searchByTags', () => {
    it('should find files matching any of the provided tags', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [sampleFile],
        error: null,
      });

      const result = await repo.searchByTags(PATIENT_ID, ['lab']);

      expect(mock.from).toHaveBeenCalledWith('patient_files');
      expect(mock.chainable.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID);
      expect(mock.chainable.contains).toHaveBeenCalledWith('tags', ['lab']);
      expect(result.data).toHaveLength(1);
    });
  });

  // -------- UPDATE TAGS --------
  describe('updateTags', () => {
    it('should update tags for a file', async () => {
      // First call: fetchOwnedFile (ownership verification)
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: sampleFile, error: null });
      // Second call: actual update
      const updateChain = createChainable();
      const updatedFile = { ...sampleFile, tags: ['lab', 'blood', 'urgent'] };
      updateChain.single.mockResolvedValueOnce({ data: updatedFile, error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(updateChain);

      const result = await repo.updateTags(sampleFile.id, ['lab', 'blood', 'urgent']);

      expect(updateChain.update).toHaveBeenCalledWith({ tags: ['lab', 'blood', 'urgent'] });
      expect(result.data?.tags).toContain('urgent');
      expect(result.error).toBeNull();
    });
  });

  // -------- MOVE FILE --------
  describe('moveToFolder', () => {
    it('should update folder_id for a file', async () => {
      // First call: fetchOwnedFile
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: sampleFile, error: null });
      // Second call: update
      const updateChain = createChainable();
      const movedFile = { ...sampleFile, folder_id: FOLDER_ID };
      updateChain.single.mockResolvedValueOnce({ data: movedFile, error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(updateChain);

      const result = await repo.moveToFolder(sampleFile.id, FOLDER_ID);

      expect(updateChain.update).toHaveBeenCalledWith({ folder_id: FOLDER_ID });
      expect(result.data?.folderId).toBe(FOLDER_ID);
      expect(result.error).toBeNull();
    });

    it('should allow moving to root (null folder)', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: sampleFile, error: null });
      const updateChain = createChainable();
      const movedFile = { ...sampleFile, folder_id: null };
      updateChain.single.mockResolvedValueOnce({ data: movedFile, error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(updateChain);

      const result = await repo.moveToFolder(sampleFile.id, null);

      expect(updateChain.update).toHaveBeenCalledWith({ folder_id: null });
      expect(result.data?.folderId).toBeNull();
    });
  });

  // -------- DELETE --------
  describe('delete', () => {
    it('should delete file from storage and database record', async () => {
      // Build separate chainables for the fetch and delete calls
      const fetchChain = createChainable();
      const deleteChain = createChainable();

      // First from() call: fetch file (select -> eq -> single)
      fetchChain.single.mockResolvedValueOnce({ data: sampleFile, error: null });
      // Second from() call: delete record (delete -> eq)
      deleteChain.eq.mockResolvedValueOnce({ error: null });

      mock.from
        .mockReturnValueOnce(fetchChain)   // fetch
        .mockReturnValueOnce(deleteChain); // delete

      mock.storageBucket.remove.mockResolvedValueOnce({ error: null });

      const result = await repo.delete(sampleFile.id);

      expect(mock.storageBucket.remove).toHaveBeenCalledWith([sampleFile.storage_path]);
      expect(result.error).toBeNull();
    });

    it('should return error if file not found for deletion', async () => {
      const fetchChain = createChainable();
      fetchChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });
      mock.from.mockReturnValueOnce(fetchChain);

      const result = await repo.delete('bad-id');

      expect(result.error).toBe('Not found');
    });
  });

  // -------- GET SIGNED URL --------
  describe('getSignedUrl', () => {
    it('should return a signed URL for a file', async () => {
      mock.chainable.single.mockResolvedValueOnce({ data: sampleFile, error: null });
      mock.storageBucket.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.example.com/signed/path' },
        error: null,
      });

      const result = await repo.getSignedUrl(sampleFile.id);

      expect(mock.storage.from).toHaveBeenCalledWith('patient-files');
      expect(mock.storageBucket.createSignedUrl).toHaveBeenCalledWith(
        sampleFile.storage_path,
        3600,
      );
      expect(result.data).toBe('https://storage.example.com/signed/path');
      expect(result.error).toBeNull();
    });
  });

  // -------- COUNT BY OWNER --------
  describe('countByOwner', () => {
    it('should count all files for the owner across all patients', async () => {
      mock.rpc.mockResolvedValueOnce({
        data: 42,
        error: null,
      });

      const result = await repo.countByOwner();

      expect(result.data).toBe(42);
      expect(result.error).toBeNull();
    });

    it('should use fallback query when RPC is not available', async () => {
      mock.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'function not found' },
      });

      // Fallback path: query patient_files joined via patients
      const fallbackChain = createChainable();
      fallbackChain.single.mockResolvedValueOnce({
        data: null,
        error: null,
        count: 5,
      });
      mock.from.mockReturnValueOnce(fallbackChain);

      const result = await repo.countByOwner();

      expect(result.error).toBeNull();
    });
  });
});
