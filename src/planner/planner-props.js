// planner-props.js — แผงคุณสมบัติ Planner v4
// บั๊ก 3  : การ์ดไม่มีคุณสมบัติ + ผูกไฟล์จาก Explorer ไม่ได้ → มีครบทุกฟิลด์ + ปุ่ม "เลือกจากโปรเจกต์"
// บั๊ก 10 : เส้นเชื่อมแก้ไม่ได้ ลบไม่ได้ → มีฟิลด์ครบ + ปุ่มลบ + สลับทิศ
// บั๊ก 11 : เลือกหัวลูกศรไม่ได้ → มีทั้งหัวต้นทางและปลายทาง
import { tx, txf } from '../i18n-html.js';   // [alpha.154] ข้อความจากไฟล์ภาษาลง HTML
import { t as tt, tf as ttf, t, tf } from '../i18n.js';
import { el, dataLabel } from '../core.js';   // [alpha.159 · QoL] ป้ายสถานะตามภาษา
const escA = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
import {
  STATUSES, EDGE_STYLES, EDGE_ROUTINGS, ARROW_HEADS, NODE_TYPES, SHAPES, PORT_POSITIONS,
  IMAGE_FITS, IMG_SCALE_MIN, IMG_SCALE_MAX,
} from './planner-data.js';
import { FIT_LABELS } from './planner-ui.js';
import { propsKey, shouldDeferRender } from './planner-props-focus.js';
import { initIcons, iconLabel, icon as iconEl, gi } from '../icons.js';

