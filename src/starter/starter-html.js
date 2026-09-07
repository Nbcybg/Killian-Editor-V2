// starter-html.js — ทำความสะอาด/แปลงที่อยู่รูปของ Story Description (โมดูลบริสุทธิ์)
//
// "Story Description" เก็บเป็น HTML เพราะช่องกรอกเป็นตัวแก้ไขแบบเห็นผลจริง
// ซึ่งเปิดปัญหาสองข้อที่ต้องแก้ตรงนี้ ไม่ใช่ที่ตัววาด:
//
//   1. **HTML จากการวางทับ (paste) พาของแปลกมาด้วย** — สคริปต์ · สไตล์ · ตัวจัดการอีเวนต์
//      ไฟล์งานของผู้ใช้แก้ด้วยมือนอกโปรแกรมได้ด้วย จึงต้องกรองตอน "อ่านเข้า" เสมอ ไม่ใช่ตอนพิมพ์
//
//   2. **รูปต้องพกพาข้ามโปรเจกต์ได้** (กติกาข้อ 9 ของฟีเจอร์นี้) — ตัวแก้ไขจะได้ที่อยู่เป็น
//      `file:///…/Starters/<slug>/images/x.png` ซึ่งถ้าเก็บลงไฟล์ตรง ๆ พอย้ายเครื่องรูปตายหมด
//      จึงเก็บลงไฟล์เป็น `images/x.png` เสมอ แล้วค่อยคลายเป็น file:// ตอนวาด
//
// ไม่แตะ DOM/fs → unit test ได้ตรง ๆ

/** แท็กที่ยอมให้มีในคำบรรยาย — นอกรายการนี้ถูกถอดเหลือแต่ข้อความข้างใน */
export const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'a', 'img', 'hr',
]);
/** แอตทริบิวต์ที่ยอมให้ติดมา (นอกจากนี้ถูกทิ้งทั้งหมด รวม on* ทุกตัว) */
export const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'style', 'align']);
/** เฉพาะ style ที่เกี่ยวกับการจัดหน้า/เน้นข้อความ — กัน style ที่ไปรื้อหน้าตาโปรแกรม */
const STYLE_OK = /^(text-align|font-weight|font-style|text-decoration|margin|padding|width|max-width)$/i;

