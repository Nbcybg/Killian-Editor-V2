// Killian 2 — Electron main process
// เมนู + คีย์ลัดผูกที่ระดับ OS (accelerator) → ทำงานกับคีย์บอร์ดทุกภาษา รวมภาษาไทย
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const TEST = process.env.KILLIAN_TEST === '1';
let win = null;

function recentFile() { return path.join(app.getPath('userData'), 'recent.json'); }
function readRecent() {
  try { return JSON.parse(fs.readFileSync(recentFile(), 'utf-8')); } catch { return []; }
}
function pushRecent(p) {
  const r = [p, ...readRecent().filter((x) => x !== p)].slice(0, 8);
  try { fs.mkdirSync(path.dirname(recentFile()), { recursive: true });
        fs.writeFileSync(recentFile(), JSON.stringify(r)); } catch {}
  buildMenu();
}

const send = (ch, ...a) => win && win.webContents.send('menu', ch, ...a);

const isMac = process.platform === 'darwin';
const C = isMac ? '⌘' : 'Ctrl';
const S = 'Shift';

// ---- สถานะของรายการเมนูที่เป็น "สวิตช์" (ข้อ 3) ----
// เมนู native แสดงเครื่องหมายถูกเองเมื่อ type:'checkbox'/'radio' + checked
// renderer ส่งค่ามาที่ 'menu:toggles' ทุกครั้งที่สถานะเปลี่ยน แล้ว buildMenu() ใหม่
const toggles = {
  paperMode: true, readingMode: false, focusMode: false, typewriter: false,
  lineNumbers: false, splitView: false, format: 'prose',
  theme: 'dark', fabEnabled: true,          // [alpha.60r2 ข้อ 9 + 10]
  // alpha.57 — โหมดมุมมองบท (normal/draft/side/overview1/overview4) + สวิตช์ของเมนู "บท"
  spView: 'normal', showFormat: false, checkBeforeExport: true,
  // alpha.57a — เลขฉาก/เลขหน้า/เสียงพิมพ์
  sceneNumbers: false, pageNumbers: false, typeSound: false,
  // [alpha.58r บั๊ก 7] ค่าเริ่มต้นของ "ข้อความต่อเนื่อง" คือ "เปิด" (CONTINUED_DEFAULTS.enabled = true)
  // เดิมไม่มีคีย์นี้เลย → เมนูขึ้นเป็นไม่ติ๊กชั่วขณะจนกว่า renderer จะส่ง syncMenuToggles ครั้งแรก
  continueds: true,
  // [alpha.60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด — ค่าเริ่มต้น "เปิด" (ตรงกับ DEFAULT_SETTINGS)
  markdownCodes: true,
  // [alpha.61 ข้อ 1] ลำดับเปิดโปรแกรม — ทั้งคู่ปิดเป็นค่าเริ่มต้น = เข้าหน้าแรกก่อน
  openLastProject: false, showHomeAlways: false,
  // [alpha.61 ข้อ 4] สวิตช์ตัวพิมพ์ใหญ่/เล็กของบทหนัง (ค่าเริ่มต้น = ธรรมเนียมเดิม)
  spForceCase: true, spAutoCapitalize: true, spAutoCorrectI: true,
  panels: { 'tree-panel': true, 'props-panel': true, 'outline-panel': true },
};
// ตัวช่วยสร้างรายการสวิตช์ — ผู้ใช้เห็นชัดว่ากดแล้วเปิด/ปิด ไม่ใช่คำสั่งครั้งเดียว
const chk = (label, on, fn) => ({ label, type: 'checkbox', checked: !!on, click: fn });

