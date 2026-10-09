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
