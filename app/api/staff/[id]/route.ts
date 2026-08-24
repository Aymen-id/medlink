import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/lib/repositories/staff.repository';
import { grantStaffSchema } from '@/lib/schemas/staff.schema';
import { rateLimit, getClientIp } from '@/lib/utils/rate-limit';

type RouteContext = { params: { id: string } };

async function ownerAndRepo() {
  const context = await getUserContext();
  if (!context || context.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const supabase = createClient();
  return { repo: new StaffRepository(supabase, context.ownerId) };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const rl = rateLimit(`staff-write:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const { repo, response } = await ownerAndRepo();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = grantStaffSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Only role/permissions are updatable; the schema's email field is invite-only.
  const result = await repo.update(params.id, {
    role: parsed.data.role,
    permissions: parsed.data.permissions,
  });
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const rl = rateLimit(`staff-write:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const { repo, response } = await ownerAndRepo();
  if (response) return response;

  const result = await repo.revoke(params.id);
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
