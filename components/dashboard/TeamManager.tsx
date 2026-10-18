'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffAccess, TeamInvitation } from '@/types';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';

type TeamManagerProps = { initialStaff: StaffAccess[]; invitations?:TeamInvitation[]; currentUserId?:string; currentEmail?:string; canInvite?:boolean;providers?:{ id:string;owner_user_id:string }[] };

async function callApi(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ ok: boolean; error?: string;warning?:string }> {
  try {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string;notificationError?:string };
  return { ok: res.ok, error: json.error,warning:json.notificationError };
  } catch { return { ok:false,error:'Could not connect. Please try again.' }; }
}

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function TeamManager({ initialStaff, invitations=[],currentUserId,currentEmail,canInvite=true,providers=[] }: TeamManagerProps) {
  const router = useRouter();
  const members = initialStaff;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'receptionist' | 'assistant'>('receptionist');
  const [permissions, setPermissions] = useState<'view' | 'edit'>('view');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind,setKind] = useState<'staff' | 'provider'>('staff');
  const [notice,setNotice] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi('POST', '/api/staff', { email, role, permissions,...(kind==='provider' ? { kind } : {}) });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Invite failed');
      return;
    }
    setEmail('');
    setNotice(result.warning ?? 'Invitation saved. Access starts after the recipient accepts.');
    router.refresh();
  }

  async function handleRevoke(member: StaffAccess) {
    const result = await callApi('DELETE', `/api/staff/${member.id}`);
    return { error:result.ok ? null:result.error ?? 'Removal failed' };
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
      {canInvite && <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div>
          <label htmlFor="invitation-kind" className="block text-sm font-medium mb-1">Invite as</label>
          <select id="invitation-kind" value={kind} onChange={event => setKind(event.target.value as 'staff' | 'provider')} className={selectClass}>
            <option value="staff">Staff in this workspace</option><option value="provider">Physician in this Clinic</option>
          </select>
        </div>
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
      </form>}

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

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
              <ConfirmAction triggerLabel="Remove" title="Remove this member’s access?" description="This immediately removes their access to the workspace. The patient records stay with the physician." variant="outline" onConfirm={()=>handleRevoke(member)} onSuccess={()=>router.refresh()} />
            </div>
          </li>
        ))}
        {members.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No team members yet. Invite your receptionist above.
          </li>
        )}
      </ul>
      <section className="flex flex-col gap-3" aria-label="Pending invitations">
        <h2 className="text-lg font-semibold">Pending invitations</h2>
        {invitations.filter(invitation => invitation.status==='pending').map(invitation => (
          <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <p>{invitation.invited_email} · {invitation.kind} · expires {new Date(invitation.expires_at).toLocaleDateString()}</p>
            <Button variant="outline" disabled={pending} onClick={async () => {
              setPending(true);setError(null);
              const action=invitation.invited_email.toLowerCase()===currentEmail?.toLowerCase() ? 'accept' : 'revoke';
              const result=await callApi('PATCH',`/api/team/invitations/${invitation.id}`,{ action });
              setPending(false);
              if (!result.ok) setError(result.error ?? 'Invitation action failed');
              else router.refresh();
            }}>{invitation.invited_email.toLowerCase()===currentEmail?.toLowerCase() ? 'Accept invitation' : 'Revoke invitation'}</Button>
          </div>
        ))}
        {invitations.every(invitation => invitation.status!=='pending') && <p className="text-sm text-muted-foreground">No pending invitations.</p>}
      </section>
      {providers.length>0 && <section className="flex flex-col gap-3" aria-label="Clinic providers">
        <h2 className="text-lg font-semibold">Clinic physician workspaces</h2>
        {providers.map(provider => <div key={provider.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <span>{provider.owner_user_id===currentUserId ? 'Your physician workspace' : `Physician ${provider.owner_user_id.slice(0,8)}`}</span>
          {provider.owner_user_id!==currentUserId && <Button variant="outline" disabled={pending} onClick={async () => {
            setPending(true);setError(null);
            const result=await callApi('DELETE',`/api/team/providers/${provider.id}`);
            setPending(false);if (!result.ok) setError(result.error ?? 'Could not remove provider');else router.refresh();
          }}>Remove from Clinic</Button>}
        </div>)}
      </section>}
    </div>
  );
}
