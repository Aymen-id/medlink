# MVP Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five verified gaps between the current MediLink codebase and MVP v1 — unenforced free-tier file cap, missing CTA click tracking, missing staff management API/UI, decorative global search, and absent rate limiting.

**Architecture:** All heavy lifting (repositories, schemas, services) already exists and is tested. Each task is thin, well-tested wiring on top of it: server actions gain a tier check, the public CTA gains a beacon-style POST, two new API route files wrap `StaffRepository`, one new search page composes two existing repository `search()` methods, and a shared in-memory rate limiter gets applied across `app/api/`. No database schema changes are required for any task in this plan.

**Tech Stack:** Next.js 14 App Router (server actions + route handlers), Supabase JS v2, Zod v4, Vitest + React Testing Library, Tailwind CSS, shadcn/ui-style primitives in `components/ui/`.

**Spec:** `CLAUDE.md` (product spec, single source of truth) + `prompt.md` (phases and execution protocol). Audit evidence for every gap claim is recorded in the "Audit Baseline" section below.

## Audit Baseline (verified 2026-08-23)

State of the tree before this plan:

- **Green:** `npx tsc --noEmit` → 0 errors · `npm run lint` → clean · `npx vitest run` → 244/244 passing (22 files) · `npm run build` → succeeds.
- **Uncommitted but complete:** analytics repository + tests, 5 analytics dashboard components, `/api/analytics/*` routes, folder/search/staff schemas + schema tests, export service test. Task 1 lands this.
- **Gap evidence:**
  1. File cap — `TierService.canUploadFile` (`lib/services/tier.service.ts:15`) is never called; `uploadFileAction` (`app/(dashboard)/patients/[id]/actions.ts:49`) uploads with no limit check. `FREE_TIER_FILE_LIMIT = 10` (`lib/constants.ts:6`).
  2. Click tracking — public page records *views* server-side (`app/(public)/[drname]/page.tsx`, `void recordView(supabase, profile.id)`), but `ContactCTA` (`components/profile/ContactCTA.tsx`) renders plain `<a>` tags with no click events. Click-through-rate data will always be zero.
  3. Staff management — `StaffRepository` (`lib/repositories/staff.repository.ts`) is fully implemented (`grantById`, `list`, `update`, `revoke`, `revokeByUserId`) but has zero API routes, zero UI, and `grant(email)` is a deliberate stub awaiting an email→userId resolver (`lib/supabase/admin.ts` service-role client exists unused).
  4. Global search — TopBar input (`components/dashboard/TopBar.tsx:55-61`) submits nothing; `PatientRepository.search(query)` (`lib/repositories/patient.repository.ts:119`, owner-scoped ilike) and `FileRepository.search(query)` (`lib/repositories/file.repository.ts:132`) exist unused. `searchQuerySchema` (`lib/schemas/search.schema.ts`) exists unused.
  5. Rate limiting — no implementation anywhere under `lib/` or `app/`; spec requires it on all API endpoints.

## Global Constraints

From `CLAUDE.md` and `.agent/` rules — apply to every task:

- TypeScript strict — no `any` types (use existing types from `@/types`, `unknown` + narrowing for new shapes)
- Immutable patterns — never mutate, always spread
- Files < 800 lines, functions < 50 lines
- Zod validates every external input
- No `console.log` in production code
- TDD mandatory: RED → GREEN → REFACTOR per unit of behavior
- Repository pattern for data access; consistent `{ data, error }` envelope (`ApiResponse<T>` from `@/types/api`)
- Design: deep blue #1E40AF primary, clean white backgrounds, subtle grey accents, mobile-first, calm and efficient
- Test runner: Vitest, config at `vitest.config.ts` (jsdom, globals on, `@` alias). No `include` restriction — any `*.test.{ts,tsx}` in the repo is picked up. Run a single file by substring filter: `npx vitest run <substring>`.

---

### Task 1: Land in-flight work and repo hygiene

The working tree holds ~15 green, finished files that were never committed, plus stray log files at the repo root. Land them so later tasks diff against a clean base.

**Files:**
- Modify: `.gitignore`
- Commit (already on disk): `app/api/analytics/`, `components/dashboard/{AnalyticsDashboard,AnalyticsOverview,DateRangePicker,ReferralBreakdown,ViewsChart}.tsx`, `lib/repositories/analytics.repository.ts`, `lib/repositories/__tests__/analytics.repository.test.ts`, `lib/schemas/{folder,search,staff}.schema.ts`, `lib/schemas/__tests__/{file,folder,note,search,staff}.schema.test.ts`, `lib/services/__tests__/export.service.test.ts`, modified `app/(dashboard)/analytics/page.tsx`, modified `lib/repositories/__tests__/auth.repository.test.ts`, modified `prompt.md`

**Interfaces:**
- Consumes: nothing
- Produces: clean `git status` (only ignored logs may remain), baseline suite still 244+ green — every later task commits on top of this

- [ ] **Step 1: Ignore local verification logs**

Append to `.gitignore`:

```gitignore
# local verification output
*.log
```

(The root currently contains `tsc-errors.log`, `test-green.log`, `test-phase3-tdd.log`, `test-step9.log`, `coverage-final.log`, `coverage-report.log`, `note-test-err.log`, plus the new `audit-*.log` files — all throwaway verification output.)

- [ ] **Step 2: Verify the suite is still green before committing**

Run: `npx vitest run`
Expected: all tests pass (was 244/244 across 22 files). If anything fails, stop and fix before committing.

