// auto-link-ui.js — แท็บ Backlinks ในหน้า Wiki entity (ข้อ 86)
// แสดงรายการฉากที่กล่าวถึง entity นี้
import { T } from '../i18n.js';
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
    host.append(el('div', 'dim', T`(กำลังโหลดดัชนีเชื่อมโยง…)`));
    ensureAutoLink().then(() => renderBacklinksTab(host, entityPath, onOpenScene));
    return;
  }
  const links = getBacklinksFor(entityPath);
  if (!links.length) {
    host.append(el('div', 'dim', T`(ยังไม่มีฉากที่กล่าวถึงเอนทิตี้นี้)`));
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

// ล้างดัชนีเมื่อเปลี่ยนโปรเจกต์
export function resetAutoLink() { autoLink = null; building = null; }
