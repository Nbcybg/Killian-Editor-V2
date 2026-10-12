// src/bugs/bug-ui.js — [alpha.170] กล่อง "รายงานบั๊ก / ขอฟีเจอร์" + กล่อง "สถานะบั๊กและคำขอ"
//
// ทางเข้า (ทุกทางเรียกสองฟังก์ชันนี้ผ่านคำสั่ง `bug-report` / `bug-status` ใน handleCommand):
//   ปุ่มท้ายแถบสถานะ (ถัดจากปุ่มหน้าแรก) · กล่อง "เกี่ยวกับ" · เมนู ช่วยเหลือ
//   ขอฟีเจอร์ = กล่องรายงานเดียวกัน เปิดในโหมดขอฟีเจอร์ (คำสั่ง `feature-request` → openBugReport({ kind: 'feature' }))
//
// ตรรกะทั้งหมดอยู่ `bug-core.js` (บริสุทธิ์ · unit `bug-core`) — ไฟล์นี้มีแค่ วาด + เน็ต/เบราว์เซอร์/คลิปบอร์ด
//   · "ส่งรายงาน" ส่งตรงจากโปรแกรมเข้าตัวกลางของผู้ดูแล (bug-config.js → tools/bug-relay) ซึ่งเปิด Issue ให้ — ผู้ใช้ไม่ต้องมีบัญชีอะไร
//     ส่งเฉพาะตอนผู้ใช้กดปุ่มส่ง · สิ่งที่แนบอัตโนมัติมีแค่ รุ่น · ระบบ · ภาษา (ไม่มีทางไฟล์ ไม่มี log ไม่มีเนื้อเรื่อง) และโชว์ให้เห็นในกล่อง
//   · สถานะบั๊กอ่านจาก API สาธารณะของ GitHub ผ่าน `kapi.httpFetch` (main) — ไม่มีคีย์ ไม่ต้องล็อกอิน
import { el, log, setStatusAction, setStatusError, t, tf } from '../core.js';
import { langInfo } from '../i18n.js';
import { escClose, toast } from '../ui.js';
import { icon } from '../icons.js';
import { fmtDate, fmtDateTime, cmpText } from '../locale.js';
import { BUG_FETCH_TIMEOUT_MS } from '../timing.js';
import { BUG_RELAY_URL, BUG_CONTACT } from './bug-config.js';
import {
  BUG_LIST_URL, BUG_MAX_PAGES, BUG_STATUSES, REPORT_KINDS, bugApiUrl, bugUrl, bugVersions,
  buildMailto, buildRelayRequest, buildReportBody, cacheFresh, contactKind, countByKind, countByStatus, envLine, filterBugs, isRelayUrl, mergeBugs,
  parseCache, pendingBug, prunePending, readIssuesResponse, readRelayResponse, reportKind, reportTitle, sortBugs, statusKey, withPending,
} from './bug-core.js';

// ───────── เน็ต/เบราว์เซอร์/คลิปบอร์ด — จุดเดียว (e2e สลับเป็นของปลอมด้วย setBugIo ไม่เปิดเบราว์เซอร์/ไม่ส่งรายงานจริง) ─────────
const io = {
  relay: () => BUG_RELAY_URL,
  contact: () => BUG_CONTACT,
  post: (url, options) => kapi.httpFetch(url, { ...options, __timeoutMs: BUG_FETCH_TIMEOUT_MS }),
  fetch: (url) => kapi.httpFetch(url, { headers: { Accept: 'application/vnd.github+json' }, __timeoutMs: BUG_FETCH_TIMEOUT_MS }),
  open: (url) => kapi.openExternal(url),
  copy: (text) => kapi.clipboardWrite(text),
};
/** สลับตัวต่อออกนอกโปรแกรม (เทส) — คืนฟังก์ชันคืนค่าเดิม */
export function setBugIo(patch) {
  const old = { ...io };
  Object.assign(io, patch || {});
  return () => { Object.assign(io, old); };
}

const CACHE_KEY = 'k2-bug-cache';
const DRAFT_KEY = 'k2-bug-draft';
let _cache = null;
function readCache() {
  if (_cache) return _cache;
  try { _cache = parseCache(localStorage.getItem(CACHE_KEY)); } catch { _cache = null; }
  return _cache;
}
function writeCache(bugs) {
  _cache = { ts: Date.now(), bugs };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(_cache)); } catch {}
}
/** ล้างรายการที่จำไว้ (เทส) */
export function clearBugCache() { _cache = null; try { localStorage.removeItem(CACHE_KEY); } catch {} }

