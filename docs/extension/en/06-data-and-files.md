# 6. Working with project files and data

**Language:** English · [ภาษาไทย](../th/06-data-and-files.md)

[← 5. Look and feel](05-ui-guidelines.md) · [Overview](README.md) · Next: [7. Security and trust →](07-security.md)

---

A Killian project is a folder of text files. A plugin can read all of it through `k2.readFile` / `listDirs` / `listFiles`, and can write new files with `k2.writeFile`.
This chapter tells you **what is where · how to read it correctly · what you may and may not write · where to keep your plugin's data**.

The full file formats: [Appendix D of the User Manual](../../manual/en/D-file-formats.md)

## 6.1 A map of a project (from a plugin's point of view)

All paths are relative to the project root:

```
project.khn.json                                  ⚠ readable · do not write
templates.json · dictionary.json · maps.json · timeline.json
<book>/section.json                               ⚠ readable · do not write
<book>/roster.json
<book>/Draft/<draft>/draft.json                   ⚠ readable · do not write
<book>/Draft/<draft>/scenes.json                  ⚠ readable · do not write
<book>/Draft/<draft>/Chapters/<chapter folder>/<scene>.md   ⚠ readable · do not overwrite
Memos/*.md
Wiki/<category>/<name>.json
Images/ · Fonts/ · Models/                        binary — cannot be read through k2
Planners/ · Branches/ · FloorPlans/ · OnSet/ · Starters/ · Sessions/ · Skills/ · References/
Snapshots/ · .k2history/ · Recycle/ · Backups/    system folders — leave them alone
Plugins/<name>/                                   the project's plugins
ai-key.json                                       ⚠ the user's secret — do not read
```

