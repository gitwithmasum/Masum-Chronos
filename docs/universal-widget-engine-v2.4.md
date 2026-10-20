# MASUM CHRONOS v2.4 — Universal Productivity Widget Engine

## Architecture

The Widget Engine exposes a *small, independent, embeddable* widget toolkit, intended for NovaStudy and other websites without introducing shared database dependencies. It is an **opt-in reusable UI component**, not an automatic cross-app data synchronization service.

### Live URLs

- [Widget Studio](https://gitwithmasum.github.io/Masum-Chronos/web/widgets/studio.html) — choose type/theme/size and copy the integration snippet.
- [Focus widget](https://gitwithmasum.github.io/Masum-Chronos/web/widgets/widget.html?type=focus&theme=nebula&size=regular&minutes=25).
- [Countdown widget](https://gitwithmasum.github.io/Masum-Chronos/web/widgets/widget.html?type=countdown&theme=cyber&size=compact&minutes=10).
- [Task widget](https://gitwithmasum.github.io/Masum-Chronos/web/widgets/widget.html?type=tasks&theme=black-gold).
- [Stats widget](https://gitwithmasum.github.io/Masum-Chronos/web/widgets/widget.html?type=stats&theme=aurora).

### Quick start: an independent Focus Timer

```html
<div id="chronos-widget"></div>
<script src="https://gitwithmasum.github.io/Masum-Chronos/web/widgets/chronos-widgets.js"></script>
<script>
  const timer = ChronosWidgets.mount("#chronos-widget", {
    type: "focus", theme: "nebula", size: "regular", minutes: 25
  });
</script>
```

Supported `type`: `focus`, `countdown`, `tasks`, `stats`. Themes: `nebula`, `cyber`, `aurora`, `black-gold`, `pearl-waves`. Sizes: `compact` (up to 310px), `regular` (390px), `wide` (620px). Timer length 1–180 minutes.

The loader returns `{iframe,update(data),destroy()}`. The `update` method only sends supplied data in `source:'host'` mode. The loader uses an iframe; it does not inject markup into, or read the storage of, the host application.

### Opt-in read-only data: NovaStudy example

For a task or stats widget, the host can provide a minimal snapshot, rather than granting account access:

```html
<div id="study-progress"></div>
<script src="https://gitwithmasum.github.io/Masum-Chronos/web/widgets/chronos-widgets.js"></script>
<script>
  const studyWidget = ChronosWidgets.mount("#study-progress", {
    type: "stats",
    theme: "cyber",
    size: "regular",
    source: "host",
    data: {
      tasks: [{id: "chapter-1", text: "Complete algorithms chapter", done: true}],
      stats: {sessions: 6, focusSeconds: 9000}
    }
  });

  // After a course progress update:
  studyWidget.update({
    tasks: [{id: "chapter-1", text: "Complete algorithms chapter", done: true}],
    stats: {sessions: 7, focusSeconds: 10500}
  });
</script>
```

**Important:** The host application must deliberately obtain and supply its own *allowed* data. It must never supply authentication tokens, private course documents, full database records, credentials or personal secrets. Data crosses from host to Chronos only through this explicit API; the iframe never reads the host DOM, application storage or Supabase credentials.

The iframe accepts the `chronos:widget:data` message only from its direct parent with an exact configured origin match. The frame validates and bounds incoming tasks (60, each title up to 100 characters) and simple session statistics. Updates are rendered using `textContent` rather than HTML.

## Local mode, offline, and security

Independent widgets persist *their own* To-Do list and timer status at the **separate** `masum-chronos.widget.v1` storage key, not the Chronos app's `masum-chronos-v1` key. The host's app data is never automatically imported. Focus session counts in an independent widget are separate from the main Chronos Dashboard. Countdown and task widgets do not add time to main Chronos analytics.

Some browsers block or partition storage in third-party iframes. Widgets fall back to in-memory state when storage is unavailable; **cross-device persistence is not guaranteed**. For persistent NovaStudy data, use `source:'host'` for read-only display and keep actual records in NovaStudy's existing storage/database. There is no automatic two-way sync and no new Supabase migrations.

The frame has a restrictive Content Security Policy, requires no external API requests and loads only static scripts/styles from the Chronos GitHub Pages origin. The embed loader and iframe are both publisher-controlled code; embedding code from a third-party origin should be reviewed as a dependency before use in sensitive applications.

The focus/countdown widget plays a low-volume tone (if permitted by browser audio policy) for at most **10 seconds** when the timer finishes while the widget is active. **No closed-browser push reminders** are implemented.

The Widget Studio and widget files are cached by the Chronos service worker for offline access from the same app scope. External hosting and third-party iframe storage policies may still limit offline embeds.

## NovaStudy integration strategy

1. Test a standalone widget in Widget Studio, then paste the snippet into a **development branch** of NovaStudy before changing production.
2. Prefer the `source:'host'` mode with a **minimal sanitized view model** for course/task stats. Pass only authorized user-visible data.
3. Keep NovaStudy's established course/task state and Supabase permissions; do not reuse Chronos auth keys, copy access tokens or add broad RLS policies.
4. Scope styling to the iframe, constrain container width and verify responsive mobile PWA and keyboard navigation.
5. Test loaded, offline, signed-out and different-account states. After real-device QA, publish the NovaStudy integration as a separate version.

**This release implements the Chronos widget engine and reusable integration code; it does not automatically modify or deploy the NovaStudy repository.**

## Verification checklist

- Four widget modes render independently and support keyboard controls.
- Themes/size inputs validated, dangerous URLs and unsupported types never accepted.
- To-Do widget add/complete/delete works in local mode, read-only in host mode; host mode with no snapshot stays empty.
- Completed Focus timer increments isolated sessions/focus seconds *exactly once*, countdown does not; pause/resume and 10-second audio auto-stop.
- Malformed host data is sanitized; `event.source` and `event.origin` must match direct parent.
- Host widget receives the initial snapshot on iframe load and later `update(data)` messages; oversized/circular payloads fail safely.
- Main Chronos storage, tasks, Pomodoro, Sound Studio, Cloud Sync, Settings, Calendar and Galaxy Intelligence remain unchanged.
- GitHub Pages root and `/web/` work; PWA precache includes new files. Run `node tools/widget_engine_test.cjs`, existing suite and VSIX integrity checks.
- Test the actual iframe under NovaStudy's deployed hostname before claiming production integration success.

## Future work

A secure, consent-based cross-app task interoperability protocol, theme preset exchange, host callback events, typed SDK builds and server-backed reminders can be separate subsequent phases.
