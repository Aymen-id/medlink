# Approved MediLink implementation progress

Plan: plans/approved-mvp-gap-closure.md, approved in chat on 2026-10-17. Work remains in C:\midlink on mvp-gap-closure, starting HEAD e7ef5633abe1664785569c2081b29f648cb5afe5. The user authorized committing and pushing this implementation checkpoint on 2026-10-18; Git history records the resulting commit. Unrelated local design/editor files are excluded. No application deployment has been made.

## Current usage policy

Check the Codex 300-minute window between bounded tasks and before substantial work. At 10% remaining or less, finish the current bounded task, verify and record progress, then pause. The user explicitly removed the 100% reset requirement: continue or resume whenever a fresh check shows more than 10% remaining. Unknown limits do not authorize substantial new work. Do not spend credits or change account settings.

Usage pause: no. Last recorded live check before committing: 87% used / 13% remaining. The old resume-medilink-after-allowance-reset automation no longer exists according to the app; do not claim it is active or recreate it without a request.

## Current checkpoint

- Tasks 1–15 are implemented. Task 16 has extensive local, browser and service acceptance; the remaining release gates below are still open.
- Final verification: **76 suites / 383 tests pass** after the workspace-label repair and compatible development dependency patches. TypeScript, lint, production build and git diff --check pass. Logs: .tmp/final-unit.log, final-types.log, final-lint.log and final-build.log.
- Browser: all **22 Chromium tests pass on the final rebuilt application**, including complete physician workflows at 1280x800 and 390x844, patient edit/delete, folder creation, file upload/move/tags, note creation/editing, nested search and byte-verified ZIP export. A stale selection recovers via the authorized workspace chooser. Visual inspection found the picker showing a UUID; the failing unit regression was repaired, and both final viewport tests verify the selected physician name is displayed.
- Hosted Auth/REST/Storage: 17 assertions pass, including a direct 5 MiB upload, byte preservation, owner/editor/viewer/unrelated/anonymous boundaries, forged-author denial, immediate revocation, concurrent quota reservations and concurrent eight-seat reservations.
- Stripe: 19 assertions pass against real test-mode API objects/payments and the hosted database. Real Checkout reuse and Portal confirmation sessions were created. Monthly payment, same-subscription annual update, declined payment and cancellation were verified. HTTP webhook delivery used locally signed synthetic replays, including duplicate/out-of-order state and 503/retry after a real billing lease conflict. It does not establish Stripe-origin delivery or completing Checkout/Portal UI confirmation. Test subscriptions were canceled.
- Authentication: 6 browser/service assertions pass using hosted generated one-time tokens: signup/provisioning, recovery/password login, consumed-token failure, invite password setup and explicit viewer acceptance. No Supabase email was sent. The user explicitly deferred actual email delivery and preview-URL selection.
- Analytics/cleanup: 12 assertions pass through the built local HTTP endpoints against hosted services: public profile isolation, asynchronous view recording, separate clicks, SQL aggregates, persistent rate limiting, cron authorization, expired-reservation deletion, physical object removal and queue acknowledgement. Synthetic public profile was unpublished afterward. A random local CRON_SECRET was added without printing it; deployed cron is unverified.
- Provider transfer: 8 assertions pass through the built API and hosted database, verifying canonical state of the synthetic provider's actual Stripe test customer, joining Clinic billing, denying billing-admin patient access, preserving provider ownership, denying provider billing administration, removal and restored personal purchase eligibility. The temporary patient was deleted and personal billing restored. No invitation email was sent.
- Production audit reports zero vulnerabilities. Compatible development patches reduced the full audit to 8 high findings in the braces/micromatch/fast-glob chain used by shadcn/ts-morph and Next ESLint tooling. Suggested root downgrades conflict with the approved framework/tooling; do not apply them blindly. The risk concerns development pattern processing; no production dependency advisory remains.

## Hosted migration state

The custom Supabase MCP is enabled with the exact requested URL/features for pzjmnvgggbocwhzsveuc; CLI inspection and live tools verify it. Do not use the unrelated forms project.

The existing PostgreSQL 17.6 baseline matched the first two local migrations across 66 columns, 27 constraints, 4 triggers, 3 compared functions and all RLS policies. PostgreSQL 18 NOT NULL catalog representation in PGlite was normalized. Initial schema was NOT replayed. Its verified versions were recorded in history; MCP-generated migration versions were aligned to local filenames.

All 11 additive migrations through 20261018172356_api_role_privileges.sql are applied. Hosted history now matches all 13 local files. Before synthetic fixtures, original counts stayed 3 profiles, 1 patient, 0 files; 3 workspaces/memberships were backfilled. The private patient-files bucket is present with a 50 MiB limit.

