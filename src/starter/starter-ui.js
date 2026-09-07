// starter-ui.js — แผง Story Starter: หน้ารวม + ตัวสลับหน้า (สเปกข้อ 2–3)
//
// แผงเดียวสลับ 4 หน้า (แนวเดียวกับแผงแชท AI ที่ทำ list → session → detail):
//   list    หน้ารวม starter ทั้งหมด — สร้าง/เปิด/ลบ
//   wizard  ตัวสร้างแบบทีละขั้น
//   home    หน้าของเรื่องหนึ่งเรื่อง = รายการตอน
//   chat    คุยกับ Game Master ในตอนหนึ่ง
//
// **บันทึกอัตโนมัติทุกขั้น** (สเปกข้อ 8): ทุกที่ที่แก้ข้อมูลเรียก `ctx.save()`
// ซึ่งหน่วงรวบให้แล้วใน starter-store.js · จุดที่พลาดไม่ได้ (สลับหน้า/ปิดแผง) ใช้ `{now:true}`

import { $, el, state, setStatus, log } from '../core.js';
import { t, tf } from '../i18n.js';
import { confirmBox } from '../ui.js';
import { aiConfigured } from '../ai-settings.js';
import { searchStarters, starterSummary, starterProgress } from './starter-model.js';
import { stopAllAI } from './starter-ai.js';
import { STEPS } from './starter-steps-def.js';
import {
  listStarters, readStarter, createStarter, deleteStarter,
  autoSaveStarter, writeStarter, flushStarterSaves, imageUrl,
} from './starter-store.js';
import { renderWizard } from './starter-wizard.js';
import { renderStarterHome } from './starter-scenario.js';
import { renderChat, resetChatState } from './starter-chat.js';
import { offerReconcile } from './starter-wiki.js';
import { resetCastEditor, pruneBlank } from './starter-cast.js';
import { exportStarterZip, importStarterZip } from './starter-pack.js';

// สถานะของแผง — แผงเดียวในแอป (ES module: ต้องเก็บใน object ไม่ใช่ let ที่ export)
const S = {
  host: null,
  view: 'list',
  starter: null,      // starter ที่เปิดอยู่
  scenario: null,     // ตอนที่เปิดอยู่ (view === 'chat')
  query: '',
  root: null,         // โปรเจกต์ที่โหลดรายการนี้มา — เปลี่ยนโปรเจกต์ = รีเซ็ต
};

/**
 * [alpha.96] ปิดแผงแล้วของต้องไม่หาย
 *
 * ผู้ใช้รายงาน: "ถ้าเรากดปิด panel ก่อน choice คำตอบหายไป"
 * ต้นตอสองชั้น — (1) เทิร์นแชทเคยบันทึกแบบหน่วงรวบ  (2) ปิดแผงไม่มีใครสั่งเขียนของค้าง
 * ชั้นแรกแก้ที่ starter-chat.js (เขียนทันทีทุกเทิร์น) · ชั้นนี้คือตาข่ายอีกชั้น
 * และถือโอกาสหยุดคำขอ AI ที่ยังวิ่งค้างด้วย ไม่งั้นมันตอบกลับมาใส่หน้าที่ปิดไปแล้ว
 */
let _guardSet = false;
function armCloseGuard() {
  if (_guardSet) return;
  _guardSet = true;
  import('../app.js').then(({ setPanelCloseGuard }) => {
    setPanelCloseGuard('starter', (proceed) => {
      Promise.resolve()
        .then(() => flushStarterSaves())
        .then(() => stopAllAI())
        .catch((e) => log('warn', 'starter: flush on close failed', e))
        .finally(() => proceed());
      return false;             // หน่วงไว้ก่อน แล้วค่อยสั่ง proceed() เองเมื่อเขียนเสร็จ
    });
  }).catch(() => { _guardSet = false; });
}

