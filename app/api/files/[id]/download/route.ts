import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { FileRepository } from '@/lib/repositories/file.repository';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_request:NextRequest,{ params }:{ params:Promise<{ id:string }> }) {
  const context=await getUserContext();
  if(!context) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const id=z.uuid().safeParse((await params).id);
  if(!id.success) return NextResponse.json({ error:'Invalid file' },{ status:400 });
  const result=await new FileRepository(await createClient(),context.workspaceId,createAdminClient()).downloadFile(id.data);
  if(result.error || !result.data) return NextResponse.json({ error:'File unavailable or access revoked' },{ status:404 });
  const filename=encodeURIComponent(result.data.fileName).replace(/['()*]/g,character=>`%${character.charCodeAt(0).toString(16)}`);
  return new NextResponse(result.data.blob,{ headers:{
    'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${filename}`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  } });
}
