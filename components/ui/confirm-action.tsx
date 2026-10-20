'use client';
import { useState,type ReactNode,type ComponentProps } from 'react';
import { Button } from './button';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogTrigger } from './dialog';
type Props={ triggerLabel:string;title:string;description:string;onConfirm:()=>Promise<{ error:string | null }>;onSuccess?:()=>void;children?:ReactNode;variant?:ComponentProps<typeof Button>['variant'];size?:ComponentProps<typeof Button>['size'];className?:string;disabled?:boolean };
export function ConfirmAction({ triggerLabel,title,description,onConfirm,onSuccess,children,variant='destructive',size='default',className,disabled }:Props) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string | null>(null);
  async function confirm() {
    setBusy(true);setError(null);
    try { const result=await onConfirm();if(result.error) setError(result.error);else { setOpen(false);onSuccess?.(); } }
    catch { setError('The deletion failed. Please retry.'); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value=>{ if(!busy) { setOpen(value);setError(null); } }}><DialogTrigger render={<Button aria-label={triggerLabel} variant={variant} size={size} className={className} disabled={disabled} />}>{children ?? triggerLabel}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={confirm}>{busy ? 'Deleting…':'Confirm deletion'}</Button></div></DialogContent></Dialog>;
}
