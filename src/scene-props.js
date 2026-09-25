// scene-props.js — แผงคุณสมบัติฉาก (สถานะ/สี/ปักหมุด/ล็อก/futureNote)
import { explicitStartPage } from './book-flow.js';
import { t, tf } from './i18n.js';
import { buildTree, guid, syncOpenTabMeta, updatePageNumberHint, refreshSpView } from './app.js';
import { SCENE_COLORS, SCENE_STATUSES, dataLabel, el, setStatus, state, log } from './core.js';
import { allStatuses } from './custom-status.js';
import { statusChoices } from './status-choices.js';   // [alpha.160 · P1-11]
import * as spell from './spell.js';
// [alpha.60r2 ข้อ 13] คุณสมบัติฉากอยู่ใน frontmatter ของ .md เป็นหลัก — scenes.json เป็นดัชนี/แคช
// ทุกทางอ่าน-เขียนผ่าน readSceneMeta/writeSceneMeta ที่เดียว
import { readSceneMeta, writeSceneMeta, SCENE_HEAVY_KEYS } from './scene-meta.js';
// [alpha.60r3 ข้อ 2] ปุ่ม ✨ ให้ AI เขียนเรื่องย่อ/POV/อารมณ์/ความขัดแย้ง จากเนื้อฉาก
import { attachAiFieldButton } from './ai-synopsis.js';
import { parseMdFile } from './md.js';
import { escClose } from './ui.js';
import { gi } from './icons.js';
import { mutateJson } from './json-store.js';
import { buildActChapterRows, buildMentionsBox } from './scene-props-extra.js';

