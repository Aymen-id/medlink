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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Public Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure your public-facing MediLink profile page.
        </p>
      </div>
      <ProfileEditor profile={profile} />
    </div>
  );
}
