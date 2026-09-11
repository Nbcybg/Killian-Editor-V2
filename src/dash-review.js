// dash-review.js — [alpha.80] "สิ่งที่ควรดู" ในแดชบอร์ด (แทนที่ ศูนย์รวม ซึ่งถูกลบทิ้ง)
//
// ═══ ทำไมถึงลบ "ศูนย์รวม" ═══
// ผู้ใช้ชี้ว่าแดชบอร์ดกับศูนย์รวม **แสดงข้อมูลซ้ำกัน** — และซ้ำจริง:
// ศูนย์รวมมีแผง "สถิติสด" ที่นับ ฉาก/คำ/Wiki/ตัวละคร ซึ่งแดชบอร์ดนับให้อยู่แล้วด้านบน
// (นับคนละรอบด้วย → ตัวเลขสองที่ไม่ตรงกันเป็นประจำ)
//
// ที่เหลือไว้คือส่วนที่ **ไม่ซ้ำกับใคร** และตอบคำถามที่แดชบอร์ดไม่ได้ตอบ:
//   1. Backlinks — เอนทิตี้ Wiki ตัวไหนถูกกล่าวถึงในฉากไหนบ้าง (และตัวไหนไม่มีใครพูดถึงเลย)
//   2. สิ่งที่ต้องอัปเดต — โน้ต "ไว้ทำภายหลัง" · ฉากที่ยังไม่ได้ตั้งสถานะ · ยังไม่ได้เขียนวันนี้
//
// สถิติ/หัวเรื่อง/ปุ่มรีเฟรชของศูนย์รวมเดิม ถูกตัดออกทั้งหมด

import { t, tf } from './i18n.js';
import { el, state, log } from './core.js';
import { ensureAutoLink, resetAutoLink } from './world-story/auto-link-ui.js';
import { listScenes, listEntities, findScenePath } from './project-scan.js';
import { getFutureNotes } from './session-notes.js';
import { localDay } from './local-date.js';

const REFRESH_DELAY = 1500;   // ms — หน่วงก่อนสร้างดัชนีใหม่ (บันทึกรัว ๆ จะได้ไม่สแกนซ้ำทุกครั้ง)
let stale = true;             // ดัชนีล้าสมัยหรือยัง (ตั้งเมื่อมีการบันทึกไฟล์)
let timer = null;

/**
 * เรียกจาก saveTab: ข้อมูลเปลี่ยนแล้ว → ครั้งถัดไปที่เห็นแดชบอร์ดให้สร้างดัชนีใหม่
 * **หน่วงและรวบการเรียกซ้ำ** — การสร้างดัชนีอ่านไฟล์ฉากทั้งโปรเจกต์
 * ถ้ายิงทุกครั้งที่ autosave จะหน่วงทั้งแอป
 */
export function markReviewStale() {
  stale = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (!stale) return;
    import('./dashboard.js').then((m) => m.refreshDashboardIfOpen()).catch(() => {});
  }, REFRESH_DELAY);
}

/** เรียกจาก activate(): กลับมาดูแดชบอร์ด → รีเฟรชถ้าข้อมูลเปลี่ยนไปแล้ว */
export function onReviewShown() {
  if (!stale) return;
  import('./dashboard.js').then((m) => m.refreshDashboardIfOpen()).catch(() => {});
}

/** เปลี่ยนโปรเจกต์ → ทิ้งสถานะเก่า */
export function resetReview() {
  stale = true;
  if (timer) { clearTimeout(timer); timer = null; }
}

// เปิดฉากจาก sceneId (ผลลัพธ์ของ auto-link เก็บเป็น id ไม่ใช่ path)
async function openSceneById(sceneId, fallbackTitle) {
  const hit = await findScenePath(state.root, sceneId);
  if (hit && (await kapi.exists(hit.path))) {
    const { openScene } = await import('./app.js');
    openScene(hit.path, hit.title || fallbackTitle);
  }
}

/**
 * วาดสองส่วนที่เหลือจากศูนย์รวมลงท้ายแดชบอร์ด
 * @param {HTMLElement} pane ที่วาด
 */
