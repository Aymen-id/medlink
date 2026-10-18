import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
export async function getWorkspaceTier(supabase:SupabaseClient,workspaceId:string) {
  const { data,error }=await supabase.rpc('get_workspace_tier',{ workspace:workspaceId });
  const tier=z.enum(['free','pro','clinic']).safeParse(data);
  return error || !tier.success ? { data:null,error:'Could not verify workspace subscription' }:{ data:tier.data,error:null };
}
