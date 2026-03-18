'use server';

import { revalidatePath } from 'next/cache';
import { PatientRepository } from '@/lib/repositories/patient.repository';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import type { CreatePatientInput, UpdatePatientInput } from '@/lib/schemas/patient.schema';

export async function getPatients(page = 1, limit = 25) {
  const context = await getUserContext();
  if (!context) return { data: [], error: 'Unauthorized', meta: null };

  const supabase = createClient();
  const repo = new PatientRepository(supabase, context.ownerId);

  return repo.list({ page, limit });
}

export async function createPatient(input: CreatePatientInput) {
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You can only view patients.' };
  }

  const supabase = createClient();
  const repo = new PatientRepository(supabase, context.ownerId);

  const result = await repo.create(input);
  if (!result.error) {
    revalidatePath('/patients');
  }
  return result;
}

export async function updatePatient(id: string, input: UpdatePatientInput) {
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You can only view patients.' };
  }

  const supabase = createClient();
  const repo = new PatientRepository(supabase, context.ownerId);

  const result = await repo.update(id, input);
  if (!result.error) {
    revalidatePath('/patients');
    revalidatePath(`/patients/${id}`);
  }
  return result;
}