function buildMenu() {
  const recents = readRecent().map((p) => ({
    label: p, click: () => send('open-project-path', p),
  }));
  const tpl = [
    { id: 'File', label: 'ไฟล์', submenu: [
      { label: `สร้างโปรเจกต์ใหม่… (${C}+N)`, click: () => send('new-project') },
      { label: `เปิดโปรเจกต์… (${C}+O)`, click: () => send('open-project') },
      { label: 'โปรเจกต์ล่าสุด', submenu: recents.length ? recents : [{ label: '(ว่าง)', enabled: false }] },
      // [alpha.61 ข้อ 1] เปิดโปรเจกต์ล่าสุดทันทีเมื่อเริ่มโปรแกรม (ข้ามหน้าแรก)
      chk('เปิดโปรเจกต์ล่าสุดเมื่อเริ่มโปรแกรม (ข้ามหน้าแรก)', toggles.openLastProject,
          () => send('toggle-open-last')),
      { type: 'separator' },
      { label: `บันทึก (${C}+S)`, click: () => send('save') },
      { label: `บันทึกทั้งหมด (${C}+${S}+S)`, click: () => send('save-all') },
      { label: 'บันทึกเป็น…', click: () => send('save-as') },
      { type: 'separator' },
      { label: `พิมพ์… (${C}+P)`, click: () => send('print') },
      { label: 'ส่งออกเป็น PDF…', click: () => send('export-pdf') },
      { label: 'ส่งออกฉบับร่างรวมเป็น .md…', click: () => send('export-draft') },
      { label: `ส่งออกด้วยเวิร์กโฟลว์… (${C}+${S}+E)`, click: () => send('compile') },
      { label: `ส่งออกเป็น HTML สำหรับบล็อก… (${C}+${S}+B)`, click: () => send('export-blog') },
      { label: 'ส่งออกทั้งโปรเจกต์เป็น .zip…', click: () => send('export-zip') },
      { label: 'ส่งออกทั้งโปรเจกต์เป็น .json…', click: () => send('export-json') },
      { type: 'separator' },
      { label: '🎬 ส่งออกบทเป็น Final Draft (.fdx)…', click: () => send('export-fdx') },
      { label: '🎬 ส่งออกบทเป็น Rich Text (.rtf)…', click: () => send('export-rtf') },
      { label: '💧 ส่งออก PDF ลายน้ำรายคน…', click: () => send('export-watermark') },
      // alpha.59 [69][87][89] — ตัวสร้าง PDF ในโปรแกรม (สารบัญ / เปิดที่หน้าเดิม / ฝังฟอนต์ไทย)
      { label: '🧾 ส่งออก PDF (ตัวสร้างในโปรแกรม — สารบัญ · หน้าปก)…',
        click: () => send('export-pdf-builtin') },
      { label: '📄 หน้าปก (Title Pages)…', click: () => send('title-pages') },
      { label: '📑 หัวกระดาษทุกหน้า (Page Headers)…', click: () => send('page-headers') },
      { type: 'separator' },
      { label: 'สร้างโปรเจกต์จากเทมเพลต…', click: () => send('new-from-template') },
      { label: 'นำเข้าจาก Scrivener (.scriv)…', click: () => send('import-scrivener') },
      { label: 'นำเข้าบทภาพยนตร์… (Fountain · FDX · Celtx · Fade In · Adobe Story)', click: () => send('import-script') }, // [alpha.60 ข้อ 62-66]
      { label: 'สำรองโปรเจกต์เดี๋ยวนี้', click: () => send('backup-now') },
      { type: 'separator' },
      { label: `ตั้งค่าโปรเจกต์… (${C}+,)`, click: () => send('settings') },
      { label: '🎞 ข้อมูลผลงาน (ผู้เขียน · ตัวแทน · ลิขสิทธิ์)…', click: () => send('project-setup') },
      { label: '📐 หน้ากระดาษ · ระยะขอบ · รูปแบบบท…', click: () => send('page-setup') },
      { label: '🔤 ฟอนต์ตามภาษา (ไทย/ละติน/อื่น ๆ)…', click: () => send('lang-fonts') },
      { label: 'ตั้งค่า AI…', click: () => send('ai-settings') },
      { label: 'จัดการสถานะฉาก…', click: () => send('custom-status') },
      { label: 'จัดการแท็บสี (Visual Tags)…', click: () => send('visual-tags') },
      { type: 'separator' },
      { label: `ปิดแท็บ (${C}+W)`, click: () => send('close-tab') },
      { label: `ปิดทุกแท็บ (${C}+${S}+W)`, click: () => send('close-all-tabs') },
      { type: 'separator' },
      { label: '↩ กลับไปเวอร์ชันล่าสุด (Revert)', click: () => send('revert') },
      { type: 'separator' },
      { role: 'quit', label: 'ออกจากโปรแกรม' },
    ] },
    { id: 'Edit', label: 'แก้ไข', submenu: [
      // role = ระบบปฏิบัติการจัดการเอง → ใช้ได้แม้แป้นพิมพ์อยู่ภาษาไทย
      { role: 'undo', label: `เลิกทำ (${C}+Z)` }, { role: 'redo', label: `ทำซ้ำ (${C}+Y)` },
      { type: 'separator' },
      { role: 'cut', label: `ตัด (${C}+X)` }, { role: 'copy', label: `คัดลอก (${C}+C)` },
      { role: 'paste', label: `วาง (${C}+V)` },
      // [alpha.61 ข้อ 3] วางแบบข้อความล้วน + ลบ — เดิมไม่มีทั้งคู่ (ผู้ใช้เจอเองว่า Ctrl+Shift+V ไม่ทำงาน)
      // ใช้ role ของ Electron → ทำงานทุกแป้นพิมพ์ รวมภาษาไทย (หลักเดียวกับ undo/redo)
      { role: 'pasteAndMatchStyle', label: `วางแบบข้อความล้วน (${C}+${S}+V)` },
      { role: 'delete', label: 'ลบ (Delete)' },
      { label: `ลบทั้งบรรทัด (${C}+${S}+Delete)`, click: () => send('delete-line') },
      { role: 'selectAll', label: `เลือกทั้งหมด (${C}+A)` },
      { type: 'separator' },
      { label: `ค้นหา… (${C}+F)`, click: () => send('find') },
      { type: 'separator' },
      { label: 'โน้ตด่วน…', click: () => send('quick-note') },
      { label: 'ดูโน้ตทั้งหมด…', click: () => send('all-notes') },
      { label: '💬 คอมเมนต์ในฉากนี้ (แผง)', click: () => send('comments') },
      { type: 'separator' },
      { label: 'ประวัติการตัดสินใจ…', click: () => send('player-history') },
    ] },
    { id: 'Format', label: 'รูปแบบ', submenu: [
      { label: 'โหมดเอกสาร', submenu: [
        { label: '📖 นิยาย', type: 'radio', checked: toggles.format !== 'screenplay',
          click: () => send('set-format', 'prose') },
        { label: '🎬 บทหนัง', type: 'radio', checked: toggles.format === 'screenplay',
          click: () => send('set-format', 'screenplay') },
        { type: 'separator' },
        { label: `สลับโหมด นิยาย ↔ บทหนัง (${C}+${S}+M)`, click: () => send('toggle-format') },
      ] },
      { type: 'separator' },
      { label: `ตัวหนา (${C}+B)`, click: () => send('fmt', 'bold') },
      { label: `ตัวเอียง (${C}+I)`, click: () => send('fmt', 'italic') },
      { label: `ขีดเส้นใต้ (${C}+U)`, click: () => send('fmt', 'underline') },
      { label: `ขีดฆ่า (${C}+${S}+X)`, click: () => send('fmt', 'strike') },
      { type: 'separator' },
      ...[1, 2, 3].map((n) => ({ label: `หัวข้อ ${n} (${C}+${n})`, click: () => send('fmt', 'heading', n) })),
      { label: `ข้อความปกติ (${C}+0)`, click: () => send('fmt', 'paragraph') },
      { label: `คำพูดยกมา`, click: () => send('fmt', 'quote') },
      { type: 'separator' },
      { label: `รายการหัวข้อย่อย (${C}+${S}+8)`, click: () => send('fmt', 'ul') },
      { label: `รายการตัวเลข (${C}+${S}+7)`, click: () => send('fmt', 'ol') },
      { label: `ล้างรูปแบบ (${C}+Space)`, click: () => send('fmt', 'clear') },
      { type: 'separator' },
      { label: 'จัดหน้า', submenu: [
        { label: `ชิดซ้าย (${C}+${S}+L)`, click: () => send('fmt', 'align', 'left') },
        { label: `กึ่งกลาง (${C}+${S}+K)`, click: () => send('fmt', 'align', 'center') },
        { label: `ชิดขวา (${C}+${S}+R)`, click: () => send('fmt', 'align', 'right') },
        { label: `เต็มบรรทัด (${C}+${S}+J)`, click: () => send('fmt', 'align', 'justify') },
      ] },
      { label: 'ซูม', submenu: [
        { label: `ขยาย (${C}+=)`, click: () => send('zoom', 1) },
        { label: `ย่อ (${C}+-)`, click: () => send('zoom', -1) },
        { label: `รีเซ็ตซูม (${C}+${S}+0)`, click: () => send('zoom', 0) },
        // alpha.58 (บั๊ก 3) — กระดาษ 8.5 นิ้วจริงกว้างกว่าพื้นที่ทำงาน โปรแกรมบทอื่นเปิดมาที่ fit width
        { label: 'พอดีความกว้างหน้ากระดาษ', click: () => send('zoom', 'fit') },
      ] },
      // [alpha.58r บั๊ก 15] มุมมองหน้ากระดาษใช้ได้กับนิยายด้วย — เดิมอยู่แต่ในเมนู "บท"
      { label: 'มุมมองหน้ากระดาษ', submenu: [
        { label: 'ปกติ (หน้ากระดาษ)', type: 'radio', checked: toggles.spView === 'normal',
          click: () => send('sp-view', 'normal') },
        { label: 'จัดหน้า — เห็นหน้าจริง (Layout)', type: 'radio', checked: toggles.spView === 'layout',
          click: () => send('sp-view', 'layout') },
        { label: 'ร่าง — ข้อความล้วน (Draft)', type: 'radio', checked: toggles.spView === 'draft',
          click: () => send('sp-view', 'draft') },
        { label: 'เรียงหน้าคู่ (Side-by-Side)', type: 'radio', checked: toggles.spView === 'side',
          click: () => send('sp-view', 'side') },
        { label: 'ภาพรวม 1px/ตัวอักษร', type: 'radio', checked: toggles.spView === 'overview1',
          click: () => send('sp-view', 'overview1') },
        { label: 'ภาพรวม 4px/ตัวอักษร', type: 'radio', checked: toggles.spView === 'overview4',
          click: () => send('sp-view', 'overview4') },
      ] },
      // [alpha.60r2 ข้อ 10] Ctrl+Shift+P ย้ายมาสลับธีมของโปรแกรม — โหมดหน้ากระดาษยังกดที่นี่/ปุ่ม 📄 ได้
      { label: `ธีม: สว่าง / มืด (${C}+${S}+P)`, submenu: [
        { label: 'มืด (Dark)', type: 'radio', checked: toggles.theme !== 'light',
          click: () => send('toggle-theme', 'dark') },
        { label: 'สว่าง (Light)', type: 'radio', checked: toggles.theme === 'light',
          click: () => send('toggle-theme', 'light') },
      ] },
      chk('โหมดหน้ากระดาษ', toggles.paperMode, () => send('paper-mode')),
      chk('แสดงเลขบรรทัด (รางซ้ายของแผง)', toggles.lineNumbers, () => send('line-numbers')),
      // [alpha.60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด (. @ > $shot $sub $in $act $intercut (( )) = # ! )
      chk('ซ่อนรหัสนำหน้าบรรทัด (. @ > $shot # …)', toggles.markdownCodes,
          () => send('markdown-codes')),
      // [alpha.60r2 ข้อ 9] ปุ่มลอยมุมขวาล่าง
      chk('ปุ่มลอยมุมขวาล่าง (FAB)', toggles.fabEnabled, () => send('toggle-fab')),
      { type: 'separator' },
      // [alpha.58r บั๊ก 16–24] รูปแบบของนิยาย (ย่อหน้า/ช่วงบรรทัด/หัวข้อ/ยกคำพูด/ฟอนต์)
      { label: '📖 รูปแบบนิยาย (ย่อหน้า · ช่วงบรรทัด · หัวข้อ)…', click: () => send('prose-setup') },
      // [alpha.58r บั๊ก 22] คนเขียนนิยายเห็นแต่เมนู "รูปแบบ" — ปุ่มหน้ากระดาษต้องอยู่ตรงนี้ด้วย
      { label: '📐 หน้ากระดาษ · ระยะขอบ…', click: () => send('page-setup') },
      { label: `📄 ไปที่หน้า/บท… (${C}+G)`, click: () => send('goto') },
      { type: 'separator' },
      // [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ของช่วงที่เลือก
      { label: 'รูปตัวพิมพ์ (Change Case)', submenu: [
        { label: 'Sentence case', click: () => send('text-case', 'SC') },
        { label: 'lower case', click: () => send('text-case', 'lc') },
        { label: 'UPPER CASE', click: () => send('text-case', 'UC') },
        { label: 'Capitalize Case', click: () => send('text-case', 'CC') },
        { label: 'aLtErNaTe cAsE', click: () => send('text-case', 'aC') },
        { label: 'Title Case', click: () => send('text-case', 'TC') },
        { label: 'iNVERSE cASE', click: () => send('text-case', 'iC') },
      ] },
      { type: 'separator' },
      { label: 'แทรกรูป…', click: () => send('insert-image') },
      { label: 'แทรกเส้นคั่น (---)', click: () => send('fmt', 'hr') },
      { label: 'บล็อกโค้ด', click: () => send('fmt', 'code') },
    ] },
    // ---- alpha.57: เมนูเฉพาะงานบทภาพยนตร์ ----
    { id: 'Script', label: 'บท', submenu: [
      { label: 'มุมมองบท', submenu: [
        { label: 'ปกติ (หน้ากระดาษ)', type: 'radio', checked: toggles.spView === 'normal',
          click: () => send('sp-view', 'normal') },
        { label: 'จัดหน้า — เห็นหน้าจริง (Layout)', type: 'radio', checked: toggles.spView === 'layout',
          click: () => send('sp-view', 'layout') },
        { label: 'ร่าง — ข้อความล้วน (Draft)', type: 'radio', checked: toggles.spView === 'draft',
          click: () => send('sp-view', 'draft') },
        { label: 'เรียงหน้าคู่ (Side-by-Side)', type: 'radio', checked: toggles.spView === 'side',
          click: () => send('sp-view', 'side') },
        { label: 'ภาพรวม 1px/ตัวอักษร', type: 'radio', checked: toggles.spView === 'overview1',
          click: () => send('sp-view', 'overview1') },
        { label: 'ภาพรวม 4px/ตัวอักษร', type: 'radio', checked: toggles.spView === 'overview4',
          click: () => send('sp-view', 'overview4') },
      ] },
      chk('แสดงรูปแบบ (เส้นขอบ element + เครื่องหมายจบบรรทัด)', toggles.showFormat,
          () => send('sp-show-format')),
      { type: 'separator' },
      // [alpha.61 ข้อ 4] ตัวพิมพ์ใหญ่/เล็ก — บทหนังเคยบังคับหลายจุด ตอนนี้ปิดได้ครบจากที่เดียว
      { label: '🔠 ตัวพิมพ์ใหญ่/เล็ก (ให้อิสระ)', submenu: [
        chk('บังคับพิมพ์ใหญ่ตามรูปแบบบทมาตรฐาน (หัวฉาก · ชื่อตัวละคร · ทรานซิชัน)',
            toggles.spForceCase, () => send('sp-force-case')),
        chk('แก้ตัวแรกของประโยคเป็นตัวใหญ่ให้อัตโนมัติ', toggles.spAutoCapitalize,
            () => send('sp-auto-capitalize')),
        chk("แก้ i เดี่ยว ๆ เป็น I ให้อัตโนมัติ", toggles.spAutoCorrectI,
            () => send('sp-auto-correct-i')),
        { type: 'separator' },
        // [alpha.62 บั๊ก 11] ปิดเป็นรายชนิดได้ — เดิมมีแต่สวิตช์ "ปิดทั้งบท" กับตารางรูปแบบที่ซ่อนอยู่
        // ในกล่องตั้งค่า → ผู้ใช้ที่อยากให้ "ชื่อตัวละคร" ตามที่พิมพ์ แต่หัวฉากยังเป็นตัวใหญ่ ทำไม่ได้เลย
        { label: 'บังคับตัวพิมพ์ใหญ่เฉพาะชนิด',
          submenu: (toggles.spCaps || []).map((c) =>
            chk(c.label, c.on, () => send('sp-element-caps', c.el))) },
        { type: 'separator' },
        { label: 'ตั้งพิมพ์ใหญ่รายบรรทัดเอง (ตารางรูปแบบ)…', click: () => send('page-setup') },
      ] },
      // alpha.58 [55][56] — ระบบต่อเนื่อง
      chk('ข้อความต่อเนื่อง (CONTINUED · MORE · cont\'d)', toggles.continueds,
          () => send('sp-continued')),
      { type: 'separator' },
      // alpha.58 [71][72][73] — รายงาน
      { label: '📍 รายงานสถานที่ (Location Report)…', click: () => send('sp-report', 'location') },
      { label: '👥 รายงานตัวละคร (Character Report)…', click: () => send('sp-report', 'character') },
      { label: '📊 กราฟบทพูดต่อหน้า (Dialogue Chart)…', click: () => send('sp-report', 'chart') },
      { type: 'separator' },
      // alpha.57a — เลขฉาก/เลขหน้า/ส่วนเสริม/SmartType
      chk('เลขฉาก (ข้างหัวฉากทั้งสองฝั่ง)', toggles.sceneNumbers, () => send('scene-numbers')),
      chk('เลขหน้า (ชิดขวาบนกระดาษ)', toggles.pageNumbers, () => send('page-numbers')),
      { label: 'ส่วนเสริมท้ายชื่อตัวละคร (V.O. · O.S. · cont\'d)…', click: () => send('sp-extension') },
      { label: '🧠 จัดการ SmartType (ลบคำที่จำผิด)…', click: () => send('smart-manage') },
      { type: 'separator' },
      // [alpha.58r บั๊ก 11] goto-page / goto-scene เคยมีแต่ case ใน handleCommand ไม่มีทางกด
      { label: `ไปที่หน้า/ฉาก… (${C}+G)`, click: () => send('goto') },
      { label: 'ไปที่หน้า…', click: () => send('goto', 'page') },
      { label: 'ไปที่ฉาก…', click: () => send('goto', 'scene') },
      { label: '⏮ ไปหน้าแรก', click: () => send('goto-page', 1) },
      { type: 'separator' },
      { label: `ตรวจหาข้อผิดพลาดถัดไป (${C}+${S}+U)`, click: () => send('sp-find-error') },
      { label: 'ตรวจทั้งบท (รายการข้อผิดพลาด)…', click: () => send('sp-check-all') },
      chk('ตรวจก่อนพิมพ์/ส่งออก', toggles.checkBeforeExport, () => send('sp-check-toggle')),
      { type: 'separator' },
      { label: '🎭 หน้ารายชื่อตัวละคร (Cast of Characters)…', click: () => send('roster') },
      // alpha.59 [90][91] — หน้าปกหลายหน้า + หัวกระดาษที่ซ้ำทุกหน้า
      { label: '📄 หน้าปก (Title Pages)…', click: () => send('title-pages') },
      { label: '📑 หัวกระดาษทุกหน้า (Page Headers)…', click: () => send('page-headers') },
      { label: '📐 หน้ากระดาษ · ระยะขอบ · รูปแบบบท…', click: () => send('page-setup') },
      { type: 'separator' },
      { label: '🎬 ส่งออกเป็น Final Draft (.fdx)…', click: () => send('export-fdx') },
      { label: '🎬 ส่งออกเป็น Rich Text (.rtf)…', click: () => send('export-rtf') },
      // alpha.59 [69][87][88][89] — PDF ที่เขียนเองด้วย pdf-lib
      { label: '🧾 ส่งออก PDF (สารบัญ · หน้าปก · เปิดที่หน้าเดิม)…',
        click: () => send('export-pdf-builtin') },
      { label: '💧 ส่งออก PDF ลายน้ำรายคน…', click: () => send('export-watermark') },
    ] },
    // [alpha.60 ข้อ 74] เมนู "เครื่องมือ"
    { id: 'Tools', label: 'เครื่องมือ', submenu: [
      { label: '📊 เปรียบเทียบบท / สคริปต์…', click: () => send('sp-compare') },
      { label: 'ตรวจหาคำซ้ำ · สถิติการใช้คำ (Word History)…', click: () => send('word-history') },
      // [alpha.60r2 ข้อ 13] frontmatter ของ .md = แหล่งความจริงของคุณสมบัติฉาก
      { label: '🔄 ซิงก์คุณสมบัติฉากจากไฟล์ .md (แก้ไฟล์นอกโปรแกรมแล้วใช้)',
        click: () => send('sync-scene-meta') },
      { type: 'separator' },
      // [alpha.60r3 ข้อ 4] ชุดเครื่องมือผู้แปล — ทำงานใน Excel/Sheets แล้วนำเข้ากลับ
      { label: '🌐 ส่งออกภาษาเป็น CSV (key · ไทย · อังกฤษ)…', click: () => send('export-language-csv') },
      { label: '🌐 นำเข้าภาษาจาก CSV…', click: () => send('import-language-csv') },
    ] },
    { id: 'View', label: 'มุมมอง', submenu: [
      // [alpha.61 ข้อ 1] หน้าแรก — เปิดเดี๋ยวนี้ + สวิตช์ "แสดงเสมอตอนเริ่มโปรแกรม"
      { label: '🏠 หน้าแรก (Home)', click: () => send('home') },
      chk('แสดงหน้าแรกเสมอเมื่อเริ่มโปรแกรม', toggles.showHomeAlways,
          () => send('toggle-home-always')),
      { type: 'separator' },
      { label: 'แดชบอร์ด', click: () => send('dashboard') },
      { label: 'จัดการเล่มและฉบับร่าง (Books)', click: () => send('books') },
      { label: 'เส้นเวลา (Timeline)', click: () => send('timeline') },
      { label: 'แผนที่ (Maps)', click: () => send('maps') },
      { label: 'Story Network (แผนผังความสัมพันธ์)', click: () => send('network') },
      { label: 'Planner (กระดานวางแผน)', click: () => send('planner') },
      { label: 'Kanban (กระดานตามสถานะ)', click: () => send('kanban') },
      // [alpha.60r3 ข้อ 5] แผงวิเคราะห์ด้วย AI (ตัวอย่างหน้าตา)
      { label: '🧠 AI วิเคราะห์ (จังหวะเรื่อง · ตัวละคร · คำซ้ำ)', click: () => send('ai-analyzer') },
      // [alpha.63] คลังรูปเป็นระบบอัลบั้มแล้ว — คำสั่งย่อยต้องมีทางกดจริง (บทเรียน 14b/46)
      { label: `🖼 คลังรูปภาพ (Gallery) (${C}+${S}+G)`, submenu: [
        { label: `เปิดคลังรูป (${C}+${S}+G)`, click: () => send('gallery') },
        { label: '＋ สร้างอัลบั้มใหม่…', click: () => send('gallery-new-album') },
        { label: '🎨 กระดานอารมณ์ (Mood Board) — เปิดเป็นแผงข้าง ๆ แล้วลากรูปมาวางได้', click: () => send('gallery-board') },
        { label: '🧹 รูปที่ยังไม่ถูกใช้', click: () => send('gallery-unused') },
        { label: '🔎 หารูปซ้ำในคลัง', click: () => send('gallery-dups') },
        { label: '📤 ส่งออกเฉพาะรูปที่ถูกใช้จริง…', click: () => send('gallery-export-used') },
      ] },
      { label: 'แยกหน้าจอ (Split View)', submenu: [
        chk(`แยกซ้าย-ขวา (${C}+${S}+\\)`, toggles.splitView === 'right', () => send('split-view', 'right')),
        chk('แยกบน-ล่าง', toggles.splitView === 'down', () => send('split-view', 'down')),
        { label: 'ยกเลิกแยกหน้าจอ', enabled: !!toggles.splitView, click: () => send('split-close') },
      ] },
      { label: 'ศูนย์รวม (Centralize — backlinks/สถิติสด)', click: () => send('centralize') },
      { label: 'ผังเรื่องแตกสาย (Branch Tree)', click: () => send('branching') },
      { label: '▶️ ทดลองเล่นเรื่องแตกสาย (Player Mode)', click: () => send('player-mode') },
      { label: 'สร้างทางเลือกจาก [ข้อความ] ในฉากนี้', click: () => send('branch-sync') },
      { label: 'ผังพื้นที่ (Floor Plan)', click: () => send('floorplan') },
      { label: 'สมุดโน้ตด่วน', click: () => send('toggle-panel', 'notes') },
      { type: 'separator' },
      { label: '🧹 ลบ element ตามประเภท…', click: () => send('remove-elements') },
      { label: '🔤 แผนที่อักขระพิเศษ…', click: () => send('char-map') },
      { label: '🎭 หน้ารายชื่อตัวละคร (Cast of Characters)…', click: () => send('roster') },
      { type: 'separator' },
      { label: `ค้นหาไฟล์ด่วน… (${C}+${S}+O)`, click: () => send('quick-open') },
      { label: `ค้นหาทั้งโปรเจกต์… (${C}+${S}+F)`, click: () => send('toggle-panel', 'search') },
      { type: 'separator' },
      { label: 'แผง', submenu: [
        // id แผงเปลี่ยนเป็นชื่อสั้นของ Panel System (tree/outline/props) — ฝั่ง renderer มี alias ให้ชื่อเดิมด้วย
        chk('โปรเจกต์ (Explorer)', toggles.panels['tree'], () => send('toggle-panel', 'tree')),
        chk('Navigation', toggles.panels['outline'], () => send('toggle-panel', 'outline')),
        chk('คุณสมบัติ', toggles.panels['props'], () => send('toggle-panel', 'props')),
        chk('หน้าแรก', toggles.panels['home'], () => send('toggle-panel', 'home')),
        chk('บันทึก (Log)', toggles.panels['log'], () => send('toggle-panel', 'log')),
        chk('คอมเมนต์', toggles.panels['comments'], () => send('toggle-panel', 'comments')),
        { type: 'separator' },
        // บั๊ก #18: 5 ฟีเจอร์นี้เป็นแผงแล้ว (เดิมเป็นแท็บแย่งที่กับเอกสาร)
        chk('แดชบอร์ด', toggles.panels['dashboard'], () => send('toggle-panel', 'dashboard')),
        chk('Kanban', toggles.panels['kanban'], () => send('toggle-panel', 'kanban')),
        chk('จัดการเล่ม', toggles.panels['books'], () => send('toggle-panel', 'books')),
        chk('เส้นเวลา', toggles.panels['timeline'], () => send('toggle-panel', 'timeline')),
        chk('แผนที่', toggles.panels['maps'], () => send('toggle-panel', 'maps')),
        // [alpha.60r1 ข้อ 21] คลังรูปย้ายจากแท็บมาเป็นแผงเช่นกัน
        chk(`คลังรูปภาพ (${C}+${S}+G)`, toggles.panels['gallery'], () => send('toggle-panel', 'gallery')),
        chk('🎨 กระดานอารมณ์', toggles.panels['gallery-board'], () => send('toggle-panel', 'gallery-board')),
        chk('🧠 AI วิเคราะห์', toggles.panels['ai-analyzer'], () => send('toggle-panel', 'ai-analyzer')),
        chk('💬 AI ผู้ช่วยเขียน', toggles.panels['ai-chat'], () => send('toggle-panel', 'ai-chat')),
        // [alpha.66 ข้อ 1+9] ผังแตกสาย + ทดลองเล่น เป็นแผงเต็มตัวแล้ว
        chk('🌿 ผังแตกสาย', toggles.panels['branch'], () => send('toggle-panel', 'branch')),
        chk('▶️ ทดลองเล่น', toggles.panels['player'], () => send('toggle-panel', 'player')),
        { type: 'separator' },
        { label: '📐 จัดการแผง (แสดง/ซ่อน)…', click: () => send('panel-system') },
        { label: 'รีเซ็ตการจัดวางแผงทั้งหมด', click: () => send('reset-panels') },
      ] },
      { type: 'separator' },
      chk('โหมดอ่าน (เต็มจอ)', toggles.readingMode, () => send('reading-mode')),
      chk(`โหมดโฟกัส (${C}+${S}+D)`, toggles.focusMode, () => send('focus-mode')),
      chk(`โหมดเครื่องพิมพ์ดีด (${C}+${S}+T)`, toggles.typewriter, () => send('typewriter')),
      chk('🔊 เสียงเครื่องพิมพ์ดีดขณะพิมพ์', toggles.typeSound, () => send('type-sound')),
      { type: 'separator' },
      // ห้ามใช้ role:'zoomIn'/'zoomOut'/'resetZoom' ของ Electron — เป็น zoom ระดับ webContents
      // ทั้งหน้าต่าง จะซ้อนทับกับซูมหน้ากระดาษ (--page-scale) และขนาด UI (--ui-scale) จนเพี้ยน
      { label: 'ขนาด UI (แถบเครื่องมือ/แผง/กล่อง)', submenu: [
        { label: 'ขยาย UI', click: () => send('ui-scale', 1) },
        { label: 'ย่อ UI', click: () => send('ui-scale', -1) },
        { label: 'ขนาด UI ปกติ (100%)', click: () => send('ui-scale', 0) },
      ] },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'เต็มจอ' },
      ...(TEST || process.env.KILLIAN_DEV ? [{ role: 'toggleDevTools' }] : []),
    ] },
    { id: 'Help', label: 'ช่วยเหลือ', submenu: [
      { label: 'บันทึกการเปลี่ยนแปลง (Changelog)', click: () => send('changelog') },
      { label: 'บันทึกการทำงานของโปรแกรม (Log)…', click: () => send('show-log') },
      { type: 'separator' },
      // [alpha.58r ข้อ 4] คอนโซลนักพัฒนา — อยู่ที่เดียวกับ "เกี่ยวกับ" + มีคีย์ลัด
      { label: `🛠 คอนโซลนักพัฒนา… (${C}+${S}+\`)`, click: () => send('dev-console') },
      { label: 'เปิด DevTools ของ Chromium', click: () => {
        try { win && win.webContents.toggleDevTools(); } catch {}
      } },
      { type: 'separator' },
      { label: 'เกี่ยวกับ Killian 2', click: () => send('about') },
    ] },
    { id: 'AI', label: 'AI', submenu: [
      { label: 'ตั้งค่า AI (ผู้ให้บริการ · Credential · โมเดล · พารามิเตอร์)…',
        click: () => send('ai-settings') },
      { type: 'separator' },
      // [alpha.61 ข้อ 2] แชทเป็นแผงแบบ opencode — เซสชันเก็บใน Sessions/ ของโปรเจกต์
      chk('💬 แผง AI ผู้ช่วยเขียน', toggles.panels['ai-chat'], () => send('toggle-panel', 'ai-chat')),
      { label: '➕ เซสชันแชทใหม่', click: () => send('ai-chat-new') },
      { type: 'separator' },
      { label: 'ผู้ช่วยเขียน (Expand/Summarize/Rewrite)…', click: () => send('ai-assistant') },
      { label: 'ตรวจสอบ Plot Hole…', click: () => send('ai-plot') },
      { label: 'สร้างบทสนทนา…', click: () => send('ai-dialogue') },
      { label: 'ตรวจสอบความสม่ำเสมอของตัวละคร…', click: () => send('ai-consistency') },
      { label: 'สร้างโลก (Worldbuilding)…', click: () => send('ai-world') },
      { label: 'แชทกับเรื่องของคุณ (กล่องเดิม)…', click: () => send('ai-chat-dialog') },
      { type: 'separator' },
      { label: 'สรุปเนื้อหาโปรเจกต์…', click: () => send('ai-summary') },
      { label: 'แนะนำชื่อเรื่อง…', click: () => send('ai-title') },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

let forceQuit = false;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640,
    backgroundColor: '#262624',
    frame: false,                                   // หน้าต่าง custom เต็มรูปแบบ
    webPreferences: { preload: path.join(__dirname, 'preload.js'),
                      contextIsolation: true, nodeIntegration: false,
                      // Chromium หรี่ตัวจับเวลาเมื่อหน้าต่างถูกบัง (หลัง 5 นาที เหลือ 1 ครั้ง/นาที)
                      // → บันทึกอัตโนมัติ/นับคำ/สำรองไฟล์ ค้างยาวเมื่อผู้ใช้สลับไปโปรแกรมอื่น
                      //   (และทำ e2e ที่รันหลังหน้าต่าง คลานจนเหมือนแขวน)
                      backgroundThrottling: false },
  });
  win.on('close', (e) => {
    if (!forceQuit) { e.preventDefault(); send('confirm-quit'); }
  });
  win.loadFile('renderer/index.html', TEST ? { search: 'k2test=1' } : {});
  if (TEST) win.webContents.on('console-message', (e, lv, msg, line, src) => {
    try { fs.appendFileSync('/tmp/k2console.txt', `${lv} ${src}:${line} ${msg}\n`); } catch {}
  });
  // คลิกขวา = เมนูมาตรฐาน word processor (role = ใช้ได้ทุกภาษาแป้นพิมพ์)
  win.webContents.on('context-menu', (e, params) => {
    const ef = params.editFlags || {};
    const inEdit = params.isEditable;
    if (!inEdit && !params.selectionText) return;  // นอกตัวแก้ไข → เมนูของ renderer เอง
    const menu = Menu.buildFromTemplate([
      { role: 'cut', label: 'ตัด', enabled: ef.canCut },
      { role: 'copy', label: 'คัดลอก', enabled: ef.canCopy },
      { role: 'paste', label: 'วาง', enabled: ef.canPaste },
      { role: 'selectAll', label: 'เลือกทั้งหมด' },
      { type: 'separator' },
      { label: `ตัวหนา (${C}+B)`, enabled: inEdit, click: () => send('fmt', 'bold') },
      { label: `ตัวเอียง (${C}+I)`, enabled: inEdit, click: () => send('fmt', 'italic') },
      { label: `ขีดเส้นใต้ (${C}+U)`, enabled: inEdit, click: () => send('fmt', 'underline') },
      { label: `ขีดฆ่า (${C}+${S}+X)`, enabled: inEdit, click: () => send('fmt', 'strike') },
      { label: `ล้างรูปแบบ (${C}+Space)`, enabled: inEdit, click: () => send('fmt', 'clear') },
      { type: 'separator' },
      { label: `เลิกทำ (${C}+Z)`, enabled: inEdit, click: () => send('editor-undo') },
      { label: `ทำซ้ำ (${C}+Y)`, enabled: inEdit, click: () => send('editor-redo') },
      { type: 'separator' },
      { label: 'แทรกรูป…', enabled: inEdit, click: () => send('insert-image') },
      { label: `ค้นหา… (${C}+F)`, click: () => send('find') },
      { type: 'separator' },
      { label: `บันทึก (${C}+S)`, click: () => send('save') },
    ]);
    menu.popup({ window: win });
  });
  buildMenu();
}

