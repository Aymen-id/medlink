import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppointmentNote } from '@/types';
import type { CreateNoteInput, UpdateNoteInput } from '@/lib/schemas/note.schema';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

type NoteRow = {
  id: string;
  patient_id: string;
  content: string;
  author_id: string;
  created_at: string;
};

function mapRowToNote(row: NoteRow): AppointmentNote {
  return {
    id: row.id,
    patientId: row.patient_id,
    content: row.content,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

export class NoteRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly authorId: string,
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

  /**
   * Verifies a note belongs to a patient owned by this.ownerId.
   */
  private async verifyNoteOwnership(noteId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('appointment_notes')
      .select('*, patients!inner(owner_id)')
      .eq('id', noteId)
      .eq('patients.owner_id', this.ownerId)
      .single();

    return data !== null && data.author_id===this.authorId;
  }

  async create(input: CreateNoteInput): Promise<ApiResponse<AppointmentNote>> {
    // Verify patient ownership
    const isOwned = await this.verifyPatientOwnership(input.patientId);
    if (!isOwned) return { data: null, error: 'Patient not found or access denied' };

    const { data, error } = await this.supabase
      .from('appointment_notes')
      .insert({
        patient_id: input.patientId,
        content: input.content,
        author_id: this.authorId,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToNote(data as NoteRow), error: null };
  }

  async listByPatient(
    patientId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResponse<AppointmentNote>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('appointment_notes')
      .select('*, patients!inner(owner_id)', { count: 'exact' })
      .eq('patient_id', patientId)
      .eq('patients.owner_id', this.ownerId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return {
        data: [],
        error: error.message,
        meta: null,
      };
    }

    const rows = (data ?? []) as NoteRow[];

    return {
      data: rows.map(mapRowToNote),
      error: null,
      meta: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  async update(
    id: string,
    input: UpdateNoteInput,
  ): Promise<ApiResponse<AppointmentNote>> {
    // Verify note belongs to an owned patient
    const isOwned = await this.verifyNoteOwnership(id);
    if (!isOwned) return { data: null, error: 'Note not found or access denied' };

    const { data, error } = await this.supabase
      .from('appointment_notes')
      .update({ content: input.content })
      .eq('id', id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToNote(data as NoteRow), error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    // Verify note belongs to an owned patient
    const isOwned = await this.verifyNoteOwnership(id);
    if (!isOwned) return { error: 'Note not found or access denied' };

    const { error } = await this.supabase
      .from('appointment_notes')
      .delete()
      .eq('id', id);

    return { error: error?.message ?? null };
  }
}
