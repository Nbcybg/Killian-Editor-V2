// text-width.js — เอนจินตัดบรรทัด "วัดจากความกว้างจริง" (alpha.82)
//
// ═══ ทำไมต้องเขียนใหม่ ═══
//
// ของเดิมทั้งนิยายและบทภาพยนตร์ประมาณจำนวนบรรทัดจาก **จำนวนตัวอักษร ÷ ตัวอักษรต่อนิ้ว**
// โดยตั้ง `CHARS_PER_INCH = 10` ตายตัว (Courier 12pt — มาตรฐานบทภาพยนตร์ฝรั่ง)
// ซึ่งผิดสองชั้นกับงานไทย:
//   1. สระบน/ล่างและวรรณยุกต์ซ้อนอยู่บนพยัญชนะ **ไม่กินความกว้างเลย** แต่ถูกนับเต็มตัว
//   2. ฟอนต์ไทยที่ใช้จริงไม่ได้กว้างตัวละ 0.1 นิ้ว — วัดจากของจริงได้ **10.2 ตัว/นิ้ว**
//      ผิดแค่ 2% แต่พอคูณกับย่อหน้าที่ยาวใกล้เส้นแบ่งก็เกินไป **1 บรรทัดเต็ม**
//      → ตัวจัดหน้าคิดว่าเนื้อเต็มหน้าเร็วกว่าความจริง หน้ากระดาษเลยสั้นยาวไม่เท่ากัน
//
// ═══ แบบที่วงการเขาใช้กัน (สำรวจก่อนออกแบบ) ═══
//
//   · unioffice (Go)  — ไม่จัดหน้าเอง เขียน OOXML แล้วให้ Word จัดให้
//   · unipdf (Go)     — `GetRuneMetrics(r).Wx × fontSize` = advance width รายกลิฟจากฟอนต์
//                       ตัดที่ช่องว่างล่าสุด ถ้าไม่มีช่องว่างก็ตัดกลางคำ
//   · genoffice (TS/Electron — สแตกเดียวกับเรา · เคลม "page breaks land where Word puts them")
//                     — `FontMetricsProvider` เป็น interface สลับได้ระหว่าง heuristic กับของจริง
//                       ตัววัดจริงคือ **canvas measureText** (ไม่อ่าน DOM เลย) + แคชต่อฟอนต์
//                       ละตินตัดที่ช่องว่างแบบ greedy · CJK ตัดรายตัวอักษร
//
// **ไม่มีเจ้าไหนใช้ "ตัวอักษรต่อนิ้ว"** — ทุกเจ้าวัดความกว้างจริงของกลิฟ
//
// ═══ โครงของไฟล์นี้ ═══
//
// บริสุทธิ์ 100% — ตัววัดถูก **ฉีดเข้ามา** (แบบเดียวกับที่ ai-core.js ฉีด http เข้ามา)
//   · ไม่ฉีด  → ตกไปใช้ heuristic (ตัวอักษรที่มองเห็น ÷ cpi) → เทสด้วย node ได้ ไม่ต้องมี canvas
//   · ฉีดแล้ว → ใช้ความกว้างจริงของฟอนต์ที่ผู้ใช้เลือก (ดู src/text-measure.js)
//
// และมี **ตัวตัดบรรทัดชุดเดียว** (`wrapLineStrings`) ที่ทั้งจอและ PDF เรียกใช้ —
// เดิมมีสองชุดที่ "ต้องได้ผลเท่ากันเป๊ะ" แล้วมันไม่เท่ากันจริง (บั๊กบรรทัดเปล่าใน PDF)

/** พิกเซล CSS ต่อนิ้ว */
export const DPI = 96;

/** ตัวอักษรต่อนิ้วของ Courier 12pt — ใช้เมื่อยังไม่มีตัววัดจริง (เทส/ตอนบูตก่อนฟอนต์พร้อม) */
export const FALLBACK_CPI = 10;

