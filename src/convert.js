// convert.js — แปลงเอกสารข้ามโหมด นิยาย ↔ บทหนัง (alpha.87)
//
// **ปัญหาเดิม** switchFormat() ไม่ได้แปลงอะไรเลย — ยกไบต์ชุดเดิมให้อีกไวยากรณ์อ่าน
// แล้วเขียนทับไฟล์ทันที รหัสนำหน้าของสองไวยากรณ์ชนกันเต็ม ๆ:
//     `> ยกคำพูด`   → ทรานซิชัน → บันทึกกลับเป็น `>> ยกคำพูด`
//     `- ข้อหนึ่ง`   → ชื่อตัวละคร → บันทึกกลับเป็น `@- ข้อหนึ่ง`
//     `- ข้อสอง`    → บทพูด
// = สลับโหมดหนึ่งครั้งแล้วบันทึก งานเสียถาวร (ไม่มีทางกู้ ไม่มีคำถามให้ตอบ)
//
// **โมดูลนี้บริสุทธิ์ 100%** ไม่แตะ DOM / kapi / state → เทสด้วย node ได้ตรง ๆ
// และ **ไม่มี parser ใหม่สักตัว**: อ่านนิยายด้วย md.js · อ่านบทด้วย fountain.js
// ประกอบบทกลับด้วย blocksToMd() ตัวเดียวกับที่ตัวแก้ไขใช้ · แฮชด้วย hashText() ของ num.js
//
// ───────── การกลับ 3 ชั้น (กลไกเดียว ไม่แยกทางเดินโค้ด) ─────────
// ตอนแปลงไป เราจด "ชนิดของบล็อกฝั่งต้นทาง" ไว้ในไฟล์เป็น RLE ตัวอักษรเดียว (spMap)
// พร้อมแฮชของผลลัพธ์ (spHash) — **ไม่เก็บสำเนาเนื้อหาแม้แต่ไบต์เดียว**
//   ชั้น 1  spHash ตรง = ยังไม่มีใครแก้     → คืนเป๊ะ 100%
//   ชั้น 2  แก้แล้วแต่จำนวนบล็อกเท่าเดิม    → คืนชนิดตาม spMap ทีละบล็อก
//   ชั้น 3  โครงเปลี่ยน (spMap ใช้ไม่ได้)   → แปลงตามตาราง + ต้องบอกก่อนว่าจะเสียอะไร
// ชั้น 1 กับ 2 คือโค้ดบรรทัดเดียวกัน ต่างแค่ผลของการเทียบแฮช (ดู convertBody)
// แปลงกลับสำเร็จเมื่อไหร่ **ลบ spMap/spHash ทิ้ง** → ไฟล์ที่ไม่เคยสลับโหมดไม่มีโอเวอร์เฮดเลย

import { SP_ELEMS, parseScript, blocksToMd } from './fountain.js';
import { hashText } from './num.js';
import { mdToDoc, docToMd } from './md.js';

// ───────── ชนิดบล็อกฝั่งนิยาย (คู่ขนานกับ SP_ELEMS ของบท) ─────────
// ป้ายไทยเป็น **ข้อมูล** แบบเดียวกับ SP_ELEMS — ใช้บอกผู้ใช้ว่าอะไรจะกลายเป็นอะไร
export const PROSE_ELEMS = {
  h1: { th: 'หัวข้อ 1' }, h2: { th: 'หัวข้อ 2' }, h3: { th: 'หัวข้อ 3' },
  h4: { th: 'หัวข้อ 4' }, h5: { th: 'หัวข้อ 5' }, h6: { th: 'หัวข้อ 6' },
  p: { th: 'ย่อหน้า' }, pbold: { th: 'ย่อหน้าหนา' }, pitalic: { th: 'ย่อหน้าเอียง' },
  pright: { th: 'ย่อหน้าชิดขวา' }, quote: { th: 'ยกคำพูด' },
  ul: { th: 'รายการจุด' }, ol: { th: 'รายการเลข' }, hr: { th: 'เส้นคั่น' },
  code: { th: 'บล็อกโค้ด' }, img: { th: 'รูปภาพ' },
  pagebreak: { th: 'ขึ้นหน้าใหม่' }, blank: { th: 'บรรทัดว่าง' },
};