// ---------------- IPC: filesystem (ผ่าน main เท่านั้น — renderer ไม่แตะ fs ตรง) ----------------
const H = (name, fn) => ipcMain.handle(name, (e, ...a) => fn(...a));
H('fs:readFile', (p) => fs.readFileSync(p, 'utf-8'));
H('fs:writeFile', (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true });
                                 fs.writeFileSync(p, data, 'utf-8'); return true; });
H('fs:readJson', (p) => JSON.parse(fs.readFileSync(p, 'utf-8')));
H('fs:exists', (p) => fs.existsSync(p));
H('fs:listDirs', (p) => fs.readdirSync(p, { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name));
H('fs:listFiles', (p, ext) => fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true })
  .filter((d) => d.isFile() && (!ext || d.name.endsWith(ext))).map((d) => d.name) : []);
H('fs:mkdir', (p) => { fs.mkdirSync(p, { recursive: true }); return true; });
H('fs:move', (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true });
                             fs.renameSync(src, dst); return true; });
H('fs:remove', (p) => { fs.rmSync(p, { recursive: true, force: true }); return true; });
H('fs:isDir', (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
H('fs:mtime', (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } });
// [alpha.63] ขนาดไฟล์ + วันที่สร้าง — คลังรูปใช้แสดงเมทาดาทา/เรียงตามขนาด/นับพื้นที่รวม
H('fs:stat', (p) => {
  try {
    const s = fs.statSync(p);
    return { size: s.size, mtimeMs: s.mtimeMs, birthtimeMs: s.birthtimeMs || s.ctimeMs || 0,
             isDir: s.isDirectory() };
  } catch { return { size: 0, mtimeMs: 0, birthtimeMs: 0, isDir: false }; }
});
// เขียนรูปจากข้อมูล base64 (ใช้ตอนวาง/ลากรูปเข้าเอกสาร) — กันชื่อชนในโฟลเดอร์ปลายทาง
H('fs:writeImageData', (dstDir, name, base64) => {
  fs.mkdirSync(dstDir, { recursive: true });
  const ext = path.extname(name) || '.png';
  const stem = path.basename(name, ext) || 'image';
  let out = name, n = 1;
  while (fs.existsSync(path.join(dstDir, out))) out = `${stem}-${n++}${ext}`;
  fs.writeFileSync(path.join(dstDir, out), Buffer.from(base64, 'base64'));
  return out;
});

// เขียนไฟล์ไบนารีจาก byte array (ส่งออก .zip ฯลฯ) — renderer ส่ง Uint8Array มาทาง IPC
// สำคัญ: ห้ามส่งเป็น string แล้วเขียน utf-8 (ไบต์ ≥0x80 จะบวมเป็น multi-byte ไฟล์เสีย)
H('fs:writeBytes', (p, bytes) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(bytes));
  return true;
});
// คัดลอกไฟล์ตรง ๆ (รักษาไบนารี — ใช้ตอนสำรองโปรเจกต์ ซึ่งมีรูปภาพปนอยู่)
H('fs:copyFile', (src, dst) => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return true;
});
// อ่านไฟล์เป็นไบต์ (ใช้แพ็ก zip ให้รูปไม่เสีย)
H('fs:readBytes', (p) => Array.from(fs.readFileSync(p)));