/** ตัดสไตล์เหลือเฉพาะที่อนุญาต */
export function cleanStyle(v) {
  return String(v || '').split(';')
    .map((x) => x.trim()).filter(Boolean)
    .filter((x) => STYLE_OK.test(x.split(':')[0].trim()))
    .filter((x) => !/url\s*\(/i.test(x) && !/expression/i.test(x))
    .join('; ');
}

function attrsOf(raw) {
  const out = {};
  const re = /([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    out[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5] || '');
  }
  return out;
}

function safeUrl(v) {
  const s = String(v || '').trim();
  // อนุญาตเฉพาะที่ปลอดภัย — `javascript:` / `data:text/html` เป็นทางเปิดให้รันโค้ด
  if (/^(javascript|vbscript)\s*:/i.test(s)) return '';
  if (/^data:/i.test(s) && !/^data:image\//i.test(s)) return '';
  return s;
}

/**
 * กรอง HTML ให้เหลือเฉพาะที่ปลอดภัย
 * ใช้การสแกนแท็กแบบตรงไปตรงมา ไม่พึ่ง DOM — จึงเรียกได้ทั้งฝั่งเทสและตอนอ่านไฟล์
 */
export function sanitizeHtml(html) {
  let s = String(html == null ? '' : html);
  // ทิ้งทั้งก้อนสำหรับแท็กที่เนื้อในเป็นโค้ด (ถอดแค่แท็กไม่พอ — เนื้อในจะโผล่มาเป็นข้อความ)
  s = s.replace(/<(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  return s.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (all, slash, tagRaw, rest) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (slash) return '</' + tag + '>';
    const a = attrsOf(rest);
    const keep = [];
    for (const [k, v] of Object.entries(a)) {
      if (k.startsWith('on')) continue;                 // ตัวจัดการอีเวนต์ — ห้ามเด็ดขาด
      if (!ALLOWED_ATTRS.has(k)) continue;
      if (k === 'href' || k === 'src') {
        const u = safeUrl(v);
        if (!u) continue;
        keep.push(k + '="' + u.replace(/"/g, '&quot;') + '"');
        continue;
      }
      if (k === 'style') {
        const st = cleanStyle(v);
        if (st) keep.push('style="' + st.replace(/"/g, '&quot;') + '"');
        continue;
      }
      keep.push(k + '="' + String(v).replace(/"/g, '&quot;') + '"');
    }
    const selfClose = (tag === 'br' || tag === 'img' || tag === 'hr') ? ' /' : '';
    return '<' + tag + (keep.length ? ' ' + keep.join(' ') : '') + selfClose + '>';
  });
}

// ───────────────────────── ที่อยู่รูป: เก็บ ↔ แสดง ─────────────────────────

/** โฟลเดอร์รูปของ starter ในรูปแบบที่เก็บลงไฟล์ */
export const IMG_PREFIX = 'images/';

/**
 * HTML ที่จะ **เก็บลงไฟล์** — เปลี่ยน `file:///…/<slug>/images/x.png` เป็น `images/x.png`
 * นี่คือจุดที่ทำให้ย้ายโปรเจกต์แล้วรูปในคำบรรยายไม่ตาย
 */
export function htmlToStorage(html) {
  return String(html || '').replace(/src\s*=\s*"([^"]*)"/gi, (all, url) => {
    const m = /(^|\/)images\/([^/"?#]+)(?:[?#][^"]*)?$/i.exec(decodeURI(url));
    return m ? 'src="' + IMG_PREFIX + m[2] + '"' : all;
  });
}

/**
 * HTML ที่จะ **เอาไปวาด** — คลาย `images/x.png` กลับเป็นที่อยู่เต็ม
 * @param {string} html
 * @param {string} baseUrl  file URL ของโฟลเดอร์ starter (ลงท้ายด้วย / หรือไม่ก็ได้)
 */
export function htmlToDisplay(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) return String(html || '');
  return String(html || '').replace(/src\s*=\s*"([^"]*)"/gi, (all, url) => {
    if (!url.startsWith(IMG_PREFIX)) return all;
    return 'src="' + base + '/' + url.split('/').map(encodeURIComponent).join('/') + '"';
  });
}

/**
 * HTML → ข้อความล้วน — **ทุก prompt ต้องผ่านตัวนี้**
 *
 * โมเดลไม่ควรได้ HTML ดิบ: เปลืองโทเคนและทำให้มันตอบกลับมาเป็นแท็กด้วย
 * ข้อความล้วนของเดิม (ไฟล์ก่อนมีตัวแก้ไขแบบเห็นผลจริง) ผ่านไปเฉย ๆ ไม่โดนแตะ
 *
 * [alpha.123] ย้ายมาจาก `introText` ใน starter-model.js เพราะตอนนี้ **บทเปิดตอน**
 * ก็เก็บเป็น HTML แล้ว (ผู้ใช้ขอ b/i/u) — ตรรกะเดียวกันต้องอยู่ที่เดียว
 */
export function htmlToPlain(raw) {
  const s = String(raw == null ? '' : raw);
  if (!/<[a-z][\s\S]*>/i.test(s)) return s.trim();
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    // ย่อหน้าคั่นด้วยบรรทัดว่าง — โมเดลอ่านโครงเรื่องออกง่ายกว่าก้อนติดกัน
    .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<img[^>]*>/gi, '')          // รูปไม่มีความหมายในบริบทข้อความ
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** ชื่อไฟล์รูปทั้งหมดที่ถูกอ้างในคำบรรยาย (ไว้เก็บกวาด/ตรวจว่าไฟล์ยังอยู่) */
export function referencedImages(html) {
  const out = [];
  const re = /src\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    if (m[1].startsWith(IMG_PREFIX)) out.push(m[1].slice(IMG_PREFIX.length));
  }
  return [...new Set(out)];
}
