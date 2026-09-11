// Markdown ⇄ ProseMirror doc JSON — เข้ากับไฟล์ Killian v1 ทุกประการ
// กติกา (เหมือน richtext.py ใน v1):
//   **หนา**  *เอียง*  _ขีดเส้นใต้_  ~~ขีดฆ่า~~  ^ตัวยก^  ~ตัวห้อย~  # หัวข้อ  > คำพูดยกมา  - รายการ  1. รายการ
//   ![คำบรรยาย](path) ทั้งบรรทัด = รูป · เครื่องหมายจับคู่ไม่ได้ → คงเป็นตัวอักษร (ไม่มีข้อมูลหาย)
//   [alpha.132 ข้อ 9] สีตัวอักษร = `<span style="color:#rrggbb">…</span>` (HTML inline ตามมาตรฐาน
//   Markdown — v1 และตัวอ่านอื่นเห็นเป็นข้อความ ไม่มีข้อมูลหาย) · ค่าสีถูกกรองด้วย text-color.js

const { normColor, COLOR_SPAN_RE, colorSpanMd } = require('./text-color.js');   // ทั้งคู่เป็น CommonJS

const PATS = [
  [/\*\*\*([^*\n]+)\*\*\*/, ['strong', 'em']],
  [/(?<!\*)\*\*([^*\n]+)\*\*(?!\*)/, ['strong']],
  [/(?<![*\w])\*([^*\n]+)\*(?![*\w])/, ['em']],
  [/(?<![\w_])_([^_\n]+)_(?![\w_])/, ['underline']],
  [/~~([^~\n]+)~~/, ['strike']],
  // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย — เครื่องหมายเดียวกับ Pandoc (`x^2^` · `H~2~O`)
  // ตัวห้อยใช้ `~` เดี่ยว จึงต้องมี lookaround กันไปแย่งแมตช์ใน `~~ขีดฆ่า~~`
  [/\^([^^\n]+)\^/, ['sup']],
  [/(?<!~)~([^~\n]+)~(?!~)/, ['sub']],
];
// [alpha.83 ข้อ 1] `###` ล้วน ๆ (ไม่มีวรรค/ไม่มีข้อความ) ก็เป็นหัวข้อว่างตามมาตรฐาน CommonMark
// — ต้องจับให้ได้ ไม่งั้นกลายเป็น "ย่อหน้าที่มีข้อความ ###" ค้างอยู่ในไฟล์ตลอดไป
const RE_H = /^(#{1,6})(?: |$)/;
// [alpha.132r4] ★ **ข้อที่ว่างเปล่าก็ยังเป็นข้อ** — `- ` / `12. ` ที่ถูกตัดวรรคท้ายไปแล้ว
// เหลือ `-` / `12.` · กฎเดิมบังคับว่าต้องมีวรรคตาม จึงอ่านกลับเป็น "ย่อหน้าที่มีข้อความ 12."
// (ผู้ใช้: *"บรรทัดว่างโดนลบ ในกรณีที่ใช้ตัวเลขหรือ bullet แล้วกด enter ลงมา"*)
const RE_UL = /^[-*](?: |$)/;
const RE_OL = /^(\d+)\.(?: |$)/;
const RE_IMG = /^!\[([^\]\n]*)\]\(([^)\n]+)\)\s*$/;
// ══ [alpha.142 ข้อ 6] ★ ตัวเลือกของรูป — เก็บใน "ชื่อกำกับ" ของมาร์กดาวน์มาตรฐาน ══
//
// ผู้ใช้: *"ใน editor รูปจะปรับขนาดไม่ได้ … light novel มักจะใส่รูป หน้าแรก หรือแทรกลงไป
//          ดังนั้นเราต้อง click ขวาที่รูป สามารถปรับได้คือ fill รูปเลยเต็มหน้า ปรับ size ตามปกติ
//          ปรับเป็น % ปรับขอบมนได้ ของเดิมเป็นขอบมนเลย"*
//
// เก็บเป็น `![alt](src "fit=page w=60% r=8")` — ช่องนี้คือ **title ของมาร์กดาวน์มาตรฐาน**
// จึงไม่ทำให้ไฟล์เสียความเข้ากันได้: v1 และเครื่องมืออื่นอ่านเป็นรูปพร้อมชื่อกำกับตามปกติ
// (ทางเลือกที่ไม่เอา: คอมเมนต์ HTML แยกบรรทัด — ผูกกับรูปไม่ได้เมื่อมีรูปหลายใบติดกัน)
const RE_IMG_TITLE = /^([\s\S]*?)\s+"([^"]*)"$/;
/**
 * แยก `src "ชื่อกำกับ"` ออกจากกัน — ไฟล์ที่ชื่อมีวรรคยังใช้ได้ (ตัดเฉพาะท้ายที่อยู่ในเครื่องหมายคำพูด)
 * @returns {{src:string, title:string}}
 */
function splitImgTarget(raw) {
  const t = String(raw == null ? '' : raw).trim();
  const m = RE_IMG_TITLE.exec(t);
  return m ? { src: m[1].trim(), title: m[2] } : { src: t, title: '' };
}
/**
 * ชื่อกำกับ → ตัวเลือกของรูป
 * @returns {{fit:string, w:string, radius:string}} ค่าว่าง = ใช้ค่าเริ่มต้นของโปรแกรม
 */
function parseImgOpts(title) {
  const out = { fit: '', w: '', radius: '' };
  for (const tok of String(title || '').trim().split(/\s+/)) {
    const m = /^(fit|w|r)=(.+)$/i.exec(tok);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2];
    if (k === 'fit') { if (v === 'page') out.fit = 'page'; }
    else if (k === 'w') { const n = parseFloat(v); if (Number.isFinite(n) && n > 0 && n <= 100) out.w = String(+n.toFixed(2)); }
    else { const n = parseFloat(v); if (Number.isFinite(n) && n >= 0 && n <= 200) out.radius = String(Math.round(n)); }
  }
  return out;
}
/** ตัวเลือกของรูป → ชื่อกำกับ ('' = ไม่มีตัวเลือก จึงไม่ต้องเขียนอะไรลงไฟล์) */
function imgOptsToTitle(o) {
  const a = o || {};
  const parts = [];
  if (a.fit === 'page') parts.push('fit=page');
  if (a.w !== '' && a.w != null) parts.push('w=' + a.w + '%');
  if (a.radius !== '' && a.radius != null) parts.push('r=' + a.radius);
  return parts.join(' ');
}
/**
 * ★ คลาส/สไตล์ของรูป — **กฎคู่แฝดของจอกับไฟล์อยู่ที่นี่ที่เดียว** (กฎถาวรข้อ 5)
 * ตัวแก้ไข (`toDOM` ของโหนด figure) กับไฟล์ที่ส่งออก (`mdToHtmlBody`) เรียกสองตัวนี้ตัวเดียวกัน
 * → รูปที่ปรับขนาด/ขอบมนแล้ว หน้าตาตรงกันทั้งบนจอ · มุมมองจัดหน้า · ช่องตัวอย่าง · PDF
 */
