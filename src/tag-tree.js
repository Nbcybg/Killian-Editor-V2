// tag-tree.js — [alpha.159 · M35] ต้นไม้แท็กแบบลำดับชั้น (`สถานที่:เมือง:กรุงเทพ`) — บริสุทธิ์
//
// เดิมตัววาดใน tag-pane.js ใส่ count เฉพาะ "ใบ" → ทุกตัวแม่ได้ 0 แล้วการเรียง "มาก→น้อย"
// ดันตัวแม่ทุกตัวไปท้ายรายการ (ผังกลับหัว: ลูกโผล่ก่อน แม่ 0 ห้อยท้าย)
// ตอนนี้: `own` = จำนวนที่ใช้แท็กนี้ตรง ๆ · `count` = own + ผลรวมของทุกลูกหลาน (ตัวเลขที่แสดง)

/**
 * @param {Record<string, number>} counts แท็ก → จำนวนครั้งที่ใช้
 * @returns {Record<string, {own:number, count:number, children:object}>}
 */
export function buildTagTree(counts) {
  const tree = {};
  for (const [tag, n] of Object.entries(counts || {})) {
    const c = Number(n) || 0;
    const parts = String(tag).split(':').filter((p) => p !== '');
    if (!parts.length) continue;
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(0, i + 1).join(':');
      if (!node[key]) node[key] = { own: 0, count: 0, children: {} };
      node[key].count += c;                       // ★ ทุกชั้นบนเส้นทางได้ผลรวมด้วย
      if (i === parts.length - 1) node[key].own += c;
      node = node[key].children;
    }
  }
  return tree;
}

/** ลูกของโหนดหนึ่งชั้น เรียงมาก→น้อย (เท่ากัน = ตามชื่อ) */
export function sortedTagEntries(obj) {
  return Object.entries(obj || {}).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
}