// บั๊กที่เครื่องนี้เพิ่งส่ง — เติมเข้ารายการระหว่างที่ GitHub ยังไม่ส่งมา (ดู withPending ใน bug-core.js)
const SENT_KEY = 'k2-bug-sent';
function readSent() {
  try { return prunePending(JSON.parse(localStorage.getItem(SENT_KEY) || '[]')); } catch { return []; }
}
function rememberSent(num, title, version, kind) {
  const row = pendingBug(num, title, version, Date.now(), kind);
  if (!row) return;
  try { localStorage.setItem(SENT_KEY, JSON.stringify(prunePending([row, ...readSent()]))); } catch {}
}
/** ล้างรายการที่เพิ่งส่ง (เทส) */
export function clearBugSent() { try { localStorage.removeItem(SENT_KEY); } catch {} }

/** สภาพแวดล้อมที่แนบไปกับรายงาน — รุ่น · ระบบ · ภาษา เท่านั้น */
export function bugEnv() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const os = /\(([^)]+)\)/.exec(ua);
  const elv = /Electron\/([\d.]+)/.exec(ua);
  return {
    version: (typeof kapi !== 'undefined' && kapi.appVersion) || '',
    platform: (typeof kapi !== 'undefined' && kapi.platform) || '',
    os: os ? os[1].split(';')[0].trim() : '',
    lang: langInfo.code || '',
    runtime: elv ? 'Electron ' + elv[1] : '',
  };
}

/** อ่านรายการบั๊กทุกหน้า — หน้าแรกล้ม = คืนเหตุ · หน้าหลังล้ม = ใช้เท่าที่อ่านได้ */
export async function fetchBugs() {
  let all = [];
  for (let p = 1; p <= BUG_MAX_PAGES; p++) {
    let res = null;
    try { res = await io.fetch(bugApiUrl(p)); }
    catch (e) { res = { status: 0, netError: true, error: String((e && e.message) || e) }; }
    const r = readIssuesResponse(res);
    if (!r.ok) { if (p === 1) return r; break; }
    all = mergeBugs(all, r.bugs);
    if (!r.more) break;
  }
  return { ok: true, bugs: all };
}

const ERR_KEYS = { net: 'ui.bug.errNet', rate: 'ui.bug.errRate', http: 'ui.bug.errHttp', parse: 'ui.bug.errParse' };
function errorText(r) {
  const key = ERR_KEYS[r && r.code] || 'ui.bug.errNet';
  return r && r.code === 'http' ? tf(key, r.status || '?') : t(key);
}

async function openInBrowser(url) {
  // [bug hunt] main ตอบ false เมื่อไม่ยอมเปิดลิงก์ (ไม่ throw) — เดิมถือว่าเปิดแล้ว ผู้ใช้กดแล้วเงียบ
  try { if ((await io.open(url)) === false) throw new Error('refused'); return true; }
  catch (e) { log('warn', 'bug: open browser failed', e); setStatusError(t('ui.bug.openFail')); return false; }
}

// ══════════════════════════ รายงานบั๊ก ══════════════════════════

