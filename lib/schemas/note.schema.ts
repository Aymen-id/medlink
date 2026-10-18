import { z } from "zod";

export const createNoteSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  content: z.string().trim().min(1, "Note content cannot be empty").max(20000),
});

export const updateNoteSchema = z.object({
  content: z.string().trim().min(1, "Note content cannot be empty").max(20000),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
