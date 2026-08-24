import { describe, it, expect } from 'vitest';
import { createNoteSchema, updateNoteSchema } from '../note.schema';

describe('createNoteSchema', () => {
  const validUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  const validCases = [
    { name: 'simple note', input: { patientId: validUuid, content: 'Patient reported headache.' } },
    { name: 'long note', input: { patientId: validUuid, content: 'Detailed follow-up notes. '.repeat(50) } },
    { name: 'minimal content', input: { patientId: validUuid, content: 'A' } },
  ];

  const invalidCases = [
    { name: 'empty content', input: { patientId: validUuid, content: '' } },
    { name: 'missing content', input: { patientId: validUuid } },
    { name: 'invalid patient ID', input: { patientId: 'bad', content: 'Note' } },
    { name: 'missing patient ID', input: { content: 'Note' } },
  ];

  for (const { name, input } of validCases) {
    it(`should accept: ${name}`, () => {
      expect(createNoteSchema.safeParse(input).success).toBe(true);
    });
  }

  for (const { name, input } of invalidCases) {
    it(`should reject: ${name}`, () => {
      expect(createNoteSchema.safeParse(input).success).toBe(false);
    });
  }
});

describe('updateNoteSchema', () => {
  const validCases = [
    { name: 'update content', input: { content: 'Updated note text.' } },
    { name: 'minimal content', input: { content: 'X' } },
  ];

  const invalidCases = [
    { name: 'empty content', input: { content: '' } },
    { name: 'missing content', input: {} },
  ];

  for (const { name, input } of validCases) {
    it(`should accept: ${name}`, () => {
      expect(updateNoteSchema.safeParse(input).success).toBe(true);
    });
  }

  for (const { name, input } of invalidCases) {
    it(`should reject: ${name}`, () => {
      expect(updateNoteSchema.safeParse(input).success).toBe(false);
    });
  }
});
