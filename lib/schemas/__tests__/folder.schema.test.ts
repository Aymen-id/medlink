import { describe, it, expect } from 'vitest';
import { createFolderSchema, renameFolderSchema } from '../folder.schema';

describe('createFolderSchema', () => {
  const validUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  const validCases = [
    { name: 'simple name', input: { name: 'X-Rays', patientId: validUuid } },
    { name: 'with spaces', input: { name: 'Lab Results 2025', patientId: validUuid } },
    { name: 'with dashes', input: { name: 'pre-op-docs', patientId: validUuid } },
    { name: 'with underscores', input: { name: 'scan_results', patientId: validUuid } },
    { name: 'with parentheses', input: { name: 'Reports (Final)', patientId: validUuid } },
    { name: 'with parent folder', input: { name: 'Sub', patientId: validUuid, parentId: validUuid } },
    { name: 'null parent folder', input: { name: 'Root', patientId: validUuid, parentId: null } },
  ];

  const invalidCases = [
    { name: 'empty name', input: { name: '', patientId: validUuid }, error: 'required' },
    { name: 'name over 100 chars', input: { name: 'a'.repeat(101), patientId: validUuid }, error: '100' },
    { name: 'invalid chars (slash)', input: { name: 'foo/bar', patientId: validUuid }, error: 'invalid' },
    { name: 'invalid chars (semicolon)', input: { name: 'foo;bar', patientId: validUuid }, error: 'invalid' },
    { name: 'invalid patient ID', input: { name: 'OK', patientId: 'not-uuid' }, error: 'patient' },
    { name: 'missing patient ID', input: { name: 'OK' }, error: 'invalid' },
    { name: 'invalid parent ID', input: { name: 'OK', patientId: validUuid, parentId: 'bad' }, error: 'invalid' },
  ];

  for (const { name, input } of validCases) {
    it(`should accept: ${name}`, () => {
      const result = createFolderSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  }

  for (const { name, input, error } of invalidCases) {
    it(`should reject: ${name}`, () => {
      const result = createFolderSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues[0].message.toLowerCase();
        expect(msg).toContain(error.toLowerCase());
      }
    });
  }
});

describe('renameFolderSchema', () => {
  const validCases = [
    { name: 'simple rename', input: { name: 'New Name' } },
    { name: 'min length', input: { name: 'A' } },
    { name: 'max length', input: { name: 'a'.repeat(100) } },
  ];

  const invalidCases = [
    { name: 'empty name', input: { name: '' }, error: 'required' },
    { name: 'too long', input: { name: 'a'.repeat(101) }, error: '100' },
    { name: 'invalid chars', input: { name: '<script>' }, error: 'invalid' },
  ];

  for (const { name, input } of validCases) {
    it(`should accept: ${name}`, () => {
      expect(renameFolderSchema.safeParse(input).success).toBe(true);
    });
  }

  for (const { name, input } of invalidCases) {
    it(`should reject: ${name}`, () => {
      expect(renameFolderSchema.safeParse(input).success).toBe(false);
    });
  }
});
