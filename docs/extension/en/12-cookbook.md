# 12. Cookbook

**Language:** English · [ภาษาไทย](../th/12-cookbook.md)

[← 11. Debugging and testing](11-debugging-testing.md) · [Overview](README.md)

---

Short pieces of code you can cut and paste. Every recipe uses only the API in [chapter 3](03-sdk-reference.md) and matches **alpha.169**. The recipes that touch the editor (section A) and the file/settings recipes (sections C and D) were run against the real app — section A in both a novel scene and a screenplay scene.

Helpers that every recipe assumes exist (put them at the top of your plugin file — they come from [4.3](04-hooks-lifecycle.md#the-recommended-pattern-register-in-pairs)):

```js
const NS = 'k2p-' + k2.pluginName;                       // prefix for CSS classes / keys / event names
const cleanup = [];
const track = (fn) => { cleanup.push(fn); return fn; };
k2.onUnload(() => { for (const fn of cleanup.splice(0).reverse()) { try { fn(); } catch (e) { k2.log('cleanup', e && e.message); } } });
const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); track(() => target.removeEventListener(type, fn, opts)); };
const every = (ms, fn) => { const id = setInterval(fn, ms); track(() => clearInterval(id)); return id; };
const mount = (el, parent = document.body) => { parent.appendChild(el); track(() => el.remove()); return el; };
```

| Section | Recipes |
|---|---|
| [A. The editor](#a-the-editor) | A1 the selected text · A2 wrap the selection · A3 insert several paragraphs · A4 replace throughout the document · A5 jump to a position · A6 novel or screenplay? · A7 count by screenplay element · A8 insert the date |
| [B. Panels](#b-panels) | B1 a panel that follows the tab · B2 a settings form in a panel · B3 a keyboard-operable list · B4 empty/loading/error states |
| [C. Files and data](#c-files-and-data) | C1 read JSON safely · C2 write a report · C3 export CSV · C4 plugin data in a file · C5 a cancellable whole-project job |
| [D. Settings](#d-settings) | D1 defaults + migration · D2 user-level settings · D3 the user's API key |
| [E. Events](#e-events) | E1 a daily goal · E2 run when the project changes · E3 talk to other plugins · E4 watch the selection |
| [F. The screen](#f-the-screen) | F1 inject CSS · F2 a menu from a button · F3 a multi-step prompt · F4 a floating badge that cleans up · F5 multiple languages |
| [G. Network](#g-network) | G1 call a JSON API · G2 retry with back-off · G3 cache replies |

---

## A. The editor

### A1 The text that is selected

```js
/** The selected text · '' = nothing selected · null = no editor */
function selectedText() {
  const view = k2.getEditorView();
  if (!view) return null;
  const { from, to } = view.state.selection;
  return view.state.doc.textBetween(from, to, '\n');      // '\n' = the separator between blocks
}

k2.registerCommand('Count selected words', () => {
  const s = selectedText();
  if (s == null) return k2.setStatus('Open a scene first');
  if (!s) return k2.setStatus('Nothing is selected');
  const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
  let n = 0; for (const w of seg.segment(s)) if (w.isWordLike) n++;
  k2.setStatus('Selected: ' + n.toLocaleString() + ' words · ' + s.length.toLocaleString() + ' characters');
});
```

`Intl.Segmenter` can segment languages written without spaces, such as Thai (it uses ICU's dictionary). The result is close to, but not necessarily the same as, the app's own word counter.

### A2 Wrap the selection in marks

```js
function wrapSelection(open, close) {
  const view = k2.getEditorView();
  if (!view) return false;
  const { from, to, empty } = view.state.selection;
  if (empty) return false;
  const text = view.state.doc.textBetween(from, to, '\n');
  if (text.includes('\n')) { k2.setStatus('Select within one paragraph'); return false; }   // across blocks = the document structure would change
  view.dispatch(view.state.tr.insertText(open + text + close, from, to));               // one undo step
  view.focus();
  return true;
}
k2.registerCommand('Wrap in quotation marks', () => wrapSelection('“', '”'));
```

- `insertText` replaces the range with **plain text** — mixed formatting inside the range (some words bold) becomes one format, taken from the start.
- To keep the formatting, insert twice in one transaction, **from the end towards the start** (so the earlier position does not shift):

  ```js
  view.dispatch(view.state.tr.insertText(close, to).insertText(open, from));
  ```

### A3 Insert several paragraphs (a novel scene)

`k2.insertText('a\nb')` does not start a new paragraph. Create the nodes yourself:

```js
/** Insert new paragraphs after the block the cursor is in · returns false if the document is not a novel */
function insertParagraphs(lines) {
  const view = k2.getEditorView();
  if (!view) return false;
  const { schema, selection } = view.state;
  const para = schema.nodes.paragraph;
  if (!para) return false;                                  // a screenplay has no paragraph node
  const nodes = lines.map((t) => para.create(null, t ? schema.text(t) : null));     // schema.text('') throws — pass null for an empty paragraph
  const $to = selection.$to;
  const pos = $to.depth >= 1 ? $to.after(1) : $to.pos;      // after the top-level block the cursor is in
  view.dispatch(view.state.tr.insert(pos, nodes).scrollIntoView());
  view.focus();
  return true;
}

k2.registerCommand('Insert a scene outline', () => {
  if (!insertParagraphs(['Goal:', 'Obstacle:', 'Outcome:'])) k2.setStatus('Works in a novel scene');
});
```

With the cursor inside a list/block quote → the new paragraphs go **after the whole list** (the top level), which is usually what the user expects.

### A4 Replace throughout the open document (one undo step)

```js
/** Returns the number of replacements · only matches words that lie within one run of formatting (see the note) */
function replaceAll(find, repl) {
  const view = k2.getEditorView();
  if (!view || !find) return 0;
  const hits = [];
  view.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (let i = node.text.indexOf(find); i !== -1; i = node.text.indexOf(find, i + find.length)) hits.push(pos + i);
  });
  if (!hits.length) return 0;
  let tr = view.state.tr;
  for (const from of hits.reverse()) tr = tr.insertText(repl, from, from + find.length);    // end → start: the remaining positions do not shift
  view.dispatch(tr);
  return hits.length;
}

k2.registerCommand('Replace in this scene…', async () => {
  const find = await k2.ask('Find');
  if (find == null) return;
  const repl = await k2.ask('Replace with', { allowEmpty: true });
  if (repl == null) return;
  const n = replaceAll(find, repl);
  k2.setStatus(n ? 'Replaced ' + n + ' — Ctrl+Z undoes them all at once' : 'Could not find "' + find + '"');
});
```

- A document stores text in **runs by formatting**. A word that is half bold is in two different nodes, and this recipe will not find it (the app's own find-and-replace, `Ctrl+H`, handles that case — use it if you need completeness).
- `repl = ''` = delete.
- Do this **only to the open document**. Do not do the same to scene files on disk ([6.3](06-data-and-files.md#63-files-you-must-not-overwrite)).

### A5 Move the cursor to a position

```js
function gotoPos(pos) {
  const view = k2.getEditorView();
  if (!view) return false;
  const doc = view.state.doc;
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  const Sel = view.state.selection.constructor;            // ProseMirror's Selection class (there is nothing to import)
  view.dispatch(view.state.tr.setSelection(Sel.near($pos)).scrollIntoView());
  view.focus();
  return true;
}

/** The first position where the text is found · -1 = not found */
function findText(needle) {
  const view = k2.getEditorView();
  let at = -1;
  if (view) view.state.doc.descendants((node, pos) => {
    if (at !== -1) return false;
    if (node.isText) { const i = node.text.indexOf(needle); if (i !== -1) at = pos + i; }
  });
  return at;
}

k2.registerCommand('Go to the first TODO', () => {
  const at = findText('TODO');
  if (at === -1) k2.setStatus('No TODO in this scene'); else gotoPos(at);
});
```

The page-at-a-time page views show a copy of the document — the scroll may not be visible until the user goes back to the normal view.

### A6 Is this document a novel or a screenplay?

```js
/** 'prose' | 'screenplay' | null (no editor) */
function docKind() {
  const view = k2.getEditorView();
  if (!view) return null;
  return view.state.schema.nodes.sp ? 'screenplay' : 'prose';
}
```

In alpha.169 a screenplay document has a single block node type, `sp` (the element is in `attrs.el`); a novel has `paragraph` `heading` `blockquote` `bullet_list` `ordered_list` `figure` and so on. **These names are internal and can change with any release.** Test for the existence of a node (`schema.nodes.x`) and always have a fallback. A way that does not depend on the schema: look at `kind` in the `tab:activate` event ([4.1](04-hooks-lifecycle.md#tabactivate)).

### A7 Count lines by screenplay element

```js
function screenplayStats() {
  const view = k2.getEditorView();
  if (!view || !view.state.schema.nodes.sp) return null;
  const count = {};
  const speakers = {};
  let last = null;
  view.state.doc.forEach((node) => {
    const el = node.attrs && node.attrs.el;
    if (!el || !node.textContent.trim()) return;             // blank lines are blocks too (element "action") — do not count them
    count[el] = (count[el] || 0) + 1;
    if (el === 'character') last = node.textContent.replace(/\s*\(.*\)\s*$/, '').trim();      // drop (V.O.) / (CONT'D)
    else if (el === 'dialogue' && last) speakers[last] = (speakers[last] || 0) + 1;
  });
  return { count, speakers };
}
```

A way that survives version changes better: read `k2.getMarkdown()` and look at the line-prefix codes (`### ` = scene heading · `@` = character …) as described in [Appendix D of the User Manual](../../manual/en/D-file-formats.md). The file format is much harder to change than node names.

### A8 Insert the date/time, with a shortcut

```js
function stamp() {
  const d = new Date();
  const text = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (!k2.insertText(text)) k2.setStatus('Open a scene first');
}
k2.registerCommand('Insert date and time', stamp);
k2.registerShortcut('stamp', 'F7', true, true, stamp);          // Ctrl+Shift+F7 · always paired with a command
```

---

## B. Panels

### B1 A panel that updates with the open tab

```js
let host = null;
let info = { title: '', chars: 0 };

function draw() {
  if (!host) return;
  const box = document.createElement('div');
  box.className = NS + '-box';
  const h = document.createElement('div'); h.className = NS + '-title'; h.textContent = info.title || 'No scene open';
  const n = document.createElement('div'); n.textContent = info.chars.toLocaleString() + ' characters';
  box.append(h, n);
  host.replaceChildren(box);
}
function refresh(title) {
  info = { title: title == null ? info.title : title, chars: k2.getMarkdown().length };
  draw();
}

k2.registerPanel('info', { title: 'Scene info', icon: 'chart', render: (h) => { host = h; draw(); } });
k2.registerCommand('Open the scene-info panel', () => { refresh(); k2.showPanel('info'); });
k2.on('tab:activate', (e) => setTimeout(() => refresh(e.title), 0));      // step out of the event before doing work
k2.on('tab:save', (e) => refresh(e.title));
k2.on('project:close', () => { info = { title: '', chars: 0 }; draw(); });
```

The panel does not update while the user types (there is no "typing" event). If you need that, see [E4](#e4-watching-the-selection-when-there-is-no-event).

### B2 A settings form in a panel

```js
const DEFAULTS = { minutes: 25, sound: true, label: '' };
const opts = () => ({ ...DEFAULTS, ...k2.getSettings() });

function field(labelText, input) {
  const row = document.createElement('label'); row.className = NS + '-row';
  const span = document.createElement('span'); span.textContent = labelText;
  row.append(span, input);
  return row;
}
function renderSettings(h) {
  const o = opts();
  const num = Object.assign(document.createElement('input'), { type: 'number', min: 1, max: 180, value: o.minutes });
  num.onchange = () => {
    const v = Math.round(Number(num.value));
    if (!Number.isFinite(v) || v < 1 || v > 180) { num.value = opts().minutes; return; }      // a bad value = put the old one back
    k2.setSettings('minutes', v);
  };
  const chk = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!o.sound });
  chk.onchange = () => k2.setSettings('sound', chk.checked);
  const txt = Object.assign(document.createElement('input'), { type: 'text', value: o.label, placeholder: 'e.g. morning round' });
  txt.onchange = () => k2.setSettings('label', txt.value.trim());
  const form = document.createElement('div'); form.className = NS + '-form';
  form.append(field('Minutes per round', num), field('Play a sound when done', chk), field('Round name', txt));
  h.replaceChildren(form);
}
k2.registerPanel('settings', { title: 'Timer settings', icon: 'cog', render: renderSettings });
```

- Bind to `change`, not `input` — the project file is not written on every keystroke.
- Always validate before storing: the project file may have been edited by hand, or come from another version of your plugin.
- A `<label>` wrapping both the text and the field = clicking the text focuses the field, and a screen reader reads the field's name.

### B3 A list that can be operated from the keyboard

```js
function renderList(h, items, onPick) {
  const list = document.createElement('div');
  list.className = NS + '-list';
  list.setAttribute('role', 'listbox');
  items.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = NS + '-item';
    row.setAttribute('role', 'option');
    row.tabIndex = i === 0 ? 0 : -1;                       // roving tabindex: Tab lands on one row only
    row.textContent = it.title;                            // always textContent — the name comes from the user's files
    row.onclick = () => onPick(it);
    list.appendChild(row);
  });
  list.onkeydown = (e) => {
    const rows = [...list.children];
    const at = rows.indexOf(document.activeElement);
    if (at < 0) return;
    const go = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[e.key];
    if (go !== undefined) {
      e.preventDefault();
      const to = rows[Math.max(0, Math.min(rows.length - 1, go))];
      rows[at].tabIndex = -1; to.tabIndex = 0; to.focus();
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(items[at]); }
  };
  h.replaceChildren(list);
}
```

### B4 Empty · loading · error states

```js
let host = null;
let view = { state: 'empty', rows: [], error: '' };          // state lives in a variable, not in the DOM

function message(text, actionLabel, onAction) {
  const box = document.createElement('div'); box.className = NS + '-empty';
  const p = document.createElement('p'); p.textContent = text; box.appendChild(p);
  if (actionLabel) { const b = document.createElement('button'); b.type = 'button'; b.textContent = actionLabel; b.onclick = onAction; box.appendChild(b); }
  return box;
}
function draw() {
  if (!host) return;
  if (view.state === 'empty') host.replaceChildren(message('No report yet', 'Build the report', run));
  else if (view.state === 'loading') host.replaceChildren(message('Reading scenes…'));
  else if (view.state === 'error') host.replaceChildren(message('It did not work: ' + view.error, 'Try again', run));
  else renderRows(host, view.rows);
}
let job = 0;
async function run() {
  const mine = ++job;                                        // pressed again = the older job is dropped
  view = { state: 'loading', rows: [], error: '' }; draw();
  try {
    const rows = await collect();
    if (mine !== job) return;
    view = rows.length ? { state: 'ready', rows, error: '' } : { state: 'empty', rows: [], error: '' };
  } catch (e) {
    if (mine !== job) return;
    view = { state: 'error', rows: [], error: String(e && e.message || e) };
  }
  draw();
}
track(() => { job++; });                                     // unloaded mid-job = the result that comes back is dropped
```

---

## C. Files and data

### C1 Read JSON without turning the Log red

```js
async function hasFile(rel) {
  const i = rel.lastIndexOf('/');
  const names = await k2.listFiles(i < 0 ? '.' : rel.slice(0, i));
  return names.includes(i < 0 ? rel : rel.slice(i + 1));
}
/** null = no such file / unreadable / no project open */
async function readJson(rel) {
  if (!(await hasFile(rel))) return null;
  let txt;
  try { txt = await k2.readFile(rel); } catch { return null; }      // the file vanished in between
  if (txt == null) return null;
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);             // a BOM (a file edited in another program)
  try { return JSON.parse(txt); } catch { return null; }
}
```

> **Unreadable ≠ absent.** If your plugin is going to *write the same file back*, it must tell these two cases apart ([C4](#c4-plugin-data-in-a-file-of-its-own)); otherwise a temporarily damaged file gets overwritten with an empty one.

### C2 Write a report as Markdown

```js
async function writeReport(title, lines) {
  if (!k2.projectRoot()) { k2.setStatus('Open a project first'); return null; }
  const rel = 'Reports/' + k2.pluginName + '.md';
  const body = ['# ' + title, '', 'Generated ' + new Date().toLocaleString(), '', ...lines, ''].join('\n');
  const ok = await k2.writeFile(rel, body);
  k2.setStatus(ok ? 'Report written to ' + rel : 'Could not write the report');
  return ok ? rel : null;
}
```

- A fixed file name = it overwrites the previous run (the user can go back from the Activity history panel). To keep every run, append the date: `new Date().toISOString().slice(0, 10)`.
- Put the relative path in the message — there is no API for opening a file for the user ([3.10](03-sdk-reference.md#310-what-k2-does-not-have-in-this-version)).

### C3 Export CSV that Excel opens without mangling non-Latin text

```js
function toCsv(rows, columns) {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;                 // guard against formula injection — a scene title can start with =
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c.key])).join(','));
  return String.fromCharCode(0xFEFF) + lines.join('\r\n') + '\r\n';      // the BOM = Excel on Windows reads it as UTF-8
}

async function exportCsv(rows) {
  const csv = toCsv(rows, [
    { key: 'book', label: 'Book' }, { key: 'chapter', label: 'Chapter' },
    { key: 'title', label: 'Scene' }, { key: 'status', label: 'Status' }, { key: 'words', label: 'Words' },
  ]);
  const ok = await k2.writeFile('Reports/scenes.csv', csv);
  k2.setStatus(ok ? 'Exported ' + rows.length + ' rows to Reports/scenes.csv' : 'The export failed');
}
```

The `rows` list comes from `readOutline()` in [6.2](06-data-and-files.md#62-reading-the-project-structure).

### C4 Plugin data in a file of its own

For data too big to live in `setSettings` (history · an index · a cache):

```js
const DATA = 'PluginData/' + k2.pluginName + '/log.json';

/** { ok, data } — ok:false = the file exists but cannot be read (do not overwrite it) */
async function loadData() {
  const names = await k2.listFiles('PluginData/' + k2.pluginName);
  if (!names.includes('log.json')) return { ok: true, data: { v: 1, days: {} } };      // not there yet = safe to start fresh
  try {
    let txt = await k2.readFile(DATA);
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
    const data = JSON.parse(txt);
    if (!data || typeof data !== 'object' || typeof data.days !== 'object') throw new Error('shape');
    return { ok: true, data };
  } catch (e) {
    k2.log('data unreadable', e && e.message);
    return { ok: false, data: null };
  }
}

let saving = Promise.resolve();
/** read–modify–write, one job at a time (two events in quick succession do not overwrite each other) */
function updateData(fn) {
  saving = saving.then(async () => {
    const cur = await loadData();
    if (!cur.ok) { k2.setStatus("The plugin's data file is damaged — it was not overwritten. See " + DATA); return false; }
    if (fn(cur.data) === false) return false;                // fn returns false = nothing changed, no write needed
    return k2.writeFile(DATA, JSON.stringify(cur.data, null, 1));
  }).catch((e) => { k2.log('data write', e && e.message); return false; });
  return saving;
}
```

The `PluginData/<plugin name>/` folder is this guide's suggestion ([6.4](06-data-and-files.md#64-where-a-plugin-should-write-files)) — the app does not define it.

### C5 A whole-project job that can be cancelled and does not freeze the app

```js
let running = null;                                           // { cancelled }

async function scanAll(scenes, onEach) {
  if (running) { running.cancelled = true; }
  const me = running = { cancelled: false };
  const root = k2.projectRoot();
  let done = 0, last = 0;
  for (const sc of scenes) {
    if (me.cancelled || k2.projectRoot() !== root) return { done, cancelled: true };     // the user switched projects midway
    let text = null;
    try { text = await k2.readFile(sc.rel); } catch { /* the file is gone: skip it */ }
    if (text != null) onEach(sc, text);
    done++;
    const now = Date.now();
    if (now - last > 400) { last = now; k2.setStatus('Read ' + done + '/' + scenes.length); }      // no more than ~2 updates a second
    if (done % 25 === 0) await new Promise((r) => setTimeout(r, 0));                     // give the screen a turn
  }
  if (running === me) running = null;
  return { done, cancelled: false };
}
k2.registerCommand('Stop the scan', () => { if (running) { running.cancelled = true; k2.setStatus('Stopped'); } });
k2.on('project:close', () => { if (running) running.cancelled = true; });
track(() => { if (running) running.cancelled = true; });
```

Read one file after another (no `Promise.all` over the whole project). Reading several hundred scenes at once makes the disk and the app stumble.

---

## D. Settings

### D1 Defaults + migrating an older version's values

```js
const SETTINGS_V = 2;
const DEFAULTS = { v: SETTINGS_V, minutes: 25, sound: true };

function loadSettings() {
  const raw = k2.getSettings() || {};
  const s = { ...DEFAULTS, ...raw };
  if ((raw.v || 1) < 2 && typeof raw.seconds === 'number') {       // version 1 stored seconds
    s.minutes = Math.max(1, Math.round(raw.seconds / 60));
  }
  s.minutes = Number.isFinite(+s.minutes) ? Math.min(180, Math.max(1, Math.round(+s.minutes))) : DEFAULTS.minutes;
  s.sound = !!s.sound;
  s.v = SETTINGS_V;
  return s;
}
let settings = loadSettings();
k2.on('project:open', () => { settings = loadSettings(); });        // a new project = a new set of settings
```

- Read them again every time the project changes. Settings belong to the project, and a user plugin is **not run again** when the project is switched.
- Do not write values back on load (merely opening a project would change the project file, which is a nuisance for people using Git/sync). Write only when the user changes a value.

### D2 User-level settings (they follow the user to every project)

```js
const PREF_KEY = 'k2-plugin-' + k2.pluginName + ':prefs';
function getPrefs() {
  try { const o = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
  catch { return {}; }                                              // a damaged value / storage is disabled
}
function setPref(key, value) {
  const p = getPrefs(); p[key] = value;
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
```

The key stays after the plugin is uninstalled. If you store anything large, offer a "Clear this plugin's data" command (`localStorage.removeItem(PREF_KEY)`).

### D3 An API key the user gives your plugin

```js
const SECRET_KEY = 'k2-plugin-' + k2.pluginName + ':token';
const getToken = () => { try { return localStorage.getItem(SECRET_KEY) || ''; } catch { return ''; } };

k2.registerCommand('Set the service key…', async () => {
  const cur = getToken();
  const v = await k2.ask(cur ? 'New key (blank = delete the stored key)' : 'Paste the service key', { allowEmpty: true, placeholder: 'sk-…' });
  if (v == null) return;
  try { if (v) localStorage.setItem(SECRET_KEY, v); else localStorage.removeItem(SECRET_KEY); } catch { return k2.setStatus('Could not store the key'); }
  k2.setStatus(v ? 'Key stored (on this machine only)' : 'Key deleted');
});
```

- **Never use `k2.setSettings` for a secret** — project files get passed around, backed up and committed to Git.
- `localStorage` is **not encrypted**, and other plugins can read it ([chapter 7](07-security.md)). Say so in your plugin's README, and advise users to issue a key with limited scope/spend.
- The `k2.ask` dialog shows what is typed as ordinary text (it has no password field). Do not show the existing key as the box's starting value. If that matters, use an `<input type="password">` in your own panel instead.
- Do not `k2.log` the key, or a URL with the key in its query string.

---

## E. Events

### E1 A daily character goal

```js
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const lastChars = new Map();                                  // file → character count at the previous save (this app session)

k2.on('tab:save', (e) => {
  const prev = lastChars.get(e.file);
  lastChars.set(e.file, e.chars);
  if (prev === undefined) return;                             // first time this file is seen: nothing to compare with
  const delta = e.chars - prev;
  if (delta <= 0) return;                                     // deletions/no change are not counted
  const day = today();
  const log = { ...(k2.getSettings('days') || {}) };
  log[day] = (log[day] || 0) + delta;
  for (const k of Object.keys(log).sort().slice(0, -60)) delete log[k];      // keep the last 60 days — settings must stay small
  k2.setSettings('days', log);
  const goal = k2.getSettings('goal', 2000);
  if (log[day] >= goal && log[day] - delta < goal) setTimeout(() => k2.setStatus("Today's goal reached: " + log[day].toLocaleString() + ' characters'), 1500);
});
k2.on('project:close', () => lastChars.clear());
```

- `e.file` is a full machine path. It is fine as a key **in memory**, but must never be stored in a file.
- The `setTimeout` before `setStatus`: the app's "saved" message arrives after the handler and would overwrite a message written immediately.
- `tab:save` also fires on every autosave — the handler must be light.

### E2 Run once per project (including a project already open when the plugin loads)

```js
let currentRoot = null;
function onProject() {
  const root = k2.projectRoot();
  if (root === currentRoot) return;
  currentRoot = root;
  if (root) setup(); else teardown();
}
k2.on('project:open', onProject);
k2.on('project:close', () => { currentRoot = null; teardown(); });
onProject();                                                  // the plugin was loaded *after* the project opened — there is no retroactive project:open
```

Forget the last line and the plugin works only when the user switches projects, not after installing/reloading (the most common bug in `project:open` handlers).

### E3 Let other plugins build on yours

```js
// the focus-timer plugin announces its own events (and lists them in its README)
k2.emit('focus-timer:start', { minutes: 25 });
k2.emit('focus-timer:done', { minutes: 25, at: Date.now() });

// another plugin
k2.on('focus-timer:done', (e) => {
  if (!e || typeof e.minutes !== 'number') return;            // data from another plugin = check its shape before using it
  addSession(e.minutes);
});
```

- You can find out which plugins are running from `e.loaded` of the `plugins:loaded` event (folder names — a user may have installed one under another name) → always design yours to work when nobody emits/listens.
- Question and answer: the asker does `emit('x:ping', { reply: 'y:pong' })` · the answerer does `emit(e.reply, {...})`. `emit` runs synchronously, so a listener can answer in the same turn.
- Changing the shape of a payload = a breaking change → bump your plugin's major version ([8.4](08-packaging-distribution.md#84-version-numbers)).

### E4 Watching the selection when there is no event

```js
let lastSel = '';
every(700, () => {
  if (document.hidden || !host || !host.isConnected) return;      // the window is hidden / the panel is not open = do nothing
  const view = k2.getEditorView();
  const key = view ? view.state.selection.from + ':' + view.state.selection.to : '';
  if (key === lastSel) return;                                    // unchanged = no redraw
  lastSel = key;
  draw();
});
```

- Check `selection.from/to` (two numbers). **Never call `getMarkdown()` in the loop.**
- Do it only while your panel is open · no more often than every ~500 milliseconds.
- `every()` cleans up for you when the plugin is unloaded.

---

## F. The screen

### F1 Inject your plugin's CSS

```js
const css = `
.${NS}-box   { padding: 12px; color: var(--fg); font-size: calc(13px * var(--ui-scale, 1)); }
.${NS}-title { font-weight: 600; margin-bottom: 6px; }
.${NS}-row   { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.${NS}-row > span { flex: 1; color: var(--dim); }
.${NS}-item  { padding: 6px 10px; border-radius: 6px; cursor: default; }
.${NS}-item:hover, .${NS}-item:focus-visible { background: var(--hover); outline: none; }
.${NS}-empty { padding: 24px 12px; text-align: center; color: var(--dim); }
`;
const style = document.createElement('style');
style.dataset.plugin = k2.pluginName;
style.textContent = css;
mount(style, document.head);                                     // removed when the plugin is unloaded
```

Every selector starts with your plugin's class — no rule may match one of the app's elements ([5.7](05-ui-guidelines.md#57-a-plugins-css)). All the colour variable names are in [5.2](05-ui-guidelines.md#52-theme-colour-variables).

### F2 A menu opened from a button in a panel

```js
function menuButton(labelText, buildItems) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = labelText;
  b.setAttribute('aria-haspopup', 'menu');
  b.onclick = () => { const r = b.getBoundingClientRect(); k2.menuPopup(buildItems(), r.left, r.bottom + 4); };
  return b;
}

const sortBtn = menuButton('Sort by', () => [
  { text: 'Story order', checked: sort === 'order', click: () => setSort('order') },
  { text: 'Word count', checked: sort === 'words', click: () => setSort('words') },
  '-',
  { text: 'Character', sub: () => names.map((n) => ({ text: n, click: () => filterBy(n) })) },     // text = plain text
]);
```

### F3 A multi-step prompt that can be cancelled at every step

```js
k2.registerCommand('Create a checklist…', async () => {
  const title = await k2.ask('Checklist name', { placeholder: 'e.g. before sending to the editor' });
  if (title == null) return;
  const raw = await k2.ask('One item per line', { multiline: true, placeholder: 'Check character names\nCheck the timeline' });
  if (raw == null) return;
  const items = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!items.length) return k2.setStatus('Nothing to save');
  const rel = 'Reports/checklist.md';
  if ((await k2.listFiles('Reports')).includes('checklist.md')
      && !(await k2.confirmBox(rel + ' already exists.\nOverwrite it?', 'Overwrite'))) return;
  const ok = await k2.writeFile(rel, '# ' + title + '\n\n' + items.map((s) => '- [ ] ' + s).join('\n') + '\n');
  k2.setStatus(ok ? 'Saved to ' + rel : 'Could not save');
});
```

Always ask before overwriting, and make the confirm button's label say what will happen.

### F4 A floating badge that cleans up after itself

```js
const badge = document.createElement('div');
badge.className = NS + '-badge';
badge.setAttribute('role', 'status');
badge.hidden = true;
mount(badge);

function showBadge(text) { badge.textContent = text; badge.hidden = false; }
function hideBadge() { badge.hidden = true; }
```

```css
/* appended to the css of F1 */
.k2p-NAME-badge {
  position: fixed; right: 16px; bottom: 44px; z-index: 40;      /* above the status bar · below dialogs/menus */
  padding: 4px 10px; border-radius: 999px;
  background: var(--chip); color: var(--fg); border: 1px solid var(--border);
  pointer-events: none;                                          /* does not swallow the user's clicks */
}
@media print { .k2p-NAME-badge { display: none; } }
```

- Anything floating must **not cover the writing area**, and should not take the mouse unless it has to. Killian 2 users dislike things that pop up by themselves: let it appear only when the user starts something (pressing "start the timer", say).
- Do not place it in the top 36px of the window (the title bar is a window-drag region — clicks do not get through).
- Always hide it when printing.

### F5 Text in several languages

```js
const STR = {
  en: { count: 'Count words in this scene', none: 'Open a scene first', words: (n) => n.toLocaleString() + (n === 1 ? ' word' : ' words') },
  th: { count: 'นับคำฉากนี้', none: 'เปิดฉากก่อน', words: (n) => n.toLocaleString() + ' คำ' },
};
const lang = () => (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
const T = (key, ...a) => {
  const v = (STR[lang()] || STR.en)[key] ?? STR.en[key] ?? key;
  return typeof v === 'function' ? v(...a) : v;
};

k2.registerCommand(T('count'), () => k2.setStatus(k2.getEditorView() ? T('words', countWords(k2.getMarkdown())) : T('none')));
```

- The interface language is read from `<html lang>` (the app sets it once the language file has loaded).
- The names of commands/panels are fixed when they are registered. When the user changes language the app restarts, which runs your plugin again, so the labels keep up.
- A language that is not in your table → English.

---

## G. Network

### G1 Call a JSON API

```js
/** { ok:true, data } | { ok:false, message } — never throws */
async function getJson(url, init) {
  const r = await k2.fetch(url, init);
  if (r.netError) return { ok: false, message: r.timedOut ? 'timed out' : 'could not connect' };
  if (!r.ok) {
    const hint = { 401: 'the key is not valid', 403: 'not permitted', 404: 'not found', 429: 'too many requests' }[r.status];
    return { ok: false, message: hint || 'the server answered ' + r.status };
  }
  try { return { ok: true, data: JSON.parse(r.body) }; }
  catch { return { ok: false, message: 'the reply is not JSON' }; }
}

k2.registerCommand('Find synonyms (English)…', async () => {
  const word = await k2.ask('An English word');
  if (word == null) return;
  const res = await getJson('https://api.datamuse.com/words?max=8&rel_syn=' + encodeURIComponent(word));
  if (!res.ok) return k2.setStatus('The lookup failed: ' + res.message);
  const list = Array.isArray(res.data) ? res.data.map((x) => String(x.word || '')).filter(Boolean) : [];
  k2.setStatus(list.length ? list.join(' · ') : 'No synonyms found for "' + word + '"');
});
```

- `encodeURIComponent` every value you put in a URL.
- Check the shape of a reply before using it — servers change, go down, and their replies are untrusted data (always use `textContent` when showing them).
- This example sends **the word the user typed** to an outside service — that has to be stated in the README ([7.5](07-security.md#75-what-authors-should-tell-users-in-the-readme)).

### G2 Retry with back-off

```js
async function fetchRetry(url, init, tries = 3) {
  let r;
  for (let n = 0; n < tries; n++) {
    r = await k2.fetch(url, init);
    const retryable = r.netError || r.status === 429 || (r.status >= 500 && r.status < 600);
    if (!retryable) return r;
    if (n < tries - 1) await new Promise((res) => setTimeout(res, Math.min(8000, 500 * 2 ** n)));      // 0.5s · 1s · 2s …
  }
  return r;
}
```

Do not retry other 4xx statuses (a bad request is bad however often you send it). Do not retry a request that is **not idempotent** (a POST that creates something) without a de-duplication key.

### G3 Cache replies in memory

```js
const cache = new Map();                                       // url → { at, value }
const TTL = 10 * 60 * 1000;

async function cachedJson(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const res = await getJson(url);
  if (res.ok) {
    cache.set(url, { at: Date.now(), value: res });
    if (cache.size > 200) cache.delete(cache.keys().next().value);      // a ceiling: drop the oldest
  }
  return res;
}
track(() => cache.clear());
```

Cache only successful replies · always have a ceiling (the app can stay open for days).

---

## Recipes that cannot be made in this version

To save you looking — these **cannot be done through `k2`** in alpha.169 ([3.10](03-sdk-reference.md#310-what-k2-does-not-have-in-this-version) · [4.7](04-hooks-lifecycle.md#47-what-hooks-cannot-do-in-this-version)):

| You want to | Why not |
|---|---|
| Highlight/underline text in a document | It needs ProseMirror decorations, which need a ProseMirror plugin to be registered — there is no API for that. Putting classes on the editor's DOM is forbidden and disappears anyway. |
| Open a scene/file in a tab · open a built-in panel | No API |
| Run work on every character the user types | No event (use [E4](#e4-watching-the-selection-when-there-is-no-event), lightly) |
| Block a save / change content before it is saved | Events are notifications after the fact only |
| Add an export format to the Export Hub | No API — write the file yourself, or use a workflow's JavaScript step ([4.5](04-hooks-lifecycle.md#45-other-hooks-outside-plugins)) |
| Read/write images or binary files | The file API and `fetch` are text only |

Need more API? Propose it through **Help → Report a bug…**, with a real use case.

---

[← 11. Debugging and testing](11-debugging-testing.md) · [Overview](README.md) · [Complete example plugins](../examples/README.md)
