# 2. Anatomy of a plugin

**Language:** English · [ภาษาไทย](../th/02-anatomy.md)

[← 1. Quick start](01-quickstart.md) · [Overview](README.md) · Next: [3. The SDK: the `k2` object →](03-sdk-reference.md)

---

## 2.1 What a plugin consists of

```
my-plugin/                 ← the folder name = the plugin's identity
├─ plugin.json             ← required: the manifest
├─ main.js                 ← the file that is run (any name, given in "entry")
├─ README.md               ← optional: for people reading on GitHub
├─ LICENSE                 ← optional, but you should have one
└─ (other files)           ← installed alongside, but the app never reads them
```

The app reads only two files: `plugin.json` and the file `entry` points to. Other files in the folder are copied at install time, but **a plugin has no API for reading files in its own folder when it lives in the User folder** (the `k2` file API is confined to the project folder). Supporting data (tables · text · small images as data URLs) should therefore be bundled into the entry file.

### The folder name matters more than you might think

The folder name is used as:

| Used as | Form |
|---|---|
| The name **shown on the card** in the Plugins panel | `<folder name>` |
| `k2.pluginName` | `<folder name>` |
| The key for settings | `project.khn.json → settings.plugins["<folder name>"]` |
| The key for "disabled" | `settings.plugins.disabled["<folder name>"]` |
| The shortcut channel name | `plugin:<folder name>:<id>` |
| The panel id | `plugin-<folder name>-<id>` |
| The prefix in the log | `[plugin <folder name>]` |

→ **Renaming the folder = a new plugin.** The user's existing settings do not follow.
→ Use `kebab-case` names in English letters: `word-count` · `scene-stamps` — safe for every file system, for links, and for DOM ids.

> **Behaviour in alpha.169**: the `name` field in `plugin.json` is not displayed anywhere yet — the card in the panel shows the **folder name**. Always fill in `name` (it will be used once the app supports it), but give the folder a readable name too.

## 2.2 `plugin.json`

```json
{
  "name": "Word count on save",
  "entry": "main.js",
  "version": "1.2.0",
  "author": "Your name",
  "description": "Reports the word count every time you save, with a summary panel",
  "minAppVersion": "2.0.0-alpha.169",
  "homepage": "https://github.com/you/k2-word-count",
  "hotReload": true
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | Recommended | A readable name (see the note above) |
| `entry` | string | No | The file that is run · default `main.js` · a relative path inside the plugin folder (`dist/main.js` is fine) · it must **not** start with `/` or contain `..` |
| `version` | string | Recommended | Shown on the card (`v1.2.0`) — use semver ([8.4](08-packaging-distribution.md#84-version-numbers)) |
| `author` | string | No | Shown on the card |
| `description` | string | Recommended | Shown on the card — one sentence saying what the plugin does |
| `minAppVersion` | string | **Strongly recommended** | The minimum app version — below it the app **does not run** the plugin and the card says "too old" |
| `homepage` | string | No | A link to the repository/documentation |
| `hotReload` | boolean | No | `true` = you vouch that `k2.onUnload` cleans up completely → the plugin can be disabled/uninstalled/edited without restarting the app ([chapter 4](04-hooks-lifecycle.md#hotreload--the-authors-promise)) · it must be a real `true` (not `"true"`) |

Rules:

- It must be **a readable JSON object**. Unreadable / an array / not an object = the plugin counts as failed and is disabled automatically.
- Fields the app does not know are ignored (you can add your own, such as `repository` `license` `keywords` — see [9.4](09-store-submission.md#94-a-manifest-that-is-ready-for-a-recommended-list)).
- Save it as UTF-8.

### How `minAppVersion` is compared

The app compares **only the numbers before the `-`**, part by part:

| App version | `minAppVersion` | Does it run? |
|---|---|---|
| `2.0.0-alpha.169` | `2.0.0-alpha.169` | ✔ |
| `2.0.0-alpha.169` | `2.0.0-alpha.200` | ✔ ⚠ (the `-alpha.N` part is not compared) |
| `2.0.0-alpha.169` | `2.1.0` | ✘ too old |
| `2.1.0` | `2.0.5` | ✔ |

> During alpha, every version is `2.0.0-alpha.N` — so `minAppVersion` **cannot yet keep out an older alpha**. If your plugin depends on a recently added API, check at run time:
>
> ```js
> const alpha = Number((k2.appVersion.match(/alpha\.(\d+)/) || [])[1] || Infinity);
> if (alpha < 169 || typeof k2.onUnload !== 'function') {
>   k2.setStatus('This plugin needs Killian 2 alpha.169 or later');
>   throw new Error('needs alpha.169+');      // throwing = the plugin is disabled, rather than half-working
> }
> ```

## 2.3 Where plugins live

| | The **User** folder | The **Project** folder |
|---|---|---|
| Location | `<user data>/Plugins/<name>/` | `<project>/Plugins/<name>/` |
| Available in | Every project on this machine | That project — copy/zip the project and the plugin goes with it |
| Does the user have to allow it before it runs? | No (the user installed it by hand) | **Yes**, and again every time a file in the set changes ([chapter 7](07-security.md#73-permission-for-a-projects-plugins)) |
| "Install from link" puts it here | ✔ always | — |
| Suited to | General tools · development | Tools specific to a project/team |

`<user data>`: Windows `%APPDATA%\Killian 2\` · macOS `~/Library/Application Support/Killian 2/` · Linux `~/.config/Killian 2/`

- **The same name in both places → the project's copy wins**, and the user copy of that name **is not run at all** (its card shows "name clash").
- The `Plugins/dictionaries/` folder is reserved for the spell checker's word lists — it is not a plugin.
- The app looks only at **first-level folders** under `Plugins/` (it does not search nested folders).

## 2.4 How the app loads plugins

The loader runs when **a project opens**, and when the user presses **Reload / Enable / Disable / Install / Uninstall** in the Plugins panel. One pass at a time; passes never overlap:

```
1. Read what is on disk
   ├─ User folder    → list of folders → read every plugin.json + entry file
   └─ Project folder → the same + compute a "fingerprint" of the whole set
        └─ not allowed yet → everything in the set is "Needs permission" and is not run

