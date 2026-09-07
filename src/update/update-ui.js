// src/update/update-ui.js — [alpha.135] หน้าตาของระบบอัปเดต
//
// ตรรกะทั้งหมด (ที่มา · เทียบเวอร์ชัน · เลือกไฟล์แนบ · ด่านตรวจลิงก์) อยู่ที่ `update-check.js`
// ไฟล์นี้ทำแค่สามอย่าง: ถาม main · วาดกล่อง · จำคำตอบของผู้ใช้ลงค่าระดับผู้ใช้
//
// ทางเข้ามีสามทางตามที่ผู้ใช้สั่ง แต่ **เดินผ่าน `checkForUpdates()` ตัวเดียวกันหมด**:
//   1. สวิตช์ในตั้งค่า → อัตโนมัติ  (เปิด/ปิดการตรวจตอนเปิดโปรแกรม + ปุ่มตรวจเดี๋ยวนี้)
//   2. ตอนเปิดโปรแกรม ก่อนเข้าโปรเจกต์/หน้าแรก (เงียบเมื่อไม่มีอะไรใหม่)
//   3. เมนู ช่วยเหลือ → ตรวจหาอัปเดต…

import { el, state, log, setStatus, t, tf } from '../core.js';
import { escClose } from '../ui.js';
import { decideUpdate, shouldNotify, progressText, UPDATE_GIT_URL } from './update-check.js';

/** ค่าอัปเดตระดับผู้ใช้ (อ่านจากไฟล์จริงเสมอ — ตอนบูตยังไม่มี state.settings) */
async function readCfg() {
  let g = {};
  try { g = (await kapi.readGlobalSettings()) || {}; } catch {}
  return {
    updateCheck: g.updateCheck !== false,
    updateSkip: String(g.updateSkip || ''),
    updateLast: +g.updateLast || 0,
    updateLastVersion: String(g.updateLastVersion || ''),
  };
}
/** เขียนค่ากลับทีละคีย์ผ่านทางเดียวกับสวิตช์ในเมนู (merge ไม่ทับทั้งไฟล์) */
async function saveCfg(patch) {
  const { saveGlobalSetting } = await import('../app.js');
  for (const [k, v] of Object.entries(patch)) await saveGlobalSetting(k, v);
}

/**
 * ตรวจหาอัปเดต — ทางเข้าหลักของทั้งระบบ
 * @param {object} o
 * @param {boolean} [o.silent] เงียบเมื่อไม่มีอะไรใหม่ (ใช้ตอนเปิดโปรแกรม)
 * @returns {Promise<object|null>} ผลการตัดสินจาก decideUpdate
 */
export async function checkForUpdates({ silent = false } = {}) {
  let src = null;
  try { src = await kapi.updateSource(); } catch (e) { log('warn', t('ui.upd.failSource'), e); }
  if (!src) { if (!silent) setStatus(t('ui.upd.failSource')); return null; }

  if (!silent) setStatus(t('ui.upd.checking'));
  const cfg = await readCfg();
  let res = null;
  try { res = await kapi.updateFetch(); } catch (e) { res = { ok: false, error: String((e && e.message) || e) }; }
  if (!res || !res.ok) {
    const msg = tf('ui.upd.failNet', (res && res.error) || '?');
    log('warn', msg);
    if (!silent) { setStatus(msg); await messageDialog(t('ui.upd.title'), msg, src); }
    return null;
  }

  const info = decideUpdate({
    current: src.current, releases: res.releases, manifestVersion: res.manifestVersion,
    skip: cfg.updateSkip, platform: src.platform,
  });
  await saveCfg({ updateLast: Date.now(), updateLastVersion: info.version || '' });

  if (silent && !shouldNotify(info)) return info;
  await updateDialog(info, src);
  return info;
}