// ───────── ตารางแมป: **ข้อมูล ไม่ใช่โค้ด** ─────────
// [ชนิดนิยาย, ชนิดบท] เรียงตามลำดับความสำคัญ · ทางกลับ derive จากตารางเดียวกันนี้
//   ไป   = คู่แรกที่ "ชนิดนิยาย" ตรง        (เช่น h3 → หัวฉาก)
//   กลับ = คู่แรกที่ "ชนิดบท" ตรง           (เช่น ฉากย่อย → h3)
// คู่ที่ซ้ำฝั่งใดฝั่งหนึ่งจึงทำหน้าที่ทางเดียว — เพิ่มบรรทัดเดียวได้ทั้งสองทิศ
const PAIRS = [
  // ── คู่หลัก: ใช้ทั้งสองทิศ ──
  ['h3', 'scene'],              // ↔ h3 = หัวฉาก (มาตรฐานของโปรแกรมมาตั้งแต่ v1)
  ['h2', 'act-break'],          // ↔ ตอน
  ['h1', 'act-break'],          // → ตอน (ขากลับเป็น h2 — ดูกลุ่มล่าง)
  ['p', 'action'],              // ↔ ย่อหน้า = บรรยาย
  ['pbold', 'character'],       // ↔ ย่อหน้าหนา = ชื่อตัวละคร (วัดแล้ว: `@สมชาย` อ่านกลับได้ข้อความเดิมเป๊ะ)
  // **เอียงไปเป็นวงเล็บไม่ได้** ถึงจะดูสมมาตรกับ pbold ก็ตาม — วัดกับเอนจินจริงแล้วเสียสองแบบ:
  //   ลอย ๆ ไม่มีตัวละครข้างบน → classify ตีเป็น **โน้ต** (ไม่ใช่วงเล็บด้วยซ้ำ)
  //   อยู่ใต้ตัวละคร → เป็นวงเล็บถูก แต่ classify **เขียนวงเล็บลงในข้อความ** (`กระซิบ` → `(กระซิบ)`)
  // ขาไปจึงเป็นบรรยายที่เก็บ `*` ไว้ · **ขากลับยังคืนวงเล็บเป็นย่อหน้าเอียงครบตามเดิม**
  ['pitalic', 'action'],
  ['pright', 'transition'],     // ↔ ย่อหน้าชิดขวา = ทรานซิชัน
  ['hr', 'page-break'],         // ↔ `---` = ขึ้นหน้าใหม่
  ['code', 'raw'],              // ↔ บล็อกโค้ด = คงบรรทัดเดิมเป๊ะ
  ['img', 'image'],             // ↔ รูปภาพ
  ['blank', 'blank'],           // ↔ บรรทัดว่าง
  // ── กลับอย่างเดียว: ชนิดบทที่เหลือ (ฝั่งนิยายถูกจับจองไปแล้วข้างบน) ──
  // **ต้องอยู่ก่อนกลุ่มล่าง** เพราะขากลับเอา "คู่แรกที่ชนิดบทตรง"
  ['h3', 'subheader'], ['h3', 'shot'], ['h3', 'outline3'], ['h3', 'intercut'],
  ['pitalic', 'parenthetical'], // ← วงเล็บ = ย่อหน้าเอียง
  ['h1', 'outline1'], ['h2', 'outline2'],
  ['p', 'dialogue'], ['p', 'transition-in'], ['p', 'summary'], ['p', 'note'],
  ['p', 'cont-left'], ['pright', 'cont-right'],
  // ── ไปอย่างเดียว: ชนิดนิยายที่เหลือ (ฝั่งบทถูกจับจองไปแล้วข้างบน) ──
  ['h4', 'subheader'], ['h5', 'outline3'], ['h6', 'action'],
  ['quote', 'action'],          // → **บรรยาย** ไม่ใช่ทรานซิชัน (เก็บ `> ` ไว้ในข้อความ)
  ['ul', 'action'],             // → บรรยาย เก็บ `- ` ไว้
  ['ol', 'action'],             // → บรรยาย เก็บ `1. ` ไว้
  ['pagebreak', 'page-break'],
];

