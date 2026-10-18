# Workspace and Storage model

Each physician profile has one private workspace. Its UUID deliberately equals the existing profile/owner UUID: legacy `patients.owner_id` references keep their meaning and data is not moved. A billing account groups physician workspaces for a subscription. Billing administration grants no patient membership.

Explicit `workspace_memberships` determines record access. Owners and editors may mutate workspace records; viewers can only read. The selected workspace cookie is only a preference: every request verifies Auth and loads authorized memberships, and a cookie for an unauthorized workspace is rejected. A personal physician profile never hides an invited membership.

Database RLS protects patients, folders, file metadata and notes independently of UI/API checks. Update checks apply to both old and new row scope. Database triggers keep patient/workspace identity and note authors immutable, reject cross-patient folder references, and prevent folder cycles. Editors can create and edit their own notes; viewers cannot mutate notes. Paid-plan checks are added with the notes entitlement task.

The `patient-files` bucket is private with a 50 MiB object limit. Paths start with `workspace_id/patient_id/`. Database policies check real patient ownership and current membership. The upload reservation migration restricts new objects to active owned reservations and disables direct authenticated Storage reads, which would otherwise allow reusable bearer URLs. The application verifies current membership through the user's RLS-protected metadata query before elevated Storage reads or cleanup. No overwrite policy is granted; objects without finalized metadata remain inaccessible through the application.

RLS lookup functions live in the non-exposed `private` schema, pin an empty search path, derive identity from `auth.uid()`, and revoke default PUBLIC execution. Legacy public definer helpers are no longer callable by application roles. Public profile metadata remains separate from patient tables.

Tests execute the SQL on embedded PostgreSQL with synthetic data and Auth/Storage schema shims. They verify actual database policy execution, not the hosted Auth gateway, Storage service, service grants, key configuration, or provider encryption. Run the same role matrix against the intended Supabase environment before release. RLS provides authorization; encryption at rest is a separate service property requiring separate evidence.

Apply migrations only after checking target identity, existing migration history, backups and legacy constraints. The profile identity validation deliberately fails if an existing profile's id/user_id disagree, rather than rewriting ownership automatically.

## Clinic invitations

Provider and staff invitations expire after seven days and require acceptance by their confirmed recipient email. Only a workspace owner can invite staff to that workspace. Only the billing admin can reserve a provider seat. Creating/accepting/revoking provider invitations locks the billing account, and pending unexpired provider invitations count toward the eight-workspace limit. Billing administration still creates no patient membership.

Accepting a provider invitation moves only that physician's billing-account association. Existing patient ownership is retained. A physician with an existing paid subscription must resolve it before joining another Clinic. Removing a provider returns their workspace to their original personal billing account and preserves their patient ownership. Staff access requires an active Clinic entitlement and explicit membership; permission edits/revocations synchronize legacy staff rows with membership in the same database transaction.

The embedded PostgreSQL runtime uses a single connection. Tests cover queued seat reservations and policy behavior, but a true two-connection contention test remains required on the intended Supabase/Postgres instance. Auth invitation email delivery also requires hosted verification.
