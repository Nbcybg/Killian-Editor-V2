// network-inspector.js — [alpha.166] แผงข้างในผัง Story Network
//
// ผู้ใช้: *"graph เหมือนเครื่องประดับมากกว่า เอามาใช้ประโยชน์"* → ผังต้องตอบคำถามของคนเขียนได้:
//   · การ์ด "โหนดที่เลือก"  — ใครเกี่ยวกับใคร (คลิกบินไปหา) · ปรากฏในฉากไหน (คลิกเปิดฉาก) · โฟกัสเฉพาะเครือข่ายรอบตัว ·
//                             หาเส้นทางไปหาอีกคน · ผูกความสัมพันธ์ใหม่ · ใส่โมเดล 3 มิติแทนโหนด
//   · การ์ด "ข้อสังเกต"     — ศูนย์กลางของเรื่อง · ตัวที่ลอยอยู่คนเดียว · ไม่เคยถูกเอ่ยถึง ·
//                             คู่ที่เจอกันบ่อยแต่ยังไม่มีความสัมพันธ์ (กดผูกได้ทันที)
//   · การ์ด "ฉากหลัง"       — อวกาศ · แผนที่ wargame · พิมพ์เขียว · กระดาษเก่า · รูปของผู้ใช้ · สี · กริด · โมเดลประจำหมวด
// ตรรกะอยู่ network-insights.js / network-scene.js (บริสุทธิ์) — ไฟล์นี้แค่วาดและต่อปุ่ม
// ข้อความของผู้ใช้ (ชื่อ · บทบาท · ชื่อไฟล์) ลง textContent เท่านั้น (กฎข้อ 11)
import { t as tt, tf as ttf } from './i18n.js';
import { el } from './core.js';
import { gi } from './icons.js';
import { REL_LABEL } from './relationship-types.js';
import { netColorDefsOf } from './network-theme.js';
import { storyInsights, relationsOf, scenesOf, isStructNode, WIKI_CATS, sceneOrder } from './network-insights.js';
import { NET_BG_KINDS, NET_GRID_STYLES, normalizeNetScene, withBgKind, modelKeyOf,
         setNodeModel, setCatModel } from './network-scene.js';
import { modelState, modelError, forgetModel } from './network-models.js';

const catLabel = (cat) => { const d = netColorDefsOf('nodes').find((x) => x.id === cat); return d ? d.label : cat; };
const baseName = (p) => String(p || '').split(/[\\/]/).pop();

function btn(text, title, onClick, cls = '') {
  const b = el('button', 'net-side-btn' + (cls ? ' ' + cls : ''), text);
  b.type = 'button';
  if (title) b.title = title;
  b.onclick = (e) => { e.stopPropagation(); onClick(e); };
  return b;
}
function dot(color) { const d = el('span', 'net-dot'); d.style.setProperty('--dot', color || 'var(--dim)'); return d; }
function row(label, ...kids) { const r = el('label', 'net-side-row'); r.append(el('span', 'net-side-lbl', label), ...kids); return r; }
function slider(min, max, step, value, onInput, title) {
  const s = el('input', 'net-side-range'); s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
  if (title) s.title = title;
  s.oninput = () => onInput(Number(s.value));
  return s;
}
function select(opts, value, onChange) {
  const s = el('select', 'net-side-select');
  for (const o of opts) { const x = el('option', null, o.label); x.value = o.value; s.append(x); }
  s.value = value;
  s.onchange = () => onChange(s.value);
  return s;
}
function colorIn(value, onInput, title) {
  const c = el('input', 'net-side-color'); c.type = 'color'; if (value) c.value = value; if (title) c.title = title;
  c.oninput = () => onInput(c.value);
  return c;
}
function list(items, render, max = 8) {
  const box = el('div', 'net-side-list');
  for (const it of items.slice(0, max)) box.append(render(it));
  if (items.length > max) box.append(el('div', 'net-side-more', ttf('ui.netUi.more', items.length - max)));
  return box;
}

/**
 * @param {HTMLElement} pane
 * @param {import('./network.js').StoryNetwork} net
 */
