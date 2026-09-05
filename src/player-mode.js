// player-mode.js — โหมดทดลองเล่น (ข้อ 9, alpha.66)
//
// ปัญหาเดิม: อยากรู้ว่าเรื่องแตกสายสมเหตุสมผลไหม ต้องเปิดผัง → ดับเบิลคลิกเปิดฉาก → อ่าน →
// กลับไปกด ➜ ใน inspector → วนใหม่ทีละฉาก ช้ามากและขาดบริบทว่าตัวเองเดินมาทางไหน
//
// ที่นี่: แผงอ่านอย่างเดียว เดินตามทางเลือกได้จริงเหมือนผู้เล่น
//   ┌─────────────────────────────┐
//   │ 📄 ฉากประตู                  │
//   │ [เนื้อฉากเต็ม — อ่านอย่างเดียว]│
//   │ คุณจะ…                       │
//   │ [เปิดประตู] → ห้องมืด         │
//   │ [หนี]                        │
//   │ ◀ ย้อนกลับ   🎯 ประวัติ       │
//   └─────────────────────────────┘
//
// เนื้อฉากวาดด้วย ProseMirror ตัวเดียวกับตัวแก้ไข แต่ `editable: () => false`
// → ได้ตัวอักษร/ระยะบรรทัด/รูปเหมือนตอนเขียนเป๊ะ แต่พิมพ์ทับไม่ได้
//
// เส้นทางที่เดินถูกเก็บแยกจาก `playerHistory` เดิม (ซึ่งเป็น "ทุกการตัดสินใจปนกัน")
// มาอยู่ใน `playthroughs[]` = หนึ่งรายการต่อหนึ่งรอบการเล่น มีลำดับก่อนหลังครบ
import { $, el, state, setStatus, log, t } from './core.js';
import { buildGraph, analyzeGraph } from './branch-graph.js';
import { collectScenes } from './branching-ui.js';

const tr = (key, fb) => t('player.' + key, fb);
const MAX_RUNS = 40;                    // เก็บรอบการเล่นล่าสุดเท่านี้ (ไฟล์โปรเจกต์ไม่บวม)

function pstate() {
  if (!state._player) state._player = { run: null, graph: null, editor: null, loading: false };
  return state._player;
}

// ───────── playthroughs[] ใน project.khn.json ─────────
export function getPlaythroughs() {
  if (!state.meta) return [];
  return state.meta.playthroughs || [];
}
async function savePlaythroughs(list) {
  if (!state.meta) return false;
  state.meta.playthroughs = list.slice(-MAX_RUNS);
  try {
    const { saveProjectMeta } = await import('./app.js');
    await saveProjectMeta();
    return true;
  } catch (e) { log('error', t('ui.player.playerModeSavePlaythroughs'), e); return false; }
}

/** บันทึกรอบที่กำลังเล่นอยู่ทับของเดิม (id เดียวกัน) — เขียนทุกก้าวจะได้ไม่หายถ้าปิดโปรแกรม */
async function persistRun(run) {
  if (!run) return false;
  const list = getPlaythroughs().filter((r) => r.id !== run.id);
  list.push(JSON.parse(JSON.stringify(run)));
  return savePlaythroughs(list);
}

// ───────── ทางเข้า ─────────
export async function openPlayerMode(startId) {
  const { showPanel } = await import('./panels/panel-ui.js');
  const { renderFeaturePanel } = await import('./app.js');
  const ps = pstate();
  // สั่งเล่นจากฉากที่ระบุ = เริ่มรอบใหม่เสมอ · ไม่ระบุ = เล่นรอบเดิมต่อถ้ามีอยู่
  if (startId || !ps.run) ps.pendingStart = startId || null;
  showPanel('player');
  await renderFeaturePanel('player');
  return true;
}

/** วาดเนื้อแผง — FEATURE_PANELS ใน app.js เรียกทุกครั้งที่แผงถูกเปิด */
export async function renderPlayerPanel() {
  const host = $('#player-body');
  if (!host) return false;
  await renderPlayer(host, { reload: true });
  return true;
}

