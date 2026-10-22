# MASUM CHRONOS v2.6 — Secure Widget SDK

## Compatibility

The existing `ChronosWidgets.mount(element, options)`, `update(data)` and `destroy()` API remains available. The mount handle now also exposes `ready`, a Promise that resolves to the iframe after the widget sends an authenticated readiness message. The Promise rejects if the iframe fails or does not become ready within the configured timeout; the SDK internally observes that rejection so callers may opt out of awaiting it.

## Example

```html
<div id="chronos-stats"></div>
<script src="https://gitwithmasum.github.io/Masum-Chronos/web/widgets/chronos-widgets.js"></script>
<script>
  const widget = ChronosWidgets.mount("#chronos-stats", {
    type: "stats",
    theme: "cyber",
    size: "regular",
    source: "host",
    data: {
      tasks: [{ text: "Study DSA", done: false }],
      stats: { sessions: 3, focusSeconds: 4500 }
    },
    onReady(iframe) { console.log("Chronos ready", iframe); },
    onResize(height) { console.log("Widget height", height); },
    onError(error) { console.warn("Chronos widget issue", error.message); }
  });

  // Only call update after your app's own user-consent gate has approved sharing.
  widget.update({
    tasks: [{ text: "Study DSA", done: true }],
    stats: { sessions: 4, focusSeconds: 6000 }
  });

  // When the host panel closes:
  // widget.destroy();
</script>
```

## Mount options

- `type`: `focus`, `countdown`, `tasks`, or `stats`.
- `theme`: `nebula`, `cyber`, `aurora`, `black-gold`, or `pearl-waves`.
- `size`: `compact`, `regular`, or `wide`.
- `minutes`: integer duration from 1 to 180.
- `source`: `local` by default; `host` enables read-only parent-supplied snapshots for task/stats widgets.
- `data`: optional initial host snapshot. It is sent only when `source: "host"`.
- `onReady(iframe)`, `onResize(height)`, `onError(error)`: optional callbacks.
- `readyTimeoutMs`: optional integer from 1,000 to 30,000; defaults to 10,000.
- `loading`: `"eager"` or the default lazy loading.
- `title`: optional accessible iframe title.

## Security and privacy

- The iframe uses `sandbox="allow-scripts allow-same-origin"`. It can run the Chronos widget and use its own origin's storage, but it is not granted top-navigation or popup permissions.
- The loader sends host snapshots only in explicit `source: "host"` mode, only to the Chronos iframe origin, after JSON serialization and a 64 KB limit.
- The receiver validates the exact host origin and `event.source === window.parent`; the loader validates the exact Chronos origin and `event.source === iframe.contentWindow`.
- Readiness and resize messages contain no task data. Resize requests outside 220–720px are ignored.
- Host widgets are read-only. The SDK never reads host localStorage, DOM, database, auth token, or app state. The host chooses exactly which fields to share.
- Browsers may partition or block third-party iframe storage. The timer works while the iframe is open; background timer alarms are not guaranteed.
- Do not share private task notes, credentials, or sensitive data. Use a separate user action to enable host data sharing.

## Teardown and error handling

Call `destroy()` when the widget is removed. It removes the iframe, global message listener, load/error listeners and readiness timeout. Network or runtime errors are reported through `onError`; the widget does not change the host application's data.

## QA

The `npm run test:widgets` suite covers SDK compatibility, invalid configuration, iframe sandboxing, readiness callback, exact-origin resize, oversized host payload rejection, host-message isolation, local storage isolation and asset presence. Real browser tests are still required for Android/iOS PWA behavior and browser-specific third-party storage partitioning.