/** เรียกตอนเปิดโปรแกรม — ปิดสวิตช์ไว้ = ไม่ติดต่อเน็ตเลย */
export async function startupUpdateCheck() {
  try { kapi.updateCleanup && kapi.updateCleanup(); } catch {}   // ลบซากไฟล์เก่าของครั้งก่อน
  const cfg = await readCfg();
  if (!cfg.updateCheck) return null;
  try { return await checkForUpdates({ silent: true }); } catch (e) { log('warn', t('ui.upd.failCheck'), e); return null; }
}

// ───────────────────────── กล่อง ─────────────────────────

/** กล่องข้อความสั้น ๆ (ตรวจแล้วไม่มีอะไรใหม่ / ติดต่อไม่ได้) */
function messageDialog(title, msg, src) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-upd-dlg');
    box.append(el('div', 'k-dlg-title', title));
    box.append(el('div', null, msg));
    if (src) box.append(sourceLine(src));
    const btns = el('div', 'k-dlg-btns');
    const ok = el('button', 'k-ok', t('ui.common.close'));
    const done = () => { ov.remove(); resolve(); };
    ok.onclick = done;
    btns.append(ok);
    box.append(btns);
    ov.append(box); document.body.append(ov);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) done(); });
    escClose(ov, done);
    ok.focus();
  });
}

/** บรรทัด "แหล่งอัปเดต" — ผู้ใช้เห็นกับตาว่ามาจากรีโปไหน */
function sourceLine(src) {
  const row = el('div', 'k-upd-src');
  row.append(el('span', 'k-upd-src-label', t('ui.upd.sourceLabel')));
  const link = el('span', 'k-credit-link k-upd-src-url', (src && src.gitUrl) || UPDATE_GIT_URL);
  link.onclick = () => { try { kapi.openExternal(link.textContent); } catch {} };
  row.append(link);
  return row;
}

const row2 = (label, value) => {
  const r = el('div', 'k-upd-row');
  r.append(el('span', 'k-upd-k', label), el('span', 'k-upd-v', value));
  return r;
};

/**
 * กล่องหลัก — "มีรุ่นใหม่ จะแทนที่หรือข้ามไป"
 * @param {object} info ผลจาก decideUpdate
 * @param {object} src ผลจาก kapi.updateSource()
 */
export function updateDialog(info, src) {
  return new Promise((resolve) => {
    const st = info && info.status;
    if (st === 'latest') { resolve(messageDialog(t('ui.upd.title'), t('ui.upd.upToDate'), src)); return; }
    if (st === 'none') { resolve(messageDialog(t('ui.upd.title'), t('ui.upd.noRelease'), src)); return; }

    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-upd-dlg');
    box.append(el('div', 'k-dlg-title',
      st === 'skipped' ? t('ui.upd.skippedTitle') : t('ui.upd.foundTitle')));
    box.append(row2(t('ui.upd.current'), info.current));
    box.append(row2(t('ui.upd.latest'), info.version || '—'));
    if (info.assetName) box.append(row2(t('ui.upd.file'), info.assetName));
    if (st === 'noAsset') box.append(el('div', 'k-hint', t('ui.upd.noAsset')));
    if (st === 'repoOnly') box.append(el('div', 'k-hint', tf('ui.upd.repoNewer', info.version)));
    if (st === 'skipped') box.append(el('div', 'k-hint', tf('ui.upd.skippedHint', info.version)));
    if (st === 'update' && !src.canReplace) box.append(el('div', 'k-hint', t('ui.upd.manual')));
    box.append(sourceLine(src));

    // บันทึกการเปลี่ยนแปลงของรุ่นนั้น — ข้อความจาก GitHub = ของนอก ห้ามใส่เป็น HTML
    if (info.notes) {
      box.append(el('div', 'k-upd-notes-head', t('ui.upd.notes')));
      const pre = el('pre', 'k-upd-notes');
      pre.textContent = info.notes.length > 4000 ? info.notes.slice(0, 4000) + '…' : info.notes;
      box.append(pre);
    }

    const prog = el('div', 'k-upd-prog');
    prog.hidden = true;
    const bar = el('div', 'k-upd-bar'); const fill = el('div', 'k-upd-fill');
    bar.append(fill);
    const ptxt = el('div', 'k-hint k-upd-ptxt');
    prog.append(bar, ptxt);
    box.append(prog);

    const btns = el('div', 'k-dlg-btns');
    const close = (v) => { ov.remove(); resolve(v); };

    if (st === 'update' || st === 'skipped') {
      const go = el('button', 'k-ok', src.canReplace ? t('ui.upd.replace') : t('ui.upd.download'));
      go.onclick = () => runInstall(info, src, { box, btns, prog, fill, ptxt, close });
      btns.append(go);
    }
    if (st === 'noAsset' || st === 'repoOnly' || !info.assetUrl) {
      const open = el('button', 'k-ok', t('ui.upd.openPage'));
      open.onclick = () => { try { kapi.openExternal(info.url); } catch {} close('open'); };
      btns.append(open);
    }
    if (st !== 'skipped' && info.version) {
      const skip = el('button', 'cmp-mini', t('ui.upd.skip'));
      skip.onclick = async () => {
        await saveCfg({ updateSkip: info.version });
        setStatus(tf('ui.upd.skipped', info.version));
        close('skip');
      };
      btns.append(skip);
    }
    const later = el('button', 'k-cancel', t('ui.upd.later'));
    later.onclick = () => close('later');
    btns.append(later);
    box.append(btns);

    ov.append(box); document.body.append(ov);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close('later'); });
    escClose(ov, () => close('later'));
    (btns.querySelector('.k-ok') || later).focus();
  });
}

