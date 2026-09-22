// sp-format-guide.js — "แสดงรูปแบบ" (ข้อ 61) + เส้นตัดหน้าในตัวแก้ไข (ใช้กับ Draft View ข้อ 57)
//
//   61  เส้นฟ้าที่ขอบซ้าย/ขวาของแต่ละ element + เครื่องหมายบอกชนิดการจบบรรทัด
//   57  เส้นบาง ๆ คั่นหน้า (ตำแหน่งมาจาก paginate ที่ app.js คำนวณให้ แล้วส่งเข้ามา)
//
// ใช้ decoration ของ ProseMirror เท่านั้น — ห้ามใส่ class ลง DOM ตรง ๆ (DOMObserver ซ่อมกลับ)
// รูปแบบเดียวกับ spellPlugin/commentAnchorPlugin ใน editor.js

import { t } from './i18n.js';
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
      s.title = kind === 'soft' ? t('ui.spFormatGuide.cutLineSoftWrap') : t('ui.spFormatGuide.endLineBlockNew');
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

// ───────── [alpha.124 ข้อ 33] ทำเครื่องหมาย "ข้อผิดพลาดของบท" ในเอกสาร ─────────
//
// ★ ปัญหาเดิม: ตัวตรวจบททำงานถูกต้องอยู่แล้ว แต่ผลออกทาง **ป้ายบนแถบสถานะ** อย่างเดียว
//   (⚠️ 7 ▾) ต้องกดกระโดดไปทีละจุดถึงจะรู้ว่าที่ไหน — ต่างจากตัวตรวจคำผิดที่ขีดเส้นแดง
//   ให้เห็นตรงคำเลย · ผลคือคนส่วนใหญ่ไม่เคยรู้ว่าบทตัวเองมีอะไรผิดตรงไหนบ้าง
//
// ที่นี่ทำแบบเดียวกับเส้นแดงของคำผิด: decoration ระดับ **โหนด** ทับบล็อกที่มีปัญหา
// (ห้ามใส่ class ลง DOM ตรง ๆ — DOMObserver ของ ProseMirror ซ่อนกลับหมด)
// ตำแหน่งมาจาก `checkScreenplay()` ใน app.js ซึ่งผูก `pos` จริงให้ทุกข้อแล้ว
const errKey = new PMKey('ksperrmark');
// ══ [alpha.160 · P1-1] ★ จุดที่ผิดเป็น "ของแต่ละตัวแก้ไข" (ตระกูลเดียวกับ H15/H16 · CONTINUED) ══
// เดิม `_errMarks` เป็นตัวแปรระดับโมดูลก้อนเดียว — ทุก `spErrorMarkPlugin()` อ่านก้อนเดียวกัน
// แต่ app.js ตั้งค่าเฉพาะแท็บที่ active → เปิดบทสองแท็บ/แยกจอ แล้วอีกแท็บวาดเส้นเหลือง/แดงของอีกเรื่อง
// (ตำแหน่งของเอกสาร A ถูกเอาไปขีดบนเอกสาร B) · ตอนนี้ปลั๊กอินหนึ่งตัว = รายการหนึ่งชุด ผูก view ผ่าน view hook
const EM = { byView: new WeakMap(), cur: null, detached: { list: [] } };   // list = [{pos, severity}]
const emInst = (view) => (view && EM.byView.get(view)) || EM.cur || EM.detached;
let _errOn = true;

/**
 * [alpha.127] เปิด/ปิดการทำเครื่องหมายในเอกสาร
 *
 * ผู้ใช้: *"แถบเหลืองที่แสดงจุด error ในชุดตรวจบทภาพยนตร์ เพิ่มว่าสามารถเปิดปิดได้ให้หน่อย"*
 *
 * เหตุผลที่ต้องปิดได้จริง: ตอน "เขียนร่างแรกให้จบก่อน" ทุกบล็อกยังไม่เข้ารูป — เส้นขอบ
 * เหลือง/แดงเต็มหน้าเลยกลายเป็นเสียงรบกวนแทนที่จะเป็นตัวช่วย · ป้ายสรุป ⚠ บนแถบสถานะ
 * ยังอยู่เหมือนเดิม จึงยังรู้ว่ามีกี่จุดโดยไม่ต้องมองเส้น
 *
 * ค่าเริ่มต้น = เปิด (พฤติกรรมเดิมของ alpha.124)
 * @returns {boolean} true = ค่าเปลี่ยนจริง (ผู้เรียกค่อยสั่งวาดใหม่)
 */
export function setSpErrorMarksOn(on) {
  const next = !!on;
  const changed = next !== _errOn;
  _errOn = next;
  return changed;
}
export function isSpErrorMarks() { return _errOn; }
/** จุดที่ทำเครื่องหมายอยู่ตอนนี้ (เทส/วินิจฉัยใช้) */
export function spErrorMarks(view) { return emInst(view).list.slice(); }

