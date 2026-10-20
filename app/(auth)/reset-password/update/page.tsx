import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PasswordUpdateForm } from './PasswordUpdateForm';
import { safeRedirectPath } from '@/lib/utils/redirect';

export const metadata = { title: 'Update password | MediLink', robots: { index: false, follow: false } };

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string;next?:string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const query=await searchParams;
  const expired = query.error === 'expired' || !user;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{expired ? 'Reset link expired' : 'Choose a new password'}</h1>
      {expired ? (
        <div className="space-y-4">
          <p>This link is invalid or has expired. Request a new password reset email.</p>
          <Link href="/reset-password" className="text-primary underline">Request a new link</Link>
        </div>
      ) : <PasswordUpdateForm returnTo={safeRedirectPath(query.next)} />}
    </div>
  );
}
