# Schengen Tracker — web

Responsive web companion to https://github.com/lerdeljan17/Schengen, preserving its four screens, rounded cards, original colors and eight themes.

## Run

Node 22.13+; `npm ci`, then `npm run dev`. Production: `npm run build`. The application is a React/Vinext app deployed as a Cloudflare Worker with static assets and a D1 binding.

To exercise the production Worker locally, build it, apply the local D1 migration, then start Wrangler:

```sh
npm run build
npm run db:migrate:local
npm start
```

## Features

- Inclusive, overlap-safe 90/180-day calculations, confirmed vs projected availability, recovery dates and overstay detection.
- Trip CRUD, open trips, country flags and multi-country selection, notes and source labels.
- 25-month calendar with daily availability, connected trip highlights and day details.
- Traveler profiles, system/light/dark appearance and eight original color themes.
- Built-in email/password accounts, open to any email address without a separate identity-provider plan.
- Per-account D1 sync with a browser cache and automatic one-time migration of pre-login browser data. Android-compatible CSV/JSON backup and restore remain available.
- Opt-in foreground location checks via OpenStreetMap Nominatim, plus browser notifications at 30/15/7/1 days remaining while the site is open.
- A feature-detected WebMCP date checker sharing UI state and calculation functions.

## Platform differences

Accounts, hashed passwords and sessions are stored in D1. Passwords are derived with PBKDF2-SHA256 using a unique random salt and Cloudflare Workers' maximum 100,000 iterations; raw passwords and raw session tokens are never stored. Session cookies are HttpOnly, SameSite=Lax and Secure in production, and login attempts are throttled. Each account's profiles, optional passport numbers, trips and preferences are stored as a validated JSON snapshot in an isolated D1 row. Data is not end-to-end encrypted, so users who do not want passport details in D1 should leave the optional passport-number field blank. `/api/health` checks D1 availability.

Email addresses are account identifiers only: this first version does not verify ownership and does not provide password recovery. Users should choose a unique strong password and keep a portable backup of their trips.

The first successful login moves the existing anonymous browser snapshot into that account if the account has no cloud data. Later logins on the same browser use account-specific cache keys so one account's local data cannot be imported into another account.

Web browsers do not provide Android-style reliable background geofences, periodic location checks or daily notifications when the site is closed. Foreground checks are labeled accordingly. Location permission is requested only on explicit opt-in; coordinates are used for reverse geocoding and are not saved. Validate auto-detected dates after crossings.

Confirmed forecasts intentionally clip open trips at today (the Android implementation's comment states this intention, but its open-trip branch currently leaves them unbounded). Planned forecasts keep ongoing trips open. The app is a planning aid and does not account for individual visa restrictions or exemptions.

## Validation

`npm run check`

GitHub Actions runs type checking, the calculation and backup tests, and the production build on every push and pull request to `main`.

On a push to `main`, the deploy job waits for validation, applies pending D1 migrations, and deploys the generated Worker to Cloudflare. Pull requests never deploy.

Tests cover inclusive dates, overlapping trips, rolling-window boundaries, open-trip projections, recovery dates, the 91st-day overstay boundary, leap years/DST, Android-format backup round trips, and invalid imports.

## One-time Cloudflare setup

The free-tier `schengen-tracker-db` database is already provisioned in the EU jurisdiction, and its non-secret account and database IDs are checked into `wrangler.jsonc`.

1. Create an API token from Cloudflare's **Edit Cloudflare Workers** template, restrict it to this account, and add **D1 Edit** so CI can apply migrations. Never commit the token.

2. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add repository secret `CLOUDFLARE_API_TOKEN`.

3. Push this configuration to `main`, or re-run the `CI` workflow. The deploy applies pending D1 migrations before publishing the Worker.

4. Visit the Worker in a private browser window. Create an account with any email address and a password of at least 10 characters. Once signed in, Settings should show **Cloud sync → Up to date** and the header should show the account email and **Log out**.

Cloudflare Zero Trust is not required, so this setup does not opt into Access seats or overage billing. The application stays within the ordinary Workers and D1 free-tier limits unless those limits are exceeded; on the free plan, requests fail rather than automatically becoming paid usage.

For a one-off authenticated local deployment, authenticate Wrangler and run the deployment script:

   ```sh
   npx wrangler login
   npm run deploy
   ```