export function buildNetSide(pane, net) {
  const root = el('div', 'net-side');
  const info = el('section', 'net-card net-info');
  const ins = el('section', 'net-card net-insights');
  const scn = el('section', 'net-card net-scene');
  root.append(info, ins, scn);
  pane.appendChild(root);
  const open = new Set();
  // การ์ดเลื่อนเองได้ · คลิก/ล้อในการ์ดต้องไม่ทะลุไปถึงผัง (แพน/ซูมผังโดยไม่ตั้งใจ)
  for (const c of [info, ins, scn]) {
    c.addEventListener('mousedown', (e) => e.stopPropagation());
    c.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  }

  function head(card, title, onClose) {
    const h = el('div', 'net-card-head');
    h.append(el('span', 'net-card-title', title));
    const x = btn(gi('x'), tt('ui.common.close'), onClose, 'net-card-x');
    x.setAttribute('aria-label', tt('ui.common.close'));
    h.append(x);
    card.append(h);
    return h;
  }

  // ─────────── โหนดที่เลือก ───────────
  function renderInfo() {
    const n = net._sel;
    info.replaceChildren();
    info.hidden = !n;
    if (!n) return;
    const col = (net._catCol && net._catCol[n.cat]) || '';
    const h = head(info, '', () => net.select(null));
    const t = h.querySelector('.net-card-title');
    t.replaceChildren(dot(col), el('span', 'net-info-name', n.name));
    t.title = n.name;
    info.append(el('div', 'net-info-cat', catLabel(n.cat)));
    if (n.desc) info.append(el('div', 'net-info-desc', n.desc));
    const rels = relationsOf(n, net.edges);
    const scenes = scenesOf(n, net.edges, net.nodes);
    const struct = isStructNode(n);
    // ฉาก: ใครอยู่ในฉากนี้ (เส้น ent-scene ฝั่งกลับ)
    const cast = struct ? net.edges.filter((e) => e.type === 'ent-scene' && (e.a === n || e.b === n))
      .map((e) => (e.a === n ? e.b : e.a)) : [];
    info.append(el('div', 'net-info-stats', struct
      ? ttf('ui.netUi.statsScene', cast.length)
      : ttf('ui.netUi.stats', rels.length, scenes.length)));

    const acts = el('div', 'net-side-acts');
    acts.append(btn(tt('ui.netUi.openPage'), '', () => net._openNode(n), 'net-side-primary'));
    if (!struct) {
      const f1 = btn(tt('ui.netUi.focus1s'), tt('ui.netUi.focus1'), () => net.setFocus(net._focusHops === 1 ? 0 : 1), net._focusHops === 1 ? 'on' : '');
      const f2 = btn(tt('ui.netUi.focus2s'), tt('ui.netUi.focus2'), () => net.setFocus(net._focusHops === 2 ? 0 : 2), net._focusHops === 2 ? 'on' : '');
      f1.setAttribute('aria-pressed', String(net._focusHops === 1)); f2.setAttribute('aria-pressed', String(net._focusHops === 2));
      acts.append(f1, f2,
        btn(tt('ui.netUi.path'), tt('ui.netUi.pathFrom'), () => net.startPathPick(), net._pathPick ? 'on' : ''));
      if (net.onCreateRel && WIKI_CATS.has(n.cat)) {
        acts.append(btn(tt('ui.netUi.link'), tt('ui.netUi.toolLinkHint'), () => { net.setTool('link'); net._syncTip(); }, net._tool === 'link' ? 'on' : ''));
      }
    }
    info.append(acts);

    // เส้นทาง
    const p = net._path;
    if (p && p.from === n) {
      const box = el('div', 'net-path');
      if (p.none) box.append(el('div', 'net-side-note', ttf('ui.netUi.pathNone', p.from.name, p.to.name)));
      else {
        box.append(el('div', 'net-side-sub', ttf('ui.netUi.pathSteps', p.edges.length)));
        const chain = el('div', 'net-path-chain');
        p.nodes.forEach((x, i) => {
          if (i) {
            const e = p.edges[i - 1];
            const lbl = e.type === 'ent-scene' ? tt('ui.net.mention') : e.type === 'co-occur' ? tt('ui.net.appear') : (e.role || REL_LABEL[e.type] || '');
            chain.append(el('span', 'net-path-edge', lbl));
          }
          const c = btn(x.name, '', () => { net.flyTo(x); }, 'net-chip');
          c.prepend(dot(net._catCol[x.cat]));
          chain.append(c);
        });
        box.append(chain);
        if (p.viaDerived) box.append(el('div', 'net-side-note', tt('ui.netUi.pathViaScenes')));
      }
      info.append(box);
    }

    if (rels.length) {
      info.append(el('div', 'net-side-sub', tt('ui.netUi.relations')));
      info.append(list(rels, ({ node, edge }) => {
        const r = btn('', node.name, () => { net.select(node); net.flyTo(node); }, 'net-item');
        r.append(dot(net._edgeCol[edge.type]), el('span', 'net-item-name', node.name), el('span', 'net-item-meta', edge.role || REL_LABEL[edge.type] || ''));
        return r;
      }, 12));
    }
    const sceneRows = struct ? cast : scenes;
    if (sceneRows.length) {
      info.append(el('div', 'net-side-sub', struct ? tt('ui.netUi.castOfScene') : tt('ui.netUi.appearsIn')));
      info.append(list(sceneRows, (x) => {
        const r = btn('', x.name, () => (isStructNode(x) ? net.onOpenScene && net.onOpenScene(x.file) : (net.select(x), net.flyTo(x))), 'net-item');
        r.append(el('span', 'net-item-ico', gi(isStructNode(x) ? 'file' : 'user')), el('span', 'net-item-name', x.name));
        return r;
      }, 10));
    }
    if (!struct) info.append(modelBlock(n));
  }

  function modelBlock(n) {
    const box = el('div', 'net-model');
    box.append(el('div', 'net-side-sub', tt('ui.netUi.model')));
    const own = net._scene.models.byNode[modelKeyOf(n)];
    const m = net.modelOf(n);
    const line = el('div', 'net-side-acts');
    line.append(btn(own ? tt('ui.netUi.modelChange') : tt('ui.netUi.modelPick'), tt('ui.netUi.modelHint'), () => pickModel(n)));
    if (own) line.append(btn(tt('ui.netUi.modelRemove'), '', () => setModel(n, null), 'net-side-danger'));
    box.append(line);
    if (m) {
      const st = modelState(m.abs);
      const name = el('div', 'net-side-note', baseName(m.file) + (own ? '' : ' · ' + tt('ui.netUi.modelFromCat')));
      box.append(name);
      if (st === 'error') box.append(el('div', 'net-side-err', ttf('ui.netUi.modelErr', modelError(m.abs))));
      else if (st === 'loading' || st === '') box.append(el('div', 'net-side-note', tt('ui.netUi.modelLoading')));
      if (own) {
        box.append(row(tt('ui.netUi.modelScale'), slider(0.2, 6, 0.1, own.scale, (v) => net.updateScene(setNodeModel(net._scene, n, { ...own, scale: v })))));
        box.append(row(tt('ui.netUi.modelYaw'), slider(0, 345, 15, own.yaw || 0, (v) => net.updateScene(setNodeModel(net._scene, n, { ...own, yaw: v })))));
      }
    }
    return box;
  }

  async function pickModel(n, cat) {
    if (!net.importAsset) return false;
    const rel = await net.importAsset('model');
    if (!rel) return false;
    const ref = { file: rel, scale: 1, yaw: 0 };
    net.updateScene(cat ? setCatModel(net._scene, cat, ref) : setNodeModel(net._scene, n, ref));
    net._showImages = true;
    update();
    return true;
  }
  function setModel(n, ref) {
    const cur = net.modelOf(n);
    net.updateScene(setNodeModel(net._scene, n, ref));
    if (!ref && cur) forgetModel(cur.abs);
    update();
  }

  // ─────────── ข้อสังเกตของเรื่อง ───────────
  function renderInsights() {
    ins.replaceChildren();
    ins.hidden = !open.has('insights');
    if (ins.hidden) return;
    head(ins, tt('ui.netUi.insights'), () => toggle('insights'));
    const I = storyInsights(net.nodes, net.edges);
    const nodeRow = (n, meta, extra) => {
      const r = btn('', n.name, () => { net.select(n); net.flyTo(n); }, 'net-item');
      r.append(dot(net._catCol[n.cat]), el('span', 'net-item-name', n.name));
      if (meta) r.append(el('span', 'net-item-meta', meta));
      if (extra) r.append(extra);
      return r;
    };
    const section = (title, items, render, emptyKey) => {
      ins.append(el('div', 'net-side-sub', ttf('ui.netUi.countTitle', title, items.length)));
      if (!items.length) { ins.append(el('div', 'net-side-note', tt(emptyKey))); return; }
      ins.append(list(items, render));
    };
    section(tt('ui.netUi.hubs'), I.hubs, (h) => nodeRow(h.node, ttf('ui.netUi.hubMeta', h.rel, h.scenes)), 'ui.netUi.noneYet');
    section(tt('ui.netUi.suggest'), I.suggestions, (sg) => {
      const r = el('div', 'net-item net-suggest');
      const names = btn(sg.a.name + ' · ' + sg.b.name, ttf('ui.netUi.suggestTip', sg.count), () => { net.select(sg.a); net.findPath(sg.a, sg.b); }, 'net-item-link');
      r.append(names, el('span', 'net-item-meta', ttf('ui.netUi.coScenes', sg.count)));
      if (net.onCreateRel) {
        r.append(btn(tt('ui.netUi.link'), tt('ui.netUi.suggestLink'), () => {
          Promise.resolve(net.onCreateRel(sg.a, sg.b)).then((ok) => { if (ok) net.refresh(); });
        }, 'net-side-mini'));
      }
      return r;
    }, 'ui.netUi.suggestNone');
    section(tt('ui.netUi.isolated'), I.isolated, (n) => nodeRow(n), 'ui.netUi.isolatedNone');
    if (net.nodes.some((n) => n.cat === 'scene')) {
      section(tt('ui.netUi.unmentioned'), I.unmentioned, (n) => nodeRow(n), 'ui.netUi.unmentionedNone');
    }
  }

  // ─────────── ฉากหลัง / กริด / โมเดลประจำหมวด ───────────
  function renderScene() {
    scn.replaceChildren();
    scn.hidden = !open.has('scene');
    if (scn.hidden) return;
    head(scn, tt('ui.netUi.sceneBtn'), () => toggle('scene'));
    const S = net._scene, bg = S.bg;
    const upd = (patch) => { net.updateScene(patch); };
    const updBg = (p) => upd({ bg: { ...net._scene.bg, ...p } });
    scn.append(row(tt('ui.netScene.bg'), select(NET_BG_KINDS.map((k) => ({ value: k.id, label: tt(k.lk) })), bg.kind,
      (v) => { net.updateScene(withBgKind(net._scene, v)); renderScene(); })));
    if (!['theme', 'image'].includes(bg.kind)) {
      const cs = el('span', 'net-side-inline');
      cs.append(colorIn(bg.c1, (v) => updBg({ c1: v }), tt('ui.netScene.color1')));
      if (bg.kind !== 'solid') cs.append(colorIn(bg.c2, (v) => updBg({ c2: v }), tt('ui.netScene.color2')));
      scn.append(row(tt('ui.netScene.colors'), cs));
    }
    if (bg.kind === 'space') scn.append(row(tt('ui.netScene.stars'), slider(0, 3, 0.1, bg.stars, (v) => updBg({ stars: v }))));
    if (bg.kind === 'image') {
      const line = el('span', 'net-side-inline');
      line.append(btn(bg.image ? tt('ui.netScene.imageChange') : tt('ui.netScene.imagePick'), '', async () => {
        const rel = net.importAsset ? await net.importAsset('image') : '';
        if (rel) { updBg({ image: rel }); renderScene(); }
      }));
      if (bg.image) line.append(el('span', 'net-side-file', baseName(bg.image)));
      scn.append(row(tt('ui.netScene.image'), line));
      scn.append(row(tt('ui.netScene.imageMode'), select([
        { value: 'world', label: tt('ui.netScene.imageWorld') }, { value: 'screen', label: tt('ui.netScene.imageScreen') },
      ], bg.imageMode, (v) => { updBg({ imageMode: v }); renderScene(); })));
      if (bg.imageMode === 'world') {
        // สเกลแบบลอการิทึม: 5% – 2000%
        const toS = (v) => Math.round(Math.pow(10, v) * 1000) / 1000;
        scn.append(row(tt('ui.netScene.imageScale'), slider(-1.3, 1.3, 0.01, Math.log10(bg.imageScale), (v) => updBg({ imageScale: toS(v) }))));
        scn.append(el('div', 'net-side-note', tt('ui.netScene.imageCenterHint')));
      }
      scn.append(row(tt('ui.netScene.imageOpacity'), slider(0, 1, 0.05, bg.imageOpacity, (v) => updBg({ imageOpacity: v }))));
    }
    scn.append(row(tt('ui.netScene.dim'), slider(0, 0.9, 0.05, bg.dim, (v) => updBg({ dim: v }))));
    // กริด
    scn.append(el('div', 'net-side-sub', tt('ui.netScene.grid')));
    scn.append(row(tt('ui.netScene.gridStyle'), select(NET_GRID_STYLES.map((g) => ({ value: g.id, label: tt(g.lk) })), S.grid.style,
      (v) => upd({ grid: { ...net._scene.grid, style: v } }))));
    const gc = el('span', 'net-side-inline');
    gc.append(colorIn(S.grid.color || net._grid, (v) => upd({ grid: { ...net._scene.grid, color: v } }), tt('ui.netScene.gridColor')),
      btn(tt('ui.netScene.gridColorAuto'), '', () => { upd({ grid: { ...net._scene.grid, color: '' } }); renderScene(); }, 'net-side-mini'));
    scn.append(row(tt('ui.netScene.gridColor'), gc));
    // โมเดลประจำหมวด
    scn.append(el('div', 'net-side-sub', tt('ui.netScene.catModels')));
    for (const cat of ['characters', 'locations', 'items', 'lore']) {
      const m = S.models.byCat[cat];
      const line = el('span', 'net-side-inline');
      line.append(btn(m ? baseName(m.file) : tt('ui.netUi.modelPick'), tt('ui.netScene.catModelHint'), () => pickModel(null, cat), m ? 'net-side-file' : ''));
      if (m) line.append(btn(gi('x'), tt('ui.netUi.modelRemove'), () => {
        const abs = net.assetPath ? net.assetPath(m.file) : '';
        net.updateScene(setCatModel(net._scene, cat, null)); if (abs) forgetModel(abs); renderScene();
      }, 'net-side-mini'));
      const lr = row(catLabel(cat), line);
      lr.prepend(dot(net._catCol[cat]));
      scn.append(lr);
    }
    const foot = el('div', 'net-side-acts');
    foot.append(btn(tt('ui.netScene.reset'), '', () => {
      const keep = normalizeNetScene(net._scene).models;
      net.updateScene({ ...normalizeNetScene(null), models: keep }); renderScene();
    }, 'net-side-danger'));
    scn.append(foot);
  }

  function update() {
    try { renderInfo(); } catch (e) { console.error('net-side info', e); }
    try { renderInsights(); } catch (e) { console.error('net-side insights', e); }
    // การ์ดฉากหลังไม่วาดใหม่ทุกครั้ง (กำลังลากสไลเดอร์อยู่แล้ววาดทับ = หลุดมือ) — วาดตอนเปิด/เปลี่ยนชนิดเท่านั้น
    root.classList.toggle('empty', info.hidden && ins.hidden && scn.hidden);
  }
  function toggle(id) { if (open.has(id)) open.delete(id); else open.add(id); if (id === 'scene') renderScene(); update(); net._syncToolbar(); return open.has(id); }
  function openCard(id) { if (!open.has(id)) toggle(id); return true; }

  update(); renderScene();
  return {
    update, toggle, open: openCard, isOpen: (id) => open.has(id),
    pickModel, setModel,
    destroy() { root.remove(); },
    el: root,
  };
}

