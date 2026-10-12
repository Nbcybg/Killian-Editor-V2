# 3. The SDK: the `k2` object

**Language:** English · [ภาษาไทย](../th/03-sdk-reference.md)

[← 2. Anatomy of a plugin](02-anatomy.md) · [Overview](README.md) · Next: [4. Hooks and lifecycle →](04-hooks-lifecycle.md)

---

Killian 2's "SDK" is an object called **`k2`** that the app builds for each plugin (a separate one each, bound to that plugin's name). There is no package to install — the types for your code editor are in [`k2.d.ts`](../k2.d.ts).

This reference matches `pluginApi()` in `src/app.js` as of **alpha.169**.

## The API at a glance

| Group | Members |
|---|---|
| [Information](#31-information) | `pluginName` · `appVersion` · `projectRoot()` |
| [Commands and shortcuts](#32-commands-and-shortcuts) | `registerCommand()` · `addMenuItem()` · `registerShortcut()` |
| [The editor](#33-the-editor) | `getMarkdown()` · `insertText()` · `getEditorView()` |
| [Panels](#34-panels) | `registerPanel()` · `showPanel()` · `hidePanel()` |
| [Events](#35-events) | `on()` · `off()` · `emit()` · `onUnload()` |
| [Files](#36-project-files) | `readFile()` · `writeFile()` · `listDirs()` · `listFiles()` |
| [Settings](#37-plugin-settings) | `getSettings()` · `setSettings()` |
| [The screen](#38-the-screen) | `setStatus()` · `ask()` · `confirmBox()` · `alertBox()` · `menuPopup()` · `log()` |
| [Network](#39-network) | `fetch()` |

Symbols: 🔄 = the app removes it for you when the plugin is disabled/uninstalled/reloaded · ⏳ = returns a Promise

---

## 3.1 Information

### `k2.pluginName` : `string`

This plugin's folder name. Use it as the prefix of anything that must not collide with another plugin.

```js
const NS = 'k2-plugin-' + k2.pluginName;             // prefix for CSS classes / localStorage keys / event names
```

### `k2.appVersion` : `string`

The app's version, e.g. `"2.0.0-alpha.169"`.

```js
const alpha = Number((k2.appVersion.match(/alpha\.(\d+)/) || [])[1] || Infinity);
```

### `k2.projectRoot()` → `string | null`

The full path of the open project's folder · `null` = no project is open.

- It is **a path on the user's machine** (`C:\Users\…` / `/Users/…`). **Never write it into a project file**, and do not send it off the machine.
- Call it every time you need it; do not keep the value. The user can switch projects without your plugin being run again.

---

## 3.2 Commands and shortcuts

### `k2.registerCommand(label, fn)` → `true` 🔄

Adds a command for the plugin.

| Parameter | Type | |
|---|---|---|
| `label` | `string` | The name the user sees — short, starting with a verb ("Count words in this scene") |
| `fn` | `() => void \| Promise<void>` | Called when the user triggers it · it may throw (the error is caught and written to the Log) |

A command appears in 2 places:

1. **The plugin's card** in the Plugins panel ("Commands added")
2. The **Plugin Commands** button on the toolbar (the button appears once at least one plugin has registered a command; on a narrow bar it is under the » button)

```js
k2.registerCommand('Count words in this scene', () => {
  k2.setStatus(k2.getMarkdown().length + ' characters');
});

k2.registerCommand('Export a report…', async () => {      // async is fine
  if (!(await k2.confirmBox('Build the report?', 'Build'))) return;
  // …
});
```

- You can register more later (after an `await`, say) — the list is read live each time.
- A command has no id, and **there is no way to remove a single command**. Commands go away when the plugin is unloaded.
- A plugin **cannot add items to the system menu bar**.

### `k2.addMenuItem(label, fn)` → `true` 🔄

The old name of `registerCommand`. It behaves identically and is kept for older plugins. Use `registerCommand` in new code.

### `k2.registerShortcut(id, code, ctrl, shift, fn)` → `string` 🔄

Reserves a shortcut. Returns the channel name `plugin:<plugin name>:<id>`.

| Parameter | Type | |
|---|---|---|
| `id` | `string` | The shortcut's name within this plugin — registering the same id again replaces the old one |
| `code` | `string` | **`KeyboardEvent.code`** = the physical key position: `'KeyK'` · `'F8'` · `'Digit1'` · `'BracketRight'` · `'Slash'` — works with every keyboard layout |
| `ctrl` | `boolean` | **Must be `true`** (the default) — `Ctrl` on Windows/Linux · `⌘` on macOS |
| `shift` | `boolean` | `true` = `Shift` must be held as well |
| `fn` | `() => void \| Promise<void>` | Called when the keys are pressed |

```js
k2.registerShortcut('count', 'F8', true, true, () => report());      // Ctrl+Shift+F8
k2.registerShortcut('stamp', 'KeyJ', true, true, () => stamp());     // Ctrl+Shift+J ← a clash! see below
```

**Limitations in this version — read them all**

- **A plugin shortcut must always include `Ctrl`/`⌘`.** The app's shortcut handler only runs while Ctrl/⌘ is held. Pass `ctrl = false` and that shortcut **will never fire**.
- **`Alt` cannot be part of it.** A plugin shortcut only matches while Alt is *not* held (the usable sets are `Ctrl+key` and `Ctrl+Shift+key`).
- **A clash with one of the app's shortcuts = the app wins**, and the plugin's handler is not called — with no warning.
  Check the table in [Appendix B of the User Manual](../../manual/en/B-shortcuts.md) before choosing. Users can rebind the app's shortcuts, so always pair a shortcut with a command (`registerCommand`).
- Users **cannot rebind a plugin's shortcuts** (the Settings → Shortcuts page does not list them). If you want them to be changeable, build that as a setting of your plugin.
- Shortcuts still fire inside ordinary text fields — do not use combinations people press all the time while typing.

**Key sets that are usually free** (alpha.169 — always re-check against the real version): `Ctrl+Shift+F1…F12` · `Ctrl+F1…F12`

---

## 3.3 The editor

"The open editor" = the tab the user has selected, if it is a novel scene, a screenplay scene, or a memo. Wiki page tabs and the various panels have no editor of this kind.

### `k2.getMarkdown()` → `string`

The Markdown of the document in the open tab (the body only, without the file header) · no editor = `''`

- You get the content **as it is in the tab now**, including unsaved edits.
- For a screenplay you get the text with its line-prefix codes (`### ` `@` `>> ` …) — the syntax is in [Appendix D of the User Manual](../../manual/en/D-file-formats.md).
- It works synchronously. Calling it repeatedly on a very long document is slow; do not call it on every keystroke.

### `k2.insertText(text)` → `boolean`

Inserts plain text at the cursor (replacing the current selection) and marks the tab as unsaved · returns `false` if there is no editor.

- It is **one undo step** — the user can `Ctrl+Z` it.
- It inserts *text* into the current block: `\n` does not start a new paragraph, and Markdown marks (`**…**`) are not turned into formatting.
- To insert several paragraphs or formatting, use `getEditorView()` and build a transaction yourself.
- A **locked** scene, or the "original" view of a problem scene, is a read-only document. Do not try to edit it; tell the user instead.

### `k2.getEditorView()` → `EditorView | null`

The [ProseMirror](https://prosemirror.net/docs/ref/#view.EditorView) `EditorView` of the open tab.

```js
const view = k2.getEditorView();
if (view) {
  const { from, to, empty } = view.state.selection;
  const selected = view.state.doc.textBetween(from, to, '\n');     // the selected text
  // replace the selection with its upper-case form (one undo step)
  if (!empty) view.dispatch(view.state.tr.insertText(selected.toUpperCase(), from, to));
  view.focus();
}
```

Rules:

- **Change content only through `view.dispatch(tr)`.** Never touch the DOM inside `.ProseMirror` (adding classes/elements/styles): the paginator measures the real DOM, so the whole document would be thrown off, and whatever you added disappears when ProseMirror redraws.
- A transaction that changes the content marks the tab "unsaved" by itself and is one undo step. Combine several edits into one transaction so the user can undo them in one go.
- The schemas for novels and screenplays are **different** (a screenplay lacks some nodes/marks). Check `view.state.schema.nodes` before creating a node.
- Node/mark names in the schema are internal and **can change with any release**. Depend on them as little as possible, and test against every version you claim to support.
- Do not keep `view` over time — when the user switches tabs the view changes. Call `getEditorView()` afresh every time.

---

## 3.4 Panels

### `k2.registerPanel(id, opts)` → `string | null` 🔄

Registers a panel for the plugin. Returns the panel's real id (`plugin-<plugin name>-<id>`), or `null` if registration failed.

| `opts` | Type | Default | |
|---|---|---|---|
| `title` | `string` | `id` | The name on the panel header |
| `icon` | `string` | `'extension'` | The name of one of the app's icons (from the `icons/glyphs.csv` registry, e.g. `'chart'` `'note'` `'timer'` `'book'` `'image'` `'chat'` `'map'`) |
| `defaultSide` | `'left' \| 'right' \| 'bottom'` | `'right'` | The side it docks to the first time the user docks it |
| `closable` | `boolean` | `true` | The user can close the panel |
| `floatable` | `boolean` | `true` | The user can float it |
| `render` | `(host: HTMLElement) => void` | — | Draws the panel's content into `host` |

```js
let host = null;
function draw() {
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'myplug-body';
  el.textContent = 'Hello';
  host.replaceChildren(el);
}
k2.registerPanel('main', { title: 'My panel', icon: 'chart', render: (h) => { host = h; draw(); } });
```

Rules for `render`:

- **It can be called many times** (the panel is opened · moved · collapsed/expanded · the workspace changes), and `host` may be a new element each time → write it so that calling it again gives the same result (`host.replaceChildren(…)`), and keep the latest `host` so you can redraw yourself.
- The panel's state (data · scroll position · what the user typed) must live in **your plugin's variables**, not in the DOM.
- Attach listeners to elements **inside `host`** — they are collected with the DOM, so they need no removal in `onUnload`.
- Throwing in `render` = the error is caught and written to the Log, and the panel is left empty.
- A panel does not open by itself after registration — call `showPanel` when the user asks for it.

A plugin's panels can be docked, floated and tabbed like the built-in ones. When the plugin is disabled/uninstalled, its panels are closed and unregistered for you.

### `k2.showPanel(id)` · `k2.hidePanel(id)`

Opens/closes one of **your own** plugin's panels — pass the same `id` you gave `registerPanel` (no prefix needed).

```js
k2.registerCommand('Open my panel', () => k2.showPanel('main'));
```

> Do not open a panel on load or in response to an event. A panel that pops up by itself disrupts writing — let the user open it (the app remembers that the panel was open).

---

## 3.5 Events

The events themselves and the lifecycle are described in [chapter 4](04-hooks-lifecycle.md). This section gives the function signatures.

### `k2.on(event, handler)` → `() => void` 🔄

Listens for an event · returns a function that stops listening.

| Parameter | |
|---|---|
| `event` | The event name — one of the app's (`project:open` · `project:close` · `tab:activate` · `tab:save` · `plugins:loaded`) · a plugin's · or `'*'` = every event |
| `handler` | `(payload, eventName) => void` — the second argument is the event name (useful with `'*'`) |

```js
const off = k2.on('tab:save', (e) => k2.log('saved ' + e.title));
off();                                              // stop listening

k2.on('*', (payload, name) => k2.log(name));        // watch every event (for debugging)
```

- Passing a `handler` that is not a function does nothing (you get back an empty function).
- A handler that throws **does not affect the other listeners** — the error is written to the Log.
- Handlers are called **synchronously** at the moment the event happens. Heavy work in one makes the app stutter; defer it with `setTimeout`/`await`.
- An `async` handler works, but the app **does not wait** for it to finish, and errors in its Promise are not caught for you — wrap it in your own `try/catch`.

### `k2.off(event, handler)`

Stops listening, given the same handler (an alternative to the function `on` returns).

### `k2.emit(event, data)` → `number`

Sends an event to every plugin (including yourself) · returns the number of listeners that were called successfully.

```js
k2.emit(k2.pluginName + ':done', { minutes: 25 });
```

- Always name it `<plugin name>:<topic>`. **Never emit one of the app's event names** (`tab:save` and so on) — other plugins would believe it really happened.
- `data` should be plain data (convertible to JSON). Do not send DOM nodes/functions/an `EditorView`.

### `k2.onUnload(fn)` → `boolean` 🔄

Registers a cleanup function — `fn(why)` is called when the plugin is being unloaded.

| `why` | When |
|---|---|
| `'remove'` | It is being disabled · uninstalled · its folder has gone · the project that carried it is closing |
| `'reload'` | Its file changed and it is about to be replaced by the new version (which runs immediately afterwards) |
| `'error'` | The code threw during its first run (cleanups registered before the failure are called) |

- You can register several — they are called **in reverse order** of registration (the last registered is called first).
- **Throwing in a cleanup function = the app assumes the cleanup was incomplete** → it tells the user to restart the app, even if you declared `hotReload`.
- It runs synchronously and **does not wait for Promises** — finish cleaning up in one go.

---

## 3.6 Project files

Every function takes **a path relative to the project root**, with `/` as the separator, e.g. `'Wiki/characters/Tora.json'` · `'Reports/out.md'` · `'.'` = the project root.

| Path rule | Result |
|---|---|
| `\` is converted to `/` · a leading `/` is dropped | `'/Memos/a.md'` = `'Memos/a.md'` |
| It contains a `..` segment | **Refused**, and a warning is written to the Log |
| No project is open | Refused |

"Refused" = `readFile` returns `null` · `writeFile` returns `false` · `listDirs`/`listFiles` return `[]`

### `k2.readFile(rel)` → `Promise<string | null>` ⏳

Reads a file as UTF-8 text.

- `null` = the path was refused (see the table above)
- ⚠ **A file that does not exist = the Promise rejects** (it throws). It does not return `null`, and the app writes an error to the Log every time → **ask whether the file exists with `listFiles` first**, or wrap the call in `try/catch`.
- A file that starts with a BOM: the BOM comes with it — strip it yourself before `JSON.parse`.
- **Text only** — reading a binary file (image · zip · font) this way gives you corrupted bytes.

```js
async function hasFile(rel) {
  const i = rel.lastIndexOf('/');
  const names = await k2.listFiles(i < 0 ? '.' : rel.slice(0, i));
  return names.includes(i < 0 ? rel : rel.slice(i + 1));
}
async function readJson(rel) {
  if (!(await hasFile(rel))) return null;
  const txt = await k2.readFile(rel);
  try { return JSON.parse(txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt); } catch { return null; }
}
```

### `k2.writeFile(rel, text)` → `Promise<boolean>` ⏳

Writes text to a file (creating it, or **overwriting the whole file**).

- The write is atomic (a temporary file, then a rename) — a power cut mid-write never leaves half a file.
- **Folders that do not exist yet are created.**
- The write is recorded in the project's **activity history** — the user can go back from the Activity history panel.
- `text` is converted to a string · `false` = the path was refused · a real failure to write (disk full · locked) = the Promise rejects.
- **There is no API to delete/move/rename files** — deliberately.
- ⚠ **Do not overwrite the user's work files** (scene `.md` files · `scenes.json` · `draft.json` · `section.json` · `project.khn.json`) — see [chapter 6](06-data-and-files.md#63-files-you-must-not-overwrite).

### `k2.listDirs(rel)` → `Promise<string[]>` ⏳

The **names** of the sub-folders one level down in `rel` (not full paths · not recursive) · a folder that does not exist = `[]`

### `k2.listFiles(rel, ext?)` → `Promise<string[]>` ⏳

The **names** of the files one level down in `rel` · `ext` = filter by the end of the name, e.g. `'.md'` `'.json'` (case-sensitive) · a folder that does not exist = `[]`

Both filter out the operating system's junk files for you (such as macOS's `._name` files · the app's own temporary files). The order of the list is whatever the file system gives — sort it yourself if order matters.

```js
// walk the whole tree (mind the big folders: Backups/ Snapshots/ .k2history/ Recycle/)
const SKIP = new Set(['Backups', 'Snapshots', '.k2history', 'Recycle', 'Plugins']);
async function walk(dir, out = []) {
  for (const f of await k2.listFiles(dir, '.md')) out.push(dir === '.' ? f : dir + '/' + f);
  for (const d of await k2.listDirs(dir)) if (!SKIP.has(d)) await walk(dir === '.' ? d : dir + '/' + d, out);
  return out;
}
```

---

## 3.7 Plugin settings

Stored in `project.khn.json → settings.plugins["<folder name>"]`. They **belong to the project**: each project has its own values, and they travel with the project folder.

### `k2.getSettings(key?, def?)`

| Call | You get |
|---|---|
| `getSettings('key', def)` | The value of `key` · absent = `def` |
| `getSettings()` | A copy of the whole settings object |

### `k2.setSettings(key, value)` · `k2.setSettings(object)` → `true`

Writes values (merged with what is there) — saved to the project file after a short delay.

```js
const opts = { minutes: 25, sound: true, ...k2.getSettings() };     // defaults + what the user set
k2.setSettings('minutes', 30);
k2.setSettings({ minutes: 30, sound: false });                      // several values at once
```

Worth knowing:

- You can store only **things that convert to JSON**. Keep it small (this file is read and written often) — write bulky data to a file of your own with `writeFile`.
- ⚠ **Never store secrets** (API keys · tokens · passwords). Project files get passed around, backed up and committed to Git.
- ⚠ **Never store a full machine path** (`C:\Users\…`). Convert it to a path relative to the project root first.
- With no project open, values exist in memory only.
- **User-level settings** (shared across every project): use `localStorage` with a prefixed key.

  ```js
  const KEY = 'k2-plugin-' + k2.pluginName + ':prefs';
  const prefs = JSON.parse(localStorage.getItem(KEY) || '{}');
  localStorage.setItem(KEY, JSON.stringify({ ...prefs, minutes: 30 }));
  ```

  (`localStorage` lives in that machine's user-data folder · it is not cleared when the plugin is uninstalled — remove it yourself if you want to.)
- When a plugin is uninstalled, its settings in the project file are **not deleted** (reinstall it and the old values are still there).

---

## 3.8 The screen

### `k2.setStatus(text)`

A message on the status bar (bottom left). It fades by itself after a few seconds, and is read aloud by screen readers.

- Use it to report **the result of what the user just asked for** — short, one line.
- A message is replaced by the next one at once. Inside a `tab:save` handler, your message is overwritten by the app's own "saved" message ([4.1](04-hooks-lifecycle.md#tabsave)).
- Do not use it for rapid progress updates, and do not overwrite it when the user has not asked for anything.

### `k2.ask(title, options?)` → `Promise<string | null>` ⏳

A dialog asking for one piece of text.

| `options` | Default | |
|---|---|---|
| `value` | `''` | The starting value in the box (selected in full, ready to type over) |
| `placeholder` | `''` | The hint shown in an empty box |
| `okLabel` | The app's OK label | The label of the primary button |
| `allowEmpty` | `false` | `true` = OK may be pressed while the box is empty (returns `''`) |
| `multiline` | `false` | A multi-line box — `Enter` starts a new line · `Ctrl+Enter` = OK |

Returns the text **with leading and trailing whitespace trimmed** · `null` = the user cancelled (the cancel button · `Esc` · clicking outside the dialog) **or pressed OK while the box was empty** (when `allowEmpty` is not on).

```js
const name = await k2.ask('Name of the new tag', { placeholder: 'e.g. action' });
if (name == null) return;                      // cancelled
```

### `k2.confirmBox(title, okLabel?)` → `Promise<boolean>` ⏳

A confirmation dialog — a cancel button + a primary button (labelled `okLabel`; the default label is "Delete" and the button is styled as dangerous) → `true` when the primary button is pressed.

- **Always pass `okLabel`**, matching what is about to happen (`'Overwrite'` · `'Export'`) — otherwise the button will say "Delete".
- Use `\n` for a line break in the message.

### `k2.alertBox(text)` → `Promise<boolean>` ⏳

A message dialog; the same text is also written to the status bar.

> **Behaviour in alpha.169**: this uses the same confirmation dialog as `confirmBox` — it has a cancel button and a primary button whose label reads "Plugins", not a lone "OK" button. For a short message that needs no answer, use `k2.setStatus`. If you need a dialog with the right button label, use `k2.confirmBox(text, 'OK')`.

### `k2.menuPopup(items, x?, y?)`

Opens a pop-up menu at window coordinates (default 80, 80). The menu closes by itself when an item is chosen or the user clicks elsewhere. It supports `↑` `↓` `Enter` `Esc`.

`items` = an array of objects, or `'-'` (a divider):

| Field | Type | |
|---|---|---|
| `text` | `string` | The label as **plain text** — always use this when the text comes from the user/a file |
| `label` | `string` | The label as **HTML** ⚠ — only for strings you wrote entirely yourself |
| `click` | `() => void` | What to do when chosen |
| `disabled` | `boolean` | A heading row / cannot be chosen |
| `checked` | `boolean` | Shows a tick (giving it a value makes the item a tick item) |
| `danger` | `boolean` | The danger colour |
| `swatch` | `string` | A colour swatch at the end of the row (a colour code · `''` = no colour) |
| `sub` | `() => items[]` | A submenu — it **must be a function** that returns the items |
| `title` | `string` | A tooltip |

```js
button.onclick = (ev) => {
  const r = button.getBoundingClientRect();
  k2.menuPopup([
    { text: 'Option A', click: () => pick('a') },
    { text: 'Option B', checked: current === 'b', click: () => pick('b') },
    '-',
    { text: 'More', sub: () => [{ text: 'Sub-item 1', click: more }] },
    { text: 'Reset', danger: true, click: reset },
  ], r.left, r.bottom + 4);
};
```

> ⚠ **`label` is inserted as HTML.** A scene title, a character name, or any text that comes from the user/a file/the network must use `text`; otherwise text containing `<` becomes a tag (an XSS hole).

### `k2.log(...args)`

Writes an info-level line to **the app's activity log** (the Log panel + the daily file on the user's machine), prefixed with `[plugin <name>]`. The arguments are converted to strings and joined with spaces.

- Objects must be `JSON.stringify`-ed by you (otherwise you get `[object Object]`).
- ⚠ **Do not log the content of the user's work, secrets, or links that contain keys** — users may paste the log into a public bug report.
- Log only what is needed. Lots of lines bury the ones that matter.

---

## 3.9 Network

### `k2.fetch(url, options?)` → `Promise<FetchResult>` ⏳

Makes an HTTP request through the app (so it is not subject to CORS).

| `options` | |
|---|---|
| `method` | `'GET'` (the default) · `'POST'` · … |
| `headers` | An object of headers |
| `body` | A string (e.g. `JSON.stringify(…)`) |

The result **never throws** — look at `ok`:

| Field of the result | |
|---|---|
| `ok` | `true` when the status is 2xx |
| `status` | The HTTP status code · `0` = the server was never reached |
| `body` | The response body, always as **text** — convert it yourself: `JSON.parse(r.body)` |
| `error` | (on failure) a short cause such as `fetch failed` · `timeout 180000ms` — the detail (e.g. `ENOTFOUND` · `ECONNREFUSED`) is in `body` |
| `netError` | `true` = it failed at the network level (no internet · host not found · bad certificate) |
| `timedOut` · `aborted` | It timed out (the default is 3 minutes) |

```js
const r = await k2.fetch('https://api.example.com/v1/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: 'search term' }),
});
if (!r.ok) { k2.setStatus('The request failed (' + (r.status || r.error) + ')'); return; }
let data; try { data = JSON.parse(r.body); } catch { k2.setStatus('The reply is not JSON'); return; }
```

- **Text only** — binary files (images · zips) cannot be downloaded.
- There is no streaming; you get the whole reply when it has finished.
- The request goes straight from the user's machine. **Tell users plainly what your plugin sends and where** ([chapter 7](07-security.md#74-what-plugin-authors-should-do)).
- The browser's own `fetch` (`window.fetch`) exists too, but is blocked by CORS on most servers — use `k2.fetch`.

---

## 3.10 What `k2` does not have (in this version)

| You want to | State | Alternative |
|---|---|---|
| Run one of the app's commands (open a built-in panel · save · export) | Not in `k2` | — (internal names can change with any release; do not call them yourself) |
| Open a file/scene in a tab | Not available | Tell the user to open it |
| Know when the selection changes / when the user types | No event | `getEditorView()` + check when the user asks · or light polling (remember to clean up) |
| Add items to the context menu of a document/the Explorer | Not available | A command + a shortcut |
| Add buttons to the toolbar/format bar | Not available (there is the combined "Plugin Commands" button) | Your plugin's own panel |
| Add an export format / a workflow step | Not available | Write the file yourself with `writeFile` · users can use the "Custom JavaScript" step ([10.5](10-other-extension-points.md#105-export-workflows-and-shortcodes)) |
| Delete/move files · read files outside the project · binary files | Not available | — |
| Call the user's AI | Not available | `k2.fetch` to a service the user gives your plugin a key for |
| User-level settings | Not available | `localStorage` |
| Text in several languages | No helper | Your plugin's own string table ([5.6](05-ui-guidelines.md#56-multiple-languages)) |

> Other variables on `window` (such as `kapi`) are visible from plugin code, but **they are not part of the SDK**. They are undocumented, can change with any release without notice, and bypass `k2`'s safety rules (such as staying inside the project folder). A plugin that uses them will break silently when the app updates, and will not meet the criteria for a recommended list ([chapter 9](09-store-submission.md)).

---

Next: [4. Hooks and lifecycle →](04-hooks-lifecycle.md)
