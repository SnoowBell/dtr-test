# Shared storage setup (Supabase, free tier)

1. Create a free project at https://supabase.com (note the region closest to you).
2. Open **SQL Editor -> New query**, paste everything from `supabase/schema.sql`, click **Run**.
3. Open **Project Settings -> API**. Copy the **Project URL** and the **anon public** key.
4. Paste them into `js/config.js`.
5. Push the folder to GitHub and enable **Settings -> Pages**.

Open the site on two devices: the sidebar shows **Cloud Sync: Synced** and
changes appear on the other device within a second or two.

## Good to know

- First browser to connect uploads its existing local data automatically (nothing is overwritten in the cloud).
- Offline? Changes are kept locally and sent when the connection returns.
- Two people editing the exact same branch's records at the same moment: last save wins.
- Without config values the app still works in local-only mode.

## Security note

Login is checked in the browser and the anon key is public, so anyone who
reads the page source can read/write the `dtr_kv` table (including account
hashes and records). Fine for a small trusted team; for sensitive data move
login to Supabase Auth with per-branch row policies.