/**
 * อักขระที่ "ไม่กินความกว้าง"
 *
 * ไทย: U+0E31 (ั), U+0E34–U+0E3A (ิ ี ึ ื ุ ู ฺ), U+0E47–U+0E4E (็ ่ ้ ๊ ๋ ์ ํ ๎)
 * เติม combining mark สากลไว้ด้วย เผื่อข้อความละติน/เวียดนามที่ใส่สระแยก
 */
export const ZERO_WIDTH_RE = new RegExp(
  '[' +
  '\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E' +   // ไทย: สระบน/ล่าง · ไม้ไต่คู้ · วรรณยุกต์ · การันต์
  '\\u0300-\\u036F\\u0483-\\u0489' +          // combining ละติน/ซีริลลิก
  '\\u0591-\\u05BD\\u064B-\\u065F\\u0670' +   // ฮีบรู/อาหรับ
  '\\u200B-\\u200D\\uFEFF' +                  // ช่องว่างความกว้างศูนย์
  ']', 'g');

/** เวอร์ชันไม่มีธง g — `.test()` ของ regex ที่มี g เก็บ lastIndex ไว้ (เรียกซ้ำได้ผลสลับกัน) */
const ZERO_WIDTH_ONE = new RegExp(ZERO_WIDTH_RE.source);

/** ความยาวที่ "มองเห็นเป็นความกว้าง" (ตัดอักขระซ้อนที่กว้าง 0 ออก) — ใช้กับ heuristic เท่านั้น */
export function visualLength(text) {
  return String(text ?? '').replace(ZERO_WIDTH_RE, '').length;
}

// ────────────────────────────────────────────────────────────────
// 1) ตัววัด (ฉีดเข้ามา)
// ────────────────────────────────────────────────────────────────

/**
 * @typedef {(text: string, kind: string) => number} Measurer
 *   คืนความกว้างเป็น **พิกเซล CSS** · คืนค่าที่ไม่ใช่ตัวเลข = ให้ตกไปใช้ heuristic
 *   `kind` บอกว่าเป็นข้อความของอะไร ('sp' = บทภาพยนตร์ · 'prose' = นิยาย) เพราะคนละฟอนต์
 */
let _measure = null;

/**
 * แคชผลตัดบรรทัดทั้งก้อน — **จำเป็น ไม่ใช่ของแถม**
 *
 * `paginate()` เรียกตัวตัดบรรทัดทุกบล็อกทุกครั้งที่จัดหน้าใหม่ (ทุก 300ms ขณะพิมพ์)
 * และตัวตัดเรียก `measureText` หลายสิบครั้งต่อบล็อก (ค้นทวิภาคหาจุดตัด)
 * ตอนแรกไม่ได้ใส่แคชชั้นนี้แล้ววัดได้ว่า e2e ช้าลงราว 8 เท่า — เนื้อหาส่วนใหญ่ไม่เปลี่ยน
 * ระหว่างจัดหน้าสองรอบติดกัน จึงคุ้มมากที่จะจำผลไว้ทั้งก้อน
 */
const WRAP_CACHE_CAP = 4000;
let _wrapCache = new Map();
let _epoch = 0;

/** ล้างของที่จำไว้ทั้งหมด — เรียกเมื่อฟอนต์/ขนาด/ตัววัดเปลี่ยน (ผลเดิมใช้ไม่ได้แล้ว) */
export function bumpMeasureEpoch() { _epoch++; _wrapCache = new Map(); }
/** รุ่นของการวัดปัจจุบัน (ใช้ในเทส/วินิจฉัย) */
export function measureEpoch() { return _epoch; }

/** ติดตั้งตัววัดจริง (แอปเรียกตอนบูตและทุกครั้งที่ฟอนต์/ขนาดเปลี่ยน) · null = ถอดออก */
export function setMeasurer(fn) {
  _measure = typeof fn === 'function' ? fn : null;
  bumpMeasureEpoch();
}
/** มีตัววัดจริงติดตั้งอยู่ไหม (เทส/วินิจฉัยใช้) */
export function hasMeasurer() { return !!_measure; }

