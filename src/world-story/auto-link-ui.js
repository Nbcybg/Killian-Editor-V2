// auto-link-ui.js — แท็บ Backlinks ในหน้า Wiki entity (ข้อ 86)
// แสดงรายการฉากที่กล่าวถึง entity นี้
import { t, tf } from '../i18n.js';
import { el, setStatus, state } from '../core.js';
import { AutoLink } from '../world-story/auto-link.js';
import { listScenes, listEntities } from '../project-scan.js';

let autoLink = null;   // AutoLink instance
let building = null;   // Promise ของการสร้างดัชนีที่กำลังวิ่งอยู่

// [alpha.60r3 ข้อ 1] เดิม `ensureAutoLink()` ตั้ง `autoLink` ก่อนอ่านไฟล์เสร็จ
// → ผู้เรียกคนที่สองได้ instance ที่ยัง "ว่างเปล่า" กลับไป แล้ววาด "(ยังไม่มีฉากที่กล่าวถึง)"
// ทั้งที่ดัชนีกำลังจะเสร็จอีกไม่กี่ ms ข้างหน้า — ทุกคนต้องรอ Promise ก้อนเดียวกัน
async function buildAutoLink() {
  const al = new AutoLink({ meta: state.meta });
  // ลองโหลดจาก project.khn.json ก่อน (เร็ว) — ได้ผลลัพธ์คร่าว ๆ ทันทีถ้าสแกนล้ม
  if (state.meta && state.meta.backlinks) al.load(state.meta);
  autoLink = al;
  if (!state.root) return al;
  // รวบรวม entities + scenes จากโปรเจกต์ (path บทมาจาก draft.json — ดู project-scan.js)
  try {
    const entities = (await listEntities(state.root))
      .map((e) => ({ id: e.path, name: e.name, aliases: e.aliases }));
    const scenes = (await listScenes(state.root, { withText: true }))
      .map((s) => ({ id: s.id, title: s.title, chapterId: s.chapterId, text: s.text || '' }));
    al.build(entities, scenes);
    // บันทึกลง project.khn.json (ผู้เรียก saveProjectMeta เองภายหลัง)
    al.persist(state.meta);
  } catch (e) { /* silently fail — ยังมีดัชนีที่โหลดจาก meta อยู่ */ }
  return al;
}

// สร้าง/คืน AutoLink พร้อมดัชนีเชื่อมโยง Wiki↔ฉาก
export async function ensureAutoLink() {
  if (autoLink && !building) return autoLink;
  if (!building) building = buildAutoLink().finally(() => { building = null; });
  return building;
}

/** บังคับสร้างดัชนีใหม่ทั้งชุด (ปุ่ม 🔄 บนหัวข้อ "ฉากที่กล่าวถึง") */
export async function rebuildAutoLink() {
  autoLink = null; building = null;
  return ensureAutoLink();
}

/**
 * [alpha.60r3 ข้อ 1] อัปเดตดัชนีของ "ฉากเดียว" หลังบันทึกไฟล์ — O(1) ต่อการบันทึก
 * เดิมดัชนีถูกสร้างครั้งเดียวตอนเปิดหน้า Wiki ครั้งแรกแล้วไม่เคยอัปเดตอีกเลย
 * → พิมพ์ชื่อตัวละครลงฉากแล้วบันทึก "ฉากที่กล่าวถึง" ก็ยังว่างอยู่ตลอดกาล
 * @param {{id:string,title?:string,chapterId?:string,text:string}} scene
 * @returns {boolean} true = อัปเดตดัชนีจริง
 */
export function updateSceneLink(scene) {
  if (!autoLink || !scene || !scene.id) return false;
  try {
    autoLink.updateScene({ id: scene.id, title: scene.title || '',
                           chapterId: scene.chapterId || '', text: scene.text || '' });
    autoLink.persist(state.meta);
    return true;
  } catch { return false; }
}

/** ดัชนีถูกสร้างแล้วหรือยัง (ผู้เรียกจะได้ไม่ไปปลุกการสแกนทั้งโปรเจกต์โดยไม่จำเป็น) */
export function autoLinkReady() { return !!autoLink; }

// โหลดข้อมูล backlinks
export function getBacklinksFor(entityPath) {
  if (!autoLink) return [];
  return autoLink.getRelatedScenes(entityPath);
}

// เรนเดอร์แท็บ backlinks ใน Wiki entity panel
export function renderBacklinksTab(host, entityPath, onOpenScene) {
  host.innerHTML = '';
  if (!autoLink) {
    host.append(el('div', 'dim', t('ui.worldAutoLink.busyLoadIndexLink')));
    ensureAutoLink().then(() => renderBacklinksTab(host, entityPath, onOpenScene));
    return;
  }
  const links = getBacklinksFor(entityPath);
  if (!links.length) {
    host.append(el('div', 'dim', t('ui.worldAutoLink.notHasSceneMention')));
    return;
  }

  const list = el('div', 'bl-list');
  for (const link of links) {
    const row = el('div', 'bl-row');
    row.append(el('span', 'bl-count', (link.count || 1) + '× '));
    const name = el('span', 'bl-name', link.title || link.sceneId);
    name.style.cursor = 'pointer';
    name.style.color = 'var(--link)';
    name.style.textDecoration = 'underline';
    name.onclick = async () => {
      if (onOpenScene) onOpenScene(link.sceneId, link.title);
    };
    row.append(name);
    if (link.via) row.append(el('span', 'bl-via', ' (' + link.via + ')'));
    list.append(row);
  }
  host.append(list);
}

