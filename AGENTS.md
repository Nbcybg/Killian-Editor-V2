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
ปัจจุบัน **5,902 checks · ALL OK** (alpha.166 รอบ 2 · macOS · Windows alpha.165 = 5,841 · บางรอบ ±2 = เทสเดิมที่มีเงื่อนไขตามจังหวะ) — ห้ามทำให้จำนวนลดลง
(unit `npm run test:unit` = **10,605 ข้อ · 148 ไฟล์** · ~55 วินาที · alpha.166)
**[alpha.167 · Linux/คอนเทนเนอร์]** ใช้ `--use-angle=swiftshader --enable-unsafe-swiftshader` แทน `--disable-gpu` (เทส `[166-M]` ต้องมี WebGL) ·
ไม่มีฟอนต์ Segoe UI = เทสวัดความกว้าง `[164-R2-1]` แดง → ตั้ง `~/.config/fontconfig/fonts.conf` ให้ `Segoe UI`/`system-ui` ชี้ `Liberation Sans` ·
`KILLIAN_USERDATA=/tmp/k2ud` แยกข้อมูลผู้ใช้ทุกรอบ
**[รอบต่อ 4 · Windows] `node_modules/.bin/electron` ที่ sync มาจาก mac ใช้ไม่ได้ (`bad interpreter`)** — รัน `./node_modules/electron/dist/electron.exe .` ตรง ๆ
**[alpha.157]** `KILLIAN_USERDATA=<dir>` = แยกโฟลเดอร์ข้อมูลผู้ใช้ (เทส/พัฒนาไม่แตะเลย์เอาต์จริง) · `KILLIAN_NO_SPLASH=1` ·
ตัวแปรสีอยู่ `renderer/themes/*.css` (style.css ห้ามมี hex ของเปลือกโปรแกรม · ตัวอักษรบนพื้น accent ใช้ `--on-accent`/`--on-accent-hi`) ·
เมนูย่อย: `popupMenu` รับ `sub`/`swatch`/`checked` · ฟังก์ชันที่เปิดเมนูเองใช้เป็นเมนูย่อยผ่าน `menuItemsOf(fn)` ·
สถานะฉาก: แหล่งเดียว `allStatuses()` (ลำดับ/ซ่อน อยู่ใน project.khn.json) · Kanban ฟัง `kapi.onLocalWrite` + `k2-statuses-changed`
**[alpha.148] ปลั๊กอินของโปรเจกต์ต้องได้รับอนุญาตก่อนรัน** — เทสที่พึ่ง `Plugins/*` ของ fixture ต้อง
`await untrustProjectPlugins()` → (เช็คสภาพยังไม่อนุญาต) → `await trustProjectPlugins()` → `loadPlugins()`
เพราะการอนุญาตเก็บใน userData **ข้ามรอบเทสได้** · การเขียนไฟล์ทั้งหมดผ่าน `fs-safe.cjs` (atomic, ไม่ fsync — ~22ms/ไฟล์)
**[alpha.147] บน macOS ไม่มี xvfb** — รัน `KILLIAN_TEST=1 KILLIAN_TEST_PROJECT=/tmp/k2proj ./node_modules/.bin/electron .`
เป็นคำสั่งเดี่ยวของมันเอง (ต่อ `;`/`&&` กับคำสั่งอื่นแล้วตายกลางทาง → อ่านผลของรอบเก่า) · เช็คผลด้วยเนื้อหาใหม่เสมอ
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
- **ai/ai-agents.js** (บริสุทธิ์ · unit `ai-agents`) — System prompt ของผู้ใช้ (`withUserSystem` = วางนำหน้า system ของ **ทุก** คำขอ
  · ต่อไว้ที่ `complete`/`completeStream` ใน ai-provider-ui + ทางเก่า `callAI`/`AIClient` · กันซ้ำด้วย `startsWith`)
  · ทะเบียน Agent `meta.ai.agents[]` (`newAgent/upsertAgent/removeAgent/moveAgent/agentRefText`) · `buildRewritePrompt`/`cleanRewriteOutput`/`resolveRange`
  **ฟีเจอร์ AI ใหม่ห้ามต่อ system prompt ของผู้ใช้เอง** — ผ่าน `complete`/`completeStream` แล้วได้ให้อัตโนมัติ
- **ai/ai-agents-ui.js** — กล่องเพิ่ม/แก้ Agent + นำเข้าอ้างอิง `.txt` (นอกโปรเจกต์ → ก๊อปเข้า `References/`)
- **ai/ai-rewrite-ui.js** — "Rewrite this" (คลิกขวาที่ข้อความที่เลือก → แถบลอย) · แทนที่ผ่าน `insertText`/`insertLines`/`insertScript`
  · e2e ชุด `[RW]` อ่านคำขอจริงจากเซิร์ฟเวอร์จำลอง (`GET http://127.0.0.1:8931/v1/last`)
- **ai-analyzer-ui.js** (alpha.60r3) — แผง "🧠 AI วิเคราะห์" (**ตัวอย่างหน้าตา** มีป้ายกำกับ ไม่หลอกว่าเป็นผลจริง)
- **ai/ai-doctor.js** (alpha.164 · บริสุทธิ์ · unit `ai-doctor`) — การ์ด **🩺 ตรวจบท** 5 ใบของแผงวิเคราะห์:
  `dialog` บทสนทนาไม่เป็นธรรมชาติ · `drag` จังหวะอืด · `logic` ปมไม่สมเหตุสมผล · `ooc` Out of character · `tone` โทนตลก/ดราม่า
  · ชั้นคำนวณเองให้แค่ **สัญญาณ** (คลังคำ + สรรพนาม/คำลงท้ายต่อตัวละคร + แถบโทนรายฉาก) — คำตัดสินเป็นของชั้น AI
  · `extractDialogue()` = บทภาพยนตร์อ่านจาก `parseScript` ตัวจริง (ผู้พูดแม่น) · นิยายเดาผู้พูดจากชื่อนอกเครื่องหมายคำพูด
  · **ai-analyze.js import ตัวนี้ทางเดียว** — ตัวช่วยนับข้อความย้ายไป `ai/ai-text.js` (ai-analyze ส่งต่อชื่อเดิมให้โค้ดเก่า)
  · คำตอบ AI ของตรวจบทมีช่องเพิ่ม `quote` · `character` · `adjust` (โทน) · ตัววาดอยู่ `ai-doctor-ui.js`
  · **ห้ามประกอบคีย์ภาษาจากชิ้นส่วน** (`tt(prefix + k)`) — ตัวตรวจไฟล์ภาษามองไม่เห็น ใช้ตารางคีย์เต็ม (`REASON_KEYS`)
- **onset-diff.js / onset-plugin.js / onset-ui.js** (alpha.164) — **ฉากมีปัญหา (แก้ปัญหาหน้ากองถ่าย)** = ระบบ *เทียบ* ไม่ใช่กู้คืน
  · คลิกขวาที่ฉาก → "ฉากมีปัญหา" = เก็บฉบับเดิมที่ `<โปรเจกต์>/OnSet/<sceneId>.json` · **ไฟล์ .md = ฉบับแก้ไขเสมอ**
  · `onset-plugin` ติดอยู่ในตัวแก้ไขทั้งสองชนิด (เฉยจนกว่าจะสั่ง `setOnsetCompare`) · เทียบทีละบล็อกด้วย LCS (`diffBlocks`)
    → แถบสี `.k-onset-line` + ! `.k-onset-bang` (กว้างสุทธิ 0 — **ห้ามทำให้กินที่** จัดหน้า/นับบรรทัดจะเพี้ยน)
  · ดูฉบับเดิม = **สลับ EditorState ในตัวแก้ไขตัวเดิม** (ไม่มีตัวแก้ไขตัวที่สอง) · ระหว่างนั้น `getMarkdown/getAlignMap/getText/
    mdLineCounts` ถูกครอบให้คืนฉบับแก้ไข · ตัวเขียนทุกตัวกลับฉบับแก้ไขก่อน · ปลั๊กอินปฏิเสธธุรกรรมที่แก้เนื้อ
  · **ทางใหม่ที่อ่าน `view.state.doc` ตรง ๆ เพื่อส่งออก/รายงาน ต้องใช้ `revisedDoc(tab)`** ไม่งั้นส่งออกขณะดูฉบับเดิมได้ฉบับเดิม
  · `handleCommand` เรียก `onsetBeforeCommand(ch)` ทุกคำสั่ง (ยกเว้น `VIEW_ONLY`) = พิมพ์/ส่งออก/บันทึก ยึดฉบับแก้ไข
  · e2e `[164-O]` คลิกขวาจริง · กดชิปจริง · วัดตำแหน่ง ! จริง · unit `onset` (diff + ปลั๊กอินบน EditorState จริง)
- **core.js** — `$`, `el`, `state`, `smart`, `log`, `setStatus`, ค่าคงที่ (`DEFAULT_SETTINGS`, `SCENE_STATUSES`, `SCENE_COLORS`, `BUILTIN_CATS`, `CAT_ICON`, `BASE_ED_FS`, ...) — **ทุกโมดูลใหม่ import จากที่นี่**
- **app.js** (~16,000 บรรทัด · alpha.160 — ตัวเลขเดิม "~5,300" ล้าสมัยมาหลายสิบรุ่น ก่อนแยก selftest ไฟล์นี้ยาว ~45,800) — orchestrator: bootstrap, explorer (buildTree/tree), tabs, toolbar (floatBar), commands, shortcuts, zoom
- **selftest.js** (~30,000 บรรทัด · alpha.160) — e2e ในตัวโปรแกรม `runTest()` **แยกออกจาก app.js แล้ว** ด้วย `tools/split-selftest.cjs`
  · ชื่อภายในของ app.js ที่เทสใช้ = `export { … }` ท้าย app.js + `import { … } from './app.js'` หัว selftest.js
  · เทสใหม่ที่อ้างฟังก์ชันภายในตัวใหม่ → เติมทั้งสองที่ (ลืม = build ฟ้อง `No matching export` ไม่พังเงียบ)
  · เครื่องมือที่เคยหา "บล็อกเทสใน app.js" จากตำแหน่ง `async function runTest(` (`i18n-classify` · `ui-audit`) ถือว่า **ทั้งไฟล์ selftest.js** เป็นโซนเทสแล้ว

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
| **คีย์ลัด** | ช่อง `shortcut` ของ `toggle-panel:<id>` ใน **`icons/commands.csv`** (alpha.147) + `SHORTCUT_LABELS` + `SHORTCUT_CATS` (core.js) | `shortcuts.test.cjs` · `commands-registry.test.cjs` |
| **ไอคอน** | ช่อง `icon` ของ `toggle-panel:<id>` ใน `icons/commands.csv` (ห้ามใส่ `icon:` ใน PANEL_DEFS) | `commands-registry.test.cjs` |

จงใจไม่มีอย่างใดอย่างหนึ่ง = ต้องประกาศเหตุผลไว้ (`MENU_PANELS_SKIP` · `SHORTCUT_PANEL_SKIP`)
**ห้ามปล่อยหายเงียบ ๆ** — ที่มาของกฎนี้: alpha.69 พบว่าเมนูตกหล่นสามแผงมาตั้งแต่ .62
และ alpha.116 พบว่า **คีย์ลัดขาดไปเก้าแผง** ด้วยเหตุผลเดียวกันเป๊ะ (ไม่มีใครตรวจ)

### ⚠️ กฎถาวร (alpha.147) — ไอคอน + คีย์ลัด อยู่ใน "ทะเบียนคำสั่ง" ห้ามฝังในข้อความ

> ผู้ใช้: **"แยก icon กับข้อความ · เปลี่ยนก็แค่ใส่ svg ใหม่ลงไปใน folder svg โดยใช้ชื่อเดิม ·
> ทำ csv ของทุกคำสั่ง (ย้ำว่าทุกคำสั่ง) · ไม่ต้องการไอคอนก็ blank · shortcut ต้องแยก เพราะคุณชอบลืมใส่ใน ui"**

```
icons/svg/<ชื่อ>.svg   รูปไอคอน — เปลี่ยนรูป = วางไฟล์ใหม่ชื่อเดิม
icons/commands.csv     command_id,icon,shortcut — สามช่องเท่านั้น (alpha.154) · icon ว่าง = ไม่มีไอคอน · หลายคีย์คั่น " / "
icons/glyphs.csv       name,glyph — ตัวสำรองของชื่อที่ยังไม่มี svg
  └─ node build.js → tools/commands-data.cjs → src/generated/commands-data.js (+ commands-data.cjs ให้ main)
```

