'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/supabase/context';
import { FileRepository } from '@/lib/repositories/file.repository';
import { FolderRepository } from '@/lib/repositories/folder.repository';
import { NoteRepository } from '@/lib/repositories/note.repository';
import type { CreateNoteInput } from '@/lib/schemas/note.schema';
import type { CreateFolderInput } from '@/lib/repositories/folder.repository';
import { createFolderSchema } from '@/lib/schemas/folder.schema';
import { createNoteSchema,updateNoteSchema } from '@/lib/schemas/note.schema';
import { z } from 'zod';
import { renameFolderSchema } from '@/lib/schemas/folder.schema';
import { uploadMetadataSchema } from '@/lib/schemas/file.schema';
import { cleanupDeletedObjects } from '@/lib/uploads/cleanup';
import { getWorkspaceTier } from '@/lib/supabase/entitlements';

const pageSchema=z.number().int().min(1).max(100000);
export async function renameFolder(folderId:string,patientId:string,name:string) {
  const parsed=renameFolderSchema.safeParse({ name });
  if(!z.uuid().safeParse(folderId).success || !z.uuid().safeParse(patientId).success || !parsed.success) return { error:'Invalid folder name or identifier' };
  const context=await getUserContext();
  if(!context || context.permissions==='view') return { error:'Permission denied' };
  const result=await new FolderRepository(await createClient(),context.ownerId).rename(folderId,parsed.data.name);
  if(!result.error) revalidatePath(`/patients/${patientId}`);
  return result;
}
export async function updateFile(fileId:string,patientId:string,folderId:string | null,tags:string[]) {
  const parsed=z.object({ fileId:z.uuid(),patientId:z.uuid(),folderId:z.uuid().nullable(),tags:uploadMetadataSchema.shape.tags }).safeParse({ fileId,patientId,folderId,tags });
  if(!parsed.success) return { error:'Invalid file metadata' };
  const context=await getUserContext();
  if(!context || context.permissions==='view') return { error:'Permission denied' };
  const result=await new FileRepository(await createClient(),context.ownerId).updateMetadata(fileId,{ tags:parsed.data.tags,folderId });
  if(!result.error) revalidatePath(`/patients/${patientId}`);
  return result;
}

// ---------- FILES ----------
export async function getFiles(patientId: string, folderId: string | null = null,page=1) {
  if(!pageSchema.safeParse(page).success) return { data:[],error:'Invalid page' };
  if(!z.object({ patientId:z.uuid(),folderId:z.uuid().nullable() }).safeParse({ patientId,folderId }).success) return { data:[],error:'Invalid patient or folder' };
  const context = await getUserContext();
  if (!context) return { data: [], error: 'Unauthorized' };

  const supabase = await createClient();
  const repo = new FileRepository(supabase, context.ownerId);
  return repo.listByPatient(patientId, { folderId,page,limit:50 });
}

export async function deleteFile(fileId: string, patientId: string) {
  if(!z.object({ fileId:z.uuid(),patientId:z.uuid() }).safeParse({ fileId,patientId }).success) return { error:'Invalid file or patient' };
  const context = await getUserContext();
  if (!context) return { error: 'Unauthorized' };
  
  if (context.permissions === 'view') {
    return { error: 'Permission denied. You can only view files.' };
  }

  const supabase = await createClient();
  const result = await new FileRepository(supabase,context.ownerId,createAdminClient()).delete(fileId);

  if (!result.error) {
    try { await cleanupDeletedObjects(createAdminClient()); } catch { /* cron retries */ }
    revalidatePath(`/patients/${patientId}`);
  }
  return result;
}

export async function getSignedUrl(fileId: string) {
  if(!z.uuid().safeParse(fileId).success) return { data:null,error:'Invalid file' };
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  const supabase = await createClient();
  const repo = new FileRepository(supabase, context.ownerId);
  return repo.getSignedUrl(fileId);
}

