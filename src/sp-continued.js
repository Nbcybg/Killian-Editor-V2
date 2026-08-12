// sp-continued.js — ระบบ "ต่อเนื่อง" ของบทภาพยนตร์ (ข้อ 55 + 56)
//
//   ฉากข้ามหน้า        → (CONTINUED)  ท้ายหน้าปัจจุบัน (ชิดขวา)
//   หน้าถัดไปฉากเดิม   → CONTINUED:   ต้นหน้า (ชิดซ้าย · ข้ามหลายหน้าได้ "CONTINUED: (2)")
//   บทพูดถูกตัดกลาง    → (MORE)       ท้ายหน้า (แนวชื่อตัวละคร)
//   บทพูดต่อหน้าใหม่   → ชื่อ + (cont'd) ต้นหน้าใหม่
//
// ไฟล์นี้บริสุทธิ์ 100% (ไม่แตะ DOM/kapi/state) — ทดสอบด้วย node ได้ (test/sp-continued.test.cjs)
// การจัดหน้าจริงทำที่ `paginate()` ใน sp-format.js อยู่แล้ว (มันแทรกบล็อก (MORE)/ชื่อ+(cont'd)
// และตั้ง page.continuedTop/continuedBottom ให้) — ไฟล์นี้แปลงผลนั้นเป็น
// "ตำแหน่งในเอกสาร + ข้อความ" เพื่อให้ ProseMirror วาดเป็น decoration ได้

import { T } from './i18n.js';
import { mergeSpFormat, paginate, CONTINUED_DEFAULTS } from './sp-format.js';

export { CONTINUED_DEFAULTS };

/** ชนิดของเครื่องหมาย เรียงตามลำดับที่ควรปรากฏรอบ ๆ เส้นคั่นหน้า */
export const CONTINUED_TYPES = ['more', 'continued-bottom', 'continued-top', 'contd'];

/** คลาส CSS ของแต่ละชนิด (ใช้ทั้ง decoration ในตัวแก้ไขและหน้ากระดาษที่วาดเอง) */
export const CONTINUED_CLASS = {
  more: 'sp-more',
  'continued-bottom': 'sp-continued-bottom',
  'continued-top': 'sp-continued-top',
  contd: 'sp-contd',
};

/**
 * ค่า `side` ของ widget decoration — ProseMirror เรียงจากน้อยไปมากที่ตำแหน่งเดียวกัน
 * เส้นคั่นหน้า (spPageBreakPlugin) ใช้ side = -1 → ของท้ายหน้าต้องน้อยกว่านั้น
 */
export const CONTINUED_SIDE = {
  more: -40, 'continued-bottom': -30, 'continued-top': 10, contd: 20,
};

/** ตำแหน่งในเอกสารของบล็อกแรกในหน้าที่ยัง "มีตัวตนจริง" (บล็อกสังเคราะห์ไม่มี pos) */
export function pageAnchor(page) {
  const b = (page && page.blocks || []).find((x) => x && Number.isFinite(x.pos));
  return b ? b.pos : null;
}

/** บล็อกสุดท้ายของหน้า (ใช้ดูว่าจบด้วย (MORE) ไหม) */
function lastBlock(page) {
  const list = (page && page.blocks) || [];
  return list.length ? list[list.length - 1] : null;
}

/**
 * รายการเครื่องหมายต่อเนื่องทั้งหมดของบท
 * @param {{pages:Array}|Array} pages ผลจาก paginate() (บล็อกควรมี pos จาก blocksFromDoc)
 * @param {object} fmt รูปแบบบท (sp-format)
 * @returns {Array<{pos:number,page:number,type:string,text:string,side:number,cls:string}>}
 */
export function computeContinueds(pages, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const CT = { ...CONTINUED_DEFAULTS, ...(f.continued || {}) };
  const list = (pages && pages.pages) || pages || [];
  const out = [];
  if (CT.enabled === false) return out;

  for (let i = 0; i < list.length - 1; i++) {
    const cur = list[i], next = list[i + 1];
    const pos = pageAnchor(next);
    if (!Number.isFinite(pos)) continue;
    const add = (type, text) => {
      if (!text) return;
      out.push({ pos, page: cur.index, type, text: String(text),
                 side: CONTINUED_SIDE[type], cls: CONTINUED_CLASS[type] });
    };
    if (CT.dialogue !== false) {
      const lb = lastBlock(cur);
      if (lb && lb.more) add('more', lb.text || f.strings.dialogueMore);
    }
    if (CT.scene !== false) {
      add('continued-bottom', cur.continuedBottom);
      add('continued-top', next.continuedTop);
    }
    if (CT.dialogue !== false) {
      const fb = (next.blocks || [])[0];
      if (fb && fb.contd) add('contd', fb.text || '');
    }
  }
  return out;
}

/** คำนวณตรงจาก blocks (สะดวกตอนเทส/ตอนส่งออก) */
export function continuedsFromBlocks(blocks, opts = {}) {
  const fmt = opts.fmt && opts.fmt.elements ? opts.fmt : mergeSpFormat(opts.fmt);
  return computeContinueds(paginate(blocks, { fmt, lines: opts.lines }), fmt);
}

/** สรุปจำนวนเครื่องหมายแต่ละชนิด (ใช้กับแถบสถานะ/เทส) */
export function continuedSummary(marks) {
  const out = { more: 0, contd: 0, 'continued-top': 0, 'continued-bottom': 0, total: 0 };
  for (const m of marks || []) {
    if (!(m.type in out)) continue;
    out[m.type]++; out.total++;
  }
  return out;
}

/** ข้อความบรรยายสำหรับแถบสถานะ */
export function continuedStatusText(marks) {
  const s = continuedSummary(marks);
  if (!s.total) return T`ต่อเนื่อง: ไม่มี`;
  return T`ต่อเนื่อง: ฉาก ${s['continued-top']} · บทพูด ${s.more}`;
}

/**
 * แทรกข้อความต่อเนื่องเข้าไปใน blocks ของแต่ละหน้า (ใช้ตอนส่งออกเป็น "ข้อความล้วน")
 * paginate() ใส่ (MORE)/ชื่อ+(cont'd) ให้แล้ว — ที่ขาดคือ CONTINUED: / (CONTINUED)
 * @returns {Array<{index:number,blocks:Array}>} หน้าที่บล็อกครบพร้อมพิมพ์
 */
export function pagesWithContinueds(pages, fmt) {
  const f = fmt && fmt.elements ? fmt : mergeSpFormat(fmt);
  const CT = { ...CONTINUED_DEFAULTS, ...(f.continued || {}) };
  const list = (pages && pages.pages) || pages || [];
  return list.map((pg) => {
    const blocks = [];
    if (CT.enabled !== false && CT.scene !== false && pg.continuedTop) {
      blocks.push({ el: 'continued-top', text: pg.continuedTop, lines: 1 });
    }
    for (const b of pg.blocks || []) blocks.push(b);
    if (CT.enabled !== false && CT.scene !== false && pg.continuedBottom) {
      blocks.push({ el: 'continued-bottom', text: pg.continuedBottom, lines: 1 });
    }
    return { ...pg, blocks };
  });
}

/** ข้อความบททั้งเรื่องแบบมีเครื่องหมายต่อเนื่อง (ใช้ตรวจสอบ/ส่งออกข้อความล้วน) */
export function continuedPlainText(pages, fmt) {
  return pagesWithContinueds(pages, fmt)
    .map((pg) => (pg.blocks || []).map((b) => b.text || '').join('\n'))
    .join('\n\n');
}
