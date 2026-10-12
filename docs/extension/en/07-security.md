# 7. Security and trust

**Language:** English · [ภาษาไทย](../th/07-security.md)

[← 6. Working with project files and data](06-data-and-files.md) · [Overview](README.md) · Next: [8. Packaging and distribution →](08-packaging-distribution.md)

---

## 7.1 The security model in one sentence

> **A Killian 2 plugin does not run in a sandbox — it runs with the full rights of the app window. The user therefore has to "trust the author", and all the app does is make sure that decision is made knowingly.**

Users and authors alike should understand this the same way. A mobile-style permission system (asking for one capability at a time) **does not exist yet**.

## 7.2 What a plugin can really do

| Capability | Through `k2` (the supported way) | The reality of the environment |
|---|---|---|
| Read/write files | Text only · inside the project folder only · no delete/move | The code is in the same window as the app, so it can reach the app's internal bridge, which is not bound by `k2`'s limits |
| Network | `k2.fetch` to anywhere | There is no list of allowed domains for plugins |
| The screen | Panels · commands · dialogs | It can modify the DOM of the whole app · it can intercept key presses |
| The user's content | `getMarkdown` · `getEditorView` | It can read everything on screen and in the window's memory |
| Data on the machine | — | It can read the `localStorage` of the app and of other plugins |

The plain conclusions:

- `k2`'s limits (relative paths · no `..` · text only) are **a guard rail, not a wall**. They guard against the mistakes of an honest author; they do not stop a malicious one.
- Users should treat installing a plugin like **installing a program**.
- A good plugin stays within `k2` and nothing else — which can be checked by reading its source (one file, plain text).

## 7.3 Permission for a project's plugins

Plugins live in two places and are treated differently:

| | The user's (`<user data>/Plugins/`) | The project's (`<project>/Plugins/`) |
|---|---|---|
| How it got there | The user installed it (from a link → confirm · or by placing the folder) | It came with the project folder — **possibly from someone else** (a zip · sync · Git) |
| Runs when | A project opens | **Only after the user allows it** |

### The mechanism

1. When a project opens, the app reads the `plugin.json` + entry file of **every** plugin in `<project>/Plugins/` and computes **a fingerprint of the whole set** (folder name + a hash of the manifest + a hash of the code, for each one).
2. It compares that with the permission stored **on the user's machine** (`<user data>/sessions/` — tied to the project's path).
3. No match → everything in the set is **Needs permission**. **Not a single line of code is run.** The status bar reports the count. No dialog pops up to block the user (a dialog that appears by itself during loading tends to be clicked through unread).
4. The user opens the Plugins panel → **Allow this project's plugins** → a second confirmation dialog → the app records the current fingerprint → the plugins run.

### What follows from this

| Situation | Result |
|---|---|
| Someone adds/edits/replaces a plugin in the project folder (sync · unzipping over it · `git pull`) | The fingerprint changes → **the whole set must be allowed again** |
| **You edit a file yourself while developing** | The same — every time you save a file → it is more convenient to develop in the User folder |
| The user uninstalls one plugin from a set that was allowed | The rest stay allowed (removing code adds no risk) |
| The project folder is moved elsewhere / opened on another machine | It must be allowed again (permission is tied to the path and the machine) |
| The sender ships an "already allowed" file inside the project | It has no effect — permission is not stored in the project folder |
| Another file in the plugin folder (not the manifest/entry) changes | The fingerprint does not change — the app runs only the entry file, and the hash covers the code that is actually run |

The fingerprint is for detecting "did it change?" (a fast hash, not a cryptographic one). It is a mechanism for confirming the user's intent, not a digital signature of the author. **Plugins cannot be signed yet.**

### What it means for authors who ship a plugin with a project

- Tell recipients, in the project's documentation, which plugins are included, what they do, and where to press to allow them.
- The plugin must cope with "not run yet" — the project must open and work without the plugins.
- Updating a plugin inside a project = everyone who opens it has to allow it again.

## 7.4 What plugin authors should do

### Scope

- [ ] Use only `k2` — **do not touch the app's internal variables on `window`** (such as `kapi`), do not call internal functions, do not depend on the app's DOM structure/classes
- [ ] Do not read `ai-key.json` · do not read the `localStorage` of the app or of other plugins
- [ ] Do not overwrite the user's work files ([6.3](06-data-and-files.md#63-files-you-must-not-overwrite))
- [ ] Do not intercept key presses for the whole window beyond what your feature needs · do not record what the user types