/** ทางเข้าของแผง (FEATURE_PANELS เรียกตัวนี้) */
export async function renderStarterPanel(host) {
  S.host = host || $('#starter-body');
  if (!S.host) return false;
  armCloseGuard();
  if (!state.root) {
    S.host.innerHTML = '';
    S.host.append(el('div', 'st-empty', t('ui.starter.openProjectFirst')));
    return true;
  }
  if (S.root !== state.root) {          // สลับโปรเจกต์ = เริ่มใหม่หมด
    S.root = state.root; S.view = 'list'; S.starter = null; S.scenario = null; S.query = '';
    resetChatState();
  }
  return draw();
}

/**
 * เปิดแผงจากเมนู/คำสั่ง/ปุ่มบนแถบเครื่องมือ
 *
 * [alpha.122] **บั๊กที่เจอตอนตรวจแถบเครื่องมือ**: เดิมดึง `showPanel` มาจาก `app.js`
 * แต่ `app.js` แค่ **นำเข้า** ตัวนั้นมาใช้เอง ไม่ได้ re-export → ได้ `undefined`
 * → ปุ่ม ✨ Story Starter บนแถบเครื่องมือและเมนูโยน `showPanel is not a function` ทุกครั้ง
 * (เห็นเฉพาะใน log ของแอป · หน้าจอเงียบสนิท เหมือนกดแล้วไม่มีอะไรเกิดขึ้น)
 * แก้โดยดึงจากต้นทางจริง — `renderFeaturePanel` ยัง import จาก app.js ได้ เพราะ export จริง
 */
export async function openStoryStarter() {
  const { showPanel } = await import('../panels/panel-ui.js');
  const { renderFeaturePanel } = await import('../app.js');
  showPanel('starter');
  return renderFeaturePanel('starter');
}

// ───────────────────────── บริบทที่ทุกหน้าใช้ร่วมกัน ─────────────────────────

/**
 * ออกจากตัวสร้าง — ปิดตัวแก้ไขที่ค้าง + ทิ้งการ์ดตัวละครเปล่า แล้ว **บันทึกทันที**
 * ต้องเขียนก่อน `flushStarterSaves()` ไม่งั้นคิวหน่วงรวบจะเขียนของเดิม (ที่ยังมีตัวเปล่า) ทับ
 */
function leaveWizard() {
  resetCastEditor();
  if (!S.starter) return;
  const kept = pruneBlank(S.starter.cast, '');
  if (kept.length !== (S.starter.cast || []).length) {
    S.starter.cast = kept;
    autoSaveStarter(S.starter);
  }
}

function ctxFor() {
  return {
    get starter() { return S.starter; },
    root: state.root,
    /** บันทึก — ปกติหน่วงรวบ · `{now:true}` เขียนทันที (ก่อนสลับหน้า/ปิดแผง) */
    save: async (opts = {}) => {
      if (!S.starter) return false;
      if (opts.now) { await flushStarterSaves(); return writeStarter(S.starter); }
      return autoSaveStarter(S.starter);
    },
    rerender: () => draw(),
    // [alpha.122] ออกจากตัวสร้างเมื่อไหร่ ตัวแก้ไขตัวละครที่ค้างต้องปิดด้วย
    // (สถานะระดับโมดูลอยู่คนละไฟล์ ถ้าไม่ปิด กลับเข้ามาอีกทีจะเจอหน้าแก้ไขคนเก่าแทนรายชื่อ)
    // และเก็บกวาดการ์ดตัวละครเปล่าไปพร้อมกัน — ตัวเปล่าคือสิ่งที่ทำให้ขั้นตัวละคร "ไม่ครบ"
    // ทั้งที่หน้าจอดูเหมือนมีตัวละครแล้ว (บั๊กที่ผู้ใช้รายงานเรื่องปุ่มเสร็จสิ้น)
    goList: async () => {
      leaveWizard();
      await flushStarterSaves();
      S.view = 'list'; S.starter = null; S.scenario = null; draw();
    },
    goWizard: () => { resetCastEditor(); S.view = 'wizard'; draw(); },
    goHome: async () => {
      leaveWizard();
      await flushStarterSaves();
      S.view = 'home'; S.scenario = null; resetChatState(); draw();
    },
    openChat: (sc) => { S.scenario = sc; S.view = 'chat'; resetChatState(); draw(); },
    touchTitle: () => { /* ชื่อเรื่องบนหัว wizard วาดใหม่ตอน rerender อยู่แล้ว */ },
  };
}

