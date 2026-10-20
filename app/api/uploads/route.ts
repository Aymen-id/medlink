import { NextRequest,NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { uploadMetadataSchema } from '@/lib/schemas/file.schema';

export async function POST(request:NextRequest) {
  const context=await getUserContext();
  if(!context) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  if(context.permissions!=='edit') return NextResponse.json({ error:'Upload permission denied' },{ status:403 });
  const parsed=uploadMetadataSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({ error:parsed.error.issues[0].message },{ status:400 });
  const input=parsed.data;
  const supabase=await createClient();
  const { data:patient,error:patientError }=await supabase.from('patients').select('id').eq('id',input.patientId).eq('owner_id',context.workspaceId).maybeSingle();
  if(patientError || !patient) return NextResponse.json({ error:'Patient not found in this workspace' },{ status:404 });
  const { data,error }=await supabase.rpc('reserve_patient_upload',{ patient:input.patientId,folder:input.folderId ?? null,filename:input.fileName,mime:input.mimeType,bytes:input.sizeBytes,file_tags:input.tags });
  if(error) return NextResponse.json({ error:error.message },{ status:409 });
  return NextResponse.json({ data },{ status:201 });
}
