# Phase 2 Implementation Plan: Database & Auth

## Requirements Restatement
In this phase, we are implementing the core data models and authentication flows for MediLink. This covers Steps 2, 3, and 4 from the Blueprint:
1. **Types & Validation (Step 2)**: Defining our TypeScript models, API responses, and Zod schemas for validation.
2. **Database & RLS (Step 3)**: Creating the Supabase PostgreSQL schema with proper Row Level Security (RLS) policies to ensure patient data is strictly isolated to its owner/authorized staff.
3. **Authentication (Step 4)**: Building the Auth UI (Login, Signup, Reset Password) and the underlying Supabase Auth flows, protecting all `(dashboard)` routes with middleware.
4. **TDD approach**: We must write tests for our schemas, Supabase clients, auth repository, and middleware before or alongside the implementation.

## Risk Assessment
- **Data Leakage (RLS)**: If Row Level Security policies are misconfigured, users might access other doctors' patient lists or files.
  *Mitigation*: We will write strict RLS policies bound to `auth.uid()` and explicitly test RLS constraints.
- **Middleware Bypass**: If the Next.js middleware fails to protect `/(dashboard)` routes, unauthenticated access might occur.
  *Mitigation*: Implement robust matcher configuration in `middleware.ts` and write integration tests.
- **Client/Server Auth State Sync**: In Next.js App Router, managing auth state between client and server components can be tricky.
  *Mitigation*: We will use `@supabase/ssr` to ensure secure cookie-based session management across Server and Client components.

## Implementation Steps

### Part 1: Types & Schemas (Blueprint Step 2)
1. Create `types/index.ts` and `types/api.ts` representing our domain models.
2. Create `lib/schemas/` directory with Zod schemas for auth, patients, files, profiles, etc.
3. Write unit tests for the Zod schemas in `lib/schemas/__tests__/`.
4. Define application constants in `lib/constants.ts` (tier limits, app name).

### Part 2: Database Schema & RLS (Blueprint Step 3)
1. Write the initial Supabase migration file `supabase/migrations/001_initial_schema.sql` including all tables and `auth.users` triggers for profile creation.
2. Define strict RLS policies on `patients`, `files`, `notes`, `profiles`, `staff_access`, and `subscriptions`.
3. Set up the Supabase browser and server clients using `@supabase/ssr` in `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `lib/supabase/middleware.ts`.

### Part 3: Authentication Flows (Blueprint Step 4)
1. Create `middleware.ts` to protect dashboard routes and manage session tokens.
2. Create `lib/repositories/auth.repository.ts` to abstract Supabase auth logic.
3. Write tests for the auth repository in `lib/repositories/__tests__/auth.test.ts`.
4. Build the UI pages using Shadcn components:
   - `app/(auth)/layout.tsx`
   - `app/(auth)/login/page.tsx`
   - `app/(auth)/signup/page.tsx`
   - `app/(auth)/reset-password/page.tsx`
5. Run the full verify sequence (`build`, `tsc`, `lint`, `test`) to exit Phase 2.

---

Please **CONFIRM** this plan to begin execution of Phase 2!
