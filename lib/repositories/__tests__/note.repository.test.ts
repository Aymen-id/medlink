import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteRepository } from '../note.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };

  const from = vi.fn().mockReturnValue(chainable);
  const supabase = { from } as unknown as SupabaseClient;

  return { supabase, from, chainable };
}

// ---------- fixtures ----------
const AUTHOR_ID = '00000000-0000-0000-0000-000000000001';
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
    repo = new NoteRepository(mock.supabase, AUTHOR_ID);
  });

  // -------- CREATE --------
  describe('create', () => {
    it('should create an appointment note for a patient', async () => {
      mock.chainable.single.mockResolvedValueOnce({ data: sampleNote, error: null });

      const result = await repo.create({
        patientId: PATIENT_ID,
        content: 'Follow-up appointment: blood pressure normal. Prescribed Lisinopril 10mg.',
      });

      expect(mock.from).toHaveBeenCalledWith('appointment_notes');
      expect(mock.chainable.insert).toHaveBeenCalledWith({
        patient_id: PATIENT_ID,
        content: 'Follow-up appointment: blood pressure normal. Prescribed Lisinopril 10mg.',
        author_id: AUTHOR_ID,
      });
      expect(mock.chainable.select).toHaveBeenCalled();
      expect(mock.chainable.single).toHaveBeenCalled();
      expect(result.data).toEqual({
        id: sampleNote.id,
        patientId: PATIENT_ID,
        content: sampleNote.content,
        authorId: AUTHOR_ID,
        createdAt: sampleNote.created_at,
      });
      expect(result.error).toBeNull();
    });

    it('should return error on failed creation', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

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
    it('should list notes for a patient ordered by newest first', async () => {
      mock.chainable.range.mockResolvedValueOnce({
        data: [secondNote, sampleNote],
        error: null,
        count: 2,
      });

      const result = await repo.listByPatient(PATIENT_ID);

      expect(mock.from).toHaveBeenCalledWith('appointment_notes');
      expect(mock.chainable.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mock.chainable.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID);
      expect(mock.chainable.order).toHaveBeenCalledWith('created_at', { ascending: false });
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

      expect(mock.chainable.range).toHaveBeenCalledWith(5, 9); // (2-1)*5=5, 5+5-1=9
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
    it('should update note content', async () => {
      const updatedNote = {
        ...sampleNote,
        content: 'Updated: blood pressure slightly elevated.',
      };
      mock.chainable.single.mockResolvedValueOnce({ data: updatedNote, error: null });

      const result = await repo.update(sampleNote.id, {
        content: 'Updated: blood pressure slightly elevated.',
      });

      expect(mock.from).toHaveBeenCalledWith('appointment_notes');
      expect(mock.chainable.update).toHaveBeenCalledWith({
        content: 'Updated: blood pressure slightly elevated.',
      });
      expect(mock.chainable.eq).toHaveBeenCalledWith('id', sampleNote.id);
      expect(result.data?.content).toBe('Updated: blood pressure slightly elevated.');
      expect(result.error).toBeNull();
    });

    it('should return error on update failure', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await repo.update('bad-id', { content: 'x' });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Not found');
    });
  });

  // -------- DELETE --------
  describe('delete', () => {
    it('should delete a note by id', async () => {
      mock.chainable.eq.mockResolvedValueOnce({ error: null });

      const result = await repo.delete(sampleNote.id);

      expect(mock.from).toHaveBeenCalledWith('appointment_notes');
      expect(mock.chainable.delete).toHaveBeenCalled();
      expect(mock.chainable.eq).toHaveBeenCalledWith('id', sampleNote.id);
      expect(result.error).toBeNull();
    });

    it('should return error on delete failure', async () => {
      mock.chainable.eq.mockResolvedValueOnce({
        error: { message: 'Delete failed' },
      });

      const result = await repo.delete('bad-id');
      expect(result.error).toBe('Delete failed');
    });
  });
});
