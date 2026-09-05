// planner-props.js — แผงคุณสมบัติ Planner v4
// บั๊ก 3  : การ์ดไม่มีคุณสมบัติ + ผูกไฟล์จาก Explorer ไม่ได้ → มีครบทุกฟิลด์ + ปุ่ม "เลือกจากโปรเจกต์"
// บั๊ก 10 : เส้นเชื่อมแก้ไม่ได้ ลบไม่ได้ → มีฟิลด์ครบ + ปุ่มลบ + สลับทิศ
// บั๊ก 11 : เลือกหัวลูกศรไม่ได้ → มีทั้งหัวต้นทางและปลายทาง
import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { el } from '../core.js';
import {
  STATUSES, EDGE_STYLES, EDGE_ROUTINGS, ARROW_HEADS, NODE_TYPES, SHAPES, PORT_POSITIONS,
} from './planner-data.js';

const TYPE_LABELS = {
  scene: tt('ui.plannerProps.scene'), chapter: tt('ui.plannerProps.chapter'), entity: '👤 Wiki', note: tt('ui.plannerProps.note'), sticky: tt('ui.plannerProps.sticky'),
  text: tt('ui.plannerProps.text'), shape: tt('ui.plannerProps.shape'), frame: tt('ui.plannerProps.frame'), comment: tt('ui.plannerProps.comment'),
};
const SHAPE_LABELS = {
  rect: tt('ui.plannerProps.rect'), round: tt('ui.plannerProps.corner'), ellipse: tt('ui.plannerProps.ellipse'), diamond: tt('ui.plannerProps.cut'),
  triangle: tt('ui.plannerProps.triangle'), star: tt('ui.plannerProps.star'), arrow: tt('ui.plannerProps.arrow'), cylinder: tt('ui.plannerProps.cylinder'),
};
const ROUTING_LABELS = { straight: tt('ui.plannerProps.at'), orthogonal: tt('ui.common.cornerScene'), curved: tt('ui.common.curve') };
const ARROW_LABELS = {
  none: tt('ui.plannerProps.notHas'), arrow: tt('ui.plannerProps.arrow2'), triangle: tt('ui.plannerProps.triangleSolid'),
  circle: tt('ui.plannerProps.circle'), diamond: tt('ui.plannerProps.cut2'), bar: tt('ui.plannerProps.dash'),
};
const PORT_LABELS = { auto: tt('ui.plannerProps.auto'), top: tt('ui.plannerProps.top'), right: tt('ui.common.right'), bottom: tt('ui.plannerProps.bottom'), left: tt('ui.common.left') };

export function renderPlannerProps(container, ctx) {
  if (!container) return;
  const { mode, data } = ctx || {};
  container.innerHTML = '';
  if (mode === 'node' && data) _renderNodeProps(container, data, ctx);
  else if (mode === 'edge' && data) _renderEdgeProps(container, data, ctx);
  else if (mode === 'many' && data) _renderManyProps(container, data, ctx);
  else container.innerHTML = tt('ui.plannerProps.clickCardLineLink') +
      tt('ui.plannerProps.dragDotColorRound');
}

