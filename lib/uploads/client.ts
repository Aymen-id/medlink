import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { uploadMetadataSchema } from '@/lib/schemas/file.schema';

const reservationSchema=z.object({ id:z.uuid(),storage_path:z.string().min(1) });
export async function uploadPatientDocument(patientId:string,folderId:string | null,file:File,tags:string[]):Promise<{ error:string | null }> {
  const parsed=uploadMetadataSchema.safeParse({ patientId,folderId,fileName:file.name,mimeType:file.type,sizeBytes:file.size,tags });
  if(!parsed.success) return { error:parsed.error.issues[0].message };
  let reservationId:string | null=null;
  try {
    const response=await fetch('/api/uploads',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify(parsed.data) });
    const body:unknown=await response.json();
    const result=z.object({ data:reservationSchema.optional(),error:z.string().optional() }).parse(body);
    if(!response.ok || !result.data) throw new Error(result.error ?? 'Could not reserve upload');
    reservationId=result.data.id;
    const supabase=createClient();
    const { error }=await supabase.storage.from('patient-files').upload(result.data.storage_path,file,{ contentType:file.type,upsert:false });
    if(error) throw new Error(error.message);
    const finalized=await fetch(`/api/uploads/${reservationId}`,{ method:'POST' });
    if(!finalized.ok) {
      const failure=z.object({ error:z.string().optional() }).safeParse(await finalized.json());
      throw new Error(failure.success ? failure.data.error ?? 'Upload finalization failed' : 'Upload finalization failed');
    }
    return { error:null };
  } catch(error) {
    if(reservationId) await fetch(`/api/uploads/${reservationId}`,{ method:'DELETE' }).catch(()=>undefined);
    return { error:error instanceof Error ? error.message : 'Upload failed. Please try again.' };
  }
}
