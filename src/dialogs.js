// dialogs.js — กล่องโต้ตอบ: ตั้งค่าโปรเจกต์ · ประวัติเวอร์ชัน · changelog · ตัวดู log
import { T } from './i18n.js';
import { applySettings, applySpellcheck, applyUIScale, applyZoomVars, applyPageVars, closeTab, fmtTs, listSnapshots, openScene, openSnapshotRight, refreshAllMentions, refreshAllSpell, saveProjectMeta, snapshotFile, tb,
         applyProjectLangFonts, preloadLangFontUrls, langFontUrl, refreshSpView, updatePageNumberHint,
         applyProseVars, proseFormat } from './app.js';
import { PROSE_DEFAULTS, HEADING_DEFAULTS, QUOTE_DEFAULTS, mergeProseFormat,
         proseLinesPerPage, proseCharsPerLine, DEFAULT_PROSE_FONT } from './prose-format.js';
import { $, BASE_ED_FS, LOG_BUF, el, log, setStatus, state, i18n, loadLanguage, scanLanguages, languageCatalog,
         fallbackLangName, langFileName, csvToTable, t, SHORTCUTS, SHORTCUT_LABELS, accelText, shortcutId, DEFAULT_SP_CYCLE,
         DEFAULT_SP_CYCLE_KEYS, spCycleKeys, spKeyLabel, DEFAULT_SCRIPT_FONT,
         PAPER_SIZES, MARGIN_DEFAULTS, SP_ELEMENT_KEYS, SP_ELEMENT_CONFIG, SP_ELEMENT_STYLES,
         PAGE_BREAK_RULES, SP_STRINGS, mergeSpFormat, linesPerPage, formatLines,
         SCENE_NUMBER_DEFAULTS, PAGE_NUMBER_DEFAULTS,
         LANG_FAMILY, SCRIPT_PRESETS, BUILTIN_FONT_FILES, SYSTEM_THAI_FONTS, defaultLangFonts, normalizeLangFonts,
         normalizeRange, buildLangFontCss, applyLangFonts } from './core.js';
import { setTypeVolume, playType } from './typewriter-sound.js';
// [alpha.60r2 ข้อ 6] ชุดระยะขอบสำเร็จรูป (ตารางอยู่ใน margin-presets.json)
import { marginPreset, marginPresetOptions, matchMarginPreset } from './margin-presets.js';
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

/**
 * สร้างช่องสีทั้งหมดของ Story Network จาก NET_COLOR_DEFS
 * เพิ่มสีใหม่ในนิยามกลาง = ช่องโผล่ในกล่องตั้งค่าเอง ไม่ต้องมาแก้ที่นี่อีก
 */
