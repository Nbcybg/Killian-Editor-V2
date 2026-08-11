// panel-sync.js — [alpha.68] ช่องส่ง "ฉากที่เปิดอยู่" ข้ามหน้าต่าง (tear-off เฟส 2)
//
// alpha.67 ฉีกได้เฉพาะแผงที่วาดตัวเองครบจากไฟล์โปรเจกต์ · แผงที่ผูกกับ "ฉากที่เปิดอยู่"
// (`state.active`) ฉีกไม่ได้ เพราะหน้าต่างลูกไม่มีแท็บเอกสาร — `state.active` เป็น null ตลอดกาล
//
// รอบนี้เพิ่มช่องเดียวที่แก้ปัญหานั้นทั้งชุด: หน้าต่างหลักประกาศ "ตอนนี้ฉากไหนเปิดอยู่"
// แล้วหน้าต่างลูกเอาไปประกอบเป็น **แท็บจำลอง** (`remoteTab`) วางที่ `state.active`
// โค้ดเดิมทุกบรรทัดที่อ่าน `state.active.file` (sceneCtx · คอมเมนต์ · ผังพื้นที่ · ขอบเขตของ AI)
// จึงทำงานได้ทันทีโดยไม่ต้องแก้ — ไม่มี editor ก็แค่ฟีเจอร์ที่ต้องใช้ตัวแก้ไขจริงปิดตัวลงเงียบ ๆ
//
// ไฟล์นี้ **บริสุทธิ์** (ไม่แตะ DOM/kapi/state) — รูปร่างข้อความและกฎทั้งหมดเทสด้วย node ได้
// การเชื่อมเข้าโปรแกรมอยู่ที่ app.js (broadcastActiveScene / handleSyncMessage)

/** แผงที่ต้องรู้ว่า "ตอนนี้ฉากไหนเปิดอยู่" จึงจะวาดถูก — ได้ข้อความใหม่เมื่อไหร่ต้องวาดใหม่ */
export const SCENE_PANELS = new Set(['outline', 'props', 'comments', 'floorplan', 'ai-chat']);

/** แผงที่เปิดให้ฉีกในรอบนี้ทั้งที่ **ไม่** ต้องรู้ฉาก (วาดจากไฟล์ล้วน ๆ — .67 กันไว้เกินจำเป็น) */
export const SCENE_FREE_PANELS = new Set(['player', 'ai-analyzer']);

/**
 * แผงที่ **เขียนไฟล์ของฉากที่หน้าต่างหลักเปิดค้างอยู่** — เฉพาะพวกนี้ที่ต้องล็อกอ่านอย่างเดียว
 * ตอนหน้าต่างหลักยังไม่บันทึก (Navigation อ่านอย่างเดียวอยู่แล้ว · AI ผู้ช่วยเขียนเขียนลง Sessions/)
 */
export const SCENE_WRITE_PANELS = new Set(['props', 'comments', 'floorplan']);
export function writesScene(id) { return SCENE_WRITE_PANELS.has(id); }

/** แผงที่รอบ alpha.68 เปิดให้ฉีกออกเป็นหน้าต่างเพิ่มจาก .67 */
export const PHASE2_PANELS = [...SCENE_PANELS, ...SCENE_FREE_PANELS];

export function needsScene(id) { return SCENE_PANELS.has(id); }
/** มีหน้าต่างแผงที่ต้องรู้ฉากเปิดอยู่ไหม — ใช้กันไม่ให้ broadcast ตอนไม่มีใครฟัง (ค่าใช้จ่าย 0) */
export function anyNeedsScene(ids) { return (ids || []).some(needsScene); }

/** ไฟล์นี้เป็น "ฉากในฉบับร่าง" ไหม (แท็บ Wiki/แดชบอร์ด/ผัง ไม่นับ) */
export function isSceneFile(file) {
  return typeof file === 'string' && /\.md$/i.test(file) && /[\\/]Chapters[\\/]/.test(file);
}

/**
 * แท็บของหน้าต่างหลัก → ข้อความ "ฉากที่เปิดอยู่"
 * ส่ง `dirty` ไปด้วยเสมอ เพราะหน้าต่างลูกใช้ตัดสินว่าจะให้แก้ไฟล์ได้ไหม (ดู canEditScene)
 */
export function sceneMsg(tab, extra = {}) {
  const file = tab && typeof tab.file === 'string' ? tab.file : '';
  const ok = isSceneFile(file);
  return {
    kind: 'active-scene',
    file: ok ? file : '',
    title: ok ? String((tab && tab.title) || '') : '',
    dirty: ok ? !!(tab && tab.dirty) : false,
    sp: ok ? !!(tab && tab.sp) : false,
    ...extra,
  };
}

/**
 * ข้อความ → แท็บจำลองสำหรับหน้าต่างแผง
 * **ไม่มี editor/sp/plain โดยตั้งใจ** — โค้ดที่ต้องใช้ตัวแก้ไขจริงเช็ค `t.editor` อยู่แล้ว
 * และจะตกไปทางที่ถูกต้องเอง (Navigation วาดจากรายการที่ส่งมา · สมอคอมเมนต์ไม่ไฮไลต์)
 */
