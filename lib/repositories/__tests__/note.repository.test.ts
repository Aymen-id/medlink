import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteRepository } from '../note.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createChainable() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'range', 'single'];
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
const AUTHOR_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_ID = '00000000-0000-0000-0000-000000000001'; // same as author for owner case
const PATIENT_ID = '00000000-0000-0000-0000-000000000010';

const sampleNote = {
  id: '00000000-0000-0000-0000-000000000200',
  patient_id: PATIENT_ID,
  content: 'Follow-up appointment: blood pressure normal. Prescribed Lisinopril 10mg.',
  author_id: AUTHOR_ID,
  created_at: '2025-06-15T14:30:00Z',
};

const secondNote = {
  id: '00000000-0000-0000-0000-000000000201',
  patient_id: PATIENT_ID,
  content: 'Patient reported mild headache. Recommended rest.',
  author_id: AUTHOR_ID,
  created_at: '2025-06-20T10:00:00Z',
};

// ---------- tests ----------
describe('NoteRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let repo: NoteRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    repo = new NoteRepository(mock.supabase, AUTHOR_ID, OWNER_ID);
  });

  // -------- CREATE --------
  describe('create', () => {
    it('should verify patient ownership then create a note', async () => {
      // First call: verifyPatientOwnership
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: { id: PATIENT_ID }, error: null });
      // Second call: actual insert
      const insertChain = createChainable();
      insertChain.single.mockResolvedValueOnce({ data: sampleNote, error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(insertChain);

      const result = await repo.create({
        patientId: PATIENT_ID,
        content: sampleNote.content,
      });

      // Verify ownership check
      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(verifyChain.eq).toHaveBeenCalledWith('id', PATIENT_ID);
      expect(verifyChain.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);

      // Verify insert
      expect(mock.from).toHaveBeenCalledWith('appointment_notes');
      expect(result.data?.content).toBe(sampleNote.content);
      expect(result.data?.authorId).toBe(AUTHOR_ID);
      expect(result.error).toBeNull();
    });

    it('should return error if patient not owned', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
      mock.from.mockReturnValueOnce(verifyChain);

      const result = await repo.create({
        patientId: PATIENT_ID,
        content: 'Some note',
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Patient not found or access denied');
    });

    it('should return error on failed insert', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: { id: PATIENT_ID }, error: null });
      const insertChain = createChainable();
      insertChain.single.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(insertChain);

      const result = await repo.create({
        patientId: PATIENT_ID,
        content: 'Some note',
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Insert failed');
    });
  });

  // -------- LIST BY PATIENT --------
  describe('listByPatient', () => {
    it('should list notes with ownership filter', async () => {
      mock.chainable.range.mockResolvedValueOnce({
        data: [secondNote, sampleNote],
        error: null,
        count: 2,
      });

      const result = await repo.listByPatient(PATIENT_ID);

      expect(mock.from).toHaveBeenCalledWith('appointment_notes');
      expect(mock.chainable.select).toHaveBeenCalledWith('*, patients!inner(owner_id)', { count: 'exact' });
      expect(mock.chainable.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID);
      expect(mock.chainable.eq).toHaveBeenCalledWith('patients.owner_id', OWNER_ID);
      expect(result.data).toHaveLength(2);
      expect(result.error).toBeNull();
    });

    it('should support pagination', async () => {
      mock.chainable.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      await repo.listByPatient(PATIENT_ID, { page: 2, limit: 5 });

      expect(mock.chainable.range).toHaveBeenCalledWith(5, 9);
    });

    it('should return error on failure', async () => {
      mock.chainable.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'Permission denied' },
        count: null,
      });

      const result = await repo.listByPatient(PATIENT_ID);

      expect(result.data).toEqual([]);
      expect(result.error).toBe('Permission denied');
    });
  });

  // -------- UPDATE --------
  describe('update', () => {
    it('should verify note ownership then update content', async () => {
      // First call: verifyNoteOwnership
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: sampleNote, error: null });
      // Second call: update
      const updateChain = createChainable();
      const updatedNote = { ...sampleNote, content: 'Updated content' };
      updateChain.single.mockResolvedValueOnce({ data: updatedNote, error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(updateChain);

      const result = await repo.update(sampleNote.id, { content: 'Updated content' });

      expect(result.data?.content).toBe('Updated content');
      expect(result.error).toBeNull();
    });

    it('should return error if note not owned', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      mock.from.mockReturnValueOnce(verifyChain);

      const result = await repo.update('bad-id', { content: 'x' });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Note not found or access denied');
    });
  });

  // -------- DELETE --------
  describe('delete', () => {
    it('should verify note ownership then delete', async () => {
      // First call: verifyNoteOwnership
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: sampleNote, error: null });
      // Second call: delete
      const deleteChain = createChainable();
      deleteChain.eq.mockResolvedValueOnce({ error: null });

      mock.from
        .mockReturnValueOnce(verifyChain)
        .mockReturnValueOnce(deleteChain);

      const result = await repo.delete(sampleNote.id);

      expect(result.error).toBeNull();
    });

    it('should return error if note not owned', async () => {
      const verifyChain = createChainable();
      verifyChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      mock.from.mockReturnValueOnce(verifyChain);

      const result = await repo.delete('bad-id');
      expect(result.error).toBe('Note not found or access denied');
    });
  });
});
