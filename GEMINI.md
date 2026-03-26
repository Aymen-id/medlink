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
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui
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
Starting from scratch — MVP v1 build.