# Masum-Chronos v2.2 — Smart Calendar & Advanced Mission Dependencies

v2.2 adds an accessible, local-first **weekly time-blocking planner**, up to **8 prerequisites per task**, a **dependency network overview**, and **overlap/deadline conflict checks**.

## Feature design

**Smart Calendar:** Mission Control now has a seven-day Monday–Sunday calendar. Desktop users can drag an unscheduled mission from the backlog to any hourly drop slot or drag an already planned card to move it. A mobile/keyboard alternative provides Mission, Date, Start and Duration fields followed by Schedule. Week navigation has Previous, Today and Next; scheduled blocks can be removed without deleting the underlying mission.

**Scheduling:** A time block records `planDate` (YYYY-MM-DD), `planStart` (HH:MM) and `planDurationMins` (5–480). Calendar conflict detection rejects blocks overlapping an unfinished task on the same day, blocks ending after midnight, and time blocks later than the mission due date. Back-to-back blocks are valid. A conflict in previously imported data is also displayed on the calendar rather than silently hidden. The planner uses device-local wall-clock time; cross-timezone normalization and external Google Calendar linking are future work.

**Multiple prerequisites:** The creator/editor now shows a checkbox set of up to 8 other missions. Existing `dependsOn` arrays remain intact during edits, and a cycle is prevented. Missing linked missions appear as unavailable prerequisites so the user can remove them. The new dependency network shows Ready/Locked status and prerequisite connections; its detailed visualization is a card-and-edge representation rather than an animated canvas graph.

**Persistence & backwards compatibility:** The existing `masum-chronos-v1` localStorage snapshot key, Supabase mission JSONB payload, and Chrome–VS Code local bridge remain in use. v2.2 accepts v1.x/v2.0/v2.1 snapshots and preserves timers, theme, sound selection, completed history and existing recurrence IDs. New recurring occurrences start **unscheduled**; editing a scheduled mission does not discard its calendar fields. Supabase SQL schema is unchanged.

## Manual acceptance sequence

1. Open [Masum-Chronos on GitHub Pages](https://gitwithmasum.github.io/Masum-Chronos/) and verify prior tasks, Settings, Pomodoro, PWA and sound settings remain.
2. In Mission Control create task A, then tasks B and C with dependencies. Choose **both A and B** as prerequisites for C. C stays locked until both A and B are completed. Try to create a cycle in the editor; it should be unavailable/rejected.
3. Create task D with a due date after the planned date; schedule it at 09:00 for 60 minutes, then try to schedule task E at 09:30 for 30 minutes on the same day. It should be rejected. Scheduling E at 10:00 should work.
4. Move task D with drag-and-drop. Then remove the time block; D should still exist in the To-Do queue.
5. On a phone, schedule a task using the native input form instead of drag-and-drop. Navigate to a different week and back.
6. Inspect the dependency network; status and lines should match task progress. Use Ctrl/Cmd+K → Open Smart Calendar or Open Dependency Network.
7. Set up a daily/weekly/monthly recurring mission. Completing it must create one new unscheduled occurrence and retain past history; month-end date anchors must still work.
8. With Cloud Sync enabled, verify `planDate`, `planStart`, `planDurationMins` and multi-prerequisite IDs sync on a second browser and over the authenticated VS Code local bridge. Confirm no unintended data replacement. These end-to-end steps require the user's own signed-in devices.
9. Confirm focus timer, ringtone auto-stop, theme changes, keyboard navigation, and Settings still work. Test narrow-screen horizontal scrolling in the calendar.
10. In CI verify: `npm run lint`, `npm run test:calendar`, `npm run test:missions`, all existing regressions, VSIX packaging and GitHub Pages deployment.

## Boundaries

- Time blocking is in-app only. It does not create Google Calendar events or send backend push reminders.
- A scheduled mission may depend on other missions; the calendar will show the block while the task remains locked until prerequisites are done.
- Browser drag-and-drop is best on desktop; the form is the supported accessible touch/keyboard alternative.
- Individual recurrence instances each get their own plan. Newly generated instances never reuse the prior week's scheduled block.
- Do not clear browser Site Data when troubleshooting PWA updates; that could delete unsynced local missions.
- VS Code Marketplace publishing is separate from a successful VSIX CI artifact.

Future candidate v2.3: analytics, heatmaps, actual-vs-estimated focus and reports.