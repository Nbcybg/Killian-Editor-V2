---
name: killian-2
description: Build, maintain, extend, and debug Killian 2 (คิเลียน / Killian Editor v2 / K2) — a portable Electron 43 + ProseMirror desktop app for writing novels + screenplays, Thai-first, storing everything as Markdown + JSON (100% file-compatible with the old Python v1). Use whenever the user asks to add a feature, fix a bug, change the UI, adjust the Wiki/screenplay/explorer/spellcheck/panel systems, or ship a new build for this writing app. Triggers on "คิเลียน", "Killian", "Killian 2", "K2", "โปรแกรมเขียน", "บทหนัง/บทภาพยนตร์", "screenplay editor", "ProseMirror", "SmartType", "wiki", "story network", "explorer", "scenes.json", "draft.json", "templates.json", "ตรวจคำผิด", "spell check", "panel docking", "floating bar", "e2e/selftest", "ถังขยะ", "คลังรูป", "เวิร์กโฟลว์ส่งออก/compile", "จัดการเล่ม/book manager", "เส้นเวลา/timeline", "แผนที่/maps", "โหมดหน้ากระดาษ/paper mode", "ซูม/zoom", "จัดหน้า/align", "หมวด wiki", and any request about this novel/screenplay app — even a pasted stack trace or a bare "แก้บั๊ก".
---

# Killian 2 (คิเลียน อีดิเตอร์ v2)

โปรแกรมเขียนนิยาย + บทภาพยนตร์ของ Top — **Electron 43 + ProseMirror**, พกพาได้, ไทยเป็นหลัก
เขียนใหม่จาก v1 (Python/Tkinter) แต่ **ไฟล์งานเข้ากันได้ 100%** (.md + .json เหมือนเดิม)

**คุยกับผู้ใช้เป็นภาษาไทย กระชับ ตรงไปตรงมา** ผู้ใช้ = Top (นักออกแบบ/dev, กรุงเทพฯ)

---

## เริ่มงานทุกครั้ง: เอาซอร์สมาก่อน

**[alpha.61] มี 2 สภาพแวดล้อม — ดูก่อนว่าอยู่ที่ไหน**

| ที่ | path | หมายเหตุ |
|---|---|---|
| **เครื่อง Top เอง (Mac Intel)** | `/Users/kaipleng/Desktop/Killian2` | repo จริง มี git remote · build .dmg ได้ที่นี่เลย |
| แซนด์บ็อกซ์ (Linux) | `/home/claude/work/v2_extract/Killian2` | ต้องขอ `Killian2-src.zip` แล้วแตก · ต้องใช้ xvfb |

**ถ้าอยู่บนเครื่อง Top: `node_modules` มักถูกก๊อปมาจาก Windows** → esbuild/electron เป็นไบนารีผิดแพลตฟอร์ม
```bash
node build.js || {                       # เห็น "installed esbuild for another platform" = ต้องซ่อม
  npm install --no-audit --no-fund       # ได้ @esbuild/darwin-x64
  rm -rf node_modules/electron/dist node_modules/electron/path.txt
  node node_modules/electron/install.js  # ดาวน์โหลด Electron.app ของ darwin
}
```

แซนด์บ็อกซ์อาจล้างระหว่าง task — เช็คก่อน ถ้าไม่มีให้ขอ `Killian2-src.zip` (ล่าสุด) แตกที่ `/home/claude/work/v2_extract/`

```bash
ls /home/claude/work/v2_extract/Killian2/src/app.js 2>/dev/null && echo "มีแล้ว" || echo "ขอ zip"
cd /home/claude/work/v2_extract/Killian2 && npm install   # ~1-2 นาที (node_modules ไม่อยู่ในซิป)
```

Src zip **ไม่มี node_modules** แต่ **มี `renderer/bundle.js` ที่ build แล้ว** + **dict** (`renderer/assets/dict_th.txt` 1.5MB, `dict_en.txt`) → รันได้หลัง npm install ทันที

---

## ข้อห้าม/หลักที่ผู้ใช้ย้ำ

| หลัก | หมายเหตุ |
|---|---|
| **ไทย 100%** ทุก UI | Fade In/Final Draft ใช้ไม่ได้เพราะไม่รองรับไทย |
| **พกพาได้ ไม่ต้องติดตั้ง** | win portable / mac .app |
| **ไฟล์แก้นอกโปรแกรมได้** | เนื้อหา = .md · เมทาดาทา = .json |
| **คีย์ลัดทำงานทุกแป้นพิมพ์** | จับด้วย `e.code` (ปุ่มกายภาพ) ไม่ใช่ตัวอักษร |
| **"เอาให้ครบก่อน แล้วแก้บั๊กทีเดียว"** | ผู้ใช้ชอบทำหลายฟีเจอร์รวดเดียว |

---

## สถาปัตยกรรม (เสถียร)

