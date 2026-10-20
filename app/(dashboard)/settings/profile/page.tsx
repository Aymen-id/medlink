import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { ProfileRepository } from '@/lib/repositories/profile.repository';
import { ProfileEditor } from '@/components/dashboard/ProfileEditor';

export const metadata = {
  title: 'Edit Profile | MediLink',
};

export default async function ProfileSettingsPage() {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const supabase = await createClient();
  const repo = new ProfileRepository(supabase, context.ownerId);

  const { data: profile } = await repo.findByUserId();

  return <ProfileEditor profile={profile} />;
}
