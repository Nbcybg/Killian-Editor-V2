// test/hdr-decode.test.cjs — [alpha.168] ถอดไฟล์ .hdr (RGBE) + พาโนรามาของฉากหลัง Story Network
// ผู้ใช้: "ฉากหลัง พอเป็น 3d แล้ว มันควรเป็นแบบ HDRI นะ · ถ้าใส่รูปธรรมดา จะได้เป็น background แบบ fix"
require('./_lang.cjs').installLang('th');
const path = require('path');
const fs = require('fs');
const os = require('os');
const out = path.join(os.tmpdir(), '_hdrdecode.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/hdr-decode.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const H = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

/** ค่าสี float → RGBE */
function toRgbe(r, g, b) {
  const m = Math.max(r, g, b);
  if (m < 1e-32) return [0, 0, 0, 0];
  const e = Math.ceil(Math.log2(m) + 1e-9);
  const f = 256 / Math.pow(2, e);
  return [Math.min(255, Math.floor(r * f)), Math.min(255, Math.floor(g * f)), Math.min(255, Math.floor(b * f)), e + 128];
}
/** เขียนไฟล์ .hdr ทดสอบ: rle = บรรทัดสแกนแบบ RLE ใหม่ (แต่ละช่องสีเป็นช่วงซ้ำ/ดิบสลับกัน) */
function makeHdr(W, Hh, px, { rle = true, header = '+X' } = {}) {
  const head = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=1.0\n\n-Y ${Hh} ${header} ${W}\n`;
  const bytes = [...Buffer.from(head, 'latin1')];
  for (let y = 0; y < Hh; y++) {
    const row = [];
    for (let x = 0; x < W; x++) row.push(toRgbe(...px(x, y)));
    if (!rle) { for (const p of row) bytes.push(...p); continue; }
    bytes.push(2, 2, (W >> 8) & 255, W & 255);
    for (let ch = 0; ch < 4; ch++) {
      const vals = row.map((p) => p[ch]);
      let x = 0;
      while (x < W) {
        let run = 1;
        while (x + run < W && run < 127 && vals[x + run] === vals[x]) run++;
        if (run >= 3) { bytes.push(128 + run, vals[x]); x += run; continue; }
        let n = 0; const st = x;
        while (x < W && n < 128) {
          let r2 = 1; while (x + r2 < W && r2 < 3 && vals[x + r2] === vals[x]) r2++;
          if (r2 >= 3) break;
          x++; n++;
        }
        bytes.push(n, ...vals.slice(st, st + n));
      }
    }
  }
  return Uint8Array.from(bytes);
}

// ═══════════ หัวไฟล์ ═══════════
{
  const f = makeHdr(16, 4, () => [1, 1, 1]);
  const h = H.parseHdrHeader(f);
  check('หัวไฟล์: อ่านกว้าง/สูงได้', h && h.width === 16 && h.height === 4, JSON.stringify(h));
  check('หัวไฟล์ที่ไม่ใช่ RADIANCE = null', H.parseHdrHeader(Buffer.from('hello\n\n-Y 1 +X 1\n')) === null);
  check('บรรทัดขนาดเสีย = null', H.parseHdrHeader(Buffer.from('#?RADIANCE\n\nnonsense\n')) === null);
  check('FORMAT xyze ไม่รองรับ = null', H.parseHdrHeader(Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_xyze\n\n-Y 1 +X 1\n')) === null);
}

// ═══════════ ถอด RLE + ดิบ ═══════════
{
  const W = 40, Hh = 6;
  const px = (x, y) => (x < 20 ? [0.5, 0.25, 0.125] : [2 + (x % 3), 1, y * 0.5]);
  for (const rle of [true, false]) {
    const d = H.decodeRgbe(makeHdr(W, Hh, px, { rle }));
    check(`ถอด${rle ? ' RLE' : 'แบบดิบ'}: ได้ขนาดครบ`, d && d.width === W && d.height === Hh && d.rgbe.length === W * Hh * 4);
    if (!d) continue;
    let worst = 0;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const v = H.rgbeToFloat(d.rgbe[i], d.rgbe[i + 1], d.rgbe[i + 2], d.rgbe[i + 3]);
      const e = px(x, y);
      const mx = Math.max(...e); // RGBE ใช้เลขชี้กำลังร่วม — ความละเอียดเทียบกับช่องที่สว่างสุดของพิกเซล
      for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(v[k] - e[k]) / mx);
    }
    check(`ถอด${rle ? ' RLE' : 'แบบดิบ'}: ค่าสีกลับมาตรง (คลาดไม่เกิน 2%)`, worst < 0.02, worst);
  }
  const bad = makeHdr(W, Hh, px);
  check('ไฟล์ขาดกลางทาง = null (ไม่ throw)', H.decodeRgbe(bad.slice(0, bad.length - 30)) === null);
}

// ═══════════ tone map ═══════════
{
  const f = makeHdr(64, 2, (x) => [x / 8, x / 8, x / 8]);
  const r = H.hdrToRgba8(f);
  check('tone map: ขนาดเท่าเดิมเมื่อไม่เกิน maxW', r && r.width === 64 && r.height === 2 && r.data.length === 64 * 2 * 4);
  let mono = true;
  for (let x = 1; x < 64; x++) if (r.data[x * 4] < r.data[(x - 1) * 4]) mono = false;
  check('tone map: สว่างขึ้นตามค่าจริง (ไม่ย้อน) + ไม่ล้น 255', mono && r.data[63 * 4] <= 255 && r.data[63 * 4] > 200);
  check('tone map: ดำ = 0 · alpha = 255', r.data[0] === 0 && r.data[3] === 255);
  const small = H.hdrToRgba8(f, { maxW: 16 });
  check('tone map: ย่อด้านยาวตาม maxW', small.width === 16);
}

// ═══════════ พาโนรามา ═══════════
{
  check('2:1 = พาโนรามา', H.isPanorama(4096, 2048) && H.isPanorama(2000, 1000));
  check('16:9 / 1:1 ไม่ใช่พาโนรามา (รูปธรรมดา = ติดจอ)', !H.isPanorama(1920, 1080) && !H.isPanorama(800, 800) && !H.isPanorama(0, 0));
  const c = H.panoUV(500, 300, 1000, 600, 0, 0);
  check('กลางจอ มุม 0 = กลางภาพ', Math.abs(c.u - 0.5) < 1e-9 && Math.abs(c.v - 0.5) < 1e-9);
  const yaw = H.panoUV(500, 300, 1000, 600, 0, Math.PI / 2);
  check('หมุนซ้าย-ขวา 90° = เลื่อนภาพไปหนึ่งในสี่', Math.abs(yaw.u - 0.75) < 1e-9);
  const down = H.panoUV(500, 300, 1000, 600, -0.5, 0);
  check('ก้มกล้อง (มองโต๊ะจากด้านบน) = เห็นครึ่งล่างของภาพ (พื้น)', down.v > 0.6);
  const l = H.panoUV(0, 300, 1000, 600, 0, 0), r = H.panoUV(1000, 300, 1000, 600, 0, 0);
  check('ขอบซ้าย/ขวาของจอสมมาตรรอบกลางภาพ', Math.abs((l.u + r.u) / 2 - 0.5) < 1e-9 && l.u < 0.5 && r.u > 0.5);
}

// ═══════════ ผังใช้จริง (ซอร์ส) ═══════════
{
  const rd = (f) => fs.readFileSync(path.join(__dirname, '../src/' + f), 'utf8');
  const bg = rd('network-bg.js');
  check('3D ไม่วาดกริด', /showGrid !== false && !extra\.mode3D/.test(bg));
  check('3D ไม่วาดรูปเป็นแผ่นบนพื้น (hdri หรือติดจอ)', /if \(mode3D\) return/.test(bg));
  check('ผังส่ง mode3D ให้ตัววาดพื้น + อยู่ในคีย์แคช', /mode3D:!!cam\.mode3D/.test(rd('network.js')) && /!!cam\.mode3D,\n/.test(rd('network.js')));
  check('ผังถอด .hdr เอง (loadHdr)', /\\\.hdr\$\/i\.test\(rel\)/.test(rd('network.js')) && /loadHdr:/.test(rd('app.js')));
}

console.log(`hdr-decode: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