async function draw() {
  const host = S.host;
  if (!host) return false;
  try {
    if (S.view === 'wizard' && S.starter) return renderWizard(host, ctxFor());
    if (S.view === 'home' && S.starter) return renderStarterHome(host, ctxFor());
    if (S.view === 'chat' && S.starter && S.scenario) return renderChat(host, ctxFor(), S.scenario);
    return renderList(host);
  } catch (e) {
    log('error', 'starter draw', e);
    host.innerHTML = '';
    host.append(el('div', 'st-err', t('ui.starter.drawFail')));
    return false;
  }
}

// ───────────────────────── หน้ารวม starter ─────────────────────────

async function renderList(host) {
  host.innerHTML = '';
  const wrap = el('div', 'st-list-wrap');
  host.append(wrap);

  const head = el('div', 'st-list-head');
  head.append(el('div', 'st-list-title', '✨ Story Starter'));
  const add = el('button', 'k-ok', '+ ' + t('ui.starter.createNew'));
  add.onclick = () => createFlow();
  head.append(add);
  // นำเข้าจากไฟล์ .zip ที่คนอื่นส่งมา (หรือของตัวเองจากอีกโปรเจกต์)
  const imp = el('button', null, '📥 ' + t('ui.starter.packImport'));
  imp.title = t('ui.starter.packImportHint');
  imp.onclick = async () => {
    const got = await importStarterZip();
    if (!got) return;
    await renderStarterPanel(host);
    // นำเข้ามาจากโปรเจกต์อื่นแน่นอน → เสนอจับคู่ตัวละครกับ Wiki ทันที
    try { if (await offerReconcile(got)) await renderStarterPanel(host); }
    catch (e) { log('warn', 'starter reconcile (import)', e); }
  };
  head.append(imp);
  wrap.append(head);
  wrap.append(el('div', 'st-hint', t('ui.starter.welcomeHint')));

  const rows = await listStarters();

  if (rows.length > 3) {
    const search = el('input', 'wiki-input');
    search.placeholder = t('ui.starter.searchStarter');
    search.value = S.query;
    search.oninput = () => { S.query = search.value; drawGrid(); };
    wrap.append(search);
  }

  const grid = el('div', 'st-grid');
  wrap.append(grid);

  async function drawGrid() {
    grid.innerHTML = '';
    const hit = searchStarters(rows, S.query);
    if (!hit.length) {
      grid.append(el('div', 'st-empty',
        rows.length ? t('ui.starter.noMatch') : t('ui.starter.listEmpty')));
      return;
    }
    for (const s of hit) {
      const card = el('div', 'st-card');
      // ปกแนวตั้ง 3:4 แบบการ์ดนิยายจริง · ไม่ครอบตัด — เห็นสัดส่วนที่ผู้ใช้ตั้งใจ
      const cover = el('div', 'st-img-box st-img-cover st-card-cover');
      const url = await imageUrl(s.slug, s.cover);
      if (url) { const im = el('img'); im.src = url; im.alt = s.name || ''; cover.append(im); }
      else cover.append(el('span', 'st-card-noimg', '📖'));
      card.append(cover);

      const body = el('div', 'st-card-body');
      body.append(el('div', 'st-card-name', s.name || t('ui.starter.untitled')));
      if (s.author) body.append(el('div', 'st-card-author', t('ui.starter.byAuthor') + s.author));
      if (s.blurb) body.append(el('div', 'st-card-blurb', s.blurb));
      const sum = starterSummary(s);
      if (sum) body.append(el('div', 'st-card-sum', sum));
      const prog = starterProgress(s, STEPS);
      if (!s.done) {
        body.append(el('div', 'st-card-draft',
          tf('ui.starter.draftProgress', prog.done, prog.total)));
      }
      card.append(body);

      const btns = el('div', 'st-card-btns');
      const open = el('button', 'k-ok', s.done ? t('ui.starter.open') : t('ui.starter.continueSetup'));
      open.onclick = () => openStarter(s.slug, s.done ? 'home' : 'wizard');
      const exp = el('button', null, '📤');
      exp.title = t('ui.starter.packExport');
      exp.onclick = () => exportStarterZip(s);
      const del = el('button', 'st-danger', t('ui.common.del'));
      del.onclick = async () => {
        if (!(await confirmBox(tf('ui.starter.delAsk', s.name || s.slug), t('ui.common.del')))) return;
        await deleteStarter(s.slug);
        setStatus(t('ui.starter.delDone'));
        renderStarterPanel(host);
      };
      btns.append(open, exp, del);   // ลบไว้ท้ายสุดเสมอ กันกดพลาด
      card.append(btns);
      grid.append(card);
    }
  }
  await drawGrid();
  return true;
}

