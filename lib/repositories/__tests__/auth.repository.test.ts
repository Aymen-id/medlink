import { describe, it, expect, vi } from 'vitest';
import { AuthRepository } from '../auth.repository';

// Mock Supabase client
const mockSupabase = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
  from: vi.fn().mockImplementation(() => ({
    insert: vi.fn().mockResolvedValue({ error: null })
  })),
};

describe('AuthRepository', () => {
  const repo = new AuthRepository(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

  describe('signUp', () => {
    it('should successfully sign up and create a profile', async () => {
      const mockResult = { data: { user: { id: '123' } }, error: null };
      mockSupabase.auth.signUp.mockResolvedValueOnce(mockResult);

      const result = await repo.signUp({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Dr. John Doe',
      });

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: { data: { display_name: 'Dr. John Doe' } }
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResult.data);
    });

    it('should handle signup error', async () => {
      mockSupabase.auth.signUp.mockResolvedValueOnce({ data: null, error: { message: 'Signup failed' } });

      const result = await repo.signUp({
        email: 'test@example.com',
        password: 'password',
        displayName: 'Dr. Jane',
      });

      expect(result.error).toBe('Signup failed');
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: {} }, error: null });

      const result = await repo.signIn({ email: 'test@example.com', password: 'password123' });
      
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.error).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValueOnce({ error: null });
      const result = await repo.signOut();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });
  });

  // Additional mock implementations for reset and update
  describe('resetPassword', () => {
    it('should send reset password email', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
      const result = await repo.resetPassword({ email: 'test@example.com' });
      
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(Object)
      );
      expect(result.error).toBeNull();
    });
  });
});
