// ProseMirror editor — หัวใจของ Killian 2 (word-processor grade)
import { t as tt, t } from './i18n.js';
import { Schema, Fragment, Slice } from 'prosemirror-model';
import { EditorState, Plugin, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, setBlockType, wrapIn, lift, chainCommands,
         splitBlockKeepMarks, newlineInCode, exitCode } from 'prosemirror-commands';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { findWrapping, liftTarget, Mapping } from 'prosemirror-transform';
import { inputRules, wrappingInputRule, textblockTypeInputRule,
         smartQuotes, InputRule } from 'prosemirror-inputrules';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { mdToDoc, docToMd, mdLineCounts, collectAlign,
         figureClass, figureImgStyle, imgLine } from './md.js';
import { searchPlugin } from './search.js';
// [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ (โมดูลบริสุทธิ์ — ไม่ import prosemirror)
import { caseTransform } from './text-case.js';
// [alpha.132 ข้อ 9] ตัวกรองค่าสี (โมดูลบริสุทธิ์ — md.js ใช้ตัวเดียวกันนี้)
import { normColor } from './text-color.js';
// [alpha.58r บั๊ก 20] เส้นคั่นหน้าของนิยาย — คนละคีย์กับของบทภาพยนตร์
import { prosePageBreakPlugin } from './prose-view.js';
// [alpha.60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด (`.` `@` `>` `$shot` `#` …) โดยไม่แตะไฟล์
import { markdownCodePlugin } from './markdown-code-toggle.js';
import { Plugin as PMPlugin, PluginKey as PMKey } from 'prosemirror-state';
import { Decoration as Deco, DecorationSet as DecoSet } from 'prosemirror-view';
import { diffByKey } from './deco-diff.js';

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

/**
 * ขยายช่วงให้ครอบบล็อกระดับบนทั้งใบ (decoration คิดจากทั้งบล็อกเสมอ)
 *
 * [alpha.87 ข้อ 5] ★ **ต้นตอของอาการหน่วงตอนพิมพ์**
 *
 * ของเดิม: `$f.depth ? $f.before(1) : 0` และ `$t.depth ? $t.after(1) : size`
 * ตำแหน่งที่ **อยู่ระหว่างบล็อก** มี depth = 0 — ซึ่งเกิดขึ้นทุกครั้งที่ "กด Enter"
 * (แทรกบล็อกใหม่ = ขอบเขตที่เปลี่ยนตกอยู่ที่รอยต่อระหว่างบล็อกพอดี)
 * โค้ดจึงตีความว่า **ทั้งเอกสารเปลี่ยน** แล้วสแกนใหม่ตั้งแต่ 0 ถึง doc.content.size
 *
 * วัดจริง (บท 400 บล็อก): กด Enter หนึ่งครั้ง → ปลั๊กอิน decoration **ทั้งสามตัว**
 * (ตรวจคำผิด · ชื่อ Wiki · คอมเมนต์) สแกน **100% ของเอกสาร** ตัวละหนึ่งรอบ
 * ยิ่งเอกสารยาว ยิ่งหน่วง — เป็นสาเหตุที่ "ตัดหน้าตามไม่ทัน" ทั้งที่ตัวจัดหน้าเองไม่ได้ช้า
 * (มันแค่ไม่เคยได้คิวเมนเธรด)
 *
 * ที่ถูก: ตำแหน่งระหว่างบล็อก = แตะบล็อกที่ **ประกบตำแหน่งนั้น** ไม่ใช่ทั้งเอกสาร
 * → สแกนอย่างมาก 2 บล็อกต่อการกดหนึ่งครั้ง ไม่ว่าเอกสารจะยาวแค่ไหน
 */
function blockRange(doc, from, to) {
  const size = doc.content.size;
  const clamp = (v) => Math.max(0, Math.min(v, size));
  const f = clamp(from), t = clamp(to);
  const $f = doc.resolve(f), $t = doc.resolve(t);
  let a, b;
  if ($f.depth) a = $f.before(1);
  else { const ch = doc.childBefore(f); a = ch && ch.node ? ch.offset : f; }
  if ($t.depth) b = $t.after(1);
  else { const ch = doc.childAfter(t); b = ch && ch.node ? ch.offset + ch.node.nodeSize : t; }
  return { from: clamp(Math.min(a, b)), to: clamp(Math.max(a, b)) };
}

/**
 * state ของปลั๊กอิน decoration ที่คำนวณใหม่เฉพาะส่วนที่เปลี่ยน
 * @param {PMKey} key
 * @param {(doc, from, to) => Decoration[]} scan สแกนช่วง [from,to] คืนรายการ decoration
 */
/**
 * สแกนช่วง [r.from, r.to] ใหม่ แล้วใส่ **เฉพาะส่วนต่าง** ลงชุด decoration เดิม
 * (แยกออกมาเป็นฟังก์ชันเพราะทั้งทางปกติและทางตรวจคำผิดแบบเลื่อนเวลาใช้ตัวเดียวกัน)
 */
function rescanRange(doc, set, r, scan) {
  const oldIn = set.find(r.from, r.to);
  const next = scan(doc, r.from, r.to);
  const { remove, add } = diffByKey(oldIn, next);
  if (!remove.length && !add.length) return set;
  return set.remove(remove).add(doc, add);
}

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
      // [alpha.88 ข้อ 6] ★ ส่ง **เฉพาะส่วนต่าง** เข้า remove()/add() — ผลสุดท้ายชุดเดิมเป๊ะ
      // เดิม `moved.remove(moved.find(...)).add(scan(...))` = ถอดทั้งบล็อกแล้วใส่กลับทั้งบล็อก
      // ย่อหน้าเดียวยาว ๆ หมายถึงถอด/ใส่ 2,252 ตัวต่อการพิมพ์หนึ่งตัว และ `removeInner()`
      // ของ PM เทียบแบบคูณกัน (รายการที่ลบ × decoration ในบล็อก) → ~5.1 ล้านครั้ง/ตัวอักษร
      return rescanRange(st.doc, moved, r, scan);
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
        // [alpha.83 ข้อ 8] ไม่มี `title=` แล้ว — ป้ายลอยของระบบโผล่ทับตำแหน่งเคอร์เซอร์
        // แล้วคลิกแทรกกลางคำไม่ได้ (ป้ายกินพื้นที่ทับจุดที่จะคลิกพอดี)
        // สีของ .k-mention บอกอยู่แล้วว่าเป็นลิงก์ Wiki — คำใบ้ปุ่มลัดอยู่ในเมนูคลิกขวา
        { class: 'k-mention' }));
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
        // [alpha.83 ข้อ 7] เส้นหยักแดงบอกครบแล้ว — ป้ายลอย "น่าจะสะกดผิด: …"
        // เด้งตามเมาส์ทุกคำ รบกวนสายตาและทับเคอร์เซอร์ (เหตุผลเดียวกับ .k-mention)
        { class: 'k-spell-bad' }));
    }
  });
  return out;
}
/**
 * ══════════ [alpha.92 ข้อ 1] ★ ตรวจ "เมื่อคำจบ" ไม่ใช่ทุกตัวอักษร ══════════
 *
 * ของเดิม: พิมพ์ 1 ตัว → สแกนบล็อกที่แตะใหม่ทั้งใบทันที
 * ผลคือคำที่ยังพิมพ์ไม่จบ **ถูกตัดสินว่าผิดตั้งแต่ตัวแรก** — พิมพ์ "สวัสดี" จะเห็นเส้นแดง
 * วิ่งใต้เคอร์เซอร์ตลอด ส-สว-สวั-สวัส… แล้วค่อยหายตอนพิมพ์จบ · และเสียแรงตัดคำ (DP)
 * ทั้งย่อหน้าใหม่ทุกตัวอักษร เพื่อผลที่รู้อยู่แล้วว่าจะถูกทิ้ง
 *
 * ของใหม่ — คำจะถูกตรวจเมื่อ "กลายเป็นคำ" แล้วเท่านั้น:
 *   1. พิมพ์ตัวคั่นคำ (เว้นวรรค · ขึ้นบรรทัดใหม่ · เครื่องหมายวรรคตอน)
 *   2. วาง/ลบก้อนใหญ่ หรือโครงสร้างบล็อกเปลี่ยน (Enter, ลบทั้งย่อหน้า)
 *   3. เคอร์เซอร์ย้ายออกไปนอกบล็อกที่ค้างอยู่ (คลิกที่อื่น)
 *   4. หยุดพิมพ์ครบ IDLE_MS — **ข้อนี้ขาดไม่ได้สำหรับภาษาไทย** เพราะไทยไม่เว้นวรรคระหว่างคำ
 *      ทั้งย่อหน้าอาจไม่มีตัวคั่นเลยสักตัว ถ้ารอแต่ข้อ 1 ก็จะไม่ได้ตรวจตลอดกาล
 *
 * ระหว่างที่ยัง "ค้าง" อยู่ ให้ **ถอดเส้นแดงที่คร่อมจุดที่กำลังแก้ออกด้วย** — ผู้ใช้ที่กำลัง
 * ไล่แก้คำผิดจะเห็นเส้นหายทันทีที่เริ่มพิมพ์ แล้วค่อยกลับมาถ้ายังผิดอยู่ (ไม่ใช่เส้นค้างคาตา)
 *
 * ชุด decoration สุดท้ายเท่าเดิมเป๊ะ — เทส [88-6] เทียบ "เพิ่มทีละส่วน = สแกนใหม่ทั้งเอกสาร"
 * ยังคุมอยู่ แค่ต้องรอให้ตัวตั้งเวลาลงมือก่อนถึงจะเทียบได้
 */
