'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffAccess } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TeamManagerProps = { initialStaff: StaffAccess[] };

async function callApi(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, error: json.error };
}

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function TeamManager({ initialStaff }: TeamManagerProps) {
  const router = useRouter();
  const [members] = useState<StaffAccess[]>(initialStaff);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'receptionist' | 'assistant'>('receptionist');
  const [permissions, setPermissions] = useState<'view' | 'edit'>('view');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi('POST', '/api/staff', { email, role, permissions });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Invite failed');
      return;
    }
    setEmail('');
    router.refresh();
  }

  async function handleRevoke(member: StaffAccess) {
    if (!window.confirm('Remove this team member\'s access?')) return;
    setError(null);
    const result = await callApi('DELETE', `/api/staff/${member.id}`);
    if (!result.ok) {
      setError(result.error ?? 'Removal failed');
      return;
    }
    router.refresh();
  }

  async function handleUpdate(member: StaffAccess, patch: Partial<StaffAccess>) {
    setError(null);
    const result = await callApi('PATCH', `/api/staff/${member.id}`, patch);
    if (!result.ok) {
      setError(result.error ?? 'Update failed');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label htmlFor="staff-email" className="block text-sm font-medium mb-1">
            Invite by email
          </label>
          <input
            id="staff-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="reception@clinic.ma"
          />
        </div>
        <div>
          <label htmlFor="staff-role" className="block text-sm font-medium mb-1">Role</label>
          <select id="staff-role" value={role} onChange={e => setRole(e.target.value as 'receptionist' | 'assistant')} className={selectClass}>
            <option value="receptionist">Receptionist</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
        <div>
          <label htmlFor="staff-permissions" className="block text-sm font-medium mb-1">Access</label>
          <select id="staff-permissions" value={permissions} onChange={e => setPermissions(e.target.value as 'view' | 'edit')} className={selectClass}>
            <option value="view">View only</option>
            <option value="edit">Can edit</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>Invite</Button>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}

      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {members.map(member => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              {/* TODO(schema pass): show real email once staff_access carries it */}
              <p className="text-sm font-medium truncate" title={member.staffUserId}>
                Member {member.staffUserId.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {member.role} · {member.permissions} · since{' '}
                {new Date(member.grantedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label={`Change access for ${member.staffUserId.slice(0, 8)}`}
                value={member.permissions}
                onChange={e => handleUpdate(member, { permissions: e.target.value as 'view' | 'edit' })}
                className={selectClass}
              >
                <option value="view">View only</option>
                <option value="edit">Can edit</option>
              </select>
              <button
                type="button"
                onClick={() => handleRevoke(member)}
                className={cn(buttonVariants({ variant: 'outline' }), 'text-red-600 hover:text-red-700')}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
        {members.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No team members yet. Invite your receptionist above.
          </li>
        )}
      </ul>
    </div>
  );
}
