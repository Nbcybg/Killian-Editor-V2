// pdf-ui.js — UI ของชุด PDF: หน้าปก (90) · หัวกระดาษ (91) · ส่งออก PDF ในโปรแกรม (69/87/88/89)
//
// แยกจาก app.js ตามกฎ AGENTS.md ("feature ใหม่ที่เป็นไฟล์ของตัวเอง")
// เอนจินอยู่ที่ sp-title-pages.js / sp-headers.js / pdf-generator.js (บริสุทธิ์ทั้งสามตัว)
//
// **ที่เก็บข้อมูล**: project.khn.json → `titlePages` (หน้าปก) และ `settings.spHeaders` (หัวกระดาษ)
// เป็นค่า "ระดับโปรเจกต์" เหมือนขนาดกระดาษ/รูปแบบบท — ไม่ใช่รายเล่มแบบ roster.json
import { T } from './i18n.js';
import { el, state, setStatus, log, textWidth } from './core.js';
import { num } from './num.js';
import { confirmBox } from './ui.js';
import { TitlePageEditor, normalizeTitlePages, defaultTitlePages,
         titlePageInnerHtml } from './sp-title-pages.js';
import { HEADER_DEFAULTS, HEADER_VARS, mergeHeaders, newHeaderString,
         headerStringsFor, headerLineCount } from './sp-headers.js';
import { generatePdf, PDF_FONT_FILES, OMITTABLE_ELEMENTS, mergePdfOptions } from './pdf-generator.js';
import { SP_ELEMS } from './fountain.js';
import { spFormat, scriptMeta, safeName, saveProjectMeta, checkBeforeExport,
         currentScriptSource, currentStartPage } from './app.js';
import { pagesOf, pageStartPositions } from './sp-view.js';

// ───────── ที่เก็บข้อมูล ─────────
/** หน้าปกของโปรเจกต์นี้ (ยังไม่เคยตั้ง = อาร์เรย์ว่าง) */
export function projectTitlePages() {
  return normalizeTitlePages((state.meta || {}).titlePages);
}
export async function saveTitlePages(pages) {
  if (!state.meta) return false;
  state.meta.titlePages = normalizeTitlePages(pages);
  await saveProjectMeta();
  return true;
}
/** หัวกระดาษของโปรเจกต์นี้ */
export function projectHeaders() {
  return mergeHeaders((state.settings || {}).spHeaders);
}
export async function saveHeaders(hdr) {
  if (!state.settings) return false;
  state.settings.spHeaders = mergeHeaders(hdr);
  await saveProjectMeta();
  return true;
}

/** ข้อมูลผลงานในรูปที่ defaultTitlePages/หัวกระดาษต้องการ */
export function pdfMeta(title) {
  const m = scriptMeta(title);
  const s = state.meta || {};
  return { ...m, draft: String(s.revisions || s.draft || '').trim(),
           date: new Date().toISOString().slice(0, 10) };
}

// ───────── ฟอนต์ที่ฝังลง PDF ─────────
// pdf-lib ไม่มีลูกโซ่ฟอนต์สำรองแบบ CSS → ต้องส่ง "สองวงศ์" ไปให้ตัววาดสลับเอง
//   main  = ฟอนต์ที่มีอักษรไทย · latin = CourierPrime สำหรับเครื่องหมายสากล (· © — … “ ”)
// อ่านครั้งเดียวแล้วแคชไว้ — ไฟล์รวมกันราว 500KB และผู้ใช้กดส่งออกซ้ำ ๆ
//
// **แคชต้องล้างได้**: ผู้ใช้เปลี่ยนไฟล์ฟอนต์ระหว่างเปิดโปรแกรม (เช่นวางไฟล์ใหม่ทับ
// renderer/assets/fonts/) แล้วต้องรีสตาร์ตถึงจะเห็นผล → จำ mtime ของทุกไฟล์ที่อ่านไว้
// แล้วเทียบใหม่ทุกครั้ง (kapi.mtime เร็วกว่าการอ่านไบต์ ~500KB มาก)
const FONT_CACHE = { set: null, stamp: '' };
/** ล้างแคชฟอนต์ PDF ด้วยมือ (เมนู/คอนโซลนักพัฒนา) */
export function clearPdfFontCache() { FONT_CACHE.set = null; FONT_CACHE.stamp = ''; }

