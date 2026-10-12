# 9. Publishing, and the "plugin store"

**Language:** English · [ภาษาไทย](../th/09-store-submission.md)

[← 8. Packaging and distribution](08-packaging-distribution.md) · [Overview](README.md) · Next: [10. Other extension points →](10-other-extension-points.md)

---

## 9.1 The current state — read this first

> **Killian 2 alpha.169 has no plugin store (marketplace), no central registry, no submission/review process, and no automatic plugin updates.**

What **really exists** in this version:

| Exists | Does not exist |
|---|---|
| Installing from a GitHub link / zip link in the Plugins panel | A page in the app listing plugins to choose from |
| Confirmation before installing + a warning about access | Searching for plugins from inside the app |
| Permission for plugins that come with a project | Review/endorsement by the app's maintainers |
| A card showing version · author · description | Ratings · reviews · download counts |
| | Signing / verifying the author |
| | Update notifications and automatic installs |
| | Sales / usage licensing |

This chapter is therefore in two clearly separate parts:

- **9.2–9.6** — how to publish a plugin **today** so that people can find it, install it and trust it (all of it really works)
- **9.7** — a **readiness checklist** a plugin should pass, in case an official list ever appears. It is good practice in its own right. **It is not a process that exists, and it is not a promise that there will be a store.**

## 9.2 Publishing today: 5 steps

### Step 1 — Make the repository installable with one link

Per [chapter 8](08-packaging-distribution.md): `plugin.json` + a runnable file on the main branch · repository/folder name = plugin name.
Test it: open Killian on a clean profile → the Plugins panel → **Install from link** → paste the repository link → it must show "active".

### Step 2 — Write the repository's front page (README)

Most people decide in the first 10 seconds. The top of the README must have:

1. **One sentence** saying what the plugin does
2. **A screenshot** or a short GIF
3. **The install link** in a code block (easy to copy) + the 3 lines of steps
4. **Access and data**: what it reads, what it writes, whether it uses the network
5. **The Killian versions it supports**

