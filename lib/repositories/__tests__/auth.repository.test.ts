import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthRepository } from '../auth.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabase() {
  return {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
  } as unknown as SupabaseClient;
}

describe('AuthRepository', () => {
  let supabase: ReturnType<typeof createMockSupabase>;
  let repo: AuthRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://clinic.example');
    supabase = createMockSupabase();
    repo = new AuthRepository(supabase);
  });

  // -------- SIGNUP --------
  describe('signUp', () => {
    const input = { email: 'doc@clinic.com', password: 'Secure123!', displayName: 'Dr. Smith' };

    it('should create a new user with display name in metadata', async () => {
      const mockData = { user: { id: 'u1' }, session: null };
      (supabase.auth.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockData, error: null });

      const result = await repo.signUp(input);

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'doc@clinic.com',
        password: 'Secure123!',
        options: { data: { display_name: 'Dr. Smith' }, emailRedirectTo: 'https://clinic.example/auth/callback' },
      });
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('should return error message on signup failure', async () => {
      (supabase.auth.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'Email already registered' },
      });

      const result = await repo.signUp(input);

      expect(result.data).toBeNull();
      expect(result.error).toBe('Email already registered');
    });
  });

  // -------- SIGNIN --------
  describe('signIn', () => {
    const input = { email: 'doc@clinic.com', password: 'pass123' };

    it('should sign in with valid credentials', async () => {
      const mockData = { session: { access_token: 'tok' }, user: { id: 'u1' } };
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockData, error: null });

      const result = await repo.signIn(input);

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'doc@clinic.com',
        password: 'pass123',
      });
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('should return error for invalid credentials', async () => {
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const result = await repo.signIn(input);

      expect(result.data).toBeNull();
      expect(result.error).toBe('Invalid login credentials');
    });
  });

  // -------- SIGNOUT --------
  describe('signOut', () => {
    it('should sign out successfully', async () => {
      (supabase.auth.signOut as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });

      const result = await repo.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });

    it('should return error on signout failure', async () => {
      (supabase.auth.signOut as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        error: { message: 'Session expired' },
      });

      const result = await repo.signOut();

      expect(result.error).toBe('Session expired');
    });
  });

  // -------- RESET PASSWORD --------
  describe('resetPassword', () => {
    it('should send reset email successfully', async () => {
      (supabase.auth.resetPasswordForEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {}, error: null });

      const result = await repo.resetPassword({ email: 'doc@clinic.com' });

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'doc@clinic.com',
        { redirectTo: 'https://clinic.example/auth/callback?next=%2Freset-password%2Fupdate' },
      );
      expect(result.data).toEqual({});
      expect(result.error).toBeNull();
    });

    it('should return error when reset fails', async () => {
      (supabase.auth.resetPasswordForEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded' },
      });

      const result = await repo.resetPassword({ email: 'doc@clinic.com' });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Rate limit exceeded');
    });
  });

  // -------- UPDATE PASSWORD --------
  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      const mockUser = { id: 'u1', email: 'doc@clinic.com' };
      (supabase.auth.updateUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { user: mockUser }, error: null });

      const result = await repo.updatePassword({ password: 'NewPass456!', confirmPassword: 'NewPass456!' });

      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPass456!' });
      expect(result.data).toEqual({ user: mockUser });
      expect(result.error).toBeNull();
    });

    it('should return error on update failure', async () => {
      (supabase.auth.updateUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'Password too weak' },
      });

      const result = await repo.updatePassword({ password: '123', confirmPassword: '123' });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Password too weak');
    });
  });

  // -------- GET SESSION --------
  describe('getSession', () => {
    it('should return current session', async () => {
      const mockSession = { access_token: 'tok', user: { id: 'u1' } };
      (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const result = await repo.getSession();

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(result.data).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should return error when session fetch fails', async () => {
      (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'Session not found' },
      });

      const result = await repo.getSession();

      expect(result.data).toBeNull();
      expect(result.error).toBe('Session not found');
    });
  });

  // -------- GET USER --------
  describe('getUser', () => {
    it('should return current user', async () => {
      const mockUser = { id: 'u1', email: 'doc@clinic.com' };
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const result = await repo.getUser();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(result.data).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('should return error when user fetch fails', async () => {
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'Not authenticated' },
      });

      const result = await repo.getUser();

      expect(result.data).toBeNull();
      expect(result.error).toBe('Not authenticated');
    });
  });
});