function buildNetColorFields(box, s) {
  const host = box.querySelector('#st-netcol-body');
  if (!host) return;
  const saved = normalizeNetColors(s.netColors);
  host.replaceChildren();
  for (const g of NET_COLOR_GROUPS) {
    const defs = netColorDefsOf(g.group);
    if (!defs.length) continue;
    const h = el('div', 'k-set-sub k-full', g.label);
    host.append(h);
    for (const d of defs) {
      const row = el('div', 'k-row');
      row.append(el('label', null, d.label));
      const c = el('input'); c.type = 'color'; c.className = 'st-netcol';
      c.dataset.key = d.key;
      c.value = saved[d.key] || d.def;
      const txt = el('input'); txt.type = 'text'; txt.className = 'st-netcol-t';
      txt.style.width = '84px'; txt.placeholder = d.cssVar ? T`ตามธีม` : d.def;
      txt.value = saved[d.key] || '';
      // พิมพ์เลขสีเองก็ได้ · เว้นว่าง = ใช้ค่าเริ่มต้น/ตามธีม
      txt.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(txt.value)) c.value = txt.value; };
      c.oninput = () => { txt.value = c.value; };
      row.append(c, txt);
      host.append(row);
    }
  }
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
    hint.textContent = T`คำอธิบายใต้ผังจะเป็น: ` + controlsHint(c2, true);
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
    // [alpha.57a ข้อ 2] เลขฉาก + เลขหน้า
    sceneNumbers: { ...SCENE_NUMBER_DEFAULTS, ...(s.spSceneNumbers || {}) },
    pageNumbers: { ...PAGE_NUMBER_DEFAULTS, ...(s.spPageNumbers || {}) },
    // [alpha.57a ข้อ 5] ฟอนต์ตามภาษา (สำเนาทำงาน)
    langFonts: normalizeLangFonts(s.langFonts),
    // [alpha.58r บั๊ก 5] ช่วงบรรทัดบท + ช่องว่างคั่นหน้าในโหมดจัดหน้า
    spLineHeight: Number.isFinite(+s.spLineHeight) ? +s.spLineHeight : 1,
    spPageGap: parseInt(s.spPageGap, 10) || 28,
  };

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-settings');
  box.innerHTML = T`
    <div class="k-dlg-title">${t('settings.title')} <span style="font-weight:normal;font-size:0.7em;color:#666">// [alpha.60 ข้อ 94] 🌐 = ระดับผู้ใช้ (ใช้ร่วมทุกโปรเจกต์) · 📁 = ระดับโปรเจกต์ (เฉพาะโปรเจกต์นี้)</span></div>
    <div class="k-set-tabs">
      <div class="k-set-tab on" data-p="gen">🌐 ${t('settings.general')}</div>
      <div class="k-set-tab" data-p="write">🌐 ${t('settings.writing')}</div>
      <div class="k-set-tab" data-p="auto">🌐 ${t('settings.automation')}</div>
      <div class="k-set-tab" data-p="setup">📁 ข้อมูลผลงาน</div>
      <div class="k-set-tab" data-p="page">📁 หน้ากระดาษ</div>
      <div class="k-set-tab" data-p="prose">📁 รูปแบบนิยาย</div>
      <div class="k-set-tab" data-p="spfmt">📁 รูปแบบบท</div>
      <div class="k-set-tab" data-p="sp">📁 ปุ่มบทหนัง</div>
      <div class="k-set-tab" data-p="fonts">📁 ฟอนต์ตามภาษา</div>
      <div class="k-set-tab" data-p="lang">🌐 ${t('settings.language')}</div>
      <div class="k-set-tab" data-p="keys">🌐 ${t('settings.shortcuts')}</div>
      <div class="k-set-tab" data-p="netcol">📁 Story Network</div>
    </div>
    <div class="k-set-page k-set-2col on" data-p="gen">
      <div class="k-row"><label>${t('settings.projectName')}</label><input type="text" id="st-title"></div>
      <div class="k-row"><label>${t('settings.author')}</label><input type="text" id="st-author"></div>
      <div class="k-row"><label>${t('settings.autoSaveMinutes')}<span class="k-hint">${t('settings.autoSaveHint')}</span></label><input type="number" id="st-auto" min="0" max="120"></div>
      <div class="k-row"><label>${t('settings.autoBackup')}</label><input type="checkbox" id="st-backup"></div>
      <div class="k-row"><label>${t('settings.maxBackups')}<span class="k-hint">${t('settings.maxBackupsHint')}</span></label><input type="number" id="st-maxbak" min="1" max="200"></div>
      <div class="k-row"><label>${t('settings.dailyGoal')}</label><input type="number" id="st-daily" min="0"></div>
      <div class="k-row"><label>${t('settings.projectGoal')}</label><input type="number" id="st-proj" min="0"></div>
      <div class="k-set-sub k-full">// [alpha.60r ข้อ 1] พฤติกรรมตอนเปิดโปรเจกต์</div>
      <div class="k-row"><label>แสดงหน้าแรกเมื่อเปิดโปรเจกต์<span class="k-hint">ปิด = เปิดโปรเจกต์ล่าสุดโดยไม่ถาม</span></label><input type="checkbox" id="st-showhome"></div>
      <div class="k-set-sub k-full">// [alpha.69] ประวัติการทำงาน (แผง 🕘)</div>
      <div class="k-row"><label>เก็บประวัติย้อนหลัง (ครั้ง)<span class="k-hint">ยิ่งมากยิ่งย้อนได้ไกล แต่กินที่ใน .k2history/ · 4–500 · ค่าเริ่มต้น 32</span></label><input type="number" id="st-histlimit" min="4" max="500"></div>
      <div class="k-row"><label>ปิดการจดประวัติ<span class="k-hint">ปิดแล้วแผงประวัติจะไม่มีอะไรใหม่เพิ่ม (ของเดิมยังอยู่)</span></label><input type="checkbox" id="st-histoff"></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="write">
      <div class="k-row"><label>${t('settings.fontFamily')}<span class="k-hint">${t('settings.fontFamilyHint')}</span></label><select id="st-fontfamily" class="k-dlg-select" style="width:100%"></select></div>
      <div class="k-row"><label>${t('settings.spFontFamily')}<span class="k-hint">${t('settings.spFontFamilyHint')}</span></label><select id="st-spfontfamily" class="k-dlg-select" style="width:100%"></select></div>
      <div class="k-row"><label>ขนาดฟอนต์นิยาย (pt)<span class="k-hint">มาตรฐานต้นฉบับ = 12pt · รูปแบบอื่น ๆ ดูที่แท็บ "📖 รูปแบบนิยาย"</span></label><input type="number" id="st-edpt" class="k-narrow" min="6" max="48" step="0.5"></div>
      <div class="k-row"><label>ขนาดฟอนต์บทภาพยนตร์ (pt)<span class="k-hint">มาตรฐานบท = 12pt ทุกภาษา</span></label><input type="number" id="st-sppt" class="k-narrow" min="6" max="48" step="0.5"></div>
      <div class="k-row"><label>ขนาดตัวอักษรของ UI<span class="k-hint">[บั๊ก 14] ปรับจากค่าเริ่มต้น 14px — มีผลกับเปลือกโปรแกรมเท่านั้น ไม่แตะเอกสาร</span></label><input type="number" id="st-font" min="-6" max="16" step="1"></div>
      <div class="k-row"><label>ขนาดการ์ดหน้าแรก (px)<span class="k-hint">ความกว้างการ์ด 4 คอลัมน์บนหน้าแรก</span></label><input type="number" id="st-homethumb" class="k-narrow" min="120" max="400" step="10"></div>
      <div class="k-row"><label>${t('settings.lineNumbers')}<span class="k-hint">${t('settings.lineNumbersHint')}</span></label><input type="checkbox" id="st-ln"></div>
      <div class="k-row"><label>ปุ่มลอยมุมขวาล่าง (FAB)<span class="k-hint">[60r2 ข้อ 9] ปิดแล้วปุ่ม + และเมนูของมันจะหายไปทั้งชุด</span></label><input type="checkbox" id="st-fab"></div>
      <div class="k-row"><label>${t('settings.spellCheck')}<span class="k-hint">${t('settings.spellCheckHint')}</span></label><input type="checkbox" id="st-spell"></div>
      <div class="k-row"><label>${t('settings.spellCheckDict')}<span class="k-hint">${t('settings.spellCheckDictHint')}</span></label><input type="checkbox" id="st-spelldict"></div>
      <div class="k-row"><label>${t('settings.autoMention')}<span class="k-hint">${t('settings.autoMentionHint')}</span></label><input type="checkbox" id="st-mention"></div>
      <div class="k-row"><label>${t('settings.recycleDays')}<span class="k-hint">${t('settings.recycleDaysHint')}</span></label><input type="number" id="st-recycle" min="0" max="3650"></div>
      <div class="k-row"><label>${t('settings.focusDim')}<span class="k-hint">${t('settings.focusDimHint')}</span></label><input type="range" id="st-fmdim" min="0.05" max="0.8" step="0.05"><span id="st-fmdim-lbl" class="k-hint"></span></div>
      <div class="k-row"><label>${t('settings.uiScale', 'ขนาด UI')}<span class="k-hint">${t('settings.uiScaleHint', 'ย่อ/ขยายแถบเครื่องมือ แผง แท็บ และกล่องโต้ตอบ (75–200%)')}</span></label><input type="range" id="st-uiscale" min="0.75" max="2" step="0.05"><span id="st-uiscale-lbl" class="k-hint"></span></div>
      <div class="k-set-sub k-full">🔊 เสียงเครื่องพิมพ์ดีด</div>
      <div class="k-row"><label>เปิดเสียงขณะพิมพ์<span class="k-hint">เคาะแป้น · วรรค · ลบ · กระดิ่งตอนขึ้นบรรทัด</span></label><input type="checkbox" id="st-typesnd"></div>
      <div class="k-row"><label>เล่นเมื่อไร<span class="k-hint">[60r2 ข้อ 4] ค่าเริ่มต้น = ดังตลอด · เดิมต้องเปิดสวิตช์ที่สองด้วยจึงจะได้ยิน</span></label><select id="st-typesnd-mode" class="k-dlg-select"><option value="always">ดังตลอดเวลาที่พิมพ์</option><option value="typewriter">เฉพาะโหมดเครื่องพิมพ์ดีด (Ctrl+Shift+T)</option></select></div>
      <div class="k-row"><label>ระดับเสียง</label><input type="range" id="st-typesnd-vol" min="0" max="1" step="0.05"><span id="st-typesnd-lbl" class="k-hint"></span></div>
      <div class="k-row"><label>ลองฟัง</label><span><button id="st-typesnd-test" class="k-key-btn">เคาะ</button> <button id="st-typesnd-test2" class="k-key-btn">ขึ้นบรรทัด</button></span></div>
    </div>
    <div class="k-set-page" data-p="auto">
      <div class="k-row"><label>${iconHtml('cloud-lightning', 14)} ${t('settings.autoSync')}<span class="k-hint">${t('settings.autoSyncHint')}</span></label><input type="checkbox" id="st-autosync"></div>
      <div class="k-set-sub k-full">// [alpha.60 ข้อ 96] ปรับหน้าใหม่อัตโนมัติสำหรับบทภาพยนตร์</div>
      <div class="k-row"><label>คำนวณจำนวนหน้าใหม่หลังหยุดพิมพ์<span class="k-hint">ทำงานหลังจากหยุดพักตามช่วงเวลาที่ตั้ง · ใช้กับบทภาพยนตร์เท่านั้น</span></label><input type="checkbox" id="st-autopag"></div>
      <div class="k-row"><label>รอหลังหยุดพิมพ์ (วินาที)<span class="k-hint">1–60 วินาที ก่อนคำนวณหน้าใหม่ · ยิ่งสั้นยิ่งใช้ CPU มาก</span></label><input type="number" id="st-pagintv" min="1" max="60" step="1" class="k-narrow"></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="setup">
      <div class="k-hint" style="margin-bottom:10px">[98] ข้อมูลบนหน้าปกบท/ต้นฉบับ — ใช้ตอนพิมพ์และส่งออก</div>
      <div class="k-set-sub">ผู้เขียน</div>
      <div class="k-row"><label>อีเมลผู้เขียน</label><input type="text" id="st-email"></div>
      <div class="k-row"><label>ข้อมูลติดต่อ (Contact information)</label><input type="text" id="st-contact"></div>
      <div class="k-row"><label>โทรศัพท์ (Phone)</label><input type="text" id="st-phone"></div>
      <div class="k-set-sub">เครดิตบท</div>
      <div class="k-row"><label>Screenplay By</label><input type="text" id="st-spby"></div>
      <div class="k-row"><label>Based On</label><input type="text" id="st-basedon"></div>
      <div class="k-row"><label>Revisions by</label><input type="text" id="st-revby"></div>
      <div class="k-set-sub">ตัวแทน (Agent)</div>
      <div class="k-row"><label>Agent's Name</label><input type="text" id="st-agname"></div>
      <div class="k-row"><label>Agent's Address</label><input type="text" id="st-agaddr"></div>
      <div class="k-row"><label>Agent's Phone</label><input type="text" id="st-agphone"></div>
      <div class="k-row"><label>Agent's Email</label><input type="text" id="st-agemail"></div>
      <div class="k-set-sub">ลิขสิทธิ์</div>
      <div class="k-row"><label>Copyright by</label><input type="text" id="st-copyright"></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="page">
      <div class="k-hint" style="margin-bottom:10px">[85] ขนาดกระดาษและระยะขอบ — ใช้ร่วมกันทั้งโหมดนิยายและโหมดบทภาพยนตร์</div>
      <div class="k-row"><label>ขนาดกระดาษ</label><select id="st-paper" class="k-dlg-select"></select></div>
      <div class="k-row k-full" id="st-paper-custom"><label>กว้าง × สูง (นิ้ว)</label>
        <span><input type="number" id="st-paper-w" class="k-narrow" min="3" max="30" step="0.01">
        × <input type="number" id="st-paper-h" class="k-narrow" min="3" max="40" step="0.01"></span></div>
      <div class="k-set-sub">ระยะขอบ (นิ้ว)</div>
      <!-- [alpha.60r2 ข้อ 6] ชุดสำเร็จรูป — เลือกแล้วเติมช่องทั้งสี่ให้ทันที (ค่าอยู่ใน src/margin-presets.json) -->
      <div class="k-row k-full"><label>ชุดสำเร็จรูป<span class="k-hint">เลือกแล้วเติมค่าทั้งสี่ด้านให้ · แก้ตัวเลขเองได้ต่อ</span></label><select id="st-mg-preset" class="k-dlg-select"></select></div>
      <div class="k-set-grid2">
        <div class="k-row"><label>บน (Top)</label><input type="number" id="st-mg-top" class="k-narrow" min="0" max="5" step="0.05"></div>
        <div class="k-row"><label>ล่าง (Bottom)</label><input type="number" id="st-mg-bottom" class="k-narrow" min="0" max="5" step="0.05"></div>
        <div class="k-row"><label>ซ้าย (Left)</label><input type="number" id="st-mg-left" class="k-narrow" min="0" max="5" step="0.05"></div>
        <div class="k-row"><label>ขวา (Right)</label><input type="number" id="st-mg-right" class="k-narrow" min="0" max="5" step="0.05"></div>
      </div>
      <div class="k-row"><label>ช่วงบรรทัดบทภาพยนตร์<span class="k-hint">มาตรฐาน = 1 (6 บรรทัด/นิ้ว) · เปลี่ยนแล้วจำนวนบรรทัดต่อหน้าเปลี่ยนตาม</span></label><input type="number" id="st-splh" class="k-narrow" min="0.8" max="2.5" step="0.05"></div>
      <div class="k-row"><label>ช่องว่างระหว่างหน้าในโหมดจัดหน้า (px)</label><input type="number" id="st-sppagegap" class="k-narrow" min="8" max="120" step="2"></div>
      <div class="k-hint k-full" id="st-page-info" style="margin-top:8px"></div>
      <div class="k-set-sub k-full">เลขฉาก (Scene Number)</div>
      <div class="k-row"><label>แสดงเลขฉากข้างหัวฉาก<span class="k-hint">เลขจะอยู่ทั้งซ้ายและขวาของบรรทัดหัวฉาก</span></label><input type="checkbox" id="st-sn-show"></div>
      <div class="k-row"><label>ท้ายเลข<span class="k-hint">เช่น ว่าง หรือ "."</span></label><input type="text" id="st-sn-suffix" class="k-narrow"></div>
      <div class="k-row"><label>ซ้าย: ระยะจากขอบกระดาษซ้าย (นิ้ว)</label><input type="number" id="st-sn-left" class="k-narrow" min="0" max="5" step="0.05"></div>
      <div class="k-row"><label>ขวา: ระยะจากขอบกระดาษขวา (นิ้ว)</label><input type="number" id="st-sn-right" class="k-narrow" min="0" max="5" step="0.05"></div>
      <div class="k-set-sub k-full">เลขหน้า (Page Number)</div>
      <div class="k-row"><label>แสดงเลขหน้า<span class="k-hint">มีเฉพาะไฟล์ที่เป็นฉาก · เลขเริ่มต้นตั้งรายไฟล์ที่ "คุณสมบัติฉาก"</span></label><input type="checkbox" id="st-pn-show"></div>
      <div class="k-row"><label>ใส่เลขบนหน้าแรกด้วย<span class="k-hint">ธรรมเนียมบท: หน้าแรกไม่ใส่เลข</span></label><input type="checkbox" id="st-pn-first"></div>
      <div class="k-row"><label>ระยะจากขอบขวา (นิ้ว)</label><input type="number" id="st-pn-right" class="k-narrow" min="0" max="5" step="0.05"></div>
      <div class="k-row"><label>ระยะจากขอบบน (นิ้ว)</label><input type="number" id="st-pn-top" class="k-narrow" min="0" max="5" step="0.05"></div>
      <div class="k-row"><label>ท้ายเลข</label><input type="text" id="st-pn-suffix" class="k-narrow"></div>
      <div class="k-set-sub">[84] กฎการตัดหน้า (widow / orphan)</div>
      <div class="k-set-grid2">
        <div class="k-row"><label>บรรยาย: เหลือท้ายหน้าอย่างน้อย</label><input type="number" id="st-pb-ab" class="k-narrow" min="0" max="20"></div>
        <div class="k-row"><label>บรรยาย: ยกไปหน้าใหม่อย่างน้อย</label><input type="number" id="st-pb-at" class="k-narrow" min="0" max="20"></div>
        <div class="k-row"><label>บทพูด: เหลือท้ายหน้าอย่างน้อย</label><input type="number" id="st-pb-db" class="k-narrow" min="0" max="20"></div>
        <div class="k-row"><label>บทพูด: ยกไปหน้าใหม่อย่างน้อย</label><input type="number" id="st-pb-dt" class="k-narrow" min="0" max="20"></div>
        <div class="k-row"><label>ขีดท้ายบรรทัดติดกันไม่เกิน</label><input type="number" id="st-pb-hy" class="k-narrow" min="0" max="10"></div>
        <div class="k-row"><label>หัวฉากท้ายหน้าต้องมีเนื้อตาม</label><input type="number" id="st-pb-ks" class="k-narrow" min="0" max="20"></div>
      </div>
      <div class="k-set-sub">[92] ข้อความมาตรฐาน</div>
      <div class="k-row"><label>ท้ายหน้าเมื่อฉากต่อเนื่อง</label><input type="text" id="st-str-cb"></div>
      <div class="k-row"><label>ต้นหน้าเมื่อฉากต่อเนื่อง</label><input type="text" id="st-str-ct"></div>
      <div class="k-row"><label>บทพูดยังไม่จบ (MORE)</label><input type="text" id="st-str-more"></div>
      <div class="k-row"><label>ทวนชื่อตัวละคร (cont'd)</label><input type="text" id="st-str-contd"></div>
      <div class="k-row"><label>หัวข้อ Scene / Time (หน้ารายชื่อ)</label>
        <span><input type="text" id="st-str-scene" style="width:46%"> <input type="text" id="st-str-time" style="width:46%"></span></div>
      <div class="k-full" style="margin-top:12px; text-align:right"><button id="st-page-reset" class="k-reset-btn">↺ คืนค่าเริ่มต้น</button></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="prose">
      <div class="k-hint k-full" style="margin-bottom:10px">
        [16–24] รูปแบบของ "เนื้อเรื่องนิยาย" — ย่อหน้าบรรทัดแรก · ช่วงบรรทัด · หัวข้อ · ยกคำพูด
        · ค่าที่ตั้งที่นี่ใช้ทั้งบนจอและตอนส่งออก HTML (WYSIWYG)</div>
      <div class="k-set-sub k-full">เนื้อเรื่อง</div>
      <div class="k-row"><label>ฟอนต์นิยาย<span class="k-hint">ว่าง = ตัวพิมพ์สัดส่วนมาตรฐาน (Sarabun/Georgia) ไม่ใช่ Courier ของบท</span></label><select id="st-pr-font" class="k-dlg-select" style="width:100%"></select></div>
      <div class="k-row"><label>ขนาด (pt)</label><input type="number" id="st-pr-pt" class="k-narrow" min="6" max="48" step="0.5"></div>
      <div class="k-row"><label>ช่วงบรรทัด<span class="k-hint">1.0 = ชิด · 1.75 = ปกติ · 2.0 = เว้นบรรทัดคู่</span></label><input type="number" id="st-pr-lh" class="k-narrow" min="0.8" max="4" step="0.05"></div>
      <div class="k-row"><label>ระยะระหว่างย่อหน้า (em)<span class="k-hint">นิยายมาตรฐาน = 0 (ใช้ย่อหน้าแทนการเว้นบรรทัด)</span></label><input type="number" id="st-pr-para" class="k-narrow" min="0" max="4" step="0.05"></div>
      <div class="k-row"><label>ย่อหน้าบรรทัดแรก (นิ้ว)<span class="k-hint">มาตรฐาน 0.3–0.5 นิ้ว · 0 = ไม่ย่อ</span></label><input type="number" id="st-pr-indent" class="k-narrow" min="0" max="3" step="0.05"></div>
      <div class="k-row"><label>ย่อหน้าแรกหลังหัวข้อด้วย<span class="k-hint">ธรรมเนียมสากล: ย่อหน้าแรกของบทไม่ย่อ</span></label><input type="checkbox" id="st-pr-indent-h"></div>
      <div class="k-row"><label>จัดหน้าเริ่มต้น</label><select id="st-pr-align" class="k-dlg-select"><option value="left">ชิดซ้าย</option><option value="justify">เต็มบรรทัด</option></select></div>
      <div class="k-set-sub k-full">หัวข้อ (h1–h6)</div>
      <div class="k-row"><label>ฟอนต์หัวข้อ<span class="k-hint">ว่าง = เหมือนเนื้อเรื่อง</span></label><select id="st-pr-hfont" class="k-dlg-select" style="width:100%"></select></div>
      <div class="k-row"><label>สีหัวข้อ<span class="k-hint">ว่าง = ใช้สีของธีม</span></label><input type="text" id="st-pr-hcolor" class="k-narrow" placeholder="#c8792f"></div>
      <div class="k-full"><table class="k-sp-cycle-tbl" id="st-pr-heads">
        <thead><tr><th>ระดับ</th><th>ขนาด (เท่า)</th><th>หนา</th><th>เอียง</th><th>เว้นก่อน (em)</th><th>เว้นหลัง (em)</th><th>จัดหน้า</th></tr></thead>
        <tbody></tbody></table></div>
      <div class="k-row"><label>เติมเลขบทอัตโนมัติ<span class="k-hint">วาดด้วย CSS — ไม่เขียนตัวเลขลงไฟล์</span></label><input type="checkbox" id="st-pr-hnum"></div>
      <div class="k-row"><label>รูปแบบเลขบท<span class="k-hint">ใช้ {n}</span></label><input type="text" id="st-pr-hnumfmt"></div>
      <div class="k-row"><label>ใส่เลขให้หัวข้อระดับ</label><input type="number" id="st-pr-hnumlv" class="k-narrow" min="1" max="6"></div>
      <div class="k-set-sub k-full">ยกคำพูด (Blockquote)</div>
      <div class="k-row"><label>ตัวเอียง</label><input type="checkbox" id="st-pr-qi"></div>
      <div class="k-row"><label>มีเส้นขอบซ้าย</label><input type="checkbox" id="st-pr-qb"></div>
      <div class="k-row"><label>ระยะเยื้อง (นิ้ว)</label><input type="number" id="st-pr-qind" class="k-narrow" min="0" max="3" step="0.05"></div>
      <div class="k-row"><label>สีตัวอักษร<span class="k-hint">ว่าง = ใช้สีของธีม</span></label><input type="text" id="st-pr-qcolor" class="k-narrow" placeholder="#c8792f"></div>
      <div class="k-set-sub k-full">เลขหน้า (มุมมองหน้ากระดาษของนิยาย)</div>
      <div class="k-row"><label>แสดงเลขหน้า</label><input type="checkbox" id="st-pr-pgnum"></div>
      <div class="k-row"><label>ใส่เลขบนหน้าแรกด้วย</label><input type="checkbox" id="st-pr-pgfirst"></div>
      <div class="k-hint k-full" id="st-pr-info" style="margin-top:8px"></div>
      <div class="k-full" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap">
        <button id="st-pr-preset-novel" class="k-key-btn">📖 ตั้งเป็นแบบนิยายมาตรฐาน</button>
        <button id="st-pr-preset-ms" class="k-key-btn">📄 ต้นฉบับส่งสำนักพิมพ์ (เว้นบรรทัดคู่)</button>
        <button id="st-pr-reset" class="k-reset-btn">↺ คืนค่าเริ่มต้น</button>
      </div>
    </div>
    <div class="k-set-page" data-p="spfmt">
      <div class="k-hint" style="margin-bottom:10px">[81][82][83] ระยะเยื้อง (วัดจากขอบกระดาษ) · ความกว้าง · ระยะเว้นบรรทัด (10 = 1 บรรทัด) · ตัวอักษรบนจอ / ตอนพิมพ์</div>
      <div class="k-spfmt-scroll">
        <table class="k-spfmt-tbl" id="st-spfmt">
          <thead><tr>
            <th rowspan="2">Element</th><th rowspan="2">เยื้อง"</th><th rowspan="2">กว้าง"</th>
            <th rowspan="2">เว้นก่อน</th><th rowspan="2">ระยะบรรทัด</th>
            <th colspan="4">บนจอ</th><th colspan="4">ตอนพิมพ์</th>
          </tr><tr>
            <th>ใหญ่</th><th>หนา</th><th>เอียง</th><th>ขีด</th>
            <th>ใหญ่</th><th>หนา</th><th>เอียง</th><th>ขีด</th>
          </tr></thead><tbody></tbody>
        </table>
      </div>
      <div style="margin-top:12px; text-align:right"><button id="st-spfmt-reset" class="k-reset-btn">↺ คืนค่าเริ่มต้น</button></div>
    </div>
    <div class="k-set-page" data-p="sp">
      <div class="k-row"><label>เปิดระบบปุ่มสลับ element<span class="k-hint">ปิด = Enter ขึ้นบรรทัดใหม่ชนิดเดิม · ปุ่มอื่นไม่ทำงาน</span></label><input type="checkbox" id="st-spcycle-on"></div>
      <div class="k-set-sub">ปุ่มที่ใช้ (กด "เปลี่ยน" แล้วกดปุ่มใหม่)</div>
      <div id="st-spkeys"></div>
      <div class="k-hint" style="margin:12px 0">ควบคุมว่าปุ่มแต่ละตัวจะสร้างหรือสลับเป็น element ใด</div>
      <table class="k-sp-cycle-tbl" id="st-spcycle"><thead><tr><th>Element</th><th id="st-hd-enter">Enter →</th><th id="st-hd-tab">Tab →</th><th id="st-hd-stab">Shift+Tab →</th></tr></thead><tbody></tbody></table>
      <div style="margin-top:12px; text-align:right"><button id="st-spcycle-reset" class="k-reset-btn">↺ คืนค่าเริ่มต้น</button></div>
    </div>
    <div class="k-set-page" data-p="fonts">
      <div class="k-hint" style="margin-bottom:10px">
        ฟอนต์บทมาตรฐาน (Courier) ไม่มีอักษรไทย — กำหนดเองได้ว่า "ช่วงอักขระไหน ใช้ฟอนต์อะไร"
        เพิ่มได้ไม่จำกัด · ใช้ได้ทั้งโหมดนิยายและบทภาพยนตร์ · แถวบนสุดมีลำดับก่อน</div>
      <div id="st-fonts-list"></div>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap">
        <button id="st-fonts-add" class="k-key-btn">➕ เพิ่มแถว</button>
        <button id="st-fonts-import" class="k-key-btn">📁 นำเข้าไฟล์ฟอนต์เข้าโปรเจกต์…</button>
        <button id="st-fonts-reset" class="k-reset-btn">↺ คืนค่าเริ่มต้น</button>
      </div>
      <div class="k-hint" id="st-fonts-preview" style="margin-top:14px"></div>
      <div id="st-fonts-sample" style="margin-top:6px; font-size:22px; line-height:1.7"></div>
    </div>
    <div class="k-set-page" data-p="lang">
      <div class="k-row"><label>${t('settings.languageSelect')}</label>
        <select id="st-lang"></select>
      </div>
      <div class="k-hint" style="margin-top:10px">${T`ภาษาอ่านจาก **ชื่อไฟล์** ในโฟลเดอร์ languages — วางไฟล์ \`k2_<รหัสภาษา>.csv\` เพิ่ม (เช่น k2_ja.csv) แล้วเปิดโปรแกรมใหม่ ก็มีภาษานั้นเลย ไม่ต้องติดตั้งอะไร`}</div>
      <div id="st-lang-dirs" class="k-hint" style="margin-top:6px; opacity:.7; font-size:11px"></div>
      <div class="k-dlg-btns" style="justify-content:flex-start; margin-top:12px">
        <button id="st-lang-export" class="cmp-mini">${T`📤 ส่งออกไฟล์แปล (CSV)`}</button>
        <button id="st-lang-folder" class="cmp-mini">${T`📁 เปิดโฟลเดอร์ภาษา`}</button>
        <button id="st-lang-reload" class="cmp-mini">${T`↻ โหลดไฟล์ภาษาใหม่`}</button>
      </div>
    </div>
    <div class="k-set-page" data-p="keys">
      <div class="k-hint" style="margin-bottom:10px">${t('settings.shortcutsHint')}</div>
      <div id="st-keys"></div>
    </div>
    <div class="k-set-page" data-p="netcol">
      <div class="k-hint" style="margin-bottom:10px">สีและการควบคุมของ Story Network — ช่องทั้งหมดสร้างจากนิยามกลาง (network-theme.js) จึงครบทุกสีที่ผังใช้จริงเสมอ</div>
      <div class="k-set-sub k-full">🖱 การควบคุมด้วยเมาส์</div>
      <div class="k-row"><label>ปุ่มหมุนมุมมอง 3D</label><select id="st-net-orbit" class="k-dlg-select"></select></div>
      <div class="k-row"><label>ปุ่มเลื่อนผัง (แพน)</label><select id="st-net-pan" class="k-dlg-select"></select></div>
      <div class="k-hint k-full" id="st-net-hint" style="margin:2px 0 10px"></div>
      <div id="st-netcol-body"></div>
    </div>
    </div>
    <div class="k-dlg-btns"><button class="k-cancel">${t('dialogs.cancel')}</button><button class="k-ok">${t('dialogs.save')}</button></div>`;
  ov.appendChild(box); document.body.appendChild(ov);

  const q = (id) => box.querySelector(id);
  // พรีวิวฟอนต์บทหนังสด ๆ (บั๊ก #2) — ว่าง = ถอด var ทิ้ง ให้ CSS fallback เป็น Courier New
  const applySpFont = (v) => {
    if (v) document.documentElement.style.setProperty('--sp-font', v);
    else document.documentElement.style.removeProperty('--sp-font');
  };

  // โหลดฟอนต์จาก Fonts/ ในโปรเจกต์ (async, โหลดทีหลังไม่บล็อก)
  // ใช้รายการเดียวกันทั้งฟอนต์นิยาย (#st-fontfamily) และฟอนต์บทหนัง (#st-spfontfamily · บั๊ก #2)
  (async () => {
    const fs = q('#st-fontfamily'); if (!fs) return;
    const spFs = q('#st-spfontfamily');
    const builtin = [
      { name: T`ค่าเริ่มต้น (Courier Prime 12pt)`, value: '' },
      { name: T`Courier Prime (ฝังมากับโปรแกรม)`, value: DEFAULT_SCRIPT_FONT },
      { name: T`Courier Thai Mono (ไทย · ฝังมากับโปรแกรม)`, value: '"Courier Thai Mono", "Courier Prime", monospace' },
      { name: T`Courier Thai Proportional (ไทย · ฝังมากับโปรแกรม)`, value: '"Courier Thai Proportional", "Courier Prime", monospace' },
      // [alpha.60r3a] ฟอนต์ระบบที่วางวรรณยุกต์ไทยได้ถูกต้อง — แจกมากับโปรแกรมไม่ได้ แต่ถ้าเครื่องมีก็ใช้ได้เลย
      { name: T`Ayuthaya (macOS · วรรณยุกต์ไม่ลอย)`, value: 'Ayuthaya, "Leelawadee UI", sans-serif' },
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
          builtin.push({ name: name + T` (โปรเจกต์)`, value: '"' + name + '", sans-serif' });
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
        opt.textContent = f.value === '' ? T`ค่าเริ่มต้นบทหนัง (Courier Prime 12pt)` : f.name;
        if (f.value === (origSpFontFamily || '')) opt.selected = true;
        spFs.appendChild(opt);
      }
      // เห็นผลทันทีระหว่างเลือก (ยกเลิก = คืนค่าเดิม)
      // ตั้ง --sp-font ตรง ๆ ไม่เรียก applySettings() — ไม่งั้นจะไปรีเซ็ตพรีวิวขนาดฟอนต์ที่กำลังเลื่อนอยู่
      spFs.onchange = () => applySpFont(spFs.value);
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
  const origEdPt = s.edFontPt ?? 12, origSpPt = s.spFontPt ?? 12;
  const previewPt = () => {
    s.edFontPt = parseFloat(q('#st-edpt').value) || 12;
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
    { name: T`ค่าเริ่มต้นนิยาย (ตัวพิมพ์สัดส่วน)`, value: '' },
    { name: 'Sarabun', value: '"Sarabun", sans-serif' },
    { name: 'TH Sarabun New', value: '"TH Sarabun New", sans-serif' },
    { name: T`Ayuthaya (macOS · วรรณยุกต์ไม่ลอย)`, value: 'Ayuthaya, "Leelawadee UI", sans-serif' },
    { name: 'Noto Serif Thai', value: '"Noto Serif Thai", serif' },
    { name: 'Noto Sans Thai', value: '"Noto Sans Thai", sans-serif' },
    { name: 'Leelawadee UI', value: '"Leelawadee UI", sans-serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Times New Roman', value: '"Times New Roman", serif' },
    { name: 'Segoe UI', value: '"Segoe UI", system-ui, sans-serif' },
    { name: T`Courier Prime (แบบบทภาพยนตร์)`, value: DEFAULT_SCRIPT_FONT },
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
  fillFontSel(q('#st-pr-font'), P.fontFamily);
  fillFontSel(q('#st-pr-hfont'), P.headingFont);
  q('#st-pr-pt').value = P.fontPt;
  q('#st-pr-lh').value = P.lineHeight;
  q('#st-pr-para').value = P.paraSpacing;
  q('#st-pr-indent').value = P.firstLineIndent;
  q('#st-pr-indent-h').checked = !!P.indentAfterHeading;
  q('#st-pr-align').value = P.align;
  q('#st-pr-hcolor').value = P.headingColor || '';
  q('#st-pr-hnum').checked = !!P.headingNumber;
  q('#st-pr-hnumfmt').value = P.headingNumberFormat || T`บทที่ {n}`;
  q('#st-pr-hnumlv').value = P.headingNumberLevel;
  q('#st-pr-qi').checked = !!P.quote.italic;
  q('#st-pr-qb').checked = !!P.quote.border;
  q('#st-pr-qind').value = P.quote.indent;
  q('#st-pr-qcolor').value = P.quote.color || '';
  q('#st-pr-pgnum').checked = !!P.pageNumbers;
  q('#st-pr-pgfirst').checked = !!P.pageNumberFirst;

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
      for (const [v, lb] of [['', T`ตามเนื้อเรื่อง`], ['left', T`ชิดซ้าย`], ['center', T`กึ่งกลาง`], ['right', T`ชิดขวา`]]) {
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
    P.fontFamily = q('#st-pr-font').value || '';
    P.fontPt = parseFloat(q('#st-pr-pt').value) || 12;
    P.lineHeight = parseFloat(q('#st-pr-lh').value) || 1.75;
    P.paraSpacing = parseFloat(q('#st-pr-para').value) || 0;
    P.firstLineIndent = parseFloat(q('#st-pr-indent').value) || 0;
    P.indentAfterHeading = q('#st-pr-indent-h').checked;
    P.align = q('#st-pr-align').value;
    P.headingFont = q('#st-pr-hfont').value || '';
    P.headingColor = q('#st-pr-hcolor').value.trim();
    P.headingNumber = q('#st-pr-hnum').checked;
    P.headingNumberFormat = q('#st-pr-hnumfmt').value || T`บทที่ {n}`;
    P.headingNumberLevel = parseInt(q('#st-pr-hnumlv').value, 10) || 1;
    P.quote.italic = q('#st-pr-qi').checked;
    P.quote.border = q('#st-pr-qb').checked;
    P.quote.indent = parseFloat(q('#st-pr-qind').value) || 0;
    P.quote.color = q('#st-pr-qcolor').value.trim();
    P.pageNumbers = q('#st-pr-pgnum').checked;
    P.pageNumberFirst = q('#st-pr-pgfirst').checked;
    return P;
  };
  const previewProse = () => {
    const f = mergeProseFormat(readProse());
    applyProseVars(f);
    const paper = PAPER_SIZES[W.paperSize] || PAPER_SIZES.letter;
    const pp = W.paperSize === 'custom' ? W.customPaper : paper;
    q('#st-pr-info').textContent =
      T`≈ ${proseLinesPerPage(f, pp, W.margins)} บรรทัด/หน้า · ` +
      T`≈ ${proseCharsPerLine(f, pp, W.margins)} ตัวอักษร/บรรทัด (โดยประมาณ)`;
  };
  for (const id of ['#st-pr-font', '#st-pr-pt', '#st-pr-lh', '#st-pr-para', '#st-pr-indent',
                    '#st-pr-indent-h', '#st-pr-align', '#st-pr-hfont', '#st-pr-hcolor',
                    '#st-pr-hnum', '#st-pr-hnumfmt', '#st-pr-hnumlv',
                    '#st-pr-qi', '#st-pr-qb', '#st-pr-qind', '#st-pr-qcolor',
                    '#st-pr-pgnum', '#st-pr-pgfirst']) {
    const n = q(id); if (!n) continue;
    n.oninput = previewProse; n.onchange = previewProse;
  }
  const loadProse = (src) => {
    const f = mergeProseFormat(src);
    Object.assign(P, f);
    P.headings = f.headings.map((h) => ({ ...h }));
    P.quote = { ...f.quote };
    fillFontSel(q('#st-pr-font'), P.fontFamily);
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
    q('#st-pr-pgnum').checked = !!P.pageNumbers; q('#st-pr-pgfirst').checked = !!P.pageNumberFirst;
    renderHeads(); previewProse();
  };
  q('#st-pr-reset').onclick = () => loadProse(null);
  // นิยายมาตรฐาน: ย่อหน้าบรรทัดแรก 0.5" ไม่เว้นบรรทัดระหว่างย่อหน้า
  q('#st-pr-preset-novel').onclick = () =>
    loadProse({ ...PROSE_DEFAULTS, firstLineIndent: 0.5, paraSpacing: 0, lineHeight: 1.6 });
  // ต้นฉบับส่งสำนักพิมพ์: เว้นบรรทัดคู่ ย่อหน้า 0.5" (มาตรฐาน manuscript)
  q('#st-pr-preset-ms').onclick = () =>
    loadProse({ ...PROSE_DEFAULTS, firstLineIndent: 0.5, paraSpacing: 0, lineHeight: 2,
                fontFamily: '"TH Sarabun New", "Times New Roman", serif' });
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
      T`พื้นที่พิมพ์ ${(fmt.paper.width - W.margins.left - W.margins.right).toFixed(2)} × ` +
      T`${(fmt.paper.height - W.margins.top - W.margins.bottom).toFixed(2)} นิ้ว · ` +
      T`${formatLines(fmt)} บรรทัด/หน้า`;
  };
  paperSel.onchange = () => { W.paperSize = paperSel.value; pageInfo(); previewPage(); };
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
  mgPreset.append(el('option', '', T`— ตั้งเอง (Custom) —`));
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
  chk('#st-pn-show', () => W.pageNumbers.show, (v) => { W.pageNumbers.show = v; });
  chk('#st-pn-first', () => W.pageNumbers.firstPage, (v) => { W.pageNumbers.firstPage = v; });
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
                   spLineHeight: s.spLineHeight, spPageGap: s.spPageGap };
    Object.assign(s, { paperSize: W.paperSize, customPaper: W.customPaper, pageMargins: W.margins,
                       spElements: W.elements, spStyles: W.styles,
                       spSceneNumbers: W.sceneNumbers, spPageNumbers: W.pageNumbers,
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
    for (const side of ['top', 'bottom', 'left', 'right']) q('#st-mg-' + side).value = W.margins[side];
    q('#st-paper-w').value = W.customPaper.width; q('#st-paper-h').value = W.customPaper.height;
    for (const sel of Object.keys(RULE_MAP)) q(sel).value = W.rules[RULE_MAP[sel]];
    for (const sel of Object.keys(STR_MAP)) q(sel).value = W.strings[STR_MAP[sel]];
    pageInfo(); previewPage();
  };

  // ---- [แก้ไข feature 1] ปุ่มสลับ element ตั้งเองได้ + สวิตช์เปิด/ปิด ----
  q('#st-spcycle-on').checked = W.cycleOn;
  q('#st-spcycle-on').onchange = () => { W.cycleOn = q('#st-spcycle-on').checked; };
  const KEY_LABELS = { enter: T`ไป element ถัดไป (เดิม Enter)`,
                       tab: T`สลับไปข้างหน้า (เดิม Tab)`,
                       shiftTab: T`สลับย้อนกลับ (เดิม Shift+Tab)` };
  function renderSpKeys() {
    const host = q('#st-spkeys'); host.innerHTML = '';
    for (const dir of ['enter', 'tab', 'shiftTab']) {
      const row = el('div', 'k-key-row');
      row.append(el('span', 'k-key-label', KEY_LABELS[dir]));
      const accel = el('span', 'k-key-accel', spKeyLabel(W.keys[dir]));
      row.append(accel);
      const edit = el('button', 'k-key-btn', T`เปลี่ยน`);
      const reset = el('button', 'k-key-btn', '↺');
      reset.title = T`คืนค่าเริ่มต้น`;
      edit.onclick = () => {
        accel.textContent = T`กดปุ่มที่ต้องการ…`; accel.classList.add('rec');
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
    applyLangFonts(W.langFonts, langFontUrl);
    const usable = W.langFonts.filter((r) => r.enabled !== false && (r.builtin || r.file || r.family));
    q('#st-fonts-preview').textContent = usable.length
      ? T`ใช้อยู่ ${usable.length} แถว — ตัวอย่าง (ไทยผสมอังกฤษ):`
      : T`ยังไม่ได้กำหนดแถวไหน — ใช้ฟอนต์ตามค่าในแท็บ "การเขียน"`;
    const sample = q('#st-fonts-sample');
    sample.textContent = T`INT. ห้องนอน — กลางคืน / ที่นี่คือฉากที่หนึ่ง ABC 123`;
    sample.style.fontFamily = `"${LANG_FAMILY}", ` + (q('#st-spfontfamily')?.value || DEFAULT_SCRIPT_FONT);
  };
  function renderFonts() {
    fontsHost.innerHTML = '';
    if (!W.langFonts.length) fontsHost.append(el('div', 'cmp-empty', T`(ยังไม่มีแถว — กด "เพิ่มแถว")`));
    W.langFonts.forEach((row, i) => {
      const r = el('div', 'k-font-row');
      // เปิด/ปิดแถว
      const on = el('input'); on.type = 'checkbox'; on.checked = row.enabled !== false;
      on.title = T`ใช้แถวนี้`;
      on.onchange = () => { row.enabled = on.checked; previewFonts(); };
      r.append(on);
      // ภาษา / ช่วงอักขระ
      const scriptSel = el('select', 'k-dlg-select k-font-script');
      for (const p of SCRIPT_PRESETS) {
        const o = el('option', null, p.label); o.value = p.range; scriptSel.append(o);
      }
      const custom = el('option', null, T`กำหนดช่วงเอง…`); custom.value = '__custom'; scriptSel.append(custom);
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
      addOpt('', T`— ใช้ฟอนต์ที่ลงในเครื่อง (พิมพ์ชื่อ) —`);
      for (const b of BUILTIN_FONT_FILES) addOpt('b:' + b.file, b.label);
      // [alpha.60r3a] ฟอนต์ไทยของระบบ (Ayuthaya ฯลฯ) — ใช้ได้เมื่อเครื่องมีติดตั้งอยู่แล้ว
      for (const f of SYSTEM_THAI_FONTS) addOpt('f:' + f.family, f.label);
      for (const f of projectFonts) addOpt('p:' + f, f + T` (โปรเจกต์)`);
      fontSel.value = row.builtin ? 'b:' + row.builtin : (row.file ? 'p:' + row.file : '');
      const famIn = el('input', 'k-font-family');
      famIn.value = row.family; famIn.placeholder = T`เช่น TH Sarabun New`;
      famIn.style.display = fontSel.value ? 'none' : '';
      fontSel.onchange = () => {
        const v = fontSel.value;
        row.builtin = v.startsWith('b:') ? v.slice(2) : '';
        row.file = v.startsWith('p:') ? v.slice(2) : '';
        famIn.style.display = v ? 'none' : '';
        previewFonts();
      };
      famIn.oninput = () => { row.family = famIn.value; previewFonts(); };
      r.append(fontSel, famIn);
      // ลำดับ + ลบ
      const up = el('button', 'k-key-btn', '↑'); up.title = T`เลื่อนขึ้น`;
      up.onclick = () => { if (i > 0) { const [x] = W.langFonts.splice(i, 1); W.langFonts.splice(i - 1, 0, x); renderFonts(); previewFonts(); } };
      const del = el('button', 'k-danger-btn', '✕');
      del.onclick = () => { W.langFonts.splice(i, 1); renderFonts(); previewFonts(); };
      r.append(up, del);
      fontsHost.append(r);
    });
    previewFonts();
  }
  q('#st-fonts-add').onclick = () => {
    W.langFonts.push({ id: 'f' + W.langFonts.length, label: T`ไทย`, range: 'U+0E00-0E7F',
                       builtin: 'CourierThaiMono.ttf', file: '', family: '', enabled: true });
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
      W.langFonts.push({ id: 'f' + W.langFonts.length, label: '', range: '',
                         builtin: '', file: name, family: '', enabled: true });
      renderFonts();
      setStatus(T`นำเข้าฟอนต์ ` + name + T` แล้ว — เลือกช่วงอักขระที่จะใช้`);
    } catch (e) { log('error', T`นำเข้าฟอนต์ล้มเหลว`, e); setStatus(T`นำเข้าฟอนต์ไม่สำเร็จ`); }
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
      if (box) box.textContent = T`ที่ค้นหาไฟล์ภาษา: ` + (dirs || []).join('  ·  ');
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
      else setStatus(T`ยังไม่มีโฟลเดอร์ภาษา — กด "ส่งออกไฟล์แปล" เพื่อสร้างไฟล์ตั้งต้นก่อน`);
    } catch (e) { log('warn', T`เปิดโฟลเดอร์ภาษาไม่ได้`, e); }
  };
  if (q('#st-lang-reload')) q('#st-lang-reload').onclick = async () => {
    try { await kapi.langReload(); } catch {}          // main แคชเนื้อไฟล์ไว้ — ต้องบอกให้ทิ้งก่อน
    await loadLanguage(q('#st-lang').value || i18n.lang, state.root);
    await fillLangs(); setStatus(T`โหลดไฟล์ภาษาใหม่แล้ว`);
  };
  if (q('#st-lang-export')) q('#st-lang-export').onclick = () => exportLangCsv();
  const origLang = i18n.lang;
  const origLn = !!s.lineNumbers, origSpell = s.spellCheck !== false,
        origSpellDict = s.spellCheckDict !== false, origMention = s.autoMention !== false;
  q('#st-ln').onchange = () => document.body.classList.toggle('k-ln', q('#st-ln').checked);
  q('#st-spell').onchange = () => { s.spellCheck = q('#st-spell').checked; applySpellcheck(); };
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
  };
  box.querySelectorAll('.k-set-tab').forEach((tabEl) => tabEl.onclick = () => gotoTab(tabEl.dataset.p));
  if (openTab) gotoTab(openTab);      // เปิดตรงแท็บที่ผู้เรียกระบุ (ex. เมนู "ข้อมูลผลงาน")
  q('#st-font').oninput = () => applyZoomVars(parseInt(q('#st-font').value, 10) || 0);

  const close = () => ov.remove();
  const cancel = () => {
    s.edFontPt = origEdPt; s.spFontPt = origSpPt;
    s.prose = Object.keys(origProse).length ? origProse : null;   // คืนรูปแบบนิยายที่บันทึกไว้จริง
    applyProseVars(proseFormat());
    applyZoomVars(origFont);
    applyPageVars();                       // คืนรูปแบบหน้ากระดาษ/บทตามค่าที่บันทึกไว้จริง
    applyUIScale(origUiScale);
    s.spFontFamily = origSpFontFamily; applySpFont(origSpFontFamily);
    setTypeVolume(origSnd.vol);
    applyProjectLangFonts();               // คืน @font-face ตามภาษาที่บันทึกไว้จริง
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
    // ขนาดฟอนต์เป็นพอยต์ + ขนาดการ์ดหน้าแรก
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
    s.spLineHeight = W.spLineHeight;              // [alpha.58r บั๊ก 5]
    s.spPageGap = W.spPageGap;
    s.typeSound = q('#st-typesnd').checked;
    s.typeSoundMode = q('#st-typesnd-mode').value === 'typewriter' ? 'typewriter' : 'always';
    s.typeSoundAlways = s.typeSoundMode === 'always';   // คีย์เก่า — ให้รุ่นก่อนอ่านต่อได้
    s.typeSoundVolume = Math.min(1, Math.max(0, parseFloat(q('#st-typesnd-vol').value) || 0));
    s.langFonts = JSON.parse(JSON.stringify(W.langFonts));
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
          'homeThumb','smartLearnMin','heavyDocBlocks','mdAlignStyle','shortcuts','showHomeOnStartup'];
        const globals = {};
        for (const k of globalKeys) { if (k in s) globals[k] = s[k]; }
        await kapi.writeGlobalSettings(globals);
      } catch (e) { log('warn', T`บันทึก global settings ไม่สำเร็จ`, e); }
      applySettings();
      try { updatePageNumberHint(); refreshSpView(); } catch {}
      // [alpha.63r4] สี Story Network ที่เพิ่งตั้ง ต้องเห็นผลทันที ไม่ต้องปิด-เปิดแอป
      try { const { refreshNetwork } = await import('./app.js'); refreshNetwork(); } catch {}
      state.title = m.title;
      document.title = m.title + ' — Killian 2';
      $('#projname').textContent = m.title;
      $('#tb-title').textContent = m.title + ' — Killian 2';
      // แดชบอร์ดเป็นแผงแล้ว (refreshDashboardIfOpen เมื่อมี export)
    } catch (e) { log('error', T`บันทึกการตั้งค่าล้มเหลว`, e); }
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
      if (!inTest && await confirmBox(T`เปลี่ยนภาษาแล้ว — เริ่มโปรแกรมใหม่เพื่อให้เปลี่ยนครบทุกจุดไหม`, T`เริ่มใหม่`)) {
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
  const code = target || (await ask(T`ส่งออกตารางแปลของภาษาไหน (รหัสภาษา เช่น en, ja)`,
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
  if (out) setStatus(T`ส่งออกตารางแปล ${rows.length - 1} แถว → ${out}`);
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
      const bSplit = el('button', null, T`⇋ เทียบด้านขวา`); bSplit.title = T`เปิดเวอร์ชันนี้คู่กับไฟล์ปัจจุบัน`;
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
  log('info', T`เปิดตัวดู log`);
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