| จะทำ | ทำแบบนี้ | ห้าม |
|---|---|---|
| ปุ่มใหม่ใน `index.html` | `data-command="<คำสั่ง>"` + `data-i18n-title` → `applyCommandUi()` ใส่ไอคอน + tooltip + คีย์ลัดให้ | `data-icon` บนปุ่ม · `title="… (Ctrl+X)"` |
| เมนูระบบใหม่ (main.js) | `click: cmd('ch', ...args)` → accelerator มาเอง | `click: () => send(…)` (ไม่ได้คีย์ลัด) · `ttf(key, C, S)` |
| ป้าย/tooltip ที่สร้างในโค้ด | `withCommandShortcut(text, id)` · ไอคอน `commandIcon(id)` | `formatShortcut('KeyB', …)` ของคำสั่งที่มีในตาราง · `withShortcut` (ถอดแล้ว) |
| ประโยคที่เอ่ยถึงคีย์ลัด | `กด {sc:save-all} เพื่อบันทึกทั้งหมด` ในไฟล์ภาษา | พิมพ์ `Ctrl+Alt+S` ลงไป (ผู้ใช้ตั้งใหม่ได้ · mac เป็น ⌥⌘) |
| ข้อความในไฟล์ภาษา | ข้อความล้วน | อีโมจินำหน้า/ท้าย · `"กด 📌 …"` (เขียนเป็นชื่อปุ่มแทน) |
| เพิ่มคำสั่งใน `handleCommand` | `node tools/commands-sync.cjs` แล้วเติมช่อง icon/shortcut ใน CSV · **เพิ่มแถว `ui.tip.<command_id>` (คำอธิบาย) ในไฟล์ภาษาทุกไฟล์** · `node build.js` | แก้ `src/generated/*` มือ · ปล่อยคำสั่งไม่มีคำอธิบาย (`commands-registry.test.cjs` แดง) · พิมพ์คีย์ลัดลงคำอธิบาย |
| แผงใหม่ | ไอคอน/คีย์ลัดที่แถว `toggle-panel:<id>` | `icon:` ใน PANEL_DEFS · `icon:` ใน FAB_ACTIONS |

- **คีย์เฉพาะที่ไม่ใช่คำสั่ง** (Enter/Shift+Enter ในช่องแชท · Ctrl+Z/D/[ ] ของกระดานวางแผน · Esc) เขียนเป็นข้อความได้ —
  ไม่ใช่ของตาราง SHORTCUTS
- **เมนูระบบแสดง SVG ไม่ได้** (ข้อจำกัดของ Electron) → ไอคอนใช้กับ UI ใน renderer เท่านั้น
- ไอคอนประดับที่ไม่ใช่คำสั่ง (ปุ่มหน้าต่าง · หัวกลุ่มในกล่องตั้งค่า) ใช้ `data-icon="<ชื่อ>"` ในเทมเพลต + `initIcons(root)`
- ประตูกันพลาด: **`test/commands-registry.test.cjs`** (คำสั่งครบ · ไฟล์ generated ตรง CSV · ชื่อไอคอนมีจริง ·
  ไฟล์ภาษาไม่มีอีโมจิ/คีย์ลัดฝัง · `{sc:}` ชี้คำสั่งที่มีคีย์ลัด · main.js ใช้ `cmd()`) + e2e ชุด `[147]`

### ⚠️ กฎถาวร (alpha.156) — **ไฟล์ทะเบียนแก้ผ่านคิว · ชื่อไฟล์ฉากต้องว่างจริง · เขียนลับหลังแท็บต้องบอกแท็บ**

ที่มา: รอบสำรวจบั๊ก alpha.156 เจองานหาย 5 ข้อ ต้นตอซ้ำกันสองแบบ — แก้แค่ในทาง AI แต่ทางคลิกยังพัง ·
อ่าน JSON ไว้ตอนเปิดแล้วเขียนก้อนเก่าทับทั้งไฟล์

| จะทำ | ทำแบบนี้ | ห้าม |
|---|---|---|
| แก้ `scenes.json` / `draft.json` | `mutateJson(kapi, file, (d) => { …แก้ d… })` (`src/json-store.js`) — อ่านสดในคิวของไฟล์ · คืน `false` = ไม่เขียน | `readJson` ตอนเปิดกล่อง/แผง แล้ว `writeFile(JSON.stringify(d))` ทีหลัง · เรียก `saveTab`/`updateSceneRow` **ข้างใน** fn (รอตัวเอง = ค้าง) |
| ตั้งชื่อไฟล์ฉากใหม่ | `freeSceneFileName(dPath, folder, order, takenSet)` (scene-ops.js) | `'scene-' + order + '.md'` ตรง ๆ |
| ปิดแท็บก่อนย้าย/ลบโฟลเดอร์ | `await closeTabsUnderPath(dir, { save })` (app.js) | `startsWith(prefix)` ไม่มีตัวคั่น · `closeTab()` ที่ไม่ await ของแท็บที่ค้าง |
| เขียน frontmatter ของไฟล์ที่อาจเปิดอยู่ | ตามด้วย `syncOpenTabMeta(file)` | ปล่อยให้แท็บถือ `meta` เก่า (บันทึกครั้งถัดไปเขียนทับ) |
| เขียน **เนื้อ** ฉากนอกตัวแก้ไข | ผ่าน `tabHandle(path)` (tab-bridge.js) — ค้าง = `setText` · ไม่ค้าง = เขียนดิสก์แล้ว `reloadFromDisk()` | เขียนดิสก์ตรง ๆ ขณะแท็บเปิด — `saveTab` จะมองเป็น "แก้นอกโปรแกรม" แล้วถามผู้ใช้ (disk-conflict.js) |
| ย้าย/เปลี่ยนชื่อไฟล์ .md หรือโฟลเดอร์บท | `moveSnapshots(old, new)` หลังย้าย | ปล่อยประวัติเวอร์ชันค้างที่ path เดิม |
| ค่าที่อาจมีหลายบรรทัดใน frontmatter | ผ่าน `dumpMdFile` เท่านั้น (escape ให้เอง) | ประกอบ `key: value` เอง |
| ปิด/เปลี่ยนโปรเจกต์ | อ่าน `allDirtyList()` (ทะเบียนงานค้าง) | เช็คแค่ `state.tabs` |

ประตูกันพลาด: unit `json-store` · `frontmatter` · `disk-conflict` · `project-doctor` + e2e `[156-1…7]`
เครื่องมือกู้ของที่พังไปแล้ว: **เครื่องมือ → ตรวจสุขภาพโปรเจกต์** (`project-doctor.js` / `project-doctor-ui.js`)

### ⚠️ กฎถาวร (alpha.167) — **หยิบใส่ · ส่งออกจากแผง · แผนที่พิกัดจริง · แผงลอย**

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| ของที่ลากได้ใหม่ (แหล่ง) | `setDrag(e.dataTransfer, kind, item)` (`src/drop-kit.js`) — ใส่ `text/plain` = ชื่อให้เอง · `effectAllowed` ต้องมี `copy` (`copyMove`) | `setData('text/k2-…', …)` เอง · `effectAllowed = 'move'` เฉย ๆ (ปลายทางที่ `dropEffect='copy'` = ปล่อยไม่ได้เงียบ ๆ) |
| ปลายทางรับของใหม่ | `bindDropTarget(el, { accept, onDrop })` → ได้ `{kind, items}` รูปเดียวทุกชนิด · แผงที่มีตัวรับเองต้องขึ้นทะเบียนใน `OWN` ของ `src/panel-drop.js` (ป้ายข้างเคอร์เซอร์) | อ่าน `dataTransfer.getData()` เองแยกชนิด · แผงที่ไม่รับอะไรเลย (ตัวกลางเปิดของให้อยู่แล้ว — ลากภายในของตัวเองต้องเข้า `SKIP`) |
| ฉาก/โน้ตที่ปล่อยลงตัวแก้ไข | ตัวกลางดักระยะ capture แล้ว "เปิด" · เอนทิตี้ = ProseMirror แทรกชื่อจาก `text/plain` | ให้ ProseMirror แทรกชื่อฉากลงเนื้อเรื่อง |
| ส่งออกจากแผง | แถวใน `PANEL_EXPORTS` (`src/panel-exports.js`) **คู่กับ** `PANEL_EXPORTS_MENU` (main.js) — unit `panel-exports` ตรวจว่าตรงกัน · ตัวส่งออกของแผงรับ `outPath` (เทสไม่เปิดกล่องบันทึก) | ทางส่งออกเส้นที่สองนอกตัวของแผง · `<a download>` |
| เมนู "ส่งออก" ระดับบนสุด | ศูนย์รวมการส่งออก + เวิร์กโฟลว์ + ทุกแผง + ของระดับโปรเจกต์ อยู่ที่นี่ที่เดียว | ใส่ทางส่งออกกลับไปในเมนูไฟล์ |
| ยกแผงลอยขึ้นบนสุด | `raiseFloat(pop)` (z-index 66–75) | ย้าย DOM (`insertBefore`) — ล้าง scrollTop ของทุกกล่องข้างใน (Explorer เด้งขึ้นบนสุด) |
| ลากแผงลอย | ผนึกเฉพาะเป้าชัด (`detectSnapTarget(…, { strict:true })`: หัวแผง · แถบแท็บ · ขอบพื้นที่ทำงาน · แถบขอบแคบ ≤ 36px) · Ctrl ค้าง = ย้ายอย่างเดียว | โซนกลางแผงกว้าง 25% ตอนย้ายแผงลอย (ปล่อยตรงไหนก็ผนึกกลับ = "ดีดกลับ") |
| พิกัด/ระยะบนแผนที่ | `geoOf` · `metersPerUnit` · `distMeters` · `toLatLon`/`fromLatLon` (maps.js · หน่วยภายใน = % ความกว้าง ทั้งสองแกน ใช้ `map.aspect`) | คิดระยะจาก % ตรง ๆ (แกนตั้งยาวไม่เท่าแกนนอน) |
| โซนของแผนที่ | `map.zones` วาดเป็น SVG ชั้นล่างสุด (`.map-zones` z-index 1 < เส้นทาง 3 < หมุด 4) | วาดโซนทับหมุด |
| เปิดแผนที่ใบหนึ่งจากที่อื่น | `openMapById(id)` / `focusMapPin(...)` (ตั้ง `view.wantId` ก่อนวาด — ตัววาดที่วิ่งซ้อนเลือกใบนี้) | `openMaps()` แล้วค่อยตั้ง `currentId` (วาดสองรอบ · รอบที่เสร็จทีหลังทับกลับ) |
| รายชื่อเอนทิตี้อย่างเดียว | `loadAllEntities({ entitiesOnly: true })` | `loadAllEntities()` เต็ม (อ่านทุกฉาก — ช้าตามขนาดโปรเจกต์) |
| label ของ `popupMenu` ที่มีข้อความผู้ใช้ | `text:` (หรือ escape เอง) | `label:` + ชื่อที่ผู้ใช้ตั้ง (label เป็น HTML) |

### ⚠️ กฎถาวร (alpha.166) — **ไอคอน Nerd Fonts · Story Network กล้องเดียว · แถบสถานะนิ่ง · ธีมก่อนเฟรมแรก**

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| ไอคอนใหม่ / เปลี่ยนไอคอน | แถวใน `icons/glyphs.csv` = `name,nf,glyph` · `nf` = ชื่อจาก https://www.nerdfonts.com/cheat-sheet (`nf-md-…`) · `glyph` = ตัวอักษรล้วน (ไฟล์ส่งออก) · `node build.js` สร้างทั้ง svg และอักขระของฟอนต์ `K2 Icons` | ไฟล์ svg จากชุดอื่น (ปนสไตล์) · อีโมจิ · ชื่อ nf ผิด (build ล้มพร้อมบอกแถว) |
| ไอคอนในข้อความที่ **ออกนอกโปรแกรม** (ไฟล์ส่งออก · ข้อความถึง AI · svg/png ที่ส่งออก) | `gt('ชื่อ')` หรือ `plainIcons(ข้อความจากจอ)` (icons.js) | `gi()` — อักขระ Private Use เป็นกล่องทันทีที่ออกนอกโปรแกรม |
| ผืนวาด (canvas · fabric) ที่วาดอักขระไอคอน | ใส่ `"K2 Icons"` ในสแตกฟอนต์ (`ICON_FONT`) | สแตกที่ไม่มีฟอนต์ไอคอน |
| สแตกฟอนต์ใหม่ใน style.css | ลงท้าย `var(--thai-net)` (มี `"K2 Icons"` อยู่ในนั้นแล้ว) · `size-adjust` ของฟอนต์ = `ICON_SCALE` ของ tools/commands-data.cjs | แก้ค่าที่เดียว (ไอคอนในข้อความกับบนปุ่มขนาดไม่เท่ากัน) |
| เทสที่เทียบข้อความบนจอที่มีไอคอน | `includes(gi('ชื่อ'))` | พิมพ์อักขระ/อีโมจิลงเทส (เปลี่ยนชุดไอคอนแล้วเทสแดงทั้งชุด — alpha.166 แก้ไป 20 จุด) |
| กล้องของ Story Network | `this._cam` = `{tx,ty,tz,scale,rx,ry,mode3D}` (network-camera.js) · ฉายด้วย `rot3` + `_rot()` (มุมที่ใช้จริง/กำลังหมุน) · จุดบนจอ `screenOf(p)` | เก็บกล้องเป็นระยะเลื่อนพิกเซล · หมุนรอบ (0,0,0) · `project3D` แยกของตัวเอง (`_cx/_cy/_scale` เป็น getter/setter ของกล้องตัวเดียว ไว้ให้โค้ด/เทสเดิม) |
| ตรรกะของผังใหม่ (โฟกัส · เส้นทาง · ข้อสังเกต · ฉากหลัง · โมเดล) | โมดูลบริสุทธิ์ `network-insights.js` / `network-scene.js` + unit test · UI = `network-inspector.js` · วาดพื้น = `network-bg.js` | ตรรกะก้อนใหม่ใน network.js |
| ค่าฉากหลัง/โมเดลของผัง | `net.updateScene(patch)` (บันทึกหน่วง 400ms → `settings.netScene` ของผลงาน) · ทางไฟล์ = สัมพัทธ์ในโปรเจกต์ (`Images/…` `Models/…`) | ทางเต็มของเครื่อง · `../` |
| three.js | บันเดิลแยก `renderer/net3d.js` (build.js) โหลดผ่าน `loadNet3D()` เมื่อใช้ · อยู่ devDependencies | `import 'three'` ใน src ที่เข้า bundle หลัก |
| ช่องบนแถบสถานะที่ข้อความยาว/สั้นสลับกัน | อยู่ใน `#status-right` (ล็อก "กว้างได้ ห้ามหด" อัตโนมัติ — statusbar-lock.js) · สภาพที่รู้ล่วงหน้าใช้ `reserveStatusWidth(el, [ข้อความยาวสุด])` | ปล่อยความกว้างตามข้อความ (ช่องอื่นเลื่อนทุกครั้งที่สถานะเปลี่ยน) |
| ตำแหน่งบนจอของผัง (วาด · คลิก · ลาก · พื้น) | `this._pj()` (makeProjector: มุมมองระยะ `view(p).f` · `proj` · `planeAt` · `deltaToWorld(dx,dy,f)`) | คำนวณ rot3/camOffset เองแยกทาง (มุมมองระยะเปิดอยู่ = ตำแหน่งคลาดกับที่วาด) |
| ของที่ผังวาดตามลำดับเรื่อง | `sceneOrder` / `storyProgress` (network-insights.js) · โหนดฉากมี `seq` จาก loadAllEntities (เล่ม→บท→ฉาก ตาม order) | ใช้ลำดับโฟลเดอร์/ลำดับใน scenes.json ดิบ |
| หน้าต่างใหม่ (BrowserWindow) | `backgroundColor: themeBg(ธีม)` + ส่ง `?theme=` ให้ `theme-boot.js` · เปลี่ยนธีม = broadcast `{kind:'theme'}` | สีพื้นตายตัว (แวบสีธีมเก่า) |