// ---------- FOLDERS ----------
export async function getFolders(patientId: string, parentId: string | null = null,page=1) {
  if(!pageSchema.safeParse(page).success) return { data:[],error:'Invalid page' };
  if(!z.object({ patientId:z.uuid(),parentId:z.uuid().nullable() }).safeParse({ patientId,parentId }).success) return { data:[],error:'Invalid patient or folder' };
  const context = await getUserContext();
  if (!context) return { data: [], error: 'Unauthorized' };

  const supabase = await createClient();
  const repo = new FolderRepository(supabase, context.ownerId);
  return repo.listByPatient(patientId, { parentId,page,limit:50 });
}

export async function createFolder(input: CreateFolderInput) {
  const parsed=createFolderSchema.safeParse(input);
  if(!parsed.success) return { data:null,error:parsed.error.issues[0].message };
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You can only view files.' };
  }

  const supabase = await createClient();
  const repo = new FolderRepository(supabase, context.ownerId);
  const result = await repo.create({ ...parsed.data,parentId:parsed.data.parentId ?? null });

  if (!result.error) {
    revalidatePath(`/patients/${input.patientId}`);
  }
  return result;
}

export async function deleteFolder(folderId: string, patientId: string) {
  if(!z.object({ folderId:z.uuid(),patientId:z.uuid() }).safeParse({ folderId,patientId }).success) return { error:'Invalid folder or patient' };
  const context = await getUserContext();
  if (!context) return { error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { error: 'Permission denied. You can only view files.' };
  }

  const supabase = await createClient();
  const repo = new FolderRepository(supabase, context.ownerId);
  const result = await repo.delete(folderId);

  if (!result.error) {
    revalidatePath(`/patients/${patientId}`);
  }
  return result;
}

// ---------- NOTES ----------
export async function updateNote(noteId:string,patientId:string,content:string) {
  const parsed=updateNoteSchema.safeParse({ content });
  if(!z.uuid().safeParse(noteId).success || !z.uuid().safeParse(patientId).success || !parsed.success) return { error:'Invalid note' };
  const context=await getUserContext();
  if(!context || context.permissions==='view') return { error:'Permission denied' };
  const supabase=await createClient();
  const tier=await getWorkspaceTier(supabase,context.workspaceId);
  if(tier.error || tier.data==='free') return { error:tier.error ?? 'Pro or Clinic is required to edit appointment notes' };
  const result=await new NoteRepository(supabase,context.userId,context.ownerId).update(noteId,parsed.data);
  if(!result.error) revalidatePath(`/patients/${patientId}`);
  return result;
}
export async function addNote(input: CreateNoteInput) {
  const parsed=createNoteSchema.safeParse(input);
  if(!parsed.success) return { data:null,error:parsed.error.issues[0].message };
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You cannot add notes.' };
  }

  const supabase = await createClient();
  const tier=await getWorkspaceTier(supabase,context.workspaceId);
  if(tier.error || tier.data==='free') return { data:null,error:tier.error ?? 'Pro or Clinic is required to add appointment notes' };
  const repo = new NoteRepository(supabase, context.userId, context.ownerId); // author + owner
  const result = await repo.create(parsed.data);

  if (!result.error) {
    revalidatePath(`/patients/${input.patientId}`);
  }
  return result;
}

export async function deleteNote(noteId: string, patientId: string) {
  if(!z.object({ noteId:z.uuid(),patientId:z.uuid() }).safeParse({ noteId,patientId }).success) return { error:'Invalid note or patient' };
  const context = await getUserContext();
  if (!context) return { error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { error: 'Permission denied. You cannot delete notes.' };
  }

  const supabase = await createClient();
  const repo = new NoteRepository(supabase, context.userId, context.ownerId);
  const result = await repo.delete(noteId);

  if (!result.error) {
    revalidatePath(`/patients/${patientId}`);
  }
  return result;
}
