// toolbar-ui.js — [alpha.79] กล่อง "ปรับแถบเครื่องมือ"
//
// หน้าตาแบบเดียวกับ Appearance / Toolbar ของเบราว์เซอร์: รายการปุ่มเรียงตามกลุ่ม
// พร้อมสวิตช์เปิด-ปิดทีละตัว · เห็นผลบนแถบ **ทันที** ที่กด (ไม่ต้องกดตกลงก่อน)
//
// ═══ ชื่อปุ่มมาจากไหน ═══
// อ่านจาก `title` ของปุ่มจริงใน DOM — ซึ่งมาจากไฟล์ภาษาอยู่แล้ว
// จึงไม่มีทางที่ชื่อในกล่องนี้กับ tooltip บนแถบจะไม่ตรงกัน (และไม่ต้องมีตารางชื่อซ้ำอีกชุด)
//
// ═══ ซ่อนยังไงไม่ให้ตีกับโค้ดเดิม ═══
// ใช้คลาส `.tb-hidden { display:none !important }` **ไม่ใช่** `style.display`
// เพราะ `refreshToolbar()` เขียน `style.display` ของบางปุ่มเองตามโหมดเอกสาร —
// ถ้าใช้ช่องเดียวกันจะแย่งกันจนปุ่มโผล่/หายมั่ว

import { t as tt, tf as ttf } from '../i18n.js';
import { $, el, state, setStatus } from '../core.js';
import * as TC from './toolbar-config.js';
import * as FB from './fab-config.js';
import { gi, icon } from '../icons.js';
import { popupMenu } from '../ui.js';

/** ปุ่มจริงบนแถบ (หรือ null ถ้าไม่มี) */
const btn = (id) => document.getElementById(id);

/** ชื่อที่จะแสดงในกล่อง — จาก title ของปุ่มจริง ตัดวงเล็บคีย์ลัดท้ายออก */
export function labelOf(id) {
  const b = btn(id);
  const raw = (b && (b.title || b.getAttribute('aria-label'))) || '';
  const clean = raw.replace(/\s*\((?:Ctrl|⌘|Alt|⌥|Shift|⇧)[^)]*\)\s*$/i, '').trim();
  return clean || id.replace(/^tb-/, '');
}

/**
 * ที่อยู่ของปุ่มบนหน้าจอ — **มีสองที่ ไม่ใช่ที่เดียว**
 *
 * `setupFloatingFormatBar()` **ย้าย** ปุ่มจัดรูปแบบ 21 ตัว (B I U S · รายการ · จัดหน้า · แทรกรูป …)
 * ออกจาก `#toolbar` ไปอยู่ในแถบลอย `.k-fmtbar` ใน `#content` แล้วลบเส้นคั่นใน `#toolbar` ทิ้งทั้งหมด
 * → โค้ดที่มองแค่ `#toolbar` จะ **ไม่เห็นปุ่มจัดรูปแบบเลย**
 *   (เจอตอนเทส [79-5]: ปิดกลุ่ม "จัดหน้า" แล้วปุ่มไม่หาย เพราะมันไม่ได้อยู่ในแถบนั้นแล้ว)
 */
/** แถบรูปแบบลอยของหน้าเขียน — คุมด้วย `settings.fmtbar` ซึ่งแยกตามโหมดเอกสาร */
// ══ [alpha.151 ข้อ 3] แถบของกระดานใช้คลาส `.k-fmtbar` ร่วมกัน (หน้าตาเหมือนกัน) ══
// ตัวเลือกเดิม `.k-fmtbar` เฉย ๆ จึงคว้าแถบผิดตัวได้ เมื่อกระดานเปิดอยู่และอยู่หน้ากว่าใน DOM
// → การตั้งค่าของหน้าเขียนไปลงที่แถบกระดานแทน · ต้องกันแถบกระดานออกให้ชัด
//
// **ต้องมีตัวเดียวในโปรแกรม** — ที่ไหนก็ตามที่เขียน `'.k-fmtbar'` ซ้ำเป็นสตริงของตัวเอง
// จะหลุดจากกฎนี้เงียบ ๆ (เจอจริง: `TB_HOSTS` เคยเขียนซ้ำ แล้วเมนูคลิกขวาบนแถบลอย
// กลายเป็นเมนูของแถบเครื่องมือหลัก เพราะเทียบ `sel === TB_FMT_HOST` ไม่ตรงอีกต่อไป)
export const TB_FMT_HOST = '.k-fmtbar:not(.planner-fmtbar)';

export const TB_HOSTS = ['#toolbar', TB_FMT_HOST];

/**
 * แถบที่ `settings.toolbar` (ก้อนรวม) คุม — **ไม่รวมแถบลอย** ตั้งแต่ alpha.111
 *
 * [alpha.162 · W2] ★ เพิ่ม `.k-side-toggles` — กลุ่ม `layout` (ปุ่มซ่อนแผงทีละฝั่ง) อยู่ใน
 * `TOOLBAR_GROUPS` มาตั้งแต่ .157 แต่ปุ่มจริงถูกย้ายไปอยู่บน **แถบชื่อหน้าต่าง** (.157r)
 * ตัวนี้เดินเฉพาะ `#toolbar` การติ๊กเปิด/ปิดในตั้งค่าจึงไม่มีผลเลย — สวิตช์ที่กดแล้วไม่เกิดอะไร
 * คือสิ่งที่ผู้ใช้แยกไม่ออกจากบั๊ก · (ซ่อนแล้วยังเปิดคืนได้จาก ตั้งค่า → แถบเครื่องมือ)
 */
