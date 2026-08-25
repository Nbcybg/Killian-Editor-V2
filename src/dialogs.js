// dialogs.js — กล่องโต้ตอบ: ตั้งค่าโปรเจกต์ · ประวัติเวอร์ชัน · changelog · ตัวดู log
import { tf } from './i18n.js';
import { applySettings, applySpellcheck, applyUIScale, applyZoomVars, applyPageVars, closeTab, fmtTs, listSnapshots, openScene, openSnapshotRight, refreshAllMentions, refreshAllSpell, saveProjectMeta, snapshotFile, tb,
         applyProjectLangFonts, preloadLangFontUrls, langFontUrl, refreshSpView, updatePageNumberHint,
         applyProseVars, proseFormat, applyPaperVars, renderPaperSheets } from './app.js';
import { PROSE_DEFAULTS, HEADING_DEFAULTS, QUOTE_DEFAULTS, mergeProseFormat,
         proseLinesPerPage, proseCharsPerLine, DEFAULT_PROSE_FONT } from './prose-format.js';
import { $, BASE_ED_FS, LOG_BUF, el, log, setStatus, state, i18n, loadLanguage, scanLanguages, languageCatalog,
         fallbackLangName, langFileName, csvToTable, t, SHORTCUTS, SHORTCUT_LABELS, accelText, shortcutId, DEFAULT_SP_CYCLE,
         DEFAULT_SP_CYCLE_KEYS, spCycleKeys, spKeyLabel, DEFAULT_SCRIPT_FONT,
         PAPER_SIZES, MARGIN_DEFAULTS, SP_ELEMENT_KEYS, SP_ELEMENT_CONFIG, SP_ELEMENT_STYLES,
         PAGE_BREAK_RULES, SP_STRINGS, mergeSpFormat, linesPerPage, formatLines,
         SCENE_NUMBER_DEFAULTS, PAGE_NUMBER_DEFAULTS, CONTINUED_DEFAULTS,
         LANG_FAMILY, SCRIPT_PRESETS, BUILTIN_FONT_FILES, SYSTEM_THAI_FONTS, defaultLangFonts, normalizeLangFonts,
         normalizeRange, buildLangFontCss, applyLangFonts,
         isLangFontUsable, withLangFamily,
         // [alpha.84 ข้อ 1] ตัวปรับสัดส่วนฟอนต์ไทยของบทภาพยนตร์
         SP_THAI_FALLBACKS, SP_THAI_RANGE, SP_THAI_SIZE, FONT_TARGETS,
         rowTarget, withSpFamily, usableCounts, migrateSpThai } from './core.js';
import { setTypeVolume, playType } from './typewriter-sound.js';
// [alpha.60r2 ข้อ 6] ชุดระยะขอบสำเร็จรูป (ตารางอยู่ใน margin-presets.json)
import { marginPreset, marginPresetOptions, matchMarginPreset } from './margin-presets.js';
// [alpha.100 ข้อ 4] สีกระดาษที่ผู้ใช้เลือกเอง
import { PAPER_PRESETS, PAPER_DEFAULT, normalizePaperColor, matchPaperPreset,
         paperPresetColor } from './paper-color.js';
import { SP_ELEMS, TAB_CYCLE } from './fountain.js';
import { refreshDashboardIfOpen } from './dashboard.js';
// refreshDashboardIfOpen — ใช้ต่อเมื่อ dashboard.js export ฟังก์ชันนี้
const _refreshDash = () => { try { refreshDashboardIfOpen(); } catch {} };
import { ask, confirmBox } from './ui.js';
import { parseMdFile } from './md.js';
import { setAutoSync, isAutoSyncOn } from './auto-task/event-ui.js';
import { applyFocusDim } from './focus-mode.js';
import { iconHtml } from './icons.js';
// [alpha.73 ข้อ 2+3] นิยามสี/การควบคุมของ Story Network อยู่ที่เดียว — กล่องตั้งค่าสร้างช่องจากมัน
import { NET_COLOR_GROUPS, NET_COLOR_DEFS, netColorDefsOf, normalizeNetColors,
         MOUSE_BUTTONS, resolveNetControls, controlsHint } from './network-theme.js';
// [alpha.80] ชุดสีสำเร็จรูป — เลือกชุดเดียวได้สีทั้งผัง ไม่ต้องไล่ตั้ง 27 ช่อง
import { allPresets, builtinPreset, presetLabel, applyPreset, matchPreset,
         addPreset, removePreset, canRemove } from './net-presets.js';

/**
 * สร้างช่องสีทั้งหมดของ Story Network จาก NET_COLOR_DEFS
 * เพิ่มสีใหม่ในนิยามกลาง = ช่องโผล่ในกล่องตั้งค่าเอง ไม่ต้องมาแก้ที่นี่อีก
 *
 * [alpha.80] ยกเครื่องหน้าตา — เดิมเป็น `k-row` เรียงลงมา 27 แถว ช่องสีลอยไม่ตรงคอลัมน์
 * (ผู้ใช้ส่งภาพมาว่า "เรียงไม่สวยเลย") · ตอนนี้เป็น **กริดการ์ดสี** จัดคอลัมน์ตรงกันทุกแถว
 * และมี **ชุดสีสำเร็จรูป** อยู่บนสุด — เลือกชุดเดียวจบ
 */
function buildNetColorFields(box, s) {
  const host = box.querySelector('#st-netcol-body');
  if (!host) return;
  const saved = normalizeNetColors(s.netColors);
  const work = { ...saved };                    // สำเนาทำงาน — เขียนกลับตอนกดบันทึกเท่านั้น
  host.replaceChildren();

  // ───────── ชุดสีสำเร็จรูป ─────────
  const pbox = el('div', 'k-netp');
  const prow = el('div', 'k-netp-row');
  prow.append(el('label', 'k-netp-label', t('ui.net.presetLabel')));
  const psel = el('select', 'k-dlg-select k-netp-sel');
  const fillPresets = () => {
    psel.replaceChildren();
    const o0 = el('option', null, t('ui.net.presetCustom')); o0.value = ''; psel.append(o0);
    for (const p of allPresets(s.netPresets)) {
      const o = el('option', null, presetLabel(p)); o.value = p.id; psel.append(o);
    }
    psel.value = matchPreset(work, s.netPresets);
  };
  const swatches = el('div', 'k-netp-swatch');
  const drawSwatch = (id) => {
    swatches.replaceChildren();
    const p = allPresets(s.netPresets).find((x) => x.id === id);
    if (!p) return;
    for (const k of Object.keys(p.colors).slice(0, 12)) {
      const dot = el('span', 'k-netp-dot');
      dot.style.background = p.colors[k];
      swatches.append(dot);
    }
  };
  psel.onchange = () => {
    const p = allPresets(s.netPresets).find((x) => x.id === psel.value);
    if (!p) { drawSwatch(''); return; }
    Object.assign(work, applyPreset(work, p));
    paintFields();
    drawSwatch(p.id);
    setStatus(tf('ui.net.presetApplied', presetLabel(p)));
  };
  prow.append(psel);

  const saveP = el('button', 'k-key-btn', t('ui.net.presetSave'));
  saveP.onclick = async () => {
    const name = await ask(t('ui.net.presetSaveAsk'), { value: '' });
    if (!name) return;
    s.netPresets = addPreset(s.netPresets, name, work);
    fillPresets();
    psel.value = matchPreset(work, s.netPresets);
    setStatus(tf('ui.net.presetSaved', name));
  };
  const delP = el('button', 'k-reset-btn', t('ui.net.presetDel'));
  delP.onclick = async () => {
    const id = psel.value;
    if (!canRemove(id)) { setStatus(t('ui.net.presetDelNo')); return; }
    const p = allPresets(s.netPresets).find((x) => x.id === id);
    if (!(await confirmBox(tf('ui.net.presetDelAsk', presetLabel(p)), t('ui.net.presetDel')))) return;
    s.netPresets = removePreset(s.netPresets, id);
    fillPresets();
  };
  prow.append(saveP, delP);
  pbox.append(prow, swatches, el('div', 'k-hint', t('ui.net.presetHint')));
  host.append(pbox);

  // ───────── ช่องสีทั้งหมด (กริด) ─────────
  const fields = [];
  for (const g of NET_COLOR_GROUPS) {
    const defs = netColorDefsOf(g.group);
    if (!defs.length) continue;
    host.append(el('div', 'k-set-sub k-full', g.label));
    const grid = el('div', 'k-netc-grid');
    for (const d of defs) {
      const cell = el('div', 'k-netc-cell');
      const c = el('input'); c.type = 'color'; c.className = 'st-netcol';
      c.dataset.key = d.key;
      c.value = work[d.key] || d.def || '#888888';
      const name = el('span', 'k-netc-name', d.label);
      name.title = d.label;
      const txt = el('input'); txt.type = 'text'; txt.className = 'st-netcol-t';
      txt.placeholder = d.cssVar ? t('ui.dlg.theme') : (d.def || '');
      txt.value = work[d.key] || '';
      // พิมพ์เลขสีเองก็ได้ · เว้นว่าง = ใช้ค่าเริ่มต้น/ตามธีม
      txt.oninput = () => {
        if (/^#[0-9a-f]{6}$/i.test(txt.value)) { c.value = txt.value; work[d.key] = txt.value; }
        else if (!txt.value) delete work[d.key];
        psel.value = matchPreset(work, s.netPresets);
      };
      c.oninput = () => { txt.value = c.value; work[d.key] = c.value;
                          psel.value = matchPreset(work, s.netPresets); };
      cell.append(c, name, txt);
      grid.append(cell);
      fields.push({ d, c, txt });
    }
    host.append(grid);
  }
  host.append(el('div', 'k-hint', t('ui.net.colorGroupHint')));

  /** วาดค่าจากสำเนาทำงานลงช่องทั้งหมด (ใช้ตอนเลือกชุดสำเร็จรูป) */
  function paintFields() {
    for (const f of fields) {
      f.c.value = work[f.d.key] || f.d.def || '#888888';
      f.txt.value = work[f.d.key] || '';
    }
  }
  fillPresets();
  drawSwatch(psel.value);

  // ปุ่มเมาส์ + คำอธิบายที่ sync กับค่าที่เลือก
  const ctl = resolveNetControls(s.netControls);
  const fill = (sel, cur) => {
    if (!sel) return;
    sel.replaceChildren();
    for (const b of MOUSE_BUTTONS) { const o = el('option', null, b.label); o.value = b.value; sel.append(o); }
    sel.value = cur;
  };
  const orbit = box.querySelector('#st-net-orbit'), pan = box.querySelector('#st-net-pan');
  fill(orbit, ctl.orbitButton); fill(pan, ctl.panButton);
  const hint = box.querySelector('#st-net-hint');
  const syncHint = () => {
    if (!hint) return;
    const c2 = resolveNetControls({ orbitButton: orbit.value, panButton: pan.value });
    if (pan.value !== c2.panButton) pan.value = c2.panButton;   // ชนกัน = ถอยให้อัตโนมัติ
    hint.textContent = t('ui.dlg.descUnderGraph') + controlsHint(c2, true);
  };
  if (orbit) orbit.onchange = syncHint;
  if (pan) pan.onchange = syncHint;
  syncHint();
}

/** อ่านค่าคืน — ช่องที่เว้นว่างไม่ถูกบันทึก (จะได้ตามธีม/ค่าเริ่มต้นต่อไป) */
function readNetColorFields(box) {
  const out = {};
  for (const c of box.querySelectorAll('.st-netcol')) {
    const txt = c.parentElement.querySelector('.st-netcol-t');
    const v = String((txt && txt.value) || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) out[c.dataset.key] = v.toLowerCase();
  }
  return out;
}

/**
 * ══ [alpha.97 ข้อ 12] เลือกฟอนต์จาก "รายชื่อฟอนต์ที่ลงไว้ในเครื่อง" ══
 *
 * ผู้ใช้สั่งไว้ว่า: *"เมื่อจับ font จากเครื่อง ให้ทำหมายเหตุว่าถ้าเปลี่ยนเครื่องอาจจะมีปัญหา
 * แนะนำให้ import มาดีกว่า"* → หมายเหตุนั้นอยู่ในกล่องนี้ตายตัว ไม่ใช่แค่ tooltip
 * @returns {Promise<string|null>} ชื่อวงศ์ที่เลือก · null = ยกเลิก
 */
export async function pickSystemFont(current) {
  let list = [];
  try { list = (await kapi.listFonts()) || []; } catch {}
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', t('ui.dlg.fontFromMachine')));
    const warn = el('div', 'k-hint k-font-warn', t('ui.dlg.fontMachineWarn'));
    box.append(warn);
    const search = el('input', 'k-dlg-input');
    search.placeholder = t('ui.dlg.searchFontName');
    box.append(search);
    const host = el('div', 'k-font-list');
    box.append(host);
    let sel = String(current || '');
    const draw = () => {
      const qy = search.value.trim().toLowerCase();
      const rows = list.filter((f) => !qy || f.toLowerCase().includes(qy)).slice(0, 400);
      host.replaceChildren();
      if (!rows.length) { host.append(el('div', 'cmp-empty', t('ui.dlg.notFoundFont'))); return; }
      for (const f of rows) {
        const it = el('div', 'k-font-item', f);
        it.style.fontFamily = '"' + f.replace(/"/g, '') + '", sans-serif';
        it.classList.toggle('on', f === sel);
        it.onclick = () => { sel = f; draw(); };
        it.ondblclick = () => { ov.remove(); resolve(f); };
        host.append(it);
      }
    };
    search.oninput = draw;
    draw();
    const btns = el('div', 'k-dlg-btns');
    const cancel = el('button', null, t('dialogs.cancel'));
    const ok = el('button', 'k-ok', t('dialogs.ok'));
    cancel.onclick = () => { ov.remove(); resolve(null); };
    ok.onclick = () => { ov.remove(); resolve(sel || null); };
    btns.append(cancel, ok); box.append(btns);
    ov.append(box); document.body.append(ov);
    search.focus();
  });
}

