/** Serialize structured data for an HTML script text node without allowing HTML parsing. */
export function serializeJsonLd(value: unknown): string {
  const escapes: Record<string, string> = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  };
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/gu, (character) => escapes[character]);
}
