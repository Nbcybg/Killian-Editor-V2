// csv-lite.cjs — พาร์ส CSV 2 คอลัมน์แบบเดียวกับที่ตัวโปรแกรมใช้ (สำหรับสคริปต์ฝั่ง node)
// (ตัวจริงอยู่ src/i18n-csv.js ซึ่งเป็น ES module — สคริปต์ .cjs เรียกตรงไม่ได้)
function parseCsv(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = []; let row = [], cell = '', inQ = false, i = 0;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); rows.push(row); row = []; };
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i += 2; continue; } inQ = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { endCell(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { endRow(); i++; continue; }
    cell += c; i++;
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}
/** CSV → { key: text } (ข้ามแถวคอมเมนต์ `#…` และแถวที่ค่าว่าง) */
function lexCsv(text) {
  const out = {};
  for (const r of parseCsv(text)) {
    const k = r[0] == null ? '' : String(r[0]);
    if (!k || k.startsWith('#') || k.toLowerCase() === 'key') continue;
    const v = r[1] == null ? '' : String(r[1]);
    if (v !== '') out[k] = v;
  }
  return out;
}
module.exports = { parseCsv, lexCsv };