function figureClass(o) {
  const a = o || {};
  const c = [];
  if (a.fit === 'page') c.push('k-img-page');
  if (a.w) c.push('k-img-w');
  return c.join(' ');
}
function figureImgStyle(o) {
  const a = o || {};
  const st = [];
  // เต็มหน้า = ปล่อยให้ CSS คุมทั้งหมด (ต้องรู้อัตราส่วนพื้นที่พิมพ์ ซึ่งเป็นค่าของ "หน้ากระดาษ")
  // [alpha.143 ข้อ 1] ★ **ห้ามใส่ `max-height:none` ตรงนี้** — สไตล์อินไลน์ชนะทุกกฎ CSS
  // แล้วเพดาน "ไม่สูงเกินหนึ่งหน้า" (`figure.k-img-w img`) จะไม่มีผลเลยสักที่
  // (รูปสูงเกินหน้า = บล็อกที่ตัดตามบรรทัดไม่ได้ → ตัดดิบ → เส้นคั่นหาย → หน้าเหลื่อมทั้งฉาก)
  if (a.fit !== 'page' && a.w) st.push('width:' + a.w + '%', 'height:auto');
  if (a.radius !== '' && a.radius != null) st.push('border-radius:' + a.radius + 'px');
  return st.join(';');
}

/** บรรทัดมาร์กดาวน์ของรูปหนึ่งใบ — ทางเดียวที่เขียนไวยากรณ์นี้ลงไฟล์ */
function imgLine(alt, src, opts) {
  const title = imgOptsToTitle(opts);
  return '![' + (alt || '') + '](' + (src || '') + (title ? ' "' + title + '"' : '') + ')';
}
// [alpha.58r บั๊ก 27] เส้นคั่น + บล็อกโค้ด (schema เดิมไม่มี node สองตัวนี้เลย)
const RE_HR = /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
// [alpha.61 ข้อ 3] ขึ้นหน้าใหม่ด้วยมือ (Ctrl+Enter) — เก็บเป็นคอมเมนต์มาร์กดาวน์
// แบบเดียวกับ <!--align:…--> : v1 และเครื่องมืออื่นเห็นเป็นคอมเมนต์เฉย ๆ ไม่พัง
const RE_PAGEBREAK = /^\s*<!--\s*pagebreak\s*-->\s*$/i;
const PAGEBREAK_MD = '<!--pagebreak-->';
// [alpha.61 ข้อ 3] ขึ้นบรรทัดในย่อหน้าเดิม (Shift+Enter) = hard break ตามมาตรฐาน CommonMark
// (แบ็กสแลชท้ายบรรทัด) — บรรทัดถัดไปยังเป็น "ย่อหน้าเดียวกัน" ไม่ใช่ย่อหน้าใหม่
const RE_HARDBREAK = /(^|[^\\])((?:\\\\)*)\\$/;
const endsWithHardBreak = (s) => RE_HARDBREAK.test(s);
const stripHardBreak = (s) => s.slice(0, -1);

// ---------- inline: md → [{text, marks:Set}] ----------
function parseInline(s, base = []) {
  const segs = [];
  while (s) {
    // [alpha.132 ข้อ 9] สแปนสีแข่งกับเครื่องหมายมาร์กดาวน์ตามปกติ — ตัวที่อยู่ซ้ายสุดชนะ
    // (ค่าสีที่กรองไม่ผ่านถือว่า "ไม่ใช่สแปนสี" แล้วปล่อยข้อความเดิมไว้ทั้งดุ้น ตามกฎไม่มีข้อมูลหาย)
    let best = null;
    const cm = COLOR_SPAN_RE.exec(s);
    if (cm && normColor(cm[1])) best = { m: cm, marks: null, color: normColor(cm[1]) };
    for (const [rx, marks] of PATS) {
      const m = rx.exec(s);
      if (m && (best === null || m.index < best.m.index)) best = { m, marks, color: null };
    }
    if (!best) { segs.push({ text: s, marks: base }); break; }
    const { m, marks, color } = best;
    if (m.index) segs.push({ text: s.slice(0, m.index), marks: base });
    const next = color
      ? [...base.filter((x) => typeof x === 'string' || x.type !== 'color'),
         { type: 'color', attrs: { color } }]
      : [...new Set([...base, ...marks])];
    segs.push(...parseInline(color ? m[2] : m[1], next));
    s = s.slice(m.index + m[0].length);
  }
  return segs;
}

// ══ [alpha.132r2] ★★ "ข้อความอย่างที่ผู้อ่านจะเห็น" — ถอดเครื่องหมายมาร์กดาวน์ออก ══
//
// ผู้ใช้: *"pdf ส่งออกเป็น code markdown"*
//
// ช่องตัวอย่าง PDF ของนิยายวาดจาก `mdToProseBlocks()` ซึ่งเก็บ **ข้อความ .md ดิบทั้งบรรทัด**
// → ผู้ใช้เห็น `**หนา**` `~~ฆ่า~~` `[[ชื่อ]]` `![ภาพ](path)` เป็นตัวหนังสือบนหน้ากระดาษ
// ทั้งที่ไฟล์จริงพิมพ์ออกมาเป็นตัวหนา/ชื่อ/รูป — ตัวอย่างกับไฟล์จึงหน้าตาคนละเรื่อง
//
// ตัวนี้เป็นของ md.js เพราะที่นี่คือ **เจ้าของไวยากรณ์** — และใช้ `parseInline()` ตัวจริง
// ไม่ใช่ regex ชุดที่สอง (ท่าเดิมที่เคยทำให้สองชุดค่อย ๆ แยกทางกัน)
//
// ★ สแปนสี **ยังอยู่** เพราะตัววาดของช่องตัวอย่างเปลี่ยนมันเป็นสีจริงต่อ (alpha.132r)

