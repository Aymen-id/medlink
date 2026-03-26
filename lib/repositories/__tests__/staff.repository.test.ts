import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaffRepository } from '../staff.repository';
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
    single: vi.fn().mockReturnThis(),
  };

  const from = vi.fn().mockReturnValue(chainable);
  const supabase = { from } as unknown as SupabaseClient;

  return { supabase, from, chainable };
}

// ---------- fixtures ----------
const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const STAFF_USER_ID = '00000000-0000-0000-0000-000000000099';

const sampleAccess = {
  id: '00000000-0000-0000-0000-000000000300',
  owner_id: OWNER_ID,
  staff_user_id: STAFF_USER_ID,
  role: 'receptionist',
  permissions: 'view',
  granted_at: '2025-01-01T00:00:00Z',
};

// ---------- tests ----------
describe('StaffRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let repo: StaffRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    repo = new StaffRepository(mock.supabase, OWNER_ID);
  });

  // -------- GRANT BY ID --------
  describe('grantById', () => {
    it('should grant staff access and return mapped data', async () => {
      mock.chainable.single.mockResolvedValueOnce({ data: sampleAccess, error: null });

      const result = await repo.grantById(STAFF_USER_ID, 'receptionist', 'view');

      expect(mock.from).toHaveBeenCalledWith('staff_access');
      expect(mock.chainable.insert).toHaveBeenCalledWith({
        owner_id: OWNER_ID,
        staff_user_id: STAFF_USER_ID,
        role: 'receptionist',
        permissions: 'view',
      });
      expect(result.data?.staffUserId).toBe(STAFF_USER_ID);
      expect(result.data?.role).toBe('receptionist');
      expect(result.error).toBeNull();
    });

    it('should prevent self-grant', async () => {
      const result = await repo.grantById(OWNER_ID, 'receptionist', 'view');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Cannot grant staff access to yourself');
    });

    it('should return error on duplicate grant', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'duplicate key value' },
      });

      const result = await repo.grantById(STAFF_USER_ID, 'receptionist', 'view');

      expect(result.data).toBeNull();
      expect(result.error).toBe('duplicate key value');
    });
  });

  // -------- LIST --------
  describe('list', () => {
    it('should list staff members for the owner', async () => {
      mock.chainable.order.mockResolvedValueOnce({
        data: [sampleAccess],
        error: null,
      });

      const result = await repo.list();

      expect(mock.from).toHaveBeenCalledWith('staff_access');
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });
  });

  // -------- UPDATE --------
  describe('update', () => {
    it('should update staff role and permissions with owner_id filter', async () => {
      const updated = { ...sampleAccess, role: 'assistant', permissions: 'edit' };
      mock.chainable.single.mockResolvedValueOnce({ data: updated, error: null });

      const result = await repo.update(sampleAccess.id, {
        role: 'assistant',
        permissions: 'edit',
      });

      expect(mock.chainable.update).toHaveBeenCalledWith({
        role: 'assistant',
        permissions: 'edit',
      });
      expect(mock.chainable.eq).toHaveBeenCalledWith('id', sampleAccess.id);
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(result.data?.role).toBe('assistant');
      expect(result.error).toBeNull();
    });
  });

  // -------- REVOKE --------
  describe('revoke', () => {
    it('should revoke staff access with owner_id filter', async () => {
      mock.chainable.eq
        .mockReturnValueOnce(mock.chainable)
        .mockResolvedValueOnce({ error: null });

      const result = await repo.revoke(sampleAccess.id);

      expect(mock.from).toHaveBeenCalledWith('staff_access');
      expect(mock.chainable.delete).toHaveBeenCalled();
      expect(mock.chainable.eq).toHaveBeenCalledWith('id', sampleAccess.id);
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(result.error).toBeNull();
    });
  });

  // -------- REVOKE BY USER ID --------
  describe('revokeByUserId', () => {
    it('should revoke by staff user id with owner_id filter', async () => {
      mock.chainable.eq
        .mockReturnValueOnce(mock.chainable)
        .mockResolvedValueOnce({ error: null });

      const result = await repo.revokeByUserId(STAFF_USER_ID);

      expect(mock.chainable.eq).toHaveBeenCalledWith('staff_user_id', STAFF_USER_ID);
      expect(mock.chainable.eq).toHaveBeenCalledWith('owner_id', OWNER_ID);
      expect(result.error).toBeNull();
    });
  });
});