### ⚠️ กฎถาวร (alpha.164 · รอบต่อ) — ปุ่มลัด · เทมเพลตตั้งค่า · พื้นที่เขียน · ภาษาอังกฤษ

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| แสดงรายการปุ่มลัด | `shortcutSheetRows()` (หนึ่งคำสั่ง = หนึ่งแถว · สองปุ่มโชว์ `A / B`) · จัดหมวดด้วย `SHORTCUT_CATS`/`shortcutCat` | วน `SHORTCUTS` ตรง ๆ (คำสั่งใน `ALIAS_OK` ขึ้นสองแถวชื่อซ้ำ) |
| ข้อความในกล่องตั้งค่า | `tx('คีย์')` ในเทมเพลตเอง · `settingsTemplate()` ไม่มีพารามิเตอร์ | ส่งอาร์เรย์ค่าเรียงตามตำแหน่ง (ถอดแล้ว — สลับช่องเดียว ป้ายเลื่อนทั้งกล่อง) |
| ความกว้างขั้นต่ำของพื้นที่เขียน | `MIN_CANVAS_PX` (panel-layout.js · 420) **คู่กับ** `.k-dock[data-dir="row"] > .k-flex-child{min-width}` — unit `panel` ตรวจว่าเท่ากัน | แก้ที่เดียว |
| เลื่อนแนวนอนเมื่อแผงแคบกว่ากระดาษ | `centerPage()` → `pageScrollTarget()` (จัดกลางกระดาษถ้ายังเห็นข้อความครบ · ไม่งั้นคอลัมน์ข้อความ/ต้นบรรทัด) | ตั้ง `scrollLeft = (scrollWidth − clientWidth)/2` เอง (ต้นบรรทัดหลุดซ้ายเพราะขอบซ้าย > ขวา) |
| เทส e2e ที่ลากบนกระดานวางแผน | ความคลาดเคลื่อนคิดตามซูม (`1/zoom` หน่วยต่อพิกเซล) · เลื่อนมุมมองให้จุดอยู่ในจอ | ±3 หน่วยตายตัว (ผืนผ้าใบแคบ = ซูม 0.3 = พลาดเงียบ) |
| คีย์ภาษาใหม่ (อังกฤษ) | คำแปลจริงเสมอ — `k2_en.csv` แปลครบแล้ว · ด่าน `i18n-locale` ยอมไทยได้เฉพาะ 3 คีย์ที่ตั้งใจ | ใส่ไทยลง en "ไว้ก่อน" (ด่านแดงทันที) |
| คำสั่งถึง AI ในไฟล์ภาษา | แปลเนื้อ แต่คงโครง (JSON ตัวอย่าง · บล็อก `k2` · `###`/`@` ของบท · `{{ }}`) · ตัวอย่าง JSON ที่มี `<…>` ต้องอยู่ใน `HTML_IN_TEXT_OK` ของ `i18n-keys` | แปลชื่อฟิลด์ JSON/ชื่อคำสั่ง |

### ⚠️ กฎถาวร (alpha.164 · รอบต่อ 2) — ภาษาอังกฤษบนแอปจริง · พหูพจน์ · ข้อความที่สร้างตอนบูต

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| จำนวน + คำนามในไฟล์ภาษาอังกฤษ | `{0} {0\|page\|pages}` (ตัวเลขยังเป็น `{0}` แยก · ไทยเขียน `{0} หน้า` ตามเดิม) — `formatMsg` · `hf`/`txf` · `tf` ของ main รู้จักครบ | `{0} pages` เปล่า ๆ (ได้ "1 pages" · unit `en-ui-round2` ฟ้อง) · ตัวแทนค่าเขียนเอง `.replace('{0}', …)` |
| ป้ายใต้ตัวเลขสถิติ (การ์ดแดชบอร์ด/วิเคราะห์) | `ui.dash.statBooks/Chapters/Scenes` (พหูพจน์) | `ui.common.scene2` (เอกพจน์ = "2 Scene") |
| ข้อความของปุ่ม/ตารางที่สร้าง "ตอนบูต/ตอน import" | เก็บ **คีย์** แล้วแปลตอนวาด: `makePanelButton({ titleKey })` · getter `get label() { return t(key) }` · กระจายวัตถุที่มี getter ด้วย `Object.assign` ลงวัตถุเดิม | `title: t('…')` ตอนบูต (ไฟล์ภาษายังโหลดไม่เสร็จ/เปลี่ยนภาษาทีหลัง = ค้างไทย) · `{ ...d }` กับวัตถุที่มี getter (แช่ค่าไว้) |
| ภาษาตอนบูต | ภาษาที่โหลดอยู่แล้ว (`i18n.lang`) + `bootSequence` เทียบกับ `settings.json` ก่อนหน้าแรก | โหลด `DEFAULT_SETTINGS.language` ตายตัว (ผู้ใช้อังกฤษเห็นหน้าแรกเป็นไทย) |
| ชนิดความสัมพันธ์ | `REL_TYPES[].label` = getter ของ `ui.relType.*` · ไฟล์ Wiki เก็บ `key` เท่านั้น | ใส่ไทยใน `label` |
| ตรวจ UI อังกฤษ | e2e `[164-R2-1]` วัดกรอบจริง (ช่องเลือกตัดคำ · ไทยค้าง · ปุ่มล้น/พับ) — หน้าใหม่ในตั้งค่าได้ด่านนี้ฟรี | ดูแค่ "มีคีย์ครบ" |
| ซูมพอดีความกว้างอัตโนมัติ | `autoFitWidth()` (ค่าระดับผู้ใช้ `autoFitWidth` · ปิดเป็นค่าเริ่มต้น · **โหมดเทสปิดเสมอ** เว้นตั้ง `__k2autoFitTest`) · ไม่ขยายเกิน `_userScale` · ซูมด้วยมือทุกทางต้องตั้ง `_userScale` | เปลี่ยน `pageScale` ทางใหม่โดยไม่อัปเดต `_userScale` |
| Backspace ต้นย่อหน้าที่มีข้อความหลังรายการ | `joinParaIntoListEnd` (ต่อท้ายข้อสุดท้าย) อยู่ใน `BACKSPACE_CMD` ก่อน `baseKeymap.Backspace` | ปล่อย `joinBackward` (ได้ข้อใหม่มีจุดนำ) |
| แถบลอยในเวที (กระดาน) | หนีบใหม่ทุกครั้งที่เวทีเปลี่ยนขนาด · กว้างสุด = เวที − ราง | วางครั้งเดียวตอนสร้าง |

### ⚠️ กฎถาวร (alpha.164 · รอบต่อ 4) — รูปกลางย่อหน้า · มาร์กของบท · ปุ่มยกเลิก · ด่านที่ต้องไม่ทิ้งสภาพ

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| รูปในบรรทัด `abc ![](x "h=2") def` | ไวยากรณ์อยู่ `RE_INLINE_IMG` ของ md.js ที่เดียว → `parseInline` ให้ส่วน `{image}` · โหนด `image` (inline atom) · เขียนกลับด้วย `inlineImgMd` (ค่าไม่เปลี่ยน = ข้อความดิบเดิม) · ความสูงเป็นหน่วยบรรทัด (`--k-img-h × 1lh` คู่แฝดใน style.css + `proseExportCss`) | regex รูปชุดที่สอง · ความสูงเป็นพิกเซล (ตัวจัดหน้าต้องรอรูปโหลด) · ส่ง `![…]` ดิบให้ช่องตัวอย่าง |
| schema ที่ไม่มีโหนด/มาร์กบางตัว (บทภาพยนตร์) | รับเนื้อจาก `mdToDoc` ผ่าน `inlineImagesAsText` · มาร์กยืมสเปกจากสคีมานิยาย (`proseSchema.spec.marks.get(…)`) | ปล่อยให้ `nodeFromJSON` เจอชนิดที่ไม่รู้จัก (เปิดไฟล์ไม่ได้ทั้งไฟล์ — `~…~` ในบทเคยเป็นแบบนี้) |
| ปุ่มยกเลิก/ปิดของกล่อง | `el/E('button', 'k-cancel', …)` เสมอ (unit `ui-audit` กวาดทั้ง `src/`) | `el('button', null, t('ui.common.cancel'))` |
| แถว Explorer ทุกชนิด (รวมกระดาน/แผน) | `bindTreeMenu(row, kind, ctx)` — `showTreeMenu` ถูกเรียกจากตัวนี้ที่เดียว (unit `tree-menu`) | `row.oncontextmenu = (ev) => showTreeMenu(…)` |
| ปุ่มไอคอนท้ายแถวฟอร์มที่พับได้ (`.wiki-row`) | ช่องกรอก `min-width:0` + container query ของพื้นที่เนื้อ (ป้ายขึ้นบรรทัดเอง) | ปล่อยความกว้างขั้นต่ำโดยปริยายของ `<input>` (~150px) ดันปุ่มลงบรรทัดใหม่ |
| e2e ที่สร้าง/เปิดของเพื่อตรวจ (แผน · กระดาน · ภาษา) | จำสภาพ **ก่อนสร้าง** แล้วคืนให้ครบ (แผนปัจจุบัน · ลบไฟล์ที่สร้าง · `buildTree()` หลังสลับภาษากลับ) | สร้างแผนแล้วปล่อยเป็นแผนปัจจุบัน (เทสผังแตกสายถัดไปทำงานในโหมดแผน) · วาดต้นไม้ตอนเป็นอังกฤษแล้วไม่วาดกลับ |
| [รอบต่อ 5] ตัดสินว่าบรรทัด/ย่อหน้า "ว่าง" หรืออ่าน "ข้อความของบล็อก" จาก JSON ของ `mdToDoc` | นับโหนด inline atom ด้วย (`image` → `inlineImgMd(attrs)`) — ตัวอย่าง `textOf` ของ convert.js | กรอง `x.type === 'text'` อย่างเดียว (บรรทัดรูปล้วนถูกนับเป็นบรรทัดว่างแล้วหายตอนแปลงโหมด) |
| [รอบต่อ 5] ค่าที่ตัวอัตโนมัติปรับชั่วคราว (ซูมพอดีความกว้าง) | เซสชัน/ไฟล์ตั้งค่าเก็บ "ค่าที่ผู้ใช้ตั้ง" (`_userScale`) · กู้แล้วให้ตัวอัตโนมัติปรับใหม่ | เก็บค่าที่ถูกปรับ (กู้แล้วกลายเป็นค่าของผู้ใช้ = ค้างถาวร) |
| [รอบต่อ 5] ช่อง flex ที่หดได้ถึง 0 (`min-width:0`) แต่ลูกมีขั้นต่ำ | ช่องนั้น `overflow:hidden` หรือให้ลูกหดได้ | ปล่อยลูกล้นไปทับเพื่อนบ้าน (แถบเป้าหมายวันนี้เคยขีดทับข้อความสถานะ) |
| [รอบต่อ 5] ตัดสินตามผลตรวจความพร้อมของ AI | `aiConfigured()` คืน `code` (`noProject/noProvider/noModel/noKey`) | เทียบ `why` กับข้อความที่แปลแล้ว |

