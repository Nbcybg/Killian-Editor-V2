// ProseMirror editor — หัวใจของ Killian 2 (word-processor grade)
import { t as tt, t } from './i18n.js';
import { Schema } from 'prosemirror-model';
import { EditorState, Plugin, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, setBlockType, wrapIn, lift, chainCommands,
         splitBlockKeepMarks, newlineInCode, exitCode } from 'prosemirror-commands';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { inputRules, wrappingInputRule, textblockTypeInputRule,
         smartQuotes, InputRule } from 'prosemirror-inputrules';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { mdToDoc, docToMd, collectAlign } from './md.js';
import { searchPlugin } from './search.js';
// [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ (โมดูลบริสุทธิ์ — ไม่ import prosemirror)
import { caseTransform } from './text-case.js';
// [alpha.58r บั๊ก 20] เส้นคั่นหน้าของนิยาย — คนละคีย์กับของบทภาพยนตร์
import { prosePageBreakPlugin } from './prose-view.js';
// [alpha.60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด (`.` `@` `>` `$shot` `#` …) โดยไม่แตะไฟล์
import { markdownCodePlugin } from './markdown-code-toggle.js';
import { Plugin as PMPlugin, PluginKey as PMKey } from 'prosemirror-state';
import { Decoration as Deco, DecorationSet as DecoSet } from 'prosemirror-view';

// ══════════ alpha.58 (บั๊ก 4) — decoration แบบ "ทาสีเฉพาะบล็อกที่เปลี่ยน" ══════════
// อาการ: พิมพ์ในไฟล์ยาว ๆ แล้วโปรแกรมกระตุก
// เหตุ: ปลั๊กอิน decoration ทุกตัว (ตรวจคำผิด · ชื่อ Wiki · สมอคอมเมนต์) สแกน "ทั้งเอกสาร"
//       ใหม่ทุกครั้งที่ doc เปลี่ยน = ทุกตัวอักษรที่พิมพ์ → O(ความยาวไฟล์) ต่อ 1 keystroke
//       ยิ่งไฟล์ยาว ยิ่งหน่วง (บทยาว ๆ สแกนหลายพันโหนดต่อการกดปุ่มหนึ่งครั้ง)
// แก้: ย้าย decoration เก่าตามการแก้ไข (prev.map) แล้วสแกนใหม่เฉพาะ "บล็อกระดับบนที่ถูกแตะ"
//      ผลลัพธ์เท่าเดิมทุกประการ เพราะ decoration ทั้งสามชนิดคิดจากข้อความในบล็อกเดียวเท่านั้น
//      (ไม่มีตัวไหนข้ามบล็อก) — ของที่ต้องดูทั้งเอกสารอย่างเลขฉาก/เส้นคั่นหน้าไม่ได้ใช้ทางนี้

/** ช่วงที่ transaction ไปแตะ (พิกัดของ doc ใหม่) — คืน null เมื่อหาไม่ได้ */
function changedRange(tr) {
  let from = Infinity, to = -Infinity;
  for (let i = 0; i < tr.mapping.maps.length; i++) {
    const rest = tr.mapping.slice(i + 1);
    tr.mapping.maps[i].forEach((_os, _oe, ns, ne) => {
      from = Math.min(from, rest.map(ns, -1));
      to = Math.max(to, rest.map(ne, 1));
    });
  }
  return from <= to ? { from, to } : null;
}

/** ขยายช่วงให้ครอบบล็อกระดับบนทั้งใบ (decoration คิดจากทั้งบล็อกเสมอ) */
function blockRange(doc, from, to) {
  const size = doc.content.size;
  const clamp = (v) => Math.max(0, Math.min(v, size));
  const $f = doc.resolve(clamp(from));
  const $t = doc.resolve(clamp(to));
  return { from: $f.depth ? $f.before(1) : 0, to: $t.depth ? $t.after(1) : size };
}

/**
 * state ของปลั๊กอิน decoration ที่คำนวณใหม่เฉพาะส่วนที่เปลี่ยน
 * @param {PMKey} key
 * @param {(doc, from, to) => Decoration[]} scan สแกนช่วง [from,to] คืนรายการ decoration
 */