export const TB_MAIN_HOSTS = ['#toolbar', '.k-side-toggles'];

/** ลำดับจริงของลูกในแถบ → `id` ที่ตั้งค่าได้ · `'sep'` · `null` (ของแถบเอง/ปุ่มที่โปรแกรมคุม) */
function barSeq(bar) {
  return [...bar.children].map((k) => {
    if (k.classList.contains('sep')) return 'sep';
    return k.id && TC.isConfigurable(k.id) ? k.id : null;
  });
}

/**
 * เอาค่าที่ตั้งไว้ไปใช้กับแถบจริง
 * เรียกตอนเริ่มโปรแกรม · ตอนกดสวิตช์ · และท้าย `refreshToolbar()`
 *
 * [alpha.111] แถบลอยแยกไปใช้ `applyFmtbarConfig()` แล้ว (ตั้งค่าแยกนิยาย/บท) —
 * ตัวนี้จึงคุมเฉพาะ `#toolbar` แต่ยังเรียก `applyFmtbarConfig()` ต่อให้ เพื่อให้จุดเรียกเดิม
 * ทั่วโปรแกรม (ท้าย refreshToolbar ฯลฯ) ได้ผลครบทั้งสองแถบเหมือนเดิมโดยไม่ต้องไล่แก้ทีละแห่ง
 */
export function applyToolbarConfig(cfg) {
  const conf = TC.normalizeToolbar(cfg ?? (state.settings && state.settings.toolbar));
  const vis = (id) => !conf.hidden[id];
  let found = false;

  for (const sel of TB_MAIN_HOSTS) {
    const bar = document.querySelector(sel);
    if (!bar) continue;
    found = true;
    const kids = [...bar.children];
    const seq = barSeq(bar);
    // ลูกที่ไม่เกี่ยวข้อง (ที่จับลากของแถบลอย · ปุ่มที่โปรแกรมคุมเอง) นับเป็น "ปุ่มที่มองเห็น"
    // เพื่อไม่ให้เส้นคั่นหายผิดจังหวะ
    const show = TC.layoutToolbar(seq.map((x) => x ?? ' keep'), (x) => (x === ' keep' ? true : vis(x)));
    kids.forEach((k, i) => {
      if (seq[i] === 'sep') { k.classList.toggle('tb-hidden', !show[i]); return; }
      if (!seq[i]) return;                     // ปุ่มที่ตั้งค่าไม่ได้ — ปล่อยตามเดิม
      k.classList.toggle('tb-hidden', !vis(seq[i]));
    });
  }
  applyFmtbarConfig();
  scheduleToolbarOverflow();                   // [alpha.161 · K3] จำนวนปุ่มที่เห็นเปลี่ยน = คิดที่ล้นใหม่
  return found;
}

