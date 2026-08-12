// sp-format-guide.js — "แสดงรูปแบบ" (ข้อ 61) + เส้นตัดหน้าในตัวแก้ไข (ใช้กับ Draft View ข้อ 57)
//
//   61  เส้นฟ้าที่ขอบซ้าย/ขวาของแต่ละ element + เครื่องหมายบอกชนิดการจบบรรทัด
//   57  เส้นบาง ๆ คั่นหน้า (ตำแหน่งมาจาก paginate ที่ app.js คำนวณให้ แล้วส่งเข้ามา)
//
// ใช้ decoration ของ ProseMirror เท่านั้น — ห้ามใส่ class ลง DOM ตรง ๆ (DOMObserver ซ่อมกลับ)
// รูปแบบเดียวกับ spellPlugin/commentAnchorPlugin ใน editor.js

import { T } from './i18n.js';
import { Plugin as PMPlugin, PluginKey as PMKey } from 'prosemirror-state';
import { Decoration as Deco, DecorationSet as DecoSet } from 'prosemirror-view';
import { lineEndingType, LINE_MARK } from './sp-view.js';
import { createPageBreakPlugin } from './page-break-plugin.js';

// ───────── 61. แสดงรูปแบบ ─────────
const guideKey = new PMKey('kspguide');
let _guideOn = false;
let _guideFmt = null;              // รูปแบบล่าสุด (ใช้ความกว้างต่อ element หา soft/hard)

export function setFormatGuide(on, fmt) {
  _guideOn = !!on;
  if (fmt) _guideFmt = fmt;
}
export function isFormatGuide() { return _guideOn; }

function elWidth(el) {
  const c = _guideFmt && _guideFmt.elements && _guideFmt.elements[el];
  return c ? c.width : 6;
}

function guideDecos(doc) {
  if (!_guideOn || !doc) return DecoSet.empty;
  const out = [];
  doc.forEach((node, pos) => {
    if (!node.type || node.type.name !== 'sp') return;
    const el = (node.attrs && node.attrs.el) || 'action';
    out.push(Deco.node(pos, pos + node.nodeSize, { class: 'sp-fmt-guide' }));
    const kind = lineEndingType(node.textContent || '', elWidth(el));
    out.push(Deco.widget(pos + node.nodeSize - 1, () => {
      const s = document.createElement('span');
      s.className = 'sp-line-marker ' + kind;
      s.textContent = LINE_MARK[kind];
      s.title = kind === 'soft' ? T`ตัดบรรทัดเอง (soft wrap)` : T`จบบรรทัดด้วยการขึ้นบล็อกใหม่ (hard)`;
      s.setAttribute('contenteditable', 'false');
      return s;
    }, { side: 1, key: 'lm' + pos + kind }));
  });
  return DecoSet.create(doc, out);
}

export function spFormatGuidePlugin() {
  return new PMPlugin({
    key: guideKey,
    state: {
      init: (_c, st) => guideDecos(st.doc),
      apply(tr, prev, _o, st) {
        if (!tr.docChanged && !tr.getMeta(guideKey)) return prev.map(tr.mapping, tr.doc);
        return guideDecos(st.doc);
      },
    },
    props: { decorations(state) { return guideKey.getState(state); } },
  });
}
export function refreshFormatGuide(view) {
  if (view) view.dispatch(view.state.tr.setMeta(guideKey, true));
}

// ───────── alpha.57a ข้อ 2 · เลขฉากสองฝั่งหัวฉาก ─────────
// วาดเป็น widget decoration "ข้างใน" บล็อกหัวฉาก → CSS จัดตำแหน่ง absolute เทียบกล่องหัวฉากได้
// (ระยะจริงมาจาก .k-scene-no-l/.k-scene-no-r ที่ spCss() สร้างตามค่าที่ผู้ใช้ตั้ง)
const snKey = new PMKey('kspsceneno');
let _snOn = false;
let _snSuffix = '';

/** เปิด/ปิดเลขฉาก — คืน true เมื่อค่าเปลี่ยนจริง (ผู้เรียกค่อย dispatch) */
export function setSceneNumbers(on, suffix) {
  const next = !!on, sfx = String(suffix ?? '');
  const changed = next !== _snOn || sfx !== _snSuffix;
  _snOn = next; _snSuffix = sfx;
  return changed;
}
export function isSceneNumbers() { return _snOn; }