const WORD_END = /[\s .,!?;:'"‘’“”()[\]{}<>…—–\-/\\|@#$%^&*+=~`]/;
const SPELL_IDLE_MS = 400;   // หยุดพิมพ์เท่านี้ = ตรวจให้เลย

const clampR = (doc, r) => {
  const size = doc.content.size;
  const from = Math.max(0, Math.min(r.from, size));
  return { from, to: Math.max(from, Math.min(r.to, size)) };
};

/** state ของปลั๊กอินตรวจคำผิด — `{ set, dirty }` (dirty = ช่วงที่ยังไม่ได้ตรวจ) */
function deferredSpellState(scan) {
  const full = (doc) => ({ set: DecoSet.create(doc, scan(doc, 0, doc.content.size)), dirty: null });
  const flush = (doc, set, dirty) =>
    ({ set: dirty ? rescanRange(doc, set, clampR(doc, dirty), scan) : set, dirty: null });
  return {
    init: (_c, st) => full(st.doc),
    apply(tr, prev, old, st) {
      const meta = tr.getMeta(spellKey);
      if (meta === true) return full(st.doc);                 // สั่งวาดใหม่ทั้งหมด (เปลี่ยนพจนานุกรม ฯลฯ)

      let set = prev.set, dirty = prev.dirty;
      if (tr.docChanged) {
        set = set.map(tr.mapping, tr.doc);
        if (dirty) dirty = { from: tr.mapping.map(dirty.from, -1), to: tr.mapping.map(dirty.to, 1) };
      }
      if (meta && meta.flush) return flush(st.doc, set, dirty);

      if (!tr.docChanged) {
        // เคอร์เซอร์ย้ายออกนอกบล็อกที่ค้าง = คำนั้นจบแน่แล้ว → ตรวจทันที ไม่ต้องรอตัวตั้งเวลา
        if (dirty && tr.selectionSet) {
          const p = st.selection.from;
          if (p < dirty.from || p > dirty.to) return flush(st.doc, set, dirty);
        }
        return set === prev.set && dirty === prev.dirty ? prev : { set, dirty };
      }

      const ch = changedRange(tr);
      if (!ch) return { set, dirty };
      const r = blockRange(st.doc, ch.from, ch.to);

      // "คำจบแล้วหรือยัง" — ดูตัวอักษรที่เพิ่งเกิดขึ้นก่อนตำแหน่งท้ายช่วงที่เปลี่ยน
      const grew = ch.to - ch.from;
      const structural = st.doc.childCount !== old.doc.childCount;   // Enter / ลบทั้งบล็อก
      const typedEnd = grew > 0 && grew <= 2 &&
        WORD_END.test(st.doc.textBetween(Math.max(0, ch.to - 1), ch.to) || ' ');
      if (structural || grew > 2 || typedEnd) {
        return { set: rescanRange(st.doc, set, dirty ? clampR(st.doc, {
          from: Math.min(dirty.from, r.from), to: Math.max(dirty.to, r.to),
        }) : r, scan), dirty: null };
      }

      // ยังพิมพ์คำนี้ไม่จบ → ยังไม่ตรวจ · ถอดเส้นแดงที่คร่อมจุดที่กำลังแก้ออกก่อน
      const near = set.find(Math.max(0, ch.from - 1), ch.to + 1);
      if (near.length) set = set.remove(near);
      return { set, dirty: dirty ? { from: Math.min(dirty.from, r.from), to: Math.max(dirty.to, r.to) } : r };
    },
  };
}

// getChecker: () => (text)=>[{start,end,word}]  หรือ null เมื่อปิด/ยังไม่พร้อม
export function spellPlugin(getChecker) {
  return new PMPlugin({
    key: spellKey,
    state: deferredSpellState((doc, from, to) => spellScan(doc, getChecker(), from, to)),
    props: { decorations(state) { const s = spellKey.getState(state); return s && s.set; } },
    // ตัวตั้งเวลา "หยุดพิมพ์แล้วตรวจให้" — อยู่ในชั้น view เพราะ state.apply ต้องบริสุทธิ์
    view(view) {
      let timer = null;
      const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
      return {
        update() {
          const s = spellKey.getState(view.state);
          stop();
          if (!s || !s.dirty) return;
          timer = setTimeout(() => {
            timer = null;
            const cur = spellKey.getState(view.state);
            if (cur && cur.dirty) view.dispatch(view.state.tr.setMeta(spellKey, { flush: true }));
          }, SPELL_IDLE_MS);
        },
        destroy: stop,
      };
    },
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

/**
 * [alpha.88 ข้อ 6] ลายเซ็นของ decoration ทุกระบบในเอกสาร — **ประตูกัน "decoration รั่ว"**
 *
 * รอบก่อนเคยลองเร่งความเร็วด้วยการจำกัดช่วงสแกน แล้ว decoration ถูกใส่ซ้ำสะสมทีละนิด
 * จนงานโตจาก 58ms เป็น 601ms โดยไม่มีเทสไหนจับได้เลย — เพราะไม่มีใครนับมันเลยสักที่
 * ตัวนี้ให้เทสเทียบ "ผลของการเพิ่มทีละส่วน" กับ "ผลของการสแกนใหม่ทั้งเอกสาร" ได้ตรง ๆ
 * ต้องตรงกันทุกตัวทุกตำแหน่ง ไม่ใช่แค่จำนวนเท่ากัน
 * @returns {{spell:string, mention:string, comment:string, total:number}}
 */
export function decoSignature(view) {
  const sig = (k) => {
    const raw = view && k.getState(view.state);
    const set = raw && raw.set ? raw.set : raw;      // ตรวจคำผิดเก็บเป็น { set, dirty }
    if (!set || !set.find) return '';
    return set.find().map((d) => d.from + ':' + d.to).sort().join(',');
  };
  const spell = sig(spellKey), mention = sig(mentionKey), comment = sig(cmKey);
  const n = (x) => (x ? x.split(',').length : 0);
  return { spell, mention, comment, total: n(spell) + n(mention) + n(comment) };
}


/**
 * [alpha.130 ข้อ 2] แอตทริบิวต์ของบล็อกข้อความที่ถูกจัดหน้า
 *
 * `style` = ตัวจัดหน้าจริง · `data-align` = **ที่จับให้ CSS** — จำเป็นเพราะกฎ "จุดนำต้องเดินทาง
 * ไปกับข้อความ" ต้องเจาะจงถึง `p:first-child` ของ `<li>` เท่านั้น การจับด้วย `[style*="center"]`
 * แบบเดิมทั้งหลวม (สตริงชนกันได้) และเจาะจงไม่ได้ว่าใบไหน
 */
function alignAttrs(align) {
  return align ? { style: 'text-align:' + align, 'data-align': align } : {};
}

export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*',
                 attrs: { align: { default: null } },
                 parseDOM: [{ tag: 'p', getAttrs: (d) => ({ align: d.style.textAlign || null }) }],
                 toDOM: (n) => ['p', alignAttrs(n.attrs.align), 0] },
    heading: { group: 'block', content: 'inline*', defining: true,
               attrs: { level: { default: 1 }, align: { default: null } },
               parseDOM: [1, 2, 3, 4, 5, 6].map((l) => ({ tag: 'h' + l,
                 getAttrs: (d) => ({ level: l, align: d.style.textAlign || null }) })),
               toDOM: (n) => ['h' + n.attrs.level, alignAttrs(n.attrs.align), 0] },
    blockquote: { group: 'block', content: 'paragraph+', defining: true,
                  parseDOM: [{ tag: 'blockquote' }], toDOM: () => ['blockquote', 0] },
    bullet_list: { group: 'block', content: 'list_item+',
                   parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
    ordered_list: { group: 'block', content: 'list_item+', attrs: { order: { default: 1 } },
                    parseDOM: [{ tag: 'ol', getAttrs: (d) => ({ order: d.hasAttribute('start') ? +d.getAttribute('start') : 1 }) }],
                    toDOM: (n) => ['ol', n.attrs.order === 1 ? {} : { start: n.attrs.order }, 0] },
    list_item: { content: 'paragraph+', defining: true,
                 parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
    // [alpha.142 ข้อ 6] รูปปรับได้แล้ว: เต็มหน้า (fit) · ความกว้างเป็น % (w) · ขอบมน (radius)
    // ค่าทั้งสามเดินทางไปกับไฟล์ผ่านชื่อกำกับของมาร์กดาวน์ (`![](x "fit=page w=60% r=8")`)
    // [alpha.143r ข้อ 2] ★ `draggable: false` **โดยตั้งใจ** — ผู้ใช้: *"drag mouse เพื่อ select
    // ข้อความ มันเลือกไม่ได้ ในกรณีมีหน้าที่รูปเต็มหน้า"* · โหนดที่ draggable ทำให้เบราว์เซอร์
    // เริ่ม "ลากวัตถุ" ทันทีที่กดค้างแล้วขยับบนตัวมัน — รูปเต็มหน้ากินพื้นที่ทั้งแผ่น เลยกลืน
    // การลากเลือกข้อความไปทั้งหน้า · ย้ายรูปใช้ตัด-วาง (Ctrl+X / Ctrl+V) ได้เหมือนเดิม
    figure: { group: 'block', atom: true, draggable: false, selectable: true,
              attrs: { src: {}, alt: { default: '' }, md: { default: '' }, resolved: { default: '' },
                       fit: { default: '' }, w: { default: '' }, radius: { default: '' } },
              parseDOM: [{ tag: 'figure[data-md]', getAttrs: (d) => ({
                src: d.getAttribute('data-src') || '', alt: d.getAttribute('data-alt') || '',
                md: d.getAttribute('data-md') || '', resolved: '',
                fit: d.getAttribute('data-fit') || '', w: d.getAttribute('data-w') || '',
                radius: d.getAttribute('data-r') || '' }) }],
              toDOM: (n) => ['figure', { 'data-md': n.attrs.md, 'data-src': n.attrs.src,
                                         'data-alt': n.attrs.alt, 'data-fit': n.attrs.fit,
                                         'data-w': n.attrs.w, 'data-r': n.attrs.radius,
                                         class: figureClass(n.attrs), title: n.attrs.alt || '' },
                             ['img', { src: n.attrs.resolved || n.attrs.src,
                                       alt: n.attrs.alt, title: n.attrs.alt || '',
                                       style: figureImgStyle(n.attrs),
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
    // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย — อยู่กลุ่มเดียวกันและกันเองออก (ตัวเดียวกันเป็นทั้งสองไม่ได้)
    sup: { group: 'vertalign', excludes: 'vertalign',
           parseDOM: [{ tag: 'sup' }], toDOM: () => ['sup', 0] },
    sub: { group: 'vertalign', excludes: 'vertalign',
           parseDOM: [{ tag: 'sub' }], toDOM: () => ['sub', 0] },
    // ══ [alpha.132 ข้อ 9] ★ สีตัวอักษร (ผู้ใช้จริงขอมา) ══
    // ค่าสีถูกกรองผ่าน `normColor` **ทุกทางเข้า** (พิมพ์เอง · วางจากที่อื่น · อ่านจากไฟล์)
    // กรองไม่ผ่าน = ไม่มีมาร์ก (`getAttrs` คืน false) ไม่ใช่ยัดสตริงดิบลง style
    color: { attrs: { color: { default: '' } },
             parseDOM: [
               { tag: 'span[data-color]',
                 getAttrs: (d) => { const c = normColor(d.getAttribute('data-color'));
                                    return c ? { color: c } : false; } },
               { style: 'color',
                 getAttrs: (v) => { const c = normColor(v); return c ? { color: c } : false; } },
             ],
             toDOM: (n) => ['span', { 'data-color': n.attrs.color,
                                      style: 'color:' + n.attrs.color }, 0] },
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
    // [alpha.97 ข้อ 4] พิมพ์ `x^2^` / `H~2~O` แล้วได้ตัวยก/ตัวห้อยทันที (เครื่องหมายเดียวกับที่เก็บลง .md)
    markRule(/(\^)([^^]+)\^$/, s.marks.sup),
    markRule(/(?<!~)(~)([^~]+)~$/, s.marks.sub),
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

// ══════════ [alpha.97 ข้อ 3+5] ★ ปุ่มโครงสร้างต้องเป็น "สวิตช์" เหมือน B I U ══════════
//
// `wrapInList()` / `wrapIn()` ของ ProseMirror **ห่ออย่างเดียว ไม่มีขากลับ** — กดปุ่มรายการ
// สิบครั้งก็ได้รายการซ้อนสิบชั้น และวิธีเดียวที่จะเลิกเป็นรายการคือ "ลบทิ้งแล้วพิมพ์ใหม่"
// สามตัวข้างล่างนี้เติมขาที่ขาดไป: อยู่ในนั้นอยู่แล้ว = ถอดออก · อยู่ในรายการอีกชนิด = สลับชนิด

/**
 * ══════ [alpha.103 ข้อ 2] ★★ เปลี่ยนชนิดบล็อกแล้ว **การจัดหน้าต้องไม่หาย** ══════
 *
 * ผู้ใช้: *"เมื่อใช้หัวข้อหรือ bullet จะถูกจัดชิดซ้ายเสมอ และปรับเปลี่ยนไม่ได้"*
 *
 * ต้นตอครึ่งแรก: `setBlockType(heading, { level })` ของ ProseMirror **เขียน attrs ทับทั้งชุด**
 * ในชุดนั้นมีแต่ `level` → `align` ที่ผู้ใช้ตั้งไว้หายกลายเป็น null (= ชิดซ้าย) ทุกครั้งที่
 * แปลงย่อหน้าเป็นหัวข้อ (และขากลับก็เหมือนกัน) · ฝั่งบทภาพยนตร์ไม่มีอาการนี้เพราะ
 * `SPEditor.setElement()` คัด `align` ของเดิมมาใส่ให้ตั้งแต่แรก (screenplay.js)
 *
 * ตัวห่อนี้จำ align ของทุกบล็อกข้อความในช่วงที่เลือกไว้ก่อน แล้วทาคืนใน **transaction
 * เดียวกัน** หลังคำสั่งเดิมทำงานเสร็จ — undo ครั้งเดียวจบ และไม่มีจังหวะที่จอกะพริบเป็นซ้าย
 */
function keepAlign(cmd) {
  return (state, dispatch, view) => {
    if (!dispatch) return cmd(state, dispatch, view);
    const { from, to } = state.selection;
    const keep = [];
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock && node.attrs && node.attrs.align) keep.push([pos, node.attrs.align]);
    });
    if (!keep.length) return cmd(state, dispatch, view);
    return cmd(state, (tr) => {
      for (const [pos, align] of keep) {
        const p = tr.mapping.map(pos, -1);
        const n = tr.doc.nodeAt(p);
        const spec = n && n.type.spec.attrs;
        if (!n || !n.isTextblock || !spec || !('align' in spec)) continue;
        if (n.attrs.align === align) continue;
        tr.setNodeMarkup(p, null, { ...n.attrs, align });
      }
      dispatch(tr);
    }, view);
  };
}

/**
 * [alpha.130 ข้อ 3] align ร่วมของบล็อกข้อความทุกใบในช่วงที่เลือก
 * @returns {string|null} 'left'|'center'|'right'|'justify' · '' = ปนกัน · null = ไม่มีบล็อกข้อความ
 */
export function rangeAlign(state) {
  const { from, to, empty, $from } = state.selection;
  if (empty) {
    const p = $from.parent;
    return (p.type.name === 'paragraph' || p.type.name === 'heading') ? (p.attrs.align || 'left') : null;
  }
  let seen = null, mixed = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (mixed || !node.isTextblock || !node.type.spec.attrs || !('align' in node.type.spec.attrs)) return;
    const a = node.attrs.align || 'left';
    if (seen === null) seen = a; else if (seen !== a) mixed = true;
  });
  return mixed ? '' : seen;
}

/**
 * [alpha.132 ข้อ 9] สีตัวอักษรของช่วงที่เลือก — เหมือนกันทั้งช่วง = คืนรหัสสี · ปนกัน/ไม่มี = `''`
 * (ไอดิออมเดียวกับ `rangeAlign` — อ่านทั้งช่วง ไม่ใช่จุดเดียว)
 */
export function rangeColor(state) {
  const mk = state.schema.marks.color;
  if (!mk) return '';
  const { from, to, empty, $from } = state.selection;
  if (empty) {
    const m = (state.storedMarks || $from.marks()).find((x) => x.type === mk);
    return m ? normColor(m.attrs.color) : '';
  }
  let seen = null, mixed = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (mixed || !node.isText) return;
    const m = (node.marks || []).find((x) => x.type === mk);
    const c = m ? normColor(m.attrs.color) : '';
    if (seen === null) seen = c; else if (seen !== c) mixed = true;
  });
  return mixed || seen === null ? '' : seen;
}

/** ความลึกของบรรพบุรุษชนิด `type` ที่ใกล้เคอร์เซอร์ที่สุด (0 = ไม่ได้อยู่ข้างใน) */
export function ancestorDepth(state, type) {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === type) return d;
  return 0;
}

// ══════ [alpha.132r4] ★★ สวิตช์บล็อกทุกตัวต้องกดได้เสมอ แม้ช่วงที่เลือก "ปนกัน" ══════
//
// ผู้ใช้: *"จำ bug คำพูดที่ยกมาได้เปล่า เหมือนกัน bullet กับตัวเลข toggle ไม่ได้ ถ้า 2 บรรทัด
//          ไม่เหมือนกัน · แต่ทีนี้มันจะแปลก ๆ คือ เมื่อเราใช้ bullet จะสลับเป็นหมายเลขได้
//          แต่กดเป็น คำพูดที่ยกมาไม่ได้"*
//
// alpha.132 ข้อ 7 แก้ให้ "คำพูดที่ยกมา" แล้ว แต่แก้ **เฉพาะตัวมัน** — รายการยังตัดสินจาก
// เคอร์เซอร์จุดเดียวเหมือนเดิม และ "รายการ → คำพูดยกมา" ก็ยังตัน เพราะ `wrapIn` ห่อ
// `<ul>` ให้กลายเป็น `<blockquote>` ไม่ได้ (สคีมารับแค่ `paragraph+`)
//
// ═══ กติกาเดียวสำหรับทุกสวิตช์ ═══
//   1. ดู **ทั้งช่วงที่เลือก** ไม่ใช่จุดเดียว
//   2. ทุกบรรทัดอยู่ในบล็อกชนิดนั้นแล้ว → ถอดออก
//   3. นอกนั้น → **ถอดของเก่าที่ปนอยู่ให้หมดก่อน** (รายการ/คำพูดยกมา ชนิดไหนก็ตาม)
//      แล้วค่อยห่อทั้งช่วงเป็นชนิดใหม่ทีเดียว
//
// ═══ ทำไมต้องมีเครื่องมือ `seq()` ═══
// คำสั่งของ prosemirror-schema-list (`liftListItem`) ทำงานได้ก็ต่อเมื่อ **ช่วงที่เลือกอยู่ใน
// รายการใบเดียว** — ช่วงที่คร่อมย่อหน้าเปล่ากับรายการจึงคืน false ทันที (วัดแล้วในเครื่อง)
// ทางที่ได้ผลคือ "เลื่อนช่วงเข้าไปในรายการทีละใบแล้วถอด" ซึ่งต้องรันหลายคำสั่งต่อกัน
// โดยแต่ละคำสั่งเห็น state ที่ปรับแล้วของคำสั่งก่อนหน้า
//
// ★ แต่ถ้า dispatch ทีละคำสั่ง ผู้ใช้จะต้องกด undo หลายครั้งกว่าจะกลับที่เดิม
//   → `seq()` รันบน state ชั่วคราว เก็บเฉพาะ **step** ไว้ แล้วเล่นซ้ำลงธุรกรรมเดียวตอนจบ
//     (step ถูกสร้างจากเอกสารลำดับเดียวกันเป๊ะ การเล่นซ้ำจึงให้ผลเหมือนกันทุกประการ)

// ══════ [alpha.132r4] ★ ทางออกจากรายการที่ "ทำเองได้โดยไม่ต้องกดปุ่ม" ══════
//
// ผู้ใช้: *"เมื่อ enter 2 ครั้ง (ไม่ใช่ shift enter) บรรทัดถัดมาต้อง toggle ออก
//          หรือกดลบ 2 ครั้ง เหมือน ms word · ตอนนี้กลายเป็นว่าถ้าต้องการเอาออก
//          ต้องกดปุ่ม toggle แทน"*

/** เคอร์เซอร์อยู่ใน list_item ไหม (คืนความลึกของ item · 0 = ไม่อยู่) */
function listItemDepth(state) {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === schema.nodes.list_item) return d;
  }
  return 0;
}

