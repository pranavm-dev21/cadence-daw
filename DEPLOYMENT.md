# Optional cloud deployment

Status: implementation and local tests exist; no hosted Supabase or Stripe environment has been activated.

## Configure a staging environment first

1. Create a dedicated Supabase project. Apply `supabase/migrations/202609150001_cloud.sql` using the project's SQL migration tooling. It creates owner-scoped projects, subscription state, version history, service-only write functions and a private `project-audio` bucket.
2. Enable email/password authentication and email confirmation. Configure the site's exact HTTPS URL and allowed auth redirects in Supabase. Configure password protections and production email delivery before inviting users.
3. Copy `.env.example` to `.env`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's public connection values. Set the server's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` separately. Never expose the service key through a `VITE_` variable or frontend hosting configuration.
4. In Stripe test mode, create the intended recurring price and configure the customer portal. Set server-only `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET`. Configure the webhook endpoint `/api/billing/webhook` for `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. The endpoint verifies the raw-body signature and retrieves current subscription state before applying entitlement updates.
5. Set `SITE_ORIGIN` to the exact HTTPS origin with no trailing slash. Run `npm run server`. `/api/health` reports configured components; it is a configuration check, not a connectivity test.
6. Build with `npm run build` after public browser settings are present. Serve only `dist` over HTTPS, with SPA fallback, and reverse-proxy same-origin `/api` requests to the loopback API. Keep raw webhook bodies intact. API requests are capped at 64 MB for bundles; use consistent proxy limits. Do not expose `.env`, sources, tests or service credentials.

The API binds loopback by default. Configure the reverse proxy carefully before changing `API_HOST`. Requests are rate-limited; the app does not blindly trust forwarded client IPs. A shared proxy IP can cause shared limits, so evaluate the deployment's exact proxy arrangement before release.

## Required staging checks

- Sign up two separate users, verify email confirmation, sign in/out and token expiry. Add a password recovery flow before production use.
- Save/open a project with recorded and imported stereo takes. Confirm source audio survives a different browser session.
- Attempt reads, updates, signed downloads and version access as the other user; all must fail. Verify the bucket remains private and anonymous object URLs do not work.
- Race two updates to one project. One stale revision must return a conflict without replacing the current project.
- Test successful subscription, cancellation, expiry, duplicate/reordered events, incorrect signatures and unrelated Stripe prices. Frontend flags must never grant Premium access. Verify the customer portal and prevent duplicate subscriptions.
- Verify cloud version access becomes unavailable on entitlement expiry while current owned projects remain readable.
- Review CSP and HTTPS headers on the actual static host. Vite's development response headers are not a substitute for production host configuration.

## Release blockers

Cloud configuration, real provider integration tests and production deployment are outstanding. Per-account byte quotas, history retention, orphan-object cleanup and operational alerts are not implemented. Current per-upload limits do not bound cumulative storage. Implement lifecycle controls before opening public sign-up, and preserve referenced source assets when cleaning up.

Local device storage is independent of cloud identities and persists after sign-out. Do not describe it as account-isolated storage. No customer data or physical microphone recordings have been uploaded in development.

## Useful commands

```sh
npm ci
npm run check
npm audit
npm run server
npm run build
```

Never paste secrets into project files, screenshots, browser-visible errors or the build log. Rotate a key if accidentally exposed.