// ══════════ [alpha.161 · K3] ปุ่ม "»" ท้ายแถบ: ปุ่มที่ล้นหน้าต่าง + ปุ่มที่ผู้ใช้ซ่อนไว้ ══════════
// เดิมแถบเลื่อนแนวนอนได้ แต่ไม่มีอะไรบอกว่ามีปุ่มเลยขอบขวาออกไป (หน้าต่างแคบ = ปุ่มท้ายแถบ "หายไป")
// ตอนนี้: ปุ่มที่ล้นถูกย้ายเข้าเมนู "»" (ตัดจากท้ายแถบ · ปุ่มที่โปรแกรมคุมไม่ถูกย้าย — `overflowPlan`)
// และเมนูเดียวกันรวมปุ่มที่ผู้ใช้ซ่อนไว้ในตั้งค่า (กดใช้ได้ทันทีโดยไม่ต้องไปเปิดคืนก่อน)
const OVF = { job: 0, list: [], ro: null };
function overflowButton(bar) {
  let b = bar.querySelector(':scope > #tb-overflow');
  if (!b) {
    b = el('button', 'tb tb-overflow');
    b.id = 'tb-overflow';
    b.type = 'button';
    b.append(icon('more', 18));
    b.onclick = (e) => { e.stopPropagation(); openToolbarOverflowMenu(b); };
  }
  if (bar.lastElementChild !== b) bar.appendChild(b);   // อยู่ท้ายแถบเสมอ (ตัวแทรกเส้นคั่นอาจต่อท้ายทีหลัง)
  b.title = tt('ui.toolbar.overflowTitle');
  b.dataset.tip = 'ui.toolbar.overflowTip';
  return b;
}
/** ปุ่มที่ถูกย้ายเข้าเมนู "»" ตอนนี้ (id ตามลำดับบนแถบ) */
export function toolbarOverflowIds() { return OVF.list.slice(); }
export function scheduleToolbarOverflow() {
  if (typeof requestAnimationFrame !== 'function') return;
  cancelAnimationFrame(OVF.job);
  OVF.job = requestAnimationFrame(() => { OVF.job = 0; layoutToolbarOverflow(); });
}
/** คิดใหม่ว่าปุ่มไหนล้น (เรียกซ้ำได้ · เรียกเองได้จากเทส) */
export function layoutToolbarOverflow() {
  const bar = document.querySelector('#toolbar');
  if (!bar) return [];
  const ob = overflowButton(bar);
  if (!OVF.ro && typeof ResizeObserver === 'function') {
    OVF.ro = new ResizeObserver(() => scheduleToolbarOverflow());
    OVF.ro.observe(bar);
  }
  bar.querySelectorAll(':scope > .tb-ovf').forEach((x) => x.classList.remove('tb-ovf'));
  const cs = getComputedStyle(bar);
  const gap = parseFloat(cs.columnGap || cs.gap) || 0;
  const avail = bar.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
              - ob.getBoundingClientRect().width - gap;
  const kids = [...bar.children].filter((k) => k !== ob && k.getClientRects().length > 0);
  const items = kids.map((k) => ({ id: k.id || '', w: k.getBoundingClientRect().width + gap,
                                   locked: !k.id || !TC.isConfigurable(k.id) }));
  const hide = new Set(TC.overflowPlan(items, avail));
  for (const k of kids) if (k.id && hide.has(k.id)) k.classList.add('tb-ovf');
  // เส้นคั่นที่เหลือห้อยท้าย/ติดกันหลังย้ายปุ่มออก → ซ่อนตาม
  const vis = [...bar.children].filter((k) => k !== ob && k.getClientRects().length > 0);
  for (let i = vis.length - 1; i >= 0 && vis[i].classList.contains('sep'); i--) vis[i].classList.add('tb-ovf');
  OVF.list = [...hide];
  ob.classList.toggle('has-ovf', OVF.list.length > 0);
  return OVF.list;
}
function btnLabel(b) {
  return (b.getAttribute('title') || b.getAttribute('aria-label') || b.textContent || b.id || '').split('\n')[0].trim();
}
/** รายการในเมนู "»" — ปุ่มที่ล้น · ปุ่มที่ซ่อนไว้ · ปรับแต่งแถบ */
export function toolbarOverflowItems() {
  const items = [];
  const byId = (id) => document.getElementById(id);
  const mk = (b) => ({ label: btnLabel(b), disabled: b.classList.contains('dis') || b.disabled,
                        click: () => b.click() });
  const ovf = OVF.list.map(byId).filter(Boolean);
  if (ovf.length) {
    items.push({ label: tt('ui.toolbar.overflowMore'), disabled: true });
    for (const b of ovf) items.push(mk(b));
  }
  const conf = TC.normalizeToolbar(state.settings && state.settings.toolbar);
  const hid = TC.allButtonIds().filter((id) => conf.hidden[id] && byId(id) && !OVF.list.includes(id)
    && (byId(id).closest('#toolbar')));
  if (hid.length) {
    if (items.length) items.push('-');
    items.push({ label: tt('ui.toolbar.overflowHidden'), disabled: true });
    for (const id of hid) items.push(mk(byId(id)));
  }
  if (items.length) items.push('-');
  items.push({ label: tt('ui.tbcfg.customize'), click: () => toolbarDialog() });
  return items;
}
function openToolbarOverflowMenu(btn) {
  const r = btn.getBoundingClientRect();
  popupMenu(Math.max(8, r.right - 260), r.bottom + 4, toolbarOverflowItems());
}

/**
 * [alpha.139] เส้นคั่นหมวดบนแถบเครื่องมือ — แบบเดียวกับ Firefox/Chrome
 *
 * ผู้ใช้: *"หมวดหมู่ของแถบเครื่องมือ คั่นด้วย | เหมือน firefox หรือ chrome"*
 *
 * **ทำไมต้องสร้างตอนรัน ไม่ใช่เขียนไว้ใน index.html**: `setupFloatingFormatBar()` ย้ายปุ่ม
 * จัดรูปแบบ 20 กว่าตัวออกไปแถบลอย **แล้วลบ `.sep` ใน `#toolbar` ทิ้งทั้งหมด** — เส้นคั่นที่เขียนไว้
 * ในไฟล์จึงหายเกลี้ยงทุกครั้ง (แถบเลยเป็นไอคอนพรืดยาวเส้นเดียวมาตลอด)
 * ตัวนี้จึงถูกเรียก **หลัง** การย้ายนั้น แล้วแทรกเส้นตามรอยต่อของ `TOOLBAR_GROUPS` ที่เหลืออยู่จริง
 *
 * เส้นที่แทรกมีคลาส `sep` ด้วย → `applyToolbarConfig()` เอาไปเข้าตรรกะเดิมได้ทันที
 * (ซ่อนเส้นที่กลายเป็นเส้นซ้อน/เส้นหัวท้ายเมื่อผู้ใช้ปิดทั้งกลุ่ม — `layoutToolbar()`)
 *
 * @returns {number} จำนวนเส้นที่แทรก
 */
