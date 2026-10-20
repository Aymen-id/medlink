import type { SupabaseClient } from '@supabase/supabase-js';
import type { Patient } from '@/types';
import type { CreatePatientInput, UpdatePatientInput } from '@/lib/schemas/patient.schema';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

type PatientRow = {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

function mapRowToPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    ownerId: row.owner_id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInputToRow(
  input: CreatePatientInput | UpdatePatientInput,
  ownerId?: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (ownerId !== undefined) row.owner_id = ownerId;
  if (input.firstName !== undefined) row.first_name = input.firstName;
  if (input.lastName !== undefined) row.last_name = input.lastName;
  if (input.dateOfBirth !== undefined) row.date_of_birth = input.dateOfBirth ?? null;
  if (input.gender !== undefined) row.gender = input.gender ?? null;
  if (input.phone !== undefined) row.phone = input.phone ?? null;
  if (input.email !== undefined) row.email = input.email ?? null;

  return row;
}

export class PatientRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string,
  ) {}

  async create(input: CreatePatientInput): Promise<ApiResponse<Patient>> {
    const row = mapInputToRow(input, this.ownerId);

    const { data, error } = await this.supabase
      .from('patients')
      .insert(row)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToPatient(data as PatientRow), error: null };
  }

  async getById(id: string): Promise<ApiResponse<Patient>> {
    const { data, error } = await this.supabase
      .from('patients')
      .select()
      .eq('id', id)
      .eq('owner_id', this.ownerId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToPatient(data as PatientRow), error: null };
  }

  async list(
    options: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResponse<Patient>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('owner_id', this.ownerId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return {
        data: [],
        error: error.message,
        meta: null,
      };
    }

    const rows = (data ?? []) as PatientRow[];

    return {
      data: rows.map(mapRowToPatient),
      error: null,
      meta: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  async search(query: string,page?:number,limit=20): Promise<ApiResponse<Patient[]>> {
    const pattern = `%${query.replace(/[_%]/gu,value=>`\\${value}`)}%`;

    let request = this.supabase
      .from('patients')
      .select()
      .eq('owner_id', this.ownerId)
      .or(`first_name.ilike."${pattern}",last_name.ilike."${pattern}"`)
      .order('created_at', { ascending: false });
    if(page) request=request.order('id',{ ascending:true }).range((page-1)*limit,page*limit);
    const { data,error }=await request;

    if (error) return { data: [], error: error.message };

    const rows = (data ?? []) as PatientRow[];
    return { data: rows.map(mapRowToPatient), error: null };
  }

  async update(id: string, input: UpdatePatientInput): Promise<ApiResponse<Patient>> {
    const row = mapInputToRow(input);

    const { data, error } = await this.supabase
      .from('patients')
      .update(row)
      .eq('id', id)
      .eq('owner_id', this.ownerId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToPatient(data as PatientRow), error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('patients')
      .delete()
      .eq('id', id)
      .eq('owner_id', this.ownerId);

    return { error: error?.message ?? null };
  }

  async count(): Promise<ApiResponse<number>> {
    const { count, error } = await this.supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', this.ownerId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: count ?? 0, error: null };
  }
}
