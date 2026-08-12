// export-fdx.js — ส่งออกเป็น Final Draft (.fdx) ตามข้อ 67
// บริสุทธิ์ 100% : รับ blocks ([{el,text}] จาก parseScript) → คืนสตริง XML
// ทดสอบด้วย node ได้ (test/sp-export.test.cjs)

// ชนิดย่อหน้าใน FDX (Final Draft 8+ ใช้ชื่อพวกนี้)
import { T } from './i18n.js';
export const FDX_TYPE_MAP = {
  scene: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  'transition-in': 'Transition',      // [alpha.57a] FD มี Transition ชนิดเดียว — ต่างกันที่ระยะเยื้อง
  subheader: 'Shot',                  // mini-slug ใน FD ลงเป็น Shot
  intercut: 'Scene Heading',          // "INTERCUT WITH:" นับเป็นหัวฉากในสายการผลิต
  shot: 'Shot',
  'act-break': 'Act Break',
  // [alpha.60r3a] `---` บังคับขึ้นหน้าใหม่ — FD ไม่มีชนิดนี้ ลงเป็น Action ว่าง
  // (การ "ขึ้นหน้าใหม่" ถูกจัดการไปแล้วตอน paginate ก่อนส่งออก)
  'page-break': 'Action',
  // element ที่ Final Draft ไม่มีตรง ๆ → ลงเป็น Action เพื่อไม่ให้เนื้อหาหาย
  note: 'Action',
  summary: 'Action',
  outline1: 'Action',
  outline2: 'Action',
  outline3: 'Action',
  image: 'Action',
  raw: 'Action',
};
export const fdxType = (el) => FDX_TYPE_MAP[el] || 'Action';

// สำเนาเล็ก ๆ ของ num() — export-fdx ตั้งใจไม่ import อะไรเลย (โมดูลเดี่ยว ทดสอบง่าย)
const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

// อักขระควบคุมที่ XML 1.0 ไม่ยอมรับ (เคยหลุดมากับข้อความที่วางจากที่อื่น)
const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function escapeXml(s) {
  return String(s ?? '')
    .replace(XML_BAD, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** ตัดเครื่องหมายเน้นข้อความของ Markdown ออก — FDX เก็บสไตล์คนละแบบ */
export function plainText(s) {
  return String(s ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\u00A0/g, ' ');
}

const para = (type, text, indent = '    ', attrs = '') =>
  `${indent}<Paragraph Type="${escapeXml(type)}"${attrs}>\n` +
  `${indent}  <Text>${escapeXml(plainText(text))}</Text>\n` +
  `${indent}</Paragraph>`;

/**
 * สร้าง XML ของ Final Draft
 * @param {Array<{el:string,text:string}>} blocks
 * @param {{title?:string, author?:string, contact?:string, copyright?:string,
 *          basedOn?:string}} meta
 * @param {{titlePages?:Array, startScene?:number}} opts
 *        titlePages = หน้าปกที่ผู้ใช้แต่งเอง (ข้อ 90) — ชนะหน้าปกที่สร้างจาก meta
 */
export function generateFdx(blocks, meta = {}, opts = {}) {
  const list = (blocks || []).filter((b) => b && b.el !== 'blank' &&
                                            String(b.text ?? '').trim() !== '');
  // เลขฉาก: FD เก็บที่ attribute Number ของ Paragraph หัวฉาก
  // ใช้เลขที่บล็อกพกมาก่อน (b.sceneNo) ไม่มีจึงไล่นับเองจาก startScene
  let sceneNo = Math.max(1, Math.round(numOr(opts.startScene, 1)));
  const body = list.map((b) => {
    if (b.el !== 'scene') return para(fdxType(b.el), b.text);
    const n = b.sceneNo != null && String(b.sceneNo).trim() !== ''
      ? String(b.sceneNo).trim() : String(sceneNo++);
    return para(fdxType(b.el), b.text, '    ', ` Number="${escapeXml(n)}"`);
  }).join('\n');

  const title = [];
  const addTitle = (text, align = 'Center') => {
    if (!String(text ?? '').trim()) return;
    for (const line of String(text).split('\n')) {
      title.push(`      <Paragraph Alignment="${align}" Type="Action">\n` +
                 `        <Text>${escapeXml(plainText(line))}</Text>\n` +
                 `      </Paragraph>`);
    }
  };
  // หน้าปกที่ผู้ใช้แต่งเอง — เรียงตาม y แล้ว x (FDX ไม่มีพิกัดสัมบูรณ์ที่ FD ทุกรุ่นอ่านได้)
  const custom = Array.isArray(opts.titlePages) ? opts.titlePages : [];
  const hasCustom = custom.some((p) => (p && p.strings || []).some(
    (s) => String(s && s.text || '').trim() !== ''));
  if (hasCustom) {
    for (const p of custom) {
      const rows = ((p && p.strings) || [])
        .filter((s) => String(s.text ?? '').trim() !== '')
        .slice()
        .sort((a, b) => numOr(a.y, 0) - numOr(b.y, 0) || numOr(a.x, 0) - numOr(b.x, 0));
      for (const s of rows) {
        const al = s.align === 'right' ? 'Right' : s.align === 'left' ? 'Left' : 'Center';
        addTitle(s.text, al);
      }
    }
  } else {
    addTitle(meta.title);
    addTitle(meta.author ? T`เขียนโดย\n` + meta.author : '');
    addTitle(meta.basedOn);
    addTitle(meta.contact, 'Left');
    addTitle(meta.copyright, 'Left');
  }

  const titlePage = title.length
    ? `  <TitlePage>\n    <Content>\n${title.join('\n')}\n    </Content>\n  </TitlePage>\n`
    : '';

  return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
    '<FinalDraft DocumentType="Script" Template="No" Version="1">\n' +
    '  <Content>\n' + (body ? body + '\n' : '') + '  </Content>\n' +
    titlePage +
    '</FinalDraft>\n';
}
