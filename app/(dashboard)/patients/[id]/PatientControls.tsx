'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger } from '@/components/ui/dialog';
import { updatePatient,deletePatient } from '../actions';
import type { Patient } from '@/types';
import { ConfirmAction } from '@/components/ui/confirm-action';

export function PatientControls({ patient }:{ patient:Patient }) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string | null>(null);
  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError(null);
    const form=new FormData(event.currentTarget);
    const value=(key:string)=>String(form.get(key) ?? '');
    try {
      const result=await updatePatient(patient.id,{ firstName:value('firstName'),lastName:value('lastName'),dateOfBirth:value('dateOfBirth'),gender:value('gender'),phone:value('phone'),email:value('email') });
      if(result.error) setError(result.error); else { setOpen(false);router.refresh(); }
    } catch { setError('Could not save patient. Please retry.'); } finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" disabled={busy} />}>Edit patient</DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Edit patient</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            {([['firstName','First name','text'],['lastName','Last name','text'],['dateOfBirth','Date of birth','date'],['gender','Gender','text'],['phone','Phone','tel'],['email','Email','email']] as const).map(([key,label,type])=><div key={key} className="space-y-1"><Label htmlFor={`edit-${key}`}>{label}</Label><Input id={`edit-${key}`} name={key} type={type} defaultValue={patient[key] ?? ''} required={key==='firstName' || key==='lastName'} /></div>)}
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <Button type="submit" disabled={busy}>Save changes</Button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmAction triggerLabel="Delete patient" disabled={busy} title="Delete this patient?" description="Permanently delete this patient, all notes, folders and files. File removal is retried automatically if Storage is unavailable." onConfirm={()=>deletePatient(patient.id)} onSuccess={()=>router.push('/patients')} />
    </div>
    {error && !open && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
