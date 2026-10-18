'use server';

import { createClient } from '@/lib/supabase/server';
import { updatePasswordSchema } from '@/lib/schemas/auth.schema';

export type PasswordUpdateState = { error?: string; success?: boolean };

export async function updateRecoveredPassword(
  _previous: PasswordUpdateState, formData: FormData,
): Promise<PasswordUpdateState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'), confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !user) return { error: 'This recovery session has expired. Request a new reset link.' };
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { error: 'Could not update your password. Request a new link or try a stronger password.' };
    return { success: true };
  } catch {
    return { error: 'Could not connect to the authentication service. Please try again.' };
  }
}