/** ดาวน์โหลด → แทนที่ → ถามเรื่องงานค้าง → เปิดใหม่ */
async function runInstall(info, src, ui) {
  const { btns, prog, fill, ptxt, close } = ui;
  for (const b of btns.querySelectorAll('button')) b.disabled = true;
  prog.hidden = false;
  ptxt.textContent = t('ui.upd.downloading');
  let off = null;
  try { off = kapi.onUpdateProgress(({ received, total }) => {
    ptxt.textContent = progressText(received, total);
    fill.style.width = total ? Math.min(100, Math.round(received / total * 100)) + '%' : '100%';
  }); } catch {}

  let dl = null;
  try { dl = await kapi.updateDownload(info.assetUrl, info.assetName); }
  catch (e) { dl = { ok: false, error: String((e && e.message) || e) }; }
  try { off && off(); } catch {}

  if (!dl || !dl.ok) {
    const msg = dl && dl.error === 'blocked' ? t('ui.upd.badUrl') : tf('ui.upd.failDl', (dl && dl.error) || '?');
    log('error', msg);
    ptxt.textContent = msg;
    for (const b of btns.querySelectorAll('button')) b.disabled = false;
    return;
  }

  ptxt.textContent = t('ui.upd.installing');
  let ins = null;
  try { ins = await kapi.updateInstall(dl.path); }
  catch (e) { ins = { ok: false, mode: 'manual', path: dl.path, error: String((e && e.message) || e) }; }

  if (ins && ins.ok && ins.mode === 'replaced') {
    ptxt.textContent = t('ui.upd.installOk');
    log('info', t('ui.upd.installOk') + ' ' + info.version);
    const go = el('button', 'k-ok', t('ui.upd.restartNow'));
    go.onclick = async () => {
      close('restart');
      // [กฎข้อ 1] เปิดใหม่ = ปิดโปรแกรม → ต้องผ่านรายการงานค้างชุดเดียวกับตอนกดออก
      const { confirmQuit } = await import('../app.js');
      await confirmQuit({ quit: () => kapi.updateRestart() });
    };
    const later = el('button', 'k-cancel', t('ui.upd.later'));
    later.onclick = () => close('installed');
    btns.replaceChildren(go, later);
    go.focus();
    return;
  }

  // แทนที่เองไม่ได้ (ไม่ใช่ไฟล์พกพา / เขียนไม่ได้) → บอกที่อยู่ไฟล์แล้วให้ผู้ใช้ทำเอง
  const why = ins && ins.error && ins.error !== 'not-exe' ? tf('ui.upd.failInstall', ins.error) : t('ui.upd.manual');
  ptxt.textContent = why + ' — ' + ((ins && ins.path) || dl.path);
  const rev = el('button', 'k-ok', t('ui.upd.reveal'));
  rev.onclick = () => { try { kapi.revealInOS((ins && ins.path) || dl.path); } catch {} };
  const later = el('button', 'k-cancel', t('ui.common.close'));
  later.onclick = () => close('manual');
  btns.replaceChildren(rev, later);
  rev.focus();
}