function incrementalDecoState(key, scan) {
  const full = (doc) => DecoSet.create(doc, scan(doc, 0, doc.content.size));
  return {
    init: (_c, st) => full(st.doc),
    apply(tr, prev, _o, st) {
      if (tr.getMeta(key)) return full(st.doc);              // สั่งวาดใหม่ทั้งหมด (เปลี่ยนพจนานุกรม ฯลฯ)
      if (!tr.docChanged) return prev.map(tr.mapping, tr.doc);
      const ch = changedRange(tr);
      if (!ch) return prev.map(tr.mapping, tr.doc);
      const r = blockRange(st.doc, ch.from, ch.to);
      const moved = prev.map(tr.mapping, tr.doc);
      const kept = moved.remove(moved.find(r.from, r.to));
      return kept.add(st.doc, scan(st.doc, r.from, r.to));
    },
  };
}

// ---- mention: ไฮไลต์ชื่อจาก Wiki (Ctrl/Cmd+Click เปิดหน้า Wiki) ----
const mentionKey = new PMKey('kmention');
function buildMentionRegex(names) {
  if (!names || !names.length) return null;
  // ข้ามชื่อสั้นเกินไป (< 2 ตัวอักษร) — กันชื่อพยางค์เดียวไปแมตช์ทั่วทั้งบรรทัดจนไฮไลต์ลาม
  const usable = names.filter((n) => n && n.length >= 2);
  if (!usable.length) return null;
  const esc = usable.slice().sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp('\\[\\[(?:[^\\]]+)\\]\\]|' + esc.join('|'), 'g');
}
function mentionScan(doc, rx, from, to) {
  if (!rx) return [];
  const out = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(node.text))) {
      out.push(Deco.inline(pos + m.index, pos + m.index + m[0].length,
        { class: 'k-mention', title: tt('ui.editor.ctrlClickOpenWiki') }));
    }
  });
  return out;
}
export function mentionPlugin(getNames) {
  // สร้าง regex ใหม่เฉพาะตอนรายชื่อเปลี่ยนจริง — เดิมสร้างใหม่ทุก keystroke (ชื่อเป็นร้อยตัว)
  let cacheKey = null, cacheRx = null;
  const rxOf = () => {
    const names = getNames() || [];
    const k = names.length + '|' + names.join('');
    if (k !== cacheKey) { cacheKey = k; cacheRx = buildMentionRegex(names); }
    return cacheRx;
  };
  return new PMPlugin({
    key: mentionKey,
    state: incrementalDecoState(mentionKey, (doc, from, to) => mentionScan(doc, rxOf(), from, to)),
    props: { decorations(state) { return mentionKey.getState(state); } },
  });
}
export function refreshMentions(view) {
  view.dispatch(view.state.tr.setMeta(mentionKey, true));
}

// ---- ตรวจคำผิด: ขีดเส้นใต้แดงคำที่น่าจะสะกดผิด (ผสมกับ Chromium native ได้) ----
const spellKey = new PMKey('kspell');
function spellScan(doc, checkFn, from, to) {
  if (!checkFn) return [];
  const out = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) {
      // ไม่ตรวจคำผิดในหัวฉาก/ชื่อตัวละคร/ทรานซิชัน (เป็นชื่อเฉพาะ/คำย่อ — ขีดแดงรกเปล่า ๆ)
      if (node.type && node.type.name === 'sp' &&
          ['character', 'scene', 'transition'].includes(node.attrs.el)) return false;
      return;
    }
    for (const b of checkFn(node.text)) {
      out.push(Deco.inline(pos + b.start, pos + b.end,
        { class: 'k-spell-bad', title: tt('ui.editor.press') + b.word }));
    }
  });
  return out;
}
// getChecker: () => (text)=>[{start,end,word}]  หรือ null เมื่อปิด/ยังไม่พร้อม
export function spellPlugin(getChecker) {
  return new PMPlugin({
    key: spellKey,
    state: incrementalDecoState(spellKey,
      (doc, from, to) => spellScan(doc, getChecker(), from, to)),
    props: { decorations(state) { return spellKey.getState(state); } },
  });
}
export function refreshSpell(view) {
  if (view) view.dispatch(view.state.tr.setMeta(spellKey, true));
}