### ⚠️ กฎถาวร (alpha.164 · รอบต่อ 6) — เมนูคลิกขวาในเอกสาร · ขั้นต่ำของแผง · Esc ยกเลิกการลาก

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| คลิกขวาใน `.ProseMirror` | เมนูของ renderer ทั้งเมนูเสมอ (`editorStdMenuItems` · `editorFmtMenuItems` ใน app.js) — รายการเฉพาะ (คำผิด · คำพ้อง · Rewrite · ฉากมีปัญหา) แทรกในเมนูเดียวกัน · ตัด/คัดลอก/วาง = `kapi.editRole(role)` | `preventDefault` แล้วโชว์แค่รายการเฉพาะ (เมนูมาตรฐานของ main หายทั้งชุด = ตัด/คัดลอกไม่ได้) · `document.execCommand('paste')` |
| ความกว้างขั้นต่ำของแผง | `minW` ใน `PANEL_DEFS` (ทุกแผงที่ปิดได้ต้องมี) → `--panel-min-w` บนเนื้อแผง → แคบกว่านั้น = แถบเลื่อน | `#<เนื้อแผง>{min-width:0}` (กฎ id ชนะตัวแปร = ขั้นต่ำหายเงียบ · unit `ui-audit` `[165-P8]` ฟ้อง) |
| แผงที่เนื้อต้องสูงเต็มแผง (กระดาน/คอลัมน์ที่เลื่อนเอง) | `flush: true` + โซ่ `flex:1; min-height:0` ถึงกล่องที่เลื่อน | `height:100%` ในเนื้อแผงแบบ block (ได้ความสูงตามเนื้อ แถบเลื่อนลอยกลางแผง) |
| คืนตำแหน่งเลื่อนในแผง | `keepScroll`/`restoreScrollSnap` (ลองถึง 1s · หยุดเมื่อผู้ใช้เลื่อน) · `renderFeaturePanel` ตรึงความสูงเนื้อระหว่างวาด (`lockScrollContentHeights`) · ตัววาดที่รอ I/O นาน ๆ ประกอบนอกจอแล้วสลับทีเดียว (แดชบอร์ด `swapKeepScroll`) | `scroll-behavior:smooth` บนเนื้อแผง · ล้างเนื้อก่อนแล้วค่อย await (ความสูงยุบ = ตำแหน่งถูกหนีบเป็น 0) |
| ตัวลากที่ผูก mousemove/mouseup เอง | `const offEsc = escCancelDrag(() => { ถอดตัวฟัง · คืนสภาพก่อนลาก })` แล้ว `offEsc()` ตอน mouseup (`src/drag-cancel.js`) | ตัวลากใหม่ที่ Esc ยกเลิกไม่ได้ |
| ลอยแผงด้วยปุ่ม/เมนู | `pm.floatPanel(id, box, { recall: true, clamp })` — กลับไปตำแหน่งลอยล่าสุด (`fX/fY` บนโหนด) | ใช้กรอบช่องผนึกเป็นตำแหน่ง (ผนึก→ลอย แล้วแผงกระโดด) |
| ปุ่ม "ปิด" ที่เป็นทางออกเดียวของกล่อง | `'k-ok k-cancel'` (Enter/Esc ปิดได้ทั้งคู่ · unit `ui-audit` `[165-E]`) | `'k-ok'` อย่างเดียว (Esc หาทางออกไม่เจอ) |
| บอกผู้ใช้ว่ามีแผงปิด/ซ่อนอยู่ | ปุ่มบนแถบติดไฟ · เมนู มุมมอง → แผง | แถบ/ชิปลอยมุมพื้นที่เขียน (ผู้ใช้สั่งเอาออกสองรอบแล้ว: alpha.50 · alpha.165) |

### ⚠️ กฎถาวร (alpha.164 · รอบต่อ 7) — ทูลทิป · log · สีของส่วนควบคุมดั้งเดิม · แถบสถานะ

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| หาเจ้าของทูลทิปจากตำแหน่งเมาส์ | `closest('[title]')` จาก `e.target` · ทางสำรองรับเฉพาะของที่อยู่ **ข้างใน** e.target | เดิน `elementsFromPoint` ทุกชั้น (ทะลุไปหยิบปุ่มของแผงที่ถูกแผงลอยทับ) |
| log | เหตุการณ์ของผู้ใช้ = `info` พร้อมผล (`save: done` · `tab: open failed` + `code`) · error ทุกตัวส่ง `Error` จริง (ได้ `[CODE errno syscall path]` นำหน้า) · ฝั่ง main ใช้ `logMain()` · IPC ทุกช่องผ่าน `H()` (ล้ม = จดพร้อมรหัสเอง) | จดแค่ "เริ่ม" แล้วเงียบ · ลิงก์เว็บเต็ม ๆ ลง log (คีย์ใน `?key=`) · เขียนบรรทัด log เองโดยไม่ผ่าน `escDetail` (ที่อยู่ Windows `\n` แตกบรรทัด) |
| ดู log ย้อนหลัง | IPC `log:list` · `log:readDay(YYYY-MM-DD)` · `log:dir` · `log:openDir` → `parseLogLine` (ตัวกลับของ `formatLine`) | อ่านไฟล์นอกโฟลเดอร์ log ด้วยชื่อที่ renderer ส่งมา |
| สีของช่องติ๊ก/ตัวเลข/select/ตัวเลือกสี | `color-scheme` ตามโหมดธีม (`applyTheme` → `<html>`) · `accent-color` ที่ `body` · ช่องที่ไม่มีกฎ = `:where(...)` ของธีม | ตั้งตัวแปรธีมที่ `:root` แล้วหวังให้ตามธีม (ธีมอยู่ที่ `body.theme-*`) · สีเทาตายตัวในเปลือกโปรแกรม |
| แถบสถานะ | คอลัมน์ `.k-sb-seg` ตามลำดับ **ข้อความ \| สวิตช์ \| ความคืบหน้า \| สถานะ \| ซูม \| หน้าแรก** · ทุกช่องมีทูลทิป · สวิตช์ใหม่ = แถวใน `STATUS_TOGGLES` (src/status-toggles.js · ใช้คำสั่งเดิมใน handleCommand) · แถบแคบใช้ container query `ksb` | ปุ่ม/ป้ายใหม่ลอย ๆ ใน `#statusbar` นอกคอลัมน์ · ช่องที่ความกว้างเปลี่ยนตามข้อความ (ดันช่องอื่น) |
| ปุ่มที่มี `data-command` | ผูกคลิกเองเสมอ (`data-command` ให้แค่ไอคอน/ทูลทิปผ่าน `applyCommandUi`) | คิดว่าใส่ `data-command` แล้วกดได้เอง |
| ตัวเลื่อน (range) ของ UI | สไตล์กลาง `input[type="range"]` (ปุ่มจับ 10px · unit `ui-audit` `[165-K]`) | ปุ่มจับขนาดของเบราว์เซอร์ |

### ⚠️ กฎถาวร (alpha.164 · รอบต่อ 3) — พหูพจน์ทั้งไฟล์ · สวิตช์ที่มีหลายทางเข้า · เลย์เอาต์ที่วัดจากพื้นที่จริง

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| คำนามนับได้หลัง `{N}` ในไฟล์อังกฤษ (ทุกคำ ไม่ใช่แค่ page/scene) | `{0} {0\|mention\|mentions}` · คำขยายคั่นได้ (`{0} selected {0\|pin\|pins}`) · ประธาน+กริยา `{0} {0\|tab has\|tabs have}` | `{0} mentions` · `{0} item(s)` (unit `en-ui-round2` กวาดทั่วไป — แถวที่ `{N}` ไม่ใช่จำนวนต้องเข้า `NOT_COUNT` พร้อมเหตุผล) |
| สวิตช์ค่าระดับผู้ใช้ที่มีหลายทางเข้า (ตั้งค่า · เมนู · คลิกขวา) | ทางกลางตัวเดียว เช่น `setAutoFitWidth(on, {save, was})` — กล่องตั้งค่าที่บันทึกไฟล์เองส่ง `save:false` | ตรรกะ "เปิดแล้วจัดทันที/ปิดแล้วคืนค่า" ซ้ำในแต่ละทาง |
| e2e ของเมนู native | `kapi.menuTestClick('<id>')` (โหมดเทสเท่านั้น) + `kapi.menuItemState` (มีช่อง `checked`) · รายการต้องมี `id` | เรียก `handleCommand` ตรง ๆ แล้วเรียกว่า "กดเมนู" |
| สองคอลัมน์/ยุบคอลัมน์ในกล่อง | container query จากพื้นที่เนื้อของกล่อง (`.k-set-main { container:kset / inline-size }`) | media query ความกว้างจอ (หน้าต่าง 1024 = กล่องเนื้อเหลือ 700) |
| กล่องที่มีปุ่มล่าง + ตัวกลางสูง | กล่องเป็นคอลัมน์ flex · ตัวกลางหดได้ (มีขั้นต่ำ) · ส่วนอื่น `flex:none` | ตัวกลางสูงตายตัวจนปุ่มหลักตกขอบล่าง (ศูนย์ส่งออกเคยเป็น) |
| `.wiki-input` ในคอนเทนเนอร์ `flex-direction:column` | `flex:none` ให้ช่องบรรทัดเดียว | ปล่อย `flex:1` ของคลาสกลาง (ช่องค้นหาเคยสูง 130px) |
| ข้อความทาง (path) ที่ตัดหัวด้วย `direction:rtl` | ข้อความจริงอยู่ใน `<bdi dir="ltr">` | ใส่ข้อความตรง ๆ ("/tmp/x" แสดงเป็น "tmp/x/") |
| เมนูย่อยที่อาจว่าง | ปล่อยให้ `openSub` โชว์ "(ว่าง)" เอง | คืน `[]` แล้วหวังว่าผู้ใช้จะเข้าใจความเงียบ |
| ด่านอังกฤษบนกล่องใหม่ | ใช้ `dlgBad()` ใน `[164-R3-1]` (ไทยค้าง · ล้น · placeholder ล้น · ช่องสูงผิด · ตกจอ) | ตรวจแค่ว่ามีคีย์ |

### ⚠️ บทเรียนรอบตรวจสอบ alpha.159 (159-audit)

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| สถานะของปลั๊กอิน ProseMirror (เส้นคั่นหน้า · สมอคอมเมนต์) | เก็บต่อ instance ที่สร้างใน `plugin()` + ผูก view ผ่าน `view()` hook · ฟังก์ชัน API รับ `view`/`dom` | ตัวแปรระดับโมดูล (ทุกแท็บ/แยกจอใช้ก้อนเดียว) |
| หาแถวใน `scenes.json` จากไฟล์ | จับทั้ง **โฟลเดอร์บท + ชื่อไฟล์** (`sceneCtx`) | จับชื่อไฟล์อย่างเดียว — ทุกบทมี `scene-01.md` |
| เขียน `.md` ทั้งไฟล์นอกตัวแก้ไข | `writeKeepingComments` / `writeMdKeepingComments(io, …)` (comment-core · บริสุทธิ์) | `writeFile(dumpMdFile(…))` = ลบเธรดคอมเมนต์ |
| แทนเนื้อตัวแก้ไขจากโค้ด | `KEditor.setMarkdown` (ลงประวัติ undo เป็นขั้นแยกแล้ว) | สร้าง EditorState ใหม่ (ประวัติหาย) |
| ฟอนต์ที่ฝังลง PDF | ผ่าน `embedFonts` (เรียก `avoidAatLayout` ให้เอง) · `.ttc` ใช้ไม่ได้ | ส่งฟอนต์ AAT (Sathu/Ayuthaya ของ macOS) เข้า fontkit ตรง ๆ — วนไม่จบกับสระอำจนแรมเต็ม |
| ป้ายเงื่อนไขของช่องผล AI | ธง `dataset.state` (`resultReady`) | เทียบตัวอักษร/ไอคอน (`startsWith('❌')`) |
| ข้อความ UI ใหม่ | `t('ui.…')` · เทส `i18n-keys` ตอนนี้กวาด `tr/trf/tm/tKey` + msgid ของ `` T`…` `` แล้ว | `` T`…` `` ใหม่ |
| ตรวจว่า `t` ถูกบังไหม | `test/i18n-shadow-precise.test.cjs` (เดิน AST ระดับสโคป) | เชื่อคำเตือนระดับไฟล์ของ `tools/i18n-shadow.cjs` อย่างเดียว (แจ้งเกินจริง) |
| e2e ที่ตั้ง `scrollTop` บนตัวแผงใบใหม่ | ตั้ง `style.scrollBehavior='auto'` ก่อน (CSS เป็น smooth = อ่านได้ค่ากลางทาง) | รอเวลาตายตัวแล้วเทียบค่าเป๊ะ |
| แก้เทสที่วัดตำแหน่งบนจอ | ระวัง "เรขาคณิตบังเอิญ" (tab stop · จุดตัดบรรทัด) ที่ต่างตามเมตริกฟอนต์ของ OS | สรุปว่าโค้ดผิดจากผลบน OS เดียว |

