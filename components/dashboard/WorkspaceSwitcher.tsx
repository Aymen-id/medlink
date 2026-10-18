'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select,SelectContent,SelectGroup,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function WorkspaceSwitcher({ selectedId,workspaces }: { selectedId:string;workspaces:{ id:string;name:string }[] }) {
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [error,setError]=useState<string | null>(null);
  return <div className="flex flex-col gap-2 border-b bg-background px-4 py-2 md:px-6">
    <div className="flex flex-wrap items-center gap-3">
      <Label htmlFor="workspace-choice">Workspace</Label>
      <Select value={selectedId} disabled={pending} onValueChange={async (value) => {
        if (!value || value===selectedId) return;
        setPending(true);setError(null);
        try {
          const response=await fetch('/api/workspaces/select',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify({ workspaceId:value }) });
          if (!response.ok) throw new Error('Could not switch workspace. Check your access and try again.');
          router.push('/patients');router.refresh();
        } catch(error) { setError(error instanceof Error ? error.message : 'Could not switch workspace'); }
        finally { setPending(false); }
      }}>
        <SelectTrigger id="workspace-choice" className="w-full min-w-0 max-w-full sm:w-64"><SelectValue className="min-w-0 truncate">{workspaces.find(workspace=>workspace.id===selectedId)?.name ?? 'Choose a workspace'}</SelectValue></SelectTrigger>
        <SelectContent><SelectGroup>{workspaces.map(workspace => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