// ---- ตรวจคำผิด: คลังคำหลัก (ไฟล์แยกใน assets/ ไม่ฝัง bundle) ----
const ASSETS = path.join(__dirname, 'renderer', 'assets');
H('spell:base', () => {
  const rd = (f) => { try { return fs.readFileSync(path.join(ASSETS, f), 'utf-8'); } catch { return ''; } };
  return { th: rd('dict_th.txt'), en: rd('dict_en.txt') };
});
// คำเสริมของโปรเจกต์: <root>/dictionary.json (personal) + <root>/Plugins/dictionaries/*.txt (ปลั๊กอิน)
H('spell:extra', (root) => {
  const words = new Set();
  try {
    const d = JSON.parse(fs.readFileSync(path.join(root, 'dictionary.json'), 'utf-8'));
    for (const w of d.words || []) if (String(w).trim()) words.add(String(w).trim());
  } catch {}
  const pdir = path.join(root, 'Plugins', 'dictionaries');
  try {
    for (const f of fs.readdirSync(pdir)) {
      if (!f.toLowerCase().endsWith('.txt')) continue;
      for (const w of fs.readFileSync(path.join(pdir, f), 'utf-8').split('\n')) {
        const s = w.trim(); if (s && !s.startsWith('#')) words.add(s);
      }
    }
  } catch {}
  return [...words];
});
// เพิ่มคำลงพจนานุกรมส่วนตัวของโปรเจกต์
H('spell:addWord', (root, word) => {
  const p = path.join(root, 'dictionary.json');
  let d = { words: [] };
  try { d = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
  const words = new Set((d.words || []).map(String));
  words.add(String(word).trim());
  fs.writeFileSync(p, JSON.stringify({ words: [...words].sort() }, null, 2), 'utf-8');
  return true;
});
// ดาวน์โหลดคลังคำ (auto-provision ถ้าไฟล์หาย / อัปเดตจาก URL) → เขียนลง assets/
H('spell:download', async (url, which) => {
  const dest = path.join(ASSETS, which === 'en' ? 'dict_en.txt' : 'dict_th.txt');
  const https = require('https');
  const text = await new Promise((resolve, reject) => {
    const get = (u, redirects = 0) => https.get(u, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5)
        return get(res.headers.location, redirects + 1);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      let buf = ''; res.setEncoding('utf-8');
      res.on('data', (c) => buf += c); res.on('end', () => resolve(buf));
    }).on('error', reject);
    get(url);
  });
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.writeFileSync(dest, text, 'utf-8');
  return text.split('\n').filter(Boolean).length;   // จำนวนคำที่ได้
});
// มีคลังคำหลักอยู่แล้วหรือไม่ (ใช้ตัดสินใจ auto-download)
H('spell:hasBase', () => {
  try { return fs.statSync(path.join(ASSETS, 'dict_th.txt')).size > 0; } catch { return false; }
});
H('fs:copyInto', (src, dstDir) => {
  fs.mkdirSync(dstDir, { recursive: true });
  let name = path.basename(src), n = 1;
  while (fs.existsSync(path.join(dstDir, name))) {
    const e = path.extname(src); name = path.basename(src, e) + '-' + n++ + e;
  }
  fs.copyFileSync(src, path.join(dstDir, name));
  return name;
});
H('path:join', (...a) => path.join(...a));
H('path:resolve', (...a) => path.resolve(...a));
H('path:relative', (a, b) => path.relative(a, b).split(path.sep).join('/'));
H('path:toFileURL', (p) => require('url').pathToFileURL(p).href);
H('shell:reveal', (p) => { try { shell.showItemInFolder(p); return true; } catch { return false; } });
// [alpha.62 บั๊ก 3] คัดลอกลงคลิปบอร์ดผ่าน main process
// `navigator.clipboard.writeText` ใน renderer ต้องการหน้าต่างที่ "โฟกัสอยู่" — หน้าต่างไร้ขอบ
// ที่เพิ่งถูกคลิกบนแผงลอย หรือหน้าต่างที่ถูกบัง จะโดนปฏิเสธเงียบ ๆ · ทางนี้ทำงานเสมอ
H('clipboard:write', (text) => {
  try { require('electron').clipboard.writeText(String(text ?? '')); return true; }
  catch { return false; }
});
H('clipboard:read', () => { try { return require('electron').clipboard.readText(); } catch { return ''; } });
H('dialog:openProject', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
H('dialog:openImage', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [
    { name: 'รูปภาพ', extensions: ['png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico', 'tif', 'tiff', 'heic', 'heif', 'apng'] }] });
  return r.canceled ? null : r.filePaths[0];
});
// ฟิลเตอร์ตามนามสกุลของชื่อไฟล์ที่เสนอ — เดิมบังคับ Markdown ทุกกรณี (ส่งออก HTML/JSON แล้วได้ .md)
const SAVE_FILTERS = {
  md: { name: 'Markdown', extensions: ['md'] },
  html: { name: 'HTML', extensions: ['html', 'htm'] },
  json: { name: 'JSON', extensions: ['json'] },
  txt: { name: 'ข้อความ', extensions: ['txt'] },
  zip: { name: 'ZIP', extensions: ['zip'] },
  // [alpha.66 ข้อ 10] ส่งออกผังแตกสายเป็นรูป
  svg: { name: 'ภาพเวกเตอร์ SVG', extensions: ['svg'] },
  png: { name: 'รูปภาพ PNG', extensions: ['png'] },
  // [alpha.60r3 ข้อ 4] ตารางคำแปลสำหรับผู้แปล (Excel / Google Sheets)
  csv: { name: 'ตาราง CSV', extensions: ['csv'] },
  fdx: { name: 'Final Draft', extensions: ['fdx'] },
  rtf: { name: 'Rich Text', extensions: ['rtf'] },
  // alpha.57a — นำเข้าไฟล์ฟอนต์เข้าโปรเจกต์ (ฟอนต์ตามภาษา)
  font: { name: 'ฟอนต์', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] },
  // [alpha.60 ข้อ 62-66] นำเข้าบทภาพยนตร์จาก 5 รูปแบบ
  fountain: { name: 'Fountain', extensions: ['fountain', 'txt'] },
  celtx: { name: 'Celtx', extensions: ['celtx'] },
  astx: { name: 'Adobe Story', extensions: ['astx'] },
  fadein: { name: 'Fade In Pro', extensions: ['fadein'] },
};
H('dialog:saveAs', async (defName, kind) => {
  const ext = String(defName || '').split('.').pop().toLowerCase();
  const f = SAVE_FILTERS[kind] || SAVE_FILTERS[ext] || SAVE_FILTERS.md;
  const r = await dialog.showSaveDialog(win, { defaultPath: defName,
    filters: [f, { name: 'ทุกไฟล์', extensions: ['*'] }] });
  return r.canceled ? null : r.filePath;
});
H('dialog:openFile', async (kind) => {
  const f = SAVE_FILTERS[kind] || SAVE_FILTERS.json;
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'],
    filters: [f, { name: 'ทุกไฟล์', extensions: ['*'] }] });
  return r.canceled ? null : r.filePaths[0];
});
// [alpha.60 ข้อ 62-66] เปิดไฟล์บทภาพยนตร์ — แสดงทุกรูปแบบพร้อมกัน
H('dialog:openScreenplay', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'],
    filters: [
      { name: 'บทภาพยนตร์ทุกฟอร์แมต (Fountain, FDX, Celtx, Adobe Story, Fade In Pro)',
        extensions: ['fountain', 'fdx', 'celtx', 'astx', 'fadein', 'txt'] },
      { name: 'ทุกไฟล์', extensions: ['*'] },
    ] });
  return r.canceled ? null : r.filePaths[0];
});
// [alpha.60 ข้อ 94] Global settings — เก็บใน userData/settings.json (ใช้ร่วมกันทุุกโปรเจกต์)
function globalSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}
H('settings:readGlobal', () => {
  try {
    const p = globalSettingsPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    return {};
  } catch { return {}; }
});
// [alpha.60r3 ข้อ 7] ปลั๊กอินระดับผู้ใช้ — %APPDATA%/Killian2/Plugins/ (ใช้ได้ทุกโปรเจกต์)
// คืน "path" ให้ renderer เดินต่อด้วย fs:* ที่มีอยู่แล้ว — ไม่ต้องเพิ่ม API อ่านไฟล์ชุดที่สอง
function globalPluginsDir() { return path.join(app.getPath('userData'), 'Plugins'); }
H('plugins:globalDir', () => {
  const p = globalPluginsDir();
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
  return p;
});
H('plugins:listGlobal', () => {
  try {
    return fs.readdirSync(globalPluginsDir(), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);
  } catch { return []; }
});
H('settings:writeGlobal', (obj) => {
  try {
    const p = globalSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
    return true;
  } catch { return false; }
});
H('dialog:savePdf', async (defName) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: defName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  return r.canceled ? null : r.filePath;
});
H('dialog:openDir', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
H('win:print', () => win.webContents.print({}, () => {}));
H('win:printToPdf', async (outPath) => {
  const data = await win.webContents.printToPDF({ printBackground: false, pageSize: 'A4' });
  fs.writeFileSync(outPath, data); return true;
});
// [70] สร้าง PDF จาก HTML ที่ renderer ประกอบมา (ลายน้ำรายคน) — ใช้หน้าต่างซ่อน
// เขียน HTML ลงไฟล์ชั่วคราวก่อนแล้ว loadFile: data: URL ยาวเกินขีดจำกัดเมื่อบทยาว
// และ @font-face ที่ชี้ไป file:// ต้องมี origin เป็นไฟล์จริงจึงโหลดฟอนต์ได้
H('pdf:fromHtml', async (html, outPath, opts = {}) => {
  const tmpDir = path.join(app.getPath('temp'), 'killian2-pdf');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, 'wm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.html');
  fs.writeFileSync(tmpFile, html, 'utf-8');
  // ห้ามใช้ offscreen:true — printToPDF บนหน้าต่าง offscreen ไม่เสถียรข้ามแพลตฟอร์ม
  const w = new BrowserWindow({ show: false, width: 900, height: 1200 });
  try {
    await w.loadFile(tmpFile);
    // รอฟอนต์ที่ฝังมา (@font-face file://) โหลดเสร็จก่อน ไม่งั้นได้ PDF ที่ตกไปฟอนต์สำรอง
    try {
      await w.webContents.executeJavaScript(
        'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true');
    } catch {}
    // ให้ `@page` ใน HTML (สร้างจาก sp-format → ขนาดกระดาษ+ระยะขอบชุดเดียวกับบนจอ) เป็นตัวกำหนด
    // อย่าส่ง pageSize เป็นตัวเลขเอง — หน่วยของ Electron เปลี่ยนไปมาระหว่างรุ่น (นิ้ว/ไมครอน)
    // ใส่ผิดหน่วยแล้วได้ "Failed to generate PDF: Printing failed" เฉย ๆ
    let data;
    try {
      data = await w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
    } catch (e) {
      // เผื่อ HTML ที่ส่งมาไม่มี @page — ถอยไปใช้ชื่อขนาดมาตรฐาน
      const h = +opts.height || 11;
      data = await w.webContents.printToPDF({
        printBackground: true,
        pageSize: Math.abs(h - 11.69) < 0.1 ? 'A4' : Math.abs(h - 14) < 0.1 ? 'Legal' : 'Letter',
        margins: { marginType: 'none' },
      });
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, data);
    return true;
  } finally {
    try { w.destroy(); } catch {}
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});
H('recent:push', (p) => { pushRecent(p); return true; });
H('recent:list', () => readRecent());
H('win:minimize', () => win.minimize());
H('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
H('win:close', () => win.close());
H('win:quitNow', () => { forceQuit = true; win.destroy(); app.quit(); });
// renderer แจ้งสถานะสวิตช์ล่าสุด → สร้างเมนูใหม่ให้เครื่องหมายถูกตรงกับของจริง (ข้อ 3)
H('menu:toggles', (patch) => {
  if (!patch || typeof patch !== 'object') return false;
  Object.assign(toggles, patch, { panels: { ...toggles.panels, ...(patch.panels || {}) } });
  buildMenu();
  return true;
});
ipcMain.handle('menu:popup', (e, label, x, y) => {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  // ปุ่มบนแถบชื่อส่ง id ที่คงที่ (File/Edit/…) — เทียบ id ก่อน แล้วค่อย label (กันเมนูเปลี่ยนภาษา)
  const item = menu.items.find((i) => i.id === label) || menu.items.find((i) => i.label === label);
  if (item && item.submenu) item.submenu.popup({ window: win, x: Math.round(x), y: Math.round(y) });
});
H('http:fetch', async (url, options) => {
  const res = await fetch(url, options || {});
  const body = await res.text();
  return { status: res.status, ok: res.ok, body };
});
// สตรีมคำตอบ AI ทีละบรรทัด (SSE/ndjson) — ส่งกลับ renderer ผ่าน channel เฉพาะของคำขอนั้น
H('http:stream', async (url, options, id) => {
  const ch = 'http:stream:' + id;
  try {
    const res = await fetch(url, options || {});
    if (!res.ok || !res.body) {
      let body = ''; try { body = await res.text(); } catch {}
      return { ok: false, status: res.status, body };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line && win) win.webContents.send(ch, line);
      }
    }
    if (buf.trim() && win) win.webContents.send(ch, buf.trim());
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, body: String((e && e.message) || e) };
  }
});
// สกรีนช็อตสำหรับ debug — ห้าม throw ทำให้ selftest ล้มทั้งชุด
// (capturePage ล้มได้เมื่อหน้าต่างถูกย่อ/compositor ไม่พร้อม — ไม่เกี่ยวกับฟีเจอร์ที่กำลังเทส)
H('test:shot', async (out) => {
  try {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(out, img.toPNG());
    return true;
  } catch (e) { return false; }
});

