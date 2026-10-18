'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger } from '@/components/ui/dialog';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { renameFolder,updateFile } from './actions';
import type { Folder,PatientFile } from '@/types';

export function FolderRename({ folder }:{ folder:Folder }) {
  const router=useRouter();const [open,setOpen]=useState(false);const [error,setError]=useState<string | null>(null);const [busy,setBusy]=useState(false);
  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const name=String(new FormData(event.currentTarget).get('name') ?? '');setBusy(true);setError(null);
    try { const result=await renameFolder(folder.id,folder.patientId,name);if(result.error) setError(result.error);else { setOpen(false);router.refresh(); } }
    catch { setError('Could not rename folder. Please retry.'); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="ghost" size="sm" />}>Rename</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Rename folder</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-3"><Label htmlFor={`rename-${folder.id}`}>Folder name</Label><Input id={`rename-${folder.id}`} name="name" defaultValue={folder.name} required maxLength={100} />{error && <p role="alert" className="text-destructive">{error}</p>}<Button type="submit" disabled={busy}>Save folder</Button></form></DialogContent></Dialog>;
}
export function FileEdit({ file,folders }:{ file:PatientFile;folders:Folder[] }) {
  const router=useRouter();const [open,setOpen]=useState(false);const [target,setTarget]=useState(file.folderId ?? 'root');const [error,setError]=useState<string | null>(null);const [busy,setBusy]=useState(false);
  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const tags=String(new FormData(event.currentTarget).get('tags') ?? '').split(',').map(tag=>tag.trim()).filter(Boolean);setBusy(true);setError(null);
    try { const result=await updateFile(file.id,file.patientId,target==='root' ? null:target,tags);if(result.error) setError(result.error);else { setOpen(false);router.refresh(); } }
    catch { setError('Could not update file. Please retry.'); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="ghost" size="sm" />}>Move / tags</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Edit file</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-3"><Label htmlFor={`tags-${file.id}`}>Tags (comma-separated)</Label><Input id={`tags-${file.id}`} name="tags" defaultValue={file.tags.join(', ')} /><Label htmlFor={`folder-${file.id}`}>Destination folder</Label><Select value={target} onValueChange={value=>setTarget(value ?? 'root')}><SelectTrigger id={`folder-${file.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="root">Root directory</SelectItem>{file.folderId && <SelectItem value={file.folderId}>Current folder</SelectItem>}{folders.filter(folder=>folder.id!==file.folderId).map(folder=><SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}</SelectContent></Select><p className="text-sm text-muted-foreground">Choose a folder shown on this page. Open the destination after moving to go deeper.</p>{error && <p role="alert" className="text-destructive">{error}</p>}<Button type="submit" disabled={busy}>Save file</Button></form></DialogContent></Dialog>;
}
