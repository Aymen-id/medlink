import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatientRepository } from '../patient.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    // terminal resolvers — these are awaited
    then: undefined as unknown,
  };

  const from = vi.fn().mockReturnValue(chainable);
  const rpc = vi.fn();
  const supabase = { from, rpc } as unknown as SupabaseClient;

  return { supabase, from, chainable, rpc };
}

// ---------- fixtures ----------
const OWNER_ID = '00000000-0000-0000-0000-000000000001';

const samplePatient = {
  id: '00000000-0000-0000-0000-000000000010',
  owner_id: OWNER_ID,
  first_name: 'Jane',
  last_name: 'Doe',
  date_of_birth: '1990-01-15',
  gender: 'Female',
  phone: '+1234567890',
  email: 'jane@example.com',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// ---------- tests ----------
describe('PatientRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let repo: PatientRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    repo = new PatientRepository(mock.supabase, OWNER_ID);
  });

  // -------- CREATE --------
  describe('create', () => {
    it('should insert a patient for the current owner and return mapped data', async () => {
      mock.chainable.single.mockResolvedValueOnce({ data: samplePatient, error: null });

      const result = await repo.create({
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-01-15',
        gender: 'Female',
        phone: '+1234567890',
        email: 'jane@example.com',
      });

      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(mock.chainable.insert).toHaveBeenCalledWith({
        owner_id: OWNER_ID,
        first_name: 'Jane',
        last_name: 'Doe',
        date_of_birth: '1990-01-15',
        gender: 'Female',
        phone: '+1234567890',
        email: 'jane@example.com',
      });
      expect(mock.chainable.select).toHaveBeenCalled();
      expect(mock.chainable.single).toHaveBeenCalled();
      expect(result.data).toEqual({
        id: samplePatient.id,
        ownerId: OWNER_ID,
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-01-15',
        gender: 'Female',
        phone: '+1234567890',
        email: 'jane@example.com',
        createdAt: samplePatient.created_at,
        updatedAt: samplePatient.updated_at,
      });
      expect(result.error).toBeNull();
    });

    it('should return error on failed insert', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      const result = await repo.create({ firstName: 'Jane', lastName: 'Doe' });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Insert failed');
    });

    it('should handle minimal input (only required fields)', async () => {
      const minimal = { ...samplePatient, date_of_birth: null, gender: null, phone: null, email: null };
      mock.chainable.single.mockResolvedValueOnce({ data: minimal, error: null });

      const result = await repo.create({ firstName: 'Jane', lastName: 'Doe' });

      expect(mock.chainable.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Jane',
          last_name: 'Doe',
          owner_id: OWNER_ID,
        }),
      );
      expect(result.error).toBeNull();
    });
  });

  // -------- GET BY ID --------
  describe('getById', () => {
    it('should fetch a single patient by id', async () => {
      mock.chainable.single.mockResolvedValueOnce({ data: samplePatient, error: null });

      const result = await repo.getById(samplePatient.id);

      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(mock.chainable.select).toHaveBeenCalled();
      expect(mock.chainable.eq).toHaveBeenCalledWith('id', samplePatient.id);
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(result.data?.firstName).toBe('Jane');
      expect(result.error).toBeNull();
    });

    it('should return error when patient not found', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Row not found' },
      });

      const result = await repo.getById('nonexistent-id');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Row not found');
    });
  });

  // -------- LIST --------
  describe('list', () => {
    it('should list patients for the owner with default pagination', async () => {
      const patients = [samplePatient];
      // For list, the chain terminates without .single()
      mock.chainable.range.mockResolvedValueOnce({
        data: patients,
        error: null,
        count: 1,
      });

      const result = await repo.list();

      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(mock.chainable.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(mock.chainable.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mock.chainable.range).toHaveBeenCalledWith(0, 24); // page 1, limit 25 -> range(0,24)
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('should respect page and limit parameters', async () => {
      mock.chainable.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      await repo.list({ page: 3, limit: 10 });

      expect(mock.chainable.range).toHaveBeenCalledWith(20, 29); // (3-1)*10=20, 20+10-1=29
    });

    it('should return error on list failure', async () => {
      mock.chainable.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'Permission denied' },
        count: null,
      });

      const result = await repo.list();

      expect(result.data).toEqual([]);
      expect(result.error).toBe('Permission denied');
    });
  });

  // -------- SEARCH --------
  describe('search', () => {
    it('should search patients by first or last name (ilike)', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [samplePatient],
        error: null,
      });

      const result = await repo.search('Jan');

      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(mock.chainable.select).toHaveBeenCalled();
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(mock.chainable.or).toHaveBeenCalledWith(
        'first_name.ilike.%Jan%,last_name.ilike.%Jan%',
      );
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('should return empty array when no match', async () => {
      mock.chainable.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await repo.search('ZZZ');
      expect(result.data).toEqual([]);
    });
  });

  // -------- UPDATE --------
  describe('update', () => {
    it('should update patient fields', async () => {
      const updated = { ...samplePatient, first_name: 'Janet' };
      mock.chainable.single.mockResolvedValueOnce({ data: updated, error: null });

      const result = await repo.update(samplePatient.id, { firstName: 'Janet' });

      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(mock.chainable.update).toHaveBeenCalledWith(
        expect.objectContaining({ first_name: 'Janet' }),
      );
      expect(mock.chainable.eq).toHaveBeenCalledWith('id', samplePatient.id);
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(result.data?.firstName).toBe('Janet');
      expect(result.error).toBeNull();
    });

    it('should return error on update failure', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await repo.update('bad-id', { firstName: 'X' });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Not found');
    });
  });

  // -------- DELETE --------
  describe('delete', () => {
    it('should delete a patient by id with ownership filter', async () => {
      // The delete chain: .delete().eq('id', ...).eq('owner_id', ...)
      // The second .eq() needs to resolve
      mock.chainable.eq
        .mockReturnValueOnce(mock.chainable) // first eq returns chainable
        .mockResolvedValueOnce({ error: null }); // second eq resolves

      const result = await repo.delete(samplePatient.id);

      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(mock.chainable.delete).toHaveBeenCalled();
      expect(mock.chainable.eq).toHaveBeenCalledWith('id', samplePatient.id);
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(result.error).toBeNull();
    });

    it('should return error on delete failure', async () => {
      mock.chainable.eq
        .mockReturnValueOnce(mock.chainable)
        .mockResolvedValueOnce({
          error: { message: 'Delete failed' },
        });

      const result = await repo.delete('bad-id');

      expect(result.error).toBe('Delete failed');
    });
  });

  // -------- COUNT --------
  describe('count', () => {
    it('should return total patient count for the owner', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: { count: 42 },
        error: null,
        count: 42,
      });

      const result = await repo.count();

      expect(mock.from).toHaveBeenCalledWith('patients');
      expect(mock.chainable.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(result.data).toBe(42);
      expect(result.error).toBeNull();
    });
  });
});
