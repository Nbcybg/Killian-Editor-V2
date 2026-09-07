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
ปัจจุบัน **4,200+ checks · ALL OK** (alpha.126) — ห้ามทำให้จำนวนลดลง
(unit `npm run test:unit` = **5,500+ ข้อ · 85 ไฟล์** · ~22 วินาที)
**ตัวเลขสองบรรทัดนี้ล้าสมัยง่ายมาก** — รอบไหนแตะเทส ให้รันจริงแล้วอัปเดตด้วย
(alpha.125 เจอว่ามันค้างอยู่ที่ตัวเลขของ alpha.93 นานหลายสิบรุ่น จน agent รุ่นถัดมาเข้าใจผิด)
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
- **export-name.js** (alpha.132, บริสุทธิ์ · import ได้แค่ shortcode.js) — **ชื่อไฟล์ส่งออกที่ตั้งเองได้**:
  `buildExportName(template, ctx, ext)` (ขยายโค้ดสั้น → กรองอักขระ → ต่อ นามสกุล) ·
  `sanitizeFileBase` (กฎเข้มของ Windows ชุดเดียวทุกระบบ + ชื่อที่ระบบสงวน + ตัดจุด/ช่องว่างท้าย) ·
  `BUILTIN_NAME_PRESETS` · `normalizeExportName`/`saveNamePreset`/`deleteNamePreset`
  · **unit test 26 ข้อ** (`node test/export-name.test.cjs`) · เก็บที่ `settings.exportName` (**global**)
  · UI ร่วมของทั้งสองกล่องส่งออกอยู่ที่ `export-name-ui.js` (`exportNameRow()`) — **เขียนที่เดียว**
- **[alpha.132 · X-1] การจัดหน้าเดินทางไปกับไฟล์ที่ส่งออกแล้ว** — `<!--align:x-->` เป็น
  **คอมเมนต์ที่เป็นรูปแบบ** ไม่ใช่บันทึกของนักเขียน · `stripComments()` ใน compile.js จึงเว้น
  `align`/`pagebreak` ไว้เสมอ (`KEEP_COMMENT`) · `mdToHtmlBody()` อ่านแล้วใส่ `style`+`data-align`
  · `docToMd/mdToDoc` พา align ของ **ข้อในรายการ/ย่อหน้าในคำพูดยกมา** ไปได้แล้ว
  · **ห้ามเขียน regex ของคอมเมนต์นี้ซ้ำที่อื่น** — ใช้ `stripAlign` ที่ md.js ส่งออกมา
  · unit test: `node test/align-export.test.cjs` (19 ข้อ)
- **[alpha.132r] ★ มีตัวแปลง md → หน้ากระดาษ **สองตัว** ที่ต้องแก้คู่กันเสมอ**
  · `mdToHtmlBody()` (compile.js) = ทางของ **ไฟล์จริง** (HTML → PDF ของนิยาย)
  · `mdToProseBlocks()` (prose-format.js) = ทางของ **ช่องตัวอย่าง** ในศูนย์ส่งออก
  แก้กฎการแปลงที่ตัวเดียว = ตัวอย่างกับไฟล์จริงจะไม่ตรงกันทันที (เจอมาแล้วกับบรรทัดว่าง)
  · ย่อหน้าว่างต้องเป็น `{type:'p', text:''}` เหมือน `proseBlocksFromDoc` **ห้ามคิดชนิดใหม่**
- **[alpha.132r4] ★★ สวิตช์บล็อกทุกตัวใช้กติกาเดียว** (`toggleListCmd` · `toggleWrapCmd`):
  ดู **ทั้งช่วง** → เป็นชนิดนั้นหมดแล้ว = ถอดออก · นอกนั้น = **ถอดของเก่าทุกชนิดก่อน** แล้วห่อใหม่
  · `liftListItem` ของ prosemirror ใช้ได้เฉพาะช่วงที่อยู่ใน **รายการใบเดียว** — ช่วงที่ปนกัน
    คืน false ทันที → ใช้ `seq()` เลื่อนช่วงเข้าไปทีละใบ เก็บ step แล้วรวมเป็น **ธุรกรรมเดียว**
    (ไม่งั้นผู้ใช้ต้องกด undo หลายครั้ง) · และต้อง **คืนช่วงที่เลือก** ด้วย ไม่งั้นกดปุ่มที่สองแล้วโดนไม่ครบ
- **[alpha.132r4] `content` ของ `::marker` ชนะ `list-style-type`** — ปิด marker ตอนจัดกึ่งกลาง
  ต้องสั่ง `::marker{content:none}` ด้วย ไม่ใช่แค่ `list-style:none` (ไม่งั้นได้จุดนำสองอัน)
- **[alpha.132r4] "ข้อที่ว่างเปล่า" ก็เป็นข้อ** — `docToMd` เขียน `2. ` (มีวรรคท้าย) แล้วทุกตัวอ่าน
  `rtrim` ทิ้งก่อน เหลือ `2.` · **ตัวอ่านทั้งสาม** (`md.js` · `mdToHtmlBody` · `mdToProseBlocks`)
  ต้องรับกรณีไม่มีวรรคตาม ไม่งั้นบรรทัดว่างในรายการหายทั้งไฟล์และช่องตัวอย่าง
- **[alpha.132r3] ★ ฟอนต์ของไฟล์ที่ส่งออกต้องมาจาก "ที่จอใช้อยู่จริง"** — ห้ามคำนวณใหม่จาก
  การตั้งค่า · `export-hub.liveProseFonts()` อ่าน `getComputedStyle` ของตัวแก้ไขแล้วส่งเข้า
  `proseExportCss(fmt, paper, margins, {fontStack, headingStack})`
  (บั๊กเดิม: จอใช้ `settings.fontFamily`+ฟอนต์ตามภาษา · ไฟล์ใช้ `proseFormat.fontFamily` ที่ว่างอยู่)
