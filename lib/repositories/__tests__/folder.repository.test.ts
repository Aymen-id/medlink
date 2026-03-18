import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FolderRepository } from '../folder.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };

  const from = vi.fn().mockReturnValue(chainable);
  const supabase = { from } as unknown as SupabaseClient;

  return { supabase, from, chainable };
}

// ---------- fixtures ----------
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
    repo = new FolderRepository(mock.supabase);
  });

  // -------- CREATE --------
  describe('create', () => {
    it('should create a root folder for a patient', async () => {
      mock.chainable.single.mockResolvedValueOnce({ data: sampleFolder, error: null });

      const result = await repo.create({
        patientId: PATIENT_ID,
        name: 'Lab Results',
        parentId: null,
      });

      expect(mock.from).toHaveBeenCalledWith('folders');
      expect(mock.chainable.insert).toHaveBeenCalledWith({
        patient_id: PATIENT_ID,
        name: 'Lab Results',
        parent_id: null,
      });
      expect(result.data).toEqual({
        id: sampleFolder.id,
        patientId: PATIENT_ID,
        name: 'Lab Results',
        parentId: null,
        createdAt: sampleFolder.created_at,
      });
      expect(result.error).toBeNull();
    });

    it('should create a nested folder with parentId', async () => {
      mock.chainable.single.mockResolvedValueOnce({ data: childFolder, error: null });

      const result = await repo.create({
        patientId: PATIENT_ID,
        name: 'Blood Work',
        parentId: sampleFolder.id,
      });

      expect(mock.chainable.insert).toHaveBeenCalledWith(
        expect.objectContaining({ parent_id: sampleFolder.id }),
      );
      expect(result.data?.parentId).toBe(sampleFolder.id);
    });

    it('should return error on failure', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Duplicate folder name' },
      });

      const result = await repo.create({
        patientId: PATIENT_ID,
        name: 'Lab Results',
        parentId: null,
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Duplicate folder name');
    });
  });

  // -------- LIST BY PATIENT --------
  describe('listByPatient', () => {
    it('should list all folders for a patient', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [sampleFolder, childFolder],
        error: null,
      });

      const result = await repo.listByPatient(PATIENT_ID);

      expect(mock.from).toHaveBeenCalledWith('folders');
      expect(mock.chainable.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID);
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
    it('should rename a folder', async () => {
      const renamed = { ...sampleFolder, name: 'Lab Reports' };
      mock.chainable.single.mockResolvedValueOnce({ data: renamed, error: null });

      const result = await repo.rename(sampleFolder.id, 'Lab Reports');

      expect(mock.chainable.update).toHaveBeenCalledWith({ name: 'Lab Reports' });
      expect(mock.chainable.eq).toHaveBeenCalledWith('id', sampleFolder.id);
      expect(result.data?.name).toBe('Lab Reports');
    });
  });

  // -------- DELETE --------
  describe('delete', () => {
    it('should delete a folder by id', async () => {
      mock.chainable.eq.mockResolvedValueOnce({ error: null });

      const result = await repo.delete(sampleFolder.id);

      expect(mock.from).toHaveBeenCalledWith('folders');
      expect(mock.chainable.delete).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });

    it('should return error when delete fails', async () => {
      mock.chainable.eq.mockResolvedValueOnce({
        error: { message: 'Cannot delete non-empty folder' },
      });

      const result = await repo.delete(sampleFolder.id);
      expect(result.error).toBe('Cannot delete non-empty folder');
    });
  });
});
