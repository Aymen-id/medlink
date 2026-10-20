import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { resolveStaffUserIdByEmail } from '@/lib/supabase/staff-users';
import { grantStaffSchema } from '@/lib/schemas/staff.schema';

const schema = grantStaffSchema.extend({ kind:z.enum(['staff','provider']).default('staff'),workspaceId:z.uuid().optional() });
export async function POST(request: NextRequest) {
  const context = await getUserContext();
  if (!context) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error:parsed.error.issues[0].message }, { status:400 });
  const target = context.availableWorkspaces.find(workspace => workspace.workspace_id===(parsed.data.workspaceId ?? context.workspaceId));
  if (!target || target.role!=='owner') return NextResponse.json({ error:'Workspace owner required' }, { status:403 });
  const supabase = await createClient();
  const { data,error } = await supabase.rpc('create_team_invitation', {
    account:target.physician_workspaces.billing_account_id,workspace:target.workspace_id,
    email:parsed.data.email,invitation_kind:parsed.data.kind,staff_role:parsed.data.role,access_level:parsed.data.permissions,
  });
  if (error) return NextResponse.json({ error:error.message }, { status:400 });
  // Reserve the invitation/seat atomically before attempting external email delivery.
  let notificationError: string | null = null;
  try {
    const result = await resolveStaffUserIdByEmail(parsed.data.email);
    if (result.error) notificationError='Invitation saved. Email could not be sent; the recipient can sign in and accept under Team Access.';
  } catch {
    notificationError='Invitation saved. Email could not be sent; the recipient can sign in and accept under Team Access.';
  }
  return NextResponse.json({ data:{ id:data },notificationError }, { status:201 });
}