/** ไป: ชนิดนิยาย → ชนิดบท */
export const FWD = {};
/** กลับ: ชนิดบท → ชนิดนิยาย */
export const REV = {};
for (const [prose, sp] of PAIRS) {
  if (!(prose in FWD)) FWD[prose] = sp;
  if (!(sp in REV)) REV[sp] = prose;
}

// ───────── รหัสตัวอักษรเดียวสำหรับ spMap ─────────
// **ตัวเล็ก = ชนิดนิยาย · ตัวใหญ่ = ชนิดบท** — ตัวพิมพ์บอกเองว่าแผนที่นี้ของฝั่งไหน
// (จึงไม่ต้องมีคีย์ที่สองในไฟล์คอยบอก และเอาไปใช้ผิดทิศไม่ได้)
// ห้ามใช้ตัวเลข — ตัวเลขคือจำนวนซ้ำของ RLE
const PROSE_CODE = { h1: 't', h2: 's', h3: 'e', h4: 'f', h5: 'v', h6: 'w',
  p: 'a', pbold: 'b', pitalic: 'i', pright: 'r', quote: 'q', ul: 'u', ol: 'o',
  hr: 'h', code: 'c', img: 'g', pagebreak: 'k', blank: 'z' };
const SP_CODE = { scene: 'S', action: 'A', character: 'C', dialogue: 'D',
  parenthetical: 'P', transition: 'T', 'transition-in': 'I', subheader: 'U',
  intercut: 'X', shot: 'H', 'act-break': 'K', 'page-break': 'B', summary: 'M',
  outline1: 'E', outline2: 'F', outline3: 'G', note: 'N', 'cont-left': 'L',
  'cont-right': 'R', image: 'V', raw: 'W', blank: 'Z' };
const flip = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const PROSE_KIND = flip(PROSE_CODE);   // รหัสตัวเล็ก → ชนิดนิยาย
const SP_KIND = flip(SP_CODE);         // รหัสตัวใหญ่ → ชนิดบท

/** ป้ายไทยของชนิดบล็อก (ฝั่งไหนก็ได้) — ใช้บอกผู้ใช้ในกล่องยืนยัน */
export const kindLabel = (k) =>
  (PROSE_ELEMS[k] || SP_ELEMS[k] || {}).th || String(k);

// ───────── RLE ─────────
/** ['A','A','A','C'] → 'A3C' */
export function rleEncode(codes) {
  let out = '';
  for (let i = 0; i < codes.length;) {
    let n = 1;
    while (codes[i + n] === codes[i]) n++;
    out += codes[i] + (n > 1 ? n : '');
    i += n;
  }
  return out;
}
/** 'A3C' → ['A','A','A','C'] */
export function rleDecode(s) {
  const out = [];
  for (const m of String(s ?? '').matchAll(/([A-Za-z])(\d*)/g))
    for (let i = 0, n = parseInt(m[2], 10) || 1; i < n; i++) out.push(m[1]);
  return out;
}

