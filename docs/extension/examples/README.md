# Example plugins

**Language:** English · [ภาษาไทย](README.th.md)

[← Extension Guide](../en/README.md)

Three plugins that **really work**. Each was installed and run against Killian 2 alpha.169 (every command run · the panel opened · a scene saved · the shortcut pressed · disabled and enabled again without restarting the app), in both the English and the Thai interface, before it went into this guide.

All three carry **text in two languages** (English/Thai), chosen from the interface language — a worked example of the string table in [5.6](../en/05-ui-guidelines.md#56-multiple-languages). The comments in the code are in English.

![The Plugins panel with all three examples installed](../en/img/panel-plugins.webp)

| Folder | What it does | What it teaches | Read alongside |
|---|---|---|---|
| [`word-count-on-save/`](word-count-on-save/) | Counts words every time you save · a summary panel · a command · the shortcut `Ctrl+Shift+F8` | Panels (`registerPanel` + a `render` that can be called again) · the `tab:save` / `project:open` events · per-project settings · turning a full path into a relative one | [Chapter 3](../en/03-sdk-reference.md) · [chapter 4](../en/04-hooks-lifecycle.md) |
| [`focus-timer/`](focus-timer/) | Counts down a writing round with a floating badge · the shortcut `Ctrl+Shift+F9` | Things created outside `k2` (`setInterval` · an element on `<body>` · a `<style>` · a `window` listener) and cleaning them all up = the condition for `"hotReload": true` · a user-level value in `localStorage` · emitting the plugin's own event | [4.3](../en/04-hooks-lifecycle.md#43-lifecycle-and-hotreload) · [11.3](../en/11-debugging-testing.md#113-checking-that-cleanup-is-complete) |
| [`manuscript-report/`](manuscript-report/) | Walks every book/chapter/scene and writes a word-count report to `Reports/manuscript-report.md` | The file API (`listDirs` · `listFiles` · `readFile` · `writeFile`) · reading the project's registry files read-only · a long `async` job · asking before overwriting | [Chapter 6](../en/06-data-and-files.md) |

## Try them

1. Start Killian 2 → open a test project (never use a real manuscript when trying out plugins)
2. Open the Plugins panel (`Ctrl+Alt+E`) → **⋯ → User folder**
3. Copy **the whole folder** of the example you want (e.g. `word-count-on-save/`) into that folder
4. Back in the panel → **Reload** → the plugin's card appears with its list of commands
5. Press a command on the card, or use the **Plugin Commands** button on the toolbar

To remove one: **Uninstall** on the card (all three declare `hotReload` — no restart needed).

## Use one as a starting point

Copy a folder, then **rename the folder** (= the plugin's identity — see [chapter 2](../en/02-anatomy.md)), edit `plugin.json` (`name` · `author` · `description` · `homepage`), and start changing `main.js`.

What you must change when adapting one:

- **The shortcuts** — the examples use `Ctrl+Shift+F8` / `F9`; two plugins that reserve the same key will fight over it
- **The output file name** (`Reports/manuscript-report.md`) and the settings keys — make them your plugin's own
- **The CSS class prefixes** (`wcs-` · `ft-`) — they must not collide with another plugin's
- If you add things created outside `k2` and do not clean them all up, **remove `"hotReload": true`**. Over-claiming leaves users with leftovers and no warning.

## Limitations the examples show on purpose

- `word-count-on-save` does not write its result to the status bar on save — the app's own "saved" message would overwrite it ([4.1](../en/04-hooks-lifecycle.md#tabsave)), so it shows it in the panel instead.
- `manuscript-report` asks whether a file exists with `listFiles` before calling `readFile` — a missing file makes `readFile` throw and puts an error line in the Log ([3.6](../en/03-sdk-reference.md#36-project-files)).
- `manuscript-report` counts from the files on disk — a scene that was edited but not saved is counted as last saved ([6.2](../en/06-data-and-files.md#a-file-on-disk-versus-what-the-user-sees-in-a-tab)).
- `manuscript-report` prints scene statuses exactly as they are stored in the file (the built-in statuses are stored under their Thai names) — the user's data is never translated.
- Word counts use `Intl.Segmenter` — close to, but not necessarily identical to, the app's own word counter.
- `description` in `plugin.json` can only be in one language (the app has no per-language description field yet), so the examples write it in English and say at the end which languages are supported.
- `focus-timer` uses `k2.confirmBox(text, 'OK')` for a plain message, because `k2.alertBox` has an oddly labelled button in alpha.169 ([3.8](../en/03-sdk-reference.md#38-the-screen)).

## Shorter examples

- A first plugin, step by step: [chapter 1](../en/01-quickstart.md)
- Cut-and-paste code by task: [chapter 12 — Cookbook](../en/12-cookbook.md)

## Licence

The files in this folder are part of the Killian 2 repository and are under the same licence as the repository (the `license` field of `package.json` at the repository root). They were written to be adapted into plugins of your own.