/** Enter บนข้อที่ว่างเปล่า = ยกออกจากรายการ (ไม่ใช่สร้างข้อว่างใบใหม่) */
function exitEmptyListItem(state, dispatch, view) {
  const { $from, empty } = state.selection;
  if (!empty || !listItemDepth(state)) return false;
  if ($from.parent.content.size > 0) return false;          // ยังมีข้อความ = ปล่อยให้ Enter ปกติทำงาน
  return liftListItem(schema.nodes.list_item)(state, dispatch, view);
}

/** Backspace ที่ต้นข้อ = ยกข้อนั้นออกจากรายการ (เหมือน Word — ไม่ใช่ไปรวมกับข้อก่อนหน้า) */
function exitListItemAtStart(state, dispatch, view) {
  const { $from, empty } = state.selection;
  if (!empty || !listItemDepth(state)) return false;
  if ($from.parentOffset !== 0) return false;               // ไม่ได้อยู่ต้นบรรทัด
  return liftListItem(schema.nodes.list_item)(state, dispatch, view);
}

/**
 * ══ [alpha.134 ข้อ 3] ★★ วงวนของรายการ — "ออกจากรายการแล้วโดนดูดกลับเข้าไปใหม่" ══
 *
 * ผู้ใช้: *"เมื่อเราลบ เพื่อให้ toggle หายไป แล้วเราลบเพื่อกลับไปบรรทัดก่อนหน้า
 *          ตรงนี้จะติด loop ทันที เพราะมันโดน toggle ต่อ"*
 *
 * ลำดับที่เกิดขึ้นจริง (สี่จังหวะ วนไม่รู้จบ):
 *   1. Enter ท้ายข้อ            → ได้ข้อใหม่ที่ว่างเปล่า
 *   2. Backspace                → `exitListItemAtStart` ยกออกมาเป็นย่อหน้าธรรมดา ✔ (จุดนำหายไป)
 *   3. Backspace อีกที          → `joinBackward` ของ baseKeymap **ยุบย่อหน้ากลับเข้าไปในข้อสุดท้าย**
 *                                 = กลับเข้ารายการอีกรอบ (จุดนำโผล่กลับมา)
 *   4. Backspace อีกที          → เข้าเงื่อนไขข้อ 2 อีก … วนกลับไปข้อ 2/3 ตลอดกาล
 *
 * ที่ถูกคือ: ย่อหน้า **ว่าง** ที่ต่อท้ายรายการ เมื่อกด Backspace = ทิ้งย่อหน้านั้นไป
 * แล้วเอาเคอร์เซอร์ไปไว้ **ท้าย** ข้อสุดท้าย (พฤติกรรมเดียวกับ MS Word)
 * ★ ต้องเป็น "ท้าย" เท่านั้น — ถ้าไปโผล่ที่ **ต้นข้อ** จะเข้าเงื่อนไขของ `exitListItemAtStart`
 *   ในการกดครั้งถัดไป แล้ววงวนเดิมกลับมาทันที (เทส editor-keys ล็อกตำแหน่งนี้ไว้)
 *
 * ขอบเขต: แตะเฉพาะย่อหน้า **ว่าง** · ย่อหน้าที่มีข้อความยังตกไปใช้พฤติกรรมมาตรฐานของ
 * prosemirror (`joinBackward` ยกมันขึ้นเป็นข้อใหม่ของรายการ) เหมือนเดิมทุกประการ
 */
