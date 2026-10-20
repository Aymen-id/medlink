import { describe, it, expect } from 'vitest';
import { uploadFileSchema } from '../file.schema';

describe('uploadFileSchema', () => {
  const validUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  const validCases = [
    { name: 'minimal (patientId only)', input: { patientId: validUuid } },
    { name: 'with folder', input: { patientId: validUuid, folderId: validUuid } },
    { name: 'with null folder', input: { patientId: validUuid, folderId: null } },
    { name: 'with tags', input: { patientId: validUuid, tags: ['urgent', 'lab'] } },
    { name: 'with empty tags', input: { patientId: validUuid, tags: [] } },
    { name: 'full input', input: { patientId: validUuid, folderId: validUuid, tags: ['scan'] } },
  ];

  const invalidCases = [
    { name: 'invalid patientId', input: { patientId: 'bad-uuid' } },
    { name: 'missing patientId', input: {} },
    { name: 'invalid folderId', input: { patientId: validUuid, folderId: 'not-uuid' } },
    { name: 'tags not array', input: { patientId: validUuid, tags: 'single-tag' } },
  ];

  for (const { name, input } of validCases) {
    it(`should accept: ${name}`, () => {
      expect(uploadFileSchema.safeParse(input).success).toBe(true);
    });
  }

  for (const { name, input } of invalidCases) {
    it(`should reject: ${name}`, () => {
      expect(uploadFileSchema.safeParse(input).success).toBe(false);
    });
  }
});
