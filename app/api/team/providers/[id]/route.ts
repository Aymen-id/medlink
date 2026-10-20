import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(_request:NextRequest,{ params }:{ params:Promise<{ id:string }> }) {
  const context=await getUserContext();
  if (!context) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const workspace=z.uuid().safeParse((await params).id);
  if (!workspace.success) return NextResponse.json({ error:'Invalid provider' },{ status:400 });
  const supabase=await createClient();
  const { error }=await supabase.rpc('remove_clinic_provider',{ account:context.billingAccountId,workspace:workspace.data });
  return NextResponse.json(error ? { error:error.message } : { success:true },{ status:error ? 403 : 200 });
}
