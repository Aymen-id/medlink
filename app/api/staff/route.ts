import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/lib/repositories/staff.repository';
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';
import { TierService } from '@/lib/services/tier.service';
import { grantStaffSchema } from '@/lib/schemas/staff.schema';
import { resolveStaffUserIdByEmail } from '@/lib/supabase/staff-users';
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

  const supabase = createClient();
  const repo = new StaffRepository(supabase, context.ownerId);
  const result = await repo.list();
  return NextResponse.json(result, { status: result.error ? 500 : 200 });
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(`staff-write:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const context = await requireOwner();
  if (context instanceof NextResponse) return context;

  const body = await request.json().catch(() => null);
  const parsed = grantStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = createClient();
  const staffRepo = new StaffRepository(supabase, context.ownerId);

  // Seat cap comes from the plan: Free/Pro 0 seats, Clinic 8.
  const tier = await new SubscriptionRepository(supabase, context.userId).getTier();
  const listed = await staffRepo.list();
  const currentSize = listed.data?.length ?? 0;
  if (!TierService.canAddTeamMember(tier, currentSize)) {
    return NextResponse.json(
      { error: 'Your plan does not include team seats. Upgrade to Clinic.' },
      { status: 403 },
    );
  }

  const resolved = await resolveStaffUserIdByEmail(parsed.data.email);
  if (!resolved.id) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const result = await staffRepo.grantById(
    resolved.id,
    parsed.data.role,
    parsed.data.permissions,
  );
  return NextResponse.json(result, { status: result.error ? 400 : 201 });
}
