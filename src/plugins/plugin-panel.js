// plugin-panel.js — [alpha.79] แผง "ปลั๊กอิน"
//
// ระบบปลั๊กอินมีมาตั้งแต่ .60r3 แต่ไม่เคยมีหน้าจอเลย — ผู้ใช้ไม่มีทางรู้ว่ามีอะไรติดตั้งอยู่
// ตัวไหนพัง ทำไมถึงไม่ทำงาน หรือจะเปิดกลับยังไง (ปลั๊กอินที่พังจะถูก "ปิดถาวร" อัตโนมัติ
// เพื่อไม่ให้โปรแกรมเปิดไม่ขึ้น — แต่ไม่มีที่ไหนบอกผู้ใช้เลยว่าเกิดอะไรขึ้น)
//
// แผงนี้ทำให้ระบบ "ใช้ได้จริง": เห็นรายการ · เปิด/ปิด · โหลดใหม่ · เปิดโฟลเดอร์ ·
// สร้างปลั๊กอินตัวอย่างที่ทำงานได้ทันที · และมีเอกสาร API อยู่ในตัว

import { t as tt, tf as ttf } from '../i18n.js';
import { $, el, state, setStatus, log } from '../core.js';
import * as PC from './plugin-core.js';

const S = () => (state._plugins || (state._plugins = { busy: false, showApi: false }));

export function resetPluginPanel() { state._plugins = null; }

export async function renderPluginPanel(host) {
  const h = host || $('#plugins-body');
  if (!h) return false;
  const app = await import('../app.js');
  h.replaceChildren();
  h.classList.add('k-plug');

  const info = app.pluginList();
  const list = PC.mergePluginList(info.loaded, info.failed, {
    appVersion: app.APP_VERSION,
    disabled: (n) => app.pluginDisabled(n),
  });
  const counts = PC.pluginCounts(list);

  h.append(buildBar(h, counts, app));

  const body = el('div', 'k-plug-list');
  h.append(body);

  if (!list.length) {
    const empty = el('div', 'k-plug-empty dim');
    empty.append(el('div', null, tt('ui.plug.emptyTitle')));
    empty.append(el('div', 'k-plug-empty-hint', tt('ui.plug.emptyHint')));
    body.append(empty);
  } else {
    for (const p of list) body.append(cardFor(p, h, app));
  }

  if (S().showApi) h.append(apiDoc());
  return true;
}

/** แถบเครื่องมือของแผง */
function buildBar(host, counts, app) {
  const bar = el('div', 'k-plug-bar');
  const sum = el('div', 'k-plug-sum');
  sum.textContent = ttf('ui.plug.summary', counts.total, counts.ok);
  if (counts.err) {
    const bad = el('span', 'k-plug-sum-bad');
    bad.textContent = ttf('ui.plug.summaryErr', counts.err);
    sum.append(bad);
  }
  bar.append(sum);

  const btns = el('div', 'k-plug-btns');
  btns.append(mkBtn(tt('ui.plug.reloadAll'), tt('ui.plug.reloadAllHint'), async () => {
    await app.reloadPlugins();
    await renderPluginPanel(host);
  }));
  btns.append(mkBtn(tt('ui.plug.openUserDir'), tt('ui.plug.openUserDirHint'), async () => {
    try {
      const d = await kapi.globalPluginsDir();
      if (!d) { setStatus(tt('ui.plug.errNoDir')); return; }
      await kapi.mkdir(d);
      await kapi.revealInOS(d);
    } catch (e) { setStatus(tt('ui.plug.errNoDir') + ' ' + (e.message || e)); }
  }));
  btns.append(mkBtn(tt('ui.plug.openProjectDir'), tt('ui.plug.openProjectDirHint'), async () => {
    if (!state.root) { setStatus(tt('ui.common.openProjectBefore')); return; }
    try {
      const d = await kapi.join(state.root, 'Plugins');
      await kapi.mkdir(d);
      await kapi.revealInOS(d);
    } catch (e) { setStatus(tt('ui.plug.errNoDir') + ' ' + (e.message || e)); }
  }));
  btns.append(mkBtn(tt('ui.plug.makeSample'), tt('ui.plug.makeSampleHint'),
                    () => makeSample(host, app)));
  const apiBtn = mkBtn(tt('ui.plug.apiDoc'), tt('ui.plug.apiDocHint'), async () => {
    S().showApi = !S().showApi;
    await renderPluginPanel(host);
  });
  apiBtn.classList.toggle('on', !!S().showApi);
  btns.append(apiBtn);
  bar.append(btns);
  return bar;
}

function mkBtn(label, title, onClick) {
  const b = el('button', 'k-plug-btn', label);
  if (title) b.title = title;
  b.onclick = onClick;
  return b;
}