export function applyToolbarGroupSeps() {
  const bar = document.querySelector('#toolbar');
  if (!bar) return 0;
  bar.querySelectorAll('.tb-gsep').forEach((n) => n.remove());
  let prev = '', n = 0;
  for (const kid of [...bar.children]) {
    if (!kid.id) continue;                       // เส้นคั่นแถบโปรเจกต์ / ที่จับ — ไม่ใช่ปุ่ม
    const g = TC.groupOf(kid.id);
    if (!g) { prev = ''; continue; }             // ปุ่มโปรเจกต์ (ไม่สังกัดกลุ่มไหน)
    if (prev && g !== prev) {
      const sep = document.createElement('span');
      sep.className = 'sep tb-gsep';
      bar.insertBefore(sep, kid);
      n++;
    }
    prev = g;
  }
  return n;
}

/**
 * [alpha.111] แถบรูปแบบลอย — ซ่อนตามที่ผู้ใช้ตั้งไว้ **ของโหมดปัจจุบัน**
 * และทำปุ่มที่โหมดนี้ใช้ไม่ได้เป็นสีเทา (`.tb-na`) โดยยังเห็นอยู่
 *
 * @param {object} [cfg] ก้อนตั้งค่า (ไม่ส่ง = อ่านจาก state)
 * @param {string} [mode] 'prose' | 'screenplay' (ไม่ส่ง = เดาจากแท็บที่เปิดอยู่)
 */
export function applyFmtbarConfig(cfg, mode) {
  const bar = document.querySelector(TB_FMT_HOST);
  if (!bar) return false;
  const conf = cfg ?? (state.settings && state.settings.fmtbar);
  const m = TC.fmtMode(mode ?? currentFmtMode());
  const kids = [...bar.children];
  const { show, grey } = TC.layoutFmtbar(barSeq(bar), conf, m);
  kids.forEach((k, i) => {
    const isSep = k.classList.contains('sep');
    if (isSep || (k.id && TC.isConfigurable(k.id))) k.classList.toggle('tb-hidden', !show[i]);
    // ปุ่มที่โปรแกรมคุมเอง (LOCKED_BUTTONS) ยังทำเป็นเทาได้ ถ้าโหมดนี้ใช้ไม่ได้
    k.classList.toggle('tb-na', !!grey[i]);
    // `pointer-events:none` กันเมาส์ได้ แต่ `<select>` ยังเปิดด้วยคีย์บอร์ดได้ →
    // ต้องปิดที่ตัวมันเองด้วย ไม่งั้น "เทา" กลายเป็นแค่สี ไม่ใช่สถานะจริง
    if (k.tagName === 'SELECT') k.disabled = !!grey[i];
  });
  bar.dataset.fmtMode = m;
  return true;
}

/**
 * โหมดของแท็บที่เปิดอยู่
 *
 * [alpha.151 ข้อ 1] เดิมยุบทุกอย่างที่ไม่ใช่บทเป็น 'prose' — Wiki/แดชบอร์ด/หน้าแรก
 * จึงถูกบังคับใช้ชุดปุ่มของนิยายทั้งที่คนละงานกัน · ตอนนี้ได้โหมด `all` ของตัวเอง
 * (กระดานไม่อยู่ในนี้ — มันมีแถบของตัวเองแยกต่างหาก ดู PLANNER_BAR_GROUPS)
 */
export function currentFmtMode() {
  const t = state.active;
  if (!t) return 'all';
  if (t.sp) return 'screenplay';
  if (t.editor) return 'prose';
  return 'all';
}

/**
 * สร้างรายการปุ่มพร้อมสวิตช์ลงในกล่องที่ให้มา
 * ใช้ร่วมกันสองที่: กล่องเดี่ยว (`toolbarDialog`) และแท็บ "แถบเครื่องมือ" ในหน้าตั้งค่า
 * — จึงไม่มีทางที่สองที่นั้นจะไม่ตรงกัน
 * @param {HTMLElement} host กล่องปลายทาง (จะถูกล้างก่อน)
 * @param {object} [opts] `{ compact:true }` = ไม่ต้องมีหัวเรื่อง/คำอธิบาย
 */