- [ ] **Step 3: Commit hygiene change**

```bash
git add .gitignore
git commit -m "chore: ignore local verification logs"
```

- [ ] **Step 4: Commit the landed feature work**

```bash
git add "app/(dashboard)/analytics/page.tsx" app/api/analytics components/dashboard/AnalyticsDashboard.tsx components/dashboard/AnalyticsOverview.tsx components/dashboard/DateRangePicker.tsx components/dashboard/ReferralBreakdown.tsx components/dashboard/ViewsChart.tsx lib/repositories/analytics.repository.ts "lib/repositories/__tests__/analytics.repository.test.ts" lib/repositories/__tests__/auth.repository.test.ts lib/schemas/folder.schema.ts lib/schemas/search.schema.ts lib/schemas/staff.schema.ts lib/schemas/__tests__ lib/services/__tests__/export.service.test.ts prompt.md
git commit -m "feat: profile analytics dashboard, folder/search/staff schemas, expanded repository tests"
```

Run: `git status --short`
Expected: empty (or only `?? *.log` entries now hidden by the ignore rule).

---

### Task 2: Enforce free-tier file cap on upload

Wire the existing, tested `TierService.canUploadFile` into `uploadFileAction` so Free accounts hard-stop at `FREE_TIER_FILE_LIMIT` (10) files per owner. Pro/Clinic have `unlimitedFiles: true` and bypass the check via `TierService`.

**Files:**
- Create: `app/(dashboard)/patients/[id]/__tests__/upload-cap.test.ts`
- Modify: `app/(dashboard)/patients/[id]/actions.ts` (the `uploadFileAction` function, lines 49–73)

**Interfaces:**
- Consumes:
  - `TierService.canUploadFile(tier: SubscriptionTier, currentFileCount: number): boolean` — `lib/services/tier.service.ts:15`
  - `SubscriptionRepository` ctor `(supabase: SupabaseClient, userId: string)`, method `getTier(): Promise<SubscriptionTier>` (defaults `'free'` when no row) — `lib/repositories/subscription.repository.ts:40,63`
  - `FileRepository.countByOwner(): Promise<ApiResponse<number>>` — `lib/repositories/file.repository.ts:246`
  - `getUserContext(): Promise<UserContext | null>` where `UserContext = { userId, email, role, ownerId, permissions?, displayName?, avatarUrl? }` — `lib/supabase/context.ts:4`
- Produces: `uploadFileAction(patientId, folderId, formData)` returns `{ data: null, error: string }` containing `"limit reached"` when the cap blocks an upload. No signature change.

- [ ] **Step 1: Write the failing tests**

Create `app/(dashboard)/patients/[id]/__tests__/upload-cap.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFileAction } from '../actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/supabase/context', () => ({
  getUserContext: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({})),
}));

const countByOwner = vi.fn();
const upload = vi.fn();
vi.mock('@/lib/repositories/file.repository', () => ({
  FileRepository: vi.fn(function FileRepositoryMock() {
    return { countByOwner, upload };
  }),
}));

const getTier = vi.fn();
vi.mock('@/lib/repositories/subscription.repository', () => ({
  SubscriptionRepository: vi.fn(function SubscriptionRepoMock() {
    return { getTier };
  }),
}));

import { getUserContext } from '@/lib/supabase/context';

function makeForm(): FormData {
  const fd = new FormData();
  fd.append('file', new File(['x'], 'chart.pdf', { type: 'application/pdf' }));
  return fd;
}

describe('uploadFileAction tier gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserContext).mockResolvedValue({
      userId: 'user-1',
      email: 'dr@example.com',
      role: 'owner',
      ownerId: 'owner-1',
      permissions: undefined,
    });
    upload.mockResolvedValue({ data: { id: 'file-1' }, error: null });
  });

  it('blocks the upload when a free-tier owner hits the 10-file cap', async () => {
    getTier.mockResolvedValue('free');
    countByOwner.mockResolvedValue({ data: 10, error: null });

    const result = await uploadFileAction('patient-1', null, makeForm());

    expect(result.error).toMatch(/limit reached/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it('allows the upload below the cap', async () => {
    getTier.mockResolvedValue('free');
    countByOwner.mockResolvedValue({ data: 9, error: null });

    const result = await uploadFileAction('patient-1', null, makeForm());

    expect(result.error).toBeNull();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatchObject({
      patientId: 'patient-1',
      folderId: null,
    });
  });

  it('never blocks unlimited tiers regardless of count', async () => {
    getTier.mockResolvedValue('pro');
    countByOwner.mockResolvedValue({ data: 500, error: null });

    const result = await uploadFileAction('patient-1', null, makeForm());

    expect(result.error).toBeNull();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('still denies view-only staff before any cap logic runs', async () => {
    vi.mocked(getUserContext).mockResolvedValue({
      userId: 'user-2',
      email: 'reception@example.com',
      role: 'receptionist',
      ownerId: 'owner-1',
      permissions: 'view',
    });
    getTier.mockResolvedValue('free');
    countByOwner.mockResolvedValue({ data: 3, error: null });

    const result = await uploadFileAction('patient-1', null, makeForm());

    expect(result.error).toMatch(/permission denied/i);
    expect(countByOwner).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run upload-cap`
Expected: FAIL — the first test fails because no limit error is ever returned (action currently uploads unconditionally).

- [ ] **Step 3: Implement the gate in `uploadFileAction`**

