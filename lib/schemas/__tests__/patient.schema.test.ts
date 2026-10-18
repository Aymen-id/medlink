import { describe, it, expect } from 'vitest';
import { createPatientSchema } from '../patient.schema';

describe('Patient Schemas', () => {
  describe('createPatientSchema', () => {
    it('should validate correct basic input', () => {
      const result = createPatientSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should validate full input', () => {
      const result = createPatientSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        email: 'john@example.com',
        phone: '+1234567890',
        gender: 'Male'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = createPatientSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '01-01-1990',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
         expect(result.error.issues[0].message).toContain('Invalid date format');
      }
    });

    it('accepts an empty optional date but rejects impossible calendar dates',()=>{
      expect(createPatientSchema.parse({ firstName:'Synthetic',lastName:'Patient',dateOfBirth:'' }).dateOfBirth).toBeNull();
      expect(createPatientSchema.safeParse({ firstName:'Synthetic',lastName:'Patient',dateOfBirth:'2026-02-30' }).success).toBe(false);
    });
  });
});
