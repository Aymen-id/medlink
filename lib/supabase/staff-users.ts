import { createAdminClient } from '@/lib/supabase/admin';
import { getAppOrigin } from '@/lib/config/public';

/**
 * Resolves a staff member's auth user id from their email using the
 * service-role admin client. Invites brand-new addresses (they receive a
 * signup email); falls back to a directory lookup for existing accounts.
 */
export async function resolveStaffUserIdByEmail(
  email: string,
): Promise<{ id: string | null; error: string | null }> {
  const admin = createAdminClient();

  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo:`${getAppOrigin()}/auth/callback?next=%2Fsettings%2Fteam` });
  if (invited.data?.user) return { id: invited.data.user.id, error: null };

  const message = invited.error?.message ?? '';
  if (/already|exist|registered/i.test(message)) {
    for (let page=1; ; page++) {
      const listed = await admin.auth.admin.listUsers({ page,perPage:1000 });
      if (listed.error) return { id:null,error:'Could not look up the invited account' };
      const users = listed.data?.users ?? [];
      const match = users.find(user => user.email?.toLowerCase()===email.toLowerCase());
      if (match) return { id:match.id,error:null };
      if (users.length<1000) break;
    }
    return { id: null, error: 'No MediLink account found for that email' };
  }

  return { id: null, error: invited.error?.message ?? 'Failed to resolve staff user' };
}
