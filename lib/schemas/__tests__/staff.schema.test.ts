import { describe, it, expect } from 'vitest';
import { grantStaffSchema } from '../staff.schema';

describe('grantStaffSchema', () => {
  const validCases = [
    {
      name: 'receptionist with view',
      input: { email: 'nurse@clinic.com', role: 'receptionist', permissions: 'view' },
    },
    {
      name: 'assistant with edit',
      input: { email: 'assist@clinic.com', role: 'assistant', permissions: 'edit' },
    },
    {
      name: 'receptionist with edit',
      input: { email: 'front@clinic.com', role: 'receptionist', permissions: 'edit' },
    },
    {
      name: 'assistant with view',
      input: { email: 'tech@clinic.com', role: 'assistant', permissions: 'view' },
    },
  ];

  const invalidCases = [
    { name: 'invalid email', input: { email: 'not-email', role: 'receptionist', permissions: 'view' } },
    { name: 'empty email', input: { email: '', role: 'receptionist', permissions: 'view' } },
    { name: 'invalid role', input: { email: 'a@b.com', role: 'admin', permissions: 'view' } },
    { name: 'invalid permissions', input: { email: 'a@b.com', role: 'receptionist', permissions: 'delete' } },
    { name: 'missing email', input: { role: 'receptionist', permissions: 'view' } },
    { name: 'missing role', input: { email: 'a@b.com', permissions: 'view' } },
    { name: 'missing permissions', input: { email: 'a@b.com', role: 'receptionist' } },
    { name: 'empty object', input: {} },
  ];

  for (const { name, input } of validCases) {
    it(`should accept: ${name}`, () => {
      expect(grantStaffSchema.safeParse(input).success).toBe(true);
    });
  }

  for (const { name, input } of invalidCases) {
    it(`should reject: ${name}`, () => {
      expect(grantStaffSchema.safeParse(input).success).toBe(false);
    });
  }

  it('should parse and return typed output for valid input', () => {
    const result = grantStaffSchema.parse({
      email: 'team@clinic.com',
      role: 'assistant',
      permissions: 'edit',
    });
    expect(result.email).toBe('team@clinic.com');
    expect(result.role).toBe('assistant');
    expect(result.permissions).toBe('edit');
  });
});
