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
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string,
  ) {}

  /**
   * Verifies the target patient belongs to this.ownerId (defense-in-depth).
   */
  private async verifyPatientOwnership(patientId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('owner_id', this.ownerId)
      .single();

    return data !== null;
  }

  async create(input: CreateFolderInput): Promise<ApiResponse<Folder>> {
    // Verify the patient belongs to this owner
    const isOwned = await this.verifyPatientOwnership(input.patientId);
    if (!isOwned) return { data: null, error: 'Patient not found or access denied' };

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
      .select('*, patients!inner(owner_id)')
      .eq('patient_id', patientId)
      .eq('patients.owner_id', this.ownerId);

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
    // Verify folder belongs to an owned patient via join
    const { data: existing } = await this.supabase
      .from('folders')
      .select('*, patients!inner(owner_id)')
      .eq('id', id)
      .eq('patients.owner_id', this.ownerId)
      .single();

    if (!existing) return { data: null, error: 'Folder not found or access denied' };

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
    // Verify folder belongs to an owned patient via join
    const { data: existing } = await this.supabase
      .from('folders')
      .select('*, patients!inner(owner_id)')
      .eq('id', id)
      .eq('patients.owner_id', this.ownerId)
      .single();

    if (!existing) return { error: 'Folder not found or access denied' };

    const { error } = await this.supabase
      .from('folders')
      .delete()
      .eq('id', id);

    return { error: error?.message ?? null };
  }
}