// ═══════════ [alpha.125 ข้อ G] ★ แผง "ฉากที่กล่าวถึง" แบบยืนได้ด้วยตัวเอง ═══════════
//
// ดัชนีเชื่อมโยง Wiki↔ฉาก มีมาตั้งแต่ alpha.60r3 และแม่นแล้ว — แต่ทางเข้าเดียวที่มีคือ
// **แท็บเล็ก ๆ ท้ายหน้าเอนทิตี้ใน Wiki** ต้องเปิดตัวละครทีละตัวถึงจะเห็นว่าใครโผล่ที่ไหน
// คำถามที่คนเขียนถามจริงคือ "ตัวไหนหายไปนานแล้วบ้าง" / "ใครไม่โผล่เลยสักฉาก" ซึ่งตอบไม่ได้เลย
//
// แผงนี้เอาดัชนีตัวเดียวกันมากางทั้งโปรเจกต์: เอนทิตี้ทุกตัว · จำนวนฉากที่ถูกกล่าวถึง ·
// เรียงจากน้อยไปมากได้ (ตัวที่ถูกลืมลอยขึ้นบนสุด) · คลิกกระโดดไปฉากนั้นได้ทันที

/** สรุปทั้งโปรเจกต์: เอนทิตี้ทุกตัวพร้อมจำนวนฉากที่กล่าวถึง (เรียงน้อย→มาก) */
export async function backlinkSummary() {
  if (!state.root) return [];
  await ensureAutoLink();
  const ents = await listEntities(state.root).catch(() => []);
  const rows = ents.map((e) => {
    const scenes = getBacklinksFor(e.path) || [];
    return {
      path: e.path, name: e.name || '', cat: e.cat || '',
      scenes, count: scenes.length,
      hits: scenes.reduce((n, s) => n + (s.count || 1), 0),
    };
  });
  // ตัวที่ไม่โผล่เลยขึ้นก่อน — นั่นคือของที่ผู้ใช้ต้องเห็น ไม่ใช่ตัวเอกที่โผล่ทุกฉาก
  rows.sort((a, b) => a.count - b.count || String(a.name).localeCompare(String(b.name), 'th'));
  return rows;
}

/**
 * วาดแผง "ฉากที่กล่าวถึง" ทั้งโปรเจกต์
 * @param {HTMLElement} host
 * @param {(sceneId:string, title:string) => any} onOpenScene
 */
export async function renderBacklinksPanel(host, onOpenScene) {
  if (!host) return null;
  host.replaceChildren();
  if (!state.root) {
    host.append(el('div', 'k-panel-empty', t('ui.common.cantOpenProject')));
    return null;
  }
  const head = el('div', 'bl-panel-head');
  head.append(el('span', 'k-dlg-title', t('ui.worldAutoLink.panelTitle')));
  const reB = el('button', 'k-panel-btn', '↻');
  reB.title = t('ui.worldAutoLink.rebuild');
  head.append(reB);
  host.append(head);

  const filt = el('input', 'k-dlg-input bl-filter');
  filt.placeholder = t('ui.worldAutoLink.filterPlaceholder');
  host.append(filt);

  const onlyOrphan = el('input'); onlyOrphan.type = 'checkbox';
  const lab = el('label', 'bl-only');
  lab.append(onlyOrphan, document.createTextNode(' ' + t('ui.worldAutoLink.onlyOrphan')));
  host.append(lab);

  const list = el('div', 'bl-panel-list');
  const status = el('div', 'dim bl-panel-status');
  host.append(list, status);

  let rows = [];
  const draw = () => {
    list.replaceChildren();
    const q = filt.value.trim().toLowerCase();
    const show = rows.filter((r) => (!q || r.name.toLowerCase().includes(q))
                                 && (!onlyOrphan.checked || r.count === 0));
    if (!show.length) { list.append(el('div', 'dim', t('ui.worldAutoLink.noRows'))); return; }
    for (const r of show) {
      const box = el('div', 'bl-ent' + (r.count ? '' : ' bl-ent-orphan'));
      const h = el('div', 'bl-ent-head');
      h.append(el('span', 'bl-ent-name', r.name));            // กฎข้อ 11: ข้อความ ไม่ใช่ HTML
      h.append(el('span', 'bl-ent-count',
                  r.count ? tf('ui.worldAutoLink.inNScenes', r.count) : t('ui.worldAutoLink.zero')));
      box.append(h);
      for (const s of r.scenes.slice(0, 8)) {
        const row = el('div', 'bl-row');
        row.append(el('span', 'bl-count', (s.count || 1) + '× '));
        const nm = el('span', 'bl-name', s.title || s.sceneId);
        nm.onclick = () => onOpenScene && onOpenScene(s.sceneId, s.title);
        row.append(nm);
        box.append(row);
      }
      if (r.scenes.length > 8) box.append(el('div', 'dim bl-more', '…'));
      list.append(box);
    }
    status.textContent = tf('ui.worldAutoLink.summaryN', show.length,
                            rows.filter((r) => !r.count).length);
  };

  const load = async () => {
    list.replaceChildren(el('div', 'dim', t('ui.worldAutoLink.busyLoadIndexLink')));
    rows = await backlinkSummary();
    draw();
  };
  filt.oninput = draw;
  onlyOrphan.onchange = draw;
  reB.onclick = async () => { await rebuildAutoLink(); await load(); };
  await load();
  return { list, filt, onlyOrphan, reload: load, rows: () => rows };
}

// ล้างดัชนีเมื่อเปลี่ยนโปรเจกต์
export function resetAutoLink() { autoLink = null; building = null; }
