// markdown-code-toggle.js — ซ่อน "รหัสนำหน้าบรรทัด" ในตัวแก้ไขนิยาย (alpha.60r3 ข้อ 6)
//
// ปัญหา: ไฟล์เดียวกันเปิดได้ทั้งโหมดนิยายและโหมดบทหนัง (`switchFormat()`)
// พอเปิดบทภาพยนตร์ด้วยตัวแก้ไข **นิยาย** รหัส fountain ที่ปกติถูกพาร์สเป็น element
// (`.หัวฉาก` `@ชื่อ` `>CUT TO:` `$shot …`) จะโผล่มาเป็นข้อความดิบเต็มหน้า อ่านยากมาก
// รหัสมาร์กดาวน์ (`#` `##` `###` `=` `!`) ก็เช่นกันเมื่อไฟล์ถูกแก้จากภายนอก
//
// วิธีแก้: **ซ่อนเฉพาะตัวนำหน้า ไม่แตะเนื้อหา** ด้วย inline decoration `display:none`
//   → ไฟล์ .md ไม่เปลี่ยนแม้แต่ตัวอักษรเดียว · ปิดสวิตช์แล้วรหัสกลับมาครบ · undo/redo ไม่รู้เรื่องด้วยซ้ำ
//
// โมดูลนี้เก็บ "ตัวจับ prefix" เป็น pure function (`prefixLen`) จึงเทสได้โดยไม่ต้องมี ProseMirror
import { Plugin as PMPlugin, PluginKey as PMKey } from 'prosemirror-state';
import { Decoration as Deco, DecorationSet as DecoSet } from 'prosemirror-view';
// ตารางรหัสอยู่ที่ fountain.js ที่เดียว — ที่นี่แค่เอามาซ่อน (fountain.js เป็นโมดูลบริสุทธิ์ ไม่วน import)
import { SP_MD_PREFIXES } from './fountain.js';

export const MD_CODE_KEY = new PMKey('kmdcodes');
export const MD_HIDE_CLASS = 'k-md-hide-prefix';

/**
 * รหัสที่ซ่อน — **แหล่งเดียวคือ `SP_MD_PREFIXES` ใน fountain.js** (เรียงยาวก่อนสั้นมาแล้ว)
 *
 * [alpha.60r3a] เดิมรายการนี้ถูกเขียนซ้ำไว้ที่นี่ แล้วรวม `#`/`##`/`###` เข้าไปด้วย
 * ซึ่งผิด — มาตรฐานใหม่ให้ `###`/`####` เป็น **หัวข้อจริง H3/H4 ในโหมดนิยาย**
 * (md.js แปลงเป็นโหนด heading ไปแล้ว ไม่มีข้อความ `#` เหลือเป็นตัวอักษรให้ซ่อนอยู่ดี)
 * และ `---` กลายเป็นเส้นคั่น ซึ่งเป็นภาพแทน "ขึ้นหน้าใหม่" ที่ถูกต้องอยู่แล้ว
 */
export const MD_PREFIXES = SP_MD_PREFIXES;

/**
 * ความยาวของรหัสนำหน้าในข้อความหนึ่งบรรทัด (pure)
 *
 * กติกาที่ต้องระวัง — ไม่งั้นซ่อนผิดจนอ่านไม่รู้เรื่อง:
 *   · ต้องมี "เนื้อหา" ตามหลังเสมอ — บรรทัดที่มีแต่ `.` หรือ `#` คือข้อความจริงของผู้ใช้
 *   · `.` ห้ามซ่อนถ้าตามด้วยตัวเลข/จุด (`...` `1.5`) หรือช่องว่าง — นั่นคือประโยคปกติ
 *   · `!` ซ่อนเฉพาะกรณีไม่ใช่รูป `![alt](src)` (รูปต้องคงไว้ให้ md.js แสดงเป็นรูปจริง)
 *   · `((` ซ่อนหัวอย่างเดียว วงเล็บปิดท้ายบรรทัดจัดการแยกด้วย `suffixLen`
 * @param {string} text
 * @returns {number} 0 = ไม่มีรหัสให้ซ่อน
 */
export function prefixLen(text) {
  const s = String(text || '');
  if (!s) return 0;
  for (const p of MD_PREFIXES) {
    if (!s.startsWith(p)) continue;
    const rest = s.slice(p.length);
    if (!rest.trim()) return 0;                       // มีแต่รหัส ไม่มีเนื้อ → เป็นข้อความจริง
    if (p === '.') {
      // `.` ของ fountain ติดกับชื่อฉากเสมอ (`.INT. บ้าน`) — จุดของประโยคไม่เป็นแบบนี้
      if (/^[\s.\d]/.test(rest)) return 0;
      return 1;
    }
    if (p === '!') {
      if (/^\[[^\]\n]*\]\(/.test(rest)) return 0;     // ![alt](src) = รูปจริง ห้ามซ่อน
      return 1;                                       // `!ข้อความ` = บรรยายบังคับแบบ v1
    }
    // `@` / `>` เดี่ยว ๆ ต้องติดกับเนื้อหา — เว้นวรรคแปลว่าเป็นข้อความปกติ
    // (`>> ` / `<< ` ที่มีวรรคถูกจับไปแล้วข้างบน เพราะเรียงยาวก่อนสั้น)
    if ((p === '@' || p === '>') && /^\s/.test(rest)) return 0;
    return p.length;
  }
  return 0;
}