In `app/(dashboard)/patients/[id]/actions.ts`, add to the import block:

```typescript
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';
import { TierService } from '@/lib/services/tier.service';
import { FREE_TIER_FILE_LIMIT } from '@/lib/constants';
```

Replace the body of `uploadFileAction` between the permission check and the `repo.upload(...)` call so the function reads:

```typescript
export async function uploadFileAction(patientId: string, folderId: string | null, formData: FormData) {
  const context = await getUserContext();
  if (!context) return { data: null, error: 'Unauthorized' };

  if (context.permissions === 'view') {
    return { data: null, error: 'Permission denied. You can only view files.' };
  }

  const file = formData.get('file') as File;
  if (!file) return { data: null, error: 'File is required' };

  const tagsStr = formData.get('tags') as string;
  const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()) : [];

  const supabase = createClient();
  const repo = new FileRepository(supabase, context.ownerId);

  // Tier gate: Free plan is capped at FREE_TIER_FILE_LIMIT files per owner.
  const subscriptionRepo = new SubscriptionRepository(supabase, context.userId);
  const tier = await subscriptionRepo.getTier();
  const countResult = await repo.countByOwner();
  const currentCount = countResult.data ?? 0;
  if (!TierService.canUploadFile(tier, currentCount)) {
    return {
      data: null,
      error: `File limit reached (${currentCount}/${FREE_TIER_FILE_LIMIT} on Free). Upgrade to Pro for unlimited storage.`,
    };
  }

  const result = await repo.upload({ patientId, folderId, file, tags });

  if (!result.error) {
    revalidatePath(`/patients/${patientId}`);
  }
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run upload-cap`
Expected: PASS — 4/4.

- [ ] **Step 5: Run the full suite and commit**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, 0 type errors.

```bash
git add "app/(dashboard)/patients/[id]/actions.ts" "app/(dashboard)/patients/[id]/__tests__/upload-cap.test.ts"
git commit -m "feat: enforce free-tier 10-file upload cap via TierService"
```

---

### Task 3: Track CTA clicks on the public profile

Public pages already record views server-side. Add click tracking: each CTA fires a `fetch(..., { keepalive: true })` POST to the existing `/api/analytics/track` endpoint (`keepalive` lets the request survive navigation to `tel:` / external links). The endpoint already accepts `{ profileId, type: 'click', linkType }` and calls `AnalyticsRepository.recordClick(linkType)`.

**Files:**
- Modify: `components/profile/ContactCTA.tsx`
- Modify: `components/profile/PublicProfile.tsx` (the `<ContactCTA … />` call at ~line 70)
- Test: `components/profile/__tests__/ContactCTA.test.tsx`

**Interfaces:**
- Consumes: `POST /api/analytics/track` body `{ profileId: string(uuid), type: 'click', linkType: string(max 50) }` — `app/api/analytics/track/route.ts` `trackSchema`.
- Produces: `ContactCTA` props become `{ contactCTA: string | null; bookingCTA: string | null; profileId?: string }`. When `profileId` is present, clicking either CTA sends linkType `'phone' | 'whatsapp' | 'email' | 'link'` (contact) or `'booking'` (booking). Existing exports unchanged.

- [ ] **Step 1: Write the failing tests**

Create `components/profile/__tests__/ContactCTA.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactCTA } from '../ContactCTA';

describe('ContactCTA click tracking', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
  });

  it('sends a phone-click event when the Call button is clicked', () => {
    render(<ContactCTA contactCTA="+212600000000" bookingCTA={null} profileId="prof-1" />);
    fireEvent.click(screen.getByRole('link', { name: /call/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/analytics/track');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body)).toEqual({
      profileId: 'prof-1',
      type: 'click',
      linkType: 'phone',
    });
  });

  it('sends a booking-click event when the booking button is clicked', () => {
    render(
      <ContactCTA
        contactCTA={null}
        bookingCTA="https://calendly.com/dr-sana"
        profileId="prof-1"
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: /book/i }));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      profileId: 'prof-1',
      type: 'click',
      linkType: 'booking',
    });
  });

  it('does not send events without a profileId', () => {
    render(<ContactCTA contactCTA="contact@clinic.ma" bookingCTA={null} />);
    fireEvent.click(screen.getByRole('link', { name: /email/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows network failures so navigation is never affected', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<ContactCTA contactCTA="+212600000000" bookingCTA={null} profileId="prof-1" />);
    expect(() =>
      fireEvent.click(screen.getByRole('link', { name: /call/i })),
    ).not.toThrow();
  });
});
```

Note: the exact accessible label for booking depends on the current markup — read the booking `<a>` in `ContactCTA.tsx` first and match its text in the regex (adjust `/book/i` if the label differs).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run ContactCTA`
Expected: FAIL — `fetch` never called (no tracking implemented); possibly TS error on unknown `profileId` prop.

- [ ] **Step 3: Implement**

In `components/profile/ContactCTA.tsx` — update props type and add the tracker + handlers:

```tsx
type ContactCTAProps = {
  contactCTA: string | null;
  bookingCTA: string | null;
  profileId?: string;
};

