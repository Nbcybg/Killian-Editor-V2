// thesaurus.js — คำพ้อง/คำตรงข้าม (Datamuse API — รองรับเฉพาะภาษาอังกฤษ)
// ข้อจำกัดที่ต้องพูดตรง ๆ: ไม่มีคลังคำพ้องภาษาไทยฟรีที่ใช้ได้ → คำไทยจะไม่เปิดเมนูนี้
//   และเป็นการส่งคำที่ผู้ใช้เลือกออกอินเทอร์เน็ต → ค่าเริ่มต้น "ปิด" เปิดเองได้ที่ settings.thesaurus
import { t as tt, tf as ttf, t, tf } from './i18n.js';
import { el, setStatus, state, log } from './core.js';

const EN_WORD = /^[a-zA-Z][a-zA-Z'-]{1,30}$/;

export function thesaurusEnabled() { return state.settings && state.settings.thesaurus === true; }

async function fetchThesaurus(word, rel = 'ml') {
  try {
    const url = `https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=15`;
    // ผ่าน main process — renderer โดน CORS (origin เป็น file://)
    const res = await kapi.httpFetch(url, { method: 'GET' });
    if (!res || !res.ok) return [];
    return JSON.parse(res.body).map((d) => d.word).filter((w) => w !== word);
  } catch (e) { log('warn', tt('ui.thes.thesaurusSearchNotOk'), e); return []; }
}

export async function showThesaurus(word, x, y) {
  if (!word) return null;
  setStatus(tt('ui.thes.busySearchThesaurus') + word);

  const ov = el('div', 'k-overlay');
  ov.style.cssText = 'background:transparent';
  const box = el('div', 'k-dialog k-thes');
  box.style.cssText = `position:fixed;left:${x}px;top:${y}px;min-width:180px;max-width:280px`;
  box.append(el('div', 'k-dlg-title', '📖 ' + word));

  const replaceWith = async (w) => {
    ov.remove();
    const t = state.active;
    const view = t?.editor?.view || t?.sp?.view;
    if (!view) return;
    const sel = view.state.selection;
    if (sel.empty) return;
    view.dispatch(view.state.tr.insertText(w, sel.from, sel.to));
  };

  const load = async (label, relCode) => {
    const sec = el('div');
    sec.append(el('div', 'wiki-sub', label));
    const list = el('div', 'k-pick-list');
    list.style.maxHeight = '120px';
    list.append(el('div', 'dim', tt('ui.common.busySearch')));
    sec.append(list);
    box.append(sec);
    const words = await fetchThesaurus(word, relCode);
    list.innerHTML = '';
    if (!words.length) { list.append(el('div', 'dim', tt('ui.common.notFound'))); return; }
    for (const w of words) {
      const d = el('div', 'k-menu-item', w);
      d.onclick = () => replaceWith(w);
      list.append(d);
    }
  };

  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  await load(tt('ui.thes.thesaurusTired'), 'ml');
  await load(tt('ui.thes.wordOpposite'), 'rel_ant');

  const cB = el('button', null, tt('ui.thes.close')); cB.onclick = () => ov.remove();
  const btns = el('div', 'k-dlg-btns'); btns.append(cB); box.append(btns);
  return ov;
}

// เมนูคลิกขวา — เพิ่มรายการ "คำพ้อง" เฉพาะคำอังกฤษ และเฉพาะเมื่อผู้ใช้เปิดใช้เอง
// คืนรายการเมนู (array) ให้ผู้เรียกเอาไปต่อกับเมนูคลิกขวาเดิม — ไม่ผูก listener ซ้อนเอง
// (เดิมผูก contextmenu ของตัวเองทับ → เมนูเด้ง 2 ชั้นทับเมนูตรวจคำผิด)
export function thesaurusMenuItems(x, y) {
  if (!thesaurusEnabled()) return [];
  const word = (window.getSelection()?.toString() || '').trim();
  if (!EN_WORD.test(word)) return [];
  return [{ label: ttf('ui.thes.thesaurusWordOpposite', word), click: () => showThesaurus(word, x, y) }];
}
