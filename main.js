// Killian 2 — Electron main process
// เมนู + คีย์ลัดผูกที่ระดับ OS (accelerator) → ทำงานกับคีย์บอร์ดทุกภาษา รวมภาษาไทย
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────
// [alpha.76] ข้อความในเมนู OS ก็ต้องแปลได้ — main เป็น CommonJS จึง import src/i18n.js ไม่ได้
// เลยมี T ตัวเล็ก ๆ ของตัวเอง แต่ **อ่านไฟล์ CSV ก้อนเดียวกัน** (k2_<code>.csv)
// รูปแบบเดียวกับฝั่ง renderer เป๊ะ: msgid = ประโยคไทยต้นฉบับ · {0},{1} = ค่าที่แทรก
// ─────────────────────────────────────────────────────────────────────
let LANG_TABLE = Object.create(null);
let LANG_CODE = '';
function T(strings, ...vals) {
  let id;
  if (typeof strings === 'string') id = strings;
  else { id = ''; for (let i = 0; i < strings.length; i++) { id += strings[i]; if (i < strings.length - 1) id += '{' + i + '}'; } }
  const tpl = LANG_TABLE[id] || id;
  if (!vals.length) return tpl.replace(/\{\{|\}\}/g, (m) => m[0]);
  return tpl.replace(/\{\{|\}\}|\{(\d+)\}/g, (m, d) => (m === '{{' || m === '}}') ? m[0] : (vals[+d] == null ? '' : String(vals[+d])));
}
/** โหลดตารางคำแปลของ main (เรียกซ้ำได้ — renderer สั่งตอนผู้ใช้เปลี่ยนภาษา แล้วสร้างเมนูใหม่) */
function loadLangTable(code) {
  try {
    const csv = langRead(code || LANG_CODE || 'th', '');
    if (!csv) return false;
    const t = Object.create(null);
    for (const r of parseCsvRows(csv)) {
      const k = r[0] == null ? '' : String(r[0]);
      if (!k || k.startsWith('#') || k.toLowerCase() === 'key') continue;
      const v = r[1] == null ? '' : String(r[1]);
      if (v !== '' && !(k in t)) t[k] = v;        // ชั้นแรก (ของโปรเจกต์) ชนะ — ดู csvToTable
    }
    LANG_TABLE = t; LANG_CODE = code || LANG_CODE;
    return true;
  } catch { return false; }
}
/** พาร์ส CSV (สเปกเดียวกับ src/i18n-csv.js — รับ quoted field ที่มี , " และขึ้นบรรทัดข้างใน) */
function parseCsvRows(text) {
  const s = String(text || '').replace(/^﻿/g, '').replace(/﻿/g, '');
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
    { id: 'File', label: T`ไฟล์`, submenu: [
      { label: T`สร้างโปรเจกต์ใหม่… (${C}+N)`, click: () => send('new-project') },
      { label: T`เปิดโปรเจกต์… (${C}+O)`, click: () => send('open-project') },
      { label: T`โปรเจกต์ล่าสุด`, submenu: recents.length ? recents : [{ label: T`(ว่าง)`, enabled: false }] },
      // [alpha.61 ข้อ 1] เปิดโปรเจกต์ล่าสุดทันทีเมื่อเริ่มโปรแกรม (ข้ามหน้าแรก)
      chk(T`เปิดโปรเจกต์ล่าสุดเมื่อเริ่มโปรแกรม (ข้ามหน้าแรก)`, toggles.openLastProject,
          () => send('toggle-open-last')),
      { type: 'separator' },
      { label: T`บันทึก (${C}+S)`, click: () => send('save') },
      { label: T`บันทึกทั้งหมด (${C}+${S}+S)`, click: () => send('save-all') },
      { label: T`บันทึกเป็น…`, click: () => send('save-as') },
      { type: 'separator' },
      { label: T`พิมพ์… (${C}+P)`, click: () => send('print') },
      { label: T`ส่งออกเป็น PDF…`, click: () => send('export-pdf') },
      { label: T`ส่งออกฉบับร่างรวมเป็น .md…`, click: () => send('export-draft') },
      { label: T`ส่งออกด้วยเวิร์กโฟลว์… (${C}+${S}+E)`, click: () => send('compile') },
      { label: T`ส่งออกเป็น HTML สำหรับบล็อก… (${C}+${S}+B)`, click: () => send('export-blog') },
      { label: T`ส่งออกทั้งโปรเจกต์เป็น .zip…`, click: () => send('export-zip') },
      { label: T`ส่งออกทั้งโปรเจกต์เป็น .json…`, click: () => send('export-json') },
      { type: 'separator' },
      { label: T`🎬 ส่งออกบทเป็น Final Draft (.fdx)…`, click: () => send('export-fdx') },
      { label: T`🎬 ส่งออกบทเป็น Rich Text (.rtf)…`, click: () => send('export-rtf') },
      { label: T`💧 ส่งออก PDF ลายน้ำรายคน…`, click: () => send('export-watermark') },
      // alpha.59 [69][87][89] — ตัวสร้าง PDF ในโปรแกรม (สารบัญ / เปิดที่หน้าเดิม / ฝังฟอนต์ไทย)
      { label: T`🧾 ส่งออก PDF (ตัวสร้างในโปรแกรม — สารบัญ · หน้าปก)…`,
        click: () => send('export-pdf-builtin') },
      { label: T`📄 หน้าปก (Title Pages)…`, click: () => send('title-pages') },
      { label: T`📑 หัวกระดาษทุกหน้า (Page Headers)…`, click: () => send('page-headers') },
      { type: 'separator' },
      { label: T`สร้างโปรเจกต์จากเทมเพลต…`, click: () => send('new-from-template') },
      { label: T`นำเข้าจาก Scrivener (.scriv)…`, click: () => send('import-scrivener') },
      { label: T`นำเข้าบทภาพยนตร์… (Fountain · FDX · Celtx · Fade In · Adobe Story)`, click: () => send('import-script') }, // [alpha.60 ข้อ 62-66]
      { label: T`สำรองโปรเจกต์เดี๋ยวนี้`, click: () => send('backup-now') },
      { type: 'separator' },
      { label: T`ตั้งค่าโปรเจกต์… (${C}+,)`, click: () => send('settings') },
      { label: T`🎞 ข้อมูลผลงาน (ผู้เขียน · ตัวแทน · ลิขสิทธิ์)…`, click: () => send('project-setup') },
      { label: T`📐 หน้ากระดาษ · ระยะขอบ · รูปแบบบท…`, click: () => send('page-setup') },
      { label: T`🔤 ฟอนต์ตามภาษา (ไทย/ละติน/อื่น ๆ)…`, click: () => send('lang-fonts') },
      { label: T`ตั้งค่า AI…`, click: () => send('ai-settings') },
      { label: T`จัดการสถานะฉาก…`, click: () => send('custom-status') },
      { label: T`จัดการแท็บสี (Visual Tags)…`, click: () => send('visual-tags') },
      { type: 'separator' },
      { label: T`ปิดแท็บ (${C}+W)`, click: () => send('close-tab') },
      { label: T`ปิดทุกแท็บ (${C}+${S}+W)`, click: () => send('close-all-tabs') },
      { type: 'separator' },
      { label: T`↩ กลับไปเวอร์ชันล่าสุด (Revert)`, click: () => send('revert') },
      { type: 'separator' },
      { role: 'quit', label: T`ออกจากโปรแกรม` },
    ] },
    { id: 'Edit', label: T`แก้ไข`, submenu: [
      // role = ระบบปฏิบัติการจัดการเอง → ใช้ได้แม้แป้นพิมพ์อยู่ภาษาไทย
      { role: 'undo', label: T`เลิกทำ (${C}+Z)` }, { role: 'redo', label: T`ทำซ้ำ (${C}+Y)` },
      { type: 'separator' },
      { role: 'cut', label: T`ตัด (${C}+X)` }, { role: 'copy', label: T`คัดลอก (${C}+C)` },
      { role: 'paste', label: T`วาง (${C}+V)` },
      // [alpha.61 ข้อ 3] วางแบบข้อความล้วน + ลบ — เดิมไม่มีทั้งคู่ (ผู้ใช้เจอเองว่า Ctrl+Shift+V ไม่ทำงาน)
      // ใช้ role ของ Electron → ทำงานทุกแป้นพิมพ์ รวมภาษาไทย (หลักเดียวกับ undo/redo)
      { role: 'pasteAndMatchStyle', label: T`วางแบบข้อความล้วน (${C}+${S}+V)` },
      { role: 'delete', label: T`ลบ (Delete)` },
      { label: T`ลบทั้งบรรทัด (${C}+${S}+Delete)`, click: () => send('delete-line') },
      { role: 'selectAll', label: T`เลือกทั้งหมด (${C}+A)` },
      { type: 'separator' },
      { label: T`ค้นหา… (${C}+F)`, click: () => send('find') },
      { type: 'separator' },
      { label: T`โน้ตด่วน…`, click: () => send('quick-note') },
      { label: T`ดูโน้ตทั้งหมด…`, click: () => send('all-notes') },
      { label: T`💬 คอมเมนต์ในฉากนี้ (แผง)`, click: () => send('comments') },
      { type: 'separator' },
      { label: T`ประวัติการตัดสินใจ…`, click: () => send('player-history') },
    ] },
    { id: 'Format', label: T`รูปแบบ`, submenu: [
      { label: T`โหมดเอกสาร`, submenu: [
        { label: T`📖 นิยาย`, type: 'radio', checked: toggles.format !== 'screenplay',
          click: () => send('set-format', 'prose') },
        { label: T`🎬 บทหนัง`, type: 'radio', checked: toggles.format === 'screenplay',
          click: () => send('set-format', 'screenplay') },
        { type: 'separator' },
        { label: T`สลับโหมด นิยาย ↔ บทหนัง (${C}+${S}+M)`, click: () => send('toggle-format') },
      ] },
      { type: 'separator' },
      { label: T`ตัวหนา (${C}+B)`, click: () => send('fmt', 'bold') },
      { label: T`ตัวเอียง (${C}+I)`, click: () => send('fmt', 'italic') },
      { label: T`ขีดเส้นใต้ (${C}+U)`, click: () => send('fmt', 'underline') },
      { label: T`ขีดฆ่า (${C}+${S}+X)`, click: () => send('fmt', 'strike') },
      { type: 'separator' },
      ...[1, 2, 3].map((n) => ({ label: T`หัวข้อ ${n} (${C}+${n})`, click: () => send('fmt', 'heading', n) })),
      { label: T`ข้อความปกติ (${C}+0)`, click: () => send('fmt', 'paragraph') },
      { label: T`คำพูดยกมา`, click: () => send('fmt', 'quote') },
      { type: 'separator' },
      { label: T`รายการหัวข้อย่อย (${C}+${S}+8)`, click: () => send('fmt', 'ul') },
      { label: T`รายการตัวเลข (${C}+${S}+7)`, click: () => send('fmt', 'ol') },
      { label: T`ล้างรูปแบบ (${C}+Space)`, click: () => send('fmt', 'clear') },
      { type: 'separator' },
      { label: T`จัดหน้า`, submenu: [
        { label: T`ชิดซ้าย (${C}+${S}+L)`, click: () => send('fmt', 'align', 'left') },
        { label: T`กึ่งกลาง (${C}+${S}+K)`, click: () => send('fmt', 'align', 'center') },
        { label: T`ชิดขวา (${C}+${S}+R)`, click: () => send('fmt', 'align', 'right') },
        { label: T`เต็มบรรทัด (${C}+${S}+J)`, click: () => send('fmt', 'align', 'justify') },
      ] },
      { label: T`ซูม`, submenu: [
        { label: T`ขยาย (${C}+=)`, click: () => send('zoom', 1) },
        { label: T`ย่อ (${C}+-)`, click: () => send('zoom', -1) },
        { label: T`รีเซ็ตซูม (${C}+${S}+0)`, click: () => send('zoom', 0) },
        // alpha.58 (บั๊ก 3) — กระดาษ 8.5 นิ้วจริงกว้างกว่าพื้นที่ทำงาน โปรแกรมบทอื่นเปิดมาที่ fit width
        { label: T`พอดีความกว้างหน้ากระดาษ`, click: () => send('zoom', 'fit') },
      ] },
      // [alpha.58r บั๊ก 15] มุมมองหน้ากระดาษใช้ได้กับนิยายด้วย — เดิมอยู่แต่ในเมนู "บท"
      { label: T`มุมมองหน้ากระดาษ`, submenu: [
        { label: T`ปกติ (หน้ากระดาษ)`, type: 'radio', checked: toggles.spView === 'normal',
          click: () => send('sp-view', 'normal') },
        { label: T`จัดหน้า — เห็นหน้าจริง (Layout)`, type: 'radio', checked: toggles.spView === 'layout',
          click: () => send('sp-view', 'layout') },
        { label: T`ร่าง — ข้อความล้วน (Draft)`, type: 'radio', checked: toggles.spView === 'draft',
          click: () => send('sp-view', 'draft') },
        { label: T`เรียงหน้าคู่ (Side-by-Side)`, type: 'radio', checked: toggles.spView === 'side',
          click: () => send('sp-view', 'side') },
        { label: T`ภาพรวม 1px/ตัวอักษร`, type: 'radio', checked: toggles.spView === 'overview1',
          click: () => send('sp-view', 'overview1') },
        { label: T`ภาพรวม 4px/ตัวอักษร`, type: 'radio', checked: toggles.spView === 'overview4',
          click: () => send('sp-view', 'overview4') },
      ] },
      // [alpha.60r2 ข้อ 10] Ctrl+Shift+P ย้ายมาสลับธีมของโปรแกรม — โหมดหน้ากระดาษยังกดที่นี่/ปุ่ม 📄 ได้
      { label: T`ธีม: สว่าง / มืด (${C}+${S}+P)`, submenu: [
        { label: T`มืด (Dark)`, type: 'radio', checked: toggles.theme !== 'light',
          click: () => send('toggle-theme', 'dark') },
        { label: T`สว่าง (Light)`, type: 'radio', checked: toggles.theme === 'light',
          click: () => send('toggle-theme', 'light') },
      ] },
      chk(T`โหมดหน้ากระดาษ`, toggles.paperMode, () => send('paper-mode')),
      chk(T`แสดงเลขบรรทัด (รางซ้ายของแผง)`, toggles.lineNumbers, () => send('line-numbers')),
      // [alpha.60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด (. @ > $shot $sub $in $act $intercut (( )) = # ! )
      chk(T`ซ่อนรหัสนำหน้าบรรทัด (. @ > $shot # …)`, toggles.markdownCodes,
          () => send('markdown-codes')),
      // [alpha.60r2 ข้อ 9] ปุ่มลอยมุมขวาล่าง
      chk(T`ปุ่มลอยมุมขวาล่าง (FAB)`, toggles.fabEnabled, () => send('toggle-fab')),
      { type: 'separator' },
      // [alpha.58r บั๊ก 16–24] รูปแบบของนิยาย (ย่อหน้า/ช่วงบรรทัด/หัวข้อ/ยกคำพูด/ฟอนต์)
      { label: T`📖 รูปแบบนิยาย (ย่อหน้า · ช่วงบรรทัด · หัวข้อ)…`, click: () => send('prose-setup') },
      // [alpha.58r บั๊ก 22] คนเขียนนิยายเห็นแต่เมนู "รูปแบบ" — ปุ่มหน้ากระดาษต้องอยู่ตรงนี้ด้วย
      { label: T`📐 หน้ากระดาษ · ระยะขอบ…`, click: () => send('page-setup') },
      { label: T`📄 ไปที่หน้า/บท… (${C}+G)`, click: () => send('goto') },
      { type: 'separator' },
      // [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ของช่วงที่เลือก
      { label: T`รูปตัวพิมพ์ (Change Case)`, submenu: [
        { label: 'Sentence case', click: () => send('text-case', 'SC') },
        { label: 'lower case', click: () => send('text-case', 'lc') },
        { label: 'UPPER CASE', click: () => send('text-case', 'UC') },
        { label: 'Capitalize Case', click: () => send('text-case', 'CC') },
        { label: 'aLtErNaTe cAsE', click: () => send('text-case', 'aC') },
        { label: 'Title Case', click: () => send('text-case', 'TC') },
        { label: 'iNVERSE cASE', click: () => send('text-case', 'iC') },
      ] },
      { type: 'separator' },
      { label: T`แทรกรูป…`, click: () => send('insert-image') },
      { label: T`แทรกเส้นคั่น (---)`, click: () => send('fmt', 'hr') },
      { label: T`บล็อกโค้ด`, click: () => send('fmt', 'code') },
    ] },
    // ---- alpha.57: เมนูเฉพาะงานบทภาพยนตร์ ----
    { id: 'Script', label: T`บท`, submenu: [
      { label: T`มุมมองบท`, submenu: [
        { label: T`ปกติ (หน้ากระดาษ)`, type: 'radio', checked: toggles.spView === 'normal',
          click: () => send('sp-view', 'normal') },
        { label: T`จัดหน้า — เห็นหน้าจริง (Layout)`, type: 'radio', checked: toggles.spView === 'layout',
          click: () => send('sp-view', 'layout') },
        { label: T`ร่าง — ข้อความล้วน (Draft)`, type: 'radio', checked: toggles.spView === 'draft',
          click: () => send('sp-view', 'draft') },
        { label: T`เรียงหน้าคู่ (Side-by-Side)`, type: 'radio', checked: toggles.spView === 'side',
          click: () => send('sp-view', 'side') },
        { label: T`ภาพรวม 1px/ตัวอักษร`, type: 'radio', checked: toggles.spView === 'overview1',
          click: () => send('sp-view', 'overview1') },
        { label: T`ภาพรวม 4px/ตัวอักษร`, type: 'radio', checked: toggles.spView === 'overview4',
          click: () => send('sp-view', 'overview4') },
      ] },
      chk(T`แสดงรูปแบบ (เส้นขอบ element + เครื่องหมายจบบรรทัด)`, toggles.showFormat,
          () => send('sp-show-format')),
      { type: 'separator' },
      // [alpha.61 ข้อ 4] ตัวพิมพ์ใหญ่/เล็ก — บทหนังเคยบังคับหลายจุด ตอนนี้ปิดได้ครบจากที่เดียว
      { label: T`🔠 ตัวพิมพ์ใหญ่/เล็ก (ให้อิสระ)`, submenu: [
        chk(T`บังคับพิมพ์ใหญ่ตามรูปแบบบทมาตรฐาน (หัวฉาก · ชื่อตัวละคร · ทรานซิชัน)`,
            toggles.spForceCase, () => send('sp-force-case')),
        chk(T`แก้ตัวแรกของประโยคเป็นตัวใหญ่ให้อัตโนมัติ`, toggles.spAutoCapitalize,
            () => send('sp-auto-capitalize')),
        chk(T`แก้ i เดี่ยว ๆ เป็น I ให้อัตโนมัติ`, toggles.spAutoCorrectI,
            () => send('sp-auto-correct-i')),
        { type: 'separator' },
        // [alpha.62 บั๊ก 11] ปิดเป็นรายชนิดได้ — เดิมมีแต่สวิตช์ "ปิดทั้งบท" กับตารางรูปแบบที่ซ่อนอยู่
        // ในกล่องตั้งค่า → ผู้ใช้ที่อยากให้ "ชื่อตัวละคร" ตามที่พิมพ์ แต่หัวฉากยังเป็นตัวใหญ่ ทำไม่ได้เลย
        { label: T`บังคับตัวพิมพ์ใหญ่เฉพาะชนิด`,
          submenu: (toggles.spCaps || []).map((c) =>
            chk(c.label, c.on, () => send('sp-element-caps', c.el))) },
        { type: 'separator' },
        { label: T`ตั้งพิมพ์ใหญ่รายบรรทัดเอง (ตารางรูปแบบ)…`, click: () => send('page-setup') },
      ] },
      // alpha.58 [55][56] — ระบบต่อเนื่อง
      chk(T`ข้อความต่อเนื่อง (CONTINUED · MORE · cont'd)`, toggles.continueds,
          () => send('sp-continued')),
      { type: 'separator' },
      // alpha.58 [71][72][73] — รายงาน
      { label: T`📍 รายงานสถานที่ (Location Report)…`, click: () => send('sp-report', 'location') },
      { label: T`👥 รายงานตัวละคร (Character Report)…`, click: () => send('sp-report', 'character') },
      { label: T`📊 กราฟบทพูดต่อหน้า (Dialogue Chart)…`, click: () => send('sp-report', 'chart') },
      { type: 'separator' },
      // alpha.57a — เลขฉาก/เลขหน้า/ส่วนเสริม/SmartType
      chk(T`เลขฉาก (ข้างหัวฉากทั้งสองฝั่ง)`, toggles.sceneNumbers, () => send('scene-numbers')),
      chk(T`เลขหน้า (ชิดขวาบนกระดาษ)`, toggles.pageNumbers, () => send('page-numbers')),
      { label: T`ส่วนเสริมท้ายชื่อตัวละคร (V.O. · O.S. · cont'd)…`, click: () => send('sp-extension') },
      { label: T`🧠 จัดการ SmartType (ลบคำที่จำผิด)…`, click: () => send('smart-manage') },
      { type: 'separator' },
      // [alpha.58r บั๊ก 11] goto-page / goto-scene เคยมีแต่ case ใน handleCommand ไม่มีทางกด
      { label: T`ไปที่หน้า/ฉาก… (${C}+G)`, click: () => send('goto') },
      { label: T`ไปที่หน้า…`, click: () => send('goto', 'page') },
      { label: T`ไปที่ฉาก…`, click: () => send('goto', 'scene') },
      { label: T`⏮ ไปหน้าแรก`, click: () => send('goto-page', 1) },
      { type: 'separator' },
      { label: T`ตรวจหาข้อผิดพลาดถัดไป (${C}+${S}+U)`, click: () => send('sp-find-error') },
      { label: T`ตรวจทั้งบท (รายการข้อผิดพลาด)…`, click: () => send('sp-check-all') },
      chk(T`ตรวจก่อนพิมพ์/ส่งออก`, toggles.checkBeforeExport, () => send('sp-check-toggle')),
      { type: 'separator' },
      { label: T`🎭 หน้ารายชื่อตัวละคร (Cast of Characters)…`, click: () => send('roster') },
      // alpha.59 [90][91] — หน้าปกหลายหน้า + หัวกระดาษที่ซ้ำทุกหน้า
      { label: T`📄 หน้าปก (Title Pages)…`, click: () => send('title-pages') },
      { label: T`📑 หัวกระดาษทุกหน้า (Page Headers)…`, click: () => send('page-headers') },
      { label: T`📐 หน้ากระดาษ · ระยะขอบ · รูปแบบบท…`, click: () => send('page-setup') },
      { type: 'separator' },
      { label: T`🎬 ส่งออกเป็น Final Draft (.fdx)…`, click: () => send('export-fdx') },
      { label: T`🎬 ส่งออกเป็น Rich Text (.rtf)…`, click: () => send('export-rtf') },
      // alpha.59 [69][87][88][89] — PDF ที่เขียนเองด้วย pdf-lib
      { label: T`🧾 ส่งออก PDF (สารบัญ · หน้าปก · เปิดที่หน้าเดิม)…`,
        click: () => send('export-pdf-builtin') },
      { label: T`💧 ส่งออก PDF ลายน้ำรายคน…`, click: () => send('export-watermark') },
    ] },
    // [alpha.60 ข้อ 74] เมนู "เครื่องมือ"
    { id: 'Tools', label: T`เครื่องมือ`, submenu: [
      { label: T`📊 เปรียบเทียบบท / สคริปต์…`, click: () => send('sp-compare') },
      { label: T`ตรวจหาคำซ้ำ · สถิติการใช้คำ (Word History)…`, click: () => send('word-history') },
      // [alpha.60r2 ข้อ 13] frontmatter ของ .md = แหล่งความจริงของคุณสมบัติฉาก
      { label: T`🔄 ซิงก์คุณสมบัติฉากจากไฟล์ .md (แก้ไฟล์นอกโปรแกรมแล้วใช้)`,
        click: () => send('sync-scene-meta') },
      { type: 'separator' },
      // [alpha.60r3 ข้อ 4] ชุดเครื่องมือผู้แปล — ทำงานใน Excel/Sheets แล้วนำเข้ากลับ
      { label: T`🌐 ส่งออกภาษาเป็น CSV (key · ไทย · อังกฤษ)…`, click: () => send('export-language-csv') },
      { label: T`🌐 นำเข้าภาษาจาก CSV…`, click: () => send('import-language-csv') },
    ] },
    { id: 'View', label: T`มุมมอง`, submenu: [
      // [alpha.61 ข้อ 1] หน้าแรก — เปิดเดี๋ยวนี้ + สวิตช์ "แสดงเสมอตอนเริ่มโปรแกรม"
      { label: T`🏠 หน้าแรก (Home)`, click: () => send('home') },
      chk(T`แสดงหน้าแรกเสมอเมื่อเริ่มโปรแกรม`, toggles.showHomeAlways,
          () => send('toggle-home-always')),
      { type: 'separator' },
      { label: T`แดชบอร์ด`, click: () => send('dashboard') },
      { label: T`จัดการเล่มและฉบับร่าง (Books)`, click: () => send('books') },
      { label: T`เส้นเวลา (Timeline)`, click: () => send('timeline') },
      { label: T`แผนที่ (Maps)`, click: () => send('maps') },
      { label: T`Story Network (แผนผังความสัมพันธ์)`, click: () => send('network') },
      { label: T`Planner (กระดานวางแผน)`, click: () => send('planner') },
      { label: T`Kanban (กระดานตามสถานะ)`, click: () => send('kanban') },
      // [alpha.60r3 ข้อ 5] แผงวิเคราะห์ด้วย AI (ตัวอย่างหน้าตา)
      { label: T`🧠 AI วิเคราะห์ (จังหวะเรื่อง · ตัวละคร · คำซ้ำ)`, click: () => send('ai-analyzer') },
      // [alpha.63] คลังรูปเป็นระบบอัลบั้มแล้ว — คำสั่งย่อยต้องมีทางกดจริง (บทเรียน 14b/46)
      { label: T`🖼 คลังรูปภาพ (Gallery) (${C}+${S}+G)`, submenu: [
        { label: T`เปิดคลังรูป (${C}+${S}+G)`, click: () => send('gallery') },
        { label: T`＋ สร้างอัลบั้มใหม่…`, click: () => send('gallery-new-album') },
        { label: T`🎨 กระดานอารมณ์ (Mood Board) — เปิดเป็นแผงข้าง ๆ แล้วลากรูปมาวางได้`, click: () => send('gallery-board') },
        { label: T`🧹 รูปที่ยังไม่ถูกใช้`, click: () => send('gallery-unused') },
        { label: T`🔎 หารูปซ้ำในคลัง`, click: () => send('gallery-dups') },
        { label: T`📤 ส่งออกเฉพาะรูปที่ถูกใช้จริง…`, click: () => send('gallery-export-used') },
      ] },
      { label: T`แยกหน้าจอ (Split View)`, submenu: [
        chk(T`แยกซ้าย-ขวา (${C}+${S}+\\)`, toggles.splitView === 'right', () => send('split-view', 'right')),
        chk(T`แยกบน-ล่าง`, toggles.splitView === 'down', () => send('split-view', 'down')),
        { label: T`ยกเลิกแยกหน้าจอ`, enabled: !!toggles.splitView, click: () => send('split-close') },
      ] },
      { label: T`ศูนย์รวม (Centralize — backlinks/สถิติสด)`, click: () => send('centralize') },
      { label: T`ผังเรื่องแตกสาย (Branch Tree)`, click: () => send('branching') },
      { label: T`▶️ ทดลองเล่นเรื่องแตกสาย (Player Mode)`, click: () => send('player-mode') },
      { label: T`สร้างทางเลือกจาก [ข้อความ] ในฉากนี้`, click: () => send('branch-sync') },
      { label: T`ผังพื้นที่ (Floor Plan)`, click: () => send('floorplan') },
      { label: T`สมุดโน้ตด่วน`, click: () => send('toggle-panel', 'notes') },
      { type: 'separator' },
      { label: T`🧹 ลบ element ตามประเภท…`, click: () => send('remove-elements') },
      { label: T`🔤 แผนที่อักขระพิเศษ…`, click: () => send('char-map') },
      { label: T`🎭 หน้ารายชื่อตัวละคร (Cast of Characters)…`, click: () => send('roster') },
      { type: 'separator' },
      { label: T`ค้นหาไฟล์ด่วน… (${C}+${S}+O)`, click: () => send('quick-open') },
      { label: T`ค้นหาทั้งโปรเจกต์… (${C}+${S}+F)`, click: () => send('toggle-panel', 'search') },
      { type: 'separator' },
      { label: T`แผง`, submenu: [
        // [alpha.69] สร้างจาก MENU_PANELS ตัวเดียว (ดูด้านบนสุดของไฟล์) — เดิมเขียนเรียงมือทีละบรรทัด
        // แล้วเพิ่มแผงใหม่ทีไรก็ลืมมาเติม ผู้ใช้เลยหาไม่เจอ (เจอมาแล้วรอบ .69: Codex/History/Record
        // และก่อนหน้านั้น Story Network/Planner/ผังพื้นที่ ก็ตกหล่นมาตลอด)
        // e2e เทียบรายการนี้กับ PANEL_DEFS ทุกรอบ → ลืมเมื่อไหร่เทสแดงทันที
        ...MENU_PANELS.map((p) => (p.sep
          ? { type: 'separator' }
          : chk(typeof p.label === 'function' ? p.label(C, S) : p.label,
                toggles.panels[p.id], () => send('toggle-panel', p.id)))),
        { type: 'separator' },
        { label: T`📐 จัดการแผง (แสดง/ซ่อน)…`, click: () => send('panel-system') },
        { label: T`📤 ส่งออกการจัดวางแผง (JSON)…`, click: () => send('export-panel-layout') },
        { label: T`รีเซ็ตการจัดวางแผงทั้งหมด`, click: () => send('reset-panels') },
      ] },
      // [alpha.66r3] ระบบจัดการพื้นที่ + เวิร์กสเปซ (สเปกระบบแผงแบบ Photoshop)
      { label: T`จัดพื้นที่ทำงาน`, submenu: [
        { label: T`⬒ ซ่อน/แสดงแผงทั้งหมด (${C}+\\)`, click: () => send('panels-hide-all') },
        { label: T`⬓ ซ่อนแผงฝั่งขวา (${C}+${S}+[)`, click: () => send('panels-hide-right') },
        { label: T`◨ ซ่อนแผงฝั่งซ้าย`, click: () => send('panels-hide-left') },
        { type: 'separator' },
        { label: T`🗂 เวิร์กสเปซ… (${C}+${S}+Y)`, click: () => send('workspace-menu') },
      ] },
      { type: 'separator' },
      chk(T`โหมดอ่าน (เต็มจอ)`, toggles.readingMode, () => send('reading-mode')),
      chk(T`โหมดโฟกัส (${C}+${S}+D)`, toggles.focusMode, () => send('focus-mode')),
      chk(T`โหมดเครื่องพิมพ์ดีด (${C}+${S}+T)`, toggles.typewriter, () => send('typewriter')),
      chk(T`🔊 เสียงเครื่องพิมพ์ดีดขณะพิมพ์`, toggles.typeSound, () => send('type-sound')),
      { type: 'separator' },
      // ห้ามใช้ role:'zoomIn'/'zoomOut'/'resetZoom' ของ Electron — เป็น zoom ระดับ webContents
      // ทั้งหน้าต่าง จะซ้อนทับกับซูมหน้ากระดาษ (--page-scale) และขนาด UI (--ui-scale) จนเพี้ยน
      { label: T`ขนาด UI (แถบเครื่องมือ/แผง/กล่อง)`, submenu: [
        { label: T`ขยาย UI`, click: () => send('ui-scale', 1) },
        { label: T`ย่อ UI`, click: () => send('ui-scale', -1) },
        { label: T`ขนาด UI ปกติ (100%)`, click: () => send('ui-scale', 0) },
      ] },
      { type: 'separator' },
      { role: 'togglefullscreen', label: T`เต็มจอ` },
      ...(TEST || process.env.KILLIAN_DEV ? [{ role: 'toggleDevTools' }] : []),
    ] },
    { id: 'Help', label: T`ช่วยเหลือ`, submenu: [
      { label: T`บันทึกการเปลี่ยนแปลง (Changelog)`, click: () => send('changelog') },
      { label: T`บันทึกการทำงานของโปรแกรม (Log)…`, click: () => send('show-log') },
      { type: 'separator' },
      // [alpha.58r ข้อ 4] คอนโซลนักพัฒนา — อยู่ที่เดียวกับ "เกี่ยวกับ" + มีคีย์ลัด
      { label: T`🛠 คอนโซลนักพัฒนา… (${C}+${S}+\`)`, click: () => send('dev-console') },
      { label: T`เปิด DevTools ของ Chromium`, click: () => {
        try { win && win.webContents.toggleDevTools(); } catch {}
      } },
      { type: 'separator' },
      { label: T`เกี่ยวกับ Killian 2`, click: () => send('about') },
    ] },
    { id: 'AI', label: 'AI', submenu: [
      { label: T`ตั้งค่า AI (ผู้ให้บริการ · Credential · โมเดล · พารามิเตอร์)…`,
        click: () => send('ai-settings') },
      { type: 'separator' },
      // [alpha.61 ข้อ 2] แชทเป็นแผงแบบ opencode — เซสชันเก็บใน Sessions/ ของโปรเจกต์
      chk(T`💬 แผง AI ผู้ช่วยเขียน`, toggles.panels['ai-chat'], () => send('toggle-panel', 'ai-chat')),
      { label: T`➕ เซสชันแชทใหม่`, click: () => send('ai-chat-new') },
      { type: 'separator' },
      { label: T`ผู้ช่วยเขียน (Expand/Summarize/Rewrite)…`, click: () => send('ai-assistant') },
      { label: T`ตรวจสอบ Plot Hole…`, click: () => send('ai-plot') },
      { label: T`สร้างบทสนทนา…`, click: () => send('ai-dialogue') },
      { label: T`ตรวจสอบความสม่ำเสมอของตัวละคร…`, click: () => send('ai-consistency') },
      { label: T`สร้างโลก (Worldbuilding)…`, click: () => send('ai-world') },
      { label: T`แชทกับเรื่องของคุณ (กล่องเดิม)…`, click: () => send('ai-chat-dialog') },
      { type: 'separator' },
      { label: T`สรุปเนื้อหาโปรเจกต์…`, click: () => send('ai-summary') },
      { label: T`แนะนำชื่อเรื่อง…`, click: () => send('ai-title') },
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
      { role: 'cut', label: T`ตัด`, enabled: ef.canCut },
      { role: 'copy', label: T`คัดลอก`, enabled: ef.canCopy },
      { role: 'paste', label: T`วาง`, enabled: ef.canPaste },
      { role: 'selectAll', label: T`เลือกทั้งหมด` },
      { type: 'separator' },
      { label: T`ตัวหนา (${C}+B)`, enabled: inEdit, click: () => send('fmt', 'bold') },
      { label: T`ตัวเอียง (${C}+I)`, enabled: inEdit, click: () => send('fmt', 'italic') },
      { label: T`ขีดเส้นใต้ (${C}+U)`, enabled: inEdit, click: () => send('fmt', 'underline') },
      { label: T`ขีดฆ่า (${C}+${S}+X)`, enabled: inEdit, click: () => send('fmt', 'strike') },
      { label: T`ล้างรูปแบบ (${C}+Space)`, enabled: inEdit, click: () => send('fmt', 'clear') },
      { type: 'separator' },
      { label: T`เลิกทำ (${C}+Z)`, enabled: inEdit, click: () => send('editor-undo') },
      { label: T`ทำซ้ำ (${C}+Y)`, enabled: inEdit, click: () => send('editor-redo') },
      { type: 'separator' },
      { label: T`แทรกรูป…`, enabled: inEdit, click: () => send('insert-image') },
      { label: T`ค้นหา… (${C}+F)`, click: () => send('find') },
      { type: 'separator' },
      { label: T`บันทึก (${C}+S)`, click: () => send('save') },
    ]);
    menu.popup({ window: win });
  });
  buildMenu();
}

