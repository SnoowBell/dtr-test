# DTR Shift Recorder

A browser-based time clock and daily time record (DTR) dashboard. No build step or dependencies.

## Run locally

Open `index.html` in a browser.

## Deploy on GitHub Pages

Push this folder to a repo, then go to **Settings → Pages**, choose the `main` branch and the `/ (root)` folder.

## Structure

- `index.html` – markup
- `css/styles.css` – styles
- `js/app.js` – app logic

## Shared storage

See `SETUP.md` to sync data across all devices with Supabase (`js/config.js`, `js/cloud.js`, `supabase/schema.sql`).
