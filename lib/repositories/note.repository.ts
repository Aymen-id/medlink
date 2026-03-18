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
  ) {}

  async create(input: CreateNoteInput): Promise<ApiResponse<AppointmentNote>> {
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
      .select('*', { count: 'exact' })
      .eq('patient_id', patientId)
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
    const { error } = await this.supabase
      .from('appointment_notes')
      .delete()
      .eq('id', id);

    return { error: error?.message ?? null };
  }
}