function trackClick(profileId: string, linkType: string): void {
  // keepalive so the POST survives navigating away (tel:/external links)
  void fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, type: 'click', linkType }),
    keepalive: true,
  }).catch(() => undefined); // analytics must never break navigation
}
```

Inside the component, guard-and-fire on each anchor:

```tsx
export function ContactCTA({ contactCTA, bookingCTA, profileId }: ContactCTAProps) {
```

On the contact `<a>`: `onClick={() => { if (profileId && contactType) trackClick(profileId, contactType); }}`
On the booking `<a>`: `onClick={() => { if (profileId) trackClick(profileId, 'booking'); }}`

In `components/profile/PublicProfile.tsx` (~line 70), pass the id through:

```tsx
<ContactCTA
  contactCTA={profile.contactCTA}
  bookingCTA={profile.bookingCTA}
  profileId={profile.id}
/>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run ContactCTA && npx vitest run PublicProfile 2>/dev/null || npx vitest run components/profile`
Expected: PASS — new tests green, any existing profile-component tests unaffected.

- [ ] **Step 5: Commit**

```bash
git add components/profile/ContactCTA.tsx components/profile/PublicProfile.tsx components/profile/__tests__/ContactCTA.test.tsx
git commit -m "feat: track CTA clicks on public profile via analytics endpoint"
```

---

### Task 4: Rate limiter utility and API-wide application

Spec requires rate limiting on all API endpoints. Build one small deterministic in-memory sliding-window limiter and apply it to every route handler under `app/api/` except the Stripe webhook (Stripe delivers from shared egress IPs; IP-keyed limits there cause false positives, and webhook authenticity is verified by signature instead).

**Files:**
- Create: `lib/utils/rate-limit.ts`
- Create: `lib/utils/__tests__/rate-limit.test.ts`
- Modify: `app/api/analytics/track/route.ts`, `app/api/profile/check-slug/route.ts`, `app/api/profile/route.ts`, `app/api/billing/checkout/route.ts`, `app/api/billing/portal/route.ts`, `app/api/staff/route.ts` and `app/api/staff/[id]/route.ts` (created in Task 5 — apply there as part of that task)

**Interfaces:**
- Consumes: NextRequest headers
- Produces:
  - `rateLimit(key: string, limit: number, windowMs: number, now?: number): RateLimitResult` where `RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number }`
  - `getClientIp(request: NextRequest): string` — x-forwarded-for → x-real-ip → `'unknown'`
  - `resetRateLimits(): void` — test helper

- [ ] **Step 1: Write the failing tests**

Create `lib/utils/__tests__/rate-limit.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run rate-limit`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/utils/rate-limit.ts`**

```typescript
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
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
}

export function resetRateLimits(): void {
  buckets.clear();
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run rate-limit`
Expected: PASS 4/4.

- [ ] **Step 5: Apply to existing routes**

Add to each route handler below (after imports):

```typescript
import { rateLimit, getClientIp } from '@/lib/utils/rate-limit';
```

Shared block pattern inside each exported handler, as the first statement:

```typescript
const rl = rateLimit(`<route-name>:${getClientIp(request)}`, LIMIT, 60_000);
if (!rl.allowed) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
  );
}
```

Per-route values:

| Route | Key prefix | limit |
|---|---|---|
| `app/api/analytics/track/route.ts` (public!) | `track` | 30 |
| `app/api/profile/check-slug/route.ts` | `slug-check` | 30 |
| `app/api/profile/route.ts` | `profile` | 20 |
| `app/api/billing/checkout/route.ts` | `checkout` | 10 |
| `app/api/billing/portal/route.ts` | `portal` | 10 |

Do NOT add to `app/api/webhooks/stripe/route.ts` — signature verification is its auth; see rationale above.

- [ ] **Step 6: Full verification and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all green.

```bash
git add lib/utils/rate-limit.ts lib/utils/__tests__/rate-limit.test.ts app/api
git commit -m "feat: in-memory rate limiter applied to all API routes except Stripe webhook"
```

---

### Task 5: Staff management API

Expose `StaffRepository` through authenticated, owner-gated JSON routes. Email→userId resolution uses the service-role admin client: try `inviteUserByEmail` first (invites new users — desirable product behavior), fall back to a user-list lookup when the address is already registered. Tier-gate creation via `TierService.canAddTeamMember` (Free/Pro have 0 seats, Clinic 8).

**Files:**
- Create: `lib/supabase/staff-users.ts`
- Create: `lib/supabase/__tests__/staff-users.test.ts`
- Create: `app/api/staff/route.ts` (GET list, POST grant)
- Create: `app/api/staff/[id]/route.ts` (PATCH update, DELETE revoke)
- Modify: both new routes include the Task-4 rate-limit block (keys `staff-read` 60/min, `staff-write` 20/min)

**Interfaces:**
- Consumes:
  - `StaffRepository(supabase, ownerId)` — `grantById(staffUserId, role, permissions)`, `list()`, `update(id, input: UpdateStaffInput)`, `revoke(id)` (`lib/repositories/staff.repository.ts:47-126`)
  - `grantStaffSchema: z.ZodObject<{ email, role: 'receptionist'|'assistant', permissions: 'view'|'edit' }>` — `lib/schemas/staff.schema.ts`
  - `createAdminClient(): SupabaseClient` — `lib/supabase/admin.ts`
  - `getUserContext()` — routes must require `context.role === 'owner'` (`lib/supabase/context.ts:4-13`)
  - `TierService.canAddTeamMember(tier, currentTeamSize): boolean`
