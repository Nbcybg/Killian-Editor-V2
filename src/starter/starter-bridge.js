// starter-bridge.js — ส่งของจาก Story Starter ไปยังระบบอื่นของโปรแกรม (เฟส 5)
//
// ที่มา: 4W ของ starter มีข้อมูลที่ระบบอื่นอยากได้อยู่แล้ว แต่เดิมมันจอดอยู่ในไฟล์ starter เฉย ๆ
//   `when`  → เหตุการณ์บนเส้นเวลา (timeline.json)
//   `where` → หมุดบนแผนที่ (maps.json)
// และ "ตอน" ที่แปลงเป็นฉากแล้วก็ควรมี `storyDate` ให้เส้นเวลาเห็น
//
// **สะพานนี้เป็นทางเดียว และไม่ทำเอง** — ผู้ใช้ต้องกดสั่ง
// เพราะ starter เป็นของ "ก่อนเขียน" ส่วนเส้นเวลา/แผนที่เป็นของ "ระหว่างเขียน"
// ถ้ายิงเข้าอัตโนมัติทุกครั้งที่แก้ 4W ผู้ใช้จะเจอขยะเต็มเส้นเวลาโดยไม่ได้ขอ
//
// กันซ้ำด้วย `srcKey` ที่ประทับไว้กับของที่สร้าง — กดสองครั้งได้ของชิ้นเดิม ไม่ใช่สองชิ้น

import { el, state, setStatus, log } from '../core.js';
import { t, tf } from '../i18n.js';
import { loadTimeline, saveTimeline, loadMaps, saveMaps } from '../app.js';
import { newEvent } from '../timeline.js';
import { newMap, newPin } from '../maps.js';
import { filledW } from './starter-steps-def.js';

/** ป้ายกำกับว่า "ของชิ้นนี้มาจาก starter ตัวไหน" — เก็บในไฟล์ ไม่ใช่ข้อความ UI จึงไม่แปล */
export function srcKey(slug, what) { return 'starter:' + slug + ':' + what; }

/** ชื่อแผนที่ที่สะพานนี้ใช้ลงหมุด — เป็นข้อมูลบนดิสก์ ไม่แปลตามภาษา */
export const BRIDGE_MAP = 'Story Starter';

// ───────────────────────── เส้นเวลา ─────────────────────────

/**
 * `when` ของ 4W → เหตุการณ์บนเส้นเวลา
 * ใส่ `refs` ว่างไว้ (ยังไม่มีฉาก) — ผู้ใช้ผูกฉากทีหลังได้เองในแผงเส้นเวลา
 */
export async function pushWhen(s) {
  const w = filledW(s).find((x) => x.key === 'when');
  if (!w) return { added: 0, updated: 0 };
  const data = await loadTimeline();
  const key = srcKey(s.slug, 'when');
  const hit = (data.events || []).find((e) => e.src === key);
  const title = s.name || s.slug;
  if (hit) {
    hit.title = title; hit.when = w.value; hit.desc = s.intro || '';
    await saveTimeline(data);
    return { added: 0, updated: 1 };
  }
  const ev = newEvent(w.value);
  ev.title = title;
  ev.desc = s.intro || '';
  ev.track = BRIDGE_MAP;
  ev.tags = [...(s.tags || [])].slice(0, 6);
  ev.src = key;                       // ประทับที่มา — กดซ้ำแล้วอัปเดตตัวเดิม
  data.events = [...(data.events || []), ev];
  await saveTimeline(data);
  return { added: 1, updated: 0 };
}

/** ตอนที่แปลงเป็นฉากแล้ว → เหตุการณ์ย่อยบนเส้นเวลา (เรียงตามลำดับตอน) */
export async function pushScenarios(s, rows) {
  const list = (rows || []).filter((r) => String(r.title || '').trim());
  if (!list.length) return { added: 0, updated: 0 };
  const data = await loadTimeline();
  data.events = data.events || [];
  let added = 0, updated = 0;
  list.forEach((sc, i) => {
    const key = srcKey(s.slug, 'sc:' + sc.id);
    const hit = data.events.find((e) => e.src === key);
    const desc = (sc.recap || sc.synopsis || '').replace(/\s+/g, ' ').slice(0, 300);
    if (hit) { hit.title = sc.title; hit.desc = desc; updated++; return; }
    const ev = newEvent('');
    ev.title = sc.title;
    ev.desc = desc;
    ev.track = s.name || s.slug;
    ev.order = i + 1;
    ev.src = key;
    data.events.push(ev);
    added++;
  });
  await saveTimeline(data);
  return { added, updated };
}

// ───────────────────────── แผนที่ ─────────────────────────

