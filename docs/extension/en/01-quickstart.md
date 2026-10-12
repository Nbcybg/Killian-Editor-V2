# 1. Quick start: 10 minutes

**Language:** English · [ภาษาไทย](../th/01-quickstart.md)

[← Overview](README.md) · Next: [2. Anatomy of a plugin →](02-anatomy.md)

---

This chapter walks you through writing a first plugin, from an empty file to something that runs in the app: one command · one panel · one event handler.

**You need**: Killian 2 alpha.169 or later · a text editor (VS Code · Notepad++ · anything) · basic JavaScript
**You do not need**: Node.js · npm · a build tool (not until the plugin is big enough that you want several files — see [chapter 8](08-packaging-distribution.md))

## Step 0 — The shortcut: let the app make one

1. Open any project (plugins are loaded when a project opens)
2. Open the **Plugins** panel: **View → Panels → Plugins** (`Ctrl+Alt+E`)
3. **⋯ → Create sample** → give it a name
4. You get a plugin that works straight away, in the User folder — its card has a word-count command button you can try
5. **⋯ → User folder** → open `main.js` and edit it → come back and press **Reload**

If you would rather understand every line, do steps 1–6 by hand.

## Step 1 — Create the folder

Open your user plugins folder (the Plugins panel → **⋯ → User folder**):

| System | Location |
|---|---|
| Windows | `%APPDATA%\Killian 2\Plugins\` |
| macOS | `~/Library/Application Support/Killian 2/Plugins/` |
| Linux | `~/.config/Killian 2/Plugins/` |

Create a new folder called `hello-k2`. **The folder name is the plugin's identity** (lower-case English letters, digits and `-` are the safest choice).

## Step 2 — `plugin.json`

```json
{
  "name": "Hello K2",
  "entry": "main.js",
  "version": "0.1.0",
  "author": "Your name",
  "description": "My first plugin",
  "minAppVersion": "2.0.0-alpha.169",
  "hotReload": true
}
```

Save it as UTF-8. The file must be valid JSON (no trailing commas, no comments).

## Step 3 — `main.js`: a first command

```js
// main.js — the whole file is a plain script; the app hands it one variable, k2
k2.registerCommand('Say hello', () => {
  k2.setStatus('Hello from ' + k2.pluginName + ' on Killian ' + k2.appVersion);
});
```

Go back to the Plugins panel and press **Reload**. The `hello-k2` card shows the status **active**, with a **Say hello** button. Press it and watch the status bar at the bottom left.

> **Nothing there?** See [step 7](#step-7--when-it-does-not-work).

## Step 4 — Read from and write to the document

```js
// Count the characters of the open scene
k2.registerCommand('Count characters', () => {
  const md = k2.getMarkdown();              // '' if no scene is open
  k2.setStatus('This scene is ' + md.length + ' characters long');
});

// Insert the date at the cursor
k2.registerCommand('Insert date', () => {
  const ok = k2.insertText(new Date().toLocaleDateString());
  if (!ok) k2.setStatus('Open a scene first');
});
```

Save the file → **Reload** → the card now has three commands (the app sees that the file changed, so it unloads the old copy and runs the new one).

## Step 5 — A panel of your own

```js
let host = null;
let saves = 0;

function draw() {
  if (!host) return;
  const box = document.createElement('div');
  // always use the theme's colour variables — never fixed colours
  box.style.cssText = 'padding:12px; color:var(--fg); font-size:calc(13px * var(--ui-scale, 1))';
  box.textContent = 'Saved ' + saves + ' time(s) this session';
  host.replaceChildren(box);                 // render can be called again → replace the lot
}

k2.registerPanel('counter', {
  title: 'Save counter',
  defaultSide: 'right',
  render: (h) => { host = h; draw(); },
});

k2.registerCommand('Open the save counter', () => k2.showPanel('counter'));
```

**Reload** → run the **Open the save counter** command → the panel appears. Drag it to dock/float/tab it, just like a built-in panel.

## Step 6 — Listen to app events, and clean up

```js
k2.on('tab:save', (e) => {                   // e = { file, title, chars }
  saves++;
  draw();
  k2.log('saved ' + e.title + ' (' + e.chars + ' chars)');
});

