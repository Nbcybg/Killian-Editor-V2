# 8. Packaging and distribution

**Language:** English · [ภาษาไทย](../th/08-packaging-distribution.md)

[← 7. Security and trust](07-security.md) · [Overview](README.md) · Next: [9. Publishing, and the "plugin store" →](09-store-submission.md)

---

The "package" of a Killian 2 plugin is **a folder containing `plugin.json` and one ready-to-run JavaScript file**. There is no special file format, and the app has no "build a package" step.
Distribution means getting that folder to the user: through **a GitHub link** (the app downloads it) · **a zip file** · or **placing it in a project folder**.

## 8.1 What the app's installer does

When the user presses **Install from link** in the Plugins panel:

```
1. Turn what was pasted into the address of a zip
     https://github.com/user/repo               → try branch main, then master
     https://github.com/user/repo/tree/dev      → branch dev
     https://github.com/user/repo/tree/dev/sub  → branch dev + subfolder sub
     user/repo                                  → the same as the first line
     https://…/x.zip                            → that file directly (http/https only)

2. Download the zip (limit 25 MB)
     GitHub: from codeload.github.com/<user>/<repo>/zip/refs/heads/<branch>

3. Find the "plugin root" inside the zip
     = the folder of the "shallowest" plugin.json
     (a subfolder was given → restricted to the folder ending in that name)

4. Select files: only those under the plugin root
     dropped: .git/  .github/  node_modules/  __MACOSX/  .DS_Store  Thumbs.db
     paths that escape the destination folder are refused

5. Name the destination folder
     = the name of the folder plugin.json is in
     at the repository root → the repository name, with a trailing "-main"/"-master" removed
     characters a file system will not accept are dropped · spaces → "-" · at most 60 long

6. Ask the user: "Install into folder <name> — N files" + the warning about access
     a folder of that name already exists → ask again to confirm overwriting

7. Write the files into <user data>/Plugins/<name>/  → load the plugin → it works at once
```

What this means for how you lay out your repository:

| Fact | So do this |
|---|---|
| The app downloads **the zip of a branch**, not the files of a Release | **The runnable file must be in the branch.** If you build from several files, commit the build output (e.g. `main.js` or `dist/main.js`). |
| No branch given = try `main`, then `master` | Your main branch should be called `main` (or `master`) and be **always ready to use** — keep unfinished work on another branch |
| The destination folder name = the repository name (when `plugin.json` is at the root) | **The repository name = the plugin's identity.** Choose it well from the start; changing it later = users get a new plugin. |
| ⚠ That name comes from **the zip's wrapper folder** (`<repo>-<branch or tag>`), and the app strips only `-main` / `-master` | `plugin.json` at the repository root + installing from another branch or a tag's zip → a folder named `repo-dev` / `repo-1.3.0` = **a different plugin** from the one installed from main (settings do not follow · two copies may run side by side) → if you will distribute several branches/tags, use **layout B** (a subfolder named after the plugin), whose name is always stable |
| The whole folder containing `plugin.json` is installed | Keep it small — source, tests and screenshots make the zip big and write a lot of files to the user's machine (see [8.2](#82-recommended-repository-layouts), layout B) |
| Installing over the top = **files are overwritten; old files are not deleted** | Do not count on "a file deleted from the repository disappears from the user's machine". Only the one `entry` file is run, so leftover old files have no effect — but if you move `entry`, change it in the same release as `plugin.json`. |
| The 25 MB limit | A plugin should not be anywhere near that — no `node_modules`, no large media |
| It always goes into the User folder | If it should belong to a project, the user moves the folder themselves |

## 8.2 Recommended repository layouts

### Layout A — one file, no build (the simplest)

```
k2-word-count/                 ← repository name = the installed folder name
├─ plugin.json
├─ main.js
├─ README.md
├─ LICENSE
└─ CHANGELOG.md
```

Install link: `https://github.com/you/k2-word-count`

### Layout B — several source files + a build · a separate installed folder

