import { expect, it } from 'vitest';
import { safeRedirectPath } from '../redirect';

it('accepts local destinations and rejects external, encoded and backslash redirects', () => {
  expect(safeRedirectPath('/search?q=report')).toBe('/search?q=report');
  for (const value of [null, 'https://evil.example', '//evil.example', '/\\evil.example', '/%5cevil.example', '/%2f%2fevil.example', '/\n/evil.example']) {
    expect(safeRedirectPath(value)).toBe('/patients');
  }
});