export async function renderReview(pane) {
  pane.innerHTML = '';
  const wrap = el('div', 'cent-wrap cent-embedded');
  pane.append(wrap);

  const loading = el('div', 'dim', t('ui.central.busyNewIndexLink'));
  wrap.append(loading);

  let scenes = [], entities = [], autoLink = null;
  try {
    [scenes, entities] = await Promise.all([
      listScenes(state.root, { withText: false }),
      listEntities(state.root),
    ]);
    if (stale) resetAutoLink();               // บังคับสร้างดัชนีใหม่เมื่อไฟล์เปลี่ยน
    autoLink = await ensureAutoLink();
    stale = false;
  } catch (e) {
    log('error', t('ui.central.centralizeNewIndexNot'), e);
  }
  loading.remove();

  // ───────── Backlinks จาก Auto-link Engine ─────────
  const blinks = el('div', 'cent-panel');
  blinks.append(el('div', 'cent-panel-title', t('ui.central.backlinksSceneToWiki')));
  const blList = el('div', 'cent-list');
  blinks.append(blList);

  if (!autoLink) {
    blList.append(el('div', 'dim', t('ui.central.newIndexNotOk')));
  } else {
    const ranked = entities
      .map((e) => ({ ent: e, links: autoLink.getRelatedScenes(e.path || e.id) }))
      .filter((r) => r.links.length)
      .sort((a, b) => b.links.length - a.links.length);

    if (!ranked.length) {
      blList.append(el('div', 'dim', t('ui.central.notHasBacklinksPrint')));
    } else {
      for (const { ent, links } of ranked.slice(0, 15)) {
        const row = el('div', 'cent-link-row');
        // ชื่อ entity + ชื่อฉากมาจากไฟล์ผู้ใช้ → ห้าม innerHTML
        row.append(el('strong', null, ent.name), el('span', null, tf('ui.central.scene', links.length)));
        links.slice(0, 3).forEach((l, i) => {
          if (i) row.append(el('span', null, ', '));
          const a = el('span', 'cent-scene-link', l.title || l.sceneId);
          a.title = tf('ui.central.mentionTimesClickOpenScene', l.count || 1);
          a.onclick = () => openSceneById(l.sceneId, l.title);
          row.append(a);
        });
        if (links.length > 3) row.append(el('span', 'dim', ` … +${links.length - 3}`));
        blList.append(row);
      }
      // เอนทิตี้ที่ไม่มีใครพูดถึงเลย — ช่องโหว่ของเรื่องที่มองไม่เห็นถ้าไม่มีดัชนี
      const orphans = entities.filter((e) => !autoLink.getRelatedScenes(e.path || e.id).length);
      if (orphans.length) {
        const row = el('div', 'cent-link-row cent-orphan');
        row.append(el('strong', null, t('ui.central.notMention')));
        row.append(el('span', null, ` (${orphans.length}): `
          + orphans.slice(0, 6).map((e) => e.name).join(', ')
          + (orphans.length > 6 ? ' …' : '')));
        blList.append(row);
      }
    }
  }
  wrap.append(blinks);

  // ───────── สิ่งที่ต้องอัปเดต ─────────
  const todo = el('div', 'cent-panel');
  todo.append(el('div', 'cent-panel-title', t('ui.central.thingMustUpdate')));
  const todoList = el('div', 'cent-list');
  const pending = [];

  for (const n of getFutureNotes().slice(-5).reverse()) {
    pending.push({ text: '📝 ' + n.text.slice(0, 70), sceneId: n.sceneId, title: n.sceneTitle });
  }
  const noStatus = scenes.filter((s) => !(s.row && s.row.status));
  if (noStatus.length) pending.push({ text: tf('ui.central.sceneCantSetStatus', noStatus.length) });
  if (state.meta && Array.isArray(state.meta.wordHistory) && state.meta.wordHistory.length) {
    const today = localDay();          // [alpha.148] วันของเครื่อง ให้ตรงกับที่ recordDailyWords จด
    const t2 = state.meta.wordHistory.find((w) => w.date === today);
    if (!t2 || !t2.words) pending.push({ text: t('ui.central.cantWrite') });
  }
  // (ประวัติการตัดสินใจย้ายไปอยู่แผงของตัวเองในแดชบอร์ดแล้ว — เดิมนับซ้ำอยู่ตรงนี้ด้วย)

  if (!pending.length) {
    todoList.append(el('div', 'dim', t('ui.central.allCurrent')));
  } else {
    for (const item of pending) {
      const d = el('div', 'cent-todo-item', item.text);
      if (item.sceneId) {
        d.classList.add('cent-clickable');
        d.onclick = () => openSceneById(item.sceneId, item.title);
      }
      todoList.append(d);
    }
  }
  todo.append(todoList);
  wrap.append(todo);
}
