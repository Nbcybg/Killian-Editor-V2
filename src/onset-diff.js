// onset-diff.js — [alpha.164] "ฉากมีปัญหา" (แก้ปัญหาหน้ากองถ่าย) · ตรรกะบริสุทธิ์
//
// ผู้ใช้ขอ: *"เพิ่มระบบแก้ปัญหาหน้ากองถ่าย คือเหมือน Version แต่ไม่ใช่ระบบกู้คืน มันคือระบบเทียบ
//   ที่ toggle ได้อย่างรวดเร็ว โดยแสดงจุดที่เปลี่ยนเป็นแถบสีแดง (หรือสีที่กำหนด) พร้อม icon ! หน้าบรรทัด
//   ... คลิกขวาที่ฉาก เลือก "ฉากมีปัญหา" ระบบจะทำ version ของฉากนั้น ... print และ export ยึดฉบับที่แก้ไข"*
//
// หลักคิด (ห้ามรื้อ):
//   · ไฟล์ .md ของฉาก = **ฉบับแก้ไข** เสมอ (ตัวจริงของงาน) → บันทึก/พิมพ์/ส่งออก ได้ฉบับแก้ไขโดยโครงสร้าง
//   · ฉบับเดิมเก็บแยกที่ `<โปรเจกต์>/OnSet/<sceneId>.json` (อ่าน/ลบนอกโปรแกรมได้) — ไม่แตะ .md ของฉาก
//   · การเทียบทำ **ทีละบล็อก** (ย่อหน้า/บรรทัดของบท) ด้วย LCS — บล็อกที่ไม่มีคู่ = ถูกแก้/เพิ่ม/ลบ
//
// ไม่แตะ DOM / fs / ProseMirror — unit test: test/onset.test.cjs

export const ONSET_DIR = 'OnSet';
export const ONSET_VERSION = 1;
export const ONSET_DEFAULT_COLOR = '#e5484d';
/** สีสำเร็จรูปของแถบ (แดงเป็นค่าเริ่มต้นตามที่ผู้ใช้ขอ) */
export const ONSET_COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#0090ff', '#8e4ec6'];

/** ค่าสีที่ใช้ได้ (#rgb/#rrggbb) — นอกนั้นตกไปสีแดงเริ่มต้น (ไม่ยัดสตริงดิบลง style) */
export function normColor(c) {
  const s = String(c || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s.toLowerCase() : ONSET_DEFAULT_COLOR;
}

/** ชื่อไฟล์ของบันทึกฉาก (id ของฉากมีตัวอักษรที่ไฟล์ระบบไม่รับได้ = แทนด้วย -) */
export function onsetFileName(sceneId) {
  return String(sceneId || 'scene').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 120) + '.json';
}

/** บันทึก "ฉบับเดิม" ใหม่ */
export function newOnsetRecord(o = {}) {
  return {
    v: ONSET_VERSION,
    sceneId: String(o.sceneId || ''),
    file: String(o.file || ''),                 // path สัมพัทธ์จากรากโปรเจกต์ (ไว้ตรวจว่าเป็นฉากเดียวกัน)
    title: String(o.title || ''),
    created: o.created || new Date(o.now || Date.now()).toISOString(),
    format: o.format === 'screenplay' ? 'screenplay' : 'prose',
    align: typeof o.align === 'string' ? o.align : '',
    color: normColor(o.color),
    note: String(o.note || ''),
    baseline: String(o.baseline ?? ''),
  };
}

/** อ่านไฟล์เก่า/พัง/แก้มือ → รูปที่โค้ดใช้ได้เสมอ (ไม่เคย throw) · คืน null ถ้าไม่มี sceneId */
export function normalizeOnsetRecord(raw) {
  const r = raw && typeof raw === 'object' ? raw : null;
  if (!r || !r.sceneId) return null;
  return newOnsetRecord(r);
}

// ═══════════════ การเทียบทีละบล็อก ═══════════════
/** คีย์เทียบของบล็อก: ชนิด + ชนิดย่อย (element ของบท / ระดับหัวข้อ / รูป) + ข้อความ (ตัดช่องว่างท้าย) */
export function blockKey(type, sub, text) {
  return String(type || '') + '|' + String(sub ?? '') + '|' + String(text || '').replace(/\s+$/, '');
}

const DP_LIMIT = 4e6;   // ช่วงกลางใหญ่กว่านี้ (เช่น 2,000×2,000 บล็อก) = ใช้วิธีจับคู่แบบเร็วแทน

