// book-flow.js — [alpha.141] "สายหน้าของทั้งเล่ม" (ตรรกะล้วน ทดสอบด้วย node ได้)
//
// ═══ ทำไมต้องมีไฟล์นี้ ═══
// ผู้ใช้ขอสามอย่างที่ฟังดูเป็นคนละเรื่อง แต่จริง ๆ เป็นเรื่องเดียวกัน:
//   1. "อ่านทั้งเล่ม" — อ่านตั้งแต่หน้าปกจนหน้าสุดท้าย
//   2. "เลขหน้าไล่ต่อกัน" — ฉากที่ 2 ต้องขึ้นเลขต่อจากหน้าสุดท้ายของฉากที่ 1
//   3. "หน้าปกบทต้องถูกนับเป็นหน้าด้วย"
// ทั้งสามข้อต้องการของชิ้นเดียวกัน: **ลำดับของ "ส่วน" ทั้งเล่ม** (ปกเล่ม → ปกบท/หัวบท → ฉาก …)
// ถ้าปล่อยให้โหมดอ่านคิดลำดับของตัวเอง แล้วตัวไล่เลขหน้าคิดอีกแบบ = กฎข้อ 5 ของผู้ใช้พังทันที
// (สิ่งที่เห็นบนจอ · ในตัวอย่าง · ในไฟล์ ต้องมาจากแหล่งเดียวกัน)
//
// ไฟล์นี้จึงเป็น **แหล่งความจริงเดียวของลำดับ** · ส่วนที่ต้องวัดของจริงบนจอ (ความสูง/จำนวนหน้า)
// อยู่ที่ read-ui.js ซึ่งเรียก prose-measure.js ตัวเดียวกับมุมมองจัดหน้าและช่องตัวอย่างส่งออก

/** ค่าเริ่มต้นของ "หน้าปกบท" (เก็บใน draft.json → chapters[].cover) */
export const CHAPTER_COVER_DEFAULT = { on: false, image: '', text: '', full: true };

/**
 * อ่านค่าหน้าปกบทให้เป็นรูปเดียวเสมอ — โปรเจกต์เก่าไม่มีคีย์นี้เลย
 *
 * [alpha.142 ข้อ 1] `full` = "ใช้ภาพเต็มหน้า" — **ค่าเริ่มต้นคือเปิด** เพราะปกที่มีรูป
 * แล้วโชว์รูปเล็ก ๆ กลางหน้าไม่ใช่สิ่งที่ใครต้องการ (ผู้ใช้: "ถ้ามีรูป ควรขึ้นรูปเต็มหน้า")
 * ปิดได้เมื่ออยากได้ปกแบบ "รูปประกอบ + ชื่อบท"
 * @param {object} ch แถวบทจาก draft.json
 * @returns {{on:boolean, image:string, text:string, full:boolean}}
 */
export function normChapterCover(ch) {
  const c = (ch && ch.cover) || {};
  return {
    on: !!c.on,
    image: String(c.image == null ? '' : c.image),
    text: String(c.text == null ? '' : c.text),
    full: c.full === undefined ? true : !!c.full,
  };
}

/** ค่าหน้าปกเล่ม — `section.json` เก็บ `cover` (รูป) มาตั้งแต่ alpha.32 · `coverOn`/`coverFull` เพิ่งเพิ่ม */
export function normBookCover(meta) {
  const m = meta || {};
  return {
    on: m.coverOn === undefined ? true : !!m.coverOn,   // เล่มมีหน้าปกเสมอ เว้นแต่สั่งปิด
    image: String(m.cover == null ? '' : m.cover),
    text: String(m.blurb == null ? '' : m.blurb),
    full: m.coverFull === undefined ? true : !!m.coverFull,
  };
}

/**
 * [alpha.142 ข้อ 3] ขนาดรูปปกที่แนะนำ — คิดจาก **พื้นที่พิมพ์ของกระดาษที่เลือกอยู่จริง**
 *
 * ผู้ใช้: "เขียนแนะนำ hint ด้วย ทั้งขนาดรูปที่แนะนำ ratio ให้สอดคล้องกับกระดาษที่เลือก"
 *
 * [alpha.142r] ★ ปกที่ติ๊ก "ใช้ภาพเต็มหน้า" **ชนขอบกระดาษจริง** (ทาที่พื้นของแผ่น)
 * ขนาดที่แนะนำจึงเป็นขนาด **แผ่นกระดาษเต็มใบ** ไม่ใช่พื้นที่พิมพ์ — ถ้าบอกขนาดพื้นที่พิมพ์
 * ผู้ใช้จะเตรียมรูปเล็กกว่าที่ต้องใช้จริง แล้วโดนขยายจนแตก
 * (ปกที่ **ไม่** เต็มหน้าเป็นรูปประกอบในกรอบระยะขอบ ซึ่งเล็กกว่าเสมอ จึงใช้ค่านี้ได้ปลอดภัย)
 * @returns {{wIn:number,hIn:number,wPx:number,hPx:number,ratio:number,dpi:number}}
 */