function dropEmptyParaAfterList(state, dispatch) {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth !== 1) return false;            // ต้องเป็นบล็อกระดับบนสุด
  const para = $from.parent;
  if (para.type !== schema.nodes.paragraph || para.content.size > 0) return false;
  const i = $from.index(0);
  if (i === 0) return false;
  const prev = state.doc.child(i - 1);
  if (prev.type !== schema.nodes.bullet_list && prev.type !== schema.nodes.ordered_list) return false;
  if (dispatch) {
    const at = $from.before(1);
    const tr = state.tr.delete(at, at + para.nodeSize);
    // ท้ายข้อสุดท้ายของรายการ = จุดข้อความที่ใกล้ที่สุด "ก่อน" ตำแหน่งที่เพิ่งลบไป
    const $end = tr.doc.resolve(Math.max(0, Math.min(at - 1, tr.doc.content.size)));
    tr.setSelection(TextSelection.near($end, -1));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/**
 * ══ [alpha.134 ข้อ 2] ★ Enter ต้องพา "การจัดหน้า" ไปบรรทัดใหม่ด้วย ══
 *
 * ผู้ใช้: *"เมื่อเราใช้จัดหน้า บรรทัดต่อไปต้อง toggle อยู่"*
 *
 * ต้นตออยู่ใน `splitBlock` ของ prosemirror เอง: เมื่อเคอร์เซอร์อยู่ **ท้ายบล็อก** มันสร้าง
 * บล็อกใหม่จาก `defaultType` ซึ่งได้ **attrs ค่าเริ่มต้น** (align = null) — ต่างจากตอนแยก
 * กลางบล็อกที่คัด attrs เดิมมาให้ · ผู้ใช้จึงเห็น "จัดกึ่งกลางแล้วกด Enter กลับเป็นชิดซ้าย"
 * (มาร์กตัวอักษรไม่โดน เพราะ `splitBlockKeepMarks` ดูแลอยู่แล้ว — ขาดแค่ attrs ของบล็อก)
 *
 * ห่อทั้งสาย Enter ไว้ทีเดียว จึงได้ผลกับทุกทาง (ย่อหน้า · หัวข้อ · ข้อในรายการ)
 */
function keepAlignOnEnter(inner) {
  return (state, dispatch, view) => {
    const align = (state.selection.$from.parent.attrs || {}).align || null;
    if (!align || !dispatch) return inner(state, dispatch, view);
    return inner(state, (tr) => {
      const $f = tr.selection.$from;
      for (let d = $f.depth; d > 0; d--) {
        const n = $f.node(d);
        if (n.type !== schema.nodes.paragraph && n.type !== schema.nodes.heading) continue;
        if ((n.attrs || {}).align !== align)
          tr.setNodeMarkup($f.before(d), null, { ...n.attrs, align });
        break;
      }
      dispatch(tr);
    }, view);
  };
}

// ── คำสั่งของสองปุ่มที่พฤติกรรมซับซ้อนที่สุด — ประกาศที่เดียว ใช้ทั้งแป้นจริงและตัวช่วยกด ──
/**
 * Enter: ขึ้นบรรทัดในบล็อกโค้ด → แยกข้อในรายการ → ออกจากรายการเมื่อข้อว่าง → แยกย่อหน้า
 * [alpha.134 ข้อ 2] ทั้งสายถูกห่อด้วย keepAlignOnEnter เพื่อพา `align` ไปบรรทัดใหม่ด้วย
 */
export const ENTER_CMD = keepAlignOnEnter(chainCommands(
  newlineInCode, splitListItem(schema.nodes.list_item), exitEmptyListItem, splitBlockKeepMarks));
/**
 * Backspace: [alpha.132r4] ต้นข้อ = ถอดออกจากรายการ (เหมือน Word)
 * [alpha.134 ข้อ 3] ย่อหน้าว่างท้ายรายการ = ลบทิ้ง ไม่ใช่ถูกดูดกลับเข้ารายการ (ต้นตอของวงวน)
 * แล้วค่อยตกไปพฤติกรรมมาตรฐาน (ลบตัวอักษร/ยุบบล็อก) ตามปกติ
 */
export const BACKSPACE_CMD = chainCommands(
  exitListItemAtStart, dropEmptyParaAfterList, baseKeymap.Backspace);

/** ตัวรันคำสั่งต่อกันบน state ชั่วคราว — เก็บ step ไว้รวมเป็นธุรกรรมเดียวตอนจบ */
function seq(state) {
  let st = state;
  const steps = [];
  const mapping = new Mapping();
  return {
    get state() { return st; },
    /** ตำแหน่งเดิม → ตำแหน่งปัจจุบัน */
    map: (pos) => mapping.map(pos),
    run(cmd) {
      let ok = false;
      cmd(st, (tr) => {
        for (const x of tr.steps) { steps.push(x); mapping.appendMap(x.getMap()); }
        st = st.apply(tr);
        ok = true;
      });
      return ok;
    },
    /** ย้ายช่วงที่เลือก (ไม่สร้าง step — แค่บอกคำสั่งถัดไปว่าให้ทำตรงไหน) */
    select(a, b) {
      const d = st.doc;
      const lo = Math.max(0, Math.min(a, d.content.size));
      const hi = Math.max(lo, Math.min(b, d.content.size));
      try {
        st = st.apply(st.tr.setSelection(
          TextSelection.between(d.resolve(lo), d.resolve(hi))));
      } catch { /* ตำแหน่งไม่ถูกต้อง = ปล่อยช่วงเดิมไว้ */ }
    },
    steps,
  };
}

/**
 * ปิดงาน: เล่น step ทั้งหมดลงธุรกรรมเดียวของ state จริง
 *
 * ★ [alpha.132r4] **คืนช่วงที่เลือกให้ครอบของเดิม** — ระหว่างทางเราย้ายช่วงไปมาเพื่อให้คำสั่ง
 *   ของ prosemirror ทำงานได้ ถ้าไม่คืน ผู้ใช้จะเลือกสองบรรทัด กดปุ่มแรกแล้วช่วงหด
 *   พอกดปุ่มที่สองจึงโดนแค่บรรทัดเดียว (เจอจริงตอนกด "รายการ" แล้วต่อด้วย "คำพูดที่ยกมา")
 */
function commitSeq(s, state, dispatch, from, to) {
  if (!s.steps.length) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  for (const x of s.steps) tr.step(x);
  if (Number.isFinite(from) && Number.isFinite(to)) {
    try {
      const d = tr.doc;
      const a = Math.max(0, Math.min(s.map(from), d.content.size));
      const b = Math.max(a, Math.min(s.map(to), d.content.size));
      tr.setSelection(TextSelection.between(d.resolve(a), d.resolve(b)));
    } catch { /* ตำแหน่งไม่ถูกต้อง = ปล่อยให้ prosemirror แมปเอง */ }
  }
  dispatch(tr.scrollIntoView());
  return true;
}

/**
 * ถอดบล็อกห่อทุกใบที่คาบเกี่ยวกับช่วง โดย **เลื่อนช่วงเข้าไปในใบนั้นก่อน**
 * @param {(n:object)=>boolean} match   ใช่บล็อกที่ต้องถอดไหม
 * @param {number} inner  จำนวนตำแหน่งจากขอบโหนดถึง "ในข้อความ" (บล็อก=2 · รายการ=3)
 * @param {Function} liftCmd  คำสั่งถอด (`lift` หรือ `liftListItem(itemType)`)
 */
function liftEvery(s, from0, to0, match, inner, liftCmd) {
  for (let guard = 0; guard < 40; guard++) {
    const from = s.map(from0), to = s.map(to0);
    let hit = null;
    s.state.doc.nodesBetween(from, to, (node, pos) => {
      if (hit) return false;
      if (match(node)) { hit = { pos, node }; return false; }
      return undefined;
    });
    if (!hit) return;
    // ★ หนีบให้อยู่ใน "ช่วงที่ผู้ใช้เลือก" เท่านั้น — ถ้าเลือกทั้งใบจะได้ทั้งใบเอง
    //   แต่ถ้าเลือกข้อเดียว ต้องถอดข้อเดียว (รายการถูกผ่าเป็นสองท่อนตามธรรมชาติ)
    s.select(Math.max(hit.pos + inner, from),
             Math.min(hit.pos + hit.node.nodeSize - inner, to));
    let moved = false;
    for (let g2 = 0; g2 < 10; g2++) { if (!s.run(liftCmd)) break; moved = true; }
    if (!moved) return;                       // ถอดไม่ได้แล้ว — กันวนไม่รู้จบ
  }
}

const isList = (n) => /_list$/.test(n.type.name);

/** ถอดทุกอย่างในช่วงให้เหลือ "ย่อหน้าเปล่า ๆ" (ทั้งรายการและคำพูดยกมา) */
function flattenRange(s, from0, to0, itemType, quoteType) {
  // ลองท่าปกติก่อน — มันถอด "เฉพาะช่วงที่เลือก" ได้แม่นกว่าเมื่อทุกอย่างอยู่ในรายการใบเดียว
  const lift0 = liftListItem(itemType);
  for (let g = 0; g < 10; g++) { if (!s.run(lift0)) break; }
  liftEvery(s, from0, to0, isList, 3, lift0);
  if (quoteType) liftEvery(s, from0, to0, (n) => n.type === quoteType, 2, lift);
}

/**
 * สภาพของช่วงเทียบกับ "รายการชนิดหนึ่ง" — คืนจำนวนบล็อกข้อความทั้งหมด และที่อยู่ในชนิดนั้น
 */
export function listRangeInfo(state, listType) {
  const { from, to } = state.selection;
  let total = 0, inside = 0;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return;
    total++;
    const $p = state.doc.resolve(pos);
    for (let d = $p.depth; d > 0; d--) if ($p.node(d).type === listType) { inside++; break; }
  });
  return { total, inside };
}

