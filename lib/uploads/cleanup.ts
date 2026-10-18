import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export async function cleanupDeletedObjects(supabase:SupabaseClient):Promise<{ cleaned:number;error:string | null }> {
  const { data,error }=await supabase.from('storage_deletion_queue').select('storage_path').order('created_at',{ ascending:true }).limit(100);
  if(error) return { cleaned:0,error:'Could not list deleted objects' };
  const pending=z.array(z.object({ storage_path:z.string() })).parse(data ?? []);
  if(!pending.length) return { cleaned:0,error:null };
  const paths=pending.map(row=>row.storage_path);
  const { error:storageError }=await supabase.storage.from('patient-files').remove(paths);
  if(storageError) return { cleaned:0,error:'Storage cleanup failed; deleted objects remain queued for retry' };
  const { error:deleteError }=await supabase.from('storage_deletion_queue').delete().in('storage_path',paths);
  return { cleaned:deleteError ? 0:paths.length,error:deleteError ? 'Could not acknowledge cleanup; safe to retry':null };
}
export async function cleanupExpiredUploads(supabase:SupabaseClient):Promise<{ cleaned:number;error:string | null }> {
  const { error }=await supabase.rpc('queue_expired_uploads');
  if(error) return { cleaned:0,error:'Could not queue expired uploads' };
  return cleanupDeletedObjects(supabase);
}
