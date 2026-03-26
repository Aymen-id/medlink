import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { ProfileRepository } from '@/lib/repositories/profile.repository';
import { updateProfileSchema } from '@/lib/schemas/profile.schema';

/**
 * GET /api/profile — returns the authenticated owner's profile.
 */
export async function GET() {
  const context = await getUserContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const repo = new ProfileRepository(supabase, context.ownerId);

  const result = await repo.findByUserId();

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ data: result.data });
}

/**
 * PUT /api/profile — updates the authenticated owner's profile.
 */
export async function PUT(request: NextRequest) {
  const context = await getUserContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const repo = new ProfileRepository(supabase, context.ownerId);

  // Check slug availability
  const isAvailable = await repo.checkSlugAvailability(parsed.data.slug, context.ownerId);
  if (!isAvailable) {
    return NextResponse.json(
      { error: 'This URL slug is already taken.' },
      { status: 409 },
    );
  }

  const result = await repo.createOrUpdate(parsed.data);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ data: result.data });
}