export function buildToolbarList(host, opts = {}) {
  if (!host) return null;
  host.replaceChildren();
  host.classList.add('k-tbcfg-host');
  if (!opts.compact) host.append(el('div', 'k-hint', tt('ui.tbcfg.hint')));

  const cfgNow = () => TC.normalizeToolbar(state.settings && state.settings.toolbar);
  const count = el('div', 'k-tbcfg-count dim');
  host.append(count);
  const list = el('div', 'k-tbcfg-list');
  host.append(list);

  const syncCount = () => {
    const c = TC.mainbarCounts(cfgNow());
    count.textContent = ttf('ui.tbcfg.count', c.on, c.total);
  };

  const save = async (next) => {
    state.settings.toolbar = next;
    applyToolbarConfig(next);
    syncCount();
    try {
      const app = await import('../app.js');
      await app.saveGlobalSetting('toolbar', next);
    } catch { /* ยังไม่เปิดโปรเจกต์ก็ใช้ได้ — ค่าอยู่ใน state แล้ว */ }
  };

  for (const g of TC.mainbarGroups()) {
    const sec = el('div', 'k-tbcfg-sec');
    const head = el('div', 'k-tbcfg-head');
    head.append(el('span', 'k-tbcfg-gname', tt(g.labelKey)));
    const onAll = el('button', 'k-tbcfg-mini', tt('ui.tbcfg.allOn'));
    onAll.onclick = () => { save(TC.setGroupVisible(cfgNow(), g.key, true)); redrawRows(); };
    const offAll = el('button', 'k-tbcfg-mini', tt('ui.tbcfg.allOff'));
    offAll.onclick = () => { save(TC.setGroupVisible(cfgNow(), g.key, false)); redrawRows(); };
    head.append(onAll, offAll);
    sec.append(head);

    for (const b of g.buttons) {
      const row = el('div', 'k-tbcfg-row');
      row.dataset.btn = b.id;
      const ic = el('span', 'k-tbcfg-icon');
      const src = btn(b.id);
      // ก๊อปไอคอนของปุ่มจริงมาโชว์ (ปุ่มที่ยังไม่มีในหน้าจอ = โชว์จุด)
      if (src && src.firstElementChild) ic.innerHTML = src.innerHTML;
      else if (src && src.dataset && src.dataset.icon) ic.textContent = gi('dot');
      else ic.textContent = gi('dot');
      const name = el('span', 'k-tbcfg-name', labelOf(b.id));
      const miss = !src ? el('span', 'k-tbcfg-miss dim', tt('ui.tbcfg.missing')) : null;
      const sw = el('input', 'k-tbcfg-sw');
      sw.type = 'checkbox';
      sw.checked = TC.isButtonVisible(cfgNow(), b.id);
      sw.onchange = () => save(TC.setButtonVisible(cfgNow(), b.id, sw.checked));
      row.append(ic, name);
      if (miss) row.append(miss);
      row.append(sw);
      sec.append(row);
    }
    list.append(sec);
  }

  function redrawRows() {
    const c = cfgNow();
    list.querySelectorAll('.k-tbcfg-row').forEach((r) => {
      const sw = r.querySelector('.k-tbcfg-sw');
      if (sw) sw.checked = TC.isButtonVisible(c, r.dataset.btn);
    });
  }

  const foot = el('div', 'k-tbcfg-foot');
  const reset = el('button', 'k-reset-btn', tt('ui.tbcfg.reset'));
  reset.onclick = () => { save(TC.resetToolbarConfig()); redrawRows(); setStatus(tt('ui.tbcfg.resetDone')); };
  foot.append(reset);
  host.append(foot);

  syncCount();
  return host;
}

/**
 * [alpha.81 ข้อ 1] รายการเมนูคลิกขวาของแถบเครื่องมือ / แถบ B I U
 *
 * คืนรูปแบบของ `popupMenu()` (`{label, click}` · `'-'` = เส้นคั่น) — app.js เป็นคนผูกเหตุการณ์
 * ตรรกะ "ปุ่มไหนซ่อนได้ / เก็บค่ายังไง" อยู่ในไฟล์นี้ที่เดียวเหมือนกล่องตั้งค่า
 *
 * @param {string} btnId ปุ่มที่เมาส์ชี้อยู่ตอนคลิกขวา ('' = ที่ว่างบนแถบ)
 */
export function toolbarContextItems(btnId) {
  const cfg = () => TC.normalizeToolbar(state.settings && state.settings.toolbar);
  const save = async (next) => {
    state.settings.toolbar = next;
    applyToolbarConfig(next);
    try {
      const app = await import('../app.js');
      await app.saveGlobalSetting('toolbar', next);
    } catch { /* ยังไม่เปิดโปรเจกต์ก็ใช้ได้ — ค่าอยู่ใน state แล้ว */ }
  };
  const items = [];
  // ปุ่มที่โปรแกรมคุมเอง (LOCKED_BUTTONS) ไม่มีรายการ "ซ่อน" — ซ่อนแล้วโหมดเอกสารพัง
  if (btnId && TC.isConfigurable(btnId)) {
    const name = labelOf(btnId);
    items.push({ label: ttf('ui.tbcfg.hideThis', name), click: async () => {
      await save(TC.setButtonVisible(cfg(), btnId, false));
      setStatus(ttf('ui.tbcfg.hidden', name));
    } });
    items.push('-');
  }
  items.push({ label: tt('ui.tbcfg.customize'), click: () => toolbarDialog() });
  items.push({ label: tt('ui.tbcfg.showAll'), click: async () => {
    await save(TC.resetToolbarConfig());
    setStatus(tt('ui.tbcfg.resetDone'));
  } });
  return items;
}

/** กล่องเดี่ยว — เปิดจากคลิกขวาที่ปุ่ม "จัดการแผง" หรือเมนู มุมมอง */
export function toolbarDialog() {
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-tbcfg');
  ov.append(box);
  document.body.append(ov);
  const close = () => ov.remove();

  box.append(el('div', 'k-dlg-title', tt('ui.tbcfg.title')));
  const inner = el('div', 'k-tbcfg-inner');
  box.append(inner);
  buildToolbarList(inner);

  const btns = el('div', 'k-dlg-btns');
  const ok = el('button', 'k-ok', tt('ui.common.close'));
  ok.onclick = close;
  btns.append(ok);
  box.append(btns);

  ov.onclick = (e) => { if (e.target === ov) close(); };
  const esc = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  };
  document.addEventListener('keydown', esc);
  return ov;
}

