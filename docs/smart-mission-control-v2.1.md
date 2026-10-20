# MASUM CHRONOS v2.1 — Smart Mission Control

## Design goals

The v2.1 mission features must preserve all existing saved tasks, stopwatch/timer state, themes, custom sounds, NovaStudy-shared Supabase Cloud and Chrome ↔ VS Code local bridge. This is an **additive local-first update**. No Supabase migration is needed because Chronos mission records store task payload as JSONB. The new fields are sanitized both in the PWA and the VS Code local bridge.

## New capabilities

| Capability | Behavior |
| --- | --- |
| Smart task schema | Recurrence (`none,daily,weekly,monthly`), prerequisite mission, optional reminder time, estimated minutes, recurrence series ID |
| Dependencies | A locked mission cannot be completed or focused until its prerequisite is done. Cyclic dependencies are rejected in the engine and edit form. |
| Recurring missions | Completing a repeatable mission creates the next occurrence with a deterministic ID (`seriesId~YYYYMMDD`) while preserving history. Replaying a completion on another device does not create an identical duplicate. |
| Calendar dates | New occurrences are calculated at local noon to avoid UTC date drift, with missed occurrences skipped instead of bulk-generated. Month-end recurrences use the month's last valid day. |
| Smart reminders | Optional time-of-day `HH:MM` fires only once the local time is reached, or immediately if overdue. Receipt state prevents repeated daily alarms while Chronos is running. |
| Mission HUD | Ready-to-work count, blocked count, due/overdue count, total estimated ready time, one prioritised suggestion. |
| Command Palette | Open by Ctrl+K / Cmd+K or the header button, navigate with Arrow keys; search actions and ready missions, `task <title>`, `timer <minutes>`, show blocked/overdue, Cloud Settings. |
| Cross-app compatibility | Chrome/PWA, VS Code webview, local bridge and Cloud JSONB now retain new task metadata. |

## Data compatibility and limitations

- Legacy v1.0–v2.0 states automatically migrate. Existing tasks default to `recurrence: 'none'`, `dependsOn: []`, `reminderTime: ''`, `estimateMins: 0`. Existing data and timer state are not cleared.
- The task editor currently chooses one prerequisite per mission through the UI. The underlying engine supports up to eight unique prerequisite IDs for future advanced editing/import.
- Prerequisites referring to deleted or missing tasks remain locked until edited. Clearing *completed* tasks clears their satisfied prerequisite references so active tasks do not become locked.
- If the active task list has reached the existing 300-task limit, a completed recurring mission cannot automatically create the next occurrence until space is cleared. Existing task-history entries remain intact.
- `Ctrl+K` is reserved inside Chronos; when another modal is open, Command Palette does not interrupt it.
- Sound, browser notifications and time-based reminders cannot be guaranteed while the PWA is fully closed, suspended, or blocked by browser autoplay/permission settings. Scheduled server-side push is not implemented in v2.1.
- Some uploaded sound blobs remain local by design. Cloud auth sign-in still requires the configured Supabase Auth redirects/provider.
- Next occurrence ID generation is deterministic per series and due date, but two devices acting offline can still have conflicting metadata and should be tested before a production release.

## Acceptance testing

1. Open the GitHub Pages root or `/web/` URL. Verify Settings, To-Do and Timer operate with prior data.
2. Add a mission using **Repeat: Daily**, Due Date **today**, Reminder **future time**, Estimated Minutes **25**. Complete it; verify a completed history entry and one new mission due the following day.
3. Create mission B that **depends on mission A**. Before completing A, B must appear Blocked, and its Focus/Complete controls must be unavailable. Complete A; B should unlock.
4. In Mission Control check ready / blocked / due / estimated metrics and priority recommendation, plus the **Blocked** task filter.
5. Open Command Palette using the header icon and `Ctrl+K`; type `task Write report`, create it. Type `timer 15` and confirm 15-minute countdown starts in Countdown mode. Test Escape and arrow navigation.
6. Edit recurrence, due date, dependency and reminder; refresh the page and confirm all values are saved. In another browser/VS Code local bridge, verify task metadata survives synchronization.
7. Reload after an offline session and sign into Supabase; confirm existing JSONB mission and preference records still reconcile without data loss.
8. Verify theme contrast, small-screen scrolling, screen reader labels, JavaScript console errors, network requests, and PWA installation/update.
9. Run `node tools/mission_engine_test.cjs`, `node tools/control_center_test.cjs`, `node tools/cloud_sync_test.cjs`, `node tools/sync_test.cjs`, `node tools/vscode_sync_test.cjs`, and `npm run lint`; confirm CI and GitHub Pages deployment on the final commit.

## Proposed follow-ups

The next iterations could add multiple prerequisite picker chips, exact date-time reminders through service worker push and user consent, recurring schedules with weekday/advanced RRULE support, richer time-blocking, and shared task widgets for NovaStudy. These are **not** included in v2.1 beta.
