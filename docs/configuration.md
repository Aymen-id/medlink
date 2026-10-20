# Application configuration

Copy `.env.example` to `.env.local` and fill it from the intended service environment. Never commit credentials. Validation is lazy per feature so a missing billing setting reports an actionable error when billing is used, without preventing unrelated public/auth pages from building.

`NEXT_PUBLIC_APP_URL` is the canonical HTTP(S) origin with no credentials, path, query or fragment. Set it for local development and every hosted environment. Billing return URLs and authentication callbacks must use this origin. Production uses HTTPS. Supabase Auth Site URL and allowed redirect URLs must include the matching `/auth/callback` endpoint. Configure recovery email templates as documented in the auth implementation.

Configure all four `STRIPE_PRICE_*` IDs in server environment variables. Existing `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID`, `NEXT_PUBLIC_STRIPE_CLINIC_PRICE_ID`, and `NEXT_PUBLIC_STRIPE_CLINIC_ANNUAL_PRICE_ID` values remain accepted as migration aliases. Conflicting canonical and legacy values fail validation. Price IDs are public identifiers, but new code resolves billing prices in a server-only module. Display-only tier names remain safe to import in client components.

Set `IP_HASH_SALT` to at least 32 randomly generated characters. Keep it stable across instances and deployments. Changing it changes visitor hashes. No fallback salt should be used in production. This setting is validated separately from billing and admin credentials.

`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `IP_HASH_SALT` are server-only. Never prefix these with `NEXT_PUBLIC_`. The server config module imports `server-only`, so Next.js rejects importing it through a client component. Validation errors list setting names without echoing their values.

## Authentication redirects and email templates

Allow `${NEXT_PUBLIC_APP_URL}/auth/callback` and `${NEXT_PUBLIC_APP_URL}/auth/callback?next=%2Freset-password%2Fupdate` in Supabase Auth redirect settings. Signup uses the first destination; recovery uses the second and then opens the authenticated update form. PKCE exchanges require the browser that initiated the request because it holds the verifier cookie.

For recovery links that work across browsers/devices, configure the Supabase recovery email template to point at `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`. For signup confirmation, use `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`. Site URL must equal the configured application origin. The callback verifies the one-time token on the server and does not echo tokens or raw service errors in its redirect.

For **Invite user**, configure the link as `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite`. The callback opens password setup and then links to Team Access to accept the pending workspace invitation. This is necessary for new users to set a password for future email/password login. The default `ConfirmationURL` flow can return tokens in a URL fragment, which a server endpoint cannot read; follow [Supabase's server endpoint email guidance](https://supabase.com/docs/guides/auth/auth-email-templates#redirecting-the-user-to-a-server-side-endpoint). Allow the invitation redirect `${NEXT_PUBLIC_APP_URL}/auth/callback?next=%2Fsettings%2Fteam` as well. Inspect and configure the hosted template separately, and verify delivery with a new synthetic recipient; local callback tests do not establish email delivery or hosted configuration.

Expired/invalid recovery links show a request-new-link state. Password updates require a freshly verified authenticated user on the server, validate confirmation with Zod, and retain server-side validation even if browser validation is bypassed. Redirect destinations are restricted to local paths; callback redirects use the configured origin instead of the request Host header.