// ───────────────────────── สร้าง / เปิด ─────────────────────────

/**
 * สร้าง starter ใหม่ — **ด่านตั้งค่า AI อยู่ตรงนี้** ตามสเปกข้อ 3
 * (หน้ารวมยังเปิดดู/ลบของเดิมได้แม้ยังไม่ได้ตั้งค่า AI — ไม่มีเหตุผลจะกันไว้)
 */
async function createFlow() {
  const gate = await aiConfigured();
  if (!gate.ok) {
    const yes = await confirmBox(t('ui.starter.needAI') + '\n\n' + gate.why,
                                 t('ui.starter.goAISettings'));
    if (!yes) return;
    const { showAISettingsDialog } = await import('../ai/ai-provider-ui.js');
    await showAISettingsDialog();
    const again = await aiConfigured();
    if (!again.ok) { setStatus(again.why); return; }
  }
  const s = await createStarter('');
  if (!s) { setStatus(t('ui.starter.createFail')); return; }
  S.starter = s; S.view = 'wizard';
  setStatus(t('ui.starter.created'));
  draw();
}

async function openStarter(slug, view) {
  const s = await readStarter(slug);
  if (!s) { setStatus(t('ui.starter.openFail')); return; }
  resetCastEditor();                    // เปิดเรื่องใหม่ = เริ่มที่รายชื่อเสมอ ไม่ใช่หน้าแก้ไขค้างของเรื่องก่อน
  S.starter = s;
  S.view = view || (s.done ? 'home' : 'wizard');
  draw();
  // ย้ายมาจากโปรเจกต์อื่น → เสนอจับคู่ตัวละครกับ Wiki ของโปรเจกต์นี้
  try {
    if (await offerReconcile(s)) draw();
  } catch (e) { log('warn', 'starter reconcile', e); }
}

/** ปิดโปรเจกต์/ปิดโปรแกรม — อย่าให้ของที่ยังไม่ได้เขียนหาย */
export async function flushStarter() {
  await stopAllAI();          // คำขอที่ยังวิ่งอยู่ต้องไม่ตอบกลับมาใส่โปรเจกต์ที่ปิดไปแล้ว
  return flushStarterSaves();
}

/** เทส/แผงอื่นถามสถานะได้ */
export function starterView() { return S.view; }
export function currentStarter() { return S.starter; }

/**
 * [alpha.124] เปิดหน้าคุยของตอนหนึ่งจากภายนอก — ทางเดียวกับปุ่ม "เปิด" บนการ์ดตอน
 * (`ctx.openChat`) แค่เรียกได้จากนอกโมดูล · ใช้ในเทสเพื่อวัดผลบน DOM จริง
 * @returns {Promise<boolean>} false = ยังไม่ได้เปิด starter ตัวไหนอยู่
 */
export async function openScenarioChat(sc, starter) {
  if (starter) S.starter = starter;          // ระบุเรื่องมาด้วยได้ (เทสเปิดเรื่องของตัวเอง)
  if (!S.starter || !sc) return false;
  S.scenario = sc; S.view = 'chat'; resetChatState();
  await draw();
  return true;
}