/** ถอดลิงก์เอนทิตี้ `[[ชื่อ|ที่แสดง]]` เหลือข้อความที่ผู้อ่านเห็น */
function stripMentions(s) {
  return String(s == null ? '' : s)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

/** ข้อความสำหรับแสดงผล — ไม่มีเครื่องหมายมาร์กดาวน์ แต่ **คงสแปนสีไว้** */
/**
 * [alpha.140] ข้อความล้วนของบรรทัดหนึ่ง — **ถอดเครื่องหมายมาร์กดาวน์ออกหมด**
 *
 * ใช้กับที่ที่ต้องได้ตัวอักษรเปล่า ๆ อย่างเดียว: รายการในแผงนำทาง (ซึ่งต้องเทียบกับ
 * `node.textContent` ที่ ProseMirror คืนมา — ถ้าฝั่งหนึ่งมี `**` อีกฝั่งไม่มี ก็จับคู่ไม่ติด
 * แล้วการกระโดดจากมุมมองทั้งเล่มก็ไปไม่ถูกที่)
 *
 * ต่างจาก `inlineDisplayText()` ตรงที่ตัวนั้นยังเก็บโค้ดสีไว้ (ช่องตัวอย่างต้องใช้)
 */
function inlinePlainText(text) {
  return stripMentions(parseInline(String(text == null ? '' : text))
    .map((seg) => seg.text).join(''))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');      // รูปในบรรทัด → เหลือแค่คำบรรยาย
}

function inlineDisplayText(text) {
  return stripMentions(parseInline(String(text == null ? '' : text))
    .map((seg) => {
      const c = (seg.marks || []).find((m) => m && typeof m === 'object' && m.type === 'color');
      return c ? colorSpanMd((c.attrs || {}).color, seg.text) : seg.text;
    })
    .join(''));
}

/**
 * == [alpha.132r3 ข้อ 3] ** จุดนำ/หมายเลขข้อ = **ตัวอักษร** ที่ปรับรูปแบบได้ ==
 *
 * ผู้ใช้: *"bullet และ ตัวเลข ต้องเป็นตัวอักษรด้วย ดังนั้นต้องปรับรูปแบบ สี และอื่น ๆ ได้
 *          ตอนนี้ปรับไม่ได้"*
 *
 * กติกาเดียวกับ Word/Google Docs: **marker ใช้รูปแบบของอักษรตัวแรกในข้อ**
 * ตัวนี้อ่าน "รัน (run) แรก" ของข้อความข้อหนึ่งแล้วคืนเป็นตัวแปร CSS ให้ `<li>` ถือไว้
 * (ตัวแก้ไขทำเรื่องเดียวกันด้วยมาร์กของ ProseMirror — เทส e2e ตรวจว่าสองฝั่งให้ผลตรงกัน)
 * @returns {string} เช่น `--k-mk-color:#b03030;--k-mk-weight:700` (ไม่มีอะไรเลย = '')
 */
function markerVars(text) {
  const seg = parseInline(String(text == null ? '' : text))[0];
  if (!seg) return '';
  const out = [];
  const has = (n) => (seg.marks || []).some((m) => (typeof m === 'string' ? m : m.type) === n);
  const col = (seg.marks || []).find((m) => m && typeof m === 'object' && m.type === 'color');
  const c = col ? normColor((col.attrs || {}).color) : '';
  if (c) out.push('--k-mk-color:' + c);
  if (has('strong')) out.push('--k-mk-weight:700');
  if (has('em')) out.push('--k-mk-style:italic');
  return out.join(';');
}

// ══ [alpha.133 · Y-2] ★★ "ตัวหนังสือหน้าตาเดียวกันทั้งสามที่" — ตัวแปลง inline ตัวเดียว ══
//
// ผู้ใช้: *"แบบอักษร … มีแค่ Editor อย่างเดียวที่ถูกต้อง"*
//
// ก่อนหน้านี้มีตัวแปลงมาร์กดาวน์ **สามตัวที่ไม่รู้จักกัน**:
//   1. `parseInline()` ที่นี่        → ตัวแก้ไข (ครบทุกเครื่องหมาย)
//   2. `inline()` ใน compile.js      → ไฟล์ที่ส่งออก (regex ชุดของตัวเอง — ขาด `_ขีดเส้นใต้_`,
//                                      `^ตัวยก^`, `~ตัวห้อย~`, hard break, `[[เอนทิตี้]]`
//                                      และตีความ `_x_` เป็น **เอียง** ทั้งที่บนจอเป็นขีดเส้นใต้)
//   3. `inlineDisplayText()` ที่นี่   → ช่องตัวอย่าง (ถอดเครื่องหมายทิ้งหมด = ไม่มีตัวหนาเลย)
// ตัวนี้ปิดช่องนั้น: **HTML ที่ได้ใช้แท็กชุดเดียวกับ `toDOM` ของสคีมาตัวแก้ไขเป๊ะ**
// (strong · em · u · s · sup · sub · span[style=color]) จึงหน้าตาเหมือนกันโดยโครงสร้าง
const HTML_ESC = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** ลำดับการห่อแท็ก — คงที่เสมอ เพื่อให้ผลลัพธ์เทียบได้ในเทส */
const MARK_TAGS = [['strong', 'strong'], ['em', 'em'], ['underline', 'u'],
                   ['strike', 's'], ['sup', 'sup'], ['sub', 'sub']];

/**
 * ข้อความมาร์กดาวน์หนึ่งบรรทัด → HTML ที่มีแท็กชุดเดียวกับตัวแก้ไข
 * @param {string} text
 * @param {{mono?:boolean}} [opts] mono = โหมดขาวดำ (ทิ้งสีแต่เก็บข้อความ)
 */
function inlineHtml(text, opts) {
  const mono = !!(opts && opts.mono);
  return parseInline(stripMentions(text))
    .map((seg) => {
      let s = HTML_ESC(seg.text)
        // รูปในบรรทัด (`![คำบรรยาย](path)`) — ทำหลัง escape เสมอ ไม่งั้น HTML ที่ผู้เขียน
        // พิมพ์เองหลุดเข้าไฟล์ได้ · แอตทริบิวต์ยัง escape อยู่จากขั้นบน
        .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (m, a, u) => `<img alt="${a}" src="${u}">`);
      if (!s) return '';
      const marks = seg.marks || [];
      const has = (n) => marks.some((m) => (typeof m === 'string' ? m : m.type) === n);
      for (const [name, tag] of MARK_TAGS) if (has(name)) s = `<${tag}>${s}</${tag}>`;
      const col = marks.find((m) => m && typeof m === 'object' && m.type === 'color');
      const hex = col ? normColor((col.attrs || {}).color) : '';
      return hex && !mono ? `<span style="color:${hex}">${s}</span>` : s;
    })
    .join('');
}

