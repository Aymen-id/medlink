import { z } from "zod";

export const uploadFileSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  folderId: z.string().uuid("Invalid folder ID").nullable().optional(),
  tags: z.array(z.string()).optional(),
  // Actual file validation usually happens through multipart/form-data parsing or client side
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;

export const uploadMetadataSchema = uploadFileSchema.extend({
  fileName:z.string().trim().min(1).max(255).refine(name=>!/[\/\\\u0000-\u001f\u007f]/u.test(name),'Invalid filename'),
  mimeType:z.enum(['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  sizeBytes:z.number().int().min(1).max(50*1024*1024),
  tags:z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});
