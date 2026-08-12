// player-choices.js — ประวัติการตัดสินใจ (ข้อ 83)
import { t, tf } from './i18n.js';
import { state, setStatus, el, log } from './core.js';

export function getPlayerHistory() {
  if (!state.meta) return [];
  return state.meta.playerHistory || [];
}

export async function recordChoice(sceneId, sceneTitle, choice, player = '') {
  if (!state.meta) return false;
  state.meta.playerHistory = state.meta.playerHistory || [];
  state.meta.playerHistory.push({
    sceneId, sceneTitle, choice,
    timestamp: new Date().toISOString(),
    player: player || t('ui.common.author'),
  });
  try {
    const { saveProjectMeta } = await import('./app.js');
    await saveProjectMeta();
    setStatus(t('ui.player.saveDecision') + choice);
    return true;
  } catch (e) { log('error', 'recordChoice failed', e); return false; }
}

export function choicesByScene(sceneId) {
  return getPlayerHistory().filter((c) => c.sceneId === sceneId);
}

/** การตัดสินใจที่เกี่ยวกับตัวละครคนหนึ่ง — เป็นผู้เลือกเอง หรือชื่อโผล่ในฉาก/ข้อความทางเลือก */
export function choicesByCharacter(name) {
  if (!name) return [];
  const n = String(name).trim();
  if (!n) return [];
  return getPlayerHistory().filter((c) =>
    (c.player && c.player === n)
    || (c.choice && c.choice.includes(n))
    || (c.sceneTitle && c.sceneTitle.includes(n)));
}

/** สถิติรวมสำหรับแดชบอร์ด */
export function choiceStats() {
  const h = getPlayerHistory();
  const scenes = new Set(h.map((c) => c.sceneId).filter(Boolean));
  const byChoice = {};
  for (const c of h) if (c.choice) byChoice[c.choice] = (byChoice[c.choice] || 0) + 1;
  const top = Object.entries(byChoice).sort((a, b) => b[1] - a[1])[0] || null;
  return { total: h.length, scenes: scenes.size, top: top ? { choice: top[0], n: top[1] } : null,
           last: h.length ? h[h.length - 1] : null };
}

/**
 * แผงประวัติการตัดสินใจแบบฝังได้ — ใช้ซ้ำในแดชบอร์ด (ข้อ 83) และหน้า Wiki ตัวละคร
 * @param {HTMLElement} host  กล่องที่จะวาดลงไป (ล้างของเดิมให้)
 * @param {object} opts { limit, character, title, empty, onOpenScene }
 */
export function renderChoicePanel(host, opts = {}) {
  const { limit = 8, character = '', title = t('ui.player.historyDecide'), empty = '', onOpenScene = null } = opts;
  host.innerHTML = '';
  const rows = character ? choicesByCharacter(character) : getPlayerHistory();
  const st = choiceStats();

  host.append(el('div', 'pc-panel-title', `${title} (${rows.length})`));
  if (!rows.length) {
    host.append(el('div', 'dim', empty
      || t('ui.player.notHasDecisionChoice')));
    return host;
  }

  if (!character && st.top) {
    host.append(el('div', 'pc-sum',
      tf('ui.player.timesScenePickLast', st.total, st.scenes, st.top.choice, st.top.n)));
  }

  const list = el('div', 'pc-list');
  for (const c of [...rows].reverse().slice(0, limit)) {
    const row = el('div', 'pc-row');
    // ข้อความจากผู้ใช้ → textContent เท่านั้น (innerHTML = ช่องโหว่สคริปต์ฝัง)
    row.append(el('div', 'pc-choice', '🎯 ' + (c.choice || '')));
    let when = '';
    try { when = new Date(c.timestamp).toLocaleString('th-TH'); } catch { when = c.timestamp || ''; }
    row.append(el('div', 'pc-meta', `📄 ${c.sceneTitle || '—'} · ${when}`));
    if (onOpenScene && c.sceneId) {
      row.classList.add('pc-clickable');
      row.onclick = () => onOpenScene(c.sceneId, c.sceneTitle);
    }
    list.append(row);
  }
  host.append(list);
  if (rows.length > limit) host.append(el('div', 'dim pc-more', tf('ui.player.list', rows.length - limit)));
  return host;
}

// Dialog แสดงประวัติ
export async function showPlayerHistory() {
  const history = getPlayerHistory();
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog');
  box.append(el('div', 'k-dlg-title', t('ui.player.historyDecide2') + history.length + t('ui.player.times')));

  const list = el('div', 'k-pick-list');
  list.style.maxHeight = '50vh';
  if (!history.length) {
    list.append(el('div', 'dim', t('ui.player.notHasDecision')));
  } else {
    [...history].reverse().slice(0, 100).forEach((c) => {
      const row = el('div', 'k-menu-item');
      row.style.cssText = 'flex-direction:column;align-items:stretch;gap:2px';
      // ข้อความจากผู้ใช้ → textContent เท่านั้น (innerHTML = ช่องโหว่สคริปต์ฝัง)
      const top = el('div', null, '🎯 ' + (c.choice || ''));
      top.style.cssText = 'font-size:13px;color:var(--bright)';
      const sub = el('div', null,
        `📄 ${c.sceneTitle || '—'} · ${new Date(c.timestamp).toLocaleString('th-TH')}`);
      sub.style.cssText = 'font-size:11px;color:var(--dim)';
      row.append(top, sub);
      list.append(row);
    });
  }
  box.append(list);

  const btns = el('div', 'k-dlg-btns');
  const exportB = el('button', null, t('ui.player.export'));
  exportB.onclick = async () => {
    const dest = await kapi.saveAsDialog('player-history.json');
    if (!dest) return;
    await kapi.writeFile(dest, JSON.stringify(history, null, 2));
  };
  const clearB = el('button', 'k-danger', t('ui.common.clear'));
  clearB.onclick = async () => {
    if (state.meta) { state.meta.playerHistory = []; const { saveProjectMeta } = await import('./app.js'); await saveProjectMeta(); }
    ov.remove(); setStatus(t('ui.player.clearHistoryDecideDone'));
  };
  const closeB = el('button', 'k-ok', t('ui.common.close'));
  closeB.onclick = () => ov.remove();
  btns.append(exportB, clearB, closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}