/**
 * ตั้งรายการจุดที่ผิด — คืน true เมื่อ "เปลี่ยนจริง" เท่านั้น
 * (บทเรียนเดียวกับ setPageBreaks: ตัวตรวจวิ่งทุก 300ms การ dispatch ทุกครั้งที่ผลเท่าเดิม
 *  ทำให้ ProseMirror วาด DOM ใหม่ฟรี ๆ และไปกวนตำแหน่งเลื่อน/เคอร์เซอร์)
 */
export function setSpErrorMarks(list, view) {
  const I = emInst(view);
  if (I !== EM.detached) EM.cur = I;
  const next = (list || [])
    .filter((e) => Number.isFinite(e.pos))
    .map((e) => ({ pos: e.pos, severity: e.severity === 'error' ? 'error' : 'warn' }));
  const same = next.length === I.list.length
    && next.every((e, i) => e.pos === I.list[i].pos && e.severity === I.list[i].severity);
  I.list = next;
  return !same;
}

function errDecos(I, doc) {
  if (!_errOn || !doc || !I.list.length) return DecoSet.empty;
  // จุดเดียวกันอาจมีหลายข้อ — เอาระดับรุนแรงสุดของตำแหน่งนั้น
  const worst = new Map();
  for (const m of I.list) {
    if (worst.get(m.pos) !== 'error') worst.set(m.pos, m.severity);
  }
  const out = [];
  doc.forEach((node, pos) => {
    const sev = worst.get(pos);
    if (!sev) return;
    out.push(Deco.node(pos, pos + node.nodeSize, { class: 'sp-err-' + sev }));
  });
  return DecoSet.create(doc, out);
}

export function spErrorMarkPlugin() {
  const I = { list: [] };
  return new PMPlugin({
    key: errKey,
    state: {
      init: (_c, st) => errDecos(I, st.doc),
      apply(tr, prev, _o, st) {
        if (!tr.docChanged && !tr.getMeta(errKey)) return prev.map(tr.mapping, tr.doc);
        return errDecos(I, st.doc);
      },
    },
    props: { decorations(state) { return errKey.getState(state); } },
    view(v) {
      EM.byView.set(v, I);
      if (!EM.cur) EM.cur = I;
      return { destroy() { EM.byView.delete(v); if (EM.cur === I) EM.cur = null; } };
    },
  });
}
export function refreshSpErrorMarks(view) {
  if (view) view.dispatch(view.state.tr.setMeta(errKey, true));
}