// ---- ระบบบันทึกการทำงาน (log) : เขียน append ลง <userData>/logs/app-YYYY-MM-DD.log ----
function logDir() { const d = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(d, { recursive: true }); return d; }
function logFile() {
  const d = new Date();
  const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return path.join(logDir(), 'app-' + day + '.log');
}
H('log:write', (line) => { try { fs.appendFileSync(logFile(), line + '\n'); } catch {} return true; });
H('log:read', (maxLines) => {
  try {
    const txt = fs.readFileSync(logFile(), 'utf-8');
    const lines = txt.split('\n').filter(Boolean);
    return lines.slice(-(maxLines || 500)).join('\n');
  } catch { return ''; }
});
H('app:dir', () => __dirname);
H('log:path', () => { try { return logFile(); } catch { return ''; } });
H('log:reveal', () => { try { require('electron').shell.showItemInFolder(logFile()); return true; } catch { return false; } });

app.whenReady().then(() => {
  createWindow();
  if (TEST) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        const p = JSON.stringify(process.env.KILLIAN_TEST_PROJECT || '');
        win.webContents.executeJavaScript('setTimeout(() => window.__k2test(' + p + '), 0); 1')
          .then((r) => require('fs').appendFileSync('/tmp/k2console.txt', 'K2EXEC ok ' + r + String.fromCharCode(10)))
          .catch((e) =>
          require('fs').appendFileSync('/tmp/k2console.txt', 'K2EXEC-ERR ' + e.message + String.fromCharCode(10)));
      }, 500);
    });
  }
});
app.on('window-all-closed', () => app.quit());
