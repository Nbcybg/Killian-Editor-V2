// th-seg.cjs — ตัดคำไทยด้วยพจนานุกรมที่โปรแกรมใช้อยู่แล้ว (renderer/assets/dict_th.txt)
// ใช้ตอน "ตั้งชื่อคีย์" ให้ข้อความไทย — ไม่ได้ใช้ตอนรัน (เป็นเครื่องมือฝั่ง node ล้วน)
//
// วิธี: longest-match ไปข้างหน้า + ถอยหนึ่งครั้งเมื่อชนทางตัน — พอสำหรับงานตั้งชื่อ
// (ตัวจริงใน src/spell.js เป็น DP เต็มรูปแบบ แต่ที่นี่ขอเร็วและง่ายกว่า)

const fs = require('fs');
const path = require('path');

let DICT = null, MAXLEN = 1;
function loadDict() {
  if (DICT) return DICT;
  DICT = new Set();
  for (const f of ['dict_th.txt']) {
    const p = path.join(__dirname, '..', 'renderer', 'assets', f);
    try {
      for (const w of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const t = w.trim();
        if (t.length > 1) { DICT.add(t); if (t.length > MAXLEN) MAXLEN = t.length; }
      }
    } catch {}
  }
  return DICT;
}

const THAI = /[฀-๿]/;

/** ตัดข้อความไทยเป็นคำ — ส่วนที่ไม่ใช่ไทยคืนมาเป็นชิ้นตามเดิม */
function segment(text) {
  loadDict();
  const out = [];
  const s = String(text || '');
  let i = 0;
  while (i < s.length) {
    if (!THAI.test(s[i])) {
      let j = i; while (j < s.length && !THAI.test(s[j])) j++;
      const chunk = s.slice(i, j).trim();
      if (chunk) out.push(chunk);
      i = j; continue;
    }
    let hit = '';
    for (let len = Math.min(MAXLEN, s.length - i); len >= 2; len--) {
      const w = s.slice(i, i + len);
      if (DICT.has(w)) { hit = w; break; }
    }
    if (hit) { out.push(hit); i += hit.length; continue; }
    // ไม่เจอในพจนานุกรม — กินอักษรไทยติดกันไปจนกว่าจะเจอคำที่รู้จัก
    let j = i + 1;
    while (j < s.length && THAI.test(s[j])) {
      let found = false;
      for (let len = Math.min(MAXLEN, s.length - j); len >= 2; len--) {
        if (DICT.has(s.slice(j, j + len))) { found = true; break; }
      }
      if (found) break;
      j++;
    }
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}

module.exports = { segment, loadDict };

if (require.main === module) {
  // นับความถี่ของคำ เพื่อรู้ว่าต้องเขียนพจนานุกรมไทย→อังกฤษกี่คำถึงจะครอบคลุม
  const { lexCsv } = require('./csv-lite.cjs');
  const tbl = lexCsv(fs.readFileSync(path.join(__dirname, '..', 'languages', 'k2_th.csv'), 'utf8'));
  const msgids = Object.keys(tbl).filter((k) => THAI.test(k));
  const freq = new Map(), firstFreq = new Map();
  for (const m of msgids) {
    const words = segment(m).filter((w) => THAI.test(w));
    words.forEach((w, i) => {
      freq.set(w, (freq.get(w) || 0) + 1);
      if (i < 4) firstFreq.set(w, (firstFreq.get(w) || 0) + 1);
    });
  }
  const top = [...firstFreq.entries()].sort((a, b) => b[1] - a[1]);
  const arg = process.argv[2] || '400';
  if (arg === '--stats') {
    let cum = 0; const total = [...firstFreq.values()].reduce((a, b) => a + b, 0);
    top.forEach(([, n], i) => { if (i < 200) cum += n; });
    console.log('msgid ไทย', msgids.length, '· คำไม่ซ้ำ (4 คำแรก)', top.length,
                '· top200 ครอบคลุม', (cum / total * 100).toFixed(1) + '%');
  } else {
    for (const [w, n] of top.slice(0, +arg)) console.log(n + '\t' + w);
  }
}