function inlineNodes(text) {
  return parseInline(text)
    .filter((x) => x.text)
    .map((x) => ({
      type: 'text', text: x.text,
      // มาร์กเป็นได้ทั้งชื่อเปล่า ๆ (ตัวหนา/เอียง/…) และก้อนที่มีแอตทริบิวต์ (สี)
      ...(x.marks.length
        ? { marks: x.marks.map((t) => (typeof t === 'string' ? { type: t } : t)) } : {}),
    }));
}

function para(text) {
  const content = inlineNodes(text);
  return { type: 'paragraph', ...(content.length ? { content } : {}) };
}

/**
 * [alpha.61 ข้อ 3] เนื้อในของย่อหน้าที่มี hard break — คืน inline nodes ที่คั่นด้วย hard_break
 * @param {string[]} rawLines บรรทัดดิบ (ทุกบรรทัดยกเว้นบรรทัดสุดท้ายลงท้ายด้วย `\`)
 */
function inlineNodesMulti(rawLines) {
  const out = [];
  rawLines.forEach((l, i) => {
    if (i) out.push({ type: 'hard_break' });
    out.push(...inlineNodes(i < rawLines.length - 1 ? stripHardBreak(l) : l));
  });
  return out;
}

// ---------- md → doc ----------
// การจัดหน้า (align) เก็บเป็นคอมเมนต์นำหน้าบล็อก <!--align:center--> (คงไฟล์เป็น markdown แท้
// เปิดร่วมกับ v1 ได้ — v1 จะเห็นเป็นข้อความคอมเมนต์เฉย ๆ ไม่พัง)
// [alpha.58r บั๊ก 25] ทางเลือกที่สะอาดกว่า: เก็บ align ไว้ใน frontmatter (`align: [3:center]`)
// แล้ว body เป็น markdown แท้ ๆ ไม่มีคอมเมนต์ปน — ยังอ่านรูปแบบเดิมได้เสมอ (ไฟล์เก่าไม่พัง)
const RE_ALIGN = /^<!--align:(left|center|right|justify)-->/;
const ALIGNS = ['left', 'center', 'right', 'justify'];

/** โหนดที่ "ถือ" ค่า align ได้จริง (บล็อกข้อความ) */
const alignable = (n) => !!n && (n.type === 'paragraph' || n.type === 'heading');
/**
 * ══ [alpha.103 ข้อ 2] ★ บล็อกที่ **ห่อ** บล็อกข้อความไว้ข้างใน ══
 * ผู้ใช้: *"เมื่อใช้หัวข้อหรือ bullet จะถูกจัดชิดซ้ายเสมอ และปรับเปลี่ยนไม่ได้"*
 * ครึ่งหนึ่งของต้นตออยู่ตรงนี้: แผนที่ align เดิมเก็บ **เฉพาะบล็อกระดับบนสุด** —
 * ย่อหน้าที่อยู่ใน `<li>` (และใน blockquote) จึงไม่เคยถูกบันทึกหรือโหลดกลับเลย
 * จัดกึ่งกลางได้ตอนนั้นจริง แต่พอเซฟ/เปิดใหม่ก็กลับเป็นชิดซ้ายหมด = "ปรับเปลี่ยนไม่ได้"
 * → คีย์กลายเป็น **ดอตพาธของดัชนีลูก** (`4.1.0` = ข้อที่ 2 ของรายการที่ 5)
 *   คีย์เก่าที่เป็นเลขตัวเดียว (`3`) ยังอ่านได้เหมือนเดิม เพราะมันคือพาธความยาว 1
 */
const ALIGN_CONTAINERS = new Set(['bullet_list', 'ordered_list', 'list_item', 'blockquote']);

/** แผนที่ align ของบล็อกข้อความทุกชั้น → { "3": "center", "4.1.0": "right" } */
function collectAlign(doc) {
  const out = {};
  const walk = (node, prefix) => {
    (node.content || []).forEach((n, i) => {
      const key = prefix ? prefix + '.' + i : String(i);
      const a = (n.attrs || {}).align;
      if (alignable(n)) { if (a && a !== 'left' && ALIGNS.includes(a)) out[key] = a; }
      else if (ALIGN_CONTAINERS.has(n.type)) walk(n, key);
    });
  };
  walk(doc, '');
  return out;
}
/** เรียงคีย์แบบพาธ (`4.1.0` มาหลัง `4` และก่อน `10`) — เรียงเป็นตัวเลขทีละชั้น */
function cmpAlignKey(a, b) {
  const x = String(a).split('.'), y = String(b).split('.');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (i < x.length ? +x[i] : -1) - (i < y.length ? +y[i] : -1);
    if (d) return d;
  }
  return 0;
}
/** "3:center, 4.1.0:right" ⇄ { "3": "center", "4.1.0": "right" } */
function alignToString(map) {
  return Object.keys(map || {}).sort(cmpAlignKey).map((k) => k + ':' + map[k]).join(', ');
}
function alignFromString(v) {
  const out = {};
  const list = Array.isArray(v) ? v : String(v || '').split(',');
  for (const part of list) {
    const m = /^\s*(\d+(?:\.\d+)*)\s*:\s*(left|center|right|justify)\s*$/.exec(String(part));
    if (m && m[2] !== 'left') out[m[1]] = m[2];
  }
  return out;
}
/** โหนดที่ปลายพาธ (`"4.1.0"`) ของเอกสาร JSON — null = ไม่มีจริง */
function nodeAtAlignPath(doc, key) {
  let n = doc;
  for (const part of String(key).split('.')) {
    const kids = n && n.content;
    if (!Array.isArray(kids)) return null;
    n = kids[+part];
    if (!n) return null;
  }
  return n;
}

