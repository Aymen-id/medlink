import { z } from "zod";

export const uploadFileSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  folderId: z.string().uuid("Invalid folder ID").nullable().optional(),
  tags: z.array(z.string()).optional(),
  // Actual file validation usually happens through multipart/form-data parsing or client side
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