/**
 * จับคู่บล็อกที่เหมือนกัน (LCS) — คืน `match[i]` = ดัชนีใน b ของ a[i] (-1 = ไม่มีคู่)
 * ตัดส่วนหัว/ท้ายที่เหมือนกันก่อน · ช่วงกลางเล็กพอใช้ DP เต็ม · ใหญ่มากใช้วิธีเดินหน้าอย่างเดียว
 */
export function matchBlocks(a, b) {
  const n = a.length, m = b.length;
  const match = new Array(n).fill(-1);
  let pre = 0;
  while (pre < n && pre < m && a[pre] === b[pre]) { match[pre] = pre; pre++; }
  let suf = 0;
  while (suf < n - pre && suf < m - pre && a[n - 1 - suf] === b[m - 1 - suf]) { match[n - 1 - suf] = m - 1 - suf; suf++; }
  const A = a.slice(pre, n - suf), B = b.slice(pre, m - suf);
  const la = A.length, lb = B.length;
  if (!la || !lb) return match;
  if (la * lb <= DP_LIMIT) {
    // L[i][j] = LCS ของ A[i..] กับ B[j..] (ตารางแบนแถวละ lb+1)
    const W = lb + 1;
    const L = new Int32Array((la + 1) * W);
    for (let i = la - 1; i >= 0; i--) {
      for (let j = lb - 1; j >= 0; j--) {
        L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1
          : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < la && j < lb) {
      if (A[i] === B[j]) { match[pre + i] = pre + j; i++; j++; }
      else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) i++;
      else j++;
    }
  } else {
    // ใหญ่มาก: เดินหน้าจับคู่กับตัวที่ใกล้ที่สุดที่ยังไม่เลย (ไม่ optimal แต่ไม่ค้าง)
    const pos = new Map();
    B.forEach((k, j) => { if (!pos.has(k)) pos.set(k, []); pos.get(k).push(j); });
    let last = -1;
    for (let i = 0; i < la; i++) {
      const list = pos.get(A[i]);
      if (!list) continue;
      const j = list.find((x) => x > last);
      if (j === undefined) continue;
      match[pre + i] = pre + j; last = j;
    }
  }
  return match;
}

/**
 * ผลเทียบจากมุมของฉบับที่กำลังแสดง (`own`) กับอีกฉบับ (`other`)
 * @param {string[]} own   คีย์บล็อกของฉบับบนจอ
 * @param {string[]} other คีย์บล็อกของอีกฉบับ
 * @returns {{kinds:string[], gaps:number[], stats:{changed:number, added:number, removed:number, hunks:number}}}
 *   kinds[i] = '' | 'changed' (มีคู่ที่ถูกแก้) | 'added' (ไม่มีอยู่ในอีกฉบับ)
 *   gaps = ดัชนีบล็อกของ own ที่ "ข้างหน้ามีบล็อกของอีกฉบับหายไป" (= own.length คือท้ายเอกสาร)
 */
export function diffBlocks(own = [], other = []) {
  const match = matchBlocks(own, other);
  const kinds = new Array(own.length).fill('');
  const gaps = [];
  const stats = { changed: 0, added: 0, removed: 0, hunks: 0 };
  let i = 0, j = 0;
  while (i < own.length || j < other.length) {
    // ช่วงที่ไม่มีคู่ของทั้งสองฝั่ง จนถึงคู่ถัดไป
    const i0 = i;
    while (i < own.length && match[i] < 0) i++;
    const nextJ = i < own.length ? match[i] : other.length;
    const onlyOwn = i - i0, onlyOther = Math.max(0, nextJ - j);
    if (onlyOwn || onlyOther) {
      stats.hunks++;
      if (onlyOwn && onlyOther) {
        for (let k = i0; k < i; k++) kinds[k] = 'changed';
        stats.changed += onlyOwn;
        if (onlyOther > onlyOwn) stats.removed += onlyOther - onlyOwn;
      } else if (onlyOwn) {
        for (let k = i0; k < i; k++) kinds[k] = 'added';
        stats.added += onlyOwn;
      } else {
        gaps.push(i);                     // บล็อกของอีกฉบับหายไปก่อนบล็อกที่ i
        stats.removed += onlyOther;
      }
    }
    if (i >= own.length) break;
    j = nextJ + 1; i++;                   // ข้ามคู่ที่ตรงกัน
  }
  return { kinds, gaps, stats };
}

/** จำนวน "จุดที่แก้" สำหรับชิปบนจอ (นับเป็นก้อน ไม่ใช่ทีละบรรทัด) */
export function changeCount(d) { return d && d.stats ? d.stats.hunks : 0; }