/**
 * สวิตช์รายการ — ทั้งช่วงเป็นชนิดนี้แล้ว = ถอดออก · นอกนั้น = ถอดของเก่าแล้วห่อทั้งช่วง
 * (ไม่ต้องมี `view` อีกแล้ว — ทุกขั้นตอนรันบน state ชั่วคราวภายในคำสั่งเดียว)
 */
export function toggleListCmd(listType, itemType) {
  return (state, dispatch) => {
    const info = listRangeInfo(state, listType);
    const { from, to } = state.selection;
    const s = seq(state);
    if (info.total > 0 && info.inside === info.total) {
      // `liftListItem` เก่งกว่าตรงที่ถอด **เฉพาะช่วงที่เลือก** ได้เอง (ผ่ารายการเป็นสามท่อน)
      const lift0 = liftListItem(itemType);
      let moved = false;
      for (let g = 0; g < 10; g++) { if (!s.run(lift0)) break; moved = true; }
      // ช่วงคร่อมหลายรายการ → `liftListItem` คืน false ตั้งแต่ต้น ต้องเจาะทีละใบ
      if (!moved) liftEvery(s, from, to, isList, 3, lift0);
      return commitSeq(s, state, dispatch, from, to);
    }
    // ══ [alpha.98 ข้อ 5] สลับชนิดต้องแตะ **เฉพาะข้อที่เลือก** ══
    // รายการเดิมถูกผ่าเป็นท่อนบน/ท่อนที่เลือก/ท่อนล่างเองตามธรรมชาติ (พฤติกรรมเดียวกับ Word)
    flattenRange(s, from, to, itemType, schema.nodes.blockquote);
    s.select(s.map(from), s.map(to));
    s.run(wrapInList(listType));
    return commitSeq(s, state, dispatch, from, to);
  };
}

// ══════ [alpha.132 ข้อ 7] ★★ สวิตช์ "คำพูดที่ยกมา" ต้องกดได้เสมอ แม้ช่วงที่เลือกปนกัน ══════
//
// ผู้ใช้: *"มี 2 บรรทัด เลือกทั้งสองแล้วกดคำพูดที่ยกมา → เป็นบล็อก · กด toggle → กลับเหมือนเดิม
//          แต่ถ้าเลือกบรรทัดใดบรรทัดหนึ่งเอาบล็อกออกก่อน แล้วเลือกทั้ง 2 บรรทัด **กด toggle ไม่ได้แล้ว**"*
//
// ต้นตอ: ตัวสวิตช์เดิมตัดสินจาก **เคอร์เซอร์ต้นช่วงตัวเดียว** (`ancestorDepth` ดู `$from` เท่านั้น)
//   · ต้นช่วงอยู่นอกบล็อก → ไปทาง `wrapIn`
//   · แต่ `wrapIn` ห่อช่วงที่มีทั้งย่อหน้าเปล่าและ `<blockquote>` ไม่ได้เลย
//     (สคีมาของ blockquote รับได้แค่ `paragraph+` → `findWrapping` คืน null) → คืน false เงียบ ๆ
//   ผลคือ "กดแล้วไม่มีอะไรเกิดขึ้น" อย่างที่ผู้ใช้เจอ — ไม่ใช่ปุ่มเสีย แต่เป็นทางตันของคำสั่ง
//
// กติกาใหม่ (ไอดิออมเดียวกับ B I U และปุ่มจัดหน้าของ alpha.130): **ดูทั้งช่วง ไม่ใช่จุดเดียว**
//   · ทุกบรรทัดอยู่ในบล็อก  → ถอดออก
//   · ปนกัน / ไม่มีเลย      → ถอดของเก่าที่ปนอยู่ทิ้งก่อน แล้วห่อทั้งช่วงเป็นบล็อกเดียว
// (ถอดด้วย `lift` ระดับ step ไม่ใช่ replace — ตำแหน่งในช่วงจึงถูกแมปต่อได้แม่นยำ)

/**
 * สภาพของช่วงที่เลือกเทียบกับบล็อกห่อชนิดหนึ่ง
 * @returns {{total:number, inside:number, nodes:Array<{pos:number,node:object}>}}
 *   `nodes` = โหนดชนิดนั้น **ชั้นนอกสุด** ที่คาบเกี่ยวกับช่วง เรียงตามลำดับในเอกสาร
 */
export function wrapRangeInfo(state, nodeType) {
  const { from, to } = state.selection;
  let total = 0, inside = 0;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return;
    total++;
    const $p = state.doc.resolve(pos);
    for (let d = $p.depth; d > 0; d--) if ($p.node(d).type === nodeType) { inside++; break; }
  });
  const nodes = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type !== nodeType) return;
    nodes.push({ pos, node });
    return false;                       // เจอชั้นนอกสุดแล้วไม่ต้องลงไปหาตัวซ้อนข้างใน
  });
  return { total, inside, nodes };
}

/** ถอดบล็อกห่อทุกใบใน `nodes` ออก (แก้จากท้ายไปหน้า ตำแหน่งที่เก็บไว้จึงยังใช้ได้) */
function liftWrappers(tr, nodes) {
  let done = false;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const { pos, node } = nodes[i];
    const $s = tr.doc.resolve(tr.mapping.map(pos + 1));
    const $e = tr.doc.resolve(tr.mapping.map(pos + node.nodeSize - 1));
    const range = $s.blockRange($e);
    const target = range && liftTarget(range);
    if (range && target != null) { tr.lift(range, target); done = true; }
  }
  return done;
}

// ══════ [alpha.132r3 ข้อ 3] ★★ จุดนำ/หมายเลขข้อ ต้องปรับรูปแบบได้เหมือนตัวอักษร ══════
//
// ผู้ใช้: *"bullet และ ตัวเลข ต้องเป็นตัวอักษรด้วย ดังนั้นต้องปรับรูปแบบ สี และอื่น ๆ ได้
//          ตอนนี้ปรับไม่ได้"*
//
// marker เป็นของ **CSS** ไม่ใช่โหนดในเอกสาร (ไฟล์ .md เก็บแค่ `- ข้อ`) จึงไม่มีทางให้ผู้ใช้
// เลือกแล้วสั่งรูปแบบตรง ๆ ได้ · กติกาเดียวกับ Word/Google Docs คือ **marker ใช้รูปแบบของ
// อักษรตัวแรกในข้อ** — ปลั๊กอินนี้อ่านมาร์กของรันแรกแล้วส่งเป็นตัวแปร CSS ลงที่ `<li>`
//
// ★ ตั้งบน `<li>` เป็น **ตัวแปร** (ไม่ใช่ `color:` ตรง ๆ) เพราะ `<li>` ครอบข้อความทั้งข้อ —
//   ถ้าตั้งสีจริงลงไป ข้อความส่วนที่ไม่ได้ทำสีจะเปลี่ยนสีตามอักษรตัวแรกไปด้วยทั้งข้อ
// ★ ไฟล์ที่ส่งออกใช้กติกาเดียวกันผ่าน `markerVars()` ใน md.js (เทส e2e ตรวจว่าให้ผลตรงกัน)
function listMarkerPlugin() {
  const key = new PMKey('k2-list-marker');
  const build = (doc) => {
    const out = [];
    // สคีมาของเราไม่มีรายการซ้อนชั้น (`list_item` รับได้แค่ `paragraph+`) → เดินชั้นบนพอ
    doc.forEach((node, offset) => {
      if (!/_list$/.test(node.type.name)) return;
      node.forEach((item, off) => {
        const first = item.firstChild && item.firstChild.firstChild;
        const marks = (first && first.marks) || [];
        const css = [];
        const c = marks.find((m) => m.type.name === 'color');
        if (c && c.attrs.color) css.push('--k-mk-color:' + c.attrs.color);
        if (marks.some((m) => m.type.name === 'strong')) css.push('--k-mk-weight:700');
        if (marks.some((m) => m.type.name === 'em')) css.push('--k-mk-style:italic');
        if (!css.length) return;
        const pos = offset + 1 + off;
        out.push(Deco.node(pos, pos + item.nodeSize, { style: css.join(';') }));
      });
    });
    return DecoSet.create(doc, out);
  };
  return new PMPlugin({
    key,
    state: { init: (_, st) => build(st.doc),
             apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old) },
    props: { decorations(st) { return key.getState(st); } },
  });
}

/** สวิตช์บล็อกที่ห่อได้ (คำพูดยกมา) — ทั้งช่วงอยู่ข้างในแล้ว = ถอดออก · นอกนั้น = ห่อทั้งช่วง */
export function toggleWrapCmd(nodeType) {
  return (state, dispatch, view) => {
    const info = wrapRangeInfo(state, nodeType);
    // ── ทุกบรรทัดอยู่ในบล็อกแล้ว = ถอดออก ──
    if (info.total > 0 && info.inside === info.total) {
      // `lift` ปกติเก่งกว่าตรงที่ถอด **เฉพาะช่วงที่เลือก** ได้ (ผ่าบล็อกเป็นสามท่อน)
      if (lift(state, dispatch, view)) return true;
      // เลือกคร่อมหลายบล็อก → `lift` หา target ไม่ได้ ต้องถอดทีละใบเอง
      if (!info.nodes.length) return false;
      if (!dispatch) return true;
      const tr = state.tr;
      if (!liftWrappers(tr, info.nodes)) return false;
      dispatch(tr.scrollIntoView());
      return true;
    }
    // ── ปนกัน หรือไม่มีเลย = ห่อทั้งช่วงให้เป็นบล็อกเดียว ──
    //
    // [alpha.132r4] ★ ต้อง **ออกจากรายการก่อน** ด้วย — `wrapIn` ห่อ `<ul>` ให้กลายเป็น
    // `<blockquote>` ไม่ได้ (สคีมารับแค่ `paragraph+`) → เดิมกดจากในรายการแล้วเงียบสนิท
    const { from, to } = state.selection;
    const s = seq(state);
    flattenRange(s, from, to, schema.nodes.list_item, nodeType);
    s.select(s.map(from), s.map(to));
    s.run(wrapIn(nodeType));
    return commitSeq(s, state, dispatch, from, to);
  };
}

