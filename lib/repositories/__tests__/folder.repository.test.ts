import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FolderRepository } from '../folder.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createChainable() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'single'];
  for (const m of methods) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
}

function createMockSupabase() {
  const chainable = createChainable();
  const from = vi.fn().mockReturnValue(chainable);
  const supabase = { from } as unknown as SupabaseClient;

  return { supabase, from, chainable };
}

// ---------- fixtures ----------
const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const PATIENT_ID = '00000000-0000-0000-0000-000000000010';

const sampleFolder = {
  id: '00000000-0000-0000-0000-000000000020',
  patient_id: PATIENT_ID,
  name: 'Lab Results',
  parent_id: null,
  created_at: '2025-01-01T00:00:00Z',
};

const childFolder = {
  id: '00000000-0000-0000-0000-000000000021',
  patient_id: PATIENT_ID,
  name: 'Blood Work',
  parent_id: sampleFolder.id,
  created_at: '2025-01-02T00:00:00Z',
};

// ---------- tests ----------
describe('FolderRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let repo: FolderRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    repo = new FolderRepository(mock.supabase, OWNER_ID);
  });

  // -------- CREATE --------
  describe('create', () => {
    it('should verify patient ownership then create a root folder', async () => {
      // First call: verifyPatientOwnership
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: { id: PATIENT_ID }, error: null });
      // Second call: actual insert
      const insertChain = createChainable();
      insertChain.single.mockResolvedValueOnce({ data: sampleFolder, error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(insertChain);

      const result = await repo.create({
        patientId: PATIENT_ID,
        name: 'Lab Results',
        parentId: null,
      });

      // Verify ownership check happened
      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(verifyChain.eq).toHaveBeenCalledWith('id', PATIENT_ID);
      expect(verifyChain.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);

      // Verify insert happened
      expect(mock.from).toHaveBeenCalledWith('folders');
      expect(result.data?.name).toBe('Lab Results');
      expect(result.error).toBeNull();
    });

    it('should return error if patient not owned', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
      mock.from.mockReturnValueOnce(verifyChain);

      const result = await repo.create({
        patientId: PATIENT_ID,
        name: 'Lab Results',
        parentId: null,
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Patient not found or access denied');
    });

    it('should create a nested folder with parentId', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: { id: PATIENT_ID }, error: null });
      const insertChain = createChainable();
      insertChain.single.mockResolvedValueOnce({ data: childFolder, error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(insertChain);

      const result = await repo.create({
        patientId: PATIENT_ID,
        name: 'Blood Work',
        parentId: sampleFolder.id,
      });

      expect(result.data?.parentId).toBe(sampleFolder.id);
    });
  });

  // -------- LIST BY PATIENT --------
  describe('listByPatient', () => {
    it('should list all folders for a patient with ownership filter', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [sampleFolder, childFolder],
        error: null,
      });

      const result = await repo.listByPatient(PATIENT_ID);

      expect(mock.from).toHaveBeenCalledWith('folders');
      expect(mock.chainable.select).toHaveBeenCalledWith('*, patients!inner(owner_id)');
      expect(mock.chainable.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID);
      expect(mock.chainable.eq).toHaveBeenCalledWith('patients.owner_id', OWNER_ID);
      expect(result.data).toHaveLength(2);
      expect(result.error).toBeNull();
    });

    it('should filter by parentId when provided (root folders)', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [sampleFolder],
        error: null,
      });

      await repo.listByPatient(PATIENT_ID, { parentId: null });

      expect(mock.chainable.is).toHaveBeenCalledWith('parent_id', null);
    });

    it('should filter by parentId when provided (specific parent)', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [childFolder],
        error: null,
      });

      await repo.listByPatient(PATIENT_ID, { parentId: sampleFolder.id });

      expect(mock.chainable.eq).toHaveBeenCalledWith('parent_id', sampleFolder.id);
    });
  });

  // -------- RENAME --------
  describe('rename', () => {
    it('should verify ownership then rename a folder', async () => {
      // First call: ownership verification via join
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: sampleFolder, error: null });
      // Second call: actual update
      const updateChain = createChainable();
      const renamed = { ...sampleFolder, name: 'Lab Reports' };
      updateChain.single.mockResolvedValueOnce({ data: renamed, error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(updateChain);

      const result = await repo.rename(sampleFolder.id, 'Lab Reports');

      expect(result.data?.name).toBe('Lab Reports');
    });

    it('should return error if folder not owned', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      mock.from.mockReturnValueOnce(verifyChain);

      const result = await repo.rename(sampleFolder.id, 'Lab Reports');
      expect(result.data).toBeNull();
      expect(result.error).toBe('Folder not found or access denied');
    });
  });

  // -------- DELETE --------
  describe('delete', () => {
    it('should verify ownership then delete a folder', async () => {
      // First call: ownership verification
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: sampleFolder, error: null });
      // Second call: delete
      const deleteChain = createChainable();
      deleteChain.eq.mockResolvedValueOnce({ error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(deleteChain);

      const result = await repo.delete(sampleFolder.id);

      expect(result.error).toBeNull();
    });

    it('should return error if folder not owned', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      mock.from.mockReturnValueOnce(verifyChain);

      const result = await repo.delete(sampleFolder.id);
      expect(result.error).toBe('Folder not found or access denied');
    });
  });
});
