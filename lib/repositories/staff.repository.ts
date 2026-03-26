import type { SupabaseClient } from '@supabase/supabase-js';
import type { StaffAccess } from '@/types';
import type { ApiResponse } from '@/types/api';

type StaffAccessRow = {
  id: string;
  owner_id: string;
  staff_user_id: string;
  role: string;
  permissions: string;
  granted_at: string;
};

function mapRowToStaffAccess(row: StaffAccessRow): StaffAccess {
  return {
    id: row.id,
    ownerId: row.owner_id,
    staffUserId: row.staff_user_id,
    role: row.role as 'receptionist' | 'assistant',
    permissions: row.permissions as 'view' | 'edit',
    grantedAt: row.granted_at,
  };
}

export type GrantStaffInput = {
  staffEmail: string;
  role: 'receptionist' | 'assistant';
  permissions: 'view' | 'edit';
};

export type UpdateStaffInput = {
  role?: 'receptionist' | 'assistant';
  permissions?: 'view' | 'edit';
};

export class StaffRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string,
  ) {}

  /**
   * Grant staff access to a user by their email.
   * Looks up the auth user by email, then creates a staff_access row.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async grant(_input: GrantStaffInput): Promise<ApiResponse<StaffAccess>> {
    // Look up the user by email in auth.users via the admin API or a helper query.
    // Since we can't query auth.users directly from client-side Supabase,
    // we rely on a server-side approach. The caller should resolve the user ID.
    // For now, we accept an email and search doctor_profiles or rely on
    // a Supabase Edge Function. We'll use a simplified approach:
    // The caller must resolve staffUserId before calling this method.
    return { data: null, error: 'Use grantById instead — email lookup requires admin privileges' };
  }

  /**
   * Grant staff access to a user by their user ID.
   */
  async grantById(
    staffUserId: string,
    role: 'receptionist' | 'assistant',
    permissions: 'view' | 'edit',
  ): Promise<ApiResponse<StaffAccess>> {
    // Prevent self-grant
    if (staffUserId === this.ownerId) {
      return { data: null, error: 'Cannot grant staff access to yourself' };
    }

    const { data, error } = await this.supabase
      .from('staff_access')
      .insert({
        owner_id: this.ownerId,
        staff_user_id: staffUserId,
        role,
        permissions,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToStaffAccess(data as StaffAccessRow), error: null };
  }

  /**
   * List all staff members for this owner.
   */
  async list(): Promise<ApiResponse<StaffAccess[]>> {
    const { data, error } = await this.supabase
      .from('staff_access')
      .select()
      .eq('owner_id', this.ownerId)
      .order('granted_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as StaffAccessRow[];
    return { data: rows.map(mapRowToStaffAccess), error: null };
  }

  /**
   * Update a staff member's role or permissions.
   */
  async update(
    staffAccessId: string,
    input: UpdateStaffInput,
  ): Promise<ApiResponse<StaffAccess>> {
    const updateData: Record<string, unknown> = {};
    if (input.role !== undefined) updateData.role = input.role;
    if (input.permissions !== undefined) updateData.permissions = input.permissions;

    const { data, error } = await this.supabase
      .from('staff_access')
      .update(updateData)
      .eq('id', staffAccessId)
      .eq('owner_id', this.ownerId) // defense-in-depth
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToStaffAccess(data as StaffAccessRow), error: null };
  }

  /**
   * Revoke staff access.
   */
  async revoke(staffAccessId: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('staff_access')
      .delete()
      .eq('id', staffAccessId)
      .eq('owner_id', this.ownerId); // defense-in-depth

    return { error: error?.message ?? null };
  }

  /**
   * Revoke by staff user ID (convenience method).
   */
  async revokeByUserId(staffUserId: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('staff_access')
      .delete()
      .eq('staff_user_id', staffUserId)
      .eq('owner_id', this.ownerId);

    return { error: error?.message ?? null };
  }
}
