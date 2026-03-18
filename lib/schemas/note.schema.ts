import { z } from "zod";

export const createNoteSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  content: z.string().min(1, "Note content cannot be empty"),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