// ══════════ [alpha.98 ข้อ 9] ★ Home / End ต้องผูกเป็นคำสั่งจริง ไม่ใช่ปล่อยให้เบราว์เซอร์ ══════════
//
// ผู้ใช้: *"ปุ่ม home end ใช้ไม่ได้"*
//
// ไม่มีใครในโปรแกรมดักสองปุ่มนี้เลย (ไล่ listener ครบทุกตัวแล้ว) — มันเป็นพฤติกรรมพื้นฐานของ
// contenteditable ซึ่ง **ไม่น่าเชื่อถือเมื่อในบรรทัดมี widget `contenteditable="false"` คั่นอยู่**
// (เส้นคั่นหน้า/แถบคั่นแผ่นของเราเป็น widget แบบนั้นทั้งหมด) เคอร์เซอร์ไปตกใน widget แล้ว
// ProseMirror ก็ดึงกลับ = เหมือนกดแล้วไม่มีอะไรเกิดขึ้น
//
// ผูกเป็นคำสั่งของเราเองจึงจบเรื่อง: คิดจากพิกัดของ **บรรทัดที่วาดจริง** (coordsAtPos +
// posAtCoords) ได้ต้น/ท้ายบรรทัดที่ตาเห็น ไม่ใช่ต้น/ท้ายย่อหน้า — ตรงกับที่ผู้ใช้คาดหวัง
// และทำงานเหมือนกันทั้งบรรทัดที่ตัดคำแล้วและบรรทัดที่ไม่ตัด

/** ตำแหน่งต้น/ท้าย "บรรทัดที่วาดจริง" ของเคอร์เซอร์ — null = หาไม่ได้ */
function lineEdgePos(view, toEnd) {
  const { head } = view.state.selection;
  let c;
  try { c = view.coordsAtPos(head); } catch { return null; }
  const box = view.dom.getBoundingClientRect();
  const cs = getComputedStyle(view.dom);
  const x = toEnd ? box.right - (parseFloat(cs.paddingRight) || 0) - 1
                  : box.left + (parseFloat(cs.paddingLeft) || 0) + 1;
  const y = (c.top + c.bottom) / 2;
  const at = view.posAtCoords({ left: x, top: y });
  if (!at) return null;
  // อย่าให้หลุดออกนอกย่อหน้าเดิม (คลิกนอกกล่องอาจได้บล็อกข้างเคียง)
  const $h = view.state.doc.resolve(head);
  const lo = $h.start(), hi = $h.end();
  let pos = Math.max(lo, Math.min(hi, at.pos));
  // ★ ท้ายบรรทัดที่ "ตัดคำ" กับต้นบรรทัดถัดไปเป็น **ตำแหน่งเดียวกันในเอกสาร**
  // จุดที่เลยตัวอักษรสุดท้ายไปจึงแมปกลับมาเป็นต้นบรรทัดถัดไป → กด End ซ้ำก็ไหลลงไปเรื่อย ๆ
  // ถอยหนึ่งช่องเมื่อพบว่าเป็นรอยตัดคำ (coordsAtPos ฝั่ง "หลัง" ตกไปอยู่คนละบรรทัด)
  if (toEnd && pos > lo) {
    try {
      const after = view.coordsAtPos(pos, 1);
      if (after.top > y + 2) pos--;
    } catch {}
  }
  return pos;
}

/** Home / End — คืน false เมื่อทำไม่ได้ เพื่อให้เบราว์เซอร์จัดการต่อตามเดิม */
export function lineEdgeCmd(toEnd, extend) {
  return (state, dispatch, view) => {
    if (!view) return false;
    const pos = lineEdgePos(view, toEnd);
    if (pos == null || !Number.isFinite(pos)) return false;
    if (dispatch) {
      const $p = state.doc.resolve(pos);
      const sel = extend ? TextSelection.between(state.selection.$anchor, $p)
                         : TextSelection.near($p, toEnd ? -1 : 1);
      dispatch(state.tr.setSelection(sel).scrollIntoView());
    }
    return true;
  };
}

/** Ctrl+Home / Ctrl+End — ต้น/ท้ายเอกสาร */
export function docEdgeCmd(toEnd, extend) {
  return (state, dispatch) => {
    if (dispatch) {
      const $p = state.doc.resolve(toEnd ? state.doc.content.size : 0);
      const sel = extend ? TextSelection.between(state.selection.$anchor, $p)
                         : TextSelection.near($p, toEnd ? -1 : 1);
      dispatch(state.tr.setSelection(sel).scrollIntoView());
    }
    return true;
  };
}

/** ชุดคีย์ Home/End ที่ใช้ร่วมกันทั้งโหมดนิยายและบทภาพยนตร์
 *
 * [alpha.100] ★ **ต้องผูก `Ctrl-` ไว้ด้วย ไม่ใช่แค่ `Mod-`**
 * prosemirror-keymap แปล `Mod-` เป็น **Meta (⌘) บน macOS** → บนแมค `Ctrl+Home` ไม่ตรงกับ
 * อะไรเลย แล้วเบราว์เซอร์ก็ไม่ทำอะไรต่อ = "กด Ctrl+Home แล้วเงียบ" ทั้งที่คนที่ชินจาก Windows
 * กดปุ่มนี้กันเป็นปกติ (ตรงกับหลักของโปรเจกต์: คีย์ลัดต้องทำงานทุกแป้นพิมพ์/ทุกเครื่อง)
 * บน Windows/Linux `Mod-` = `Ctrl-` อยู่แล้ว การใส่ซ้ำจึงชี้ไปที่คำสั่งเดียวกัน ไม่ชนกัน
 */