export function refreshOpenPlayer() {
  const host = $('#player-body');
  if (host && host.firstChild) renderPlayer(host, { reload: true });
}

// ───────── โหลดผัง (พร้อมเนื้อฉาก) ─────────
// อ่านเนื้อฉากทุกไฟล์ = แพง → เก็บไว้ใช้ซ้ำระหว่าง "เดินเรื่อง"
// (กดทางเลือกทีหนึ่งแล้วไล่อ่านทั้งโปรเจกต์ใหม่ = แผงกระพริบทุกก้าว)
// อ่านใหม่เฉพาะตอนเปิดแผง/สั่งรีเฟรช ซึ่งเป็นจังหวะที่เนื้อเรื่องอาจถูกแก้จริง
async function loadGraph(force) {
  const ps = pstate();
  if (!force && ps.graph && ps.graphRoot === state.root) {
    return { graph: ps.graph, analysis: ps.analysis };
  }
  const scenes = await collectScenes();
  const { parseMdFile } = await import('./md.js');
  for (const sc of scenes) {
    try { sc.body = sc.filePath ? (parseMdFile(await kapi.readFile(sc.filePath)).body || '') : ''; }
    catch { sc.body = ''; }
  }
  const graph = buildGraph(scenes);
  const analysis = analyzeGraph(graph);
  ps.graph = graph; ps.analysis = analysis; ps.graphRoot = state.root;
  return { graph, analysis };
}

function newRun(node) {
  return {
    id: 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    startedAt: new Date().toISOString(),
    startSceneId: node.id,
    startTitle: node.title,
    // ก้าวแรก = ฉากเริ่ม (ยังไม่ได้เลือกอะไร) — ทำให้ย้อนกลับ/ประวัติอ่านง่ายเป็นลำดับเดียว
    steps: [{ sceneId: node.id, sceneTitle: node.title, choice: '', at: new Date().toISOString() }],
  };
}

const curSceneId = (run) => (run && run.steps.length ? run.steps[run.steps.length - 1].sceneId : null);

// ───────── วาด ─────────
// รอบวาดล่าสุด — งานที่ถูกแซงต้องทิ้งผล ไม่ใช่เขียนทับของใหม่
let _playGen = 0;

