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
- Local browser persistence and Android-compatible CSV/JSON backup and restore. Restore validates the entire backup before replacing data, with confirmation.
- Opt-in foreground location checks via OpenStreetMap Nominatim, plus browser notifications at 30/15/7/1 days remaining while the site is open.
- A feature-detected WebMCP date checker sharing UI state and calculation functions.

## Platform differences

Google Drive sync was deferred by the owner. No Google credentials are configured, and the UI clearly reports this. Use backups to transfer data between devices. Trips are local to each browser, not automatically shared across devices.

D1 currently stores only non-personal application metadata and is checked by `/api/health`. Travel and passport data deliberately remain in browser storage until the app has real user authentication and an explicit encrypted sync design.

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

3. Push this configuration to `main`, or re-run the `CI` workflow. The first successful deploy creates the `schengen-tracker-web` Worker and gives it a `workers.dev` URL. Verify `https://<worker-url>/api/health` returns `{"status":"ok","database":"ok"}`.

For a one-off authenticated local deployment, authenticate Wrangler and run the deployment script:

   ```sh
   npx wrangler login
   npm run deploy
   ```