const TYPE_LABELS = {
  scene: tt('ui.plannerProps.scene'), chapter: tt('ui.plannerProps.chapter'), entity: tt('ui.plannerProps.entityWiki'), note: tt('ui.plannerProps.note'), sticky: tt('ui.plannerProps.sticky'),
  text: tt('ui.plannerProps.text'), shape: tt('ui.plannerProps.shape'), frame: tt('ui.plannerProps.frame'), comment: tt('ui.plannerProps.comment'),
  image: tt('ui.plannerProps.image'), todo: tt('ui.plannerProps.todo'),
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

let _lastKey = '';
let _pending = null;
let _flushBound = false;

/** วาดคำขอที่พักไว้ (ถ้ามี) — เรียกเมื่อผู้ใช้ปล่อยมือจากแผง */
function _flushPending(container) {
  const ctx = _pending;
  _pending = null;
  if (ctx) renderPlannerProps(container, ctx);
}

export function renderPlannerProps(container, ctx) {
  if (!container) return;
  // ══ [alpha.153 ข้อ 1] ★★ ผู้ใช้กำลังพิมพ์อยู่ = ห้ามวาดแผงใหม่ ══
  //
  // ผู้ใช้: *"พิมพ์แล้วจะดีดออก เพราะโดน refresh ควรจะให้พิมพ์เสร็จก่อนถึง refresh"*
  // เก็บคำขอล่าสุดไว้ แล้ววาดตอนโฟกัสออกจากแผง (ค่าที่วาดจึงเป็นค่าล่าสุดเสมอ ไม่ใช่ค่าค้าง)
  const key = propsKey(ctx);
  if (shouldDeferRender(container, document.activeElement, key, _lastKey)) {
    _pending = ctx;
    if (!_flushBound) {
      _flushBound = true;
      container.addEventListener('focusout', () => {
        // รอเฟรมถัดไป: `focusout` ยิงก่อนโฟกัสตัวใหม่จะลง — ย้ายช่องในแผงเดียวกันไม่นับว่าปล่อยมือ
        setTimeout(() => {
          if (container.contains(document.activeElement)) return;
          _flushPending(container);
        }, 0);
      });
    }
    return;
  }
  _pending = null;
  _lastKey = key;
  const { mode, data } = ctx || {};
  container.innerHTML = '';
  if (mode === 'node' && data) _renderNodeProps(container, data, ctx);
  else if (mode === 'edge' && data) _renderEdgeProps(container, data, ctx);
  else if (mode === 'many' && data) _renderManyProps(container, data, ctx);
  else container.innerHTML = `<div class="planner-props-empty">${tx('ui.plannerProps.clickCardLineLink2')}<br><br>` +
      `<span style="opacity:.7">${tx('ui.plannerProps.dragDotColorRound2')}</span></div>`;
}

/**
 * ══ [alpha.153 ข้อ 3] ตัวแก้ "รายการสิ่งที่ต้องทำ" ══
 *
 * วาดใหม่ทั้งก้อนเฉพาะตอนโครงสร้างเปลี่ยน (เพิ่ม/ลบ/เลื่อน) — การพิมพ์แก้ข้อความไม่วาดใหม่
 * (ไม่งั้นก็เจอปัญหาเดียวกับข้อ 1 คือพิมพ์แล้วโดนดีดออก)
 */
function _buildTodoEditor(box, n, set) {
  const items = (n.items || []).map((it) => ({ text: it.text || '', done: !!it.done }));
  const commit = () => set({ items: items.map((it) => ({ text: it.text, done: it.done })) });
  const redraw = () => { _paintTodoRows(box, items, commit, redraw); };
  redraw();
}

function _paintTodoRows(box, items, commit, redraw) {
  box.replaceChildren();
  items.forEach((it, i) => {
    const row = el('div', 'planner-todo-row');

    const cb = el('input', 'planner-todo-check');
    cb.type = 'checkbox';
    cb.checked = it.done;
    cb.title = tt('ui.plannerProps.todoDone');
    cb.onchange = () => { it.done = cb.checked; row.classList.toggle('done', it.done); commit(); };

    const txt = el('input', 'planner-todo-text');
    txt.type = 'text';
    txt.value = it.text;
    txt.placeholder = tt('ui.plannerProps.todoOneItem');
    // พิมพ์แล้วบันทึกทันที แต่ **ไม่วาดรายการใหม่** — ช่องที่กำลังพิมพ์จึงไม่ถูกลบทิ้ง
    txt.oninput = () => { it.text = txt.value; commit(); };
    // Enter = ขึ้นข้อใหม่ต่อท้ายข้อนี้ (พิมพ์รายการยาว ๆ รวดเดียวจบ)
    txt.onkeydown = (e) => {
      e.stopPropagation();                     // กันคีย์ลัดของกระดานมากินตัวอักษร
      if (e.key === 'Enter') {
        e.preventDefault();
        items.splice(i + 1, 0, { text: '', done: false });
        commit(); redraw();
        const next = box.querySelectorAll('.planner-todo-text')[i + 1];
        if (next) next.focus();
      } else if (e.key === 'Backspace' && !txt.value && items.length > 1) {
        e.preventDefault();
        items.splice(i, 1);
        commit(); redraw();
        const prev = box.querySelectorAll('.planner-todo-text')[Math.max(0, i - 1)];
        if (prev) { prev.focus(); prev.setSelectionRange(prev.value.length, prev.value.length); }
      }
    };

    const up = el('button', 'planner-todo-btn');
    up.append(iconEl('arrow-up', 11));
    up.title = tt('ui.plannerProps.todoUp');
    up.disabled = i === 0;
    up.onclick = () => { items.splice(i - 1, 0, items.splice(i, 1)[0]); commit(); redraw(); };

    const dn = el('button', 'planner-todo-btn');
    dn.append(iconEl('arrow-down', 11));
    dn.title = tt('ui.plannerProps.todoDown');
    dn.disabled = i === items.length - 1;
    dn.onclick = () => { items.splice(i + 1, 0, items.splice(i, 1)[0]); commit(); redraw(); };

    const del = el('button', 'planner-todo-btn danger');
    del.append(iconEl('close', 11));
    del.title = tt('ui.plannerProps.todoDel');
    del.onclick = () => { items.splice(i, 1); commit(); redraw(); };

    if (it.done) row.classList.add('done');
    row.append(cb, txt, up, dn, del);
    box.appendChild(row);
  });

  const addBtn = el('button', 'planner-todo-add');
  addBtn.append(iconEl('plus', 12), document.createTextNode(' ' + tt('ui.plannerProps.todoAdd')));
  addBtn.onclick = () => {
    items.push({ text: '', done: false });
    commit(); redraw();
    const all = box.querySelectorAll('.planner-todo-text');
    if (all.length) all[all.length - 1].focus();
  };
  box.appendChild(addBtn);

  const done = items.filter((x) => x.done).length;
  box.appendChild(el('div', 'planner-todo-sum', ttf('ui.plannerProps.todoProgress', done, items.length)));
}

// ═════════════════ การ์ด / วัตถุ ═════════════════
function _renderNodeProps(container, n, ctx) {
  const wrap = el('div', 'planner-props-wrap');
  // [alpha.150r] ไอคอนหัวแผงมาจากทะเบียน (กฎ alpha.147) ไม่ใช่อีโมจิที่เขียนไว้ในโค้ด
  wrap.appendChild(_head(iconLabel('edit', TYPE_LABELS[n.type] || tt('ui.plannerProps.object'), 15)));

  const isText = n.type === 'text';
  const isShape = n.type === 'shape';
  const isNote = n.type === 'sticky' || n.type === 'comment';
  const isCard = ['scene', 'chapter', 'entity', 'note'].includes(n.type);
  const isImage = n.type === 'image';          // [alpha.150 ข้อ 6]
  const isTodo = n.type === 'todo';            // [alpha.150 ข้อ 9]

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
        ${STATUSES.map((s) => `<option value="${escA(s)}"${n.status === s ? ' selected' : ''}>${escA(s ? dataLabel(s) : tt('ui.common.notSpecify2'))}</option>`).join('')}
      </select>`);
  }
  add(isNote ? tt('ui.plannerProps.body') : tt('ui.plannerProps.summaryCollapse'),
    `<textarea class="planner-prop-input" id="plp-synopsis" rows="3" placeholder="${isNote ? tt('ui.plannerProps.printText') : tt('ui.plannerProps.occurScene')}">${_esc(n.synopsis)}</textarea>`);

  // ── สี + ตัวอักษร ──
  add(tt('ui.common.color'), ((a) => `<div class="planner-prop-2col">
      <input class="planner-prop-input" id="plp-color" type="color" value="${a[0]}" title="${tx('ui.planner.colorBg2')}">
      <input class="planner-prop-input" id="plp-textcolor" type="color" value="${a[1]}" title="${tx('ui.setTpl.colorChar')}">
    </div>`)([_color(n.color, '#3f3e3a'), _color(n.textColor, '#faf9f5')]));
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

  // ── [alpha.150 ข้อ 7] เส้นขอบ: สี + ความหนา (0 = ไม่มีขอบ) ──
  add(tt('ui.plannerProps.border'), `<div class="planner-prop-2col">
      <input class="planner-prop-input" id="plp-bordercolor" type="color" value="${_color(n.borderColor || n.color, '#ffffff')}">
      <input class="planner-prop-input" id="plp-borderw" type="number" min="0" max="12" step="0.5" value="${n.borderWidth == null ? 1 : n.borderWidth}">
    </div>`);
  // ── [alpha.150 ข้อ 8] พื้น: สีของตัวเอง + ความจาง (เฟรมใช้บ่อยที่สุด) ──
  add(ttf('ui.plannerProps.fillOpacity', Math.round((n.fillOpacity == null ? 1 : n.fillOpacity) * 100)),
    `<div class="planner-prop-2col">
      <input class="planner-prop-input" id="plp-fill" type="color" value="${_color(n.fill || n.color, '#faf9f5')}">
      <input class="planner-prop-input" id="plp-fillop" type="range" min="0" max="1" step="0.05" value="${n.fillOpacity == null ? 1 : n.fillOpacity}">
    </div>`);

  // ── [alpha.150 ข้อ 6] รูป ──
  // [alpha.152 ข้อ 2] การ์ดธรรมดาที่แทรกรูปไว้ก็ต้องปรับการวางรูปได้ ไม่ใช่เฉพาะการ์ดที่เป็นรูปทั้งใบ
  // (ไม่งั้นค่าที่ตั้งไว้เป็นค่าเริ่มต้นตายตัว ผู้ใช้เปลี่ยนไม่ได้เลย)
  if (isImage || n.src) {
    add(tt('ui.plannerProps.imgFile'), ((a) => `<div class="planner-prop-row"><input class="planner-prop-input" id="plp-src" value="${a[0]}"><button class="planner-prop-btn" id="plp-imgpick">${tx('ui.plannerProps.pick')}</button></div>`)([_esc(n.src || '')]));
    add(tt('ui.plannerProps.imgFit'), `<select class="planner-prop-input" id="plp-fit">
        ${IMAGE_FITS.map((f) => `<option value="${f}"${n.fit === f ? ' selected' : ''}>${FIT_LABELS[f] || f}</option>`).join('')}
      </select>`);
    add(ttf('ui.plannerProps.imgBlur', Math.round(n.blur || 0)),
      `<input class="planner-prop-input" id="plp-blur" type="range" min="0" max="30" step="1" value="${n.blur || 0}">`);
    // [alpha.150r] ย่อ/ขยายรูป — เกิน 100% แล้วรูปล้นกรอบ เลื่อนดูได้ทั้งสองแกน
    add(ttf('ui.plannerProps.imgScale', Math.round((n.scale == null ? 1 : n.scale) * 100)),
      `<input class="planner-prop-input" id="plp-scale" type="range" min="${IMG_SCALE_MIN}" max="${IMG_SCALE_MAX}" step="0.05" value="${n.scale == null ? 1 : n.scale}">`);
  }

  // ══ [alpha.153 ข้อ 3] ★★ รายการสิ่งที่ต้องทำเป็น "รายการจริง" ไม่ใช่ให้พิมพ์ทีละบรรทัด ══
  //
  // ผู้ใช้: *"todo ใช้งานยาก รายการควรเป็นในคุณสมบัติ หรือตอนแก้รายการ add เป็น list
  //          มีพร้อม checkbox ดีกว่าพิมพ์รายการ"*
  //
  // ของเดิมเป็นช่องข้อความก้อนเดียวที่ผู้ใช้ต้องรู้ไวยากรณ์ `[x] ...` เอง — ติ๊กก็ต้องพิมพ์
  // เรียงใหม่ก็ต้องตัดแปะ · ตอนนี้เป็นแถวละข้อ: ติ๊ก · แก้ข้อความ · เลื่อนขึ้น-ลง · ลบ · เพิ่มข้อ
  let todoBox = null;
  if (isTodo) {
    const row = el('div', 'planner-props-section');
    row.innerHTML = `<label>${tt('ui.plannerProps.todoItems')}</label>`;
    todoBox = el('div', 'planner-todo-edit');
    row.appendChild(todoBox);
    rows.appendChild(row);
  }

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
    ((a) => `<input class="planner-prop-input" id="plp-file" value="${a[0]}" placeholder="${tx('ui.plannerProps.cantBindFile')}">
     <div class="planner-props-actions" style="margin-top:5px">
       <button id="plp-pick">${tx('ui.plannerProps.pickProject2')}</button>
       <button id="plp-unlink" title="${tx('ui.plannerProps.linkOut')}" data-icon="close"></button>
     </div>`)([_esc(n.file || '')]));
  initIcons(fileRow);   // [alpha.147] ปุ่มเอาลิงก์ออกเป็น data-icon ในเทมเพลตแล้ว
  add(tt('ui.common.tag'), ((a) => `<input class="planner-prop-input" id="plp-tags" value="${a[0]}" placeholder="${tx('ui.plannerProps.text2')}">`)([_esc((n.tags || []).join(', '))]));
  add('', ((a) => `<label class="planner-check"><input type="checkbox" id="plp-lock"${a[0]}> ${tx('ui.plannerProps.lockNotMoveEdit2')}</label>`)([n.locked ? ' checked' : '']));

  const actions = el('div', 'planner-props-actions');
  actions.innerHTML = `
    <button id="plp-link" title="${tx('ui.plannerProps.dragDotColorRound3')}">${tx('ui.plannerProps.linkLine')}</button>
    <button id="plp-center">${tx('ui.plannerProps.scrollFind')}</button>
    <button id="plp-reveal">${tx('ui.planner.doc')}</button>
  `;
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
      const name = el('span', 'planner-conn-name', `${c.dir === 'out' ? gi('arrow-right') : gi('arrow-left')} ${c.otherTitle}${c.label ? ' · ' + c.label : ''}`);
      name.onclick = () => ctx.onSelectEdgeId && ctx.onSelectEdgeId(c.id);
      const del = el('button', 'planner-conn-del');
      del.append(iconEl('close', 12));
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

  if (todoBox) _buildTodoEditor(todoBox, n, set);

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
  // [alpha.150] ขอบ · พื้น · รูป · รายการติ๊ก
  q('plp-bordercolor').oninput = () => deb(() => set({ borderColor: q('plp-bordercolor').value }));
  q('plp-borderw').onchange = () => set({ borderWidth: parseFloat(q('plp-borderw').value) });
  q('plp-fill').oninput = () => deb(() => set({ fill: q('plp-fill').value }));
  q('plp-fillop').oninput = () => {
    const v = parseFloat(q('plp-fillop').value);
    const lbl = q('plp-fillop').closest('.planner-props-section').querySelector('label');
    if (lbl) lbl.textContent = ttf('ui.plannerProps.fillOpacity', Math.round(v * 100));
    deb(() => set({ fillOpacity: v }));
  };
  if (q('plp-fit')) q('plp-fit').onchange = () => set({ fit: q('plp-fit').value });
  if (q('plp-scale')) q('plp-scale').oninput = () => {
    const v = parseFloat(q('plp-scale').value);
    const lbl = q('plp-scale').parentElement.querySelector('label');
    if (lbl) lbl.textContent = ttf('ui.plannerProps.imgScale', Math.round(v * 100));
    // ย่อจนไม่ล้นแล้วต้องรีเซ็ตตำแหน่งเลื่อน ไม่งั้นรูปค้างอยู่นอกกรอบ
    deb(() => set({ scale: v, scrollX: 0, scrollY: 0 }));
  };
  if (q('plp-blur')) q('plp-blur').oninput = () => {
    const v = parseFloat(q('plp-blur').value);
    const lbl = q('plp-blur').parentElement.querySelector('label');
    if (lbl) lbl.textContent = ttf('ui.plannerProps.imgBlur', Math.round(v));
    deb(() => set({ blur: v }));
  };
  if (q('plp-imgpick')) q('plp-imgpick').onclick = async () => {
    if (!ctx.onPickImage) return;
    const p = await ctx.onPickImage();
    if (p && p.file) { q('plp-src').value = 'Images/' + p.file; set({ src: 'Images/' + p.file }); }
  };
  if (q('plp-src')) q('plp-src').onchange = () => set({ src: q('plp-src').value.trim() });

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
  add(tt('ui.plannerProps.badge'), ((a) => `<input class="planner-prop-input" id="plpe-label" value="${a[0]}" placeholder="${tx('ui.plannerProps.egCont')}">`)([_esc(e.label)]));
  add(tt('ui.common.color'), `<input class="planner-prop-input" id="plpe-color" type="color" value="${_color(e.color, '#d97757')}">`);
  add(ttf('ui.plannerProps.bold', e.width || 2),
    `<input class="planner-prop-input" id="plpe-width" type="range" min="1" max="8" step="1" value="${e.width || 2}">`);

  add(tt('ui.common.route'), `<select class="planner-prop-input" id="plpe-routing">
      ${EDGE_ROUTINGS.map((r) => `<option value="${r}"${(e.routing || 'straight') === r ? ' selected' : ''}>${ROUTING_LABELS[r]}</option>`).join('')}
    </select>`);

  // สไตล์เส้น (ปุ่มกด)
  const styleRow = el('div', 'planner-props-section');
  styleRow.innerHTML = `<label>${tx('ui.plannerProps.line2')}</label>`;
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
  colorRow.innerHTML = `<label>${tx('ui.plannerProps.recolorAll2')}</label>`;
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
  alignRow.innerHTML = `<label>${tx('ui.plannerProps.arrangePos2')}</label>`;
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
/** หัวข้อในแผง — รับได้ทั้งข้อความล้วนและ element (`iconLabel()` ที่ประกอบไอคอน+ข้อความมาแล้ว) */
function _head(text) {
  const h = el('div', 'planner-props-head');
  if (text && text.nodeType === 1) h.append(text);
  else h.textContent = text;
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
