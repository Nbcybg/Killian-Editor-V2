# AGENTS.md — คู่มือสำหรับ AI agent (opencode ฯลฯ) ที่ทำงานกับ Killian 2

Killian 2 (คิเลียน / K2) — โปรแกรมเขียนนิยาย+บทภาพยนตร์ แบบพกพา
Electron 43 + ProseMirror · Thai-first · เก็บไฟล์เป็น Markdown + JSON (เข้ากับ v1 ได้ 100%)

---

## ⚙️ คำสั่งที่ต้องรู้ (บังคับ)

```bash
node build.js          # bundle src/*.js → renderer/bundle.js (esbuild IIFE) — รันหลังแก้ทุกครั้ง
```

**e2e (ต้องผ่านก่อน commit ทุกครั้ง):**
```bash
ps aux | grep -iE "electron|xvfb" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null; sleep 1
node build.js
node test/fixture.js /tmp/k2proj                       # สร้างโปรเจกต์ทดสอบ
export KILLIAN_TEST=1 KILLIAN_TEST_PROJECT=/tmp/k2proj
xvfb-run -a --server-args="-screen 0 1500x950x24" ./node_modules/.bin/electron . --no-sandbox --disable-gpu
# ผลอยู่ /tmp/k2result.txt — บรรทัดสุดท้ายต้องเป็น "ALL OK"
```
ปัจจุบัน **3,419 checks · ALL OK** (alpha.92) — ห้ามทำให้จำนวนลดลง
(unit `npm run test:unit` = **4,560 ข้อ · 68 ไฟล์** · ~20 วินาที)
**[alpha.92] `test:unit` รันผ่าน `tools/run-unit.cjs`** — หาไฟล์ `test/*.test.{cjs,mjs,js}` เอง
และ **รันให้ครบทุกไฟล์เสมอ** แล้วค่อยสรุปว่าไฟล์ไหนแดง (เดิมเป็นสาย `&&` — แดงตัวเดียว
ตัวที่เหลือไม่ได้รันเลย · เกิดจริงมาแล้วสองครั้ง: i18n-csv ที่ .76 และ export-hub ที่ .88–.91)
เพิ่มไฟล์เทสใหม่ = **ไม่ต้องแก้ package.json** แค่ตั้งชื่อให้ลงท้าย `.test.cjs`
(บน Windows: `node test/fixture.js C:\tmp\k2proj` แล้วตั้ง `KILLIAN_TEST_PROJECT=C:\tmp\k2proj`
 ผลออกที่ `C:\tmp\k2result.txt` · unit test `.cjs` ใช้ `os.tmpdir()` แล้วรันได้ทั้งสองระบบ)

---

## 📁 โครงสร้างไฟล์ (src/)

### แกนกลาง (import จากที่นี่เสมอ)
- **num.js** (alpha.60r1, บริสุทธิ์ 100% ไม่ import อะไรเลย) — `num(v, d)` / `numClamp(v, d, min, max)` / `numInt(v, d)`
  **แหล่งความจริงเดียวของกฎข้อ 20** · โมดูลบริสุทธิ์ import ตรง (`./num.js`) · โมดูลที่แตะ DOM ดึงผ่าน core.js
  (core.js แตะ `window`/`document` ตอน import จึงเอาเข้าโมดูลบริสุทธิ์ไม่ได้)
- **page-break-plugin.js** (alpha.60r1) — `createPageBreakPlugin({key, cls, decoKey})` คืน
  `{setBreaks, breaks, plugin, refresh}` · `sp-format-guide.js` (บท) กับ `prose-view.js` (นิยาย)
  ใช้โรงงานเดียวกันแต่ **สถานะแยกกันคนละชุด** (เปิดบท+นิยายพร้อมกันคนละแท็บได้)
- **scene-meta.js** (alpha.60r2) — **แหล่งความจริงเดียวของคุณสมบัติฉาก**: `readSceneMeta(file,row)` /
  `writeSceneMeta(file,props)` · คุณสมบัติหนัก (`SCENE_HEAVY_KEYS`) อยู่ใน **frontmatter ของ .md**
  · `scenes.json` เหลือเป็น **ดัชนี/แคช** · **ห้ามอ่าน/เขียน synopsis·pov·emotion·conflict·note·tags·
  storyDate·isFlashback·isFlashforward จาก row ตรง ๆ ในโค้ดใหม่** — เรียกสองฟังก์ชันนี้เท่านั้น
- **text-case.js** (alpha.60r2, บริสุทธิ์ 100%) — `applyCase(text,mode)` 7 โหมด + `caseTransform(state,mode)`
  (รับ `state` เข้ามาแล้วใช้แค่ `selection`/`doc.nodesBetween`/`tr`/`schema.text` → **ไม่ import prosemirror**
  จึง unit test ด้วย state ปลอมได้ · โมดูลใหม่ที่ต้องแตะ doc ควรทำแบบนี้)
- **wiki-images.js** (alpha.60r2, บริสุทธิ์) — เมทาดาทารูปของ entity · `migrateImages()` แปลง
  `string[]` เก่า → object ให้อัตโนมัติ · **ทุกที่ที่อ่าน `entity.images` ต้องผ่าน `migrateImages`/`imageFile`**
- **margin-presets.js/.json** (alpha.60r2, บริสุทธิ์) — ชุดระยะขอบสำเร็จรูป (ตารางอยู่ใน `.json` แก้เองได้)
- **i18n-csv.js** (alpha.60r3, บริสุทธิ์ 100%) — ไฟล์ภาษา ↔ CSV 3 คอลัมน์ `key,th,en`
  `jsonToCsv`/`csvToJson`/`mergeStrings` · **ใส่ BOM เสมอ** (Excel บน Windows) · `parseCsv` เป็น state machine
  · **`mergeStrings` รวมทับ ไม่ลบคีย์ที่ไม่มีในตาราง** — ห้ามเอา CSV ไปทับทั้งไฟล์
- **markdown-code-toggle.js** (alpha.60r3) — ซ่อนรหัสนำหน้าบรรทัด (`. @ > $shot # …`) ด้วย decoration
  `MD_PREFIXES` **ต้องเรียงยาวก่อนสั้น** · `prefixLen`/`suffixLen` เป็น pure (เทสได้ไม่ต้องมี ProseMirror)
  · **ไฟล์ .md ไม่ถูกแก้เลย** — ปิดสวิตช์แล้วรหัสกลับมาครบ
