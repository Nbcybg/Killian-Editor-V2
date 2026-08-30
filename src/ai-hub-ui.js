// ai-hub-ui.js — [alpha.116 ข้อ 3] แผง **AI Hub** — ประตูเดียวเข้าทุกความสามารถ AI
//
// ผู้ใช้: *"ทำ panel ที่เป็น AI Hub"*
//
// ไฟล์นี้ทำแค่ 3 อย่าง: (1) อ่านสถานะผู้ให้บริการ (2) วาดการ์ด (3) ส่งต่อไป `handleCommand`
// **ไม่มีตรรกะของฟีเจอร์ AI อยู่ที่นี่เลย** — ทะเบียนอยู่ที่ `src/ai/ai-hub-def.js` (บริสุทธิ์ · เทสแยก)
// เพิ่มความสามารถใหม่ = เพิ่มหนึ่งแถวในทะเบียน แล้วมันโผล่ที่นี่เอง

import { t, tf } from './i18n.js';
import { el, state, setStatus } from './core.js';
import { iconHtml } from './icons.js';
import { aiConfigured } from './ai-settings.js';
import { currentProvider } from './ai/ai-provider-ui.js';
import { AI_HUB_GROUPS, AI_HUB_ITEMS, aiHubItemsOf, hubStatus } from './ai/ai-hub-def.js';
import { isPanelOpen } from './panels/panel-ui.js';
import { handleCommand } from './app.js';

export { AI_HUB_ITEMS, AI_HUB_GROUPS };

/**
 * วาดแผง AI Hub
 * @param {HTMLElement} host `#ai-hub-body`
 * @returns {Promise<number>} จำนวนการ์ดที่วาด (ให้ selftest ยืนยันได้)
 */
export async function renderAIHubPanel(host) {
  const h = host || document.getElementById('ai-hub-body');
  if (!h) return 0;
  h.innerHTML = '';
  const wrap = el('div', 'aihub');

  // ── หัวแผง: ตั้งค่าครบหรือยัง · ใช้เจ้าไหน รุ่นอะไร ──
  const cfg = await aiConfigured().catch(() => ({ ok: false, why: '' }));
  let prov = null;
  try { prov = await currentProvider(); } catch { prov = null; }
  const st = hubStatus({ configured: cfg.ok, why: cfg.why,
                         providerName: prov && prov.name, model: prov && prov.model });

  const head = el('div', 'aihub-head');
  const dot = el('span', 'aihub-dot ' + (st.tone === 'ok' ? 'ok' : 'warn'));
  head.append(dot, el('span', 'aihub-headtext', st.text));
  const cog = el('button', 'aihub-cfg');
  cog.innerHTML = iconHtml('cog', 14);
  cog.title = t('ui.aiHub.openSettings');
  cog.onclick = () => handleCommand('ai-settings');
  head.append(cog);
  wrap.append(head);

  // ยังตั้งค่าไม่ครบ = บอกให้ชัดว่าต้องทำอะไร แล้ว **ยังโชว์รายการทั้งหมดต่อ**
  // (ซ่อนรายการทิ้งทำให้คนไม่รู้ว่าโปรแกรมทำอะไรได้บ้าง — ตรงข้ามกับจุดประสงค์ของ Hub)
  if (st.tone !== 'ok') {
    const warn = el('div', 'aihub-warn');
    warn.append(el('span', null, t('ui.aiHub.setupFirst')));
    const b = el('button', 'k-ok', t('ui.aiHub.setupBtn'));
    b.onclick = () => handleCommand('ai-settings');
    warn.append(b);
    wrap.append(warn);
  }

  // ── การ์ดตามกลุ่ม ──
  const hasScene = !!(state.active && (state.active.editor || state.active.sp));
  let cards = 0;
  for (const g of AI_HUB_GROUPS) {
    const rows = aiHubItemsOf(g.key);
    if (!rows.length) continue;
    const sec = el('div', 'aihub-group');
    const title = el('div', 'aihub-grouphead');
    title.append(el('span', 'aihub-grouptitle', g.label));
    title.append(el('span', 'aihub-grouphint', g.hint));
    sec.append(title);
    const grid = el('div', 'aihub-grid');
    for (const it of rows) {
      grid.append(hubCard(it, hasScene));
      cards++;
    }
    sec.append(grid);
    wrap.append(sec);
  }

  h.append(wrap);
  return cards;
}

/** การ์ดหนึ่งใบ — ปุ่มเดียวจบ ไม่มีสถานะซ่อนอยู่ข้างใน */
function hubCard(it, hasScene) {
  const open = it.panel ? isPanelOpen(it.panel) : false;
  const blocked = !!it.needsScene && !hasScene;
  const card = el('button', 'aihub-card' + (open ? ' on' : '') + (blocked ? ' blocked' : ''));
  const ico = el('span', 'aihub-ico');
  ico.innerHTML = iconHtml(it.icon || 'brain', 18);
  card.append(ico);
  const body = el('div', 'aihub-cardbody');
  const nameRow = el('div', 'aihub-name', it.label);
  if (open) nameRow.append(el('span', 'aihub-openbadge', t('ui.aiHub.openNow')));
  body.append(nameRow);
  body.append(el('div', 'aihub-desc', blocked ? t('ui.aiHub.needScene') : it.desc));
  card.append(body);
  card.disabled = blocked;
  card.title = blocked ? t('ui.aiHub.needScene') : it.desc;
  card.dataset.hub = it.id;
  card.onclick = async () => {
    try {
      await handleCommand(it.cmd, ...(it.args || []));
    } catch (e) {
      setStatus(tf('ui.aiHub.runFail', it.label));
      return;
    }
    // แผงที่เพิ่งเปิด/ปิด = ป้าย "เปิดอยู่" ต้องตามทันที
    if (it.panel) renderAIHubPanel();
  };
  return card;
}
