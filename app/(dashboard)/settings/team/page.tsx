import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/lib/repositories/staff.repository';
import { TeamManager } from '@/components/dashboard/TeamManager';

export const metadata = {
  title: 'Team Access | MediLink',
  description: 'Grant view or edit access to your receptionist or assistant.',
};

export default async function TeamPage() {
  const context = await getUserContext();
  if (!context) redirect('/login');
  if (context.role !== 'owner') redirect('/patients');

  const supabase = createClient();
  const { data: staff } = await new StaffRepository(supabase, context.ownerId).list();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-2xl font-semibold mb-1">Team Access</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Clinic plan seats (max 8). Staff sign in with their own account and see
        only your patients.
      </p>
      <TeamManager initialStaff={staff ?? []} />
    </div>
  );
}