- **ai-synopsis.js** (alpha.60r3) — ปุ่ม ✨ ให้ AI เติมคุณสมบัติฉาก (synopsis/pov/emotion/conflict)
  **`attachAiFieldButton()` = จุดเดียวที่ทั้งกล่อง (`scene-props.js`) และแผง (`renderPropsPanel`) เรียก**
- **ai-analyzer-ui.js** (alpha.60r3) — แผง "🧠 AI วิเคราะห์" (**ตัวอย่างหน้าตา** มีป้ายกำกับ ไม่หลอกว่าเป็นผลจริง)
- **core.js** — `$`, `el`, `state`, `smart`, `log`, `setStatus`, ค่าคงที่ (`DEFAULT_SETTINGS`, `SCENE_STATUSES`, `SCENE_COLORS`, `BUILTIN_CATS`, `CAT_ICON`, `BASE_ED_FS`, ...) — **ทุกโมดูลใหม่ import จากที่นี่**
- **app.js** (~5,300 บรรทัด) — orchestrator: bootstrap, explorer (buildTree/tree), tabs, toolbar (floatBar), commands, shortcuts, zoom, **selftest ทั้งหมด**

### engine (pure logic — มีอยู่เดิม)
editor.js · screenplay.js · md.js (⚠️ CommonJS) · smart.js · spell.js · wiki.js · gallery.js · network.js · planner.js · timeline.js · maps.js · compile.js · fountain.js · sceneFilter.js · search.js · ui.js · nav.js
- **export-formats.js** (alpha.81, บริสุทธิ์ · import ได้แค่ compile.js + num.js) — ตรรกะของศูนย์รวมการส่งออก:
  `EXPORT_FORMATS` (ตารางปลายทาง 9 แบบ · **แหล่งความจริงเดียว**) · `docKind(model)` (บทหนัง/นิยาย
  ตัดสินจากฉากส่วนใหญ่ · **โน้ตไม่มีสิทธิ์โหวต**) · `pdfEngine(kind)` → `'pdflib'`|`'html'`
  (**ไม่มีทางไหนผ่านเครื่องพิมพ์ของระบบ** — ทางนั้นให้ PDF ที่เป็นภาพ ไม่มีตัวอักษร) ·
  `workflowForFormat(wf, fmt)` (บังคับ `to-html` ให้ตรงปลายทาง **โดยไม่แก้ของที่ผู้ใช้บันทึกไว้**) ·
  `normalizeHub`/`suggestName` · **unit test 51 ข้อ** (`node test/export-hub.test.cjs`)
  · UI อยู่ที่ `export-hub.js` (`openExportHub()` — เมนู ไฟล์ → ส่งออก… · Ctrl+Shift+E)
- **sp-format.js** (alpha.56, บริสุทธิ์) — รูปแบบบทภาพยนตร์ระดับใช้งานจริง (ข้อ 81–85, 92, 97):
  `PAPER_SIZES`/`MARGIN_DEFAULTS`/`linesPerPage`/`textWidth` · `SP_ELEMENT_CONFIG` (เยื้อง/กว้าง/เว้นบรรทัด
  ต่อ element · หน่วยนิ้ว วัดจากขอบกระดาษ) · `SP_ELEMENT_STYLES` (screen vs print) · `PAGE_BREAK_RULES` ·
  `SP_STRINGS` · `mergeSpFormat(user)` · `pageCssVars()` · `spCss()` (สร้าง CSS + `@page` เป็นข้อความ) ·
  `paginate()`/`pageCount()`/`wrapLines()`/`splitText()` · `newRoster`/`normalizeRoster`/`rosterToText`
  → re-export ผ่าน core.js · **unit test 74 ข้อ** (`node test/sp-format.test.cjs`)
- **sp-validator.js** (alpha.57, บริสุทธิ์ · ข้อ 54) — `validateScreenplay(blocks,{limits,checks})` ตรวจ 8 ชนิด
  (`SP_ERRORS`/`SP_SEVERITY`/`DEFAULT_LIMITS`) + `errorSummary`/`summaryText`/`nextError`
  · `block` ที่คืนมา = ดัชนีใน array ที่ส่งเข้าไป **นับ blank ด้วย** · **unit test 35 ข้อ**
- **sp-view.js** (alpha.57 · ข้อ 57/59/60/78) — โหมดมุมมองบท: `SP_VIEWS`/`SP_VIEW_CLASS`/`isPageView` ·
  `fitScale`/`overviewScale`/`viewScale` · `blocksFromDoc(doc)` (บล็อก+`pos` จริงจาก ProseMirror) ·
  `pagesOf`/`findPageStart`/`scenePositions`/`findNthScene` · `renderPageView(host,…)` (ส่วนเดียวที่แตะ DOM)
  · **unit test 45 ข้อ**
- **sp-format-guide.js** (alpha.57 · ข้อ 61+57) — PM plugin: `spFormatGuidePlugin()` (เส้นขอบ element + `¶`/`·`)
  · `spPageBreakPlugin()` + `setPageBreaks(list)` (**คืน true เมื่อเปลี่ยนจริง** — dispatch เฉพาะตอนนั้น)
