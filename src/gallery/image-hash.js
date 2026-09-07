// image-hash.js — "ค้นหารูปที่คล้ายกัน" แบบไม่ต้องพึ่ง AI (alpha.63 · บริสุทธิ์ 100%)
//
// ใช้ average hash (aHash): ย่อรูปเป็น 8×8 → เทา → เทียบกับค่าเฉลี่ย → บิต 64 ตัว → hex 16 ตัว
// เทียบกันด้วยระยะแฮมมิง — ทนต่อการย่อ/ขยาย/บีบอัด/ปรับสีเล็กน้อย
// ฝั่ง UI ดึงพิกเซลจาก `<canvas>` แล้วส่ง Uint8ClampedArray (RGBA) เข้ามา — โมดูลนี้ไม่แตะ DOM

export const HASH_SIZE = 8;                 // 8×8 = 64 บิต
export const HASH_HEX_LEN = 16;

/** ค่าเทาแบบถ่วงน้ำหนักตามการรับรู้ของตา */
export const grayOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * pixels = RGBA ของภาพขนาด w×h (ปกติ 8×8 ที่ย่อมาแล้ว)
 * คืน hex 16 ตัว · ภาพเสีย/ว่าง → ''
 */
export function aHash(pixels, w = HASH_SIZE, h = HASH_SIZE) {
  if (!pixels || pixels.length < w * h * 4) return '';
  const g = new Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const a = pixels[o + 3] / 255;
    // พื้นโปร่งใสนับเป็นขาว — ไม่งั้น PNG โปร่งใสทุกใบแฮชเท่ากันหมด
    const v = grayOf(pixels[o], pixels[o + 1], pixels[o + 2]) * a + 255 * (1 - a);
    g[i] = v; sum += v;
  }
  const avg = sum / (w * h);
  let hex = '';
  for (let i = 0; i < w * h; i += 4) {
    let nib = 0;
    for (let j = 0; j < 4; j++) if (g[i + j] >= avg) nib |= 1 << (3 - j);
    hex += nib.toString(16);
  }
  return hex;
}

/** สีเฉลี่ยของรูป (ใช้ทำจุดสีบนการ์ด + จัดกลุ่มตามโทน) */
export function avgColor(pixels) {
  if (!pixels || !pixels.length) return { r: 0, g: 0, b: 0, hex: '#000000' };
  let r = 0, g = 0, b = 0, n = 0;
  for (let o = 0; o < pixels.length; o += 4) {
    const a = pixels[o + 3] / 255;
    r += pixels[o] * a; g += pixels[o + 1] * a; b += pixels[o + 2] * a; n += a || 0.0001;
  }
  const R = Math.round(r / n), G = Math.round(g / n), B = Math.round(b / n);
  const hx = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return { r: R, g: G, b: B, hex: '#' + hx(R) + hx(G) + hx(B) };
}

const POP = (() => { const t = new Array(16); for (let i = 0; i < 16; i++)
  t[i] = (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1); return t; })();

/** ระยะแฮมมิงของแฮช 2 ตัว (hex) — ความยาวไม่เท่ากัน/ว่าง → คืนค่าสูงสุด */
export function hamming(a, b) {
  const A = String(a || ''), B = String(b || '');
  if (!A || !B || A.length !== B.length) return HASH_SIZE * HASH_SIZE;
  let d = 0;
  for (let i = 0; i < A.length; i++) {
    const x = parseInt(A[i], 16) ^ parseInt(B[i], 16);
    d += POP[Number.isNaN(x) ? 15 : x];
  }
  return d;
}

/** ความคล้าย 0..1 (1 = เหมือนกันทุกบิต) */
export function similarity(a, b) {
  const bits = String(a || '').length * 4 || HASH_SIZE * HASH_SIZE;
  return 1 - hamming(a, b) / bits;
}

/**
 * รูปที่คล้าย `target` จากรายการ (ทุกใบต้องมีฟิลด์ `hash`)
 * min = ความคล้ายขั้นต่ำ (0.80 ≈ ต่างกันไม่เกิน ~13 บิต)
 */
export function similarImages(items, target, { min = 0.8, limit = 24 } = {}) {
  const h = target && (target.hash || target);
  if (!h) return [];
  return (items || [])
    .filter((it) => it.hash && it !== target && it.path !== (target && target.path))
    .map((it) => ({ ...it, score: similarity(h, it.hash) }))
    .filter((it) => it.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** จับคู่รูปซ้ำ/เกือบซ้ำทั้งคลัง → [{a, b, score}] (ใช้ปุ่ม "หารูปซ้ำ") */
export function findDuplicates(items, { min = 0.94 } = {}) {
  const list = (items || []).filter((i) => i.hash);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const s = similarity(list[i].hash, list[j].hash);
      if (s >= min) out.push({ a: list[i], b: list[j], score: s });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