export async function sceneProps(dPath, ch, sc) {
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  const row = (d.chapters[ch.guid] || []).find((x) => x.id === sc.id);
  if (!row) return;
  // [alpha.60r2 ข้อ 13] ค่าที่โชว์ = frontmatter ของไฟล์จริงก่อน แล้วค่อยตกมาที่ดัชนี
  // → แก้ .md นอกโปรแกรมแล้วเปิดกล่องนี้ ต้องเห็นค่าที่แก้ไว้ ไม่ใช่ค่าค้างใน scenes.json
  const file = await kapi.join(dPath, 'Chapters', ch.folderName, row.fileName);
  const M = await readSceneMeta(file, row);
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog');
  box.append(el('div', 'k-dlg-title', t('ui.scene.propsScene') + row.title));
  // mk คืน <input> เหมือนเดิม แต่จำแถวไว้ให้ปุ่ม ✨ มาแปะทีหลังได้
  const rowOf = new Map();
  const mk = (label, val, tag = 'input') => {
    const r = el('div', 'wiki-row');
    r.append(el('label', null, label));
    const i = el(tag, 'wiki-input');
    i.value = val || '';
    r.append(i); box.append(r); rowOf.set(i, r); return i;
  };
  // ช่องเลือก (สถานะ/สี) — คืน <select>
  const mkSelect = (label, options, cur) => {
    const r = el('div', 'wiki-row');
    r.append(el('label', null, label));
    const s = el('select', 'wiki-input k-dlg-select');
    for (const [val, txt] of options) {
      const o = el('option', null, txt); o.value = val;
      if (val === cur) o.selected = true;
      s.append(o);
    }
    r.append(s); box.append(r); return s;
  };
  // สวิตช์ (ปักหมุด) — คืน checkbox
  const mkCheck = (label, checked) => {
    const r = el('div', 'wiki-row');
    r.append(el('label', null, label));
    const c = el('input', 'wiki-check'); c.type = 'checkbox'; c.checked = !!checked;
    r.append(c); box.append(r); return c;
  };

  // [alpha.120 ข้อ 6] เปลี่ยนชื่อฉากได้จากคุณสมบัติ (ทั้งกล่องและแผงต้องมีเหมือนกัน)
  const iTitle = mk(t('ui.props.sceneName'), row.title);
  const iSyn = mk(t('ui.common.synopsis'), M.synopsis, 'textarea');
  const iStoryDate = mk(t('ui.common.timeStoryLineTime'), M.storyDate);
  iStoryDate.placeholder = t('ui.scene.egDate');
  // [alpha.57a ข้อ 2] เลขหน้าเริ่มต้นของไฟล์ฉากนี้ — เลขหน้าบนกระดาษนับต่อจากค่านี้
  const iStartPage = mk(t('ui.scene.pageNumStartScreenplay'), row.startPage || '');
  iStartPage.type = 'number'; iStartPage.min = '1';
  // [alpha.164 · รอบต่อ 3] คำอธิบายยาวล้นช่อง (อังกฤษตัดครึ่ง) → ช่องโชว์แค่ตัวอย่าง "1" · คำอธิบายเต็มเป็น tooltip
  iStartPage.placeholder = '1';
  iStartPage.title = t('ui.scene.useOpenPageNumSettings');
  // ══ [alpha.141] ★ "ไล่เลขหน้าต่อเนื่อง" — เลขหน้าไล่ต่อจากฉาก/บทก่อนหน้าในเล่มเดียวกัน ══
  // ลำดับของฉากและบทมีอยู่แล้วใน draft.json/scenes.json · หน้าปกบทที่ติ๊กไว้ก็ถูกนับเป็นหน้าด้วย
  // (คิดที่ book-flow.js ที่เดียว แล้วโหมดอ่านทั้งเล่มกับหน้ากระดาษใช้คำตอบเดียวกัน)
  // ★ คลาส `wiki-flowchk` ไม่ใช่ `wiki-check` — เทสอ้างช่องติ๊กตามลำดับ (บทเรียนข้อ 12)
  const flowRow = el('div', 'wiki-row');
  flowRow.append(el('label', null, t('ui.scene.pageFlowContinue')));
  const iFlow = el('input', 'wiki-flowchk');
  iFlow.type = 'checkbox'; iFlow.checked = row.pageFlow === 'continue';
  iFlow.title = t('ui.scene.pageFlowHint');
  flowRow.append(iFlow); box.append(flowRow);
  const iPov = mk(t('ui.common.viewPOV'), M.pov);
  const iEmotion = mk(t('ui.common.mood'), M.emotion);
  const iConflict = mk(t('ui.common.conflict'), M.conflict);
  // [alpha.160 · P1-11] ค่าที่ถูกลบออกจากรายการแล้ว = คงไว้เป็นตัวเลือกพิเศษ (เดิมตกเป็น Outline แล้วถูกบันทึกทับเงียบ ๆ)
  const stc = statusChoices(allStatuses(), row.status);
  const iStatus = mkSelect(t('ui.common.status'),
    [['Outline', t('ui.common.notSet')],
     ...stc.values.map((s) => [s, s === stc.orphan ? tf('ui.status.orphanOpt', dataLabel(s)) : dataLabel(s)])],
    stc.selected);
  const iColor = mkSelect(t('ui.common.color'),
    [['', t('ui.common.notHas')], ...SCENE_COLORS.map(([n, hex]) => [hex, gi('dot') + ' ' + dataLabel(n)])], row.color || '');
  const iFlag = mkCheck(t('ui.common.pinPin'), row.flag);
  const iTags = mk(t('ui.common.tag2'), (M.tags || []).join(', '));
  const iNote = mk(t('ui.common.note'), M.note, 'textarea');
  const iFuture = mk(t('ui.scene.futureNoteWriter'), M.futureNote || '', 'textarea');
  iFuture.placeholder = t('ui.scene.noteWriterShowOnly');
  // [alpha.70 ข้อ 1] ปุ่ม "ดูบนแผนที่" — เดิมปักตำแหน่งฉากได้แต่ไม่มีทางกระโดดกลับไปดู
  // (import แบบไดนามิก: maps-ui → app.js → scene-props เป็นวง ถ้า import ตรง ๆ ตอนโหลดโมดูล)
  { const slot = el('div', 'props-mapslot'); box.append(slot);
    import('./maps-ui.js').then(({ buildShowOnMapRow }) => buildShowOnMapRow(row))
      .then((r) => slot.replaceWith(r)).catch(() => slot.remove()); }
  // ป้ายเล่าเรื่อง (Narrative Markers) — ฉากนี้อยู่นอกลำดับเวลาหลัก
  const iFb = mkCheck(t('ui.common.flashback'), M.isFlashback);
  const iFf = mkCheck(t('ui.common.pageFlashforward'), M.isFlashforward);
  // เลือกได้อย่างละหนึ่ง — ติ๊กตัวหนึ่งแล้วอีกตัวหลุดเอง
  iFb.addEventListener('change', () => { if (iFb.checked) iFf.checked = false; });
  iFf.addEventListener('change', () => { if (iFf.checked) iFb.checked = false; });

  // ---- [alpha.60r3 ข้อ 2] ปุ่ม ✨ ให้ AI เขียนให้ (อ่านเนื้อฉากจากไฟล์ .md ตรง ๆ) ----
  const aiCtx = async () => {
    let body = '';
    try { body = parseMdFile(await kapi.readFile(file)).body || ''; } catch {}
    return { body, title: row.title || '' };
  };
  attachAiFieldButton(rowOf.get(iSyn), iSyn, 'synopsis', aiCtx);
  attachAiFieldButton(rowOf.get(iPov), iPov, 'pov', aiCtx);
  attachAiFieldButton(rowOf.get(iEmotion), iEmotion, 'emotion', aiCtx);
  attachAiFieldButton(rowOf.get(iConflict), iConflict, 'conflict', aiCtx);

  // [alpha.157] องก์ + บท — วางท้ายกล่อง: เทสเดิมอ้าง <select> ตามลำดับ (บทเรียนข้อ 12) กรอก/เลือกได้จากคุณสมบัติฉากเลย (ชุดเดียวกับแผง)
  { const acHost = el('div', 'props-ac-host'); box.append(acHost);
    buildActChapterRows(acHost, { dPath, ch, sc: row }, { onMoved: async () => { ov.remove(); await buildTree(); } })
      .catch((e) => log('warn', 'act/chapter rows', e)); }
  // [alpha.157] ฉากนี้กล่าวถึงอะไรบ้าง (แบ่งตามหมวด Wiki)
  { const mHost = el('div', 'props-mentions-host'); box.append(mHost);
    buildMentionsBox(mHost, file).catch((e) => log('warn', 'mentions', e)); }

  const btns = el('div', 'k-dlg-btns');
  const cB = el('button', 'k-cancel', t('ui.common.cancel'));
  const okB = el('button', 'k-ok', t('ui.common.save'));
  btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
  cB.onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  escClose(ov, () => ov.remove());            // [alpha.124 ข้อ 15]
  okB.onclick = async () => {
    // ชื่อฉากเขียนผ่าน setSceneTitle เท่านั้น (มันแก้ทั้ง scenes.json · frontmatter · ชื่อบนแท็บ)
    const newTitle = iTitle.value.trim();
    if (newTitle && newTitle !== row.title) {
      const { setSceneTitle } = await import('./scene-ops.js');
      await setSceneTitle(dPath, ch, row, newTitle);
      row.title = newTitle;
    }
    row.synopsis = iSyn.value; row.pov = iPov.value; row.status = iStatus.value; row.storyDate = iStoryDate.value.trim();
    // เก็บเฉพาะเมื่อผู้ใช้กรอกจริง (ค่าว่าง = เริ่มที่ 1) — กัน field ว่างรกทุกแถว
    { const sp = parseInt(iStartPage.value, 10);
      if (Number.isFinite(sp) && sp > 0) row.startPage = sp; else delete row.startPage; }
    if (iFlow.checked) row.pageFlow = 'continue'; else delete row.pageFlow;
    row.emotion = iEmotion.value; row.conflict = iConflict.value;
    row.color = iColor.value; row.flag = iFlag.checked; row.note = iNote.value;
    row.futureNote = iFuture.value;
    if (iFb.checked && iFf.checked) iFf.checked = false;   // กันติ๊กพร้อมกัน (เผื่อถูกตั้งค่าจากโค้ด/เทส)
    row.isFlashback = iFb.checked; row.isFlashforward = iFf.checked;
    row.tags = iTags.value.split(',').map((x) => x.trim()).filter(Boolean);
    // [alpha.60r2 ข้อ 13] เขียน frontmatter ก่อน (แหล่งความจริง) แล้วค่อยอัปเดตดัชนี
    // ทำผ่าน writeSceneMeta ที่เดียว — ค่าว่าง/เท็จถูก delete ให้เอง ไม่เหลือบรรทัดรกในไฟล์
    const props = {};
    for (const k of SCENE_HEAVY_KEYS) props[k] = row[k];
    await writeSceneMeta(file, props);
    // [alpha.156] อ่าน scenes.json **สด** แล้วแก้เฉพาะแถวนี้ — `d` ที่อ่านตอนเปิดกล่องอาจเก่าแล้ว
    // (ระหว่างที่กล่องเปิด บันทึกอัตโนมัติอัปเดตจำนวนคำ / AI เพิ่มฉาก) เขียนทั้งก้อน = ของคนอื่นหาย
    // ชื่อฉากไม่ต้องยุ่ง — setSceneTitle ข้างบนเขียนไปแล้ว
    const INDEX_FIELDS = ['status', 'color', 'flag', 'startPage', 'pageFlow', ...SCENE_HEAVY_KEYS];
    await mutateJson(kapi, sf, (fresh) => {
      const live = ((fresh.chapters || {})[ch.guid] || []).find((x) => x.id === sc.id);
      if (!live) return false;
      for (const k of INDEX_FIELDS) { if (k in row) live[k] = row[k]; else delete live[k]; }
    });
    // ⚠ [alpha.124 ข้อ 38] เขียน frontmatter "ลับหลัง" แท็บที่เปิดไฟล์เดียวกันค้างอยู่ = ระเบิดเวลา
    // แท็บถือ `meta` ชุดเก่าไว้ พอบันทึกครั้งถัดไป (หรือ autosave) มันจะเขียนทับคุณสมบัติที่เพิ่งตั้ง
    // ทั้งหมด — แผงคุณสมบัติแก้เรื่องนี้ไปแล้วตั้งแต่ alpha.120 ข้อ 6 แต่ **กล่องนี้ยังไม่ได้แก้**
    // (ทางเดียวกันเป๊ะ ต่างแค่ไฟล์) → ซิงก์ให้แท็บรู้ค่าใหม่ทันทีเหมือนกัน
    // [alpha.162 · W1-11] ใช้ `syncOpenTabMeta()` ตัวกลาง (กฎ alpha.156) — เดิมคัดลอกโค้ดชุดเดียวกัน
    // มาไว้ตรงนี้ ทำให้ถ้าวันหนึ่งตัวกลางต้องทำอะไรเพิ่ม (เช่นซิงก์ฟิลด์อื่น) จุดนี้จะตกขบวนเงียบ ๆ
    await syncOpenTabMeta(file);
    await buildTree();                 // สี/สถานะที่เพิ่งตั้งเห็นผลใน tree ทันที
    // เลขหน้าเริ่มต้นเปลี่ยน → แท็บที่เปิดไฟล์นี้อยู่ต้องวาดเลขหน้าใหม่ทันที
    const openTab = state.tabs.get(file);
    if (openTab) {
      openTab.startPage = explicitStartPage(row);         // [alpha.159 · H7] ห้าม `|| 1` (ทับสาย continue)
      openTab.pageFlow = row.pageFlow === 'continue' ? 'continue' : '';
      updatePageNumberHint(); refreshSpView();
    }
    ov.remove(); setStatus(t('ui.scene.savePropsSceneDone'));
  };
}