async function fontStamp(dir, files) {
  const parts = [];
  for (const f of files) {
    try {
      const p = await kapi.join(dir, f);
      parts.push(f + ':' + (await kapi.mtime(p) || 0));
    } catch { parts.push(f + ':?'); }
  }
  return parts.join('|');
}

export async function pdfFontBytes() {
  const out = { regular: null, latin: null, file: '' };
  let dir = '';
  const L = PDF_FONT_FILES.latin;
  const all = [...PDF_FONT_FILES.main, L.regular, L.bold, L.italic, L.boldItalic].filter(Boolean);
  try {
    dir = await kapi.join(await kapi.appDir(), 'renderer', 'assets', 'fonts');
    const stamp = await fontStamp(dir, all);
    if (FONT_CACHE.set && FONT_CACHE.stamp === stamp) return FONT_CACHE.set;
    FONT_CACHE.stamp = stamp;
    const read = async (f) => {
      const p = await kapi.join(dir, f);
      return (await kapi.exists(p)) ? new Uint8Array(await kapi.readBytes(p)) : null;
    };
    for (const f of PDF_FONT_FILES.main) {
      const b = await read(f);
      if (b) { out.regular = b; out.file = f; break; }
    }
    const lr = await read(L.regular);
    if (lr) {
      out.latin = { regular: lr, bold: await read(L.bold),
                    italic: await read(L.italic), boldItalic: await read(L.boldItalic) };
    }
  } catch (e) {
    log('warn', T`อ่านไฟล์ฟอนต์สำหรับ PDF ไม่สำเร็จ`, e);
    if (FONT_CACHE.set) return FONT_CACHE.set;             // อ่านไม่ได้รอบนี้ — ใช้ของเดิมต่อ
  }
  FONT_CACHE.set = out;
  return out;
}

// ───────── ตัวช่วย DOM เล็ก ๆ ─────────
const row = (label, node, hint) => {
  const r = el('div', 'k-row');
  const l = el('label', null, label);
  if (hint) l.append(el('span', 'k-hint', hint));
  r.append(l, node);
  return r;
};
const numInput = (v, { min, max, step = 0.05, cls = 'k-narrow' } = {}) => {
  const i = el('input', 'k-dlg-input ' + cls);
  i.type = 'number';
  if (min !== undefined) i.min = String(min);
  if (max !== undefined) i.max = String(max);
  i.step = String(step);
  i.value = String(v);
  return i;
};
const checkbox = (on) => { const c = el('input'); c.type = 'checkbox'; c.checked = !!on; return c; };
const select = (opts, val) => {
  const s = el('select', 'k-dlg-select');
  for (const [v, label] of opts) { const o = el('option', null, label); o.value = v; s.append(o); }
  s.value = val;
  return s;
};
const ALIGN_OPTS = [['left', T`ชิดซ้าย`], ['center', T`กึ่งกลาง`], ['right', T`ชิดขวา`]];

/** ปิดกล่องใบล่าสุดอย่างเดียว (บทเรียน 16) */
function overlay(cls) {
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog ' + (cls || ''));
  ov.append(box);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  return { ov, box };
}

// ═════════════════════ [90] กล่องหน้าปก ═════════════════════
/**
 * ตัวแก้ไขหน้าปก 3 คอลัมน์: รายการหน้า | พรีวิวหน้ากระดาษ | คุณสมบัติของสตริงที่เลือก
 * คลิกพรีวิวเพื่อเลือกสตริง · ลากไม่ได้ (ตั้งค่า x/y เป็นตัวเลขนิ้วให้แม่นกว่า)
 */
