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
import { inputRules, wrappingInputRule, textblockTypeInputRule,
         smartQuotes, InputRule } from 'prosemirror-inputrules';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { mdToDoc, docToMd, mdLineCounts, collectAlign } from './md.js';
import { searchPlugin } from './search.js';
// [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ (โมดูลบริสุทธิ์ — ไม่ import prosemirror)
import { caseTransform } from './text-case.js';
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
    // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย — อยู่กลุ่มเดียวกันและกันเองออก (ตัวเดียวกันเป็นทั้งสองไม่ได้)
    sup: { group: 'vertalign', excludes: 'vertalign',
           parseDOM: [{ tag: 'sup' }], toDOM: () => ['sup', 0] },
    sub: { group: 'vertalign', excludes: 'vertalign',
           parseDOM: [{ tag: 'sub' }], toDOM: () => ['sub', 0] },
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

/** ความลึกของบรรพบุรุษชนิด `type` ที่ใกล้เคอร์เซอร์ที่สุด (0 = ไม่ได้อยู่ข้างใน) */
export function ancestorDepth(state, type) {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === type) return d;
  return 0;
}

/**
 * สวิตช์รายการ — ในรายการชนิดเดียวกัน = ถอดออกจนพ้นทุกชั้น · ในอีกชนิด = สลับชนิด · นอกรายการ = ห่อ
 * ต้องมี `view` เพื่อถอดหลายชั้น (liftListItem ทำได้ทีละชั้น แต่ละชั้นคิดจาก state ที่ปรับแล้ว)
 */
export function toggleListCmd(listType, itemType, otherType) {
  return (state, dispatch, view) => {
    if (ancestorDepth(state, listType)) {
      const lift = liftListItem(itemType);
      if (!dispatch) return lift(state);
      if (!view) return lift(state, dispatch);
      let guard = 0;
      while (ancestorDepth(view.state, listType) && guard++ < 12) {
        if (!lift(view.state, view.dispatch, view)) break;
      }
      return true;
    }
    const od = otherType ? ancestorDepth(state, otherType) : 0;
    if (od) {
      // ══ [alpha.98 ข้อ 5] ★ สลับชนิดต้องแตะ **เฉพาะข้อที่เลือก** ══
      //
      // ผู้ใช้: *"bullet เมื่อกดเปลี่ยนเป็นตัวเลข มันเปลี่ยนบรรทัดก่อนหน้าด้วย
      //          ซึ่งมันต้องเป็นบรรทัดที่ cursor หรือ select อยู่สิ"*
      //
      // ของเดิม `setNodeMarkup()` ที่ **โหนดรายการทั้งก้อน** → ทุกข้อในรายการเปลี่ยนตาม
      // ที่ถูกคือ "ถอดข้อที่เลือกออกมาก่อน แล้วค่อยห่อด้วยชนิดใหม่" — รายการเดิมจะถูกผ่า
      // ออกเป็นท่อนบน/ท่อนที่เลือก/ท่อนล่างเองตามธรรมชาติ (พฤติกรรมเดียวกับ Word)
      if (!dispatch) return true;
      if (!view) return wrapInList(listType)(state, dispatch);
      const liftOut = liftListItem(itemType);
      let g2 = 0;
      while (ancestorDepth(view.state, otherType) && g2++ < 12) {
        if (!liftOut(view.state, view.dispatch, view)) break;
      }
      return wrapInList(listType)(view.state, view.dispatch, view);
    }
    return wrapInList(listType)(state, dispatch, view);
  };
}

/** สวิตช์บล็อกที่ห่อได้ (คำพูดยกมา) — อยู่ข้างในแล้ว = ถอดออก */
export function toggleWrapCmd(nodeType) {
  return (state, dispatch, view) => {
    if (ancestorDepth(state, nodeType)) return lift(state, dispatch);
    return wrapIn(nodeType)(state, dispatch, view);
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
      case 'undo': return run(undo);
      case 'redo': return run(redo);
      // [alpha.103 ข้อ 2] ห่อด้วย keepAlign — เปลี่ยนชนิดบล็อกแล้ว align ต้องอยู่ที่เดิม
      case 'paragraph': return run(keepAlign(setBlockType(s.nodes.paragraph)));
      case 'heading': return run(keepAlign(setBlockType(s.nodes.heading, { level: arg || 1 })));
      // [alpha.97 ข้อ 3+5] สามตัวนี้เป็น "สวิตช์" แล้ว — กดซ้ำ = เอาออก (เหมือน B I U)
      case 'quote': return run(toggleWrapCmd(s.nodes.blockquote));
      case 'lift': return run(lift);
      case 'ul': return run(toggleListCmd(s.nodes.bullet_list, s.nodes.list_item,
                                          s.nodes.ordered_list));
      case 'ol': return run(toggleListCmd(s.nodes.ordered_list, s.nodes.list_item,
                                          s.nodes.bullet_list));
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
    out.align = (p.type.name === 'paragraph' || p.type.name === 'heading') ? (p.attrs.align || 'left') : null;
    // [alpha.97 ข้อ 3+5] สถานะของปุ่มโครงสร้าง — ไม่มีตรงนี้ ปุ่มก็ไม่มีทางติดไฟบอกว่า "เปิดอยู่"
    const dUl = ancestorDepth(st, schema.nodes.bullet_list);
    const dOl = ancestorDepth(st, schema.nodes.ordered_list);
    out.list = dUl > dOl ? 'ul' : dOl > dUl ? 'ol' : '';
    out.quote = !!ancestorDepth(st, schema.nodes.blockquote);
    out.image = this.figurePos() >= 0;
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