// ─────────────────────────────────────────────────────────────────────
// [alpha.69] สมุดประวัติการทำงาน (History) — copy-on-write ที่คอขวดของระบบไฟล์
//
// ทุกการเขียนไฟล์ของทั้งโปรแกรมวิ่งผ่าน `H('fs:*')` ข้างล่างนี้อยู่แล้ว (renderer ไม่แตะ fs ตรง ๆ)
// จึงเป็นจุดเดียวที่ดักได้ครบ — ท่าเดียวกับที่ alpha.67 ดัก `panel:fileChanged` ที่ preload
// จุดเรียกใหม่ที่เพิ่มทีหลังได้ประวัติไปด้วยฟรี โดยไม่ต้องไปไล่แปะทีละที่
//
// ก่อนเขียนทับ/ลบ/ย้าย → คัดสำเนา "ของเดิม" เก็บเป็นก้อนใน `.k2history/blobs/`
// แล้วจดหนึ่งบรรทัดลง `.k2history/history.json` · ย้อนกลับ = คืนไฟล์ตามแผนที่ history-data คำนวณให้
// ตรรกะทั้งหมด (ต่อสมุด · ตัดของเก่า · แผนย้อนกลับ) อยู่ใน src/history/history-data.js ซึ่งมี unit test
// ─────────────────────────────────────────────────────────────────────
let HD = null;
try { HD = require('./history-data.cjs'); }
catch (e) { console.error('[history] โหลดตรรกะสมุดประวัติไม่ได้ — ประวัติจะถูกปิดไว้', e); }