export async function openTitlePageDialog() {
  if (!state.root) { setStatus(T`เปิดโปรเจกต์ก่อน`); return null; }
  const fmt = spFormat();
  const ed = new TitlePageEditor(projectTitlePages());
  if (!ed.count) ed.pages = defaultTitlePages(pdfMeta(), fmt);
  let pageIdx = 0, strIdx = -1;

  const { ov, box } = overlay('k-tp-dlg');
  box.append(el('div', 'k-dlg-title', T`หน้าปก (Title Pages)`));
  box.append(el('div', 'k-hint',
    T`หน้าปกจะถูกวางไว้ก่อนหน้าแรกของบท และไม่นับรวมกับเลขหน้า · ` +
    T`ระยะ x/y เป็น "นิ้ววัดจากขอบกระดาษ" เหมือนแท็บหน้ากระดาษ`));

  const body = el('div', 'k-tp-body');
  const colPages = el('div', 'k-tp-pages');
  const colPrev = el('div', 'k-tp-preview');
  const colProps = el('div', 'k-tp-props');
  body.append(colPages, colPrev, colProps);
  box.append(body);

  let render = () => {};

  // ---- คอลัมน์ซ้าย: รายการหน้า ----
  const renderPages = () => {
    colPages.innerHTML = '';
    colPages.append(el('div', 'cmp-sub', T`หน้า`));
    ed.pages.forEach((p, i) => {
      const r = el('div', 'k-tp-page-row' + (i === pageIdx ? ' on' : ''));
      r.append(el('span', 'k-tp-page-no', T`หน้า ` + (i + 1)));
      r.append(el('span', 'dim', p.strings.length + T` ชิ้น`));
      r.onclick = () => { pageIdx = i; strIdx = -1; render(); };
      colPages.append(r);
    });
    const btns = el('div', 'k-tp-page-btns');
    const bAdd = el('button', 'cmp-mini', T`➕ เพิ่มหน้า`);
    bAdd.onclick = () => { pageIdx = ed.addPage(); strIdx = -1; render(); };
    const bUp = el('button', 'cmp-mini', '▲'); bUp.title = T`เลื่อนหน้าขึ้น`;
    bUp.onclick = () => { const t = ed.movePage(pageIdx, pageIdx - 1); if (t >= 0) { pageIdx = t; render(); } };
    const bDn = el('button', 'cmp-mini', '▼'); bDn.title = T`เลื่อนหน้าลง`;
    bDn.onclick = () => { const t = ed.movePage(pageIdx, pageIdx + 1); if (t >= 0) { pageIdx = t; render(); } };
    const bDup = el('button', 'cmp-mini', T`⧉ ทำสำเนา`); bDup.title = T`ทำสำเนาหน้านี้ไว้ถัดไป`;
    bDup.onclick = () => { const t = ed.duplicatePage(pageIdx); if (t >= 0) { pageIdx = t; strIdx = -1; render(); } };
    const bDel = el('button', 'cmp-mini', T`🗑 ลบหน้า`);
    bDel.onclick = async () => {
      if (!(await confirmBox(T`ลบหน้าปกหน้าที่ ` + (pageIdx + 1) + '?'))) return;
      ed.deletePage(pageIdx);
      pageIdx = Math.max(0, Math.min(pageIdx, ed.count - 1)); strIdx = -1; render();
    };
    btns.append(bAdd, bDup, bUp, bDn, bDel);
    colPages.append(btns);
    const bStd = el('button', 'k-key-btn', T`🎬 ใส่หน้าปกมาตรฐาน`);
    bStd.title = T`สร้างจากข้อมูลผลงาน (ชื่อเรื่อง/ผู้เขียน/ติดต่อ/ลิขสิทธิ์)`;
    bStd.onclick = () => { ed.pages = defaultTitlePages(pdfMeta(), fmt); pageIdx = 0; strIdx = -1; render(); };
    colPages.append(bStd);
  };

  // ---- คอลัมน์กลาง: พรีวิว ----
  const renderPreview = () => {
    colPrev.innerHTML = '';
    const page = ed.page(pageIdx);
    if (!page) { colPrev.append(el('div', 'dim', T`ไม่มีหน้าปก`)); return; }
    // ย่อกระดาษให้พอดีคอลัมน์ด้วย CSS zoom (พิกัดคลิกยังตรง — ต่างจาก transform:scale)
    const paper = el('div', 'k-tp-paper');
    paper.style.width = fmt.paper.width + 'in';
    paper.style.height = fmt.paper.height + 'in';
    paper.style.zoom = String(+(3.4 / fmt.paper.width).toFixed(3));
    // กรอบระยะขอบให้เห็นว่าข้อความอยู่ในหรือนอกพื้นที่พิมพ์
    const guide = el('div', 'k-tp-guide');
    guide.style.left = fmt.margins.left + 'in';
    guide.style.top = fmt.margins.top + 'in';
    guide.style.width = textWidth(fmt.paper, fmt.margins) + 'in';
    guide.style.height = (+fmt.paper.height - fmt.margins.top - fmt.margins.bottom) + 'in';
    paper.append(guide);
    paper.insertAdjacentHTML('beforeend', titlePageInnerHtml(page, fmt));
    // ทำให้แต่ละชิ้นคลิกเลือกได้ (ชิ้นที่ข้อความว่างไม่ถูกวาด → ไล่ index เอง)
    const drawn = page.strings.map((s, i) => i).filter((i) => String(page.strings[i].text).trim() !== '');
    paper.querySelectorAll('.sp-tp-str').forEach((node, k) => {
      const i = drawn[k];
      if (i === strIdx) node.classList.add('on');
      node.onclick = () => { strIdx = i; render(); };
    });
    colPrev.append(paper);
    colPrev.append(el('div', 'dim', T`คลิกข้อความในกระดาษเพื่อแก้ · กรอบเส้นประ = พื้นที่พิมพ์`));
  };

  // ---- คอลัมน์ขวา: คุณสมบัติสตริง ----
  const renderProps = () => {
    colProps.innerHTML = '';
    colProps.append(el('div', 'cmp-sub', T`ข้อความในหน้านี้`));
    const page = ed.page(pageIdx);
    if (!page) return;
    const list = el('div', 'k-tp-str-list');
    page.strings.forEach((s, i) => {
      const r = el('div', 'k-tp-str-row' + (i === strIdx ? ' on' : ''));
      r.append(el('span', null, String(s.text || T`(ว่าง)`).split('\n')[0].slice(0, 24) || T`(ว่าง)`));
      r.onclick = () => { strIdx = i; render(); };
      list.append(r);
    });
    colProps.append(list);

    const add = el('button', 'cmp-mini', T`➕ เพิ่มข้อความ`);
    add.onclick = () => { strIdx = ed.addString(pageIdx, { text: T`ข้อความใหม่` }); render(); };
    colProps.append(add);

    const s = page.strings[strIdx];
    if (!s) { colProps.append(el('div', 'dim', T`เลือกข้อความเพื่อแก้คุณสมบัติ`)); return; }

    const set = (patch) => { ed.updateString(pageIdx, strIdx, patch); renderPreview(); renderPages(); };
    const ta = el('textarea', 'k-dlg-input'); ta.rows = 3; ta.value = s.text;
    ta.oninput = () => set({ text: ta.value });
    colProps.append(row(T`ข้อความ`, ta));

    const gx = numInput(s.x, { min: -2, max: 40 });
    gx.onchange = () => set({ x: gx.value });
    const gy = numInput(s.y, { min: -2, max: 40 });
    gy.onchange = () => set({ y: gy.value });
    const pos = el('span'); pos.append(gx, document.createTextNode(' × '), gy);
    colProps.append(row(T`ตำแหน่ง x × y (นิ้ว)`, pos, T`วัดจากขอบกระดาษซ้าย/บน`));

    const gw = numInput(s.width, { min: 0, max: 40 });
    gw.onchange = () => set({ width: gw.value });
    colProps.append(row(T`ความกว้างกล่อง (นิ้ว)`, gw, T`0 = เท่าพื้นที่พิมพ์ที่เหลือ`));

    const gs = numInput(s.size, { min: 4, max: 96, step: 0.5 });
    gs.onchange = () => set({ size: gs.value });
    colProps.append(row(T`ขนาด (pt)`, gs));

    const gf = el('input', 'k-dlg-input'); gf.value = s.font;
    gf.placeholder = T`ว่าง = ฟอนต์ของบท`;
    gf.onchange = () => set({ font: gf.value });
    colProps.append(row(T`ฟอนต์`, gf, T`PDF ในโปรแกรมใช้ฟอนต์ที่ฝังมาเสมอ — ช่องนี้มีผลกับพรีวิว/พิมพ์`));

    const ga = select(ALIGN_OPTS, s.align);
    ga.onchange = () => set({ align: ga.value });
    colProps.append(row(T`จัดหน้า`, ga));

    for (const [k, label] of [['bold', T`ตัวหนา`], ['italic', T`ตัวเอียง`], ['underline', T`ขีดเส้นใต้`]]) {
      const c = checkbox(s[k]);
      c.onchange = () => set({ [k]: c.checked });
      colProps.append(row(label, c));
    }

    const del = el('button', 'cmp-mini', T`🗑 ลบข้อความนี้`);
    del.onclick = () => { ed.deleteString(pageIdx, strIdx); strIdx = -1; render(); };
    colProps.append(del);
  };

  render = () => { renderPages(); renderPreview(); renderProps(); };
  render();

  const btns = el('div', 'k-dlg-btns');
  const bClose = el('button', 'k-cancel', T`ยกเลิก`);
  bClose.onclick = () => ov.remove();
  const bSave = el('button', 'k-ok', T`บันทึก`);
  bSave.onclick = async () => {
    await saveTitlePages(ed.pages);
    setStatus(T`บันทึกหน้าปกแล้ว — ` + ed.count + T` หน้า`);
    log('info', T`บันทึกหน้าปก`, { pages: ed.count });
    ov.remove();
  };
  btns.append(bClose, bSave);
  box.append(btns);
  document.body.append(ov);
  return { ov, editor: ed, render, select: (p, s) => { pageIdx = p; strIdx = s; render(); } };
}

