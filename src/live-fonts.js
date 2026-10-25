// live-fonts.js — [alpha.160 · P1-7/P1-8] สแตกฟอนต์ของ "นิยาย" ที่ใช้อยู่จริงบนจอ (ตัวกลางตัวเดียว)
//
// ผู้ใช้: ส่งออก/อ่านทั้งเล่ม ต้องได้ฟอนต์เดียวกับที่เห็นในตัวแก้ไข (กฎถาวรข้อ 5 — แหล่งเดียวกัน)
//
// ★ ต้นตอ P1-7: ตัวเดิมใน export-hub เลือกด้วย `.pane.on > .workspace > .ProseMirror` ซึ่ง **โดนบทภาพยนตร์ด้วย**
//   (แท็บบทก็เป็น ProseMirror ใน .pane) + ตกไปหยิบ `.ProseMirror` ตัวแรกของหน้า → ส่งออกนิยายได้ฟอนต์ Courier ของบท
// ★ ต้นตอ P1-8: "อ่านทั้งเล่ม" วัดหน้าด้วย `proseExportCss()` โดยไม่ส่งสแตกเลย → ตกไปฟอนต์ตาม proseFormat
//   ซึ่งไม่ใช่ `--ed-font` ที่จอใช้ (`withLangFamily(settings.fontFamily…)`) = เลขหน้าไล่ต่อเนื่องเพี้ยน
//
// ลำดับ: ตัวแก้ไข **นิยาย** ที่เปิดอยู่ (ค่าที่คำนวณแล้วของ DOM) → ตัวแปร `--ed-font` ของเอกสาร
// (ตัวเดียวกับที่ตัวแก้ไขนิยายจะใช้ทันทีที่เปิด) → {} (ผู้เรียกตกไปค่าเดิม) · **ไม่หยิบ ProseMirror ตัวไหนก็ได้อีกแล้ว**

export const PROSE_EDITOR_SEL = '.pane.on:not(.sp-pane):not(.wiki-pane) > .workspace > .ProseMirror';

/** @returns {{fontStack?:string, headingStack?:string}} */
export function liveProseFonts(doc = globalThis.document) {
  try {
    if (!doc) return {};
    const cs = (n) => (doc.defaultView || globalThis).getComputedStyle(n);
    const ed = doc.querySelector(PROSE_EDITOR_SEL);
    if (ed) {
      const body = cs(ed).fontFamily || '';
      const h = ed.querySelector('h1,h2,h3,h4,h5,h6');
      return { fontStack: body, headingStack: h ? cs(h).fontFamily || '' : '' };
    }
    const v = String(cs(doc.documentElement).getPropertyValue('--ed-font') || '').trim();
    return v ? { fontStack: v, headingStack: '' } : {};
  } catch { return {}; }
}

/**
 * [alpha.160 · P1-10] ฟอนต์ตัวแรกของสแตกที่ "โปรแกรมอื่นรู้จัก" — ข้ามวงศ์สังเคราะห์ของ K2
 * (`K2 Lang`/`K2 SP`/`K2 …` = วงศ์ที่ `@font-face` ประกอบขึ้นบนจอเท่านั้น · Word ไม่มี แล้วแทนฟอนต์เอง)
 * @returns {string} '' = ไม่มีตัวที่ใช้ได้
 */
/**
 * [trial 2026-10-25 ข้อ 20] ฟอนต์สำหรับ "อักษรไทย" ในไฟล์ Word (`w:rFonts w:cs`) — Word จัดอักษรไทยเป็น
 * complex script แล้วใช้ฟอนต์ช่อง cs · เดิมใส่ฟอนต์ตัวแรกของสแตก (Garamond ฯลฯ ไม่มีกลีฟไทย) ทุกช่อง
 * = ไทยไปขึ้นกับฟอนต์สำรองของ Word แต่ละเครื่อง · เลือกตัวที่มีไทยจริงตัวแรกในสแตก ไม่มี = Tahoma (มีทั้ง Windows/macOS)
 */
const THAI_FAMILIES = /^(Leelawadee( UI)?|Thonburi|TH Sarabun( New| PSK)?|Sarabun|Noto (Sans|Serif) Thai( Looped)?|Tahoma|Cordia(New|UPC| New)|Angsana( New|UPC)|Browallia( New|UPC)|Ayuthaya|Sathu|Silom|Krungthep|Sukhumvit Set|Kanit|Prompt|Mitr|Pridi|Taviraj|Trirong|Chakra Petch|Bai Jamjuree|K2D|Niramit|Charm|Chonburi|IBM Plex Sans Thai( Looped)?|Anuphan|Krub|Mali|Itim|Athiti|Maitree|Pattaya|Sriracha|Thasadith|Kodchasan|KoHo|Fahkwang|Srisakdi|Charmonman|Chakra|Garuda|Loma|Norasi|Kinnari|Umpush|Waree|Purisa|Sawasdee|Tlwg[\w ]*)$/i;
export function thaiFontOf(stack) {
  for (const raw of String(stack || '').split(',')) {
    const f = raw.replace(/["']/g, '').trim();
    // ตาข่ายไทยของโปรแกรม (`--thai-net` ขึ้นต้นด้วย Thonburi) เป็นของ "เครื่องนี้" — Thonburi มีแต่ macOS ·
    // Leelawadee มีแต่ Windows · ไฟล์ Word ถูกเปิดที่เครื่องอื่น → ถึงตาข่ายแล้วยังไม่เจอตัวที่ผู้ใช้เลือก = Tahoma
    if (/^Thonburi$/i.test(f)) break;
    if (f && THAI_FAMILIES.test(f)) return f;
  }
  return 'Tahoma';
}

export function firstRealFont(stack) {
  for (const raw of String(stack || '').split(',')) {
    const f = raw.replace(/["']/g, '').trim();
    if (!f) continue;
    if (/^K2(\s|$)/i.test(f)) continue;                        // วงศ์สังเคราะห์ของโปรแกรม
    if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+)$/i.test(f)) continue;   // ตระกูลทั่วไปของ CSS
    return f;
  }
  return '';
}