/**
 * [alpha.132 · X-1] ถอดคอมเมนต์ `<!--align:x-->` ที่หัวบรรทัดออก
 * @returns {{align: (string|null), rest: string}}  (`left` ถือเป็น "ไม่มี align")
 */
function stripAlign(line) {
  const m = RE_ALIGN.exec(line);
  if (!m) return { align: null, rest: line };
  return { align: m[1] === 'left' ? null : m[1], rest: line.slice(m[0].length) };
}

// ══ [alpha.133 · Y-1] ★★ ตัวสแกนบล็อกตัวเดียวสำหรับ **ทุก** ผู้อ่านไฟล์ .md ══
//
// ผู้ใช้: *"การตัดหน้า / การจัดหน้า preview กับ export ไม่ตรงกับ editor"*
//
// ต้นตอครึ่งหนึ่งของเรื่องนี้คือ **สคีมาระดับบรรทัดถูกเขียนซ้ำสามรอบ**:
//   · `mdToDoc()` ที่นี่               — ตัวแก้ไข (รู้จักรั้วโค้ด · hard break · ขึ้นหน้าใหม่ · ลำดับเริ่มต้นของ ol)
//   · `mdToHtmlBody()` ใน compile.js  — ไฟล์ที่ส่งออก (ไม่รู้จักสี่อย่างข้างบนเลย)
//   · `mdToProseBlocks()` ใน prose-format.js — ช่องตัวอย่าง (ไม่รู้จักทั้งสี่อย่าง + ไม่รู้จัก align)
// ผลคือบรรทัดเดียวกันถูกอ่านเป็นคนละบล็อกในสามที่ แล้วไล่ตามกันไม่จบสักที
//
// ตัวนี้คือสคีมานั้นชุดเดียว — `mdToDoc` ใช้กติกาเดียวกันนี้ (regex ตัวเดียวกันทุกตัว)
// ส่วนอีกสองที่เรียกตัวนี้แล้วค่อยวาดตามชนิดที่ได้
//
// @param {string} md
// @param {{breakMarker?:string}} [opts] breakMarker = ข้อความคั่นหน้าของเวิร์กโฟลว์ส่งออก
//        (`<!-- ขึ้นหน้าใหม่ -->`) ซึ่งเป็นของ compile.js ไม่ใช่ไวยากรณ์ของไฟล์ .md
// @returns {Array<object>} บล็อก: kind = p|h|li|quote|hr|figure|code|pagebreak
function mdBlocks(md, opts) {
  const marker = String((opts && opts.breakMarker) || '').trim();
  const lines = String(md == null ? '' : md).split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const a0 = stripAlign(lines[i]);
    const align = a0.align;
    const line = a0.rest;
    let m;
    if ((m = RE_FENCE.exec(line))) {
      const fence = m[1], lang = m[2] || '';
      const body = [];
      i++;
      while (i < lines.length
             && !new RegExp('^\\s{0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(lines[i])) {
        body.push(lines[i]); i++;
      }
      if (i < lines.length) i++;                      // กินบรรทัดปิด
      out.push({ kind: 'code', align, lang, text: body.join('\n') });
      continue;
    }
    if (RE_PAGEBREAK.test(line) || (marker && line.trim() === marker)) {
      out.push({ kind: 'pagebreak', align: null, text: '' }); i++; continue;
    }
    if (RE_HR.test(line)) { out.push({ kind: 'hr', align, text: '' }); i++; continue; }
    if ((m = RE_IMG.exec(line))) {
      const tg = splitImgTarget(m[2]);
      out.push({ kind: 'figure', align, text: '', alt: m[1], src: tg.src,
                 imgOpts: parseImgOpts(tg.title) });
      i++; continue;
    }
    if ((m = RE_H.exec(line))) {
      const rest = line.slice(m[0].length);
      // หัวข้อที่ไม่มีข้อความ = บรรทัดว่าง (กติกาเดียวกับ mdToDoc — ห้ามโชว์ `###` ให้ผู้อ่าน)
      out.push(rest.trim()
        ? { kind: 'h', align, level: m[1].length, text: rest }
        : { kind: 'p', align, text: '', lines: [''] });
      i++; continue;
    }
    if (line.startsWith('> ')) {
      out.push({ kind: 'quote', align, text: line.slice(2) }); i++; continue;
    }
    if (RE_UL.test(line)) {
      out.push({ kind: 'li', align, ordered: false, text: line.replace(RE_UL, '') });
      i++; continue;
    }
    if ((m = RE_OL.exec(line))) {
      out.push({ kind: 'li', align, ordered: true, num: parseInt(m[1], 10),
                 text: line.replace(RE_OL, '') });
      i++; continue;
    }
    // [alpha.61 ข้อ 3] บรรทัดที่ลงท้ายด้วย `\` = hard break → ย่อหน้าเดียวกับบรรทัดถัดไป
    const raw = [line];
    while (endsWithHardBreak(raw[raw.length - 1]) && i + 1 < lines.length) {
      i++; raw.push(lines[i]);
    }
    out.push({ kind: 'p', align,
               lines: raw.map((l, k) => (k < raw.length - 1 ? stripHardBreak(l) : l)),
               text: raw.map((l, k) => (k < raw.length - 1 ? stripHardBreak(l) : l)).join('\n') });
    i++;
  }
  return out;
}

