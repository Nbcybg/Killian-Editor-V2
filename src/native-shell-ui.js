// native-shell-ui.js — [alpha.169 · native] ผูก "พฤติกรรมแบบโปรแกรมจริง" เข้ากับหน้าจอ
//
// ผู้ใช้: *"มีอะไรที่ยังดูแล้ว เหมือนห่อด้วย web · เราอยากได้ app ที่ native เลย"*
//
//   · แถบชื่อหน้าต่างตามระบบ: Windows = ปุ่มของระบบ (Snap Layouts) · macOS = ไฟจราจร · อื่น ๆ = ปุ่มที่วาดเอง
//   · สีแถบชื่อ/โหมดของธีม → main (ปุ่มหน้าต่าง · เมนู · กล่องไฟล์ของระบบ ตามธีมของ K2)
//   · คลิกปุ่มกลาง ≠ เลื่อนอัตโนมัติแบบเบราว์เซอร์
//   · แตะ Alt / F10 = เข้าแถบเมนูด้วยคีย์บอร์ด (←→ เดิน · Enter/↓ เปิด · Esc ออก)
//   · ลากไฟล์จากนอกโปรแกรมมาวาง: โฟลเดอร์โปรเจกต์ = เปิด · รูป = แทรก/เข้าคลัง · ไฟล์บท = นำเข้า
//   · งานยาว: แถบความคืบหน้าบนแถบงาน + เรียกความสนใจเมื่อเสร็จตอนผู้ใช้ไปอยู่หน้าต่างอื่น
//
// ตรรกะที่เทสได้อยู่ native-core.js (บริสุทธิ์) · ไฟล์นี้รับของจาก app.js ผ่าน `initNativeShell(hooks)`
// (ไม่ import app.js — ไม่เพิ่มวง import)
import { $, state, log, setStatus, setStatusError, withBusy } from './core.js';
import { failText } from './err-text.js';
import { t, tf } from './i18n.js';
import { icon } from './icons.js';
import { toast, menuOpen } from './ui.js';
import * as albumCore from './gallery/album-core.js';
import { ATTENTION_MIN_MS } from './timing.js';
import { rgbToHex, createAltTap, menubarStep, classifyOsDrop, isScreenplayFile, freeFileName,
         shouldCallAttention } from './native-core.js';

const HOOKS = { openProject: null, importScript: null, insertImage: null, openGallery: null };
const NS = { platform: 'linux', native: false, max: false, full: false, inited: false, lastChrome: '' };

export function nativeShellInfo() { return { ...NS }; }

// ───────────────────────── แถบชื่อหน้าต่าง ─────────────────────────

function applyWinState(s) {
  if (!s) return;
  NS.max = !!s.max; NS.full = !!s.full;
  const b = document.body;
  b.classList.toggle('k-win-max', NS.max);
  b.classList.toggle('k-win-full', NS.full);
  // ปุ่มขยายที่วาดเอง (ระบบที่ไม่มีปุ่มของ OS): ไอคอน + ทูลทิปตามสภาพจริงของหน้าต่าง
  const mx = $('#win-max');
  if (mx && mx.dataset.state !== (NS.max ? 'max' : 'normal')) {
    mx.dataset.state = NS.max ? 'max' : 'normal';
    mx.replaceChildren(icon(NS.max ? 'window-restore' : 'maximize', 18));
    const key = NS.max ? 'ui.html.winRestore' : 'ui.html.winMax';
    mx.setAttribute('data-i18n-title', key);
    mx.title = t(key);
  }
}

/** สีที่จอใช้อยู่จริงของแถบชื่อหน้าต่าง → main (ปุ่มหน้าต่างของ Windows · โหมดของเมนู/กล่องไฟล์ระบบ) */
export function syncWindowChrome() {
  try {
    const bar = $('#titlebar');
    if (!bar || !window.kapi || typeof kapi.winChrome !== 'function') return false;
    const cs = getComputedStyle(bar);
    const mode = document.documentElement.style.colorScheme === 'light' ? 'light' : 'dark';
    const o = { mode, color: rgbToHex(cs.backgroundColor), symbol: rgbToHex(cs.color),
                height: Math.round(bar.getBoundingClientRect().height) || 36 };
    const sig = JSON.stringify(o);
    if (sig === NS.lastChrome) return false;
    NS.lastChrome = sig;
    kapi.winChrome(o).catch(() => {});
    return true;
  } catch (e) { log('warn', 'window chrome', e); return false; }
}

// ───────────────────────── คลิกปุ่มกลาง ─────────────────────────