export const HOME_END_KEYS = {
  Home: lineEdgeCmd(false, false),
  End: lineEdgeCmd(true, false),
  'Shift-Home': lineEdgeCmd(false, true),
  'Shift-End': lineEdgeCmd(true, true),
  'Mod-Home': docEdgeCmd(false, false),
  'Mod-End': docEdgeCmd(true, false),
  'Shift-Mod-Home': docEdgeCmd(false, true),
  'Shift-Mod-End': docEdgeCmd(true, true),
  'Ctrl-Home': docEdgeCmd(false, false),
  'Ctrl-End': docEdgeCmd(true, false),
  'Shift-Ctrl-Home': docEdgeCmd(false, true),
  'Shift-Ctrl-End': docEdgeCmd(true, true),
};

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

  // ══ [alpha.134] ★ ตัวช่วยกดปุ่ม — ต้องเป็น **คำสั่งตัวเดียวกับที่ผูกไว้กับแป้นจริง** ══
  //
  // ของเดิม `pressEnter()` ประกอบสายคำสั่งของตัวเองขึ้นมาใหม่ (ขาด `newlineInCode`
  // และ `exitEmptyListItem`) → โค้ดที่เรียกตัวนี้ (รวมทั้ง e2e) ทดสอบ "Enter" คนละตัว
  // กับที่ผู้ใช้กดจริง · ตอนนี้ทั้งสองทางอ้าง ENTER_CMD/BACKSPACE_CMD ก้อนเดียวกัน
  pressEnter() { ENTER_CMD(this.view.state, this.view.dispatch, this.view); }
  pressBackspace() { BACKSPACE_CMD(this.view.state, this.view.dispatch, this.view); }

  _mkState(doc) {
    return EditorState.create({
      doc, schema,
      plugins: [
        ...(this.getNames ? [mentionPlugin(this.getNames)] : []),
        ...(this.getChecker ? [spellPlugin(this.getChecker)] : []),
        focusLinePlugin(),
        commentAnchorPlugin(),
        prosePageBreakPlugin(),          // [20] เส้นคั่นหน้าของนิยาย
        listMarkerPlugin(),              // [alpha.132r3] รูปแบบของจุดนำ/หมายเลขข้อ
        // [alpha.60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด (fountain/มาร์กดาวน์) — ไม่แตะไฟล์
        markdownCodePlugin(incrementalDecoState),
        buildRules(schema),
        keymap({
          // ขึ้นบรรทัดใหม่แล้วรูปแบบตัวอักษร (หนา/เอียง/ขีด) ต้องติดไปด้วย — แบบ Word
          // ในบล็อกโค้ด Enter = ขึ้นบรรทัดใน pre (ไม่ใช่แตกบล็อก)
          // [alpha.132r4] Enter บน "ข้อว่าง" = **ออกจากรายการ** (พฤติกรรมเดียวกับ MS Word)
          // `splitListItem` ของ prosemirror ตั้งใจคืน false ตรงนี้แล้วฝากให้คำสั่งถัดไปยกออก
          // — แต่เดิมคำสั่งถัดไปคือ `splitBlockKeepMarks` ซึ่งสร้าง "ข้อว่างใบใหม่" ไปเรื่อย ๆ
          // ผู้ใช้จึงเอาจุดนำออกไม่ได้เลยนอกจากไปกดปุ่มสวิตช์บนแถบเครื่องมือ
          Enter: ENTER_CMD,
          Backspace: BACKSPACE_CMD,
          // [alpha.61 ข้อ 3] Shift+Enter = ขึ้นบรรทัด "ในย่อหน้าเดิม" (bypass ระบบย่อหน้า)
          //   ในบล็อกโค้ดยังเป็นทางออกจากบล็อกเหมือนเดิม (exitCode มาก่อน)
          'Shift-Enter': chainCommands(exitCode, insertHardBreak),
          // [alpha.61 ข้อ 3] Ctrl/⌘+Enter = ขึ้นหน้าใหม่ด้วยมือ
          'Mod-Enter': chainCommands(insertPageBreak),
          // [alpha.61 ข้อ 3] Tab = เยื้อง (ในรายการ = ลดชั้น) — เดิมไม่ทำอะไรแล้วโฟกัสหลุดไปแถบรูปแบบ
          Tab: chainCommands(sinkListItem(schema.nodes.list_item), insertTab),
          'Shift-Tab': chainCommands(liftListItem(schema.nodes.list_item), removeTab),
          // [alpha.98 ข้อ 9] Home/End ผูกเป็นคำสั่งจริง (ดูคอมเมนต์ยาวเหนือ KEditor)
          ...HOME_END_KEYS,
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
  /**
   * [alpha.99 ข้อ 3] จำนวนบรรทัดใน .md ของบล็อกระดับบนแต่ละใบ — รางเลขบรรทัดใช้ตัวนี้
   * เพื่อให้เลขตรงกับไฟล์เป๊ะ ไม่ใช่ไปนับลูกของ DOM เอง
   */
  mdLineCounts() {
    return mdLineCounts(this.view.state.doc.toJSON(),
                        { alignComments: this.alignComments });
  }

  /** แผนที่จัดหน้าของบล็อกระดับบน — เก็บลง frontmatter (`align: [3:center]`) */
  getAlignMap() { return collectAlign(this.view.state.doc.toJSON()); }
  setMarkdown(md, alignMap) {
    this.view.updateState(this._mkState(this._docFromMd(md, alignMap)));
  }
  getText() { return this.view.state.doc.textBetween(0, this.view.state.doc.content.size, '\n'); }

  /** [alpha.58r บั๊ก 20] ย้ายเคอร์เซอร์ไปตำแหน่ง pos แล้วเลื่อนจอให้เห็น (คู่กับ SPEditor.gotoPos) */
  // (นิยาม keepScroll อยู่ท้ายไฟล์ — ใช้ร่วมกับ SPEditor)
  gotoPos(pos) {
    const v = this.view;
    const p = Math.max(0, Math.min(Number(pos) || 0, v.state.doc.content.size));
    v.dispatch(v.state.tr.setSelection(TextSelection.near(v.state.doc.resolve(p), 1)).scrollIntoView());
    v.focus();
    return true;
  }

  // ---------- commands (เรียกจากเมนู Electron — คีย์ลัดเลยใช้ได้ทุก layout รวมไทย) ----------
  cmd(name, arg) { return keepScroll(this.view, () => this._cmd(name, arg)); }

  _cmd(name, arg) {
    const s = schema; const v = this.view;
    const run = (c) => { c(v.state, v.dispatch, v); v.focus(); };
    switch (name) {
      case 'bold': return run(toggleMark(s.marks.strong));
      case 'italic': return run(toggleMark(s.marks.em));
      case 'underline': return run(toggleMark(s.marks.underline));
      case 'strike': return run(toggleMark(s.marks.strike));
      // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย — กันเองออกด้วย `excludes` ใน schema แล้ว
      case 'sup': return run(toggleMark(s.marks.sup));
      case 'sub': return run(toggleMark(s.marks.sub));
      // ══ [alpha.132 ข้อ 9] ★ สีตัวอักษร — `arg` = รหัสสี · ค่าว่าง/ไม่ผ่านตัวกรอง = ล้างสี ══
      // ไม่ใช้ `toggleMark` เพราะสีเป็นมาร์ก "มีค่า": กดสีใหม่ทับสีเก่าต้องได้สีใหม่
      // ไม่ใช่สลับเปิด-ปิด (toggleMark จะถอดมาร์กออกเมื่อทั้งช่วงมีมาร์กนั้นอยู่แล้ว)
      case 'color': {
        const mk = s.marks.color;
        const val = normColor(arg);
        const st = v.state;
        const { from, to, empty } = st.selection;
        if (empty) {
          // ไม่ได้เลือกข้อความ = ตั้งสีให้ "ตัวที่กำลังจะพิมพ์" (เหมือน B I U ตอนเคอร์เซอร์เปล่า)
          const cur = (st.storedMarks || st.selection.$from.marks())
            .filter((m) => m.type !== mk);
          v.dispatch(st.tr.setStoredMarks(val ? [...cur, mk.create({ color: val })] : cur));
          v.focus();
          return true;
        }
        const tr = st.tr.removeMark(from, to, mk);
        if (val) tr.addMark(from, to, mk.create({ color: val }));
        v.dispatch(tr.scrollIntoView());
        v.focus();
        return true;
      }
      case 'undo': return run(undo);
      case 'redo': return run(redo);
      // [alpha.103 ข้อ 2] ห่อด้วย keepAlign — เปลี่ยนชนิดบล็อกแล้ว align ต้องอยู่ที่เดิม
      case 'paragraph': return run(keepAlign(setBlockType(s.nodes.paragraph)));
      case 'heading': return run(keepAlign(setBlockType(s.nodes.heading, { level: arg || 1 })));
      // [alpha.97 ข้อ 3+5] สามตัวนี้เป็น "สวิตช์" แล้ว — กดซ้ำ = เอาออก (เหมือน B I U)
      case 'quote': return run(toggleWrapCmd(s.nodes.blockquote));
      case 'lift': return run(lift);
      // [alpha.132r4] ไม่ต้องบอก "ชนิดอีกฝั่ง" อีกแล้ว — ตัวสวิตช์ถอดของเก่าทุกชนิดให้เอง
      case 'ul': return run(toggleListCmd(s.nodes.bullet_list, s.nodes.list_item));
      case 'ol': return run(toggleListCmd(s.nodes.ordered_list, s.nodes.list_item));
      // [alpha.58r บั๊ก 27] เส้นคั่น + บล็อกโค้ด
      case 'code': return run(setBlockType(s.nodes.code_block));
      case 'hr': {
        v.dispatch(v.state.tr.replaceSelectionWith(s.nodes.horizontal_rule.create()).scrollIntoView());
        v.focus(); return;
      }
      case 'align': {
        // จัดหน้าย่อหน้า/หัวข้อทุกบล็อกในช่วงเลือก (arg: 'left'|'center'|'right'|'justify')
        // [alpha.130 ข้อ 3] **เป็นสวิตช์แล้ว** — กดปุ่มที่ติดไฟอยู่ซ้ำ = กลับเป็นชิดซ้ายปกติ
        // (ไอดิออมเดียวกับ B I U / คำพูดยกมา / รายการ ที่ alpha.97 วางไว้)
        const want = arg === 'left' ? null : arg;
        const val = (want && rangeAlign(v.state) === arg) ? null : want;
        const { from, to } = v.state.selection;
        let tr = v.state.tr, changed = false;
        v.state.doc.nodesBetween(from, to, (node, pos) => {
          // บล็อกข้อความทุกใบที่ "ถือ align ได้" — รวมย่อหน้าที่อยู่ใน <li>/<blockquote>
          // (เทียบชนิดตรง ๆ แบบเดิมพลาดง่ายเวลาเพิ่มชนิดใหม่เข้ามาใน schema)
          if (!node.isTextblock || !node.type.spec.attrs || !('align' in node.type.spec.attrs)) return;
          if ((node.attrs.align || null) === val) return;
          tr = tr.setNodeMarkup(pos, null, { ...node.attrs, align: val }); changed = true;
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

  /**
   * [alpha.97 ข้อ 5] ตำแหน่งของรูปที่เคอร์เซอร์ "แตะอยู่" — -1 = ไม่มี
   * รับทั้งกรณีเลือกทั้งโหนด (คลิกรูป) และเคอร์เซอร์อยู่ประชิดหน้า/หลังรูป
   */
  figurePos() {
    const st = this.view.state;
    const sel = st.selection;
    if (sel.node && sel.node.type === schema.nodes.figure) return sel.from;
    const $f = sel.$from;
    if ($f.nodeAfter && $f.nodeAfter.type === schema.nodes.figure) return $f.pos;
    if ($f.nodeBefore && $f.nodeBefore.type === schema.nodes.figure) {
      return $f.pos - $f.nodeBefore.nodeSize;
    }
    return -1;
  }

  /**
   * [alpha.142 ข้อ 6] ตำแหน่งของรูปจาก element ที่ผู้ใช้คลิกขวา
   * (`posAtDOM` ของโหนด atom คืนตำแหน่ง "ข้างใน" บ้าง "ข้างหน้า" บ้าง แล้วแต่จุดที่ชน — ลองทั้งสอง)
   * @returns {number} -1 = หาไม่เจอ
   */
  figurePosOfDom(dom) {
    if (!dom) return -1;
    let pos = -1;
    try { pos = this.view.posAtDOM(dom, 0); } catch { return -1; }
    const doc = this.view.state.doc;
    for (const c of [pos, pos - 1, pos + 1]) {
      if (c < 0 || c > doc.content.size) continue;
      const n = doc.nodeAt(c);
      if (n && n.type === schema.nodes.figure) return c;
    }
    return -1;
  }

  /** ตัวเลือกปัจจุบันของรูปหนึ่งใบ (null = ไม่ใช่รูป) */
  figureOpts(pos) {
    const at = pos >= 0 ? pos : this.figurePos();
    if (at < 0) return null;
    const n = this.view.state.doc.nodeAt(at);
    if (!n || n.type !== schema.nodes.figure) return null;
    return { fit: n.attrs.fit || '', w: n.attrs.w || '', radius: n.attrs.radius ?? '' };
  }

  /**
   * ตั้งตัวเลือกของรูป (เต็มหน้า / ความกว้าง % / ขอบมน)
   * ★ ต้องประกอบ `md` ใหม่ทุกครั้ง — ไม่งั้น `docToMd` เขียนบรรทัดเดิมกลับลงไฟล์
   *   แล้วค่าที่เพิ่งตั้งหายทันทีที่ปิดแท็บ (ค่าที่เห็นบนจอกับในไฟล์ต้องเป็นก้อนเดียวกัน)
   * @returns {boolean} false = ตรงนั้นไม่ใช่รูป
   */
  setFigureOpts(pos, patch) {
    const at = pos >= 0 ? pos : this.figurePos();
    if (at < 0) return false;
    const v = this.view;
    const node = v.state.doc.nodeAt(at);
    if (!node || node.type !== schema.nodes.figure) return false;
    const attrs = { ...node.attrs, ...(patch || {}) };
    attrs.md = imgLine(attrs.alt, attrs.src,
                       { fit: attrs.fit, w: attrs.w, radius: attrs.radius });
    v.dispatch(v.state.tr.setNodeMarkup(at, undefined, attrs));
    v.focus();
    return true;
  }

  /** เอารูปที่เคอร์เซอร์แตะอยู่ออก — คืน false เมื่อไม่มีรูปตรงนั้น (ผู้เรียกไปเปิดตัวเลือกรูปแทน) */
  removeFigure() {
    const pos = this.figurePos();
    if (pos < 0) return false;
    const v = this.view;
    const node = v.state.doc.nodeAt(pos);
    if (!node || node.type !== schema.nodes.figure) return false;
    v.dispatch(v.state.tr.delete(pos, pos + node.nodeSize));
    v.focus();
    return true;
  }

  /**
   * [alpha.82] แทรกข้อความหลายบรรทัดตรงเคอร์เซอร์ — บรรทัดว่าง/ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่จริง
   *
   * เดิมโค้ดที่อยากแทรกข้อความเรียก `cmd('insertText', …)` ซึ่ง **ไม่มีอยู่ใน switch ของ cmd()**
   * → ตกลงไปที่ default แล้วเงียบหายไปเฉย ๆ (ปุ่ม "แทรก" ของกล่องสร้างบทสนทนาจึงไม่เคยทำงาน)
   * `tr.insertText()` ตรง ๆ ก็ใช้ไม่ได้ เพราะ `\n` ในย่อหน้าเดียวไม่ได้แปลว่าขึ้นย่อหน้าใหม่
   * @returns {boolean} true = แทรกสำเร็จ
   */
  insertLines(text) {
    const v = this.view;
    if (!v || !String(text ?? '').length) return false;
    const nodes = String(text).replace(/\r\n?/g, '\n').split('\n').map((line) =>
      schema.nodes.paragraph.create(null, line ? schema.text(line) : null));
    // openStart/openEnd = 1 → ย่อหน้าแรกกับย่อหน้าสุดท้ายเชื่อมกับข้อความที่เคอร์เซอร์อยู่
    // (ไม่งั้นแทรกกลางย่อหน้าแล้วได้ย่อหน้าเปล่าคร่อมหัวท้าย)
    v.dispatch(v.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 1, 1))
      .scrollIntoView());
    v.focus();
    return true;
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
    // ══ [alpha.130 ข้อ 3] ★ สถานะปุ่มจัดหน้าต้องอ่านจาก **ทั้งช่วงที่เลือก** ══
    //
    // ผู้ใช้: *"เมื่อเลือกทั้งหมดแล้วใช้การจัดหน้า จะไม่ถูก toggle เลย"*
    //
    // ของเดิมอ่านจาก `$from.parent` ตัวเดียว — ซึ่งใช้ได้ตอนเคอร์เซอร์อยู่ในย่อหน้า
    // แต่ **Ctrl+A ให้ `AllSelection` ที่ `from = 0`** → `$from.parent` คือโหนด `doc`
    // ไม่ใช่ย่อหน้า → `align = null` → ตกไปเป็น 'left' → กดจัดกึ่งกลางทั้งเอกสารสำเร็จจริง
    // แต่ปุ่มยังติดไฟที่ "ชิดซ้าย" ตลอด (วัดจริง: align=null ทั้งที่ทุกย่อหน้าเป็น justify)
    //
    // ที่ถูกคือดูทุกบล็อกข้อความในช่วง: เหมือนกันหมด = ค่านั้น · ปนกัน = '' (ไม่ติดไฟปุ่มไหนเลย
    // เหมือน Word/Docs) — และ `cmd('align')` ใช้ค่าเดียวกันนี้ตัดสินว่าจะสลับกลับหรือไม่
    out.align = rangeAlign(st);
    // [alpha.97 ข้อ 3+5] สถานะของปุ่มโครงสร้าง — ไม่มีตรงนี้ ปุ่มก็ไม่มีทางติดไฟบอกว่า "เปิดอยู่"
    const dUl = ancestorDepth(st, schema.nodes.bullet_list);
    const dOl = ancestorDepth(st, schema.nodes.ordered_list);
    out.list = dUl > dOl ? 'ul' : dOl > dUl ? 'ol' : '';
    // [alpha.132 ข้อ 7] ปุ่มติดไฟเมื่อ **ทั้งช่วง** อยู่ในคำพูดยกมา — ตรงกับสิ่งที่การกดจะทำ
    // (เลือกปนกันแล้วปุ่มดับ = กดแล้วได้ "ห่อทั้งช่วง" ซึ่งเป็นสิ่งที่เห็นอยู่ว่ายังไม่เป็น)
    {
      const qi = wrapRangeInfo(st, schema.nodes.blockquote);
      out.quote = qi.total > 0 && qi.inside === qi.total;
    }
    out.image = this.figurePos() >= 0;
    // [alpha.132 ข้อ 9] ค่าสีของช่วงที่เลือก — เหมือนกันหมด = ค่านั้น · ปนกัน/ไม่มีสี = ''
    // (ชิปสีบนแถบเครื่องมือใช้ค่านี้บอกว่าตอนนี้ตัวอักษรสีอะไร)
    out.colorValue = rangeColor(st);
    return out;
  }

  focus() { this.view.focus(); }
  destroy() { this.view.destroy(); }
}

// ══════ [alpha.78] ล็อกตำแหน่งเลื่อนหน้าเวลาสั่งคำสั่งจัดรูปแบบ ══════
//
// อาการ: เลือกข้อความทั้งหน้าแล้วกดเปลี่ยนรูปแบบตัวอักษร → จอกระโดด
// ต้นเหตุมีสองทางและทำงานพร้อมกัน:
//   1. `view.focus()` — เบราว์เซอร์เลื่อนไปหา selection ให้เองเมื่อ contenteditable ได้โฟกัส
//   2. `tr.scrollIntoView()` ที่ติดมากับบางคำสั่ง (สลับตัวพิมพ์ · เส้นคั่น · undo/redo)
// ทั้งคู่เล็งไปที่ "ปลายของ selection" — เลือกทั้งหน้าแล้วปลายอยู่ท้ายเอกสาร จอเลยดีดลงไปสุด
//
// กติกาที่ต้องการ: **ถ้าช่วงที่เลือกยังเห็นอยู่บนจอ ห้ามเลื่อน** · หลุดจอไปแล้วค่อยกระโดดตาม
// (ไม่ได้ปิด scrollIntoView ทิ้ง — แค่คืนตำแหน่งเดิมเมื่อไม่มีเหตุต้องเลื่อน)

/** กล่องที่เลื่อนได้ซึ่งครอบตัวแก้ไขอยู่ (ไม่เจอ = ใช้ตัวเลื่อนของเอกสาร) */
function scrollerOf(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const ov = getComputedStyle(n).overflowY;
    if (/(auto|scroll|overlay)/.test(ov) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return document.scrollingElement || document.documentElement;
}

/** ความสูงของ "ช่องมอง" ของกล่องเลื่อน */
function viewportHeight(sc) {
  return (sc === document.scrollingElement || sc === document.documentElement)
    ? window.innerHeight : sc.clientHeight;
}

/**
 * ช่วงที่เลือก ในหน่วย **พิกัดเอกสารของกล่องเลื่อน** (บวก scrollTop กลับเข้าไปแล้ว)
 * ค่านี้ไม่ขึ้นกับว่าตอนนี้เลื่อนอยู่ตรงไหน จึงเอาไปเทียบกับตำแหน่งเลื่อน "ค่าอื่น" ได้
 */
export function selectionDocRange(view, sc) {
  try {
    const { from, to } = view.state.selection;
    const a = view.coordsAtPos(from), b = view.coordsAtPos(to);
    const boxTop = (sc === document.scrollingElement || sc === document.documentElement)
      ? 0 : sc.getBoundingClientRect().top;
    return { top: Math.min(a.top, b.top) - boxTop + sc.scrollTop,
             bottom: Math.max(a.bottom, b.bottom) - boxTop + sc.scrollTop };
  } catch { return null; }
}

/**
 * ══════ [alpha.97 ข้อ 1] ★ ตัดสิน "จะเลื่อนไหม" จากเคอร์เซอร์ **หลัง** คำสั่งจบ ══════
 *
 * ผู้ใช้: *"scroll ไม่ lock เมื่อถูก undo มันกระโดดมั่วไปหมด · ตามหลักคือถ้า cursor
 *          อยู่ในหน้าจอ scroll จะไม่ขยับ จนกว่า cursor จะไม่อยู่ในจอ"*
 *
 * ของเดิมวัด `selectionInView()` **ก่อน** รัน แล้วถ้า "ตอนนั้นเห็นอยู่" ก็ตรึงจอไว้เฉย ๆ
 * ซึ่งใช้ได้กับคำสั่งจัดรูปแบบ (เคอร์เซอร์ไม่ไปไหน) แต่ **ผิดเต็ม ๆ กับ undo/redo**:
 * undo ย้ายเคอร์เซอร์ไปยังจุดที่เพิ่งย้อน ซึ่งอาจอยู่คนละหน้า — เงื่อนไขที่วัดไว้เป็นของ
 * เคอร์เซอร์ *ตัวเก่า* จอจึงถูกตรึงไว้ที่เดิมทั้งที่ควรตามไป (หรือกลับกัน ปล่อยให้กระโดด
 * ทั้งที่ไม่ต้อง)
 *
 * กฎที่ถูกต้องมีข้อเดียว และวัดได้หลังคำสั่งจบเท่านั้น:
 *   **ถ้าคืนตำแหน่งเลื่อนเดิมแล้วเคอร์เซอร์ยังอยู่ในจอ → คืน · ไม่อยู่ → เลื่อนไปหา**
 * (เทียบ "ช่วงที่เลือกในพิกัดเอกสาร" กับ "ช่องมองที่ตำแหน่งเลื่อนเดิม" ตรง ๆ)
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {() => any} run
 */
export function keepScroll(view, run) {
  if (!view || !view.dom || !view.dom.isConnected) return run();
  const sc = scrollerOf(view.dom);
  const top = sc.scrollTop, left = sc.scrollLeft;
  const out = run();
  const settle = () => {
    if (!view.dom.isConnected) return;
    const r = selectionDocRange(view, sc);
    if (!r) return;
    const h = viewportHeight(sc);
    const PAD = 8;                              // เผื่อขอบ — เคอร์เซอร์แนบขอบพอดี = ยังไม่นับว่าเห็น
    if (r.bottom > top + PAD && r.top < top + h - PAD) {
      if (sc.scrollTop !== top) sc.scrollTop = top;
      if (sc.scrollLeft !== left) sc.scrollLeft = left;
      return;
    }
    // หลุดจอไปแล้ว → เลื่อนตามไป โดยวางไว้ราว 1 ใน 3 จากขอบบน (เห็นบริบทรอบ ๆ ด้วย)
    const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
    sc.scrollTop = Math.min(Math.max(0, Math.round(r.top - h / 3)), max);
  };
  settle();                                     // กันตัวที่เลื่อนแบบซิงโครนัส (focus/scrollIntoView)
  requestAnimationFrame(settle);                // กันตัวที่เลื่อนหลังเบราว์เซอร์วาดใหม่
  return out;
}