### Network and the user's data

- [ ] **Send nothing off the machine that the user did not ask for** — no telemetry · no silent "update check" · no loading scripts/fonts/images from the internet at start-up
- [ ] If a feature has to send data: say in the README and on screen, **before** the first send, what is sent · where · and why — and make it possible to turn off
- [ ] Send only what is needed (the selected text, not the whole scene · the whole scene, not the whole book)
- [ ] Do not send full file paths, the machine's user name, or the project title
- [ ] Always use `https://`
- [ ] **Do not download code and run it** (`eval` · `new Function` on text from the internet · `<script src>`). What the user inspected and allowed must be what runs.

### Secrets

- [ ] An API key/token the user gives your plugin: store it in `localStorage` only — **not** `k2.setSettings` (it lands in the project file, which gets passed around) and not in a file in the project
- [ ] Use `<input type="password">` for secret fields (the app's "show pressed keys" aid never shows what is typed into a field of this type)
- [ ] Do not `k2.log` secrets, the content of the work, or URLs containing keys — users may paste the Log into a public bug report
- [ ] **No secrets of your own in the source.** A plugin's file is text that anyone can read. If you need a server-side key, run your own relay.

### Untrusted text

Text from **project files · the network · what the user types** is data, not code:

- [ ] Put it on screen with `textContent` — not `innerHTML` / `insertAdjacentHTML` / `outerHTML`
- [ ] `k2.menuPopup`: use `text:`, not `label:` (which is HTML)
- [ ] Do not concatenate such text into `style`/`href`/`src` unchecked (colours: check with the regex `^#[0-9a-f]{3,8}$` · links: accept only `https:`)
- [ ] No `eval` / `new Function` / `setTimeout("string")` on such text
- [ ] `JSON.parse` inside `try/catch` · check the type of what you got before using it
- [ ] File paths built from data: reject `..` and path separators yourself before passing them to `k2.readFile`/`writeFile`
- [ ] Building an HTML/Markdown/CSV file from the user's data: escape correctly for that file's format (HTML: `& < > "` · CSV: wrap in `"` and beware of cells that begin with `= + - @`)

Why stricter than on the ordinary web: an XSS hole in a plugin = a stranger's code gets to run with the same rights as the plugin (which are the app's rights), merely because the user opened a project containing an oddly named scene.

### Stability is the safety of someone's writing

- [ ] No long synchronous work (a frozen app = the user force-quits = unsaved work is lost)
- [ ] `try/catch` around every piece of async work · no stray Promise rejections
- [ ] Clean up completely before declaring `hotReload` ([4.3](04-hooks-lifecycle.md#43-lifecycle-and-hotreload))
- [ ] Test with no project open · with no document open · with a Wiki page as the document · while switching projects

## 7.5 What authors should tell users (in the README)

Users decide from the information you give them. Write it straight:

```markdown
## Access and data

- **Reads**: the text of the open scene · the project's registry files (to count words across the book)
- **Writes**: the file `Reports/manuscript-report.md` in the project (only when you run the "Build manuscript report" command)
- **Network**: not used
- **Stores**: the latest word count per project (in project.khn.json)
- **Never**: changes scene files · sends data off the machine
```

## 7.6 Reporting a vulnerability

- **In the app itself** (for example, a way for a project plugin to run without permission): tell the project's maintainers. If it should not be disclosed before it is fixed, **do not put the details of the attack in an in-app bug report**, because those reports are public. Say briefly that there is a security matter and ask for a private channel.
- **In someone else's plugin**: tell that plugin's author, at their repository.
- **In your own plugin**: release a fix · state clearly in the changelog which versions are affected and must be updated (users have to install over the top themselves — there is no automatic updating).

## 7.7 Known limitations of this version

| Subject | State |
|---|---|
| A sandbox / per-capability permissions | None |
| Plugin signing / verifying the author | None |
| Central review | None (there is no store) |
| Verifying the integrity of files installed from a link (a checksum) | None — it relies on the source's HTTPS |
| Permission for a user plugin whose files are changed later | None — whoever can write to the user-data folder can change the code that runs |
| A list of domains a plugin may contact | None |
| Checking for an `entry` that points outside the plugin folder | It is a manifest rule the author must follow — do not rely on the loader to refuse it |

---

Next: [8. Packaging and distribution →](08-packaging-distribution.md)