/** ความยาวของวงเล็บปิดท้ายโน้ต `((…))` (pure) — 0 = ไม่มี */
export function suffixLen(text) {
  const s = String(text || '');
  return (s.startsWith('((') && s.endsWith('))') && s.length > 4) ? 2 : 0;
}

// ───────── ปลั๊กอิน ─────────
let _on = true;             // ค่าเริ่มต้น = เปิด (ซ่อนรหัส) ตามสเปก

/** เปิด/ปิดการซ่อน — คืน true เมื่อค่าเปลี่ยนจริง (ผู้เรียกจึง dispatch เฉพาะตอนนั้น · บทเรียน 44) */
export function setMarkdownCodes(on) {
  const v = on !== false;
  if (v === _on) return false;
  _on = v;
  return true;
}
export function markdownCodesOn() { return _on; }

/** สแกนช่วง [from,to] คืน decoration ที่ซ่อนรหัส (ใช้กับ incrementalDecoState ของ editor.js ได้) */
export function scanMdCodes(doc, from, to) {
  if (!_on || !doc) return [];
  const out = [];
  doc.nodesBetween(from, to, (node, pos) => {
    // สนใจเฉพาะบล็อกข้อความระดับบน — ตัวแรกในบล็อกเท่านั้นที่เป็น "ต้นบรรทัด"
    if (!node.isTextblock) return;
    const first = node.firstChild;
    if (!first || !first.isText || !first.text) return;
    // [alpha.78] ต้องอ่านจาก `node.textContent` ไม่ใช่ `first.text`
    //
    // ProseMirror ตัด inline เป็นคนละ text node ทุกครั้งที่ "ชุด mark" เปลี่ยน — บรรทัด
    // `!**เด็กนั่งฟัง…**` จึงมีลูกสองตัว: `'!'` (ไม่มี mark) กับ `'เด็กนั่งฟัง…'` (ตัวหนา)
    // เดิมส่งแค่ `first.text` = `'!'` ล้วน ๆ → `prefixLen` เห็นว่า "มีแต่รหัส ไม่มีเนื้อ"
    // แล้วคืน 0 → **รหัสไม่ถูกซ่อนเลยทุกบรรทัดที่จัดรูปแบบตัวอักษรไว้**
    // (decoration แบบ inline คร่อมข้าม text node ได้อยู่แล้ว จึงใช้ความยาวจากข้อความรวมได้ตรง ๆ)
    const n = prefixLen(node.textContent);
    if (n > 0) {
      // pos = ตำแหน่งของบล็อก · +1 = เข้าไปข้างใน
      out.push(Deco.inline(pos + 1, pos + 1 + n, { class: MD_HIDE_CLASS }));
    }
    const last = node.lastChild;
    if (last && last.isText && last.text) {
      const m = suffixLen(node.textContent);
      if (m > 0) {
        const end = pos + 1 + node.content.size;
        out.push(Deco.inline(end - m, end, { class: MD_HIDE_CLASS }));
      }
    }
    return false;                      // ไม่ต้องลงลึกกว่าบล็อก
  });
  return out;
}

/**
 * ปลั๊กอินสำหรับใส่ใน `_mkState()` ของ KEditor
 * @param {(key, scan) => object} decoState  ตัวสร้าง state แบบสแกนเฉพาะบล็อกที่เปลี่ยน
 *   (editor.js ส่ง `incrementalDecoState` เข้ามา — decoration ตัวนี้คิดจาก "ข้อความในบล็อกเดียว"
 *    จึงใช้ทางลัดนั้นได้ตามเงื่อนไขของบทเรียน 52 · ไม่ส่งมา = สแกนทั้งเอกสารทุกครั้ง)
 */
export function markdownCodePlugin(decoState) {
  const full = (doc) => DecoSet.create(doc, scanMdCodes(doc, 0, doc.content.size));
  const state = decoState
    ? decoState(MD_CODE_KEY, scanMdCodes)
    : {
        init: (_c, st) => full(st.doc),
        apply(tr, prev, _o, st) {
          if (tr.getMeta(MD_CODE_KEY)) return full(st.doc);
          if (!tr.docChanged) return prev.map(tr.mapping, tr.doc);
          return full(st.doc);
        },
      };
  return new PMPlugin({
    key: MD_CODE_KEY, state,
    props: { decorations(s) { return MD_CODE_KEY.getState(s); } },
  });
}

/** สั่งวาดใหม่หลังสลับสวิตช์ */
export function refreshMarkdownCodes(view) {
  if (view) view.dispatch(view.state.tr.setMeta(MD_CODE_KEY, true));
}
