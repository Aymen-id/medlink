import { createClient } from './server';
import type { UserRole } from '@/types';

export type UserContext = {
  userId: string;
  email: string | null;
  role: UserRole;
  ownerId: string; // the doctor's profile this user acts upon
  permissions?: 'view' | 'edit'; // if staff
  displayName?: string;
  avatarUrl?: string | null;
};

/**
 * Resolves the current authenticated user's context in a single optimized flow.
 * 
 * Optimization: We first check doctor_profiles (most common case for solo physicians).
 * If that hits, we return immediately (1 auth call + 1 DB call = 2 total).
 * The staff path is the rare case, adding one more query only when needed.
 * 
 * Future optimization: combine into a single RPC call or cache in session cookie.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = createClient();

  // 1. Auth check (required, ~1 call)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // 2. Check owner profile (most common path — 1 DB call)
  const { data: profile } = await supabase
    .from('doctor_profiles')
    .select('id, display_name, avatar_url')
    .eq('id', user.id)
    .single();

  if (profile) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: 'owner',
      ownerId: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
    };
  }

  // 3. Staff path (rare — only if user is NOT a doctor, +1 DB call)
  const { data: access } = await supabase
    .from('staff_access')
    .select('owner_id, role, permissions')
    .eq('staff_user_id', user.id)
    .single();

  if (access) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: access.role as UserRole,
      ownerId: access.owner_id,
      permissions: access.permissions as 'view' | 'edit',
      displayName: user.email?.split('@')[0] ?? 'Staff',
      avatarUrl: null,
    };
  }

  // Not an owner and not staff (orphan account)
  return null;
}