function mdToDoc(md, alignMap) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    const a0 = stripAlign(line);
    const align = a0.align;
    line = a0.rest;
    let m;
    if ((m = RE_FENCE.exec(line))) {
      const fence = m[1], lang = m[2] || '';
      const body = [];
      i++;
      while (i < lines.length && !new RegExp('^\\s{0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(lines[i])) {
        body.push(lines[i]); i++;
      }
      if (i < lines.length) i++;                        // กินบรรทัดปิด
      const txt = body.join('\n');
      out.push({ type: 'code_block', attrs: { lang, fence },
                 ...(txt ? { content: [{ type: 'text', text: txt }] } : {}) });
    } else if (RE_PAGEBREAK.test(line)) {
      out.push({ type: 'page_break' });               // [alpha.61 ข้อ 3] ขึ้นหน้าใหม่ด้วยมือ
      i++;
    } else if (RE_HR.test(line)) {
      out.push({ type: 'horizontal_rule' });
      i++;
    } else if ((m = RE_IMG.exec(line))) {
      const tg = splitImgTarget(m[2]);
      const o = parseImgOpts(tg.title);
      out.push({ type: 'figure', attrs: { src: tg.src, alt: m[1], md: line.trimEnd(),
                                          fit: o.fit, w: o.w, radius: o.radius } });
      i++;
    } else if ((m = RE_H.exec(line))) {
      const rest = line.slice(m[0].length);
      const content = rest.trim() ? inlineNodes(rest) : [];
      // หัวข้อที่ไม่มีข้อความ (รวมกรณีมีแต่วรรค) = บรรทัดว่าง — เขียนกลับเป็นบรรทัดว่างจริง ๆ
      out.push(content.length
        ? { type: 'heading', attrs: { level: m[1].length, align }, ...{ content } }
        : { type: 'paragraph', attrs: { align } });
      i++;
    } else if (line.startsWith('> ')) {
      // [alpha.132 · X-1] แต่ละย่อหน้าในบล็อกถือ align ของตัวเองได้ (คอมเมนต์นำหน้า `> `)
      const ps = [];
      for (;;) {
        const a = stripAlign(lines[i] === undefined ? '' : lines[i]);
        if (i >= lines.length || !a.rest.startsWith('> ')) break;
        const q = para(a.rest.slice(2));
        q.attrs = { ...(q.attrs || {}), align: a.align };
        ps.push(q);
        i++;
      }
      out.push({ type: 'blockquote', content: ps });
    } else if (RE_UL.test(line)) {
      const items = [];
      for (;;) {
        const a = stripAlign(lines[i] === undefined ? '' : lines[i]);
        if (i >= lines.length || !RE_UL.test(a.rest)) break;
        const q = para(a.rest.replace(RE_UL, ''));   // [alpha.132r4] ข้อว่างไม่มีวรรคตาม
        q.attrs = { ...(q.attrs || {}), align: a.align };
        items.push({ type: 'list_item', content: [q] });
        i++;
      }
      out.push({ type: 'bullet_list', content: items });
    } else if ((m = RE_OL.exec(line))) {
      const start = parseInt(m[1], 10);
      const items = [];
      for (;;) {
        const a = stripAlign(lines[i] === undefined ? '' : lines[i]);
        if (i >= lines.length || !RE_OL.test(a.rest)) break;
        const q = para(a.rest.replace(RE_OL, ''));
        q.attrs = { ...(q.attrs || {}), align: a.align };
        items.push({ type: 'list_item', content: [q] });
        i++;
      }
      out.push({ type: 'ordered_list', attrs: { order: start }, content: items });
    } else {
      // [alpha.61 ข้อ 3] บรรทัดที่ลงท้ายด้วย `\` = hard break → ย่อหน้าเดียวกับบรรทัดถัดไป
      const raw = [line];
      while (endsWithHardBreak(raw[raw.length - 1]) && i + 1 < lines.length) {
        i++; raw.push(lines[i]);
      }
      const content = raw.length > 1 ? inlineNodesMulti(raw) : inlineNodes(line);
      out.push({ type: 'paragraph', attrs: { align },
                 ...(content.length ? { content } : {}) });
      i++;
    }
  }
  const doc = { type: 'doc', content: out.length ? out : [{ type: 'paragraph' }] };
  // align จาก frontmatter (ถ้ามี) — ทับค่าที่ได้จากคอมเมนต์แบบเก่า
  const map = alignMap && typeof alignMap === 'object' && !Array.isArray(alignMap)
    ? alignMap : alignFromString(alignMap);
  for (const k of Object.keys(map || {})) {
    // [alpha.103 ข้อ 2] คีย์เป็นดอตพาธแล้ว — ย่อหน้าในรายการ/คำพูดยกมาจึงโหลดกลับได้ด้วย
    const n = nodeAtAlignPath(doc, k);
    if (alignable(n)) n.attrs = { ...(n.attrs || {}), align: map[k] };
  }
  return doc;
}

// ---------- inline: nodes → md (ซ้อนเครื่องหมายตามความยาวช่วงจริง เหมือน v1) ----------
const MARKSET = ['strong', 'em', 'underline', 'strike', 'sup', 'sub'];
/**
 * mark ที่มี "เครื่องหมายคู่" ของตัวเองตายตัว — ต่างจากตระกูลดาวที่ตัวหนา+เอียงรวมร่างเป็น `***`
 * [alpha.97 ข้อ 4] เพิ่ม sup/sub ที่ตารางนี้ที่เดียว แทนการเขียน if ทีละตัวกระจายทั่ว emitRuns
 */
const SIMPLE_MARKS = [['strike', '~~'], ['underline', '_'], ['sup', '^'], ['sub', '~']];
const simpleOf = (kind) => SIMPLE_MARKS.find(([, k]) => k === kind);
function starKind(sig) {
  if (sig.has('strong') && sig.has('em')) return '***';
  if (sig.has('strong')) return '**';
  if (sig.has('em')) return '*';
  return '';
}

function emitRuns(runs) {
  const extent = (kind, idx) => {
    let n = 0;
    for (let j = idx; j < runs.length; j++) {
      const sig = runs[j].sig;
      const simple = simpleOf(kind);
      if (simple) { if (!sig.has(simple[0])) break; }
      else if (starKind(sig) !== kind) break;
      n += runs[j].text.length;
    }
    return n;
  };
  let out = '';
  let stack = [];
  runs.forEach((run, idx) => {
    const ks = starKind(run.sig);
    const need = new Set();
    for (const [mk, sign] of SIMPLE_MARKS) if (run.sig.has(mk)) need.add(sign);
    if (ks) need.add(ks);
    const bad = stack.findIndex((mk) => !need.has(mk));
    const pool = new Set();
    if (bad !== -1) {
      for (let j = stack.length - 1; j >= bad; j--) {
        out += stack[j];
        if (need.has(stack[j])) pool.add(stack[j]);
      }
      stack = stack.slice(0, bad);
    }
    for (const mk of need) if (!stack.includes(mk)) pool.add(mk);
    for (const mk of [...pool].sort((a, b) => extent(b, idx) - extent(a, idx))) {
      out += mk; stack.push(mk);
    }
    out += run.text;
  });
  for (let j = stack.length - 1; j >= 0; j--) out += stack[j];
  return out;
}

