'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { ProfileRepository } from '@/lib/repositories/profile.repository';
import { updateProfileSchema } from '@/lib/schemas/profile.schema';
import type { UpdateProfileInput } from '@/lib/schemas/profile.schema';

export async function updateProfile(input: UpdateProfileInput) {
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  // Validate input
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message };
  }

  const supabase = createClient();
  const repo = new ProfileRepository(supabase, context.ownerId);

  // Check slug availability (exclude own profile)
  const isAvailable = await repo.checkSlugAvailability(parsed.data.slug, context.ownerId);
  if (!isAvailable) {
    return { data: null, error: 'This URL slug is already taken. Please choose another.' };
  }

  const result = await repo.createOrUpdate(parsed.data);

  if (!result.error) {
    revalidatePath('/settings/profile');
    revalidatePath(`/${parsed.data.slug}`);
  }

  return result;
}

export async function checkSlug(slug: string) {
  const context = await getUserContext();
  if (!context) return { available: false, error: 'Unauthorized' };

  const supabase = createClient();
  const repo = new ProfileRepository(supabase, context.ownerId);

  const available = await repo.checkSlugAvailability(slug, context.ownerId);
  return { available, error: null };
}