2. Work out "which ones should be running"
   ├─ the user disabled it      → skipped (off)
   ├─ plugin.json is unreadable → failed → disabled automatically
   ├─ the app version is too low → skipped (too old)
   └─ a name clash              → the project's copy shadows the user's

3. Compare with what is running now (key = origin + plugin.json + code)
   ├─ identical to the letter     → left running, not run again
   ├─ changed / gone / disabled   → the old one is unloaded (onUnload is called → registrations removed)
   └─ new ones + changed ones     → run

4. Run:  new Function('k2', <contents of the entry file>)(k2)
   └─ it throws → what it had registered is removed → disabled automatically → written to the Log

5. Emit the plugins:loaded event
```

Consequences worth remembering:

- **The code runs once per "version of the file".** Pressing Reload when the file has not changed does not run it again (which prevents two copies stacking up).
- **Editing only `plugin.json` counts as a change** → the plugin is unloaded and run again.
- **Run order**: the order in which the file system returns the folder list (generally by name). **Do not rely on the order** — a plugin must work whether another loads before or after it (talk between plugins with events — [4.2](04-hooks-lifecycle.md#42-plugins-own-events)).
- **Switching projects**: user plugins whose files have not changed keep running without being run again — so a plugin's variables **carry over between projects**. Listen for `project:open` to load the new project's state. The old project's plugins are unloaded and the new project's are loaded.
- **"Disabled" is remembered per project** — the same plugin may be on in one project and off in another.

## 2.5 The environment the code runs in

```js
new Function('k2', code)(k2)
```

| Subject | The facts |
|---|---|
| Where it runs | The app's main window (the Chromium of Electron 43) — the same thread as the UI |
| Language | Modern JavaScript in full (ES2023+ · `async/await` · optional chaining · `Intl.Segmenter` …) |
| Modules | **No** `import` / `export` / `require` — one file, run as a script |
| Top-level `await` | Not available — wrap in `(async () => { … })();` |
| Variable scope | Inside the plugin's own function — top-level `const`/`let`/`function` do not collide with other plugins |
| Strict mode | Not turned on for you — you may put `'use strict';` on the first line (recommended) |
| DOM / Web APIs | All available: `document` · `fetch` (subject to CORS — use `k2.fetch`) · `localStorage` · `IndexedDB` · `Canvas` · `WebAudio` · `Intl` |
| Node.js | **None of** `fs` · `path` · `process` · `Buffer` · `require` |
| `window.alert/prompt/confirm` | Not available — use `k2.alertBox` · `k2.ask` · `k2.confirmBox` |
| Web Workers | Can be created from a Blob URL if the work is really heavy — remember to `terminate()` in `onUnload` |
| An error at the top level while running | The plugin is disabled automatically |
| An error in a callback (command · shortcut · event handler · `render`) | Caught and written to the Log — it does not get the plugin disabled |
| Heavy synchronous work | **Freezes the whole app** — break the work up with `await` |

### `this` and top-level variables

```js
'use strict';
const VERSION = '1.2.0';          // belongs to this plugin only
function helper() { /* … */ }     // likewise

window.myGlobal = 1;              // ✘ do not — it collides with the app/other plugins and lingers after uninstalling
```

If you really must hang something on `window` (so the console can call it, for instance), use a name with your plugin's prefix and `delete` it in `onUnload`.

## 2.6 Plugin statuses

| Status (badge on the card) | Code | When | Is the code run? |
|---|---|---|---|
| **Needs permission** | `untrusted` | It is in the project folder, and the file set has not been allowed yet | No |
| **error** | `err` | `plugin.json` is damaged · the entry file cannot be read · the code threw while running | It ran and failed (whatever it had registered is removed) |
| **too old** | `old` | `minAppVersion` is higher than the app version | No |
| **active** | `ok` | Loaded successfully | Yes |
| **off** | `off` | The user disabled it — or it failed earlier and was disabled automatically | No |

The panel orders cards: Needs permission → error → too old → active → off (within a group, by name).

**A plugin that fails is disabled automatically**, so that one plugin cannot stop the app from starting every time. After fixing the file, the user must press **Enable** on the card (pressing Reload alone just shows it as "off").

---

Next: [3. The SDK: the `k2` object →](03-sdk-reference.md)
