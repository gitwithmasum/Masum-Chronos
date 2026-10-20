## v2.1.0-beta.2 — Final QA & Reliability

- Fix calendar recurrences: monthly 31st stays anchored across short months and daily/weekly schedules use DST-safe date-only arithmetic.
- Persist the original recurrence anchor in the browser task model, Supabase JSONB payload and Chrome ↔ VS Code local sync bridge without breaking earlier beta task states.
- Reject Supabase service-role and unknown-role legacy JWTs in client configuration; accept publishable keys and legacy anon keys.
- Expand automated regressions for month-end recurrence, DST in America/New_York, task deduplication, Cloud configuration safety and previous Settings/Command Palette functionality.
- Refresh PWA caches and VSIX package version to 2.1.0-beta.2. Real-device behavior, Google OAuth and closed-app notification delivery remain outside automated QA.

## v2.1.0-beta.1 — Smart Mission Control

- Add dependency-aware Task Engine with cycle protection, blocked mission tracking, ready queue and smart recommendation.
- Add daily, weekly and monthly recurring tasks with deterministic next-occurrence IDs and completed history retention.
- Add optional HH:MM local-time reminders, estimated minutes and migration-safe task metadata.
- Add futuristic Mission HUD, Command Palette (Ctrl+K / Cmd+K, task creation, timer commands, search).
- Preserve cloud/local bridge task metadata without changing NovaStudy Supabase tables.
- Add responsive styles, PWA cache asset updates, VS Code webview resource mapping and dedicated regression tests.
- Beta limitations and manual end-to-end QA are documented in `docs/smart-mission-control-v2.1.md`.

## v2.0.0-beta.2 — Futuristic Settings Control Center

- Replace crowded Settings overlay with five clearly separated modules and a visual galaxy command rail.
- Add responsive horizontal navigation for narrow screens and themed Pearl Waves light mode.
- Support accessible tab semantics, arrow/Home/End keyboard navigation and pinned Save/Close controls.
- Preserve sound studio, Supabase Cloud panel, Chrome ↔ VS Code pairing, timer options, previous beta user data.
- Refresh PWA caches and Marketplace VSIX packaging to include the new Control Center stylesheet and regression test.

## v2.0.0-beta.1 — Shared Supabase Cloud Foundation

- Installed `chronos_missions`, `chronos_preferences`, `chronos_backups`, RLS and authenticated security-invoker sync RPCs in the existing NovaStudy Supabase project. No `ns_*` tables changed.
- Browser/PWA opt-in Google OAuth UI, refreshable sessions, automatic 30-second task and preferences reconciliation, date-stamped backups, safety-checked restore and offline resilience.
- Separate local task profiles for account switching and account-scoped preference revisions.
- Corrected root GitHub Pages offline service worker, added Cloud integration tests and v2 package assets.
- **Pending manual verification:** Add Chronos redirect URLs without changing NovaStudy Site URL, then complete real Google OAuth, multi-device and deployment smoke tests.

## v1.3.0 — Smart Sound Studio

- Per-event preset ringtone selection, manual-loop stop or optional 10s auto-stop, event mute and volume.
- IndexedDB custom MP3/WAV/OGG import, preview, removal, and preferences retention.
- Date-only due and overdue reminders while the app is open, plus Stopwatch lap/pause and To-Do completion sounds.
- Chrome/PWA and VS Code webview assets wired; preserves legacy v1.2.3 data.

## v1.2.3 — Pearl Waves Theme (2026-10-13)

- Add optional Pearl Waves light theme inspired by white, pink, and purple flowing curves.
- Lighten the timer, task dashboard, cards, settings and editor surfaces with readable contrast.
- Persist user-selected theme across browser reloads and VS Code webview reopens.
- Keep all four previous themes, existing task data, 10-second ringtone, and local bridge sync.
- Refresh PWA service-worker cache and prepare updated v1.2.3 VSIX.

## v1.2.2 — Marketplace Visual Identity Refresh

- Replace clock-only icon with the user-approved futuristic Timer + To-Do combination icon (192px Marketplace / 512px PWA).
- Introduce a matching Timer + To-Do galaxy banner as the first image in the Marketplace README.
- Match browser favicon to the new combined icon and refresh the PWA cache.
- No changes to running timers, missions, ringtone, local sync or stored data.

## v1.2.2 — Marketplace Release Candidate

- Added publisher-ready metadata: repository, homepage, bug tracker, publisher banner and author.
- Updated Marketplace README screenshots to stable HTTPS URLs and improved installation, privacy and support guidance.
- Added VSIX packaging allowlist, support notes, Marketplace instructions and official `@vscode/vsce` checks in CI.
- Kept v1.2.1 Timer, To-Do Missions, 10-second ringtone and opt-in local task sync logic unchanged.

## v1.2.1 — 10-second Completion Ringtone

- Play a gentle, futuristic four-note ringtone for precisely 10 seconds when Pomodoro focus, breaks, or Countdown finishes.
- Preserve the existing opt-in completion sound setting and app volume; no external sound files needed.
- Show a compact neon "TIME IS UP" alert with a SILENCE button while the ringtone is playing.
- Schedule audio on Web Audio time, rather than on throttled background-tab JavaScript timers.
- Do not play a delayed ringtone when an expired timer is rediscovered more than 30 seconds later.
- Keep the v1.2 local Chrome ↔ VS Code task sync, all tasks, timer statistics, settings, and themes.

## v1.2.0 — Local Sync Link

- Opt-in, localhost-only, 256-bit pairing key to sync To-Do Missions between Chrome/PWA and VS Code on the same laptop.
- Per-task modification timestamps and deletion tombstones for conflict-aware merging; v1.0/v1.1 data preserved.
- Chrome syncs roughly every 2.5 seconds while running; sync bridge stays alive when VS Code webview closes, provided VS Code is running.
- Independent Chrome and VS Code timer progress, theme and analytics intentionally remain local.
- Explicit start/stop/copy-key VS Code commands; strict allowed Origins, private loopback bind, authentication, request size limits and safe Webview CSP.

# Changelog

## 1.1.0 — 2026-10-09
- Added full futuristic To-Do Mission Command Center alongside the Timer workspace.
- Added task priorities, categories, optional due dates, overdue indicators, search, filters, sort and CRUD editing.
- Added mission progress analytics, smart next mission and one-click Focus on Mission.
- Kept timer page quick task list linked to full To-Do list.
- Preserved local v1.0.0 timer settings, tasks, themes, and session stats via backward-compatible state migration.
- Updated Chrome PWA cache version, VS Code extension metadata and GitHub Pages deployment workflow.

## 1.0.0 — 2026-10-09
- First Chrome/PWA and VS Code extension release.
- Animated neon dashboard, three timing modes, tasks, stats, themes and ambient audio.
- Local persistence, browser desktop notifications and VS Code Status Bar countdown.
