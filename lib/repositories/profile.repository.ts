import type { SupabaseClient } from '@supabase/supabase-js';
import type { DoctorProfile } from '@/types';
import type { UpdateProfileInput } from '@/lib/schemas/profile.schema';
import type { ApiResponse } from '@/types/api';

type ProfileRow = {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  specialty: string | null;
  credentials: string | null;
  clinic_address: string | null;
  consultation_hours: Record<string, string> | null;
  contact_cta: string | null;
  booking_cta: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

function mapRowToProfile(row: ProfileRow): DoctorProfile {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    displayName: row.display_name,
    specialty: row.specialty,
    credentials: row.credentials,
    clinicAddress: row.clinic_address,
    consultationHours: row.consultation_hours,
    contactCTA: row.contact_cta,
    bookingCTA: row.booking_cta,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProfileRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string,
  ) {}

  /**
   * Fetches a published profile by its public slug.
   * This is used for the public-facing profile page — no auth required.
   */
  async findBySlug(slug: string): Promise<ApiResponse<DoctorProfile>> {
    const { data, error } = await this.supabase
      .from('doctor_profiles')
      .select()
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    return { data: mapRowToProfile(data as ProfileRow), error: null };
  }

  /**
   * Fetches the owner's own profile for editing.
   * Defense-in-depth: filters by this.ownerId.
   */
  async findByUserId(): Promise<ApiResponse<DoctorProfile>> {
    const { data, error } = await this.supabase
      .from('doctor_profiles')
      .select()
      .eq('user_id', this.ownerId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToProfile(data as ProfileRow), error: null };
  }

  /**
   * Creates or updates the owner's profile (upsert on id).
   */
  async createOrUpdate(input: UpdateProfileInput): Promise<ApiResponse<DoctorProfile>> {
    const row = {
      id: this.ownerId,
      user_id: this.ownerId,
      slug: input.slug,
      display_name: input.displayName,
      specialty: input.specialty ?? null,
      credentials: input.credentials ?? null,
      clinic_address: input.clinicAddress ?? null,
      consultation_hours: input.consultationHours ?? null,
      contact_cta: input.contactCTA ?? null,
      booking_cta: input.bookingCTA ?? null,
      bio: input.bio ?? null,
      is_published: input.isPublished ?? false,
    };

    const { data, error } = await this.supabase
      .from('doctor_profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToProfile(data as ProfileRow), error: null };
  }

  /**
   * Checks whether a slug is available.
   * Optionally excludes a specific profile ID (for "own slug" checks).
   */
  async checkSlugAvailability(slug: string, excludeId?: string): Promise<boolean> {
    let query = this.supabase
      .from('doctor_profiles')
      .select('id')
      .eq('slug', slug);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data } = await query.maybeSingle();
    return data === null;
  }
}