/** การ์ดของปลั๊กอินหนึ่งตัว */
function cardFor(p, host, app) {
  const card = el('div', 'k-plug-card k-plug-' + p.status);
  card.dataset.plugin = p.name;

  const head = el('div', 'k-plug-head');
  head.append(el('span', 'k-plug-name', p.name));
  if (p.version) head.append(el('span', 'k-plug-ver dim', 'v' + p.version));
  const badge = el('span', 'k-plug-badge', statusLabel(p.status));
  head.append(badge);
  head.append(el('span', 'k-plug-origin dim',
    p.origin === PC.ORIGIN_PROJECT ? tt('ui.common.project') : tt('ui.plug.originUser')));
  if (p.shadowed) {
    const sh = el('span', 'k-plug-shadow dim', tt('ui.plug.shadowed'));
    sh.title = tt('ui.plug.shadowedHint');
    head.append(sh);
  }
  card.append(head);

  if (p.description) card.append(el('div', 'k-plug-desc', p.description));
  const meta = [];
  if (p.author) meta.push(tt('ui.plug.author') + ': ' + p.author);
  if (p.minAppVersion) meta.push(tt('ui.plug.minVer') + ': ' + p.minAppVersion);
  if (meta.length) card.append(el('div', 'k-plug-meta dim', meta.join(' · ')));

  if (p.status === PC.ST_ERR && p.error) {
    const err = el('div', 'k-plug-err');
    err.textContent = tt('ui.plug.errLoad') + ' ' + p.error;
    card.append(err);
    card.append(el('div', 'k-plug-meta dim', tt('ui.plug.errAutoOff')));
  }
  if (p.status === PC.ST_OLD) {
    card.append(el('div', 'k-plug-err', ttf('ui.plug.needNewer', p.minAppVersion, app.APP_VERSION)));
  }

  // คำสั่ง/แผงที่ปลั๊กอินตัวนี้ลงทะเบียนไว้ — พิสูจน์ให้เห็นว่ามันทำงานอยู่จริง
  const info = app.pluginList();
  const cmds = (info.commands || []).filter((c) => c.plugin === p.name);
  if (cmds.length) {
    const box = el('div', 'k-plug-cmds');
    box.append(el('span', 'dim', tt('ui.plug.commands') + ' '));
    for (const c of cmds) {
      const b = el('button', 'k-plug-cmd', c.label);
      b.onclick = async () => {
        try { await c.fn(); }
        catch (e) { log('error', tt('ui.plug.errRun') + ' ' + p.name, e); setStatus(tt('ui.plug.errRun')); }
      };
      box.append(b);
    }
    card.append(box);
  }

  const acts = el('div', 'k-plug-acts');
  const off = p.status === PC.ST_OFF || p.status === PC.ST_ERR;
  acts.append(mkBtn(off ? tt('ui.plug.enable') : tt('ui.plug.disable'), '', async () => {
    app.setPluginDisabled(p.name, !off);
    await app.reloadPlugins();
    await renderPluginPanel(host);
    setStatus(off ? ttf('ui.plug.enabled', p.name) : ttf('ui.plug.disabled', p.name));
  }));
  acts.append(mkBtn(tt('ui.plug.openFolder'), '', async () => {
    try {
      const base = p.origin === PC.ORIGIN_PROJECT
        ? await kapi.join(state.root, 'Plugins')
        : await kapi.globalPluginsDir();
      await kapi.revealInOS(await kapi.join(base, p.folder || p.name));
    } catch (e) { setStatus(tt('ui.plug.errNoDir') + ' ' + (e.message || e)); }
  }));
  card.append(acts);
  return card;
}

function statusLabel(st) {
  if (st === PC.ST_OK) return tt('ui.plug.stOk');
  if (st === PC.ST_OFF) return tt('ui.plug.stOff');
  if (st === PC.ST_OLD) return tt('ui.plug.stOld');
  return tt('ui.plug.stErr');
}

/** เอกสาร API ในตัว — ไม่ต้องไปเปิดคู่มือที่อื่น */
function apiDoc() {
  const box = el('div', 'k-plug-api');
  box.append(el('div', 'k-plug-api-head', tt('ui.plug.apiHead')));
  box.append(el('div', 'k-plug-api-hint dim', tt('ui.plug.apiIntro')));
  for (const d of PC.PLUGIN_API_DOC) {
    const row = el('div', 'k-plug-api-row');
    row.append(el('code', 'k-plug-api-sig', d.sig));
    row.append(el('span', 'k-plug-api-desc dim', tt(d.key)));
    box.append(row);
  }
  return box;
}

/** สร้างปลั๊กอินตัวอย่างในโฟลเดอร์ของผู้ใช้ แล้วโหลดทันที */
export async function makeSample(host, appMod) {
  const app = appMod || await import('../app.js');
  const { ask } = await import('../ui.js');
  // ask() รับ options object เป็นตัวที่สอง (ไม่ใช่ค่าตั้งต้นดิบ ๆ)
  const name = await ask(tt('ui.plug.sampleAsk'), { value: tt('ui.plug.sampleDefault') });
  if (!name) return false;
  const folder = PC.safePluginFolder(name);
  try {
    const base = await kapi.globalPluginsDir();
    if (!base) { setStatus(tt('ui.plug.errNoDir')); return false; }
    const dir = await kapi.join(base, folder);
    if (await kapi.exists(dir)) { setStatus(ttf('ui.plug.errExists', folder)); return false; }
    await kapi.mkdir(dir);
    const files = PC.samplePluginFiles(name, app.APP_VERSION);
    for (const f of Object.keys(files)) await kapi.writeFile(await kapi.join(dir, f), files[f]);
    await app.reloadPlugins();
    if (host) await renderPluginPanel(host);
    setStatus(ttf('ui.plug.sampleMade', name));
    return true;
  } catch (e) {
    log('error', tt('ui.plug.errMakeSample'), e);
    setStatus(tt('ui.plug.errMakeSample') + ' ' + (e.message || e));
    return false;
  }
}
