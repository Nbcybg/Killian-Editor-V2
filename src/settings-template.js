// settings-template.js — โครง HTML ของกล่องตั้งค่า (สร้างจากไฟล์ภาษาเดิมด้วยโคดมอด alpha.154)
//
// ══ ทำไมอยู่ในโค้ด ไม่ใช่ในไฟล์ภาษา ══
// ผู้ใช้: *"ย้าย HTML ในกล่องตั้งค่าออกจาก CSV"* · กฎ alpha.154: ข้อความอยู่ `languages/` · โครงอยู่โค้ด
// ตั้งแต่ alpha.79 ทั้งกล่อง (26KB · แท็ก 500+ ตัว) เป็นค่าเดียวในไฟล์ภาษา — คนแปลต้องแปลผ่านแท็ก HTML
// ฝั่งอังกฤษจึงยังเป็นไทยเกือบทั้งก้อน · เพิ่มช่องทีไรต้องแก้แถว CSV ยาวเหยียดทุกไฟล์ภาษา
//
// ตอนนี้: โครงอยู่ที่นี่ที่เดียว · ข้อความทุกชิ้นเป็นคีย์ `ui.setTpl.*` ของตัวเอง (ข้อความล้วน ไม่มีแท็ก)
// · ค่าจากไฟล์ภาษาผ่าน `e()` ก่อนลง HTML เสมอ (ไฟล์ภาษาจึงเขียน " < & ได้ตรง ๆ)
// · `a[0]..a[43]` = ค่าที่ dialogs.js ส่งมา (ข้อความจากคีย์เดิม + ไอคอน) — วางตามเดิมไม่ escape
// · ห้ามเขียนข้อความไทย/อังกฤษลงที่นี่ — เพิ่มข้อความใหม่ = เพิ่มคีย์ในไฟล์ภาษาทุกไฟล์
//
// ══ [alpha.162 · W3] ★ จัดหมวดใหม่ + ป้ายขอบเขตทุกหน้า ══
// เดิมรายการด้านซ้ายแบ่งสองกลุ่มตาม "ขอบเขต" (ระดับผู้ใช้ / เฉพาะผลงาน) — แต่ **หัวกลุ่มโกหก**:
// หน้า "ทั่วไป" มีชื่อเรื่อง/ผู้แต่ง/เป้าหมายคำ/ประวัติ (ของผลงาน) · หน้า "หน้ากระดาษ" มีสีกระดาษ/
// เส้นบอกระยะขอบ (ของผู้ใช้) · ผู้ใช้จึงเดาไม่ได้เลยว่าค่าไหนจะตามไปโปรเจกต์อื่น
// ตอนนี้: จัด 5 หมวดตาม **งานที่จะทำ** · ย้ายแถวให้ทุกหน้ามีขอบเขตเดียว · แล้วติดป้ายบอกขอบเขต
// ไว้หัวหน้าทุกหน้า (`data-scope` = แหล่งความจริงที่เทสเทียบกับ GLOBAL_DEFAULTS/PROJECT_DEFAULTS)
// [alpha.164 ข้อ C] จัดหน้าอีกรอบ (ขอบเขตแต่ละหน้าคงเดิมทุกช่อง):
//   ทั่วไป = ธีม · การเปิดโปรแกรม (ตัวเลือกเดียวแทนสวิตช์สองตัวที่ขัดกัน) · การ์ดหน้าแรก · ขนาดเปลือก (สองช่องอยู่ด้วยกัน)
//   บันทึกและสำรอง = หน้าใหม่ (บันทึกอัตโนมัติ · เวอร์ชัน · ถังขยะ ที่เคยปนอยู่หน้าทั่วไป/การเขียน)
//   สวิตช์ FAB → หน้าปุ่มลอย · ปุ่มบทหนัง → กลุ่มแถบและปุ่ม · ช่วงบรรทัด/ปรับหน้าอัตโนมัติของบท → หน้ารูปแบบบท
import { tx } from './i18n-html.js';
import { gi } from './icons.js';   // [alpha.162 · W6 ข้อ 1] ไอคอนจากทะเบียน


/** จำนวนค่าที่ต้องส่งเข้า `settingsTemplate` */
export const SETTINGS_TEMPLATE_ARGS = 44;

/** ป้ายบอกขอบเขตของหน้า — `global` = ตามผู้ใช้ไปทุกผลงาน · `project` = เก็บในไฟล์ผลงานนี้ */
const scope = (kind) => `<div class="k-set-scope k-full" data-scope="${kind}">`
  + `<span class="k-set-scope-ic" data-icon="${kind === 'global' ? 'globe' : 'folder'}" data-icon-size="12"></span>`
  + `${kind === 'global' ? tx('ui.setTpl.scopeGlobal') : tx('ui.setTpl.scopeProject')}</div>`;

/**
 * HTML ของกล่องตั้งค่าทั้งกล่องตามภาษาที่โหลดอยู่
 * @param {Array<string>} a ค่าที่แทรก 44 ค่า (ลำดับเดียวกับที่ dialogs.js ส่ง)
 */
