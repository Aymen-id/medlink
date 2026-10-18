import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { trackProfileEvent } from '@/lib/analytics/track';
const schema=z.discriminatedUnion('type',[
  z.object({ profileId:z.uuid(),type:z.literal('view'),referralSource:z.string().max(500).optional() }),
  z.object({ profileId:z.uuid(),type:z.literal('click'),linkType:z.enum(['phone','email','whatsapp','website','contact','booking','link']),referralSource:z.string().max(500).optional() }),
]);
export async function POST(request:NextRequest) {
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({ error:'Invalid analytics event' },{ status:400 });
  try {
    const result=await trackProfileEvent(parsed.data.profileId,parsed.data,request.headers);
    if(result==='rate_limited') return NextResponse.json({ error:'Too many requests' },{ status:429,headers:{ 'Retry-After':'60' } });
    if(result==='unavailable') return NextResponse.json({ error:'Profile not available' },{ status:404 });
    return NextResponse.json({ success:true },{ status:201 });
  } catch { return NextResponse.json({ error:'Analytics temporarily unavailable' },{ status:503 }); }
}