- **prose-format.js** (alpha.58r, บริสุทธิ์ · บั๊ก 16–24) — รูปแบบ "นิยาย": `PROSE_DEFAULTS`/`HEADING_DEFAULTS`/
  `QUOTE_DEFAULTS`/`DEFAULT_PROSE_FONT` · `mergeProseFormat`/`proseCssVars`/`proseCss`/**`proseExportCss`** ·
  `proseLinesPerPage`/`proseMetrics`/`paginateProse`/`proseBlocksFromDoc`/`proseHeadings` · **unit test 84**
  ⚠️ นิยายกับบทภาพยนตร์ **ใช้ขนาดกระดาษ/ระยะขอบร่วมกัน** (`--page-w`/`--mg-*`) แต่รูปแบบข้อความคนละเอนจิน
- **prose-view.js** (alpha.58r · บั๊ก 15+20) — มุมมองหน้ากระดาษของนิยาย ใช้คลาส pane ชุดเดียวกับบท
  (`sp-view-*`) · `prosePageBreakPlugin`/`setProsePageBreaks` (คีย์แยกจาก sp) · `renderProsePageView`
- **export-fdx.js / export-rtf.js / export-watermark.js** (alpha.57, บริสุทธิ์ · ข้อ 67/68/70) —
  `generateFdx` · `generateRtf` (**ไทยต้องเป็น `\uNNNN?`** ไม่งั้น Word ได้ตัวขยะ) ·
  `buildWatermarkHtml`/`generateWatermarkedPDFs(api,…)`/`parseRecipients` · **unit test 72 ข้อ**
- **pdf-generator.js** (alpha.59 · ข้อ 69/87/89 · ใช้ `pdf-lib` + `@pdf-lib/fontkit`) —
  `generatePdf({blocks,fmt,titlePages,headers,fonts,meta,opts})` · `addOutline` (สารบัญ) ·
  `setOpenPage` (เปิดที่หน้าเดิม) · `wrapTextLines` (**มิเรอร์ `wrapLines()` เป๊ะ**) ·
  `layoutPageLines` · `needsLatinFont`/`splitFontRuns` · **unit test 87 ข้อ**
  ⚠️ ต้องส่งฟอนต์ **สองวงศ์** (`{regular, latin:{…}}`) — ดูกฎข้อ 19
- **sp-title-pages.js** (alpha.59, บริสุทธิ์ · ข้อ 90) — `TitlePageEditor` · `normalizeTitlePages` ·
  `defaultTitlePages(meta,fmt)` · `titlePageInnerHtml`/`titlePagesHtml`/`titlePagesText` · **62 ข้อ**
  · x/y เป็น **นิ้วจากขอบกระดาษ** (อย่าปนหน่วย point) · เก็บที่ `project.khn.json → titlePages`
- **sp-headers.js** (alpha.59, บริสุทธิ์ · ข้อ 91) — `mergeHeaders`/`resolveHeaderVars`/
  `headerStringsFor`/`headerLineCount`/**`linesForBody(fmt,hdr)`** · **48 ข้อ**
  · เก็บที่ `settings.spHeaders` · **หัวกระดาษกินบรรทัดจริง** ต้องส่ง `lines:` เข้า `paginate()`
- **pdf-ui.js** (alpha.59) — `openTitlePageDialog`/`openHeaderDialog`/`pdfExportDialog` ·
  **`buildScriptPdf()` = จุดเดียวที่ทุกทางเรียก** · `writeCompiledPdf` · `pdfFontBytes` (แคช)
- **import-sp.js** (alpha.60 · ข้อ 62–66) — นำเข้าบทภาพยนตร์ 5 รูปแบบ: `SP_IMPORTERS` (FDX/Celtx/Adobe Story/Fade In Pro/Fountain) ·
  `importScreenplayDialog(injectFn)` · `detectFormat` · `elementsToMarkdown` · `importSummary` · ใช้ JSZip สำหรับ Celtx
- **sp-compare.js** (alpha.60 · ข้อ 74) — เปรียบเทียบบท 2 ฉบับ: `compareScripts` (LCS diff) · `showComparisonDialog` (color-coded HTML) ·
  `diffStats` (equal/inserted/deleted/changed)

### Core Infrastructure (pure logic — **ยังไม่มี UI · รอต่อ**) — spec อยู่ใน `docs/`
- **panels/panel-layout.js + panel-store.js** (ข้อ 8) — dock/snap/tab group/float/collapse + `PanelManager` (registerPanel/showPanel/dockPanel/floatPanel/groupPanels) → [docs/08-panel-system.md](docs/08-panel-system.md)
- **layout/split-layout.js** (ข้อ 40) — recursive split + drag handle(snap 50%) + `SplitManager` · เชื่อม Panel ผ่าน `leaf.tabId` → [docs/40-split-view.md](docs/40-split-view.md)
- **kanban/kanban-core.js** (ข้อ 12) — จัดกลุ่มฉากตาม status + ลากการ์ด + `KanbanBoard` (เขียน scenes.json อัตโนมัติ) → [docs/12-kanban.md](docs/12-kanban.md)
- **world-story/auto-link.js** (ข้อ 86) — auto-link Wiki↔ฉาก + backlinks index ใน project.khn.json → [docs/86-world-story.md](docs/86-world-story.md)
- **auto-task/event-queue.js** (ข้อ 88) — EventBus + คิวงานเบื้องหลัง + taskLog[] → [docs/88-auto-task.md](docs/88-auto-task.md)

### AI & Advanced (pure logic — **ยังไม่มี UI · รอต่อ**) — spec อยู่ใน `docs/`
- **ai/ai-core.js** (ข้อ 72) — แกน AI ทั้งหมด: provider (openai/claude/ollama) · `AIClient` (retry/ไม่ throw) ·
  `KeyStore`(ai-key.json)/`mask`/`redact` · `RateLimiter` · `CostTracker` · RAG (`chunkText`/`localEmbed`/`VectorIndex`/`RagPipeline`) ·
  `extractJson`/`validate` → [docs/72-ai-core.md](docs/72-ai-core.md)
- **ai/ai-assistant.js** (ข้อ 72) — `aiAssistant(prompt, context, options)` + `expand`/`summarize`/`rewrite`/`changeTone`
- **ai/ai-plot.js** (ข้อ 73) — `detectPlotHoles` + ตรวจออฟไลน์ (เวลาย้อนกลับ/pov ลอย) → [docs/73-ai-plot.md](docs/73-ai-plot.md)
- **ai/ai-dialogue.js** (ข้อ 74) — `generateDialogue` (อ่านบุคลิกจาก Wiki · ออกเป็น fountain `@ชื่อ`)
- **ai/ai-character.js** (ข้อ 75) — `checkConsistency` + ตรวจคำลงท้าย/สรรพนามไทยแบบออฟไลน์
- **ai/ai-world.js** (ข้อ 76) — `generateWorld` 6 เทมเพลต → `toWikiEntity`
- **ai/ai-chat.js** (ข้อ 79) — `ChatSession`/`chat` (RAG ฉาก+วิกิ+เส้นเวลา · สตรีม · อ้างอิงที่มา)
- **ai/ai-tools.js** (alpha.64 · บริสุทธิ์ 100%) — **โปรโตคอลให้ AI สั่งงานแอปได้จริง**
  `TOOLS` (15 คำสั่ง) · `toolsSystemPrompt(cap)` · `parseToolCalls(text)` · `stripToolCalls` ·
  `validateCall(call, cap)` · `describeCall` · `resultsMessage`
  · **ไม่ใช้ function-calling ของ API** เพราะ provider ที่ผู้ใช้ต่อเองรองรับไม่เท่ากัน →
  โมเดลพิมพ์บล็อก ` ```k2 ` ที่มี JSON แทน (โมเดลไหนพิมพ์ JSON เป็นก็ใช้ได้หมด · ผู้ใช้อ่านออกด้วยตา)
  · สิทธิ์ 3 ระดับ `read` < `write` < `full` ผูกกับโหมดแชท (`modeCap()` ใน ai-session.js)
- **ai/ai-actions.js** (alpha.64) — ตัวลงมือทำ · `runToolCall(call)` / `touchesProject` / `refreshAfterActions`
  · **เขียนไฟล์เองตามรูปแบบเดิมเป๊ะ ๆ** (เรียก `scene-ops`/`section-ops`/`wiki-ui` ตรง ๆ ไม่ได้
  เพราะฟังก์ชันพวกนั้นเปิดกล่องถามชื่อเสมอ — สั่งจากโค้ดไม่ได้)
  · ลบ = ย้ายเข้า `Recycle/` + เขียน `.k2restore.json` เองเหมือนที่ผู้ใช้ลบ
- **tools/thesaurus.js** (ข้อ 67) — เอนจินคำพ้อง (คลังไทยในตัว/Datamuse/แคช) — คนละไฟล์กับ `src/thesaurus.js` ที่เป็น UI เดิม
- **import/import-scrivener.js** (ข้อ 63) — `.scrivx` XML + RTF(`\uNNNN` ไทย) → โครง Killian
- **comments/comment-core.js** (ข้อ 64) — คอมเมนต์มีเธรด เก็บใน `.md` (บล็อก `<!-- k2-comments -->`) + สมอตามข้อความ

**กฎของโมดูล AI**: ไม่ยิงเน็ตเอง (รับ `client`/`http` เข้ามา) · ไม่ throw (คืน `{ok:false,error,code}` ภาษาไทย) ·
`buildXPrompt`/`parseX` เป็น pure เสมอ · คีย์อยู่ `ai-key.json` เท่านั้น · ฟีเจอร์ตรวจสอบมีชั้นออฟไลน์ก่อน

ทุกตัวไม่แตะ DOM/fs (ต่อไฟล์ผ่าน `io` adapter = `kapi`) · `npm run test:unit` = **4,560 ข้อ · 68 ไฟล์**
UI ที่ต้องทำต่อ: `panels/panel-ui.js` · `layout/split-ui.js` · `kanban/kanban-ui.js` · แผง "ฉากที่กล่าวถึง" ในหน้า Wiki ·
แผง AI (ผู้ช่วยเขียน/ตรวจปม/บทสนทนา/สร้างโลก/แชท) · หน้านำเข้า Scrivener · แถบคอมเมนต์ข้างฉาก
แล้วค่อยต่อ entry point ตามกฎข้อ 7 (เมนู main.js + `case` ใน `handleCommand`)

### ⚠️ กฎถาวรที่ผู้ใช้กำหนด (alpha.72) — งานค้างต้องขึ้น list เสมอ

> **อะไรที่มีการทิ้งเมื่อปิด หรือ update ตอนปิดโปรแกรม ต้องขึ้น list ทุกครั้ง**

เพิ่มฟีเจอร์ใหม่ที่ถือสถานะค้างในหน่วยความจำ (ไม่ได้เขียนลงไฟล์ทันที) → **ต้อง** ลงทะเบียนที่
`registerDirtySources()` ใน `app.js` ผ่าน `registerDirtySource(id, { label, list, save })`
(`src/dirty-registry.js`) · กล่อง "บันทึกทั้งหมด" และ "ปิดโปรแกรม" อ่านจากทะเบียนตัวเดียวนี้
**ห้ามไปแก้กล่องบันทึกทีละที่** — ของที่ไม่ลงทะเบียนจะหายเงียบตอนปิดโปรแกรม (กระดานวางแผนเคยเป็นแบบนั้น)

คู่กัน: **ปิด "แผง" ≠ ทิ้งงาน** — แผงที่ยังถือสถานะไว้ในหน่วยความจำห้ามตั้ง `setPanelCloseGuard`
ให้ถามบันทึก · ถามเฉพาะตอนงานกำลังจะหายจริง (เปิดไฟล์อื่นทับ / ทิ้ง / ปิดโปรแกรม)

### ⚠️ กฎถาวร (alpha.77) — ห้ามฮาร์ดโค้ดข้อความไทย · มีข้อความใหม่ = เพิ่มใน CSV

> **ทุกข้อความที่ผู้ใช้เห็นต้องมาจากไฟล์ภาษาเท่านั้น · แอปไม่มีการตกกลับใด ๆ**

```js
setStatus('บันทึกแล้ว')        ✗   →   setStatus(t('ui.app.saveDone'))     ✓
`บทที่ ${n}`                   ✗   →   tf('ui.scene.chapterNum', n)        ✓
t('ui.x.y', 'ค่าสำรองไทย')     ✗   →   t('ui.x.y')                         ✓
```

**เพิ่มข้อความใหม่ทำยังไง**
1. เขียน `t('ui.<module>.<name>')` ในโค้ด (`tf` ถ้ามีค่าแทรก — CSV เก็บเป็น `{0}`,`{1}`)
2. เพิ่มแถวเดียวกันใน **ทุกไฟล์** `languages/k2_*.csv` · ภาษาที่ยังไม่แปล **ใส่ข้อความไทยไปก่อน**
   (ห้ามเว้นว่าง — ไม่มี fallback ช่องว่างจะกลายเป็นคีย์โผล่บนจอ)
3. `npm run i18n` — เติมแถวที่ขาดให้ทุกไฟล์แล้วรันเทสตรวจให้เสร็จในคำสั่งเดียว

**ข้อควรรู้**
- `t`/`tf` มาจาก `src/i18n.js` (โมดูลบริสุทธิ์ · core.js re-export ให้ด้วย)
- **ไฟล์ที่มีตัวแปรท้องถิ่นชื่อ `t`** (เช่น `const t = state.tabs.get(f)`) ใช้นามแฝง `tt()`/`ttf()`
  — `t is not a function` แบบนี้ build ไม่ฟ้อง เจอตอนรันเท่านั้น (`node tools/i18n-shadow.cjs` ตรวจให้)
- **main.js เป็น CommonJS** — มี `t`/`tf` ของตัวเองที่อ่าน CSV ก้อนเดียวกัน **ห้ามใส่ `import`**
- **ค่าที่เขียนลงไฟล์งานห้ามแปล** (สถานะฉาก · คำนำหน้าหัวฉาก fountain · ชนิดความสัมพันธ์ · แท็ก ·
  คีย์ของ object · คลังคำพ้องไทย · สรรพนามของตัวจับรูปแบบการพูด) — เก็บเป็นไทย
  แปลตอนวาดด้วย `dataLabel()` (ตาราง `DATA_KEYS` ใน core.js)
- ยกเว้นไฟล์/ช่วงบรรทัดเพิ่มได้ที่ **`tools/i18n-classify.cjs`** (แหล่งความจริงเดียว — เครื่องมือกับเทส
  อ่านจากที่นี่ทั้งคู่) **พร้อมคอมเมนต์บอกเหตุผลเสมอ**

### feature modules (แยกจาก app.js — จุดที่ feature ใหม่มาต่อยอด)
- **dashboard.js** — แดชบอร์ด/สถิติ/analytics
- **books.js** — จัดการเล่ม/ร่าง (Book Manager)
- **timeline-ui.js / maps-ui.js** — UI ของเส้นเวลา/แผนที่
  · [alpha.70] `maps-ui.js` import `collectPlacedScenes` จาก **floorplan-ui.js** (แหล่งเดียวของ "ฉากที่ปักหมุด")
    — ทิศทางนี้เท่านั้น floorplan-ui **ห้าม** import maps-ui กลับ · `scene-props.js` เรียก `buildShowOnMapRow`
    ด้วย **dynamic import** เพราะ maps-ui → app.js → scene-props เป็นวง
- **wiki-ui.js** — หมวด Wiki + เอนทิตี้ (เพิ่ม/เปิด/ทำสำเนา)
- **scene-ops.js** — จัดการฉาก+บท (เพิ่ม/แก้/ลบ/ย้าย/เมนู)
- **section-ops.js** — จัดการเล่ม (section)
- **scene-props.js** — แผงคุณสมบัติฉาก
- **dialogs.js** — ตั้งค่า/ประวัติเวอร์ชัน/changelog/log viewer
- **recycle.js** — ถังขยะ
- **roster-ui.js** (alpha.56) — หน้ารายชื่อตัวละคร (Cast of Characters) ประจำเล่ม → `<เล่ม>/roster.json`

**feature ใหม่ที่เป็นไฟล์ของตัวเอง** (home page, kanban, mood board, scene table ฯลฯ) → สร้างไฟล์ใหม่ใน src/ import จาก core.js + engine ที่เกี่ยว แล้วให้ app.js `import { openX } from './x.js'` + เพิ่ม entry point (เมนู/ปุ่ม/command)

---

## 🚨 กฎเหล็ก (ทำผิดแล้ว build ผ่านแต่ runtime พัง — เจอเฉพาะตอน e2e)

1. **import helper ให้ครบทุกตัว** — `$`, `el`, `state`, `setStatus`, `log` ฯลฯ ต้อง import จาก core.js
   esbuild ปล่อย identifier ที่ไม่รู้จักเป็น runtime global → **`node build.js` ผ่าน แต่พังตอนใช้งาน**
   → ทุกครั้งที่เพิ่ม/ยกโมดูล ต้องรัน e2e ยืนยัน

2. **ES module: ตัวแปร `let` ที่ reassign export ข้ามไฟล์ไม่ได้** (import เป็น read-only binding)
   ถ้าต้องแชร์ตัวแปร mutable ข้ามไฟล์ → เก็บใน object: `const X_C = { v: null }` แล้วใช้ `X_C.v`
   (ตัวอย่างในโค้ด: `INV_C.m`, `mapsState_C.s`, `propsTarget_C.t`)

3. **md.js เป็น CommonJS** (`module.exports = {...}`) ไม่ใช่ ES export
   import แบบ ES ได้ปกติ (`import { parseMdFile, dumpMdFile, countWords } from './md.js'`) — esbuild interop ให้

4. **namespace import ต้องตรง** — `import * as spell from './spell.js'` แล้วเรียก `spell.check(...)`
   อย่าเปลี่ยนเป็น `import { check }` ถ้าโค้ดเรียกแบบ `spell.check`

5. **`state` ใน editor.js/screenplay.js/smart.js คือ ProseMirror EditorState (local)** ไม่ใช่ app `state`
   → **ห้ามแตะไฟล์ engine เหล่านี้เพื่อ "แก้ import"** — จะ shadow ผิด

6. **circular import (feature → app.js) ใช้ได้** ถ้าเรียกฟังก์ชันตอน runtime (event handler / หลังโหลด)
   ไม่ใช่ตอน module top-level · ฟังก์ชันใน app.js ที่ feature ต้องใช้ต้องมี `export` หน้า declaration

---

## 🚧 กฎเพิ่มหลังรอบ alpha.40 (บทเรียนจากฟีเจอร์ชุดที่ต่อไม่ครบ)

7. **เขียนโมดูลแล้วต้องต่อจุดเข้าใช้งานให้ครบ** — `import` ใน app.js อย่างเดียว = ผู้ใช้เข้าไม่ถึงเลย
   ต้องมีอย่างน้อยหนึ่งอย่าง: เมนูใน `main.js` (`send('channel')`) + `case 'channel'` ใน `handleCommand`
   หรือปุ่ม/คีย์ลัดในตาราง `SHORTCUTS` · เช็คเร็ว: ชื่อฟังก์ชันต้องปรากฏใน app.js **มากกว่า 1 ครั้ง**
8. **คีย์ลัดใหม่ต้องเข้าตาราง `SHORTCUTS` เท่านั้น** ห้ามผูก `document.addEventListener('keydown')` เอง
   (จะชนกับคีย์เดิมโดยไม่รู้ตัว — มี selftest กันคีย์ซ้ำแล้ว)
9. **`selection.anchorNode` เป็น Text node** → ไม่มี `.closest()` ต้องขึ้น `parentElement` ก่อน
   `anchorNode.closest?.(...)` จะคืน undefined เงียบ ๆ ทำให้ฟีเจอร์ตายโดยไม่มี error
10. **ไฟล์ไบนารีห้ามผ่าน `readFile`/`writeFile`** (main เขียน utf-8 → ไบต์ ≥0x80 บวม ไฟล์เสีย)
    ใช้ `kapi.readBytes` / `kapi.writeBytes` / `kapi.copyFile`
11. **ข้อความจากผู้ใช้ห้ามลง `innerHTML`** — ใช้ `el(tag, cls, text)` (textContent) เสมอ
12. **เรียก API ภายนอกต้องผ่าน `kapi.httpFetch`** (main process) — `fetch` ใน renderer ติด CORS
    และของลับ (API key) เก็บไฟล์แยก ห้ามลง `project.khn.json`

---

## 🚧 กฎเพิ่มหลังรอบ alpha.58r (บทเรียนจากบั๊ก 27 ข้อ)

13. **ค่าที่ผู้ใช้ปรับได้ ต้องเข้าไปอยู่ใน "object รูปแบบ" ที่โมดูลบริสุทธิ์รับเข้าไป**
    ไม่ใช่ตั้งเป็น CSS var แล้วจบ — ไม่งั้น `paginate()`/`pageMetrics()` คำนวณจากค่ามาตรฐานตลอด
    (`spLineHeight` → `mergeSpFormat().lineHeight` → **`formatLines(fmt)` จุดเดียวที่ทุกที่เรียก**)
14. **"สวิตช์เปลี่ยนสี" ห้ามถือ layout** — `padding`/`margin` ของหน้ากระดาษต้องอยู่ในกฎกลาง
    ปิด/เปิด `body.paper-mode` แล้ว computed padding ต้องเท่าเดิมเป๊ะ (มี e2e คุมแล้ว)
15. **UI ที่ "เพิ่มพื้นที่" (เลขบรรทัด ฯลฯ) ต้องวาดแบบ `position:absolute` ในระยะขอบที่ว่างอยู่**
    ห้ามทับ `padding-left` ของ `.ProseMirror` — บทภาพยนตร์วัดระยะเยื้องจากขอบกระดาษ จะเพี้ยนทั้งไฟล์
16. **โหมดที่ทับกันได้ต้องแข่ง `!important` กันตรง ๆ** — โหมดอ่านต้องชนะ `sp-view-layout/draft`
    ที่ใช้ `!important` อยู่แล้ว + ต้องมีกฎ `:not(.paper-mode)` ชัดเจน
17. **ทางส่งออกต้องอ่านจากเอกสารจริง** (`blocksFromDoc`) ไม่ใช่ `parseScript(getMarkdown())`
    — fountain round-trip ไม่ปิดวง (บทพูดกำพร้าสร้างไม่ได้)
18. **e2e ที่รอ async I/O ต้อง poll จนกว่าเงื่อนไขจะจริง** ไม่ใช่ `setTimeout` ค่าคงที่
    และบล็อกท้าย ๆ ต้องเช็คว่าแท็บยังเปิดอยู่ไหมก่อนใช้ (`state.tabs.has(file)`)

---

## 🚧 กฎเพิ่มหลังรอบ alpha.59 (ชุด PDF)

19. **PDF ต้องส่งฟอนต์สองวงศ์** — pdf-lib ไม่มีลูกโซ่สำรองแบบ CSS `font-family`
    (ก) `CourierPrime` **ไม่มีอักษรไทยเลย** → ใช้เป็นวงศ์หลักแล้วไทยหายทั้งไฟล์
    (ข) `CourierThaiMono` (ปี 1998) เอา cmap ของ `·` `©` `—` `…` `“ ”` **ไปชี้ทับด้วย glyph ไทย**
        และ fontkit หา glyph เจอ (id ≠ 0) จึง **ไม่ throw ไม่ฟ้อง** → ได้ไฟล์ "อ่านออกแต่ผิด"
    **ต้องส่ง `{regular: ไทย, latin: {…CourierPrime}}` ให้ `generatePdf` เสมอ** (ใช้ `pdfFontBytes()`)
20. **โมดูลที่อ่านค่าจาก config ห้ามใช้ `+x || d`** — `linesBefore: 0` ของบทพูดเป็น falsy
    จะกลายเป็นค่าเริ่มต้น 10 → บทพูดหลุดจากชื่อตัวละคร **ใช้ `num(v,d)` ที่เช็ค `Number.isFinite`**
21. **อย่าครอบบล็อกเทสด้วย `if (tab)` เฉย ๆ** — หา tab ไม่เจอแล้วเทสถูกข้ามเงียบ ผลยัง `ALL OK`
    ให้เปิดแท็บใหม่เองแล้ว `check()` ว่าเปิดได้ · ตรวจซ้ำหลัง e2e ด้วย `grep -cE '^PASS \[ข้อ\]'`
22. **ตรวจไฟล์ PDF ในเทส**: pdf-lib **บีบอัด content stream** และเขียนข้อความเป็น **hex string**
    → `zlib.inflateSync` ก่อน แล้วถอด hex · และกรองเอาแค่ content stream (ไบนารีฟอนต์ที่ฝังไว้
    มีไบต์ที่อ่านเป็น `Tj` ได้โดยบังเอิญ ทำให้นับคำสั่งวาดเพี้ยน)
23. **ไบต์ PDF เขียนด้วย `kapi.writeBytes(dest, Array.from(bytes))`** ไม่ใช่ `writeFile` (กฎ 10)

---

## 🚧 กฎเพิ่มหลังรอบ alpha.60r1 (บทเรียนจากบั๊ก 22 ข้อ)

24. **`num()` มีที่เดียวคือ `src/num.js`** — ห้ามประกาศสำเนาในไฟล์ใหม่อีก
    โมดูลบริสุทธิ์ `import { num } from './num.js'` · โมดูล UI `import { num } from './core.js'`
    เช็คเร็ว: `grep -rn "parseFloat(v); return Number.isFinite" src/` ต้องเจอแค่ `num.js`
25. **สวิตช์ "หน่วงเวลา" ห้ามเขียนเป็นสวิตช์ "ปิดฟีเจอร์"** — `spAutoPaginate` (ข้อ 96) เคย gate
    การจัดหน้าทั้งก้อนไว้ ทั้งที่ค่าเริ่มต้นคือปิด → จำนวนหน้า/เส้นคั่นหน้า/CONTINUED หายทั้งระบบ
    **แยกงานจริงออกเป็นฟังก์ชัน (`repaginateNow`) แล้วให้สวิตช์เลือกแค่ "ใครเรียกและเมื่อไร"**
26. **ตัวแปรชื่อ `t` บัง `t()` ของ i18n** (บทเรียน 25 ซ้ำอีกครั้ง) — ไฟล์ที่ใช้ `const t = state.active`
    (`app.js` · `split-ui` · `ai-ui` · `comment-ui`) ต้อง `import { t as tr }` เท่านั้น
    อาการ: build ผ่าน แต่ runtime ได้ `t3 is not a function` กลางการวาด
27. **e2e ต้องล้าง global settings ด้วย ไม่ใช่แค่ localStorage** —
    `%APPDATA%/Killian2/settings.json` (ข้อ 94) ค้างข้ามรอบ · `runTest()` เรียก
    `kapi.writeGlobalSettings({})` ก่อนเริ่มเสมอ (ขยายจากกฎ 18 / บทเรียน 4+34)
28. **ตารางที่ "ต้องตรงกับอีกไฟล์" ให้ derive ตอนรัน อย่าคัดลอก** —
    `SP_PREFIX` ของ `sp-compare` สร้างจาก `SP_ELEMS` · `KEEP_NEXT` ของ `export-rtf` อ่าน
    `SP_ELEMENT_CONFIG[el].keepNext` · เปลี่ยนต้นทางที่เดียวแล้วปลายทางตามทันที
29. **สตริง UI ของโมดูลใหม่ต้องเข้า `languages/*.json`** ในรูป `t('ns.key', 'ไทย')`
    (ไม่มีคีย์ = ได้ไทยเหมือนเดิม ไม่พัง) · `languages/` กับ `renderer/languages/` เป็นไฟล์ hardlink
    เดียวกัน — แก้ที่เดียวได้ทั้งคู่ แต่ต้องเช็คว่ายังเป็น JSON ที่อ่านได้

---

## 🚧 กฎเพิ่มหลังรอบ alpha.60r2 (รอบแก้ 13 ข้อ)

30. **กฎเหล็กของผู้ใช้: แก้ UI ต้องไม่กระทบตัวแก้ไขหรือหน้ากระดาษทุกรูปแบบ**
    ตัวแปร CSS แยกกันอยู่แล้ว — เปลือกโปรแกรมใช้ `--bg/--side/--bar/--border/--fg/--dim/--curline`
    หน้ากระดาษใช้ `--paper/--paper-ink/--paper-edge/--paper-surround` · **ห้ามให้ธีม/โหมดใด ๆ ข้ามฝั่ง**
    ทุก PR ที่แตะ UI ต้องมี check ยืนยัน สีกระดาษ · สีหมึก · ความกว้างหน้ากระดาษ ไม่ขยับ
31. **อะไรที่ "เป็น UI" ห้ามวาดลงบนกระดาษ** — เลขบรรทัดเคยเป็น `::before` ของบล็อกใน ProseMirror
    จึงเลื่อนตามกระดาษ ย่อ/ขยายตามซูม และติดไปกับงานที่พิมพ์
    **แก้: วาดนอกกล่องที่ถูก CSS `zoom`** (ลูกของ `#panes`) แล้วคำนวณตำแหน่งจาก `getBoundingClientRect`
32. **ห้ามใช้ `%` กับความกว้าง/สูงของลูกที่อยู่ใต้ CSS `zoom`** — การตีความ % ใต้ `zoom` ต่างกันตาม
    เวอร์ชันเบราว์เซอร์ · วัดเป็นพิกเซลใน JS แล้วหารด้วยอัตราซูมแทน (`syncWorkspaceWidths()`)
33. **โมดูลใหม่ที่ต้องแตะ ProseMirror doc: รับ `state` เป็นพารามิเตอร์ อย่า import prosemirror**
    ใช้แค่ `state.selection` / `state.doc.nodesBetween` / `state.tr` / `state.schema.text`
    → ยังคงเป็น "โมดูลบริสุทธิ์" ที่ unit test ด้วย state ปลอมได้ (ดู `text-case.js`)
34. **เปลี่ยนโครงข้อมูลที่มีไฟล์เก่าอยู่ = ต้องมี `migrate*()` + `needs*Migration()`**
    อ่านของเก่าได้เสมอ · เขียนกลับเป็นรูปแบบใหม่ตอนแตะครั้งแรก · มี unit test ยืนยัน idempotent
    (`wiki-images.migrateImages` · `panel-store.migrate` v1→v2)
35. **schema ที่บันทึกลง localStorage ต้องตรวจโครงก่อนใช้** — `deserializeLayout` เรียก `validRoot()`
    แล้ว **คืน `null` เพื่อให้ตกกลับค่าตั้งต้น** ดีกว่าปล่อยต้นไม้เสียเข้าไปวาดจนโปรแกรมล่ม
36. **เทสที่วัดตำแหน่งเลื่อน/โฟกัส/คีย์ลัด ให้ผลต่างกันตาม OS** — `scroll-behavior:smooth` ทำให้
    `scrollTop=` เป็นอนิเมชัน · ตัวแก้ไขที่มีโฟกัสจริงดึงจอกลับหาเคอร์เซอร์ (เจอบน macOS ไม่เจอบน xvfb) ·
    `formatShortcut` คืน `⌘⇧` บน mac · **วนรอเงื่อนไขจริงพร้อมเพดาน อย่ารอเวลาตายตัว**

---

## ✅ ทุกฟีเจอร์ใหม่ต้องมี selftest (ห้ามลด check)

selftest อยู่ใน `runTest()` ท้าย app.js — รูปแบบ `check('ชื่อไทย', เงื่อนไข, ข้อมูล debug)`
- เพิ่มฟีเจอร์ = เพิ่ม `check(...)` พิสูจน์ว่ามันทำงานจริง (ไม่ใช่แค่มี element)
- วาง check ในบริบทที่ state พร้อม (แท็บ/โปรเจกต์เปิดอยู่จริง)
- `check` ตัวแรกที่ fail จะ `throw` → STOP ทั้งชุด: ดู `/tmp/k2result.txt` หา `FAIL`/`STOP`
- ห้ามลบ check เดิมเพื่อให้ผ่าน

---

## 📝 convention

- ข้อความ UI + คอมเมนต์เป็น **ภาษาไทย**
- ไฟล์งานผู้ใช้: Markdown (`.md`) + JSON (draft.json/scenes.json/section.json/project.khn.json) — เข้ากับ v1
- อย่า commit `renderer/bundle.js` เป็นการแก้มือ — มันถูก generate จาก `node build.js`
- format/lint: ตามสไตล์เดิมในไฟล์ (2-space indent, single quote, ไม่มี semicolon-less)

---

## เครื่องมือช่วย refactor (tools/)
- `tools/refactor.py` — ยกกลุ่มฟังก์ชันจาก app.js → ไฟล์ใหม่ (auto-detect import + auto-export cross-ref)
- `tools/fiximports2.py` — เติม import ที่ขาดในกลุ่ม feature modules (spoke-only)
- `tools/redirect.py` — แก้ import ข้ามโมดูลให้ชี้แหล่งจริง
- `REFACTOR_PROGRESS.md` — บันทึกความคืบหน้า/บทเรียนการแยกไฟล์
- `tools/js-lex.cjs` (alpha.76) — เลกเซอร์ JS เล็ก ๆ ที่หา string literal ได้ถูกจริง
  (แยกคอมเมนต์/regex literal/`${}` ซ้อนชั้นออกจากกัน) — regex ทำงานนี้ไม่ได้
- `tools/i18n-classify.cjs` (alpha.77) — **กฎเดียว** ว่าไทยจุดไหนเป็น UI จุดไหนเป็นข้อมูล
- `tools/i18n-extract.cjs` — ตรวจ/ห่อข้อความไทย + ออกไฟล์ `languages/k2_*.csv` (`npm run i18n`)
- `tools/i18n-rekey.cjs` (alpha.77) — แปลง `T\`…\`` → `t('ui.…')` (ใช้ครั้งเดียว เก็บไว้อ้างอิง)
- `tools/i18n-shadow.cjs` (alpha.77) — หาจุดที่ตัวแปรชื่อ `t` บังฟังก์ชันแปลภาษา
- `tools/th-seg.cjs` + `tools/th-en-lexicon.cjs` — ตัดคำไทย + พจนานุกรมสำหรับ **ตั้งชื่อคีย์**
- `tools/i18n-add.cjs` (alpha.79) — **เพิ่มคีย์ใหม่ลงไฟล์ภาษาทุกไฟล์พร้อมกัน**
  ```bash
  node tools/i18n-add.cjs keys.json    # {"ui.x.y": {"th":"…","en":"…"}}
  ```
  ภาษาไหนไม่ระบุ → ใช้ค่า `th` ไปก่อน (กฎข้อ 0: ห้ามเว้นว่าง) · คีย์ที่มีอยู่แล้วไม่ทับ
  กัน 3 อย่างที่พลาดบ่อยตอนแก้มือ: **ลืมไฟล์ใดไฟล์หนึ่ง · ลืม BOM · ลืมใส่ quote**

---

## ⚠️ กฎถาวร (alpha.79) — โครง HTML ของกล่องตั้งค่าอยู่ใน "ไฟล์ภาษา" ไม่ใช่ในโค้ด

`settingsDialog()` สร้าง innerHTML จากคีย์เดียว `ui.dlg.alphaItemLevelUser` ใน `languages/k2_*.csv`
(ผลพลอยได้จากการยกข้อความออกจากโค้ดรอบ .76) — **จะแก้หน้าตากล่องตั้งค่าต้องไปแก้ที่ CSV**

**เจ็บมาแล้ว (.79)**: แก้โครงด้วยสคริปต์แล้ว regex จับขอบผิดไปหนึ่งตัว
(`k-set-page"` ไม่ตรงกับ `k-set-page k-set-2col on`) → **หน้า "ทั่วไป" กับ "การเขียน" หายทั้งหน้า**
โดยไม่มีอะไรฟ้อง จนไปพังตอน e2e ด้วย `Cannot set properties of null`

→ **ประตูกันพลาด: `test/settings-tpl.test.cjs`** ตรวจว่าทุก `#st-*` ที่ `dialogs.js` อ้างมีอยู่จริงในเทมเพลต ·
แท็บกับหน้าจับคู่ครบ · `{0}..{43}` ครบ · `<div>` เปิด-ปิดครบคู่ · **สำเนา CSV ไว้ก่อนแก้เสมอ**

---

## 🔌 เอนจินใหม่ (alpha.39) — logic เสร็จ, รอต่อ UI + wire เข้า app.js

3 ไฟล์นี้เป็น **pure logic บริสุทธิ์** (ไม่แตะ DOM/kapi) ยังเป็น orphan (ยังไม่ถูก import จาก app.js)
มี unit test ครบแล้ว (`node test/{search-engine,panel,split}.test.cjs`) — **opencode ต่อ UI + wire + เพิ่ม selftest ใน app.js**

### search-engine.js (ข้อ 33 — full-text search)
```js
import { SearchIndex, indexProject } from './search-engine.js';
const idx = await indexProject(state.root, kapi, parseMdFile);   // สร้าง index ครั้งเดียว (cache ใน state)
const results = idx.search('ทอร่า เค้ก');                          // AND · OR · NOT · title:/tags:/status:
// results: [{ id, path, title, status, score, freq, matches:[{line, pos, snippet}] }]
```
UI ที่ต้องทำ: ช่องค้นหา global (Ctrl+Shift+F?) → เรียก idx.search → แสดง results (path+snippet+line) → คลิกเปิดไฟล์+กระโดดบรรทัด · rebuild index เมื่อ saveTab/เพิ่ม-ลบไฟล์

### panels/panel-layout.js + panel-store.js (ข้อ 8 — docking)
```js
import * as PL from './panels/panel-layout.js';
import { PanelStore } from './panels/panel-store.js';
const store = new PanelStore();                     // ใช้ localStorage อัตโนมัติ
store.load();
const zone = PL.snapZone(mouseX, mouseY, paneRect); // 'left'|'right'|'top'|'bottom'|'center'|null
store.update(PL.dockPanel(store.root, targetId, zone, PL.panel('outline','เค้าโครง')));
```
UI ที่ต้องทำ (panel-ui.js): วาด tree จาก store.root, drag panel + แสดง drop-zone hint, ต่อ resize handle → PL.resizeDock, tab bar → PL.moveTab/splitTab

### layout/split-layout.js (ข้อ 40 — split view)
```js
import * as SL from './layout/split-layout.js';
import { SplitStore } from './layout/split-layout.js';   // store อยู่ในไฟล์เดียวกัน
const store = new SplitStore(); store.load();
store.update(SL.splitPane(store.root, targetLeafId, 'right', tabId));  // ลากแท็บไปขอบ
store.update(SL.resizeSplit(store.root, splitId, i, ratio));           // มี snap 50% ในตัว
```
UI ที่ต้องทำ (split-ui.js): วาด pane recursive จาก store.root (leaf.tabId → เนื้อหาแท็บ), drag handle ระหว่าง pane, drop-zone ที่ขอบ pane → splitPane · เชื่อม Panel System ผ่าน tabId ร่วมกัน
