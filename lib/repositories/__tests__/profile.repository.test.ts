import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileRepository } from '../profile.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- mock builder ----------
function createChainable() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'upsert', 'eq', 'neq', 'is', 'order', 'single', 'maybeSingle'];
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

const sampleProfileRow = {
  id: OWNER_ID,
  user_id: OWNER_ID,
  slug: 'dr-smith',
  display_name: 'Dr. Jane Smith',
  specialty: 'Dermatology',
  credentials: 'MD, FAAD',
  clinic_address: '123 Medical Lane, Casablanca',
  consultation_hours: { Mon: '9:00-17:00', Tue: '9:00-17:00', Wed: '9:00-13:00' },
  contact_cta: '+212 600 000 000',
  booking_cta: 'https://cal.com/drsmith',
  avatar_url: null,
  bio: 'Board-certified dermatologist with 10 years of experience.',
  is_published: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};


// ---------- tests ----------
describe('ProfileRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let repo: ProfileRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    repo = new ProfileRepository(mock.supabase, OWNER_ID);
  });

  // -------- FIND BY SLUG (public) --------
  describe('findBySlug', () => {
    it('should return a published profile by slug', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: sampleProfileRow,
        error: null,
      });

      const result = await repo.findBySlug('dr-smith');

      expect(mock.from).toHaveBeenCalledWith('doctor_profiles');
      expect(mock.chainable.select).toHaveBeenCalled();
      expect(mock.chainable.eq).toHaveBeenCalledWith('slug', 'dr-smith');
      expect(mock.chainable.eq).toHaveBeenCalledWith('is_published', true);
      expect(result.data?.displayName).toBe('Dr. Jane Smith');
      expect(result.data?.specialty).toBe('Dermatology');
      expect(result.error).toBeNull();
    });

    it('should return null for non-existent slug', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await repo.findBySlug('non-existent');

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should return null for unpublished profile', async () => {
      // The query includes is_published=true, so Supabase returns null
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await repo.findBySlug('dr-hidden');

      expect(result.data).toBeNull();
    });

    it('should return error on database failure', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await repo.findBySlug('dr-smith');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Database error');
    });
  });

  // -------- FIND BY USER ID (owner) --------
  describe('findByUserId', () => {
    it('should return the owner\'s profile', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: sampleProfileRow,
        error: null,
      });

      const result = await repo.findByUserId();

      expect(mock.from).toHaveBeenCalledWith('doctor_profiles');
      expect(mock.chainable.eq).toHaveBeenCalledWith('user_id', OWNER_ID);
      expect(result.data?.slug).toBe('dr-smith');
      expect(result.error).toBeNull();
    });

    it('should return error when profile not found', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows found' },
      });

      const result = await repo.findByUserId();

      expect(result.data).toBeNull();
      expect(result.error).toBe('No rows found');
    });
  });

  // -------- CREATE OR UPDATE --------
  describe('createOrUpdate', () => {
    it('should upsert the profile for the owner', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: sampleProfileRow,
        error: null,
      });

      const result = await repo.createOrUpdate({
        displayName: 'Dr. Jane Smith',
        slug: 'dr-smith',
        specialty: 'Dermatology',
        credentials: 'MD, FAAD',
        clinicAddress: '123 Medical Lane, Casablanca',
        consultationHours: { Mon: '9:00-17:00' },
        contactCTA: '+212 600 000 000',
        bookingCTA: 'https://cal.com/drsmith',
        bio: 'Board-certified dermatologist.',
        isPublished: true,
      });

      expect(mock.from).toHaveBeenCalledWith('doctor_profiles');
      expect(mock.chainable.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: OWNER_ID,
          user_id: OWNER_ID,
          display_name: 'Dr. Jane Smith',
          slug: 'dr-smith',
          is_published: true,
        }),
        { onConflict: 'id' },
      );
      expect(result.data?.displayName).toBe('Dr. Jane Smith');
      expect(result.error).toBeNull();
    });

    it('should return error on upsert failure', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Slug already taken' },
      });

      const result = await repo.createOrUpdate({
        displayName: 'Dr. Jane Smith',
        slug: 'dr-smith',
        isPublished: false,
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Slug already taken');
    });
  });

  // -------- CHECK SLUG AVAILABILITY --------
  describe('checkSlugAvailability', () => {
    it('should return true when slug is available', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await repo.checkSlugAvailability('new-slug');

      expect(mock.from).toHaveBeenCalledWith('doctor_profiles');
      expect(mock.chainable.eq).toHaveBeenCalledWith('slug', 'new-slug');
      expect(result).toBe(true);
    });

    it('should return false when slug is taken', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: sampleProfileRow,
        error: null,
      });

      const result = await repo.checkSlugAvailability('dr-smith');

      expect(result).toBe(false);
    });

    it('should return true when slug belongs to the excluded profile', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await repo.checkSlugAvailability('dr-smith', OWNER_ID);

      // Should have filtered out the owner's ID
      expect(mock.chainable.neq).toHaveBeenCalledWith('id', OWNER_ID);
      expect(result).toBe(true);
    });
  });
});