export function settingsDialog(openTab) {
  if (!state.root) { alert(t('errors.openProjectFirst')); return; }
  const s = state.settings, g = state.goals, m = state.meta;
  const origFont = parseInt(s.uiFontSize, 10) || 0;
  const origFontFamily = s.fontFamily || '';
  const origSpFontFamily = s.spFontFamily || '';
  // ---- [81-85][92] สำเนาทำงานของรูปแบบหน้ากระดาษ/บทภาพยนตร์ (ยังไม่แตะของจริงจนกดบันทึก) ----
  const W = {
    paperSize: PAPER_SIZES[s.paperSize] ? s.paperSize : 'letter',
    customPaper: { width: 8.5, height: 11, ...(s.customPaper || {}) },
    margins: { ...MARGIN_DEFAULTS, ...(s.pageMargins || {}) },
    elements: JSON.parse(JSON.stringify(mergeSpFormat({ elements: s.spElements }).elements)),
    styles: JSON.parse(JSON.stringify(mergeSpFormat({ styles: s.spStyles }).styles)),
    rules: { ...PAGE_BREAK_RULES, ...(s.spPageRules || {}) },
    strings: { ...SP_STRINGS, ...(s.spStrings || {}) },
    keys: spCycleKeys(s),
    cycleOn: s.spCycleEnabled !== false,
    dlgContinues: s.spDialogueContinues === true,
    // [alpha.57a ข้อ 2] เลขฉาก + เลขหน้า
    sceneNumbers: { ...SCENE_NUMBER_DEFAULTS, ...(s.spSceneNumbers || {}) },
    pageNumbers: { ...PAGE_NUMBER_DEFAULTS, ...(s.spPageNumbers || {}) },
    // [alpha.83r ข้อ 3] สวิตช์ "ใส่ CONTINUED อัตโนมัติ" — ผู้ใช้ขอให้อยู่ในตั้งค่าโปรเจกต์
    // (เดิมมีแต่ในเมนู "บท" ซึ่งหาไม่เจอถ้าไม่รู้ว่ามี) · ปิดแล้วพิมพ์เองด้วยบล็อก cont-left/right
    continued: { ...CONTINUED_DEFAULTS, ...(s.spContinued || {}) },
    // [alpha.57a ข้อ 5 · alpha.97 ข้อ 12] ฟอนต์ตามภาษา (สำเนาทำงาน)
    // รวม "ไทยในบทภาพยนตร์" ที่เคยเป็นระบบแยก (spThaiFont) เข้ามาเป็นแถวหนึ่งแล้ว
    langFonts: migrateSpThai(s.langFonts, s.spThaiFont).rows,
    // [alpha.58r บั๊ก 5] ช่วงบรรทัดบท + ช่องว่างคั่นหน้าในโหมดจัดหน้า
    spLineHeight: Number.isFinite(+s.spLineHeight) ? +s.spLineHeight : 1,
    spPageGap: parseInt(s.spPageGap, 10) || 28,
  };

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-settings');
  box.innerHTML = tf('ui.dlg.alphaItemLevelUser', t('settings.title'), t('settings.general'), t('settings.writing'), t('settings.automation'), t('settings.language'), t('settings.shortcuts'), t('settings.projectName'), t('settings.author'), t('settings.autoSaveMinutes'), t('settings.autoSaveHint'), t('settings.autoBackup'), t('settings.maxBackups'), t('settings.maxBackupsHint'), t('settings.dailyGoal'), t('settings.projectGoal'), t('settings.fontFamily'), t('settings.fontFamilyHint'), t('settings.spFontFamily'), t('settings.spFontFamilyHint'), t('settings.lineNumbers'), t('settings.lineNumbersHint'), t('settings.spellCheck'), t('settings.spellCheckHint'), t('settings.spellCheckDict'), t('settings.spellCheckDictHint'), t('settings.autoMention'), t('settings.autoMentionHint'), t('settings.recycleDays'), t('settings.recycleDaysHint'), t('settings.focusDim'), t('settings.focusDimHint'), t('ui.settings.uiScale'), t('ui.settings.uiScaleHint'), iconHtml('cloud-lightning', 14), t('settings.autoSync'), t('settings.autoSyncHint'), t('settings.languageSelect'), t('ui.dlg.langReadNameFile'), t('ui.dlg.exportFileCSV'), t('ui.dlg.openFolderLang'), t('ui.dlg.loadFileLangNew2'), t('settings.shortcutsHint'), t('dialogs.cancel'), t('dialogs.save'));
  ov.appendChild(box); document.body.appendChild(ov);

  const q = (id) => box.querySelector(id);
  /**
   * พรีวิวฟอนต์บทหนังสด ๆ (บั๊ก #2)
   *
   * [alpha.78] **ต้องประกอบสแตกเหมือน `applySettings()` เป๊ะ** — คือเอา `LANG_FAMILY`
   * (ฟอนต์ตามภาษา) ไปนำหน้าด้วยเมื่อมีแถวที่ใช้งานได้
   *
   * เดิมตั้ง `--sp-font` เป็นสแตกดิบ ๆ ไม่มีตัวนำหน้า → **ฟอนต์ตามภาษาหลุดหายทันที**
   * ทั้งตอนเลื่อนดูตัวเลือกในกล่อง และตอน "กดยกเลิก" (cancel เรียกตัวนี้เสมอ)
   * ผู้ใช้ที่ตั้งฟอนต์ตามภาษาไว้จึงเห็นบทเด้งกลับไปเป็นฟอนต์พื้นทุกครั้งที่กดยกเลิก
   * @param {string} v สแตกฟอนต์บท ('' = ใช้ค่ามาตรฐาน เหมือนที่ applySettings ทำ)
   * @param {any[]} [rows] แถวฟอนต์ตามภาษาที่ "กำลังถูกใช้จริง" ตอนนี้ (ไม่ส่ง = ของที่บันทึกไว้)
   */
  const applySpFont = (v, rows) => {
    const list = rows || state.settings.langFonts;
    // [alpha.97 ข้อ 12] บทมีวงศ์ของตัวเอง ("K2 SP") ที่สร้างจากแถว target = screenplay/all
    const n = usableCounts(list);
    document.documentElement.style.setProperty(
      '--sp-font', withSpFamily(v || DEFAULT_SCRIPT_FONT, n.screenplay > 0));
  };

  // โหลดฟอนต์จาก Fonts/ ในโปรเจกต์ (async, โหลดทีหลังไม่บล็อก)
  // ใช้รายการเดียวกันทั้งฟอนต์นิยาย (#st-fontfamily) และฟอนต์บทหนัง (#st-spfontfamily · บั๊ก #2)
  (async () => {
    const fs = q('#st-fontfamily'); if (!fs) return;
    const spFs = q('#st-spfontfamily');
    const builtin = [
      { name: t('ui.dlg.defaultCourierPrimePt'), value: '' },
      { name: t('ui.dlg.courierPrimeMoreApp'), value: DEFAULT_SCRIPT_FONT },
      { name: t('ui.dlg.courierThaiMonoMore'), value: '"Courier Thai Mono", "Courier Prime", monospace' },
      { name: t('ui.dlg.courierThaiProportionalMore'), value: '"Courier Thai Proportional", "Courier Prime", monospace' },
      // [alpha.60r3a] ฟอนต์ระบบที่วางวรรณยุกต์ไทยได้ถูกต้อง — แจกมากับโปรแกรมไม่ได้ แต่ถ้าเครื่องมีก็ใช้ได้เลย
      { name: t('ui.common.ayuthayaMacOSNotFloat'), value: 'Ayuthaya, "Leelawadee UI", sans-serif' },
      { name: 'Thonburi (macOS)', value: 'Thonburi, "Leelawadee UI", sans-serif' },
      { name: 'Segoe UI', value: '"Segoe UI", system-ui, sans-serif' },
      { name: 'Sarabun', value: 'Sarabun, sans-serif' },
      { name: 'Noto Sans Thai', value: '"Noto Sans Thai", sans-serif' },
      { name: 'Leelawadee UI', value: '"Leelawadee UI", sans-serif' },
      { name: 'TH Sarabun New', value: '"TH Sarabun New", sans-serif' },
      { name: 'Tahoma', value: 'Tahoma, sans-serif' },
      { name: 'Georgia', value: 'Georgia, serif' },
      { name: 'Courier New', value: '"Courier New", monospace' },
    ];
    try {
      const fontDir = await kapi.join(state.root, 'Fonts');
      if (await kapi.exists(fontDir)) {
        const fontFiles = await kapi.listFiles(fontDir);
        for (const f of fontFiles) {
          const name = f.replace(/\.[^.]+$/, '');
          builtin.push({ name: name + t('ui.dlg.project'), value: '"' + name + '", sans-serif' });
        }
      }
    } catch {}
    for (const f of builtin) {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.name;
      if (f.value === (origFontFamily || '')) opt.selected = true;
      fs.appendChild(opt);
    }
    if (spFs) {
      for (const f of builtin) {
        const opt = document.createElement('option');
        opt.value = f.value;
        // ฟอนต์บทหนังค่าว่าง = Courier New ตามมาตรฐานบท (ไม่ใช่ Segoe UI แบบนิยาย)
        opt.textContent = f.value === '' ? t('ui.dlg.defaultChapterFilmCourier') : f.name;
        if (f.value === (origSpFontFamily || '')) opt.selected = true;
        spFs.appendChild(opt);
      }
      // เห็นผลทันทีระหว่างเลือก (ยกเลิก = คืนค่าเดิม)
      // ตั้ง --sp-font ตรง ๆ ไม่เรียก applySettings() — ไม่งั้นจะไปรีเซ็ตพรีวิวขนาดฟอนต์ที่กำลังเลื่อนอยู่
      // ระหว่างอยู่ในกล่อง ให้ใช้แถวฟอนต์ตามภาษา "ที่กำลังพรีวิวอยู่" (W.langFonts)
      spFs.onchange = () => applySpFont(spFs.value, W.langFonts);
    }
  })();
  q('#st-title').value = m.title || '';
  q('#st-author').value = m.author || '';
  q('#st-auto').value = s.autoSaveMinutes ?? 5;
  // [alpha.60r ข้อ 1] แสดงหน้าแรกเมื่อเปิดโปรเจกต์
  const showHome = q('#st-showhome');
  if (showHome) showHome.checked = s.showHomeOnStartup !== false;
  q('#st-backup').checked = s.autoBackup !== false;
  q('#st-maxbak').value = s.maxBackups ?? 10;
  // [alpha.69] ประวัติการทำงาน
  if (q('#st-histlimit')) q('#st-histlimit').value = s.historyLimit ?? 32;
  if (q('#st-histoff')) q('#st-histoff').checked = s.historyOff === true;
  q('#st-daily').value = g.dailyWords ?? 500;
  q('#st-proj').value = g.projectWords ?? 50000;
  q('#st-font').value = origFont;
  q('#st-ln').checked = !!s.lineNumbers;
  q('#st-fab').checked = s.fabEnabled !== false;      // [60r2 ข้อ 9]
  q('#st-spell').checked = s.spellCheck !== false;
  q('#st-spelldict').checked = s.spellCheckDict !== false;
  q('#st-mention').checked = s.autoMention !== false;
  q('#st-recycle').value = s.recycleDays ?? 30;
  // ความจางโหมดโฟกัส — เลื่อนแล้วเห็นผลทันทีถ้ากำลังเปิดโหมดอยู่ (ยกเลิก = คืนค่าเดิม)
  const origDim = Number.isFinite(+s.focusDim) ? +s.focusDim : 0.3;
  q('#st-fmdim').value = String(origDim);
  q('#st-fmdim-lbl').textContent = String(origDim);
  q('#st-fmdim').oninput = () => {
    s.focusDim = parseFloat(q('#st-fmdim').value);
    q('#st-fmdim-lbl').textContent = String(s.focusDim);
    applyFocusDim();
  };
  // ขนาด UI — เลื่อนแล้วเห็นผลทันทีทั้งหน้าต่าง (ยกเลิก = คืนค่าเดิม)
  const origUiScale = Number.isFinite(+s.uiScale) ? +s.uiScale : 1;
  q('#st-uiscale').value = String(origUiScale);
  q('#st-uiscale-lbl').textContent = Math.round(origUiScale * 100) + '%';
  q('#st-uiscale').oninput = () => applyUIScale(parseFloat(q('#st-uiscale').value) || 1);
  q('#st-autosync').checked = isAutoSyncOn() || !!s.autoSync;
  // [alpha.60 ข้อ 96] ปรับหน้าใหม่อัตโนมัติ
  const autoPag = q('#st-autopag');
  const autoPagIntv = q('#st-pagintv');
  if (autoPag) autoPag.checked = !!s.spAutoPaginate;
  if (autoPagIntv) autoPagIntv.value = Math.min(60, Math.max(1, parseInt(s.spPaginateInterval, 10) || 30));
  q('#st-edpt').value = s.edFontPt ?? 12;
  q('#st-sppt').value = s.spFontPt ?? 12;
  q('#st-homethumb').value = s.homeThumb ?? 190;
  // ── [alpha.73 ข้อ 2+3] Story Network: สร้างช่องสี + ช่องปุ่มเมาส์ จากนิยามกลาง ──
  // เดิมเขียน HTML มือ 11 ช่อง แล้วอ่านกลับด้วยชื่อ id ที่พิมพ์เอง → ตกหล่นทุกครั้งที่เพิ่มสีใหม่
  buildNetColorFields(box, s);
  // ── end Story Network colors
  // พรีวิวขนาดฟอนต์ทันที (ยกเลิก = คืนค่าเดิม)
  // [alpha.81r ข้อ 1] ช่องนี้กับ "ขนาด (pt)" ในแท็บ 📖 รูปแบบนิยาย = **ตัวเลขเดียวกัน**
  // (เดิมเป็นคนละที่เก็บ ตั้งช่องหนึ่งแล้วอีกช่องไม่ขยับ → จอกับไฟล์ที่ส่งออกไม่ตรงกัน)
  const origEdPt = s.edFontPt ?? 12, origSpPt = s.spFontPt ?? 12;
  const previewPt = () => {
    const pt = parseFloat(q('#st-edpt').value) || 12;
    s.edFontPt = pt;
    s.prose = { ...(s.prose || {}), fontPt: pt };
    const mirror = q('#st-pr-pt'); if (mirror) mirror.value = String(pt);
    s.spFontPt = parseFloat(q('#st-sppt').value) || 12;
    applyZoomVars(parseInt(q('#st-font').value, 10) || 0);
  };
  q('#st-edpt').oninput = previewPt;
  q('#st-sppt').oninput = previewPt;

  // ════ [alpha.58r บั๊ก 16–24] แท็บ "📖 รูปแบบนิยาย" ════
  // สำเนาทำงาน — เห็นผลสดบนหน้ากระดาษ แต่กด "ยกเลิก" แล้วคืนค่าเดิมได้
  const origProse = JSON.parse(JSON.stringify(s.prose || {}));
  const P = mergeProseFormat(s.prose);
  const PROSE_FONTS = [
    { name: t('ui.dlg.defaultNovelCaseRatio'), value: '' },
    { name: 'Sarabun', value: '"Sarabun", sans-serif' },
    { name: 'TH Sarabun New', value: '"TH Sarabun New", sans-serif' },
    { name: t('ui.common.ayuthayaMacOSNotFloat'), value: 'Ayuthaya, "Leelawadee UI", sans-serif' },
    { name: 'Noto Serif Thai', value: '"Noto Serif Thai", serif' },
    { name: 'Noto Sans Thai', value: '"Noto Sans Thai", sans-serif' },
    { name: 'Leelawadee UI', value: '"Leelawadee UI", sans-serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Times New Roman', value: '"Times New Roman", serif' },
    { name: 'Segoe UI', value: '"Segoe UI", system-ui, sans-serif' },
    { name: t('ui.dlg.courierPrimeStyleScreenplay'), value: DEFAULT_SCRIPT_FONT },
  ];
  const fillFontSel = (sel, val) => {
    if (!sel) return;
    sel.innerHTML = '';
    for (const f of PROSE_FONTS) {
      const o = document.createElement('option');
      o.value = f.value; o.textContent = f.name;
      if (f.value === (val || '')) o.selected = true;
      sel.appendChild(o);
    }
  };
  // [alpha.97 ข้อ 12] ช่อง "ฟอนต์นิยาย" ถูกตัดทิ้ง — ใช้สแตกฐาน (ตั้งค่า → ทั่วไป)
  // แล้วให้ "ฟอนต์ตามภาษา" แทนที่เป็นช่วงอักขระ ซึ่งละเอียดกว่า
  fillFontSel(q('#st-pr-hfont'), P.headingFont);
  q('#st-pr-pt').value = P.fontPt;
  q('#st-pr-lh').value = P.lineHeight;
  q('#st-pr-para').value = P.paraSpacing;
  q('#st-pr-indent').value = P.firstLineIndent;
  q('#st-pr-indent-h').checked = !!P.indentAfterHeading;
  q('#st-pr-align').value = P.align;
  q('#st-pr-hcolor').value = P.headingColor || '';
  q('#st-pr-hnum').checked = !!P.headingNumber;
  q('#st-pr-hnumfmt').value = P.headingNumberFormat || t('ui.common.chapterN');
  q('#st-pr-hnumlv').value = P.headingNumberLevel;
  q('#st-pr-qi').checked = !!P.quote.italic;
  q('#st-pr-qb').checked = !!P.quote.border;
  q('#st-pr-qind').value = P.quote.indent;
  q('#st-pr-qcolor').value = P.quote.color || '';
  // [alpha.83 ข้อ 4] สองช่องนี้ = **สวิตช์เดียวกับ** "เลขหน้า" ในแท็บหน้ากระดาษ (W.pageNumbers)
  // เดิมเป็นคนละที่เก็บ → เปิดที่นี่แล้วตัวแก้ไข/โหมดจัดหน้าไม่ขึ้นเลข เปิดอีกที่แล้วมุมมองเรียงหน้า
  // ไม่ขึ้นเลข · ตอนนี้เขียนลง W.pageNumbers ตัวเดียว แล้วสะท้อนกลับให้ P เพื่อความเข้ากันได้
  // [alpha.97 ข้อ 11] ช่อง "ใส่เลขบนหน้าแรกด้วย" ถูกตัดทิ้งแล้ว — กฎมีข้อเดียว:
  // **หน้าที่ไม่ใช่ฉากไม่มีเลขหน้า** (หน้าปก/หน้ารายชื่อ) นอกนั้นมีเลขทุกหน้ารวมหน้าแรก
  const syncPgNum = () => {
    const a1 = q('#st-pr-pgnum'), a2 = q('#st-pn-show');
    if (a1) a1.checked = !!W.pageNumbers.show;
    if (a2) a2.checked = !!W.pageNumbers.show;
  };
  syncPgNum();

  const headBody = q('#st-pr-heads tbody');
  const renderHeads = () => {
    headBody.innerHTML = '';
    P.headings.forEach((h, i) => {
      const tr = document.createElement('tr');
      const td = (node) => { const c = document.createElement('td'); c.append(node); tr.append(c); return c; };
      const lbl = document.createElement('td'); lbl.textContent = 'h' + (i + 1); tr.append(lbl);
      const mkNum = (val, min, max, step, set) => {
        const n = document.createElement('input');
        n.type = 'number'; n.className = 'k-narrow';
        n.min = min; n.max = max; n.step = step; n.value = val;
        n.oninput = () => { set(parseFloat(n.value)); previewProse(); };
        return n;
      };
      const mkChk = (val, set) => {
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!val;
        c.onchange = () => { set(c.checked); previewProse(); };
        return c;
      };
      td(mkNum(h.size, 0.5, 5, 0.05, (v) => { h.size = Number.isFinite(v) ? v : 1; }));
      td(mkChk(h.bold, (v) => { h.bold = v; }));
      td(mkChk(h.italic, (v) => { h.italic = v; }));
      td(mkNum(h.before, 0, 6, 0.1, (v) => { h.before = Number.isFinite(v) ? v : 0; }));
      td(mkNum(h.after, 0, 6, 0.1, (v) => { h.after = Number.isFinite(v) ? v : 0; }));
      const al = document.createElement('select');
      for (const [v, lb] of [['', t('ui.dlg.bodyStory')], ['left', t('ui.common.alignLeft')], ['center', t('ui.common.center')], ['right', t('ui.common.right2')]]) {
        const o = document.createElement('option'); o.value = v; o.textContent = lb;
        if (v === (h.align || '')) o.selected = true; al.appendChild(o);
      }
      al.onchange = () => { h.align = al.value; previewProse(); };
      td(al);
      headBody.append(tr);
    });
  };
  /** อ่านค่าจากฟอร์ม → P แล้วเห็นผลบนหน้ากระดาษทันที */
  const readProse = () => {
    P.fontPt = parseFloat(q('#st-pr-pt').value) || 12;
    // ตัวเลขเดียวกับ "ขนาดฟอนต์นิยาย (pt)" ในแท็บ การเขียน — ต้องเดินตามกันทั้งสองทาง
    s.edFontPt = P.fontPt;
    const mirrorEd = q('#st-edpt'); if (mirrorEd) mirrorEd.value = String(P.fontPt);
    P.lineHeight = parseFloat(q('#st-pr-lh').value) || 1.75;
    P.paraSpacing = parseFloat(q('#st-pr-para').value) || 0;
    P.firstLineIndent = parseFloat(q('#st-pr-indent').value) || 0;
    P.indentAfterHeading = q('#st-pr-indent-h').checked;
    P.align = q('#st-pr-align').value;
    P.headingFont = q('#st-pr-hfont').value || '';
    P.headingColor = q('#st-pr-hcolor').value.trim();
    P.headingNumber = q('#st-pr-hnum').checked;
    P.headingNumberFormat = q('#st-pr-hnumfmt').value || t('ui.common.chapterN');
    P.headingNumberLevel = parseInt(q('#st-pr-hnumlv').value, 10) || 1;
    P.quote.italic = q('#st-pr-qi').checked;
    P.quote.border = q('#st-pr-qb').checked;
    P.quote.indent = parseFloat(q('#st-pr-qind').value) || 0;
    P.quote.color = q('#st-pr-qcolor').value.trim();
    W.pageNumbers.show = q('#st-pr-pgnum').checked;
    P.pageNumbers = W.pageNumbers.show;
    return P;
  };
  const previewProse = () => {
    const f = mergeProseFormat(readProse());
    applyProseVars(f);
    syncPgNum();
    try { previewPage(); } catch {}          // เลขหน้าเปลี่ยน = หน้ากระดาษต้องอัปเดตทันที
    const paper = PAPER_SIZES[W.paperSize] || PAPER_SIZES.letter;
    const pp = W.paperSize === 'custom' ? W.customPaper : paper;
    q('#st-pr-info').textContent =
      tf('ui.dlg.linePage2', proseLinesPerPage(f, pp, W.margins)) +
      tf('ui.dlg.charLine', proseCharsPerLine(f, pp, W.margins));
  };
  for (const id of ['#st-pr-pt', '#st-pr-lh', '#st-pr-para', '#st-pr-indent',
                    '#st-pr-indent-h', '#st-pr-align', '#st-pr-hfont', '#st-pr-hcolor',
                    '#st-pr-hnum', '#st-pr-hnumfmt', '#st-pr-hnumlv',
                    '#st-pr-qi', '#st-pr-qb', '#st-pr-qind', '#st-pr-qcolor',
                    '#st-pr-pgnum']) {
    const n = q(id); if (!n) continue;
    n.oninput = previewProse; n.onchange = previewProse;
  }
  const loadProse = (src) => {
    const f = mergeProseFormat(src);
    Object.assign(P, f);
    P.headings = f.headings.map((h) => ({ ...h }));
    P.quote = { ...f.quote };
    fillFontSel(q('#st-pr-hfont'), P.headingFont);
    q('#st-pr-pt').value = P.fontPt; q('#st-pr-lh').value = P.lineHeight;
    q('#st-pr-para').value = P.paraSpacing; q('#st-pr-indent').value = P.firstLineIndent;
    q('#st-pr-indent-h').checked = !!P.indentAfterHeading;
    q('#st-pr-align').value = P.align;
    q('#st-pr-hcolor').value = P.headingColor || '';
    q('#st-pr-hnum').checked = !!P.headingNumber;
    q('#st-pr-hnumfmt').value = P.headingNumberFormat;
    q('#st-pr-hnumlv').value = P.headingNumberLevel;
    q('#st-pr-qi').checked = !!P.quote.italic; q('#st-pr-qb').checked = !!P.quote.border;
    q('#st-pr-qind').value = P.quote.indent; q('#st-pr-qcolor').value = P.quote.color || '';
    syncPgNum();          // พรีเซ็ตรูปแบบนิยายไม่ยุ่งกับเลขหน้า (คนละเรื่องกัน)
    renderHeads(); previewProse();
  };
  q('#st-pr-reset').onclick = () => loadProse(null);
  // นิยายมาตรฐาน: ย่อหน้าบรรทัดแรก 0.5" ไม่เว้นบรรทัดระหว่างย่อหน้า
  q('#st-pr-preset-novel').onclick = () =>
    loadProse({ ...PROSE_DEFAULTS, firstLineIndent: 0.5, paraSpacing: 0, lineHeight: 1.6 });
  // ต้นฉบับส่งสำนักพิมพ์: เว้นบรรทัดคู่ ย่อหน้า 0.5" (มาตรฐาน manuscript)
  q('#st-pr-preset-ms').onclick = () =>
    loadProse({ ...PROSE_DEFAULTS, firstLineIndent: 0.5, paraSpacing: 0, lineHeight: 2 });
  renderHeads(); previewProse();

  // ---- [98] ข้อมูลผลงาน (project setup) ----
  const SETUP_FIELDS = [
    ['#st-email', 'authorEmail'], ['#st-contact', 'contact'], ['#st-phone', 'phone'],
    ['#st-spby', 'screenplayBy'], ['#st-basedon', 'basedOn'], ['#st-revby', 'revisionsBy'],
    ['#st-agname', 'agentName'], ['#st-agaddr', 'agentAddress'],
    ['#st-agphone', 'agentPhone'], ['#st-agemail', 'agentEmail'],
    ['#st-copyright', 'copyright'],
  ];
  for (const [sel, key] of SETUP_FIELDS) q(sel).value = m[key] || '';

  // ---- [85] หน้ากระดาษ + [84] กฎตัดหน้า + [92] ข้อความมาตรฐาน ----
  const paperSel = q('#st-paper');
  for (const key of Object.keys(PAPER_SIZES)) {
    const o = el('option'); o.value = key; o.textContent = PAPER_SIZES[key].name;
    if (key === W.paperSize) o.selected = true;
    paperSel.append(o);
  }
  const pageInfo = () => {
    const fmt = mergeSpFormat({ paperSize: W.paperSize, paper: W.customPaper, margins: W.margins,
                               lineHeight: W.spLineHeight });
    q('#st-paper-custom').style.display = W.paperSize === 'custom' ? '' : 'none';
    q('#st-page-info').textContent =
      tf('ui.dlg.areaPrint', (fmt.paper.width - W.margins.left - W.margins.right).toFixed(2)) +
      tf('ui.dlg.inch', (fmt.paper.height - W.margins.top - W.margins.bottom).toFixed(2)) +
      tf('ui.dlg.linePage', formatLines(fmt));
  };
  paperSel.onchange = () => { W.paperSize = paperSel.value; pageInfo(); previewPage(); };

  // ── [alpha.100 ข้อ 4] สีกระดาษ (พรีเซ็ต + เลือกเอง) · [ข้อ 2] เส้นบอกระยะขอบ ──
  // ผู้ใช้: *"หน้ากระดาษที่เป็นสีเหลือง ... ให้เปลี่ยนเป็นสีขาวให้หมด หรือทำ option
  //           ให้ผู้ใช้เปลี่ยนสีที่ต้องการได้"* — ค่าเริ่มต้นขาว และเลือกเองได้ตรงนี้
  // เห็นผลสด ๆ ระหว่างตั้งค่า (เขียนตัวแปร CSS จริง) · กดยกเลิก = คืนค่าเดิมที่ปุ่มปิดกล่อง
  W.paperColor = normalizePaperColor(s.paperColor || PAPER_DEFAULT, PAPER_DEFAULT);
  W.pageGuides = !!s.pageGuides;
  const pcSel = q('#st-paper-color');
  const pcHex = q('#st-paper-color-hex');
  const pcGuides = q('#st-page-guides');
  if (pcSel && pcHex) {
    for (const p of PAPER_PRESETS) {
      const o = el('option'); o.value = p.key; o.textContent = p.label; pcSel.append(o);
    }
    { const o = el('option'); o.value = ''; o.textContent = t('ui.dlg.setCustom'); pcSel.append(o); }
    const previewPaper = () => {
      const keep = s.paperColor;
      s.paperColor = W.paperColor;
      applyPaperVars();
      s.paperColor = keep;              // ค่าจริงยังไม่เปลี่ยนจนกว่าจะกดบันทึก
      try { renderPaperSheets(state.active); } catch {}
    };
    const syncPaperColor = () => {
      pcSel.value = matchPaperPreset(W.paperColor);
      pcHex.value = W.paperColor;
      previewPaper();
    };
    pcSel.onchange = () => {
      const c = paperPresetColor(pcSel.value);
      if (!c) { pcSel.value = ''; return; }      // "ตั้งเอง" = ไม่แตะสี
      W.paperColor = c; syncPaperColor();
    };
    pcHex.oninput = () => { W.paperColor = normalizePaperColor(pcHex.value, W.paperColor); syncPaperColor(); };
    syncPaperColor();
  }
  if (pcGuides) {
    pcGuides.checked = W.pageGuides;
    pcGuides.onchange = () => {
      W.pageGuides = pcGuides.checked;
      document.body.classList.toggle('k-page-guides', W.pageGuides);
    };
  }
  const numIn = (sel, get, set, step) => {
    const inp = q(sel); inp.value = get();
    inp.oninput = () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) { set(v); pageInfo(); previewPage(); } };
    return inp;
  };
  // [alpha.58r บั๊ก 5] ช่วงบรรทัดบท — เปลี่ยนแล้ว "บรรทัด/หน้า" ต้องเปลี่ยนตามทันที
  numIn('#st-splh', () => W.spLineHeight, (v) => { W.spLineHeight = Math.max(0.8, Math.min(2.5, v)); });
  numIn('#st-sppagegap', () => W.spPageGap, (v) => { W.spPageGap = Math.max(8, Math.min(120, Math.round(v))); });
  numIn('#st-paper-w', () => W.customPaper.width, (v) => { W.customPaper.width = v; });
  numIn('#st-paper-h', () => W.customPaper.height, (v) => { W.customPaper.height = v; });
  for (const side of ['top', 'bottom', 'left', 'right'])
    numIn('#st-mg-' + side, () => W.margins[side], (v) => { W.margins[side] = v; syncMarginPreset(); });
  // ---- [alpha.60r2 ข้อ 6] ชุดระยะขอบสำเร็จรูป ----
  const mgPreset = q('#st-mg-preset');
  mgPreset.append(el('option', '', t('ui.dlg.setCustom')));
  for (const [key, label] of marginPresetOptions()) {
    const o = el('option', '', label); o.value = key; mgPreset.append(o);
  }
  /** ให้ <select> สะท้อนตัวเลขในช่องจริงเสมอ — แก้มือแล้วต้องกลายเป็น "ตั้งเอง" */
  function syncMarginPreset() { mgPreset.value = matchMarginPreset(W.margins); }
  mgPreset.onchange = () => {
    const p = marginPreset(mgPreset.value);
    if (!p) return;                       // เลือก "ตั้งเอง" = ไม่แตะตัวเลข
    W.margins = { ...p };
    W.marginPreset = mgPreset.value;
    for (const side of ['top', 'bottom', 'left', 'right']) q('#st-mg-' + side).value = W.margins[side];
    W.marginPreset = matchMarginPreset(W.margins); syncMarginPreset();
    pageInfo(); previewPage();
  };
  syncMarginPreset();
  const RULE_MAP = { '#st-pb-ab': 'minActionLinesAtBottom', '#st-pb-at': 'minActionLinesAtTop',
    '#st-pb-db': 'minDialogueLinesAtBottom', '#st-pb-dt': 'minDialogueLinesAtTop',
    '#st-pb-hy': 'maxConsecutiveHyphens', '#st-pb-ks': 'keepSceneWithNext' };
  for (const sel of Object.keys(RULE_MAP)) {
    const k = RULE_MAP[sel];
    numIn(sel, () => W.rules[k], (v) => { W.rules[k] = Math.max(0, Math.round(v)); });
  }
  const STR_MAP = { '#st-str-cb': 'continuedBottom', '#st-str-ct': 'continuedTop',
    '#st-str-more': 'dialogueMore', '#st-str-contd': 'dialogueContd',
    '#st-str-scene': 'sceneTitle', '#st-str-time': 'timeTitle' };
  for (const sel of Object.keys(STR_MAP)) {
    const k = STR_MAP[sel];
    const inp = q(sel); inp.value = W.strings[k];
    inp.oninput = () => { W.strings[k] = inp.value; };
  }
  // ---- [alpha.57a ข้อ 2] เลขฉาก + เลขหน้า ----
  const chk = (sel, get, set) => {
    const c = q(sel); c.checked = !!get();
    c.onchange = () => { set(c.checked); pageInfo(); previewPage(); };
    return c;
  };
  chk('#st-sn-show', () => W.sceneNumbers.show, (v) => { W.sceneNumbers.show = v; });
  numIn('#st-sn-left', () => W.sceneNumbers.left, (v) => { W.sceneNumbers.left = v; });
  numIn('#st-sn-right', () => W.sceneNumbers.right, (v) => { W.sceneNumbers.right = v; });
  { const i = q('#st-sn-suffix'); i.value = W.sceneNumbers.suffix || '';
    i.oninput = () => { W.sceneNumbers.suffix = i.value; previewPage(); }; }
  chk('#st-ct-auto', () => W.continued.enabled !== false, (v) => { W.continued.enabled = v; });
  chk('#st-pn-show', () => W.pageNumbers.show, (v) => { W.pageNumbers.show = v; syncPgNum(); });
  numIn('#st-pn-right', () => W.pageNumbers.right, (v) => { W.pageNumbers.right = v; });
  numIn('#st-pn-top', () => W.pageNumbers.top, (v) => { W.pageNumbers.top = v; });
  { const i = q('#st-pn-suffix'); i.value = W.pageNumbers.suffix || '';
    i.oninput = () => { W.pageNumbers.suffix = i.value; previewPage(); }; }

  pageInfo();

  // พรีวิวรูปแบบหน้ากระดาษ/บทสด ๆ ระหว่างตั้งค่า (ยกเลิก = คืนค่าเดิมด้วย applyPageVars อีกครั้ง)
  function previewPage() {
    const keep = { paperSize: s.paperSize, customPaper: s.customPaper, pageMargins: s.pageMargins,
                   spElements: s.spElements, spStyles: s.spStyles,
                   spSceneNumbers: s.spSceneNumbers, spPageNumbers: s.spPageNumbers,
                   spContinued: s.spContinued,
                   spLineHeight: s.spLineHeight, spPageGap: s.spPageGap };
    Object.assign(s, { paperSize: W.paperSize, customPaper: W.customPaper, pageMargins: W.margins,
                       spElements: W.elements, spStyles: W.styles,
                       spSceneNumbers: W.sceneNumbers, spPageNumbers: W.pageNumbers,
                       spContinued: W.continued,
                       spLineHeight: W.spLineHeight, spPageGap: W.spPageGap });
    applyPageVars();
    try { updatePageNumberHint(); refreshSpView(); } catch {}
    Object.assign(s, keep);   // ค่าจริงยังไม่เปลี่ยนจนกว่าจะกดบันทึก
  }

  // ---- [81][82][83] ตารางรูปแบบต่อ element ----
  const fmtBody = q('#st-spfmt tbody');
  function renderSpFmt() {
    fmtBody.innerHTML = '';
    for (const k of SP_ELEMENT_KEYS) {
      const row = el('tr');
      row.append(el('td', '', (SP_ELEMS[k] && SP_ELEMS[k].th) || k));
      const numCell = (field, step, min, max) => {
        const td = el('td');
        const i = el('input'); i.type = 'number'; i.step = String(step);
        i.min = String(min); i.max = String(max); i.value = String(W.elements[k][field]);
        i.oninput = () => { const v = parseFloat(i.value); if (Number.isFinite(v)) { W.elements[k][field] = v; previewPage(); } };
        td.append(i); return td;
      };
      row.append(numCell('indent', 0.1, 0, 12), numCell('width', 0.1, 0.3, 12),
                 numCell('linesBefore', 5, 0, 100), numCell('linesBetween', 5, 0, 100));
      for (const mode of ['screen', 'print']) {
        for (const prop of ['caps', 'bold', 'italic', 'underline']) {
          const td = el('td');
          const c = el('input'); c.type = 'checkbox'; c.checked = !!W.styles[k][mode][prop];
          c.onchange = () => { W.styles[k][mode][prop] = c.checked; previewPage(); };
          td.append(c); row.append(td);
        }
      }
      fmtBody.append(row);
    }
  }
  renderSpFmt();
  q('#st-spfmt-reset').onclick = () => {
    W.elements = JSON.parse(JSON.stringify(SP_ELEMENT_CONFIG));
    W.styles = JSON.parse(JSON.stringify(SP_ELEMENT_STYLES));
    renderSpFmt(); previewPage();
  };
  q('#st-page-reset').onclick = () => {
    W.paperSize = 'letter'; W.customPaper = { width: 8.5, height: 11 };
    W.margins = { ...MARGIN_DEFAULTS };
    W.rules = { ...PAGE_BREAK_RULES }; W.strings = { ...SP_STRINGS };
    W.spLineHeight = 1; W.spPageGap = 28;
    q('#st-splh').value = '1'; q('#st-sppagegap').value = '28';
    paperSel.value = 'letter';
    // [alpha.100] สีกระดาษ/เส้นระยะขอบ กลับไปค่าเริ่มต้นด้วย (ขาว · ไม่มีเส้น)
    W.paperColor = PAPER_DEFAULT; W.pageGuides = false;
    if (pcSel && pcHex) { pcSel.value = matchPaperPreset(W.paperColor); pcHex.value = W.paperColor; }
    if (pcGuides) pcGuides.checked = false;
    document.body.classList.remove('k-page-guides');
    for (const side of ['top', 'bottom', 'left', 'right']) q('#st-mg-' + side).value = W.margins[side];
    q('#st-paper-w').value = W.customPaper.width; q('#st-paper-h').value = W.customPaper.height;
    for (const sel of Object.keys(RULE_MAP)) q(sel).value = W.rules[RULE_MAP[sel]];
    for (const sel of Object.keys(STR_MAP)) q(sel).value = W.strings[STR_MAP[sel]];
    pageInfo(); previewPage();
  };

  // ---- [แก้ไข feature 1] ปุ่มสลับ element ตั้งเองได้ + สวิตช์เปิด/ปิด ----
  q('#st-spcycle-on').checked = W.cycleOn;
  q('#st-spcycle-on').onchange = () => { W.cycleOn = q('#st-spcycle-on').checked; };
  // [alpha.78] กฎ "บรรทัดถัดจากบทพูดคืออะไร" — ผู้ใช้ตั้งเอง ไม่ใช่โค้ดตัดสินแทน
  q('#st-spdlgcont').checked = W.dlgContinues;
  q('#st-spdlgcont').onchange = () => { W.dlgContinues = q('#st-spdlgcont').checked; };
  const KEY_LABELS = { enter: t('ui.dlg.elementPrevEnter'),
                       tab: t('ui.dlg.togglePagePrevTab'),
                       shiftTab: t('ui.dlg.toggleUndoPrevShift') };
  function renderSpKeys() {
    const host = q('#st-spkeys'); host.innerHTML = '';
    for (const dir of ['enter', 'tab', 'shiftTab']) {
      const row = el('div', 'k-key-row');
      row.append(el('span', 'k-key-label', KEY_LABELS[dir]));
      const accel = el('span', 'k-key-accel', spKeyLabel(W.keys[dir]));
      row.append(accel);
      const edit = el('button', 'k-key-btn', t('ui.dlg.change'));
      const reset = el('button', 'k-key-btn', '↺');
      reset.title = t('ui.dlg.restoreDefault');
      edit.onclick = () => {
        accel.textContent = t('ui.dlg.pressBtnNeed'); accel.classList.add('rec');
        const grab = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
          window.removeEventListener('keydown', grab, true);
          W.keys[dir] = { code: e.code, shift: e.shiftKey,
                          ctrl: e.ctrlKey || e.metaKey, alt: e.altKey };
          renderSpKeys(); syncCycleHeads();
        };
        window.addEventListener('keydown', grab, true);
      };
      reset.onclick = () => { W.keys[dir] = { ...DEFAULT_SP_CYCLE_KEYS[dir] }; renderSpKeys(); syncCycleHeads(); };
      row.append(edit, reset); host.append(row);
    }
  }
  function syncCycleHeads() {
    q('#st-hd-enter').textContent = spKeyLabel(W.keys.enter) + ' →';
    q('#st-hd-tab').textContent = spKeyLabel(W.keys.tab) + ' →';
    q('#st-hd-stab').textContent = spKeyLabel(W.keys.shiftTab) + ' →';
  }
  renderSpKeys(); syncCycleHeads();

  // ---- spCycle ตารางควบคุม Tab/Enter ในบทหนัง ----
  // [alpha.58 บั๊ก 2] element ที่เพิ่มมาใน .57a (ทรานซิชันเข้า/ฉากย่อย/สลับฉาก) เคยตกหล่นจากตารางนี้
  // → ผู้ใช้ตั้งปุ่มสลับให้มันไม่ได้เลย. รายการต้องมาจาก TAB_CYCLE เพื่อไม่ตกหล่นอีกเมื่อเพิ่ม element ใหม่
  const cycleKeys = TAB_CYCLE.slice();
  const cycleOpts = [...TAB_CYCLE, 'summary', 'outline1', 'outline2', 'outline3', 'image', 'raw']
    .filter((k, i, a) => a.indexOf(k) === i);
  // ใช้สำเนาทำงาน (ไม่แก้ state.settings จนกว่าจะกดบันทึก)
  const workSpCycle = {};
  const srcCycle = s.spCycle || DEFAULT_SP_CYCLE;
  for (const k of cycleKeys) {
    workSpCycle[k] = { ...(srcCycle[k] || DEFAULT_SP_CYCLE[k] || { enter: 'action', tab: 'action', shiftTab: 'action' }) };
  }
  const tbody = q('#st-spcycle tbody');
  function renderSpCycle() {
    tbody.innerHTML = '';
    for (const k of cycleKeys) {
      const row = el('tr');
      const label = (SP_ELEMS[k] && SP_ELEMS[k].th) || k;
      row.append(el('td', '', label));
      for (const dir of ['enter', 'tab', 'shiftTab']) {
        const sel = el('select');
        for (const opt of cycleOpts) {
          const o = el('option');
          o.value = opt;
          o.textContent = (SP_ELEMS[opt] && SP_ELEMS[opt].th) || opt;
          if (workSpCycle[k][dir] === opt) o.selected = true;
          sel.append(o);
        }
        sel.onchange = () => { workSpCycle[k][dir] = sel.value; };
        const td = el('td'); td.append(sel); row.append(td);
      }
      tbody.append(row);
    }
  }
  renderSpCycle();
  q('#st-spcycle-reset').onclick = () => {
    for (const k of cycleKeys) {
      workSpCycle[k] = { ...DEFAULT_SP_CYCLE[k] };
    }
    renderSpCycle();
  };
  // ---- [alpha.57a ข้อ 1] เสียงเครื่องพิมพ์ดีด ----
  const origSnd = { on: !!s.typeSound, vol: s.typeSoundVolume ?? 0.5,
    // [60r2 ข้อ 4] โหมดใหม่ · แปลงค่าจาก typeSoundAlways ของโปรเจกต์รุ่นก่อนให้เอง
    mode: (s.typeSoundMode === 'typewriter' || s.typeSoundMode === 'always')
      ? s.typeSoundMode : (s.typeSoundAlways === false ? 'typewriter' : 'always') };
  q('#st-typesnd').checked = origSnd.on;
  q('#st-typesnd-mode').value = origSnd.mode;
  q('#st-typesnd-vol').value = String(origSnd.vol);
  q('#st-typesnd-lbl').textContent = Math.round(origSnd.vol * 100) + '%';
  q('#st-typesnd-vol').oninput = () => {
    const v = parseFloat(q('#st-typesnd-vol').value) || 0;
    q('#st-typesnd-lbl').textContent = Math.round(v * 100) + '%';
    setTypeVolume(v);                       // ได้ยินผลทันทีตอนกดลองฟัง
  };
  q('#st-typesnd-test').onclick = () => playType('key', { force: true });
  q('#st-typesnd-test2').onclick = () => playType('return', { force: true });

  // ---- [alpha.57a ข้อ 5] ฟอนต์ตามภาษา ----
  let projectFonts = [];                    // ไฟล์ใน <โปรเจกต์>/Fonts
  const fontsHost = q('#st-fonts-list');
  /** ให้ผลลัพธ์เห็นทันทีระหว่างตั้งค่า (ยกเลิก = applySettings คืนของจริง) */
  const previewFonts = () => {
    const n = applyLangFonts(W.langFonts, langFontUrl);
    q('#st-fonts-preview').textContent = n.total
      ? tf('ui.dlg.useRowSampleEnglish', n.total)
      : t('ui.dlg.cantDefineRowUse');
    // [alpha.97 ข้อ 12] ตัวอย่างเป็น "บทภาพยนตร์" จึงต้องใช้วงศ์ของบท (K2 SP) ไม่ใช่ของนิยาย
    // — ไม่งั้นแถวที่ตั้งไว้ว่าใช้กับบทเท่านั้นจะไม่โผล่ในตัวอย่างเลย
    const sample = q('#st-fonts-sample');
    sample.textContent = t('ui.dlg.iNTNightSceneOne');
    sample.style.fontFamily = withSpFamily(
      q('#st-spfontfamily')?.value || DEFAULT_SCRIPT_FONT, n.screenplay > 0);
    applySpFont(q('#st-spfontfamily')?.value ?? s.spFontFamily, W.langFonts);
  };
  function renderFonts() {
    fontsHost.innerHTML = '';
    if (!W.langFonts.length) fontsHost.append(el('div', 'cmp-empty', t('ui.dlg.notHasRowPress')));
    W.langFonts.forEach((row, i) => {
      const r = el('div', 'k-font-row');
      // เปิด/ปิดแถว
      const on = el('input'); on.type = 'checkbox'; on.checked = row.enabled !== false;
      on.title = t('ui.dlg.useRow');
      on.onchange = () => { row.enabled = on.checked; previewFonts(); };
      r.append(on);
      // ภาษา / ช่วงอักขระ
      const scriptSel = el('select', 'k-dlg-select k-font-script');
      for (const p of SCRIPT_PRESETS) {
        const o = el('option', null, p.label); o.value = p.range; scriptSel.append(o);
      }
      const custom = el('option', null, t('ui.dlg.defineRange')); custom.value = '__custom'; scriptSel.append(custom);
      const known = SCRIPT_PRESETS.find((p) => p.range === row.range);
      scriptSel.value = known ? known.range : '__custom';
      const rangeIn = el('input', 'k-font-range');
      rangeIn.value = row.range; rangeIn.placeholder = 'U+0E00-0E7F';
      rangeIn.style.display = known ? 'none' : '';
      scriptSel.onchange = () => {
        if (scriptSel.value === '__custom') { rangeIn.style.display = ''; rangeIn.focus(); return; }
        rangeIn.style.display = 'none';
        row.range = scriptSel.value;
        row.label = (SCRIPT_PRESETS.find((p) => p.range === scriptSel.value) || {}).label || '';
        previewFonts();
      };
      rangeIn.oninput = () => {
        row.range = rangeIn.value;
        rangeIn.classList.toggle('bad', !!rangeIn.value && !normalizeRange(rangeIn.value));
        previewFonts();
      };
      r.append(scriptSel, rangeIn);
      // ฟอนต์: ฝังมากับโปรแกรม / ไฟล์ในโปรเจกต์ / ชื่อฟอนต์ที่ลงในเครื่อง
      const fontSel = el('select', 'k-dlg-select k-font-pick');
      const addOpt = (val, text) => { const o = el('option', null, text); o.value = val; fontSel.append(o); };
      addOpt('', t('ui.dlg.useFontPrintName'));
      for (const b of BUILTIN_FONT_FILES) addOpt('b:' + b.file, b.label);
      // [alpha.60r3a] ฟอนต์ไทยของระบบ (Ayuthaya ฯลฯ) — ใช้ได้เมื่อเครื่องมีติดตั้งอยู่แล้ว
      for (const f of SYSTEM_THAI_FONTS) addOpt('f:' + f.family, f.label);
      for (const f of projectFonts) addOpt('p:' + f, f + t('ui.dlg.project'));
      fontSel.value = row.builtin ? 'b:' + row.builtin : (row.file ? 'p:' + row.file : '');
      const famIn = el('input', 'k-font-family');
      famIn.value = row.family; famIn.placeholder = t('ui.dlg.egTHSarabunNew');
      famIn.style.display = fontSel.value ? 'none' : '';
      fontSel.onchange = () => {
        const v = fontSel.value;
        row.builtin = v.startsWith('b:') ? v.slice(2) : '';
        row.file = v.startsWith('p:') ? v.slice(2) : '';
        famIn.style.display = v ? 'none' : '';
        previewFonts();
      };
      famIn.oninput = () => { row.family = famIn.value; row.system = false; previewFonts(); };
      // [alpha.97 ข้อ 12] "จับ font จากเครื่อง" — รายชื่อจริงจากโฟลเดอร์ฟอนต์ของระบบ
      const sysBtn = el('button', 'k-key-btn k-font-sys', t('ui.dlg.fontFromMachine'));
      sysBtn.title = t('ui.dlg.fontFromMachineHint');
      sysBtn.onclick = async () => {
        const picked = await pickSystemFont(famIn.value);
        if (picked == null) return;
        row.family = picked; row.system = true;
        row.builtin = ''; row.file = '';
        fontSel.value = ''; famIn.style.display = ''; famIn.value = picked;
        renderFonts();
      };
      r.append(fontSel, famIn, sysBtn);
      // เป้าหมาย: ใช้กับนิยาย / บทภาพยนตร์ / ทั้งสอง
      const tgt = el('select', 'k-dlg-select k-font-target');
      // คีย์เขียนเต็มทีละตัว — ต่อสตริงเป็นคีย์ทำให้ประตูกันพลาด i18n มองไม่เห็น (บทเรียน .77)
      const TARGET_LABEL = { all: t('ui.dlg.fontTargetAll'), prose: t('ui.dlg.fontTargetProse'),
                             screenplay: t('ui.dlg.fontTargetSp') };
      for (const v of FONT_TARGETS) {
        const o = el('option', null, TARGET_LABEL[v] || v); o.value = v; tgt.append(o);
      }
      tgt.value = rowTarget(row);
      tgt.title = t('ui.dlg.fontTargetHint');
      tgt.onchange = () => { row.target = tgt.value; previewFonts(); };
      r.append(tgt);
      // สัดส่วน (size-adjust) — ตัวที่ทำให้ "ไทยในบทเท่า Courier" เป็นแค่ค่าในตาราง
      const sz = el('input', 'k-font-size');
      sz.type = 'number'; sz.min = '50'; sz.max = '150'; sz.step = '1';
      sz.value = String(row.size ?? 100);
      sz.title = t('ui.dlg.fontSizeAdjustHint');
      sz.oninput = () => { row.size = parseFloat(sz.value) || 100; previewFonts(); };
      r.append(sz, el('span', 'k-hint', '%'));
      // ลำดับ + ลบ
      const up = el('button', 'k-key-btn', '↑'); up.title = t('ui.common.scroll');
      up.onclick = () => { if (i > 0) { const [x] = W.langFonts.splice(i, 1); W.langFonts.splice(i - 1, 0, x); renderFonts(); previewFonts(); } };
      const del = el('button', 'k-danger-btn', '✕');
      del.onclick = () => { W.langFonts.splice(i, 1); renderFonts(); previewFonts(); };
      r.append(up, del);
      fontsHost.append(r);
    });
    previewFonts();
  }
  q('#st-fonts-add').onclick = () => {
    W.langFonts.push({ id: 'f' + W.langFonts.length, label: t('ui.common.msg8'), range: 'U+0E00-0E7F',
                       target: 'all', builtin: 'CourierThaiMono.ttf', file: '', family: '',
                       system: false, size: 100, ascent: 0, descent: 0, enabled: true });
    renderFonts();
  };
  q('#st-fonts-reset').onclick = () => { W.langFonts = defaultLangFonts(); renderFonts(); };
  q('#st-fonts-import').onclick = async () => {
    try {
      const src = await kapi.openFileDialog('font');
      if (!src) return;
      const dir = await kapi.join(state.root, 'Fonts');
      await kapi.mkdir(dir);
      const dst = await kapi.copyInto(src, dir);           // ไบนารี — copyInto คัดลอกไบต์ตรง (บทเรียน 14d)
      const name = String(dst || src).split(/[\\/]/).pop();
      if (!projectFonts.includes(name)) projectFonts.push(name);
      await preloadLangFontUrls();
      W.langFonts.push({ id: 'f' + W.langFonts.length, label: '', range: '', target: 'all',
                         builtin: '', file: name, family: '', system: false,
                         size: 100, ascent: 0, descent: 0, enabled: true });
      renderFonts();
      setStatus(t('ui.dlg.importFont') + name + t('ui.dlg.donePickRangeChar'));
    } catch (e) { log('error', t('ui.dlg.importFontFail'), e); setStatus(t('ui.dlg.importFontNotOk')); }
  };
  (async () => {
    try {
      const dir = await kapi.join(state.root, 'Fonts');
      if (await kapi.exists(dir)) projectFonts = await kapi.listFiles(dir);
    } catch {}
    renderFonts();
  })();

  // ---- ภาษา ----
  // [alpha.76] รายการภาษา = ผลสแกนไฟล์ `k2_<code>.csv` จริง ๆ ไม่ใช่รายชื่อฮาร์ดโค้ด
  const fillLangs = async () => {
    const sel = q('#st-lang'); if (!sel) return;
    let list = [];
    try { list = await scanLanguages(state.root); } catch {}
    // ชื่อภาษาเขียนด้วยภาษานั้นเอง ("ไทย" ต้องเป็น "ไทย" ในทุกภาษา) จึงไม่ผ่านระบบแปล
    if (!list.length) list = ['th', 'en'].map((c) => ({ code: c, nativeName: fallbackLangName(c) }));
    sel.innerHTML = '';
    for (const l of list) {
      const o = document.createElement('option');
      o.value = l.code;
      o.textContent = (l.nativeName || fallbackLangName(l.code)) + (l.name && l.name !== l.nativeName ? ' (' + l.name + ')' : '') + ' · ' + l.code;
      sel.append(o);
    }
    sel.value = i18n.lang || 'th';
    if (!sel.value && list[0]) sel.value = list[0].code;
    try {
      const dirs = await kapi.langDirs(state.root || '');
      const box = q('#st-lang-dirs');
      if (box) box.textContent = t('ui.dlg.searchFileLang') + (dirs || []).join('  ·  ');
    } catch {}
  };
  fillLangs();
  if (q('#st-lang-folder')) q('#st-lang-folder').onclick = async () => {
    try {
      // เปิดที่ที่ **มีไฟล์อยู่จริง** — โฟลเดอร์แรกในลำดับอาจยังไม่ถูกสร้าง (โปรเจกต์ที่ไม่เคยแปลเอง)
      const dirs = await kapi.langDirs(state.root || '');
      const want = langFileName(i18n.lang || 'th');
      let target = '';
      for (const d of dirs) { const f = await kapi.join(d, want); if (await kapi.exists(f)) { target = f; break; } }
      if (!target) { for (const d of dirs) if (await kapi.exists(d)) { target = d; break; } }
      if (target) await kapi.revealInOS(target);
      else setStatus(t('ui.dlg.notHasFolderLang'));
    } catch (e) { log('warn', t('ui.dlg.openFolderLangCant'), e); }
  };
  if (q('#st-lang-reload')) q('#st-lang-reload').onclick = async () => {
    try { await kapi.langReload(); } catch {}          // main แคชเนื้อไฟล์ไว้ — ต้องบอกให้ทิ้งก่อน
    await loadLanguage(q('#st-lang').value || i18n.lang, state.root);
    await fillLangs(); setStatus(t('ui.dlg.loadFileLangNew'));
  };
  if (q('#st-lang-export')) q('#st-lang-export').onclick = () => exportLangCsv();
  const origLang = i18n.lang;
  const origLn = !!s.lineNumbers, origSpell = s.spellCheck !== false,
        origSpellDict = s.spellCheckDict !== false, origMention = s.autoMention !== false;
  q('#st-ln').onchange = () => document.body.classList.toggle('k-ln', q('#st-ln').checked);
  // [alpha.92 ข้อ 3] สวิตช์ใหญ่คุมทั้งสองระบบ → ต้องวาดเส้นของโปรแกรมใหม่ด้วย ไม่ใช่แค่ของ Chromium
  q('#st-spell').onchange = () => { s.spellCheck = q('#st-spell').checked; refreshAllSpell(); };
  q('#st-spelldict').onchange = () => { s.spellCheckDict = q('#st-spelldict').checked; refreshAllSpell(); };
  q('#st-mention').onchange = () => { s.autoMention = q('#st-mention').checked; refreshAllMentions(); };

  // ---- ปุ่มลัด: ทำงานบนสำเนา (workKeys) จนกดบันทึก ----
  const workKeys = JSON.parse(JSON.stringify(s.shortcuts || {}));
  const keyOf = (id, def) => workKeys[id] || def;         // def = {code,ctrl,shift} จากค่าเริ่มต้น
  function renderShortcuts() {
    const host = q('#st-keys'); host.innerHTML = '';
    // ตรวจซ้ำ: นับ accel ที่ชนกัน
    const seen = {};
    const rows = SHORTCUTS.filter((sc) => SHORTCUT_LABELS[shortcutId(sc)]).map((sc) => {
      const id = shortcutId(sc);
      const def = { code: sc[0], ctrl: sc[1], shift: sc[2] };
      const cur = keyOf(id, def);
      const key = `${cur.code}|${cur.ctrl}|${cur.shift}`;
      seen[key] = (seen[key] || 0) + 1;
      return { id, def, cur, key };
    });
    for (const r of rows) {
      const row = el('div', 'k-key-row');
      row.append(el('span', 'k-key-label', t(SHORTCUT_LABELS[r.id], r.id)));
      const accel = el('span', 'k-key-accel' + (seen[r.key] > 1 ? ' dup' : ''),
        accelText(r.cur.code, r.cur.ctrl, r.cur.shift));
      row.append(accel);
      const edit = el('button', 'k-key-btn', t('dialogs.edit'));
      const reset = el('button', 'k-key-btn', '↺');
      reset.title = t('dialogs.reset');
      reset.style.visibility = workKeys[r.id] ? 'visible' : 'hidden';
      edit.onclick = () => {
        accel.textContent = t('errors.pressShortcut'); accel.classList.add('rec');
        const grab = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;   // รอปุ่มจริง
          const ctrl = e.ctrlKey || e.metaKey;
          if (!ctrl) { accel.textContent = t('errors.requiresCtrl'); return; }          // บังคับมี modifier
          window.removeEventListener('keydown', grab, true);
          workKeys[r.id] = { code: e.code, ctrl: true, shift: e.shiftKey };
          renderShortcuts();
        };
        window.addEventListener('keydown', grab, true);
      };
      reset.onclick = () => { delete workKeys[r.id]; renderShortcuts(); };
      row.append(edit, reset); host.append(row);
    }
  }
  renderShortcuts();

  const gotoTab = (name) => {
    box.querySelectorAll('.k-set-tab').forEach((x) => x.classList.toggle('on', x.dataset.p === name));
    box.querySelectorAll('.k-set-page').forEach((p) => p.classList.toggle('on', p.dataset.p === name));
    // เลื่อนเนื้อหากลับบนสุดเมื่อสลับหัวข้อ (ไม่งั้นหน้าใหม่เปิดมาค้างกลางหน้า)
    const main = box.querySelector('.k-set-main');
    if (main) main.scrollTop = 0;
  };
  box.querySelectorAll('.k-set-tab').forEach((tabEl) => tabEl.onclick = () => gotoTab(tabEl.dataset.p));
  if (openTab) gotoTab(openTab);      // เปิดตรงแท็บที่ผู้เรียกระบุ (ex. เมนู "ข้อมูลผลงาน")

  // ── [alpha.79] รายการหัวข้อด้านซ้าย: ช่องค้นหา ──
  // กล่องตั้งค่ามี 13 หน้า — หาหัวข้อไม่เจอเป็นปัญหาจริง ช่องนี้กรองจากทั้งชื่อและคำค้นที่ติดไว้ (data-find)
  const navQ = q('#st-nav-q');
  if (navQ) {
    navQ.oninput = () => {
      const v = navQ.value.trim().toLowerCase();
      let firstHit = null;
      box.querySelectorAll('.k-set-tab').forEach((x) => {
        const hay = (x.textContent + ' ' + (x.dataset.find || '')).toLowerCase();
        const hit = !v || hay.includes(v);
        x.classList.toggle('k-set-tab-off', !hit);
        if (hit && !firstHit) firstHit = x;
      });
      // หัวกลุ่มที่ไม่เหลือหัวข้อใต้มันแล้ว ต้องหายไปด้วย (ไม่งั้นเหลือหัวลอย ๆ)
      box.querySelectorAll('.k-set-navgrp').forEach((g) => {
        let n = g.nextElementSibling, any = false;
        while (n && !n.classList.contains('k-set-navgrp')) {
          if (n.classList.contains('k-set-tab') && !n.classList.contains('k-set-tab-off')) { any = true; break; }
          n = n.nextElementSibling;
        }
        g.classList.toggle('k-set-tab-off', !any);
      });
      if (v && firstHit) gotoTab(firstHit.dataset.p);
    };
  }

  // ── [alpha.79] หน้า "แถบเครื่องมือ" — ใช้ตัวสร้างรายการตัวเดียวกับกล่องเดี่ยว ──
  const tbHost = q('#st-toolbar-host');
  if (tbHost) {
    import('./toolbar/toolbar-ui.js')
      .then((m) => m.buildToolbarList(tbHost, { compact: true }))
      .catch((e) => log('warn', t('ui.dlg.warnToolbarPage'), e));
  }
  q('#st-font').oninput = () => applyZoomVars(parseInt(q('#st-font').value, 10) || 0);

  const close = () => ov.remove();
  const cancel = () => {
    s.edFontPt = origEdPt; s.spFontPt = origSpPt;
    s.prose = Object.keys(origProse).length ? origProse : null;   // คืนรูปแบบนิยายที่บันทึกไว้จริง
    applyProseVars(proseFormat());
    applyZoomVars(origFont);
    applyPageVars();                       // คืนรูปแบบหน้ากระดาษ/บทตามค่าที่บันทึกไว้จริง
    applyUIScale(origUiScale);
    setTypeVolume(origSnd.vol);
    // [alpha.78] คืนฟอนต์ตามลำดับที่ถูกต้อง: @font-face ตามภาษาก่อน แล้วค่อยประกอบสแตก
    // (สลับลำดับไม่ได้ — และห้ามตั้ง --sp-font แบบดิบ ไม่งั้นฟอนต์ตามภาษาหลุดหายตอนกดยกเลิก)
    const nLangBack = applyProjectLangFonts();   // คืน @font-face ตามภาษาที่บันทึกไว้จริง
    s.spFontFamily = origSpFontFamily;
    applySpFont(origSpFontFamily, null);         // ไม่ส่ง rows = ใช้ของที่บันทึกไว้
    s.fontFamily = origFontFamily;
    // [alpha.97 ข้อ 12] สแตกนิยาย = สแตกฐานอย่างเดียว (ชั้น override ของ "รูปแบบนิยาย" ถูกตัดแล้ว)
    document.documentElement.style.setProperty('--ed-font',
      withLangFamily(origFontFamily || DEFAULT_PROSE_FONT, nLangBack.prose > 0));
    s.focusDim = origDim; applyFocusDim();
    document.body.classList.toggle('k-ln', origLn);
    s.spellCheck = origSpell; s.autoMention = origMention;
    s.spellCheckDict = origSpellDict;
    applySpellcheck(); refreshAllMentions(); refreshAllSpell();
    close();
  };
  const num = (id, d) => { const n = parseInt(q(id).value, 10); return Number.isFinite(n) ? Math.max(0, n) : d; };

  box.querySelector('.k-cancel').onclick = cancel;
  ov.onclick = (e) => { if (e.target === ov) cancel(); };
  box.querySelector('.k-ok').onclick = async () => {
    m.title = q('#st-title').value.trim() || m.title;
    m.author = q('#st-author').value.trim();
    s.autoSaveMinutes = num('#st-auto', 5);
    // [alpha.60r ข้อ 1] แสดงหน้าแรกเมื่อเปิดโปรเจกต์
    const showHomeEl = q('#st-showhome');
    if (showHomeEl) s.showHomeOnStartup = showHomeEl.checked;
    s.autoBackup = q('#st-backup').checked;
    s.maxBackups = Math.max(1, num('#st-maxbak', 10));
    // [alpha.69] ประวัติการทำงาน — หนีบช่วงด้วยตัวเดียวกับที่ main ใช้ (ไม่คัดลอกกฎมาไว้สองที่)
    if (q('#st-histlimit')) s.historyLimit = Math.max(4, Math.min(500, num('#st-histlimit', 32)));
    if (q('#st-histoff')) s.historyOff = q('#st-histoff').checked;
    s.uiFontSize = Math.max(-6, Math.min(16, parseInt(q('#st-font').value, 10) || 0));
    s.fontFamily = q('#st-fontfamily')?.value || '';
    s.spFontFamily = q('#st-spfontfamily')?.value || '';
    s.lineNumbers = q('#st-ln').checked;
    s.fabEnabled = q('#st-fab').checked;               // [60r2 ข้อ 9]
    s.spellCheck = q('#st-spell').checked;
    s.spellCheckDict = q('#st-spelldict').checked;
    s.autoMention = q('#st-mention').checked;
    s.recycleDays = Math.max(0, num('#st-recycle', 30));
    s.focusDim = Math.min(0.8, Math.max(0.05, parseFloat(q('#st-fmdim').value) || 0.3));
    applyFocusDim();
    s.uiScale = Math.min(2, Math.max(0.75, parseFloat(q('#st-uiscale').value) || 1));
    s.shortcuts = workKeys;
    // Auto-sync (เก็บลง settings ด้วย — ไม่งั้นเปิดโปรแกรมใหม่แล้วกลับไปปิด)
    s.autoSync = q('#st-autosync').checked;
    setAutoSync(s.autoSync);
    // [alpha.60 ข้อ 96] ปรับหน้าใหม่อัตโนมัติ
    s.spAutoPaginate = q('#st-autopag')?.checked || false;
    s.spPaginateInterval = Math.min(60, Math.max(1, num('#st-pagintv', 30)));
    // บันทึก spCycle + ปุ่มที่ผูกไว้ + สวิตช์เปิด/ปิด (แก้ไข feature 1)
    s.spCycle = JSON.parse(JSON.stringify(workSpCycle));
    s.spCycleKeys = JSON.parse(JSON.stringify(W.keys));
    s.spCycleEnabled = W.cycleOn;
    s.spDialogueContinues = W.dlgContinues;
    // ขนาดฟอนต์เป็นพอยต์ + ขนาดการ์ดหน้าแรก
    // ที่เก็บจริงของขนาดฟอนต์นิยาย = settings.prose.fontPt (เขียนทีเดียวตอน readProse ด้านล่าง)
    // สองช่องนี้สะท้อนกันตอนพิมพ์แล้ว จึงอ่านช่องไหนก็ได้ค่าเดียวกัน
    s.edFontPt = Math.min(48, Math.max(6, parseFloat(q('#st-edpt').value) || 12));
    s.spFontPt = Math.min(48, Math.max(6, parseFloat(q('#st-sppt').value) || 12));
    s.homeThumb = Math.min(400, Math.max(120, parseInt(q('#st-homethumb').value, 10) || 190));
    // [85] หน้ากระดาษ + [84] กฎตัดหน้า + [92] ข้อความ + [81-83] รูปแบบ element
    s.paperSize = W.paperSize;
    s.customPaper = { ...W.customPaper };
    s.pageMargins = { ...W.margins };
    s.marginPreset = matchMarginPreset(W.margins);     // [60r2 ข้อ 6] '' = ผู้ใช้ตั้งเอง
    s.spElements = JSON.parse(JSON.stringify(W.elements));
    s.spStyles = JSON.parse(JSON.stringify(W.styles));
    s.spPageRules = { ...W.rules };
    s.spStrings = { ...W.strings };
    // [alpha.57a] เลขฉาก + เลขหน้า + เสียงพิมพ์ + ฟอนต์ตามภาษา
    s.spSceneNumbers = { ...W.sceneNumbers };
    s.spPageNumbers = { ...W.pageNumbers };
    s.spContinued = { ...W.continued };           // [alpha.83r ข้อ 3]
    s.spLineHeight = W.spLineHeight;              // [alpha.58r บั๊ก 5]
    s.spPageGap = W.spPageGap;
    // [alpha.100 ข้อ 2+4] สีกระดาษ + เส้นบอกระยะขอบ (ระดับผู้ใช้ — ดู globalKeys ด้านล่าง)
    s.paperColor = normalizePaperColor(W.paperColor, PAPER_DEFAULT);
    s.pageGuides = !!W.pageGuides;
    s.typeSound = q('#st-typesnd').checked;
    s.typeSoundMode = q('#st-typesnd-mode').value === 'typewriter' ? 'typewriter' : 'always';
    s.typeSoundAlways = s.typeSoundMode === 'always';   // คีย์เก่า — ให้รุ่นก่อนอ่านต่อได้
    s.typeSoundVolume = Math.min(1, Math.max(0, parseFloat(q('#st-typesnd-vol').value) || 0));
    s.langFonts = JSON.parse(JSON.stringify(W.langFonts));
    delete s.spThaiFont;                          // [alpha.97 ข้อ 12] ย้ายไปเป็นแถวในตารางแล้ว
    // [alpha.58r บั๊ก 16–24] รูปแบบนิยายทั้งชุด (เก็บก้อนเดียวที่ settings.prose)
    s.prose = JSON.parse(JSON.stringify(mergeProseFormat(readProse())));
    // [98] ข้อมูลผลงาน
    for (const [sel, key] of SETUP_FIELDS) m[key] = q(sel).value.trim();
    g.dailyWords = num('#st-daily', 500);
    g.projectWords = num('#st-proj', 50000);
    // ── [alpha.73 ข้อ 2+3] อ่านค่าคืนจากช่องที่สร้างเอง (ครบทุกคีย์เสมอ) ──
    s.netColors = readNetColorFields(box);
    s.netControls = { orbitButton: q('#st-net-orbit')?.value || 'middle',
                      panButton: q('#st-net-pan')?.value || 'left' };
    try {
      await preloadLangFontUrls();         // ฟอนต์ที่เพิ่งนำเข้าต้องมี URL ก่อน applySettings สร้าง CSS
      await saveProjectMeta();
      // [alpha.60 ข้อ 94] บันทึก global settings ลง userData/settings.json
      try {
        const globalKeys = ['autoSaveMinutes','maxBackups','autoBackup','lineNumbers','fabEnabled','uiFontSize','uiScale',
          'spellCheck','spellCheckDict','autoMention','recycleDays','paperMode','fontFamily','spFontFamily',
          'language','autoSync','thesaurus','focusDim','typeSound','typeSoundVolume','typeSoundAlways','typeSoundMode',
          'homeThumb','smartLearnMin','heavyDocBlocks','mdAlignStyle','shortcuts','showHomeOnStartup',
          'paperColor','pageGuides'];   // [alpha.100 ข้อ 2+4]
        const globals = {};
        for (const k of globalKeys) { if (k in s) globals[k] = s[k]; }
        await kapi.writeGlobalSettings(globals);
      } catch (e) { log('warn', t('ui.common.saveGlobalSettingsNot'), e); }
      applySettings();
      try { updatePageNumberHint(); refreshSpView(); } catch {}
      // [alpha.63r4] สี Story Network ที่เพิ่งตั้ง ต้องเห็นผลทันที ไม่ต้องปิด-เปิดแอป
      try { const { refreshNetwork } = await import('./app.js'); refreshNetwork(); } catch {}
      state.title = m.title;
      document.title = m.title + ' — Killian 2';
      $('#projname').textContent = m.title;
      $('#tb-title').textContent = m.title + ' — Killian 2';
      // แดชบอร์ดเป็นแผงแล้ว (refreshDashboardIfOpen เมื่อมี export)
    } catch (e) { log('error', t('ui.dlg.saveSettingsFail'), e); }
    // ---- บันทึกภาษา ----
    const selLang = q('#st-lang')?.value;
    if (selLang && selLang !== origLang) {
      s.language = selLang;
      await loadLanguage(selLang, state.root);
      await saveProjectMeta();
      // เมนู OS สร้างในฝั่ง main (renderer แตะไม่ได้) → ต้องบอกให้โหลดตารางแล้วสร้างเมนูใหม่
      try { await kapi.langSet(selLang); } catch {}
      // ค่าคงที่ระดับโมดูล (ชื่อสถานะ/ชื่อ element/ป้ายในตารางค่าคงที่) ถูกคำนวณตอนเปิดโปรแกรม
      // → เปลี่ยนภาษาแล้วบางป้ายยังเป็นภาษาเดิมจนกว่าจะเริ่มใหม่ · ถามผู้ใช้ตรง ๆ ดีกว่าปล่อยให้งง
      // (โหมดเทสไม่ถาม — กล่องยืนยันจะค้างรอคลิกตลอดกาล ดูกับดักเทสข้อ 1)
      const inTest = location.search.includes('k2test') || !!globalThis.__k2testing;
      if (!inTest && await confirmBox(t('ui.dlg.changeLangDoneStart'), t('ui.common.restart'))) {
        setTimeout(() => location.reload(), 150);
      }
    }
    // [alpha.69] จำนวนครั้งที่เก็บ/สวิตช์ปิด มีผลกับ **main** (คนจดประวัติ) ไม่ใช่ renderer
    // → ต้องบอกไปทันที ไม่งั้นค่าใหม่จะเริ่มใช้ตอนเปิดโปรเจกต์รอบหน้าเท่านั้น
    try { const { configHistory } = await import('./history/history-ui.js'); await configHistory(); } catch {}
    setStatus(t('status.settingsSaved'));
    close();
  };
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancel(); });
  q('#st-title').focus();
}

