# Profile analytics

A view is a row without link_clicked; a click is a row with link_clicked. CTR is click events divided by view events × 100 (zero with no views), rounded to two decimals. Multiple clicks from one visit can produce a rate above 100%; this is an event ratio, not a unique-visitor conversion rate. Daily charts use UTC calendar days. Referral sources count only views and include Direct.

The dashboard uses a SECURITY INVOKER SQL aggregate instead of loading capped raw rows. It requires current workspace membership and a Pro/Clinic billing entitlement. Anonymous users cannot read analytics or insert rows directly. Public visitors submit validated events through /api/analytics/track; SSR views use the same service-only RPC. Event rows are never returned to visitors.

The database atomically permits at most 30 events per salted IP hash per minute across instances and profiles. Expired buckets are pruned in bounded batches. Raw IPs are not stored; referral URLs are reduced to hostname and user agents are truncated. Deploy behind a proxy that overwrites x-forwarded-for; arbitrary client-supplied IP headers are not an identity guarantee. This is basic abuse limiting, not bot detection or unique-person analytics.

Reserved application slugs are rejected by form/API validation and a database constraint. Before applying the migration to existing data, check for reserved-slug conflicts rather than renaming user profiles automatically.

Local SQL/mocks are verified separately from hosted event insertion, RLS, proxy behavior and dashboard journeys. Those service acceptance gates remain open.