// ═════════════════════ [91] กล่องหัวกระดาษ ═════════════════════
export async function openHeaderDialog() {
  if (!state.root) { setStatus(T`เปิดโปรเจกต์ก่อน`); return null; }
  const hdr = projectHeaders();
  const { ov, box } = overlay('k-hdr-dlg');
  box.append(el('div', 'k-dlg-title', T`หัวกระดาษทุกหน้า (Page Headers)`));
  box.append(el('div', 'k-hint',
    T`หัวกระดาษพิมพ์ซ้ำทุกหน้าที่ขอบบน และ "กินบรรทัด" ของเนื้อหน้าจริง ` +
    T`(เปิดแล้วจำนวนหน้าอาจเพิ่ม) · ใช้ได้กับตัวสร้าง PDF ในโปรแกรม`));

  const on = checkbox(hdr.enabled);
  box.append(row(T`เปิดใช้หัวกระดาษ`, on));
  const first = checkbox(hdr.firstPage);
  box.append(row(T`ใส่หัวบนหน้าแรกด้วย`, first, T`ธรรมเนียมบท: หน้าแรกไม่ใส่`));
  const gap = numInput(hdr.emptyLinesAfter, { min: 0, max: 10, step: 1 });
  box.append(row(T`เว้นบรรทัดใต้หัวกระดาษ`, gap));

  box.append(el('div', 'cmp-sub', T`ข้อความ (ทุกชิ้นอยู่บรรทัดเดียวกัน — ต่างกันที่การจัดหน้า)`));
  const list = el('div', 'k-hdr-list');
  box.append(list);

  const info = el('div', 'dim k-hdr-info');
  const varHint = el('div', 'k-hint',
    T`ตัวแปร: ` + HEADER_VARS.map((v) => '${' + v.key + '} = ' + v.label).join(' · ') +
    T` (พิมพ์ชื่อไทยได้ เช่น \${หน้า})`);

  const rows = hdr.strings.slice();
  const refresh = () => {
    list.innerHTML = '';
    rows.forEach((s, i) => {
      const r = el('div', 'k-hdr-row');
      const tx = el('input', 'k-dlg-input k-hdr-text'); tx.value = s.text;
      tx.placeholder = T`\${TITLE} หรือ \${PAGE}`;
      tx.oninput = () => { s.text = tx.value; preview(); };
      const al = select(ALIGN_OPTS, s.align);
      al.onchange = () => { s.align = al.value; preview(); };
      const ox = numInput(s.xOffset, { min: -5, max: 5 });
      ox.title = T`ขยับจากตำแหน่งปกติ (นิ้ว · บวก = ไปทางขวา)`;
      ox.onchange = () => { s.xOffset = parseFloat(ox.value) || 0; };
      const marks = el('span', 'k-hdr-marks');
      for (const [k, label] of [['bold', T`ห`], ['italic', T`อ`], ['underline', T`ข`], ['caps', T`ใ`]]) {
        const c = checkbox(s[k]); c.title = { bold: T`ตัวหนา`, italic: T`ตัวเอียง`,
          underline: T`ขีดเส้นใต้`, caps: T`ตัวพิมพ์ใหญ่` }[k];
        c.onchange = () => { s[k] = c.checked; preview(); };
        const w = el('label', 'k-hdr-mark'); w.append(c, el('span', null, label));
        marks.append(w);
      }
      const del = el('button', 'cmp-mini', '✕'); del.title = T`ลบชิ้นนี้`;
      del.onclick = () => { rows.splice(i, 1); refresh(); };
      r.append(tx, al, ox, marks, del);
      list.append(r);
    });
    const add = el('button', 'cmp-mini', T`➕ เพิ่มข้อความ`);
    add.onclick = () => { rows.push(newHeaderString({ text: '${PAGE}' })); refresh(); };
    list.append(add);
    preview();
  };
  const cur = () => ({ enabled: on.checked, firstPage: first.checked,
                       emptyLinesAfter: parseInt(gap.value, 10) || 0, strings: rows });
  const preview = () => {
    const h = mergeHeaders(cur());
    const shown = headerStringsFor(2, h, { PAGE: 2, PAGES: 120, TITLE: state.title || T`ชื่อเรื่อง`,
      AUTHOR: (state.meta || {}).author || T`ผู้เขียน`, DRAFT: T`ร่างที่สอง`,
      DATE: new Date().toISOString().slice(0, 10), SCENE: T`INT. ห้องนอน - กลางคืน` });
    info.textContent = shown.length
      ? T`ตัวอย่างหน้า 2 → ` + shown.map((r) => `[${r.align}] ${r.text}`).join('   ') +
        T`   · กินไป ${headerLineCount(h)} บรรทัด/หน้า`
      : T`หน้านี้ไม่มีหัวกระดาษ`;
  };
  on.onchange = preview; first.onchange = preview; gap.onchange = preview;
  refresh();
  box.append(varHint, info);

  const btns = el('div', 'k-dlg-btns');
  const bReset = el('button', null, T`↺ ค่าเริ่มต้น`);
  bReset.onclick = () => {
    rows.length = 0;
    for (const s of HEADER_DEFAULTS.strings) rows.push(newHeaderString(s));
    on.checked = HEADER_DEFAULTS.enabled; first.checked = HEADER_DEFAULTS.firstPage;
    gap.value = String(HEADER_DEFAULTS.emptyLinesAfter);
    refresh();
  };
  const bClose = el('button', 'k-cancel', T`ยกเลิก`);
  bClose.onclick = () => ov.remove();
  const bSave = el('button', 'k-ok', T`บันทึก`);
  bSave.onclick = async () => {
    await saveHeaders(cur());
    setStatus(on.checked ? T`เปิดหัวกระดาษแล้ว` : T`ปิดหัวกระดาษแล้ว`);
    ov.remove();
  };
  btns.append(bReset, bClose, bSave);
  box.append(btns);
  document.body.append(ov);
  return { ov, rows, preview, current: cur };
}

