/** Only allow a path on this application, including after URL decoding. */
export function safeRedirectPath(value: string | null | undefined, fallback = '/patients'): string {
  if (!value) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/u.test(decoded)) return fallback;
    const target = new URL(value, 'https://medilink.invalid');
    if (target.origin !== 'https://medilink.invalid') return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
