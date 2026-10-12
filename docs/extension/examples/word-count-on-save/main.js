// Word count on save — an example from the Killian 2 Extension Guide (docs/extension/)
// Shows: registerPanel · on('tab:save') · registerCommand · registerShortcut · getSettings/setSettings · onUnload
//        and a small string table so the plugin follows the interface language (English / Thai)
//
// This file is run as a plain script with one variable, k2 — there is no import / require / Node.js.

// ── Text in two languages. The interface language is <html lang="…">, set by the app. ──
// A language that is not in the table falls back to English.
const STR = {
  en: {
    panel: 'Word count', count: 'Count words in this scene', open: 'Open the word-count panel',
    words: (n) => n.toLocaleString() + (n === 1 ? ' word' : ' words'),
    scene: (n) => 'This scene has ' + n.toLocaleString() + (n === 1 ? ' word' : ' words'),
    none: 'Nothing has been saved in this project yet',
  },
  th: {
    panel: 'นับคำ', count: 'นับคำฉากนี้', open: 'เปิดแผงนับคำ',
    words: (n) => n.toLocaleString() + ' คำ',
    scene: (n) => 'ฉากนี้มี ' + n.toLocaleString() + ' คำ',
    none: 'ยังไม่มีการบันทึกในผลงานนี้',
  },
};
const T = STR[(document.documentElement.lang || 'en').slice(0, 2)] || STR.en;

// Intl.Segmenter can segment languages written without spaces (Thai, Japanese, Chinese…),
// so never count words with split(' ').
const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
function countWords(md) {
  let n = 0;
  for (const s of seg.segment(String(md || ''))) if (s.isWordLike) n++;
  return n;
}

// A value remembered per project (project.khn.json → settings.plugins[<folder name>])
let last = k2.getSettings('last', null);       // { file, title, words }
let host = null;                               // the panel body element (handed over in render)

function draw() {
  if (!host) return;
  const box = document.createElement('div');
  box.className = 'wcs-box';
  // colours and sizes come from theme variables — never fixed colours
  box.style.cssText = 'padding:12px; color:var(--fg); font-size:calc(13px * var(--ui-scale, 1)); line-height:1.6';
  const big = document.createElement('div');
  big.style.cssText = 'font-size:calc(28px * var(--ui-scale, 1)); color:var(--accent-hi); font-weight:600';
  const sub = document.createElement('div');
  sub.style.color = 'var(--dim)';
  if (last) {
    big.textContent = T.words(last.words);
    sub.textContent = last.title || String(last.file).split(/[\\/]/).pop();   // text from the user → always textContent
  } else {
    big.textContent = '—';
    sub.textContent = T.none;
  }
  box.append(big, sub);
  host.replaceChildren(box);                   // render can be called again → always replace the whole thing
}

k2.registerPanel('summary', {
  title: T.panel,
  icon: 'chart',
  defaultSide: 'right',
  render: (h) => { host = h; draw(); },
});

function report() {
  const words = countWords(k2.getMarkdown());
  k2.setStatus(T.scene(words));
  return words;
}

/** A full machine path → a path relative to the project root (with / separators).
 *  Never write a full path into a project file: it breaks when the project moves to another machine. */
function relPath(full) {
  const root = String(k2.projectRoot() || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const p = String(full || '').replace(/\\/g, '/');
  return root && p.startsWith(root + '/') ? p.slice(root.length + 1) : p.split('/').pop();
}

// An app event — handlers registered through k2.on are removed for you when the plugin is disabled/uninstalled.
// e.file is a full machine path → make it relative before storing it with setSettings (which lands in the project file).
k2.on('tab:save', (e) => {
  last = { file: relPath(e.file), title: e.title, words: countWords(k2.getMarkdown()) };
  k2.setSettings('last', last);
  draw();
  // No k2.setStatus here: the app writes its own "saved" message to the status bar straight after this event,
  // so ours would be overwritten. The result is shown in the panel instead
  // (or deferred with setTimeout if it really has to appear on the status bar).
});

// A different project = the remembered value is the new project's
k2.on('project:open', () => { last = k2.getSettings('last', null); draw(); });

k2.registerCommand(T.count, report);
k2.registerCommand(T.open, () => k2.showPanel('summary'));
k2.registerShortcut('count', 'F8', true, true, report);          // Ctrl+Shift+F8 (⌘⇧F8 on macOS)

// Nothing was created outside k2 (no timers, no DOM listeners) → only our own variable needs clearing,
// which is why plugin.json can declare "hotReload": true.
k2.onUnload(() => { host = null; });
