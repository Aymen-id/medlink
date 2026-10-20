import { z } from "zod";

export const createPatientSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(100),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(100),
  dateOfBirth: z.string().trim().refine(value=>value==='' || z.iso.date().safeParse(value).success,'Invalid date format (YYYY-MM-DD)').transform(value=>value || null).nullable().optional(),
  gender: z.string().trim().max(50).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email("Invalid email address").max(254).nullable().optional().or(z.literal("")),
}).strict();

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
