import { NextRequest,NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Context={ params:Promise<{ id:string }> };
export async function POST(_request:NextRequest,{ params }:Context) {
  const id=z.uuid().safeParse((await params).id);
  if(!id.success) return NextResponse.json({ error:'Invalid upload' },{ status:400 });
  const supabase=await createClient();
  const { data:{ user } }=await supabase.auth.getUser();
  if(!user) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const { data,error }=await supabase.rpc('finalize_patient_upload',{ upload_id:id.data });
  if(error) return NextResponse.json({ error:error.message },{ status:409 });
  const file=z.object({ patient_id:z.uuid() }).safeParse(data);
  if(file.success) revalidatePath(`/patients/${file.data.patient_id}`);
  return NextResponse.json({ success:true });
}

export async function DELETE(_request:NextRequest,{ params }:Context) {
  const id=z.uuid().safeParse((await params).id);
  if(!id.success) return NextResponse.json({ error:'Invalid upload' },{ status:400 });
  const supabase=await createClient();
  const { data:{ user } }=await supabase.auth.getUser();
  if(!user) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const { data:path,error }=await supabase.rpc('cancel_patient_upload',{ upload_id:id.data });
  if(error || typeof path!=='string') return NextResponse.json({ error:error?.message ?? 'Upload not found' },{ status:409 });
  const { error:removeError }=await createAdminClient().storage.from('patient-files').remove([path]);
  // An expired/canceled object's read policy remains closed even if physical deletion needs retry.
  return NextResponse.json(removeError ? { error:'Quota released; object cleanup will be retried' } : { success:true },{ status:removeError ? 503 : 200 });
}