A **book** is a top-level folder that contains a `section.json` file (the folder may have any name that is not one of the app's reserved names).

## 6.2 Reading the project structure

The order and titles of book → chapter → scene are in the registry files, **not in file names or in the order of folders**:

```js
'use strict';

const stripBom = (t) => { const s = String(t == null ? '' : t); return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; };

/** Does this file exist? readFile throws when the file is missing, so ask the file list first. */
async function hasFile(rel) {
  const i = rel.lastIndexOf('/');
  return (await k2.listFiles(i < 0 ? '.' : rel.slice(0, i))).includes(i < 0 ? rel : rel.slice(i + 1));
}
async function readJson(rel) {
  if (!(await hasFile(rel))) return null;
  try { return JSON.parse(stripBom(await k2.readFile(rel))); } catch { return null; }
}
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

/** The project outline: [{ dir, title, draft, chapters: [{ guid, title, folder, scenes: [{ id, title, status, rel }] }] }] */
async function readOutline() {
  if (!k2.projectRoot()) return [];
  const books = [];
  for (const dir of await k2.listDirs('.')) {
    const sec = await readJson(dir + '/section.json');
    if (!sec) continue;                                   // not a book (Wiki · Images · …)
    const drafts = await k2.listDirs(dir + '/Draft');
    const draft = drafts.includes(sec.primaryDraft) ? sec.primaryDraft : drafts[0];   // the main draft
    if (!draft) continue;
    const base = dir + '/Draft/' + draft;
    const dj = await readJson(base + '/draft.json');
    const sj = await readJson(base + '/scenes.json');
    if (!dj || !sj) continue;
    const chapters = [...(dj.chapters || [])].sort(byOrder).map((ch) => ({
      guid: ch.guid, title: ch.title, folder: ch.folderName,
      scenes: [...((sj.chapters || {})[ch.guid] || [])].sort(byOrder).map((row) => ({
        id: row.id, title: row.title, status: row.status || '',
        rel: base + '/Chapters/' + ch.folderName + '/' + row.fileName,
      })),
    }));
    books.push({ dir, title: sec.title || dir, order: sec.order || 0, draft, chapters });
  }
  return books.sort(byOrder);
}
```

Things to remember:

| Subject | Do this |
|---|---|
| Order | Always sort by the `order` field — not by array position or file name |
| Identity | Refer to a book/chapter/scene by `guid` / `guid` / `id`. File and folder names **change** when the user renames things. |
| Drafts | Use the **main draft** (`section.json → primaryDraft`) unless you mean to look at another |
| A file the registry points to may not exist | Check with `hasFile` before reading (a project edited outside the app) |
| Older projects | File names may be `scene-01.md`, chapter folders `01 - Title` — use `fileName`/`folderName` from the registry; never build the names yourself |
| Status values | They are text the user set, in whatever language they write in (the five built-in statuses are stored under their Thai names) — do not compare them with constants of your own |
| A damaged JSON file | The `readJson` above returns `null` — skip it politely. **Never write a "repaired" file over it.** |

### Reading a scene file

A scene file has 3 parts: the header (`---`…`---`) · the body · a comments block at the end (`<!-- k2-comments … -->`).

```js
/** Split a scene file → { meta: {key: raw string}, body } — a light parser, enough for "reading" */
function parseScene(text) {
  let s = stripBom(text);
  const meta = {};
  if (s.startsWith('---')) {
    const end = s.indexOf('\n---', 3);
    if (end > 0) {
      for (const line of s.slice(3, end).split('\n')) {
        const m = /^([A-Za-z][\w-]*):\s?(.*)$/.exec(line.trim());
        if (m) meta[m[1]] = m[2];
      }
      s = s.slice(s.indexOf('\n', end + 1) + 1);
    }
  }
  const c = s.indexOf('<!-- k2-comments');
  if (c >= 0) s = s.slice(0, c);
  return { meta, body: s };
}
```

- `meta.format` = `'prose'` or `'screenplay'` · `meta.type` = `'scene'` or `'memo'`
- Header values that run over several lines are encoded by the app. This light parser is fine for reading single-line values (title · status · point of view · tags). If you need to interpret every value fully, test against a variety of real files.
- A screenplay's body has line-prefix codes (`### ` `@` `((` `>> ` `! ` …) — the table is [here](../../manual/en/D-file-formats.md#the-text--screenplay-mode).

### A file on disk versus what the user sees in a tab

`k2.readFile` reads **the file on disk**. If that scene is open and unsaved, the content in the tab is newer.

| You want | Use |
|---|---|
| The latest content of the scene that is **open** | `k2.getMarkdown()` |
| The content of other scenes | `k2.readFile(rel)` (the last saved version) |
| To always work after a save | Listen for `tab:save` |

For whole-book reports/statistics: tell the user the numbers come from the saved versions, or suggest they **Save all** first.

### Reading the Wiki

```js
async function readEntities(cat) {                        // cat = 'characters' | 'locations' | 'items' | 'lore' | a custom category
  const out = [];
  for (const f of await k2.listFiles('Wiki/' + cat, '.json')) {
    const e = await readJson('Wiki/' + cat + '/' + f);
    if (e && e.name) out.push(e);
  }
  return out;
}
const cats = await k2.listDirs('Wiki');                   // every category in this project
```

Fields you can rely on: `name` · `entityTypeKey` · `aliases[]` · `tags[]` · `fields{}` · `relationships[{ targetName, role, type }]`

## 6.3 Files you must not overwrite

`k2.writeFile` **overwrites the whole file** and bypasses the app's own mechanisms. The following files already have an owner:

| File | Why not |
|---|---|
| Scene/memo `.md` files | (1) A scene open in a tab: the app sees that "the file was changed outside the app" and asks the user, or writes the tab's content over yours on save. (2) Writing it in an incomplete form = **deleting the scene's properties and comment threads**, which live in the same file. |
| `scenes.json` · `draft.json` · `section.json` | The app edits them through a queue that reads the latest value before writing. A plugin writing a copy it read earlier = overwriting whatever the user changed in between (scenes vanish · the order goes wrong). |
| `project.khn.json` | Settings for the whole project — use `k2.setSettings` for your own plugin's. |
| `Wiki/**.json` | A page open in a tab holds the old values and writes over yours on save. |
| `ai-key.json` | The user's secret — do not read it and do not write it. |
| `Snapshots/` `.k2history/` `Recycle/` `Backups/` | The user's safety nets. |
| `Plugins/<another>/` | It belongs to another plugin — and changing a file in the project's plugin set forces permission to be asked again. |

**Need to change a scene's text?** There is one safe way: the scene must be **open in the selected tab**, and you change it through `k2.insertText` or `k2.getEditorView().dispatch(tr)`. The user sees the change, can undo it with `Ctrl+Z`, and decides when to save.

To change many scenes in one go: there is no safe way through `k2` yet. Produce a "report of what should change" for the user to act on, or have them use the app's own **Find and replace in project**.

## 6.4 Where a plugin should write files

| Data | Write it to | Notes |
|---|---|---|
| Small per-project settings | `k2.setSettings` | Lives in `project.khn.json` |
| The user's settings (every project) | `localStorage`, key `k2-plugin-<name>:…` | Stays on that machine |
| Bulky plugin data (cache · index · state) | A folder of your own in the project, e.g. `PluginData/<plugin name>/data.json` | Travels with the project · the user can see and delete it |
| Results the user will open (a report · an exported file) | A folder whose name says what it is, e.g. `Reports/` | Tell the user every time which file you wrote |
| Secrets (your plugin's API key) | `localStorage` only | **Never** in a project file or `setSettings` |

Naming rules:

- **Do not use a top-level folder name the app reserves**: `Wiki` `Bible` `Images` `Memos` `Research` `Snapshots` `.k2history` `Plugins` `Recycle` `Sessions` `Starters` `Planners` `Branches` `FloorPlans` `OnSet` `References` `Models` `Backups` `Draft` `languages` `Analysis` `Dialogues` `Fonts` `Skills` `.git`
- **Do not put a `section.json` in your folder** — the app would treat the folder as a "book".
- A top-level folder without a `section.json` is not shown in the Explorer, but it is included in the project's **backups and ZIPs** — keep it small.
- `.md` files in your folder **are seen by the project-wide search index** (a user who searches will find your report). If you do not want that, use another extension (`.txt` · `.json`).
- Use `/` as the path separator. In file names avoid the characters `\ / : * ? " < > |` and Windows' reserved names (`con` `nul` `aux` …), so the project can move between machines.
- Write readable JSON (`JSON.stringify(data, null, 2)`) — users run Git diffs.

### What happens when you write

- The write is atomic, and missing folders are created.
- It is recorded in the project's **Activity history panel** — the user can see what the plugin wrote, and go back.
- It causes the app's search index to be rebuilt (if it is a file that is searched). **Do not write rapidly** (every second, say) — debounce, and write once.

```js
// debounced writing: several changes in a short time = one write
let pending = null, timer = 0;
function saveSoon(data) {
  pending = data;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
async function flush() {
  if (pending == null) return;
  const data = pending; pending = null;
  try { await k2.writeFile('PluginData/' + k2.pluginName + '/data.json', JSON.stringify(data, null, 2)); }
  catch (e) { k2.log('save failed: ' + e.message); }
}
k2.on('project:close', () => { clearTimeout(timer); flush(); });   // try to write what is pending (the app does not wait — treat it as a fallback)
k2.onUnload(() => clearTimeout(timer));
```

## 6.5 Full paths versus relative paths

| You get a full path from | You must |
|---|---|
| `k2.projectRoot()` · an event's `e.file` · `e.root` | Convert it to a relative path before using it with `k2.readFile`, or before storing it |

```js
function relPath(full) {
  const root = String(k2.projectRoot() || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const p = String(full || '').replace(/\\/g, '/');
  return root && p.startsWith(root + '/') ? p.slice(root.length + 1) : null;
}
```

**Never write a full path into a project file** (`setSettings` · a data file · a report). Projects are moved between machines/synced/handed on; a full path is wrong at once, and it exposes the machine's user name (`C:\Users\<name>\…`).

## 6.6 Performance with large projects

Real projects can have hundreds of scenes, and every `readFile` is one IPC round trip:

- **Read when the user asks**, not when the plugin loads and not on every save.
- Read the registries (`draft.json` / `scenes.json`) first — they already hold `wordCount` · `status` · `title`. Many jobs never need to open a scene file.
- Cache results in memory, and clear the cache on `project:open` / on a `tab:save` of a relevant file.
- Long jobs: `await` one file at a time (no `Promise.all` over a hundred files at once) · show progress in your panel · make it cancellable · check `alive` and `k2.projectRoot()` after every `await` ([4.6](04-hooks-lifecycle.md#work-that-must-know-whether-it-is-still-wanted-after-an-await)).
- Do not walk into `Backups/` `Snapshots/` `.k2history/` `Recycle/` — they are several copies of the whole project.

---

Next: [7. Security and trust →](07-security.md)
