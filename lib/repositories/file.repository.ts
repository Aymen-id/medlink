import type { SupabaseClient } from '@supabase/supabase-js';
import type { PatientFile } from '@/types';
import type { ApiResponse } from '@/types/api';

type FileRow = {
  id: string;
  patient_id: string;
  folder_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  tags: string[];
  created_at: string;
};

function mapRowToFile(row: FileRow): PatientFile {
  return {
    id: row.id,
    patientId: row.patient_id,
    folderId: row.folder_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    tags: row.tags ?? [],
    createdAt: row.created_at,
  };
}

const STORAGE_BUCKET = 'patient-files';

export type UploadFileParams = {
  patientId: string;
  file: File;
  folderId?: string | null;
  tags?: string[];
};

export type ListFileOptions = {
  folderId?: string | null;
};

export class FileRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string,
  ) {}

  /**
   * Fetches a file record only if it belongs to a patient owned by this.ownerId.
   * Defense-in-depth: prevents cross-owner access even if RLS is misconfigured.
   */
  private async fetchOwnedFile(fileId: string): Promise<{ data: FileRow | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('patient_files')
      .select('*, patients!inner(owner_id)')
      .eq('id', fileId)
      .eq('patients.owner_id', this.ownerId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as FileRow, error: null };
  }

  // ---- UPLOAD ----
  async upload(params: UploadFileParams): Promise<ApiResponse<PatientFile>> {
    const { patientId, file, folderId, tags } = params;

    // Build storage path: owner_id/patient_id/timestamp_filename
    const timestamp = Date.now();
    const storagePath = `${this.ownerId}/${patientId}/${timestamp}_${file.name}`;

    // 1. Upload to Supabase Storage
    const { data: storageData, error: storageError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      return { data: null, error: storageError.message };
    }

    // 2. Insert record into patient_files
    const { data, error } = await this.supabase
      .from('patient_files')
      .insert({
        patient_id: patientId,
        folder_id: folderId ?? null,
        file_name: file.name,
        storage_path: storageData.path,
        mime_type: file.type,
        size_bytes: file.size,
        tags: tags ?? [],
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToFile(data as FileRow), error: null };
  }

  // ---- LIST BY PATIENT ----
  async listByPatient(
    patientId: string,
    options?: ListFileOptions,
  ): Promise<ApiResponse<PatientFile[]>> {
    let query = this.supabase
      .from('patient_files')
      .select('*, patients!inner(owner_id)')
      .eq('patient_id', patientId)
      .eq('patients.owner_id', this.ownerId);

    if (options !== undefined && 'folderId' in options) {
      if (options.folderId === null) {
        query = query.is('folder_id', null);
      } else if (options.folderId !== undefined) {
        query = query.eq('folder_id', options.folderId);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as FileRow[];
    return { data: rows.map(mapRowToFile), error: null };
  }

  // ---- SEARCH BY NAME ----
  async search(query: string): Promise<ApiResponse<PatientFile[]>> {
    const { data, error } = await this.supabase
      .from('patient_files')
      .select('*, patients!inner(owner_id)')
      .eq('patients.owner_id', this.ownerId)
      .ilike('file_name', `%${query}%`)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as FileRow[];
    return { data: rows.map(mapRowToFile), error: null };
  }

  // ---- SEARCH BY TAGS ----
  async searchByTags(
    patientId: string,
    tags: string[],
  ): Promise<ApiResponse<PatientFile[]>> {
    const { data, error } = await this.supabase
      .from('patient_files')
      .select('*, patients!inner(owner_id)')
      .eq('patient_id', patientId)
      .eq('patients.owner_id', this.ownerId)
      .contains('tags', tags)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as FileRow[];
    return { data: rows.map(mapRowToFile), error: null };
  }

  // ---- UPDATE TAGS ----
  async updateTags(
    fileId: string,
    tags: string[],
  ): Promise<ApiResponse<PatientFile>> {
    // Verify ownership first
    const owned = await this.fetchOwnedFile(fileId);
    if (owned.error || !owned.data) return { data: null, error: owned.error ?? 'File not found' };

    const { data, error } = await this.supabase
      .from('patient_files')
      .update({ tags })
      .eq('id', fileId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToFile(data as FileRow), error: null };
  }

  // ---- MOVE TO FOLDER ----
  async moveToFolder(
    fileId: string,
    folderId: string | null,
  ): Promise<ApiResponse<PatientFile>> {
    // Verify ownership first
    const owned = await this.fetchOwnedFile(fileId);
    if (owned.error || !owned.data) return { data: null, error: owned.error ?? 'File not found' };

    const { data, error } = await this.supabase
      .from('patient_files')
      .update({ folder_id: folderId })
      .eq('id', fileId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToFile(data as FileRow), error: null };
  }

  // ---- DELETE ----
  async delete(fileId: string): Promise<{ error: string | null }> {
    // 1. Fetch the file with ownership verification
    const { data: ownedFile, error: fetchError } = await this.fetchOwnedFile(fileId);

    if (fetchError || !ownedFile) return { error: fetchError ?? 'File not found' };

    // 2. Remove from storage
    const { error: storageError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .remove([ownedFile.storage_path]);

    if (storageError) return { error: storageError.message };

    // 3. Delete DB record
    const { error: deleteError } = await this.supabase
      .from('patient_files')
      .delete()
      .eq('id', fileId);

    return { error: deleteError?.message ?? null };
  }

  // ---- GET SIGNED URL ----
  async getSignedUrl(
    fileId: string,
    expiresInSeconds = 3600,
  ): Promise<ApiResponse<string>> {
    // 1. Fetch the file with ownership verification
    const { data: ownedFile, error: fetchError } = await this.fetchOwnedFile(fileId);

    if (fetchError || !ownedFile) return { data: null, error: fetchError ?? 'File not found' };

    // 2. Create signed URL
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(ownedFile.storage_path, expiresInSeconds);

    if (error) return { data: null, error: error.message };
    return { data: data.signedUrl, error: null };
  }

  // ---- COUNT BY OWNER ----
  async countByOwner(): Promise<ApiResponse<number>> {
    // Try RPC first for efficiency (single cross-table count)
    const { data: rpcData, error: rpcError } = await this.supabase.rpc(
      'count_owner_files',
      { owner_uuid: this.ownerId },
    );

    if (!rpcError && rpcData !== null) {
      return { data: rpcData as number, error: null };
    }

    // Fallback: use a joined query through the patients table
    const { count, error } = await this.supabase
      .from('patient_files')
      .select('*, patients!inner(owner_id)', { count: 'exact', head: true })
      .eq('patients.owner_id', this.ownerId)
      .single();

    if (error) return { data: 0, error: null };
    return { data: count ?? 0, error: null };
  }
}