```
k2-word-count/
├─ plugin/                     ← the plugin root (what the user gets)
│   ├─ plugin.json
│   └─ main.js                 ← the build output — committed
├─ src/                        ← source (not installed)
│   ├─ index.js
│   └─ count.js
├─ test/
├─ package.json                ← your build scripts (nothing to do with the app)
├─ README.md
└─ LICENSE
```

- The app picks the shallowest `plugin.json` = `plugin/plugin.json` → only the `plugin/` folder is installed.
- ⚠ The destination folder will be named **`plugin`** (the name of the folder `plugin.json` is in), which can clash with someone else's — **name that folder after your plugin**:

```
k2-word-count/
├─ word-count/                 ← this is the name it installs under
│   ├─ plugin.json
│   └─ main.js
├─ src/ …
```

Install link: `https://github.com/you/k2-word-count` (the app finds `word-count/plugin.json` by itself)

### Layout C — several plugins in one repository

```
k2-plugins/
├─ word-count/   { plugin.json, main.js }
├─ focus-timer/  { plugin.json, main.js }
└─ README.md
```

- The link must name the subfolder: `https://github.com/you/k2-plugins/tree/main/word-count`
- ⚠ **Do not also put a `plugin.json` at the repository root** — the shallowest one wins when the user gives no folder.
- If no subfolder is given and several are at the same depth, the app picks the first alphabetically — always give the full link in your README.

### Files a repository should have