/**
 * ความกว้างของข้อความเป็นพิกเซล
 * @param {string} text
 * @param {object} o { kind, cpi, heuristic }  `heuristic:true` = บังคับใช้สูตร ไม่แตะตัววัดจริง
 */
export function measureWidth(text, o = {}) {
  const s = String(text ?? '');
  if (!s) return 0;
  if (!o.heuristic && _measure) {
    const w = _measure(s, o.kind || 'sp');
    if (Number.isFinite(w) && w >= 0) return w;
  }
  return (visualLength(s) / (o.cpi > 0 ? o.cpi : FALLBACK_CPI)) * DPI;
}

// ────────────────────────────────────────────────────────────────
// 2) แยกโทเคน
// ────────────────────────────────────────────────────────────────

// ตัวอักษรของภาษาที่ **ตัดบรรทัดตรงไหนก็ได้** (ไม่ใช้ช่องว่างคั่นคำ)
const BREAKABLE_RE = /[฀-๿ក-៿က-႟⺀-鿿ꥠ-꥿가-힯豈-﫿＀-｠]/;
const SPACE_RE = /\s/;

export const TOK_SPACE = 'space';    // ช่องว่าง — จุดตัดบรรทัด และถูกกลืนเมื่อตัดตรงนั้น
export const TOK_ATOM = 'atom';      // คำที่ห้ามตัดกลาง (ละติน/ตัวเลข)
export const TOK_RUN = 'run';        // ช่วงที่ตัดตรงไหนก็ได้ (ไทย/เขมร/พม่า/CJK)

/**
 * แยกย่อหน้าเป็นโทเคน — ตัวตัดบรรทัดเดินตามนี้
 * @returns {Array<{t:string, s:string}>}
 */
export function tokenize(para) {
  const s = String(para ?? '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const start = i;
    const ch = s[i];
    let t;
    if (SPACE_RE.test(ch)) t = TOK_SPACE;
    else if (BREAKABLE_RE.test(ch)) t = TOK_RUN;
    else t = TOK_ATOM;
    let j = i + 1;
    while (j < s.length) {
      const c = s[j];
      const tj = SPACE_RE.test(c) ? TOK_SPACE : (BREAKABLE_RE.test(c) ? TOK_RUN : TOK_ATOM);
      // อักขระซ้อน (สระ/วรรณยุกต์) เกาะไปกับตัวก่อนหน้าเสมอ ไม่ว่าจะเป็นโทเคนชนิดไหน
      if (tj !== t && !ZERO_WIDTH_ONE.test(c)) break;
      j++;
    }
    out.push({ t, s: s.slice(start, j), i: start });
    i = j;
  }
  return out;
}

/**
 * จำนวนอักขระที่ยาวที่สุดของ `s` ที่กว้างไม่เกิน `maxPx` (ค้นแบบทวิภาค — วัด O(log n) ครั้ง)
 * ไม่ตัดคาอักขระซ้อนและไม่ตัดคา surrogate pair
 */
export function fitPrefix(s, maxPx, measure) {
  if (!s || maxPx <= 0) return 0;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(s.slice(0, mid)) <= maxPx) lo = mid; else hi = mid - 1;
  }
  let k = lo;
  // อย่าตัดคา surrogate pair
  if (k > 0 && k < s.length) {
    const c = s.charCodeAt(k - 1);
    if (c >= 0xD800 && c <= 0xDBFF) k--;
  }
  // ดึงอักขระซ้อนที่ตามหลังมาด้วย (กว้าง 0 จึงไม่ทำให้เกิน)
  while (k < s.length && ZERO_WIDTH_ONE.test(s[k])) k++;
  return k;
}

// ────────────────────────────────────────────────────────────────
// 3) ตัดบรรทัด — **ตัวเดียวที่ทั้งจอและ PDF ใช้**
// ────────────────────────────────────────────────────────────────

