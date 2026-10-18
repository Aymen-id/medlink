import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/lib/repositories/staff.repository';
import { rateLimit, getClientIp } from '@/lib/utils/rate-limit';

async function requireOwner() {
  const context = await getUserContext();
  if (!context || context.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return context;
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(`staff-read:${getClientIp(request)}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const context = await requireOwner();
  if (context instanceof NextResponse) return context;

  const supabase = await createClient();
  const repo = new StaffRepository(supabase, context.ownerId);
  const result = await repo.list();
  return NextResponse.json(result, { status: result.error ? 500 : 200 });
}

export { POST } from '@/app/api/team/invitations/route';