- **main.js** — electron main: IPC `H('channel', fn)` (fs/dialog/print/printToPdf/recent/spell/mtime/writeImageData), frameless titlebar (`frame:false`), contextIsolation
- **preload.js** — บริดจ์ `kapi` (readFile/writeFile/readJson/exists/join/mkdir/move/remove/listFiles/listDirs/mtime/copyInto/writeImageData/spellBase/spellExtra/spellAddWord/spellDownload/spellHasBase/testShot/**openFileDialog**/**openDirDialog**/**pdfFromHtml**/**clipboardWrite**/**stat** [alpha.63]). **ไม่มี writeJson** (ใช้ writeFile + JSON.stringify) · `saveAsDialog(name, kind?)` เลือกฟิลเตอร์ตามนามสกุลให้เอง (มี fdx/rtf แล้ว) · `pdfFromHtml(html,out,{width,height,margins})` = เขียน HTML ลงไฟล์ชั่วคราวแล้ว `printToPDF` ใน **BrowserWindow ซ่อน** (data: URL ยาวไม่พอ + `@font-face` file:// ต้องมี origin จริง)
- **src/** (esbuild → `renderer/bundle.js`):
  - `md.js` — พาร์เซอร์ .md ↔ doc (พอร์ตตรงจาก v1 → ไฟล์เข้ากันได้ 100%)
  - `editor.js` — `KEditor` (นิยาย): schema + `mentionPlugin` + `spellPlugin` + export `imageLightbox`
  - `screenplay.js` — `SPEditor` (บทหนัง): fountain, Enter=element ถัดไป, **Ctrl+↑/↓ สลับ element** (Tab สงวนให้ SmartType), มี spellPlugin
  - `fountain.js` — `SP_ELEMS/TAB_CYCLE/NEXT_ELEM/SCENE_PREFIX/TIMES/TRANSITIONS`
    · **[alpha.60r3a] มาตรฐานรหัสใหม่ = มาร์กดาวน์** (อิง `kevinmcaleer/scriptmd2pdf`)
      หัวฉาก `### ` (=H3 ในนิยาย) · ฉากย่อย `#### ` (=H4) · ตัวละคร `@` · วงเล็บ `((…))` ·
      ทรานซิชันออก `>> ` · เข้า `<< ` · ช็อต `! ` · ขึ้นหน้าใหม่ `---` · โน้ต `/// `
      **อ่านรหัส v1 ได้ครบ** (`.` `>` `!x` `$shot ` `$sub ` `$in ` `$intercut ` `$act `)
      แต่ `lineFor()` **เขียนแบบใหม่เสมอ** → บันทึกครั้งเดียวไฟล์ย้ายมาตรฐานเอง
    · **รหัสที่ชนกันและวิธีตัดสิน** (พลาดตรงนี้แล้วไฟล์เก่าพังเงียบ ๆ):
      `! ` (มีวรรค)=ช็อต · `!x` (ไม่มีวรรค)=บรรยายบังคับ v1 · `![](…)`=รูป ·
      `((…))` ใต้ตัวละครที่เขียน `@` จริง **และไม่มีบรรทัดว่างคั่น** = วงเล็บ · ที่อื่น = โน้ต v1
      (ตัวจับชื่อตัวละครอัตโนมัติหลวมมาก — บรรยายสั้นอย่าง "ลมพัดผ่าน" ก็เข้าเกณฑ์)
    · `## `/`#### ` ใช้กับ "ตอน"/"สลับฉาก" ไม่ได้ (ชนโครง 2 / ฉากย่อย) → คงรหัส v1 (`$act `/`$intercut `)
    · `classify(line, prevBlank, prevType, prevLine)` — **`prevLine` จำเป็น** ที่ `parseScript`/`omitElements`
    · `SP_MD_PREFIXES` = แหล่งเดียวของรายการรหัสที่โหมดนิยายต้องซ่อน (markdown-code-toggle ดึงไปใช้)
      **ไม่มี `#`/`##`/`###`/`---`** — md.js แปลงเป็นหัวข้อ/เส้นคั่นจริงไปแล้ว ไม่ต้องซ่อน
  - `smart.js` — `SmartType` (เดาชื่อขณะพิมพ์ · prefix match ไทยไม่มีช่องว่าง)
  - `spell.js` — เอนจินตรวจคำผิด (ไทย maximal-matching DP + อังกฤษ wordlist+morphology) · `loadBase/setExtra/check/ready`
  - `wiki.js` — `WikiEditor` + `imageLightbox`
  - `gallery.js`, `network.js`, `ui.js` (**`window.prompt()` = no-op ใน Electron!** ใช้ ask/confirmBox)
    · **`network-layout.js`** (alpha.63r4, บริสุทธิ์) — `forceLayout`/`seedLayout`/`loadPositions`/
      `savePositions`/`clearPositions`/`nodeKey` · **บันทึกเฉพาะโหนดที่ผู้ใช้ลากเอง (`_pinned`)** และ
      **key แยกตามโปรเจกต์** (`k2-net-layout2:<hash root>`) — บทเรียน 100
      (`network-toolbar.js` ถูกลบทิ้งที่ .64 — เป็นโค้ดตายที่ไม่มีใคร import · `network.js` มี `buildToolbar()` เอง)
  - **`core.js`** — แกนกลางที่ทุกโมดูลใช้ร่วม: `$`,`el`,`state`,`smart`,`log`,`setStatus` + ค่าคงที่ (`DEFAULT_SETTINGS`,`SCENE_STATUSES`,`SCENE_COLORS`,`BUILTIN_CATS`,`CAT_ICON`,`BASE_ED_FS`,`ZOOM_*`) — **ทุกไฟล์ใหม่ import จากนี่**
    · **[alpha.62 บั๊ก 9+10] `setBusy(msg)`/`clearBusy()`/`busyMsg()`/`withBusy(msg,fn)`** = ตัวบอก "กำลังทำอะไรอยู่"
      ที่ **`#status-busy` ในแถบสถานะล่าง** (สปินเนอร์เล็ก + ข้อความ · `pointer-events:none`)
      **หน้าจอ loading เต็มจอ `#k-loader` ถูกลบทิ้งแล้ว — ห้ามเอากลับมา** (ดูบทเรียน 85)
      `showLoader`/`hideLoader` ใน app.js เหลือเป็นแค่ชื่อเก่าที่ชี้มาที่ `setBusy`/`clearBusy`
      **กฎเหล็ก: ก่อนเปิดกล่องที่ต้องรอผู้ใช้ตอบ (บันทึก/ยืนยัน/เลือกไฟล์) ต้อง `clearBusy()` ก่อนเสมอ**
      และงานยาวทุกอันครอบด้วย `withBusy` หรือ `try/finally` — ล้มแล้วต้องไม่เหลือสปินเนอร์ค้าง
  - `app.js` (~5,300 บรรทัด: bootstrap/explorer(buildTree)/tabs/toolbar(floatBar)/zoom(pageZoom)/commands/shortcuts/**selftest**) — orchestrator
  - **แยกจาก app.js แล้ว (alpha.39, feature modules):** `dashboard.js` · `books.js` · `timeline-ui.js` · `maps-ui.js` · `wiki-ui.js` · `scene-ops.js` · `section-ops.js` · `scene-props.js` · `dialogs.js` · `recycle.js` — จุดที่ feature ใหม่มาต่อยอด (ดู **AGENTS.md** สำหรับกฎ import/circular/CommonJS ก่อนแก้)
  - **โมดูล feature รอบ .39–.40 (ต่อเมนูครบแล้วทุกตัว):** `home-ui.js` · `tag-pane.js` · `global-search.js` · `scene-table.js` · `scratchpad.js` · `quick-open.js` (fuse.js) · `custom-status.js` (`allStatuses()` = มาตรฐาน+ที่ผู้ใช้เพิ่ม — scene-ops/scene-props ใช้ตัวนี้) · `focus-mode.js` (มี `cursorBlock()` ที่ typewriter ใช้ร่วม) · `typewriter.js` · `word-history.js` · `backup.js` (`backupIfDue` รายวัน) · `export-zip.js` (jszip + `writeBytes`) · `export-blog.js` · `comments/comment-core.js`+`comment-ui.js` (แผงคอมเมนต์ · เก็บท้ายไฟล์ .md — `comments.js` เดิมถูกลบใน .48) · `thesaurus.js` (คืน menu items ให้เมนูคลิกขวาเดิม) · `project.js` (เทมเพลตโปรเจกต์) · `ai-settings.js`+`ai-summary.js` (key แยกไฟล์ · `kapi.httpFetch`) · `branching-ui.js` · `floorplan-ui.js` · `player-choices.js` · `visual-tags.js` (ชิปสีในตารางฉาก) · `session-notes.js` · `centralize-ui.js`
  - **`relationship-types.js`** (alpha.45, บริสุทธิ์) — 9 ประเภทความสัมพันธ์ + สี/ไอคอน: `REL_TYPES`/`REL_COLOR`/`REL_LABEL`/`REL_ICON`,
    `categorizeRole(role)` เดาประเภทจากบทบาทไทย+อังกฤษ (เช็ค mentor/ลูก-น้อง-ค้า-หนี้ **ก่อน** family ไม่งั้น "ลูก" ดูดหมด),
    `categorizeWith(map, role)` ให้ตาราง `categories` ใน `renderer/inverse_roles.json` ชนะ regex. re-export ผ่าน core.js · **unit test 28 ข้อ**
  - **`sensory-profile.js`** (alpha.45) — บรรยากาศรับรู้ของสถานที่: `renderSensoryProfile(wrap, entity, onDirty)` (เรียกซ้ำได้ ไม่ซ้ำช่อง),
    `ensureSensory` (เรียกใน `addEntity` + `openEntity`), `isSensoryEntity`/`sensoryFilled` · เก็บใน `entity.sensoryProfile`
  - **`branch-graph.js`** (alpha.42 · ขยายใหญ่ใน alpha.66, บริสุทธิ์) — เอนจินผังแตกสาย:
    `buildGraph` (choices→edges, ตั้ง `dangling`, พก `color` ของ choice มาด้วย),
    `layoutGraph(graph, {positions, refine})` (BFS ระยะสั้นสุด → x/y แล้ว **ขัดด้วยแรง**),
    `analyzeGraph` (roots/endings/unreachable/cycles ด้วย DFS สี)
    · **alpha.66**: `refineLayout` (barycenter + ผลักในคอลัมน์ — แรงผลักทำหลังเสมอจึง**รับประกัน**ว่าไม่ทับ) ·
    `enumeratePathsInfo` (ไล่เกินโควตา 1 เส้นเพื่อรู้แน่ว่าถูกตัดไหม) · `validateChoices`/`danglingChoices`
    (แยก `empty` = ยังไม่ระบุ ออกจาก `missing` = ชี้ไปฉากที่ถูกลบ) · `highlightPath`/`edgeKey` ·
    `mergeDuplicateChoices` (ยุบเฉพาะเมื่อปลายทางไปกันได้) · `filterNodes`/`expandWithNeighbors` ·
    **ตัวส่งออก 3 ตัว**: `graphToOutline` (Markdown tree) · `graphToJson` · `graphToHtmlTree` (หน้าเดี่ยว escape ครบ)
    · UI = `branching-ui.js` วาด SVG (เส้น) + div (กล่อง). **unit test แยก 118 ข้อ** (`test/branch.test.cjs`)
  - **`player-mode.js`** (alpha.66) — แผงทดลองเล่น: อ่านฉากด้วย `KEditor` + `editable:()=>false` ·
    ทางเลือกเป็นปุ่ม · ย้อนกลับทีละก้าว · เส้นทางเก็บใน `state.meta.playthroughs[]` (เขียนทุกก้าว
    เก็บ 40 รอบล่าสุด) **แยกจาก `playerHistory` เดิม** ที่เป็นการตัดสินใจปนกันทั้งหมด
    · **ระวัง**: มันบันทึกลง `playerHistory` ด้วย → เทสที่นับ `choiceStats()` ต้องล้างทั้งสองที่
  - **`ai/` (alpha.61 — ผู้ให้บริการที่ผู้ใช้ตั้งเอง + แชท opencode)**
    · **`ai/ai-providers.js`** (บริสุทธิ์) — `PARAM_DEFS`(12) · `normalizeParams` · `parseDomains`/`isDomainAllowed`
      · `newProvider`/`validateProvider` · `stripSecrets`/`withSecrets` · `modelsRequests`/`parseModels`
      · `chatRequest`/`parseChat` · `listProviders`/`activeProvider`/`upsertProvider`/`removeProvider`
    · **`ai/ai-session.js`** (บริสุทธิ์) — `CHAT_MODES`(**plan/write/agent** — alpha.64) · `modeCap()` คืนสิทธิ์
      `read|write|full` · `SCOPES`(project/book/chapter/scene/none) · **`TRANSCRIPT_VIEWS`** 4 แบบ (alpha.64)
      · `isSendKey` · `newSession`/`addMessage`/`renameSession`/`archiveSession` · `hasConversation()`
      · `sessionStats`/`contextLabel` · `searchSessions` · `chatMessages` (ตัดประวัติตามงบ token) · `rawJson`/`shareMarkdown`
      · ⚠ `newSession(j)` ประกอบ object ใหม่ทีละฟิลด์ — **เพิ่มฟิลด์ใหม่ต้องเพิ่มที่นี่ด้วย ไม่งั้นหายตอนโหลดกลับ**
      (บทเรียน 103 — `titleSet` เคยตกหล่นจนชื่อที่ผู้ใช้ตั้งเองถูกทับ)
    · **`ai/ai-tools.js`** (alpha.64 · บริสุทธิ์) — โปรโตคอลให้ AI สั่งงานแอป: `TOOLS`(15) ·
      `toolsSystemPrompt(cap)` · `parseToolCalls`/`stripToolCalls` · `validateCall(call,cap)` ·
      `describeCall` · `hasDestructive` · `resultsMessage` — ดูบทเรียน 102
    · **`ai/ai-actions.js`** (alpha.64) — ตัวลงมือทำ `runToolCall()` · เขียน `draft.json`/`scenes.json`/
      `section.json`/`.md` เองตามรูปแบบเดิม (เรียก scene-ops/section-ops ตรง ๆ ไม่ได้ — มันถามชื่อเสมอ)
    · `ai/ai-provider-ui.js` — กล่องตั้งค่า + ป๊อปอัป 4 ส่วน · **`sendRequest()` = ประตูเดียวที่ตรวจ Allowed Domains**
      · `complete()` คืน `thinking` ด้วยแล้ว (alpha.64)
    · `ai/ai-chat-panel.js` — แผง 3 ชั้น (รายการ → เซสชัน → รายละเอียด) · `collectScope()` บังคับระดับการเข้าถึงจริง
      · **วนรอบ tool call สูงสุด `MAX_TOOL_ROUNDS`=5** · `runCalls()` คุมการยืนยัน (ลบ = ถามเสมอ)
      · `saveSession(s,{force})` — เซสชันฉบับร่าง (`_draft`) ยังไม่เขียนไฟล์จนกว่าจะมีข้อความแรก
    · (ของเดิม `ai/ai-core.js` · `ai-bridge.js` · `ai-ui.js` ยังอยู่ — ฟีเจอร์ AI เดิมวิ่งผ่าน `callAI()` ที่ต่อเข้าทะเบียนใหม่แล้ว)
    · **[alpha.62] `aiConfigured()` ใน `ai-settings.js` = จุดเดียวที่ทุกฟีเจอร์ถามว่า "ตั้งค่าครบหรือยัง"**
      (คืน `{ok, why}` — ห้ามเขียนตัวเช็คคีย์เองในไฟล์อื่นอีก)
  - **`search-engine.js`** (alpha.39, บริสุทธิ์) — ค้นหาเต็มข้อความทั้งโปรเจกต์: tokenizer ไทย (`Intl.Segmenter('th')`+bigram fallback) → inverted index → `SearchIndex.build/search` (คำเดียว/AND/OR/NOT/`field:`) → snippet+line+score. `indexProject(root,kapi,parseMd)` เป็น integration layer. **unit test แยก · ค้น 1,000 ไฟล์ ~16ms/คิวรี**
  - **`panels/panel-layout.js` + `panel-store.js`** (alpha.39, บริสุทธิ์) — layout tree ของ panel: `snapZone`,`dockPanel`,`addAsTab/moveTab/splitTab`,`resizeDock`,`removePanel`(+collapse) · store: `serializeLayout`/versioning/migrate + `PanelStore`(รับ storage adapter) + `PanelManager`
    · **[alpha.62 บั๊ก 21] ปิดแผง = ติดธง `hidden` — ไม่ตัดโหนดออกจากต้นไม้อีกแล้ว**
      `setPanelHidden`/`isPanelHidden`/`nodeHidden`/`visiblePanelIds` + `resizeDockPair(root,dock,i,j,r)`
      **คำที่ต้องแยกให้ขาด**: `isDocked` = "มีสล็อตในต้นไม้" · `isHidden` = "ปิดอยู่" ·
      `isOpen` = `isDocked && !isHidden` (หรือลอยอยู่) — ใช้ผิดตัวแล้วเมนู/ปุ่มสวิตช์เพี้ยนทันที
      `panelIds()` คืน**ทุกตัวรวมที่ซ่อน** (prune/หาสล็อตต้องใช้) · `visiblePanelIds()` คืนเฉพาะที่เห็น
      ตัววาดต้องข้ามตัวที่ซ่อน **ทั้ง 3 ที่**: ไม่วาด · ไม่นับใน `growSum` · ไม่วางที่จับข้าง ๆ
      (ที่จับส่งดัชนีจริงของทั้งสองฝั่งเข้า `resizeDockPair` เพราะอาจมีตัวที่ซ่อนคั่นอยู่)
      `detachPanel` ต้อง **ลบธง hidden ทิ้ง** — ลากไปวางแล้วต้องเห็นเสมอ
  - **`panels/panel-renderer.js` + `panel-drag.js` + `panel-ui.js`** (alpha.46) — **UI จริงของ Panel System** (ดูหัวข้อด้านล่าง)
    · **[alpha.62 บั๊ก 12] `currentRatio()` = `treeRatio() || domRatio()` — อ่านจาก layout tree ก่อนเสมอ**
      วัดจาก DOM ไม่ได้เพราะ `dock.width` รวม `.k-resize-handle` ที่คั่นอยู่ → ค่าต่ำกว่าจริงทุกครั้ง
      แล้ว `rememberOpenPanels()` (ทุก 250ms หลังวาด) เอาไปทับ → ปิด-เปิดแผงทีหนึ่งหดลงอีกนิด **สะสม**
    · **[alpha.62 บั๊ก 13] `sideBetween(r, r2)` ตอบ 4 ทิศ** — `rememberHome` เดิมคิดแค่แกนนอน
      แผงที่ผนึกแนวตั้ง (dock `col`) มี `left` เท่ากัน → ได้ `'left'` เสมอ ตำแหน่งหายทุกครั้งที่ปิด-เปิด
    · **[alpha.62 บั๊ก 16] แผงครบวงแล้ว** — `network` · `planner` · `floorplan` เข้ามาเป็นแผงชุดสุดท้าย
    · **[alpha.66 ข้อ 1] ปิดวงจริง** — `branch` (ผังแตกสาย) + `player` (ทดลองเล่น) เข้ามาเป็นแผง
      **ไม่เหลือแท็บเอกสารเทียม `::xxx::` ของฟีเจอร์ที่ไม่ใช่เอกสารอีกแล้ว** (`::branching::` ถูกยุบ)
      · แผงทั้งสองใช้ **container query** (`container-type:inline-size` บน `.branch-host`/`.player-host`)
      ไม่ใช่ media query — ผนึกเป็นแผงแคบข้างซ้ายแล้ว media query ยังคิดว่าจอกว้างอยู่
  - **`layout/split-layout.js`** (alpha.39, บริสุทธิ์) — recursive split tree: `splitPane`(ลากขอบ→row/col),`resizeSplit`(+snap 50%),`removeLeaf`(+collapse), `leaf.tabId` เชื่อมกับ Panel System · store: `serializeSplit`/`SplitStore`. UI = `split-ui.js` (`renderSplitTree`/`initSplitSystem` + โหมดเทียบ 2 ช่องแบบเดิม)
  - `compile.js` — **เอนจินเวิร์กโฟลว์ส่งออก** (บริสุทธิ์ ไม่แตะ DOM/fs): `STEP_DEFS` 3 stage (model/render/text), `PRESETS`×7, `runWorkflow(model,wf,{spFormat})`, `mdToHtml`, strip helpers — มี unit test แยก
    · **alpha.58**: ขั้นตอน `sp-continued` (stage text · ปิดไว้ทุกพรีเซ็ต) + `insertContinueds(text, fmt)`
  - `timeline.js` — **เอนจินเส้นเวลา + Gantt** (บริสุทธิ์): `extractNum` (ถอดเลขจากข้อความไทย "ปีที่ 1,024"→1024), `sortEvents`, `mergeTimeline(events,sceneEvents)` (**ต้อง copy ทุก field ที่ UI ใช้ รวม whenEnd**), `groupByTrack`, `findClashes`, `ganttData/ganttBar/ganttTicks`, `newEvent`
  - **`sp-format.js`** (alpha.56, บริสุทธิ์ · **ข้อ 81–85, 92, 97**) — รูปแบบบทภาพยนตร์ระดับใช้งานจริง
    `PAPER_SIZES`(letter/a4/legal/custom)/`MARGIN_DEFAULTS`(T1 B1 L1.5 R1)/`linesPerPage`(Letter=54)/`textWidth` ·
    `SP_ELEMENT_CONFIG` **หน่วยนิ้ว วัดจากขอบกระดาษแบบ Final Draft** (character 3.7"/3.8" · dialogue 2.5"/3.5") ·
    `SP_ELEMENT_STYLES` screen vs print · `PAGE_BREAK_RULES` · `SP_STRINGS` · `mergeSpFormat(user)` ·
    `pageCssVars()` → `--page-w/--mg-*/--text-w` · `spCss()` **สร้าง CSS + `@page` เป็นข้อความ**
    (`@page` ใช้ CSS var ไม่ได้ · `max-width:calc(100%-x)` ก็ใช้ไม่ได้เพราะ 100% รวมเส้นขอบ 2px → หนีบใน JS แทน) ·
    `paginate()` (MORE/cont'd/CONTINUED · ไม่ทิ้งชื่อตัวละครท้ายหน้า) · `rosterToText()` · **unit test 74 ข้อ**
  - **sp-format.js เพิ่มใน alpha.57a**: `SCENE_NUMBER_DEFAULTS` (ซ้าย 0.75" ขวา 1" · ปิดไว้) ·
    `PAGE_NUMBER_DEFAULTS` (ขวา 1" บน 0.5" · หน้าแรกไม่ใส่เลข) · `sceneNumberOffsets(fmt)` (คืนระยะ**เทียบกล่องหัวฉาก** —
    ค่าติดลบ = ล้ำออกนอกกล่อง) · `pageNumberLabel(index, fmt, startPage)` · `spCss()` สร้าง `.k-scene-no-l/-r`
    · element ใหม่ 3 ตัวใน `SP_ELEMENT_CONFIG/STYLES`: `transition-in` (ซ้าย) · `subheader` · `intercut`
  - **fountain.js เพิ่มใน alpha.57a**: prefix `$in ` / `$sub ` / `$intercut ` (แนวเดียวกับ `$shot `/`$act ` — round-trip ปิดวง) ·
    `splitCharacter(text)` / `withExtension(text, ext)` (ส่วนเสริมเว้นจากชื่อ **1 วรรคพอดี** เสมอ) · `TRANSITIONS_IN` · `INTERCUTS`
  - **`roster-ui.js`** (alpha.56, ข้อ 97) — หน้ารายชื่อตัวละคร: หน้าเดี่ยว**ประจำเล่ม** เก็บ `<Section>/roster.json`
    (ไม่อยู่ในฉากเลย) · แท็บ `::roster::<secPath>` · `saveTab()` แยกทางไป `saveRosterTab()` · ไม่มีเลขหน้า
  - **`sp-validator.js`** (alpha.57, บริสุทธิ์ · **ข้อ 54**) — `SP_ERRORS` 8 ชนิด/`SP_SEVERITY`/`DEFAULT_LIMITS` ·
    `validateScreenplay(blocks,{limits,checks})` → `[{type,block,el,msg,severity}]` (`block` = ดัชนีใน array ที่ส่งเข้ามา **รวม blank**) ·
    `errorSummary`/`summaryText`/`nextError` (วนกลับต้น) · **unit test 35 ข้อ**
  - **sp-view.js เพิ่มใน alpha.58 (ข้อ 58 Layout View)**: โหมด `layout` ใน `SP_VIEWS` (คลาส `sp-view-layout`) ·
    `isEditView(mode)` (layout ยังพิมพ์ได้ · side/overview อ่านอย่างเดียว) ·
    **`pageMetrics(fmt)`** → `linesPerPage/charsPerLine/pageWidthPx/bodyHeightPx/lineHeightPx`
    (Letter = 54 บรรทัด · 60 ตัว/บรรทัด · 816×1056px · เนื้อหน้า 864px · บรรทัดละ 16px) ·
    `layoutCssVars(fmt,gap)` → `--sp-body-h/--sp-page-gap/--sp-line-h`
  - **`sp-view.js`** (alpha.57, บริสุทธิ์ + ตัววาด DOM · **ข้อ 57/59/60/78**) —
    `SP_VIEWS`/`SP_VIEW_CLASS`/`ALL_VIEW_CLASSES`/`isPageView` · `fitScale(w,pageW,gap)` (≤4 หน้า/แถว · ไม่ย่อต่ำกว่า 0.5) ·
    `overviewScale(px)` (Courier 12pt = 9.6px/ตัว) · **`blocksFromDoc(doc)`** (บล็อกจาก doc จริง พร้อม `pos` — action ว่าง→`blank`) ·
    `pagesOf`/`pageStartPositions`/`findPageStart`/`scenePositions`/`findNthScene` · `renderPageView(host,pages,fmt,opts)` · **unit test 45 ข้อ**
  - **`sp-continued.js`** (alpha.58, บริสุทธิ์ · **ข้อ 55 + 56**) — ระบบต่อเนื่อง:
    `CONTINUED_DEFAULTS`(re-export จาก sp-format) · `CONTINUED_TYPES/CLASS/SIDE` ·
    `computeContinueds(pages, fmt)` → `[{pos,page,type,text,side,cls}]` (pos = ตำแหน่งบล็อกแรกของหน้าถัดไป) ·
    `pageAnchor` · `continuedsFromBlocks` · `continuedSummary/StatusText` ·
    `pagesWithContinueds` + `continuedPlainText` (ใช้ตอนส่งออก) · **unit test 45 ข้อ**
    · **`side` สำคัญ**: ท้ายหน้า (more −40 / continued-bottom −30) ต้อง **น้อยกว่า −1** ของเส้นคั่นหน้า
      ต้นหน้า (continued-top 10 / contd 20) ต้องมากกว่า — ไม่งั้นเครื่องหมายไปโผล่ผิดฝั่งของเส้น
  - **`sp-reports.js`** (alpha.58, บริสุทธิ์ · **ข้อ 71/72/73**) — รายงานบท:
    `parseHeading` (INT./EXT./I/E./EST./ฉากภายใน-ภายนอก + ตัดเวลาหลัง " - ") · `cleanCharacterName` ·
    `sceneBreakdown` (แผนที่ `b.idx → หน้า` จาก paginate) · `generateLocationReport(groups ตั้งเองได้)` ·
    `generateCharacterReport` · `generateDialogueChart` + `CHART_KINDS/LABELS` ·
    `locationReportText/characterReportText/dialogueChartText` · **unit test 54 ข้อ**
  - **`prose-format.js`** (alpha.58r, บริสุทธิ์ · **บั๊ก 16–24**) — รูปแบบ "นิยาย" ทั้งชุด:
    `PROSE_DEFAULTS`/`HEADING_DEFAULTS`/`QUOTE_DEFAULTS`/`DEFAULT_PROSE_FONT` (ตัวพิมพ์**สัดส่วน** ไม่ใช่ Courier) ·
    `mergeProseFormat` · `proseCssVars` (`--ed-lh/--ed-para/--ed-indent`) · `proseCss(fmt, sel)` ·
    **`proseExportCss`** (WYSIWYG — `mdToHtml` ใช้ตัวนี้) · `proseLinesPerPage/proseCharsPerLine/proseMetrics` ·
    `paginateProse`/`prosePageCount`/`prosePageLabel` · `proseBlocksFromDoc`/`proseHeadings`/`findProsePageStart`
    · **unit test 84 ข้อ**
    · **หลักคิด**: บทภาพยนตร์วัดทุกอย่างเป็น "นิ้วจากขอบกระดาษ" · นิยายวัดเป็น "em/เท่าของขนาดตัวอักษร"
      → หน้ากระดาษ/ระยะขอบใช้ร่วมกัน (`--page-w/--mg-*`) แต่รูปแบบข้อความแยกคนละเอนจิน
  - **`prose-view.js`** (alpha.58r · **บั๊ก 15+20**) — มุมมองหน้ากระดาษของนิยาย:
    ใช้ **คลาส pane ชุดเดียวกับบท** (`sp-view-layout/draft/side/overview*`) เพื่อไม่ต้องซ้ำ CSS ·
    `prosePageBreakPlugin()`+`setProsePageBreaks()` (คีย์แยกจาก sp — เปิดพร้อมกันคนละแท็บได้) ·
    `renderProsePageView` (บล็อก `.ed-page` + `[data-pos]` คลิกกระโดดได้)
  - **`text-case.js`** (alpha.60r2 · **ข้อ 2**, บริสุทธิ์ 100% — ไม่ import prosemirror เลย) —
    สลับรูปตัวพิมพ์: `CASE_MODES` 7 โหมด (`SC`/`lc`/`UC`/`CC`/`aC`/`TC`/`iC`) · `applyCase(text,mode)` ·
    `sentenceCase`/`capitalizeCase`/`titleCase`/`alternateCase`/`inverseCase` ·
    **`caseTransform(state, mode)`** สร้าง transaction จาก `state.tr`/`state.schema.text` ที่ส่งเข้ามา
    (แปลงจาก "ข้อความรวมทั้งช่วง" ก่อนแล้วตัดกลับตามช่วง → Sentence/Title case ข้ามรอยต่อของ mark ได้
    · ถ้าความยาวเปลี่ยน เช่น ß→SS ก็ถอยไปแปลงทีละช่วง) · แทนที่ทีละ text node **พร้อม marks เดิม**
    → ตัวหนา/เอียง/ลิงก์/mention ไม่หาย · **unit test 62 ข้อ** (ทดสอบด้วย state ปลอม)
  - **`margin-presets.js` + `margin-presets.json`** (alpha.60r2 · **ข้อ 6**, บริสุทธิ์) —
    ชุดระยะขอบสำเร็จรูป 8 ชุด · `marginPreset(key)`/`marginPresetOptions()`/`matchMarginPreset(m)`
    (คืน `''` = ผู้ใช้ตั้งเอง · ยอมคลาดเคลื่อนทศนิยม < 0.005) · **unit test 45 ข้อ**
    · ตารางค่าอยู่ใน `.json` — ผู้ใช้แก้เองได้ไม่ต้องแตะโค้ด
  - **`i18n-csv.js`** (alpha.60r3 · **ข้อ 4**, บริสุทธิ์ 100%) — ไฟล์ภาษา ↔ ตาราง CSV 3 คอลัมน์ `key,th,en`:
    `flatten`/`unflatten` (dot-path) · `csvCell` (quote ตาม RFC 4180) · `jsonToCsv` (**ใส่ BOM เสมอ** —
    Excel บน Windows อ่าน UTF-8 ไม่มี BOM เป็น ANSI แล้วไทยกลายเป็นขยะ) · `parseCsv` (state machine
    ตัวต่อตัว — regex ทำ `""` ข้างใน quoted field ไม่ได้ · รับ CRLF ของ Excel) · `csvToJson` ·
    **`mergeStrings` = รวมทับ ไม่ลบคีย์ที่ไม่มีในตาราง** (ผู้แปลส่งกลับมาแค่บางส่วนเสมอ) · **unit test 61 ข้อ**
  - **`ai-synopsis.js`** (alpha.60r3 · **ข้อ 2**) — ปุ่ม ✨ ให้ AI เติมคุณสมบัติฉาก:
    `AI_SCENE_FIELDS` 4 ช่อง (synopsis/pov/emotion/conflict) · `fieldPrompt()` **pure** (ต่อยอด
    `buildPrompt('summarize')` ของ ai-assistant.js) · `cleanResult()` เก็บกวาดคำตอบ ·
    **`attachAiFieldButton(row, input, field, ctx, onFilled)` = จุดเดียวที่ทั้งกล่องและแผงเรียก** (บทเรียน 50)
  - **`ai-analyzer-ui.js`** (alpha.60r3 · **ข้อ 5**) — แผง "🧠 AI วิเคราะห์" **ตัวอย่างหน้าตา**:
    `ANALYZER_CARDS` 5 ใบ + `analyzerStats()` (นับเล่ม/บท/ฉาก/คำ/เอนทิตี้จากดัชนีในเครื่อง ไม่ยิง AI)
    · มีป้าย "ยังไม่เปิดใช้งาน" กำกับ — **อย่าให้ mockup ดูเหมือนผลจริง**
  - **`markdown-code-toggle.js`** (alpha.60r3 · **ข้อ 6** · แก้ใน r3a) — ซ่อนรหัสนำหน้าบรรทัดในตัวแก้ไขนิยาย:
    `MD_PREFIXES` = re-export ของ `SP_MD_PREFIXES` (**เรียงยาวก่อนสั้น** — `>` จะกิน `>> ` ถ้าเรียงผิด) ·
    `prefixLen`/`suffixLen` **pure** · `markdownCodePlugin(decoState)` รับ `incrementalDecoState`
    ของ editor.js เข้ามา · ซ่อนด้วย `.k-md-hide-prefix{display:none}` — **ไฟล์ .md ไม่ถูกแก้เลย**
  - **`wiki-images.js`** (alpha.60r2 · **ข้อ 12**, บริสุทธิ์) — เมทาดาทาของรูปใน entity:
    `entity.images[]` จาก `string[]` → `{file,caption,alt,title,width,height}[]` ·
    `migrateImages`/`needsImageMigration`/`normalizeImage` (รับ `name`/`url` ของโค้ดเก่าด้วย) ·
    `imageFile`/`imageFiles`/`imageLabel`/`imageAlt` · `setImageMeta`/`makePrimary`/`removeImage`/`addImage`
    (ทุกตัวคืนอาร์เรย์ใหม่ ไม่แก้ของเดิม) · **เข้ากันได้ย้อนหลัง 100%** · **unit test 43 ข้อ**
  - **`scene-meta.js`** (alpha.60r2 · **ข้อ 13**) — **แหล่งความจริงเดียวของคุณสมบัติฉาก**:
    `SCENE_HEAVY_KEYS` (synopsis·pov·emotion·conflict·note·futureNote·tags·storyDate·isFlashback·isFlashforward)
    → เก็บใน **frontmatter ของ .md** · `SCENE_INDEX_KEYS` → `scenes.json` เป็นแค่ดัชนี/แคช ·
    `readSceneMeta(file,row)` (**frontmatter ชนะ row เสมอ** · ค่าว่างใน frontmatter ไม่กลบ row) ·
    `writeSceneMeta(file,props)` · `applySceneMetaToFrontmatter` (**ลบคีย์ที่ค่าว่าง/เท็จ** — บทเรียน 26) ·
    `asBool`/`asList`/`coerceSceneMeta`/`mergeSceneMeta`/`stripHeavyFromRow` · **unit test 56 ข้อ**
    · ฝั่ง app.js: `syncSceneMetaFromFiles(dPath)` = เมนู เครื่องมือ → 🔄 ซิงก์คุณสมบัติฉากจากไฟล์ .md
  - **`pdf-generator.js`** (alpha.59, **ข้อ 69/87/89** · ใช้ pdf-lib + @pdf-lib/fontkit) —
    เขียน PDF เองแทนที่จะพึ่ง `printToPDF` ของ Chromium (สองทางอยู่ร่วมกัน):
    `generatePdf({blocks,fmt,titlePages,headers,fonts,meta,opts})` → `{bytes,pageCount,titleCount,scriptPages,bookmarks}` ·
    `PDF_DEFAULTS`/`mergePdfOptions`/`OMITTABLE_ELEMENTS` · `addOutline` (**[87]** ประกอบ `/Outlines` เอง —
    pdf-lib 1.x ไม่มี API ระดับสูง · `PDFHexString.fromText` ให้ชื่อฉากไทยเป็น UTF-16) ·
    `setOpenPage` (**[89]** `/OpenAction`) · `wrapTextLines` (**มิเรอร์ `wrapLines()` เป๊ะทุกกรณี**) ·
    `layoutPageLines` · `embedFonts` · `needsLatinFont`/`splitFontRuns` · **unit test 87 ข้อ**
    · **`useObjectStreams:false`** — ค่าเริ่มต้นของ pdf-lib ยัด dict ลง object stream ที่บีบอัด
      ทำให้โปรแกรมอ่าน PDF รุ่นเก่าหา `/Outlines` `/OpenAction` ไม่เจอ
    · **`PDF_FONT_FILES` = สองวงศ์** `main` (CourierThaiMono — มีไทย) + `latin` (CourierPrime) ดูบทเรียน 63
  - **`sp-title-pages.js`** (alpha.59, บริสุทธิ์ · **ข้อ 90**) — หน้าปกหลายหน้า:
    `TitlePageEditor` (addPage/deletePage/movePage/addString/updateString/deleteString/moveString/filled/toJSON) ·
    `normalizeTitlePages`/`newTitleString`/`newTitlePage` · `defaultTitlePages(meta,fmt)` (สร้างจากข้อมูลผลงาน) ·
    `titlePageInnerHtml`/`titlePagesHtml`/`titlePagesCss`/`titlePagesText`/`cssFamily` · **unit test 62 ข้อ**
    · **x/y เป็น "นิ้วจากขอบกระดาษ"** (Trelby ใช้ point — K2 วัดเป็นนิ้วทั้งระบบ ห้ามปนหน่วย)
    · เก็บที่ `project.khn.json → titlePages` (ระดับโปรเจกต์ ไม่ใช่รายเล่มแบบ roster.json)
  - **`sp-headers.js`** (alpha.59, บริสุทธิ์ · **ข้อ 91**) — หัวกระดาษซ้ำทุกหน้า:
    `HEADER_DEFAULTS`(ปิดไว้)/`HEADER_VARS`/`mergeHeaders`/`newHeaderString` ·
    `resolveHeaderVars` (`${PAGE}`/`${หน้า}` · ตัวแปรที่ไม่รู้จัก → ว่าง ไม่ทิ้ง `${…}` บนกระดาษ) ·
    `headerStringsFor(index,hdr,ctx)` · `headerLineCount` · **`linesForBody(fmt,hdr)`** ·
    `headerHtml`/`headerCss`/`headerPlainLine` · **unit test 48 ข้อ**
    · **หัวกระดาษกินบรรทัดจริง** → ต้องส่ง `lines: linesForBody(...)` เข้า `paginate()` ไม่งั้นหน้าไม่ตรง
  - **`pdf-ui.js`** (alpha.59) — UI ของชุด PDF: `openTitlePageDialog()` (3 คอลัมน์) ·
    `openHeaderDialog()` · `pdfExportDialog()` · **`buildScriptPdf()` = จุดเดียวที่ทุกทางเรียก** ·
    `writeCompiledPdf()` (เวิร์กโฟลว์ ext=`pdf`) · `pdfFontBytes()` (แคช · โหลดสองวงศ์) ·
    `currentScriptPage()` · `projectTitlePages`/`saveTitlePages`/`projectHeaders`/`saveHeaders`
  - **`smart-terms.js`** (alpha.58, บริสุทธิ์ · **บั๊ก SmartType**) — "จำคำไหนดี":
    `looksLikeTerm` (ตัวกรองระดับตัวอักษร) · `countTerms` · **`learnedTerms(counts,{min,pinned,ignored,known})`** ·
    `pendingTerms` · `learnMin` (1–5 · ค่าเริ่มต้น 2) · **unit test 55 ข้อ**
    · **หลักคิด**: ตัวกรองตัวอักษรจับคำพิมพ์สลับตัว ("พมิมพ์") ไม่ได้ตลอดกาล → ใช้ "ต้องเจอซ้ำ" เป็นด่านหลัก
  - **`sp-format-guide.js`** (alpha.57 · **ข้อ 61 + 57**) — PM plugin 2 ตัวใน SPEditor:
    `spFormatGuidePlugin()` (เส้นขอบ element + `¶`/`·` ท้ายบล็อก · `setFormatGuide(on,fmt)`) ·
    `spPageBreakPlugin()` (เส้นคั่นหน้า · **`setPageBreaks(list)` คืน `true` เมื่อเปลี่ยนจริง** → app.js dispatch เฉพาะตอนเปลี่ยน)
  - **`export-fdx.js` / `export-rtf.js` / `export-watermark.js`** (alpha.57, บริสุทธิ์ · **ข้อ 67/68/70**) —
    `generateFdx(blocks,meta)` (FDX_TYPE_MAP · TitlePage) · `generateRtf(blocks,meta,fmt)` (**ไทย → `\uNNNN?`** · twips · `paraCtrl`) ·
    `buildWatermarkHtml(pages,fmt,opts)`+`generateWatermarkedPDFs(api,args)`+`parseRecipients` · **unit test 72 ข้อ**
  - **`typewriter-sound.js`** (alpha.57a, ข้อ 1) — เสียงเครื่องพิมพ์ดีดสังเคราะห์ด้วย WebAudio (ไม่มีไฟล์เสียง):
    `playType('key'|'space'|'back'|'return')` · `soundKindFor(ev)` (คีย์ลัด/ลูกศร = null) · `isEditorTarget(ev)` ·
    `setTypeSound/setTypeVolume` · จำกัดไม่เล่นถี่กว่า 25ms (กดค้างแล้วไม่เป็นเสียงพรืด)
  - **`lang-fonts.js`** (alpha.57a, ข้อ 5, บริสุทธิ์) — "ภาษาไหนใช้ฟอนต์อะไร": `SCRIPT_PRESETS` 11 ภาษา ·
    `buildLangFontCss(rows, resolveUrl)` สร้าง `@font-face` **ชื่อวงศ์เดียวกันหลายก้อน ต่างที่ `unicode-range`**
    (`LANG_FAMILY = 'K2 Lang'`) → เบราว์เซอร์เลือกฟอนต์ให้เองทีละตัวอักษร · `withLangFamily(stack, has)`
    เอาวงศ์รวมไปนำหน้า `--ed-font`/`--sp-font` · `normalizeRange`/`cssFamilyName` กันสตริงหลุดไปเขียนกฎ CSS อื่น ·
    ฝั่ง app.js: `preloadLangFontUrls()` (kapi เป็น async แต่ CSS ต้องการ URL แบบ sync) → `applyProjectLangFonts()`
    · **unit test 39 ข้อ**
  - **`gallery/` (alpha.63 — คลังรูปแบบอัลบั้ม · ยกเครื่องทั้งระบบ)**
    · **`gallery/album-core.js`** — โครงอัลบั้ม + CRUD (ส่วนบริสุทธิ์ + ชั้นไฟล์ที่ **รับ `api` เข้ามา**
      → unit test รันด้วย node ได้ตรง ๆ ด้วย kapi ปลอมบน fs จริง):
      `ROOT_ALBUM='_uncategorized'`/`ALL_ALBUM='__all__'` · `sanitizeAlbumName`/`albumId`/`albumRel` ·
      `normalizeAlbums`/`albumTree`/`childrenOf`/`descendantIds`/`renameAlbumIn`/`moveAlbumIn`/`removeAlbumIn` ·
      `normalizeAlbumDoc`/`syncAlbumDoc`/`albumEntries`/`setImageMeta`/`reorderImages` ·
      `flatIndexFrom` (สร้าง `images.json` ให้ v1) · `sortImages`/`searchImages`/`galleryStats`/`formatBytes` ·
      ชั้นไฟล์: `listAlbums` (รับโฟลเดอร์ที่ผู้ใช้สร้างเองในดิสก์ด้วย) · `createAlbum`/`renameAlbum`/`moveAlbum`/`deleteAlbum` ·
      `getAlbumImages`/`allImages`/`addImageFile`/`moveImage`/`deleteImage`/`updateImage`/`findImagePath` ·
      `migrateFromFlat`/`syncFlatIndex`
      · **⚠ `_uncategorized` ชี้ไปที่ `Images/` เอง ไม่ใช่โฟลเดอร์จริง — ห้ามเปลี่ยนโดยไม่อ่านบทเรียน 91**
    · **`gallery/album-tags.js`** — `TAG_KINDS` (`#`ทั่วไป `@`เอนทิตี้ `~`ฉาก) · `normalizeTag`/`parseTags` ·
      `addTag/removeTag/setTags/addTagMany/renameTagIn` · `getAllTags`/`filterByTags`(AND/OR) ·
      `imagesForEntity` (หน้า Wiki ใช้) · `suggestTags`
    · **`gallery/usage-index.js`** — `extractImageRefs` (md + `<img>` · ข้าม http/data) ·
      `buildUsageIndex` (**คีย์ด้วย basename** — แต่ละฉากอ้างรูปด้วยจำนวนชั้น `../` ไม่เท่ากัน) ·
      `usageCount`/`usageOf`/`usageLabel`/`attachUsage`/`filterByUsage` ·
      **`rewriteImageRefs`/`applyRefRewrite`** (ย้ายรูปแล้วแก้ลิงก์ในไฟล์ .md ตาม — คงจำนวนชั้น `../` เดิม) ·
      `scanUsage(api, root)`
    · **`gallery/moodboard.js`** — `newBoardItem`/`addToBoard`/`addManyToBoard`/`updateBoardItem`/`removeFromBoard` ·
      `boardOrder`/`boardItemAt`/`boardBounds`/`fitScale`/`fitView`/**`zoomAt`**(ยึดจุดใต้เมาส์)/`toBoard`/`toScreen`/`snap`/`tidyBoard`
    · **`gallery/image-hash.js`** — average hash 64 บิต: `aHash(pixels)` (รับ RGBA 8×8 จาก canvas · โปร่งใสนับเป็นขาว) ·
      `hamming`/`similarity`/`similarImages`/`findDuplicates`/`avgColor` — **"หารูปคล้าย" ไม่ต้องใช้ AI ไม่ต้องต่อเน็ต**
    · `gallery/gallery-export.js` (zip อัลบั้ม/ที่เลือก/ที่ใช้จริง + กระดานเป็น .png) ·
      `gallery/gallery-ai.js` (`aiCaptionImages`/`aiTagImages` — ลอง vision ก่อน ตกไปใช้บริบทจริง · `cleanCaption`/`parseTagAnswer`)
    · **`gallery/moodboard-ui.js`** (alpha.63r) — แผง `gallery-board`: `MoodBoard` · `renderMoodBoardPanel` ·
      `dropOnBoard` · `itemPath` (รองรับชิ้นข้ามอัลบั้ม) — **ต้องแยกจากคลังรูปเพราะ drag-and-drop ข้ามแท็บไม่ได้**
    · **`gallery/gallery-bus.js`** — อัลบั้มที่คลังรูปกับกระดานใช้ร่วม (`currentAlbum`/`setCurrentAlbum`/`onAlbumChange`/`onBoardChange`)
    · `gallery.js` = **ตัววาดอย่างเดียว** · ตัวเชื่อมส่งเข้ามาเป็น callback (`onInsert`/`onOpenFile`/`onOpenEntity`/`entityNames`)
      → ไม่ import app.js กลับ · **unit test `test/album.test.cjs` 199 ข้อ**
  - `maps.js` — **เอนจินแผนที่** (บริสุทธิ์): `newMap/newPin`, `breadcrumb` (ลำดับชั้น world→city→room ตาม portal), `rootMaps`, `pinStats`, `deleteMap` (ล้าง portal ค้าง), `PIN_COLORS/PIN_KIND`
- **build**: `node build.js` (esbuild bundle src/app.js) — dict แยกไฟล์ไม่ฝัง bundle

โครงโปรเจกต์: `<root>/{project.khn.json, <Section>/{section.json (มี title/order/status/cover/blurb), Draft/<name>/{draft.json, scenes.json, Chapters/<folder>/*.md}}, Wiki|Bible/{characters,locations,items,lore,<หมวดเอง>}/*.json, Images/{albums.json, album.json, images.json, <อัลบั้ม>/{album.json,*.png}}, Memos/, Snapshots/, Recycle/, timeline.json, maps.json, dictionary.json, Plugins/dictionaries/*.txt}`
- `project.khn.json` เก็บ settings + `compileWorkflows[]` (เวิร์กโฟลว์ผู้ใช้) + `wikiCats[{key,label,icon}]` (หมวด Wiki สร้างเอง)
- `scenes.json` แต่ละ scene row มี `storyDate` (เวลาในเรื่อง สำหรับเส้นเวลา) เพิ่มจากเดิม

---

## E2E test workflow (สำคัญ — ทำทุกครั้งก่อนเชื่อว่าแก้สำเร็จ)

Selftest ใน `app.js` (`check(name, cond, extra)` เขียน PASS/FAIL แล้ว throw ตอน fail). ปัจจุบัน **2,028 checks** (alpha.64) target `ALL OK`. เพิ่มฟีเจอร์ = เพิ่ม check เสมอ (ห้ามลด). โมดูลบริสุทธิ์ (compile/timeline/maps/search-engine/panels/split) มี unit test แยกรันด้วย node ก่อน แล้วค่อยเทส UI ใน e2e

**Unit test โมดูลบริสุทธิ์ (alpha.39, รันเร็ว ไม่ต้องเปิด electron):**
```bash
node test/search-engine.test.cjs   # 22 checks — tokenize/AND/OR/NOT/field/snippet/score/perf
node test/panel.test.cjs           # 26 checks — snap/dock/tab/resize/store/migrate
node test/split.test.cjs           # 16 checks — split/resize(snap50)/collapse/store
node test/branch.test.cjs          # 53 checks — graph/layout/cycles/unreachable/dangling/paths + [ข้อความ]ทางเลือก
node test/timeline.test.cjs        # 34 checks — extractNum/sort/merge(whenEnd+refs)/gantt/normalizeRefs
node test/relationship.test.cjs    # 28 checks — REL_TYPES/สี/ไอคอนมีจริง/categorizeRole/categorizeWith
node test/sp-continued.test.cjs    # 45 checks — CONTINUED/MORE/cont'd + side + compile (alpha.58)
node test/sp-reports.test.cjs      # 54 checks — parseHeading/สถานที่/ตัวละคร/กราฟ (alpha.58)
node test/smart-terms.test.cjs     # 55 checks — looksLikeTerm/เกณฑ์เจอซ้ำ/pin/ignore (alpha.58)
node test/prose-format.test.cjs    # 85 checks — รูปแบบ + จัดหน้านิยาย (alpha.58r)
node test/alpha58r.test.cjs        # 57 checks — lineHeight/spCss/pin/preset/mdToHtml/align/hr+code
node test/sp-headers.test.cjs      # 55 checks — หัวกระดาษ/ตัวแปร/linesForBody (alpha.59 · 91)
node test/sp-title-pages.test.cjs  # 62 checks — TitlePageEditor/หน้าปกมาตรฐาน/HTML (alpha.59 · 90)
node test/pdf-generator.test.cjs   # 103 checks — สร้าง PDF จริง/Outlines/OpenAction/ฟอนต์ (alpha.59 · 69/87/89)
node test/compile-omit.test.cjs    # 32 checks — ตัด element ตอนส่งออก (alpha.59 · 88)
node test/sp-export.test.cjs       # 101 checks — FDX/RTF/ลายน้ำ + หน้าปก/เลขฉาก/fontPt (alpha.60r1)
node test/text-case.test.cjs       # 62 checks — 7 โหมด/ไทยไม่ถูกแตะ/caseTransform+marks (alpha.60r2 · 2)
node test/wiki-images.test.cjs     # 43 checks — migrate string→object/caption/alt/ลำดับรูป (alpha.60r2 · 12)
node test/scene-meta.test.cjs      # 56 checks — frontmatter ชนะ index/bool จากสตริง/ลบคีย์ว่าง (alpha.60r2 · 13)
node test/margin-presets.test.cjs  # 45 checks — 8 ชุด/จับคู่กลับ/ค่าที่ผู้ใช้ตั้งเอง (alpha.60r2 · 6)
node test/i18n-csv.test.cjs      # 61 checks — flatten/CSV quote+BOM/round-trip ไฟล์ภาษาจริง (alpha.60r3 · 4)
node test/album.test.cjs           # 215 checks — อัลบั้ม/CRUD บนดิสก์จริง/แท็ก/ดัชนีการใช้งาน/กระดาน/แฮชรูป (alpha.63) + sidecar กู้คืน (alpha.64)
node test/ai-providers.test.cjs    # 111 checks — provider/param/โดเมน/ความลับ/models/chat + session/สถิติ/ค้นหา/เริ่มใหม่ (alpha.61–62)
node test/network-layout.test.cjs  # 18 checks  — ตำแหน่งโหนดแยกตามโปรเจกต์/ชื่อซ้ำข้ามหมวด/ผังไม่แข็งถาวร (alpha.64)
node test/ai-tools.test.cjs        # 64 checks  — แกะคำสั่ง k2/สิทธิ์ตามโหมด/describeCall/วงจรหัวข้อเซสชัน (alpha.64)
```
`npm run test:unit` รันชุดบริสุทธิ์ทั้งหมดรวดเดียว (**1,709 บรรทัด PASS · 26 ไฟล์** + fountain 84)
· **ตรวจ PDF ที่สร้างขึ้นในเทส**: pdf-lib **บีบอัด content stream (FlateDecode)** และเขียนข้อความเป็น
**hex string** (`<48656C…> Tj`) ทั้งฟอนต์มาตรฐานและฟอนต์ที่ฝัง → ค้นข้อความจากไบต์ดิบไม่เจอเลย
ต้อง `zlib.inflateSync` ก่อน **แล้วถอด hex** (ดู `streamsText`/`drawnText` ใน `pdf-generator.test.cjs`)
· และต้อง **กรองเอาแค่ content stream** (`printable > 0.95` + มี `BT`/`ET`) เพราะไบนารีฟอนต์ที่ฝังไว้
ก็ถูกบีบอัดเหมือนกัน และมีไบต์ที่อ่านเป็น `Tj` ได้โดยบังเอิญ → นับคำสั่งวาดเพี้ยนทุกครั้ง

**รัน e2e บน macOS** (ไม่ต้องมี xvfb · หน้าต่างเด้งขึ้นมาจริง ~4 นาที):
```bash
ps aux | grep -i electron | grep -v grep | awk '{print $2}' | xargs -r kill -9   # ฆ่า zombie ก่อนเสมอ
node build.js && rm -f /tmp/k2result.txt && rm -rf /tmp/k2proj
node test/fixture.js /tmp/k2proj
KILLIAN_TEST=1 KILLIAN_TEST_PROJECT=/tmp/k2proj ./node_modules/.bin/electron . >/tmp/k2elec.log 2>&1 &
until tail -1 /tmp/k2result.txt 2>/dev/null | grep -qE "ALL OK|^STOP"; do sleep 5; done
grep -c PASS /tmp/k2result.txt; grep -E "^FAIL|^STOP" /tmp/k2result.txt | head -3
```
**รัน e2e จาก `.app` ที่ build แล้วด้วย** (verify ตัวที่จะส่งจริง — ทำก่อน ship ทุกครั้ง):
```bash
KILLIAN_TEST=1 KILLIAN_TEST_PROJECT=/tmp/k2proj2 \
  "dist/mac/Killian 2.app/Contents/MacOS/Killian 2" >/tmp/k2app.log 2>&1 &
```

**รัน e2e บน Windows ได้ด้วย** (ไม่ต้องมี xvfb — มี electron ใน node_modules อยู่แล้ว):
```powershell
Get-Process electron -EA SilentlyContinue | Stop-Process -Force      # ฆ่า zombie ก่อนเสมอ
New-Item -ItemType Directory -Force C:\tmp | Out-Null                # ผลลัพธ์ /tmp/k2result.txt → C:\tmp\
$p="$env:TEMP\k2proj"; Remove-Item -Recurse -Force $p -EA SilentlyContinue; node test/fixture.js $p
Remove-Item -Force C:\tmp\k2result.txt -EA SilentlyContinue
$env:KILLIAN_TEST="1"; $env:KILLIAN_TEST_PROJECT=$p
& .\node_modules\.bin\electron.cmd . --no-sandbox --disable-gpu *> C:\tmp\k2elec.log
```
**ต้องสร้าง fixture ใหม่ทุกครั้ง** — เทสรูป ("รูป render จริง") พังถ้าใช้โปรเจกต์ที่รันไปแล้วซ้ำ (เทสคลังรูปย้ายไฟล์)
หน้าต่างไม่ปิดเองหลังจบ → รอจน `tail -1 C:\tmp\k2result.txt` = `ALL OK` แล้วค่อยฆ่า process

**รัน e2e จาก build ที่แพ็กแล้ว** (verify ตัวที่จะส่งจริง — ทำก่อน ship ทุกครั้ง):
```powershell
Get-Process "Killian 2" -EA SilentlyContinue | Stop-Process -Force
$p="$env:TEMP\k2proj2"; Remove-Item -Recurse -Force $p -EA SilentlyContinue; node test/fixture.js $p
Remove-Item -Force C:\tmp\k2result.txt -EA SilentlyContinue
$env:KILLIAN_TEST="1"; $env:KILLIAN_TEST_PROJECT=$p
Start-Process -FilePath ".\dist\win-unpacked\Killian 2.exe" -ArgumentList "--no-sandbox","--disable-gpu" `
  -RedirectStandardOutput C:\tmp\k2app.log -RedirectStandardError C:\tmp\k2app.err
```
> ⚠ **ห้ามใช้ `& ".\…\Killian 2.exe" *> log` ใน task ที่รันเบื้องหลัง** — ดูบทเรียน 86
> (stdout ถูกปิดตอน launcher คืนค่า → main process ตายด้วย EPIPE แล้วค้างที่กล่อง "Error")
> วิธีดูว่าค้างเพราะกล่อง native: `Get-Process | ? MainWindowTitle` — เห็น title = `Error`
> อ่านข้อความในกล่องด้วย UIAutomation (`FindAll` ControlType::Text ตาม ProcessId)
เทคนิค: ไฟล์ src เป็น ES module แต่ root ไม่ใช่ `type:module` → test เป็น `.cjs` ที่ `esbuild.buildSync({format:'cjs'})` แปลงชั่วคราวแล้ว `require`. โมดูลบริสุทธิ์ (ไม่ import DOM/kapi) จึงเทสได้ตรง ๆ — เพิ่ม unit test ทุกครั้งที่เพิ่ม logic ในไฟล์เหล่านี้

```bash
# 1. KILL ZOMBIE ก่อนทุกครั้ง (pkill ใช้ไม่ได้ — ดูบทเรียน)
ps aux | grep -iE "electron|xvfb" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null; sleep 1
cd /home/claude/work/v2_extract/Killian2
node build.js 2>&1 | tail -1                              # ต้องเห็น "bundle OK"
rm -f /tmp/k2result.txt
node test/fixture.js /tmp/k2proj >/dev/null 2>&1         # สร้างโปรเจกต์ทดสอบ (เทสฮาร์ดโค้ด path นี้)
export KILLIAN_TEST=1 KILLIAN_TEST_PROJECT=/tmp/k2proj
setsid bash -c 'cd /home/claude/work/v2_extract/Killian2 && xvfb-run -a --server-args="-screen 0 1500x950x24" ./node_modules/.bin/electron . --no-sandbox --disable-gpu >/tmp/k2elec.log 2>&1' </dev/null >/dev/null 2>&1 &
sleep 52                                                  # dict โหลด + spell + เทสเยอะขึ้น ~50s
grep -c PASS /tmp/k2result.txt; tail -1 /tmp/k2result.txt # ต้องลงท้าย "ALL OK"
grep -E "FAIL|STOP" /tmp/k2result.txt | head -3
```

- `kapi.testShot('/tmp/x.png')` = สกรีนช็อต · **view tool คืน [image] อ่านไม่ได้** → PIL pixel-check crop แทน
- ผลสตรีมทีละบรรทัด — **อย่าอ่านก่อนจบ** (รอ ALL OK / sleep ครบ)
- เพิ่มเทสในบล็อกที่ tab นั้น active สดๆ อยู่แล้ว (ดูบทเรียน matchesNode)

---

## บทเรียน env/บั๊ก (เจ็บมาแล้ว — อย่าซ้ำ)

1. **ZOMBIE ELECTRON** (เผา ~15 call): `pkill -9 -f electron` **ไม่ฆ่า** electron ใต้ setsid+xvfb-run (หลุด process tree) — zombie ถือ `/tmp/k2result.txt` เก่า **และ** ล็อก esbuild ไม่ให้เขียน bundle.js ทับ → อ่านผลเก่าซ้ำทั้งที่ build OK. **แก้: kill ด้วย pid จริงทุกครั้ง** ยืนยัน ps เหลือ 0. นาฬิกาแซนด์บ็อกซ์เพี้ยน — ตัดสิน stale จาก **เนื้อหา** ไม่ใช่ mtime
2. **ProseMirror "reading 'matchesNode'"**: เทสที่ `activate(t.file)+setMarkdown()+refreshMentions/Spell()` บน tab ท้าย run → view/DOM ไม่ sync. **แก้: วางเทส decoration ในบล็อกที่ tab นั้น active สดๆ พร้อมเนื้อหา**
3. **`window.prompt()` = no-op ใน Electron** → modal ใน `ui.js`
4. **e2e ไม่ idempotent เพราะ localStorage คงค้างข้าม run** (`k2-ui-layout`) → ต้น UI test: ผนึกแผงลอย + `localStorage.removeItem('k2-ui-layout')`
5. **`parseInt("0px")||999`** = 999 (0 falsy!) — snap พังตอน left=0. ใช้ `const lx=parseInt(...); if(lx<70)` (NaN<70=false ปลอดภัย)
6. **fixed element `offsetParent`=null** → makeDraggable ต้อง `op ? op.getBoundingClientRect() : {left:0,top:0,width:innerWidth,height:innerHeight}`
7. **`insertBefore(node, ref)` throw** ถ้า ref หลุด parent (แผงข้างลอย) → `ref=(home.next&&home.next.parentNode===home.parent)?home.next:null`
8. **`grep -c` exit 1 เมื่อ 0 match** → พัง `&&` chain
9. **zip stale**: `[ -f zip ]||zip` ข้าม rebuild → **`rm -f <zip> && zip` เสมอ** + verify version ในซิปก่อน copy
10. **`.k-ok` ชนกัน dialog vs wiki-save** → scope `.k-dialog .k-ok`
11. **str_replace กลืนบรรทัดหัวฟังก์ชันถัดไป**: เมื่อ old_str จบตรง `function toggleFocus(on) {` (หรือ `const pngSig=...`) แล้วลืมใส่กลับใน new_str → esbuild `Unexpected "}"` / `X is not defined`. **หลัง build fail ทุกครั้งดู error บรรทัดไหน แล้วเช็คว่ากลืนหัวฟังก์ชัน/ประกาศตัวแปรไปไหม**
12. **เพิ่ม field ในกล่อง = e2e ที่อ้าง input by index พัง**: เพิ่มช่อง storyDate ระหว่าง synopsis↔pov ทำให้ `inps[1]` (เดิม=อารมณ์) กลายเป็น pov → เทส sceneProps fail. **แก้: อัปเดต index ในเทสให้ตรง (มี comment [0]storyDate [1]pov...)**
13. **e2e ที่พึ่งค่าฮาร์ดโค้ด (สี/ขนาด) พังเมื่อเปลี่ยน design token**: เปลี่ยนกระดาษขาว→ครีมทำให้ assert `rgb(255,255,255)` fail; ลดฟอนต์ฐานทำให้ assert `21px`/`19.5px` fail. **หาเทสที่ hard-code ค่าเดิมแล้วอัปเดตพร้อมกัน** (`.toFixed(2)` ทิ้ง trailing zero: ใช้ `+(x).toFixed(2)` ไม่งั้น "19.50px"≠"19.5px")
14b. **โมดูลใหม่ที่ import แล้วไม่มีจุดเรียก = ผู้ใช้เข้าไม่ถึงเลย** (เจอ 13 ตัวรวดในรอบ deepseek)
   เช็คเร็ว: ชื่อฟังก์ชันต้องปรากฏใน app.js **>1 ครั้ง** (ถ้า =1 คือมีแต่บรรทัด import)
   ต้องมี: เมนูใน main.js (`send('ch')`) + `case 'ch'` ใน `handleCommand` หรือคีย์ลัดในตาราง `SHORTCUTS`
14h. **listener หลายตัวบน Esc เดียวกัน = ออกหลายโหมดพร้อมกัน** — โฟกัสถอดคลาสก่อน แล้วตัวจับของโหมดอ่าน
   เช็ค `classList.contains('focus-mode')` ได้ false ตามไปด้วย → กด Esc ครั้งเดียวหลุดทั้งคู่
   **แก้: ปักธงบน "อีเวนต์" (`e._k2EscUsed = true`) ไม่ใช่ดูสถานะ DOM** (ลำดับ listener ขึ้นกับใครลงทะเบียนก่อน)
14i. **เทสที่วัด `opacity`/`transform` ต้องรอ transition จบ** — `.15s` แต่รอ 60ms ได้ค่ากลางทาง (0.52 แทน 0.3)
   → รอ ≥ 2× ของ transition ก่อน assert
14i-2. **รอเฉย ๆ ไม่พอ ถ้าหน้าต่างเทสไม่ถูกวาด** (ไม่ได้อยู่หน้าสุด/ถูกบัง): Chromium หยุด animation frame
   → transition **ค้างที่ค่าเริ่มต้น** และ `getComputedStyle` คืนค่าที่กำลังวิ่ง = ค่าเดิม (opacity ได้ 1 ทั้งที่กฎ CSS ถูกทุกอย่าง:
   `matches=true` · rule อยู่ใน styleSheets · `--fm2-dim` resolve เป็น 0.3 · ไม่มี inline style) — **เผา 4 รอบ e2e กว่าจะรู้**
   **แก้: สั่งจบ animation เองก่อนวัด** `el.getAnimations?.().forEach(a => a.finish())` แล้วค่อย `getComputedStyle`
14c. **`selection.anchorNode` เป็น Text node → ไม่มี `.closest()`** · `anchorNode.closest?.()` คืน undefined เงียบ ๆ
   ใช้ `cursorBlock()` ใน focus-mode.js (อิง `view.domAtPos` ของ ProseMirror ก่อน แล้ว fallback DOM selection)
   — สำคัญกับ e2e ด้วย เพราะหน้าต่างเทสไม่มี DOM focus จริง
14d. **ไบนารีห้ามผ่าน readFile/writeFile** (main เขียน utf-8 → ไบต์ ≥0x80 บวม ไฟล์เสีย) ใช้ `readBytes/writeBytes/copyFile`
14e. **`kapi.*` ทุกตัวเป็น async (IPC)** — เรียกแบบ sync จะได้ Promise ไปโชว์บนจอ (`[object Promise]`)
14f. **`test:shot` ห้าม throw** — capturePage ล้มได้เมื่อหน้าต่างถูกย่อ (UnknownVizError) จะทำ selftest ตายทั้งชุดทั้งที่โค้ดไม่ผิด
14g. **เทสซูมต้องวัดจาก `getComputedStyle(el).maxWidth`** ไม่ใช่ความกว้างจริง — บนจอแคบ pane จะ clamp ทำให้ fail ปลอม
15. **Thai sort ทำ default map/section เลือกผิด**: `sortMaps` เรียงตามชื่อไทย → "เมือง"(เ) มาก่อน "โลก"(โ) → default currentId ผิด. **อย่าพึ่งชื่อ ใช้ `order` เป็นตัวเรียงหลัก** (Book Manager/Timeline/Maps ทุกตัวเก็บ order)
16. **กล่อง modal ที่เทสก่อนหน้าลืมปิด ทำให้ `testShot` ของเทสถัดไปได้ภาพผิด** (เผาไป 2 รอบ e2e)
   `document.querySelector('.k-dialog .k-ok').click()` กดกล่อง**ใบแรกใน DOM** ถ้ามีกล่องอื่นค้างอยู่ = กดผิดใบ
   → กล่องเดิมค้างทับหน้าจอยาวทั้ง run และสกรีนช็อตของเทสถัด ๆ ไปกลายเป็นภาพเก่า (ดูเหมือน capturePage พัง ทั้งที่ไม่ใช่)
   **แก้: ปิดใบล่าสุดเสมอ** `const ovs=[...document.querySelectorAll('.k-overlay')]; ovs[ovs.length-1].querySelector('.k-ok').click()`
   แล้วเก็บกวาด `.k-overlay` ที่เหลือทิ้ง · อาการ: assert ผ่านหมด (DOM ถูก) แต่ภาพไม่ตรง → **เชื่อ DOM ก่อน อย่าเพิ่งโทษ capturePage**
17. **view tool คืน [image] ว่างช่วงกลาง session** → PIL pixel-analysis แทน: color histogram (`Counter` สแกน crop) หา card-bg/accent-orange, หรือวัดความกว้างแถบสีกระดาษ (%ของจอ) เพื่อยืนยัน layout
18. **CSS 2 บล็อกความจำเพาะเท่ากัน = บล็อกล่างชนะ "เฉพาะ property ที่เขียนซ้ำ"** — `body.reading-mode` ทับ `background` แต่ไม่ทับ `color` ที่ยังมาจาก `body.paper-mode` → หมึกดำบนพื้นดำ. **โหมดที่ใช้ร่วมกันได้ ต้องมีกฎ combo (`body.a.b`) เสมอ** ไม่ใช่หวังว่าลำดับจะพอดี
19. **`style.display='none'` ทับ CSS = ค้างข้ามโหมด** — ซ่อน UI ให้ใช้ class ล้วน. เทสก็ต้องวัดด้วย `getComputedStyle` ไม่ใช่ `el.style.display`
20. **`.k-collapsed { max-height:0 }` กลืนหัวแผงไปด้วย** → ปุ่มคลี่กลับหายตาม = แผงเรียกคืนไม่ได้. **"พับ" ต้องซ่อนเฉพาะเนื้อ หัวอยู่เสมอ · "ย่อ" ต้องทิ้งปุ่มลอยไว้เรียกกลับ**
21. **async render ที่ `body.innerHTML=''` ตอนต้นแล้ว await ต่อ = รายการซ้ำเมื่อถูกเรียกซ้อน** (`setPropsTarget`+`openPropsPanel` ยิงติดกัน) → ใช้หมายเลขรอบ `const gen=++_gen; ... if(gen!==_gen) return;` หลัง await ทุกจุด
22. **อ่าน→แก้→เขียนทั้งไฟล์ (updateSceneRow) ยิงพร้อมกัน = ตัวหลังเขียนทับตัวแรก** เงียบ ๆ → ต่อคิวด้วย `q = q.then(run, run)` (ใส่ handler ทั้งสองช่องไม่งั้นคิวค้างเมื่อ error)
23. **z-index ที่ `++` ไปเรื่อย ๆ ไต่ขึ้นไปบังของที่ควรอยู่บนสุด** (หน้าต่างลอยบัง FAB/modal) → กำหนดเพดานแล้วเรียงใหม่เมื่อชน
24. **`setupFloatingFormatBar()` ย้ายปุ่ม toolbar ไปแถบลอย** → CSS/เทสที่ผูก `#toolbar .tb…` จะพลาดปุ่มที่ย้ายไปแล้ว ใช้ selector ที่ไม่ผูกคอนเทนเนอร์
26. **frontmatter ของ .md ไม่มีชนิดข้อมูล** — `parseMdFile` คืน **สตริงล้วน** (`isFlashback: true` → `"true"`)
   → อย่า assert `=== true` กับค่าจาก frontmatter · ค่า boolean ควรเขียนเฉพาะตอนจริง แล้ว `delete` ตอนเท็จ
   (ไม่งั้นได้บรรทัด `x: false` รกทุกไฟล์ · ระวัง `locked: undefined` ที่หลุดมาแบบนี้)
27. **ไอคอนย้ายจากอีโมจิ → ชื่อไอคอน SVG แล้ว** (`icons.js`) — meta เก่าที่เก็บอีโมจิไว้ (เช่น `wikiCats[].icon`)
   ทำให้ `iconHtml()` วาด **svg ว่าง** → ใช้ `hasIcon(name)` กรองก่อนเสมอ แล้ว fallback ไป `CAT_ICON`/`bookmark`
28. **dock ที่มีลูก `flex:0 0 auto` ปนกับลูกที่ยืดได้ → พื้นที่ว่างหายไปเฉย ๆ** (เผา 3 รอบ e2e)
   `removePanel` ของเอนจินตั้ง `sizes = evenSizes(n)` ให้ **ทุก dock** → `col[toolbar, row, statusbar]` ได้ `[.33,.33,.33]`
   toolbar/statusbar เป็น fixed จึงไม่ใช้ค่านี้ เหลือ row ตัวเดียวที่ `flex-grow:.33` = กินพื้นที่ว่างแค่ 1/3
   → หน้ากระดาษ/canvas เตี้ยผิดปกติ (Story Network ค้าง 300px) ทั้งที่ layout tree ถูกทุกอย่าง
   **แก้: normalize `flex-grow` ของลูกที่ยืดได้ให้รวมกัน = 1 ตอน render** (`growSum` ใน `renderDock`)
29. **re-render ทั้งต้นไม้ระหว่างลาก = ProseMirror ถูกถอด-ใส่ 60 ครั้ง/วินาที** → ลาก resize/float ต้องแก้ `style` สดบน DOM
   แล้ว commit ลง store ครั้งเดียวตอน mouseup · และ `renderPanels()` เทียบลายเซ็น JSON ของ layout ก่อนวาด (ข้ามถ้าไม่เปลี่ยน)
25. **ตั้งชื่อตัวแปรว่า `t` บัง `t()` ของ i18n** — `showSourceView` เคยพังตรงปุ่มคัดลอกเพราะ `t('status.copied')` กลายเป็นเรียก tab object
30. **`mergeComments()` ตัดช่องว่างท้ายไฟล์ทิ้งเสมอ** (`stripComments` มี `.replace(/\s+$/,'')`) — เอา `store.saveBody()`
   ไปแทน `kapi.writeFile` ใน `saveTab` ตรง ๆ = **ทุกไฟล์ในโปรเจกต์ถูกแก้ท้ายไฟล์ทุกครั้งที่บันทึก** แม้ไม่มีคอมเมนต์เลย
   (e2e ล้มที่ "กดซ้ำคืนสภาพไฟล์เดิม"). **แก้: `writeKeepingComments()` — ไม่มีคอมเมนต์ = เขียนตัวต่อตัวเหมือนเดิม**
   · สมอของ CommentStore นับ offset เทียบ **ทั้งไฟล์ (frontmatter รวมด้วย)** ไม่ใช่ `parseMdFile().body`
31. **`document.querySelector('.k-menu')` ไม่ได้คืนเมนูที่เพิ่งเปิด** — `#k-fab-menu` เป็น `.k-menu` ถาวรใน index.html
   และอยู่ก่อนใน document order → เทสเมนูป๊อปอัปผ่านทั้งที่เช็คผิดตัว. ใช้ `.k-menu:not(#k-fab-menu)` เสมอ

42. **RTF เป็นไฟล์ ANSI — ไทยต้องเป็น `\uNNNN?` ทุกตัว** (ค่า >32767 เขียนเป็นเลข**ติดลบ** · นอก BMP = surrogate 2 ตัว)
   ปล่อยไบต์ UTF-8 ดิบลงไป = Word เปิดได้แต่ตัวขยะทั้งไฟล์ · เทสยืนยันด้วย `[...rtf].every(c => c.codePointAt(0) < 128)`
43. **`parseScript()` สร้าง "บทพูดกำพร้า" ไม่ได้** — `classify()` ให้ `dialogue` เฉพาะเมื่อบรรทัดก่อนเป็น
   character/parenthetical/dialogue ข้อความหลังบรรยายจึงกลายเป็น action เสมอ
   → เทส [54] ต้องสร้างเคสนี้จาก **ตัวแก้ไข** (`gotoPos` + `setElement('dialogue')`) ไม่ใช่จาก markdown
44. **dispatch transaction ซ้ำ ๆ ตามจังหวะ debounce ไปกวนตำแหน่งเลื่อนของหน้ากระดาษ**
   `scheduleCount` (300ms) เคยสั่ง `refreshGuides()` ทุกครั้ง → decoration ถูกวาดใหม่ระหว่างเทสซูม
   ทำให้ `#5 ซูมยึดกึ่งกลาง` fail แบบสุ่ม (0.500 → 0.417) ทั้งที่โค้ดซูมไม่ผิด
   **แก้: `setPageBreaks()` คืน `true` เมื่อลายเซ็นเปลี่ยนจริง แล้วค่อย dispatch**
   (หลักทั่วไป: อย่า dispatch เมื่อผลลัพธ์เท่าเดิม — เหมือน `renderPanels()` ที่เทียบลายเซ็น JSON ก่อนวาด)
45. **โหมดมุมมองที่ "ไม่ใช่ตัวแก้ไข" อย่าไปรื้อ ProseMirror** — เรียงหน้าคู่/ภาพรวมวาด `.sp-pageview`
   เป็น overlay `position:absolute; inset:0` ทับ `.pane` แล้วซ่อน `.workspace` ด้วย CSS
   (คลาสเดียว ถอดออกแล้วทุกอย่างกลับสภาพเดิม · ไม่ต้องยุ่งกับ selection/undo/decoration เลย)

32. **`max-width:calc(100% - Xin)` บนหน้ากระดาษเพี้ยน 2px** — `* { box-sizing:border-box }` + เส้นขอบกระดาษ 1px×2
   ทำให้ 100% = ความกว้างเนื้อใน **ลบเส้นขอบไปแล้ว** → element ที่ควรกว้าง 3.8in ได้ 362.8px แทน 364.8px
   **แก้: หนีบความกว้างเป็น "นิ้ว" ตอนสร้าง CSS ใน JS** (`Math.min(width, textWidth - indent)`) ไม่ใช้ calc(%)
33. **`addAsTab` ตั้ง active = แท็บใหม่เสมอ** — ถ้ามีอะไรถูก dock แบบ `center` ลงบน **แผงเอกสาร (docs)**
   docs จะกลายเป็น `k-tabbed k-tab-hidden` → `#tabs`/`#panes` หายทั้งก้อน ดูเหมือนโปรแกรมพัง
   **แก้ 3 ชั้น**: `showPanel` แปลง center+docs → defaultSide · `detectSnapTarget` ข้ามโซนกลางของ docs ·
   `ensureDocsVisible()` ใน `renderPanels` บังคับ docs เป็นแท็บ active เสมอ (มีธงกัน re-entrant)
34. **e2e ต้องล้าง localStorage ทุกคีย์ที่จำเลย์เอาต์** — เพิ่ม `k2-panel-home` (alpha.56) เข้าไปด้วย
   ไม่งั้นรอบที่ตายกลางคันทิ้ง "ที่เดิมของแผง" ไว้ แล้วรอบถัดไปเปิดแผงกลับไปตำแหน่งแปลก ๆ = FAIL คนละที่ทุกครั้ง
   (ตอนนี้ `runTest` ล้าง `k2-ui-layout` `k2-panel-layout` `k2-panel-home` `k2-split-layout` `k2-home-view` + `resetPanels()`)
35. **ซูมยึดกึ่งกลาง** — เก็บ *สัดส่วน* ของจุดกึ่งกลาง (ไม่ใช่พิกเซล) ก่อนซูม แล้วคืนใน `requestAnimationFrame`
   เรียกซูมสองครั้งติดกันจะได้ค่ากลางทาง → เทสต้อง `await` ระหว่างการกดซูมแต่ละครั้ง

36. **วาดต้นไม้แผงใหม่ = ย้าย element ออก-เข้า DOM → `scrollTop/scrollLeft` ถูกล้างเป็น 0**
   ผู้ใช้เลื่อนหน้ากระดาษอยู่ พอขยับแผงทีเดียวก็เด้งกลับซ้ายบนทุกครั้ง
   **แก้: จำตำแหน่งเลื่อนของทุกกล่องที่เลื่อนได้ก่อนวาด แล้วคืนทั้งทันทีและใน `requestAnimationFrame` ถัดไป**
   (คืนทันทีอย่างเดียวไม่พอ — ตอนเพิ่งใส่กลับ `scrollHeight` ยังเป็น 0 การเซ็ตจึงไม่ติด)
37. **`-webkit-app-region:drag` คิดจาก "กรอบของ element" ไม่สน z-index** — แผงลอยที่ทับ `#titlebar`
   จะถูก OS กลืนเมาส์ไปทั้งหมด กดลากไม่ได้เลย → ต้องเจาะ `no-drag` ให้แผงลอย **และลูกทุกตัว** (`.k-float-panel *`)
38. **`mouseup` นอกหน้าต่าง/บนพื้นที่ drag ให้ `clientX/Y = 0`** → แผงเด้งไปมุมซ้ายบน
   **แก้: จำพิกัดล่าสุดที่ mousemove ให้ค่าจริง แล้วใช้แทนเมื่อ mouseup ได้ 0,0**
39. **แผงลอยหลุดจอ = เรียกกลับไม่ได้ถาวร** (ไม่มี UI ไหนชี้ไปหามันได้) → `clampFloat()` ต้องเรียก
   **ทุกครั้งที่ render** ไม่ใช่แค่ตอนลาก เพราะเลย์เอาต์ที่บันทึกไว้ตอนจอใหญ่จะนอกจอทันทีเมื่อย่อหน้าต่าง
40. **ซ่อนแผงทีละใบไม่พอสำหรับ "เต็มจอ"** — ยังเหลือ dock/กลุ่มแท็บที่กินพื้นที่เป็นกล่องเปล่า
   **ที่ชัวร์คือยกแผงเอกสารออกมา `position:fixed; inset:0`** แล้วไม่ต้องสนใจว่ามีอะไรอยู่ข้างหลัง
41. **ฟอนต์ฝังในแอป**: วางที่ `renderer/assets/fonts/` + `@font-face` ใน style.css (path สัมพัทธ์กับ css)
   electron-builder เก็บให้อยู่แล้วผ่าน `"renderer/**"` · เทสด้วย `await document.fonts.load(...)` แล้วค่อย `check()`

46. **หน้าต่างเป็น `frame:false` → เมนู native ไม่โผล่เอง** ต้องมี `<span class="tb-menu" data-m="X">` บน `#titlebar`
   คู่กับทุกเมนูใน `main.js` (renderer เรียก `kapi.menuPopup(data-m)`)
   alpha.57 สร้างเมนู **"บท"** (id `Script`) ครบทุกรายการ แต่**ลืมใส่ปุ่มบนแถบชื่อ** → ฟีเจอร์ 54/57/59/60/61/78
   ผู้ใช้กดไม่ได้เลยทั้งชุด (67/68/70 รอดเพราะไปโผล่ในเมนู "ไฟล์" ด้วย) — ตรงกับที่ผู้ใช้รายงานเป๊ะ
   **เช็คถาวรแล้ว**: e2e ยืนยันว่าทุก `.tb-menu[data-m]` อยู่ในรายชื่อเมนูที่ main.js สร้างจริง
   (ขยายจากบทเรียน 14b — "มีโค้ด+มี case ใน handleCommand" ยังไม่พอ ต้องมีทางกดด้วย)
47. **`letter-spacing` ทำสระ/วรรณยุกต์ไทย "ลอย"** — CSS เติมช่องไฟ **หลังทุก glyph** รวม combining mark
   ที่ความกว้างเป็น 0 → วรรณยุกต์ถูกดันไปทางขวาหลุดจากพยัญชนะ (ยิ่งค่ามาก ยิ่งชัด)
   `.sp-scene`/`.sp-transition` เคยมี `letter-spacing:.5px` → ผู้ใช้เข้าใจว่าไฟล์ฟอนต์เสีย
   **กฎ: ห้ามใส่ letter-spacing กับข้อความที่อาจเป็นไทย** (มีเทสคุมแล้ว)
   · วิธีตรวจว่าเป็นที่ฟอนต์จริงไหม: เขียน HTML ทดสอบแล้ว `capturePage` ด้วย electron สคริปต์เล็ก ๆ
     (`new BrowserWindow({show:false})` + `loadFile` + `capturePage().toPNG()`) แล้ว crop ดูด้วย PIL
48. **ฟอนต์ไทยยุคเก่า (ไม่มี GPOS/GSUB) shape ถูกอยู่แล้วใน Chromium** — HarfBuzz ทำ **Thai PUA shaping** ให้เอง
   (เลือกรูปเลื่อนลง/ซ้ายจากช่วง PUA `F700–F717` ตามมาตรฐาน Windows Thai)
   **อย่าไปเติม GSUB `ccmp` เอง** — จะซ้อนกับที่ HarfBuzz ทำอยู่แล้ว แล้ววรรณยุกต์จมทับสระ (ลองมาแล้ว เสียเวลาเปล่า)
   วิธีดูว่าฟอนต์รองรับ: `cmap` ต้องมี `F700–F717` และ mark ต้อง `advance = 0`
   **แต่ shape ถูก ≠ วางสวย**: ฟอนต์ที่ Top ส่งมา (1998) วางมาร์กห่างพยัญชนะ ~7% ของ em
   ขณะที่ Courier New/Leelawadee/Tahoma ห่าง ~3.5% → เห็นเป็น "ลอย" จริง
   **แก้ที่ถูกคือขยับ outline ของ glyph มาร์ก** (`tools/shiftmarks.py` · fonttools):
   สระบน+วรรณยุกต์+PUA `F701–F717` (ยกเว้น `F70F`) **ลง 74** · สระล่าง **ขึ้น 36** (em 2048)
   **ห้ามแตะ `F700`/`F70F`** — สองตัวนั้นคือ ฐ/ญ แบบตัดเชิง (advance เต็มตัว ไม่ใช่มาร์ก)
   กันพลาดด้วยเงื่อนไข "ขยับเฉพาะ glyph ที่ `advance = 0`"
48b. **วิธีวัดว่า "ลอย" จริงไหม อย่าใช้ตาเปล่า** — เรนเดอร์พยางค์ลง cell ขนาดคงที่แล้ว
   หา **แถบว่างแนวนอนที่ยาวที่สุดระหว่างขอบบน-ล่างของหมึก** = ระยะที่มาร์กหลุดจากพยัญชนะ
   เทียบกับฟอนต์อ้างอิงที่รู้ว่าดี (Courier New / Leelawadee UI) เสมอ — **อย่าเทียบเป็นพิกเซลดิบ**
   เพราะแต่ละฟอนต์ตัวใหญ่ไม่เท่ากันที่ px เดียวกัน ให้คิดเป็น **% ของ em**
   · ทดสอบเร็ว ๆ นอกแอป: electron สคริปต์เล็ก (`new BrowserWindow({show:false})` + `loadFile` +
     `capturePage().toPNG()`) แล้ววิเคราะห์ด้วย PIL · **ใส่ `?v=N` ท้าย url ของ @font-face ทุกครั้ง**
     ไม่งั้น Chromium ใช้ฟอนต์เดิมจาก cache ทั้งที่ไฟล์เปลี่ยนแล้ว (หลงคิดว่าแก้ไม่ติด)
   · ใน e2e ทำได้โดยไม่ต้องสกรีนช็อต: วาดลง `<canvas>` แล้วอ่าน `getImageData` — ล็อกไว้เป็นเทสถาวร
51. **`.sp { line-height:1.5 }` = หน้าหนึ่งจุ 36 บรรทัดแทน 54** (alpha.58 บั๊ก 3)
   บทภาพยนตร์คือ **6 บรรทัด/นิ้ว** → 12pt บนช่วงบรรทัด 12pt = `line-height:1` พอดี (16px)
   ค่า 1.5 ทำให้ (ก) ตัวหนังสือดู "ใหญ่/ห่าง" กว่า Final Draft ครึ่งเท่า (ข) **เส้นคั่นหน้าบนจอไม่ตรงกับ
   `paginate()` และไม่ตรงกับ PDF ที่ส่งออก** (`buildWatermarkHtml` ใช้ `line-height:1` มาตลอด)
   **กฎ: จอกับกระดาษต้องใช้เลขชุดเดียวกัน** — เจอความไม่ตรงเมื่อไร ให้เช็คว่า CSS จอเท่ากับ CSS ตอนพิมพ์ไหมก่อน
   · หน้ากระดาษ 8.5in = 816px กว้างกว่าพื้นที่ทำงานทั่วไป → มี "พอดีความกว้าง" (`zoomFitWidth`) ให้เลือก
52. **decoration ที่สแกนทั้ง doc ทุก `docChanged` = O(ความยาวไฟล์) ต่อ 1 keystroke** (alpha.58 บั๊ก 4)
   ตรวจคำผิด/ชื่อ Wiki/สมอคอมเมนต์ เคยทำแบบนี้หมด → ไฟล์ยาวแล้วพิมพ์กระตุก
   **แก้: `incrementalDecoState(key, scan)` ใน editor.js** — `prev.map(tr.mapping, tr.doc)` แล้วสแกนใหม่
   เฉพาะ **บล็อกระดับบนที่ถูกแตะ** (หาช่วงจาก `tr.mapping.maps[i].forEach` + `mapping.slice(i+1)`)
   ใช้ได้เฉพาะ decoration ที่ **คิดจากข้อความในบล็อกเดียว** — เลขฉาก/เส้นคั่นหน้า/ต่อเนื่อง ต้องดูทั้งเอกสาร ห้ามใช้ทางนี้
   · อย่าลืมของแพงอื่นในลูปเดียวกัน: regex ที่สร้างใหม่ทุกครั้ง · `getMarkdown()` ที่แปลง inline→md ทีละบล็อก
53. **ตัวกรอง "คำมั่ว" ระดับตัวอักษรจับคำพิมพ์สลับตัวไม่ได้ตลอดกาล** (alpha.58 บั๊ก 1)
   "พมิมพ์" ขึ้นต้นด้วยพยัญชนะ ไม่มีวรรณยุกต์ซ้อน = ผ่านทุกกฎ · เพิ่มกฎไปก็ไล่ไม่ทัน
   **หลักที่ใช้ได้จริงคือ "ต้องเจอซ้ำ"** (ชื่อในบทถูกพิมพ์หลายครั้ง · คำพิมพ์ผิดโผล่ครั้งเดียว)
   แล้วเปิดทางลัด 3 ทาง: มีใน Wiki / ผู้ใช้กด "จำ" / ผู้ใช้กด "ไม่จำ" — และ **โชว์รายการที่ยังไม่จำ** ให้ตัดสินเอง
54. **`paginate()` เคยใส่ CONTINUED ให้ทุกคู่หน้าโดยไม่ดูฉาก** (alpha.58 · 55–56)
   ต้องรู้ว่า "หน้าถัดไปเริ่มด้วยฉากเดิมไหม" → เก็บ `page.sceneStart/sceneEnd` ตอนจัดหน้า
   · เลขกำกับ `CONTINUED: (2)` ต้อง **รีเซ็ตเมื่อเปลี่ยนฉาก** ไม่งั้นฉากใหม่ที่ข้ามหน้าครั้งแรกได้เลข (2) ทันที
   · เครื่องหมายพวกนี้ **ห้ามเขียนเป็นข้อความจริง** — ต้องเป็น widget decoration ไม่งั้นหลุดลงไฟล์ .md แล้วลบไม่ออก

55. **"โหมด" ที่ทับกันได้ ต้องแข่ง !important กันตรง ๆ** (alpha.58r บั๊ก 3)
   `sp-view-layout`/`sp-view-draft` ใช้ `!important` เพื่อชนะกฎกระดาษ → พอเปิด **โหมดอ่าน** ทับอีกชั้น
   กฎโหมดอ่าน (ไม่มี !important) จึงแพ้ ได้พื้นขาวของ layout ปนหมึกของธีม
   **กฎ: ถ้าโหมด A ใช้ !important แล้ว โหมด B ที่ต้องทับ A ก็ต้องใช้ !important + specificity สูงกว่า**
   · และต้องมีกฎ `:not(.paper-mode)` ให้ชัด ไม่ใช่หวังว่า "ไม่มีกฎ = ได้ค่าเริ่มต้น"
56. **อย่าให้ "สวิตช์ที่ควรเปลี่ยนแค่สี" ถือ layout ไว้ด้วย** (alpha.58r บั๊ก 4)
   `padding`/`margin` ของหน้ากระดาษเคยอยู่ในกฎ `body.paper-mode` เท่านั้น → ปิดโหมดกระดาษแล้ว
   ระยะขอบหายทั้งหน้า **แก้: ย้าย layout ไปกฎกลาง (`.pane:not(.wiki-pane) > .workspace > .ProseMirror`)
   แล้วให้โหมดเหลือแค่ background/color/border/box-shadow** — เทสได้ด้วยการเทียบ computed padding ก่อน/หลังสลับ
57. **UI ที่ "เพิ่มพื้นที่" ห้ามกิน padding ของเนื้อหา** (alpha.58r บั๊ก 2)
   เลขบรรทัดเคยตั้ง `padding-left:64px` ทับ `--mg-left` (144px) → ข้อความ reflow ทั้งไฟล์
   ยิ่งบทภาพยนตร์ยิ่งพัง เพราะทุก element วัดระยะเยื้อง **จากขอบกระดาษ**
   **แก้: วาดในระยะขอบที่ว่างอยู่แล้วด้วย `position:absolute`** (เว้นที่เพิ่มเฉพาะบริบทที่ขอบแคบจริง — โหมดร่าง/ฟิลด์วิกิ)
58. **สัดส่วนที่ใช้คืนตำแหน่งเลื่อน ต้องเทียบ "ช่วงที่เลื่อนได้" ไม่ใช่ความกว้างเนื้อหา** (alpha.58r บั๊ก 1)
   `scrollLeft / scrollWidth` เพี้ยนเมื่อ `clientWidth` เปลี่ยนตามระดับซูม (และ `.workspace` มี
   `min-width:<ซูม×100>%` ที่ JS ตั้งไว้ ทำให้ scrollWidth ไม่เป็นเส้นตรงกับซูม)
   **ใช้ `scrollLeft / (scrollWidth − clientWidth)`** — ค่านี้ = 0.5 เมื่ออยู่กึ่งกลางเสมอทุกระดับซูม
59. **ค่าที่ผู้ใช้ปรับได้ ต้องเข้าไปอยู่ใน "object รูปแบบ" ไม่ใช่อ่านจาก state ตอนวาดอย่างเดียว** (alpha.58r บั๊ก 5+9)
   `spLineHeight` เคยไปแค่ CSS var → `paginate()`/`pageMetrics()` ที่เป็นโมดูลบริสุทธิ์ไม่มีทางรู้
   คืน 54 บรรทัด/หน้าเสมอ ทั้งที่จอวาด 36 **แก้: ใส่ `lineHeight` เข้า `mergeSpFormat()`
   แล้วทำ `formatLines(fmt)` เป็นจุดเดียวที่ทุกที่เรียก** (ไล่แทน `linesPerPage(paper,margins)` ให้หมด)
60. **การส่งออกต้องเดินทางเดียวกับที่ฟีเจอร์อื่นใช้** (alpha.58r บั๊ก 6)
   ทุกฟีเจอร์บทใช้ `blocksFromDoc(doc)` มานาน แต่ทางส่งออก FDX/RTF/PDF ยังเป็น `parseScript(getMarkdown())`
   ซึ่ง **ไม่ใช่ round-trip ที่ปิดวง** (บทพูดกำพร้าสร้างไม่ได้ — บทเรียน 43) → เนื้อหาเพี้ยนเฉพาะตอนส่งออก
   **เช็คเร็ว: ฟีเจอร์ใหม่ที่อ่านเอกสาร ให้ grep ว่ามีใครยังเรียก `parseScript(...getMarkdown())` เหลืออยู่ไหม**
61. **e2e ที่รอ async I/O ด้วย `setTimeout` คงที่ = flaky** (เผา 2 รอบ e2e ใน alpha.58r)
   ค้นทั้งโปรเจกต์ / เติมรายการฟอนต์จากโฟลเดอร์ เป็น IPC ทีละไฟล์ — ยิ่งมี Snapshots จากเทสก่อนหน้ายิ่งช้า
   **แก้: วนรอ "จนกว่าเงื่อนไขจะจริง" (poll ทุก 50–100ms, มีเพดาน) แทนการเดาเวลา**
62. **แท็บที่เทสก่อนหน้าอ้างถึงอาจถูกปิดไปแล้ว** — บล็อกเทสท้าย ๆ ที่ `activate(t.file)` แล้ว
   `document.querySelector('.pane.on …')` ได้ null → `getComputedStyle(null)` throw ทั้งชุด
   **แก้: เช็ค `state.tabs.has(file)` ก่อน ถ้าไม่มีให้คลิก `.scene` เปิดใหม่ แล้วอ้างจาก `state.active.pane` (`:scope >`)**
62b. **`if (spTab) { …เทสทั้งก้อน… }` ที่หา tab ไม่เจอ = เทสถูกข้ามเงียบ ๆ ไม่มีใครรู้** (alpha.59)
   เขียน `const spT = [...state.tabs.values()].find(x => x.sp); if (spT) {…}` แล้วบล็อกทั้งก้อนไม่รัน
   — ผลยัง `ALL OK` จำนวน check เพิ่มขึ้นบ้าง จึงดูเหมือนผ่าน (จับได้เพราะไปนับ `grep -c "PASS \[69\]"` เอง)
   **แก้: ถ้าไม่มีให้เปิดใหม่เอง (`คลิก .scene`) แล้ว `check()` ว่าเปิดได้จริง — ห้ามใช้ `if` ครอบเงียบ ๆ**
   · เช็คเร็วหลัง e2e: `grep -cE '^PASS \[(เลขฟีเจอร์)\]'` ต้องได้เท่าจำนวน check ที่เขียนไว้

63. **ฟอนต์ที่ฝังลง PDF: pdf-lib ไม่มีลูกโซ่สำรองแบบ CSS `font-family`** (alpha.59 — เจอตอนเปิดไฟล์ดูด้วยตา)
   หนึ่ง `drawText` = หนึ่งฟอนต์ ตกไม่ได้ → ต้องเลือกฟอนต์ต่อ "ช่วงอักขระ" เอง (`splitFontRuns`)
   (ก) **Courier Prime ไม่มีอักษรไทยเลยแม้แต่ตัวเดียว** — ใช้เป็นฟอนต์หลักแล้วไทยหายทั้งไฟล์ (.notdef)
   (ข) **CourierThaiMono (ฟอนต์ไทยปี 1998) เอา cmap ของ Latin-1/General Punctuation ไปชี้ทับด้วย glyph ไทย**
       `·`→"ท" · `©`→"ฃ" · `—` `–` `…` `“ ”` → วรรณยุกต์ลอย
       **fontkit หา glyph เจอ (id ≠ 0) จึงไม่มีใคร throw หรือฟ้องอะไรเลย** ได้ไฟล์ที่ "อ่านออกแต่ผิด"
       → **จับได้แค่ตอนเรนเดอร์ออกมาดู** (แม่แบบลายน้ำมาตรฐานคือ `{ชื่อ} · {วันที่}` — โดนเต็ม ๆ)
   **แก้: ไทย+ASCII+PUA F700–F71F → วงศ์ไทย · ที่เหลือ → CourierPrime** (กว้าง 1229 vs 1228/2048 em
   จึงยังเรียงคอลัมน์เท่ากัน) · ฟอนต์ไทยมีน้ำหนักเดียว → **ตัวหนาปลอมด้วยการวาดซ้ำเยื้อง 0.035em**
   · วิธีตรวจก่อนเชื่อ: `fontkit.create(bytes).layout('กิน').glyphs` ต้องไม่มี `id === 0`
     และวรรณยุกต์ต้อง `advanceWidth === 0` (ไม่งั้นกินคอลัมน์ของ monospace)
64. **เครื่องหมายที่ paginate() ไม่ได้กันบรรทัดไว้ ต้องวาดใน "ระยะขอบ"** (alpha.59)
   บนจอ CONTINUED/(CONTINUED) เป็น decoration ที่ไม่กินที่ในเอกสาร → ตอนสร้าง PDF ถ้าไปเบียดบรรทัด
   ให้มันจะทำให้จำนวนหน้าไม่ตรงกับบนจอ **แก้: วาดที่ `baseline(-1)` และ `baseline(bodyLines)`**
   (ระยะขอบ 1 นิ้ว = 6 บรรทัด มีที่เหลือแน่นอน) — หลักเดียวกับเลขหน้าที่อยู่นอกพื้นที่พิมพ์
65. **`+x || d` กับค่าที่ 0 มีความหมาย = บั๊กเงียบ** (ซ้ำรอยบทเรียน 5 อีกครั้งใน alpha.59)
   `Math.round((+c.linesBefore || 10) / 10)` — `dialogue`/`parenthetical` มี `linesBefore: 0`
   ซึ่ง falsy → กลายเป็น 10 (เว้น 1 บรรทัด) → **บทพูดหลุดจากชื่อตัวละครทุกบล็อกใน PDF**
   **ใช้ `num(v, d)` ที่เช็ค `Number.isFinite` เสมอ** ในโมดูลที่อ่านค่าจาก config

49. **`refreshToolbar()` มีลูป `.tb` ที่ตั้ง `dis` จาก `canEdit` อย่างเดียว** → ปุ่มที่ต้องการเงื่อนไขของตัวเอง
   (เช่น "ใช้ได้เฉพาะบรรทัดตัวละคร") ต้องตั้งคลาส **หลังลูปนั้น** ไม่งั้นถูกลบทิ้งเงียบ ๆ
50. **เพิ่มช่องในคุณสมบัติฉาก = แก้ index ใน e2e "สองที่"** — มีทั้ง **กล่อง** (`scene-props.js`) และ
   **แผง** (`renderPropsPanel` ใน app.js) ที่เทสอ้าง `inps[N]` แยกกัน (ขยายจากบทเรียนข้อ 12)

66. **สวิตช์ "หน่วงเวลา" ที่เขียนเป็น "ปิดฟีเจอร์" = ฟีเจอร์หายทั้งระบบ** (alpha.60r1 บั๊ก 6)
   `spAutoPaginate` (ข้อ 96) ค่าเริ่มต้น `false` แต่ `scheduleCount` เขียน `if (spAutoPaginate !== false)`
   ครอบการจัดหน้าทั้งก้อน → ผู้ใช้ทุกคนที่ไม่เคยแตะสวิตช์ ไม่เห็นจำนวนหน้า/เส้นคั่นหน้า/CONTINUED เลย
   **แก้: แยกงานจริงเป็นฟังก์ชัน (`repaginateNow`) แล้วให้สวิตช์เลือกแค่ "ใครเรียก เมื่อไร"**
   · e2e จับได้ที่ [84] "แถบสถานะบอกจำนวนหน้า" — เช็คที่วัด **ผลลัพธ์ที่ผู้ใช้เห็น** จับ regression แบบนี้ได้เสมอ
67. **e2e ไม่ idempotent เพราะ global settings ค้างข้ามรอบ** (alpha.60r1 — เผา 1 รอบ e2e)
   ข้อ 94 เพิ่ม `%APPDATA%/Killian2/settings.json` ที่ merge ทับ `DEFAULT_SETTINGS`
   รอบก่อนหน้าเทส "ตั้งค่า" เขียน `uiFontSize = 4` ลงไป → รอบถัดไปฟอนต์ UI เริ่มที่ 18px
   แล้ว check ที่คาด 14px ล้มตั้งแต่ต้น (ดูเหมือนโค้ดพัง ทั้งที่ไม่ใช่)
   **แก้: `runTest()` เรียก `kapi.writeGlobalSettings({})` ก่อนเริ่ม** (คู่กับการล้าง localStorage เดิม)
68. **เติม i18n ในไฟล์ที่มีตัวแปรชื่อ `t` = ระเบิดตอนรัน** (บทเรียน 25 ซ้ำ)
   `split-ui.js` / `ai-ui.js` / `comment-ui.js` ใช้ `const t = state.active` อยู่แล้ว
   พอ `import { t } from core.js` เข้ามา esbuild เปลี่ยนชื่อเป็น `t3` แล้วตัวแปรท้องถิ่นบังทับ
   → `TypeError: t3 is not a function` กลางการวาด split (build ผ่านสนิท)
   **แก้: `import { t as tr }` เสมอในไฟล์กลุ่มนี้ เหมือนที่ app.js ทำมาตั้งแต่แรก**
69. **`splitCharacter()` ตัดเฉพาะวงเล็บ "ท้ายบรรทัด"** — `text.split('(')[0]` ตัดผิดเมื่อชื่อมีวงเล็บในตัว
   ("ดร. (ปรายฟ้า) (V.O.)" → `split` ได้ "ดร." · `splitCharacter` ได้ "ดร. (ปรายฟ้า)")
   · ข้อจำกัดที่แก้ไม่ได้: "ดร. (ปรายฟ้า)" เดี่ยว ๆ แยกไม่ออกว่าเป็นชื่อหรือชื่อ+ส่วนเสริม — ยอมรับ
70. **การคืนตำแหน่งเลื่อนต้อง "ตั้งซ้ำจนถึงเป้า" แต่ "ห้ามลากกลับ"** (alpha.60r2 ข้อ 7 — เผา 3 รอบ e2e)
   ใส่ DOM กลับหลังวาดแผงใหม่ → layout ยังไม่เสร็จ เบราว์เซอร์ **หนีบ** ค่าที่ตั้งให้เตี้ยลงตาม `scrollHeight`
   ที่ยังไม่โต (ขอ 210 ได้ 178) → ต้องตั้งซ้ำหลายรอบ · แต่ถ้าตั้งซ้ำแบบ "ยังไม่ตรงก็ตั้งใหม่"
   แล้วมีใครเลื่อนไปที่อื่นระหว่างนั้น รอบหลังจะ **ลากกลับ** (ตั้ง 240 แล้ว 60ms ต่อมากลายเป็น 43 ของรอบก่อน)
   **แก้: จำ "ค่าที่เราเขียนไปครั้งล่าสุด"** — ค่าปัจจุบัน == ของเรา (หรือ 0 = เพิ่งถูกล้างจากการย้าย DOM)
   → เป็นของเรา ตั้งต่อได้ · ต่างจากนั้น → มีเจ้าของใหม่ หยุดทันที (`rAF` + 0/30/60/120/250ms แล้วหยุดเองเมื่อถึงเป้า)
71. **`scroll-behavior:smooth` ทำให้ `el.scrollTop = N` แล้วอ่านกลับทันทีได้ค่าเก่า** (alpha.60r2 — เผา 2 รอบ e2e)
   `style.css` ตั้ง `scroll-behavior:smooth` ที่ `html,body,.k-panel-body,.pane,#panes`
   → การกำหนดค่าเป็น **อนิเมชัน** ไม่ใช่การตั้งค่าทันที · เทสที่เขียน `pane.scrollTop=120; const v=pane.scrollTop;`
   ได้ 0 เสมอ (ดูเหมือน "เลื่อนไม่ได้" ทั้งที่ `scrollHeight` ใหญ่กว่า `clientHeight` ตั้ง 16,000px)
   **แก้: รอจนค่าถึงเป้าก่อนวัด** (หรือ `scrollTo({behavior:'instant'})`) — แนวนอนกับแนวตั้งพังไม่พร้อมกัน จึงหลอกตา
72. **ตัวแก้ไขที่มี "โฟกัสจริง" จะดึงจอกลับไปหาเคอร์เซอร์** — e2e บน Linux/xvfb ไม่เจอ เพราะหน้าต่างไม่เคยได้โฟกัส
   แต่บน **macOS เจอทุกครั้ง**: ตั้ง `scrollTop=240` แล้วเด้งกลับ 44 (= ตำแหน่งเคอร์เซอร์ต้นเอกสาร)
   ทุกครั้งที่ ProseMirror เขียน DOM selection ใหม่ · **แก้ในเทส: `document.activeElement.blur()` ก่อนวัด**
   → บทเรียนกว้างกว่านั้น: **เทสที่วัดตำแหน่งเลื่อน/โฟกัส ผลต่างกันตาม OS** อย่าฮาร์ดโค้ดสมมติฐานของ Linux
73. **e2e ที่ฮาร์ดโค้ดรูปแบบคีย์ลัดของ Windows พังบน macOS** (alpha.60r2)
   `formatShortcut()` ตั้งใจคืน `⌘⇧B` บน mac ตามธรรมเนียมระบบ แต่เทสเช็ค `=== 'Ctrl+Shift+B'`
   → FAIL ตั้งแต่ check ที่ 420 ทั้งที่โค้ดถูกทุกบรรทัด · **รับทั้งสองแบบ** (`['Ctrl+Shift+B','⌘⇧B'].includes(...)`)
74. **`await` แบบ "รอตายตัว" หลังงาน async = FAIL ปลอมบนเครื่องช้า** (alpha.60r2)
   `saveAllTabs` เขียนไฟล์แบบ async · เทสรอ 250ms แล้วเช็คว่าไม่เหลือแท็บค้าง → พังเมื่อไฟล์เยอะ/เครื่องช้า
   **แก้: วนรอ "เงื่อนไขจริง" พร้อมเพดาน** (`for (let i=0;i<40 && ยังมี dirty;i++) await 50ms`)
   ใช้แนวนี้กับทุกที่ที่รอ layout ของ ProseMirror ด้วย (รอ `scrollHeight` โตจริงก่อนวัด)
75. **[alpha.61] `electron-builder` เขียนทับ `package.json` แล้วลบ `scripts`/`devDependencies`/`build` ทิ้ง**
   ขั้น "installing native dependencies" (`@electron/rebuild`) รัน npm install ใน appDir แล้วเขียนไฟล์กลับแบบตัดฟิลด์
   → หลัง `npm run dist:mac` ครั้งแรก `npm run test:unit` พังด้วย `Cannot read properties of undefined (reading 'test:unit')`
   **แก้: commit ก่อน build เสมอ แล้ว `git checkout HEAD -- package.json` ทันทีหลัง build**
76. **[alpha.61] rAF หยุดยิงเมื่อหน้าต่างไม่ได้อยู่หน้าสุด → เทสที่รอ "1 เฟรม" แกว่งบน macOS**
   `scheduleLineGutter()` / `keepZoomCenter()` คืนสถานะผ่าน `requestAnimationFrame`
   · รัน e2e จาก **`.app` ที่ build แล้ว** หน้าต่างมักถูกบัง → เฟรมไม่มาใน 120ms → FAIL ทั้งที่โค้ดถูก
   · `backgroundThrottling:false` กัน **timer** ไม่ให้ถูกหรี่ แต่ **ไม่กัน rAF** ของหน้าต่างที่ถูกบัง
   **แก้: วนรอเงื่อนไขจริง (บทเรียน 74) แทนการเชื่อว่าเฟรมเดียวมาแน่** — อย่าเพิ่ม sleep ให้ยาวขึ้นเฉย ๆ
77. **[alpha.61] `node_modules` ที่ก๊อปข้ามแพลตฟอร์มพังเงียบ ๆ 2 ชั้น**
   repo บนเครื่อง Top มี `@esbuild/win32-x64` + `electron/dist/electron.exe` ติดมาจากฝั่ง Windows
   · `node build.js` ฟ้องตรง ๆ (esbuild บอกเอง) · แต่ **electron ไม่ฟ้อง** — `path.txt` ชี้ `electron.exe` เฉย ๆ
   **แก้: `npm install` แล้ว `rm -rf node_modules/electron/{dist,path.txt} && node node_modules/electron/install.js`**
79. **[alpha.62] CSS ของไลบรารีที่ bundle "แต่ JS" หายไปเงียบ ๆ — ไม่มีใครฟ้อง**
   โปรเจกต์นี้ไม่เคยรวม `prosemirror-view/style/prosemirror.css` เลย (esbuild bundle เฉพาะ JS
   และ `index.html` ลิงก์แต่ `style.css` ของเราเอง) → `.ProseMirror` ได้ `white-space:normal`
   ตามค่าเริ่มต้นของเบราว์เซอร์ ผลที่ผู้ใช้เจอ **ไม่มีคำว่า CSS อยู่ในอาการเลย**:
   · กด Tab แล้ว "ไม่มีอะไรเกิดขึ้น" (อักขระแท็บถูกยุบทิ้งตอนเรนเดอร์ — คำสั่ง `insertTab` ทำงานถูกทุกอย่าง
     และ **unit-style check ที่ดู `getMarkdown()` ก็ผ่าน**) · โหมดบทหนังรอดเพราะ `.sp` ตั้ง `pre-wrap` เอง
   · ย่อหน้าที่เหลือแต่ช่องว่างถูกยุบ แล้ว PM อ่าน DOM กลับได้บรรทัดว่าง = **บรรทัดหายทั้งบรรทัด**
   · gap cursor เปิดปลั๊กอินไว้แต่มองไม่เห็นมาตลอด (ไม่มี `.ProseMirror-gapcursor`)
   **กฎ: เทสตัวแก้ไขต้องมีอย่างน้อยหนึ่ง check ที่วัด "ผลบนจอ"** (`getComputedStyle().whiteSpace`,
   `view.coordsAtPos()`) ไม่ใช่ดูแต่ผลใน state · และเวลาเพิ่มปลั๊กอิน PM ให้เช็คว่ามันมี CSS มาด้วยไหม
80. **[alpha.62] `scroll-behavior:smooth` บนกล่องที่ "โปรแกรมตั้งตำแหน่งเลื่อนเอง" = ตัวคืนค่าตัดสินผิด**
   (ต่อจากบทเรียน 71 ซึ่งแก้แค่ฝั่งเทส — คราวนี้มันกัดผู้ใช้จริง 2 อาการ)
   `el.scrollTop = n` กลายเป็น **อนิเมชัน** → อ่านกลับทันทีได้ค่ากลางทาง
   · `restoreScroll()` เช็ค "มีคนอื่นเลื่อนไปแล้วหรือยัง" จากค่าที่อ่านกลับ → เจอค่ากลางทางแล้วเลิกตาม
     = **ขยับแผงทีไร หน้ากระดาษเลื่อนเองทุกที**
   · `keepZoomCenter()` เก็บสัดส่วนก่อนซูม → ซูมด้วย Ctrl+ล้อรัว ๆ (เรียกซ้อนกันหลายรอบ) สัดส่วนไหลลง
     เรื่อย ๆ จน **หน้ากระดาษไปติดขอบซ้าย** (คือ "บั๊กเก่ากลับมา" ที่ผู้ใช้รายงาน)
   **แก้: กล่องที่โปรแกรมตั้งตำแหน่งเลื่อนเองต้องเป็น `scroll-behavior:auto`** (`.pane` `#panes`)
   และตัวคืนค่าบังคับ `style.scrollBehavior='auto'` ระหว่างทำงานแล้วคืนสถานะเดิม
81. **[alpha.62] `npx asar extract-file <asar> package.json` เขียนไฟล์ลง cwd**
   รันจากรากโปรเจกต์เพื่อ "verify version ในแพ็กเกจ" → **ทับ `package.json` ของ repo ด้วยตัวที่ถูก
   electron-builder ตัด `scripts`/`build`/`devDependencies` ทิ้ง** (กับดักข้อ 75 ซ้ำอีกทาง)
   `git status` ตอนนั้นสะอาดจึงไม่มีใครเอะใจ แล้วไปโผล่ตอน `npm run dist:mac` รอบถัดไป
   **แก้: `cd /tmp` ก่อนเสมอ** แล้วอ่านไฟล์ที่แตกออกมาจากที่นั่น
82. **[alpha.62] `kapi.listDirs` ไม่เรียงตามตัวอักษร** (APFS คืนตามลำดับภายใน)
   โค้ดที่เขียนว่า "โฟลเดอร์แรกที่ไม่ใช่โฟลเดอร์ระบบ = เล่มที่จะใช้" จึงได้ผลไม่คงที่
   ยิ่งเมื่อมีเล่มที่เพิ่งสร้าง (ยังไม่มี `Draft/`) หรือโฟลเดอร์ใหม่อย่าง `Sessions/` `languages/`
   → Kanban เปิดไม่ขึ้นแบบสุ่ม ทั้งที่มีเล่มที่ใช้ได้อยู่ · **แก้: ไล่หา "ตัวแรกที่ใช้ได้จริง" + `.sort()` เสมอ**
83. **[alpha.62] `build.js` ก๊อป `languages/` → `renderer/languages/` ทุกครั้ง**
   แก้คำแปลที่ `renderer/languages/*.json` แล้วจะหายทุกครั้งที่ build (ดูเหมือนมีอะไรมา revert ไฟล์)
   **แหล่งจริงคือ `languages/` ที่รากโปรเจกต์**
84. **[alpha.62] `navigator.clipboard.writeText` ต้องการหน้าต่างที่ "โฟกัสอยู่"**
   หน้าต่างไร้ขอบ + แผงลอยที่เพิ่งถูกคลิก มักยังไม่ได้โฟกัส → reject เงียบ ๆ (และ `document.execCommand('copy')`
   ก็ล้มด้วยเหตุเดียวกัน) **แก้: คัดลอกผ่าน main process** (`clipboard.writeText` ของ electron →
   `kapi.clipboardWrite`) แล้วค่อยตกไปทางเบราว์เซอร์เป็นทางสำรอง
85. **[alpha.62] แผ่นเต็มจอ "ระหว่างรอ" = กับดักที่ทำให้ผู้ใช้ต้อง force quit** ⚠ ร้ายแรงที่สุดของรอบนี้
   `#k-loader` เป็น `position:fixed; inset:0; z-index:999` · `loadProject()` เปิดมันแล้วเรียก
   `closeProjectIfAny()` ซึ่ง**เด้งกล่อง "บันทึกก่อนปิด?"** — กล่องนั้นคือ `.k-overlay` ที่ **z-index 80**
   → อยู่ใต้แผ่น loading · คลิกปุ่มไม่ได้ · ปิดโปรแกรมตามปกติก็ไม่ได้ → **force quit ทิ้งงานที่ยังไม่บันทึก**
   **แก้: ลบหน้าจอ loading ทิ้งทั้งชุด** แล้วรายงานที่แถบสถานะล่างแทน (`setBusy` ใน core.js)
   **กฎที่ต้องจำ 3 ข้อ**
   · ตัวบอกความคืบหน้า **ห้ามบล็อกอะไรทั้งสิ้น** — ถ้าจะวางทับจอ ต้องตอบให้ได้ก่อนว่ากล่องไหนบ้างเด้งได้ระหว่างนั้น
   · **`clearBusy()` ก่อนเปิดกล่องที่ต้องรอผู้ใช้ตอบเสมอ** (บันทึก · ยืนยัน · เลือกไฟล์) —
     สปินเนอร์หมุนค้างระหว่างรอ = ผู้ใช้อ่านว่า "แฮงก์" แล้วกด force quit อยู่ดี
   · งานยาวครอบ **`withBusy` / `try…finally`** — ล้มกลางทางแล้วห้ามเหลือสถานะค้าง
   **เทสที่จับบั๊กนี้ได้จริง**: วาง `.k-overlay` จำลอง → `setBusy(...)` → `document.elementFromPoint()`
   ที่กลางปุ่มต้องคืน **ตัวปุ่ม** (ดู `[62-9]` ใน selftest) — เช็คแค่ "ไม่มี #k-loader" ไม่พอ

86. **[alpha.62] รัน e2e บน Windows แล้วแอปค้างที่กล่อง "Error" — EPIPE ไม่ใช่บั๊กของแอป**
   สั่ง `& ".\dist\win-unpacked\Killian 2.exe" *> C:\tmp\k2app.log` ใน task ที่รันเบื้องหลัง →
   launcher คืนค่าทันที **แล้ว stdout ที่ต่อไว้ถูกปิด** · พอ main process เรียก `console.error`
   (เช่นตอน IPC handler reject) ก็ได้ `EPIPE: broken pipe` เป็น **uncaught exception ใน main**
   → Electron เด้งกล่อง native "A JavaScript error occurred in the main process" **ซึ่งบล็อกทุกอย่าง**
   เทสหยุดนิ่งกลางคัน ไม่มี FAIL ไม่มี STOP — ดูเหมือนโปรแกรมแฮงก์เฉย ๆ
   **แก้: `Start-Process … -RedirectStandardOutput <file> -RedirectStandardError <file>`** (ไฟล์จริง ไม่ใช่ pipe)
   **วิธีวินิจฉัยเร็ว** (ใช้ได้กับอาการ "e2e ค้างไม่บอกอะไรเลย" ทุกแบบ):
   `Get-Process | ? {$_.MainWindowTitle}` → ถ้าเห็น title `Error` = มีกล่อง native ค้างอยู่ ·
   อ่านข้อความในกล่องด้วย UIAutomation (`AutomationElement` + `PropertyCondition` บน `ProcessIdProperty`)

90. **[alpha.62] "ปิดแผง" ที่ตัดโหนดออกจากต้นไม้ = ทิ้งข้อมูลตำแหน่งทั้งก้อน แล้วต้องเดาใหม่** ⚠ ตัวแม่
   `hidePanel()` เรียก `removePanel()` → เสีย 2 อย่างพร้อมกัน:
   **(ก) สล็อตหาย** — เปิดกลับต้องเดาจาก `homes {targetId, side}` ที่จดตอนปิด
   ตัวเดายึด "เพื่อนบ้านที่**มุมซ้ายบน**ใกล้ที่สุด" (`Math.hypot(r2.left-r.left, r2.top-r.top)`)
   ซึ่งเลือกผิดตัวง่ายมาก: แผงที่ผนึกไว้ **ขอบบนของเอกสาร** (dock แนวตั้ง กว้างเต็มจอ)
   มีมุมซ้ายบนใกล้ **แผงโปรเจกต์ฝั่งซ้าย** มากกว่าใกล้แผงเอกสารที่มันเกาะอยู่จริง
   → เปิดกลับแล้วไปโผล่ "ขวาของแผงโปรเจกต์" = **ย้ายจากขอบบนไปกองอยู่ฝั่งซ้าย**
   **(ข) พี่น้องโดนเกลี่ยขนาดใหม่** — `keepSizes()` แจกส่วนของตัวที่หายให้ตัวที่เหลือ
   แล้วตอนเปิดกลับ `insertSize()` หักคืนแบบเฉลี่ย → **ratio ของแผงที่ไม่เกี่ยวข้องเลยก็ขยับ**
   **แก้ที่รากเดียว: อย่าตัดโหนดทิ้ง — ติดธง `hidden` แล้วให้ตัววาดข้ามไป**
   ตำแหน่ง ทิศ ลำดับพี่น้อง และ `sizes` อยู่ครบเหมือนตอนปิด · เปิดกลับ = ถอดธง **ไม่ต้องเดาอะไรเลย**
   (มีของเดิมเป็นแบบอย่างอยู่แล้ว — ธง `collapsed` ของปุ่ม ▾ ก็ทำแบบนี้)
   · **บทเรียนกว้างกว่านั้น**: ถ้าฟีเจอร์ต้อง "จำที่เดิม" อย่าเก็บเป็น *คำอธิบายเชิงสัมพัทธ์*
     (ใกล้ใคร ฝั่งไหน) แล้วประกอบใหม่ทีหลัง — **เก็บของจริงไว้ที่เดิม** แล้วแค่ซ่อนการแสดงผล
     บทเรียน 87/88 (ดริฟต์เพราะวัด DOM · เทียบแกนเดียว) คือ*อาการ*ของรากเดียวกันนี้

87. **[alpha.62] "วัดจาก DOM แล้วจดกลับ" = ลูปดริฟต์ที่กัดกินค่าทีละนิดทุกครั้ง**
   `currentRatio()` วัด `panel.width / dock.width` — แต่ `dock.width` **รวม `.k-resize-handle`**
   ที่คั่นระหว่างแผงไว้ด้วย → ค่าที่วัดได้เตี้ยกว่าสัดส่วนจริงในต้นไม้เสมอ (.200 → .196)
   แล้ว `rememberOpenPanels()` เอาค่าเตี้ยไปทับของเดิมทุก 250ms หลังวาด
   ปิด-เปิดแผงทีหนึ่ง `applyRatio` จึงหดลงอีกนิด **ทุกครั้ง สะสมไปเรื่อย ๆ**
   **กฎ: ถ้ามี "แหล่งความจริง" (layout tree) อยู่แล้ว ห้ามวัดจาก DOM กลับมาเขียนทับมัน**
   วัดจาก DOM ได้เฉพาะตอนไม่มีค่าในแหล่งความจริง (แผงในกลุ่มแท็บ/ลอย) และต้องเป็นทางสำรองเท่านั้น
   · อาการที่ผู้ใช้บอก: "ไม่ถูกล็อก กดเปิดปิดทีไรขนาดขยับตลอด" — ไม่ใช่ค่าเพี้ยนทีเดียว แต่ **ค่อย ๆ เพี้ยน**
88. **[alpha.62] เทียบตำแหน่ง element ด้วยแกนเดียว = พังทันทีที่มีเลย์เอาต์อีกแกน**
   `rememberHome` เขียน `r2.left < r.left ? 'right' : 'left'` ซึ่งใช้ได้เฉพาะแผงที่เรียงแนวนอน
   แผงที่ผนึกแนวตั้ง (dock `col`) มี `left` เท่ากันเป๊ะ → ตกเข้า else ได้ `'left'` เสมอ
   **แก้: เทียบระยะจุดศูนย์กลางทั้ง 2 แกน แล้วเลือกทิศจากแกนที่ห่างกว่า** (`sideBetween()`)
89. **[alpha.62] `onclick = async () => {…}` ที่ไม่มี try/catch = ฟีเจอร์ตายเงียบ** ⚠ กัดมานาน
   "ลบ element ตามประเภท" พังเพราะเรียก **`smartDirty()` ที่ไม่มีอยู่จริงในโปรเจกต์เลย**
   (ไม่เคยถูกประกาศที่ไหน — grep ทั้ง src เจอแค่ 2 จุดที่ *เรียก* มัน)
   `v.dispatch(tr)` ลบไปแล้ว แต่ ReferenceError บรรทัดถัดมาทำให้ `ov.remove()`/`setStatus()` ไม่ทำงาน
   → กล่องค้าง ไม่มีข้อความ ผู้ใช้อ่านว่า "กดแล้วไม่มีอะไรเกิดขึ้น" ทั้งที่ลบสำเร็จ
   อีกจุดอยู่ใน `revertTab` (onChange ของ SPEditor) → บทหนังที่กด Revert แล้วพิมพ์ต่อ พังทุก keystroke
   **วิธีจับก่อนถึงมือผู้ใช้: `grep -rn "ชื่อฟังก์ชัน" src/` ต้องเจอทั้งที่ประกาศและที่เรียก**
   ถ้าเจอแต่ที่เรียก = ตายแน่ · esbuild ไม่ฟ้อง เพราะเป็น global lookup ตอน runtime
   **กฎ 2 ข้อ**: (1) handler ที่เป็น async **ต้องมี try/catch ครอบทั้งก้อน** เสมอ
   (2) **งานเสริม (snapshot/สถิติ/แคช) ห้ามทำให้งานหลักล้ม** — ครอบ try/catch ของตัวเองแล้วทำต่อ
   · และ "ทางออกเงียบ ๆ" (`setStatus()` แล้ว return) ใช้ไม่ได้กับคำสั่งที่เรียกจาก **เมนู native** —
   ผู้ใช้ไม่ได้มองแถบล่างอยู่ ต้อง `alert()` หรือเปิดกล่องบอกเหตุผล

91. **[alpha.63] "จัดระเบียบไฟล์ให้ผู้ใช้" = ทำลิงก์ในต้นฉบับพังทั้งโปรเจกต์** ⚠ ตัวใหญ่ของรอบนี้
   สเปกอัลบั้มรูปเขียนว่า `_uncategorized/` เป็นโฟลเดอร์จริง แล้ว migrate ย้ายรูปเก่าทุกใบลงไป
   แต่ไฟล์ .md ทั้งโปรเจกต์อ้างรูปเป็น **path สัมพัทธ์** (`![](../../../Images/sunset.png)`)
   → ย้ายเมื่อไร รูปหายจากต้นฉบับทุกฉากทันที · และไฟล์ที่เปิดนอกโปรแกรม (v1 / โปรแกรม md อื่น) ก็หาไม่เจอ
   **แก้: อัลบั้ม `_uncategorized` ชี้ไปที่ `Images/` เอง ไม่สร้างโฟลเดอร์ ไม่ย้ายไฟล์แม้แต่ใบเดียว**
   อัลบั้มที่ผู้ใช้สร้างเองเป็นโฟลเดอร์จริง · **การย้ายไฟล์เกิดเฉพาะตอนผู้ใช้สั่ง** แล้วถามก่อนว่า
   จะให้แก้ลิงก์ในไฟล์ .md ตามไหม (`applyRefRewrite`) + `resolveImg()` มีทางสำรองไล่หาในทุกอัลบั้ม
   **กฎกว้างกว่านั้น: การย้าย/เปลี่ยนชื่อไฟล์ของผู้ใช้เป็น side effect ที่ต้องขออนุญาต ไม่ใช่ผลพลอยได้ของการอัปเกรด**
92. **[alpha.63] ดัชนีที่คีย์ด้วย path เต็มใช้ไม่ได้กับรูป — ต้องคีย์ด้วยชื่อไฟล์**
   ฉากแต่ละฉากอยู่ลึกไม่เท่ากัน (`Chapters/บทที่1/ฉาก.md`) จึงอ้างรูปเดียวกันด้วยจำนวนชั้น `../` ต่างกัน
   และรูปย้ายอัลบั้มได้ตลอด → เทียบ path ตรง ๆ พลาดทุกครั้ง · **`buildUsageIndex` คีย์ด้วย `basename`**
   (คลังรูปกันชื่อชนอยู่แล้วตอน copy/ย้าย จึงปลอดภัย) · ตอนแก้ลิงก์ก็ **คงส่วนหน้า `…/Images/` เดิมไว้**
   แล้วต่อ path ใหม่ท้าย — ไม่ไปคำนวณ `../` ใหม่เอง
93. **[alpha.63] ทุกฟังก์ชันที่แตะไฟล์ควรรับ `api` เข้ามา ไม่ใช่เรียก `kapi` ตรง ๆ**
   `album-core.js` ทั้งไฟล์รับ `api` เป็นพารามิเตอร์แรก → unit test เอา kapi ปลอมที่หนุนด้วย fs จริง
   ยัดเข้าไปได้ ทดสอบ CRUD/ย้ายไฟล์/ถังขยะ ครบโดยไม่ต้องเปิด electron (199 checks รันใน ~1 วินาที)
   · **กับดักที่เจอทันที: `kapi.join` เป็น async** — เขียน `J(api, a, b)` แล้วลืม `await`
     ได้ Promise ไปเป็น path (บทเรียน 14e ซ้ำ) · esbuild ไม่ฟ้อง เจอตอนรันเทสเท่านั้น
94. **[alpha.63] แผงที่ผนึกข้างเดียวกว้างแค่ ~340px — หัวแผงที่ออกแบบบนจอกว้างจะพังเงียบ ๆ**
   ข้อความสรุป ("2 รูป · ยังไม่ถูกใช้ 1 · 598 B") ไม่มี `white-space:nowrap` → ห่อเป็น **ตัวอักษรแนวตั้ง**
   ดันหัวแผงสูงจนปุ่มเบียดกันหมด · **แก้: `nowrap` + `text-overflow:ellipsis` + `@container` ซ่อนของที่ไม่จำเป็น**
   (`container-type:inline-size` บนตัวแผง — ไม่ใช่ media query เพราะขนาดหน้าต่างไม่ได้บอกความกว้างแผง)

95. **[alpha.63r] ฟีเจอร์ที่ทางเข้าหลักคือ "ลากมาวาง" ห้ามอยู่คนละแท็บกับต้นทาง** ⚠
   กระดานอารมณ์ทำเป็นแท็บที่สองในคลังรูป → พอสลับไปแท็บกระดาน **ตารางรูปหายไปด้วย**
   ไม่มีทางลากรูปมาวางได้เลยแม้แต่ทางเดียว · เทสก็ผ่านหมดเพราะเรียก `addToBoard()` ตรง ๆ
   (เทสที่เรียก API ภายในพิสูจน์ได้แค่ "ฟังก์ชันทำงาน" ไม่ได้พิสูจน์ว่า "ผู้ใช้ไปถึงมันได้")
   **แก้: แยกเป็นแผง (`gallery-board`) ที่เปิดคู่กันได้** + ตัวกลางเล็ก ๆ (`gallery-bus.js`)
   ให้สองแผงรู้จักอัลบั้มเดียวกันโดยไม่ import หากันไป-มา
   · **เช็คก่อนออกแบบ UI ทุกครั้ง: ต้นทางกับปลายทางของ drag-and-drop เห็นพร้อมกันได้จริงไหม**
   · และ **ประกาศสถานะร่วมตอน "โหลด" ไม่ใช่ตอน "คลิก"** — ตั้งค่าจากเมนู/เทส/โค้ดอื่นก็ต้องซิงก์เหมือนกัน
96. **[alpha.63r] `object-fit:cover` = ครอบตัดรูปของผู้ใช้เงียบ ๆ**
   ภาพย่อในตารางครอบตัดได้ (จงใจ ให้กริดเรียงสวย) แต่ **กระดานอ้างอิงห้ามครอบ** —
   คนใช้เอารูปมาดูองค์ประกอบภาพ · และการวางกล่องจัตุรัสเสมอทำให้รูปแนวนอนโดนเฉือนหัวท้ายทันทีที่วาง
   **แก้: `contain` + คิดขนาดตอนวางจากสัดส่วนไฟล์จริง (`sizeForAspect`) + ลากปรับขนาดคงสัดส่วนเป็นค่าเริ่มต้น**
   · ของที่วางไว้ก่อนหน้าซ่อมได้ด้วยคำสั่ง "ปรับให้ตรงสัดส่วนรูป"
   · กฎกว้างกว่า: **มุมมองที่ผู้ใช้ใช้ "ตัดสินใจเรื่องภาพ" ห้ามบิด/ตัดภาพโดยไม่บอก** — ให้เลือกเองได้ว่าจะย่อแบบไหน

97. **[alpha.64] ย้าย feature จาก "แท็บ" มาเป็น "แผง" = ตัวยึดของ `position:absolute` หายไปด้วย** ⚠⚠
   Planner ย้ายจากแท็บมาเป็นแผงตอน .62 · ตัวห่อเดิมคือ `.pane { position:absolute; inset:0 }`
   ส่วน `#planner-body` **ไม่มี `position` เลย** → `.planner-wrap` / `.planner-filter` / `.planner-props`
   ที่เป็น absolute ไปยึดกับ `#split-root` (พื้นที่แก้ไขทั้งผืน) = **กระดานคลุมทั้งจอ กดอะไรไม่ได้ทั้งแอป**
   **เช็คทุกครั้งที่ย้ายอะไรออกจาก `.pane`: ลูกที่เป็น absolute มีตัวยึดใหม่หรือยัง**
   (`#net-body` / `#gal-body` มี `position:relative` อยู่แล้วจึงรอด — `#planner-body` ตกหล่นตัวเดียว)
   · **วิธีพิสูจน์โดยไม่ต้องเปิดแอป**: ทำหน้า HTML ที่จำลองสายพ่อ-ลูกให้ตรงกับของจริง
   (ต้องมี `#split-root` ที่ positioned อยู่ชั้นนอก **และช่องแผงที่ไม่ positioned**) แล้ววัด
   `getBoundingClientRect()` เทียบกัน — harness ที่ตัวช่องแผงเป็น `position:absolute` เองจะ
   **บังบั๊กหมด** เพราะกลายเป็นตัวยึดให้ซะเอง (เผาไปหนึ่งรอบกว่าจะรู้)

98. **[alpha.64] re-render ระหว่าง `mousedown` = ทำลาย drag/resize ที่กำลังจะเริ่ม** ⚠
   `renderFloatPanel` มี capture listener บน `pop` เรียก `_toFront()` ทุก mousedown →
   `setFloats()` → `_emit()` → วาดใหม่ทั้งชุด → `pop` ที่ `makeFloatDraggable`/`makeResizable`
   ถือ reference อยู่ **หลุดจากหน้า** · อาการ: ลากไม่ไป · ปล่อยแล้ว `offsetLeft/Width` = 0
   → แผงเด้งมุมซ้ายบน ขนาดรีเซ็ต · `stopPropagation()` ในตัว grip ก็ช่วยไม่ได้เพราะ capture
   ของ **ancestor ยิงก่อน**
   **กฎ: อะไรที่เกิดตอน mousedown ห้าม re-render — เปลี่ยน z-order ด้วยการย้าย DOM
   แล้วบันทึก state แบบไม่ notify (`setFloatsQuiet`)** · และกันพลาดด้วย `if (!el.isConnected) return`
   ก่อนเขียนพิกัดใน `up()` เสมอ

99. **[alpha.64] "ลบแล้วกู้คืนได้" ต้องมี sidecar เสมอ — ไม่งั้นตกไปเข้าเงื่อนไข else ที่ผิด**
   `deleteAlbum`/`deleteImage` ย้ายของไป `Recycle/` แต่ไม่เขียน `.k2restore.json`
   `restoreFromTrash` หาไม่เจอก็ไล่ต่อจนตกท้ายสุด — บรรทัดที่คอมเมนต์ว่า "`.md` → Memos"
   แต่**ไม่ได้เช็คนามสกุลจริง** → `sunset.png` ถูกโยนเข้า `Memos/`
   **เพิ่มชนิดของที่ลบได้เมื่อไร ต้องเพิ่ม `kind` ใน sidecar + สาขาใน `restoreFromTrash` พร้อมกัน**
   · และ **else สุดท้ายควรเป็น "ไม่รู้จัก → ไม่ทำอะไร + แจ้ง"** ไม่ใช่เดาว่าเป็น memo

100. **[alpha.64] บันทึก state ทุกโหนดหลังจัดผังอัตโนมัติ = ล็อกตัวเองถาวร**
   Story Network `savePositions(this.nodes)` เรียกทันทีหลัง `forceLayout` → รอบเปิดถัดไป
   **ทุกโหนดมีตำแหน่งบันทึกไว้ = ถูกปักหมุดหมด** → `forceLayout` กลายเป็น no-op ตลอดกาล
   และปุ่มรีเซ็ตรีเซ็ตแค่กล้อง ไม่มีทางสั่งจัดใหม่ได้เลย
   **กฎ: บันทึกเฉพาะสิ่งที่ "ผู้ใช้ตั้งใจกำหนดเอง" (ลากเอง) — ผลลัพธ์ที่อัลกอริทึมคำนวณได้เองห้ามบันทึก**
   · และคู่กับมันต้องมีทางถอย ("ปลดหมุดทั้งหมด แล้วจัดใหม่") เสมอ
   · localStorage ที่เก็บ layout **ต้องแยกตามโปรเจกต์** (`key:<hash ของ root>`) ไม่งั้นโปรเจกต์
   ที่มีชื่อเอนทิตี้ซ้ำจะยืมตำแหน่งกันมั่ว

101. **[alpha.64] ตัวแปรที่อ่านค่าตั้งค่ามา แล้วโดนเขียนทับด้วยค่าคงที่ในบรรทัดถัดไป**
   `draw()` ของ Story Network: `const color = this._edgeCol[e.type] || '#4a4842'` แล้วบรรทัดถัดมา
   `if (e.type==='co-occur') { color='#8a8885'; … }` **ทับทั้ง 3 ชนิดที่หน้าตั้งค่าเปิดให้ปรับพอดี**
   → ผู้ใช้ปรับสีแล้วไม่มีอะไรเกิดขึ้น หาสาเหตุไม่เจอเพราะโค้ดอ่านค่ามาแล้วจริง ๆ
   **เวลาเพิ่ม "ให้ผู้ใช้ตั้งค่าได้" ต้องไล่หาทุกจุดที่ hard-code ค่าเดิมแล้วลบทิ้ง ไม่ใช่แค่เพิ่มที่อ่านค่า**
   · คู่กัน: ตัวอ่านค่า (`readColors()`) ถูกเรียกแค่ตอน constructor → กด Save แล้วต้องรีสตาร์ท
   **ทุก "ตั้งค่าได้" ต้องมีทางให้ค่าใหม่ไหลถึงที่ใช้จริงทันที**

102. **[alpha.64] AI ที่ "แก้ไฟล์ได้" ต้องเขียนไฟล์เอง — เรียกฟังก์ชันของ UI ไม่ได้**
   `addScene`/`addChapter`/`addSection`/`addEntity` ทุกตัวเปิดกล่อง `ask()` ถามชื่อเสมอ →
   สั่งจากโค้ดไม่ได้เลย · `ai-actions.js` จึงเขียน `draft.json`/`scenes.json`/`section.json`/
   `.md` frontmatter เองตามรูปแบบเดิมเป๊ะ ๆ
   **บทเรียนกว้าง: ถ้าอยากให้ automation ใช้ logic เดิมได้ ต้องแยก "ตัวถามผู้ใช้" ออกจาก "ตัวทำงาน"
   ตั้งแต่แรก** — ไม่งั้นได้โค้ดคู่ขนานที่ต้องดูแลสองที่ (ตอนนี้เป็นแบบหลัง — ถ้ารูปแบบไฟล์เปลี่ยน
   ต้องแก้ทั้ง `scene-ops.js` และ `ai-actions.js`)
   · **ไม่ใช้ function-calling ของ API** เพราะผู้ใช้ต่อ provider เองได้ทุกเจ้า รองรับไม่เท่ากัน
   → โปรโตคอลข้อความ (บล็อก ` ```k2 ` + JSON) ใช้ได้กับทุกโมเดลที่พิมพ์ JSON เป็น
   · ต้องกัน ` ```json ` ที่เป็น**ตัวอย่างข้อมูลเฉย ๆ** ไม่ให้ถูกนับเป็นคำสั่ง (เช็คว่า `tool` มีจริงในทะเบียน)

103. **[alpha.64] `newSession(j)` ที่ประกอบ object ใหม่ทีละฟิลด์ = ฟิลด์ที่ลืมใส่หายเงียบ**
   `titleSet` (ธง "ผู้ใช้ตั้งชื่อเอง") ไม่ถูกขนกลับมา → ตั้งชื่อเซสชันเอง ปิดเปิดโปรแกรม ธงหาย
   ข้อความถัดไปทับชื่อทันที และ "เริ่มใหม่" ก็รีเซ็ตชื่อทิ้ง · **บั๊กแบบนี้ไม่โผล่ใน session เดียว
   ต้องเทสวงจร save → load → ใช้งานต่อ**
   · คู่กัน: อย่าเขียนไฟล์ตั้งแต่ "กดสร้าง" — เขียนตอน**มีเนื้อหาจริง** ไม่งั้นกดเล่นสิบทีได้ขยะสิบไฟล์
   (ธงภายในอย่าง `_draft` ต้องถอดออกก่อน `JSON.stringify` ด้วย)

78. **[alpha.61] ไฟล์ที่ working tree เป็น CRLF ทั้งไฟล์ ทำให้ diff จริงถูกกลบ**
   `main.js` ถูกบันทึกเป็น CRLF มาก่อนเริ่มงาน → `git diff --stat` ขึ้น 766+/766- ทั้งที่ไม่มีอะไรเปลี่ยน
   **เช็คด้วย `git diff -w --stat` ก่อนเสมอ** ถ้าเหลือ 0 = whitespace ล้วน → `perl -i -pe 's/\r\n/\n/g'` แล้วค่อยแก้จริง

---

## Build recipes (app ไม่ต้องมี node_modules ตอน runtime — main/preload ใช้แค่ electron+fs/path/url, bundle.js มี prosemirror ครบ)

Electron **43.1.1**. github (allowlist: github.com + release-assets.githubusercontent.com):
`https://github.com/electron/electron/releases/download/v43.1.1/electron-v43.1.1-<PLATFORM>.zip`
PLATFORM = `win32-x64` / `darwin-arm64` / `darwin-x64`

**macOS Intel DMG** (alpha.60r2 · **ยืนยันแล้วบนเครื่อง Top ที่ alpha.61**):
```bash
npm run dist:mac        # = node build.js && electron-builder --mac dmg --x64
git checkout HEAD -- package.json   # ⚠ ดูกับดักข้างล่าง — ต้องทำทุกครั้งหลัง build
# ผลลัพธ์: dist/Killian2-<version>-mac-intel.dmg (~127MB) + dist/mac/Killian 2.app
file "dist/mac/Killian 2.app/Contents/MacOS/Killian 2"   # ต้องเห็น "Mach-O 64-bit executable x86_64"
npx asar extract-file "dist/mac/Killian 2.app/Contents/Resources/app.asar" package.json  # verify version
```
> ⚠ **กับดัก [alpha.61]: `electron-builder` เขียนทับ `package.json` แล้วลบ `scripts`/`devDependencies`/`build` ทิ้ง**
> เกิดที่ขั้น "installing native dependencies" (`@electron/rebuild` รัน npm install ใน appDir)
> → หลัง build `npm run test:unit` / `npm run dist:mac` จะพังทันทีเพราะไม่มี `scripts` แล้ว
> **แก้: `git checkout HEAD -- package.json` ทุกครั้งหลัง build** (commit ก่อน build จะปลอดภัยที่สุด)
`build.mac` ใน package.json ตั้ง `identity:null` + `hardenedRuntime:false` + `gatekeeperAssess:false`
(ยังไม่มีใบรับรองนักพัฒนา) → **ผู้ใช้ต้องคลิกขวา → Open ครั้งแรก** ไม่งั้น Gatekeeper บล็อก
ยังไม่มีไอคอน `.icns` — electron-builder ใช้ไอคอนมาตรฐานของ Electron ไปก่อน

**Windows portable** (~139MB, top folder K2WIN/) — electron runtime cache ที่ `/home/claude/work/build_win/K2WIN` ใช้ซ้ำได้ (แค่รีเฟรช resources/app):
```bash
cd /home/claude/work/build_win/K2WIN; SRC=/home/claude/work/v2_extract/Killian2
rm -rf resources/app && mkdir -p resources/app
cp $SRC/main.js $SRC/preload.js $SRC/package.json resources/app/; cp -r $SRC/renderer $SRC/src resources/app/
# ครั้งแรกเท่านั้น: rm -f resources/default_app.asar; mv electron.exe Killian2.exe
# rm -f zip && cd .. && zip -qr K2WIN  (+ อ่านก่อน.txt)  — verify version ในซิปก่อน copy
```

**macOS .app** (arm64/x64):
```bash
cp main.js preload.js package.json Electron.app/Contents/Resources/app/; cp -r renderer src ...
rm -f Electron.app/Contents/Resources/default_app.asar
# Info.plist: CFBundleName/DisplayName='Killian 2', CFBundleExecutable=Killian2, CFBundleIdentifier=com.topgraphix.killian2
mv Contents/MacOS/Electron Contents/MacOS/Killian2; mv Electron.app 'Killian 2.app'
zip -qry out.zip 'Killian 2.app'           # -y สำคัญ! เก็บ 14 Framework symlinks
```
**CAVEAT macOS**: แก้ plist+rename binary ทำลาย signature. Apple Silicon **บังคับ** signature → build บน Linux รันไม่ได้จนผู้ใช้รันบน Mac: `xattr -cr 'Killian 2.app'` แล้ว `codesign --force --deep --sign - 'Killian 2.app'` (ใส่ใน วิธีเปิดบน-macOS.txt). **`.dmg` สร้างบน Linux ไม่ได้**. Intel(x64) bypass ง่ายกว่า arm64

**Verify เสมอ**: unzip ใหม่ → `ln -s <real>/node_modules node_modules` → build → e2e ALL OK ก่อน ship → `/mnt/user-data/outputs/` + `present_files`

---

## ระบบสำคัญ + จุดต่อ

- **ชุด PDF (alpha.59)**: `pdf-ui.js` — เมนู **ไฟล์** และ **บท** มี 3 รายการ
  (`export-pdf-builtin` · `title-pages` · `page-headers`) · **`buildScriptPdf()` เป็นจุดเดียว**
  ที่ทั้งกล่องส่งออก เวิร์กโฟลว์ (`ext: 'pdf'`) และ e2e เรียก — เพิ่มฟีเจอร์ PDF ให้ต่อที่นี่
  · ไบต์ PDF ต้องเขียนด้วย `kapi.writeBytes(dest, Array.from(bytes))` (กฎ 10 — `writeFile` ทำไบนารีบวม)
- **ตั้งค่า**: `settingsDialog(tab?)` แท็บ ทั่วไป/การเขียน/อัตโนมัติ/ข้อมูลผลงาน/**หน้ากระดาษ**/**📖 รูปแบบนิยาย**/🎬 รูปแบบบท/ปุ่มบทหนัง/ฟอนต์ตามภาษา/ภาษา/ปุ่มลัด → `project.khn.json` ผ่าน `saveProjectMeta()`
  · **`uiFontSize` = ขนาดตัวอักษรของเปลือก UI เท่านั้น** (`--ui-fs`) — ห้ามเอาไปบวกกับ `--ed-fs/--sp-fs` อีก (บั๊ก 14)
  · รูปแบบนิยายเก็บก้อนเดียวที่ `settings.prose` (ดู `prose-format.js`) · `settings.mdAlignStyle` = `'frontmatter'` (ค่าเริ่มต้น) | `'comment'` (แบบ v1)
- **คอนโซลนักพัฒนา (alpha.58r)**: `openDevConsole()` + `aboutDialog()` ใน app.js — เมนู **ช่วยเหลือ** + **Ctrl+Shift+`**
  · `devApi()` คือของที่ให้ใช้ผ่านตัวแปร `k2` — เพิ่มฟีเจอร์ใหม่แล้วควรเพิ่ม accessor ที่นี่ด้วย
- **ปุ่มลัดตั้งเอง**: `onShortcut()` วน `effectiveShortcuts()` = `SHORTCUTS` merge `settings.shortcuts[id]` (id=channel+args). แท็บ "ปุ่มลัด" อัดคีย์ (บังคับ Ctrl/⌘), `accelText` แสดง ⌘⇧ บน mac
- **ตรวจคำผิด**: 2 ชั้นผสมได้ — `spellCheck` (Chromium อังกฤษ) + `spellCheckDict` (spell.js ไทย+อังกฤษ, decoration `.k-spell-bad`). dict แยกไฟล์ (assets + `Plugins/dictionaries/*.txt` + `dictionary.json`). คลิกขวาคำแดง→เพิ่มคำ
- **SmartType บทหนัง** (Final Draft): `spSmartCheck` + `screenplayTerms(tab)` สแกน sp doc เก็บ character/location ที่พิมพ์ในบทเอง รวม SCENE_PREFIX/TIMES/TRANSITIONS
- **relationship**: `relationDialog` (target dropdown + role datalist) → `_syncInverse` เขียนฝั่งตรงข้าม (`invertRole` ใช้ `INV` cache, ต้อง `warmInverse()`) + คลิกชื่อ→`onOpenEntity`. `reloadIfExists()` รีเฟรชแท็บเปิดค้าง
- **Wiki images**: เพิ่มจากไฟล์ หรือ **เลือกจากคลัง** (`pickFromGallery`→pickImage). คลิกรูป→`imageLightbox`
- **Explorer**: `buildTree()` — sections→chapters→scenes(สี/สถานะ/⭐flag/#tags) + Memo + Wiki + ถังขยะ. `#tree-search`→`filterTree(q)` (ชื่อ/แท็ก/สถานะ). scene มี `title` tooltip (hover) + `dataset.search`
- **Panel System (alpha.46, Photoshop-style)** — ทุกพื้นที่ของหน้าต่างคือแผงในต้นไม้เดียว วาดลง `#app-root`
  - `panel-ui.js` = `initPanelSystem()` (เรียกใน DOMContentLoaded) · `PANEL_DEFS` 6 แผง: `toolbar`/`tree`/`outline`/`docs`/`props`/`statusbar`
    · `showPanel/hidePanel/togglePanel/resetPanels/panelMenuItems/panelToggleState/isPanelOpen` · `ALIAS` แปลงชื่อเก่า (`tree-panel`→`tree`)
    · **`addPanelButton(id, el)`** = ฝากปุ่มบนหัวแผง (element เดิมถูกใช้ซ้ำทุก render จึงไม่เสีย onclick)
  - `panel-renderer.js` = `renderPanelLayout` → dock/tabs/panel/float + `createResizeHandle` + `markDocsChain`
  - `panel-drag.js` = `detectSnapTarget` (ใบเล็กสุดที่ครอบจุด = ลึกสุด) → overlay `.k-drop-zone` → `dockPanel`/`floatPanel`/`moveTab`
  - **เนื้อแผง = element เดิมใน index.html** (`#tree-panel` `#outline-panel` `#props-panel` `#content` `#toolbar` `#statusbar`)
    พักอยู่ที่ `#k-panel-src` (hidden) แล้วถูก "ย้าย" เข้าแผง — **ห้ามสร้างใหม่** (ทั้งโปรเจกต์อ้าง `#panes` `#tabs` `#tree` `#props-body`)
  - โหมดอ่าน/โฟกัส/พิมพ์: ซ่อน `.k-dock > *:not(.k-holds-docs)` (ไม่มี `#sidebar` แล้ว)
  - **`FEATURE_PANELS` ใน app.js = ตารางที่บอกว่า "แผงไหนวาดด้วยฟังก์ชันอะไร"**
    · **[alpha.62 บั๊ก 18+20] แผงที่ไม่อยู่ในตารางนี้ = กล่องเปล่าถาวร** — `search`/`notes` มีตัววาดครบ
      ตั้งแต่ .40 แต่ไม่เคยถูกใส่ → เปิดจากปุ่ม/ถาดแผง/เลย์เอาต์ที่กู้มา ไม่มีอะไรวาดให้เลย
      (มีทางเดียวที่เคยวาดคือคำสั่งในเมนูที่เรียก `renderXxxPanel()` เองตรง ๆ)
      **เพิ่มแผงใหม่ = เพิ่ม 3 ที่เสมอ: `PANEL_DEFS` + markup ใน index.html + `FEATURE_PANELS`**
    · `clearFeaturePanels()` ล้างเนื้อแผงตอนเปลี่ยนโปรเจกต์ — **ยกเว้น `#notes-body`**
      (สมุดโน้ตด่วนเป็นของผู้ใช้ ไม่ผูกโปรเจกต์ · และตัววาดมีธง `dataset.ready` —
      ล้างเนื้อแต่ไม่ล้างธง = ได้กล่องเปล่าถาวร)
- **Floating format bar**: `setupFloatingFormatBar()` ย้ายปุ่มจัดรูปแบบ (id เดิม + #tb-source) เข้าแถบลอยใน #content. dblclick grip=reset. `syncFloatBarVisible()` ใน refreshToolbar
- **UI layout persist**: localStorage `k2-ui-layout` (ก้อนเดียว) ผ่าน `uiLayout()/saveUiLayout()`
- **สลับนิยาย↔บทหนัง**: `switchFormat()` — ใช้ `tab.body` verbatim ตอน !dirty (fountain round-trip ข้าม grammar ไม่ได้)
- **snapshot**: auto-backup ตอน saveTab → `Snapshots/` (ts เป็น ms กันชน), pruneSnapshots เก็บ maxBackups ที่ไม่มี label
- **คอมเมนต์ (alpha.48)**: แผง `comments` ← `comments/comment-ui.js` (`renderCommentPanel(host)`) บนเอนจิน `comment-core.js`
  (`CommentStore` · `addComment/replyTo/resolveComment/editComment/deleteComment/reanchorAll`). เก็บ **ท้ายไฟล์ `.md`**
  ในบล็อก `<!-- k2-comments … -->` — `parseMdFile` ตัดทิ้งให้อัตโนมัติ, **`saveTab` ต้องเขียนผ่าน `writeKeepingComments()`**
  (ดูบทเรียนข้อ 30). สมอไฮไลต์ในตัวแก้ไขผ่าน `commentAnchorPlugin()` ใน editor.js (ใช้ทั้ง KEditor/SPEditor)

### ระบบใหม่ (alpha.30–37 — Storyteller-inspired)

- **เวิร์กโฟลว์ส่งออก (compile)** — ไฟล์→ส่งออกด้วยเวิร์กโฟลว์ (Ctrl+Shift+E). `openCompileDialog()` ใช้ `buildDraftModel(dPath,title)` (แชร์กับ `compileDraftText`/`exportDraft`). พรีเซ็ต builtIn แก้ไม่ได้ (ต้อง clone). เก็บใน `project.khn.json→compileWorkflows`. ตรรกะอยู่ `compile.js` (`runWorkflow`)
- **หมวด Wiki สร้างเอง** — `wikiCats:[{key,label,icon}]` ใน project.khn.json. `BUILTIN_CATS`=[characters,locations,items,lore] ลบไม่ได้. `newWikiCat/editWikiCat/deleteWikiCat` (กันลบหมวดที่มีของ), `applyWikiCats()` ยัด label ไทยเข้า `CAT_TH`, `catLabel/catIcon`. buildTree + template manager รวมหมวดเอง
- **แดชบอร์ด analytics** — `renderDashboard` เก็บ byStatus + chapterWords, `statBars()` วาดแถบสัดส่วน (สถานะฉาก / Wiki ตามหมวด / ความยาวบท)
- **จัดการเล่ม (Book Manager)** — `openBookManager()` tab `::books::`. การ์ดต่อเล่ม: ปก(pickImage→`section.json→cover` เป็น `../Images/<f>`), ชื่อแก้ inline, สถานะ(`SECTION_STATUSES`), คำโปรย, สถิติ(`sectionStats()`), ลากสลับลำดับ(`reorderSections()`). helpers: `listSections()/saveSectionMeta()`. section.json มี title/order/status/cover/blurb
- **เส้นเวลา (Timeline)** — `openTimeline()` tab `::timeline::`. **2 มุมมอง สลับได้** (`state._tlView` cards/gantt): (1) การ์ด = เลนตาม track เรียงตามเวลา; (2) **Gantt** = แท่งตามช่วงเวลาบนแกน (`ganttData/ganttBar/ganttTicks` ใน timeline.js) ใช้ `whenEnd` เป็นจุดจบแท่ง. `sceneEventsFromProject()` ดึงฉากที่มี `storyDate` (ตั้งใน sceneProps ทั้ง dialog+panel) มาแสดงอัตโนมัติ. event เอง→`timeline.json`. `eventDialog()` (title/when/whenEnd/track/sort/desc). ตรรกะ `timeline.js`. **ระวัง: `mergeTimeline` ต้อง copy ทุก field ที่มุมมองใช้** (เคยลืม whenEnd → Gantt แท่งกลายเป็นจุดหมด)
- **แผนที่ (Maps)** — `openMaps()` tab `::maps::` (state ใน `mapsState`). รูปเป็นแผนที่, คลิกปักหมุด (พิกัด %), หมุด 3 ชนิด entity/portal/note, ลากย้ายได้. portal = ลำดับชั้น world→city→room + breadcrumb. `pinDialog()`. เก็บ `maps.json`. ตรรกะ `maps.js`
- **โหมดหน้ากระดาษ (paper mode)** — `togglePaper()` + `body.paper-mode` (ค่าเริ่มต้นเปิด, เก็บใน settings). กระดาษครีม `--paper:#f5f1e6` (ปรับได้), นิยาย+บทหนังใช้กรอบเดียวกัน. ปุ่ม 📄 `#tb-paper` (ไม่ disable ตอนไม่มี editor)
- **ซูมหน้ากระดาษ (alpha.47 — ซูมจริง)** — `pageScale` (`SCALE_MIN/MAX` 0.5–2.5), `applyZoomVars(off)` set `--ed-fs`/`--sp-fs` (ฟอนต์ฐาน+ค่าที่ตั้ง **ไม่คูณซูม**) + `--page-scale`; CSS ซูมด้วย **`zoom` property** ที่ `.pane > .ProseMirror` → ฟอนต์/padding/margin/ความกว้างขยายพร้อมกัน (max-width คงที่ 940px). ห้ามใช้ `transform:scale` (พิกัดคลิก/selection/scroll พัง) · **ห้ามใส่ `role:'zoomIn/zoomOut/resetZoom'` ของ Electron กลับเข้าเมนู** (zoom ระดับ webContents ซ้อนทับจนเพี้ยน) · slider ล่างขวาใน statusbar (`#zoom-slider/#zoom-label`) + Ctrl+ล้อ/=/-//Shift+0. **font preview ในตั้งค่าต้องเรียก `applyZoomVars(val)`** · **เทสในซับทรีที่ถูก zoom ต้องวัดด้วย `getBoundingClientRect()` ไม่ใช่ `getComputedStyle().maxWidth`**
- **ขนาด UI (alpha.47)** — `settings.uiScale` (`UI_SCALE_MIN/MAX` 0.75–2.0) → `applyUIScale(v)` ตั้ง `--ui-scale`. style.css: `body{font-size:calc(14px*var(--ui-scale))}` (ปุ่ม/select/input ใช้ `font:inherit` จึงไล่ตาม) + font-size ทุกกฎของเปลือก UI เป็น `calc(px*var(--ui-scale))` + **บล็อกท้ายไฟล์** เก็บขนาดโครงสร้าง (titlebar/toolbar/แท็บ/หัวแผง/statusbar/dialog/tree/FAB) ผ่าน `var(--uis)`. เพิ่มของใหม่ที่ต้อง scale → เติมในบล็อกนั้น. เส้นขอบ 1px + max-width หน้ากระดาษ = **ไม่ scale**. เข้าถึงได้ที่ ตั้งค่า→การเขียน (`#st-uiscale`) และเมนู มุมมอง→ขนาด UI (`send('ui-scale', 1/-1/0)`)
- **จัดหน้า (align)** — attr `align` บน paragraph/heading (prose) + sp node. `cmd('align',dir)` ทั้ง 2 editor, ปุ่ม `#tb-align-*` + Ctrl+Shift+L/K/R/J. prose persist เป็น `<!--align:x-->` นำหน้าบล็อก (md.js, v1 เปิดได้). **บทหนัง align = session-only** (ไม่ persist กันพัง fountain round-trip)
- **screenplay indent** — margin sp element เป็น % (`.sp-character 38%`, dialogue 19%, parenthetical 29%) scale ตามซูม. `classify()` character auto-detect รับชื่อผสมพิมพ์เล็ก/ไทย (ไม่บังคับ ALL-CAPS)

---

## เวอร์ชัน (ล่าสุด **alpha.66r** · e2e ALL OK + unit 37 ไฟล์ผ่านครบ · `npm run test:unit`)

**.66r** — เก็บบั๊ก UI ผังแตกสาย 5 ข้อ · **บทเรียนใหม่ที่ต้องจำ 3 ข้อ**:
1. **เนื้อแผงห้ามยืมคลาส `k-dlg-*` ของกล่องโต้ตอบ** — แผงที่ "ปิดอยู่" ยังคาใน `#k-panel-src`
   (ซ่อน แต่ยังอยู่ในเอกสาร) → `document.querySelector('.k-dlg-input')` คว้าของในแผง แทนของในกล่อง
   ทำให้กล่องเพิ่มฉาก/เปลี่ยนชื่อเล่มพังทั้งชุด · ใช้ `.k-field-input`/`.k-field-select` แทน
   (บทเรียนข้อ 10 เดิมพูดถึงแค่ `.k-ok` — จริง ๆ ครอบทุกคลาสของกล่อง)
2. **ห้ามใช้ `100vh` ในเนื้อแผง** — แผงไม่ได้สูงเท่าหน้าต่าง · และต้องถอด `padding`/`overflow`
   ของ `.k-panel-body` ด้วย `:has()` เหมือน `#net-body` ไม่งั้น "เนื้อไม่เต็มแผง + แถบเลื่อนซ้อนสองชั้น"
3. **วาดใหม่ต้องสลับทีเดียว** — `innerHTML=''` แล้วค่อย `await` อ่านไฟล์ = แผงว่างเปล่าให้เห็น
   (อาการ "UI กระพริบ") · แยก "วาดใหม่เพราะข้อมูลเปลี่ยน" ออกจาก "วาดใหม่เพราะมุมมองเปลี่ยน"
   + จำตำแหน่งเลื่อน + `scrollIntoView` เฉพาะตอนตัวที่เลือกเปลี่ยนจริง


**.66** — **ยกเครื่องระบบเรื่องแตกสายทั้งชุด (17 ข้อ)** · ผังเลิกเป็นแท็บเอกสาร → **แผง `branch`**
(+ แผงใหม่ `player` = โหมดทดลองเล่น) — ปิดวงเรื่อง "ไม่เหลือแท็บเทียม `::xxx::`" ที่ค้างมาตั้งแต่ .62 ·
แถบเพิ่มทางเลือกขึ้นบน ผังลงล่าง · ตัวหนังสือผูก `--ui-scale` ทุกจุด · ป้ายทางเลือกมีแถบรองพื้น
(`getBBox()` จริง) และอยู่กึ่งกลาง **เส้นโค้ง** (t=0.5 ของ Bézier) · เลือกสีการ์ด/เส้นได้ ·
ลากย้ายการ์ดได้ (จำใน localStorage แยกตามโปรเจกต์) · `refineLayout` แก้เส้นไขว้/โหนดทับ ·
`enumeratePathsInfo` เลิกตัดเงียบ ๆ + ปุ่ม "ดูทั้งหมด" · `validateChoices` เตือนตอนเปิดโปรเจกต์ ·
`highlightPath` · ลากย้ายทางเลือกข้ามฉาก + รวมทางเลือกซ้ำ · ค้นหา/กรองในผัง ·
**ส่งออก 5 แบบ** (HTML tree/Markdown outline/JSON/SVG/PNG) · **`playthroughs[]`** เก็บเส้นทางแต่ละรอบ ·
i18n ครบ (`branch` 144 + `player` 34 คีย์ ทั้ง th/en) · unit 53→118 · e2e +49

**.65** — ยกเครื่อง Planner (กระดานแบบ Miro) + รอบเก็บบั๊ก r–r8 (ดู CHANGELOG)

**.64** — **AI ลงมือทำเองได้** (`ai-tools.js` + `ai-actions.js` · 15 คำสั่ง · 3 โหมด read/write/full ·
วนรอบ สั่ง→ทำ→ป้อนผลกลับ สูงสุด 5 รอบ) · **transcript view 4 แบบ** (ปกติ/ความคิด/ละเอียด/สรุป
· `parseThinking()` อ่านความคิดได้ทุกสำนวน provider) · เซสชันแชทเกิดเป็นไฟล์เมื่อเริ่มคุยจริง +
แก้ `titleSet` หายตอนโหลดกลับ · **Planner ที่บังทั้งจอ** (บทเรียน 97) · **แผงลอยลากไม่ไป/เด้งมุมซ้ายบน**
(บทเรียน 98) · **ลบรูป/อัลบั้มแล้วกู้คืนไปโผล่ Memos/** (บทเรียน 99) · Story Network 7 จุด
(ผังแข็งถาวร · ตำแหน่งข้ามโปรเจกต์ · สีที่ตั้งไม่มีผล · ชื่อซ้ำชนกัน · `_hit` ไม่ตรง filter ·
โค้ดตาย `network-toolbar.js` — บทเรียน 100–101) · กระดานอารมณ์เต็มแผง · คลังรูป/แดชบอร์ดเลิกค้าง
(stat เป็นชุดละ 32) · เทสใหม่ `ai-tools.test.cjs` (64) + `network-layout.test.cjs` (18) + album +9 + e2e +6

.13–.22 (v1→v2 พื้นฐาน): snapshot, line numbers, spellcheck ไทย+Chromium, ปุ่มลัดตั้งเอง, mac build, บทหนัง Ctrl+arrow, relationship sync, floating format bar, sidebar resize, SmartType Final Draft, wiki gallery/lightbox, explorer search+tags, panel docking, tree float+snap
.24 batch 8 (drag-move explorer, panel snap, split compare, version tracking, scene lock, screenplay Final Draft look, screenplay images, wiki links) · .25–.27 **Planner board** (fabric.js) · .28 **floating windows** · .29 memo-in-chapter + scoped search
.30 **compile workflows** + **หมวด Wiki สร้างเอง** + **dashboard analytics** · .31 section mgmt + wiki field-linking + explorer flicker fix + ctrl-wheel zoom + page align + screenplay smart-type fix · .32 **Book Manager** · .33 **paper mode** · .34 กระดาษครีม + unified display + wiki-link ทุก sp block · .35 real page-zoom + zoom slider + screenplay indent fix · .36 **Timeline** · .37 **Maps** (world→city→room) · .38 **Gantt view** ในเส้นเวลา
.39 **Phase 1** (save-all/log system+viewer/explorer accordion/dirty badge/floating-bar reorder) + **แยก app.js → core.js + 11 feature modules** (มี AGENTS.md ให้ opencode) + **3 เอนจินบริสุทธิ์ใหม่**: full-text **search-engine** (inverted index, ค้น 1k ไฟล์ ~16ms) · **Panel System** docking (panel-layout/store) · **Split View** (split-layout) — logic+unit test เสร็จ, UI ส่ง opencode ทำต่อ
.40 **รอบเก็บกวาดฟีเจอร์ชุด deepseek (19 โมดูล)** — เดิม 13 โมดูล import แล้วไม่มีเมนู/ปุ่มเรียก + อีกหลายตัวพังจริง
  ต่อเมนู/คำสั่งครบ · แก้คีย์ลัดชน (Ctrl+Shift+F ยิง 3 คำสั่ง, Ctrl+P ยิง 2) → **Ctrl+Shift+F**=ค้นทั้งโปรเจกต์ · **Ctrl+Shift+D**=โฟกัส · **Ctrl+Shift+O**=quick open
  แก้: focus/typewriter (`.closest()` บน text node → ไม่เคยทำงาน) · zip+backup (utf-8 ทำไบนารีพัง → `kapi.readBytes/writeBytes/copyFile`) ·
  คอมเมนต์ (push ใส่อาร์เรย์ทั้งบทแทนแถวฉาก → หาย) · custom status (ไม่โผล่ที่ไหน + `confirmBox` ไม่ import) ·
  export-blog (md ดิบ → ใช้ `mdToHtmlBody` ใหม่ใน compile.js) · quick-open (`kapi.relative` async → `[object Promise]`) ·
  branching (ไม่มีที่ไหนเขียน choices → เพิ่มแผงสร้าง) · floorplan (อิง field ที่ไม่มีจริง → อิง maps.json + `sceneCtx()`)
  ความปลอดภัย: API key → `ai-key.json` แยก · AI ผ่าน `kapi.httpFetch` (renderer โดน CORS) · เลิกใช้ innerHTML กับข้อความผู้ใช้ · ถอด iconify CDN · thesaurus ปิดเป็นค่าเริ่มต้น (อังกฤษเท่านั้น)
  helper ใหม่ใน app.js: `openPlainFile` · `sceneCtx` · `updateSceneRow` · `newProjectFromTemplate`
.41 รอบแก้บั๊กหลัง DeepSeek ต่อ UI (เปิดโปรแกรมไม่ขึ้น: import หาย · `t(undefined)` พัง · i18n เป็นอังกฤษหมด · เมนู id ไทย/อังกฤษไม่ตรง)
.42 **Advanced Storytelling UI (ข้อ 81–87)** — ของเดิมมีไฟล์อยู่แต่ใช้งานไม่ได้จริง
  **81 ผังแตกสาย**: เอนจินใหม่ `branch-graph.js` (บริสุทธิ์ + unit test 37) → วาด **SVG จริง** (กล่องจัดชั้น + เส้นโค้งมีลูกศร + ป้ายทางเลือก)
    · สีขอบบอกบทบาท (จุดเริ่ม/ตอนจบ/วนซ้ำ/เข้าไม่ถึง) · **แผง inspector** แก้ทางเลือกได้ในตัว · **⊞ = Split View** (ผังซ้าย ฉากขวา) · ย่อ/ขยาย/พอดีจอ
  **82 ผังพื้นที่**: ผูกฉาก↔หมุด (`sc.mapId`/`pinId` หรือ `pinX/pinY`) · หมุด **"คุณอยู่ที่นี่" เต้น** · **แถบเส้นเวลาของสถานที่** (เรียงด้วย `extractNum`) · breadcrumb · ลบ เห็น/ได้ยิน/พบ ทีละอันได้
  **83 ประวัติการตัดสินใจ**: `renderChoicePanel()`/`choiceStats()`/`choicesByCharacter()` → ฝังใน **แดชบอร์ด** + **หน้า Wiki ตัวละคร** (ไม่ใช่ซ่อนในเมนู)
  **84 Visual Tags**: `applyVisualTagStyle()`/`renderAllTagChips()` → **Explorer** (ชิปสี, คลิก=กรอง) · **แถบตัวกรอง** (ชื่อจริงใน `dataset.tag` กันไอคอนปนคิวรี) · **Planner** (ไอคอน+สีบนการ์ด) · **Network** (วงแหวนสีรอบโหนด)
  **85 โน้ตด่วน**: **ปุ่ม 📝 บน toolbar** (คลิกขวา = ดูทั้งหมด) · **"ไว้ทำภายหลัง" (Future Notes)** โผล่เป็นแผงค้างบน**หน้าเส้นเวลา** · การ์ดฉากติดป้ายจำนวนโน้ต
  **87 ศูนย์รวม**: เลิก `raw.includes(ชื่อ)` → **ใช้ Auto-link Engine** (รู้จัก aliases/ขอบคำ/นับครั้ง) · **real-time** ผ่าน `markCentralizeStale()` ใน `saveTab` + รีเฟรชตอนกลับมาที่แท็บ · การ์ดสถิติ · ชื่อฉากคลิกเปิดได้ · "🕳 ยังไม่ถูกกล่าวถึงเลย"

.43 **รอบแก้บั๊กจาก human test (16 ข้อ)** — ดู CHANGELOG เต็มใน `renderer/CHANGELOG.md`
  **1** โหมดอ่าน+กระดาษ = หมึกดำบนพื้นดำ (กฎ combo `body.reading-mode.paper-mode` + เลิกใช้ inline display)
  **2** วงกลมรูป Wiki อ่าน `images[0].url` แต่เก็บเป็น string → ไม่เคยขึ้นรูป · คลิกวงกลม=เลือกรูป · ☆/★ เลือกรูปประจำตัว
  **3** เมนู native ติ๊กถูกจริงผ่าน `kapi.menuToggles` → main สร้างเมนูใหม่ด้วย `type:'checkbox'/'radio'` · ปุ่ม `.tb-toggle` มีจุดบอกสถานะ
  **4+16** `.k-collapsed` กลืนหัวแผง → แผงหายถาวร · ปุ่มหัวแผงเรียง **[—ย่อ][▾พับ][📌ปัก][✕]** · ย่อ=ปุ่มลอยในถาด `#k-min-tray`
  **5** เหตุการณ์เส้นเวลามี `refs[]` (ฉาก/memo, path สัมพัทธ์) · `normalizeRefs` ใน timeline.js · ชิปคลิกเปิดไฟล์
  **6+11** Explorer หมวด 🖼 คลังรูป (thumb/ลาก/แทรก) + ปุ่ม 🔄 รีเฟรช
  **7** `activate()` เจอไฟล์ฝั่งขวา→`clearCompare()` ทิ้งแยกจอ → เปลี่ยนเป็น **สลับข้าง** · applyCompare ใช้ `syncSplitPanes` (ได้เส้นคั่น) · กระดาษหดตามช่องแคบ · ปุ่ม ⇋ เทียบด้านขวา ในกล่องประวัติเวอร์ชัน (`openSnapshotRight`)
  **8** เพิ่ม ↩ ย้ายกลับเข้าบท (memo) + 📄 กลับเป็นฉากปกติ (`setRowMemo(...,false)` เดิมไม่มีทางเรียก)
  **9** FAB z 50→76 + จำกัด float-win ที่ 60–74 · `pickDraftTarget()` เลือก เล่ม→ร่าง→บท ก่อนสร้าง
  **10** `fileVersionDialog(file,title,{onRestored})` ใช้กับไฟล์อะไรก็ได้ → Wiki มี 🕘/📸 + สำรองอัตโนมัติตอนบันทึก
  **12** Story Network ไม่เคยมีโค้ด pan + canvas ค้าง 300px (pane ซ่อนตอนสร้าง) → เพิ่ม pan/ResizeObserver/`focus()` refit/ปุ่มรีเซ็ต
  **13+14** `renderPropsPanel` async ซ้อนกัน → duplicate (แก้ด้วย `_propsGen`) · เปลี่ยนเป็น autosave debounce 600ms · ใช้ `allStatuses()`
  **15** ผังแตกสายผูกกับเนื้อเรื่อง: `scanChoiceMarkers`/`markerTexts`/`diffChoiceMarkers` ใน branch-graph.js · แผง "🔗 ทางเลือกในเนื้อฉาก" · ปุ่ม 🔎 สแกนทั้งโปรเจกต์ · เมนู `branch-sync` · `mutateChoices` ต่อคิวกัน race
  **16a** tooltip เอง `#k-tip` ลอย**เหนือ** pointer (ยืม `title` มาวาด แล้วคืนตอน mouseout)
  **ยังไม่ทำ**: "พื้นที่ทำงานเป็น floating panel" (ท้ายข้อ 16) — ต้องรื้อระบบ pane/แท็บทั้งชุด

.44 **เก็บงาน 7 ฟีเจอร์ปิดท้ายก่อนออกอัลฟา (65/66/68/69/70/77/78)** — ของเดิม "มีโค้ด+ต่อเมนูแล้ว" แต่ยังไม่ครบมุมใช้งาน
  **65 โฟกัส**: ความจางปรับเองได้ (`settings.focusDim` → CSS var `--fm2-dim`, สไลเดอร์ในตั้งค่า → การเขียน) ·
    **Esc ปักธงบนอีเวนต์** (`e._k2EscUsed`) กันโฟกัส+โหมดอ่านหลุดพร้อมกัน · มีกล่องเปิดอยู่ = Esc เป็นของกล่อง ·
    คีย์ลัดยืนยันที่ Ctrl+Shift+D (ไม่ย้ายกลับ Ctrl+Shift+F ที่เป็นค้นทั้งโปรเจกต์)
  **66 เครื่องพิมพ์ดีด**: `scrollHost(pm)` = `.pane` → ถ้าไม่มี ไต่หา `overflowY:auto/scroll` (หน้าต่างลอยเลื่อนตามได้แล้ว)
  **68 ส่งออกบล็อก**: `Ctrl+Shift+B` · กล่องตัวเลือก (ธีม medium/minimal/dark · หัวบท · หัวฉาก · **ฝังรูป base64**
    ผ่าน `kapi.readBytes`+`btoa`) · แยก `buildBlogHtml(opts)` ให้เทสตรงได้ · จำตัวเลือกที่ `meta.blogExport`
  **69 สถานะฉาก**: `statusColor(label)` = `meta.customStatusColors` → `STATUS_COLORS` (core.js) → สีกลาง —
    ใช้ร่วมกันทั้ง Explorer/Kanban/ตารางฉาก · `statusesToJson`/`importStatuses` (นำเข้า = รวม ไม่ทับ)
  **70 เปิดไฟล์ด่วน**: แคชระดับโมดูล (`quickOpenCache()`) + สแกนซ้ำพื้นหลังทุกครั้ง + ปุ่ม 🔄/Ctrl+R + แถบคำใบ้
  **77 AI สรุป**: `collectProjectText({onProgress,includeWiki})` (แยกออกมาเทสได้โดยไม่ยิง API) · กล่องความคืบหน้า ·
    รวม Wiki ผ่าน `listEntities` · **แคชด้วยแฮชเนื้อหา** (`hashText` djb2 → `meta.ai.summaryCache`, `summaryCacheState`)
  **78 AI ชื่อ**: คลิกขวาฉาก/บท → แนะนำชื่อ (ใช้ `setSceneTitle`/`setChapterTitle` ที่แยกออกจาก rename ที่ถาม) ·
    ประวัติ `meta.ai.titleHistory` (cap 50) + `pastTitlesFor(base)`
  อื่น ๆ: `dialog:saveAs` เลือกฟิลเตอร์ตามนามสกุล (เดิมบังคับ .md) · เพิ่ม `kapi.openFileDialog(kind)`

.45 **3 ฟีเจอร์เล่าเรื่อง**
  **ป้ายเล่าเรื่อง (Narrative Markers)**: `isFlashback`/`isFlashforward` ในคุณสมบัติฉาก (เลือกได้อย่างละหนึ่ง —
    กันชนทั้งตอน `change` และตอนบันทึก) · badge `.tree-flash` ⏪/⏩ ใน buildTree + tooltip · ซิงก์ frontmatter (เขียนเฉพาะตอน true)
  **ประเภทความสัมพันธ์ (Typed Relationships)**: `relationship-types.js` + `categories` ใน inverse_roles.json (`INV_C.cat`) ·
    `relationDialog` เพิ่ม `<select.rel-type>` **เดาจากบทบาทที่พิมพ์** (`typeTouched` = เลือกเองแล้วไม่เดาทับ) → คืน `{target, role, type}` ·
    `wiki.js` จุดสี `.rel-type-dot` + `_syncInverse` พา `type` ไปฝั่งตรงข้าม · `network.js` เส้นสีตาม `REL_COLOR` (ไม่ระบุ = `categorizeRole`)
  **บรรยากาศรับรู้ (Sensory Profiles)**: `sensory-profile.js` — หน้า Wiki หมวด locations เท่านั้น ·
    ต่อผ่าน `onRendered: (wrap) => { attachBacklinks(); renderSensoryProfile(...) }` ใน wiki-ui.js
  แก้บั๊กที่เจอระหว่างทาง: **`catIcon` คืนอีโมจิเก่า → `iconHtml` วาด svg ว่าง** (เพิ่ม `hasIcon()`) ·
    เทสโหมดโฟกัสวัด opacity ตอน transition ค้าง (ดูบทเรียน 14i-2)

.46 **Panel System แบบ Photoshop (UI จริง)** — ต่อเอนจิน `panel-layout/panel-store` เข้ากับ DOM
  ใหม่: `panels/panel-renderer.js` (วาด dock/tabs/panel/float + ที่จับปรับสัดส่วน + icon strip) ·
    `panels/panel-drag.js` (snap zone + ลากหัวแผง/หัวแท็บ) · `panels/panel-ui.js` (เขียนใหม่ · 6 แผง · ถาดเรียกแผงกลับ) ·
    `layout/split-ui.js` เพิ่ม `renderSplitTree`/`initSplitSystem` (recursive)
  ลบ System A ใน app.js: `PANELS`/`registerPanel`/`showPanel`/`resetPanels`/`panelMenuItems`/`makeFloatablePanel` ·
    `savePanelOrder`/`restorePanelOrder` · `setupSidebarResize` · `minTray/addTrayChip/removeTrayChip` · `#sidebar` หายทั้ง HTML/CSS
  บทเรียนใหม่ที่เจอตอนทำ → ดูข้อ 28–29 ด้านล่าง

.47 รอบแก้บั๊ก 5 ข้อ (แยกหน้าจอ · แผงลอยปรับขนาด · สัดส่วนแผง · ถาดแผงสองฝั่ง · แผงโผล่เอง) + ซูมจริง + ขนาด UI
.48 **Phase 6 — คอมเมนต์เป็นแผง (บั๊ก #25) + ค้นหาเอนทิตี้ Wiki ในฉาก (บั๊ก #21)**
  ใหม่: `comments/comment-ui.js` — แผง `comments` (เธรดซ้อน · resolve · แก้ในที่ · ตัวกรอง · สมอผูกข้อความ)
    ต่อกับ `comment-core.js` ที่เคยเป็น orphan · `openCommentsPanel()`/`refreshCommentsPanel()` ใน app.js
    (`activate()` + `saveTab()` เรียกให้ · `_cmMigrated` กันย้ายซ้ำต่อฉบับร่าง)
  เก็บท้ายไฟล์ `.md` (`<!-- k2-comments -->`) แทน scenes.json · `migrateSceneComments(dPath)` ย้ายของเก่าให้อัตโนมัติ
  `editor.js`: `commentAnchorPlugin()` + `setCommentAnchors/commentAnchors/refreshCommentAnchors`
    (decoration `.k-cm-anchor` — ใส่ทั้ง KEditor และ SPEditor · จับด้วย **quote ไม่ใช่ offset**)
  `md.js`: `parseMdFile` ตัดบล็อกคอมเมนต์ทิ้ง (จุดเดียว → ไม่โผล่ในตัวแก้ไข/ส่งออก/นับคำ/ค้นหา)
  `findEntityInScenes(path,name,x,y)` ใน app.js → คลิกขวาเอนทิตี้ Wiki ใน Explorer (ใช้ auto-link ที่มีอยู่)
  `popupMenu` รองรับ `{disabled:true}` (แถวหัวข้อ · `.k-menu-label`) — เดิมแถวไม่มี `click` จะ throw
  ลบ `src/comments.js` (ระบบเก่า) · บทเรียนใหม่ → ข้อ 30–31

**Storyteller Suite ครบแล้ว**: compile workflows · custom wiki categories · analytics · book manager · timeline (การ์ด+Gantt) · maps (portals) · branch tree · floor plan · centralize

.49 **Panel UX 2 เรื่อง** — เลิก min-tray → **Toolbar Toggle** (ปุ่ม `tb-toggle` 4 ตัวบน toolbar: tree/outline/props/search · มีจุด ● บอกสถานะ · sync ผ่าน `onPanelLayoutChange`) · **Panel Drag** แยก "ลากชื่อ" vs "ลากแท็บ" (`makePanelDraggable` เช็ค `.k-panel-head-title` → `floatOnly`; `makeFloatDraggable` dock เฉพาะ center zone)
.50 **Workspace Canvas Model** — แก้ซูมตัดบรรทัด: แทรก `.workspace {zoom; flow-root}` กั้นกลาง `.pane` กับ `.ProseMirror` → zoom แล้วได้ scrollbar แนวนอนแทนคำถูกตัด · **Home Page** ใช้ `createProjectCard()` (การ์ดสวย) แทน list เปล่า · **FloatBar ใน Wiki** (`syncFloatBarVisible` เช็ค `secEditors`) · **Panel Drag** กลับ logic: ลาก title=float เท่านั้น, ลาก head padding/icon=snap ได้
.51 **Sweep UX 12 ข้อ** — makeFloatDraggable title-vs-bar (ลาก title=ทุก zone, bar=ย้ายอย่างเดียว) · zoom width:fit-content + min-width · pane.on/k-tab.active full-frame box-shadow · reading-mode !important · reading cleanup ครบทุก element · Home → overlay dialog (ออกจาก PANEL_DEFS) · togglePanel → collapsePanel (คงตำแหน่ง) · Kanban empty state · refreshToolbar หลัง focus/typewriter/line-numbers
.52 **Sweep 4 บั๊ก** — zoom `min-width` dynamic ตาม scale (JS: `pageScale*100%` → overflow จริง) · togglePanel กลับเป็น hidePanel/showPanel + จำ `lastSide` · Kanban toggle (`isPanelOpen` check) · Home wider (1100px) + settings 680px · grid 4 คอลัมน์ (`minmax(190px,1fr)`) · ปุ่ม 📱/📋 list view toggle + CSS

.53–.54 ฟีเจอร์บทหนัง (element 15 ชนิด · auto-capitalize · parenthetical auto-wrap · เลือกทั้งฉาก · nbsp)
.55 กู้คืนสาย .49–.52 กลับมารวมกับ .53/.54 + แก้บั๊กที่โผล่ตอนรวม
.56 **บทภาพยนตร์ระดับใช้งานจริง (81-85, 92, 97, 98) + แก้บั๊กจาก human test 13 ข้อ**
  ใหม่: `sp-format.js` (บริสุทธิ์ · unit 74) + `roster-ui.js`
  **[85]** ขนาดกระดาษ (Letter/A4/Legal/เอง) + ระยะขอบ **บน1 ล่าง1 ซ้าย1.5 ขวา1 นิ้ว** เป็น CSS var
    (`--page-w/--mg-*`) **ใช้ร่วมกันทั้งโหมดนิยายและบทหนัง** · `@page` ตอนพิมพ์สร้างจากค่าเดียวกัน
  **[81][82]** ระยะเยื้อง/ความกว้าง/ระยะเว้นบรรทัด ต่อ element เป็น **นิ้ววัดจากขอบกระดาษ** (เลิกใช้ % ที่เพี้ยน)
  **[83]** สไตล์ caps/bold/italic/underline **แยก "บนจอ" กับ "ตอนพิมพ์"** (ตารางติ๊ก 8 ช่อง/แถวในตั้งค่า)
  **[84]** `paginate()` จริง — แบ่งบทพูดข้ามหน้าพร้อม (MORE)/ทวนชื่อ+(cont'd) · แถบสถานะบอก "N หน้า"
  **[92]** (CONTINUED)/CONTINUED:/(MORE)/(cont'd)/Scene/Time แก้ได้
  **[97]** หน้ารายชื่อตัวละคร — หน้าเดี่ยว**ประจำเล่ม** `<Section>/roster.json` · hanging indent ที่คอลัมน์รายละเอียด
    · Scene/Time เลือกเอา/ไม่เอาได้ · สวิตช์ใส่ตอนส่งออก · **ไม่มีเลขหน้า**
  **[98]** 11 ช่องใน project.khn.json (อีเมล/ติดต่อ/Screenplay By/Based On/Revisions by/โทร/ตัวแทน 4 ช่อง/Copyright)
  **ฟอนต์มาตรฐานใหม่: Courier Final Draft 12pt ทุกภาษา ทั้ง 2 โหมด** (`DEFAULT_SCRIPT_FONT`, `edFontPt/spFontPt`)
    → **`BASE_ED_FS`/`BASE_SP_FS` เปลี่ยนเป็น 16px (=12pt)** จาก 15.5/14.5 — เทสที่ hard-code ต้องอัปเดต
  **ปุ่ม Tab/Enter/Shift+Tab ตั้งเองได้ + ปิดได้** (`spCycleKeys`/`spCycleEnabled` · ย้ายจาก keymap → handleKeyDown)
  บั๊ก: SmartType ยืนยันด้วย **Tab อย่างเดียว** (Enter เคยวน) · togglePanel = **ปิด** ไม่ใช่พับ ·
    จับกลุ่มแท็บได้เฉพาะชื่อแผง/20% ขวาของหัวแผง (`inGroupHandle`) · แผงจำที่เดิม (`k2-panel-home`) ·
    ซูมยึดกึ่งกลาง (`keepZoomCenter`) · หน้ากระดาษกว้างคงที่ ไม่หดตามแผง (`width:var(--page-w)`) ·
    `centerPage()` เป็นมุมมองเริ่มต้น · โหมดอ่าน/โฟกัสซ่อน **ทุกโหนดที่ไม่อยู่ในสาย docs** ·
    แผงลอย snap ขอบ (`snapToEdges`) · Kanban เป็น toggle · `ALWAYS_ON_TB` · หน้าแรก 4 คอลัมน์ขนาดนิ่ง ·
    `entitySearchBlob()` ค้นถึงเนื้อในไฟล์เอนทิตี้

.56a **รอบเก็บบั๊ก human test 8 ข้อ + ฝังฟอนต์**
  **ฟอนต์ Courier Prime ฝังมากับโปรแกรม** `renderer/assets/fonts/*.ttf` (SIL OFL · 4 น้ำหนัก) +
    `@font-face` ต้น style.css → **ไม่ต้องลงฟอนต์ในเครื่อง** · `DEFAULT_SCRIPT_FONT` เอา Courier Prime ขึ้นก่อน
  **กล่องหน้าแรกขนาดคงที่** `.k-home-dlg` (กว้าง = `--home-thumb×4`) + `.home-dlg-scroll` — กรอบนิ่ง เนื้อในเลื่อน
  **กล่องตั้งค่า 680→1040px + 2 คอลัมน์** (`.k-set-2col` · `.k-full` = กินเต็มแถว)
  **`captureScroll()/restoreScroll()`** ใน `renderPanels` — วาดต้นไม้ใหม่แล้วหน้ากระดาษไม่เด้งกลับซ้ายบน
  **`clampFloat()`** ใน panel-drag — หนีบตำแหน่ง+ขนาดแผงลอยให้อยู่ในจอ (ใช้ทุกครั้งที่วาด ไม่ใช่แค่ตอนลาก)
  **`-webkit-app-region:no-drag` บน `.k-float-panel *`** — ทับแถบหัวหน้าต่างแล้วยังลากได้
  **โหมดอ่าน/โฟกัส = แผงเอกสาร `position:fixed; inset:0`** + `#k-mode-hint` "กด Esc เพื่อออก"

.57 **มุมมองบท + ตรวจข้อผิดพลาด + ส่งออกอุตสาหกรรม (54 · 57 · 59 · 60 · 61 · 67 · 68 · 70 · 78)**
  โมดูลบริสุทธิ์ใหม่ 5 ตัว (`sp-validator` · `sp-view` · `export-fdx` · `export-rtf` · `export-watermark`)
  + PM plugin `sp-format-guide.js` · **unit test เพิ่ม 152 ข้อ**
  **[57] โหมดร่าง** — ถอดกระดาษ/เงา/ระยะเยื้องออกด้วยคลาส `sp-view-draft` (ต้อง `!important` เพราะกฎ
    `body.paper-mode .pane…` specificity สูงกว่า) · **เส้นคั่นหน้าเป็น widget decoration** ตำแหน่งมาจาก
    `paginate()` ที่คิดจาก **บล็อกในเอกสารจริง** (`blocksFromDoc`) → ตรงกับ "N หน้า" บนแถบสถานะเสมอ
  **[59][60] เรียงหน้าคู่ / ภาพรวม 1px-4px** — overlay `.sp-pageview` วาดหน้ากระดาษจาก `paginate()`
    (ไม่แตะ ProseMirror เลย · `.workspace` ถูกซ่อนด้วย CSS) · คลิกหน้า/บรรทัด = กลับโหมดปกติ + เคอร์เซอร์ไปที่นั่น
    (`data-pos` บนทุกบล็อก) · `resize` → วาดใหม่แบบหน่วง 150ms
  **[61] แสดงรูปแบบ** — `Deco.node` ใส่เส้นฟ้าซ้าย-ขวา + widget `¶`/`·` ท้ายบล็อก (soft = `wrapLines>1`)
  **[78] Ctrl+G ไปที่หน้า/ฉาก** — กล่องเดียวสลับหน้า↔ฉาก + รายการหัวฉากคลิกได้ · `SPEditor.gotoPos()`
  **[54] ตรวจบท** — ตรวจใน `scheduleCount` (debounce เดียวกับนับคำ) · ป้าย `#sp-errors` บนแถบสถานะ (คลิก=ข้อถัดไป) ·
    `Ctrl+Shift+U` ไล่ทีละข้อ · `showErrorList()` รายการทั้งหมด · `checkBeforeExport()` ถามก่อนส่งออก
  **[67][68][70] ส่งออก** — เมนู **ไฟล์** และ **บท** · เวิร์กโฟลว์ส่งออกเลือก `.fdx/.rtf` ได้ (`finalizeCompiled`) ·
    PDF ลายน้ำใช้ `kapi.pdfFromHtml` (หน้าต่างซ่อน) + ฝัง Courier Prime ผ่าน `file://` · จำค่าที่ `meta.watermark`
  ใหม่ใน SPEditor: `setMarkdown()` / `spDocFromMarkdown()` / `gotoPos()` / `refreshGuides()`
  **เมนูใหม่ "บท"** (id `Script`) + toggles `spView`/`showFormat`/`checkBeforeExport` ใน main.js

.57a **รอบเก็บงานเล็ก 5 ข้อ** (ดู CHANGELOG เต็ม)
  **1** เสียงเครื่องพิมพ์ดีด (`typewriter-sound.js` · WebAudio สังเคราะห์เอง ไม่มีไฟล์เสียง)
  **2** รูปแบบบทตามสเปก: เลขฉาก (0.75"/1" · toggle) · เลขหน้า (ขวา 1" บน 0.5" · toggle · **เลขเริ่มต้นรายไฟล์**
    ใน `scenes.json → startPage` ตั้งได้ทั้งกล่องและแผงคุณสมบัติ) · ทรานซิชันแยกเข้า/ออก · ส่วนเสริม ·
    หัวข้อย่อย · สลับฉาก · ช็อตเข้าแถบเครื่องมือ
  **3** **บั๊ก: เมนู "บท" ไม่มีปุ่มบนแถบชื่อ** → ฟีเจอร์ .57 ทั้งชุดเข้าไม่ถึง (ดูบทเรียนข้อ 46)
  **4** SmartType เลิกจำคำมั่ว: ข้ามบล็อกที่เคอร์เซอร์อยู่ · `looksLikeTerm()` · `meta.smartIgnore`
    (คลิกขวาที่คำเดา = ไม่จำ · **บท → จัดการ SmartType**)
  **5** ฟอนต์ตามภาษา (`lang-fonts.js`) + ฝังฟอนต์ไทย `CourierThaiMono/Prop.ttf`
    **"สระ/วรรณยุกต์ลอย" มี 2 ต้นเหตุ แก้ทั้งคู่**: (ก) `letter-spacing` ของเราเอง — เอาออก (บทเรียน 47)
    (ข) ตัวฟอนต์วางมาร์กสูงเกินจริง — ขยับ outline ลง 74/ขึ้น 36 ด้วย `tools/shiftmarks.py` (บทเรียน 48)
    · เทสพิกเซลบน canvas ใน e2e ล็อกไว้แล้ว · ที่มา/สิทธิ์ดู `renderer/assets/fonts/THAI-FONTS.txt`

.58 **โหมดจัดหน้า (58) · ระบบต่อเนื่อง (55/56) · รายงานบท (71/72/73) + บั๊ก human test 4 ข้อ + ฟีเจอร์ที่ขาด 2 ข้อ**
  โมดูลบริสุทธิ์ใหม่ 3 ตัว (`sp-continued` · `sp-reports` · `smart-terms`) · **unit test เพิ่ม 154 ข้อ**
  **[58] Layout View** — โหมด `layout` (ยังพิมพ์ได้ · ไม่ใช่ overlay) กระดาษขาวจริง + ระยะขอบจริง +
    **ช่องว่างคั่นหน้าจริง** (ล้ำออกนอกระยะขอบสองข้าง) + เลขหน้ากลางช่องว่าง · ตัวเลขมาจาก `pageMetrics()`
  **[55][56] CONTINUED** — `computeContinueds()` แปลงผล `paginate()` เป็น decoration (ไม่ใช่ข้อความจริง)
    · `paginate` เก็บ `sceneStart/sceneEnd` ต่อหน้า → CONTINUED เกิดเฉพาะตอนฉากข้ามหน้าจริง
    · `CONTINUED: (2)` รีเซ็ตเมื่อเปลี่ยนฉาก · เมนู บท → ข้อความต่อเนื่อง (เปิด/ปิด) · `insertContinueds` ใน compile
  **[71][72][73] รายงาน** — กล่องเดียว 3 แท็บ (`openSpReport`) คลิกแถวกระโดดไปฉาก · คัดลอก/บันทึกไฟล์ได้
  **บั๊ก 1** SmartType → เกณฑ์ "เจอซ้ำ ≥ 2 บล็อก" + pin/ignore + รายการ "ยังไม่จำ" (บทเรียน 53)
  **บั๊ก 2** ตารางปุ่มสลับ element อ่านจาก `TAB_CYCLE` แทนรายการฮาร์ดโค้ด
  **บั๊ก 3** `.sp` line-height 1.5 → `--sp-lh` = 1 (54 บรรทัด/หน้า) + `zoomFitWidth()` (บทเรียน 51)
  **บั๊ก 4** `incrementalDecoState()` + แคช regex/รายชื่อ + เลิกใช้ `getMarkdown()` นับคำบท + หน่วงยืดตามไฟล์ (บทเรียน 52)
  **ฟีเจอร์ 1** `confirmQuit()` ใช้ `saveAllDialog` (รายชื่อ + เช็คบ็อกซ์)
  **ฟีเจอร์ 2** `revealFile()` — ปุ่ม "หาในดิสก์" บนหน้า Wiki + คลิกขวาใน Explorer (พร้อมประวัติเวอร์ชัน)
  **ค่าเริ่มต้นใหม่**: `subheader` = "ฉากย่อย" · ฉากย่อย/ช็อต/สลับฉาก วางตัวเท่าหัวฉาก ตัวหนา **แต่ไม่มีเลขฉาก**

.58r **รอบเก็บบั๊ก 27 ข้อ + ยกเครื่องโหมดนิยาย + คอนโซลนักพัฒนา**
  โมดูลบริสุทธิ์ใหม่ 2 ตัว (`prose-format` · `prose-view`) · **unit test เพิ่ม 141 ข้อ** · e2e 1,307 → **1,380**
  **หน้ากระดาษ/ซูม/โหมดอ่าน (1–4)** — ดูบทเรียน 55–58 (ทั้ง 4 ข้อเป็นบทเรียนถาวรหมด)
  **บท (5–13)** — `lineHeight` เข้า fmt + `formatLines()` · `pageMetrics` คูณ `--sp-lh` ·
    ส่งออกใช้ `blocksFromDoc` · `toggles.continueds` เริ่มต้น true · `applyPageVars` รีเฟรช format guide ·
    `spCss` สร้าง `.sp-contd` · เมนู goto · pinned ชนะ `looksLikeTerm` · พรีเซ็ตส่งออก "บทภาพยนตร์"
  **นิยาย (14–24)** — `uiFontSize` → `--ui-fs` เท่านั้น (เลิกบวกเข้าขนาดเอกสาร · **e2e เก่าที่วัด
    `--ed-fs = ฐาน+4px` ต้องแก้ให้วัด `--ui-fs` แทน**) · หนีบ `edFontPt` 9–96px ·
    มุมมองหน้ากระดาษ 6 โหมด + จัดหน้า + เลขหน้า + เส้นคั่นหน้า + Ctrl+G ของนิยาย ·
    ย่อหน้าบรรทัดแรก/ช่วงบรรทัด/ระยะย่อหน้า/หัวข้อ/ยกคำพูด ปรับได้ครบ (แท็บ "📖 รูปแบบนิยาย") ·
    **ฟอนต์เริ่มต้นนิยาย = ตัวพิมพ์สัดส่วน** (Courier เป็นของบทเท่านั้น) · `mdToHtml` = WYSIWYG
  **ไฟล์/schema (25, 27)** — align ย้ายไป frontmatter `align: [3:center]` (ไฟล์เก่ายังอ่านได้) ·
    เพิ่ม `horizontal_rule` + `code_block` เข้า schema/md.js/input rule/เมนู
  **คอนโซลนักพัฒนา** — เมนู ช่วยเหลือ (ที่เดียวกับ "เกี่ยวกับ") + **Ctrl+Shift+`** ·
    `openDevConsole()` รัน JS ด้วยตัวแปร `k2` (`k2.state/tab()/blocks()/cssVar()/cmd()`) ·
    ดัก `console.*` · ประวัติคำสั่ง · `aboutDialog()` แทน `alert()`

.59 **ชุด PDF ครบวง (69 · 87 · 88 · 89 · 90 · 91)** — เลิกพึ่ง print-to-PDF ของ Chromium อย่างเดียว
  โมดูลบริสุทธิ์ใหม่ 3 ตัว (`pdf-generator` · `sp-title-pages` · `sp-headers`) + UI `pdf-ui`
  **unit test เพิ่ม 229 ข้อ (832 รวม) · e2e 1,380 → 1,432** · เพิ่ม dep `pdf-lib` + `@pdf-lib/fontkit`
  **[69]** `generatePdf()` เขียน PDF เอง — ฝังฟอนต์ไทย · ตัดบรรทัดด้วยกติกาเดียวกับ `wrapLines()` เป๊ะ
    · `useObjectStreams:false` · **ทางเดิม (`export-pdf` = Chromium) ยังอยู่ครบ**
  **[87]** สารบัญ = `/Outlines` ที่ประกอบ dict เอง (pdf-lib 1.x ไม่มี API) + `/PageMode /UseOutlines`
  **[89]** `/OpenAction` เปิดไฟล์แล้วไปหน้าที่เคอร์เซอร์อยู่ (`currentScriptPage()`)
  **[90]** หน้าปกหลายหน้า + กล่อง 3 คอลัมน์ (พรีวิวกระดาษจริง คลิกข้อความเพื่อแก้) → `meta.titlePages`
  **[91]** หัวกระดาษซ้ำทุกหน้า + ตัวแปร `${PAGE}` ฯลฯ (ไทยได้) → `settings.spHeaders`
    · **กินบรรทัดจริง** ผ่าน `linesForBody()` จำนวนหน้าจึงตรง
  **[88]** ขั้นตอน `omit-elements` (ช่วง model) + สวิตช์ในกล่อง PDF · กล่องเวิร์กโฟลว์รองรับ `type:'check'`
    · พรีเซ็ตใหม่ `screenplay-pdf` (ext `pdf` → `writeCompiledPdf`)
  **บั๊กฟอนต์ที่เจอตอนเรนเดอร์ดูด้วยตา** → บทเรียน 63 (Courier Prime ไม่มีไทย · ฟอนต์ไทยชี้ `·©—…` ผิด)
  **บั๊กที่เจอตอนเขียนเทส** → บทเรียน 62b (บล็อกเทสถูก `if` ครอบแล้วข้ามเงียบ) · 64 · 65

.60 **นำเข้า/เปรียบเทียบ/แยกตั้งค่า (62–66, 74, 94, 96)**
  โมดูลใหม่ 2 ตัว (`import-sp` · `sp-compare`)
  **[62–66] Import Formats**: `SP_IMPORTERS` 5 รูปแบบ (FDX XML · Celtx ZIP+HTML · Adobe Story XML · Fade In Pro JSON · Fountain)
    · `importScreenplayDialog(injectFn)` → auto-detect → summary → inject เข้า SPEditor
    · FDX: `<Paragraph Type="..."><Text>...</Text></Paragraph>` · Celtx: JSZip → script/index.html
    · **ไฟล์→นำเข้าบทภาพยนตร์…** (ใช้ IPC `dialog:openScreenplay`)
  **[74] Script Comparison**: `compareScripts` (LCS diff) · `showComparisonDialog` (สี: ลบ=แดง เพิ่ม=เขียว เปลี่ยน=เหลือง)
    · `diffStats` · เมนู **เครื่องมือ→เปรียบเทียบบท**
  **[94] 4-Level Settings → 2 levels practical**: `GLOBAL_DEFAULTS` + `PROJECT_DEFAULTS` ส่งออกจาก core.js
    · 🌐 = ระดับผู้ใช้ (userData/settings.json) · 📁 = ระดับโปรเจกต์ (project.khn.json)
    · `kapi.readGlobalSettings/writeGlobalSettings` (IPC ใหม่)
    · `loadSettings` เป็น async โหลด global ก่อน merge project
  **[96] Auto-Pagination**: `spAutoPaginate` + `spPaginateInterval` (1–60s) · `scheduleRepaginate()` debounce
    · **สวิตช์นี้คือ "หน่วงเวลา" ไม่ใช่ "ปิดฟีเจอร์"** (แก้ใน alpha.60r1):
      ปิด (ค่าเริ่มต้น) = `scheduleCount` เรียก `repaginateNow()` ทุกครั้ง ·
      เปิด = ยกงานไปให้ `scheduleRepaginate` ทำห่าง ๆ แถบสถานะใช้ค่าล่าสุดที่จำไว้

.60r1 **รอบเก็บบั๊ก 22 ข้อ + ปิดงานที่ค้าง** (ดู CHANGELOG เต็มใน `renderer/CHANGELOG.md`)
  **บล็อก e2e**: ข้อ 96 เขียน gate กลับด้าน → จำนวนหน้า/เส้นคั่นหน้า/CONTINUED หายทั้งระบบตอนสวิตช์ปิด (= ค่าเริ่มต้น)
  **`src/num.js` ใหม่** — `num`/`numClamp`/`numInt` แหล่งเดียวของกฎ 20 · ลบสำเนาใน 5 ไฟล์ · ไล่แทน `+x || d` ทั้งโปรเจกต์
  **`src/page-break-plugin.js` ใหม่** — `createPageBreakPlugin()` ให้บทกับนิยายใช้ร่วม (สถานะแยกกัน) ตัดโค้ดซ้ำ 53 บรรทัด
  **RTF**: `\sb` เว้นบรรทัดตรงกับ `paginate()` แล้ว (เดิมลบออก 1 บรรทัดทุกบล็อก) · รับ `fontPt` · `keepNext` มาจาก `SP_ELEMENT_CONFIG`
  **FDX**: เลขฉาก `Number="N"` · หน้าปกที่ผู้ใช้แต่งเอง (ทั้ง FDX และ RTF) ชนะหน้าปกอัตโนมัติจาก meta
  **PDF ลายน้ำรายคน** ใช้ `buildScriptPdf` (สารบัญ/หน้าปก/ฟอนต์ไทยสองวงศ์ครบ) — Chromium เป็นทางสำรอง
  **`TitlePageEditor.duplicatePage()`** + ปุ่มทำสำเนาในกล่องหน้าปก · **แคชฟอนต์ PDF เทียบ mtime** + `clearPdfFontCache()`
  **คลังรูปเป็นแผง** (`#gal-panel`) เลิกแย่งแถบแท็บกับฉาก · **แผงจำสัดส่วนตอนปิด-เปิด** (`home.ratio`)
  **i18n ~145 สตริง** ของ 8 โมดูล UI ใหม่เข้า `languages/*.json` (ไทย+อังกฤษ)
  เก็บงานเล็ก: `popupMenu` ใน panel-ui (เดิม import จาก app.js ได้ undefined ตลอด) · `flushBuf` dead code ·
  `SP_PREFIX` derive จาก `SP_ELEMS` · `usageOf` นับ token 0 ถูกต้อง · `SEVERITY` รวมที่ ai-core ·
  import-sp รองรับ round-trip ครบทุก element + `splitCharacter` · ถอด import ที่ไม่ได้ใช้ 9 ตัว

.60r2 **รอบแก้ 13 ข้อ — UI/หน้ากระดาษ · ชั้นข้อมูล** (ดู CHANGELOG เต็มใน `renderer/CHANGELOG.md`)
  **กฎเหล็กของรอบ**: แก้ UI ห้ามกระทบตัวแก้ไข/หน้ากระดาษทุกรูปแบบ → ทุกข้อที่แตะ UI มีเทสยืนยัน
  สีกระดาษ · สีหมึก · ความกว้างหน้ากระดาษ ไม่ขยับ (`[10][กฎเหล็ก]` 3 ข้อ)
  **[1] ซูมตกขอบซ้าย** — `syncWorkspaceWidths()` วัด `min-width = พื้นที่แผง ÷ อัตราซูม` เป็น **พิกเซล**
    (เดิม `(pageScale*100)%` พึ่งการตีความ % ใต้ CSS `zoom` ซึ่งต่างกันตามเวอร์ชันเบราว์เซอร์)
  **[2] รูปตัวพิมพ์** — `text-case.js` + `#tb-case` + เมนู รูปแบบ → รูปตัวพิมพ์ + `cmd('case', mode)` ทั้ง KEditor/SPEditor
  **[3] เส้นคั่นหน้าไม่หน่วง** — `heavyDelay` 300→100ms · `repaginateFast()`/`repaginateOnEnter()` ยิงทันทีตอน Enter
    · แยก `repaginateProseNow(tab)` ออกจาก `scheduleCount`
  **[4] เสียงพิมพ์ดีด** — `typeSoundMode: 'always'|'typewriter'` (เดิมต้องเปิด 2 สวิตช์ ค่าเริ่มต้นตัวที่สอง = false → เงียบ)
  **[5] มุมมองหน้ากระดาษของนิยาย** — `#sp-view-select` โผล่เมื่อมี `ed` ด้วย (เดิม `sp` อย่างเดียว) — เอนจินพร้อมมาตั้งแต่ .58r
  **[6] ระยะขอบสำเร็จรูป** — `margin-presets.json` 8 ชุด + `<select id="st-mg-preset">` · `settings.marginPreset`
  **[7] ขยับแผงแล้วตำแหน่งเลื่อนหาย** — `SCROLLABLES` เพิ่ม `.sp-pageview`/`#panes`/`.roster-wrap`/`.k-float-body`/`.pane-content`
    · `restoreScroll()` เขียนใหม่ (ดูบทเรียน 68)
  **[8] เลย์เอาต์แผง v2** — `LAYOUT_VERSION 1→2` + `splitRatios` + `validRoot()` (พัง → ตกกลับค่าตั้งต้น)
    · `rememberRatio/savedRatio` · จด home ทุกครั้งที่วาดใหม่ (debounce 250ms) ไม่ใช่ตอนปิดอย่างเดียว
  **[9] ปิด FAB ได้** — `fabEnabled` → `body.k-fab-off` (ซ่อนทั้งปุ่มและเมนู) + คำสั่ง `toggle-fab`
  **[10] Ctrl+Shift+P = ธีม** — `theme:'dark'|'light'` · `applyTheme()`/`toggleTheme()` · `body.theme-light`
    ทับเฉพาะตัวแปรเปลือกโปรแกรม **ไม่แตะ `--paper-*`** · โหมดหน้ากระดาษยังอยู่ที่ปุ่ม 📄 + เมนู
  **[11] เลขบรรทัด = UI** — ราง `#k-ln-gutter` เป็นลูกของ `#panes` (นอกกล่องที่ถูก zoom)
    · `refreshLineGutter()` วาดเฉพาะบรรทัดในสายตา · ทาบแผงที่ active · ปิดเองในมุมมองหน้ากระดาษ
    · **เลิกใช้ `::before` บนบล็อก** (เลขเคยเลื่อน/ย่อขยายไปกับกระดาษ และติดไปกับงานพิมพ์)
  **[12] เมทาดาทารูป Wiki** — `wiki-images.js` · `ask()` รับ `allowEmpty` (ลบคำบรรยายให้ว่างได้)
  **[13] คุณสมบัติฉาก** — `scene-meta.js` เป็นจุดเดียว · frontmatter ชนะ `scenes.json` เสมอ
    · `sceneProps` + `setSceneMeta` เดินผ่านทั้งคู่ · เมนู เครื่องมือ → 🔄 ซิงก์คุณสมบัติฉากจากไฟล์ .md
  **แพ็กเกจ**: `npm run dist:mac` → DMG macOS Intel (x64) · `build.mac` ตั้ง `identity:null` (ยังไม่มีใบรับรอง)

.60r3 **รอบเก็บงาน 9 ข้อ — เชื่อมโลก · AI ช่วยกรอก · คุณสมบัติบท/เล่ม · Localizer · ปลั๊กอิน · หน้าแรกใหม่**
  โมดูลใหม่ 4 ตัว (`i18n-csv` · `ai-synopsis` · `ai-analyzer-ui` · `markdown-code-toggle`)
  **[1] "ฉากที่กล่าวถึง" ใช้ไม่ได้** — 2 ต้นเหตุ: (ก) `ensureAutoLink()` สร้างดัชนีครั้งเดียวแล้วไม่อัปเดตอีกเลย
    (ข) ตั้ง `autoLink` **ก่อน** อ่านไฟล์เสร็จ → ผู้เรียกคนที่สองได้ instance ว่างกลับไป
    **แก้**: ทุกคนรอ Promise ก้อนเดียว (`building`) · `saveTab` เรียก `updateSceneLink()` (O(1)/บันทึก)
    แล้ววาดแผง Wiki ที่เปิดค้างใหม่ผ่าน `tab.refreshBacklinks` · ปุ่ม 🔄 `rebuildAutoLink()` ·
    คลิกขวาในหน้า Wiki → `onFindInScenes` (เมนูรายชื่อฉากจริง ไม่ใช่เลื่อนจอ)
    · ทำเฉพาะเมื่อ `autoLinkReady()` — Ctrl+S ครั้งแรกจะได้ไม่ปลุกการสแกนทั้งโปรเจกต์
  **[2] ปุ่ม ✨ AI เติมช่องคุณสมบัติฉาก** — `ai-synopsis.js`: `generateSceneSynopsis/generateSceneField` ·
    `AI_SCENE_FIELDS` 4 ช่อง (synopsis/pov/emotion/conflict) · `fieldPrompt()` เป็น pure (เทสได้ไม่ต้องยิงเน็ต) ·
    **`attachAiFieldButton()` = ตัวเดียวที่ทั้งกล่องและแผงเรียก** (บทเรียน 50)
    · เติมค่าแล้วยิง event `input` → autosave ของแผงเก็บให้เอง
  **[3] คุณสมบัติบท/เล่ม** — `chapterProps()` (scene-ops) เขียน `draft.json` (status/act/date/note/isFavorite) ·
    `sectionProps()` (section-ops) เขียน `section.json` (status/blurb/cover/order) · คลิกขวาหัวบท/หัวเล่ม
    · ค่าเหล่านี้มีในไฟล์มาตั้งแต่ v1 แต่ไม่เคยมี UI แก้
  **[4] Localizer CSV** — `i18n-csv.js` (บริสุทธิ์ · **unit test 61 ข้อ**): `flatten/unflatten` ·
    `jsonToCsv(th,en)` (BOM + CRLF + quote ตาม RFC 4180) · `parseCsv` (state machine — regex ทำ `""` ไม่ได้) ·
    `csvToJson` (หัวตารางสลับลำดับได้) · **`mergeStrings` = รวมทับ ไม่ลบคีย์ที่ไม่มีในตาราง**
    · เมนู เครื่องมือ → ส่งออก/นำเข้า · เขียนลง `<โปรเจกต์>/languages/*.json` แล้วโหลดใหม่ทันที
  **[5] แผง 🧠 AI วิเคราะห์** — `ai-analyzer-ui.js` · `ANALYZER_CARDS` 5 ใบ + `analyzerStats()` (ตัวเลขจริง)
    · **ตัวอย่างหน้าตา** มีป้ายกำกับชัด ไม่หลอกว่าเป็นผลจริง · แผง `ai-analyzer` + `#tb-ai-analyzer` + เมนู
  **[6] ซ่อนรหัสนำหน้าบรรทัด** — `markdown-code-toggle.js`: `MD_PREFIXES` (**เรียงยาวก่อนสั้น** ไม่งั้น
    `#` กิน `###` และ `$in ` ไม่ถูกจับ) · `prefixLen`/`suffixLen` เป็น pure · `markdownCodePlugin(decoState)`
    รับ `incrementalDecoState` จาก editor.js เข้ามา (คิดจากบล็อกเดียว = เข้าเงื่อนไขบทเรียน 52)
    · ซ่อนด้วย `.k-md-hide-prefix{display:none}` — **ไฟล์ .md ไม่ถูกแก้เลย**
    · กติกากันซ่อนผิด: ต้องมีเนื้อตามหลัง · `.` ห้ามซ่อนเมื่อตามด้วยจุด/เลข/ช่องว่าง · `!` ห้ามซ่อนถ้าเป็น `![](…)`
    · `settings.showMarkdownCodes` (เริ่มต้น true) · ปุ่ม `#tb-md-codes` + เมนู รูปแบบ · ไอคอน `eye`/`eye-off` ใหม่
  **[7] ระบบปลั๊กอิน** — `k2` API 8 → **20 เมท็อด** · `pluginApi(name)` ผูกชื่อไว้ (settings/สถานะแยกรายตัว)
    · manifest 6 ช่อง + `versionAtLeast()` · **2 ที่อยู่**: `<โปรเจกต์>/Plugins/` + `%APPDATA%/Killian2/Plugins/`
    (IPC ใหม่ `plugins:globalDir` / `plugins:listGlobal` · ชื่อซ้ำ → ของโปรเจกต์ชนะ)
    · **แยกความเสียหาย**: throw ตอนโหลด → `settings.plugins.disabled[<ชื่อ>]` แล้วข้ามรอบถัดไป
    · `k2.readFile/writeFile` กัน path ที่มี `..` · คีย์ลัดเข้า `SHORTCUTS` ตอนรัน (ช่อง `plugin:<ชื่อ>:<id>`)
    · `pluginBus` = EventBus ก้อนเดียวที่ทุกปลั๊กอินใช้ร่วม
  **[8] คลิกขวาหัวแผง → "นี่คืออะไร"** — `desc` ใน `PANEL_DEFS` ทุกแผง (i18n `panel.desc_<id>`) ·
    `panelDesc()` · `buildHead()` ผูก `oncontextmenu` → `headMenuItems()` · `wrapDesc()` ตัดบรรทัด ≤52 ตัว
  **[9] หน้าแรกเรียงปุ่มใหม่** — **`buildHomeActions()` = ตัวเดียวที่ทั้ง 3 โหมดการวาดใช้**
    (กล่อง overlay · แท็บหน้าแรก · แผงหน้าแรก) · ลำดับ: ส่งออก · นำเข้า · spacer · สร้างใหม่ · เปิด · ปิด
    · สวิตช์มุมมอง 📋 ย้ายขึ้นหัวกล่อง · **`importProjectZip()`** ใหม่ (`safeRel` กัน zip slip ·
    `commonPrefix` ปอกโฟลเดอร์ชั้นนอก · ไบนารีผ่าน `writeBytes`)

.60r3a **แก้ข้อ 6 ที่เข้าใจผิด — มาตรฐานรหัสบทเป็นมาร์กดาวน์ + บั๊ก (V.O.) + ฟอนต์ไทย**
  r3 ทำข้อ 6 เป็น "ซ่อนรหัสเดิมของ v1" ซึ่งแก้ไม่ตรงจุด — โจทย์จริงคือ **เปลี่ยนตัวรหัสให้เป็นมาร์กดาวน์**
  **มาตรฐานใหม่** (ดูตารางเต็มที่ `fountain.js` ด้านบน): `### `หัวฉาก · `#### `ฉากย่อย · `@`ตัวละคร ·
    `((…))`วงเล็บ · `>> `/`<< `ทรานซิชันออก/เข้า · `! `ช็อต · `---`ขึ้นหน้าใหม่ · `/// `โน้ต
  **`page-break` เป็น element จริง** — `paginate()` ปิดหน้าแล้วขึ้นหน้าใหม่เมื่อเจอ (ไม่กินบรรทัด ไม่ถูกใส่ลงหน้า)
    · คลาส CSS ต้องเป็น `sp-page-break-el` — ชื่อ `sp-page-break` เป็นของ **เส้นคั่นหน้าอัตโนมัติ** อยู่แล้ว
  **บั๊ก `@dave (V.O.)` → วงเล็บ**: `screenplay.js` ดักปุ่ม `(` แล้วแปลงบล็อกเมื่ออยู่บน character **หรือ** dialogue
    → พิมพ์ส่วนเสริมท้ายชื่อตัวละครไม่ได้เลย · **แก้: แปลงเฉพาะ "บทพูดที่ยังไม่มีข้อความ"**
    (วงเล็บกลางประโยคของบทพูดก็เป็นเครื่องหมายวรรคตอนปกติ ไม่ควรถูกแปลงเหมือนกัน)
  **ฟอนต์ไทย**: `THAI_FONT_STACK` ใหม่ใน core.js — **Ayuthaya** (ฟอนต์ระบบ macOS ที่วางมาร์กถูก) มาก่อน
    → เครื่อง Mac ได้ทันที เครื่องอื่นตกไปตัวถัดไป · `SYSTEM_THAI_FONTS` ใน lang-fonts.js ให้เลือกเองได้
    (แจกฟอนต์ Apple มากับโปรแกรมไม่ได้ — สิทธิ์)
  แก้เทสเดิม 2 ข้อที่ผูกกับรหัสเก่า: `[compile] หัวฉาก round-trip` (รับ `### ` ด้วย) ·
    `ส่งออกบล็อก: ปิดหัวฉากแล้วไม่มี <h3>` → เปลี่ยนเป็น "ตัวส่งออกไม่เติมหัวข้อชื่อฉากให้"
    เพราะหัวฉากของบท **เป็น `<h3>` จริงในเนื้อหา** ตามมาตรฐานใหม่

.61 **4 งานใหญ่: ลำดับเปิดโปรแกรม · AI ที่ผู้ใช้ตั้งเอง · ปุ่มพื้นฐานของตัวแก้ไข · อิสระเรื่องตัวพิมพ์**
  **[1] ลำดับเปิดโปรแกรม** — กดเปิด → หน้าต่างรอโหลด → เข้าโปรแกรม → แยกทางที่ **`bootSequence()` ที่เดียว**
    · เดิม `loadProject()` เด้ง `showHomeDialog()` ทับทุกครั้ง → "เปิดล่าสุดโดยข้ามหน้าแรก" เป็นไปไม่ได้เลย
    · `openLastProject` (เมนู **ไฟล์**) · `showHomeOnStartup` (เมนู **มุมมอง**) — ทั้งคู่ **global settings**
      (`saveGlobalSetting(k,v)` merge ทับทีละคีย์ · `bootGlobalSettings()` อ่านตอนยังไม่มีโปรเจกต์)
    · ค่าเริ่มต้นเปลี่ยนเป็น **false ทั้งคู่** = เข้าหน้าแรกก่อน (เดิม showHomeOnStartup=true)
    · **หน้าแรก**: แถบคำสั่งลง**ขอบล่าง** (`.home-actions-bottom` + `.home-wrap` เป็น flex column) ·
      เอา `.home-close-btn` มุมขวาบนออก · มุมมองเป็น **2 ปุ่มโหมด** `.home-view-mode[data-view]`
      (กดซ้ำไม่สลับกลับ — ต่างจากสวิตช์เดิม) · **ปุ่มค้นหาโปรเจกต์** กรองจาก `card.dataset.search`
    · ลำดับปุ่มใหม่: `home-view-modes · home-btn-find · home-find-input · export · import · spacer · new · open · close`
  **[2] ตั้งค่า AI: ผู้ให้บริการที่ผู้ใช้สร้างเอง** — เลิกใช้รายการสำเร็จรูป
    · **`src/ai/ai-providers.js` (บริสุทธิ์)** — `PARAM_DEFS` 12 ตัว · `normalizeParams` (หนีบช่วง ·
      **แยก "ตั้งเป็น 0 จริง" ออกจาก "ไม่ได้ตั้ง"** ตามกฎ 20) · `parseDomains`/`isDomainAllowed`
      (รายการว่าง = ไม่จำกัด · `*.a.com` ไม่ครอบ `a.com` เปล่า) · `newProvider`/`validateProvider` ·
      **`stripSecrets`/`withSecrets`** · `modelsRequests` (ลอง `/models` → `/v1/models` → `/api/tags`) ·
      `parseModels` (รับ `data[].id` · `models[].name` · อาร์เรย์ล้วน) · `chatRequest`/`parseChat`
    · **`src/ai/ai-provider-ui.js`** — กล่องตั้งค่า + ป๊อปอัป 4 ส่วน (ชื่อ → Credential → Model → Parameters)
      · **`sendRequest()` = ประตูเดียว** ที่ตรวจ Allowed Domains ก่อนยิงทุกคำขอ
      · คีย์เก็บที่ `ai-key.json` → `{ keys: { <credentialId>: apiKey } }` (รุ่นเก่าที่เป็น `apiKey` เดี่ยวยังอ่านได้)
      · `ai.providers[]` + `ai.activeProviderId` + `ai.sendKey` อยู่ใน `project.khn.json`
    · `callAI()` ใน ai-settings.js **วิ่งผ่านทะเบียนใหม่ก่อนเสมอ** เมื่อมี `ai.providers` → ฟีเจอร์ AI เดิมทุกตัวตามทันทีโดยไม่ต้องแก้ทีละไฟล์
  **[2b] แผงแชท AI แบบ opencode** — `src/ai/ai-session.js` (บริสุทธิ์) + `src/ai/ai-chat-panel.js` (UI)
    · เซสชัน = ไฟล์ JSON ใน **`<โปรเจกต์>/Sessions/<id>.json`** → เปลี่ยนโปรเจกต์เห็นคนละชุด · แก้นอกโปรแกรมได้
    · 3 ชั้นในแผงเดียว: **รายการ** (ค้นทั้งชื่อ+เนื้อความ · ล่าสุดบนสุด · ➕ ใหม่) →
      **เซสชัน** (ชื่อซ้ายบน · `.ai-chat-ctx` ขวาบน — hover เห็นต้นทุน/%/token · เมนู ⋯ เปลี่ยนชื่อ/แชร์/จัดเก็บ/ลบ) →
      **รายละเอียด** (สถิติ 18 แถว + `.ai-detail-raw` แสดง JSON ดิบ + ปุ่มปิด)
    · กล่องพิมพ์: 📎 ไฟล์ · โหมด `plan`(อ่านอย่างเดียว)/`write` · **โมเดล override แยกจากตั้งค่า** ·
      `scope` = project/book/chapter/scene/none (`collectScope()` เป็นคนบังคับจริง — `none` คืน `''`) ·
      ปุ่มส่ง `isSendKey(ev, 'enter'|'shift-enter')`
    · `sessionStats()` — **"บริบท" = คำขอครั้งล่าสุด ไม่ใช่ยอดสะสม** · `contextLimit` เดาจาก `guessLimit(used)`
      เพราะ API ส่วนใหญ่ไม่บอกขีดจำกัดกลับมา
    · unit test: `test/ai-providers.test.cjs` (102 checks — ครอบทั้ง ai-providers และ ai-session)
  **[3] ฟังก์ชันพื้นฐานของตัวแก้ไขที่หายไป** (ผู้ใช้เจอเองว่า "กด Tab แล้วโฟกัสไปแถบรูปแบบ")
    · schema เพิ่ม **`hard_break`** + **`page_break`** · คำสั่งใหม่ใน editor.js:
      `insertTab`/`removeTab`/`insertHardBreak`/`insertPageBreak` (เป็น PM command จริง → `chainCommands` ต่อได้)
    · keymap: `Tab`=sinkListItem→insertTab · `Shift-Tab`=liftListItem→removeTab ·
      `Shift-Enter`=exitCode→insertHardBreak · `Mod-Enter`=insertPageBreak
    · **md.js**: hard break = **แบ็กสแลชท้ายบรรทัด** (CommonMark · `\\` คู่ยังเป็นแบ็กสแลชจริง) ·
      page break = `<!--pagebreak-->` (แนวเดียวกับ `<!--align:…-->` · v1 เปิดได้)
      · `inlineToMd` ต้อง **ปิดเครื่องหมายรูปแบบก่อนขึ้นบรรทัด** ไม่งั้น `**` คร่อม `\n` แล้วอ่านกลับไม่ได้
    · `Ctrl+Shift+V` + เมนู ลบ = ใช้ **role ของ Electron** (`pasteAndMatchStyle` / `delete`) → ทุกแป้นพิมพ์
    · `deleteCurrentLine()` ใน app.js — ทำงานทั้งนิยายและบทหนัง · บล็อกสุดท้ายแทนที่ด้วยบล็อกว่าง
      (ถาม `schema.topNodeType.contentMatch.defaultType` ไม่ใช่เดาชื่อ `paragraph` เพราะบทหนังไม่มี node ชื่อนั้น)
    · คีย์ลัด **Ctrl+Shift+Delete** (Ctrl+Shift+K ไม่ว่าง = จัดกึ่งกลาง)
    · **บทหนัง**: `DEFAULT_SP_CYCLE_KEYS.tab/shiftTab` ย้ายไป **Ctrl+Tab / Ctrl+Shift+Tab**
      → Tab เปล่าเยื้องได้ · สลับ element ยังกด Ctrl+↑/↓ ได้เหมือนเดิม · `SPEditor.insertPageBreak()` สำหรับ Ctrl+Enter
  **[4] อิสระเรื่องตัวพิมพ์ใหญ่/เล็กในบทหนัง** — `DEFAULT_SP_FORMAT.forceCase` (เริ่มต้น true)
    · **`mergeSpFormat` ล้าง `styles[k].screen/print.caps` ให้เมื่อ forceCase=false** → ทุกทางออกตามทันที
      (spCss · pdf-generator · export-rtf · sp-headers อ่าน `caps` ตัวเดียวกันหมด) · ค่าที่ผู้ใช้ติ๊กเองไม่หาย
    · `settings.spForceCase`/`spAutoCapitalize`/`spAutoCorrectI` → เมนู **บท → 🔠 ตัวพิมพ์ใหญ่/เล็ก (ให้อิสระ)**
    · แก้จุดฮาร์ดโค้ดที่เหลือ: `export-rtf.js` เคย `title.toUpperCase()` เสมอบนหน้าปก

.62 **รอบเก็บบั๊กจาก human test 21 ข้อ** (e2e 1,842 → **1,960** · unit 1,296)
  **[1] หน้าแรกกว้างขึ้น 30%** — `--home-dlg-w` (= สูตรเดิม × 1.3) · `.home-wrap` 1100 → 1430px
    → แถบคำสั่งล่าง (มุมมอง · ค้นหา · ส่งออก · นำเข้า · สร้างใหม่ · เปิด · ปิด) อยู่บรรทัดเดียว
  **[2] ปุ่ม 💬 เป็นสวิตช์ของแผง "AI ผู้ช่วยเขียน"** — คำสั่งใหม่ `ai-chat-toggle` · `.tb-toggle` + จุด ●
    · ชื่อใหม่ทั้งชุด: 💬 = "AI ผู้ช่วยเขียน" (แผงแชท) · 🤖 = "เครื่องมือ AI (ขยาย · สรุป · เขียนใหม่)"
  **[3] แผงแชท: ↻ เริ่มใหม่ + ⧉ คัดลอก** — `clearMessages()` ใน `ai-session.js` (บริสุทธิ์ · unit 8 ข้อ:
    ล้างข้อความ+`contextLimit` · เก็บ id/โหมด/ระดับการเข้าถึง/โมเดล/ไฟล์แนบ/ชื่อที่ตั้งเอง)
    · `copyText()` ใน `ai-chat-panel.js` → **`kapi.clipboardWrite` (IPC ใหม่)** แล้วค่อย fallback (บทเรียน 84)
  **[4] CSS พื้นฐานของ ProseMirror** — ต้นเหตุ "โหมดนิยายกด Tab ไม่ได้ · ขึ้นบรรทัดใหม่แล้วกด Tab บรรทัดหาย"
    (บทเรียน 79) · เพิ่ม `prosemirror.css` + `gapcursor.css` เข้า `style.css` — **ห้ามลบ**
  **[5][6] `aiConfigured()` ใน `ai-settings.js` = จุดเดียวที่ตอบว่า "ตั้งค่า AI ครบหรือยัง"**
    คืน `{ok, why}` · รู้จักทั้งทะเบียนของ alpha.61 (`meta.ai.providers[]`) · ollama · คีย์รูปแบบเก่า
    · `ai-ui.js` / `ai-summary.js` เลิกมี `aiReady()` ของตัวเอง · `callAI()` ไม่ตกไปทางเก่าเงียบ ๆ อีก
    · ปุ่ม ✨ (`generateSceneField`) เลิกเขียนทับข้อความบอกสาเหตุจริงด้วย "AI ไม่ได้ส่ง…กลับมา"
  **[7][8] `scroll-behavior:smooth` ออกจาก `.pane`/`#panes`** — ต้นเหตุเดียวของทั้ง "ขยับแผงแล้ว
    หน้ากระดาษเลื่อนเอง" และ "ซูมแล้วไหลไปชิดขอบซ้าย" (บทเรียน 80)
  **[9] ลบหน้าจอ loading เต็มจอทิ้ง** ⚠ ร้ายแรงที่สุดของรอบนี้ — `#k-loader` (z-index 999) ทับกล่อง
    "บันทึกก่อนปิด?" (`.k-overlay` z-index 80) ที่ `closeProjectIfAny()` เด้งระหว่าง `loadProject()`
    → กดอะไรไม่ได้เลย **ต้อง force quit** (บทเรียน 85) · ลบทั้ง HTML + CSS ·
    `showLoader`/`hideLoader` เหลือเป็นชื่อเก่าที่ชี้ไป `setBusy`/`clearBusy` · `loadProject` ครอบ try/finally
  **[10] แถบล่างบอกว่ากำลังทำอะไรอยู่** — `#status-busy` + API กลางใน core.js
    (`setBusy`/`clearBusy`/`busyMsg`/**`withBusy`**) · `pointer-events:none` ไม่บังอะไรเลย ·
    เดินสายแล้วที่: เปิดโปรเจกต์ (ทีละขั้น) · บันทึกทั้งหมด (`n/ทั้งหมด` + ชื่อไฟล์) ·
    ส่งออกเวิร์กโฟลว์/PDF/ZIP/JSON/HTML · นำเข้า ZIP/Scrivener · **ทุกคำขอ AI ผ่าน `sendRequest()` จุดเดียว**
  **[11] ตัวพิมพ์ใหญ่รายชนิด element** — `caps` เป็น *การแสดงผล* (`text-transform`) ไม่ใช่ตัวอักษรจริง
    → เปลี่ยน case สำเร็จแต่จอไม่ขยับ = ผู้ใช้อ่านว่า "ล็อก" · เดิมปิดได้แค่ทั้งบท/ตารางที่ซ่อนอยู่
    `CAPS_ELEMENTS`/`elementCaps`/`setElementCaps` ใน sp-format.js (**unit 14**) ·
    เมนู บท → 🔠 → **บังคับตัวพิมพ์ใหญ่เฉพาะชนิด** · `#tb-case` ปลดล็อก element ที่ถูกบังคับให้อัตโนมัติ
  **[12] สัดส่วนแผงดริฟต์ทุกรอบเปิด-ปิด** — `currentRatio()` วัดจาก DOM ที่รวมที่จับปรับขนาด
    → อ่านจาก layout tree แทน (บทเรียน 87)
  **[13] แผงแนวตั้งไม่จำตำแหน่ง** — `sideBetween()` ตอบ 4 ทิศ แทนที่จะคิดแค่แกนนอน (บทเรียน 88)
  **[14] ปุ่มคลังรูปเป็นสวิตช์** — `.tb-toggle` + `toggleGallery()` (แบบเดียวกับปุ่มแชท AI ในข้อ 2)
  **[15] ยุบศูนย์รวมเข้าแดชบอร์ด** — เลิกแท็บ `::centralize::` · `renderCentralize(host,{embedded:true})`
    ต่อท้าย `renderDashboard` · เมนูเดิมเปิดแดชบอร์ดแล้วเลื่อนไปที่ส่วนนั้น
  **[16] network · planner · floorplan เป็นแผง** — ชุดสุดท้ายที่ยังเป็นแท็บเทียม ·
    `netInst`/`plannerInst` แทน `tab.net`/`tab.planner` · Planner บันทึกเองแบบหน่วง 600ms (ไม่มีแท็บให้ dirty)
  **[17] ป้ายตรวจบทบนแถบล่างกดได้จริง** — `spErrorMenu()` (ไปข้อถัดไป · รายการทั้งหมด · ตรวจใหม่ · ตั้งค่า)
    · ป้ายมี `▾` บอกว่ากดได้ · `✅ ตรวจแล้ว` แทน `✅ 0`
  **[18][20] แผง `search` + `notes` ไม่เคยอยู่ใน `FEATURE_PANELS`** → กล่องเปล่าถาวรทุกทางเข้า
    ยกเว้นคำสั่งในเมนูที่เรียก render เอง (ดูหัวข้อ Panel System)
  **[19] `smartDirty()` ไม่มีอยู่จริง** ⚠ — ต้นเหตุ "ลบ element ตามประเภทใช้ไม่ได้"
    ReferenceError ใน onclick async ที่ไม่มีใครจับ → ลบสำเร็จแต่กล่องค้างเงียบ ๆ (บทเรียน 89)
    · อีกจุดอยู่ใน `revertTab` → บทหนังที่กด Revert แล้วพิมพ์ต่อ พังทุก keystroke
  **[21] ⚠ รากจริงของ 12+13: ปิดแผง = `removePanel()` ตัดโหนดออกจากต้นไม้**
    → สล็อตหาย (ต้องเดาตำแหน่งใหม่จาก "เพื่อนบ้านที่มุมซ้ายบนใกล้ที่สุด" ซึ่งเลือกผิดตัว:
    แผงที่ขอบบนของเอกสารมีมุมซ้ายบนใกล้แผงโปรเจกต์ฝั่งซ้ายมากกว่า → เปิดกลับไปโผล่ฝั่งซ้าย)
    + พี่น้องโดน `keepSizes`/`insertSize` เกลี่ยใหม่ทุกครั้ง
    **แก้: ติดธง `hidden` แทนการตัดทิ้ง** (แนวเดียวกับธง `collapsed` ที่มีอยู่แล้ว) —
    ตำแหน่ง/ทิศ/ลำดับ/`sizes` อยู่ครบ · เปิดกลับ = ถอดธง ไม่ต้องเดาอะไรเลย · ธงรอดการบันทึกด้วย
    (บทเรียน 90 · unit +14 · e2e [62-13] วางแผงบนขอบบนจริงแล้วปิด-เปิด)
  เก็บกวาด: `getBoard()` ของ Kanban เลือกเล่มแรกที่ **มีฉบับร่างจริง** (บทเรียน 82) ·
    e2e 3 จุดเปลี่ยนจากรอเวลาคงที่เป็นรอเงื่อนไขจริง (กล่องตั้งค่า · สถิติจัดการเล่ม · บันทึกทั้งหมด)

.63 **ยกเครื่องคลังรูปทั้งระบบ — อัลบั้ม · แท็ก · กระดานอารมณ์ · ติดตามการใช้งาน · สั่งเป็นชุด · ส่งออก · AI**
  โมดูลใหม่ 7 ตัวใน `src/gallery/` (บริสุทธิ์ + **unit test 199 ข้อ**) · `gallery.js` เขียนใหม่ทั้งไฟล์ · e2e 1,960 → **2,009**
  **[1] อัลบั้ม** = โฟลเดอร์จริงซ้อนชั้นได้ · sidebar ต้นไม้ · ลากรูปข้ามอัลบั้ม · เปลี่ยนชื่อ/ย้าย/ลบ (ถังขยะ)
    · **`_uncategorized` ชี้ไปที่ `Images/` เอง — migrate ไม่ย้ายไฟล์เลย** (บทเรียน 91)
    · `albums.json` + `album.json` ต่ออัลบั้ม · `images.json` ยังถูกสร้างใหม่ให้ v1 อ่านได้เสมอ
  **[2] แท็ก 3 ชนิด** `#ทั่วไป` `@เอนทิตี้` `~ฉาก` · กรอง AND/OR · คลิก `@` เปิดหน้า Wiki
    · **หน้า Wiki แสดงรูปที่ติดแท็ก `@ชื่อ` อัตโนมัติ** (`attachTaggedImages` ใน wiki-ui.js)
  **[3] กระดานอารมณ์** 1 กระดาน/อัลบั้ม เก็บใน `album.json → moodBoard` · ลาก/ปรับขนาด/ซูม-แพน/พอดีจอ/จัดเรียง
    · เอาออกจากกระดาน ≠ ลบไฟล์ · ส่งออกเป็น .png (วาดบน canvas ตามพิกัดจริง ไม่ขึ้นกับซูมที่ดูอยู่)
  **[4] ติดตามการใช้งาน** สแกน .md ทั้งโปรเจกต์ → ป้าย "ใช้ N" (คลิก = เมนูฉาก กระโดดไปได้) / "ยังไม่ถูกใช้"
    · ตัวกรองตามการใช้งาน · **ย้ายรูปแล้วถามให้แก้ลิงก์ในต้นฉบับตามให้** (บทเรียน 92)
  **[5] เมทาดาทา** ความละเอียด/ขนาด/วันที่/จำนวนการใช้ · การ์ดคลังรูปในแดชบอร์ด · IPC ใหม่ `fs:stat`
  **[6] เลือกหลายใบ** Ctrl/⌘+คลิก · Shift+ช่วง → แถบคำสั่งลอย (ย้าย/แท็ก/ส่งออก/ลบ)
  **[7] ค้นหา+เรียง** ชื่อ/คำบรรยาย/แท็ก · เรียง manual/ชื่อ/วันที่/ขนาด/การใช้งาน
  **[8] ส่งออก** อัลบั้ม · ที่เลือก · เฉพาะที่ใช้จริง → .zip (คงโครงอัลบั้ม + `รายการรูป.md`)
  **[9] AI** ตั้งคำบรรยาย/แนะนำแท็ก (ลอง vision ก่อน → ตกไปใช้บริบทจริง ไม่แต่งจากภาพที่ไม่ได้เห็น)
    · **หารูปคล้าย/รูปซ้ำด้วย aHash บน canvas — ไม่ต้องใช้ AI**
  เก็บกวาด: **บั๊กเก่า `sectionProps` ตั้งปกเล่มไม่เคยได้ผล** (`String(f)` บนออบเจกต์ → `"[object Object]"`) ·
    `pickImage()` คืน path สัมพัทธ์กับ `Images/` แล้ว · `resolveImg()` หา ​รูปที่ย้ายเข้าอัลบั้มเจอเอง ·
    Explorer เห็นรูปในอัลบั้มย่อยพร้อมหัวข้ออัลบั้ม · เมนู มุมมอง → คลังรูปภาพ เป็นเมนูย่อย 6 รายการ
  แพ็กแล้ว: `dist/Killian2-2.0.0-alpha.63r-mac-intel.dmg` (127MB · x86_64) — **รัน e2e จาก `.app` ที่แพ็กแล้วผ่าน 2,022 ALL OK ด้วย**
  บน GitHub: branch `alpha-63` (`JabCrossHook/Killian_Editor`)

.63r **เก็บงานคลังรูปตามที่ใช้จริง (3 ข้อ)**
  **[1] กระดานอารมณ์เป็นแผงของตัวเอง** (`gallery-board` · `gallery/moodboard-ui.js`) — เดิมเป็นแท็บในคลังรูป
    จึงลากรูปมาวางไม่ได้เลย (บทเรียน 95) · `gallery/gallery-bus.js` = อัลบั้มที่สองแผงใช้ร่วมกัน
    · `Gallery.reload()` ประกาศอัลบั้มทุกครั้ง (ไม่ใช่เฉพาะตอนคลิก) · ลากรูปข้ามอัลบั้มมาวางได้ (เก็บเป็น path เต็ม)
  **[2] รูปบนกระดานไม่ถูกครอบตัด** — `object-fit:contain` + `sizeForAspect()` ตอนวาง +
    ลากมุมคงสัดส่วนเป็นค่าเริ่มต้น (Alt = ยืดอิสระ) + คำสั่ง "ปรับให้ตรงสัดส่วนรูป" ทีละชิ้น/ทั้งกระดาน (บทเรียน 96)
  **[3] มุมมองตาราง 3 แบบ** ย่อ/เต็มรูป/รายการ (`CELL_MODES` · จำที่ `localStorage: k2-gal-cell`)
    · `bindItemEvents()` = ตัวผูกอีเวนต์ตัวเดียวที่การ์ดกับแถวใช้ร่วมกัน

**ยังเหลือ**: `search-engine.js` ยังเป็น orphan — Global Search (`global-search.js`) ยังสแกนไฟล์ตรง ๆ ไม่ได้ใช้ inverted index (ควรสลับมาใช้เพื่อความเร็ว) · multiple-drafts-per-book UI (โครงรองรับแล้ว), screenplay align persistence, Campaign/D&D mode, **code signing** + `.icns`/`.ico` icon (electron-builder ใช้ได้แล้ว แต่ยังไม่เซ็นและใช้ไอคอนเริ่มต้นของ Electron), native arm64 build. Top เคยบอก paper/indent "อาจต้องปรับปรุง ไว้ก่อน"

**นิสัยผู้ใช้ (Top)**: พูด "เริ่มเลย"/"continue"/"ทำต่อ"/"เอาให้จบ" = ให้ลงมือทำเลย **อย่าถามย้ำ scope** (เคยโดนบ่น "เช็คอะไรละ"). ชอบทำหลายฟีเจอร์รวดเดียวแล้วแก้บั๊กทีเดียว. ส่งสกรีนช็อตบั๊ก = pixel-verify คือเทสจริง. มักจบ session ด้วย "update skill"

---

## วิธีทำงาน

reproduce → แก้ root cause → **เพิ่ม selftest ถาวร** → build+e2e ALL OK → (ถ้า UI) pixel-check → bump version + CHANGELOG + README → rm+rezip + verify จากไฟล์แตกใหม่ → outputs + present. บอกข้อจำกัดตรงๆ (บนเครื่อง Top: mac Intel รัน+build+ทดสอบจริงได้ · **win/arm64 ยังทดสอบจริงไม่ได้**). งานใหญ่แยก phase + สื่อสารว่าอะไรเหลือ
