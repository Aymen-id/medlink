Build MediLink — the all-in-one professional OS for independent physicians.

Read claude.md for the full product spec, tech stack, project structure, coding conventions, security requirements, and design preferences. That file is the single source of truth.

## What To Build (MVP v1)

### Private Dashboard (Authenticated)
- Encrypted patient file upload and organization (Supabase Storage + RLS)
- Folder structure, tagging, and full-text search across document names
- Lightweight per-patient appointment note log with timestamps
- Role-based access: owner grants view/edit to receptionist or assistant
- One-click ZIP export of all patient files

### Public Profile Page (Unauthenticated)
- Shareable URL: medilink.io/drname (dynamic route [drname])
- Displays: specialty, credentials, clinic address, consultation hours
- Configurable contact/booking CTAs
- Profile analytics: views, link click-through rates, referral sources

### Auth & Billing
- Supabase Auth (email/password) with signup, login, password reset
- Stripe integration (Free / Pro $29/mo / Clinic $99/mo tiers)
- Annual billing at 20% discount

## Mandatory Execution Protocol

Follow the workflows and rules defined in .agent/ — specifically:


### Phase 1 — Project Scaffolding (after I confirm)
- Initialize Next.js 14 (App Router) with TypeScript in the current directory
- Install and configure: Tailwind CSS, shadcn/ui, Supabase client, Stripe SDK, Zod
- Set up the folder structure exactly as defined in claude.md
- Create .env.local template with all required environment variables
- Configure ESLint, Prettier, and tsconfig.json with strict mode

### Phase 2 — Database & Auth
- Design Supabase schema: users, patients, files, notes, profiles, analytics
- Write RLS policies for every table (patients and files are private to owner + authorized staff)
- Implement Supabase Auth flows: signup, login, logout, password reset
- Create auth middleware for protected routes
- Use TDD workflow (/tdd) — write tests FIRST for all auth logic

### Phase 3 — Dashboard Features
- Patient CRUD with file upload to Supabase Storage
- Folder structure and tagging system
- Full-text search across document names
- Appointment notes log (per-patient, timestamped)
- Role-based access (owner, receptionist, assistant)
- ZIP export of patient files
- Use TDD workflow for every feature

### Phase 4 — Public Profile
- Dynamic route app/(public)/[drname]/page.tsx
- Profile editor in dashboard settings
- Public-facing profile with specialty, credentials, hours, CTAs
- Profile view analytics (track views, clicks, referral sources)
- SEO: meta tags, Open Graph, structured data

### Phase 5 — Billing & Subscription
- Stripe Checkout for Pro and Clinic tiers
- Webhook handler for subscription events
- Feature gating based on tier (free = 10 files, Pro = unlimited)
- Billing portal for managing subscription
- Annual discount logic

### Phase 6 — Polish & Security
- Run /verify full after every phase
- Run security-reviewer agent on all auth/payment/PII code
- Input sanitization on all forms (Zod schemas)
- HIPAA-aware data handling patterns
- Mobile-first responsive design
- Design: deep blue (#1E40AF) primary, clean white, subtle grey accents
- The UI must feel calm, efficient, and professional

## Rules to Follow (from .agent/rules/)

1. **Coding Style** (common-coding-style.md + typescript-coding-style.md):
   - Immutable patterns — never mutate, always spread
   - Files < 800 lines, functions < 50 lines
   - No `any` types — use `unknown` + narrowing
   - Zod for all input validation
   - No console.log in production code

2. **Security** (common-security.md):
   - No hardcoded secrets — environment variables only
   - All user inputs validated
   - SQL injection prevention (parameterized queries via Supabase)
   - XSS prevention
   - CSRF protection
   - Rate limiting on all API endpoints
   - Error messages don't leak sensitive data

3. **Testing** (common-testing.md):
   - TDD mandatory: RED → GREEN → REFACTOR
   - 80% minimum coverage for all code
   - 100% coverage for auth, payment, and security logic
   - Unit + Integration + E2E tests

4. **Patterns** (common-patterns.md):
   - Repository pattern for data access
   - Consistent API response envelope format
   - Search for existing implementations before writing custom code

5. **Performance** (common-performance.md):
   - Avoid last 20% of context window for large tasks
   - Use extended thinking for architectural decisions

## Workflows to Use (from .agent/workflows/)

- `/plan` — Before each phase, create an implementation plan
- `/tdd` — For every feature, write tests FIRST
- `/build-fix` — If any build error occurs, fix incrementally
- `/verify` — After each phase, run full verification (build + types + lint + tests)
- `/orchestrate feature` — For complex features, use the full pipeline:
  planner → tdd-guide → code-reviewer → security-reviewer

## Quality Gates

After each phase, run verification and produce:                                                                 
Do NOT proceed to the next phase until verification passes.
✅ Part 1 — Dashboard Layout & Shell — COMPLETE
Verification Report
Check	Status
TypeCheck (npx tsc --noEmit)	✅ 0 errors
Lint (npm run lint)	✅ 0 warnings/errors
Tests (npx vitest run)	✅ 34/34 passed (7 test files)
Build (npm run build)	✅ Optimized production build
No console.log	✅ Clean
No any types	✅ Clean
Files Created (Part 1)
File	Purpose

Sidebar.tsx
Navigation sidebar — desktop + mobile sheet variant, active states, user info, logout

TopBar.tsx
Sticky header — search input, mobile hamburger, user dropdown menu

DashboardShell.tsx
Client wrapper composing Sidebar + TopBar around page content

layout.tsx
Server layout — fetches user, queries doctor_profile, passes to shell

LoadingState.tsx
Skeleton loaders — base, patient card, file row, and page-level variants

EmptyState.tsx
Empty state component with icon, title, description, and action button

Sidebar.test.tsx
6 tests — nav links, active state, user info, initials, logout

TopBar.test.tsx
4 tests — search input, accessibility, user menu, avatar

DashboardShell.test.tsx
3 tests — children, sidebar nav, search bar

shared-ui.test.tsx
8 tests — EmptyState + all skeleton variants
Design Highlights
Deep blue #1E40AF brand color on active nav items
Backdrop blur on sticky top bar for subtle glassmorphism
Responsive — sidebar collapses to sheet drawer on mobile via shadcn 

Sheet
Defense-in-depth — server layout redirects to /login if no session (middleware already handles this)
## Start Now

start with TDD — tests first for the patient and file repositories.