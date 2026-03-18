import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  specialty: z.string().nullable().optional(),
  credentials: z.string().nullable().optional(),
  clinicAddress: z.string().nullable().optional(),
  consultationHours: z.record(z.string(), z.string()).nullable().optional(),
  contactCTA: z.string().nullable().optional(),
  bookingCTA: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  isPublished: z.boolean().optional().default(false),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