// ───────── ฝั่งนิยาย: doc → บล็อกทีละบรรทัด ─────────
const textOf = (n) => (n.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('');
/** ทุกช่วงข้อความที่ไม่ว่างมีมาร์กนี้ครบ = ทั้งย่อหน้าเป็นตัวหนา/เอียง (ไม่ใช่แค่บางคำ) */
const allMark = (n, mark) => {
  const segs = (n.content || []).filter((x) => x.type === 'text' && x.text.trim());
  return segs.length > 0 && segs.every((x) => (x.marks || []).some((k) => k.type === mark));
};

function proseKind(node) {
  switch (node.type) {
    case 'heading': return 'h' + Math.min(6, Math.max(1, (node.attrs || {}).level || 1));
    case 'horizontal_rule': return 'hr';
    case 'page_break': return 'pagebreak';
    case 'code_block': return 'code';
    case 'figure': return 'img';
    case 'blockquote': return 'quote';
    case 'bullet_list': return 'ul';
    case 'ordered_list': return 'ol';
    default: break;
  }
  if (!textOf(node).trim()) return 'blank';
  if (((node.attrs || {}).align) === 'right') return 'pright';
  if (allMark(node, 'strong')) return 'pbold';
  if (allMark(node, 'em')) return 'pitalic';
  return 'p';
}

/** ข้อความที่จะยกไปใส่บล็อกบท — ถอดเฉพาะรหัสที่ "ชนิด" เก็บไว้แล้ว */
function textFor(kind, line, el) {
  if (/^h[1-6]$/.test(kind)) return line.replace(/^#{1,6}\s*/, '');
  if (kind === 'hr' || kind === 'pagebreak' || kind === 'blank') return '';
  // ชื่อตัวละคร/วงเล็บเป็นบล็อกที่มีความหมายในตัว → เก็บข้อความล้วน
  // ถ้าปลายทางเป็น "บรรยาย" ต้องคง `**`/`*` ไว้ในข้อความ ไม่งั้นมาร์กหนา/เอียงหาย
  if (kind === 'pbold' && el === 'character') return line.replace(/^\*\*|\*\*$/g, '');
  if (kind === 'pitalic' && el === 'parenthetical') return line.replace(/^\*|\*$/g, '');
  return line;   // p/pright/quote/ul/ol/code/img — ยกทั้งบรรทัด (เครื่องหมายรายการ/`>` ติดไปด้วย)
}

/** ชนิด+ข้อความ → บรรทัดมาร์กดาวน์ของนิยาย (ตรงข้ามกับ textFor เป๊ะ) */
function proseLine(kind, text, el) {
  const t = String(text ?? '');
  const h = /^h([1-6])$/.exec(kind);
  if (h) return t.trim() ? '#'.repeat(+h[1]) + ' ' + t : '';
  if (kind === 'pbold') return el === 'character' ? (t.trim() ? '**' + t + '**' : '') : t;
  if (kind === 'pitalic') return el === 'parenthetical' ? (t.trim() ? '*' + t + '*' : '') : t;
  if (kind === 'hr') return '---';
  if (kind === 'pagebreak') return '<!--pagebreak-->';
  if (kind === 'blank') return '';
  return t;
}

/**
 * แตกเนื้อนิยายเป็นบล็อก **หนึ่งบล็อกต่อหนึ่งบรรทัดมาร์กดาวน์**
 * (รายการ 2 ข้อ = 2 บล็อก · โค้ด 3 บรรทัด = 3 บล็อก) เพื่อให้ 1:1 กับบรรทัดของบท
 * ซึ่งเป็นเงื่อนไขที่ทำให้ spMap ทีละบล็อกตรงกันทั้งสองทิศ
 */
export function proseBlocks(body, alignMap) {
  const doc = mdToDoc(String(body ?? ''), alignMap);
  const out = [];
  for (const node of doc.content || []) {
    const k = proseKind(node);
    for (const line of docToMd({ type: 'doc', content: [node] }, { alignComments: false }).split('\n')) {
      // หัวข้อที่ไม่มีข้อความถูกเขียนออกมาเป็นบรรทัดว่าง — ต้องนับเป็นบรรทัดว่างจริง ๆ
      const kind = (k === 'hr' || k === 'pagebreak' || line.trim()) ? k : 'blank';
      out.push({ kind, line });
    }
  }
  return out;
}

/** แตกเนื้อบทเป็นบล็อก (หนึ่งบรรทัด = หนึ่งบล็อก อยู่แล้วตามนิยามของ fountain.js) */
export const scriptBlocks = (body) =>
  parseScript(String(body ?? '')).map((b) => ({ kind: b.el, text: b.text || '' }));

/**
 * align ของนิยายเก็บเป็น "ดัชนีโหนด → ค่า" ใน frontmatter ไม่ใช่รหัสในบรรทัด
 * ทรานซิชันของบทต้องกลายเป็นย่อหน้าชิดขวา → ต้องหาว่าย่อหน้านั้นเป็นโหนดที่เท่าไร
 * วิธีเดียวที่ไม่ต้องเดาการรวมโหนดของ mdToDoc คือ **อ่านผลลัพธ์กลับแล้วไล่ตามลำดับ**
 */
function alignMapFor(outMd, rightTexts) {
  if (!rightTexts.length) return {};
  const map = {};
  let k = 0;
  (mdToDoc(outMd).content || []).forEach((n, i) => {
    if (k < rightTexts.length && n.type === 'paragraph' && textOf(n) === rightTexts[k]) { map[i] = 'right'; k++; }
  });
  return map;
}

// ───────── ตัวแปลงจริง ─────────
/**
 * @param {string} src เนื้อไฟล์ (ไม่รวม frontmatter)
 * @param {'prose'|'screenplay'} to โหมดปลายทาง
 * @param {string[]|null} kinds ชนิดที่ "จดไว้" ทีละบล็อก — null = ตัดสินจากตาราง
 */
function run(src, to, kinds, alignMap) {
  if (to === 'screenplay') {
    const blocks = proseBlocks(src, alignMap);
    const els = blocks.map((b, i) => kinds?.[i] || FWD[b.kind] || 'action');
    const body = blocksToMd(blocks.map((b, i) => ({ el: els[i], text: textFor(b.kind, b.line, els[i]) })));
    return { body, spMap: rleEncode(blocks.map((b) => PROSE_CODE[b.kind] || 'a')), spHash: hashText(body) };
  }
  const blocks = scriptBlocks(src);
  const got = blocks.map((b, i) => kinds?.[i] || REV[b.kind] || 'p');
  const body = blocks.map((b, i) => proseLine(got[i], b.text, b.kind)).join('\n');
  const rights = blocks.filter((b, i) => got[i] === 'pright').map((b) => b.text);
  return { body, spMap: rleEncode(blocks.map((b) => SP_CODE[b.kind] || 'W')),
           spHash: hashText(body), align: alignMapFor(body, rights) };
}

/**
 * แปลงเนื้อไฟล์ข้ามโหมด
 * @param {string} body เนื้อไฟล์ปัจจุบัน
 * @param {'prose'|'screenplay'} to โหมดปลายทาง
 * @param {{spMap?:string, spHash?:string, align?:string|string[]}} meta frontmatter ปัจจุบัน
 * @returns {{body:string, spMap:string, spHash:string, align?:object,
 *            mode:'exact'|'map'|'table'}}
 *   mode: exact = คืนเป๊ะ (ยังไม่มีใครแก้) · map = คืนชนิดตามที่จดไว้ · table = แปลงตามตาราง
 */
export function convertBody(body, to, meta = {}) {
  const src = String(body ?? '');
  const alignMap = to === 'screenplay' ? (meta.align ?? undefined) : undefined;
  // รหัสที่จดไว้ต้องเป็นคำศัพท์ของ "โหมดปลายทาง" (ตัวพิมพ์เป็นตัวบอก) และจำนวนบล็อกต้องเท่าเดิม
  const want = to === 'screenplay' ? SP_KIND : PROSE_KIND;
  const codes = rleDecode(meta.spMap);
  const n = to === 'screenplay' ? proseBlocks(src, alignMap).length : scriptBlocks(src).length;
  const usable = codes.length > 0 && codes.length === n && codes.every((c) => want[c]);
  const r = run(src, to, usable ? codes.map((c) => want[c]) : null, alignMap);
  r.mode = !usable ? 'table' : (hashText(src) === String(meta.spHash ?? '') ? 'exact' : 'map');
  return r;
}

/**
 * ชั้น 3 จะทำให้ชนิดไหนเปลี่ยนไปแบบกลับไม่ได้บ้าง — คำนวณจากตารางเดียวกับที่ใช้แปลงจริง
 * (ไม่มีรายการที่เขียนด้วยมือให้ลืมอัปเดตตามตาราง)
 * @returns {Array<{from:string, to:string, n:number}>} เรียงจากมากไปน้อย
 */
export function lossReport(body, to) {
  const src = String(body ?? '');
  const counts = new Map();
  const bump = (from, kind) => counts.set(from + ' ' + kind, (counts.get(from + ' ' + kind) || 0) + 1);
  if (to === 'screenplay') {
    for (const b of proseBlocks(src)) {
      const back = REV[FWD[b.kind] || 'action'] || 'p';
      if (back !== b.kind) bump(b.kind, back);
    }
  } else {
    for (const b of scriptBlocks(src)) {
      const back = FWD[REV[b.kind] || 'p'] || 'action';
      if (back !== b.kind) bump(b.kind, back);
    }
  }
  return [...counts].map(([k, n]) => ({ from: k.split(' ')[0], to: k.split(' ')[1], n }))
    .sort((a, b) => b.n - a.n);
}
