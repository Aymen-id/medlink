# MediLink

## One-Liner
The all-in-one professional OS for independent physicians — a private records workspace and a public presence page.

---

## What This Project Does
MediLink gives independent physicians two outcomes in one subscription:
1. A **private dashboard** to securely store, organize, and search patient files
2. A **public profile page** (`medilink.io/drname`) that acts as their digital identity and patient acquisition tool

---

## Target Users
- Solo or small-group physicians (1–10 staff)
- Specialties: general practice, dermatology, gynecology, pediatrics, dentistry
- Markets: MENA, Francophone Africa, Southeast Asia
- These doctors currently manage files via USB, WhatsApp, paper, and Google Drive

---

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API routes
- **Database:** Supabase (PostgreSQL + Storage for file uploads)
- **Auth:** Supabase Auth (email/password)
- **Payments:** Stripe (freemium → Pro → Clinic tiers)
- **Deployment:** Vercel

---

## Core Features (MVP v1)

### Private Dashboard (Authenticated)
- Encrypted patient file upload and organization
- Folder structure, tagging, and full-text search across document names
- Lightweight per-patient appointment note log with timestamps
- Role-based access: owner can grant view/edit to receptionist or assistant
- One-click ZIP export of all patient files

### Public Profile Page (Unauthenticated)
- Shareable URL: `medilink.io/drname`
- Displays: specialty, credentials, clinic address, consultation hours
- Configurable contact/booking CTAs
- Profile analytics: views, link click-through rates, referral sources

---

## Business Model
- **Free tier:** public profile + up to 10 patient files
- **Pro ($29/month):** unlimited storage, advanced search, notes, analytics
- **Clinic ($99/month):** multi-seat for up to 8 providers under one admin
- Annual billing at 20% discount

---

## Project Structure
```
medilink/
├── app/
│   ├── (auth)/           # login, signup pages
│   ├── (dashboard)/      # private workspace (protected routes)
│   │   ├── patients/     # patient files and notes
│   │   ├── settings/     # account, billing, team access
│   │   └── analytics/    # profile analytics
│   ├── (public)/
│   │   └── [drname]/     # public profile pages
│   └── api/              # API routes
├── components/
│   ├── ui/               # shadcn/ui base components
│   ├── dashboard/        # dashboard-specific components
│   └── profile/          # public profile components
├── lib/
│   ├── supabase/         # Supabase client and helpers
│   ├── stripe/           # Stripe helpers
│   └── utils/            # shared utilities
└── types/                # TypeScript types
```

---

## Coding Conventions
- Use TypeScript strictly — no `any` types
- All components are functional, no class components
- Use Tailwind CSS for all styling — no inline styles
- Use shadcn/ui for all UI primitives (buttons, modals, forms)
- Use Zod for all input validation
- All API routes must validate input and handle errors properly
- No hardcoded secrets — use environment variables
- No `console.log` in production code
- Write tests for every new feature before implementing

---

## Key Metrics to Track
- Activation rate: user uploads 3+ files within 7 days of signup
- Free-to-Pro conversion: target 8–12% within 60 days of hitting file cap
- MRR growth: target 15–20% MoM
- Monthly net revenue churn: below 3%

---

## Security Requirements
- All patient files must be encrypted at rest (Supabase Storage RLS policies)
- Role-based access control strictly enforced at API level
- No patient data exposed in public routes
- Input sanitization on all user-facing forms
- HIPAA-aware data handling patterns

---

## Design Preferences
- Clean, minimal, professional medical aesthetic
- Primary color: deep blue (#1E40AF) — trustworthy, clinical
- Clean white backgrounds with subtle grey accents
- Mobile-first responsive design
- No unnecessary animations or distractions
- The UI should feel calm and efficient — doctors are busy people

---

## Environment Variables Needed
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## Current Status
The approved MVP gap-closure implementation is in progress. Read `docs/implementation-progress.md` and `plans/approved-mvp-gap-closure.md` before continuing. Preserve the existing branch and user edits; do not claim release readiness from local/mock checks.

## Approved architecture and commands

- Clinic billing accounts cover up to eight separate physician workspaces. Billing administration alone does not grant patient access. Staff require explicit workspace membership.
- `proxy.ts` refreshes sessions. Next.js request APIs and route parameters are asynchronous.
- Upload bytes go directly to private Supabase Storage after a database reservation. Metadata finalization enforces quota. Downloads reauthorize each request; do not mint reusable patient-file bearer URLs.
- Database deletion queues physical object cleanup durably. The authenticated cron endpoint requires CRON_SECRET. See `docs/uploads.md`.
- Stripe billing uses the billing account admin, existing customers/subscriptions, Portal confirmation and atomic event receipts. Use only synthetic records and Stripe test mode for acceptance. See `docs/billing.md`.
- Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and `node node_modules/vitest/vitest.mjs run --maxWorkers=3`. On restricted Windows set TEMP/TMP to the ignored `.tmp` directory.
- Browser acceptance: `npm.cmd run test:e2e`. Supply a dedicated TEST_USER_EMAIL/TEST_USER_PASSWORD in ignored `.env.test`; authentication failures must fail tests. BASE_URL selects the preview, and PLAYWRIGHT_SKIP_WEB_SERVER=1 uses a running build.
- Canonical environment names and callback configuration are documented in `.env.example` and `docs/configuration.md`. Price IDs are server-only STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL, STRIPE_PRICE_CLINIC_MONTHLY and STRIPE_PRICE_CLINIC_ANNUAL; legacy public aliases are transitional only. IP_HASH_SALT and CRON_SECRET require 32+ random characters. Never print credentials.
- Hosted migrations, Storage/encryption, authenticated journeys and Stripe flows must be recorded independently of local PGlite and mocks. Inspect schema/history/policies before deployment; never replay the legacy initial schema against an existing project without reconciliation.