/**
 * [alpha.76] ส่งออก "ตารางแปล" ให้คนแปลทำงานใน Excel / Google Sheets
 *
 * ได้ไฟล์ 3 คอลัมน์: `key, th, <ภาษาปลายทาง>` — แถวไหนช่องปลายทางว่าง = ยังไม่แปล
 * แปลเสร็จแล้วบันทึกกลับเป็น `k2_<code>.csv` (2 คอลัมน์แรกจะถูกมองข้าม ตัวอ่านหยิบคอลัมน์
 * ที่ชื่อตรงกับรหัสภาษา) วางในโฟลเดอร์ languages แล้วเปิดโปรแกรมใหม่ — **ไม่ต้อง build**
 */
export async function exportLangCsv(target) {
  const code = target || (await ask(t('ui.dlg.exportTableLangLang'),
                                    { value: i18n.lang === 'th' ? 'en' : i18n.lang })) || '';
  if (!code) return null;
  const src = {}, dst = {};
  try {
    const csvTh = await kapi.langRead('th', state.root || '');
    Object.assign(src, csvToTable(csvTh));
  } catch {}
  try {
    const csvT = await kapi.langRead(code, state.root || '');
    if (csvT) Object.assign(dst, csvToTable(csvT));
  } catch {}
  const keys = [...new Set([...Object.keys(src), ...Object.keys(dst)])];
  const cell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = ['key,th,' + code];
  for (const k of keys) rows.push(cell(k) + ',' + cell(src[k] ?? k) + ',' + cell(dst[k] || ''));
  const text = '﻿' + rows.join('\r\n') + '\r\n';
  const out = await kapi.saveAsDialog(langFileName(code), 'csv');
  if (out) await kapi.writeFile(out, text);
  if (out) setStatus(tf('ui.dlg.exportTableRow', rows.length - 1, out));
  return out;
}

