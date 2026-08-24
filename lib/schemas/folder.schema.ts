import { z } from "zod";

export const createFolderSchema = z.object({
  name: z.string()
    .min(1, "Folder name is required")
    .max(100, "Folder name must be 100 characters or less")
    .regex(/^[a-zA-Z0-9\s\-_().]+$/, "Folder name contains invalid characters"),
  patientId: z.string().uuid("Invalid patient ID"),
  parentId: z.string().uuid("Invalid parent folder ID").nullable().optional(),
});

export const renameFolderSchema = z.object({
  name: z.string()
    .min(1, "Folder name is required")
    .max(100, "Folder name must be 100 characters or less")
    .regex(/^[a-zA-Z0-9\s\-_().]+$/, "Folder name contains invalid characters"),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;