export function coverImageHint(paper, margins, dpi = 300) {
  const p = paper || { width: 8.5, height: 11 };
  const wIn = Math.max(0.5, +p.width || 8.5);
  const hIn = Math.max(0.5, +p.height || 11);
  const d = Math.max(72, Math.round(+dpi || 300));
  return { wIn: +wIn.toFixed(3), hIn: +hIn.toFixed(3),
           wPx: Math.round(wIn * d), hPx: Math.round(hIn * d),
           ratio: +(wIn / hIn).toFixed(3), dpi: d };
}

/**
 * ลำดับ "ส่วน" ของหนึ่งเล่ม
 *
 * @param {object} book {title, author, meta, chapters:[{guid,title,cover,scenes:[…]}]}
 * @param {object} [opts] {covers:boolean} — false = ไม่เอาหน้าปกใด ๆ (ใช้ตอนเทียบกับไฟล์ที่ส่งออกแบบไม่มีปก)
 * @returns {Array<object>} [{kind,…}] · kind = bookCover | chapterCover | chapterHead | scene
 */
export function bookParts(book, opts = {}) {
  const b = book || {};
  const wantCovers = opts.covers !== false;
  const out = [];
  const bc = normBookCover(b.meta);
  if (wantCovers && bc.on) {
    out.push({ kind: 'bookCover', book: b.key || '', title: b.title || '',
               subtitle: b.author || '', image: bc.image, text: bc.text, full: bc.full });
  }
  for (const ch of b.chapters || []) {
    const cc = normChapterCover(ch);
    if (wantCovers && cc.on) {
      out.push({ kind: 'chapterCover', book: b.key || '', guid: ch.guid || '',
                 title: ch.title || '', subtitle: '', image: cc.image, text: cc.text, full: cc.full });
    } else {
      out.push({ kind: 'chapterHead', book: b.key || '', guid: ch.guid || '', title: ch.title || '' });
    }
    for (const sc of ch.scenes || []) {
      if (sc && sc.type === 'memo') continue;           // บันทึกช่วยจำไม่ใช่เนื้อเรื่อง
      out.push({ kind: 'scene', book: b.key || '', guid: ch.guid || '',
                 id: sc.id || '', file: sc.file || '', title: sc.title || '',
                 body: String(sc.body == null ? '' : sc.body) });
    }
  }
  return out;
}

/** ลำดับส่วนของหลายเล่มต่อกัน (โหมด "ทั้งโปรเจกต์") */
export function projectParts(books, opts = {}) {
  const out = [];
  for (const b of books || []) out.push(...bookParts(b, opts));
  return out;
}

/** ส่วนที่กินหนึ่งหน้าเต็มเสมอ (หน้าปกเล่ม/หน้าปกบท) — ตัวเดียวที่ทั้งตัววาดและตัวไล่เลขหน้าถาม */
export const isCoverPart = (p) => !!p && (p.kind === 'bookCover' || p.kind === 'chapterCover');
/** ส่วนที่บังคับขึ้นหน้าใหม่ (ปก + หัวบท) */
export const startsNewPage = (p) => !!p && p.kind !== 'scene';
/**
 * [alpha.142 ข้อ 2] ★ หน้าปก**เล่ม** = หน้าหน้าเล่ม — กินหนึ่งแผ่นจริง แต่ **ไม่นับเลขหน้า**
 *
 * ผู้ใช้: "ปกเล่มต้องไม่ถูกนับเป็นหน้า ดังนั้นถ้ามีปกบท หน้าที่ 1 จะนับจากปกบท ไม่ใช่ปกเล่ม
 * เช่นเดียวกัน ถ้าไม่มีปกบท จะนับหน้า 1 ที่ฉากเลย"
 * — ตรงกับธรรมเนียมหนังสือจริง: ปกไม่มีเลขหน้า เลข 1 เริ่มที่หน้าแรกของเนื้อเล่ม
 * **ปกบทยังนับเป็นหน้า** (คำสั่งเดิมจาก alpha.141) ที่ไม่นับมีแค่ปกเล่มเท่านั้น
 */
export const isFrontMatter = (p) => !!p && p.kind === 'bookCover';

