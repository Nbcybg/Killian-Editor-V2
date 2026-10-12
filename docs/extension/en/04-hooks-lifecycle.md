# 4. Hooks and lifecycle

**Language:** English · [ภาษาไทย](../th/04-hooks-lifecycle.md)

[← 3. The SDK: the `k2` object](03-sdk-reference.md) · [Overview](README.md) · Next: [5. Look and feel →](05-ui-guidelines.md)

---

Killian 2 has three kinds of "hook":

| Kind | What it is for | API |
|---|---|---|
| **App events** | Do something when something happens (a project opens · a tab is switched · a file is saved) | `k2.on(name, fn)` |
| **The lifecycle hook** | Clean up when the plugin is unloaded | `k2.onUnload(fn)` |
| **Hooks outside plugins** | The "Custom JavaScript" step of an export workflow | [4.5](#45-other-hooks-outside-plugins) |

Every hook is a **notification**. A plugin gets to know about something, but **cannot block or cancel what the app is doing** (there is no before-save, and no return value that changes the outcome).

## 4.1 App events

| Event | Fires when | Payload |
|---|---|---|
| `project:open` | A project opens **and that project's plugins have finished loading** | `{ root, title }` |
| `project:close` | A project is about to close (files can still be read) | `{ root }` |
| `tab:activate` | The selected tab changes to another tab | `{ file, title, kind }` |
| `tab:save` | A document has been saved to disk successfully | `{ file, title, chars }` |
| `plugins:loaded` | The plugin loader has finished a pass | `{ loaded: string[] }` |

Every payload is plain data (strings/numbers/arrays). The app never hands its internal objects to a plugin.

### `project:open`

```js
k2.on('project:open', (e) => {
  // e.root  = the full path of the project folder (this machine's — never write it into a file)
  // e.title = the project title
  state = k2.getSettings('state', null);      // load the new project's state
  redraw();
});
```

- It is sent **after** that pass's plugins have run → a plugin that has only just been loaded because this project opened **also receives** the event.
- A user plugin that was already running is **not run again** when the project changes. This event is your only signal that "the project has changed"; you must clear/reload anything tied to the old project yourself (values from `getSettings` · caches of files · what your panel shows).

### `project:close`

```js
k2.on('project:close', (e) => { cache.clear(); });
```

- It is sent before the app tears the project down — you can still call `k2.readFile`, **but the app does not wait for Promises**. Anything that must finish has to be done synchronously (e.g. `k2.setSettings`).
- Avoid writing files at this moment if you can. Saving state periodically while working is better.

### `tab:activate`

```js
k2.on('tab:activate', (e) => {
  // e.file  = the full path of the file in the tab
  // e.title = the title on the tab
  // e.kind  = 'prose' | 'screenplay' | 'wiki' | 'other'
  panelTitle = e.title;
  redraw();
});
```

| `kind` | The tab | `getMarkdown()` · `getEditorView()` |
|---|---|---|
| `'prose'` | A scene/memo in novel mode | Usable |
| `'screenplay'` | A scene in screenplay mode | Usable (the text has line-prefix codes) |
| `'wiki'` | A Wiki entity page | `''` / `null` |
| `'other'` | Any other kind of file | `''` / `null` |

- It is sent only when the tab **really changes** (clicking the same tab again sends nothing) — including when the first tab opens.
- **There is no "last tab closed" event.** If you need to know that no document is open, check `k2.getEditorView() === null` at the moment you need it.
- Users can switch tabs rapidly — debounce heavy work, and do not read files on every switch.

### `tab:save`

```js
k2.on('tab:save', (e) => {
  // e.file  = the full path of the file that was saved
  // e.title = the document title
  // e.chars = the number of characters of body text saved
  total += e.chars;
});
```

- It is sent after the write to disk **succeeds** — for a manual save (`Ctrl+S`) · **Save all** · and **autosave**.
- It applies to documents with a `.md` body (scenes · memos). Saving a Wiki page · a board · a chart does not send this event.
- Save all sends the event **once per file**, one after another — if your work is expensive, debounce it and do it once.
- ⚠ **A `k2.setStatus` in this handler gets overwritten.** The app writes its own "saved" message to the status bar straight after the event. Show your result in your panel instead, or defer it:

  ```js
  k2.on('tab:save', () => setTimeout(() => k2.setStatus('…'), 0));
  ```
- `k2.getMarkdown()` in the handler gives you the body of **the selected tab**, which may not be the file that was just saved (with Save all/autosave). To get the body of the file that really was saved, use `k2.readFile` with the relative path of `e.file`.

### `plugins:loaded`

```js
k2.on('plugins:loaded', (e) => {
  hasFriend = e.loaded.includes('other-plugin');     // folder names of the plugins that are running
});
```

- It is sent at the end of every loader pass (a project opens · the user presses Reload/Enable/Disable/Install/Uninstall).
- Plugins that were only just run in that pass receive it too — use it as the "everyone is ready" point for work that involves other plugins.

### Turning a full path into a relative one

`e.file` and `e.root` are full machine paths. Before passing one to `k2.readFile` or storing it in settings:

```js
function relPath(full) {
  const root = String(k2.projectRoot() || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const p = String(full || '').replace(/\\/g, '/');
  return root && p.startsWith(root + '/') ? p.slice(root.length + 1) : null;   // null = outside the project
}
```

## 4.2 Plugins' own events

Plugins talk to each other over the same bus:

```js
// plugin A — announces
k2.emit('focus-timer:done', { minutes: 25 });

// plugin B — listens
k2.on('focus-timer:done', (e) => k2.log(e.minutes + ' minutes done'));
```

| Rule | Why |
|---|---|
| Name = `<plugin folder name>:<topic>` | No collisions with other plugins, and it is clear who sent it |
| **Never emit the app's event names** (`project:*` · `tab:*` · `plugins:*`) | Listeners would believe it really happened |
| The payload is plain data | The listener may be a different version/by a different author — sending objects with behaviour couples you too tightly |
| Document the payload's shape in your README | It is your plugin's public API — changing it is a breaking change |
| A listener must cope when nobody emits, and an emitter must cope when nobody listens | Load order is not guaranteed · the user may have disabled the other plugin |

`k2.emit` returns the number of listeners — you can use it to tell whether anyone is listening.

## 4.3 Lifecycle and `hotReload`

### The life of one plugin

```
[files on disk]
     │  the user opens a project / presses Reload / Enable / installs
     ▼
 ┌─ run ──────────────────────────────────────────────────┐
 │ new Function('k2', code)(k2)                            │
 │   • registers: commands · shortcuts · panels · handlers │ ← the app notes these in the plugin's record
 │   • k2.onUnload(fn)                                     │
 │   • things it creates itself: timers · listeners ·      │
 │     elements · styles                                   │ ← invisible to the app
 └─────────────────────────────────────────────────────────┘
     │
     ▼
 [running] ── events · commands · shortcuts · render ──┐
     │                                                 └─ loops here
     │  the user disables / uninstalls / edits the file and reloads / installs over it /
     │  switches project (for a project plugin)
     ▼
 ┌─ unload ───────────────────────────────────────────────┐
 │ 1. call every onUnload(why) (in reverse order)          │
 │ 2. remove event handlers                                │
 │ 3. remove shortcuts                                     │
 │ 4. close and unregister panels                          │
 │ 5. remove commands                                      │
 │ 6. hotReload not declared (or onUnload threw)           │
 │    → the name goes on the "restart needed" list         │
 └─────────────────────────────────────────────────────────┘
     │  (when the file was edited: the new copy runs straight away)
     ▼
 [end]
```

### What the app removes for you, and what you must remove yourself

| Removed for you (registered through `k2`) | You must remove it in `onUnload` |
|---|---|
| `registerCommand` / `addMenuItem` | `setInterval` · a `setTimeout` that has not fired yet · `requestAnimationFrame` |
| `registerShortcut` | `addEventListener` on `window` / `document` / one of the app's elements |
| `registerPanel` (the panel is closed and removed) | Elements you `append`ed to `<body>` or anywhere outside your own panel |
| `on` (event handlers) | A `<style>` / `<link>` you injected into `<head>` |
| | `MutationObserver` · `ResizeObserver` · `IntersectionObserver` |
| | `Worker` · `WebSocket` · `AudioContext` · `BroadcastChannel` |
| | Variables you hung on `window` |
| | `k2.fetch` requests still in flight (keep an "unloaded" flag for the callback to check) |

Elements and listeners **inside your own panel's `host`** need no removal — they go with the panel.

### `hotReload` — the author's promise

`"hotReload": true` in `plugin.json` = **"I vouch that my `onUnload` cleans up everything in the right-hand column."**

| Plugin | When it is disabled / uninstalled / its file is edited / installed over |
|---|---|
| Declares `"hotReload": true` | It leaves at once, with no warning |
| Does not declare it (the default) | The Plugins panel shows a **"Restart the app to finish unloading"** notice + a toast with a restart button — and it stays until the user really restarts the app |

- **Installing/enabling for the first time never needs a restart**, in any case.
- An `onUnload` that **throws** → the app assumes the cleanup was incomplete → it asks for a restart even though you declared `hotReload`.
- A plugin that **fails part-way through its first run** → it is unloaded with `why = 'error'` and falls under the same rule.
- The plugin's card tells the user in advance: "Can be disabled or uninstalled instantly" or "Needs an app restart after disabling or uninstalling".

**Declaring `hotReload` and then not cleaning up = a bug the user cannot trace**: a stray timer running the old version's code · two sets of listeners · something left floating on screen. If you are not sure, **do not declare it**. A restart notice is better than ghost behaviour.

### The recommended pattern: register in pairs

```js
'use strict';

// helpers: create something + register its undo on one line
const cleanups = [];
const track = (undo) => { cleanups.push(undo); };
k2.onUnload(() => { for (const fn of cleanups.splice(0).reverse()) { try { fn(); } catch (e) { k2.log('cleanup: ' + e.message); } } });

function listen(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  track(() => target.removeEventListener(type, fn, opts));
}
function every(ms, fn) {
  const id = setInterval(fn, ms);
  track(() => clearInterval(id));
  return id;
}
function mount(el, parent = document.body) {
  parent.append(el);
  track(() => el.remove());
  return el;
}

// in use
listen(window, 'keydown', (e) => { if (e.code === 'F2' && e.ctrlKey && e.shiftKey) doIt(); });
every(60000, tick);
mount(Object.assign(document.createElement('style'), { textContent: '.myplug-x{…}' }), document.head);
```

This example catches each undo's errors itself, so `onUnload` never throws — if one undo fails, the rest are still called.

### `'reload'` versus `'remove'`

```js
k2.onUnload((why) => {
  if (why === 'reload') sessionStorage.setItem(NS + ':carry', JSON.stringify(state));   // hand over to the new version
  else sessionStorage.removeItem(NS + ':carry');
});

// at start-up (the new version)
const carried = JSON.parse(sessionStorage.getItem(NS + ':carry') || 'null');
```

`'reload'` = the file changed and the new copy is about to run. While developing you hit this every time you press Reload.

## 4.4 Summary table: what happens when…

| The user | A user plugin | A project plugin |
|---|---|---|
| Opens a project (the first of this app session) | Runs → `plugins:loaded` → `project:open` | Already allowed: runs · not allowed yet: does not run |
| Presses **Reload**, file unchanged | Nothing happens (not run again) → `plugins:loaded` | The same |
| Presses **Reload**, file changed | `onUnload('reload')` → removed → run again | The same + it must be allowed again first (the fingerprint changed) |
| Presses **Disable** | `onUnload('remove')` → removed | The same |
| Presses **Enable** | Runs | Runs |
| **Uninstalls** / deletes the folder and reloads | `onUnload('remove')` → removed → the folder is deleted | The same |
| **Installs over it** | `onUnload('reload')` → removed → the new version runs | — (Install from link always goes to the User folder) |
| Switches to another project | **Keeps running; not run again** → `project:close` → … → `project:open` | The old project's: `onUnload('remove')` · the new project's: run (if allowed) |
| Quits the app | The window is destroyed — **`onUnload` is not called** | The same |

> **Do not rely on `onUnload` to save data.** When the app quits, it is not called. Save state the moment it changes (`k2.setSettings`), or periodically.

## 4.5 Other hooks outside plugins

### The "Custom JavaScript" step of an export workflow

A user (no plugin required) can put code into the last step of an export workflow: **Export → Edit export workflow steps…** → turn on the **Custom JavaScript** step.

```js
// variables provided: text (the whole text after the previous steps) · model (the document structure: title, chapters, scenes)
// you must return a string
return text
  .replace(/\.{3}/g, '…')                       // three dots → an ellipsis
  .replace(/ +\n/g, '\n');                      // trim trailing spaces
```

| Subject | |
|---|---|
| Runs when | Every export with that workflow (including when the Export Hub builds its preview) |
| Signature | `(text: string, model: object) => string` — it is a function body (use `return`) |
| Returns something that is not a string | The step is skipped, with a warning |
| Throws | The step is skipped, with a warning carrying the error message — the export does not fail |
| Runs | Synchronously — no `await` |
| Stage | "Final text" — after chapters/scenes are assembled and after the conversion to HTML (if that is on). So `text` may be Markdown or HTML, depending on the workflow. |
| Stored | In the workflow, which is in the project's `project.khn.json` |

It suits one-off text transformations at export time (swapping punctuation · adding a header/footer · filtering lines) without building a plugin. The code runs in the app's window with the same rights as a plugin, so **do not paste code from someone you do not know**.

The data-file extension points (languages · dictionaries · AI skills · templates) are in [chapter 10](10-other-extension-points.md).

## 4.6 Common patterns

### Debounce

```js
function debounce(fn, ms) {
  let id = 0;
  const run = (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
  k2.onUnload(() => clearTimeout(id));          // a timeout that has not fired must be cleared too
  return run;
}
const refresh = debounce(async () => { /* expensive work */ }, 400);
k2.on('tab:save', refresh);
k2.on('tab:activate', refresh);
```

### Listen once

```js
const off = k2.on('project:open', (e) => { off(); init(e); });
```

### Work that must know whether it is still wanted after an `await`

```js
let alive = true;
k2.onUnload(() => { alive = false; });

k2.on('tab:save', async (e) => {
  const rootAtStart = k2.projectRoot();
  const r = await k2.fetch(URL, { /* … */ });
  if (!alive) return;                            // the plugin was unloaded while waiting — touch nothing more
  if (k2.projectRoot() !== rootAtStart) return;  // the user switched projects while waiting
  draw(r);
});
```

### Polling (when there is no event to listen for)

There is no "text changed" or "selection changed" event. If you really need one:

```js
let lastLen = -1;
const id = setInterval(() => {
  if (document.hidden) return;                   // the window is not in front — nothing to do
  const v = k2.getEditorView();
  const len = v ? v.state.doc.content.size : -1; // far cheaper than getMarkdown()
  if (len === lastLen) return;
  lastLen = len;
  onDocChanged();
}, 1000);
k2.onUnload(() => clearInterval(id));
```

- An interval of ≥ 1 second · check something cheap (the document size) before doing something expensive (`getMarkdown`).
- **Do not use a `MutationObserver` on the editor's DOM or on the app's bars.** It fires on every keystroke and slows the whole app down.

## 4.7 What hooks cannot do (in this version)

| You want to | State |
|---|---|
| Block/cancel a save · a delete · an export | Not possible — there are no "before…" hooks |
| Change content before it is written to a file | Not possible |
| Know every time the user types/selects text | No event (see 4.6) |
| Know when a scene, chapter, book or entity is created/deleted/moved/renamed | No event — check the registry files when you need to |
| Know when the theme/language/settings change | No event — use the theme's CSS variables (they change by themselves) |
| Know when the app is about to quit | Not available |
| Listener priority | None — listeners are called in registration order |

Need a new hook? Propose it through an in-app report (Help → Report a bug…) or a pull request. A maintainer adds one by calling `pluginBus.emit('<topic>:<verb>', {plain data})` at the place it happens, together with a row in the table of this document.

---

Next: [5. Look and feel →](05-ui-guidelines.md)
