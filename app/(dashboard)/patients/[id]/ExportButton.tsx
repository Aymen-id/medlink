'use client';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
export function ExportButton({ patientId }:{ patientId:string }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState<string | null>(null);
  async function download() {
    setBusy(true);setError(null);
    try {
      const response=await fetch(`/api/patients/${encodeURIComponent(patientId)}/export`);
      if(!response.ok) {
        const parsed=z.object({ error:z.string() }).safeParse(await response.json().catch(()=>null));
        throw new Error(parsed.success ? parsed.data.error:'Export failed. Please retry.');
      }
      const blob=await response.blob();
      const url=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=`patient_${patientId}_files.zip`;anchor.click();
      setTimeout(()=>URL.revokeObjectURL(url),60_000);
    } catch(cause) { setError(cause instanceof Error ? cause.message:'Export failed. Please retry.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2"><Button variant="outline" disabled={busy} onClick={download}>{busy ? 'Preparing export…':'Export all files (ZIP)'}</Button>{error && <p role="alert" className="max-w-sm text-sm text-destructive">{error}</p>}</div>;
}
