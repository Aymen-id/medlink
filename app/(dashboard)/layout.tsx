import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/supabase/context';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { WorkspaceSwitcher } from '@/components/dashboard/WorkspaceSwitcher';
import { createClient } from '@/lib/supabase/server';
import { getAccessibleWorkspaces } from '@/lib/supabase/workspaces';

export default async function DashboardLayout({ children }: { children:React.ReactNode }) {
  const context=await getUserContext();
  if (!context) {
    const supabase=await createClient();
    const { data:{ user } }=await supabase.auth.getUser();
    if (!user) redirect('/login');
    const workspaces=await getAccessibleWorkspaces(supabase,user.id);
    return <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Choose an available workspace</h1>
      <p>Your previous workspace access may have changed. Select a workspace to continue.</p>
      <WorkspaceSwitcher selectedId="" workspaces={workspaces.map(workspace => ({ id:workspace.workspace_id,name:workspace.physician_workspaces.doctor_profiles.display_name }))} />
    </main>;
  }
  const user={ displayName:context.displayName,email:context.email ?? '',avatarUrl:context.avatarUrl };
  return <DashboardShell user={user} workspaceSwitcher={<WorkspaceSwitcher selectedId={context.workspaceId} workspaces={context.availableWorkspaces.map(workspace => ({ id:workspace.workspace_id,name:workspace.physician_workspaces.doctor_profiles.display_name }))} />}>{children}</DashboardShell>;
}