- **[alpha.132r3] จุดนำ/หมายเลขข้อเป็น "ตัวอักษร"** — บังคับ `content` ของ `::marker` ให้เป็น
  กลีฟตัวเดียวกับที่ `::before` วาดตอนจัดกึ่งกลาง/ชิดขวา → ขนาดเท่ากันโดยโครงสร้าง
  · รูปแบบมาจาก **อักษรตัวแรกของข้อ** ส่งเป็น **ตัวแปร CSS** (`--k-mk-color/-weight/-style`)
    บน `<li>` — **ห้ามตั้ง `color:` ตรง ๆ** ไม่งั้นข้อความทั้งข้อถูกย้อมตามอักษรตัวแรก
  · ตัวแก้ไข = `listMarkerPlugin` (editor.js) · ไฟล์ที่ส่งออก = `markerVars()` (md.js)
    **สองกลไก กติกาเดียว** — e2e `[132r3-3]` ตรวจว่าให้ผลตรงกัน
- **[alpha.132r2] `mdToProseBlocks()` ต้องคืน "ข้อความอย่างที่ผู้อ่านจะเห็น"** — ไม่ใช่ซอร์ส .md
  · ถอดเครื่องหมายด้วย `inlineDisplayText()` ของ **md.js** (ใช้ `parseInline()` ตัวจริง)
  **ห้ามเขียน regex ถอดมาร์กดาวน์ชุดที่สอง** · สแปนสีต้องรอด (ตัววาดเปลี่ยนเป็นสีจริงต่อ)
  · บรรทัดรูปล้วน = บล็อก `figure` เหมือน `proseBlocksFromDoc`
- **[alpha.132r] โหมดสี/ขาวดำมีสองสาย** — บทภาพยนตร์ผ่าน `PDF_ELEMENT_COLORS` ของ pdf-lib ·
  **นิยายผ่าน CSS** (`mdToHtml(..., {mono})` → `body,body *{color:#000 !important}`)
  · ช่องตัวอย่างต้องได้โหมดเดียวกัน (`renderProsePageView opts.colorMode` / `renderPageView opts.colorOf`)
- **text-color.js** (alpha.132, บริสุทธิ์ · **CommonJS** เหมือน md.js) — **สีตัวอักษร**:
  `normColor` (ตัวกรองค่าสีทุกทางเข้า — ไม่ผ่าน = ไม่มีสี ไม่ใช่ยัดสตริงดิบลง `style`) ·
  `COLOR_PRESETS`/`presetLabelKey` · `pushRecent`/`toggleSaved`/`normalizeColorStore` ·
  `COLOR_SPAN_RE`/`colorSpanMd` (ทางเดินของสีในไฟล์ `.md` = `<span style="color:#rrggbb">`)
  · **unit test 28 ข้อ** (`node test/text-color.test.cjs`) · เก็บที่ `settings.textColors` (**global**)
  · UI = `color-picker.js` (`openColorPicker()`) · มาร์ก `color` อยู่ใน schema ของ `editor.js`
  · **เป็น CommonJS เพราะ `md.js` ต้อง `require` ตัวนี้ได้** (md.js เป็น CJS — กฎข้อ 3)
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