// ───────────────────────── ช่องในหน้าตั้งค่า ─────────────────────────

/**
 * สร้างส่วน "อัปเดตโปรแกรม" ในตั้งค่า → อัตโนมัติ
 * (สร้างด้วยโค้ดเหมือน `buildNetColorFields` — ตัวเลขที่โชว์มาจากค่าจริง ไม่ใช่ HTML ตายตัว)
 * @returns {HTMLInputElement|null} ช่องติ๊ก "ตรวจตอนเปิดโปรแกรม" (ตัวบันทึกอ่านค่าจากตัวนี้)
 */
export function buildUpdateFields(box, s) {
  const host = box.querySelector('#st-update-host');
  if (!host) return null;
  host.replaceChildren();

  const chkRow = el('div', 'k-row');
  const lab = el('label', null, t('ui.upd.autoLabel'));
  lab.append(el('span', 'k-hint', t('ui.upd.autoHint')));
  const chk = el('input');
  chk.type = 'checkbox'; chk.id = 'st-update';
  chk.checked = s.updateCheck !== false;
  chkRow.append(lab, chk);
  host.append(chkRow);

  const info = el('div', 'k-upd-set');
  info.append(row2(t('ui.upd.current'), kapi.appVersion || '—'));
  info.append(row2(t('ui.upd.lastCheck'),
    s.updateLast ? new Date(+s.updateLast).toLocaleString() : t('ui.upd.never')));
  const src = el('div', 'k-upd-src');
  src.append(el('span', 'k-upd-src-label', t('ui.upd.sourceLabel')));
  const link = el('span', 'k-credit-link k-upd-src-url', UPDATE_GIT_URL);
  link.title = t('ui.upd.sourceHint');
  link.onclick = () => { try { kapi.openExternal(UPDATE_GIT_URL); } catch {} };
  src.append(link);
  info.append(src);
  host.append(info);

  const btns = el('div', 'k-upd-setbtns');
  const now = el('button', 'k-key-btn', t('ui.upd.checkNow'));
  now.id = 'st-update-now';
  now.onclick = async () => {
    now.disabled = true;
    try { await checkForUpdates({ silent: false }); } finally { now.disabled = false; }
  };
  btns.append(now);

  const skipped = String(s.updateSkip || '');
  const clear = el('button', 'k-reset-btn', tf('ui.upd.skipClear', skipped || '—'));
  clear.id = 'st-update-unskip';
  clear.disabled = !skipped;
  clear.onclick = async () => {
    s.updateSkip = '';
    await saveCfg({ updateSkip: '' });
    clear.disabled = true;
    clear.textContent = tf('ui.upd.skipClear', '—');
    setStatus(t('ui.upd.skipCleared'));
  };
  btns.append(clear);
  host.append(btns);
  return chk;
}

/** สถานะสำหรับ e2e/บันทึก — ไม่มีผลกับหน้าจอ */
export function updateSettingsSnapshot() {
  const s = state.settings || {};
  return { on: s.updateCheck !== false, skip: String(s.updateSkip || ''), last: +s.updateLast || 0 };
}
