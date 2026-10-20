# MASUM CHRONOS v2.0 Cloud Sync — Shared NovaStudy Supabase

This app uses the existing **NovaStudy-Routine Supabase project** for backend infrastructure, with its own `chronos_*` tables. Do not replace, rename, or modify NovaStudy's `ns_*` or `novastudy_backups` tables.

## Status

- **Database installed**: `chronos_missions`, `chronos_preferences`, `chronos_backups` in project `pkydbkpbayrarnwaomoa` (Mumbai). All RLS enabled and isolated to `auth.uid()`.
- **RPCs installed**: `chronos_upsert_missions(jsonb)` and `chronos_upsert_preferences(jsonb,bigint)`. Both are `SECURITY INVOKER`, granted to `authenticated` and not `anon`, and reject stale revisions.
- **Frontend code integrated**: Chrome / PWA cloud panel, public key, OAuth redirect handler, refreshable session, task merging and tombstones, automatic daily backup, manual backup and two-step restore, settings sync.
- **Cloud Google Login activation requires an Auth redirect allow-list update and a signed-in real-browser end-to-end test.** Do not claim those are complete until confirmed.
- The VS Code webview retains **Local Link** syncing with Chrome. Direct Google OAuth is not enabled in the VS Code webview.

## Required Supabase Dashboard step

Open [NovaStudy Supabase URL Configuration](https://supabase.com/dashboard/project/pkydbkpbayrarnwaomoa/auth/url-configuration).

**Important: DO NOT change the existing Site URL!** It belongs to NovaStudy. Under **Redirect URLs** add:

- `https://gitwithmasum.github.io/Masum-Chronos/`
- `https://gitwithmasum.github.io/Masum-Chronos/web/`

If developing on localhost, add the exact localhost origin and path used for development, avoiding overly broad wildcards in production.

Under **Authentication → Providers → Google**, verify the existing Google provider is enabled. As this is a shared Supabase project, Google OAuth callback at Google Cloud remains the existing Supabase project's `/auth/v1/callback`; do not replace NovaStudy's Google client settings.

## User flow

1. Visit `https://gitwithmasum.github.io/Masum-Chronos/`.
2. Open **Settings → Cloud Sync & Backup** (project is preconfigured using a safe public publishable key).
3. Click **SIGN IN WITH GOOGLE**. The Supabase redirect URL must be allowed as described above.
4. After returning to Chronos, look for **SIGNED IN / SYNCED** and **SYNC NOW**.
5. Test in a second browser/profile with the same Google account. A newly added To-Do Mission should synchronize within roughly 30 seconds while online.
6. Confirm **BACKUP NOW** creates an account-owned snapshot. **RESTORE LATEST** requires pressing twice within 15 seconds to prevent accidental replacement.

## Privacy / reliability notes

- Your database rows are kept separate from NovaStudy tables and can only be accessed by their `user_id` via row-level security.
- The `sb_publishable_...` key can be embedded in web code; **never commit service role or secret keys**.
- Missions, tombstones, settings and backups sync. Device timer deadlines, elapsed stopwatch state and local sound file blobs are *not* synchronized across devices.
- Two apps consume the **same shared Supabase Free-plan quota** and Auth resources.
- The app remains local-first when unsigned or offline; changes reconcile automatically once connected. Force-close or suspended browsers cannot guarantee reminder playback.
- On switching Google accounts, the previous local app snapshot is preserved under an account-specific browser-storage key, and it is not uploaded to the new account.
- A before-restore safety snapshot is kept in browser localStorage as `masum-chronos-pre-restore-safety`.
- Only the user can finish OAuth in their browser. Do not ask anyone to send their database password, OAuth client secret, refresh token or secret key.