export async function renderPlayer(host, opts = {}) {
  const ps = pstate();
  const gen = ++_playGen;
  host.classList.add('player-host');

  // เนื้อเดิมยังอยู่จนกว่าของใหม่จะพร้อม (เดิมล้างทิ้งก่อนอ่านไฟล์ → แผงว่างแวบหนึ่งทุกก้าว)
  // แสดง "กำลังอ่าน" เฉพาะตอนแผงยังว่างจริง ๆ เท่านั้น
  const wrap = el('div', 'player-wrap');
  if (!host.firstChild) {
    host.append(el('div', 'player-loading dim', tr('loading', t('ui.player.busyReadStory'))));
  }
  let graph, analysis;
  try { ({ graph, analysis } = await loadGraph(opts.reload)); }
  catch (e) {
    log('error', t('ui.player.playerModeReadScene'), e);
    if (gen === _playGen) host.replaceChildren(el('div', 'dim', tr('loadFail', t('ui.player.readSceneNotOk'))));
    return;
  }
  if (gen !== _playGen || !host.isConnected) return;
  if (ps.editor) { try { ps.editor.destroy(); } catch {} ps.editor = null; }

  // ── เลือกฉากเริ่ม ──
  const wantStart = ps.pendingStart;
  ps.pendingStart = null;
  if (wantStart && graph.byId.has(wantStart)) ps.run = newRun(graph.byId.get(wantStart));
  if (ps.run && !graph.byId.has(curSceneId(ps.run))) ps.run = null;      // ฉากถูกลบไประหว่างนั้น
  if (!ps.run) {
    const rootId = analysis.roots[0] || (graph.nodes.find((n) => n.choices.length) || {}).id;
    if (!rootId) {
      wrap.append(el('div', 'player-empty dim',
        tr('empty', t('ui.player.notHasStoryBreak'))));
      host.replaceChildren(wrap);
      return;
    }
    ps.run = newRun(graph.byId.get(rootId));
    persistRun(ps.run);
  }

  const run = ps.run;
  const node = graph.byId.get(curSceneId(run));
  const step = run.steps.length;

  // ───────── หัวแถบ ─────────
  const head = el('div', 'player-head');
  const titleBox = el('div', 'player-titlebox');
  titleBox.append(el('div', 'player-title', '📄 ' + node.title));
  titleBox.append(el('div', 'player-sub',
    (node.chapterName ? node.chapterName + ' · ' : '') +
    `${tr('step', t('ui.player.step2'))} ${step}` +
    (analysis.roots.includes(node.id) ? ' · ▶ ' + tr('atStart', t('ui.common.dotStart')) : '') +
    (!node.choices.length ? ' · 🏁 ' + tr('atEnd', t('ui.common.actEnd')) : '')));
  head.append(titleBox);

  const tools = el('div', 'player-tools');
  const startSel = el('select', 'k-field-select player-start');
  startSel.title = tr('pickStart', t('ui.player.startPlayScene'));
  const startIds = analysis.roots.length ? analysis.roots
    : graph.nodes.filter((n) => n.choices.length).map((n) => n.id);
  for (const id of startIds) {
    const n = graph.byId.get(id);
    if (!n) continue;
    const o = el('option', null, '▶ ' + n.title); o.value = id; startSel.append(o);
  }
  startSel.value = run.startSceneId;
  startSel.onchange = () => { ps.run = newRun(graph.byId.get(startSel.value)); persistRun(ps.run); renderPlayer(host); };
  if (startIds.length > 1) tools.append(startSel);

  const restartB = el('button', 'player-btn', '⟲ ' + tr('restart', t('ui.common.restart')));
  restartB.title = tr('restartHint', t('ui.player.startPlayRoundNew'));
  restartB.onclick = () => {
    ps.run = newRun(graph.byId.get(run.startSceneId));
    persistRun(ps.run);
    renderPlayer(host);
  };
  const openB = el('button', 'player-btn', '✏️ ' + tr('editScene', t('ui.player.editScene2')));
  openB.title = tr('editSceneHint', t('ui.player.openSceneAreaWrite'));
  openB.onclick = async () => {
    if (!node.filePath) { setStatus(tr('noFile', t('ui.common.sceneNotHasFile'))); return; }
    const { openScene } = await import('./app.js');
    await openScene(node.filePath, node.title);
  };
  const mapB = el('button', 'player-btn', '🌿 ' + tr('showOnMap', t('ui.player.viewTopGraph')));
  mapB.onclick = async () => {
    const { openBranchingTree } = await import('./branching-ui.js');
    if (state._branch) state._branch.sel = node.id;
    else state._branch = { sel: node.id, zoom: 1, view: 'tree', sideOpen: true, query: '' };
    await openBranchingTree();
  };
  // เนื้อฉากถูกเก็บไว้ใช้ซ้ำระหว่างเดินเรื่อง → ต้องมีทางสั่งอ่านใหม่หลังไปแก้ต้นฉบับมา
  const reloadB = el('button', 'player-btn', '🔄');
  reloadB.title = tr('reload', t('ui.player.readBodyStoryNew'));
  reloadB.onclick = () => renderPlayer(host, { reload: true });
  tools.append(restartB, openB, mapB, reloadB);
  head.append(tools);
  wrap.append(head);

  // ───────── เส้นทางที่เดินมา (breadcrumb) ─────────
  const trail = el('div', 'player-trail');
  run.steps.forEach((s, i) => {
    if (i) trail.append(el('span', 'player-trail-sep', '→'));
    const chip = el('span', 'player-trail-chip' + (i === run.steps.length - 1 ? ' on' : ''), s.sceneTitle);
    chip.title = (s.choice ? `[${s.choice}] → ` : '') + s.sceneTitle + ' — ' + tr('jumpBack', t('ui.player.clickUndo'));
    chip.onclick = () => {
      if (i === run.steps.length - 1) return;
      run.steps = run.steps.slice(0, i + 1);
      persistRun(run);
      renderPlayer(host);
    };
    trail.append(chip);
  });
  wrap.append(trail);

  // ───────── เนื้อฉาก (อ่านอย่างเดียว) ─────────
  const bodyBox = el('div', 'player-body-box');
  const mount = el('div', 'player-prose');
  bodyBox.append(mount);
  wrap.append(bodyBox);

  const text = node.body || '';
  if (!text.trim()) {
    mount.append(el('div', 'dim', tr('emptyScene', t('ui.player.sceneNotHasBody'))));
  } else {
    try {
      const { KEditor } = await import('./editor.js');
      const { resolveImg } = await import('./app.js');
      const dir = node.filePath ? node.filePath.replace(/[\\/][^\\/]*$/, '') : '';
      ps.editor = new KEditor(mount, {
        markdown: text,
        editable: () => false,                                  // อ่านอย่างเดียวจริง ๆ
        resolveSrc: (p) => (dir ? resolveImg(dir, p) : p),
      });
      mount.classList.add('player-readonly');
    } catch (e) {
      log('warn', t('ui.player.playerModeUseProseMirror'), e);
      const pre = el('div', 'player-plain');
      pre.textContent = text;
      mount.append(pre);
    }
  }

  // ───────── ทางเลือก ─────────
  const choiceBox = el('div', 'player-choices');
  if (node.choices.length) {
    choiceBox.append(el('div', 'player-ask', tr('youWill', t('ui.player.you'))));
    node.choices.forEach((c) => {
      const target = c.nextSceneId ? graph.byId.get(c.nextSceneId) : null;
      const b = el('button', 'player-choice' + (target ? '' : ' player-choice-dead'));
      b.append(el('span', 'player-choice-text', c.text || tr('aChoice', t('ui.common.choice'))));
      b.append(el('span', 'player-choice-to',
        target ? '→ ' + target.title
               : (c.nextSceneId ? '→ ' + tr('goneScene', t('ui.common.sceneFind')) : tr('noTarget', t('ui.common.notSpecifyTo2')))));
      if (c.color) b.style.borderLeftColor = c.color;
      if (!target) {
        b.title = tr('deadHint', t('ui.player.choiceNotHasTo'));
        b.onclick = () => setStatus(tr('deadHint', t('ui.player.choiceNotHasTo')));
      } else {
        b.onclick = async () => {
          run.steps.push({ sceneId: target.id, sceneTitle: target.title,
                           choice: c.text || '', at: new Date().toISOString() });
          if (!target.choices.length) { run.endedAt = new Date().toISOString(); run.endedAtTitle = target.title; }
          else { delete run.endedAt; delete run.endedAtTitle; }
          await persistRun(run);
          // บันทึกลงประวัติการตัดสินใจรวมด้วย (ของเดิม ข้อ 83 — แดชบอร์ด/Wiki ใช้อยู่)
          try {
            const { recordChoice } = await import('./player-choices.js');
            await recordChoice(node.id, node.title, c.text);
          } catch {}
          renderPlayer(host);
        };
      }
      choiceBox.append(b);
    });
  } else {
    choiceBox.append(el('div', 'player-end', '🏁 ' + tr('theEnd', t('ui.player.endBranchDone'))));
    choiceBox.append(el('div', 'dim', `${tr('walked', t('ui.player.all'))} ${run.steps.length} ${tr('scenesUnit', t('ui.common.scene2'))}`));
  }
  wrap.append(choiceBox);

  // ───────── แถบล่าง: ย้อนกลับ · ประวัติ ─────────
  const foot = el('div', 'player-foot');
  const backB = el('button', 'player-btn player-back', '◀ ' + tr('back', t('ui.player.undo')));
  backB.disabled = run.steps.length < 2;
  backB.title = tr('backHint', t('ui.player.oneStepChoiceLatest'));
  backB.onclick = async () => {
    if (run.steps.length < 2) return;
    run.steps.pop();
    delete run.endedAt; delete run.endedAtTitle;
    await persistRun(run);
    renderPlayer(host);
  };
  const histB = el('button', 'player-btn', '🎯 ' + tr('history', t('ui.common.history')) + ` (${getPlaythroughs().length})`);
  histB.title = tr('historyHint', t('ui.player.roundPlayAll'));
  histB.onclick = () => showPlaythroughsDialog(graph, host);
  foot.append(backB, histB);
  wrap.append(foot);

  // สลับเนื้อทีเดียวจบ (ของเดิมยังอยู่จนถึงบรรทัดนี้ → ไม่มีจังหวะแผงว่าง)
  if (gen === _playGen) host.replaceChildren(wrap);
}