export async function versionDialog(dPath, ch, sc) {
  const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
  return fileVersionDialog(file, sc.title);
}

/**
 * ประวัติเวอร์ชันของ "ไฟล์ใดก็ได้" — เดิมผูกกับฉากอย่างเดียว
 * ทำให้ Wiki (.json) ใช้ระบบเวอร์ชันเดียวกันได้ (ข้อ 10)
 * onRestored: ให้ผู้เรียกโหลดหน้าที่เปิดค้างใหม่เอง (Wiki ต้องอ่าน JSON ใหม่ ไม่ใช่ openScene)
 */
export async function fileVersionDialog(file, titleText, { onRestored = null } = {}) {
  const isJson = /\.json$/i.test(file);
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-ver');
  box.append(el('div', 'k-dlg-title', t('panel.versionHistoryTitle') + titleText));
  const body = el('div', 'k-ver-body');
  const listCol = el('div', 'k-ver-list');
  const prev = el('div', 'k-ver-prev'); prev.textContent = t('panel.chooseVersion');
  body.append(listCol, prev); box.append(body);
  const foot = el('div', 'k-dlg-btns'); const closeB = el('button', null, t('dialogs.close'));
  foot.append(closeB); box.append(foot);
  ov.append(box); document.body.append(ov);
  closeB.onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  async function refresh() {
    listCol.innerHTML = '';
    const snaps = await listSnapshots(file);
    if (!snaps.length) { listCol.append(el('div', 'dim', t('panel.noVersions'))); return; }
    for (const s of snaps) {
      const it = el('div', 'k-ver-item');
      const meta = el('div', 'k-ver-meta');
      meta.append(el('div', 'k-ver-time', fmtTs(s.ts)));
      if (s.label) meta.append(el('span', 'k-ver-label', s.label));
      it.append(meta);
      const acts = el('div', 'k-ver-acts');
      const bView = el('button', null, t('dialogs.view')); bView.onclick = async () => {
        try {
          const c = await kapi.readFile(s.path);
          // Wiki เก็บเป็น JSON — ไม่มี frontmatter ให้แยก จึงแสดงเนื้อดิบ
          prev.textContent = (isJson ? c : parseMdFile(c).body) || t('panel.emptyContent');
        } catch { prev.textContent = t('panel.unreadable'); }
        [...listCol.querySelectorAll('.k-ver-item')].forEach((x) => x.classList.remove('on'));
        it.classList.add('on');
      };
      const bRes = el('button', 'k-ok', t('dialogs.restore')); bRes.onclick = async () => {
        if (!(await confirmBox(t('panel.confirmRestore'), t('dialogs.restore')))) return;
        await snapshotFile(file, t('panel.beforeRestore'));           // เซฟของปัจจุบันไว้ก่อน
        const c = await kapi.readFile(s.path);
        await kapi.writeFile(file, c);
        const openTab = state.tabs.get(file);
        if (onRestored) await onRestored(file, openTab);
        else if (openTab) {                                // ปิดแล้วเปิดใหม่ให้โหลดสด (รองรับทั้งนิยาย/บทหนัง)
          openTab.dirty = false;
          const title = openTab.title;
          closeTab(file); openScene(file, title);
        }
        setStatus(t('status.versionRestored')); refresh();
      };
      // เทียบกับฉากปัจจุบันแบบแยกจอจริง (ฉากซ้าย · เวอร์ชันเก่าขวา) — ข้อ 7
      const bSplit = el('button', null, t('ui.dlg.compareRight')); bSplit.title = t('ui.dlg.openVersionPairFile');
      bSplit.onclick = async () => { ov.remove(); await openSnapshotRight(file, s); };
      const bDel = el('button', 'k-danger-btn', t('dialogs.delete')); bDel.onclick = async () => {
        if (await confirmBox(t('panel.confirmDelete'))) { await kapi.remove(s.path); refresh(); }
      };
      acts.append(bView, bSplit, bRes, bDel); it.append(acts); listCol.append(it);
    }
  }
  refresh();
}

