// ค้นหา/แทนที่ ใน ProseMirror — ไฮไลต์ทุกผล + เดินหน้า/ถอยหลัง/แทนที่
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const searchKey = new PluginKey('ksearch');

function findMatches(doc, query) {
  const out = [];
  if (!query) return out;
  const q = query.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text.toLowerCase();
    let i = 0;
    while ((i = text.indexOf(q, i)) !== -1) {
      out.push({ from: pos + i, to: pos + i + query.length });
      i += Math.max(1, query.length);
    }
  });
  return out;
}

export function searchPlugin() {
  return new Plugin({
    key: searchKey,
    state: {
      init: () => ({ query: '', matches: [], decos: DecorationSet.empty }),
      apply(tr, prev, _old, state) {
        const meta = tr.getMeta(searchKey);
        const query = meta !== undefined ? meta : prev.query;
        if (meta === undefined && !tr.docChanged) return prev;
        const matches = findMatches(state.doc, query);
        const decos = DecorationSet.create(state.doc, matches.map((m, i) =>
          Decoration.inline(m.from, m.to, { class: 'find-hit' })));
        return { query, matches, decos };
      },
    },
    props: { decorations(state) { return searchKey.getState(state).decos; } },
  });
}

export function setQuery(view, q) {
  view.dispatch(view.state.tr.setMeta(searchKey, q));
  return searchKey.getState(view.state).matches.length;
}

export function gotoMatch(view, dir) {
  const { matches } = searchKey.getState(view.state);
  if (!matches.length) return 0;
  const cur = view.state.selection.from;
  let m = dir > 0 ? matches.find((x) => x.from > cur) : [...matches].reverse().find((x) => x.from < cur);
  if (!m) m = dir > 0 ? matches[0] : matches[matches.length - 1];
  view.dispatch(view.state.tr.setSelection(
    TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView());
  view.focus();
  return matches.indexOf(m) + 1;
}

export function replaceCurrent(view, text) {
  const { matches, query } = searchKey.getState(view.state);
  const { from, to } = view.state.selection;
  const hit = matches.find((m) => m.from === from && m.to === to);
  if (!hit) { gotoMatch(view, 1); return false; }
  view.dispatch(view.state.tr.insertText(text, from, to));
  gotoMatch(view, 1);
  return true;
}

export function replaceAll(view, text) {
  const { matches } = searchKey.getState(view.state);
  if (!matches.length) return 0;
  let tr = view.state.tr;
  for (const m of [...matches].reverse()) tr = tr.insertText(text, m.from, m.to);
  view.dispatch(tr);
  return matches.length;
}
