// kanban-csv.js — [alpha.168 · bug hunt] ตรรกะของ "ส่งออก Kanban เป็น CSV" (บริสุทธิ์ 100% — ไม่ import อะไร)
// ตัวอ่านไฟล์/กล่องบันทึกอยู่ที่ panel-exports.js (`exportKanbanCsv`)

/**
 * เล่มที่จะส่งออก เรียงตามลำดับเรื่อง + ร่างหลักของแต่ละเล่ม (บริสุทธิ์ — unit test ได้)
 * [alpha.168 · bug hunt] เดิมไล่ทุกร่างของทุกเล่มตามชื่อโฟลเดอร์ → ฉากของร่างรองปนมาเป็นแถวซ้ำ (ไม่มีคอลัมน์บอกร่าง)
 *   และเล่มเรียงตามตัวอักษรของโฟลเดอร์ ไม่ใช่ลำดับเรื่อง · Kanban บนจอแสดงเฉพาะร่างหลัก — ไฟล์ต้องตรงกับจอ
 * @param secs [{ folder, meta }] meta = เนื้อของ section.json
 */
export function kanbanSections(secs) {
  return (secs || []).map((x, i) => ({ folder: x.folder, title: (x.meta && x.meta.title) || x.folder,
    order: Number.isFinite(+((x.meta || {}).order)) ? +x.meta.order : 1e9, i,
    draft: String((x.meta && x.meta.primaryDraft) || 'default') }))
    .sort((a, b) => a.order - b.order || a.i - b.i);
}
/** แถวของ CSV จากเล่ม+ร่างหลัก (บริสุทธิ์) · books = [{ title, draft:{chapters}, scenes:{guid:[row]} }] */
export function kanbanRows(books, label = (v) => v) {
  const rows = [];
  for (const b of books || []) {
    const chs = ((b.draft && b.draft.chapters) || []).slice().sort((x, y) => (x.order || 0) - (y.order || 0));
    for (const ch of chs) {
      const list = ((b.scenes || {})[ch.guid] || []).slice().sort((x, y) => (x.order || 0) - (y.order || 0));
      for (const r of list) {
        if (r.type === 'memo') continue;
        rows.push([b.title, ch.title || '', r.title || '', r.status ? label(r.status) : '', r.storyDate || '', r.words || r.wordCount || '']);
      }
    }
  }
  return rows;
}

