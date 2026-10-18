'use client';
import { useState } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { addNote,updateNote,deleteNote } from './actions';
import type { AppointmentNote } from '@/types';
import { ConfirmAction } from '@/components/ui/confirm-action';

type Props={ patientId:string;notes:AppointmentNote[];permissions:'view' | 'edit';currentUserId?:string;canWriteNotes?:boolean;notesPage?:number;notesTotalPages?:number;notesError?:string | null };
export function NotesView({ patientId,notes,permissions,currentUserId,canWriteNotes=false,notesPage=1,notesTotalPages=1,notesError }:Props) {
  const router=useRouter(),query=useSearchParams();
  const [content,setContent]=useState(''),[editing,setEditing]=useState<string | null>(null),[editContent,setEditContent]=useState('');
  const [error,setError]=useState<string | null>(null),[busy,setBusy]=useState(false);
  async function mutate(action:()=>Promise<{ error:string | null }>,done:()=>void) {
    setBusy(true);setError(null);
    try { const result=await action();if(result.error) setError(result.error);else { done();router.refresh(); } }
    catch { setError('Could not save note. Please retry.'); } finally { setBusy(false); }
  }
  function page(value:number) { const params=new URLSearchParams(query.toString());params.set('tab','notes');params.set('notesPage',String(value));router.push(`?${params}`); }
  const editable=permissions==='edit' && canWriteNotes;
  return <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
    <div className="space-y-4 md:col-span-2">
      <h3 className="text-lg font-semibold">Appointment history</h3>
      {(error || notesError) && <p role="alert" className="text-destructive">{error || notesError}</p>}
      {!notes.length && !notesError && <p className="text-muted-foreground">No appointment notes yet.</p>}
      {notes.map(note=><article key={note.id} className="space-y-3 rounded-lg border bg-card p-4">
        <time className="text-sm text-muted-foreground" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>
        {editing===note.id ? <form onSubmit={event=>{ event.preventDefault();void mutate(()=>updateNote(note.id,patientId,editContent),()=>setEditing(null)); }} className="space-y-2">
          <Label htmlFor="edit-note">Edit appointment note</Label><Textarea id="edit-note" value={editContent} onChange={event=>setEditContent(event.target.value)} required maxLength={20000} />
          <Button type="submit" disabled={busy}>Save note changes</Button><Button type="button" variant="outline" onClick={()=>setEditing(null)}>Cancel</Button>
        </form>:<p className="whitespace-pre-wrap text-sm">{note.content}</p>}
        {permissions==='edit' && note.authorId===currentUserId && <div className="flex gap-2">
          {editable && <Button variant="outline" disabled={busy} onClick={()=>{ setEditing(note.id);setEditContent(note.content); }}>Edit note</Button>}
          <ConfirmAction triggerLabel="Delete note" title="Delete this appointment note?" description="This permanently removes the appointment note." variant="ghost" disabled={busy} onConfirm={()=>deleteNote(note.id,patientId)} onSuccess={()=>{ setEditing(null);router.refresh(); }} />
        </div>}
      </article>)}
      <nav aria-label="Appointment history pages" className="flex items-center gap-3"><Button variant="outline" disabled={notesPage<=1} onClick={()=>page(notesPage-1)}>Newer notes</Button><span className="text-sm">Page {notesPage} of {Math.max(1,notesTotalPages)}</span><Button variant="outline" disabled={notesPage>=notesTotalPages} onClick={()=>page(notesPage+1)}>Older notes</Button></nav>
    </div>
    <div className="h-fit space-y-3 rounded-lg border bg-muted p-4">
      {editable ? <form onSubmit={event=>{ event.preventDefault();void mutate(()=>addNote({ patientId,content }),()=>setContent('')); }} className="space-y-3"><Label htmlFor="new-note">New appointment note</Label><Textarea id="new-note" value={content} onChange={event=>setContent(event.target.value)} required maxLength={20000} /><Button type="submit" disabled={busy}>Save note</Button></form>:<p className="text-sm text-muted-foreground">{permissions==='view' ? 'You have read-only access.':'Pro or Clinic is required to create or edit notes. Existing history remains available.'} {permissions==='edit' && <Link href="/settings/billing" className="underline">Manage subscription</Link>}</p>}
    </div>
  </div>;
}
