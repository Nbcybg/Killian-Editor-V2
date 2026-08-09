// planner-props.js — แผงคุณสมบัติ Planner v4
// บั๊ก 3  : การ์ดไม่มีคุณสมบัติ + ผูกไฟล์จาก Explorer ไม่ได้ → มีครบทุกฟิลด์ + ปุ่ม "เลือกจากโปรเจกต์"
// บั๊ก 10 : เส้นเชื่อมแก้ไม่ได้ ลบไม่ได้ → มีฟิลด์ครบ + ปุ่มลบ + สลับทิศ
// บั๊ก 11 : เลือกหัวลูกศรไม่ได้ → มีทั้งหัวต้นทางและปลายทาง
import { el } from '../core.js';
import {
  STATUSES, EDGE_STYLES, EDGE_ROUTINGS, ARROW_HEADS, NODE_TYPES, SHAPES, PORT_POSITIONS,
} from './planner-data.js';

const TYPE_LABELS = {
  scene: '📄 ฉาก', chapter: '📁 บท', entity: '👤 Wiki', note: '📝 โน้ต', sticky: '📌 โพสต์อิต',
  text: '🅃 ข้อความ', shape: '⬛ รูปทรง', frame: '🖼 เฟรม', comment: '💬 คอมเมนต์',
};
const SHAPE_LABELS = {
  rect: 'สี่เหลี่ยม', round: 'มุมมน', ellipse: 'วงรี', diamond: 'ข้าวหลามตัด',
  triangle: 'สามเหลี่ยม', star: 'ดาว', arrow: 'ลูกศร', cylinder: 'ทรงกระบอก',
};
const ROUTING_LABELS = { straight: '╱ ตรง', orthogonal: '⌐ หักมุมฉาก', curved: '⌒ โค้ง' };
const ARROW_LABELS = {
  none: '— ไม่มี', arrow: '➤ ลูกศร', triangle: '▶ สามเหลี่ยมทึบ',
  circle: '● วงกลม', diamond: '◆ ข้าวหลามตัด', bar: '│ ขีด',
};
const PORT_LABELS = { auto: 'อัตโนมัติ', top: 'บน', right: 'ขวา', bottom: 'ล่าง', left: 'ซ้าย' };

export function renderPlannerProps(container, ctx) {
  if (!container) return;
  const { mode, data } = ctx || {};
  container.innerHTML = '';
  if (mode === 'node' && data) _renderNodeProps(container, data, ctx);
  else if (mode === 'edge' && data) _renderEdgeProps(container, data, ctx);
  else if (mode === 'many' && data) _renderManyProps(container, data, ctx);
  else container.innerHTML = '<div class="planner-props-empty">คลิกการ์ดหรือเส้นเชื่อมเพื่อดูคุณสมบัติ<br><br>' +
      '<span style="opacity:.7">เคล็ดลับ: ลากจากจุดสีส้มรอบการ์ดเพื่อเชื่อมเส้น · ดับเบิลคลิกเพื่อแก้ข้อความ</span></div>';
}