// ───────── 57. เส้นคั่นหน้าในตัวแก้ไข ─────────
// ตำแหน่งมาจาก paginate() ที่ app.js เรียกใน scheduleCount (debounce 300ms)
// เก็บเป็นตัวแปรระดับโมดูลแบบเดียวกับสมอคอมเมนต์ — plugin แค่หยิบไปวาด
// [alpha.84 ข้อ 2] `midMode:'block'` — จุดตัดที่ตกกลางบทพูดยาวต้องเป็นแถบคั่นจริงที่ดัน
// เนื้อที่เหลือลงหน้าใหม่ (นิยายใช้ 'inline' เพราะมันวัดหน้าจาก DOM · บทวัดจากฟอนต์ล้วน)
const SP_PB = createPageBreakPlugin({
  key: 'ksppagebreak', cls: 'sp-page-break', decoKey: 'pb', midMode: 'block',
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
/**
 * [alpha.100 บั๊ก 2] ทา "ที่ว่างท้ายหน้า" ลงกล่องเส้นคั่นของบทที่วาดไว้แล้ว
 *
 * บทภาพยนตร์จัดหน้าจาก **โมเดล** (นับบรรทัดจากฟอนต์ล้วน ๆ ไม่เคยอ่าน DOM) — เร็วและตรงกับ PDF
 * แต่ก็แปลว่า "หนึ่งหน้า = 54 บรรทัด" เป็นความจริงของโมเดล ไม่ใช่ของจอ · ฟอนต์ไทยที่มี
 * ตัวบน-ตัวล่างทำให้ความสูงบรรทัดจริงไม่เท่ากับ ⅙ นิ้วเป๊ะ เนื้อหน้าจึงล้นแผ่นทีละนิด
 * (ฝั่งนิยายไม่เจอเพราะมันวัด DOM จริงอยู่แล้ว) — ตัวชดเชยอยู่ที่ app.js: tuneSpPagePads
 */
export const applySpPagePads = SP_PB.applyPads;
/** [alpha.83 ข้อ 4] ตัวทำ "เลขหน้าจริง" ที่มุมขวาบนของหน้าถัดไป (โหมดปกติ/จัดหน้า) */
export const setSpPageNumberLabel = SP_PB.setNumberLabel;

// ───────── alpha.58 · 55–56 · CONTINUED / (MORE) / (cont'd) ─────────
// เครื่องหมายพวกนี้ "ไม่ใช่เนื้อบท" — ห้ามแทรกเป็นข้อความจริง ไม่งั้นไฟล์ .md เพี้ยนและลบไม่ออก
// จึงวาดเป็น widget decoration แบบเดียวกับเส้นคั่นหน้า (ตำแหน่งมาจาก computeContinueds ใน app.js)
const ctKey = new PMKey('kspcontinued');
// ══ [alpha.159] ★ รายการเครื่องหมาย "ของแต่ละตัวแก้ไข" (บั๊กตระกูลเดียวกับเส้นคั่นหน้า H15) ══
// เดิม `_conts` เป็นตัวแปรระดับโมดูล → เปิดบทสองแท็บ/แยกจอ แล้วแก้แท็บหนึ่ง ปลั๊กอินของอีกแท็บ
// map รายการของแท็บที่จัดหน้าล่าสุด แล้ววาด CONTINUED/(MORE) ของอีกเรื่องลงมา
// `spContinuedPlugin()` หนึ่งครั้ง = รายการหนึ่งชุด ผูก view ผ่าน view hook · ไม่ระบุ view = ตัวที่ตั้งค่าล่าสุด
const CT = { byView: new WeakMap(), cur: null, detached: { list: [], sig: '' } };
const ctInst = (view) => (view && CT.byView.get(view)) || CT.cur || CT.detached;

/** ตั้งรายการเครื่องหมายต่อเนื่อง — คืน true เมื่อ "เปลี่ยนจริง" (ผู้เรียกค่อย dispatch · บทเรียน 44) */
// [alpha.84 ข้อ 2] ลายเซ็นต้องรวม mid/off — เครื่องหมายชุดเดิมที่ย้ายเข้า-ออกจากกลางบล็อก
// ได้ตำแหน่งเท่าเดิมแต่ต้องวาดคนละระยะ
const ctSigOf = (l) => l.map((m) => [m.pos, m.type, m.text, m.mid ? 1 : 0, m.off || 0].join(':')).join('|');

export function setContinueds(list, view) {
  const I = ctInst(view);
  if (I !== CT.detached) CT.cur = I;
  const next = (list || []).filter((m) => m && Number.isFinite(m.pos) && m.pos > 0 && m.text);
  const sig = ctSigOf(next);
  if (sig === I.sig) return false;
  I.sig = sig;
  I.list = next;
  return true;
}

/** [alpha.85 ข้อ 2] เลื่อนตำแหน่งตามการแก้ไข — เหตุผลเดียวกับ mapBreaks() ของเส้นคั่นหน้า */
function mapContinueds(I, mapping) {
  if (!I.list.length) return;
  I.list = I.list.map((m) => ({ ...m, pos: mapping.map(m.pos, -1) }))
                 .filter((m) => Number.isFinite(m.pos) && m.pos > 0);
  I.sig = ctSigOf(I.list);
}
export function continueds(view) { return ctInst(view).list.slice(); }

function ctDecos(I, doc) {
  if (!I.list.length || !doc) return DecoSet.empty;
  const max = doc.content.size;
  const out = [];
  for (const m of I.list) {
    if (m.pos > max) continue;
    out.push(Deco.widget(m.pos, () => {
      const d = document.createElement('div');
      d.className = 'sp sp-cont-mark ' + (m.cls || '') + (m.mid ? ' k-ct-in-block' : '');
      d.dataset.contType = m.type;
      d.textContent = m.text;
      // [alpha.84 ข้อ 2] ตกกลางบทพูด = widget อยู่ **ใน** บล็อกที่เยื้องมาแล้ว → หักระยะคืน
      if (m.mid) d.style.setProperty('--k-ct-off', '-' + (m.off || 0) + 'in');
      d.setAttribute('contenteditable', 'false');
      return d;
    // [alpha.85 ข้อ 2] เหตุผลเดียวกับเส้นคั่นหน้า — คีย์ผูกกับ "หน้า + ชนิด + ข้อความ"
    // ไม่ใช่ตำแหน่ง ไม่งั้น (MORE)/CONTINUED ถูกสร้างใหม่ทุกครั้งที่พิมพ์
    }, { side: m.side ?? 0,
         key: 'ct' + m.page + m.type + m.text + (m.mid ? 'b' + (m.off || 0) : '') }));
  }
  return DecoSet.create(doc, out);
}

export function spContinuedPlugin() {
  const I = { list: [], sig: '' };
  return new PMPlugin({
    key: ctKey,
    state: {
      init: (_c, st) => ctDecos(I, st.doc),
      apply(tr, prev, _o, st) {
        if (tr.getMeta(ctKey)) return ctDecos(I, st.doc);
        if (!tr.docChanged) return prev;
        mapContinueds(I, tr.mapping);
        return prev.map(tr.mapping, tr.doc);
      },
    },
    props: { decorations(state) { return ctKey.getState(state); } },
    view(v) {
      CT.byView.set(v, I);
      if (!CT.cur) CT.cur = I;
      return { destroy() { CT.byView.delete(v); if (CT.cur === I) CT.cur = null; } };
    },
  });
}
export function refreshContinueds(view) {
  if (view) view.dispatch(view.state.tr.setMeta(ctKey, true));
}