const hist = { root: '', limit: 32, on: false, seqTick: 0 };
// โฟลเดอร์ที่ **ห้ามจด** — ของระบบสำรอง/ประวัติเอง (ไม่งั้นจดประวัติของประวัติวนไม่จบ
// และ Snapshots ถูกเขียนทุกครั้งที่บันทึกฉาก จะกินโควตา 32 ครั้งหมดโดยไม่มีประโยชน์)
const HIST_SKIP = ['.k2history', 'Snapshots', 'Backups'];

function histDir() { return hist.root ? path.join(hist.root, '.k2history') : ''; }
function histFile() { return histDir() ? path.join(histDir(), 'history.json') : ''; }
function blobDir() { return histDir() ? path.join(histDir(), 'blobs') : ''; }

/** path นี้อยู่ในโปรเจกต์ที่เปิดอยู่ และไม่ใช่ของระบบที่เรากันไว้ */
function histTracks(p) {
  if (!hist.on || !hist.root || !HD || !p) return false;
  const abs = path.resolve(String(p));
  const root = path.resolve(hist.root);
  if (!abs.toLowerCase().startsWith(root.toLowerCase() + path.sep)) return false;
  const rel = abs.slice(root.length + 1).split(/[\\/]/);
  return !HIST_SKIP.includes(rel[0]);
}
function readJournal() {
  try { return HD.migrate(JSON.parse(fs.readFileSync(histFile(), 'utf-8'))); }
  catch { return HD.newJournal(); }
}
function writeJournal(j) {
  try { fs.mkdirSync(histDir(), { recursive: true }); fs.writeFileSync(histFile(), JSON.stringify(j, null, 2), 'utf-8'); }
  catch (e) { console.error('[history] เขียนสมุดไม่สำเร็จ', e); }
}
/** คัดสำเนาไฟล์เดิมเก็บไว้ → คืน id ของก้อน · ไฟล์ยังไม่มี = null (ย้อนกลับ = ลบทิ้ง) */
function stashBlob(p) {
  try {
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) return null;
    const id = Date.now().toString(36) + '-' + (hist.seqTick++).toString(36) + path.extname(p);
    fs.mkdirSync(blobDir(), { recursive: true });
    fs.copyFileSync(p, path.join(blobDir(), id));   // copyFile = ไบต์ต่อไบต์ (รูปภาพไม่เสีย)
    return id;
  } catch (e) { console.error('[history] คัดสำเนาไม่สำเร็จ: ' + p, e); return null; }
}
/** ไฟล์ทั้งหมดใต้โฟลเดอร์ (ใช้ตอนลบทั้งบท — ต้องเก็บทุกใบถึงจะคืนได้จริง) */
function walkFiles(dir, out = [], depth = 0) {
  if (depth > 8 || out.length > 400) return out;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const d of ents) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walkFiles(p, out, depth + 1);
    else out.push(p);
  }
  return out;
}
/** เก็บสภาพ "ก่อนหน้านี้" ของ path (ไฟล์เดี่ยวหรือทั้งโฟลเดอร์) เป็นรายการสำหรับสมุด */
function captureBefore(p) {
  if (!histTracks(p)) return [];
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      return walkFiles(p).filter(histTracks).map((f) => ({ path: f, before: stashBlob(f) }));
    }
  } catch {}
  return [{ path: String(p), before: stashBlob(p) }];
}
/** จดหนึ่งบรรทัด (เรียกหลังการกระทำสำเร็จแล้วเท่านั้น) */
function journal(kind, files, label) {
  if (!hist.on || !HD) return false;
  const list = (files || []).filter((f) => f && f.path);
  if (!list.length) return false;
  const r = HD.addRecord(readJournal(), { kind, label: label || '', at: new Date().toISOString(), files: list },
                         hist.limit);
  writeJournal(r.journal);
  for (const id of r.dropped) { try { fs.rmSync(path.join(blobDir(), id), { force: true }); } catch {} }
  return true;
}
/** ครอบการกระทำที่เปลี่ยนไฟล์: เก็บของเดิมก่อน → ทำ → จด */
function withHistory(kind, paths, fn, label) {
  if (!hist.on) return fn();
  let before = [];
  try { for (const p of paths) before = before.concat(captureBefore(p)); }
  catch (e) { console.error('[history] เก็บสภาพก่อนหน้าไม่สำเร็จ', e); }
  const out = fn();
  try { journal(kind, before, label); } catch (e) { console.error('[history] จดไม่สำเร็จ', e); }
  return out;
}

