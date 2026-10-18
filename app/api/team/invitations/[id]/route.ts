import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { WORKSPACE_COOKIE } from '@/lib/supabase/workspaces';
import { createAdminClient } from '@/lib/supabase/admin';
import { preparePersonalBillingTransfer } from '@/lib/stripe/reconciliation';

export async function PATCH(request: NextRequest, { params }: { params:Promise<{ id:string }> }) {
  const id = z.uuid().safeParse((await params).id);
  const parsed = z.object({ action:z.enum(['accept','revoke']) }).safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return NextResponse.json({ error:'Invalid invitation action' }, { status:400 });
  const supabase = await createClient();
  const { data:{ user },error:authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  if(parsed.data.action==='accept') {
    const invitation=await supabase.from('team_invitations').select('kind,invited_email,status,expires_at').eq('id',id.data).maybeSingle();
    if(invitation.error || !invitation.data || invitation.data.invited_email!==user.email?.toLowerCase() || invitation.data.status!=='pending' || Date.parse(invitation.data.expires_at)<=Date.now()) {
      return NextResponse.json({error:'A pending invitation for your confirmed email is required'},{status:400});
    }
    if(invitation.data.kind==='provider') {
      try { await preparePersonalBillingTransfer(createAdminClient(),user.id); }
      catch(error) { return NextResponse.json({error:error instanceof Error ? error.message:'Could not verify personal billing'},{status:409}); }
    }
  }
  const { data,error } = await supabase.rpc(parsed.data.action==='accept' ? 'accept_team_invitation' : 'revoke_team_invitation', { invitation_id:id.data });
  if (error) {
    if(parsed.data.action==='accept') await createAdminClient().rpc('unfreeze_personal_billing',{user_id:user.id});
    return NextResponse.json({ error:error.message }, { status:400 });
  }
  const response = NextResponse.json({ success:true });
  if (parsed.data.action==='accept' && typeof data==='string') response.cookies.set(WORKSPACE_COOKIE,data, {
    httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:60*60*24*30,
  });
  return response;
}
