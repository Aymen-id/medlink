import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Resolves a staff member's auth user id from their email using the
 * service-role admin client. Invites brand-new addresses (they receive a
 * signup email); falls back to a directory lookup for existing accounts.
 */
export async function resolveStaffUserIdByEmail(
  email: string,
): Promise<{ id: string | null; error: string | null }> {
  const admin = createAdminClient();

  const invited = await admin.auth.admin.inviteUserByEmail(email);
  if (invited.data?.user) return { id: invited.data.user.id, error: null };

  const message = invited.error?.message ?? '';
  if (/already|exist|registered/i.test(message)) {
    const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
    const match = listed.data?.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return { id: match.id, error: null };
    return { id: null, error: 'No MediLink account found for that email' };
  }

  return { id: null, error: invited.error?.message ?? 'Failed to resolve staff user' };
}
