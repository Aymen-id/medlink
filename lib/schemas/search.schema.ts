import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim()
    .min(1, "Search query is required")
    .max(100, "Search query must be 100 characters or less")
    .regex(/^[^;'"\\%]+$/, "Search query contains invalid characters"),
  tags: z.array(z.string().min(1).max(50)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