/**
 * [alpha.166 · รอบ 2] แถบไทม์ไลน์เรื่อง (ใต้ผัง) — เลื่อนดูว่าถึงฉากที่เท่าไรแล้วใครเข้าเรื่อง/รู้จักใคร
 * ⏮ กลับจุดเริ่ม · ◀ ▶ ทีละฉาก · เล่นอัตโนมัติ · แถบเลื่อน · ปิด
 */
export function buildStoryBar(pane, net) {
  const bar = el('div', 'net-story');
  bar.hidden = true;
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', tt('ui.netUi.storyBtn'));
  bar.addEventListener('mousedown', (e) => e.stopPropagation());
  const first = btn(gi('skip-previous'), tt('ui.netUi.storyFirst'), () => { net.playStory(false); net.setStory({ upTo: 0 }); }, 'net-story-btn');
  const prev = btn(gi('chevron-left'), tt('ui.netUi.storyPrev'), () => { net.playStory(false); net.setStory({ upTo: (net._story?.upTo || 0) - 1 }); }, 'net-story-btn');
  const play = btn(gi('play'), tt('ui.netUi.storyPlay'), () => net.playStory(!net.isStoryPlaying()), 'net-story-btn net-story-play');
  const next = btn(gi('chevron-right'), tt('ui.netUi.storyNext'), () => { net.playStory(false); net.setStory({ upTo: (net._story?.upTo || 0) + 1 }); }, 'net-story-btn');
  const range = el('input', 'net-story-range'); range.type = 'range'; range.min = '0'; range.step = '1';
  range.setAttribute('aria-label', tt('ui.netUi.storyBtn'));
  // อ่านค่าก่อนหยุดเล่น — playStory(false) วาดแถบใหม่จากสภาพเดิม (ค่าที่ผู้ใช้เพิ่งลากถูกทับกลับ = แถบเด้งคืน)
  range.oninput = () => { const v = Number(range.value); net.playStory(false); net.setStory({ upTo: v }); };
  const label = el('span', 'net-story-label');
  const close = btn(gi('close'), tt('ui.common.close'), () => net.setStory(null), 'net-story-btn');
  close.setAttribute('aria-label', tt('ui.common.close'));
  for (const b of [first, prev, play, next]) b.setAttribute('aria-label', b.title);
  bar.append(first, prev, play, next, range, label, close);
  pane.appendChild(bar);
  function update() {
    const st = net._story;
    bar.hidden = !st;
    pane.classList.toggle('net-story-on', !!st);        // แถบสถานะ/มินิแมปของผังขยับขึ้นหลบ
    if (!st) return;
    const order = sceneOrderOf(net);
    range.max = String(order.length);
    range.value = String(st.upTo);
    const cur = st.upTo ? order[st.upTo - 1] : null;
    const pr = net._progress();
    label.textContent = cur
      ? ttf('ui.netUi.storyAt', st.upTo, order.length, cur.name) + (pr && pr.fresh.size ? ' · ' + ttf('ui.netUi.storyNew', pr.fresh.size) : '')
      : ttf('ui.netUi.storyStart', order.length);
    label.title = label.textContent;
    const playing = net.isStoryPlaying();
    play.textContent = gi(playing ? 'pause' : 'play');
    play.title = tt(playing ? 'ui.netUi.storyPause' : 'ui.netUi.storyPlay');
    play.setAttribute('aria-label', play.title);
    play.classList.toggle('on', playing);
    prev.disabled = st.upTo <= 0; first.disabled = st.upTo <= 0; next.disabled = st.upTo >= order.length;
  }
  return { update, el: bar, destroy() { bar.remove(); } };
}
function sceneOrderOf(net) { return sceneOrder(net.nodes); }