ทุกตัวไม่แตะ DOM/fs (ต่อไฟล์ผ่าน `io` adapter = `kapi`) · `npm run test:unit` = **5,500+ ข้อ · 85 ไฟล์**
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
T`ข้อความไทย`                  ✗   →   t('ui.x.y')                         ✓
```

> **[alpha.128] ตาข่ายเพิ่งถูกปิดรูรั่ว** — `tools/i18n-classify.cjs` เคยนับ `t(key, 'ค่าสำรองไทย')`
> เป็น `'already'` = ผ่าน (ขัดกับกฎบรรทัดบน) ปล่อยไทยค้างในซอร์ส **143 จุด** โดยเทสไม่ฟ้อง
> ตอนนี้ `T_FALLBACK` เหลือเฉพาะ `tKey`/`tm`/`tf` ที่ใช้ค่าสำรอง/ค่าแทรกจริง
> · และ ``T`…` `` (msgid = ตัวข้อความไทย) **ต้องมีแถวในไฟล์ภาษาด้วย** ไม่งั้นแปลไม่ได้ตลอดกาล
> — ที่ `paper-color.js` เคยเป็นแบบนั้นทั้ง 6 สีโดยไม่มีใครรู้

> **⚠️ อย่าเทียบเงื่อนไขกับ "ข้อความที่แปลแล้ว"** — `pick.startsWith('เลือกจากคลัง')` ·
> `e.includes('ชื่อผู้ให้บริการ')` · `title === 'ใหม่'` ใช้ได้เฉพาะหน้าจอภาษาไทย
> พอสลับเป็นอังกฤษ **ฟีเจอร์ตายเงียบ ไม่มี error** (alpha.128 เจอ 5 จุด)
> ให้เทียบกับ `t('ui.…')` ตัวเดียวกัน หรือหาจากโครง DOM/คีย์ข้อมูลแทน

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
- **[alpha.116] ข้อยกเว้นของใหม่ให้เขียนเป็นเครื่องหมายในซอร์ส ไม่ใช่เลขบรรทัด**

  ```js
  /* i18n-skip: เหตุผลที่ไทยตรงนี้เป็นข้อมูล ไม่ใช่ข้อความ UI */
  export const SOMETHING = [ 'ไทย', 'ไทย' ];
  /* /i18n-skip */
  ```

  `SKIP_RANGES` อ้างเลขบรรทัดซึ่ง **เลื่อนทุกครั้งที่มีใครแทรกโค้ดเหนือช่วงนั้น** — รอบ alpha.116
  รอบเดียวพังสามครั้ง (builder-core · main.js · app.js) แล้วเทสฟ้องว่า "มีไทยตกค้าง" ที่บรรทัด
  ซึ่งไม่เกี่ยวอะไรเลย · เครื่องหมายติดไปกับโค้ด ย้ายไปไหนก็ยังถูก

- **[alpha.116] `renderer/index.html` อยู่ในประตูกันพลาดแล้ว** — ข้อความไทยในนั้นต้องมี
  `data-i18n` (ข้อความ) หรือ `data-i18n-title` (tooltip) หรือ `data-i18n-attr` กำกับเสมอ
  · เดิมเทสกวาดเฉพาะ `.js` จึงมีไทยค้างอยู่ 92 จุดโดยไม่มีใครรู้

### ⚠️ กฎถาวร (alpha.135) — อัปเดตมาจากรีโปเดียว · ที่อยู่เขียนได้ที่เดียว

> **การ update จะมาจากที่ https://github.com/Nbcybg/Killian-Editor-V2.git เท่านั้น**

- ที่อยู่รีโปอยู่ที่ **`src/update/update-check.js`** (`UPDATE_OWNER`/`UPDATE_REPO`) แล้ว URL
  ทุกเส้น (API · releases · raw package.json · คำนำหน้าไฟล์แนบ) **สร้างจากสองค่านั้น**
  — ห้ามเขียน URL ของ GitHub ไว้ที่อื่นในระบบอัปเดตอีก
- `build.js` แปลงไฟล์นี้เป็น `update-check.cjs` ให้ `main.js` require (ทางเดียวกับ `history-data.cjs`)
  → **ตรรกะเดียว สองฝั่ง** · ไฟล์ที่แปลงแล้วต้องอยู่ใน `package.json → build.files` ด้วย
- **main ตรวจลิงก์ซ้ำเสมอ** ก่อนดาวน์โหลด (`isAllowedAssetUrl()`) — ปุ่ม "แทนที่" อยู่ในหน้าจอ
  ซึ่งปลั๊กอิน/สคริปต์ผู้ใช้เข้าถึงได้ ห้ามเชื่อ URL ที่ renderer ส่งมา
- ทางเข้าสามทาง (ตั้งค่า · ตอนเปิดโปรแกรม · เมนูช่วยเหลือ) ต้องเรียก `checkForUpdates()` ตัวเดียวกัน
  ห้ามเขียนสายตรวจอัปเดตเส้นที่สอง
- **"เปิดโปรแกรมใหม่" = ปิดโปรแกรม** → ต้องผ่าน `confirmQuit({ quit })` เพื่อให้เห็นรายการงานค้าง
  ชุดเดียวกับตอนกดออก (กฎถาวร alpha.72)
- ประตูกันพลาด: `test/update-check.test.cjs` (66 ข้อ · ตรึงที่อยู่รีโปไว้ตรง ๆ) + e2e ชุด `[135-U]`

### ⚠️ กฎถาวร (alpha.116) — แผงใหม่ต้องมี **ปุ่มบนแถบ + เมนู + คีย์ลัด** ครบสามทาง

เพิ่มแผงใหม่หนึ่งตัว = ต้องแตะ **ห้าที่** ไม่งั้นเทสแดง (และผู้ใช้หาแผงไม่เจอ):

| ที่ | ไฟล์ | ประตูกันพลาด |
|---|---|---|
| ทะเบียนแผง | `src/panels/panel-ui.js` → `PANEL_DEFS` | — |
| element เจ้าบ้าน | `renderer/index.html` | `[80-7]` |
| ปุ่มบนแถบ | `renderer/index.html` + `TB_PANEL_BUTTONS` (app.js) + `toolbar-config.js` | `[80-7]` |
| เมนู มุมมอง → แผง | `MENU_PANELS` (main.js) | `menu:panelIds` |
| **คีย์ลัด** | `SHORTCUTS` + `SHORTCUT_LABELS` + `SHORTCUT_CATS` (core.js) | `shortcuts.test.cjs` |

จงใจไม่มีอย่างใดอย่างหนึ่ง = ต้องประกาศเหตุผลไว้ (`MENU_PANELS_SKIP` · `SHORTCUT_PANEL_SKIP`)
**ห้ามปล่อยหายเงียบ ๆ** — ที่มาของกฎนี้: alpha.69 พบว่าเมนูตกหล่นสามแผงมาตั้งแต่ .62
และ alpha.116 พบว่า **คีย์ลัดขาดไปเก้าแผง** ด้วยเหตุผลเดียวกันเป๊ะ (ไม่มีใครตรวจ)

### ⚠️ กฎถาวร (alpha.137) — ธีมสี + แถบบน (แถบเดียว)

**ธีมของโปรแกรมเพิ่มได้ แต่ต้องแตะครบสี่ที่** (ประตูกันพลาด = `test/theme.test.cjs`):

| ที่ | ไฟล์ |
|---|---|
| ทะเบียนธีม | `src/core.js` → `THEMES` + `THEME_LABEL_KEYS` (**แหล่งความจริงเดียว**) |
| ตัวแปรสี | `renderer/style.css` → `body.theme-<id> { … }` |
| ป้ายชื่อธีม | `languages/k2_*.csv` ทุกไฟล์ |
| ช่องเลือกในตั้งค่า | มีอยู่แล้ว (`#st-theme`) — ตัวเลือก **สร้างจาก `THEMES` ตอนเปิดกล่อง** ห้ามเขียนรายชื่อตายในกล่อง |
| เมนู มุมมอง → ธีมสี | สร้างจาก `toggles.themes` ที่ renderer ส่งไปให้ `main.js` — **main ห้ามมีรายชื่อธีมของตัวเอง** |

- **ธีมห้ามแตะ `--paper-*`** (ยกเว้น `--paper-surround` ซึ่งเป็นพื้น *รอบ* กระดาษ = เปลือกโปรแกรม)
  — เปลี่ยนได้แค่หน้าตาโปรแกรม ห้ามกระทบหน้ากระดาษ/งานที่ส่งออกแม้แต่นิดเดียว
- ธีมใหม่ต้องกำหนด **ตัวแปรพื้นผิวครบทุกตัว** (`--hover --hover-soft --titlebar --sunken --chip
  --danger-soft --canvas` ฯลฯ) ไม่งั้นมีพื้นผิวค้างสีของธีมเดิม (บทเรียน `[81-5]`)
- ค่าเริ่มต้นตอนนี้ = **`k2`** (จานสีประจำโปรแกรม: `#1e1250` `#452f5e` `#ff6640` `#ffc55c`)
- **[alpha.138] มีสองธีม: `k2` · `k2-light` เท่านั้น** — dark/light ของเดิมถูกลบทิ้ง
  · ค่าเก่าในไฟล์แปลงด้วย `THEME_ALIAS` **แล้วเขียนกลับลง settings** (อย่าแปลงแค่ตอนวาด)
  · **ไม่มีปุ่มธีมบนแถบ ไม่มีคีย์ลัด** (ผู้ใช้สั่ง) — ธีมอยู่ในตั้งค่า + เมนู มุมมอง เท่านั้น