/**
 * ไล่เลขหน้าของทุกส่วน — ใช้เมื่อ **ยังวัดของจริงไม่ได้** (เช่น unit test / ยังไม่มี DOM)
 *
 * คืนสองเลขต่อส่วน เพราะมันคนละเรื่องกัน:
 *   `page`      = แผ่นที่เท่าไรของเล่ม (นับปกด้วย — โหมดอ่านใช้เดินหน้า/ถอยหลัง)
 *   `startPage` = **เลขที่พิมพ์บนหน้ากระดาษ** (ปกเล่มได้ 0 = ไม่มีเลข)
 *
 * @param {Array<object>} parts
 * @param {(p:object)=>number} pageCountOf จำนวนหน้าของส่วนหนึ่ง (ฉาก) — ปกไม่ถาม
 * @param {number} [firstPage] เลขที่พิมพ์บนหน้าแรกของเนื้อเล่ม (ปกติ 1)
 */
export function assignStartPages(parts, pageCountOf, firstPage = 1) {
  let phys = 1;
  let printed = Math.max(1, Math.round(+firstPage || 1));
  return (parts || []).map((p) => {
    // ★ หัวบท "ขึ้นหน้าใหม่" แต่ **ไม่ได้กินทั้งหน้า** — ฉากแรกของบทอยู่หน้าเดียวกับหัวบท
    // (ปกสิ ที่กินเต็มแผ่น) · เดิมนับหัวบทเป็นหนึ่งหน้าเต็ม แล้วเลขหน้าของทั้งเล่มเลื่อนเกินไปหนึ่ง
    // ต่อบท — ทางที่วัดของจริงไม่เคยผิดข้อนี้ ผิดเฉพาะทางสำรองนี้
    const pages = isCoverPart(p) ? 1
      : p.kind === 'chapterHead' ? 0
      : Math.max(1, Math.round(+pageCountOf(p) || 1));
    const front = isFrontMatter(p);
    const row = { ...p, page: phys, pages, startPage: front ? 0 : printed };
    phys += pages;
    if (!front) printed += pages;
    return row;
  });
}

/**
 * เลขที่พิมพ์บนแผ่นที่ `phys` เมื่อรู้ว่าแผ่นไหนบ้างเป็นหน้าปกเล่ม
 * @param {number[]} coverPages แผ่นที่เป็นหน้าปกเล่ม (1-based)
 * @param {number} phys แผ่นที่เท่าไรของเล่ม (1-based)
 * @returns {number} 0 = แผ่นนี้ไม่มีเลขหน้า
 */
export function printedPageNumber(coverPages, phys) {
  const list = (coverPages || []).map((x) => Math.round(+x)).filter(Number.isFinite);
  const p = Math.max(1, Math.round(+phys || 1));
  if (list.includes(p)) return 0;
  let skipped = 0;
  for (const c of list) if (c <= p) skipped++;
  return Math.max(1, p - skipped);
}

/**
 * หน้าที่พิกัด Y ตกอยู่ (1-based) — ตัวแปลง "ผลวัดของจริง → เลขหน้า"
 * @param {Array<{start:number,end:number}>} pages ผลของ sliceProsePages()
 * @param {number} y
 */
export function pageIndexOfY(pages, y) {
  const list = Array.isArray(pages) ? pages : [];
  if (!list.length) return 1;
  const v = +y || 0;
  for (let i = list.length - 1; i >= 0; i--) if (v >= (+list[i].start || 0) - 0.5) return i + 1;
  return 1;
}

/**
 * ตาราง "ไฟล์ฉาก → เลขหน้าที่ฉากนั้นเริ่ม"
 * @param {Array<object>} parts ส่วนที่มี startPage แล้ว (จาก assignStartPages หรือจากผลวัดจริง)
 * @returns {Map<string, number>}
 */
export function startPageMap(parts) {
  const m = new Map();
  for (const p of parts || []) {
    if (p.kind !== 'scene' || !p.file) continue;
    if (!m.has(p.file)) m.set(p.file, Math.max(1, Math.round(+p.startPage || 1)));
  }
  return m;
}

/** แผ่นที่เป็นหน้าปกเล่ม (1-based) จากส่วนที่รู้เลขแผ่นแล้ว — ตัวป้อนของ printedPageNumber() */
export function coverPagesOf(parts) {
  return (parts || []).filter(isFrontMatter)
    .map((p) => Math.round(+p.page || 0)).filter((n) => n > 0);
}

/** ฉากนี้สั่ง "ไล่เลขหน้าต่อเนื่อง" ไหม (เก็บใน scenes.json → pageFlow) */
export const isPageFlowContinue = (row) => !!row && row.pageFlow === 'continue';
