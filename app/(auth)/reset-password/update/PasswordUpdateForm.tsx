'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateRecoveredPassword } from './actions';

export function PasswordUpdateForm({returnTo='/patients'}:{returnTo?:string}) {
  const [state, action, pending] = useActionState(updateRecoveredPassword, {});
  if (state.success) return (
    <div className="space-y-4" role="status">
      <p>Your password has been updated.</p>
      <Button render={<Link href={returnTo} />}>{returnTo==='/settings/team' ? 'Continue to Team Access':'Open your workspace'}</Button>
    </div>
  );
  return (
    <form action={action} className="space-y-4">
      {state.error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required disabled={pending} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Updating password…' : 'Update password'}</Button>
    </form>
  );
}
