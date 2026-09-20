# Schengen Tracker — web

Responsive web companion to https://github.com/lerdeljan17/Schengen, preserving its four screens, rounded cards, original colors and eight themes.

## Run

Node 22.13+; `npm ci`, then `npm run dev`. Production: `npm run build`. The application is a React/Vinext app with a Cloudflare-compatible Worker build.

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

Web browsers do not provide Android-style reliable background geofences, periodic location checks or daily notifications when the site is closed. Foreground checks are labeled accordingly. Location permission is requested only on explicit opt-in; coordinates are used for reverse geocoding and are not saved. Validate auto-detected dates after crossings.

Confirmed forecasts intentionally clip open trips at today (the Android implementation's comment states this intention, but its open-trip branch currently leaves them unbounded). Planned forecasts keep ongoing trips open. The app is a planning aid and does not account for individual visa restrictions or exemptions.

## Validation

`npx tsc --noEmit`

`node --experimental-strip-types --test tests/schengen.test.ts`

Tests cover inclusive dates, overlapping trips, rolling-window boundaries, open-trip projections, recovery dates, the 91st-day overstay boundary, leap years/DST, Android-format backup round trips, and invalid imports.
