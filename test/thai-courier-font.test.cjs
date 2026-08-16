// thai-courier-font.test.cjs — [alpha.78] กันเคส "`…` กลายเป็นวรรณยุกต์ ๊"
//
// CourierThaiMono/CourierThaiProp เป็นฟอนต์ไทยปี 1998 ที่ cmap เอาช่วง General Punctuation
// ไปชี้ทับด้วย **glyph วรรณยุกต์** (advance = 0 · bbox ลอยเหนือเส้นฐาน) → ผู้ใช้ที่เลือก
// ฟอนต์นี้เป็นฟอนต์หลักพิมพ์ `…` แล้วเห็นเป็น `๊`
//
// เทสนี้ทำสองอย่าง:
//   1) พิสูจน์จากไฟล์ฟอนต์จริงว่าปัญหามีอยู่ (ถ้าวันหนึ่งเปลี่ยนไฟล์ฟอนต์แล้วหายไป เทสจะบอก)
//   2) บังคับว่า style.css ต้องจำกัด `unicode-range` ไว้ที่ไทยเสมอ — ตัวป้องกันจริงอยู่ตรงนั้น
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'renderer', 'assets', 'fonts');

let n = 0, bad = 0;
const check = (name, cond, extra) => {
  n++;
  if (cond) console.log('PASS ' + name);
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
};

// ───────── ตัวอ่าน TTF เท่าที่ต้องใช้ (cmap format 4 + hmtx) ─────────
function openFont(file) {
  const b = fs.readFileSync(path.join(FONT_DIR, file));
  const numTables = b.readUInt16BE(4);
  const T = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    T[b.toString('ascii', o, o + 4)] = { off: b.readUInt32BE(o + 8), len: b.readUInt32BE(o + 12) };
  }
  // cmap: เลือก subtable ของ Windows (platform 3)
  const cm = T.cmap.off;
  let sub = 0;
  const nSub = b.readUInt16BE(cm + 2);
  for (let i = 0; i < nSub; i++) {
    const o = cm + 4 + i * 8;
    if (b.readUInt16BE(o) === 3 && [0, 1].includes(b.readUInt16BE(o + 2))) sub = cm + b.readUInt32BE(o + 4);
  }
  if (!sub || b.readUInt16BE(sub) !== 4) return null;
  const segX2 = b.readUInt16BE(sub + 6), seg = segX2 / 2;
  const endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  const gid = (cp) => {
    for (let i = 0; i < seg; i++) {
      if (cp > b.readUInt16BE(endO + i * 2)) continue;
      const st = b.readUInt16BE(startO + i * 2);
      if (cp < st) return 0;
      const delta = b.readInt16BE(deltaO + i * 2), ro = b.readUInt16BE(rangeO + i * 2);
      if (ro === 0) return (cp + delta) & 0xFFFF;
      const g = b.readUInt16BE(rangeO + i * 2 + ro + (cp - st) * 2);
      return g === 0 ? 0 : (g + delta) & 0xFFFF;
    }
    return 0;
  };
  const numH = b.readUInt16BE(T.hhea.off + 34);
  const advance = (g) => b.readUInt16BE(T.hmtx.off + Math.min(g, numH - 1) * 4);
  return { gid, advance };
}

// ───────── 1. ปัญหามีอยู่จริงในไฟล์ฟอนต์ ─────────
// เครื่องหมายสากลที่ถูกชี้ทับ — ถ้าอันไหน advance = 0 แปลว่ามันคือ glyph มาร์กลอย ไม่ใช่ตัวอักษร
const PUNCT = [['…', 0x2026], ['—', 0x2014], ['–', 0x2013], ['“', 0x201C], ['”', 0x201D]];
for (const file of ['CourierThaiMono.ttf', 'CourierThaiProp.ttf']) {
  const f = openFont(file);
  check(file + ': อ่าน cmap ได้', !!f);
  if (!f) continue;
  check(file + ': อักษรไทย ก มี glyph จริง (ฟอนต์ยังใช้กับไทยได้)', f.gid(0x0E01) > 0 && f.advance(f.gid(0x0E01)) > 0);
  const marks = PUNCT.filter(([, cp]) => f.gid(cp) > 0 && f.advance(f.gid(cp)) === 0).map(([c]) => c);
  check(file + ': เครื่องหมายสากลถูกชี้ทับด้วย glyph มาร์กกว้าง 0 (ต้นเหตุ)',
        marks.length > 0, 'ที่โดน: ' + marks.join(' '));
  // `…` กับ `๊` ต้องเป็นคนละ glyph แต่ "หน้าตาแบบเดียวกัน" (มาร์กกว้าง 0) — นี่คือที่มาของอาการ
  check(file + ': … มีความกว้าง 0 เท่ากับวรรณยุกต์ ๊',
        f.advance(f.gid(0x2026)) === 0 && f.advance(f.gid(0x0E4A)) === 0,
        `… =${f.advance(f.gid(0x2026))} · ๊ =${f.advance(f.gid(0x0E4A))}`);
}

// ───────── 2. style.css ต้องจำกัดช่วงไว้ที่ไทย (ตัวป้องกันจริง) ─────────
const css = fs.readFileSync(path.join(ROOT, 'renderer', 'style.css'), 'utf8');
for (const fam of ['Courier Thai Mono', 'Courier Thai Proportional']) {
  // ตัดเอาเฉพาะบล็อก @font-face ของวงศ์นั้น
  const block = (css.match(/@font-face\s*\{[^}]*\}/g) || [])
    .find((b) => b.includes(`font-family:"${fam}"`));
  check(`@font-face ของ "${fam}" มีอยู่`, !!block);
  if (!block) continue;
  const m = /unicode-range\s*:\s*([^;}]+)/i.exec(block);
  check(`"${fam}" จำกัด unicode-range ไว้ (ห้ามถอด — ไม่งั้น … กลายเป็น ๊)`, !!m, block.trim());
  if (!m) continue;
  const range = m[1].replace(/\s+/g, '').toUpperCase();
  check(`"${fam}" ครอบคลุมช่วงอักษรไทย U+0E00-0E7F`, range.includes('U+0E00-0E7F'), range);
  check(`"${fam}" ไม่กินช่วงเครื่องหมายสากล (ไม่มี U+2000 / ไม่ประกาศทั้งช่วง)`,
        !/U\+2[0-9A-F]{3}/.test(range) && !/U\+0-/.test(range) && !range.includes('U+??'), range);
}
// ลูกโซ่ต้องมีฟอนต์ละตินตามหลังเสมอ ไม่งั้นจำกัดช่วงแล้วไม่มีอะไรมารับช่วงต่อ
const dlg = fs.readFileSync(path.join(ROOT, 'src', 'dialogs.js'), 'utf8');
for (const fam of ['Courier Thai Mono', 'Courier Thai Proportional']) {
  const line = dlg.split('\n').find((l) => l.includes(`"${fam}"`) && l.includes('value:'));
  check(`ตัวเลือกฟอนต์ "${fam}" มี Courier Prime ตามหลังในลูกโซ่`,
        !!line && line.includes('Courier Prime'), line || '(ไม่พบตัวเลือก)');
}

console.log('\n--- RESULT ---');
console.log(`PASS ${n - bad}  FAIL ${bad}`);
if (bad) process.exit(1);