/**
 * **หัวใจของไฟล์** — คืน "ตำแหน่งที่ขึ้นบรรทัดใหม่" เป็นดัชนีอักขระในข้อความต้นฉบับ
 *
 * คืนตำแหน่งแทนที่จะคืนสตริง เพราะผู้เรียกต้องการคนละอย่าง:
 *   · นับบรรทัด        → `cuts.length + 1`
 *   · วาด PDF          → หั่นเป็นสตริง
 *   · ตัดบทพูดข้ามหน้า → ต้องได้ **ข้อความต้นฉบับ** กลับมาเป๊ะ ๆ ไม่ใช่สตริงที่ join ใหม่
 * เดิมสามงานนี้มีอัลกอริทึมคนละชุด (และไม่ตรงกันจริง) — ตอนนี้มีชุดเดียว
 *
 * @param {string} text     ข้อความ (มี \n ได้ = บังคับขึ้นบรรทัด)
 * @param {number} widthIn  ความกว้างที่ใช้ได้ (นิ้ว)
 * @param {object} o        { kind, cpi, heuristic, indentIn }
 * @returns {number[]} ดัชนีเริ่มต้นของบรรทัดที่ 2, 3, … (บรรทัดแรกเริ่มที่ 0 เสมอ)
 */
export function wrapCuts(text, widthIn, o = {}) {
  const s = String(text ?? '');
  // อาร์เรย์ที่คืนออกไปเป็นของแคช — ผู้เรียกอ่านอย่างเดียว ห้ามแก้
  const ck = `${_epoch}|${o.kind || 'sp'}|${widthIn}|${o.indentIn || 0}|${o.cpi || ''}`
           + `|${o.heuristic ? 1 : 0}|${s}`;
  const hit = _wrapCache.get(ck);
  if (hit) return hit;

  const limit = Math.max(0.05, +widthIn || 0.05) * DPI;
  const measure = (t) => measureWidth(t, o);
  const spaceW = measure(' ');
  const indent = Math.max(0, Math.min(limit - 1, (+o.indentIn || 0) * DPI));
  const cuts = [];
  let paraStart = 0;

  for (const para of s.split('\n')) {
    if (paraStart > 0) cuts.push(paraStart);          // ขึ้นย่อหน้าใหม่ = ขึ้นบรรทัดใหม่
    let lineW = 0, hasContent = false, pendSpace = false;
    // ย่อหน้าบรรทัดแรกกินที่ไปเท่าไร (มีเฉพาะบรรทัดแรกของทั้งข้อความ)
    const base = () => (cuts.length === 0 ? indent : 0);
    const cutAt = (i) => { cuts.push(i); lineW = 0; hasContent = false; pendSpace = false; };

    for (const tok of tokenize(para)) {
      const at = paraStart + tok.i;
      if (tok.t === TOK_SPACE) { if (hasContent) pendSpace = true; continue; }

      const sepW = (pendSpace && hasContent) ? spaceW : 0;
      const avail = limit - base() - lineW - sepW;
      const room = () => limit - base();

      if (tok.t === TOK_ATOM) {
        const w = measure(tok.s);
        if (w <= avail) { lineW += sepW + w; hasContent = true; pendSpace = false; continue; }
        // ยกทั้งคำไปบรรทัดใหม่ (ช่องว่างที่ค้างอยู่ถูกกลืนไปกับรอยตัด)
        if (hasContent) cutAt(at);
        let off = at, rest = tok.s;
        // คำเดียวยาวกว่าหนึ่งบรรทัด (URL/คำประสมยาว) — ตัดกลางคำ เหมือนที่ unipdf ทำ
        // ใช้ผลของ fitPrefix ตัดสินว่า "ลงบรรทัดเดียวพอไหม" แทนการวัดสตริงที่เหลือทั้งก้อนซ้ำ
        for (;;) {
          const k = fitPrefix(rest, room(), measure);
          if (k >= rest.length) break;
          const step = Math.max(1, k);
          off += step; rest = rest.slice(step);
          cutAt(off);
        }
        lineW = measure(rest); hasContent = !!rest;
        continue;
      }

      // TOK_RUN — ไทย/CJK ตัดตรงไหนก็ได้ จึง "เติมเต็มบรรทัดปัจจุบันก่อน แล้วไหลต่อ"
      let off = at, rest = tok.s;
      if (avail > 0) {
        const k = fitPrefix(rest, avail, measure);
        if (k > 0) {
          lineW += sepW + measure(rest.slice(0, k));
          hasContent = true; pendSpace = false;
          off += k; rest = rest.slice(k);
        }
      }
      if (!rest) continue;
      cutAt(off);
      for (;;) {
        const k = fitPrefix(rest, room(), measure);
        if (k >= rest.length) break;
        const step = Math.max(1, k);
        off += step; rest = rest.slice(step);
        cutAt(off);
      }
      lineW = measure(rest); hasContent = !!rest;
    }
    paraStart += para.length + 1;                     // +1 = อักขระ \n
  }
  if (_wrapCache.size >= WRAP_CACHE_CAP) _wrapCache = new Map();
  _wrapCache.set(ck, cuts);
  return cuts;
}

