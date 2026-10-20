import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const WORKSPACE_COOKIE = 'medilink-workspace';
const membershipSchema = z.object({
  workspace_id: z.uuid(), user_id: z.uuid(),
  role: z.enum(['owner', 'receptionist', 'assistant']),
  permissions: z.enum(['view', 'edit']),
  physician_workspaces: z.object({
    id: z.uuid(), owner_user_id: z.uuid(), billing_account_id: z.uuid(),
    doctor_profiles: z.object({ display_name: z.string(), avatar_url: z.string().nullable() }),
  }),
});
export type AccessibleWorkspace = z.infer<typeof membershipSchema>;

export async function getAccessibleWorkspaces(supabase: SupabaseClient, verifiedUserId: string): Promise<AccessibleWorkspace[]> {
  const { data, error } = await supabase.from('workspace_memberships')
    .select('workspace_id,user_id,role,permissions,physician_workspaces!inner(id,owner_user_id,billing_account_id,doctor_profiles!inner(display_name,avatar_url))')
    .eq('user_id', verifiedUserId).order('created_at', { ascending: true });
  if (error) throw new Error('Unable to load workspace memberships. Check the database migrations and access policies.');
  return z.array(membershipSchema).parse(data ?? []);
}