// ══════════════════ [alpha.111] หน้าตั้งค่า "แถบรูปแบบ" (แยกนิยาย / บทภาพยนตร์) ══════════════════
//
// หน้าตาเหมือนหน้าแถบเครื่องมือทุกอย่าง ต่างแค่มีสวิตช์โหมดอยู่ด้านบน และแถวที่โหมดนั้น
// **ใช้ไม่ได้จริง ๆ** จะขึ้นป้าย "ใช้ไม่ได้ในโหมดนี้" พร้อมสวิตช์ที่กดไม่ได้ —
// เพื่อไม่ให้ผู้ใช้เสียเวลาเปิดปุ่มที่เปิดไปก็กดไม่ได้

/** เก็บค่าแถบลอยลงระดับผู้ใช้ (ใช้ร่วมทุกผลงาน เหมือนแถบเครื่องมือ) */
async function saveFmtbar(next) {
  state.settings.fmtbar = next;
  applyFmtbarConfig(next);
  // [alpha.151 ข้อ 3] แถบของกระดานอ่านค่าชุดเดียวกัน — ต้องทาใหม่พร้อมกัน
  try {
    const pl = typeof window !== 'undefined' && window.k2ActivePlanner && window.k2ActivePlanner();
    if (pl && pl.syncFmtBar) pl.syncFmtBar();
  } catch { /* ไม่มีกระดานเปิดอยู่ = ไม่ต้องทำอะไร */ }
  try {
    const app = await import('../app.js');
    await app.saveGlobalSetting('fmtbar', next);
  } catch { /* ยังไม่เปิดโปรเจกต์ก็ใช้ได้ — ค่าอยู่ใน state แล้ว */ }
}

/**
 * สร้างรายการปุ่มของแถบลอยลงในกล่องที่ให้มา
 * @param {HTMLElement} host กล่องปลายทาง (จะถูกล้างก่อน)
 * @param {object} [opts] `{ mode }` โหมดที่เปิดค้างไว้ตอนแรก
 */
export function buildFmtbarList(host, opts = {}) {
  if (!host) return null;
  host.replaceChildren();
  host.classList.add('k-tbcfg-host');
  let mode = TC.fmtMode(opts.mode || currentFmtMode());

  host.append(el('div', 'k-hint', tt('ui.fmtcfg.hint')));

  // ── สวิตช์โหมด ──
  const tabs = el('div', 'k-fmtcfg-modes');
  const modeBtns = {};
  // [alpha.151 ข้อ 1] สี่โหมด — ชื่อมาจากไฟล์ภาษา ไม่ใช่เงื่อนไขสองทางที่เขียนไว้ในโค้ด
  const MODE_LABEL = {
    prose: 'ui.fmtcfg.modeProse', screenplay: 'ui.fmtcfg.modeScreen',
    all: 'ui.fmtcfg.modeAll', planner: 'ui.fmtcfg.modePlanner',
  };
  for (const m of TC.FMT_MODES) {
    const b = el('button', 'k-fmtcfg-mode', tt(MODE_LABEL[m] || m));
    b.dataset.mode = m;
    b.onclick = () => { mode = m; redrawAll(); };
    modeBtns[m] = b;
    tabs.append(b);
  }
  host.append(tabs);

  const count = el('div', 'k-tbcfg-count dim');
  host.append(count);
  const list = el('div', 'k-tbcfg-list');
  host.append(list);

  const cfgNow = () => TC.normalizeFmtbar(state.settings && state.settings.fmtbar,
                                          state.settings && state.settings.toolbar);
  const save = async (next) => { await saveFmtbar(next); redrawAll(); };

  function redrawAll() {
    for (const m of TC.FMT_MODES) modeBtns[m].classList.toggle('on', m === mode);
    // [alpha.151 ข้อ 3] โหมด `planner` คุมปุ่มของ **แถบกระดาน** ซึ่งเป็นคนละชุดกับของตัวแก้ไข
    const onBoard = mode === 'planner';
    const groups = onBoard ? TC.plannerBarGroups() : TC.fmtbarGroups();
    const ids = groups.flatMap((g) => g.buttons.map((b) => b.id));
    const shownN = ids.filter((id) => (onBoard ? !TC.plannerBarHidden(cfgNow(), id)
                                               : !TC.fmtbarHidden(cfgNow(), mode, id))).length;
    count.textContent = ttf('ui.tbcfg.count', shownN, ids.length);
    list.replaceChildren();
    for (const g of groups) {
      const sec = el('div', 'k-tbcfg-sec');
      const head = el('div', 'k-tbcfg-head');
      head.append(el('span', 'k-tbcfg-gname', tt(g.labelKey)));
      const setAll = (on) => {
        let next = cfgNow();
        for (const b of g.buttons) next = TC.setFmtbarVisible(next, mode, b.id, on);
        return save(next);
      };
      const onAll = el('button', 'k-tbcfg-mini', tt('ui.tbcfg.allOn'));
      onAll.onclick = () => setAll(true);
      const offAll = el('button', 'k-tbcfg-mini', tt('ui.tbcfg.allOff'));
      offAll.onclick = () => setAll(false);
      head.append(onAll, offAll);
      sec.append(head);

      for (const b of g.buttons) {
        const ok = onBoard || TC.fmtSupported(mode, b.id);
        const row = el('div', 'k-tbcfg-row' + (ok ? '' : ' k-tbcfg-na'));
        row.dataset.btn = b.id;
        const ic = el('span', 'k-tbcfg-icon');
        const src = btn(b.id);
        if (src && src.firstElementChild) ic.innerHTML = src.innerHTML;
        else ic.textContent = gi('dot');
        row.append(ic, el('span', 'k-tbcfg-name', labelOf(b.id)));
        const sw = el('input', 'k-tbcfg-sw');
        sw.type = 'checkbox';
        if (ok) {
          sw.checked = onBoard ? !TC.plannerBarHidden(cfgNow(), b.id)
                               : !TC.fmtbarHidden(cfgNow(), mode, b.id);
          sw.onchange = () => save(TC.setFmtbarVisible(cfgNow(), mode, b.id, sw.checked));
        } else {
          // ══ [alpha.151 ข้อ 6] ★ ปุ่มที่โหมดนี้ใช้ไม่ได้ = **ไม่โผล่บนแถบ** ══
          // เดิมช่องนี้ถูกปิดตาย (`disabled`) ผู้ใช้จึงทำอะไรไม่ได้เลย และปุ่มก็ยังกินที่บนแถบ
          // ตอนนี้ติ๊กได้ = "ขอเห็นไว้ก่อน" (โผล่แบบสีเทา) · ไม่ติ๊ก = หายไปจากแถบจริง ๆ
          row.append(el('span', 'k-tbcfg-miss dim', tt('ui.fmtcfg.naTag')));
          sw.checked = TC.forcedShown(cfgNow(), mode).has(b.id);
          sw.onchange = () => save(TC.setFmtbarForceShown(cfgNow(), mode, b.id, sw.checked));
        }
        row.append(sw);
        sec.append(row);
      }
      list.append(sec);
    }
  }
  redrawAll();

  const foot = el('div', 'k-tbcfg-foot');
  const reset = el('button', 'k-reset-btn', tt('ui.tbcfg.reset'));
  reset.onclick = async () => { await save(TC.resetFmtbarConfig()); setStatus(tt('ui.tbcfg.resetDone')); };
  foot.append(reset);
  host.append(foot);
  return host;
}

