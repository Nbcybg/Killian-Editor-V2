// test/pdf-thai-shape.test.cjs — [alpha.170 · บั๊ก 1] PDF บทภาพยนตร์: วรรณยุกต์ไทยต้องไม่หาย/ไม่มีช่องโหว่
//
// ที่มา: ลองใช้แอปจริงแล้ว PDF ของบทภาพยนตร์ภาษาไทยเพี้ยนทั้งไฟล์ ("นั่ง" → "นั  ง" · คำทับกัน)
//   (ก) pdf-lib ใส่ความกว้างใน /W เฉพาะ glyph ที่มีรหัสอักขระ — วรรณยุกต์ตัวยกที่ได้จาก GSUB ตกไปใช้ 1000
//   (ข) pdf-lib ไม่ใช้ตำแหน่ง GPOS — วรรณยุกต์บนสระบนไม่ถูกยก/เยื้อง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const fs = require('fs');
const zlib = require('zlib');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', file)], outfile: tmp,
    bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  return require(tmp);
};
const G = build('pdf-generator.js', 'k2-pdfshape-test.cjs');
const SF = build('sp-format.js', 'k2-pdfshape-fmt-test.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── shapedSegments (บริสุทธิ์ — ไม่ต้องมีฟอนต์) ─────────
{
  const plain = { upm: 1000, plain: true, glyphs: [
    { id: 1, aw: 600, xa: 600, xo: 0, yo: 0 }, { id: 2, aw: 600, xa: 600, xo: 0, yo: 0 }] };
  const s = G.shapedSegments(plain, 12);
  check('ช่วงธรรมดา = TJ ก้อนเดียว ไม่มีตัวเลขชดเชย', s.length === 1 && s[0].tj.length === 1 && s[0].tj[0] === '00010002',
        JSON.stringify(s));

  // ฐาน + สระบน (เยื้องซ้าย) + วรรณยุกต์ (เยื้อง + ยก) + ฐานตัวถัดไป
  const stacked = { upm: 1000, plain: false, glyphs: [
    { id: 10, aw: 600, xa: 600, xo: 0, yo: 0 },
    { id: 11, aw: 0, xa: 0, xo: -50, yo: 0 },
    { id: 12, aw: 0, xa: 0, xo: -80, yo: 400 },
    { id: 13, aw: 500, xa: 500, xo: 0, yo: 0 }] };
  const t = G.shapedSegments(stacked, 10);
  const rises = t.filter((x) => 'rise' in x).map((x) => x.rise);
  check('วรรณยุกต์ที่ต้องยก → มีคำสั่งยกเส้นฐาน แล้วคืนเป็น 0', rises.length === 2 && rises[0] === 4 && rises[1] === 0,
        JSON.stringify(rises));
  // จำลองหัวอ่านของ PDF: เดินตามความกว้างธรรมชาติ + ตัวเลขใน TJ → ตำแหน่งที่ glyph ถูกวาดจริง
  const drawnAt = (segs, shape) => {
    const aw = new Map(shape.glyphs.map((g) => [g.id, g.aw]));
    let x = 0; const out = [];
    for (const sg of segs) {
      if (!sg.tj) continue;
      for (const v of sg.tj) {
        if (typeof v === 'number') { x -= v * shape.upm / 1000; continue; }
        for (let i = 0; i < v.length; i += 4) { const id = parseInt(v.slice(i, i + 4), 16); out.push([id, Math.round(x)]); x += aw.get(id); }
      }
    }
    return out;
  };
  const at = drawnAt(t, stacked);
  check('★ ตำแหน่งที่วาดจริง = ตำแหน่งที่ตัวจัดรูปสั่ง (ฐาน 0 · สระ 550 · วรรณยุกต์ 520 · ฐานถัดไป 600)',
        JSON.stringify(at) === JSON.stringify([[10, 0], [11, 550], [12, 520], [13, 600]]), JSON.stringify(at));

  const kern = { upm: 2048, plain: false, glyphs: [
    { id: 20, aw: 544, xa: 524, xo: 0, yo: 0 }, { id: 21, aw: 1000, xa: 1000, xo: 0, yo: 0 }] };
  const ak = drawnAt(G.shapedSegments(kern, 12), kern);
  check('kerning (ระยะเดิน ≠ ความกว้าง) → ตัวถัดไปถูกดึงกลับ', ak[1][1] === 524, JSON.stringify(ak));
  check('ไม่มี glyph → ไม่มีคำสั่ง', G.shapedSegments({ upm: 1000, glyphs: [] }, 12).length === 0 &&
        G.shapedSegments(null, 12).length === 0);
}

// ───────── กับฟอนต์ไทยจริงของเครื่อง (ไม่มี = ข้ามชุดนี้ · เครื่องพัฒนาทุกระบบมีอย่างน้อยหนึ่งตัว) ─────────
const THAI_FONTS = [
  path.join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'LeelawUI.ttf'),
  path.join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'tahoma.ttf'),
  '/usr/share/fonts/truetype/tlwg/Garuda.ttf',
  '/usr/share/fonts/truetype/tlwg/Loma.ttf',
  '/System/Library/Fonts/Supplemental/Tahoma.ttf',
].filter((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });

function streams(bytes) {
  const buf = Buffer.from(bytes); const out = []; let i = 0;
  for (;;) {
    const s = buf.indexOf('stream', i); if (s < 0) break;
    const e = buf.indexOf('endstream', s); if (e < 0) break;
    let a = s + 6; if (buf[a] === 0x0d) a++; if (buf[a] === 0x0a) a++;
    const chunk = buf.slice(a, e);
    let text; try { text = zlib.inflateSync(chunk).toString('latin1'); } catch { text = chunk.toString('latin1'); }
    out.push(text); i = e + 9;
  }
  return out;
}
/** จำนวน glyph ที่ตาราง /W ของฟอนต์ชื่อนี้ครอบ */
function widthsCovered(bytes, fontHint) {
  const all = streams(bytes).join('\n') + '\n' + Buffer.from(bytes).toString('latin1');
  let best = 0;
  for (const m of all.matchAll(/\/W\s*\[/g)) {
    let depth = 1, j = m.index + m[0].length, n = 0, inSec = false;
    const head = all.slice(Math.max(0, m.index - 400), m.index);
    if (fontHint && !head.includes(fontHint)) continue;
    let tok = '';
    for (; j < all.length && depth > 0; j++) {
      const c = all[j];
      if (c === '[') { depth++; inSec = true; tok = ''; continue; }
      if (c === ']') { if (inSec && tok.trim()) n++; depth--; inSec = false; tok = ''; continue; }
      if (inSec) { if (/\s/.test(c)) { if (tok.trim()) n++; tok = ''; } else tok += c; }
    }
    best = Math.max(best, n);
  }
  return best;
}

(async () => {
  if (!THAI_FONTS.length) { console.log('SKIP ไม่มีฟอนต์ไทยของระบบ — ข้ามชุดฟอนต์จริง'); }
  const { PDFDocument } = require('pdf-lib');
  for (const fp of THAI_FONTS.slice(0, 2)) {
    const name = path.basename(fp);
    const thai = new Uint8Array(fs.readFileSync(fp));
    const doc = await PDFDocument.create();
    const set = await G.embedFonts(doc, { regular: thai });
    check('[' + name + '] ฝังฟอนต์ได้', set.custom === true);
    const sh = G.shapeRun(set.regular, 'นั่ง');
    check('[' + name + '] shapeRun คืน glyph ครบ 4 ตัว', !!sh && sh.glyphs.length === 4, sh && sh.glyphs.length);
    check('[' + name + '] ★ "นั่ง" ต้องจัดตำแหน่งเอง (มีเยื้อง/ยก) — ไม่ใช่ช่วงธรรมดา', !!sh && sh.plain === false);
    check('[' + name + '] สระบน/วรรณยุกต์กว้าง 0 → ความกว้างรวม = ฐานสองตัว',
          !!sh && sh.width === sh.glyphs[0].xa + sh.glyphs[3].xa, sh && sh.width);
    const latin = G.shapeRun(set.regular, 'abc');
    check('[' + name + '] ช่วงละตินล้วน = ธรรมดา (ใช้ทางเดิมของ pdf-lib)', !!latin && latin.plain === true);

    const r = await G.generatePdf({
      blocks: [{ el: 'action', text: 'มีนานั่งอยู่ที่นั่น ตั้งแต่เช้า น้ำเปลี่ยนสี' }],
      fmt: SF.mergeSpFormat(), fonts: { regular: thai }, opts: { titlePages: false, pageNumbers: false } });
    const content = streams(r.bytes).filter((t) => /\bBT\b/.test(t) && /\bET\b/.test(t) && t.length < 200000).join('\n');
    check('[' + name + '] ★ ไฟล์จริงใช้คำสั่ง TJ (วางตำแหน่ง glyph เอง)', /\]\s*TJ\b/.test(content), content.slice(0, 200));
    check('[' + name + '] ★ มีตัวเลขชดเชยตำแหน่งใน TJ', /\[[^\]]*>\s*-?\d+(\.\d+)?\s*</.test(content), content.slice(0, 300));
    const fk = set.regular.embedder.font;
    const cov = widthsCovered(r.bytes, '');
    check('[' + name + '] ★★ ตาราง /W ครอบทุก glyph ของฟอนต์ (เดิมขาดตัวที่ได้จาก GSUB → กว้าง 1000)',
          cov >= fk.numGlyphs, cov + ' / ' + fk.numGlyphs);
    // glyph ที่ได้จากการแทนที่ (ไม่มีรหัสอักขระชี้ตรง) ต้องมีทางคัดลอกกลับเป็นตัวอักษร
    const subst = sh.glyphs.map((g) => g.id).filter((id) => {
      try { return ![0x0e19, 0x0e31, 0x0e48, 0x0e07].some((cp) => fk.glyphForCodePoint(cp).id === id); } catch { return false; }
    });
    const seen = set.regular.embedder.__k2seen;
    check('[' + name + '] glyph ที่ถูกแทนที่ถูกจดรหัสอักขระไว้ให้ ToUnicode',
          subst.every((id) => seen && seen.has(id)), JSON.stringify(subst));
    check('[' + name + '] ครอบซ้ำไม่ได้ (ทำครั้งเดียวต่อฟอนต์)', G.coverAllGlyphs(set.regular) === false);
  }
  check('coverAllGlyphs(null) ไม่พัง', G.coverAllGlyphs(null) === false && G.shapeRun(null, 'x') === null);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