// ───────── กล่องประวัติรอบการเล่น ─────────
export function showPlaythroughsDialog(graph, host) {
  const runs = [...getPlaythroughs()].reverse();
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog branch-dlg');
  box.append(el('div', 'k-dlg-title', '🎯 ' + tr('runsTitle', t('ui.player.roundPlay')) + ` (${runs.length})`));
  const list = el('div', 'k-pick-list');
  list.style.maxHeight = '50vh';
  if (!runs.length) {
    list.append(el('div', 'dim', tr('noRuns', t('ui.player.notHasRoundPlay'))));
  }
  for (const r of runs) {
    const row = el('div', 'k-menu-item player-run-row');
    let when = r.startedAt;
    try { when = new Date(r.startedAt).toLocaleString(); } catch {}
    const path = (r.steps || []).map((s) => s.sceneTitle).join(' → ');
    row.append(el('div', 'player-run-head',
      `${r.endedAt ? '🏁' : '▶'} ${(r.steps || []).length} ${tr('scenesUnit', t('ui.common.scene2'))} · ${when}`));
    const p = el('div', 'player-run-path', path);
    p.title = path;
    row.append(p);
    row.onclick = () => {
      // เล่นซ้ำรอบเดิม = ตั้งเส้นทางกลับเป็นของรอบนั้น (ไม่ใช่แค่ฉากเริ่ม)
      const ps = pstate();
      ps.run = JSON.parse(JSON.stringify(r));
      ps.run.id = 'run-' + Date.now().toString(36);
      ov.remove();
      if (host) renderPlayer(host); else refreshOpenPlayer();
    };
    list.append(row);
  }
  box.append(list);
  const btns = el('div', 'k-dlg-btns');
  const expB = el('button', null, '📥 ' + tr('exportRuns', t('ui.common.export')));
  expB.onclick = async () => {
    const dest = await kapi.saveAsDialog('playthroughs.json', 'json');
    if (!dest) return;
    await kapi.writeFile(dest, JSON.stringify(getPlaythroughs(), null, 2));
    setStatus(tr('exported', t('ui.player.exportRoundPlayDone')) + dest);
  };
  const clearB = el('button', 'k-danger', tr('clearRuns', t('ui.common.clear')));
  clearB.onclick = async () => {
    await savePlaythroughs([]);
    ov.remove();
    setStatus(tr('cleared', t('ui.player.clearRoundPlayDone')));
    refreshOpenPlayer();
  };
  const close = el('button', 'k-ok', tr('close', t('ui.common.close')));
  close.onclick = () => ov.remove();
  btns.append(expB, clearB, close);
  box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  return ov;
}

/** ล้างสถานะตอนปิดโปรเจกต์ (ไม่งั้นโปรเจกต์ใหม่เห็นรอบเล่นของเก่า) */
export function resetPlayerMode() {
  const ps = pstate();
  if (ps.editor) { try { ps.editor.destroy(); } catch {} }
  state._player = null;
}