function readDraft() {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d && typeof d === 'object' ? d : {}; }
  catch { return {}; }
}
function saveDraft(d) {
  try {
    // ชนิดที่เลือกไว้ถูกจำไปกับข้อความ (ร่างที่ไม่มีข้อความเลย = ไม่มีอะไรให้จำ)
    if (d && (d.title || d.what || d.steps || d.expected)) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

const SEND_ERR_KEYS = { net: 'ui.bug.sendNet', rate: 'ui.bug.sendRate', clock: 'ui.bug.sendClock', http: 'ui.bug.sendFail', parse: 'ui.bug.sendFail' };
function sendErrorText(r) {
  const key = SEND_ERR_KEYS[r && r.code] || 'ui.bug.sendNet';
  return key === 'ui.bug.sendFail' ? tf(key, (r && r.status) || '?') : t(key);
}

/**
 * [alpha.170 · ขอฟีเจอร์] ข้อความของกล่องรายงานตามชนิด — ตารางคีย์เต็ม (ห้ามประกอบคีย์จากชิ้นส่วน)
 * ช่องกรอกสามช่อง (what/steps/expected) ใช้ร่วมกัน เปลี่ยนแค่คำถาม: บั๊ก = เกิดอะไร/ทำซ้ำยังไง/ควรเป็นยังไง ·
 * ขอฟีเจอร์ = อยากได้อะไร/ช่วยอะไร/ตอนนี้ทำยังไง
 */
const KIND_TEXT = {
  bug: {
    tab: 'ui.bug.kindBug', title: 'ui.bug.reportTitle', send: 'ui.bug.btnSend', sent: 'ui.bug.sentOk',
    fTitlePh: 'ui.bug.fTitlePh', fWhat: 'ui.bug.fWhat', fWhatPh: 'ui.bug.fWhatPh',
    fSteps: 'ui.bug.fSteps', fStepsPh: 'ui.bug.fStepsPh', fExpected: 'ui.bug.fExpected', fExpectedPh: 'ui.bug.fExpectedPh',
  },
  feature: {
    tab: 'ui.bug.kindFeature', title: 'ui.bug.featureTitle', send: 'ui.bug.btnSendFeature', sent: 'ui.bug.sentOkFeature',
    fTitlePh: 'ui.bug.fTitlePhFeature', fWhat: 'ui.bug.fWant', fWhatPh: 'ui.bug.fWantPh',
    fSteps: 'ui.bug.fWhy', fStepsPh: 'ui.bug.fWhyPh', fExpected: 'ui.bug.fNow', fExpectedPh: 'ui.bug.fNowPh',
  },
};
/** ชื่อชนิดในช่องกรองของกล่องสถานะ (มีตัวเลข) */
const KIND_FILTER_KEYS = { all: 'ui.bug.fltKindAll', bug: 'ui.bug.fltKindBug', feature: 'ui.bug.fltKindFeature' };

/**
 * กล่องรายงานบั๊ก — กรอก → "ส่งรายงาน" (ส่งตรงจากโปรแกรมเข้าตัวกลางของผู้ดูแล) · "คัดลอกรายงาน" (ส่งทางที่กำหนด)
 * ข้อความที่พิมพ์ค้างถูกจำไว้ (ปิดกล่องโดยไม่ได้ส่ง เปิดใหม่ยังอยู่ · ส่งไม่สำเร็จก็ยังอยู่) · ส่งสำเร็จแล้วจึงล้าง
 * @param {{kind?:'bug'|'feature'}} [opts] kind = ชนิดที่เลือกไว้ตอนเปิด (ไม่ส่ง = ชนิดของร่างที่ค้าง · ไม่มีร่าง = บั๊ก)
 * @returns {HTMLElement} ตัว overlay
 */
export function openBugReport(opts = {}) {
  document.querySelectorAll('.k-overlay.k-bug-report-ov').forEach((o) => o.remove());
  const ov = el('div', 'k-overlay k-bug-report-ov');
  const box = el('div', 'k-dialog k-wide k-bug-report');
  const dlgTitle = el('div', 'k-dlg-title', t('ui.bug.reportTitle'));
  box.append(dlgTitle);
  const body = el('div', 'k-bug-form');
  // [alpha.170 · ขอฟีเจอร์] สวิตช์ชนิดของรายงาน — อยู่บนสุด เพราะคำถามของทุกช่องข้างล่างเปลี่ยนตาม
  const kindBar = el('div', 'k-bug-kinds');
  kindBar.setAttribute('role', 'radiogroup');
  kindBar.setAttribute('aria-label', t('ui.bug.kindLabel'));
  const kindBtns = {};
  for (const k of REPORT_KINDS) {
    const b = el('button', 'k-bug-kind', t(KIND_TEXT[k].tab));
    b.type = 'button';
    b.dataset.kind = k;
    b.setAttribute('role', 'radio');
    kindBar.append(b);
    kindBtns[k] = b;
  }
  body.append(kindBar);
  body.append(el('div', 'k-hint k-bug-intro', t('ui.bug.reportIntro')));

  const relay = String(io.relay() || '');
  const canSend = isRelayUrl(relay);
  // รุ่นที่ยังไม่ได้ตั้งตัวกลาง: บอกตรง ๆ ว่าส่งจากโปรแกรมไม่ได้ (ไม่ปล่อยให้กดแล้วเงียบ)
  if (!canSend) body.append(el('div', 'k-bug-off', t('ui.bug.sendOff')));
  // "ทางที่กำหนด" อีกทางหนึ่ง (อีเมลของผู้ดูแล) — เป็นข้อมูลจาก bug-config.js วาดด้วย textContent
  // คลิกที่อยู่ = คัดลอกรายงานแล้วเปิดอีเมลใหม่ถึงที่อยู่นั้น (ผูกตัวรับคลิกหลังประกาศช่องกรอก — ดู wireContact ข้างล่าง)
  const contact = io.contact() || {};
  const cKind = contactKind(contact);
  let contactName = null;
  if (cKind) {
    const line = el('div', 'k-hint k-bug-intro k-bug-contact');
    line.append(document.createTextNode(t('ui.bug.contactLine') + ' '));
    contactName = el('span', 'k-bug-contact-name k-selectable', String(contact.label).trim().slice(0, 120));
    contactName.dataset.kind = cKind;
    line.append(contactName);
    body.append(line);
  }

  const draft = readDraft();
  let kind = reportKind(opts.kind || draft.kind);
  const fieldLabels = {};
  const field = (id, labelKey, phKey, rows, value) => {
    const wrap = el('div', 'k-bug-field');
    const lb = el('label', 'k-bug-label', t(labelKey));
    fieldLabels[id] = lb;
    lb.htmlFor = id;
    const inp = el(rows ? 'textarea' : 'input', 'k-dlg-input' + (rows ? ' k-bug-ta' : ''));
    inp.id = id;
    if (rows) inp.rows = rows; else inp.type = 'text';
    inp.placeholder = t(phKey);
    inp.value = String(value || '');
    wrap.append(lb, inp);
    body.append(wrap);
    return inp;
  };
  const fTitle = field('k-bug-f-title', 'ui.bug.fTitle', 'ui.bug.fTitlePh', 0, draft.title);
  fTitle.maxLength = 200;
  const fWhat = field('k-bug-f-what', 'ui.bug.fWhat', 'ui.bug.fWhatPh', 3, draft.what);
  const fSteps = field('k-bug-f-steps', 'ui.bug.fSteps', 'ui.bug.fStepsPh', 3, draft.steps);
  const fExpected = field('k-bug-f-expected', 'ui.bug.fExpected', 'ui.bug.fExpectedPh', 2, draft.expected);

  const env = bugEnv();
  const envBox = el('div', 'k-bug-env');
  envBox.append(el('div', 'k-bug-label', t('ui.bug.envHead')),
                el('div', 'k-bug-env-line k-selectable', envLine(env)),
                el('div', 'k-hint', t('ui.bug.envNote')));
  body.append(envBox);
  // ผลของการส่งที่ไม่สำเร็จ — อยู่ในกล่อง (แถบสถานะอยู่หลังกล่อง มองไม่เห็น)
  const errBox = el('div', 'k-bug-err');
  errBox.setAttribute('role', 'alert');
  body.append(errBox);
  const showErr = (msg) => { errBox.textContent = msg || ''; if (msg) setStatusError(msg); };

  const values = () => ({ title: fTitle.value, what: fWhat.value, steps: fSteps.value, expected: fExpected.value, kind });
  for (const f of [fTitle, fWhat, fSteps, fExpected]) f.addEventListener('input', () => { saveDraft(values()); if (errBox.textContent) errBox.textContent = ''; });

  const labels = () => { const K = KIND_TEXT[kind]; return { what: t(K.fWhat), steps: t(K.fSteps), expected: t(K.fExpected), env: t('ui.bug.envHead') }; };
  const fullBody = () => buildReportBody({ ...values(), env, labels: labels(), kind });
  /** หัวข้อว่าง = ชี้ช่องให้กรอก (ไม่ส่ง/ไม่คัดลอกรายงานเปล่า) */
  const ready = () => {
    if (reportTitle(fTitle.value)) return true;
    showErr(t('ui.bug.needTitle'));
    fTitle.classList.add('k-set-flash');
    setTimeout(() => fTitle.classList.remove('k-set-flash'), 1800);
    fTitle.focus();
    return false;
  };
  const close = () => ov.remove();

  // ช่องทางที่กำหนด: อีเมล = คัดลอกรายงาน + เปิดอีเมลใหม่ (หัวเรื่องใส่ให้ · เนื้อวางจากคลิปบอร์ด) · ลิงก์ = เปิดในเบราว์เซอร์
  if (contactName && cKind !== 'text') {
    contactName.classList.add('k-bug-link');
    contactName.tabIndex = 0;
    contactName.setAttribute('role', 'link');
    if (cKind === 'email') contactName.title = t('ui.bug.contactMailTip');
    const go = async () => {
      if (cKind === 'link') { openInBrowser(String(contact.url)); return; }
      if (!ready()) return;
      const to = String(contact.label).trim();
      try { await io.copy('# ' + reportTitle(fTitle.value) + '\n\n' + fullBody()); }
      catch (e) { log('warn', 'bug: copy failed', e); showErr(t('ui.bug.copyFail')); return; }
      let opened = false;
      try { opened = (await io.open(buildMailto(to, fTitle.value))) !== false; } catch (e) { log('warn', 'bug: open mail failed', e); }
      log('info', 'bug: report copied for email', { opened });
      toast(tf('ui.bug.contactMailed', to));
    };
    contactName.onclick = go;
    contactName.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  }

  const btns = el('div', 'k-dlg-btns');
  const bStatus = el('button', 'k-bug-go-status', t('ui.bug.btnStatus'));
  bStatus.onclick = () => { close(); openBugStatus(); };
  const bCancel = el('button', 'k-cancel', t('ui.dialogs.cancel'));
  bCancel.onclick = close;
  const bCopy = el('button', 'k-bug-copy', t('ui.bug.btnCopy'));
  bCopy.onclick = async () => {
    if (!ready()) return;
    try {
      await io.copy('# ' + reportTitle(fTitle.value) + '\n\n' + fullBody());
      toast(t('ui.bug.copied'));
      log('info', 'bug: report copied');
    } catch (e) { log('warn', 'bug: copy failed', e); showErr(t('ui.bug.copyFail')); }
  };
  const bSend = el('button', 'k-ok', t('ui.bug.btnSend'));
  bSend.disabled = !canSend;
  let sending = false;
  bSend.onclick = async () => {
    if (sending || !canSend || !ready()) return;
    const req = buildRelayRequest({ relay, title: fTitle.value, body: fullBody(), env, kind });
    if (!req) { showErr(t('ui.bug.sendOff')); return; }
    sending = true;
    showErr('');
    bSend.disabled = true; bCopy.disabled = true;
    bSend.textContent = t('ui.bug.sending');
    let res = null;
    try { res = await io.post(req.url, req.options); }
    catch (e) { res = { status: 0, netError: true, error: String((e && e.message) || e) }; }
    const r = readRelayResponse(res);
    sending = false;
    bSend.disabled = false; bCopy.disabled = false;
    bSend.textContent = t(KIND_TEXT[kind].send);
    if (!r.ok) {
      // ส่งไม่สำเร็จ = ข้อความที่พิมพ์ยังอยู่ครบ (ร่างไม่ถูกล้าง) — ลองใหม่หรือคัดลอกส่งทางอื่นได้
      log('warn', 'bug: report send failed', { kind, code: r.code, status: r.status || 0 });
      showErr(sendErrorText(r));
      return;
    }
    log('info', 'bug: report sent', { kind, num: r.num });
    saveDraft(null);
    rememberSent(r.num, fTitle.value, env.version, kind);
    clearBugCache();                       // รายการที่จำไว้ยังไม่มีบั๊กตัวใหม่ — เปิดกล่องสถานะครั้งถัดไปให้ถามใหม่
    close();
    const msg = tf(KIND_TEXT[kind].sent, '#' + r.num);
    setStatusAction(msg, t('ui.bug.btnStatus'), () => openBugStatus({ force: true }));
    toast(msg);
  };
  btns.append(bStatus, bCancel, bCopy, bSend);

  /** สลับชนิด: หัวกล่อง · คำถาม/คำใบ้ของทุกช่อง · ปุ่มส่ง — ข้อความที่พิมพ์ไว้อยู่ครบ */
  const setKind = (k, user) => {
    kind = reportKind(k);
    const K = KIND_TEXT[kind];
    for (const kk of REPORT_KINDS) {
      const on = kk === kind;
      kindBtns[kk].classList.toggle('on', on);
      kindBtns[kk].setAttribute('aria-checked', on ? 'true' : 'false');
      kindBtns[kk].tabIndex = on ? 0 : -1;
    }
    box.dataset.kind = kind;
    dlgTitle.textContent = t(K.title);
    fTitle.placeholder = t(K.fTitlePh);
    fieldLabels[fWhat.id].textContent = t(K.fWhat); fWhat.placeholder = t(K.fWhatPh);
    fieldLabels[fSteps.id].textContent = t(K.fSteps); fSteps.placeholder = t(K.fStepsPh);
    fieldLabels[fExpected.id].textContent = t(K.fExpected); fExpected.placeholder = t(K.fExpectedPh);
    if (!sending) bSend.textContent = t(K.send);
    if (user) { saveDraft(values()); if (errBox.textContent) errBox.textContent = ''; }
  };
  for (const k of REPORT_KINDS) kindBtns[k].onclick = () => setKind(k, true);
  // กลุ่มตัวเลือก: ลูกศรซ้าย/ขวาย้ายตัวเลือก (Tab เข้ากลุ่มครั้งเดียว)
  kindBar.onkeydown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = REPORT_KINDS[(REPORT_KINDS.indexOf(kind) + (e.key === 'ArrowRight' ? 1 : REPORT_KINDS.length - 1)) % REPORT_KINDS.length];
    setKind(next, true);
    kindBtns[next].focus();
  };
  setKind(kind, false);

  box.append(body, btns);
  ov.append(box);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  escClose(ov, close);
  document.body.append(ov);
  setTimeout(() => { try { fTitle.focus(); } catch {} }, 0);
  return ov;
}

// ══════════════════════════ สถานะบั๊ก ══════════════════════════

/** คอลัมน์ตามลำดับที่ผู้ใช้กำหนด: รหัส · รายละเอียด · สถานะ · พบในรุ่น · วันที่รายงาน · แก้ไขในรุ่น */
const COLS = [
  { key: 'id',       label: 'ui.bug.colId' },
  { key: 'title',    label: 'ui.bug.colTitle' },
  { key: 'status',   label: 'ui.bug.colStatus' },
  { key: 'foundIn',  label: 'ui.bug.colFound' },
  { key: 'reported', label: 'ui.bug.colReported' },
  { key: 'fixedIn',  label: 'ui.bug.colFixed' },
];
const DASH = '—';
/** ตัวกรอง/การเรียงค้างไว้ระหว่างเปิด-ปิดกล่อง (เป็นมุมมอง ไม่ใช่ข้อมูล) */
const VIEW = { q: '', kind: 'all', status: 'all', found: 'all', fixed: 'all', sort: 'id', dir: 'desc' };
/** ล้างมุมมอง (เทส + ปุ่ม "ล้างตัวกรอง") */
export function resetBugView() { Object.assign(VIEW, { q: '', kind: 'all', status: 'all', found: 'all', fixed: 'all', sort: 'id', dir: 'desc' }); }

/**
 * กล่องสถานะบั๊ก — รายการ + ตัวกรอง (คำค้น · สถานะ · พบในรุ่น · แก้ไขในรุ่น) + เรียงตามหัวคอลัมน์
 * เปิดแล้วโชว์รายการที่จำไว้ทันที (ถ้ามี) แล้วค่อยถาม GitHub เมื่อรายการเก่าเกิน BUG_CACHE_MS
 * @param {{force?:boolean}} [opts] force = ถาม GitHub เสมอ
 * @returns {HTMLElement} ตัว overlay (มี `.k2ready` = Promise ที่จบเมื่อโหลดรอบแรกเสร็จ — เทสใช้รอ)
 */
export function openBugStatus(opts = {}) {
  document.querySelectorAll('.k-overlay.k-bug-status-ov').forEach((o) => o.remove());
  const ov = el('div', 'k-overlay k-bug-status-ov');
  const box = el('div', 'k-dialog k-wide k-bug-status');
  box.append(el('div', 'k-dlg-title', t('ui.bug.statusTitle')));

  // ── แถบตัวกรอง ──
  const bar = el('div', 'k-bug-bar');
  const q = el('input', 'k-dlg-input k-bug-q');
  q.type = 'search'; q.placeholder = t('ui.bug.searchPh'); q.value = VIEW.q;
  q.setAttribute('aria-label', t('ui.bug.searchPh'));
  const mkSel = (cls, titleKey) => { const s = el('select', 'k-dlg-select ' + cls); s.title = t(titleKey); s.setAttribute('aria-label', t(titleKey)); return s; };
  const selKind = mkSel('k-bug-f-kind', 'ui.bug.kindLabel');
  const selStatus = mkSel('k-bug-f-status', 'ui.bug.colStatus');
  const selFound = mkSel('k-bug-f-found', 'ui.bug.colFound');
  const selFixed = mkSel('k-bug-f-fixed', 'ui.bug.colFixed');
  const bClear = el('button', 'cmp-mini k-bug-clear', t('ui.bug.clear'));
  const bRefresh = el('button', 'cmp-mini k-bug-refresh');
  bRefresh.append(icon('refresh', 14), document.createTextNode(' ' + t('ui.bug.refresh')));
  bar.append(q, selKind, selStatus, selFound, selFixed, bClear, bRefresh);

  // ── ตาราง ──
  const wrap = el('div', 'k-bug-wrap');
  const table = el('table', 'k-bug-table');
  const thead = el('thead'), headRow = el('tr');
  const ths = {};
  for (const c of COLS) {
    const th = el('th', 'k-bug-c-' + c.key);
    th.scope = 'col';
    const b = el('button', 'k-bug-th');
    b.type = 'button';
    b.dataset.sort = c.key;
    b.title = t('ui.bug.sortTip');
    b.append(el('span', 'k-bug-th-text', t(c.label)), el('span', 'k-bug-th-arrow'));
    b.onclick = () => {
      if (VIEW.sort === c.key) VIEW.dir = VIEW.dir === 'asc' ? 'desc' : 'asc';
      else { VIEW.sort = c.key; VIEW.dir = c.key === 'title' ? 'asc' : 'desc'; }
      draw();
    };
    th.append(b); headRow.append(th); ths[c.key] = th;
  }
  thead.append(headRow);
  const tbody = el('tbody');
  table.append(thead, tbody);
  const msg = el('div', 'k-bug-msg');
  wrap.append(table, msg);

  // ── ท้ายกล่อง ──
  const note = el('div', 'k-bug-note');
  const count = el('span', 'k-bug-count');
  const stamp = el('span', 'k-bug-stamp dim');
  note.append(count, stamp, el('span', 'k-bug-src dim', t('ui.bug.source')));
  const btns = el('div', 'k-dlg-btns');
  const bWeb = el('button', 'k-bug-web', t('ui.bug.openWeb'));
  bWeb.onclick = () => openInBrowser(BUG_LIST_URL);
  const bFeature = el('button', 'k-bug-go-feature', t('ui.bug.featureTitle'));
  const bReport = el('button', 'k-bug-go-report', t('ui.bug.reportTitle'));
  const bClose = el('button', 'k-ok k-cancel', t('ui.common.close'));
  const close = () => ov.remove();
  bReport.onclick = () => { close(); openBugReport({ kind: 'bug' }); };
  bFeature.onclick = () => { close(); openBugReport({ kind: 'feature' }); };
  bClose.onclick = close;
  btns.append(bWeb, bFeature, bReport, bClose);
  box.append(bar, wrap, note, btns);
  ov.append(box);

  /** @type {{bugs:object[]|null, loading:boolean, error:string, ts:number, stale:boolean}} */
  const S = { bugs: null, loading: false, error: '', ts: 0, stale: false };

  const fillSelect = (sel, options, value) => {
    sel.replaceChildren();
    for (const [v, label] of options) { const o = el('option', null, label); o.value = v; sel.append(o); }
    sel.value = options.some(([v]) => v === value) ? value : 'all';
    return sel.value;
  };
  /** ชื่อสถานะในช่องกรอง: ดูชนิดเดียว = ชื่อของชนิดนั้น · ดูรวม = ชื่อของบั๊ก (+ ชื่อของคำขอ เมื่อเรียกต่างกันและในรายการมีคำขอจริง) */
  let hasFeature = false;
  const statusName = (s) => {
    const bug = t(statusKey(s, 'bug')), feat = t(statusKey(s, 'feature'));
    return VIEW.kind === 'feature' ? feat : (VIEW.kind === 'bug' || !hasFeature || bug === feat ? bug : bug + ' / ' + feat);
  };
  const fillFilters = () => {
    const all = S.bugs || [];
    const nk = countByKind(all);
    hasFeature = nk.feature > 0;
    VIEW.kind = fillSelect(selKind, ['all', ...REPORT_KINDS].map((k) => [k, tf(KIND_FILTER_KEYS[k], nk[k])]), VIEW.kind);
    // ตัวเลข/รายชื่อรุ่นของช่องที่เหลือ นับจากชนิดที่กำลังดู
    const list = filterBugs(all, { kind: VIEW.kind });
    const n = countByStatus(list);
    VIEW.status = fillSelect(selStatus, [
      ['all', tf('ui.bug.fltAll', n.all)],
      ['open', tf('ui.bug.fltOpen', n.open)],
      ['closed', tf('ui.bug.fltClosed', n.closed)],
      ...BUG_STATUSES.map((s) => [s, tf('ui.bug.fltOne', statusName(s), n[s])]),
    ], VIEW.status);
    VIEW.found = fillSelect(selFound, [['all', t('ui.bug.fltFoundAll')], ...bugVersions(list, 'foundIn').map((v) => [v, v])], VIEW.found);
    VIEW.fixed = fillSelect(selFixed, [['all', t('ui.bug.fltFixedAll')], ['none', t('ui.bug.fltFixedNone')],
                                       ...bugVersions(list, 'fixedIn').map((v) => [v, v])], VIEW.fixed);
  };

  const cell = (cls, text) => el('td', cls, text || DASH);
  function draw() {
    const all = S.bugs || [];
    const shown = sortBugs(filterBugs(all, VIEW), VIEW.sort, VIEW.dir, cmpText);
    for (const c of COLS) {
      const on = VIEW.sort === c.key;
      ths[c.key].setAttribute('aria-sort', on ? (VIEW.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      const arrow = ths[c.key].querySelector('.k-bug-th-arrow');
      arrow.replaceChildren();
      if (on) arrow.append(icon(VIEW.dir === 'asc' ? 'arrow-up' : 'arrow-down', 12));
    }
    tbody.replaceChildren();
    for (const b of shown) {
      const tr = el('tr', 'k-bug-row');
      tr.dataset.num = String(b.num);
      tr.dataset.status = b.status;
      const idCell = el('td', 'k-bug-c-id');
      const link = el('span', 'k-bug-link', b.id);
      link.tabIndex = 0;
      link.setAttribute('role', 'link');
      link.title = tf('ui.bug.rowTip', b.id);
      const go = () => openInBrowser(bugUrl(b.num));
      link.onclick = go;
      link.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      idCell.append(link);
      const stCell = el('td', 'k-bug-c-status');
      const kd = reportKind(b.kind);
      tr.dataset.kind = kd;
      const chip = el('span', 'k-bug-st', t(statusKey(b.status, kd)));
      chip.dataset.st = b.status;
      // "แก้ไขแล้ว" มีเครื่องหมายถูกนำหน้า — แยกจากสถานะอื่นได้โดยไม่พึ่งสี (ธีมหลักสีลิงก์กับสีเตือนใกล้กัน)
      if (b.status === 'fixed') chip.prepend(icon('check', 11));
      stCell.append(chip);
      const ttl = el('td', 'k-bug-c-title k-selectable');
      // คำขอฟีเจอร์มีป้ายนำหน้ารายละเอียด (ไอคอน + คำ — ไม่พึ่งสี) · บั๊กไม่มีป้าย = หน้าตาเดิม
      if (kd === 'feature') {
        const tag = el('span', 'k-bug-kindtag');
        tag.append(icon('bulb', 11), document.createTextNode(t('ui.bug.kindTag')));
        ttl.append(tag);
      }
      ttl.append(document.createTextNode(b.title || DASH));
      ttl.title = b.title || '';
      tr.append(idCell, ttl, stCell, cell('k-bug-c-foundIn', b.foundIn),
                cell('k-bug-c-reported', fmtDate(b.reported)), cell('k-bug-c-fixedIn', b.fixedIn));
      tbody.append(tr);
    }
    // ข้อความกลางตาราง: กำลังโหลด · ล้ม (ไม่มีรายการให้ดู) · ยังไม่มีบั๊ก · ไม่ตรงตัวกรอง
    let m = '';
    if (S.loading && !all.length) m = t('ui.bug.loading');
    else if (S.error && !all.length) m = S.error;
    else if (!all.length) m = t('ui.bug.empty');
    else if (!shown.length) m = t('ui.bug.noMatch');
    msg.textContent = m;
    msg.dataset.kind = S.loading && !all.length ? 'loading' : (S.error && !all.length ? 'error' : (m ? 'empty' : ''));
    msg.style.display = m ? '' : 'none';
    table.classList.toggle('k-bug-table-empty', !all.length);
    count.textContent = all.length ? tf('ui.bug.count', shown.length, all.length) : '';
    // มีรายการเก่าให้ดูแต่รอบล่าสุดล้ม = บอกทั้งเหตุและเวลาของรายการที่เห็น
    stamp.textContent = !S.ts ? '' : (S.stale ? S.error + ' ' + tf('ui.bug.stale', fmtDateTime(S.ts)) : tf('ui.bug.updated', fmtDateTime(S.ts)));
    stamp.classList.toggle('k-bug-stamp-warn', !!S.stale);
    bRefresh.disabled = S.loading;
    bClear.disabled = !(VIEW.q || VIEW.kind !== 'all' || VIEW.status !== 'all' || VIEW.found !== 'all' || VIEW.fixed !== 'all');
  }

  let round = 0;
  async function load(force) {
    const cache = readCache();
    if (!S.bugs) {
      // รายการที่จำไว้ + บั๊กที่เครื่องนี้เพิ่งส่ง — โชว์ทันที (ถามรายการไม่ได้ก็ยังเห็นของที่เพิ่งส่ง)
      const first = withPending(cache ? cache.bugs : [], readSent());
      if (cache || first.length) { S.bugs = first; S.ts = cache ? cache.ts : 0; fillFilters(); }
    }
    if (!force && cacheFresh(cache)) { S.loading = false; draw(); return; }
    const my = ++round;
    S.loading = true; S.error = ''; S.stale = false;
    draw();
    const r = await fetchBugs();
    if (my !== round || !ov.isConnected) return;       // มีรอบใหม่กว่า / กล่องปิดไปแล้ว
    S.loading = false;
    if (r.ok) {
      writeCache(r.bugs);
      S.bugs = withPending(r.bugs, readSent()); S.ts = Date.now(); S.error = ''; S.stale = false;
      log('info', 'bug: status loaded', { count: r.bugs.length });
    } else {
      S.error = errorText(r);
      S.stale = !!(S.bugs && S.bugs.length);
      log('warn', 'bug: status load failed', { code: r.code, status: r.status || 0 });
    }
    fillFilters();
    draw();
  }

  q.oninput = () => { VIEW.q = q.value; draw(); };
  selKind.onchange = () => { VIEW.kind = selKind.value; fillFilters(); draw(); };
  selStatus.onchange = () => { VIEW.status = selStatus.value; draw(); };
  selFound.onchange = () => { VIEW.found = selFound.value; draw(); };
  selFixed.onchange = () => { VIEW.fixed = selFixed.value; draw(); };
  bClear.onclick = () => {
    const keep = { sort: VIEW.sort, dir: VIEW.dir };
    resetBugView(); Object.assign(VIEW, keep);
    q.value = ''; fillFilters(); draw(); q.focus();
  };
  bRefresh.onclick = () => load(true);

  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  escClose(ov, close);
  document.body.append(ov);
  fillFilters();
  draw();
  ov.k2ready = load(!!opts.force);
  setTimeout(() => { try { q.focus(); } catch {} }, 0);
  return ov;
}