// called when the plugin is disabled, uninstalled, or about to be replaced by a newer file
k2.onUnload(() => { host = null; });
```

**Reload** → open a scene, type something, press `Ctrl+S` → the number in the panel goes up, and a line `[plugin hello-k2] saved …` appears in the **Log** panel (`Ctrl+Alt+9`).

This plugin only uses things registered through `k2` (commands · a panel · an event handler), all of which the app can remove by itself. It can therefore declare `"hotReload": true` — a user can disable/uninstall it without restarting the app ([chapter 4](04-hooks-lifecycle.md)).

### The whole file

```js
// hello-k2/main.js
let host = null;
let saves = 0;

function draw() {
  if (!host) return;
  const box = document.createElement('div');
  box.style.cssText = 'padding:12px; color:var(--fg); font-size:calc(13px * var(--ui-scale, 1))';
  box.textContent = 'Saved ' + saves + ' time(s) this session';
  host.replaceChildren(box);
}

k2.registerPanel('counter', { title: 'Save counter', defaultSide: 'right', render: (h) => { host = h; draw(); } });

k2.registerCommand('Say hello', () => k2.setStatus('Hello from ' + k2.pluginName));
k2.registerCommand('Count characters', () => k2.setStatus('This scene is ' + k2.getMarkdown().length + ' characters long'));
k2.registerCommand('Insert date', () => { if (!k2.insertText(new Date().toLocaleDateString())) k2.setStatus('Open a scene first'); });
k2.registerCommand('Open the save counter', () => k2.showPanel('counter'));

k2.on('tab:save', (e) => { saves++; draw(); k2.log('saved ' + e.title); });
k2.onUnload(() => { host = null; });
```

## Step 7 — When it does not work

| Symptom | Cause | Fix |
|---|---|---|
| No card in the panel at all | The folder is not directly inside `Plugins/` (it is nested) · no project is open · you have not pressed **Reload** | Check the path: `Plugins/hello-k2/plugin.json` |
| The card says **error**, with a message | `plugin.json` is not valid JSON · the code threw while running · the entry file is missing | Read the message on the card, fix the file, then press **Enable** (a plugin that fails is disabled automatically — **Reload alone is not enough; you must press Enable**) |
| The card says **too old** | `minAppVersion` is higher than the app's version | Lower the value, or update the app |
| The card says **Needs permission** | The plugin is in a *project's* folder | Allow it — or develop it in the User folder instead (no need to allow it again every time you edit a file) |
| You edit the code and nothing changes | The file is not saved · you have not pressed **Reload** | — |
| A command does nothing when pressed | The code inside the command threw | The **Log** panel · or DevTools ([chapter 11](11-debugging-testing.md)) |
| `import` / `require` do not work | The file is run as a plain script | Bundle it into one file ([chapter 8](08-packaging-distribution.md#83-several-files-or-typescript-bundle-into-one-file)) |
| `alert()` shows nothing | `window.alert/prompt/confirm` are not available in the app | `k2.alertBox` · `k2.ask` · `k2.confirmBox` |

## Where next

| You want to | Read |
|---|---|
| Know everything `k2` can do | [3. The SDK: the `k2` object](03-sdk-reference.md) |
| Do work automatically when a project opens/a tab is switched/a file is saved | [4. Hooks and lifecycle](04-hooks-lifecycle.md) |
| Read every scene of a project · write a report file | [6. Working with files](06-data-and-files.md) · the [`manuscript-report`](../examples/manuscript-report/main.js) example |
| Use timers / DOM listeners the right way | The [`focus-timer`](../examples/focus-timer/main.js) example |
| Give it to other people | [8. Packaging and distribution](08-packaging-distribution.md) |

---

Next: [2. Anatomy of a plugin →](02-anatomy.md)