- Produces:
  - `resolveStaffUserIdByEmail(email: string): Promise<{ id: string | null; error: string | null }>`
  - REST surface consumed by Task 6's UI: `GET /api/staff` → `200 {data: StaffAccess[]}` · `POST /api/staff` body = grantStaffSchema · `PATCH /api/staff/:id` body = grantStaffSchema.partial() · `DELETE /api/staff/:id`. Errors: `400` invalid input, `403` non-owner / seat-cap, `404` not found, `429` rate-limited, `500` upstream.

- [ ] **Step 1: Write the failing resolver tests**

Create `lib/supabase/__tests__/staff-users.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const inviteUserByEmail = vi.fn();
const listUsers = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { inviteUserByEmail, listUsers } },
  })),
}));

import { resolveStaffUserIdByEmail } from '../staff-users';

describe('resolveStaffUserIdByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the invited user id when invite succeeds', async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: { id: 'new-user-1' } },
      error: null,
    });

    const result = await resolveStaffUserIdByEmail('new@clinic.ma');

    expect(result).toEqual({ id: 'new-user-1', error: null });
  });

  it('falls back to listing users when the email is already registered', async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });
    listUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'u-other', email: 'someone@else.ma' },
          { id: 'u-match', email: 'Existing@Clinic.ma' },
        ],
      },
      error: null,
    });

    const result = await resolveStaffUserIdByEmail('existing@clinic.ma');

    expect(result).toEqual({ id: 'u-match', error: null });
  });

  it('errors when registered-but-unlisted', async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });
    listUsers.mockResolvedValue({ data: { users: [] }, error: null });

    const result = await resolveStaffUserIdByEmail('ghost@clinic.ma');

    expect(result.id).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('propagates unrelated admin errors', async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: 'SMTP unavailable' },
    });

    const result = await resolveStaffUserIdByEmail('x@y.z');

    expect(result).toEqual({ id: null, error: 'SMTP unavailable' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run staff-users`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/supabase/staff-users.ts`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Resolves a staff member's auth user id from their email using the
 * service-role admin client. Invites brand-new addresses (they receive a
 * signup email); falls back to a directory lookup for existing accounts.
 */
export async function resolveStaffUserIdByEmail(
  email: string,
): Promise<{ id: string | null; error: string | null }> {
  const admin = createAdminClient();

  const invited = await admin.auth.admin.inviteUserByEmail(email);
  if (invited.data?.user) return { id: invited.data.user.id, error: null };

  const message = invited.error?.message ?? '';
  if (/already|exist|registered/i.test(message)) {
    const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
    const match = listed.data?.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return { id: match.id, error: null };
    return { id: null, error: 'No MediLink account found for that email' };
  }

  return { id: null, error: invited.error?.message ?? 'Failed to resolve staff user' };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run staff-users`
Expected: PASS 4/4.