// ═════════════════ การ์ด / วัตถุ ═════════════════
function _renderNodeProps(container, n, ctx) {
  const wrap = el('div', 'planner-props-wrap');
  wrap.appendChild(_head('✏️ ' + (TYPE_LABELS[n.type] || tt('ui.plannerProps.object'))));

  const isText = n.type === 'text';
  const isShape = n.type === 'shape';
  const isNote = n.type === 'sticky' || n.type === 'comment';
  const isCard = ['scene', 'chapter', 'entity', 'note'].includes(n.type);

  const rows = el('div', 'planner-props-body');
  wrap.appendChild(rows);
  const add = (label, html) => {
    const row = el('div', 'planner-props-section');
    row.innerHTML = (label ? `<label>${label}</label>` : '') + html;
    rows.appendChild(row);
    return row;
  };

  add(isText ? tt('ui.common.text') : tt('ui.common.name'), `<input class="planner-prop-input" id="plp-title" value="${_esc(n.title)}">`);
  add(tt('ui.common.type'), `<select class="planner-prop-input" id="plp-type">
      ${NODE_TYPES.map((t) => `<option value="${t}"${n.type === t ? ' selected' : ''}>${TYPE_LABELS[t] || t}</option>`).join('')}
    </select>`);
  if (isShape) {
    add(tt('ui.common.shape'), `<select class="planner-prop-input" id="plp-shape">
        ${SHAPES.map((s) => `<option value="${s}"${n.shape === s ? ' selected' : ''}>${SHAPE_LABELS[s] || s}</option>`).join('')}
      </select>`);
  }
  if (isCard) {
    add(tt('ui.common.status'), `<select class="planner-prop-input" id="plp-status">
        ${STATUSES.map((s) => `<option value="${s}"${n.status === s ? ' selected' : ''}>${s || tt('ui.common.notSpecify2')}</option>`).join('')}
      </select>`);
  }
  add(isNote ? tt('ui.plannerProps.body') : tt('ui.plannerProps.summaryCollapse'),
    `<textarea class="planner-prop-input" id="plp-synopsis" rows="3" placeholder="${isNote ? tt('ui.plannerProps.printText') : tt('ui.plannerProps.occurScene')}">${_esc(n.synopsis)}</textarea>`);

  // ── สี + ตัวอักษร ──
  add(tt('ui.common.color'), ttf('ui.plannerProps.msg', _color(n.color, '#3f3e3a'), _color(n.textColor, '#faf9f5')));
  const swatch = el('div', 'planner-swatches');
  for (const c of ['#3f3e3a', '#5f7a9f', '#7a6f9f', '#5f8a6f', '#d97757', '#f2c14e', '#c1666b', '#4a6fa5', '#e8e3d3', '#26241f']) {
    const b = el('button', 'planner-swatch');
    b.style.background = c; b.title = c;
    b.onclick = () => { const i = rows.querySelector('#plp-color'); if (i) i.value = c; ctx.onChangeNode && ctx.onChangeNode({ color: c }); };
    swatch.appendChild(b);
  }
  rows.appendChild(swatch);

  add(ttf('ui.plannerProps.sizeChar', Math.round(n.fontSize || 12)),
    `<input class="planner-prop-input" id="plp-fs" type="range" min="8" max="48" step="0.5" value="${n.fontSize || 12}">`);

  // ── ตำแหน่ง / ขนาด (บั๊ก 8 ฝั่งวัตถุ) ──
  add(tt('ui.plannerProps.posXY'), `<div class="planner-prop-2col">
      <input class="planner-prop-input" id="plp-x" type="number" value="${Math.round(n.x)}">
      <input class="planner-prop-input" id="plp-y" type="number" value="${Math.round(n.y)}">
    </div>`);
  add(tt('ui.plannerProps.wideHigh'), `<div class="planner-prop-2col">
      <input class="planner-prop-input" id="plp-w" type="number" min="16" value="${Math.round(n.width)}">
      <input class="planner-prop-input" id="plp-h" type="number" min="16" value="${Math.round(n.height)}">
    </div>`);

  // ── ผูกไฟล์จาก Explorer (บั๊ก 3) ──
  const fileRow = add(tt('ui.plannerProps.fileBind'),
    ttf('ui.plannerProps.pickProject', _esc(n.file || '')));
  add(tt('ui.common.tag'), ttf('ui.plannerProps.msg2', _esc((n.tags || []).join(', '))));
  add('', ttf('ui.plannerProps.lockNotMoveEdit', n.locked ? ' checked' : ''));

  const actions = el('div', 'planner-props-actions');
  actions.innerHTML = tt('ui.plannerProps.linkLineScrollFind');
  wrap.appendChild(actions);
  const actions2 = el('div', 'planner-props-actions');
  const dupBtn = el('button', '', tt('ui.common.repeat'));
  dupBtn.onclick = () => ctx.onDuplicateNode && ctx.onDuplicateNode(n.id);
  const delBtn = el('button', 'danger', tt('ui.plannerProps.delObject'));
  delBtn.onclick = () => ctx.onDeleteNode && ctx.onDeleteNode(n.id);
  actions2.append(dupBtn, delBtn);
  wrap.appendChild(actions2);

  // ── เส้นที่ต่อกับการ์ดนี้ (บั๊ก 10 : เข้าถึงเส้นได้โดยไม่ต้องคลิกโดน) ──
  const conns = (ctx.connections || []);
  if (conns.length) {
    wrap.appendChild(_head(tt('ui.plannerProps.lineNext') + conns.length + ')'));
    const list = el('div', 'planner-conn-list');
    for (const c of conns) {
      const row = el('div', 'planner-conn-row');
      const name = el('span', 'planner-conn-name', `${c.dir === 'out' ? '→' : '←'} ${c.otherTitle}${c.label ? ' · ' + c.label : ''}`);
      name.onclick = () => ctx.onSelectEdgeId && ctx.onSelectEdgeId(c.id);
      const del = el('button', 'planner-conn-del', '✕');
      del.title = tt('ui.plannerProps.delLine');
      del.onclick = () => ctx.onDeleteEdge && ctx.onDeleteEdge(c.id);
      row.append(name, del);
      list.appendChild(row);
    }
    wrap.appendChild(list);
  }

  container.appendChild(wrap);

  // ── ผูกอีเวนต์ ──
  const q = (id) => wrap.querySelector('#' + id);
  const deb = _debouncer();
  const set = (props) => ctx.onChangeNode && ctx.onChangeNode(props);

  q('plp-title').oninput = () => deb(() => set({ title: q('plp-title').value }));
  q('plp-type').onchange = () => set({ type: q('plp-type').value });
  if (q('plp-shape')) q('plp-shape').onchange = () => set({ shape: q('plp-shape').value });
  if (q('plp-status')) q('plp-status').onchange = () => set({ status: q('plp-status').value });
  q('plp-synopsis').oninput = () => deb(() => set({ synopsis: q('plp-synopsis').value }));
  q('plp-color').oninput = () => deb(() => set({ color: q('plp-color').value }));
  q('plp-textcolor').oninput = () => deb(() => set({ textColor: q('plp-textcolor').value }));
  q('plp-fs').oninput = () => {
    const v = parseFloat(q('plp-fs').value);
    const lbl = q('plp-fs').parentElement.querySelector('label');
    if (lbl) lbl.textContent = ttf('ui.plannerProps.sizeChar', Math.round(v));
    deb(() => set({ fontSize: v }));
  };
  for (const [id, key] of [['plp-x', 'x'], ['plp-y', 'y'], ['plp-w', 'width'], ['plp-h', 'height']]) {
    q(id).onchange = () => set({ [key]: parseFloat(q(id).value) });
  }
  q('plp-file').onchange = () => set({ file: q('plp-file').value.trim() || null });
  q('plp-tags').oninput = () => deb(() => set({ tags: q('plp-tags').value.split(',').map((s) => s.trim()).filter(Boolean) }));
  q('plp-lock').onchange = () => set({ locked: q('plp-lock').checked });

  q('plp-pick').onclick = async () => {
    if (!ctx.onPickFile) return;
    const picked = await ctx.onPickFile();
    if (!picked) return;
    q('plp-file').value = picked.path || '';
    const props = { file: picked.path || null };
    // [alpha.128] ชื่อตั้งต้นสองตัวนี้มาจากไฟล์ภาษา (`ui.common.new2` · `ui.common.notSpecifyName`)
    // ฮาร์ดโค้ดไทยไว้ = หน้าจออังกฤษเทียบไม่ติด แล้วชื่อการ์ดไม่ยอมเปลี่ยนตามฉากที่เพิ่งผูก
    const autoName = [t('ui.common.new2'), t('ui.common.notSpecifyName')];
    if (picked.title && (!n.title || autoName.includes(n.title))) props.title = picked.title;
    set(props);
  };
  q('plp-unlink').onclick = () => { q('plp-file').value = ''; set({ file: null }); };
  q('plp-link').onclick = () => ctx.onConnectFrom && ctx.onConnectFrom(n.id);
  q('plp-center').onclick = () => ctx.onCenterNode && ctx.onCenterNode(n.id);
  q('plp-reveal').onclick = () => ctx.onRevealFile && ctx.onRevealFile(n.file);
  if (fileRow && !n.file) fileRow.classList.add('planner-unlinked');
}