ipcMain.handle('history:config', (e, opts = {}) => {
  hist.root = String(opts.root || '');
  hist.limit = HD ? HD.clampLimit(opts.limit) : 32;
  hist.on = !!HD && !!hist.root && opts.enabled !== false;
  return { on: hist.on, limit: hist.limit };
});
ipcMain.handle('history:list', () => (hist.root && HD ? readJournal() : (HD ? HD.newJournal() : null)));
ipcMain.handle('history:clear', () => {
  if (!hist.root || !HD) return false;
  try { fs.rmSync(histDir(), { recursive: true, force: true }); } catch {}
  return true;
});
/**
 * ย้อนกลับไปยังจุดหลังบันทึกหมายเลข seq
 * ทำตามแผนที่ history-data คำนวณให้เป๊ะ ๆ (ลบก่อน คืนทีหลัง) แล้วตัดบันทึกที่ถอนออกไปทิ้ง
 */
ipcMain.handle('history:revert', (e, seq) => {
  if (!hist.on || !HD) return { ok: false, reason: 'off' };
  const j = readJournal();
  const plan = HD.planRevert(j, Number(seq) || 0);
  let restored = 0, deleted = 0, failed = 0;
  for (const op of plan.ops) {
    try {
      if (op.op === 'delete') { fs.rmSync(op.path, { recursive: true, force: true }); deleted++; }
      else {
        const b = path.join(blobDir(), op.blob);
        if (!fs.existsSync(b)) { failed++; continue; }   // ก้อนถูกตัดไปแล้ว = คืนไม่ได้ แต่ต้องไม่ล้ม
        fs.mkdirSync(path.dirname(op.path), { recursive: true });
        fs.copyFileSync(b, op.path); restored++;
      }
    } catch (err) { failed++; console.error('[history] ย้อนกลับไม่สำเร็จ: ' + op.path, err); }
  }
  const after = HD.afterRevert(j, Number(seq) || 0);
  writeJournal(after.journal);
  for (const id of after.dropped) { try { fs.rmSync(path.join(blobDir(), id), { force: true }); } catch {} }
  try { fanout({ kind: 'project-changed', path: hist.root }, e.sender.id); } catch {}
  return { ok: failed === 0, restored, deleted, failed, undone: plan.undone.length };
});