| File | Content |
|---|---|
| `README.md` | What it does · screenshots · **the install link** · how to use it · access and data ([7.5](07-security.md#75-what-authors-should-tell-users-in-the-readme)) · supported Killian versions · where to report problems — a template is in [9.5](09-store-submission.md#95-a-readme-template-for-a-plugin) |
| `LICENSE` | The licence for your code (MIT · ISC · Apache-2.0 …) — without one, other people have no legal right to use/modify/redistribute it |
| `CHANGELOG.md` | What changed in each version — users update by hand, and need to know whether it is worth it |
| `.gitignore` | `node_modules/` (but do **not** ignore the build output that has to be installed) |

## 8.3 Several files or TypeScript: bundle into one file

The app runs the entry file with `new Function('k2', code)` — there is no `import`/`require`. Several source files must first be combined into one file in **IIFE** format.

### esbuild (recommended — fast, little configuration)

```bash
npm init -y
npm install --save-dev esbuild
```

Your repository's `package.json` (the app does not read this file):

```json
{
  "scripts": {
    "build": "esbuild src/index.js --bundle --format=iife --target=chrome120 --outfile=word-count/main.js",
    "watch": "esbuild src/index.js --bundle --format=iife --target=chrome120 --outfile=word-count/main.js --watch"
  }
}
```

```js
// src/index.js
import { countWords } from './count.js';       // imports between your own files — fine
// k2 is a variable the app passes in at run time — just use it; do not import it
k2.registerCommand('Count words', () => k2.setStatus(countWords(k2.getMarkdown()) + ' words'));
```

The important points:

| Flag | Why |
|---|---|
| `--bundle` | Combines every import into one file |
| `--format=iife` | Wraps it in a function that runs immediately — no `import`/`export` is left in the output · `k2` is still visible because it is a variable of the enclosing scope |
| `--target=chrome120` | The app uses a recent Chromium — no need to transpile the syntax down |
| No `--platform=node` | A plugin runs in a browser; there is no Node.js |
| Libraries from npm | Fine if they are pure browser libraries (no reliance on `fs` `path` `process`) — they are bundled in |
| `--minify` | **Not recommended** — users/reviewers should be able to read the code that will run. File size is not an issue. |
| `--sourcemap` | Not needed (the code runs through `new Function`, so source maps are not matched up) |

While developing: point `--outfile` **straight into your user plugins folder** (or make a symlink/junction) and use `--watch` — edit the source → the file is built → press **Reload** in the panel.

### TypeScript

```bash
npm install --save-dev esbuild typescript
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noEmit": true, "lib": ["ES2022", "DOM"]
  },
  "include": ["src", "k2.d.ts"]
}
```

1. Copy this guide's [`k2.d.ts`](../k2.d.ts) into your repository — it declares the `k2` variable and all its types.
2. `esbuild src/index.ts --bundle --format=iife --target=chrome120 --outfile=word-count/main.js` (esbuild strips the types; it does not check them)
3. Check the types separately: `npx tsc --noEmit`

Even without TypeScript you benefit from `k2.d.ts`: put it next to `main.js` and add as the first lines

```js
/// <reference path="./k2.d.ts" />
// @ts-check
```

VS Code will then autocomplete `k2` and warn about types.

### Supporting data files

A plugin has no API for reading files in its own folder — bundle the data in:

```js
import words from './stopwords.json';          // esbuild bundles JSON for you
import css from './style.css';                 // needs a loader: --loader:.css=text
import icon from './icon.svg';                 // --loader:.svg=text (used as the innerHTML of an element you create — the file's content is yours, not user data)
```

Small images: `--loader:.png=dataurl`. Large media should not be in a plugin.

## 8.4 Version numbers

Use [Semantic Versioning](https://semver.org/) in the `version` field of `plugin.json`:

| The change | Increment | Example |
|---|---|---|
| A bug fix that does not change behaviour users rely on | PATCH | `1.2.0` → `1.2.1` |
| A new capability; existing ones still work | MINOR | `1.2.1` → `1.3.0` |
| A change that breaks something existing (the shape of stored data · the name of an event you emit · removing a command · moving `minAppVersion` across a major version) | MAJOR | `1.3.0` → `2.0.0` |
| Not stable yet | `0.x.y` | `0.4.0` |

- The app **shows** `version` on the card but **compares it with nothing** (there is no automatic updating). The version number is there so that you and your users can understand each other.
- For every release: change `version` → write the CHANGELOG → commit → **tag it** (`v1.3.0`) → push. A tag lets a user install a specific version through the tag's zip link: `https://github.com/you/repo/archive/refs/tags/v1.3.0.zip` (this works properly when `plugin.json` is in a subfolder named after the plugin — see the warning about the wrapper folder's name in [8.1](#81-what-the-apps-installer-does)).
- `minAppVersion`: set it to the lowest version you have **actually tested** — raise it when you use a new API ([2.2](02-anatomy.md#how-minappversion-is-compared) describes the limits of the comparison during alpha).

### Changing the shape of stored data

Values stored with `setSettings` stay in the user's project file across versions of your plugin:

```js
const DATA_VERSION = 2;
let data = k2.getSettings('data', null);
if (data && (data.v || 1) < DATA_VERSION) data = migrate(data);     // always able to read the old shape
function migrate(d) {
  if ((d.v || 1) === 1) d = { v: 2, items: (d.list || []).map((x) => ({ name: x, done: false })) };
  return d;
}
```

- Put a data version (`v`) in from your very first release.
- A new version must be able to read an old version's data · write it back in the new shape on the first edit.
- Users may go back to an older version — if you can avoid it, do not delete fields the old version needs.

## 8.5 Distribution channels

| Channel | What the user does | Suited to |
|---|---|---|
| **A public GitHub repository** | Pastes the repository link into "Install from link" | The main route — update by installing over the top from the same link |
| **The zip of a tag / Release** | Pastes the `.zip` link | Letting users pin a specific version |
| **A zip on your own website** | Pastes the `.zip` link (it must be `https://` and end in `.zip`) | Not using GitHub |
| **A zip file sent directly** | Unpacks it and puts the folder in `Plugins/` → Reload | Internal teams · offline |
| **Inside a project folder** (`<project>/Plugins/<name>/`) | Opens the project → allows it | Tools specific to a project/team — they travel with the project's zip/Git |

Limits of "Install from link":

- Only **GitHub** and **direct `.zip` links** are supported (GitLab · Bitbucket · Codeberg: use the branch/tag zip download link that ends in `.zip`).
- **A private repository cannot be installed from a link** (the app sends no credentials) — place the folder by hand.
- The zip must contain a `plugin.json` — the "Source code" zip that GitHub generates works.

### Making a zip yourself

```
word-count-1.3.0.zip
└─ word-count/
    ├─ plugin.json
    └─ main.js
```

- The top level of the zip is **a folder named after the plugin** (that name becomes the installed folder name). If you put `plugin.json` at the root of the zip and it is installed through a direct zip link, the folder name falls back to the default, `plugin`.
- Use `/` in file paths (ordinary zip tools already do).
- No `node_modules` · `.git` · hidden system files.

## 8.6 Updating a plugin

**There is no automatic updating and no notification of new versions.** The cycle in this version is:

1. You push a new version to the main branch.
2. The user presses **Install from link** with the same link → confirms the overwrite.
3. The app sees that the file changed → unloads the old version (`onUnload('reload')`) → runs the new one. For a plugin that does not declare `hotReload` → the user is told to restart the app.

What you can do so users know there is a new version:

- Ask them to press **Watch → Releases** on the repository (GitHub emails them when you publish a Release).
- Put the current version number prominently in the README.
- ⚠ **Do not build a version checker that quietly contacts the internet** into your plugin. It goes against "send nothing off the machine that the user did not ask for". If you have one, make it a command the user runs themselves ("Check for a new version of this plugin"), and say so in the README.

Making updates smooth:

- The folder name/repository name **must stay the same** — changing it = the user ends up with two plugins, and the old settings do not follow.
- The new version reads the old version's data ([8.4](#changing-the-shape-of-stored-data)).
- Declare `hotReload` if you clean up completely — users can update and carry on at once.
- Put how to update and how to go back a version (the zip link of the previous tag) in the README.

## 8.7 Uninstalling

The user presses **Uninstall** on the card → the app deletes the plugin's folder **permanently** (it does not go to the trash).

| Deleted | **Not** deleted |
|---|---|
| The plugin's folder | The settings in each project's `project.khn.json → settings.plugins[<name>]` |
| | The `localStorage` the plugin wrote |
| | Files the plugin created in projects (`Reports/` · `PluginData/<name>/`) |

Be a plugin that uninstalls cleanly: say in the README what the plugin leaves behind and where. If it suits, offer a command "Clear this plugin's data" (remove the `localStorage` keys and reset the `setSettings` values to empty — a plugin cannot delete files, so tell the user to delete the folder themselves).

## 8.8 Pre-release checklist

**Package**

- [ ] `plugin.json` is valid JSON · it has `name` `version` `description` `author` `minAppVersion` `homepage`
- [ ] `entry` points to a file that really exists in the plugin folder · no `..`
- [ ] The entry file runs on its own (no `import`/`require` left) — open the file and look
- [ ] The build output is committed · the main branch is in a ready-to-use state
- [ ] `version` matches the tag and the CHANGELOG
- [ ] No `node_modules` · large test files · secrets · paths from your own machine in the folder that gets installed

**Test a real install** (on a clean profile — [11.4](11-debugging-testing.md#114-a-test-profile-separate-from-your-real-one))

- [ ] Install from your own repository link → the folder name is right · the number of files is reasonable · the card says "active"
- [ ] Install over the previous version → it carries on, with nothing duplicated · the old data is still readable
- [ ] Disable → Enable · Uninstall → install again
- [ ] Switch projects · no project open · no document open

**Behaviour**

- [ ] The checklists in [5.10](05-ui-guidelines.md#510-look-and-feel-checklist) (look and feel) and [7.4](07-security.md#74-what-plugin-authors-should-do) (security)
- [ ] If you declare `hotReload`: after disabling, no timer, listener, element or style of the plugin is left ([11.3](11-debugging-testing.md#113-checking-that-cleanup-is-complete))
- [ ] The Log panel has no error/warn lines from the plugin during normal use

---

Next: [9. Publishing, and the "plugin store" →](09-store-submission.md)
