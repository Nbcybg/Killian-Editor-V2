// speech-split.js — แยก "บทพูด" ออกจาก "คำบรรยาย" ในข้อความก้อนเดียว (บริสุทธิ์ 100%)
//
// ผู้ใช้ (alpha.123): *"ในการเล่น หรือซ้อมบท AI เราจะให้คำพูดเป็นตัวเอียงได้มั้ย
//                      เกิดเราจะต่อยอด ใส่เสียงลงไป"*
//
// ทำไมต้องเป็นโมดูลบริสุทธิ์แยก แทนที่จะ regex ในตัววาด:
//   · **ตัวเอียงเป็นแค่ผลลัพธ์แรก** — เป้าหมายจริงคือ TTS ซึ่งต้องการ "ก้อนไหนคือเสียงพูด
//     ของใคร" เป็นข้อมูล ไม่ใช่เป็น HTML · แยกไว้แล้วทั้งสองงานใช้ตัวเดียวกัน ไม่มีทางไม่ตรงกัน
//   · เครื่องหมายคำพูดมีหลายชุด (ตรง · โค้ง · ญี่ปุ่น · ฝรั่งเศส) และงานไทยผสมกันได้ในไฟล์เดียว
//     ตรรกะแบบนี้ต้องมีเทสกำกับ ไม่ใช่เดาเอาแล้วเจอเคสตกหล่นตอนใช้จริง
//
// **จงใจไม่รองรับ single quote (`'…'`)** — ภาษาอังกฤษใช้เป็น apostrophe (`don't`, `Kai's`)
// ซึ่งจะทำให้ครึ่งประโยคกลายเป็นบทพูดผิด ๆ · ไทยก็นิยม `"…"` อยู่แล้ว
//
// ไม่แตะ DOM/i18n → unit test ได้ตรง ๆ (test/speech-split.test.cjs)

/** คู่เครื่องหมายคำพูดที่รองรับ — เปิด → ปิด */
export const QUOTE_PAIRS = [
  ['"', '"'],        // ตรง (พิมพ์ง่ายสุด ใช้มากสุด)
  ['“', '”'],  // โค้งอังกฤษ “ ”
  ['„', '“'],  // เยอรมัน „ “
  ['«', '»'],  // ฝรั่งเศส « »
  ['「', '」'],  // ญี่ปุ่น 「 」
  ['『', '』'],  // ญี่ปุ่นซ้อน 『 』
];

const OPENERS = new Map(QUOTE_PAIRS.map(([o, c]) => [o, c]));

export const KIND_SPEECH = 'speech';
export const KIND_NARRATION = 'narration';

/**
 * แยกข้อความเป็นช่วง ๆ
 *
 * กติกาที่เทสล็อกไว้:
 *   1. **ต่อกันแล้วต้องได้ข้อความเดิมเป๊ะ** — ห้ามกินอักขระหาย (เทสยืนยันทุกเคส)
 *   2. เครื่องหมายเปิดที่ไม่มีตัวปิด = ไม่ใช่บทพูด (ปล่อยเป็นคำบรรยายทั้งท่อน)
 *      — คนเขียนพิมพ์ค้างระหว่างทางตลอด ห้ามให้ครึ่งเอกสารกลายเป็นตัวเอียง
 *   3. เครื่องหมายคำพูด **อยู่ในก้อน speech ด้วย** — TTS ตัดเองได้ (`stripQuotes`)
 *      แต่ตัวเอียงต้องครอบให้เห็นว่านี่คือคำพูด
 *
 * @param {string} text
 * @returns {Array<{kind:string, text:string}>}
 */
export function splitSpeech(text) {
  const s = String(text == null ? '' : text);
  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ kind: KIND_NARRATION, text: buf }); buf = ''; } };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const close = OPENERS.get(ch);
    if (close === undefined) { buf += ch; continue; }
    // หาตัวปิดที่อยู่ **บรรทัดเดียวกัน** — คำพูดข้ามย่อหน้ามักแปลว่าลืมปิด ไม่ใช่ประโยคยาว
    let end = -1;
    for (let j = i + 1; j < s.length; j++) {
      if (s[j] === '\n') break;
      if (s[j] === close) { end = j; break; }
    }
    if (end < 0) { buf += ch; continue; }        // กติกาข้อ 2
    flush();
    out.push({ kind: KIND_SPEECH, text: s.slice(i, end + 1) });
    i = end;
  }
  flush();
  return out;
}

/** มีบทพูดในข้อความไหม (ตัววาดใช้ตัดสินว่าจะแตกก้อนหรือวาดรวดเดียว) */
export function hasSpeech(text) {
  return splitSpeech(text).some((p) => p.kind === KIND_SPEECH);
}

/** ถอดเครื่องหมายคำพูดออกจากก้อน speech — TTS ต้องการเนื้อล้วน */
export function stripQuotes(part) {
  const s = String((part && part.text) || part || '');
  for (const [o, c] of QUOTE_PAIRS) {
    if (s.length >= 2 && s.startsWith(o) && s.endsWith(c)) return s.slice(1, -1);
  }
  return s;
}

/**
 * เตรียมข้อมูลสำหรับอ่านออกเสียง — ก้อนที่ต้องพูด + ก้อนที่เป็นเสียงบรรยาย
 * ยังไม่มีใครเรียก แต่ตั้งใจวางไว้ให้ระบบเสียงในอนาคตต่อตรงนี้ ไม่ต้องรื้อตัววาด
 * @returns {Array<{kind:string, text:string, say:string}>}
 */
export function speechParts(text) {
  return splitSpeech(text).map((p) => ({
    ...p,
    say: p.kind === KIND_SPEECH ? stripQuotes(p) : p.text.trim(),
  })).filter((p) => p.say);
}
