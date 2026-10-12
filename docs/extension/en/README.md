# Killian 2 Extension Guide

**Language:** English · [ภาษาไทย](../th/README.md)

> For Killian 2 version **2.0.0-alpha.169 and later**
> For people who want to **extend** the app — write a plugin, distribute it to others, or customise the app with data files and no code at all.
> If you only want to install plugins, read [chapter 14 of the User Manual](../../manual/en/14-plugins.md).

## The kinds of extension Killian 2 has

| Kind | What it is | Do you write code? | Read |
|---|---|---|---|
| **Plugin** | A folder with a `plugin.json` + one JavaScript file — adds commands · panels · shortcuts · listens to app events · reads/writes files in the project · makes network requests | Yes (JavaScript) | Chapters 1–9 · 11–12 |
| **Language file** | `k2_<code>.csv` — adds a language or corrects a translation | No | [10.1](10-other-extension-points.md#101-language-files) |
| **Dictionary** | A `.txt` word list for the spell checker | No | [10.2](10-other-extension-points.md#102-spell-check-dictionaries) |
| **AI skill** | A `.md` file of standing instructions for the AI assistant | No | [10.3](10-other-extension-points.md#103-ai-skills-and-agents) |
| **Wiki template** | `templates.json` — the data fields of a Wiki category | No (JSON) | [10.4](10-other-extension-points.md#104-wiki-templates) |
| **Export workflow** | The sequence of export steps, including a "Custom JavaScript" step | Optional | [10.5](10-other-extension-points.md#105-export-workflows-and-shortcodes) |
| **Colour theme** | A colour set for the app shell | Requires a build from source | [10.6](10-other-extension-points.md#106-colour-themes) |

## Contents

### Part 1 — Writing a plugin
1. [Quick start: 10 minutes](01-quickstart.md) — your first plugin, from an empty file to seeing it work in the app
2. [Anatomy of a plugin](02-anatomy.md) — the folder · every `plugin.json` field · locations · how the app loads and runs it · statuses
3. [The SDK: the `k2` object](03-sdk-reference.md) — a reference for every function: parameters · return values · caveats · examples
4. [Hooks and lifecycle](04-hooks-lifecycle.md) — app events · `onUnload` · `hotReload` · when a restart is needed
5. [Look and feel](05-ui-guidelines.md) — theme colour variables · sizing · keyboard · multiple languages · what you must not do to the editor
6. [Working with project files and data](06-data-and-files.md) — reading the project structure · writing safely · storing settings
7. [Security and trust](07-security.md) — how much access a plugin has · permission · what authors should do

### Part 2 — Getting it to users
8. [Packaging and distribution](08-packaging-distribution.md) — repository layout · bundling several files into one · version numbers · installing from a link · updating
9. [Publishing, and the "plugin store"](09-store-submission.md) — the current state · channels · readiness criteria · a plugin page template

### Part 3 — Everything else
10. [Other extension points](10-other-extension-points.md) — languages · dictionaries · AI skills · templates · workflows · themes
11. [Debugging and testing](11-debugging-testing.md) — developer console · Log · a separate profile · test checklists
12. [Cookbook](12-cookbook.md) — short recipes you will use often

### Companion files
- [`k2.d.ts`](../k2.d.ts) — type definitions for `k2`, for TypeScript / editor autocompletion
- [`examples/`](../examples/README.md) — 3 example plugins that have been run against the real app

## The one-minute overview

```
my-plugin/
├─ plugin.json      ← name, version, and the file to run
└─ main.js          ← a plain script that receives one variable, k2
```

```js
// main.js
k2.registerCommand('Say hello', () => k2.setStatus('Hello from a plugin'));
k2.on('tab:save', (e) => k2.log('saved ' + e.title));
k2.onUnload(() => { /* clean up what you created yourself */ });
```

- Put the folder in `<user data>/Plugins/` and press **Reload** in the Plugins panel.
- The code runs in **the app's window** (Chromium) — the DOM API is available · there is no Node.js · no `import`/`require`.
- Distribute it by pushing to GitHub — a user pastes the repository link into the Plugins panel and it installs.

## Facts to know before you invest time

| Subject | State in alpha.169 |
|---|---|
| API stability | **alpha** — what is documented here will be kept where possible, but there is no backward-compatibility promise yet. Always use `minAppVersion`. |
| Module system | None — a single file, run with `new Function('k2', code)` (several files must be bundled first) |
| Sandbox | **None** — a plugin runs with the full rights of the app window ([chapter 7](07-security.md)) |
| Plugin store / review | **Does not exist yet** — distribute through GitHub or a zip file ([chapter 9](09-store-submission.md)) |
| Automatic plugin updates | Not yet — the user installs over the top from the same link |
| An npm package for the SDK | None — the SDK is the `k2` variable the app passes in at run time (types are in [`k2.d.ts`](../k2.d.ts)) |
| Items in the system menu bar | Plugins cannot add them — commands live on the plugin's card in the Plugins panel · under the "Plugin Commands" toolbar button · on shortcuts |
| Plugin settings | Stored **per project** (`project.khn.json`) — for user-level settings you use `localStorage` yourself |

## Sources of truth in the code

If this guide and the real behaviour disagree, trust the source, and report a documentation bug:

| Subject | File |
|---|---|
| The `k2` object | `pluginApi()` in `src/app.js` |
| Loader · permission · lifecycle | `loadPluginsNow()` · `unloadPlugin()` in `src/app.js` |
| Logic (manifest · fingerprint · reload plan · the sample plugin) | `src/plugins/plugin-core.js` (unit tests: `test/plugin-core.test.cjs`) |
| Install from link | `src/plugins/plugin-install.js` + the `plugins:*` channels in `main.js` |
| The Plugins panel | `src/plugins/plugin-panel.js` |
| The short, single-page reference (Thai) | [`docs/plugin-dev.md`](../../plugin-dev.md) |

> **For the app's maintainers**: when the `k2` API changes, update `pluginApi()` · `PLUGIN_API_DOC` · `docs/plugin-dev.md` · `03-sdk-reference.md` (both [English](03-sdk-reference.md) and [Thai](../th/03-sdk-reference.md)) and [`k2.d.ts`](../k2.d.ts) in the same commit.