// ─────────────────────────────────────────────────────────────────────
// [alpha.69] รายการแผงในเมนู "มุมมอง → แผง"
//
// **แหล่งความจริงเดียวของเมนูนี้** — เดิมเขียนเรียงมือในตัวสร้างเมนู แล้วเพิ่มแผงใหม่ทีไรก็ลืมมาเติม
// ผู้ใช้จึงหาแผงที่เพิ่งทำเสร็จไม่เจอเลย (รายงานเข้ามารอบ .69 — และพบว่า Story Network / Planner /
// ผังพื้นที่ ตกหล่นมาตั้งแต่ .62 โดยไม่มีใครสังเกต)
//
// `menu:panelIds` ส่งรายการนี้ให้ renderer → e2e เทียบกับ PANEL_DEFS ทุกรอบ ลืมเมื่อไหร่เทสแดงทันที
// แผงที่ **จงใจ** ไม่ใส่ ต้องประกาศไว้ใน MENU_PANELS_SKIP พร้อมเหตุผล (ไม่ใช่ปล่อยหายเงียบ ๆ)
// ─────────────────────────────────────────────────────────────────────
const MENU_PANELS = [
  // id แผงเป็นชื่อสั้นของ Panel System (tree/outline/props) — ฝั่ง renderer มี alias ให้ชื่อเดิมด้วย
  { id: 'tree', label: T`โปรเจกต์ (Explorer)` },
  { id: 'outline', label: 'Navigation' },
  { id: 'props', label: T`คุณสมบัติ` },
  { id: 'log', label: T`บันทึก (Log)` },
  { id: 'comments', label: T`คอมเมนต์` },
  { id: 'search', label: (C, S) => T`ค้นหาทั้งโปรเจกต์ (${C}+${S}+F)` },
  { id: 'notes', label: T`สมุดโน้ตด่วน` },
  { sep: true },
  // บั๊ก #18: ฟีเจอร์ที่ไม่ใช่เอกสาร เป็นแผง ไม่ใช่แท็บ
  { id: 'dashboard', label: T`แดชบอร์ด` },
  { id: 'kanban', label: 'Kanban' },
  { id: 'books', label: T`จัดการเล่ม` },
  { id: 'timeline', label: T`เส้นเวลา` },
  { id: 'maps', label: T`แผนที่` },
  { id: 'gallery', label: (C, S) => T`คลังรูปภาพ (${C}+${S}+G)` },
  { id: 'gallery-board', label: T`🎨 กระดานอารมณ์` },
  { id: 'ai-analyzer', label: T`🧠 AI วิเคราะห์` },
  { id: 'ai-chat', label: T`💬 AI ผู้ช่วยเขียน` },
  { sep: true },
  // [alpha.62 บั๊ก 16 · alpha.66 ข้อ 1+9] สามตัวนี้เป็นแผงมานานแล้ว แต่เพิ่งได้เข้าเมนูรอบ .69
  { id: 'network', label: '🕸 Story Network' },
  { id: 'planner', label: '🗺 Planner' },
  { id: 'floorplan', label: T`📍 ผังพื้นที่` },
  { id: 'branch', label: T`🌿 ผังแตกสาย` },
  { id: 'player', label: T`▶️ ทดลองเล่น` },
  { sep: true },
  // [alpha.69] สารานุกรม · ประวัติการทำงาน · บันทึกประจำวัน
  { id: 'codex', label: T`📚 สารานุกรม (Codex)` },
  { id: 'history', label: T`🕘 ประวัติการทำงาน` },
  { id: 'record', label: T`🗒 บันทึกประจำวัน` },
];
/** แผงที่จงใจไม่ใส่ในเมนูนี้ — ต้องมีเหตุผลกำกับเสมอ */
const MENU_PANELS_SKIP = {
  'planner-props': T`แผงคู่ของ Planner — Planner เป็นคนเปิด/ปิดให้เองตามการเลือกบนกระดาน`,
  home: T`หน้าแรกมีทางเข้าของตัวเองที่เมนู ไฟล์ → หน้าแรก`,
};
ipcMain.handle('menu:panelIds', () => ({
  ids: MENU_PANELS.filter((p) => !p.sep).map((p) => p.id),
  skip: Object.keys(MENU_PANELS_SKIP),
}));

