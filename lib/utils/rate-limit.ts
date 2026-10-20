import type { NextRequest } from 'next/server';

type Bucket = { count: number; resetAt: number };

// In-memory fixed-window limiter. Adequate for MVP single-instance deploys;
// swap for Upstash/Redis when scaling horizontally (interface stays identical).
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size > 10_000) pruneExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

function pruneExpired(now: number): void {
  // Map#forEach instead of for..of: deleting the current entry mid-iteration
  // is safe per spec, and this avoids requiring downlevelIteration.
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
}

export function resetRateLimits(): void {
  buckets.clear();
}