function snDecos(doc) {
  if (!_snOn || !doc) return DecoSet.empty;
  const out = [];
  let n = 0;
  doc.forEach((node, pos) => {
    if (!node.type || node.type.name !== 'sp') return;
    if (((node.attrs && node.attrs.el) || 'action') !== 'scene') return;
    const no = String(++n) + _snSuffix;
    for (const side of ['l', 'r']) {
      out.push(Deco.widget(pos + 1, () => {
        const s = document.createElement('span');
        s.className = 'k-scene-no k-scene-no-' + side;
        s.textContent = no;
        s.setAttribute('contenteditable', 'false');
        return s;
      }, { side: -1, key: 'sn' + side + pos + no }));
    }
  });
  return DecoSet.create(doc, out);
}

export function spSceneNumberPlugin() {
  return new PMPlugin({
    key: snKey,
    state: {
      init: (_c, st) => snDecos(st.doc),
      apply(tr, prev, _o, st) {
        if (!tr.docChanged && !tr.getMeta(snKey)) return prev.map(tr.mapping, tr.doc);
        return snDecos(st.doc);
      },
    },
    props: { decorations(state) { return snKey.getState(state); } },
  });
}
export function refreshSceneNumbers(view) {
  if (view) view.dispatch(view.state.tr.setMeta(snKey, true));
}

// ───────── 57. เส้นคั่นหน้าในตัวแก้ไข ─────────
// ตำแหน่งมาจาก paginate() ที่ app.js เรียกใน scheduleCount (debounce 300ms)
// เก็บเป็นตัวแปรระดับโมดูลแบบเดียวกับสมอคอมเมนต์ — plugin แค่หยิบไปวาด
const SP_PB = createPageBreakPlugin({
  key: 'ksppagebreak', cls: 'sp-page-break', decoKey: 'pb',
});
/**
 * ตั้งรายการเส้นคั่นหน้า — คืน true เมื่อ "เปลี่ยนจริง"
 * ผู้เรียก (scheduleCount) ใช้ค่านี้ตัดสินว่าจะ dispatch transaction ไหม:
 * การวาด decoration ใหม่ทุก 300ms ทั้งที่ตำแหน่งเท่าเดิม ทำให้ ProseMirror รีเฟรช DOM ฟรี ๆ
 * (เคยไปกวนตำแหน่งเลื่อนของหน้ากระดาษระหว่างซูม)
 */
export const setPageBreaks = SP_PB.setBreaks;
export const pageBreaks = SP_PB.breaks;
export const spPageBreakPlugin = SP_PB.plugin;
export const refreshPageBreaks = SP_PB.refresh;

// ───────── alpha.58 · 55–56 · CONTINUED / (MORE) / (cont'd) ─────────
// เครื่องหมายพวกนี้ "ไม่ใช่เนื้อบท" — ห้ามแทรกเป็นข้อความจริง ไม่งั้นไฟล์ .md เพี้ยนและลบไม่ออก
// จึงวาดเป็น widget decoration แบบเดียวกับเส้นคั่นหน้า (ตำแหน่งมาจาก computeContinueds ใน app.js)
const ctKey = new PMKey('kspcontinued');
let _conts = [];
let _contSig = '';

/** ตั้งรายการเครื่องหมายต่อเนื่อง — คืน true เมื่อ "เปลี่ยนจริง" (ผู้เรียกค่อย dispatch · บทเรียน 44) */
export function setContinueds(list) {
  const next = (list || []).filter((m) => m && Number.isFinite(m.pos) && m.pos > 0 && m.text);
  const sig = next.map((m) => m.pos + ':' + m.type + ':' + m.text).join('|');
  if (sig === _contSig) return false;
  _contSig = sig;
  _conts = next;
  return true;
}
export function continueds() { return _conts.slice(); }

function ctDecos(doc) {
  if (!_conts.length || !doc) return DecoSet.empty;
  const max = doc.content.size;
  const out = [];
  for (const m of _conts) {
    if (m.pos > max) continue;
    out.push(Deco.widget(m.pos, () => {
      const d = document.createElement('div');
      d.className = 'sp sp-cont-mark ' + (m.cls || '');
      d.dataset.contType = m.type;
      d.textContent = m.text;
      d.setAttribute('contenteditable', 'false');
      return d;
    }, { side: m.side ?? 0, key: 'ct' + m.pos + m.type + m.text }));
  }
  return DecoSet.create(doc, out);
}

export function spContinuedPlugin() {
  return new PMPlugin({
    key: ctKey,
    state: {
      init: (_c, st) => ctDecos(st.doc),
      apply(tr, prev, _o, st) {
        if (!tr.docChanged && !tr.getMeta(ctKey)) return prev.map(tr.mapping, tr.doc);
        return ctDecos(st.doc);
      },
    },
    props: { decorations(state) { return ctKey.getState(state); } },
  });
}
export function refreshContinueds(view) {
  if (view) view.dispatch(view.state.tr.setMeta(ctKey, true));
}