- **เครื่องหมาย/เส้นที่ลากยาวเท่าความสูงของบล็อก = ระเบิดเวลาในมุมมองจัดหน้า** —
  เนื้อหาไหลเป็นสายเดียวโดยมีแผ่นกระดาษเป็นฉากหลัง บล็อกที่คาบรอยต่อหน้าจะลากเส้นทะลุช่องว่าง
  ระหว่างแผ่น (เคสจริง: `.sp-err-*` ใน alpha.138) · เครื่องหมายแบบนี้ให้สูง **หนึ่งบรรทัด** (`--sp-line-h`)
  และวางนอกกล่องด้วย `::before` absolute เสมอ

**แถบบนมีแถวเดียวแล้ว** — `#topbar` ถูกลบทิ้งใน alpha.137:
- ปุ่มโปรเจกต์ (`open-btn` · `save-all-btn` · `search-all-btn`) อยู่หัว `#toolbar`
  และอยู่ใน `LOCKED_BUTTONS` ของ `toolbar-config.js` (ผู้ใช้ซ่อนไม่ได้) —
  **ปุ่มใหม่บน `#toolbar` ต้องอยู่ใน `TOOLBAR_GROUPS` หรือ `LOCKED_BUTTONS` เสมอ** (เทส `[79-5]`)
- เส้นคั่นในแถบโปรเจกต์ใช้ `k-topsep` **ห้ามใช้ `sep`** — `setupFloatingFormatBar()`
  ลบ `.sep` ใน `#toolbar` ทิ้งทั้งหมดตอนย้ายปุ่มไปแถบลอย
- **[alpha.139] เส้นคั่นหมวด (`|`) ถูกแทรกตอนรันโดย `applyToolbarGroupSeps()`** — ต้องเรียก
  **หลัง** `setupFloatingFormatBar()` เสมอ · เขียนเส้นคั่นไว้ใน `index.html` ไม่มีประโยชน์ (ถูกลบทิ้ง)
- **[alpha.139] ปุ่มที่อยู่บนแถบลอยมีสองที่ที่ต้องตรงกัน**: รายการ selector ใน
  `setupFloatingFormatBar()` กับ `FMTBAR_IDS` (toolbar-config.js) — `toolbar-config.test.cjs`
  อ่านซอร์สมาเทียบทีละตัวตามลำดับแล้ว หลุดข้างเดียวเมื่อไหร่เทสแดงทันที
- ลูกของ `#toolbar` ตั้ง `flex:none` ทั้งหมด + แถบ `overflow-x:auto` —
  ห้ามให้ลูกยุบตัว (ข้อความจะล้นทับกันเอง) และห้ามตัดปุ่มท้ายแถวทิ้ง