A full template is in [9.5](#95-a-readme-template-for-a-plugin).

### Step 3 — Make it findable on GitHub

Because there is no central registry yet, being found depends on the repository's own details:

| Setting | Recommendation |
|---|---|
| **Repository name** | Start with `k2-` or `killian2-`, e.g. `k2-word-count` — people can tell at a glance it is a Killian 2 plugin |
| The repository's **Description** | "Killian 2 plugin — <what it does>" |
| **Topics** | `killian2-plugin` (a shared tag recommended for everyone, so they can all be searched together) + `killian2` · `writing-tools` · the plugin's subject |
| **Website** | A link to documentation/a demo page (if any) |
| **License** | Pick from GitHub's list — it shows a badge on the repository page |

Users can search at `https://github.com/topics/killian2-plugin`

### Step 4 — Release in an orderly way

```bash
# 1) change version in plugin.json and write CHANGELOG.md
# 2) build (if you have a build) and commit the build output
git add -A
git commit -m "Release 1.3.0"
git tag v1.3.0
git push && git push --tags
```

Then create a **GitHub Release** from that tag, with release notes:

```markdown
## 1.3.0

### Added
- A panel summarising word counts per chapter

### Fixed
- Wrong word count when the scene is a screenplay

### Supports
- Killian 2 alpha.169 and later

### Updating
Plugins panel → Install from link → `https://github.com/you/k2-word-count` → confirm the overwrite
```

Users who pressed Watch → Releases get an email from GitHub — that is the "update notification" that exists today.

### Step 5 — Spread the word

- Put the repository link in the `homepage` field of `plugin.json` (it shows where the plugin comes from, and users can follow it to report problems).
- Share it in the writing/game-making communities you belong to, with the install link and a screenshot.
- Problems and requests about your plugin: open **Issues on your own repository** — say so in the README.

> **Do not open an Issue on the Killian 2 repository to promote a plugin or ask for it to be listed.** The project's Issues are used to track bugs reported from inside the app, and under the repository's policy Issues opened from outside are closed automatically.
> To propose something that needs fixing in the app itself (a missing API, for instance): use **Help → Report a bug…** in the app, or open a pull request.

## 9.3 Names, and not misleading people

- The plugin's and repository's name should **say what it does**, not who you are: `k2-word-count` beats `k2-super-tools`.
- **Do not use a name/logo that suggests it is official** ("Killian Official …"). Write "A plugin for Killian 2 by <you>".
- Do not reuse the name of an existing plugin (search the topic first). The same folder name = installing over someone else's.
- The names of other products you mention (file formats · services) are their owners' trademarks — mention them only to state compatibility.

## 9.4 A manifest that is ready for a recommended list

The app reads 8 fields of `plugin.json` ([2.2](02-anatomy.md#22-pluginjson)) and **ignores the rest** — so you can add more metadata without affecting how the plugin works. The fields below are **this guide's proposal**, so that a plugin can describe itself fully in one file (a future community indexing tool could read them). **This version of the app does not use them.**

```json
{
  "name": "Word count on save",
  "entry": "main.js",
  "version": "1.3.0",
  "author": "Your name",
  "description": "Reports the word count every time you save, with a per-chapter summary panel",
  "minAppVersion": "2.0.0-alpha.169",
  "homepage": "https://github.com/you/k2-word-count",
  "hotReload": true,

  "id": "k2-word-count",
  "repository": "https://github.com/you/k2-word-count",
  "license": "MIT",
  "keywords": ["statistics", "word count", "stats"],
  "languages": ["en", "th"],
  "permissions": {
    "reads": ["the text of the open scene", "the project's registry files"],
    "writes": [],
    "network": []
  }
}
```

| Proposed field | Meaning |
|---|---|
| `id` | A permanent identity = the installed folder name |
| `repository` · `license` | Where it comes from, and its licence |
| `keywords` · `languages` | For searching · the languages the plugin's UI supports |
| `permissions` | The author's **declaration** of what the plugin reads/writes/contacts. The app **does not enforce it** (there is no sandbox). Its value is as a promise to users that can be checked against the source. |

## 9.5 A README template for a plugin

````markdown
# Word count on save (k2-word-count)

A plugin for [Killian 2](https://github.com/Nbcybg/Killian-Editor-V2) — reports the word count every time you save, with a per-chapter summary panel.

![Screenshot](docs/screenshot.png)

## Install

1. Open Killian 2 → **View → Panels → Plugins**
2. Press **Install from link** and paste:

   ```
   https://github.com/you/k2-word-count
   ```
3. Confirm — the plugin starts working at once

Supports Killian 2 **alpha.169 and later** · current plugin version: **1.3.0** ([changelog](CHANGELOG.md))

## Usage

| Command | Shortcut | What it does |
|---|---|---|
| Count words in this scene | Ctrl+Shift+F8 | Shows the word count of the open scene on the status bar |
| Open the word-count panel | — | Opens the summary panel |

The commands are on the plugin's card in the Plugins panel, and under the "Plugin Commands" button on the toolbar.

## Access and data

- **Reads**: the text of the open scene
- **Writes**: no files
- **Network**: not used
- **Stores**: the word count of the latest save — per project (in `project.khn.json`)
- Can be disabled/uninstalled instantly, with no app restart

## Updating / uninstalling

- **Update**: install from the same link again and confirm the overwrite
- **Uninstall**: the "Uninstall" button on the card · the values the plugin stored in `project.khn.json` are not deleted (they have no effect once it is uninstalled)

## Problems and requests

Open an Issue on this repository, stating your Killian 2 version (see the window's title bar), the plugin version, and the lines from the **Log** panel that start with `[plugin k2-word-count]`.

## Development

```bash
npm install
npm run build        # → word-count/main.js
```

## Licence

MIT — see [LICENSE](LICENSE)
````

## 9.6 Looking after it once it is out

| Subject | Approach |
|---|---|
| Killian releases a new version | Test your plugin against it (read the app's CHANGELOG — the API can change during alpha), then update the "Supports" line in your README |
| The plugin breaks with a new version | Release a fix + raise `minAppVersion` if you use a new API · say in the README which plugin version goes with which Killian version |
| A bug report from a user | Ask for: both versions · steps to reproduce · the lines in the Log · **do not ask for their manuscript files** unless it is really necessary |
| You stop maintaining it | Say so at the top of the README · archive the repository — users should know that vulnerabilities will no longer be fixed |
| Handing it over to someone else | Transfer the repository (GitHub redirects the old links) — **the repository/folder name must stay the same** |
| A security vulnerability | Release a fix at once · state in the Release which versions are affected · users must update by hand, so spell it out |

## 9.7 Readiness checklist (recommended criteria)

> This list is an author's **self-certification**. Use it to check your plugin before announcing that it is "ready for general use". It is also a reasonable set of criteria for any recommended list that the community or the maintainers might create in future. **Nobody checks this list on your behalf yet.**

### A. Identity and metadata

- [ ] The folder/repository name is `kebab-case` in English letters, does not duplicate a known plugin, and will not change
- [ ] `plugin.json` is complete: `name` · `version` (semver) · `author` · `description` · `minAppVersion` · `homepage`
- [ ] There is a `LICENSE` · a `README.md` (per the template) · a `CHANGELOG.md`
- [ ] Every release has a `vX.Y.Z` tag matching `version`

### B. Installing and uninstalling

- [ ] It installs from the repository link on a clean profile, first time
- [ ] The zip that gets installed is < 1 MB (no `node_modules` · no large media)
- [ ] Installing over the previous version carries on working · the old data is readable
- [ ] After uninstalling, nothing of it still affects the app · the README says what data it leaves behind

### C. Scope and security ([chapter 7](07-security.md))

- [ ] It uses only `k2` — it does not touch the app's internals on `window` and does not depend on the app's DOM/classes
- [ ] It does not overwrite the user's work files · it does not read `ai-key.json`
- [ ] It does not contact the network unless the user asks · no telemetry · it does not download code to run
- [ ] Every piece of untrusted text goes through `textContent` / `text:`
- [ ] No secrets in the source · the user's secrets are in `localStorage` only
- [ ] The installed code is **readable** (not minified/obfuscated) and matches the source in the repository
- [ ] The README has an "Access and data" section that matches what the code really does

### D. Behaviour in the app

- [ ] Nothing appears by itself on load or while typing
- [ ] It does not touch the editor's DOM
- [ ] It does not slow the app down: no long synchronous work · no observers on the app's DOM · timers ≥ 1 second
- [ ] It behaves correctly when: no project is open · no document is open · the tab is a Wiki page · the project changes · the project is large
- [ ] Errors are reported to the user in plain language, with the details written to the Log
- [ ] It declares `hotReload` only if it really cleans up completely (tested per [11.3](11-debugging-testing.md#113-checking-that-cleanup-is-complete))
- [ ] Its shortcuts do not clash with the app's, and every shortcut has a matching command

### E. Look and accessibility ([chapter 5](05-ui-guidelines.md))

- [ ] Readable in the dark · light · high-contrast themes
- [ ] Follows the UI size, 75–200%
- [ ] Usable from the keyboard · has a focus ring · icon buttons have labels
- [ ] No state is signalled by colour alone
- [ ] Its text is available in at least English and Thai (following the interface language)

### F. Compatibility and upkeep

- [ ] Tested with the latest Killian 2, and with the version named in `minAppVersion`
- [ ] Tested on Windows (and macOS/Linux if you can) — especially file paths and shortcuts
- [ ] Stored data has a version number and a converter from older versions
- [ ] There is a channel for reporting problems, and the author responds

## 9.8 Why there is no store yet (the facts of this version)

A safe plugin store needs several things that this version's plugin system does not have. They are listed so that authors understand the limits — **this is not a roadmap and not a promise**:

| What is needed | State in alpha.169 |
|---|---|
| Enforceable limits on access (a sandbox) | None — a plugin runs with the full rights of the window |
| Verifying that the installed file is the file the author released (signing/checksums) | None |
| A plugin identity separate from the folder name | None — the folder name is the identity |
| Checking for and announcing updates | None |
| An API declared stable | Still alpha |
| A user-level settings store for plugins | None (settings and on/off are remembered per project) |

In the meantime, a plugin's credibility comes from what its author does: readable source · an honest README · an orderly release history · answering problems.

---

Next: [10. Other extension points →](10-other-extension-points.md)