### ⚠️ กฎถาวร (alpha.162 · W7) — **วันที่ · ตัวเลข · การเรียง ตามภาษาที่ผู้ใช้เลือก**

ที่มา: `th-TH` ตายตัว (เลือกอังกฤษก็ได้ พ.ศ.) · `localeCompare(…, 'th')` · ตัวเลขตามภาษาของ OS · `<html lang>` ค้างเมื่อไฟล์ภาษาหาย
ประตูกันพลาด: unit `i18n-locale` (49 ข้อ) · `ui-audit` + e2e ชุด `[162-W7]`

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| แสดงวันที่/เวลา | `fmtDate` / `fmtTime` / `fmtDateTime(v, opts?)` จาก `src/locale.js` — ไทย = พ.ศ. · อื่น ๆ = ค.ศ. · ค่าเสีย = `''` (คนเรียกต่อด้วย `'—'` เอง) | `toLocale*String('th-TH')` · `.toLocaleString()` ตรง ๆ (ได้ภาษาของ OS) · `new Intl.DateTimeFormat('…')` เอง |
| แสดงตัวเลข | `fmtNum(n)` | `n.toLocaleString()` |
| เรียงข้อความที่คนอ่าน (ชื่อ · คำ · แท็ก) | `cmpText(a, b)` / `collator(opts)` | `localeCompare(x, 'th')` หรือภาษาตายตัวใด ๆ · `new Intl.Collator('th')` |
| เรียง id / วันที่ ISO / พาธ | `localeCompare` แบบเดิมได้ (ไม่ใช่ข้อความที่คนอ่าน) | เปลี่ยนเป็น `cmpText` แล้วลำดับขยับตามภาษา (ไฟล์บนดิสก์ต้องเรียงเหมือนกันทุกภาษา) |
| ตัดคำ | `wordSegmenter()` (ผลเท่ากันทุกภาษา — ICU เลือกพจนานุกรมตามตัวอักษร) | `new Intl.Segmenter('th')` |
| `<html lang dir>` | `applyDocLang()` หลังโหลดภาษาเสร็จ (loadLanguage ทำให้แล้ว) | ตั้ง `documentElement.lang` เองก่อนโหลด |
| CSS ทิศทางของ UI | ของใหม่ใช้ `text-align:start/end` · `margin/padding/border-inline-start/end` — ตัวนับของกายภาพห้ามเพิ่ม (text-align ≤ 23 · box ≤ 158) | ใช้ start/end กับ **หน้ากระดาษ/บทภาพยนตร์** (เรขาคณิตของหน้าพิมพ์ ไม่ตามทิศ UI) · ใช้ start/end ในกฎที่มี `direction:rtl` เป็นกลเม็ดตัดหัวข้อความ (จะชิดขวา) |
| คีย์ภาษาใหม่ | มีคำแปลอังกฤษจริงใน `en` (ด่าน: แถวไทยใน en ≤ 3 — แปลครบแล้วใน alpha.164 · ดู `node tools/i18n-en-report.cjs`) | ใส่ไทยซ้ำลง en "ไว้ก่อน" |
| ข้อความไทยที่เป็นข้อมูล (ไม่ใช่ข้อความบนจอ) | ครอบด้วย `/* i18n-skip: เหตุผล */ … /* /i18n-skip */` ในซอร์ส (วางนอกสตริง/เทมเพลต) · `SKIP_RANGES` **ว่างแล้ว ห้ามเพิ่ม** (ด่าน i18n-locale) | ช่วงเลขบรรทัด (เลื่อนเงียบเมื่อแทรกโค้ด) |

### ⚠️ กฎถาวร (alpha.162 · W6) — **ไอคอน · สี · ข้อความ · ตัวเลขเวลา มีที่อยู่ที่เดียว**

ที่มา: ไอคอนหลุดด่าน · canvas วาดสีตายตัว (ธีมสว่างได้ผืนมืด) · ตรรกะเทียบกับข้อความที่แปลแล้ว · สูตรเดียวกันคัดลอกหลายไฟล์
ประตูกันพลาด: unit `timing-palette` · `ui-audit` ชุด `[162-W6]` + e2e ชุด `[162-W6]`

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| สัญลักษณ์ในปุ่ม/ป้าย (× − § ¶ ⤢ ⟲ …) | เพิ่มแถวใน `icons/glyphs.csv` แล้วใช้ `gi('ชื่อ')` · ตัวที่อยู่ในช่วงแต่เป็นวรรคตอน/ข้อมูลจริง → `NOT_ICON` พร้อมเหตุผลใน `tools/icon-lexicon.cjs` | เขียนตัวอักษรตรงในโค้ด · แก้ช่วงของด่านในเทสแยกจาก `ICON_RANGE_SRC` |
| สีเปลือกบน canvas/SVG ที่วาดบนจอ | `themeColor('--ตัวแปร', '#ค่าสำรอง')` (palette.js) | hex ตายตัว (ธีมสว่างได้ผืนมืด) · อ่าน `getComputedStyle` เองทุกเฟรม |
| สีที่มีความหมาย (สถานะ · โน้ต · ชุดกราฟ) และสีงานส่งออก | ค่าที่มีชื่อใน `src/palette.js` (`PLANNER_KIND` · `CHART_SERIES` · `PRINT`) — ไฟล์ส่งออกพื้นขาวเสมอ | จานสีซ้ำในไฟล์ UI · งานส่งออกตามธีมมืด |
| สีใน style.css | ตัวแปรใน `renderer/themes/*.css` (สีความหมายร่วม: `--st-warn` · `--st-danger` · `--st-danger-alt` · `--brand-navy`) — hex ใน style.css **ห้ามเพิ่ม** (ด่านนับ ≤ 214) | นิยามตัวแปร `--danger` (ชนค่าสำรองของแถบลอย) |
| ตัดสินใจตามผลตรวจ/ชื่อ | รหัส (`validateProviderIssues` → `code`) · ธงในข้อมูล · ชุดค่าเก่าที่ระบุชัด (`LEGACY_DEFAULT_TITLES`) | `x === t('…')` / `!== t('…')` (ภาษาเปลี่ยน ตรรกะเพี้ยน) |
| คีย์ที่ประกอบตอนรัน (`tr('x')` → `branch.x`) | `t()` อาร์กิวเมนต์เดียว · คีย์ต้องมีจริงในไฟล์ภาษาทุกไฟล์ (ด่านไล่ให้) | ส่งค่าสำรองเป็นอาร์กิวเมนต์ที่สอง (ไม่มีผล — หลอกคนอ่าน) |
| ตัวเลขเวลาที่มีความหมาย (เพดานรอ · หน่วงบันทึก) และสูตรลองใหม่ | ค่าคงที่ใน `src/timing.js` · ถอยรอ = `retryBackoff(n)` · main ใช้ `timing.cjs` | ตัวเลขลอยใน `setTimeout` ของ main · คัดลอกสูตร `Math.min(8000, 500 * 2^n)` |
| ลบคีย์ภาษา | ดู `node tools/i18n-unused.cjs --list` ทีละ namespace แล้วตรวจว่าไม่ถูกประกอบตอนรันจริง | ลบยกชุดตามรายงาน (คีย์จำนวนมากถูกประกอบตอนรัน) · ปล่อยให้จำนวน "ไม่พบเลย" เพิ่ม (ด่าน ≤ 83) |

### ⚠️ กฎถาวร (alpha.162 · W5) — **ข้อความมีระดับ · งานยาวยกเลิกได้ · คีย์บอร์ดเข้าถึงได้**

ที่มา: รอบ QOL — ข้อความสถานะค้างตลอดไป/error หายทันที · งานยาวยกเลิกไม่ได้ · เมนู/แท็บ/แถบใช้คีย์บอร์ดไม่ได้
ประตูกันพลาด: unit `cancel` · `search-engine` · `dashboard-stats` · `pdf-generator` · `toolbar-config` · `ui-audit` ชุด `[162-W5]` + e2e ชุด `[162-W5]`

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| ข้อความทั่วไป | `setStatus(s)` (หายเองหลัง `STATUS_TTL_MS`) · มีลิงก์ทำต่อ = `setStatusAction(s, label, fn)` | เขียน `$('#status').textContent` ตรง ๆ (ไม่มีอายุ/ไม่มี live region) |
| ข้อความผิดพลาด | `setStatusError(failText(what, e))` หรือ `setStatusError(errText(e))` — ค้างจนมีข้อความใหม่ | `setStatus(x + e.message)` (ด่านกวาดทั้งโปรแกรม) · เดาระดับจากเนื้อข้อความ (แปลแล้ว เทียบไม่ได้) |
| ผลของงานที่โปรแกรมทำเองเงียบ ๆ | `toast(msg, { level, action })` จาก ui.js | เขียนทับแถบสถานะ (ลบข้อความของสิ่งที่ผู้ใช้กำลังทำ) · เงียบทั้งตอนสำเร็จและตอนล้ม |
| งานยาว (อ่านไฟล์ทั้งโปรเจกต์ · สร้างไฟล์ใหญ่) | `withBusyTask(msg, ({signal, progress}) => …, { name })` + `throwIfCancelled(signal)` ระหว่างรอบ · ลูปซิงก์ยาวต้องพัก (`await setTimeout 0`) | `withBusy` เฉย ๆ ในงานที่เกินไม่กี่วินาที · `forEach` ซิงก์ทั้งก้อน (ปุ่มยกเลิกไม่มีจังหวะทำงาน) |
| จับ error ของงานที่ยกเลิกได้ | `if (isCancelled(e)) …` (cancel.js) แยกออกก่อน log/บอกพัง | กลืนการยกเลิกเป็นผลว่าง ("ไม่เจอผล") · log การยกเลิกเป็น error |
| งานที่หยุดกลางทางแล้วทิ้งของครึ่ง ๆ (แตก ZIP ลงโฟลเดอร์ใหม่) | ไม่ให้ยกเลิก หรือยกเลิกได้เฉพาะก่อนเริ่มเขียน | ยกเลิกระหว่างเขียนไฟล์ของผู้ใช้ |
| แถบแท็บใหม่ | `a11yTabBar(bar, label)` (panel-renderer) | `div` คลิกได้อย่างเดียว |
| เมนูใหม่ | `popupMenu()` (ได้ role/คีย์บอร์ด/คืนโฟกัสฟรี) · เมนูที่ไม่ใช่ popupMenu ต้องมี role=menu + ↑↓/Enter/Esc เอง | ดึงโฟกัสตอนเปิดเมนูด้วยเมาส์ · ปล่อยลูกศรหลุดไปถึงเอกสารข้างหลัง |
| แถบปุ่มแนวนอนใหม่ | `rovingToolbar(bar)` + ชื่อแถบผ่าน `data-i18n-attr="aria-label"` | ให้ Tab เดินทีละปุ่มทั้งแถบ |
| ปุ่มกลุ่มบนแถบ (เช่น AI) | เมนูประกอบจาก **ปุ่มจริง** ที่ซ่อนเป็นค่าเริ่มต้น (`AI_GROUP_IDS` → `b.click()`) | รายการคำสั่งเขียนซ้ำอีกชุดในเมนู |
| ถามว่าเมนูเปิดอยู่ไหม | `menuOpen()` / `liveMenu()` (หลุดจากหน้า = ปิดแล้ว) | เช็ค `curMenu` ดิบ (เมนูที่ถูกลบด้วยทางอื่นค้างกินคีย์) |
| ตัวเฝ้า DOM บนของที่เปลี่ยนทุกตัวอักษร (แถบเครื่องมือ · แถบสถานะ) | ทำงานตาม "เหตุการณ์ที่ต้องใช้จริง" (เช่น ตอนกด Tab) | `MutationObserver` + วัดเลย์เอาต์ทุกเฟรม (ช้าทั้งโปรแกรม · เทสอิงเวลาแดงสุ่ม) |
| ตัวเลข "วันนี้" ทุกที่ | `wordsWrittenToday(getWordHistory())` (นิยามเดียวกับแดชบอร์ด) | นับจากแท็บที่เปิดอยู่ |

### ⚠️ กฎถาวร (alpha.162 · W4) — **กล่อง · คีย์ลัด · แถวใน Explorer มีทางกลางทางเดียว**

