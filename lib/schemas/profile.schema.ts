import { z } from "zod";
export const RESERVED_PROFILE_SLUGS=['login','signup','reset-password','auth','patients','settings','analytics','search','api','admin','billing','team','uploads','files','workspaces','privacy','terms','support','help','www','dashboard'] as const;
export const profileSlugSchema=z.string().trim().min(3,'Slug must be at least 3 characters').max(80).regex(/^[a-z0-9-]+$/,'Slug can only contain lowercase letters, numbers, and hyphens').refine(value=>!RESERVED_PROFILE_SLUGS.some(slug=>slug===value),'This address is reserved by MediLink');

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  slug: profileSlugSchema,
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
