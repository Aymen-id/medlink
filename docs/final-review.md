# Independent branch review and fix record

The single fresh reviewer reviewed the uncommitted tracked and relevant untracked branch without changing files or hosted services. The initial verdict required changes. Three billing/quota defects were reproduced with actual migrations in isolated PGlite; the email finding concerned documented/default setup, not inspected hosted configuration.

## Fix pass

- Free-cap bypass after downgrade: the regression finalized an eleventh file before the fix. Finalization now locks billing before workspace/reservation, rechecks entitlement and counts finalized files. Existing files remain readable and rejected reservations retain cleanup eligibility. The focused regression passed after the repair.
- Personal Checkout/provider transfer race: SQL accepted a transfer while a personal billing lease was active before the fix. Acceptance now locks both accounts consistently and rejects active operations/unresolved external billing. Service preparation verifies canonical Stripe state, expires open Checkout and freezes new purchases durably. Checkout rechecks eligibility before issuing its URL. Focused SQL and orchestration regressions pass; remote payment races remain an acceptance gate.
- Clinic-to-Pro entitlement leakage: an additional provider received Pro access before the fix. A persisted downgrade now returns additional providers to personal billing accounts; entitlement resolution scopes Pro to the administrator's workspace. Focused regression passed after the repair.
- Invite onboarding: the callback previously went straight to Team Access. The regression now verifies invitation OTP followed by password setup and Team Access. The required server-compatible invite template is documented. Hosted template inspection, email delivery and password-login acceptance remain open.
- Ruling: promote the reviewer's minor modal-feedback finding to Important because hidden upload errors violate task 9's visible failure requirement and can prompt duplicate patient-file retries. Both folder and upload regressions failed before the fix; errors now appear inside the active dialog and successful submissions close it. Both focused regressions pass.

Migration: `supabase/migrations/20261018165615_reviewed_transition_guards.sql`, generated with the Supabase CLI. Earlier migrations were preserved. No second reviewer was dispatched; the same interrupted reviewer completed the review.

## Remaining review boundaries

- Stale workspace-cookie redirect behavior was not established as a defect; add authenticated browser coverage for revoked access and changed users.
- Hosted roles/Storage/encryption, actual multi-connection races, real Stripe flows, deployment and mobile/keyboard journeys require separate acceptance evidence.
- The 100 MiB/500-file synchronous export limit is explicit; larger durable exports remain a release limitation.
- Historical note reads and author deletion after downgrade preserve patient-history portability.
- Dependency advisories and operational/compliance settings remain separately tracked release gates.

Whole-suite/build evidence and current completion status are recorded in `implementation-progress.md` and `release-acceptance.md`; this review record alone does not establish production readiness.

## Acceptance follow-through

The final full suite passes 76 suites / 383 tests; TypeScript, lint and production build pass. All 22 browser tests pass, including complete desktop/mobile workflows and a stale selection. The stale-cookie concern was not reproduced as a failure; the authorized chooser works in the observed browser journey.

Hosted privilege inspection revealed default TRUNCATE grants that the earlier test harness masked. Two actual SQL regressions failed, the harness was corrected to model hosted defaults, and the new privilege migration passed all database tests before deployment. API-role TRUNCATE and anonymous private-table SELECT are now absent remotely.

Final mobile visual inspection exposed a raw workspace UUID in the picker. A unit regression failed before the selected-name repair; final browser assertions and screenshot verify the result. This was repaired within acceptance without another reviewer dispatch.

Eight additional service assertions verified provider transfer using the synthetic provider's real Stripe test customer, including canonical billing preparation, Clinic membership, patient isolation, denial of provider billing administration, removal and restored personal purchase eligibility. Other recorded Stripe/API and authentication acceptance remains distinct from actual email delivery, Stripe-origin webhook delivery and deployment evidence.
