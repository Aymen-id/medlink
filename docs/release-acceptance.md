# Release acceptance ledger

This is a reviewable implementation checkpoint, not a production sign-off. The user authorized committing and pushing the implementation on mvp-gap-closure on 2026-10-18; Git history records the checkpoint commit. Unrelated local design/editor files are excluded. No application deployment was performed.

## Completed verification

| Evidence class | Observed result |
| --- | --- |
| Local full unit suite | 76 suites / 383 tests pass after the final UI and dependency changes |
| Static/build checks | TypeScript, ESLint and production build pass; git diff --check passes |
| Built browser acceptance | 22 Chromium tests pass, including the full physician workflow at 1280x800 and 390x844 and stale-workspace recovery |
| Hosted Auth/REST/Storage | 17 assertions pass: direct 5 MiB upload, byte preservation, roles, revocation, reserved Free quota and concurrent provider-seat limits |
| Stripe test-mode API + hosted DB | 19 assertions pass: Checkout reuse, payment, real Portal session, annual change, duplicate/out-of-order replay, retry after contention, declined payment and cancellation |
| Hosted generated-token browser auth | 6 assertions pass: signup, recovery/password login, consumed token and invitation password setup/explicit acceptance; no email sent |
| Local HTTP analytics/cleanup + hosted services | 12 assertions pass: public/private isolation, separate counters, aggregation, rate limit, cron authorization and physical cleanup |
| Provider transfer through built API + real test customer | 8 assertions pass: canonical personal billing check, Clinic joining/removal, patient isolation and restoration of personal purchase eligibility |
| Production dependency audit | 0 vulnerabilities |
| Full dependency audit | 8 high affected development packages remain in one braces/glob dependency chain |

The browser workflow covers patient creation/edit/deletion, folder creation, file upload/move/tags, note creation/editing, nested search and ZIP extraction matching source bytes. The workspace picker displays the physician name rather than a database identifier; unit regression and final desktop/mobile browser assertions cover it.

## Hosted changes and preservation

The scoped Supabase server is enabled with the exact requested project URL and seven features for pzjmnvgggbocwhzsveuc. The unrelated forms project was not used.

The hosted legacy schema/policies matched the first two local migrations. They were recorded in migration history without replaying the initial schema. Eleven additive migrations are applied; all thirteen local/hosted versions match. The patient-files bucket is private, with a 50 MiB limit. Excessive inherited API-role grants were removed, including TRUNCATE and anonymous private-table reads.

A final read-only checkpoint confirmed preservation of the original three profiles and one patient. Synthetic fixtures bring totals to nine profiles, two patients and ten files/objects; the physical cleanup queue is empty. Dedicated synthetic accounts remain in ignored local files for further acceptance. Temporary workflow/cleanup/transfer patients were removed. The synthetic public profile was unpublished. All acceptance-created Stripe subscriptions were canceled; the separate approved USD test products/prices/Portal remain available. Original Stripe objects were unchanged.

## Evidence limits and remaining release gates

- **Email is deferred by user instruction.** Actual signup/invite/recovery templates, delivery and intended preview URL were not verified. Successful generated-token callbacks do not establish email delivery.
- Stripe payment and subscription objects are real test-mode API objects. Webhook HTTP delivery used locally signed synthetic replays against the built application and real hosted database. Stripe-origin webhook delivery, completing Checkout/Portal UI confirmation and a genuine persistence-failure retry remain open; the observed 503/retry case used an actual billing-lease conflict.
- Daily cleanup is configured locally and manual authenticated invocation removed real synthetic Storage objects. Deployment environment variables, CRON_SECRET, the deployed scheduler and hosting runtime/memory measurements remain unverified.
- Synchronous ZIP export explicitly caps input at **100 MiB / 500 files**. Larger durable background exports are not implemented. Local 16 MiB measurements and small hosted-byte browser exports do not establish large hosted runtime limits.
- Remaining development findings are the [braces nested-pattern denial-of-service advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), propagated through micromatch/fast-glob, shadcn/ts-morph and Next ESLint tooling. Lockfile inspection confirms every remaining affected node is development-only. The audit suggests incompatible root downgrades; none were applied.
- Hosted advisors still report [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Service-only tables intentionally have no client row policies. Public profile and authenticated schema discovery reflect deliberate RLS-protected API access; function search-path/public-definer warnings were cleared.
- Trusted proxy IP-header handling, encryption-at-rest assurances, operational backup/compliance settings, and additional large-data/performance and transaction-race scenarios require deployment/service verification. RLS is authorization evidence, not an encryption or HIPAA certification.

## Evidence files

Local logs: .tmp/final-unit.log, final-types.log, final-lint.log, final-build.log and final-browser.log. Audits: .tmp/final-audit.json and final-runtime-audit.json.

Service reports: .tmp/hosted-acceptance.json, stripe-service-acceptance.json, auth-callback-acceptance.json, analytics-cleanup-acceptance.json and provider-transfer-acceptance.json. Logs with matching names retain step results; Stripe's final log is stripe-service-acceptance-final.log and analytics' final log is analytics-cleanup-acceptance-final.log.

Visual evidence: .tmp/dashboard-mobile.png, home-desktop.png, home-mobile.png, auth-invite-setup.png and auth-recovery-expired.png. Credentials/tokens are not included in these reports. The account fixture files and .env.test are ignored and must remain private.

Independent review and fixes: docs/final-review.md. Execution/usage policy: docs/implementation-progress.md. The user removed the full-reset rule: resume whenever more than 10% remains; at <=10%, finish the bounded task, record progress and pause. The earlier heartbeat no longer exists; no replacement was created.

## Status

The functional implementation and the recorded checks are ready for review. The approved plan is not represented as fully release-closed while the gates above remain open. No production readiness, email delivery, Stripe-origin delivery or deployment claim is made.