// ═════════════════════ [69][87][88][89] กล่องส่งออก PDF ═════════════════════
/** หน้าที่เคอร์เซอร์อยู่ในบทที่เปิดอยู่ (1-based) — ใช้ตั้ง OpenAction ของข้อ 89 */
export function currentScriptPage(tab, blocks, fmt) {
  const t = tab || state.active;
  if (!t || !t.sp) return 1;
  try {
    const pos = t.sp.view.state.selection.from;
    const starts = pageStartPositions(pagesOf(blocks, fmt || spFormat()))
      .filter((p) => Number.isFinite(p));
    let n = 1;
    starts.forEach((p, i) => { if (p <= pos) n = i + 1; });
    return n;
  } catch { return 1; }
}

/** ตัวเลือกที่จำไว้ใน project.khn.json → meta.pdfExport */
export function savedPdfOptions() {
  return mergePdfOptions((state.meta || {}).pdfExport);
}

export async function pdfExportDialog() {
  const src = await currentScriptSource();
  if (!src) return null;
  const fmt = spFormat();
  const saved = savedPdfOptions();
  const titles = projectTitlePages();
  const hdr = projectHeaders();
  const here = currentScriptPage(state.active, src.blocks, fmt);

  const { ov, box } = overlay('k-pdf-dlg');
  box.append(el('div', 'k-dlg-title', T`ส่งออก PDF (ตัวสร้างในโปรแกรม)`));
  box.append(el('div', 'k-hint',
    T`บท “${src.title}” · ${pagesOf(src.blocks, fmt).count} หน้า — ` +
    T`เส้นทางนี้เขียน PDF เองด้วย pdf-lib จึงทำสารบัญ/เปิดที่หน้าเดิม/ฝังฟอนต์ไทยได้ ` +
    T`(เมนู "ส่งออกเป็น PDF…" เดิมยังใช้ Chromium อยู่ตามปกติ)`));

  const cToc = checkbox(saved.toc);
  box.append(row(T`[87] สารบัญ (bookmark ต่อหัวฉาก)`, cToc, T`กระโดดตามฉากได้ในโปรแกรมอ่าน PDF`));
  const cOpen = checkbox(saved.openPage > 0);
  const nOpen = numInput(here, { min: 1, max: 9999, step: 1 });
  const openWrap = el('span'); openWrap.append(cOpen, document.createTextNode(T` หน้า `), nOpen);
  box.append(row(T`[89] เปิดไฟล์แล้วไปที่หน้า`, openWrap, T`ค่าเริ่มต้น = หน้าที่เคอร์เซอร์อยู่`));

  const cTitle = checkbox(saved.titlePages !== false && titles.length > 0);
  cTitle.disabled = !titles.length;
  box.append(row(T`[90] แนบหน้าปก`, cTitle,
    titles.length ? titles.length + T` หน้า` : T`ยังไม่ได้ตั้งหน้าปก — เมนู บท → หน้าปก`));

  const cHdr = checkbox(saved.headers !== false && hdr.enabled);
  cHdr.disabled = !hdr.enabled;
  box.append(row(T`[91] หัวกระดาษทุกหน้า`, cHdr,
    hdr.enabled ? T`กินไป ` + headerLineCount(hdr) + T` บรรทัด/หน้า` : T`ยังปิดอยู่ — เมนู บท → หัวกระดาษ`));

  box.append(el('div', 'cmp-sub', T`[88] ไม่พิมพ์ element เหล่านี้`));
  const omitWrap = el('div', 'k-pdf-omit');
  const omitBoxes = {};
  for (const k of OMITTABLE_ELEMENTS) {
    const c = checkbox(saved.omit.includes(k));
    omitBoxes[k] = c;
    const w = el('label', 'k-pdf-omit-item');
    w.append(c, el('span', null, (SP_ELEMS[k] && SP_ELEMS[k].th) || k));
    omitWrap.append(w);
  }
  box.append(omitWrap);
  const cRect = checkbox(saved.drawRectAroundNotes);
  box.append(row(T`วาดกรอบรอบโน้ตที่ยังพิมพ์อยู่`, cRect));

  const cNums = checkbox(saved.pageNumbers !== false);
  box.append(row(T`เลขหน้า / เลขฉาก ตามรูปแบบบท`, cNums,
    fmt.pageNumbers.show || fmt.sceneNumbers.show ? '' : T`ทั้งสองยังปิดอยู่ในแท็บหน้ากระดาษ`));
  const wm = el('input', 'k-dlg-input'); wm.value = String(saved.watermark || '');
  wm.placeholder = T`ว่าง = ไม่ใส่ลายน้ำ`;
  box.append(row(T`ลายน้ำ`, wm, T`ต้องการลายน้ำรายคนหลายไฟล์ ให้ใช้ "ส่งออก PDF ลายน้ำรายคน"`));

  const prog = el('div', 'dim k-pdf-prog');
  box.append(prog);

  const collect = () => ({
    toc: cToc.checked,
    openPage: cOpen.checked ? (parseInt(nOpen.value, 10) || 1) : 0,
    titlePages: cTitle.checked, headers: cHdr.checked,
    pageNumbers: cNums.checked, sceneNumbers: cNums.checked,
    omit: OMITTABLE_ELEMENTS.filter((k) => omitBoxes[k].checked),
    drawRectAroundNotes: cRect.checked,
    watermark: wm.value.trim(),
    startPage: currentStartPage(state.active),
    fontPt: num((state.settings || {}).spFontPt, 12),   // กฎ 20 — ห้าม `parseFloat(x) || 12`
  });

  const btns = el('div', 'k-dlg-btns');
  const bClose = el('button', 'k-cancel', T`ปิด`);
  bClose.onclick = () => ov.remove();
  const bGo = el('button', 'k-ok', T`สร้าง PDF…`);
  bGo.onclick = async () => {
    if (!(await checkBeforeExport())) return;
    const opts = collect();
    bGo.disabled = true;
    prog.textContent = T`กำลังสร้าง…`;
    try {
      const dest = await kapi.savePdfDialog(safeName(src.title) + '.pdf');
      if (!dest) { bGo.disabled = false; prog.textContent = ''; return; }
      const r = await buildScriptPdf({ blocks: src.blocks, title: src.title, fmt, opts,
                                       titlePages: titles, headers: hdr });
      await kapi.writeBytes(dest, Array.from(r.bytes));
      if (state.meta) { state.meta.pdfExport = opts; await saveProjectMeta(); }
      prog.textContent = T`เสร็จแล้ว — ${r.pageCount} หน้า · สารบัญ ${r.bookmarks.length} รายการ`;
      setStatus(T`ส่งออก PDF: ` + dest);
      log('info', T`ส่งออก PDF (pdf-lib)`, { dest, pages: r.pageCount, toc: r.bookmarks.length });
    } catch (e) {
      prog.textContent = T`ผิดพลาด: ` + (e && e.message ? e.message : e);
      log('error', T`สร้าง PDF ไม่สำเร็จ`, e);
    }
    bGo.disabled = false;
  };
  btns.append(bClose, bGo);
  box.append(btns);
  document.body.append(ov);
  return { ov, collect, run: () => bGo.onclick() };
}

