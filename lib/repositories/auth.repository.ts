import { SupabaseClient } from "@supabase/supabase-js";
import { LoginInput, ResetPasswordInput, SignupInput, UpdatePasswordInput } from "../schemas/auth.schema";

export class AuthRepository {
  constructor(private supabase: SupabaseClient) {}

  async signUp(input: SignupInput) {
    // Create auth user — the doctor_profiles record is created atomically
    // by the Postgres trigger `handle_new_user()` on auth.users INSERT.
    // The display_name is passed via user metadata so the trigger can read it.
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.displayName,
        }
      }
    });

    if (authError) return { data: null, error: authError.message };
    return { data: authData, error: null };
  }

  async signIn(input: LoginInput) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    return { error: error?.message || null };
  }

  async resetPassword(input: ResetPasswordInput) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password/update`,
    });
    
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async updatePassword(input: UpdatePasswordInput) {
    const { data, error } = await this.supabase.auth.updateUser({
      password: input.password,
    });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async getSession() {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) return { data: null, error: error.message };
    return { data: data.session, error: null };
  }

  async getUser() {
    const { data, error } = await this.supabase.auth.getUser();
    if (error) return { data: null, error: error.message };
    return { data: data.user, error: null };
  }
}