/**
 * Chromium บน Windows: คลิกปุ่มกลางในกล่องที่เลื่อนได้ = โหมดเลื่อนอัตโนมัติ (วงกลมลูกศร) — ท่าของเบราว์เซอร์
 * กัน default ของ mousedown ปุ่มกลาง = ไม่เข้าโหมดนั้น · auxclick (ปิดแท็บ) และตัวลากของผืนงาน (แพน/หมุน) ยังได้อีเวนต์ครบ
 */
function installMiddleClickGuard() {
  document.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }, true);
}

// ───────────────────────── แถบเมนูด้วยคีย์บอร์ด ─────────────────────────

const MB = { on: false, back: null };
const menuItems = () => [...document.querySelectorAll('#titlebar .tb-menu')]
  .filter((m) => m.offsetParent !== null && getComputedStyle(m).visibility !== 'hidden');
const menubarUsable = () => !document.querySelector('.k-overlay') && !menuOpen()
  && menuItems().length > 0;

export function menubarActive() { return MB.on; }
function leaveMenubar(restore) {
  if (!MB.on) return;
  MB.on = false;
  document.body.classList.remove('k-menubar-on');
  const back = MB.back; MB.back = null;
  if (restore && back && back.isConnected) { try { back.focus({ preventScroll: true }); } catch {} }
  else if (restore) { const a = document.activeElement; if (a && a.classList && a.classList.contains('tb-menu')) a.blur(); }   // ไม่มีที่ให้กลับ = ไม่ทิ้งโฟกัสค้างบนชื่อเมนู
}
export function enterMenubar() {
  if (!menubarUsable()) return false;
  const list = menuItems();
  MB.back = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  MB.on = true;
  document.body.classList.add('k-menubar-on');
  list[0].focus({ preventScroll: true });
  return true;
}
function installMenubarKeys() {
  const bar = $('#titlebar');
  if (!bar) return;
  // แถบเมนูเป็น "จุดหยุดเดียว" นอกลำดับ Tab — เข้าด้วย Alt/F10 เท่านั้น (เหมือนแถบเมนูของ Windows)
  const dress = () => {
    const list = [...bar.querySelectorAll('.tb-menu')];
    for (const m of list) {
      m.tabIndex = -1; m.setAttribute('role', 'menuitem'); m.setAttribute('aria-haspopup', 'menu');
      // กดเมาส์ที่ชื่อเมนูต้องไม่ดึงโฟกัสออกจากเอกสาร (เมนูของโปรแกรมจริงไม่ย้ายเคอร์เซอร์พิมพ์)
      m.addEventListener('mousedown', (e) => e.preventDefault());
    }
    bar.setAttribute('role', 'menubar');
    bar.setAttribute('aria-label', t('ui.native.menubar'));
  };
  dress();
  const tap = createAltTap();
  window.addEventListener('keydown', (e) => {
    tap.down(e);
    if (e.code === 'F10' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (MB.on) { e.preventDefault(); leaveMenubar(true); }
      else if (enterMenubar()) e.preventDefault();
      return;
    }
    if (!MB.on) return;
    const a = document.activeElement;
    const list = menuItems();
    const i = list.indexOf(a);
    if (i < 0) { leaveMenubar(false); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); leaveMenubar(true); return; }
    if (e.key === 'Tab') { leaveMenubar(true); return; }
    const j = menubarStep(list.length, i, e.key);
    if (j >= 0) { e.preventDefault(); e.stopPropagation(); list[j].focus({ preventScroll: true }); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      a.click();                                   // เมนูของระบบเปิดใต้ปุ่ม · ปิดแล้วโฟกัสยังอยู่ที่แถบ (เดินต่อด้วย ←→ ได้)
    }
  }, true);
  window.addEventListener('keyup', (e) => {
    if (!tap.up(e)) return;
    if (MB.on) { e.preventDefault(); leaveMenubar(true); }
    else if (enterMenubar()) e.preventDefault();
  }, true);
  window.addEventListener('mousedown', () => { tap.cancel(); if (MB.on) leaveMenubar(false); }, true);
  window.addEventListener('blur', () => { tap.cancel(); });
  window.addEventListener('wheel', () => { tap.cancel(); }, { capture: true, passive: true });   // Alt+ล้อ ไม่ใช่การแตะ Alt
  bar.addEventListener('focusout', (e) => {
    if (MB.on && !(e.relatedTarget && bar.contains(e.relatedTarget) && e.relatedTarget.classList.contains('tb-menu')))
      setTimeout(() => { if (MB.on && !menuItems().includes(document.activeElement) && document.hasFocus()) leaveMenubar(false); }, 0);
  });
}

// ───────────────────────── ลากไฟล์จากนอกโปรแกรม ─────────────────────────

