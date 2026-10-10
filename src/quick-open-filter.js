// quick-open-filter.js — [alpha.169 · bug hunt] "ไฟล์ไหนควรโผล่ในกล่องเปิดไฟล์ด่วน" (บริสุทธิ์ 100%)
//
// ที่มา: เปิดกล่อง (Ctrl+Shift+O) บนแอปจริง — ยี่สิบแถวแรกเป็นของภายในเกือบหมด:
//   project.khn.json · templates.json · history.json · `.k2history/blobs/*` (สำเนาย้อนหลังของฉาก — ชื่อเหมือนไฟล์จริง
//   กดเปิดแล้วได้ "สำเนาเก่า" มาแก้โดยไม่รู้ตัว) · ไฟล์คีย์ของ AI ก็อยู่ในรายการ
//   และเอนทิตี้ของ Wiki (.json) ถูกเปิดเป็นตัวแก้ JSON ดิบ แทนหน้า Wiki ที่ Explorer เปิด
// ที่นี่ตัดสินสามเรื่อง: โฟลเดอร์ไหนไม่ลงไปดู · ไฟล์ไหนไม่โชว์ · ไฟล์ที่โชว์เป็น "ของชนิดไหน" (เปิดด้วยอะไร + เรียงยังไง)
// ไม่ import อะไรเลย — unit test ด้วย node ได้ตรง ๆ (test/quick-open-filter.test.cjs)

// โฟลเดอร์ของโปรแกรมที่ไม่ใช่งานเขียน (สำเนา · ถังขยะ · ของที่มีแผงของตัวเองและเปิดเป็นข้อความดิบไม่มีประโยชน์)
export const QO_SKIP_DIRS = ['Snapshots', 'Backups', 'Recycle', 'node_modules', 'OnSet',
                             'Planners', 'FloorPlans', 'Branches', 'Plugins'];
const SKIP_LC = new Set(QO_SKIP_DIRS.map((d) => d.toLowerCase()));
/** โฟลเดอร์นี้ไม่ต้องลงไปสแกน — รวมโฟลเดอร์จุดนำ (`.k2history` · `.git`) ทุกตัว */
export const qoSkipDir = (name) => {
  const n = String(name || '');
  return !n || n.startsWith('.') || SKIP_LC.has(n.toLowerCase());
};

// ไฟล์ทะเบียน/ความลับของโปรแกรม — แก้มือผิดนิดเดียวโครงเรื่องพัง · ไม่ใช่สิ่งที่นักเขียน "เปิดด่วน"
const REGISTRY = new Set(['project.khn.json', 'draft.json', 'scenes.json', 'section.json', 'templates.json',
  'ai-key.json', 'timeline.json', 'maps.json', 'dictionary.json', 'roster.json', 'history.json', 'index.json']);
const WIKI_TOP = new Set(['wiki', 'bible']);

/**
 * ชนิดของไฟล์จากทางสัมพัทธ์ในโปรเจกต์ (คั่นด้วย `/`)
 * @returns {''|'scene'|'entity'|'text'|'other'} '' = ไม่โชว์
 */
export function qoKind(rel) {
  const parts = String(rel || '').split('/').filter(Boolean);
  if (!parts.length) return '';
  const name = parts[parts.length - 1];
  if (name.startsWith('.')) return '';
  if (parts.slice(0, -1).some(qoSkipDir)) return '';
  const lc = name.toLowerCase();
  if (REGISTRY.has(lc) || /\.unreadable-/.test(lc)) return '';
  const ext = lc.includes('.') ? lc.split('.').pop() : '';
  if (ext === 'md') return 'scene';
  if (ext === 'json') return WIKI_TOP.has(String(parts[0]).toLowerCase()) && parts.length > 1 ? 'entity' : 'text';
  if (ext === 'txt') return 'text';
  return 'other';
}

const RANK = { scene: 0, entity: 1, text: 2, other: 3 };
/** เรียงรายการตั้งต้น (ยังไม่พิมพ์อะไร): ฉาก/โน้ต → เอนทิตี้ → ข้อความ → อื่น ๆ · ในกลุ่มเรียงตามทาง */
export function qoSort(files) {
  return (files || []).slice().sort((a, b) =>
    (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9) || String(a.rel).localeCompare(String(b.rel)));
}
