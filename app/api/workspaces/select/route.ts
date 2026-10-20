import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAccessibleWorkspaces, WORKSPACE_COOKIE } from '@/lib/supabase/workspaces';

export async function POST(request: NextRequest) {
  const parsed = z.object({ workspaceId:z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error:'Invalid workspace' }, { status:400 });
  const supabase = await createClient();
  const { data:{ user },error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const workspaces = await getAccessibleWorkspaces(supabase,user.id);
  if (!workspaces.some((workspace) => workspace.workspace_id===parsed.data.workspaceId)) return NextResponse.json({ error:'Workspace access denied' }, { status:403 });
  const response = NextResponse.json({ success:true });
  response.cookies.set(WORKSPACE_COOKIE,parsed.data.workspaceId, {
    httpOnly:true, sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:60*60*24*30,
  });
  response.headers.set('cache-control','private, no-store');
  return response;
}
