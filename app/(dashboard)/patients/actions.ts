'use server';

import { revalidatePath } from 'next/cache';
import { PatientRepository } from '@/lib/repositories/patient.repository';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import type { CreatePatientInput, UpdatePatientInput } from '@/lib/schemas/patient.schema';
import { createPatientSchema,updatePatientSchema } from '@/lib/schemas/patient.schema';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanupDeletedObjects } from '@/lib/uploads/cleanup';

export async function deletePatient(id:string) {
  if(!z.uuid().safeParse(id).success) return { error:'Invalid patient' };
  const context=await getUserContext();
  if(!context || context.permissions==='view') return { error:'Patient deletion is not permitted' };
  const result=await new PatientRepository(await createClient(),context.ownerId).delete(id);
  if(!result.error) {
    // The database queues every finalized/pending object in the same transaction.
    // A Storage outage cannot lose the durable retry record or restore access.
    try { await cleanupDeletedObjects(createAdminClient()); } catch { /* cron retries */ }
    revalidatePath('/patients');
  }
  return result;
}

export async function getPatients(page = 1, limit = 25) {
  const pagination=z.object({ page:z.number().int().min(1).max(100000),limit:z.number().int().min(1).max(100) }).safeParse({ page,limit });
  if(!pagination.success) return { data:[],error:'Invalid pagination',meta:null };
  const context = await getUserContext();
  if (!context) return { data: [], error: 'Unauthorized', meta: null };

  const supabase = await createClient();
  const repo = new PatientRepository(supabase, context.ownerId);

  return repo.list({ page, limit });
}

export async function createPatient(input: CreatePatientInput) {
  const parsed=createPatientSchema.safeParse(input);
  if(!parsed.success) return { data:null,error:parsed.error.issues[0].message };
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You can only view patients.' };
  }

  const supabase = await createClient();
  const repo = new PatientRepository(supabase, context.ownerId);

  const result = await repo.create(parsed.data);
  if (!result.error) {
    revalidatePath('/patients');
  }
  return result;
}

export async function updatePatient(id: string, input: UpdatePatientInput) {
  const parsed=updatePatientSchema.safeParse(input);
  if(!z.uuid().safeParse(id).success || !parsed.success) return { data:null,error:'Invalid patient update' };
  if(Object.keys(parsed.data).length===0) return { data:null,error:'Choose at least one field to update' };
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You can only view patients.' };
  }

  const supabase = await createClient();
  const repo = new PatientRepository(supabase, context.ownerId);

  const result = await repo.update(id, parsed.data);
  if (!result.error) {
    revalidatePath('/patients');
    revalidatePath(`/patients/${id}`);
  }
  return result;
}
