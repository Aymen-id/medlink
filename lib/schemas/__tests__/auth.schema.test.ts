import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema } from '../auth.schema';

describe('Auth Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login input', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({ email: 'invalid-email', password: 'password123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email address');
      }
    });

    it('should reject short password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: '123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at least 6 characters');
      }
    });
  });

  describe('signupSchema', () => {
    it('should validate correct signup input', () => {
      const result = signupSchema.safeParse({ email: 'test@example.com', password: 'password123', displayName: 'Dr. Test' });
      expect(result.success).toBe(true);
    });

    it('should reject missing displayName', () => {
      const result = signupSchema.safeParse({ email: 'test@example.com', password: 'password123' });
      expect(result.success).toBe(false);
    });
  });
});
