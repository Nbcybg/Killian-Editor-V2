# 11. Debugging and testing

**Language:** English · [ภาษาไทย](../th/11-debugging-testing.md)

[← 10. Other extension points](10-other-extension-points.md) · [Overview](README.md) · Next: [12. Cookbook →](12-cookbook.md)

---

## 11.1 The development loop

```
edit main.js  →  save  →  Plugins panel: "Reload"  →  try it  →  look at the Log / DevTools
```

- Develop in **the user plugins folder** — you do not have to allow the plugin again every time you edit a file (a plugin in a project folder must be allowed again whenever its files change).
- **Reload** runs only the plugins whose files changed: the old copy is unloaded (`onUnload('reload')`) and the new one runs at once.
- Until you declare `hotReload`, every Reload makes the panel show the "restart needed" notice. While developing you can ignore it **if you know what the old copy left behind**. If behaviour is odd (things happen twice · things are stacked), restart the app before concluding it is a bug.
- A plugin that throws while running is **disabled automatically**. After fixing it you must press **Enable** on the card (Reload alone just shows it as "off").
- Use a watch build ([8.3](08-packaging-distribution.md#83-several-files-or-typescript-bundle-into-one-file)): point the build output into your user plugins folder.

## 11.2 Tools for seeing what went wrong

### The Log panel — start here

`Ctrl+Alt+9` · **Help → Developer → App activity log…**

| What you see | Where it comes from |
|---|---|
| `[plugin <name>] …` | Your `k2.log(...)` |
| An error while loading a plugin (with the plugin's name) | The code threw while running · `plugin.json` is damaged |
| `plugin event <event name>` | One of your event handlers threw |
| `plugin panel <id>` | A panel's `render` threw |
| `plugin unload <name>` | A cleanup function threw (→ a restart is needed) |
| `plugin: unloaded { name, why, restart }` | A plugin was unloaded — look at `why` · `restart: true` = this one made a restart necessary |
| `plugin panel unregister <id>` | A plugin's panel could not be unregistered |
| Errors from `fs:readFile` and the like | `k2.readFile` was called on a file that does not exist |

Filter to the error/warning levels · copy the filtered lines · the daily log files are in `<user data>/logs/`.

```js
k2.log('state', JSON.stringify(state));        // objects must be stringified by you
```

### Chromium DevTools — for serious debugging

**Help → Developer → Open Chromium DevTools** is present when the app is in developer mode:

| How you run it | How to get developer mode |
|---|---|
| From source (`npm start`) | Already on |
| A distributed build (the portable `.exe` / `.dmg`) | Set the environment variable `KILLIAN_DEV=1` before starting the app |

```powershell
# Windows PowerShell
$env:KILLIAN_DEV = '1'; & "D:\Apps\Killian 2.exe"
```

```bash
# macOS / Linux
KILLIAN_DEV=1 /Applications/Killian\ 2.app/Contents/MacOS/Killian\ 2
```

In DevTools:

- **Console** — uncaught errors · your `console.log` calls (fine while developing; remove them before release)
- **Sources** — a plugin's code runs through `new Function`, so it shows up as an anonymous script. Give it a name with this as the last line of the file:

  ```js
  //# sourceURL=k2-plugin-word-count.js
  ```

  You will then see a file of that name in Sources, can set breakpoints in it, and stack traces point to it.
- A `debugger;` statement in the code = execution stops there while DevTools is open.
- **Elements** — inspect your panel's elements/styles · check the values of theme variables.
- **Performance** — see whether your work is eating frame time.

### The app's developer console

`Ctrl+Shift+\`` — a box for running commands inside the app (it is in every distributed build; developer mode is not required). `Ctrl+Enter` runs · `Ctrl+↑` recalls the previous command.

> ⚠ This console also has a variable called **`k2`, but it is a different object** from a plugin's `k2`. It is the app's own toolkit for inspecting internals when tracking down bugs (for example `k2.md()` · `k2.doc()` · `k2.cssVar('--bg')` · `k2.version`). **It is not the plugin API, it carries no stability promise, and it exists only in the console.** Use it to look at state while debugging, but never write a plugin that depends on it.

Useful to plugin authors:

```js
k2.cssVar('--accent')                          // the value of a variable in the current theme
k2.md().length                                 // the length of the active tab's Markdown
document.querySelectorAll('[class^="wcs-"]').length    // elements of your plugin still in the page
```

To call your own plugin's API from the console while developing, hang it somewhere temporarily:

```js
// in the plugin (remove before release)
window.__myplug = { k2, state, redraw };
k2.onUnload(() => { delete window.__myplug; });
```

## 11.3 Checking that cleanup is complete

Before you declare `"hotReload": true`, do every one of these:

1. Start the app afresh (a clean state) → use every feature of the plugin (open its panels · run every command · let its timers start)
2. The Plugins panel → **Disable** the plugin
3. Check in the DevTools Console:

   ```js
   // (a) none of the plugin's elements may remain
   document.querySelectorAll('[class*="wcs-"], [data-plugin="word-count"]').length;        // → 0

   // (b) no injected style may remain
   [...document.querySelectorAll('style')].filter((s) => s.textContent.includes('.wcs-')).length;   // → 0

   // (c) listeners on window/document must be back to what they were before the plugin was enabled
   //     (getEventListeners is a DevTools Console command)
   Object.fromEntries(Object.entries(getEventListeners(window)).map(([k, v]) => [k, v.length]));

   // (d) variables on window
   Object.keys(window).filter((k) => /myplug|wcs/i.test(k));                                  // → []
   ```

4. Timers: they cannot be enumerated from outside. Put a `k2.log` in the callback while testing, and watch that no new lines appear in the Log after you disable the plugin.
5. Press **Enable** again → use it once more → there must be **one set** of everything (commands not duplicated · panels not stacked · each event handled once per occurrence)
6. Change one character in the file → **Reload** → check items 3 and 5 again (the `'reload'` path)
7. Throughout all of this the Plugins panel must **not** show the "restart needed" notice (if it does although you declared `hotReload`, a cleanup function threw — look at the Log)

A technique for counting what you forgot to clean up: while developing, use the `track()` helper from [4.3](04-hooks-lifecycle.md#the-recommended-pattern-register-in-pairs) for **everything** you create outside `k2`. If everything goes through `listen()` / `every()` / `mount()`, nothing slips through.

## 11.4 A test profile separate from your real one

Test installing/uninstalling/defaults on **a separate set of user data**, so nothing touches the settings and plugins you really use. Set the environment variable `KILLIAN_USERDATA` to an empty folder:

```powershell
# Windows PowerShell — a clean profile at C:\k2-test-profile
$env:KILLIAN_USERDATA = 'C:\k2-test-profile'; $env:KILLIAN_DEV = '1'; & "D:\Apps\Killian 2.exe"
```

```bash
# macOS / Linux
KILLIAN_USERDATA=/tmp/k2-test-profile KILLIAN_DEV=1 npm start
```

- That folder gets its own `settings.json` · `Plugins/` · `sessions/` · `logs/` — delete the whole folder to start again.
- Pair it with **a test project** (never test a plugin that writes files against a real manuscript). Create one from a template in the app or, if you have the source, `node tools/demo-project.cjs <folder>` gives you a sample project with scenes · a Wiki · relationships · choices (its sample text is in Thai).
- Testing "a new user installs from the link": a clean profile → open the test project → the Plugins panel → install from your repository's link.

## 11.5 Testing logic outside the app

Split your code into two layers:

```
src/
├─ count.js      ← pure logic: takes data, returns results — never touches k2 / the DOM  → testable with Node
└─ index.js      ← glue: calls k2 · draws the DOM · registers things                    → tested in the app
```

```js
// src/count.js
export function countWords(md) {
  const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
  let n = 0;
  for (const s of seg.segment(String(md || ''))) if (s.isWordLike) n++;
  return n;
}
```

```js
// test/count.test.mjs — node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords } from '../src/count.js';

test('counts English and Thai words', () => {
  assert.equal(countWords('hello world'), 2);
  assert.ok(countWords('โทระเดินเข้าตลาด') >= 3);
  assert.equal(countWords(''), 0);
});
```

### A mock `k2` — testing the glue layer without starting the app

```js
// test/mock-k2.mjs
export function mockK2(files = {}) {
  const calls = { status: [], log: [], commands: [], panels: [], written: {} };
  const handlers = new Map();
  const settings = {};
  const k2 = {
    pluginName: 'test-plugin', appVersion: '2.0.0-alpha.169',
    projectRoot: () => '/project',
    registerCommand: (label, fn) => { calls.commands.push({ label, fn }); return true; },
    addMenuItem: (label, fn) => k2.registerCommand(label, fn),
    registerShortcut: (id) => 'plugin:test-plugin:' + id,
    registerPanel: (id, opts) => { calls.panels.push({ id, opts }); return 'plugin-test-plugin-' + id; },
    showPanel() {}, hidePanel() {},
    getMarkdown: () => files.__active || '', insertText: () => true, getEditorView: () => null,
    on: (ev, fn) => { (handlers.get(ev) || handlers.set(ev, new Set()).get(ev)).add(fn); return () => handlers.get(ev).delete(fn); },
    off: (ev, fn) => handlers.get(ev)?.delete(fn),
    emit: (ev, data) => { let n = 0; for (const fn of handlers.get(ev) || []) { fn(data, ev); n++; } return n; },
    onUnload: () => true,
    readFile: async (rel) => { if (!(rel in files)) throw new Error('ENOENT ' + rel); return files[rel]; },   // like the real thing: a missing file = a rejection
    writeFile: async (rel, text) => { calls.written[rel] = String(text); files[rel] = String(text); return true; },
    listFiles: async (dir, ext = '') => names(files, dir).files.filter((n) => n.endsWith(ext)),
    listDirs: async (dir) => names(files, dir).dirs,
    getSettings: (k, d) => (k === undefined ? { ...settings } : (k in settings ? settings[k] : d)),
    setSettings: (k, v) => { if (typeof k === 'object') Object.assign(settings, k); else settings[k] = v; return true; },
    setStatus: (t) => calls.status.push(t),
    ask: async () => null, confirmBox: async () => true, alertBox: async () => true, menuPopup() {},
    fetch: async () => ({ ok: false, status: 0, body: '', netError: true, error: 'mock' }),
    log: (...a) => calls.log.push(a.join(' ')),
  };
  return { k2, calls };
}
function names(files, dir) {
  const pre = dir === '.' || !dir ? '' : dir.replace(/\/+$/, '') + '/';
  const f = new Set(), d = new Set();
  for (const p of Object.keys(files)) {
    if (p.startsWith('__') || !p.startsWith(pre)) continue;
    const rest = p.slice(pre.length).split('/');
    (rest.length === 1 ? f : d).add(rest[0]);
  }
  return { files: [...f], dirs: [...d] };
}
```

```js
// check that the plugin (the built file) registers everything and works with k2
import fs from 'node:fs';
import { mockK2 } from './mock-k2.mjs';

const code = fs.readFileSync('word-count/main.js', 'utf8');
const { k2, calls } = mockK2({ __active: 'hello world' });
new Function('k2', code)(k2);                       // run it the way the app does
assert.ok(calls.commands.some((c) => c.label.includes('Count words')));
```

A mock `k2` helps catch mistakes in logic and wiring. **It does not replace testing in the real app** (themes · panels · lifecycle · timing).

## 11.6 A test table for the real app

| Situation | Expected |
|---|---|
| Open a project (the plugin is loaded) | Nothing appears by itself · no errors in the Log |
| No document open → run every command | A message to the user, not an error |
| The tab is a Wiki page → run every command | The same (`getMarkdown()` = `''` · `getEditorView()` = `null`) |
| A novel scene / a screenplay scene | Correct in both modes (a screenplay has line-prefix codes) |
| A locked scene | No attempt to edit |
| A very long scene (tens of thousands of words) | No freeze |
| A large project (hundreds of scenes) | Whole-project jobs stay responsive · can be cancelled |
| Switch to another project | The old project's data does not linger in the panel · settings are the new project's |
| Save · Save all · autosave | The `tab:save` handler is called the right number of times, without lag |
| Switch tabs rapidly | No stutter |
| Disable → Enable · Reload after editing the file | One set of everything, nothing stacked ([11.3](#113-checking-that-cleanup-is-complete)) |
| Uninstall → install again | Works like new · old values still readable |
| Light theme · High Contrast · UI size 200% | Readable, nothing overflows |
| The panel docked narrow · floating · torn off into a window | Draws correctly every way (`render` is called again) |
| Another interface language | The plugin's text follows it (if you support it) |
| No internet (if you use `k2.fetch`) | Tells the user, does not hang |
| A non-Latin keyboard layout (Thai, for instance) | Shortcuts still work (you use `code`, not the character) |

## 11.7 Common symptoms and causes

| Symptom | Likely cause |
|---|---|
| The card says "error": `Unexpected token` | The file has `import`/`export` (not bundled yet) · a syntax error · `plugin.json` has a trailing comma/a comment |
| `k2 is not defined` | `k2` was used from code running outside the plugin's function (a `<script>` you created · a Worker) — pass in the values it needs yourself |
| `Cannot read properties of null` when calling `getEditorView()` | No document is open — check for `null` first |
| A command/panel/event runs twice | A plugin without `hotReload` was reloaded and the old copy lingers · or there are two folders (with different names) of the same plugin |
| A shortcut does not work | It clashes with one of the app's · `ctrl = false` was passed · it is combined with Alt · the `code` is wrong (it must be `'KeyK'`, not `'k'`) |
| `k2.setStatus` in `tab:save` shows nothing | It is overwritten by the app's "saved" message — defer it with `setTimeout`, or show it in a panel |
| `readFile` throws | The file does not exist — ask with `listFiles` first |
| `readFile` / `listFiles` return `null` / `[]` although the file exists | The path contains `..` · it is a full path · no project is open |
| A value from `setSettings` is gone when another project is opened | Settings belong to the project — use `localStorage` for the user's values |
| The panel is empty after being moved/collapsed | `render` does not redraw from state (state was kept in the DOM) · it uses an old `host` |
| Wrong colours in some themes | Fixed colours · background/text paired wrongly (`--accent` must go with `--on-accent`) |
| The app lags when the plugin is on | A busy `MutationObserver`/timer · long synchronous work in an event handler · `getMarkdown()` every frame |
| Users have to allow it again often | The plugin is in a project folder and its files change (sync · a build overwriting them) |
| Installing from a link gives an odd folder name (`repo-dev` · `plugin`) | The name comes from the zip's wrapper folder — see [8.1](08-packaging-distribution.md#81-what-the-apps-installer-does) |

---

Next: [12. Cookbook →](12-cookbook.md)