ที่มา: รอบจัด UX — ต้นตอซ้ำกันคือ "ของที่ควรเป็นสัญชาตญาณ" ถูกเขียนเองทีละจุด (87 กล่อง · 10 แถวเมนู Explorer)
จึงขาดบ้างมีบ้าง · และคีย์ลัดตัวดักกลางแย่งคีย์ของเอกสารโดยไม่มีใครรู้ · ประตูกันพลาด: unit `ui-audit`/`shortcuts`/`tab-order`/`session-core`/`tree-menu` ชุด `[162-W4]` + e2e ชุด `[162-W4]`

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| กล่องใหม่ (`.k-overlay` + `.k-dialog`) | ปุ่มยกเลิก/ปิดติดคลาส `k-cancel` · ปุ่มหลัก `k-ok` **อยู่ขวาสุด** · role/aria-modal/โฟกัส/Tab วน/Esc/Enter ได้จาก `installDialogA11y()` อัตโนมัติ | ปุ่มยกเลิกไม่มีคลาส (Esc หาทางออกไม่เจอ) · ปุ่มหลักซ้าย · ให้ Esc "ลบกล่องทิ้ง" เอง (กล่องที่ไม่มีทางถอยต้องไม่หายกลางคัน) |
| คีย์ลัดใหม่ | แถวใน `icons/commands.csv` + ชื่อใน `SHORTCUT_LABELS` + หมวดใน `SHORTCUT_CATS` (ไม่มีชื่อ = ไม่โผล่ในหน้าปุ่มลัด ตั้งใหม่ไม่ได้) · เช็กชนกับ `ctrl+alt`/`shift` ทั้งตาราง | ใส่คีย์ที่ตัวแก้ไขใช้อยู่แล้ว โดยไม่ให้เอกสารเป็นเจ้าของ (`onShortcut` ดักระยะ capture = ยิงก่อนตัวแก้ไขเสมอ) |
| คำสั่งที่ต้องมีสองปุ่ม | `A / B` ใน CSV + เพิ่มใน `ALIAS_OK` ของ `test/shortcuts.test.cjs` พร้อมเหตุผล (ด่านเช็กว่ามีสองแถวจริง) | ซ่อนของซ้ำจริงไว้ในรายชื่อยกเว้น |
| คีย์ที่เอกสารบทภาพยนตร์ใช้ | ผ่าน `spOwnsKey()` ใน `onShortcut` — เคอร์เซอร์อยู่ในบท + ตรงกับ `spCycleKeys` → ปล่อยให้เอกสาร | ให้คำสั่งกลางกินคีย์วนธาตุ (ค่าเริ่มต้น Ctrl+Tab เคยยิงไม่ออกเลยตั้งแต่ .61) |
| แถวใหม่ใน Explorer | ผูกเมนูด้วย `bindTreeMenu(row, kind, ctx)` → แถวพก `_k2row` · ทางอื่นเรียกรายการเดียวกันด้วย `treeRowAction(row, id)` | `row.oncontextmenu = (e) => showTreeMenu(…)` ตรง ๆ (F2/คัดลอกที่อยู่เอื้อมไม่ถึงชนิดนั้น) |
| แถวปุ่ม/ป้ายในต้นไม้ที่ไม่ใช่เนื้อหา | คลาสของตัวเอง (`add-row k-add-scene-row` · `tree-draft-row`) | คลาส `scene` (ทั้งโปรแกรม+เทสถือว่า `.scene` = แถวที่คลิกเปิดได้) |
| ปุ่มใหม่บนหน้า Home | มุมหัว (`corner` จาก `buildHomeActions`) | ยัดลงแถบคำสั่งล่าง (ต้องบรรทัดเดียว [62-1] · ลำดับผู้ใช้กำหนด [61-1]) |
| ของใน `#tabs` ที่ไม่ใช่แท็บ | คลาสของตัวเอง + CSS `order` ให้อยู่ท้าย (`k-tabs-more`) | คลาส `tab` (โค้ด/เทสนับ `#tabs > .tab`) |
| เขียนไฟล์ตั้งค่าผู้ใช้ | `saveGlobalSetting(key, v)` (ตั้งค่าในหน่วยความจำทันที) หรือ `mergeGlobalSettings(patch)` — คิวเดียว อ่าน-รวม-เขียน ตัวหลังชนะ | `writeGlobalSettings({ …บางคีย์ })` — ตัวนั้น **เขียนทับทั้งไฟล์** (`exportName` เคยหายทุกครั้งที่กดบันทึกตั้งค่า) |
| กล่องตั้งค่าตอนไม่มีโปรเจกต์ | เปิดได้ · หน้าที่ป้ายขอบเขตเป็น `project` ถูก **ซ่อน** (ห้ามลบ — ช่องยังถูกอ่าน) + ถอดแท็บ · บันทึกเฉพาะไฟล์ผู้ใช้ (`projOK`) | ปฏิเสธทั้งกล่อง · แตะ `state.meta`/ไฟล์ผลงานตอน `state.root` ว่าง |

### ⚠️ กฎถาวร (alpha.162 · W3) — **ค่าตั้งค่า: ขอบเขตต้องไม่โกหก**

ที่มา: รอบจัดบ้านกล่องตั้งค่า — ต้นตอคือ "รายชื่อคีย์ระดับผู้ใช้" ถูกเขียนมือไว้สองที่ แล้วเพี้ยนจากกัน
(สวิตช์ `showMarkdownCodes` ไม่เคยถูกเขียนลงไฟล์ตั้งค่าผู้ใช้เลย) · ประตูกันพลาด: unit `settings-tpl` ชุด `[162-W3]` + e2e ชุด `[162-W3]`

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| "คีย์นี้เป็นค่าระดับผู้ใช้หรือของผลงาน" | เพิ่มแถวใน `GLOBAL_DEFAULTS` หรือ `PROJECT_DEFAULTS` (`src/core.js`) ที่เดียว — ตัวเขียนไฟล์ตั้งค่าผู้ใช้อ่านจาก `Object.keys(GLOBAL_DEFAULTS)` | รายชื่อคีย์เขียนมือใน `dialogs.js` (เพี้ยนจากตารางจริงโดยไม่มีใครรู้) |
| สวิตช์ค่าระดับผู้ใช้ที่อยู่ในเมนู/แถบ | `saveGlobalSetting(key, v)` **คู่กับ** `saveProjectMetaSoon()` | เขียนลงไฟล์ผลงานอย่างเดียว (เปิดผลงานอื่นแล้วค่าหาย ทั้งที่ UI บอกว่าตามผู้ใช้ไปทุกผลงาน) |
| หน้าใหม่ในกล่องตั้งค่า | เพิ่มใน `src/settings-template.js` + ป้ายขอบเขต `scope('global')` / `scope('project')` | ประกอบหน้าเป็น DOM ตอนรันใน `dialogs.js` (หลุดด่าน `settings-tpl` ทั้งหน้า) |
| แถวในหน้า | ทุกแถวในหน้าเดียวกันต้องมีขอบเขตเดียวกับป้ายของหน้า (เทสเทียบชื่อคีย์กับตารางค่าเริ่มต้นจริง) | ยัดแถวของผลงานไว้ในหน้าระดับผู้ใช้ (หรือกลับกัน) แล้วหวังว่าผู้ใช้จะเดาถูก |
| ค่าหนึ่งค่า = ช่องเดียว | ช่องอยู่ในหน้าที่บริบทตรงที่สุด · ที่อื่นใส่ **ปุ่มพาไป** | ช่องคู่แฝดสองหน้าที่ต้องซิงก์กันเอง (`#st-edpt` ↔ `#st-pr-pt` · `#st-pr-pgnum` ↔ `#st-pn-show`) |
| ช่องในกล่องตั้งค่า | พรีวิวสดได้ แต่ **ผูกค่าจริงตอนกดบันทึก** · ยกเลิก = คืนค่าเดิมทุกช่อง | `onchange` เขียนค่าจริงทันที (ผู้ใช้กดยกเลิกแล้วค่านั้นไม่คืน) |

### ⚠️ กฎถาวร (alpha.162 · W2) — **หน้าตาของแผงมาจากของกลางชุดเดียว**

ที่มา: รอบรวมหน้าตาแผง 32 ตัว — ต้นตอซ้ำกันคือ "แผงนี้เคยเป็นแท็บเอกสารเต็มจอ" แล้วถูกยกมาเป็นแผงข้าง
โดยไม่ได้ลดสเกล/ไม่ได้ใช้ของกลาง · ประตูกันพลาด: unit `ui-audit` ชุด `[162-W2]` + e2e ชุด `[162-W2]`

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| หัวข้อ/แถบเครื่องมือ/สถานะว่าง **ในเนื้อแผง** | `panelHead()` · `panelTitle()` · `panelBar()` · `panelEmpty()` (`src/panels/panel-chrome.js` · re-export ที่ `panels/panel-ui.js`) | คลาสหัวข้อ/สถานะว่างของแผงตัวเอง · ยืม `.k-dlg-title` (หัวของ *กล่องโต้ตอบ*) มาเป็นหัวข้อในแผง |
| ขนาด/ระยะของเนื้อแผง | ตัวแปร `--pan-title-fs` · `--pan-sub-fs` · `--pan-page-pad` · `--pan-gap` | `font-size:calc(22px * var(--ui-scale))` ของใครของมัน |
| ปุ่มบนหัวแผง (รวมที่โมดูลอื่นฝากผ่าน `addPanelButton`) | `makePanelButton({ glyph, title, tip, onPress })` | `el('span', 'k-panel-btn', …)` + `onclick` (ได้ปุ่มที่คีย์บอร์ดกดไม่ได้) |
| แผงที่เนื้อจัดการพื้นที่เอง (กระดาน · กราฟ · รายการที่เลื่อนเอง) | ธง `flush: true` ใน `PANEL_DEFS` → คลาส `.k-panel-flush` | กฎ CSS `:has(#<id>-body) > .k-panel-body` ของแผงตัวเอง (specificity ของ id ชนะกฎกลางจนพับแผงไม่สุด) |
| ชื่อแผง | ช่อง `i18n` ช่องเดียว อ่านผ่าน `titleOf()` ตอนวาด | ช่อง `title` ที่เก็บข้อความ (ค้างภาษา · และเคยชี้คีย์ผิดโดยไม่มีใครรู้) |
| "แผงนี้ฉีกออกหน้าต่างได้ไหม" · ความกว้างต่ำสุด | ธง `tearoff` / ช่อง `minW` ในทะเบียนแผง (`TEAROFF_PANELS` derive จากตารางนี้) | Set/รายชื่อชุดที่สอง |
| ปุ่มบนแถบที่เป็นสวิตช์ของแผง | `data-command="toggle-panel:<id>"` (หรือ `data-panel="<id>"` เมื่อคำสั่งไม่ใช่ toggle-panel) แล้วปล่อยให้ลูปกลางผูกคลิก/ติดไฟ | `$('#tb-x').onclick = …` + `classList.toggle('on', isPanelOpen('x'))` เขียนมือทีละปุ่ม |
| ข้อยกเว้นที่ประกาศไว้ (`MENU_PANELS_SKIP`) | ต้องชี้แผงที่มีอยู่จริงใน `PANEL_DEFS` | ปล่อยชื่อที่ไม่มีแผงแล้วค้างไว้ (หลอกคนอ่านว่ามีแผงนั้น) |

### ⚠️ กฎถาวร (alpha.162 · W1) — **ชื่อในถัง · เปิดแท็บ · อ่านเนื้อแท็บ · แคชที่มีขอบเขต**

ที่มา: รอบไล่บั๊กตรรกะ W1 (20 ข้อที่ถูกชี้ + กวาดเพิ่ม) — ต้นตอซ้ำกันคือ "ประกอบเองหลายที่" กับ
"ด่านที่เช็คไม่ครบทุกมิติ" · ทุกข้อในตารางนี้มี e2e ชุด `[162-W1-*]` หรือ unit test คุมอยู่

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| ชื่อปลายทางในถังขยะ (ทุกทางลบ) | `trashPathFor(file, { dir })` (`src/trash-path.js`) — เวลาประทับไม่ซ้ำ + กันชนกับของบนดิสก์ | `Date.now().toString(36) + '-' + base` (ลบรวดเดียวหลายชิ้น = ชื่อชนกัน แล้ว `move` ทับหายถาวร · ทุกบทมี `scene-01.md`) |
| เปิดไฟล์เป็นแท็บ | `openOnce(file, fn)` ครอบงานที่มี `await` (openScene · openPlainFile · openEntity) | เช็ค `state.tabs.has()` แล้ว `await readFile` ก่อน `state.tabs.set` (สองคำสั่งพร้อมกัน = pane/ปุ่มแท็บผี) |
| อ่านเนื้อ .md ของแท็บ | `tabBodyText(tab)` — `null` = แท็บชนิดนั้นไม่มีเนื้อ .md | `t.editor ? … : t.plain.value` (บทภาพยนตร์/หน้า Wiki ไม่มีทั้งคู่ = TypeError) |
| ดัชนี/แคชที่มี "ขอบเขต" (รวม .json ไหม · โปรเจกต์ไหน) | `indexMatches(have, want)` ใช้ตัดสินทั้งของที่ถืออยู่และ **งานที่กำลังสร้าง** | `if (building) return building` (คนละขอบเขต = ได้ผลผิดแบบเงียบ) |
| เปิดโปรเจกต์จากปุ่ม/เมนู | `openProjectFromUi(root)` (รายงานเมื่อเปิดไม่ได้ + กันเปิดซ้อน) | `loadProject(p)` แบบไม่ await (มันโยน error ได้) |
| งานสแกนยาวที่เขียนผลลง instance | สแกนลงกองของรอบตัวเอง + เลขรอบ แล้วคอมมิตครั้งเดียวตอนจบ (`smart.loadNames`) | เคลียร์ของเดิมทิ้งแล้วเติมระหว่างสแกน (สองรอบซ้อน = ผลปนกัน) |
| ย้ายของระหว่าง "ไฟล์" กับ "ทะเบียน" | ขึ้น/ถอนทะเบียนก่อน แล้วค่อยลบไฟล์ต้นทาง | ลบต้นทางก่อน (ขั้นทะเบียนล้ม = ไฟล์ไม่มีใครชี้ถึง ผู้ใช้มองไม่เห็นทั้งสองที่) |
| วาดรายการที่ลำดับมีความหมาย | ประกอบ DOM แบบ sync แล้วเติมค่าที่ต้องรอ IPC ทีหลัง | `arr.forEach(async …)` ที่ `appendChild` อยู่หลัง `await` (ลำดับขึ้นกับว่าใครตอบก่อน) |