// ---------------- IPC: filesystem (ผ่าน main เท่านั้น — renderer ไม่แตะ fs ตรง) ----------------
const H = (name, fn) => ipcMain.handle(name, (e, ...a) => fn(...a));
H('fs:readFile', (p) => fs.readFileSync(p, 'utf-8'));
H('fs:writeFile', (p, data) => withHistory('write', [p], () => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data, 'utf-8'); return true;
}));
H('fs:readJson', (p) => JSON.parse(fs.readFileSync(p, 'utf-8')));
H('fs:exists', (p) => fs.existsSync(p));
H('fs:listDirs', (p) => fs.readdirSync(p, { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name));
H('fs:listFiles', (p, ext) => fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true })
  .filter((d) => d.isFile() && (!ext || d.name.endsWith(ext))).map((d) => d.name) : []);
H('fs:mkdir', (p) => { fs.mkdirSync(p, { recursive: true }); return true; });
// ย้าย/เปลี่ยนชื่อ = สองด้านในบันทึกเดียว (ต้นทางหายไป · ปลายทางถูกสร้างหรือทับของเดิม)
H('fs:move', (src, dst) => withHistory('move', [src, dst], () => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst); return true;
}));
H('fs:remove', (p) => withHistory('remove', [p], () => {
  fs.rmSync(p, { recursive: true, force: true }); return true;
}));
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
  // ชื่อไฟล์ปลายทางรู้ได้หลังหาที่ว่างเสร็จ → จดหลังเขียน (ของเดิมไม่มีอยู่แล้วโดยนิยาม)
  fs.writeFileSync(path.join(dstDir, out), Buffer.from(base64, 'base64'));
  const dst = path.join(dstDir, out);
  if (histTracks(dst)) journal('image', [{ path: dst, before: null }]);
  return out;
});

