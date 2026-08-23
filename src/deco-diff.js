// deco-diff.js — ส่วนต่างของ decoration สองชุด (บริสุทธิ์ 100% · ไม่รู้จัก ProseMirror)
//
// ═══ [alpha.88 ข้อ 6] ★ ต้นตอของ "ย่อหน้าเดียวยาวมาก พิมพ์แล้วหน่วง" ═══
//
// `incrementalDecoState()` ใน editor.js สแกนใหม่เฉพาะ **บล็อกที่แก้** ซึ่งเร็วมากกับเอกสารปกติ
// แต่เอกสารที่เป็น *ย่อหน้าเดียวยาวหลายหมื่นอักขระ* บล็อกนั้นคือทั้งเอกสาร — ทุกครั้งที่พิมพ์
// มันจึง **ถอด decoration ทั้ง 2,252 ตัวออกแล้วใส่กลับทั้ง 2,252 ตัว** ทั้งที่แทบทั้งหมดเหมือนเดิม
//
// ราคาไม่ได้อยู่ที่การสแกน (วัดแล้ว 4.1%) แต่อยู่ที่ `DecorationSet.remove()` ของ ProseMirror:
// `removeInner()` วนรายการที่จะลบ **คูณกับ** decoration ทั้งหมดในบล็อกนั้น แล้วเทียบด้วย `.eq()`
// ทีละคู่ (prosemirror-view — ลูป local ซ้อนในลูป decorations) · ย่อหน้าเดียวหมายความว่า
// ทุกตัวอยู่ใน `local` ก้อนเดียวกัน → **2,252 × 2,252 ≈ 5.1 ล้านครั้งต่อการพิมพ์หนึ่งตัว**
//
// ทางแก้ที่ปลอดภัยที่สุด: อย่าไปยุ่งกับ "ช่วงที่สแกน" (เคยลองจำกัดหน้าต่างรอบจุดแก้แล้ว
// decoration รั่วสะสม เพราะนิยาม "ทับช่วง" ของ find() กับ scan() ไม่ตรงกัน — และการตัดคำไทย
// เป็น DP ทั้งสาย ย้ายขอบหน้าต่างแล้วผลตัดคำเปลี่ยนตาม) — แต่ให้ **ส่งเฉพาะส่วนต่างจริง ๆ**
// เข้า remove()/add() ผลลัพธ์สุดท้ายเท่าเดิมเป๊ะทุกตัว:
//
//   เดิม  = (moved − oldIn) ∪ next
//   ใหม่  = (moved − remove) ∪ add
//         = (moved − oldIn) ∪ (oldIn ∩ next) ∪ (next − oldIn) = (moved − oldIn) ∪ next   ✔
//
// พิมพ์หนึ่งตัวกลางย่อหน้า → `mapping` เลื่อนตำแหน่งให้แล้ว ส่วนต่างจึงเหลือแค่คำรอบ ๆ จุดแก้

/** คีย์ของชุด attribute — เรียงชื่อคีย์ก่อนเสมอ ให้ลำดับการสร้าง object ไม่มีผล */
export function attrsKey(a) {
  if (!a || typeof a !== 'object') return '';
  // ตัวคั่นสำคัญ — ถ้าไม่มี `{ab:'c'}` กับ `{a:'bc'}` จะได้คีย์เดียวกัน
  let s = '';
  for (const k of Object.keys(a).sort()) s += k + '~' + a[k] + ';';
  return s;
}

let _uniq = 0;
/**
 * คีย์ประจำตัวของ decoration หนึ่งตัว — ตรงกันเมื่อไหร่ = `Decoration.eq()` ของ PM ตรงด้วย
 *
 * ชนิดที่ไม่ใช่ inline/node (เช่น widget ที่เทียบกันด้วย `spec.key`) คืนคีย์ที่ **ไม่มีวันซ้ำ**
 * → ตกกลับไปเป็น "ถอดแล้วใส่ใหม่" แบบเดิม ซึ่งถูกต้องเสมอ แค่ไม่ได้เร็วขึ้น
 */
export function decoKey(d) {
  const at = d && d.type && d.type.attrs;
  if (!at) return '#w' + (++_uniq);
  return d.from + '|' + d.to + '|' + attrsKey(at) + '|' + attrsKey(d.spec);
}

/**
 * ส่วนต่างแบบ multiset — ตัวที่ซ้ำคีย์กันหลายตัวถูกนับทีละใบ ไม่ยุบรวม
 * @param {any[]} oldList ของเดิมในช่วงที่จะสแกนใหม่
 * @param {any[]} newList ผลสแกนรอบนี้
 * @param {(d:any)=>string} [keyOf]
 * @returns {{remove:any[], add:any[]}} ส่งต่อให้ `set.remove(remove).add(doc, add)` ได้ตรง ๆ
 */
export function diffByKey(oldList, newList, keyOf = decoKey) {
  const olds = oldList || [], news = newList || [];
  if (!olds.length) return { remove: [], add: news.slice() };
  if (!news.length) return { remove: olds.slice(), add: [] };
  const oldKeys = new Array(olds.length), newKeys = new Array(news.length);
  const oldHave = new Map(), newNeed = new Map();
  for (let i = 0; i < olds.length; i++) {
    const k = keyOf(olds[i]); oldKeys[i] = k;
    oldHave.set(k, (oldHave.get(k) || 0) + 1);
  }
  for (let i = 0; i < news.length; i++) {
    const k = keyOf(news[i]); newKeys[i] = k;
    newNeed.set(k, (newNeed.get(k) || 0) + 1);
  }
  const remove = [];
  for (let i = 0; i < olds.length; i++) {
    const k = oldKeys[i], n = newNeed.get(k) || 0;
    if (n > 0) newNeed.set(k, n - 1); else remove.push(olds[i]);
  }
  const add = [];
  for (let i = 0; i < news.length; i++) {
    const k = newKeys[i], n = oldHave.get(k) || 0;
    if (n > 0) oldHave.set(k, n - 1); else add.push(news[i]);
  }
  return { remove, add };
}