// ---- โหมดโฟกัส: ไฮไลต์บล็อกที่เคอร์เซอร์อยู่ (ต้องเป็น decoration ของ ProseMirror เท่านั้น) ----
// เคยลองใส่ class ลง DOM ตรง ๆ แล้ว DOMObserver ของ PM ซ่อมกลับทันที (และ MutationObserver สู้กันจนค้าง)
const focusKey = new PMKey('kfocusline');
let _focusOn = false;
export function setFocusLine(on) { _focusOn = !!on; }
function focusDecos(st) {
  if (!_focusOn) return DecoSet.empty;
  const $from = st.selection.$from;
  if (!$from.depth) return DecoSet.empty;
  const from = $from.before(1), to = $from.after(1);
  return DecoSet.create(st.doc, [Deco.node(from, to, { class: 'fm2-active' })]);
}
export function focusLinePlugin() {
  return new PMPlugin({
    key: focusKey,
    state: {
      init: (_c, st) => focusDecos(st),
      apply: (_tr, _prev, _o, st) => focusDecos(st),      // คำนวณใหม่ทุก transaction (ถูกเสมอ)
    },
    props: { decorations(state) { return focusKey.getState(state); } },
  });
}
export function refreshFocusLine(view) {
  if (view) view.dispatch(view.state.tr.setMeta(focusKey, true));
}

// ---- สมอคอมเมนต์: ไฮไลต์ข้อความที่มีคอมเมนต์ผูกอยู่ (บั๊ก #25) ----
// ใช้ decoration แบบเดียวกับตรวจคำผิด — ห้ามใส่ class ลง DOM ตรง ๆ (DOMObserver ของ PM ซ่อมกลับ)
// จับคู่ด้วย "ข้อความที่คอมเมนต์" (quote) ไม่ใช่ offset — ผู้เขียนแก้ไฟล์แล้วไฮไลต์ยังตามไปถูกที่
const cmKey = new PMKey('kcomment');
let _cmQuotes = [], _cmActive = '';
export function setCommentAnchors(quotes, active) {
  _cmQuotes = [...new Set((quotes || []).filter((q) => q && q.length >= 2))];   // '' ทำให้ indexOf วนไม่รู้จบ
  _cmActive = active || '';
}
export function commentAnchors() { return _cmQuotes.slice(); }
function cmScan(doc, from, to) {
  if (!_cmQuotes.length) return [];
  const out = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    for (const q of _cmQuotes) {
      let i = -1;
      while ((i = node.text.indexOf(q, i + 1)) >= 0) {
        out.push(Deco.inline(pos + i, pos + i + q.length,
          { class: 'k-cm-anchor' + (q === _cmActive ? ' on' : ''), title: tt('ui.editor.hasCommentBindText') }));
      }
    }
  });
  return out;
}
export function commentAnchorPlugin() {
  return new PMPlugin({
    key: cmKey,
    state: incrementalDecoState(cmKey, cmScan),
    props: { decorations(state) { return cmKey.getState(state); } },
  });
}
export function refreshCommentAnchors(view) {
  if (view) view.dispatch(view.state.tr.setMeta(cmKey, true));
}


