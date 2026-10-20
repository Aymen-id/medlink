import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/lib/repositories/staff.repository';
import { TeamManager } from '@/components/dashboard/TeamManager';
import type { TeamInvitation } from '@/types';

export const metadata = {
  title: 'Team Access | MediLink',
  description: 'Grant view or edit access to your receptionist or assistant.',
};

export default async function TeamPage() {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const supabase = await createClient();
  const { data: staff } = context.role==='owner'
    ? await new StaffRepository(supabase, context.ownerId).list() : { data:[] };
  const { data:invitations,error } = await supabase.from('team_invitations').select('id,invited_email,kind,status,invited_by,expires_at').eq('status','pending').order('created_at',{ ascending:false });
  const { data:account }=await supabase.from('billing_accounts').select('id').eq('id',context.billingAccountId).eq('billing_admin_id',context.userId).maybeSingle();
  const { data:providers }=account ? await supabase.from('physician_workspaces').select('id,owner_user_id').eq('billing_account_id',account.id) : { data:[] };

  return (
    <>
      {error && <p role="alert" className="mb-4 text-destructive">Could not load invitations. Please refresh and try again.</p>}
      <TeamManager initialStaff={staff ?? []} invitations={(invitations ?? []) as TeamInvitation[]} currentUserId={context.userId} currentEmail={context.email ?? ''} canInvite={context.role==='owner'} providers={providers ?? []} />
    </>
  );
}
