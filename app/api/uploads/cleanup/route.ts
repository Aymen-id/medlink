import { timingSafeEqual } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/config/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanupExpiredUploads,cleanupDeletedObjects } from '@/lib/uploads/cleanup';

export const maxDuration=60;
export async function GET(request:NextRequest) {
  let expected:string;
  try { expected=`Bearer ${getServerConfig('cleanup').CRON_SECRET}`; }
  catch { return NextResponse.json({ error:'Cleanup not configured' },{ status:503 }); }
  const received=Buffer.from(request.headers.get('authorization') ?? '');
  const signature=Buffer.from(expected);
  if(received.length!==signature.length || !timingSafeEqual(received,signature)) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const admin=createAdminClient();
  let cleaned=0;
  for(let batch=0;batch<5;batch++) {
    const result=await cleanupDeletedObjects(admin);
    if(result.error) return NextResponse.json({ cleaned,error:result.error },{ status:503 });
    cleaned+=result.cleaned;
    if(result.cleaned<100) break;
  }
  for(let batch=0;batch<5;batch++) {
    const result=await cleanupExpiredUploads(admin);
    if(result.error) return NextResponse.json({ cleaned,error:result.error },{ status:503 });
    cleaned+=result.cleaned;
    if(result.cleaned<100) break;
  }
  return NextResponse.json({ cleaned });
}
