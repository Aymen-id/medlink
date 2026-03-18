import type { SupabaseClient } from '@supabase/supabase-js';
import type { Folder } from '@/types';
import type { ApiResponse } from '@/types/api';

type FolderRow = {
  id: string;
  patient_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
};

function mapRowToFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
  };
}

export type CreateFolderInput = {
  patientId: string;
  name: string;
  parentId: string | null;
};

export type ListFolderOptions = {
  parentId?: string | null;
};

export class FolderRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateFolderInput): Promise<ApiResponse<Folder>> {
    const { data, error } = await this.supabase
      .from('folders')
      .insert({
        patient_id: input.patientId,
        name: input.name,
        parent_id: input.parentId,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToFolder(data as FolderRow), error: null };
  }

  async listByPatient(
    patientId: string,
    options?: ListFolderOptions,
  ): Promise<ApiResponse<Folder[]>> {
    let query = this.supabase
      .from('folders')
      .select()
      .eq('patient_id', patientId);

    if (options !== undefined && 'parentId' in options) {
      if (options.parentId === null) {
        query = query.is('parent_id', null);
      } else if (options.parentId !== undefined) {
        query = query.eq('parent_id', options.parentId);
      }
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as FolderRow[];
    return { data: rows.map(mapRowToFolder), error: null };
  }

  async rename(id: string, name: string): Promise<ApiResponse<Folder>> {
    const { data, error } = await this.supabase
      .from('folders')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToFolder(data as FolderRow), error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('folders')
      .delete()
      .eq('id', id);

    return { error: error?.message ?? null };
  }
}
