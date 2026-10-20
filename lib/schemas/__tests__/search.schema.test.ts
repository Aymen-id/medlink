import { describe, it, expect } from 'vitest';
import { searchQuerySchema } from '../search.schema';

describe('searchQuerySchema', () => {
  const validCases = [
    { name: 'simple query', input: { q: 'xray' } },
    { name: 'query with spaces', input: { q: 'blood test results' } },
    { name: 'with tags', input: { q: 'scan', tags: ['urgent', 'follow-up'] } },
    { name: 'with pagination', input: { q: 'report', page: 2, limit: 10 } },
    { name: 'max length query', input: { q: 'a'.repeat(100) } },
    { name: 'numeric page/limit strings', input: { q: 'lab', page: '3', limit: '50' } },
  ];

  const invalidCases = [
    { name: 'empty query', input: { q: '' }, error: 'required' },
    { name: 'query too long', input: { q: 'a'.repeat(101) }, error: '100' },
    { name: 'SQL injection (semicolon)', input: { q: 'test; DROP TABLE' }, error: 'invalid' },
    { name: 'SQL injection (quotes)', input: { q: "test' OR 1=1" }, error: 'invalid' },
    { name: 'SQL injection (double quotes)', input: { q: 'test" OR 1=1' }, error: 'invalid' },
    { name: 'SQL injection (backslash)', input: { q: 'test\\inject' }, error: 'invalid' },
    { name: 'SQL injection (percent)', input: { q: 'test%wildcard' }, error: 'invalid' },
    { name: 'missing query', input: {}, error: 'Required' },
    { name: 'page zero', input: { q: 'ok', page: 0 }, error: '' },
    { name: 'limit over max', input: { q: 'ok', limit: 101 }, error: '' },
  ];

  for (const { name, input } of validCases) {
    it(`should accept: ${name}`, () => {
      const result = searchQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  }

  for (const { name, input } of invalidCases) {
    it(`should reject: ${name}`, () => {
      const result = searchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  }

  it('should default page to 1 and limit to 20', () => {
    const result = searchQuerySchema.parse({ q: 'test' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});
