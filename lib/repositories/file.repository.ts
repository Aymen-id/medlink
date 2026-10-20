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

export type ListFileOptions = {
  folderId?: string | null;
  page?:number;
  limit?:number;
};

export class FileRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string,
    private readonly storageClient: SupabaseClient = supabase,
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

    query=query.order('created_at', { ascending: false });
    if(options?.page) query=query.order('id',{ ascending:true }).range((options.page-1)*(options.limit ?? 50),options.page*(options.limit ?? 50));
    const { data, error } = await query;

    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as FileRow[];
    return { data: rows.map(mapRowToFile), error: null };
  }

  // ---- SEARCH BY NAME ----
  async search(query: string,page=1,limit=20): Promise<ApiResponse<PatientFile[]>> {
    const { data,error }=await this.supabase.rpc('search_workspace_files',{ workspace_id:this.ownerId,search_query:query,page_number:page,page_size:limit });

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
  async updateMetadata(fileId:string,input:{ tags:string[];folderId:string | null }):Promise<ApiResponse<PatientFile>> {
    const owned=await this.fetchOwnedFile(fileId);
    if(!owned.data || owned.error) return { data:null,error:owned.error ?? 'File not found' };
    const { data,error }=await this.supabase.from('patient_files').update({ tags:input.tags,folder_id:input.folderId }).eq('id',fileId).select().single();
    return error ? { data:null,error:error.message }:{ data:mapRowToFile(data as FileRow),error:null };
  }
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

    // A database trigger queues physical removal atomically with metadata deletion.
    // Keep the retry entry if Storage is unavailable.
    const { error: deleteError } = await this.supabase
      .from('patient_files')
      .delete()
      .eq('id', fileId);

    return { error: deleteError?.message ?? null };
  }

  // ---- GET SIGNED URL ----
  async getSignedUrl(
    fileId: string,
  ): Promise<ApiResponse<string>> {
    // 1. Fetch the file with ownership verification
    const { data: ownedFile, error: fetchError } = await this.fetchOwnedFile(fileId);

    if (fetchError || !ownedFile) return { data: null, error: fetchError ?? 'File not found' };

    // Historical API name retained; every download now rechecks current membership.
    return { data:`/api/files/${encodeURIComponent(fileId)}/download`,error:null };
  }

  async downloadFile(fileId:string):Promise<ApiResponse<{ blob:Blob;fileName:string }>> {
    const { data:file,error }=await this.fetchOwnedFile(fileId);
    if(error || !file) return { data:null,error:error ?? 'File not found' };
    const { data:blob,error:storageError }=await this.storageClient.storage.from(STORAGE_BUCKET).download(file.storage_path);
    if(storageError || !blob) return { data:null,error:storageError?.message ?? 'Download failed' };
    return { data:{ blob,fileName:file.file_name },error:null };
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