export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*',
                 attrs: { align: { default: null } },
                 parseDOM: [{ tag: 'p', getAttrs: (d) => ({ align: d.style.textAlign || null }) }],
                 toDOM: (n) => ['p', n.attrs.align ? { style: 'text-align:' + n.attrs.align } : {}, 0] },
    heading: { group: 'block', content: 'inline*', defining: true,
               attrs: { level: { default: 1 }, align: { default: null } },
               parseDOM: [1, 2, 3, 4, 5, 6].map((l) => ({ tag: 'h' + l,
                 getAttrs: (d) => ({ level: l, align: d.style.textAlign || null }) })),
               toDOM: (n) => ['h' + n.attrs.level,
                 n.attrs.align ? { style: 'text-align:' + n.attrs.align } : {}, 0] },
    blockquote: { group: 'block', content: 'paragraph+', defining: true,
                  parseDOM: [{ tag: 'blockquote' }], toDOM: () => ['blockquote', 0] },
    bullet_list: { group: 'block', content: 'list_item+',
                   parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
    ordered_list: { group: 'block', content: 'list_item+', attrs: { order: { default: 1 } },
                    parseDOM: [{ tag: 'ol', getAttrs: (d) => ({ order: d.hasAttribute('start') ? +d.getAttribute('start') : 1 }) }],
                    toDOM: (n) => ['ol', n.attrs.order === 1 ? {} : { start: n.attrs.order }, 0] },
    list_item: { content: 'paragraph+', defining: true,
                 parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
    figure: { group: 'block', atom: true, draggable: true, selectable: true,
              attrs: { src: {}, alt: { default: '' }, md: { default: '' }, resolved: { default: '' } },
              parseDOM: [{ tag: 'figure[data-md]', getAttrs: (d) => ({
                src: d.getAttribute('data-src') || '', alt: d.getAttribute('data-alt') || '',
                md: d.getAttribute('data-md') || '', resolved: '' }) }],
              toDOM: (n) => ['figure', { 'data-md': n.attrs.md, 'data-src': n.attrs.src,
                                         'data-alt': n.attrs.alt, title: n.attrs.alt || '' },
                             ['img', { src: n.attrs.resolved || n.attrs.src,
                                       alt: n.attrs.alt, title: n.attrs.alt || '',
                                       draggable: 'false' }]] },
    // [alpha.58r บั๊ก 27] เส้นคั่น + บล็อกโค้ด (เดิม schema ไม่มี → พิมพ์ ``` หรือ --- แล้วหายไปเฉย ๆ)
    horizontal_rule: { group: 'block', atom: true, selectable: true,
                       parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
    // [alpha.61 ข้อ 3] Shift+Enter = ขึ้นบรรทัดในย่อหน้าเดิม (ไม่กินระบบย่อหน้าของนิยาย)
    hard_break: { group: 'inline', inline: true, selectable: false,
                  parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
    // [alpha.61 ข้อ 3] Ctrl+Enter = ขึ้นหน้าใหม่ด้วยมือ (เส้นบังคับ · ไม่ใช่เส้นคั่นหน้าอัตโนมัติ)
    page_break: { group: 'block', atom: true, selectable: true,
                  parseDOM: [{ tag: 'div.k-manual-page-break' }],
                  toDOM: () => ['div', { class: 'k-manual-page-break',
                                         contenteditable: 'false',
                                         'data-label': tt('ui.editor.pageBreak') }] },
    code_block: { group: 'block', content: 'text*', marks: '', code: true, defining: true,
                  attrs: { lang: { default: '' }, fence: { default: '```' } },
                  parseDOM: [{ tag: 'pre', preserveWhitespace: 'full',
                    getAttrs: (d) => ({ lang: d.getAttribute('data-lang') || '' }) }],
                  toDOM: (n) => ['pre', n.attrs.lang ? { 'data-lang': n.attrs.lang } : {}, ['code', 0]] },
    text: { group: 'inline' },
  },
  marks: {
    strong: { parseDOM: [{ tag: 'strong' }, { tag: 'b' }], toDOM: () => ['strong', 0] },
    em: { parseDOM: [{ tag: 'em' }, { tag: 'i' }], toDOM: () => ['em', 0] },
    underline: { parseDOM: [{ tag: 'u' }], toDOM: () => ['u', 0] },
    strike: { parseDOM: [{ tag: 's' }, { tag: 'del' }], toDOM: () => ['s', 0] },
  },
});

// ---- input rules: พิมพ์ markdown แล้วแปลงให้ทันที (แบบ Notion) ----
function markRule(regexp, markType) {
  return new InputRule(regexp, (state, match, start, end) => {
    const tr = state.tr;
    tr.insertText(match[2], start, end);
    tr.addMark(start, start + match[2].length, markType.create());
    tr.removeStoredMark(markType);
    return tr;
  });
}
function buildRules(s) {
  return inputRules({ rules: [
    ...smartQuotes,
    textblockTypeInputRule(/^(#{1,6})\s$/, s.nodes.heading,
      (m) => ({ level: m[1].length })),
    wrappingInputRule(/^\s*>\s$/, s.nodes.blockquote),
    wrappingInputRule(/^\s*[-*]\s$/, s.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, s.nodes.ordered_list,
      (m) => ({ order: +m[1] }), (m, n) => n.childCount + n.attrs.order === +m[1]),
    markRule(/(\*\*)([^*]+)\*\*$/, s.marks.strong),
    markRule(/(~~)([^~]+)~~$/, s.marks.strike),
    // [alpha.58r บั๊ก 27] พิมพ์ ``` แล้วได้บล็อกโค้ด · พิมพ์ --- แล้วได้เส้นคั่น
    textblockTypeInputRule(/^```([\w+-]*)\s$/, s.nodes.code_block, (m) => ({ lang: m[1] || '' })),
    new InputRule(/^(?:-{3,}|\*{3,}|_{3,})$/, (state, match, start, end) =>
      state.tr.replaceRangeWith(start, end, s.nodes.horizontal_rule.create())),
  ] });
}

// ══════════ [alpha.61 ข้อ 3] คำสั่งพื้นฐานที่หายไป: Tab · Shift+Enter · Ctrl+Enter ══════════
// ทั้งสามตัวเป็น PM command มาตรฐาน (state, dispatch) → คืน false เมื่อทำไม่ได้
// เพื่อให้ chainCommands ส่งต่อให้ตัวถัดไป (เช่น Tab ในรายการ = ลดชั้น ไม่ใช่เยื้อง)

/** Shift+Enter — ขึ้นบรรทัดใน "ย่อหน้าเดิม" (ไม่แตกย่อหน้า จึงไม่โดนย่อหน้าอัตโนมัติของนิยาย) */
export function insertHardBreak(state, dispatch) {
  const br = state.schema.nodes.hard_break;
  if (!br) return false;
  const { $from } = state.selection;
  if (!$from.parent.type.spec.content || !$from.parent.inlineContent) return false;
  if (dispatch) dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
  return true;
}

/** Ctrl+Enter — ขึ้นหน้าใหม่ด้วยมือ (แทรกบล็อก page_break แล้ววางเคอร์เซอร์ต่อท้าย) */
export function insertPageBreak(state, dispatch) {
  const pb = state.schema.nodes.page_break;
  if (!pb) return false;
  if (dispatch) {
    let tr = state.tr.replaceSelectionWith(pb.create());
    // หลังเส้นต้องมีย่อหน้าให้พิมพ์ต่อเสมอ ไม่งั้นเคอร์เซอร์ค้างบน atom
    const end = tr.selection.to;
    if (!tr.doc.resolve(Math.min(end, tr.doc.content.size)).nodeAfter) {
      tr = tr.insert(end, state.schema.nodes.paragraph.create());
    }
    const $p = tr.doc.resolve(Math.min(tr.selection.to + 1, tr.doc.content.size));
    dispatch(tr.setSelection(TextSelection.near($p, 1)).scrollIntoView());
  }
  return true;
}

/** Tab — เยื้องด้วยอักขระแท็บจริง (ไฟล์ .md เก็บได้ตรง ๆ · round-trip ไม่เพี้ยน) */
export function insertTab(state, dispatch) {
  if (!state.selection.$from.parent.inlineContent) return false;
  if (dispatch) dispatch(state.tr.insertText('\t').scrollIntoView());
  return true;
}

/** Shift+Tab — ถอนแท็บที่อยู่ก่อนเคอร์เซอร์ (หรือแท็บนำหน้าบรรทัด) */
export function removeTab(state, dispatch) {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.inlineContent) return false;
  const off = $from.parentOffset;
  const start = $from.start();
  // ก่อนเคอร์เซอร์เป็นแท็บ → ลบตัวนั้น · ไม่งั้นลบแท็บนำหน้าบรรทัดหนึ่งตัว
  if (off > 0 && $from.parent.textBetween(off - 1, off) === '\t') {
    if (dispatch) dispatch(state.tr.delete(start + off - 1, start + off));
    return true;
  }
  if ($from.parent.textBetween(0, Math.min(1, $from.parent.content.size)) === '\t') {
    if (dispatch) dispatch(state.tr.delete(start, start + 1));
    return true;
  }
  return false;
}

export class KEditor {
  constructor(mount, { markdown = '', onChange = null, resolveSrc = (p) => p,
                       onKeyDown = null, getNames = null, onMention = null, getChecker = null,
                       editable = null, alignMap = null, alignComments = false } = {}) {
    this.onChange = onChange;
    this.resolveSrc = resolveSrc;
    this.getNames = getNames;
    this.getChecker = getChecker;
    this.editableFn = editable;
    // [alpha.58r บั๊ก 25] alignComments=false → .md สะอาด (align ไปอยู่ใน frontmatter)
    this.alignComments = !!alignComments;
    const doc = this._docFromMd(markdown, alignMap);
    const self = this;
    this.view = new EditorView(mount, {
      editable: editable ? () => editable() : undefined,
      state: this._mkState(doc),
      handleKeyDown(view, ev) { return onKeyDown ? onKeyDown(ev) : false; },
      handleDOMEvents: {
        mousedown(view, ev) {
          if (!onMention || !(ev.ctrlKey || ev.metaKey)) return false;
          const t = ev.target && ev.target.closest && ev.target.closest('.k-mention');
          if (!t) return false;
          ev.preventDefault();
          onMention(t.textContent.replace(/^\[\[|\]\]$/g, ''));
          return true;
        },
        auxclick(view, ev) {                    // คลิกกลางก็เปิดได้ (ไม่ต้องกด Ctrl)
          if (!onMention || ev.button !== 1) return false;
          const t = ev.target && ev.target.closest && ev.target.closest('.k-mention');
          if (!t) return false;
          ev.preventDefault();
          onMention(t.textContent.replace(/^\[\[|\]\]$/g, ''));
          return true;
        },
      },
      dispatchTransaction(tr) {
        const st = self.view.state.apply(tr);
        self.view.updateState(st);
        if (tr.docChanged && self.onChange) self.onChange();
      },
    });
  }

  pressEnter() {
    chainCommands(splitListItem(schema.nodes.list_item), splitBlockKeepMarks)(
      this.view.state, this.view.dispatch, this.view);
  }

  _mkState(doc) {
    return EditorState.create({
      doc, schema,
      plugins: [
        ...(this.getNames ? [mentionPlugin(this.getNames)] : []),
        ...(this.getChecker ? [spellPlugin(this.getChecker)] : []),
        focusLinePlugin(),
        commentAnchorPlugin(),
        prosePageBreakPlugin(),          // [20] เส้นคั่นหน้าของนิยาย
        // [alpha.60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด (fountain/มาร์กดาวน์) — ไม่แตะไฟล์
        markdownCodePlugin(incrementalDecoState),
        buildRules(schema),
        keymap({
          // ขึ้นบรรทัดใหม่แล้วรูปแบบตัวอักษร (หนา/เอียง/ขีด) ต้องติดไปด้วย — แบบ Word
          // ในบล็อกโค้ด Enter = ขึ้นบรรทัดใน pre (ไม่ใช่แตกบล็อก)
          Enter: chainCommands(newlineInCode, splitListItem(schema.nodes.list_item), splitBlockKeepMarks),
          // [alpha.61 ข้อ 3] Shift+Enter = ขึ้นบรรทัด "ในย่อหน้าเดิม" (bypass ระบบย่อหน้า)
          //   ในบล็อกโค้ดยังเป็นทางออกจากบล็อกเหมือนเดิม (exitCode มาก่อน)
          'Shift-Enter': chainCommands(exitCode, insertHardBreak),
          // [alpha.61 ข้อ 3] Ctrl/⌘+Enter = ขึ้นหน้าใหม่ด้วยมือ
          'Mod-Enter': chainCommands(insertPageBreak),
          // [alpha.61 ข้อ 3] Tab = เยื้อง (ในรายการ = ลดชั้น) — เดิมไม่ทำอะไรแล้วโฟกัสหลุดไปแถบรูปแบบ
          Tab: chainCommands(sinkListItem(schema.nodes.list_item), insertTab),
          'Shift-Tab': chainCommands(liftListItem(schema.nodes.list_item), removeTab),
        }),
        keymap(baseKeymap),
        history(),
        searchPlugin(),
        dropCursor({ color: '#d97757' }),
        gapCursor(),
      ],
    });
  }

  _docFromMd(md, alignMap) {
    const json = mdToDoc(md, alignMap);
    for (const n of json.content) {
      if (n.type === 'figure') n.attrs.resolved = this.resolveSrc(n.attrs.src);
    }
    return schema.nodeFromJSON(json);
  }

  // ---------- content ----------
  getMarkdown(opts) {
    return docToMd(this.view.state.doc.toJSON(),
                   opts || { alignComments: this.alignComments });
  }
  /** แผนที่จัดหน้าของบล็อกระดับบน — เก็บลง frontmatter (`align: [3:center]`) */
  getAlignMap() { return collectAlign(this.view.state.doc.toJSON()); }
  setMarkdown(md, alignMap) {
    this.view.updateState(this._mkState(this._docFromMd(md, alignMap)));
  }
  getText() { return this.view.state.doc.textBetween(0, this.view.state.doc.content.size, '\n'); }

  /** [alpha.58r บั๊ก 20] ย้ายเคอร์เซอร์ไปตำแหน่ง pos แล้วเลื่อนจอให้เห็น (คู่กับ SPEditor.gotoPos) */
  gotoPos(pos) {
    const v = this.view;
    const p = Math.max(0, Math.min(Number(pos) || 0, v.state.doc.content.size));
    v.dispatch(v.state.tr.setSelection(TextSelection.near(v.state.doc.resolve(p), 1)).scrollIntoView());
    v.focus();
    return true;
  }

  // ---------- commands (เรียกจากเมนู Electron — คีย์ลัดเลยใช้ได้ทุก layout รวมไทย) ----------
  cmd(name, arg) {
    const s = schema; const v = this.view;
    const run = (c) => { c(v.state, v.dispatch, v); v.focus(); };
    switch (name) {
      case 'bold': return run(toggleMark(s.marks.strong));
      case 'italic': return run(toggleMark(s.marks.em));
      case 'underline': return run(toggleMark(s.marks.underline));
      case 'strike': return run(toggleMark(s.marks.strike));
      case 'undo': return run(undo);
      case 'redo': return run(redo);
      case 'paragraph': return run(setBlockType(s.nodes.paragraph));
      case 'heading': return run(setBlockType(s.nodes.heading, { level: arg || 1 }));
      case 'quote': return run(wrapIn(s.nodes.blockquote));
      case 'lift': return run(lift);
      case 'ul': return run(wrapInList(s.nodes.bullet_list));
      case 'ol': return run(wrapInList(s.nodes.ordered_list));
      // [alpha.58r บั๊ก 27] เส้นคั่น + บล็อกโค้ด
      case 'code': return run(setBlockType(s.nodes.code_block));
      case 'hr': {
        v.dispatch(v.state.tr.replaceSelectionWith(s.nodes.horizontal_rule.create()).scrollIntoView());
        v.focus(); return;
      }
      case 'align': {
        // จัดหน้าย่อหน้า/หัวข้อทุกบล็อกในช่วงเลือก (arg: 'left'|'center'|'right'|'justify' · null=ชิดซ้ายปกติ)
        const val = arg === 'left' ? null : arg;
        const { from, to } = v.state.selection;
        let tr = v.state.tr, changed = false;
        v.state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type === s.nodes.paragraph || node.type === s.nodes.heading) {
            tr = tr.setNodeMarkup(pos, null, { ...node.attrs, align: val }); changed = true;
          }
        });
        if (changed) v.dispatch(tr);
        v.focus(); return;
      }
      case 'clear': {
        const { from, to } = v.state.selection;
        let tr = v.state.tr;
        for (const mk of Object.values(s.marks)) tr = tr.removeMark(from, to, mk);
        v.dispatch(tr); v.focus(); return;
      }
      // [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ของช่วงที่เลือก (Sentence/lower/UPPER/Capitalize/aLt/Title/iNVERSE)
      case 'case': {
        const tr = caseTransform(v.state, arg);
        if (tr) v.dispatch(tr.scrollIntoView());
        v.focus(); return !!tr;
      }
    }
  }

  insertImage(src, alt, md) {
    const node = schema.nodes.figure.create({ src, alt, md, resolved: this.resolveSrc(src) });
    this.view.dispatch(this.view.state.tr.replaceSelectionWith(node).scrollIntoView());
    this.view.focus();
  }

  // ---------- state สำหรับ toolbar ----------
  activeMarks() {
    const st = this.view.state;
    const out = {};
    for (const [k, mk] of Object.entries(schema.marks)) {
      const { from, $from, to, empty } = st.selection;
      out[k] = empty ? !!mk.isInSet(st.storedMarks || $from.marks())
                     : st.doc.rangeHasMark(from, to, mk);
    }
    const p = st.selection.$from.parent;
    out.block = p.type.name === 'heading' ? 'h' + p.attrs.level
      : p.type.name === 'code_block' ? 'code'
      : st.selection.$from.node(-1) && st.selection.$from.node(-1).type.name === 'blockquote' ? 'quote'
      : 'p';
    out.align = (p.type.name === 'paragraph' || p.type.name === 'heading') ? (p.attrs.align || 'left') : null;
    return out;
  }

  focus() { this.view.focus(); }
  destroy() { this.view.destroy(); }
}