- [ ] **Step 5: Create `app/api/staff/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/lib/repositories/staff.repository';
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';
import { TierService } from '@/lib/services/tier.service';
import { grantStaffSchema } from '@/lib/schemas/staff.schema';
import { resolveStaffUserIdByEmail } from '@/lib/supabase/staff-users';
import { rateLimit, getClientIp } from '@/lib/utils/rate-limit';

async function requireOwner() {
  const context = await getUserContext();
  if (!context || context.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return context;
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(`staff-read:${getClientIp(request)}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const context = await requireOwner();
  if (context instanceof NextResponse) return context;

  const supabase = createClient();
  const repo = new StaffRepository(supabase, context.ownerId);
  const result = await repo.list();
  return NextResponse.json(result, { status: result.error ? 500 : 200 });
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(`staff-write:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const context = await requireOwner();
  if (context instanceof NextResponse) return context;

  const body = await request.json().catch(() => null);
  const parsed = grantStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = createClient();
  const staffRepo = new StaffRepository(supabase, context.ownerId);

  // Seat cap comes from the plan: Free/Pro 0 seats, Clinic 8.
  const tier = await new SubscriptionRepository(supabase, context.userId).getTier();
  const listed = await staffRepo.list();
  const currentSize = listed.data?.length ?? 0;
  if (!TierService.canAddTeamMember(tier, currentSize)) {
    return NextResponse.json(
      { error: 'Your plan does not include team seats. Upgrade to Clinic.' },
      { status: 403 },
    );
  }

  const resolved = await resolveStaffUserIdByEmail(parsed.data.email);
  if (!resolved.id) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const result = await staffRepo.grantById(
    resolved.id,
    parsed.data.role,
    parsed.data.permissions,
  );
  return NextResponse.json(result, { status: result.error ? 400 : 201 });
}
```

- [ ] **Step 6: Create `app/api/staff/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/lib/repositories/staff.repository';
import { grantStaffSchema } from '@/lib/schemas/staff.schema';
import { rateLimit, getClientIp } from '@/lib/utils/rate-limit';

type RouteContext = { params: { id: string } };

async function ownerAndRepo() {
  const context = await getUserContext();
  if (!context || context.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const supabase = createClient();
  return { repo: new StaffRepository(supabase, context.ownerId) };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const rl = rateLimit(`staff-write:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const { repo, response } = await ownerAndRepo();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = grantStaffSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const result = await repo.update(params.id, parsed.data);
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const rl = rateLimit(`staff-write:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const { repo, response } = await ownerAndRepo();
  if (response) return response;

  const result = await repo.revoke(params.id);
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
```

Before finalizing Step 5–6: open `lib/repositories/staff.repository.ts:103` and confirm `update(id, input)` matches `UpdateStaffInput` usage shown here; adjust call shape if the signature differs.

- [ ] **Step 7: Typecheck, full suite, commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: green.

```bash
git add lib/supabase/staff-users.ts lib/supabase/__tests__/staff-users.test.ts app/api/staff
git commit -m "feat: owner-gated staff management API with seat caps and email resolution"
```

---

### Task 6: Team settings UI

Build the owner-facing team screen consuming Task 5's API, and replace the placeholder settings hub (`app/(dashboard)/settings/page.tsx` currently renders `<div>Settings</div>`) with real navigation cards.

**Files:**
- Create: `components/dashboard/TeamManager.tsx`
- Create: `components/dashboard/__tests__/TeamManager.test.tsx`
- Modify: replace contents of `app/(dashboard)/settings/page.tsx`
- Create: `app/(dashboard)/settings/team/page.tsx`
- Known limitation (documented, not silently dropped): `StaffAccess` carries no email field, so listed rows display a truncated member id. Adding a `staff_email` column requires a Supabase migration — out of scope here; note it for the next schema pass.

**Interfaces:**
- Consumes: Task 5 REST surface (`GET/POST /api/staff`, `PATCH/DELETE /api/staff/:id`); `StaffAccess = { id, ownerId, staffUserId, role, permissions, grantedAt }` (`lib/types` via `mapRowToStaffAccess`).
- Produces: `TeamManager({ initialStaff }: { initialStaff: StaffAccess[] })` client component; route `/settings/team` reachable from `/settings`.

- [ ] **Step 1: Write the failing tests**

Create `components/dashboard/__tests__/TeamManager.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamManager } from '../TeamManager';
import type { StaffAccess } from '@/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: push, push: vi.fn() }),
}));

const fetchMock = vi.fn();
const row = (over: Partial<StaffAccess>): StaffAccess => ({
  id: 'sa-1',
  ownerId: 'owner-1',
  staffUserId: 'user-abc12345',
  role: 'receptionist',
  permissions: 'view',
  grantedAt: '2026-08-01T00:00:00Z',
  ...over,
});

describe('TeamManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: null, error: null }),
    });
  });

  it('lists existing members with role and permission', () => {
    render(<TeamManager initialStaff={[row({})]} />);
    expect(screen.getByText(/user-abc12345/i)).toBeInTheDocument();
    expect(screen.getByText(/receptionist/i)).toBeInTheDocument();
    expect(screen.getByText(/view/i)).toBeInTheDocument();
  });

  it('submits an invite with the form values', async () => {
    render(<TeamManager initialStaff={[]} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'nurse@clinic.ma' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^invite$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/staff');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      email: 'nurse@clinic.ma',
      role: 'receptionist',
      permissions: 'view',
    });
  });

  it('surfaces API errors instead of failing silently', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Your plan does not include team seats.' }),
    });
    render(<TeamManager initialStaff={[]} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'nurse@clinic.ma' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^invite$/i }));

    expect(await screen.findByText(/team seats/i)).toBeInTheDocument();
  });

  it('revokes after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TeamManager initialStaff={[row({ id: 'sa-9' })]} />);

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/staff/sa-9');
      expect(init.method).toBe('DELETE');
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run TeamManager`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `components/dashboard/TeamManager.tsx`**

Uses plain native `<select>` elements styled with Tailwind (the project's shadcn wrappers sit on `@base-ui/react` with a non-standard API; native selects keep this file compile-safe and match the calm aesthetic — swapping to styled primitives later is cosmetic).

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffAccess } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TeamManagerProps = { initialStaff: StaffAccess[] };

async function callApi(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, error: json.error };
}

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function TeamManager({ initialStaff }: TeamManagerProps) {
  const router = useRouter();
  const [members] = useState<StaffAccess[]>(initialStaff);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'receptionist' | 'assistant'>('receptionist');
  const [permissions, setPermissions] = useState<'view' | 'edit'>('view');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await callApi('POST', '/api/staff', { email, role, permissions });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Invite failed');
      return;
    }
    setEmail('');
    router.refresh();
  }

  async function handleRevoke(member: StaffAccess) {
    if (!window.confirm('Remove this team member\'s access?')) return;
    setError(null);
    const result = await callApi('DELETE', `/api/staff/${member.id}`);
    if (!result.ok) {
      setError(result.error ?? 'Removal failed');
      return;
    }
    router.refresh();
  }

  async function handleUpdate(member: StaffAccess, patch: Partial<StaffAccess>) {
    setError(null);
    const result = await callApi('PATCH', `/api/staff/${member.id}`, patch);
    if (!result.ok) {
      setError(result.error ?? 'Update failed');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label htmlFor="staff-email" className="block text-sm font-medium mb-1">
            Invite by email
          </label>
          <input
            id="staff-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="reception@clinic.ma"
          />
        </div>
        <div>
          <label htmlFor="staff-role" className="block text-sm font-medium mb-1">Role</label>
          <select id="staff-role" value={role} onChange={e => setRole(e.target.value as 'receptionist' | 'assistant')} className={selectClass}>
            <option value="receptionist">Receptionist</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
        <div>
          <label htmlFor="staff-permissions" className="block text-sm font-medium mb-1">Access</label>
          <select id="staff-permissions" value={permissions} onChange={e => setPermissions(e.target.value as 'view' | 'edit')} className={selectClass}>
            <option value="view">View only</option>
            <option value="edit">Can edit</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>Invite</Button>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}

      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {members.map(member => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              {/* TODO(schema pass): show real email once staff_access carries it */}
              <p className="text-sm font-medium truncate" title={member.staffUserId}>
                Member {member.staffUserId.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {member.role} · {member.permissions} · since{' '}
                {new Date(member.grantedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label={`Change access for ${member.staffUserId.slice(0, 8)}`}
                value={member.permissions}
                onChange={e => handleUpdate(member, { permissions: e.target.value as 'view' | 'edit' })}
                className={selectClass}
              >
                <option value="view">View only</option>
                <option value="edit">Can edit</option>
              </select>
              <button
                type="button"
                onClick={() => handleRevoke(member)}
                className={cn(buttonVariants({ variant: 'outline' }), 'text-red-600 hover:text-red-700')}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
        {members.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No team members yet. Invite your receptionist above.
          </li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run TeamManager && npx tsc --noEmit`
Expected: PASS 4/4, 0 type errors. (If the `Button`/`buttonVariants` import path differs from `components/ui/button`, match what other dashboard components import.)

- [ ] **Step 5: Create the team page**

Create `app/(dashboard)/settings/team/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/lib/repositories/staff.repository';
import { TeamManager } from '@/components/dashboard/TeamManager';

export const metadata = {
  title: 'Team Access | MediLink',
  description: 'Grant view or edit access to your receptionist or assistant.',
};

export default async function TeamPage() {
  const context = await getUserContext();
  if (!context) redirect('/login');
  if (context.role !== 'owner') redirect('/patients');

  const supabase = createClient();
  const { data: staff } = await new StaffRepository(supabase, context.ownerId).list();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-2xl font-semibold mb-1">Team Access</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Clinic plan seats (max 8). Staff sign in with their own account and see
        only your patients.
      </p>
      <TeamManager initialStaff={staff ?? []} />
    </div>
  );
}
```

- [ ] **Step 6: Replace the settings hub stub**

Overwrite `app/(dashboard)/settings/page.tsx` entirely:

```tsx
import Link from 'next/link';

export const metadata = {
  title: 'Settings | MediLink',
};

const sections = [
  {
    href: '/settings/profile',
    title: 'Public Profile',
    description: 'Your medilink.io/drname page — specialty, credentials, hours, contact buttons.',
  },
  {
    href: '/settings/team',
    title: 'Team Access',
    description: 'Grant view or edit access to receptionists and assistants (Clinic plan).',
  },
  {
    href: '/settings/billing',
    title: 'Billing & Plan',
    description: 'Manage your Free / Pro / Clinic subscription and invoices.',
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(section => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <h2 className="font-medium text-foreground group-hover:text-primary">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Full verification and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: green.

```bash
git add components/dashboard/TeamManager.tsx components/dashboard/__tests__/TeamManager.test.tsx "app/(dashboard)/settings/page.tsx" "app/(dashboard)/settings/team/page.tsx"
git commit -m "feat: team access management UI and settings hub"
```

---

### Task 7: Wire global search end-to-end

Turn the decorative TopBar input into working search across patient names and document names, reusing the owner-scoped `search()` methods and `searchQuerySchema`.

**Files:**
- Modify: `components/dashboard/TopBar.tsx` (search input block, ~lines 50–62)
- Modify: `components/dashboard/__tests__/TopBar.test.tsx` (add submit-navigation test)
- Create: `app/(dashboard)/search/page.tsx`
- Create: `components/dashboard/SearchResults.tsx`
- Test: `components/dashboard/__tests__/SearchResults.test.tsx`

**Interfaces:**
- Consumes:
  - `PatientRepository(supabase, ownerId).search(query: string): Promise<ApiResponse<Patient[]>>` — `lib/repositories/patient.repository.ts:119`
  - `FileRepository(supabase, ownerId).search(query: string): Promise<ApiResponse<PatientFile[]>>` — `lib/repositories/file.repository.ts:132`
  - `searchQuerySchema` (`q`: 1–100 chars, rejects `; ' " \ %`) — `lib/schemas/search.schema.ts`
  - `EmptyState` — `components/ui/EmptyState.tsx` (check its prop names before use and match them in SearchResults)
- Produces: route `/search?q=<term>` rendering grouped patient/file results; `SearchResults({ query, patients, files })` presentational component.

- [ ] **Step 1: Write the failing SearchResults test**

Create `components/dashboard/__tests__/SearchResults.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchResults } from '../SearchResults';
import type { Patient, PatientFile } from '@/types';

const patients = [
  { id: 'p-1', firstName: 'Amina', lastName: 'Bennani' },
  { id: 'p-2', firstName: 'Youssef', lastName: 'Alaoui' },
] as unknown as Patient[];

const files = [
  { id: 'f-1', fileName: 'bloodwork.pdf', patientId: 'p-1' },
] as unknown as PatientFile[];

describe('SearchResults', () => {
  it('renders grouped patients and files with links', () => {
    render(<SearchResults query="ben" patients={patients} files={files} />);

    expect(screen.getByText(/2 patients/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /amina bennani/i })[0]).toHaveAttribute(
      'href',
      '/patients/p-1',
    );
    expect(screen.getByText(/bloodwork\.pdf/i)).toBeInTheDocument();
  });

  it('shows the empty state when nothing matched', () => {
    render(<SearchResults query="zzz" patients={[]} files={[]} />);
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });
});
```

Adjust the fixture casts to the real `Patient` / `PatientFile` fields from `types/index.ts` — read those types first and populate whatever fields the component renders (the casts above intentionally silence extra-field mismatches in fixtures).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run SearchResults`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `components/dashboard/SearchResults.tsx`**

```tsx
import Link from 'next/link';
import type { Patient, PatientFile } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';

type SearchResultsProps = {
  query: string;
  patients: Patient[];
  files: PatientFile[];
};

export function SearchResults({ query, patients, files }: SearchResultsProps) {
  if (patients.length === 0 && files.length === 0) {
    return (
      <EmptyState
        icon={undefined}
        title="No results"
        description={`Nothing matched “${query}”. Try a different term.`}
      />
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {patients.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Patients ({patients.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {patients.map(p => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="block px-4 py-3 text-sm hover:bg-accent/40"
                >
                  {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {files.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Documents ({files.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {files.map(f => (
              <li key={f.id}>
                <Link
                  href={`/patients/${f.patientId}`}
                  className="block px-4 py-3 text-sm hover:bg-accent/40"
                >
                  {f.fileName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

Open `types/index.ts` and align field names (`firstName`/`lastName`, `fileName`, `patientId`) with the actual `Patient` / `PatientFile` definitions before running; also open `components/ui/EmptyState.tsx` and match its real props (it takes `icon`, `title`, `description` per Phase-1 notes — adjust if it differs).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run SearchResults`
Expected: PASS 2/2 (after fixture/type alignment).

- [ ] **Step 5: Add the TopBar navigation test**

The file already mocks routing with a captured spy and defines this fixture at top level:

```tsx
const mockPush = vi.fn()
// ...
vi.mock("next/navigation", () => ({
  usePathname: () => "/patients",
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))
// ...
const mockUser: SidebarUser = {
  displayName: "Dr. Ali Hassan",
  email: "ali@medclinic.com",
  avatarUrl: null,
}
```

Add `fireEvent` to the existing `@testing-library/react` import, then append inside the `describe`:

```tsx
it("navigates to /search with the query on submit", () => {
  render(<TopBar user={mockUser} />)

  const searchInput = screen.getByLabelText("Search patients and files")
  fireEvent.change(searchInput, { target: { value: "bloodwork" } })
  fireEvent.submit(searchInput.closest("form")!)

  expect(mockPush).toHaveBeenCalledWith("/search?q=bloodwork")
})
```

(The assertion targets `mockPush` because that is the exact spy the file's `vi.mock("next/navigation")` factory closes over.)

- [ ] **Step 6: Make the TopBar form functional**

In `components/dashboard/TopBar.tsx`, wrap the existing search input's `<div>` in a form and handle submit (router is already imported — it powers logout):

```tsx
<form
  onSubmit={e => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q');
    if (typeof q === 'string' && q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }}
  className="relative w-full max-w-xs sm:max-w-sm"
>
  {/* existing icon + Input move inside, with name="q" added */}
  <Input name="q" placeholder="Search patients, files..." className="pl-9 h-8 bg-muted/50 border-0 focus-visible:ring-1" aria-label="Search patients and files" />
</form>
```

Keep the existing search-icon `<div>` overlay positioning intact; only add `name="q"` to the input and the wrapping `<form>`.

- [ ] **Step 7: Run TopBar tests**

Run: `npx vitest run TopBar`
Expected: PASS — previous tests plus the new navigation test.

- [ ] **Step 8: Create the search page**

Create `app/(dashboard)/search/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { PatientRepository } from '@/lib/repositories/patient.repository';
import { FileRepository } from '@/lib/repositories/file.repository';
import { searchQuerySchema } from '@/lib/schemas/search.schema';
import { SearchResults } from '@/components/dashboard/SearchResults';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata = {
  title: 'Search | MediLink',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const parsed = searchQuerySchema.safeParse({ q: searchParams.q ?? '' });
  if (!parsed.success) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <EmptyState
          icon={undefined}
          title="Invalid search"
          description="Use 1–100 characters; ; ' \" \\ % are not allowed."
        />
      </div>
    );
  }

  const supabase = createClient();
  const patientRepo = new PatientRepository(supabase, context.ownerId);
  const fileRepo = new FileRepository(supabase, context.ownerId);

  const [{ data: patients }, { data: files }] = await Promise.all([
    patientRepo.search(parsed.data.q),
    fileRepo.search(parsed.data.q),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-xl font-semibold mb-1">
        Results for “{parsed.data.q}”
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Patient names and document names you own.
      </p>
      <SearchResults query={parsed.data.q} patients={patients ?? []} files={files ?? []} />
    </div>
  );
}
```

Note: `file.repository.search()` scopes by `owner_id` like the patient variant — confirm while implementing (read `lib/repositories/file.repository.ts:132-145`); if it is not owner-scoped, stop and fix the repository first with a test asserting scoping.

- [ ] **Step 9: Full verification and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all green — this is the phase-close quality gate.

```bash
git add components/dashboard/TopBar.tsx components/dashboard/__tests__/TopBar.test.tsx components/dashboard/SearchResults.tsx components/dashboard/__tests__/SearchResults.test.tsx "app/(dashboard)/search/page.tsx"
git commit -m "feat: global search across patient and document names"
```

---

## Out of scope (recorded follow-ups)

- `staff_email` column migration so the team UI shows real emails (Task 6 limitation)
- Redis/Upstash-backed rate limiting for multi-instance deploys (Task 4 interface is drop-in compatible)
- E2E Playwright coverage for the staff-invite happy path (`npm run test:e2e` harness already exists)