// เขียนไฟล์ไบนารีจาก byte array (ส่งออก .zip ฯลฯ) — renderer ส่ง Uint8Array มาทาง IPC
// สำคัญ: ห้ามส่งเป็น string แล้วเขียน utf-8 (ไบต์ ≥0x80 จะบวมเป็น multi-byte ไฟล์เสีย)
H('fs:writeBytes', (p, bytes) => withHistory('write', [p], () => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(bytes));
  return true;
}));
// คัดลอกไฟล์ตรง ๆ (รักษาไบนารี — ใช้ตอนสำรองโปรเจกต์ ซึ่งมีรูปภาพปนอยู่)
H('fs:copyFile', (src, dst) => withHistory('copy', [dst], () => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return true;
}));
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
  const dst = path.join(dstDir, name);
  if (histTracks(dst)) journal('copy', [{ path: dst, before: null }]);
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
    { name: T`รูปภาพ`, extensions: ['png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico', 'tif', 'tiff', 'heic', 'heif', 'apng'] }] });
  return r.canceled ? null : r.filePaths[0];
});
// ฟิลเตอร์ตามนามสกุลของชื่อไฟล์ที่เสนอ — เดิมบังคับ Markdown ทุกกรณี (ส่งออก HTML/JSON แล้วได้ .md)
const SAVE_FILTERS = {
  md: { name: 'Markdown', extensions: ['md'] },
  html: { name: 'HTML', extensions: ['html', 'htm'] },
  json: { name: 'JSON', extensions: ['json'] },
  txt: { name: T`ข้อความ`, extensions: ['txt'] },
  zip: { name: 'ZIP', extensions: ['zip'] },
  // [alpha.66 ข้อ 10] ส่งออกผังแตกสายเป็นรูป
  svg: { name: T`ภาพเวกเตอร์ SVG`, extensions: ['svg'] },
  png: { name: T`รูปภาพ PNG`, extensions: ['png'] },
  // [alpha.60r3 ข้อ 4] ตารางคำแปลสำหรับผู้แปล (Excel / Google Sheets)
  csv: { name: T`ตาราง CSV`, extensions: ['csv'] },
  fdx: { name: 'Final Draft', extensions: ['fdx'] },
  rtf: { name: 'Rich Text', extensions: ['rtf'] },
  // alpha.57a — นำเข้าไฟล์ฟอนต์เข้าโปรเจกต์ (ฟอนต์ตามภาษา)
  font: { name: T`ฟอนต์`, extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] },
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
    filters: [f, { name: T`ทุกไฟล์`, extensions: ['*'] }] });
  return r.canceled ? null : r.filePath;
});
H('dialog:openFile', async (kind) => {
  const f = SAVE_FILTERS[kind] || SAVE_FILTERS.json;
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'],
    filters: [f, { name: T`ทุกไฟล์`, extensions: ['*'] }] });
  return r.canceled ? null : r.filePaths[0];
});
// [alpha.60 ข้อ 62-66] เปิดไฟล์บทภาพยนตร์ — แสดงทุกรูปแบบพร้อมกัน
H('dialog:openScreenplay', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'],
    filters: [
      { name: T`บทภาพยนตร์ทุกฟอร์แมต (Fountain, FDX, Celtx, Adobe Story, Fade In Pro)`,
        extensions: ['fountain', 'fdx', 'celtx', 'astx', 'fadein', 'txt'] },
      { name: T`ทุกไฟล์`, extensions: ['*'] },
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
H('win:quitNow', () => {
  forceQuit = true;
  // [alpha.67] หน้าต่างแผงที่ฉีกออกไปต้องปิดตามหน้าต่างหลัก — ไม่งั้นโปรแกรมค้างอยู่ทั้งที่ผู้ใช้สั่งออก
  closeAllTearOffs();
  win.destroy(); app.quit();
});
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
// [alpha.67] สกรีนช็อต "หน้าต่างแผงที่ฉีกออกไป" — renderer หลักมองไม่เห็นเนื้อในหน้าต่างลูก
// (คนละ JS context) จึงต้องให้ main เป็นคนถ่ายให้ แล้วค่อยตรวจพิกเซลว่าไม่ใช่หน้าเปล่า
H('test:shotTearOff', async (id, out) => {
  try {
    const w = tearOffWin(String(id || ''));
    if (!w) return false;
    const img = await w.webContents.capturePage();
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
// เปิดลิงก์ในเบราว์เซอร์ของเครื่อง (กล่อง "เกี่ยวกับ" ใช้ลิงก์เครดิต) — จำกัดเฉพาะ http/https
H('shell:openExternal', (url) => {
  try { if (/^https?:\/\//i.test(String(url))) { shell.openExternal(String(url)); return true; } } catch {}
  return false;
});

// ─────────────────────────────────────────────────────────────────────
// [alpha.76] ไฟล์ภาษา = CSV `k2_<code>.csv` — **รหัสภาษาอ่านจากชื่อไฟล์**
//
// ที่ที่ค้นหา (ก่อน→หลัง = สำคัญมาก→น้อย · เจอคีย์ซ้ำให้ตัวก่อนหน้าชนะ):
//   1. โฟลเดอร์โปรเจกต์      — ผู้ใช้แก้คำแปลเฉพาะโปรเจกต์ตัวเองได้
//   2. โฟลเดอร์ข้าง ๆ ตัว exe — ตัว portable แตกตัวเองลง temp ทุกครั้งที่รัน
//                              ไฟล์ที่ผู้ใช้วางเพิ่มจึงต้องอยู่ข้าง exe ไม่ใช่ในตัวโปรแกรม
//   3. userData/languages     — ที่เก็บถาวรของเครื่องนั้น
//   4. resources/languages    — นอก asar (แก้ได้ในแบบติดตั้ง)
//   5. ที่มากับโปรแกรม        — __dirname/languages (+ renderer/languages ตอน dev)
// วาง k2_ja.csv เพิ่ม → เปิดโปรแกรมใหม่ก็มีภาษาญี่ปุ่นเลย **ไม่ต้อง build**
// ─────────────────────────────────────────────────────────────────────
const LANG_RE = /^k2[_-]([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?)\.csv$/i;
function langCode(file) {
  const m = LANG_RE.exec(file);
  if (!m) return '';
  const raw = m[1].replace('_', '-'), p = raw.split('-');
  return p.length > 1 ? p[0].toLowerCase() + '-' + p.slice(1).join('-').toUpperCase() : p[0].toLowerCase();
}
function langDirs(root) {
  const out = [];
  const add = (p) => { if (p && !out.includes(p)) out.push(p); };
  if (root) add(path.join(root, 'languages'));
  if (process.env.PORTABLE_EXECUTABLE_DIR) add(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'languages'));
  try { add(path.join(path.dirname(app.getPath('exe')), 'languages')); } catch {}
  try { add(path.join(app.getPath('userData'), 'languages')); } catch {}
  if (process.resourcesPath) add(path.join(process.resourcesPath, 'languages'));
  add(path.join(__dirname, 'languages'));
  add(path.join(__dirname, 'renderer', 'languages'));
  return out;
}
/** สแกนทุกที่ → [{code,file,dir,name,nativeName}] · ที่แรกที่เจอรหัสนั้นชนะ */
function langScan(root) {
  const seen = new Map();
  for (const dir of langDirs(root)) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) {
      const code = langCode(f);
      if (!code || seen.has(code)) continue;
      const full = path.join(dir, f);
      const info = { code, file: full, dir, name: '', nativeName: '' };
      // อ่านแค่หัวไฟล์พอ — เอาชื่อภาษามาโชว์ในกล่องตั้งค่า
      try {
        const head = fs.readFileSync(full, 'utf-8').slice(0, 2048);
        const g = (k) => { const m = new RegExp('^' + k + ',"?([^",\\r\\n]*)', 'm').exec(head); return m ? m[1] : ''; };
        info.name = g('meta\\.name'); info.nativeName = g('meta\\.nativeName');
      } catch {}
      seen.set(code, info);
    }
  }
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
}
// แคชผลอ่าน/สแกน — ทุกหน้าต่าง (รวมหน้าต่างแผงที่ฉีกออกมา) ขอตารางคำแปลตอนเริ่มตัวเอง
// ถ้าอ่านดิสก์ใหม่ทุกครั้ง หน้าต่างลูกจะบูตช้าลงเห็น ๆ (ไฟล์ไทยก้อนละ ~600KB อยู่ใน asar)
const _langCache = new Map();
function clearLangCache() { _langCache.clear(); }

/** อ่านไฟล์ภาษาทุกชั้นแล้วต่อกัน (ชั้นแรกอยู่บนสุด — ตัวอ่านให้คีย์แรกชนะ) */
function langRead(code, root) {
  // แคชเฉพาะกรณี "ไม่มีโปรเจกต์" (= ชั้นที่มากับโปรแกรม ซึ่งทุกหน้าต่างขอตอนบูต)
  // ถ้ามี root ต้องอ่านสดเสมอ — ผู้ใช้แก้ไฟล์ในโปรเจกต์แล้วต้องเห็นผลทันที
  const ck = root ? '' : code;
  if (ck && _langCache.has(ck)) return _langCache.get(ck);
  const parts = [];
  for (const dir of langDirs(root)) {
    for (const f of [`k2_${code}.csv`, `k2-${code}.csv`]) {
      const full = path.join(dir, f);
      try { if (fs.existsSync(full)) { parts.push(fs.readFileSync(full, 'utf-8')); break; } } catch {}
    }
  }
  const out = parts.join('\n');
  if (ck) _langCache.set(ck, out);
  return out;
}
// จำภาษาที่เลือกไว้ในไฟล์ — main ต้องรู้ก่อนสร้างเมนู OS ซึ่งเกิดก่อน renderer จะบอกได้
function langPrefFile() { try { return path.join(app.getPath('userData'), 'lang.txt'); } catch { return ''; } }
function lastLangCode() {
  try { const c = fs.readFileSync(langPrefFile(), 'utf-8').trim(); if (c) return c; } catch {}
  return 'th';
}
function saveLangCode(code) {
  try {
    if (!code || code === lastLangCode()) return;
    fs.mkdirSync(path.dirname(langPrefFile()), { recursive: true });
    fs.writeFileSync(langPrefFile(), String(code), 'utf-8');
  } catch {}
}
/** renderer เปลี่ยนภาษา → main โหลดตารางใหม่แล้วสร้างเมนู OS ใหม่ (ไม่งั้นเมนูค้างภาษาเดิม) */
H('lang:set', (code) => { clearLangCache(); saveLangCode(code); loadLangTable(code); buildMenu(); return true; });
H('lang:list', (root) => langScan(root).map(({ code, file, name, nativeName }) => ({ code, file, name, nativeName })));
H('lang:read', (code, root) => langRead(code, root));
// "โหลดไฟล์ภาษาใหม่" — ผู้ใช้เพิ่งแก้ CSV นอกโปรแกรม ต้องทิ้งแคชก่อนอ่านซ้ำ
H('lang:reload', () => { clearLangCache(); loadLangTable(); buildMenu(); return true; });
H('lang:dirs', (root) => langDirs(root));
// อ่านแบบ synchronous ตอน renderer เพิ่งเริ่ม — ต้องมีตารางคำแปล **ก่อน** โมดูลอื่นถูก import
// (ค่าคงที่ระดับโมดูลถูกคำนวณตอน import · ถ้ารอ async ค่าพวกนั้นค้างภาษาเดิมทั้งรอบ)
ipcMain.on('app:versionSync', (e) => { try { e.returnValue = app.getVersion(); } catch { e.returnValue = ''; } });
ipcMain.on('lang:sync', (e, want) => {
  try {
    const catalog = langScan('').map(({ code, file, name, nativeName }) => ({ code, file, name, nativeName }));
    let code = String(want || '').trim() || lastLangCode();
    if (!code || !catalog.some((c) => c.code === code)) code = catalog.some((c) => c.code === 'th') ? 'th' : (catalog[0]?.code || '');
    saveLangCode(code);
    e.returnValue = { code, csv: code ? langRead(code, '') : '', catalog };
  } catch { e.returnValue = { code: '', csv: '', catalog: [] }; }
});

// ─────────────────────────────────────────────────────────────────────
// [alpha.67] Tear-off — ฉีกแผงออกเป็นหน้าต่าง OS จริง (รองรับหลายจอ)
//
// หน้าต่างลูกโหลด `renderer/index.html?panelwin=<id>&root=<โปรเจกต์>` = บันเดิลตัวเดียวกัน
// แล้ว renderer เข้าโหมด lite (ดู bootPanelWindow ใน app.js) — ไม่มีแท็บ/แถบเครื่องมือ/แผงอื่น
// มีแค่เนื้อแผงเดียวเต็มหน้าต่าง วาดด้วย `FEATURE_PANELS[id]` ตัวเดียวกับในหน้าต่างหลัก
//
// กติกาความเป็นเจ้าของ (กันเขียนไฟล์ชนกัน):
//   หน้าต่างหลักถือ project.khn.json · ลูกเขียนได้เฉพาะไฟล์ของแผงตัวเอง แล้ว broadcast บอกคนอื่น
// ─────────────────────────────────────────────────────────────────────
const tearOffs = new Map();                       // panelId → BrowserWindow

function tearOffWin(id) {
  const w = tearOffs.get(id);
  return w && !w.isDestroyed() ? w : null;
}
/** ส่งข้อความถึงทุกหน้าต่าง **ยกเว้น** ผู้ส่ง (webContents.id) */
function fanout(msg, fromWcId) {
  const targets = [win, ...tearOffs.values()];
  for (const w of targets) {
    if (!w || w.isDestroyed()) continue;
    if (w.webContents.id === fromWcId) continue;
    try { w.webContents.send('k2:sync', msg); } catch {}
  }
}

ipcMain.handle('panel:tearOff', (e, opts = {}) => {
  const id = String(opts.id || '');
  if (!id) return false;
  const exist = tearOffWin(id);
  if (exist) { exist.show(); exist.focus(); return true; }   // เปิดอยู่แล้ว → ยกมาไว้หน้าสุด
  const w = new BrowserWindow({
    width: Math.max(360, opts.w | 0 || 720), height: Math.max(240, opts.h | 0 || 620),
    x: Number.isInteger(opts.x) ? opts.x : undefined,
    y: Number.isInteger(opts.y) ? opts.y : undefined,
    minWidth: 320, minHeight: 200,
    title: String(opts.title || id) + ' — Killian 2',
    backgroundColor: '#262624',
    // ต่างจากหน้าต่างหลัก: ใช้ขอบหน้าต่างของ OS จริง — ผู้ใช้ลากข้ามจอ/สแนปด้วยท่ามาตรฐานได้เลย
    frame: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'),
                      contextIsolation: true, nodeIntegration: false,
                      backgroundThrottling: false },
  });
  tearOffs.set(id, w);
  const q = new URLSearchParams({ panelwin: id, root: String(opts.root || '') });
  if (TEST) q.set('k2test', '1');
  w.loadFile('renderer/index.html', { search: q.toString() });
  w.on('closed', () => {
    tearOffs.delete(id);
    // หน้าต่างหลักเป็นคนตัดสินว่าจะเอาแผงกลับไปไว้ที่ไหน (ที่เดิมที่จดไว้ใน homes)
    if (win && !win.isDestroyed()) { try { win.webContents.send('k2:sync', { kind: 'tearoff-closed', id }); } catch {} }
  });
  return true;
});
ipcMain.handle('panel:tearOffClose', (e, id) => {
  const w = tearOffWin(String(id || ''));
  if (!w) return false;
  w.close();
  return true;
});
ipcMain.handle('panel:tearOffList', () => [...tearOffs.keys()].filter((id) => tearOffWin(id)));
function closeAllTearOffs() {
  for (const w of [...tearOffs.values()]) { try { if (w && !w.isDestroyed()) w.destroy(); } catch {} }
  tearOffs.clear();
}
/** ประกาศให้หน้าต่างอื่นรู้ว่ามีอะไรเปลี่ยน (ไฟล์โปรเจกต์ · ฉากที่เปิดอยู่ · คำขอเปิดไฟล์) */
ipcMain.handle('panel:broadcast', (e, msg) => {
  fanout(msg || {}, e.sender.id);
  return true;
});

// ไฟล์ถูกเขียน (preload ดักให้ทุกคำสั่งที่เปลี่ยนไฟล์) → บอกหน้าต่างอื่นให้วาดใหม่
// หน่วงรวบ 250ms: autosave/ย้ายฉากทีเดียวแตะหลายไฟล์รวด ไม่งั้นหน้าต่างลูกวาดใหม่สิบรอบติด ๆ
// ไม่มีหน้าต่างแผงเปิดอยู่ = ไม่ต้องทำอะไรเลย (ค่าใช้จ่ายเป็นศูนย์ในการใช้งานปกติ)
let _fcJob = null;
const _fcPending = new Map();                     // wcId ผู้เขียน → path ล่าสุด
ipcMain.handle('panel:fileChanged', (e, p) => {
  if (!tearOffs.size) return false;
  _fcPending.set(e.sender.id, String(p || ''));
  if (_fcJob) return true;
  _fcJob = setTimeout(() => {
    _fcJob = null;
    const batch = [..._fcPending.entries()];
    _fcPending.clear();
    for (const [wcId, last] of batch) fanout({ kind: 'project-changed', path: last }, wcId);
  }, 250);
  return true;
});

app.whenReady().then(() => {
  // โหลดตารางคำแปลก่อนสร้างหน้าต่าง/เมนู — เมนู OS ถูกสร้างครั้งเดียวตอนเปิด
  try { loadLangTable(lastLangCode()); } catch {}
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