export function remoteTab(msg) {
  if (!msg || !msg.file) return null;
  return {
    file: msg.file,
    title: msg.title || '',
    dirty: !!msg.dirty,
    spRemote: !!msg.sp,          // ไม่ตั้งชื่อ `sp` เพราะโค้ดเดิมถือว่า `t.sp` = อินสแตนซ์ SPEditor
    remote: true,                // ธงเดียวที่บอกว่า "แท็บนี้เป็นตัวแทน ไม่ใช่เอกสารจริง"
    meta: {},
  };
}

/** ฉากเปลี่ยนจริงไหม (กันวาดซ้ำเมื่อหน้าต่างหลักส่งข้อความเดิมซ้ำ ๆ ตอน markDirty) */
export function sceneChanged(prev, msg) {
  if (!msg) return false;
  if (!prev) return true;
  return prev.file !== msg.file || prev.title !== msg.title || !!prev.dirty !== !!msg.dirty;
}

/**
 * หน้าต่างแผงแก้ไฟล์ฉากนี้ได้ไหม
 *
 * กฎความเป็นเจ้าของของ .67 คือ "หน้าต่างหลักถือ project.khn.json · ลูกเขียนได้เฉพาะไฟล์ของแผงตัวเอง"
 * เฟส 2 ชนกฎนั้นตรง ๆ: คอมเมนต์กับคุณสมบัติฉาก **เขียนไฟล์ที่หน้าต่างหลักเปิดค้างอยู่**
 * ถ้าหน้าต่างหลักมีงานยังไม่บันทึก การบันทึกครั้งถัดไปที่นั่นจะทับของที่ลูกเพิ่งเขียนทันที
 * → ระหว่างที่ยังไม่บันทึก ลูกอ่านได้อย่างเดียว (ตัดปัญหาที่ต้นทาง ไม่ต้องมาไล่รวมไฟล์ทีหลัง)
 */
export function canEditScene(msg) { return !!(msg && msg.file) && !msg.dirty; }

/** ข้อความ Navigation (หัวข้อ/หัวฉากของฉากที่เปิดอยู่) — หน้าต่างหลักคำนวณให้ ลูกแค่วาด */
export function outlineMsg(file, title, items, opts = {}) {
  return {
    kind: 'outline',
    file: file || '',
    title: title || '',
    sp: !!opts.sp,                        // ไอคอนหน้าชื่อฉาก (🎬 บทหนัง · 📖 นิยาย)
    empty: opts.empty || '',              // ข้อความตอนไม่มีอะไรให้แสดง (หน้าต่างหลักรู้เหตุผลดีกว่า)
    items: (items || []).map((it) => ({
      kind: it.kind, label: it.label, lvl: it.lvl,
      pos: typeof it.pos === 'number' ? it.pos : null,
      line: typeof it.line === 'number' ? it.line : null,
    })),
  };
}

/** ลูกคลิกหัวข้อใน Navigation → ขอให้หน้าต่างหลักกระโดดไปตำแหน่งนั้นในเอกสารจริง */
export function gotoMsg(file, it) {
  return {
    kind: 'goto-outline', file: file || '',
    pos: it && typeof it.pos === 'number' ? it.pos : null,
    line: it && typeof it.line === 'number' ? it.line : null,
  };
}

/** ลูกเพิ่งบูตเสร็จ → ขอสถานะฉากปัจจุบัน (ไม่งั้นต้องรอจนกว่าผู้ใช้จะสลับแท็บที่หน้าต่างหลัก) */
export function wantSceneMsg(id) { return { kind: 'want-scene', id: id || '' }; }

/**
 * ไฟล์ที่เปลี่ยนกระทบแท็บที่เปิดอยู่ไหม (หน้าต่างหลักใช้ตัดสินว่าจะโหลดเนื้อไฟล์ใหม่)
 * เทียบแบบไม่สนตัวพิมพ์ใหญ่-เล็กและชนิดสแลช — path เดินทางข้ามหน้าต่างผ่าน IPC มาแล้ว
 */
export function samePath(a, b) {
  const norm = (s) => String(s || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return !!a && !!b && norm(a) === norm(b);
}

/**
 * แท็บที่ควร "โหลดเนื้อใหม่จากดิสก์" หลังหน้าต่างลูกแก้ไฟล์
 * แท็บที่ผู้ใช้ยังพิมพ์ค้าง (dirty) **ห้ามแตะ** — งานที่ยังไม่บันทึกสำคัญกว่าของที่ลูกเพิ่งเขียน
 * @param {Array<{file:string,dirty:boolean}>} tabs
 */
export function tabsToReload(tabs, changedPath) {
  if (!changedPath) return [];
  return (tabs || []).filter((t) => t && !t.dirty && samePath(t.file, changedPath));
}