// ═════════════════ เส้นเชื่อม ═════════════════
function _renderEdgeProps(container, e, ctx) {
  const wrap = el('div', 'planner-props-wrap');
  wrap.appendChild(_head(tt('ui.plannerProps.lineLink')));
  const rows = el('div', 'planner-props-body');
  wrap.appendChild(rows);
  const add = (label, html) => {
    const row = el('div', 'planner-props-section');
    row.innerHTML = (label ? `<label>${label}</label>` : '') + html;
    rows.appendChild(row);
    return row;
  };

  if (ctx.endpoints) {
    add(tt('ui.plannerProps.linkTo'),
      `<div class="planner-edge-ends">${_esc(ctx.endpoints.from)} <b>→</b> ${_esc(ctx.endpoints.to)}</div>`);
  }
  add(tt('ui.plannerProps.badge'), ttf('ui.plannerProps.msg3', _esc(e.label)));
  add(tt('ui.common.color'), `<input class="planner-prop-input" id="plpe-color" type="color" value="${_color(e.color, '#d97757')}">`);
  add(ttf('ui.plannerProps.bold', e.width || 2),
    `<input class="planner-prop-input" id="plpe-width" type="range" min="1" max="8" step="1" value="${e.width || 2}">`);

  add(tt('ui.common.route'), `<select class="planner-prop-input" id="plpe-routing">
      ${EDGE_ROUTINGS.map((r) => `<option value="${r}"${(e.routing || 'straight') === r ? ' selected' : ''}>${ROUTING_LABELS[r]}</option>`).join('')}
    </select>`);

  // สไตล์เส้น (ปุ่มกด)
  const styleRow = el('div', 'planner-props-section');
  styleRow.innerHTML = tt('ui.plannerProps.line');
  const styleBtns = el('div', 'planner-props-edge-style');
  const STYLE_TH = { solid: tt('ui.common.solid'), dashed: tt('ui.common.msg5'), dotted: tt('ui.common.dot') };
  for (const s of EDGE_STYLES) {
    const b = el('button', (e.style || 'solid') === s ? 'active' : '', STYLE_TH[s] || s);
    b.onclick = () => {
      styleBtns.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      ctx.onChangeEdge && ctx.onChangeEdge({ style: s });
    };
    styleBtns.appendChild(b);
  }
  styleRow.appendChild(styleBtns);
  rows.appendChild(styleRow);

  // หัวลูกศรทั้งสองปลาย (บั๊ก 11)
  add(tt('ui.plannerProps.headArrowFromTo'), `<div class="planner-prop-2col">
      <select class="planner-prop-input" id="plpe-as">
        ${ARROW_HEADS.map((a) => `<option value="${a}"${(e.arrowStart || 'none') === a ? ' selected' : ''}>${ARROW_LABELS[a]}</option>`).join('')}
      </select>
      <select class="planner-prop-input" id="plpe-ae">
        ${ARROW_HEADS.map((a) => `<option value="${a}"${(e.arrowEnd || 'arrow') === a ? ' selected' : ''}>${ARROW_LABELS[a]}</option>`).join('')}
      </select>
    </div>`);

  add(tt('ui.plannerProps.dotNextFromTo'), `<div class="planner-prop-2col">
      <select class="planner-prop-input" id="plpe-fp">
        ${PORT_POSITIONS.map((p) => `<option value="${p}"${e.from.port === p ? ' selected' : ''}>${PORT_LABELS[p]}</option>`).join('')}
      </select>
      <select class="planner-prop-input" id="plpe-tp">
        ${PORT_POSITIONS.map((p) => `<option value="${p}"${e.to.port === p ? ' selected' : ''}>${PORT_LABELS[p]}</option>`).join('')}
      </select>
    </div>`);

  const actions = el('div', 'planner-props-actions');
  const flip = el('button', '', tt('ui.common.toggle'));
  flip.onclick = () => ctx.onFlipEdge && ctx.onFlipEdge(e.id);
  const delBtn = el('button', 'danger', tt('ui.plannerProps.delLine2'));
  delBtn.onclick = () => ctx.onDeleteEdge && ctx.onDeleteEdge(e.id);
  actions.append(flip, delBtn);
  wrap.appendChild(actions);
  container.appendChild(wrap);

  const q = (id) => wrap.querySelector('#' + id);
  const deb = _debouncer();
  const set = (p) => ctx.onChangeEdge && ctx.onChangeEdge(p);
  q('plpe-label').oninput = () => deb(() => set({ label: q('plpe-label').value }));
  q('plpe-color').oninput = () => deb(() => set({ color: q('plpe-color').value }));
  q('plpe-width').oninput = () => {
    const v = parseInt(q('plpe-width').value, 10);
    const lbl = q('plpe-width').parentElement.querySelector('label');
    if (lbl) lbl.textContent = ttf('ui.plannerProps.bold', v);
    deb(() => set({ width: v }));
  };
  q('plpe-routing').onchange = () => set({ routing: q('plpe-routing').value });
  q('plpe-as').onchange = () => set({ arrowStart: q('plpe-as').value });
  q('plpe-ae').onchange = () => set({ arrowEnd: q('plpe-ae').value });
  q('plpe-fp').onchange = () => set({ fromPort: q('plpe-fp').value });
  q('plpe-tp').onchange = () => set({ toPort: q('plpe-tp').value });
}