/**
 * `where` ของ 4W → หมุดบนแผนที่
 * ถ้ายังไม่มีแผนที่ของ Story Starter ก็สร้างให้ (แผนที่ไม่มีรูปยังใช้ได้ — เป็นผืนเปล่า)
 * หมุดวางกลางผืนแล้วเยื้องทีละนิดตามจำนวนที่มีอยู่ ไม่ให้ทับกันสนิท
 */
export async function pushWhere(s) {
  const w = filledW(s).find((x) => x.key === 'where');
  if (!w) return { added: 0, updated: 0 };
  const data = await loadMaps();
  data.maps = data.maps || [];
  let map = data.maps.find((m) => m.name === BRIDGE_MAP);
  if (!map) { map = newMap(BRIDGE_MAP, ''); data.maps.push(map); }
  map.pins = map.pins || [];

  const key = srcKey(s.slug, 'where');
  const hit = map.pins.find((p) => p.src === key);
  const label = s.name || s.slug;
  if (hit) {
    hit.label = label; hit.note = w.value;
    await saveMaps(data);
    return { added: 0, updated: 1 };
  }
  const n = map.pins.length;
  const pin = newPin(45 + ((n * 7) % 30), 40 + ((n * 11) % 35), 'note');
  pin.label = label;
  pin.note = w.value;
  pin.src = key;
  map.pins.push(pin);
  await saveMaps(data);
  return { added: 1, updated: 0 };
}

// ───────────────────────── ทางเข้าเดียว ─────────────────────────

/**
 * ส่งทุกอย่างที่ส่งได้ แล้วรายงานว่าทำอะไรไปบ้าง
 * แต่ละชิ้นล้มเองได้โดยไม่ล้มทั้งชุด (เส้นเวลาพัง ไม่ควรทำให้แผนที่ไม่ได้ของ)
 */
export async function pushAll(s, rows, { timeline = true, maps = true, scenarios = true } = {}) {
  const sum = { when: null, where: null, scenarios: null, errors: [] };
  if (timeline) {
    try { sum.when = await pushWhen(s); }
    catch (e) { log('error', 'starter bridge when', e); sum.errors.push('timeline'); }
  }
  if (scenarios) {
    try { sum.scenarios = await pushScenarios(s, rows); }
    catch (e) { log('error', 'starter bridge scenarios', e); sum.errors.push('scenarios'); }
  }
  if (maps) {
    try { sum.where = await pushWhere(s); }
    catch (e) { log('error', 'starter bridge where', e); sum.errors.push('maps'); }
  }
  return sum;
}

/** มีอะไรให้ส่งไหม — ไม่มีก็ไม่ต้องโชว์ปุ่ม */
export function canPush(s, rows) {
  const w = filledW(s);
  return w.some((x) => x.key === 'when' || x.key === 'where')
      || (rows || []).some((r) => String(r.title || '').trim());
}

/** กล่องเลือกว่าจะส่งอะไรบ้าง */
export function bridgeDialog(s, rows) {
  return new Promise((resolve) => {
    const w = filledW(s);
    const hasWhen = w.some((x) => x.key === 'when');
    const hasWhere = w.some((x) => x.key === 'where');
    const nSc = (rows || []).filter((r) => String(r.title || '').trim()).length;

    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog st-bridge');
    box.append(el('div', 'k-dlg-title', t('ui.starter.brTitle')));
    box.append(el('div', 'st-hint', t('ui.starter.brHint')));
    const done = (v) => { ov.remove(); resolve(v); };

    const opts = { timeline: hasWhen, maps: hasWhere, scenarios: nSc > 0 };
    const row = (key, label, enabled) => {
      const line = el('label', 'st-br-row');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = enabled; cb.disabled = !enabled;
      cb.onchange = () => { opts[key] = cb.checked; };
      line.append(cb, el('span', null, label));
      if (!enabled) line.append(el('span', 'st-dim', ' — ' + t('ui.starter.brNothing')));
      box.append(line);
    };
    row('timeline', tf('ui.starter.brWhen', BRIDGE_MAP), hasWhen);
    row('scenarios', tf('ui.starter.brScenarios', nSc), nSc > 0);
    row('maps', tf('ui.starter.brWhere', BRIDGE_MAP), hasWhere);

    const foot = el('div', 'k-dlg-foot');
    const cancel = el('button', null, t('ui.common.cancel'));
    cancel.onclick = () => done(null);
    const go = el('button', 'k-ok', t('ui.starter.brGo'));
    go.disabled = !(hasWhen || hasWhere || nSc);
    go.onclick = async () => {
      go.disabled = true;
      const sum = await pushAll(s, rows, opts);
      const n = (a) => (a ? a.added + a.updated : 0);
      setStatus(tf('ui.starter.brDone', n(sum.when) + n(sum.scenarios), n(sum.where)));
      done(sum);
    };
    foot.append(cancel, go);
    box.append(foot);
    ov.append(box);
    document.body.append(ov);
  });
}