/**
 * ตัดข้อความเป็นบรรทัดจริง ๆ (ตัดหางช่องว่างของแต่ละบรรทัดทิ้ง เหมือนที่ตัววาดทำ)
 * @returns {string[]} อย่างน้อย 1 ใบเสมอ
 */
export function wrapLineStrings(text, widthIn, o = {}) {
  const s = String(text ?? '');
  const cuts = wrapCuts(s, widthIn, o);
  const bounds = [0, ...cuts, s.length];
  const out = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    out.push(s.slice(bounds[i], bounds[i + 1]).replace(/\s+$/, ''));
  }
  return out.length ? out : [''];
}

/**
 * จำนวนบรรทัดที่ข้อความกินจริง — **นับจากรอยตัดชุดเดียวกับที่ PDF และตัวตัดบทพูดใช้**
 */
export function wrapText(text, widthIn, o = {}) {
  if (!String(text ?? '').trim()) return 1;
  return wrapCuts(text, widthIn, o).length + 1;
}

// ────────────────────────────────────────────────────────────────
// 4) ทางเข้าแบบ "คอลัมน์" (ฝั่งนิยายยังคิดเป็นจำนวนตัวอักษรต่อบรรทัด)
// ────────────────────────────────────────────────────────────────

/**
 * นับบรรทัดจากกริดตัวอักษร — ใช้กับตัวประมาณของนิยาย ซึ่งเป็น **ทางสำรอง**
 * (ทางหลักของนิยายคือวัดกล่องบรรทัดจริงใน prose-measure.js อยู่แล้ว)
 * บังคับ heuristic เสมอ เพราะ "คอลัมน์" เป็นกริดสมมติ ไม่ใช่ความกว้างของฟอนต์จริง
 */
export function wrapVisual(text, cols, indentCols = 0) {
  const c = Math.max(1, Math.floor(cols));
  return wrapText(text, c / FALLBACK_CPI, {
    heuristic: true, cpi: FALLBACK_CPI,
    indentIn: Math.max(0, Math.min(c - 1, Math.round(indentCols) || 0)) / FALLBACK_CPI,
  });
}

/**
 * ตัดเอา `cols` คอลัมน์แรก (นับแบบมองเห็น) — คืน `[หัว, ที่เหลือ]`
 * ไม่ตัดกลางอักขระซ้อน: สระ/วรรณยุกต์ที่ตามหลังพยัญชนะตัวสุดท้ายถูกดึงไปกับหัวเสมอ
 */
export function takeVisual(text, cols) {
  const s = String(text ?? '');
  const c = Math.max(0, Math.floor(cols));
  if (c <= 0) return ['', s];
  let w = 0, i = 0;
  while (i < s.length) {
    if (!ZERO_WIDTH_ONE.test(s[i])) {
      if (w + 1 > c) break;
      w++;
    }
    i++;
  }
  while (i < s.length && ZERO_WIDTH_ONE.test(s[i])) i++;
  return [s.slice(0, i), s.slice(i)];
}