export async function showChangelog() {
  const md = await fetch('CHANGELOG.md').then((r) => r.text()).catch(() => t('panel.changelogNotFound'));
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide');
  const ttl = el('div', 'k-dlg-title', t('panel.changelogTitle'));
  const body = el('pre', 'k-changelog', md);
  const btns = el('div', 'k-dlg-btns');
  const ok = el('button', 'k-ok', t('dialogs.close'));
  ok.onclick = () => ov.remove();
  btns.append(ok); box.append(ttl, body, btns); ov.append(box);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
}

export async function showLog() {
  log('info', t('ui.dlg.openItemViewLog'));
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide');
  const ttl = el('div', 'k-dlg-title', t('panel.logTitle'));
  const body = el('pre', 'k-changelog k-logview');
  const load = async () => {
    let text = '';
    try { text = (await kapi.logRead(800)) || ''; } catch {}
    if (!text) text = LOG_BUF.slice(-800).join('\n');
    body.textContent = text || t('panel.logEmpty');
    body.scrollTop = body.scrollHeight;
  };
  await load();
  const btns = el('div', 'k-dlg-btns');
  const refresh = el('button', null, '↻ ' + t('dialogs.refresh')); refresh.onclick = load;
  const reveal = el('button');
  reveal.innerHTML = iconHtml('folder', 14) + ' ' + t('dialogs.openFolder'); reveal.onclick = () => kapi.logReveal && kapi.logReveal();
  const copy = el('button', null, '📋 ' + t('dialogs.copy'));
  copy.onclick = () => { navigator.clipboard.writeText(body.textContent).then(() => setStatus(t('status.logCopied'))); };
  const ok = el('button', 'k-ok', t('dialogs.close')); ok.onclick = () => ov.remove();
  btns.append(refresh, reveal, copy, ok);
  box.append(ttl, body, btns); ov.append(box);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
}