/**
 * [alpha.111] เมนูคลิกขวาบน "แถบรูปแบบลอย" — คนละชุดกับแถบเครื่องมือหลัก
 * เพราะซ่อนปุ่มที่นี่ = ซ่อนเฉพาะโหมดที่กำลังเขียนอยู่
 * @param {string} btnId ปุ่มที่เมาส์ชี้อยู่ ('' = ที่ว่างบนแถบ)
 */
export function fmtbarContextItems(btnId) {
  const mode = currentFmtMode();
  const cfg = () => TC.normalizeFmtbar(state.settings && state.settings.fmtbar,
                                       state.settings && state.settings.toolbar);
  const modeName = tt(mode === 'screenplay' ? 'ui.fmtcfg.modeScreen' : 'ui.fmtcfg.modeProse');
  const items = [];
  if (btnId && TC.isConfigurable(btnId) && TC.isFmtbarButton(btnId)) {
    const name = labelOf(btnId);
    items.push({ label: ttf('ui.fmtcfg.hideThis', name, modeName), click: async () => {
      await saveFmtbar(TC.setFmtbarVisible(cfg(), mode, btnId, false));
      setStatus(ttf('ui.fmtcfg.hidden', name, modeName));
    } });
    items.push('-');
  }
  items.push({ label: ttf('ui.fmtcfg.customize', modeName),
               click: () => openFmtbarSettings(mode) });
  items.push({ label: ttf('ui.fmtcfg.showAll', modeName), click: async () => {
    await saveFmtbar(TC.setFmtbarGroupVisibleAll(cfg(), mode));
    setStatus(tt('ui.tbcfg.resetDone'));
  } });
  return items;
}

/** เปิดหน้าตั้งค่าแถบรูปแบบ (อยู่ในกล่องตั้งค่าหลัก — ที่เดียวกับที่ผู้ใช้ขอ) */
export async function openFmtbarSettings(mode) {
  try {
    const d = await import('../dialogs.js');
    d.settingsDialog('fmtbar', { fmtMode: mode });
  } catch (e) { setStatus(tt('ui.fmtcfg.openFail')); }
}

// ══════════════════ [alpha.111] หน้าตั้งค่า "ปุ่มลอย (FAB)" ══════════════════

/** เก็บค่า FAB ลงระดับผู้ใช้ + วาดเมนูใหม่ทันที */
async function saveFab(next) {
  state.settings.fab = next;
  try {
    const app = await import('../app.js');
    app.renderFabMenu();
    await app.saveGlobalSetting('fab', next);
  } catch { /* ยังไม่เปิดโปรเจกต์ก็ใช้ได้ */ }
}

