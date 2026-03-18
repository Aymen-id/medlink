import { SupabaseClient } from "@supabase/supabase-js";
import { LoginInput, ResetPasswordInput, SignupInput, UpdatePasswordInput } from "../schemas/auth.schema";

export class AuthRepository {
  constructor(private supabase: SupabaseClient) {}

  async signUp(input: SignupInput) {
    // 1. Create auth user
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.displayName, // used by auth trigger if we create one, or we can manually insert
        }
      }
    });

    if (authError) return { data: null, error: authError.message };

    // Note: The doctor_profiles record should ideally be created by a postgres trigger on auth.users insert.
    // If not using a trigger, we would insert it here. Let's assume the trigger handles it, 
    // or we manually ensure it. Let's manually insert just in case, but safe against conflicts.
    // We update the Supabase schema to use a trigger or handle it here. 
    // In our schema, we didn't specify the trigger function, so let's manually create the profile.
    
    if (authData.user) {
      // Create a slug from display name
      const baseSlug = input.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const uniqueSlug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;

      const { error: profileError } = await this.supabase
        .from('doctor_profiles')
        .insert({
          id: authData.user.id,
          user_id: authData.user.id,
          display_name: input.displayName,
          slug: uniqueSlug,
        });

      if (profileError) {
        // Profile creation failed but user auth was created
        return { data: authData, error: `Profile creation failed: ${profileError.message}` };
      }
    }

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
