'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { FileRepository } from '@/lib/repositories/file.repository';
import { FolderRepository } from '@/lib/repositories/folder.repository';
import { NoteRepository } from '@/lib/repositories/note.repository';
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';
import { TierService } from '@/lib/services/tier.service';
import { FREE_TIER_FILE_LIMIT } from '@/lib/constants';
import type { CreateNoteInput } from '@/lib/schemas/note.schema';
import type { CreateFolderInput } from '@/lib/repositories/folder.repository';

// ---------- FILES ----------
export async function getFiles(patientId: string, folderId: string | null = null) {
  const context = await getUserContext();
  if (!context) return { data: [], error: 'Unauthorized' };

  const supabase = createClient();
  const repo = new FileRepository(supabase, context.ownerId);
  return repo.listByPatient(patientId, { folderId });
}

export async function deleteFile(fileId: string, patientId: string) {
  const context = await getUserContext();
  if (!context) return { error: 'Unauthorized' };
  
  if (context.permissions === 'view') {
    return { error: 'Permission denied. You can only view files.' };
  }

  const supabase = createClient();
  const repo = new FileRepository(supabase, context.ownerId);
  const result = await repo.delete(fileId);

  if (!result.error) {
    revalidatePath(`/patients/${patientId}`);
  }
  return result;
}

export async function getSignedUrl(fileId: string) {
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  const supabase = createClient();
  const repo = new FileRepository(supabase, context.ownerId);
  return repo.getSignedUrl(fileId);
}

export async function uploadFileAction(patientId: string, folderId: string | null, formData: FormData) {
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You can only view files.' };
  }

  const file = formData.get('file') as File;
  if (!file) return { data: null, error: 'File is required' };

  const tagsStr = formData.get('tags') as string;
  const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()) : [];

  const supabase = createClient();
  const repo = new FileRepository(supabase, context.ownerId);

  // Tier gate: Free plan is capped at FREE_TIER_FILE_LIMIT files per owner.
  const subscriptionRepo = new SubscriptionRepository(supabase, context.userId);
  const tier = await subscriptionRepo.getTier();
  const countResult = await repo.countByOwner();
  const currentCount = countResult.data ?? 0;
  if (!TierService.canUploadFile(tier, currentCount)) {
    return {
      data: null,
      error: `File limit reached (${currentCount}/${FREE_TIER_FILE_LIMIT} on Free). Upgrade to Pro for unlimited storage.`,
    };
  }

  const result = await repo.upload({ patientId, folderId, file, tags });

  if (!result.error) {
    revalidatePath(`/patients/${patientId}`);
  }
  return result;
}

// ---------- FOLDERS ----------
export async function getFolders(patientId: string, parentId: string | null = null) {
  const context = await getUserContext();
  if (!context) return { data: [], error: 'Unauthorized' };

  const supabase = createClient();
  const repo = new FolderRepository(supabase, context.ownerId);
  return repo.listByPatient(patientId, { parentId });
}

export async function createFolder(input: CreateFolderInput) {
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You can only view files.' };
  }

  const supabase = createClient();
  const repo = new FolderRepository(supabase, context.ownerId);
  const result = await repo.create(input);

  if (!result.error) {
    revalidatePath(`/patients/${input.patientId}`);
  }
  return result;
}

export async function deleteFolder(folderId: string, patientId: string) {
  const context = await getUserContext();
  if (!context) return { error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { error: 'Permission denied. You can only view files.' };
  }

  const supabase = createClient();
  const repo = new FolderRepository(supabase, context.ownerId);
  const result = await repo.delete(folderId);

  if (!result.error) {
    revalidatePath(`/patients/${patientId}`);
  }
  return result;
}

// ---------- NOTES ----------
export async function addNote(input: CreateNoteInput) {
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  // Wait, does 'view' permission mean they can't add notes? Usually yes.
  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You cannot add notes.' };
  }

  const supabase = createClient();
  const repo = new NoteRepository(supabase, context.userId, context.ownerId); // author + owner
  const result = await repo.create(input);

  if (!result.error) {
    revalidatePath(`/patients/${input.patientId}`);
  }
  return result;
}

export async function deleteNote(noteId: string, patientId: string) {
  const context = await getUserContext();
  if (!context) return { error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { error: 'Permission denied. You cannot delete notes.' };
  }

  const supabase = createClient();
  const repo = new NoteRepository(supabase, context.userId, context.ownerId);
  const result = await repo.delete(noteId);

  if (!result.error) {
    revalidatePath(`/patients/${patientId}`);
  }
  return result;
}