/**
 * สร้าง PDF ของบท — จุดเดียวที่ทุกทางเรียก (กล่องส่งออก · เวิร์กโฟลว์ ext=pdf · เทส)
 * @returns ผลจาก generatePdf (มี bytes / pageCount / bookmarks)
 */
export async function buildScriptPdf({ blocks, title, fmt, opts, titlePages, headers }) {
  const f = fmt || spFormat();
  const fonts = await pdfFontBytes();
  return generatePdf({
    blocks: blocks || [], fmt: f,
    titlePages: titlePages === undefined ? projectTitlePages() : titlePages,
    headers: headers === undefined ? projectHeaders() : headers,
    meta: pdfMeta(title), fonts: { regular: fonts.regular, latin: fonts.latin },
    opts: { ...savedPdfOptions(), ...(opts || {}) },
  });
}

/**
 * เวิร์กโฟลว์ส่งออกที่ปลายทางเป็น .pdf — แปลงข้อความที่ประกอบเสร็จเป็นบทแล้วเขียน PDF
 * (ทางนี้เริ่มจาก "ข้อความที่ประกอบทั้งฉบับร่าง" จึงต้อง parseScript — ต่างจากทางแท็บที่ใช้ doc จริง)
 */
export async function writeCompiledPdf(dest, compiled, title) {
  const { parseScript } = await import('./fountain.js');
  const r = await buildScriptPdf({
    blocks: parseScript(String(compiled && compiled.text || '')),
    title: title || state.title, opts: { openPage: 0 },
  });
  await kapi.writeBytes(dest, Array.from(r.bytes));
  return r;
}