const hasFiles = (dt) => { try { return !!dt && [...dt.types].includes('Files'); } catch { return false; } };

async function describeDropped(files) {
  const out = [];
  for (const f of files) {
    let p = '';
    try { p = (kapi.pathForFile && kapi.pathForFile(f)) || ''; } catch {}
    const e = { name: f.name, path: p, file: f, isDir: false, projectRoot: '' };
    if (p) {
      try { e.isDir = !!(await kapi.isDir(p)); } catch {}
      try {
        if (e.isDir && await kapi.exists(await kapi.join(p, 'project.khn.json'))) e.projectRoot = p;
        else if (!e.isDir && /(^|[\\/])project\.khn\.json$/i.test(p)) e.projectRoot = p.replace(/[\\/][^\\/]*$/, '');
      } catch {}
    }
    out.push(e);
  }
  return out;
}

/** ก๊อปรูปที่ลากมาเข้า Images/ (รากของคลังรูป) — คืนชื่อไฟล์ที่ได้จริง (หลบชื่อซ้ำ) */
async function importImages(items) {
  const dir = await albumCore.albumDir(kapi, state.root, albumCore.ROOT_ALBUM);
  await kapi.mkdir(dir);
  let taken = [];
  try { taken = (await kapi.listFiles(dir)) || []; } catch {}
  const names = [];
  await withBusy(t('ui.native.dropImagesBusy'), async () => {
    for (const it of items) {
      try {
        const name = freeFileName(it.name, taken);
        const buf = new Uint8Array(await it.file.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        await kapi.writeImageData(dir, name, btoa(bin));
        taken.push(name); names.push(name);
      } catch (err) { setStatusError(failText(t('ui.native.dropImagesFailed'), err)); }
    }
  });
  return names;
}

/** ของที่ปล่อยลงหน้าต่าง — แยกออกมาให้เทสเรียกตรง ๆ ได้ (ส่ง entries ที่ประกอบเอง) */
export async function handleOsDrop(entries, target) {
  const what = classifyOsDrop(entries, { isImage: albumCore.isImageFile, isScreenplay: isScreenplayFile });
  if (what.kind === 'project') {
    log('info', 'os drop: open project', what.root);
    if (HOOKS.openProject) await HOOKS.openProject(what.root);
    return what;
  }
  if (what.kind === 'none') { toast(t('ui.native.dropUnsupported'), { level: 'warn' }); return what; }
  if (!state.root) { toast(t('ui.native.dropNeedProject'), { level: 'warn' }); return { kind: 'none' }; }
  if (what.kind === 'screenplay') {
    log('info', 'os drop: import screenplay', what.item.name);
    if (what.item.path && HOOKS.importScript) await HOOKS.importScript(what.item.path);
    return what;
  }
  // รูป: ปล่อยลงเอกสารที่เปิดอยู่ = แทรกลงฉาก · ที่อื่น = เข้าคลังรูป
  const names = await importImages(what.items);
  if (!names.length) return what;
  const tab = state.active;
  const onDoc = !!(target && target.closest && target.closest('.pane') && tab && (tab.editor || tab.sp) && !tab.locked);
  if (onDoc && HOOKS.insertImage) {
    for (const n of names) await HOOKS.insertImage(n);
    setStatus(tf('ui.native.dropImagesInserted', names.length));
  } else {
    toast(tf('ui.native.dropImagesAdded', names.length),
      { action: HOOKS.openGallery ? { label: t('ui.native.openGallery'), onClick: () => HOOKS.openGallery() } : null });
  }
  log('info', 'os drop: images', names.length + (onDoc ? ' → scene' : ' → gallery'));
  return { ...what, names, inserted: onDoc };
}

/**
 * @param {boolean} act false = หน้าต่างแผงที่ฉีกออก: กันไม่ให้ Chromium เปิดไฟล์เป็นหน้าเว็บอย่างเดียว ไม่ลงมือ
 *        (เปิดโปรเจกต์/แทรกรูปเป็นงานของหน้าต่างหลัก)
 */
function installOsDrop(act) {
  // การลากที่เริ่ม "ในหน้าต่างนี้" (รูปในคลัง · แท็บ · การ์ด) บางชนิดพก `Files` มาด้วย — ไม่ใช่ของจากนอกโปรแกรม
  // dragstart ยิงเฉพาะการลากที่เริ่มในหน้า · ของจาก Explorer ของ Windows/Finder ไม่มี dragstart
  let internal = false;
  document.addEventListener('dragstart', () => { internal = true; }, true);
  document.addEventListener('dragend', () => { internal = false; }, true);
  // ต้นทางถูกถอดจากหน้าระหว่างลาก = ไม่มี dragend → ธงค้าง · เมาส์ขยับตามปกติได้เมื่อไหร่ = ไม่มีการลากแล้วแน่ ๆ
  document.addEventListener('mousemove', () => { if (internal) internal = false; }, { capture: true, passive: true });
  // ระยะ bubble ที่ document — ตัวรับของแผง (คลังรูป) ที่หยุดอีเวนต์ไว้เองยังเป็นเจ้าของของตัวเอง
  document.addEventListener('dragover', (e) => {
    if (internal || !hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = act ? 'copy' : 'none'; } catch {}
  });
  document.addEventListener('drop', (e) => {
    const own = internal;
    internal = false;
    if (own || !hasFiles(e.dataTransfer)) return;
    const files = [...(e.dataTransfer.files || [])];
    // กัน default เสมอ — ไม่งั้น Chromium พยายาม "เปิดไฟล์นั้นเป็นหน้าเว็บ" (ถูกกันไว้ที่ main แต่ขึ้นคำเตือนใน log ทุกครั้ง)
    const mine = !e.defaultPrevented;
    e.preventDefault();
    if (!act || !mine || !files.length) return;
    const target = e.target;
    describeDropped(files).then((ents) => handleOsDrop(ents, target))
      .catch((err) => { log('error', 'os drop', err); setStatusError(failText(t('ui.native.dropImagesFailed'), err)); });
  });
}

// ───────────────────────── แถบงาน ─────────────────────────

/** ความคืบหน้าของงานยาว → แถบงานของระบบ (done/total · ไม่รู้ปลายทาง = 'busy' · จบ = -1) */
export function taskbarProgress(done, total) {
  try {
    if (!window.kapi || typeof kapi.winProgress !== 'function') return;
    const v = done === -1 ? -1 : (total > 0 ? Math.max(0, Math.min(1, done / total)) : 'busy');
    kapi.winProgress(v).catch(() => {});
  } catch {}
}
/** งานยาวจบ: ผู้ใช้ไม่ได้อยู่ที่หน้าต่าง + นานพอ = ไอคอนบนแถบงานกะพริบ + การแจ้งเตือนของระบบ */
export function taskFinished(name, elapsedMs) {
  try {
    if (!shouldCallAttention(elapsedMs, document.hasFocus(), ATTENTION_MIN_MS)) return false;
    if (!window.kapi || typeof kapi.winAttention !== 'function') return false;
    kapi.winAttention({ title: 'Killian 2', body: tf('ui.native.taskDone', String(name || '')) }).catch(() => {});
    return true;
  } catch { return false; }
}

// ───────────────────────── ติดตั้ง ─────────────────────────

/**
 * เรียกครั้งเดียวตอน DOM พร้อม — **ก่อนทุกทางแยก** (โหมดเทส / หน้าต่างแผงที่ฉีกออก ก็ต้องได้)
 * @param {{openProject?:Function, importScript?:Function, insertImage?:Function, openGallery?:Function, panelWin?:boolean}} hooks
 */
export function initNativeShell(hooks = {}) {
  if (NS.inited) return false;
  NS.inited = true;
  Object.assign(HOOKS, hooks);
  const plat = (window.kapi && kapi.platform) || 'linux';
  NS.platform = plat;
  const b = document.body;
  b.classList.add(plat === 'win32' ? 'k-os-win' : plat === 'darwin' ? 'k-os-mac' : 'k-os-linux');
  installMiddleClickGuard();
  installOsDrop(!hooks.panelWin);
  if (hooks.panelWin) return true;                  // หน้าต่างแผงใช้ขอบหน้าต่างของ OS ทั้งชุดอยู่แล้ว
  // ปุ่มหน้าต่างของระบบ (Windows/macOS) = ซ่อนปุ่มที่วาดเอง เหลือที่ว่างไว้ให้ปุ่มของระบบ
  NS.native = plat === 'win32' || plat === 'darwin';
  b.classList.toggle('k-native-caption', NS.native);
  try {
    if (kapi.onWinState) kapi.onWinState(applyWinState);
    if (kapi.winState) kapi.winState().then(applyWinState).catch(() => {});
  } catch (e) { log('warn', 'win state', e); }
  if (plat !== 'darwin') installMenubarKeys();       // macOS: เมนูอยู่บนแถบเมนูของระบบ
  // ขนาดแถบชื่อเปลี่ยน (ย่อ/ขยายเปลือกโปรแกรม · ตัวหนังสือ) → ปุ่มของระบบสูงเท่ากัน
  try { new ResizeObserver(() => syncWindowChrome()).observe($('#titlebar')); } catch {}
  syncWindowChrome();
  return true;
}
