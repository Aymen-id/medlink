import { z } from "zod";

export const grantStaffSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["receptionist", "assistant"], {
    error: "Role must be receptionist or assistant",
  }),
  permissions: z.enum(["view", "edit"], {
    error: "Permissions must be view or edit",
  }),
});

export type GrantStaffInput = z.infer<typeof grantStaffSchema>;