/**
 * [alpha.132 ข้อ 9] เขียนชุด run หนึ่งบรรทัด โดยห่อ **ช่วงที่สีเดียวกันติดกัน** ด้วยสแปนสี
 * (สีอยู่นอกเครื่องหมายมาร์กดาวน์เสมอ — `<span …>**หนา**</span>` อ่านกลับได้ตรงทั้งสองชั้น)
 */
function emitColored(runs) {
  let out = '';
  for (let i = 0; i < runs.length;) {
    const c = runs[i].color;
    let j = i;
    while (j < runs.length && runs[j].color === c) j++;
    const chunk = emitRuns(runs.slice(i, j));
    out += c ? colorSpanMd(c, chunk) : chunk;
    i = j;
  }
  return out;
}

function inlineToMd(content) {
  // [alpha.61 ข้อ 3] hard_break ตัดชุด run — เขียนเป็น `\` ท้ายบรรทัด แล้วขึ้นบรรทัดใหม่
  // (เครื่องหมายรูปแบบต้องปิดก่อนขึ้นบรรทัด ไม่งั้น `**` คร่อมข้าม \n แล้ว parse กลับไม่ได้)
  const parts = [[]];
  for (const n of content || []) {
    if (n.type === 'hard_break') { parts.push([]); continue; }
    if (n.type !== 'text') continue;
    const marks = n.marks || [];
    const cmk = marks.find((m) => m.type === 'color');
    parts[parts.length - 1].push({
      text: n.text,
      color: cmk ? normColor((cmk.attrs || {}).color) : '',
      sig: new Set(marks.map((m) => m.type).filter((t) => MARKSET.includes(t))),
    });
  }
  return parts.map(emitColored).join('\\\n');
}

// ---------- doc → md ----------
/**
 * ══ [alpha.99 ข้อ 3] ★ ไฟล์ .md คือ "แหล่งความจริง" ของเลขบรรทัด ══
 *
 * ผู้ใช้: *"ใน markdown มี 642 ใน editor มี 638 · ทำไมไปคำนวณใหม่
 *          ทำไมไม่ใช้ markdown เป็น reference แทน"*
 *
 * บล็อกหนึ่งใบใน ProseMirror **ไม่ได้เท่ากับหนึ่งบรรทัดใน .md** เสมอไป:
 *   · รายการ 5 ข้อ           = 1 บล็อก แต่ 5 บรรทัด
 *   · คำพูดยกมา 2 ย่อหน้า     = 1 บล็อก แต่ 2 บรรทัด
 *   · ย่อหน้าที่มี Shift+Enter = 1 บล็อก แต่หลายบรรทัด
 *   · บล็อกโค้ด              = 1 บล็อก แต่ = เนื้อ + รั้ว 2 เส้น
 * รางเลขบรรทัดเดิมนับ "ลูกของ .ProseMirror" ตรง ๆ จึงหายไปทีละใบตามรูปแบบพวกนี้
 *
 * ตัวนี้คืนจำนวนบรรทัด .md ของบล็อกแต่ละใบ (เรียงตามลำดับในเอกสาร) โดยใช้
 * **ตัวเขียนไฟล์ตัวเดียวกับของจริง** — ตัวเลขจึงตรงกับไฟล์เสมอโดยไม่ต้องเดา
 * @returns {{lines: string[], counts: number[]}}
 */
