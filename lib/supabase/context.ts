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

export async function getUserContext(): Promise<UserContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Check if they are a doctor (owner)
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
      ownerId: profile.id, // owners act on their own profile
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
    };
  }

  // If not owner, check staff access
  const { data: access } = await supabase
    .from('staff_access')
    .select('owner_id, role, permissions, doctor_profiles:owner_id(display_name, avatar_url)')
    .eq('staff_user_id', user.id)
    .single();

  if (access) {
    // Note: the display_name and avatar_url from doctor_profiles here belong to the owner.
    // We can just return the user's email if they are staff.
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
