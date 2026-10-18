import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashIp } from '@/lib/repositories/analytics.repository';
type Event={ type:'view' | 'click';linkType?:string;referralSource?:string };
export async function trackProfileEvent(profileId:string,event:Event,headers:Pick<Headers,'get'>) {
  const forwarded=headers.get('x-forwarded-for') ?? headers.get('x-real-ip') ?? 'unknown';
  const ipHash=await hashIp(forwarded.split(',')[0].trim());
  let referral:string | null=null;
  try { const source=new URL(event.referralSource || headers.get('referer') || '');if(['http:','https:'].includes(source.protocol)) referral=source.hostname; } catch { /* direct visit */ }
  const { data,error }=await createAdminClient().rpc('record_profile_event',{
    profile:profileId,event_type:event.type,link_type:event.type==='click' ? event.linkType:null,
    referral,agent:headers.get('user-agent')?.slice(0,500) ?? null,ip_hash:ipHash,
  });
  const result=z.enum(['accepted','rate_limited','unavailable']).safeParse(data);
  if(error || !result.success) throw new Error('Could not record profile event');
  return result.data;
}