// ═════════════════ การ์ด / วัตถุ ═════════════════
function _renderNodeProps(container, n, ctx) {
  const wrap = el('div', 'planner-props-wrap');
  wrap.appendChild(_head('✏️ ' + (TYPE_LABELS[n.type] || 'วัตถุ')));

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

  add(isText ? 'ข้อความ' : 'ชื่อ', `<input class="planner-prop-input" id="plp-title" value="${_esc(n.title)}">`);
  add('ประเภท', `<select class="planner-prop-input" id="plp-type">
      ${NODE_TYPES.map((t) => `<option value="${t}"${n.type === t ? ' selected' : ''}>${TYPE_LABELS[t] || t}</option>`).join('')}
    </select>`);
  if (isShape) {
    add('รูปทรง', `<select class="planner-prop-input" id="plp-shape">
        ${SHAPES.map((s) => `<option value="${s}"${n.shape === s ? ' selected' : ''}>${SHAPE_LABELS[s] || s}</option>`).join('')}
      </select>`);
  }
  if (isCard) {
    add('สถานะ', `<select class="planner-prop-input" id="plp-status">
        ${STATUSES.map((s) => `<option value="${s}"${n.status === s ? ' selected' : ''}>${s || '— ไม่ระบุ —'}</option>`).join('')}
      </select>`);
  }
  add(isNote ? 'เนื้อความ' : 'สรุปย่อ',
    `<textarea class="planner-prop-input" id="plp-synopsis" rows="3" placeholder="${isNote ? 'พิมพ์ข้อความ…' : 'เกิดอะไรขึ้นในฉากนี้'}">${_esc(n.synopsis)}</textarea>`);

  // ── สี + ตัวอักษร ──
  add('สี', `<div class="planner-prop-2col">
      <input class="planner-prop-input" id="plp-color" type="color" value="${_color(n.color, '#3f3e3a')}" title="สีพื้น">
      <input class="planner-prop-input" id="plp-textcolor" type="color" value="${_color(n.textColor, '#faf9f5')}" title="สีตัวอักษร">
    </div>`);
  const swatch = el('div', 'planner-swatches');
  for (const c of ['#3f3e3a', '#5f7a9f', '#7a6f9f', '#5f8a6f', '#d97757', '#f2c14e', '#c1666b', '#4a6fa5', '#e8e3d3', '#26241f']) {
    const b = el('button', 'planner-swatch');
    b.style.background = c; b.title = c;
    b.onclick = () => { const i = rows.querySelector('#plp-color'); if (i) i.value = c; ctx.onChangeNode && ctx.onChangeNode({ color: c }); };
    swatch.appendChild(b);
  }
  rows.appendChild(swatch);

  add(`ขนาดตัวอักษร (${Math.round(n.fontSize || 12)})`,
    `<input class="planner-prop-input" id="plp-fs" type="range" min="8" max="48" step="0.5" value="${n.fontSize || 12}">`);

  // ── ตำแหน่ง / ขนาด (บั๊ก 8 ฝั่งวัตถุ) ──
  add('ตำแหน่ง X / Y', `<div class="planner-prop-2col">
      <input class="planner-prop-input" id="plp-x" type="number" value="${Math.round(n.x)}">
      <input class="planner-prop-input" id="plp-y" type="number" value="${Math.round(n.y)}">
    </div>`);
  add('กว้าง / สูง', `<div class="planner-prop-2col">
      <input class="planner-prop-input" id="plp-w" type="number" min="16" value="${Math.round(n.width)}">
      <input class="planner-prop-input" id="plp-h" type="number" min="16" value="${Math.round(n.height)}">
    </div>`);

  // ── ผูกไฟล์จาก Explorer (บั๊ก 3) ──
  const fileRow = add('ไฟล์ที่ผูกไว้',
    `<input class="planner-prop-input" id="plp-file" value="${_esc(n.file || '')}" placeholder="ยังไม่ได้ผูกไฟล์">
     <div class="planner-props-actions" style="margin-top:5px">
       <button id="plp-pick">📁 เลือกจากโปรเจกต์</button>
       <button id="plp-unlink" title="เอาลิงก์ออก">✕</button>
     </div>`);
  add('แท็ก', `<input class="planner-prop-input" id="plp-tags" value="${_esc((n.tags || []).join(', '))}" placeholder="คั่นด้วย ,">`);
  add('', `<label class="planner-check"><input type="checkbox" id="plp-lock"${n.locked ? ' checked' : ''}> 🔒 ล็อกไม่ให้ย้าย/แก้</label>`);

  const actions = el('div', 'planner-props-actions');
  actions.innerHTML = `
    <button id="plp-link" title="ลากจากจุดสีส้มรอบการ์ดก็ได้">🔗 เชื่อมเส้น</button>
    <button id="plp-center">🎯 เลื่อนไปหา</button>
    <button id="plp-reveal">📂 ในเอกสาร</button>
  `;
  wrap.appendChild(actions);
  const actions2 = el('div', 'planner-props-actions');
  const dupBtn = el('button', '', '⧉ ทำซ้ำ');
  dupBtn.onclick = () => ctx.onDuplicateNode && ctx.onDuplicateNode(n.id);
  const delBtn = el('button', 'danger', '🗑 ลบวัตถุนี้');
  delBtn.onclick = () => ctx.onDeleteNode && ctx.onDeleteNode(n.id);
  actions2.append(dupBtn, delBtn);
  wrap.appendChild(actions2);

  // ── เส้นที่ต่อกับการ์ดนี้ (บั๊ก 10 : เข้าถึงเส้นได้โดยไม่ต้องคลิกโดน) ──
  const conns = (ctx.connections || []);
  if (conns.length) {
    wrap.appendChild(_head('🔗 เส้นที่ต่ออยู่ (' + conns.length + ')'));
    const list = el('div', 'planner-conn-list');
    for (const c of conns) {
      const row = el('div', 'planner-conn-row');
      const name = el('span', 'planner-conn-name', `${c.dir === 'out' ? '→' : '←'} ${c.otherTitle}${c.label ? ' · ' + c.label : ''}`);
      name.onclick = () => ctx.onSelectEdgeId && ctx.onSelectEdgeId(c.id);
      const del = el('button', 'planner-conn-del', '✕');
      del.title = 'ลบเส้นนี้';
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
    if (lbl) lbl.textContent = `ขนาดตัวอักษร (${Math.round(v)})`;
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
    if (picked.title && (!n.title || n.title === 'ใหม่' || n.title === 'ไม่ระบุชื่อ')) props.title = picked.title;
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
  wrap.appendChild(_head('🔗 เส้นเชื่อม'));
  const rows = el('div', 'planner-props-body');
  wrap.appendChild(rows);
  const add = (label, html) => {
    const row = el('div', 'planner-props-section');
    row.innerHTML = (label ? `<label>${label}</label>` : '') + html;
    rows.appendChild(row);
    return row;
  };

  if (ctx.endpoints) {
    add('เชื่อมจาก → ถึง',
      `<div class="planner-edge-ends">${_esc(ctx.endpoints.from)} <b>→</b> ${_esc(ctx.endpoints.to)}</div>`);
  }
  add('ป้ายกำกับ', `<input class="planner-prop-input" id="plpe-label" value="${_esc(e.label)}" placeholder="เช่น ต่อเนื่อง / ย้อนอดีต">`);
  add('สี', `<input class="planner-prop-input" id="plpe-color" type="color" value="${_color(e.color, '#d97757')}">`);
  add(`ความหนา (${e.width || 2})`,
    `<input class="planner-prop-input" id="plpe-width" type="range" min="1" max="8" step="1" value="${e.width || 2}">`);

  add('เส้นทาง', `<select class="planner-prop-input" id="plpe-routing">
      ${EDGE_ROUTINGS.map((r) => `<option value="${r}"${(e.routing || 'straight') === r ? ' selected' : ''}>${ROUTING_LABELS[r]}</option>`).join('')}
    </select>`);

  // สไตล์เส้น (ปุ่มกด)
  const styleRow = el('div', 'planner-props-section');
  styleRow.innerHTML = '<label>ลักษณะเส้น</label>';
  const styleBtns = el('div', 'planner-props-edge-style');
  const STYLE_TH = { solid: 'ทึบ', dashed: 'ประ', dotted: 'จุด' };
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
  add('หัวลูกศร (ต้นทาง / ปลายทาง)', `<div class="planner-prop-2col">
      <select class="planner-prop-input" id="plpe-as">
        ${ARROW_HEADS.map((a) => `<option value="${a}"${(e.arrowStart || 'none') === a ? ' selected' : ''}>${ARROW_LABELS[a]}</option>`).join('')}
      </select>
      <select class="planner-prop-input" id="plpe-ae">
        ${ARROW_HEADS.map((a) => `<option value="${a}"${(e.arrowEnd || 'arrow') === a ? ' selected' : ''}>${ARROW_LABELS[a]}</option>`).join('')}
      </select>
    </div>`);

  add('จุดต่อ (ต้นทาง / ปลายทาง)', `<div class="planner-prop-2col">
      <select class="planner-prop-input" id="plpe-fp">
        ${PORT_POSITIONS.map((p) => `<option value="${p}"${e.from.port === p ? ' selected' : ''}>${PORT_LABELS[p]}</option>`).join('')}
      </select>
      <select class="planner-prop-input" id="plpe-tp">
        ${PORT_POSITIONS.map((p) => `<option value="${p}"${e.to.port === p ? ' selected' : ''}>${PORT_LABELS[p]}</option>`).join('')}
      </select>
    </div>`);

  const actions = el('div', 'planner-props-actions');
  const flip = el('button', '', '⇄ สลับทิศ');
  flip.onclick = () => ctx.onFlipEdge && ctx.onFlipEdge(e.id);
  const delBtn = el('button', 'danger', '🗑 ลบเส้นนี้');
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
    if (lbl) lbl.textContent = `ความหนา (${v})`;
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
  wrap.appendChild(_head(`⬚ เลือกไว้ ${ids.length} ชิ้น`));
  const rows = el('div', 'planner-props-body');
  wrap.appendChild(rows);

  const colorRow = el('div', 'planner-props-section');
  colorRow.innerHTML = '<label>เปลี่ยนสีทั้งหมด</label>';
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
  alignRow.innerHTML = '<label>จัดตำแหน่ง</label>';
  const grid = el('div', 'planner-align-grid');
  const ALIGNS = [['left', '⇤ ซ้าย'], ['hcenter', '⇹ กลางแนวนอน'], ['right', '⇥ ขวา'],
                  ['top', '⤒ บน'], ['vcenter', '⇳ กลางแนวตั้ง'], ['bottom', '⤓ ล่าง'],
                  ['distH', '⇿ กระจายแนวนอน'], ['distV', '↕ กระจายแนวตั้ง']];
  for (const [k, label] of ALIGNS) {
    const b = el('button', '', label);
    b.onclick = () => ctx.onAlign && ctx.onAlign(k);
    grid.appendChild(b);
  }
  alignRow.appendChild(grid);
  rows.appendChild(alignRow);

  const actions = el('div', 'planner-props-actions');
  const g = el('button', '', '🗂 จัดกลุ่ม');
  g.onclick = () => ctx.onGroup && ctx.onGroup();
  const d = el('button', '', '⧉ ทำซ้ำ');
  d.onclick = () => ctx.onDuplicate && ctx.onDuplicate();
  const del = el('button', 'danger', '🗑 ลบทั้งหมด');
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