function docToMdParts(doc, opts) {
  const lines = [];
  const counts = [];
  // opts.alignComments === false → ไม่เขียน <!--align:…--> ลงไฟล์ (เก็บใน frontmatter แทน)
  const useComments = !opts || opts.alignComments !== false;
  const alignPfx = (n) => { const a = (n.attrs || {}).align;
                            return useComments && a && a !== 'left' ? `<!--align:${a}-->` : ''; };
  const textOf = (n) => (n.content || []).filter((x) => x.type === 'text')
                          .map((x) => x.text).join('');
  for (const node of doc.content || []) {
    const before = lines.length;
    switch (node.type) {
      case 'horizontal_rule':
        lines.push('---');
        break;
      case 'page_break':                       // [alpha.61 ข้อ 3] ขึ้นหน้าใหม่ด้วยมือ (Ctrl+Enter)
        lines.push(PAGEBREAK_MD);
        break;
      case 'code_block': {
        const a = node.attrs || {};
        const fence = a.fence && /^(`{3,}|~{3,})$/.test(a.fence) ? a.fence : '```';
        lines.push(fence + (a.lang || ''));
        for (const l of textOf(node).split('\n')) lines.push(l);
        lines.push(fence);
        break;
      }
      case 'figure': {
        const a = node.attrs || {};
        // [alpha.142 ข้อ 6] มีตัวเลือกของรูป = **ต้องประกอบบรรทัดใหม่** ห้ามคืน `a.md` ดิบ ๆ
        // (ไม่งั้นปรับขนาด/ขอบมนแล้วไฟล์ไม่เปลี่ยน — ค่าที่ตั้งหายทันทีที่ปิดแท็บ)
        const o = { fit: a.fit || '', w: a.w || '', radius: a.radius === '' ? '' : a.radius };
        const title = imgOptsToTitle(o);
        lines.push(title || !a.md ? imgLine(a.alt, a.src, o) : a.md);
        break;
      }
      case 'heading': {
        // [alpha.83 ข้อ 1] หัวข้อที่ไม่มีข้อความ = บรรทัดว่าง **ห้ามเขียน `### ` เปล่า ๆ ลงไฟล์**
        // เดิมเขียน `'### ' + ''` ออกมาเป็น `"### "` (มีวรรคท้าย) ซึ่งดูเหมือนบรรทัดว่างในตัวแก้ไข
        // แต่ทุกตัวที่อ่านไฟล์กลับจะ `replace(/\s+$/,'')` ก่อน แล้วกฎหัวข้อ `#{1,6}\s+` ไม่แมตช์
        // → กลายเป็น **ย่อหน้าที่มีข้อความ `###`** ทั้งใน PDF และ HTML (ดู mdToProseBlocks/mdToHtmlBody)
        const ht = inlineToMd(node.content);
        lines.push(ht.trim() ? alignPfx(node) + '#'.repeat((node.attrs || {}).level || 1) + ' ' + ht : '');
        break;
      }
      // [alpha.132 · X-1] คอมเมนต์ align นำหน้า **ทั้งบรรทัด** (ก่อน `> ` / `- ` / `1. `)
      // เพราะ `mdToDoc` ถอดคอมเมนต์ที่หัวบรรทัดก่อนจะดูว่าเป็นบล็อกชนิดไหน
      case 'blockquote':
        for (const p of node.content || []) lines.push(alignPfx(p) + '> ' + inlineToMd(p.content));
        break;
      case 'bullet_list':
        for (const it of node.content || []) {
          const q = (it.content || [])[0] || {};
          lines.push(alignPfx(q) + '- ' + inlineToMd(q.content));
        }
        break;
      case 'ordered_list': {
        let n = (node.attrs || {}).order || 1;
        for (const it of node.content || []) {
          const q = (it.content || [])[0] || {};
          lines.push(alignPfx(q) + `${n++}. ` + inlineToMd(q.content));
        }
        break;
      }
      default:
        lines.push(alignPfx(node) + inlineToMd(node.content));
    }
    // ข้อความที่ push ไปอาจมี \n อยู่ข้างในเอง (hard break) → นับตามของจริงเสมอ
    counts.push(lines.slice(before).join('\n').split('\n').length);
  }
  return { lines, counts };
}

function docToMd(doc, opts) { return docToMdParts(doc, opts).lines.join('\n'); }

/** จำนวนบรรทัดใน .md ของบล็อกระดับบนแต่ละใบ (ดูคอมเมนต์ของ docToMdParts) */
function mdLineCounts(doc, opts) { return docToMdParts(doc, opts).counts; }

// ---------- frontmatter (โครงเดียวกับ v1: --- k: v --- ) ----------
// บล็อกคอมเมนต์ท้ายไฟล์ (comment-core.js) — ต้องตัดออกทุกทางเข้า ไม่งั้นโผล่ในตัวแก้ไข/ส่งออก/นับคำ
// (regex ตัวเดียวกับ BLOCK_RE ใน comments/comment-core.js — md.js เป็น CommonJS จึงไม่ import ข้ามมา)
const K2_COMMENTS_RE = /\n*<!--\s*k2-comments\s*([\s\S]*?)-->\s*$/;

function parseMdFile(text) {
  let meta = {}, body = String(text || '').replace(K2_COMMENTS_RE, '');
  text = body;
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) {
      // [alpha.148] \r\n (ไฟล์ที่แก้บน Windows) — `.` ใน regex ข้างล่างไม่กิน \r → เมทาดาทาหายทั้งหัวไฟล์
      for (const line of text.slice(3, end).replace(/\r/g, '').split('\n')) {
        const m = /^(\w[\w-]*):\s*(.*)$/.exec(line);
        if (!m) continue;
        const v = m[2].trim();
        meta[m[1]] = v.startsWith('[') && v.endsWith(']')
          ? v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean) : v;
      }
      // [alpha.148] ตัดแค่ "ตัวคั่น" หลังเส้น --- หนึ่งบรรทัด + บรรทัดว่างตามธรรมเนียมอีกหนึ่ง
      // เดิม /^\n+/ กินบรรทัดว่างหัวฉากที่ผู้ใช้เว้นไว้ทิ้งหมดทุกครั้งที่เปิดไฟล์ (และไม่รู้จัก \r\n)
      // ไฟล์ทั่วไป (`---\nbody` ของเรา · `---\n\nbody` ที่เขียนมือ/v1) ได้ body เหมือนเดิมทุกไบต์
      body = text.slice(end + 4).replace(/^\r?\n/, '').replace(/^\r?\n/, '');
    }
  }
  return { meta, body };
}

function dumpMdFile(meta, body) {
  const out = ['---'];
  for (const [k, v] of Object.entries(meta))
    out.push(Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${v}`);
  out.push('---\n');
  // [alpha.148] เนื้อที่ขึ้นต้นด้วยบรรทัดว่าง → คั่นด้วยบรรทัดว่างตามธรรมเนียมหนึ่งบรรทัดก่อน
  // parseMdFile ตัดบรรทัดนั้นทิ้ง แล้วได้บรรทัดว่างของผู้ใช้กลับมาครบ (เนื้อปกติไม่เปลี่ยนแม้แต่ไบต์เดียว)
  return out.join('\n') + (/^\r?\n/.test(body) ? '\n' : '') + body;
}

function countWords(body) {
  const t = body.replace(/[#>*_~\-!\[\]()]/g, ' ');
  let n = 0;
  for (const chunk of t.split(/\s+/)) {
    if (!chunk) continue;
    n += /[\u0E00-\u0E7F]/.test(chunk) ? Math.max(1, Math.round(chunk.length / 5)) : 1;
  }
  return n;
}

module.exports = { mdToDoc, docToMd, mdLineCounts, parseMdFile, dumpMdFile, countWords,
                   collectAlign, alignToString, alignFromString,
                   // [alpha.132 · X-1] ตัวแปลง md → HTML ต้องรู้จักคอมเมนต์ align ตัวเดียวกันนี้
                   RE_ALIGN, stripAlign,
                   // [alpha.132r2] ข้อความสำหรับแสดงผล (ช่องตัวอย่าง PDF) + ตัวถอดลิงก์เอนทิตี้
                   RE_IMG, inlineDisplayText, inlinePlainText, stripMentions,
                   // [alpha.142 ข้อ 6] ตัวเลือกของรูป (เต็มหน้า/ความกว้าง %/ขอบมน) — ไวยากรณ์อยู่ที่นี่ที่เดียว
                   splitImgTarget, parseImgOpts, imgOptsToTitle, imgLine,
                   figureClass, figureImgStyle,
                   // [alpha.133 · Y-1+Y-2] สคีมาบล็อก + ตัวแปลง inline ตัวเดียวของทั้งโปรแกรม
                   // (ตัวแก้ไข · ไฟล์ที่ส่งออก · ช่องตัวอย่าง อ่านจากสองตัวนี้เท่านั้น)
                   mdBlocks, inlineHtml,
                   // [alpha.132r3 ข้อ 3] รูปแบบของจุดนำ/หมายเลขข้อ (มาจากอักษรตัวแรกของข้อ)
                   markerVars };
