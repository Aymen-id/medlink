import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, resetRateLimits } from '../rate-limit';

describe('rateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('allows requests up to the limit within the window', () => {
    const results = [0, 1, 2].map(i =>
      rateLimit('ip1:track', 3, 60_000, 1_000_000 + i),
    );
    expect(results.map(r => r.allowed)).toEqual([true, true, true]);
  });

  it('blocks requests beyond the limit and reports retry-after', () => {
    rateLimit('ip1:track', 2, 60_000, 1_000_000);
    rateLimit('ip1:track', 2, 60_000, 1_000_001);
    const blocked = rateLimit('ip1:track', 2, 60_000, 1_000_002);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets once the window elapses', () => {
    rateLimit('ip1:track', 1, 60_000, 1_000_000);
    expect(rateLimit('ip1:track', 1, 60_000, 1_000_001).allowed).toBe(false);
    expect(rateLimit('ip1:track', 1, 60_000, 1_061_000).allowed).toBe(true);
  });

  it('keys independently per key', () => {
    expect(rateLimit('a:x', 1, 60_000, 1_000_000).allowed).toBe(true);
    expect(rateLimit('b:x', 1, 60_000, 1_000_000).allowed).toBe(true);
    expect(rateLimit('a:x', 1, 60_000, 1_000_001).allowed).toBe(false);
  });
});