- **[alpha.141r · ซ้ำรอบสองจาก 0.56a #6] อะไรก็ตามที่วาดทับ 36px บนสุดของจอ = คลิกไม่ได้**
  `#titlebar` เป็น `-webkit-app-region:drag` และ **OS คิดเขตลากจากกรอบของ element โดยไม่สนลำดับการซ้อน**
  → กล่อง/แถบที่ลอยทับแถบหัวหน้าต่างจะถูกกลืนคลิกไปเป็น "ลากหน้าต่าง" ทั้งก้อน แม้จะอยู่บนสุดในภาพ
  · ตอนนี้กัน `.k-overlay, .k-overlay *` และ `.k-float-panel *` ไว้แล้ว — **ทำ UI ลอยตัวใหม่ที่ชนขอบบน
    ต้องเจาะ `no-drag` ให้มันเองเสมอ** · เทสที่จับได้ต้องดู **กฎ CSS + กดปุ่มจริง** ไม่ใช่แค่ `elementFromPoint`
    (DOM มองไม่เห็นเขตลาก — hit-test ผ่านฉลุยทั้งที่ผู้ใช้กดไม่ได้)
- **ถอด element ออกจาก `index.html` = ต้องไล่ทุกจุดที่ผูกอีเวนต์กับมัน** —
  `$('#ที่ไม่มีแล้ว').onclick = …` โยน `TypeError` แล้ว **ทุกบรรทัดถัดไปในฟังก์ชันเดียวกันไม่ถูกผูกเลย**
  (รอบนี้อาการที่โผล่คือ "ลาก slider ซูมไม่ได้" ซึ่งอยู่คนละเรื่องกัน)

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
- **chapters-ui.js** (alpha.141) — จัดการบท (คู่แฝดของ books.js) · หน้าปกบท `draft.json → chapters[].cover`
- **read-ui.js** (alpha.141) — โหมดอ่านทั้งเล่ม + **สายหน้าของทั้งเล่ม** ที่ตัวไล่เลขหน้าใช้ร่วม

### [alpha.143] รูปกับการตัดหน้า · รูปเต็มหน้า · ผ้าคลุมพื้นโต๊ะ
- **อะไรที่ทำให้เรขาคณิตเปลี่ยนทีหลัง ต้องปลุกตัวจัดหน้าเสมอ** — ฟอนต์ (.109) · ระยะขอบ/ขนาด
  กระดาษ (.104r) · และตอนนี้ **รูปโหลดเสร็จ** (.143) · `<img>` ที่ยังไม่โหลดสูง 0 แล้วสายจัดหน้า
  ถูกปลุกด้วย "เอกสารเปลี่ยน" อย่างเดียว = ผลวัดผิดค้างทั้งเซสชัน
  · ตัวรอกลางคือ `whenImagesReady()` ใน `prose-measure.js` (โหมดอ่าน/ช่องตัวอย่างใช้ตัวเดียวกัน)
- **ตัวดักของ `watchDocImages()` ต้องกันสำเนาให้ขาด** — มุมมองหน้ากระดาษ/โหมดอ่านโคลน
  `.ProseMirror` มาครอบทีละหน้า สำเนามี `<img>` ที่ยิง `load` ใหม่ทุกครั้งที่วาด →
  **วนไม่จบ (วาด → วัด → วาด)** · เกณฑ์ที่ใช้คือ "อยู่ใน `.ed-page-clip / .sp-pageview /
  .k-xpv-doc / .k-rd-stage` หรือเปล่า" **ห้ามใช้ `contenteditable`** เพราะฉากที่ถูกล็อกก็ปิดแก้ไข
- **ตัวติดตั้งระดับหน้าต่างต้องอยู่ "ก่อนทุกทางแยก"** (คู่กับ `installTextMeasurer()`) —
  โหมดเทส `?k2test` และหน้าต่างแผงที่ฉีกออกมา **ไม่เดินผ่าน `bootSequence()`**
- **รูปสูงเกินหนึ่งหน้าไม่ได้** — บล็อกที่ตัดตามบรรทัดไม่ได้ทำให้ตัวจัดหน้าต้อง "ตัดดิบ" ซึ่ง
  `prosePosAtCut()` แปลงกลับไม่ได้ แล้วเส้นคั่นหายเงียบ ๆ (บทเรียนเดิมของ .103r)
  · เพดาน = `--page-content-h` (จอ) คู่กับ `figure.k-img-w img{max-height:<bh>in}` (ไฟล์)
  · **ห้ามใส่ `max-height` เป็นสไตล์อินไลน์ใน `figureImgStyle()`** — อินไลน์ชนะทุกกฎ CSS
- **`fit=page` = แผ่นทั้งแผ่น** — `blockRules()` ให้ `breakBefore` + `breakAfter` + `fullPage`
  (`breakAfter` ของบล็อกก่อนหน้า = `breakBefore` ของบล็อกถัดไป ใน `sliceProsePages`)
- **"ชนขอบกระดาษ" ต้องทาที่ของที่รู้ตำแหน่งกระดาษจริง ห้ามให้เนื้อหาในสายเอกสารเล็งเอง**
  (เจ็บมาสองรอบในรุ่นนี้ ทั้งคู่จับได้จาก **สกรีนช็อตของ e2e** ไม่ใช่เทสตรรกะ):
  · หน้ากระดาษแบบครอบทีละหน้า → พื้นของ `.sp-page` (`fullPageImages()` + `opts.bleed`)
  · มุมมองจัดหน้า → พื้นของ `.k-paper-sheet` (`paintFullPageSheets()`) แล้วซ่อนรูปในสายเนื้อหา
    (สายเนื้อหากับแผ่นคลาดกันได้ราวหนึ่งบรรทัดเป็นปกติ — ตระกูลเดียวกับ P-1)
  · ไฟล์ PDF → `@page k-bleed{margin:0}` + `page:k-bleed` (named page ของ CSS)
  · เลขหน้า: แผ่นที่เป็น **รูปเต็มหน้าในเนื้อเรื่อง** ไม่พิมพ์เลข · **หน้าปก** ยังพิมพ์ตามเดิม
- **ผ้าคลุมพื้นโต๊ะ (`.k-paper-mask`) = เท่าขอบกระดาษเป๊ะ ไม่เผื่อระยะตัดตก** —
  ระยะขอบล่างของกระดาษเองคือระยะตัดตกอยู่แล้ว · เผื่อเพิ่ม = ตั้งใจให้หมึกหกลงโต๊ะ
  · ต้องโตพร้อมแผ่นใน **เฟรมเดียวกัน** (`growPaperSheets`)
  · `.ProseMirror` ในโหมดกระดาษต้องเป็น **`z-index:auto`** ไม่งั้นมันสร้าง stacking context
    แล้วป้าย "หน้า N" ยกตัวขึ้นเหนือผ้าคลุมไม่ได้ (ยังอยู่เหนือแผ่นด้วยลำดับใน DOM)

### [alpha.143r2] ระยะเว้นรอบเส้นคั่นหน้า — **ต้องเป็นศูนย์ทั้งสองด้าน**
- `.ed-page-break + * { margin-top:0 }` (หัวหน้าใหม่ · alpha.93) **ต้องมาคู่กับ**
  `*:has(+ .ed-page-break) { margin-bottom:0 }` (ท้ายหน้าเดิม · alpha.143r2)
  — ตัวจัดหน้าไม่นับระยะเว้นท้ายเป็นความจุมาตั้งแต่ alpha.82 ตอนวาดจึงต้องไม่กินที่เหมือนกัน
  ไม่งั้นหน้าที่จบด้วย **รูป** (มีระยะ 1em ทั้งบน-ล่าง) บวมจนล้นเพดาน แล้ว `pad` หนีบเป็น 0 = ล้นจริง
- ทั้งสองกฎ **ต้องยกเว้นตอนวัด** (`body:not(.k-measuring)`) ไม่งั้นเรขาคณิตขึ้นกับตำแหน่งเส้นคั่น
  ปัจจุบัน = จัดหน้าไม่นิ่ง

### [alpha.143r] mask จริง · ป้ายบอกหน้าที่แถบเลื่อน · เส้นคั่นกับโหนด atom
- **`view.posAtDOM(el, 0) - 1` ใช้ได้เฉพาะโหนดที่ "มีข้างใน"** — `<p>` คืนตำแหน่งข้างใน (ลบ 1 = ก่อนบล็อก ✔)
  แต่ **โหนด atom อย่าง `<figure>` คืนตำแหน่ง "ก่อนโหนด" อยู่แล้ว** ลบอีกทีเลยไปโผล่ก่อนบล็อกก่อนหน้า
  → หน้าที่เริ่มด้วยรูปดูดย่อหน้าสุดท้ายของหน้าก่อนมาด้วย แล้วเนื้อหาล้นพื้นที่พิมพ์
  · ใช้ `posBeforeBlock()` ใน prose-measure.js เสมอ (ถามกลับด้วย `nodeDOM` ว่าตรง element ไหม)
- **ผ้าคลุมพื้นโต๊ะต้องเป็น mask ไม่ใช่แผ่นทึบ** — แผ่นทึบกินเงาของกระดาษไปด้วย ·
  ใช้ `mask-image: repeating-linear-gradient` บน `.ProseMirror` (สองตัวเลขจาก `renderPaperSheets`)
- **โหนดรูปห้าม `draggable`** — ไม่งั้นลากเลือกข้อความข้ามรูปไม่ได้ (เบราว์เซอร์เริ่มลากวัตถุแทน)
- **เกณฑ์ตัดหน้าที่ผู้ใช้ยึด: "ล้นพื้นที่พิมพ์เมื่อไหร่ = ต้องไปหน้าถัดไป"** — มีด่าน e2e วัดจากแผ่นจริง
  สองชั้น (หมึกห้ามต่ำกว่าขอบล่างพื้นที่พิมพ์ · หน้าที่วาดจริงห้ามสูงเกินที่โมเดลจองไว้)

- **รัน e2e กับตัว packaged ต้องแยก userData เสมอ**:
  `"./dist/win-unpacked/Killian 2.exe" --user-data-dir="C:/tmp/k2userdata"`
  ตัว packaged ใช้ `%APPDATA%\Killian 2` ซึ่ง **เป็นที่เดียวกับของผู้ใช้จริง** และมันจำสถานะแท็บ
  จากรอบก่อนไว้ → เปิดมาแล้วกู้แท็บค้างมาบันทึกทับไฟล์ในโปรเจกต์ทดสอบตั้งแต่ 10 วินาทีแรก
  (อาการที่เจอ: เทสบทหนัง `element ถูก classify` ได้ `["scene","action"]` ทั้งที่ fixture เพิ่งสร้างใหม่)
  · ห้ามลบ `%APPDATA%\Killian 2` เพื่อแก้ปัญหานี้ — นั่นคือข้อมูลจริงของผู้ใช้

### [alpha.142] ปก · เลขหน้า · รูปในเอกสาร
- **หน้าปกเล่ม = หน้าหน้าเล่ม** — กินแผ่นจริงแต่ **ไม่นับเลข** (`isFrontMatter`) · ปกบท**นับ** ·
  หัวบท **ไม่กินทั้งหน้า** (ฉากแรกอยู่หน้าเดียวกัน) · ส่วนหนึ่ง ๆ จึงมีสองเลข:
  `page` = แผ่นที่เท่าไร (โหมดอ่านใช้เดิน) · `startPage` = เลขที่พิมพ์ (0 = ไม่มีเลข)
- **`bookParts()` ต้องพา *ทุกธง* ที่ตัววาดใช้ไปด้วย** — ลืมใส่ `full` ไปครั้งหนึ่งแล้ว ตัววาดเห็น
  `undefined` ซึ่ง `!== false` = เต็มหน้าเสมอ · ทางเปิดจึง "ผ่าน" ด้วยความบังเอิญ ทางปิดถึงแตก
  (เทสต้องตรวจ **สองทาง** เสมอ ไม่ใช่ทางเดียว)
- **เนื้อหาในสายเอกสารล้นออกไปในระยะขอบไม่ได้** — `.ed-page-clip` เป็น `overflow:hidden`
  และนั่นคือหัวใจของการหั่นหน้า · อยากให้ภาพ **ชนขอบกระดาษ** ให้ทาที่พื้นของ `.sp-page`
  (`renderProseClipPages` → `opts.bleed(page)`) ไม่ใช่ไปเปิด overflow หรือใส่ margin ติดลบ
- **`el.style.cssText = …` ล้างสไตล์อินไลน์ทั้งก้อน** — ตั้ง `style.visibility` ไว้ก่อนแล้วโดนลบเงียบ ๆ
  (ต่อท้ายสตริง `cssText` แทน)
- **ตัวเลือกของรูป (เต็มหน้า/ความกว้าง %/ขอบมน) อยู่ที่ `md.js` ที่เดียว** —
  ไวยากรณ์ `![alt](src "fit=page w=60% r=8")` (ชื่อกำกับของมาร์กดาวน์มาตรฐาน จึงยังเข้ากันได้กับ v1)
  · **คลาส/สไตล์ก็ที่เดียว** (`figureClass`/`figureImgStyle`) ซึ่ง `toDOM` ของตัวแก้ไขและ
    `mdToHtmlBody` ของไฟล์เรียกตัวเดียวกัน · `docToMd` **ต้องประกอบบรรทัดใหม่เมื่อมีตัวเลือก**
    ห้ามคืน `attrs.md` ดิบ ไม่งั้นค่าที่เพิ่งตั้งหายตอนปิดแท็บ
- **"เต็มหน้า" ใช้ `aspect-ratio` ไม่ใช่ความสูงเป็นนิ้ว** — บนจอเอกสารถูกย่อตามซูม ถ้าตั้งเป็นนิ้ว
  ความสูงคงที่แต่ความกว้างหด แล้วตัวจัดหน้าที่วัดของจริงได้คนละค่ากับตอนพิมพ์ (`--page-ar` จาก `pageCssVars`)
- **ปุ่มระดับโปรเจกต์ต้องอยู่ใน `ALWAYS_ON_TB`** — `.tb` ทุกตัวโดน `.dis` (`pointer-events:none`)
  เมื่อไม่มีตัวแก้ไข · `open-btn`/`save-all-btn`/`search-all-btn` ตกสำรวจมาตั้งแต่ .80
  จน "เปิดโปรแกรมมาแล้วกดปุ่มเปิดโปรเจกต์ไม่ได้" (ทางตัน)
- **กับดักของเทสสองข้อที่เผาเวลาไปสามรอบในรุ่นนี้**:
  (ก) `querySelector('.k-menu')` หยิบ **เมนูค้างใบเก่า** ที่ว่างเปล่า → ใช้ `[...qsa].pop()` เสมอ
  (ข) เทสที่ทิ้งแท็บไว้แบบ **dirty** ทำให้เทสอื่นที่เทียบ "สีของแถวปกติ" หยิบแถว `k-row-unsaved`
      ไปเป็นตัวอ้างอิงแล้วแดงโดยที่โค้ดไม่ผิด — จบเทสต้อง `saveTab()` คืนสภาพ

### [alpha.141] สายหน้าของทั้งเล่ม — "อ่านทั้งเล่ม" กับ "เลขหน้าไล่ต่อเนื่อง" คือของชิ้นเดียวกัน
- **`src/book-flow.js` = ลำดับ "ส่วน" ของทั้งเล่ม** (ปกเล่ม → ปกบท/หัวบท → ฉาก) + กติกา
  **"หน้าปกกินหนึ่งหน้าเสมอ"** · บริสุทธิ์ 100% มี unit test แยก (`book-flow.test.cjs`)
- **`read-ui.js` `buildBookDoc()` → `measureBookDoc()` = ทางเดียวของการวัด** — ประกอบ HTML ด้วย
  `mdToHtmlBody()` + `proseExportCss()` แล้ววัดด้วย `measureProseBlocks()`/`sliceProsePages()`
  ซึ่งเป็นเอนจินตัวเดียวกับมุมมองจัดหน้าและช่องตัวอย่างส่งออก
  · **ห้ามเขียนตัวนับหน้าคู่ขนาน** — ทั้งโหมดอ่านและ `currentStartPage()` ต้องกินผลก้อนนี้เท่านั้น
    (กฎถาวรข้อ 5 · เทส `[141-P3]` ปักหมุดว่าสองที่ได้เลขเดียวกัน)
- **แคชสายหน้าใช้ธง `ready` ไม่ใช่ `map.size`** — เล่มที่ยังไม่มีฉากคืนตารางว่างอย่างถูกต้อง
  ถ้าใช้ขนาดตารางตัดสิน จะไล่วัดใหม่ทุกครั้งที่วาดหน้า · และ `ensureBookFlow()` ต้องเช็ค
  `bookFlowKey()` ก่อน ไม่งั้นได้วงวน: วัดเสร็จ → `refreshSpView()` → ยังไม่เจอไฟล์ → สั่งวัดใหม่
- ทิ้งแคชเมื่อ: บันทึกฉาก (`saveTab`) · เรขาคณิตเปลี่ยน (`bumpProseLayout`) · แก้ปก/ลำดับบท/เล่ม
- **ช่องติ๊กใหม่ในคุณสมบัติฉากใช้คลาส `wiki-flowchk`** ไม่ใช่ `wiki-check` — เทสหลายจุดอ้างช่องติ๊ก
  **ตามลำดับ** แทรกตัวใหม่เข้ากลุ่มเดิมเมื่อไหร่พังพร้อมกันหมด (บทเรียนข้อ 12)

### [alpha.140] แผง Navigation
- **`src/nav-model.js` = ตรรกะทั้งหมด** (กลุ่มชนิด · สถานะจุด · ค้นหา/กรอง · แบ่งหน้า · คีย์เครื่องหมาย
  · บรรทัด↔บล็อก) · app.js เหลือแค่ **สแกนเอกสาร + วาด + กระโดด** — เพิ่มกฎใหม่ = เพิ่มที่ nav-model แล้วเขียน unit test
- **ชนิดของแถวมีตารางเดียว** (`NAV_KIND_GROUP`) — `nav.js` คืนชนิดอะไรได้ ต้องมีที่อยู่ในนั้น
  (`nav-model.test.cjs` กวาดผลจริงของ `parseProse`/`parseScreenplay` มาเทียบ หลุดเมื่อไหร่แดงทันที)
- **การกระโดดมีประตูเดียว: `navGotoPos()`** — ห้ามเรียก `TextSelection.create()` เองในสาย Navigation
  (throw เมื่อบล็อกไม่ใช่ textblock) และห้ามลืมว่า **มุมมองหน้ากระดาษต้องออกจากโหมดก่อน**
  ไม่งั้นเลื่อนตัวแก้ไขที่ถูกซ่อนอยู่ = ผู้ใช้เห็นว่า "กดแล้วไม่มีอะไรเกิดขึ้น"
- **ห้ามจับคู่แถวด้วย "เลขบรรทัด" กับ "ลำดับบล็อก" ปนกัน** — .md มีบรรทัดว่างคั่นทุกย่อหน้า
  สองหน่วยนี้ไม่เท่ากัน (บั๊กมุมมองทั้งเล่มของ .126) · ใช้ `mdLineOfBlock`/`blockOfMdLine` แปลงเสมอ
- **คีย์ของสี/ดาว (`navKey`) ห้ามผูกกับตำแหน่ง** — ผูกกับ ฉาก+ชนิด+ข้อความ+ลำดับซ้ำ
  ไม่งั้นแทรกย่อหน้าข้างบนแล้วเครื่องหมายกระโดดไปติดแถวอื่น
- **แถบเครื่องมือของแผงสร้างครั้งเดียว** (`navChrome`) วาดใหม่เฉพาะ `.nav-list` —
  `refreshOutline()` ถูกเรียกทุก 400 ms ระหว่างพิมพ์ ล้างทั้งกล่องเมื่อไหร่ ช่องค้นหาหายทันที
- **ป้ายในรายการต้องเป็นข้อความล้วน** ผ่าน `md.inlinePlainText()` — ฝั่ง ProseMirror ให้
  `node.textContent` (ไม่มีเครื่องหมาย) ถ้าอีกฝั่งยังมี `**` การจับคู่ตอนกระโดดจะไม่ติดตลอดกาล
- **การจับคู่แถวข้ามสองทางอยู่ที่ `navMatchRow()` (nav-model.js) ที่เดียว** — สองฝั่งอ่าน .md
  คนละแบบโดยธรรมชาติ (ดิสก์มี `- `/`1. `/`.INT` · เอกสารไม่มี) จึงต้องมีชั้นหลวมลงเรื่อย ๆ
  · เพิ่มชนิดบล็อกใหม่ใน `navScanTab` = ต้องดูด้วยว่า `nav.js` เรียกมันว่าอะไร
- **ชนิดของฉาก (นิยาย/บท) อยู่ใน frontmatter ของ .md ไม่ใช่ `scenes.json`** —
  `r.row.format` ไม่มีค่าเสมอ · อ่านผิดที่ = ฉากบทถูกพาร์สเป็นย่อหน้านิยายก้อนเดียว
- **สภาพแผงที่อ่าน localStorage ตอน import ต้องมีตัวล้างของตัวเอง** (`resetNavUi()`)
  — `runTest()` ล้าง localStorage *หลัง* โมดูลถูกโหลดไปแล้ว ล้างแค่คีย์ไม่พอ
- **ห้ามแปะคลาสสถานะบน DOM ของ ProseMirror** — decoration (ตรวจคำผิด/ลิงก์ Wiki) สร้าง element
  ใหม่ทับเมื่อไหร่ คลาสก็หายเงียบ ๆ · ไฮไลต์ของ Navigation จึงเป็น "แผ่นทับ" ลูกของ `.pane`

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
    (ไม่มีคีย์ = ได้ไทยเหมือนเดิม ไม่พัง) · **[แก้ข้อมูลผิด alpha.128]** `languages/` กับ
    `renderer/languages/` **ไม่ได้เป็น hardlink กันแล้ว** (สำเนาที่แตกจาก zip จะเป็นคนละไฟล์) —
    แหล่งจริงคือ `languages/` แล้ว `node build.js` **ก๊อปทับ** `renderer/languages/` ให้ทุกครั้ง
    → แก้ที่ `languages/` เท่านั้น · แก้ที่ `renderer/languages/` จะถูกทับหายในการ build ครั้งถัดไป

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

### ⚠️ กฎถาวร (alpha.128) — ปุ่ม/ช่องกรอก/การลบ ต้องบอกและต้องจด

| เรื่อง | กติกา | ตาข่าย |
|---|---|---|
| **tooltip** | ปุ่มที่เป็น **ไอคอนล้วน** (ไม่มีข้อความให้อ่าน) ต้องมี `title` เสมอ · ทุก `title=` ใน `index.html` ต้องมี `data-i18n-title` คู่กัน (ไม่งั้นแปลไม่ได้ และไม่มีใครรู้จนกว่าจะสลับภาษา) | `test/ui-audit.test.cjs` |
| **input hint** | ช่องที่ **เริ่มว่างและไม่มีป้ายกำกับข้าง ๆ** ต้องมี `placeholder` · ช่องที่มีป้าย/มีค่าเดิมอยู่แล้วไม่ต้อง (placeholder โผล่เฉพาะตอนว่าง) · ห้ามฮาร์ดโค้ดไทยใน `placeholder` | `test/ui-audit.test.cjs` |
| **บันทึก** | อะไรที่ **ลบ/ย้าย/เขียนทับไฟล์ของผู้ใช้** ต้อง `logAction(source, what, {from, to})` **ที่ตัวฟังก์ชันเอง** — คำสั่งจากเมนูคลิกขวาไม่ผ่าน `handleCommand` จึงไม่ได้ `cmd:` ฟรีเหมือนคำสั่งจากเมนู/คีย์ลัด | `test/ui-audit.test.cjs` |
| **ระดับ log** | ข้อความวินิจฉัยระหว่างไล่บั๊ก = `debug` เสมอ · `info` ไว้ให้เหตุการณ์ที่ผู้ใช้ก่อจริง (alpha.128: ตัววินิจฉัยสองตัวกิน 45% ของไฟล์บันทึกจนของจริงจม) | `test/ui-audit.test.cjs` |

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
- **`tools/dead-exports.cjs` (alpha.126) — กวาด `export` ที่ไม่มีใครใช้ + โมดูลกำพร้า**
  ```bash
  node tools/dead-exports.cjs             # สรุปสามชั้น + โมดูลกำพร้า
  node tools/dead-exports.cjs --removable # เฉพาะที่ลบได้จริง
  node tools/dead-exports.cjs --modules   # โมดูลที่ไม่มีใครใน src/ import
  ```
  ⚠️ **อ่านผลให้ครบสามชั้นก่อนลบ**: "เทสเท่านั้น" = โมดูลบริสุทธิ์เปิดผิวให้เทสวัด —
  **ถูกต้องตาม convention ห้ามลบ** · "ใช้ในไฟล์ตัวเอง" = ถอดคำว่า `export` ได้ แต่โค้ดต้องอยู่
  · และก่อนลบทุกครั้ง **ถามก่อนว่ามันคือโค้ดตาย หรือ "สายที่ลืมต่อ"** — alpha.126 เจอสองตัว
  (`refreshBooksIfOpen` · `refreshOpenFloorPlan`) ที่ดูเหมือนตายแต่จริง ๆ คือบั๊กแผงค้างข้อมูลเก่า
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

## 🔌 เอนจินของ alpha.39 — **ต่อ UI ครบทั้งสามตัวแล้ว** (อัปเดต alpha.125)

หัวข้อนี้เคยเขียนว่า "logic เสร็จ รอต่อ UI" มาตั้งแต่ alpha.39 และ **ค้างอยู่อย่างนั้นข้ามหลายสิบรุ่น**
ทั้งที่สองในสามต่อไปนานแล้ว — agent รุ่นถัดมาจึงเข้าใจผิดว่ายังไม่มีใครทำ (เกิดขึ้นจริงใน alpha.125)
สถานะจริงตอนนี้:

| เอนจิน | สถานะ | ทางเข้าของผู้ใช้ |
|---|---|---|
| `panels/panel-layout.js` + `panel-store.js` | ✅ ใช้งานเต็มตัวตั้งแต่ **alpha.46** | ระบบแผงทั้งหมด (`panel-ui.js`) |
| `layout/split-layout.js` | ✅ ต่อแล้ว (`split-ui.js`) | แยกจอ `Ctrl+Shift+\` |
| `search-engine.js` | ✅ ต่อแล้วใน **alpha.125** | ค้นหาทั้งโปรเจกต์ `Ctrl+Shift+F` + แผงค้นหา |

### search-engine.js (ข้อ 33 — full-text search)
`global-search.js` เป็นผู้ใช้เพียงรายเดียว และเป็นเจ้าของ **แคชดัชนีระดับโมดูล**:

```js
import { ensureSearchIndex, runProjectSearch, invalidateSearchIndex } from './global-search.js';
const hits = await runProjectSearch('ทอร่า เค้ก', { includeJson: false });
// hits: [{ file, name, type, score, matches:[{line, text}] }]
```
**กฎ**: อะไรที่แก้เนื้อไฟล์ต้องเรียก `invalidateSearchIndex()` (ตอนนี้ `saveTab` + `loadProject` เรียกให้แล้ว)
· ห้ามเขียนตัวสแกนไฟล์ของตัวเองขึ้นมาใหม่ — ก่อน alpha.125 มีสองก๊อปในไฟล์เดียวกันจนแก้บั๊กพลาดตลอด

### RAG chat (`ai/ai-chat.js`, สเปกข้อ 79)
✅ ต่อแล้วใน alpha.125 — เป็น **ระดับการเข้าถึง "เฉพาะส่วนที่เกี่ยวข้อง"** ในแผงแชท AI
(`collectRelevant()` ใน `ai/ai-chat-panel.js`) · ทำงานออฟไลน์ได้เพราะ `AIClient.embed()`
ตกกลับไปใช้ `localEmbed()` เองเมื่อไม่มีคีย์ · ดัชนีล้างด้วย `invalidateChatRag()`