/**
 * รายการคำสั่งของ FAB พร้อมสวิตช์ — เลือกได้ไม่เกิน `FAB_MAX`
 * @param {HTMLElement} host กล่องปลายทาง (จะถูกล้างก่อน)
 */
export function buildFabList(host) {
  if (!host) return null;
  host.replaceChildren();
  host.classList.add('k-tbcfg-host', 'k-fabcfg-host');
  host.append(el('div', 'k-hint', ttf('ui.fab.hint', FB.FAB_MAX)));

  const cfgNow = () => FB.normalizeFab(state.settings && state.settings.fab);
  const save = async (next) => { await saveFab(next); redrawAll(); };

  // ── รูปแบบการแสดง ──
  const dispRow = el('div', 'k-fabcfg-disp');
  dispRow.append(el('span', 'k-tbcfg-gname', tt('ui.fab.display')));
  const dispBtns = {};
  for (const d of FB.FAB_DISPLAYS) {
    const b = el('button', 'k-fmtcfg-mode', tt(FB.FAB_DISPLAY_LABELS[d]));
    b.dataset.disp = d;
    b.onclick = () => save(FB.setFabDisplay(cfgNow(), d));
    dispBtns[d] = b;
    dispRow.append(b);
  }
  host.append(dispRow);

  // ── ลำดับที่เลือกไว้ ──
  const count = el('div', 'k-tbcfg-count dim');
  host.append(count);
  const chosen = el('div', 'k-fabcfg-chosen');
  host.append(chosen);
  const list = el('div', 'k-tbcfg-list');
  host.append(list);

  function redrawAll() {
    const cfg = cfgNow();
    for (const d of FB.FAB_DISPLAYS) dispBtns[d].classList.toggle('on', d === cfg.display);
    count.textContent = ttf('ui.fab.count', cfg.actions.length, FB.FAB_MAX);

    chosen.replaceChildren();
    if (!cfg.actions.length) chosen.append(el('div', 'k-hint dim', tt('ui.fab.empty')));
    cfg.actions.forEach((id, i) => {
      const a = FB.fabAction(id);
      const row = el('div', 'k-fabcfg-pick');
      row.append(el('span', 'k-fabcfg-num', String(i + 1)));
      row.append(el('span', 'k-tbcfg-name', tt(a.labelKey)));
      const up = el('button', 'k-tbcfg-mini', gi('arrow-up'));
      up.disabled = i === 0;
      up.onclick = () => save(FB.moveFabAction(cfgNow(), id, -1));
      const dn = el('button', 'k-tbcfg-mini', gi('arrow-down'));
      dn.disabled = i === cfg.actions.length - 1;
      dn.onclick = () => save(FB.moveFabAction(cfgNow(), id, 1));
      const rm = el('button', 'k-tbcfg-mini', gi('close'));
      rm.onclick = () => save(FB.toggleFabAction(cfgNow(), id, false));
      row.append(up, dn, rm);
      chosen.append(row);
    });

    // ── รายการทั้งหมดให้เลือก ──
    list.replaceChildren();
    const full = !FB.canAddFab(cfg);
    for (const g of FB.FAB_GROUPS) {
      const acts = FB.fabGroupActions(g.key);
      if (!acts.length) continue;
      const sec = el('div', 'k-tbcfg-sec');
      const head = el('div', 'k-tbcfg-head');
      head.append(el('span', 'k-tbcfg-gname', tt(g.labelKey)));
      sec.append(head);
      for (const a of acts) {
        const on = cfg.actions.includes(a.id);
        const row = el('div', 'k-tbcfg-row' + (!on && full ? ' k-tbcfg-na' : ''));
        row.dataset.fab = a.id;
        row.append(el('span', 'k-tbcfg-name', tt(a.labelKey)));
        const sw = el('input', 'k-tbcfg-sw');
        sw.type = 'checkbox';
        sw.checked = on;
        sw.disabled = !on && full;              // เต็มแล้ว = ต้องถอดตัวเก่าออกก่อน
        sw.onchange = () => save(FB.toggleFabAction(cfgNow(), a.id, sw.checked));
        row.append(sw);
        sec.append(row);
      }
      list.append(sec);
    }
  }
  redrawAll();

  const foot = el('div', 'k-tbcfg-foot');
  const reset = el('button', 'k-reset-btn', tt('ui.tbcfg.reset'));
  reset.onclick = async () => { await save(FB.resetFabConfig()); setStatus(tt('ui.tbcfg.resetDone')); };
  foot.append(reset);
  host.append(foot);
  return host;
}

/** เมนูคลิกขวาบนปุ่มลอย — ย้ายตำแหน่ง/รีเซ็ต/ตั้งค่าคำสั่ง (app.js เป็นคนผูกเหตุการณ์) */
export function fabContextItems({ onReset, onConfig, onHide } = {}) {
  return [
    { label: tt('ui.fab.ctxMoveHint'), disabled: true },
    '-',
    { label: tt('ui.fab.ctxReset'), click: () => onReset && onReset() },
    { label: tt('ui.fab.ctxConfig'), click: () => onConfig && onConfig() },
    { label: tt('ui.fab.ctxHide'), click: () => onHide && onHide() },
  ];
}
