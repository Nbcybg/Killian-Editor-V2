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
export const TB_HOSTS = ['#toolbar', '.k-fmtbar'];

/**
 * เอาค่าที่ตั้งไว้ไปใช้กับแถบจริง — **ทุกที่ที่ปุ่มไปอยู่**
 * เรียกตอนเริ่มโปรแกรม · ตอนกดสวิตช์ · และท้าย `refreshToolbar()`
 */
export function applyToolbarConfig(cfg) {
  const conf = TC.normalizeToolbar(cfg ?? (state.settings && state.settings.toolbar));
  const vis = (id) => !conf.hidden[id];
  let found = false;

  for (const sel of TB_HOSTS) {
    const bar = document.querySelector(sel);
    if (!bar) continue;
    found = true;
    // ลำดับจริงของลูกในแถบ (ปุ่ม/select ที่ตั้งค่าได้ = id · เส้นคั่น = 'sep' · ที่เหลือ = null)
    const kids = [...bar.children];
    const seq = kids.map((k) => {
      if (k.classList.contains('sep')) return 'sep';
      return k.id && TC.isConfigurable(k.id) ? k.id : null;
    });
    // ลูกที่ไม่เกี่ยวข้อง (ที่จับลากของแถบลอย · ปุ่มที่โปรแกรมคุมเอง) นับเป็น "ปุ่มที่มองเห็น"
    // เพื่อไม่ให้เส้นคั่นหายผิดจังหวะ
    const show = TC.layoutToolbar(seq.map((x) => x ?? ' keep'), (x) => (x === ' keep' ? true : vis(x)));
    kids.forEach((k, i) => {
      if (seq[i] === 'sep') { k.classList.toggle('tb-hidden', !show[i]); return; }
      if (!seq[i]) return;                     // ปุ่มที่ตั้งค่าไม่ได้ — ปล่อยตามเดิม
      k.classList.toggle('tb-hidden', !vis(seq[i]));
    });
  }
  return found;
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
    const c = TC.toolbarCounts(cfgNow());
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

  for (const g of TC.TOOLBAR_GROUPS) {
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
      else if (src && src.dataset && src.dataset.icon) ic.textContent = '●';
      else ic.textContent = '●';
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
