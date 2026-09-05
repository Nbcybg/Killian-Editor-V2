// thesaurus-ui.js — UI สำหรับ Thesaurus: คลิกขวาคำ → คำพ้อง/คำตรงข้าม (ข้อ 67)
// แยกจาก src/thesaurus.js เดิม (ซึ่งเป็น UI ของ K1 เก่า — ไฟล์นี้เป็น UI ใหม่สำหรับ tools/thesaurus.js)
import { el, setStatus, state, t, log } from '../core.js';
import { getSynonyms, getAntonyms } from '../tools/thesaurus.js';

// แสดง popup คำพ้อง/คำตรงข้าม
export async function showThesaurusPopup(word, x, y) {
  if (!word) return;
  const norm = word.trim();
  if (!norm) return;

  // ลองให้ tools/thesaurus engine
  let syns = [], ants = [];
  try {
    const [synRes, antRes] = await Promise.all([
      getSynonyms(norm).catch(() => []),
      getAntonyms(norm).catch(() => []),
    ]);
    syns = Array.isArray(synRes) ? synRes : (synRes?.words || []);
    ants = Array.isArray(antRes) ? antRes : (antRes?.words || []);
  } catch (e) {
    // [alpha.125 ข้อ D] เดิมตรงนี้ตกกลับไปเรียก `../thesaurus.js` (UI ยุค K1)
    // ซึ่ง **เรียกผิดลายเซ็นด้วย**: ตัวจริงคือ `thesaurusMenuItems(x, y)` ที่อ่านคำจาก
    // selection บนจอ ไม่ใช่ `(word)` → fallback นี้ไม่เคยคืนอะไรที่เกี่ยวกับคำที่ขอเลย
    // ไฟล์นั้นถูกลบทิ้งแล้ว (เมนูคลิกขวาเหลือชุดเดียวตั้งแต่ alpha.124 ข้อ 32)
    log('warn', t('ui.thes.thesaurusSearchNotOk'), e);
  }

  if (!syns.length && !ants.length) {
    setStatus(t('ui.thes.notFound') + norm + '"');
    return;
  }

  // ลบ popup เก่า
  const old = document.querySelector('.k-thes-popup');
  if (old) old.remove();

  const pop = el('div', 'k-thes-popup');
  pop.style.left = Math.min(x, window.innerWidth - 220) + 'px';
  pop.style.top = Math.min(y, window.innerHeight - 300) + 'px';

  if (syns.length) {
    pop.append(el('div', 'k-thes-head', t('ui.toolsThesaurus.thesaurusSynonyms')));
    for (const s of syns.slice(0, 15)) {
      const item = el('div', 'k-thes-item', s);
      item.onclick = () => { navigator.clipboard.writeText(s); setStatus(t('ui.thes.copied') + s); pop.remove(); };
      pop.append(item);
    }
  }
  if (ants.length) {
    pop.append(el('div', 'k-thes-head', t('ui.toolsThesaurus.wordOppositeAntonyms')));
    for (const a of ants.slice(0, 15)) {
      const item = el('div', 'k-thes-item', a);
      item.onclick = () => { navigator.clipboard.writeText(a); setStatus(t('ui.thes.copied') + a); pop.remove(); };
      pop.append(item);
    }
  }
  const close = el('div', 'k-thes-close', '✕');
  close.onclick = () => pop.remove();
  pop.append(close);
  document.body.append(pop);

  // คลิกนอก popup → ปิด
  const outside = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', outside); } };
  setTimeout(() => document.addEventListener('click', outside), 0);
}

// ตั้งค่า engine ด้วย kapi (เรียกตอนเปิดโปรเจกต์)
// ระวัง 3 จุดที่เคยพัง: (1) ลืม import state (2) loadExtra เรียก io.join แบบ sync แต่ kapi.join เป็น async
// (3) เอนจินต้องการ http.fetch แต่ kapi มีชื่อ httpFetch + ต้องเปิด online เองจาก settings
export async function initThesaurus() {
  const { loadExtra, configure } = await import('../tools/thesaurus.js');
  const { syncIo } = await import('../project-scan.js');
  let extra = null;
  try { extra = await loadExtra(syncIo(), state.root); } catch { extra = null; }
  configure({
    http: { fetch: (url, opts) => kapi.httpFetch(url, opts) },
    online: !!(state.settings && state.settings.thesaurus),     // ส่งคำออกเน็ต = ต้องเปิดเองในตั้งค่า
    extra,
  });
}