Hosted default grants included TRUNCATE, which bypasses RLS. Tests were changed to model those defaults, two regressions were observed fail, and the privilege migration now denies authenticated TRUNCATE and anonymous private-table access. Public published-profile reads remain permitted. All 10 database suites / 36 assertions passed after that hardening.

Remaining advisors: three intentionally service-only RLS tables have no client policies; doctor_profiles is intentionally anonymous-readable under its published policy; authenticated schema discovery reflects legitimate RLS-protected API tables. Leaked-password protection is disabled and remains an operational setting to resolve. Function search-path/public-definer warnings were cleared.

## Decisions and rulings

- Preserve this branch and dirty checkout to include user work; do not reset or commit unrelated changes.
- Use Next.js 16 proxy.ts and asynchronous request APIs. Pin ESLint 9.39.5 for plugin compatibility; the earlier ESLint 10 trial was superseded.
- Feature-scoped Zod configuration, canonical origin and server-only secrets/prices are required. Legacy price aliases are transitional; conflicting names fail validation.
- Clinic billing covers eight separate physician workspaces. Billing administration does not grant patient access; staff need explicit memberships and active Clinic coverage.
- Direct Storage uploads require a reservation and finalization; reads reauthorize each request. No reusable patient-file bearer URLs. Legacy issued URLs retain their original TTL.
- Deletion queues survive patient cascades and physical failures. Cleanup is an authenticated daily cron with bounded batches.
- Historical notes remain readable and authors may delete their notes after downgrade; new/edit operations require paid access.
- Synchronous ZIP export is capped at 100 MiB / 500 files with explicit errors and bounded download workers. Larger durable exports are unimplemented and remain a release limitation.
- Keep the existing Stripe API version to preserve the integration. User approved separate USD test products/prices/Portal; originals were unchanged. USD totals: Pro 29/month or 278.40/year, Clinic 99/month or 950.40/year.
- Provider transfer verifies canonical personal billing, expires open Checkout and freezes new purchases before the authenticated RPC. A persisted Clinic downgrade restores additional providers to personal billing; patient ownership stays intact.
- Reuse the existing logo/clinical design; omit unsupported physician-count/trial claims. Promote hidden modal feedback to Important because it can cause duplicate retries; focused failures were repaired.
- Use find-skills and reuse installed official Vercel React and Stripe skills. Domain guidance, TDD and verification skills were applied. The one fresh whole-branch reviewer finished; its Important findings have failing-then-passing fixes. Do not dispatch a second review of the same fixes.

## Remaining work / release gates

1. Final verification is complete and recorded in docs/release-acceptance.md. Do not rerun completed checks without a relevant change or unresolved concern. The built preview currently runs on localhost:3101 for review.
2. Actual signup/invite/recovery email templates, delivery and intended preview URL are deferred by the user. Generated-token success is not SMTP/template evidence.
3. Stripe-origin webhook delivery, completing hosted Checkout/Portal UI confirmation, and persistence-failure retry beyond the verified lease-contention case remain unverified.
4. Application deployment, runtime/memory/large-export measurements, deployed CRON_SECRET/scheduler, trusted IP-header handling, service encryption assurances and operational/compliance configuration remain open. Do not claim production readiness from local/fixture checks.
5. Larger durable exports and the residual development globbing advisory need an explicit release disposition. Do not introduce incompatible framework downgrades.
6. Retain dedicated synthetic test accounts in ignored .tmp/hosted-test-accounts.json and auth-callback-accounts.json for remaining acceptance. .env.test now uses the synthetic owner; its earlier contents are backed up locally. No credentials were printed. Synthetic records must be cleaned or retained deliberately before launch.

## Evidence locations

- Local: .tmp/final-unit.log (76/383), final-types.log, final-lint.log, final-build.log; .tmp/final-audit.json and final-runtime-audit.json.
- Browser: .tmp/final-browser.log (22), .tmp/dashboard-mobile.png, home-desktop.png, home-mobile.png.
- Hosted matrix: .tmp/hosted-acceptance.json and log.
- Stripe: .tmp/stripe-service-acceptance.json and stripe-service-acceptance-final.log; test IDs in its state file.
- Auth: .tmp/auth-callback-acceptance.json and log; screenshots auth-invite-setup.png and auth-recovery-expired.png.
- Analytics/cleanup: .tmp/analytics-cleanup-acceptance.json and analytics-cleanup-acceptance-final.log.
- Provider transfer: .tmp/provider-transfer-acceptance.json and log.
- Review: docs/final-review.md. Architecture: docs/workspace-security.md, uploads.md, billing.md, exports.md, search.md, analytics.md and configuration.md.