// ═════════════════ เลือกหลายชิ้น ═════════════════
function _renderManyProps(container, ids, ctx) {
  const wrap = el('div', 'planner-props-wrap');
  wrap.appendChild(_head(ttf('ui.plannerProps.pickItem', ids.length)));
  const rows = el('div', 'planner-props-body');
  wrap.appendChild(rows);

  const colorRow = el('div', 'planner-props-section');
  colorRow.innerHTML = tt('ui.plannerProps.recolorAll');
  const sw = el('div', 'planner-swatches');
  for (const c of ['#3f3e3a', '#5f7a9f', '#7a6f9f', '#5f8a6f', '#d97757', '#f2c14e', '#c1666b', '#4a6fa5']) {
    const b = el('button', 'planner-swatch');
    b.style.background = c;
    b.onclick = () => ctx.onChangeMany && ctx.onChangeMany({ color: c });
    sw.appendChild(b);
  }
  colorRow.appendChild(sw);
  rows.appendChild(colorRow);

  const alignRow = el('div', 'planner-props-section');
  alignRow.innerHTML = tt('ui.plannerProps.arrangePos');
  const grid = el('div', 'planner-align-grid');
  const ALIGNS = [['left', tt('ui.plannerProps.left')], ['hcenter', tt('ui.plannerProps.centerHoriz')], ['right', tt('ui.plannerProps.right')],
                  ['top', tt('ui.plannerProps.top2')], ['vcenter', tt('ui.plannerProps.centerVert')], ['bottom', tt('ui.plannerProps.bottom2')],
                  ['distH', tt('ui.plannerProps.distributeHoriz')], ['distV', tt('ui.plannerProps.distributeVert')]];
  for (const [k, label] of ALIGNS) {
    const b = el('button', '', label);
    b.onclick = () => ctx.onAlign && ctx.onAlign(k);
    grid.appendChild(b);
  }
  alignRow.appendChild(grid);
  rows.appendChild(alignRow);

  const actions = el('div', 'planner-props-actions');
  const g = el('button', '', tt('ui.plannerProps.group'));
  g.onclick = () => ctx.onGroup && ctx.onGroup();
  const d = el('button', '', tt('ui.common.repeat'));
  d.onclick = () => ctx.onDuplicate && ctx.onDuplicate();
  const del = el('button', 'danger', tt('ui.plannerProps.delAll'));
  del.onclick = () => ctx.onDeleteSelected && ctx.onDeleteSelected();
  actions.append(g, d, del);
  wrap.appendChild(actions);
  container.appendChild(wrap);
}

// ───────── helper ─────────
function _head(text) {
  const h = el('div', 'planner-props-head');
  h.textContent = text;
  return h;
}

function _debouncer(ms = 180) {
  let t = null;
  return (fn) => { clearTimeout(t); t = setTimeout(fn, ms); };
}

function _color(v, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : fallback;
}

function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
