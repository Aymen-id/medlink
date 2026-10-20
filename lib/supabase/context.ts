import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from './server';
import { getAccessibleWorkspaces, WORKSPACE_COOKIE, type AccessibleWorkspace } from './workspaces';
import type { UserRole } from '@/types';

export type UserContext = {
  userId: string;
  email: string | null;
  role: UserRole;
  ownerId: string; // Legacy repository scope; equal to workspaceId.
  workspaceId: string;
  billingAccountId: string;
  permissions: 'view' | 'edit';
  displayName: string;
  avatarUrl: string | null;
  availableWorkspaces: AccessibleWorkspace[];
};

/** Resolve explicit membership each request; a personal profile never shadows an invitation. */
export const getUserContext = cache(async (): Promise<UserContext | null> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const workspaces = await getAccessibleWorkspaces(supabase, user.id);
  const selectedId = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const selected = selectedId
    ? workspaces.find((workspace) => workspace.workspace_id === selectedId)
    : workspaces.find((workspace) => workspace.role === 'owner') ?? workspaces[0];
  if (!selected) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    role: selected.role,
    ownerId: selected.workspace_id,
    workspaceId: selected.workspace_id,
    billingAccountId: selected.physician_workspaces.billing_account_id,
    permissions: selected.permissions,
    displayName: selected.physician_workspaces.doctor_profiles.display_name,
    avatarUrl: selected.physician_workspaces.doctor_profiles.avatar_url,
    availableWorkspaces: workspaces,
  };
});