### ⚠️ กฎถาวร (alpha.161) — **สำเนาต้องได้ของล่าสุด · แคชมีรุ่น · ทางเดียวของ UX ชุดใหม่**

ที่มา: ชุดพรอมป์ 6 ข้อ (P0 งานหาย · P1 แคชค้าง · ค้นหา · คุณสมบัติ/ตัวกรอง · หัวแผง · QOL) — e2e `[161-D/C/S/P/U/K]`

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| คัดลอก/ทำสำเนา/วาง/memo→ฉาก/บันทึกเป็น (อ่านต้นฉบับจากดิสก์) | `flushTab(tab, saveTab)` ของต้นฉบับ **ก่อนอ่าน** · false = ข้ามรายการนั้นแล้วรายงาน · เขียนด้วย `writeMdKeepingComments(io, dst, text, src)` หรือ `addScene(…, { commentsFrom: src })` | อ่าน body ก่อน `saveTab` · `if (dirty) await saveTab()` แล้วทำต่อโดยไม่ดูผล · `kapi.writeFile(dumpMdFile(…))` ของไฟล์ที่เป็นสำเนา |
| ลบก่อนย้ายลงถัง (ทีละหลายฉาก) | `flushTab` แล้ว **ปิดแท็บ (ที่สะอาดแล้ว) ก่อน** `kapi.move` · นับ ok/failed ตามจริง | เช็คแค่ `=== false` (saveTab สำเร็จแต่ dirty กลับมาติดได้ — alpha.148) · บังคับ `dirty=false` |
| ย้าย Wiki entity ข้ามหมวด | `flushTabForMove` → `closeTabsUnderPath(src)` (`.ok`) → move → `moveSnapshots` → `syncOpenTabMeta` | `closeTab(src)` ไม่ discard/ไม่ await (saveThenClose เขียนกลับทางเดิม = ไฟล์ผี) |
| สำรองรายชิ้น (backup) | งานค้างบันทึกไม่ผ่าน = **ยกเลิก backup** (`e.k2Unsaved`) | กลืนผลแล้วสำรองฉบับเก่า |
| แคช/ดัชนีที่สร้างจากข้อมูลที่เปลี่ยนได้ (สายหน้า · RAG แชท · ดัชนีค้นหา) | `createEpoch()` + `runFresh(epoch, fn, {maxRounds})` (`src/epoch-guard.js` · unit test) — ตัวล้าง `bump()` · เก็บเป็น "สด" เฉพาะรุ่นไม่เปลี่ยน · ครบเพดาน = ใช้ชั่วคราวแต่คง stale | `stale = false` หลัง await (ทับการล้างที่เกิดระหว่างสร้าง) · วัดใหม่ทันทีแบบไม่มีเพดาน |
| สายหน้าที่ล้าสมัยระหว่างวัด | `staleStartPage()` โชว์ชั่วคราว · `ensureBookFlow` วัดซ้ำแบบหน่วง (`FLOW_RETRY_MS`/`FLOW_RETRY_MAX`) · e2e ใช้จุดพัก `window.__k2flowHold` | poll หากล่องวัด (วัดเสร็จเร็วกว่ารอบ poll) |
| ดัชนีค้นหาทั้งโปรเจกต์ล้าสมัย | ล้างผ่าน `watchProjectWrites()` (`kapi.onLocalWrite` → `searchPathMatters`) — ครอบทุกการเขียน/ย้าย/ลบ | ยิง `invalidateSearchIndex()` ใน `buildTree()` · ไล่แปะทีละจุด |
| ค้นหา: ไฟล์ในถังขยะ/ประวัติ/สำรอง | `indexProject(…, { skipDirs: SEARCH_SKIP_DIRS })` (Recycle · Snapshots · Backups ชั้นบน) | นับสำเนาเป็นผลค้นหา (ฉากที่ลบแล้วยังโผล่) |
| กระโดดไปจุดที่ค้นเจอ | `matchDetail()` (term/nth) → `gotoSearchMatch(tab, m)` → `nthTextPos` → **`navGotoPos`** · .json/.txt = ช่วงอักขระตรง ๆ | สร้าง `TextSelection` เอง · ใช้เลขบรรทัด .md เป็นลำดับบล็อก |
| ไฮไลต์คำค้นในสไนป์เพ็ต | `splitHighlight(text, highlightTerms(q))` → `<mark class="k-gsearch-hl">` + text node | `innerHTML` ของข้อความผู้ใช้ |
| ค้นหาทั้งโปรเจกต์ | ทางเข้าเดียว = แผงค้นหา (`renderSearchPanel`) · ค้นสดหน่วง 250ms · ↑↓/Enter/Esc · `.total` บอกจำนวนก่อนตัด | ฟื้น `openGlobalSearch` (ถอดแล้ว) |
| แผงคุณสมบัติตามแท็บ | `syncPropsToActive()` (ใน `activate` + ปิดแท็บสุดท้าย) · ค่าหนักอ่าน `readSceneMeta(file,row)` · เขียนแล้ว `syncOpenTabMeta` | อ่าน synopsis/pov/… จาก `scenes.json` · เปิดแผงเองตอนสลับแท็บ (บั๊ก #19) |
| ชิปตัวกรองสถานะ/แท็ก | `setChipClause(q, 'status'|'tag', values)` / `parseChipQuery` (sceneFilter.js · กระจายคำค้นไปทุกกลุ่ม OR) | `q.value = 'status:… OR …'` ทับทั้งช่อง |
| ฉาก "เก็บถาวร" ใน Explorer | ตัดสินใน `filterTree` ที่เดียว (`setTreeShowArchived` · ค่าเริ่มต้นซ่อน · ปุ่ม ON = แสดง) · `buildTree` เรียก `filterTree` เสมอ | ซ่อน/แสดงเองนอกตัวกรอง · อ่าน `dataset.filteredHidden` ที่ไม่มีใครตั้ง |
| เมนูยาว | `.k-menu` มี max-height + เลื่อน · `placeMenu` ตั้ง maxHeight ก่อนวัด | เมนูสูงเกินจอ |
| ปุ่มควบคุมของระบบแผง | `makePanelButton()` (node · tabindex=0 · Enter/Space · `data-tip` = `ui.panelTip.*` · คีย์ลัดผ่าน `shortcutText`) | `el('span','k-panel-btn', …)` + onclick ตรง ๆ |
| แผงในกลุ่มแท็บ | หัวแผงมีแค่ ☰/พับ · ปิด = ✕ บนแท็บ · ลอย/ฉีก = เมนู ☰ · ปุ่มปิดของกลุ่มลอย = ปิดทั้งกลุ่ม | ปุ่มปิด/ลอยซ้ำบนหัวแผงในกลุ่ม |
| ข้อความระดับโมดูลของระบบแผง (`PANEL_BUTTONS` · `BUILTIN_WORKSPACES`) | getter ที่เรียก `t()` ตอนอ่าน | `title: t('…')` ตอน import (ค้างภาษา — บทเรียนข้อ 37) |
| ซ่อนแผงทีละฝั่ง/ทั้งหมด | ที่พัก `_sideStash` ตัวเดียว (`toggleSpace` = alias) · `resetPanels`/`applyWorkspace` เรียก `resetSideStash()` | ระบบซ่อนชุดที่สอง |
| ทางกลับของแผงที่ปิด/ซ่อน/ฉีก | ชิป `.k-hidden-chips` ใน `#content` (`hiddenPanelChips` · `restoreHiddenPanel`) | — |
| สีโซนปล่อยแผง | ตัวแปรธีม (`--accent-hi` แทรก · `--link` รวมกลุ่ม · `color-mix`) | hex ในกฎ `.k-drop-zone` |
| เมนู มุมมอง → แผง | `MENU_PANELS` มี `{head}` 4 หมวด · `menu:panelIds` กรอง `sep`/`head` | ลบ/เพิ่มแผงเงียบ ๆ |
| ลำดับแท็บ | `state.tabs` = ลำดับบนแถบ (`reorderTabs`) · ปิด → `neighborAfterClose` · วน → `cycleTab` (`src/tab-order.js` · unit test) | `[...state.tabs.keys()].pop()` |
| ปุ่มบน `#toolbar` | ต้องอยู่ใน `TOOLBAR_GROUPS`/`LOCKED_BUTTONS` · ล้น = `layoutToolbarOverflow` (ปุ่ม `#tb-overflow` "»") · `overflowPlan` ไม่ย้ายปุ่ม locked | ปล่อยให้แถบเลื่อนแนวนอนโดยไม่มีทางเข้าถึงปุ่มท้าย |
| Explorer ด้วยคีย์บอร์ด | ตัวดัก keydown ของ `#tree` (↑↓ Home End Enter F2 Shift+F10) · roving tabindex (`treeFocusRow`) · F2 = `treeRenameInline` → `setSceneTitle` | ผูก `document` keydown เอง (กฎข้อ 8) |
| คำสั่งใหม่ `next-tab` · `prev-tab` · `reveal-active` | ตาราง `icons/commands.csv` + `SHORTCUT_LABELS`/`SHORTCUT_CATS` + `ui.tip.*` | คีย์นอกทะเบียน |

### ⚠️ กฎถาวร (alpha.160) — **ลบ/ย้ายไฟล์ที่เปิดเป็นแท็บ · ข้อมูลที่ต้องไม่หาย**

| เรื่อง | ทำแบบนี้ | ห้าม |
|---|---|---|
| ลบ/ย้ายไฟล์ที่อาจเปิดเป็นแท็บ | `if (!(await flushTabForMove(tab))) return;` (app.js → `tab-guard.js`) — คืน false = บันทึกไม่ผ่าน/ผู้ใช้ยกเลิก → **ยกเลิกการลบ/ย้าย** | `try { await saveTab(t) } catch {}` แล้วทำต่อ (กลืนค่า `false`) · ตั้ง `dirty=false` แล้วปิดแบบ discard |
| ลบ/ย้าย **โฟลเดอร์** (บท/เล่ม/ร่าง) | `if (!(await closeTabsUnderPath(dir)).ok) return;` — คืน `{closed, skipped, ok}` | ทิ้งค่าคืน (เดิมเป็นตัวเลขที่ไม่มีใครอ่าน) |
| AI ลบของ (entity/book/chapter/scene) | `closeTabsUnder(dir)` ของ `tab-bridge.js` คืน `{ok}` ด้วย · ไม่ ok = `err(...)` | ย้ายลงถังต่อทั้งที่แท็บยังค้าง |
| ปิดทุกแท็บ | `tabsSafeToClose()` — แท็บที่ติ๊กบันทึกแต่บันทึกไม่ผ่าน **ต้องค้างไว้** | `closeTab(f, {discard:true})` ทุกใบหลังวนบันทึก |
| เขียน `.md` ใหม่ทั้งไฟล์ (รวม **ย้าย/สำเนา**) | `writeMdKeepingComments(io, dst, text, src?)` — ส่ง `src` เมื่อไฟล์ปลายทางเป็นไฟล์ใหม่ | `kapi.writeFile(dumpMdFile(...))` — `parseMdFile` ตัดบล็อก `k2-comments` ทิ้ง |
| คัดลอกร่าง/เล่ม | `regenDraftIds()` ทุกครั้ง (guid บท + id ฉาก + ทางเลือกแตกสาย) | ก๊อป `draft.json`/`scenes.json` ตรง ๆ = id ชนกันข้ามร่าง |
| หาของตามชื่อ (AI) | ระบุตัวกรอง (เล่ม/บท) แล้วหาไม่เจอ = `null` | ข้ามตัวกรองเงียบ ๆ แล้วคืนของชื่อเดียวกันจากที่อื่น |
| ช่อง "สถานะ" | `statusChoices(allStatuses(), row.status)` — ค่าที่ถูกลบจากรายการแล้วคงไว้เป็นตัวเลือกพิเศษ | `includes(v) ? v : 'Outline'` (เปิดแล้วบันทึก = เขียนทับเงียบ ๆ) |
| ส่งเนื้อฉากให้ AI (ทุกทาง) | `liveBody(path, diskBody)` ของ `tab-bridge.js` — แท็บชนะดิสก์ | `kapi.readFile` ตรง ๆ (ไม่เห็นงานที่ยังไม่บันทึก) |
| ระดับการเข้าถึงของแชท (บท/เล่ม) | `scopePrefix()` ของ `ai/ai-scope.js` — resolve ไม่ได้ = `null` = ไม่ส่งเนื้อโปรเจกต์ | prefix `''` แล้ว `if (prefix && …)` = ส่งทั้งโปรเจกต์ |
| ฟอนต์นิยาย "ที่ใช้อยู่จริง" | `liveProseFonts()` ของ `live-fonts.js` (ตัวแก้ไข **นิยาย** → `--ed-font`) · DOCX ใช้ `firstRealFont()` | `document.querySelector('.ProseMirror')` (หยิบบทภาพยนตร์ได้) · ส่ง `K2 Lang` ให้ Word |
| สถานะของปลั๊กอินต่อ view | รวม `spErrorMarkPlugin` แล้ว (ตระกูลเดียวกับ H15/H16) · `setSpErrorMarks(list, view)` | ตัวแปรระดับโมดูลก้อนเดียว |
| งาน/แคชของ "เล่ม" | `Map` ตาม `secPath` (`_flowJobs`, `flowCache.byKey`) | ตัวแปรตัวเดียวที่ guard ก่อนเช็คว่าเป็นเล่มไหน |
| ข้อความของผู้ใช้/ไฟล์ภาษา + ไอคอน | ไอคอนเป็น node (`icon()`/`catIconEl()`) + `createTextNode(text)` | `innerHTML = iconHtml(...) + ' ' + ชื่อ` |
| อักขระควบคุมในซอร์ส | escape เสมอ (`'\u0000'`, `/[\u0000-\u0008]/`) — `test/src-hygiene.test.cjs` กวาดทั้ง `src/` | ไบต์ดิบ (git/grep มองไฟล์เป็น binary) |

**บทเรียนเครื่องมือ (Windows · Claude Code)**: heredoc ของ Bash tool **ยุบแบ็กสแลชคู่ (`\\`) เหลือตัวเดียว** — สคริปต์/ไฟล์ที่มีแบ็กสแลช
(regex `/[\\/]/` · `'C:\\x'` · `'\\n'`) ให้เขียนด้วย Write/Edit tool · Python `open(...,'w')` บน Windows แปลง LF → CRLF
(ใช้ `newline=''`) · `writeFileSync` อาจเจอ `UNKNOWN` ชั่วคราวจากตัวล็อกไฟล์ — ลองใหม่ได้ ไฟล์ไม่ถูกตัด
· ห้าม build ระหว่าง e2e · watchdog ต้องหา `STOP` ทั้งไฟล์ (บรรทัด STOP มี stack trace ต่อท้าย `tail` จึงไม่เห็น)

### ⚠️ กฎถาวร (alpha.155) — **เมนูคลิกขวาของ Explorer: ลำดับอยู่ใน `tree-menu-spec.js` ที่เดียว**

> ผู้ใช้ส่งรายการเมนูครบทุกชนิดแถวมาเอง — ลำดับคือสเปก ไม่ใช่ความเห็นของเรา

| ของ | อยู่ที่ | ห้าม |
|---|---|---|
| ลำดับ + เส้นคั่นของเมนูแต่ละชนิดแถว | `TREE_MENU_SPEC` ใน `src/tree-menu-spec.js` (unit `tree-menu.test.cjs` เทียบกับรายการของผู้ใช้ตัวต่อตัว) | เขียน `popupMenu(x, y, [...])` ของแถวใน `buildTree` ใหม่ · แทรกรายการที่ผู้ใช้ไม่ได้ขอ |
| รายการนี้ "ทำอะไร" | `treeMenuItem(kind, id, ctx)` ใน app.js → ฟังก์ชันเดิม หรือ `src/tree-actions.js` | ตรรกะก้อนใหญ่ในสวิตช์ (ย้ายไป tree-actions) |
| ชื่อรายการ | `ui.treeMenu.<id>` (สลับเปิด/ปิด: `<id>Off`) · ข้อความสถานะ `ui.treeAct.*` | ข้อความในโค้ด |
| ของที่ต้องกั้นตอนล็อก | `LOCK_BLOCKED` + `ctx.lockSrc` — เล่ม/บทที่ล็อก = ทุกฉากข้างใน (`containerLockOf`) | เช็กล็อกซ้ำเองในแต่ละรายการ |
| ดาว/หมุด/ล็อก/สี/สถานะของไฟล์ที่ไม่มี frontmatter (กระดาน · แผน · รูป) | `project.khn.json → explorer` (`src/tree-item-meta.js` · กุญแจ = ทางสัมพัทธ์ · เปลี่ยนชื่อ/ลบต้องเรียก `explorerRenamed`/`explorerForget`) | ยัดช่องใหม่ลงไฟล์ของ v1 ที่ v1 อ่านไม่รู้จัก |

**หมุดห้ามย้ายแถวจริง** — ลำดับฉาก/บทคือเนื้อเรื่อง · รายการ **"หาในดิสก์" ต้องมีทุกเมนู** (unit + e2e `[120-7]`)

### ⚠️ กฎถาวร (alpha.154) — **ไอคอนอยู่ `icons/` · ข้อความอยู่ `languages/` · ห้ามซ้ำกันสองที่**

> ผู้ใช้: **"icon อยู่ส่วน icon ภาษาอยู่ส่วนภาษา เวลาเราไปแปลจะง่าย ไม่ซ้ำซ้อน ...
> csv อันไหน header อันไหนไม่ใช้ ลบออกไป อย่าลืมนะว่าเราต้องใช้ multi languages"**

| ของ | อยู่ที่เดียว | ห้าม |
|---|---|---|
| ชื่อ/ป้ายของคำสั่ง | คีย์ภาษาของเมนู/ปุ่ม (`data-i18n-title` · `SHORTCUT_LABELS`) | สำเนาป้ายไทย/อังกฤษใน `icons/*.csv` |
| **คำอธิบาย (hint) ของคำสั่ง** | `ui.tip.<command_id>` ในไฟล์ภาษา | เขียนในโค้ด · คีย์ชื่อสุ่ม |
| **คำอธิบายแผง** | `ui.tip.toggle-panel:<id>` (แถวเดียวกับ tooltip ปุ่มเปิดแผง · `panelDesc()` อ่านจากนี่) | `desc:` ใน `PANEL_DEFS` |
| ข้อความใน `renderer/index.html` | คีย์ `data-i18n*` เท่านั้น — **ไม่มีไทยเลย** นอกคอมเมนต์ (`i18n-keys.test.cjs`) | ข้อความไทย "สำรอง" ใน HTML |
| **โครง HTML** (กล่อง · แถบ · หน้าส่งออก) | template ในโค้ด · ข้อความเป็นคีย์ทีละชิ้นผ่าน **`tx('key')` / `txf('key', [ค่า])`** จาก `src/i18n-html.js` (escape ให้เอง) · เทส `i18n-keys` ห้ามมีแท็กในไฟล์ภาษา | HTML เป็นค่าในไฟล์ภาษา (กฎเดิมของ alpha.79 — ยกเลิกแล้ว) · `innerHTML = t('...')` ตรง ๆ |
| ไฟล์ตรวจสอบ/ย้ายข้อมูลครั้งเดียว | ในโฟลเดอร์ชั่วคราว ไม่ใช่ในรีโป | ทิ้ง CSV ที่โปรแกรมไม่อ่านไว้ใน `icons/` |
| หมายเหตุนักพัฒนา (`[alpha.x]`) | คอมเมนต์ในโค้ด | ในค่าของไฟล์ภาษา (ผู้ใช้เห็นบนจอ) |

### ⚠️ กฎถาวร (alpha.150r2) — **ไอคอนในโค้ดก็ห้าม** ไม่ใช่แค่ในไฟล์ภาษา

> ผู้ใช้: **"icon ข้อความ ui ห้าม hard code ใน skill น่าจะบอกแล้วให้ใส่ที่ไหน"** → **"เก็บให้ครบเลย"**

กฎ .147 ครอบแค่ *ไฟล์ภาษา* กับ *ปุ่มใน index.html* — ส่วน **ตัวอักษรไอคอนที่เขียนไว้ในโค้ด JS**
ไม่เคยมีอะไรตรวจ จึงสะสมถึง **570 กว่าจุดใน 74 ไฟล์** (`el('div','x','📄 ' + title)`)
ตอนนี้ทุกจุดอ่านจากทะเบียนแล้ว และมีประตูกันพลาดเฝ้าไม่ให้ย้อนกลับ

| สถานการณ์ | ทำแบบนี้ | ห้าม |
|---|---|---|
| ใส่ไอคอนลง element ได้ | `icon(name, 16)` · `iconHtml(name, 16)` · `data-icon="name"` + `initIcons()` | เขียนอีโมจิลงไปตรง ๆ |
| ต้องเป็น **ตัวอักษร** (ต่อสตริง · วาดบน canvas · ข้อความใน `textContent`) | `gi('name')` จาก `src/icons.js` | `'📄 ' + title` |
| ชื่อไอคอนใหม่ | เพิ่มแถวใน `icons/glyphs.csv` (+ `icons/svg/<ชื่อ>.svg` ถ้ามีรูป) | ฝังอักขระในโค้ด |
| ตัวที่ **ไม่ใช่ไอคอน** (ปุ่ม `⌘⌥⇧` ของ mac · เส้นผังต้นไม้ในเอกสาร) | ประกาศใน `tools/icon-lexicon.cjs → NOT_ICON` พร้อมเหตุผล | ปล่อยไว้เฉย ๆ |

- **ลูกศรในประโยค** (`"ตั้งค่า → ผู้ให้บริการ"`) กับ **เส้นตีตาราง** ไม่ใช่ไอคอน — เป็นเครื่องหมายวรรคตอน
  เทสจึงไม่ฟ้อง (ช่วง `U+2190–21FF` และ `U+2500–257F`)
- เครื่องมือยกของเก่า: `node tools/icon-extract.cjs [--apply]` — เดินผ่านเลกเซอร์/ตัวจัดประเภทตัวเดียว
  กับเครื่องมือ i18n จึงไม่แตะคอมเมนต์ · regex · ค่าที่เขียนลงไฟล์งาน · บล็อกเทส · ข้อความใน `` T`…` ``
- ประตูกันพลาด: **`test/ui-audit.test.cjs`** ข้อ 4 — กวาดทั้ง `src/` หาไอคอนในโค้ด + ตรวจว่าทุกชื่อที่
  `gi()` เรียกมีอยู่จริงในทะเบียน (ชื่อผิด = ไอคอนหายเงียบ ๆ เพราะ `gi()` คืน `''`)

### ⚠️ กฎถาวร (alpha.137) — ธีมสี + แถบบน (แถบเดียว)

**[alpha.159] ทะเบียนธีมย้ายไป `renderer/themes/themes.json` ที่เดียว** (คู่มือเต็ม: `renderer/themes/README.md`)
เพิ่มธีม = เพิ่มก้อนใน themes.json (`id` · `mode` · `name.th/en` · `colors` 5 สีหลัก) → `node build.js` แล้ว **ตัวสร้างทำให้ครบ**:

| ที่ | ไฟล์ (สร้างโดย `tools/theme-build.cjs` — ห้ามแก้มือ) |
|---|---|
| ตัวแปรสี | `renderer/themes/<id>.css` (สูตรใน `src/theme-gen.js` · ธีม `handmade:true` เขียนมือได้ — เทมเพลต `_template.css`) |
| `<link>` | `renderer/index.html` ระหว่าง `<!-- themes:begin -->` … `<!-- themes:end -->` |
| ทะเบียน | `src/generated/themes-data.js` → `THEMES` · `THEME_LABEL_KEYS` · `THEME_MODES` (core.js re-export) |
| ป้ายชื่อ | `languages/k2_*.csv` คีย์ `ui.themes.<idCamel>` (เพิ่มเฉพาะที่ขาด · คำแปลที่แก้แล้วไม่ถูกทับ) |
| ช่องเลือกในตั้งค่า / เมนู มุมมอง | สร้างจาก `THEMES` อยู่แล้ว — ไม่ต้องแตะ |

`test/theme.test.cjs` ตรวจ: ตัวแปรครบ · คอนทราสต์ (`MIN_CONTRAST`) · mode ตรงกับความสว่างพื้น · ไฟล์ที่สร้างตรงกับ themes.json (ลืม build = แดง)

- **ธีมห้ามแตะ `--paper-*`** (ยกเว้น `--paper-surround` ซึ่งเป็นพื้น *รอบ* กระดาษ = เปลือกโปรแกรม)
  — เปลี่ยนได้แค่หน้าตาโปรแกรม ห้ามกระทบหน้ากระดาษ/งานที่ส่งออกแม้แต่นิดเดียว
- ธีมใหม่ต้องกำหนด **ตัวแปรพื้นผิวครบทุกตัว** (`--hover --hover-soft --titlebar --sunken --chip
  --danger-soft --canvas` ฯลฯ) ไม่งั้นมีพื้นผิวค้างสีของธีมเดิม (บทเรียน `[81-5]`)
- ค่าเริ่มต้นตอนนี้ = **`k2`** (จานสีประจำโปรแกรม: `#1e1250` `#452f5e` `#ff6640` `#ffc55c`)
- **[alpha.138] `k2` · `k2-light` อยู่หัวทะเบียนเสมอ** — dark/light ของเดิมถูกลบทิ้ง · [alpha.159] ธีมจานสีเพิ่มอีก 18 ชุด
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

selftest อยู่ใน `runTest()` ของ **src/selftest.js** (alpha.160 แยกออกจาก app.js) — รูปแบบ `check('ชื่อไทย', เงื่อนไข, ข้อมูล debug)`
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

