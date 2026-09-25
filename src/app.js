// Killian 2 renderer — explorer + tabs + toolbar + statusbar
import { tx, txf, hx } from './i18n-html.js';   // [alpha.154] ข้อความจากไฟล์ภาษาลง HTML
import { t as tt, tf as ttf, T, tf, setShortcutResolver, lookup } from './i18n.js';
import { KEditor } from './editor.js';
import { parseMdFile, dumpMdFile, countWords, alignToString, alignFromString,
         mdToDoc, docToMd } from './md.js';   // [alpha.132 · X-1] ยัด align กลับเป็นคอมเมนต์ตอนส่งออก
// [alpha.87] แปลงเอกสารข้ามโหมด นิยาย ↔ บทหนัง (โมดูลบริสุทธิ์ — เทสที่ test/convert.test.mjs)
import { convertBody, lossReport, kindLabel } from './convert.js';
// ---- alpha.58r: รูปแบบ + มุมมองหน้ากระดาษของ "นิยาย" (บั๊ก 15–24) ----
import { PROSE_DEFAULTS, DEFAULT_PROSE_FONT, HEADING_DEFAULTS, QUOTE_DEFAULTS,
         mergeProseFormat, proseCssVars, proseCss, proseFontStack, proseHeadingStack,
         proseFontPx, proseLinePx, proseMetrics, proseLinesPerPage, proseCharsPerLine,
         paginateProse, prosePageCount, prosePageLabel, proseBlocksFromDoc,
         prosePageStarts, findProsePageStart, proseHeadings, headingNumberText,
         proseExportCss } from './prose-format.js';
import { PROSE_VIEWS, PROSE_VIEW_LABELS, isProsePageView, isProseEditView, isValidProseView,
         proseLayoutCssVars, prosePagesOf, setProsePageBreaks, prosePageBreaks, applyProsePagePads,
         refreshProsePageBreaks, renderProsePageView, proseViewStatusText,
         setProsePageNumberLabel } from './prose-view.js';
// [alpha.82] จัดหน้านิยายจากการวัดของจริงบนจอ — แทนที่การเดาจากจำนวนตัวอักษร
import { measureProseLayout, sliceProsePages, proseBreakList, withMeasureMode, zoomFactorOf,
         renderProseClipPages, fullPageImages, CUT_FAIL, resetCutFail } from './prose-measure.js';
// [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ · [ข้อ 6] ระยะขอบสำเร็จรูป
import { CASE_MODES, CASE_SHORT, CASE_LABELS } from './text-case.js';
// [alpha.60r2 ข้อ 13] คุณสมบัติฉาก: frontmatter = แหล่งความจริง · scenes.json = ดัชนี
import { readSceneMeta, writeSceneMeta, SCENE_HEAVY_KEYS } from './scene-meta.js';
// [alpha.60r2 ข้อ 6 · 12] ระยะขอบสำเร็จรูป · เมทาดาทาของรูปใน Wiki (ใช้ใน selftest ด้วย)
import { marginPreset, matchMarginPreset } from './margin-presets.js';
import { migrateImages, setImageMeta } from './wiki-images.js';
import { entityPortrait, mergeBuiltInTemplateMeta } from './wiki-profile.js';
import { LEVELS, LEVEL_META, filterLogs, shortTime, exportText, parseLogLine } from './log-core.js';
// [alpha.72 ข้อ 4] กฎ: อะไรที่ทิ้ง/อัปเดตตอนปิดโปรแกรม ต้องขึ้น list ทุกครั้ง
import { dirtyRegistry, registerDirtySource } from './dirty-registry.js';
import { wordsWrittenToday } from './dashboard-stats.js';   // [alpha.162 · W5 ข้อ 5]
import { clearThemeColorCache } from './palette.js';        // [alpha.162 · W6 ข้อ 2]
import { flushTab, closeResult, tabsSafeToClose } from './tab-guard.js';
import { neighborAfterClose, cycleTab, moveTabBefore, tabsRightOf, tabPathParts, pushClosed, takeReopen, pinnedFirst, closableOf } from './tab-order.js';   // [alpha.161 · K2]   // [alpha.160 · P0-2/P0-3]
import { statusChoices } from './status-choices.js';                       // [alpha.160 · P1-11]
// [alpha.60r2 ข้อ 8] เวอร์ชัน schema ของเลย์เอาต์แผง (selftest ตรวจการตกกลับค่าตั้งต้น)
import { LAYOUT_VERSION as PANEL_LAYOUT_VERSION,
         deserializeLayout as deserializePanelLayout } from './panels/panel-store.js';
// [alpha.60r2 ข้อ 2] selftest ต้องตั้ง selection เองก่อนสั่งเปลี่ยนรูปตัวพิมพ์
import { TextSelection as PMTextSelection, AllSelection as PMAllSelection } from 'prosemirror-state';
import { setQuery, gotoMatch, replaceCurrent, replaceAll } from './search.js';
import { ask, confirmBox, infoBox, popupMenu, choose, closeMenu, saveAllDialog, escClose, menuItemsOf, menuOpen, setHoverTipHider, installDialogA11y, rovingToolbar } from './ui.js';
import { escCancelDrag } from './drag-cancel.js';   // [alpha.165] Esc ยกเลิกการลาก
import { buildActChapterRows, buildMentionsBox } from './scene-props-extra.js';
import { mutateJson } from './json-store.js';   // [alpha.156] อ่านสด-แก้-เขียน JSON ในคิวของไฟล์
import { diskConflict, focusAction } from './disk-conflict.js';   // [alpha.156] ไฟล์ถูกแก้นอกโปรแกรม
import { sprintDirtyList, saveSprintDirty } from './sprint-ui.js';     // [alpha.156] ทะเบียนงานค้าง
import { setTabBridge, pathKey } from './tab-bridge.js';   // [alpha.149] ตัวเขียนไฟล์นอกตัวแก้ไข (AI · ไล่แก้ชื่อ) ต้องรู้จักแท็บ
import { WikiEditor, CAT_TH, imageLightbox } from './wiki.js';
import { SPEditor } from './screenplay.js';
import { Gallery, pickImage } from './gallery.js';
import * as albumCore from './gallery/album-core.js';     // [alpha.63] อัลบั้มรูป (Explorer/แดชบอร์ดใช้ร่วม)
import { renderMoodBoardPanel, moodBoardInstance } from './gallery/moodboard-ui.js';   // [alpha.63r] แผงกระดานอารมณ์
import { StoryNetwork, cssVar } from './network.js';
import { PlannerBoard } from './planner/planner.js';
import { renderPlannerProps } from './planner/planner-props.js';
import { errText, failText } from './err-text.js';        // [alpha.162 · W4] ข้อความผิดพลาดที่ผู้ใช้อ่านรู้เรื่อง
import { SP_ELEMS, TIMES, TRANSITIONS, TRANSITIONS_IN, INTERCUTS, SCENE_PREFIX, TAB_CYCLE, NEXT_ELEM,
         PARENTHETICALS, CHAR_EXTENSIONS, splitCharacter, withExtension,
         classify, parseScript, setSpRules, SP_RULES } from './fountain.js';
import { refreshMentions } from './editor.js';
import { refreshSpell } from './editor.js';
import { decoSignature } from './editor.js';   // [alpha.88 ข้อ 6] ประตูกัน decoration รั่ว
import { blankLinesBefore } from './sp-format.js';   // [alpha.88 ข้อ 2+3]
import { commentAnchors, refreshCommentAnchors } from './editor.js';
import * as spell from './spell.js';
import { sceneMatchesQuery, textMatchesQuery, queryValue, statusRankOf, setChipClause, parseChipQuery } from './sceneFilter.js';
import { STEP_DEFS, PRESETS, stepDef, mkStep, newWorkflow, cloneWorkflow, runWorkflow,
         mdToHtmlBody, mdToHtml } from './compile.js';
import { TIMELINE_VERSION, mergeTimeline, groupByTrack, trackNames, newEvent, findClashes, sortEvents, ganttData, ganttBar, ganttTicks, normalizeRefs } from './timeline.js';
import { MAPS_VERSION, PIN_COLORS, PIN_KIND, newMap, newPin, clamp, findMap, sortMaps, breadcrumb, rootMaps, pinStats, deleteMap,
         migrateMaps, mapCategories, groupMaps, mapOverlays, toggleOverlay, gridLines, clampZoom, zoomStep,
         filterPins, matchPin, movePins, deletePins, clonePins, newRoute, routePoints, routePath, routeLength,
         addPinToRoute, deleteRoute, mapRoutes, scenePinCounts, scenesForMap, MAP_ZOOM_MIN, MAP_ZOOM_MAX } from './maps.js';
import { setSplashActive, splashProgress, $, el, state, smart, LOG_BUF, log, logAction, logStore, onLog, setStatus, setStatusError, setStatusAction,
         DEFAULT_SETTINGS, GLOBAL_DEFAULTS, DEFAULT_GOALS, DEFAULT_SP_CYCLE, DEFAULT_SP_CYCLE_KEYS,
         BASE_ED_FS, BASE_SP_FS, PT_PX, ptToPx, DEFAULT_SCRIPT_FONT,
         spCycleKeys, spKeyLabel, spKeyMatch,
         PAPER_SIZES, MARGIN_DEFAULTS, SP_ELEMENT_KEYS, mergeSpFormat, pageCssVars, spCss,
         CAPS_ELEMENTS, elementCaps, setElementCaps,
         linesPerPage, formatLines, lineHeightIn, paginate, pageCount, wrapLines, elementWidthIn,
         newRoster, normalizeRoster, rosterToText, textWidth,
         SCENE_NUMBER_DEFAULTS, PAGE_NUMBER_DEFAULTS, pageNumberLabel,
         LANG_FAMILY, SCRIPT_PRESETS, BUILTIN_FONT_FILES, defaultLangFonts, normalizeLangFonts,
         projectFontFaceCss, FONT_FILE_RE,
         buildLangFontCss, withLangFamily, applyLangFonts,
         SP_FAMILY, FONT_TARGETS, withSpFamily, migrateSpThai, usableCounts, rowAppliesTo,
         normalizeRange, SP_THAI_RANGE, SP_THAI_FALLBACKS, SP_THAI_SIZE, withThaiFallback,
         SCALE_MIN, SCALE_MAX, UI_SCALE_MIN, UI_SCALE_MAX,
         SCENE_STATUSES, SCENE_COLORS, STATUS_COLORS, dataLabel, BUILTIN_CATS, CAT_ICON,
         REL_TYPES, REL_COLOR, REL_LABEL, categorizeRole, categorizeWith,
         t, i18n, loadLanguage, scanLanguages, languageCatalog, applyDataI18n, onLanguageChanged,
         csvToTable, tableToCsv, langFileName, fallbackLangName,
         SHORTCUTS, SHORTCUT_LABELS, shortcutId, SHORTCUT_CATS, shortcutCat, needsAlt,
         SHORTCUT_PANEL_SKIP,
         formatShortcut, accelText, num,
         setBusy, clearBusy, busyMsg, withBusy,
         PANEL_WIN, isPanelWindow,        // [alpha.67] หน้าต่างแผงที่ฉีกออกมา (tear-off)
         keepScroll,                      // [alpha.66r2] จำ-คืนตำแหน่งเลื่อนตอนรื้อ DOM สร้างใหม่
         THEMES, THEME_MODES, THEME_LABEL_KEYS, THEME_ALIAS } from './core.js';   // [alpha.137] ทะเบียนธีมของโปรแกรม
import { sceneProps } from './scene-props.js';
// [alpha.60r3 ข้อ 2] ปุ่ม ✨ ให้ AI เขียนเรื่องย่อ/POV/อารมณ์/ความขัดแย้ง
import { attachAiFieldButton, generateSceneSynopsis, fieldPrompt, cleanResult,
         AI_SCENE_FIELD_KEYS } from './ai-synopsis.js';
// [alpha.60r3 ข้อ 5] แผงวิเคราะห์ด้วย AI (ตัวอย่างหน้าตา)
import { focusAnalysis } from './ai-analyzer-ui.js';
import { renderAIAnalyzerPanel, ANALYZER_CARDS, analyzerStats,
         runAnalysis, resetAnalyzer, collectScenes, currentResults,
         analyzerDirtyList, saveSession as saveAnalysisSession,
         listSessions, openSession, exportAllCsv } from './ai-analyzer-ui.js';
// [alpha.60r3 ข้อ 6] ซ่อน/แสดงรหัสนำหน้าบรรทัด
import { setMarkdownCodes, markdownCodesOn, refreshMarkdownCodes,
         prefixLen as mdPrefixLen, suffixLen as mdSuffixLen, MD_HIDE_CLASS } from './markdown-code-toggle.js';
// [alpha.60r3 ข้อ 4] Localizer — ไฟล์ภาษา ↔ ตาราง CSV (โมดูลบริสุทธิ์ · มี unit test แยก)
// [alpha.76] ไฟล์ภาษาเป็น CSV แล้ว — เหลือใช้แค่ตัวพาร์ส (ตัวแปลง json↔csv ยังอยู่ใน i18n-csv.js
// เผื่อโปรเจกต์เก่าที่ยังมี languages/*.json แต่ app.js ไม่ได้เรียกแล้ว)
import { parseCsv } from './i18n-csv.js';
import { openMaps, renderMaps, renderMapsPanel, focusMapPin, exportMapPng, resetMapsView,
         buildShowOnMapRow, sceneMapLocation, enterMap, openMapById } from './maps-ui.js';
import { openTimeline, renderTimeline } from './timeline-ui.js';
import { renameSection, deleteSection, addSection, listSections, sectionStats, saveSectionMeta, reorderSections, sectionProps } from './section-ops.js';
import { renameScene, deleteScene, addScene, setSceneMeta, toggleSceneFlag, duplicateScene, moveSceneOrder, moveSceneToChapter, moveSceneBefore, renameChapter, deleteChapter, addChapter, moveChapterBefore,
         saveChapterMeta,
         setSceneTitle, chapterProps, trashVisSidecar } from './scene-ops.js';
import { wikiCats, applyWikiCats, newWikiCat, editWikiCat, deleteWikiCat, addEntity, openEntity, duplicateEntity } from './wiki-ui.js';
import { settingsDialog, versionDialog, showChangelog } from './dialogs.js';
// [alpha.135] ระบบอัปเดต — ทางเข้าทั้งสามทาง (ตั้งค่า · ตอนเปิดโปรแกรม · เมนูช่วยเหลือ) เรียกตัวเดียวกัน
import { checkForUpdates, startupUpdateCheck } from './update/update-ui.js';
import { UPDATE_HOME_URL } from './update/update-check.js';
import { openRewriteBar, closeRewriteBar, rewriteBarTab } from './ai/ai-rewrite-ui.js';
import { openBookManager, renderBookManager, refreshBooksIfOpen } from './books.js';
// [alpha.141] จัดการบท + โหมดอ่านทั้งเล่ม + สายหน้าที่ทั้งเล่มใช้ร่วม (เลขหน้าไล่ต่อเนื่อง)
import { openChapterManager, renderChapterManager, refreshChaptersIfOpen,
         coverHintLine } from './chapters-ui.js';
import { openBookReader, closeBookReader, isBookReaderOpen, bookReaderPages, bookReaderParts,
         bookReaderPage,
         gotoPage as readerGotoPage, computeBookFlow, cachedStartPage, bumpBookFlow,
         bookFlowKey, bookFlowReady, staleStartPage } from './read-ui.js';
import { isPageFlowContinue, explicitStartPage, pageAtPos } from './book-flow.js';
import { restoreFromTrash, deleteToTrash, purgeRecycle, listPurgeable } from './recycle.js';
import { trashPathFor } from './trash-path.js';          // [alpha.162 · W1-4] ชื่อในถังไม่ชนกัน
import { openDashboard, renderDashboard } from './dashboard.js';
import { openHome, renderHome, showHomeDialog } from './home-ui.js';
import { openTagPane, renderTagList, filterByTag } from './tag-pane.js';
// [alpha.125 ข้อ A · ข้อ D] `bindGlobalSearchShortcut` เป็น no-op ที่คงชื่อไว้เฉย ๆ — ถอดทิ้งแล้ว
// (คีย์ลัดอยู่ในตาราง SHORTCUTS channel 'global-search' มาตั้งแต่ alpha.79)
// [alpha.161 · S7] `openGlobalSearch` (กล่องเต็มจอ) ถูก import แต่ไม่มีใครเรียกมาหลายรุ่น — ถอดทั้งฟังก์ชัน
// ทางเข้าเดียวคือแผงค้นหา (คำสั่ง 'global-search' / Ctrl+Shift+F)
import { renderSearchPanel, invalidateSearchIndex,
         searchIndexStats, runProjectSearch, watchProjectWrites } from './global-search.js';
import { openSceneTable } from './scene-table.js';
import { openVisual, createVisual, hasVis, visPathOf, renderVisual, openVisualForActive, VIS_TAB } from './visual/vis-ui.js';
import { openScratchpad, renderNotesPanel, scratchDirtyList, flushScratch } from './scratchpad.js';
import { openQuickOpen, quickOpenCache } from './quick-open.js';
import { manageCustomStatuses, allStatuses, addCustomStatus, removeCustomStatus,
         statusColor, statusesToJson, importStatuses, setStatusColor, paintStatusChip, statusChip } from './custom-status.js';
import { vivid } from './color-util.js';
import { toggleFocusMode2, cursorBlock, isFocusMode, focusDim, applyFocusDim } from './focus-mode.js';
import { toggleTypewriter, twScroll, isTypewriter, scrollHost } from './typewriter.js';
import { recordDailyWords, countProjectWords, calcStreak, getWordHistory,
         rebuildWordCounts, scheduleWordHistory, flushWordHistory, wordHistoryPending } from './word-history.js';
import { autoBackupNow, startAutoBackup, backupIfDue, BACKUP_DONE_MARK } from './backup.js';
import { localDay, addDays, fmtUtcStamp } from './local-date.js';   // [alpha.148] วันของเครื่อง ไม่ใช่ UTC
import { fileUrlFromPath } from './file-url.js';
import { exportProjectZip, exportProjectJson, importProjectZip,
         safeRel, commonPrefix } from './export-zip.js';   // [60r3 ข้อ 9]
import { renderCommentPanel, commentStore, migrateSceneComments, clearCommentAnchors,
         resetCommentStore, scrollToAnchor, writeKeepingComments } from './comments/comment-ui.js';
import { exportBlogHTML, buildBlogHtml, BLOG_THEMES } from './export-blog.js';
import { createProjectFromTemplate, showTemplateDialog, BLANK_TEMPLATE } from './project.js';
import { saveAISettings, saveApiKey, clearKeyCache } from './ai-settings.js';
// [alpha.61 ข้อ 2] ผู้ให้บริการ AI ที่ผู้ใช้เพิ่มเอง + แผงแชทแบบ opencode
import { showAISettingsDialog, providerList, currentProvider, clearKeysCache,
         providerDialog } from './ai/ai-provider-ui.js';
import { renderAIChatPanel, newChatSession, loadSessions, collectScope,
         saveSession, _chatState, invalidateChatRag,
         collectRelevant } from './ai/ai-chat-panel.js';
import { showAISummary } from './ai-summary.js';
import { showAITitleSuggestions, collectProjectText, hashText, pastTitlesFor,
         summaryCacheState, rememberTitles } from './ai-summary.js';
import { openBranchingTree, renderBranchingTree, renderBranchingPanel, syncChoicesFromScene,
         mutateChoices, checkDanglingOnOpen } from './branching-ui.js';
import { openPlayerMode, renderPlayerPanel, resetPlayerMode } from './player-mode.js';
import { openFloorPlan, renderFloorPlan, renderFloorPlanPanel,
         refreshOpenFloorPlan } from './floorplan-ui.js';
import { showPlayerHistory } from './player-choices.js';
import { manageVisualTags, renderAllTagChips, applyVisualTagStyle, visualTagFor } from './visual-tags.js';
import { quickNote, showAllNotes, getSessionNotes, addSessionNote, saveSessionNotes } from './session-notes.js';
// [alpha.80] "ศูนย์รวม" ถูกลบทิ้ง (ข้อมูลซ้ำกับแดชบอร์ด) — เหลือเฉพาะส่วนที่ไม่ซ้ำ
import { markReviewStale, onReviewShown, resetReview } from './dash-review.js';
// ---- Part 1+2 integrations ----
import { openKanban, resetKanban, renderKanbanPanel } from './kanban/kanban-ui.js';
import * as PL from './panels/panel-layout.js';
import { installPanelDrop } from './panel-drop.js';
import { exportPanel } from './panel-exports.js';
import { setDrag } from './drop-kit.js';
import { inGroupHandle, snapToEdges, clampFloat, FLOAT_MIN_W, FLOAT_MIN_H } from './panels/panel-drag.js';
// [alpha.60r2 ข้อ 7] รายชื่อกล่องที่เลื่อนได้ — selftest ตรวจว่าครอบคลุมครบ
import { SCROLLABLES as PANEL_SCROLLABLES } from './panels/panel-ui.js';
import { PANEL_DEFS as PANEL_DEFS_147, panelIcon, dodgeHiddenChips } from './panels/panel-ui.js';   // [alpha.147] e2e ไอคอนแผงจากทะเบียน
// [alpha.73 ข้อ 6] ความกว้างต่ำสุดของเนื้อแผง (ค่าเริ่มต้น) — ค่าจริงต่อแผงอยู่ที่ `minW` ใน PANEL_DEFS
import { PANEL_MIN_W_DEFAULT } from './panels/panel-renderer.js';
// [alpha.73 ข้อ 2-4] นิยามสี/การควบคุม/กล้องของ Story Network
import { NET_COLOR_DEFS, viewCenter, axisVectors } from './network-theme.js';
import { initPanelSystem, getPanelManager, togglePanelDialog, showPanel, hidePanel, togglePanel,
         resetPanels, panelMenuItems, panelToggleState, addPanelButton, renderPanels,
         makePanelButton, panelEmpty,        // [alpha.162 · W2] ปุ่ม/สถานะว่างของแผงมาจากของกลางชุดเดียว
         isPanelOpen, resetPanelSystem, PANEL_DEFS, panelId, setPanelShowHook,
         onPanelLayoutChange, panelDesc, setPanelCloseGuard,
         // [alpha.66r3] เวิร์กสเปซ + ระบบจัดการพื้นที่
         toggleSpace, panelsHidden, hiddenMode, workspaceMenu, workspaceMenuItems, toggleSide, sideHidden,
         listWorkspaces, saveWorkspace, applyWorkspace, deleteWorkspace,
         BUILTIN_WORKSPACES, auditPanelGaps,
         // ส่งออกการจัดวางแผงเป็นไฟล์ (ใช้เป็นเลย์เอาต์อ้างอิง / แนบตอนรายงานบั๊กเรื่องแผง)
         exportPanelLayout, panelLayoutReport,
         // [alpha.67] tear-off: แผงเป็นหน้าต่าง OS จริง
         mountPanelWindow, tearOffPanel, recallPanel, isTornOff, tornOffIds,
         canTearOff, TEAROFF_PANELS } from './panels/panel-ui.js';   // [60r3 ข้อ 8]
// [alpha.68] tear-off เฟส 2: ช่องส่ง "ฉากที่เปิดอยู่" ข้ามหน้าต่าง (รูปร่างข้อความ + กฎ — บริสุทธิ์)
import { SCENE_PANELS, writesScene, sceneMsg, remoteTab, sceneChanged, canEditScene,
         outlineMsg, gotoMsg, wantSceneMsg, anyNeedsScene, tabsToReload,
         samePath, isSceneFile } from './panels/panel-sync.js';
import { wrapDesc as panelWrapDesc } from './panels/panel-renderer.js';
import { toggleSplit, createSplit, closeSplit, isSplit, syncSplitPanes, resetSplitSystem,
         initSplitSystem, syncActiveSplit, openInSplit, closeTabInSplit, splitDir,
         getSplitManager, paneCount as splitPaneCount } from './layout/split-ui.js';
import { ensureAutoLink, getBacklinksFor, renderBacklinksTab, resetAutoLink,
         rebuildAutoLink, updateSceneLink, autoLinkReady,
         renderBacklinksPanel, backlinkSummary } from './world-story/auto-link-ui.js';
import { findScenePath, listEntities, listScenes } from './project-scan.js';
// [alpha.126] ตัวพาร์สโครงเรื่องจากข้อความดิบ — ใช้ทั้งไฟล์ข้อความล้วนและมุมมอง "ทั้งเล่ม"
import { buildNavigation, parseProse, parseScreenplay } from './nav.js';
// [alpha.140] แกนบริสุทธิ์ของแผง Navigation — กลุ่มชนิด · สถานะจุด · ค้นหา/กรอง · แบ่งหน้า
import { NAV_GROUPS, NAV_GROUP_KEYS, NAV_GROUP_ICON, NAV_FLAG_DEFS, navFlags,
         withNavKeys, filterNav, clampPerPage, navSlice, navLocText,
         pageOfPos, mdLineOfBlock, navMatchRow, nthTextPos } from './nav-model.js';
// [alpha.69] แผงใหม่ 3 ตัว — ตรรกะบริสุทธิ์แยกไว้ที่ *-data/*-build (มี unit test) · ที่นี่คือฝั่ง UI
import { renderCodexPanel, resetCodex } from './codex/codex-ui.js';
import { renderHistoryPanel, resetHistory, configHistory } from './history/history-ui.js';
import { renderRecordPanel, resetRecords } from './record/record-ui.js';
// [alpha.125 ข้อ C] `renderAutoSyncSection` ถูกถอดออก (ดูเหตุผลใน event-ui.js)
import { setAutoSync, isAutoSyncOn, resetTaskEngine,
         handleEntityRenamed, renameAcrossProject } from './auto-task/event-ui.js';
// [alpha.60r3 ข้อ 7] EventBus ก้อนเดียวที่ปลั๊กอินทุกตัวใช้ร่วมกัน (k2.on / k2.emit)
import { EventBus } from './auto-task/event-queue.js';
// [alpha.79] แผงปลั๊กอิน · แผงบทพูด · เอาปุ่มเข้า-ออกจากแถบเครื่องมือ · จำสถานะล่าสุด
import { ORIGIN_USER, ORIGIN_PROJECT, pluginFingerprint, isPluginSetTrusted } from './plugins/plugin-core.js';
import { renderPluginPanel, resetPluginPanel } from './plugins/plugin-panel.js';
import { renderDialoguePanel, resetDialogue, scanDialogue, markDialogueStale, visibleRows as dialogueRows,
         openAt as dialogueOpenAt, applyEdit as dialogueApplyEdit,
         selectInEditor as dialogueSelect } from './dialogue/dialogue-ui.js';
// [alpha.82] ห้องซ้อมบท — AI สวมบทตัวละครจาก Wiki คุยกันทีละเทิร์น
import { renderBuilderPanel, resetBuilder, builderDirtyList, saveBuilderDirty,
         builderState } from './dialogue/builder-ui.js';
// [alpha.82] ตัววัดความกว้างตัวอักษรจริง — เสียบเข้า text-width.js (ที่บริสุทธิ์)
import { installTextMeasurer, refreshTextMeasurer, preloadMeasuredFonts } from './text-measure.js';
import { TOOLBAR_GROUPS, allButtonIds, isButtonVisible, setButtonVisible, setGroupVisible,
         resetToolbarConfig, normalizeToolbar, toolbarCounts, layoutToolbar,
         fmtbarSequence,                 // [alpha.150 ข้อ 1] ลำดับ+เส้นคั่นของแถบลอย (แหล่งเดียว)
         isConfigurable as tbConfigurable,
         AI_GROUP_IDS } from './toolbar/toolbar-config.js';   // [alpha.162 · W5 ข้อ 4]
// [alpha.132 ข้อ 9] สีตัวอักษร — ป๊อปอัปเลือกสี (UI) + ตรรกะสีล้วน ๆ (บริสุทธิ์ · มี unit test)
import { openColorPicker, closeColorPicker } from './color-picker.js';
import { normColor, HILITE_PRESETS } from './text-color.js';
// [alpha.150] คำแนะนำสองชั้น: ชื่อ+คีย์ลัด แล้วประโยคอธิบายว่าใช้ตอนไหน (ตรรกะบริสุทธิ์)
import { tipContent, tipText } from './tooltip.js';
// [alpha.155] เมนูคลิกขวาของ Explorer: ลำดับจากตาราง · คำสั่งใหม่จาก tree-actions (เรียกตอน runtime)
import { buildMenuItems, menuLabelKey, LOCK_BLOCKED, TREE_MENU_SPEC } from './tree-menu-spec.js';
// [alpha.164] ฉากมีปัญหา (แก้ปัญหาหน้ากองถ่าย) — เทียบฉบับเดิม ⇄ ฉบับแก้ไข
import { installOnset, applyOnsetToTab, onsetBeforeCommand, toggleOnsetView, markSceneProblem, clearSceneProblem,
         isProblemScene, loadOnsetIndex, resetOnset, onsetChanged, onsetEditorMenu, onsetMenuItems, onsetViewOf,
         exitOriginal, revisedDoc } from './onset-ui.js';
import * as TA from './tree-actions.js';
import { bindPanelFocus, setFocusedPanel, focusedPanel, isPanelFocused,
         setPanelOwnsKeys, focusedPanelOwnsKeys } from './panels/panel-focus.js';
import { toolbarDialog, applyToolbarConfig, toolbarContextItems, TB_HOSTS,
         applyFmtbarConfig, fmtbarContextItems, fabContextItems,
         applyToolbarGroupSeps,          // [alpha.139] เส้นคั่นหมวดบนแถบเครื่องมือ
         TB_FMT_HOST } from './toolbar/toolbar-ui.js';
// [alpha.111] ปุ่ม "เรียกแถบรูปแบบมาหาเคอร์เซอร์" — ตรรกะพิกัด/เส้นโค้งอยู่ในโมดูลบริสุทธิ์
import { fmtBarTarget, tweenAt, FMTBAR_TWEEN_MS, clampBarPos, clampBarInBox, visibleHostBox, barClampBox,
         FMTBAR_OPACITIES, nextOpacity, opacityPercent, normalizeBarState, resetBarState,
         nextAlign, normalizeAlign, alignBarPos, defaultBarPos } from './toolbar/fmtbar-pos.js';
// [alpha.116 ข้อ 8] โค้ดสั้น `[title]` — ทะเบียน + ตัวแทนค่า (บริสุทธิ์ · เทสแยก)
import { SHORTCODES, SHORTCODE_GROUPS, shortcodeLabel, expandShortcodes,
         sceneContext, entityContext } from './shortcode.js';
// [alpha.111] ปุ่มลอย (FAB) ที่ผู้ใช้เลือกคำสั่งเองได้ + เมนูวงกลม/แถวตั้ง
import { normalizeFab, fabAction, fabMenuItems, fabRadialPositions, fabStackPositions,
         fabRadius, fabOpenDir, fabAnimMs, clampFabPos } from './toolbar/fab-config.js';
import { openExportHub, EXPORT_FORMATS, formatDef, docKind, pdfEngine, exportPageNumberFmt,
         normalizeHub, defaultWorkflowFor, workflowForFormat, suggestName } from './export-hub.js';
import * as SESS from './session/session-core.js';
import { openAIAssistant, openPlotHoleDetector, openDialogueGenerator, openConsistencyCheck, openWorldGenerator, openAIChat } from './ai/ai-ui.js';
// [alpha.116 ข้อ 3] AI Hub — ประตูเดียวเข้าทุกความสามารถ AI
import { renderAIHubPanel } from './ai-hub-ui.js';
// [alpha.94] Story Starter — สร้างเรื่อง/ตัวละครแบบทีละขั้น แล้วเล่นเป็นตอนกับ Game Master
import { renderStarterPanel, openStoryStarter, flushStarter } from './starter/starter-ui.js';
import { showThesaurusPopup, initThesaurus } from './tools/thesaurus-ui.js';
import { importScrivenerDialog } from './import/import-ui.js';
// [alpha.60 ข้อ 62-66] นำเข้าบทภาพยนตร์จาก 5 รูปแบบ
import { importScreenplayDialog, importSummary, elementsToMarkdown } from './import-sp.js';
// [alpha.60 ข้อ 74] เปรียบเทียบบทภาพยนตร์
import { showComparisonDialog, compareScripts } from './sp-compare.js';
import { resetAI, getAIClient, ragContext } from './ai/ai-bridge.js';
import { icon, initIcons, iconHtml, iconLabel, hasIcon, commandIcon, isRegisteredCommand, gi } from './icons.js';
import { elemLabel } from './elem-label.js';   // [alpha.164 ข้อ B5] ชื่อชนิด element ตามภาษา UI
// [97] หน้ารายชื่อตัวละคร (Cast of Characters) — หน้าเดี่ยวประจำเล่ม
import { openRosterFlow, openRoster, renderRoster, saveRosterTab, isRosterTab,
         loadRoster, saveRoster, rosterTextFor } from './roster-ui.js';
// ---- alpha.57: มุมมองบท (57/59/60/61) · ไปยังหน้า-ฉาก (78) · ตรวจข้อผิดพลาด (54) · ส่งออก 67/68/70 ----
import { SP_VIEWS, SP_VIEW_LABELS, SP_VIEW_CLASS, ALL_VIEW_CLASSES, isPageView, isValidView,
         fitScale, overviewScale, viewScale, blocksFromDoc, pagesOf, pageStartPositions,
         pageStartMarks,
         findPageStart, scenePositions, findNthScene, renderPageView, viewStatusText,
         pageMetrics, layoutCssVars, isEditView, isPaperView } from './sp-view.js';
// [alpha.100 ข้อ 4] สีกระดาษที่ผู้ใช้เลือกเอง — โมดูลบริสุทธิ์ (test/paper-color.test.cjs)
import { paperVars, normalizePaperColor, PAPER_DEFAULT } from './paper-color.js';
import { setFormatGuide, isFormatGuide, setPageBreaks, pageBreaks,
         setSceneNumbers, isSceneNumbers, refreshSceneNumbers,
         setContinueds, continueds, refreshContinueds,
         setSpErrorMarks, refreshSpErrorMarks, setSpErrorMarksOn, isSpErrorMarks, spErrorMarks,
         setSpPageNumberLabel, applySpPagePads } from './sp-format-guide.js';
// ---- alpha.58: ระบบต่อเนื่อง (55/56) + รายงานบท (71/72/73) ----
import { computeContinueds, continuedSummary, continuedStatusText, pagesWithContinueds,
         CONTINUED_DEFAULTS } from './sp-continued.js';
import { looksLikeTerm, countTerms, learnedTerms, pendingTerms, learnMin,
         DEFAULT_LEARN_MIN, LEARN_MIN_RANGE } from './smart-terms.js';
import { generateLocationReport, generateCharacterReport, generateDialogueChart,
         locationReportText, characterReportText, dialogueChartText,
         CHART_KINDS, CHART_LABELS, sceneBreakdown } from './sp-reports.js';
import { setTypeSound, isTypeSound, setTypeVolume, typeVolume, playType,
         soundKindFor, isEditorTarget } from './typewriter-sound.js';
import { SP_ERRORS, validateScreenplay, errorSummary, summaryText, nextError, elLabel } from './sp-validator.js';
import { generateFdx } from './export-fdx.js';
import { generateRtf, escapeRtf } from './export-rtf.js';
import { buildWatermarkHtml, generateWatermarkedPDFs, parseRecipients, safeFileName,
         watermarkText, DEFAULT_WM } from './export-watermark.js';
// ---- alpha.59: ชุด PDF — ตัวสร้างในโปรแกรม (69) · สารบัญ (87) · ตัด element (88) ·
//      เปิดที่หน้าเดิม (89) · หน้าปก (90) · หัวกระดาษ (91) ----
import { openTitlePageDialog, openHeaderDialog, pdfExportDialog, buildScriptPdf,
         writeCompiledPdf, projectTitlePages, projectHeaders, pdfFontBytes,
         currentScriptPage, savedPdfOptions, clearPdfFontCache } from './pdf-ui.js';
import { PDF_DEFAULTS, OMITTABLE_ELEMENTS, PDF_FONT_FILES, wrapTextLines,
         layoutPageLines, mergePdfOptions } from './pdf-generator.js';
import { TitlePageEditor, defaultTitlePages, normalizeTitlePages,
         titlePagesText } from './sp-title-pages.js';
import { HEADER_DEFAULTS, HEADER_VARS, mergeHeaders, headerStringsFor, headerLineCount,
         resolveHeaderVars, linesForBody } from './sp-headers.js';
import { runTest } from './selftest.js';   // [alpha.160] e2e แยกไฟล์แล้ว

// นามแฝงของ t() — ใช้ในฟังก์ชันที่มีตัวแปรท้องถิ่นชื่อ t (ex. runTest: const t = state.active)
const tr = t;
import { cmpText, fmtNum, fmtTime, fmtDate, fmtDateTime } from './locale.js';
import { installStatusToggles, syncStatusToggles } from './status-toggles.js';   // [alpha.165]
import { installStatusBarLock, resetStatusBarLock, reserveStatusWidth } from './statusbar-lock.js';   // [alpha.166]

// ---------------- (ย้ายไป core.js แล้ว: $, el, state, smart, log, setStatus, ค่าตั้งต้น) ----------------
let pageScale = 1;       // อัตราซูมหน้ากระดาษ (0.5–2.5) — reassign ได้จึงคงไว้ที่นี่ (ES module import เป็น read-only)
let autosaveTimer = null;

// ใส่ค่า settings/goals ลง state (เติม default ที่ขาด) แล้วนำไปใช้จริง
// [alpha.60 ข้อ 94] 2 ระดับ: global (อ่านจาก userData/settings.json) + project (จาก project.khn.json)
async function loadSettings(meta) {
  state.meta = meta;
  // โหลด global settings (ถ้ามี)
  let globalSettings = {};
  try { globalSettings = await kapi.readGlobalSettings(); } catch {}
  // project settings ชนะ global (project overrides global for overlapping keys)
  state.settings = { ...DEFAULT_SETTINGS, ...globalSettings, ...(meta.settings || {}) };
  state.goals = { ...DEFAULT_GOALS, ...(meta.goals || {}) };
  applySettings();
}

// นำ settings ปัจจุบันไปใช้: ขนาดฟอนต์ตัวแก้ไข + จับเวลา autosave
export function applySettings() {
  applyZoomVars();
  applyUIScale();
  // [alpha.165] ช่องสวิตช์บนแถบสถานะต้องตามค่าที่เพิ่งบันทึกจากกล่องตั้งค่า (bug hunt: ติ๊กเลขบรรทัดในตั้งค่าแล้วปุ่มไม่ติดไฟ)
  try { syncStatusToggles(); } catch {}
  // [alpha.78] กฎการอ่านบท (ผู้ใช้ตั้งเอง) → ส่งให้ fountain.js ก่อนอย่างอื่นเสมอ
  // ทุกอย่างที่พาร์สบทหลังจากนี้ (ตัวแก้ไข/แบ่งหน้า/ส่งออก) ต้องใช้กฎชุดเดียวกัน
  setSpRules({ dialogueContinues: state.settings.spDialogueContinues === true });
  const spFmt = applyPageVars();                     // [85] ขนาดกระดาษ + ระยะขอบ + รูปแบบ element บทหนัง
  // [61] แสดงรูปแบบ — คืนสถานะจาก settings ทุกครั้งที่โหลด/เปลี่ยนค่าตั้ง
  setFormatGuide(!!state.settings.spShowFormat, spFmt);
  // [alpha.127] เครื่องหมายจุดผิดในเอกสาร — คืนสถานะจาก settings เช่นเดียวกัน
  if (setSpErrorMarksOn(state.settings.spErrorMarks !== false)) {
    for (const t2 of state.tabs.values()) if (t2.sp && t2.sp.view) refreshSpErrorMarks(t2.sp.view);
  }
  document.body.classList.toggle('sp-show-format', !!state.settings.spShowFormat);
  document.documentElement.style.setProperty('--home-thumb',
    Math.max(120, Math.min(400, parseInt(state.settings.homeThumb, 10) || 190)) + 'px');
  document.body.classList.toggle('k-ln', !!state.settings.lineNumbers);
  scheduleLineGutter();                              // [60r2 ข้อ 11] รางเลขบรรทัดฝั่ง UI
  applyPaperClass();                                 // [alpha.99 ข้อ 2] กระดาษเปิดตลอด ไม่มีสวิตช์
  document.body.classList.toggle('k-fab-off', state.settings.fabEnabled === false);   // [60r2 ข้อ 9]
  applyTheme();                                      // [60r2 ข้อ 10] ธีมสว่าง/มืดของ UI
  // [alpha.147] ผู้ใช้เพิ่งตั้งคีย์ลัดใหม่ → tooltip ของทุกปุ่ม + accelerator ในเมนูระบบต้องตามทันที
  try { applyCommandUi(); syncMenuToggles(); } catch {}
  // [alpha.57a ข้อ 5] ฟอนต์ตามภาษา — ต้องมาก่อนตั้ง --ed-font/--sp-font เพราะจะเอา "K2 Lang" ไปนำหน้า
  const nLang = applyProjectLangFonts();
  // [alpha.58r บั๊ก 18] ฟอนต์เริ่มต้นของ "นิยาย" = ตัวพิมพ์แบบสัดส่วน ไม่ใช่ Courier (ฟอนต์บท)
  //
  // [alpha.97 ข้อ 12] ★ **ตัดชั้น override ของ "รูปแบบนิยาย" ทิ้ง** (`settings.prose.fontFamily`)
  // ผู้ใช้: *"ฟอนต์ตัวอักษร เรามี override มั่วไปหมด · ฟอนต์นิยาย เอาออกไปใช้กับฟอนต์ตามภาษา"*
  // เดิมมีสามชั้นทับกันโดยไม่มีใครบอกว่าชั้นไหนชนะ — เหลือชั้นเดียว: สแตกฐาน (ตั้งค่า → ทั่วไป)
  // แล้วค่อยให้ "ฟอนต์ตามภาษา" แทนที่เป็นช่วงอักขระ ซึ่งละเอียดกว่าและตั้งได้ทีละภาษา
  const pf = proseFormat();
  const edStack = state.settings.fontFamily || DEFAULT_PROSE_FONT;
  // [alpha.144] ★ ต่อ "ตาข่ายรองอักษรไทย" ท้ายสแตกเสมอ — ผู้ใช้ที่ตั้งฟอนต์ละตินล้วน
  // (เช่น `"Courier New", monospace`) เคยได้ Ayuthaya จาก Chromium = วรรณยุกต์ลอย
  document.documentElement.style.setProperty(
    '--ed-font', withThaiFallback(withLangFamily(edStack, nLang.prose > 0)));
  applyProseVars(pf);                                // [16][17][23][24] ย่อหน้า/ช่วงบรรทัด/หัวข้อ/ยกคำพูด
  // ฟอนต์บทหนังแยกจากนิยาย (บั๊ก #2) — ว่าง = Courier Final Draft เช่นกัน
  // [alpha.97 ข้อ 12] บทมีวงศ์ของตัวเอง ("K2 SP") ที่สร้างจากแถวที่ target = screenplay/all
  // — รวมแถว "ไทย 85%" ที่เดิมเป็นระบบแยก (spThaiFont) เข้ามาอยู่ในตารางเดียวกันแล้ว
  const spStack = state.settings.spFontFamily || DEFAULT_SCRIPT_FONT;
  document.documentElement.style.setProperty(
    '--sp-font', withThaiFallback(withSpFamily(spStack, nLang.screenplay > 0)));
  // [alpha.82] ฟอนต์เปลี่ยน = ความกว้างที่วัดไว้ใช้ไม่ได้แล้ว
  refreshTextMeasurer();
  // [alpha.109] ★ …และฟอนต์ `@font-face` ยังโหลดไม่เสร็จตอนนี้ — canvas จะวัดด้วยฟอนต์สำรอง
  // เงียบ ๆ · รอให้โหลดจริงแล้ววัดใหม่ + จัดหน้าใหม่ ไม่งั้นค่าที่ผิดค้างทั้งเซสชัน
  remeasureAfterFonts();
  // [alpha.57a ข้อ 1] เสียงเครื่องพิมพ์ดีด
  setTypeVolume(state.settings.typeSoundVolume ?? 0.5);
  syncTypeSound();
  applySpellcheck();
  refreshAllSpell();
  applyMarkdownCodes();                              // [60r3 ข้อ 6] ซ่อนรหัสนำหน้าบรรทัด
  restartAutosave();
}

// ---- [alpha.60r3 ข้อ 6] ซ่อน/แสดงรหัสนำหน้าบรรทัด (fountain + มาร์กดาวน์) ----
// เก็บใน settings.showMarkdownCodes · ค่าเริ่มต้น = true (ซ่อน = อ่านสบายกว่า)
export function showMarkdownCodes() { return state.settings.showMarkdownCodes !== false; }

/** ผลักค่าปัจจุบันลงปลั๊กอิน แล้วสั่งวาดใหม่เฉพาะตอนค่าเปลี่ยนจริง (บทเรียน 44) */
export function applyMarkdownCodes() {
  const changed = setMarkdownCodes(showMarkdownCodes());
  if (!changed) return false;
  for (const tb of state.tabs.values()) {
    if (tb.editor && tb.editor.view) refreshMarkdownCodes(tb.editor.view);
    for (const se of (tb.wiki?.secEditors || [])) if (se.k?.view) refreshMarkdownCodes(se.k.view);
  }
  return true;
}

export function toggleMarkdownCodes() {
  state.settings.showMarkdownCodes = !showMarkdownCodes();
  applyMarkdownCodes();
  saveGlobalSetting('showMarkdownCodes', state.settings.showMarkdownCodes);   // [alpha.162 · W3]
  saveProjectMetaSoon();
  refreshToolbar(); syncMenuToggles();
  setStatus(showMarkdownCodes() ? tt('ui.app.hidePageLineOpen') : tt('ui.app.hidePageLineClose'));
  return showMarkdownCodes();
}

// ตั้งตัวแปร CSS ของหน้ากระดาษ
//   --ed-fs / --sp-fs = ขนาดฟอนต์ฐาน + ค่าที่ผู้ใช้ตั้ง (uiFontSize) — ไม่คูณซูมแล้ว
//   --page-scale      = อัตราซูมจริง ส่งให้ CSS `zoom` บนหน้ากระดาษ (ขยายฟอนต์+ระยะขอบ+ความกว้างพร้อมกัน)
// เดิมซูมคูณเข้าที่ฟอนต์อย่างเดียว → margin/padding คงที่ หน้าเลยเสียสัดส่วน (บั๊ก #7)
/**
 * [alpha.58r บั๊ก 14] ขนาดตัวอักษรของ "เปลือก UI" — แยกขาดจากเอกสาร
 * เดิม settings.uiFontSize (ชื่อบอกว่าเป็นของ UI) ถูกบวกเข้ากับขนาดฟอนต์ของเอกสารโดยตรง
 * → ปรับขนาด UI ทีเดียว ต้นฉบับเปลี่ยนขนาดตาม (และ pt ที่กรอกไว้ก็ไม่ตรงกับที่พิมพ์ออกมา)
 * ตอนนี้ uiFontSize ไปที่ --ui-fs อย่างเดียว · เอกสารใช้ edFontPt/spFontPt ล้วน ๆ
 */
export function uiFontOffset() {
  const n = parseInt(state.settings.uiFontSize, 10);
  return Number.isFinite(n) ? Math.max(-6, Math.min(16, n)) : 0;
}
export function applyZoomVars(uiOff) {
  const R = document.documentElement.style;
  const off = uiOff === undefined ? uiFontOffset() : (parseInt(uiOff, 10) || 0);
  R.setProperty('--ui-fs', (14 + off) + 'px');
  // ขนาดฐาน = พอยต์ที่ผู้ใช้กรอกใน "ตั้งค่า → การเขียน" (ค่าเริ่มต้น 12pt ทั้งนิยายและบทหนัง)
  // [บั๊ก 26] หนีบทั้งสองฝั่งเหมือนกัน — เดิม edfs ไม่ถูกหนีบเลย (ตั้ง 1pt แล้วได้ค่าติดลบ)
  // [alpha.81r ข้อ 1+2] ขนาดฟอนต์นิยายเคยมี **สองที่เก็บ** ที่ไม่รู้จักกัน:
  //   · `settings.edFontPt`     → --ed-fs  (สิ่งที่เห็นบนจอ)
  //   · `settings.prose.fontPt` → proseExportCss / มุมมองเรียงหน้า (สิ่งที่ได้ตอนส่งออก)
  // ตั้งช่องหนึ่งแล้วอีกช่องไม่ขยับ → จอกับไฟล์ไม่ตรงกัน และหน้ากระดาษในโหมดเรียงหน้า
  // จุตัวอักษรไม่เท่ากับโหมดจัดหน้า (ข้อ 8) · ตอนนี้ **`prose.fontPt` เป็นตัวจริงตัวเดียว**
  // (`edFontPt` เหลือไว้อ่านเป็นค่าเริ่มต้นของโปรเจกต์เก่าเท่านั้น — ดู proseFormatSettings)
  const edBase = ptToPx(proseFormat().fontPt);
  const spBase = ptToPx(state.settings.spFontPt ?? 12);
  const edfs = Math.max(9, Math.min(96, +edBase.toFixed(2)));
  const spfs = Math.max(9, Math.min(96, +spBase.toFixed(2)));
  R.setProperty('--ed-fs', edfs + 'px');
  R.setProperty('--sp-fs', spfs + 'px');
  refreshTextMeasurer();     // [alpha.82] ขนาดตัวอักษรเปลี่ยน = ความกว้างที่แคชไว้ใช้ไม่ได้
  R.setProperty('--page-scale', pageScale.toFixed(3));
  bumpProseLayout();          // [alpha.82] ขนาดฟอนต์เปลี่ยน = ต้องวัดหน้าใหม่
  repaginateAfterGeometry();  // [alpha.104r] …และต้องมีคนสั่งวัดจริง ไม่ใช่แค่ล้างแคช
  syncWorkspaceWidths();
  // [alpha.100r บั๊ก 1] ซูมเปลี่ยนความกว้างของ workspace → ตัวแก้ไขถูกจัดกึ่งกลางใหม่
  // แนวนอนของแผ่นเป็น CSS ล้วนแล้วจึงตามเองอัตโนมัติ · ที่นี่แค่รีเฟรชแนวตั้งให้ชัวร์
  try { renderPaperSheets(state.active); } catch {}
  try { retunePagePads(state.active); } catch {}
  const slider = $('#zoom-slider'); if (slider) slider.value = String(Math.round(pageScale * 100));
  const lbl = $('#zoom-label'); if (lbl) lbl.textContent = Math.round(pageScale * 100) + '%';
}

// ═════════ [alpha.60r2 ข้อ 11] เลขบรรทัด = UI ไม่ใช่หมึกบนกระดาษ ═════════
// เดิมวาดด้วย `::before` ของบล็อกใน ProseMirror → เลขอยู่ "ในระยะขอบของกระดาษ"
// จึงเลื่อนตามกระดาษ ย่อ/ขยายตามซูม และไปโผล่บนหน้าที่พิมพ์ออกมาได้
// ตอนนี้เป็นรางซ้ายของแผงแบบ VS Code: อยู่นอกกล่องที่ถูก zoom · ไม่เลื่อนตามแนวนอน
// · ไม่กินความกว้างของข้อความเลย (absolute + pointer-events:none)
const LN_GUTTER_ID = 'k-ln-gutter';
let _lnJob = 0;
/** ขอวาดรางเลขบรรทัดใหม่ในเฟรมถัดไป (รวบหลายเหตุการณ์ให้เหลือครั้งเดียว) */
export function scheduleLineGutter() {
  if (_lnJob) return;
  _lnJob = requestAnimationFrame(() => { _lnJob = 0; try { refreshLineGutter(); } catch {} });
}
function lnGutterEl(make) {
  let g = document.getElementById(LN_GUTTER_ID);
  if (!g && make) {
    const box = $('#panes');
    if (!box) return null;
    g = el('div', 'k-ln-gutter'); g.id = LN_GUTTER_ID;
    box.appendChild(g);
  }
  return g || null;
}
/**
 * [alpha.99 ข้อ 3] จำนวนบรรทัด .md ของบล็อกแต่ละใบ — แคชผูกกับตัว doc
 * (พิมพ์ทีเดียว doc เปลี่ยนตัวใหม่เสมอ จึงเทียบด้วย === ได้ตรง ๆ)
 */
let _lnCache = null;
function lnCountsOf(tab) {
  const ed = tab && tab.editor;
  if (!ed || !ed.mdLineCounts) return null;
  const doc = ed.view.state.doc;
  if (_lnCache && _lnCache.doc === doc) return _lnCache.counts;
  let counts = null;
  try { counts = ed.mdLineCounts(); } catch { counts = null; }
  _lnCache = { doc, counts };
  return counts;
}

/**
 * [alpha.99 ข้อ 3] "บรรทัดย่อย" ที่ต้องวาดเลขให้ในบล็อกหนึ่งใบ
 *   · รายการ      → หนึ่งข้อหนึ่งเลข
 *   · คำพูดยกมา   → หนึ่งย่อหน้าหนึ่งเลข
 *   · Shift+Enter → หนึ่งท่อนที่คั่นด้วย <br> หนึ่งเลข
 * ไม่เข้าเคสไหนเลย (บล็อกโค้ด ฯลฯ) = วาดเลขเดียวที่หัวบล็อก ตามเดิม
 * @returns {Array<{top:number, height:number, el?:Element}>}
 */
function lnSubRows(kid, span) {
  const box = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, height: r.height, el: e }; };
  const one = () => [box(kid)];
  if (span <= 1) return one();
  const tag = (kid.tagName || '').toLowerCase();
  if (tag === 'ul' || tag === 'ol' || tag === 'blockquote') {
    const rows = [...kid.children]
      .filter((e) => e.nodeType === 1 && !e.classList.contains('ed-page-break')
                     && !e.classList.contains('sp-page-break'))
      .map(box).filter((b) => b.height > 0);
    return rows.length ? rows : one();
  }
  // ย่อหน้าที่มี hard break — <br> ของ ProseMirror ที่ปิดท้ายบล็อกว่างไม่นับ
  const brs = [...kid.querySelectorAll(':scope > br')]
    .filter((b) => !b.classList.contains('ProseMirror-trailingBreak'));
  if (!brs.length) return one();
  const r0 = kid.getBoundingClientRect();
  const tops = [r0.top, ...brs.map((b) => b.getBoundingClientRect().bottom)];
  return tops.map((tp, k) => ({
    top: tp,
    height: (k + 1 < tops.length ? tops[k + 1] : r0.bottom) - tp,
    el: kid,
  }));
}

/**
 * ══════ [alpha.108] ★★ `k2PageDoctor()` — ตรวจหน้ากระดาษของเอกสารที่เปิดอยู่ ══════
 *
 * ที่มา: ผู้ใช้เจอ "หน้าเหลื่อม/ไม่ยอมตัดหน้า" ในเอกสารจริงของตัวเอง แต่เทสในเครื่องพัฒนา
 * (ซึ่งใช้ค่าตั้งต้นทุกอย่าง) จำลองไม่ได้เลยแม้กวาดครบทุกระยะเลื่อนของรอยต่อหน้า
 * → ตัวแปรที่ต่างกันคือ **การตั้งค่าบนเครื่องผู้ใช้** (ฟอนต์ · ช่วงบรรทัด · ระยะขอบ · ซูม)
 *
 * แทนที่จะถามทีละค่า ให้เอกสารรายงานตัวเอง: เปิด DevTools แล้วพิมพ์ `k2PageDoctor()`
 * ได้รายงานที่บอกครบว่าเพี้ยนที่ชั้นไหน — โมเดล · การวาด · หรือกริดบรรทัด
 *
 * ตรวจสามชั้นเดียวกับที่ e2e ใช้:
 *   1. **โมเดล** — แต่ละหน้าใช้กี่บรรทัดจากโควตา (เกิน = ตัวจัดหน้าเองผิด)
 *   2. **กริด** — ความสูงจริงของบล็อกเท่ากับจำนวนบรรทัดที่จองไว้ไหม (บทภาพยนตร์)
 *   3. **ของจริงบนจอ** — มีบรรทัดไหนล้ำกรอบพื้นที่พิมพ์ของแผ่นตัวเองไหม
 */
/* i18n-skip: k2PageDoctor — เครื่องมือวินิจฉัยของนักพัฒนา เรียกจาก DevTools เท่านั้น
   ไม่มี UI ไม่มีปุ่ม ป้ายในรายงานเป็นไทยเพื่อให้ผู้ใช้ก๊อปผลส่งกลับมาได้ทันที */
export function k2PageDoctor(opt) {
  const t = (opt && opt.tab) || state.active;
  const out = { ok: true, problems: [] };
  if (!t || !(t.editor || t.sp)) { out.ok = false; out.problems.push('ไม่มีเอกสารเปิดอยู่'); return out; }
  const fmt = spFormat();
  const pane = t.pane;
  const pm = pane && pane.querySelector(':scope > .workspace > .ProseMirror');
  const z = pm ? (zoomFactorOf(pm) || 1) : 1;
  const R = getComputedStyle(document.documentElement);
  out.env = {
    โหมด: t.sp ? 'บทภาพยนตร์' : 'นิยาย',
    มุมมอง: currentSpView(),
    กระดาษ: fmt.paper.width + '×' + fmt.paper.height + ' นิ้ว',
    ระยะขอบ: [fmt.margins.top, fmt.margins.right, fmt.margins.bottom, fmt.margins.left].join('/'),
    ซูม: Math.round(z * 100) + '%',
    ฟอนต์บท: R.getPropertyValue('--sp-font').trim().slice(0, 60),
    ฟอนต์นิยาย: R.getPropertyValue('--ed-font').trim().slice(0, 60),
    ขนาดบท: R.getPropertyValue('--sp-fs').trim(),
    ความสูงบรรทัดบท: R.getPropertyValue('--sp-line-h').trim(),
    ช่วงบรรทัดที่ตั้ง: spLineHeight(),
    บรรทัดต่อหน้า: formatLines(fmt),
  };

  // ── ชั้น 1: โมเดล ──
  if (t.sp) {
    const blocks = blocksFromDoc(t.sp.view.state.doc);
    const pg = pagesOf(blocks, fmt);
    const per = formatLines(fmt);
    const used = pg.pages.map((p) => (p.blocks || []).reduce((s, b) => s + (b.lines || 1), 0));
    out.model = { หน้า: pg.count, โควตาบรรทัด: per, ใช้จริงต่อหน้า: used };
    const over = used.map((u, i) => (u > per ? (i + 1) + ':' + u : null)).filter(Boolean);
    if (over.length) {
      out.ok = false;
      out.problems.push('โมเดล: หน้าที่ใช้เกินโควตา → ' + over.join(', '));
    }
    // ── ชั้น 2: กริดบรรทัด (เฉพาะบท — โมเดลของบทจองที่เป็นจำนวนบรรทัด) ──
    if (pm) {
      const lh = parseFloat(R.getPropertyValue('--sp-line-h')) || 16;
      const els = [...pm.children].filter((e) => e.nodeType === 1 && e.classList.contains('sp'));
      const bad = [];
      let prevBlank = false;
      els.forEach((el, i) => {
        const b = blocks[i];
        if (!b) return;
        const isBlank = b.el === 'blank';
        const c = fmt.elements[b.el] || fmt.elements.action;
        const st = (fmt.styles[b.el] || fmt.styles.action).screen;
        const body = isBlank ? 1
          : wrapLines(b.text, elementWidthIn(fmt, b.el), undefined, elementCaps(fmt, b.el), st);
        const before = (i > 0 && !isBlank && !prevBlank)
          ? Math.round(num(c.linesBefore, 10) / 10) : 0;
        prevBlank = isBlank;
        const want = (body + before) * lh;
        const got = el.getBoundingClientRect().height / z;
        if (Math.abs(got - want) > 1.5) {
          bad.push({ ที่: i, ชนิด: b.el, สูงจริง: +got.toFixed(1), ที่จองไว้: +want.toFixed(1),
                     ข้อความ: String(b.text || '').slice(0, 24) });
        }
      });
      out.grid = { บล็อกทั้งหมด: els.length, สูงไม่ตรงโมเดล: bad.length, รายการ: bad.slice(0, 12) };
      if (bad.length) {
        out.ok = false;
        out.problems.push('กริด: ' + bad.length + ' บล็อกสูงไม่เท่าที่โมเดลจองไว้ (หน้าจะล้นสะสม)');
      }
    }
  } else {
    const mz = proseMeasured(t, fmt);
    out.model = mz
      ? { หน้า: mz.pages.length, ความสูงพื้นที่พิมพ์: +mz.contentHeight.toFixed(1),
          แปลงพิกัดกลับ: { ...CUT_FAIL } }
      : { หน้า: '?', หมายเหตุ: 'วัดไม่ได้ (แท็บถูกซ่อนอยู่?)' };
    const brN = pm ? pm.querySelectorAll('.ed-page-break').length : 0;
    const want = mz ? mz.pages.length - 1 : -1;
    out.model.เส้นคั่นบนจอ = brN;
    if (mz && brN !== want) {
      out.ok = false;
      out.problems.push('เส้นคั่นหน้าถูกวาด ' + brN + ' เส้น แต่ควรมี ' + want
                        + ' (บางจุดแปลงพิกัดกลับไม่สำเร็จ)');
    }
  }

  // ── ชั้น 3: ของจริงบนจอ (ต้องอยู่ในมุมมองจัดหน้าจึงจะมีแผ่นให้เทียบ) ──
  const sheets = pane ? [...pane.querySelectorAll('.k-paper-layer > .k-paper-sheet')] : [];
  if (pm && sheets.length) {
    const spills = lineSpills(pm, sheets, num(fmt.margins.top, 1) * 96 * z,
                              num(fmt.margins.bottom, 1) * 96 * z);
    out.screen = { แผ่น: sheets.length, บรรทัดล้ำกรอบ: spills.length,
                   ตัวอย่าง: spills.slice(0, 8) };
    if (spills.length) {
      out.ok = false;
      out.problems.push('จอ: ' + spills.length + ' บรรทัดล้ำกรอบพื้นที่พิมพ์');
    }
  } else {
    out.screen = { หมายเหตุ: 'เปิดมุมมอง "จัดหน้า" ก่อน จึงจะตรวจของจริงบนจอได้' };
  }

  if (out.ok) out.problems.push('ไม่พบความผิดปกติ');
  try { console.log('%ck2PageDoctor', 'font-weight:bold', out); } catch {}
  return out;
}
/* /i18n-skip */

/**
 * ══ [alpha.105r] ★ "บรรทัดไหนล้ำกรอบเส้นตัดตกบ้าง" — วิธีวัดหน้าเหลื่อมที่ตรงที่สุด ══
 *
 * ผู้ใช้: *"เอาง่าย ๆ เราใช้วิธีวัดจากการเปิดตัดตก"* — ถูกที่สุด เพราะกรอบประคือพื้นที่พิมพ์จริง
 *
 * ★ ต้องวัด **กล่องบรรทัด** ไม่ใช่กล่องบล็อก: บล็อกที่ถูกผ่ากลางกินพื้นที่คร่อมสองแผ่น
 * โดยชอบธรรม (นั่นคือความหมายของการผ่า) แต่ **บรรทัดเดียวคร่อมไม่ได้เลย** —
 * บรรทัดที่ตกนอกกรอบของแผ่นตัวเองคือสิ่งที่ตาเห็นว่า "เหลื่อม"
 *
 * @param {HTMLElement} pm      element ของตัวแก้ไข
 * @param {Element[]} sheets    แผ่นกระดาษที่ปูไว้ (.k-paper-sheet)
 * @param {number} mgTopPx      ระยะขอบบน (px หลังคูณซูมแล้ว)
 * @param {number} mgBotPx      ระยะขอบล่าง
 * @returns {string[]} รายการบรรทัดที่ล้ำ พร้อมระยะที่ล้ำ (ว่าง = ไม่มีเลย)
 */
export function lineSpills(pm, sheets, mgTopPx, mgBotPx) {
  const out = [];
  if (!pm || !sheets || !sheets.length) return out;
  const boxes = sheets.map((sh) => {
    const r = sh.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, gTop: r.top + mgTopPx, gBot: r.bottom - mgBotPx };
  });
  const rng = document.createRange();
  const wlk = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = wlk.nextNode(); n; n = wlk.nextNode()) {
    const par = n.parentElement;
    if (!par || par.closest('.ed-page-break, .sp-page-break, .k-scene-no, .sp-page-num')) continue;
    rng.selectNodeContents(n);
    for (const r of rng.getClientRects()) {
      if (!(r.height > 0 && r.width > 0)) continue;
      const key = Math.round(r.top) + ':' + Math.round(r.left);
      if (seen.has(key)) continue;
      seen.add(key);
      const mid = (r.top + r.bottom) / 2;
      const b = boxes.find((x) => mid >= x.top - 1 && mid <= x.bottom + 1);
      if (!b) { out.push('off-sheet:' + Math.round(r.top)); continue; }
      // ══ [alpha.114] ★ ค่าเผื่อต้องมาจาก "ฟอนต์จริง" ไม่ใช่ตัวเลขตายตัว ══
      //
      // `getClientRects()` ของโหนดข้อความคืน **กล่องบรรทัดตามเมตริกฟอนต์** (ascent+descent)
      // ซึ่ง **สูงกว่า `line-height` ได้** เมื่อฟอนต์มีหางบน/ล่างยาว — ไทยเป็นแบบนั้นทุกตัว
      // วัดจริงในเทส: `h=21.0 lh=16px` = ล้นข้างละ 2.5px ทั้งที่ตัวหนังสืออยู่ตรงกริดเป๊ะ
      // ค่าเผื่อ 2px ตายตัวจึงฟ้องผิดตลอด (`top-3.0`) แล้วกลบเคสที่ล้นจริง ๆ ไปด้วย
      //
      // ที่ถูกคือเผื่อ **ครึ่งหนึ่งของส่วนที่กล่องกลิฟเกิน line-height** — บรรทัดที่ล้นจริง
      // จะเกินเป็นระดับหนึ่งบรรทัดเต็ม (16px) ซึ่งยังห่างจากค่าเผื่อนี้มาก จึงไม่มีทางรอด
      const lhPx = parseFloat(getComputedStyle(par).lineHeight);
      const slack = 2 + (Number.isFinite(lhPx) && r.height > lhPx ? (r.height - lhPx) / 2 : 0);
      // ข้อความวินิจฉัยล้วน (ไม่ใช่ UI) — ใช้อักษรละตินเพื่อไม่ให้ประตูกัน i18n จับผิดตัว
      const info = ' h=' + r.height.toFixed(1) + ' lh=' + lhPx + ' el=' + par.className;
      if (r.bottom > b.gBot + slack) out.push('bottom+' + (r.bottom - b.gBot).toFixed(1) + info);
      else if (r.top < b.gTop - slack) out.push('top-' + (b.gTop - r.top).toFixed(1) + info);
    }
  }
  return out;
}


/**
 * วาดเลขบรรทัดของแท็บที่กำลังใช้งาน — คืนจำนวนเลขที่วาดจริง (0 = ปิด/ไม่มีอะไรให้นับ)
 * วาดเฉพาะบล็อกที่อยู่ในสายตา (เอกสารยาวหลายพันย่อหน้าจึงไม่หน่วง)
 */
export function refreshLineGutter() {
  const t = state.active;
  const pane = t && t.pane;
  // [alpha.90 ข้อ 5] wiki มีตัวแก้ไขหลายกล่องในหน้าเดียว — รางเดียวนับรวมไม่มีความหมาย
  // จึงให้ **แต่ละกล่องมีรางของตัวเอง** นับเริ่มที่ 1 ของกล่องนั้น (รางกลางยังปิดอยู่)
  if (pane && pane.classList.contains('wiki-pane')) return refreshWikiLineNos(pane);
  const pmEl = pane && !pane.classList.contains('wiki-pane')
    ? pane.querySelector(':scope > .workspace > .ProseMirror') : null;
  // มุมมองเรียงหน้า/ภาพรวม = อ่านอย่างเดียว ไม่มีเคอร์เซอร์ → ปิดเลขบรรทัดอัตโนมัติ
  const show = !!state.settings.lineNumbers && !!pmEl && !isPageView(currentSpView());
  const g = lnGutterEl(show);
  if (!g) return 0;
  g.classList.toggle('on', show);
  if (!show) { g.textContent = ''; return 0; }
  const box = g.parentElement;
  const hr = box.getBoundingClientRect();
  const pr = pane.getBoundingClientRect();
  if (!pr.height) { g.textContent = ''; return 0; }
  // รางทาบบน "แผงที่ใช้งานอยู่" — แยกหน้าจอแล้วเลขต้องไปอยู่กับช่องที่กำลังพิมพ์ ไม่ใช่ขอบซ้ายสุด
  g.style.left = Math.round(pr.left - hr.left) + 'px';
  g.style.top = Math.round(pr.top - hr.top) + 'px';
  g.style.height = Math.round(pr.height) + 'px';
  // ══ [alpha.99 ข้อ 3] ★ เลขบรรทัดยึด "ไฟล์ .md" เป็นแหล่งความจริง ══
  //
  // ผู้ใช้: *"ใน markdown มี 642 ใน editor มี 638 · ทำไมไม่ใช้ markdown เป็น reference"*
  //
  // ของเดิมนับ "ลูกของ .ProseMirror" ทีละใบ = เดาเอาว่าหนึ่งบล็อกคือหนึ่งบรรทัด
  // ซึ่งไม่จริงกับรายการ (5 ข้อ = 1 บล็อก) · คำพูดยกมาหลายย่อหน้า · Shift+Enter · บล็อกโค้ด
  // แถมยังนับ **แถบคั่นหน้า** (widget) เป็นบรรทัดด้วยตั้งแต่มันมีความสูงจริงใน alpha.98
  //
  // ตอนนี้ถามตัวเขียนไฟล์ตรง ๆ ว่าบล็อกใบนี้กินกี่บรรทัดใน .md แล้วไล่เลขตามนั้น
  // → ตัวเลขสุดท้ายบนรางเท่ากับจำนวนบรรทัดในไฟล์เสมอ ไม่ต้องเดาอีก
  const counts = lnCountsOf(t);
  const kids = [...pmEl.children].filter((e) => e.nodeType === 1
    && !e.classList.contains('ed-page-break')
    && !e.classList.contains('sp-page-break')
    && !e.classList.contains('ProseMirror-gapcursor'));
  const frag = document.createDocumentFragment();
  const zoom = parseFloat(getComputedStyle(pmEl.parentElement).zoom) || 1;
  let n = 0;
  let lineNo = 1;                       // เลขบรรทัดใน .md ของบล็อกที่กำลังจะวาด
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    const span = counts && counts[i] > 0 ? counts[i] : 1;
    const start = lineNo;
    lineNo += span;
    const r = kid.getBoundingClientRect();
    if (!r.height) continue;
    const top0 = r.top - pr.top;
    if (top0 > pr.height + 60) break;              // เลยขอบล่างของแผงแล้ว — ที่เหลือไม่ต้องดู
    if (top0 + r.height < -60) continue;           // ยังอยู่เหนือขอบบน
    // บล็อกที่กินหลายบรรทัดใน .md → วาดเลขให้ทุกบรรทัดย่อย ตามตำแหน่งที่วาดจริง
    const subs = lnSubRows(kid, span);
    for (let k = 0; k < subs.length; k++) {
      const sr = subs[k];
      // [alpha.87 ข้อ C] ★ เลขต้องทาบ "บรรทัดข้อความแรก" ไม่ใช่ขอบบนของกล่อง
      // ตั้งแต่ระยะเว้นบรรทัดของบทย้ายจาก margin ไปเป็น padding (เพื่อให้ตรงกับโมเดล)
      // ขอบบนกล่อง = บนสุดของช่องไฟนำ ไม่ใช่ตัวหนังสือ → เลขลอยสูงขึ้นเรื่อย ๆ ตามระยะเว้น
      const csPad = k === 0 ? parseFloat(getComputedStyle(kid).paddingTop) : 0;
      const padTop = Number.isFinite(csPad) ? csPad * zoom : 0;
      const top = sr.top - pr.top + padTop;
      if (top > pr.height + 60) break;
      if (top + sr.height < -60) continue;
      const csLh = parseFloat(getComputedStyle(sr.el || kid).lineHeight);
      const lineH = Math.min(sr.height, (Number.isFinite(csLh) ? csLh * zoom : sr.height));
      const d = el('div', 'k-ln-no', String(start + k));
      d.style.top = Math.round(top) + 'px';
      d.dataset.lineh = String(Math.round(lineH));
      frag.appendChild(d); n++;
    }
  }
  g.textContent = '';
  g.appendChild(frag);
  // วัดความสูงจริงของตัวเลขได้หลังอยู่ใน DOM แล้วเท่านั้น (ขนาดตามฟอนต์ + --ui-scale)
  for (const d of g.children) {
    const lineH = +d.dataset.lineh || 0;
    const off = (lineH - d.offsetHeight) / 2;
    if (off > 0.5) d.style.top = Math.round(parseFloat(d.style.top) + off) + 'px';
  }
  return n;
}
/**
 * [alpha.90 ข้อ 5] เลขบรรทัดในหน้า Wiki — หนึ่งรางต่อหนึ่งกล่องเนื้อหา
 * ระวัง: ราง**อยู่ในกล่อง**ไม่ใช่ลอยทับทั้งแผง → ปิด/เปิดหัวข้อแล้วเลขไม่ค้างผิดที่
 * และล้างรางเก่าทุกครั้งก่อนวาด ไม่งั้น render() ของ WikiEditor ทำให้เลขซ้อนกันเป็นชั้น ๆ
 */
export function refreshWikiLineNos(pane) {
  const show = !!state.settings.lineNumbers;
  let n = 0;
  for (const box of pane.querySelectorAll('.wiki-sec-ed')) {
    let g = box.querySelector(':scope > .wiki-ln');
    if (!show) { if (g) g.remove(); continue; }
    const pm = box.querySelector(':scope > .ProseMirror');
    if (!pm) { if (g) g.remove(); continue; }
    if (!g) { g = el('div', 'wiki-ln'); box.insertBefore(g, box.firstChild); }
    const br = box.getBoundingClientRect();
    const frag = document.createDocumentFragment();
    const kids = pm.children;
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect();
      if (!r.height) continue;
      const d = el('div', 'wiki-ln-no', String(i + 1));
      d.style.top = Math.round(r.top - br.top) + 'px';
      frag.appendChild(d); n++;
    }
    g.textContent = '';
    g.appendChild(frag);
  }
  pane.classList.toggle('wiki-ln-on', show);
  return n;
}
/** ผูกเหตุการณ์ที่ทำให้เลขบรรทัดต้องขยับ (เลื่อนจอ/พิมพ์/สลับแท็บ) — เรียกครั้งเดียวตอนเริ่มโปรแกรม */
let _lnBound = false;
export function initLineGutter() {
  if (_lnBound) return false;
  const box = $('#panes');
  if (!box) return false;
  // capture — เหตุการณ์ scroll ไม่ bubble ต้องดักขาลง
  box.addEventListener('scroll', scheduleLineGutter, true);
  _lnBound = true;
  scheduleLineGutter();
  return true;
}

/**
 * [alpha.60r2 ข้อ 1] "ซูมแล้วหน้ากระดาษตกขอบซ้าย"
 * `.workspace` ถูกย่อ/ขยายด้วย CSS `zoom` → 1 หน่วยข้างในเท่ากับ pageScale พิกเซลจริงบนจอ
 * เดิมตั้ง `min-width:(pageScale*100)%` ซึ่งพึ่งการตีความ % ใต้ `zoom` — ต่างกันตามเวอร์ชันเบราว์เซอร์
 * ผลที่ผู้ใช้เจอ: ซูมออกแล้ว workspace แคบกว่าแผง → หน้ากระดาษ (margin:auto) ไปกองชิดขอบซ้าย
 * ตอนนี้วัดเป็นพิกเซลตรง ๆ: กว้าง = พื้นที่แผง ÷ อัตราซูม → บนจอเท่ากับความกว้างแผงพอดีทุกระดับซูม
 * ⚠ ตั้งเฉพาะ min-width — `width:max-content` ของหน้ากระดาษยังชนะเสมอเมื่อกระดาษกว้างกว่าแผง
 */
export function syncWorkspaceWidths() {
  const z = pageScale > 0 ? pageScale : 1;
  for (const ws of document.querySelectorAll('.pane > .workspace, .roster-wrap > .workspace')) {
    const box = ws.parentElement;
    const w = box ? box.clientWidth : 0;
    ws.style.minWidth = w > 0 ? Math.round(w / z) + 'px' : '';
  }
}

// ---------------- [85] หน้ากระดาษ: ขนาด + ระยะขอบ + รูปแบบ element บทหนัง ----------------
/** ค่าตั้งรูปแบบบทหนังที่ผู้ใช้กำหนดไว้ (ดิบ — ยังไม่ merge) */
export function spFormatSettings() {
  const s = state.settings || {};
  return { paperSize: s.paperSize, paper: s.customPaper, margins: s.pageMargins,
           elements: s.spElements, styles: s.spStyles, rules: s.spPageRules, strings: s.spStrings,
           sceneNumbers: s.spSceneNumbers, pageNumbers: s.spPageNumbers,
           continued: s.spContinued,              // [alpha.58 · 55–56]
           // [alpha.61 ข้อ 4] สวิตช์ "บังคับพิมพ์ใหญ่ตามมาตรฐาน" — ปิดแล้วทุกทางออกเลิกบังคับพร้อมกัน
           forceCase: s.spForceCase !== false,
           lineHeight: s.spLineHeight };          // [alpha.58r บั๊ก 5+9] ต้องเข้าไปใน fmt ด้วย
}
/** รูปแบบบทหนังที่ใช้จริง (merge กับค่ามาตรฐานแล้ว) — โมดูลอื่นเรียกตัวนี้ */
export function spFormat() { return mergeSpFormat(spFormatSettings()); }

/** ตั้งตัวแปร CSS ของหน้ากระดาษ + สร้าง CSS ต่อ element ของบทหนังใหม่ (ข้อ 81–85) */
/**
 * [alpha.100 ข้อ 4] สีกระดาษที่ผู้ใช้เลือก → ตัวแปร CSS ทั้งชุด
 *
 * ผู้ใช้: *"หน้ากระดาษที่เป็นสีเหลือง check เลยว่ามีจุดไหน ให้เปลี่ยนเป็นสีขาวให้หมด
 *           หรือทำ option ให้ผู้ใช้เปลี่ยนสีที่ต้องการได้"* — ทำทั้งสองอย่าง:
 * ค่าเริ่มต้นเป็นขาว และเลือกสีเองได้ที่ ตั้งค่า → หน้ากระดาษ
 *
 * ที่สำคัญกว่าตัว --paper คือ **สีข้างเคียง**: เดิมขอบแผ่น/เส้นประ/พื้นบล็อกโค้ดเป็นเลข
 * โทนครีมฝังตายอยู่ใน style.css คนละที่กัน → เปลี่ยนแค่ --paper จะได้ "กระดาษขาวขอบครีม"
 * ตอนนี้ทุกตัวคำนวณจากสีกระดาษสีเดียว (paper-color.js) จึงเข้ากันทุกสีที่เลือกโดยอัตโนมัติ
 *
 * @returns {string} สีกระดาษที่ใช้จริง (hex 6 หลัก)
 */
export function applyPaperVars() {
  const hex = normalizePaperColor(state.settings.paperColor || PAPER_DEFAULT, PAPER_DEFAULT);
  const R = document.documentElement.style;
  const vars = paperVars(hex);
  for (const k of Object.keys(vars)) R.setProperty(k, vars[k]);
  // [alpha.100 ข้อ 2] เส้นบอกระยะขอบกระดาษ — สวิตช์เดียว ครบทั้งสี่ด้านทุกแผ่น
  document.body.classList.toggle('k-page-guides', !!state.settings.pageGuides);
  return hex;
}

export function applyPageVars() {
  const fmt = spFormat();
  applyPaperVars();          // [alpha.100 ข้อ 4] สีกระดาษต้องพร้อมก่อนใครวาดแผ่น
  const R = document.documentElement.style;
  const vars = pageCssVars(fmt);
  for (const k of Object.keys(vars)) R.setProperty(k, vars[k]);
  let st = document.getElementById('k-sp-format');
  if (!st) { st = document.createElement('style'); st.id = 'k-sp-format'; document.head.appendChild(st); }
  st.textContent = spCss(fmt);
  // [alpha.57a ข้อ 2] เลขฉาก + เลขหน้า — สวิตช์เดียวคุมทั้งตัวแก้ไขและมุมมองหน้ากระดาษ
  if (setSceneNumbers(!!fmt.sceneNumbers.show, fmt.sceneNumbers.suffix)) {
    for (const tb of state.tabs.values()) if (tb.sp) refreshSceneNumbers(tb.sp.view);
  }
  document.body.classList.toggle('sp-page-numbers', !!fmt.pageNumbers.show);
  // [alpha.83 ข้อ 4] ป้ายเลขหน้าบนเส้นคั่นหน้า (หน้า 2 เป็นต้นไปในโหมดปกติ/จัดหน้า)
  // เปลี่ยนพร้อมสวิตช์ทันที ไม่ต้องรอรอบจัดหน้าถัดไป
  // [alpha.159 · H15] เส้นคั่นเป็นของแต่ละตัวแก้ไขแล้ว — ถามทีละแท็บว่าป้ายของมันเปลี่ยนไหม
  for (const tb of state.tabs.values()) {
    if (tb.sp && setSpPageNumberLabel(pageNumberLabelFor(fmt), tb.sp.view)) tb.sp.refreshGuides();
    if (tb.editor && setProsePageNumberLabel(prosePageNumberLabelFor(fmt), tb.editor.view)) refreshProsePageBreaks(tb.editor.view);
  }
  // [alpha.58 · 58] Layout View — ความสูงเนื้อหน้า/ช่องว่างคั่นหน้า คิดจากขนาดกระดาษจริง
  const lv = layoutCssVars(fmt, state.settings.spPageGap);
  for (const k of Object.keys(lv)) R.setProperty(k, lv[k]);
  bumpProseLayout();          // [alpha.82] ขนาดกระดาษ/ระยะขอบเปลี่ยน = ต้องวัดหน้าใหม่
  repaginateAfterGeometry();  // [alpha.104r] สั่งจัดหน้าใหม่จริง ๆ (ทั้งนิยายและบท)
  // [alpha.58 บั๊ก 3] ช่วงบรรทัดบทภาพยนตร์ — มาตรฐาน = 1 (6 บรรทัด/นิ้ว) ปรับได้ที่ตั้งค่า
  R.setProperty('--sp-lh', String(spLineHeight()));
  // [alpha.58r บั๊ก 8] "แสดงรูปแบบ" เก็บ fmt ไว้ในตัวมันเอง — ถ้าไม่ส่งของใหม่ให้ทุกครั้งที่
  // ขนาดกระดาษ/ระยะขอบเปลี่ยน เส้นขอบ element จะยังวาดตามค่าเก่า (ตำแหน่งเพี้ยนแบบเงียบ ๆ)
  setFormatGuide(isFormatGuide(), fmt);
  for (const tb of state.tabs.values()) if (tb.sp) tb.sp.refreshGuides();
  // [alpha.58r บั๊ก 15+20] ตัวเลขหน้ากระดาษฝั่งนิยาย (ใช้ขนาดกระดาษ/ระยะขอบชุดเดียวกัน)
  const pv = proseLayoutCssVars(proseFormat(), fmt.paper, fmt.margins, state.settings.spPageGap);
  for (const k of Object.keys(pv)) R.setProperty(k, pv[k]);
  // [alpha.100 ข้อ 3] ขนาดกระดาษ/ช่องว่างเปลี่ยน = แผ่นที่ปูไว้ต้องขยับตามทันที
  try { renderPaperSheets(state.active); } catch {}
  return fmt;
}

// ---------------- [alpha.58r บั๊ก 16–24] รูปแบบ "นิยาย" ----------------
/**
 * ค่ารูปแบบนิยายที่ผู้ใช้ตั้ง (ดิบ) — เก็บก้อนเดียวใน project.khn.json → settings.prose
 *
 * [alpha.81r ข้อ 1] โปรเจกต์เก่าเก็บขนาดฟอนต์นิยายไว้ที่ `settings.edFontPt` (คนละที่กับ
 * `settings.prose.fontPt` ที่ใช้ตอนส่งออก) — เปิดโปรเจกต์เก่าแล้วต้องได้ขนาดเดิม ไม่ใช่ 12pt
 * จึงรับค่าเก่ามาเป็น "ค่าเริ่มต้น" เมื่อ `prose.fontPt` ยังไม่เคยถูกตั้ง
 */
export function proseFormatSettings() {
  const p = (state.settings || {}).prose || {};
  if (p.fontPt === undefined && (state.settings || {}).edFontPt !== undefined) {
    return { ...p, fontPt: num(state.settings.edFontPt, 12) };
  }
  return p;
}
/** รูปแบบนิยายที่ใช้จริง (merge กับค่ามาตรฐานแล้ว) */
export function proseFormat() { return mergeProseFormat(proseFormatSettings()); }
/** ยัดตัวแปร CSS + <style> ของรูปแบบนิยายเข้าหน้าเว็บ */
export function applyProseVars(fmt) {
  const f = fmt || proseFormat();
  const R = document.documentElement.style;
  const vars = proseCssVars(f);
  for (const k of Object.keys(vars)) R.setProperty(k, vars[k]);
  let st = document.getElementById('k-prose-format');
  if (!st) { st = document.createElement('style'); st.id = 'k-prose-format'; document.head.appendChild(st); }
  // [alpha.82] ชุดที่สองสำหรับ "สำเนาเนื้อหา" ในมุมมองหน้ากระดาษ — ตัวเลือกฐานของชุดแรก
  // ผูกกับ .pane > .workspace จึงไม่โดนสำเนาที่อยู่ในกล่องครอบ ทำให้หน้ากระดาษเสียรูปแบบ
  st.textContent = proseCss(f) + '\n' + proseCss(f, '.ed-page-clip > .ProseMirror');
  bumpProseLayout();          // [alpha.82] ช่วงบรรทัด/ย่อหน้า/หัวข้อเปลี่ยน = ต้องวัดหน้าใหม่
  repaginateAfterGeometry();  // [alpha.104r] สั่งจัดหน้าใหม่จริง ๆ
  return f;
}

/** ช่วงบรรทัดของบทภาพยนตร์ (เท่าไรก็ได้ 1–2 · ค่ามาตรฐานอุตสาหกรรม = 1) */
export function spLineHeight() {
  const v = parseFloat(state.settings.spLineHeight);
  return Number.isFinite(v) && v >= 0.8 && v <= 2.5 ? v : 1;
}

// ---------------- [alpha.57a ข้อ 5] ฟอนต์ตามภาษา ----------------
/** URL ของไฟล์ฟอนต์: ฝังมากับโปรแกรม → assets/fonts/ · ของโปรเจกต์ → Fonts/ (เก็บ URL ที่ resolve แล้ว) */
const _langFontUrls = new Map();          // ชื่อไฟล์ในโปรเจกต์ → file:// URL (เติมโดย preloadLangFontUrls)
let _projectFontFiles = [];               // [alpha.159] ไฟล์ฟอนต์ทั้งหมดใน Fonts/ ของโปรเจกต์
/** [alpha.159] ชื่อไฟล์ฟอนต์ใน Fonts/ ที่อ่านไว้ล่าสุด (กล่องตั้งค่าใช้ทำรายการ) */
export const projectFontFiles = () => [..._projectFontFiles];
export function langFontUrl(row) {
  if (row.builtin) return 'assets/fonts/' + row.builtin;
  if (row.file) return _langFontUrls.get(row.file) || '';
  return '';
}
/** อ่านที่อยู่จริงของไฟล์ฟอนต์ในโปรเจกต์ล่วงหน้า (kapi เป็น async — CSS ต้องการ URL แบบ sync) */
export async function preloadLangFontUrls() {
  const rows = normalizeLangFonts(state.settings.langFonts);
  // [alpha.159] ทุกไฟล์ใน Fonts/ ของโปรเจกต์ (ไม่ใช่แค่ที่แถวฟอนต์ตามภาษาอ้างถึง) — กล่องตั้งค่าเลือกเป็น
  // ฟอนต์นิยาย/บท/หัวข้อได้ตรง ๆ จึงต้องมี @font-face ของทุกไฟล์ (ดู projectFontFaceCss)
  _projectFontFiles = [];
  if (state.root) {
    try {
      const dir = await kapi.join(state.root, 'Fonts');
      if (await kapi.exists(dir)) _projectFontFiles = (await kapi.listFiles(dir)).filter((f) => FONT_FILE_RE.test(f));
    } catch {}
  }
  const need = [...new Set([...rows.map((r) => r.file), ..._projectFontFiles])]
    .filter((f) => f && !_langFontUrls.has(f));
  if (!need.length || !state.root) return _langFontUrls.size;
  for (const f of need) {
    try {
      const p = await kapi.join(state.root, 'Fonts', f);
      if (await kapi.exists(p)) _langFontUrls.set(f, await kapi.toFileURL(p));
    } catch {}
  }
  return _langFontUrls.size;
}
/** ยัด @font-face ตามภาษาเข้า <head> — คืนจำนวนแถวที่ใช้จริง */
export function applyProjectLangFonts() {
  // [alpha.97 ข้อ 12] โปรเจกต์เก่ามี `spThaiFont` เป็นระบบแยก → ย้ายมาเป็นแถวในตารางก่อนใช้
  // (ทำครั้งเดียวโดยธรรมชาติ — migrateSpThai เห็นแถวของบทที่คุมช่วงไทยแล้วจะไม่ยุ่งอีก)
  if (state.settings.spThaiFont) {
    const mig = migrateSpThai(state.settings.langFonts, state.settings.spThaiFont);
    state.settings.langFonts = mig.rows;
    delete state.settings.spThaiFont;
    if (mig.moved) log('info', tt('ui.app.migSpThaiFont'));
  }
  // [alpha.159] วงศ์ของไฟล์ใน Fonts/ — ชื่อวงศ์ = ชื่อไฟล์ไม่มีนามสกุล
  {
    let st = document.getElementById('k-project-fonts');
    if (!st) { st = document.createElement('style'); st.id = 'k-project-fonts'; document.head.appendChild(st); }
    st.textContent = projectFontFaceCss(_projectFontFiles, (f) => _langFontUrls.get(f) || '');
  }
  return applyLangFonts(state.settings.langFonts, langFontUrl);
}
/**
 * [alpha.81 ข้อ 8] `@font-face` สำหรับ **ไฟล์ HTML ที่ออกไปนอกโปรแกรม**
 *
 * `langFontUrl()` คืนที่อยู่แบบ **สัมพัทธ์** (`assets/fonts/x.ttf`) ซึ่งใช้ได้เฉพาะใน renderer/
 * ไฟล์ HTML ที่เราเขียนออกไป (หรือไฟล์ชั่วคราวที่หน้าต่างซ่อนใช้ทำ PDF) อยู่คนละที่ →
 * ที่อยู่สัมพัทธ์นั้นชี้ไปไม่ถึงไฟล์ ฟอนต์เลยตกไปตัวสำรองเงียบ ๆ (ไทยกลายเป็นสี่เหลี่ยม)
 * ตัวนี้แปลงทุกแถวเป็น `file://` เต็มก่อน จึงฝังลง HTML ที่ไปอยู่ที่ไหนก็ได้
 * @returns {Promise<string>} CSS ก้อนเดียว (ว่าง = ไม่มีฟอนต์ที่ต้องฝัง)
 */
export async function exportFontCss() {
  try {
    await preloadLangFontUrls();
    const dir = await kapi.join(await kapi.appDir(), 'renderer');
    const abs = new Map();
    for (const r of normalizeLangFonts(state.settings.langFonts)) {
      if (!r.builtin) continue;
      const p = await kapi.join(dir, 'assets', 'fonts', r.builtin);
      if (await kapi.exists(p)) abs.set(r.builtin, await kapi.toFileURL(p));
    }
    // [alpha.97 ข้อ 12] ต้องออกทั้งสองวงศ์ — ไฟล์ที่ส่งออกมีทั้งเนื้อนิยายและบทในเล่มเดียวกันได้
    const url2 = (row) => (row.builtin ? (abs.get(row.builtin) || '') : langFontUrl(row));
    return projectFontFaceCss(_projectFontFiles, (f) => _langFontUrls.get(f) || '') + '\n'
      + buildLangFontCss(state.settings.langFonts, url2,
                            { family: LANG_FAMILY, target: 'prose' })
      + '\n' + buildLangFontCss(state.settings.langFonts, url2,
                                { family: SP_FAMILY, target: 'screenplay' });
  } catch (e) { log('warn', tt('ui.app.exportFontCssFail'), e); return ''; }
}

// ---------------- [alpha.57a ข้อ 1] เสียงเครื่องพิมพ์ดีด ----------------
// เล่นเมื่อ "เปิดเสียง" และ (อยู่ในโหมดเครื่องพิมพ์ดีด หรือ ตั้งให้เล่นตลอด)
// ดัก keydown ที่ระดับเอกสารแบบ capture — ทำงานได้ทั้งตัวแก้ไขในแท็บและในหน้าต่างลอย
let _typeSoundBound = false;
function onTypeKey(ev) {
  if (!isTypeSound()) return;
  if (!isEditorTarget(ev)) return;
  const kind = soundKindFor(ev);
  if (kind) playType(kind);
}
/** ให้สถานะเสียงตรงกับ settings + โหมดเครื่องพิมพ์ดีดปัจจุบัน */
export function typeSoundMode() {
  const s = state.settings || {};
  if (s.typeSoundMode === 'typewriter' || s.typeSoundMode === 'always') return s.typeSoundMode;
  // โปรเจกต์รุ่นก่อนมีแค่ typeSoundAlways (ค่าเริ่มต้น false) → แปลงเป็นโหมดใหม่
  return s.typeSoundAlways === false ? 'typewriter' : 'always';
}
export function syncTypeSound() {
  const s = state.settings || {};
  // [alpha.60r2 ข้อ 4] เปิด "เสียงพิมพ์ดีด" แล้วต้องได้ยินทันที ไม่ต้องไปเปิดสวิตช์ที่สองอีก
  const want = !!s.typeSound && (typeSoundMode() === 'always' || isTypewriter());
  setTypeSound(want);
  if (want && !_typeSoundBound) {
    document.addEventListener('keydown', onTypeKey, true);
    _typeSoundBound = true;
  }
  return want;
}

// ปรับซูมทีละขั้น (Ctrl+ล้อ / Ctrl+±) — step เป็นสัดส่วน
function bumpPageScale(dir) { setPageScale(pageScale + (dir > 0 ? 0.1 : -0.1)); }
// บั๊ก #5: ซูมต้อง "ยึดจุดกึ่งกลางหน้าจอ" ไม่ใช่มุมซ้ายบน
// เก็บสัดส่วนจุดกึ่งกลางของพื้นที่เลื่อนก่อนซูม แล้วคืนตำแหน่งให้ตรงจุดเดิมหลังซูม
function scrollHosts() {
  return [...document.querySelectorAll('.pane.on, .k-split-pane > .pane, .roster-wrap > .workspace')]
    .filter((e) => e && e.scrollWidth);
}
/**
 * ความกว้าง "เนื้อหาจริง" ของกล่องที่เลื่อนได้ — วัดจาก .workspace (ลูกที่ถูก zoom)
 * [alpha.58r บั๊ก 1] เดิมวัดจาก host.scrollWidth ซึ่งปน `min-width:<pageScale*100>%`
 * ที่ JS ตั้งไว้ → สัดส่วนไม่เป็นเส้นตรงกับระดับซูม ยิ่งซูมออกยิ่งเพี้ยน จนเด้งไปชิดขอบซ้าย
 * .workspace เป็น `width:max-content` = ความกว้างของหน้ากระดาษก่อนซูมเสมอ (คงที่ทุกระดับซูม)
 */
function contentWidthOf(host) {
  const ws = host.querySelector(':scope > .workspace') || host.querySelector('.workspace');
  const w = ws ? ws.scrollWidth : 0;
  return Math.max(1, w || host.scrollWidth);
}
function keepZoomCenter(fn) {
  const hosts = scrollHosts();
  const before = hosts.map((h) => ({
    h,
    // ใช้ "ตำแหน่งกึ่งกลางเทียบกับพื้นที่ที่เลื่อนได้" — 0 เมื่อยังไม่มีอะไรให้เลื่อน
    // (สัดส่วนเทียบความกว้างเนื้อหาจะเพี้ยนเมื่อ clientWidth เปลี่ยนตามระดับซูม)
    fx: Math.max(0, h.scrollWidth - h.clientWidth) > 0
      ? h.scrollLeft / (h.scrollWidth - h.clientWidth) : 0.5,
    fy: Math.max(0, h.scrollHeight - h.clientHeight) > 0
      ? h.scrollTop / (h.scrollHeight - h.clientHeight) : 0,
    cw: contentWidthOf(h),
  }));
  fn();
  // คืนตำแหน่ง "ทั้งทันทีและใน rAF ถัดไป" (บทเรียนข้อ 36)
  // อ่าน scrollWidth บังคับให้ layout อัปเดตก่อน จึงเซ็ตได้ถูกตั้งแต่รอบแรก —
  // และไม่ต้องพึ่ง rAF ที่ Chromium หยุดยิงเมื่อหน้าต่างถูกบัง/ไม่ได้อยู่หน้าสุด (บทเรียนข้อ 14i-2)
  // [alpha.62 บั๊ก 8] บังคับให้เป็น "การตั้งค่า" ไม่ใช่ "อนิเมชัน" ตลอดช่วงคืนตำแหน่ง
  // ซูมด้วย Ctrl+ล้อรัว ๆ = keepZoomCenter ซ้อนกันหลายรอบ · ถ้าค่าที่อ่านได้เป็นค่ากลางทาง
  // ของอนิเมชันรอบก่อน สัดส่วน fx จะไหลลงเรื่อย ๆ จนหน้ากระดาษไปติดขอบซ้าย (บทเรียน 71)
  const prevBehavior = before.map((b) => b.h.style.scrollBehavior);
  for (const b of before) b.h.style.scrollBehavior = 'auto';
  const restore = () => {
    for (const b of before) {
      const maxX = Math.max(0, b.h.scrollWidth - b.h.clientWidth);
      const maxY = Math.max(0, b.h.scrollHeight - b.h.clientHeight);
      b.h.scrollLeft = Math.max(0, Math.min(maxX, b.fx * maxX));
      b.h.scrollTop = Math.max(0, Math.min(maxY, b.fy * maxY));
    }
  };
  restore();
  requestAnimationFrame(() => {
    restore();
    before.forEach((b, i) => { b.h.style.scrollBehavior = prevBehavior[i] || ''; });
  });
  // rAF ไม่ยิงเมื่อหน้าต่างถูกบัง (บทเรียน 76) → มี timer สำรองคืนค่าเสมอ
  setTimeout(() => { before.forEach((b, i) => { b.h.style.scrollBehavior = prevBehavior[i] || ''; }); }, 120);
}
function setPageScale(z) {
  keepZoomCenter(() => {
    pageScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(z * 100) / 100));
    applyZoomVars();
  });
  _userScale = pageScale;
  setStatus(t('status.zoom') + ': ' + Math.round(pageScale * 100) + '%' + ' (Ctrl+Shift+0 = ' + t('status.zoomReset') + ')');
}
function resetPageScale() {
  if (pageScale === 1) return;
  keepZoomCenter(() => { pageScale = 1; applyZoomVars(); });
  _userScale = pageScale;
  setStatus(t('status.zoomReset'));
}
/**
 * [alpha.58 บั๊ก 3] "พอดีความกว้าง" — ย่อ/ขยายให้หน้ากระดาษเต็มพื้นที่พอดี
 * ผู้ใช้เทียบกับโปรแกรมอื่นแล้วรู้สึกว่ากระดาษ/ตัวหนังสือใหญ่เกิน เพราะโปรแกรมบทส่วนใหญ่
 * เปิดมาที่ "fit width" ไม่ใช่ 100% (8.5 นิ้วจริง = 816px ซึ่งกว้างกว่าพื้นที่ทำงานทั่วไป)
 * @returns {number} อัตราซูมที่ตั้งได้จริง
 */
export function zoomFitWidth(pane) {
  const p = pane || (state.active && state.active.pane);
  const z = fitScaleOf(p);
  keepZoomCenter(() => { pageScale = z; applyZoomVars(); });
  _userScale = pageScale;
  setStatus(tt('ui.app.zoomFitWide') + Math.round(z * 100) + '%');
  return z;
}
/** อัตราซูมที่ทำให้หน้ากระดาษพอดีความกว้างของ pane (ตัวคำนวณเดียวของ zoomFitWidth + ตัวอัตโนมัติ) */
function fitScaleOf(p) {
  const fmt = spFormat();
  const pageW = (+fmt.paper.width || 8.5) * 96;
  // เผื่อขอบซ้าย-ขวาไว้เล็กน้อย + ที่ว่างของแถบเลื่อนแนวตั้ง
  const avail = Math.max(200, (p ? p.clientWidth : window.innerWidth) - 48);
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(avail / pageW * 100) / 100));
}

// ══ [alpha.164 · รอบต่อ 2 · งาน 3] ซูมพอดีความกว้างอัตโนมัติ (ค่าระดับผู้ใช้ `autoFitWidth` · ปิดเป็นค่าเริ่มต้น) ══
// แผงเอกสารแคบกว่ากระดาษ → ย่อให้พอดี (ตัวคำนวณเดียวกับ "พอดีความกว้าง") · แผงกว้างขึ้น → ขยายกลับ
// **แต่ไม่เกินซูมที่ผู้ใช้ตั้งเองล่าสุด** (`_userScale`) — ตัวอัตโนมัติมีหน้าที่ "ไม่ให้กระดาษล้น" เท่านั้น
// ไม่ใช่ไปขยายกระดาษของคนที่ตั้งใจใช้ 80% · โหมดเทสปิดเสมอ (เทสอื่นวัดตำแหน่งที่ซูม 100%)
// ยกเว้นเทสของฟีเจอร์นี้เองที่ตั้ง `globalThis.__k2autoFitTest`
let _userScale = null;
export function autoFitWidthOn() {
  if (!(state.settings && state.settings.autoFitWidth)) return false;
  if (sessionOff() && !globalThis.__k2autoFitTest) return false;
  return true;
}
/** @returns {boolean} true = เปลี่ยนซูมจริง */
export function autoFitWidth(pane) {
  if (!autoFitWidthOn()) return false;
  const p = pane || (state.active && state.active.pane);
  if (!p || !p.clientWidth || !p.isConnected) return false;
  if (_userScale == null) _userScale = pageScale;
  const want = Math.min(_userScale, fitScaleOf(p));
  if (Math.abs(want - pageScale) < 0.01) return false;
  keepZoomCenter(() => { pageScale = want; applyZoomVars(); });
  return true;
}
/** ปิดสวิตช์ = คืนซูมที่ผู้ใช้ตั้งไว้ (ไม่ค้างที่ค่าที่ตัวอัตโนมัติย่อไว้) */
export function autoFitWidthRestore() {
  if (_userScale == null || Math.abs(_userScale - pageScale) < 0.01) return;
  const z = _userScale;
  keepZoomCenter(() => { pageScale = z; applyZoomVars(); });
}
/**
 * [alpha.164 · รอบต่อ 3 · งาน 3] สวิตช์ "ซูมพอดีความกว้างอัตโนมัติ" — ทางกลางของทุกทางเข้า
 * (เมนู มุมมอง → ซูม · คลิกขวาที่ป้ายซูมบนแถบสถานะ · คำสั่ง `auto-fit-width`)
 * ค่าระดับผู้ใช้ → `saveGlobalSetting` คู่กับ `saveProjectMetaSoon` (กฎ W3) · กล่องตั้งค่าบันทึกเอง ส่ง `save:false`
 * @param {boolean} [on]  ไม่ส่ง = สลับ
 */
export function setAutoFitWidth(on, { save = true, was = !!state.settings.autoFitWidth } = {}) {
  const v = on === undefined ? !was : !!on;
  state.settings.autoFitWidth = v;
  if (save) { saveGlobalSetting('autoFitWidth', v); saveProjectMetaSoon(); }
  if (v !== was) { if (v) autoFitWidth(); else autoFitWidthRestore(); }
  syncMenuToggles();
  if (save) setStatus(tt(v ? 'ui.app.autoFitWidthOn' : 'ui.app.autoFitWidthOff'));
  return v;
}
/** เมนูคลิกขวาที่ป้ายซูม (แถบสถานะ) — คำสั่งซูมชุดเดียวกับเมนู มุมมอง → ซูม */
function zoomLabelMenu(e) {
  e.preventDefault();
  popupMenu(e.clientX, e.clientY, [
    { text: tt('ui.menu.expand'), cmd: 'zoom:1', click: () => handleCommand('zoom', 1) },
    { text: tt('ui.menu.collapse'), cmd: 'zoom:-1', click: () => handleCommand('zoom', -1) },
    { text: tt('ui.menu.resetZoom'), cmd: 'zoom:0', click: () => handleCommand('zoom', 0) },
    { text: tt('ui.menu.fitWidePagePaper'), cmd: 'zoom:fit', click: () => handleCommand('zoom', 'fit') },
    '-',
    { text: tt('ui.setTpl.autoFitWidth'), checked: !!state.settings.autoFitWidth,
      click: () => handleCommand('auto-fit-width') },
  ]);
}
export function currentPageScale() { return pageScale; }

/** เลื่อนหน้ากระดาษให้อยู่กึ่งกลางแนวนอน (บั๊ก #7 — มุมมองเริ่มต้นตอนเปิด/สร้างฉาก) */
export function centerPage(pane) {
  const p = pane || (state.active && state.active.pane);
  if (!p || !p.scrollWidth) return;
  const maxX = Math.max(0, p.scrollWidth - p.clientWidth);
  const mid = maxX / 2;
  const col = maxX > 0 ? textColumnX(p) : null;
  p.scrollLeft = col ? pageScrollTarget(maxX, p.clientWidth, col.l, col.r) : mid;
}
/**
 * [alpha.164 · งาน 6] ตำแหน่งเลื่อนแนวนอนเมื่อแผงเอกสาร "แคบกว่ากระดาษ"
 * จัดกระดาษกึ่งกลาง = ล้นทั้งสองข้างเท่ากัน · แต่ถ้าแผงแคบจนการจัดกลางตัด **คอลัมน์ข้อความ**
 * (ขอบซ้ายกระดาษกว้างกว่าขอบขวา → ต้นบรรทัดหลุดซ้ายก่อน) ผู้ใช้เห็นแต่กลางประโยค
 * กติกา: จัดกลางกระดาษได้ถ้ายังเห็นข้อความครบ · ไม่งั้นจัดกลาง "คอลัมน์ข้อความ" ·
 * คอลัมน์กว้างกว่าแผง = โชว์ต้นบรรทัด (อ่านจากซ้ายไปขวาแล้วเลื่อนต่อ)
 * @param {number} maxX  ระยะเลื่อนได้สูงสุด · @param {number} cw ความกว้างที่เห็น
 * @param {number} l @param {number} r  ขอบคอลัมน์ข้อความในพิกัดเนื้อหา (scrollLeft = 0)
 */
export function pageScrollTarget(maxX, cw, l, r) {
  const clamp = (x) => Math.max(0, Math.min(maxX, x));
  const mid = clamp(maxX / 2);
  if (!(r > l)) return mid;
  if (l >= mid - 1 && r <= mid + cw + 1) return mid;           // จัดกลางกระดาษแล้วเห็นข้อความครบ
  const tw = r - l;
  if (tw <= cw) return clamp(l - (cw - tw) / 2);                // จัดกลางคอลัมน์ข้อความ
  return clamp(l - Math.min(24, (cw - 0) * 0.05));              // ข้อความกว้างกว่าแผง → ต้นบรรทัด
}
/** ขอบคอลัมน์ข้อความ (ขอบกระดาษ + ระยะขอบซ้าย/ขวา) ในพิกัดเนื้อหาของ pane — null = หาไม่ได้ */
function textColumnX(p) {
  const pm = p.querySelector(':scope > .workspace > .ProseMirror');
  if (!pm) return null;
  const pr = pm.getBoundingClientRect(), hr = p.getBoundingClientRect();
  const cs = getComputedStyle(pm);
  const cssW = parseFloat(cs.width) || 0;
  if (!(pr.width > 0) || !(cssW > 0)) return null;
  // ค่าที่คำนวณได้กับกรอบบนจออยู่คนละหน่วยเมื่อมี CSS zoom → แปลงด้วยอัตราส่วนความกว้างของกล่องเดียวกัน
  const k = pr.width / cssW;
  const x0 = pr.left - hr.left - p.clientLeft + p.scrollLeft;
  return { l: x0 + (parseFloat(cs.paddingLeft) || 0) * k, r: x0 + pr.width - (parseFloat(cs.paddingRight) || 0) * k };
}
/**
 * [alpha.66r5] จัดหน้ากระดาษกลับกึ่งกลางหลังพื้นที่เปลี่ยนขนาด (เข้า/ออกโหมดโฟกัส · โหมดอ่าน)
 * ต้องหน่วง: ตอนสั่งสลับโหมด แผงข้างยังไม่หายจาก layout — วัด scrollWidth ทันทีจะได้ค่าของเก่า
 * แล้วกระดาษค้างชิดซ้ายทุกครั้ง · ตั้งซ้ำหลายจังหวะเพราะ ProseMirror จัดหน้าใหม่ไม่พร้อมกัน
 */
function recenterPageSoon(pane) {
  // ══ [alpha.116 ข้อ 2] ★ ต้องวัดความกว้างของ workspace ใหม่ก่อน ไม่ใช่แค่เลื่อนจอ ══
  //
  // ผู้ใช้: *"โหมดเต็มจอยังขึ้นแบบเบี่ยงซ้าย ไม่กลางจอ"*
  //
  // ต้นตอ: กระดาษถูกจัดกึ่งกลางด้วย `margin:auto` ของ `.ProseMirror` **ภายใน `.workspace`**
  // ซึ่งกว้างเท่ากับ `min-width` ที่ `syncWorkspaceWidths()` ตั้งไว้เป็นพิกเซล (= ความกว้าง
  // ของ pane หารด้วยซูม) · เข้าโหมดเต็มจอ/โฟกัสไม่ได้ทำให้หน้าต่าง resize จึงไม่มีใครเรียก
  // `syncWorkspaceWidths()` เลย → workspace ยังกว้างเท่าตอนมีแผงข้าง = แคบกว่าจอ
  // กระดาษจึงกองอยู่ครึ่งซ้าย และ `centerPage()` (เลื่อน scrollLeft) ก็ช่วยไม่ได้
  // เพราะไม่มีอะไรให้เลื่อน (scrollWidth == clientWidth)
  const run = () => {
    syncWorkspaceWidths();
    const p = pane || (state.active && state.active.pane); if (p) centerPage(p);
  };
  requestAnimationFrame(run);
  for (const ms of [40, 120, 260]) setTimeout(run, ms);
}

/**
 * [alpha.66r5] เลย์เอาต์แผงเปลี่ยน → ถ้า "ความกว้างของพื้นที่เขียน" เปลี่ยนจริง ค่อยจัดกระดาษกลางใหม่
 * เช็คความกว้างก่อนเสมอ — ไม่งั้นทุกการวาดแผงจะไปดึงจอผู้ใช้ที่กำลังเลื่อนดูแนวนอนอยู่
 */
let _lastPaneW = 0;
function recenterOnPaneResize() {
  const p = state.active && state.active.pane;
  if (!p) return;
  const w = p.clientWidth;
  if (!w) return;
  if (Math.abs(w - _lastPaneW) < 20) { _lastPaneW = w; return; }
  _lastPaneW = w;
  autoFitWidth(p);                              // [alpha.164 · รอบต่อ 2 · งาน 3]
  recenterPageSoon(p);
}

// ═════════ alpha.57 · โหมดมุมมองบทภาพยนตร์ (ข้อ 57 · 59 · 60 · 61) ═════════
// normal   = ตัวแก้ไขบนหน้ากระดาษ (เดิม)
// draft    = ตัวแก้ไขแบบข้อความล้วน ไม่มีกระดาษ · เส้นคั่นหน้าเป็นเส้นบาง (ข้อ 57)
// side     = วาดหน้ากระดาษจริงเรียงกันหลายหน้า ปรับสเกลพอดีจอ (ข้อ 59 · อ่านอย่างเดียว)
// overview1/4 = หน้าเดียวกันย่อจนตัวอักษรเหลือ 1px / 4px (ข้อ 60 · อ่านอย่างเดียว)
// ═════════ [alpha.110] ★ มุมมองเป็นของ "แท็บ" ไม่ใช่ของโปรแกรม ═════════
//
// ผู้ใช้: *"ในช่องมุมมองของ editor มันไม่ sync กับฉากที่เปิดอยู่ ในกรณีสลับ tab หรือ split"*
//
// ต้นตอ: `spViewMode` เป็นตัวแปรก้อนเดียวทั้งโปรแกรม ขณะที่ **คลาสมุมมองถูกทาให้แผงที่ active
// เท่านั้น** (`setSpView` ถอดคลาสออกจากทุกแผงแล้วใส่กลับให้แผงเดียว) → พอสลับแท็บหรือแยกจอ
// แผงใหม่ไม่เคยได้คลาสเลย = อยู่มุมมองปกติ แต่กล่องเลือกยังโชว์ค่าเก่าของโปรแกรม
// → กล่องบอกอย่าง จอเป็นอีกอย่าง และกดเลือกค่าเดิมซ้ำก็ไม่เกิดอะไร (ค่าไม่เปลี่ยน)
//
// ตอนนี้แต่ละแท็บถือ `tab.spView` ของตัวเอง · `spViewMode` เหลือหน้าที่เดียวคือ
// "ค่าเริ่มต้นของแท็บที่เพิ่งเปิด" (เปิดฉากใหม่แล้วได้มุมมองเดียวกับที่กำลังใช้อยู่)
let spViewMode = 'normal';
/** มุมมองของแท็บหนึ่ง ๆ (แท็บที่ยังไม่เคยตั้ง = ค่าเริ่มต้นล่าสุด) */
export function viewOfTab(tab) {
  if (!tab) return spViewMode;
  return isValidView(tab.spView) ? tab.spView : 'normal';
}
export function currentSpView() {
  const tab = state.active;
  if (tab && (tab.sp || tab.editor)) return viewOfTab(tab);
  return spViewMode;
}

// ══ [alpha.116 ข้อ 4] ★ "กดเข้าหน้ากระดาษ" ต้องกลับไป **มุมมองแก้ไขล่าสุด** ไม่ใช่ปกติเสมอ ══
//
// ผู้ใช้: *"เมื่ออยู่โหมดหน้าคู่แล้วกดเข้าหน้ากระดาษ มักจะเป็นมุมมองปกติตลอด ต้องเป็นมุมมองล่าสุด"*
//
// ต้นตอ: ตัวจับคลิกใน `pageViewHost()` เขียน `setSpView('normal')` ไว้ตายตัวตั้งแต่ alpha.57
// ตอนนั้นมีมุมมองแก้ไขเดียว (ปกติ) จึงถูก — พอมี "จัดหน้า" กับ "ร่าง" เพิ่มเข้ามา
// คนที่ทำงานในโหมดจัดหน้าแล้วแวะดูหน้าคู่ จะถูกดีดกลับไปโหมดปกติทุกครั้ง
//
// ตอนนี้แต่ละแท็บจำ "มุมมองแก้ไขล่าสุดของตัวเอง" ไว้ (`tab._editView`) — จดตอนออกจาก
// มุมมองแก้ไขเท่านั้น จึงไม่มีวันเป็นมุมมองหน้ากระดาษเอง
/** มุมมองแก้ไขล่าสุดของแท็บ (ปกติ/จัดหน้า/ร่าง) — ไม่เคยตั้ง = 'normal' */
export function lastEditView(tab) {
  const v = tab && tab._editView;
  return (isValidView(v) && !isPageView(v)) ? v : 'normal';
}
/** ค่าเริ่มต้นสำหรับแท็บที่เพิ่งเปิด — เรียกจาก mountEditor ก่อนทามุมมองครั้งแรก */
export function seedTabView(tab) {
  if (!tab) return spViewMode;
  if (!isValidView(tab.spView)) tab.spView = spViewMode;
  tab._paneView = undefined;      // ตัวแก้ไขเพิ่งถูกสร้างใหม่ในแผงนี้ → ต้องทามุมมองใหม่จริง ๆ
  return viewOfTab(tab);
}

/** ล้างมุมมองหน้ากระดาษที่วาดไว้ (กลับไปใช้ตัวแก้ไข) */
function clearPageView(pane) {
  if (!pane) return;
  pane.querySelectorAll(':scope > .sp-pageview').forEach((n) => n.remove());
}

/** กล่องมุมมองหน้ากระดาษ (สร้างครั้งเดียวต่อ pane · ใช้ร่วมทั้งนิยายและบทหนัง) */
function pageViewHost(tab, gotoPos) {
  let host = tab.pane.querySelector(':scope > .sp-pageview');
  if (host) return host;
  host = el('div', 'sp-pageview');
  tab.pane.append(host);
  // คลิกหน้าไหน = ย้ายเคอร์เซอร์ไปตรงนั้นแล้วกลับโหมดปกติ (มุมมองภาพรวมมีไว้ "หา" ที่)
  host.addEventListener('click', (ev) => {
    const blk = ev.target.closest && ev.target.closest('[data-pos]');
    const page = ev.target.closest && ev.target.closest('.sp-page');
    if (!blk && !page) return;
    const pos = blk ? parseInt(blk.dataset.pos, 10)
                    : parseInt(page.querySelector('[data-pos]')?.dataset.pos ?? '', 10);
    setSpView(lastEditView(tab));
    if (Number.isFinite(pos)) gotoPos(pos);
  });
  return host;
}

/** สร้าง/รีเฟรชมุมมองหน้ากระดาษของแท็บบทหนัง */
function drawPageView(tab) {
  if (!tab || !tab.sp || !tab.pane) return 0;
  const fmt = spFormat();
  const blocks = blocksFromDoc(tab.sp.view.state.doc);
  const pg = pagesOf(blocks, fmt);
  const host = pageViewHost(tab, (pos) => tab.sp.gotoPos(pos));
  const pageWpx = fmt.paper.width * 96;
  const vs = viewScale(viewOfTab(tab), tab.pane.clientWidth || 900, pageWpx, 20);
  renderPageView(host, pg, fmt, { scale: vs.scale, perRow: vs.perRow, gap: 20,
                                  startPage: currentStartPage(tab) });
  return pg.count;
}

/**
 * [alpha.58r บั๊ก 15+20] มุมมองหน้ากระดาษของ "นิยาย"
 * ใช้คลาสของ pane ชุดเดียวกับบทภาพยนตร์ (sp-view-*) จึงได้ CSS หน้ากระดาษ/ช่องว่างคั่นหน้าฟรี
 */
// ═══ [alpha.82] การวัดหน้านิยายจากของจริงบนจอ — จุดเดียวที่ทุกคนเรียก ═══
// วัดครั้งหนึ่งใช้ได้ทั้งเส้นคั่นหน้าในตัวแก้ไข · จำนวนหน้าในแถบสถานะ · มุมมองหน้ากระดาษ
// แคชผูกกับ "ตัว doc" เพราะพิมพ์แล้ว doc เปลี่ยนตัวใหม่เสมอ · สิ่งที่เปลี่ยน layout ได้
// โดย doc ไม่เปลี่ยน (ฟอนต์/ระยะขอบ/ขนาดกระดาษ) ต้องเรียก bumpProseLayout() ล้างแคชเอง
let _mzCache = null;
let _mzEpoch = 0;
export function bumpProseLayout() { _mzEpoch++; _mzCache = null; bumpBookFlow(); }
// [alpha.141] เรขาคณิตเปลี่ยน = จำนวนหน้าของทุกฉากเปลี่ยน → สายหน้าของทั้งเล่มใช้ไม่ได้แล้ว
/** [alpha.103 ข้อ 5] รุ่นของ "เรขาคณิตร่วม" — ขยับเมื่อไหร่ = ผลวัด/ผลจัดหน้าเก่าใช้ไม่ได้แล้ว */
function proseLayoutEpoch() { return _mzEpoch; }
/** [alpha.103 ข้อ 5] ผลจัดหน้าล่าสุด — กันจัดหน้าซ้ำบนเอกสารตัวเดิมที่ยังไม่มีอะไรขยับ */
let _pagDone = null;

/**
 * ══════ [alpha.104r] ★★ เรขาคณิตเปลี่ยนโดยที่เอกสารไม่เปลี่ยน = ไม่มีใครมาปลุกตัวจัดหน้า ══════
 *
 * ผู้ใช้: *"หน้าไม่ถูก refresh หลังจากเปลี่ยนตัวอักษร ทำให้เหลื่อม"*
 *
 * ตัวจัดหน้าถูกเรียกจาก **การแก้เอกสาร** เท่านั้น (`scheduleCount` ← onChange · `repaginateOnEnter`)
 * ส่วนการเปลี่ยนฟอนต์/ขนาด/ระยะขอบ/ขนาดกระดาษ/ช่วงบรรทัด เรียกแค่ `bumpProseLayout()`
 * ซึ่ง **ล้างแคชผลวัดเฉย ๆ ไม่ได้สั่งวัดใหม่** → เส้นคั่นหน้า/จำนวนแผ่นยังเป็นของฟอนต์เดิม
 * จนกว่าผู้ใช้จะพิมพ์อะไรสักตัว = "เปลี่ยนฟอนต์แล้วหน้าเหลื่อม" ตรงตามที่เห็น
 * (วัดจริงในเทส: เปลี่ยน 12→22pt แล้วจำนวนหน้าค้างที่ 4 ทั้งที่ควรเป็น 8)
 *
 * หน่วงสั้น ๆ เพราะกล่องตั้งค่าเรียกซ้ำรัว ๆ ระหว่างลากตัวเลข — รวบให้จบทีเดียวหลังหยุดมือ
 */
/**
 * ══ [alpha.109] ★★ รอฟอนต์จริงโหลดเสร็จ แล้ววัดใหม่ + จัดหน้าใหม่ ══
 *
 * `canvas.measureText()` ใช้ฟอนต์ `@font-face` ได้ก็ต่อเมื่อโหลดแล้ว — ยังไม่โหลด =
 * **ตกไปวัดด้วยฟอนต์สำรองเงียบ ๆ** (ดูคอมเมนต์ยาวใน text-measure.js) แล้วจอกับโมเดล
 * ตัดบรรทัดคนละที่ทั้งเซสชัน · รวบเป็นงานเดียวกันสายเดียว: โหลด → วัดใหม่ → จัดหน้าใหม่
 * `_fontJob` กันยิงซ้ำตอนกล่องตั้งค่าเรียก applySettings() รัว ๆ
 */
let _fontJob = 0;
export function remeasureAfterFonts() {
  if (_fontJob) return false;
  _fontJob = 1;
  Promise.resolve(preloadMeasuredFonts())
    .then((ok) => {
      _fontJob = 0;
      if (!ok) return;
      bumpProseLayout();               // ผลวัดที่แคชไว้เป็นของฟอนต์สำรอง ใช้ต่อไม่ได้
      repaginateAfterGeometry();
    })
    .catch(() => { _fontJob = 0; });
  return true;
}

/**
 * ══ [alpha.143 ข้อ 1] ★★ รูปโหลดเสร็จทีหลัง = **หน้าเหลื่อมทั้งฉาก** ══
 *
 * ผู้ใช้: *"รูปใหญ่ เช่น 75% หรือรูปปกติ ทำให้การคำนวณตัดหน้าเหลื่อมหมดเลย"*
 *
 * `<img>` ที่ยังโหลดไม่เสร็จสูง 0 · ตัวจัดหน้าถูกปลุกด้วย "เอกสารเปลี่ยน" เท่านั้น จึงวัดตอนที่รูป
 * ยังไม่มีความสูง แล้ว **ไม่มีใครสั่งวัดใหม่อีกเลยตลอดอายุแท็บ** — เส้นคั่นหน้าทุกเส้นหลังรูป
 * จึงอยู่สูงกว่าความจริงประมาณหนึ่งรูปพอดี (ตระกูลเดียวกับ alpha.104r และ alpha.109 รอฟอนต์)
 * ซ้ำร้าย `resolveImg()` ยัง **สลับ src ทีหลัง** เมื่อหาไฟล์จริงเจอ = โหลดรอบสองอีกต่อหนึ่ง
 *
 * `load`/`error` ของ `<img>` ไม่ bubble → ต้องดักที่เฟสจับ (capture) ระดับ document
 * รวบด้วยตัวหน่วงสั้น ๆ เพราะฉากที่มีหลายรูปจะยิงติด ๆ กัน
 */
let _imgJob = null;
export function remeasureAfterImages() {
  clearTimeout(_imgJob);
  _imgJob = setTimeout(() => {
    _imgJob = null;
    bumpProseLayout();                 // ผลวัดที่แคชไว้เป็นของตอนที่รูปยังสูง 0
    repaginateAfterGeometry();
  }, 60);
  return true;
}
export function watchDocImages() {
  if (typeof document === 'undefined') return false;
  document.addEventListener('load', (ev) => {
    const im = ev && ev.target;
    if (!im || im.tagName !== 'IMG') return;
    // ★ **เฉพาะตัวแก้ไขตัวจริงเท่านั้น** — ห้ามนับสำเนาที่ตัววาดหน้ากระดาษโคลนไว้
    //
    // มุมมองหน้ากระดาษ/โหมดอ่านโคลน `.ProseMirror` ทั้งก้อนมาครอบทีละหน้า สำเนาพวกนั้นมี
    // `<img>` ของตัวเองที่ยิง `load` ใหม่ทุกครั้งที่วาด → ปลุกตัวจัดหน้า → วาดหน้าใหม่ →
    // โคลนใหม่ → `load` อีก = **วนไม่จบ** (รอบแรกเจอตอน e2e ช้าลงจนคลานหลังบล็อกที่มีรูป)
    // เส้นแบ่งคือ "อยู่ในกล่องที่ตัววาดหน้ากระดาษสร้างขึ้นหรือเปล่า" — ไม่ใช้ `contenteditable`
    // เป็นเกณฑ์ เพราะฉากที่ถูกล็อกก็ปิดการแก้ไขเหมือนกัน แต่ยังต้องจัดหน้าให้ถูกอยู่
    if (!im.closest || !im.closest('.ProseMirror')) return;
    if (im.closest('.ed-page-clip, .sp-pageview, .k-xpv-doc, .k-rd-stage')) return;
    remeasureAfterImages();
  }, true);
  return true;
}

let _geoJob = null;
export function repaginateAfterGeometry() {
  clearTimeout(_geoJob);
  _geoJob = setTimeout(() => {
    _geoJob = null;
    const t = state.active;
    if (!t || !(t.editor || t.sp)) return;
    try { repaginateFast(t); } catch {}
    try { retunePagePads(t); } catch {}
  }, 120);
}

/**
 * วัดหน้าโดยรับประกันว่าตัวแก้ไข "มองเห็นได้" ตอนวัด
 *
 * มุมมองเรียงหน้าคู่/ภาพรวมซ่อนตัวแก้ไขด้วย `display:none` (`.pane.sp-view-side > .workspace`)
 * แล้วปูหน้ากระดาษทับ — `getBoundingClientRect()` จึงคืน 0×0 และ `measureProseLayout` คืน null
 * ถ้าปล่อยให้ตกไปใช้ตัวประมาณตรงนี้ **หน้ากระดาษจะกลับไปโหว่แบบก่อน alpha.82 แบบเงียบ ๆ**
 * (เกิดทุกครั้งที่แคชหมดอายุระหว่างอยู่ในมุมมองนี้ เช่น ซูมหรือแก้ตั้งค่า)
 *
 * ทางแก้: ถอดคลาสมุมมองออกชั่วคราวแล้ววัด **ภายในงานเดียวกัน** — เบราว์เซอร์ไม่มีจังหวะ paint
 * คั่นกลาง ผู้ใช้จึงไม่เห็นอะไรกระพริบ · ความกว้างที่วัดได้เท่ากับโหมดปกติเป๊ะ เพราะหน้ากระดาษ
 * เป็น `position:absolute` ไม่กินที่ในกล่องของ pane อยู่แล้ว
 */
function measureWithEditorVisible(tab, f) {
  const opts = { paper: f.paper, margins: f.margins };
  const mz = measureProseLayout(tab.editor.view, opts);
  if (mz) return mz;
  const pane = tab.pane;
  if (!pane) return null;
  const off = ALL_VIEW_CLASSES.filter((c) => pane.classList.contains(c));
  if (!off.length) return null;
  pane.classList.remove(...off);
  try { return measureProseLayout(tab.editor.view, opts); }
  finally { pane.classList.add(...off); }
}

/**
 * ผลการวัดล่าสุดของแท็บนิยาย (พร้อมหน้าที่หั่นแล้ว) · null = วัดไม่ได้ → ผู้เรียกตกไปใช้ตัวประมาณ
 * @returns {null|{blocks:Array,pages:Array,contentHeight:number,totalHeight:number,zoomFactor:number,origin:number}}
 */
function proseMeasured(tab, spf) {
  const t2 = tab || state.active;
  if (!t2 || !t2.editor || !t2.editor.view) return null;
  const doc = t2.editor.view.state.doc;
  if (_mzCache && _mzCache.tab === t2 && _mzCache.doc === doc && _mzCache.epoch === _mzEpoch) {
    if (_mzCache.data) _mzCache.data.__fromCache = true;
    return _mzCache.data;
  }
  const f = spf || spFormat();
  const mz = measureWithEditorVisible(t2, f);
  if (!mz) { _mzCache = null; return null; }
  // [alpha.85 ข้อ 2] ตั้งแต่ทำ lineOffsets เป็นแบบขี้เกียจ การหั่นหน้าคือคนที่ไป "อ่าน DOM"
  // จริง ๆ จึงต้องอยู่ในโหมดยุบเส้นคั่นเหมือนตอนวัด ไม่งั้นพิกัดบรรทัดคลาดกับที่วัดไว้
  mz.pages = withMeasureMode(() => sliceProsePages(mz.blocks, mz.contentHeight, mz.totalHeight))
    .map((p, i) => ({ ...p, index: i + 1 }));
  mz.__fromCache = false;
  _mzCache = { tab: t2, doc, epoch: _mzEpoch, data: mz };
  return mz;
}

/**
 * ตำแหน่งในเอกสารของ "หัวแต่ละหน้า" จากผลการวัด (ช่องที่แปลงกลับไม่ได้ = null)
 * `proseBreakList` อาจคืนน้อยกว่าจำนวนหน้าเมื่อแปลงพิกัดกลับไม่สำเร็จ — ต้องยึด
 * `b.page - basePage` เป็นดัชนี ไม่ใช่ลำดับในอาร์เรย์ ไม่งั้นหน้าถัด ๆ ไปเลื่อนผิดทั้งแถว
 */
function proseMeasuredStarts(view, mz, basePage) {
  const starts = new Array(mz.pages.length).fill(null);
  starts[0] = 0;
  for (const b of proseBreakList(view, mz.blocks, mz.pages, basePage)) {
    const i = b.page - basePage;
    if (i > 0 && i < starts.length) starts[i] = b.pos;
  }
  return starts;
}

/**
 * ป้ายเลขหน้าบนหน้ากระดาษของนิยาย — กฎเดียวกับกิ่งใน renderProsePageView()
 * [alpha.81r ข้อ 7] ฟังสวิตช์ตัวเดียวกับตัวแก้ไข · [alpha.81r3] หน้าแรกของเนื้อเรื่องมีเลข
 */
function proseClipLabel(index, pf, spf, startPage) {
  // [alpha.83 ข้อ 4] **สวิตช์เดียว** — เดิมนิยายมีสองชุดที่ไม่รู้จักกัน:
  //   `settings.prose.pageNumbers`  (แท็บ 📖 รูปแบบนิยาย → ใช้เฉพาะมุมมองเรียงหน้า/ภาพรวม)
  //   `settings.spPageNumbers.show` (เมนู/แท็บหน้ากระดาษ → ใช้กับตัวแก้ไข)
  // ผู้ใช้กดเปิดช่องหนึ่ง แล้วอีกมุมมองไม่ขึ้นเลข ("ใช้ layout คนละชุดเหรอ")
  // ตอนนี้ทุกมุมมองอ่าน spPageNumbers ตัวเดียว (กล่องตั้งค่านิยายเขียนลงตัวเดียวกันแล้ว)
  const pn = spf.pageNumbers;
  if (!pn.show) return '';
  // [alpha.97 ข้อ 11] หน้าเนื้อเรื่องมีเลขทุกหน้า — กฎเดียวคือหน้าที่ไม่ใช่ฉากไม่มีเลข
  // [alpha.103 ข้อ 4] + สวิตช์ "ใส่เลขบนหน้าแรก" (หน้าที่เลขจริง = 1 เท่านั้น)
  const i = Math.max(1, Math.round(+index || 1));
  const no = Math.max(1, Math.round(+startPage || 1)) + i - 1;
  return no === 1 && pn.firstPage === false ? '' : String(no);
}

function drawProsePageView(tab) {
  if (!tab || !tab.editor || !tab.pane) return 0;
  const spf = spFormat();
  const pf = proseFormat();
  const host = pageViewHost(tab, (pos) => gotoProsePos(tab, pos));
  const pageWpx = spf.paper.width * 96;
  const vs = viewScale(viewOfTab(tab), tab.pane.clientWidth || 900, pageWpx, 20);

  // [alpha.82] ทางหลัก: ก๊อปเนื้อหาที่เบราว์เซอร์วาดไว้จริงมาครอบทีละหน้า
  // → หน้ากระดาษตรงกับตัวแก้ไขเป๊ะ และตัดกลางย่อหน้าได้เหมือนโปรแกรมจัดหน้าจริง
  const mz = proseMeasured(tab, spf);
  if (mz) {
    const start = currentStartPage(tab);
    const startPos = proseMeasuredStarts(tab.editor.view, mz, start);
    renderProseClipPages(host, tab.editor.view.dom, mz.pages, {
      scale: vs.scale, perRow: vs.perRow, gap: 20, paper: spf.paper, margins: spf.margins,
      startPos,
      // [alpha.143 ข้อ 2] แผ่นที่เป็น "รูปเต็มหน้า" ถูกทาภาพชนขอบกระดาษ (ตัววาดหาเอาจาก blocks)
      blocks: mz.blocks,
      numTop: spf.pageNumbers.top, numRight: spf.pageNumbers.right,
      label: (n) => proseClipLabel(n, pf, spf, start),
    });
    return mz.pages.length;
  }
  // สำรอง: วัดไม่ได้ (แท็บยังไม่ถูกต่อ DOM) → ใช้ตัวประมาณเดิม
  const blocks = proseBlocksFromDoc(tab.editor.view.state.doc);
  const pg = prosePagesOf(blocks, pf, spf.paper, spf.margins);
  // [alpha.81r ข้อ 7] มุมมองเรียงหน้า/ภาพรวมของนิยายเคยใส่เลขหน้าให้ **เสมอ** (ไม่ดูสวิตช์เลย)
  // ขณะที่ตัวแก้ไขไม่เคยมีเลขหน้าให้นิยายเลย → ผู้ใช้เห็นเลข "โผล่ผิดที่" ทั้งที่กดเปิด/ปิดก็ไม่เปลี่ยน
  // ตอนนี้ทั้งสองที่ฟังสวิตช์ตัวเดียวกัน (spFormat().pageNumbers.show)
  renderProsePageView(host, pg, pf, { scale: vs.scale, perRow: vs.perRow, gap: 20,
                                      paper: spf.paper, margins: spf.margins,
                                      numTop: spf.pageNumbers.top, numRight: spf.pageNumbers.right,
                                      label: (n) => proseClipLabel(n, pf, spf, currentStartPage(tab)),
                                      startPage: currentStartPage(tab) });
  return pg.count;
}

/** ย้ายเคอร์เซอร์ของตัวแก้ไขนิยายไปยังตำแหน่งหนึ่งแล้วเลื่อนให้เห็น */
export function gotoProsePos(tab, pos) {
  const t2 = tab || state.active;
  if (!t2 || !t2.editor) return false;
  return t2.editor.gotoPos(pos);
}

/** เปลี่ยนโหมดมุมมองของบทหนัง */
// ═════════ [alpha.93 ข้อ 4] ★ ตำแหน่งเลื่อนจอ "ต่อมุมมอง" ═════════
//
// ผู้ใช้: *"การสลับมุมมองไม่ได้ lock เอาไว้ มันเลยงงมาก ๆ ต้อง lock scroll bar
//          คำนวณเลยว่า scroll bar เก็บค่าว่ามุมมองนี้อยู่ตรงไหน"*
//
// เดิมสลับมุมมองแล้วเนื้อหาถูกวาดใหม่ทั้งก้อน → ความสูงเปลี่ยน → เบราว์เซอร์รีเซ็ตไปบนสุด
// อ่านอยู่หน้า 40 กดดูมุมมองจัดหน้าแล้วกลับมา = เริ่มใหม่ที่หน้า 1 ทุกครั้ง
//
// เก็บตำแหน่งของแต่ละมุมมองไว้กับแท็บ · มุมมองที่ยังไม่เคยเข้าใช้ **สัดส่วน** ของมุมมองเดิมแทน
// (ความสูงรวมของแต่ละมุมมองไม่เท่ากัน — จำเป็นพิกเซลดิบข้ามมุมมองจะไปโผล่คนละที่)
//
// ตัวที่เลื่อนจริงคือ `.pane` (`overflow:auto`) — ไม่ใช่ `.workspace` (ที่ระบบเซสชันเคยอ่านผิด)
function viewScrollFrac(pane) {
  const max = Math.max(1, pane.scrollHeight - pane.clientHeight);
  return Math.min(1, Math.max(0, pane.scrollTop / max));
}
function rememberViewScroll(tab, mode) {
  if (!tab || !tab.pane || !mode) return;
  if (!tab.viewScroll) tab.viewScroll = {};
  tab.viewScroll[mode] = { top: tab.pane.scrollTop, left: tab.pane.scrollLeft,
                           frac: viewScrollFrac(tab.pane) };
}
function restoreViewScroll(tab, mode, fallbackFrac) {
  if (!tab || !tab.pane || !mode) return;
  const pane = tab.pane;
  const saved = tab.viewScroll && tab.viewScroll[mode];
  const apply = () => {
    if (!pane.isConnected) return;
    const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
    const want = saved ? saved.top : (fallbackFrac || 0) * max;
    pane.scrollTop = Math.min(Math.max(0, want), max);
    // [alpha.93 ข้อ 3+4] แนวนอนด้วย — โหมดร่างเลื่อนแนวนอนได้แล้ว ถ้าไม่คืนค่า/ไม่รีเซ็ต
    // มุมมองอื่นจะถูกเลื่อนค้างไว้ แล้ว "รางเลขบรรทัด" (ตรึงกับ pane) ไปทับตัวหนังสือ
    const maxX = Math.max(0, pane.scrollWidth - pane.clientWidth);
    pane.scrollLeft = Math.min(Math.max(0, saved ? (saved.left || 0) : 0), maxX);
  };
  // มุมมองหน้ากระดาษวาดแบบ async (ครอบเนื้อหา/ปรับสเกล) — ความสูงยังไม่นิ่งในเฟรมแรก
  // จึงตั้งซ้ำสามจังหวะ: ทันที · เฟรมถัดไป · หลังวาดเสร็จ (บทเรียน "อย่าวัดผลทันทีหลังสั่งวาด")
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 140);
}
/** ล้างความจำตำแหน่งเลื่อนของแท็บ (เนื้อหาเปลี่ยนทั้งก้อน = ตำแหน่งเดิมไม่มีความหมายแล้ว) */
export function resetViewScroll(tab) { if (tab) tab.viewScroll = null; }

/**
 * [alpha.110] ทาคลาสมุมมองให้ **ทุกแผงตามมุมมองของแท็บนั้นเอง**
 *
 * เดิมงานนี้ถูกเขียนไว้ในตัว `setSpView` แบบ "ถอดคลาสจากทุกแผง แล้วใส่กลับให้แผงเดียว"
 * ซึ่งใช้ได้ตอนมีมุมมองเดียวทั้งโปรแกรม แต่พังทันทีที่แยกจอ (ช่องที่ไม่ได้โฟกัสโดนถอดคลาสทิ้ง)
 * ตอนนี้เดินทีละแท็บ: แผงที่มองเห็นได้รับคลาส/หน้ากระดาษของตัวเอง · แผงที่ซ่อนอยู่เก็บของทิ้งให้เกลี้ยง
 *
 * @returns {number|null} จำนวนหน้าของแท็บที่ active (null = ไม่ใช่มุมมองหน้ากระดาษ)
 */
function syncPaneViews(force) {
  const done = new Set();
  let activePages = null;
  for (const tab of state.tabs.values()) {
    const p = tab.pane;
    if (!p) continue;
    done.add(p);
    // [alpha.58r บั๊ก 15] โหมดมุมมองใช้ได้ทั้งบทภาพยนตร์และนิยาย (คลาส pane ชุดเดียวกัน)
    const canView = !!(tab.sp || tab.editor);
    // แผงที่ไม่ได้แสดงอยู่ = ไม่ต้องวาด (วาดหน้ากระดาษของแท็บที่มองไม่เห็นคือเผาเวลาเปล่า
    //  และวัดขนาดจากแผงที่ซ่อนอยู่ได้ 0 อยู่ดี) — พอสลับมาแล้ว activate() เรียกซ้ำให้เอง
    // แยกจอ: แผงที่ถูกยืมเข้าไปในต้นไม้ split แสดงอยู่ทุกช่อง (`.k-split-body > .pane`)
    // ไม่ใช่แค่ช่องที่โฟกัส → เช็ค `k-in-split` ด้วย ไม่งั้นช่องข้าง ๆ ไม่มีวันได้มุมมองของตัวเอง
    const visible = p.classList.contains('on') || p.classList.contains('k-in-split') || !!tab.floatWin;
    // มุมมองที่แผงนี้ "ควรเป็น" · null = ไม่มีมุมมอง (ซ่อนอยู่ หรือไม่ใช่แท็บตัวแก้ไข)
    const want = (canView && visible) ? viewOfTab(tab) : null;
    // ตัวนี้ถูกเรียกทุกครั้งที่คลิกแท็บ (activate) → ไม่มีอะไรเปลี่ยนก็ต้องไม่ไปวาด/วัดใหม่
    // ไม่งั้นการสลับแท็บธรรมดากลายเป็นงานจัดหน้าเต็มรอบของทุกช่องที่เปิดอยู่
    if (!force && tab._paneView === want) continue;
    tab._paneView = want;
    p.classList.remove(...ALL_VIEW_CLASSES);
    // [alpha.100 ข้อ 3] ชั้นแผ่นกระดาษของแผงที่ไม่ได้อยู่โหมดจัดหน้าแล้วต้องหายไปด้วย
    p.querySelectorAll(':scope > .workspace > .k-paper-layer, :scope > .k-page-hud')
     .forEach((n) => n.remove());
    if (want === null) { clearPageView(p); continue; }
    const m = want;
    const cls = SP_VIEW_CLASS[m].split(' ').filter(Boolean);
    if (cls.length) p.classList.add(...cls);
    let pages = null;
    if (isPageView(m)) pages = tab.sp ? drawPageView(tab) : drawProsePageView(tab);
    else clearPageView(p);
    if (tab === state.active) activePages = pages;
    // [alpha.100 ข้อ 3] วาดแผ่นทันทีที่เข้าโหมดจัดหน้า — ไม่ต้องรอรอบจัดหน้าถัดไป
    // (จำนวนหน้ายังเป็นค่าเดิมที่ตั้งไว้ที่ --pg-count · รอบจัดหน้าถัดไปจะอัปเดตให้เอง)
    renderPaperSheets(tab);
    // ══ [alpha.100r บั๊ก 2] ★ สลับมุมมองแล้วต้องคิด "ที่ว่างท้ายหน้า" ใหม่ ══
    // กล่องเส้นคั่นหน้าตาไม่เหมือนกันในแต่ละมุมมอง (ปกติ = เส้นบาง · จัดหน้า = ขอบล่าง+ช่องว่าง+ขอบบน)
    // ค่าชดเชยที่คำนวณไว้ตอนอยู่มุมมองหนึ่งจึงใช้กับอีกมุมมองไม่ได้
    retunePagePads(tab);
  }
  // แผงที่ไม่ได้ผูกกับแท็บใด (เศษที่ค้างจากแท็บที่เพิ่งปิด) — ล้างให้เกลี้ยงเหมือนเดิม
  document.querySelectorAll('.pane').forEach((p) => {
    if (done.has(p)) return;
    p.classList.remove(...ALL_VIEW_CLASSES);
    clearPageView(p);
    p.querySelectorAll(':scope > .workspace > .k-paper-layer, :scope > .k-page-hud')
     .forEach((n) => n.remove());
  });
  return activePages;
}

/**
 * [alpha.110] คืนมุมมองของแท็บที่เพิ่งถูกเลือกกลับมาบนจอ — เรียกจาก `activate()`
 * (ไม่แตะค่าเริ่มต้นของโปรแกรม และไม่ขยับตำแหน่งเลื่อนจอ เพราะไม่ได้ "เปลี่ยน" มุมมอง)
 */
export function reapplyTabView(force) {
  syncPaneViews(force);
  const sel = $('#sp-view-select'); if (sel) sel.value = currentSpView();
  syncMenuToggles();
  syncWorkspaceWidths();
  scheduleLineGutter();
}

export function setSpView(mode, quiet) {
  const m = isValidView(mode) ? mode : 'normal';
  const tab = state.active;
  const prevMode = currentSpView();
  let frac = 0;
  if (tab && tab.pane && prevMode !== m) {
    rememberViewScroll(tab, prevMode);
    frac = viewScrollFrac(tab.pane);
  }
  spViewMode = m;                          // ค่าเริ่มต้นของแท็บที่จะเปิดต่อจากนี้
  if (tab && (tab.sp || tab.editor)) {
    // [alpha.116 ข้อ 4] จดมุมมองแก้ไขล่าสุดไว้ก่อนออกไปมุมมองหน้ากระดาษ
    if (!isPageView(prevMode)) tab._editView = prevMode;
    if (!isPageView(m)) tab._editView = m;
    tab.spView = m;
  }
  const pages = syncPaneViews(true);      // ผู้ใช้สั่งเปลี่ยนเอง = ทาใหม่ทุกช่องเสมอ
  const sel = $('#sp-view-select'); if (sel) sel.value = currentSpView();
  syncMenuToggles();
  syncWorkspaceWidths();
  scheduleLineGutter();          // [60r2 ข้อ 11] มุมมองหน้ากระดาษ = ปิดเลขบรรทัดเอง
  // [alpha.93 ข้อ 4] กลับไปที่เดิมของมุมมองนี้ — ทำหลังวาดเสร็จ ไม่งั้นความสูงยังเป็นของเก่า
  if (tab && tab.pane && prevMode !== m) restoreViewScroll(tab, m, frac);
  if (!quiet) setStatus(viewStatusText(m, pages ?? undefined));
  return m;
}

/**
 * [alpha.100r บั๊ก 2] คิด "ที่ว่างท้ายหน้า" ใหม่แล้ววาดแผ่นตาม — ใช้ได้ทั้งนิยายและบท
 * เรียกหลังเหตุการณ์ที่เปลี่ยน **เรขาคณิตของกล่องเส้นคั่น** โดยไม่ได้จัดหน้าใหม่
 * (สลับมุมมอง · ซูม) · ต้องรอเฟรมถัดไปเสมอ — วัดทันทีหลังสั่งวาดได้ค่าของเก่า
 */
function retunePagePads(tab) {
  const t = tab || state.active;
  if (!t) return;
  requestAnimationFrame(() => {
    try {
      if (t.sp) tuneSpPagePadsLoop(t);
      else if (t.editor) { applyProsePagePads(t.editor.view.dom); tuneProsePagePadsLoop(t); }
    } catch {}
    try { renderPaperSheets(t); } catch {}
  });
}

/** วาดมุมมองหน้ากระดาษใหม่เมื่อเนื้อหา/ขนาดหน้าต่างเปลี่ยน */
export function refreshSpView() {
  // [alpha.110] วาดใหม่ให้ **ทุกช่องที่มองเห็น** ซึ่งอยู่ในมุมมองหน้ากระดาษ — ไม่ใช่เฉพาะช่องที่โฟกัส
  // (แยกจอแล้วอีกช่องหนึ่งเคยค้างเป็นภาพเก่าตลอด เพราะไม่มีใครสั่งวาดให้)
  for (const tab of state.tabs.values()) {
    if (!tab.pane || !isPageView(viewOfTab(tab))) continue;
    if (!tab.pane.classList.contains('on') && !tab.pane.classList.contains('k-in-split')
        && !tab.floatWin) continue;
    if (tab.sp) drawPageView(tab);
    else if (tab.editor) drawProsePageView(tab);
  }
}
// ย่อ/ขยายหน้าต่าง → จำนวนหน้าต่อแถวและสเกลเปลี่ยน (หน่วงไว้กันวาดถี่ระหว่างลาก)
let _spViewJob = null;
window.addEventListener('resize', () => {
  // [60r2 ข้อ 1] แผงเปลี่ยนขนาด = พื้นที่กระดาษเปลี่ยน → ความกว้างขั้นต่ำของ workspace ต้องตามทันที
  syncWorkspaceWidths();
  scheduleLineGutter();
  clearTimeout(_spViewJob);
  _spViewJob = setTimeout(refreshSpView, 150);
  autoFitWidth();                               // [alpha.164 · รอบต่อ 2 · งาน 3] (ปิดอยู่ = ไม่ทำอะไร)
  // [alpha.116 ข้อ 5] ย่อ/ขยายหน้าต่าง → ของลอยต้องยังอยู่ในจอ **และบันทึกทับค่าที่จำไว้**
  keepFloatingUiInView();
  // [alpha.126] ย่อ/ขยายหน้าต่างก็ทำให้เกิดช่องว่างค้างได้เหมือนการลากที่จับ (แผงที่ตรึงเป็น px
  // ไม่ยืดตาม) และเส้นทางนี้ก็ไม่ผ่าน `renderPanels()` เช่นกัน → ต้องเรียกตัวปิดรูเอง
  clearTimeout(_gapJob);
  _gapJob = setTimeout(() => { try { auditPanelGaps(); } catch {} }, 200);
});
let _gapJob = null;

/**
 * [alpha.100 ข้อ 2] เส้นประบอกระยะขอบกระดาษในมุมมองจัดหน้า
 *
 * ผู้ใช้: *"มุมมอง layout เหมือนจะมีเส้นประแสดงตัดตกอยู่ด้านบนขอบกระดาษ ให้เลือกคือ
 *           มี toggle แสดงระยะตัดตก แต่ต้องมีทั้งหัวและล่าง กับไม่มีเลยดีกว่า"*
 *
 * เส้นเก่าเป็นของแถมจากกฎเส้นคั่นหน้าของ **มุมมองปกติ** ที่หลุดมาโดนโหมดจัดหน้า จึงมี
 * ได้แค่ด้านเดียว (ถูกตัดทิ้งแล้วใน style.css) · ตัวใหม่วาดเป็นกรอบประรอบพื้นที่พิมพ์
 * ของแต่ละแผ่น → ครบทั้งสี่ด้านโดยโครงสร้าง ไม่มีทางเหลือข้างเดียวอีก
 * เป็นความชอบส่วนตัวของคนดูจอ → เก็บระดับผู้ใช้ (settings.json) ไม่ใช่ของผลงาน
 */
export function togglePageGuides(on) {
  const v = on === undefined ? !state.settings.pageGuides : !!on;
  state.settings.pageGuides = v;
  document.body.classList.toggle('k-page-guides', v);
  saveGlobalSetting('pageGuides', v);
  syncMenuToggles();
  setStatus(v ? tt('ui.app.pageGuidesOn') : tt('ui.app.pageGuidesOff'));
  return v;
}

// [61] แสดงรูปแบบ — เส้นฟ้าขอบ element + เครื่องหมายบอกชนิดการจบบรรทัด
export function toggleShowFormat(on) {
  const v = on ?? !isFormatGuide();
  setFormatGuide(v, spFormat());
  state.settings.spShowFormat = v;
  document.body.classList.toggle('sp-show-format', v);
  for (const tb of state.tabs.values()) if (tb.sp) tb.sp.refreshGuides();
  saveProjectMetaSoon();
  syncMenuToggles();
  setStatus(v ? tt('ui.app.showFormatOpenLine') : tt('ui.app.showFormatClose'));
  return v;
}

// ═════════ alpha.58 · 55–56 · ระบบต่อเนื่อง (CONTINUED / MORE / cont'd) ═════════
/** ระบบต่อเนื่องเปิดอยู่ไหม (ค่าเริ่มต้น = เปิด ตามธรรมเนียมบทภาพยนตร์) */
// ═════════ [alpha.84 ข้อ 4] ย่อหน้าอัตโนมัติของ "นิยาย" — สวิตช์บนแถบรูปแบบ ═════════
// เดิมปรับได้เฉพาะใน ตั้งค่า → รูปแบบนิยาย → ย่อหน้าบรรทัดแรก (นิ้ว) ซึ่งลึกเกินกว่าจะสลับไปมา
// ปิดแล้วต้อง **จำระยะเดิมไว้** ไม่งั้นเปิดกลับมาได้ 0.5 นิ้วเสมอ ทับค่าที่ผู้ใช้ตั้งเอง
export function proseIndentOn() { return num(proseFormat().firstLineIndent, 0) > 0; }
export function toggleProseIndent(on) {
  const pf = proseFormat();
  const v = on === undefined ? !proseIndentOn() : !!on;
  const prev = num(state.settings.proseIndentPrev, 0) || num(pf.firstLineIndent, 0)
               || PROSE_DEFAULTS.firstLineIndent;
  if (!v && num(pf.firstLineIndent, 0) > 0) state.settings.proseIndentPrev = pf.firstLineIndent;
  state.settings.prose = { ...proseFormatSettings(), firstLineIndent: v ? prev : 0 };
  applyProseVars(proseFormat());
  bumpProseLayout();                  // ระยะย่อหน้าเปลี่ยน = ต้องวัดหน้าใหม่ (alpha.82)
  scheduleCount();
  refreshSpView();
  saveProjectMetaSoon(); syncMenuToggles(); refreshToolbar();
  setStatus(v ? ttf('ui.app.proseIndentOn', prev) : tt('ui.app.proseIndentOff'));
  return v;
}

/**
 * ══ [alpha.97 ข้อ 12] "ไทยในบทภาพยนตร์" = แถวหนึ่งในตารางฟอนต์ตามภาษา ══
 *
 * เดิมเป็นระบบแยก (`settings.spThaiFont`) ที่เขียนคำว่า "ไทย" กับ "บทภาพยนตร์" ตายไว้ในโค้ด
 * คนเขียนภาษาอื่นจึงไม่มีทางได้ตัวปรับสัดส่วนแบบเดียวกัน · ตอนนี้เป็นแถวธรรมดาที่
 * `target = 'screenplay'` และคุมช่วง U+0E00-0E7F — ลบได้ ทำซ้ำให้ภาษาอื่นได้
 * เมนู/คีย์ลัดเดิมยังใช้ได้ โดยไปสลับ `enabled` ของแถวนั้นแทน
 */
function spThaiRowIndex() {
  const rows = normalizeLangFonts(state.settings.langFonts);
  return rows.findIndex((r) => rowAppliesTo(r, 'screenplay')
    && normalizeRange(r.range) === SP_THAI_RANGE);
}
export function spThaiCfg() {
  const rows = normalizeLangFonts(state.settings.langFonts);
  const i = spThaiRowIndex();
  return i >= 0 ? rows[i] : { enabled: false, size: SP_THAI_SIZE, family: '' };
}
/** แก้ค่าของแถวนั้นแล้วใช้ผลทันที (สร้างแถวให้ถ้ายังไม่มี) */
export function setSpThaiFont(patch) {
  const rows = normalizeLangFonts(state.settings.langFonts);
  let i = spThaiRowIndex();
  if (i < 0) {
    rows.push(normalizeLangFonts([{ id: 'sp-thai', label: tt('ui.common.msg8'),
      range: SP_THAI_RANGE, target: 'screenplay', family: SP_THAI_FALLBACKS.join(', '),
      system: true, size: SP_THAI_SIZE }])[0]);
    i = rows.length - 1;
  }
  rows[i] = normalizeLangFonts([{ ...rows[i], ...(patch || {}) }])[0];
  state.settings.langFonts = rows;
  applySettings();
  refreshSpView();
  saveProjectMetaSoon(); syncMenuToggles(); refreshToolbar();
  return rows[i];
}
export function toggleSpThaiFont(on) {
  const c = spThaiCfg();
  const v = on === undefined ? !c.enabled : !!on;
  setSpThaiFont({ enabled: v });
  setStatus(v ? ttf('ui.app.spThaiOn', c.size) : tt('ui.app.spThaiOff'));
  return v;
}

export function spContinuedOn() {
  const c = state.settings.spContinued;
  return !c || c.enabled !== false;
}
/** เปิด/ปิดระบบต่อเนื่องทั้งชุด — เก็บใน project.khn.json */
export function toggleContinueds(on) {
  const cur = { ...CONTINUED_DEFAULTS, ...(state.settings.spContinued || {}) };
  cur.enabled = on === undefined ? !spContinuedOn() : !!on;
  state.settings.spContinued = cur;
  applyPageVars();
  scheduleCount();                    // คำนวณเครื่องหมายใหม่ (ตัวเดียวกับที่นับหน้า)
  refreshSpView();
  // [alpha.84 ข้อ 3] มีปุ่มบนแถบแล้ว → ต้องรีเฟรชแถบด้วย ไม่งั้นปุ่มติดไฟค้างสถานะเก่า
  saveProjectMetaSoon(); syncMenuToggles(); refreshToolbar();
  setStatus(cur.enabled
    ? tt('ui.app.textContOpenCONTINUED')
    : tt('ui.app.textContClose'));
  return cur.enabled;
}

// ═════════ alpha.57a ข้อ 2 · เลขฉาก + เลขหน้า + ส่วนเสริม ═════════
/** เปิด/ปิดเลขฉาก (เก็บใน project.khn.json — ตำแหน่งตั้งได้ที่ ตั้งค่า → หน้ากระดาษ) */
export function toggleSceneNumbers(on) {
  const cur = { ...SCENE_NUMBER_DEFAULTS, ...(state.settings.spSceneNumbers || {}) };
  cur.show = on === undefined ? !cur.show : !!on;
  state.settings.spSceneNumbers = cur;
  applyPageVars();
  refreshSpView();
  saveProjectMetaSoon(); syncMenuToggles();
  setStatus(cur.show ? ttf('ui.app.numSceneOpenLeft', cur.left, cur.right) : tt('ui.app.numSceneClose'));
  return cur.show;
}

/** เปิด/ปิดเลขหน้า — มีเฉพาะไฟล์ที่เป็นฉาก · เลขเริ่มต้นตั้งรายไฟล์ในคุณสมบัติฉาก */
export function togglePageNumbers(on) {
  const cur = { ...PAGE_NUMBER_DEFAULTS, ...(state.settings.spPageNumbers || {}) };
  cur.show = on === undefined ? !cur.show : !!on;
  state.settings.spPageNumbers = cur;
  applyPageVars();
  refreshSpView();
  updatePageNumberHint();
  saveProjectMetaSoon(); syncMenuToggles();
  setStatus(cur.show ? ttf('ui.app.pageNumOpenRightMargin', cur.right, cur.top) : tt('ui.app.pageNumClose'));
  return cur.show;
}

/**
 * เลขหน้าเริ่มต้นของไฟล์ที่เปิดอยู่
 *
 * ลำดับความสำคัญ (ชัดเจน อย่าสลับ):
 *   1. เลขที่ผู้ใช้พิมพ์เองในคุณสมบัติฉาก (`scenes.json → startPage`) — สั่งแล้วต้องได้ตามนั้น
 *   2. [alpha.141] "ไล่เลขหน้าต่อเนื่อง" (`scenes.json → pageFlow='continue'`) — เลขมาจาก
 *      **สายหน้าของทั้งเล่ม** ซึ่งเป็นการวัดชุดเดียวกับโหมดอ่านทั้งเล่ม (read-ui.js)
 *      ผู้ใช้: *"เราไม่รู้มี option เปล่า แต่ในคุณสมบัติของฉาก ควรมีให้เลือก run เลขหน้าต่อกันเลย
 *      เพราะเรามีลำดับของฉาก และบทอยู่แล้ว"*
 *   3. ไม่มีอะไรเลย = 1
 */
export function currentStartPage(tab) {
  const t2 = tab || state.active;
  const n = parseInt(t2 && t2.startPage, 10);
  if (Number.isFinite(n) && n > 0) return n;
  if (t2 && t2.pageFlow === 'continue' && t2.file) {
    const p = cachedStartPage(t2.file);
    if (p) return p;
    ensureBookFlow(t2);                 // ยังไม่ได้วัด → วัดเบื้องหลังแล้ววาดใหม่เมื่อได้คำตอบ
    // [alpha.161 · C1] มีผลที่วัดเสร็จแต่ข้อมูลเปลี่ยนระหว่างวัด → โชว์ไปก่อน (ตัวบนสั่งวัดใหม่แล้ว)
    const sp = staleStartPage(t2.file);
    if (sp) return sp;
  }
  return 1;
}

/** โฟลเดอร์เล่มของไฟล์ฉาก (`<root>/<เล่ม>/Draft/<ร่าง>/Chapters/…`) — '' = ไม่ใช่ไฟล์ในเล่ม */
export function sectionPathOfFile(file) {
  const f = String(file || '');
  const cut = f.replace(/[\\/]Draft[\\/][\s\S]*$/, '');
  return cut && cut !== f ? cut : '';
}

// [alpha.141] คำนวณสายหน้าของเล่มเบื้องหลัง แล้ววาดเลขหน้าใหม่เมื่อได้คำตอบ
// (ตัวเดียวกันทั้งไฟล์ — กันยิงซ้อนกันหลายรอบตอนสลับแท็บรัว ๆ)
// [alpha.160 · P1-12] ★ งานวัด "ต่อเล่ม" — เดิม `_flowJob` ตัวเดียว + guard อยู่ก่อนเช็ค secPath
// → แท็บของเล่มที่สองได้ promise ของเล่มแรกกลับไป (วัดผิดเล่ม) แล้วเลขหน้าของเล่มสองไม่มาเลยจนกว่าจะสลับแท็บอีกรอบ
const _flowJobs = new Map();          // secPath → Promise
// [alpha.161 · C1] ผลที่ล้าสมัยระหว่างวัด (ข้อมูลเปลี่ยนตลอดทั้ง 3 รอบ) → วัดใหม่แบบ **หน่วงเวลา + มีเพดาน**
// ไม่ใช่วัดทันที — กันวงวน "วัดเสร็จ → วาด → ยังไม่พร้อม → วัด" ที่ alpha.160 เจอเมื่อมีอะไรล้างแคชตลอด
const FLOW_RETRY_MS = 1500, FLOW_RETRY_MAX = 4;
const _flowRetry = new Map();         // secPath → จำนวนครั้งที่วัดได้ผลล้าสมัยติดกัน
export function ensureBookFlow(tab) {
  const secPath = sectionPathOfFile(tab && tab.file);
  if (!secPath) return null;
  if (_flowJobs.has(secPath)) return _flowJobs.get(secPath);
  // ★ วัดเล่มนี้ไปแล้วแต่ไฟล์นี้ไม่อยู่ในสาย (บันทึกช่วยจำ · ไฟล์นอกร่างหลัก) → **ห้ามวัดซ้ำ**
  // ไม่งั้นได้วงวน: วัดเสร็จ → refreshSpView() → currentStartPage() → ยังไม่เจอ → สั่งวัดใหม่ …
  if (bookFlowReady(secPath)) return null;
  const job = computeBookFlow(secPath)
    .then(() => {
      if (bookFlowReady(secPath)) _flowRetry.delete(secPath);
      else {
        const n = (_flowRetry.get(secPath) || 0) + 1;
        _flowRetry.set(secPath, n);
        if (n <= FLOW_RETRY_MAX) {
          // จองที่ไว้ใน _flowJobs จนกว่าจะถึงเวลา — การวาดระหว่างนี้จะไม่สั่งวัดซ้อน
          const wait = new Promise((r) => setTimeout(r, FLOW_RETRY_MS))
            .then(() => { _flowJobs.delete(secPath); return ensureBookFlow(tab); });
          _flowJobs.set(secPath, wait);
        }
      }
      updatePageNumberHint(); refreshSpView();
    })
    .catch((e) => log('warn', tt('ui.readbook.measureFail'), e))
    .finally(() => { if (_flowJobs.get(secPath) === job) _flowJobs.delete(secPath); });
  _flowJobs.set(secPath, job);
  return job;
}

/**
 * [alpha.83 ข้อ 4] ตัวทำป้าย "เลขหน้าจริง" ของหน้าที่เริ่มตรงเส้นคั่นแต่ละเส้น
 *
 * เดิมโหมดปกติ/จัดหน้ามีเลขหน้าแค่ **หน้าแรก** (`::before` ของ .ProseMirror) หน้าถัดไปมีแต่ป้าย
 * "หน้า N" กลางแถบคั่น ผู้ใช้จึงเห็นว่า "เปิดเลขหน้าแล้วไม่ขึ้นในมุมมองปกติกับจัดหน้า"
 * — เลขที่เส้นคั่นสร้างให้เป็นเลขของ **หน้าถัดไป** จึงไม่ต้องสน firstPage (หน้าแรกไม่มีเส้นคั่น)
 * · คืน null เมื่อปิดสวิตช์ → ปลั๊กอินไม่วาดอะไรเลย
 */
function pageNumberLabelFor(fmt) {
  if (!fmt.pageNumbers.show) return null;
  // [alpha.103 ข้อ 4] เคารพสวิตช์ "ใส่เลขบนหน้าแรก" — กฎเดียวกับ pageNumberLabel()
  return (page) => (page === 1 && fmt.pageNumbers.firstPage === false
    ? '' : String(page) + (fmt.pageNumbers.suffix || ''));
}
/** เวอร์ชันของนิยาย — ไม่มีคำต่อท้าย (จุดท้ายเลขเป็นธรรมเนียมของบทภาพยนตร์) */
function prosePageNumberLabelFor(spf) {
  if (!spf.pageNumbers.show) return null;
  return (page) => (page === 1 && spf.pageNumbers.firstPage === false ? '' : String(page));
}

/** วาดเลขหน้าของ "หน้าแรก" บนหน้ากระดาษในตัวแก้ไข (หน้าถัด ๆ ไปอยู่บนเส้นคั่นหน้า) */
export function updatePageNumberHint() {
  const t2 = state.active;
  const pane = t2 && t2.pane;
  if (!pane) return '';
  const fmt = spFormat();
  // [alpha.81r ข้อ 7] "เปิดเลขหน้าแล้วไม่แสดงเลย · มันควรแสดงในโหมดจัดหน้า"
  // ต้นตอ: เงื่อนไขนี้ผูกกับ `t2.sp` — เลขหน้าจึงมีเฉพาะแท็บ **บทภาพยนตร์**
  // ส่วนแท็บนิยายไม่เคยได้เลขหน้าบนหน้ากระดาษเลย ทั้งที่ใช้ขนาดกระดาษ/ระยะขอบชุดเดียวกัน
  // (และเห็นเลขในโหมดเรียงหน้า/ภาพรวมอยู่แล้ว จึงดูเหมือน "เลขไปโผล่ผิดที่")
  const isDoc = !!(t2.sp || t2.editor);
  // [alpha.83 ข้อ 4] นิยายไม่ใส่จุดท้ายเลข (เป็นธรรมเนียมของบทภาพยนตร์) — กฎเดียวกับ
  // ป้ายบนเส้นคั่นหน้าและมุมมองหน้ากระดาษ ทุกที่จึงเขียนเลขเหมือนกันเป๊ะ
  const mk = t2.sp ? pageNumberLabelFor(fmt) : prosePageNumberLabelFor(fmt);
  const first = Math.max(1, Math.round(+currentStartPage(t2) || 1));
  // [alpha.103 ข้อ 4] เงื่อนไข "ข้ามหน้าแรก" อยู่ในตัวทำป้ายแล้ว (ที่เดียวทั้งระบบ)
  const label = (isDoc && mk) ? mk(first) : '';
  pane.style.setProperty('--pg-no-first', label ? JSON.stringify(label) : '""');
  return label;
}

/**
 * [alpha.159 · QoL] "หน้า N / M" ตรงเคอร์เซอร์บนแถบสถานะ — อ่านจากรายการเส้นคั่นหน้าของแท็บนี้
 * ที่ตัวจัดหน้าคำนวณไว้แล้ว (ไม่วัด DOM ใหม่) · เลขเป็น "เลขที่พิมพ์" (เคารพเลขหน้าเริ่มต้น/ไล่ต่อเนื่อง)
 */
export function updateCursorPage() {
  const box = $('#status-page');
  if (!box) return '';
  const t2 = state.active;
  const v = t2 && (t2.editor || t2.sp) && (t2.editor || t2.sp).view;
  if (!v) { box.textContent = ''; return ''; }
  const brk = t2.sp ? pageBreaks(v) : prosePageBreaks(v);
  const r = pageAtPos(brk, v.state.selection.head, currentStartPage(t2));
  const txt = r.total > 1 ? ttf('ui.app.pageAtCursor', r.printed, r.printedLast) : '';
  if (box.textContent !== txt) box.textContent = txt;
  return txt;
}
let _cursorPageRaf = 0;
document.addEventListener('selectionchange', () => {
  if (_cursorPageRaf) return;
  _cursorPageRaf = requestAnimationFrame(() => { _cursorPageRaf = 0; try { updateCursorPage(); } catch {} });
});

/** เมนู "ส่วนเสริม" ของชื่อตัวละคร — เว้นจากชื่อ 1 วรรคเสมอ */
export function extensionMenu(x, y) {
  const t2 = state.active;
  if (!t2 || !t2.sp) { setStatus(tt('ui.app.openSceneScreenplayBefore')); return null; }
  if (t2.sp.curElement() !== 'character') {
    setStatus(tt('ui.app.pasteLineCharacterBefore2'));
    return null;
  }
  const cur = t2.sp.curExtension();
  const items = CHAR_EXTENSIONS.map((e) => ({
    label: (e === cur ? gi('dot') + ' ' : '   ') + e,
    click: () => { t2.sp.setExtension(e); markDirty(t2); },
  }));
  items.push({ label: tt('ui.app.notHasPart'), click: () => { t2.sp.setExtension(''); markDirty(t2); } });
  // [alpha.137] ป้าย #elem-badge ถูกถอดออกแล้ว — ยึดตำแหน่งจากตัวเลือกรูปแบบบนแถบลอยแทน
  const r = ($('#elem-badge') || $('#tb-sp-elem'))?.getBoundingClientRect();
  return popupMenu(x ?? (r ? r.left : 200), y ?? (r ? r.bottom + 4 : 120), items);
}

// ═════════ [78] ไปยังหน้า / ฉาก ═════════
/** บล็อก + หน้าของบทที่เปิดอยู่ (ใช้ทั้ง goto และเส้นคั่นหน้า) */
export function spPageModel(tab) {
  const t2 = tab || state.active;
  if (!t2 || !t2.sp) return null;
  const fmt = spFormat();
  const blocks = blocksFromDoc(t2.sp.view.state.doc);
  const pages = pagesOf(blocks, fmt);
  return { fmt, blocks, pages, tab: t2 };
}

/**
 * [alpha.58r บั๊ก 20] แบบเดียวกันสำหรับนิยาย — หน้า + หัวข้อ (บท)
 * @returns {{fmt,blocks,pages,tab,prose:true}|null}
 */
export function prosePageModel(tab) {
  const t2 = tab || state.active;
  if (!t2 || !t2.editor) return null;
  const spf = spFormat();
  const pf = proseFormat();
  // `blocks` ยังต้องเป็นชุดจากตัวประมาณเสมอ — gotoScene()/gotoDialog() อ่าน type/text/pos
  // จากมันเพื่อไล่หัวข้อ (บท) ซึ่งกล่องที่วัดจาก DOM ไม่มี
  const blocks = proseBlocksFromDoc(t2.editor.view.state.doc);
  // [alpha.82] แต่ "จำนวนหน้า/จุดเริ่มหน้า" ต้องมาจากการวัดชุดเดียวกับเส้นคั่นหน้า
  // ไม่งั้น gotoPage() กับแถบสถานะใช้ตัวเลขคนละชุดกับเส้นที่ตาเห็น
  const mz = proseMeasured(t2, spf);
  if (mz) {
    const starts = proseMeasuredStarts(t2.editor.view, mz, currentStartPage(t2));
    const pages = { pages: starts.map((pos, i) => ({ index: i + 1, blocks: pos == null ? [] : [{ pos }] })),
                    count: starts.length };
    return { fmt: pf, paper: spf.paper, margins: spf.margins, blocks, pages,
             measured: mz, tab: t2, prose: true };
  }
  const pages = prosePagesOf(blocks, pf, spf.paper, spf.margins);
  return { fmt: pf, paper: spf.paper, margins: spf.margins, blocks, pages, tab: t2, prose: true };
}
/** โมเดลหน้าของเอกสารที่เปิดอยู่ — บทภาพยนตร์หรือนิยายก็ได้ */
export function anyPageModel(tab) { return spPageModel(tab) || prosePageModel(tab); }

export function gotoPage(n) {
  const m = anyPageModel();
  if (!m) { setStatus(tt('ui.app.openSceneBeforePage')); return false; }
  const pos = m.prose ? findProsePageStart(m.pages, n) : findPageStart(m.pages, n);
  if (pos == null) { setStatus(ttf('ui.app.notHasPageFile', n, m.pages.count)); return false; }
  (m.prose ? m.tab.editor : m.tab.sp).gotoPos(pos);
  setStatus(ttf('ui.app.pagePage', n, m.pages.count));
  return true;
}

export function gotoScene(n) {
  const m = anyPageModel();
  if (!m) { setStatus(tt('ui.app.openSceneBefore')); return false; }
  // นิยาย: "ฉาก" = หัวข้อ (บท) · บทภาพยนตร์: หัวฉาก
  const list = m.prose ? proseHeadings(m.blocks) : scenePositions(m.blocks);
  const item = list[Math.max(1, Math.round(+n || 1)) - 1];
  const pos = item ? item.pos : null;
  if (pos == null) {
    setStatus(ttf('ui.app.notHasFileHas', m.prose ? tt('ui.app.heading') : tt('ui.common.scene2'), n, list.length));
    return false;
  }
  (m.prose ? m.tab.editor : m.tab.sp).gotoPos(pos);
  setStatus(ttf('ui.app.msg8', m.prose ? tt('ui.app.heading') : tt('ui.common.scene2'), n, item.text || ''));
  return true;
}

/** กล่อง "ไปที่…" — เลือกหน้า/ฉาก แล้วกรอกเลข (Ctrl+G) */
export function gotoDialog(kind) {
  const m = anyPageModel();
  if (!m) { setStatus(tt('ui.app.openSceneBeforePageScene')); return null; }
  const scenes = m.prose ? proseHeadings(m.blocks) : scenePositions(m.blocks);
  const unit = m.prose ? tt('ui.app.chapterHeading') : tt('ui.common.scene2');
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-goto-dlg');
  box.append(el('div', 'k-dlg-title', tt('ui.app.msg9')));

  const row = el('div', 'k-goto-row');
  const sel = el('select', 'k-dlg-select'); sel.id = 'goto-kind';
  for (const [v, label] of [['page', tt('ui.common.page')], ['scene', unit]]) {
    const o = el('option', null, label); o.value = v; sel.append(o);
  }
  sel.value = kind === 'scene' ? 'scene' : 'page';
  const inp = el('input', 'k-dlg-input'); inp.id = 'goto-num';
  inp.type = 'number'; inp.min = '1'; inp.value = '1';
  const hint = el('span', 'dim k-goto-hint');
  const syncHint = () => {
    const max = sel.value === 'page' ? m.pages.count : scenes.length;
    inp.max = String(Math.max(1, max));
    hint.textContent = `1–${max}`;
  };
  sel.onchange = () => { syncHint(); renderList(); };
  row.append(sel, inp, hint);
  box.append(row);

  // รายการฉาก — คลิกเลือกได้เลย (จำชื่อฉากง่ายกว่าเลข)
  //
  // [alpha.124 ข้อ 35] เพิ่มช่องค้นหา: บทยาว 200 ฉากต้องเลื่อนหาเองทั้งกอง และ Quick Open
  // (Ctrl+Shift+O) ก็ช่วยไม่ได้เพราะมันค้นจาก **ชื่อไฟล์** ไม่ใช่หัวฉากในเอกสาร
  const find = el('input', 'k-dlg-input k-goto-find');
  find.placeholder = tt('ui.app.gotoFindPlaceholder');
  box.append(find);
  const list = el('div', 'k-goto-list');
  const renderList = () => {
    list.replaceChildren();
    const isScene = sel.value === 'scene';
    find.style.display = isScene ? '' : 'none';
    if (!isScene) { list.style.display = 'none'; return; }
    list.style.display = '';
    if (!scenes.length) { list.append(el('div', 'cmp-empty', ttf('ui.app.fileNotHas', unit))); return; }
    const q = find.value.trim().toLowerCase();
    // ค้นได้ทั้งเลขฉากและข้อความหัวฉาก — พิมพ์ "12" ไปฉาก 12 · พิมพ์ "ห้องครัว" ไปฉากนั้น
    const rows = q ? scenes.filter((x) => String(x.n) === q
                                       || String(x.text || '').toLowerCase().includes(q))
                   : scenes;
    if (!rows.length) { list.append(el('div', 'cmp-empty', tt('ui.app.gotoFindNone'))); return; }
    for (const s of rows) {
      const d = el('div', 'k-menu-item', `${s.n}. ${s.text || tt('ui.common.empty')}`);
      d.onclick = () => { ov.remove(); gotoScene(s.n); };
      list.append(d);
    }
  };
  find.oninput = renderList;
  // Enter ในช่องค้นหา = ไปที่ผลลัพธ์แรก (ไม่ต้องละมือไปคลิก)
  find.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = list.querySelector('.k-menu-item');
    if (first) first.click();
  };
  box.append(list);

  const go = () => {
    const n = parseInt(inp.value, 10) || 1;
    ov.remove();
    if (sel.value === 'scene') gotoScene(n); else gotoPage(n);
  };
  inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  const btns = el('div', 'k-dlg-btns');
  const bCancel = el('button', 'k-cancel', tt('ui.common.cancel')); bCancel.onclick = () => ov.remove();
  const bGo = el('button', 'k-ok', tt('ui.app.msg7')); bGo.onclick = go;
  btns.append(bCancel, bGo); box.append(btns);

  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  escClose(ov, () => ov.remove());              // [alpha.124 ข้อ 15]
  syncHint(); renderList();
  // เปิดมาที่โหมดฉาก = พิมพ์ค้นได้เลย · โหมดหน้า = กรอกเลขได้เลย
  if (sel.value === 'scene') find.focus(); else { inp.focus(); inp.select(); }
  return ov;
}

// ═════════ [54] ตรวจหาข้อผิดพลาดในบท ═════════
let _spErrors = [];               // ผลตรวจล่าสุดของแท็บที่เปิดอยู่ (แถบสถานะใช้ร่วม)
// [alpha.126] `spErrors()` ถูกถอด — ไม่มีใครเรียกเลย (ทุกจุดอ่าน `_spErrors` ตรง ๆ ในไฟล์นี้)

/** ตรวจบทที่เปิดอยู่ — คืน [] เมื่อไม่ใช่บทหนัง */
export function checkScreenplay(tab) {
  const t2 = tab || state.active;
  if (!t2 || !t2.sp) return [];
  const blocks = blocksFromDoc(t2.sp.view.state.doc);
  const errs = validateScreenplay(blocks, { limits: state.settings.spLineLimits || undefined });
  // ผูกตำแหน่งจริงในเอกสารให้ทุกข้อ (validator รู้แค่ดัชนีบล็อก)
  for (const e of errs) {
    const b = blocks[e.block];
    e.pos = b && Number.isFinite(b.pos) ? b.pos : null;
    e.text = b ? String(b.text || '') : '';
  }
  _spErrors = errs;
  // [alpha.124 ข้อ 33] ให้จุดที่ผิดโผล่ในเอกสารด้วย ไม่ใช่มีแต่ตัวเลขบนแถบสถานะ
  // ส่งเฉพาะตอนผลเปลี่ยนจริง (setSpErrorMarks คืน false เมื่อเหมือนเดิม) — ตัวตรวจวิ่งทุก 300ms
  // [alpha.160 · P1-1] ส่ง view ของแท็บนี้ — รายการเป็นของตัวแก้ไขแต่ละตัว ไม่ใช่ก้อนกลาง
  if (setSpErrorMarks(errs, t2.sp && t2.sp.view) && t2.sp && t2.sp.view) refreshSpErrorMarks(t2.sp.view);
  return errs;
}

/** ไปยังข้อผิดพลาดถัดไป (วนกลับต้นเมื่อหมด) — Ctrl+Shift+U */
export function findNextSpError() {
  const t2 = state.active;
  if (!t2 || !t2.sp) { setStatus(tt('ui.app.openSceneScreenplayBeforeCheck')); return null; }
  const errs = checkScreenplay(t2);
  updateErrorBadge();
  if (!errs.length) { setStatus(summaryText(errs)); return null; }
  // หาจากตำแหน่งเคอร์เซอร์ปัจจุบัน
  const curPos = t2.sp.view.state.selection.from;
  const blocks = blocksFromDoc(t2.sp.view.state.doc);
  let curBlock = -1;
  for (let i = 0; i < blocks.length; i++) if (blocks[i].pos < curPos) curBlock = i;
  const e = nextError(errs, curBlock);
  if (!e) return null;
  if (Number.isFinite(e.pos)) t2.sp.gotoPos(e.pos);
  const sorted = errs.slice().sort((a, b) => a.block - b.block);
  setStatus(gi('warning-e') + ` ${e.msg}  [${sorted.indexOf(e) + 1}/${errs.length}]`);
  return e;
}

/**
 * ตัวเลขข้อผิดพลาด/ข้อควรดูบนแถบสถานะ
 *
 * [alpha.62 บั๊ก 17] เดิมเป็น "ป้ายแจ้งเตือนเฉย ๆ": ข้อความบอกจำนวนอย่างเดียว
 * คลิกแล้วกระโดดไปข้อถัดไปเงียบ ๆ โดยไม่บอกว่ากดได้ ไม่มีทางดูรายการทั้งหมด
 * ไม่มีทางสั่งตรวจใหม่ และพอเปิดไฟล์นิยายก็หายไปทั้งอันโดยไม่บอกอะไร
 * ตอนนี้: ป้ายบอกให้ชัดว่ากดได้ · คลิก = เมนูคำสั่งครบ · ในโหมดนิยายบอกว่าใช้กับบทเท่านั้น
 */
export function updateErrorBadge() {
  const box = $('#sp-errors');
  if (!box) return;
  const t2 = state.active;
  if (!t2 || !t2.sp) {
    // ไม่ใช่บทภาพยนตร์ → ซ่อน (CSS `#sp-errors:empty{display:none}`) แต่ล้าง title ให้ด้วย
    box.textContent = ''; box.classList.remove('has-err'); box.title = '';
    return;
  }
  const s = errorSummary(_spErrors);
  box.textContent = s.total ? gi('warning-e') + ` ${s.total} ${gi('caret-down')}` : tt('ui.app.checkDone');
  box.classList.toggle('has-err', s.total > 0);
  box.title = summaryText(_spErrors) + tt('ui.app.clickViewCmdItem');
}

/**
 * [alpha.62 บั๊ก 17] เมนูของป้ายตรวจบท — คลิกป้ายแล้วได้ "ทำอะไรได้บ้าง" ครบในที่เดียว
 * (เดิมคลิกแล้วกระโดดไปข้อถัดไปทันที ซึ่งเดาไม่ถูกและถอยกลับไม่ได้)
 */
export function spErrorMenu(x, y) {
  const t2 = state.active;
  if (!t2 || !t2.sp) { setStatus(tt('ui.app.badgeUseScreenplayOpenScene')); return null; }
  const s = errorSummary(_spErrors);
  const items = [];
  if (s.total) {
    items.push({ label: iconHtml('arrow-down', 14) + ttf('ui.app.itemItem', s.total),
                 click: () => findNextSpError() });
    items.push({ label: iconHtml('list-ul', 14) + tt('ui.app.viewListAll'), click: () => showErrorList() });
    items.push('-');
  } else {
    items.push({ label: tt('ui.app.notFoundErrorChapter'), disabled: true });
    items.push('-');
  }
  items.push({ label: iconHtml('reset', 14) + tt('ui.app.checkNewChapter'), click: () => {
    checkScreenplay(t2); updateErrorBadge();
    setStatus(summaryText(_spErrors));
  } });
  // [alpha.127] สวิตช์เปิด/ปิด "เส้นขอบเหลือง/แดง" ในเอกสาร — อยู่ติดกับตัวเลขที่ผู้ใช้เพิ่งกด
  // (จุดที่เจอฟีเจอร์นี้ได้เองโดยไม่ต้องไปงมในตั้งค่า · ตั้งค่ามีช่องเดียวกันให้ด้วย)
  items.push({ label: (isSpErrorMarks() ? gi('checkbox-checked') + ' ' : gi('checkbox') + ' ') + tt('ui.app.spErrMarkToggle'),
               click: () => toggleSpErrorMarks() });
  items.push({ label: iconHtml('clipboard', 14) + tt('ui.app.settingsFormatCheckChapter'), click: () => settingsDialog('page') });
  popupMenu(x, y, items);
  return items.length;                      // > 0 = เมนูถูกเปิดจริง (เทสใช้ตรวจ)
}

/**
 * [alpha.127] เปิด/ปิดเครื่องหมายจุดผิดในเอกสาร — จำลง `settings.spErrorMarks`
 * @param {boolean} [on] ไม่ส่ง = สลับค่าเดิม
 * @returns {boolean} สถานะหลังสลับ
 */
export function toggleSpErrorMarks(on) {
  const next = on === undefined ? !isSpErrorMarks() : !!on;
  setSpErrorMarksOn(next);
  state.settings.spErrorMarks = next;
  saveProjectMetaSoon();   // [alpha.162 · W1-7] เดิมกลืน error เงียบ ๆ
  // วาดใหม่ทุกแท็บบท — เส้นต้องหาย/โผล่ทันที ไม่ใช่รอพิมพ์ตัวถัดไป
  for (const t2 of state.tabs.values()) if (t2.sp && t2.sp.view) refreshSpErrorMarks(t2.sp.view);
  updateErrorBadge();
  setStatus(next ? tt('ui.app.spErrMarkOn') : tt('ui.app.spErrMarkOff'));
  return next;
}

/** รายการข้อผิดพลาดทั้งบท — คลิกแถวเพื่อกระโดดไป */
export function showErrorList() {
  const t2 = state.active;
  if (!t2 || !t2.sp) { setStatus(tt('ui.app.openSceneScreenplayBeforeCheck')); return null; }
  const errs = checkScreenplay(t2);
  updateErrorBadge();
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-err-dlg');
  box.append(el('div', 'k-dlg-title', tt('ui.app.checkScreenplay')));
  box.append(el('div', 'dim', summaryText(errs)));
  const list = el('div', 'k-err-list');
  if (!errs.length) list.append(el('div', 'cmp-empty', tt('ui.app.notFoundError')));
  for (const e of errs.slice().sort((a, b) => a.block - b.block)) {
    const row = el('div', 'k-err-row ' + e.severity);
    row.append(el('span', 'k-err-dot', e.severity === 'error' ? gi('forbidden') : gi('warning-e')));
    row.append(el('span', 'k-err-msg', e.msg));
    const snip = String(e.text || '').trim().slice(0, 40);
    if (snip) row.append(el('span', 'dim k-err-snip', '“' + snip + '”'));
    row.onclick = () => { ov.remove(); if (Number.isFinite(e.pos)) t2.sp.gotoPos(e.pos); };
    list.append(row);
  }
  box.append(list);
  const btns = el('div', 'k-dlg-btns');
  const bRe = el('button', null, tt('ui.app.checkNew'));
  bRe.onclick = () => { ov.remove(); showErrorList(); };
  const bOk = el('button', 'k-ok k-cancel', tt('ui.common.close')); bOk.onclick = () => ov.remove();
  btns.append(bRe, bOk); box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (ev) => { if (ev.target === ov) ov.remove(); };
  return ov;
}

/** ตรวจก่อนพิมพ์/ส่งออก (ตั้งค่า spCheckBeforeExport) — คืน true = ไปต่อได้ */
export async function checkBeforeExport() {
  if (state.settings.spCheckBeforeExport === false) return true;
  const t2 = state.active;
  if (!t2 || !t2.sp) return true;
  const errs = checkScreenplay(t2);
  updateErrorBadge();
  const hard = errs.filter((e) => e.severity === 'error');
  if (!hard.length) return true;
  return confirmBox(ttf('ui.app.foundErrorChapterEg', hard.length, hard[0].msg), tt('ui.app.exportNext'));
}

// ═════════ alpha.58 · [71][72][73] รายงานบทภาพยนตร์ ═════════
// ทั้งสามรายงานอ่านจาก "บล็อกในเอกสารจริง" ชุดเดียวกับที่ใช้จัดหน้า → ตัวเลขตรงกับแถบสถานะเสมอ

/** บล็อก + รูปแบบของแท็บบทที่เปิดอยู่ (คืน null เมื่อไม่ใช่บทภาพยนตร์) */
export function spReportInput(tab) {
  const t2 = tab || state.active;
  if (!t2 || !t2.sp) return null;
  // [alpha.164] รายงานของฉากมีปัญหา = ฉบับแก้ไขเสมอ (ต่อให้จอกำลังโชว์ฉบับเดิม)
  return { blocks: blocksFromDoc(revisedDoc(t2) || t2.sp.view.state.doc), fmt: spFormat(),
           startPage: currentStartPage(t2), tab: t2 };
}

export const SP_REPORTS = {
  location:  { title: tt('ui.app.reportPlace2'), file: tt('ui.app.reportPlace') },
  character: { title: tt('ui.app.report2'), file: tt('ui.app.report') },
  chart:     { title: tt('ui.app.graphDialogueNextPage'), file: tt('ui.app.graphDialogue') },
};

/** สร้างข้อมูลรายงานตามชนิด — แยกออกมาให้ selftest เรียกตรงได้ */
export function buildSpReport(kind, input) {
  const inp = input || spReportInput();
  if (!inp) return null;
  const opts = { fmt: inp.fmt, startPage: inp.startPage };
  if (kind === 'location') return generateLocationReport(inp.blocks, opts);
  if (kind === 'character') return generateCharacterReport(inp.blocks, opts);
  if (kind === 'chart') return generateDialogueChart(inp.blocks, opts);
  return null;
}
export function spReportText(kind, data) {
  if (kind === 'location') return locationReportText(data);
  if (kind === 'character') return characterReportText(data);
  return dialogueChartText(data);
}

/** แถบสัดส่วนของกราฟบทพูด (ข้อ 73) — วาดด้วย div ล้วน ไม่พึ่ง canvas/ไลบรารี */
function chartBar(page) {
  const bar = el('div', 'sp-chart-bar');
  bar.title = CHART_KINDS.map((k) => `${CHART_LABELS[k]} ${page.percentages[k]}%`).join(' · ');
  for (const k of CHART_KINDS) {
    const pc = page.percentages[k];
    if (pc <= 0) continue;
    const seg = el('div', 'sp-chart-seg seg-' + k);
    seg.style.width = pc + '%';
    bar.append(seg);
  }
  return bar;
}

/** กล่องรายงาน — คลิกแถวเพื่อกระโดดไปยังฉากนั้นในบท */
export function openSpReport(kind = 'location') {
  const inp = spReportInput();
  if (!inp) { setStatus(tt('ui.app.openSceneScreenplayBeforeDo')); return null; }
  const info = SP_REPORTS[kind] || SP_REPORTS.location;
  const data = buildSpReport(kind, inp);
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-report-dlg');
  box.append(el('div', 'k-dlg-title', info.title + ' — ' + (inp.tab.title || '')));

  // แถบสลับรายงาน (ทั้งสามอันเป็นเรื่องเดียวกัน — ไม่ต้องปิดแล้วเปิดใหม่)
  const tabs = el('div', 'k-report-tabs');
  for (const k of Object.keys(SP_REPORTS)) {
    const b = el('button', 'k-report-tab' + (k === kind ? ' on' : ''), SP_REPORTS[k].title);
    b.onclick = () => { ov.remove(); openSpReport(k); };
    tabs.append(b);
  }
  box.append(tabs);

  const body = el('div', 'k-report-body');
  const goto = (pos) => { if (Number.isFinite(pos)) { ov.remove(); inp.tab.sp.gotoPos(pos); } };

  if (kind === 'location') {
    box.append(el('div', 'dim',
      ttf('ui.app.placeScenePage', data.locations.length, data.totalScenes, data.totalPages)));
    for (const L of data.locations) {
      const g = el('div', 'k-report-group');
      const h = el('div', 'k-report-ghead');
      h.append(el('b', null, L.location));
      h.append(el('span', 'dim', ttf('ui.app.scenePage', L.intExt.join('/') || '—', L.sceneCount, L.pages)));
      g.append(h);
      for (const s of L.scenes) {
        const row = el('div', 'k-report-row');
        row.append(el('span', 'k-report-no', tt('ui.app.scene3') + s.n));
        row.append(el('span', 'k-report-pg', tt('ui.common.page2') + s.page));
        row.append(el('span', 'k-report-txt', s.heading));
        if (s.characters.length) row.append(el('span', 'dim k-report-chars', s.characters.join(', ')));
        if (Number.isFinite(s.pos)) { row.classList.add('can-go'); row.onclick = () => goto(s.pos); }
        g.append(row);
      }
      body.append(g);
    }
    if (!data.locations.length) body.append(el('div', 'cmp-empty', tt('ui.app.notHasHeadScene')));
  } else if (kind === 'character') {
    box.append(el('div', 'dim',
      ttf('ui.app.characterLineDialoguePage', data.characters.length, data.totalLines, data.totalPages)));
    const tbl = el('table', 'k-report-table');
    const head = el('tr');
    for (const h of [tt('ui.common.character'), tt('ui.common.scene2'), tt('ui.app.timesSpeak'), tt('ui.common.line'), tt('ui.common.avgScene'), tt('ui.common.page'), tt('ui.app.ratio')])
      head.append(el('th', null, h));
    tbl.append(head);
    for (const c of data.characters) {
      const tr = el('tr');
      tr.append(el('td', 'k-report-name', c.name));
      tr.append(el('td', null, String(c.sceneCount)));
      tr.append(el('td', null, String(c.speeches)));
      tr.append(el('td', null, String(c.totalLines)));
      tr.append(el('td', null, String(c.avgLines)));
      tr.append(el('td', null, c.firstPage === c.lastPage ? String(c.firstPage)
                                                          : c.firstPage + '–' + c.lastPage));
      const td = el('td');
      const b = el('div', 'sp-chart-bar');
      const seg = el('div', 'sp-chart-seg seg-dialogue'); seg.style.width = c.share + '%';
      b.append(seg); td.append(b, el('span', 'dim', ' ' + c.share + '%'));
      tr.append(td);
      tbl.append(tr);
    }
    body.append(tbl);
    if (!data.characters.length) body.append(el('div', 'cmp-empty', tt('ui.app.notHasDialogueChapter')));
  } else {
    box.append(el('div', 'dim',
      ttf('ui.app.mergeStory', CHART_KINDS.map((k) => CHART_LABELS[k] + ' ' + data.overall[k] + '%').join(' · '))));
    const legend = el('div', 'sp-chart-legend');
    for (const k of CHART_KINDS) {
      const it = el('span', 'sp-chart-key');
      it.append(el('i', 'sp-chart-swatch seg-' + k), CHART_LABELS[k]);
      legend.append(it);
    }
    body.append(legend);
    for (const p of data.pages) {
      const row = el('div', 'k-report-row sp-chart-row');
      row.append(el('span', 'k-report-pg', tt('ui.common.page2') + p.page));
      row.append(chartBar(p));
      const top = p.charDensity.slice(0, 3).map((d) => `${d.name} ${d.lines}`).join(' · ');
      row.append(el('span', 'dim k-report-chars', top));
      body.append(row);
    }
  }
  box.append(body);

  const btns = el('div', 'k-dlg-btns');
  const bCopy = el('button', null, tt('ui.common.copyText'));
  bCopy.onclick = async () => {
    try { await navigator.clipboard.writeText(spReportText(kind, data)); setStatus(tt('ui.app.copyReportDone')); }
    catch (e) { log('warn', tt('ui.app.copyReportNotOk'), e); }
  };
  const bSave = el('button', null, tt('ui.app.saveFile'));
  bSave.onclick = async () => {
    const p = await kapi.saveAsDialog(info.file + '.txt', 'txt');
    if (!p) return;
    await kapi.writeFile(p, spReportText(kind, data));
    setStatus(tt('ui.app.saveReportDone') + p);
  };
  const bOk = el('button', 'k-ok k-cancel', tt('ui.common.close')); bOk.onclick = () => ov.remove();
  btns.append(bCopy, bSave, bOk); box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (ev) => { if (ev.target === ov) ov.remove(); };
  return ov;
}

// ---------------- ขนาด UI (บั๊ก #9) ----------------
// --ui-scale คูณเข้ากับฟอนต์ body + ขนาดโครงสร้างของ UI ทุกชิ้นใน style.css (calc(px * var(--ui-scale)))
// ปุ่ม/ช่องกรอก/select ใช้ font:inherit อยู่แล้ว → เปลี่ยนฟอนต์ body ตัวเดียวก็ไล่ตามทั้งแอป
export function applyUIScale(v) {
  const s = Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX,
    v !== undefined ? v : (parseFloat(state.settings.uiScale) || 1)));
  document.documentElement.style.setProperty('--ui-scale', s.toFixed(3));
  const sl = $('#st-uiscale'); if (sl) sl.value = String(s);
  const lbl = $('#st-uiscale-lbl'); if (lbl) lbl.textContent = Math.round(s * 100) + '%';
  return s;
}
function setUIScale(v) {
  // ปัดทศนิยม 2 ตำแหน่งก่อนเก็บ — กันค่าสะสมแบบ 1.2000000000000002 จากการกดขยายซ้ำ ๆ
  const s = applyUIScale(Math.round(v * 100) / 100);
  state.settings.uiScale = s;
  if (state.root) saveProjectMeta().catch((e) => log('warn', tt('ui.app.saveSizeUINot'), e));
  setStatus(tt('ui.status.uiScale') + ': ' + Math.round(s * 100) + '%');
}
function bumpUIScale(dir) {
  const cur = parseFloat(state.settings.uiScale) || 1;
  setUIScale(dir === 0 ? 1 : cur + (dir > 0 ? 0.1 : -0.1));
}

// ดู Markdown ดิบของฉากปัจจุบัน (อ่าน + คัดลอกได้ · ตรงกับไฟล์ .md ที่บันทึก)
/**
 * ══════ [alpha.97 ข้อ 6] ★ Markdown ดิบ — แก้ไขได้ + มีเลขบรรทัด ══════
 *
 * ผู้ใช้: *"Markdown ดิบ ยังได้แค่ดู แต่แก้ไขไม่ได้ ควรแก้ไขได้ และสามารถแสดงเลขบรรทัด"*
 *
 * ของเดิมตั้ง `ta.readOnly = true` ตรง ๆ — กล่องนี้จึงเป็นแค่หน้าต่างส่องดู
 * ตอนนี้พิมพ์กลับได้จริง: กด "ใช้การแก้ไข" แล้วข้อความถูกพาร์สกลับเข้าเอกสาร
 * (เส้นทางเดียวกับตอนเปิดไฟล์ — `setMarkdown()` ของตัวแก้ไขนั้น ๆ) แล้วมาร์กว่ายังไม่บันทึก
 *
 * เลขบรรทัดเป็นรางแยกที่ซิงก์ `scrollTop` กับ textarea — วิธีเดียวที่ทำได้กับ textarea จริง
 * (จะใช้ ::before ไม่ได้เพราะข้อความในนั้นเป็นค่าของ element ไม่ใช่ลูกใน DOM)
 */
function showSourceView() {
  // ห้ามตั้งชื่อตัวแปรว่า t — จะบัง t() ของ i18n ทำให้ปุ่ม "คัดลอกทั้งหมด" พังตอนเรียก t('status.copied')
  const tab = state.active;
  const src = tab && (tab.editor || tab.sp);
  if (!src) { setStatus(tt('ui.app.openSceneBeforeViewMarkdown')); return; }
  const md = src.getMarkdown();
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide');
  box.append(el('div', 'k-dlg-title', tt('ui.app.markdown') + tab.title));
  const wrap = el('div', 'k-src-wrap');
  const gut = el('div', 'k-src-gutter');
  const ta = el('textarea', 'k-src-view');
  ta.value = md;
  ta.spellcheck = false;
  wrap.append(gut, ta);
  box.append(wrap);
  const hint = el('div', 'k-hint k-src-hint', tt('ui.app.mdEditHint'));
  box.append(hint);
  const syncNums = () => {
    const n = ta.value.split('\n').length;
    if (gut.childElementCount !== n) {
      const frag = document.createDocumentFragment();
      for (let i = 1; i <= n; i++) frag.append(el('div', null, String(i)));
      gut.replaceChildren(frag);
    }
    gut.scrollTop = ta.scrollTop;
  };
  ta.addEventListener('input', syncNums);
  ta.addEventListener('scroll', () => { gut.scrollTop = ta.scrollTop; });
  syncNums();
  const btns = el('div', 'k-dlg-btns');
  const cp = el('button', null, tt('ui.common.copyAll'));
  const ap = el('button', null, tt('ui.app.mdApply'));
  const cl = el('button', 'k-ok k-cancel', tt('ui.common.close'));
  cp.onclick = () => { ta.select(); document.execCommand('copy'); setStatus(t('status.copied')); };
  ap.onclick = () => {
    if (ta.value === md) { setStatus(tt('ui.app.mdNoChange')); return; }
    try {
      src.setMarkdown(ta.value);
      markDirty(tab);
      // เนื้อหาถูกแทนทั้งก้อน — decoration/ตำแหน่งที่จำไว้เป็นของเอกสารเก่าทั้งหมด
      if (tab.editor) { refreshMentions(tab.editor.view); bumpProseLayout(); }
      resetViewScroll(tab);
      repaginateFast(tab);
      scheduleCount();
      setStatus(tt('ui.app.mdApplied'));
      ov.remove();
    } catch (err) { setStatusError(tt('ui.app.mdApplyFail') + errText(err)); }
  };
  cl.onclick = () => ov.remove();
  btns.append(cp, ap, cl); box.append(btns); ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ta.focus();
}

// ══════════ [alpha.92 ข้อ 3] ★ ตัวตรวจคำผิดสองตัว ห้ามขีดทับกัน ══════════
//
// อาการที่ผู้ใช้เจอ: คำอังกฤษที่สะกดผิดได้ **เส้นสองเส้น** — เส้นตรงสีดำแนบเส้นบรรทัด
// กับหยักแดงเยื้องลงมาอีกเส้น
//
// เหตุ: โปรแกรมเปิดตัวตรวจ **สองตัวพร้อมกัน** โดยไม่มีใครรู้จักกัน
//   · ของ Chromium — attribute `spellcheck` บน contenteditable · เบราว์เซอร์วาดเอง ไม่มีใน DOM
//     (พิสูจน์แล้ว: มี 57 ภาษา **ไม่มีไทย** → ขีดเฉพาะคำอังกฤษ จึงเห็นเส้นดำเฉพาะคำลาติน)
//   · ของโปรแกรมเอง — `.k-spell-bad` หยักแดง · รู้จักไทย และรู้จัก "คำที่ผู้ใช้เพิ่มเอง"
//
// ของ Chromium ไม่มีทางรู้จักพจนานุกรมส่วนตัว → ผู้ใช้กด "เพิ่มลงพจนานุกรม" แล้วหยักแดงหาย
// แต่ **เส้นดำยังอยู่** และไม่มีทางเอาออกได้เลย · เส้นที่ผู้ใช้สั่งอะไรไม่ได้ = เส้นที่ไม่ควรมี
//
// แก้: ให้เหลือตัวเดียวเสมอ
//   "ตรวจคำผิด" (spellCheck)          = สวิตช์ใหญ่ · ปิด = ไม่ขีดอะไรเลยทั้งสองระบบ
//   "ใช้พจนานุกรมของโปรแกรม" (…Dict)  = เปิด (ค่าเริ่มต้น) ใช้ของเรา · ปิด = ตกไปใช้ของ Chromium
// ไม่ต้องย้ายค่าที่ผู้ใช้ตั้งไว้เดิมเลย เพราะค่าเดิมของทั้งคู่คือ "เปิด" อยู่แล้ว

/** ตอนนี้ใช้ตัวตรวจของโปรแกรมเองอยู่ไหม (ไทย+อังกฤษ+คำที่ผู้ใช้เพิ่มเอง) */
export function useDictSpell() {
  return state.settings.spellCheck !== false
      && state.settings.spellCheckDict !== false
      && spell.ready();
}

// เปิด/ปิดการตรวจคำผิดของ Chromium บนตัวแก้ไขทุกตัว (contenteditable spellcheck)
// ให้มันทำงาน **เฉพาะตอนที่ของเราไม่ได้ทำงาน** เท่านั้น — คลังคำหายก็ยังมีตัวสำรอง
export function applySpellcheck() {
  const native = state.settings.spellCheck !== false && !useDictSpell();
  document.querySelectorAll('.ProseMirror').forEach((el) => { el.spellcheck = native; });
}

// ตัวตรวจคำผิดแบบพจนานุกรม (ไทย+อังกฤษ ออฟไลน์) — คืน null เมื่อปิดหรือคลังยังไม่พร้อม
export function spellChecker() {
  if (!useDictSpell()) return null;
  return (text) => spell.check(text);
}

// โหลดคลังคำ: หลัก (assets ที่มากับแอป) + เสริม (personal + Plugins/dictionaries)
// ถ้าไม่มีคลังหลัก จะลองดาวน์โหลดจาก settings.spellDictUrl (auto-provision)
async function loadSpellDict(root) {
  try {
    let { th, en } = await kapi.spellBase();
    if (!th && state.settings.spellDictUrl) {                 // คลังหาย → ดาวน์โหลดให้อัตโนมัติ
      try { await kapi.spellDownload(state.settings.spellDictUrl, 'th');
            ({ th, en } = await kapi.spellBase()); } catch {}
    }
    if (th || en) spell.loadBase(th || '', en || '');
    const extra = await kapi.spellExtra(root);
    spell.setExtra(extra);
  } catch {}
  refreshAllSpell();
}

// รีเฟรชการขีดเส้นใต้คำผิดทุกแท็บ (ใช้เมื่อสลับตัวเลือก / เพิ่มคำ / โหลดคลังเสร็จ)
export function refreshAllSpell() {
  applySpellcheck();          // เงื่อนไข "ใครเป็นคนขีด" เปลี่ยนไปพร้อมกันเสมอ (คลังคำโหลดเสร็จ ฯลฯ)
  for (const t of state.tabs.values()) {
    if (t.editor) refreshSpell(t.editor.view);
    if (t.sp) refreshSpell(t.sp.view);
  }
}

// ═══════════ [alpha.124 ข้อ 30] คำแนะนำ + ข้ามคำนี้ครั้งนี้ ═══════════

/** คำที่น่าจะถูกสำหรับคำที่ขีดแดง — ใช้เอนจินเดียวกับที่ตัดสินว่า "ผิด" (spell.js) */
export function spellSuggest(word, max = 6) {
  try { return spell.suggest(word, max); } catch { return []; }
}

/** ข้ามคำนี้ในรอบการทำงานนี้ (ไม่เขียนลงคลังคำถาวร) แล้วลบเส้นแดงออกทันที */
export function spellIgnoreOnce(word) {
  const ok = spell.ignoreOnce(word);
  if (ok) refreshAllSpell();
  return ok;
}

/**
 * แทนที่คำที่ขีดแดงด้วยคำที่เลือกจากเมนู — แก้ **ในเอกสารจริง** ไม่ใช่แค่คัดลอกให้
 * @param {HTMLElement} badEl ตัว `.k-spell-bad` ที่คลิกขวา
 * @param {string} word คำใหม่
 */
export function replaceSpellWord(badEl, word) {
  const t = state.active;
  const view = t?.editor?.view || t?.sp?.view;
  if (!view || !badEl) return false;
  try {
    // decoration เป็น inline span ครอบคำพอดี → หาตำแหน่งในเอกสารจากโหนดตัวแรกข้างใน
    const inner = badEl.firstChild || badEl;
    const from = view.posAtDOM(inner, 0);
    const to = from + (badEl.textContent || '').length;
    if (!(to > from)) return false;
    view.dispatch(view.state.tr.insertText(word, from, to));
    view.focus();
    if (t) markDirty(t);
    setStatus(ttf('ui.app.spellReplaced', badEl.textContent, word));
    return true;
  } catch (e) { log('warn', tt('ui.app.spellReplaceFail'), e); return false; }
}

// รีเฟรชการไฮไลต์ชื่อ Wiki ทุกแท็บ (ใช้เมื่อสลับ "จับชื่อ Wiki อัตโนมัติ")
export function refreshAllMentions() {
  for (const t of state.tabs.values()) {
    if (t.editor) refreshMentions(t.editor.view);
    if (t.sp) t.sp.refreshMentions?.();
  }
}

// ตั้ง/รีเซ็ตตัวจับเวลา autosave ตาม autoSaveMinutes (0 = ปิด)
function restartAutosave() {
  if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; }
  const min = parseInt(state.settings.autoSaveMinutes, 10);
  if (!min || min <= 0) return;               // 0 = ปิดบันทึกอัตโนมัติ
  // [alpha.124 ข้อ 41] ★ บันทึกอัตโนมัติต้อง **รอทีละไฟล์** และรับ error เอง
  //
  // เดิม: `for (...) saveTab(t)` แบบไม่ await → ทุกแท็บที่ค้างเขียนดิสก์พร้อมกันทั้งกอง
  // (แต่ละครั้งยัง `writeSceneMeta` + `updateSceneRow` แตะ `scenes.json` ไฟล์เดียวกันด้วย
  //  = อ่าน-แก้-เขียนซ้อนกัน ตัวท้ายชนะ ค่าที่เพิ่งเขียนของตัวอื่นหาย)
  // และ error จากดิสก์กลายเป็น unhandled promise rejection ที่ไม่มีใครเห็น
  //
  // และเลิกใช้ `setTimeout(…, 300)` เดาเวลา — อัปเดตป้ายหลังเขียนเสร็จจริง
  let autosaveBusy = false;
  autosaveTimer = setInterval(async () => {
    if (autosaveBusy) return;            // รอบก่อนยังเขียนไม่เสร็จ (ดิสก์ช้า/ไฟล์เยอะ) → ข้ามรอบนี้
    const pending = [...state.tabs.values()].filter((t) => t.dirty);
    if (!pending.length) return;
    autosaveBusy = true;
    let ok = 0;
    try {
      for (const t of pending) {
        if (!t.dirty || !state.tabs.has(t.file)) continue;   // ถูกบันทึก/ปิดไปแล้วระหว่างรอคิว
        try { if ((await saveTab(t, { auto: true })) !== false) ok++; }
        catch (e) {
          // [alpha.162 · W4] บันทึกอัตโนมัติล้มเคยลงแต่ไฟล์บันทึก — ผู้ใช้ไม่รู้เลยว่างานไม่ได้ลงดิสก์
          // (และยังพิมพ์ต่ออีกเป็นชั่วโมง) · ตอนนี้ขึ้นแถบสถานะพร้อมเหตุผลที่อ่านรู้เรื่อง
          log('error', tt('ui.app.autosaveFail') + (t.title || t.file), e);
          setStatusError(failText(tt('ui.app.autosaveFail') + (t.title || t.file), e));
        }
      }
    } finally { autosaveBusy = false; }
    log('info', ttf('ui.app.autosaveRunN', ok, pending.length));
    updateDirtyBadge();
    refreshStatusBar();
  }, min * 60 * 1000);
}

// เขียน meta (settings/goals/title/author) กลับลง project.khn.json
export async function saveProjectMeta() {
  if (!state.root || !state.meta) return;
  state.meta.settings = state.settings;
  state.meta.goals = state.goals;
  await kapi.writeFile(await kapi.join(state.root, 'project.khn.json'),
                       JSON.stringify(state.meta, null, 2));
}

/**
 * [alpha.162 · W1-7] บันทึกค่าโปรเจกต์แบบ "ยิงแล้วไปต่อ" — แต่ **ห้ามเงียบเมื่อเขียนไม่สำเร็จ**
 *
 * ต้นตอ: สวิตช์ตั้งค่า 20 กว่าจุดเรียก `saveProjectMeta()` โดยไม่ await (ถูกแล้ว — ไม่ควรหน่วง UI)
 * แต่เมื่อเขียนล้ม (ดิสก์เต็ม · ไฟล์ถูกล็อกโดยตัวซิงก์คลาวด์) กลายเป็น unhandled rejection:
 * บนจอสวิตช์ติดแล้ว แต่ค่าไม่เคยลงไฟล์ → เปิดโปรแกรมใหม่ค่ากลับไปเหมือนเดิมโดยไม่มีใครบอก
 */
export function saveProjectMetaSoon() {
  return saveProjectMeta().catch((e) => {
    log('error', tt('ui.app.saveSettingsFail'), e);
    setStatus(tt('ui.app.saveSettingsFail'));
  });
}

// ---------------- โครงโปรเจกต์ (อ่านโครงเดียวกับ Killian v1) ----------------
async function closeProjectIfAny() {
  if (!state.root) return true;
  // [alpha.94] Story Starter บันทึกอัตโนมัติแบบหน่วงรวบ — เขียนของที่ยังค้างก่อนทิ้ง state.root
  await flushStarter();
  // [alpha.60r ข้อ 2] บันทึกรายการแท็บที่เปิดอยู่ก่อนปิด — จะกู้คืนเมื่อเปิดโปรเจกต์ครั้งต่อไป
  await saveOpenTabs();
  // [alpha.156] ★ กฎถาวร alpha.72 — อ่านจาก "ทะเบียนงานค้าง" ตัวเดียวกับตอนปิดโปรแกรม
  // เดิมดูแค่แท็บ → กระดานวางแผน/ผังแตกสาย/ผลวิเคราะห์ AI/ห้องซ้อมบท ที่ยังไม่บันทึก หายเงียบตอนเปิดโปรเจกต์อื่น
  const items = allDirtyList();
  if (items.length) {
    const { action, keys } = await saveAllDialog(items, {
      title: ttf('ui.app.projectPrevHasTab', items.length),
      saveLabel: tt('ui.app.saveAllDoneClose'),
      discardLabel: tt('ui.app.closeNotSave'),
      cancelLabel: tt('ui.common.cancel'),
    });
    if (action !== 'save' && action !== 'discard') return false;
    if (action === 'save') {
      const res = await dirtyRegistry.saveKeys(keys);
      if (res.failed.length) {
        // บันทึกไม่ได้ = ห้ามปิดโปรเจกต์ (งานจะหาย) — เหมือน confirmQuit
        for (const f of res.failed) log('error', tt('ui.app.quitSaveBeforeClose') + f.key, f.error);
        setStatus(ttf('ui.app.saveNotOkList', res.failed.length));
        return false;
      }
    }
  }
  // [alpha.148] จดสถิติคำที่ค้างอยู่ก่อน state.root เปลี่ยน (หลังจากนี้ตัวจดจะไม่ยอมเขียนข้ามโปรเจกต์)
  try { await flushWordHistory(); } catch {}
  for (const t of state.tabs.values()) {
    t.dirty = false;
    t.editor?.destroy(); t.wiki?.destroy(); t.sp?.destroy();
    t.gal?.destroy(); t.net?.destroy(); t.planner?.destroy();
    t.pane.remove(); t.tabBtn.remove();
    if (t.floatWin) { t.floatWin.remove(); t.floatWin = null; }
  }
  state.tabs.clear(); state.active = null; state.root = null;
  // ล้างดัชนี/เอนจินที่ผูกกับโปรเจกต์เดิม — ไม่งั้นโปรเจกต์ใหม่จะเห็นข้อมูล/คีย์ของเก่า
  resetAutoLink(); resetTaskEngine(); clearKeyCache(); clearKeysCache(); resetAI(); resetSplitSystem(); resetKanban();
  resetAnalyzer();                      // [alpha.89] ฉาก/ตัวละครที่แผงวิเคราะห์แคชไว้เป็นของโปรเจกต์เดิม
  resetOnset();                         // [alpha.164] ดัชนีฉากมีปัญหาเป็นของโปรเจกต์เดิม
  resetReview(); resetCommentStore(); _cmMigrated.clear(); clearCommentAnchors();
  imgURLBase.clear();
  clearFeaturePanels();                 // บั๊ก #18: เนื้อแผงฟีเจอร์เป็นของโปรเจกต์เดิม ต้องล้าง
  $('#tree').innerHTML = ''; $('#outline').innerHTML = '';
  refreshToolbar(); scheduleCount();
  return true;
}

export async function loadProject(root) {
  // [alpha.62 บั๊ก 9] ครอบทั้งก้อนด้วย try/finally — ถ้าโยน error กลางทาง ตัวบอกสถานะต้องไม่ค้าง
  const t0 = performance.now();
  logAction('project', tt('ui.common.openProject'), root);
  try {
    const r = await loadProjectInner(root);
    logAction('project', ttf('ui.app.openProjectDoneMs', Math.round(performance.now() - t0)), root);
    return r;
  } catch (e) {
    // [alpha.72 ข้อ 5] เดิมพังตรงนี้แล้วผู้ใช้เห็นแค่หน้าจอว่าง ไม่มีอะไรใน log เลย
    log('error', tt('ui.app.projectOpenProjectNot') + root, e);
    throw e;
  } finally { clearBusy(); }
}
/**
 * [alpha.162 · W1-6] ★ เปิดโปรเจกต์ "จากการกดของผู้ใช้" — ทางเดียวของทุกปุ่ม/เมนู
 *
 * เดิมสี่ทาง (เมนูเปิดโปรเจกต์ · เปิดจากที่อยู่ · นำเข้า Scrivener · ปุ่มบนแถบ) เรียก `loadProject()`
 * **แบบไม่ await** ทั้งที่มันโยน error ได้ → เปิดไม่สำเร็จแล้วไม่มีอะไรบอกผู้ใช้เลย (unhandled rejection
 * ลงแค่ในไฟล์บันทึก) · และกดสองครั้งรัว ๆ = เปิดซ้อนกันสองรอบบนสถานะเดียวกัน
 */
const OPENING_PROJ = { on: false };
async function openProjectFromUi(root) {
  if (!root) return false;
  if (OPENING_PROJ.on) { setStatus(tt('ui.app.busyOpenProject')); return false; }
  OPENING_PROJ.on = true;
  try { await loadProject(root); return true; }
  catch { setStatus(tt('ui.app.projectOpenProjectNot') + root); return false; }
  finally { OPENING_PROJ.on = false; }
}

async function loadProjectInner(root) {
  // [alpha.60r ข้อ 8 → alpha.62] รายงานที่แถบสถานะล่าง (ไม่ใช่หน้าจอเต็มจอ)
  setBusy(tt('ui.app.busyOpenProject'));
  if (!(await kapi.exists(await kapi.join(root, 'project.khn.json')))) {
    // ตรวจก่อน "ก่อน" ถามบันทึก — จะได้ไม่ทำผู้ใช้เสียเวลาตอบกล่องแล้วค่อยรู้ว่าโฟลเดอร์ผิด
    clearBusy();
    // [alpha.124 ข้อ 43] เดิม `alert()` แล้วจบ — โปรเจกต์ที่ถูกย้าย/ลบยังค้างในรายการล่าสุด
    // ตลอดไป กดทีไรก็ได้กล่องเดิมซ้ำ ๆ โดยไม่มีทางเอาออก · ตอนนี้เสนอให้ลบออกได้เลย
    const inRecent = (await kapi.listRecent().catch(() => [])).includes(root);
    if (inRecent) {
      const v = await choose(ttf('ui.app.recentBrokenAsk', root), [
        { label: tt('ui.app.recentBrokenRemove'), value: 'remove', danger: true },
        { label: tt('ui.app.recentBrokenKeep'), value: 'keep', primary: true },
      ]);
      if (v === 'remove') {
        await kapi.removeRecent(root);
        setStatus(tt('ui.app.recentBrokenRemoved'));
        try { const { refreshHomePanels } = await import('./home-ui.js'); refreshHomePanels(); } catch {}
      }
    } else {
      await confirmBox(tt('ui.app.folderNotProjectKillian'), tt('ui.common.msg3'));
    }
    return;
  }
  // [alpha.62 บั๊ก 9] กล่อง "บันทึกก่อนปิด?" เด้งตรงนี้ — ต้องล้างตัวบอกสถานะก่อน
  //   ไม่งั้นสปินเนอร์หมุนค้างระหว่างรอผู้ใช้ตอบ ดูเหมือนโปรแกรมแฮงก์
  clearBusy();
  if (!(await closeProjectIfAny())) return;
  setBusy(tt('ui.app.busyReadDataProject'));
  const meta = await kapi.readJson(await kapi.join(root, 'project.khn.json'));
  state.root = root; state.title = meta.title || tt('ui.common.project');
  invalidateSearchIndex();          // [alpha.125 ข้อ A] เปลี่ยนโปรเจกต์ = ดัชนีเก่าใช้ไม่ได้
  invalidateChatRag();              // [alpha.125 ข้อ B] เช่นเดียวกับดัชนี RAG ของแชท
  loadSettings(meta);
  applyWikiCats();
  document.title = state.title + ' — Killian 2';
  // [alpha.137] #projname ถูกลบทิ้ง — ชื่อโปรเจกต์อยู่กลางแถบชื่อหน้าต่างที่เดียว
  $('#tb-title').textContent = state.title + ' — Killian 2';
  await kapi.pushRecent(root);
  // ---- โหลดภาษาของโปรเจกต์ (ถ้าเลือกไว้) ----
  const projLang = state.settings.language || 'en';
  if (projLang !== i18n.lang) {
    setBusy(tt('ui.app.busyLoadLang'));
    await loadLanguage(projLang, root);
  }
  applyDataI18n();
  initIcons();
  applyToolbarShortcutTitles();
  setBusy(tt('ui.app.busyNewStructureProject'));
  await buildTree();
  buildFilterBar().catch(() => {});             // แถบกรอง
  setSummaryBar(summaryBarOn());                 // [alpha.120 ข้อ 15] ปิดไว้เป็นค่าเริ่มต้น
  updateStatusExtras();                          // แถบสถานะพิ่มเติม
  smart.loadNames(root);
  // [alpha.57a ข้อ 4] คลิกขวาที่คำเดา = ไม่ต้องจำคำนั้นอีก
  smart.onIgnore = (w) => {
    smartIgnoreAdd(w);
    setStatus(ttf('ui.app.notRememberEditChapter', w));
  };
  // [alpha.57a ข้อ 5] ฟอนต์ตามภาษาของโปรเจกต์ (ต้องรู้ path จริงก่อนจึงสร้าง @font-face ได้)
  preloadLangFontUrls().then(() => applySettings()).catch(() => {});
  loadSpellDict(root);                               // โหลดคลังคำตรวจคำผิด (async, ไม่บล็อก)
  warmInverse();                                     // ผังความสัมพันธ์ (แผง Story Network ใช้)
  // [alpha.69] เปิดสมุดประวัติของโปรเจกต์นี้ — ต้องมาก่อนการเขียนไฟล์ครั้งแรกของรอบนี้
  // (main เป็นคนจด · ก่อนถูกตั้งค่า main จะไม่จดอะไรเลย ทั้งตอนยังไม่เปิดโปรเจกต์และตอนเทส)
  await configHistory();
  // [alpha.67] หน้าต่างแผงที่ฉีกออกมา: หยุดตรงนี้ — ที่เหลือเป็นของหน้าต่างหลักล้วน ๆ
  // (เทมเพลต · ปลั๊กอิน · ระบบเลย์เอาต์แผง · กู้แท็บที่เปิดค้าง · แดชบอร์ดตั้งต้น · autosync)
  // ทั้งหมดเขียนสถานะระดับโปรแกรม/ไฟล์ทับกัน และหน้าต่างนี้ก็ไม่มี UI ให้ใช้อยู่แล้ว
  if (PANEL_WIN) {
    mountPanelWindow(PANEL_WIN);
    await drawPanelWindow();
    clearBusy();
    setStatus(tt('ui.app.openProject2') + state.title);
    reportPanelWindowHealth();
    return;
  }
  setBusy(tt('ui.app.busyLoadTemplate'));
  await loadTemplates();                            // default templates ถูกฝังลงโปรเจกต์ทันที
  loadPlugins();
  // ---- เริ่มระบบใหม่ (Part 1+2) ----
  setBusy(tt('ui.app.busyLayoutPanelTab'));
  // [alpha.79] **ต้องกู้เซสชันก่อน initPanelSystem** — ระบบแผงอ่าน localStorage ตอนเริ่มครั้งเดียว
  // (ไฟล์เซสชันเป็นตัวจริง · localStorage เป็นแค่ที่พักระหว่างรัน ซึ่งหายตอนถูกฆ่ากลางคัน)
  const _sess = sessionOff() ? null : await restoreSessionLayout(root);
  // [alpha.154 ข้อ 1] ★ ระบบแผงเริ่มไปแล้วตอนบูต → ถ้าเซสชันเพิ่งกู้เลย์เอาต์ ต้องโหลดเข้าหน่วยความจำใหม่
  // (เดิม `initPanelSystem()` รอบสองแค่วาดซ้ำ — ของที่กู้มาไม่เคยถูกใช้ แล้วโดนเขียนทับทีหลัง)
  initPanelSystem({ reload: !!(_sess && _sess._layoutApplied) });   // Panel System
  // sync toolbar toggle .on states + [60r2 ข้อ 1/11] ความกว้าง workspace และรางเลขบรรทัด
  onPanelLayoutChange(() => { refreshToolbar(); syncWorkspaceWidths(); scheduleLineGutter();
                              recenterOnPaneResize();
                              markSessionDirty(); });   // [alpha.79] เลย์เอาต์เปลี่ยน = ต้องจำ
  // แผงฟีเจอร์ (บั๊ก #18) ต้องเรียกหลัง initPanelSystem ไม่งั้น showPanel ยังไม่รู้จักแผง
  await renderOpenFeaturePanels();                   // เลย์เอาต์ที่กู้มาอาจมีแผงเปิดค้าง = กล่องเปล่า
  // [alpha.79] กู้แท็บจากไฟล์เซสชันก่อน (ทันสมัยกว่า เพราะเขียนทุก 45 วินาที) —
  // ไม่มีเซสชันค่อยตกไปใช้ `openTabs` ใน project.khn.json แบบเดิม (โปรเจกต์ที่ย้ายเครื่องมา)
  const _restored = await restoreSessionTabs(_sess);
  if (!_restored) await restoreOpenTabs();
  if (!sessionOff()) startSessionWatch();
  if (!state.tabs.size) openDashboard();
  initThesaurus().catch(() => {});                   // Thesaurus engine
  ensureAutoLink().catch(() => {});                  // Backlinks index
  if (state.settings.autoSync) setAutoSync(true);    // auto-task: คืนสถานะที่ผู้ใช้เปิดไว้
  // [alpha.61 ข้อ 1] หน้าแรกไม่เด้งจากตรงนี้แล้ว — bootSequence() เป็นคนตัดสินลำดับเปิดโปรแกรม
  //   (เดิม loadProject เด้งหน้าแรกทับทุกครั้ง ทำให้ "เปิดโปรเจกต์ล่าสุดโดยข้ามหน้าแรก" เป็นไปไม่ได้)
  clearBusy();                                       // [alpha.62] เลิกแสดง "กำลังทำอะไรอยู่"
  setStatus(tt('ui.app.openProject2') + state.title);
  // [alpha.66 ข้อ 14] ตรวจทางเลือกที่ชี้ไปฉากที่ถูกลบ/ย้ายไปแล้ว — ไม่บล็อกการเปิดงาน
  // (ถ้าเจอ จะทับข้อความ "เปิดโปรเจกต์:" ด้านบนด้วยคำเตือน + เขียนรายละเอียดลงบันทึก)
  checkDanglingOnOpen().catch(() => {});
  // [alpha.124 ข้อ 16] ล้างถังขยะเก่า — **ย้ายมาไว้หลังเปิดงานเสร็จและปิดตัวหมุนแล้ว**
  // เดิมอยู่ระหว่าง setBusy() → พอมันเริ่มถามก่อนลบ กล่องจะไปอยู่ใต้ฉากตัวหมุน
  // (บทเรียนเดิมของ alpha.62 บั๊ก 10: อย่าให้มีอะไรหมุนค้างตอนรอผู้ใช้ตอบกล่อง)
  purgeRecycle(root).then((n) => { if (n) buildTree(); }).catch(() => {});
  // [alpha.124 ข้อ 23] ซ่อมจำนวนคำที่ค้างเป็น 0 มาแต่ไหนแต่ไร — ครั้งเดียวต่อโปรเจกต์
  // (หลังจากนี้ saveTab เป็นคนดูแลต่อ) · ทำเบื้องหลัง ไม่บล็อกการเริ่มเขียน
  if (!state.meta || !state.meta.wcBuilt) {
    rebuildWordCounts().then(async (r) => {
      // ปักธง "ซ่อมแล้ว" เฉพาะตอนไล่จนจบจริง — ถ้าเลิกกลางทาง (ผู้ใช้สลับโปรเจกต์)
      // ต้องยอมทำใหม่รอบหน้า ไม่ใช่ปิดประตูทิ้งไว้แล้วเลขค้างเป็น 0 ตลอดไปเหมือนเดิม
      if (r.done && state.meta && state.root === root) { state.meta.wcBuilt = 1; await saveProjectMeta(); }
      if (r.fixed && state.root === root) { await buildTree(); setStatus(ttf('ui.app.wordCountRebuilt', r.fixed)); }
      log('info', 'rebuildWordCounts', r);
    }).catch(() => {});
  }
}

// ---------------- [alpha.61 ข้อ 4] อิสระเรื่องตัวพิมพ์ใหญ่/เล็กในบทหนัง ----------------
// สามสวิตช์ (spForceCase · spAutoCapitalize · spAutoCorrectI) ใช้ทางเดียวกันหมด:
// พลิกค่า → applySettings (spCss สร้างใหม่ทันที) → บันทึกลงโปรเจกต์ → อัปเดตติ๊กในเมนู
const SP_CASE_LABELS = {
  spForceCase: tt('ui.app.forcePrintBigFormat'),
  spAutoCapitalize: tt('ui.app.editItemFirstSentence'),
  spAutoCorrectI: tt('ui.app.editIIAuto'),
};
/**
 * [alpha.62 บั๊ก 11] สลับ "บังคับตัวพิมพ์ใหญ่" ของ element เดียว (เช่นเฉพาะชื่อตัวละคร)
 * เก็บที่ `settings.spStyles` ซึ่ง mergeSpFormat ผสานทับค่ามาตรฐานอยู่แล้ว
 * @returns {boolean} สถานะใหม่ (true = ยังบังคับตัวใหญ่อยู่)
 */
export function toggleElementCaps(elName, on) {
  const cur = elementCaps(spFormat(), elName);
  const v = on ?? !cur;
  state.settings.spStyles = setElementCaps(state.settings.spStyles, elName, v);
  // ปิดรายตัวขณะที่สวิตช์ใหญ่ปิดอยู่ = ไม่มีผลอะไรให้เห็น → เปิดสวิตช์ใหญ่กลับให้ก่อน
  // (mergeSpFormat ล้าง caps ทุกตัวทิ้งเมื่อ forceCase=false — ค่ารายตัวจะถูกกลบหมด)
  if (v && state.settings.spForceCase === false) state.settings.spForceCase = true;
  applySettings();
  saveProjectMetaSoon();
  syncMenuToggles();
  setStatus(elemLabel(elName) + ': ' + (v ? tt('ui.app.forceCaseBig') : tt('ui.app.print')));
  return v;
}
export function toggleSpCase(key, on) {
  const v = on ?? !(state.settings[key] !== false);
  state.settings[key] = v;
  applySettings();                    // spForceCase มีผลทันทีผ่าน spCss()
  saveProjectMetaSoon();
  syncMenuToggles();
  setStatus(SP_CASE_LABELS[key] + ': ' + (v ? tt('ui.common.open') : tt('ui.app.closePrint')));
  return v;
}

// ---------------- [alpha.61 ข้อ 3] ลบทั้งบรรทัด (เมนู แก้ไข → ลบทั้งบรรทัด) ----------------
// ทำงานทั้งนิยายและบทหนัง — ลบ "บล็อกระดับบน" ที่เคอร์เซอร์อยู่ทั้งใบ
// ถ้าเป็นบล็อกเดียวที่เหลือ ให้เคลียร์เนื้อในแทนการลบ (doc ต้องมี block+ เสมอ ไม่งั้น schema พัง)
export function deleteCurrentLine() {
  const t = state.active;
  const view = t?.editor?.view || t?.sp?.view;
  if (!view) { setStatus(tt('ui.app.openDocBeforeDel')); return false; }
  const st = view.state;
  const { $from, $to } = st.selection;
  const d = Math.min($from.depth, $to.depth) || 1;
  const from = $from.before(Math.min(d, $from.depth) || 1);
  const to = $to.after(Math.min(d, $to.depth) || 1);
  let tr;
  if (from <= 0 && to >= st.doc.content.size) {
    // บทหนังไม่มี node ชื่อ paragraph → ถามชนิดบล็อกเริ่มต้นจาก schema แทนการเดาชื่อ
    const blockType = st.schema.nodes.paragraph || st.schema.topNodeType.contentMatch.defaultType;
    const empty = blockType && blockType.createAndFill();
    if (!empty) return false;
    tr = st.tr.replaceWith(0, st.doc.content.size, empty);
  } else {
    tr = st.tr.delete(from, to);
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
  markDirty(t);
  setStatus(tt('ui.app.delLineDone'));
  return true;
}

// ---------------- [alpha.61 ข้อ 1] ลำดับเปิดโปรแกรม ----------------
// กดเปิด → หน้าต่างรอโหลด → เข้าโปรแกรม → แยกทางตามตั้งค่า (global · ใช้ร่วมทุกโปรเจกต์):
//   openLastProject=true  + มีโปรเจกต์ล่าสุด → เปิดเลย "ข้ามหน้าแรก"
//   showHomeOnStartup=true                   → บังคับเห็นหน้าแรกเสมอ (แม้เปิดโปรเจกต์ล่าสุดไว้)
//   ทั้งคู่ปิด                                 → หน้าแรกก่อน แล้วผู้ใช้เลือกเอง
// อ่านค่าจาก userData/settings.json ตรง ๆ เพราะตอนนี้ยังไม่มีโปรเจกต์ → state.settings ยังว่าง
export async function bootGlobalSettings() {
  let g = {};
  try { g = (await kapi.readGlobalSettings()) || {}; } catch {}
  return { ...GLOBAL_DEFAULTS, ...g };
}
/** บันทึกค่า global ทีละคีย์ (สวิตช์ในเมนู) — merge ทับของเดิม ไม่ทับทั้งไฟล์ */
// [alpha.162 · W4] ★ คิวของการเขียนไฟล์ตั้งค่าผู้ใช้ — เรียงตามลำดับที่เรียก (ตัวหลังชนะเสมอ)
let _globalWriteChain = Promise.resolve();
export async function saveGlobalSetting(key, value) {
  // ★ หน่วยความจำต้องเป็นค่าล่าสุด **ทันที** — เดิมตั้งหลังรอเขียนไฟล์เสร็จ ตัวที่เรียกก่อนแต่ IO ช้ากว่า
  // จึงมาทับค่าใหม่ทีหลังได้ (สลับธีม ก → ข เร็ว ๆ แล้วค่าในหน่วยความจำเด้งกลับเป็น ก ·
  // e2e [138-2] แดงสุ่มเพราะเรื่องนี้หลัง W3 ให้สวิตช์ธีมเรียกตัวนี้)
  state.settings[key] = value;
  await mergeGlobalSettings({ [key]: value });
  return value;
}
/**
 * [alpha.162 · W4] อ่าน-รวม-เขียนไฟล์ตั้งค่าผู้ใช้ผ่านคิวเดียว — ทางเดียวที่ควรเขียนไฟล์นี้
 * (`kapi.writeGlobalSettings` เขียนทับทั้งไฟล์ · ต่างคนต่างอ่าน-เขียนพร้อมกัน = ค่าของอีกคนหาย)
 * @param {object} patch คีย์ที่จะตั้ง (คีย์อื่นในไฟล์คงเดิม) · @returns {Promise<boolean>}
 */
export function mergeGlobalSettings(patch) {
  const run = async () => {
    let g = {};
    try { g = (await kapi.readGlobalSettings()) || {}; } catch {}
    try { await kapi.writeGlobalSettings({ ...g, ...(patch || {}) }); return true; }
    catch (e) { log('warn', tt('ui.common.saveGlobalSettingsNot'), e); return false; }
  };
  const p = _globalWriteChain.then(run, run);
  _globalWriteChain = p.catch(() => false);
  return p;
}
// ══ [alpha.157] ลำดับเปิดโปรแกรมตามที่ผู้ใช้กำหนด ══
//   1. เปิดโปรแกรม → 2. splash (บอกว่ากำลังโหลดอะไร) → 3. หน้า Home (มีปุ่มออกจากโปรแกรม)
//   3.1 ติ๊ก "ไม่แสดงหน้า Home" (= openLastProject) → เปิดโปรเจกต์ล่าสุดเลย · ไม่มีโปรเจกต์ล่าสุด = แอปเปล่า
//   4. หน้าต่างหลักขยายเต็มจอ (main.js ทำตอนได้ `splash:done`)
// showHomeOnStartup=true (เมนู มุมมอง) ยังบังคับให้เห็นหน้าแรกเสมอเหมือนเดิม
export function startupPlan(g = {}, recent = []) {
  const skipHome = g.openLastProject === true;
  const last = skipHome && recent && recent[0] ? recent[0] : '';
  const showHome = g.showHomeOnStartup === true || !skipHome;
  return { skipHome, last, showHome };
}
export async function bootSequence() {
  setSplashActive(true);
  splashProgress(tt('ui.splash.settings'), 8);
  setBusy(tt('ui.app.busyStartApp'));
  const g = await bootGlobalSettings();
  // ค่ายังไม่มีโปรเจกต์ → ยัดลง state.settings ไว้ก่อน เพื่อให้เมนู/สวิตช์อ่านค่าถูกตั้งแต่วินาทีแรก
  state.settings = { ...DEFAULT_SETTINGS, ...g, ...state.settings };
  syncMenuToggles();
  splashProgress(tt('ui.splash.language'), 18);
  // [alpha.164 · รอบต่อ 2] ภาษาเป็นค่าระดับผู้ใช้ — ต้องตรงกับไฟล์ตั้งค่าผู้ใช้ **ก่อน** หน้าแรก/โปรเจกต์โผล่
  // (ตัวโหลดแบบ sync อ่านจาก localStorage ซึ่งหายได้ · ถ้ายังไม่ตรงก็โหลดใหม่ที่นี่)
  if (g && g.language && g.language !== i18n.lang) {
    try { await loadLanguage(g.language); } catch (e) { log('warn', 'boot language', e); }
  }
  try { await (document.fonts && document.fonts.ready); } catch {}
  // [alpha.135] **ตรวจอัปเดตก่อนเข้าโปรแกรม** — ก่อนเปิดโปรเจกต์/หน้าแรก ตามที่ผู้ใช้สั่ง
  // ยังไม่มีอะไรค้างในหน่วยความจำตอนนี้ กด "แทนที่แล้วเปิดใหม่" จึงไม่มีงานหาย
  // เงียบสนิทเมื่อไม่มีรุ่นใหม่ · ปิดสวิตช์ไว้ = ไม่ติดต่อเน็ตเลย · พังก็ต้องไม่ขวางการเปิดโปรแกรม
  splashProgress(tt('ui.splash.update'), 30);
  try { await startupUpdateCheck(); } catch (e) { log('warn', tt('ui.upd.failCheck'), e); }
  splashProgress(tt('ui.splash.recent'), 42);
  let recent = [];
  try { recent = (await kapi.listRecent()) || []; } catch {}
  const plan = startupPlan(g, recent);
  let openedLast = false;
  if (plan.last) {
    splashProgress(ttf('ui.splash.project', String(plan.last).split(/[\\/]/).pop()), 55);
    try { await loadProject(plan.last); openedLast = !!state.root; } catch (e) { log('warn', 'open last project', e); }
  }
  splashProgress(plan.showHome ? tt('ui.splash.home') : tt('ui.splash.ready'), 96);
  clearBusy();
  // ไม่ได้ติ๊กข้ามหน้าแรก หรือผู้ใช้สั่ง "แสดงหน้าแรกเสมอ" → เปิดหน้าแรก **ก่อน** แสดงหน้าต่าง
  // [alpha.157r] หน้าแรกตอนเปิดโปรแกรมยืนเดี่ยว ๆ — ตัวโปรแกรมยังไม่โผล่จนกว่าจะเลือกโปรเจกต์/ปิดหน้าแรก
  // (ถ้าแสดงหน้าต่างก่อน ผู้ใช้เห็นโปรแกรมเปล่าวาบหนึ่งก่อนหน้าแรกจะทับ)
  if (plan.showHome) {
    try { const { showHomeDialog } = await import('./home-ui.js'); showHomeDialog({ startup: true }).catch(() => {}); } catch {}
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  setSplashActive(false);
  try { await kapi.splashDone(); } catch {}
  return { openedLast, showedHome: plan.showHome, skipHome: plan.skipHome };
}
/**
 * [alpha.67] ลำดับเริ่มของ "หน้าต่างแผงที่ฉีกออกมา" (tear-off)
 *
 * เปิดโปรเจกต์เดียวกับหน้าต่างหลัก แล้ว `loadProject` จะแยกไปเรียก `mountPanelWindow`
 * ให้เองตอนถึงขั้นจัดวางแผง (ดูจุดตัดใน loadProjectInner)
 * ไม่มีหน้าแรก · ไม่มีการกู้แท็บ · ไม่มี autosave — หน้าต่างนี้ไม่ได้ถือเอกสารอะไรเลย
 */
export async function bootPanelWindow() {
  document.body.classList.add('panel-window');
  const root = (() => {
    try { return new URLSearchParams(location.search).get('root') || ''; } catch { return ''; }
  })();
  const g = await bootGlobalSettings();
  state.settings = { ...DEFAULT_SETTINGS, ...g, ...state.settings };
  if (!root) { setStatus(tt('ui.app.windowPanelCantChapter')); return false; }
  await loadProject(root);
  bindPanelWindowSync();
  // [alpha.68] แผงที่ผูกกับฉากต้องรู้ตั้งแต่วินาทีแรกว่าตอนนี้ฉากไหนเปิดอยู่ที่หน้าต่างหลัก
  // (ผูกช่องรับก่อนค่อยขอ — ไม่งั้นคำตอบวิ่งมาถึงก่อนที่จะมีใครฟัง)
  if (SCENE_PANELS.has(panelId(PANEL_WIN))) {
    try { kapi.broadcast && kapi.broadcast(wantSceneMsg(PANEL_WIN)); } catch {}
  }
  return true;
}

/**
 * [alpha.67] ช่องสื่อสารของหน้าต่างแผง
 *   ขาเข้า  — หน้าต่างหลักบอกว่าไฟล์โปรเจกต์เปลี่ยน → วาดแผงใหม่
 *   ขาออก  — ผู้ใช้คลิกฉากในแผง (เส้นเวลา/Kanban/ผัง) → ฝากหน้าต่างหลักเปิดให้
 *            (หน้าต่างนี้ไม่มีแท็บเอกสาร เปิดเองแล้วจะไม่มีอะไรโผล่)
 */
function bindPanelWindowSync() {
  try { kapi.onSync((msg) => handleSyncMessage(msg)); } catch {}
  return true;
}
/** ข้อความนี้เกี่ยวกับโปรเจกต์ที่หน้าต่างนี้เปิดอยู่ไหม (path ว่าง = เหมารวมว่าใช่) */
function syncTouchesProject(msg) {
  if (!state.root) return false;
  const p = msg && msg.path;
  return !p || String(p).startsWith(state.root);
}
/** ตัวจัดการข้อความข้ามหน้าต่าง — ใช้ร่วมทั้งหน้าต่างหลักและหน้าต่างแผง */
export function handleSyncMessage(msg) {
  if (!msg || !msg.kind) return false;
  if (msg.kind === 'project-changed') {
    if (!syncTouchesProject(msg)) return false;
    if (PANEL_WIN) { drawPanelWindow(); return true; }
    // หน้าต่างหลัก: แผงฟีเจอร์ที่เปิดอยู่อาจแสดงข้อมูลเก่าที่หน้าต่างลูกเพิ่งแก้
    renderOpenFeaturePanels().catch(() => {});
    buildTree().catch(() => {});
    // [alpha.68] แท็บที่เปิดค้างอยู่ก็ล้าสมัยได้ — ลูกเพิ่งเขียนคอมเมนต์/คุณสมบัติลงไฟล์เดียวกัน
    reloadTabsFromDisk(msg.path).catch(() => {});
    return true;
  }
  if (msg.kind === 'panelwin-ready' && !PANEL_WIN) {
    state._panelWinHealth = msg;                 // เทส/การไล่ปัญหาอ่านจากตรงนี้
    if (!msg.hasStatus || !msg.drawn) {
      log('warn', ttf('ui.app.panelWindowPanelF', msg.id), msg);
    }
    return true;
  }
  if (msg.kind === 'open-file' && !PANEL_WIN && msg.file) {
    // หน้าต่างแผงคลิกฉาก → หน้าต่างหลักเป็นคนเปิดให้ (ที่นั่นมีแท็บเอกสารจริง)
    activate(msg.file).then(() => { try { window.focus(); } catch {} }).catch(() => {});
    return true;
  }
  // ───────── [alpha.68] tear-off เฟส 2: ช่อง "ฉากที่เปิดอยู่" ─────────
  if (msg.kind === 'want-scene' && !PANEL_WIN) {
    // ลูกเพิ่งบูตเสร็จ → ส่งสถานะปัจจุบันให้ทันที (ไม่งั้นต้องรอผู้ใช้สลับแท็บก่อนแผงถึงจะมีข้อมูล)
    broadcastActiveScene(true);
    if (panelId(msg.id) === 'outline') scheduleOutline();
    return true;
  }
  if (msg.kind === 'active-scene' && PANEL_WIN) { applyRemoteScene(msg); return true; }
  if (msg.kind === 'outline' && PANEL_WIN) {
    state._remoteOutline = msg;
    if (panelId(PANEL_WIN) === 'outline') drawPanelWindow();
    return true;
  }
  if (msg.kind === 'goto-outline' && !PANEL_WIN) { gotoOutlineItem(msg); return true; }
  // [alpha.166] หน้าต่างหลักเปลี่ยนธีม → หน้าต่างแผงเปลี่ยนตามทันที
  if (msg.kind === 'theme' && PANEL_WIN && msg.id) {
    state.settings.theme = String(msg.id);
    applyTheme();
    try { drawPanelWindow(); } catch {}        // ผืนวาด (ผัง/กระดาน) อ่านสีธีมใหม่
    return true;
  }
  return false;
}

// ───────────────────────────────────────────────────────────────────────
// [alpha.68] Tear-off เฟส 2 — แผงที่ผูกกับ "ฉากที่เปิดอยู่" ฉีกออกไปอยู่คนละหน้าต่างได้
//
// กำแพงของ .67 คือหน้าต่างลูกไม่มีแท็บเอกสาร → `state.active` เป็น null ตลอดกาล
// แผงคุณสมบัติ/คอมเมนต์/ผังพื้นที่/Navigation จึงขึ้นแต่ "(เปิดฉากก่อน…)"
//
// ทางออก: หน้าต่างหลักประกาศว่าตอนนี้ฉากไหนเปิดอยู่ แล้วลูกประกอบ **แท็บจำลอง** วางที่ `state.active`
// โค้ดเดิมทุกบรรทัดที่อ่าน `state.active.file` ใช้ได้ทันทีโดยไม่ต้องแก้ (ดูเหตุผลใน panels/panel-sync.js)
// ───────────────────────────────────────────────────────────────────────

// แผงที่ผูกกับฉากแต่ **ไม่ได้อยู่ใน FEATURE_PANELS** — ตัววาดของพวกนี้ถูกเรียกจากทางสลับแท็บ
// (activate → refreshOutline/refreshCommentsPanel · คลิกฉาก → setPropsTarget) ไม่ใช่จากตารางแผง
const SCENE_PANEL_DRAW = {
  outline:  () => { refreshOutline(); return true; },
  props:    () => renderPropsPanel(),
  comments: () => renderCommentPanel($('#comments-body')),
};
/** วาดแผงตาม id — ทางผ่านเดียวที่รู้จักทั้งแผงฟีเจอร์และแผงที่ผูกกับฉาก */
export function drawPanel(id) {
  const pid = panelId(id);
  const f = SCENE_PANEL_DRAW[pid];
  return f ? Promise.resolve().then(f).catch((e) => log('error', ttf('ui.app.drawPanelF', pid), e))
           : renderFeaturePanel(pid);
}
/** วาดแผงของหน้าต่างนี้ใหม่ (หน้าต่างแผงเท่านั้น — มีแผงเดียว) */
function drawPanelWindow() {
  if (!PANEL_WIN) return Promise.resolve(false);
  return Promise.resolve(drawPanel(PANEL_WIN)).then((r) => {
    applySceneGuard();
    // รายงานสภาพทุกครั้งที่วาดใหม่ ไม่ใช่แค่ตอนบูต — หน้าต่างหลัก (และเทส) จะได้เห็นผลของ
    // ข้อความที่เพิ่งส่งมา (ฉากใหม่ / ล็อกอ่านอย่างเดียว) จากของจริง ไม่ใช่จากการเดา
    reportPanelWindowHealth();
    return r;
  });
}

/**
 * หน้าต่างหลัก → ประกาศฉากที่เปิดอยู่
 * ไม่มีหน้าต่างแผงที่ต้องรู้ฉากเปิดอยู่ = ไม่ทำอะไรเลย (การใช้งานปกติจึงไม่เสียอะไรสักนิด)
 */
export function broadcastActiveScene(force) {
  if (PANEL_WIN) return false;
  if (!force && !anyNeedsScene(tornOffIds())) return false;
  const msg = sceneMsg(state.active, { root: state.root || '' });
  // ฉากที่เปิดอยู่ไม่ใช่ไฟล์ฉาก (ดูแดชบอร์ด/Wiki อยู่) → ยึด "ฉากล่าสุดที่แก้" เหมือน sceneCtx ในหน้าต่างหลัก
  if (!msg.file && state.lastSceneFile) {
    const last = state.tabs.get(state.lastSceneFile);
    const m2 = sceneMsg(last || { file: state.lastSceneFile, title: '' }, { root: state.root || '' });
    if (m2.file) { m2.stale = !last; Object.assign(msg, m2); }
  }
  state._lastSceneMsg = msg;
  try { kapi.broadcast && kapi.broadcast(msg); } catch {}
  return true;
}
/** หน้าต่างแผง → รับฉากที่เปิดอยู่มาใช้เป็น state.active แล้ววาดใหม่ */
async function applyRemoteScene(msg) {
  if (!PANEL_WIN) return false;
  if (!sceneChanged(state._remoteScene, msg)) return false;
  state._remoteScene = msg;
  state.active = remoteTab(msg);
  if (msg.file) state.lastSceneFile = msg.file;
  // แผงคุณสมบัติต้องรู้ลึกถึง "แถวฉากใน scenes.json" ไม่ใช่แค่ชื่อไฟล์ — หาให้จากไฟล์เอง
  if (panelId(PANEL_WIN) === 'props') {
    const ctx = msg.file ? await sceneCtx(msg.file) : null;
    setPropsTarget(ctx && ctx.dPath, ctx && ctx.ch, ctx && ctx.row);
  }
  await drawPanelWindow();
  return true;
}
/**
 * ตาข่ายกันเขียนชนกัน — ระหว่างที่หน้าต่างหลักยัง **ไม่บันทึก** ฉากนี้ หน้าต่างแผงอ่านได้อย่างเดียว
 *
 * เพราะคอมเมนต์กับคุณสมบัติฉากเขียนลงไฟล์เดียวกับที่หน้าต่างหลักเปิดค้างอยู่ — ถ้าปล่อยให้แก้ทั้งสองฝั่ง
 * การกด Ctrl+S ที่หน้าต่างหลักครั้งถัดไปจะทับของที่ลูกเพิ่งเขียนทิ้งทั้งหมด (เงียบ ๆ ด้วย)
 * ทำที่ชั้นนอกทีเดียวแบบนี้ ตัววาดของแต่ละแผงจึงไม่ต้องรู้เรื่อง tear-off เลยสักตัว
 */
function applySceneGuard() {
  if (!PANEL_WIN) return false;
  // เฉพาะแผงที่ **เขียนไฟล์ของฉาก** เท่านั้น — Navigation อ่านอย่างเดียวอยู่แล้ว
  // และ AI ผู้ช่วยเขียนเขียนลง Sessions/ ของตัวเอง (ล็อกไปก็มีแต่กวนผู้ใช้เปล่า ๆ)
  if (!writesScene(panelId(PANEL_WIN))) return false;
  const body = document.querySelector('.k-panelwin > .k-panel-body');
  if (!body) return false;
  const old = body.querySelector('.k-scene-guard');
  if (old) old.remove();
  body.classList.remove('k-guarded');
  const msg = state._remoteScene;
  if (!msg || !msg.file || canEditScene(msg)) return false;
  body.classList.add('k-guarded');
  const bar = el('div', 'k-scene-guard',
    tt('ui.panel.sceneGuard') + ' "' + (msg.title || tt('ui.panel.thisScene'))
    + '" — ' + tt('ui.panel.sceneGuard2'));
  body.insertBefore(bar, body.firstChild);
  for (const n of body.querySelectorAll('input, textarea, select, button')) {
    if (n.closest('.k-scene-guard')) continue;
    n.disabled = true;
  }
  return true;
}
/** หน้าต่างแผง Navigation คลิกหัวข้อ → ให้หน้าต่างหลักกระโดดไปตำแหน่งนั้นในเอกสารจริง */
function requestGotoInMain(it) {
  if (!PANEL_WIN) return false;
  const file = (state._remoteScene && state._remoteScene.file) || '';
  try { kapi.broadcast && kapi.broadcast(gotoMsg(file, it)); } catch {}
  setStatus(tt('ui.panel.jumpedInMain'));
  return true;
}
/** หน้าต่างหลัก: ทำตามคำขอกระโดดของหน้าต่าง Navigation */
async function gotoOutlineItem(msg) {
  if (PANEL_WIN || !msg) return false;
  if (msg.file && (!state.active || !samePath(state.active.file, msg.file))) {
    try { await activate(msg.file); } catch { return false; }
  }
  const t = state.active;
  if (!t) return false;
  // [alpha.140] เดินประตูเดียวกับการคลิกในหน้าต่างหลัก — ไม่งั้นหน้าต่างที่ฉีกออกไปยังเจอ
  // บั๊กชุดเดิมครบทั้งสามข้อ (มุมมองหน้ากระดาษไม่ขยับ · TextSelection.create โยน RangeError · ไม่มีไฮไลต์)
  if (!navGotoItem(t, msg)) return false;
  try { window.focus(); } catch {}
  return true;
}
/**
 * หน้าต่างหลัก: ไฟล์ถูกแก้จากหน้าต่างแผง → โหลดเนื้อของแท็บที่เปิดค้างอยู่ใหม่
 * **แท็บที่ยังพิมพ์ค้าง (dirty) ห้ามแตะ** — งานที่ยังไม่บันทึกของผู้ใช้สำคัญกว่าเสมอ
 * (และแผงที่ฉีกออกไปก็ถูกล็อกอ่านอย่างเดียวอยู่แล้วตอนที่นี่ dirty — ดู applySceneGuard)
 */
export async function reloadTabsFromDisk(changedPath) {
  if (PANEL_WIN || !changedPath) return 0;
  const hits = tabsToReload([...state.tabs.values()], changedPath);
  let n = 0;
  for (const tab of hits) {
    if (!tab.editor && !tab.sp && !tab.plain) continue;      // Wiki/แดชบอร์ด/ผัง มีทางรีเฟรชของตัวเอง
    try {
      const { meta, body } = parseMdFile(await kapi.readFile(tab.file));
      if (body === tab.body) continue;                       // เปลี่ยนแต่คอมเมนต์ท้ายไฟล์ = เนื้อเท่าเดิม
      tab.meta = meta; tab.body = body; tab.diskBody = body;
      if (tab.editor) tab.editor.setMarkdown(body);
      else if (tab.sp) tab.sp.setMarkdown(body);
      else tab.plain.value = body;
      n++;
    } catch (e) { log('warn', tt('ui.app.panelLoadFileWindow') + tab.file, e); }
  }
  if (n) { setStatus(tt('ui.panel.reloadedFromPanelWin') + ' (' + n + ')'); scheduleOutline(); }
  refreshCommentsPanel();
  return n;
}
/** หน้าต่างหลักรับสัญญาณจากหน้าต่างแผง (ผูกครั้งเดียวตอนเริ่มโปรแกรม) */
let _mainSyncBound = false;
export function bindMainWindowSync() {
  if (_mainSyncBound || PANEL_WIN) return false;
  try { kapi.onSync((msg) => handleSyncMessage(msg)); _mainSyncBound = true; } catch {}
  return _mainSyncBound;
}
/**
 * [alpha.67] หน้าต่างแผงรายงานสภาพตัวเองกลับไปหน้าต่างหลัก
 *
 * มีไว้เพราะหน้าต่างหลัก **มองไม่เห็น DOM ของหน้าต่างลูก** (คนละ context) — ถ้าไม่มีช่องนี้
 * ลูกพังเงียบ ๆ ได้โดยที่ทั้งเทสและผู้ใช้ไม่รู้ (เจอมาแล้วรอบ .67: `mountPanelWindow` เคยล้าง
 * `#app-root` ทิ้งทั้งดุ้น ซึ่งลบแถบสถานะ/แถบเครื่องมือถาวร → `setStatus()` ระเบิดทุกครั้ง
 * แต่แผงยังวาดออกมาสวยดี จึงดูเหมือนไม่มีอะไรผิด)
 */
export function reportPanelWindowHealth() {
  if (!PANEL_WIN) return false;
  const bodyEl = document.querySelector('.k-panelwin > .k-panel-body');
  const scene = state._remoteScene || null;
  const health = {
    kind: 'panelwin-ready', id: PANEL_WIN,
    // ของสำคัญที่โค้ดทั้งโปรเจกต์อ้างด้วย id ต้องยังอยู่ใน DOM (ซ่อนได้ แต่ห้ามหาย)
    hasStatus: !!document.getElementById('status'),
    // [alpha.166] ธีมที่ theme-boot.js ทาก่อนเฟรมแรก (ว่าง = เฟรมแรกเป็นเทาของธีมรุ่นแรก)
    bootTheme: window.__k2bootTheme || '',
    hasToolbar: !!document.getElementById('toolbar'),
    hasPanes: !!document.getElementById('panes'),
    drawn: !!(bodyEl && bodyEl.children.length),      // แผงวาดเนื้อออกมาจริง ไม่ใช่กล่องเปล่า
    // [alpha.68] สภาพของ "ช่องส่งฉาก" — เทสฝั่งหน้าต่างหลักตรวจได้แค่ผ่านช่องนี้ช่องเดียว
    // (บทเรียน .67: ลูกขึ้น "(เลือกฉากก่อน…)" อยู่ก็ยังนับว่า drawn=true ได้ จึงต้องดูเนื้อจริงด้วย)
    scene: (scene && scene.file) || '',
    sceneTitle: (scene && scene.title) || '',
    guarded: !!(bodyEl && bodyEl.querySelector('.k-scene-guard')),
    items: bodyEl ? bodyEl.querySelectorAll('.ol-item').length : 0,
    text: bodyEl ? (bodyEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) : '',
  };
  try { kapi.broadcast && kapi.broadcast(health); } catch {}
  return health;
}
/** ขอให้หน้าต่างหลักเปิดไฟล์นี้ (ใช้จากหน้าต่างแผงเท่านั้น) — คืน false เมื่ออยู่หน้าต่างหลัก */
export function requestOpenInMain(file) {
  if (!PANEL_WIN || !file) return false;
  try { kapi.broadcast && kapi.broadcast({ kind: 'open-file', root: state.root, file }); } catch {}
  setStatus(tt('ui.app.sendOpenWindowMain'));
  return true;
}

/** สลับ "เปิดโปรเจกต์ล่าสุดเมื่อเริ่มโปรแกรม" (เมนูไฟล์) */
export async function toggleOpenLastProject(on) {
  const v = on ?? !(state.settings.openLastProject === true);
  await saveGlobalSetting('openLastProject', v);
  syncMenuToggles();
  setStatus(v ? tt('ui.app.startAppOpenProject')
              : tt('ui.app.startAppShowPage'));
  return v;
}
/** สลับ "แสดงหน้าแรกเสมอ" (เมนูมุมมอง) */
export async function toggleShowHomeAlways(on) {
  const v = on ?? !(state.settings.showHomeOnStartup === true);
  await saveGlobalSetting('showHomeOnStartup', v);
  syncMenuToggles();
  setStatus(v ? tt('ui.app.showPageFirstAlways2') : tt('ui.app.showPageFirstAlways'));
  return v;
}

// [alpha.60r ข้อ 2] บันทึกรายการแท็บที่เปิดอยู่ → project.khn.json → restore ตอนเปิดครั้งต่อไป
async function saveOpenTabs() {
  if (!state.root || !state.meta) return;
  const tabs = [...state.tabs.keys()].filter(f => !f.startsWith('::') && !f.endsWith('.json'));
  state.meta.openTabs = tabs.length ? tabs : null;
  try {
    await kapi.writeFile(await kapi.join(state.root, 'project.khn.json'),
      JSON.stringify(state.meta, null, 2));
  } catch (e) { log('warn', tt('ui.app.saveOpenTabsNotOk'), e); }
}
/**
 * [alpha.60r ข้อ 2] กู้คืนแท็บที่เคยเปิดค้างไว้
 *
 * [alpha.79 · แก้บั๊กที่ไม่เคยทำงานเลย] เดิมเรียก `activate(full)` —
 * แต่ `activate()` แค่ **สลับไปแท็บที่เปิดอยู่แล้ว** มันไม่เปิดไฟล์ให้
 * (และคืน `undefined` เสมอ → `if (tab)` ไม่เคยจริง จึงไม่มีแม้แต่บรรทัด log)
 * ผลคือฟีเจอร์ "กู้แท็บที่เปิดค้าง" ไม่เคยเปิดอะไรได้เลยตั้งแต่วันแรก
 * ตอนนี้ใช้ `openTabAt()` ซึ่งเปิดไฟล์จริงตามชนิด (.md = ฉาก · .json = Wiki · อื่น ๆ = ข้อความ)
 */
async function restoreOpenTabs() {
  const files = state.meta?.openTabs || state.settings?.openTabs;
  if (!files || !files.length) return 0;
  const restored = [];
  for (const f of files) {
    try {
      const full = f.startsWith(state.root) ? f : await kapi.join(state.root, f);
      if (await openTabAt(full)) restored.push(full);
    } catch {}
  }
  if (restored.length) log('info', ttf('ui.app.recoverRestoreTab', restored.length));
  return restored.length;
}

/** เปิดไฟล์เป็นแท็บตามชนิดของมัน — คืน true เมื่อมีแท็บนั้นอยู่จริงหลังเรียก */
async function openTabAt(full) {
  if (!full) return false;
  if (state.tabs.has(full)) return true;
  if (!(await kapi.exists(full))) return false;
  await openPathSmart(full);
  return state.tabs.has(full);
}

// ═══════════════════ [alpha.79] เซสชัน — "จำทุกอย่างล่าสุด" ═══════════════════
//
// ═══ ต้นตอที่ผู้ใช้เจอ ═══
//   1. เลย์เอาต์แผงอยู่ใน localStorage ซึ่ง Chromium **เขียนลงดิสก์แบบหน่วงเวลา** —
//      ปิดโปรแกรมปกติทัน แต่ force quit / โปรแกรมพัง ไม่ทัน → แผงหายทั้งชุด
//   2. "ไฟล์ที่เปิดค้าง" ถูกบันทึกเฉพาะใน `closeProjectIfAny()` เท่านั้น
//      ซึ่งเป็นทางของ "เปลี่ยนโปรเจกต์" — **ปิดโปรแกรมทั้งตัวไม่เคยผ่านทางนั้นเลย**
//
// ═══ ทางแก้ ═══
// เขียนภาพรวมทั้งหมดลงไฟล์จริงผ่าน main (`session:write` ใช้ temp+rename = ไม่มีไฟล์ครึ่งใบ)
// และเขียน **เป็นระยะระหว่างใช้งาน** ไม่ใช่แค่ตอนปิด → ถูกฆ่ากลางคันก็เสียแค่ไม่กี่วินาที
//
// รูปร่างข้อมูล/การกู้/กันไฟล์เสีย อยู่ใน `session/session-core.js` (บริสุทธิ์ · 44 checks)

// [alpha.154 ข้อ 1] 8 วิ → 2 วิ — localStorage ของ Chromium เองก็เขียนลงดิสก์แบบหน่วง ปิดโปรแกรม
// กะทันหันไม่นานหลังย้ายแผงจึงเสียได้ทั้งสองทาง · ไฟล์เซสชันเป็นตาข่ายชั้นเดียวที่เหลือ ยิ่งเร็วยิ่งดี
// (งานเขียนแค่ JSON ก้อนเล็กผ่าน temp+rename — ถี่ขึ้นก็ไม่หนักเครื่อง)
const SESSION_SAVE_MS = 2000;          // หน่วงหลังมีอะไรเปลี่ยน
const SESSION_TICK_MS = 45000;         // เขียนซ้ำเป็นระยะ เผื่อโดนฆ่ากลางคัน
let _sessTimer = null, _sessTick = null, _sessLast = null, _sessRestoring = false;

/** เก็บภาพสถานะตอนนี้ทั้งก้อน */
export async function captureSession() {
  const s = SESS.newSession(state.root || '');
  s.ts = Date.now();
  try {
    s.tabs.open = [...state.tabs.keys()].filter((f) => !f.startsWith('::') && !f.endsWith('.json'));
    s.tabs.active = (state.active && state.active.file) || '';
    s.tabs.pinned = pinnedTabs().filter((f) => s.tabs.open.includes(f));   // [alpha.162 · W4 ข้อ 11]
    // [alpha.93 ข้อ 4] ★ ตัวที่เลื่อนจริงคือ `.pane` (`overflow:auto`) ไม่ใช่ `.workspace`
    // เดิมอ่าน `.ProseMirror` แล้วขึ้นไปหาพ่อ ซึ่งได้ `.workspace` — ตัวนั้น**ไม่เคยเลื่อน**
    // จึงได้ 0 เสมอ และ `s.tabs.scroll` ว่างเปล่ามาตลอดโดยไม่มีใครรู้
    const scroll = {};
    for (const [f, tab] of state.tabs) {
      const sc = tab && tab.pane ? tab.pane.scrollTop : 0;
      if (sc) scroll[f] = Math.round(sc);
    }
    s.tabs.scroll = scroll;
    // [alpha.159 · QoL] ตำแหน่งเคอร์เซอร์/ช่วงที่เลือกของทุกแท็บที่เป็นตัวแก้ไข (เปิดโปรแกรมใหม่แล้วกลับมาตรงเดิม)
    const cursor = {};
    for (const [f, tab] of state.tabs) {
      const v = tab && (tab.editor || tab.sp) && (tab.editor || tab.sp).view;
      if (!v || f.startsWith('::')) continue;
      const { anchor, head } = v.state.selection;
      if (anchor || head) cursor[f] = [anchor, head];
    }
    s.tabs.cursor = cursor;
  } catch (e) { log('warn', tt('ui.session.warnTabs'), e); }
  // แผง/แยกจอ: อ่านจาก localStorage ก้อนเดียวกับที่ระบบแผงใช้ (ที่นี่แค่ "ก๊อปลงไฟล์ให้ปลอดภัย")
  const ls = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  s.panels.layout = ls('k2-panel-layout');
  s.panels.homes = ls('k2-panel-home');
  s.panels.workspaces = ls('k2-panel-workspaces');
  s.split = ls('k2-split-layout');
  // เก็บ **ทั้งเนมสเปซ `k2-*` ของ localStorage** ไม่ใช่ไล่ทีละคีย์ —
  // ค่าจำเล็ก ๆ ของ UI มีกระจายอยู่หลายที่ (ต้นไม้ที่พับ · สวิตช์ค้นหา · มุมมองหน้าแรก ·
  // จุดบอกโครงใน Navigation …) ไล่เก็บทีละตัวแล้วลืมแน่นอนเมื่อมีคนเพิ่มคีย์ใหม่
  const lsAll = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('k2-')) lsAll[k] = localStorage.getItem(k);
    }
  } catch {}
  s.ui = {
    ls: lsAll,
    // [alpha.164 · รอบต่อ 5] ซูมที่ "ผู้ใช้ตั้ง" ไม่ใช่ค่าที่ตัวซูมพอดีความกว้างอัตโนมัติย่อไว้ชั่วคราว —
    // เดิมเก็บ pageScale (เช่น 0.7 ตอนหน้าต่างแคบ) แล้วตอนกู้ setPageScale ตั้งเป็น _userScale
    // = ขยายหน้าต่างทีหลังก็ไม่มีวันกลับไป 100% ที่ผู้ใช้ตั้งไว้
    zoom: _userScale != null ? _userScale : pageScale,
    paper: true,
    reading: document.body.classList.contains('reading-mode'),
    focus: document.body.classList.contains('focus-mode'),
  };
  try { s.win = SESS.normalizeWin(await kapi.winBounds()); } catch {}
  return s;
}

/** เขียนเซสชันลงไฟล์ (ข้ามถ้าไม่มีอะไรเปลี่ยนจากครั้งก่อน) */
export async function saveUiSession(force) {
  if (PANEL_WIN || _sessRestoring) return false;      // หน้าต่างแผงไม่ได้ถือเซสชัน
  if (!state.root) return false;
  try {
    const s = await captureSession();
    if (!force && _sessLast && SESS.sameSession(_sessLast, s)) return false;
    _sessLast = s;
    const ok = await kapi.sessionWrite(SESS.sessionKey(state.root), s);
    return !!ok;
  } catch (e) { log('warn', tt('ui.session.warnSave'), e); return false; }
}

/** ขอให้บันทึกเซสชัน (หน่วงรวบ — เรียกถี่แค่ไหนก็ได้) */
export function markSessionDirty() {
  if (PANEL_WIN || _sessRestoring) return;
  clearTimeout(_sessTimer);
  _sessTimer = setTimeout(() => saveUiSession(), SESSION_SAVE_MS);
}

/** เริ่มระบบเซสชัน — ตัวจับเหตุการณ์ทั้งหมดผูกครั้งเดียวตอนเปิดโปรแกรม */
export function startSessionWatch() {
  if (PANEL_WIN || _sessTick) return false;
  _sessTick = setInterval(() => saveUiSession(), SESSION_TICK_MS);
  // ทางออกทุกทางที่เบราว์เซอร์ยิงให้ — pagehide/visibilitychange ทำงานแม้ตอนถูกปิดกะทันหัน
  window.addEventListener('beforeunload', () => { saveUiSession(true); });
  window.addEventListener('pagehide', () => { saveUiSession(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveUiSession(true); });
  window.addEventListener('resize', () => markSessionDirty());
  // (การเปลี่ยนเลย์เอาต์แผงเรียก markSessionDirty() จากใน callback ของ onPanelLayoutChange
  //  ที่ตั้งไว้ตอนเปิดโปรเจกต์ — ตัวนั้นรับ callback ได้ตัวเดียว จึงห้ามลงทะเบียนซ้อนที่นี่)
  return true;
}

/**
 * โหมดเทสห้ามกู้/บันทึกเซสชันอัตโนมัติ
 *
 * e2e ต้อง **idempotent** (บทเรียนข้อ 4) — `runTest()` ล้าง `k2-panel-layout` ทิ้งตอนเริ่มทุกรอบ
 * ถ้าปล่อยให้ระบบเซสชันกู้ไฟล์ของรอบก่อนกลับเข้ามา เลย์เอาต์รอบก่อนจะย้อนมาทับทันที
 * → รอบที่สองได้ผลไม่เหมือนรอบแรกโดยที่โค้ดไม่เปลี่ยนเลย (อาการหลอกที่สุด)
 * เทสของระบบเซสชันเองเรียกฟังก์ชันพวกนี้ตรง ๆ ใน `[79-3]` จึงยังครอบคลุมเต็มที่
 */
const sessionOff = () => {
  try { return !!globalThis.__k2testing || location.search.includes('k2test'); } catch { return false; }
};

/** กู้เซสชันของโปรเจกต์นี้ — เรียก **ก่อน** initPanelSystem (แผงอ่าน localStorage ตอนเริ่ม) */
export async function restoreSessionLayout(root) {
  if (PANEL_WIN || !root) return null;
  let raw = null;
  try { raw = await kapi.sessionRead(SESS.sessionKey(root)); } catch { return null; }
  if (!raw) return null;
  const s = SESS.migrateSession(raw);
  if (SESS.isStale(s, Date.now(), 180)) { log('info', tt('ui.session.tooOld')); return null; }
  _sessRestoring = true;
  try {
    // ยัดกลับเข้า localStorage ให้ระบบแผง/แยกจอ อ่านเจอเหมือนเดิมทุกประการ
    // (คืนค่าจำเล็ก ๆ ทั้งเนมสเปซก่อน แล้วค่อยทับด้วยของหลักที่เก็บแยกไว้)
    const raw = (s.ui && s.ui.ls && typeof s.ui.ls === 'object') ? s.ui.ls : {};
    // [alpha.93 ข้อ 2] ★ ห้ามเอาภาพเก่ามาทับของที่ใหม่กว่า
    // localStorage อยู่ยงข้ามการเปิด-ปิดโปรแกรมด้วยตัวเองอยู่แล้ว · ไฟล์เซสชันเป็นแค่ **สำเนาสำรอง**
    // (ไว้กู้ตอนย้ายเครื่อง/ไฟล์หาย) ถ้าสำเนานั้นเก่ากว่าของจริง การยัดกลับ = ย้อนงานผู้ใช้
    let lsTs = 0;
    try { lsTs = +(localStorage.getItem('k2-ls-ts') || 0) || 0; } catch {}
    // [alpha.154 ข้อ 1] เทียบกับ "เวลาแก้ล่าสุดที่เซสชันเห็นตอนถ่ายภาพ" (ค่า k2-ls-ts ที่ติดมาในไฟล์)
    // ไม่ใช่เวลาถ่ายภาพ — localStorage ใหม่กว่าจริงก็ต่อเมื่อมีการแก้ที่เซสชันไม่เคยเห็น
    const seenTs = +((s.ui && s.ui.ls && s.ui.ls['k2-ls-ts']) || 0) || s.ts;
    const lsNewer = !!(lsTs && seenTs && lsTs > seenTs);
    if (!lsNewer) {
      for (const k of Object.keys(raw)) {
        try { if (k.startsWith('k2-') && typeof raw[k] === 'string') localStorage.setItem(k, raw[k]); } catch {}
      }
    }
    // ══ [alpha.154 ข้อ 1] ★★ ผู้ใช้: *"ขนาดของ panel และตำแหน่งไม่ถูกจัดเก็บ ... ย้ายที่เอง"* ══
    //
    // ด่านกันของเก่าทับของใหม่ข้างบน (alpha.93) คุมแค่ **ค่าจำเล็ก ๆ** — บรรทัด `put()` ข้างล่าง
    // ยัดเลย์เอาต์แผง/แยกจอจากไฟล์เซสชันทับ localStorage **ทุกครั้งโดยไม่ดูเวลาเลย**
    // ไฟล์เซสชันเขียนหลังเปลี่ยน 8 วินาที (และตอนปิดแบบ async ซึ่งมักไม่ทัน) →
    // ย้าย/ย่อขยายแผงแล้วปิดโปรแกรมภายในไม่กี่วินาที = เปิดครั้งหน้าได้เลย์เอาต์ก่อนย้าย (probe ยืนยัน:
    // แผงลอยที่เพิ่งลอยออกมาหายไปทั้งใบหลังเปิดใหม่) · ตอนนี้ใช้ด่านเดียวกัน
    // และยังกู้ให้เสมอเมื่อเครื่องนี้ไม่มีค่านั้นเลย (กรณีย้ายเครื่อง — จุดประสงค์เดิมของไฟล์เซสชัน)
    const put = (k, v) => {
      try {
        if (!v) return false;
        if (lsNewer && localStorage.getItem(k) != null) return false;
        localStorage.setItem(k, JSON.stringify(v));
        return true;
      } catch { return false; }
    };
    // ระบบแผงโหลดเลย์เอาต์ไปแล้วตั้งแต่ตอนบูต (ก่อนเปิดโปรเจกต์) — บอกผู้เรียกให้โหลดใหม่
    // ไม่งั้นของที่เพิ่งกู้อยู่แค่ใน localStorage แล้วถูกเลย์เอาต์ในหน่วยความจำเขียนทับตอนแผงขยับครั้งถัดไป
    s._layoutApplied = put('k2-panel-layout', s.panels.layout);
    if (put('k2-panel-home', s.panels.homes)) s._layoutApplied = true;
    put('k2-panel-workspaces', s.panels.workspaces);
    put('k2-split-layout', s.split);
    if (s.win) { try { await kapi.winSetBounds(s.win); } catch {} }
  } finally { _sessRestoring = false; }
  log('info', ttf('ui.session.restored', SESS.sessionSummary(s).tabs));
  return s;
}

/** กู้ส่วนที่ต้องทำ **หลัง** เปิดโปรเจกต์เสร็จ (แท็บ + ซูม) */
export async function restoreSessionTabs(s) {
  if (!s || PANEL_WIN) return 0;
  const exists = [];
  for (const f of s.tabs.open) { try { if (await kapi.exists(f)) exists.push(f); } catch {} }
  const pruned = SESS.pruneTabs(s, exists);
  let n = 0;
  for (const f of pruned.tabs.open) {
    // ต้อง **เปิด** ไฟล์ ไม่ใช่ activate เฉย ๆ (activate สลับได้เฉพาะแท็บที่เปิดอยู่แล้ว)
    try { if (await openTabAt(f)) n++; } catch {}
  }
  // [alpha.162 · W4 ข้อ 11] คืนหมุดของแท็บ
  for (const f of pruned.tabs.pinned || []) if (state.tabs.has(f)) { try { setTabPinned(f, true); } catch {} }
  // ปิดท้ายด้วยแท็บที่ผู้ใช้ดูอยู่ล่าสุด — ตอนนี้แท็บนั้นถูกเปิดแล้วจึง activate ได้จริง
  if (pruned.tabs.active && state.tabs.has(pruned.tabs.active)) {
    try { activate(pruned.tabs.active); } catch {}
  }
  if (s.ui && Number.isFinite(+s.ui.zoom) && +s.ui.zoom > 0) {
    try { setPageScale(+s.ui.zoom); autoFitWidth(); } catch {}   // [รอบต่อ 5] ซูมของผู้ใช้ → ย่อให้พอดีแผงตอนนี้ (ถ้าเปิดสวิตช์)
  }
  // [alpha.93 ข้อ 4] ★ ตำแหน่งเลื่อนจอถูก **เก็บมาตลอดแต่ไม่เคยถูกเอากลับมาใช้เลย**
  // (และค่าที่เก็บก็เป็น 0 เสมอเพราะอ่านผิดตัว — ดู captureSession) → เปิดโปรเจกต์แล้ว
  // ทุกแท็บเริ่มที่บรรทัดแรกเสมอ ทั้งที่ตั้งใจจะกลับไปตรงที่ค้างไว้
  const back = pruned.tabs.scroll || {};
  if (Object.keys(back).length) {
    const put = () => {
      for (const [f, y] of Object.entries(back)) {
        const tb = state.tabs.get(f);
        if (!tb || !tb.pane) continue;
        const max = Math.max(0, tb.pane.scrollHeight - tb.pane.clientHeight);
        tb.pane.scrollTop = Math.min(Math.max(0, +y || 0), max);
      }
    };
    put(); setTimeout(put, 250); setTimeout(put, 900);   // เนื้อหา/การจัดหน้ายังทยอยวาด
  }
  // [alpha.159 · QoL] คืนเคอร์เซอร์/ช่วงที่เลือก — หนีบให้อยู่ในเอกสาร (ไฟล์อาจถูกแก้นอกโปรแกรมระหว่างปิด)
  for (const [f, pair] of Object.entries(pruned.tabs.cursor || {})) {
    const tb = state.tabs.get(f);
    const v = tb && (tb.editor || tb.sp) && (tb.editor || tb.sp).view;
    if (!v) continue;
    try {
      const max = v.state.doc.content.size;
      const [a, h] = pair.map((x) => Math.max(0, Math.min(max, x)));
      v.dispatch(v.state.tr.setSelection(PMTextSelection.between(v.state.doc.resolve(a), v.state.doc.resolve(h))));
    } catch {}
  }
  if (n) log('info', ttf('ui.session.restoredTabs', n));
  return n;
}

// ขอบเขตการค้น: จำกัดผลการกรองไว้เฉพาะบทที่เลือก (คลิกขวาที่หัวบท → ค้นเฉพาะในบทนี้)
let treeScope = null;    // { guid, label }
function setTreeScope(scope) {
  treeScope = scope || null;
  renderScopeChip();
  const q = $('#tree-search');
  filterTree(q ? q.value : '');
  if (treeScope && q) q.focus();
  setStatus(treeScope ? tt('ui.app.searchOnlyChapter') + treeScope.label : tt('ui.app.searchProject'));
  return treeScope;
}
function renderScopeChip() {
  let chip = document.getElementById('tree-scope');
  if (!treeScope) { if (chip) chip.remove(); return; }
  if (!chip) {
    chip = el('div', 'tree-scope'); chip.id = 'tree-scope';
    const tree = $('#tree'); if (tree && tree.parentNode) tree.parentNode.insertBefore(chip, tree);
  }
  chip.innerHTML = iconHtml('search', 14) + tx('ui.app.searchOnly') + hx(treeScope.label) + '  ';
  const x = el('span', 'tree-scope-x', gi('close'));
  x.title = tt('ui.app.cancelMargin');
  x.onclick = () => setTreeScope(null);
  chip.append(x);
}

// กรองต้นไม้ตามคำค้น (ชื่อฉาก/แท็ก/สถานะ/ชื่อ entity) — ซ่อนแถวที่ไม่ตรง + บท/หมวดที่ว่าง
// บั๊ก #13: รวมทุกข้อความในไฟล์เอนทิตี้เป็นสตริงเดียวสำหรับค้นหา (ชื่อ · ชื่อเล่น · แท็ก ·
// ทุกฟิลด์ที่เป็นข้อความ · ชื่อคนที่มีความสัมพันธ์ด้วย) — ตัดความยาวกันข้อมูลบวมเกินจำเป็น
export function entitySearchBlob(name, ent, cat, secName) {
  const parts = [name, cat || '', secName || ''];
  const push = (v, depth = 0) => {
    if (v == null || depth > 3) return;
    if (typeof v === 'string') { parts.push(v); return; }
    if (typeof v === 'number' || typeof v === 'boolean') { parts.push(String(v)); return; }
    if (Array.isArray(v)) { for (const x of v) push(x, depth + 1); return; }
    if (typeof v === 'object') { for (const k of Object.keys(v)) { parts.push(k); push(v[k], depth + 1); } }
  };
  if (ent && typeof ent === 'object') {
    for (const k of Object.keys(ent)) {
      if (k === 'images' || k === 'cover' || k === 'guid' || k === 'id') continue;   // ไม่ใช่ข้อความให้ค้น
      push(ent[k]);
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').toLowerCase().slice(0, 4000);
}

// [alpha.161 · P3] ฉากสถานะ "เก็บถาวร": ค่าเริ่มต้น = ซ่อน · ปุ่ม #filter-archive-toggle ON = แสดง
// ตัดสินที่ filterTree ที่เดียว (เดิมปุ่มซ่อน/แสดงเองแยกจากตัวกรอง → ตรรกะกลับด้าน · คลิกแรกไม่มีผล ·
// อ่าน dataset.filteredHidden ที่ไม่มีใครตั้ง → กดแสดงแล้วแถวที่คำค้นซ่อนไว้โผล่กลับมา)
const treeArchive_C = { show: false };
const isArchivedRow = (s) => !!(s._scene && s._scene.status === 'เก็บถาวร');
export function treeShowArchived() { return treeArchive_C.show; }
export function setTreeShowArchived(on) {
  treeArchive_C.show = !!on;
  const b = $('#filter-archive-toggle');
  if (b) b.classList.toggle('on', treeArchive_C.show);
  const q = $('#tree-search');
  filterTree(q ? q.value : '');
  return treeArchive_C.show;
}
function filterTree(q) {
  const raw = (q || '').trim();
  const ql = raw.toLowerCase();
  const tree = $('#tree'); if (!tree) return;
  tree.querySelectorAll('.scene').forEach((s) => {
    if (s.classList.contains('add-row') || s.dataset.nofilter) return;
    let ok;
    if (!raw) ok = true;
    else if (s._scene) ok = sceneMatchesQuery(s._scene, raw);   // ค้นทุกฟิลด์ + field:value
    // [alpha.120 ข้อ 4] แถวที่ไม่ใช่ฉากต้องใช้ไวยากรณ์เดียวกัน (OR / -ไม่เอา)
    // เดิมเป็น `includes(ทั้งคิวรี)` → ติ๊กชิปสองสถานะทีไร แถว Wiki/รูป/โน้ต หายเกลี้ยงทุกที
    else ok = textMatchesQuery(s.dataset.search || s.textContent, raw);
    // [alpha.65r8 → alpha.74] "ค้นเฉพาะในบทนี้" ต้องไม่กลืนแถวที่ไม่ได้อยู่ในบทไหนเลย
    //
    // ⚠️ ต้นตอของ "หัวข้อขึ้น (n) แต่ข้างล่างไม่มีแถว" ที่ผู้ใช้เจอกับ **แผนที่**:
    // .65r8 ยกเว้นให้เฉพาะ `data-planner` (กระดานวางแผน) แบบเจาะจง → หมวดที่เพิ่มมาทีหลัง
    // (แผนที่ · แผนผังแตกสาย · และอะไรก็ตามในอนาคต) ยังโดนกลืนเหมือนเดิมเพราะไม่มี chGuid
    // **กฎที่ถูกคือดูที่ตัวแถวเอง**: แถวที่ไม่ได้สังกัดบทไหน (ไม่มี chGuid) ไม่เกี่ยวกับขอบเขตบท
    if (ok && treeScope && treeScope.guid && s.dataset.chGuid) ok = s.dataset.chGuid === treeScope.guid;
    // [alpha.155] "ค้นหาในเล่ม" — แถวที่สังกัดเล่ม (data-sec) ต้องเป็นของเล่มนั้น · แถวนอกเล่มไม่เกี่ยว
    if (ok && treeScope && treeScope.sec && s.dataset.sec) ok = s.dataset.sec === treeScope.sec;
    if (!ok && s.dataset.planner) {
      // [alpha.128] เครื่องมือวินิจฉัย K-1 (ปิดเคสแล้วที่ alpha.75) — เป็น debug ไม่ใช่ info
      log('debug', ttf('ui.app.plannerTreeItemFilter', s.dataset.plannerName),
          { query: raw, scope: treeScope ? treeScope.label : null });
    }
    // [alpha.161 · P3] สองเหตุผลของการซ่อนแยกกันชัด: คำค้น/ขอบเขต (filteredHidden) · เก็บถาวร (archived)
    if (ok) delete s.dataset.filteredHidden; else s.dataset.filteredHidden = '1';
    const hideArch = isArchivedRow(s) && !treeArchive_C.show;
    s.classList.toggle('archived', hideArch);
    s.style.display = ok && !hideArch ? '' : 'none';
  });
  // ซ่อนบท/หมวดที่ไม่มีฉากโชว์ (เมื่อกำลังค้นหา)
  tree.querySelectorAll('.chapter').forEach((ch) => {
    const anyVisible = [...ch.querySelectorAll('.scene')]
      .some((s) => !s.classList.contains('add-row') && s.style.display !== 'none');
    ch.style.display = ((!q && !treeScope) || anyVisible) ? '' : 'none';
  });
  // [alpha.65r8] ถ้าคำค้นซ่อนกระดานหมด ให้บอกไปตรง ๆ ว่า "ถูกกรองอยู่" — ไม่ใช่ปล่อยให้
  // หมวดขึ้น (1) แต่ข้างล่างว่างเปล่า จนดูเหมือนไฟล์หาย (อาการที่ผู้ใช้รายงาน)
  const plNote = tree.querySelector('.planner-filter-note');
  if (plNote) {
    const plRows = [...tree.querySelectorAll('.scene[data-planner]')];
    const anyBoard = plRows.some((r) => r.style.display !== 'none');
    plNote.style.display = (plRows.length && !anyBoard) ? '' : 'none';
    plNote.textContent = ttf('ui.app.boardItemHideItem', plRows.length);
  }
  tree.querySelectorAll('.sec').forEach((sec) => {
    const anyVisible = [...sec.querySelectorAll('.scene, .chapter')]
      .some((s) => !s.classList.contains('add-row') && s.style.display !== 'none');
    sec.style.display = ((!q && !treeScope) || anyVisible) ? '' : 'none';
  });

  // ═══ [alpha.124 ข้อ 14] ★ "ค้นแล้วเจอ แต่ไม่เห็น" ═══
  //
  // ต้นตอ: ตัวกรองนี้จัดการแค่ `style.display` ของแต่ละแถว แต่หมวด/บทที่ **พับอยู่**
  // ซ่อนลูกทั้งก้อนด้วยกฎ CSS คนละชั้น (`.sec.collapsed > *:not(.sec-title)`) →
  // แถวที่ตรงคำค้นถูกตั้ง `display:''` เรียบร้อยแล้ว แต่ยังมองไม่เห็นอยู่ดี
  // (หัวข้อขึ้นจำนวนที่เจอ แต่ข้างล่างว่างเปล่า = อาการ "ไฟล์หาย" ที่ผู้ใช้รายงานมาตลอด)
  //
  // กติกา: **ค้นหาอยู่ = กางให้หมดชั่วคราว · ล้างคำค้น = คืนสภาพพับตามที่ผู้ใช้ตั้งไว้**
  // สภาพพับตัวจริงเก็บใน localStorage (`treeCollapsed()`) อยู่แล้ว จึงคืนค่าได้เป๊ะ
  // ไม่ต้องจำอะไรเพิ่ม และการกางชั่วคราวนี้ไม่ถูกบันทึกทับของเดิม
  const searching = !!raw || !!treeScope;
  tree.querySelectorAll('.sec, .chapter').forEach((box) => {
    if (searching) {
      // เก็บของเดิมไว้ครั้งเดียว แล้วกางเฉพาะก้อนที่ยังมีลูกโผล่อยู่
      if (box.dataset.wasCollapsed === undefined)
        box.dataset.wasCollapsed = box.classList.contains('collapsed') ? '1' : '';
      box.classList.remove('collapsed');
    } else if (box.dataset.wasCollapsed !== undefined) {
      box.classList.toggle('collapsed', box.dataset.wasCollapsed === '1');
      delete box.dataset.wasCollapsed;
    }
    const caret = box.querySelector(':scope > .sec-title > .tw, :scope > .ch-title > .tw');
    if (caret) caret.classList.toggle('tw-open', !box.classList.contains('collapsed'));
  });
}

// สร้างต้นไม้ explorer แบบ "double-buffer": ประกอบใน fragment ที่ยังไม่แสดง
// แล้วค่อยสลับเข้า #tree ครั้งเดียวตอนจบ → ไม่มีช่วงต้นไม้ว่าง (กันกระพริบ)
// และกัน re-entrant: ถ้ามีการเรียกซ้อนระหว่างกำลังสร้าง จะสร้างใหม่อีกรอบหลังจบ (ไม่ interleave)
let _treeBuilding = false, _treeQueued = false;
// [alpha.74] ธงบอกว่ากำลัง "สลับ buffer" ของต้นไม้อยู่ — ตัวเฝ้าแถวจะได้ไม่เตือนหลอก
// (ต้นไม้เก่าทั้งก้อนถูกถอดออกตอนนี้เป็นเรื่องปกติ ไม่ใช่แถวหาย)
let _treeSwapping = false;
// ---------------- Accordion Explorer (พับ/กางเล่ม·บท·หมวด) ----------------
function treeCollapsed() {
  try { return JSON.parse(localStorage.getItem('k2-tree-collapsed:' + state.root) || '{}'); }
  catch { return {}; }
}
function setTreeCollapsed(key, on) {
  const m = treeCollapsed();
  if (on) m[key] = 1; else delete m[key];
  localStorage.setItem('k2-tree-collapsed:' + state.root, JSON.stringify(m));
}
/**
 * [alpha.162 · W4 ข้อ 10] กาง/พับ **ทุกก้อน** ในต้นไม้ทีเดียว (เล่ม · บท · หมวด)
 * เขียนสถานะลงที่จำชุดเดียวกับการพับทีละก้อน → เปิดโปรเจกต์ใหม่ก็ยังเป็นแบบที่สั่งไว้
 * (alpha.155 เคยถอดออกเพราะไม่อยู่ในรายการเมนูของผู้ใช้ตอนนั้น — W4 ผู้ใช้ขอกลับมาเอง)
 * @returns {number} จำนวนก้อนที่แตะ
 */
export function setAllTreeCollapsed(on) {
  const tree = $('#tree');
  if (!tree) return 0;
  const m = treeCollapsed();
  let n = 0;
  for (const box of tree.querySelectorAll('[data-acc-key]')) {
    box.classList.toggle('collapsed', !!on);
    if (box._k2caret) box._k2caret.classList.toggle('tw-open', !on);
    if (on) m[box.dataset.accKey] = 1; else delete m[box.dataset.accKey];
    n++;
  }
  try { localStorage.setItem('k2-tree-collapsed:' + state.root, JSON.stringify(m)); } catch {}
  return n;
}
// ติดหัวพับได้: prepend caret + คลิกหัว(นอกปุ่ม) toggle .collapsed + จำสถานะ
function makeAccordion(headEl, containerEl, key) {
  const collapsed = !!treeCollapsed()[key];
  // [alpha.120 ข้อ 1] ลูกศรพับ/กางแบบ VS Code — **เชฟรอน `>` ตัวเดียวที่หมุน 90°** เมื่อกาง
  // เดิมสลับอักขระ ▸/▾ ซึ่งเป็นคนละสัญลักษณ์ (ความกว้าง/น้ำหนักเส้นไม่เท่ากัน) แถวจึงขยับตอนพับ
  const caret = el('span', 'tw' + (collapsed ? '' : ' tw-open'));
  caret.innerHTML = iconHtml('chevron-right', 12);
  headEl.prepend(caret);
  if (collapsed) containerEl.classList.add('collapsed');
  // [alpha.162 · W4 ข้อ 10] จำคีย์/ลูกศรไว้บนก้อน → "กาง/พับทั้งหมด" เดินหาได้โดยไม่ต้องรู้ว่าเป็นก้อนชนิดไหน
  containerEl.dataset.accKey = key;
  containerEl._k2caret = caret;
  const toggle = (e) => {
    if (e && e.target && e.target.closest('.row-add')) return;   // ปุ่ม + ไม่นับ
    const now = containerEl.classList.toggle('collapsed');
    caret.classList.toggle('tw-open', !now);
    setTreeCollapsed(key, now);
    if (e) e.stopPropagation();
  };
  caret.onclick = toggle;
  headEl.addEventListener('click', toggle);
}

// ───────── [alpha.120 ข้อ 2] เรียงลำดับใน Explorer (dropdown "เรียงตาม") ─────────
//
// ★ ต้นตอที่ผู้ใช้เจอว่า "Sort ใช้ไม่ได้": `#filter-sort` มี onchange อยู่จริง แต่สิ่งที่มันเรียกคือ
//   `buildFilterBar()` (วาดชิปสถานะ/แท็กใหม่) กับ `filterTree()` (ซ่อน/แสดงแถว) — **ไม่มีใคร
//   เรียงอะไรเลยสักบรรทัด** ค่าที่เลือกจึงไม่เคยถูกอ่าน ต้นไม้เรียงตาม `order` เหมือนเดิมทุกครั้ง
// ตอนนี้ค่าถูกเก็บต่อโปรเจกต์ แล้ว buildTree() เป็นคนเรียงจริงทั้งฉาก · โน้ต · เอนทิตี้ Wiki
function treeSortMode() {
  const sel = $('#filter-sort');
  if (sel && sel.value) return sel.value;
  try { return localStorage.getItem('k2-tree-sort:' + state.root) || ''; } catch { return ''; }
}
function setTreeSortMode(v) {
  try { localStorage.setItem('k2-tree-sort:' + state.root, v || ''); } catch {}
}
const _thCmp = (a, b) => cmpText(String(a || ''), String(b || ''));
/**
 * เรียงรายการฉาก/โน้ตตามโหมดที่เลือก
 * @param {object[]} list แถวจาก scenes.json
 * @param {Map<string,number>} [mtimes] id → เวลาแก้ไข (เฉพาะโหมด 'modified')
 */
function sortSceneRows(list, mode, mtimes) {
  const out = list.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!mode) return out;
  if (mode === 'name') return out.sort((a, b) => _thCmp(a.title, b.title));
  if (mode === 'words') return out.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
  if (mode === 'status') {
    // 'Outline' = ยังไม่ตั้ง → ไปท้ายเสมอ ไม่ใช่ปนกลางตามตัวอักษร
    // [alpha.159 · H9] ลำดับมาจาก allStatuses() (ตามที่ผู้ใช้ลากคอลัมน์ Kanban · รวมสถานะที่สร้างเอง)
    // เดิมใช้ SCENE_STATUSES ตายตัว → สถานะที่สร้างเองไปกองท้ายรวมกับ "ยังไม่ตั้ง" และลำดับที่ผู้ใช้จัดถูกเมิน
    const rank = statusRankOf(allStatuses());
    return out.sort((a, b) => rank(a.status) - rank(b.status) || (a.order || 0) - (b.order || 0));
  }
  if (mode === 'modified') {
    const at = (r) => (mtimes && mtimes.get(r.id)) || 0;
    return out.sort((a, b) => at(b) - at(a));
  }
  return out;
}

// ───────── [alpha.120 ข้อ 17] ป้าย "(n)" = ไฟล์นี้มีกี่เวอร์ชัน ─────────
//
// เวอร์ชันเก็บที่ `<root>/Snapshots/<ทางสัมพัทธ์ที่แทน \\ และ / ด้วย __>/*.md` (ดู snapDirFor)
// ถ้าไปถาม `listSnapshots()` ทีละฉากตอนสร้างต้นไม้ = IPC หลายร้อยรอบต่อการรีเฟรชหนึ่งครั้ง
// → **อ่านโฟลเดอร์ Snapshots รอบเดียว** แล้วประกอบคีย์เองจากชิ้นส่วนที่ buildTree รู้อยู่แล้ว
async function snapshotCounts() {
  const m = new Map();
  if (!state.root) return m;
  try {
    const root = await kapi.join(state.root, 'Snapshots');
    if (!(await kapi.exists(root))) return m;
    for (const d of await kapi.listDirs(root)) {
      let n = 0;
      try { n = (await kapi.listFiles(await kapi.join(root, d), '.md')).length; } catch {}
      if (n) m.set(d, n);
    }
  } catch (e) { log('warn', tt('ui.tree.snapCountFail'), e); }
  return m;
}
/** คีย์ของไฟล์ในตาราง snapshotCounts() — ชิ้นส่วนทางสัมพัทธ์จากรากโปรเจกต์ */
function snapKey(...parts) {
  return parts.filter(Boolean).join('__').replace(/\.md$/i, '');
}
/** แปะป้าย (n) ต่อท้ายแถว ถ้าไฟล์นั้นมีเวอร์ชันเก็บไว้ */
function addVersionBadge(rowEl, counts, key) {
  const n = counts && counts.get(key);
  if (!n) return;
  const b = el('span', 'sc-vers', '(' + n + ')');
  b.title = ttf('ui.tree.versionCount', n);
  rowEl.append(b);
}

// ───────── [alpha.120 ข้อ 5] สถานะ "กำลังแก้ / ยังไม่บันทึก" ของแถวในต้นไม้ ─────────
//
// กติกาที่ผู้ใช้กำหนด (ใช้กับทั้งฉากและเอนทิตี้ Wiki):
//   ตัวหนา          = ฉากที่กำลังแก้อยู่ (แท็บที่ active)
//   ตัวเอียง        = เปิดค้างไว้ ยังไม่บันทึก แต่ไม่ได้อยู่บนหน้าจอตอนนี้
//   ตัวหนา + เอียง  = กลับมาแก้แล้วและยังไม่บันทึก
// ทำด้วย class ล้วน ๆ ตามกฎถาวรข้อ 4 (ห้ามใส่สัญลักษณ์/เขียนทับข้อความในแถว)
function applyRowOpenState(rowEl, path) {
  if (!rowEl || !path) return;
  rowEl.dataset.tabrow = '1';                 // ป้ายว่า "แถวนี้ผูกกับแท็บเอกสาร" (ดู refreshTreeRowStates)
  const tab = state.tabs.get(path);
  // ⚠ `state.active` เป็น **ตัวแท็บ** ไม่ใช่ path (พลาดตรงนี้ = ไม่มีแถวไหนเป็นตัวหนาเลย)
  rowEl.classList.toggle('k-row-open', !!tab && !!state.active && state.active.file === path);
  rowEl.classList.toggle('k-row-unsaved', !!(tab && tab.dirty));
}
/** เพิ่มบทลงในฉบับร่างแรกของเล่ม (ทางลัดที่ทั้งปุ่ม + และเมนูคลิกขวาของเล่มใช้ร่วมกัน) */
async function addChapterToSection(secPath) {
  const dRoot = await kapi.join(secPath, 'Draft');
  const dns = (await kapi.exists(dRoot)) ? await kapi.listDirs(dRoot) : [];
  if (!dns.length) { setStatus(tt('ui.app.bookNotHasDraft')); return null; }
  return addChapter(await kapi.join(dRoot, dns[0]));
}

// ═══════ [alpha.120 ข้อ 16] เลือกหลายไฟล์ + คัดลอก/ตัด/วาง/ทำซ้ำ/ลบ ใน Explorer ═══════
//
// เดิม Explorer เลือกได้ทีละแถวเท่านั้น และคีย์ Ctrl+C/V/D ไปเข้าตัวแก้ไขเสมอ
// ตอนนี้: Ctrl+คลิก = สลับเลือก · Shift+คลิก = เลือกเป็นช่วง · คีย์ลัดทำงานเมื่อโฟกัสอยู่ในต้นไม้
// เก็บ "ทางไฟล์" เป็นกุญแจ (ไม่ใช่ตัว element) เพราะต้นไม้ถูกสร้างใหม่ทั้งก้อนบ่อยมาก
const treeSel = new Set();                  // path ที่ถูกเลือกอยู่
let treeSelAnchor = null;                   // จุดตั้งต้นของการเลือกเป็นช่วง (Shift)
const treeClip = { mode: '', items: [] };   // คลิปบอร์ดของต้นไม้ ('copy' | 'cut')

/** แถวฉากทั้งหมดตามลำดับที่เห็นบนจอ (ข้ามแถวที่ถูกกรองซ่อนอยู่) */
function treeRows() {
  const tree = $('#tree');
  if (!tree) return [];
  // เฉพาะแถว "ฉาก" (มี `_ctx`) — แถวกระดาน/แผนที่/รูป ใช้ data-path เหมือนกันแต่คนละเรื่อง
  return [...tree.querySelectorAll('.scene[data-path]')]
    .filter((r) => r._ctx && r.style.display !== 'none');
}
function paintTreeSel() {
  const tree = $('#tree');
  if (!tree) return;
  const cut = treeClip.mode === 'cut' ? new Set(treeClip.items.map((it) => it.file)) : null;
  for (const r of tree.querySelectorAll('.scene[data-path]')) {
    if (!r._ctx) continue;                      // เฉพาะแถวฉาก (แถวเล่าด้วยภาพใช้ path เดียวกับฉากแม่)
    r.classList.toggle('k-row-sel', treeSel.has(r.dataset.path));
    // แถวที่ถูก "ตัด" ไว้รอวาง — จางลงเหมือน Windows Explorer
    r.classList.toggle('k-row-cut', !!cut && cut.has(r.dataset.path));
  }
}
export function treeSelectOnly(rowEl) {
  treeSel.clear();
  if (rowEl && rowEl.dataset.path) { treeSel.add(rowEl.dataset.path); treeSelAnchor = rowEl.dataset.path; }
  paintTreeSel();
  return treeSel.size;
}
export function treeSelectClick(rowEl, ev) {
  if (!rowEl || !rowEl.dataset.path) return 0;
  const p = rowEl.dataset.path;
  if (ev && ev.shiftKey && treeSelAnchor) {
    const rows = treeRows();
    const a = rows.findIndex((r) => r.dataset.path === treeSelAnchor);
    const b = rows.findIndex((r) => r.dataset.path === p);
    if (a >= 0 && b >= 0) {
      treeSel.clear();
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) treeSel.add(rows[i].dataset.path);
    }
  } else {
    if (treeSel.has(p)) treeSel.delete(p); else treeSel.add(p);
    treeSelAnchor = p;
  }
  paintTreeSel();
  setStatus(ttf('ui.tree.selectedCount', treeSel.size));
  return treeSel.size;
}
export function clearTreeSel() { treeSel.clear(); paintTreeSel(); }
/** บริบทของแถวที่เลือกอยู่ (เฉพาะแถวฉากที่ยังอยู่ในต้นไม้) */
function treeSelCtx() {
  const out = [];
  for (const r of treeRows()) if (treeSel.has(r.dataset.path) && r._ctx) out.push({ ...r._ctx, file: r.dataset.path, row: r });
  return out;
}
/** เมนูคลิกขวาเมื่อเลือกไว้หลายแถว */
function treeMultiMenu(items) {
  return [
    { label: ttf('ui.tree.selectedCount', items.length), disabled: true },
    '-',
    { label: tt('ui.tree.copy'), click: () => treeCopy(items, 'copy') },
    { label: tt('ui.tree.cut'), click: () => treeCopy(items, 'cut') },
    { label: tt('ui.tree.duplicate'), click: () => treeDuplicate(items) },
    '-',
    { label: tt('ui.tree.moveToChapter'), click: () => treeMoveMenu(items) },
    '-',
    { label: tt('ui.tree.deleteSelected'), danger: true, click: () => treeDeleteSelected(items) },
  ];
}
export function treeCopy(items, mode) {
  const list = items && items.length ? items : treeSelCtx();
  if (!list.length) { setStatus(tt('ui.tree.nothingSelected')); return 0; }
  treeClip.mode = mode;
  treeClip.items = list.map((it) => ({ dPath: it.dPath, chGuid: it.ch.guid, folderName: it.ch.folderName,
                                       id: it.sc.id, file: it.file, title: it.sc.title }));
  paintTreeSel();
  // เขียนคีย์เป็นตัวหนังสือตรง ๆ ทั้งสองทาง — ตัวกวาดคีย์ภาษาอ่านนิพจน์ในวงเล็บไม่ออก
  // (คีย์ที่ประกอบด้วย ternary จะหลุดจากประตูกันพลาด แล้วไปโผล่เป็นตัวคีย์บนหน้าจอ)
  setStatus(mode === 'cut' ? ttf('ui.tree.cutN', treeClip.items.length)
                           : ttf('ui.tree.copiedN', treeClip.items.length));
  return treeClip.items.length;
}
/** วางสิ่งที่คัดลอก/ตัดไว้ลงบทเป้าหมาย */
export async function treePaste(dPath, ch) {
  if (!treeClip.items.length) { setStatus(tt('ui.tree.clipEmpty')); return 0; }
  if (!dPath || !ch) { setStatus(tt('ui.tree.pickChapterFirst')); return 0; }
  let n = 0; const failed = [];
  for (const it of treeClip.items) {
    try {
      if (treeClip.mode === 'cut') {
        if (it.dPath !== dPath) { setStatus(tt('ui.app.moveSkipDraftNot')); continue; }
        if (it.chGuid === ch.guid) continue;
        // [alpha.160 · P0-2] ย้ายถูกยกเลิก (แท็บบันทึกไม่ผ่าน) = ไม่นับว่าวางแล้ว
        if ((await moveSceneToChapter(dPath, { guid: it.chGuid }, { id: it.id }, ch)) === false) { failed.push(it.title); continue; }
      } else {
        // [alpha.161 · D1] งานค้างของต้นฉบับต้องลงไฟล์ **ก่อนอ่าน** (เดิมอ่าน body ก่อน saveTab → สำเนาได้เนื้อก่อนแก้)
        // บันทึกไม่ผ่าน/ยัง dirty = ข้ามรายการนี้แล้วรายงาน (ไม่วางฉบับเก่า)
        const srcTab = state.tabs.get(it.file);
        if (!(await flushTab(srcTab, (t2) => saveTab(t2)))) { failed.push(it.title); continue; }
        let meta = {}, body = '';
        try { const parsed = parseMdFile(await kapi.readFile(it.file)); meta = parsed.meta; body = parsed.body; } catch {}
        const title = it.title + (it.chGuid === ch.guid ? tt('ui.common.msg') : '');
        // [alpha.160 · P3] ตาราง "เล่าด้วยภาพ" (`<ฉาก>_vis.csv`) ต้องตามไปด้วย
        // [alpha.161 · D1] สำเนาพาเธรดคอมเมนต์ของต้นฉบับไปด้วย (commentsFrom → writeMdKeepingComments)
        const made = await addScene(dPath, ch, title, { body, meta: { ...meta, title }, silent: true, commentsFrom: it.file });
        try {
          const VC = await import('./visual/vis-core.js');
          const visSrc = it.file.replace(/[^\\/]+$/, VC.visFileName(it.file.split(/[\\/]/).pop()));
          if (made && made.fileName && await kapi.exists(visSrc)) {
            await kapi.writeFile(await kapi.join(dPath, 'Chapters', ch.folderName, VC.visFileName(made.fileName)),
                                 await kapi.readFile(visSrc));
          }
        } catch (e) { log('warn', tt('ui.tree.pasteFail'), e); }
      }
      n++;
    } catch (e) { failed.push(it.title); log('warn', tt('ui.tree.pasteFail'), e); }
  }
  if (treeClip.mode === 'cut') { treeClip.mode = ''; treeClip.items = []; }
  await buildTree();
  setStatus(ttf('ui.tree.pastedN', n, ch.title) + (failed.length ? ' · ' + ttf('ui.tree.failedN', failed.length) : ''));
  return n;
}
export async function treeDuplicate(items) {
  const list = items && items.length ? items : treeSelCtx();
  if (!list.length) { setStatus(tt('ui.tree.nothingSelected')); return 0; }
  // [alpha.124 ข้อ 18] เดิม `catch {}` เงียบสนิทแล้วรายงาน `list.length` เสมอ →
  // ทำสำเนา 5 ฉากแล้วพังหมดทั้ง 5 ก็ยังขึ้นว่า "ทำสำเนาแล้ว 5" · นับของจริงและบอกที่พลาดด้วย
  let ok = 0; const failed = [];
  for (const it of list) {
    // [alpha.161 · D2] false = ข้าม (งานค้างของต้นฉบับบันทึกไม่ผ่าน / ไม่พบแถว) — นับเป็นไม่สำเร็จ
    try { if ((await duplicateScene(it.dPath, it.ch, it.sc)) === false) failed.push(it.sc?.title || ''); else ok++; }
    catch (e) { failed.push(it.sc?.title || ''); log('warn', tt('ui.tree.duplicateFail'), e); }
  }
  setStatus(ttf('ui.tree.duplicatedN', ok)
            + (failed.length ? ' · ' + ttf('ui.tree.failedN', failed.length) : ''));
  return ok;
}
export async function treeDeleteSelected(items) {
  const list = items && items.length ? items : treeSelCtx();
  if (!list.length) { setStatus(tt('ui.tree.nothingSelected')); return 0; }
  if (!(await confirmBox(ttf('ui.tree.confirmDeleteN', list.length), tt('ui.app.del')))) return 0;
  let ok = 0; const failed = []; let lastTrash = '';
  for (const it of list) {
    // ลบหลายไฟล์ต้องไม่ถามซ้ำทีละไฟล์ — ย้ายเข้าถังเองแล้วเขียนใบกู้คืนแบบเดียวกับ deleteScene
    try { lastTrash = (await deleteSceneSilent(it.dPath, it.ch, it.sc)) || lastTrash; ok++; }
    catch (e) { failed.push(it.sc?.title || ''); log('warn', tt('ui.tree.delFail'), e); }
  }
  clearTreeSel();
  await buildTree(); refreshNetwork();
  // [alpha.159] นับของที่ลบจริง (ตัวที่บันทึกไม่ผ่าน/พังไม่นับ) — แบบเดียวกับ ทำสำเนา/ย้าย
  const msgDel = ttf('ui.tree.deletedN', ok) + (failed.length ? ' · ' + ttf('ui.tree.failedN', failed.length) : '');
  if (lastTrash) setStatusAction(msgDel, tt('ui.trash.revealInFolder'), () => kapi.revealInOS(lastTrash));   // [alpha.159 · QoL]
  else setStatus(msgDel);
  return ok;
}
/** ลบฉากลงถังขยะโดยไม่ถามซ้ำ (ตัวถามอยู่ที่ผู้เรียก — กันกล่องเด้ง n ครั้ง) */
export async function deleteSceneSilent(dPath, ch, sc) {
  const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
  // [alpha.159 · H1] งานค้างต้องลงไฟล์ก่อนย้ายลงถัง (กฎ alpha.156 — เดิมทางลบหลายฉากทิ้งเงียบ ๆ
  // แล้วของในถังเป็นฉบับเก่า) · บันทึกไม่สำเร็จ (กดยกเลิกในกล่องชนกับดิสก์) = ไม่ลบฉากนี้
  // [alpha.161 · D3] เดิมเช็คแค่ `=== false` — saveTab สำเร็จแล้ว dirty กลับมาติด (พิมพ์แทรกระหว่างเขียน · alpha.148)
  // ก็ผ่านไปได้ แล้วโค้ดบังคับ dirty=false + ปิดแบบ discard = ตัวอักษรท้ายหาย → ใช้ flushTab (ต้อง !dirty จริง)
  // และปิดแท็บ (ที่สะอาดแล้ว) **ก่อน** ย้ายไฟล์ — ไม่เหลือช่องให้พิมพ์แทรกระหว่างย้าย
  const openTab = state.tabs.get(file);
  if (!(await flushTab(openTab, (t2) => saveTab(t2)))) {
    throw new Error(ttf('ui.tree.delSkipUnsaved', sc.title || sc.fileName));
  }
  if (openTab && state.tabs.get(file) === openTab) {
    if (openTab.dirty) throw new Error(ttf('ui.tree.delSkipUnsaved', sc.title || sc.fileName));
    closeTab(file, { discard: true });
  }
  // [alpha.162 · W1-4] ชื่อในถังมาจากทางเดียว — ลบหลายฉากในมิลลิวินาทีเดียวแล้วชื่อชนกัน
  // (ทุกบทมี scene-01.md) = ฉากที่ลบก่อนถูกทับหายถาวร
  const dst = await trashPathFor(file);
  await kapi.move(file, dst);
  await kapi.writeFile(dst + '.k2restore.json', JSON.stringify(
    { kind: 'scene', dPath, chGuid: ch.guid, folderName: ch.folderName, sc }, null, 2));
  // [alpha.159 · H1] แก้ทะเบียนผ่านคิว (อ่านสด) — เดิม readJson/writeFile ดิบทับของที่เพิ่งเขียน
  const sf = await kapi.join(dPath, 'scenes.json');
  await mutateJson(kapi, sf, (d) => {
    d.chapters = d.chapters || {};
    d.chapters[ch.guid] = (d.chapters[ch.guid] || []).filter((x) => x.id !== sc.id);
  });
  await trashVisSidecar(dPath, ch.folderName, sc.fileName, dst);
  logAction('scene', ttf('ui.scene.delScene2', sc.title), { dPath, chapter: ch.title, trash: dst });
  return dst;
}
/** ย้ายหลายฉากไปบทอื่น (เลือกบทปลายทางจากรายการ) */
async function treeMoveMenu(items) {
  const list = items && items.length ? items : treeSelCtx();
  if (!list.length) return 0;
  const dst = await pickDraftTarget({ title: tt('ui.tree.moveToChapter') });
  if (!dst) return 0;
  // [alpha.124 ข้อ 18] นับ "ย้ายสำเร็จจริง" — เดิมรายงาน `list.length` ทั้งที่รวมตัวที่ข้าม
  // (ข้ามฉบับร่าง) และตัวที่ throw ไปแล้วด้วย · และ setStatus บรรทัดล่างก็ทับคำเตือนบรรทัดบนทันที
  let skipped = 0, ok = 0; const failed = [];
  for (const it of list) {
    // ย้ายข้ามฉบับร่างไม่ได้ (ทะเบียนฉากเป็นคนละไฟล์) — บอกให้รู้ ไม่ใช่เงียบ
    if (it.dPath !== dst.dPath) { skipped++; continue; }
    try { if ((await moveSceneToChapter(it.dPath, it.ch, it.sc, dst.chapter)) !== false) ok++; }   // [alpha.160 · P0-2]
    catch (e) { failed.push(it.sc?.title || ''); log('warn', tt('ui.tree.moveFail'), e); }
  }
  await buildTree();
  setStatus(ttf('ui.tree.movedN', ok, dst.chapter.title)
            + (skipped ? ' · ' + ttf('ui.tree.skipCrossDraft', skipped) : '')
            + (failed.length ? ' · ' + ttf('ui.tree.failedN', failed.length) : ''));
  return ok;
}
/** บทที่ควรใช้เป็นเป้าหมายของ "วาง" — บทของแถวที่เลือกล่าสุด */
function treePasteTarget() {
  const rows = treeRows();
  for (const r of rows) if (treeSel.has(r.dataset.path) && r._ctx) return r._ctx;
  return null;
}

// ───────── [alpha.120 ข้อ 11+16] คีย์ลัดในต้นไม้ + เมนูคลิกขวาบน "พื้นที่ว่าง" ─────────
//
// คีย์ลัดทำงาน **เฉพาะเมื่อโฟกัสอยู่ในแผงโปรเจกต์** — ไม่งั้นจะไปแย่ง Ctrl+C/V ของตัวแก้ไข
// (`#tree` ได้ tabindex เพื่อรับโฟกัสได้จริง · Ctrl/Shift+คลิกจะโฟกัสให้เอง)
export function setupTreeInteractions() {
  const tree = $('#tree');
  if (!tree || tree.dataset.k2wired) return false;
  tree.dataset.k2wired = '1';
  tree.tabIndex = 0;
  tree.addEventListener('mousedown', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) tree.focus({ preventScroll: true });
    // คลิกพื้นที่ว่าง = ล้างการเลือก (เหมือน Explorer)
    if (e.target === tree) clearTreeSel();
  });
  tree.addEventListener('keydown', async (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.code === 'KeyC') { e.preventDefault(); treeCopy(null, 'copy'); return; }
    if (ctrl && e.code === 'KeyX') { e.preventDefault(); treeCopy(null, 'cut'); return; }
    if (ctrl && e.code === 'KeyD') { e.preventDefault(); await treeDuplicate(null); return; }
    if (ctrl && e.code === 'KeyA') {
      e.preventDefault();
      treeSel.clear();
      for (const r of treeRows()) treeSel.add(r.dataset.path);
      paintTreeSel(); setStatus(ttf('ui.tree.selectedCount', treeSel.size)); return;
    }
    if (ctrl && e.code === 'KeyV') {
      e.preventDefault();
      const t = treePasteTarget();
      if (t) await treePaste(t.dPath, t.ch);
      else {
        const dst = await pickDraftTarget({ title: tt('ui.tree.pasteWhere') });
        if (dst && dst.chapter) await treePaste(dst.dPath, dst.chapter);
      }
      return;
    }
    if (e.code === 'Delete') { e.preventDefault(); await treeDeleteSelected(null); return; }
    if (e.code === 'Escape') { clearTreeSel(); return; }
    // ══ [alpha.161 · K1] นำทางด้วยคีย์บอร์ด (roving tabindex) — ตัวดักของ #tree เอง ไม่ใช่ document (กฎข้อ 8) ══
    if (e.target && e.target.classList && e.target.classList.contains('k-row-rename')) return;   // กำลังพิมพ์ชื่อใหม่
    if (!ctrl && !e.altKey && (e.code === 'ArrowDown' || e.code === 'ArrowUp')) {
      e.preventDefault(); treeFocusStep(e.code === 'ArrowDown' ? 1 : -1); return;
    }
    if (!ctrl && !e.altKey && (e.code === 'Home' || e.code === 'End')) {
      const rows = treeNavRows(); e.preventDefault();
      if (rows.length) treeFocusRow(e.code === 'Home' ? rows[0] : rows[rows.length - 1]);
      return;
    }
    const cur = treeFocusedRow();
    if (!cur) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); cur.click(); return; }
    if (e.code === 'F2' && !ctrl) { e.preventDefault(); treeRenameInline(cur); return; }
    if ((e.code === 'F10' && e.shiftKey) || e.code === 'ContextMenu') {
      e.preventDefault();
      const r = cur.getBoundingClientRect();
      cur.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
        clientX: Math.round(r.left + Math.min(40, r.width / 2)), clientY: Math.round(r.top + r.height / 2) }));
    }
  });
  // คลิกแถว = แถวนั้นเป็นจุดเริ่มของ ↑↓ (ไม่ดึงโฟกัสจากตัวแก้ไขที่เพิ่งเปิด)
  tree.addEventListener('click', (e) => {
    const row = e.target.closest && e.target.closest('.scene, .ch-title, .sec-title');
    if (row && tree.contains(row)) treeMarkRow(row);
  });
  // คลิกขวาบนพื้นที่ว่างของต้นไม้ (ไม่โดนแถวไหนเลย)
  tree.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.scene, .ch-title, .sec-title')) return;   // แถวมีเมนูของตัวเอง
    e.preventDefault();
    popupMenu(e.clientX, e.clientY, treeBlankMenu());
  });
  return true;
}

// ───────── [alpha.161 · K1] Explorer ด้วยคีย์บอร์ด ─────────
// แถวที่ "มองเห็นจริง" ตามลำดับบนจอ: หัวเล่ม · หัวบท · แถว (ไม่นับแถว "+ เพิ่ม" · แถวที่ตัวกรองซ่อน · อยู่ในก้อนที่พับ)
function treeNavRows() {
  const tree = $('#tree');
  if (!tree) return [];
  return [...tree.querySelectorAll('.sec-title, .ch-title, .scene')].filter((r) =>
    !r.classList.contains('add-row') && r.getClientRects().length > 0 && r.offsetParent !== null);
}
function treeFocusedRow() {
  const a = document.activeElement;
  const tree = $('#tree');
  if (a && tree && tree.contains(a) && a !== tree && a.matches && a.matches('.sec-title, .ch-title, .scene')) return a;
  return tree ? tree.querySelector('[data-k2-roving="1"]') : null;
}
/** roving tabindex: แถวปัจจุบัน tabindex=0 ตัวเดียว ที่เหลือ -1 (Tab เข้า/ออกต้นไม้ทีเดียว ไม่ไล่ทุกแถว) */
function treeMarkRow(row) {
  const tree = $('#tree');
  if (!tree || !row) return;
  tree.querySelectorAll('[data-k2-roving]').forEach((r) => { if (r !== row) { r.tabIndex = -1; delete r.dataset.k2Roving; } });
  row.tabIndex = 0;
  row.dataset.k2Roving = '1';
}
export function treeFocusRow(row) {
  if (!row) return null;
  treeMarkRow(row);
  try { row.focus({ preventScroll: true }); } catch { row.focus(); }
  try { row.scrollIntoView({ block: 'nearest' }); } catch {}
  return row;
}
export function treeFocusStep(dir) {
  const rows = treeNavRows();
  if (!rows.length) return null;
  const cur = treeFocusedRow();
  const i = cur ? rows.indexOf(cur) : -1;
  const j = i < 0 ? (dir > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + dir));
  return treeFocusRow(rows[j]);
}
/**
 * [alpha.161 · K1] F2 = เปลี่ยนชื่อ "ในแถว" (พฤติกรรมเดียวกับช่องชื่อในแผงคุณสมบัติ: Enter/เสียโฟกัส = บันทึก · Esc = ยกเลิก)
 * ฉากเท่านั้น (ใช้ setSceneTitle ตัวเดียวกับทุกทาง) · แถวชนิดอื่นใช้กล่องเปลี่ยนชื่อเดิมจากเมนู
 */
export function treeRenameInline(row) {
  const c = row && row._ctx;
  if (!row || !row._scene || !c || !c.sc) {
    // [alpha.162 · W4 ข้อ 10] ชนิดอื่น (เล่ม · บท · Memo · รูป) = รายการ "เปลี่ยนชื่อ" ของเมนูแถวนั้นเอง
    // ทางเดียวกับคลิกขวา → เขียนไฟล์ผ่านตัวเดิมทุกตัว ไม่มีทางเปลี่ยนชื่อสายที่สอง
    if (treeRowAction(row, 'rename')) return true;
    setStatus(tt('ui.tree.renameInlineSceneOnly')); return false;
  }
  if (row.querySelector('.k-row-rename')) return true;
  const old = c.sc.title || '';
  const inp = el('input', 'k-row-rename props-name-input');
  inp.value = old;
  inp.setAttribute('aria-label', tt('ui.props.renameHint'));
  const kids = [...row.childNodes];
  const hold = document.createDocumentFragment();
  kids.forEach((n) => hold.appendChild(n));
  row.appendChild(inp);
  row.draggable = false;
  let done = false;
  const restore = () => { if (inp.isConnected) inp.remove(); row.appendChild(hold); row.draggable = true; };
  const commit = async (save) => {
    if (done) return; done = true;
    const v = inp.value.trim();
    restore();
    if (save && v && v !== old) {
      await setSceneTitle(c.dPath, c.ch, c.sc, v);
      setTimeout(() => { const r2 = [...document.querySelectorAll('#tree .scene[data-path]')].find((x) => x.dataset.path === row.dataset.path); if (r2) treeFocusRow(r2); }, 0);
    } else treeFocusRow(row);
  };
  inp.addEventListener('keydown', (ev) => {
    ev.stopPropagation();                               // ไม่ให้ตัวดักของต้นไม้/คีย์ลัดกลางกินปุ่มที่พิมพ์
    if (ev.key === 'Enter') { ev.preventDefault(); commit(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); commit(false); }
  });
  inp.addEventListener('blur', () => commit(true));
  inp.addEventListener('click', (ev) => ev.stopPropagation());
  inp.addEventListener('mousedown', (ev) => ev.stopPropagation());
  inp.focus(); inp.select();
  return true;
}

/** เมนู "พื้นที่ว่าง" = [alpha.155] เมนูของโปรเจกต์ (หัวข้อ 0. Project ในรายการของผู้ใช้) */
function treeBlankMenu() {
  return buildMenuItems('project', (id) => treeMenuItem('project', id, { title: state.title || '' }, null));
}

// ═══════════════════ [alpha.155] เมนูคลิกขวาของ Explorer ═══════════════════
//
// ผู้ใช้ส่งรายการเมนูครบทุกชนิดแถวมา → ลำดับอยู่ใน tree-menu-spec.js (มี unit test ยึดไว้)
// ที่นี่ตอบแค่ว่า "รายการนี้ของแถวชนิดนี้ทำอะไร" · ของเดิมที่มีอยู่แล้วเรียกตัวเดิม ของใหม่อยู่ใน tree-actions.js
// ctx.lockSrc = ชั้นที่ล็อกของชิ้นนี้ ('' | 'book' | 'chapter' | 'scene' | 'item') — รายการใน LOCK_BLOCKED
// กดแล้วบอกว่าต้องไปปลดล็อกที่ไหน แทนที่จะทำงาน
export function showTreeMenu(e, kind, ctx) {
  e.preventDefault(); if (e.stopPropagation) e.stopPropagation();
  popupMenu(e.clientX, e.clientY, buildMenuItems(kind, (id) => subMenuItem(id, treeMenuItem(kind, id, ctx, e))));
}

/**
 * ══ [alpha.162 · W4 ข้อ 10] ★ แถวต้องบอกได้ว่าตัวเองเป็นชนิดไหน ไม่ใช่รู้แค่ตอนคลิกขวา ══
 *
 * เดิม "ชนิดแถว + บริบท" มีชีวิตอยู่แค่ในคลอเชอร์ของ `oncontextmenu` — ทางอื่นที่อยากทำสิ่ง
 * เดียวกับเมนู (F2 เปลี่ยนชื่อ · คัดลอกที่อยู่ · เมนูที่เปิดด้วยคีย์บอร์ด) จึงเอื้อมไม่ถึงเลย
 * ผลคือ F2 ใช้ได้กับ "ฉาก" ชนิดเดียวมาตลอด เพราะเป็นชนิดเดียวที่ฝาก `_scene` ไว้บนแถว
 *
 * ผูกผ่านตัวนี้แล้วแถวจะพก `_k2row = { kind, ctx }` ติดตัว — ของที่เพิ่มทีหลังได้ทุกชนิดฟรี
 * @param {HTMLElement} row · @param {string} kind ชนิดใน TREE_MENU_SPEC · @param {object} ctx
 * @param {(e:MouseEvent)=>boolean} [before] คืน true = จัดการเองแล้ว ไม่ต้องเปิดเมนูมาตรฐาน
 */
export function bindTreeMenu(row, kind, ctx, before) {
  if (!row) return row;
  row._k2row = { kind, ctx };
  row.oncontextmenu = (e) => {
    if (before && before(e)) return;
    showTreeMenu(e, kind, ctx);
  };
  return row;
}

/** สั่งงานรายการเมนูของแถวนั้นจากทางอื่น (คีย์บอร์ด/ปุ่ม) — คืน false เมื่อแถวนั้นไม่มีรายการนี้ */
export function treeRowAction(row, id) {
  const r = row && row._k2row;
  if (!r) return false;
  const item = treeMenuItem(r.kind, id, r.ctx, null);
  if (!item || typeof item.click !== 'function') return false;
  item.click();
  return true;
}

// [alpha.157] รายการที่ "มีต่อ" เปิดเมนูลูกด้วย hover — ตัวที่เปิดเมนูเองถูกดักรายการผ่าน menuItemsOf()
const TREE_SUB_IDS = new Set(['color', 'status', 'move', 'visual', 'restore']);
function subMenuItem(id, item) {
  if (!item || !TREE_SUB_IDS.has(id) || typeof item.click !== 'function') return item;
  const click = item.click;
  return { label: item.label, sub: () => menuItemsOf(click) };
}

/**
 * [alpha.162 · W5 ข้อ 4] เมนูของปุ่ม AI — ประกอบจาก **ปุ่มจริงทั้งห้า** บนแถบ (ซ่อนอยู่เป็นค่าเริ่มต้น)
 * ป้าย = คีย์ภาษาของปุ่มนั้น · คีย์ลัด = คำสั่งของปุ่มนั้น · ติ๊กถูก = ปุ่มนั้นติด `.on` (แผงเปิดอยู่)
 * กดรายการ = `click()` ปุ่มจริง → ทางเดียวกับที่เคยกดบนแถบทุกประการ (ไม่มีตรรกะซ้อนสองชุด)
 */
export function aiMenuItems() {
  refreshToolbar();
  const items = [];
  for (const id of AI_GROUP_IDS) {
    const b = document.getElementById(id);
    if (!b) continue;
    const key = b.getAttribute('data-i18n-title');
    const item = { label: tt(key), cmd: b.dataset.command || '', click: () => b.click() };
    if (b.classList.contains('tb-toggle')) item.checked = b.classList.contains('on');
    items.push(item);
  }
  return items;
}
function openAiMenu() {
  const g = $('#tb-ai-group');
  const r = g && g.offsetParent !== null ? g.getBoundingClientRect() : null;
  popupMenu(r ? r.left : Math.round(window.innerWidth / 2), r ? r.bottom + 2 : 60, aiMenuItems());
}

/** [alpha.162 · W4 ข้อ 10] วางเล่ม `srcPath` ลงตำแหน่งของเล่ม `dstPath` (ตัวจริงของการลากหัวเล่ม) */
export async function dropBookOn(srcPath, dstPath) {
  const secs = await listSections();
  const to = secs.findIndex((s) => s.secPath === dstPath);
  const from = secs.find((s) => s.secPath === srcPath);
  if (to < 0 || !from || srcPath === dstPath) return false;
  if (from.meta && from.meta.locked) { setStatus(TA.lockMessage('book')); return false; }
  return TA.moveSectionTo(srcPath, to + 1, secs);
}

/** [alpha.162 · W4 ข้อ 10] คัดลอกที่อยู่ไฟล์/โฟลเดอร์จริงบนดิสก์ของแถวใน Explorer */
async function copyItemPath(p) {
  if (!p) return false;
  try { await navigator.clipboard.writeText(String(p)); setStatus(ttf('ui.tabs.pathCopied', p)); return true; }
  catch (e) { log('warn', 'copy path', e); setStatusError(failText(tt('ui.treeMenu.copyPath'), e)); return false; }
}

function treeMenuItem(kind, id, c, e) {
  const guard = (fn) => (LOCK_BLOCKED.has(id) && c.lockSrc ? () => setStatus(TA.lockMessage(c.lockSrc)) : fn);
  const it = (fn, on = false) => ({ label: tt(menuLabelKey(id, on)), click: guard(fn) });
  const free = (fn, on = false) => ({ label: tt(menuLabelKey(id, on)), click: fn });   // ไม่สนล็อก
  const pos = () => ({ clientX: e ? e.clientX : 80, clientY: e ? e.clientY : 80 });
  const title = c.title || '';
  const say = (key) => setStatus(ttf(key, title));
  // [alpha.162 · W4 ข้อ 10] ของต้นไม้ทั้งต้น ไม่ขึ้นกับชนิดแถว
  if (id === 'expandAll') return free(() => setAllTreeCollapsed(false));
  if (id === 'collapseAll') return free(() => setAllTreeCollapsed(true));
  if (id === 'refresh') return free(async () => { await buildTree(); setStatus(tt('ui.treeMenu.refreshed')); });
  switch (kind) {
    case 'project': switch (id) {
      case 'addBook': return it(() => addSection());
      case 'renameProject': return it(() => TA.renameProject());
      case 'quickOpen': return it(() => handleCommand('quick-open'));
      case 'searchProject': return it(() => handleCommand('global-search'));
      case 'dashboard': return it(() => openDashboard());
      case 'kanban': return it(() => handleCommand('kanban'));
      case 'journal': return it(async () => { showPanel('record'); await renderFeaturePanel('record'); syncMenuToggles(); });
      case 'play': return it(() => handleCommand('player-mode'));
      case 'playerHistory': return it(() => showPlayerHistory());
      case 'branchPanel': return it(() => openBranchingTree());
      case 'projectSettings': return it(() => settingsDialog());
      case 'aiSettings': return it(() => handleCommand('ai-settings'));
      case 'reveal': return it(() => kapi.revealInOS(state.root));
      case 'copyPath': return free(() => copyItemPath(state.root));
    } return null;

    case 'book': {
      const { secPath, sec } = c;
      const key = sec.guid || secPath.split(/[\\/]/).pop();
      switch (id) {
        case 'addBook': return free(() => addSection());
        case 'rename': return it(() => renameSection(secPath, sec));
        case 'reorder': return it(() => TA.reorderSectionPrompt(secPath));
        case 'addChapter': return it(() => addChapterToSection(secPath));
        case 'duplicate': return it(() => TA.duplicateSection(secPath));
        case 'star': return it(async () => { await TA.setSectionFields(secPath, { flag: !sec.flag });
          say(sec.flag ? 'ui.treeAct.starOff' : 'ui.treeAct.starOn'); }, !!sec.flag);
        case 'manageBooks': return it(() => openBookManager());
        case 'manageChapters': return it(() => openChapterManager(secPath));
        case 'searchIn': return it(() => setTreeScope({ sec: secPath.split(/[\\/]/).pop(), label: title }));
        case 'readBook': return it(() => openBookReader(secPath));
        // [alpha.159] หน้ารายชื่อตัวละครเป็นของเล่ม (<Section>/roster.json) · หน้าปกเป็นของโปรเจกต์
        case 'castOfCharacters': return free(() => openRoster(secPath, title));
        case 'titlePage': return free(() => openTitlePageDialog());
        case 'quickNote': return it(() => quickNote(TA.noteIdOf('book', c), title));
        case 'viewQuickNotes': return it(async () => showAllNotes({ ids: await TA.bookNoteIds(secPath, sec), title }));
        case 'propsPopup': return it(() => sectionProps(secPath, sec));
        case 'propsPanel': return it(() => openItemPropsPanel('book', c));
        case 'reveal': return it(() => kapi.revealInOS(secPath));
        case 'copyPath': return free(() => copyItemPath(secPath));
        case 'color': return it(() => TA.colorMenu(pos(), sec.color || '', (v) => TA.setSectionFields(secPath, { color: v })));
        case 'status': return it(() => TA.statusMenu(pos(), TA.bookStatusOptions(), sec.status || '',
          (v) => TA.setSectionFields(secPath, { status: v })));
        case 'pin': return it(() => TA.togglePinItem('book', key, { title }), TA.pinned('book', key));
        case 'lock': return it(async () => { await TA.setSectionFields(secPath, { locked: !sec.locked });
          say(sec.locked ? 'ui.treeAct.lockOff' : 'ui.treeAct.lockOn'); }, !!sec.locked);
        case 'backup': return it(() => TA.backupItem('book', c));
        case 'restore': return it(() => TA.restoreItemMenu(pos(), 'book', c));
        case 'delete': return it(() => deleteSection(secPath, sec));
      } return null;
    }

    case 'chapter': {
      const { dPath, ch, secPath } = c;
      const folder = () => kapi.join(dPath, 'Chapters', ch.folderName);
      switch (id) {
        case 'addChapter': return it(() => addChapter(dPath));
        case 'bookFromChapter': return it(() => TA.bookFromChapter(dPath, ch));
        case 'visual': return it(() => chapterVisualMenu(pos(), dPath, ch));
        case 'rename': return it(() => renameChapter(dPath, ch));
        case 'reorder': return it(() => TA.reorderChapterPrompt(dPath, ch));
        case 'addScene': return it(() => addScene(dPath, ch));
        case 'copy': return it(() => TA.clipCopy('chapter', { dPath, guid: ch.guid, title: ch.title }, ch.title));
        // วางบทที่คัดลอกไว้ต่อจากบทนี้ · ถ้าคัดลอกฉากไว้ = วางฉากลงบทนี้ (ทางเดิมของ Ctrl+V)
        case 'paste': return it(async () => {
          if (TA.clipOf('chapter')) return TA.pasteChapter(dPath, ch);
          if (treeClip.items.length) return treePaste(dPath, ch);
          setStatus(tt('ui.treeAct.clipEmpty'));
        });
        case 'duplicate': return it(() => TA.duplicateChapter(dPath, ch));
        case 'move': return it(() => TA.moveChapterMenu(pos(), dPath, ch));
        case 'star': return it(async () => { await TA.setChapterFields(dPath, ch.guid, { isFavorite: !ch.isFavorite });
          say(ch.isFavorite ? 'ui.treeAct.starOff' : 'ui.treeAct.starOn'); }, !!ch.isFavorite);
        case 'manageChapters': return it(() => openChapterManager(secPath));
        case 'manageScenes': return it(() => openSceneTable());
        case 'searchIn': return it(() => setTreeScope({ guid: ch.guid, label: ch.title }));
        case 'readChapter': return it(() => openBookReader(secPath, { chapterGuid: ch.guid }));
        case 'readBook': return it(() => openBookReader(secPath));
        case 'propsPopup': return it(() => chapterProps(dPath, ch));
        case 'propsPanel': return it(() => openItemPropsPanel('chapter', c));
        case 'reveal': return it(async () => kapi.revealInOS(await folder()));
        case 'copyPath': return free(async () => copyItemPath(await folder()));
        case 'color': return it(() => TA.colorMenu(pos(), ch.color || '', (v) => TA.setChapterFields(dPath, ch.guid, { color: v })));
        case 'status': return it(() => TA.statusMenu(pos(), TA.sceneStatusOptions(), ch.status || '',
          (v) => TA.setChapterFields(dPath, ch.guid, { status: v || 'Outline' }), '', statusColor));
        case 'pin': return it(async () => TA.togglePinItem('chapter', ch.guid, { title, dRel: await TA.relOf(dPath) }),
          TA.pinned('chapter', ch.guid));
        case 'lock': return it(async () => { await TA.setChapterFields(dPath, ch.guid, { locked: !ch.locked });
          say(ch.locked ? 'ui.treeAct.lockOff' : 'ui.treeAct.lockOn'); }, !!ch.locked);
        case 'backup': return it(() => TA.backupItem('chapter', c));
        case 'restore': return it(() => TA.restoreItemMenu(pos(), 'chapter', c));
        case 'delete': return it(() => deleteChapter(dPath, ch));
      } return null;
    }

    case 'scene': {
      const { dPath, ch, sc, file } = c;
      switch (id) {
        case 'open': return free(() => c.open());
        case 'addScene': return it(() => addScene(dPath, ch));
        case 'addChapter': return it(() => addChapter(dPath));
        case 'chapterFromScenes': return it(() => {
          const sel = treeSelCtx();
          return TA.chapterFromScenes(dPath, ch, sel.length ? sel : [{ dPath, ch, sc }]);
        });
        case 'rename': return it(() => renameScene(dPath, ch, sc));
        case 'reorder': return it(() => TA.reorderScenePrompt(dPath, ch, sc));
        case 'switchFormat': return it(async () => { await openScene(file, sc.title); await handleCommand('toggle-format'); });
        case 'copy': return free(() => treeCopy([{ dPath, ch, sc, file }], 'copy'));
        case 'paste': return it(() => treePaste(dPath, ch));
        case 'duplicate': return free(() => duplicateScene(dPath, ch, sc));
        case 'moveUp': return it(() => moveSceneOrder(dPath, ch, sc, -1));
        case 'moveDown': return it(() => moveSceneOrder(dPath, ch, sc, 1));
        case 'move': return it(() => sceneMoveMenu(pos(), dPath, ch, sc));
        case 'star': return free(() => toggleSceneFlag(dPath, ch, sc), !!sc.flag);
        case 'quickNote': return free(() => quickNote(sc.id, sc.title));
        case 'comment': return free(async () => { setPropsTarget(dPath, ch, sc); await openScene(file, sc.title); await openCommentsPanel(); });
        case 'readScene': return free(async () => { await openScene(file, sc.title); toggleReading(true); });
        case 'propsPopup': return free(() => sceneProps(dPath, ch, sc));
        case 'propsPanel': return free(() => openPropsPanel(dPath, ch, sc));
        case 'reveal': return free(() => revealFile(file));
        case 'copyPath': return free(() => copyItemPath(file));
        case 'color': return free(() => TA.colorMenu(pos(), sc.color || '', (v) => setSceneMeta(dPath, ch, sc, { color: v })));
        case 'status': return free(() => TA.statusMenu(pos(), TA.sceneStatusOptions(), sc.status || '',
          (v) => setSceneMeta(dPath, ch, sc, { status: v || 'Outline' }), '', statusColor));
        case 'pin': return free(async () => TA.togglePinItem('scene', sc.id, { title, dRel: await TA.relOf(dPath) }),
          TA.pinned('scene', sc.id));
        // [alpha.164] ฉากมีปัญหา — ติดธง (ยังไม่ติด) · สลับฉบับ + เมนูย่อย (ติดแล้ว)
        case 'problem': return isProblemScene(sc.id) ? null : free(() => markSceneProblem({ sc, file }));
        case 'problemToggle': {
          if (!isProblemScene(sc.id)) return null;
          const orig = onsetViewOf(file) === 'original';
          return { label: tt(orig ? 'ui.onset.toRevised' : 'ui.onset.toOriginal'), cmd: 'onset-toggle',
                   click: async () => {
                     await openScene(file, sc.title);
                     const tb = state.tabs.get(file);
                     if (tb) { await applyOnsetToTab(tb); toggleOnsetView(tb); }
                   } };
        }
        case 'problemMenu': return isProblemScene(sc.id)
          ? { label: tt('ui.treeMenu.problemMenu'), sub: () => onsetMenuItems(state.tabs.get(file) || null, { sc }) }
          : null;
        case 'saveVersion': return free(() => manualSnapshot(dPath, ch, sc));
        case 'versionHistory': return free(() => versionDialog(dPath, ch, sc));
        case 'compareVersion': return free(() => compareVersionsDialog(dPath, ch, sc));
        case 'splitView': return free(() => openCompareRight(file, sc.title));
        // แถวที่เป็น "โน้ตในบท" แบบเก่า (type: memo) — ทางกลับต้องยังมี ไม่งั้นข้อมูลเดิมติดค้าง
        case 'toMemo': return c.isMemoRow
          ? { label: tt('ui.treeAct.backNormalScene'), click: guard(() => setRowMemo(dPath, ch, sc, false)) }
          : it(() => moveRowToMemos(dPath, ch, sc));
        case 'lock': return free(() => setSceneLock(dPath, ch, sc, !sc.locked), !!sc.locked);
        case 'backup': return free(() => TA.backupItem('scene', c));
        case 'restore': return it(() => TA.restoreItemMenu(pos(), 'scene', c));
        case 'delete': return it(() => deleteScene(dPath, ch, sc));
      } return null;
    }

    case 'memoHead': switch (id) {
      case 'open': return it(() => c.expand && c.expand());
      case 'addMemo': return it(() => addMemo());
      case 'reveal': return it(() => kapi.revealInOS(c.dir));
    } return null;

    case 'memo': {
      const { file, meta, rel } = c;
      const flag = TA.isMemoFlag(meta.flag), locked = TA.isMemoFlag(meta.locked);
      switch (id) {
        case 'open': return free(() => openScene(file, title));
        case 'addMemo': return free(() => addMemo());
        case 'sceneFromMemo': return free(async () => {
          const dst = await pickDraftTarget({ title: tt('ui.treeAct.sceneFromMemoTitle') });
          if (dst && dst.chapter) await TA.sceneFromMemo(file, dst);
        });
        case 'rename': return it(() => renameMemo(file));
        case 'copy': return free(() => TA.clipCopy('memo', { file, title }, title));
        case 'paste': return free(() => TA.pasteMemo());
        case 'duplicate': return free(() => TA.duplicateMemo(file));
        case 'moveUp': return it(() => TA.moveMemoStep(file, -1));
        case 'moveDown': return it(() => TA.moveMemoStep(file, 1));
        case 'move': return it(async () => {
          const dst = await pickDraftTarget({ title: tt('ui.app.moveNoteBackIn') });
          if (dst && dst.chapter) await moveMemoToChapter(file, dst.dPath, dst.chapter);
        });
        case 'star': return free(async () => { await TA.setMemoFields(file, { flag: !flag });
          say(flag ? 'ui.treeAct.starOff' : 'ui.treeAct.starOn'); }, flag);
        case 'quickNote': return free(() => quickNote(TA.noteIdOf('memo', c), title));
        case 'comment': return free(async () => { await openScene(file, title); await openCommentsPanel(); });
        case 'propsPopup': return free(() => TA.itemPropsDialog('memo', c));
        case 'propsPanel': return free(() => openItemPropsPanel('memo', c));
        case 'reveal': return free(() => revealFile(file));
        case 'copyPath': return free(() => copyItemPath(file));
        case 'color': return free(() => TA.colorMenu(pos(), meta.color || '', (v) => TA.setMemoFields(file, { color: v })));
        case 'status': return free(() => TA.statusMenu(pos(), TA.sceneStatusOptions(), meta.status || '',
          (v) => TA.setMemoFields(file, { status: v }), '', statusColor));
        case 'pin': return free(() => TA.togglePinItem('memo', rel, { title }), TA.pinned('memo', rel));
        case 'saveVersion': return free(() => manualFileSnapshot(file));
        case 'versionHistory': return free(async () => {
          const { fileVersionDialog } = await import('./dialogs.js');
          await fileVersionDialog(file, title, { onRestored: async () => { closeTab(file); await buildTree(); } });
        });
        case 'compareVersion': return free(() => compareFileVersionsDialog(file, title));
        case 'splitView': return free(() => openCompareRight(file, title));
        case 'lock': return free(async () => { await TA.setMemoFields(file, { locked: !locked });
          say(locked ? 'ui.treeAct.lockOff' : 'ui.treeAct.lockOn'); }, locked);
        case 'backup': return free(() => TA.backupItem('memo', c));
        case 'restore': return it(() => TA.restoreItemMenu(pos(), 'memo', c));
        case 'delete': return it(async () => { if (await deleteToTrash(file, title)) await TA.explorerForget(file); });
      } return null;
    }

    case 'galleryHead': switch (id) {
      case 'openGallery': return it(() => openGallery());
      case 'addAlbum': return it(() => galleryCommand('gallery-new-album'));
      case 'importImage': return it(() => importImageToLibrary());
      case 'moodBoard': return it(() => galleryCommand('gallery-board'));
      case 'reveal': return it(() => kapi.revealInOS(c.dir));
    } return null;

    case 'image': {
      const { abs, im } = c;
      switch (id) {
        case 'view': return it(async () => imageLightbox(await kapi.toFileURL(abs), im.caption || im.file));
        case 'insert': return it(() => insertImageByName(im.path, im.caption));
        case 'rename': return it(() => TA.renameImage(abs, im));
        case 'copy': return it(() => TA.clipCopy('image', { abs, im }, im.file));
        case 'paste': return it(() => TA.pasteImage(im.album));
        case 'duplicate': return it(async () => { const n = await TA.copyImageInto(abs, im, im.album);
          if (n) setStatus(ttf('ui.treeAct.duplicated', n)); });
        case 'propsPopup': return it(() => TA.itemPropsDialog('image', c));
        case 'propsPanel': return it(() => openItemPropsPanel('image', c));
        case 'reveal': return it(() => revealFile(abs));
        case 'copyPath': return free(() => copyItemPath(abs));
        case 'delete': return it(async () => { if (await deleteToTrash(abs, im.file)) await TA.explorerForget(abs); });
      } return null;
    }

    case 'plannerHead': switch (id) {
      case 'addBoard': return it(() => newPlannerBoard());
      case 'openPlannerPanel': return it(() => openPlanner());
      case 'reveal': return it(async () => kapi.revealInOS(await kapi.join(state.root, 'Planners')));
    } return null;

    case 'board': {
      const { path, b, meta, rel } = c;
      switch (id) {
        case 'open': return free(() => openPlanner(path));
        case 'addBoard': return free(() => newPlannerBoard());
        case 'rename': return it(async () => { const dst = await renamePlannerBoard(b); if (dst) await TA.explorerRenamed(path, dst); });
        case 'copy': return free(() => TA.clipCopy('board', { path, name: b.name }, b.name));
        case 'paste': return free(async () => {
          const src = TA.clipOf('board');
          if (!src || !(await kapi.exists(src.path))) { setStatus(tt('ui.treeAct.clipEmpty')); return; }
          await duplicatePlannerBoard({ path: src.path, name: src.name });
        });
        case 'duplicate': return free(() => duplicatePlannerBoard(b));
        case 'star': return free(async () => { await TA.setItemFields(path, { flag: !meta.flag });
          say(meta.flag ? 'ui.treeAct.starOff' : 'ui.treeAct.starOn'); }, !!meta.flag);
        case 'propsPopup': return free(() => TA.itemPropsDialog('board', c));
        case 'propsPanel': return free(() => openItemPropsPanel('board', c));
        case 'reveal': return free(() => revealFile(path));
        case 'copyPath': return free(() => copyItemPath(path));
        case 'color': return free(() => TA.colorMenu(pos(), meta.color || '', (v) => TA.setItemFields(path, { color: v })));
        case 'status': return free(() => TA.statusMenu(pos(), TA.sceneStatusOptions(), meta.status || '',
          (v) => TA.setItemFields(path, { status: v }), '', statusColor));
        case 'pin': return free(() => TA.togglePinItem('board', rel, { title }), TA.pinned('board', rel));
        case 'lock': return free(async () => {
          await TA.setItemFields(path, { locked: !meta.locked });
          if (plannerInst && plannerInst.data && plannerInst.data.getPath() === path) plannerInst.setBoardLocked(!meta.locked);
          say(meta.locked ? 'ui.treeAct.lockOff' : 'ui.treeAct.lockOn');
        }, !!meta.locked);
        case 'delete': return it(async () => {
          if (await deleteToTrash(path, b.name)) await TA.explorerForget(path);
          await buildTree();
        });
      } return null;
    }

    case 'branchHead': switch (id) {
      case 'openBranchPanel': return it(() => openBranchingTree());
      case 'addPlan': return it(() => newBranchPlanFromTree());
      case 'reveal': return it(async () => kapi.revealInOS(await kapi.join(state.root, 'Branches')));
    } return null;

    case 'plan': {
      const { path, p, meta, rel } = c;
      const openThis = async () => {
        const m = await import('./branching-ui.js');
        const cur = m.currentBranchPlan();
        if (!cur || cur.path !== path) await m.openBranchPlan(path);
        return m;
      };
      switch (id) {
        case 'open': return free(async () => { await openThis(); await openBranchingTree(); await refreshTreeQueued(); });
        case 'addPlan': return free(() => newBranchPlanFromTree());
        case 'rename': return it(() => renameBranchPlanFromTree(p));
        case 'copy': return free(() => TA.clipCopy('plan', { path, name: p.name }, p.name));
        case 'paste': return free(async () => {
          const src = TA.clipOf('plan');
          if (!src || !(await kapi.exists(src.path))) { setStatus(tt('ui.treeAct.clipEmpty')); return; }
          await TA.duplicatePlan(src.path);
        });
        case 'duplicate': return free(() => TA.duplicatePlan(path));
        case 'star': return free(async () => { await TA.setItemFields(path, { flag: !meta.flag });
          say(meta.flag ? 'ui.treeAct.starOff' : 'ui.treeAct.starOn'); }, !!meta.flag);
        case 'propsPopup': return free(async () => { const m = await openThis(); await m.planPropsDialog(); await refreshTreeQueued(); });
        case 'propsPanel': return free(() => openItemPropsPanel('plan', c));
        case 'reveal': return free(() => revealFile(path));
        case 'copyPath': return free(() => copyItemPath(path));
        case 'color': return free(() => TA.colorMenu(pos(), p.plan.color || '', (v) => TA.setPlanFileFields(path, { color: v })));
        case 'status': return free(async () => TA.statusMenu(pos(), await TA.planStatusOptions(), p.plan.status || '',
          (v) => TA.setPlanFileFields(path, { status: v })));
        case 'pin': return free(() => TA.togglePinItem('plan', rel, { title }), TA.pinned('plan', rel));
        case 'compare': return free(async () => { const m = await openThis(); await m.comparePlanDialog(); });
        case 'lock': return free(async () => {
          await TA.setItemFields(path, { locked: !meta.locked });
          const m = await import('./branching-ui.js');
          const cur = m.currentBranchPlan();
          if (cur && cur.path === path) m.setPlanLocked(!meta.locked);
          say(meta.locked ? 'ui.treeAct.lockOff' : 'ui.treeAct.lockOn');
        }, !!meta.locked);
        case 'delete': return it(async () => {
          if (!(await deleteToTrash(path, p.name))) return;
          await TA.explorerForget(path);
          const m = await import('./branching-ui.js');
          const cur = m.currentBranchPlan();
          if (cur && cur.path === path) m.closeBranchPlan();
          await refreshTreeQueued();
        });
      } return null;
    }
  }
  return null;
}

/** "เล่าด้วยภาพ ▸" ของบท — ตารางเล่าด้วยภาพเป็นของฉาก จึงให้เลือกฉากในบทนี้ */
async function chapterVisualMenu(ev, dPath, ch) {
  let rows = [];
  try { rows = ((await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {})[ch.guid] || []; } catch {}
  const list = rows.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!list.length) { setStatus(tt('ui.treeAct.visualNone')); return; }
  const items = [];
  for (const r of list) {
    const f = await kapi.join(dPath, 'Chapters', ch.folderName, r.fileName);
    const has = await hasVis(f);
    items.push({ text: (has ? gi('film') + ' ' : '') + (r.title || ''),
                 click: () => (has ? openVisual(f, r.title) : createVisual(f, r.title)) });
  }
  popupMenu(ev.clientX, ev.clientY, items);
}

/** นำเข้ารูปเข้าคลัง (ปุ่ม + บนหัวหมวดคลังรูป และเมนู Import ใช้ตัวเดียวกัน) */
async function importImageToLibrary() {
  const src = await kapi.openImageDialog(); if (!src) return null;
  await kapi.mkdir(await kapi.join(state.root, 'Images'));
  const nm = await albumCore.addImageFile(kapi, state.root, albumCore.ROOT_ALBUM, src);
  await albumCore.syncFlatIndex(kapi, state.root);
  await buildTree(); setStatus(tt('ui.app.addImageInLibrary2') + nm);
  return nm;
}

/** สร้างแผนแตกสายใหม่ (ปุ่ม + บนหัวหมวด และเมนูของหัวหมวด/แถวแผน ใช้ตัวเดียวกัน) */
async function newBranchPlanFromTree() {
  const { listBranchPlans, saveBranchPlanAs } = await import('./branching-ui.js');
  const plans = await listBranchPlans();
  const v = await ask(tt('ui.common.nameNewPlan'), { value: tt('ui.common.map2') + (plans.length + 1), okLabel: tt('ui.common.new') });
  if (!v) return null;
  const p = await saveBranchPlanAs(v);
  await refreshTreeQueued();
  await openBranchingTree();
  return p;
}

async function renameBranchPlanFromTree(p) {
  const { currentBranchPlan, openBranchPlan } = await import('./branching-ui.js');
  const { safePlanName } = await import('./branch-plans.js');
  const v = await ask(tt('ui.common.namePlan'), { value: p.name }); if (!v) return null;
  const dir = await kapi.join(state.root, 'Branches');
  const dst = await kapi.join(dir, safePlanName(v) + '.json');
  if (await kapi.exists(dst)) { setStatus(tt('ui.app.plannedName')); return null; }
  const data = await kapi.readJson(p.path); data.name = v;
  await kapi.writeFile(dst, JSON.stringify(data, null, 2));
  await kapi.remove(p.path);
  await TA.explorerRenamed(p.path, dst);
  const cur = currentBranchPlan();
  if (cur && cur.path === p.path) await openBranchPlan(dst);
  await refreshTreeQueued(); setStatus(tt('ui.app.changeNamePlanDone'));
  return dst;
}

// ───────── [alpha.155] แถวชื่อโปรเจกต์ + หมวดปักหมุด (บนสุดของต้นไม้) ─────────
async function buildProjectHead(tree) {
  const head = el('div', 'tree-proj');
  head.append(icon('book-content', 14), ' ' + (state.title || ''));
  head.title = state.root || '';
  bindTreeMenu(head, 'project', { title: state.title || '' });
  tree.append(head);
  const pins = await TA.resolvePins();
  if (!pins.length) return;
  const sec = el('div', 'sec tree-pins');
  const h = el('div', 'sec-title', ttf('ui.treeAct.pinsHead', pins.length));
  sec.append(h);
  makeAccordion(h, sec, 'sec:__pins__');
  const ICON = { book: 'books', chapter: 'folder', scene: 'file', memo: 'note', image: 'image', board: 'clipboard', plan: 'branch' };
  for (const { pin, target } of pins) {
    const name = (target && target.title) || pin.title || pin.key;
    const row = el('div', 'scene pin-row' + (target ? '' : ' pin-missing'),
      gi(ICON[pin.kind] || 'pin') + ' ' + name + (target ? '' : ' ' + tt('ui.treeAct.pinMissing')));
    row.dataset.search = String(name).toLowerCase();
    row.title = name;
    row.onclick = () => { if (target) openPinTarget(pin, target); };
    row.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); popupMenu(e.clientX, e.clientY, [
      ...(target ? [{ label: tt('ui.treeMenu.open'), click: () => openPinTarget(pin, target) },
                    { label: tt('ui.treeAct.showInTree'), click: () => showPinInTree(pin, target) }] : []),
      { label: tt('ui.treeMenu.pinOff'), click: () => TA.togglePinItem(pin.kind, pin.key, { title: name }) },
      { label: tt('ui.treeMenu.reveal'), click: () => revealPinTarget(pin, target) },
    ]); };
    sec.append(row);
  }
  tree.append(sec);
}

async function openPinTarget(pin, t) {
  if (!t) return;
  if (pin.kind === 'scene') return openScene(t.file, t.title);
  if (pin.kind === 'memo') return openScene(t.abs, t.title);
  if (pin.kind === 'image') return imageLightbox(await kapi.toFileURL(t.abs), t.title);
  if (pin.kind === 'board') return openPlanner(t.abs);
  if (pin.kind === 'plan') {
    const m = await import('./branching-ui.js');
    await m.openBranchPlan(t.abs); await openBranchingTree(); await refreshTreeQueued();
    return;
  }
  return showPinInTree(pin, t);
}

/** กางหัวข้อที่ครอบแถวนั้นไว้ แล้วเลื่อนให้เห็น + กะพริบให้รู้ว่าอยู่ตรงไหน */
function showPinInTree(pin, t) {
  const tree = $('#tree'); if (!tree || !t) return false;
  let row = null;
  if (pin.kind === 'book') row = [...tree.querySelectorAll('.sec-title')].find((h) => h._ctx && h._ctx.secPath === t.secPath);
  else if (pin.kind === 'chapter') row = [...tree.querySelectorAll('.ch-title')].find((h) => h._ctx && h._ctx.ch && h._ctx.ch.guid === t.ch.guid);
  else {
    const p = t.file || t.abs;
    row = [...tree.querySelectorAll('.scene[data-path]')].find((r) => r.dataset.path === p && !r.classList.contains('pin-row'));
  }
  if (!row) return false;
  for (let box = row.parentElement; box && box !== tree; box = box.parentElement) {
    if (box.classList.contains('collapsed')) {
      const head = box.querySelector(':scope > .sec-title, :scope > .ch-title');
      const caret = head && head.querySelector('.tw');
      if (caret) caret.click(); else box.classList.remove('collapsed');
    }
  }
  row.scrollIntoView({ block: 'center' });
  row.classList.add('reveal-flash');
  setTimeout(() => row.classList.remove('reveal-flash'), 1600);
  return true;
}

async function revealPinTarget(pin, t) {
  if (!t) return kapi.revealInOS(state.root);
  if (pin.kind === 'book') return kapi.revealInOS(t.secPath);
  if (pin.kind === 'chapter') return kapi.revealInOS(await kapi.join(t.dPath, 'Chapters', t.ch.folderName));
  return revealFile(t.file || t.abs);
}

/** [alpha.120 ข้อ 13] ล้างถังขยะทั้งใบ (พร้อมไฟล์ใบกู้คืน/ตารางเล่าด้วยภาพที่ติดมาด้วย) */
export async function emptyRecycle(count) {
  if (!state.root) return 0;
  const recDir = await kapi.join(state.root, 'Recycle');
  if (!(await kapi.exists(recDir))) { setStatus(tt('ui.tree.trashEmptyAlready')); return 0; }
  const files = await kapi.listFiles(recDir).catch(() => []);
  const dirs = await kapi.listDirs(recDir).catch(() => []);
  const all = [...files, ...dirs];
  if (!all.length) { setStatus(tt('ui.tree.trashEmptyAlready')); return 0; }
  if (!(await confirmBox(ttf('ui.tree.confirmEmptyTrash', count || all.length), tt('ui.app.del')))) return 0;
  let n = 0;
  for (const f of all) {
    try { await kapi.remove(await kapi.join(recDir, f)); n++; } catch (e) { log('warn', tt('ui.tree.delFail'), e); }
  }
  await buildTree();
  setStatus(ttf('ui.tree.emptiedTrash', n));
  return n;
}

// [alpha.120 ข้อ 15] แถบสรุปเหนือต้นไม้ — ผู้ใช้บอกว่า "ใช้ไม่ได้ + มีแดชบอร์ดแล้ว"
// จึง **ปิดเป็นค่าเริ่มต้นแต่ไม่ลบโค้ด** (เปิดกลับได้จากเมนูคลิกขวาพื้นที่ว่าง)
export function summaryBarOn() {
  try { return localStorage.getItem('k2-summary-bar') === '1'; } catch { return false; }
}
export function setSummaryBar(on) {
  try { localStorage.setItem('k2-summary-bar', on ? '1' : '0'); } catch {}
  const bar = $('#summary-bar');
  if (bar) bar.style.display = on ? '' : 'none';
  if (on) updateSummaryBar().catch(() => {});
  return on;
}

/** อัปเดตสถานะทุกแถวโดยไม่ต้องสร้างต้นไม้ใหม่ (เรียกตอนสลับแท็บ/พิมพ์/บันทึก) */
export function refreshTreeRowStates() {
  const tree = $('#tree');
  if (!tree) return 0;
  let n = 0;
  // ⚠ เฉพาะแถวที่ "เป็นเอกสารเปิดเป็นแท็บได้" (data-tabrow) — แถวกระดาน/แผนแตกสายใช้
  // k-row-open/k-row-unsaved ตัวเดียวกันแต่มีคนดูแลของตัวเอง (markPlannerRow/markBranchPlanRow)
  // เผลอกวาดทั้งหมด = ป้าย "เปิดอยู่" ของกระดานถูกลบทุกครั้งที่สลับแท็บ
  for (const row of tree.querySelectorAll('.scene[data-tabrow]')) {
    applyRowOpenState(row, row.dataset.path); n++;
  }
  paintTreeSel();
  return n;
}

/**
 * สร้างต้นไม้ Explorer ใหม่
 *
 * [alpha.65r7] เดิม: ถ้ามีการสร้างค้างอยู่ จะ `return` ทันที (promise resolve เลย)
 * → `await buildTree()` ของคนที่เพิ่งเขียนไฟล์เสร็จ **คืนก่อนที่ต้นไม้จะมีของใหม่จริง**
 * แล้วโค้ดที่ตามมาก็ไปอ่านต้นไม้เวอร์ชันเก่า (เช่น แถวกระดานที่เพิ่งสร้าง "ยังไม่มี")
 * ตอนนี้: คนที่มาระหว่างทางได้ promise ที่ resolve **หลังรอบสร้างถัดไปจบจริง**
 * (ตัวกันซ้อนยังอยู่ — `_buildTreeInner` ไม่มีทางรันพร้อมกันสองตัว)
 */
let _treeWaiters = [];
export async function buildTree() {
  if (_treeBuilding) {
    _treeQueued = true;
    return new Promise((resolve) => _treeWaiters.push(resolve));
  }
  _treeBuilding = true;
  // [alpha.159 · H7] โครงเล่มอาจเปลี่ยน (เพิ่ม/ลบ/ย้ายฉาก) → สายหน้าเก่าใช้ไม่ได้ · แค่ทิ้งแคช
  // (วัดใหม่แบบขี้เกียจ — เฉพาะตอนแท็บ "ไล่เลขต่อเนื่อง" ถามหาเลข)
  try { bumpBookFlow(); } catch {}
  // [alpha.159 · QoL] โครงโปรเจกต์อาจเปลี่ยน → ป้ายจำนวนปัญหาบนแถบสถานะสแกนใหม่ (หน่วงรวบ · เบื้องหลัง)
  if (!PANEL_WIN) import('./project-doctor-ui.js').then((m) => m.scheduleDoctorBadge()).catch(() => {});
  try { await _buildTreeInner(); }
  catch (e) { log('error', tt('ui.app.buildTreeNewNotOk'), e); }
  finally {
    _treeBuilding = false;
    if (_treeQueued) {
      _treeQueued = false;
      const waiters = _treeWaiters; _treeWaiters = [];
      await buildTree();
      for (const r of waiters) { try { r(); } catch {} }
    }
  }
}
async function _buildTreeInner() {
  const tree = document.createElement('div');   // buffer ที่ยังไม่อยู่ใน DOM
  const skip = new Set(['Wiki', 'Bible', 'Images', 'Memos', 'Research', 'Snapshots', '.k2history', 'Plugins', 'Recycle', 'Sessions', 'Starters']);
  const sortMode = treeSortMode();                       // [alpha.120 ข้อ 2]
  const snapCounts = await snapshotCounts();             // [alpha.120 ข้อ 17] จำนวนเวอร์ชันต่อไฟล์
  await loadOnsetIndex().catch(() => {});                // [alpha.164] ป้าย ! ของฉากมีปัญหา
  // [alpha.155] แถวชื่อโปรเจกต์ + ปักหมุด — try ของตัวเอง: พังตรงนี้ห้ามลากต้นไม้ทั้งอันล้ม (บทเรียนข้อ 30)
  try { await buildProjectHead(tree); } catch (e) { log('warn', 'buildProjectHead', e); }
  for (const name of await kapi.listDirs(state.root)) {
    if (skip.has(name)) continue;
    const secPath = await kapi.join(state.root, name);
    if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
    const sec = await kapi.readJson(await kapi.join(secPath, 'section.json'));
    const secEl = el('div', 'sec');
    // [alpha.155] หัวเล่ม: จุดสี · ดาว/กุญแจ · ชิปสถานะ (ชุดเดียวกับแถวฉาก)
    const secTitle = el('div', 'sec-title');
    if (sec.color) { const dot = el('span', 'sc-dot'); dot.style.background = vivid(sec.color) || sec.color; secTitle.append(dot); }
    secTitle.append(document.createTextNode(
      (sec.locked ? gi('lock') : sec.flag ? gi('star') : gi('books')) + ' ' + (sec.title || name)));
    if (sec.status && sec.status !== 'outline') {
      const st = SECTION_STATUSES.find((s) => s[0] === sec.status);
      const chip = el('span', 'sc-status', st ? st[1] : sec.status);
      if (st) paintStatusChip(chip, st[2]);
      secTitle.append(chip);
    }
    // ปุ่ม + บนหัวเล่ม = เพิ่มบทลงในฉบับร่างแรกของเล่ม (ทางลัด)
    const addToSec = el('span', 'row-add', '+'); addToSec.title = tt('ui.app.addChapterBook');
    addToSec.onclick = (e) => { e.stopPropagation(); addChapterToSection(secPath); };
    secTitle.append(addToSec);
    secTitle._ctx = { secPath };
    // [alpha.155] เมนูของเล่มตามรายการของผู้ใช้ (tree-menu-spec.js → book)
    const bookCtx = { secPath, sec, title: sec.title || name, lockSrc: sec.locked ? 'book' : '' };
    bindTreeMenu(secTitle, 'book', bookCtx);
    // [alpha.162 · W4 ข้อ 10] ลากหัวเล่มไปวางบนหัวเล่มอื่น = ย้ายไปอยู่ตำแหน่งนั้น
    // (เขียนผ่าน TA.moveSectionTo ทางเดียวกับ "จัดลำดับ…" · เล่มที่ล็อกลากออกไม่ได้)
    if (!sec.locked) {
      secTitle.draggable = true;
      secTitle.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/k2-book', secPath);
        e.stopPropagation(); secTitle.classList.add('sc-dragging');
      });
      secTitle.addEventListener('dragend', () => secTitle.classList.remove('sc-dragging'));
    }
    secTitle.addEventListener('dragover', (e) => {
      if (![...e.dataTransfer.types].includes('text/k2-book')) return;
      e.preventDefault(); secTitle.classList.add('ch-drop');
    });
    secTitle.addEventListener('dragleave', () => secTitle.classList.remove('ch-drop'));
    secTitle.addEventListener('drop', async (e) => {
      secTitle.classList.remove('ch-drop');
      const src = e.dataTransfer.getData('text/k2-book');
      if (!src || src === secPath) return;
      e.preventDefault(); e.stopPropagation();
      await dropBookOn(src, secPath);
    });
    secEl.append(secTitle);
    makeAccordion(secTitle, secEl, 'sec:' + name);
    const draftRoot = await kapi.join(secPath, 'Draft');
    if (await kapi.exists(draftRoot)) {
      const primary = sec.primaryDraft || 'default';
      const draftsAvailable = await kapi.listDirs(draftRoot);
      const namesToShow = draftsAvailable.includes(primary) ? [primary] : draftsAvailable;
      // ═══ [alpha.125 ข้อ I] ★ สลับฉบับร่างได้จากต้นไม้เลย ═══
      //
      // ระบบหลายฉบับร่างต่อเล่มมีครบมานานแล้ว (สร้าง/ลบ/เปลี่ยนชื่อ/ตั้งร่างหลัก ใน "จัดการเล่ม")
      // แต่ Explorer แสดง **เฉพาะร่างหลัก** เสมอ และทางเดียวที่จะดูอีกร่างคือเปิดหน้าจัดการเล่ม
      // → ในทางปฏิบัติจึงเหมือนมีร่างเดียว · ตัวเลือกนี้โผล่เฉพาะเล่มที่มีมากกว่าหนึ่งร่างจริง ๆ
      if (draftsAvailable.length > 1) {
        // ⚠ **ห้ามใช้คลาส `scene`** — ทั้งโปรแกรม (และเทส) ถือว่า `.scene` = แถวเนื้อหาที่คลิกเปิดได้
        // ใส่ไปแล้วเจอทันที: `document.querySelector('.scene').click()` ไปโดนแถวนี้แทนฉากแรก
        const dRow = el('div', 'tree-draft-row');
        dRow.append(icon('book-content', 13), ' ' + tt('ui.tree.draftLabel'));
        const dSel = el('select', 'k-dlg-select tree-draft-sel');
        for (const dn of draftsAvailable) {
          const o = el('option', null, dn); o.value = dn; dSel.append(o);
        }
        dSel.value = namesToShow[0];
        dSel.title = tt('ui.tree.draftPickHint');
        dSel.onclick = (e) => e.stopPropagation();
        dSel.onchange = async () => {
          const { setPrimaryDraft } = await import('./drafts.js');
          await setPrimaryDraft(secPath, dSel.value);
          setStatus(ttf('ui.tree.draftSwitched', dSel.value));
          await buildTree();
        };
        dRow.append(dSel);
        secEl.append(dRow);
      }
      for (const dname of namesToShow) {
        const dPath = await kapi.join(draftRoot, dname);
        const draftFile = await kapi.join(dPath, 'draft.json');
        if (!(await kapi.exists(draftFile))) continue;
        const chapters = ((await kapi.readJson(draftFile)).chapters || [])
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        const scenesAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {};
        for (const ch of chapters) {
          // ไฟล์ทั้งหมดในโฟลเดอร์บท — ใช้ดูว่าฉากไหนมีตาราง "เล่าด้วยภาพ" (เรียกครั้งเดียวต่อบท)
          // try/catch ของตัวเอง: พังตรงนี้ห้ามทำให้ทั้งต้นไม้ค้างของเก่า (บทเรียนข้อ 30)
          let chFiles = [];
          try { chFiles = await kapi.listFiles(await kapi.join(dPath, 'Chapters', ch.folderName)); } catch {}
          const visSet = new Set(chFiles.filter((f) => /_vis\.csv$/i.test(f)).map((f) => f.toLowerCase()));
          const chEl = el('div', 'chapter');
          const chHead = el('div', 'ch-title');
          // [alpha.124 ข้อ 20] ชื่อบทเป็นข้อความของผู้ใช้ → ห้ามลง innerHTML (กฎข้อ 11)
          // [alpha.155] จุดสี · ดาว/กุญแจ · ชิปสถานะ ของบท (draft.json)
          if (ch.color) { const dot = el('span', 'sc-dot'); dot.style.background = vivid(ch.color) || ch.color; chHead.append(dot); }
          chHead.append(icon(ch.locked || sec.locked ? 'lock' : ch.isFavorite ? 'star' : 'folder', 14), ' ' + (ch.title || ''));
          if (ch.status && ch.status !== 'Outline') {
            chHead.append(statusChip(ch.status));        // [alpha.159 · M16] ชิปมี dataset.status
          }
          const addSc = el('span', 'row-add', '+');
          addSc.title = tt('ui.app.addSceneChapter');
          addSc.onclick = (e) => { e.stopPropagation(); addScene(dPath, ch); };
          chHead.append(addSc);
          chEl.append(chHead);
          makeAccordion(chHead, chEl, 'ch:' + ch.guid);
          // บทลากสลับลำดับได้ (แบบ Windows Explorer) — ลากหัวบท
          chHead.draggable = true;
          chHead.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'copyMove';
            setDrag(e.dataTransfer, 'chapter', { draftDir: dPath, guid: ch.guid, title: ch.title || '' });
            e.stopPropagation(); chHead.classList.add('sc-dragging');
          });
          chHead.addEventListener('dragend', () => chHead.classList.remove('sc-dragging'));
          chHead.addEventListener('dragover', (e) => {
            const ty = [...e.dataTransfer.types];
            if (ty.includes('text/k2-scene') || ty.includes('text/k2-chapter') || ty.includes('text/k2-memo')) {
              e.preventDefault(); chHead.classList.add('ch-drop'); } });
          chHead.addEventListener('dragleave', () => chHead.classList.remove('ch-drop'));
          chHead.addEventListener('drop', async (e) => {
            chHead.classList.remove('ch-drop');
            // วางบท → จัดลำดับบท
            // วางโน้ตจาก MEMO → ย้ายเข้าบทนี้
            const mData = e.dataTransfer.getData('text/k2-memo');
            if (mData) { let m; try { m = JSON.parse(mData); } catch { return; }
              e.preventDefault(); return moveMemoToChapter(m.path || m.file, dPath, ch, null); }
            const cData = e.dataTransfer.getData('text/k2-chapter');
            if (cData) { let c; try { c = JSON.parse(cData); } catch { return; }
              if (c.draftDir !== dPath) { setStatus(tt('ui.app.moveSkipDraftNot')); return; }
              e.preventDefault(); return moveChapterBefore(dPath, c.guid, ch.guid); }
            // วางฉาก → ต่อท้ายบทนี้
            let data; try { data = JSON.parse(e.dataTransfer.getData('text/k2-scene')); } catch { return; }
            if (!data || data.chGuid === ch.guid) return;
            if (data.draftDir !== dPath) { setStatus(tt('ui.app.notMoveSkipDraft2')); return; }
            e.preventDefault();
            await moveSceneToChapter(dPath, { guid: data.chGuid }, { id: data.id }, ch);
            setStatus(tt('ui.app.moveSceneChapter') + ch.title);
          });
          // [alpha.120 ข้อ 2] โหมด "เวลาแก้ไข" ต้องถามดิสก์ — ถามเฉพาะตอนเลือกโหมดนั้นจริง ๆ
          let chMtimes = null;
          if (sortMode === 'modified') {
            chMtimes = new Map();
            for (const r of (scenesAll[ch.guid] || [])) {
              try { chMtimes.set(r.id, await kapi.mtime(
                await kapi.join(dPath, 'Chapters', ch.folderName, r.fileName))); } catch {}
            }
          }
          for (const sc of sortSceneRows(scenesAll[ch.guid] || [], sortMode, chMtimes)) {
            const scEl = el('div', 'scene');
            if (sc.color) { const dot = el('span', 'sc-dot'); dot.style.background = vivid(sc.color) || sc.color; scEl.append(dot); }
            const isMemo = sc.type === 'memo';
            if (isMemo) scEl.classList.add('sc-memo');
            scEl.dataset.chGuid = ch.guid;
            // ใส่ data-status สำหรับสีพื้นหลังตามสถานะ
            if (sc.status && sc.status !== 'Outline') scEl.dataset.status = sc.status;
            // [alpha.155] ล็อกของบท/เล่มนับด้วย (ผู้ใช้: "ล็อกทุกฉากข้างใน")
            const scLockSrc = sec.locked ? 'book' : ch.locked ? 'chapter' : sc.locked ? 'scene' : '';
            scEl.dataset.sec = name;
            // ไอคอนตามประเภท
            const icon = scLockSrc ? gi('lock') + ' ' : isMemo ? gi('note') + ' ' : sc.flag ? gi('star') + ' ' : gi('file') + ' ';
            scEl.append(document.createTextNode(icon + sc.title));
            // ป้ายเล่าเรื่อง (Narrative Markers): ฉากนอกลำดับเวลาหลัก
            if (sc.isFlashback) scEl.append(el('span', 'tree-flash', gi('rewind')));
            else if (sc.isFlashforward) scEl.append(el('span', 'tree-flash', gi('fast-forward')));
            // [alpha.164] ฉากมีปัญหา — ป้าย ! (ติดธงไว้ เทียบกับฉบับเดิมอยู่)
            if (isProblemScene(sc.id)) {
              const pb = el('span', 'tree-onset', '!');
              pb.title = tt('ui.onset.treeBadge');
              scEl.append(pb);
              scEl.classList.add('k-row-onset');
            }
            // รูป thumbnail (ถ้ามีรูปแรกในฉาก)
            const scPath = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
            if (sc.imageCount || sc.wordCount) {
              // อ่าน thumbnail จากไฟล์ (ถ้าเคยมี)
            }
            // word count เล็ก ๆ
            if (sc.wordCount) scEl.append(el('span', 'sc-wordcount', wordBadgeText(sc.wordCount)));
            if (sc.status && sc.status !== 'Outline') {
              // ชิปสถานะได้สีประจำสถานะ (มาตรฐาน หรือที่ผู้ใช้ตั้งเองในกล่องจัดการสถานะ)
              // [alpha.159 · M16] ป้ายตามภาษา (เดิมโชว์ค่าไทยดิบ) + ค่าจริงใน dataset ให้ตัวทาสีซ้ำอ่าน
              const stCol = statusColor(sc.status);
              if (stCol) scEl.style.setProperty('--row-st', vivid(stCol));
              scEl.append(statusChip(sc.status));
            }
            // แท็ก: ตัวที่ตั้งสี/ไอคอนไว้ (Visual Tags ข้อ 84) ได้ชิปสี · ที่เหลือเป็น #ข้อความ
            if (sc.tags && sc.tags.length) {
              const chips = renderAllTagChips(sc.tags, (t) => {
                const q = $('#tree-search');
                if (q) { q.value = 'tag:' + t; q.dispatchEvent(new Event('input', { bubbles: true })); }
              });
              chips.classList.add('sc-tags');
              scEl.append(chips);
            }
            // [alpha.120 ข้อ 17] จำนวนเวอร์ชันที่เก็บไว้ของไฟล์นี้
            addVersionBadge(scEl, snapCounts,
              snapKey(name, 'Draft', dname, 'Chapters', ch.folderName, sc.fileName));
            scEl._scene = sc;                      // อ้างอิงตรง → กรองได้ทุกฟิลด์ (ดู filterTree)
            // [alpha.120 ข้อ 3] ชื่อไฟล์จริงต้องค้นเจอด้วย (ผู้ใช้เห็นมันตอน hover แล้วอยากพิมพ์หา)
            scEl.dataset.search = [sc.title, sc.fileName, (sc.tags || []).join(' '), sc.status,
              sc.pov, sc.emotion, sc.conflict, sc.synopsis, sc.note].filter(Boolean).join(' ').toLowerCase();
            scEl.title = [
              // [alpha.120 ข้อ 3] hover ต้องบอก **ชื่อไฟล์พร้อมนามสกุล** — ไฟล์งานแก้นอกโปรแกรมได้
              // ผู้ใช้จึงต้องรู้ว่าแถวนี้คือไฟล์ไหนโดยไม่ต้องเปิดคุณสมบัติ
              (isMemo ? gi('note') + ' ' : gi('file') + ' ') + sc.title + '  (' + sc.fileName + ')',
              isMemo ? tt('ui.app.noteChapterNotMerge') : '',
              sc.locked ? tt('ui.app.lockEditCant2') : '',
              sc.status && sc.status !== 'Outline' ? tt('ui.app.status2') + sc.status : '',
              (sc.tags || []).length ? tt('ui.common.tag3') + sc.tags.join(', ') : '',
              sc.pov ? tt('ui.common.view2') + sc.pov : '',
              sc.emotion ? tt('ui.app.mood') + sc.emotion : '',
              sc.conflict ? tt('ui.common.conflict2') + sc.conflict : '',
              sc.flag ? tt('ui.app.pinPin') : '',
              sc.isFlashback ? tt('ui.common.flashback') : '',
              sc.isFlashforward ? tt('ui.common.pageFlashforward') : '',
              sc.wordCount ? sc.wordCount + tt('ui.common.word') : '',
              sc.synopsis || '',
              sc.note ? tt('ui.app.note') + sc.note : '',
            ].filter(Boolean).join('\n');
            scEl._ctx = { dPath, ch, sc };                       // [alpha.120 ข้อ 16] บริบทสำหรับคัดลอก/ย้าย/ลบ
            scEl.onclick = async (ev) => {
              // [alpha.120 ข้อ 16] Ctrl/Shift = เลือกหลายไฟล์ (ไม่เปิดฉาก) · คลิกเปล่า = เปิดตามเดิม
              if (ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey)) {
                ev.preventDefault(); ev.stopPropagation();
                treeSelectClick(scEl, ev);
                return;
              }
              treeSelectOnly(scEl);
              setPropsTarget(dPath, ch, sc);                       // อัปเดตแผงคุณสมบัติ (ถ้าเปิดอยู่)
              openScene(await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName), sc.title);
            };
            scEl.dataset.path = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
            applyRowOpenState(scEl, scEl.dataset.path);          // [alpha.120 ข้อ 5] หนา/เอียง
            // ลากย้ายฉากแบบ Windows Explorer: วางบนหัวบท = ต่อท้ายบท · วางบนฉาก = แทรกก่อนฉากนั้น
            scEl.draggable = true;
            scEl.addEventListener('dragstart', (e) => {
              e.dataTransfer.effectAllowed = 'copyMove';
              setDrag(e.dataTransfer, 'scene', ({ draftDir: dPath, chGuid: ch.guid, id: sc.id,
                                                                       file: scEl.dataset.path, title: sc.title }));
              e.stopPropagation(); scEl.classList.add('sc-dragging');
            });
            scEl.addEventListener('dragend', () => scEl.classList.remove('sc-dragging'));
            scEl.addEventListener('dragover', (e) => {
              const tt = [...e.dataTransfer.types];
              if (tt.includes('text/k2-scene') || tt.includes('text/k2-memo')) {
                e.preventDefault(); scEl.classList.add('sc-drop-before'); } });
            scEl.addEventListener('dragleave', () => scEl.classList.remove('sc-drop-before'));
            scEl.addEventListener('drop', async (e) => {
              scEl.classList.remove('sc-drop-before');
              const mD = e.dataTransfer.getData('text/k2-memo');
              if (mD) { let m; try { m = JSON.parse(mD); } catch { return; }
                e.preventDefault(); return moveMemoToChapter(m.path || m.file, dPath, ch, sc.id); }
              let data; try { data = JSON.parse(e.dataTransfer.getData('text/k2-scene')); } catch { return; }
              if (!data || data.id === sc.id) return;
              if (data.draftDir !== dPath) { setStatus(tt('ui.app.notMoveSkipDraft')); return; }
              e.preventDefault(); e.stopPropagation();
              await moveSceneBefore(dPath, { guid: data.chGuid }, data.id, ch, sc.id);
            });
            // [alpha.155] เมนูของฉากตามรายการของผู้ใช้ (tree-menu-spec.js → scene)
            // [alpha.162 · W4 ข้อ 10] ผูกผ่าน bindTreeMenu → แถวพกชนิด/บริบทติดตัว (F2 · คัดลอกที่อยู่)
            bindTreeMenu(scEl, 'scene', { dPath, ch, sc, file: scEl.dataset.path, title: sc.title,
                                          isMemoRow: isMemo, lockSrc: scLockSrc, open: scEl.onclick }, (e) => {
              e.preventDefault();
              // คลิกขวาบนแถวที่ยังไม่ถูกเลือก = เลือกเฉพาะแถวนั้น (เหมือน Explorer ของ Windows)
              if (!scEl.classList.contains('k-row-sel')) treeSelectOnly(scEl);
              const multi = treeSelCtx();
              if (multi.length > 1) { popupMenu(e.clientX, e.clientY, treeMultiMenu(multi)); return true; }
              return false;
            });
            chEl.append(scEl);
            // แถวลูก "เล่าด้วยภาพ" — โผล่เฉพาะฉากที่มีไฟล์ตารางจริง
            if (visSet.has(sc.fileName.replace(/\.md$/i, '').toLowerCase() + '_vis.csv')) {
              const vEl = el('div', 'scene vis-row', gi('film') + ' ' + tt('ui.vis.title'));
              // [alpha.120 ข้อ 8] ★ เดิมติด `data-nofilter` → filterTree ข้ามแถวนี้เสมอ
              // ผลคือ "เล่าด้วยภาพ" ไม่เคยถูกกรอง: ค้นอะไรก็ยังโผล่ค้างอยู่ใต้บทที่ฉากถูกซ่อนไปแล้ว
              // ตอนนี้แถวนี้กรองได้จริง และผูกกับบท/ฉากของมันเพื่อให้ "ค้นเฉพาะในบทนี้" ทำงานด้วย
              vEl.dataset.chGuid = ch.guid;
              vEl.dataset.sec = name;                    // [alpha.155] ค้นหาในเล่ม
              vEl.dataset.search =[tt('ui.vis.title'), sc.title, sc.fileName,
                                    (sc.tags || []).join(' ')].filter(Boolean).join(' ').toLowerCase();
              vEl.title = tt('ui.vis.title') + ' — ' + sc.title + '  (' +
                          sc.fileName.replace(/\.md$/i, '_vis.csv') + ')';
              // ยังคง data-path ไว้ตามเดิม (โค้ด/เทสอื่นอ้างถึง) และเพิ่ม data-vis-of ให้ชัดว่า
              // แถวนี้ "ห้อยอยู่ใต้" ฉากไหน — ตัวเลือกที่เลือกหลายไฟล์จะได้ไม่นับมันเป็นฉากหนึ่งใบ
              vEl.dataset.path = scEl.dataset.path;
              vEl.dataset.visOf = scEl.dataset.path;
              vEl.onclick = (ev) => { ev.stopPropagation(); openVisual(scEl.dataset.path, sc.title); };
              vEl.oncontextmenu = (ev) => { ev.preventDefault(); ev.stopPropagation();
                popupMenu(ev.clientX, ev.clientY, [
                  { label: tt('ui.vis.open'), click: () => openVisual(scEl.dataset.path, sc.title) },
                  { label: tt('ui.vis.reveal'), click: async () => kapi.revealInOS(await visPathOf(scEl.dataset.path)) },
                  { label: tt('ui.app.findDiskFindOn'), click: async () => revealFile(await visPathOf(scEl.dataset.path)) },
                ]); };
              chEl.append(vEl);
            }
          }
          // Empty state: บทที่ยังไม่มีฉาก
          if ((scenesAll[ch.guid] || []).length === 0) {
            const es = el('div', 'empty-state-row');
            es.style.cssText = 'text-align:center;padding:8px;opacity:.7;font-style:italic;';
            es.append(el('span', 'dim', tt('ui.app.notHasScenePress')));
            chEl.append(es);
          }
          // [alpha.162 · W4 ข้อ 10] "+ ฉาก" ท้ายบท — บทยาวไม่ต้องเลื่อนกลับขึ้นไปหาปุ่ม + บนหัวบท
          // (บท/เล่มที่ล็อกไม่มีแถวนี้ ตรงกับที่รายการ addScene ในเมนูถูกล็อกกันไว้)
          if (!ch.locked && !sec.locked) {
            // ⚠ ไม่ใช้คลาส `scene` (ดูคำเตือนที่แถวฉบับร่าง) — บทแรกว่างเมื่อไหร่ `.scene` ตัวแรกจะโดนแถวนี้
            const addScRow = el('div', 'add-row k-add-scene-row', tt('ui.tree.addSceneHere'));
            addScRow.onclick = (ev) => { ev.stopPropagation(); addScene(dPath, ch); };
            chEl.append(addScRow);
          }
          chHead._ctx = { dPath, ch };                 // [alpha.120 ข้อ 16] เป้าหมายของ "วาง"
          // [alpha.155] เมนูของบทตามรายการของผู้ใช้ (tree-menu-spec.js → chapter)
          const chCtx = { dPath, ch, secPath, sec, title: ch.title || '',
                          lockSrc: sec.locked ? 'book' : ch.locked ? 'chapter' : '' };
          bindTreeMenu(chHead, 'chapter', chCtx);
          secEl.append(chEl);
        }
        const addCh = el('div', 'scene add-row', tt('ui.app.addChapter'));
        addCh.onclick = () => addChapter(dPath);
        secEl.append(addCh);
      }
    }
    tree.append(secEl);
  }
  // แถวเพิ่มเล่มใหม่ + เปิดตัวจัดการเล่ม (ท้ายรายการเล่มทั้งหมด)
  const addSecRow = el('div', 'sec');
  const mgrBtn = el('div', 'scene add-row', tt('ui.app.manageBook'));
  mgrBtn.onclick = () => openBookManager();
  addSecRow.append(mgrBtn);
  // [alpha.141] จัดการบท + อ่านทั้งเล่ม อยู่ข้าง ๆ จัดการเล่ม (ทางเข้าที่หาเจอโดยไม่ต้องคลิกขวา)
  const chBtn = el('div', 'scene add-row', tt('ui.chapters.title'));
  chBtn.onclick = () => openChapterManager();
  addSecRow.append(chBtn);
  const rdBtn = el('div', 'scene add-row', tt('ui.readbook.button'));
  rdBtn.onclick = () => openBookReader();
  addSecRow.append(rdBtn);
  const tlBtn = el('div', 'scene add-row', tt('ui.app.lineTime'));
  tlBtn.onclick = () => openTimeline();
  addSecRow.append(tlBtn);
  const mapBtn = el('div', 'scene add-row', tt('ui.app.map2'));
  mapBtn.onclick = () => openMaps();
  addSecRow.append(mapBtn);
  const addSecBtn = el('div', 'scene add-row', tt('ui.app.addBook'));
  addSecBtn.onclick = () => addSection();
  addSecRow.append(addSecBtn);
  tree.append(addSecRow);
  // ---- Memo (โฟลเดอร์ Memos/ ของโปรเจกต์ — เข้ากับ v1) ----
  const memoDir = await kapi.join(state.root, 'Memos');
  const mSec = el('div', 'sec');
  const mHead = el('div', 'sec-title', gi('note') + ' ' + tt('ui.tree.secMemo'));   // [alpha.164 ข้อ B8] เดิม 'MEMO' ตัวใหญ่ฮาร์ดโค้ด
  const addM = el('span', 'row-add', '+'); addM.title = tt('ui.app.newMemoNew');
  addM.onclick = () => addMemo();
  mHead.append(addM); mSec.append(mHead);
  makeAccordion(mHead, mSec, 'sec:__memo__');
  // [alpha.155] เมนูของหัวหมวด Memo ตามรายการของผู้ใช้ (tree-menu-spec.js → memoHead)
  bindTreeMenu(mHead, 'memoHead', { dir: memoDir, expand: () => {
    if (mSec.classList.contains('collapsed')) { const caret = mHead.querySelector('.tw'); if (caret) caret.click(); }
    mHead.scrollIntoView({ block: 'nearest' });
  } });
  // ลากฉาก/โน้ตในบทมาวางที่หัว MEMO = ย้ายออกมาเก็บไว้นอกบท
  mHead.addEventListener('dragover', (e) => {
    if ([...e.dataTransfer.types].includes('text/k2-scene')) {
      e.preventDefault(); mHead.classList.add('ch-drop'); } });
  mHead.addEventListener('dragleave', () => mHead.classList.remove('ch-drop'));
  mHead.addEventListener('drop', async (e) => {
    mHead.classList.remove('ch-drop');
    let d; try { d = JSON.parse(e.dataTransfer.getData('text/k2-scene')); } catch { return; }
    if (!d || !d.draftDir) return;
    e.preventDefault();
    const ch = await chapterByGuid(d.draftDir, d.chGuid);
    if (!ch) return;
    const sj = await kapi.readJson(await kapi.join(d.draftDir, 'scenes.json'));
    const row = (sj.chapters[d.chGuid] || []).find((x) => x.id === d.id);
    if (row) await moveRowToMemos(d.draftDir, ch, row);
  });
  // [alpha.120 ข้อ 2] โน้ตเรียงตามโหมดเดียวกับฉาก (ค่าเริ่มต้น = ตามชื่อไฟล์เหมือนเดิม)
  const memoFiles = await kapi.listFiles(memoDir, '.md');
  const memoRows = [];
  for (const f of memoFiles) {
    const p = await kapi.join(memoDir, f);
    let raw = ''; try { raw = await kapi.readFile(p); } catch {}
    const meta = parseMdFile(raw).meta || {};
    memoRows.push({ f, p, meta, title: meta.title || f.replace(/\.md$/, ''), order: Number(meta.order) || 0,
                    mtime: sortMode === 'modified' ? await kapi.mtime(p).catch(() => 0) : 0 });
  }
  if (sortMode === 'name') memoRows.sort((a, b) => _thCmp(a.title, b.title));
  else if (sortMode === 'modified') memoRows.sort((a, b) => b.mtime - a.mtime);
  // [alpha.155] ค่าเริ่มต้น = ลำดับที่ผู้ใช้จัด (เลื่อนขึ้น/ลง เขียน order ลง frontmatter) · ไม่มี order = ตามชื่อไฟล์
  else memoRows.sort((a, b) => ((a.order || 1e9) - (b.order || 1e9)) || a.f.localeCompare(b.f));
  for (const { f, p, title, meta } of memoRows) {
    const mFlag = TA.isMemoFlag(meta.flag), mLocked = TA.isMemoFlag(meta.locked);
    const it = el('div', 'scene');
    if (meta.color) { const dot = el('span', 'sc-dot'); dot.style.background = vivid(meta.color) || meta.color; it.append(dot); }
    it.append(document.createTextNode((mLocked ? gi('lock') : mFlag ? gi('star') : gi('file')) + ' ' + title));
    if (meta.status) {
      it.append(statusChip(meta.status));
    }
    it.dataset.path = p;
    it.dataset.search = (title + ' ' + f).toLowerCase();
    it.title = gi('note') + ' ' + title + '  (' + f + ')';          // [alpha.120 ข้อ 3] ชื่อไฟล์พร้อมนามสกุล
    addVersionBadge(it, snapCounts, snapKey('Memos', f));  // [alpha.120 ข้อ 17]
    applyRowOpenState(it, p);                              // [alpha.120 ข้อ 5]
    it.onclick = () => openScene(p, title);
    it.draggable = true;                                   // ลาก memo ไปวางบนกระดาน Planner ได้
    it.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'copyMove';
      setDrag(e.dataTransfer, 'memo', { path: p, file: p, title });   // [alpha.167] + text/plain (หยิบใส่)
      it.classList.add('sc-dragging');
    });
    it.addEventListener('dragend', () => it.classList.remove('sc-dragging'));
    // [alpha.155] เมนูของไฟล์ Memo ตามรายการของผู้ใช้ (tree-menu-spec.js → memo)
    const memoRel = await TA.relOf(p);
    bindTreeMenu(it, 'memo', { file: p, meta, rel: memoRel, title,
                               lockSrc: mLocked ? 'item' : '' });
    mSec.append(it);
  }
  tree.append(mSec);

  // ---- กระดานวางแผน (planner.json + Planners/*.json) — [alpha.65] บั๊ก 5 ----
  // [alpha.65r7] ครอบ try ไว้: ถ้าหมวดกระดานพัง ต้องไม่ลาก buildTree ทั้งอันล้มตาม
  // (ล้มตรงนี้ = ไม่ถึงบรรทัดสลับ buffer → ต้นไม้ค้างของเก่า กดรีเฟรชยังไงก็ไม่ขยับ)
  try {
    await buildPlannerSection(tree);
  } catch (e) {
    log('error', tt('ui.app.buildTreeNewCatBoard'), e);
    const fb = el('div', 'sec');
    const fbHead = el('div', 'sec-title', tt('ui.app.boardPlannerReadCant'));
    fb.append(fbHead);
    const retry = el('div', 'scene add-row', tt('ui.app.tryNew'));
    retry.onclick = () => refreshTreeQueued();
    fb.append(retry);
    tree.append(fb);
  }

  // ---- แผนที่ (maps.json) — [alpha.70 ข้อ 11] ----
  // ครอบ try เหมือนหมวดกระดาน: maps.json พัง = ห้ามลาก buildTree ทั้งอันล้มตาม (บทเรียน 30)
  try {
    await buildMapsSection(tree);
  } catch (e) {
    log('error', tt('ui.app.buildTreeNewCatMap'), e);
    const fb2 = el('div', 'sec');
    fb2.append(el('div', 'sec-title', tt('ui.app.mapReadCant')));
    const retry2 = el('div', 'scene add-row', tt('ui.app.tryNew'));
    retry2.onclick = () => refreshTreeQueued();
    fb2.append(retry2);
    tree.append(fb2);
  }

  // ---- แผนของผังแตกสาย (Branches/*.json) — [alpha.73 ข้อ 5] ----
  try {
    await buildBranchPlanSection(tree);
  } catch (e) {
    log('error', tt('ui.app.buildTreeNewCatGraph'), e);
  }

  // ---- คลังรูป (โฟลเดอร์ Images/) — ข้อ 6 · [alpha.63] เห็นครบทุกอัลบั้ม ไม่ใช่แค่รูปที่ราก ----
  const imgDir = await kapi.join(state.root, 'Images');
  let galAlbums = [], galItems = [];
  if (await kapi.exists(imgDir)) {
    try {
      galAlbums = await albumCore.listAlbums(kapi, state.root);
      galItems = await albumCore.allImages(kapi, state.root, galAlbums);
    } catch (e) { log('warn', tt('ui.app.explorerReadLibraryImage'), e); }
  }
  const iSec = el('div', 'sec');
  const iHead = el('div', 'sec-title', ttf('ui.app.libraryImage', galItems.length));
  const addI = el('span', 'row-add', '+'); addI.title = tt('ui.app.addImageInLibrary');
  addI.onclick = async (e) => { e.stopPropagation(); await importImageToLibrary(); };
  iHead.append(addI); iSec.append(iHead);
  makeAccordion(iHead, iSec, 'sec:__images__');
  // [alpha.155] เมนูของหัวหมวดคลังรูปตามรายการของผู้ใช้ (tree-menu-spec.js → galleryHead)
  bindTreeMenu(iHead, 'galleryHead', { dir: imgDir, title: '' });
  // จัดกลุ่มตามอัลบั้ม (อัลบั้มรากขึ้นก่อน) — อัลบั้มที่ว่างไม่ต้องโชว์ให้รก
  const byAlbum = new Map();
  for (const it of galItems) {
    if (!byAlbum.has(it.album)) byAlbum.set(it.album, []);
    byAlbum.get(it.album).push(it);
  }
  for (const a of galAlbums) {
    const rows = byAlbum.get(a.id);
    if (!rows || !rows.length) continue;
    if (a.id !== albumCore.ROOT_ALBUM || byAlbum.size > 1) {
      const ah = el('div', 'scene img-album-row');
      ah.innerHTML = iconHtml(a.id === albumCore.ROOT_ALBUM ? 'archive' : 'folder', 12);
      ah.append(document.createTextNode(' ' +
        (a.id === albumCore.ROOT_ALBUM ? albumCore.ROOT_ALBUM_NAME : a.id) + ` (${rows.length})`));
      ah.onclick = () => openGallery();
      iSec.append(ah);
    }
    for (const im of rows) {
      const p = await kapi.join(imgDir, ...im.path.split('/'));
      const it = el('div', 'scene img-row');
      const th = el('img', 'img-thumb'); th.src = await kapi.toFileURL(p); th.alt = im.file;
      th.onerror = () => { th.replaceWith(document.createTextNode(gi('warning') + ' ')); };
      it.append(th, document.createTextNode(im.file));
      it.dataset.path = p;
      it.dataset.search = (im.file + ' ' + (im.caption || '') + ' ' + (im.tags || []).join(' ')).toLowerCase();
      it.title = im.file + (im.caption ? '\n' + im.caption : '') +
                 tt('ui.app.clickViewImageFull');
      it.onclick = async () => imageLightbox(await kapi.toFileURL(p), im.caption || im.file);
      it.draggable = true;
      it.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/k2-image', JSON.stringify({ path: p, name: im.file }));
        e.dataTransfer.setData('text/plain', '![](' + im.path + ')');
      });
      // [alpha.155] เมนูของไฟล์รูปตามรายการของผู้ใช้ (tree-menu-spec.js → image)
      bindTreeMenu(it, 'image', { abs: p, im, title: im.file });
      iSec.append(it);
    }
  }
  if (!galItems.length) iSec.append(el('div', 'scene empty-state-row', tt('ui.app.notHasImageLibrary')));
  tree.append(iSec);

  // ---- Research (โฟลเดอร์ Research/ — เก็บ PDF, ภาพ, ลิงก์, .md งานวิจัย) ----
  const resDir = await kapi.join(state.root, 'Research');
  const rSec = el('div', 'sec');
  const rHead = el('div', 'sec-title', gi('books') + ' ' + tt('ui.tree.secResearch'));
  rSec.append(rHead);
  makeAccordion(rHead, rSec, 'sec:__research__');
  if (await kapi.exists(resDir)) {
    const files = await kapi.listFiles(resDir, '').catch(() => []);
    const dirs = await kapi.listDirs(resDir).catch(() => []);
    // แสดงโฟลเดอร์ย่อยก่อน
    for (const d of dirs) {
      const dp = await kapi.join(resDir, d);
      const it = el('div', 'scene');
      // [alpha.160 · P2] ชื่อโฟลเดอร์มาจากดิสก์ = ข้อความของผู้ใช้ → ห้ามเข้า innerHTML (renderer มี kapi เข้าถึง FS เต็ม)
      it.append(icon('folder', 14), document.createTextNode(' ' + d));
      it.onclick = () => kapi.revealInOS(dp);
      it.oncontextmenu = (e) => { e.preventDefault(); popupMenu(e.clientX, e.clientY, [
        { label: tt('ui.app.openFolder'), click: () => kapi.revealInOS(dp) },
        '-',
        { label: tt('ui.app.delFolder'), danger: true, click: async () => {
          if (!(await confirmBox(ttf('ui.app.delFolderAll', d)))) return;
          await kapi.remove(dp); await buildTree();
        } },
      ]); };
      rSec.append(it);
    }
    for (const f of files) {
      const fp = await kapi.join(resDir, f);
      const isMd = f.endsWith('.md');
      const isPdf = f.endsWith('.pdf');
      const icon = isMd ? gi('note') : isPdf ? gi('file-pdf') : /\.(png|jpg|jpeg|gif|webp)$/i.test(f) ? gi('frame') : gi('paperclip');
      const it = el('div', 'scene', icon + ' ' + f);
      it.title = fp;
      if (isMd) {
        it.onclick = async () => {
          const { openScene } = await import('./app.js');
          openScene(fp, f.replace(/\.md$/, ''));
        };
      } else {
        it.onclick = () => kapi.revealInOS(fp);
      }
      it.oncontextmenu = (e) => { e.preventDefault(); popupMenu(e.clientX, e.clientY, [
        { label: isMd ? tt('ui.app.open') : tt('ui.app.openApp'), click: it.onclick },
        { label: tt('ui.common.showFolder'), click: () => kapi.revealInOS(fp) },
        '-',
        { label: tt('ui.common.del2'), danger: true, click: async () => {
          await kapi.remove(fp); await buildTree();
        } },
      ]); };
      rSec.append(it);
    }
    // ปุ่มเพิ่มไฟล์
    const addR = el('div', 'scene add-row', tt('ui.app.addFileTask'));
    addR.onclick = async () => {
      await kapi.mkdir(resDir);
      kapi.revealInOS(resDir);  // เปิดให้ลากวาง
      setStatus(tt('ui.app.openFolderResearchDone'));
    };
    rSec.append(addR);
  } else {
    // [alpha.164 ข้อ F5] สถานะว่างหน้าตาเดียวกับหมวดอื่น ("+ สร้างกระดานแรก…" · "+ สร้างแผนที่แรก…")
    // เดิมเป็นตัวเอียงจาง + ปุ่มส้มก้อนใหญ่กลางต้นไม้ — เด่นกว่าทุกอย่างใน Explorer ทั้งที่ว่างเปล่า
    const createB = el('div', 'scene add-row', tt('ui.app.newFolderResearch'));
    createB.title = tt('ui.app.notHasFileTask');
    createB.onclick = async () => {
      await kapi.mkdir(resDir);
      setStatus(tt('ui.app.newFolderResearchDone'));
      await buildTree();
    };
    rSec.append(createB);
  }
  tree.append(rSec);

  // ---- Wiki: แสดงเสมอ (โปรเจกต์ที่ยังไม่มี Wiki ก็เห็น 4 หมวดหลัก + สร้างได้เลย)
  //      รองรับทั้งชื่อใหม่ Wiki/ และชื่อเดิม Bible/ ของ v1 · รวม Wiki ของแต่ละเซกชันด้วย ----
  const wikiRootOf = async (base) => {
    const w = await kapi.join(base, 'Wiki');
    if (await kapi.exists(w)) return w;
    const b = await kapi.join(base, 'Bible');
    if (await kapi.exists(b)) return b;
    return w;                                  // ยังไม่มี = จะถูกสร้างเมื่อเพิ่มของจริง
  };
  const wSec = el('div', 'sec');
  const wHead = el('div', 'sec-title', gi('book-open') + ' ' + tt('ui.tree.secWiki'));
  wSec.append(wHead);
  makeAccordion(wHead, wSec, 'sec:__wiki__');
  const tplRow = el('div', 'scene', tt('ui.app.templateManage'));
  tplRow.onclick = () => openTemplateManager();
  wSec.append(tplRow);
  const galRow = el('div', 'scene', tt('ui.app.libraryImage2'));
  galRow.onclick = () => openGallery();
  wSec.append(galRow);
  const catRow = el('div', 'scene', tt('ui.app.newCatNew'));
  catRow.onclick = () => newWikiCat();
  wSec.append(catRow);
  const renderCat = async (catDir, cat, scopeLabel) => {
    const cEl = el('div', 'chapter');
    const cHead = el('div', 'ch-title');
    // [alpha.124 ข้อ 20] ชื่อหมวด Wiki ผู้ใช้ตั้งเองได้ (wikiCats) → เป็นข้อความ ไม่ใช่ HTML
    cHead.append(catIconEl(cat), ' ' + catLabel(cat) + (scopeLabel ? ` (${scopeLabel})` : ''));
    const addE = el('span', 'row-add', '+'); addE.title = tt('ui.app.newNewCat');
    addE.onclick = (e) => { e.stopPropagation(); addEntity(catDir, cat); };
    cHead.append(addE); cEl.append(cHead);
    makeAccordion(cHead, cEl, 'wcat:' + cat + ':' + (scopeLabel || ''));
    // คลิกขวาหัวหมวด → แก้ไข/ลบ (เฉพาะหมวดที่ผู้ใช้สร้าง / ไม่ใช่หมวดหลัก)
    if (!scopeLabel) cHead.oncontextmenu = (e) => { e.preventDefault();
      const items = [{ label: iconHtml('plus', 14) + tt('ui.app.newListNew'), click: () => addEntity(catDir, cat) }];
      if (!BUILTIN_CATS.includes(cat)) items.push('-',
        { label: iconHtml('edit', 14) + tt('ui.app.editCatNameIcon'), click: () => editWikiCat(cat) },
        { label: iconHtml('trash', 14) + tt('ui.app.delCat'), danger: true, click: () => deleteWikiCat(cat, catDir) });
      else items.push('-', { label: iconHtml('edit', 14) + tt('ui.app.changeIconNameShow'), click: () => editWikiCat(cat) });
      // [alpha.120 ข้อ 7] "หาในดิสก์" ต้องมีทุกหมวด — หมวด Wiki เป็นโฟลเดอร์จริงบนดิสก์
      items.push({ label: tt('ui.app.findDiskFindOn'), click: () => kapi.revealInOS(catDir) });
      popupMenu(e.clientX, e.clientY, items);
    };
    // หัวหมวดรับ drop entity จากหมวดอื่น → ย้ายไฟล์ .json
    cHead.addEventListener('dragover', (e) => {
      if ([...e.dataTransfer.types].includes('text/k2-entity')) { e.preventDefault(); cHead.classList.add('ch-drop'); } });
    cHead.addEventListener('dragleave', () => cHead.classList.remove('ch-drop'));
    cHead.addEventListener('drop', async (e) => {
      cHead.classList.remove('ch-drop');
      let data; try { data = JSON.parse(e.dataTransfer.getData('text/k2-entity')); } catch { return; }
      if (!data || !data.path) return;
      e.preventDefault();
      await moveEntityToCat(data.path, catDir);
    });
    if (await kapi.exists(catDir)) {
      // [alpha.120 ข้อ 2] เอนทิตี้เรียงตามโหมดเดียวกับฉาก
      const entFiles = await kapi.listFiles(catDir, '.json');
      // คีย์โฟลเดอร์เวอร์ชันของหมวดนี้ — คำนวณครั้งเดียว (ไม่ใช่ IPC ต่อเอนทิตี้)
      let catRel = [];
      try { catRel = (await kapi.relative(state.root, catDir)).split(/[\\/]/).filter(Boolean); } catch {}
      const entRows = [];
      for (const f of entFiles) {
        const p = await kapi.join(catDir, f);
        let name = f.replace(/\.json$/, '');
        let ent = null;
        try { ent = await kapi.readJson(p); name = ent.name || name; } catch {}
        entRows.push({ f, p, name, ent,
                       mtime: sortMode === 'modified' ? await kapi.mtime(p).catch(() => 0) : 0 });
      }
      if (sortMode === 'name') entRows.sort((a, b) => _thCmp(a.name, b.name));
      else if (sortMode === 'modified') entRows.sort((a, b) => b.mtime - a.mtime);
      for (const { f, p, name, ent } of entRows) {
        const it = el('div', 'scene wiki-ent');
        // [alpha.124 ข้อ 20] ชื่อเอนทิตี้มาจากไฟล์ของผู้ใช้ → textContent เท่านั้น
        it.append(catIconEl(cat), ' ' + name);
        // บั๊ก #13: ค้นเอนทิตี้ต้องค้น "เนื้อในไฟล์บนดิสก์" ด้วย ไม่ใช่แค่ชื่อที่โชว์
        // (ชื่อเล่น/แท็ก/บทบาท/คำบรรยาย/ฟิลด์เทมเพลตทุกช่อง) — อ่าน .json อยู่แล้วจึงไม่มีค่าใช้จ่ายเพิ่ม
        it.dataset.search = entitySearchBlob(name, ent, cat, scopeLabel) + ' ' + f.toLowerCase();
        // [alpha.120 ข้อ 3] hover บอกชื่อไฟล์พร้อมนามสกุลเสมอ (เอนทิตี้เป็น .json แก้นอกโปรแกรมได้)
        it.title = name + '  (' + f + ')' +
                   (ent && ent.summary ? String.fromCharCode(10) + String(ent.summary).slice(0, 120) : '');
        it.dataset.path = p;
        // [alpha.120 ข้อ 17] จำนวนเวอร์ชัน · [ข้อ 5] ตัวหนา/เอียงตามสถานะแท็บ (เหมือนฉาก)
        addVersionBadge(it, snapCounts, snapKey(...catRel, f));
        applyRowOpenState(it, p);
        it.onclick = () => openEntity(p);
        it.draggable = true;                              // ลากย้ายข้ามหมวดได้
        it.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'copyMove';
          setDrag(e.dataTransfer, 'entity', { path: p, file: p, title: name, cat });   // [alpha.167] + text/plain = ชื่อ (ลงตัวแก้ไข = แทรกชื่อ)
          it.classList.add('sc-dragging');
        });
        it.addEventListener('dragend', () => it.classList.remove('sc-dragging'));
        it.oncontextmenu = (e) => { e.preventDefault(); popupMenu(e.clientX, e.clientY, [
          { label: iconHtml('plus', 14) + tt('ui.app.newListNew'), click: () => addEntity(catDir, cat) },
          '-',
          { label: tt('ui.common.open'), click: it.onclick },
          { label: iconHtml('search', 14) + tt('ui.common.searchSceneFindOn'),
            click: () => findEntityInScenes(p, name, e.clientX, e.clientY) },
          // [alpha.58 ฟีเจอร์ที่ขาด 2] เอนทิตี้เป็นไฟล์ .json แก้นอกโปรแกรมได้ — ต้องหาเจอในดิสก์
          { label: tt('ui.app.findDiskFindOn'), click: () => revealFile(p) },
          { label: iconHtml('history', 14) + tt('ui.app.historyVersion'),
            click: async () => {
              const { fileVersionDialog } = await import('./dialogs.js');
              await fileVersionDialog(p, name, { onRestored: async () => {
                const open = state.tabs.get(p);
                if (open && open.wiki) await open.wiki.reloadIfExists?.();
                await buildTree();
              } });
            } },
          { label: tt('ui.app.repeat'), click: () => duplicateEntity(p) },
          '-',
          { label: tt('ui.app.delMoveTrash'), danger: true, click: () => deleteToTrash(p, name) },
        ]); };
        cEl.append(it);
      }
    }
    wSec.append(cEl);
  };
  const projWiki = await wikiRootOf(state.root);
  const cats = [...BUILTIN_CATS, ...wikiCats().map((c) => c.key)];
  if (await kapi.exists(projWiki)) {
    for (const c of await kapi.listDirs(projWiki)) if (!cats.includes(c)) cats.push(c);
  }
  for (const cat of cats) {
    await renderCat(await kapi.join(projWiki, cat), cat, '');
  }
  for (const secName of await kapi.listDirs(state.root)) {
    const base = await kapi.join(state.root, secName);
    if (!(await kapi.exists(await kapi.join(base, 'section.json')))) continue;
    for (const wname of ['Wiki', 'Bible']) {
      const swiki = await kapi.join(base, wname);
      if (!(await kapi.exists(swiki))) continue;
      for (const c of await kapi.listDirs(swiki)) {
        await renderCat(await kapi.join(swiki, c), c, secName);
      }
      break;
    }
  }
  tree.append(wSec);

  // ---- ถังขยะ (<root>/Recycle) — กู้คืน / ลบถาวร ----
  const recDir = await kapi.join(state.root, 'Recycle');
  const recItems = await kapi.exists(recDir)
    ? (await kapi.listFiles(recDir)).filter((f) => !f.endsWith('.k2restore.json') && !f.endsWith('.vis.csv')) : [];
  const recDirs = await kapi.exists(recDir) ? await kapi.listDirs(recDir) : [];
  const all = [...recItems, ...recDirs];
  const tSec = el('div', 'sec');
  const tHead = el('div', 'sec-title', ttf('ui.app.trash', all.length));
  tSec.append(tHead);
  makeAccordion(tHead, tSec, 'sec:__trash__');
  // [alpha.120 ข้อ 13] คลิกขวาถังขยะ: ล้างถัง · ตั้งเวลาล้างอัตโนมัติ (กระโดดไปตั้งค่าโปรเจกต์) · เปิดโฟลเดอร์
  tHead.oncontextmenu = (e) => { e.preventDefault(); popupMenu(e.clientX, e.clientY, [
    { label: ttf('ui.tree.emptyTrashN', all.length), danger: all.length > 0,
      click: () => emptyRecycle(all.length) },
    { label: tt('ui.tree.purgeNowByDays'), click: async () => {
        await purgeRecycle(state.root, { force: true }); await buildTree(); } },
    '-',
    { label: tt('ui.tree.trashSettings'), click: () => settingsDialog('write', { focus: '#st-recycle' }) },
    { label: tt('ui.app.findDiskFindOn'), click: () => kapi.revealInOS(recDir) },
  ]); };
  for (const f of all) {
    const p = await kapi.join(recDir, f);
    const label = f.replace(/^[a-z0-9]+-/, '');
    const it = el('div', 'scene trash-item', gi('recycle') + ' ' + label);
    it.dataset.search = (label + ' ' + f).toLowerCase();
    it.title = label + '  (' + f + ')';
    it.oncontextmenu = it.onclick = (e) => { e.preventDefault();
      popupMenu(e.clientX, e.clientY, [
        { label: tt('ui.app.recoverRestore'), click: () => restoreFromTrash(p, f) },
        { label: tt('ui.app.findDiskFindOn'), click: () => kapi.revealInOS(p) },
        '-',
        { label: tt('ui.app.del'), danger: true, click: async () => {
            if (!(await confirmBox(ttf('ui.app.delRecoverRestoreCant', label), tt('ui.app.del')))) return;
            await kapi.remove(p); await kapi.remove(p + '.k2restore.json');
            try { if (await kapi.exists(p + '.vis.csv')) await kapi.remove(p + '.vis.csv'); } catch {}
            await buildTree(); setStatus(tt('ui.app.delDone') + label);
          } },
      ]); };
    tSec.append(it);
  }
  tree.append(tSec);
  // ---- สลับ buffer เข้าจอครั้งเดียว (คง scroll เดิม + สถานะขอบเขต/ตัวกรอง) ----
  const real = $('#tree');
  if (!real) { log('warn', tt('ui.app.buildTreeNotHasTree')); return; }
  // [alpha.66r2 ข้อ 1] เดิมจำแค่ scrollTop → ต้นไม้ที่ชื่อฉากยาวจนมีแถบเลื่อนแนวนอน
  // เด้งกลับชิดซ้ายทุกครั้งที่รีเฟรช · ต้องจำทั้งสองแกน
  const scrollTop = real.scrollTop, scrollLeft = real.scrollLeft;
  _treeSwapping = true;
  try { real.replaceChildren(...tree.childNodes); } finally { _treeSwapping = false; }
  real.scrollTop = scrollTop;
  real.scrollLeft = scrollLeft;
  // คงตัวกรองหลังสร้างใหม่ — [alpha.161 · P3] เรียกเสมอ (ฉากเก็บถาวรซ่อนเป็นค่าเริ่มต้น · ขอบเขตบท/เล่มก็ต้องคงอยู่)
  const q = $('#tree-search'); filterTree(q ? q.value : '');
  _rowStateSig = '';                     // ต้นไม้เป็นแถวชุดใหม่ — ลายเซ็นเดิมใช้ไม่ได้แล้ว
  refreshTreeRowStates();                // [alpha.120 ข้อ 5+16] คงตัวหนา/เอียง + แถวที่เลือกไว้
  setupTreeInteractions();               // #tree ถูกย้ายที่ได้ — ผูกอีเวนต์ให้ครบเสมอ (กันซ้ำด้วยธง)
  updateSummaryBar().catch(() => {});
}

// ---------------- กู้คืนจากถังขยะ ----------------

// ---------------- เลือกจากรายการ (dialog แบบเลื่อนดู) ----------------
export function pickFromList(title, items) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', title));
    const list = el('div', 'k-pick-list');
    for (const it of items) {
      const d = el('div', 'k-menu-item', it);
      d.onclick = () => { ov.remove(); resolve(it); };
      list.append(d);
    }
    box.append(list);
    const btns = el('div', 'k-dlg-btns');
    const c = el('button', 'k-cancel', tt('ui.common.cancel'));
    c.onclick = () => { ov.remove(); resolve(null); };
    btns.append(c); box.append(btns); ov.append(box);
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
    document.body.append(ov);
  });
}

// ---------------- inverse roles (v1 assets) ----------------
export const INV_C = { m: null, cat: {} };   // inverse-relationship cache + แผนที่บทบาท→ประเภท (categories)
export async function invertRole(role) {
  if (!INV_C.m) {
    INV_C.m = {};
    try {
      const d = await fetch('inverse_roles.json').then((r) => r.json());
      for (const [a, b] of d.pairs || []) { INV_C.m[a] = b; if (!(b in INV_C.m)) INV_C.m[b] = a; }
      if (d.categories && typeof d.categories === 'object') INV_C.cat = d.categories;
    } catch {}
  }
  return INV_C.m[role] || role;
}
async function warmInverse() { await invertRole(''); }

// รายชื่อบทบาทที่รู้จัก (จาก inverse_roles.json) สำหรับ dropdown ความสัมพันธ์
function knownRoles() { return INV_C.m ? Object.keys(INV_C.m).sort() : []; }

// กล่องผูกความสัมพันธ์: เลือกเป้าหมาย (dropdown) + บทบาท (เลือกจากรายการ หรือพิมพ์เอง)
export function relationDialog(targets, fromName) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', tt('ui.app.bindRelation')));
    const r1 = el('div', 'wiki-row'); r1.append(el('label', null, tt('ui.app.bind')));
    const selT = el('select', 'wiki-input k-dlg-select');
    for (const t of targets) { const o = el('option', null, t); o.value = t; selT.append(o); }
    r1.append(selT); box.append(r1);
    const r2 = el('div', 'wiki-row');
    const lab = el('label', null, ''); r2.append(lab);
    const inR = el('input', 'wiki-input'); inR.setAttribute('list', 'k-roles');
    inR.placeholder = tt('ui.app.eg2');
    const dl = el('datalist'); dl.id = 'k-roles';
    for (const role of knownRoles()) { const o = el('option'); o.value = role; dl.append(o); }
    r2.append(inR, dl); box.append(r2);
    // ประเภทความสัมพันธ์ (ครอบครัว/คนรัก/ศัตรู…) — ใช้ระบายสีเส้นใน Story Network
    const rType = el('div', 'wiki-row');
    rType.append(el('label', null, tt('ui.common.type')));
    const selType = el('select', 'wiki-input k-dlg-select rel-type');
    { const o = el('option', null, tt('ui.common.notSpecify2')); o.value = ''; selType.append(o); }
    for (const ty of REL_TYPES) { const o = el('option', null, ty.label); o.value = ty.key; selType.append(o); }
    rType.append(selType); box.append(rType);
    let typeTouched = false;                      // ผู้ใช้เลือกเองแล้ว → เลิกเดาทับ
    selType.onchange = () => { typeTouched = true; };
    // แสดงตัวอย่างบทบาทฝั่งตรงข้ามแบบสด + เดาประเภทจากบทบาทที่พิมพ์
    const hint = el('div', 'k-hint'); hint.style.margin = '2px 0 8px';
    const upd = () => { lab.textContent = ttf('ui.app.msg3', fromName, selT.value);
      const role = inR.value.trim();
      const inv = (INV_C.m && INV_C.m[role]) || role;
      if (!typeTouched) selType.value = role ? categorizeWith(INV_C.cat, role) : '';
      hint.textContent = role ? ttf('ui.app.sideChapterAuto', inv) : ''; };
    selT.onchange = upd; inR.oninput = upd; upd();
    box.append(hint);
    const btns = el('div', 'k-dlg-btns');
    const c = el('button', 'k-cancel', tt('ui.common.cancel'));
    const ok = el('button', 'k-ok', tt('ui.app.bindRelation'));
    c.onclick = () => { ov.remove(); resolve(null); };
    ok.onclick = () => { const role = inR.value.trim();
      if (!role) { inR.focus(); return; }
      ov.remove(); resolve({ target: selT.value, role, type: selType.value }); };
    btns.append(c, ok); box.append(btns); ov.append(box);
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
    document.body.append(ov); inR.focus();
  });
}

// ---------------- หมวด Wiki ที่ผู้ใช้สร้างเอง ----------------
// เก็บใน project.khn.json → wikiCats: [{key, label, icon}]
// โฟลเดอร์ Wiki/<key> คือของจริง — meta เก็บแค่ "ชื่อไทย + ไอคอน" ให้แสดงผลสวย
// (ลบ meta ทิ้งก็ยังเห็นหมวดอยู่ เพราะ buildTree อ่านจากโฟลเดอร์จริงเสมอ)

export function catLabel(key) { const c = wikiCats().find((x) => x.key === key);
                         return (c && c.label) || CAT_TH[key] || key; }
// ไอคอนหมวด = ชื่อไอคอนใน icons.js เท่านั้น — meta เก่าที่เก็บอีโมจิไว้ (ก่อนย้ายมาใช้ไอคอน SVG)
// จะถูกมองข้าม แล้วตกไปใช้ไอคอนประจำหมวด/bookmark แทน (ไม่งั้นได้ svg ว่าง)
export function catIcon(key) { const c = wikiCats().find((x) => x.key === key);
  return (c && hasIcon(c.icon) ? c.icon : null) || CAT_ICON[key] || 'bookmark'; }
export function catIconHtml(key, sz) { return iconHtml(catIcon(key), sz || 16); }
/**
 * [alpha.124 ข้อ 20] ไอคอนหมวดแบบ **DOM node** — คู่แฝดของ `catIconHtml` ที่ปลอดภัยกว่า
 * มีไว้ให้ทุกจุดที่ต้องต่อไอคอนกับ "ข้อความของผู้ใช้" (ชื่อบท · ชื่อเอนทิตี้) โดยไม่ต้องแตะ
 * `innerHTML` — ซึ่งกฎข้อ 11 ของโปรเจกต์ห้ามไว้ตรง ๆ อยู่แล้ว (ชื่อไฟล์/ชื่อบทมี `<` ได้)
 */
export function catIconEl(key, sz) { return icon(catIcon(key), sz || 16); }

// บั๊ก #21: "ค้นหาในฉาก" จากคลิกขวาเอนทิตี้ Wiki ใน Explorer
// ใช้ดัชนี auto-link ที่มีอยู่แล้ว (ตัวเดียวกับแท็บ Backlinks / ศูนย์รวม) — ไม่สแกนไฟล์ซ้ำ
// คืนรายการฉากไว้ให้ selftest ตรวจได้ด้วย (UI เป็นเมนูป๊อปอัป จึงเช็คตรง ๆ ไม่ได้)
/**
 * [alpha.58] "หาในดิสก์" — เปิดโฟลเดอร์ของไฟล์แล้วเลือกไฟล์นั้นให้ (File Explorer / Finder)
 * ใช้ร่วมกันทั้งหน้า Wiki · เมนูคลิกขวาใน Explorer · และที่อื่นที่อยากชี้ไฟล์จริง
 * @returns {Promise<boolean>} สำเร็จไหม (main คืน false เมื่อ path ไม่มีจริง)
 */
export async function revealFile(p) {
  if (!p) { setStatus(tt('ui.app.notHasFileOpen')); return false; }
  try {
    const ok = await kapi.revealInOS(p);
    setStatus(ok ? tt('ui.app.openFolderDone') + p : tt('ui.app.notFoundFileDisk') + p);
    return !!ok;
  } catch (e) { log('warn', tt('ui.app.openFolderNotOk'), e); return false; }
}

export async function findEntityInScenes(entityPath, name, x, y) {
  setStatus(tt('ui.app.busySearchSceneMention') + name + '” …');
  await ensureAutoLink();
  const links = (getBacklinksFor(entityPath) || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0));
  if (!links.length) { setStatus(tt('ui.app.notHasSceneMention') + name + '”'); return links; }
  const items = links.map((l) => ({
    label: iconHtml('file', 14) + ' ' + (l.title || l.sceneId) +
           '  <span class="dim">' + (l.count || 1) + gi('times') + (l.via ? ' · ' + l.via : '') + '</span>',
    click: async () => {
      const hit = await findScenePath(state.root, l.sceneId);
      if (hit && (await kapi.exists(hit.path))) openScene(hit.path, hit.title);
      else setStatus(tt('ui.app.notFoundFileScene') + (l.title || l.sceneId));
    },
  }));
  items.unshift({ label: ((a) => `<b>${txf('ui.app.sceneMention2', a)}</b>`)([links.length, name]), disabled: true }, '-');
  popupMenu(typeof x === 'number' ? x : 80, typeof y === 'number' ? y : 80, items);
  setStatus(ttf('ui.app.foundSceneMention', links.length, name));
  return links;
}
// เอาชื่อไทยของหมวดเองไปใส่ CAT_TH ด้วย เพื่อให้ WikiEditor/ตัวจัดการเทมเพลตแสดงตรงกัน
// คีย์หมวดทั้งหมดที่ควรเลือกได้ (ในตัวเดิม + ของผู้ใช้ + โฟลเดอร์ที่มีอยู่จริง)
export async function allCatKeys() {
  const keys = [...BUILTIN_CATS, ...wikiCats().map((c) => c.key)];
  try {
    const w = await wikiRoot();
    if (await kapi.exists(w)) for (const d of await kapi.listDirs(w)) if (!keys.includes(d)) keys.push(d);
  } catch {}
  return keys.filter(Boolean);
}
export async function wikiRoot() {
  const w = await kapi.join(state.root, 'Wiki');
  if (await kapi.exists(w)) return w;
  const b = await kapi.join(state.root, 'Bible');
  return (await kapi.exists(b)) ? b : w;
}
// key ปลอดภัยสำหรับใช้เป็นชื่อโฟลเดอร์ (ชื่อไทยล้วน → cat-xxxx)
export function catKeyFrom(label) {
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return ascii.length >= 2 ? ascii : 'cat-' + Date.now().toString(36).slice(-5);
}




export function catEditDialog(init, title) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.innerHTML = ((a) => `
      <div class="k-dlg-title">${a[0]}</div>
      <div class="k-row" style="flex-direction:column;align-items:stretch;gap:6px;margin:6px 0">
        <label>${tx('ui.app.nameCat')}</label><input type="text" class="k-dlg-input" id="cat-label">
      </div>
      <div class="k-row" style="flex-direction:column;align-items:stretch;gap:6px;margin:10px 0 2px">
        <label>${tx('ui.app.icon')}</label><input type="text" class="k-dlg-input" id="cat-icon" maxlength="4">
      </div>
      <div class="k-dlg-btns"><button class="k-cancel">${tx('ui.common.cancel')}</button><button class="k-ok">${tx('ui.common.msg3')}</button></div>`)([title]);
    ov.append(box); document.body.append(ov);
    const iL = box.querySelector('#cat-label'), iI = box.querySelector('#cat-icon');
    iL.value = init.label || ''; iI.value = init.icon || gi('bookmark');
    const done = (v) => { ov.remove(); resolve(v); };
    const ok = () => { const l = iL.value.trim(); if (!l) { iL.focus(); return; }
                       done({ label: l, icon: iI.value.trim() || gi('bookmark') }); };
    box.querySelector('.k-dialog .k-ok') || 0;
    box.querySelector('.k-ok').onclick = ok;
    box.querySelector('.k-cancel').onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    iL.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') done(null); };
    iL.focus(); iL.select();
  });
}

// ---------------- entity index (สำหรับ network / relationships) ----------------
/**
 * @param o.entitiesOnly [alpha.167] หน้า Wiki อย่างเดียว (ไม่ไล่ฉาก/บท/เล่ม) — แถบซ้ายของแผนที่ · กระดานอารมณ์
 *   ใช้แค่รายชื่อตัวละคร/สถานที่ · ของเดิมอ่าน scenes.json + frontmatter ทุกฉากทุกครั้ง = แผงช้าตามขนาดโปรเจกต์
 */
export async function loadAllEntities(o = {}) {
  const out = [];
  const scan = async (wikiDir) => {
    if (!(await kapi.exists(wikiDir))) return;
    for (const cat of await kapi.listDirs(wikiDir)) {
      const catDir = await kapi.join(wikiDir, cat);
      for (const f of await kapi.listFiles(catDir, '.json')) {
        try {
          const p = await kapi.join(catDir, f);
          const e = await kapi.readJson(p);
          // [alpha.71 ข้อ 2] เดิมส่ง image:'' ตายตัว → Story Network/แผนที่ไม่มีทางเห็นรูปประจำตัวเลย
          // รูปอยู่ที่ e.images[] (ใบแรก = รูปประจำตัว) — อ่านผ่าน entityPortrait ที่รองรับไฟล์เก่า (string[])
          const port = entityPortrait(e);
          if (e.name) out.push({ name: e.name, cat, file: p,
                                 tags: Array.isArray(e.tags) ? e.tags : [],
                                 relationships: e.relationships || [],
                                 image: port ? port.file : '', desc: e.desc||e.synopsis||'' });
        } catch {}
      }
    }
  };
  await scan(await kapi.join(state.root, 'Wiki'));
  await scan(await kapi.join(state.root, 'Bible'));
  for (const sec of await kapi.listDirs(state.root)) {
    await scan(await kapi.join(state.root, sec, 'Wiki'));
    await scan(await kapi.join(state.root, sec, 'Bible'));
  }
  if (o.entitiesOnly) return out;
  // add scene/chapter/section structural nodes
  try {
    const skip = new Set(['Wiki','Bible','Images','Memos','Research','Snapshots', '.k2history','Plugins','Recycle','Sessions','Starters','.git','Models']);
    // [alpha.166 · รอบ 2] ไทม์ไลน์เรื่องของผังต้องรู้ลำดับฉากจริง — เล่ม → บท → ฉาก ตามช่อง order (ไม่ใช่ลำดับโฟลเดอร์บนดิสก์)
    let seq = 0;
    const secs = [];
    for (const sec of await kapi.listDirs(state.root)) {
      if (skip.has(sec)) continue;
      const secPath = await kapi.join(state.root, sec);
      const sj = await kapi.join(secPath, 'section.json');
      if (!(await kapi.exists(sj))) continue;
      let so = 0; try { so = +((await kapi.readJson(sj)).order) || 0; } catch {}
      secs.push({ sec, secPath, so });
    }
    secs.sort((a, b) => a.so - b.so);
    for (const { sec, secPath } of secs) {
      const draftRoot = await kapi.join(secPath, 'Draft');
      if (!(await kapi.exists(draftRoot))) continue;
      const dns = await kapi.listDirs(draftRoot);
      if (!dns.length) continue;
      const dPath = await kapi.join(draftRoot, dns[0]);
      const draftPath = await kapi.join(dPath, 'draft.json');
      if (!(await kapi.exists(draftPath))) continue;
      const draft = await kapi.readJson(draftPath);
      const chs = (draft.chapters||[]).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const ch of chs) {
        const chTitle = ch.title || '';
        if (chTitle) {
          out.push({ name: chTitle, cat: 'chapter', file: draftPath,
                     tags: [], relationships: [], image: '', desc: ch.desc||'',
                     sectionName: draft.title||sec, chName: chTitle,
                     sectionFile: draftPath, dPath, chData: ch });
        }
        const scenesPath = await kapi.join(dPath, 'scenes.json');
        if (await kapi.exists(scenesPath)) {
          try {
            const scenes = await kapi.readJson(scenesPath);
            const rows = ((scenes.chapters||{})[ch.guid] || []).filter((r) => r.type !== 'memo')
              .sort((a, b) => (a.order || 0) - (b.order || 0));
            for (const r of rows) {
              const sfName = r.fileName||r.file||'';
              const sfPath = sfName ? await kapi.join(dPath, 'Chapters', ch.folderName||'', sfName) : '';
              out.push({ name: r.title||sfName.replace(/\.md$/,''), cat: 'scene', file: sfPath,
                         tags:[], relationships:[], image:'', desc:r.synopsis||'',
                         chapterId: chTitle, ch, sid: r.id, dPath, seq: ++seq });
            }
          } catch {}
        }
      }
      if (draft.title && chs.length) {
        out.push({ name: draft.title||sec, cat: 'section', file: draftPath,
                   tags:[], relationships:[], image:'', desc:'',
                   sectionName: draft.title||sec, dPath, secPath, secData: draft });
      }
    }
  } catch(e){console.error('loadStructNodes:',e);}
  return out;
}

// ---------------- Story Network ----------------
// [alpha.62 บั๊ก 16] เดิมเป็นแท็บเอกสาร `::network::` — แย่งแถบแท็บกับฉากที่กำลังเขียน
// และเปิดคู่กับต้นฉบับไม่ได้ · ตอนนี้เป็นแผงเต็มตัว (dock/tab/float ได้เหมือนแผงอื่น)
/**
 * [alpha.166] เพิ่มความสัมพันธ์ในไฟล์ Wiki หนึ่งไฟล์ — แท็บของไฟล์นั้นเปิดค้างและยังไม่บันทึก = เติมลงแท็บแทน
 * (เขียนดิสก์ทับตอนแท็บค้าง = บันทึกครั้งถัดไปของแท็บลบความสัมพันธ์ใหม่ทิ้ง · กฎ alpha.156)
 * @returns {Promise<boolean>} true = เพิ่มจริง (false = มีอยู่แล้ว)
 */
async function addEntityRelation(file, rel) {
  const same = (r) => (r.targetName || r.target) === rel.targetName;
  const t = state.tabs.get(file);
  if (t && t.wiki && t.wiki.dirty) {
    const rs = (t.wiki.e.relationships = t.wiki.e.relationships || []);
    if (rs.some(same)) return false;
    rs.push(rel); t.wiki.render(); t.wiki.markDirty();
    return true;
  }
  const r = await mutateJson(kapi, file, (d) => {
    d.relationships = Array.isArray(d.relationships) ? d.relationships : [];
    if (d.relationships.some(same)) return false;
    d.relationships.push(rel);
  });
  if (r.changed && t && t.wiki) await t.wiki.reloadIfExists();
  return r.changed;
}

/** [alpha.166] ผูกความสัมพันธ์ a → b จากผัง (กล่องเดียวกับหน้า Wiki · ฝั่ง b ได้บทบาทกลับด้าน) */
export async function createEntityRelation(a, b) {
  if (!a || !b || !a.file || !b.file || a === b) return false;
  await warmInverse();
  const res = await relationDialog([b.name], a.name);
  if (!res) return false;
  const role = res.role, type = res.type || categorizeWith(INV_C.cat, role);
  const inv = (INV_C.m && INV_C.m[role]) || role;
  try {
    const x = await addEntityRelation(a.file, { targetName: b.name, role, type });
    const y = await addEntityRelation(b.file, { targetName: a.name, role: inv, type });
    logAction('network', 'relation', { from: a.file, to: b.file });
    setStatus(ttf('ui.app.newRelationBetween', role, a.name, b.name));
    return x || y;
  } catch (e) { setStatusError(failText(tt('ui.netUi.relFail'), e)); return false; }
}

/**
 * [alpha.166] นำเข้ารูปฉากหลัง/โมเดล 3 มิติของผัง — ก๊อปเข้าโปรเจกต์ (Images/ · Models/) แล้วคืนทางสัมพัทธ์
 * (ทางเต็มของเครื่องห้ามลงไฟล์ผลงาน — ย้ายโฟลเดอร์/เปิดอีกเครื่องแล้วต้องยังเจอ)
 */
async function importNetAsset(kind) {
  if (!state.root) return '';
  const src = kind === 'model' ? await kapi.openFileDialog('model3d') : await kapi.openImageDialog();
  if (!src) return '';
  const dirName = kind === 'model' ? 'Models' : 'Images';
  const name = await kapi.copyInto(src, await kapi.join(state.root, dirName));
  logAction('network', 'import ' + kind, { from: src, to: dirName + '/' + name });
  return dirName + '/' + name;
}

export let netInst = null;
export async function renderNetworkPanel() {
  const host = $('#net-body');
  if (!host) return false;
  if (netInst && host.firstChild) { netInst.refresh(); netInst._fit(); return true; }
  host.innerHTML = '';
  try {
    netInst = new StoryNetwork(host, {
      loadEntities: async () => {
        try {
          const ents = await loadAllEntities();
          // [alpha.71 ข้อ 2] โหลดรูปประจำตัวล่วงหน้า — ต้อง **รอให้รูปโหลดเสร็จจริง** ก่อนคืนค่า
          // ของเดิมตั้ง img.src แล้วคืนทันที → draw() รอบแรกวาดตอนรูปยังว่าง แล้วไม่มีใครสั่งวาดใหม่อีก
          // (ประกอบกับ loadAllEntities ที่ส่ง image:'' มาตลอด รูปจึงไม่เคยขึ้นเลยสักครั้ง)
          await Promise.all(ents.map(async (e) => {
            if (!e.image) return;
            try {
              const url = await resolveImageUrl(e.image);
              if (!url) return;
              const img = new Image();
              await new Promise((res) => { img.onload = res; img.onerror = res; img.src = url; });
              if (img.naturalWidth) e._img = img;
            } catch {}
          }));
          return ents;
        } catch(e) { console.error('SN loadEntities failed:', e); return []; }
      },
      onOpen: (n) => openEntity(n.file),
      onOpenScene: (file) => openScene(file, null),
      // [alpha.166] ลากจากโหนดหนึ่งไปอีกโหนด (เครื่องมือ "ผูกความสัมพันธ์") → กล่องผูกความสัมพันธ์ตัวเดียวกับหน้า Wiki
      // (บทบาทฝั่งตรงข้ามอัตโนมัติจาก inverse_roles · เดาประเภทจากบทบาท) — เดิม onCreateRel ถูกส่งมาแต่ผังไม่เคยเรียก
      // และเขียนบทบาทเดียวกันทั้งสองฝั่ง ("พ่อ" ↔ "พ่อ")
      onCreateRel: (a, b) => createEntityRelation(a, b),
      // [alpha.166] ฉากหลัง/โมเดลของผังเป็นค่าของผลงาน (project.khn.json → settings.netScene)
      onSceneChange: (scene) => { state.settings.netScene = scene; saveProjectMetaSoon(); },
      // ทางสัมพัทธ์ของโปรเจกต์ (Images/x.png · Models/x.glb) → ทางเต็ม / URL
      assetPath: (rel) => {
        if (!rel || !state.root) return '';
        const sep = state.root.includes('\\') ? '\\' : '/';
        return state.root.replace(/[\\/]+$/, '') + sep + String(rel).split('/').join(sep);
      },
      assetUrl: async (rel) => (rel && state.root ? kapi.toFileURL(await kapi.join(state.root, rel)) : ''),
      importAsset: (kind) => importNetAsset(kind),
      onReveal: (file) => { try { kapi.revealInOS(file); } catch {} },
      // structural node ops — เอามาจาก explorer โดยตรง
      onDeleteStruct: async (node) => {
        try {
          if (node.cat === 'scene' && node.dPath && node.ch) {
            await deleteScene(node.dPath, node.chData || node.ch, node.ch);
          } else if (node.cat === 'chapter' && node.dPath && node.chData) {
            await deleteChapter(node.dPath, node.chData);
          } else if (node.cat === 'section' && node.secPath && node.secData) {
            await deleteSection(node.secPath, node.secData);
          }
        } catch(e) { console.error('onDeleteStruct:', e); }
      },
      onRenameStruct: async (node) => {
        try {
          if (node.cat === 'scene' && node.dPath && node.chData && node.ch) {
            await renameScene(node.dPath, node.chData, node.ch);
          } else if (node.cat === 'chapter' && node.dPath && node.chData) {
            await renameChapter(node.dPath, node.chData);
          } else if (node.cat === 'section' && node.secPath && node.secData) {
            await renameSection(node.secPath, node.secData);
          }
        } catch(e) { console.error('onRenameStruct:', e); }
      },
      onDuplicateStruct: async (node) => {
        try {
          if (node.cat === 'scene' && node.dPath && node.chData && node.ch) {
            await duplicateScene(node.dPath, node.chData, node.ch);
          }
        } catch(e) { console.error('onDuplicateStruct:', e); }
      },
      onAddChild: async (node) => {
        try {
          if (node.cat === 'section') {
            await addSection();
          } else if (node.cat === 'chapter' && node.dPath) {
            await addScene(node.dPath, node.chData);
          }
        } catch(e) { console.error('onAddChild:', e); }
      },
    });
  } catch (e) {
    log('error', 'StoryNetwork constructor failed', e);
    return false;
  }
  setTimeout(() => { try { netInst._fit(); netInst.refresh(); } catch {} }, 60);
  return true;
}

async function resolveImageUrl(imgPath) {
  if (!imgPath || !state.root) return '';
  try {
    // try in Images folder
    let p = await kapi.join(state.root, 'Images', imgPath);
    if (await kapi.exists(p)) return await kapi.toFileURL(p);
    // try relative to Wiki entity location
    p = await kapi.join(state.root, 'Wiki', imgPath);
    if (await kapi.exists(p)) return await kapi.toFileURL(p);
    // try Bible
    p = await kapi.join(state.root, 'Bible', imgPath);
    if (await kapi.exists(p)) return await kapi.toFileURL(p);
  } catch {}
  return '';
}

/** refresh Story Network from external callers (wiki-ui save, etc.) */
export function refreshNetwork() {
  if (netInst && isPanelOpen('network')) {
    // อ่านสีใหม่ทุกครั้ง — ไม่งั้นสีที่ผู้ใช้ตั้งใน Settings จะมีผลก็ต่อเมื่อสร้างแผงใหม่
    try { netInst.readColors(); } catch {}
    netInst.refresh();
  }
}

async function openNetwork() {
  showPanel('network');
  await renderFeaturePanel('network');
  refreshToolbar();
}

// ---------------- โน้ต (memo) ในบท ----------------
// แนวคิด: memo ก็คือฉากชนิดหนึ่ง (row.type === 'memo' + meta.type: memo) เก็บใน Chapters/ ได้เหมือนฉาก
// ต่างกันแค่ "ไม่ถูกรวมตอนส่งออกฉบับร่าง" → ใช้เขียนโน้ตคาไว้ในบทได้โดยไม่ปนกับต้นฉบับ
async function moveMemoToChapter(memoPath, dPath, ch, beforeId) {
  // [alpha.160 · P0-2] ไฟล์ต้นทางถูกลบท้ายฟังก์ชัน — งานค้างของแท็บต้องลงไฟล์ก่อน (บันทึกไม่ผ่าน = ไม่ย้าย)
  const mt = state.tabs.get(memoPath);
  if (!(await flushTabForMove(mt))) return false;
  if (mt) closeTab(memoPath, { discard: true });
  const { meta, body } = parseMdFile(await kapi.readFile(memoPath));
  const title = meta.title || (memoPath.split(/[\\/]/).pop() || 'memo').replace(/\.md$/i, '');
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  const list = (d.chapters[ch.guid] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const used = new Set(list.map((x) => x.fileName));
  let n = 1, fileName;
  do { fileName = 'memo-' + String(n++).padStart(2, '0') + '.md'; } while (used.has(fileName));
  // [alpha.160 · P0-1] ย้ายไฟล์ = เธรดคอมเมนต์ของไฟล์ต้นทางต้องตามไปด้วย
  await writeKeepingComments(await kapi.join(dPath, 'Chapters', ch.folderName, fileName),
                       dumpMdFile({ ...meta, title, type: 'memo' }, body), memoPath);
  const row = { id: guid(), title, order: list.length + 1, fileName, type: 'memo' };
  // [alpha.159 · M1] แทรกแถวผ่านคิว (อ่านสด) — ลำดับคิดใหม่จากของล่าสุดในไฟล์ ไม่ใช่ก้อนที่อ่านไว้ก่อนเขียนไฟล์
  // [alpha.162 · W1-3] ★ **ขึ้นทะเบียนก่อน แล้วค่อยลบต้นทาง** — เดิมลบก่อน ถ้าขั้นเขียนทะเบียนล้ม
  // (ดิสก์เต็ม · ไฟล์ถูกล็อก) ไฟล์จะไปนอนอยู่ในโฟลเดอร์บทโดยไม่มีแถวชี้ถึง = ผู้ใช้มองไม่เห็นทั้งสองที่
  // ลำดับใหม่: แย่ที่สุดคือได้ของซ้ำสองที่ ซึ่งเห็นได้และลบเองได้
  await mutateJson(kapi, sf, (fresh) => {
    fresh.chapters = fresh.chapters || {};
    const cur = (fresh.chapters[ch.guid] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const di = beforeId ? cur.findIndex((x) => x.id === beforeId) : cur.length;
    cur.splice(di < 0 ? cur.length : di, 0, row);
    cur.forEach((x, i) => { x.order = i + 1; });
    fresh.chapters[ch.guid] = cur;
  });
  await kapi.remove(memoPath);
  await buildTree();
  setStatus(ttf('ui.app.moveNoteInChapter', title, ch.title));
  return true;
}

// ย้ายแถวในบทกลับออกไปเป็นไฟล์ใน Memos/
async function moveRowToMemos(dPath, ch, sc) {
  const src = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
  const st = state.tabs.get(src);                           // [alpha.160 · P0-2]
  if (!(await flushTabForMove(st))) return null;
  if (st) closeTab(src, { discard: true });
  const memoDir = await kapi.join(state.root, 'Memos');
  await kapi.mkdir(memoDir);
  const base = safeName(sc.title || 'memo');
  let n = 0, dst;
  do { dst = await kapi.join(memoDir, base + (n ? '-' + n : '') + '.md'); n++; } while (await kapi.exists(dst));
  const { meta, body } = parseMdFile(await kapi.readFile(src));
  await writeKeepingComments(dst, dumpMdFile({ ...meta, title: sc.title, type: 'memo' }, body), src);   // [alpha.160 · P0-1]
  const sf = await kapi.join(dPath, 'scenes.json');
  // [alpha.162 · W1-3] ถอดแถวออกจากทะเบียนก่อน แล้วค่อยลบไฟล์ต้นทาง — ขั้นที่ล้มแล้วเสียหายกว่า
  // คือขั้นทะเบียน (แถวชี้ไฟล์ที่ไม่มีแล้ว = เปิดไม่ได้) ส่วนไฟล์ที่ค้างอยู่เนื้อหายังอยู่ครบใน Memos/
  await mutateJson(kapi, sf, (d) => {                       // [alpha.159 · M1]
    d.chapters = d.chapters || {};
    d.chapters[ch.guid] = (d.chapters[ch.guid] || []).filter((x) => x.id !== sc.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0)).map((x, i) => ({ ...x, order: i + 1 }));
  });
  await kapi.remove(src);
  await buildTree();
  setStatus(ttf('ui.app.moveOutMEMODone', sc.title));
  return dst;
}

// สลับให้ฉากกลายเป็นโน้ต (หรือกลับเป็นฉาก) — โน้ตจะไม่ถูกรวมตอนส่งออก
async function setRowMemo(dPath, ch, sc, on) {
  const sf = await kapi.join(dPath, 'scenes.json');
  // [alpha.159 · M1] แก้แถวผ่านคิว — คืนสำเนาของแถวให้ขั้นต่อไป (อัปเดต frontmatter) ใช้
  const res = await mutateJson(kapi, sf, (d) => {
    const r = ((d.chapters || {})[ch.guid] || []).find((x) => x.id === sc.id);
    if (!r) return false;
    if (on) r.type = 'memo'; else delete r.type;
    return { ...r };
  });
  const row = res.changed ? res.result : null;
  if (!row) return false;
  // อัปเดต frontmatter ของไฟล์ให้ตรงกัน
  try {
    const file = await kapi.join(dPath, 'Chapters', ch.folderName, row.fileName);
    const { meta, body } = parseMdFile(await kapi.readFile(file));
    if (on) meta.type = 'memo'; else delete meta.type;
    // [alpha.159 · M1] พาเธรดคอมเมนต์ไปด้วย + แท็บที่เปิดอยู่ต้องได้ meta ใหม่ (กฎ alpha.156)
    await writeKeepingComments(file, dumpMdFile(meta, body));
    await syncOpenTabMeta(file);
  } catch {}
  await buildTree();
  setStatus(on ? ttf('ui.app.noteDoneNotMerge', row.title) : ttf('ui.app.backSceneNormalDone', row.title));
  return true;
}

// หา chapter object จาก guid (ใช้ตอนวางของข้ามส่วนของต้นไม้)
async function chapterByGuid(dPath, guidWanted) {
  try {
    const dj = await kapi.readJson(await kapi.join(dPath, 'draft.json'));
    return (dj.chapters || []).find((c) => c.guid === guidWanted) || null;
  } catch { return null; }
}

// ---------------- หน้าต่างลอย (floating window) — แบบ Resprite: ลากหัว/ย่อ/คืนแท็บ/ปรับขนาด ----------------
// z-index ของหน้าต่างลอยต้องอยู่ในช่วง 60–74 เท่านั้น
// ถ้าปล่อยให้ ++ ไปเรื่อย ๆ จะไต่ขึ้นไปบัง FAB (76) และกล่องโต้ตอบ (80) — บั๊กข้อ 9
const FLOAT_Z_MIN = 60, FLOAT_Z_MAX = 74;
let _floatZ = FLOAT_Z_MIN;
function bringFloatFront(win) {
  if (_floatZ >= FLOAT_Z_MAX) {              // ชนเพดาน → เรียงใหม่จากล่างสุด
    _floatZ = FLOAT_Z_MIN;
    [...document.querySelectorAll('.float-win')]
      .sort((a, b) => (+a.style.zIndex || 0) - (+b.style.zIndex || 0))
      .forEach((w) => { w.style.zIndex = String(_floatZ++); });
  }
  win.style.zIndex = String(++_floatZ);
}

function tabByBtn(btn) {
  for (const [f, t] of state.tabs) if (t.tabBtn === btn) return [f, t];
  return [null, null];
}

// ดึงแท็บออกมาเป็นหน้าต่างลอย (ย้าย DOM ของ pane เข้าไปทั้งก้อน — instance ตัวแก้ไขไม่ถูกสร้างใหม่)
function floatTab(file) {
  const t = state.tabs.get(file);
  if (!t || t.floatWin) { if (t && t.floatWin) bringFloatFront(t.floatWin); return t ? t.floatWin : null; }

  const win = el('div', 'float-win');
  const bar = el('div', 'float-bar');
  bar.append(el('span', 'float-title', t.title));
  const btns = el('span', 'float-btns');
  const bMin = el('span', 'float-btn', '—'); bMin.title = tt('ui.common.collapse');
  const bDock = el('span', 'float-btn', gi('maximize')); bDock.title = tt('ui.app.restoreTab');
  const bX = el('span', 'float-btn', gi('times')); bX.title = tt('ui.common.close');
  btns.append(bMin, bDock, bX); bar.append(btns);
  const body = el('div', 'float-body');
  const grip = el('div', 'float-grip');
  win.append(bar, body, grip);
  document.body.append(win);

  body.append(t.pane);                      // ย้าย pane เดิมเข้ามา (ไม่สร้างใหม่ → ไม่เสียสถานะ)
  t.pane.classList.add('on');
  t.floatWin = win;
  syncSplitPanes();          // ถ้าแท็บนี้อยู่ในช่องแยกจอ → ช่องนั้นต้องวาดใหม่เป็นช่องว่าง
  bringFloatFront(win);

  const n = [...state.tabs.values()].filter((x) => x.floatWin).length;
  const savedBox = uiLayout()['floatwin:' + file];
  makeDraggable(win, bar, {
    key: 'floatwin:' + file, resizable: true, snap: true,
    defaultPos: { left: 180 + n * 26, top: 90 + n * 26, width: 720, height: 520 },
  });

  // จับมุมขวาล่างขยาย
  grip.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = win.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const move = (ev) => {
      win.style.width = Math.max(320, r.width + ev.clientX - sx) + 'px';
      win.style.height = Math.max(180, r.height + ev.clientY - sy) + 'px';
      refitTab(t);
    };
    const w0 = win.style.width, h0 = win.style.height;
    // [alpha.165] Esc = ยกเลิกการย่อ/ขยาย คืนขนาดเดิม
    const offEsc = escCancelDrag(() => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      win.style.width = w0; win.style.height = h0; refitTab(t);
    });
    const up = () => { offEsc(); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
                       saveFloatWinBox(file, win); };      // [alpha.116 ข้อ 5] จำขนาดด้วย ไม่ใช่แค่ตำแหน่ง
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });

  // [alpha.116 ข้อ 5] สถานะ "ย่อ" ต้องถูกจำไว้เหมือนตำแหน่ง — เดิมกดย่อแล้วปิด/เปิดใหม่ก็คลี่กลับทุกครั้ง
  if (savedBox && savedBox.min) win.classList.add('min');
  bMin.onclick = () => { win.classList.toggle('min'); refitTab(t); saveFloatWinBox(file, win); };
  bDock.onclick = () => dockTab(file);
  bX.onclick = () => closeTab(file, { ask: true });          // [alpha.124 ข้อ 17] ผู้ใช้สั่งปิดเอง
  bar.ondblclick = (e) => { if (!e.target.closest('.float-btn')) dockTab(file); };
  win.addEventListener('mousedown', () => bringFloatFront(win));

  t.tabBtn.classList.add('floated');
  setStatus(ttf('ui.app.splitF', t.title));
  setTimeout(() => refitTab(t), 60);
  return win;
}

// คืนหน้าต่างลอยกลับเป็นแท็บปกติ
function dockTab(file) {
  const t = state.tabs.get(file);
  if (!t || !t.floatWin) return false;
  $('#panes').append(t.pane);
  t.floatWin.remove();
  t.floatWin = null;
  t.tabBtn.classList.remove('floated');
  syncSplitPanes();          // ผนึกคืน → ช่องที่เคยว่างต้องรับ pane กลับ
  activate(file);
  setTimeout(() => refitTab(t), 60);
  setStatus(ttf('ui.app.restoreF', t.title));
  return true;
}

function toggleFloatTab(file) {
  const t = state.tabs.get(file);
  if (!t) return false;
  return t.floatWin ? dockTab(file) : !!floatTab(file);
}

// canvas/ตัวแก้ไขต้องวัดขนาดใหม่หลังย้าย DOM หรือปรับขนาดหน้าต่าง
function refitTab(t) {
  try {
    t.planner?._fit?.();
    t.net?._fit?.();
    t.gal?._fit?.();
    (t.editor || t.sp || t.plain)?.focus?.();
  } catch {}
}

// เลื่อน Explorer ไปที่ไฟล์นี้ + ไฮไลต์ให้เห็น (ใช้จากปุ่ม 📂 ในเอกสาร ของ Planner)
function revealInExplorer(file) {
  if (!file) return false;
  const row = document.querySelector(`.scene[data-path="${CSS.escape(file)}"]`);
  if (!row) { setStatus(tt('ui.app.notFoundFileExplorer')); return false; }
  const sec = row.closest('.sec');
  if (sec && sec.classList.contains('collapsed')) sec.classList.remove('collapsed');
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.add('reveal-flash');
  setTimeout(() => row.classList.remove('reveal-flash'), 1600);
  setStatus(tt('ui.app.showPosExplorerDone'));
  return true;
}

// ---------------- Planner (กระดานวางแผน) ----------------
// [alpha.62 บั๊ก 16] เป็นแผงแล้วเหมือนกัน — กระดานวางแผนควรเปิดคู่กับฉากที่กำลังเขียนได้
export let plannerInst = null;

/**
 * [alpha.150] กระดานที่ "ใช้งานอยู่จริง" — ต้องมีตัวกระดานและแผงต้องเห็นอยู่บนจอ
 * (ปุ่มจัดแนวตั้งบนแถบลอยอ่านค่านี้เพื่อตัดสินว่าตัวเองกดได้ไหม)
 */
export function activePlanner() {
  const p = plannerInst;
  if (!p || !p.pane || !p.pane.isConnected) return null;
  // ★ `offsetParent === null` เป็นเกณฑ์ "ไม่เห็น" ที่ใช้กันทั้งโปรแกรม แต่ element ที่เป็น
  // `position:fixed` คืน null เสมอ (บทเรียนข้อ 6) — ซึ่งคือกระดานตอน **เต็มจอ** พอดี
  // จึงยกเว้นกรณีเต็มจอไว้ตรง ๆ แทนการเปลี่ยนเกณฑ์ทั้งอัน (เกณฑ์กว้างกว่านี้เคยทำให้คีย์ลัด
  // ของกระดานทำงานตอนแผงถูกปิดอยู่ แล้วไปรบกวนเทสอื่น)
  const full = p.pane.classList.contains('planner-fullscreen');
  return (full || p.pane.offsetParent !== null) ? p : null;
}
// toolbar-ui.js อยู่ชั้นล่างกว่า app.js (import ทางเดียว) — ส่งผ่านหน้าต่างเพื่อไม่ให้เกิด import วนกลับ
window.k2ActivePlanner = activePlanner;
// [alpha.152 ข้อ 5] เริ่มติดตามว่าผู้ใช้กำลัง "เลือกแผงไหนอยู่" — แผงที่มีคีย์ลัดถามจากที่นี่
try { bindPanelFocus(); } catch {}
// [alpha.167] หยิบใส่: ทุกแผงรับของที่ลากมา (ตัวกลาง — แผงที่มีตัวรับเองชนะเสมอ)
try { installPanelDrop(); } catch {}
// [alpha.152 ข้อ 4] กระดานมีประวัติย้อนกลับของตัวเอง → ตอนถูกเลือกอยู่ Ctrl+Z เป็นของกระดาน
try { setPanelOwnsKeys('planner', true); } catch {}
export async function renderPlannerPanel(boardPath) {
  const host = $('#planner-body');
  if (!host) return false;
  if (plannerInst && host.firstChild) {
    if (boardPath && plannerInst.data && plannerInst.data.getPath() !== boardPath) await plannerInst.openBoard(boardPath);
    // เปิดแผงซ้ำ = canvas อาจถูกย้ายที่ใน DOM → บังคับคำนวณพิกัดใหม่ (บั๊ก 65r4 "กรอบนำไม่ขึ้น")
    try { plannerInst.renderer.canvas.calcOffset(); plannerInst._fit(); } catch {}
    setTimeout(() => { try { plannerInst.renderer.canvas.calcOffset(); plannerInst._fit(); } catch {} }, 80);
    log('info', tt('ui.app.plannerOpenPanelDup'));
    return true;
  }
  host.innerHTML = '';
  host.classList.add('planner-pane');            // สไตล์เดิมของกระดานผูกกับคลาสนี้
  plannerInst = new PlannerBoard(host, state.root, {
    path: boardPath || (await defaultPlannerPath()),
    onDirty: () => {},                           // [alpha.65] ไม่ autosave ทุกจังหวะแล้ว — มี ● บอกว่ายังไม่บันทึก
    onReveal: (f) => revealInExplorer(f),
    onOpenFile: async (f) => {
      if (!f) return;
      const abs = await plannerAbs(f);
      if (/\.json$/i.test(abs) || /[\\/](Wiki|Bible)[\\/]/i.test(abs)) await openEntity(abs);
      else await openScene(abs, null);
      bindTabStripMenus();
      if (state.tabs.has(abs)) floatTab(abs);    // ดับเบิลคลิกการ์ด = เปิดเป็นหน้าต่างลอย
    },
    services: {
      // บั๊ก 3: การ์ดต้องดึงไฟล์จาก Explorer ได้จริง ไม่ใช่พิมพ์ path เอง
      pickFile: () => pickPlannerTarget(),
      // [alpha.150 ข้อ 2+6] แทรกรูป/ตั้งพื้นหลังกระดาน — ใช้คลังรูปตัวเดียวกับ Wiki/ปกเล่ม
      pickImage: () => pickImage(state.root),
      // [alpha.151 ข้อ 3] แถบของกระดานอ่านค่าซ่อน/แสดงจากที่เดียวกับแถบของตัวแก้ไข
      getFmtbarCfg: () => (state.settings && state.settings.fmtbar) || null,
      // ป๊อปอัปเลือกสีตัวเดียวกับที่ตัวแก้ไขใช้ (จานสี · วงล้อ · ที่บันทึกไว้ · ใช้ล่าสุด)
      pickColor: (anchor, cur, apply) => openColorPicker(anchor, cur, apply, saveGlobalSetting),
      onBoardsChanged: () => { refreshTreeQueued(); },
      // [alpha.155] ล็อกทั้งกระดานจากเมนูคลิกขวาใน Explorer (ค่าเก็บที่ project.khn.json → explorer)
      isBoardLocked: async (p) => (await import('./tree-actions.js')).isItemLocked(p),
      // บั๊ก 65r2-8: บันทึกแล้วป้าย "ยังไม่บันทึก" ใน Explorer ต้องหายเอง ไม่ต้องรีเฟรชมือ
      // บั๊ก 65r3-1: ถ้าหาแถวไม่เจอ (ต้นไม้เพี้ยน/แถวหลุดไป) ให้สร้างใหม่ให้เลย — กันแถวหาย
      onDirtyChanged: (path, dirty) => healPlannerRow(path, dirty),
    },
  });
  // 🔑 ต่อ planner-props panel callback เข้ากับ planner-props.js
  if (plannerInst.setPropsCallback) {
    plannerInst.setPropsCallback((ctx) => {
      showPanel('planner-props');
      const container = $('#planner-props-body');
      if (container) renderPlannerProps(container, ctx);
    });
  }
  // [alpha.72 ข้อ 3] ปิดแผง = ปิดเฉย ๆ ไม่ต้องถามบันทึก
  // ปิดแผงไม่ได้ "ทิ้งงาน" — กระดานยังอยู่ในหน่วยความจำครบ เปิดแผงกลับมาก็ได้ของเดิม
  // จะถามก็ต่อเมื่อ **งานกำลังจะหายจริง**: เปิดกระดานใบอื่นทับ · ทิ้งกระดานนี้ · ปิดโปรแกรม
  // (ปิดโปรแกรมถูกครอบด้วยทะเบียนงานค้างในข้อ 4 แล้ว)
  // ของเดิมตั้ง guard ไว้ตรงนี้ → กดปิดแผงทีไรก็เจอกล่องถามทุกครั้งทั้งที่ไม่มีอะไรหาย
  setPanelCloseGuard('planner', null);
  registerDirtySources();
  setTimeout(() => { try { plannerInst._fit(); } catch {} }, 60);
  watchPlannerRows(true);                      // เฝ้าดูว่าใครมาแตะแถวกระดานใน Explorer
  return true;
}

/** กระดานเริ่มต้น: planner.json เดิมถ้ามี ไม่งั้นใช้ Planners/กระดานหลัก.json */
export async function defaultPlannerPath() {
  const legacy = await kapi.join(state.root, 'planner.json');
  if (await kapi.exists(legacy)) return legacy;
  const dir = await kapi.join(state.root, 'Planners');
  const files = (await kapi.exists(dir)) ? await kapi.listFiles(dir, '.json').catch(() => []) : [];
  if (files.length) return kapi.join(dir, files[0]);
  return legacy;
}

/** การ์ดเก็บ path สัมพัทธ์กับ root ได้ → แปลงกลับเป็น absolute ตอนเปิด */
async function plannerAbs(f) {
  if (!f) return f;
  if (/^([a-z]:[\\/]|[\\/])/i.test(f)) return f;
  return kapi.join(state.root, f);
}

/** เลือกฉาก / โน้ต / เอนทิตี้ Wiki มาผูกกับการ์ด (บั๊ก 3) */
export async function pickPlannerTarget() {
  const items = (await listRefTargets()).map((r) => ({ path: r.path, title: r.title, label: r.label }));
  try {
    for (const e of await listEntities(state.root)) {
      const rel = (await kapi.relative(state.root, e.path)).replace(/\\/g, '/');
      items.push({ path: rel, title: e.name, label: gi('user') + ` Wiki / ${e.cat} / ${e.name}` });
    }
  } catch {}
  if (!items.length) { setStatus(tt('ui.app.notHasSceneNote')); return null; }
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    const t = el('div', 'k-dlg-title', tt('ui.app.bindCardDocProject'));
    const inp = el('input', 'k-dlg-input');
    inp.placeholder = tt('ui.app.printFilter');
    const list = el('div', 'planner-board-list');
    const draw = (q) => {
      list.innerHTML = '';
      const ql = (q || '').trim().toLowerCase();
      let n = 0;
      for (const it of items) {
        if (ql && !it.label.toLowerCase().includes(ql)) continue;
        if (++n > 300) break;
        const row = el('div', 'planner-board-row');
        row.append(el('span', 'planner-board-nm', it.label));
        row.onclick = () => { ov.remove(); resolve(it); };
        list.appendChild(row);
      }
      if (!n) list.appendChild(el('div', 'planner-props-empty', tt('ui.app.notFoundDocAt')));
    };
    draw('');
    inp.oninput = () => draw(inp.value);
    const btns = el('div', 'k-dlg-btns');
    const cancel = el('button', 'k-cancel', tt('ui.common.cancel'));
    cancel.onclick = () => { ov.remove(); resolve(null); };
    btns.appendChild(cancel);
    box.append(t, inp, list, btns);
    ov.appendChild(box);
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
    inp.focus();
  });
}

async function openPlanner(boardPath) {
  showPanel('planner');
  await renderFeaturePanel('planner');
  // [alpha.152 ข้อ 5] เปิดกระดานจากเมนู/แถบเครื่องมือ = ตั้งใจจะใช้มันแน่ ๆ → เลือกให้เลย
  // (ไม่งั้นต้องคลิกบนกระดานอีกทีคีย์ลัดถึงจะทำงาน ซึ่งงงและไม่มีเหตุผล)
  setFocusedPanel('planner');
  if (boardPath && plannerInst) await plannerInst.openBoard(boardPath);
  refreshToolbar();
}

// ---------------- กระดานวางแผนใน Explorer (บั๊ก 5) ----------------
/** ทุกกระดานในโปรเจกต์: planner.json เดิม + Planners/*.json */
export async function listPlannerBoards() {
  const out = [];
  if (!state.root) return out;
  const legacy = await kapi.join(state.root, 'planner.json');
  if (await kapi.exists(legacy)) out.push({ path: legacy, name: tt('ui.common.boardMain'), legacy: true });
  const dir = await kapi.join(state.root, 'Planners');
  if (await kapi.exists(dir)) {
    for (const f of (await kapi.listFiles(dir, '.json').catch(() => []))) {
      out.push({ path: await kapi.join(dir, f), name: f.replace(/\.json$/i, ''), legacy: false });
    }
  }
  return out;
}

function safeBoardName(s) {
  return String(s || tt('ui.common.board')).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || tt('ui.common.board');
}

/**
 * สร้างต้นไม้ Explorer ใหม่แบบเข้าคิว — กันงานเก่าที่ยังวิ่งอยู่มาเขียนทับผลของงานใหม่
 * (เจอตอน alpha.65r2: save() ยิง buildTree() แบบไม่ await แล้วมันไปจบทีหลัง
 *  buildTree() ของการสร้างกระดานใหม่ → แถวกระดานที่เพิ่งสร้างหายไปจากต้นไม้)
 */
let _treeJob = Promise.resolve();
/** [alpha.157] ปุ่มฝั่งติดสว่าง = ฝั่งนั้น "แสดงอยู่" (กดแล้วซ่อน) */
export function syncSideToggles() {
  for (const b of document.querySelectorAll('.k-side-toggles [data-side]')) {
    const hid = sideHidden(b.dataset.side);
    b.classList.toggle('on', !hid);
    b.setAttribute('aria-pressed', hid ? 'false' : 'true');
  }
  return true;
}

// [alpha.157] ชุดสถานะ/สีเปลี่ยน (จาก Kanban หรือกล่องจัดการสถานะ) → ต้นไม้วาดชิปใหม่ทันที
window.addEventListener('k2-statuses-changed', () => {
  refreshTreeQueued();
  buildFilterBar().catch(() => {});        // [alpha.159 · H9] ชิปกรองต้องรู้จักสถานะใหม่ทันที
});

export function refreshTreeQueued() {
  _treeJob = _treeJob.then(() => buildTree())
    .then(() => auditPlannerRows(tt('ui.app.new3')))
    .catch((e) => log('warn', tt('ui.app.buildTreeFail'), e));
  return _treeJob;
}

/**
 * ตรวจสภาพจริงของแถวกระดานใน Explorer แล้วเขียนลง log
 * (ผู้ใช้เจออาการ "หัวข้อขึ้น (1) แต่ไม่มีแถวโผล่" — อันนี้จะบอกว่าแถวหายไปไหน:
 *  ไม่ถูกสร้าง / ถูก display:none / ข้อความว่าง / หมวดถูกพับ)
 */
export function auditPlannerRows(when) {
  // [alpha.128] เดิมหาหมวดด้วย `.textContent.includes('กระดานวางแผน')` — ข้อความนี้แปลตามภาษา
  // (`ui.app.boardPlanner2`) → หน้าจออังกฤษหาไม่เจอ แล้วรายงานว่า "ไม่มีหมวด" ทุกครั้ง
  // หาจากโครงแทน: หมวดที่มีแถวกระดานอยู่ข้างใน — ไม่ขึ้นกับภาษาเลย
  const sec = [...document.querySelectorAll('#tree .sec')]
    .find((s) => s.querySelector('.scene[data-planner]'))
    || (document.querySelector('#tree .scene[data-planner]') || {}).closest?.('.sec') || null;
  const rows = [...document.querySelectorAll('#tree .scene[data-planner]')];
  // [alpha.75] เดิมดูแค่ `display` → **จับ K-1 ไม่ได้เลย** เพราะแถวถูกทำให้จางด้วย `opacity:0`
  // (อยู่ใน DOM · display ปกติ · ข้อความครบ แต่มองไม่เห็น) → ต้องดู opacity/visibility ด้วย
  const info = rows.map((r) => {
    const cs = getComputedStyle(r);
    return {
      name: r.dataset.plannerName || tt('ui.common.notNamed'),
      text: (r.textContent || '').trim(),
      display: cs.display,
      opacity: cs.opacity,
      visibility: cs.visibility,
      cls: r.className,
      inline: r.style.display || tt('ui.app.notSet'),
    };
  });
  const hidden = info.filter((i) => i.display === 'none').length;
  const faded = info.filter((i) => parseFloat(i.opacity) < 0.05 || i.visibility === 'hidden').length;
  const blank = info.filter((i) => !i.text).length;
  const secHidden = sec ? (getComputedStyle(sec).display === 'none' || sec.classList.contains('collapsed')) : null;
  const bad = !sec || !rows.length || hidden || faded || blank;
  // [alpha.128] ตัวนี้เป็นเครื่องมือวินิจฉัย K-1 (ปิดเคสไปตั้งแต่ alpha.75) แต่ยังยิง INFO
  // **ทุกครั้งที่สร้างต้นไม้ใหม่** — ในการรัน e2e รอบเดียวกินบันทึกไป 736 บรรทัดจาก 2,280
  // (45% ของทั้งไฟล์) จนเหตุการณ์จริงจมหาย · ตอนนี้ "ปกติ" = debug · "ผิดปกติ" = warn เหมือนเดิม
  log(bad ? 'warn' : 'debug',
      ttf('ui.app.plannerTreeCheckImage', when || '-', sec ? tt('ui.app.has') : tt('ui.app.notHas3'), rows.length) +
      ttf('ui.app.hideEmptyCatHide', hidden, faded, blank, secHidden),
      { rows: info, filter: ($('#tree-search') || {}).value || '' });
  return { sec: !!sec, rows: rows.length, hidden, faded, blank, secHidden, info };
}

/**
 * อัปเดตป้ายบนแถวกระดานใน Explorer โดยไม่ต้องสร้างต้นไม้ใหม่ทั้งอัน (บั๊ก 65r2-8)
 * [alpha.65r4] ชื่อกระดานอ่านจาก `data-planner-name` (ของตัวเอง) ไม่ใช่ `data-search`
 * ที่โมดูลอื่นอาจเขียนทับ — และถ้าชื่อว่างเมื่อไหร่ **ห้ามเขียนทับข้อความเดิม**
 * ไม่งั้นแถวจะกลายเป็นบรรทัดเปล่า ๆ (หัวข้อยังนับ (1) แต่มองไม่เห็นอะไร — ตรงกับที่ผู้ใช้เจอ)
 */
export function markPlannerRow(path, dirty) {
  const tree = $('#tree');
  if (!tree) return false;                     // แผงโปรเจกต์ถูกปิดอยู่ — ไม่มีอะไรให้อัปเดต ไม่ใช่ความผิดพลาด
  const row = path ? tree.querySelector(`.scene[data-planner="${CSS.escape(path)}"]`) : null;

  // [alpha.74] **ห้ามเขียนทับ textContent ของแถวอีกต่อไป**
  // ของเดิมสลับข้อความเป็น '▶ ชื่อ ●' ตอนเปิด/ยังไม่บันทึก — เท่ากับ "รื้อลูกของแถวทิ้งแล้วสร้างใหม่"
  // ทุกครั้งที่สถานะเปลี่ยน ซึ่งเป็นที่เดียวในต้นไม้ที่แก้เนื้อแถวนอก buildTree()
  // (ชื่อว่างเมื่อไหร่ = ได้บรรทัดเปล่า · ลูกอื่นในแถว เช่นป้ายจำนวน ก็หายไปด้วย)
  // ตอนนี้บอกสถานะด้วย **ตัวหนา/สี** ผ่าน class ล้วน ๆ — เนื้อแถวไม่ถูกแตะเลย
  // [alpha.120 ข้อ 5] ★ ต้องกวาด **เฉพาะแถวกระดาน** — ตั้งแต่ฉาก/เอนทิตี้ใช้ k-row-open/k-row-unsaved
  // บอก "กำลังแก้ / ยังไม่บันทึก" ด้วย การกวาดทั้งต้นไม้จะลบสถานะของฉากทิ้งทุกครั้งที่แตะกระดาน
  for (const prev of tree.querySelectorAll('.scene[data-planner].k-row-open')) {
    if (prev === row) continue;
    prev.classList.remove('k-row-open', 'k-row-unsaved');
  }

  if (!row) {
    log('warn', tt('ui.app.plannerTreeFindRow'), { path, rows: tree.querySelectorAll('.scene[data-planner]').length });
    return false;
  }
  row.classList.add('k-row-open');
  row.classList.toggle('k-row-unsaved', !!dirty);
  return true;
}

/**
 * ⚠️ KNOWN ISSUE K-1 (ยังไม่ปิดเคส — ดู CHANGELOG.md หัวข้อ "บั๊กที่ยังค้างอยู่")
 * ผู้ใช้เจอ: แถวไฟล์กระดานหายจาก Explorer ทั้งที่หัวข้อยังนับ (1) · รีเฟรชไม่กลับมา ·
 * เกิดหลังแถวขึ้นสีส้ม + จุด ● (สถานะยังไม่บันทึก) · ทำซ้ำในเครื่องเทสไม่ได้
 * ปิดช่องที่เป็นไปได้ไปแล้ว: เขียนทับเป็นบรรทัดว่าง (r4) · กวาดทุกแถว (r7) ·
 * buildTree คืนก่อนเสร็จ (r7) · หมวดพังลากต้นไม้ล้ม (r7) · ตัวกรอง/ขอบเขตบทกลืนแถว (r8)
 * เครื่องมือไล่ต่อ: watchPlannerRows() + auditPlannerRows() → อ่านที่แผง "บันทึก"
 */

/**
 * อัปเดตป้ายแถวกระดาน + ซ่อมต้นไม้ให้ "เท่าที่จำเป็น"
 * [alpha.65r7] เดิมหาแถวไม่เจอทีไรก็สั่งสร้างต้นไม้ใหม่ทันที — ปิดแผงโปรเจกต์ไว้แล้วแก้กระดานรัว ๆ
 * = สร้างต้นไม้ใหม่ทุกครั้งที่กดแป้น เปลืองเปล่า ๆ และเสี่ยงชนกับงานสร้างอื่น
 * ตอนนี้: ซ่อมเฉพาะเมื่อ "ต้นไม้มีอยู่จริงแต่แถวหาย" และไม่ถี่กว่า 3 วินาทีต่อครั้ง
 */
let _healAt = 0;
export function healPlannerRow(path, dirty) {
  if (markPlannerRow(path, dirty)) return true;
  const tree = $('#tree');
  if (!tree) return false;                           // แผงปิดอยู่ = ไม่ต้องซ่อม
  const now = performance.now();
  if (now - _healAt < 3000) return false;            // กันสร้างต้นไม้รัว
  _healAt = now;
  auditPlannerRows(tt('ui.app.findRowNotFound'));
  refreshTreeQueued().then(() => markPlannerRow(path, dirty));
  return false;
}

/**
 * เฝ้าดูแถวกระดานใน Explorer — ถ้ามีใครมาถอดออก/ซ่อน/ลบข้อความ ให้เขียน log ทันทีพร้อม stack
 * (ผู้ใช้รายงานว่าแถวหายหลังขึ้นจุดสีส้ม — อันนี้จะชี้ตัวคนทำให้เห็น ๆ)
 */
let _plannerRowObs = null;
export function watchPlannerRows(on) {
  if (_plannerRowObs) { _plannerRowObs.disconnect(); _plannerRowObs = null; }
  if (on === false) return null;
  const tree = $('#tree');
  if (!tree || typeof MutationObserver === 'undefined') return null;
  _plannerRowObs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of (m.removedNodes || [])) {
        if (n.nodeType !== 1) continue;
        const isRow = n.dataset && n.dataset.planner;
        const hasRow = n.querySelector && n.querySelector('[data-planner]');
        if (isRow || hasRow) {
          // [alpha.74] ตอน buildTree() สลับ double-buffer ต้นไม้เก่าทั้งก้อนถูกถอดออกเป็นปกติ
          // ตัวเฝ้าเดิมไม่รู้เรื่องนี้ จึงเตือน "แถวกระดานถูกถอดออกจาก DOM" ทุกครั้งที่รีเฟรชต้นไม้
          // (name เป็น "(ในกล่อง)" เพราะสิ่งที่ถูกถอดคือ .sec ที่ห่อแถวไว้ ไม่ใช่ตัวแถว) = สัญญาณหลอก
          if (_treeSwapping) continue;
          // [alpha.128] ต้นเหตุ K-1 คือ CSS opacity ซึ่งปิดเคส + มีเทสวัด opacity คุมไว้แล้วตั้งแต่
          // alpha.75 · ตัวเฝ้านี้จึงเหลือแต่สัญญาณหลอกจากการรื้อต้นไม้ตามปกติ (120 WARN/รอบ)
          // เก็บไว้เป็น debug — ยังไล่ย้อนได้เวลาต้องการ แต่ไม่ปลอมเป็น "มีอะไรผิด"
          log('debug', tt('ui.app.plannerTreeRowBoard'),
              { name: (n.dataset && n.dataset.plannerName) || tt('ui.app.dialog'),
                parent: m.target && m.target.className, stack: new Error(tt('ui.app.msg4')).stack.split('\n').slice(1, 5).join(' ⇦ ') });
        }
      }
      if (m.type === 'attributes' && m.target.dataset && m.target.dataset.planner) {
        const hidden = getComputedStyle(m.target).display === 'none';
        log(hidden ? 'warn' : 'debug',
            ttf('ui.app.plannerTreeRowChange', m.target.dataset.plannerName, m.attributeName) +
            (hidden ? tt('ui.app.hide') : ''),
            { style: m.target.getAttribute('style') || '', cls: m.target.className,
              text: (m.target.textContent || '').trim() });
      }
    }
  });
  _plannerRowObs.observe(tree, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  log('debug', tt('ui.app.plannerTreeStartView'));
  return _plannerRowObs;
}

export async function newPlannerBoard(nameArg) {
  const dir = await kapi.join(state.root, 'Planners');
  let value = nameArg || tt('ui.common.board2') + ((await listPlannerBoards()).length + 1);
  let p = null;
  for (;;) {
    const name = nameArg || await ask(tt('ui.common.nameBoardNew'), { value, okLabel: tt('ui.common.new') });
    if (!name) return null;
    p = await kapi.join(dir, safeBoardName(name) + '.json');
    if (!(await kapi.exists(p))) break;
    // บั๊ก 65r2-7: ชื่อซ้ำต้องเตือน ไม่ใช่เขียนทับเงียบ ๆ
    if (nameArg) { setStatus(ttf('ui.app.hasBoardName', safeBoardName(name))); return null; }
    const act = await choose(ttf('ui.common.hasBoardNameProject', safeBoardName(name)), [
      { label: tt('ui.common.renameNew'), value: 'again', primary: true },
      { label: tt('ui.common.overwritePrev'), value: 'over', danger: true },
      { label: tt('ui.common.cancel'), value: null }]);
    if (act === 'over') break;
    if (!act) return null;
    value = safeBoardName(name) + ' 2';
  }
  await kapi.mkdir(dir);
  await kapi.writeFile(p, JSON.stringify({ version: '4.0', nodes: [], edges: [], groups: [] }, null, 2));
  await refreshTreeQueued();
  await openPlanner(p);
  await refreshTreeQueued();
  setStatus(ttf('ui.common.newBoardF', p.split(/[\\/]/).pop().replace(/\.json$/i, '')));
  return p;
}

async function renamePlannerBoard(b) {
  const v = await ask(tt('ui.app.changeNameBoard'), { value: b.name });
  if (!v || v === b.name) return null;
  const dir = await kapi.join(state.root, 'Planners');
  await kapi.mkdir(dir);
  const dst = await kapi.join(dir, safeBoardName(v) + '.json');
  if (await kapi.exists(dst)) { setStatus(tt('ui.app.hasBoardName2')); return null; }
  const wasOpen = plannerInst && plannerInst.data && plannerInst.data.getPath() === b.path;
  if (wasOpen) await plannerInst.save(true);
  await kapi.move(b.path, dst);
  if (wasOpen) await plannerInst.openBoard(dst);
  await refreshTreeQueued();
  setStatus(ttf('ui.app.changeNameF', safeBoardName(v)));
  return dst;
}

async function duplicatePlannerBoard(b) {
  const dir = await kapi.join(state.root, 'Planners');
  await kapi.mkdir(dir);
  let n = 1, dst;
  do { dst = await kapi.join(dir, safeBoardName(b.name + tt('ui.common.msg2') + (n > 1 ? ' ' + n : '')) + '.json'); n++; }
  while (await kapi.exists(dst));
  await kapi.writeFile(dst, await kapi.readFile(b.path));
  await refreshTreeQueued();
  setStatus(tt('ui.app.dupBoardDone'));
  return dst;
}

async function buildPlannerSection(tree) {
  const boards = await listPlannerBoards();
  const sec = el('div', 'sec');
  const head = el('div', 'sec-title', ttf('ui.app.boardPlanner2', boards.length));
  const add = el('span', 'row-add', '+'); add.title = tt('ui.common.newBoardNew');
  add.onclick = (e) => { e.stopPropagation(); newPlannerBoard(); };
  head.append(add); sec.append(head);
  makeAccordion(head, sec, 'sec:__planner__');
  // [alpha.155] เมนูของหัวหมวดกระดานตามรายการของผู้ใช้ (tree-menu-spec.js → plannerHead)
  bindTreeMenu(head, 'plannerHead', { title: '' });
  const cur = plannerInst && plannerInst.data ? plannerInst.data.getPath() : null;
  const curDirty = !!(plannerInst && plannerInst.data && plannerInst.data.isDirty());
  const exMeta = TA.explorer();
  for (const b of boards) {
    const isCur = b.path === cur;
    const bRel = await TA.relOf(b.path);
    const bMeta = { ...((exMeta.items || {})[bRel] || {}) };
    // [alpha.74] ไอคอนคงที่เสมอ · สถานะ "เปิดอยู่/ยังไม่บันทึก" บอกด้วยตัวหนา+สี ไม่ใช่สัญลักษณ์
    // [alpha.155] ดาว/กุญแจ/สี/สถานะ ของกระดานมาจาก Explorer meta — ตั้งตอนสร้างแถวเท่านั้น ไม่แตะตอนงานค้างเปลี่ยน
    const it = el('div', 'scene' + (isCur ? ' k-row-open' : '') + (isCur && curDirty ? ' k-row-unsaved' : ''),
      (bMeta.locked ? gi('lock') : bMeta.flag ? gi('star') : gi('clipboard')) + ' ' + b.name);
    if (bMeta.color) { const dot = el('span', 'sc-dot'); dot.style.background = vivid(bMeta.color) || bMeta.color; it.prepend(dot); }
    if (bMeta.status) {
      it.append(statusChip(bMeta.status));
    }
    it.dataset.path = b.path;
    it.dataset.planner = b.path;
    it.dataset.plannerName = b.name;             // แหล่งชื่อของตัวเอง — ไม่พึ่ง data-search
    it.dataset.search = b.name;
    it.title = b.path + (isCur ? (curDirty ? tt('ui.app.busyOpenNotSave') : tt('ui.app.busyOpen')) : '');
    it.onclick = () => openPlanner(b.path);
    // [alpha.155] เมนูของไฟล์กระดานตามรายการของผู้ใช้ (tree-menu-spec.js → board)
    // [alpha.164 · รอบต่อ 4] ผ่าน bindTreeMenu (กฎ W4) — เดิมผูก oncontextmenu ตรง ๆ แถวจึงไม่มี `_k2row`
    // = F2 · Shift+F10 · treeRowAction เอื้อมไม่ถึงแถวกระดานเลย
    bindTreeMenu(it, 'board', { path: b.path, b, meta: bMeta, rel: bRel, title: b.name,
                                lockSrc: bMeta.locked ? 'item' : '' });
    sec.append(it);
  }
  if (!boards.length) {
    const empty = el('div', 'scene add-row', tt('ui.app.newBoardFirst'));
    empty.onclick = () => newPlannerBoard();
    sec.append(empty);
  }
  // แถวอธิบายตอนกระดานถูกกรองหมด — ตัวมันเองไม่โดนกรอง (data-nofilter) หมวดจึงไม่หายไปทั้งก้อน
  const note = el('div', 'scene planner-filter-note', '');
  note.dataset.nofilter = '1';
  note.style.display = 'none';
  sec.append(note);
  tree.append(sec);
  log('debug', ttf('ui.app.plannerTreeNewCat', boards.length),
      { current: cur, rows: boards.map((b) => b.name) });
  return sec;
}

// ---------------- แผนที่ใน Explorer — [alpha.70 ข้อ 11] ----------------
// แผนที่ทั้งหมดอยู่ในไฟล์เดียว (maps.json) ไม่ใช่ไฟล์ละใบเหมือนกระดาน → แถวหนึ่ง = แผนที่หนึ่งใบในไฟล์นั้น
// จัดกลุ่มตามหมวดถ้าผู้ใช้ตั้งหมวดไว้ (ข้อ 8) — ไม่ตั้งก็เป็นรายการเรียบเหมือนเดิม
async function buildMapsSection(tree) {
  let data = { maps: [] };
  try { data = await loadMaps(); } catch (e) { log('warn', tt('ui.app.explorerReadMapsJson'), e); }
  const maps = data.maps || [];
  const jsonPath = await kapi.join(state.root, 'maps.json');
  const sec = el('div', 'sec');
  const head = el('div', 'sec-title', ttf('ui.app.map', maps.length));
  const add = el('span', 'row-add', '+'); add.title = tt('ui.app.addMapNew');
  add.onclick = async (e) => { e.stopPropagation(); await openMaps(); await addMapFlow(); await refreshTreeQueued(); };
  head.append(add); sec.append(head);
  makeAccordion(head, sec, 'sec:__maps__');
  head.oncontextmenu = (e) => { e.preventDefault(); popupMenu(e.clientX, e.clientY, [
    { label: tt('ui.app.openPanelMap'), click: () => openMaps() },
    { label: tt('ui.app.addMap'), click: async () => { await openMaps(); await addMapFlow(); await refreshTreeQueued(); } },
    '-',
    { label: tt('ui.app.openMapsJson'), click: () => openPlainFile(jsonPath, 'maps.json') },
    { label: tt('ui.common.showFolder'), click: () => kapi.revealInOS(jsonPath) },
  ]); };

  const groups = groupMaps(maps);
  const multiCat = groups.length > 1;
  for (const g of groups) {
    if (multiCat) {
      const ch = el('div', 'scene map-row-cat', gi('folder') + ' ' + (g.cat || tt('ui.common.notSpecifyCat')));
      ch.dataset.nofilter = '1';
      sec.append(ch);
    }
    for (const m of g.maps) {
      const st = pinStats(m);
      const nPins = (m.pins || []).length;
      const nRoutes = mapRoutes(m).length;
      const it = el('div', 'scene map-row' + (multiCat ? ' map-row-in-cat' : ''),
        gi('map') + ' ' + (m.name || tt('ui.common.notNamed')));
      const badge = el('span', 'map-row-badge',
        nPins ? `${nPins}${gi('map-pin')}` + (nRoutes ? ` ${nRoutes}${gi('route')}` : '') : '—');
      it.append(badge);
      it.dataset.mapId = m.id;
      it.dataset.search = [m.name, m.category, ...(m.pins || []).map((p) => p.label)].filter(Boolean).join(' ');
      it.title = [m.name || tt('ui.common.notNamed'), m.category ? tt('ui.app.cat2') + m.category : '',
                  ttf('ui.app.portal', st.entity, st.portal, st.note),
                  m.image ? tt('ui.app.image') + m.image : tt('ui.app.notHasImage')].filter(Boolean).join('\n');
      it.onclick = () => openMapFromTree(m.id);
      // [alpha.167] หยิบใส่: ลากแผนที่ไปวางบนแผนที่อื่น = ประตูไปแผนที่ย่อย (แผนที่ซ้อนแผนที่)
      it.draggable = true;
      it.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        setDrag(e.dataTransfer, 'map', { id: m.id, name: m.name || '' });
      });
      it.oncontextmenu = (ev) => { ev.preventDefault(); popupMenu(ev.clientX, ev.clientY, [
        { label: tt('ui.app.openMap'), click: () => openMapFromTree(m.id) },
        { label: tt('ui.app.addMap'),                                             // [alpha.120 ข้อ 10]
          click: async () => { await openMaps(); await addMapFlow(); await refreshTreeQueued(); } },
        { label: tt('ui.app.changeName2'), click: () => renameMapFromTree(m.id) },
        { label: tt('ui.app.setCat'), click: () => setMapCategoryFromTree(m.id) },
        { label: tt('ui.common.exportPNG'), click: async () => { const d2 = await loadMaps();
            const mm = findMap(d2.maps, m.id); if (mm) await exportMapPng(mm); } },
        '-',
        { label: tt('ui.app.openMapsJson'), click: () => openPlainFile(jsonPath, 'maps.json') },
        { label: tt('ui.app.findDiskFindOn'), click: () => revealFile(jsonPath) },   // [alpha.120 ข้อ 7]
        { label: tt('ui.app.delMap'), danger: true, click: () => deleteMapFromTree(m.id, m.name) },
      ]); };
      sec.append(it);
    }
  }
  if (!maps.length) {
    const empty = el('div', 'scene add-row', tt('ui.app.newMapFirst'));
    empty.onclick = async () => { await openMaps(); await addMapFlow(); await refreshTreeQueued(); };
    sec.append(empty);
  }
  tree.append(sec);
  return sec;
}

// ---------------- แผนของผังแตกสายใน Explorer — [alpha.73 ข้อ 5] ----------------
async function buildBranchPlanSection(tree) {
  const { listBranchPlans, currentBranchPlan, isBranchPlanDirty, openBranchPlan }
    = await import('./branching-ui.js');
  const { planSummary } = await import('./branch-plans.js');
  const plans = await listBranchPlans();
  const cur = currentBranchPlan();
  const sec = el('div', 'sec');
  const head = el('div', 'sec-title', ttf('ui.app.graphBreakBranch2', plans.length));
  const add = el('span', 'row-add', '+'); add.title = tt('ui.app.newNewPlan');
  add.onclick = async (e) => { e.stopPropagation(); await newBranchPlanFromTree(); };
  head.append(add); sec.append(head);
  makeAccordion(head, sec, 'sec:__branchplans__');
  // [alpha.155] เมนูของหัวหมวดแผงแตกสายตามรายการของผู้ใช้ (tree-menu-spec.js → branchHead)
  bindTreeMenu(head, 'branchHead', { title: '' });
  const exPlan = TA.explorer();
  for (const p of plans) {
    const isCur = cur && cur.path === p.path;
    const dirty = isCur && isBranchPlanDirty();
    const pRel = await TA.relOf(p.path);
    const pMeta = { ...((exPlan.items || {})[pRel] || {}) };
    const it = el('div', 'scene branch-plan-row' + (isCur ? ' k-row-open' : '') + (dirty ? ' k-row-unsaved' : ''),
      (pMeta.locked ? gi('lock') : pMeta.flag ? gi('star') : gi('branch')) + ' ' + p.name);
    // คุณสมบัติแบบฉาก: จุดสี + ป้ายสถานะ (เหมือนแถวฉากใน Explorer)
    if (p.plan.color) { const dot = el('span', 'sc-dot'); dot.style.background = vivid(p.plan.color) || p.plan.color; it.prepend(dot); }
    if (p.plan.status) it.append(statusChip(p.plan.status));   // [alpha.155] ค่าสถานะ = ข้อมูล · ป้ายตามภาษา · [159] + สี/dataset
    it.dataset.path = p.path;
    it.dataset.branchPlan = p.path;
    it.dataset.search = p.name;
    it.title = p.path + String.fromCharCode(10) + planSummary(p.plan);
    it.onclick = async () => { await openBranchPlan(p.path); await openBranchingTree(); await refreshTreeQueued(); };
    // [alpha.155] เมนูของไฟล์แผนตามรายการของผู้ใช้ (tree-menu-spec.js → plan)
    // [alpha.164 · รอบต่อ 4] ผ่าน bindTreeMenu (กฎ W4) — เหตุผลเดียวกับแถวกระดาน
    bindTreeMenu(it, 'plan', { path: p.path, p, meta: pMeta, rel: pRel, title: p.name,
                               lockSrc: pMeta.locked ? 'item' : '' });
    sec.append(it);
  }
  if (!plans.length) {
    const empty = el('div', 'scene add-row', tt('ui.app.newPlanFirst'));
    empty.onclick = () => add.onclick({ stopPropagation() {} });
    sec.append(empty);
  }
  tree.append(sec);
  return sec;
}

/** อัปเดตจุด ● ของแถวแผนที่เปิดอยู่ (เรียกจาก branching-ui ตอนแก้/บันทึก) */
export function markBranchPlanRow() {
  import('./branching-ui.js').then(({ currentBranchPlan, isBranchPlanDirty }) => {
    const cur = currentBranchPlan();
    if (!cur || !cur.path) return;
    const row = document.querySelector(`#tree .branch-plan-row[data-branch-plan="${CSS.escape(cur.path)}"]`);
    if (!row) return;
    row.classList.add('k-row-open');
    row.classList.toggle('k-row-unsaved', isBranchPlanDirty());
  }).catch(() => {});
}

/** เปิดแผงแผนที่แล้วสลับไปแผนที่ที่คลิกจาก Explorer */
async function openMapFromTree(mapId) {
  // [alpha.167] แผงเริ่มที่แกลเลอรี — คลิกแถวแผนที่ = เข้าไปดูใบนั้นเลย (วาดรอบเดียว ไม่แวบหน้ารวม)
  await openMapById(mapId);
}
async function renameMapFromTree(mapId) {
  const d = await loadMaps();
  const m = findMap(d.maps, mapId); if (!m) return;
  const v = await ask(tt('ui.common.nameMap'), { value: m.name });
  if (!v) return;
  m.name = v.trim() || m.name;
  await saveMaps(d);
  if (mapsState_C.s) { mapsState_C.s.data = d; await renderMaps($('#maps-body')); }
  await refreshTreeQueued();
  setStatus(tt('ui.app.changeNameMapDone'));
}
async function setMapCategoryFromTree(mapId) {
  const d = await loadMaps();
  const m = findMap(d.maps, mapId); if (!m) return;
  const v = await ask(tt('ui.app.catMapSkipEmpty'),
    { value: m.category || '', placeholder: tt('ui.app.egWorldCurrentWorld') });
  if (v === null || v === undefined) return;
  m.category = String(v).trim();
  await saveMaps(d);
  if (mapsState_C.s) { mapsState_C.s.data = d; await renderMaps($('#maps-body')); }
  await refreshTreeQueued();
  setStatus(m.category ? ttf('ui.app.moveCatF', m.category) : tt('ui.app.exitCatDone'));
}
async function deleteMapFromTree(mapId, name) {
  if (!(await confirmBox(ttf('ui.common.delMap', name || ''), tt('ui.common.del')))) return;
  const d = await loadMaps();
  d.maps = deleteMap(d.maps, mapId);
  await saveMaps(d);
  if (mapsState_C.s) {
    mapsState_C.s.data = d;
    if (mapsState_C.s.currentId === mapId) mapsState_C.s.currentId = d.maps[0]?.id || null;
    await renderMaps($('#maps-body'));
  }
  await refreshTreeQueued();
  setStatus(tt('ui.app.delMapDone'));
}

// ---------------- Dashboard ----------------


// เปิดฉากแรกของเล่ม (ฉบับร่างแรก บทแรก ฉากแรก) — ทางลัดจากตัวจัดการเล่ม
export async function openFirstSceneOf(secPath) {
  const draftRoot = await kapi.join(secPath, 'Draft');
  if (!(await kapi.exists(draftRoot))) { setStatus(tt('ui.app.bookNotHasDraft')); return; }
  const dns = await kapi.listDirs(draftRoot);
  if (!dns.length) return;
  const dPath = await kapi.join(draftRoot, dns[0]);
  const chs = ((await kapi.readJson(await kapi.join(dPath, 'draft.json'))).chapters || [])
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!chs.length) { setStatus(tt('ui.common.bookNotHasChapter')); return; }
  const ch = chs[0];
  const scAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {};
  const sc = (scAll[ch.guid] || []).sort((a, b) => (a.order || 0) - (b.order || 0))[0];
  if (!sc) { setStatus(tt('ui.app.chapterFirstNotHas')); return; }
  openScene(await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName), sc.title);
}

// สลับลำดับเล่ม: ย้าย from ไปไว้ก่อน dst แล้วเขียน order ใหม่ทั้งชุด

// ---------------- รายการเอกสารที่อ้างอิงได้: ฉากทุกบท + โน้ตใน Memos/ (ข้อ 5) ----------------
// เก็บ path แบบสัมพัทธ์กับ root เพื่อให้ย้าย/สำรองโปรเจกต์แล้วลิงก์ยังใช้ได้
export async function listRefTargets() {
  const out = [];
  if (!state.root) return out;
  const skip = new Set(['Wiki', 'Bible', 'Images', 'Memos', 'Research', 'Snapshots', '.k2history', 'Plugins', 'Recycle', 'Sessions', 'Starters']);
  for (const secName of await kapi.listDirs(state.root).catch(() => [])) {
    if (skip.has(secName)) continue;
    const secPath = await kapi.join(state.root, secName);
    if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
    const draftRoot = await kapi.join(secPath, 'Draft');
    if (!(await kapi.exists(draftRoot))) continue;
    for (const dn of await kapi.listDirs(draftRoot).catch(() => [])) {
      const dPath = await kapi.join(draftRoot, dn);
      let draft = {}; try { draft = await kapi.readJson(await kapi.join(dPath, 'draft.json')); } catch { continue; }
      let scAll = {}; try { scAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {}; } catch {}
      for (const ch of (draft.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))) {
        for (const sc of (scAll[ch.guid] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))) {
          const abs = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
          out.push({ kind: sc.type === 'memo' ? 'memo' : 'scene',
                     path: (await kapi.relative(state.root, abs)).replace(/\\/g, '/'),
                     title: sc.title || sc.fileName,
                     label: `${sc.type === 'memo' ? gi('note') : gi('file')} ${secName} / ${ch.title || '-'} / ${sc.title || sc.fileName}` });
        }
      }
    }
  }
  const memoDir = await kapi.join(state.root, 'Memos');
  if (await kapi.exists(memoDir)) {
    for (const f of await kapi.listFiles(memoDir, '.md').catch(() => [])) {
      const abs = await kapi.join(memoDir, f);
      let title = f.replace(/\.md$/i, '');
      try { title = parseMdFile(await kapi.readFile(abs)).meta.title || title; } catch {}
      out.push({ kind: 'memo', path: 'Memos/' + f, title,
                 label: gi('note') + ` MEMO / ${title}` });
    }
  }
  return out;
}

// กล่องเลือกเอกสาร/โน้ตที่จะอ้างอิง — มีช่องกรองเพราะโปรเจกต์จริงมีฉากเป็นร้อย
export async function pickReference() {
  const items = await listRefTargets();
  if (!items.length) { setStatus(tt('ui.app.notHasSceneNote2')); return null; }
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', tt('ui.app.refToDocNote')));
    const q = el('input', 'k-dlg-input'); q.placeholder = tt('ui.app.printFilter');
    box.append(q);
    const list = el('div', 'k-pick-list');
    const rows = items.map((it) => {
      const d = el('div', 'k-menu-item', it.label);
      d.onclick = () => { ov.remove(); resolve(it); };
      list.append(d);
      return { it, d };
    });
    q.oninput = () => {
      const s = q.value.trim().toLowerCase();
      for (const { it, d } of rows) d.style.display = !s || it.label.toLowerCase().includes(s) ? '' : 'none';
    };
    box.append(list);
    const btns = el('div', 'k-dlg-btns');
    const c = el('button', 'k-cancel', tt('ui.common.cancel'));
    c.onclick = () => { ov.remove(); resolve(null); };
    btns.append(c); box.append(btns); ov.append(box);
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
    document.body.append(ov);
    q.focus();
  });
}

// เปิดเอกสารที่ถูกอ้างอิง (path สัมพัทธ์กับ root)
export async function openRef(ref) {
  if (!ref || !ref.path || !state.root) return;
  const abs = await kapi.join(state.root, ...ref.path.split('/'));
  if (!(await kapi.exists(abs))) { setStatus(tt('ui.app.notFoundFileRef') + ref.path); return; }
  // [alpha.167] อ้างอิงตัวละคร/สถานที่ (หยิบใส่การ์ดเส้นเวลา) = เปิดหน้า Wiki ไม่ใช่เปิดเป็นฉาก
  if (ref.kind === 'entity') { openEntity(abs); return; }
  openScene(abs, ref.title || ref.path.split('/').pop());
}

/**
 * [alpha.167] ตั้ง "เวลาในเรื่อง" ของฉากจากเส้นเวลา (ลากการ์ดฉากบนบอร์ด)
 * frontmatter = แหล่งความจริง (writeSceneMeta) → ดัชนี scenes.json (updateSceneRow) → แท็บที่เปิดอยู่ (syncOpenTabMeta)
 * @param it  รายการบนเส้นเวลา ({ id:'sc:<dPath>:<sceneId>', file })
 */
export async function setSceneStoryDate(it, when) {
  if (!it || !it.file) return false;
  const id = String(it.id || '');
  const cut = id.lastIndexOf(':');
  const dPath = id.startsWith('sc:') && cut > 3 ? id.slice(3, cut) : '';
  const sceneId = cut >= 0 ? id.slice(cut + 1) : '';
  if (!dPath || !sceneId) return false;
  if (!(await writeSceneMeta(it.file, { storyDate: when }))) return false;
  await updateSceneRow(dPath, sceneId, (row) => { row.storyDate = when; });
  await syncOpenTabMeta(it.file);
  logAction('timeline', 'scene storyDate', { from: it.title || '', to: when });
  return true;
}

// ---------------- เส้นเวลา (Timeline) ----------------
// events ผู้ใช้เก็บใน <root>/timeline.json — ฉากที่มี storyDate ดึงมาแสดงอัตโนมัติ
export async function loadTimeline() {
  const p = await kapi.join(state.root, 'timeline.json');
  if (!(await kapi.exists(p))) return { version: TIMELINE_VERSION, events: [] };
  try { const d = await kapi.readJson(p); d.events = d.events || []; return d; }
  catch { return { version: TIMELINE_VERSION, events: [] }; }
}
export async function saveTimeline(data) {
  data.version = TIMELINE_VERSION;
  await kapi.writeFile(await kapi.join(state.root, 'timeline.json'), JSON.stringify(data, null, 2));
}
// ดึงฉากทุกเล่ม/ฉบับร่างที่ตั้ง storyDate ไว้ → เป็นเหตุการณ์อัตโนมัติบนเส้นเวลา
export async function sceneEventsFromProject() {
  const out = [];
  for (const sec of await listSections()) {
    const draftRoot = await kapi.join(sec.secPath, 'Draft');
    if (!(await kapi.exists(draftRoot))) continue;
    for (const dn of await kapi.listDirs(draftRoot)) {
      const dPath = await kapi.join(draftRoot, dn);
      const df = await kapi.join(dPath, 'draft.json');
      if (!(await kapi.exists(df))) continue;
      const scAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {};
      for (const chGuid of Object.keys(scAll)) {
        for (const sc of scAll[chGuid]) {
          if (sc.type === 'memo' || !sc.storyDate) continue;
          out.push({ id: 'sc:' + dPath + ':' + sc.id, title: sc.title || tt('ui.common.notNamed'),
                     when: sc.storyDate, track: sec.title, color: sc.color || '',
                     synopsis: sc.synopsis || '',
                     file: await kapi.join(dPath, 'Chapters',
                       (((await kapi.readJson(df)).chapters || []).find((c) => c.guid === chGuid) || {}).folderName || '',
                       sc.fileName) });
        }
      }
    }
  }
  return out;
}



// กล่องเพิ่ม/แก้เหตุการณ์ — คืน event object, 'DELETE', หรือ null
export function eventDialog(ev, knownTracks, canDelete = false) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', canDelete ? tt('ui.app.editEvent') : tt('ui.app.addEvent')));
    const mk = (label, val, ph, tag = 'input') => {
      const r = el('div', 'wiki-row'); r.append(el('label', null, label));
      const i = el(tag, 'wiki-input'); i.value = val || ''; if (ph) i.placeholder = ph;
      r.append(i); box.append(r); return i;
    };
    const iTitle = mk(tt('ui.app.nameEvent'), ev.title, tt('ui.app.eg3'));
    const iWhen = mk(tt('ui.app.timeStoryStart'), ev.when, tt('ui.app.egDate'));
    const iWhenEnd = mk(tt('ui.app.timeEndNotForce'), ev.whenEnd, tt('ui.app.skipEmptyEventDot'));
    const iTrack = mk(tt('ui.app.lineStory'), ev.track, tt('ui.app.egLineMainView'));
    if (knownTracks.length) {
      const dl = el('datalist'); dl.id = 'tl-tracks';
      for (const t of knownTracks) { const o = el('option'); o.value = t; dl.append(o); }
      iTrack.setAttribute('list', 'tl-tracks'); box.append(dl);
    }
    const iSort = mk(tt('ui.app.orderItemNumNot'), ev.sort ?? '', tt('ui.app.useReorderTimeText'));
    iSort.type = 'number';
    const iDesc = mk(tt('ui.app.detail'), ev.desc, '', 'textarea');

    // ---- อ้างอิง (ข้อ 5): ผูกเหตุการณ์กับฉาก/โน้ตจริงในโปรเจกต์ ----
    let refs = normalizeRefs(ev.refs);
    const refRow = el('div', 'wiki-row k-ev-refs');
    refRow.append(el('label', null, tt('ui.app.ref')));
    const refWrap = el('div', 'k-ev-ref-wrap');
    const refList = el('div', 'k-ev-ref-list');
    const addRef = el('button', 'k-tpl-add', tt('ui.app.refDocNote'));
    addRef.type = 'button';
    const paintRefs = () => {
      refList.replaceChildren();
      if (!refs.length) refList.append(el('span', 'dim', tt('ui.app.cantRef')));
      refs.forEach((r, i) => {
        const chip = el('span', 'k-ev-ref');
        chip.append(el('span', null, (r.kind === 'memo' ? gi('note') + ' ' : r.kind === 'entity' ? gi('user') + ' ' : gi('file') + ' ') + r.title));
        const x = el('span', 'k-ev-ref-x', gi('close')); x.title = tt('ui.app.refOut');
        x.onclick = () => { refs.splice(i, 1); paintRefs(); };
        chip.append(x);
        chip.title = r.path;
        refList.append(chip);
      });
    };
    addRef.onclick = async () => {
      const pick = await pickReference();
      if (!pick) return;
      refs = normalizeRefs([...refs, pick]);
      paintRefs();
    };
    paintRefs();
    refWrap.append(refList, addRef); refRow.append(refWrap); box.append(refRow);

    const btns = el('div', 'k-dlg-btns');
    if (canDelete) {
      const del = el('button', 'k-danger', tt('ui.common.del2'));
      del.onclick = () => { ov.remove(); resolve('DELETE'); };
      btns.append(del);
    }
    const cB = el('button', 'k-cancel', tt('ui.common.cancel'));
    const okB = el('button', 'k-ok', tt('ui.common.save'));
    btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
    cB.onclick = () => { ov.remove(); resolve(null); };
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
    okB.onclick = () => {
      const title = iTitle.value.trim();
      if (!title) { iTitle.focus(); return; }
      const sortVal = iSort.value.trim() === '' ? undefined : parseFloat(iSort.value);
      ov.remove();
      resolve({ ...ev, title, when: iWhen.value.trim(), whenEnd: iWhenEnd.value.trim(),
                track: iTrack.value.trim(), sort: sortVal, desc: iDesc.value.trim(),
                refs: normalizeRefs(refs) });
    };
    iTitle.focus();
  });
}

// ---------------- แผนที่ (Maps) ----------------
// เก็บใน <root>/maps.json — รูปแผนที่อยู่ในคลังรูป (Images/) เก็บ path แบบ 'Images/<file>'
export async function loadMaps() {
  const p = await kapi.join(state.root, 'maps.json');
  if (!(await kapi.exists(p))) return { version: MAPS_VERSION, maps: [] };
  // [alpha.70] migrateMaps เติมคีย์ที่เพิ่มทีหลัง (category/routes/overlays) ให้ไฟล์เวอร์ชัน 1.0
  try { return migrateMaps(await kapi.readJson(p)); }
  catch { return { version: MAPS_VERSION, maps: [] }; }
}
export async function saveMaps(data) {
  data.version = MAPS_VERSION;
  await kapi.writeFile(await kapi.join(state.root, 'maps.json'), JSON.stringify(data, null, 2));
}
// รูปแผนที่: เก็บ 'Images/<file>' → แปลงเป็น URL ด้วย resolveImg (อ้างอิงจาก root)
export function mapImgURL(rel) { return rel ? resolveImg(state.root, rel) : ''; }

export const mapsState_C = { s: null };   // object เพื่อ export ข้ามไฟล์


// เพิ่มแผนที่ใหม่: เลือกรูป → ตั้งชื่อ
export async function addMapFlow() {
  const it = await pickImage(state.root);
  const name = await ask(tt('ui.common.nameMap'), { value: it ? it.file.replace(/\.[^.]+$/, '') : tt('ui.common.mapNew') });
  if (!name) return;
  const m = newMap(name, it ? 'Images/' + it.file : '');
  m.order = mapsState_C.s.data.maps.length;
  mapsState_C.s.data.maps.push(m);
  mapsState_C.s.currentId = m.id;
  await saveMaps(mapsState_C.s.data);
  await enterMap(m.id);                        // [alpha.167] สร้างแล้วเข้าไปดูใบใหม่เลย (แผงเริ่มที่แกลเลอรี)
}

// กล่องแก้หมุด — คืน pin object, 'DELETE', หรือ null
export function pinDialog(pin, maps, curMapId, canDelete = false) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', canDelete ? tt('ui.app.editPin') : tt('ui.common.pinPin')));

    // เลือกชนิดหมุด
    const kindRow = el('div', 'wiki-row'); kindRow.append(el('label', null, tt('ui.app.kind')));
    const kindSel = el('select', 'wiki-input k-dlg-select');
    for (const [k, v] of Object.entries(PIN_KIND)) {
      const o = el('option', null, v.icon + ' ' + v.label); o.value = k;
      if (k === pin.kind) o.selected = true; kindSel.append(o);
    }
    kindRow.append(kindSel); box.append(kindRow);

    const iLabel = el('input', 'wiki-input'); iLabel.value = pin.label || '';
    { const r = el('div', 'wiki-row'); r.append(el('label', null, tt('ui.app.label')), iLabel); box.append(r); }

    // ลิงก์เอนทิตี้ (เมื่อ kind=entity)
    const entRow = el('div', 'wiki-row'); entRow.append(el('label', null, tt('ui.app.link')));
    const entSel = el('select', 'wiki-input k-dlg-select');
    entRow.append(entSel); box.append(entRow);
    const fillEntities = async () => {
      entSel.innerHTML = ''; const none = el('option', null, tt('ui.app.pick')); none.value = ''; entSel.append(none);
      for (const e of await loadAllEntities()) {
        const o = el('option', null, `${(PIN_KIND.entity.icon)} ${e.name} (${catLabel(e.cat)})`); o.value = e.file;
        if (e.file === pin.entityFile) o.selected = true; entSel.append(o);
      }
    };

    // ลิงก์ประตูไปแผนที่อื่น (เมื่อ kind=portal)
    const portalRow = el('div', 'wiki-row'); portalRow.append(el('label', null, tt('ui.app.portalMap')));
    const portalSel = el('select', 'wiki-input k-dlg-select');
    { const none = el('option', null, tt('ui.app.pickMapTo')); none.value = ''; portalSel.append(none);
      for (const m of sortMaps(maps)) { if (m.id === curMapId) continue;
        const o = el('option', null, gi('map') + ' ' + m.name); o.value = m.id;
        if (m.id === pin.toMap) o.selected = true; portalSel.append(o); } }
    portalRow.append(portalSel); box.append(portalRow);

    // สีหมุด
    const colorRow = el('div', 'wiki-row'); colorRow.append(el('label', null, tt('ui.common.color')));
    const colorSel = el('select', 'wiki-input k-dlg-select');
    { const none = el('option', null, tt('ui.app.auto')); none.value = ''; colorSel.append(none);
      for (const c of PIN_COLORS) { const o = el('option', null, gi('dot') + ' ' + c); o.value = c;
        if (c === pin.color) o.selected = true; colorSel.append(o); } }
    colorRow.append(colorSel); box.append(colorRow);

    const iNote = el('textarea', 'wiki-input'); iNote.value = pin.note || '';
    { const r = el('div', 'wiki-row'); r.append(el('label', null, tt('ui.common.msg6')), iNote); box.append(r); }

    // แสดง/ซ่อนแถวตามชนิด
    const syncRows = () => {
      entRow.style.display = kindSel.value === 'entity' ? '' : 'none';
      portalRow.style.display = kindSel.value === 'portal' ? '' : 'none';
    };
    kindSel.onchange = syncRows; syncRows();
    fillEntities();

    const btns = el('div', 'k-dlg-btns');
    if (canDelete) { const del = el('button', 'k-danger', tt('ui.common.del2'));
      del.onclick = () => { ov.remove(); resolve('DELETE'); }; btns.append(del); }
    const cB = el('button', 'k-cancel', tt('ui.common.cancel'));
    const okB = el('button', 'k-ok', tt('ui.common.save'));
    btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
    cB.onclick = () => { ov.remove(); resolve(null); };
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(null); } };
    okB.onclick = () => {
      ov.remove();
      resolve({ ...pin, kind: kindSel.value, label: iLabel.value.trim(),
                entityFile: kindSel.value === 'entity' ? entSel.value : '',
                toMap: kindSel.value === 'portal' ? portalSel.value : '',
                color: colorSel.value, note: iNote.value.trim() });
    };
    iLabel.focus();
  });
}

// ---------------- โหมดโฟกัส ----------------
// 0.56a #8: แถบบอกทางออกด้านบนของโหมดอ่าน/โฟกัส (เต็มจอแล้วผู้ใช้ไม่รู้จะออกยังไง)
function modeHint() {
  let h = document.getElementById('k-mode-hint');
  if (!h) { h = el('div'); h.id = 'k-mode-hint'; document.body.appendChild(h); }
  return h;
}
export function syncModeHint() {
  const reading = document.body.classList.contains('reading-mode');
  const focus = document.body.classList.contains('focus-mode');
  const h = modeHint();
  if (!reading && !focus) { h.textContent = ''; return; }
  const name = reading && focus ? tt('ui.app.modeReadFocus') : reading ? tt('ui.app.modeRead') : tt('ui.app.modeFocus');
  h.innerHTML = '';
  h.append(el('b', null, name), document.createTextNode(tt('ui.app.press')));
  h.append(el('kbd', null, 'Esc'), document.createTextNode(tt('ui.app.out')));
}

function toggleFocus(on) {
  const v = on ?? !document.body.classList.contains('focus-mode');
  document.body.classList.toggle('focus-mode', v);
  toggleFocusMode2(v);          // หรี่บรรทัดอื่นไปพร้อมกัน (โมดูล focus-mode.js)
  syncModeHint();
  syncMenuToggles();
  refreshToolbar();
  recenterPageSoon();           // [66r5] แผงข้างหาย/กลับมา = พื้นที่กว้างขึ้น ต้องจัดกระดาษกลางใหม่
  setStatus(v ? tt('ui.app.modeFocusEscCtrl') : tt('ui.app.exitModeFocus'));
}

// ---------------- เครื่องหมายถูกในเมนู native (ข้อ 3) ----------------
// เมนูหลักเป็นเมนู OS จริง → ทำเครื่องหมายเองไม่ได้จากฝั่ง renderer
// ต้องส่งสถานะสวิตช์ทุกตัวไปให้ main แล้ว main สร้างเมนูใหม่ด้วย type:'checkbox'/'radio'
let _menuTogSig = '';
export function syncMenuToggles() {
  try { syncSideToggles(); } catch {}
  if (typeof kapi === 'undefined' || !kapi.menuToggles) return;
  try {
    const ps = panelToggleState();
    const payload = {
      paperMode: true,
      theme: currentTheme(),                        // [60r2 ข้อ 10]
      // [alpha.138] ทะเบียนธีม → เมนู มุมมอง สร้างรายการจากก้อนนี้ (main ไม่มีรายชื่อของตัวเอง)
      themes: THEMES.map((id) => ({ id, label: tt(THEME_LABEL_KEYS[id]) })),
      fabEnabled: state.settings.fabEnabled !== false,   // [60r2 ข้อ 9]
      readingMode: document.body.classList.contains('reading-mode'),
      focusMode: document.body.classList.contains('focus-mode'),
      typewriter: isTypewriter(),
      lineNumbers: !!state.settings.lineNumbers,
      splitView: isSplit() ? splitDir() : false,
      format: state.active?.sp ? 'screenplay' : 'prose',
      // alpha.57 — เมนู "บท": โหมดมุมมอง + แสดงรูปแบบ + ตรวจก่อนส่งออก
      spView: currentSpView(),
      pageGuides: !!state.settings.pageGuides,      // [alpha.100 ข้อ 2]
      showFormat: isFormatGuide(),
      checkBeforeExport: state.settings.spCheckBeforeExport !== false,
      // alpha.57a — เลขฉาก / เลขหน้า / เสียงพิมพ์
      sceneNumbers: !!(state.settings.spSceneNumbers || {}).show,
      pageNumbers: !!(state.settings.spPageNumbers || {}).show,
      continueds: spContinuedOn(),                  // alpha.58 · 55–56
      typeSound: !!state.settings.typeSound,
      markdownCodes: showMarkdownCodes(),            // [60r3 ข้อ 6]
      autoFitWidth: !!state.settings.autoFitWidth,  // [alpha.164 · รอบต่อ 3] เมนู มุมมอง → ซูม
      // [alpha.61 ข้อ 1] ลำดับเปิดโปรแกรม — เมนูไฟล์ / เมนูมุมมอง
      openLastProject: state.settings.openLastProject === true,
      showHomeAlways: state.settings.showHomeOnStartup === true,
      // [alpha.61 ข้อ 4] อิสระเรื่องตัวพิมพ์ในบทหนัง
      spForceCase: state.settings.spForceCase !== false,
      spAutoCapitalize: state.settings.spAutoCapitalize !== false,
      spAutoCorrectI: state.settings.spAutoCorrectI !== false,
      // [alpha.62 บั๊ก 11] ติ๊กรายชนิดใน เมนูบท → 🔠 ตัวพิมพ์ใหญ่/เล็ก → บังคับตัวพิมพ์ใหญ่เฉพาะชนิด
      spCaps: (() => {
        const f = spFormat();
        return CAPS_ELEMENTS.map((k) => ({ el: k, label: elemLabel(k), on: elementCaps(f, k) }));
      })(),
      panels: ps,                                  // [alpha.162 · W2] id จริงชุดเดียว (ชื่อยุคเก่าไม่มีใครอ่าน)
      // [alpha.147] คีย์ลัดที่ผู้ใช้ตั้งเอง → main ใช้เติม accelerator ของเมนูระบบให้ตรงกับของจริง
      shortcuts: (state.settings && state.settings.shortcuts) || {},
    };
    // สร้างเมนู native ใหม่ทุกครั้งแพงเกินไป — ส่งเฉพาะตอนค่าเปลี่ยนจริง
    const sig = JSON.stringify(payload);
    if (sig === _menuTogSig) return;
    _menuTogSig = sig;
    kapi.menuToggles(payload);
  } catch {}
}

// ---------------- โหมดหน้ากระดาษ (กระดาษขาว high-contrast แบบสคริปต์จริง) ----------------
/**
 * ══════ [alpha.99 ข้อ 2] ★ "โหมดหน้ากระดาษ" ถูกถอดออกทั้งชุด ══════
 *
 * ผู้ใช้: *"เราบอกว่า mode หน้ากระดาษ Ctrl+Alt+U ลบออก เพราะมันซ้ำกับ layout"*
 *
 * สวิตช์นี้ทำเรื่องเดียวกับการสลับ **มุมมองปกติ ↔ มุมมองจัดหน้า** ทุกประการ
 * (ปกติ = สายเนื้อหาต่อเนื่อง รอยต่อเป็นเส้นประ · จัดหน้า = แผ่นกระดาษจริง)
 * เหลือไว้สองทางทำเรื่องเดียวกันคือที่มาของความสับสนทั้งหมดในสามรอบที่ผ่านมา
 *
 * คลาส `paper-mode` ยังอยู่บน `<body>` **ตลอดเวลา** เพราะเป็นนิยามของ "หน้าตากระดาษ"
 * ที่กฎ CSS อีกหลายสิบข้อใช้อยู่ (สีกระดาษ · หมึก · โหมดอ่าน) — แค่ไม่มีใครปิดมันได้อีกแล้ว
 */
export function applyPaperClass() {
  document.body.classList.add('paper-mode');
  return true;
}

// ---------------- [alpha.60r2 ข้อ 10] ธีมของโปรแกรม (Dark / Light) ----------------
// ⚠ ธีมสลับเฉพาะ "เปลือกโปรแกรม" (แถบเครื่องมือ · แผง · แท็บ · กล่อง) ผ่านตัวแปร CSS ชุด --bg/--fg/…
// ไม่แตะ --paper-* จึงไม่กระทบหน้ากระดาษ/มุมมองหน้ากระดาษ/งานที่พิมพ์ออกมาแม้แต่นิดเดียว
// (คนละเรื่องกับ "โหมดหน้ากระดาษ" ซึ่งยังเปิด/ปิดได้ที่ปุ่ม 📄 และเมนู มุมมอง ตามเดิม)
// [alpha.137] รายชื่อธีมอยู่ที่ `THEMES` ใน core.js ที่เดียว — ที่นี่แค่เอาไปใช้
// [alpha.138] ไม่มีปุ่มธีมบนแถบและไม่มีคีย์ลัดแล้ว (ผู้ใช้สั่ง) — เลือกจาก dropdown ในตั้งค่า
/** ธีมที่ใช้อยู่จริง — แปลงค่าเก่า (dark/light) ให้เป็นธีมปัจจุบันเสมอ */
export function currentTheme() {
  const raw = state.settings.theme;
  const id = THEME_ALIAS[raw] || raw;
  return THEMES.includes(id) ? id : THEMES[0];
}
export function applyTheme() {
  const th = currentTheme();
  // ค่าเก่าที่ถูกแปลงแล้ว เขียนกลับลง settings ทันที ไม่งั้นมันค้างอยู่ในไฟล์ตลอดไป
  if (state.settings.theme !== th) state.settings.theme = th;
  // ถอดคลาสของทุกธีมก่อนเสมอ แล้วค่อยใส่ของธีมปัจจุบัน (เพิ่มธีมใหม่ = ไม่ต้องมาแก้ตรงนี้)
  for (const id of THEMES) document.body.classList.toggle('theme-' + id, id === th);
  // [alpha.165] ★ ผู้ใช้: "theme สีเดิมที่เป็นสีเทายังอยู่" — ไม่เคยตั้ง color-scheme เลย
  //   ช่องติ๊ก · ช่องตัวเลข · ตัวเลือกสี · รายการของ <select> · แถบเลื่อนดั้งเดิม จึงวาดเป็นเทา/ขาวของเบราว์เซอร์ทุกธีม
  //   ตั้งตามโหมดของธีม (THEME_MODES จาก themes.json) ที่ <html> — ส่วนควบคุมดั้งเดิมทั้งหน้าตามธีม
  const mode = THEME_MODES[th] === 'light' ? 'light' : 'dark';
  try { document.documentElement.style.colorScheme = mode; } catch {}
  // [alpha.166] จำธีมไว้ให้ renderer/theme-boot.js ทาก่อนเฟรมแรกของหน้าต่างถัดไป (หน้าต่างแผงที่ฉีก · บูตรอบหน้า)
  try { localStorage.setItem('k2-boot-theme', th); localStorage.setItem('k2-boot-mode', mode); } catch {}
  // [alpha.166] หน้าต่างแผงที่ฉีกออกไปต้องเปลี่ยนธีมตาม (เดิมค้างธีมตอนฉีกจนกว่าจะปิด-เปิดใหม่)
  if (!PANEL_WIN) { try { kapi.broadcast && kapi.broadcast({ kind: 'theme', id: th }); } catch {} }
  clearThemeColorCache();                  // [alpha.162 · W6 ข้อ 2] ผืนวาด (กระดาน · ผังแตกสาย) อ่านสีธีมใหม่
  // [alpha.164 ข้อ A1–A2] ผืนวาดที่เปิดค้างอยู่ (ผังความสัมพันธ์ · กระดานวางแผน) ฟังแล้ววาดสีธีมใหม่เอง
  try { window.dispatchEvent(new CustomEvent('k2-theme', { detail: th })); } catch {}
  return th;
}
/** ตั้งธีม — ส่งชื่อธีมมาก็ตั้งตรง ๆ · ไม่ส่ง = วนไปตัวถัดไปใน THEMES (เมนู มุมมอง ใช้แบบส่งชื่อ) */
export function toggleTheme(mode) {
  const cur = currentTheme();
  const th = THEMES.includes(THEME_ALIAS[mode] || mode)
    ? (THEME_ALIAS[mode] || mode)
    : THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  state.settings.theme = th;
  applyTheme();
  // [alpha.162 · W3] ★ ค่านี้อยู่ใน GLOBAL_DEFAULTS (= ระดับผู้ใช้) แต่เดิมสวิตช์จากเมนูเขียนลง
  // **ไฟล์ผลงาน** อย่างเดียว → เปิดผลงานอื่นแล้วค่ากลับไปเป็นค่าเริ่มต้น ทั้งที่กล่องตั้งค่าบอกว่า
  // "ตามผู้ใช้ไปทุกผลงาน" (กล่องตั้งค่าเขียนทั้งสองไฟล์อยู่แล้ว — เมนูตกหล่นทางเดียว)
  saveGlobalSetting('theme', th);
  saveProjectMetaSoon();
  syncMenuToggles();
  setStatus(tt(THEME_LABEL_KEYS[th] || 'ui.app.themeDarkDark'));
  return th;
}

// ---------------- โหมดอ่าน (📖) — เต็มจอ, ปิด cursor, ซ่อน UI ----------------
// การซ่อน UI ทำด้วย CSS (body.reading-mode) ล้วน — ห้ามใช้ inline style.display
// เพราะ inline ค้างอยู่ข้ามการสลับโหมดแล้วไปทับกฎอื่น (เคยทำให้แผง/FAB ไม่กลับมา)
let _readEsc = null;                       // ตัวจับ Esc ตัวเดียว (กันซ้อนกันหลายตัว)
function toggleReading(on) {
  const v = on ?? !document.body.classList.contains('reading-mode');
  document.body.classList.toggle('reading-mode', v);
  const btn = $('#tb-read'); if (btn) btn.classList.toggle('on', v);
  const t = state.active;
  const ce = v ? 'false' : 'true';
  if (t?.editor) t.editor.view.dom.setAttribute('contenteditable', ce);
  if (t?.sp) t.sp.view.dom.setAttribute('contenteditable', ce);
  // เก็บกวาด inline style ที่เวอร์ชันก่อนหน้าเคยเขียนค้างไว้
  for (const id of ['#app-root', '#statusbar', '#toolbar', '#titlebar', '#tabs', '#k-fab']) {
    const elx = $(id); if (elx) elx.style.display = '';
  }
  if (_readEsc) { document.removeEventListener('keydown', _readEsc); _readEsc = null; }
  if (v) {
    // เปิดโหมดโฟกัสอยู่ด้วย → Esc ครั้งแรกให้ออกจากโฟกัสก่อน (ตัวจับของโฟกัสจัดการ) ครั้งถัดไปค่อยออกโหมดอ่าน
    _readEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.k-overlay')) return;
      if (e._k2EscUsed || document.body.classList.contains('focus-mode')) return;
      e._k2EscUsed = true;
      toggleReading(false);
    };
    document.addEventListener('keydown', _readEsc);
  }
  syncModeHint();
  syncMenuToggles();
  syncFloatBarVisible();
  recenterPageSoon();           // [66r5] แผงข้างหายไปหมด = พื้นที่กว้างขึ้น ต้องจัดกระดาษกลางใหม่
  setStatus(v ? tt('ui.app.modeReadPressEsc') : tt('ui.app.exitModeRead'));
}

// ---------------- คุณสมบัติฉาก ----------------

// เวอร์ชันแอปปัจจุบัน (จาก package.json) — ใช้บันทึกว่าแก้ไฟล์ด้วยเวอร์ชันไหน
export const APP_VERSION = (typeof kapi !== 'undefined' && kapi.appVersion) ? kapi.appVersion : '2.0.0';

// ปรับการแก้ไขได้/ไม่ได้ของแท็บที่เปิดอยู่ตามสถานะล็อก (ProseMirror อ่าน editable ใหม่เมื่อ dispatch)
export function applyLockToTab(tab) {
  if (!tab) return;
  const v = tab.editor?.view || tab.sp?.view;
  if (v) v.dispatch(v.state.tr);                       // no-op tr → re-eval editable
  tab.pane?.classList.toggle('pane-locked', !!tab.locked);
}

// ตั้งสถานะล็อกของฉาก: เขียนทั้ง scenes.json (ให้ tree เห็น) + frontmatter (.md) + แท็บที่เปิดค้าง
async function setSceneLock(dPath, ch, sc, locked) {
  const sf = await kapi.join(dPath, 'scenes.json');
  // [alpha.159 · M1] ผ่านคิว (อ่านสด) — เดิม readJson/writeFile ทับการเขียนที่ซ้อนกันอยู่
  const res = await mutateJson(kapi, sf, (d) => {
    const r = ((d.chapters || {})[ch.guid] || []).find((x) => x.id === sc.id);
    if (!r) return false;
    r.locked = locked;
    return { ...r };
  });
  const row = res.changed ? res.result : null;
  const file = await kapi.join(dPath, 'Chapters', ch.folderName, (row || sc).fileName);
  try {
    const { meta, body } = parseMdFile(await kapi.readFile(file));
    if (locked) meta.locked = 'true'; else delete meta.locked;
    await writeKeepingComments(file, dumpMdFile(meta, body));   // [alpha.159 · M1] ไม่ลบเธรดคอมเมนต์
  } catch {}
  const openTab = state.tabs.get(file);
  if (openTab) {
    // [alpha.155] ปลดล็อกฉากที่อยู่ในบท/เล่มที่ล็อก → ยังแก้ไม่ได้ (ล็อกของชั้นบนชนะ)
    let upper = '';
    try { upper = await (await import('./tree-actions.js')).containerLockOf(file); } catch {}
    openTab.locked = locked || !!upper; openTab.meta.locked = locked ? 'true' : undefined; applyLockToTab(openTab);
  }
  await buildTree();
  setStatus(locked ? tt('ui.app.lockSceneDoneEdit') : tt('ui.app.unlockSceneDone'));
}

// ---------------- คุณสมบัติฉาก (แบบแผง dock ได้ แทน popup) ----------------
const propsTarget_C = { t: null };
function setPropsTarget(dPath, ch, sc) {
  const prev = propsTarget_C.t;
  // ย้ายไปฉากอื่น → เขียนค่าที่ค้างของฉากเดิมให้จบก่อน (บันทึกอัตโนมัติ ข้อ 13)
  if (prev && prev.sc?.id !== sc?.id && propsFlush_C.fn) {
    const flush = propsFlush_C.fn; propsFlush_C.fn = null;
    try { flush(); } catch {}
  }
  // [alpha.68] รับ null ได้ — หน้าต่างแผงคุณสมบัติเรียกด้วยค่าว่างเมื่อหน้าต่างหลักไม่ได้เปิดฉากอยู่
  // (ปล่อยเป็น {dPath:null,…} จะกลายเป็นเป้าหมายจอมปลอมที่ผ่านด่าน `if (!propsTarget_C.t)` ไปได้)
  propsTarget_C.t = (dPath && ch && sc) ? { dPath, ch, sc } : null;
  if (propsTarget_C.t) propsItem_C.t = null;          // [alpha.155] เลือกฉาก = เลิกโชว์คุณสมบัติของชิ้นอื่น
  if (isPanelOpen('props')) renderPropsPanel();
}
/**
 * [alpha.161 · P1] ★ แผงคุณสมบัติตาม "แท็บที่เปิดอยู่" — เดิม activate() ไม่เคยบอกแผง
 * → สลับแท็บแล้วแผงยังโชว์ (และบันทึกลง) ฉากเก่า · แท็บฉาก .md ใน Chapters = ตั้งเป้าเป็นฉากนั้น
 * แท็บชนิดอื่น/ไม่มีแท็บ = เลิกโชว์ฉากเก่า (แผงขึ้นสถานะว่าง) · **ไม่เปิดแผงเอง** (บั๊ก #19)
 * หา ch/row ด้วย sceneCtx (จับทั้งโฟลเดอร์บท + ชื่อไฟล์) · งานซ้อนรอบเก่าถูกทิ้งด้วยเลขรอบ
 */
const propsSync_C = { gen: 0 };
export async function syncPropsToActive() {
  const gen = ++propsSync_C.gen;
  const t2 = state.active;
  let ctx = null;
  if (t2 && t2.file && /\.md$/i.test(t2.file) && /[\\/]Chapters[\\/]/.test(t2.file)) {
    try { ctx = await sceneCtx(t2.file); } catch { ctx = null; }
  }
  if (gen !== propsSync_C.gen) return false;             // สลับแท็บซ้อนระหว่างอ่าน — รอบใหม่เป็นคนตัดสิน
  const cur = propsTarget_C.t;
  if (ctx && ctx.row) {
    if (cur && cur.sc && cur.sc.id === ctx.row.id && cur.dPath === ctx.dPath) return true;   // ฉากเดิม = ไม่วาดใหม่
    setPropsTarget(ctx.dPath, ctx.ch, ctx.row);
    return true;
  }
  if (cur) setPropsTarget(null, null, null);              // เขียนค่าที่ค้างของฉากเดิมให้จบ แล้วโชว์สถานะว่าง
  return false;
}
/**
 * [alpha.155] คุณสมบัติ (แผง) ของเล่ม · บท · memo · รูป · กระดาน · แผน
 * แผงเดียวกับของฉาก — วาดด้วยชุดช่องเดียวกับหน้าต่างคุณสมบัติ (tree-actions.itemFieldDefs)
 */
const propsItem_C = { t: null };
export function openItemPropsPanel(kind, ctx) {
  propsTarget_C.t = null;
  propsItem_C.t = { kind, ctx };
  if (!isPanelOpen('props')) showPanel('props');
  renderPropsPanel();
}
function openPropsPanel(dPath, ch, sc) {
  const was = isPanelOpen('props');
  setPropsTarget(dPath, ch, sc);      // เรียก renderPropsPanel() ให้แล้วถ้าแผงเปิดอยู่
  // บั๊ก #19: เดิมสั่ง showPanel ทุกครั้ง → แผงที่ผู้ใช้เพิ่งปิดไปโผล่กลับมาเองทุกครั้งที่คลิกฉาก
  if (!was) { showPanel('props'); renderPropsPanel(); }
}
// บั๊กข้อ 14: ฟังก์ชันนี้เป็น async — ล้าง body ตอนต้น แล้ว await หลายจังหวะ
// ถ้าถูกเรียกซ้อน (setPropsTarget + openPropsPanel เรียกติดกัน) ทั้งสองรอบจะ append ทับกัน = รายการซ้ำ
// แก้ด้วยหมายเลขรอบ: รอบที่ไม่ใช่รอบล่าสุดต้องหยุดทันทีหลังทุกจุด await
let _propsGen = 0;
async function renderPropsPanel() {
  const body = $('#props-body'); if (!body) return;
  const gen = ++_propsGen;
  const stale = () => gen !== _propsGen;
  // [alpha.66r2 ข้อ 1] แผงคุณสมบัติวาดใหม่ทุกครั้งที่สลับฉาก/บันทึก — ถ้าไม่จำตำแหน่งเลื่อน
  // ผู้ใช้ที่กำลังกรอกช่องล่าง ๆ (แท็ก/สถานะ) จะถูกดีดกลับหัวแผงทุกครั้ง
  const backScroll = keepScroll(body);
  body.replaceChildren();
  if (!propsTarget_C.t && propsItem_C.t) {
    const { kind, ctx } = propsItem_C.t;
    try { await (await import('./tree-actions.js')).renderItemProps(body, kind, ctx); }
    catch (e) { log('warn', 'renderItemProps', e); }
    return;
  }
  if (!propsTarget_C.t) { body.append(el('div', 'dim', tt('ui.app.pickSceneViewProps'))); return; }
  const { dPath, ch, sc } = propsTarget_C.t;
  const sf = await kapi.join(dPath, 'scenes.json');
  if (stale()) return;
  const d = await kapi.readJson(sf);
  if (stale()) return;
  const row = (d.chapters[ch.guid] || []).find((x) => x.id === sc.id);
  if (!row) { body.replaceChildren(el('div', 'dim', tt('ui.app.notFoundScene'))); return; }
  body.replaceChildren();              // กันของค้างจากรอบก่อนที่ยัง append ไม่ทัน
  // [alpha.120 ข้อ 6] ★ ชื่อฉากต้องแก้ได้จากแผงด้วย — เดิมเป็นข้อความตายตัว ต้องไปคลิกขวาที่ต้นไม้
  // (ผู้ใช้: "คุณสมบัติแบบหน้าต่างกับแผงไม่เหมือนกัน … และมันต้องเปลี่ยนชื่อได้นะ")
  const nameRow = el('div', 'props-name');
  nameRow.append(document.createTextNode(gi('file') + ' '));
  const nameIn = el('input', 'props-name-input');
  nameIn.value = row.title || '';
  nameIn.title = tt('ui.props.renameHint');
  const commitName = async () => {
    const v = nameIn.value.trim();
    if (!v || v === row.title) { nameIn.value = row.title || ''; return; }
    await setSceneTitle(dPath, ch, row, v);
    row.title = v;
  };
  nameIn.addEventListener('blur', () => commitName().catch(() => {}));
  nameIn.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); nameIn.blur(); }
    if (ev.key === 'Escape') { nameIn.value = row.title || ''; nameIn.blur(); }
  });
  nameRow.append(nameIn);
  body.append(nameRow);

  // ---- แถบล็อก (แก้ไฟล์ไม่ได้จนปลดล็อก) ----
  const lockRow = el('div', 'props-lock');
  const lockChk = el('input', null); lockChk.type = 'checkbox'; lockChk.checked = !!row.locked;
  const lockLbl = el('label', null); lockLbl.append(lockChk,
    document.createTextNode(row.locked ? tt('ui.app.lockEditCant') : tt('ui.app.lockScene')));
  lockChk.onchange = async () => { await setSceneLock(dPath, ch, sc, lockChk.checked); renderPropsPanel(); };
  lockRow.append(lockLbl); body.append(lockRow);

  // ---- เวอร์ชัน: แก้ไขล่าสุดด้วยแอปเวอร์ชันไหน + revision + ปุ่มเทียบ ----
  const file0 = await kapi.join(dPath, 'Chapters', ch.folderName, row.fileName);
  if (stale()) return;
  let vmeta = {}; try { vmeta = parseMdFile(await kapi.readFile(file0)).meta; } catch {}
  if (stale()) return;
  // ══ [alpha.161 · P2] ★ คุณสมบัติหนักอ่านจาก frontmatter (กฎ scene-meta) ══
  // เดิมแผงอ่านจาก scenes.json อย่างเดียว → แก้ .md นอกโปรแกรมแล้ว "หน้าต่าง" เห็นค่าใหม่ แต่ "แผง" เห็นค่าเก่า
  // แล้วพิมพ์อะไรในแผงก็เขียนค่าเก่าทับ frontmatter กลับไป · ตอนนี้ใช้ readSceneMeta ตัวเดียวกับหน้าต่าง
  Object.assign(row, await readSceneMeta(file0, row));
  if (stale()) return;
  const verRow = el('div', 'props-ver');
  verRow.append(el('div', 'props-ver-line',
    ttf('ui.app.versionEditF', (vmeta.appVersion || '—'), (vmeta.revision || '0'))));
  const verBtns = el('div', 'props-ver-btns');
  const bHist = el('button', null, tt('ui.app.history')); bHist.onclick = () => versionDialog(dPath, ch, sc);
  const bCmp = el('button', null, tt('ui.app.compareVersion2')); bCmp.onclick = () => compareVersionsDialog(dPath, ch, sc);
  verBtns.append(bHist, bCmp); verRow.append(verBtns); body.append(verRow);

  const rowOf = new Map();          // input → แถว (ปุ่ม ✨ ของข้อ 2 มาแปะทีหลัง)
  const mk = (label, val, tag = 'input') => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, label));
    const i = el(tag, 'wiki-input'); i.value = val || ''; r.append(i); body.append(r);
    rowOf.set(i, r); return i;
  };
  const mkSel = (label, options, cur) => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, label));
    const s = el('select', 'wiki-input k-dlg-select');
    for (const [v, txt] of options) { const o = el('option', null, txt); o.value = v; if (v === cur) o.selected = true; s.append(o); }
    r.append(s); body.append(r); return s;
  };
  const mkChk = (label, checked) => {
    const r = el('div', 'wiki-row'); r.append(el('label', null, label));
    const c = el('input', 'wiki-check'); c.type = 'checkbox'; c.checked = !!checked; r.append(c); body.append(r); return c;
  };

  // [alpha.157] องก์ + บท (ย้ายฉากไปบทอื่นได้จากตรงนี้) — คลาสของตัวเอง ไม่นับรวมกับ .wiki-input
  {
    const acHost = el('div', 'props-ac-host');
    body.append(acHost);
    try {
      await buildActChapterRows(acHost, { dPath, ch, sc }, { onMoved: async () => {
        propsTarget_C.t = null; await buildTree(); renderPropsPanel(); } });
    } catch (e) { log('warn', 'act/chapter rows', e); }
    if (stale()) return;
  }
  const iSyn = mk(tt('ui.common.synopsis'), row.synopsis, 'textarea');
  const iStoryDate = mk(tt('ui.common.timeStoryLineTime'), row.storyDate);
  iStoryDate.placeholder = tt('ui.app.date');
  // [alpha.57a ข้อ 2] เลขหน้าเริ่มต้นของไฟล์ฉากนี้ (ใช้เมื่อเปิด "เลขหน้า" ในตั้งค่าโปรเจกต์)
  const iStartPage = mk(tt('ui.app.pageNumStartChapter'), row.startPage || '');
  iStartPage.type = 'number'; iStartPage.min = '1'; iStartPage.placeholder = '1';
  // ══ [alpha.141] ★ "ไล่เลขหน้าต่อเนื่อง" ══
  // ผู้ใช้: *"ของเดิมปกติจะ run เลขหน้าที่ 1 ของฉาก ทีนี้มันจะต้อง run ต่อ ๆ กัน …
  //          ในคุณสมบัติของฉาก ควรมีให้เลือก run เลขหน้าต่อกันเลย"*
  // ★ ใช้คลาสของตัวเอง (`wiki-flowchk`) ไม่ใช่ `wiki-check` — เทสหลายจุดอ้างช่องติ๊ก **ตามลำดับ**
  //   แทรกตัวใหม่เข้าไปกลางกลุ่มเมื่อไหร่ ทุกจุดพังพร้อมกัน (บทเรียนข้อ 12)
  const flowRow = el('div', 'wiki-row');
  flowRow.append(el('label', null, tt('ui.scene.pageFlowContinue')));
  const iFlow = el('input', 'wiki-flowchk');
  iFlow.type = 'checkbox'; iFlow.checked = row.pageFlow === 'continue';
  iFlow.title = tt('ui.scene.pageFlowHint');
  flowRow.append(iFlow); body.append(flowRow);
  const iPov = mk(tt('ui.common.viewPOV'), row.pov);
  const iEmotion = mk(tt('ui.common.mood'), row.emotion);
  const iConflict = mk(tt('ui.common.conflict'), row.conflict);
  // สถานะต้องใช้ allStatuses() เหมือนกล่องคุณสมบัติ ไม่งั้นสถานะที่ผู้ใช้สร้างเองจะหายตอนบันทึก
  // [alpha.160 · P1-11] ค่าที่ถูกลบออกจากรายการแล้ว = คงไว้เป็นตัวเลือกพิเศษ (ไม่ตกเป็น Outline แล้วบันทึกทับ)
  const stc = statusChoices(allStatuses(), row.status);
  const iStatus = mkSel(tt('ui.common.status'), [['Outline', tt('ui.common.notSet')],
    ...stc.values.map((s) => [s, s === stc.orphan ? ttf('ui.status.orphanOpt', dataLabel(s)) : dataLabel(s)])],
    stc.selected);
  const iColor = mkSel(tt('ui.common.color'), [['', tt('ui.common.notHas')], ...SCENE_COLORS.map(([n, hex]) => [hex, gi('dot') + ' ' + dataLabel(n)])], row.color || '');
  const iFlag = mkChk(tt('ui.common.pinPin'), row.flag);
  const iTags = mk(tt('ui.common.tag2'), (row.tags || []).join(', '));
  const iNote = mk(tt('ui.common.note'), row.note, 'textarea');
  // [alpha.120 ข้อ 6] ★ สองช่องนี้มีแต่ใน "กล่อง" ไม่เคยมีใน "แผง" — ผู้ใช้เปิดแผงแล้วหาไม่เจอ
  // ป้ายเล่าเรื่อง (ฉากนอกลำดับเวลาหลัก) ต้องมีทั้งสองที่ ไม่งั้นตั้งจากแผงไม่ได้เลย
  const iFuture = mk(tt('ui.scene.futureNoteWriter'), row.futureNote || '', 'textarea');
  iFuture.placeholder = tt('ui.scene.noteWriterShowOnly');
  const iFb = mkChk(tt('ui.common.flashback'), row.isFlashback);
  const iFf = mkChk(tt('ui.common.pageFlashforward'), row.isFlashforward);
  iFb.addEventListener('change', () => { if (iFb.checked) iFf.checked = false; });
  iFf.addEventListener('change', () => { if (iFf.checked) iFb.checked = false; });

  // ---- [alpha.70 ข้อ 1] ตำแหน่งบนแผนที่ + ปุ่ม "ดูบนแผนที่" ----
  // อ่าน maps.json (async) → ต้องเช็ค stale เหมือนทุกจุด await ในฟังก์ชันนี้ ไม่งั้นแถวของฉากเก่าโผล่ทับ
  try {
    const mapRow = await buildShowOnMapRow(row);
    if (stale()) return;
    body.append(mapRow);
  } catch (e) { log('warn', tt('ui.app.propsNewRowPos'), e); }

  // ---- [alpha.157] ฉากนี้กล่าวถึงอะไรบ้าง (แบ่งตามหมวด Wiki) ----
  try {
    const mHost = el('div', 'props-mentions-host');
    body.append(mHost);
    await buildMentionsBox(mHost, file0);
    if (stale()) return;
  } catch (e) { log('warn', 'mentions', e); }

  // ---- บันทึกอัตโนมัติ (ข้อ 13) — ไม่ต้องกดปุ่มแล้ว ----
  // พิมพ์แล้วรอเงียบ 600ms ค่อยเขียน (กันเขียนไฟล์ทุกตัวอักษร) · เปลี่ยน dropdown/checkbox = เขียนทันที
  const statusLine = el('div', 'props-autosave', tt('ui.app.saveAuto'));
  body.append(statusLine);

  const collect = () => {
    row.synopsis = iSyn.value; row.pov = iPov.value; row.status = iStatus.value;
    row.storyDate = iStoryDate.value.trim();
    row.emotion = iEmotion.value; row.conflict = iConflict.value;
    row.color = iColor.value; row.flag = iFlag.checked; row.note = iNote.value;
    row.tags = iTags.value.split(',').map((x) => x.trim()).filter(Boolean);
    row.futureNote = iFuture.value;
    if (iFb.checked && iFf.checked) iFf.checked = false;
    row.isFlashback = iFb.checked; row.isFlashforward = iFf.checked;
    const sp = parseInt(iStartPage.value, 10);
    if (Number.isFinite(sp) && sp > 0) row.startPage = sp; else delete row.startPage;
    if (iFlow.checked) row.pageFlow = 'continue'; else delete row.pageFlow;
  };
  const snapshot = () => JSON.stringify([row.synopsis, row.pov, row.status, row.storyDate,
    row.emotion, row.conflict, row.color, row.flag, row.note, row.tags, row.startPage,
    row.pageFlow, row.futureNote, row.isFlashback, row.isFlashforward]);
  let lastSaved = (collect(), snapshot());

  const commit = async (rebuildTree) => {
    collect();
    const now = snapshot();
    if (now === lastSaved) return;          // ไม่มีอะไรเปลี่ยน = ไม่แตะดิสก์
    lastSaved = now;
    statusLine.textContent = tt('ui.app.busySave2');
    // [alpha.156] ★ เขียนลงแถว "สด" — `d` ถูกอ่านไว้ตอนวาดแผง ซึ่งอาจนานเป็นชั่วโมง
    // เดิมเขียน `d` ทั้งก้อนกลับ → ฉากที่เพิ่ม/ย้าย/เรียงใหม่ระหว่างนั้นหายจากทะเบียน (ไฟล์กลายเป็นกำพร้า)
    const PANEL_FIELDS = ['status', 'color', 'flag', 'startPage', 'pageFlow', ...SCENE_HEAVY_KEYS];
    await mutateJson(kapi, sf, (fresh) => {
      const live = ((fresh.chapters || {})[ch.guid] || []).find((x) => x.id === sc.id);
      if (!live) return false;
      for (const k of PANEL_FIELDS) { if (k in row) live[k] = row[k]; else delete live[k]; }
    });
    // [alpha.120 ข้อ 6] เขียน frontmatter ผ่านทางเดียวกับกล่องคุณสมบัติ (writeSceneMeta)
    // เดิมแผงเขียนเองแค่ 5 ฟิลด์ → เรื่องย่อ/ป้ายเล่าเรื่อง/โน้ตอนาคต ไม่เคยลงไฟล์จริงเลย
    try {
      const props = {};
      for (const k of SCENE_HEAVY_KEYS) props[k] = row[k];
      // writeSceneMeta กลืน error แล้วคืน false — ถ้าไม่เช็คค่าคืน ความล้มเหลวจะเงียบสนิท
      if (!(await writeSceneMeta(file0, props))) log('warn', tt('ui.props.writeMetaFail'), { file: file0 });
      // ⚠ เขียน frontmatter "ลับหลัง" แท็บที่เปิดไฟล์เดียวกันค้างอยู่ = ระเบิดเวลา:
      // แท็บถือ `meta` ชุดเก่าไว้ พอบันทึกครั้งถัดไป (หรือบันทึกอัตโนมัติ) มันจะเขียนทับ
      // คุณสมบัติที่เพิ่งตั้งไปทั้งหมด → ซิงก์ให้แท็บรู้ค่าใหม่ทันที
      await syncOpenTabMeta(file0);          // [alpha.161 · P2] ตัวกลางเดียวกับทุกทาง (กฎ alpha.156)
    } catch (e) { log('warn', tt('ui.props.writeMetaFail'), e); }
    statusLine.innerHTML = iconHtml('check', 14) + tt('ui.common.saveDone');
    // สี/สถานะ/แท็ก/หมุด มีผลกับต้นไม้ — วาดใหม่เฉพาะตอนจำเป็น (ไม่ใช่ทุกตัวอักษรที่พิมพ์)
    if (rebuildTree) await buildTree();
  };

  let saveJob = null;
  const scheduleSave = () => {
    statusLine.textContent = tt('ui.app.edit');
    clearTimeout(saveJob);
    saveJob = setTimeout(() => commit(true).catch(() => {}), 600);
  };
  // ---- [alpha.60r3 ข้อ 2] ปุ่ม ✨ ให้ AI เขียนให้ (ต้องมีทั้งกล่องและแผง — บทเรียน 50) ----
  // เติมค่าแล้วยิง event 'input' → autosave ของแผงเก็บให้เองโดยไม่ต้องต่อสายพิเศษ
  {
    const aiCtx = async () => {
      let mdBody = '';
      try { mdBody = parseMdFile(await kapi.readFile(file0)).body || ''; } catch {}
      return { body: mdBody, title: row.title || '' };
    };
    for (const [inp, key] of [[iSyn, 'synopsis'], [iPov, 'pov'],
                              [iEmotion, 'emotion'], [iConflict, 'conflict']]) {
      attachAiFieldButton(rowOf.get(inp), inp, key, aiCtx, () => scheduleSave());
    }
  }
  // [alpha.141] `iStartPage` ไม่เคยอยู่ในสองรายการนี้เลย — พิมพ์เลขหน้าเริ่มต้นในแผงแล้ว
  // ต้องรอให้ช่องอื่นเสียโฟกัส/ปิดแผง ค่าถึงจะลงไฟล์ (ดูเหมือน "กรอกแล้วไม่บันทึก")
  for (const i of [iSyn, iStoryDate, iStartPage, iPov, iEmotion, iConflict, iTags, iNote, iFuture]) {
    i.addEventListener('input', scheduleSave);
    i.addEventListener('blur', () => { clearTimeout(saveJob); commit(true).catch(() => {}); });
  }
  for (const s of [iStatus, iColor, iFlag, iFb, iFf, iFlow]) {
    s.addEventListener('change', () => { clearTimeout(saveJob); commit(true).catch(() => {}); });
  }
  // เลขหน้าเริ่มต้น/ธงไล่เลขต่อเนื่อง มีผลกับหน้ากระดาษของแท็บที่เปิดไฟล์นี้อยู่ → ซิงก์ทันที
  for (const s of [iStartPage, iFlow]) {
    s.addEventListener('change', () => {
      const live = state.tabs.get(file0);
      if (!live) return;
      live.startPage = explicitStartPage(row);            // [alpha.159 · H7] ห้าม `|| 1`
      live.pageFlow = row.pageFlow === 'continue' ? 'continue' : '';
      updatePageNumberHint(); refreshSpView();
    });
  }
  // สลับไปฉากอื่น/ปิดแผงกลางคัน → เขียนที่ค้างอยู่ให้จบก่อน
  propsFlush_C.fn = () => { clearTimeout(saveJob); return commit(true); };
  backScroll();                      // เนื้อครบแล้วค่อยคืนตำแหน่งเลื่อน (ก่อนหน้านี้ยังสูงไม่พอ)
}

// ตัวเขียนค้างของแผงคุณสมบัติ (เรียกก่อนวาดแผงใหม่ กันค่าที่เพิ่งพิมพ์หาย)
const propsFlush_C = { fn: null };

// ---------------- รวมข้อความทั้งฉบับร่าง (ใช้ตอนส่งออก) ----------------
// กติกา: แถวที่เป็นโน้ต (type: memo) จะ "ไม่" ถูกรวม — เขียนโน้ตคาไว้ในบทได้โดยไม่ปนต้นฉบับ
// อ่านฉบับร่างทั้งชุดจากดิสก์ → โครงสร้างกลาง (ใช้ทั้งส่งออกแบบเดิมและเวิร์กโฟลว์)
// ชนิด memo ยังคงอยู่ในโมเดล — ให้ขั้นตอน "ตัดโน้ต" เป็นคนคัดออก (ค่าเริ่มต้นเปิดไว้ทุกพรีเซ็ต)
/** [97] ข้อความหน้ารายชื่อตัวละครของ "เล่ม" ที่ฉบับร่างนี้อยู่ (ว่าง = ปิดสวิตช์ใส่ตอนส่งออก) */
/**
 * [alpha.81r2] `file://` ของรูปปกเล่มที่ฉบับร่างนี้อยู่ (จาก "จัดการเล่ม" → section.json → cover)
 * ผู้ใช้สั่งว่าหน้าปกของ **นิยาย** ต้องใช้รูปนี้ (บทภาพยนตร์ใช้หน้าปกของบทตามเดิม)
 * @returns {Promise<string>} '' = เล่มนี้ยังไม่ได้ตั้งรูปปก
 */
export async function sectionCoverUrl(dPath) {
  try {
    const secPath = String(dPath || '').replace(/[\\/]Draft[\\/][^\\/]+[\\/]?$/, '');
    if (!secPath || secPath === String(dPath)) return '';
    const sf = await kapi.join(secPath, 'section.json');
    if (!(await kapi.exists(sf))) return '';
    const rel = (await kapi.readJson(sf)).cover;
    if (!rel) return '';
    const abs = await kapi.resolve(secPath, rel);
    return (await kapi.exists(abs)) ? kapi.toFileURL(abs) : '';
  } catch (e) { log('warn', tt('ui.app.coverBookReadNot'), e); return ''; }
}

export async function rosterTextForDraft(dPath) {
  try {
    const secPath = String(dPath || '').replace(/[\\/]Draft[\\/][^\\/]+[\\/]?$/, '');
    if (!secPath || secPath === String(dPath)) return '';
    return await rosterTextFor(secPath);
  } catch { return ''; }
}

/**
 * [alpha.132 · X-1] เขียนเนื้อฉากใหม่โดยยัดคอมเมนต์ align กลับเข้าไปตามแผนที่ใน frontmatter
 * (ใช้ตัวอ่าน/ตัวเขียนตัวเดียวกับที่ตัวแก้ไขใช้ — จึงได้ผลตรงกับที่เห็นบนจอเสมอ)
 */
function dumpAlignComments(body, map) {
  return docToMd(mdToDoc(String(body || ''), map), { alignComments: true });
}

export async function buildDraftModel(dPath, title) {
  // [alpha.121] ชื่อเล่ม + สถิติรวมทั้งโปรเจกต์ — ให้โค้ดสั้น [book]/[totalwords]/[progress] ฯลฯ
  // ใช้ได้จริงตอนส่งออกด้วย ไม่ใช่แค่ตอนแก้สด (liveShortcodeContext) เท่านั้น
  let book = '';
  try {
    const secPath = String(dPath || '').replace(/[\\/]Draft[\\/][^\\/]+[\\/]?$/, '');
    const sf = await kapi.join(secPath, 'section.json');
    if (await kapi.exists(sf)) book = (await kapi.readJson(sf)).title || '';
  } catch {}
  const model = { title: title || state.title, author: (state.meta && state.meta.author) || '',
                  book, language: state.settings.language || DEFAULT_SETTINGS.language || '',
                  appVersion: APP_VERSION, stats: await computeProjectStats(),
                  roster: await rosterTextForDraft(dPath),
                  chapters: [] };
  const chapters = ((await kapi.readJson(await kapi.join(dPath, 'draft.json'))).chapters || [])
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const scAll = (await kapi.readJson(await kapi.join(dPath, 'scenes.json'))).chapters || {};
  for (const ch of chapters) {
    const c = { title: ch.title || '', guid: ch.guid,
                status: ch.status || '', act: ch.act || '', date: ch.date || '',
                isFavorite: !!ch.isFavorite, scenes: [] };
    for (const sc of (scAll[ch.guid] || []).sort((a, b) => (a.order || 0) - (b.order || 0))) {
      const file = await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName);
      let body = '', meta = {};
      try { ({ meta, body } = parseMdFile(await kapi.readFile(file))); } catch { continue; }
      // == [alpha.132 . X-1] ** การจัดหน้าต้องติดไปกับเนื้อฉากตอนส่งออก ==
      //
      // แผนที่ align อยู่ใน **frontmatter** (`meta.align`) ตั้งแต่ alpha.58r ที่ตั้งใจให้ .md สะอาด
      // แต่สายส่งออกหยิบไปแค่ `body` -> เอกสารที่จัดกึ่งกลางไว้ ออกมาเป็นชิดซ้ายทั้งเล่ม
      // ที่นี่จึงยัด align กลับเป็นคอมเมนต์ `<!--align:x-->` ซึ่ง `mdToHtmlBody` อ่านได้
      // (ปลายทางที่ไม่ใช่ HTML มีตัวกวาดคอมเมนต์ทิ้งที่ท้าย runWorkflow อยู่แล้ว)
      //
      // ทำเฉพาะฉากที่ "มี align จริง" - ฉากธรรมดาไม่ถูกแปลงผ่าน doc เลยแม้แต่ฉากเดียว
      // จึงไม่มีทางที่การประกอบโมเดลจะไปเปลี่ยนรูปข้อความของงานที่ไม่ได้จัดหน้า
      if (meta && meta.align) {
        try {
          const map = alignFromString(meta.align);
          if (map && Object.keys(map).length) {
            body = dumpAlignComments(body, map);
          }
        } catch (e) { log('warn', tt('ui.app.exportAlignFail'), e); }
      }
      const isMemo = sc.type === 'memo' || (meta && meta.type === 'memo');
      c.scenes.push({ title: sc.title || '', file, body: (body || '').trim(),
                      synopsis: sc.synopsis || (meta && meta.synopsis) || '',
                      status: sc.status || (meta && meta.status) || '',
                      // คุณสมบัติหนักอยู่ในทั้ง frontmatter และ scenes.json — frontmatter ชนะ
                      // (แหล่งความจริงเดียวกับที่ readSceneMeta ใช้ — ดู scene-meta.js)
                      pov: (meta && meta.pov) || sc.pov || '',
                      emotion: (meta && meta.emotion) || sc.emotion || '',
                      conflict: (meta && meta.conflict) || sc.conflict || '',
                      note: (meta && meta.note) || sc.note || '',
                      futureNote: (meta && meta.futureNote) || sc.futureNote || '',
                      storyDate: (meta && meta.storyDate) || sc.storyDate || '',
                      tags: (meta && meta.tags) || sc.tags || [],
                      color: sc.color || '', flag: !!sc.flag, locked: !!sc.locked,
                      // [alpha.81 ข้อ 8] ปลายทาง PDF ต้องรู้ว่านี่ "บทหนัง" หรือ "นิยาย"
                      // — คนละตัวสร้างกันคนละใบ (pdf-lib vs HTML→PDF) ถ้าเดาผิดได้ไฟล์ที่ใช้ไม่ได้
                      format: (meta && meta.format) === 'screenplay' ? 'screenplay' : 'prose',
                      type: isMemo ? 'memo' : 'scene', words: countWords(body || '') });
    }
    model.chapters.push(c);
  }
  return model;
}

// ส่งออกแบบเดิม (เมนู "ส่งออกฉบับร่างรวมเป็น .md") = เวิร์กโฟลว์ "ต้นฉบับ" แบบไม่มีตัวคั่น
async function compileDraftText(dPath, title) {
  const model = await buildDraftModel(dPath, title);
  const out = ['# ' + model.title, ''];
  if (String(model.roster || '').trim()) out.push(model.roster.trim(), '');   // [97] หน้ารายชื่อตัวละคร
  for (const ch of model.chapters) {
    out.push('## ' + ch.title, '');
    for (const sc of ch.scenes) { if (sc.type === 'memo') continue; out.push(sc.body, ''); }
  }
  return out.join('\n');
}

// รายชื่อฉบับร่างทั้งหมดในโปรเจกต์ (เซกชัน / ร่าง)
export async function listDrafts() {
  const drafts = [];
  for (const secName of await kapi.listDirs(state.root)) {
    const secPath = await kapi.join(state.root, secName);
    if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
    const draftRoot = await kapi.join(secPath, 'Draft');
    if (!(await kapi.exists(draftRoot))) continue;
    for (const dname of await kapi.listDirs(draftRoot))
      drafts.push({ label: `${secName} / ${dname}`, secName,
                    dPath: await kapi.join(draftRoot, dname) });
  }
  return drafts;
}

// ---------------- เล่ม (sections) — ตัวช่วยกลาง ----------------
export const SECTION_STATUSES = [
  ['outline', tt('ui.common.outlineStory'), '#8a8f98'], ['drafting', tt('ui.common.busyWrite'), '#5f9fd9'],
  ['revising', tt('ui.common.busyEdit'), '#d9b757'], ['done', tt('ui.common.writeEnd'), '#6fae6f'],
  ['published', tt('ui.common.printDone'), '#a97fd0'],
];
// อ่านทุกเล่ม (เรียงตาม order) พร้อม meta ที่จำเป็น
// นับบท/ฉาก/คำของทั้งเล่ม (รวมทุกฉบับร่าง)

// ---------------- เวิร์กโฟลว์ส่งออก (compile) ----------------
// เวิร์กโฟลว์ของผู้ใช้เก็บใน project.khn.json → compileWorkflows
export function userWorkflows() {
  if (!state.meta) return [];
  if (!Array.isArray(state.meta.compileWorkflows)) state.meta.compileWorkflows = [];
  return state.meta.compileWorkflows;
}
export function allWorkflows() { return [...PRESETS, ...userWorkflows()]; }

/** [67][68] ผลลัพธ์เวิร์กโฟลว์ที่เลือกนามสกุล .fdx/.rtf → อ่านเป็นบทแล้วแปลงต่อ */
export function finalizeCompiled(r) {
  if (!r) return '';
  const tp = projectTitlePages();
  if (r.ext === 'fdx') return generateFdx(parseScript(r.text), scriptMeta(), { titlePages: tp });
  if (r.ext === 'rtf') return generateRtf(parseScript(r.text), scriptMeta(), spFormat(),
                                          { titlePages: tp, fontPt: num((state.settings || {}).spFontPt, 12) });
  return r.text;
}

export async function openCompileDialog() {
  if (!state.root) return;
  const drafts = await listDrafts();
  if (!drafts.length) { setStatus(tt('ui.app.notHasDraftExport')); return; }

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-compile');
  box.append(el('div', 'k-dlg-title', tt('ui.app.exportWorkFlow')));

  const top = el('div', 'cmp-top');
  const selDraft = el('select', 'k-dlg-select');
  for (const d of drafts) { const o = el('option', null, d.label); o.value = d.dPath; selDraft.append(o); }
  top.append(el('span', null, tt('ui.app.draft')), selDraft);
  box.append(top);

  const body = el('div', 'cmp-body');
  const left = el('div', 'cmp-left');
  const right = el('div', 'cmp-right');
  body.append(left, right); box.append(body);

  let curId = (userWorkflows()[0] || PRESETS[0]).id;
  const cur = () => allWorkflows().find((w) => w.id === curId) || PRESETS[0];

  const renderLeft = () => {
    left.innerHTML = '';
    left.append(el('div', 'cmp-sub', tt('ui.app.reset')));
    const row = (w) => {
      const d = el('div', 'cmp-wf' + (w.id === curId ? ' on' : ''), w.name);
      d.dataset.wf = w.id;
      d.onclick = () => { curId = w.id; renderLeft(); renderRight(); };
      left.append(d);
    };
    PRESETS.forEach(row);
    left.append(el('div', 'cmp-sub', tt('ui.app.mine')));
    const mine = userWorkflows();
    if (!mine.length) left.append(el('div', 'cmp-empty', tt('ui.app.notHasPressDup')));
    mine.forEach(row);
    const bAdd = el('button', 'cmp-mini', tt('ui.app.new'));
    bAdd.onclick = async () => {
      const n = await ask(tt('ui.app.nameWorkFlowNew'), { value: tt('ui.app.workFlowMine') });
      if (!n) return;
      const w = newWorkflow(n); userWorkflows().push(w); await saveProjectMeta();
      curId = w.id; renderLeft(); renderRight();
    };
    left.append(bAdd);
  };

  const renderRight = () => {
    const w = cur();
    right.innerHTML = '';
    const head = el('div', 'cmp-head');
    head.append(el('div', 'cmp-name', w.name + (w.builtIn ? tt('ui.app.resetEditCant') : '')));
    const bCopy = el('button', 'cmp-mini', tt('ui.common.dup'));
    bCopy.onclick = async () => {
      const c = cloneWorkflow(w); userWorkflows().push(c); await saveProjectMeta();
      curId = c.id; renderLeft(); renderRight(); setStatus(tt('ui.app.dupWorkFlowDone'));
    };
    head.append(bCopy);
    if (!w.builtIn) {
      const bDel = el('button', 'cmp-mini k-danger', tt('ui.common.del2'));
      bDel.onclick = async () => {
        if (!(await confirmBox(ttf('ui.app.delWorkFlow', w.name), tt('ui.common.del')))) return;
        const arr = userWorkflows(); arr.splice(arr.indexOf(w), 1); await saveProjectMeta();
        curId = PRESETS[0].id; renderLeft(); renderRight();
      };
      head.append(bDel);
    }
    right.append(head);

    const extRow = el('div', 'cmp-ext');
    extRow.append(el('span', null, tt('ui.app.file')));
    const selExt = el('select', 'k-dlg-select'); selExt.id = 'cmp-ext';
    // alpha.57 — .fdx/.rtf: เอาข้อความที่เวิร์กโฟลว์ประกอบเสร็จมาอ่านเป็นบทแล้วแปลงต่อ
    // [alpha.124 ข้อ 28] เติม .pdf — พรีเซ็ต `screenplay-pdf` ตั้ง ext:'pdf' มาตั้งแต่ alpha.59
    // และ bGo ก็มีสายสร้าง PDF รออยู่แล้ว แต่ตัวเลือกนี้ไม่เคยมีให้เลือก → เวิร์กโฟลว์ที่ผู้ใช้
    // สร้างเองไม่มีทางตั้งปลายทางเป็น PDF ได้ (ได้เฉพาะพรีเซ็ตติดตั้งมาที่แก้ไม่ได้)
    for (const e of ['md', 'txt', 'html', 'fdx', 'rtf', 'pdf']) { const o = el('option', null, '.' + e); o.value = e; selExt.append(o); }
    selExt.value = w.ext || 'md';
    selExt.disabled = !!w.builtIn;
    selExt.onchange = async () => { w.ext = selExt.value; await saveProjectMeta(); };
    extRow.append(selExt); right.append(extRow);

    const list = el('div', 'cmp-steps'); list.id = 'cmp-steps';
    const STAGE_TH = { model: tt('ui.common.body'), render: tt('ui.app.msg5'), text: tt('ui.app.textLast') };
    (w.steps || []).forEach((st, i) => {
      const d = stepDef(st.key); if (!d) return;
      const rowEl = el('div', 'cmp-step' + (st.on === false ? ' off' : ''));
      rowEl.dataset.step = st.key;
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = st.on !== false;
      cb.disabled = !!w.builtIn;
      cb.onchange = async () => { st.on = cb.checked; await saveProjectMeta(); renderRight(); };
      const lbl = el('span', 'cmp-step-label', d.label);
      const badge = el('span', 'cmp-stage', STAGE_TH[d.stage]);
      rowEl.append(cb, lbl, badge);
      if (!w.builtIn) {
        const up = el('button', 'cmp-mini', gi('triangle-up')); up.title = tt('ui.common.scroll');
        up.onclick = async () => { if (i > 0) { const a = w.steps; [a[i - 1], a[i]] = [a[i], a[i - 1]];
                                                await saveProjectMeta(); renderRight(); } };
        const dn = el('button', 'cmp-mini', gi('triangle-down')); dn.title = tt('ui.app.scroll');
        dn.onclick = async () => { const a = w.steps; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]];
                                                await saveProjectMeta(); renderRight(); } };
        rowEl.append(up, dn);
      }
      list.append(rowEl);
      for (const f of d.fields || []) {
        const fr = el('div', 'cmp-field');
        fr.append(el('label', null, f.label));
        // [alpha.59 · 88] ช่องแบบสวิตช์ — ก่อนหน้านี้รองรับแค่ text/code จึงเก็บ boolean ไม่ได้
        if (f.type === 'check') {
          const cb2 = el('input'); cb2.type = 'checkbox';
          cb2.checked = (st.opts || {})[f.k] === true;
          cb2.disabled = !!w.builtIn;
          cb2.onchange = async () => { st.opts = st.opts || {};
                                       st.opts[f.k] = cb2.checked; await saveProjectMeta(); };
          fr.append(cb2); list.append(fr); continue;
        }
        const inp = el(f.type === 'code' ? 'textarea' : 'input', 'k-dlg-input');
        inp.value = (st.opts || {})[f.k] ?? '';
        inp.disabled = !!w.builtIn;
        inp.onchange = async () => { st.opts = st.opts || {}; st.opts[f.k] = inp.value; await saveProjectMeta(); };
        fr.append(inp); list.append(fr);
      }
    });
    right.append(list);
  };

  const prev = el('pre', 'cmp-preview'); prev.id = 'cmp-preview';
  box.append(prev);

  const doRun = async () => {
    const model = await buildDraftModel(selDraft.value);
    const varCtx = { title: model.title, author: model.author };
    if (cur().steps.some(s => s.on !== false && s.key === 'resolve-vars')) {
      const { buildVarContext } = await import('./template-vars.js');
      Object.assign(varCtx, await buildVarContext(state.root, kapi));
    }
    // [alpha.58r บั๊ก 19] ส่งรูปแบบนิยาย + ขนาดกระดาษไปด้วย → HTML ที่ได้ตรงกับที่เห็นบนจอ
    const spf = spFormat();
    return runWorkflow(model, cur(), { varCtx, spFormat: spf,
                                       proseFormat: proseFormat(),
                                       paper: spf.paper, margins: spf.margins });
  };
  const btns = el('div', 'k-dlg-btns');
  const bPrev = el('button', null, tt('ui.app.viewSample'));
  bPrev.onclick = async () => {
    const r = await withBusy(tt('ui.app.busyResultWorkFlow'), doRun);
    prev.textContent = r.text.slice(0, 4000) + (r.text.length > 4000 ? '\n…' : '');
    if (r.warnings.length) setStatus(r.warnings.join(' · '));
  };
  const bGo = el('button', 'k-ok', tt('ui.common.export2'));
  bGo.onclick = async () => {
    // [alpha.124 ข้อ 28] ตรวจบทก่อนส่งออก — ทางนี้เป็นทางเดียวที่ข้ามการตรวจมาตลอด
    // (ศูนย์รวมการส่งออก · PDF · .fdx/.rtf เรียก checkBeforeExport กันหมดแล้ว)
    // ผลคือส่งออกด้วยเวิร์กโฟลว์แล้วได้บทที่ยังมีข้อผิดพลาดค้างอยู่โดยไม่มีอะไรเตือน
    if (!(await checkBeforeExport())) return;
    // [alpha.62 บั๊ก 10] ประมวลผลก่อน → เคลียร์ตัวบอกสถานะ → ค่อยเปิดกล่องบันทึก
    //   (บทเรียนเดียวกับบั๊ก 1: อย่าให้มีอะไรหมุนค้างตอนรอผู้ใช้ตอบกล่อง)
    const r = await withBusy(tt('ui.app.busyResultWorkFlow'), doRun);
    const dest = r.ext === 'pdf'
      ? await kapi.savePdfDialog(safeName(state.title) + '.pdf')
      : await kapi.saveAsDialog(safeName(state.title) + '.' + r.ext, r.ext);
    if (!dest) return;
    // [alpha.59 · 69] ปลายทาง .pdf → ตัวสร้าง PDF ในโปรแกรม (ไบนารี ต้องผ่าน writeBytes — กฎ 10)
    if (r.ext === 'pdf') {
      const made = await withBusy(tt('ui.app.busyNewFilePDF'), () => writeCompiledPdf(dest, r, state.title));
      ov.remove(); setStatus(ttf('ui.app.exportPDFDonePage', made.pageCount) + dest);
      return;
    }
    await withBusy(tt('ui.app.busyWriteFile'), () => kapi.writeFile(dest, finalizeCompiled(r)));
    ov.remove(); setStatus(tt('ui.common.exportDone') + dest);
  };
  const bClose = el('button', 'k-cancel', tt('ui.common.close'));
  bClose.onclick = () => ov.remove();
  btns.append(bClose, bPrev, bGo); box.append(btns);

  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  renderLeft(); renderRight();
  return { ov, run: doRun, select: (id) => { curId = id; renderLeft(); renderRight(); } };
}

// ---------------- ส่งออกฉบับร่างรวม ----------------
async function exportDraft() {
  const drafts = await listDrafts();
  if (!drafts.length) return;
  const pick = drafts.length === 1 ? drafts[0].label
    : await pickFromList(tt('ui.app.exportDraft'), drafts.map((d) => d.label));
  if (!pick) return;
  const { secName, dPath } = drafts.find((d) => d.label === pick);
  const text = await withBusy(tt('ui.app.busyMergeDraft'), () => compileDraftText(dPath));
  const dest = await kapi.saveAsDialog(safeName(state.title) + '.md');
  if (!dest) return;
  await withBusy(tt('ui.app.busyWriteFile'), () => kapi.writeFile(dest, text));
  setStatus(tt('ui.app.exportMergeDone') + dest);
  return dest;
}

// ═════════ alpha.57 · ส่งออกบทภาพยนตร์ — FDX (67) · RTF (68) · PDF ลายน้ำ (70) ═════════
/** ข้อมูลผลงานสำหรับหน้าปกไฟล์ที่ส่งออก (ข้อ 98) */
export function scriptMeta(title) {
  const m = state.meta || {};
  const contact = [m.contact, m.phone, m.authorEmail,
                   m.agentName && (tt('ui.app.itemReplace') + m.agentName), m.agentAddress,
                   m.agentPhone, m.agentEmail].filter(Boolean).join('\n');
  return {
    title: title || state.title || '',
    author: m.screenplayBy || m.author || '',
    basedOn: m.basedOn || '',
    contact, copyright: m.copyright || '',
  };
}

/**
 * เอา "บทที่จะส่งออก" — ฉากที่เปิดอยู่ก่อน ถ้าไม่ใช่บทหนังให้เลือกฉบับร่าง
 *
 * [alpha.58r บั๊ก 6] คืน `blocks` จาก **เอกสารจริง** (blocksFromDoc) ไม่ใช่ parseScript(md)
 * เหตุ: การแปลง doc → markdown → parseScript ไม่ใช่ round-trip ที่ปิดวงสมบูรณ์ —
 *       `classify()` สร้าง "บทพูดกำพร้า" ไม่ได้ (บทเรียนข้อ 43) ข้อความบางบล็อกจึงกลายเป็น
 *       action ตอนส่งออก ทั้งที่บนจอเป็น dialogue · ฟีเจอร์อื่น (จัดหน้า/ตรวจบท/รายงาน)
 *       ใช้ blocksFromDoc ถูกต้องมานานแล้ว มีแต่ทางส่งออกที่ยังเดินทางเก่า
 * @returns {Promise<{md:string, blocks:Array, title:string}|null>}
 */
export async function currentScriptSource() {
  const t2 = state.active;
  if (t2 && t2.sp) {
    return { md: t2.sp.getMarkdown(),
             blocks: blocksFromDoc(revisedDoc(t2) || t2.sp.view.state.doc),   // [alpha.164] ส่งออก = ฉบับแก้ไข
             title: t2.title || state.title };
  }
  const drafts = await listDrafts();
  if (!drafts.length) { setStatus(tt('ui.app.notHasChapterExport')); return null; }
  const pick = drafts.length === 1 ? drafts[0].label
    : await pickFromList(tt('ui.app.exportChapterDraft'), drafts.map((d) => d.label));
  if (!pick) return null;
  const d = drafts.find((x) => x.label === pick);
  const md = await compileDraftText(d.dPath);
  return { md, blocks: parseScript(md), title: state.title };
}

/** [67][68] ส่งออกบทเป็น Final Draft (.fdx) หรือ Rich Text (.rtf) */
export async function exportScript(kind) {
  if (!(await checkBeforeExport())) return null;
  const src = await currentScriptSource();
  if (!src) return null;
  const blocks = src.blocks || parseScript(src.md);
  const meta = scriptMeta(src.title);
  // [alpha.60r1] FDX/RTF ต้องใช้ "หน้าปกที่ผู้ใช้แต่งเอง" (ข้อ 90) เหมือน PDF
  // ไม่ใช่สร้างหน้าปกจาก meta เองคนละแบบกับที่เห็นบนจอ
  const titlePages = projectTitlePages();
  const fontPt = num((state.settings || {}).spFontPt, 12);
  const text = kind === 'fdx'
    ? generateFdx(blocks, meta, { titlePages, startScene: 1 })
    : generateRtf(blocks, meta, spFormat(), { titlePages, fontPt });
  const dest = await kapi.saveAsDialog(safeName(src.title) + '.' + kind, kind);
  if (!dest) return null;
  await kapi.writeFile(dest, text);
  log('info', tt('ui.app.exportChapter') + kind, dest);
  setStatus(ttf('ui.app.exportDone', kind, dest));
  return dest;
}

/** URL ของฟอนต์ที่ฝังมากับโปรแกรม — ให้ PDF ที่สร้างนอกหน้าต่างใช้ฟอนต์เดียวกัน */
export async function embeddedFontUrls() {
  try {
    const dir = await kapi.join(await kapi.appDir(), 'renderer', 'assets', 'fonts');
    const one = async (f) => (await kapi.exists(await kapi.join(dir, f)))
      ? kapi.toFileURL(await kapi.join(dir, f)) : '';
    return {
      regular: await one('CourierPrime-Regular.ttf'), bold: await one('CourierPrime-Bold.ttf'),
      italic: await one('CourierPrime-Italic.ttf'), boldItalic: await one('CourierPrime-BoldItalic.ttf'),
    };
  } catch { return null; }
}

/** [70] กล่องสร้าง PDF ลายน้ำรายคน */
export async function watermarkDialog() {
  const src = await currentScriptSource();
  if (!src) return null;
  const fmt = spFormat();
  const pages = pagesOf(src.blocks, fmt);
  const saved = (state.meta && state.meta.watermark) || {};

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wm-dlg');
  box.append(el('div', 'k-dlg-title', tt('ui.app.exportPDFWatermarkPerson')));
  box.append(el('div', 'dim', ttf('ui.app.chapterPageFilePerson', src.title, pages.count)));

  const mk = (label, node) => { const r = el('div', 'k-row'); r.append(el('label', null, label), node); return r; };
  const ta = el('textarea', 'k-dlg-input k-wm-list');
  ta.rows = 6;
  ta.placeholder = tt('ui.app.oneLineOnePerson');
  ta.value = saved.recipients || '';
  box.append(mk(tt('ui.app.list'), ta));

  const tpl = el('input', 'k-dlg-input'); tpl.value = saved.template || tt('ui.app.nameDate');
  box.append(mk(tt('ui.app.styleWatermark'), tpl));
  box.append(el('div', 'dim', tt('ui.app.useNameDateStory')));

  const pre = el('input', 'k-dlg-input'); pre.value = saved.prefix || safeName(src.title);
  box.append(mk(tt('ui.app.wordPageNameFile'), pre));

  const size = el('input', 'k-dlg-input'); size.type = 'number'; size.min = '10'; size.max = '200';
  size.value = String(saved.fontSize || DEFAULT_WM.fontSize);
  box.append(mk(tt('ui.app.sizeWatermarkPx'), size));
  const ang = el('input', 'k-dlg-input'); ang.type = 'number'; ang.min = '-90'; ang.max = '90';
  ang.value = String(saved.angle ?? DEFAULT_WM.angle);
  box.append(mk(tt('ui.app.corner'), ang));

  const dirRow = el('div', 'k-row');
  const dirLbl = el('span', 'dim', saved.outDir || tt('ui.app.cantPickFolder'));
  let outDir = saved.outDir || '';
  const bDir = el('button', 'cmp-mini', tt('ui.app.pickFolderTo'));
  bDir.onclick = async () => {
    const p = await kapi.openDirDialog();
    if (p) { outDir = p; dirLbl.textContent = p; }
  };
  dirRow.append(bDir, dirLbl);
  box.append(dirRow);

  const prog = el('div', 'dim k-wm-prog');
  box.append(prog);

  const btns = el('div', 'k-dlg-btns');
  const bCancel = el('button', 'k-cancel', tt('ui.common.close')); bCancel.onclick = () => ov.remove();
  const bGo = el('button', 'k-ok', tt('ui.app.newPDF'));
  bGo.onclick = async () => {
    const rs = parseRecipients(ta.value);
    if (!rs.length) { prog.textContent = tt('ui.app.notHasList'); return; }
    if (!outDir) { prog.textContent = tt('ui.app.pickFolderToBefore'); return; }
    bGo.disabled = true;
    const wmOptions = { ...DEFAULT_WM, fontSize: num(size.value, DEFAULT_WM.fontSize),
                        angle: num(ang.value, 0) };
    try {
      // [alpha.60r1] ใช้ "ตัวสร้าง PDF ในโปรแกรม" ทางเดียวกับส่งออก PDF ปกติ
      // → ได้สารบัญ/หน้าปก/หัวกระดาษ/ฟอนต์ไทยสองวงศ์ (กฎ 19) เหมือนกันทุกไฟล์
      // ค่าลายน้ำของ export-watermark เป็น px/องศา ส่วน generatePdf คิดเป็น pt → แปลงที่นี่ที่เดียว
      const made = await generateWatermarkedPDFs(kapi, {
        pages, fmt, recipients: rs, outDir, prefix: pre.value,
        wmTemplate: tpl.value, wmOptions, fontUrls: await embeddedFontUrls(),
        title: src.title, date: localDay(),
        buildPdf: async (text) => (await buildScriptPdf({
          blocks: src.blocks, title: src.title, fmt,
          opts: { ...savedPdfOptions(), openPage: 0, watermark: text,
                  watermarkSize: wmOptions.fontSize * 0.75,     // px → pt
                  watermarkAngle: wmOptions.angle },
        })).bytes,
        onProgress: (i, n, name) => { prog.textContent = ttf('ui.app.busyNew', i, n, name); },
      });
      if (state.meta) {
        state.meta.watermark = { recipients: ta.value, template: tpl.value, prefix: pre.value,
                                 outDir, fontSize: wmOptions.fontSize, angle: wmOptions.angle };
        await saveProjectMeta();
      }
      prog.textContent = ttf('ui.app.doneDoneFile', made.length);
      setStatus(ttf('ui.app.newPDFWatermarkFile', made.length, outDir));
      log('info', tt('ui.app.pDFWatermark'), { count: made.length, outDir });
    } catch (e) {
      prog.textContent = tt('ui.common.error') + errText(e);
      log('error', tt('ui.app.newPDFWatermarkNot'), e);
    }
    bGo.disabled = false;
  };
  btns.append(bCancel, bGo); box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  return { ov, pages };
}

// ---------------- Plugins ([alpha.60r3 ข้อ 7] — เตรียมระบบปลั๊กอินให้ใช้งานได้จริง) ----------------
//
// ที่อยู่ปลั๊กอิน 2 แห่ง:
//   · `<โปรเจกต์>/Plugins/<ชื่อ>/`             — ติดมากับผลงาน (ก๊อปโปรเจกต์แล้วปลั๊กอินไปด้วย)
//   · `%APPDATA%/Killian2/Plugins/<ชื่อ>/`      — ของผู้ใช้ ใช้ได้ทุกโปรเจกต์
// ชื่อซ้ำกัน → ของโปรเจกต์ชนะ (ผู้เขียนผลงานคุมเวอร์ชันที่ผลงานต้องการได้)
//
// manifest (`plugin.json`) ขยายจาก `{name, entry}` เป็น 6 ช่อง:
//   { name, entry, version, author, description, minAppVersion }
//
// **การแยกความเสียหาย**: ปลั๊กอินที่ throw ตอนโหลดจะถูกจดลง `settings.plugins.disabled[<ชื่อ>]`
// แล้วข้ามในรอบถัดไป — เปิดโปรแกรมไม่ขึ้นเพราะปลั๊กอินตัวเดียวเป็นสิ่งที่ยอมไม่ได้
const plugins = { commands: [], loaded: [], failed: [], shortcuts: [], panels: [] };
export const pluginBus = new EventBus({ onError: (e, ev) => log('warn', 'plugin event ' + ev, e) });

/** เทียบเวอร์ชันแบบ semver อย่างง่าย — a >= b ? (ใช้กับ minAppVersion) */
export function versionAtLeast(a, b) {
  const num = (s) => String(s || '0').split('-')[0].split('.').map((x) => parseInt(x, 10) || 0);
  const A = num(a), B = num(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d > 0;
  }
  return true;
}

/** ค่าที่ปลั๊กอินเก็บเอง — `settings.plugins[<ชื่อ>]` (คนละก้อนกับ disabled) */
function pluginStore() {
  if (!state.settings.plugins || typeof state.settings.plugins !== 'object') state.settings.plugins = {};
  if (!state.settings.plugins.disabled || typeof state.settings.plugins.disabled !== 'object') {
    state.settings.plugins.disabled = {};
  }
  return state.settings.plugins;
}
export function pluginDisabled(name) { return !!pluginStore().disabled[name]; }
export function setPluginDisabled(name, on) {
  const st = pluginStore();
  if (on) st.disabled[name] = true; else delete st.disabled[name];
  saveProjectMetaSoon();
  return !!st.disabled[name];
}

/** สร้างวัตถุ `k2` ที่ปลั๊กอินหนึ่งตัวได้รับ (ผูกชื่อไว้ เพื่อแยก settings/สถานะรายตัว) */
function pluginApi(name) {
  return {
    // ---- ข้อมูลของตัวเอง ----
    pluginName: name,
    appVersion: APP_VERSION,
    projectRoot: () => state.root,

    // ---- คำสั่งบนแถบเครื่องมือ (ของเดิม) ----
    registerCommand: (label, fn) => { plugins.commands.push({ label, fn, plugin: name }); return true; },

    // ---- ตัวแก้ไข ----
    getMarkdown: () => state.active?.editor?.getMarkdown()
      ?? state.active?.sp?.getMarkdown() ?? '',
    insertText: (text) => {
      const v = state.active?.editor?.view || state.active?.sp?.view;
      if (!v) return false;
      v.dispatch(v.state.tr.insertText(String(text ?? '')));
      markDirty(state.active);
      return true;
    },
    /** PM EditorView ปัจจุบัน — ให้ปลั๊กอินอ่าน doc/selection หรือ dispatch เองได้ */
    getEditorView: () => state.active?.editor?.view || state.active?.sp?.view || null,

    // ---- แผง ----
    /** ลงทะเบียนแผงใหม่ (PanelManager) — เนื้อแผงวาดด้วย opts.render(host) */
    registerPanel: (id, opts = {}) => {
      const pid = 'plugin-' + name + '-' + String(id || 'panel');
      try {
        getPanelManager().registerPanel(pid, {
          title: opts.title || id || name, icon: opts.icon || 'extension',
          closable: opts.closable !== false, floatable: opts.floatable !== false,
          defaultSide: opts.defaultSide || 'right',
          render: (host) => { try { return opts.render && opts.render(host); } catch (e) { log('warn', 'plugin panel ' + pid, e); } },
        });
        plugins.panels.push(pid);
        return pid;
      } catch (e) { log('warn', tt('ui.app.registerPanelFail') + pid, e); return null; }
    },
    showPanel: (id) => showPanel('plugin-' + name + '-' + id),
    hidePanel: (id) => hidePanel('plugin-' + name + '-' + id),

    // ---- เหตุการณ์ (EventBus ก้อนเดียวใช้ร่วมกันทุกปลั๊กอิน) ----
    on: (event, handler) => pluginBus.on(String(event), handler),
    off: (event, handler) => pluginBus.off(String(event), handler),
    emit: (event, data) => pluginBus.emit(String(event), data),

    // ---- ไฟล์ (จำกัดอยู่ในขอบเขตโปรเจกต์) ----
    readFile: (rel) => pluginPath(rel).then((p) => (p ? kapi.readFile(p) : null)),
    writeFile: (rel, data) => pluginPath(rel).then((p) => (p ? kapi.writeFile(p, String(data ?? '')) : false)),
    listDirs: (rel) => pluginPath(rel || '.').then((p) => (p ? kapi.listDirs(p) : [])),
    listFiles: (rel, ext) => pluginPath(rel || '.').then((p) => (p ? kapi.listFiles(p, ext || '') : [])),

    // ---- คีย์ลัด (เพิ่มเข้าอาร์เรย์ SHORTCUTS ตอนรัน) ----
    registerShortcut: (id, code, ctrl, shift, fn) => {
      const ch = 'plugin:' + name + ':' + String(id);
      // ถอดของเดิมชื่อเดียวกันก่อน (โหลดซ้ำตอนเปลี่ยนโปรเจกต์จะได้ไม่ทับกันเป็นชั้น ๆ)
      for (let i = SHORTCUTS.length - 1; i >= 0; i--) if (SHORTCUTS[i][3] === ch) SHORTCUTS.splice(i, 1);
      SHORTCUTS.push([code, ctrl !== false, !!shift, ch]);
      plugins.shortcuts.push({ ch, fn });
      return ch;
    },

    // ---- ตั้งค่าของปลั๊กอิน (`settings.plugins[<ชื่อ>]`) ----
    getSettings: (key, def) => {
      const own = pluginStore()[name] || {};
      if (key === undefined) return { ...own };
      return own[key] === undefined ? def : own[key];
    },
    setSettings: (key, val) => {
      const st = pluginStore();
      if (typeof key === 'object' && key) st[name] = { ...(st[name] || {}), ...key };
      else st[name] = { ...(st[name] || {}), [key]: val };
      saveProjectMetaSoon();
      return true;
    },

    // ---- เมนู ----
    menuPopup: (items, x, y) => popupMenu(
      typeof x === 'number' ? x : 80, typeof y === 'number' ? y : 80,
      (items || []).map((it) => (it === '-' ? '-' : { ...it }))),
    addMenuItem: (label, fn) => { plugins.commands.push({ label, fn, plugin: name }); return true; },

    // ---- UI ทั่วไป ----
    setStatus, ask, confirmBox, alertBox: (m) => aboutBox(String(m)),
    fetch: (url, options) => kapi.httpFetch(url, options),
    log: (...a) => log('info', '[plugin ' + name + '] ' + a.map(String).join(' ')),
  };
}

/** path ในโปรเจกต์จาก path สัมพัทธ์ — กัน `..` หลุดออกนอกโฟลเดอร์ผลงาน */
async function pluginPath(rel) {
  if (!state.root) return null;
  const clean = String(rel || '').replace(/\\/g, '/').replace(/^[/]+/, '');
  if (clean.split('/').includes('..')) { log('warn', tt('ui.app.pluginPathMarginProject') + rel); return null; }
  return kapi.join(state.root, ...clean.split('/').filter(Boolean));
}

/** ข้อความสั้น ๆ ของกล่อง alert ที่ปลั๊กอินเรียก (window.alert ใช้ไม่ได้ใน Electron — บทเรียน 3) */
function aboutBox(msg) { setStatus(msg); return confirmBox(msg, tt('ui.app.plugin')); }

// ═══════════ [alpha.148] ★ ปลั๊กอินของโปรเจกต์ต้องได้รับอนุญาตก่อนรัน ═══════════
//
// เดิม: ทุก `<โปรเจกต์>/Plugins/*/main.js` ถูก `new Function()` ทันทีที่เปิดโปรเจกต์ ไม่ถามสักคำ
// = เปิดโปรเจกต์ที่คนอื่นส่งมา (zip · นำเข้า) แล้วโค้ดในนั้นได้ `kapi` ครบ อ่าน/เขียน/ลบไฟล์ใดก็ได้
//
// ตอนนี้: อ่านไฟล์ทั้งชุดก่อน → ลายนิ้วมือ (plugin-core.js) → ยังไม่อนุญาต = ไม่รัน แสดงเป็น "รออนุญาต"
// ในแผงปลั๊กอิน (ไม่เด้งกล่องถามตอนเปิดโปรเจกต์ — กล่องที่โผล่เองระหว่างโหลดถูกกดผ่านโดยไม่อ่านได้ง่าย)
// ปลั๊กอินของผู้ใช้ (userData/Plugins) ผู้ใช้ติดตั้งเองกับมือ → ไม่ต้องถาม
//
// ที่เก็บ: userData/sessions/plugin-trust.json — ของเครื่องนี้ ไม่ใช่ของโปรเจกต์ (ผู้ส่งแก้เองไม่ได้)
// และไม่ปนกับ settings.json ซึ่งกล่องตั้งค่าเขียนทับทั้งก้อน · รูปแบบ `{ "<root>": "<ลายนิ้วมือ>" }`
const PLUGIN_TRUST_KEY = 'plugin-trust';
async function readPluginTrust() {
  try { return (await kapi.sessionRead(PLUGIN_TRUST_KEY)) || {}; } catch { return {}; }
}
/** อ่านไฟล์ของปลั๊กอินทั้งชุด — โค้ดที่ถูกรันคือก้อนเดียวกับที่เอาไปทำลายนิ้วมือ (ไม่อ่านซ้ำ) */
async function readPluginSet(dir, names) {
  const set = new Map();
  for (const name of names) {
    const e = { folder: name, manifest: '', code: '', manifestErr: null, codeErr: null };
    try { e.manifest = await kapi.readFile(await kapi.join(dir, name, 'plugin.json')); }
    catch (err) { e.manifestErr = err; }
    let entry = 'main.js';
    try { entry = JSON.parse(e.manifest).entry || entry; } catch {}
    try { e.code = await kapi.readFile(await kapi.join(dir, name, entry)); }
    catch (err) { e.codeErr = err; }
    set.set(name, e);
  }
  return set;
}
async function projectPluginNames(root) {
  const dir = await kapi.join(root, 'Plugins');
  if (!(await kapi.exists(dir))) return { dir, names: [] };
  return { dir, names: (await kapi.listDirs(dir).catch(() => [])).filter((n) => n !== 'dictionaries') };
}
/** อนุญาตชุดปลั๊กอิน "ตามที่อยู่บนดิสก์ตอนนี้" ของโปรเจกต์ — ปุ่มในแผงปลั๊กอินเรียก */
export async function trustProjectPlugins(root = state.root) {
  if (!root) return false;
  const { dir, names } = await projectPluginNames(root);
  const fp = pluginFingerprint([...(await readPluginSet(dir, names)).values()]);
  const trust = await readPluginTrust();
  if (fp) trust[root] = fp; else delete trust[root];
  await kapi.sessionWrite(PLUGIN_TRUST_KEY, trust);
  logAction('plugin', 'trust project plugins', { root, count: names.length });
  return true;
}
/** ถอนการอนุญาต (เทสใช้เริ่มจากสภาพสะอาด) */
export async function untrustProjectPlugins(root = state.root) {
  const trust = await readPluginTrust();
  delete trust[root];
  await kapi.sessionWrite(PLUGIN_TRUST_KEY, trust);
  return true;
}

async function loadPlugins() {
  plugins.commands = []; plugins.loaded = []; plugins.failed = [];
  plugins.untrusted = 0;
  // ถอดคีย์ลัดของรอบก่อนออกก่อน (เปลี่ยนโปรเจกต์แล้วต้องไม่เหลือปุ่มลัดค้าง)
  for (const s of plugins.shortcuts) {
    for (let i = SHORTCUTS.length - 1; i >= 0; i--) if (SHORTCUTS[i][3] === s.ch) SHORTCUTS.splice(i, 1);
  }
  plugins.shortcuts = []; plugins.panels = [];

  // (dir, ที่มา) — ของผู้ใช้ก่อน แล้วให้ของโปรเจกต์ทับได้ด้วยชื่อเดียวกัน
  // [alpha.79] `origin` ต้องเป็น **ค่าคงที่** ไม่ใช่ข้อความที่แปลตามภาษา —
  // แผงปลั๊กอินเอาไปเทียบว่า "ของโปรเจกต์หรือของผู้ใช้" ถ้าเป็นข้อความแปล พอสลับภาษาก็เทียบไม่ตรงทันที
  const sources = [];
  try {
    const g = await kapi.globalPluginsDir?.();
    if (g && await kapi.exists(g)) sources.push([g, ORIGIN_USER]);
  } catch {}
  if (state.root) {
    const p = await kapi.join(state.root, 'Plugins');
    if (await kapi.exists(p)) sources.push([p, ORIGIN_PROJECT]);
  }
  if (!sources.length) { const b = $('#tb-plug'); if (b) b.style.display = 'none'; return plugins; }

  const seen = new Set();
  for (const [dir, origin] of sources) {
    let names = [];
    try { names = await kapi.listDirs(dir); } catch { continue; }
    names = names.filter((n) => n !== 'dictionaries');   // โฟลเดอร์พจนานุกรม ไม่ใช่ปลั๊กอิน
    // [alpha.148] ปลั๊กอินที่มากับโปรเจกต์: อ่านทั้งชุด → ยังไม่อนุญาต = จดเป็น "รออนุญาต" แล้ว **ไม่รัน**
    let pre = null;
    if (origin === ORIGIN_PROJECT && names.length) {
      pre = await readPluginSet(dir, names);
      if (!isPluginSetTrusted(await readPluginTrust(), state.root, pluginFingerprint([...pre.values()]))) {
        for (const name of names) {
          plugins.failed.push({ name, origin, folder: name, untrusted: true, error: tt('ui.plug.untrustedHint') });
        }
        plugins.untrusted += names.length;
        continue;
      }
    }
    for (const name of names) {
      // [alpha.79] `skipped` แยก "ผู้ใช้ปิดเอง" ออกจาก "โหลดแล้วพัง" —
      // ทั้งสองอย่างลงกอง failed เหมือนกัน แต่ต้องแสดงผลคนละแบบ
      // (ไม่งั้นปลั๊กอินที่ผู้ใช้กดปิดจะขึ้นป้าย "มีปัญหา" สีแดงทั้งที่ไม่มีอะไรพัง)
      if (pluginDisabled(name)) {
        plugins.failed.push({ name, origin, folder: name, skipped: true, error: tt('ui.app.close2') });
        continue;
      }
      try {
        const got = pre && pre.get(name);
        if (got && got.manifestErr) throw got.manifestErr;
        const manifest = got ? JSON.parse(got.manifest)
          : await kapi.readJson(await kapi.join(dir, name, 'plugin.json'));
        if (manifest.minAppVersion && !versionAtLeast(APP_VERSION, manifest.minAppVersion)) {
          plugins.failed.push({ name, origin, error: ttf('ui.app.mustUseKillianF', manifest.minAppVersion) });
          continue;
        }
        if (got && got.codeErr) throw got.codeErr;
        const code = got ? got.code
          : await kapi.readFile(await kapi.join(dir, name, manifest.entry || 'main.js'));
        new Function('k2', code)(pluginApi(name));
        // ชื่อซ้ำ = ของโปรเจกต์ (มาทีหลัง) ทับของผู้ใช้ — บันทึกไว้ตัวเดียว
        if (seen.has(name)) plugins.loaded = plugins.loaded.filter((x) => x.name !== name);
        seen.add(name);
        plugins.loaded.push({ name, origin, folder: name,
          version: manifest.version || '', author: manifest.author || '',
          description: manifest.description || '', minAppVersion: manifest.minAppVersion || '' });
      } catch (e) {
        plugins.failed.push({ name, origin, folder: name, error: e.message });
        // พังตอนโหลด = ปิดไว้ก่อน กันเปิดโปรแกรมไม่ขึ้นรอบหน้า (ผู้ใช้เปิดกลับได้จากกล่องจัดการ)
        setPluginDisabled(name, true);
        log('error', ttf('ui.app.plugin2F', name), e);
      }
    }
  }
  if (plugins.loaded.length) setStatus(ttf('ui.app.loadPluginItem', plugins.loaded.length)
    + (plugins.failed.length ? ttf('ui.app.msg', plugins.failed.length) : ''));
  if (plugins.untrusted) {
    setStatus(ttf('ui.plug.untrustedStatus', plugins.untrusted));
    log('warn', 'plugins: project plugins are not allowed to run yet', { root: state.root, count: plugins.untrusted });
  }
  const btn = $('#tb-plug');
  if (btn) btn.style.display = plugins.commands.length ? '' : 'none';
  return plugins;
}
/** รายชื่อปลั๊กอินที่โหลดสำเร็จ/ล้มเหลว (คอนโซลนักพัฒนา + เทสอ่าน) */
export function pluginList() { return { ...plugins, loaded: [...plugins.loaded], failed: [...plugins.failed] }; }
/**
 * [alpha.79] โหลดปลั๊กอินใหม่ทั้งชุด — แผงจัดการเรียกหลังเปิด/ปิด/สร้างปลั๊กอิน
 * `loadPlugins()` ถอดคีย์ลัดของรอบก่อนออกให้เองอยู่แล้ว จึงเรียกซ้ำได้ไม่ทับซ้อน
 */
export async function reloadPlugins() {
  const r = await loadPlugins();
  refreshToolbar();
  return r;
}

// ---------------- คลังรูปภาพ (แผง — [alpha.60r1 ข้อ 21]) ----------------
// เดิมเป็น "แท็บเอกสาร" (::gallery::) จึงไปแย่งแถบแท็บกับฉากที่กำลังเขียน และวางคู่กับ
// หน้ากระดาษไม่ได้เลย · ตอนนี้เป็นแผงเต็มตัวเหมือนแดชบอร์ด/Kanban → dock/float/แท็บร่วมได้
let galInst = null;
export function renderGalleryPanel() {
  const host = $('#gal-body');
  if (!host) return null;
  if (!state.root) { host.innerHTML = ''; host.append(el('div', 'dim', tt('ui.common.openProjectBefore'))); return null; }
  host.innerHTML = '';
  // [alpha.63] คลังรูปเป็นระบบอัลบั้มแล้ว — ตัวเชื่อมกับส่วนอื่นส่งเป็น callback
  // (gallery.js จึงไม่ต้อง import app.js กลับมา = ไม่มี import วน)
  galInst = new Gallery(host, state.root, {
    onChanged: () => { imgURLBase.clear(); buildTree(); },
    onInsert: (relPath, caption) => insertImageByName(relPath, caption),
    onOpenFile: (file) => openPathSmart(file),
    onOpenEntity: (name) => { const f = smart.fileOf[name]; if (f) openEntity(f); },
    entityNames: () => smart.titles || [],
    onOpenBoard: () => openGalleryBoard(),
  });
  return galInst;
}

/** [alpha.63r] แผงกระดานอารมณ์ — แยกจากคลังรูปเพื่อให้ลากรูปข้ามแผงได้ */
export function renderGalleryBoardPanel() {
  const host = $('#galboard-body');
  if (!host) return null;
  return renderMoodBoardPanel(host, state.root);
}
export async function openGalleryBoard() {
  showPanel('gallery-board');
  syncMenuToggles();
  const r = await renderFeaturePanel('gallery-board');
  refreshToolbar();
  return r;
}

/** เปิดไฟล์จาก path เต็ม — ใช้ตอนคลิก "รูปนี้ถูกใช้ในฉากไหน" ในคลังรูป */
async function openPathSmart(file) {
  if (!file) return;
  try {
    if (/\.md$/i.test(file)) await openScene(file, null);
    else if (/\.json$/i.test(file)) await openEntity(file);
    else await openPlainFile(file);
  } catch (e) { setStatusError(tt('ui.app.openFileCant') + errText(e)); }
}
export function galleryInstance() { return galInst; }
async function openGallery() {
  showPanel('gallery');
  syncMenuToggles();
  const r = await renderFeaturePanel('gallery');
  refreshToolbar();
  return r;
}
/**
 * [alpha.63] คำสั่งย่อยของคลังรูปจากเมนู native
 * เปิดแผงให้ก่อนเสมอ (ผู้ใช้สั่งจากเมนูตอนแผงยังปิดอยู่ได้) แล้วค่อยสั่งงานตัวคลัง
 */
export async function galleryCommand(ch) {
  if (!state.root) { setStatus(tt('ui.common.openProjectBefore')); return false; }
  await openGallery();
  const g = galInst;
  if (!g) { setStatus(tt('ui.app.openLibraryImageNot')); return false; }
  try {
    switch (ch) {
      case 'gallery': break;                       // เปิดแผงเฉย ๆ (แดชบอร์ดเรียกทางนี้)
      case 'gallery-new-album': await g.newAlbum(''); break;
      case 'gallery-board': await openGalleryBoard(); break;
      case 'gallery-unused':
        g.state.view = 'grid'; g.state.album = albumCore.ALL_ALBUM; g.state.use = 'unused';
        await g.render(); break;
      case 'gallery-dups': await g.findDuplicates(); break;
      case 'gallery-export-used': await g.exportUsed(); break;
      default: return false;
    }
  } catch (e) {
    // คำสั่งจากเมนู native ต้องบอกเหตุผลให้เห็น (บทเรียน 89 — ห้ามตายเงียบ)
    log('error', 'gallery command failed: ' + ch, e);
    setStatusError(tt('ui.app.cmdLibraryImageFail') + errText(e));
    return false;
  }
  return true;
}

/** [alpha.62 บั๊ก 14] ปุ่มคลังรูปบนแถบเครื่องมือ = สวิตช์ของแผง (เปิด/ปิดได้ด้วยปุ่มเดียว) */
export async function toggleGallery() {
  if (isPanelOpen('gallery')) { hidePanel('gallery'); refreshToolbar(); syncMenuToggles(); return false; }
  await openGallery();
  return true;
}

// ---------------- เทมเพลต Wiki (templates.json ที่ root โปรเจกต์ — โครง v1) ----------------
state.templates = [];
state.templatesDoc = { version: 1, note: '', templates: [] };
async function loadTemplates() {
  const file = await kapi.join(state.root, 'templates.json');
  let shippedText = '';
  try { shippedText = await fetch('templates.json').then((r) => r.text()); } catch {}
  if (!(await kapi.exists(file))) {
    if (shippedText) await kapi.writeFile(file, shippedText);
  }
  try {
    state.templatesDoc = await kapi.readJson(file);
    state.templates = state.templatesDoc.templates || [];
  } catch (e) {
    state.templates = [];
    setStatusError(tt('ui.app.templatesJsonFormat') + e.message);
    return;
  }
  // [alpha.71 ข้อ 4] โปรเจกต์เก่ามี templates.json ที่คัดลอกไปตั้งแต่ตอนสร้าง จึงไม่มีบล็อก `profile`
  // → หัวการ์ด Wiki จะว่างเปล่าตลอดกาล · เติมให้จาก templates.json ที่แถมมากับโปรแกรม
  // (ก็อปจาก "ไฟล์ JSON" ไม่ใช่เขียนค่าตายในโค้ด · เฉพาะเทมเพลต builtIn และคีย์ที่ยังไม่มี)
  try {
    if (!shippedText) return;
    const shipped = JSON.parse(shippedText).templates || [];
    const { templates, changed } = mergeBuiltInTemplateMeta(state.templates, shipped);
    if (changed) {
      state.templates = templates;
      state.templatesDoc.templates = templates;
      await kapi.writeFile(file, JSON.stringify(state.templatesDoc, null, 2));
      log('info', tt('ui.app.templatesFillBlockProfile'));
    }
  } catch (e) { log('warn', tt('ui.app.templatesFillBlockProfile2'), e); }
}

// เขียน state.templates กลับลงไฟล์ (คงคีย์ version/note เดิม) แล้วรีเฟรชตัวจัดการ
async function writeTemplates() {
  state.templatesDoc.templates = state.templates;
  await kapi.writeFile(await kapi.join(state.root, 'templates.json'),
                       JSON.stringify(state.templatesDoc, null, 2));
  const tab = state.tabs.get('::templates::');
  if (tab) renderTemplateManager(tab.pane);
}

export function applyTemplate(e, tp) {
  // เพิ่มเฉพาะที่ขาด ไม่ทับค่าเดิม — กติกาเดียวกับ v1
  for (const f of tp.fields || [])
    if (!(f.key in (e.fields = e.fields || {}))) e.fields[f.key] = f.defaultValue || '';
  for (const p of tp.customPropertyDefs || [])
    if (!(p.key in (e.customProperties = e.customProperties || {})))
      e.customProperties[p.key] = p.defaultValue || '';
  const have = new Set((e.sections || []).map((s) => s.title));
  for (const s of tp.sections || [])
    if (!have.has(s.title))
      (e.sections = e.sections || []).push({ title: s.title || '', content: s.defaultContent || '' });
  e.templateId = tp.id || '';
  return e;
}

export function fieldLabels(templateId) {
  const tp = templateOf(templateId);
  const map = {};
  for (const f of tp?.fields || []) map[f.key] = f.label || f.key;
  return map;
}
/** [alpha.71 ข้อ 4] เทมเพลตตาม id — หัวการ์ด Wiki อ่านบล็อก profile จากตัวนี้ (ไม่ฮาร์ดโค้ดชื่อ field) */
export function templateOf(templateId) {
  return (state.templates || []).find((t) => t.id === templateId) || null;
}

// ---------------- ตัวจัดการเทมเพลต Wiki (GUI สร้าง/แก้/ทำซ้ำ/ลบ แบบ v1) ----------------
const TPL_CATS = ['characters', 'locations', 'items', 'lore'];
const FIELD_TYPES = ['String', 'Text', 'Int', 'Date', 'Boolean', 'EntityRef'];

function openTemplateManager() {
  const key = '::templates::';
  if (state.tabs.has(key)) { activate(key); return renderTemplateManager(state.tabs.get(key).pane); }
  const pane = el('div', 'pane');
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', tt('ui.app.templateWiki')));
  const x = el('span', 'tab-x', gi('times')); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file: key, title: tt('ui.app.templateWiki'), pane, tabBtn, dirty: false,
                editor: null, plain: null, wiki: null };
  tabBtn.onclick = (e) => { if (e.target !== x) activate(key); };
  x.onclick = () => closeTab(key);
  state.tabs.set(key, tab);
  activate(key);
  renderTemplateManager(pane);
}

function renderTemplateManager(pane) {
  pane.innerHTML = '';
  const wrap = el('div', 'tpl-mgr');
  const head = el('div', 'tpl-head');
  head.append(el('div', 'tpl-title', tt('ui.app.templateWiki')));
  const btns = el('div', 'tpl-head-btns');
  const bNew = el('button', 'k-ok', tt('ui.app.newTemplateNew'));
  bNew.onclick = () => templateEditModal(null);
  const bJson = el('button', null, tt('ui.app.editJSON'));
  bJson.onclick = () => openTemplatesFile();
  btns.append(bNew, bJson); head.append(btns); wrap.append(head);

  for (const cat of [...TPL_CATS, ...wikiCats().map((c) => c.key),
                     ...new Set(state.templates.map((t) => t.entityTypeKey)
                       .filter((c) => !TPL_CATS.includes(c) && !wikiCats().some((w) => w.key === c)))]) {
    const inCat = state.templates.filter((t) => t.entityTypeKey === cat);
    const sec = el('div', 'tpl-sec');
    sec.append(el('div', 'tpl-sec-title', (CAT_TH[cat] || cat) + ` (${inCat.length})`));
    for (const tp of inCat) {
      const card = el('div', 'tpl-card');
      const info = el('div', 'tpl-card-info');
      const nm = el('div', 'tpl-card-name', tp.name || tp.id);
      if (tp.builtIn) nm.append(el('span', 'tpl-badge', tt('ui.app.default')));
      info.append(nm);
      info.append(el('div', 'tpl-card-meta',
        ttf('ui.app.reducePart', (tp.fields || []).length, (tp.sections || []).length)));
      card.append(info);
      const acts = el('div', 'tpl-card-acts');
      const mk = (label, fn, cls) => { const b = el('button', cls || null, label); b.onclick = fn; return b; };
      acts.append(
        mk(tt('ui.common.edit'), () => templateEditModal(tp)),
        mk(tt('ui.app.repeat'), () => duplicateTemplate(tp)),
        mk(tt('ui.common.del'), async () => {
          if (await confirmBox(ttf('ui.app.delTemplate', tp.name))) {
            state.templates = state.templates.filter((t) => t !== tp);
            await writeTemplates(); setStatus(tt('ui.app.delTemplateDone'));
          }
        }, 'k-danger-btn'));
      card.append(acts);
      sec.append(card);
    }
    wrap.append(sec);
  }
  pane.append(wrap);
}

async function duplicateTemplate(tp) {
  const copy = JSON.parse(JSON.stringify(tp));
  copy.id = guid(); copy.name = (tp.name || tt('ui.app.template')) + tt('ui.common.msg'); copy.builtIn = false;
  state.templates.push(copy);
  await writeTemplates(); setStatus(tt('ui.app.repeatTemplateDone'));
}

// modal สร้าง/แก้เทมเพลต — tp=null คือสร้างใหม่
function templateEditModal(tp) {
  const isNew = !tp;
  const t = tp ? JSON.parse(JSON.stringify(tp))
    : { id: guid(), entityTypeKey: 'characters', name: '', builtIn: false, note: '',
        fields: [], customPropertyDefs: [], sections: [],
        includeRelationships: true, includeImages: true, includeChapterOverrides: true };
  t.fields = t.fields || []; t.sections = t.sections || [];

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-tpl-edit');
  box.append(el('div', 'k-dlg-title', isNew ? tt('ui.app.newTemplateNew2') : tt('ui.app.editTemplate')));

  const rowName = el('div', 'k-row'); rowName.append(el('label', null, tt('ui.app.nameTemplate')));
  const iName = el('input', 'k-dlg-input'); iName.type = 'text'; iName.value = t.name || '';
  rowName.append(iName); box.append(rowName);

  const rowCat = el('div', 'k-row'); rowCat.append(el('label', null, tt('ui.app.cat')));
  const selCat = el('select', 'k-dlg-select');
  const tplCatKeys = [...TPL_CATS, ...wikiCats().map((c) => c.key)];
  for (const c of tplCatKeys) { const o = el('option', null, catLabel(c)); o.value = c; selCat.append(o); }
  if (!tplCatKeys.includes(t.entityTypeKey)) { const o = el('option', null, t.entityTypeKey); o.value = t.entityTypeKey; selCat.append(o); }
  selCat.value = t.entityTypeKey; rowCat.append(selCat); box.append(rowCat);

  // ---- ฟิลด์ ----
  box.append(el('div', 'k-tpl-sub', tt('ui.app.reduceData')));
  const fieldsWrap = el('div', 'k-tpl-list');
  const addFieldRow = (f = { key: '', label: '', type: 'String', defaultValue: '' }) => {
    const r = el('div', 'k-tpl-frow');
    const iK = el('input', 'k-dlg-input'); iK.type = 'text'; iK.placeholder = tt('ui.app.keyEnglish'); iK.value = f.key || '';
    const iL = el('input', 'k-dlg-input'); iL.type = 'text'; iL.placeholder = tt('ui.app.label2'); iL.value = f.label || '';
    const sT = el('select', 'k-dlg-select');
    for (const ft of FIELD_TYPES) { const o = el('option', null, ft); o.value = ft; sT.append(o); }
    sT.value = FIELD_TYPES.includes(f.type) ? f.type : 'String';
    const del = el('button', 'k-tpl-del', gi('close')); del.onclick = () => r.remove();
    del.title = tt('ui.common.removeRowTip');
    r._get = () => ({ key: iK.value.trim(), label: iL.value.trim(), type: sT.value, defaultValue: f.defaultValue || '' });
    r.append(iK, iL, sT, del); fieldsWrap.append(r);
  };
  (t.fields || []).forEach(addFieldRow);
  const bAddF = el('button', 'k-tpl-add', tt('ui.app.addReduce')); bAddF.onclick = () => addFieldRow();
  box.append(fieldsWrap, bAddF);

  // ---- ส่วนเนื้อหา (sections) ----
  box.append(el('div', 'k-tpl-sub', tt('ui.app.partBody')));
  const secWrap = el('div', 'k-tpl-list');
  const addSecRow = (s = { title: '', defaultContent: '' }) => {
    const r = el('div', 'k-tpl-frow');
    const iT = el('input', 'k-dlg-input'); iT.type = 'text'; iT.placeholder = tt('ui.app.namePart'); iT.value = s.title || '';
    iT.style.flex = '1';
    const del = el('button', 'k-tpl-del', gi('close')); del.onclick = () => r.remove();
    del.title = tt('ui.common.removeRowTip');
    r._get = () => ({ title: iT.value.trim(), defaultContent: s.defaultContent || '' });
    r.append(iT, del); secWrap.append(r);
  };
  (t.sections || []).forEach(addSecRow);
  const bAddS = el('button', 'k-tpl-add', tt('ui.app.addPart')); bAddS.onclick = () => addSecRow();
  box.append(secWrap, bAddS);

  // ---- ตัวเลือก ----
  const optWrap = el('div', 'k-tpl-opts');
  const mkChk = (label, val) => {
    const w = el('label', 'k-tpl-chk');
    const c = el('input'); c.type = 'checkbox'; c.checked = val !== false;
    w.append(c, document.createTextNode(' ' + label)); optWrap.append(w); return c;
  };
  const cRel = mkChk(tt('ui.app.hasRelation'), t.includeRelationships);
  const cImg = mkChk(tt('ui.app.hasImage'), t.includeImages);
  const cCh = mkChk(tt('ui.app.hasChapterOverrides'), t.includeChapterOverrides);
  box.append(optWrap);

  const btns = el('div', 'k-dlg-btns');
  const bJsonToggle = el('button', null, tt('ui.app.editJSON2'));
  bJsonToggle.style.marginRight = 'auto';
  const cB = el('button', 'k-cancel', tt('ui.common.cancel')); const okB = el('button', 'k-ok', tt('ui.common.save'));
  btns.append(bJsonToggle, cB, okB); box.append(btns);
  ov.append(box); document.body.append(ov);
  iName.focus();

  // อ่านค่าจากฟอร์มปัจจุบันเป็น object เทมเพลต
  const collectForm = () => ({
    ...t, name: iName.value.trim(), entityTypeKey: selCat.value,
    fields: [...fieldsWrap.querySelectorAll('.k-tpl-frow')].map((r) => r._get()).filter((f) => f.key),
    sections: [...secWrap.querySelectorAll('.k-tpl-frow')].map((r) => r._get()).filter((s) => s.title),
    includeRelationships: cRel.checked, includeImages: cImg.checked, includeChapterOverrides: cCh.checked,
  });

  // โหมด JSON: ซ่อนฟอร์ม แสดง textarea ให้แก้ดิบ ๆ แล้วสลับกลับได้ (ค่าซิงก์สองทาง)
  let jsonMode = false; let jsonTa = null;
  const formEls = [rowName, rowCat, ...box.querySelectorAll('.k-tpl-sub, .k-tpl-list, .k-tpl-add, .k-tpl-opts')];
  bJsonToggle.onclick = () => {
    if (!jsonMode) {
      jsonTa = el('textarea', 'k-src-view'); jsonTa.style.height = '46vh';
      jsonTa.value = JSON.stringify(collectForm(), null, 2);
      formEls.forEach((n) => n.style.display = 'none');
      box.insertBefore(jsonTa, btns);
      bJsonToggle.textContent = tt('ui.app.back');
      jsonMode = true;
    } else {
      try {
        const parsed = JSON.parse(jsonTa.value);         // ตรวจรูปแบบก่อนกลับ
        Object.assign(t, parsed);
        ov.remove(); templateEditModal(t.id ? t : Object.assign(t, { id: t.id }));  // เปิดใหม่ให้ฟอร์มสะท้อนค่า
      } catch (err) { setStatusError(tt('ui.common.jSONNotValid') + err.message); }
    }
  };

  cB.onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  okB.onclick = async () => {
    if (jsonMode) {
      let parsed;
      try { parsed = JSON.parse(jsonTa.value); }
      catch (err) { setStatusError(tt('ui.common.jSONNotValid') + err.message); return; }
      Object.assign(t, parsed);
    } else {
      const name = iName.value.trim();
      if (!name) { iName.focus(); setStatus(tt('ui.app.mustRenameTemplate')); return; }
      t.name = name; t.entityTypeKey = selCat.value;
      t.fields = [...fieldsWrap.querySelectorAll('.k-tpl-frow')].map((r) => r._get()).filter((f) => f.key);
      t.sections = [...secWrap.querySelectorAll('.k-tpl-frow')].map((r) => r._get()).filter((s) => s.title);
      t.includeRelationships = cRel.checked; t.includeImages = cImg.checked; t.includeChapterOverrides = cCh.checked;
    }
    if (isNew) state.templates.push(t);
    else { const i = state.templates.findIndex((x) => x.id === t.id); if (i >= 0) state.templates[i] = t; else state.templates.push(t); }
    await writeTemplates();
    ov.remove();
    setStatus(isNew ? tt('ui.app.newTemplateDone') : tt('ui.app.saveTemplateDone'));
  };
}

// เปิดไฟล์ json/txt เป็นแท็บข้อความล้วนที่ "บันทึกได้จริง" (ใช้โดย Quick Open)
export function openPlainFile(file, title) {
  if (state.tabs.has(file)) { activate(file); return state.tabs.get(file); }
  return openOnce(file, () => openPlainFileNow(file, title));    // [alpha.162 · W1-13]
}

async function openPlainFileNow(file, title) {
  if (state.tabs.has(file)) { activate(file); return state.tabs.get(file); }
  const isJsonFile = /\.json$/i.test(file);
  const raw = await kapi.readFile(file);
  const pane = el('div', 'pane');
  const bar = el('div', 'json-bar');
  const info = el('span', 'dim', title + (isJsonFile ? tt('ui.app.jSONCheckFormatBefore') : tt('ui.app.text')));
  const saveB = el('button', 'k-ok', tt('ui.app.save'));
  bar.append(info, saveB);
  const ta = el('textarea', 'plain-md json-edit');
  ta.value = raw;
  pane.append(bar, ta);
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', title));
  const x = el('span', 'tab-x', gi('times')); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file, title, pane, tabBtn, dirty: false,
                editor: null, plain: null, wiki: null, isJson: true,
                save: async () => {
                  if (isJsonFile) {
                    try { JSON.parse(ta.value); }
                    catch (e) { setStatusError(tt('ui.app.jSONFormatNotSave') + e.message); return false; }
                  }
                  await kapi.writeFile(file, ta.value);
                  tab.dirty = false;
                  tabBtn.querySelector('.tab-title').textContent = tab.title;
                  setStatus(t('status.saved') + ': ' + title);
                  return true;
                } };
  ta.addEventListener('input', () => markDirty(tab));
  saveB.onclick = () => tab.save();
  tabBtn.onclick = (e) => { if (e.target !== x) activate(file); };
  x.onclick = () => closeTab(file, { ask: true });   // [alpha.124 ข้อ 17] ผู้ใช้สั่งปิดเอง
  state.tabs.set(file, tab);
  activate(file);
  return tab;
}

// บริบทของฉากที่เปิดอยู่: { dPath, ch, row, chapterNo, sceneNo } — โมดูล feature ใช้ผูกข้อมูลกับ
// ฉากปัจจุบัน (คอมเมนต์ / โน้ตด่วน / ผังพื้นที่ / [alpha.121] โค้ดสั้นแบบ live ใน liveShortcodeContext)
// chapterNo/sceneNo = ลำดับที่ 1-based ตาม `order` — คำนวณที่นี่ทีเดียวเพราะข้อมูลอยู่ในมืออยู่แล้ว
export async function sceneCtx(file) {
  const t0 = file ? { file } : state.active;
  // [alpha.166 · bug hunt] แท็บเทียม (เช่น ตัวแก้ไขภาพ `::vis::<ไฟล์ฉาก>`) มีคำนำหน้าที่ไม่ใช่ทางไฟล์ — เดิมเอาไปอ่าน
  // `::vis::…/scenes.json` ตรง ๆ จน ENOENT (log เตือนทุกครั้งที่สลับแท็บ) · ถอดคำนำหน้าออกแล้วใช้ไฟล์ฉากจริง
  const t = t0 && t0.file ? { file: String(t0.file).replace(/^::[a-z0-9-]+::/i, '') } : t0;
  if (!t || !t.file || !/\.md$/i.test(t.file) || !/[\\/]Chapters[\\/]/.test(t.file)) return null;
  const dPath = t.file.replace(/[\\/]Chapters[\\/].*$/, '');
  try {
    const scenes = await kapi.readJson(await kapi.join(dPath, 'scenes.json'));
    const draft = await kapi.readJson(await kapi.join(dPath, 'draft.json'));
    const parts = t.file.split(/[\\/]/);
    const fname = parts.pop();
    const folder = parts.pop();                     // โฟลเดอร์บทของไฟล์นี้
    const chapters = (draft.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci];
      // [alpha.159] ★ ต้องเป็นบทของไฟล์นี้ด้วย — ทุกบทมี scene-01.md ของตัวเอง · เดิมจับแค่ชื่อไฟล์
      // → ได้แถวของบทแรกที่มีชื่อซ้ำ (เลขหน้าเริ่มต้น/ไล่ต่อเนื่อง/คุณสมบัติ มาจากฉากอื่น)
      if (ch.folderName && folder && ch.folderName !== folder) continue;
      const list = ((scenes.chapters || {})[ch.guid] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      const si = list.findIndex((s) => s.fileName === fname);
      if (si >= 0) return { dPath, ch, row: list[si], chapterNo: ci + 1, sceneNo: si + 1 };
    }
  } catch (e) { log('warn', 'sceneCtx failed', e); }
  return null;
}

/**
 * [alpha.60r2 ข้อ 13] ดึงคุณสมบัติฉากจาก frontmatter ของ .md ทุกไฟล์ มาอัปเดตดัชนี scenes.json
 * ใช้เมื่อผู้ใช้ไปแก้ไฟล์ .md นอกโปรแกรม (หลักการของโปรเจกต์: "ไฟล์แก้นอกโปรแกรมได้")
 * frontmatter = แหล่งความจริง · scenes.json = ดัชนี/แคชที่ explorer, ตารางฉาก, Planner อ่านเร็ว ๆ
 * @returns {Promise<number>} จำนวนฉากที่ค่าถูกอัปเดตจริง
 */
export async function syncSceneMetaFromFiles(dPath) {
  const dir = dPath || (await sceneCtx())?.dPath;
  if (!dir) { setStatus(tt('ui.app.openSceneDraftBeforeProps')); return 0; }
  const sf = await kapi.join(dir, 'scenes.json');
  const d = await kapi.readJson(sf);
  const draft = await kapi.readJson(await kapi.join(dir, 'draft.json'));
  // อ่าน frontmatter ข้างนอกคิวก่อน (งานดิสก์ช้า) → เก็บเป็นแผนที่ id → ค่าที่ต้องเปลี่ยน
  const patch = new Map();
  let n = 0;
  for (const ch of (draft.chapters || [])) {
    for (const row of ((d.chapters || {})[ch.guid] || [])) {
      const file = await kapi.join(dir, 'Chapters', ch.folderName, row.fileName);
      const m = await readSceneMeta(file, row);
      for (const k of SCENE_HEAVY_KEYS) {
        const before = JSON.stringify(row[k] ?? null), after = JSON.stringify(m[k] ?? null);
        if (before !== after) {
          if (!patch.has(row.id)) patch.set(row.id, {});
          patch.get(row.id)[k] = m[k]; n++;
        }
      }
    }
  }
  // [alpha.159 · M1] ลงทะเบียนผ่านคิว (อ่านสด) — แตะเฉพาะช่องที่เปลี่ยนของแถวที่ยังอยู่
  if (n) {
    await mutateJson(kapi, sf, (fresh) => {
      for (const rows of Object.values(fresh.chapters || {})) {
        for (const r of rows || []) if (patch.has(r.id)) Object.assign(r, patch.get(r.id));
      }
    });
    await buildTree();
  }
  setStatus(n ? ttf('ui.app.propsSceneFileMd', n) : tt('ui.app.propsSceneAtFile'));
  return n;
}

// ---------------- Localizer: ตารางแปล ↔ ไฟล์ภาษา (alpha.60r3 ข้อ 4 · ยกเครื่อง alpha.76) ----------------
// ไฟล์ภาษาเป็น CSV `k2_<code>.csv` แล้ว (ไม่ใช่ .json) — ดู src/i18n.js
// ส่งออก = ตาราง 3 คอลัมน์ `key,th,en` ให้ผู้แปลทำงานใน Excel/Sheets
// นำเข้า = เขียนลง **โฟลเดอร์โปรเจกต์เสมอ** เพราะไฟล์ในโฟลเดอร์โปรแกรมอาจอยู่ที่ที่เขียนไม่ได้
//          (และ core.js อ่านของโปรเจกต์ก่อนอยู่แล้ว)

/** อ่านตารางคำแปลของภาษาหนึ่ง (รวมทุกชั้น) เป็น { key: text } */
async function readLangTable(lang) {
  try {
    const csv = await kapi.langRead(lang, state.root || '');
    if (csv && csv.trim()) return csvToTable(csv);
  } catch {}
  return {};
}

/** ส่งออกตารางคำแปลเป็น CSV 3 คอลัมน์ให้ผู้แปลทำงานใน Excel/Sheets */
export async function exportLanguageCsv(target) {
  const th = await readLangTable('th');
  const code = target || (i18n.lang && i18n.lang !== 'th' ? i18n.lang : 'en');
  const dst = await readLangTable(code);
  if (!Object.keys(th).length && !Object.keys(dst).length) {
    setStatus(ttf('ui.app.notFoundFileLang', code)); return false;
  }
  const keys = [...new Set([...Object.keys(th), ...Object.keys(dst)])].filter((k) => !k.startsWith('meta.'));
  const q = (v) => { const x = v == null ? '' : String(v); return /[",\r\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  const rows = ['key,th,' + code];
  for (const k of keys) rows.push(q(k) + ',' + q(th[k] ?? k) + ',' + q(dst[k] || ''));
  const csv = '\ufeff' + rows.join('\r\n') + '\r\n';
  const dest = await kapi.saveAsDialog('k2_' + code + '.csv', 'csv');
  if (!dest) return false;
  await kapi.writeFile(dest, csv);
  setStatus(ttf('ui.app.exportTableWordDone', keys.length) + dest);
  log('info', 'i18n-csv: export ' + keys.length + ' keys → ' + dest);
  return true;
}

/**
 * นำเข้าคำแปลจาก CSV — **รวมทับของเดิม ไม่ลบคีย์ที่ไม่มีในตาราง**
 * (ผู้แปลมักส่งกลับมาแค่บางส่วน — ถ้าทับทั้งไฟล์ สตริงที่เหลือจะหายเงียบ ๆ)
 * รับได้ทั้งตาราง 3 คอลัมน์ (`key,th,en`) และไฟล์ภาษาตรง ๆ (`key,text`)
 * เขียนลง `<โปรเจกต์>/languages/k2_<code>.csv`
 */
export async function importLanguageCsv(srcPath) {
  if (!state.root) { setStatus(tt('ui.app.openProjectBeforeImport')); return false; }
  const src = srcPath || await kapi.openFileDialog('csv');
  if (!src) return false;
  let text = '';
  try { text = await kapi.readFile(src); }
  catch (e) { setStatusError(failText(tt('ui.app.readFileCSVCant'), e)); return false; }
  const rows = parseCsv(String(text).replace(/\ufeff/g, ''));
  if (!rows.length) { setStatus(tt('ui.app.notFoundKeyFile')); return false; }
  // คอลัมน์ไหนเป็นภาษาอะไร — อ่านจากหัวตาราง (`key,th,en`) · ไม่มีหัวตาราง = คอลัมน์ 2 คือภาษาที่ใช้อยู่
  const head = rows[0].map((c) => String(c).trim().toLowerCase());
  const hasHead = head[0] === 'key';
  const cols = [];
  if (hasHead) {
    for (let i = 1; i < head.length; i++) {
      const c = head[i];
      if (c === 'text' || c === 'value') cols.push([i, i18n.lang || 'th']);
      else if (/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(c)) cols.push([i, c.split('-')[0] + (c.includes('-') ? '-' + c.split('-')[1].toUpperCase() : '')]);
    }
  }
  // ไม่มีหัวตาราง = ไฟล์แบบที่โปรแกรมแจกเอง (`meta.code,en` · `ui.x,…`) — ภาษาอยู่ในแถว meta.code
  // เดิมข้ามแถวนั้นแล้วถือว่าเป็น "ภาษาที่ใช้อยู่" → นำเข้า k2_en.csv ตอนหน้าจอเป็นไทย = คำอังกฤษทับภาษาไทยทั้งไฟล์
  if (!cols.length) {
    const mc = rows.find((r) => String(r[0] == null ? '' : r[0]).trim() === 'meta.code');
    const code = mc ? String(mc[1] == null ? '' : mc[1]).trim() : '';
    const norm = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(code)
      ? code.split('-')[0].toLowerCase() + (code.includes('-') ? '-' + code.split('-')[1].toUpperCase() : '') : '';
    cols.push([1, norm || i18n.lang || 'th']);
  }
  const body = hasHead ? rows.slice(1) : rows;
  const res = { keys: [], skipped: 0, langs: [], added: 0, changed: 0 };
  const dir = await kapi.join(state.root, 'languages');
  await kapi.mkdir(dir);
  for (const [ci, lang] of cols) {
    const patch = {};
    for (const r of body) {
      const k = r[0] == null ? '' : String(r[0]);
      if (!k || k.startsWith('#')) { if (ci === cols[0][0]) res.skipped++; continue; }
      if (ci === cols[0][0] && !res.keys.includes(k)) res.keys.push(k);
      const v = r[ci] == null ? '' : String(r[ci]);
      if (v !== '') patch[k] = v;
    }
    if (!Object.keys(patch).length) continue;
    // รวมทับไฟล์ของโปรเจกต์ (ถ้ามี) — ไม่แตะไฟล์ที่มากับโปรแกรม
    const file = await kapi.join(dir, langFileName(lang));
    let base = {};
    try { if (await kapi.exists(file)) base = csvToTable(await kapi.readFile(file)); } catch {}
    for (const k of Object.keys(patch)) {
      if (!(k in base)) res.added++; else if (base[k] !== patch[k]) res.changed++;
      base[k] = patch[k];
    }
    base['meta.code'] = lang;
    base['meta.nativeName'] = base['meta.nativeName'] || fallbackLangName(lang);
    await kapi.writeFile(file, tableToCsv(base));
    res.langs.push(lang);
  }
  if (!res.langs.length) { setStatus(tt('ui.app.notFoundKeyFile')); return false; }
  // โหลดภาษาที่ใช้อยู่ใหม่ทันที — ไม่ต้องรีสตาร์ตโปรแกรมถึงจะเห็นคำแปลใหม่
  try { await loadLanguage(i18n.lang, state.root); applyDataI18n(); updateToolbarTitles(); } catch {}
  setStatus(ttf('ui.app.importKeyLangAdd', res.keys.length, res.langs.join(', '), res.added + res.changed));
  log('info', 'i18n-csv: import ' + JSON.stringify(res));
  return res;
}

// ---------------- แผงคอมเมนต์ (บั๊ก #25 — เดิมเป็นกล่องโต้ตอบ เก็บใน scenes.json) ----------------
let _cmMigrated = new Set();                       // ฉบับร่างที่ย้ายคอมเมนต์เก่ามาแล้ว (ครั้งเดียวต่อ session)

/** เปิดแผงคอมเมนต์ + ย้ายคอมเมนต์เดิมจาก scenes.json ครั้งแรกที่ใช้ */
export async function openCommentsPanel() {
  showPanel('comments');                           // hook ของ showPanel เรียก drawCommentsPanel ให้แล้ว
  await renderFeaturePanel('comments');            // รอให้วาดเสร็จ (ใช้รอบเดียวกับที่ hook เริ่มไว้)
}
/** วาดเนื้อแผงคอมเมนต์ + ย้ายคอมเมนต์เก่าจาก scenes.json ครั้งแรก — ทางเดียวของทุกทางเข้า */
async function drawCommentsPanel() {
  const c = await sceneCtx();
  if (c && c.dPath && !_cmMigrated.has(c.dPath)) {
    _cmMigrated.add(c.dPath);
    try {
      const n = await migrateSceneComments(c.dPath);
      if (n) setStatus(ttf('ui.app.moveCommentPrevList', n));
    } catch (e) { log('warn', tt('ui.app.moveCommentPrevNot'), e); }
  }
  await renderCommentPanel($('#comments-body'));
}
/** วาดแผงใหม่เมื่อสลับแท็บ/บันทึก — เงียบ ๆ ถ้าแผงปิดอยู่ */
export async function refreshCommentsPanel() {
  if (!isPanelOpen('comments')) { clearCommentAnchors(); return; }
  try { await renderCommentPanel($('#comments-body')); }
  catch (e) { log('warn', tt('ui.app.drawPanelCommentNot'), e); }
}

// แก้ไขแถวฉากใน scenes.json แบบปลอดภัย (อ่าน→แก้ผ่าน mutator→เขียนกลับ)
export async function updateSceneRow(dPath, sceneId, mutate) {
  const sf = await kapi.join(dPath, 'scenes.json');
  // [alpha.156] เข้าคิวของไฟล์ — ตัวนี้ถูกเรียกทุกครั้งที่บันทึกฉาก (จำนวนคำ) จึงชนงานอื่นบ่อยที่สุด
  const res = await mutateJson(kapi, sf, (d) => {
    for (const cg of Object.keys(d.chapters || {})) {
      const row = (d.chapters[cg] || []).find((x) => x.id === sceneId);
      if (row) { mutate(row); return true; }
    }
    return false;
  });
  return res.changed;
}

async function openTemplatesFile() {
  const file = await kapi.join(state.root, 'templates.json');
  if (state.tabs.has(file)) return activate(file);
  await loadTemplates();                            // ให้ไฟล์ default ถูกฝังก่อนถ้ายังไม่มี
  const raw = await kapi.readFile(file);
  const pane = el('div', 'pane');
  const bar = el('div', 'json-bar');
  const info = el('span', 'dim', tt('ui.app.templatesJsonJSONEdit'));
  const saveB = el('button', 'k-ok', tt('ui.app.save'));
  bar.append(info, saveB);
  const ta = el('textarea', 'plain-md json-edit');
  ta.value = raw;
  pane.append(bar, ta);
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', tt('ui.app.templateWiki')));
  const x = el('span', 'tab-x', gi('times')); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file, title: tt('ui.app.templateWiki'), pane, tabBtn, dirty: false,
                editor: null, plain: null, wiki: null, isJson: true,
                save: async () => {
                  try { JSON.parse(ta.value); }
                  catch (e) { setStatusError(tt('ui.app.jSONFormatNotSave') + e.message); return false; }
                  await kapi.writeFile(file, ta.value);
                  await loadTemplates();
                  tab.dirty = false;
                  tabBtn.querySelector('.tab-title').textContent = tab.title;
                  setStatus(tt('ui.app.saveTemplateDone'));
                  return true;
                } };
  ta.addEventListener('input', () => markDirty(tab));
  saveB.onclick = () => tab.save();
  tabBtn.onclick = (e) => { if (e.target !== x) activate(file); };
  x.onclick = () => closeTab(file, { ask: true });   // [alpha.124 ข้อ 17] ผู้ใช้สั่งปิดเอง
  state.tabs.set(file, tab);
  activate(file);
}

// ---------------- สร้างโปรเจกต์ใหม่ (โครงเดียวกับ v1) ----------------
export async function newProject() {
  // [alpha.162 · W4 ข้อ 12] เลือกแบบก่อน (โปรเจกต์ว่างเป็นตัวแรก) — เดิมข้ามไปสร้างโปรเจกต์ว่างเงียบ ๆ
  const tplKey = await showTemplateDialog({ allowBlank: true });
  if (!tplKey) return;
  if (tplKey !== BLANK_TEMPLATE) return newProjectFromTemplate(tplKey);
  const parent = await kapi.openProjectDialog();     // เลือกโฟลเดอร์ที่จะสร้างข้างใน
  if (!parent) return;
  const name = await ask(tt('ui.app.nameProjectNew'), { placeholder: tt('ui.app.eg') });
  if (!name) return;
  if (!(await closeProjectIfAny())) return;
  await createProjectAt(parent, name);
}

// สร้างโปรเจกต์จากเทมเพลต (นิยาย/บทหนัง/แฟนตาซี/สืบสวน) — เมนู ไฟล์
export async function newProjectFromTemplate(picked = null) {
  const tplKey = typeof picked === 'string' && picked ? picked : await showTemplateDialog();
  if (!tplKey) return;
  const parent = await kapi.openProjectDialog();
  if (!parent) return;
  const name = await ask(tt('ui.app.nameProjectNew'), { placeholder: tt('ui.app.eg') });
  if (!name) return;
  if (!(await closeProjectIfAny())) return;
  const root = await createProjectFromTemplate(parent, name, tplKey);
  if (root) await loadProject(root);
  return root;
}

async function createProjectAt(parent, name) {
  const root = await kapi.join(parent, safeName(name));
  if (await kapi.exists(await kapi.join(root, 'project.khn.json'))) {
    setStatus(tt('ui.app.hasProjectOpenReplace')); return loadProject(root);
  }
  const W = (p, d) => kapi.writeFile(p, JSON.stringify(d, null, 2));
  await W(await kapi.join(root, 'project.khn.json'),
    { title: name, type: 'killian-project', version: '2.0', created: new Date().toISOString() });
  const sec = await kapi.join(root, tt('ui.common.bookOne'));
  await W(await kapi.join(sec, 'section.json'), { guid: guid(), title: tt('ui.common.bookOne'), order: 1 });
  const dr = await kapi.join(sec, 'Draft', 'default');
  const ch = { guid: guid(), title: tt('ui.common.chapterOne2'), order: 1, status: 'Outline', act: 'I',
               date: '', isFavorite: false, folderName: tt('ui.common.chapterOne') };
  const sc = { id: guid(), title: tt('ui.app.sceneFirst'), order: 1, fileName: 'scene-01.md',
               chapterGuid: ch.guid, date: '', isFavorite: false, wordCount: 0, synopsis: '' };
  await W(await kapi.join(dr, 'draft.json'), { chapters: [ch] });
  await W(await kapi.join(dr, 'scenes.json'), { chapters: { [ch.guid]: [sc] } });
  await kapi.writeFile(await kapi.join(dr, 'Chapters', ch.folderName, sc.fileName),
    dumpMdFile({ title: sc.title, type: 'scene', format: 'prose', pov: '', tags: [] }, ''));
  for (const d of ['Images', 'Memos', 'Wiki/characters', 'Wiki/locations',
                   'Wiki/items', 'Wiki/lore', 'Recycle'])
    await kapi.mkdir(await kapi.join(root, d));
  await W(await kapi.join(root, 'Images', 'images.json'), { images: [] });
  const defTpl = await fetch('templates.json').then((r) => r.text());
  await kapi.writeFile(await kapi.join(root, 'templates.json'), defTpl);
  await loadProject(root);
  setStatus(tt('ui.app.newProjectNewDone') + name);
}

// ---------------- ปิดโปรแกรม: เตือนงานที่ยังไม่บันทึก ----------------
/**
 * ปิดโปรแกรมทั้งที่ยังมีงานค้าง
 * [alpha.58 ฟีเจอร์ที่ขาด 1] เดิมเป็นปุ่ม 3 ปุ่ม "บันทึกทั้งหมด / ไม่บันทึก / ยกเลิก"
 * → ผู้ใช้ไม่รู้ว่ามีไฟล์ไหนค้างบ้าง และเลือกบันทึกเฉพาะบางไฟล์ไม่ได้
 * ตอนนี้ใช้กล่องเดียวกับ "บันทึกทั้งหมด" (มีรายชื่อไฟล์ + เช็คบ็อกซ์)
 * @returns {Promise<'save'|'discard'|null>} สิ่งที่ผู้ใช้เลือก (คืนค่าเพื่อให้ selftest ตรวจได้)
 */
/**
 * ปิดโปรแกรม — ผ่านรายการงานค้างชุดเดียว (กฎถาวรข้อ 1)
 *
 * [alpha.135] รับ `quit` เข้ามาแทนได้ เพราะ "เปิดโปรแกรมใหม่หลังอัปเดต" ก็คือการปิดโปรแกรม
 * เหมือนกันทุกประการ — ต้องเห็นรายการงานค้างชุดเดียวกัน ห้ามมีทางลัดที่ข้ามกล่องนี้
 * @param {{quit?: () => any}} [opts]
 */
export async function confirmQuit(opts = {}) {
  const quitFn = opts.quit || (() => kapi.quitNow());
  // [alpha.148] สถิติคำรายวันของรอบสุดท้ายยังรออยู่ในตัวจับเวลา (หน่วงรวบ) → จดก่อนปิดจริง
  const doQuit = async () => { try { await flushWordHistory(); } catch {} quitFn(); };
  // [alpha.79] **บันทึกเซสชันก่อนทุกอย่าง** — เดิมทางนี้ไม่เคยจดอะไรเลย
  // (`saveOpenTabs()` อยู่ใน closeProjectIfAny ซึ่งเป็นทางของ "เปลี่ยนโปรเจกต์" เท่านั้น)
  // ต้องมาก่อนกล่องถาม เพราะถ้าผู้ใช้กด "ออกโดยไม่บันทึก" เราก็ยังอยากจำได้ว่าเปิดอะไรไว้
  await saveUiSession(true);
  await saveOpenTabs();
  await flushStarter();                 // [alpha.94] ของที่ wizard ยังไม่ได้เขียนลงดิสก์
  // [alpha.72 ข้อ 4] อ่านจากทะเบียนงานค้าง ไม่ใช่แค่ state.tabs — กระดานวางแผนเคยหายเงียบตรงนี้
  const items = allDirtyList();
  logAction('quit', ttf('ui.app.closeAppPendingList', items.length),
            items.map((x) => x.title));
  if (!items.length) { doQuit(); return 'save'; }
  const { action, keys } = await saveAllDialog(items, {
    title: ttf('ui.app.closeAppHasList', items.length),
    saveLabel: tt('ui.app.saveDoneOut'),
    discardLabel: tt('ui.app.outNotSave'),
    cancelLabel: tt('ui.app.notOutDone'),
  });
  if (action === 'save') {
    const res = await dirtyRegistry.saveKeys(keys);
    if (res.failed.length) {
      for (const f of res.failed) log('error', tt('ui.app.quitSaveBeforeClose') + f.key, f.error);
      // มีของบันทึกไม่ได้ = ห้ามปิดเงียบ ๆ ให้งานหาย
      setStatus(ttf('ui.app.saveNotOkList', res.failed.length));
      showPanel('log'); renderLogPanel(true);
      return null;
    }
    logAction('quit', ttf('ui.app.saveCompleteListDone', res.saved));
    doQuit();
  } else if (action === 'discard') { logAction('quit', tt('ui.app.closeNotSave')); doQuit(); }
  else setStatus(tt('ui.app.cancelCloseApp'));
  return action;
}

// ---------------- Wiki entity ----------------

// กล่องสร้าง Wiki entity — ช่องชื่อ + dropdown เทมเพลต (โผล่เสมอ แม้มีเทมเพลตเดียว) แบบ v1
export function entityCreateDialog(cat, tps) {
  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    const opts = [...tps.map((t) => `<option value="${t.id}">${t.name || t.id}</option>`),
                  `<option value="">${tx('ui.app.notUseTemplate2')}</option>`].join('');
    box.innerHTML = ((a) => `
      <div class="k-dlg-title">${txf('ui.app.newNew', a)}</div>
      <div class="k-row" style="flex-direction:column;align-items:stretch;gap:6px;margin:6px 0">
        <label>${tx('ui.common.name')}</label><input type="text" class="k-dlg-input" id="ent-name" style="width:100%">
      </div>
      <div class="k-row" style="flex-direction:column;align-items:stretch;gap:6px;margin:12px 0 2px">
        <label>${tx('ui.app.template')}</label>
        <select id="ent-tpl" class="k-dlg-select">${a[1]}</select>
      </div>
      <div class="k-dlg-btns"><button class="k-cancel">${tx('ui.common.cancel')}</button><button class="k-ok">${tx('ui.common.new')}</button></div>`)([CAT_TH[cat] || cat, opts]);
    ov.appendChild(box); document.body.appendChild(ov);
    const name = box.querySelector('#ent-name');
    const tpl = box.querySelector('#ent-tpl');
    if (tps.length) tpl.value = tps[0].id;          // ค่าเริ่มต้น = เทมเพลตแรก
    const done = (v) => { ov.remove(); resolve(v); };
    const ok = () => { const n = name.value.trim(); if (!n) { name.focus(); return; }
                       done({ name: n, templateId: tpl.value }); };
    box.querySelector('.k-ok').onclick = ok;
    box.querySelector('.k-cancel').onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    name.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') done(null); };
    tpl.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') done(null); };
    name.focus();
  });
}


// ---------------- เปลี่ยนชื่อ / ถังขยะ (<root>/Recycle — เปิดคืนเองได้) ----------------


// ---------------- เล่ม (section) ----------------
// เล่ม = โฟลเดอร์ที่มี section.json + Draft/ · ชื่อโฟลเดอร์ = ชื่อเล่ม (safeName)






async function renameMemo(file) {
  const { meta, body } = parseMdFile(await kapi.readFile(file));
  const title = await ask(tt('ui.app.nameMemoNew'), { value: meta.title || '' }); if (!title) return;
  meta.title = title;
  await writeKeepingComments(file, dumpMdFile(meta, body));   // [alpha.160 · P0-1]
  const t = state.tabs.get(file);
  if (t) {
    t.title = title;
    if (t.meta) t.meta.title = title;          // [alpha.156] ไม่งั้นบันทึกครั้งถัดไปเขียนชื่อเก่ากลับ
    t.tabBtn.querySelector('.tab-title').textContent = (t.dirty ? gi('dot') + ' ' : '') + title;
  }
  await buildTree();
}

// ---------------- สร้างบท/ฉาก/Memo (เขียน JSON โครงเดียวกับ v1) ----------------
export function safeName(s) { return s.replace(/[\\/:*?"<>|]/g, '').trim() || 'untitled'; }
export function guid() { return 'k2-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }



// เขียนค่าลง row ของฉากใน scenes.json แล้วรีเฟรชต้นไม้

// สลับปักหมุด (ฉากโปรด) — แสดง ⭐ ในต้นไม้ + รวมในแดชบอร์ด

// ล้างถังขยะอัตโนมัติ: ลบรายการใน Recycle ที่แก้ไขล่าสุดเกิน recycleDays วัน (0 = ไม่ล้าง)

// ทำซ้ำฉาก: คัดลอกไฟล์ .md + เพิ่ม row ใหม่ใน scenes.json

// เลื่อนลำดับฉากขึ้น/ลงภายในบทเดียวกัน (สลับ order กับฉากที่อยู่ติดกัน)

// หาชื่อไฟล์ .md ที่ไม่ชนกับไฟล์เดิมในโฟลเดอร์บทปลายทาง
export async function uniqueSceneFileName(dPath, folderName, order) {
  let base = 'scene-' + String(order).padStart(2, '0');
  let name = base + '.md', n = 2;
  while (await kapi.exists(await kapi.join(dPath, 'Chapters', folderName, name)))
    name = base + '-' + (n++) + '.md';
  return name;
}

// ย้ายฉากไปบทอื่น (ในเซกชันเดียวกัน): ย้ายไฟล์ .md + ย้าย row ระหว่างบทใน scenes.json

// เมนูเลือกบทปลายทาง (บทอื่นในเซกชันเดียวกัน)
async function sceneMoveMenu(e, dPath, ch, sc) {
  const chapters = ((await kapi.readJson(await kapi.join(dPath, 'draft.json'))).chapters || [])
    .filter((c) => c.guid !== ch.guid)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!chapters.length) { setStatus(tt('ui.app.notHasChapterOther')); return; }
  popupMenu(e.clientX, e.clientY,
    chapters.map((c) => ({ text: c.title || '', click: () => moveSceneToChapter(dPath, ch, sc, c) })));
}

// ลากสลับลำดับบท (วางบท src ไว้ก่อนบท dst) — คำนวณ order ใหม่ให้เรียงเป็นเลขจำนวนเต็ม

// ลากสลับลำดับฉาก / ย้ายไปวางก่อนฉากปลายทาง (ข้ามบทได้) — ปลอดภัยเรื่องไฟล์

// ย้าย Wiki entity ไปหมวดอื่น (ลากวางบนหัวหมวด) — ย้ายไฟล์ .json จริง
async function moveEntityToCat(srcPath, dstCatDir) {
  const base = srcPath.replace(/^.*[\\/]/, '');
  const dst = await kapi.join(dstCatDir, base);
  if (srcPath === dst) return;
  await kapi.mkdir(dstCatDir);
  if (await kapi.exists(dst)) { setStatus(tt('ui.app.hasFileNameCat')); return; }
  // [alpha.161 · D4] เดิม `if (dirty) await saveTab(); closeTab(srcPath)` (ไม่ discard + ไม่ดูผล) →
  // แท็บที่ยังค้างถูก saveThenClose เขียนกลับ path เดิม **หลัง** kapi.move = ไฟล์ผีในหมวดเก่า
  // → บันทึกให้ผ่านจริงก่อน (ไม่ผ่าน = ไม่ย้าย) แล้วปิดทุกแท็บของไฟล์นี้แบบรอเสร็จ
  if (!(await flushTabForMove(state.tabs.get(srcPath)))) return false;
  if (!(await closeTabsUnderPath(srcPath)).ok) return false;
  await kapi.move(srcPath, dst);
  await moveSnapshots(srcPath, dst);
  await syncOpenTabMeta(dst);
  await buildTree(); await smart.loadNames(state.root);
  refreshNetwork();
  setStatus(tt('ui.app.moveCatNewDone'));
  return dst;
}


// ทำซ้ำ Wiki entity

async function addMemo() {
  const title = await ask(tt('ui.app.nameMemo')); if (!title) return;
  const dir = await kapi.join(state.root, 'Memos');
  await kapi.mkdir(dir);
  const file = await kapi.join(dir, safeName(title) + '-' + Date.now().toString(36) + '.md');
  await kapi.writeFile(file, dumpMdFile({ title, type: 'memo' }, ''));
  await buildTree(); openScene(file, title);
}

// ---------------- แท็บ + ตัวแก้ไข ----------------
/**
 * [alpha.162 · W1-13] ★ กัน "เปิดไฟล์เดียวกันซ้อนกัน" — ทุกตัวเปิดแท็บต้องผ่านตัวนี้
 *
 * ต้นตอ: ตัวเปิดทุกตัวเช็ค `state.tabs.has(file)` แล้วค่อย `await kapi.readFile(...)` ก่อนจะ
 * `state.tabs.set(...)` — ระหว่างรออ่านไฟล์ยังไม่มีใครจองคีย์ไว้ สองคำสั่งที่มาพร้อมกัน
 * (ดับเบิลคลิกในต้นไม้ · คลิกผลค้นหาซ้ำ · กู้เซสชันชนกับคลิกของผู้ใช้) จึงผ่านด่านทั้งคู่
 * → สร้าง pane + ปุ่มแท็บ **สองชุด** แต่ `state.tabs` เก็บได้ชุดเดียว = ชุดแรกกลายเป็นผี
 * (ปิดไม่ได้ ไม่มีใครอ้างถึง แต่ยังกินพื้นที่และทับซ้อนบนจอ)
 * @param {string} file · @param {() => Promise<any>} fn งานเปิดจริง
 */
const OPENING_C = { m: new Map() };
export function openOnce(file, fn) {
  const k = pathKey(file);
  const cur = OPENING_C.m.get(k);
  if (cur) return cur;                       // กำลังเปิดอยู่ — รอใบเดียวกัน ไม่เปิดซ้ำ
  // [alpha.165] จดว่าเปิดไฟล์ไหน (สำเร็จ/ล้ม + รหัส) — ผู้ใช้: "log ต้องบอกว่าเปิดตัวไหน ตัวไหนทำงาน"
  const p = (async () => {
    try { const r = await fn(); log('info', 'tab: open', file); return r; }
    catch (e) { log('error', 'tab: open failed', { file, code: e && e.code, error: e && e.message }); throw e; }
    finally { OPENING_C.m.delete(k); }
  })();
  OPENING_C.m.set(k, p);
  return p;
}

export function openScene(file, title) {
  // [alpha.67] หน้าต่างแผงที่ฉีกออกมาไม่มีแถบแท็บ/พื้นที่เขียน — เปิดที่นี่แล้วจะไม่มีอะไรโผล่
  // ทางเดียวเดียวที่ทุกแผงใช้เปิดฉาก จึงดักที่นี่ทีเดียว: ฝากหน้าต่างหลักเปิดให้แทน
  if (PANEL_WIN) return requestOpenInMain(file);
  if (state.tabs.has(file)) return activate(file);
  return openOnce(file, () => openSceneNow(file, title));
}

async function openSceneNow(file, title) {
  if (state.tabs.has(file)) return activate(file);
  const raw = await kapi.readFile(file);
  const { meta, body } = parseMdFile(raw);
  // [alpha.120 บั๊ก] ★ แท็บเขียน "ชื่อไฟล์" แทน "ชื่อฉาก"
  // ต้นตอ: ทางที่ไม่รู้จักชื่อฉาก (กู้เซสชันตอนเปิดโปรแกรม · เปิดไฟล์จากดิสก์ · ลิงก์ในกระดาน)
  // ส่ง `title` เป็นชื่อไฟล์มาเลย → แท็บได้ 'scene-01' แทน 'ตลาดเก่า'
  // ตอนนี้ทางเหล่านั้นส่ง null มาแทน แล้ว **frontmatter ของไฟล์เป็นคนบอกชื่อ**
  // (setSceneTitle เขียน meta.title คู่กับ scenes.json อยู่แล้ว จึงตรงกันเสมอ)
  title = title || meta.title || file.split(/[\\/]/).pop().replace(/\.md$/i, '');
  const pane = el('div', 'pane');
  const ws = el('div', 'workspace');
  pane.appendChild(ws);
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', title));
  const x = el('span', 'tab-x', gi('times'));
  tabBtn.append(x);
  $('#tabs').append(tabBtn);

  const tab = { file, title, meta, pane, tabBtn, dirty: false, editor: null, plain: null, body, diskBody: body,
                locked: meta.locked === true || meta.locked === 'true' };
  const dir = file.replace(/[\\/][^\\/]*$/, '');

  mountEditor(tab, dir, body);

  tabBtn.onclick = (e) => { if (e.target !== x) activate(file); };
  x.onclick = () => closeTab(file, { ask: true });   // [alpha.124 ข้อ 17]
  state.tabs.set(file, tab);
  activate(file);
  // [alpha.155] ล็อกเล่ม/บท = ล็อกทุกฉากข้างใน (ผู้ใช้เลือกแบบนี้)
  // เช็ก *หลัง* สร้างแท็บ — ไม่หน่วงการขึ้นของตัวแก้ไข (อ่านไฟล์ draft/section เพิ่มทุกครั้งที่เปิดฉาก)
  // · editable() อ่าน tab.locked ทุกครั้งอยู่แล้ว จึงตั้งทีหลังได้
  let containerLock = '';
  try { containerLock = await (await import('./tree-actions.js')).containerLockOf(file); } catch {}
  if (containerLock && !tab.locked && state.tabs.get(file) === tab) { tab.locked = true; applyLockToTab(tab); }
}

// สร้างตัวแก้ไขให้ตรงกับ meta.format ของ tab แล้วผูกอีเวนต์ (ใช้ทั้งตอนเปิดฉากและตอนสลับโหมด)
function mountEditor(tab, dir, body) {
  const pane = tab.pane;
  const mount = pane.querySelector('.workspace') || pane;
  if ((tab.meta.format || 'prose') === 'screenplay') {
    tab.sp = new SPEditor(mount, {
      markdown: body,
      onChange: () => { markDirty(tab); scheduleCount(); scheduleOutline();
                        scheduleSpSmart(tab); scheduleRepaginate(); onsetChanged(tab); },
      // [alpha.60r2 ข้อ 3] Enter = จัดหน้าใหม่ทันที ไม่รอ debounce (เส้นคั่นหน้าไม่กระตุก)
      onKeyDown: (ev) => { repaginateOnEnter(tab, ev); return smart.onKey(ev); },
      onElement: (elName) => setElementBadge(elName),
      getChecker: spellChecker,
      resolveSrc: (p) => resolveImg(dir, p),                       // รูปในบทหนัง render จริง
      getNames: () => state.settings.autoMention !== false ? smart.names : [],   // ลิงก์ Wiki
      onMention: (name) => { if (smart.fileOf[name]) openEntity(smart.fileOf[name]); },
      editable: () => !tab.locked && !tab._onsetSaved,             // ล็อก / ดูฉบับเดิม = แก้ไม่ได้
    });
    // [alpha.125 ข้อ I] คืนการจัดหน้าที่บันทึกไว้ (ไม่นับเป็นการแก้ไข — ดู applyAlignMap)
    try { tab.sp.applyAlignMap(alignFromString(tab.meta.align)); } catch {}
    // [alpha.105r] ★ ตัวรับคลิกผูกกับ **แผง** ซึ่งอยู่ยงข้ามการสลับโหมด แต่ `tab.sp` หายไปตอน
    // สลับเป็นนิยาย (mountEditor สร้างตัวแก้ไขใหม่คนละชนิดในแผงเดิม) → คลิกทีเดียวโยน
    // `Cannot read properties of null (reading 'curElement')` ทุกครั้ง (ผู้ใช้เจอใน console จริง)
    pane.addEventListener('click', () => {
      smart.hide();
      if (tab.sp) setElementBadge(tab.sp.curElement());
      refreshToolbar();
    });
    pane.addEventListener('keyup', () => refreshToolbar());
  } else {
    tab.editor = new KEditor(mount, {
      markdown: body,
      // [alpha.58r บั๊ก 25] จัดหน้าย่อหน้าเก็บใน frontmatter (`align: [3:center]`) → .md สะอาด
      // ยังอ่านไฟล์เก่าที่ใช้ <!--align:x--> ได้เสมอ · ตั้งเป็น 'comment' ใน settings ถ้าอยากได้แบบเดิม
      alignMap: alignFromString(tab.meta.align),
      alignComments: state.settings.mdAlignStyle === 'comment',
      onChange: () => { markDirty(tab); scheduleCount(); scheduleOutline(); onsetChanged(tab);
                        setTimeout(() => smart.check(tab.editor.view), 0); },
      resolveSrc: (p) => resolveImg(dir, p),
      // [alpha.60r2 ข้อ 3] Enter = จัดหน้าใหม่ทันที ไม่รอ debounce
      onKeyDown: (ev) => { repaginateOnEnter(tab, ev); return smart.onKey(ev); },
      getNames: () => state.settings.autoMention !== false ? smart.names : [],
      onMention: (name) => { if (smart.fileOf[name]) openEntity(smart.fileOf[name]); },
      getChecker: spellChecker,
      editable: () => !tab.locked && !tab._onsetSaved,             // ล็อก / ดูฉบับเดิม = แก้ไม่ได้
    });
    pane.addEventListener('click', () => { refreshToolbar(); smart.hide(); });
    pane.addEventListener('keyup', () => refreshToolbar());
  }
  pane.classList.toggle('pane-locked', !!tab.locked);
  pane.classList.toggle('sp-pane', !!tab.sp);            // หน้ากระดาษบทหนัง (Final Draft)
  // บั๊ก #6: workspace ต้องกว้างอย่างน้อยเท่าพื้นที่ของแผง ณ ระดับซูมปัจจุบัน
  // บั๊ก #7: แล้วเลื่อนหน้ากระดาษมากึ่งกลางเป็นมุมมองเริ่มต้น
  syncWorkspaceWidths();                     // [60r2 ข้อ 1] วัดเป็นพิกเซล ไม่ใช่ % ใต้ zoom
  // [alpha.57a ข้อ 2] เลขหน้าเริ่มต้นของไฟล์นี้ (ตั้งในคุณสมบัติฉาก) — อ่านทีหลังได้ ไม่บล็อกการเปิด
  // [alpha.141] นิยายก็ต้องอ่านค่านี้ด้วย — เดิมเงื่อนไขเป็น `tab.sp &&` จึงมีแต่บทภาพยนตร์
  // ที่รู้เลขหน้าเริ่มต้นของตัวเอง (ฝั่งนิยายตกไปที่ 1 เสมอ ทั้งที่ช่องนั้นมีให้กรอกมาตั้งแต่ .57a)
  // [alpha.159 · H7] ธงโหลดแยกจากค่า — `startPage` ที่ไม่ได้ตั้งต้องเป็น undefined (ไม่ใช่ 1)
  // ไม่งั้น currentStartPage() ไม่เคยไปถึงสาย "ไล่เลขหน้าต่อเนื่อง"
  if ((tab.sp || tab.editor) && !tab._startPageLoaded && tab.startPage === undefined) {
    tab._startPageLoaded = true;
    sceneCtx(tab.file).then((c) => {
      const row = c && c.row;
      tab.startPage = explicitStartPage(row);
      // ธง "ไล่เลขหน้าต่อเนื่อง" ของฉากนี้ (คุณสมบัติฉาก → scenes.json → pageFlow)
      tab.pageFlow = isPageFlowContinue(row) ? 'continue' : '';
      if (state.active === tab) { updatePageNumberHint(); refreshSpView(); }
    }).catch(() => { tab.startPage = undefined; tab.pageFlow = ''; });
  }
  // alpha.57 — เอาโหมดมุมมองที่เลือกไว้มาใช้กับแท็บที่เพิ่งเปิด/สลับมา
  // [alpha.110] มุมมองเป็นของแท็บแล้ว → แท็บใหม่ "รับมรดก" ค่าเริ่มต้นล่าสุดครั้งเดียวตอนเปิด
  // (เปิดฉากถัดไปแล้วได้มุมมองเดียวกับที่กำลังอ่านอยู่ · หลังจากนั้นต่างคนต่างจำของตัวเอง)
  seedTabView(tab);
  requestAnimationFrame(() => { autoFitWidth(pane); reapplyTabView(true); centerPage(pane); updatePageNumberHint(); });
  // [alpha.164] ฉากมีปัญหา — ตัวแก้ไขตัวใหม่ (เปิดฉาก · สลับโหมด) ต้องได้แถบเทียบกลับมาเอง
  applyOnsetToTab(tab).catch((e) => log('warn', 'onset', e));
}

// สลับเอกสารระหว่างโหมดนิยาย ↔ บทหนัง (แบบ Fade In) — เนื้อหาเป็น .md ตัวเดียวกัน ต่างแค่ตีความ
// target: 'prose' | 'screenplay' | undefined(=สลับ). ไฟล์เข้ากับ v1 ทุกประการ (เปลี่ยนแค่ frontmatter format)
async function switchFormat(target) {
  const tab = state.active;
  if (!tab || !(tab.editor || tab.sp)) { setStatus(tt('ui.app.openSceneBeforeToggleMode')); return; }
  const cur = (tab.meta.format || 'prose') === 'screenplay' ? 'screenplay' : 'prose';
  const to = target || (cur === 'prose' ? 'screenplay' : 'prose');
  if (to === cur) return;

  exitOriginal(tab);                     // [alpha.164] กำลังดูฉบับเดิม = แปลงฉบับแก้ไข (ของจริง) เท่านั้น
  const src = tab.editor || tab.sp;
  const was = tab.dirty ? src.getMarkdown() : (tab.body ?? src.getMarkdown());
  const dir = tab.file.replace(/[\\/][^\\/]*$/, '');

  // [alpha.87] **แปลงจริง** — เดิมยกไบต์ชุดเดิมให้อีกไวยากรณ์อ่านแล้วเขียนทับทันที
  // `> ยกคำพูด` → ทรานซิชัน (`>>`) · `- รายการ` → ชื่อตัวละคร (`@- …`) = งานเสียถาวร
  const conv = convertBody(was, to, tab.meta);
  // ชั้น 3 (โครงเปลี่ยนจนใช้แผนที่ที่จดไว้ไม่ได้) เท่านั้นที่มีของหาย — ต้องบอกก่อนเสมอ
  if (conv.mode === 'table') {
    const lost = lossReport(was, to);
    if (lost.length) {
      const what = lost.slice(0, 4)
        .map((x) => ttf('ui.app.convertLostItem', elemLabel(x.from), elemLabel(x.to), x.n)).join(' · ');
      const more = lost.length > 4 ? ttf('ui.app.convertLostMore', lost.length - 4) : '';
      if (!(await confirmBox(ttf('ui.app.convertLoss', what + more), tt('ui.app.convertGo')))) return;
    }
  }
  const body = conv.body;

  tab.editor?.destroy(); tab.sp?.destroy();
  tab.editor = null; tab.sp = null;
  tab.pane.innerHTML = '';
  // บั๊ก #7: .workspace คือชั้นที่รับ CSS zoom — innerHTML='' ลบทิ้งไป ต้องสร้างคืนก่อน mountEditor
  // ไม่งั้น mountEditor จะ fallback ไป mount ตรงเข้า .pane แล้วซูมไม่มีผล
  tab.pane.appendChild(el('div', 'workspace'));
  tab.meta.format = to;
  tab.body = body;
  // แผนที่ชนิดบล็อกของ "ฝั่งที่เพิ่งจากมา" — ไม่ใช่สำเนาเนื้อหา แค่ RLE ตัวอักษรเดียว
  // แปลงกลับสำเร็จเมื่อไหร่ลบทิ้ง → ไฟล์ที่ไม่เคยสลับโหมดไม่มีโอเวอร์เฮดสักไบต์
  if (conv.mode === 'table') { tab.meta.spMap = conv.spMap; tab.meta.spHash = conv.spHash; }
  else { delete tab.meta.spMap; delete tab.meta.spHash; }
  // ทรานซิชันของบท = ย่อหน้าชิดขวาของนิยาย · ว่างเมื่อไหร่ไม่แตะ align เดิมของผู้ใช้
  if (conv.align && Object.keys(conv.align).length) tab.meta.align = '[' + alignToString(conv.align) + ']';
  mountEditor(tab, dir, body);

  tab.meta.modified = new Date().toISOString();
  // [alpha.159 · H4] ต้องพาบล็อก `k2-comments` ไปด้วย — เดิม writeFile ตรง ๆ = เธรดคอมเมนต์หายถาวร
  await writeKeepingComments(tab.file, dumpMdFile(tab.meta, body));
  tab.diskBody = body;                               // ฐานของตัวตรวจ "แก้นอกโปรแกรม" = ของที่เพิ่งเขียน
  tab.dirty = false;
  tab.tabBtn.querySelector('.tab-title').textContent = tab.title;

  if (tab.editor) smart.bindView(tab.editor.view);
  if (tab.sp) smart.bindView(tab.sp.view);
  setElementBadge(tab.sp ? tab.sp.curElement() : null);
  refreshToolbar(); refreshModeBtn(); scheduleCount(); scheduleOutline();
  (tab.editor || tab.sp)?.focus?.();
  setStatus(to === 'screenplay' ? tt('ui.app.toggleModeChapterFilm') : tt('ui.app.toggleModeNovel'));
}

// ปุ่มสลับโหมดบน toolbar — แสดงโหมดปัจจุบัน คลิกแล้วเลือกนิยาย/บทหนัง
function refreshModeBtn() {
  const b = $('#tb-mode');
  if (!b) return;
  const tab = state.active;
  const editable = !!(tab && (tab.editor || tab.sp));
  b.style.display = editable ? '' : 'none';
  if (!editable) return;
  const sp = !!tab.sp;
  // [alpha.147] ไอคอนของปุ่มนี้บอก "โหมดปัจจุบัน" จึงมาจากแถว set-format:<โหมด> ในทะเบียน (ไม่ใช่ toggle-format)
  // — `data-icon-command` บอกว่าไอคอนตามคำสั่งไหน (e2e [147-1] ใช้ตรวจ) · ช่องว่าง = ไม่มีไอคอน
  const iconCmd = 'set-format:' + (sp ? 'screenplay' : 'prose');
  const ic = commandIcon(iconCmd);
  b.setAttribute('data-icon-command', iconCmd);
  b.innerHTML = (ic ? iconHtml(ic, 16) : '') + (sp ? tt('ui.app.chapterFilm2') : tt('ui.app.novel2'));
  b.title = tt('ui.app.toggleModeDocNovel');
}

// ---- ตั้งค่าโปรเจกต์ (พอร์ตจาก v1 SettingsDialog) ----

// ---- [alpha.57a ข้อ 4] SmartType บทหนัง: เลิกจำ "คำที่พิมพ์มั่ว" ----
// อาการเดิม: screenplayTerms() กวาดทุกบล็อกตัวละคร/หัวฉากมาเป็นคำเดา รวมบล็อกที่ "กำลังพิมพ์อยู่"
//   → พิมพ์อะไรมั่ว ๆ ลงไปครั้งเดียวก็ติดอยู่ในรายการเดาตลอด และเด้งทับตัวเองขณะพิมพ์
// แก้ 3 ชั้น: (1) ข้ามบล็อกที่เคอร์เซอร์อยู่  (2) กรองคำที่ดูไม่ใช่ชื่อ  (3) รายการ "ไม่ต้องจำ" ที่ลบเองได้

/** คำที่ผู้ใช้สั่งไม่ให้จำ (เก็บใน project.khn.json → smartIgnore) */
export function smartIgnoreList() {
  const v = state.meta && state.meta.smartIgnore;
  return Array.isArray(v) ? v.map(String) : [];
}
export function smartIgnored(word) {
  const w = String(word || '').trim().toLowerCase();
  return !!w && smartIgnoreList().some((x) => String(x).trim().toLowerCase() === w);
}
/** เพิ่ม/เอาออกจากรายการ "ไม่ต้องจำ" — คืนรายการใหม่ */
export function smartIgnoreAdd(word) {
  const w = String(word || '').trim();
  if (!w || !state.meta) return smartIgnoreList();
  const list = smartIgnoreList();
  if (!list.some((x) => x.toLowerCase() === w.toLowerCase())) list.push(w);
  state.meta.smartIgnore = list;
  // [alpha.58] "ไม่จำ" กับ "จำเอง" ต้องไม่อยู่พร้อมกัน ไม่งั้นสองรายการตีกันเงียบ ๆ
  state.meta.smartPin = smartPinList().filter((x) => x.trim().toLowerCase() !== w.toLowerCase());
  saveProjectMetaSoon();
  return list;
}
export function smartIgnoreRemove(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!state.meta) return smartIgnoreList();
  const list = smartIgnoreList().filter((x) => x.trim().toLowerCase() !== w);
  state.meta.smartIgnore = list;
  saveProjectMetaSoon();
  return list;
}

/** คำที่ผู้ใช้สั่ง "จำคำนี้" เอง (ข้ามเกณฑ์เจอซ้ำ) — เก็บใน project.khn.json → smartPin */
export function smartPinList() {
  const v = state.meta && state.meta.smartPin;
  return Array.isArray(v) ? v.map(String) : [];
}
export function smartPinAdd(word) {
  const w = String(word || '').trim();
  if (!w || !state.meta) return smartPinList();
  const list = smartPinList();
  if (!list.some((x) => x.toLowerCase() === w.toLowerCase())) list.push(w);
  state.meta.smartPin = list;
  // จำแล้วก็ต้องเลิกอยู่ในรายการ "ไม่จำ" ไม่งั้นสองรายการตีกันเงียบ ๆ
  state.meta.smartIgnore = smartIgnoreList().filter((x) => x.trim().toLowerCase() !== w.toLowerCase());
  saveProjectMetaSoon();
  return list;
}
export function smartPinRemove(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!state.meta) return smartPinList();
  const list = smartPinList().filter((x) => x.trim().toLowerCase() !== w);
  state.meta.smartPin = list;
  saveProjectMetaSoon();
  return list;
}
/** เกณฑ์ "ต้องเจอกี่บล็อกจึงจำ" ที่ใช้อยู่ (ตั้งได้ที่กล่องจัดการ SmartType) */
export function smartLearnMin() { return learnMin(state.settings.smartLearnMin); }

// เก็บชื่อตัวละคร + สถานที่ที่ "เคยพิมพ์ในบทนี้" (แบบ Final Draft) เพื่อเดาต่อ
// skipPos = ตำแหน่งบล็อกที่กำลังพิมพ์ (ไม่เอามาเป็นคำเดา — ไม่งั้นเดาทับตัวเอง)
//   ส่ง -1 = ไม่ข้ามบล็อกไหนเลย (ใช้ตอนเปิดกล่องจัดการ)
// [alpha.58 บั๊ก 1] คืน counts ด้วย เพื่อให้ชั้น "ต้องเจอซ้ำ" ทำงานได้ (ดู smart-terms.js)
function screenplayTermCounts(tab, skipPos) {
  const charList = [], locList = [];
  try {
    const skip = Number.isFinite(skipPos) ? skipPos
      : (() => { try { return tab.sp.curBlock().pos; } catch { return null; } })();
    tab.sp.view.state.doc.forEach((node, pos) => {
      if (pos === skip) return;                          // (1) ข้ามบล็อกที่เคอร์เซอร์อยู่
      const el = node.attrs.el, txt = (node.textContent || '').trim();
      if (!txt) return;
      if (el === 'character') {
        // เก็บเฉพาะ "ชื่อ" ไม่เอาส่วนเสริม — ไม่งั้นได้ "สมชาย (V.O.)" เป็นคนละคนกับ "สมชาย"
        charList.push(splitCharacter(txt).name);
      } else if (el === 'scene' || el === 'subheader') {
        // ตัดคำนำหน้า (INT./EXT./ฉาก) + เวลา ให้เหลือชื่อสถานที่
        let s = txt;
        for (const p of SCENE_PREFIX) if (s.toUpperCase().startsWith(p.trim().toUpperCase())) { s = s.slice(p.trim().length); break; }
        locList.push(s.split(/\s[-–]\s|\s-\s/)[0].trim());
      }
    });
  } catch {}
  return { chars: countTerms(charList), locs: countTerms(locList) };
}

/**
 * ชื่อจากบทที่ "ผ่านเกณฑ์" แล้ว — เอาไปให้ SmartType เดาได้เลย
 * เกณฑ์ = เจอซ้ำอย่างน้อย smartLearnMin บล็อก · หรือมีใน Wiki · หรือผู้ใช้กดจำเอง
 */
function screenplayTerms(tab, skipPos) {
  const c = screenplayTermCounts(tab, skipPos);
  const base = { min: smartLearnMin(), pinned: smartPinList(), ignored: smartIgnoreList() };
  return {
    chars: learnedTerms(c.chars, { ...base, known: smart.byCat?.characters || [] }),
    locs: learnedTerms(c.locs, { ...base, known: smart.byCat?.locations || [] }),
  };
}
const uniqList = (arr) => [...new Set(arr.filter(Boolean))];
/** ตัดคำที่อยู่ในรายการ "ไม่ต้องจำ" ออกก่อนส่งให้ SmartType (ใช้กับทุกรายการ รวมชื่อจาก Wiki) */
const notIgnored = (arr) => uniqList(arr).filter((x) => !smartIgnored(x));

// [alpha.58 บั๊ก 4] แคชรายชื่อจากบท — เดิมสแกนทั้งเอกสารใหม่ทุก transaction (ทุกตัวอักษรที่พิมพ์)
// รายชื่อไม่ได้เปลี่ยนทุกตัวอักษร → คำนวณใหม่อย่างมากทุก TERM_TTL ms ก็พอสำหรับการเดาคำ
const TERM_TTL = 700;
let _termCache = { tab: null, at: 0, val: null };
// [alpha.126] `clearTermCache()` ถูกถอด — ไม่มีใครเรียก (แคชล้างเองตอนเปลี่ยนโปรเจกต์)
function cachedTerms(tab) {
  const now = Date.now();
  if (_termCache.tab === tab && _termCache.val && now - _termCache.at < TERM_TTL) return _termCache.val;
  const val = screenplayTerms(tab);
  _termCache = { tab, at: now, val };
  return val;
}

function spSmartCheck(tab) {
  if (!tab || !tab.sp) return;          // [alpha.105r] สลับเป็นนิยายระหว่างที่งานหน่วงยังค้างอยู่
  const elName = tab.sp.curElement();
  smart.bindView(tab.sp.view);
  const T = cachedTerms(tab);                           // ชื่อจากบทเอง (Final Draft)
  if (elName === 'character')
    smart.check(tab.sp.view, notIgnored([...T.chars, ...(smart.byCat?.characters || []), ...CHAR_EXTENSIONS]),
                { minLen: 1 });
  else if (elName === 'scene')
    // Final Draft: พิมพ์ e → EXT. · i → INT. (1 ตัวอักษร + ไม่สนพิมพ์เล็กใหญ่)
    smart.check(tab.sp.view, notIgnored([...SCENE_PREFIX, ...T.locs,
                                         ...(smart.byCat?.locations || []), ...TIMES]),
                { minLen: 1, ci: true });
  else if (elName === 'transition') smart.check(tab.sp.view, notIgnored(TRANSITIONS), { minLen: 1, ci: true });
  else if (elName === 'transition-in') smart.check(tab.sp.view, notIgnored(TRANSITIONS_IN), { minLen: 1, ci: true });
  else if (elName === 'intercut') smart.check(tab.sp.view, notIgnored(INTERCUTS), { minLen: 1, ci: true });
  else if (elName === 'subheader')
    smart.check(tab.sp.view, notIgnored([...T.locs, ...(smart.byCat?.locations || []), ...TIMES]),
                { minLen: 1, ci: true });
  else if (elName === 'parenthetical') smart.check(tab.sp.view, notIgnored(PARENTHETICALS), { minLen: 1 });
  else if (elName === 'dialogue' || elName === 'action')
    smart.check(tab.sp.view, notIgnored([...T.chars, ...(smart.byCat?.characters || []),
                                         ...(smart.names || [])]));   // ชื่อตัวละครกลางบทพูด/บรรยาย
  else smart.hide();
}

/** กล่องจัดการ SmartType — ดูคำที่จำไว้จากบทนี้ · ลบคำมั่วออกถาวร */
export function smartTypeDialog() {
  const tab = state.active;
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-smart-dlg');
  box.append(el('div', 'k-dlg-title', tt('ui.app.manageSmartTypeWordApp')));
  box.append(el('div', 'dim',
    tt('ui.app.wordKeepThingPrint')));

  // [alpha.58 บั๊ก 1] เกณฑ์ "ต้องเจอกี่ครั้งจึงจำ" — ตัวกันคำพิมพ์มั่วที่ได้ผลจริง
  const minRow = el('div', 'k-row k-smart-min');
  minRow.append(el('label', null, tt('ui.app.rememberWordChapterFound')));
  const minSel = el('select');
  for (let i = LEARN_MIN_RANGE[0]; i <= LEARN_MIN_RANGE[1]; i++) {
    const o = el('option'); o.value = String(i);
    o.textContent = i + tt('ui.app.block') + (i === DEFAULT_LEARN_MIN ? tt('ui.app.suggest') : '');
    if (i === smartLearnMin()) o.selected = true;
    minSel.append(o);
  }
  minRow.append(minSel);
  minRow.append(el('span', 'dim', tt('ui.app.valueRememberAllWord')));
  box.append(minRow);

  const body = el('div', 'k-smart-body');
  const render = () => {
    body.innerHTML = '';
    const counts = (tab && tab.sp) ? screenplayTermCounts(tab, -1)
                                   : { chars: new Map(), locs: new Map() };
    const base = { min: smartLearnMin(), pinned: smartPinList(), ignored: smartIgnoreList() };
    const known = { chars: smart.byCat?.characters || [], locs: smart.byCat?.locations || [] };
    for (const [title, key] of [[tt('ui.app.characterChapter'), 'chars'], [tt('ui.app.placeChapter'), 'locs']]) {
      const opt = { ...base, known: known[key] };
      const list = learnedTerms(counts[key], opt);
      body.append(el('div', 'k-set-sub', title));
      if (!list.length) body.append(el('div', 'cmp-empty', tt('ui.app.notHas')));
      for (const w of list) {
        const row = el('div', 'k-smart-row');
        row.append(el('span', 'k-smart-word', w));
        row.append(el('span', 'dim', (' ' + gi('times') + ' ') + (counts[key].get(w) || 0)));
        const x = el('button', 'k-danger-btn', gi('close'));
        x.title = tt('ui.app.notMustRememberWord');
        x.onclick = () => { smartIgnoreAdd(w); render(); };
        row.append(x); body.append(row);
      }
      // คำที่เจอครั้งเดียว — ยังไม่จำ แต่โชว์ให้กด "จำ" เองได้ (ชื่อใหม่ที่เพิ่งใส่ครั้งแรก)
      const wait = pendingTerms(counts[key], opt);
      if (wait.length) {
        body.append(el('div', 'k-smart-wait-head dim',
          ttf('ui.app.notRememberFoundNot', smartLearnMin())));
        for (const p of wait) {
          const row = el('div', 'k-smart-row k-smart-wait');
          row.append(el('span', 'k-smart-word dim', p.word));
          row.append(el('span', 'dim', (' ' + gi('times') + ' ') + p.count + (p.ok ? '' : tt('ui.app.pageNotName'))));
          const add = el('button', null, tt('ui.app.remember2'));
          add.title = tt('ui.app.rememberWordFoundTimes');
          add.onclick = () => { smartPinAdd(p.word); render(); };
          const x = el('button', 'k-danger-btn', gi('close'));
          x.title = tt('ui.app.notMustRememberWord');
          x.onclick = () => { smartIgnoreAdd(p.word); render(); };
          row.append(add, x); body.append(row);
        }
      }
    }
    const pin = smartPinList();
    if (pin.length) {
      body.append(el('div', 'k-set-sub', ttf('ui.app.wordCmdRemember', pin.length)));
      for (const w of pin) {
        const row = el('div', 'k-smart-row');
        row.append(el('span', 'k-smart-word', w));
        const b = el('button', null, tt('ui.app.remember'));
        b.onclick = () => { smartPinRemove(w); render(); };
        row.append(b); body.append(row);
      }
    }
    const ign = smartIgnoreList();
    body.append(el('div', 'k-set-sub', ttf('ui.app.wordCmdNotRemember', ign.length)));
    if (!ign.length) body.append(el('div', 'cmp-empty', tt('ui.app.notHas2')));
    for (const w of ign) {
      const row = el('div', 'k-smart-row');
      row.append(el('span', 'k-smart-word dim', w));
      const b = el('button', null, tt('ui.app.rememberTimes'));
      b.onclick = () => { smartIgnoreRemove(w); render(); };
      row.append(b); body.append(row);
    }
  };
  minSel.onchange = () => {
    state.settings.smartLearnMin = learnMin(minSel.value);
    saveProjectMetaSoon();
    render();
  };
  render();
  box.append(body);
  const btns = el('div', 'k-dlg-btns');
  const ok = el('button', 'k-ok k-cancel', tt('ui.common.close'));
  ok.onclick = () => { ov.remove(); if (tab && tab.sp) spSmartCheck(tab); };
  btns.append(ok); box.append(btns);
  ov.append(box); document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov) ok.onclick(); };
  return ov;
}

// [alpha.137] ป้าย "เลือกรูปแบบ" (#elem-badge) ถูกถอดออกจากแถบตามคำสั่งผู้ใช้ —
// ตัวเลือกเดียวกันอยู่บนแถบรูปแบบลอยแล้ว (#tb-sp-elem) · ฟังก์ชันนี้จึงเหลือหน้าที่ "sync ตัวเลือก"
// เป็นหลัก และยังรองรับป้ายเดิมไว้เผื่อมีคนใส่กลับมา (ไม่มี = ข้ามไปเงียบ ๆ)
function setElementBadge(elName) {
  // sync กับตัวเลือกใน floatBar/toolbar
  const spSel = $('#tb-sp-elem');
  if (spSel && SP_ELEMS[elName]) { try { spSel.value = elName; } catch {} }
  const b = $('#elem-badge');
  if (!b) return;
  if (!SP_ELEMS[elName]) { b.textContent = ''; b.classList.remove('elem-pick'); b.onclick = null; return; }
  b.innerHTML = iconHtml('film', 14) + ' ' + elemLabel(elName) + ' ' + gi('caret-down');
  b.title = tt('ui.app.clickPickFormatCtrl');
  b.classList.add('elem-pick');
  b.onclick = (e) => {
    const t = state.active; if (!t?.sp) return;
    popupMenu(e.clientX, e.clientY, TAB_CYCLE.map((el) => ({
      label: (el === t.sp.curElement() ? gi('dot') + ' ' : '   ') + elemLabel(el),
      click: () => { t.sp.setElement(el); t.sp.view.focus(); setElementBadge(el); },
    })));
  };
}

let imgURLBase = new Map();
export function resolveImg(dir, rel) {
  // แปลง path ใน md → file:// (sync ผ่าน cache ที่เตรียมไว้ — fallback เดา URL ตรง ๆ)
  const key = dir + '||' + rel;
  if (imgURLBase.has(key)) return imgURLBase.get(key);
  const guess = fileUrlFromPath(dir + '/' + rel);   // [alpha.148] เข้ารหัส # ? % + รูปแบบ Windows ให้ถูก
  kapi.resolve(dir, rel).then(async (abs) => {
    if (!(await kapi.exists(abs))) {         // ไฟล์เก่าอาจนับชั้นผิด → หาในคลังรูปจากชื่อ
      const base = rel.split('/').pop();
      abs = await kapi.join(state.root, 'Images', base);
      // [alpha.63] รูปอาจถูกย้ายเข้าอัลบั้ม (โฟลเดอร์ย่อยของ Images/) แล้วลิงก์เดิมยังชี้ที่ราก
      // → ไล่หาในทุกอัลบั้มจากชื่อไฟล์ ก่อนจะยอมแพ้ (ไฟล์ .md ไม่ถูกแตะ — แค่แสดงผลให้ถูก)
      if (!(await kapi.exists(abs))) {
        try {
          const { findImagePath } = await import('./gallery/album-core.js');
          const p = await findImagePath(kapi, state.root, base);
          if (p) abs = await kapi.join(state.root, 'Images', ...p.split('/'));
        } catch {}
      }
    }
    imgURLBase.set(key, await kapi.toFileURL(abs));
    document.querySelectorAll('figure img').forEach((im) => {
      if (im.src === guess || im.getAttribute('src') === guess) im.src = imgURLBase.get(key);
    });
  });
  return guess;
}

export function activate(file) {
  for (const [f, t] of state.tabs) {
    const on = f === file;
    t.pane.classList.toggle('on', on || !!t.floatWin);   // หน้าต่างลอยแสดงเสมอ ไม่ขึ้นกับแท็บที่เลือก
    t.tabBtn.classList.toggle('on', on);
    applyTabTooltip(t);                                  // [alpha.161 · K2] ชื่อเต็ม + ที่อยู่ของไฟล์
    wireTabDrag(t);                                      // [alpha.161 · K2] ลากสลับลำดับในแถบ
  }
  state.active = state.tabs.get(file) || null;
  // [alpha.164 · บั๊ก] แถบ "Rewrite this" เป็นของแท็บที่เปิดมัน — สลับไปแท็บอื่นแล้วแถบเดิมต้องปิด
  // (เดิม closeRewriteBar ถูก import ไว้แต่ไม่มีใครเรียก → แถบลอยค้างทับเอกสารอีกฉบับ)
  if (rewriteBarTab() && rewriteBarTab() !== state.active) closeRewriteBar();
  // จำฉากที่เปิดล่าสุดไว้ — แท็บอย่างผังพื้นที่/ผังแตกสายต้องรู้ว่า "กำลังเขียนฉากไหนอยู่"
  // ทั้งที่ตัวเองเป็นแท็บที่ active (ไม่งั้น sceneCtx() คืน null ทันทีที่สลับมาดูผัง)
  if (file && /\.md$/i.test(file) && /[\\/]Chapters[\\/]/.test(file)) state.lastSceneFile = file;
  if (state.active) {
    (state.active.editor || state.active.sp || state.active.plain)?.focus?.();
    if (state.active.editor) smart.bindView(state.active.editor.view);
    if (state.active.sp) smart.bindView(state.active.sp.view);
    // แท็บที่วาดบน canvas ต้องวัดขนาด pane ใหม่ตอนถูกเรียกขึ้นมา (ตอนสร้าง pane ยังซ่อนอยู่ → ได้ 0)
    state.active.net?.focus?.();
    state.active.planner?.focus?.();
  }
  // Split View: แท็บที่เพิ่งเลือกต้องไปโผล่ในช่องที่ถูกต้อง (ช่องเดิมถ้าเคยอยู่ · ไม่งั้นช่องที่โฟกัส)
  // เดิมโค้ดตรงนี้พึ่ง state.compareFile ตัวเดียว → รองรับได้แค่ 2 ช่อง และหลุดแยกจอง่าย
  syncActiveSplit(file);
  // ══ [alpha.110] ★ มุมมองต้องตามฉากที่เปิดอยู่ ══
  // ผู้ใช้: *"ช่องมุมมองไม่ sync กับฉากที่เปิดอยู่ ในกรณีสลับ tab หรือ split"*
  // ทำหลัง `syncActiveSplit` เสมอ — คลาส `.on` ของแต่ละแผง (ใครมองเห็นบ้าง) เพิ่งนิ่งตรงนี้
  reapplyTabView();
  // [alpha.166] ชนิดแท็บเปลี่ยน = ชุดข้อมูลบนแถบสถานะเปลี่ยนทั้งชุด → ปลดความกว้างที่จำไว้ (สลับแท็บชนิดเดิม = คงไว้)
  { const a = state.active; resetStatusBarLock(!a ? 'none' : a.sp ? 'sp' : a.editor ? 'prose' : a.plain ? 'plain' : 'other'); }
  setElementBadge(state.active?.sp ? state.active.sp.curElement() : null);
  smart.hide();
  // บั๊ก #7: มุมมองเริ่มต้นของทุกแท็บ = หน้ากระดาษอยู่กึ่งกลางแนวนอน เริ่มที่บนสุด
  // (หน้ากระดาษกว้างคงที่ตามขนาดกระดาษ → ถ้าไม่จัดกลาง จะไปติดมุมซ้ายทันทีที่แผงแคบกว่ากระดาษ)
  if (state.active) requestAnimationFrame(() => centerPage(state.active && state.active.pane));
  renderCrumbs().catch(() => {});                        // [alpha.161 · K4] เล่ม › บท › ฉาก เหนือเอกสาร
  refreshToolbar(); refreshModeBtn(); scheduleCount(); scheduleOutline();
  updateDirtyBadge();
  refreshStatusBar();
  markSessionDirty();                          // [alpha.79] สลับ/เปิดแท็บ = สถานะล่าสุดเปลี่ยน
  // แสดงปุ่มบันทึกทั้งหมดเมื่อมีโปรเจกต์เปิด
  const saveAllBtn = $('#save-all-btn');
  if (saveAllBtn) saveAllBtn.style.display = state.root ? '' : 'none';
  // [alpha.62 บั๊ก 15] ศูนย์รวมอยู่ในแดชบอร์ดแล้ว — รีเฟรชผ่าน onReviewShown() ตัวเดิม
  // (ตัวมันเองเป็นคนเช็คว่าแผงแดชบอร์ดเปิดอยู่ไหม จึงเรียกได้ทุกครั้งที่สลับแท็บ)
  try { onReviewShown(); } catch {}
  // แผงคอมเมนต์ผูกกับ "ฉากที่เปิดอยู่" — สลับแท็บแล้วต้องเปลี่ยนตาม (ไม่งั้นคอมเมนต์ฉากเก่าค้าง)
  refreshCommentsPanel();
  // [alpha.161 · P1] แผงคุณสมบัติก็เช่นกัน (async — ไม่ต้องรอ)
  syncPropsToActive().catch(() => {});
  // [alpha.68] แผงที่ผูกกับฉากซึ่งถูกฉีกไปอยู่อีกจอ ต้องตามฉากที่เปิดอยู่ให้ทันเหมือนแผงในหน้าต่างนี้
  broadcastActiveScene();
}

export function markDirty(tab) {
  // [alpha.148] นับรุ่นของการแก้ **ทุกครั้ง** (ไม่ใช่แค่ตอนธงพลิก) — saveTab ใช้ตัดสินว่ามีการพิมพ์
  // เข้ามาระหว่างรอเขียนดิสก์หรือไม่ ก่อนจะยอมล้างธง "ยังไม่บันทึก"
  tab._rev = (tab._rev || 0) + 1;
  if (!tab.dirty) {
    tab.dirty = true; tab.tabBtn.querySelector('.tab-title').textContent = gi('dot') + ' ' + tab.title;
    // [alpha.68] เพิ่งกลายเป็น "ยังไม่บันทึก" → แผงที่ฉีกออกไปต้องล็อกอ่านอย่างเดียวทันที
    // (ประกาศเฉพาะตอนธงพลิก ไม่ใช่ทุกตัวอักษรที่พิมพ์)
    broadcastActiveScene();
    // [alpha.124 ข้อ 40] แถบสถานะต้องพลิกเป็น "ยังไม่บันทึก" ตั้งแต่ตัวอักษรแรก
    // (เดิมยังโชว์เวลาบันทึกครั้งก่อนค้างไว้จนกว่าจะสลับแท็บ = อ่านผิดว่างานเซฟแล้ว)
    updateSaveStatus();
  }
  updateDirtyBadge();
  updateProgressBar();
}

// ข้อ 48: แสดงจำนวนแท็บที่ยังไม่บันทึกบนเมนู "ไฟล์" + ไอคอน 💾 บน title bar เมื่อมีงานค้าง
let _rowStateSig = '';
function updateDirtyBadge() {
  // [alpha.120 ข้อ 5] ตัวหนา/เอียงในต้นไม้เดินตามสถานะแท็บ — จุดนี้ถูกเรียกทั้งตอนสลับแท็บ
  // ตอนเริ่มพิมพ์ และตอนบันทึก จึงเป็นที่เดียวที่ครอบคลุมทุกเส้นทาง
  //
  // ⚠ ตัวนี้ถูกเรียก **ทุกตัวอักษรที่พิมพ์** (markDirty เรียกทุกครั้ง ไม่ใช่แค่ตอนธงพลิก)
  // การกวาดทุกแถวในต้นไม้ทุกคีย์สโตรกคือค่าใช้จ่ายที่ผู้ใช้รู้สึกได้ในโปรเจกต์ใหญ่
  // → คำนวณลายเซ็นของ "สภาพที่มีผลกับสี" ก่อน แล้วแตะ DOM เฉพาะตอนมันเปลี่ยนจริง
  try {
    const sig = (state.active ? state.active.file : '') + '|' +
      [...state.tabs.values()].filter((t) => t.dirty).map((t) => t.file).sort().join(';');
    if (sig !== _rowStateSig) { _rowStateSig = sig; refreshTreeRowStates(); }
  } catch {}
  // [alpha.162 · W4 ข้อ 11] จุด "ยังไม่บันทึก" บนแท็บเป็นสี — ข้อความจุดเดิมไม่แตะ (หลายสิบจุดเขียนมันอยู่)
  // แต่ติดคลาสจากธงจริง ที่นี่ที่เดียวซึ่งทุกเส้นทาง (พิมพ์ · บันทึก · สลับแท็บ) เรียกผ่าน
  for (const t of state.tabs.values()) if (t.tabBtn) t.tabBtn.classList.toggle('k-tab-dirty', !!t.dirty);
  const n = [...state.tabs.values()].filter((t) => t.dirty).length;
  const fileMenu = document.querySelector('.tb-menu[data-m="File"]');   // data-m คงที่ (ชื่อที่แสดงเปลี่ยนตามภาษา)
  if (fileMenu) {
    let badge = fileMenu.querySelector('.tb-menu-badge');
    if (n > 0) {
      if (!badge) { badge = el('span', 'tb-menu-badge'); fileMenu.append(badge); }
      badge.textContent = n;
    } else if (badge) badge.remove();
  }
  const dot = $('#tb-dirty-dot');
  if (dot) { dot.style.display = n > 0 ? 'inline' : 'none'; dot.title = n > 0 ? ttf('ui.app.hasPendingFileCtrl', n) : ''; }
}

/**
 * [alpha.156] ไฟล์ถูกแก้นอกโปรแกรมระหว่างที่แท็บเปิดอยู่ — ถามผู้ใช้ว่าจะเก็บฉบับไหน
 * บันทึกอัตโนมัติ **ไม่ถาม** (เด้งกล่องกลางการพิมพ์คือบั๊ก) — ข้ามไฟล์นั้นแล้วบอกที่แถบสถานะ
 * @returns {Promise<'overwrite'|'reload'|'skip'>}
 */
async function resolveDiskConflict(tab, kind, opts = {}) {
  const name = tab.title || tab.file;
  if (opts.auto) {
    if (!tab._conflictWarned) { tab._conflictWarned = true; log('warn', tt('ui.app.diskConflictAutoSkip') + tab.file); }
    setStatus(ttf('ui.app.diskConflictAutoStatus', name));
    return 'skip';
  }
  // e2e หลายจุดเขียนไฟล์ลับหลังแท็บโดยตั้งใจ — ห้ามค้างรอกล่อง (เทสที่ต้องการกล่องตั้ง __k2conflictChoice เอง)
  if (location.search.includes('k2test')) return window.__k2conflictChoice || 'overwrite';
  const v = kind === 'deleted'
    ? await choose(ttf('ui.app.diskDeletedAsk', name), [
        { label: tt('ui.app.diskConflictRecreate'), value: 'overwrite', primary: true },
        { label: tt('ui.common.cancel'), value: null },
      ])
    : await choose(ttf('ui.app.diskConflictAsk', name), [
        { label: tt('ui.app.diskConflictReload'), value: 'reload' },
        { label: tt('ui.app.diskConflictOverwrite'), value: 'overwrite', danger: true },
        { label: tt('ui.common.cancel'), value: null, primary: true },
      ]);
  return v || 'skip';
}

/**
 * [alpha.156] โฟกัสกลับมาที่หน้าต่าง → ตรวจแท็บ .md ทุกใบกับดิสก์
 * ไม่มีงานค้าง = โหลดใหม่เงียบ ๆ · มีงานค้าง = เตือนครั้งเดียว แล้วให้ตัดสินตอนบันทึก
 */
let _diskCheckAt = 0;
export async function checkTabsAgainstDisk({ force = false } = {}) {
  if (PANEL_WIN) return 0;
  const now = Date.now();
  if (!force && now - _diskCheckAt < 1500) return 0;
  _diskCheckAt = now;
  let reloaded = 0;
  for (const tab of [...state.tabs.values()]) {
    if (!tab.file || !/\.md$/i.test(tab.file) || (!tab.editor && !tab.sp)) continue;
    let disk;
    try { disk = parseMdFile(await kapi.readFile(tab.file)).body; } catch { continue; }
    const base = tab.diskBody !== undefined ? tab.diskBody : tab.body;
    const act = focusAction({ dirty: !!tab.dirty, diskBody: disk, baseBody: base });
    if (act === 'reload') {
      const h = tabHandleOf(tab);
      if (h) { try { await h.reloadFromDisk(); reloaded++; } catch (e) { log('warn', tt('ui.app.panelLoadFileWindow') + tab.file, e); } }
    } else if (act === 'keep' && !tab._diskWarned) {
      tab._diskWarned = true;
      setStatus(ttf('ui.app.diskChangedWhileDirty', tab.title || tab.file));
      log('warn', ttf('ui.app.diskChangedWhileDirty', tab.file));
    }
  }
  if (reloaded) { setStatus(ttf('ui.app.diskReloadedN', reloaded)); scheduleOutline(); }
  return reloaded;
}

/**
 * บันทึกแท็บ
 * @param {{auto?: boolean}} [opts] auto = มาจากบันทึกอัตโนมัติ (ห้ามเด้งกล่อง)
 * @returns {Promise<void|false>} false = ไม่ได้บันทึก (ผู้ใช้เลือกไม่บันทึกทับ/โหลดของบนดิสก์แทน)
 */
/**
 * [alpha.162 · W1-5] เนื้อ .md ของแท็บ "ตามที่เห็นบนจอ" — **ตัวอ่านตัวเดียวของทุกทางที่ต้องการเนื้อดิบ**
 * นิยาย = ProseMirror · บทภาพยนตร์ = SPEditor · ไฟล์ข้อความล้วน = textarea
 * @returns {string|null} null = แท็บชนิดนี้ไม่มีเนื้อแบบ .md (หน้า Wiki · กระดาน · ตาราง ฯลฯ)
 */
export function tabBodyText(tab) {
  if (!tab) return null;
  if (tab.editor) return tab.editor.getMarkdown();
  if (tab.sp) return tab.sp.getMarkdown();
  if (tab.plain) return tab.plain.value;
  return null;
}

export async function saveTab(tab, opts = {}) {
  if (!tab) return;
  // [alpha.72 ข้อ 5] จดทุกการเขียนไฟล์ — ใช้ตอบคำถาม "ไฟล์ถูกเขียนทับตอนไหน/ด้วยอะไร"
  logAction('save', tab.title || tab.file || tt('ui.common.notNamed'), tab.file);
  if (isRosterTab(tab)) { await saveRosterTab(tab); return; }   // [97] หน้ารายชื่อตัวละคร
  if (tab.planner) {
    await tab.planner.save();
    tab.dirty = false;
    tab.tabBtn.querySelector('.tab-title').textContent = tab.title;
    return;
  }
  if (tab.isJson) { await tab.save(); return; }
  if (tab.wiki) {
    await tab.wiki.save();
    tab.dirty = false;
    tab.tabBtn.querySelector('.tab-title').textContent = tab.title;
    setStatus(t('status.saved') + ': ' + tab.title);
    return;
  }
  const rev = tab._rev || 0;                   // [alpha.148] รุ่นของเนื้อที่กำลังจะเขียน (ดู markDirty)
  const body = tabBodyText(tab);               // [alpha.162 · W1-5] ตัวอ่านเนื้อตัวเดียวกับ "บันทึกเป็น"
  // ══ [alpha.156] ★ ไฟล์ถูกแก้ "นอกโปรแกรม" ไปแล้วหรือยัง (disk-conflict.js) ══
  // เดิมบันทึกทับเสมอ → ของที่แก้ใน VS Code/Obsidian หรือที่ตัวซิงก์คลาวด์ดึงมา หายเงียบ ๆ
  if (/\.md$/i.test(tab.file || '')) {
    const base = tab.diskBody !== undefined ? tab.diskBody : tab.body;
    let diskNow;
    try { diskNow = parseMdFile(await kapi.readFile(tab.file)).body; }
    catch { diskNow = (await kapi.exists(tab.file).catch(() => true)) ? base : null; }
    const kind = diskConflict({ diskBody: diskNow, baseBody: base, tabBody: body });
    if (kind === 'external' || kind === 'deleted') {
      const choice = await resolveDiskConflict(tab, kind, opts);
      if (choice === 'reload') {
        const h = tabHandleOf(tab);
        if (h) await h.reloadFromDisk();
        setStatus(tt('ui.app.saveCancelledKeepTab'));
        return false;
      }
      if (choice !== 'overwrite') return false;
    }
  }
  tab.body = body;
  // [alpha.58r บั๊ก 25] จัดหน้าไปอยู่ใน frontmatter — เขียนเฉพาะตอนมีจริง (ไม่งั้นได้บรรทัดขยะทุกไฟล์)
  if (tab.editor && state.settings.mdAlignStyle !== 'comment') {
    const am = alignToString(tab.editor.getAlignMap());
    if (am) tab.meta.align = '[' + am + ']';
    else delete tab.meta.align;
  }
  // [alpha.125 ข้อ I] บทภาพยนตร์ก็เก็บการจัดหน้าไว้ใน frontmatter เหมือนกัน
  // (เนื้อ fountain ไม่ถูกแตะ — เหตุผลเต็มอยู่ที่ `SPEditor.getAlignMap()`)
  if (tab.sp) {
    const am = alignToString(tab.sp.getAlignMap());
    if (am) tab.meta.align = '[' + am + ']';
    else delete tab.meta.align;
  }
  tab.meta.modified = new Date().toISOString();
  // บันทึกว่าแก้ไขด้วยแอปเวอร์ชันไหน + เพิ่มเลขรอบแก้ (revision) เพื่อให้เทียบเวอร์ชันได้
  tab.meta.appVersion = APP_VERSION;
  tab.meta.revision = String((parseInt(tab.meta.revision, 10) || 0) + 1);
  // คอมเมนต์เก็บอยู่ท้ายไฟล์เดียวกัน — เขียนทับตรง ๆ = คอมเมนต์หาย
  // (ไม่มีคอมเมนต์ = เขียนตัวต่อตัวเหมือนเดิม ไม่แตะท้ายไฟล์)
  // [alpha.165] ผลของการบันทึกลง log ทุกครั้ง (สำเร็จ/ล้ม + รหัส) — เดิมจดแค่ "เริ่มบันทึก" แล้วเงียบ
  const tSave = performance.now();
  try { await writeKeepingComments(tab.file, dumpMdFile(tab.meta, body)); }
  catch (e) { log('error', 'save: write failed', { file: tab.file, code: e && e.code, error: e && e.message }); throw e; }
  log('info', 'save: done', { file: tab.file, chars: body.length, ms: Math.round(performance.now() - tSave) });
  tab.diskBody = body;                         // [alpha.156] ฐานของการตรวจ "แก้นอกโปรแกรม" รอบถัดไป
  tab._conflictWarned = false; tab._diskWarned = false;
  // [alpha.148] ★ มีการพิมพ์เข้ามา **ระหว่างรอเขียนดิสก์** (บันทึกอัตโนมัติมักยิงตอนกำลังพิมพ์)
  // → ตัวอักษรเหล่านั้นไม่ได้อยู่ใน `body` ที่เพิ่งเขียน · เดิมล้างธงทิ้งอยู่ดี แท็บดูเหมือนบันทึกแล้ว
  // ปิดแท็บ/โปรแกรมก็ไม่มีกล่องถาม = งานช่วงท้ายหายเงียบ ๆ
  if ((tab._rev || 0) === rev) {
    tab.dirty = false;
    tab.tabBtn.querySelector('.tab-title').textContent = tab.title;
  } else {
    tab.dirty = true;
    tab.tabBtn.querySelector('.tab-title').textContent = gi('dot') + ' ' + tab.title;
  }
  setStatus(tt('ui.app.saveDone') + tab.title);
  updateDirtyBadge();                          // [alpha.120 ข้อ 5] แถวในต้นไม้เลิกเอียงทันทีที่บันทึก
  refreshCommentsPanel();
  // [alpha.68] บันทึกแล้ว = แผงที่ฉีกออกไปแก้ไฟล์นี้ได้อีกครั้ง (และเนื้อบนดิสก์เป็นของใหม่)
  broadcastActiveScene();
  // สำรองเวอร์ชันอัตโนมัติ (ตามตั้งค่า autoBackup/maxBackups)
  if (state.settings.autoBackup !== false && isSnapshotable(tab))
    snapshotFile(tab.file).catch(() => {});
  // เนื้อหาเปลี่ยน → ดัชนีเชื่อมโยงของศูนย์รวมล้าสมัย (ข้อ 87 real-time)
  try { markReviewStale(); } catch (e) { log('warn', tt('ui.app.markCentralizeStaleFail'), e); }
  // [alpha.80] บันทึกฉากแล้ว แผงบทพูดต้องตามให้ทัน (หน่วง+รวบใน markDialogueStale เอง)
  try { markDialogueStale(); } catch (e) { log('warn', tt('ui.dialogue.errScan'), e); }
  // [alpha.124 ข้อ 23] จำนวนคำของฉากต้องลง scenes.json ทุกครั้งที่บันทึก
  await syncSceneWordCount(tab, body);
  scheduleWordHistory();                       // [alpha.148] สถิติคำรายวันต้องจดหลังทุกการบันทึก (หน่วงรวบ)
  // [alpha.60r3 ข้อ 1] ดัชนี Wiki↔ฉากต้องตามทันด้วย ไม่งั้น "ฉากที่กล่าวถึง" ค้างอยู่ที่ค่าตอนเปิดโปรแกรม
  await refreshBacklinksAfterSave(tab, body);
  // [alpha.65] Story Network — refresh when scenes are saved (scene links may change)
  try { refreshNetwork(); } catch {}
  // [alpha.125 ข้อ A · ข้อ B] เนื้อหาเปลี่ยน → ดัชนีค้นหา **และ** ดัชนี RAG ของแชทล้าสมัย
  invalidateSearchIndex();
  invalidateChatRag();
  // ═══ [alpha.126] ★ แผงที่โชว์ "สรุปจากไฟล์" ต้องไม่ค้างของเก่า ═══
  //
  // เจอตอนกวาด dead export: `refreshBooksIfOpen()` กับ `refreshOpenFloorPlan()` **มีอยู่จริง
  // เขียนถูกด้วย แต่ไม่มีใครเรียกเลยสักที่** — ไม่ใช่โค้ดตาย แต่คือ *สายที่ลืมต่อ*
  // (พี่น้องของมันอย่าง `refreshMapsIfOpen()` ถูกเรียกจาก wiki-ui.js อยู่แล้ว)
  // ผลคือ: เปิดหน้า "จัดการเล่ม" ค้างไว้แล้วพิมพ์ต่อ → จำนวนคำ/จำนวนฉากบนการ์ดไม่ขยับ
  // และผังพื้นที่ที่เปิดค้างก็ไม่เห็นฉากที่เพิ่งเปลี่ยนสถานที่
  try { refreshBooksIfOpen(); } catch {}
  try { refreshChaptersIfOpen(); } catch {}
  try { refreshOpenFloorPlan(); } catch {}
  // [alpha.141] เนื้อฉากเปลี่ยน = จำนวนหน้าของฉากนี้เปลี่ยน = เลขหน้าของฉากถัด ๆ ไปเลื่อนตาม
  // → สายหน้าของทั้งเล่มที่วัดไว้ใช้ไม่ได้แล้ว (โหมดอ่านและตัวไล่เลขหน้าใช้ก้อนเดียวกัน)
  try { bumpBookFlow(); } catch {}
  // [alpha.124 ข้อ 40] แถบสถานะ (#status-save) เคยรีเฟรชแค่ตอน "สลับแท็บ" กับ "บันทึกทั้งหมด"
  // → กด Ctrl+S ไฟล์เดียวแล้วยังขึ้น "ยังไม่บันทึก" ค้างอยู่ · หรือโชว์เวลาของรอบก่อน
  updateSaveStatus();
}

/**
 * [alpha.124 ข้อ 23] ★ จำนวนคำของฉาก — เขียนกลับ `scenes.json` ทุกครั้งที่บันทึก
 *
 * `scenes.json` คือ **ดัชนี/แคช** ที่ทั้งโปรแกรมอ่านไปโชว์ (ป้ายในต้นไม้ · ตารางฉาก ·
 * เรียงตามจำนวนคำ · หน้าแรก · แดชบอร์ด · สถิติวันเขียนติดต่อกัน) แต่ช่อง `wordCount`
 * ถูกตั้งเป็น 0 ตอนสร้างฉากแล้ว **ไม่เคยถูกอัปเดตอีกเลย** — ทุกจอเหล่านั้นจึงโชว์ 0
 * ตลอดมา ขณะที่แถบสถานะซึ่งนับสดจากเอกสารโชว์เลขจริง (ผู้ใช้เห็นเลขไม่ตรงกัน 6 จอ)
 *
 * นับด้วย `countWords()` ตัวเดียวกับแถบสถานะเป๊ะ ๆ → ตัวเลขตรงกันทุกจอโดยนิยาม
 * เขียนเฉพาะตอนค่าเปลี่ยนจริง (บันทึกซ้ำโดยไม่แก้อะไร = ไม่แตะดิสก์)
 */
async function syncSceneWordCount(tab, body) {
  if (!tab || !tab.file || !/\.md$/i.test(tab.file)) return;
  try {
    const ctx = await sceneCtx(tab.file);
    if (!ctx || !ctx.row || ctx.row.type === 'memo') return;
    const n = countWords(body || '');
    if ((ctx.row.wordCount || 0) === n) return;
    await updateSceneRow(ctx.dPath, ctx.row.id, (r) => { r.wordCount = n; });
    ctx.row.wordCount = n;                 // แถวที่ต้นไม้ถืออยู่ต้องเห็นค่าใหม่ทันทีด้วย
    updateSceneWordBadge(tab.file, n);
  } catch (e) { log('warn', tt('ui.app.wordCountSyncFail'), e); }
}

/** ข้อความบนป้ายจำนวนคำ (ต้นไม้ใช้ตัวนี้ทั้งตอนสร้างและตอนอัปเดตสด — ห้ามเขียนสองสูตร) */
function wordBadgeText(n) {
  return (n >= 1000 ? Math.round(n / 1000) + 'k' : n) + tt('ui.common.word');
}
/** อัปเดตป้ายจำนวนคำของแถวในต้นไม้แบบทันที (ไม่ต้องสร้างต้นไม้ใหม่ทั้งก้อนตอนกด Ctrl+S) */
function updateSceneWordBadge(file, n) {
  const row = document.querySelector('#tree .scene[data-path="' + CSS.escape(file) + '"]');
  if (!row) return;
  if (row._scene) row._scene.wordCount = n;
  let badge = row.querySelector('.sc-wordcount');
  if (!badge && n) { badge = el('span', 'sc-wordcount'); row.append(badge); }
  if (!badge) return;
  badge.textContent = n ? wordBadgeText(n) : '';
}

/**
 * [alpha.60r3 ข้อ 1] หลังบันทึกไฟล์ฉาก: อัปเดตดัชนี auto-link แบบทีละฉาก
 * แล้ววาดแผง "ฉากที่กล่าวถึง" ของแท็บ Wiki ที่เปิดค้างอยู่ใหม่
 *
 * ทำเฉพาะเมื่อดัชนีถูกสร้างไว้แล้ว (`autoLinkReady()`) — ไม่งั้นการบันทึกครั้งแรก
 * จะไปปลุกการสแกนทั้งโปรเจกต์ (อ่านทุกไฟล์ .md) ทำให้ Ctrl+S หน่วงโดยไม่จำเป็น
 */
async function refreshBacklinksAfterSave(tab, body) {
  if (!autoLinkReady() || !tab || !tab.file) return;
  try {
    const ctx = await sceneCtx(tab.file);
    if (!ctx || !ctx.row) return;
    const changed = updateSceneLink({ id: ctx.row.id, title: ctx.row.title || '',
                                      chapterId: ctx.ch.guid, text: body || '' });
    if (!changed) return;
    refreshOpenWikiBacklinks();
  } catch (e) { log('warn', tt('ui.app.updateIndexBacklinksFail'), e); }
}

/** วาดส่วน "ฉากที่กล่าวถึง" ของทุกแท็บ Wiki ที่เปิดอยู่ใหม่ (ฝากไว้ตอนสร้างแท็บใน wiki-ui.js) */
export function refreshOpenWikiBacklinks() {
  for (const t2 of state.tabs.values()) {
    if (t2 && typeof t2.refreshBacklinks === 'function') {
      try { t2.refreshBacklinks(); } catch {}
    }
  }
}

// บันทึกทุกแท็บที่ยังมีงานค้าง (Ctrl+Alt+S / เมนู ไฟล์ → บันทึกทั้งหมด)
/** รายการไฟล์ค้างสำหรับกล่อง saveAllDialog (บั๊ก #3) */
function dirtyTabList() {
  return [...state.tabs.values()].filter((t) => t.dirty)
    .map((t) => ({ key: t.file, title: t.title || t.file, file: t.file }));
}

// ─────────────────────────────────────────────────────────────────────────────
// [alpha.72 ข้อ 4] กฎถาวร: **อะไรที่มีการทิ้งเมื่อปิด หรือ update ตอนปิดโปรแกรม ต้องขึ้น list ทุกครั้ง**
// ทุกระบบที่ถืองานค้างต้องลงทะเบียนที่นี่ กล่อง "บันทึกทั้งหมด"/"ปิดโปรแกรม" อ่านจากทะเบียนตัวเดียว
// เพิ่มฟีเจอร์ใหม่ที่มีสถานะค้าง → เพิ่ม registerDirtySource() ที่นี่ ไม่ใช่ไปแก้กล่องบันทึกทีละที่
// ─────────────────────────────────────────────────────────────────────────────
let _branchPlanApi = null;
function registerDirtySources() {
  if (dirtyRegistry.has('tabs')) return;
  registerDirtySource('tabs', {
    label: tt('ui.app.fileOpen'),
    list: dirtyTabList,
    save: async (key) => {
      const t = state.tabs.get(key);
      if (!t) return false;
      // [alpha.156] ผู้ใช้เลือกไม่บันทึกทับไฟล์ที่ถูกแก้นอกโปรแกรม = "ยังไม่ได้บันทึก" (ปิดโปรแกรมต้องไม่ผ่าน)
      return (await saveTab(t)) !== false;
    },
  });
  // กระดานวางแผน — ไม่ได้อยู่ในรูปแท็บ จึงเคยหายเงียบตอนปิดโปรแกรม
  registerDirtySource('planner', {
    label: tt('ui.app.boardPlanner'),
    list: () => {
      if (!plannerInst || !plannerInst.data || !plannerInst.data.isDirty()) return [];
      const p = plannerInst.data.getPath();
      return [{ key: p || '::planner::', title: plannerInst.data.getName() || tt('ui.app.boardPlanner'), file: p || '' }];
    },
    save: async () => {
      if (!plannerInst) return false;
      return (await plannerInst.save(true)) !== false;
    },
  });
  // [alpha.73 ข้อ 5] แผนของผังแตกสายก็ถือสถานะค้างในหน่วยความจำ → ต้องขึ้น list ตามกฎ alpha.72
  registerDirtySource('branch-plan', {
    label: tt('ui.app.graphBreakBranch'),
    list: () => {
      const bp = _branchPlanApi;
      if (!bp || !bp.currentBranchPlan) return [];
      const cur = bp.currentBranchPlan();
      if (!cur || !cur.path || !bp.isBranchPlanDirty()) return [];
      return [{ key: cur.path, title: cur.name || tt('ui.app.graphBreakBranch'), file: cur.path }];
    },
    save: async () => {
      if (!_branchPlanApi) return false;
      return (await _branchPlanApi.saveBranchPlan(true)) !== false;
    },
  });
  // [alpha.89r] ผลวิเคราะห์ที่ยิง AI ไปแล้วแต่ยังไม่ได้บันทึกเป็นเซสชัน
  // — เสียเงินไปแล้ว หายแล้วหายเลย (ผลที่คำนวณเองไม่เข้าทะเบียน กดใหม่ได้ค่าเดิมเป๊ะ)
  registerDirtySource('analysis', {
    label: tt('ui.app.aiAnalysis'),
    list: analyzerDirtyList,
    save: async () => (await saveAnalysisSession()) !== null,
  });
  // [alpha.82] เซสชันห้องซ้อมบทถือเทิร์นที่เพิ่งคุยไว้ในหน่วยความจำเหมือนกัน (กฎ alpha.72)
  registerDirtySource('dlgb', {
    label: tt('ui.app.dlgbSource'),
    list: () => builderDirtyList().map((title) => ({ key: '::dlgb::' + title, title, file: '' })),
    save: async () => (await saveBuilderDirty()) !== false,
  });
  // [alpha.162 · W1-15] สมุดโน้ตด่วน — ค่าที่พิมพ์ค้างยังไม่ถูกเขียนลง localStorage (หน่วง 3 วินาที)
  registerDirtySource('scratch', {
    label: tt('ui.notes.notebookNoteQuick'),
    list: scratchDirtyList,
    save: async () => { flushScratch(); return true; },
  });
  // [alpha.156] สปรินต์ที่กำลังจับเวลา — ปิดโปรแกรมแล้วรอบนั้นหาย (สถิติไม่ถูกจด) = ต้องขึ้นรายการ
  registerDirtySource('sprint', {
    label: tt('ui.sprint.dirtyLabel'),
    list: sprintDirtyList,
    // [alpha.162 · W1-16] เดิม `stopSprint() !== null` = จริงเสมอแม้เขียนไฟล์ไม่ผ่าน (error ถูกกลืน)
    save: saveSprintDirty,
  });
  // โหลด API ของผังแตกสายไว้ล่วงหน้า — ทะเบียนถูกถามตอนจะปิดโปรแกรม รอ import ไม่ทัน
  import('./branching-ui.js').then((m) => { _branchPlanApi = m; }).catch(() => {});
  log('info', tt('ui.app.dirtyPending') + dirtyRegistry.ids().join(', '));
}

/** รายการงานค้างทั้งหมดสำหรับกล่องบันทึก (ทุกแหล่ง ไม่ใช่แค่แท็บ) */
function allDirtyList() {
  registerDirtySources();
  return dirtyRegistry.collect().map((x) => ({
    key: x.key,
    // ติดชื่อกลุ่มไว้หน้ารายการที่ไม่ใช่ไฟล์ปกติ ผู้ใช้จะได้รู้ว่ามันคืออะไร
    title: x.source === 'tabs' ? x.title : `[${x.sourceLabel}] ${x.title}`,
    file: x.file,
  }));
}

/**
 * บันทึกทั้งหมด — ขึ้นกล่องรายการไฟล์ก่อนเสมอ (บั๊ก #3)
 * @param {boolean} silent ข้ามกล่อง (ใช้ตอน autosave/เทส)
 */
// [alpha.69] export ให้แผงประวัติเรียกได้ — ก่อนย้อนกลับต้องเอางานค้างลงไฟล์ให้จบก่อน
// ไม่งั้นการกด Ctrl+S ครั้งถัดไปจะทับไฟล์ที่เพิ่งคืนกลับมา
export async function saveAllTabs(silent = false) {
  // [alpha.72 ข้อ 4] "ทั้งหมด" = ทุกแหล่งในทะเบียน ไม่ใช่แค่แท็บ (กระดานวางแผนเคยตกหล่น)
  let items = allDirtyList();
  if (!items.length) { setStatus(tt('ui.app.notHasPendingSave')); return 0; }
  if (!silent) {
    const { action, keys } = await saveAllDialog(items);
    if (action !== 'save') { if (action === null) setStatus(tt('ui.app.cancelSave')); return 0; }
    const pick = new Set(keys);
    items = items.filter((x) => pick.has(x.key));
    if (!items.length) return 0;
  }
  let n = 0;
  // [alpha.62 บั๊ก 10] บอกที่แถบล่างว่ากำลังบันทึกไฟล์ไหน อยู่ที่เท่าไรของทั้งหมด
  try {
    for (const it of items) {
      setBusy(ttf('ui.app.busySave', n + 1, items.length, it.title || it.key || ''));
      const r = await dirtyRegistry.saveKeys([it.key]);
      n += r.saved;
      for (const f of r.failed) log('error', tt('ui.app.saveAllSaveNotOk') + f.key, f.error);
    }
  } finally { clearBusy(); }
  logAction('saveAll', ttf('ui.app.saveList', n, items.length));
  setStatus(ttf('ui.app.saveAllDoneList', n));
  updateDirtyBadge();
  refreshStatusBar();
  // บันทึกสถิติคำ (ข้อ 58)
  scheduleWordHistory(0);                      // [alpha.148] ทางเดียวกับ saveTab (เดิมจดเฉพาะที่นี่ที่เดียว)
  return n;
}

// ---------------- ระบบสำรอง/ประวัติเวอร์ชันฉาก (Snapshot) ----------------
function isSnapshotable(tab) {
  return !!tab && !tab.isJson && !tab.wiki && /\.md$/i.test(tab.file || '') &&
         (tab.editor || tab.sp || tab.plain);
}
function tsStamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23); }
function sanitizeLabel(s) { return (s || '').replace(/[\\/:*?"<>|]/g, '').replace(/__+/g, '_').slice(0, 40); }

async function snapDirFor(file) {
  if (!state.root || !file) return null;                 // กัน path.relative(null,…) ตอน root/ไฟล์ยังไม่พร้อม
  const rel = (await kapi.relative(state.root, file)).replace(/\.md$/i, '');
  return kapi.join(state.root, 'Snapshots', rel.replace(/[\\/]/g, '__'));
}

// รายการเวอร์ชัน (ใหม่สุดก่อน) — [{name,ts,label,path}]
export async function listSnapshots(file) {
  const dir = await snapDirFor(file);
  if (!dir || !(await kapi.exists(dir))) return [];
  const names = await kapi.listFiles(dir, '.md');
  const out = [];
  for (const fn of names) {
    const base = fn.replace(/\.md$/i, '');
    const idx = base.indexOf('__');
    out.push({ name: fn, ts: idx < 0 ? base : base.slice(0, idx),
               label: idx < 0 ? '' : base.slice(idx + 2), path: await kapi.join(dir, fn) });
  }
  return out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}

// บันทึกเวอร์ชันจากเนื้อหาไฟล์ปัจจุบันบนดิสก์ (auto=ไม่มี label; ข้ามถ้าซ้ำกับล่าสุด)
export async function snapshotFile(file, label = '') {
  if (!state.root) return;
  let content; try { content = await kapi.readFile(file); } catch { return; }
  const snaps = await listSnapshots(file);
  if (!label && snaps.length) {
    try { if ((await kapi.readFile(snaps[0].path)) === content) return; } catch {}
  }
  const dir = await snapDirFor(file);
  if (!dir) return;
  await kapi.mkdir(dir);
  const fn = label ? `${tsStamp()}__${sanitizeLabel(label)}.md` : `${tsStamp()}.md`;
  await kapi.writeFile(await kapi.join(dir, fn), content);
  await pruneSnapshots(file);
}

// ตัดเวอร์ชันอัตโนมัติเก่าให้เหลือไม่เกิน maxBackups (เวอร์ชันที่ตั้งชื่อ = ไม่ถูกตัด)
async function pruneSnapshots(file) {
  // [alpha.164 ข้อ A12] กฎ 20 — `parseInt(x) || 10` ตีค่า 0 เป็นเท็จ (แก้ไฟล์เองเป็น 0 แล้วได้ 10) · 0 = เก็บ 1 อันพอ
  const max = Math.max(1, Math.floor(num(state.settings.maxBackups, 10)));
  const unlabeled = (await listSnapshots(file)).filter((s) => !s.label);
  for (const s of unlabeled.slice(max)) { try { await kapi.remove(s.path); } catch {} }
}

// บันทึกเวอร์ชันด้วยตนเอง (จากคลิกขวาฉาก) — บันทึกไฟล์ก่อนถ้าเปิดค้างและ dirty
async function manualSnapshot(dPath, ch, sc) {
  return manualFileSnapshot(await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName));
}
/** [alpha.155] บันทึกเวอร์ชันของไฟล์ .md ใดก็ได้ (memo ใช้ด้วย) — ถามชื่อเวอร์ชันแบบเดียวกับฉาก */
async function manualFileSnapshot(file) {
  const openTab = state.tabs.get(file);
  if (openTab && openTab.dirty) await saveTab(openTab);
  const label = await ask(tt('ui.common.renameVersionSkipEmpty'), { placeholder: tt('ui.app.egBeforeEditAct'), okLabel: tt('ui.common.saveVersion') });
  if (label === null) return;
  await snapshotFile(file, label || tt('ui.common.version'));   // manual = มี label เสมอ (กันถูกตัด)
  setStatus(tt('ui.app.saveVersionDone'));
}

export function fmtTs(ts) {
  // 2026-07-20T08-30-00 (UTC — ชื่อไฟล์มาจาก toISOString) → 20/07/2026 15:30 (เวลาเครื่อง)
  // [alpha.148] เดิมโชว์ตัวเลขในชื่อไฟล์ตรง ๆ = เวลา UTC → ประวัติเวอร์ชันช้าไป 7 ชั่วโมงสำหรับผู้ใช้ในไทย
  // ชื่อไฟล์ยังเป็น UTC เหมือนเดิม (เรียงลำดับของเก่า/ใหม่ปนกันได้ถูกต้อง) — แก้แค่ตอนแสดง
  return fmtUtcStamp(ts);
}

// กล่องประวัติเวอร์ชัน — ดูตัวอย่าง/กู้คืน/ลบ

// เทียบง่ายๆ ระดับบรรทัด: คืน [{l,r,cls}] — cls: same/add/del/chg สำหรับไฮไลต์สองฝั่ง
function lineDiff(aText, bText) {
  const A = (aText || '').split('\n'), B = (bText || '').split('\n');
  const n = A.length, m = B.length;
  // LCS ตาราง (พอสำหรับฉากหนึ่ง ๆ)
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { rows.push({ l: A[i], r: B[j], cls: 'same' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ l: A[i], r: '', cls: 'del' }); i++; }
    else { rows.push({ l: '', r: B[j], cls: 'add' }); j++; }
  }
  while (i < n) { rows.push({ l: A[i++], r: '', cls: 'del' }); }
  while (j < m) { rows.push({ l: '', r: B[j++], cls: 'add' }); }
  return rows;
}

// กล่องเทียบเวอร์ชัน — สองฝั่ง เลือกเวอร์ชันได้ทั้งซ้าย/ขวา + ไฮไลต์บรรทัดที่ต่าง
async function compareVersionsDialog(dPath, ch, sc) {
  return compareFileVersionsDialog(await kapi.join(dPath, 'Chapters', ch.folderName, sc.fileName), sc.title);
}
/** [alpha.155] เทียบเวอร์ชันของ "ไฟล์ .md ใดก็ได้" (memo ใช้ด้วย) — ฉากเรียกผ่าน compareVersionsDialog */
async function compareFileVersionsDialog(file, titleText) {
  const sc = { title: titleText || file.split(/[\\/]/).pop() };
  const snaps = await listSnapshots(file);
  // ตัวเลือก: [ปัจจุบัน] + เวอร์ชันที่บันทึกไว้
  const opts = [{ key: '__cur__', label: tt('ui.app.currentTopDisk') },
    ...snaps.map((s) => ({ key: s.path, label: fmtTs(s.ts) + (s.label ? ' · ' + s.label : '') }))];
  const bodyOf = async (key) => {
    try {
      if (key === '__cur__') { const t = state.tabs.get(file);
        if (t && (t.editor || t.sp)) return (t.editor || t.sp).getMarkdown(); }
      return parseMdFile(await kapi.readFile(key === '__cur__' ? file : key)).body;
    } catch { return tt('ui.app.readCant'); }
  };

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide k-cmp');
  box.append(el('div', 'k-dlg-title', tt('ui.app.compareVersion') + sc.title));
  const head = el('div', 'k-cmp-head');
  const selL = el('select', 'k-dlg-select'); const selR = el('select', 'k-dlg-select');
  for (const o of opts) { const a = el('option', null, o.label); a.value = o.key; selL.append(a);
                          const b = el('option', null, o.label); b.value = o.key; selR.append(b); }
  selL.selectedIndex = Math.min(1, opts.length - 1);      // ฝั่งซ้าย = เวอร์ชันเก่าสุดที่มี (ถ้ามี)
  selR.value = '__cur__';                                  // ฝั่งขวา = ปัจจุบัน
  head.append(el('span', 'k-cmp-lbl', tt('ui.app.left')), selL, el('span', 'k-cmp-lbl', tt('ui.app.right')), selR);
  box.append(head);
  const grid = el('div', 'k-cmp-grid'); box.append(grid);
  const foot = el('div', 'k-dlg-btns'); const closeB = el('button', 'k-cancel', tt('ui.common.close'));   // [alpha.164 · รอบต่อ 4] กฎ W4
  foot.append(closeB); box.append(foot);
  ov.append(box); document.body.append(ov);
  closeB.onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  async function render() {
    grid.innerHTML = '';
    const rows = lineDiff(await bodyOf(selL.value), await bodyOf(selR.value));
    const colL = el('div', 'k-cmp-col'); const colR = el('div', 'k-cmp-col');
    let diffs = 0;
    for (const r of rows) {
      if (r.cls !== 'same') diffs++;
      const lc = el('div', 'k-cmp-line ' + (r.cls === 'del' ? 'cmp-del' : r.cls === 'add' ? 'cmp-gap' : ''));
      lc.textContent = r.l || (r.cls === 'add' ? '' : r.l);
      const rc = el('div', 'k-cmp-line ' + (r.cls === 'add' ? 'cmp-add' : r.cls === 'del' ? 'cmp-gap' : ''));
      rc.textContent = r.r || '';
      colL.append(lc); colR.append(rc);
    }
    grid.append(colL, colR);
    head.querySelector('.k-cmp-count')?.remove();
    head.append(el('span', 'k-cmp-count', diffs ? ttf('ui.app.line2', diffs) : tt('ui.app.allLine')));
  }
  selL.onchange = render; selR.onchange = render;
  render();
}

/**
 * [alpha.156] ซิงก์ `meta` ของแท็บที่เปิดไฟล์นี้อยู่ให้ตรงกับ frontmatter บนดิสก์
 *
 * ทุกทางที่เขียน frontmatter "ลับหลัง" แท็บ (เปลี่ยนชื่อ · คุณสมบัติจากเมนูคลิกขวา) ต้องเรียก
 * — แท็บถือ meta ชุดเก่าไว้ พอบันทึกครั้งถัดไป (หรือบันทึกอัตโนมัติ) ก็เขียนทับของที่เพิ่งตั้ง
 * (แผงคุณสมบัติกับกล่องคุณสมบัติแก้แบบนี้ไว้แล้ว แต่เมนูคลิกขวา/เปลี่ยนชื่อยังไม่ได้แก้)
 * @param {string} file
 * @param {object} [patch] ค่าที่ต้องทับลงไปหลังอ่าน (เช่น `{title}`)
 */
export async function syncOpenTabMeta(file, patch) {
  const t2 = state.tabs.get(file);
  if (!t2 || !t2.meta) return false;
  try { t2.meta = parseMdFile(await kapi.readFile(file)).meta; }
  catch (e) { log('warn', tt('ui.props.writeMetaFail'), e); }
  if (patch) Object.assign(t2.meta, patch);
  return true;
}

/**
 * [alpha.156] ปิดทุกแท็บของไฟล์ที่อยู่ใต้ `dir` (หรือเป็นไฟล์นั้นเอง) — **รอจนปิดเสร็จจริง**
 *
 * เดิมมีหลายสำเนาและพังคนละแบบ: `startsWith(prefix)` ไม่มีตัวคั่น ("เล่ม1" ไปปิดแท็บของ "เล่ม10") ·
 * `closeTab()` ที่ไม่ await (บันทึกแข่งกับการย้ายโฟลเดอร์ → ไฟล์ถูกเขียนกลับที่เดิม = โฟลเดอร์ผี) ·
 * และ "ลบบท" ไม่ปิดแท็บเลย (บันทึกอัตโนมัติสร้างโฟลเดอร์บทที่ลบไปแล้วขึ้นมาใหม่)
 * @param {{save?: boolean}} opts save = บันทึกงานค้างก่อนปิด (ค่าเริ่มต้น) · false = ทิ้งงานค้าง
 * @returns {Promise<number>} จำนวนแท็บที่ปิด
 */
export async function closeTabsUnderPath(dir, { save = true } = {}) {
  // [alpha.160 · P0-3] คืน `{closed, skipped, ok}` — ผู้เรียกต้อง **ยกเลิกการลบ/ย้าย** เมื่อ skipped>0
  // (เดิมคืนตัวเลขเปล่า ๆ แล้วผู้เรียกย้ายโฟลเดอร์ต่อทันที → แท็บที่บันทึกไม่ผ่านชี้ไปไฟล์ที่ไม่มีแล้ว)
  if (!dir) return closeResult(0, 0);
  const k = pathKey(dir);
  const hits = [...state.tabs.values()].filter((t2) => {
    if (!t2.file || String(t2.file).startsWith('::')) return false;
    const f = pathKey(t2.file);
    return f === k || f.startsWith(k + '/');
  });
  let closed = 0, skipped = 0;
  for (const t2 of hits) {
    if (save && t2.dirty) {
      // [alpha.159] บันทึกไม่ผ่าน (คืน false = ผู้ใช้ยกเลิกในกล่องชนกับดิสก์ · throw = เขียนไม่ได้)
      // → **ไม่ปิดทิ้ง** ปล่อยแท็บค้างไว้ให้ผู้ใช้ตัดสินเอง (เดิมปิดแบบ discard = งานหายเงียบ)
      let r;
      try { r = await saveTab(t2); }
      catch (e) { log('error', tt('ui.app.saveBeforeCloseFail') + (t2.title || t2.file), e); r = false; }
      if (r === false || t2.dirty) { setStatus(tt('ui.app.saveCancelledKeepTab')); skipped++; continue; }
    }
    closeTab(t2.file, { discard: true });
    closed++;
  }
  return closeResult(closed, skipped);
}

/**
 * [alpha.160 · P0-2] ก่อนลบ/ย้ายไฟล์ที่เปิดเป็นแท็บ — งานค้างต้องลงไฟล์ให้ได้ก่อน
 * @returns {Promise<boolean>} true = ไปต่อได้ · false = บันทึกไม่ผ่าน/ผู้ใช้ยกเลิก (แจ้งสถานะให้แล้ว) → **ห้ามลบ/ย้าย**
 */
export async function flushTabForMove(tab) {
  const okk = await flushTab(tab, (t2) => saveTab(t2));
  if (!okk) setStatus(ttf('ui.app.moveCancelledUnsaved', (tab && (tab.title || tab.file)) || ''));
  return okk;
}

/**
 * [alpha.156] ย้ายประวัติเวอร์ชันตามไฟล์/โฟลเดอร์ที่ถูกย้าย
 *
 * Snapshot ผูกกับ **ทางของไฟล์** (`Snapshots/<ทางสัมพัทธ์ที่ / กลายเป็น __>`) — ย้ายฉากไปบทอื่น
 * แล้วประวัติเวอร์ชันทั้งหมด "หายไป" จากกล่องประวัติ (ค้างเป็นโฟลเดอร์กำพร้าใน Snapshots)
 * ไฟล์ .md = ย้ายโฟลเดอร์เวอร์ชันของไฟล์นั้น · โฟลเดอร์ (บท/เล่ม) = ย้ายของทุกไฟล์ข้างใน
 * @returns {Promise<number>} จำนวนโฟลเดอร์เวอร์ชันที่ย้าย
 */
export async function moveSnapshots(oldPath, newPath) {
  if (!state.root || !oldPath || !newPath || oldPath === newPath) return 0;
  try {
    const snapRoot = await kapi.join(state.root, 'Snapshots');
    if (!(await kapi.exists(snapRoot))) return 0;
    const keyOf = async (p) => (await kapi.relative(state.root, p)).replace(/\.md$/i, '').replace(/[\\/]/g, '__');
    const isFile = /\.md$/i.test(oldPath);
    const oldK = await keyOf(oldPath), newK = await keyOf(newPath);
    let n = 0;
    for (const name of await kapi.listDirs(snapRoot)) {
      let dstName = null;
      if (name === oldK) dstName = newK;
      else if (!isFile && name.startsWith(oldK + '__')) dstName = newK + name.slice(oldK.length);
      if (!dstName) continue;
      const src = await kapi.join(snapRoot, name);
      const dst = await kapi.join(snapRoot, dstName);
      if (await kapi.exists(dst)) {
        // ปลายทางมีประวัติอยู่แล้ว (ไฟล์ชื่อนี้เคยอยู่ที่นั่น) → รวมทีละไฟล์ ไม่ทับของเดิม
        for (const f of await kapi.listFiles(src, '')) {
          const to = await kapi.join(dst, f);
          if (!(await kapi.exists(to))) await kapi.move(await kapi.join(src, f), to);
        }
        await kapi.remove(src).catch(() => {});
      } else {
        await kapi.move(src, dst);
      }
      n++;
    }
    return n;
  } catch (e) { log('warn', tt('ui.app.moveSnapshotsFail'), e); return 0; }
}

/**
 * ปิดแท็บ — [alpha.124 ข้อ 17] **ถามก่อนเสมอเมื่อยังมีงานค้าง**
 *
 * เดิม: `if (t.dirty) saveTab(t).then(done)` = บังคับบันทึกเงียบ ๆ ทุกครั้ง
 * ผลคือ "ลองแก้ดูเล่น ๆ แล้วปิดทิ้ง" ทำไม่ได้เลยทั้งโปรแกรม — ปิดแท็บ = เขียนทับไฟล์จริงเสมอ
 * (มี Revert อยู่ก็จริง แต่ต้องนึกออกว่ามีและต้องกดก่อนปิด)
 *
 * @param {string} file
 * @param {{discard?: boolean, ask?: boolean}} opts
 *   · `ask` — **ถามก่อน** (ค่าเริ่มต้น false) เปิดเฉพาะทางที่ "ผู้ใช้สั่งปิดเอง":
 *     ปุ่ม ✕ บนแท็บ · Ctrl+W · เมนูคลิกขวาแท็บ · ปุ่มปิดบนแถบเครื่องมือ
 *     ทางเรียกภายใน (เปลี่ยนชื่อไฟล์ · ย้ายฉาก · ลบลงถังขยะ · เปลี่ยนเล่ม) ไม่ถาม —
 *     พวกนั้นจัดการงานค้างของตัวเองมาก่อนแล้ว และเด้งกล่องกลางงานเบื้องหลังคือบั๊ก ไม่ใช่ฟีเจอร์
 *   · `discard` — ทิ้งการแก้ไขโดยไม่ถาม (ผู้เรียกที่ถามเองแล้ว เช่น closeAllTabs)
 */
/** [alpha.162 · W4 ข้อ 11] กองแท็บที่เพิ่งปิด (ดู tab-order.js) */
let _closedTabs = [];
/** เปิดแท็บที่เพิ่งปิดกลับมา — ไฟล์ที่หายไปจากดิสก์แล้วข้ามไปตัวถัดไป · คืนไฟล์ที่เปิดได้ (หรือ null) */
export async function reopenClosedTab() {
  for (;;) {
    const { file, rest } = takeReopen(_closedTabs, state.root, [...state.tabs.keys()]);
    _closedTabs = rest;
    if (!file) { setStatus(tt('ui.tabs.reopenNone')); return null; }
    let ok = false;
    try { ok = (await kapi.exists(file)) && !!(await openTabAt(file)); } catch {}
    if (ok) return file;
  }
}
export function closedTabsForTest() { return _closedTabs.slice(); }

export function closeTab(file, { discard = false, ask = false } = {}) {
  const t = state.tabs.get(file);
  if (!t) return;
  const done = () => {
    log('info', 'tab: close', file);                     // [alpha.165] จดการปิดแท็บ (คู่กับ tab: open)
    if (rewriteBarTab() === t) closeRewriteBar();       // [alpha.164 · บั๊ก] แถบ Rewrite ของแท็บนี้ต้องไปด้วย
    t.editor?.destroy(); t.wiki?.destroy(); t.sp?.destroy(); t.gal?.destroy(); t.net?.destroy(); t.planner?.destroy();
    t.pane.remove(); t.tabBtn.remove();
    if (t.floatWin) { t.floatWin.remove(); t.floatWin = null; }
    // [alpha.161 · K2] ★ เดิม `[...keys].pop()` = แท็บท้ายแถวเสมอ (ปิดแท็บกลางแล้วกระโดดไปท้าย ·
    // ปิดแท็บที่ไม่ได้เลือกก็ยังแย่งโฟกัส) → เพื่อนบ้านขวา/ซ้าย · ปิดแท็บอื่น = แท็บที่เลือกอยู่ไม่เปลี่ยน
    const next = neighborAfterClose([...state.tabs.keys()], file, state.active ? state.active.file : null);
    state.tabs.delete(file);
    _closedTabs = pushClosed(_closedTabs, file, state.root);   // [alpha.162 · W4 ข้อ 11]
    closeTabInSplit(file);                               // ปิดไฟล์ที่แสดงอยู่ในช่องไหน → ยุบช่องนั้นด้วย
    if (next) activate(next); else { state.active = null; refreshToolbar(); updateDirtyBadge(); syncPropsToActive().catch(() => {}); renderCrumbs().catch(() => {}); }
    markSessionDirty();                        // [alpha.79] ปิดแท็บสุดท้ายก็ต้องจำ (activate ไม่ถูกเรียก)
  };
  if (!t.dirty || discard) { t.dirty = false; done(); return; }
  // [alpha.156] บันทึกล้ม = **ไม่ปิดแท็บ** และบอกผู้ใช้ (เดิมไม่มี catch: แท็บค้าง + promise rejection เงียบ)
  const saveThenClose = () => saveTab(t).then((r) => {
    if (r === false) { setStatus(tt('ui.app.saveCancelledKeepTab')); return; }   // [alpha.156] ไม่ได้บันทึก = ไม่ปิด
    done();
  }, (e) => {
    log('error', tt('ui.app.saveBeforeCloseFail') + (t.title || file), e);
    setStatus(tt('ui.app.saveBeforeCloseFail') + (t.title || file));
  });
  if (!ask) { saveThenClose(); return; }             // ทางเรียกภายใน = พฤติกรรมเดิม (บันทึกให้)
  choose(ttf('ui.app.closeTabDirtyAsk', t.title || file), [
    { label: tt('ui.app.closeTabSave'), value: 'save', primary: true },
    { label: tt('ui.app.closeTabDiscard'), value: 'discard', danger: true },
    { label: tt('ui.common.cancel'), value: null },
  ]).then((v) => {
    // [alpha.159 · H2] ต้องผ่าน saveThenClose — เดิม `saveTab(t).then(done)` ปิดแท็บทิ้งแม้บันทึกคืน false
    // (ผู้ใช้กดยกเลิกในกล่อง "ไฟล์ถูกแก้นอกโปรแกรม") = งานที่พิมพ์หายทั้งก้อน
    if (v === 'save') saveThenClose();
    else if (v === 'discard') { t.dirty = false; updateDirtyBadge(); done(); }
    // null/Esc = ไม่ปิด ไม่บันทึก — แท็บอยู่เหมือนเดิมทุกประการ
  });
}

// ══ [alpha.149] ★ สะพาน "ไฟล์นี้เปิดอยู่ในแท็บไหม" ══
//
// ผู้ใช้เจอ: สั่ง AI เขียนต่อท้ายฉากที่เปิดอยู่ → ไฟล์ได้ข้อความ แต่แท็บยังถือของเก่า → กดบันทึก = หาย
// (วัดจริงบนหน้าต่างโปรแกรม) · ตัวไล่แก้ชื่อเอนทิตี้อัตโนมัติก็เป็นแบบเดียวกัน
// ai-actions.js / auto-task ถามผ่าน `tab-bridge.js` แล้วแก้ "ผ่านแท็บ": ค้างการแก้ = ลงแท็บอย่างเดียว ·
// ไม่ค้าง = เขียนดิสก์แล้วโหลดแท็บใหม่ (ไม่มีใครบันทึกงานของผู้ใช้แทนเขาเงียบ ๆ)
function tabHandleOf(t) {
  if (!t) return null;
  if (t.wiki) {
    return {
      kind: 'wiki',
      get dirty() { return !!(t.dirty || t.wiki.dirty); },
      getText: () => '', setText() {}, rename() {},
      reloadFromDisk: async () => { await t.wiki.reloadIfExists(); },
      close: () => closeTab(t.file, { discard: true }),
    };
  }
  if (!t.editor && !t.sp) return null;
  const paintTitle = () => {
    const el0 = t.tabBtn && t.tabBtn.querySelector('.tab-title');
    if (el0) el0.textContent = (t.dirty ? gi('dot') + ' ' : '') + t.title;
  };
  return {
    kind: t.sp ? 'sp' : 'prose',
    get dirty() { return !!t.dirty; },
    getText: () => (t.editor ? t.editor.getMarkdown() : t.sp.getMarkdown()),
    setText(body, opts = {}) {
      if (t.editor) {
        const am = opts.keepAlign && t.editor.getAlignMap ? t.editor.getAlignMap() : undefined;
        t.editor.setMarkdown(body, am);
        try { refreshMentions(t.editor.view); } catch {}
      } else {
        t.sp.setMarkdown(body);
      }
      markDirty(t);                               // ยังไม่ลงไฟล์ — ผู้ใช้เป็นคนบันทึกเอง
      try { scheduleCount(); } catch {}
    },
    async reloadFromDisk() {
      const { meta, body } = parseMdFile(await kapi.readFile(t.file));
      t.meta = meta; t.body = body; t.diskBody = body;
      if (t.editor) {
        t.editor.setMarkdown(body, alignFromString(meta.align));
        try { refreshMentions(t.editor.view); } catch {}
      } else {
        t.sp.setMarkdown(body);                   // SPEditor ยิง onChange → markDirty → ล้างธงข้างล่าง
        try { t.sp.applyAlignMap(alignFromString(meta.align)); } catch {}
      }
      t.dirty = false;
      paintTitle();
      updateDirtyBadge();
      try { scheduleCount(); } catch {}
    },
    rename(title) {
      t.title = title;
      if (t.meta) t.meta.title = title;           // ไม่งั้นบันทึกทีหลังเขียนชื่อเก่ากลับลงไฟล์
      paintTitle();
    },
    close: () => closeTab(t.file, { discard: true }),
  };
}
// [alpha.164] ฉากมีปัญหา — ตัวเชื่อม (onset-ui.js ไม่ import app.js วนกลับ)
installOnset({
  sceneCtx: (f) => sceneCtx(f), openScene: (f, title) => openScene(f, title), buildTree: () => buildTree(),
  alignFromString, tabBodyText: (tab) => tabBodyText(tab),
  afterSwap: (tab) => {
    if (state.active !== tab) return;
    scheduleCount(); scheduleOutline(); scheduleRepaginate(); refreshToolbar();
    try { refreshSpView(); updatePageNumberHint(); } catch {}
  },
});
setTabBridge({
  find(p) {
    const k = pathKey(p);
    for (const t of state.tabs.values()) {
      if (t.file && !String(t.file).startsWith('::') && pathKey(t.file) === k) return tabHandleOf(t);
    }
    return null;
  },
  // [alpha.159 · H5] ตัวกลางตัวเดียวกับทางคลิก — บันทึกงานค้างก่อนปิด (เดิมปิดแบบทิ้ง = งานหาย)
  // รับได้ทั้งโฟลเดอร์และไฟล์เดี่ยว (ฉาก/หน้า Wiki ที่ AI ลบ)
  closeUnder(dir) { return closeTabsUnderPath(dir, { save: true }); },
});

// [80] Revert — ยกเลิกการเปลี่ยนแปลงทั้งหมด โหลดใหม่จากดิสก์
export async function revertTab(file) {
  const t = state.tabs.get(file);
  if (!t) return;
  if (!(await confirmBox(tt('ui.app.cancelChangeAllTab'), tt('ui.common.revertBtn')))) return;
  const content = await kapi.readFile(file);
  const { meta, body } = parseMdFile(content);
  t.diskBody = body;                             // [alpha.156] ย้อนกลับ = เนื้อบนดิสก์คือฐานใหม่
  // [alpha.58r บั๊ก 25] จัดหน้าอยู่ใน frontmatter แล้ว → คืนค่ามาพร้อมเนื้อหาด้วย
  if (t.editor) { t.editor.setMarkdown(body, alignFromString(meta.align)); refreshMentions(t.editor.view); }
  else if (t.sp) {
    // [แก้บั๊ก] ของเดิมอ้างชื่อที่ **ไม่มีอยู่จริงสามตัว** (`getSpellchecker` · `resolvePath` ·
    // `openWikiEntity`) — กฎเหล็กข้อ 1 เป๊ะ ๆ: esbuild ปล่อยผ่านเป็น global ตอน build แล้วโยน
    // ReferenceError ตอนกดจริง · ร้ายกว่านั้นคือ `t.sp.destroy()` ทำงานไปก่อนแล้ว
    // → กด "ยกเลิกการเปลี่ยนแปลง" บนแท็บบทภาพยนตร์ = ตัวแก้ไขหายทั้งแท็บ
    // อีกจุด: mount ที่ `.pane.on` ซึ่งไม่เคยเป็นลูกของ pane (คืน null เสมอ) → ตกไปลง pane ตรง ๆ
    // ข้าม `.workspace` ทำให้กระดาษ/ซูมเพี้ยน · ตอนนี้ใช้ตัวเลือกชุดเดียวกับ `mountEditor` ทั้งหมด
    const dir = file.replace(/[\\/][^\\/]*$/, '');
    t.sp.destroy();
    t.sp = new SPEditor(t.pane.querySelector('.workspace') || t.pane, {
      // [alpha.62 บั๊ก 19] `smartDirty()` ไม่มีอยู่จริง — ที่นี่พังทุก keystroke หลังกด Revert บนบทหนัง
      markdown: body,
      onChange: () => { markDirty(t); scheduleCount(); scheduleOutline();
                        scheduleSpSmart(t); scheduleRepaginate(); },
      onElement: (elName) => { spSmartCheck(t); setElementBadge(elName); },
      onKeyDown: (ev) => { repaginateOnEnter(t, ev); return smart.onKey(ev); },
      getChecker: spellChecker,
      resolveSrc: (p) => resolveImg(dir, p),
      getNames: () => state.settings.autoMention !== false ? smart.names : [],
      onMention: (name) => { if (smart.fileOf[name]) openEntity(smart.fileOf[name]); },
      editable: () => !t.locked && !t._onsetSaved,     // ล็อกฉากอยู่ = revert แล้วต้องยังล็อกเหมือนเดิม
    });
    // [alpha.125 ข้อ I] Revert = โหลดจากดิสก์ใหม่ → คืนการจัดหน้าที่บันทึกไว้ด้วย
    try { t.sp.applyAlignMap(alignFromString(t.meta.align)); } catch {}
    t.sp.view.dom.classList.add('on');
    applyOnsetToTab(t).catch(() => {});      // [alpha.164] ตัวแก้ไขตัวใหม่ = ติดตั้งการเทียบกลับ
  }
  else if (t.wiki) { t.wiki.destroy(); openEntity(t.title); return; }
  else if (t.plain) { t.plain = false; openPlainFile(file, t.title); return; }
  t.dirty = false;
  refreshAllSpell(); refreshAllMentions();
  setStatus(tt('ui.app.backVersionLatestSave'));
}

// [76] Remove Elements by Type — ลบ element ทั้งหมดของประเภทที่เลือก
//
// [alpha.62 บั๊ก 19] ของเดิม "กดแล้วไม่มีอะไรเกิดขึ้น" ได้หลายทางโดยไม่บอกอะไรเลย:
//   · ไม่ได้เปิดบทภาพยนตร์อยู่ → ขึ้นข้อความจาง ๆ บนแถบล่างแล้วจบ (คนกดจากเมนูไม่มีทางเห็น)
//   · `snapshotFile` โยน error กลางทาง → onclick เป็น async ที่ไม่มีใครจับ = **เงียบสนิท**
//     กล่องยังค้าง ปุ่มลบเหมือนเสีย (นี่คือทางที่เจอบ่อยสุด — โปรเจกต์ที่เขียนโฟลเดอร์ Snapshots ไม่ได้)
//   · บรรทัดว่างในบทถูกเก็บเป็น element `action` เปล่า → "บรรยาย" ขึ้นเลขบวมจนน่ากลัว
//     และถ้ากดลบจริง บรรทัดเว้นวรรคทั้งบทหายเกลี้ยง (ผลลัพธ์ไม่ใช่ที่ตั้งใจแน่นอน)
/** @param {{silent?:boolean}} [opts] silent = ไม่เปิดกล่อง (เทสเรียกตรง) */
export async function removeElementsDialog(opts = {}) {
  const sp = state.active?.sp;
  if (!sp) {
    // ดังพอให้คนที่กดจากเมนูเห็น — เดิมบอกที่แถบล่างอย่างเดียว
    setStatus(tt('ui.app.openSceneScreenplayBeforeDel'));
    if (!opts.silent) infoBox(tt('ui.app.cmdUseScreenplayOpenScene'));   // [alpha.162 · W4]
    return null;
  }
  const v = sp.view;
  // นับแยก "ของจริง" กับ "บรรทัดว่าง" — บรรทัดว่างคือโครงหน้ากระดาษ ไม่ใช่เนื้อหาที่คนอยากลบ
  const counts = {}, blanks = {};
  v.state.doc.forEach((n) => {
    if (n.type.name !== 'sp') return;
    const k = n.attrs.el;
    if (!n.textContent.trim()) { blanks[k] = (blanks[k] || 0) + 1; return; }
    counts[k] = (counts[k] || 0) + 1;
  });
  const types = Object.keys(counts).filter((k) => SP_ELEMS[k]);
  if (!types.length) {
    setStatus(tt('ui.app.chapterNotHasElement'));
    if (!opts.silent) infoBox(tt('ui.app.chapterNotHasElement'));        // [alpha.162 · W4]
    return null;
  }

  /** ลบจริง — แยกออกมาให้เทสเรียกได้ตรง ๆ และให้ทุก error ถูกจับ */
  const doRemove = async (sel) => {
    const tab = state.active;
    if (tab && tab.locked) { setStatus(gi('lock') + ' ' + TA.lockMessage('scene')); return 0; }   // [alpha.164 · บั๊ก]
    // snapshot เป็นของแถม — ห้ามทำให้การลบล้มเหลว (บั๊กเดิมล้มทั้งคำสั่งเพราะตรงนี้)
    try {
      if (tab) await snapshotFile(tab.file, tt('ui.app.beforeDel') + sel.map((x) => elemLabel(x)).join(','));
    } catch (e) { log('warn', tt('ui.app.removeElementsKeepVersion'), e); }
    if (!sp.view || sp.view.isDestroyed) { setStatus(tt('ui.app.itemEditCloseDone')); return 0; }
    const view = sp.view;
    const delSet = new Set(sel);
    const toRemove = [];
    view.state.doc.forEach((n, pos) => {
      // ลบเฉพาะบล็อกที่ "มีเนื้อหา" — บรรทัดว่างไม่ใช่เป้าหมาย
      if (n.type.name === 'sp' && delSet.has(n.attrs.el) && n.textContent.trim())
        toRemove.push({ pos, size: n.nodeSize });
    });
    if (!toRemove.length) { setStatus(tt('ui.app.notFoundElementAt')); return 0; }
    let tr = view.state.tr;
    // ลบจากท้ายมาต้น — ตำแหน่งของตัวที่ยังไม่ถูกลบจึงไม่ขยับ
    for (const { pos, size } of toRemove.slice().reverse()) tr = tr.delete(pos, pos + size);
    view.dispatch(tr);
    // [alpha.62 บั๊ก 19] **ต้นเหตุจริงของ "ลบ element ตามประเภท ใช้ไม่ได้"**
    // บรรทัดนี้เคยเรียก `smartDirty()` ซึ่ง **ไม่มีอยู่จริงในโปรเจกต์เลย** (ไม่เคยถูกประกาศที่ไหน)
    // → ReferenceError กลางทาง · dispatch ลบไปแล้วแต่ `ov.remove()` กับ setStatus ไม่ได้ทำงาน
    // ผู้ใช้เห็นกล่องค้างอยู่กับที่ ไม่มีข้อความอะไร = "กดลบแล้วไม่มีอะไรเกิดขึ้น"
    if (tab) { markDirty(tab); scheduleSpSmart(tab); scheduleRepaginate(); }
    setStatus(ttf('ui.app.delElementDoneCancel', toRemove.length));
    return toRemove.length;
  };
  if (opts.silent) return { types, counts, blanks, doRemove };

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog');
  box.innerHTML = ((a) => `<div class="k-dlg-title">${tx('ui.app.delElementType')}</div>
    <div class="k-hint" style="margin-bottom:10px">${tx('ui.app.pickTypeElementNeed')}
      <br>${tx('ui.app.onlyLineHasBody')}</div>
    <div id="rm-el-list"></div>
    <div style="margin-top:8px"><a href="#" id="rm-el-all">${tx('ui.menu.pickAll')}</a> · <a href="#" id="rm-el-none">${tx('ui.app.notPick')}</a></div>
    <div class="k-dlg-total dim" style="margin-top:8px"></div>
    <div class="k-dlg-btns"><button class="k-cancel">${a[0]}</button><button class="k-ok k-danger" disabled>${tx('ui.common.del')}</button></div>`)([t('dialogs.cancel')]);
  ov.append(box); document.body.append(ov);
  const list = box.querySelector('#rm-el-list');
  const totalEl = box.querySelector('.k-dlg-total');
  const okBtn = box.querySelector('.k-ok');
  const chks = [];
  const syncTotal = () => {
    const sel = chks.filter((c) => c.checked);
    const n = sel.reduce((s, c) => s + (counts[c.value] || 0), 0);
    totalEl.textContent = n ? ttf('ui.app.delAllLine', n) : tt('ui.app.cantPick');
    okBtn.disabled = !n;                       // ปุ่มลบกดไม่ได้ตอนยังไม่เลือก = ไม่ใช่ "กดแล้วไม่มีอะไรเกิดขึ้น"
  };
  for (const ty of types) {
    const label = el('label', 'k-row');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer';
    const cb = el('input'); cb.type = 'checkbox'; cb.value = ty; chks.push(cb);
    cb.onchange = syncTotal;
    label.append(cb, el('span', null, ttf('ui.app.line', elemLabel(ty), counts[ty])));
    list.append(label);
  }
  syncTotal();
  box.querySelector('#rm-el-all').onclick = (e) => { e.preventDefault(); chks.forEach((c) => { c.checked = true; }); syncTotal(); };
  box.querySelector('#rm-el-none').onclick = (e) => { e.preventDefault(); chks.forEach((c) => { c.checked = false; }); syncTotal(); };
  box.querySelector('.k-cancel').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  okBtn.onclick = async () => {
    // ทุกอย่างในนี้ห้ามหลุดเป็น unhandled rejection — ไม่งั้นกล่องค้างแบบเงียบ ๆ เหมือนบั๊กเดิม
    try {
      const sel = chks.filter((c) => c.checked).map((c) => c.value);
      if (!sel.length) return;
      const n = sel.reduce((s, k) => s + (counts[k] || 0), 0);
      const names = sel.map((k) => elemLabel(k)).join(', ');
      if (!(await confirmBox(ttf('ui.app.delAllLine2', names, n), tt('ui.common.del')))) return;
      ov.remove();
      await doRemove(sel);
    } catch (e) {
      log('error', tt('ui.app.removeElementsFail'), e);
      ov.remove();
      setStatusError(tt('ui.app.delElementNotOk') + errText(e));
    }
  };
  return ov;
}

// [75] Character Map — Latin-1 special characters dialog
async function showCharMap() {
  const LATIN1 = [
    'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß',
    'àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ',
    '¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿',
  ];
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog');
  box.innerHTML = ((a) => `<div class="k-dlg-title">${tx('ui.app.mapChar2')}</div>
    <div class="k-charmap"></div>
    <div class="k-dlg-btns"><button class="k-ok">${a[0]}</button></div>`)([t('dialogs.close')]);
  ov.append(box); document.body.append(ov);
  const grid = box.querySelector('.k-charmap');
  for (const row of LATIN1) {
    const r = el('div', 'k-cm-row');
    for (const ch of row) {
      const btn = el('button', 'k-cm-btn', ch);
      btn.title = 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      btn.onclick = () => {
        const ed = getActiveEditor();
        if (ed?.view) {
          ed.view.dispatch(ed.view.state.tr.insertText(ch));
          ed.view.focus();
        }
      };
      r.append(btn);
    }
    grid.append(r);
  }
  box.querySelector('.k-ok').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

async function closeAllTabs() {
  // [alpha.124 ข้อ 17] เดิมบังคับบันทึกทุกแท็บเงียบ ๆ แล้วปิด — ตอนนี้ถามครั้งเดียวด้วยกล่อง
  // "บันทึกทั้งหมด" ที่มีอยู่แล้ว (เลือกได้ว่าจะเก็บไฟล์ไหน) ไม่ใช่เด้งกล่องทีละแท็บ n ใบ
  const dirty = [...state.tabs.values()].filter((t) => t.dirty);
  if (dirty.length) {
    const { action, keys } = await saveAllDialog(dirtyTabList(),
      { title: ttf('ui.app.closeAllDirtyAsk', dirty.length) });
    if (action === null) return;                       // ยกเลิก = ไม่ปิดอะไรเลยสักแท็บ
    // [alpha.160 · P0-2] แท็บที่ติ๊กบันทึกแต่บันทึกไม่ผ่าน (กดยกเลิกกล่องชนกับดิสก์ · เขียนไม่ได้)
    // **ห้ามปิดแบบ discard** — เดิมปิดทุกแท็บทิ้งหลังวนบันทึก = งานของแท็บนั้นหายถาวร
    const pick = action === 'save' ? new Set(keys) : null;
    const failed = new Set();
    if (pick) for (const t of dirty) if (pick.has(t.file) && !(await flushTab(t, (t2) => saveTab(t2)))) failed.add(t.file);
    const { close, keep } = tabsSafeToClose([...state.tabs.values()].map((t) => ({ file: t.file, dirty: !!t.dirty })),
                                            pick, failed);
    for (const f of close) closeTab(f, { discard: true });
    if (keep.length) setStatus(ttf('ui.app.closeAllKeptUnsaved', close.length, keep.length));
    return { closed: close.length, kept: keep.length };
  }
  const all = [...state.tabs.keys()];
  for (const f of all) closeTab(f, { discard: true });
  return { closed: all.length, kept: 0 };
}

// ---------------- แยกหน้าจอเทียบเอกสาร (compare / split) ----------------
// "เปิดเทียบด้านขวา" กับ "Split View" ใช้กลไกเดียวกันคือ SplitManager (บั๊ก #1)
// เดิมเส้นทางนี้เขียน state.compareFile + คลาส .compare-on เอง จึงได้แค่ 2 ช่องและหลุดง่าย
function applyCompare(rightFile) {
  const rt = state.tabs.get(rightFile);
  if (!rt) return;
  openInSplit(rightFile, 'right');
  setStatus(tt('ui.app.modeCompareDoc') + (state.active?.title || '') + '  ⇋  ' + rt.title);
}
// เปิด "เวอร์ชันที่บันทึกไว้" เป็นแท็บอ่านอย่างเดียวแล้ววางไว้ฝั่งขวาคู่กับฉากปัจจุบัน (ข้อ 7)
// ทำให้ "เทียบเวอร์ชันแบบ split view ด้านขวา" ใช้ได้จริง ไม่ใช่แค่กล่องโต้ตอบสองคอลัมน์
export async function openSnapshotRight(curFile, snap) {
  const key = '::snap::' + snap.path;
  const title = gi('clock-9') + ' ' + (snap.label || fmtTs(snap.ts));
  if (!state.tabs.has(key)) {
    let body = '';
    try { body = parseMdFile(await kapi.readFile(snap.path)).body; } catch { body = tt('ui.app.readFileVersionCant'); }
    const pane = el('div', 'pane');
    const bar = el('div', 'json-bar');
    bar.append(el('span', 'dim', title + tt('ui.app.read')));
    const ta = el('textarea', 'plain-md'); ta.value = body; ta.readOnly = true;
    pane.append(bar, ta);
    $('#panes').append(pane);
    const tabBtn = el('div', 'tab');
    tabBtn.append(el('span', 'tab-title', title));
    const x = el('span', 'tab-x', gi('times')); tabBtn.append(x);
    $('#tabs').append(tabBtn);
    const tab = { file: key, title, pane, tabBtn, dirty: false,
                  editor: null, plain: null, wiki: null, isJson: true, readOnly: true,
                  save: async () => true };
    tabBtn.onclick = (e) => { if (e.target !== x) activate(key); };
    x.onclick = () => closeTab(key);
    state.tabs.set(key, tab);
  }
  // ฉากปัจจุบันต้องเปิดอยู่ฝั่งซ้าย ไม่งั้นเทียบกับอะไรไม่รู้
  if (curFile && state.tabs.has(curFile)) activate(curFile);
  applyCompare(key);
  return key;
}

function clearCompare() { closeSplit(); }
// เปิดไฟล์นี้ไว้ "ด้านขวา" คู่กับเอกสารที่เปิดอยู่ (เทียบกันแบบ Photoshop compare)
// [alpha.155] รับไฟล์ตรง ๆ — "Split view" ในเมนูของฉากและ Memo ใช้ตัวนี้ตัวเดียว
async function openCompareRight(file, title) {
  const left = state.active?.file;
  if (!left || left === file) { return openScene(file, title); }      // ไม่มีคู่เทียบ → เปิดปกติ
  if (!state.tabs.has(file)) await openScene(file, title);
  activate(left);                                                     // คงเอกสารเดิมเป็นฝั่งซ้าย
  applyCompare(file);
}


// ดับเบิลคลิกหัวแท็บ = แยกเป็นหน้าต่างลอย / คืนกลับ · คลิกขวา = เมนู
function bindTabStripMenus() {
  const strip = $('#tabs');
  if (!strip || strip._floatBound) return;
  strip._floatBound = true;
  // [alpha.162 · W4 ข้อ 11] แท็บล้นแถบ → ปุ่ม "แท็บทั้งหมด" ท้ายแถบ (แถบเลื่อนแนวนอนได้ แต่แท็บที่ตก
  // ขอบขวาไม่มีอะไรบอกเลยว่ายังมีอยู่) · ปุ่มนี้ **ไม่ใช่ `.tab`** และติด CSS `order` ให้อยู่ท้ายเสมอ
  // ไม่ว่าแท็บใหม่จะถูก append ต่อท้าย DOM กี่ตัว
  const more = el('span', 'k-tabs-more', gi('more'));
  more.title = tt('ui.tabs.overflowList');
  more.setAttribute('role', 'button');
  more.onclick = (e) => {
    e.stopPropagation();
    const r = more.getBoundingClientRect();
    popupMenu(r.left, r.bottom, [...state.tabs.entries()].map(([f, t]) => ({
      text: (t.dirty ? gi('dot') + ' ' : '') + (t.title || f),
      checked: state.active && state.active.file === f,
      click: () => { activate(f); try { t.tabBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {} },
    })));
  };
  strip.append(more);
  const syncMore = () => more.classList.toggle('on', strip.scrollWidth > strip.clientWidth + 1);
  try { new ResizeObserver(syncMore).observe(strip); } catch {}
  new MutationObserver(syncMore).observe(strip, { childList: true });
  syncMore();
  // [alpha.162 · W4 ข้อ 11] คลิกกลาง = ปิดแท็บ (ถามก่อนถ้ายังไม่บันทึก เหมือนกดปุ่ม ×)
  // mousedown ปุ่มกลางต้องกันไว้ด้วย ไม่งั้นเบราว์เซอร์เข้าโหมดเลื่อนอัตโนมัติ
  strip.addEventListener('mousedown', (e) => { if (e.button === 1 && e.target.closest('.tab')) e.preventDefault(); });
  strip.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    const btn = e.target.closest('.tab');
    if (!btn) return;
    e.preventDefault();
    const [f, t] = tabByBtn(btn);
    if (f && !(t && t.pinned)) closeTab(f, { ask: true });   // แท็บที่ปักหมุดไม่ปิดด้วยคลิกกลาง (ปุ่ม × ก็ซ่อน)
  });
  strip.addEventListener('dblclick', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || e.target.classList.contains('tab-x')) return;
    const [f] = tabByBtn(btn);
    if (f) toggleFloatTab(f);
  });
  strip.addEventListener('contextmenu', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    e.preventDefault();
    const [f, t] = tabByBtn(btn);
    if (!f) return;
    popupMenu(e.clientX, e.clientY, [
      t.floatWin ? { label: tt('ui.app.restoreTab2'), click: () => dockTab(f) }
                 : { label: tt('ui.app.splitWindowFloat'), click: () => floatTab(f) },
      { label: tt('ui.app.closeTab'), click: () => closeTab(f, { ask: true }) },
      // [alpha.161 · K2] ปิดหลายแท็บ · คัดลอกทาง · แสดงในต้นไม้
      { label: tt('ui.tabs.closeOthers'), disabled: state.tabs.size < 2, click: () => closeTabsExcept(f) },
      { label: tt('ui.tabs.closeRight'), disabled: !tabsRightOf([...state.tabs.keys()], f).length,
        click: () => closeTabsList(closableOf(tabsRightOf([...state.tabs.keys()], f), pinnedTabs())) },
      { label: tt(t.pinned ? 'ui.tabs.unpin' : 'ui.tabs.pin'), disabled: String(f).startsWith('::'),
        click: () => setTabPinned(f, !t.pinned) },
      // [alpha.162 · W4 ข้อ 11]
      { label: tt('ui.shortcuts.reopenClosedTab'), click: () => reopenClosedTab() },
      '-',
      { label: tt('ui.tabs.copyPath'), disabled: String(f).startsWith('::'), click: () => copyTabPath(f) },
      { label: tt('ui.tabs.revealInTree'), disabled: !isTreeFile(f), click: () => revealInTree(f) },
    ]);
  });
}

// ───────── [alpha.161 · K2] แท็บเอกสาร: tooltip · ลากสลับ · ปิดหลายแท็บ · วนแท็บ ─────────
/** tooltip ของแท็บ = ชื่อเต็ม + ทางสัมพัทธ์ + เล่ม/บท (ชื่อยาวถูกตัดบนแถบ ผู้ใช้เลยไม่รู้ว่าแท็บไหนคือไฟล์ไหน) */
function applyTabTooltip(t2) {
  if (!t2 || !t2.tabBtn) return;
  const p = tabPathParts(state.root, t2.file);
  const lines = [t2.title || ''];
  if (p.rel) lines.push(p.rel);
  if (p.book && p.chapter) lines.push(ttf('ui.tabs.inBookChapter', p.book, p.chapter));
  else if (p.book) lines.push(ttf('ui.tabs.inBook', p.book));
  t2.tabBtn.title = lines.filter(Boolean).join('\n');
}
/** เรียงแท็บตามลำดับใหม่ — ทั้งแถบ (DOM) และ state.tabs (ลำดับของ Map = ลำดับที่ทุกทางใช้ เช่น Ctrl+Tab · บันทึกเซสชัน) */
export function reorderTabs(keys) {
  const next = new Map();
  // [alpha.162 · W4 ข้อ 11] แท็บที่ปักหมุดอยู่หน้าแถบเสมอ — ลากแท็บธรรมดาแทรกหน้าหมุดก็ถูกจัดกลับ
  const all = [...keys, ...[...state.tabs.keys()].filter((k) => !keys.includes(k))];
  keys = pinnedFirst(all, [...state.tabs.entries()].filter(([, t]) => t.pinned).map(([f]) => f));
  for (const k of keys) if (state.tabs.has(k)) next.set(k, state.tabs.get(k));
  for (const [k, v] of state.tabs) if (!next.has(k)) next.set(k, v);
  state.tabs.clear();
  for (const [k, v] of next) state.tabs.set(k, v);
  const strip = $('#tabs');
  if (strip) for (const v of state.tabs.values()) if (v.tabBtn && v.tabBtn.parentNode === strip) strip.appendChild(v.tabBtn);
  markSessionDirty();
  return [...state.tabs.keys()];
}
/** ลากแท็บไปวางบนแท็บอื่นในแถบเดียวกัน = แทรกก่อนแท็บนั้น (ไม่แตะ split view — ลากได้เฉพาะใน #tabs) */
function wireTabDrag(t2) {
  const b = t2 && t2.tabBtn;
  if (!b || b._k2drag) return;
  b._k2drag = true;
  b.draggable = true;
  b.addEventListener('dragstart', (e) => {
    if (!b.parentNode || b.parentNode.id !== 'tabs') { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/k2-tab', t2.file);
    b.classList.add('k-tab-dragging');
  });
  b.addEventListener('dragend', () => { b.classList.remove('k-tab-dragging'); document.querySelectorAll('#tabs .k-tab-drop').forEach((x) => x.classList.remove('k-tab-drop')); });
  b.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes('text/k2-tab')) return;
    e.preventDefault(); b.classList.add('k-tab-drop');
  });
  b.addEventListener('dragleave', () => b.classList.remove('k-tab-drop'));
  b.addEventListener('drop', (e) => {
    const src = e.dataTransfer.getData('text/k2-tab');
    b.classList.remove('k-tab-drop');
    if (!src || src === t2.file || !state.tabs.has(src)) return;
    e.preventDefault();
    reorderTabs(moveTabBefore([...state.tabs.keys()], src, t2.file));
  });
}
async function closeTabsList(files) {
  for (const f of files) if (state.tabs.has(f)) closeTab(f, { ask: true });
}
// [alpha.162 · W4 ข้อ 11] แท็บที่ปักหมุดไม่โดน "ปิดแท็บอื่น/ปิดทางขวา" (ปิดเองทีละแท็บได้ตามปกติ)
function closeTabsExcept(keep) { return closeTabsList(closableOf([...state.tabs.keys()].filter((k) => k !== keep), pinnedTabs())); }
/** แท็บที่ปักหมุดอยู่ ตามลำดับบนแถบ */
export function pinnedTabs() { return [...state.tabs.entries()].filter(([, t]) => t.pinned).map(([f]) => f); }
/** [alpha.162 · W4 ข้อ 11] ปัก/ถอนหมุดแท็บ — แท็บที่ปักย้ายไปหน้าแถบ · จำในเซสชัน */
export function setTabPinned(file, on) {
  const t = state.tabs.get(file);
  if (!t) return false;
  t.pinned = !!on;
  if (t.tabBtn) t.tabBtn.classList.toggle('k-tab-pinned', !!on);
  reorderTabs([...state.tabs.keys()]);                 // reorderTabs จัด "หมุดอยู่หน้า" ให้เอง + จำเซสชัน
  return true;
}
async function copyTabPath(f) {
  try { await navigator.clipboard.writeText(String(f)); setStatus(ttf('ui.tabs.pathCopied', f)); }
  catch (e) { log('warn', 'copy path', e); }
}
/** ไฟล์นี้มีแถวในต้นไม้ไหม (แท็บพิเศษ `::` ไม่มี) */
function isTreeFile(f) { return !!f && !String(f).startsWith('::') && !!state.root; }
/**
 * [alpha.161 · K4] "แสดงไฟล์ที่เปิดอยู่ในต้นไม้" — กางหมวด/บทที่พับ · เลื่อนถึงแถว · กะพริบ (ต่อยอด showPinInTree)
 * แถวถูกตัวกรองซ่อน (คำค้น/เก็บถาวร) = ล้างคำค้นแล้วลองใหม่ · Explorer ปิดอยู่ = เปิดให้
 */
export async function revealInTree(file, kind = 'scene') {
  const f = file || (state.active && state.active.file);
  if (!isTreeFile(f)) { setStatus(tt('ui.tabs.revealNone')); return false; }
  if (!isPanelOpen('tree')) { showPanel('tree'); await new Promise((r) => setTimeout(r, 60)); }
  const target = kind === 'book' ? { secPath: f } : kind === 'chapter' ? { ch: { guid: f } } : { file: f };
  const findRow = () => [...document.querySelectorAll('#tree .scene[data-path]')].find((r) => r.dataset.path === f && !r.classList.contains('pin-row'));
  if (kind === 'scene') {
    const r0 = findRow();
    if (r0 && r0.style.display === 'none') {
      const q = $('#tree-search');
      if (q && q.value) { q.value = ''; filterTree(''); }
      if (r0.classList.contains('archived')) setTreeShowArchived(true);
    }
  }
  const ok = showPinInTree({ kind }, target);
  if (!ok) setStatus(tt('ui.tabs.revealNotFound'));
  return ok;
}
/** Ctrl+Tab / Ctrl+Shift+Tab — วนตามลำดับบนแถบ */
export function cycleTabs(dir) {
  const next = cycleTab([...state.tabs.keys()], state.active ? state.active.file : null, dir);
  if (next) activate(next);
  return next;
}

// ───────── [alpha.161 · K4] breadcrumb เล่ม › บท › ฉาก เหนือเอกสาร (คลิก = แสดงในต้นไม้) ─────────
const crumbs_C = { gen: 0 };
async function renderCrumbs() {
  const host = $('#content');
  if (!host) return;
  const gen = ++crumbs_C.gen;
  let bar = host.querySelector(':scope > .k-crumbs');
  const t2 = state.active;
  const file = t2 && t2.file;
  if (!file || String(file).startsWith('::') || !state.root) { if (bar) bar.remove(); return; }
  const p = tabPathParts(state.root, file);
  let bookTitle = p.book, bookPath = '', chTitle = p.chapter, chGuid = '';
  const ctx = /[\\/]Chapters[\\/]/.test(file) && /\.md$/i.test(file) ? await sceneCtx(file).catch(() => null) : null;
  if (gen !== crumbs_C.gen) return;
  if (ctx) {
    chTitle = ctx.ch.title || chTitle; chGuid = ctx.ch.guid;
    bookPath = sectionPathOfFile(file);
    try {
      const sec = (await listSections()).find((s) => s.secPath === bookPath);
      if (sec && sec.title) bookTitle = sec.title;
    } catch {}
    if (gen !== crumbs_C.gen) return;
  }
  if (!bar) {
    bar = el('div', 'k-crumbs');
    const panes = $('#panes');                             // ใต้แถบแท็บ เหนือพื้นที่เขียน
    host.insertBefore(bar, panes && panes.parentNode === host ? panes : host.firstChild);
  }
  bar.replaceChildren();
  const seg = (text, onClick, cls) => {
    const b = el('button', 'k-crumb' + (cls ? ' ' + cls : ''), text);   // ชื่อไฟล์/ฉาก = text node (กฎข้อ 11)
    b.type = 'button';
    b.title = tt('ui.tabs.revealInTree');
    b.onclick = onClick;
    return b;
  };
  const sep = () => el('span', 'k-crumb-sep', '›');
  if (bookTitle) bar.append(seg(bookTitle, () => (bookPath ? revealInTree(bookPath, 'book') : revealInTree(file))), sep());
  if (chTitle) bar.append(seg(chTitle, () => (chGuid ? revealInTree(chGuid, 'chapter') : revealInTree(file))), sep());
  bar.append(seg(t2.title || p.rel.split('/').pop(), () => revealInTree(file), 'k-crumb-cur'));
}

// ---------------- toolbar / statusbar ----------------
const FMTS = ['bold', 'italic', 'underline', 'strike', 'sup', 'sub'];

// ตั้ง title ปุ่ม toolbar ให้แสดง shortcut (เรียกตอนเริ่ม + หลังเปลี่ยนภาษา)
function updateToolbarTitles() {
  applyCaseOptions();          // [alpha.124 ข้อ 36] ป้ายรูปตัวพิมพ์ต้องตามภาษาที่เพิ่งเปลี่ยนด้วย
  // [alpha.60r2 ข้อ 10] Ctrl+Shift+P ย้ายไปเป็น "ธีมสว่าง/มืด" — ปุ่มกระดาษไม่มีคีย์ลัดแล้ว
  applyTheme();                       // ตั้ง title/สถานะของปุ่มธีมตามภาษาปัจจุบัน
  // [alpha.147] tooltip + คีย์ลัดของทุกปุ่มมาจากทะเบียนคำสั่ง (`data-command`) ทางเดียว
  // เดิมไล่ตั้งทีละปุ่มด้วย withShortcut('toolbar.bold', 'KeyB', …) — คีย์ลัดถูกพิมพ์ซ้ำในโค้ด
  // (ไม่ตามค่าที่ผู้ใช้ตั้งเอง) และ "(Ctrl+Shift+M)" ของปุ่มโหมดเขียนตายตัวทั้งที่ตั้งใหม่ได้
  applyCommandUi();
}
// re-export ให้ core.js เรียกหลังเปลี่ยนภาษา
export { updateToolbarTitles };

// [alpha.162 · W2] ตาราง TB_PANEL_BUTTONS ถูกถอดแล้ว — ปุ่มสวิตช์ของแผงบอกตัวเองด้วย
// `data-command="toggle-panel:<id>"` (กฎ .147) · ทั้งการผูกคลิกและการติดไฟ .on เดินจากที่นั่นทางเดียว

// บั๊ก #11: ปุ่มที่ทำงานระดับโปรเจกต์/หน้าต่าง — ไม่ต้องมีฉากเปิดอยู่ก็ใช้ได้
const ALWAYS_ON_TB = new Set([
  // ══ [alpha.142 ข้อ 5] ★★ "ปุ่มเปิดโปรเจกต์ใช้ไม่ได้ ถ้าไม่มีโปรเจกต์ที่เปิดอยู่" ══
  //
  // ต้นตอ: สามปุ่มซ้ายสุดของแถบ (`open-btn` · `save-all-btn` · `search-all-btn`) มีคลาส `.tb`
  // เหมือนปุ่มจัดรูปแบบทุกตัว → ลูปข้างล่างตั้ง `.dis` ให้เมื่อ **ไม่มีตัวแก้ไขเปิดอยู่**
  // และ `#toolbar .tb.dis { pointer-events:none }` ก็ตัดคลิกทิ้งจริง ๆ
  // = เปิดโปรแกรมมาโดยยังไม่มีโปรเจกต์ → ปุ่มที่ใช้ "เปิดโปรเจกต์" นั่นแหละกดไม่ได้ (ทางตัน)
  // นี่คือบั๊ก #11 ตัวเดิมเป๊ะ ที่เคยแก้ให้ปุ่มแผงไปแล้ว แต่สามปุ่มนี้ตกสำรวจมาตลอด
  'open-btn', 'save-all-btn', 'search-all-btn',
  'tb-close', 'tb-close-all', 'tb-focus', 'tb-typewriter', 'tb-linenum', 'tb-quickopen',
  'tb-gallery', 'tb-sp-elem',
  'tb-tree-panel', 'tb-outline-panel', 'tb-props-panel', 'tb-search-panel',
  'tb-note', 'tb-panels', 'tb-kanban', 'tb-dashboard', 'tb-gsearch', 'tb-read', 'tb-ai', 'tb-ai-chat', 'tb-starter', 'tb-plug',
  'tb-ai-analyzer', 'tb-md-codes',       // [alpha.60r3 ข้อ 5 · ข้อ 6]
  // [alpha.69] สามแผงใหม่ทำงานระดับโปรเจกต์ทั้งหมด — ไม่ต้องมีฉากเปิดอยู่ก็กดได้
  'tb-codex', 'tb-history', 'tb-record',
  // [alpha.80] **ปุ่มแผงทุกตัวต้องกดได้โดยไม่ต้องเปิดฉากก่อน**
  // แผงพวกนี้อ่านจากไฟล์ทั้งผลงาน ไม่ได้ผูกกับฉากที่เปิดอยู่เลย —
  // เดิมถูก disable ไปพร้อมปุ่มจัดรูปแบบ ทำให้ "เปิดโปรแกรมมาแล้วกดแผงบทพูดไม่ได้"
  'tb-dialogue', 'tb-plugins', 'tb-dlgb', 'tb-ai-hub',
  'tb-timeline', 'tb-maps', 'tb-books', 'tb-chapters', 'tb-network', 'tb-planner', 'tb-branch',
  'tb-floorplan', 'tb-player', 'tb-gallery-board', 'tb-comments', 'tb-notes-panel', 'tb-log',
  'tb-backlinks',                              // [alpha.125 ข้อ G] อ่านทั้งโปรเจกต์ ไม่ผูกกับฉากที่เปิด
  // [alpha.162 · W5 ข้อ 4] เมนู AI (ทุกรายการในนั้นอยู่ในรายการนี้แล้วเช่นกัน) · ตั้งค่า — ไม่ผูกกับฉาก
  'tb-ai-group', 'tb-settings',
]);

// ══════ [alpha.132 ข้อ 9] ★ สีตัวอักษร — จุดเชื่อมระหว่างปุ่มบนแถบกับตัวแก้ไข ══════
//
// ผู้ใช้จริงขอมา: *"อยากเพิ่มเปลี่ยนสีตัวอักษร มี preset และ color wheel
//                  และมี save color switch และ recent used"*
//
// สีเป็นมาร์กของ ProseMirror (`color`) ที่ **มีค่าในตัว** จึงเป็นได้เฉพาะฝั่งนิยาย —
// ฝั่งบทภาพยนตร์เก็บเป็น fountain ล้วน ใส่แท็กสีลงไปแล้วอ่านกลับไม่ได้
// (กฎเดียวกับที่ alpha.35 ตัดสินให้ align ของบทเป็น session-only)
/** เปิดป๊อปอัปเลือกสีของแท็บที่เปิดอยู่ (ไม่ใช่แท็บนิยาย = ไม่ทำอะไร) */
export function openTextColorPicker(anchor) {
  const tab = state.active;
  const ed = tab && tab.editor;
  if (!ed) { setStatus(tt('ui.color.proseOnly')); return null; }
  const cur = normColor((ed.activeMarks() || {}).colorValue);
  return openColorPicker(anchor, cur, (hex) => {
    ed.cmd('color', hex);
    markDirty(tab);
    refreshToolbar();
  }, saveGlobalSetting);
}

/**
 * [alpha.150] ป๊อปอัปสีเน้นข้อความ — เดินทางเดียวกับสีตัวอักษร ต่างแค่จานสีสำเร็จกับมาร์กที่สั่ง
 * (ชุด "บันทึกไว้"/"ใช้ล่าสุด" ใช้ร่วมกับสีตัวอักษร — ผู้ใช้จำสีของตัวเองอยู่ชุดเดียว)
 */
export function openHighlightPicker(anchor) {
  const tab = state.active;
  const ed = tab && tab.editor;
  if (!ed) { setStatus(tt('ui.color.proseOnly')); return null; }
  const cur = normColor((ed.activeMarks() || {}).highlightValue);
  return openColorPicker(anchor, cur, (hex) => {
    ed.cmd('highlight', hex);
    markDirty(tab);
    refreshToolbar();
  }, saveGlobalSetting, { presets: HILITE_PRESETS, presetKey: 'ui.color.hlPresets' });
}

/**
 * [alpha.142 ข้อ 6] เมนูของรูปหนึ่งใบ — เต็มหน้า · ความกว้างเป็น % · ขอบมน · ลบ
 *
 * ทุกตัวเลือกเขียนกลับเป็น **ชื่อกำกับของมาร์กดาวน์** (`![](x "fit=page w=60% r=8")`)
 * ผ่าน `setFigureOpts()` ที่เดียว → เห็นผลทันทีบนจอ และติดไปกับไฟล์/ตัวอย่าง/PDF ด้วยกฎเดียวกัน
 */
function imageMenu(ed, pos, x, y) {
  const cur = ed.figureOpts(pos) || { fit: '', w: '', radius: '' };
  const set = (patch) => { ed.setFigureOpts(pos, patch); markDirty(state.active); scheduleCount(); };
  const tick = (on) => (on ? gi('dot') + ' ' : '   ');
  const items = [
    { text: tt('ui.imgmenu.head'), disabled: true },
    { text: tick(cur.fit === 'page') + tt('ui.imgmenu.fitPage'),
      click: () => set({ fit: 'page', w: '' }) },
    { text: tick(!cur.fit && !cur.w) + tt('ui.imgmenu.normal'),
      click: () => set({ fit: '', w: '' }) },
    '-',
  ];
  for (const w of [25, 50, 75, 100]) {
    items.push({ text: tick(!cur.fit && +cur.w === w) + tf('ui.imgmenu.widthPct', w),
                 click: () => set({ fit: '', w: String(w) }) });
  }
  items.push({ text: tt('ui.imgmenu.widthCustom'), click: async () => {
    const v = await ask(tt('ui.imgmenu.askWidth'), { value: cur.w || '100' });
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 0 && n <= 100) set({ fit: '', w: String(+n.toFixed(2)) });
    else if (v !== null && v !== undefined && String(v).trim()) setStatus(tt('ui.imgmenu.badWidth'));
  } });
  items.push('-');
  // ขอบมน — ของเดิมมนตายตัว 8px ตอนนี้เลือกได้ รวมถึง "ไม่มน"
  for (const [r, key] of [['0', 'ui.imgmenu.radius0'], ['4', 'ui.imgmenu.radius4'],
                          ['8', 'ui.imgmenu.radius8'], ['16', 'ui.imgmenu.radius16'],
                          ['24', 'ui.imgmenu.radius24']]) {
    const on = String(cur.radius === '' ? '8' : cur.radius) === r;
    items.push({ text: tick(on) + tt(key), click: () => set({ radius: r }) });
  }
  items.push('-');
  items.push({ text: tt('ui.imgmenu.remove'), danger: true,
               click: () => { ed.removeFigure(); markDirty(state.active); scheduleCount(); } });
  popupMenu(x, y, items);
}

function refreshToolbar() {
  try { syncStatusToggles(); } catch {}            // [alpha.165] ช่อง "อะไรเปิด/ปิดอยู่" บนแถบสถานะ
  const ed = state.active?.editor;
  const sp = state.active?.sp;
  const wkEd = state.active?.wiki?.secEditors?.find(({k}) => k?.view?.hasFocus())?.k
              || state.active?.wiki?.secEditors?.[0]?.k;
  const marks = ed ? ed.activeMarks() : wkEd ? wkEd.activeMarks() : {};
  for (const f of FMTS) {
    const key = { bold: 'strong', italic: 'em', underline: 'underline', strike: 'strike',
                  sup: 'sup', sub: 'sub' }[f];
    const bf = $('#tb-' + f);
    if (bf) bf.classList.toggle('on', !!marks[key]);
  }
  // ═══ [alpha.97 ข้อ 3+5] ★ ปุ่มโครงสร้างต้องบอกสถานะเหมือน B I U ═══
  // เดิมสี่ปุ่มนี้ไม่เคยติดไฟเลย ผู้ใช้จึงไม่มีทางรู้ว่า "ตอนนี้อยู่ในรายการอยู่นะ"
  // — ซึ่งเป็นครึ่งหนึ่งของเหตุผลที่รู้สึกว่ามันไม่ใช่สวิตช์ (อีกครึ่งคือกดแล้วถอดไม่ได้)
  // [alpha.98 ข้อ 4] บทภาพยนตร์มีรายการเป็น "คำนำหน้าในข้อความ" — สถานะมาจาก sp.curList()
  let spList = '';
  if (sp) { try { spList = sp.curList(); } catch {} }
  $('#tb-ul')?.classList.toggle('on', marks.list === 'ul' || spList === 'ul');
  $('#tb-ol')?.classList.toggle('on', marks.list === 'ol' || spList === 'ol');
  $('#tb-quote')?.classList.toggle('on', !!marks.quote);
  // [alpha.132 ข้อ 9] แถบใต้ตัว A = สีของช่วงที่เลือก ('' = ยังไม่กำหนดสี → ใช้สีตัวอักษรปกติ)
  {
    const cb = $('#tb-color');
    if (cb) {
      const cv = ed ? (marks.colorValue || '') : '';
      cb.dataset.color = cv;
      const bar = cb.querySelector('.tb-color-bar');
      if (bar) bar.style.background = cv || 'currentColor';
      cb.classList.toggle('on', !!cv);
    }
    // [alpha.150 ข้อ 1] แถบสีของปุ่มสีเน้นข้อความ — กฎคู่แฝดกับปุ่มสีตัวอักษรข้างบน
    const hb = $('#tb-highlight');
    if (hb) {
      const hv = ed ? (marks.highlightValue || '') : '';
      hb.dataset.color = hv;
      const bar2 = hb.querySelector('.tb-color-bar');
      if (bar2) bar2.style.background = hv || 'currentColor';
      hb.classList.toggle('on', !!hv);
    }
  }
  $('#tb-img')?.classList.toggle('on', !!marks.image);
  const sel = $('#tb-style');
  if (marks.block) sel.value = marks.block;
  // ไฮไลต์ปุ่มจัดหน้าตามบล็อกปัจจุบัน (นิยายอ่านจาก activeMarks · บทหนังจาก curAlign)
  // [alpha.130 ข้อ 3] `rangeAlign` คืน 'left' มาเองเมื่อชิดซ้ายจริง · '' = ช่วงที่เลือกปนกัน
  // → ห้ามใส่ `|| 'left'` ทับ ไม่งั้น "ปนกัน" กลายเป็น "ชิดซ้าย" แล้วปุ่มติดไฟผิดเหมือนเดิม
  const curAlign = ed ? marks.align : sp ? sp.curAlign() : null;
  for (const a of ['left', 'center', 'right', 'justify']) {
    const b = $('#tb-align-' + a); if (b) b.classList.toggle('on', curAlign === a);
  }
  const canEdit = !!(ed || sp || wkEd);
  // ตัวเลือก element บทหนัง — แสดงเฉพาะเมื่อแท็บปัจจุบันเป็นบทหนัง
  const spElem = $('#tb-sp-elem');
  if (spElem) {
    spElem.style.display = sp ? '' : 'none';
    if (sp) { try { spElem.value = sp.curElement(); } catch {} }
  }
  // alpha.57 — ตัวเลือกมุมมองหน้ากระดาษ
  // [alpha.60r2 ข้อ 5] เดิมโผล่เฉพาะแท็บบทภาพยนตร์ → คนเขียนนิยายเข้าถึงมุมมองหน้ากระดาษไม่ได้เลย
  // ทั้งที่เอนจินฝั่งนิยาย (drawProsePageView) ทำงานได้ครบตั้งแต่ alpha.58r แล้ว
  const spView = $('#sp-view-select');
  if (spView) {
    spView.style.display = (sp || ed) ? '' : 'none';
    spView.value = currentSpView();
  }
  document.querySelectorAll('.tb').forEach((b) => {
    // บั๊ก #1: ปุ่มแยกหน้าจอเคยถูกปิดไปด้วยตอนแท็บที่เปิดอยู่ไม่ใช่เอดิเตอร์ (แดชบอร์ด/ผัง/คลังรูป)
    // ทั้งที่แยกจอใช้กับแท็บพวกนั้นได้ → ใช้ได้ตราบใดที่มีแท็บเปิดอยู่อย่างน้อยหนึ่ง
    if (b.id === 'tb-split') { b.classList.toggle('dis', state.tabs.size === 0); return; }
    // บั๊ก #11: เครื่องมือระดับ "โปรเจกต์" ต้องใช้ได้แม้ยังไม่ได้เปิดฉาก
    //   (โน้ตด่วน · จัดการแผง · Kanban · ค้นทั้งโปรเจกต์ · เปิดไฟล์ด่วน · คลังรูป · โหมดต่าง ๆ)
    // เดิมโดน `dis` เพราะไม่มี editor → ผู้ใช้กดอะไรไม่ได้เลยตอนเพิ่งเปิดโปรแกรม
    if (ALWAYS_ON_TB.has(b.id)) { b.classList.remove('dis'); return; }
    b.classList.toggle('dis', !canEdit);
  });
  // [alpha.57a ข้อ 2] ปุ่มส่วนเสริมท้ายชื่อตัวละคร — ต้องตั้ง `dis` "หลัง" ลูป .tb ด้านบน
  // (ลูปนั้นตั้ง dis จาก canEdit อย่างเดียว จะลบสถานะที่เราตั้งไว้ทิ้ง)
  const spExt = $('#tb-sp-ext');
  if (spExt) {
    spExt.style.display = sp ? '' : 'none';
    let curExt = '', onChar = false;
    if (sp) { try { curExt = sp.curExtension(); onChar = sp.curElement() === 'character'; } catch {} }
    spExt.classList.toggle('dis', !onChar);
    // [alpha.149] ★ ไอคอน ไม่ใช่ข้อความ — ผู้ใช้: *"float bar ล้นจอแล้วปุ่ม ( ) ตัดเป็นสองบรรทัด"*
    // ของเดิมเขียน `textContent = curExt || '( )'` ทุกรอบ (ลบไอคอนจากทะเบียนทิ้งด้วย) และพอแถบแคบลง
    // ข้อความ "(V.O.)" ในปุ่มก็หักบรรทัด · ค่าปัจจุบันย้ายไปอยู่ tooltip + สถานะ `.on` แทน
    if (!spExt.querySelector('[data-k-icon]')) {
      spExt.replaceChildren(icon(commandIcon('ui:tb-sp-ext'), 18));
    }
    spExt.classList.toggle('on', !!curExt);
    spExt.dataset.ext = curExt;
    spExt.title = (onChar ? tt('ui.app.partNameVO') : tt('ui.app.pasteLineCharacterBefore'))
                + (curExt ? ' · ' + curExt : '');
  }
  // [alpha.84 ข้อ 3+4] สวิตช์เฉพาะโหมด — ต่อเนื่อง = บทเท่านั้น · ย่อหน้า = นิยายเท่านั้น
  const spCont = $('#tb-sp-cont');
  if (spCont) {
    spCont.style.display = sp ? '' : 'none';
    spCont.classList.toggle('on', spContinuedOn());
    spCont.classList.toggle('dis', !sp);
  }
  const tbInd = $('#tb-indent');
  if (tbInd) {
    tbInd.style.display = ed ? '' : 'none';
    tbInd.classList.toggle('on', proseIndentOn());
    tbInd.classList.toggle('dis', !ed);
  }
  applyTheme();                       // [60r2 ข้อ 10] ปุ่มธีมสะท้อนสถานะจริง
  // ปุ่มสวิตช์อื่น ๆ ต้องสะท้อนสถานะจริงด้วย ไม่งั้นจุดบอกสถานะโกหก
  $('#tb-read')?.classList.toggle('on', document.body.classList.contains('reading-mode'));
  $('#tb-split')?.classList.toggle('on', isSplit());
  $('#tb-focus')?.classList.toggle('on', document.body.classList.contains('focus-mode'));
  $('#tb-typewriter')?.classList.toggle('on', isTypewriter());
  $('#tb-linenum')?.classList.toggle('on', !!state.settings.lineNumbers);
  // ปุ่ม "เล่าด้วยภาพ" ใช้ได้เฉพาะตอนเปิดฉากอยู่ (ตารางผูกกับฉากเสมอ) — ใช้คลาส .dis
  // ตัวเดียวกับปุ่มอื่นในแถบ ไม่ใช่ .disabled (ระบบ refreshToolbar จัดการคลาสนี้อยู่แล้ว)
  $('#tb-visual')?.classList.toggle('dis',
    !(state.active && /\.md$/i.test(state.active.file || '')));
  // ══ [alpha.162 · W2] ★ ปุ่มสวิตช์ของแผง — **หาเอาจากทะเบียนคำสั่ง ไม่ใช่รายชื่อที่เขียนมือ** ══
  //
  // เดิมมีสองชุดที่ต้องดูแลคู่กัน: บรรทัด `$('#tb-x').classList.toggle('on', isPanelOpen('x'))` 16 บรรทัด
  // กับตาราง `TB_PANEL_BUTTONS` อีก 16 แถว — ผลคือปุ่มบางตัวได้ `isTornOff` บางตัวไม่ได้
  // (กดฉีกแผงไปหน้าต่างแยกแล้วปุ่มดับ ทั้งที่แผงยังเปิดอยู่) และปุ่มที่เพิ่มใหม่ก็ตกสำรวจเงียบ ๆ
  // ตอนนี้: ปุ่มไหนที่ `data-command="toggle-panel:<id>"` (กฎ .147) หรือมี `data-panel="<id>"`
  // (ปุ่มที่คำสั่งไม่ใช่ toggle-panel เช่น คลังรูป/แชท AI) = สวิตช์ของแผงนั้นโดยอัตโนมัติ
  for (const b of document.querySelectorAll('[data-command^="toggle-panel:"], [data-panel]')) {
    const pid = b.dataset.panel || String(b.dataset.command || '').slice('toggle-panel:'.length);
    if (!pid) continue;
    b.classList.toggle('on', isPanelOpen(pid) || isTornOff(pid));
  }
  $('#tb-md-codes')?.classList.toggle('on', showMarkdownCodes());
  // [alpha.79] ปุ่มที่ผู้ใช้ซ่อนไว้ ต้องซ่อนต่อทุกครั้งที่แถบถูกวาดใหม่ —
  // refreshToolbar เขียน style.display ของหลายปุ่มตามโหมดเอกสาร จึงต้องทาบทับทีหลังเสมอ
  applyToolbarConfig();       // (เรียก applyFmtbarConfig ต่อให้ด้วย — แถบลอยได้ทั้งซ่อนและเทา)
  syncFloatBarVisible();
  syncMenuToggles();          // เมนู native ติ๊กถูกตามสถานะจริง (ส่งเฉพาะตอนค่าเปลี่ยน)
}

// [alpha.58 บั๊ก 4] SmartType ต้องไม่วิ่งทุก keystroke — รวบให้จบทีเดียวหลังหยุดพิมพ์สั้น ๆ
let _smartJob = null;
function scheduleSpSmart(tab) {
  clearTimeout(_smartJob);
  _smartJob = setTimeout(() => { try { spSmartCheck(tab); } catch {} }, 90);
}

/**
 * [alpha.58 บั๊ก 4] เอกสารยาว = งานหนักต่อ keystroke สูงขึ้นตามความยาว
 * → ยืดเวลาหน่วงของงานหนัก (นับหน้า/ตรวจบท/เส้นคั่นหน้า) ให้ห่างขึ้นเมื่อไฟล์ใหญ่
 * ผลที่ผู้ใช้เห็น: ตัวเลขหน้า/ขีดแดงมาช้าลงเสี้ยววินาที แต่พิมพ์ลื่นเท่าไฟล์สั้น
 */
function heavyDelay(tab) {
  const limit = parseInt(state.settings.heavyDocBlocks, 10) || 400;
  let n = 0;
  try { n = tab.sp ? tab.sp.view.state.doc.childCount : (tab.editor ? tab.editor.view.state.doc.childCount : 0); }
  catch { n = 0; }
  // [alpha.60r2 ข้อ 3] เดิมหน่วงขั้นต่ำ 300ms → เส้นคั่นหน้า/จำนวนหน้ามาช้าจนรู้สึกว่า "โปรแกรมหน่วง"
  // เอกสารสั้น (ส่วนใหญ่) คำนวณเสร็จในไม่กี่มิลลิวินาที จึงลดเหลือ 100ms ได้โดยไม่กระทบความลื่น
  // เอกสารยาวยังยืดตามเดิม (ทีละ 300ms ต่อทุก ๆ heavyDocBlocks บล็อกที่เกิน)
  if (n <= limit) return 100;
  return Math.min(1200, 100 + Math.ceil((n - limit) / limit) * 300);
}

let countJob = null;
// [alpha.87 ข้อ E] เวลาที่ scheduleCount() ได้ "ทำงานจริง" ครั้งล่าสุด — ใช้คุมเพดานเวลารอ
let _countRunAt = 0;
// [alpha.60 ข้อ 96] ปรับหน้าใหม่อัตโนมัติ — debounce ตามช่วงเวลาที่ตั้ง
let repaginateJob = null;
/**
 * [alpha.60 ข้อ 96] "ปรับหน้าใหม่ตามช่วงเวลา" — สวิตช์ **หน่วงเวลา** ไม่ใช่สวิตช์ปิดฟีเจอร์
 *   ปิด (ค่าเริ่มต้น) = จัดหน้าทุกครั้งที่ scheduleCount ทำงาน (ทันใจ เหมือนก่อน alpha.60)
 *   เปิด             = scheduleCount ข้ามการจัดหน้า แล้วให้ job ตัวนี้ทำแทนทุก N วินาที
 * (alpha.60r: เดิม gate เขียนกลับด้าน — ปิดสวิตช์แล้ว "จำนวนหน้า/เส้นคั่นหน้า/CONTINUED"
 *  หายทั้งระบบ เพราะค่าเริ่มต้นของ spAutoPaginate คือ false)
 */
function scheduleRepaginate() {
  const s = state.settings;
  if (!s.spAutoPaginate) return;
  clearTimeout(repaginateJob);
  const ms = Math.min(60000, Math.max(1000, num(s.spPaginateInterval, 30) * 1000));
  repaginateJob = setTimeout(() => {
    const t = state.active;
    if (!t || !t.sp) return;
    repaginateNow(t);
  }, ms);
}

/**
 * [alpha.81 ข้อ 7] บอกมุมมองจัดหน้าว่าเอกสารนี้มีกี่หน้า
 * CSS ใช้ค่านี้ตั้งความสูงขั้นต่ำของกระดาษ = จำนวนหน้า × ความสูงกระดาษ (+ ช่องว่างระหว่างแผ่น)
 * → หน้าสุดท้ายเป็น "แผ่นเต็ม" เสมอ ไม่ใช่แผ่นที่ถูกตัดตรงที่เนื้อหาหมด
 * ตั้งที่ตัว pane ไม่ใช่ :root เพราะแยกจอแล้วสองช่องมีเอกสารคนละเรื่อง คนละจำนวนหน้า
 * @returns {number} จำนวนหน้าที่ตั้งจริง (0 = ไม่มี pane)
 */
export function setLayoutPageCount(tab, count) {
  const pane = tab && tab.pane;
  if (!pane) return 0;
  const n = Math.max(1, Math.round(+count || 1));
  pane.style.setProperty('--pg-count', String(n));
  renderPaperSheets(tab, n);          // [alpha.100 ข้อ 3] แผ่นกระดาษจริงต้องตามจำนวนหน้าเสมอ
  return n;
}

/**
 * ══ [alpha.100 ข้อ 3] ★★ แผ่นกระดาษจริงในมุมมองจัดหน้า ══
 *
 * ผู้ใช้: *"มุมมองแบบ layout ยังไม่มีการแบ่งหน้าแบบจริง ๆ เหมือนมุมมองหน้าคู่
 *           ยังใช้วิธีเอาหน้ากระดาษยาว ๆ มาแล้วขั่นด้วยแถบ เหมือนเดิม
 *           ต้องปรับนะ หรือปรับไม่ได้ อธิบายมาด้วย"*
 *
 * **ที่แยกแผ่นเป็น editor คนละตัวไม่ได้** — ตัวแก้ไขเป็น contenteditable ก้อนเดียว
 * เนื้อหาต้องไหลข้ามแผ่นเอง เคอร์เซอร์/การเลือก/undo ต้องข้ามแผ่นได้ · แตกเป็น N กล่อง
 * = เขียนเอนจินจัดหน้าเองทั้งตัว (รื้อแกน ProseMirror) · มุมมองหน้าคู่ทำได้เพราะมัน
 * **อ่านอย่างเดียว** — ก๊อป DOM แล้วครอบทีละหน้า (renderProseClipPages)
 *
 * **แต่ทำให้เป็นแผ่นแยกจริงบนจอได้** และเรขาคณิตรองรับอยู่แล้ว: ตั้งแต่ alpha.98 ที่
 * ล็อกความสูงหน้าไว้เป๊ะ สายเนื้อหาในโหมดนี้เรียงเป็น
 *     ขอบบน + เนื้อหน้า + [ขอบล่าง + ช่องว่าง + ขอบบน] + เนื้อหน้า + … + ขอบล่าง
 * ซึ่งยุบได้เป็น `n × สูงกระดาษ + (n−1) × ช่องว่าง` พอดี → **แผ่นที่ k อยู่ที่
 * `k × (สูงกระดาษ + ช่องว่าง)` เสมอ** ไม่ต้องวัด DOM เลย
 *
 * จึงปูแผ่นจริง n ใบไว้ข้างหลังตัวแก้ไข (แต่ละใบมีขอบ/เงา/มุมของตัวเอง) แล้วทำตัวแก้ไข
 * ให้โปร่งใส · กล่องเส้นคั่นหน้าเลิกวาด gradient ปลอมช่องว่าง → ช่วงกลางไม่มีแผ่นรอง
 * = เห็นพื้นโต๊ะจริงคั่นระหว่างแผ่น เหมือนมุมมองหน้าคู่
 *
 * ชั้นนี้ `position:absolute` + `pointer-events:none` → ไม่กินที่ในสายเนื้อหา
 * การวัด/จัดหน้าจึงไม่เปลี่ยนแม้แต่พิกเซลเดียว (สำคัญมาก — ตัววัดอ่าน DOM จริง)
 *
 * @returns {number} จำนวนแผ่นที่วาด (0 = มุมมองนี้ไม่มีแผ่น)
 */
export function renderPaperSheets(tab, count) {
  const pane = tab && tab.pane;
  if (!pane) return 0;
  const ws = pane.querySelector(':scope > .workspace');
  const old = ws && ws.querySelector(':scope > .k-paper-layer');
  // ไม่ใช่มุมมองที่มีแผ่น (ปกติ/ร่าง/หน้าคู่/ภาพรวม) → เก็บชั้นทิ้งให้เกลี้ยง
  if (!ws || !pane.classList.contains('k-paper') || !isPaperView(viewOfTab(tab))) {
    if (old) old.remove();
    dropPaperMask(ws);
    return 0;
  }
  const pm = ws.querySelector(':scope > .ProseMirror');
  if (!pm) { if (old) old.remove(); dropPaperMask(ws); return 0; }
  const fmt = spFormat();
  const pageH = Math.max(1, num(fmt.paper.height, 11) * 96);
  const gap = Math.max(8, Math.min(120, Math.round(num(state.settings.spPageGap, 28))));
  const n = Math.max(1, Math.round(+count || parseInt(pane.style.getPropertyValue('--pg-count'), 10) || 1));

  const layer = old || el('div', 'k-paper-layer');
  // ══ [alpha.100r บั๊ก 1] ★ JS ตั้งได้เฉพาะ "แนวตั้ง" เท่านั้น ══
  // แนวนอน (ซ้าย/กว้าง) เป็นหน้าที่ของ CSS ล้วน — `left:50%` + `width:var(--page-w)`
  // เท่ากับกฎที่จัด `.ProseMirror` กึ่งกลาง · เดิม JS วัด `offsetLeft/offsetWidth` มาจำไว้
  // แล้วค่านั้น **ค้าง** เมื่อผู้ใช้ซูม (ซูมไปตั้ง min-width ของ workspace ใหม่ →
  // ตัวแก้ไขถูกจัดกึ่งกลางที่พิกัดใหม่ แต่แผ่นอยู่ที่เดิม) = ตัวหนังสือหลุดออกนอกกระดาษ
  //
  // แนวตั้งปลอดภัยกว่ามาก: `pm.offsetTop` = ระยะขอบบนที่ CSS กำหนดไว้คงที่ (28px นิยาย /
  // 24px บท) ไม่ขึ้นกับความกว้างของแผงหรือระดับซูม · และค่าทั้งหมดที่นี่เป็น **พิกเซลก่อนซูม**
  // เพราะ layer อยู่ใน `.workspace` ที่ถูก `zoom` ครอบอยู่แล้ว — ซูมจึงย่อ/ขยายทั้งแผ่นและ
  // ตัวหนังสือด้วยอัตราเดียวกันโดยอัตโนมัติ ไม่ต้องคำนวณอะไรเพิ่ม
  layer.style.top = pm.offsetTop + 'px';
  layer.style.height = (n * pageH + (n - 1) * gap) + 'px';
  // สร้าง/ตัดใบให้พอดีจำนวนหน้า แล้ววางตำแหน่งใหม่ทุกใบ (เอกสาร 400 หน้าก็แค่ 400 div ว่าง)
  while (layer.children.length > n) layer.lastChild.remove();
  while (layer.children.length < n) layer.append(el('div', 'k-paper-sheet'));
  for (let i = 0; i < n; i++) {
    const sh = layer.children[i];
    sh.style.top = (i * (pageH + gap)) + 'px';
    sh.style.height = pageH + 'px';
    sh.dataset.sheet = String(i + 1);
  }
  if (!old) ws.insertBefore(layer, ws.firstChild);   // ต้องอยู่ **ก่อน** ตัวแก้ไข = อยู่ข้างหลัง
  paintFullPageSheets(tab, layer);
  setPaperMaskVars(ws, pageH, gap);
  setupPageHud(tab, pageH, gap);
  watchPaperGrowth(tab, pm, pageH, gap);
  return n;
}

/**
 * ══ [alpha.143 ข้อ 2] ★ แผ่นที่เป็น "รูปเต็มหน้า" ในมุมมองจัดหน้า — **ทาที่ตัวแผ่น** ══
 *
 * รอบแรกให้รูปในสายเนื้อหาล้นออกไปชนขอบเอง แล้วสกรีนช็อตของ e2e ฟ้องว่ายังเหลือขอบขาว
 * ราวหนึ่งบรรทัดที่หัวแผ่น — เพราะ **สายเนื้อหากับแผ่นกระดาษคลาดกันได้เล็กน้อยเป็นเรื่องปกติ**
 * (ที่ว่างท้ายหน้าถูกชดเชยด้วย `pad` ซึ่งยุบต่ำกว่าหนึ่งกล่องบรรทัดไม่ได้ — ปัญหาเดียวกับ P-1)
 *
 * แผ่นกระดาษอยู่ที่ `k × (สูงกระดาษ + ช่องว่าง)` ตายตัว → ทาภาพที่ตัวแผ่นจึงชนขอบ **เป๊ะเสมอ**
 * โดยไม่ต้องพึ่งความแม่นของสายเนื้อหาเลย · เป็นกลไกเดียวกับปกเล่ม/ปกบท (alpha.142)
 * และเดียวกับที่หน้ากระดาษแบบครอบทีละหน้าใช้ (`fullPageImages` ตัวเดียวกัน)
 * ส่วนตัวรูปในสายเนื้อหาถูกซ่อนในมุมมองนี้ (กฎใน style.css) จะได้ไม่เห็นภาพซ้อนสองชั้น
 * @returns {number} จำนวนแผ่นที่ถูกทาภาพ
 */
function paintFullPageSheets(tab, layer) {
  const sheets = layer ? [...layer.children] : [];
  if (!sheets.length) return 0;
  let map = new Map();
  try {
    const mz = tab && tab.editor ? proseMeasured(tab) : null;
    if (mz) map = fullPageImages(mz.blocks, mz.pages);
  } catch {}
  let n = 0;
  sheets.forEach((sh, i) => {
    const url = map.get(i + 1) || '';
    sh.classList.toggle('k-sheet-image', !!url);
    sh.style.backgroundImage = url ? 'url("' + String(url).replace(/"/g, '%22') + '")' : '';
    if (url) n++;
  });
  return n;
}

/**
 * ══════ [alpha.143 ข้อ 3] ★★ ผ้าคลุมพื้นโต๊ะ — "หมึกห้ามหกลงโต๊ะ" ══════
 *
 * ผู้ใช้: *"เมื่อเรากด enter หรือ ลบ แล้วข้ามหน้า ตัวหนังสือจะล้นหน้าออกมาไปโดน canvas
 *          เพราะเราไม่มี mask … ระหว่างจะ mask ขนาดเดียวกับกระดาษ หรือระยะตัดตกดี"*
 *
 * ทำไมมันล้น: ตัวแก้ไขเป็น **สายเนื้อหาเส้นเดียว** ส่วนแผ่นกระดาษเป็นชั้นพื้นหลังที่ตำแหน่ง
 * ตายตัว (`k × (สูงกระดาษ + ช่องว่าง)`) · กด Enter หนึ่งครั้ง ทุกอย่างใต้จุดนั้นเลื่อนลง
 * **ทันทีในเฟรมนั้น** แต่ตำแหน่งเส้นคั่นหน้าเพิ่งเปลี่ยนหลังจัดหน้าเสร็จ (หน่วง 100ms
 * ขึ้นไปตามความยาวเอกสาร — เอกสารยาวถึง 400ms) ระหว่างนั้นบรรทัดท้ายหน้าจึงไปนั่งบนพื้นโต๊ะ
 *
 * ★ เลือก **"เท่าขนาดกระดาษ"** ไม่ใช่ระยะตัดตก — เหตุผล:
 *   · ระยะขอบล่างของกระดาษ (1 นิ้ว = ~14 บรรทัด) **คือระยะตัดตกโดยธรรมชาติอยู่แล้ว**
 *     บรรทัดที่ล้นระหว่างรอจัดหน้ายังอยู่บน "กระดาษ" ตลอด ผู้ใช้เห็นมันเต็มตัว ไม่ได้หายไปไหน
 *     ถ้าไปเผื่อระยะตัดตกอีก = ตั้งใจปล่อยให้หมึกหกลงโต๊ะเป็นแถบ ๆ ซึ่งคืออาการที่กำลังแก้พอดี
 *   · ขอบกระดาษเป็น "ความจริง" ที่วัดได้เป๊ะและไม่ต้องเลือกตัวเลขวิเศษ (ตัดตกเท่าไรถึงพอ?)
 *
 * ★★ [alpha.143r] **ตัดที่เนื้อหา ไม่ใช่เอาแผ่นทึบไปปิด** — ผู้ใช้: *"เงาหน้ากระดาษโดนตัด
 * เลยดูแปลก ๆ เพราะมันเป็นแผ่นมาบัง · มันควรเป็น container มากกว่า"* · รอบแรกปูกล่องสีพื้นโต๊ะ
 * ทับช่องว่าง ซึ่งบังเงาของแผ่นกระดาษไปด้วย (เงาแผ่ออกนอกขอบกระดาษ) → เปลี่ยนมาใช้
 * `mask-image` บนตัวแก้ไขเอง: อะไรที่ล้นออกนอกแผ่นก็ไม่ถูกวาด ส่วนชั้นแผ่นข้างหลังวาดเงาครบ
 * เรขาคณิตเป็นคาบซ้ำอยู่แล้ว จึงส่งแค่ **สองตัวเลข** ให้ CSS ไปทำ `repeating-linear-gradient`
 * (นิยามกฎอยู่ใน style.css) — ไม่มี element เพิ่ม ไม่ต้องอัปเดตตอนเลื่อนจอ
 */
export function setPaperMaskVars(ws, pageH, gap) {
  if (!ws || !(pageH > 1)) return false;
  ws.style.setProperty('--k-pg-h', pageH + 'px');
  ws.style.setProperty('--k-pg-gap', gap + 'px');
  return true;
}
export function dropPaperMask(ws) {
  if (!ws || !ws.style) return false;
  ws.style.removeProperty('--k-pg-h');
  ws.style.removeProperty('--k-pg-gap');
  // เศษของรอบแรกที่ทำผ้าคลุมเป็น element จริง (เผื่อ DOM เก่ายังค้างอยู่ในหน้าต่างที่เปิดค้าง)
  const m = ws.querySelector ? ws.querySelector(':scope > .k-paper-mask') : null;
  if (m) m.remove();
  return true;
}

/**
 * ══ [alpha.143r ข้อ 3] ★ ป้ายบอกหน้าไปอยู่ที่แถบเลื่อน (แบบ Google Docs) ══
 *
 * ผู้ใช้: *"ลบตัวบอกหน้าไปเลยดีกว่า ไปใส่ที่ scroll bar เหมือน google doc ดีกว่า"*
 * ป้าย "หน้า N" เดิมนั่งอยู่กลางช่องว่างระหว่างแผ่น = อยู่บนพื้นโต๊ะ ซึ่งเป็นที่ที่ตอนนี้ถูก mask
 * ตัดทิ้งทั้งแถบ (และมันก็รกด้วย) · ตัวใหม่ลอยอยู่ริมขวาตรงระดับเดียวกับหัวแม่มือของแถบเลื่อน
 * โผล่ตอนเลื่อนจอแล้วจางหายเอง — ไม่กินที่ในสายเนื้อหาเลยแม้แต่พิกเซลเดียว
 */
const _pageHud = new WeakMap();         // .pane → สถานะป้ายบอกหน้า
export function setupPageHud(tab, pageH, gap) {
  const pane = tab && tab.pane;
  if (!pane || !(pageH > 1)) return null;
  let hud = pane.querySelector(':scope > .k-page-hud');
  if (!hud) { hud = el('div', 'k-page-hud'); pane.append(hud); }
  const st = _pageHud.get(pane) || {};
  st.pageH = pageH; st.gap = gap; st.hud = hud;
  if (!st.bound) {
    st.bound = true;
    // rAF throttle — เลื่อนจอยิงถี่มาก และเราต้องอ่าน DOM (rect) หนึ่งครั้งต่อเฟรมพอ
    st.onScroll = () => {
      if (st.raf) return;
      st.raf = requestAnimationFrame(() => { st.raf = 0; drawPageHud(pane); });
    };
    pane.addEventListener('scroll', st.onScroll, { passive: true });
  }
  _pageHud.set(pane, st);
  return hud;
}
/** วาดป้ายบอกหน้าใหม่ตามตำแหน่งเลื่อนปัจจุบัน — คืนเลขหน้าที่โชว์ (0 = ไม่มีอะไรให้โชว์) */
export function drawPageHud(pane) {
  const st = _pageHud.get(pane);
  if (!st || !st.hud) return 0;
  const ws = pane.querySelector(':scope > .workspace');
  const sheets = ws ? ws.querySelectorAll('.k-paper-layer > .k-paper-sheet') : [];
  if (!sheets.length) { st.hud.classList.remove('on'); return 0; }
  const r0 = sheets[0].getBoundingClientRect();
  const pr = pane.getBoundingClientRect();
  // ซูมจริงอ่านจากแผ่นเอง (ไม่ต้องรู้ว่า --page-scale เป็นเท่าไร)
  const z = r0.height > 0 ? r0.height / st.pageH : 1;
  const period = Math.max(1, (st.pageH + st.gap) * z);
  // จุดอ้างอิง = หนึ่งในสามบนของจอ (แผ่นที่ "กำลังอ่านอยู่" ตามสายตา ไม่ใช่ขอบบนสุดพอดี)
  const idx = Math.min(sheets.length,
                       Math.max(1, Math.floor((pr.top + pr.height * 0.34 - r0.top) / period) + 1));
  st.hud.textContent = tf('ui.app.pageOf', idx, sheets.length);
  const max = Math.max(1, pane.scrollHeight - pane.clientHeight);
  const frac = Math.min(1, Math.max(0, pane.scrollTop / max));
  st.hud.style.top = (pane.scrollTop + 22 + frac * Math.max(0, pane.clientHeight - 70)) + 'px';
  st.hud.classList.add('on');
  clearTimeout(st.hide);
  st.hide = setTimeout(() => st.hud.classList.remove('on'), 1100);
  return idx;
}

/**
 * ══════ [alpha.103 ข้อ 5] ★★ แผ่นกระดาษต้องเกิด "เฟรมเดียวกับบรรทัด" ══════
 *
 * ผู้ใช้: *"ตอนนี้การเพิ่มหน้า ลบหน้า มันมี lag จนรู้สึกได้ · เมื่อพิมพ์ขึ้นหน้าใหม่
 *           ต้องสร้างหน้าก่อนแล้วสร้างบรรทัด ตอนนี้มันเหมือนสร้างบรรทัดก่อนแล้วสร้างหน้า"*
 *
 * ที่รู้สึกนั้นถูกต้องตามลำดับจริงในโค้ด: ProseMirror แทรกบรรทัดทันทีในเฟรมนั้น แต่จำนวนแผ่น
 * ถูกตั้งที่ **ปลายสุด** ของสายจัดหน้า (`setLayoutPageCount` ← `repaginateProseNow` ← debounce)
 * → ตัวหนังสือไปอยู่บนพื้นโต๊ะก่อนราวหนึ่งในสิบวินาที แล้วแผ่นค่อยตามมาทีหลัง
 *
 * ★ ท่าที่ใช้: **ResizeObserver บนตัวแก้ไข** — เรขาคณิตของโหมดจัดหน้าล็อกไว้แล้วตั้งแต่
 * alpha.98 ว่า `สูงตัวแก้ไข = n × สูงกระดาษ + (n−1) × ช่องว่าง` ดังนั้นพอความสูงโตเกิน
 * สูตรของ n ปัจจุบัน ก็แปลว่า "ต้องมีแผ่นที่ n+1 แล้ว" — คำนวณกลับได้ตรง ๆ ไม่ต้องวัดอะไรอีก
 *
 * ทำไมถึงเร็วพอ: คอลแบ็กของ ResizeObserver ทำงาน **หลัง layout แต่ก่อน paint ของเฟรมเดียวกัน**
 * → แผ่นใหม่ขึ้นจอพร้อมบรรทัดใหม่เป๊ะ ไม่มีเฟรมไหนที่ตัวหนังสือลอยอยู่บนพื้นโต๊ะ
 * และไม่ต้องอ่าน DOM เองเลย (ไม่บังคับ reflow เพิ่มแม้แต่ครั้งเดียว)
 *
 * ทำหน้าที่ **เพิ่มอย่างเดียว** — การลดจำนวนแผ่นปล่อยให้ตัวจัดหน้าจริงเป็นคนทำ
 * (ความสูงจะไม่หดลงจนกว่า `--pg-count` จะถูกลด ซึ่งเป็นงานของตัวจัดหน้าอยู่แล้ว)
 * และ **ห้ามแตะ `--pg-count`** ที่นี่ ไม่งั้นจะไปดันความสูงกลับ = วนกับตัวเองไม่จบ
 */
const _paperGrowRO = new WeakMap();      // element ของตัวแก้ไข → ResizeObserver
function watchPaperGrowth(tab, pm, pageH, gap) {
  if (typeof ResizeObserver === 'undefined' || !pm) return false;
  const seen = _paperGrowRO.get(pm);
  if (seen) { seen.pageH = pageH; seen.gap = gap; return false; }
  const box = { pageH, gap };
  const ro = new ResizeObserver((entries) => {
    const e = entries[0];
    if (!e) return;
    const h = (e.borderBoxSize && e.borderBoxSize[0] && e.borderBoxSize[0].blockSize)
      || e.contentRect.height;
    growPaperSheets(pm, h, box.pageH, box.gap);
  });
  box.ro = ro;
  box.disconnect = () => ro.disconnect();
  _paperGrowRO.set(pm, box);
  ro.observe(pm);
  return true;
}

/**
 * เพิ่มแผ่นให้พอกับความสูงที่วัดได้ (ไม่ลด · ไม่แตะ --pg-count · ไม่อ่าน DOM)
 * @returns {number} จำนวนแผ่นหลังปรับ (0 = ไม่มีชั้นแผ่นให้ปรับ)
 */
function growPaperSheets(pm, height, pageH, gap) {
  const ws = pm && pm.parentElement;
  const layer = ws && ws.querySelector(':scope > .k-paper-layer');
  if (!layer || !(pageH > 1)) return 0;
  const have = layer.children.length;
  // สูตรกลับของ `h = n × pageH + (n−1) × gap` — เผื่อ 2px กันเศษปัดของ sub-pixel
  const want = Math.max(1, Math.ceil((height + gap - 2) / (pageH + gap)));
  if (want <= have) return have;
  for (let i = have; i < want; i++) {
    const sh = el('div', 'k-paper-sheet');
    sh.style.top = (i * (pageH + gap)) + 'px';
    sh.style.height = pageH + 'px';
    sh.dataset.sheet = String(i + 1);
    layer.append(sh);
  }
  layer.style.height = (want * pageH + (want - 1) * gap) + 'px';
  // [alpha.143r] ผ้าคลุมเป็น mask แบบคาบซ้ำ — ไม่ต้องโตตามจำนวนแผ่นอีกแล้ว (ครอบคลุมทุกคาบเอง)
  setPaperMaskVars(ws, pageH, gap);
  return want;
}


/** จัดหน้าบทของแท็บ + วาดเส้นคั่นหน้า/เครื่องหมายต่อเนื่อง — คืนข้อความ " · N หน้า" */
function repaginateNow(t) {
  try {
    const fmt = spFormat();
    // นับจากบล็อกในเอกสารจริง (ไม่ใช่ md) เพื่อให้ตำแหน่งเส้นคั่นหน้าตรงกับจอ (ข้อ 57)
    const blocks = blocksFromDoc(t.sp.view.state.doc);
    const pg = pagesOf(blocks, fmt);
    // เส้นคั่นหน้าในตัวแก้ไข — หน้า 2 เป็นต้นไป
    // [alpha.57a] เลขบนเส้นคั่นนับต่อจาก "เลขหน้าเริ่มต้น" ของไฟล์ (ตั้งในคุณสมบัติฉาก)
    const base = currentStartPage(t) - 1;
    // [alpha.84 ข้อ 2] ต้องใช้ `pageStartMarks` ไม่ใช่ตำแหน่งเปล่า ๆ — หน้าที่เริ่มกลางบทพูด
    // ที่ถูกหั่นให้ตำแหน่ง "ในเนื้อข้อความ" + ระยะเยื้องของบล็อกนั้นมาด้วย
    // (เดิมได้แค่ pos ของหัวย่อหน้า → โหมดปกติ/จัดหน้าตัดคนละที่กับมุมมองหน้าคู่)
    const starts = pageStartMarks(pg, fmt);
    // [alpha.86] (CONTINUED)/CONTINUED: เดินทางไปกับ "เส้นคั่นหน้า" ไม่ใช่ decoration แยก —
    // หน้าที่ i จบด้วย continuedBottom · หน้าที่ i+1 เริ่มด้วย continuedTop
    const onCt = spContinuedOn();
    const changed = setPageBreaks(starts
      .map((st, i) => ({ pos: st.pos, page: base + i + 1, mid: st.mid, ind: st.indent,
                         contBottom: onCt ? (pg.pages[i - 1] || {}).continuedBottom || '' : '',
                         contTop: onCt ? (pg.pages[i] || {}).continuedTop || '' : '' }))
      .slice(1)
      .filter((x) => Number.isFinite(x.pos)), t.sp.view);   // [alpha.159 · H15] รายการของแท็บนี้
    // [alpha.83 ข้อ 4] เลขหน้าจริงของหน้าที่ 2 เป็นต้นไปในโหมดปกติ/จัดหน้า
    const nChanged = setSpPageNumberLabel(pageNumberLabelFor(fmt), t.sp.view);
    updatePageNumberHint();
    // [alpha.58 · 55–56] เครื่องหมายต่อเนื่อง — คิดจากผลจัดหน้าชุดเดียวกัน จึงตรงกับเส้นคั่นหน้าเสมอ
    const marks = spContinuedOn() ? computeContinueds(pg, fmt) : [];
    const cChanged = setContinueds(marks, t.sp.view);   // [alpha.159] รายการของแท็บนี้
    // วาดใหม่เฉพาะตอนตำแหน่งเส้นเปลี่ยนจริง — dispatch ทุก 300ms ไปกวนตำแหน่งเลื่อนตอนซูม
    if (changed || cChanged || nChanged) t.sp.refreshGuides();
    setLayoutPageCount(t, pg.count);       // [alpha.81 ข้อ 7] หน้าสุดท้ายต้องเป็นแผ่นเต็ม
    refreshSpView();                       // มุมมองเรียงหน้า/ภาพรวมตามเนื้อหาล่าสุด
    // [alpha.100r บั๊ก 2] ชดเชยที่ว่างท้ายหน้าให้เนื้อหน้าลงแผ่นพอดี
    // (ต้องรอให้เบราว์เซอร์วาดเส้นคั่นก่อนถึงจะวัดได้ — บทเรียน "อย่าวัดทันทีหลังสั่งวาด")
    requestAnimationFrame(() => { try { tuneSpPagePadsLoop(t); } catch {} });
    _spPageText = ttf('ui.app.page', pg.count);
    return _spPageText;
  } catch (e) { log('warn', tt('ui.app.pageChapterNotOk'), e); return _spPageText; }
}
/**
 * [alpha.93 ข้อ 5] ★ ปรับ "ที่ว่างท้ายหน้า" จาก **เรขาคณิตจริงบนจอ** จนทุกหน้าสูงเท่ากันเป๊ะ
 *
 * ค่าที่ `proseBreakList` คำนวณไว้เป็นการเดาที่ดีแล้ว แต่ระยะจริงบนจอยังเพี้ยนได้จาก
 * เรื่องที่โมเดลไม่รู้: การยุบ margin ระหว่างย่อหน้าที่ประกบเส้นคั่น (หัวข้อกับย่อหน้าธรรมดา
 * ยุบไม่เท่ากัน) · ซูมหน้ากระดาษ · โหมดมุมมองที่กล่องเส้นคั่นหน้าตาไม่เหมือนกัน
 *
 * แทนที่จะไล่ทำนายทุกกรณี ให้ **วัดของจริงแล้วชดเชย**: ระยะระหว่างเส้นคั่นควรเป็น
 * "ความสูงพื้นที่พิมพ์" เป๊ะ ๆ ต่างเท่าไรก็บวกกลับเข้าไปในที่ว่างของหน้านั้น
 * เพิ่ม pad ของหน้า i แล้วทุกอย่างใต้มันเลื่อนลงเท่ากันหมด → ระยะของหน้าอื่นไม่เปลี่ยน
 * ค่าที่วัดได้รอบเดียวจึงใช้ได้ทั้งชุด (ไม่ต้องวนซ้ำ)
 *
 * ปลอดภัยกับวงจรจัดหน้า เพราะการวัดหน้าอยู่ในโหมด `k-measuring` ที่ซ่อนเส้นคั่นทั้งหมด
 * — pad จึงไม่มีทางย้อนกลับไปเปลี่ยนจุดตัด
 *
 * @returns {boolean} true = ปรับจริง (สั่งวาดเส้นใหม่แล้ว)
 */
let _padTuneUntil = 0;
function tuneProsePagePads(t) {
  if (!t || !t.editor || !t.pane) return false;
  // กันวนกับตัวเอง: การวาดเส้นใหม่อาจไปกระตุ้นให้จัดหน้ารอบใหม่ แล้วเรียกกลับมาที่นี่อีก
  // (รอบเดียวก็ตรงแล้ว — เพิ่ม pad ของหน้าไหน ทุกอย่างใต้มันเลื่อนลงเท่ากันหมด)
  const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (nowMs < _padTuneUntil) return false;
  const view = t.editor.view;
  const pm = view.dom;
  if (!pm.isConnected) return false;
  const list = prosePageBreaks(view);
  if (!list.length) return false;
  const els = [...pm.querySelectorAll('.ed-page-break')];
  if (els.length !== list.length) return false;         // ยังวาดไม่ครบ — รอรอบหน้า
  const spf = spFormat();
  const target = (num(spf.paper.height, 11) - num(spf.margins.top, 1)
                  - num(spf.margins.bottom, 1)) * 96;
  if (!(target > 8)) return false;
  const z = zoomFactorOf(pm) || 1;
  // [alpha.146 · เคส P-2] มุมมองนี้ปูแผ่นกระดาษตายตัวไหม (ดู renderPaperSheets)
  const paperView146 = isPaperView(viewOfTab(t));
  const cs = getComputedStyle(pm);
  const top0 = pm.getBoundingClientRect().top + (parseFloat(cs.paddingTop) || 0) * z;
  // ที่ว่างท้ายหน้ากางด้วย `margin-top` → **ขอบบนของกล่อง = รอยต่อหน้า** ทั้งชนิดบล็อกและ inline
  const lineY = (e) => (e.getBoundingClientRect().top - top0) / z;
  // ══ [alpha.103 ข้อ 1] ★★ หน้าแรกเริ่มที่ **ขอบในของกระดาษ** — ไม่ใช่ขอบบนของบล็อกแรก ══
  //
  // ผู้ใช้: *"ถ้าบรรทัดแรกในฉากมีระยะบรรทัดที่ไม่เหมือนตัวอักษรทั่วไป มันเกิดการล้นหน้ากระดาษ
  //           แปลว่ามันไม่เคารพระยะตัดตกเลย หรือมีการเปิดโอกาสในการขยับหน้ากระดาษ"* — ถูกทั้งคู่
  //
  // ต้นตอ: **ระยะเว้นนำของบล็อกแรกถูกนับสองครั้ง**
  // ตัววัดยุบระยะนั้นเข้าไปใน *ความสูง* ของบล็อกแรกแล้ว (`blocks[0].height += top; top = 0`)
  // → พิกัดทุกตัวที่โมเดลคืนมา **เท่ากับระยะจากขอบในกระดาษบนจอเป๊ะ ๆ อยู่แล้ว**
  //   (ขอบล่างของบล็อกแรกก็ตรง เพราะยุบเข้าความสูงไปแล้ว มีแค่ "ขอบบน" ตัวเดียวที่เลื่อน)
  // แต่ [alpha.97 ข้อ 10] มาเริ่มวัดหน้า 1 ที่ขอบบน *หมึก* ของบล็อกแรก → `used` ของหน้า 1
  // ขาดไปเท่ากับ margin นั้น → `pad` ของเส้นคั่นเส้นแรกใหญ่เกินไปเท่ากัน → **ทุกหน้าตั้งแต่
  // หน้า 2 ถูกดันลงคงที่** ในขณะที่แผ่นกระดาษปูตามสูตรตายตัว `k × (สูงกระดาษ + ช่องว่าง)`
  // = ตัวหนังสือล้นก้นแผ่นทุกใบ
  //
  // ย่อหน้าธรรมดามี `margin-top:0` (ไม่มีอะไรให้นับซ้ำ) จึงไม่เคยเห็นบั๊ก — หัวข้อมี `1em`
  // ของขนาดตัวเอง (h1 ≈ 32px) เลยโผล่มาเป็นส่วนที่ล้นพอดี ตรงกับอาการที่ผู้ใช้เจอ
  // คู่กับกฎ CSS `> :first-child{margin-top:0}` ที่เพิ่งเพิ่ม (คู่แฝดของ `.ed-page-break + *`
  // ซึ่งดูแลหน้า 2 เป็นต้นไปมาตั้งแต่ alpha.93 — หน้าแรกไม่เคยมีใครดูแล)
  let prev = 0;
  // ★ [alpha.97 ข้อ 10] **กล่องเส้นคั่นเองก็สูง** — ตัวเลขนี้คือหัวใจของ "หน้าไม่เท่ากัน"
  //
  // ผู้ใช้: *"หน้า 2 มันเริ่มล้น แต่เล็กจนไม่สังเกต พอหน้า 3 เริ่มเห็นแล้ว
  //          การตัดหน้าไม่ผิด แต่การ render ผิด"* — ถูกทุกคำ และต้นตออยู่ตรงนี้บรรทัดเดียว
  //
  // ระยะจาก "หัวเส้นคั่น i" ถึง "หัวเส้นคั่น i+1" = ความสูงกล่องเส้นคั่น i + เนื้อหน้า i+1 + pad
  // ของเดิมเทียบระยะนั้นกับ `target` (= ความสูงพื้นที่พิมพ์) เฉย ๆ **ราวกับกล่องเส้นคั่นสูง 0**
  // ซึ่งจริงเฉพาะ "มุมมองปกติ + จุดตัดระดับบล็อก" เท่านั้น:
  //   · มุมมองจัดหน้า      กล่อง = ขอบล่าง + ช่องว่างพื้นโต๊ะ + ขอบบน ≈ **220px**
  //   · จุดตัดกลางย่อหน้า  แถบ k-pb-inline สูงหนึ่งบรรทัด ≈ **30px**
  // ส่วนที่ไม่ได้นับถูกหักออกจาก pad ของหน้าถัดไปทุกครั้ง → แผ่นเตี้ยลงเรื่อย ๆ ทีละหน้า
  // (หน้าแรกยังตรงเพราะไม่มีเส้นคั่นอยู่ก่อนหน้ามัน — ตรงกับที่ผู้ใช้เห็นเป๊ะ)
  //
  // ★★ [alpha.98 ข้อ 7] ตั้งแต่ pad เป็น **ความสูงของกล่อง** (ไม่ใช่ margin เหนือกล่อง)
  // กติกาการชดเชยก็เปลี่ยนจาก "บวกเพิ่ม" เป็น **"กำหนดค่าตรง ๆ"**:
  //   ที่ว่างท้ายหน้า i = ความสูงพื้นที่พิมพ์ − เนื้อหาที่หน้า i ใช้ไปจริง
  // เพราะ `pad` อยู่ *ใต้* ขอบบนของกล่องแล้ว มันจึงไม่มีผลกับระยะที่เพิ่งวัด (ซึ่งจบที่ขอบบน)
  // — ถ้ายังใช้ `pad += delta` เหมือนเดิม ตัวชดเชยจะไปแก้กล่องผิดตัว (เหลื่อมไปหนึ่งช่อง)
  // แล้วไม่มีวันลงตัว (อาการ: หน้าไม่เท่ากันแบบสุ่ม ๆ เมื่อมีหัวข้อปน)
  let prevH = 0;
  let changed = false;
  // [alpha.131 · เคส P-1] สูตรนี้ถูกอยู่แล้ว — "หน้าหนึ่ง = เนื้อที่ใช้ + ที่ว่างท้ายหน้า = พื้นที่พิมพ์"
  // (เทส [93-5] คุมไว้) ส่วนที่เคยเหลื่อมอยู่ที่ **ความสูงของกล่องเส้นคั่นเอง** ไม่ใช่ที่นี่
  // → แก้ใน CSS ให้แถบหนึ่งบรรทัดไปอยู่ *ใน* ที่ว่างท้ายหน้าแทนการบวกเพิ่ม (ดู `.k-pb-inline`)
  for (let i = 0; i < els.length; i++) {
    const y = lineY(els[i]);
    // ระยะจาก **ก้นกล่องก่อนหน้า** ถึงขอบบนกล่องนี้ = เนื้อหาที่หน้านี้ใช้ไปจริง
    const used = y - prev - prevH;
    prev = y;
    prevH = els[i].getBoundingClientRect().height / z;
    // ══ [alpha.146 · เคส P-2] ★★ ที่ว่างท้ายหน้า **ติดลบได้** ══
    //
    // เดิมเป็น `Math.max(0, target - used)` — หน้าที่เนื้อ **ล้น** พื้นที่พิมพ์ถูกปัดเป็น 0
    // คือ "ไม่ชดเชยอะไรเลย" · เหตุผลที่เคยเขียนไว้คือ *"ปล่อยให้หน้าถัดไปรับไป
    // ไม่ใช่ดันแผ่นให้เพี้ยนทั้งเล่ม"* — **กลับหัวกลับหาง**: แผ่นกระดาษถูกปูที่
    // `k × (สูงกระดาษ + ช่องว่าง)` **ตายตัว** (renderPaperSheets) ไม่มีใคร "รับไป" ได้
    // ส่วนที่ล้นจึงกลายเป็นระยะที่สายเนื้อหาเดินเกินแผ่นไปทีละหน้า **แล้วสะสม**
    // → หน้าท้าย ๆ ตัวหนังสือหลุดลงไปนั่งบนพื้นโต๊ะ
    //
    // ที่มาของส่วนที่ล้น: `used` วัดจากของจริง จึงรวม **ระยะเว้นท้ายย่อหน้าสุดท้ายของหน้า**
    // ซึ่งไม่ยุบหายไปไหน (ตั้งแต่ alpha.98 กล่องเส้นคั่นใช้ `height` ไม่ใช่ `margin`
    // margin ของ sibling จึงเลิกยุบผ่านมัน) · ค่านี้เล็กมาก (ระดับ 4px) และเป็น 0 ที่รอยต่อ
    // ส่วนใหญ่ → ซ่อนตัวมาหลายสิบรุ่น จนเมตริกฟอนต์ขยับที่ alpha.144–.145 แล้วรอยต่อไป
    // ตกหลังย่อหน้าที่มีระยะเว้นจริงเข้าพอดี
    //
    // ให้ค่าติดลบไหลลงไปถึง CSS ได้ = **กล่องเส้นคั่นหดตัวกลืนส่วนที่ล้น** แล้วหน้าถัดไป
    // กลับมาเริ่มตรงหัวแผ่นพอดี · แต่ละมุมมองหดได้ไม่เท่ากัน จึงให้ CSS เป็นคนหนีบเอง
    // (มุมมองจัดหน้ากล่องสูง 220px หดได้เยอะ · มุมมองปกติกล่องสูงเท่า pad หดไม่ได้เลย)
    // ★ ค่าติดลบมีความหมาย **เฉพาะมุมมองที่ปูแผ่นกระดาษตายตัว** (จัดหน้า) เท่านั้น
    // มุมมองปกติ/ร่างไม่มีแผ่น — ความคลาดไม่สะสมและไม่มีใครเห็น ส่วนกล่องเส้นคั่นที่นั่น
    // สูงเท่าที่ว่างพอดี หดต่ำกว่า 0 ไม่ได้อยู่แล้ว · ส่งค่าติดลบไปก็ไม่เกิดอะไรขึ้นนอกจาก
    // ทำให้ตัวเลขที่รายงานออกมาไม่ตรงกับรูปทรงจริงบนจอ
    const want = Math.max(paperView146 ? -400 : 0, Math.round((target - used) * 10) / 10);
    if (Math.abs(want - num(list[i].pad, 0)) < 0.5) continue;
    list[i].pad = want;                    // แก้ที่วัตถุตัวเดิมที่ปลั๊กอินถืออยู่ (ลายเซ็นไม่เปลี่ยน)
    changed = true;
  }
  if (!changed) return false;
  _padTuneUntil = nowMs + 400;
  applyProsePagePads(pm);                  // ทาลง DOM ตรง ๆ — ไม่ dispatch ไม่สร้าง DOM ใหม่
  return true;
}

/**
 * ══ [alpha.100r บั๊ก 2] ★★ บทภาพยนตร์: เนื้อหน้าล้นแผ่นเพราะ "บรรทัดจริงไม่เท่าโมเดล" ══
 *
 * ผู้ใช้: *"ในรูปที่ 3 บทหนังเจออาการหน้าล้น เพราะบทหนังมีระยะบรรทัดที่ไม่เท่ากัน"*
 *
 * บทจัดหน้าจาก **โมเดล** (`sp-format.js` นับบรรทัดจากฟอนต์ล้วน ๆ **ไม่เคยอ่าน DOM** —
 * ตั้งใจแบบนั้น เพราะทำให้จอ · PDF · มุมมองหน้าคู่ ได้ตัวเลขชุดเดียวกัน) โมเดลจึงเชื่อว่า
 * หนึ่งหน้า = 54 บรรทัด × ⅙ นิ้ว = ความสูงพื้นที่พิมพ์พอดี
 *
 * แต่บนจอ ความสูงบรรทัดจริงไม่เท่านั้นเสมอ — ฟอนต์ไทยมีตัวบน-ตัวล่าง · แต่ละ element มี
 * `linesBefore` เป็นระยะเว้นจริง · หัวฉาก/ทรานซิชันมีสไตล์ของตัวเอง → เนื้อหน้าสูงเกิน
 * ความสูงพื้นที่พิมพ์ทีละนิด **สะสมทุกหน้า**
 *
 * ก่อน alpha.100 ไม่มีใครเห็น เพราะกระดาษเป็น "แผ่นเดียวยาว ๆ" ที่ยืดตามเนื้อหา — ส่วนที่เกิน
 * ก็แค่ไปอยู่บนกระดาษต่อ · พอเปลี่ยนเป็นแผ่นจริงที่ล็อกความสูงไว้ ส่วนเกินเลยไปโผล่บนพื้นโต๊ะ
 *
 * แก้แบบเดียวกับที่ฝั่งนิยายใช้มาตั้งแต่ alpha.93: **วัดของจริงแล้วชดเชย** —
 * ที่ว่างท้ายหน้า i = ความสูงพื้นที่พิมพ์ − เนื้อหาที่หน้า i ใช้ไปจริง (ติดลบได้ = หน้านั้นล้น
 * ก็หนีบเป็น 0 แล้วปล่อยให้หน้าถัดไปรับไป ไม่ใช่ดันแผ่นให้เพี้ยนทั้งเล่ม)
 *
 * **ไม่แตะการจัดหน้าเลย** — pad เป็นเรื่องของการวาดล้วน ๆ · การนับหน้า/ตำแหน่งตัดยังมาจาก
 * โมเดลเหมือนเดิมทุกประการ (จอกับ PDF จึงยังตรงกัน)
 *
 * @returns {boolean} true = ปรับจริง
 */
let _spPadTuneUntil = 0;
function tuneSpPagePads(t) {
  if (!t || !t.sp || !t.pane) return false;
  // มีผลเฉพาะมุมมองจัดหน้า — มุมมองอื่นกล่องเส้นคั่นไม่ได้ใช้ `--k-pb-pad` เลย
  if (currentSpView() !== 'layout') return false;
  const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (nowMs < _spPadTuneUntil) return false;
  const pm = t.sp.view.dom;
  if (!pm || !pm.isConnected) return false;
  const list = pageBreaks(t.sp.view);
  if (!list.length) return false;
  const els = [...pm.querySelectorAll('.sp-page-break')];
  if (els.length !== list.length) return false;         // ยังวาดไม่ครบ — รอรอบหน้า
  const fmt = spFormat();
  const target = (num(fmt.paper.height, 11) - num(fmt.margins.top, 1)
                  - num(fmt.margins.bottom, 1)) * 96;
  if (!(target > 8)) return false;
  const z = zoomFactorOf(pm) || 1;
  const cs = getComputedStyle(pm);
  const top0 = pm.getBoundingClientRect().top + (parseFloat(cs.paddingTop) || 0) * z;
  const yOf = (e) => (e.getBoundingClientRect().top - top0) / z;
  // [alpha.103 ข้อ 1] หน้าแรกเริ่มที่ **ขอบในกระดาษ** เหมือนฝั่งนิยาย (ดูคอมเมนต์ยาวที่นั่น)
  // โมเดลของบทให้ `before = 0` กับบล็อกแรกของทุกหน้าอยู่แล้ว และ CSS ตัด padding นำของ
  // `.sp:first-child` ทิ้งตั้งแต่ alpha.87 → ปกติสองค่านี้เท่ากัน แต่ถ้าวันหนึ่งไม่เท่า
  // การนับจากขอบในกระดาษคือค่าที่ตรงกับโมเดล (ส่วนเกินจะถูกชดเชยแทนที่จะถูกซ่อน)
  let prev = 0;
  let prevH = 0;
  let changed = false;
  for (let i = 0; i < els.length; i++) {
    const y = yOf(els[i]);
    const used = y - prev - prevH;                       // เนื้อหาที่หน้านี้ใช้ไปจริง
    prev = y;
    prevH = els[i].getBoundingClientRect().height / z;
    // [alpha.146 · เคส P-2] กฎคู่แฝดของฝั่งนิยาย — ที่ว่างท้ายหน้าติดลบได้
    // (แผ่นของบทก็ปูตายตัวเหมือนกัน ส่วนที่ล้นจึงสะสมแบบเดียวกันเป๊ะ)
    const want = Math.max(-400, Math.round((target - used) * 10) / 10);
    if (Math.abs(want - num(list[i].pad, 0)) < 0.5) continue;
    list[i].pad = want;                    // แก้ที่วัตถุตัวเดิมที่ปลั๊กอินถืออยู่ (ลายเซ็นไม่เปลี่ยน)
    changed = true;
  }
  if (!changed) return false;
  _spPadTuneUntil = nowMs + 400;
  applySpPagePads(pm);                     // ทาลง DOM ตรง ๆ — ไม่ dispatch ไม่สร้าง DOM ใหม่
  return true;
}
/** วนชดเชยจนลงตัว (สองรอบพอ — pad ตอบสนองแบบ 1:1 เหมือนฝั่งนิยาย) */
function tuneSpPagePadsLoop(t, rounds = 2) {
  let n = 0;
  for (let i = 0; i < rounds; i++) {
    _spPadTuneUntil = 0;
    if (!tuneSpPagePads(t)) break;
    n++;
  }
  _spPadTuneUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 400;
  return n;
}

/**
 * [alpha.98 ข้อ 7] วนชดเชยจนระยะลงตัว — ตั้งแต่ pad เป็น "ความสูงจริง" มันตอบสนองแบบ 1:1
 * รอบเดียวก็ตรงแล้วในทางทฤษฎี · วนซ้ำอีกไม่เกินสองรอบไว้กันเศษจากการปัดครึ่งพิกเซล
 * และกันกรณีที่ระยะขอบของบล็อกที่ประกบเปลี่ยนเพราะกล่องเส้นคั่นเพิ่งโตขึ้น
 */
function tuneProsePagePadsLoop(t, rounds = 2) {
  let n = 0;
  for (let i = 0; i < rounds; i++) {
    _padTuneUntil = 0;                     // ตัวกันวนมีไว้กัน "จัดหน้า → ชดเชย → จัดหน้า"
    if (!tuneProsePagePads(t)) break;      // ไม่ขยับแล้ว = ลงตัว
    n++;
  }
  _padTuneUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 400;
  return n;
}

/**
 * ══════ [alpha.97 ข้อ 9] ★ ตรึงเคอร์เซอร์ไว้ที่เดิม "บนจอ" ระหว่างจัดหน้า ══════
 *
 * ผู้ใช้: *"scroll bar ไม่ตาม cursor เมื่อกดวาง"*
 *
 * ProseMirror สั่ง `scrollIntoView()` ให้ตอนวางอยู่แล้ว และมันทำงานถูกต้อง — ปัญหาเกิด
 * **หลังจากนั้น**: ตัวจัดหน้าเดินตามมาอีกไม่กี่ร้อยมิลลิวินาที แล้วแทรก "ที่ว่างท้ายหน้า"
 * (`--k-pb-pad`) กับแถบคั่นหน้าเข้าไป **เหนือ** เคอร์เซอร์ ทุกอย่างใต้มันจึงเลื่อนลง
 * ตามความสูงที่เพิ่งงอกขึ้นมา ส่วนแถบเลื่อนไม่ขยับเลยเพราะไม่มีใครบอกมัน
 * = ตัวหนังสือหนีลงไปจากจอทั้งที่เพิ่งเลื่อนมาให้เห็นเมื่อกี้
 *
 * แก้ตรงจุด: จำ "เคอร์เซอร์อยู่สูงจากขอบบนกล่องเลื่อนเท่าไร" ก่อนแตะ DOM แล้วชดเชย
 * ส่วนต่างคืนหลังวาดเสร็จ · ตรึงเฉพาะตอนตัวแก้ไขถือโฟกัสและเคอร์เซอร์เห็นอยู่จริง
 * (ไม่งั้นจะไปแย่งแถบเลื่อนตอนผู้ใช้กำลังอ่านที่อื่น)
 */
function proseCaretAnchor(t) {
  const v = t && t.editor && t.editor.view;
  if (!v || !v.dom || !v.dom.isConnected) return null;
  const sc = t.pane;
  if (!sc || !sc.isConnected) return null;
  try {
    if (!v.hasFocus()) return null;
    const head = v.state.selection.head;
    const c = v.coordsAtPos(head);
    const box = sc.getBoundingClientRect();
    if (c.bottom < box.top || c.top > box.bottom) return null;   // ไม่เห็นอยู่แล้ว = ไม่ต้องตรึง
    return { sc, y: c.top - box.top, head };
  } catch { return null; }
}
function releaseCaretAnchor(t, a) {
  if (!a) return false;
  const v = t && t.editor && t.editor.view;
  if (!v || !v.dom || !v.dom.isConnected || !a.sc.isConnected) return false;
  try {
    const c = v.coordsAtPos(Math.min(a.head, v.state.doc.content.size));
    const dy = (c.top - a.sc.getBoundingClientRect().top) - a.y;
    if (Math.abs(dy) < 0.5) return false;
    const max = Math.max(0, a.sc.scrollHeight - a.sc.clientHeight);
    a.sc.scrollTop = Math.min(Math.max(0, a.sc.scrollTop + dy), max);
    return true;
  } catch { return false; }
}

/**
 * [alpha.58r บั๊ก 20 · แยกออกมาใน alpha.60r2 ข้อ 3] จัดหน้าเอกสาร "นิยาย" + วาดเส้นคั่นหน้า
 * @returns {number} จำนวนหน้า (0 = คำนวณไม่ได้)
 */
function repaginateProseNow(t) {
  if (!t || !t.editor) return 0;
  // ══ [alpha.103 ข้อ 5] ★ จัดหน้าซ้ำทั้งที่ "ไม่มีอะไรเปลี่ยน" = งานทิ้งเปล่าหนึ่งรอบเต็ม ══
  //
  // กด Enter หนึ่งครั้งเดินสองทาง: `repaginateOnEnter` ยิงทันที แล้ว `scheduleCount` ตามมา
  // อีก ~100ms — รอบที่สองวัดทั้งเอกสารใหม่หมดทั้งที่ **เอกสารตัวเดียวกันเป๊ะ** และผลการวัด
  // ก็ยังใช้ได้ (เงื่อนไขเดียวที่ทำให้ใช้ไม่ได้คือ epoch ขยับ ซึ่งแปลว่า decoration/เรขาคณิตเปลี่ยน
  // — ตัวเดียวกับที่แคชผลวัดใช้อยู่แล้ว)
  // เอกสาร 80 หน้า รอบหนึ่ง ~74ms → ตัดทิ้งได้ครึ่งหนึ่งของงานจัดหน้าทั้งหมดตอนร่างโครงเรื่อง
  const doc0 = t.editor.view.state.doc;
  if (_pagDone && _pagDone.tab === t && _pagDone.doc === doc0 && _pagDone.epoch === proseLayoutEpoch()) {
    return _pagDone.pages;
  }
  // [alpha.97 ข้อ 9] จำตำแหน่งเคอร์เซอร์บนจอไว้ก่อน — เส้นคั่น/ที่ว่างท้ายหน้าที่กำลังจะแทรก
  // อาจงอกขึ้นเหนือมันแล้วดันจอหนี
  const caret = proseCaretAnchor(t);
  // เก็บผลไว้ให้รอบถัดไปข้ามได้ — **เฉพาะรอบที่ผลออกมาครบ** (`ok`)
  // รอบที่แปลงพิกัดกลับไม่สำเร็จบางจุด (เส้นคั่นน้อยกว่าจำนวนหน้า) ต้องปล่อยให้วัดใหม่
  // ไม่งั้นเส้นคั่นที่หายไปจะค้างหายถาวร (อาการเดิมสมัย alpha.82)
  const done = (n, ok) => {
    _pagDone = ok === false ? null : { tab: t, doc: doc0, epoch: proseLayoutEpoch(), pages: n };
    return n;
  };
  try {
    const spf = spFormat();
    // [alpha.82] ทางหลัก — วัดของจริงบนจอ (ตัดตามบรรทัด · ตัดกลางย่อหน้าได้)
    // ══ [alpha.98 ข้อ 8] ★ เข้า "โหมดวัด" ครั้งเดียวต่อการจัดหน้าหนึ่งรอบ ══
    //
    // ผู้ใช้: *"performance issues ตอนเราทำ 40 หน้า โดยที่ไม่มีตัวหนังสือเลยนะ กระตุกมาก ๆ"*
    //
    // `withMeasureMode()` เพิ่ม/ถอดคลาสบน `<body>` ซึ่งบังคับให้เบราว์เซอร์คิดสไตล์ใหม่
    // **ทั้งเอกสาร** สองครั้งต่อการเข้า-ออกหนึ่งรอบ · ของเดิมเข้า-ออกถึงสามรอบต่อการจัดหน้า
    // หนึ่งครั้ง (ตอนวัด · ตอนหั่นหน้า · ตอนแปลงพิกัดกลับ) = คิดสไตล์ใหม่ทั้งเอกสาร 6 รอบ
    // ครอบทั้งชุดไว้ในรอบเดียว — ชั้นในเห็นว่ามีคลาสอยู่แล้วจึงไม่ทำอะไรซ้ำ (ออกแบบมาให้ซ้อนได้)
    // [alpha.103 ข้อ 5] จับเวลาไว้ในตัวรายงาน — "จัดหน้าช้า" ต้องมีตัวเลข ไม่ใช่ความรู้สึก
    const _ms0 = performance.now();
    let _msMeasure = 0, _msSlice = 0;
    const mzAll = withMeasureMode(() => {
      const m = proseMeasured(t, spf);
      _msMeasure = performance.now() - _ms0;
      if (!m) return null;
      resetCutFail();
      // [alpha.93 ข้อ 5] ส่งความสูงพื้นที่พิมพ์เข้าไปด้วย → แต่ละเส้นคั่นรู้ว่าต้องอมที่ว่างเท่าไร
      return { m, list: proseBreakList(t.editor.view, m.blocks, m.pages,
                                       currentStartPage(t), m.contentHeight) };
    });
    const mz = mzAll && mzAll.m;
    if (mz) {
      const list82 = mzAll.list;
      // [alpha.82] ตัวรายงานสำหรับไล่บั๊ก "จัดหน้าซ้ำได้คนละคำตอบ"
      // แปลงพิกัดกลับไม่สำเร็จจะถูกทิ้งเงียบ ๆ → ต้องเห็นว่าหน้ากับเส้นคั่นห่างกันแค่ไหน
      _msSlice = performance.now() - _ms0;
      state._mzDiag = { path: 'measured', pages: mz.pages.length, breaks: list82.length,
                        cached: !!(mz && mz.__fromCache), why: { ...CUT_FAIL },
                        ms: +( _msSlice).toFixed(2), msMeasure: +(_msMeasure).toFixed(2) };
      const changed = setProsePageBreaks(list82, t.editor.view);   // [alpha.159 · H15]
      // [alpha.83 ข้อ 4] เลขหน้าจริงที่มุมขวาบนของหน้าถัดไป (โหมดปกติ/จัดหน้าของนิยาย)
      const nChanged = setProsePageNumberLabel(prosePageNumberLabelFor(spf), t.editor.view);
      if (nChanged && !changed) refreshProsePageBreaks(t.editor.view);
      if (changed) {
        refreshProsePageBreaks(t.editor.view);
        // [alpha.82] เส้นคั่นหน้าเป็น widget decoration — ProseMirror **วาดย่อหน้าใหม่ทั้งใบ**
        // ตอน decoration เปลี่ยน text node ที่ผลการวัดจำไว้จึงหลุดจากเอกสารทันที
        // ใช้ต่อไม่ได้อีก (posAtDOM โยน error → จุดตัดถูกทิ้งเงียบ ๆ ทีละจุด)
        // ทิ้งผลที่แคชไว้ แล้วให้รอบหน้าวัดใหม่จากโหนดจริง — เรขาคณิตถูกตรึงด้วยโหมด
        // "ยุบเส้นคั่น" อยู่แล้ว รอบหน้าจึงได้จุดตัดชุดเดิม แล้วหยุดนิ่ง (ไม่วนไม่รู้จบ)
        bumpProseLayout();
      }
      setLayoutPageCount(t, mz.pages.length);   // [alpha.81 ข้อ 7] หน้าสุดท้ายต้องเป็นแผ่นเต็ม
      refreshSpView();
      // [alpha.93 ข้อ 5] ทาที่ว่างท้ายหน้าลงกล่องที่วาดแล้ว + เก็บเศษที่โมเดลเดาพลาด
      // (ต้องรอให้เบราว์เซอร์วาดเส้นคั่นก่อนถึงจะวัดได้ — บทเรียน "อย่าวัดทันทีหลังสั่งวาด")
      requestAnimationFrame(() => {
        try { applyProsePagePads(t.editor.view.dom); tuneProsePagePadsLoop(t); } catch {}
        releaseCaretAnchor(t, caret);          // [alpha.97 ข้อ 9] ชดเชยความสูงที่เพิ่งงอก
      });
      return done(mz.pages.length, list82.length === mz.pages.length - 1);
    }
    // สำรอง — ประมาณจากจำนวนตัวอักษร (ใช้ตอนแท็บยังไม่ถูกต่อเข้า DOM เท่านั้น)
    const pf = proseFormat();
    const pblocks = proseBlocksFromDoc(t.editor.view.state.doc);
    const ppg = prosePagesOf(pblocks, pf, spf.paper, spf.margins);
    state._mzDiag = { path: 'estimate', pages: ppg.count, breaks: -1, cached: false };
    const base = currentStartPage(t) - 1;
    const changed = setProsePageBreaks(
      prosePageStarts(ppg).map((pos, i) => ({ pos, page: base + i + 1 })).slice(1)
        .filter((x) => Number.isFinite(x.pos)), t.editor.view);
    const nChanged2 = setProsePageNumberLabel(prosePageNumberLabelFor(spf), t.editor.view);
    if (changed || nChanged2) refreshProsePageBreaks(t.editor.view);
    setLayoutPageCount(t, ppg.count);      // [alpha.81 ข้อ 7] หน้าสุดท้ายต้องเป็นแผ่นเต็ม
    refreshSpView();
    requestAnimationFrame(() => releaseCaretAnchor(t, caret));
    return done(ppg.count);
  } catch (e) { log('warn', tt('ui.app.pageNovelNotOk'), e); return 0; }
}

/**
 * [alpha.60r2 ข้อ 3] จัดหน้า **ทันที** ไม่รอ debounce — ใช้ตอนกด Enter
 * ขึ้นบรรทัดใหม่คือจังหวะเดียวที่ "เส้นคั่นหน้าอาจเลื่อน" แบบที่ตาเห็นชัดที่สุด
 * รอ 100–300ms ตรงนี้แล้วผู้ใช้รู้สึกว่าเส้นกระตุก จึงยิงตรงเลยเฉพาะกรณีนี้
 * (งานหนักอื่น — นับคำ/ตรวจบท — ยังเดินตาม scheduleCount เหมือนเดิม)
 */
export function repaginateFast(tab) {
  const t = tab || state.active;
  if (!t) return 0;
  if (t.sp) { repaginateNow(t); return 1; }
  if (t.editor) return repaginateProseNow(t);
  return 0;
}

// กด Enter = ขึ้นบล็อกใหม่ → จัดหน้าใหม่ทันทีในรอบถัดไปของ event loop (หลัง doc เปลี่ยนจริง)
// ป้องกันการยิงถี่ตอนกด Enter ค้าง ด้วยธงรอบเดียว
let _fastPageJob = 0;
function repaginateOnEnter(tab, ev) {
  if (!ev || ev.key !== 'Enter' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (_fastPageJob) return;
  // ══ [alpha.98 ข้อ 8] ★ เอกสารยาวมากอย่าจัดหน้า **ทันที** ทุกครั้งที่กด Enter ══
  //
  // ผู้ใช้: *"performance issues ตอนเราทำ 40 หน้า โดยที่ไม่มีตัวหนังสือเลยนะ กระตุกมาก ๆ"*
  //
  // ต้นตอไม่ใช่การวาดหน้ากระดาษ (วัดแล้ว: เลื่อนจอเท่ากับโหมดร่างเป๊ะ) แต่เป็น **การจัดหน้า
  // หนึ่งรอบใช้เวลา ~74ms ที่ 80 หน้า** แล้วทางลัด "กด Enter = จัดหน้าเดี๋ยวนี้" ยิงทุกครั้ง
  // → ร่างโครงเรื่องด้วยการเคาะ Enter รัว ๆ จึงค้างทุกครั้งที่เคาะ
  // เอกสารสั้น (ส่วนใหญ่) ยังทันใจเหมือนเดิม เพราะจัดหน้าเสร็จในไม่กี่มิลลิวินาที
  const tHeavy = tab || state.active;
  if (tHeavy && heavyDelay(tHeavy) > 100) return;
  _fastPageJob = setTimeout(() => { _fastPageJob = 0; try { repaginateFast(tab); } catch {} }, 0);
}

// จำนวนหน้าที่คำนวณไว้ล่าสุด — ตอนเปิด "ปรับหน้าตามช่วงเวลา" แถบสถานะยังโชว์ค่าเดิมได้
let _spPageText = '';
function scheduleCount() {
  clearTimeout(countJob);
  const t0 = state.active;
  // ═══ [alpha.87 ข้อ E] ★ **เพดานเวลารอ** — debounce ล้วนจะไม่เคยได้ยิงเลย ═══
  //
  // เดิมบรรทัดนี้เป็น `setTimeout(…, heavyDelay(t0))` คู่กับ `clearTimeout` ข้างบน = debounce แท้
  // ทุก input รีเซ็ตตัวจับเวลาใหม่หมด → **ถ้าผู้ใช้ป้อนถี่กว่าเวลาหน่วง มันจะไม่ทำงานสักครั้ง**
  // ผู้ใช้กด Ctrl+V ค้าง (คีย์ซ้ำ ~30 ครั้ง/วินาที = ทุก 33ms ซึ่งถี่กว่า 100ms) จึงเห็นกระดาษ
  // ยืดยาวออกไปเรื่อย ๆ โดยไม่มีเส้นคั่นหน้าเลย จนกว่าจะปล่อยมือ
  // (กด Enter ไม่เจอเพราะมีทางลัดเฉพาะตัวที่ `repaginateOnEnter` — วาง/พิมพ์ไม่มี)
  //
  // แก้แบบ debounce-with-maxWait: ยังรวบงานถี่ ๆ เหมือนเดิม แต่**การันตีว่าอย่างช้าที่สุด
  // ทุก ๆ `cap` มิลลิวินาที ต้องได้จัดหน้าหนึ่งครั้ง** ระหว่างที่ยังป้อนไม่หยุด
  // เอกสารยาวยืดเพดานตามเวลาหน่วง (งานหนักขึ้นก็ยอมให้ห่างขึ้น)
  const wait = t0 ? heavyDelay(t0) : 100;
  const now = Date.now();
  if (!_countRunAt) _countRunAt = now;
  const cap = Math.max(400, wait * 2);
  const due = Math.max(0, cap - (now - _countRunAt));
  countJob = setTimeout(() => {
    _countRunAt = Date.now();
    const t = state.active;
    if (!t || t.wiki || t.gal || t.isJson || t.net || t.dash || t.planner || (!t.editor && !t.sp && !t.plain)) { $('#wc').textContent = ''; return; }
    // [alpha.58 บั๊ก 4] บทภาพยนตร์นับจาก "ข้อความในเอกสาร" ไม่ใช่ getMarkdown()
    // getMarkdown() ของ SPEditor แปลง inline → markdown ทีละบล็อก (mdToDoc/docToMd)
    // = งานหนักที่สุดในลูปนี้ · แถมนับ prefix ของ fountain (@ . $shot) เป็นอักขระด้วย ซึ่งผิดอยู่แล้ว
    const body = t.editor ? t.editor.getMarkdown()
      : t.sp ? t.sp.getText() : t.plain.value;
    let txt = ttf('ui.app.wordChar', fmtNum(countWords(body)), fmtNum(body.length));
    // [84][85] บทภาพยนตร์: บอกจำนวนหน้าจริงตามขนาดกระดาษ/ระยะขอบ/กฎตัดหน้าที่ตั้งไว้
    if (t.sp) {
      // [alpha.60 ข้อ 96 · แก้ใน alpha.60r1] เปิด "ปรับหน้าตามช่วงเวลา" = ยกงานจัดหน้า
      // ไปให้ scheduleRepaginate ทำห่าง ๆ · ปิด (ค่าเริ่มต้น) = จัดหน้าที่นี่ทุกครั้ง
      // แถบสถานะโชว์จำนวนหน้าเสมอไม่ว่าโหมดไหน (ค่าล่าสุดถูกจำไว้ใน _spPageText)
      txt += state.settings.spAutoPaginate ? _spPageText : repaginateNow(t);
      // [54] ตรวจข้อผิดพลาดพร้อมกัน (debounce เดียวกับการนับคำ)
      try { checkScreenplay(t); } catch (e) { log('warn', tt('ui.app.checkChapterNotOk'), e); }
    } else {
      // [alpha.159 · H15] ไม่ล้างเส้นคั่น/CONTINUED ของบทอีกแล้ว — รายการเป็นของแต่ละตัวแก้ไข
      // (เดิมรายการเป็นก้อนเดียวทั้งโมดูล การล้างตรงนี้ไปลบของแท็บบทที่เปิดค้างอยู่)
      _spPageText = '';
      _spErrors = [];
    }
    // [alpha.58r บั๊ก 20] นิยายก็ต้องรู้ว่าอยู่หน้าไหน/ขึ้นหน้าใหม่ตรงไหน
    if (t.editor) {
      const n = repaginateProseNow(t);
      if (n) txt += ttf('ui.app.page', n);
    }
    $('#wc').textContent = txt;
    try { updateCursorPage(); } catch {}        // [alpha.159 · QoL] จัดหน้าเสร็จ = รู้ว่าเคอร์เซอร์อยู่หน้าไหน
    updateErrorBadge();
    updateProgressBar();
    scheduleLineGutter();                 // [60r2 ข้อ 11] เนื้อหาเปลี่ยน = เลขบรรทัดเปลี่ยนตาม
  }, Math.min(wait, due));
}


// ---------------- ตัวดูบันทึกการทำงาน (Log viewer) ----------------

// ═══════════════ [alpha.140] ★★ ยกเครื่องแผง Navigation ★★ ═══════════════
//
// ผู้ใช้: *"navigation กดแล้วไม่ยอม jump"* + ขอ ตัวกรอง · แถบสี/ดาว · ค้นหา · สองคอลัมน์ ·
//        ใช้ได้ทั้งนิยายและบท · บอกสถานะของจุด · เลือกได้ว่าจะเลื่อนยาวหรือแบ่งหน้า
//
// ═══ ต้นตอของ "กดแล้วไม่กระโดด" (วัดจริงด้วยตัววินิจฉัย ไม่ได้เดา) ═══
// มุมมองปกติกระโดดได้อยู่แล้ว (วัดได้ scrollTop 0 → 3093) — ที่พังคือสองเส้นทางนี้:
//
//  (1) **มุมมองหน้ากระดาษ** (เรียงหน้า/ภาพรวม) — ตัวแก้ไขจริงถูกซ่อนอยู่ใต้ `.sp-pageview`
//      โค้ดเดิม `dispatch(setSelection(...).scrollIntoView())` จึงไปเลื่อน element ที่ไม่มีใครเห็น
//      ผลวัด: pvScroll 0 → 0 · paneScroll 0 → 0 = ไม่ขยับสักพิกเซล
//      แก้: กระโดดในมุมมองหน้ากระดาษ = **กลับไปมุมมองแก้ไขล่าสุดก่อน** (เส้นทางเดียวกับ
//           การคลิกหน้ากระดาษใน `pageViewHost()` ซึ่งทำถูกอยู่แล้ว) แล้วค่อย gotoPos
//
//  (2) **มุมมองทั้งเล่ม (📚)** — `gotoLineInActive(line)` เอา *เลขบรรทัดในไฟล์ .md* ที่ nav.js
//      คืนมา ไปนับเป็น *ลำดับบล็อกใน doc* ตรง ๆ · สองอย่างนี้ไม่เท่ากันเลยเพราะ .md มีบรรทัดว่าง
//      คั่นทุกย่อหน้า → เลขเกินจำนวนบล็อกเมื่อไหร่ `target` เป็น null แล้ว **คืน false เงียบ ๆ**
//      ผลวัด: เปิดไฟล์ถูก (scene-02.md) แต่ scroll 0 → 0
//      แก้: หลังเปิดฉากแล้ว **หาแถวจริงในเอกสารด้วย (ชนิด + ข้อความ + ลำดับซ้ำ)** ไม่ใช่เลขบรรทัด
//           — ตัวสแกนเอกสาร (`navScanTab`) เป็นตัวเดียวกับที่วาดรายการของฉากที่เปิดอยู่
//
//  (3) ของแถมที่พังเงียบมานาน: `TextSelection.create(doc, pos+1)` โยน RangeError เมื่อบล็อกนั้น
//      ไม่ใช่ textblock (คำพูดยกมา/รูป) — ตอนนี้ทุกเส้นทางเรียก `ed.gotoPos()` ซึ่งใช้
//      `TextSelection.near()` อยู่แล้ว จึงไม่มีทาง throw อีก
//
// ═══ โครงใหม่ ═══
//   `src/nav-model.js` (บริสุทธิ์ · unit test)  = กลุ่มชนิด · สถานะจุด · ค้นหา/กรอง · แบ่งหน้า · คีย์เครื่องหมาย
//   ที่นี่                                      = สแกนเอกสาร · วาด · กระโดด · เก็บเครื่องหมายลง project.khn.json
let outlineJob = null;
function scheduleOutline() { clearTimeout(outlineJob); outlineJob = setTimeout(refreshOutline, 400); }
let navShowBeats = (localStorage.getItem('k2-nav-beats') ?? '1') === '1';
function setNavBeats(on) {
  navShowBeats = on;
  localStorage.setItem('k2-nav-beats', on ? '1' : '0');
  const b = $('#nav-beats-btn'); if (b) b.classList.toggle('on', on);
  refreshOutline();
}
const navTrunc = (s, n = 42) => { s = String(s).trim().replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n) + '…' : s; };

// ───────── สภาพของแถบเครื่องมือ (ค้นหา/ตัวกรอง/หน้า) ─────────
// เก็บใน localStorage เพราะเป็น "มุมมองของคนนั่งอยู่" ไม่ใช่ข้อมูลของผลงาน
// (ต่างจากสี/ดาว ซึ่งเป็นของผลงาน จึงไปอยู่ใน project.khn.json)
const NAV_UI_KEY = 'k2-nav-ui';
const navUI = { q: '', groups: [], colors: [], star: false, flags: [], page: 0 };
try {
  const raw = JSON.parse(localStorage.getItem(NAV_UI_KEY) || '{}');
  for (const k of ['q', 'groups', 'colors', 'star', 'flags']) if (raw[k] != null) navUI[k] = raw[k];
} catch {}
function saveNavUI() {
  try {
    localStorage.setItem(NAV_UI_KEY, JSON.stringify(
      { q: navUI.q, groups: navUI.groups, colors: navUI.colors, star: navUI.star, flags: navUI.flags }));
  } catch {}
}
/**
 * ล้างสภาพแผงกลับค่าตั้งต้น — **e2e ต้องเรียกก่อนเริ่มทุกครั้ง**
 *
 * บทเรียนข้อ 4 ซ้ำรอย: `navUI` กับ `navWholeBook` อ่าน localStorage **ตอน import**
 * ซึ่งเกิดก่อนที่ `runTest()` จะล้าง localStorage — รอบก่อนที่ตายกลางคันตอนเปิด
 * "มุมมองทั้งเล่ม" ค้างไว้ ทำให้รอบถัดมาเปิดโปรแกรมมาพร้อมมุมมองนั้น แล้วเทสเก่า
 * ที่นับหัวข้อของฉากปัจจุบันได้ศูนย์ (ล้างแค่ localStorage ไม่พอ ต้องล้างตัวแปรด้วย)
 */
export function resetNavUi() {
  navUI.q = ''; navUI.groups = []; navUI.colors = []; navUI.star = false;
  navUI.flags = []; navUI.page = 0;
  _navPageOf.clear(); _navPageKey = '';
  saveNavUI();
  navShowBeats = true;
  localStorage.setItem('k2-nav-beats', '1');
  setNavWholeBook(false);
  const inp = $('#outline')?.querySelector('.nav-q');
  if (inp) inp.value = '';
}
/** ตัวกรองทำงานอยู่ไหม (ใช้บอกผู้ใช้ว่าทำไมรายการสั้นผิดปกติ) */
function navFilterOn() {
  return !!(navUI.q || navUI.groups.length || navUI.colors.length || navUI.star || navUI.flags.length);
}

// ───────── เครื่องหมายที่ผู้ใช้ตั้งเอง (สี · ดาว) ─────────
// เก็บใน `project.khn.json → navMarks` — ที่เดียวกับ compileWorkflows/wikiCats
// (ไม่สร้างไฟล์ใหม่: มันเล็ก · ต้องรอดข้ามเครื่อง · และ saveProjectMeta() มีทะเบียนงานค้างคุมอยู่แล้ว)
function navMarks() {
  if (!state.meta) return {};
  if (!state.meta.navMarks || typeof state.meta.navMarks !== 'object') state.meta.navMarks = {};
  return state.meta.navMarks;
}
/** เครื่องหมายของจุดหนึ่ง (ไม่มี = null) */
export function navMarkOf(key) { return (navMarks()[key]) || null; }
/** ตั้ง/ล้างเครื่องหมาย — ค่าว่างทั้งใบ = ลบทิ้งไม่ให้ไฟล์บวม */
export async function setNavMark(key, patch) {
  if (!key || !state.meta) return false;
  const m = navMarks();
  const cur = { ...(m[key] || {}), ...patch };
  if (!cur.color) delete cur.color;
  if (!cur.star) delete cur.star;
  if (Object.keys(cur).length) m[key] = cur; else delete m[key];
  await saveProjectMeta();
  refreshOutline();
  return true;
}

// ───────── สแกนเอกสารที่เปิดอยู่ → แถว Navigation ─────────
/**
 * แหล่งความจริงตัวเดียวของ "ฉากที่เปิดอยู่มีจุดอะไรบ้าง"
 * ใช้ทั้งตอนวาดรายการ และตอนหาเป้าหมายให้การกระโดดจากมุมมองทั้งเล่ม
 * @returns {Array<{kind,label,lvl,pos?,line?,idx?}>}
 */
function navScanTab(t) {
  const items = [];
  if (!t) return items;
  if (t.editor) {
    let idx = 0;
    t.editor.view.state.doc.forEach((n, offset) => {
      const i = idx++;
      if (n.type.name === 'heading')
        items.push({ kind: 'heading', label: n.textContent || tt('ui.common.empty'), lvl: n.attrs.level, pos: offset, idx: i });
      else if (n.type.name === 'paragraph' && n.textContent.trim())
        items.push({ kind: 'beat', label: navTrunc(n.textContent), lvl: 4, pos: offset, idx: i });
      else if (n.type.name === 'blockquote' && n.textContent.trim())
        items.push({ kind: 'quote', label: navTrunc(n.textContent), lvl: 4, pos: offset, idx: i });
      // รายการ (จุดนำ/หมายเลข) เคยหายไปจากแผงทั้งก้อน — ฉากที่เป็นรายการล้วนจึงว่างเปล่า
      // และการกระโดดจากมุมมองทั้งเล่มก็หาปลายทางไม่เจอ เพราะฝั่งดิสก์มีแถวนี้แต่ฝั่งเอกสารไม่มี
      else if ((n.type.name === 'bullet_list' || n.type.name === 'ordered_list') && n.textContent.trim())
        items.push({ kind: 'beat', label: navTrunc(n.textContent), lvl: 4, pos: offset, idx: i });
    });
  } else if (t.sp) {
    const MAP = { scene: ['sceneHeading', 2], outline1: ['outline', 1], outline2: ['outline', 2],
      outline3: ['outline', 3], character: ['character', 3], transition: ['transition', 3], summary: ['summary', 4] };
    let idx = 0;
    t.sp.view.state.doc.forEach((n, offset) => {
      const i = idx++;
      const hit = MAP[n.attrs.el];
      if (!hit || !n.textContent.trim()) return;
      items.push({ kind: hit[0], label: n.textContent, lvl: hit[1], pos: offset, idx: i });
    });
  } else if (t.plain) {
    // [alpha.126] ★ เลิกพาร์สเอง — ใช้ `nav.js` ที่เขียนกฎเดียวกันไว้แล้วและมี unit test คุม
    const spLike = /\.(fountain|txt)$/i.test(t.file || '') || /^(\.|INT|EXT)/im.test(t.plain.value || '');
    const rows = spLike ? parseScreenplay(t.plain.value) : parseProse(t.plain.value);
    for (const r of rows) items.push({ kind: r.kind, label: r.label, lvl: r.level, line: r.line });
  }
  return items;
}

/** เลขบรรทัด .md ของทุกบล็อก (นิยาย) — ไม่มีข้อมูล = null */
function navMdLines(t) {
  if (!t || !t.editor) return null;
  try { return t.editor.mdLineCounts(); } catch { return null; }
}

/**
 * คอมเมนต์ของฉากที่เปิดอยู่ — อ่านแบบ async ครั้งเดียวต่อไฟล์ แล้วแคชไว้
 * (refreshOutline ต้องคืนค่าแบบซิงก์ จึงรอผลตรงนั้นไม่ได้ — ได้มาเมื่อไหร่ค่อยวาดรายการใหม่)
 */
let navCmt = { file: '', quotes: [] };
function navLoadComments(file) {
  if (!file || navCmt.file === file) return;
  navCmt = { file, quotes: [] };
  (async () => {
    try {
      const { commentStore, } = await import('./comments/comment-ui.js');
      const { openComments } = await import('./comments/comment-core.js');
      const all = await commentStore().list(file);
      if (navCmt.file !== file) return;                 // สลับฉากไปแล้วระหว่างอ่าน
      navCmt.quotes = openComments(all)
        .map((c) => String((c.position && c.position.quote) || '').trim())
        .filter((q) => q.length >= 3);
      if (navCmt.quotes.length && !navCtx.book) { navDecorate(navCtx.tab, navRows); navDrawList(); }
    } catch {}
  })();
}

/** เติม บรรทัด/หน้า/สถานะ ให้แถวที่สแกนมา (ตัวเดียวกับที่ relay ส่งข้ามหน้าต่าง) */
function navDecorate(t, items) {
  const counts = navMdLines(t);
  const brk = t && t.sp ? pageBreaks(t.sp.view) : (t && t.editor ? prosePageBreaks(t.editor.view) : []);
  const base = currentStartPage(t) || 1;
  const sid = t ? (t.file || '') : '';
  const quotes = (navCmt.file && t && navCmt.file === t.file) ? navCmt.quotes : [];
  for (const it of items) {
    if (counts && Number.isFinite(it.idx)) it.line = mdLineOfBlock(counts, it.idx);
    if (Number.isFinite(it.pos)) it.page = pageOfPos(brk, it.pos, base);
    it.sceneId = sid;
    it.locked = !!(t && t.locked);
    if (quotes.length) {
      const lbl = String(it.label || '');
      it.comments = quotes.filter((q) => lbl.includes(q.slice(0, 24))).length;
    }
  }
  withNavKeys(items);
  for (const it of items) {
    const mk = navMarkOf(it.key);
    if (mk) { it.color = mk.color || ''; it.star = !!mk.star; }
  }
  return items;
}

// ───────── การกระโดด ─────────
/**
 * กระโดดไปตำแหน่ง `pos` ของแท็บ — **ตัวเดียวที่ทุกเส้นทางใน Navigation เรียก**
 * ปิดช่องโหว่สองข้อของโค้ดเดิม: มุมมองหน้ากระดาษ (ตัวแก้ไขถูกซ่อน) และ TextSelection ที่ throw
 */
function navGotoPos(t, pos) {
  const ed = t && (t.sp || t.editor);
  if (!ed || !Number.isFinite(pos)) return false;
  // มุมมองหน้ากระดาษ = ตัวแก้ไขไม่ได้อยู่บนจอ → กลับมุมมองแก้ไขล่าสุดก่อน (เหมือนคลิกบนหน้ากระดาษ)
  const wasPage = isPageView(viewOfTab(t));
  if (wasPage) setSpView(lastEditView(t));
  navReveal(ed, pos);
  // ★ การสลับมุมมองพก `restoreViewScroll()` มาด้วย ซึ่ง **คืนตำแหน่งเลื่อนเดิมซ้ำอีกสองจังหวะ**
  // (rAF + 140ms · เพราะมุมมองหน้ากระดาษวาดแบบ async ความสูงยังไม่นิ่งในเฟรมแรก)
  // ถ้ากระโดดครั้งเดียวแล้วจบ จะถูกดีดกลับที่เดิมทันทีโดยไม่มีใครเห็นว่าเกิดอะไรขึ้น
  if (wasPage) {
    requestAnimationFrame(() => { try { navReveal(ed, pos); } catch {} });
    setTimeout(() => { try { navReveal(ed, pos); } catch {} }, 200);
  }
  return true;
}

/**
 * ══ ★★ [alpha.140] "โฟกัสก่อน → กระโดด → เลื่อนเองอีกชั้น" ══
 *
 * ทำไมต้องสามขั้น ทั้งที่ `ed.gotoPos()` มี `.scrollIntoView()` อยู่แล้ว:
 *
 * `scrollIntoView` ของ prosemirror เริ่มเดินหา "กล่องที่เลื่อนได้" จาก
 * **โหนดที่ DOM selection ชี้อยู่ ณ ตอนนั้น** (`domSelectionRange().focusNode`)
 * — การกดจากแผงข้าง ๆ ทำให้โฟกัสไม่ได้อยู่ในเอกสาร มันจึงเริ่มเดินจากที่อื่น
 * แล้วไม่เจอ `.pane` ที่เป็นตัวเลื่อนจริง
 *
 * อาการที่วัดได้ตรง ๆ (ลองหกแบบในหน้าต่างจริง): **กดครั้งแรกไม่เลื่อน
 * ครั้งที่สองเป็นต้นไปเลื่อน** — เพราะครั้งแรกเป็นตัวที่พาโฟกัสเข้าเอกสารให้เอง
 * ซึ่งตรงกับคำว่า "กดแล้วไม่ยอม jump" ของผู้ใช้เป๊ะ ๆ
 *
 * ตาข่ายชั้นสุดท้ายคือเลื่อน element ของบล็อกเป้าหมายด้วยตัวเอง — ไม่พึ่งกลไกของ
 * ไลบรารีที่เราคุมเงื่อนไขไม่ได้ · แล้วไฮไลต์ให้เห็นว่าไปโผล่ตรงไหน
 */
function navReveal(ed, pos) {
  try { ed.view.focus(); } catch {}
  ed.gotoPos(pos);
  requestAnimationFrame(() => {
    const node = navNodeAt(ed, pos);
    if (!node || !node.isConnected) return;
    try { node.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {}
    navFlashOver(node);
  });
}
/**
 * ไฮไลต์บล็อกปลายทาง — วาดเป็น **แผ่นทับ** ใน `.pane` ไม่ใช่คลาสบน DOM ของ ProseMirror
 *
 * เหตุผล: DOM ของบล็อกเป็นของ prosemirror — decoration ของตัวตรวจคำผิด/ลิงก์ Wiki เด้งมาเมื่อไหร่
 * มันสร้าง element ใหม่ทับ แล้วคลาสที่เราแปะไว้ก็หายไปเงียบ ๆ (เทสจับได้: ไฮไลต์อยู่บ้างหายบ้าง
 * ตามจังหวะที่ตัวตรวจคำผิดทำงานพอดี) · แผ่นทับเป็นลูกของ `.pane` จึงไม่มีใครมาลบให้
 */
function navFlashOver(node) {
  const pane = node.closest && node.closest('.pane');
  if (!pane) return;
  const r = node.getBoundingClientRect(), pr = pane.getBoundingClientRect();
  if (!r.height) return;
  const fl = el('div', 'k-nav-flash');
  fl.style.top = (r.top - pr.top + pane.scrollTop) + 'px';
  fl.style.left = (r.left - pr.left + pane.scrollLeft) + 'px';
  fl.style.width = r.width + 'px';
  fl.style.height = r.height + 'px';
  pane.appendChild(fl);
  setTimeout(() => fl.remove(), 1500);
}
/** element ของบล็อกที่ตำแหน่ง `pos` (ไม่เจอ = null) */
function navNodeAt(ed, pos) {
  let dom = null;
  try { dom = ed.view.nodeDOM(pos); } catch {}
  if (!dom) {
    try { dom = ed.view.domAtPos(Math.min(pos + 1, ed.view.state.doc.content.size)).node; } catch {}
  }
  const node = dom && dom.nodeType === 1 ? dom : (dom && dom.parentElement);
  return node && node.classList ? node : null;
}
/** กระโดดไปแถวหนึ่งของฉากที่เปิดอยู่ (แถวข้อความล้วนรู้แค่เลขบรรทัด) */
function navGotoItem(t, it) {
  if (!t || !it) return false;
  if (Number.isFinite(it.pos)) return navGotoPos(t, it.pos);
  if (t.plain && Number.isFinite(it.line)) {
    const lines = t.plain.value.split('\n');
    let off = 0; for (let i = 0; i < it.line && i < lines.length; i++) off += lines[i].length + 1;
    t.plain.focus(); t.plain.setSelectionRange(off, off);
    return true;
  }
  return false;
}

/**
 * [alpha.161 · S1] กระโดดไปจุดที่ "ค้นหาทั้งโปรเจกต์" เจอ — เดิม openHit() ทิ้งเลขบรรทัด/ตำแหน่งไปหมด
 * แท็บ .md: นับ "คำค้นครั้งที่ nth" ในเอกสารจริง (ไม่ใช้เลขบรรทัดของไฟล์ — บรรทัดว่าง/คอมเมนต์จัดหน้า
 *           ทำให้คลาดจากลำดับบล็อก) แล้วเดินผ่าน navGotoPos ตัวเดียวกับ Navigation (กฎ alpha.140)
 * แท็บข้อความล้วน (.json/.txt): เนื้อในช่อง = ไฟล์ดิบที่ดัชนีอ่าน → ใช้ตำแหน่งอักขระตรง ๆ แล้วเลือกคำนั้น
 * @param {{term?:string, nth?:number, start?:number, line?:number}} m
 * @returns {boolean}
 */
export function gotoSearchMatch(t, m) {
  if (!t || !m) return false;
  const term = String(m.term || '');
  // แท็บ .json/.txt (openPlainFile) เก็บ textarea ไว้ในแผง ไม่ใช่ที่ `t.plain` (ตัวนั้นเป็นของแท็บ .md แบบข้อความล้วน)
  const ta = t.plain || (t.pane && t.pane.querySelector('textarea.json-edit'));
  if (ta) {
    const v = ta.value;
    let off = Number.isFinite(m.start) && v.substr(m.start, term.length).toLowerCase() === term.toLowerCase() ? m.start : -1;
    if (off < 0 && term) {
      let k = -1, n = 0; const lv = v.toLowerCase(), lt = term.toLowerCase();
      while ((k = lv.indexOf(lt, k + 1)) >= 0) { off = k; if (n++ >= (m.nth || 0)) break; }
    }
    if (off < 0) {
      const lines = v.split('\n'); off = 0;
      for (let i = 0; i < (m.line || 1) - 1 && i < lines.length; i++) off += lines[i].length + 1;
    }
    ta.focus();
    ta.setSelectionRange(off, off + (off >= 0 && term ? term.length : 0));
    // textarea ไม่เลื่อนตามช่วงที่เลือกเสมอไป — คิดตำแหน่งบรรทัดเองแล้ววางไว้กลางช่อง
    const lineIdx = v.slice(0, off).split('\n').length - 1;
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 18;
    ta.scrollTop = Math.max(0, lineIdx * lh - ta.clientHeight / 2);
    return true;
  }
  const ed = t.sp || t.editor;
  if (!ed || !ed.view) return false;
  // สแกนบล็อกข้อความ → { text, map } ให้ตัวนับบริสุทธิ์ (nav-model.nthTextPos) · leaf ในบรรทัด (รูป/ขึ้นบรรทัด) กิน pos 1
  const blocks = [];
  ed.view.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = ''; const map = [];
    node.forEach((ch, off) => {
      const at = pos + 1 + off;
      if (ch.isText) { for (let i = 0; i < ch.text.length; i++) { text += ch.text[i]; map.push(at + i); } }
      else { text += '￼'; map.push(at); }
    });
    blocks.push({ text, map });
    return false;
  });
  const p = nthTextPos(blocks, term, m.nth || 0);
  return navGotoPos(t, p === null ? 0 : p);
}

// ───────── วาดแผง ─────────
/** แถบเครื่องมือของแผง — สร้างครั้งเดียวแล้วอยู่ยาว (ไม่งั้นพิมพ์ค้นหาแล้วช่องหายทุก 400ms) */
function navChrome(box) {
  let bar = box.querySelector(':scope > .nav-bar');
  if (bar) return bar;
  bar = el('div', 'nav-bar');

  // แถวที่ 1 — ค้นหา
  const row1 = el('div', 'nav-row');
  const q = el('input', 'nav-q'); q.type = 'search'; q.placeholder = tt('ui.nav.searchPh');
  q.value = navUI.q || '';
  q.oninput = () => { navUI.q = q.value; navUI.page = 0; saveNavUI(); navDrawList(); };
  row1.append(q);
  const info = el('span', 'nav-legend-btn', 'ℹ');
  info.title = tt('ui.nav.legendTitle');
  info.onclick = (e) => navLegendMenu(e.clientX, e.clientY);
  row1.append(info);
  bar.append(row1);

  // แถวที่ 2 — ชิปกลุ่มชนิด + ดาว + สี
  const row2 = el('div', 'nav-row nav-chips');
  for (const g of NAV_GROUPS) {
    const c = el('span', 'nav-chip', NAV_GROUP_ICON[g] + ' ' + tt(NAV_GROUP_KEYS[g]));
    c.dataset.g = g;
    c.title = tt(NAV_GROUP_KEYS[g]);
    c.onclick = () => {
      const i = navUI.groups.indexOf(g);
      if (i >= 0) navUI.groups.splice(i, 1); else navUI.groups.push(g);
      navUI.page = 0; saveNavUI(); navSyncChips(); navDrawList();
    };
    row2.append(c);
  }
  const st = el('span', 'nav-chip nav-chip-star', gi('star-filled'));
  st.dataset.star = '1'; st.title = tt('ui.nav.onlyStar');
  st.onclick = () => { navUI.star = !navUI.star; navUI.page = 0; saveNavUI(); navSyncChips(); navDrawList(); };
  row2.append(st);
  for (const [name, hex] of SCENE_COLORS) {
    const c = el('span', 'nav-chip nav-chip-color');
    c.dataset.color = name; c.style.setProperty('--c', hex);
    c.title = dataLabel(name);
    c.onclick = () => {
      const i = navUI.colors.indexOf(name);
      if (i >= 0) navUI.colors.splice(i, 1); else navUI.colors.push(name);
      navUI.page = 0; saveNavUI(); navSyncChips(); navDrawList();
    };
    row2.append(c);
  }
  const clr = el('span', 'nav-chip nav-chip-clear', gi('close'));
  clr.title = tt('ui.nav.clearFilter');
  clr.onclick = () => {
    navUI.q = ''; navUI.groups = []; navUI.colors = []; navUI.star = false; navUI.flags = []; navUI.page = 0;
    const inp = box.querySelector('.nav-q'); if (inp) inp.value = '';
    saveNavUI(); navSyncChips(); navDrawList();
  };
  row2.append(clr);
  bar.append(row2);

  // หัวคอลัมน์
  const head = el('div', 'nav-cols');
  head.append(el('span', 'nav-col-loc', tt('ui.nav.colLoc')), el('span', 'nav-col-text', tt('ui.nav.colText')));
  bar.append(head);

  box.prepend(bar);
  navSyncChips();
  return bar;
}
/** ทาสถานะ "ติ๊กอยู่" ให้ชิปตามตัวกรองปัจจุบัน */
function navSyncChips() {
  const box = $('#outline'); if (!box) return;
  box.querySelectorAll('.nav-chip[data-g]').forEach((c) => c.classList.toggle('on', navUI.groups.includes(c.dataset.g)));
  box.querySelectorAll('.nav-chip[data-color]').forEach((c) => c.classList.toggle('on', navUI.colors.includes(c.dataset.color)));
  box.querySelector('.nav-chip-star')?.classList.toggle('on', !!navUI.star);
  box.querySelector('.nav-bar')?.classList.toggle('nav-filtered', navFilterOn());
}
/** คำอธิบายสัญลักษณ์ — ผู้ใช้ขอให้ "บอกสถานะของจุดนั้น ๆ" จึงต้องมีที่อธิบายว่าอะไรคืออะไร */
function navLegendMenu(x, y) {
  const items = [{ label: '<b>' + tt('ui.nav.legendTitle') + '</b>', disabled: true }];
  for (const f of NAV_FLAG_DEFS) items.push({ text: f.mark + '  ' + tt(f.key), disabled: true });
  items.push('-', { text: tt('ui.nav.legendBold'), disabled: true },
                   { text: tt('ui.nav.legendRow'), disabled: true });
  popupMenu(x, y, items);
}

/** เมนูคลิกขวาบนแถว — ตั้งสี/ดาว (ข้อ 2 ของผู้ใช้) */
function navRowMenu(x, y, it) {
  if (!it || !it.key) return;
  const cur = navMarkOf(it.key) || {};
  const items = [
    { text: (cur.star ? gi('star-filled') + ' ' : gi('star-outline') + ' ') + tt(cur.star ? 'ui.nav.unstar' : 'ui.nav.star'),
      click: () => setNavMark(it.key, { star: !cur.star }) },
    '-',
  ];
  for (const [name, hex] of SCENE_COLORS) {
    items.push({ label: '<span class="nav-swatch" style="background:' + hex + '"></span> ' + dataLabel(name),
                 click: () => setNavMark(it.key, { color: name }) });
  }
  items.push('-', { text: tt('ui.nav.clearColor'), click: () => setNavMark(it.key, { color: '' }) });
  popupMenu(x, y, items);
}

/** แถวหนึ่งใน Navigation — ใช้ร่วมทั้งหน้าต่างหลักและหน้าต่างที่ฉีกออกไป (หน้าตาต้องเหมือนกันเป๊ะ) */
function outlineItemEl(it, onJump) {
  const flags = navFlags(it);
  const d = el('div', 'ol-item nav-' + it.kind + ' lvl' + it.lvl);
  d.dataset.kind = it.kind || '';
  if (it.key) d.dataset.navKey = it.key;              // e2e/คลิกขวาอ้างแถวด้วยคีย์นี้
  if (flags.includes('choice')) d.classList.add('nav-choice');
  if (it.color) d.style.setProperty('--row-color', colorHex(it.color));
  d.classList.toggle('nav-colored', !!it.color);
  const loc = el('span', 'nav-col-loc', navLocText(it));
  const txt = el('span', 'nav-col-text');
  if (it.star) { const s = el('span', 'nav-mk nav-mk-star'); s.append(icon('star-filled', 13)); txt.append(s); }   // [alpha.164 ข้อ E5]
  txt.append(el('span', 'nav-label', it.label || tt('ui.common.empty')));
  for (const f of flags) {
    if (f === 'star' || f === 'color' || f === 'choice') continue;
    const def = NAV_FLAG_DEFS.find((x) => x.id === f);
    if (def) {
      const s = el('span', 'nav-mk nav-mk-' + f);
      if (def.icon) s.append(icon(def.icon, 13)); else s.textContent = def.mark;
      s.title = tt(def.key); txt.append(s);
    }
  }
  if (it.choices > 0) {
    const s = el('span', 'nav-mk nav-mk-choice');
    s.append(icon('subdirectory-right', 13), document.createTextNode(String(it.choices)));
    s.title = tt('ui.nav.flagChoice'); txt.append(s);
  }
  d.append(loc, txt);
  d.title = (it.label || '') + (it.status ? ' — ' + dataLabel(it.status) : '');
  d.onclick = onJump;
  d.oncontextmenu = (e) => { e.preventDefault(); navRowMenu(e.clientX, e.clientY, it); };
  return d;
}

/** สีจริงของชื่อสีไทย (ไม่รู้จัก = ใช้ตามที่ให้มา เผื่อผู้ใช้ใส่ hex เอง) */
function colorHex(name) {
  const hit = SCENE_COLORS.find((c) => c[0] === name);
  return hit ? hit[1] : (String(name || '').startsWith('#') ? name : 'var(--accent)');
}

// รายการที่คำนวณไว้ล่าสุด — ตัวกรอง/แบ่งหน้า/คลิก อ่านจากก้อนนี้ (ไม่สแกนเอกสารซ้ำทุกครั้งที่พิมพ์)
let navRows = [];
let navCtx = { tab: null, book: false };
const _navPageOf = new Map();          // [alpha.159 · QoL] ไฟล์ฉาก → หน้าที่ดูอยู่ในแผง Navigation
let _navPageKey = '';

/** วาดเฉพาะ "รายการ" (แถบเครื่องมือคงอยู่) — เรียกทุกครั้งที่ตัวกรอง/หน้าเปลี่ยน */
function navDrawList() {
  const box = $('#outline'); if (!box) return;
  let host = box.querySelector(':scope > .nav-list');
  if (!host) { host = el('div', 'nav-list'); box.append(host); }
  const keep = host.scrollTop;
  host.replaceChildren();

  const shown = filterNav(navRows, navUI);
  const perPage = clampPerPage(state.settings.navPerPage);
  // [alpha.159 · QoL] จำ "หน้าที่ดูอยู่" แยกต่อฉาก — สลับไปฉากอื่นแล้วกลับมา ต้องไม่ต้องไล่หน้าใหม่
  // (เดิมเลขหน้าเป็นก้อนเดียวทั้งแผง: ฉากใหม่ได้หน้าค้างของฉากเก่า · กลับมาก็เสียหน้าเดิม)
  const pk = navCtx.book ? '::book::' : ((navCtx.tab && navCtx.tab.file) || '');
  if (pk !== _navPageKey) { navUI.page = _navPageOf.get(pk) || 0; _navPageKey = pk; }
  const paged = state.settings.navMode === 'page'
    ? navSlice(shown, navUI.page, perPage)
    : { page: 0, pages: 1, rows: shown };
  navUI.page = paged.page;
  _navPageOf.set(pk, paged.page);

  if (!shown.length) {
    host.append(el('div', 'dim', navFilterOn() ? tt('ui.nav.noMatch') : tt('ui.app.notHasHeadingHead')));
  } else {
    for (const it of paged.rows) {
      const row = outlineItemEl(it, () => {
        host.querySelectorAll('.ol-item.on').forEach((n) => n.classList.remove('on'));
        row.classList.add('on');                 // แถวที่กดล่าสุดค้างไว้ให้เห็นว่าอยู่ตรงไหน
        navJumpRow(it);
      });
      host.append(row);
    }
  }

  // แถบแบ่งหน้า (โหมด "แบ่งหน้า" เท่านั้น — โหมดเลื่อนไม่มีอะไรมาบัง)
  let foot = box.querySelector(':scope > .nav-foot');
  if (state.settings.navMode === 'page') {
    if (!foot) { foot = el('div', 'nav-foot'); box.append(foot); }
    foot.replaceChildren();
    const mk = (label, to, dis) => {
      const b = el('button', 'nav-pg', label);
      b.disabled = !!dis;
      b.onclick = () => { navUI.page = to; navDrawList(); };
      return b;
    };
    foot.append(mk('‹‹', 0, paged.page === 0), mk('‹', paged.page - 1, paged.page === 0),
                el('span', 'nav-pg-lbl', ttf('ui.nav.pageOf', paged.page + 1, paged.pages)),
                mk('›', paged.page + 1, paged.page + 1 >= paged.pages),
                mk('››', paged.pages - 1, paged.page + 1 >= paged.pages));
    foot.append(el('span', 'nav-pg-n', ttf('ui.nav.rowCount', shown.length)));
  } else if (foot) foot.remove();

  host.scrollTop = keep;
  navSyncChips();
  return shown.length;
}

/** คลิกแถว → กระโดด (แยกเส้นทาง "ฉากที่เปิดอยู่" กับ "ทั้งเล่ม") */
async function navJumpRow(it) {
  if (navCtx.book) return navJumpBook(it);
  return navGotoItem(navCtx.tab || state.active, it);
}

// Navigation — จับหัวข้อ/ย่อหน้า/หัวฉากของฉากที่เปิดอยู่ (แบบ Final Draft) + โหมดนิยาย
function refreshOutline() {
  const box = $('#outline');
  if (!box) return;
  // [alpha.66r2 ข้อ 1] Navigation วาดใหม่ทุกครั้งที่เอกสารเปลี่ยน — กล่องเดิมยังอยู่ (ล้างแค่ลูก)
  const keepTop = box.scrollTop, keepLeft = box.scrollLeft;
  const back = () => { box.scrollTop = keepTop; box.scrollLeft = keepLeft; };
  // [alpha.68] หน้าต่าง Navigation ที่ฉีกออกมา ไม่มี ProseMirror ให้อ่าน (คนละ context)
  if (PANEL_WIN) { box.innerHTML = ''; drawRemoteOutline(box); back(); return; }

  navChrome(box);
  let head = box.querySelector(':scope > .nav-head');
  if (!head) { head = el('div', 'nav-head'); box.querySelector(':scope > .nav-bar').after(head); }
  head.replaceChildren();

  // [alpha.126] มุมมองทั้งเล่ม — ไม่พึ่งเอกสารที่เปิดอยู่ จึงต้องมาก่อนด่านเช็คแท็บข้างล่าง
  if (navWholeBook && state.root) {
    navCtx = { tab: null, book: true };
    head.append(el('span', 'nav-scene', gi('books') + ' ' + tt('ui.app.navWholeBook')));
    drawBookOutline().then(back);
    return;
  }
  const t = state.active;
  navCtx = { tab: t, book: false };
  if (!t || t.wiki || t.gal || t.isJson || t.net || t.dash || t.planner || (!t.editor && !t.sp && !t.plain)) {
    navRows = [];
    head.append(el('span', 'nav-scene dim', tt('ui.app.openSceneViewNavigation')));
    navDrawList();
    relayOutline('', '', [], tt('ui.app.openSceneViewNavigation'));
    return;
  }
  head.append(el('span', 'nav-scene', (t.sp ? gi('film') + ' ' : gi('book-open') + ' ') + (t.title || tt('ui.app.scene2'))));

  navLoadComments(t.file || '');
  let items = navScanTab(t);
  if (!navShowBeats) items = items.filter((r) => !['beat', 'quote', 'character'].includes(r.kind));
  navRows = navDecorate(t, items);
  relayOutline(t.file || '', t.title || '', navRows, tt('ui.app.notHasHeadingHead'), !!t.sp);
  navDrawList();
  back();
}
// ═══════════ [alpha.126] ★ Navigation มุมมอง "ทั้งเล่ม" ═══════════
//
// `src/nav.js` (พาร์สโครงเรื่องจากเนื้อฉากดิบ · บริสุทธิ์ · มี unit test) ตอบคำถามที่แผงเดิม
// ตอบไม่ได้เลย: "ทั้งบทมีหัวฉากอะไรบ้าง" — ต้องเปิดฉากทีละไฟล์ไปดู
let navWholeBook = localStorage.getItem('k2-nav-book') === '1';
function setNavWholeBook(on) {
  navWholeBook = !!on;
  localStorage.setItem('k2-nav-book', navWholeBook ? '1' : '0');
  $('#nav-book-btn')?.classList.toggle('on', navWholeBook);
  refreshOutline();
  return navWholeBook;
}
/** เทส/แผงอื่นถามสถานะได้ */
export function navWholeBookOn() { return navWholeBook; }

/** โครงของทั้งฉบับร่างที่ฉากปัจจุบันอยู่ — อ่านจากไฟล์บนดิสก์ ไม่ใช่จากเอกสารที่เปิดอยู่ */
export async function buildBookNavigation() {
  const ctx = await sceneCtx();
  if (!ctx) return [];
  const all = await listScenes(state.root);
  const rows = all.filter((s) => s.draftPath === ctx.dPath);
  const scenes = [];
  for (const r of rows) {
    let body = '', fmt = '';
    // ★ ฉากที่ "เปิดค้างและยังไม่บันทึก" ต้องใช้เนื้อในหน่วยความจำ ไม่ใช่ของบนดิสก์
    //   (กฎถาวรข้อ 5: สิ่งที่ผู้ใช้เห็นบนจอกับที่อื่นต้องมาจากแหล่งเดียวกัน)
    //   ไม่งั้นรายการโชว์ข้อความเก่า กดแล้วหาบล็อกนั้นในเอกสารไม่เจอ = กระโดดไม่ได้
    const openTab = [...state.tabs.values()].find((tb) => tb.file && samePath(tb.file, r.path));
    if (openTab && openTab.dirty) {
      const edm = openTab.editor || openTab.sp;
      try { if (edm) { body = edm.getMarkdown(); fmt = openTab.sp ? 'screenplay' : 'prose'; } } catch {}
    }
    // ★ ชนิดของฉาก (นิยาย/บท) อยู่ใน **frontmatter ของ .md** ไม่ใช่ scenes.json
    //   ของเดิมอ่านจาก `r.row.format` ซึ่งไม่มีค่าเสมอ → ฉากบทภาพยนตร์ถูกพาร์สแบบนิยาย
    //   กลายเป็น "ย่อหน้าเดียวยาว ๆ" ทั้งฉาก แล้วกดแล้วกระโดดไม่ได้เพราะไม่มีแถวไหนตรงกับ
    //   บล็อกจริงในตัวแก้ไขบทเลยสักแถว
    if (!body) {
      try {
        const f = parseMdFile(await kapi.readFile(r.path));
        body = f.body || ''; fmt = fmt || f.meta.format || '';
      } catch {}
    }
    scenes.push({ id: r.id, title: r.title, status: r.row.status || '', color: r.row.color || '',
                  wordCount: r.row.wordCount || 0, flag: !!r.row.isFavorite,
                  format: fmt || r.row.format || 'prose', body, path: r.path,
                  choices: Array.isArray(r.row.choices) ? r.row.choices.length : 0 });
  }
  const nodes = buildNavigation(scenes, { showBeats: navShowBeats });
  // ผูก path/สถานะของฉากกลับให้ทุกแถว — ตอนคลิกต้องรู้ว่าจะเปิดไฟล์ไหน
  const byId = new Map(scenes.map((s) => [s.id, s]));
  return nodes.map((n) => {
    const sc = byId.get(n.sceneId) || {};
    return { ...n, path: sc.path || '', sceneTitle: sc.title || '',
             choices: n.kind === 'scene' ? (sc.choices || 0) : 0,
             empty: n.kind === 'scene' ? !String(sc.body || '').trim() : false };
  });
}

/** วาดมุมมอง "ทั้งเล่ม" ลงกล่อง Navigation */
async function drawBookOutline() {
  const box = $('#outline');
  let host = box.querySelector(':scope > .nav-list');
  if (!host) { host = el('div', 'nav-list'); box.append(host); }
  host.replaceChildren(el('div', 'dim', tt('ui.common.busySearch')));
  let nodes = [];
  try { nodes = await buildBookNavigation(); }
  catch (e) { log('warn', tt('ui.app.navBookFail'), e); }
  for (const n of nodes) { n.lvl = n.level; if (n.flag) n.star = true; }
  withNavKeys(nodes);
  for (const n of nodes) {
    const mk = navMarkOf(n.key);
    if (mk) { n.color = mk.color || n.color; n.star = mk.star || n.star; }
  }
  navRows = nodes;
  return navDrawList();
}

/**
 * ★ กระโดดจากมุมมองทั้งเล่ม — เปิดฉากก่อน แล้ว **หาแถวจริงในเอกสาร**
 *
 * ของเดิมส่ง `n.line` (เลขบรรทัดในไฟล์ .md) เข้า `gotoLineInActive()` ซึ่งนับเป็นลำดับบล็อก
 * — คนละหน่วยกัน จึงกระโดดผิดที่ หรือ (ปกติกว่า) ไม่กระโดดเลยแล้วคืน false เงียบ ๆ
 * ตอนนี้ใช้ตัวสแกนเอกสารตัวเดียวกับที่วาดรายการ แล้วจับคู่ด้วย ชนิด+ข้อความ+ลำดับซ้ำ
 * → ตรงกันเสมอไม่ว่า .md จะมีบรรทัดว่าง/frontmatter/คอมเมนต์กี่บรรทัด
 */
async function navJumpBook(n) {
  if (!n || !n.path) return false;
  await openScene(n.path, n.label);
  const t = state.active;
  if (!t) return false;
  if (n.kind === 'scene') { navGotoPos(t, 0); return true; }   // แถวฉาก = ไปต้นฉาก
  // รอให้ตัวแก้ไขมีเนื้อหาจริงก่อน (openScene วาดแบบ async)
  for (let i = 0; i < 20 && !(t.editor || t.sp || t.plain); i++) await new Promise((r) => setTimeout(r, 40));
  const scanned = navScanTab(t);
  const hit = navMatchRow(scanned, n);
  if (!hit) { navGotoPos(t, 0); return false; }     // อย่างน้อยพาไปต้นฉากที่ถูกใบ
  return navGotoItem(t, hit);
}

/** [alpha.68] ส่งรายการ Navigation ให้หน้าต่างที่ฉีกแผงนี้ออกไป (ไม่มีใครฉีก = ไม่ทำอะไรเลย) */
function relayOutline(file, title, items, empty, sp) {
  if (PANEL_WIN || !isTornOff('outline')) return false;
  try { kapi.broadcast && kapi.broadcast(outlineMsg(file, title, items, { empty, sp })); } catch {}
  return true;
}
/** [alpha.68] วาด Navigation ในหน้าต่างแผงจากรายการที่หน้าต่างหลักส่งมา */
function drawRemoteOutline(box) {
  const msg = state._remoteOutline;
  if (!msg) { box.append(el('div', 'dim', tt('ui.panel.waitingMain'))); return false; }
  if (!msg.items.length) { box.append(el('div', 'dim', msg.empty || tt('ui.app.notHasHeadingHead'))); return true; }
  const head = el('div', 'nav-head');
  head.append(el('span', 'nav-scene', (msg.sp ? gi('film') + ' ' : gi('book-open') + ' ') + (msg.title || tt('ui.app.scene2'))));
  box.append(head);
  for (const it of msg.items) box.append(outlineItemEl(it, () => requestGotoInMain(it)));
  return true;
}
// ---------------- Find/replace bar ----------------
/**
 * [alpha.162 · W4 ข้อ 5] `toReplace` = เปิดแถบเดียวกันแต่ไปยืนที่ช่อง "แทนที่" (Ctrl+H)
 * เดิมไม่มีคำสั่งแทนที่เลย — ช่องมีอยู่แล้วในแถบค้นหา แต่ไปถึงได้ทางเดียวคือกด Ctrl+F แล้ว Tab
 */
function openFind(toReplace = false) {
  $('#findbar').classList.add('on');
  const box = toReplace ? $('#find-r') : $('#find-q');
  box.focus(); box.select();
}
function doFind() {
  const ed = state.active?.editor; if (!ed) return 0;
  const n = setQuery(ed.view, $('#find-q').value);
  $('#find-n').textContent = n ? n + tt('ui.app.result') : tt('ui.common.notFound');
  return n;
}
function closeFind() {
  $('#findbar').classList.remove('on');
  const ed = state.active?.editor;
  if (ed) setQuery(ed.view, '');
  state.active?.editor?.focus();
}

/**
 * ══ [alpha.97 ข้อ 7] ★ รูปในคลิปบอร์ดอยู่ที่ `items` ไม่ใช่ `files` ══
 *
 * ผู้ใช้: *"copy รูป แล้ววางไม่ได้"*
 *
 * `clipboardData.files` มีของก็ต่อเมื่อสิ่งที่คัดลอกมาเป็น **ไฟล์จริง** (ลากจาก Explorer /
 * Ctrl+C ที่ไอคอนไฟล์) · แต่การ "คัดลอกรูป" จากเบราว์เซอร์ · โปรแกรมดูรูป · เครื่องมือจับภาพ
 * วางบิตแมปดิบลงคลิปบอร์ด ซึ่งโผล่ที่ `clipboardData.items` เท่านั้น (`kind:'file'`)
 * — ตัวกรองเดิมจึงเห็นเป็นศูนย์รายการทุกครั้ง แล้วปล่อยผ่านไปเงียบ ๆ
 *
 * ⚠ ต้องเรียก `getAsFile()` **ก่อน await ตัวแรก** — DataTransfer ตายทันทีที่จบรอบอีเวนต์
 * @returns {File[]}
 */
function clipboardImages(dt) {
  if (!dt) return [];
  const isImg = (f) => f && typeof f.type === 'string' && f.type.startsWith('image/');
  const out = [...(dt.files || [])].filter(isImg);
  if (out.length) return out;
  for (const it of [...(dt.items || [])]) {
    if (it.kind !== 'file' || !String(it.type || '').startsWith('image/')) continue;
    const f = it.getAsFile();
    if (isImg(f)) out.push(f);
  }
  return out;
}

// วาง/ลากไฟล์รูปเข้าเอกสาร → เขียนเข้าคลัง Images (base64) แล้วแทรกอ้างอิงแบบสัมพัทธ์
async function importImageFile(file, t) {
  try {
    const buf = await file.arrayBuffer();
    let bin = ''; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const safe = (file.name || 'image.png').replace(/[^\w.\-\u0E00-\u0E7F]+/g, '_');
    const imgDir = await kapi.join(state.root, 'Images');
    const saved = await kapi.writeImageData(imgDir, safe, b64);
    const sceneDir = t.file.replace(/[\\/][^\\/]*$/, '');
    const rel = await kapi.relative(sceneDir, await kapi.join(imgDir, saved));
    const cap = saved.replace(/\.[^.]+$/, '');
    (t.editor || t.sp).insertImage(rel, cap, `![${cap}](${rel})`);
    markDirty(t);
    setStatus(tt('ui.app.insertImage') + saved);
  } catch (err) { setStatusError(tt('ui.app.insertImageNotOk') + errText(err)); }
}

/**
 * [alpha.97 ข้อ 5] ★ ปุ่มแทรกรูปเป็น "สวิตช์" — เคอร์เซอร์แตะรูปอยู่ = กดแล้วเอารูปออก
 * (ไม่ใช่เปิดตัวเลือกรูปซ้อนเข้าไปอีกรูป ซึ่งเป็นของเดิม)
 */
async function insertImage() {
  const t0 = state.active;
  const ed0 = t0 && t0.editor;
  if (ed0 && ed0.removeFigure()) {
    markDirty(t0);
    refreshToolbar();
    setStatus(tt('ui.app.imageRemoved'));
    return;
  }
  const it = await pickImage(state.root);          // เลือกจากคลังแบบเห็นรูปจริง (แบบ v1)
  if (!it) return;
  return insertImageByName(it.file, it.caption);
}

// แทรกรูปจากคลังลงฉากที่เปิดอยู่ — `fileName` เป็น **path สัมพัทธ์กับ Images/**
// ('sunset.png' หรือ 'ตัวละคร/ref.png' — alpha.63 รับทั้งสองแบบ) · ใช้ร่วมกับคลิกขวาใน Explorer (ข้อ 6)
async function insertImageByName(fileName, caption) {
  const t = state.active;
  if (!t || !(t.editor || t.sp)) { setStatus(tt('ui.common.openSceneBeforeInsertImage')); return; }
  const imgDir = await kapi.join(state.root, 'Images');
  const sceneDir = t.file.replace(/[\\/][^\\/]*$/, '');
  const rel = await kapi.relative(sceneDir, await kapi.join(imgDir, ...String(fileName).split('/')));
  const cap = caption || String(fileName).split('/').pop().replace(/\.[^.]+$/, '');
  (t.editor || t.sp).insertImage(rel, cap, `![${cap}](${rel})`);
  markDirty(t);
  setStatus(tt('ui.app.insertImageDone') + fileName);
}

// ---------------- เมนูจาก main process ----------------
/**
 * [alpha.65r4] เดิมรีเฟรชทีไรก็ดีดลงล่างสุดทุกครั้ง → อ่านบรรทัดเก่าไม่ได้เลยเพราะโดนดีดหนีตลอด
 * ตอนนี้: **ตามบรรทัดล่าสุดเฉพาะตอนที่ผู้ใช้อยู่ล่างสุดอยู่แล้ว** เลื่อนขึ้นไปอ่านเมื่อไหร่ = ล็อกอยู่ตรงนั้น
 * (พฤติกรรมเดียวกับ console ของเบราว์เซอร์/โปรแกรมแชท)
 */
const LOG_STICK_PX = 24;                        // ห่างจากก้นไม่เกินเท่านี้ = ถือว่า "อยู่ล่างสุด"
export function logAtBottom(body) {
  if (!body) return true;
  return body.scrollHeight - body.scrollTop - body.clientHeight <= LOG_STICK_PX;
}
// ── [alpha.72 ข้อ 5] แผงบันทึกแบบใช้งานได้จริง: กรองระดับ · กรองที่มา · ค้นหา · กางรายละเอียด ──
// ของเดิมเทข้อความดิบทั้งก้อนลงกล่องเดียว → หา error ไม่เจอ กรองไม่ได้ ไล่ย้อนไม่ได้
const logView = { levels: new Set(['error', 'warn', 'info']), source: '', q: '', open: new Set() };
let _logSeq = -1;                    // seq ล่าสุดที่วาดไปแล้ว — กันวาดซ้ำทั้งแผงทุก 2 วินาที

// [alpha.165] ดูย้อนหลัง: day = '' = เซสชันนี้ (สด · จากหน่วยความจำ) · 'YYYY-MM-DD' = ไฟล์ของวันนั้น (อ่านอย่างเดียว)
const LOG_DAY = { day: '', recs: [] };
async function renderLogPanel(force) {
  const body = $('#log-body'); if (!body) return;
  const host = body.parentElement;
  if (host && !host.querySelector('.k-log-bar')) buildLogBar(host, body);
  if (LOG_DAY.day && !force) return;                 // ไฟล์ของวันก่อน ๆ ไม่เปลี่ยน — ไม่วาดใหม่ตาม log สด
  const recs = LOG_DAY.day ? LOG_DAY.recs : logStore.all();
  if (!force && _logSeq === logStore.lastSeq() && body.dataset.f === logKey()) return;
  _logSeq = logStore.lastSeq(); body.dataset.f = logKey();
  const stick = logAtBottom(body);
  const keepTop = body.scrollTop;
  const shown = filterLogs(recs, logView).slice(-600);
  body.replaceChildren();
  body.classList.add('k-log-list');
  if (!shown.length) {
    body.append(el('div', 'dim', recs.length
      ? tt('ui.app.notHasLineAt2')
      : (LOG_DAY.day ? tt('ui.log.dayEmpty') : tt('ui.app.notHasSave'))));
  }
  for (const r of shown) body.append(logRow(r));
  syncLogBar(host, recs);
  body.scrollTop = stick ? body.scrollHeight : keepTop;
  updateLogFollowBadge(body, stick);
}
function logKey() { return [...logView.levels].sort().join(',') + '|' + logView.source + '|' + logView.q + '|' + LOG_DAY.day; }

function logRow(r) {
  const row = el('div', 'k-log-row k-log-' + r.level);
  row.dataset.seq = String(r.seq);
  row.append(el('span', 'k-log-time', shortTime(r.ts)));
  row.append(el('span', 'k-log-lv', LEVEL_META[r.level].icon));
  if (r.source) row.append(el('span', 'k-log-src', r.source));
  row.append(el('span', 'k-log-msg', r.msg));
  if (r.count > 1) row.append(el('span', 'k-log-count', gi('times') + r.count));
  if (r.detail) {
    row.classList.add('k-log-has-detail');
    row.title = tt('ui.app.clickViewDetail');
    const det = el('pre', 'k-log-detail', r.detail);
    if (!logView.open.has(r.seq)) det.style.display = 'none';
    row.append(det);
    row.onclick = () => {
      const on = det.style.display === 'none';
      det.style.display = on ? '' : 'none';
      if (on) logView.open.add(r.seq); else logView.open.delete(r.seq);
    };
  }
  return row;
}

/** แถบเครื่องมือของแผงบันทึก — สร้างครั้งเดียว แล้วอัปเดตตัวเลขทีหลัง */
function buildLogBar(host, body) {
  const bar = el('div', 'k-log-bar');
  for (const lv of LEVELS) {
    const b = el('button', 'k-log-chip k-log-chip-' + lv + (logView.levels.has(lv) ? ' on' : ''),
                 LEVEL_META[lv].icon + ' ' + LEVEL_META[lv].label);
    b.dataset.lv = lv;
    b.title = tt('ui.app.showHideLevel') + LEVEL_META[lv].label;
    b.onclick = () => {
      if (logView.levels.has(lv)) logView.levels.delete(lv); else logView.levels.add(lv);
      b.classList.toggle('on', logView.levels.has(lv));
      renderLogPanel(true);
    };
    bar.append(b);
  }
  const sel = el('select', 'k-log-src-sel'); sel.title = tt('ui.app.filter');
  sel.onchange = () => { logView.source = sel.value; renderLogPanel(true); };
  bar.append(sel);
  const q = el('input', 'k-log-q'); q.type = 'search'; q.placeholder = tt('ui.app.searchSave');
  q.oninput = () => { logView.q = q.value; renderLogPanel(true); };
  bar.append(q);
  const clr = el('button', 'k-log-btn k-log-clear', tt('ui.common.clear2'));
  clr.title = tt('ui.app.clearSaveShowFile');
  clr.onclick = () => { logStore.clear(); LOG_BUF.length = 0; logView.open.clear(); renderLogPanel(true); };
  bar.append(clr);
  host.insertBefore(bar, body);
  host.insertBefore(buildLogDayBar(), body);
  // มีของใหม่เข้ามา → วาดทันที ไม่ต้องรอ timer
  onLog(() => { if (isPanelOpen('log')) renderLogPanel(); });
}

/**
 * [alpha.165] ผู้ใช้: "log ยังไม่มีตัวชี้ไปยัง folder ที่เก็บ log เลย จะดูย้อนหลังยังไง"
 * แถวที่สองของแผงบันทึก: เลือกวัน (เซสชันนี้ = สด · วันก่อน ๆ = อ่านไฟล์) · ที่อยู่โฟลเดอร์ · ปุ่มเปิดโฟลเดอร์ (มีป้ายข้อความ)
 */
function buildLogDayBar() {
  const bar = el('div', 'k-log-bar k-log-daybar');
  const sel = el('select', 'k-log-day');
  sel.title = tt('ui.log.dayPick');
  const fill = async () => {
    const keep = LOG_DAY.day;
    let days = [];
    try { days = (kapi.logList ? await kapi.logList() : []) || []; } catch {}
    sel.replaceChildren();
    const o0 = el('option', null, tt('ui.log.daySession')); o0.value = ''; sel.append(o0);
    for (const d of days) {
      const o = el('option', null, ttf('ui.log.dayOption', fmtDate(d.day + 'T12:00:00'), Math.max(1, Math.round((d.size || 0) / 1024))));
      o.value = d.day; sel.append(o);
    }
    sel.value = keep;
  };
  sel.onfocus = () => { fill(); };                       // มีไฟล์วันใหม่ระหว่างเปิดแผง — เติมรายการสดทุกครั้งที่กดเลือก
  sel.onchange = async () => {
    const day = sel.value;
    LOG_DAY.day = day; LOG_DAY.recs = [];
    if (day) {
      let txt = '';
      try { txt = (kapi.logReadDay ? await kapi.logReadDay(day, 5000) : '') || ''; } catch {}
      let seq = 0;
      LOG_DAY.recs = txt.split('\n').map((l) => parseLogLine(l, ++seq)).filter(Boolean);
    }
    logView.open.clear();
    const panel = bar.parentElement;
    if (panel) panel.classList.toggle('k-log-past', !!day);
    const clr = panel && panel.querySelector('.k-log-clear');
    if (clr) clr.disabled = !!day;                       // ล้างได้เฉพาะบันทึกของเซสชันนี้ (ไฟล์ไม่ถูกแตะ)
    note.textContent = day ? ttf('ui.log.dayReadonly', fmtDate(day + 'T12:00:00')) : '';
    renderLogPanel(true);
  };
  const lbl = el('span', 'k-log-dir-lbl', tt('ui.log.folderLabel'));
  const dir = el('span', 'k-log-dir');
  dir.title = tt('ui.log.folderTip');
  const bdi = document.createElement('bdi'); bdi.dir = 'ltr'; dir.append(bdi);
  if (kapi.logDir) kapi.logDir().then((p) => { bdi.textContent = p || ''; dir.title = tt('ui.log.folderTip') + '\n' + (p || ''); }).catch(() => {});
  const open = el('button', 'k-log-btn k-log-open', tt('ui.app.openFolderLog'));
  open.title = tt('ui.panelTip.logReveal');
  open.onclick = () => { if (kapi.logOpenDir) kapi.logOpenDir(); else if (kapi.logReveal) kapi.logReveal(); };
  const note = el('span', 'k-log-daynote');
  bar.append(sel, lbl, dir, open, note);
  fill();
  return bar;
}

function syncLogBar(host, recs) {
  if (!host) return;
  const bar = host.querySelector('.k-log-bar'); if (!bar) return;
  // [alpha.165] ดูไฟล์ของวันก่อน = นับ/รายชื่อที่มาจากไฟล์นั้น ไม่ใช่ของเซสชันนี้
  const c = LOG_DAY.day ? recs.reduce((a, r) => { a[r.level] = (a[r.level] || 0) + 1; return a; }, {}) : logStore.counts();
  for (const b of bar.querySelectorAll('.k-log-chip')) {
    const lv = b.dataset.lv;
    b.textContent = LEVEL_META[lv].icon + ' ' + LEVEL_META[lv].label + (c[lv] ? ' ' + c[lv] : '');
    b.classList.toggle('k-log-chip-hot', lv === 'error' && c.error > 0);
  }
  const sel = bar.querySelector('.k-log-src-sel');
  const srcs = LOG_DAY.day ? [...new Set(recs.map((r) => r.source).filter(Boolean))].sort() : logStore.sources();
  if (sel.dataset.list !== srcs.join()) {
    sel.dataset.list = srcs.join();
    sel.replaceChildren();
    const o0 = el('option', null, tt('ui.app.all')); o0.value = ''; sel.append(o0);
    for (const s of srcs) { const o = el('option', null, s); o.value = s; sel.append(o); }
    sel.value = logView.source;
  }
}
/** ป้ายเล็ก ๆ บอกว่ากำลังหยุดอ่านอยู่ + กดกลับไปล่างสุดได้ */
function updateLogFollowBadge(body, stick) {
  const panel = body.parentElement;
  if (!panel) return;
  let b = panel.querySelector('.k-log-follow');
  if (stick) { if (b) b.remove(); return; }
  if (!b) {
    b = el('button', 'k-log-follow', tt('ui.app.lineLatest'));
    b.title = tt('ui.app.nowReadPressBack');
    b.onclick = () => { body.scrollTop = body.scrollHeight; b.remove(); };
    panel.appendChild(b);
  }
}
let _logTimer = null;
function startLogAutoRefresh() {
  if (_logTimer) return;
  _logTimer = setInterval(() => { if (isPanelOpen('log')) renderLogPanel(); }, 2000);
}
function stopLogAutoRefresh() {
  if (_logTimer) { clearInterval(_logTimer); _logTimer = null; }
}
window.__k2test = (p) => { globalThis.__k2testing = true; return runTest(p); };
// [alpha.108] เครื่องมือวินิจฉัยหน้ากระดาษ — เปิด DevTools แล้วพิมพ์ `k2PageDoctor()`
// (ไม่มี UI ไม่มีข้อความให้แปล · ใช้ตอนอาการเกิดบนเอกสารจริงของผู้ใช้ที่เครื่องพัฒนาจำลองไม่ได้)
window.k2PageDoctor = k2PageDoctor;
// [alpha.166] ไล่ปัญหากล้อง/ฉากหลังของผังความสัมพันธ์จาก DevTools: `k2Net()._cam`
window.k2Net = () => netInst;
window.__k2menu = null;

// ═════════ [alpha.58r ข้อ 4] คอนโซลนักพัฒนา ═════════
// อยู่ในเมนู "ช่วยเหลือ" ที่เดียวกับ "เกี่ยวกับ" + คีย์ลัด Ctrl+Shift+`
// ทำไมต้องมีเอง ทั้งที่ Chromium มี DevTools อยู่แล้ว: หน้าต่างเป็น frame:false และ build ที่ส่งผู้ใช้
// ไม่ได้เปิด DevTools ไว้ → เวลาเจอบั๊กจริงหน้างานไม่มีทางดูค่าอะไรได้เลย
/** ของที่ให้เรียกได้ในคอนโซล — ส่งเข้าไปเป็นตัวแปร k2 */
function devApi() {
  return {
    state, kapi, $, el, log, LOG_BUF,
    tab: () => state.active,
    doc: () => { const t = state.active; return t && (t.editor || t.sp)?.view.state.doc; },
    md: () => { const t = state.active; return (t && (t.editor || t.sp)?.getMarkdown()) || ''; },
    settings: () => state.settings,
    spFormat, proseFormat, spPageModel,
    blocks: () => { const t = state.active;
      return t && t.sp ? blocksFromDoc(t.sp.view.state.doc)
           : t && t.editor ? proseBlocksFromDoc(t.editor.view.state.doc) : []; },
    cssVar: (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    cmd: (ch, ...a) => handleCommand(ch, ...a),
    net: () => netInst,                         // [alpha.166] ผังความสัมพันธ์ (กล้อง · ฉากหลัง · โมเดล)
    version: APP_VERSION,
  };
}
const DEV_HISTORY_KEY = 'k2-dev-history';
function devHistory() {
  try { return JSON.parse(localStorage.getItem(DEV_HISTORY_KEY) || '[]'); } catch { return []; }
}
function pushDevHistory(code) {
  const h = devHistory().filter((x) => x !== code);
  h.push(code);
  try { localStorage.setItem(DEV_HISTORY_KEY, JSON.stringify(h.slice(-50))); } catch {}
}
/** แปลงผลลัพธ์เป็นข้อความอ่านได้ (ไม่ระเบิดเมื่อเจอ object วนซ้ำ/ใหญ่) */
function devFormat(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'function') return String(v).slice(0, 400);
  if (v instanceof Error) return (v.stack || v.message);
  try { return JSON.stringify(v, (k, val) => (val instanceof Map ? [...val] : val), 2).slice(0, 20000); }
  catch { return String(v); }
}

export function openDevConsole() {
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-dev-dlg');
  box.append(el('div', 'k-dlg-title', tt('ui.app.consoleDev')));
  box.append(el('div', 'dim',
    tt('ui.app.printJavaScriptDonePress') +
    '(k2.state · k2.tab() · k2.md() · k2.blocks() · k2.cssVar("--ed-fs") · k2.cmd("save"))'));

  const inp = el('textarea', 'k-dlg-input k-dev-input');
  inp.rows = 5;
  inp.spellcheck = false;
  inp.placeholder = tt('ui.app.egK2CssVarEd');
  box.append(inp);

  const btns = el('div', 'k-dev-btns');
  const out = el('pre', 'k-dev-out');
  const write = (s, cls) => {
    const line = el('div', 'k-dev-line' + (cls ? ' ' + cls : ''), s);
    out.append(line);
    out.scrollTop = out.scrollHeight;
  };

  let histIdx = -1;
  const run = () => {
    const code = inp.value.trim();
    if (!code) return;
    pushDevHistory(code); histIdx = -1;
    write('› ' + code, 'k-dev-in');
    // ดัก console.* ระหว่างรัน เพื่อให้เห็นผลในกล่องนี้เลย
    const orig = { log: console.log, warn: console.warn, error: console.error };
    const cap = [];
    for (const k of ['log', 'warn', 'error'])
      console[k] = (...a) => { cap.push(a.map(devFormat).join(' ')); orig[k](...a); };
    let res, err = null;
    try {
      // eslint-disable-next-line no-new-func
      res = new Function('k2', 'return (' + code + ')')(devApi());
    } catch (e1) {
      try { res = new Function('k2', code)(devApi()); }
      catch (e2) { err = e2; }
    } finally {
      Object.assign(console, orig);
    }
    for (const c of cap) write(c, 'k-dev-log');
    if (err) write(String(err && (err.stack || err.message || err)), 'k-dev-err');
    else if (res && typeof res.then === 'function')
      res.then((v) => write(devFormat(v))).catch((e) => write(String(e), 'k-dev-err'));
    else write(devFormat(res));
  };

  inp.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'Enter') { e.preventDefault(); run(); return; }
    if (e.code === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
      const h = devHistory();
      if (!h.length) return;
      histIdx = histIdx < 0 ? h.length - 1 : Math.max(0, histIdx - 1);
      inp.value = h[histIdx]; e.preventDefault();
    }
  });

  const mkBtn = (label, fn, cls) => { const b = el('button', cls || 'cmp-mini', label); b.onclick = fn; return b; };
  btns.append(mkBtn(tt('ui.app.ctrlEnter'), run, 'k-ok'));
  btns.append(mkBtn(tt('ui.app.clearResult'), () => { out.innerHTML = ''; }));
  btns.append(mkBtn(tt('ui.app.copyResult'), () => {
    navigator.clipboard?.writeText(out.textContent || '');
    setStatus(tt('ui.app.copyResultConsoleDone'));
  }));
  btns.append(mkBtn(tt('ui.app.saveLatestLog'), async () => {
    let text = '';
    try { text = (await kapi.logRead(200)) || ''; } catch {}
    write(text || LOG_BUF.slice(-200).join('\n') || tt('ui.app.notHasSave'), 'k-dev-log');
  }));
  btns.append(mkBtn(tt('ui.app.dataSystem'), () => {
    write(devFormat({
      version: APP_VERSION,
      โปรเจกต์: state.root || tt('ui.app.notOpen'),
      แท็บที่เปิด: state.tabs.size,
      โหมด: state.active && state.active.sp ? tt('ui.common.screenplay') : state.active && state.active.editor ? tt('ui.app.novel3') : '-',
      มุมมอง: currentSpView(),
      ซูม: Math.round(pageScale * 100) + '%',
      'ขนาดกระดาษ': spFormat().paperSize,
      'บรรทัด/หน้า (บท)': formatLines(spFormat()),
      'บรรทัด/หน้า (นิยาย)': proseLinesPerPage(proseFormat(), spFormat().paper, spFormat().margins),
      '--ed-fs': getComputedStyle(document.documentElement).getPropertyValue('--ed-fs').trim(),
      '--sp-fs': getComputedStyle(document.documentElement).getPropertyValue('--sp-fs').trim(),
      '--ui-fs': getComputedStyle(document.documentElement).getPropertyValue('--ui-fs').trim(),
    }));
  }));
  box.append(btns, out);

  const foot = el('div', 'k-dlg-btns');
  const close = el('button', 'k-cancel', tt('ui.common.close'));
  close.onclick = () => ov.remove();
  foot.append(close);
  box.append(foot);

  ov.append(box);
  document.body.append(ov);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) ov.remove(); });
  setTimeout(() => inp.focus(), 0);
  return ov;
}

/** กล่อง "เกี่ยวกับ" — ทางเข้าคอนโซลนักพัฒนาอยู่ที่นี่ด้วย */
/**
 * เครดิต — **ตารางเดียวที่เป็นแหล่งความจริง** (กล่อง "เกี่ยวกับ" อ่านจากที่นี่ที่เดียว)
 * เพิ่ม/ถอด dependency เมื่อไหร่ ให้แก้ที่นี่ · e2e ตรวจว่าทุกแถวมีชื่อ+สัญญาอนุญาตครบ
 * (`what` ใช้ T`` ได้เพราะตารางถูกสร้างตอนโหลดโมดูล ซึ่งตารางคำแปลพร้อมแล้ว — ดู src/i18n.js)
 */
export const CREDITS = [
  { group: tt('ui.app.writeCode'), items: [
    { name: 'Claude (Anthropic)', what: tt('ui.app.writeOutStyleCode'), url: 'https://claude.com/claude-code' },
    { name: 'DeepSeek', what: tt('ui.app.helpWriteCodePart'), url: 'https://www.deepseek.com' },
  ] },
  { group: tt('ui.app.app'), items: [
    { name: 'Electron', what: tt('ui.app.item'), lic: 'MIT', url: 'https://electronjs.org' },
    { name: 'Chromium · Node.js', what: tt('ui.app.webMoreElectron'), lic: 'BSD / MIT' },
    { name: 'esbuild', what: tt('ui.app.mergeFileBundler'), lic: 'MIT', url: 'https://esbuild.github.io' },
    { name: 'electron-builder', what: tt('ui.app.doItemSet'), lic: 'MIT' },
  ] },
  { group: tt('ui.app.delUseApp'), items: [
    { name: 'ProseMirror', what: tt('ui.app.itemEditTextNovel'), lic: 'MIT', url: 'https://prosemirror.net' },
    { name: 'Fabric.js', what: tt('ui.app.boardPlannerPlannerGraph'), lic: 'MIT', url: 'https://fabricjs.com' },
    { name: 'pdf-lib + @pdf-lib/fontkit', what: tt('ui.app.newFilePDFFont'), lic: 'MIT' },
    { name: 'JSZip', what: tt('ui.app.exportImportProjectZip'), lic: 'MIT / GPL-3.0' },
    { name: 'Fuse.js', what: tt('ui.app.searchStylePrint'), lic: 'Apache-2.0' },
  ] },
  { group: tt('ui.common.font'), items: [
    { name: 'Courier Prime', what: tt('ui.app.fontScreenplayQuoteUnquote'), lic: 'SIL OFL 1.1' },
    { name: tt('ui.app.courierMonoThaiProportionalThai'), what: tt('ui.app.fontScreenplayPosView'), lic: tt('ui.app.notSource') },
  ] },
  { group: tt('ui.app.data'), items: [
    { name: tt('ui.app.checkWord'), what: tt('ui.app.listWordEnglishFolder'), lic: '' },
    { name: tt('ui.app.fileLangK2Csv'), what: tt('ui.app.textPageScreenAll'), lic: '' },
  ] },
  { group: tt('ui.app.msg6'), items: [
    { name: 'Scrivener · Final Draft · Storyteller · Miro', what: tt('ui.app.thinkExplorerScreenplayWork'), lic: '' },
  ] },
];

// ══ [alpha.157r] กล่อง "เกี่ยวกับ" แบบการ์ดสองฝั่ง (ภาพอ้างอิงจากผู้ใช้) ══
// ซ้าย = พื้นสว่าง: โลโก้ · คำโปรย · รุ่น · ปุ่มแคปซูล · ปุ่มวงกลมล่างซ้าย
// ขวา = ภาพประกอบเต็มช่อง + เมนูลิงก์ด้านบน · "เครดิต" เป็นแผ่นเลื่อนทับภาพ (เปิดไว้เป็นค่าเริ่มต้นไม่ได้ — มันบังภาพ)
// เปลี่ยนภาพได้โดยไม่ต้อง build: วางไฟล์ทับ renderer/about/hero.png (ไม่มีไฟล์ = ใช้ placeholder .svg ที่มากับโปรแกรม)
export function aboutDialog(opts = {}) {
  const ov = el('div', 'k-overlay k-about-ov');
  const box = el('div', 'k-dialog k-about-dlg');

  // ── ซ้าย ──
  const left = el('div', 'k-about-left');
  const logo = el('img', 'k-about-logo');
  logo.alt = 'Killian 2';
  logo.src = 'about/logo.svg';
  left.append(logo);
  const title = el('div', 'k-dlg-title k-about-title', tt('ui.common.killian'));
  const tag = el('div', 'k-about-tag', tt('ui.app.appWriteNovelScreenplay'));
  const sub = el('div', 'k-about-sub', tt('ui.app.fileTaskMarkdownJSON'));
  const ver = el('div', 'k-about-ver', tt('ui.app.killianEditor') + APP_VERSION);
  const pills = el('div', 'k-about-pills');
  const pChange = el('button', 'k-about-pill', tt('ui.about.changelog'));
  pChange.onclick = async () => { ov.remove(); const { showChangelog } = await import('./dialogs.js'); showChangelog(); };
  const pUpdate = el('button', 'k-about-pill', tt('ui.about.checkUpdate'));
  pUpdate.onclick = () => { ov.remove(); handleCommand('check-update'); };
  pills.append(pChange, pUpdate);
  left.append(title, tag, sub, ver, pills);
  const foot = el('div', 'k-about-foot');
  const dev = el('button', 'k-about-round', '');
  dev.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 8-4 4 4 4"/><path d="m17 8 4 4-4 4"/><path d="m14 4-4 16"/></svg>';
  dev.title = tt('ui.app.consoleDev');
  const devLbl = el('button', 'k-about-round-label', tt('ui.app.consoleDev'));
  const openDev = () => { ov.remove(); openDevConsole(); };
  dev.onclick = openDev; devLbl.onclick = openDev;
  foot.append(dev, devLbl);
  left.append(foot);

  // ── ขวา ──
  const right = el('div', 'k-about-right');
  const hero = el('img', 'k-about-hero');
  hero.alt = '';
  hero.src = 'about/hero.png';
  hero.onerror = () => { hero.onerror = null; hero.src = 'about/hero.svg'; };
  const nav = el('div', 'k-about-nav');
  const credits = el('div', 'k-credits');
  const navBtn = (label, fn, cls = '') => { const b = el('button', 'k-about-link ' + cls, label); b.onclick = fn; nav.append(b); return b; };
  const setCredits = (on) => {
    right.classList.toggle('show-credits', on);
    bCredits.classList.toggle('on', on);
    bCredits.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  const bCredits = navBtn(tt('ui.about.credits'), () => setCredits(!right.classList.contains('show-credits')));
  // ลิงก์รีโปมาจากที่เดียวกับระบบอัปเดต (กฎถาวร alpha.135) — เดิมฝังรีโปเก่าไว้ตรงนี้
  navBtn('GitHub', () => { try { kapi.openExternal(UPDATE_HOME_URL); } catch {} });
  navBtn(tt('ui.about.dataFolder'), () => { try { kapi.revealInOS(state.root || ''); } catch {} }).disabled = !state.root;
  const close = navBtn(tt('ui.common.close'), () => ov.remove(), 'k-about-link-pill');
  close.classList.add('k-ok');     // ปุ่มปิดหลักของกล่อง (ปุ่มเดิมก็เป็น .k-ok)

  // ---- เครดิต ----
  credits.append(el('div', 'k-credits-head', tt('ui.app.use')));
  for (const g of CREDITS) {
    credits.append(el('div', 'k-credit-group', g.group));
    for (const it of g.items) {
      const row = el('div', 'k-credit-row');
      const nm = el('span', 'k-credit-name', it.name);
      if (it.url) {
        nm.classList.add('k-credit-link');
        nm.title = it.url;
        nm.onclick = () => { try { kapi.openExternal ? kapi.openExternal(it.url) : window.open(it.url, '_blank'); } catch {} };
      }
      row.append(nm);
      if (it.lic) row.append(el('span', 'k-credit-lic', it.lic));
      row.append(el('div', 'k-credit-what', it.what));
      credits.append(row);
    }
  }
  right.append(hero, nav, credits);
  box.append(left, right);
  ov.append(box);
  document.body.append(ov);
  if (opts.credits) setCredits(true);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) ov.remove(); });
  escClose(ov, () => ov.remove());
  return ov;
}

// ── บั๊ก #18: แผงฟีเจอร์ที่ไม่ใช่เอกสาร ─────────────────────────────────────
// showPanel วางแค่กล่องเปล่าให้ — เนื้อหาต้องวาดเอง ทั้งตอนสั่งเปิดจากเมนู
// และตอนกู้เลย์เอาต์จาก localStorage (ไม่งั้นเปิดโปรแกรมมาเจอแผงว่าง)
// ฟังก์ชันในนี้ "วาดอย่างเดียว" ห้ามเรียก showPanel เอง (ไม่งั้นวนซ้ำกับ hook ข้างล่าง)
const FEATURE_PANELS = {
  dashboard: () => renderDashboard($('#dash-body')),
  kanban:    () => renderKanbanPanel(),
  books:     () => renderBookManager($('#books-body')),
  chapters:  () => renderChapterManager($('#chapters-body')),   // [alpha.141] จัดการบท
  timeline:  () => renderTimeline($('#tl-body')),
  maps:      () => renderMapsPanel(),
  gallery:   () => renderGalleryPanel(),        // [alpha.60r1 ข้อ 21]
  'gallery-board': () => renderGalleryBoardPanel(),   // [alpha.63r] กระดานอารมณ์เป็นแผงของตัวเอง
  'ai-analyzer': () => renderAIAnalyzerPanel($('#ai-analyzer-body')),   // [alpha.60r3 ข้อ 5]
  'ai-chat':     () => renderAIChatPanel($('#ai-chat-body')),           // [alpha.61 ข้อ 2]
  starter:   () => renderStarterPanel($('#starter-body')),              // [alpha.94]
  // [alpha.62 บั๊ก 18+20] สองตัวนี้มีตัววาดครบมาตั้งแต่ .40 แต่ไม่เคยอยู่ในตารางนี้
  //   → เปิดแผงจากปุ่ม/ถาด/เลย์เอาต์ที่กู้มา แล้วได้กล่องเปล่า ("ใช้ไม่ได้เลย")
  //   มีแต่ทางเดียวที่เคยวาด คือคำสั่ง global-search / scratchpad ที่เรียก render เองตรง ๆ
  search:    () => renderSearchPanel($('#search-body')),
  notes:     () => renderNotesPanel($('#notes-body')),
  // [alpha.62 บั๊ก 16] 3 ฟีเจอร์ที่ยังเป็นแท็บเอกสาร → เป็นแผงเต็มตัวเหมือนตัวอื่น
  network:   () => renderNetworkPanel(),
  // [alpha.125 ข้อ G] "ฉากที่กล่าวถึง" ทั้งโปรเจกต์ — คลิกแถวแล้วกระโดดไปฉากนั้นจริง
  backlinks: () => renderBacklinksPanel($('#backlinks-body'), async (sceneId) => {
    const hit = await findScenePath(state.root, sceneId);
    if (hit && hit.path) openScene(hit.path, hit.title);
    else setStatus(tt('ui.worldAutoLink.sceneGone'));
  }),
  planner:   () => renderPlannerPanel(),
  // [alpha.124 ข้อ 44] เดิมเป็น noop → เปิดแผงนี้จากถาด/เมนู/เลย์เอาต์ที่กู้มา (โดยที่ยังไม่ได้
  // เปิดกระดานวางแผน) ได้ **กล่องเปล่าสนิท** ไม่มีแม้แต่ข้อความบอกว่ามันคืออะไร
  // ตอนนี้: ถ้ากระดานเปิดอยู่ ปล่อยให้กระดานวาดเหมือนเดิม · ถ้ายัง วาดสภาพว่างที่บอกทางไปต่อ
  // [alpha.154 ข้อ 4] ★ คีย์เคยเขียนว่า `plannerProps` ขณะที่ id ของแผงคือ `planner-props`
  // → `renderFeaturePanel(pid)` หาไม่เจอทุกครั้งที่เปิดจากปุ่ม/ถาด/เลย์เอาต์ที่กู้มา = กล่องเปล่า
  // (e2e เรียกด้วยชื่อคีย์ผิดตัวเดียวกันเลยเขียวมาตลอด) · ตอนนี้มีเทสกวาดว่าคีย์ทุกตัวต้องเป็น id แผงจริง
  'planner-props': () => {
    const box = $('#planner-props-body');
    if (!box) return true;
    if (isPanelOpen('planner')) return true;      // กระดานเปิดอยู่ = มันวาดเองผ่าน setPropsCallback
    box.replaceChildren();
    box.append(panelEmpty(tt('ui.plannerProps.needBoard'), {
      action: tt('ui.plannerProps.openBoard'),
      onAction: () => handleCommand('toggle-panel', 'planner'),
    }));
    return true;
  },
  floorplan: () => renderFloorPlanPanel(),
  // [alpha.66 ข้อ 1+9] ผังแตกสาย + โหมดทดลองเล่น — เดิมผังเป็นแท็บเอกสาร แย่งที่กับฉากที่กำลังเขียน
  branch:    () => renderBranchingPanel(),
  player:    () => renderPlayerPanel(),
  // [alpha.69] สารานุกรม · ประวัติการทำงาน · บันทึกประจำวัน
  codex:     () => renderCodexPanel($('#codex-body')),
  history:   () => renderHistoryPanel($('#history-body')),
  record:    () => renderRecordPanel($('#record-body')),
  // [alpha.79] บทพูดทั้งผลงาน · จัดการปลั๊กอิน
  dialogue:  () => renderDialoguePanel($('#dialogue-body')),
  plugins:   () => renderPluginPanel($('#plugins-body')),
  // [alpha.82] ห้องซ้อมบท
  dlgb:      () => renderBuilderPanel($('#dlgb-body')),
  // [alpha.116 ข้อ 3] AI Hub
  'ai-hub':  () => renderAIHubPanel($('#ai-hub-body')),
  // ══ [alpha.154 ข้อ 4] ★ คอมเมนต์ — ผู้ใช้: *"comment ใน floatbar ยังใช้ไม่ได้ ขึ้น pannel เปล่า"* ══
  // ปุ่มบนแถบลอยส่ง `toggle-panel:comments` → showPanel → hook → ตารางนี้ ซึ่ง **ไม่มีแถว comments**
  // จึงได้แผงเปล่า · เมนูใช้ได้เพราะเรียก `openCommentsPanel()` ที่วาดเองตรง ๆ (สองทางเข้า สองผลลัพธ์)
  // ตอนนี้ทุกทางเข้าวาดผ่านแถวนี้แถวเดียว
  comments:  () => drawCommentsPanel(),
};
export function isFeaturePanel(id) { return !!FEATURE_PANELS[panelId(id)]; }
// วาดค้างอยู่ = ใช้รอบเดียวกัน — openX() เรียก showPanel (hook เริ่มวาด) แล้ว await ต่อ
// ถ้าไม่ dedupe จะวาดสองรอบทุกครั้งที่สั่งเปิด (แดชบอร์ดอ่านไฟล์ทั้งโปรเจกต์ = แพง)
const _featInFlight = new Map();
export function renderFeaturePanel(id) {
  const pid = panelId(id);
  const f = FEATURE_PANELS[pid];
  if (!f) return Promise.resolve(false);
  if (_featInFlight.has(pid)) return _featInFlight.get(pid);
  // [alpha.66r2 ข้อ 1] ตัววาดของแผงเกือบทุกตัวล้างเนื้อทิ้งแล้วสร้างใหม่ (`innerHTML=''`)
  // → กดรีเฟรช/สลับข้อมูลทีไร แผงก็เด้งกลับบนสุดทุกครั้ง · จุดนี้เป็นทางผ่านเดียวของทุกแผงฟีเจอร์
  // จึงจำ-คืนตำแหน่งเลื่อนที่นี่ทีเดียว แทนที่จะไปไล่แก้ตัววาดทีละไฟล์แล้วลืมบางตัว
  const sel = `#app-root .k-panel[data-panel-id="${pid}"], .k-float-panel[data-panel-id="${pid}"]`;
  const backScroll = keepScroll(() => document.querySelector(sel));
  // [alpha.165] ★ ผู้ใช้: "เลื่อนลงล่างสุด ปิดแผงแล้วเปิดใหม่ = เสี้ยววินาทีไปบนสุดแล้วเลื่อนลงมา" (จัดการเล่ม · จัดการบท)
  //   คืนตำแหน่งข้างบนเกิด "หลังวาดเสร็จ" — ระหว่างที่ตัววาดล้างเนื้อแล้วรออ่านไฟล์ ความสูงเนื้อยุบ
  //   เบราว์เซอร์หนีบตำแหน่งเลื่อนเป็น 0 ให้เห็นอยู่หลายเฟรม · ตรึงความสูงของเนื้อไว้ระหว่างวาด = ไม่มีวันถูกหนีบ
  const heightLocks = lockScrollContentHeights(document.querySelector(sel));
  const p = Promise.resolve().then(f)
    .catch((e) => {
      // ══ [alpha.100] ★ ตาข่ายจับ "error เงียบ" ของตัววาดแผง ══
      // catch ตรงนี้กันแอปล่มได้จริง แต่มันก็ **กลืนบั๊กไปด้วย**: ผู้ใช้ไม่เห็นอะไรผิด · e2e เขียว ·
      // บั๊กแดชบอร์ดที่ระเบิดทุกครั้งที่เปิดโปรเจกต์จึงอยู่ได้หลายรุ่นโดยไม่มีใครรู้
      // (เจอเพราะบังเอิญไปไล่อ่าน `<userData>/logs/app-*.log`)
      // เก็บเป็นตัวนับให้ e2e ยืนยันได้ว่า "จบรอบแล้วต้องไม่มีแผงไหนวาดพังเลย"
      state._panelDrawErrors = (state._panelDrawErrors || 0) + 1;
      state._panelDrawLastErr = pid + ': ' + (e && e.message ? e.message : String(e));
      log('error', ttf('ui.app.drawPanelF2', pid), e);
    })
    .finally(() => _featInFlight.delete(pid))
    .then(() => { try { backScroll(); } catch {} releaseHeightLocks(heightLocks); return true; });
  _featInFlight.set(pid, p);
  return p;
}
/**
 * [alpha.165] ตรึง min-height ของลูกตรงของทุกกล่องที่ถูกเลื่อนอยู่ (ตัวลูกตรงไม่ถูกตัววาดแทนที่ —
 * ตัววาดล้างเนื้อข้างในมัน) → ระหว่างวาด scrollHeight ไม่ยุบ ตำแหน่งเลื่อนจึงไม่ถูกหนีบเป็น 0
 * กล่องที่อยู่บนสุดอยู่แล้ว = ไม่แตะ (ไม่มีอะไรให้รักษา)
 */
function lockScrollContentHeights(root) {
  const locks = [];
  if (!root) return locks;
  for (const e of [root, ...root.querySelectorAll('*')]) {
    if (!e.scrollTop) continue;
    for (const c of e.children) {
      locks.push([c, c.style.minHeight]);
      c.style.minHeight = c.offsetHeight + 'px';
    }
  }
  return locks;
}
function releaseHeightLocks(locks) {
  if (!locks.length) return;
  // ปล่อยหลังตัวคืนตำแหน่ง (keepScroll) ได้ลองรอบแรก ๆ แล้ว · ส่วนที่วาดตามมาแบบไม่ await (รายการร่างในเล่ม)
  // ยังมีเวลาเติม · ปล่อยแล้วถ้าเนื้อจริงสั้นลง เบราว์เซอร์หนีบให้เองตามปกติ (ถูกต้อง)
  setTimeout(() => { for (const [c, v] of locks) c.style.minHeight = v; }, 350);
}
// ทุกทางเข้าที่ทำให้แผงเปิด (เมนู · ถาดแผงที่ปิดไว้ · คำสั่ง) วิ่งผ่าน showPanel → hook นี้
setPanelShowHook((pid) => { renderFeaturePanel(pid); });
/** ล้างเนื้อแผงฟีเจอร์ (ตอนปิดโปรเจกต์ — ไม่งั้นโปรเจกต์ใหม่เห็นสถิติ/กระดานของเก่า) */
export function clearFeaturePanels() {
  for (const sel of ['#dash-body', '#kanban-body', '#books-body', '#chapters-body', '#tl-body', '#maps-body',
                     '#gal-body', '#ai-analyzer-body',
                     // [alpha.62 บั๊ก 16+20] ผลค้นหา/ผัง/กระดาน เป็นของโปรเจกต์เดิมทั้งหมด
                     '#search-body', '#net-body', '#planner-body', '#planner-props-body', '#floor-body',
                     // [alpha.66] ผัง/รอบการเล่นเป็นของโปรเจกต์เดิมล้วน ๆ
                     '#branch-body', '#player-body',
                     // [alpha.69] สารานุกรม/ประวัติ/บันทึก ผูกกับโปรเจกต์ทั้งหมด
                     '#codex-body', '#history-body', '#record-body',
                     // [alpha.79] บทพูดเป็นของโปรเจกต์เดิม · แผงปลั๊กอินก็เปลี่ยนตามโปรเจกต์
                     // (ปลั๊กอินระดับโปรเจกต์อยู่ใน <โปรเจกต์>/Plugins)
                     // [alpha.82] ห้องซ้อมบทเก็บเซสชันไว้ใน <โปรเจกต์>/Dialogues — ของโปรเจกต์เดิมล้วน ๆ
                     '#dialogue-body', '#plugins-body', '#dlgb-body']) {
    const n = $(sel); if (n) n.innerHTML = '';
  }
  resetCodex(); resetHistory(); resetRecords();
  resetDialogue(); resetPluginPanel(); resetBuilder();
  state._branch = null;
  resetPlayerMode();
  // #notes-body ไม่ล้าง — สมุดโน้ตด่วนเป็นของผู้ใช้ ไม่ผูกกับโปรเจกต์ (เก็บใน localStorage)
  // และตัววาดมีธง dataset.ready — ล้างเนื้อแต่ไม่ล้างธง = ได้กล่องเปล่าถาวร
  mapsState_C.s = null;
  resetMapsView();          // [alpha.70] ซูม/หมุดที่เลือก/คลิปบอร์ดหมุด เป็นของโปรเจกต์เดิม ต้องล้างด้วย
  galInst = null;
  netInst = null; plannerInst = null;
}
/** วาดแผงฟีเจอร์ทุกตัวที่เปิดค้างอยู่ (เรียกหลัง initPanelSystem ตอนเปิดโปรเจกต์) */
export async function renderOpenFeaturePanels() {
  for (const id of Object.keys(FEATURE_PANELS)) {
    if (!isPanelOpen(id)) continue;
    // [alpha.115] แผงที่กำลังส่งคำขอ AI อยู่ → ห้ามรื้อ DOM กลางคัน (บันทึกเซสชันของมันเอง
    // ปลุก project-changed → วนกลับมาที่นี่ → วาดใหม่ → ข้อความ/สตรีมที่กำลังวิ่งหายไป)
    if (id === 'ai-chat' && _chatState().sending) continue;
    if (id === 'dlgb' && builderState().sending) continue;
    await renderFeaturePanel(id);
  }
}

// ── บั๊ก #10: พิมพ์/ส่งออก PDF ต้องได้เฉพาะหน้าที่เปิดอยู่ ───────────────────
// CSS @media print จัดการหลักแล้ว (.pane.on เท่านั้น) — สองตัวนี้เป็นตาข่ายกันพลาด
// เผื่อ inline style/ปลั๊กอินอื่นไปดัน display ของ pane ที่ไม่ active
function hideInactivePanes() {
  document.querySelectorAll('#panes .pane:not(.on)').forEach((p) => {
    p.dataset.k2hide = p.style.display || '';
    p.style.display = 'none';
  });
}
function restoreInactivePanes() {
  document.querySelectorAll('#panes .pane[data-k2hide]').forEach((p) => {
    p.style.display = p.dataset.k2hide;
    delete p.dataset.k2hide;
  });
}

// [alpha.72 ข้อ 5] คำสั่งที่ยิงรัวจนกลบ log (พิมพ์/เลื่อน/ซูม) — จดเป็น debug ไม่ใช่ info
// คำสั่งที่แก้เนื้อของแท็บที่เปิดอยู่ — ฉากล็อกแล้วทำไม่ได้ (ดู handleCommand)
const LOCK_EDIT_CMDS = new Set(['fmt', 'text-case', 'text-case-cycle', 'editor-undo', 'editor-redo', 'insert-image',
  'delete-line', 'sp-element', 'nbsp', 'insert-shortcode', 'remove-elements', 'toggle-format', 'set-format', 'sp-extension']);
const QUIET_CMDS = new Set(['zoom', 'zoom-in', 'zoom-out', 'zoom-reset', 'ui-scale', 'scroll',
                            'find', 'find-next', 'find-prev']);

// ═══ [alpha.165] รายการมาตรฐานของเมนูคลิกขวาในเอกสาร ═══
// ชุดเดียวกับเมนู context-menu ของ main.js (ตัวนั้นเหลือไว้ให้ช่องกรอกนอกเอกสาร)
// ตัด/คัดลอก/วาง ผ่าน webContents ตัวจริง (`kapi.editRole`) = เท่ากับกดแป้น · คืนโฟกัสให้ตัวแก้ไขก่อนเสมอ
function docEditable(target) {
  const pm = target && target.closest && target.closest('.ProseMirror');
  return !!pm && pm.getAttribute('contenteditable') === 'true';
}
function editRoleItem(pm, label, role, code, enabled) {
  return { text: label, accel: formatShortcut(code, true), disabled: !enabled, click: async () => {
    // คลิกแถวเมนูดึงโฟกัสออกจากตัวแก้ไข → คืนก่อน (view.focus() วาง selection กลับทันที ·
    // ตัวแก้ไขอื่นที่ไม่ใช่แท็บหลัก เช่นแยกจอ ใช้ dom.focus() แล้วรอ ProseMirror วาง selection คืน ~20ms)
    const ed = state.active && (state.active.editor || state.active.sp);
    if (ed && ed.view && ed.view.dom === pm) ed.view.focus();
    else if (pm && pm.isConnected) { pm.focus(); await new Promise((r) => setTimeout(r, 40)); }
    kapi.editRole(role);
  } };
}
function editorStdMenuItems(target, hasSel) {
  const pm = target && target.closest && target.closest('.ProseMirror');
  const canEdit = docEditable(target);
  return [
    editRoleItem(pm, tt('ui.menu.cut'), 'cut', 'KeyX', hasSel && canEdit),
    editRoleItem(pm, tt('ui.common.copy'), 'copy', 'KeyC', hasSel),
    editRoleItem(pm, tt('ui.menu.paste'), 'paste', 'KeyV', canEdit),
    editRoleItem(pm, tt('ui.menu.pickAll'), 'selectAll', 'KeyA', true),
  ];
}
function editorFmtMenuItems(target) {
  const canEdit = docEditable(target);
  const c = (label, id, ...args) => ({ text: label, cmd: [id, ...args].join(':'), disabled: !canEdit && id !== 'find' && id !== 'save',
                                       click: () => handleCommand(id, ...args) });
  return [
    c(tt('ui.menu.itemBoldB'), 'fmt', 'bold'),
    c(tt('ui.menu.itemI'), 'fmt', 'italic'),
    c(tt('ui.menu.dashLineUnderU'), 'fmt', 'underline'),
    c(tt('ui.menu.dashX'), 'fmt', 'strike'),
    c(tt('ui.menu.clearFormatSpace'), 'fmt', 'clear'),
    '-',
    c(tt('ui.menu.doZ'), 'editor-undo'),
    c(tt('ui.menu.repeatY'), 'editor-redo'),
    '-',
    c(tt('ui.menu.insertImage'), 'insert-image'),
    c(tt('ui.menu.searchF'), 'find'),
    '-',
    c(tt('ui.menu.saveS'), 'save'),
  ];
}

export async function handleCommand(ch, ...a) {
  // [alpha.164] กำลังดูฉบับเดิมของฉากมีปัญหา → คำสั่งที่อ่าน/เขียนเนื้อ (บันทึก · พิมพ์ · ส่งออก …)
  // ต้องได้ฉบับแก้ไขเสมอ · คำสั่งดูอย่างเดียว (ซูม/สลับแท็บ/สลับฉบับ) ไม่กระทบ
  if (typeof ch === 'string') { try { onsetBeforeCommand(ch); } catch {} }
  const t = state.active;
  // [alpha.164 · บั๊ก] ฉากที่ล็อก = คำสั่งที่แก้เนื้อไม่ทำงาน + บอกเหตุผล (เดิมปุ่มจัดรูปแบบ/คีย์ลัดแก้ฉากที่ล็อกได้
  // เพราะ editable:false ของ ProseMirror กันแค่การพิมพ์ · ตัวแก้ไขเองก็กันซ้ำอีกชั้นที่ edit-guard.js)
  if (LOCK_EDIT_CMDS.has(ch) && t && t.locked && (t.editor || t.sp)) {
    setStatus(gi('lock') + ' ' + TA.lockMessage('scene'));
    return;
  }
  // จดทุกคำสั่งที่ผู้ใช้สั่ง — ไล่ย้อนได้ว่า "ก่อนพังกดอะไรไป" (เดิม log ไม่มีร่องรอยนี้เลย)
  try {
    log(QUIET_CMDS.has(ch) ? 'debug' : 'info', 'cmd: ' + ch,
        a.length ? a.map((x) => (typeof x === 'object' ? '[obj]' : String(x))) : undefined);
  } catch {}
  // [alpha.60r3 ข้อ 7] คีย์ลัดที่ปลั๊กอินลงทะเบียนไว้ (`plugin:<ชื่อ>:<id>`)
  if (typeof ch === 'string' && ch.startsWith('plugin:')) {
    const hit = plugins.shortcuts.find((s) => s.ch === ch);
    if (hit) { try { await hit.fn(...a); } catch (e) { log('warn', tt('ui.app.keyPlugin') + ch, e); } }
    return;
  }
  switch (ch) {
    case 'new-project': newProject(); break;
    case 'confirm-quit': confirmQuit(); break;
    case 'changelog': showChangelog(); break;
    case 'show-log': showPanel('log'); renderLogPanel(); syncMenuToggles(); break;
    case 'open-project': { const p = await kapi.openProjectDialog(); if (p) await openProjectFromUi(p); break; }   // [alpha.162 · W1-6]
    case 'open-project-path': await openProjectFromUi(a[0]); break;
    // [alpha.162 · W1-S2] เดิมยิงทิ้ง — เขียนดิสก์ล้ม (ดิสก์เต็ม · ไฟล์ถูกล็อก) = เงียบสนิท
    // ผู้ใช้เห็นแค่จุด "ยังไม่บันทึก" ไม่หาย แล้วเข้าใจว่าโปรแกรมค้าง
    case 'save': {
      if (!t) break;
      try { await saveTab(t); }
      catch (e) {
        log('error', tt('ui.app.saveFail') + (t.title || t.file), e);
        setStatus(tt('ui.app.saveFail') + (t.title || t.file));
      }
      break;
    }
    case 'save-all': saveAllTabs(); break;
    case 'save-as': {
      if (!t) break;
      // [alpha.162 · W1-5] ★ เดิม `t.editor ? … : t.plain.value` — แท็บบทภาพยนตร์ (`t.sp`) กับหน้า Wiki
      // ไม่มีทั้ง `editor` และ `plain` → `t.plain.value` โยน TypeError กลางคำสั่ง (คำสั่งตายเงียบ)
      // ใช้ตัวอ่านเนื้อชุดเดียวกับ saveTab และตอบให้ชัดเมื่อแท็บชนิดนั้นบันทึกเป็นไฟล์ .md ไม่ได้
      const body = tabBodyText(t);
      if (body === null) { setStatus(tt('ui.app.saveAsUnsupported')); break; }
      const p = await kapi.saveAsDialog((t.title || tt('ui.common.notNamed')) + '.md');
      // [alpha.161 · D5] สำเนาต้องพาเธรดคอมเมนต์ของไฟล์ต้นทางไปด้วย (เดิม writeFile ตรง ๆ = เธรดหาย)
      if (p) { const srcMd = t.file && !String(t.file).startsWith('::') && /\.md$/i.test(t.file) ? t.file : null;
               await writeKeepingComments(p, dumpMdFile(t.meta || {}, body), srcMd);
               setStatus(ttf('ui.app.saveAsDone', p)); }
      break;
    }
    // [alpha.124 ข้อ 25] พิมพ์ — เดิมยิง `kapi.print()` ทื่อ ๆ: ไม่กันตอนไม่มีแท็บ
    // ไม่ผ่านการตรวจก่อนส่งออก (ต่างจากทุกทางส่งออกอื่น) และไม่เคยบอกผลลัพธ์เลย
    // ยกเลิกกล่องพิมพ์ หรือไม่มีเครื่องพิมพ์ = เงียบสนิทเหมือนโปรแกรมไม่ได้ทำอะไร
    case 'print': {
      if (!t) { setStatus(tt('ui.app.printNoTab')); break; }
      if (!(await checkBeforeExport())) break;
      document.body.classList.add('printing');
      hideInactivePanes();
      let pr = null;
      try { pr = await kapi.print(); }
      catch (e) { log('warn', tt('ui.app.printFail'), e); }
      restoreInactivePanes();
      setTimeout(() => document.body.classList.remove('printing'), 800);
      // main คืน `{ok, reason}` — รุ่นเก่าคืน undefined จึงถือว่า "ส่งไปแล้ว" ไม่ต้องเตือน
      if (pr && !pr.ok) setStatus(pr.reason ? tt('ui.app.printFail') + ' — ' + pr.reason
                                            : tt('ui.app.printCancelled'));
      else if (pr && pr.ok) setStatus(tt('ui.app.printSent'));
      break;
    }
    // [alpha.81 ข้อ 8] เดิมทางนี้ยิง `webContents.printToPDF` ของหน้าจอตรง ๆ —
    // ได้ A4 ตายตัวไม่ตรงขนาดกระดาษที่ตั้งไว้ และเป็นภาพของหน้าจอ ไม่ใช่เอกสารจริง
    // ตอนนี้พาไปศูนย์รวมการส่งออกเสมอ (ทางนั้นให้ตัวอักษรจริงและใช้ขนาดกระดาษที่ตั้งไว้)
    case 'export-pdf': await openExportHub(); break;
    case 'close-tab': if (t) closeTab(t.file, { ask: true }); break;
    // [alpha.161 · K2/K4] วนแท็บ · แสดงไฟล์ที่เปิดอยู่ในต้นไม้
    case 'next-tab': cycleTabs(1); break;
    case 'prev-tab': cycleTabs(-1); break;
    case 'reveal-active': revealInTree(t && t.file); break;
    case 'onset-toggle': toggleOnsetView(t); break;          // [alpha.164] ฉากมีปัญหา: ฉบับเดิม ⇄ ฉบับแก้ไข
    case 'close-all-tabs': closeAllTabs(); break;
    // [95] ในบทหนัง Ctrl+1/2/3 = scene/action/character (คีย์เดียวกับหัวข้อ 1-3 ของนิยาย)
    case 'fmt': {
      const spFmt = state.active?.sp;
      const SP_HEAD = { 1: 'scene', 2: 'action', 3: 'character' };
      if (spFmt && a[0] === 'heading' && SP_HEAD[a[1]]) {
        spFmt.switchTo(SP_HEAD[a[1]]);
      } else {
        getActiveEditor()?.cmd(a[0], a[1]);
      }
      refreshToolbar(); if (t) markDirty(t); break;
    }
    // [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ของช่วงที่เลือก (เมนู "รูปแบบ → รูปตัวพิมพ์")
    case 'text-case': {
      const ed2 = getActiveEditor();
      if (!ed2) { setStatus(tt('ui.app.openSceneBeforeChangeImage')); break; }
      const ok = ed2.cmd('case', a[0]);
      if (ok) { if (t) markDirty(t); setStatus(tt('ui.app.changeImageCase') + (CASE_SHORT[a[0]] || a[0])); }
      else setStatus(tt('ui.app.pickTextBeforeDone'));
      refreshToolbar(); break;
    }
    case 'editor-undo': getActiveEditor()?.cmd('undo'); refreshToolbar(); break;
    case 'editor-redo': getActiveEditor()?.cmd('redo'); refreshToolbar(); break;
    case 'insert-image': insertImage(); break;
    case 'gallery': await openGallery(); break;
    // [alpha.63] คำสั่งย่อยของคลังรูป (เมนู มุมมอง → คลังรูปภาพ)
    case 'gallery-new-album': case 'gallery-board': case 'gallery-unused':
    case 'gallery-dups': case 'gallery-export-used':
      await galleryCommand(ch); break;
    case 'find': openFind(); break;
    case 'replace': openFind(true); break;         // [alpha.162 · W4 ข้อ 5]
    case 'reopen-closed-tab': await reopenClosedTab(); break;   // [alpha.162 · W4 ข้อ 11]
    // ══ [alpha.150 ข้อ 1] จัดแนวตั้งในกระดานวางแผน (ปุ่มสามตัวนี้ใช้ได้เฉพาะที่นั่น) ══
    // ตัวแก้ไขไม่มี "ความสูงคงที่" ให้จัดแนวตั้ง — ปุ่มจึงเป็นสีเทาเมื่อไม่ได้อยู่บนกระดาน
    case 'planner-valign': {
      const pl = activePlanner();
      if (!pl) { setStatus(tt('ui.app.valignPlannerOnly')); break; }
      pl.alignText('v', a[0]);
      break;
    }
    // [alpha.151 ข้อ 2] จัดข้อความในการ์ดแนวนอน — ปุ่มชุดเดียวกับจัดหน้าของตัวแก้ไข
    // แต่เมื่ออยู่บนกระดาน ความหมายคือ "ข้อความในการ์ด" ไม่ใช่ย่อหน้าในเอกสาร
    case 'planner-align': {
      const pl2 = activePlanner();
      if (!pl2) { setStatus(tt('ui.app.valignPlannerOnly')); break; }
      pl2.alignText('h', a[0]);
      break;
    }
    case 'dashboard': openDashboard(); break;
    case 'books': openBookManager(); break;
    // [alpha.141] จัดการบท + อ่านทั้งเล่ม
    case 'chapters': openChapterManager(); break;
    case 'read-book': await openBookReader(a[0] || ''); break;
    case 'timeline': openTimeline(); break;
    case 'maps': openMaps(); break;
    case 'network': openNetwork(); break;
    case 'planner': openPlanner(); break;
    case 'focus-mode': toggleFocus(); break;
    case 'toggle-theme': toggleTheme(a[0]); break;      // [60r2 ข้อ 10] Ctrl+Shift+P
    case 'sync-scene-meta': await syncSceneMetaFromFiles(); break;   // [60r2 ข้อ 13]
    // [alpha.60r3 ข้อ 4] ชุดเครื่องมือผู้แปล (JSON ↔ CSV)
    case 'export-language-csv': await exportLanguageCsv(); break;
    case 'import-language-csv': await importLanguageCsv(); break;
    // [alpha.60r3 ข้อ 5] แผงวิเคราะห์ด้วย AI (ตัวอย่างหน้าตา)
    case 'ai-analyzer': togglePanel('ai-analyzer'); refreshToolbar(); syncMenuToggles(); break;
    // [alpha.60r3 ข้อ 6] ซ่อน/แสดงรหัสมาร์กดาวน์+fountain ที่นำหน้าบรรทัด
    case 'markdown-codes': toggleMarkdownCodes(); break;
    // ══ [alpha.111] คำสั่ง "สร้างของใหม่" — เดิมมีแต่ในตารางคีย์ลัดแต่ **ไม่มีตัวรับ**
    // (กด Ctrl+Alt+1 แล้วเงียบมาตั้งแต่ alpha.79) · ตอนนี้ FAB กับคีย์ลัดใช้ทางเดียวกันแล้ว
    case 'scene': {
      if (!state.root) { setStatus(tt('ui.fab.needProject')); break; }
      const dst = await pickDraftTarget({ title: tt('ui.app.newSceneNew2') });
      if (!dst) break;
      addScene(dst.dPath, dst.chapter);
      break;
    }
    case 'chapter': {
      if (!state.root) { setStatus(tt('ui.fab.needProject')); break; }
      const dst = await pickDraftTarget({ needChapter: false, title: tt('ui.app.newChapterNew') });
      if (!dst) break;
      addChapter(dst.dPath);
      break;
    }
    // ตัวละคร/สถานที่/ของ/ตำนาน — หมวดเดียวกับโฟลเดอร์ใน Wiki (ชื่อหมวดมาจาก a[0])
    case 'new-entity': {
      if (!state.root) { setStatus(tt('ui.fab.needProject')); break; }
      const cat = a[0] || 'characters';
      const w = await wikiRoot();
      const dir = await kapi.join(w, cat);
      await kapi.mkdir(dir);
      addEntity(dir, cat);
      break;
    }
    case 'character': await handleCommand('new-entity', 'characters'); break;
    case 'location': await handleCommand('new-entity', 'locations'); break;
    case 'memo': if (state.root) addMemo(); else setStatus(tt('ui.fab.needProject')); break;
    // [alpha.111] เรียกแถบรูปแบบลอยมาที่เคอร์เซอร์ (ปุ่มบนแถบ + Ctrl+Shift+/)
    case 'fmtbar-here': fmtBarToPointer(); break;
    // [alpha.117] สภาพของแถบรูปแบบลอย — จาง · ชิดขอบบน/ล่าง · ล็อกไม่ให้ขยับ
    case 'fmtbar-opacity': cycleFmtbarOpacity(); break;
    case 'fmtbar-align': toggleFmtbarAlign(); break;
    case 'fmtbar-lock': toggleFmtbarLock(); break;
    // [60r2 ข้อ 9] เปิด/ปิดปุ่มลอยมุมขวาล่าง
    case 'toggle-fab': {
      const v = !(state.settings.fabEnabled !== false);
      state.settings.fabEnabled = v;
      document.body.classList.toggle('k-fab-off', !v);
      saveGlobalSetting('fabEnabled', v);            // [alpha.162 · W3] ค่าระดับผู้ใช้
      saveProjectMetaSoon(); syncMenuToggles();
      setStatus(v ? tt('ui.app.btnFloatFABOpen') : tt('ui.app.btnFloatFABClose'));
      break;
    }
    case 'reading-mode': toggleReading(); break;
    case 'line-numbers':
      state.settings.lineNumbers = !state.settings.lineNumbers;
      saveGlobalSetting('lineNumbers', state.settings.lineNumbers);   // [alpha.162 · W3] ค่าระดับผู้ใช้
      applySettings(); saveProjectMetaSoon(); syncMenuToggles(); refreshToolbar();
      setStatus(state.settings.lineNumbers ? tt('ui.app.numLineOpen') : tt('ui.app.numLineClose'));
      break;
    // ---- ฟีเจอร์ที่เคยไม่มีทางเข้าถึง (import ไว้แต่ไม่มีเมนู/ปุ่ม) ----
    case 'typewriter': setStatus(toggleTypewriter() ? tt('ui.app.modeTypewriterOpen') : tt('ui.app.modeTypewriterClose')); refreshToolbar();
                       syncTypeSound(); syncMenuToggles(); break;
    // [alpha.57a ข้อ 1] เสียงพิมพ์ — สวิตช์แยกจากโหมดเครื่องพิมพ์ดีด (ตั้งระดับเสียงในตั้งค่า)
    case 'type-sound':
      state.settings.typeSound = !state.settings.typeSound;
      syncTypeSound(); saveProjectMetaSoon(); syncMenuToggles();
      if (state.settings.typeSound) playType('key', { force: true });
      setStatus(state.settings.typeSound
        ? tt('ui.app.soundTypewriterOpen') + (state.settings.typeSoundAlways || isTypewriter() ? '' : tt('ui.app.hearOpenModeTypewriter'))
        : tt('ui.app.soundTypewriterClose'));
      break;
    case 'quick-open': openQuickOpen(); break;
    // [alpha.62 บั๊ก 20] วิ่งผ่าน renderFeaturePanel เหมือนแผงอื่น — dedupe การวาดซ้ำให้ด้วย
    case 'global-search': showPanel('search'); renderFeaturePanel('search'); syncMenuToggles(); refreshToolbar(); break;
    case 'branching': openBranchingTree(); syncMenuToggles(); break;
    case 'branch-sync': syncChoicesFromScene(); break;
    // [alpha.66 ข้อ 9] ทดลองเล่น — เดินตามทางเลือกเหมือนผู้เล่น (อ่านอย่างเดียว)
    case 'player-mode': openPlayerMode(); syncMenuToggles(); break;
    case 'floorplan': openFloorPlan(); break;
    // [alpha.62 บั๊ก 18] เช่นเดียวกัน — เดิมนี่เป็น "ทางเดียว" ที่แผงโน้ตเคยถูกวาด
    case 'scratchpad': showPanel('notes'); renderFeaturePanel('notes'); syncMenuToggles(); break;
    case 'export-blog': exportBlogHTML(); break;
    case 'export-zip': exportProjectZip(); break;
    // [alpha.167] เมนู ส่งออก → <แผง> → <รูปแบบ> (ตาราง PANEL_EXPORTS ใน panel-exports.js)
    case 'export-panel': await exportPanel(a[0], a[1]); break;
    case 'export-json': exportProjectJson(); break;
    case 'backup-now': autoBackupNow(); break;
    case 'new-from-template': newProjectFromTemplate(); break;
    case 'import-scrivener': importScrivenerDialog((p) => openProjectFromUi(p)); break;
    // [alpha.60 ข้อ 62-66] นำเข้าบทภาพยนตร์จาก 5 รูปแบบ (Fountain · FDX · Celtx · Fade In · Adobe Story)
    case 'import-script': {
      // [alpha.124 ข้อ 29] `mode` มาจากกล่องพรีวิว: 'new' = สร้างฉากใหม่ (ค่าเริ่มต้น)
      // · 'replace' = ทับแท็บปัจจุบัน (ผู้ใช้เลือกเองและเห็นเนื้อที่จะทับแล้ว)
      // [alpha.164 · บั๊ก] ทับได้เฉพาะแท็บบทภาพยนตร์ที่แก้ได้ — ไม่งั้นไม่มีปุ่ม "ทับแท็บปัจจุบัน"
      const canReplace = (tb) => !!(tb && tb.sp && !tb.locked);
      const result = await importScreenplayDialog(async (markdown, format, summary, mode) => {
        const t = state.active;
        if (mode === 'replace' && !canReplace(t)) {
          // แท็บเปลี่ยนไประหว่างกล่องเปิดอยู่ (ปิด/สลับ/ล็อก) — ไม่ทับอะไร และไม่แอบสร้างฉากใหม่แทน
          setStatus(gi('warning') + ' ' + tt('ui.app.importReplaceNoTab'));
          return;
        }
        if (mode === 'replace' && t && t.sp) {
          // มีแท็บบทเปิดอยู่ → inject เข้า tab ปัจจุบัน
          t.sp.setMarkdown(markdown);
          if (t.editor) t.editor.setMarkdown(markdown);
          markDirty(t);
          setStatus(ttf('ui.app.importScreenplayF', format, summary.scenes, summary.characters));
        } else {
          // ยังไม่มีแท็บบท → สร้างแท็บฉากใหม่ในบทปัจจุบัน
          // ฉบับร่าง/บทของฉากที่เปิดอยู่ — เดิมอ่าน `state.active.meta.section/.draft` ซึ่ง **ไม่มีอยู่จริง**
          // (meta = frontmatter ของไฟล์) → kapi.join(root, undefined, 'Draft', undefined) โยนทุกครั้งที่มีฉากเปิดอยู่
          // = "สร้างเป็นฉากใหม่" ไม่เคยทำงานเลยในกรณีปกติที่สุด
          const cur = await sceneCtx();
          // [alpha.124 ข้อ 29] ไม่มีแท็บฉากเปิดอยู่ ก็ยังนำเข้าได้ — ถามว่าจะลงฉบับร่างไหน
          // (เดิมตันตรงนี้: ต้องเปิดฉากอะไรสักฉากก่อนถึงจะนำเข้าบทได้ ซึ่งไม่มีเหตุผลเลย)
          let dPath = cur ? cur.dPath : null;
          if (!dPath) {
            const ds = await listDrafts();
            if (ds.length === 1) dPath = ds[0].dPath;
            else if (ds.length > 1) {
              const pick = await pickFromList(tt('ui.app.exportChapterDraft'), ds.map((d) => d.label));
              dPath = pick ? (ds.find((x) => x.label === pick) || {}).dPath : null;
              if (!dPath) return;                       // ยกเลิกกล่องเลือก = ไม่นำเข้า
            }
          }
          if (dPath) {
            // [แก้บั๊ก] เดิมเรียก `createNewScene()` ซึ่ง **ไม่มีอยู่ในโปรเจกต์เลย** → ReferenceError
            // ในคอลแบ็ก async ที่ไม่มีใครจับ = "นำเข้าแล้วไม่มีอะไรเกิดขึ้น" เงียบสนิท
            // (ถึงจะมีจริงก็ยังพังต่อ: `activate()` ไม่คืนแท็บ → `tab?.sp` เป็น undefined เสมอ)
            // ตัวจริงคือ `addScene(dPath, ch, title, {meta, body})` ซึ่งต้องมี "บท" ปลายทางด้วย
            const dj = await kapi.readJson(await kapi.join(dPath, 'draft.json')).catch(() => ({}));
            const ch = (cur && cur.dPath === dPath && cur.ch)
              || (dj.chapters || [])[0] || await addChapter(dPath, tt('ui.app.import') + format);
            if (!ch) return;                            // ยกเลิกกล่องตั้งชื่อบท = ไม่นำเข้า
            const row = await addScene(dPath, ch,
              // ชื่อจากหน้าปกของไฟล์ (Fountain `Title:`) ก่อน · ไม่มีค่อยตั้งชื่อตามรูปแบบไฟล์
              (summary && summary.title) || (tt('ui.app.import') + format + '-' + Date.now().toString(36)),
              { meta: { format: 'screenplay' }, body: markdown, silent: true });
            if (!row) return;
            await openScene(row.path, row.title);       // เขียนลงไฟล์ไปแล้ว → เปิดมาก็ไม่ค้างสถานะยังไม่บันทึก
            setStatus(ttf('ui.app.importScreenplayF2', format, summary.scenes, summary.characters));
          } else {
            await confirmBox(tt('ui.app.importNotOkNot'), tt('ui.common.msg3'));
          }
        }
      }, { canReplace: canReplace(state.active) });
      break;
    }
    // [alpha.60 ข้อ 74] เปรียบเทียบบท/สคริปต์
    case 'sp-compare': {
      const tabs = [...state.tabs.entries()];
      const spTabs = tabs.filter(([, t]) => t.sp || t.editor);
      if (spTabs.length < 2) {
        infoBox(tt('ui.app.mustOpenTabScreenplay'));                     // [alpha.162 · W4]
        break;
      }
      // แสดงรายการให้เลือก 2 แท็บ
      // [แก้บั๊ก] เดิมใช้ `window.prompt()` ซึ่ง **เป็น no-op ใน Electron** (คืน null ทันที ไม่มีกล่องโผล่)
      // → `parseInt(null)` = NaN → `break` ทุกครั้ง = "เปรียบเทียบบท" กดแล้วไม่มีอะไรเกิดขึ้นเลย
      // ผิดกฎที่โปรเจกต์ตั้งไว้เองด้วย (บทเรียนข้อ 3) — ใช้ `pickFromList` เหมือนกล่องเลือกอื่นทุกที่
      const names = spTabs.map(([f]) => f.split(/[/\\]/).pop().replace(/\.md$/i, ''));
      const rows = names.map((n, i) => (i + 1) + '. ' + n);
      const oldPick = await pickFromList(tt('ui.app.pickEditionNum'), rows);
      const oldIdx = rows.indexOf(oldPick) + 1;
      if (!oldIdx) break;                                  // ปิดกล่อง = ไม่เปรียบเทียบ
      const newPick = await pickFromList(tt('ui.app.pickEditionNewNum'),
                                         rows.filter((_, i) => i + 1 !== oldIdx));
      const newIdx = rows.indexOf(newPick) + 1;
      if (!newIdx || newIdx === oldIdx) break;

      const oldTab = spTabs[oldIdx - 1][1];
      const newTab = spTabs[newIdx - 1][1];
      const oldText = oldTab.sp ? oldTab.sp.getMarkdown() : (oldTab.editor ? oldTab.editor.getMarkdown() : oldTab.body);
      const newText = newTab.sp ? newTab.sp.getMarkdown() : (newTab.editor ? newTab.editor.getMarkdown() : newTab.body);
      const oldLabel = spTabs[oldIdx - 1][0].split(/[/\\]/).pop().replace(/\.md$/i, '');
      const newLabel = spTabs[newIdx - 1][0].split(/[/\\]/).pop().replace(/\.md$/i, '');

      showComparisonDialog(oldText, newText, { old: oldLabel, new: newLabel });
      break;
    }
    case 'ai-settings': showAISettingsDialog(); break;
    case 'ai-summary': showAISummary(); break;
    case 'ai-title': showAITitleSuggestions(state.title || '', async (title) => {
        if (!state.meta) return;
        state.meta.title = title; state.title = title;
        await saveProjectMeta();
        setStatus(tt('ui.app.changeTitle') + title);
      }, { kind: 'project' }); break;
    case 'custom-status': manageCustomStatuses(); break;
    case 'visual-tags': manageVisualTags(); break;
    case 'player-history': showPlayerHistory(); break;
    case 'all-notes': showAllNotes(); break;
    case 'quick-note': { const c = await sceneCtx();
      quickNote(c?.row?.id, c?.row?.title); break; }
    case 'comments': await openCommentsPanel(); syncMenuToggles(); break;
    case 'show-panel': showPanel(a[0]); syncMenuToggles(); break;
    // สลับแสดง/ซ่อนแผง — เมนูเป็นสวิตช์ (มีเครื่องหมายถูก) จึงต้องปิดได้ด้วย ไม่ใช่แค่เปิด
    // แผงฟีเจอร์ (บั๊ก #18) วาดเนื้อหาผ่าน hook ใน showPanel แล้ว
    case 'toggle-panel': togglePanel(a[0]); syncMenuToggles(); break;
    case 'reset-panels': resetPanels(); syncMenuToggles(); break;
    // [alpha.79] ปรับปุ่มบนแถบเครื่องมือ (เมนู มุมมอง · คลิกขวาที่ปุ่ม "จัดการแผง" · ตั้งค่า)
    case 'toolbar-config': toolbarDialog(); break;
    case 'export-panel-layout': await exportPanelLayout(); break;
    // [alpha.61 ข้อ 1] สวิตช์ลำดับเปิดโปรแกรม (เก็บที่ global settings — ใช้ร่วมทุกโปรเจกต์)
    case 'delete-line': deleteCurrentLine(); break;
    // [alpha.61 ข้อ 4] สวิตช์ตัวพิมพ์ใหญ่/เล็กของบทหนัง — เก็บที่ระดับโปรเจกต์
    case 'sp-force-case': toggleSpCase('spForceCase'); break;
    // [alpha.62 บั๊ก 11] ปิด/เปิดตัวพิมพ์ใหญ่รายชนิด element
    case 'sp-element-caps': toggleElementCaps(a[0]); break;
    case 'sp-auto-capitalize': toggleSpCase('spAutoCapitalize'); break;
    case 'sp-auto-correct-i': toggleSpCase('spAutoCorrectI'); break;
    case 'toggle-open-last': await toggleOpenLastProject(); break;
    case 'toggle-home-always': await toggleShowHomeAlways(); break;
    case 'home': { const { showHomeDialog } = await import('./home-ui.js'); await showHomeDialog(); break; }
    case 'export-draft': exportDraft(); break;
    case 'zoom':
      if (a[0] === 'fit') zoomFitWidth();
      else if (a[0] === 0) resetPageScale();
      else bumpPageScale(a[0]);
      break;
    case 'auto-fit-width': setAutoFitWidth(); break;   // [alpha.164 · รอบต่อ 3 · งาน 3]
    case 'ui-scale': bumpUIScale(a[0]); break;
    // [alpha.81 ข้อ 9] ทางส่งออกทั้งหมดรวมอยู่ในกล่องเดียว — เมนู ไฟล์ → ส่งออก… (Ctrl+Shift+E)
    case 'export-hub': await openExportHub(); break;
    case 'compile': openCompileDialog(); break;
    case 'settings': settingsDialog(); break;
    case 'toggle-format': switchFormat(); break;
    case 'set-format': switchFormat(a[0]); break;
    case 'about': aboutDialog(); break;
    // [alpha.135] เมนู ช่วยเหลือ → ตรวจหาอัปเดต… (ไม่เงียบ — บอกผลทุกกรณี)
    case 'check-update': await checkForUpdates({ silent: false }); break;
    // [alpha.58r ข้อ 4] คอนโซลนักพัฒนา (Ctrl+Shift+`) — อยู่เมนูเดียวกับ "เกี่ยวกับ"
    case 'dev-console': openDevConsole(); break;
    // [alpha.124 ข้อ 36] หมุนรูปตัวพิมพ์ของช่วงที่เลือก (Ctrl+Alt+U) — เดิมไม่มีคีย์ลัดเลย
    // ต้องละมือจากแป้นไปคลิก dropdown ทุกครั้ง ทั้งที่เป็นงานที่ทำรัว ๆ ตอนจัดหัวฉาก/ชื่อตัวละคร
    case 'text-case-cycle': {
      const edC = getActiveEditor();
      if (!edC) { setStatus(tt('ui.app.openSceneBeforeChangeImage')); break; }
      _caseCycle = (_caseCycle + 1) % CASE_MODES.length;
      const mode = CASE_MODES[_caseCycle];
      await handleCommand('text-case', mode);
      setStatus(tt(CASE_LABELS[mode]) || CASE_SHORT[mode]);
      break;
    }
    // [alpha.124 ข้อ 3] ตารางคีย์ลัด — ตอนนี้เป็นคำสั่งจริงในตาราง (Ctrl+Alt+/) ไม่ใช่ listener ลอย
    case 'cheatsheet': showShortcutsDialog(); break;
    // [alpha.125 ข้อ H] คลังคำพ้อง — เดิมเข้าได้ทางเดียวคือคลิกขวาบนคำ (คนที่ไม่คลิกขวาไม่มีทางรู้ว่ามี)
    case 'thesaurus': {
      const w = (window.getSelection()?.toString() || '').trim();
      if (!w) { setStatus(tt('ui.thes.selectWordFirst')); break; }
      const r = getActiveEditor()?.view?.dom?.getBoundingClientRect();
      showThesaurusPopup(w, r ? r.left + 40 : 120, r ? r.top + 60 : 120);
      break;
    }
    // [alpha.124 ข้อ 8] เมนู เครื่องมือ → "ตรวจหาคำซ้ำ · สถิติการใช้คำ" ส่ง `word-history` มาตั้งแต่
    // alpha.60 แต่ **ไม่เคยมี case รับ** → กดแล้วเงียบสนิทมาตลอด (ไม่มีแม้แต่ error)
    // ของจริงอยู่ในแผง "AI วิเคราะห์" อยู่แล้ว 2 ใบ: 🔁 ตรวจหาคำซ้ำ · 📝 การใช้คำ
    // (ทั้งคู่คำนวณในเครื่องได้ ไม่ต้องมีคีย์ AI) → เปิดแผงแล้วพาไปที่การ์ดนั้นเลย
    // [alpha.156] ตรวจสุขภาพโปรเจกต์ · ค้นหา-แทนที่ทั้งโปรเจกต์ · สปรินต์การเขียน
    case 'project-doctor': {
      const m = await import('./project-doctor-ui.js');
      await m.openProjectDoctor();
      break;
    }
    case 'project-replace': {
      const m = await import('./project-replace-ui.js');
      await m.openProjectReplace((window.getSelection()?.toString() || '').trim().slice(0, 200));
      break;
    }
    case 'sprint': {
      const m = await import('./sprint-ui.js');
      m.openSprintDialog();
      break;
    }
    case 'word-history': {
      showPanel('ai-analyzer');
      renderFeaturePanel('ai-analyzer');
      syncMenuToggles();
      focusAnalysis('repeat');
      break;
    }
    // [alpha.58r บั๊ก 16–24] รูปแบบนิยาย
    case 'prose-setup': settingsDialog('prose'); break;
    case 'test-run': runTest(a[0]); break;
    // [95] Per-element shortcuts + [79] Select scene + [77] Non-breaking space
    case 'sp-element': {
      const sp = state.active?.sp;
      // [alpha.124 ข้อ 5] โหมดนิยาย/ไม่มีแท็บ = คีย์นี้ใช้ไม่ได้ → **บอกให้รู้** ไม่ใช่เงียบ
      // และห้าม markDirty: เดิมวิ่งทุกกรณี → กด Ctrl+5 ในนิยายแล้วไฟล์กลายเป็น "งานค้าง"
      // ทั้งที่ไม่มีอะไรเปลี่ยนสักตัวอักษร (แล้วโดนบังคับบันทึกตอนปิดแท็บ)
      if (!sp) { setStatus(tt('ui.app.spElementScriptOnly')); break; }
      sp.switchTo(a[0]);
      refreshToolbar();
      if (t) markDirty(t);
      break;
    }
    case 'select-scene': {
      const spAct = state.active?.sp;
      if (spAct) spAct.selectScene();
      break;
    }
    case 'nbsp': {
      const ed = getActiveEditor();
      if (ed?.view) ed.view.dispatch(ed.view.state.tr.insertText('\u00A0'));
      ed?.focus();
      break;
    }
    // [alpha.116 ข้อ 8 · alpha.121] แทรกโค้ดสั้นตรงเคอร์เซอร์ (ทะเบียนอยู่ที่ src/shortcode.js)
    // เมนู "แทรก" ของ OS เป็นทางเดียวที่ไม่ผูกกับพื้นที่ใดพื้นที่หนึ่ง — ต้องฉลาดพอจะรู้ว่า
    // ตอนนี้ผู้ใช้กำลังโฟกัสอยู่ที่ไหน: ตัวแก้ไขเอกสาร (นิยาย/บทหนัง/ส่วน Wiki แบบ ProseMirror)
    // ยังคงแทรก placeholder ดิบให้คอมไพล์ทีหลังเหมือนเดิม · ช่องข้อความธรรมดา (ฟิลด์ Wiki ·
    // ช่องแชท AI · กล่องคอมเมนต์) แทนค่าจริงทันทีแทน — ไม่มีขั้นตอนคอมไพล์ให้รอ
    case 'insert-shortcode': {
      const ed = getActiveEditor();
      if (ed && ed.view) { insertShortcodeMenu(a[0]); break; }
      const act = document.activeElement;
      const plain = (act && typeof act.selectionStart === 'number' && !act.readOnly) ? act : lastWikiField;
      if (plain && document.body.contains(plain)) { await openResolvedShortcodeMenu(a[0], plain); break; }
      setStatus(tt('ui.shortcode.needEditor'));
      break;
    }
    case 'revert': if (t) await revertTab(t.file); break;
    case 'remove-elements': removeElementsDialog(); break;
    case 'char-map': showCharMap(); break;
    // [97] หน้ารายชื่อตัวละคร (Cast of Characters) ประจำเล่ม
    case 'roster': await openRosterFlow(); break;
    // [98] ข้อมูลโปรเจกต์เพิ่มเติม (ผู้เขียน/ตัวแทน/ลิขสิทธิ์) — เปิดตั้งค่าที่แท็บนั้น
    case 'project-setup': settingsDialog('setup'); break;
    // [81-85][92] หน้ากระดาษ · ระยะขอบ · รูปแบบ element · กฎตัดหน้า · ข้อความมาตรฐาน
    case 'page-setup': settingsDialog('page'); break;
    // ---- Part 1+2: ฟีเจอร์ใหม่ (Kanban, Panel, Split, AI, Thesaurus, Auto-sync) ----
    case 'kanban': togglePanel('kanban'); break;
    case 'split-view': toggleSplit(state.active?.file || '', a[0] || undefined); break;
    case 'split-add': createSplit(state.active?.file || '', a[0] || undefined); break;   // เพิ่มอีกช่อง (ซ้อนได้)
    case 'split-close': closeSplit(); break;
    case 'panel-system': togglePanelDialog(); break;
    // ---- [alpha.66r3] จัดการพื้นที่ + เวิร์กสเปซ (สเปกระบบแผง) ----
    case 'panels-hide-all': toggleSpace('all'); syncMenuToggles(); break;
    case 'panels-hide-right': toggleSpace('right'); syncMenuToggles(); break;
    case 'panels-hide-left': toggleSpace('left'); syncMenuToggles(); break;
    // [alpha.157] ปุ่มขวาสุดของแถบเครื่องมือ — ซ่อน/แสดงแผงทีละฝั่ง (สี่ฝั่งอิสระต่อกัน)
    case 'panels-side-left': toggleSide('left'); syncSideToggles(); break;
    case 'panels-side-top': toggleSide('top'); syncSideToggles(); break;
    case 'panels-side-bottom': toggleSide('bottom'); syncSideToggles(); break;
    case 'panels-side-right': toggleSide('right'); syncSideToggles(); break;
    case 'workspace-menu': workspaceMenu(); break;
    case 'workspace': applyWorkspace(a[0]); syncMenuToggles(); break;
    case 'ai-assistant': openAIAssistant(); break;
    case 'ai-menu': openAiMenu(); break;                // [alpha.162 · W5 ข้อ 4]
    case 'ai-plot': openPlotHoleDetector(); break;
    case 'ai-dialogue': openDialogueGenerator(); break;
    case 'ai-consistency': { const t2 = state.active;
      openConsistencyCheck(t2?.file || ''); break; }
    case 'ai-world': openWorldGenerator(); break;
    // [alpha.61 ข้อ 2] แชท AI เป็น "แผง" แบบ opencode แล้ว — กล่องเดิมยังเรียกได้ที่ ai-chat-dialog
    case 'ai-chat': showPanel('ai-chat'); await renderFeaturePanel('ai-chat');
                    syncMenuToggles(); break;
    // [alpha.62 บั๊ก 2] ปุ่มบนแถบเครื่องมือเป็นสวิตช์จริง — กดซ้ำแล้วต้องปิดแผงได้
    case 'ai-chat-toggle':
      if (isPanelOpen('ai-chat')) hidePanel('ai-chat');
      else { showPanel('ai-chat'); await renderFeaturePanel('ai-chat'); }
      refreshToolbar(); syncMenuToggles(); break;
    case 'ai-chat-new': showPanel('ai-chat'); await newChatSession();
                        syncMenuToggles(); break;
    // [alpha.160 · P3] แชทรุ่นเก่าเลิกใช้ — คำสั่งเดิมเปิดแผงแชทใหม่ (เมนูที่ซ้ำถูกถอดแล้ว)
    case 'ai-chat-dialog': await openAIChat(); syncMenuToggles(); break;
    // [alpha.94] Story Starter — เป็นแผง (กฎ: ฟีเจอร์ที่ไม่ใช่เอกสาร = แผง ไม่ใช่แท็บ)
    case 'story-starter': await openStoryStarter(); syncMenuToggles(); break;
    case 'story-starter-toggle':
      if (isPanelOpen('starter')) hidePanel('starter');
      else await openStoryStarter();
      refreshToolbar(); syncMenuToggles(); break;
    case 'auto-sync': setAutoSync(a[0] === undefined ? !isAutoSyncOn() : !!a[0]);
                      state.settings.autoSync = isAutoSyncOn(); saveProjectMetaSoon(); break;
    // ---- alpha.57: มุมมองบท (57/59/60/61) · ไปยังหน้า-ฉาก (78) · ตรวจบท (54) · ส่งออก (67/68/70) ----
    case 'sp-view': setSpView(a[0]); break;
    // [alpha.100 ข้อ 2] เส้นบอกระยะขอบกระดาษ — สวิตช์เดียว ครบทั้งสี่ด้านทุกแผ่น
    case 'page-guides': togglePageGuides(a[0]); break;
    case 'sp-show-format': toggleShowFormat(a[0]); break;
    // ---- alpha.58: ระบบต่อเนื่อง (55/56) · รายงานบท (71/72/73) ----
    case 'sp-continued': toggleContinueds(a[0]); break;
    // [alpha.84] สวิตช์ใหม่บนแถบรูปแบบ
    case 'sp-thai-font': toggleSpThaiFont(a[0]); break;
    case 'prose-indent': toggleProseIndent(a[0]); break;
    case 'sp-report': openSpReport(a[0] || 'location'); break;
    case 'goto': gotoDialog(a[0]); break;
    // ไม่มีเลข (คีย์ลัด Ctrl+Shift+. ส่งมาเปล่า ๆ) = ถามเลขก่อน — เดิมกระโดดหน้า 1 เงียบ ๆ + "ไปที่หน้า  จาก N หน้า"
    case 'goto-page': if (a[0] == null || a[0] === '') gotoDialog('page'); else gotoPage(a[0]); break;
    case 'goto-scene': if (a[0] == null || a[0] === '') gotoDialog('scene'); else gotoScene(a[0]); break;
    case 'sp-find-error': findNextSpError(); break;
    case 'sp-check-all': showErrorList(); break;
    case 'sp-check-toggle':
      state.settings.spCheckBeforeExport = state.settings.spCheckBeforeExport === false;
      saveProjectMetaSoon(); syncMenuToggles();
      setStatus(state.settings.spCheckBeforeExport ? tt('ui.app.checkChapterBeforeExport2') : tt('ui.app.checkChapterBeforeExport'));
      break;
    case 'export-fdx': await exportScript('fdx'); break;
    case 'export-rtf': await exportScript('rtf'); break;
    case 'export-watermark': await watermarkDialog(); break;
    // ---- alpha.57a ----
    case 'scene-numbers': toggleSceneNumbers(); break;
    case 'page-numbers': togglePageNumbers(); break;
    case 'sp-extension': extensionMenu(); break;
    case 'smart-manage': smartTypeDialog(); break;
    case 'lang-fonts': settingsDialog('fonts'); break;
    // ---- alpha.59: ชุด PDF (69/87/88/89/90/91) ----
    case 'title-pages': await openTitlePageDialog(); break;
    case 'page-headers': await openHeaderDialog(); break;
    case 'export-pdf-builtin': await pdfExportDialog(); break;
  }
}
kapi.onMenu(handleCommand);

// [alpha.124 ข้อ 36] ตำแหน่งในวง CASE_MODES ของคีย์ลัด "หมุนรูปตัวพิมพ์"
let _caseCycle = -1;

// ---- คีย์ลัดฝั่ง renderer: จับด้วย e.code (ปุ่มกายภาพ = ทำงานทุกภาษาแป้นพิมพ์
//      และไม่พึ่ง accelerator ของเมนู native ที่หน้าต่างไร้ขอบบน Windows มักไม่ยิง) ----
// SHORTCUTS, SHORTCUT_LABELS, shortcutId, accelText, formatShortcut → ย้ายไป core.js
/**
 * ══ [alpha.162 · W4 ข้อ 5] ★★ คีย์วนธาตุบทเป็นของ "เอกสารบทภาพยนตร์" ไม่ใช่ของแถบแท็บ ══
 *
 * `onShortcut` ดักที่ `window` ระยะ **capture** จึงยิงก่อน handleKeyDown ของตัวแก้ไขเสมอ
 * ค่าเริ่มต้นของ `spCycleKeys` คือ Ctrl+Tab / Ctrl+Shift+Tab (ตั้งไว้ตั้งแต่ alpha.61)
 * ซึ่งตรงกับคีย์ลัด `next-tab` / `prev-tab` เป๊ะ ๆ → **คีย์วนธาตุบทค่าเริ่มต้นยิงไม่ออกเลย
 * สักครั้งเดียว** กดแล้วได้สลับแท็บแทนทุกที (พิสูจน์ใน e2e [162-W4] ก่อนแก้)
 *
 * กติกา: เคอร์เซอร์อยู่ในบทภาพยนตร์ + ปุ่มตรงกับที่ผู้ใช้ผูกไว้ → ปล่อยให้เอกสารรับไป
 * สลับแท็บยังกดได้ที่ **Ctrl+PageDown / Ctrl+PageUp** ที่เพิ่มเป็นทางที่สอง (ทางนี้ยังใช้บน
 * mac ได้ด้วย — ⌘Tab เป็นของระบบปฏิบัติการ ไปไม่ถึงโปรแกรมตั้งแต่แรก)
 */
function spOwnsKey(e, ch) {
  if (ch !== 'next-tab' && ch !== 'prev-tab') return false;
  const sp = state.active?.sp;
  if (!sp || !sp.view || !sp.view.hasFocus()) return false;
  if (state.settings?.spCycleEnabled === false) return false;
  const K = spCycleKeys(state.settings);
  return spKeyMatch(K.tab, e) || spKeyMatch(K.shiftTab, e);
}

function onShortcut(e) {
  // ปล่อยให้ cut/copy/paste/select-all ทำงานเองตามเบราว์เซอร์ (ในช่องแก้ไข)
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) return;
  const ae = document.activeElement;
  const inField = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT');
  for (const [code, needCtrl, needShift, ch, ...args] of effectiveShortcuts()) {
    // [alpha.79] ช่องที่สองรับ 'ctrl+alt' ได้แล้ว — ต้องเทียบ Alt ด้วย ไม่ใช่บังคับ !altKey ทื่อ ๆ
    if (e.code === code && !!needCtrl === ctrl && !!needShift === e.shiftKey
        && needsAlt(needCtrl) === e.altKey) {
      // undo/redo: ในช่อง input/textarea ให้เบราว์เซอร์จัดการเอง (อย่าไปขับ PM)
      if ((ch === 'editor-undo' || ch === 'editor-redo') && inField) return;
      // ══ [alpha.152 ข้อ 4+5] ★★ คีย์ของ "เอกสาร" เป็นของแผงที่ถูกเลือกอยู่ ถ้าแผงนั้นดูแลคีย์เอง ══
      //
      // กระดานวางแผนมี undo/redo ของตัวเอง (ประวัติกระดาน คนละกองกับประวัติเอกสาร)
      // ตัวนี้ดักที่ `window` ระยะ capture จึงยิงก่อนตัวจับของกระดานเสมอ แล้วสั่ง `editor-undo`
      // ซึ่งไปโฟกัสตัวแก้ไขเอกสาร → กดย้อนกลับบนกระดานแล้วเอกสารย้อนแทน และโฟกัสกระโดดหนี
      // (เจอตอนเขียนเทสข้อ 4: ตัวกระดานถูกเรียกจริงแต่โฟกัสถูกแย่งไปแล้วตั้งแต่ก่อนหน้า)
      // ★ เฉพาะตอน **ไม่ได้อยู่ในพื้นที่พิมพ์** — เคอร์เซอร์ยังกะพริบอยู่ในเอกสารเมื่อไหร่
      // Ctrl+Z ก็ยังเป็นของเอกสารตามที่ควรเป็น (กดบนกระดานจริง ๆ ตัวแก้ไขจะหลุดโฟกัสไปเอง)
      if (ch.startsWith('editor-') && !inField && !(ae && ae.isContentEditable)
          && focusedPanelOwnsKeys()) return;
      if (spOwnsKey(e, ch)) return;               // [alpha.162 · W4 ข้อ 5] เอกสารบทเป็นเจ้าของคีย์นี้
      e.preventDefault();
      handleCommand(ch, ...args);
      return;
    }
  }
}
window.addEventListener('keydown', onShortcut, true);

// ══════════ [alpha.130 ข้อ 4] ★ Ctrl+A ต้องมี "ขอบเขต" ══════════
//
// ผู้ใช้: *"Ctrl+A ไปเลือกที่ app ได้ยังไง มันต้องเลือกที่ฉาก และส่วน input/output
//          ตอนนี้มันกลายเป็นเลือกข้อความทั้ง app"*
//
// Ctrl+A ไม่เคยอยู่ในตาราง SHORTCUTS จึงตกเป็นของเบราว์เซอร์ล้วน ๆ — ซึ่งถ้าโฟกัสไม่ได้อยู่ใน
// ช่องแก้ไขใด ๆ (คลิกพื้นที่ว่าง · เพิ่งกดปุ่มบนแถบเครื่องมือ · โฟกัสหลุดไปที่ <body>)
// `document.execCommand('selectAll')` จะกวาด **ทั้งหน้าต่าง**: แถบเครื่องมือ · ต้นไม้โปรเจกต์ ·
// แถบสถานะ · ทุกแผงที่เปิดอยู่ (วัดจริง: ได้ข้อความมา 19,234 ตัวอักษรจากทั่วทั้งแอป)
// แล้วทุกอย่างขึ้นไฮไลต์สีน้ำเงินพร้อมกัน — และคำสั่งถัดไปที่ผู้ใช้กดก็ไม่รู้จะไปลงที่ไหน
//
// กติกา: Ctrl+A มีความหมายเดียวคือ "เลือกทั้งหมด **ในที่ที่กำลังพิมพ์อยู่**"
//   · อยู่ในช่องข้อความ/ตัวแก้ไข → ปล่อยผ่าน เจ้าของช่องจัดการเอง (PM มี selectAll ของมันอยู่แล้ว)
//   · ไม่ได้อยู่ในช่องไหนเลย → ห้ามให้เบราว์เซอร์กวาดทั้งแอป · โยนไปให้ตัวแก้ไขที่เปิดอยู่แทน
//     (ไม่มีตัวแก้ไขเปิดอยู่ = ไม่ทำอะไรเลย ดีกว่าเลือกทั้งแอป)
/** อยู่ในพื้นที่ที่ "เลือกทั้งหมด" มีความหมายของตัวเองหรือยัง */
function inEditableScope(node) {
  const el = node && node.nodeType === 1 ? node : (node && node.parentElement) || null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!el.closest('[contenteditable="true"], .ProseMirror, input, textarea');
}
export function onSelectAllKey(e) {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.code !== 'KeyA') return false;
  const ae = document.activeElement;
  if (inEditableScope(ae) || inEditableScope(e.target)) return false;   // เจ้าของช่องจัดการเอง
  // ต้นไม้โปรเจกต์มี Ctrl+A ของตัวเอง (เลือกทุกแถว) — ตัวจัดการของมันกิน event ไปก่อนแล้ว
  if (ae && ae.closest && ae.closest('#tree')) return false;
  e.preventDefault();
  const ed = getActiveEditor();
  if (!ed || !ed.view) { setStatus(t('ui.app.selectAllNeedEditor')); return true; }
  ed.focus();
  ed.view.dispatch(ed.view.state.tr.setSelection(
    new PMAllSelection(ed.view.state.doc)));
  refreshToolbar();
  return true;
}
window.addEventListener('keydown', onSelectAllKey, true);
// (บันทึกทั้งหมด Ctrl+Alt+S ย้ายเข้าตาราง SHORTCUTS แล้ว — ตั้งใหม่เองได้เหมือนรายการอื่น)

// ---------------- [alpha.81 ข้อ 2] จำสถานะปุ่ม Ctrl/⌘ ไว้ที่ body ----------------
// ลิงก์ Wiki ในตัวแก้ไขเปิดด้วย **Ctrl+คลิก** เท่านั้น — คลิกเปล่าแค่ย้ายเคอร์เซอร์
// ตัวชี้เมาส์จึงต้องเป็น "ตัวพิมพ์" ตามปกติ และเป็น "มือ" เฉพาะตอนกดคีย์นั้นค้างจริง ๆ
// (CSS: `.k-mention { cursor:text }` + `body.k-mod-down .k-mention { cursor:pointer }`)
export function setModDown(on) {
  document.body.classList.toggle('k-mod-down', !!on);
  return !!on;
}
const _syncMod = (e) => setModDown(e.ctrlKey || e.metaKey);
window.addEventListener('keydown', _syncMod, true);
window.addEventListener('keyup', _syncMod, true);
window.addEventListener('blur', () => setModDown(false));           // สลับหน้าต่างตอนกดค้าง = ค้างเป็นมือตลอดไป
window.addEventListener('mousemove', _syncMod, { passive: true, capture: true });

// ---------------- [alpha.83r ข้อ 4] คำใบ้ "Ctrl+คลิก เปิดใน Wiki" ไปอยู่แถบสถานะ ----------------
// เดิมเป็น `title=` ของ decoration → ป้ายลอยของระบบเด้งตามเมาส์แล้ว **ทับตำแหน่งที่กำลังจะคลิก**
// (แก้ไปแล้วในรอบก่อนด้วยการถอด title ทิ้ง แต่คำใบ้ก็หายไปด้วย)
// ตอนนี้ขึ้นกลางแถบสถานะด้านล่างแทน — เห็นชัด ไม่บังอะไร และไม่ขวางเคอร์เซอร์
let _hoverHint = '';
function setHoverHint(text) {
  const v = String(text || '');
  if (v === _hoverHint) return;
  _hoverHint = v;
  const box = $('#status-center');
  if (box) box.textContent = v;
}
document.addEventListener('mouseover', (e) => {
  const el2 = e.target && e.target.closest ? e.target.closest('.k-mention') : null;
  setHoverHint(el2 ? tt('ui.editor.ctrlClickOpenWiki') : '');
}, { passive: true, capture: true });
document.addEventListener('mouseout', (e) => {
  if (e.target && e.target.closest && e.target.closest('.k-mention')) setHoverHint('');
}, { passive: true, capture: true });

// ---------------- ซูมด้วย Ctrl+ล้อเมาส์ + Ctrl+0 รีเซ็ต (ทั้งโหมดนิยาย/บทหนัง) ----------------
window.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  // ทำงานเมื่ออยู่เหนือพื้นที่ตัวแก้ไข (ProseMirror) เท่านั้น
  if (!e.target.closest || !e.target.closest('.ProseMirror')) return;
  e.preventDefault();
  bumpPageScale(e.deltaY < 0 ? 1 : -1);
}, { passive: false, capture: true });
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  // [alpha.147] Ctrl+= / Ctrl+- / Ctrl+Shift+0 ย้ายเข้าตาราง SHORTCUTS แล้ว (คำสั่ง zoom:1 · zoom:-1 · zoom:0
  // ใน icons/commands.csv) — ตั้งใหม่เองได้ และขึ้นบน tooltip/เมนู/หน้าตั้งค่าเอง
  // (เดิมเขียนตายตัวที่นี่ + พิมพ์ "(Ctrl+-)" ลงไฟล์ภาษา) · ตัวดักนี้เหลือแค่ปุ่มบนแป้นตัวเลข
  // ซึ่งตาราง SHORTCUTS ผูกได้ทีละปุ่ม — ไม่งั้นกดแป้นตัวเลขแล้วซูมไม่ได้เหมือนเดิม
  //
  // [alpha.124 ข้อ 2] **ต้องเช็ค Shift ด้วย** — Ctrl+Shift+อะไรก็ตาม (นอกจาก Numpad0) ไม่ใช่งานของตัวซูม
  if (e.code === 'Numpad0' && e.shiftKey) { e.preventDefault(); resetPageScale(); }
  else if (e.shiftKey) return;
  else if (e.code === 'NumpadAdd') { e.preventDefault(); bumpPageScale(1); }
  else if (e.code === 'NumpadSubtract') { e.preventDefault(); bumpPageScale(-1); }
}, true);

// ---------------- คีย์ลัดที่ตั้งเองได้ ----------------
// shortcutId, SHORTCUT_LABELS, accelText → ย้ายไป core.js
// รวมค่าเริ่มต้นกับที่ผู้ใช้ตั้งเอง (settings.shortcuts[id] = {code, ctrl, shift})
function effectiveShortcuts() {
  const ov = (state.settings && state.settings.shortcuts) || {};
  return SHORTCUTS.map((s) => {
    const o = ov[shortcutId(s)];
    return o ? [o.code, o.ctrl, o.shift, ...s.slice(3)] : s;
  });
}

/**
 * [alpha.147] ★ คีย์ลัดของคำสั่ง "ตามที่ใช้งานจริง" (ค่าที่ผู้ใช้ตั้งเองชนะค่าเริ่มต้นใน icons/commands.csv)
 * ผู้ใช้: *"ต้องแยกในส่วนของ shortcut เพราะคุณชอบลืมใส่ใน ui"*
 * **ทุกที่ที่โชว์คีย์ลัดบนจอต้องมาทางนี้** — ห้ามพิมพ์ "(Ctrl+B)" ลงไฟล์ภาษาหรือโค้ดอีก
 * (ในประโยคของไฟล์ภาษาให้เขียน `{sc:<คำสั่ง>}` แทน — i18n.js เติมให้ผ่าน setShortcutResolver)
 * @returns {string} '' = คำสั่งนี้ไม่มีคีย์ลัด
 */
export function commandShortcutText(id) {
  const s = effectiveShortcuts().find((x) => shortcutId(x) === id);
  return s ? formatShortcut(s[0], s[1], s[2]) : '';
}
/** "ข้อความ (คีย์ลัด)" — คำสั่งไม่มีคีย์ลัดคืนข้อความเดิม */
export function withCommandShortcut(text, id) {
  const sc = commandShortcutText(id);
  return sc ? `${text} (${sc})` : text;
}
setShortcutResolver(commandShortcutText);
/**
 * [alpha.147] ทุก element ที่มี `data-command`: ไอคอนจากทะเบียน + tooltip = ข้อความจากไฟล์ภาษา + คีย์ลัดจริง
 * เรียกตอนเริ่ม · หลังเปลี่ยนภาษา · หลังผู้ใช้ตั้งคีย์ลัดใหม่ (เรียกซ้ำได้ ไอคอนไม่ซ้อน)
 * @returns {number} จำนวน element ที่ผูกกับคำสั่ง
 */
export function applyCommandUi(root) {
  const scope = root || document;
  initIcons(scope);
  const els = scope.querySelectorAll('[data-command]');
  for (const b of els) {
    const key = b.getAttribute('data-i18n-title')
             || (b.getAttribute('data-i18n-attr') === 'title' ? b.getAttribute('data-i18n') : '');
    if (key) b.title = withCommandShortcut(t(key), b.getAttribute('data-command'));
  }
  return els.length;
}

/**
 * [alpha.79] คีย์ลัดทั้งตาราง พร้อมชื่อและข้อความปุ่ม — **ทางเดียว** ที่ทั้ง
 * หน้า "ปุ่มลัดทั้งหมด" และแท็บ ตั้งค่า → ปุ่มลัด ใช้ร่วมกัน
 * (เดิมสองที่นั้นมีรายการของตัวเอง จึงไม่ตรงกันและตกหล่นเรื่อยมา)
 * @returns {Array<{id, code, ctrl, shift, alt, ch, args, label, accel, custom}>}
 */
export function allShortcutRows() {
  const ov = (state.settings && state.settings.shortcuts) || {};
  return SHORTCUTS.map((s) => {
    const id = shortcutId(s);
    const o = ov[id];
    const code = o ? o.code : s[0];
    const ctrl = o ? o.ctrl : s[1];
    const shift = o ? o.shift : s[2];
    return {
      id, code, ctrl, shift, alt: needsAlt(ctrl),
      ch: s[3], args: s.slice(4),
      label: tt(SHORTCUT_LABELS[id] || id),
      accel: formatShortcut(code, ctrl, shift),
      custom: !!o,
    };
  });
}

/**
 * [alpha.164 · I1] แถวของหน้าสรุปปุ่มลัด — **หนึ่งคำสั่ง = หนึ่งแถว**
 * คำสั่งที่ตั้งใจมีสองปุ่ม (`A / B` ใน icons/commands.csv) เคยขึ้นสองแถวชื่อเดียวกัน
 * ตอนนี้รวมเป็น "Ctrl+Tab / Ctrl+PageDown" · ลำดับยึดแถวแรกของคำสั่งนั้นในตาราง
 */
export function shortcutSheetRows(rows) {
  const out = new Map();
  for (const r of (rows || allShortcutRows())) {
    const cur = out.get(r.id);
    if (!cur) { out.set(r.id, { ...r, accels: [r.accel] }); continue; }
    if (!cur.accels.includes(r.accel)) cur.accels.push(r.accel);
  }
  return [...out.values()].map((r) => ({ ...r, accel: r.accels.join(' / ') }));
}

/** [alpha.164 · I2] ปุ่มนี้ (ของตัววนชนิด element) ตรงกับคีย์สลับแท็บตัวใดตัวหนึ่งไหม */
function sharesTabKey(b) {
  if (!b || !b.code) return false;
  return effectiveShortcuts().some((s) => (s[3] === 'next-tab' || s[3] === 'prev-tab') &&
    s[0] === b.code && !!s[1] === !!b.ctrl && !!s[2] === !!b.shift && needsAlt(s[1]) === !!b.alt);
}

/** คีย์ลัดที่ชนกัน (ปุ่มเดียวกันเป๊ะ) — คืนแผนที่ accel → รายการ id ที่ชน */
export function shortcutClashes(rows) {
  const m = new Map();
  for (const r of (rows || allShortcutRows())) {
    const k = r.accel;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r.id);
  }
  const bad = {};
  for (const [k, ids] of m) if (ids.length > 1) bad[k] = ids;
  return bad;
}

// ---------------- ระบบลากย้าย + จำตำแหน่งหน้าต่างย่อย (floating panels) ----------------
// อ่าน/เขียน layout ทั้งหมดใน localStorage ก้อนเดียว (persist ข้ามการเปิด-ปิดโปรแกรม)
function uiLayout() { try { return JSON.parse(localStorage.getItem('k2-ui-layout') || '{}'); } catch { return {}; } }
// (ลำดับแผงย้ายไปเก็บใน layout tree ของ PanelStore — k2-panel-layout)
function saveUiLayout(key, val) {
  const l = uiLayout(); l[key] = { ...(l[key] || {}), ...val };
  const str = JSON.stringify(l);
  const prev = localStorage.getItem('k2-ui-layout');
  localStorage.setItem('k2-ui-layout', str);
  // [alpha.154 ข้อ 1] เซฟค่าเดิมซ้ำ (เช่นหนีบตำแหน่งตอนบูต) ไม่นับเป็น "แก้ล่าสุด" — ไม่งั้น localStorage
  // ที่ค้างจากการถูกฆ่ากลางคันจะดูใหม่กว่าไฟล์เซสชัน แล้วเซสชันไม่ถูกกู้
  if (prev === str) return;
  // [alpha.93 ข้อ 2] ★ "แถบรูปแบบบางทีจำตำแหน่ง บางทีไม่จำ"
  //
  // ตำแหน่งถูกเขียนลง localStorage ทันทีที่ปล่อยเมาส์อยู่แล้ว — แต่ **เซสชันไม่รู้เรื่องด้วย**
  // ระบบเซสชันก๊อป `k2-*` ทั้งเนมสเปซลงไฟล์ แล้ว **ยัดกลับทับ localStorage ตอนเปิดโปรเจกต์**
  // ถ้าไฟล์เซสชันยังเป็นภาพก่อนลาก (เขียนซ้ำทุก 45 วิ) การเปิดครั้งถัดไปจะเอาตำแหน่งเก่ามาทับ
  // → ลากแล้วรอสักพักค่อยปิด = จำได้ · ลากแล้วปิดเลย = ไม่จำ ("บางทีจำ บางทีไม่จำ" พอดี)
  //
  // แก้: ทุกครั้งที่เลย์เอาต์เปลี่ยน บอกเซสชันด้วย + ปั๊มเวลาไว้ให้ฝั่งกู้คืนเทียบได้
  try { localStorage.setItem(LS_TS_KEY, String(Date.now())); } catch {}
  markSessionDirty();
}
/** เวลาที่ค่าจำเล็ก ๆ ของ UI ถูกแก้ล่าสุด — ใช้กันไฟล์เซสชันเก่ามาทับของใหม่ */
const LS_TS_KEY = 'k2-ls-ts';
// ทำให้ element ลากย้ายได้ด้วย handle + คืนค่าตำแหน่งที่เคยบันทึกไว้
// opts: { key, defaultPos:{left,top}, resizable, onEnd }
function makeDraggable(elm, handle, opts = {}) {
  const { key, defaultPos } = opts;
  // [alpha.118] `defaultPos` รับฟังก์ชันได้แล้ว — เรียกสด ๆ ทุกครั้งที่ต้องใช้จริง (ตอนติดตั้ง
  // และตอน .reset()) แทนที่จะพึ่งค่าที่คำนวณครั้งเดียวตอนเริ่มสคริปต์ ซึ่งเลย์เอาต์อาจยังไม่นิ่ง
  // (ต้นตอของบั๊กที่แถบรูปแบบลอย "รีเซ็ต" แล้วได้ตำแหน่งมุมจอ — ดู setupFloatingFormatBar)
  // ตัวเรียกเดิมที่ส่งอ็อบเจกต์ตรง ๆ (FAB · หน้าต่างลอย) ไม่ได้รับผลกระทบเลย
  const resolveDefaultPos = () => (typeof defaultPos === 'function' ? defaultPos() : defaultPos);
  const saved = key ? uiLayout()[key] : null;
  const pos = saved || resolveDefaultPos();
  if (pos) {
    elm.style.left = pos.left + 'px'; elm.style.top = pos.top + 'px';
    elm.style.right = 'auto'; elm.style.bottom = 'auto';
    if (opts.resizable && pos.width) { elm.style.width = pos.width + 'px'; elm.style.height = pos.height + 'px'; }
  }
  if (saved && saved.hidden) elm.style.display = 'none';
  let sx, sy, ox, oy, dragging = false, lastE = null, offEsc = () => {};
  const down = (e) => {
    if (e.button !== 0 || !elm) return;
    // [alpha.117] ล็อกแล้วต้องลากไม่ได้จริง — กันที่ต้นทาง ไม่ใช่ไปคืนตำแหน่งทีหลัง
    if (opts.locked && opts.locked()) return;
    dragging = true; sx = e.clientX; sy = e.clientY;
    const r = elm.getBoundingClientRect();
    const op = elm.offsetParent;
    const host = op ? op.getBoundingClientRect() : { left: 0, top: 0 };
    ox = r.left - host.left; oy = r.top - host.top;
    elm.classList.add('k-dragging');
    // [alpha.165] Esc ระหว่างลาก = คืนตำแหน่งเดิม (ไม่จดลงเลย์เอาต์)
    const st0 = { left: elm.style.left, top: elm.style.top, right: elm.style.right, bottom: elm.style.bottom };
    offEsc = escCancelDrag(() => {
      dragging = false; elm.classList.remove('k-dragging');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      Object.assign(elm.style, st0);
    });
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  };
  const move = (e) => {
    if (!dragging) return;
    lastE = e;
    const op = elm.offsetParent;
    const host = op ? op.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
    nx = Math.max(0, Math.min(nx, host.width - 40));       // กันหลุดขอบ
    ny = Math.max(0, Math.min(ny, host.height - 24));
    // snap แม่เหล็ก: ชิดขอบจอ + ชิดขอบแผงลอยอื่น (แบบ Photoshop)
    if (opts.snap) {
      const SNAP = 9;
      const r = elm.getBoundingClientRect();
      const targets = [...document.querySelectorAll('.k-float-panel, .float-win')]
        .filter((p) => p !== elm).map((p) => p.getBoundingClientRect());
      targets.push({ left: 0, top: 0, right: innerWidth, bottom: innerHeight });   // ขอบจอ
      for (const t of targets) {
        if (Math.abs(nx - t.left) < SNAP) nx = t.left;
        if (Math.abs(nx + r.width - t.right) < SNAP) nx = t.right - r.width;
        if (Math.abs(nx - t.right) < SNAP) nx = t.right;                 // ชิดต่อด้านขวาแผงอื่น
        if (Math.abs(ny - t.top) < SNAP) ny = t.top;
        if (Math.abs(ny + r.height - t.bottom) < SNAP) ny = t.bottom - r.height;
        if (Math.abs(ny - t.bottom) < SNAP) ny = t.bottom;              // วางต่อใต้แผงอื่น (stack)
      }
    }
    elm.style.left = nx + 'px'; elm.style.top = ny + 'px';
    elm.style.right = 'auto'; elm.style.bottom = 'auto';
    opts.onMove && opts.onMove(e);
  };
  const up = () => {
    offEsc();
    dragging = false; elm.classList.remove('k-dragging');
    try { dodgeHiddenChips(); } catch {}          // แถบลอยย้ายไปทับชิปแผงที่ซ่อน → ยกชิปหลบ
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    if (key) saveUiLayout(key, { left: parseInt(elm.style.left, 10) || 0,
                                 top: parseInt(elm.style.top, 10) || 0 });
    opts.onEnd && opts.onEnd(lastE);
  };
  handle.addEventListener('mousedown', down);
  return {
    reset() { if (key) { const l = uiLayout(); delete l[key]; localStorage.setItem('k2-ui-layout', JSON.stringify(l)); }
              const dp = resolveDefaultPos();
              if (dp) { elm.style.left = dp.left + 'px'; elm.style.top = dp.top + 'px'; } },
  };
}

// ---- แสดงคีย์ลัดใน title ของปุ่มในแถบเครื่องมือ (i18n-aware) ----
// [alpha.147] ตาราง TB_SC_MAP (ปุ่ม → คำสั่ง) ถูกถอด — ปุ่มบอกคำสั่งของตัวเองด้วย `data-command`
// ใน index.html แล้ว (ตัวเดียวกับที่ icons/commands.csv ใช้) · เดิมมีแค่ 19 ปุ่มจาก 78 ที่โชว์คีย์ลัด
/**
 * [alpha.124 ข้อ 36] สร้างรายการ "สลับรูปตัวพิมพ์" บนแถบเครื่องมือจากตารางจริง
 * เรียกซ้ำได้ (ตอนเปลี่ยนภาษา) — เก็บตัวเลือกหัว "Aa ▾" ไว้เสมอ
 */
export function caseMenuItems(onPick) {
  return CASE_MODES.map((m) => ({
    text: (tt(CASE_LABELS[m]) || CASE_SHORT[m]), click: () => onPick(m),
  }));
}

/**
 * [alpha.150 ข้อ 1] เดิมตัวนี้เติม `<option>` ให้ `<select id="tb-case">` — ปุ่มเป็นไอคอนแล้ว
 * จึงเหลือหน้าที่เดียว: บอกจำนวนรายการที่เมนูจะมี (ใช้โดยเทส) · รายการจริงสร้างตอนกดจาก
 * `caseMenuItems()` ซึ่งอ่าน CASE_MODES/CASE_LABELS ชุดเดียวกับเมนู "รูปแบบ" เหมือนเดิม
 */
export function applyCaseOptions() {
  return CASE_MODES.length;
}

export function applyToolbarShortcutTitles() {
  // [alpha.147] ทุกปุ่มที่มี data-command (78 ปุ่ม — รวม save-all-btn/search-all-btn ที่ [alpha.124 ข้อ 4]
  // เคยต้องเขียนแยก) ได้ไอคอน + tooltip + คีย์ลัดจริงจากทางเดียวกัน
  applyCommandUi();
  const hb = $('#home-btn');
  if (hb) hb.title = t('app.home');
  // apply i18n to style select options
  $('#tb-style')?.querySelectorAll('option').forEach((o) => {
    const k = o.getAttribute('data-i18n');
    if (k) o.textContent = t(k);
  });
  // FAB — [alpha.111] ปุ่มลูกสร้างตอนรัน จึงต้อง "วาดใหม่" ไม่ใช่ไล่เปลี่ยนข้อความ
  const fab = $('#k-fab');
  if (fab) fab.title = t('panel.fab');
  if ($('#k-fab-menu')) renderFabMenu();
  // ปุ่มของแถบรูปแบบลอยที่สร้างตอนรัน (ไม่มี data-i18n ใน index.html)
  const fh = $('#tb-fmt-here');
  if (fh) fh.title = t('ui.fmtcfg.hereBtn');
  // [alpha.117] จาง/ชิดขอบ/ล็อก — ป้ายและไอคอนอ่านจากสภาพจริงทุกครั้ง
  try { applyFmtbarState(); } catch {}
}

// ---------------- toolbar wiring ----------------
export function tb(id, cmd, arg) { $(id).onclick = () => {
  getActiveEditor()?.cmd(cmd, arg);
  refreshToolbar(); if (state.active) markDirty(state.active); }; }

// สร้างแถบรูปแบบอักษรแบบลอยในพื้นที่หน้ากระดาษ — ย้ายปุ่มจัดรูปแบบเดิมเข้าไป (id คงเดิม
// จึงใช้ร่วมกับ tb()/refreshToolbar ได้ทันที) ลากด้วยหูจับซ้าย + จำตำแหน่งลง localStorage
// ══ [alpha.116 ข้อ 5] ★ ของลอยต้องยังอยู่ในจอหลัง "ย่อ/ขยาย" หน้าต่าง ══
//
// เรียกทุกครั้งที่หน้าต่างเปลี่ยนขนาด (รวมย่อ/ขยาย/คืนขนาด) — หนีบเข้ากรอบแล้ว
// **บันทึกทับค่าที่จำไว้** ไม่งั้นรอบหน้าเปิดโปรแกรมมาก็ยังชี้ไปนอกจอเหมือนเดิม
let _fmtHostH = 0;          // [alpha.164 ข้อ E4] ความสูงของ #content รอบก่อน (ใช้ตัดสินว่าแถบชิดล่างไหม)
export function keepFloatingUiInView() {
  let moved = 0;
  try { dodgeHiddenChips(); } catch {}
  // แถบรูปแบบลอย — ลอยอยู่ใน #content
  const host = $('#content');
  if (floatBar && host && floatBar.style.display !== 'none') {
    const r = floatBar.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    if (r.width && hr.width) {
      const cur = { left: parseInt(floatBar.style.left, 10) || 0,
                    top: parseInt(floatBar.style.top, 10) || 0 };
      // [alpha.164 ข้อ E4] ★ แถบที่ "ชิดขอบล่าง" ต้องตามขอบล่างไปเมื่อพื้นที่สูงขึ้น/เตี้ยลง
      // ตำแหน่งตั้งต้นถูกคำนวณตอนเลย์เอาต์ยังไม่นิ่ง (#content ยังเตี้ย) → พื้นที่ขยายทีหลัง
      // แถบเลยค้างอยู่กลางตัวแก้ไข ทับเนื้อหา (เห็นบนจอ 1440p ตั้งแต่เปิดโปรแกรมครั้งแรก)
      // กติกา: ก่อนเปลี่ยนขนาด ขอบล่างของแถบห่างขอบล่างพื้นที่ ≤ 48px = ถือว่าชิดล่าง → รักษาระยะนั้นไว้
      floatBar.classList.toggle('k-fmtbar-narrow', hr.width < 620);   // [alpha.164 ข้อ F2]
      const prevH = _fmtHostH; _fmtHostH = hr.height;
      if (prevH && Math.abs(prevH - hr.height) > 1 && fmtbarState().align !== 'top') {
        const gap = prevH - (cur.top + r.height);
        if (gap >= -4 && gap <= 48) {
          const top = Math.round(hr.height - r.height - Math.max(0, gap));
          if (top !== cur.top) {
            cur.top = top;
            floatBar.style.top = top + 'px'; floatBar.style.bottom = 'auto';
            saveUiLayout('fmtbar', { top });
            moved++;
          }
        }
      }
      // [alpha.119] หนีบเข้า **ส่วนที่มองเห็นได้จริง** ของ `#content` ไม่ใช่ทั้งก้อน —
      // ตอนออกจากเต็มจอ/โหมดโฟกัส host อาจสูงเลยขอบล่างหน้าต่างไปชั่วขณะ
      // [alpha.151 ข้อ 5] แถบใหญ่กว่าที่ว่างใน #content เมื่อไหร่ (แผงกระดานเปิดอยู่)
      // ให้หนีบกับหน้าต่างแทน ไม่งั้นครึ่งขวาของแถบยื่นออกนอกจอจนกดปุ่มท้ายแถบไม่ได้
      const c = clampBarInBox(cur, { width: r.width, height: r.height },
                              barClampBox(hr, { width: r.width, height: r.height },
                                          { width: window.innerWidth,
                                            height: window.innerHeight }));
      if (c.moved) {
        floatBar.style.left = c.left + 'px'; floatBar.style.top = c.top + 'px';
        floatBar.style.right = 'auto'; floatBar.style.bottom = 'auto';
        saveUiLayout('fmtbar', { left: c.left, top: c.top });
        moved++;
      }
    }
  }
  // ปุ่มลอย (FAB) — ลอยอยู่กับหน้าต่างทั้งใบ
  const fab = $('#k-fab');
  if (fab && uiLayout().fab) {
    const r = fab.getBoundingClientRect();
    if (r.width) {
      const c = clampBarPos({ left: Math.round(r.left), top: Math.round(r.top) },
                            { width: r.width, height: r.height },
                            { width: window.innerWidth, height: window.innerHeight });
      if (c.moved) { setFabPos(c); saveUiLayout('fab', c); moved++; }
    }
  }
  // หน้าต่างลอยของแท็บ — หนีบเข้าจอแล้วจำทั้งตำแหน่งและขนาด
  for (const [file, tb] of state.tabs) {
    const w = tb.floatWin;
    if (!w) continue;
    const r = w.getBoundingClientRect();
    if (!r.width) continue;
    const c = clampBarPos({ left: parseInt(w.style.left, 10) || Math.round(r.left),
                            top: parseInt(w.style.top, 10) || Math.round(r.top) },
                          { width: r.width, height: r.height },
                          { width: window.innerWidth, height: window.innerHeight });
    if (c.moved) { w.style.left = c.left + 'px'; w.style.top = c.top + 'px'; moved++; }
    saveFloatWinBox(file, w);
  }
  return moved;
}

// ══ [alpha.119] ★ ต้นตอจริงของ "แถบลอยล้นจอหลังออกจากเต็มจอ" ══
//
// ผู้ใช้: *"float bar เมื่อกด fullscreen แล้วย้ายตำแหน่ง หรือ reset ตำแหน่ง พอออกจาก fullscreen
//         ทำให้ float bar ล้นจอ"*
//
// ตัวหนีบ (`keepFloatingUiInView`) มีมาตั้งแต่ alpha.116 และทำงานถูกต้องทุกอย่าง — **แต่ไม่มีใครเรียกมัน**
// ในจังหวะนี้ เพราะคนเรียกคนเดียวคือ `window.addEventListener('resize')` ซึ่งยิงเฉพาะตอน
// **หน้าต่างทั้งใบ** เปลี่ยนขนาด · ส่วนสิ่งที่ทำให้ `#content` สูงขึ้น/เตี้ยลงจริง ๆ มีอีกหลายทางที่
// ไม่แตะขนาดหน้าต่างเลยสักนิด:
//   · โหมดโฟกัส/เต็มจอในโปรแกรม (`toggleFocus`) — แค่สลับคลาสบน `<body>` แล้วแผงข้างหาย
//   · เปิด/ปิด/ลากขอบแผง · แยกจอ · โหมดอ่าน · แถบเครื่องมือขึ้นบรรทัดที่สอง
// และแม้แต่เต็มจอของ OS เอง (macOS) ก็ยังเป็นการเปลี่ยนขนาดแบบ **มีอนิเมชัน** — `resize` ยิงครั้งเดียว
// ตอนต้นทาง ขนาดสุดท้ายมาถึงทีหลังโดยไม่มีอีเวนต์ตามมาอีก
//
// → ผู้ใช้ย้ายแถบไปขอบล่างตอนพื้นที่สูง 900px แล้วออกจากเต็มจอเหลือ 600px: ค่าที่จำไว้ยังเป็น 860
//   ไม่มีใครมาตรวจ แถบจึงจมอยู่ใต้ขอบล่าง (และค่าที่ผิดถูกบันทึกค้างไว้ด้วย = เปิดใหม่ก็ยังหาย)
//
// ★ ท่าที่ใช้: **ResizeObserver บน `#content` เอง** — เลิกเดาว่า "อะไรบ้างที่ทำให้พื้นที่เปลี่ยน"
// แล้วไปเฝ้าที่ผลลัพธ์ตรง ๆ แทน · กรอบเปลี่ยนด้วยเหตุใดก็ตาม (หน้าต่าง · โฟกัส · แผง · อนิเมชัน
// ทีละเฟรมของ macOS) คอลแบ็กก็ยิงหลัง layout ของเฟรมนั้นเสมอ — ครบทุกทางในที่เดียว
// รวบเป็นเฟรมเดียวด้วย rAF เพราะระหว่างอนิเมชันมันยิงรัว (บทเรียนข้อ 25)
let _floatKeepRO = null, _floatKeepJob = 0;
export function watchFloatHostSize() {
  const host = $('#content');
  if (_floatKeepRO || !host || typeof ResizeObserver === 'undefined') return false;
  _floatKeepRO = new ResizeObserver(() => {
    if (_floatKeepJob) return;                       // ยิงรัวระหว่างอนิเมชัน → รวบเป็นเฟรมเดียว
    _floatKeepJob = requestAnimationFrame(() => {
      _floatKeepJob = 0;
      try { keepFloatingUiInView(); } catch {}
    });
  });
  _floatKeepRO.observe(host);
  return true;
}

/** จำกล่องของหน้าต่างลอย (ตำแหน่ง+ขนาด+สถานะย่อ) — เดิมจำแค่ตำแหน่งตอนปล่อยเมาส์ */
function saveFloatWinBox(file, win) {
  if (!file || !win) return;
  saveUiLayout('floatwin:' + file, {
    left: parseInt(win.style.left, 10) || 0,
    top: parseInt(win.style.top, 10) || 0,
    width: Math.round(win.getBoundingClientRect().width),
    height: parseInt(win.style.height, 10) || Math.round(win.getBoundingClientRect().height),
    min: win.classList.contains('min'),
  });
}

// ══ [alpha.116 ข้อ 8] เมนูแทรกโค้ดสั้น ══
//
// ทะเบียนโค้ดอยู่ที่ `src/shortcode.js` ที่เดียว — เมนูนี้อ่านจากที่นั่นล้วน ๆ
// เพิ่มโค้ดใหม่หนึ่งแถวในทะเบียน แล้วมันโผล่ในเมนูนี้เอง ไม่ต้องแก้ที่นี่อีก
export function insertShortcodeMenu(ev) {
  const ed = getActiveEditor();
  if (!ed || !ed.view) { setStatus(tt('ui.shortcode.needEditor')); return 0; }
  const items = [];
  for (const g of SHORTCODE_GROUPS) {
    const rows = SHORTCODES.filter((sc) => sc.group === g.key);
    if (!rows.length) continue;
    if (items.length) items.push('-');
    for (const sc of rows) {
      // โค้ดที่ต้องมีเป้าหมาย (`[wiki:ชื่อ]`) แทรกโครงให้ก่อน แล้วผู้ใช้พิมพ์ชื่อต่อได้เลย
      const text = sc.group === 'wiki' ? '[' + sc.name + ':]' : '[' + sc.name + ']';
      items.push({ text: text + '  ·  ' + shortcodeLabel(sc.name),
                   click: () => insertShortcodeText(text) });
    }
  }
  const x = ev && Number.isFinite(ev.clientX) ? ev.clientX : Math.round(window.innerWidth / 2);
  const y = ev && Number.isFinite(ev.clientY) ? ev.clientY : Math.round(window.innerHeight / 3);
  popupMenu(x, y, items);
  return items.length;
}

/** แทรกข้อความโค้ดสั้นตรงเคอร์เซอร์ · แบบที่ต้องพิมพ์ต่อ (`[wiki:]`) วางเคอร์เซอร์ไว้ก่อน `]` */
export function insertShortcodeText(text) {
  const ed = getActiveEditor();
  if (!ed || !ed.view) return false;
  const v = ed.view;
  const txt = String(text || '');
  const from = v.state.selection.from;
  let tr = v.state.tr.insertText(txt);
  if (txt.endsWith(':]')) {
    try { tr = tr.setSelection(PMTextSelection.create(tr.doc, from + txt.length - 1)); } catch {}
  }
  v.dispatch(tr.scrollIntoView());
  markDirty(state.active);
  ed.focus();
  return true;
}

// ══ [alpha.121] โค้ดสั้นแบบ "สด" — ใช้นอกเวิร์กโฟลว์ส่งออก (แชท AI · คอมเมนต์ · ฟิลด์ Wiki) ══
//
// ผู้ใช้: *"ทำ shortcode ให้เยอะและละเอียดที่สุด ครอบคลุมทุกหัวข้อ ทั้ง wiki ทั้ง entities
//         ทั้ง ai chat ทั้ง comment"*
//
// `insertShortcodeMenu()`/`insertShortcodeText()` ข้างบนแทรก **placeholder ดิบ** (`[title]`)
// ลงในเอกสารนิยาย/บทหนัง — ถูกต้องแล้วเพราะเอกสารพวกนั้นผ่านขั้นตอนคอมไพล์/ส่งออกที่ค่อยขยาย
// โค้ดเป็นค่าจริงทีหลัง (เทมเพลตเดียวใช้ซ้ำได้หลายเล่ม) แต่แชท AI/คอมเมนต์/ฟิลด์ Wiki **ไม่มี**
// ขั้นตอนคอมไพล์แบบนั้น — ใส่ placeholder ค้างไว้จะกลายเป็นข้อความ `[title]` เปล่า ๆ ตลอดไป
// ทางนี้จึงแทน **ค่าจริงทันทีที่คลิก** โดยอ่านบริบทของสิ่งที่ผู้ใช้กำลังดูอยู่ตอนนี้:
//   - กำลังแก้เอนทิตี้ Wiki อยู่ → entityContext()
//   - กำลังแก้ฉาก/บทอยู่ → sceneContext() (ผ่าน sceneCtx() ที่มีอยู่แล้ว)
//   - ไม่มีบริบทเฉพาะ → ยังมีชื่อเรื่อง/ผู้เขียน/สถิติรวมให้ใช้เสมอ
export async function liveShortcodeContext() {
  const model = {
    title: state.title || '', author: (state.meta && state.meta.author) || '',
    language: state.settings.language || DEFAULT_SETTINGS.language || '',
    appVersion: APP_VERSION,
  };
  const now = new Date();
  if (!state.root) return sceneContext({ model, now });
  let stats = {}, vars = {};
  try {
    [stats, vars] = await Promise.all([
      computeProjectStats(),
      import('./template-vars.js').then((m) => m.buildVarContext(state.root, kapi)),
    ]);
  } catch (e) { log('warn', tt('ui.shortcode.liveCtxFail'), e); }

  const t = state.active;
  // กำลังแก้เอนทิตี้ Wiki อยู่ — หมวดอ่านจากทางไฟล์ (Wiki/<หมวด>/<ไฟล์>.json) ไม่ต้องอ่านดิสก์เพิ่ม
  if (t && t.wiki && t.wiki.e) {
    const m = /[\\/](?:Wiki|Bible)[\\/]([^\\/]+)[\\/][^\\/]+\.json$/.exec(t.file || '');
    const cat = m ? m[1] : '';
    return entityContext({ model, entity: t.wiki.e, cat, catLabel: cat ? catLabel(cat) : '', vars, stats, now });
  }
  // กำลังแก้ฉาก/บทอยู่
  const c = await sceneCtx();
  if (c) {
    let book = '';
    try {
      const secPath = String(c.dPath || '').replace(/[\\/]Draft[\\/][^\\/]+[\\/]?$/, '');
      const sf = await kapi.join(secPath, 'section.json');
      if (await kapi.exists(sf)) book = (await kapi.readJson(sf)).title || '';
    } catch {}
    return sceneContext({ model: { ...model, book }, chapter: c.ch, scene: c.row,
                          chapterNo: c.chapterNo, sceneNo: c.sceneNo, vars, now, stats });
  }
  return sceneContext({ model, vars, now, stats });
}

/** แทรกข้อความตรงเคอร์เซอร์ของ `<input>`/`<textarea>` ธรรมดา (ไม่ใช่ ProseMirror) */
export function insertTextAtField(el0, text) {
  if (!el0 || typeof el0.selectionStart !== 'number') return false;
  const v = String(text ?? '');
  const s = el0.selectionStart, e = el0.selectionEnd ?? s;
  el0.value = el0.value.slice(0, s) + v + el0.value.slice(e);
  const pos = s + v.length;
  try { el0.setSelectionRange(pos, pos); } catch {}
  // ทุกที่ที่ใช้ช่องนี้ (autosave ของแผงคุณสมบัติ · ตัวนับตัวอักษรของแชท ฯลฯ) ฟัง 'input' อยู่แล้ว
  el0.dispatchEvent(new Event('input', { bubbles: true }));
  el0.focus();
  return true;
}

/**
 * เมนูแทรกโค้ดสั้นแบบ "ค่าจริงทันที" — ให้กล่องข้อความธรรมดาที่ไม่มีขั้นตอนคอมไพล์
 * (ช่องแชท AI · กล่องคอมเมนต์ · ฟิลด์ Wiki) คนละแบบกับ `insertShortcodeMenu()` ที่แทรก placeholder
 * โค้ดที่ต้องมีเป้าหมาย (`needsArg`) จะถามชื่อ/บทบาทก่อน ไม่ใช่แทรกค่าว่างเงียบ ๆ
 */
export async function openResolvedShortcodeMenu(ev, targetEl) {
  if (!targetEl) { setStatus(tt('ui.shortcode.needField')); return 0; }
  const ctx = await liveShortcodeContext();
  const items = [];
  for (const g of SHORTCODE_GROUPS) {
    const rows = SHORTCODES.filter((sc) => sc.group === g.key);
    if (!rows.length) continue;
    if (items.length) items.push('-');
    for (const sc of rows) {
      if (sc.needsArg) {
        items.push({ text: '[' + sc.name + ':…]  ·  ' + shortcodeLabel(sc.name),
          click: async () => {
            const arg = await ask(shortcodeLabel(sc.name));
            if (!arg) return;
            let v = ''; try { v = sc.get(ctx, { arg, opts: {} }); } catch { v = ''; }
            insertTextAtField(targetEl, v);
          } });
        continue;
      }
      let v = ''; try { v = sc.get(ctx, { arg: '', opts: {} }); } catch { v = ''; }
      const preview = String(v || '').trim() ? '  →  ' + String(v).slice(0, 24) : '';
      items.push({ text: shortcodeLabel(sc.name) + preview, click: () => insertTextAtField(targetEl, v) });
    }
  }
  const x = ev && Number.isFinite(ev.clientX) ? ev.clientX : Math.round(window.innerWidth / 2);
  const y = ev && Number.isFinite(ev.clientY) ? ev.clientY : Math.round(window.innerHeight / 3);
  popupMenu(x, y, items);
  return items.length;
}

// ── ช่องแบบธรรมดา (input/textarea) ที่มีโฟกัสอยู่ล่าสุดในแผง Wiki ──
// แผง Wiki มีฟิลด์เป็นสิบ ๆ ช่องต่อเอนทิตี้ — ปุ่มเดียวบนหัวแผงต้องรู้ว่าจะแทรกลงช่องไหน
let lastWikiField = null;
document.addEventListener('focusin', (e) => {
  const el0 = e.target;
  if (el0 && el0.closest && el0.closest('.wiki-pane') &&
      (el0.tagName === 'INPUT' || el0.tagName === 'TEXTAREA') && !el0.readOnly) {
    lastWikiField = el0;
  }
});
/** เป้าหมายที่ปุ่ม "แทรกโค้ดสั้น" ของแผง Wiki ควรแทรกลง — เรียงลำดับ:
 * ช่องที่โฟกัสอยู่ตอนนี้ (ถ้าอยู่ในแผงเดียวกัน) → ช่องที่โฟกัสล่าสุด → ช่องแรกในแผง */
export function resolveWikiInsertTarget(pane) {
  const act = document.activeElement;
  if (act && pane && pane.contains(act) && typeof act.selectionStart === 'number') return act;
  if (lastWikiField && pane && pane.contains(lastWikiField) && document.body.contains(lastWikiField)) return lastWikiField;
  return pane ? pane.querySelector('.wiki-input, textarea.wiki-input') : null;
}

let floatBar = null;
function setupFloatingFormatBar() {
  if (floatBar) return;
  const bar = el('div', 'k-fmtbar');
  const handle = el('div', 'k-fmtbar-grip');
  handle.innerHTML = '<span></span><span></span>';
  bar.append(handle);
  // [alpha.111] ปุ่ม "เรียกแถบมาหาเคอร์เซอร์" — ของแถบเอง (ไม่อยู่ในรายการปุ่มที่ตั้งค่าได้)
  // จึงสร้างที่นี่ ไม่ใช่ใน index.html · id ไม่ขึ้นต้น `tb-` ที่ตั้งค่าได้ = ไม่มีวันถูกซ่อนหาย
  const here = el('button', 'tb k-fmtbar-here');
  here.id = 'tb-fmt-here';
  here.innerHTML = iconHtml('crosshair', 15);
  here.title = tt('ui.fmtcfg.hereBtn');
  here.onclick = () => fmtBarToPointer();
  bar.append(here);
  // ══ [alpha.118] ★ จาง · ชิดขอบ · ล็อก ย้ายจากปุ่มไปเป็นเมนูคลิกขวาบนหูจับ ══
  //
  // ผู้ใช้ (หลังลองใช้ alpha.117): *"ให้ใช้เป็นแบบ click ขวาดีกว่าแบบปุ่ม เพราะตอนนี้ปุ่มเยอะไป"*
  // เดิมสามปุ่มนี้ต้องอยู่ถาวรบนแถบ (ปุ่มปลดล็อกหายไม่ได้ ไม่งั้นล็อกแล้วแก้จากแถบเองไม่ได้)
  // ตอนนี้ย้ายทั้งสามเข้าเมนูเดียว เปิดจากหูจับ — หูจับเป็นจุดเดียวที่ไม่มีวันถูกซ่อน (ไม่ใช่ปุ่ม
  // ที่ตั้งค่าได้) จึงยังคงกฎเดิมไว้ครบ แค่ไม่ใช่ปุ่มลอยกินที่บนแถบอีกต่อไป
  handle.oncontextmenu = (e) => {
    e.preventDefault(); e.stopPropagation();     // กันไม่ให้ไปเข้าเมนู "ปรับปุ่มแถบ" ของทั้งบาร์
    fmtbarSettingsMenu(e);
  };
  // ══ [alpha.150 ข้อ 1] ★ ลำดับปุ่มมาจาก `fmtbarSequence()` ที่เดียว ══
  //
  // ผู้ใช้สั่งลำดับหมวดมาเองครบทั้งสิบหมวด — ของเดิมรายการนี้เขียนมือคู่ขนานกับ `FMTBAR_IDS`
  // แล้วต้องมีเทสคอยกวาดว่าสองที่ยังตรงกันไหม · ตอนนี้ทั้งลำดับปุ่ม ทั้งเส้นคั่นระหว่างหมวด
  // และทั้งหมวดในหน้าตั้งค่า ออกจาก `FMTBAR_GROUPS` ก้อนเดียว (toolbar-config.js)
  for (const id of fmtbarSequence()) {
    if (id === 'sep') { bar.append(el('span', 'sep')); continue; }
    const e0 = $('#' + id);
    if (e0) bar.append(e0);
  }
  $('#toolbar').querySelectorAll('.sep').forEach((s) => s.remove());
  $('#content').append(bar);
  floatBar = bar;
  // ══ [alpha.118] ★ ตำแหน่งเริ่มต้น — กึ่งกลางแนวนอน ชิดขอบล่าง ══
  //
  // ผู้ใช้: *"ตำแหน่ง default ควรอยู่ขอบล่าง ตรงกลางของ editor ตอนนี้มันอยู่ตำแหน่งบน เยื้องไปซ้าย"*
  // วัดขนาดจริงของแถบกับพื้นที่เขียนจริง แล้วคำนวณให้ — ไม่ใช่ค่าตายตัว {24,12} แบบเดิมที่ไม่เคยรู้
  // ขนาดแถบเลย · มีผลเฉพาะตอนยังไม่มีตำแหน่งจำไว้ หรือกด "รีเซ็ต"
  //
  // ★ ต้องเป็น**ฟังก์ชัน** ไม่ใช่ค่าที่คำนวณครั้งเดียวตรงนี้ — จุดนี้รันตอน DOMContentLoaded ซึ่ง
  // ในโหมดเทส (เปิดโปรเจกต์อัตโนมัติ) เลย์เอาต์ของ `#content` อาจยังไม่นิ่ง วัดได้ค่าเพี้ยน
  // (บั๊กที่ e2e จับได้จริง: กด "รีเซ็ต" แล้วได้ตำแหน่ง {16,16} คือค่า pad ล้วน ๆ ไม่ใช่กึ่งกลางขอบล่าง
  // เพราะตอนวัดครั้งแรก `bar` กว้างกว่า `#content` ที่ยังไม่ได้ขนาดจริง) — ฟังก์ชันนี้ถูกเรียกใหม่
  // ทุกครั้งที่ต้องใช้จริง (mount ครั้งแรก + ทุกครั้งที่กด "รีเซ็ต") จึงได้ขนาดปัจจุบันเสมอ ไม่ใช่ค่าค้าง
  const defPos = () => {
    const hostR = $('#content').getBoundingClientRect();
    const barR = bar.getBoundingClientRect();
    return defaultBarPos({ width: barR.width, height: barR.height },
                         { width: hostR.width, height: hostR.height });
  };
  // จำไว้ว่า "ตอนติดตั้งยังไม่เคยมีตำแหน่งจำจริง ๆ" — ใช้ตัดสินว่าต้องคำนวณซ้ำตอนเลย์เอาต์นิ่งแล้วไหม
  const hadSavedPos = Number.isFinite((uiLayout().fmtbar || {}).left);
  const drag = makeDraggable(bar, handle, { key: 'fmtbar', defaultPos: defPos,
                                            locked: () => fmtbarState().locked });
  fmtBarDrag = drag;
  // [alpha.117] ดับเบิลคลิกหูจับ = **รีเซ็ตทั้งชุด** ไม่ใช่แค่ตำแหน่ง —
  // ทางออกเดียวที่จำง่ายเวลาแถบจางจนแทบมองไม่เห็นหรือถูกล็อกค้างไว้
  handle.addEventListener('dblclick', () => resetFmtbarAll());
  // [alpha.164 ข้อ F2] โหมดแถวเดียว (พื้นที่แคบ): ล้อเมาส์แนวตั้ง = เลื่อนแถบแนวนอน
  bar.addEventListener('wheel', (e) => {
    if (!bar.classList.contains('k-fmtbar-narrow') || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    bar.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive: false });
  applyFmtbarState();
  applyFmtbarConfig();
  syncFloatBarVisible();
  // [alpha.116 ข้อ 5] ตำแหน่งที่จำไว้อาจมาจากตอนหน้าต่างใหญ่กว่านี้ — หนีบตั้งแต่เปิดโปรแกรม
  // (ไม่งั้นต้องรอให้ผู้ใช้ย่อ/ขยายหน้าต่างสักครั้งก่อน แถบถึงจะกลับเข้าจอ)
  // [alpha.119] เฝ้าขนาดของ `#content` ตรง ๆ — ครอบคลุมทุกทางที่พื้นที่เปลี่ยนโดยหน้าต่างไม่ขยับ
  // (โหมดโฟกัส/เต็มจอ · เปิด-ปิด-ลากแผง · แยกจอ) ซึ่ง `window.resize` มองไม่เห็นเลย
  try { watchFloatHostSize(); } catch {}
  setTimeout(() => {
    try { keepFloatingUiInView(); } catch {}
    // [alpha.118] ติดตั้งครั้งแรกจริง ๆ (ยังไม่เคยมีตำแหน่งจำไว้เลย) — ค่าที่ได้ตอน mount
    // อาจเจอเลย์เอาต์ที่ยังไม่นิ่ง ลองคำนวณตำแหน่งเริ่มต้นซ้ำอีกทีตอนที่ทุกอย่างนิ่งแล้วแน่ ๆ
    if (!hadSavedPos) drag.reset();
  }, 400);
}

// ══════════ [alpha.117 → 118] จาง · ชิดขอบ · ล็อก ══════════
//
// alpha.117: *"floating bar เราไม่อยากให้ย่อ · เอา opacity 3 ระดับ 5% 50% 100% ดีกว่า
//            คือไม่หายหมด และ reset เป็น 100% ได้ · เพิ่ม align ขอบบน/ล่าง · เพิ่ม lock พร้อม shortcut"*
// alpha.118: *"ให้ใช้เป็นแบบ click ขวาดีกว่าแบบปุ่ม เพราะตอนนี้ปุ่มเยอะไป"*
// → สามปุ่มที่เคยลอยอยู่บนแถบย้ายเข้าเมนูคลิกขวาที่หูจับตัวเดียว (ดู `fmtbarSettingsMenu` ท้ายบล็อกนี้)
//
// สภาพทั้งสามเก็บรวมกับตำแหน่งใน `k2-ui-layout.fmtbar` (ก้อนเดียวกับ left/top)
// การตีความค่าที่อ่านมาอยู่ใน `toolbar/fmtbar-pos.js` ทั้งหมด — ที่นี่แค่ทาลงจอแล้วบันทึก

/** สภาพปัจจุบันของแถบ (ผ่านตัวทำให้เป็นมาตรฐานเสมอ — ไฟล์เก่าไม่มีสามช่องนี้ก็ไม่พัง) */
export function fmtbarState() { return normalizeBarState(uiLayout().fmtbar); }

/** ทาสภาพลงบนแถบจริง (ความจาง/คลาสล็อก) + ปรับข้อความบนหูจับ */
export function applyFmtbarState() {
  const bar = floatBar;
  if (!bar) return null;
  const st = fmtbarState();
  bar.style.setProperty('--fmtbar-opacity', String(st.opacity));
  bar.classList.toggle('k-fmtbar-locked', st.locked);
  bar.classList.toggle('k-fmtbar-dim', st.opacity < 1);
  // [alpha.118] ทั้งสามตัวเลือกย้ายเข้าเมนูคลิกขวาแล้ว — tooltip ของหูจับจึงต้องบอกทางเข้าด้วย
  const grip = bar.querySelector('.k-fmtbar-grip');
  if (grip) {
    grip.title = (st.locked ? tt('ui.fmtbar.lockedTip') : tt('ui.app.dragMoveBar'))
               + tt('ui.fmtbar.rightClickHint');
  }
  return st;
}

// [alpha.149] `scHint()` ("ป้าย (Ctrl+…)") ถูกถอด — เมนูคลิกขวาส่ง `cmd` ให้ popupMenu วางคีย์ลัด
// เป็นคอลัมน์ชิดขวาเอง (ผู้ใช้: "ชื่อ menu กับ shortcut ติดกันโดยไม่แบ่งแยก")

/** ตั้งความจางไปค่าที่เลือกตรง ๆ (เมนูคลิกขวา — ปุ่มลัดยังคงวนแบบเดิมผ่าน cycleFmtbarOpacity) */
export function setFmtbarOpacity(v) {
  saveUiLayout('fmtbar', { opacity: v });
  applyFmtbarState();
  setStatus(tf('ui.fmtbar.fadeSet', opacityPercent(v)));
  return v;
}
/** วนความจาง 100% → 50% → 5% → 100% (ครบรอบ = รีเซ็ตในตัว) — คีย์ลัด Ctrl+Shift+' */
export function cycleFmtbarOpacity() {
  return setFmtbarOpacity(nextOpacity(fmtbarState().opacity));
}

/** ย้ายไปชิดขอบบน/ล่างตรง ๆ (เมนูคลิกขวา) — แนวนอนไม่ขยับ (ผู้ใช้จัดซ้าย-ขวาไว้แล้ว) */
export function setFmtbarAlign(align) {
  const bar = floatBar, host = $('#content');
  // [alpha.117] ล็อกไว้ = ห้ามย้าย แม้จะสั่งจากเมนู/คีย์ลัด (ไม่งั้นล็อกก็ไม่มีความหมาย)
  if (fmtbarState().locked) { setStatus(tt('ui.fmtbar.lockedBlocked')); return null; }
  const a = normalizeAlign(align);
  saveUiLayout('fmtbar', { align: a });
  if (bar && host) {
    const r = bar.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const pos = alignBarPos(a, { left: parseInt(bar.style.left, 10) || 0 },
                            { width: r.width, height: r.height },
                            { width: hr.width, height: hr.height });
    bar.style.left = pos.left + 'px'; bar.style.top = pos.top + 'px';
    bar.style.right = 'auto'; bar.style.bottom = 'auto';
    saveUiLayout('fmtbar', pos);
  }
  applyFmtbarState();
  setStatus(tt(a === 'top' ? 'ui.fmtbar.movedTop' : 'ui.fmtbar.movedBottom'));
  return a;
}
/** สลับ "ชิดขอบบน ↔ ขอบล่าง" — คีย์ลัด Ctrl+Shift+; */
export function toggleFmtbarAlign() {
  return setFmtbarAlign(nextAlign(fmtbarState().align));
}

/** ล็อก/ปลดล็อกไม่ให้แถบขยับ — คีย์ลัด Ctrl+Shift+= */
export function toggleFmtbarLock(on) {
  const v = on === undefined ? !fmtbarState().locked : !!on;
  saveUiLayout('fmtbar', { locked: v });
  applyFmtbarState();
  setStatus(tt(v ? 'ui.fmtbar.locked' : 'ui.fmtbar.unlocked'));
  return v;
}

/**
 * รีเซ็ตทั้งชุด — ตำแหน่งกลับไปกึ่งกลางขอบล่าง + ชัดเต็ม + ปลดล็อก
 *
 * `fmtBarDrag.reset()` ลบตำแหน่งที่จำไว้ทิ้งทั้งก้อนแล้วเซ็ตสไตล์บน DOM ตรง ๆ จาก defaultPos
 * (ไม่เขียนกลับลงไฟล์) — ถ้าหยุดแค่นั้น รีสตาร์ตแอปจะได้ตำแหน่งที่ไม่มีอยู่จริง (`left:undefinedpx`)
 * เพราะ `saveUiLayout` ข้างล่างเขียนแค่ opacity/align/locked ไม่รู้เรื่องตำแหน่ง → อ่านค่า
 * `bar.style.left/top` กลับมาบันทึกด้วยในจังหวะเดียวกันเลย กันไม่ให้เกิดช่องว่างนั้น
 */
export function resetFmtbarAll() {
  if (fmtBarDrag) fmtBarDrag.reset();
  const bar = floatBar;
  const pos = bar ? { left: parseInt(bar.style.left, 10) || 0, top: parseInt(bar.style.top, 10) || 0 } : {};
  saveUiLayout('fmtbar', { ...resetBarState(), ...pos });
  applyFmtbarState();
  setStatus(tt('ui.app.resetPosBarFormat'));
}

/**
 * [alpha.118] เมนูคลิกขวาบนหูจับของแถบรูปแบบลอย — ความจาง · ตำแหน่ง · ล็อก · รีเซ็ต
 * แทนที่สามปุ่มเดิม (ผู้ใช้บอกว่าปุ่มเยอะไป) โดยพฤติกรรมเดิมทั้งหมดยังอยู่ครบผ่านฟังก์ชันข้างบน
 */
function fmtbarSettingsMenu(ev) {
  const st = fmtbarState();
  const mark = (on) => (on ? gi('checkmark') + ' ' : '');
  popupMenu(ev.clientX, ev.clientY, [
    { label: tt('ui.fmtbar.menuOpacity'), cmd: 'fmtbar-opacity', disabled: true },
    ...FMTBAR_OPACITIES.map((v) => ({
      label: mark(Math.abs(st.opacity - v) < 0.001) + opacityPercent(v) + '%',
      click: () => setFmtbarOpacity(v),
    })),
    '-',
    { label: tt('ui.fmtbar.menuAlign'), cmd: 'fmtbar-align', disabled: true },
    { label: mark(st.align === 'top') + tt('ui.fmtbar.posTop'), click: () => setFmtbarAlign('top') },
    { label: mark(st.align === 'bottom') + tt('ui.fmtbar.posBottom'), click: () => setFmtbarAlign('bottom') },
    '-',
    { label: mark(st.locked) + tt('ui.fmtbar.lockTip'), cmd: 'fmtbar-lock',
      click: () => toggleFmtbarLock() },
    '-',
    { label: tt('ui.fmtbar.menuResetAll'), click: () => resetFmtbarAll() },
  ]);
}

// ═══════ [alpha.111] "เรียกแถบรูปแบบมาหาเคอร์เซอร์" ═══════
//
// ผู้ใช้: *"ปุ่มที่กดแล้วย้ายไปยังจุดที่ mouse pointer อยู่ · เมาส์อยู่นอกที่เขียน → กลางจอ
//         ต่ำกว่ากลางราว 200-300px · ย้ายแบบ tween"*
//
// การคำนวณปลายทางอยู่ใน `toolbar/fmtbar-pos.js` (บริสุทธิ์ · มี unit test)
// ที่นี่มีแค่ "อ่านของจริงจากจอ" กับ "ไล่เฟรม"

let fmtBarDrag = null;
/** ตำแหน่งเมาส์ล่าสุด + อยู่ในพื้นที่เขียนไหม (อ่านจากอีเวนต์ ไม่ใช่ elementFromPoint —
 *  ตัวแถบเองลอยทับพื้นที่เขียนอยู่ ถ้าถามจากพิกัดจะได้คำตอบว่า "ไม่ได้อยู่ในที่เขียน") */
let _mousePt = null, _mouseInEd = false;
const ED_ZONE = '.ProseMirror, #panes, .k-page, .k-paper';
document.addEventListener('mousemove', (e) => {
  _mousePt = { x: e.clientX, y: e.clientY };
  const tg = e.target;
  _mouseInEd = !!(tg && tg.closest && tg.closest(ED_ZONE));
}, true);

/** id ของเฟรมที่กำลังวิ่งอยู่ (0 = ไม่มี) — ยกเลิกก่อนเริ่มรอบใหม่เสมอ */
let _fmtTween = 0;

/** เคลื่อนแถบไปตำแหน่งเป้าหมายแบบ tween (พิกัดสัมพัทธ์กับ `#content`) */
export function tweenFmtBar(toLeft, toTop, ms) {
  // [alpha.117] ล็อกไว้ = ห้ามย้าย แม้สั่งจากปุ่ม/คีย์ลัด (ไม่งั้นล็อกกันได้แค่การลากด้วยมือ)
  if (fmtbarState().locked) { setStatus(tt('ui.fmtbar.lockedBlocked')); return null; }
  const bar = floatBar;
  if (!bar) return false;
  cancelAnimationFrame(_fmtTween);
  const fromL = parseFloat(bar.style.left);
  const fromT = parseFloat(bar.style.top);
  const l0 = Number.isFinite(fromL) ? fromL : bar.offsetLeft;
  const t0 = Number.isFinite(fromT) ? fromT : bar.offsetTop;
  bar.style.right = 'auto'; bar.style.bottom = 'auto';
  const dur = ms > 0 ? ms : FMTBAR_TWEEN_MS;
  const started = performance.now();
  const done = () => {
    bar.style.left = Math.round(toLeft) + 'px';
    bar.style.top = Math.round(toTop) + 'px';
    bar.classList.remove('k-fmt-flying');
    saveUiLayout('fmtbar', { left: Math.round(toLeft), top: Math.round(toTop) });
  };
  bar.classList.add('k-fmt-flying');
  const step = (now) => {
    const k = Math.min(1, (now - started) / dur);
    bar.style.left = tweenAt(l0, toLeft, k).toFixed(1) + 'px';
    bar.style.top = tweenAt(t0, toTop, k).toFixed(1) + 'px';
    if (k < 1) _fmtTween = requestAnimationFrame(step);
    else { _fmtTween = 0; done(); }
  };
  _fmtTween = requestAnimationFrame(step);
  return true;
}

/** เป้าหมายของ "เรียกแถบมาที่นี่" ตอนนี้ — แยกออกมาให้เทสเรียกได้โดยไม่ต้องรออนิเมชัน */
export function fmtBarHereTarget() {
  const bar = floatBar, host = $('#content');
  if (!bar || !host) return null;
  const hr = host.getBoundingClientRect();
  const br = bar.getBoundingClientRect();
  return fmtBarTarget({
    pointer: _mousePt, inEditor: _mouseInEd,
    host: { left: hr.left, top: hr.top, width: hr.width, height: hr.height },
    bar: { width: br.width, height: br.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
  });
}

/** ปุ่ม/คีย์ลัด "เรียกแถบรูปแบบมาหาเคอร์เซอร์" */
export function fmtBarToPointer() {
  const tgt = fmtBarHereTarget();
  if (!tgt) return null;
  tweenFmtBar(tgt.left, tgt.top);
  setStatus(tt(tgt.fallback ? 'ui.fmtcfg.hereCenter' : 'ui.fmtcfg.hereCursor'));
  return tgt;
}
function getActiveEditor() {
  const t = state.active;
  if (t?.editor) return t.editor;
  if (t?.sp) return t.sp;
  if (t?.wiki?.secEditors) {
    for (const {k} of t.wiki.secEditors) {
      if (k?.view?.hasFocus()) return k;
    }
    return t.wiki.secEditors[0]?.k || null;
  }
  return null;
}
// แสดงแถบลอยเฉพาะตอนมีตัวแก้ไขข้อความเปิดอยู่ (นิยาย/บทหนัง/wiki) — ไม่งั้นซ่อน
function syncFloatBarVisible() {
  if (!floatBar) return;
  const ed = getActiveEditor();
  const wk = state.active?.wiki?.secEditors?.some(({k}) => k?.view?.hasFocus())
          || (state.active?.wiki?.secEditors?.length > 0);
  const was = floatBar.style.display;
  floatBar.style.display = (ed || wk) ? 'flex' : 'none';
  // [alpha.119] ตอนซ่อนอยู่ แถบวัดขนาดไม่ได้ (0×0) ตัวหนีบจึงข้ามมันไปทุกครั้ง —
  // ถ้ากรอบเปลี่ยนขนาดระหว่างที่ซ่อน ค่าที่ค้างอยู่จะกลายเป็นนอกจอทันทีที่กลับมาแสดง
  if (was === 'none' && floatBar.style.display === 'flex') {
    try { keepFloatingUiInView(); } catch {}
  }
}

// ═════════ [alpha.81 ข้อ 1] คลิกขวาบนแถบเครื่องมือ / แถบ B I U ═════════
// เดิมทางเดียวที่จะเอาปุ่มเข้า-ออกได้คือคลิกขวาบนปุ่ม "แผง" ตัวเดียว — ไม่มีใครเดาถูก
// ตอนนี้คลิกขวา "ที่ไหนก็ได้" บนแถบทั้งสอง → เมนูแบบเดียวกับ Customize Toolbar ของเบราว์เซอร์
// รายการเมนูมาจาก toolbar-ui.js (ที่เดียวกับกล่องตั้งค่า) — ที่นี่ทำแค่ผูกเหตุการณ์
// [alpha.111] แถบลอยมีเมนูของตัวเอง — ซ่อนปุ่มที่นั่นมีผลเฉพาะโหมดที่กำลังเขียน (นิยาย/บท)
// จึงใช้ `fmtbarContextItems()` คนละชุดกับแถบเครื่องมือหลัก
let _tbCtxBound = false;
export function bindToolbarContextMenu() {
  if (_tbCtxBound) return false;
  let n = 0;
  for (const sel of TB_HOSTS) {
    const bar = document.querySelector(sel);
    if (!bar) continue;
    const isFmt = sel === TB_FMT_HOST;
    bar.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      const hit = e.target.closest('[id]');
      const id = hit && bar.contains(hit) ? hit.id : '';
      popupMenu(e.clientX, e.clientY,
                isFmt ? fmtbarContextItems(id) : toolbarContextItems(id));
    };
    n++;
  }
  _tbCtxBound = n > 0;
  return _tbCtxBound;
}

// ระบบแผงย้ายไป src/panels/* ทั้งหมดแล้ว (alpha.46 — Photoshop-style dock/tab/float)
// showPanel/hidePanel/togglePanel/resetPanels/panelMenuItems import มาจาก panels/panel-ui.js


// ---------------- Tooltip ระบบเดียว KTooltip (ข้อ 16) ----------------
// [alpha.60r ข้อ 8 → alpha.62 บั๊ก 1+2] เดิมเป็นหน้าจอรอโหลดเต็มจอ (#k-loader)
// มันวางทับทุกอย่างด้วย z-index 999 รวมถึงกล่อง "บันทึกก่อนปิด?" (k-overlay z-index 80)
// ที่ closeProjectIfAny() เด้งขึ้นมาระหว่างเปิดโปรเจกต์ → กดปุ่มไม่ได้ ต้อง force quit
// ตอนนี้รายงานที่แถบสถานะล่างแทน (setBusy) — ไม่มีอะไรทับ ไม่มีอะไรบล็อก
// คงชื่อ showLoader/hideLoader ไว้เพื่อไม่ต้องไล่แก้จุดเรียกทั้งหมด
export function showLoader(msg) { return setBusy(msg || tt('ui.app.busyRun')); }
export function hideLoader() { return clearBusy(); }
// วาง tooltip "เหนือ" ตัว trigger เสมอ (ใช้ getBoundingClientRect + flip)
// ไม่หน่วงเวลา — แสดงทันที · รองรับข้อความยาว · ธีมตาม CSS
const TIP_GAP = 6;
let _tipEl = null, _tipHost = null, _tipSaved = '', _tipJob = null, _tipKt = null;

function tipBox() {
  if (!_tipEl) { _tipEl = el('div', 'k-tip'); _tipEl.id = 'k-tip'; document.body.append(_tipEl); }
  return _tipEl;
}
function placeTipRelative(el) {
  const box = tipBox();
  const er = el.getBoundingClientRect();
  const bw = box.offsetWidth || box.getBoundingClientRect().width;
  const bh = box.offsetHeight || box.getBoundingClientRect().height;
  let left = er.left + er.width / 2 - bw / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - bw - 4));
  let top = er.top - bh - TIP_GAP;
  if (top < 4) top = er.bottom + TIP_GAP;          // ชิดขอบบน → ลงไปใต้ trigger แทน
  box.style.left = Math.round(left) + 'px';
  box.style.top = Math.round(top) + 'px';
}
function placeTipAt(x, y) {
  const box = tipBox();
  const bw = box.offsetWidth || box.getBoundingClientRect().width;
  const bh = box.offsetHeight || box.getBoundingClientRect().height;
  let left = x - bw / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - bw - 4));
  let top = y - bh - TIP_GAP;
  if (top < 4) top = y + TIP_GAP + 4;
  box.style.left = Math.round(left) + 'px';
  box.style.top = Math.round(top) + 'px';
}
function hideTip() {
  clearTimeout(_tipJob);
  if (_tipHost && _tipSaved) { _tipHost.setAttribute('title', _tipSaved); }
  _tipHost = null; _tipSaved = ''; _tipKt = null;
  if (_tipEl) _tipEl.classList.remove('on');
}
/**
 * [alpha.150] เติมเนื้อลงกล่องคำแนะนำ — **ตัววาดตัวเดียว** ของทั้งสองทางเข้า
 * (`showTip()` ที่โค้ดเรียกเอง และตัวดัก mouseover ของ `setupHoverTips()`)
 *
 * บรรทัดแรก = ชื่อ + คีย์ลัด (มาจาก `title` ของปุ่มจริง ซึ่งผ่านไฟล์ภาษาและคีย์ลัดที่ผู้ใช้ตั้งไว้)
 * บรรทัดต่อมา = คำอธิบายจาก `ui.tip.<คำสั่ง>` — ไม่มีก็แสดงแค่บรรทัดแรกเหมือนเดิมทุกประการ
 */
function fillTip(box, host, text) {
  const cmd = host && host.getAttribute ? host.getAttribute('data-command') : '';
  const explicit = host && host.getAttribute ? host.getAttribute('data-tip') : '';
  const c = tipContent(text, cmd, explicit);
  box.replaceChildren();
  if (!c) return false;
  if (c.head) {
    const h = el('div', 'k-tip-head');
    h.textContent = c.head;
    box.append(h);
  }
  if (c.desc) {
    const d = el('div', 'k-tip-desc');
    d.textContent = c.desc;
    box.append(d);
  }
  box.classList.toggle('k-tip-rich', !!c.desc);
  box.classList.toggle('multiline', !!c.desc || String(text || '').includes('\n'));
  return true;
}

function showTip(host, text) {
  hideTip();
  _tipHost = host; _tipSaved = text;
  host.removeAttribute('title');
  const box = tipBox();
  fillTip(box, host, text);
  box.classList.add('on');
  placeTipRelative(host);
}
// KTooltip(trigger, text) — API เดียวสำหรับ tooltip ทั้งโปรเจกต์
// แทนที่ trigger.title = '...' → KTooltip(trigger, '...')
// ติดตั้ง mouseenter/mouseleave + ใช้ getBoundingClientRect ของ trigger + flip
export function KTooltip(trigger, text, opts = {}) {
  if (!trigger || !text) return;
  trigger.title = text;                            // ฝาก title → setupHoverTips จัดการให้
  if (opts.above === false) {
    trigger.dataset.ktAbove = '0';               // บอกให้โชว์ใต้แทน (ปุ่มบน toolbar)
  }
}
let _tipHeld = null;
function releaseHeldTitle() {
  if (_tipHeld && !_tipHeld.host.getAttribute('title')) _tipHeld.host.setAttribute('title', _tipHeld.text);
  _tipHeld = null;
}
function setupHoverTips() {
  setHoverTipHider(hideTip);
  document.addEventListener('mouseover', (e) => {
    // [alpha.157] ผู้ใช้: "hover tool tip จะต้องไม่ขึ้นทับ right click menu"
    // เมนูคลิกขวาเปิดอยู่ = ไม่มีทูลทิปเลย (ทั้งของแถวใต้เมนูและของตัวเมนูเอง)
    if (menuOpen()) {
      if (_tipHost) hideTip();
      // ทูลทิปของ Chromium เอง (จาก attribute title) ก็ต้องไม่ขึ้น — พักค่าไว้ แล้วคืนตอนเมาส์ออก
      const held = e.target instanceof Element ? e.target.closest('[title]') : null;
      if (held && held.getAttribute('title')) {
        releaseHeldTitle();
        _tipHeld = { host: held, text: held.getAttribute('title') };
        held.removeAttribute('title');
      }
      return;
    }
    let host = e.target instanceof Element ? e.target.closest('[title]') : null;
    // [alpha.60r ข้อ 7] ทำงานกับปุ่มที่ disabled (pointer-events:none) — elementFromPoint ยังหาสิ่งที่อยู่ใต้เมาส์ได้
    // [alpha.165] ★ ผู้ใช้: "hover tooltip เวลา panel ซ้อนกัน ชอบทะลุ panel ด้านบนออกมา"
    //   `elementsFromPoint` คืน **ทุกชั้น** ที่จุดนั้น รวมปุ่มของแผงที่ถูกแผงลอยทับอยู่ข้างใต้ → ทูลทิปของแผงล่างโผล่
    //   ทางสำรองนี้มีไว้ให้ปุ่มที่กดไม่ได้ซึ่งเป็น "ลูก" ของสิ่งที่อยู่ใต้เมาส์เท่านั้น → รับเฉพาะของที่อยู่ข้างใน e.target
    //   (เจอของชั้นอื่นเมื่อไหร่ = หยุด · ห้ามเดินทะลุลงไปชั้นล่าง)
    if (!host && e.target instanceof Element && e.target !== document.body && e.target !== document.documentElement) {
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of els) {
        if (el === _tipEl) continue;
        if (el === e.target) break;                    // ถึงตัวที่รับเมาส์แล้ว = ข้างล่างนี้คือชั้นอื่น
        if (!e.target.contains(el)) break;
        const tt = el.closest?.('[title]');
        if (tt && e.target.contains(tt)) { host = tt; break; }
      }
    }
    if (!host || host === _tipHost) return;
    const text = host.getAttribute('title');
    if (!text) return;
    hideTip();
    _tipHost = host; _tipSaved = text; _tipKt = host;
    host.removeAttribute('title');
    const box = tipBox();
    fillTip(box, host, text);          // [alpha.150] หัวเรื่อง + คำอธิบาย (ถ้ามี)
    box.classList.add('on');
    // ถ้า element มี data-kt-above=0 → ใช้ตำแหน่งใต้แทน
    if (host.dataset.ktAbove === '0') {
      const er = host.getBoundingClientRect();
      const bh = box.offsetHeight || box.getBoundingClientRect().height;
      box.style.left = Math.round(er.left + er.width / 2 - (box.offsetWidth || 100) / 2) + 'px';
      box.style.top = Math.round(er.bottom + TIP_GAP) + 'px';
    } else {
      placeTipRelative(host);
    }
  }, true);
  document.addEventListener('mouseout', (e) => {
    if (_tipHeld && !(e.relatedTarget instanceof Node && _tipHeld.host.contains(e.relatedTarget))) releaseHeldTitle();
    if (!_tipHost) return;
    const to = e.relatedTarget;
    if (to instanceof Node && _tipHost.contains(to)) return;
    hideTip();
  }, true);
  // เลื่อน/กด/ออกนอกหน้าต่าง → ซ่อนทันที
  for (const ev of ['mousedown', 'wheel', 'keydown', 'blur'])
    document.addEventListener(ev, hideTip, true);
}

// (ถาดแผงที่ปิดไว้ #k-min-tray เลิกใช้แล้ว — ใช้ปุ่ม toggle บน toolbar แทน)

// (ความกว้างแถบข้างปรับด้วยที่จับของ dock ใน Panel System แล้ว — .k-resize-handle)

window.addEventListener('DOMContentLoaded', () => {
  // [alpha.166] ตัววางไอคอนเส้นทับอีโมจิ (glyph-upgrade · MutationObserver ทั้งหน้า) ถูกถอด —
  // gi() คืนอักขระของฟอนต์ไอคอน (Nerd Fonts) เองแล้ว · โหลดฟอนต์ไว้ก่อน ผืนวาด (canvas) จะได้ไม่วาดเป็นกล่อง
  try { document.fonts && document.fonts.load('16px "K2 Icons"', gi('save')); } catch {}
  // [alpha.162 · W4 ข้อ 9] มาตรฐานของกล่องทุกใบ (Esc · Enter · โฟกัส · role) — ดู ui.js
  try { installDialogA11y(); } catch (e) { log('warn', 'dialog a11y', e); }
  // [alpha.162 · W5 ข้อ 3] แถบเครื่องมือหลัก = จุดหยุด Tab เดียว · ←→ เดินในแถบ (ชื่อแถบมาจาก data-i18n-attr)
  try { rovingToolbar($('#toolbar')); } catch (e) { log('warn', 'toolbar roving', e); }
  // ---- ลงทะเบียนฮุกให้ toolbar+UI อัปเดตเมื่อเปลี่ยนภาษา ----
  onLanguageChanged(applyToolbarShortcutTitles);
  // ---- โหลดภาษาเริ่มต้น แล้วค่อยเปิดโปรเจกต์ ----
  // [alpha.164 · รอบต่อ 2] ★ เดิมโหลด `DEFAULT_SETTINGS.language` (= ไทย) ตายตัว ทับภาษาที่ตัวโหลดแบบ sync
  // เลือกไว้แล้ว → ผู้ใช้ที่ตั้งอังกฤษแต่เปิดมาเจอหน้าแรก (ยังไม่มีโปรเจกต์) ได้ UI ไทยทั้งหน้า
  // ภาษาของผู้ใช้กลับมาเฉพาะตอนเปิดโปรเจกต์ · ตอนนี้ใช้ภาษาที่โหลดอยู่แล้ว (`i18n.lang`)
  loadLanguage(i18n.lang || DEFAULT_SETTINGS.language).then(() => {
    applyDataI18n();
    initIcons();
    applyToolbarShortcutTitles();
  });

  tb('#tb-bold', 'bold'); tb('#tb-italic', 'italic');
  tb('#tb-underline', 'underline'); tb('#tb-strike', 'strike');
  // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย
  tb('#tb-sup', 'sup'); tb('#tb-sub', 'sub');
  tb('#tb-ul', 'ul'); tb('#tb-ol', 'ol'); tb('#tb-quote', 'quote');
  // [alpha.132 ข้อ 9] สีตัวอักษร — ปุ่มเปิดป๊อปอัป (จานสี · วงล้อสี · ที่บันทึกไว้ · ใช้ล่าสุด)
  $('#tb-color').onclick = (e) => openTextColorPicker(e.currentTarget);
  // [alpha.150 ข้อ 1] สีเน้นข้อความ — ป๊อปอัปตัวเดียวกับสีตัวอักษร คนละจานสีสำเร็จ
  $('#tb-highlight').onclick = (e) => openHighlightPicker(e.currentTarget);
  // ปิดป๊อปอัปเมื่อสลับแท็บ/ปิดโปรแกรม — ค้างอยู่บนแท็บที่ไม่มีตัวแก้ไขแล้วกดจะพังเปล่า ๆ
  window.addEventListener('blur', closeColorPicker);
  tb('#tb-align-left', 'align', 'left'); tb('#tb-align-center', 'align', 'center');
  tb('#tb-align-right', 'align', 'right'); tb('#tb-align-justify', 'align', 'justify');
  // ══ [alpha.150 ข้อ 1] ปุ่มใหม่บนแถบรูปแบบลอย ══
  // ทุกปุ่มบนแถบต้อง **ผูกคำสั่งจริง** ไม่ใช่มีแต่ `data-command` ไว้ทำ tooltip/ไอคอน
  // (เทส [a122] กวาดทั้งทะเบียนหาปุ่มที่กดแล้วเงียบ — ปุ่มแบบนั้นผู้ใช้แยกไม่ออกจากฟีเจอร์ที่ยังไม่เสร็จ)
  tb('#tb-undo', 'undo'); tb('#tb-redo', 'redo');
  tb('#tb-h2', 'heading', 2); tb('#tb-h3', 'heading', 3); tb('#tb-h4', 'heading', 4);
  // [alpha.151 ข้อ 1+3] ปุ่มจัดแนวตั้งย้ายไปอยู่บนแถบของกระดานแล้ว — ไม่มีในแถบนี้อีก
  //
  // ★ บทเรียน: `$('#id').onclick = …` กับปุ่มที่ถูกถอดออกจาก index.html = TypeError กลางคัน
  //   ของ DOMContentLoaded → **ตัวผูกปุ่มที่เหลือทั้งหมดหลังบรรทัดนั้นไม่ถูกรัน**
  //   ผลคือปุ่มครึ่งแถบกดแล้วเงียบ และแถบรูปแบบลอยไม่ถูกสร้างเลย — โดยไม่มี error ให้ผู้ใช้เห็น
  $('#tb-find').onclick = () => openFind();
  // [alpha.157] ขวาสุดของแถบ: ซ่อน/แสดงแผงทีละฝั่ง
  for (const b of document.querySelectorAll('.k-side-toggles [data-side]')) {
    b.onclick = () => handleCommand('panels-side-' + b.dataset.side);
  }
  syncSideToggles();
  $('#tb-img').onclick = insertImage;
  // [alpha.62 บั๊ก 14] สวิตช์จริง — กดเปิด กดซ้ำปิด (บทเรียนเดียวกับปุ่มแชท AI ใน 62-2)
  $('#tb-gallery').onclick = () => toggleGallery();
  $('#tb-mode').onclick = (e) => {
    const tab = state.active;
    if (!tab || !(tab.editor || tab.sp)) return;
    const cur = tab.sp ? 'screenplay' : 'prose';
    const r = e.target.getBoundingClientRect();
    popupMenu(r.left, r.bottom + 4, [
      // [alpha.147] ไอคอนมาจากแถว set-format:<โหมด> ในทะเบียน (ว่าง = ไม่มีไอคอน)
      { label: iconHtml(commandIcon('set-format:prose'), 14) + ' ' + (cur === 'prose' ? gi('checkmark') + ' ' : '') + tt('ui.app.novel3'), click: () => switchFormat('prose') },
      { label: iconHtml(commandIcon('set-format:screenplay'), 14) + ' ' + (cur === 'screenplay' ? gi('checkmark') + ' ' : '') + tt('ui.common.chapterFilm'), click: () => switchFormat('screenplay') },
    ]);
  };
  $('#tb-style').onchange = (e) => {
    const v = e.target.value;
    const ed = getActiveEditor(); if (!ed) return;
    if (v === 'p') ed.cmd('paragraph');
    else if (v === 'quote') ed.cmd('quote');
    else ed.cmd('heading', +v.slice(1));
    if (state.active) markDirty(state.active);
  };
  // [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ของช่วงที่เลือก — เลือกแล้วเด้งกลับหัวข้อ (ไม่ใช่สถานะค้าง)
  const caseSel = $('#tb-case');
  // [alpha.124 ข้อ 36] ป้ายในรายการนี้เคยฮาร์ดโค้ดอังกฤษไว้ใน index.html ทั้งชุด
  // ขณะที่ `CASE_LABELS` (text-case.js) ซึ่งเป็นตารางภาษาของมันเองกลายเป็นโค้ดตาย —
  // ผู้ใช้ไทยจึงเห็น "aLtErNaTe cAsE" เปล่า ๆ โดยไม่มีอะไรบอกว่ามันทำอะไร
  // สร้างรายการจากตารางจริงตอนรัน → เปลี่ยนภาษาแล้วเปลี่ยนตาม และไม่มีสองแหล่งความจริง
  applyCaseOptions();
  const applyCase = (mode) => {
    if (!mode) return;
    const ed = getActiveEditor();
    if (!ed) { setStatus(tt('ui.app.openSceneBeforeChangeImage')); return; }
    // [alpha.62 บั๊ก 11] ในบทหนัง element อย่าง "ชื่อตัวละคร/หัวฉาก" ถูก text-transform:uppercase อยู่
    //   → เปลี่ยน case ของข้อความสำเร็จ แต่บนจอไม่ขยับเลย ผู้ใช้อ่านว่า "ล็อกไว้ ปรับไม่ได้"
    //   ถ้าสั่งเปลี่ยนเป็นตัวเล็ก/รูปแบบอื่นทั้งที่ element นั้นบังคับตัวใหญ่อยู่ = เจตนาชัดว่า
    //   "ขอเห็นตามที่พิมพ์" → ปลดล็อกให้ element นั้นเลย แล้วบอกว่าเกิดอะไรขึ้นและปิดกลับได้ที่ไหน
    const spEl = state.active?.sp ? state.active.sp.curElement() : null;
    const wasCapped = spEl && mode !== 'UC' && elementCaps(spFormat(), spEl);
    const ok = ed.cmd('case', mode);
    if (ok) {
      if (state.active) markDirty(state.active);
      if (wasCapped) {
        toggleElementCaps(spEl, false);
        setStatus(ttf('ui.app.changeImageCaseUnset', CASE_SHORT[mode]) +
                  ttf('ui.app.doneOpenBackChapter', elemLabel(spEl)));
      } else setStatus(tt('ui.app.changeImageCase') + CASE_SHORT[mode]);
    } else setStatus(tt('ui.app.pickTextBeforeDone'));
    refreshToolbar();
  };
  if (caseSel) caseSel.onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    popupMenu(r.left, r.bottom + 2, caseMenuItems(applyCase));
  };
  $('#tb-sp-elem').onchange = (e) => {
    const sp = state.active?.sp; if (!sp) return;
    sp.setElement(e.target.value);
    sp.view.focus();
    setElementBadge(e.target.value);
    if (state.active) markDirty(state.active);
  };
  // [alpha.57a ข้อ 2] ปุ่มส่วนเสริมท้ายชื่อตัวละคร
  const spExtBtn = $('#tb-sp-ext');
  if (spExtBtn) spExtBtn.onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    extensionMenu(r.left, r.bottom + 4);
  };
  // alpha.57 — สลับมุมมองบท + ป้ายข้อผิดพลาดบนแถบสถานะ
  const spViewSel = $('#sp-view-select');
  if (spViewSel) spViewSel.onchange = (e) => setSpView(e.target.value);
  // [alpha.62 บั๊ก 17] ป้ายตรวจบท = ปุ่มจริง — คลิกได้เมนูคำสั่ง · คลิกขวาก็เมนูเดียวกัน
  const errBadge = $('#sp-errors');
  if (errBadge) {
    errBadge.onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      spErrorMenu(r.left, r.top - 6);
    };
    errBadge.oncontextmenu = (e) => {
      e.preventDefault();
      spErrorMenu(e.clientX, e.clientY);
    };
  }
  $('#open-btn').onclick = async () => { const p = await kapi.openProjectDialog(); if (p) await openProjectFromUi(p); };
  // [alpha.137] "สร้างโปรเจกต์ใหม่" ย้ายไปเมนู ไฟล์ อย่างเดียว (ไม่มีปุ่มบนแถบแล้ว)
  // [alpha.138] ผู้ใช้: *"ปุ่มค้นหาซ้ายมือ มันเป็น toggle นะ"* — กดซ้ำ = ปิดแผง เหมือนปุ่มแผงตัวอื่น
  $('#search-all-btn').onclick = () => { togglePanel('search'); refreshToolbar(); };
  $('#win-min').onclick = () => kapi.winMin();
  $('#win-max').onclick = () => kapi.winMax();
  $('#win-close').onclick = () => kapi.winClose();
  // Esc ออกจากโหมดโฟกัส — แต่ต้องไม่แย่ง Esc ของกล่องโต้ตอบที่เปิดอยู่ (กล่องปิดตัวเองก่อน)
  // และเมื่อเปิดทั้งโฟกัส+โหมดอ่าน ให้ออกทีละชั้น: โฟกัสก่อน แล้วค่อยโหมดอ่าน (ดู toggleReading)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.k-overlay')) return;
    if (!document.body.classList.contains('focus-mode')) return;
    // ปักธงบนอีเวนต์ ไม่ใช่ดูคลาส — ตัวจับของโหมดอ่านอาจทำงานหลังจากคลาสถูกถอดไปแล้ว
    // (ลำดับ listener ขึ้นกับว่าใครลงทะเบียนก่อน) → Esc ครั้งเดียวจะออกทั้งสองโหมดพร้อมกัน
    e._k2EscUsed = true;
    toggleFocus(false);
  });
  $('#tb-plug').onclick = (e) => {
    if (!plugins.commands.length) return;
    const r = e.target.getBoundingClientRect();
    popupMenu(r.left, r.bottom + 4, plugins.commands.map((c) => (
      { label: c.label, click: () => { try { c.fn(); } catch (err) { setStatusError(failText(tt('ui.app.plugin3'), err)); } } })));
  };
  document.querySelectorAll('.tb-menu').forEach((m) => {
    m.onclick = () => { const r = m.getBoundingClientRect(); kapi.menuPopup(m.dataset.m, r.left, r.bottom); };
  });
  $('#tb-source').onclick = () => showSourceView();
  // [alpha.84 ข้อ 3+4] สวิตช์ใหม่บนแถบรูปแบบ
  const bCont = $('#tb-sp-cont'); if (bCont) bCont.onclick = () => toggleContinueds();
  const bInd = $('#tb-indent'); if (bInd) bInd.onclick = () => toggleProseIndent();
  // ---- ปุ่มโหมดอ่าน + ค้นหาทั้งโปรเจกต์ ----
  $('#tb-read').onclick = () => toggleReading();
  $('#tb-gsearch').onclick = () => handleCommand('global-search');
  // ---- ปุ่มโน้ตด่วน (ข้อ 85): คลิก = จดกับฉากที่เปิดอยู่ · คลิกขวา = ดูโน้ตทั้งหมด ----
  $('#tb-note').onclick = async () => { const c = await sceneCtx(); quickNote(c?.row?.id, c?.row?.title); };
  $('#tb-note').oncontextmenu = (e) => { e.preventDefault(); showAllNotes(); };
  // ---- ปุ่ม Kanban + AI ----
  $('#tb-kanban').onclick = () => { togglePanel('kanban'); refreshToolbar(); };
  // [alpha.60r ข้อ 4] ปุ่มแดชบอร์ดบน toolbar
  const dbBtn = $('#tb-dashboard');
  if (dbBtn) dbBtn.onclick = () => { togglePanel('dashboard'); refreshToolbar(); };
  // [alpha.69] ปุ่มของสามแผงใหม่ — สวิตช์ตรง ๆ เหมือนปุ่มแผงตัวอื่นทุกตัว
  for (const [btn, pid] of [['#tb-codex', 'codex'], ['#tb-history', 'history'], ['#tb-record', 'record']]) {
    const b = $(btn);
    if (b) b.onclick = () => { togglePanel(pid); refreshToolbar(); };
  }
  $('#tb-ai').onclick = () => openAIAssistant();
  // [alpha.162 · W5 ข้อ 4] ปุ่ม AI ปุ่มเดียว = เมนูของห้าปุ่มเดิม · ปุ่มตั้งค่า (ด่าน [a122]: ทุกปุ่มต้องผูกคลิกจริง)
  $('#tb-ai-group') && ($('#tb-ai-group').onclick = () => handleCommand('ai-menu'));
  $('#tb-settings') && ($('#tb-settings').onclick = () => handleCommand('settings'));
  // [alpha.60r3 ข้อ 5] แผงวิเคราะห์ด้วย AI (ตัวอย่างหน้าตา)
  $('#tb-ai-analyzer') && ($('#tb-ai-analyzer').onclick = () => handleCommand('ai-analyzer'));
  // [alpha.60r3 ข้อ 6] ซ่อน/แสดงรหัสมาร์กดาวน์+fountain ที่นำหน้าบรรทัด
  $('#tb-md-codes') && ($('#tb-md-codes').onclick = () => handleCommand('markdown-codes'));
  // [alpha.62 บั๊ก 2] เป็นสวิตช์ของแผง "AI ผู้ช่วยเขียน" — กล่องแชทเดิมย้ายไปเมนู AI → แชทกับเรื่องของคุณ
  $('#tb-ai-chat').onclick = () => handleCommand('ai-chat-toggle');
  $('#tb-starter') && ($('#tb-starter').onclick = () => handleCommand('story-starter-toggle'));
  // [alpha.162 · W2] ★ ปุ่มสวิตช์ของแผงผูกจาก **ทะเบียนคำสั่ง** ชุดเดียวกับตัวติดไฟใน refreshToolbar
  // (เดิมเป็นบรรทัดเขียนมือหกบรรทัด + ตาราง TB_PANEL_BUTTONS อีกชุด — ปุ่มใหม่ตกสำรวจได้ง่าย)
  for (const b of document.querySelectorAll('[data-command^="toggle-panel:"]')) {
    const pid = String(b.dataset.command).slice('toggle-panel:'.length);
    b.onclick = () => { togglePanel(pid); refreshToolbar(); };
  }
  // คลิก = จัดการแผง · คลิกขวา = ปรับปุ่มบนแถบเครื่องมือ (เอาปุ่มเข้า-ออก)
  $('#tb-panels').onclick = () => togglePanelDialog();
  $('#tb-panels').oncontextmenu = (e) => { e.preventDefault(); toolbarDialog(); };
  $('#tb-split').onclick = () => handleCommand('split-view');
  $('#tb-close').onclick = () => { const t = state.active; if (t) closeTab(t.file, { ask: true }); };
  $('#tb-close-all').onclick = () => closeAllTabs();
  $('#tb-focus').onclick = () => handleCommand('focus-mode');
  $('#tb-typewriter').onclick = () => handleCommand('typewriter');
  $('#tb-linenum').onclick = () => handleCommand('line-numbers');
  $('#tb-visual').onclick = () => openVisualForActive();
  $('#tb-quickopen').onclick = () => handleCommand('quick-open');
  // ---- ปุ่มลัด Cheatsheet ----
  // [alpha.124 ข้อ 3] เดิมดัก Ctrl+Shift+/ เองที่นี่ → **ชนกับ `fmtbar-here`** ในตาราง SHORTCUTS
  // กดทีเดียวได้ทั้งแถบรูปแบบลอยและกล่องคีย์ลัด · ตอนนี้คีย์อยู่ในตารางแล้ว (Ctrl+Alt+/)
  // เหลือไว้ที่นี่แค่ `?` เปล่า ๆ ซึ่งไม่ใช่คีย์ลัดของตาราง (ไม่มี Ctrl) จึงชนกับใครไม่ได้
  document.addEventListener('keydown', (e) => {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    // พิมพ์ `?` ในช่องกรอกหรือในเอกสารต้องได้ตัว `?` จริง ไม่ใช่กล่องคีย์ลัดเด้ง
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT'
               || ae.isContentEditable)) return;
    e.preventDefault(); showShortcutsDialog();
  });
  // คีย์ลัดของ quick-open / typewriter / focus / global-search อยู่ในตาราง SHORTCUTS แล้ว
  // (เดิมผูก listener แยกที่ Ctrl+P และ Ctrl+Shift+F ซึ่งชนกับ 'print' และ 'focus-mode')
  // ---- สำรองอัตโนมัติ (เช็คทันที + ทุกชั่วโมง ว่าวันนี้สำรองหรือยัง) ----
  startAutoBackup();
  // ---- Auto-record daily words on autosave (modify autosave interval) ----
  // (จับใน saveAllTabs แทน)
  // ---- ปุ่มบันทึกทั้งหมด + หน้าแรก ----
  $('#save-all-btn').onclick = () => saveAllTabs();
  // [alpha.137] ปุ่มหน้าแรกถูกถอดออกจากแถบแล้ว (เหลือทางเข้าที่เมนู มุมมอง → หน้าแรก)
  // — ผูกไว้แบบมีเงื่อนไขเผื่อมีคนใส่ปุ่มกลับมา · **ห้ามผูกตรง ๆ**: element ที่ไม่มีจริง
  //   ทำให้บรรทัดถัดจากนี้ทั้งชุด (ตัวควบคุมซูม ฯลฯ) ไม่ถูกผูกเลย
  $('#home-btn') && ($('#home-btn').onclick = () => { import('./home-ui.js').then((m) => m.showHomeDialog()); });
  // [alpha.124 ข้อ 1] ตัวดัก Ctrl+Shift+S ตัวเก่าถูกถอดออก — มันยิงพร้อม `save-as` ในตาราง
  // SHORTCUTS (onShortcut ไม่ได้ stopPropagation) → กดทีเดียวได้ทั้งกล่อง Save-As ของระบบ
  // **และ** กล่อง "บันทึกทั้งหมด" ซ้อนกันสองใบ · บันทึกทั้งหมด = Ctrl+Alt+S (ตั้งใหม่เองได้)
  // ---- ตั้งค่า title ของปุ่ม toolbar ให้แสดง shortcut ----
  updateToolbarTitles();
  // ---- FAB (ปุ่มลอยสร้างใหม่) ----
  wireFab();
  // ---- tooltip ลอยเหนือเคอร์เซอร์ (ข้อ 16) ----
  setupHoverTips();
  // ---- Filter bar ----
  // [alpha.120 ข้อ 2] เลือกแล้ว **ต้องสร้างต้นไม้ใหม่** — ไม่งั้นค่าที่เลือกไม่มีผลกับอะไรเลย
  $('#filter-sort').onchange = async () => {
    setTreeSortMode($('#filter-sort').value);
    await buildTree();
    buildFilterBar();
    filterTree($('#tree-search').value);
  };
  // คืนค่าที่เลือกไว้ครั้งก่อนของโปรเจกต์นี้ (dropdown เกิดใหม่ทุกครั้งที่เปิดโปรเจกต์)
  try { const sv = treeSortMode(); if (sv) $('#filter-sort').value = sv; } catch {}
  // [alpha.161 · P3] ON = แสดงฉากเก็บถาวร (ค่าเริ่มต้นซ่อน) · ตัวกรองคำค้นยังมีผลเหมือนเดิม
  $('#filter-archive-toggle').onclick = () => setTreeShowArchived(!treeArchive_C.show);
  $('#filter-archive-toggle').classList.toggle('on', treeArchive_C.show);
  // ---- ตัวควบคุมซูมมุมล่างขวา ----
  $('#zoom-slider').oninput = (e) => setPageScale(parseInt(e.target.value, 10) / 100);
  $('#zoom-in').onclick = () => bumpPageScale(1);
  $('#zoom-out').onclick = () => bumpPageScale(-1);
  $('#zoom-reset').onclick = () => resetPageScale();
  $('#zoom-ctl').oncontextmenu = zoomLabelMenu;     // [alpha.164 · รอบต่อ 3] สวิตช์ซูมพอดีความกว้างอัตโนมัติ
  installStatusToggles((cmd) => handleCommand(cmd)); // [alpha.165] ช่องสวิตช์บนแถบสถานะ
  installStatusBarLock();                             // [alpha.166] ช่องขวาของแถบสถานะกว้างได้ ห้ามหด (ไม่ขยับไปมา)
  // [alpha.165] ปุ่มหน้าแรกท้ายแถบสถานะ — `data-command` ให้แค่ไอคอน/ทูลทิป ไม่ผูกคลิกให้ (bug hunt: กดแล้วเงียบ)
  $('#status-home').onclick = () => handleCommand('home');
  $('#tree-search').oninput = (e) => filterTree(e.target.value);
  setupTreeInteractions();          // [alpha.120 ข้อ 11+16] คีย์ลัด + เมนูคลิกขวาพื้นที่ว่าง

  // ---- แถบรูปแบบอักษรแบบลอย (ลากย้ายได้ · จำตำแหน่ง) ----
  setupFloatingFormatBar();
  // [alpha.139] ★ ต้องมาหลัง setupFloatingFormatBar เสมอ — ตัวนั้นลบ `.sep` ใน #toolbar ทิ้งทั้งหมด
  applyToolbarGroupSeps();
  bindToolbarContextMenu();          // [alpha.81 ข้อ 1] คลิกขวาบนแถบ = เมนูปรับปุ่ม (เหมือนเบราว์เซอร์)
  initLineGutter();                  // [60r2 ข้อ 11] รางเลขบรรทัดฝั่ง UI (ผูก scroll ครั้งเดียว)
  // ---- Panel System (Photoshop-style) — วาดทุกแผงลง #app-root ----
  initPanelSystem();
  // [60r2 ข้อ 1 + 11] ขยับ/ปรับขนาดแผง = พื้นที่กระดาษเปลี่ยน → กว้าง workspace + รางเลขบรรทัดต้องตาม
  onPanelLayoutChange(() => { refreshToolbar(); syncWorkspaceWidths(); scheduleLineGutter();
                              recenterOnPaneResize();
                              markSessionDirty(); });   // [alpha.79] เลย์เอาต์เปลี่ยน = ต้องจำ
  startLogAutoRefresh();
  // ---- Split View — ผูก SplitManager เข้ากับ #panes + ลากหัวแท็บไปวางในช่องได้ ----
  // closeTab: บั๊ก #12 — × บนแท็บย่อยของช่อง เอาแท็บออกจากช่องนั้น
  // ถ้าไม่เหลืออยู่ช่องไหนเลยก็ต้องปิดแท็บจริง (แถบแท็บรวมถูกซ่อนตอนแยกจอ — ไม่งั้นแท็บลอยหาย)
  // [alpha.110] วาดต้นไม้ split ใหม่ = แผงย้ายที่/เปลี่ยนช่อง → ทามุมมองของแต่ละแท็บใหม่ทุกครั้ง
  initSplitSystem({ activate, closeTab, onRender: () => { reapplyTabView(true); refreshToolbar(); } });

  // ══ [alpha.162 · W2] ★ ปุ่มที่โมดูลอื่นฝากไว้บนหัวแผง ใช้ `makePanelButton()` เหมือนปุ่มของระบบ ══
  //
  // กฎถาวร alpha.161 · U2 เขียนไว้ชัดว่า "ปุ่มควบคุมของระบบแผง = makePanelButton()" และ
  // "ห้าม `el('span','k-panel-btn', …)` + onclick ตรง ๆ" — แต่ปุ่มทั้งเจ็ดตัวที่นี่ยังเขียนมือแบบเดิม
  // (ตัววาดหัวแผงต้องไล่แปะ role/tabindex/keydown ให้ทีหลังเป็นยาแก้ขัด) · ตอนนี้ประกอบจากตัวเดียวกัน
  // จึงได้ครบตั้งแต่เกิด: กดด้วยคีย์บอร์ดได้ · มี aria-label · ทูลทิปสองบรรทัดจากไฟล์ภาษา

  // ปุ่มรีเฟรชบนหัวแผงโปรเจกต์ = อ่านโฟลเดอร์ใหม่ (ข้อ 11)
  // จำเป็นเพราะไฟล์ถูกแก้จากนอกโปรแกรมได้ (Explorer/Finder) แล้วต้นไม้ไม่รู้
  const refreshBtn = makePanelButton({
    cls: 'k-tree-refresh-btn', glyph: gi('refresh'), titleKey: 'ui.app.refreshReadFileFolder',
    tip: 'ui.panelTip.treeRefresh',
    onPress: async () => {
      if (!state.root) { setStatus(tt('ui.common.cantOpenProject')); return; }
      refreshBtn.classList.add('spin');
      try {
        await loadTemplates();
        await smart.loadNames(state.root);
        await buildTree();
        await buildFilterBar();
        setStatus(tt('ui.app.refreshListProjectDone'));
      } finally { refreshBtn.classList.remove('spin'); }
    },
  });
  addPanelButton('tree', refreshBtn);

  // ปุ่มค้นหาบนหัวแผงโปรเจกต์ = เปิด/ปิดช่องค้นหา (อยู่ในแผง explorer)
  const applySearchVis = (on) => { $('#tree-search').classList.toggle('k-search-off', !on);
    searchBtn.classList.toggle('on', on); localStorage.setItem('k2-tree-search', on ? '1' : '0');
    if (on) $('#tree-search').focus(); };
  const searchBtn = makePanelButton({
    cls: 'k-tree-search-btn', glyph: gi('search'), titleKey: 'ui.app.openCloseFieldSearch',
    tip: 'ui.panelTip.treeSearch',
    onPress: () => applySearchVis($('#tree-search').classList.contains('k-search-off')),
  });
  addPanelButton('tree', searchBtn);
  applySearchVis((localStorage.getItem('k2-tree-search') ?? '1') === '1');

  // ปุ่ม ¶ บนหัวแผง Navigation = โชว์/ซ่อนย่อหน้า (beat)
  const beatBtn = makePanelButton({
    glyph: gi('pilcrow'), titleKey: 'ui.app.showHideParaNavigation', tip: 'ui.panelTip.navBeats',
    onPress: () => setNavBeats(!navShowBeats),
  });
  beatBtn.id = 'nav-beats-btn';
  beatBtn.classList.toggle('on', navShowBeats);
  addPanelButton('outline', beatBtn);
  // [alpha.126] ปุ่มหนังสือ = สลับระหว่าง "ฉากที่เปิดอยู่" กับ "ทั้งเล่ม"
  const bookBtn = makePanelButton({
    glyph: gi('books'), titleKey: 'ui.app.navWholeBookHint', tip: 'ui.panelTip.navBook',
    onPress: () => setNavWholeBook(!navWholeBook),
  });
  bookBtn.id = 'nav-book-btn';
  bookBtn.classList.toggle('on', navWholeBook);
  addPanelButton('outline', bookBtn);

  // ปุ่มแผงบันทึก (Log): รีเฟรช · เปิดโฟลเดอร์ · คัดลอก
  addPanelButton('log', makePanelButton({
    glyph: gi('refresh-thin'), titleKey: 'ui.common.refresh', tip: 'ui.panelTip.logRefresh',
    onPress: () => renderLogPanel(),
  }));
  addPanelButton('log', makePanelButton({
    glyph: gi('folder'), titleKey: 'ui.app.openFolderLog', tip: 'ui.panelTip.logReveal',
    onPress: () => { kapi.logReveal && kapi.logReveal(); },
  }));
  // [alpha.72 ข้อ 5] คัดลอก "เฉพาะที่กรองอยู่" — ส่งให้คนช่วยดูบั๊กได้ตรงจุด ไม่ต้องส่งทั้งกอง
  addPanelButton('log', makePanelButton({
    glyph: gi('clipboard'), titleKey: 'ui.common.copy', tip: 'ui.panelTip.logCopy',
    onPress: () => {
      const txt = exportText(filterLogs(logStore.all(), logView));
      navigator.clipboard.writeText(txt || tt('ui.app.notHasLineAt'))
        .then(() => setStatus(ttf('ui.app.copySaveDoneLine', txt ? txt.split('\n').length : 0)));
    },
  }));

  // ═══ คลิกขวาในตัวแก้ไข — เมนูเดียว รวมทุกเรื่องของ "คำ" ตรงนั้น ═══
  //
  // [alpha.124 ข้อ 30] ★ คำที่ขีดแดงต้องมี **คำแนะนำให้เลือก**
  //   เดิมมีรายการเดียวคือ "เพิ่มลงพจนานุกรม" — ซึ่งเป็นทางเดียวที่ *ไม่* แก้คำผิดให้เลย
  //   ตัวแก้ไขทุกตัวในโลกให้คำที่น่าจะถูกมาเลือกก่อน แล้วค่อยมี "เพิ่มลงพจนานุกรม" ท้ายสุด
  //   ตอนนี้: คำใกล้เคียงจากเอนจินเดียวกับที่ขีดเส้นแดง (spell.js) · คลิกแล้วแทนที่ในเอกสารทันที
  //   \+ "ข้ามคำนี้ครั้งนี้" (ไม่จำถาวร แค่เลิกขีดแดงในรอบนี้)
  //
  // [alpha.124 ข้อ 32] และเหลือรายการคำพ้อง **ชุดเดียว**
  //   เดิมมีสองชุดในเมนูเดียวกัน: ของเก่า (Datamuse ออนไลน์ อังกฤษล้วน → แทนที่คำ)
  //   กับของใหม่ (tools/thesaurus: คลังไทย+อังกฤษในตัว ออฟไลน์ได้ → คัดลอก)
  //   ผู้ใช้เห็นสองบรรทัดชื่อเกือบเหมือนกันแต่กดแล้วผลไม่เหมือนกัน · เหลือของใหม่ตัวเดียว
  //   (ซึ่งครอบของเก่าอยู่แล้ว: เปิดสวิตช์ในตั้งค่า = มันค้นออนไลน์ต่อให้ด้วย)
  document.addEventListener('contextmenu', (e) => {
    if (!state.root) return;
    // ══ [alpha.142 ข้อ 6] ★ คลิกขวาที่รูป = ปรับรูปได้ ══
    // ผู้ใช้: *"ใน editor รูปจะปรับขนาดไม่ได้ … light novel มักจะใส่รูป หน้าแรก หรือแทรกลงไป"*
    // ต้องมาก่อนด่านตรวจคำผิด/พจนานุกรมข้างล่าง เพราะคลิกขวาบนรูปไม่เคยเข้าเงื่อนไขพวกนั้นเลย
    // แล้วมันจะ `return` ทิ้งไปก่อน (= ที่ผ่านมาคลิกขวาที่รูปไม่มีอะไรขึ้นมาเลยสักอย่าง)
    {
      const figEl = e.target.closest && e.target.closest('.ProseMirror figure');
      const edFig = state.active && state.active.editor;
      const figPos = figEl && edFig ? edFig.figurePosOfDom(figEl) : -1;
      if (figPos >= 0) {
        e.preventDefault(); e.stopPropagation();
        imageMenu(edFig, figPos, e.clientX, e.clientY);
        return;
      }
    }
    const bad = e.target.closest && e.target.closest('.k-spell-bad');
    // ⚠ ขอบเขต: เมนูนี้เป็นของ "คำในเอกสาร" เท่านั้น — คลิกขวาที่อื่น (ต้นไม้ · แผง · ช่องกรอก)
    // ต้องปล่อยให้เมนูของที่นั้นทำงานตามเดิม เพราะตัวนี้ดักแบบ capture แล้ว stopPropagation
    // (ถ้าไม่จำกัด จะไปกลืนเมนูคลิกขวาของทั้งโปรแกรมทันทีที่มีข้อความถูกเลือกค้างอยู่)
    // [alpha.165] ต้องเป็นตัวแก้ไขจริง (มี view ผูกอยู่ — ProseMirror ติด `pmViewDesc` ที่ dom ของ view)
    //   สำเนา DOM ในโหมดอ่านทั้งเล่ม/มุมมองหน้ากระดาษ/ช่องตัวอย่างก็มีคลาส .ProseMirror แต่ไม่ใช่เอกสารที่แก้ได้
    //   → ปล่อยให้เมนูปกติของที่นั้น (ของ main: คัดลอก) ทำงาน ไม่งั้นได้เมนูตัวหนา/วาง ที่ไปยิงใส่แท็บอื่น
    const pmEl = e.target.closest && e.target.closest('.ProseMirror');
    const inDoc = !!(pmEl && pmEl.pmViewDesc);
    const sel = window.getSelection();
    const selWord = (sel?.toString() || '').trim();
    const hasThes = inDoc && selWord.length >= 2 && selWord.length <= 40;
    // "Rewrite this" — เลือกข้อความในเอกสารที่เปิดอยู่ (ยาวเท่าไหร่ก็ได้) → ให้ AI เขียนช่วงนั้นใหม่
    const rwTab = state.active;
    const rwEd = rwTab && (rwTab.editor || rwTab.sp);
    const canRewrite = inDoc && !!selWord && !!(rwEd && rwEd.view && rwEd.view.dom.contains(e.target)
      && !rwEd.view.state.selection.empty);
    // [alpha.164] ฉากมีปัญหา — คลิกขวาบนบรรทัดที่มีปัญหา (หรือที่ไหนก็ได้ตอนดูฉบับเดิม)
    const onsetItems = inDoc ? onsetEditorMenu(rwTab, e.target) : null;
    // [alpha.165] ★ เมนูในเอกสารเป็นของ renderer "ทั้งเมนู" เสมอ — เดิมขึ้นเมนูนี้เฉพาะตอนมีคำพ้อง/Rewrite/คำผิด
    //   แล้ว preventDefault ทำให้เมนูมาตรฐานของ main (ตัด · คัดลอก · วาง · ตัวหนา …) ไม่ขึ้นเลย
    //   = เลือกข้อความแล้วคลิกขวา "ตัด/คัดลอกไม่ได้" · ตอนนี้รวมเป็นเมนูเดียว ของมาตรฐานมาครบทุกครั้ง
    if (!inDoc) return;
    e.preventDefault(); e.stopPropagation();
    const items = [];
    if (onsetItems) { items.push(...onsetItems); items.push('-'); }
    if (bad) {
      const word = bad.textContent.trim();
      // คำแนะนำ (สูงสุด 6 คำ) — บนสุดของเมนูเสมอ เพราะเป็นสิ่งที่ผู้ใช้ต้องการ 9 ใน 10 ครั้ง
      const sugg = spellSuggest(word, 6);
      if (sugg.length) {
        items.push({ text: tt('ui.app.spellSuggestHead'), disabled: true });
        for (const w of sugg) items.push({ text: w, click: () => replaceSpellWord(bad, w) });
        items.push('-');
      } else {
        items.push({ text: tt('ui.app.spellNoSuggest'), disabled: true });
      }
      items.push({ text: ttf('ui.app.add', word), click: async () => {
        await kapi.spellAddWord(state.root, word);
        await loadSpellDict(state.root);
        setStatus(tt('ui.app.addDone') + word);
      } });
      items.push({ text: ttf('ui.app.spellIgnoreOnce', word), click: () => {
        spellIgnoreOnce(word);
        setStatus(ttf('ui.app.spellIgnoredOnce', word));
      } });
      items.push('-');
    }
    items.push(...editorStdMenuItems(e.target, !!selWord));
    if (hasThes || canRewrite) items.push('-');
    if (hasThes) {
      items.push({ text: ttf('ui.app.thesaurusWordOpposite', selWord), click: () => {
        showThesaurusPopup(selWord, e.clientX, e.clientY);
      } });
    }
    if (canRewrite) {
      items.push({ text: gi('pen') + ' ' + tt('ui.aiRewrite.menu'), click: () => { openRewriteBar(rwTab); } });
    }
    items.push('-', ...editorFmtMenuItems(e.target));
    popupMenu(e.clientX, e.clientY, items);
  }, true);

  // วาง (paste) / ลาก-วาง (drop) รูปเข้าเอกสาร → คัดลอกเข้าคลัง Images แล้วแทรกอัตโนมัติ
  document.addEventListener('paste', async (e) => {
    const t = state.active;
    // [alpha.97 ข้อ 7] บทภาพยนตร์ก็แทรกรูปได้ (SPEditor มี insertImage มาตั้งแต่ .24)
    // เดิมเช็ค `!t?.editor` จึงตัดแท็บบททิ้งตั้งแต่บรรทัดแรก ทั้งที่ importImageFile รองรับอยู่แล้ว
    if (!t || !(t.editor || t.sp) || !state.root) return;
    const imgs = clipboardImages(e.clipboardData);
    if (!imgs.length) return;
    e.preventDefault();
    for (const f of imgs) await importImageFile(f, t);
  });
  const paneHost = $('#panes') || document.body;
  paneHost.addEventListener('dragover', (e) => {
    if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault();
  });
  paneHost.addEventListener('drop', async (e) => {
    const t = state.active;
    if (!t || !(t.editor || t.sp) || !state.root) return;      // [alpha.97 ข้อ 7] บทหนังด้วย
    const imgs = clipboardImages(e.dataTransfer);
    if (!imgs.length) return;
    e.preventDefault();
    for (const f of imgs) await importImageFile(f, t);
  });
  $('#find-q').addEventListener('input', doFind);
  $('#find-q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') gotoMatch(state.active?.editor?.view, e.shiftKey ? -1 : 1);
    if (e.key === 'Escape') closeFind();
  });
  $('#find-next').onclick = () => gotoMatch(state.active?.editor?.view, 1);
  $('#find-prev').onclick = () => gotoMatch(state.active?.editor?.view, -1);
  $('#find-close').onclick = closeFind;
  // [alpha.164 · บั๊ก] ฉากล็อก = แทนที่ไม่ได้ (บอกเหตุผล) · ไม่ได้แทนที่อะไร = ไม่ทำเครื่องหมายว่าแก้แล้ว
  const findLocked = () => {
    const tb = state.active;
    if (!(tb && tb.editor && tb.editor.view && tb.editor.view.editable === false)) return false;
    setStatus(gi('lock') + ' ' + (tb.locked ? TA.lockMessage('scene') : tt('ui.onset.nowOriginal')));
    return true;
  };
  $('#find-rep1').onclick = () => { if (findLocked()) return;
                                    if (replaceCurrent(state.active?.editor?.view, $('#find-r').value)) markDirty(state.active);
                                    doFind(); };
  $('#find-repall').onclick = () => { if (findLocked()) return;
                                      const n = replaceAll(state.active?.editor?.view, $('#find-r').value);
                                      setStatus(ttf('ui.app.replaceF', n)); if (n) markDirty(state.active); doFind(); };
  // [alpha.82] ติดตั้งตัววัดความกว้างข้อความ — **ต้องอยู่ก่อนทุกทางแยก**
  // ทุกอย่างที่นับบรรทัด/นับหน้าอ่านผ่านตัวนี้ · เคยวางไว้ใน bootSequence() แล้วพบว่า
  // โหมดเทส (`?k2test`) กับหน้าต่างแผงที่ฉีกออกมา **ไม่เดินผ่าน bootSequence เลย**
  // → ตกไปใช้กริด 10 ตัว/นิ้วเงียบ ๆ ทั้งที่โค้ดดูเหมือนติดตั้งแล้ว
  // ติดตั้งไม่สำเร็จ (ไม่มี canvas) = ตกไปใช้ heuristic ของ text-width.js เอง ไม่พัง
  installTextMeasurer();
  // [alpha.143 ข้อ 1] ★ ตัวดักรูปโหลดเสร็จก็ต้องอยู่ "ก่อนทุกทางแยก" ด้วยเหตุผลเดียวกัน —
  // วางไว้ใน bootSequence() รอบแรกแล้วเทสจับได้ทันทีว่าโหมดเทสไม่เคยติดตั้งมันเลย
  watchDocImages();
  // [alpha.161 · C3] ลบ/ย้าย/ทำสำเนา/สร้างไฟล์ = ดัชนีค้นหาล้างเอง (ติดตั้งก่อนทุกทางแยก เหตุผลเดียวกับบรรทัดบน)
  watchProjectWrites();
  // [alpha.67] หน้าต่างแผงที่ฉีกออกมามีลำดับเริ่มของตัวเอง (และไม่มี autosave — ไม่ได้ถือเอกสาร)
  if (PANEL_WIN) { bootPanelWindow(); return; }
  bindMainWindowSync();
  // [alpha.156] กลับมาที่หน้าต่าง = ไฟล์อาจถูกแก้ในโปรแกรมอื่นระหว่างนั้น
  window.addEventListener('focus', () => { checkTabsAgainstDisk().catch(() => {}); });
  if (!location.search.includes('k2test')) bootSequence();
  // autosave ตั้งค่าได้ผ่านตั้งค่าโปรเจกต์ (restartAutosave เรียกจาก applySettings เมื่อเปิดโปรเจกต์)
  restartAutosave();
});

// ---------------- FAB (ปุ่มลอยสร้างใหม่) ----------------
// ---------------- เลือกปลายทาง เล่ม → ฉบับร่าง → บท (ข้อ 9) ----------------
// เดิม FAB ยัดของลง sections[0]/drafts[0]/chapters[0] เสมอ — โปรเจกต์ที่มีหลายเล่มจึงสร้างผิดที่
// ค่าเริ่มต้นของกล่องนี้ = บริบทที่ผู้ใช้เปิดอยู่ (ถ้ามี) ไม่งั้น = อันแรก
// needChapter=false → ใช้เลือกปลายทางของ "บทใหม่" (พอถึงระดับฉบับร่าง)
async function pickDraftTarget({ needChapter = true, title = tt('ui.app.new2') } = {}) {
  const sections = await listSections();
  if (!sections.length) { setStatus(tt('ui.app.notHasBookNew')); return null; }

  // อ่านฉบับร่างของแต่ละเล่มไว้ล่วงหน้า (โปรเจกต์ใหญ่สุดก็ยังเป็นสิบ ๆ รายการ ไม่หนัก)
  const tree = [];
  for (const s of sections) {
    const dr = await kapi.join(s.secPath, 'Draft');
    if (!(await kapi.exists(dr))) continue;
    const drafts = [];
    for (const dn of await kapi.listDirs(dr)) {
      const dPath = await kapi.join(dr, dn);
      let chapters = [];
      try {
        chapters = ((await kapi.readJson(await kapi.join(dPath, 'draft.json'))).chapters || [])
          .slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      } catch {}
      drafts.push({ name: dn, dPath, chapters });
    }
    if (drafts.length) tree.push({ ...s, drafts });
  }
  if (!tree.length) { setStatus(tt('ui.app.notHasDraftNew')); return null; }

  const ctx = await sceneCtx();                   // ฉากที่เปิดอยู่ = ค่าเริ่มต้นที่ตรงใจที่สุด
  let si = 0, di = 0, ci = 0;
  if (ctx) outer: for (let a = 0; a < tree.length; a++)
    for (let b = 0; b < tree[a].drafts.length; b++)
      if (tree[a].drafts[b].dPath === ctx.dPath) {
        si = a; di = b;
        const k = tree[a].drafts[b].chapters.findIndex((c) => c.guid === ctx.ch.guid);
        ci = k < 0 ? 0 : k;
        break outer;
      }

  return new Promise((resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog');
    box.append(el('div', 'k-dlg-title', title));
    const mkRow = (label) => { const r = el('div', 'wiki-row'); r.append(el('label', null, label));
      const s = el('select', 'wiki-input k-dlg-select'); r.append(s); box.append(r); return s; };
    const selSec = mkRow(tt('ui.common.book'));
    const selDraft = mkRow(tt('ui.app.draft'));
    const selCh = needChapter ? mkRow(tt('ui.common.chapter')) : null;
    const fill = (sel, items, cur) => {
      sel.replaceChildren();
      items.forEach((txt, i) => { const o = el('option', null, txt); o.value = String(i); sel.append(o); });
      sel.value = String(Math.min(cur, Math.max(0, items.length - 1)));
    };
    const syncCh = () => {
      if (!selCh) return;
      const chs = tree[+selSec.value].drafts[+selDraft.value].chapters;
      fill(selCh, chs.length ? chs.map((c) => c.title || tt('ui.common.notNamed')) : [tt('ui.app.notHasChapter')], ci);
      selCh.disabled = !chs.length;
    };
    const syncDraft = () => {
      fill(selDraft, tree[+selSec.value].drafts.map((d) => d.name), di);
      syncCh();
    };
    fill(selSec, tree.map((s) => s.title), si);
    syncDraft();
    selSec.onchange = () => { di = 0; ci = 0; syncDraft(); };
    selDraft.onchange = () => { ci = 0; syncCh(); };

    const btns = el('div', 'k-dlg-btns');
    const cB = el('button', 'k-cancel', tt('ui.common.cancel'));
    const okB = el('button', 'k-ok', tt('ui.common.msg3'));
    btns.append(cB, okB); box.append(btns); ov.append(box); document.body.append(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    cB.onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    okB.onclick = () => {
      const dr = tree[+selSec.value].drafts[+selDraft.value];
      if (needChapter) {
        const ch = dr.chapters[+selCh.value];
        if (!ch) { setStatus(tt('ui.app.draftNotHasChapter')); return; }
        done({ dPath: dr.dPath, chapter: ch });
      } else done({ dPath: dr.dPath, chapter: null });
    };
    okB.focus();
  });
}

// ══════════════════ [alpha.111] ปุ่มลอย (FAB) — ย้ายได้ · เลือกคำสั่งเองได้ · เมนูวงกลม ══════════════════
//
// ผู้ใช้ขอ 3 อย่างพร้อมกัน:
//   1. คลิกขวาแล้วลากย้ายได้ + จำตำแหน่ง       → ปุ่มขวาค้างแล้วลาก · เก็บลง `k2-ui-layout.fab`
//   2. เพิ่ม/ลบคำสั่งได้ สูงสุด 4 + เลือกว่าจะโชว์ไอคอน/ข้อความ  → `src/toolbar/fab-config.js`
//   3. เมนูโผล่แบบ radial (Material) พร้อมหน่วงไล่ทีละตัว        → `fabRadialPositions()`
//
// **ทำไมคลิกขวาถึงทำได้ทั้ง "ลาก" และ "เปิดเมนู"**: ตัดสินตอนปล่อยปุ่ม —
// ขยับเกิน 4px = ถือว่าลาก (ไม่เด้งเมนู) · ไม่ขยับ = เมนูคำสั่งลัดของปุ่มเอง
// (`makeDraggable` ใช้ไม่ได้ตรง ๆ เพราะมันผูกปุ่มซ้าย ซึ่งที่นี่สงวนไว้ให้ "เปิดเมนูวงกลม")

/** ระยะที่ถือว่า "ขยับแล้ว" ระหว่างลากด้วยปุ่มขวา */
const FAB_DRAG_SLOP = 4;
/** หน่วงต่อปุ่มลูกหนึ่งตัว (ms) — ตรงกับ CSS `--fab-dur` */
const FAB_STAGGER = 45;

let fabOpen = false;

/** ค่าตั้งค่าปัจจุบันของ FAB (ผ่านตัวทำให้เป็นมาตรฐานเสมอ) */
function fabCfg() { return normalizeFab(state.settings && state.settings.fab); }

/** ตำแหน่งบนจอของปุ่มแม่ (สัมพัทธ์กับหน้าต่าง) */
function fabPos() {
  const fab = $('#k-fab');
  if (!fab) return { left: 0, top: 0 };
  const r = fab.getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top) };
}

/** ย้ายปุ่มแม่ไปตำแหน่งที่กำหนด (พิกัดหน้าต่าง) */
function setFabPos(pos) {
  const fab = $('#k-fab');
  if (!fab) return;
  fab.style.left = pos.left + 'px';
  fab.style.top = pos.top + 'px';
  fab.style.right = 'auto';
  fab.style.bottom = 'auto';
}

/** เอาตำแหน่งที่จำไว้มาใช้ (หนีบให้อยู่ในจอเสมอ — จอเล็กลงกว่าตอนบันทึกก็ยังเห็น) */
export function restoreFabPos() {
  const fab = $('#k-fab');
  if (!fab) return false;
  const saved = uiLayout().fab;
  // `{}` ที่หลงเหลือจากการรีเซ็ตต้องไม่ถูกอ่านเป็น "มุมซ้ายบน" (บทเรียนข้อ 5: 0 เป็น falsy)
  if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return false;
  const r = fab.getBoundingClientRect();
  setFabPos(clampFabPos(saved, r, window.innerWidth, window.innerHeight));
  return true;
}

/** คืนปุ่มกลับมุมขวาล่างตามค่าเริ่มต้น */
function resetFabPos() {
  const fab = $('#k-fab');
  if (!fab) return;
  fab.style.left = ''; fab.style.top = ''; fab.style.right = ''; fab.style.bottom = '';
  const l = uiLayout(); delete l.fab;
  localStorage.setItem('k2-ui-layout', JSON.stringify(l));
  // บอกเซสชันด้วย ไม่งั้นไฟล์เซสชันเก่าจะยัดตำแหน่งเดิมกลับมาตอนเปิดใหม่ (บทเรียน alpha.93 ข้อ 2)
  try { localStorage.setItem(LS_TS_KEY, String(Date.now())); } catch {}
  markSessionDirty();
  closeFabMenu(true);
}

/**
 * วาดปุ่มลูกใหม่ทั้งชุดตามที่ผู้ใช้ตั้งไว้
 * เรียกตอนเริ่มโปรแกรม · ตอนเปลี่ยนภาษา · และทุกครั้งที่กล่องตั้งค่าบันทึก
 */
export function renderFabMenu() {
  const menu = $('#k-fab-menu');
  if (!menu) return 0;
  const cfg = fabCfg();
  menu.replaceChildren();
  menu.classList.add('k-fab-radial');
  menu.dataset.disp = cfg.display;
  for (const a of fabMenuItems(cfg)) {
    const it = el('div', 'k-fab-item');
    it.dataset.action = a.id;
    it.setAttribute('role', 'menuitem');               // [alpha.162 · W5 ข้อ 3]
    it.tabIndex = -1;
    // [alpha.147] ไอคอน + คีย์ลัดมาจากทะเบียนคำสั่ง (icons/commands.csv) — FAB_ACTIONS ไม่เก็บไอคอนเองแล้ว
    const cid = [a.cmd, ...(a.args || [])].join(':');
    const icName = commandIcon(cid);
    it.dataset.cmd = cid;
    it.title = withCommandShortcut(tt(a.labelKey), cid);
    it.setAttribute('aria-label', tt(a.labelKey));
    if (cfg.display !== 'text' && icName) {
      const ic = el('span', 'k-fab-item-ic');
      ic.innerHTML = iconHtml(icName, 18);
      it.append(ic);
    }
    // ช่อง icon ว่าง (ผู้ใช้ตั้งใจไม่ให้มี) ในโหมด "ไอคอนล้วน" → ต้องโชว์ข้อความแทน ไม่งั้นได้ปุ่มว่างเปล่า
    if (cfg.display !== 'icon' || !icName) it.append(el('span', 'k-fab-item-tx', tt(a.labelKey)));
    it.onclick = (e) => {
      e.stopPropagation();
      closeFabMenu();
      runFabAction(a.id);
    };
    menu.append(it);
  }
  if (fabOpen) layoutFabMenu(false);
  return menu.children.length;
}

/** สั่งงานคำสั่งของ FAB — ทุกตัวชี้ไปที่ช่องคำสั่งเดิมของโปรแกรม ไม่มีตรรกะซ้อน */
export function runFabAction(id) {
  const a = fabAction(id);
  if (!a) return false;
  handleCommand(a.cmd, ...(a.args || []));
  return true;
}

/**
 * วางปุ่มลูกตามเรขาคณิตวงกลม
 * @param {boolean} closing true = ยุบกลับ (ไล่หน่วงกลับทาง)
 */
function layoutFabMenu(closing) {
  const fab = $('#k-fab'), menu = $('#k-fab-menu');
  if (!fab || !menu) return;
  const items = [...menu.children];
  const n = items.length;
  const r = fab.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const dir = fabOpenDir(cx, cy, window.innerWidth, window.innerHeight);
  // เมนูเป็น "จุด" ที่กึ่งกลางปุ่มแม่ — ปุ่มลูกกางออกจากจุดนี้ด้วย transform ล้วน ๆ
  menu.style.left = cx + 'px';
  menu.style.top = cy + 'px';
  // ไอคอนล้วน = กางเป็นวงกลม · มีข้อความ = แถวตั้ง (ดูเหตุผลใน fabStackPositions)
  const pill = menu.dataset.disp !== 'icon';
  const pos = pill
    ? fabStackPositions(n, { item: 42, gap: 10, offset: 62,
                             dirY: dir.dirY, stagger: FAB_STAGGER, closing: !!closing })
    : fabRadialPositions(n, {
        radius: fabRadius(n, 48, 16, 90, 96), dirX: dir.dirX, dirY: dir.dirY,
        spread: 90, start: 0, stagger: FAB_STAGGER, closing: !!closing,
      });
  items.forEach((it, i) => {
    const p = pos[i] || { x: 0, y: 0, delay: 0 };
    // ปุ่มไอคอนล้วน = จับที่จุดกึ่งกลาง · ปุ่มมีข้อความ = จับที่ "ขอบด้านใน"
    // (ด้านที่หันเข้าหาปุ่มแม่) ไม่งั้นป้ายยาว ๆ จะยื่นเลยขอบจอทันทีที่ปุ่มอยู่ริม
    const ax = pill ? (dir.dirX < 0 ? '-100%' : '0%') : '-50%';
    it.style.setProperty('--fab-x', p.x + 'px');
    it.style.setProperty('--fab-y', p.y + 'px');
    it.style.setProperty('--fab-ax', ax);
    it.style.transitionDelay = p.delay + 'ms';
  });
  menu.classList.toggle('k-fab-left', dir.dirX < 0);
}

/** เปิดเมนูวงกลม */
function openFabMenu() {
  const fab = $('#k-fab'), menu = $('#k-fab-menu');
  if (!fab || !menu || !menu.children.length) return false;
  clearTimeout(menu._hideJob);
  fabOpen = true;
  menu.classList.remove('k-menu-off');
  layoutFabMenu(false);
  // บังคับให้เบราว์เซอร์อ่านค่าเริ่มต้นก่อน แล้วค่อยติดคลาส `open` — ไม่งั้นไม่มีอนิเมชัน
  void menu.offsetWidth;
  menu.classList.add('open');
  fab.classList.add('open');
  fab.setAttribute('aria-expanded', 'true');         // [alpha.162 · W5 ข้อ 3]
  return true;
}

/**
 * ปิดเมนูวงกลม
 * @param {boolean} [instant] ปิดทันทีไม่ต้องมีอนิเมชัน (ระหว่างลากย้ายปุ่ม)
 */
function closeFabMenu(instant) {
  const fab = $('#k-fab'), menu = $('#k-fab-menu');
  if (!fab || !menu) return;
  fabOpen = false;
  fab.classList.remove('open');
  fab.setAttribute('aria-expanded', 'false');        // [alpha.162 · W5 ข้อ 3]
  menu.classList.remove('open');
  clearTimeout(menu._hideJob);
  if (instant) { menu.classList.add('k-menu-off'); return; }
  layoutFabMenu(true);                                  // ยุบกลับไล่จากตัวไกลสุดเข้ามา
  // ซ่อนจริงหลังยุบเสร็จ — ไม่งั้นปุ่มลูกที่ opacity:0 ยังกินคลิกอยู่
  menu._hideJob = setTimeout(() => menu.classList.add('k-menu-off'),
                             fabAnimMs(menu.children.length, FAB_STAGGER));
}

/** สวิตช์เปิด/ปิด — ใช้ทั้งจากการคลิกและจากเทส */
export function toggleFabMenu(on) {
  const want = on === undefined ? !fabOpen : !!on;
  if (want) openFabMenu(); else closeFabMenu();
  return fabOpen;
}

/**
 * [alpha.162 · W5 ข้อ 3] ปุ่มลอยใช้ด้วยคีย์บอร์ดได้ — เดิมเป็น `div` ที่คลิกได้อย่างเดียว (Tab ข้าม ·
 * โปรแกรมอ่านหน้าจอไม่รู้ว่าเป็นปุ่ม) และทางเดียวไปเมนู "ย้าย/ตั้งค่า/ซ่อน" คือคลิกขวา (ซึ่งเป็นการลากด้วย)
 *   Enter/Space = เปิด-ปิด · ↑↓ = เดินในปุ่มลูก · Esc = ปิดแล้วโฟกัสกลับปุ่มแม่
 *   Shift+F10 / ปุ่ม Menu = เมนูคลิกขวาของปุ่มลอย (ทางคีย์บอร์ดของการคลิกขวา)
 */
export function wireFabKeyboard(fab, menu) {
  if (!fab || fab._k2kbd) return false;
  fab._k2kbd = true;
  fab.setAttribute('role', 'button');
  fab.setAttribute('aria-haspopup', 'menu');
  fab.setAttribute('aria-expanded', fabOpen ? 'true' : 'false');
  // ชื่อที่อ่านออกเสียง = title ซึ่งระบบภาษาเติมให้ตามภาษาปัจจุบัน (ไม่คัดลอกไป aria-label — ค้างภาษาเก่า)
  fab.tabIndex = 0;
  menu.setAttribute('role', 'menu');
  const items = () => [...menu.querySelectorAll('.k-fab-item')];
  const step = (dir) => {
    const list = items();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const j = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
    list[j].focus();
  };
  fab.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const open = toggleFabMenu();
      if (open) setTimeout(() => step(1), 0);
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && fabOpen) {
      e.preventDefault(); step(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Escape' && fabOpen) {
      e.preventDefault(); closeFabMenu();
    } else if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
      e.preventDefault();
      const r = fab.getBoundingClientRect();
      popupMenu(r.left, r.top, fabContextItems({
        onReset: () => { resetFabPos(); setStatus(tt('ui.fab.posReset')); },
        onConfig: () => settingsDialog('fab'),
        onHide: () => handleCommand('toggle-fab'),
      }));
    }
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement && document.activeElement.classList.contains('k-fab-item')) {
        e.preventDefault(); document.activeElement.click();
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault(); closeFabMenu(); fab.focus();
    }
  });
  return true;
}

function wireFab() {
  const fab = $('#k-fab');
  const fabMenu = $('#k-fab-menu');
  if (!fab || !fabMenu) return;
  renderFabMenu();
  restoreFabPos();

  fab.onclick = () => { toggleFabMenu(); };
  wireFabKeyboard(fab, fabMenu);                        // [alpha.162 · W5 ข้อ 3]

  // ── คลิกขวา = ลากย้าย (หรือเมนูคำสั่งลัด ถ้าไม่ได้ขยับ) ──
  fab.addEventListener('contextmenu', (e) => e.preventDefault());
  fab.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    e.preventDefault(); e.stopPropagation();
    const r = fab.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = r.left, oy = r.top;
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > FAB_DRAG_SLOP) {
        moved = true;
        closeFabMenu(true);
        fab.classList.add('k-dragging');
      }
      if (!moved) return;
      setFabPos(clampFabPos({ left: ox + (ev.clientX - sx), top: oy + (ev.clientY - sy) },
                            r, window.innerWidth, window.innerHeight));
    };
    const up = (ev) => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      fab.classList.remove('k-dragging');
      if (moved) {
        saveUiLayout('fab', fabPos());
        setStatus(tt('ui.fab.posSaved'));
      } else {
        popupMenu(ev.clientX, ev.clientY, fabContextItems({
          onReset: () => { resetFabPos(); setStatus(tt('ui.fab.posReset')); },
          onConfig: () => settingsDialog('fab'),
          onHide: () => handleCommand('toggle-fab'),
        }));
      }
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  // จอเปลี่ยนขนาด → ดึงปุ่มกลับเข้าจอ แล้ววางเมนูใหม่ตามทิศที่ถูกต้อง
  window.addEventListener('resize', () => {
    restoreFabPos();
    if (fabOpen) layoutFabMenu(false);
  });

  // คลิกข้างนอก = ปิด
  document.addEventListener('click', (e) => {
    if (fabOpen && !fab.contains(e.target) && !fabMenu.contains(e.target)) closeFabMenu();
  });
}

// ---------------- Filter Bar (แถบกรองสถานะ/แท็ก) ----------------
async function buildFilterBar() {
  const statusesEl = $('#filter-statuses');
  const tagsEl = $('#filter-tags');
  if (!statusesEl || !tagsEl) return;
  
  statusesEl.innerHTML = '';
  tagsEl.innerHTML = '';
  
  if (!state.root) return;
  
  // [alpha.161 · P4] ชิปที่ติดอยู่ในคิวรีปัจจุบัน (วาดแถบใหม่ = ชิปต้องไม่หลุดสถานะ "on")
  const inQuery = parseChipQuery(($('#tree-search') || {}).value || '');
  // ปุ่มสถานะ — [alpha.159 · H9] แหล่งเดียว allStatuses() (ลำดับ/ซ่อน/สถานะที่ผู้ใช้สร้างเอง)
  // เดิมวน SCENE_STATUSES ตายตัว → สถานะที่สร้างจาก Kanban/กล่องจัดการสถานะกรองไม่ได้เลย
  for (const st of allStatuses()) {
    const chip = el('span', 'filter-chip', dataLabel(st));
    chip.dataset.status = st;                       // ค่าจริงเก็บใน dataset — ตัวกรองต้องใช้ค่าไทยเสมอ
    if (inQuery.status.includes(st)) chip.classList.add('on');
    chip.onclick = () => {
      chip.classList.toggle('on');
      const q = $('#tree-search');
      // [alpha.120 ข้อ 4] ค่าจริงอยู่ใน dataset — `textContent` เป็นป้ายที่ **แปลแล้ว**
      // ภาษาอังกฤษจึงสร้างคิวรีเป็น `status:Writing` ซึ่งไม่มีทางตรงกับค่าไทยในไฟล์งาน
      const active = [...statusesEl.querySelectorAll('.filter-chip.on')].map((c) => c.dataset.status || c.textContent);
      // [alpha.161 · P4] ★ แก้เฉพาะเงื่อนไข status: ในคิวรี — เดิม `q.value = …` ทับทั้งช่อง (คำที่พิมพ์ค้นไว้หาย)
      q.value = setChipClause(q.value, 'status', active);
      q.dispatchEvent(new Event('input', { bubbles: true }));
    };
    statusesEl.append(chip);
  }
  
  // แท็กยอดนิยม (top 8)
  try {
    const counts = {};
    for (const sec of await listSections()) {
      const dr = await kapi.join(sec.secPath, 'Draft');
      if (!(await kapi.exists(dr))) continue;
      for (const dn of await kapi.listDirs(dr)) {
        const dp = await kapi.join(dr, dn);
        const sf = await kapi.join(dp, 'scenes.json');
        if (!(await kapi.exists(sf))) continue;
        const d = await kapi.readJson(sf);
        const chs = d.chapters || {};
        for (const cg of Object.keys(chs)) {
          for (const sc of (chs[cg] || [])) {
            for (const t of (sc.tags || [])) {
              if (t) counts[t] = (counts[t] || 0) + 1;
            }
          }
        }
      }
    }
    const topTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [tag, cnt] of topTags) {
      const chip = el('span', 'filter-tag-chip', tag + ' (' + cnt + ')');
      // แท็กที่ตั้งสี/ไอคอนไว้ → ชิปตัวกรองใช้สีเดียวกับใน Explorer (ข้อ 84)
      // ชื่อแท็กจริงเก็บใน dataset — ไอคอนที่เติมข้างหน้าจะได้ไม่ปนเข้าไปในคิวรี
      chip.dataset.tag = tag;
      applyVisualTagStyle(chip, tag, { withIcon: false });
      const vt = visualTagFor(tag);
      if (vt && vt.icon) chip.textContent = vt.icon + ' ' + chip.textContent;
      if (inQuery.tag.includes(tag)) chip.classList.add('on');
      chip.onclick = () => {
        chip.classList.toggle('on');
        const q = $('#tree-search');
        const active = [...tagsEl.querySelectorAll('.filter-tag-chip.on')]
          .map((c) => c.dataset.tag || c.textContent.replace(/\s*\(\d+\)/, ''));
        // [alpha.161 · P4] แก้เฉพาะเงื่อนไข tag: (สถานะ/คำค้นที่มีอยู่ไม่ถูกแตะ)
        q.value = setChipClause(q.value, 'tag', active);
        q.dispatchEvent(new Event('input', { bubbles: true }));
      };
      tagsEl.append(chip);
    }
  } catch {}
}

// ---------------- Progress Bar (แถบความคืบหน้า) ----------------
// ══ [alpha.162 · W5 ข้อ 5] ★ แถบเป้ารายวัน = คำที่เขียน "วันนี้" จริง ══
// เดิมใช้ "จำนวนคำรวมของทุกแท็บที่เปิดอยู่" — เปิดฉากยาวฉากเดียวก็เต็มเป้าวันนี้ทั้งที่ยังไม่ได้พิมพ์
// สักคำ (และนับเนื้อหาทุกแท็บใหม่ทั้งหมด **ทุกตัวอักษรที่พิมพ์**) · ตอนนี้อ่านจากประวัติคำรายวัน
// ตัวเดียวกับแดชบอร์ด (`wordsWrittenToday` · จดหลังทุกการบันทึก) — สองที่จึงบอกเลขเดียวกันเสมอ
export function updateProgressBar() {
  if (!state.root || !state.goals) return null;
  const daily = state.goals.dailyWords || DEFAULT_GOALS.dailyWords;
  const today = wordsWrittenToday(getWordHistory());
  const pctDaily = Math.min(100, Math.round((today / daily) * 100));
  const fill = $('#prog-fill');
  const wrap = $('#prog-wrap');
  if (fill) fill.style.width = pctDaily + '%';
  if (wrap) wrap.title = ttf('ui.app.goalWord', fmtNum(today), fmtNum(daily), pctDaily)
    + ' · ' + tt('ui.app.goalFromSaves');
  return { today, daily, pct: pctDaily };
}

// ---------------- Status Bar extras (จำนวนฉาก/สถานะ/โหมด) ----------------
function updateStatusExtras() {
  if (!state.root) return;
  
  // นับจำนวนฉากในโปรเจกต์
  const updateSceneCount = async () => {
    let total = 0;
    try {
      for (const sec of await listSections()) {
        const dr = await kapi.join(sec.secPath, 'Draft');
        if (!(await kapi.exists(dr))) continue;
        for (const dn of await kapi.listDirs(dr)) {
          const dp = await kapi.join(dr, dn);
          const sf = await kapi.join(dp, 'scenes.json');
          if (!(await kapi.exists(sf))) continue;
          const d = await kapi.readJson(sf);
          const chs = d.chapters || {};
          for (const cg of Object.keys(chs)) {
            total += (chs[cg] || []).filter((s) => s.type !== 'memo').length;
          }
        }
      }
    } catch {}
    const el = $('#status-scenes');
    if (el) el.innerHTML = iconHtml('file', 14) + ' ' + total + tt('ui.common.scene');
  };
  updateSceneCount();
  
  updateSaveStatus();
  updateProgressBar();
}

/**
 * [alpha.124 ข้อ 40] ส่วน "เบา" ของแถบสถานะ: โหมดเอกสาร + สถานะบันทึก
 *
 * แยกออกจาก `updateStatusExtras()` เพราะตัวนั้นสแกน `scenes.json` **ทุกฉบับร่างในโปรเจกต์**
 * เพื่อนับจำนวนฉาก — งานแบบนั้นเรียกตอนเปิดโปรเจกต์/สลับแท็บได้ แต่จะเรียกทุกครั้งที่กด
 * Ctrl+S หรือทุกครั้งที่เริ่มพิมพ์ไม่ได้ · ส่วนนี้อ่านจาก `state.active` ล้วน ๆ จึงถูกมาก
 */
export function updateSaveStatus() {
  const tab = state.active;
  const modeEl = $('#status-mode');
  if (modeEl) {
    modeEl.replaceChildren();
    if (tab?.sp) modeEl.append(icon('film', 14), tt('ui.app.chapterFilm'));
    else if (tab?.editor) modeEl.append(icon('book', 14), tt('ui.app.novel'));
  }
  const saveEl = $('#status-save');
  if (!saveEl) return;
  // [alpha.166] จองที่ของสภาพที่ยาวที่สุด ("ยังไม่บันทึก") ไว้เสมอ — บันทึกแล้ว ↔ ยังไม่บันทึก สลับกันไม่ดันช่องอื่น
  if (tab) reserveStatusWidth(saveEl, [tt('ui.app.notSave'), '00:00 00'], 16);
  saveEl.replaceChildren();
  saveEl.title = tt('ui.sb.saveTip');               // [alpha.165] ทูลทิปบอกความหมายเสมอ (ไม่ว่าสภาพไหน)
  if (!tab) { saveEl.style.color = ''; return; }
  if (tab.dirty) {
    saveEl.textContent = tt('ui.app.notSave');
    saveEl.style.color = 'var(--orange)';
    saveEl.title = tt('ui.sb.unsaved');
    return;
  }
  const mod = tab.meta?.modified || '';
  saveEl.append(icon('save', 12));
  if (mod) {
    const d = new Date(mod);
    if (!isNaN(d)) {
      saveEl.append(' ' + fmtTime(d, { hour: '2-digit', minute: '2-digit' }));
      saveEl.title = ttf('ui.sb.savedAt', fmtDateTime(d));
    }
  }
  saveEl.style.color = '';
}

// เรียกหลัง buildTree, activate, saveTab, ฯลฯ
// ผูกเข้าไปใน activate และ saveTab (เรียบร้อยแล้วผ่าน refreshToolbar/scheduleCount)
// เราจะเรียก updateStatusExtras ใน activate ด้วย
const origActivate2 = activate;
// ใช้ monkey-patch แบบง่าย — เพิ่มที่ท้าย activate
const _origActivate = activate;
// (ใช้ wrapper ใน scheduleCount แทน)

function refreshStatusBar() {
  updateStatusExtras();
  updateProgressBar();
  updateDirtyBadge();
  updateSummaryBar();
}

// ---------------- Summary Bar (ข้อ 46) — แสดงสรุปด่วนเหนือ tree ----------------
/**
 * [alpha.121] สถิติรวมทั้งโปรเจกต์ — แยกออกจาก `updateSummaryBar()` เพื่อให้
 * ตัวสร้างบริบทของโค้ดสั้น (`liveShortcodeContext()`) เรียกใช้ตัวเดียวกัน ไม่ต้องนับเลขซ้ำสองชุด
 * ที่เสี่ยงเบี่ยงกันทีหลัง (แถบสรุปนับแบบหนึ่ง shortcode นับอีกแบบ)
 */
export async function computeProjectStats() {
  const out = { totalScenes: 0, totalWords: 0, totalChapters: 0, totalBooks: 0,
                totalCharacters: 0, totalLocations: 0,
                dailyGoal: state.goals?.dailyWords || DEFAULT_GOALS.dailyWords,
                projectGoal: state.goals?.projectWords || DEFAULT_GOALS.projectWords };
  if (!state.root) return out;
  try {
    const sections = await listSections();
    out.totalBooks = sections.length;
    for (const sec of sections) {
      const dr = await kapi.join(sec.secPath, 'Draft');
      if (!(await kapi.exists(dr))) continue;
      for (const dn of await kapi.listDirs(dr)) {
        const dp = await kapi.join(dr, dn);
        const df = await kapi.join(dp, 'draft.json');
        if (await kapi.exists(df)) out.totalChapters += ((await kapi.readJson(df)).chapters || []).length;
        const sf = await kapi.join(dp, 'scenes.json');
        if (!(await kapi.exists(sf))) continue;
        const d = await kapi.readJson(sf);
        for (const cg of Object.keys(d.chapters || {})) {
          for (const sc of (d.chapters[cg] || [])) {
            if (sc.type === 'memo') continue;
            out.totalScenes++; out.totalWords += sc.wordCount || 0;
          }
        }
      }
    }
    for (const wbase of ['Wiki', 'Bible']) {
      const wr = await kapi.join(state.root, wbase);
      if (!(await kapi.exists(wr))) continue;
      const charsDir = await kapi.join(wr, 'characters');
      if (await kapi.exists(charsDir)) out.totalCharacters = (await kapi.listFiles(charsDir, '.json')).length;
      const locsDir = await kapi.join(wr, 'locations');
      if (await kapi.exists(locsDir)) out.totalLocations = (await kapi.listFiles(locsDir, '.json')).length;
    }
  } catch (e) { log('warn', tt('ui.shortcode.statsScanFail'), e); }
  return out;
}

async function updateSummaryBar() {
  const bar = $('#summary-bar');
  if (!bar || !state.root) return;
  // [alpha.120 ข้อ 15] ปิดไว้เป็นค่าเริ่มต้น — แดชบอร์ดทำหน้าที่นี้ครบกว่าและตัวเลขตรงกว่า
  // (โค้ดคงไว้ทั้งหมด เปิดกลับได้จากเมนูคลิกขวาพื้นที่ว่างใน Explorer)
  if (!summaryBarOn()) { bar.style.display = 'none'; bar.replaceChildren(); return; }
  bar.style.display = '';

  try {
    const s = await computeProjectStats();
    const pct = s.projectGoal ? Math.min(100, Math.round((s.totalWords / s.projectGoal) * 100)) : 0;

    bar.innerHTML = '';
    const items = [
      gi('file') + ` ${s.totalScenes} ${t('scenes')}`,
      gi('note') + ` ${fmtNum(s.totalWords)} ${t('words')}`,
      gi('user') + ` ${s.totalCharacters} ${t('characters')}`,
      gi('map-pin') + ` ${s.totalLocations} ${t('locations')}`,
      gi('chart') + ` ${pct}% ${t('percentGoal')}`,
    ];
    for (const item of items) {
      const span = el('span', 'sum-item', item);
      bar.append(span);
    }
  } catch {
    bar.innerHTML = '';
  }
}

// ---------------- Shortcuts Cheatsheet (ข้อ 50) — กด ? หรือ Ctrl+Shift+/ ----------------
function showShortcutsDialog() {
  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide k-keys-dlg');
  box.append(el('div', 'k-dlg-title', t('allShortcutsTitle')));

  // [alpha.79] **สร้างจากตาราง SHORTCUTS ทั้งหมด ไม่ใช่รายการที่พิมพ์มือ**
  //
  // ของเดิมพิมพ์ id ไว้เอง 5 หมวด รวม 26 รายการ ขณะที่ตารางจริงมีเกือบ 80 —
  // คีย์ลัดที่เพิ่มทีหลังจึงไม่เคยโผล่ในหน้านี้เลย (และไม่มีใครรู้ตัว)
  // ตอนนี้กวาดจาก effectiveShortcuts() → เห็นค่าที่ผู้ใช้ตั้งเองด้วย และไม่มีทางตกหล่น
  const rows = shortcutSheetRows();
  const byCat = new Map(SHORTCUT_CATS.map((c) => [c.key, []]));
  for (const r of rows) (byCat.get(shortcutCat(r.id)) || byCat.get('other')).push(r);
  // คีย์ลัดที่ไม่ได้อยู่ในตาราง (ดักแยกในโค้ด) — ต้องขึ้นหน้านี้ด้วย ไม่งั้นผู้ใช้ไม่มีทางรู้
  byCat.get('view').push(
    { label: tt('ui.status.zoom') + ' +', accel: formatShortcut('Equal', true, false) },
    { label: tt('ui.status.zoom') + (' ' + gi('minus')), accel: formatShortcut('Minus', true, false) },
    { label: tt('ui.status.zoomReset'), accel: formatShortcut('Digit0', true, true) },
    { label: tt('ui.shortcuts.zoomWheel'), accel: 'Ctrl + ' + tt('ui.shortcuts.wheel') },
  );
  // [alpha.164 · I2] ปุ่มวนชนิด element อ่านจากค่าที่ผูกจริง (`spCycleKeys`) — เดิมพิมพ์ "Tab" ตายตัว
  // ทั้งที่ค่าเริ่มต้นคือ Ctrl+Tab ซึ่งเป็นคีย์เดียวกับสลับแท็บ → บอกทั้งสองฝั่งว่าคีย์นี้มีสองหน้าที่
  const spK = spCycleKeys(state.settings);
  const spOn = state.settings?.spCycleEnabled !== false;
  if (spOn) byCat.get('script').push(
    { id: 'sp-cycle-next', label: tt('ui.shortcuts.spNextElem'), accel: spKeyLabel(spK.tab),
      note: sharesTabKey(spK.tab) ? tt('ui.shortcuts.spCycleNote') : '' },
    { id: 'sp-cycle-prev', label: tt('ui.shortcuts.spPrevElem'), accel: spKeyLabel(spK.shiftTab),
      note: sharesTabKey(spK.shiftTab) ? tt('ui.shortcuts.spCycleNote') : '' },
  );
  byCat.get('script').push(
    { label: tt('ui.shortcuts.spSwitchElem'), accel: 'Ctrl+↑ / Ctrl+↓' },
  );
  if (spOn) for (const r of byCat.get('file') || []) {
    if ((r.id === 'next-tab' && sharesTabKey(spK.tab)) || (r.id === 'prev-tab' && sharesTabKey(spK.shiftTab))) {
      r.note = tt('ui.shortcuts.tabKeyNote');
    }
  }

  const grid = el('div', 'k-keys-grid');
  for (const c of SHORTCUT_CATS) {
    const list = byCat.get(c.key) || [];
    if (!list.length) continue;
    const sec = el('div', 'k-keys-sec');
    sec.append(el('div', 'k-keys-cat', tt(c.labelKey)));
    for (const r of list) {
      const row = el('div', 'k-keys-row');
      if (r.id) row.dataset.id = r.id;
      const name = el('span', 'k-keys-name', r.label);
      if (r.note) { name.append(el('span', 'k-keys-note', r.note)); row.title = r.note; }
      row.append(name);
      row.append(el('span', 'k-keys-key', r.accel));
      sec.append(row);
    }
    grid.append(sec);
  }
  box.append(grid);

  const btns = el('div', 'k-dlg-btns');
  const searchInp = el('input', 'k-dlg-input');
  searchInp.placeholder = t('filterCommands');
  searchInp.style.cssText = 'flex:1;max-width:240px';
  searchInp.oninput = () => {
    const q = searchInp.value.toLowerCase();
    grid.querySelectorAll('.k-keys-row').forEach((r) => {
      r.style.display = q ? (r.textContent.toLowerCase().includes(q) ? '' : 'none') : '';
    });
  };
  const closeB = el('button', 'k-ok k-cancel', t('dialogs.close'));
  btns.append(searchInp, closeB);
  box.append(btns);
  ov.append(box);
  document.body.append(ov);

  closeB.onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', escHandler); }
  });
  searchInp.focus();
}

// ---------------- Scene card: thumbnail + word count + data-status ----------------

// ── [alpha.160] selftest ย้ายไป src/selftest.js (tools/split-selftest.cjs) ──
// ชื่อภายในที่ selftest ต้องใช้ — export ไว้ให้ไฟล์นั้น import (ไม่มีผลกับการทำงานปกติ)
export {
  FEATURE_PANELS, allDirtyList, applyCompare, bindTabStripMenus, buildFilterBar, bumpPageScale,
  clearCompare, clipboardImages, closeAllTabs, closeFind, compareVersionsDialog, compileDraftText,
  createProjectAt, doFind, dockTab, effectiveShortcuts, filterTree, floatBar, floatTab,
  gotoOutlineItem, heavyDelay, hideInactivePanes, hideTip, importImageFile, insertImage,
  knownRoles, lineDiff, loadPlugins, loadSpellDict, moveEntityToCat, moveMemoToChapter,
  moveRowToMemos, navRows, openCompareRight, openFind, openGallery, openNetwork, openPlanner,
  openPropsPanel, openTemplateManager, pageScale, pickDraftTarget, plugins, proseLayoutEpoch,
  proseMeasured, refreshOutline, refreshToolbar, renderLogPanel, renderPropsPanel, repaginateNow,
  repaginateProseNow, resetPageScale, restoreInactivePanes, retunePagePads, saveUiLayout,
  scheduleCount, screenplayTerms, setElementBadge, setNavWholeBook, setPageScale, setPropsTarget,
  setRowMemo, setSceneLock, setTreeScope, setTreeSortMode, showPinInTree, showShortcutsDialog,
  showSourceView, showTip, sortSceneRows, spSmartCheck, switchFormat, templateEditModal,
  toggleFloatTab, toggleFocus, toggleReading, tr, treeSortMode, tuneProsePagePadsLoop, uiLayout,
  updateDirtyBadge, warmInverse,
};