export function settingsTemplate(a = []) {
  return `<div class="k-dlg-title">${a[0]}</div>
<div class="k-set-wrap">
  <div class="k-set-nav">
    <input id="st-nav-q" class="k-set-navq" type="search" placeholder="${tx('ui.setTpl.searchHeadingSettingsPh')}">
    <div class="k-set-navgrp"><span class="k-set-navgrp-ic" data-icon="cog" data-icon-size="14"></span> ${tx('ui.setTpl.grpGeneral')} <span class="k-set-navgrp-sub">${tx('ui.setTpl.grpGeneralSub')}</span></div>
    <div class="k-set-tab on" data-p="gen" data-find="${tx('ui.setTpl.nameAuthorSaveAutoFind')}">${a[1]}</div>
    <div class="k-set-tab" data-p="write" data-find="${tx('ui.setTpl.writeFontSizeCheckFind')}">${a[2]}</div>
    <div class="k-set-tab" data-p="save" data-find="${tx('ui.setTpl.tabSaveFind')}">${tx('ui.setTpl.tabSave')}</div>
    <div class="k-set-tab" data-p="lang" data-find="${tx('ui.setTpl.langLanguageCsvFind')}">${a[4]}</div>
    <div class="k-set-navgrp"><span class="k-set-navgrp-ic" data-icon="layout" data-icon-size="14"></span> ${tx('ui.setTpl.grpBars')} <span class="k-set-navgrp-sub">${tx('ui.setTpl.grpBarsSub')}</span></div>
    <div class="k-set-tab" data-p="toolbar" data-find="${tx('ui.setTpl.barToolBtnBtnFind')}">${tx('ui.setTpl.barTool')}</div>
    <div class="k-set-tab" data-p="fmtbar" data-find="${tx('ui.setTpl.barFormatFloatBtnFind')}">${tx('ui.setTpl.barFormatFloat')}</div>
    <div class="k-set-tab" data-p="fab" data-find="${tx('ui.setTpl.btnFloatFabCmdFind')}">${tx('ui.setTpl.btnFloatFAB')}</div>
    <div class="k-set-tab" data-p="keys" data-find="${tx('ui.setTpl.btnKeyShortcutFind')}">${a[5]}</div>
    <div class="k-set-tab" data-p="sp" data-find="${tx('ui.setTpl.btnChapterFilmTabFind')}">${tx('ui.setTpl.btnChapterFilm')}</div>
    <div class="k-set-navgrp"><span class="k-set-navgrp-ic" data-icon="brain" data-icon-size="14"></span> ${tx('ui.setTpl.grpAuto')} <span class="k-set-navgrp-sub">${tx('ui.setTpl.grpAutoSub')}</span></div>
    <div class="k-set-tab" data-p="ai" data-find="${tx('ui.setTpl.tabAiFind')}">${tx('ui.setTpl.tabAi')}</div>
    <div class="k-set-tab" data-p="auto" data-find="${tx('ui.setTpl.autoCountPageUpdateFind')}">${a[3]}</div>
    <div class="k-set-navgrp"><span class="k-set-navgrp-ic" data-icon="file" data-icon-size="14"></span> ${tx('ui.setTpl.grpDoc')} <span class="k-set-navgrp-sub">${tx('ui.setTpl.grpDocSub')}</span></div>
    <div class="k-set-tab" data-p="page" data-find="${tx('ui.setTpl.pagePaperSizeGapFind')}">${tx('ui.setTpl.pagePaper')}</div>
    <div class="k-set-tab" data-p="prose" data-find="${tx('ui.setTpl.formatNovelParaRangeFind')}">${tx('ui.setTpl.formatNovel')}</div>
    <div class="k-set-tab" data-p="spfmt" data-find="${tx('ui.setTpl.formatChapterElementWideFind')}">${tx('ui.setTpl.formatChapter')}</div>
    <div class="k-set-tab" data-p="pagenum" data-find="${tx('ui.setTpl.tabPageNumFind')}">${tx('ui.setTpl.tabPageNum')}</div>
    <div class="k-set-tab" data-p="fonts" data-find="${tx('ui.setTpl.fontLangRangeCharFind')}">${tx('ui.setTpl.fontLang')}</div>
    <div class="k-set-navgrp"><span class="k-set-navgrp-ic" data-icon="folder" data-icon-size="14"></span> ${tx('ui.setTpl.grpProject')} <span class="k-set-navgrp-sub">${tx('ui.setTpl.grpProjectSub')}</span></div>
    <div class="k-set-tab" data-p="setup" data-find="${tx('ui.setTpl.dataResultTaskAuthorFind')}">${tx('ui.setTpl.dataResultTask')}</div>
    <div class="k-set-tab" data-p="nav" data-find="${tx('ui.nav.setFind')}">${tx('ui.nav.setTitle')}</div>
    <div class="k-set-tab" data-p="netcol" data-find="${tx('ui.setTpl.storyNetworkColorBtnFind')}">${tx('ui.setTpl.storyNetwork')}</div>
  </div>
  <div class="k-set-main">
    <div class="k-set-page" data-p="fmtbar">
      ${scope('global')}
      <div id="st-fmtbar-host"></div>
    </div>

    <div class="k-set-page" data-p="fab">
      ${scope('global')}
      <div class="k-row"><label>${tx('ui.setTpl.btnFloatCornerRight')}<span class="k-hint">${tx('ui.setTpl.r2ItemCloseDone')}</span></label><input type="checkbox" id="st-fab"></div>
      <div id="st-fab-host"></div>
    </div>

    <div class="k-set-page" data-p="toolbar">
      ${scope('global')}
      <div class="k-hint" style="margin-bottom:10px">${tx('ui.setTpl.pickBtnResultTop')}</div>
      <div id="st-toolbar-host"></div>
    </div>

    <div class="k-set-page k-set-2col on" data-p="gen">
      ${scope('global')}
      <div class="k-row"><label>${tx('ui.setTpl.themeColor')}<span class="k-hint">${tx('ui.setTpl.colorAppBarPanel')}</span></label><select id="st-theme" class="k-dlg-select" style="width:100%"></select></div>
      <div class="k-row"><label>${tx('ui.setTpl.startup')}<span class="k-hint">${tx('ui.setTpl.startupHint')}</span></label><select id="st-startup" class="k-dlg-select" style="width:100%">
        <option value="home">${tx('ui.setTpl.startupHome')}</option><option value="last">${tx('ui.setTpl.startupLast')}</option><option value="lastHome">${tx('ui.setTpl.startupLastHome')}</option></select></div>
      <div class="k-row"><label>${tx('ui.setTpl.sizeCardPageFirst')}<span class="k-hint">${tx('ui.setTpl.wideCardTopPage')}</span></label><input type="number" id="st-homethumb" class="k-narrow" min="120" max="400" step="10"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.subShellSize')}</div>
      <div class="k-row"><label>${a[31]}<span class="k-hint">${a[32]}</span></label><input type="range" id="st-uiscale" min="0.75" max="2" step="0.05"><span id="st-uiscale-lbl" class="k-hint"></span></div>
      <div class="k-row"><label>${tx('ui.setTpl.sizeCharUI')}<span class="k-hint">${tx('ui.setTpl.adjustDefaultPxHas')}</span></label><input type="number" id="st-font" min="-6" max="16" step="1"></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="save">
      ${scope('global')}
      <div class="k-row"><label>${a[8]}<span class="k-hint">${a[9]}</span></label><input type="number" id="st-auto" min="0" max="120"></div>
      <div class="k-row"><label>${a[10]}</label><input type="checkbox" id="st-backup"></div>
      <div class="k-row"><label>${a[11]}<span class="k-hint">${a[12]}</span></label><input type="number" id="st-maxbak" min="1" max="200"></div>
      <div class="k-row"><label>${a[27]}<span class="k-hint">${a[28]}</span></label><input type="number" id="st-recycle" min="0" max="3650"></div>
      <div class="k-hint k-full" style="margin-top:8px">${tx('ui.setTpl.saveHistNote')}</div>
    </div>
    <div class="k-set-page k-set-2col" data-p="write">
      ${scope('global')}
      <div class="k-row"><label>${a[15]}<span class="k-hint">${a[16]}</span></label><div class="k-font-field"><select id="st-fontfamily" class="k-dlg-select" style="width:100%"></select></div></div>
      <div class="k-row"><label>${a[17]}<span class="k-hint">${a[18]}</span></label><div class="k-font-field"><select id="st-spfontfamily" class="k-dlg-select" style="width:100%"></select></div></div>
      <div class="k-row"><label>${a[19]}<span class="k-hint">${a[20]}</span></label><input type="checkbox" id="st-ln"></div>
      <div class="k-row"><label>${a[21]}<span class="k-hint">${a[22]}</span></label><input type="checkbox" id="st-spell"></div>
      <div class="k-row"><label>${a[23]}<span class="k-hint">${a[24]}</span></label><input type="checkbox" id="st-spelldict"></div>
      <div class="k-row"><label>${a[25]}<span class="k-hint">${a[26]}</span></label><input type="checkbox" id="st-mention"></div>
      <div class="k-row"><label>${a[29]}<span class="k-hint">${a[30]}</span></label><input type="range" id="st-fmdim" min="0.05" max="0.8" step="0.05"><span id="st-fmdim-lbl" class="k-hint"></span></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.colorPaper')}</div>
      <div class="k-hint k-full" style="margin-bottom:8px">${tx('ui.setTpl.colorPaperTopScreen')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.reset')}</label><select id="st-paper-color" class="k-dlg-select"></select></div>
      <div class="k-row"><label>${tx('ui.setTpl.pickColor')}<span class="k-hint">${tx('ui.setTpl.colorMarginLineColor')}</span></label><input type="color" id="st-paper-color-hex" class="k-narrow"></div>
      <div class="k-row"><label>${tx('ui.setTpl.lineGapMarginPaper')}<span class="k-hint">${tx('ui.setTpl.lineRoundAreaPrint')}</span></label><input type="checkbox" id="st-page-guides"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.soundTypewriter')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.openSoundPrint')}<span class="k-hint">${tx('ui.setTpl.delActLine')}</span></label><input type="checkbox" id="st-typesnd"></div>
      <div class="k-row"><label>${tx('ui.setTpl.play')}<span class="k-hint">${tx('ui.setTpl.r2ItemDefaultPrev')}</span></label><select id="st-typesnd-mode" class="k-dlg-select"><option value="always">${tx('ui.setTpl.timePrint')}</option><option value="typewriter">${tx('ui.setTpl.onlyModeTypewriterSc')}</option></select></div>
      <div class="k-row"><label>${tx('ui.setTpl.levelSound')}</label><input type="range" id="st-typesnd-vol" min="0" max="1" step="0.05"><span id="st-typesnd-lbl" class="k-hint"></span></div>
      <div class="k-row"><label>${tx('ui.setTpl.try')}</label><span><button id="st-typesnd-test" class="k-key-btn">${tx('ui.setTpl.text1')}</button> <button id="st-typesnd-test2" class="k-key-btn">${tx('ui.setTpl.line')}</button></span></div>
    </div>
    <div class="k-set-page" data-p="ai">
      ${scope('global')}
      <div class="k-hint" style="margin-bottom:10px">${tx('ui.setTpl.aiIntro')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.aiCurrent')}</label><span id="st-ai-current" class="k-hint"></span></div>
      <div class="k-dlg-btns" style="justify-content:flex-start; margin-top:12px">
        <button id="st-ai-open" class="k-ok">${tx('ui.setTpl.aiOpen')}</button>
      </div>
    </div>
    <div class="k-set-page" data-p="auto">
      ${scope('global')}
      <div class="k-row"><label>${a[33]} ${a[34]}<span class="k-hint">${a[35]}</span></label><input type="checkbox" id="st-autosync"></div>
      <div class="k-row"><label>${tx('ui.setTpl.libraryThesaurusWordOpposite')}<span class="k-hint">${tx('ui.setTpl.openDoneSendWord')}</span></label><input type="checkbox" id="st-thesaurus"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.updateApp')}</div>
      <div id="st-update-host"></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="setup">
      ${scope('project')}
      <div id="st-logline-host" class="k-full"></div>
      <div class="k-hint k-full" style="margin-bottom:10px">${tx('ui.setTpl.dataTopCoverChapter')}</div>
      <div class="k-row"><label>${a[6]}</label><input type="text" id="st-title"></div>
      <div class="k-row"><label>${a[7]}</label><input type="text" id="st-author"></div>
      <div class="k-set-sub">${tx('ui.setTpl.author')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.author2')}</label><input type="text" id="st-email"></div>
      <div class="k-row"><label>${tx('ui.setTpl.dataNextContactInformation')}</label><input type="text" id="st-contact"></div>
      <div class="k-row"><label>${tx('ui.setTpl.phone')}</label><input type="text" id="st-phone"></div>
      <div class="k-set-sub">${tx('ui.setTpl.chapter')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.screenplayBy')}</label><input type="text" id="st-spby"></div>
      <div class="k-row"><label>${tx('ui.setTpl.basedOn')}</label><input type="text" id="st-basedon"></div>
      <div class="k-row"><label>${tx('ui.setTpl.revisionsBy')}</label><input type="text" id="st-revby"></div>
      <div class="k-set-sub">${tx('ui.setTpl.itemReplaceAgent')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.agentSName')}</label><input type="text" id="st-agname"></div>
      <div class="k-row"><label>${tx('ui.setTpl.agentSAddress')}</label><input type="text" id="st-agaddr"></div>
      <div class="k-row"><label>${tx('ui.setTpl.agentSPhone')}</label><input type="text" id="st-agphone"></div>
      <div class="k-row"><label>${tx('ui.setTpl.agentSEmail')}</label><input type="text" id="st-agemail"></div>
      <div class="k-set-sub">${tx('ui.setTpl.text2')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.copyrightBy')}</label><input type="text" id="st-copyright"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.subGoals')}</div>
      <div class="k-row"><label>${a[13]}</label><input type="number" id="st-daily" min="0"></div>
      <div class="k-row"><label>${a[14]}</label><input type="number" id="st-proj" min="0"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.historyRunPanelHistory')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.keepHistoryTimes')}<span class="k-hint">${tx('ui.setTpl.moreK2historyDefault')}</span></label><input type="number" id="st-histlimit" min="4" max="500"></div>
      <div class="k-row"><label>${tx('ui.setTpl.closeNoteHistory')}<span class="k-hint">${tx('ui.setTpl.closeDonePanelHistory')}</span></label><input type="checkbox" id="st-histoff"></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="page">
      ${scope('project')}
      <div class="k-hint k-full" style="margin-bottom:10px">${tx('ui.setTpl.sizePaperGapMargin')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.sizePaper')}</label><select id="st-paper" class="k-dlg-select"></select></div>
      <div class="k-row k-full" id="st-paper-custom"><label>${tx('ui.setTpl.wideHighInch')}</label>
        <span><input type="number" id="st-paper-w" class="k-narrow" min="3" max="30" step="0.01">
        ${gi('times')} <input type="number" id="st-paper-h" class="k-narrow" min="3" max="40" step="0.01"></span></div>
      <div class="k-set-sub">${tx('ui.setTpl.gapMarginInch')}</div>
      <div class="k-row k-full"><label>${tx('ui.setTpl.setOkImage')}<span class="k-hint">${tx('ui.setTpl.pickDoneFillValue')}</span></label><select id="st-mg-preset" class="k-dlg-select"></select></div>
      <div class="k-set-grid2">
        <div class="k-row"><label>${tx('ui.setTpl.topTop')}</label><input type="number" id="st-mg-top" class="k-narrow" min="0" max="5" step="0.05"></div>
        <div class="k-row"><label>${tx('ui.setTpl.bottomBottom')}</label><input type="number" id="st-mg-bottom" class="k-narrow" min="0" max="5" step="0.05"></div>
        <div class="k-row"><label>${tx('ui.setTpl.leftLeft')}</label><input type="number" id="st-mg-left" class="k-narrow" min="0" max="5" step="0.05"></div>
        <div class="k-row"><label>${tx('ui.setTpl.rightRight')}</label><input type="number" id="st-mg-right" class="k-narrow" min="0" max="5" step="0.05"></div>
      </div>
      <div class="k-row"><label>${tx('ui.setTpl.fieldEmptyBetweenPage')}</label><input type="number" id="st-sppagegap" class="k-narrow" min="8" max="120" step="2"></div>
      <div class="k-hint k-full" id="st-page-info" style="margin-top:8px"></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="pagenum">
      ${scope('project')}
      <div class="k-set-sub k-full">${tx('ui.setTpl.numSceneSceneNumber')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.showNumSceneHead')}<span class="k-hint">${tx('ui.setTpl.numLeftRightLine')}</span></label><input type="checkbox" id="st-sn-show"></div>
      <div class="k-row"><label>${tx('ui.setTpl.num')}<span class="k-hint">${tx('ui.setTpl.egEmpty')}</span></label><input type="text" id="st-sn-suffix" class="k-narrow"></div>
      <div class="k-row"><label>${tx('ui.setTpl.leftGapMarginPaper')}</label><input type="number" id="st-sn-left" class="k-narrow" min="0" max="5" step="0.05"></div>
      <div class="k-row"><label>${tx('ui.setTpl.rightGapMarginPaper')}</label><input type="number" id="st-sn-right" class="k-narrow" min="0" max="5" step="0.05"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.pageNumPageNumber')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.showPageNum')}<span class="k-hint">${tx('ui.setTpl.hasOnlyFileScene')}</span></label><input type="checkbox" id="st-pn-show"></div>
      <div class="k-row"><label>${tx('ui.setTpl.putNumTopPage')}<span class="k-hint">${tx('ui.setTpl.closePageNumNot')}</span></label><input type="checkbox" id="st-pn-first"></div>
      <div class="k-row"><label>${tx('ui.setTpl.gapMarginRightInch')}</label><input type="number" id="st-pn-right" class="k-narrow" min="0" max="5" step="0.05"></div>
      <div class="k-row"><label>${tx('ui.setTpl.gapMarginTopInch')}</label><input type="number" id="st-pn-top" class="k-narrow" min="0" max="5" step="0.05"></div>
      <div class="k-row"><label>${tx('ui.setTpl.num')}</label><input type="text" id="st-pn-suffix" class="k-narrow"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.contCONTINUED')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.putCONTINUEDAuto')}<span class="k-hint">${tx('ui.setTpl.putBlockPageClose')}</span></label><input type="checkbox" id="st-ct-auto"></div>
      <div class="k-row"><label>${tx('ui.setTpl.putPageNotHas')}<span class="k-hint">${tx('ui.setTpl.closePutCONTINUEDOnly')}</span></label><input type="checkbox" id="st-ct-nohead"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.ruleCutPageWidow')}</div>
      <div class="k-set-grid2">
        <div class="k-row"><label>${tx('ui.setTpl.actionPageLess')}</label><input type="number" id="st-pb-ab" class="k-narrow" min="0" max="20"></div>
        <div class="k-row"><label>${tx('ui.setTpl.actionLiftPageNew')}</label><input type="number" id="st-pb-at" class="k-narrow" min="0" max="20"></div>
        <div class="k-row"><label>${tx('ui.setTpl.dialoguePageLess')}</label><input type="number" id="st-pb-db" class="k-narrow" min="0" max="20"></div>
        <div class="k-row"><label>${tx('ui.setTpl.dialogueLiftPageNew')}</label><input type="number" id="st-pb-dt" class="k-narrow" min="0" max="20"></div>
        <div class="k-row"><label>${tx('ui.setTpl.dashLineNot')}</label><input type="number" id="st-pb-hy" class="k-narrow" min="0" max="10"></div>
        <div class="k-row"><label>${tx('ui.setTpl.headScenePageMust')}</label><input type="number" id="st-pb-ks" class="k-narrow" min="0" max="20"></div>
      </div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.checkTopScreen')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.dashLineDotChapter')}<span class="k-hint">${tx('ui.setTpl.lineUnderLineItem')}</span></label><input type="checkbox" id="st-sp-errmark"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.textDefault')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.pageSceneCont')}</label><input type="text" id="st-str-cb"></div>
      <div class="k-row"><label>${tx('ui.setTpl.pageSceneCont2')}</label><input type="text" id="st-str-ct"></div>
      <div class="k-row"><label>${tx('ui.setTpl.dialogueNotEndMORE')}</label><input type="text" id="st-str-more"></div>
      <div class="k-row"><label>${tx('ui.setTpl.nameContD')}</label><input type="text" id="st-str-contd"></div>
      <div class="k-row"><label>${tx('ui.setTpl.headingSceneTimePage')}</label>
        <span><input type="text" id="st-str-scene" style="width:46%"> <input type="text" id="st-str-time" style="width:46%"></span></div>
      <div class="k-full" style="margin-top:12px; text-align:right"><button id="st-page-reset" class="k-reset-btn">${tx('ui.setTpl.restoreDefault')}</button></div>
    </div>
    <div class="k-set-page k-set-2col" data-p="prose">
      ${scope('project')}
      <div class="k-hint k-full" style="margin-bottom:10px">
        ${tx('ui.setTpl.formatBodyStoryNovel')}</div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.bodyStory')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.sizePt')}<span class="k-hint">${tx('ui.setTpl.defaultSourcePtFormat')}</span></label><input type="number" id="st-pr-pt" class="k-narrow" min="6" max="48" step="0.5"></div>
      <div class="k-row"><label>${tx('ui.setTpl.rangeLine')}<span class="k-hint">${tx('ui.setTpl.alignNormalSkipLine')}</span></label><input type="number" id="st-pr-lh" class="k-narrow" min="0.8" max="4" step="0.05"></div>
      <div class="k-row"><label>${tx('ui.setTpl.gapBetweenParaEm')}<span class="k-hint">${tx('ui.setTpl.novelDefaultUsePara')}</span></label><input type="number" id="st-pr-para" class="k-narrow" min="0" max="4" step="0.05"></div>
      <div class="k-row"><label>${tx('ui.setTpl.paraLineFirstInch')}<span class="k-hint">${tx('ui.setTpl.defaultInchNotCollapse')}</span></label><input type="number" id="st-pr-indent" class="k-narrow" min="0" max="3" step="0.05"></div>
      <div class="k-row"><label>${tx('ui.setTpl.paraFirstHeading')}<span class="k-hint">${tx('ui.setTpl.paraFirstChapterNot')}</span></label><input type="checkbox" id="st-pr-indent-h"></div>
      <div class="k-row"><label>${tx('ui.setTpl.tabWidth')}<span class="k-hint">${tx('ui.setTpl.tabWidthHint')}</span></label><span style="display:flex;gap:6px;align-items:center"><input type="number" id="st-pr-tab" class="k-narrow" min="0" max="32" step="0.05"> <select id="st-pr-tabunit" class="k-dlg-select"><option value="space">${tx('ui.setTpl.tabUnitSpace')}</option><option value="in">${tx('ui.setTpl.tabUnitIn')}</option><option value="cm">${tx('ui.setTpl.tabUnitCm')}</option></select></span></div>
      <div class="k-row"><label>${tx('ui.setTpl.arrangePageStart')}</label><select id="st-pr-align" class="k-dlg-select"><option value="left">${tx('ui.setTpl.alignLeft')}</option><option value="justify">${tx('ui.setTpl.fullLine')}</option></select></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.headingH1H6')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.fontHeading')}<span class="k-hint">${tx('ui.setTpl.emptyBodyStory')}</span></label><div class="k-font-field"><select id="st-pr-hfont" class="k-dlg-select" style="width:100%"></select></div></div>
      <div class="k-row"><label>${tx('ui.setTpl.colorHeading')}<span class="k-hint">${tx('ui.setTpl.emptyUseColorTheme')}</span></label><input type="text" id="st-pr-hcolor" class="k-narrow" placeholder="#c8792f"></div>
      <div class="k-full"><table class="k-sp-cycle-tbl" id="st-pr-heads">
        <thead><tr><th>${tx('ui.setTpl.level')}</th><th>${tx('ui.setTpl.size')}</th><th>${tx('ui.setTpl.bold')}</th><th>${tx('ui.setTpl.text3')}</th><th>${tx('ui.setTpl.skipBeforeEm')}</th><th>${tx('ui.setTpl.skipEm')}</th><th>${tx('ui.setTpl.arrangePage')}</th></tr></thead>
        <tbody></tbody></table></div>
      <div class="k-row"><label>${tx('ui.setTpl.fillNumChapterAuto')}<span class="k-hint">${tx('ui.setTpl.drawCSSNotWrite')}</span></label><input type="checkbox" id="st-pr-hnum"></div>
      <div class="k-row"><label>${tx('ui.setTpl.formatNumChapter')}<span class="k-hint">${tx('ui.setTpl.useN')}</span></label><input type="text" id="st-pr-hnumfmt"></div>
      <div class="k-row"><label>${tx('ui.setTpl.putNumHeadingLevel')}</label><input type="number" id="st-pr-hnumlv" class="k-narrow" min="1" max="6"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.liftWordSpeakBlockquote')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.item')}</label><input type="checkbox" id="st-pr-qi"></div>
      <div class="k-row"><label>${tx('ui.setTpl.hasLineMarginLeft')}</label><input type="checkbox" id="st-pr-qb"></div>
      <div class="k-row"><label>${tx('ui.setTpl.gapInch')}</label><input type="number" id="st-pr-qind" class="k-narrow" min="0" max="3" step="0.05"></div>
      <div class="k-row"><label>${tx('ui.setTpl.colorChar')}<span class="k-hint">${tx('ui.setTpl.emptyUseColorTheme')}</span></label><input type="text" id="st-pr-qcolor" class="k-narrow" placeholder="#c8792f"></div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.pageNumViewPagePaper')}</div>
      <div class="k-row k-full"><label>${tx('ui.setTpl.showPageNum')}<span class="k-hint">${tx('ui.setTpl.prosePgNumMoved')}</span></label><button id="st-pr-gopagenum" class="cmp-mini">${tx('ui.setTpl.prosePgNumBtn')}</button></div>
      <div class="k-hint k-full" id="st-pr-info" style="margin-top:8px"></div>
      <div class="k-full" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap">
        <button id="st-pr-preset-novel" class="k-key-btn">${tx('ui.setTpl.setStyleNovelDefault')}</button>
        <button id="st-pr-preset-ms" class="k-key-btn">${tx('ui.setTpl.sourceSendPrintSkip')}</button>
        <button id="st-pr-reset" class="k-reset-btn">${tx('ui.setTpl.restoreDefault')}</button>
      </div>
    </div>
    <div class="k-set-page" data-p="spfmt">
      ${scope('project')}
      <div class="k-hint" style="margin-bottom:10px">${tx('ui.setTpl.gapMarginPaperWide')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.sizeFontScreenplayPt')}<span class="k-hint">${tx('ui.setTpl.defaultChapterPtAll')}</span></label><input type="number" id="st-sppt" class="k-narrow" min="6" max="48" step="0.5"></div>
      <div class="k-row"><label>${tx('ui.setTpl.rangeLineScreenplay')}<span class="k-hint">${tx('ui.setTpl.defaultLineInchChange')}</span></label><input type="number" id="st-splh" class="k-narrow" min="0.8" max="2.5" step="0.05"></div>
      <div class="k-set-sub">${tx('ui.setTpl.adjustPageNewAuto')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.wordCountPageNew')}<span class="k-hint">${tx('ui.setTpl.runRangeTimeSet')}</span></label><input type="checkbox" id="st-autopag"></div>
      <div class="k-row"><label>${tx('ui.setTpl.printMin')}<span class="k-hint">${tx('ui.setTpl.minBeforeWordPage')}</span></label><input type="number" id="st-pagintv" min="1" max="60" step="1" class="k-narrow"></div>
      <div class="k-spfmt-scroll">
        <table class="k-spfmt-tbl" id="st-spfmt">
          <thead><tr>
            <th rowspan="2">${tx('ui.setTpl.element')}</th><th rowspan="2">${tx('ui.setTpl.text4')}</th><th rowspan="2">${tx('ui.setTpl.wide')}</th>
            <th rowspan="2">${tx('ui.setTpl.skipBefore')}</th><th rowspan="2">${tx('ui.setTpl.gapLine')}</th>
            <th colspan="4">${tx('ui.setTpl.topScreen')}</th><th colspan="4">${tx('ui.setTpl.actPrint')}</th>
          </tr><tr>
            <th>${tx('ui.setTpl.big')}</th><th>${tx('ui.setTpl.bold')}</th><th>${tx('ui.setTpl.text3')}</th><th>${tx('ui.setTpl.dash')}</th>
            <th>${tx('ui.setTpl.big')}</th><th>${tx('ui.setTpl.bold')}</th><th>${tx('ui.setTpl.text3')}</th><th>${tx('ui.setTpl.dash')}</th>
          </tr></thead><tbody></tbody>
        </table>
      </div>
      <div style="margin-top:12px; text-align:right"><button id="st-spfmt-reset" class="k-reset-btn">${tx('ui.setTpl.restoreDefault')}</button></div>
    </div>
    <div class="k-set-page" data-p="sp">
      ${scope('project')}
      <div class="k-row"><label>${tx('ui.setTpl.openSystemBtnToggle')}<span class="k-hint">${tx('ui.setTpl.closeEnterLineNew')}</span></label><input type="checkbox" id="st-spcycle-on"></div>
      <div class="k-row"><label>${tx('ui.setTpl.lineDialogueDialogueNext')}<span class="k-hint">${tx('ui.setTpl.closeDefaultFinalDraft')}</span></label><input type="checkbox" id="st-spdlgcont"></div>
      <div class="k-set-sub">${tx('ui.setTpl.btnUsePressChange')}</div>
      <div id="st-spkeys"></div>
      <div class="k-hint" style="margin:12px 0">${tx('ui.setTpl.btnEachItemNew')}</div>
      <table class="k-sp-cycle-tbl" id="st-spcycle"><thead><tr><th>${tx('ui.setTpl.element')}</th><th id="st-hd-enter">${tx('ui.setTpl.enter')}</th><th id="st-hd-tab">${tx('ui.setTpl.tab')}</th><th id="st-hd-stab">${tx('ui.setTpl.shiftTab')}</th></tr></thead><tbody></tbody></table>
      <div style="margin-top:12px; text-align:right"><button id="st-spcycle-reset" class="k-reset-btn">${tx('ui.setTpl.restoreDefault')}</button></div>
    </div>
    <div class="k-set-page" data-p="fonts">
      ${scope('project')}
      <div class="k-hint" style="margin-bottom:10px">
        ${tx('ui.setTpl.tableFontApp')} <b>${tx('ui.setTpl.rangeCharFontUse')}</b>
        ${tx('ui.setTpl.addDelNotRemember')}
        <br><b>${tx('ui.setTpl.field')}</b> ${tx('ui.setTpl.itemCollapseFitDialog')}</div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.fontRangeCharUse')}</div>
      <div id="st-fonts-list"></div>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap">
        <button id="st-fonts-add" class="k-key-btn">${tx('ui.setTpl.addRow')}</button>
        <button id="st-fonts-import" class="k-key-btn">${tx('ui.setTpl.importFileFontIn')}</button>
        <button id="st-fonts-reset" class="k-reset-btn">${tx('ui.setTpl.restoreDefault')}</button>
      </div>
      <div class="k-hint" id="st-fonts-preview" style="margin-top:14px"></div>
      <input type="text" id="st-fonts-sample" class="k-dlg-input k-font-sample k-font-sample-big" placeholder="${tx('ui.dlg.fontSamplePh')}" title="${tx('ui.dlg.fontSampleHint')}">
    </div>
    <div class="k-set-page" data-p="lang">
      ${scope('global')}
      <div class="k-row"><label>${a[36]}</label>
        <select id="st-lang"></select>
      </div>
      <div class="k-hint" style="margin-top:10px">${a[37]}</div>
      <div id="st-lang-dirs" class="k-hint" style="margin-top:6px; opacity:.7; font-size:12px"></div>
      <div class="k-dlg-btns" style="justify-content:flex-start; margin-top:12px">
        <button id="st-lang-export" class="cmp-mini">${a[38]}</button>
        <button id="st-lang-folder" class="cmp-mini">${a[39]}</button>
        <button id="st-lang-reload" class="cmp-mini">${a[40]}</button>
      </div>
    </div>
    <div class="k-set-page" data-p="keys">
      ${scope('global')}
      <div class="k-hint" style="margin-bottom:10px">${a[41]}</div>
      <div id="st-keys"></div>
    </div>
    <div class="k-set-page" data-p="nav">
      ${scope('project')}
      <div class="k-hint" style="margin-bottom:10px">${tx('ui.nav.setHint')}</div>
      <div class="k-row"><label>${tx('ui.nav.setMode')}</label><select id="st-navmode" class="k-dlg-select"><option value="scroll">${tx('ui.nav.setModeScroll')}</option><option value="page">${tx('ui.nav.setModePage')}</option></select></div>
      <div class="k-row"><label>${tx('ui.nav.setPerPage')}<span class="k-hint">${tx('ui.nav.setPerPageHint')}</span></label><input type="number" id="st-navper" min="5" max="500" step="5" class="k-narrow"></div>
      <div class="k-set-sub k-full">${tx('ui.nav.legendTitle')}</div>
      <div class="nav-legend" id="st-nav-legend"></div>
    </div>
    <div class="k-set-page" data-p="netcol">
      ${scope('project')}
      <div class="k-hint" style="margin-bottom:10px">${tx('ui.setTpl.colorStoryNetworkField')}</div>
      <div class="k-set-sub k-full">${tx('ui.setTpl.text5')}</div>
      <div class="k-row"><label>${tx('ui.setTpl.btnViewD')}</label><select id="st-net-orbit" class="k-dlg-select"></select></div>
      <div class="k-row"><label>${tx('ui.setTpl.btnScrollGraph')}</label><select id="st-net-pan" class="k-dlg-select"></select></div>
      <div class="k-hint k-full" id="st-net-hint" style="margin:2px 0 10px"></div>
      <div id="st-netcol-body"></div>
    </div>
  </div>
</div>
<div class="k-dlg-btns"><button class="k-cancel">${a[42]}</button><button class="k-ok">${a[43]}</button></div>`;
}
