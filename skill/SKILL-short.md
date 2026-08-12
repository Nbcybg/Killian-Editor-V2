---
name: killian-2
description: Build, maintain, extend, and debug Killian 2 (คิเลียน / Killian Editor v2 / K2) — a portable Electron 43 + ProseMirror desktop app for writing novels + screenplays, Thai-first, storing everything as Markdown + JSON (100% file-compatible with the old Python v1). Use whenever the user asks to add a feature, fix a bug, change the UI, adjust the Wiki/screenplay/explorer/spellcheck/panel systems, or ship a new build for this writing app. Triggers on "คิเลียน", "Killian", "Killian 2", "K2", "โปรแกรมเขียน", "บทหนัง/บทภาพยนตร์", "screenplay editor", "ProseMirror", "SmartType", "wiki", "story network", "explorer", "scenes.json", "draft.json", "templates.json", "ตรวจคำผิด", "spell check", "panel docking", "floating bar", "e2e/selftest", "ถังขยะ", "คลังรูป", "เวิร์กโฟลว์ส่งออก/compile", "จัดการเล่ม/book manager", "เส้นเวลา/timeline", "แผนที่/maps", "โหมดหน้ากระดาษ/paper mode", "ซูม/zoom", "จัดหน้า/align", "หมวด wiki", "planner/กระดานวางแผน", "fabric", "connector/เส้นเชื่อม", "กริด/grid", "ภาษา/i18n/localize/แปล", "ไฟล์ภาษา CSV", and any request about this novel/screenplay app — even a pasted stack trace or a bare "แก้บั๊ก".
---

# Killian 2 (คิเลียน อีดิเตอร์ v2)

โปรแกรมเขียนนิยาย + บทภาพยนตร์ของ Top — **Electron 43 + ProseMirror**, พกพาได้, ไทยเป็นหลัก
เขียนใหม่จาก v1 (Python/Tkinter) แต่ **ไฟล์งานเข้ากันได้ 100%** (.md + .json เหมือนเดิม)

**คุยกับผู้ใช้เป็นภาษาไทย กระชับ ตรงไปตรงมา** ผู้ใช้ = Top (นักออกแบบ/dev, กรุงเทพฯ)

---

## เริ่มงานทุกครั้ง: เอาซอร์สมาก่อน

**เช็คก่อนว่ากำลังทำงานที่ไหน — สองโหมดนี้คนละเรื่องกัน**

### A) เครื่องผู้ใช้จริง (Claude Code บน Windows) ← โหมดที่ใช้บ่อยที่สุดตอนนี้
รีโป: `C:\Users\noobc\Desktop\Killian2` · git remote `github.com/JabCrossHook/Killian_Editor` (branch `master`)
มี `node_modules` + electron ครบแล้ว — แก้แล้ว build แล้วรันได้เลย ไม่ต้องขอ zip

```bash
node build.js            # esbuild → renderer/bundle.js  (ต้องเห็น "bundle OK")
npm run test:unit        # unit ของโมดูลบริสุทธิ์
npm run dist             # → dist/Killian2-<version>-portable.exe (~90MB, ใช้เวลา ~1 นาที)
```

**Bash tool ที่นี่คือ Git Bash** — `/tmp` ของ bash = `%LOCALAPPDATA%\Temp` แต่ `/tmp` ที่โค้ด Electron เขียน
= `C:\tmp` → ผลเทสอยู่ที่ **`C:/tmp/k2result.txt`** เสมอ · ฆ่าโปรเซสด้วย `taskkill //F //IM electron.exe`
(สองสแลชเพราะ MSYS แปลง path)

### B) แซนด์บ็อกซ์ Linux
อาจถูกล้างระหว่าง task — ถ้าไม่มีให้ขอ `Killian2-src.zip` (ล่าสุด) แตกที่ `/home/claude/work/v2_extract/`

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
- **preload.js** — บริดจ์ `kapi` (readFile/writeFile/readJson/exists/join/mkdir/move/remove/listFiles/listDirs/mtime/copyInto/writeImageData/spellBase/spellExtra/spellAddWord/spellDownload/spellHasBase/testShot). **ไม่มี writeJson** (ใช้ writeFile + JSON.stringify)
- **src/** (esbuild → `renderer/bundle.js`):
  - `md.js` — พาร์เซอร์ .md ↔ doc (พอร์ตตรงจาก v1 → ไฟล์เข้ากันได้ 100%)
  - `editor.js` — `KEditor` (นิยาย): schema + `mentionPlugin` + `spellPlugin` + export `imageLightbox`
  - `screenplay.js` — `SPEditor` (บทหนัง): fountain, Enter=element ถัดไป, **Ctrl+↑/↓ สลับ element** (Tab สงวนให้ SmartType), มี spellPlugin
  - `fountain.js` — `SP_ELEMS/TAB_CYCLE/NEXT_ELEM/SCENE_PREFIX/TIMES/TRANSITIONS`
  - `smart.js` — `SmartType` (เดาชื่อขณะพิมพ์ · prefix match ไทยไม่มีช่องว่าง)
  - `spell.js` — เอนจินตรวจคำผิด (ไทย maximal-matching DP + อังกฤษ wordlist+morphology) · `loadBase/setExtra/check/ready`
  - `wiki.js` — `WikiEditor` + `imageLightbox`
  - `gallery.js`, `network.js`, `ui.js` (**`window.prompt()` = no-op ใน Electron!** ใช้ ask/confirmBox)
  - **`i18n.js`** (alpha.76, บริสุทธิ์) — เอนจินภาษา: `T` tagged template (msgid = ประโยคไทยต้นฉบับ +
    `{0}`) · `tKey`/`tm` · `csvToTable`/`tableToCsv` · `langCodeFromFile` · **โหลดตาราง sync ตอน import**
    (`kapi.langSync`) — โมดูลไหนก็ import ได้ ไม่แตะ DOM · core.js re-export `T` ให้ทั้งโปรเจกต์
  - **`core.js`** — แกนกลางที่ทุกโมดูลใช้ร่วม: `$`,`el`,`state`,`smart`,`log`,`setStatus` + ค่าคงที่ (`DEFAULT_SETTINGS`,`SCENE_STATUSES`,`SCENE_COLORS`,`BUILTIN_CATS`,`CAT_ICON`,`BASE_ED_FS`,`ZOOM_*`) — **ทุกไฟล์ใหม่ import จากนี่**
  - `app.js` (~5,300 บรรทัด: bootstrap/explorer(buildTree)/tabs/toolbar(floatBar)/zoom(pageZoom)/commands/shortcuts/**selftest**) — orchestrator
  - **แยกจาก app.js แล้ว (alpha.39, feature modules):** `dashboard.js` · `books.js` · `timeline-ui.js` · `maps-ui.js` · `wiki-ui.js` · `scene-ops.js` · `section-ops.js` · `scene-props.js` · `dialogs.js` · `recycle.js` — จุดที่ feature ใหม่มาต่อยอด (ดู **AGENTS.md** สำหรับกฎ import/circular/CommonJS ก่อนแก้)
  - **`search-engine.js`** (alpha.39, บริสุทธิ์) — ค้นหาเต็มข้อความทั้งโปรเจกต์: tokenizer ไทย (`Intl.Segmenter('th')`+bigram fallback) → inverted index → `SearchIndex.build/search` (คำเดียว/AND/OR/NOT/`field:`) → snippet+line+score. `indexProject(root,kapi,parseMd)` เป็น integration layer. **unit test แยก · ค้น 1,000 ไฟล์ ~16ms/คิวรี**
  - **`panels/panel-layout.js` + `panel-store.js`** (alpha.39, บริสุทธิ์) — layout tree ของ panel: `snapZone`,`dockPanel`,`addAsTab/moveTab/splitTab`,`resizeDock`,`removePanel`(+collapse) · store: `serializeLayout`/versioning/migrate + `PanelStore`(รับ storage adapter). UI = panel-ui.js (opencode)
  - **`layout/split-layout.js`** (alpha.39, บริสุทธิ์) — recursive split tree: `splitPane`(ลากขอบ→row/col),`resizeSplit`(+snap 50%),`removeLeaf`(+collapse), `leaf.tabId` เชื่อมกับ Panel System · store: `serializeSplit`/`SplitStore`. UI = split-ui.js (opencode)
  - `compile.js` — **เอนจินเวิร์กโฟลว์ส่งออก** (บริสุทธิ์ ไม่แตะ DOM/fs): `STEP_DEFS` 3 stage (model/render/text), `PRESETS`×7, `runWorkflow(model,wf)`, `mdToHtml`, strip helpers — มี unit test แยก
  - `timeline.js` — **เอนจินเส้นเวลา + Gantt** (บริสุทธิ์): `extractNum` (ถอดเลขจากข้อความไทย "ปีที่ 1,024"→1024), `sortEvents`, `mergeTimeline(events,sceneEvents)` (**ต้อง copy ทุก field ที่ UI ใช้ รวม whenEnd**), `groupByTrack`, `findClashes`, `ganttData/ganttBar/ganttTicks`, `newEvent`
  - `maps.js` — **เอนจินแผนที่** (บริสุทธิ์ · unit 102): `newMap/newPin`, `breadcrumb` (world→city→room), `rootMaps`, `pinStats`, `deleteMap`
    · **[.70]** ซูม (`clampZoom/zoomStep/zoomScroll` — ซูมยึดกึ่งกลาง) · โอเวอร์เลย์ (`mapOverlays/gridLines`) ·
    หมวด (`groupMaps`) · ค้นหา (`matchPin`) · หลายหมุด (`movePins/deletePins/clonePins`) ·
    เส้นทาง (`newRoute/routePoints/routePath`) · ฉากบนหมุด (`scenePinCounts`) · `migrateMaps`
  - **โมดูลบริสุทธิ์ใหม่ .70–.74 (ทุกตัวมี unit test แยก — เพิ่ม logic ที่นี่ = ต้องเพิ่มเทส)**
    · `wiki-profile.js` (46) — หัวการ์ด Wiki จาก templates.json ล้วน ๆ + `mergeBuiltInTemplateMeta`
    · `log-core.js` (52) — ระเบียน log (`createLogStore/filterLogs/splitSource`) · **`splitSource` ต้องใช้
      `\p{L}\p{M}` + ธง `u`** (`\w` ไม่นับอักษรไทย และสระ/วรรณยุกต์เป็น combining mark)
    · `dirty-registry.js` (23) — ทะเบียนงานค้าง (กฎข้อ 1)
    · `network-theme.js` (50) — สี/ปุ่มเมาส์/กล้องของผัง (กฎข้อ 3) · `viewCenter/zoomAtCenter/axisVectors`
    · `branch-plans.js` (68) — แผนผังแตกสาย: `applyPlanChoices/comparePlans/planDirty/PLAN_STATUSES`
  - **`planner/` (alpha.65) — กระดานวางแผนแบบ Miro, 5 ชั้นแยกกันชัด** (เดิมเป็น `src/planner.js` ก้อนเดียว ลบไปแล้ว)
    - `planner-data.js` **บริสุทธิ์ 100%** (import แค่ `num.js`) — schema v4, CRUD node/edge/group, migrate v1→v2→v3→v4,
      grid+snap, `moveNodeZ` (ลำดับซ้อน), และ **เรขาคณิตเส้นทั้งชุด**: `portPoint`/`edgeGeometry`
      (straight·orthogonal·curved)/`edgePathString`/`edgeMidpoint`/`edgeAngles`/`trimGeometry` (ร่นปลายให้หัวลูกศร)/
      `sampleGeometry`+`distanceToPolyline` (ทดสอบคลิกโดนเส้นด้วยระยะจริง) → **unit test ได้หมด** (157 checks)
    - `planner-render.js` — fabric layer: `absBox()` (พิกัดจริงผ่าน `calcTransformMatrix`), `_forceBox()`
      (บังคับกรอบ group ให้เท่าขนาดการ์ดเป๊ะ), grid เป็น CSS บนตัวห่อ, ports/มือจับปลายเส้น, `restack()` ตาม layer+zIndex
    - `planner-interact.js` — tool modes, pan/zoom, drag-create + กรอบนำ, relink/unplug, คีย์ลัด, log สายกระดาน
    - `planner-ui.js` — แถบเครื่องมือเลื่อนได้ · รางเครื่องมือแนวตั้ง · ป๊อปอัปกริด · แถบสถานะ x/y · **แถบคุณสมบัติลอย**
    - `planner-props.js` — แผงคุณสมบัติ node/edge/หลายชิ้น
    - `planner.js` — orchestrator: ประกอบทุกชั้น + จัดการไฟล์กระดาน (`Planners/*.json`) + undo/redo + ส่งออก PNG
- **build**: `node build.js` (esbuild bundle src/app.js) — dict แยกไฟล์ไม่ฝัง bundle

โครงโปรเจกต์: `<root>/{project.khn.json, <Section>/{section.json (มี title/order/status/cover/blurb), Draft/<name>/{draft.json, scenes.json, Chapters/<folder>/*.md}}, Wiki|Bible/{characters,locations,items,lore,<หมวดเอง>}/*.json, Images/, Memos/, Snapshots/, Recycle/, timeline.json, maps.json, dictionary.json, Plugins/dictionaries/*.txt}`
- `project.khn.json` เก็บ settings + `compileWorkflows[]` (เวิร์กโฟลว์ผู้ใช้) + `wikiCats[{key,label,icon}]` (หมวด Wiki สร้างเอง)
- `scenes.json` แต่ละ scene row มี `storyDate` (เวลาในเรื่อง สำหรับเส้นเวลา) เพิ่มจากเดิม

---

## E2E test workflow (สำคัญ — ทำทุกครั้งก่อนเชื่อว่าแก้สำเร็จ)

Selftest ใน `app.js` (`check(name, cond, extra)` เขียน PASS/FAIL แล้ว throw ตอน fail). ปัจจุบัน **2,182 checks** target `ALL OK`. เพิ่มฟีเจอร์ = เพิ่ม check เสมอ (ห้ามลด). โมดูลบริสุทธิ์ (compile/timeline/maps/search-engine/panels/split/planner-data) มี unit test แยกรันด้วย node ก่อน แล้วค่อยเทส UI ใน e2e

**Unit test โมดูลบริสุทธิ์ (รันเร็ว ไม่ต้องเปิด electron):**
```bash
npm run test:unit                  # ทั้งชุด (~40 ไฟล์)
node test/planner-data.test.cjs    # 157 checks — schema v4/grid/snap/z-order/เรขาคณิตเส้น/หลายกระดาน
node test/search-engine.test.cjs   # 22 checks — tokenize/AND/OR/NOT/field/snippet/score/perf
node test/panel.test.cjs           # 26 checks — snap/dock/tab/resize/store/migrate
node test/i18n.test.cjs            # 56 checks — รหัสภาษาจากชื่อไฟล์/CSV ไป-กลับ/ชั้นทับกัน/แคช
```
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

**สูตรบน Windows (โหมด A) — ใช้บ่อยสุดตอนนี้ · รอบละ ~2.5 นาที:**
```bash
taskkill //F //IM electron.exe >/dev/null 2>&1
node build.js 2>&1 | tail -1 && rm -f "C:/tmp/k2result.txt" \
  && rm -rf "C:/Users/noobc/AppData/Local/Temp/k2proj" \
  && node test/fixture.js /tmp/k2proj >/dev/null 2>&1 \
  && KILLIAN_TEST=1 KILLIAN_TEST_PROJECT="C:/Users/noobc/AppData/Local/Temp/k2proj" \
     ./node_modules/.bin/electron . > "C:/tmp/k2elec.log" 2>&1 &
sleep 118; grep -m1 "^FAIL" "C:/tmp/k2result.txt"; echo "pass=$(grep -c '^PASS' C:/tmp/k2result.txt)"
```
แล้ววนรอจนกว่า `tail -1` = `ALL OK` (ปกติ ~2.5 นาที · หน้าต่างโผล่บนจอผู้ใช้จริง ปิดด้วย taskkill เมื่อจบ)
**ยืนยันตัว packaged ด้วย**: รัน `"./dist/win-unpacked/Killian 2.exe"` ด้วย env เดียวกัน → ต้อง ALL OK เท่ากัน

- `kapi.testShot('/tmp/x.png')` = สกรีนช็อต (บน Windows ออกที่ `C:\tmp\`) — **Read tool อ่านรูปได้ตรง ๆ บนเครื่องจริง**
  (บนแซนด์บ็อกซ์ที่ view คืน `[image]` ว่าง ให้ใช้ PIL pixel-check crop แทน)
- ผลสตรีมทีละบรรทัด — **อย่าอ่านก่อนจบ** · `grep -c` ระหว่างที่ไฟล์กำลังถูกเขียนทับอาจได้ 0 ชั่วคราว (ไม่ใช่ของจริง)
- เพิ่มเทสในบล็อกที่ tab นั้น active สดๆ อยู่แล้ว (ดูบทเรียน matchesNode)

**กับดักในการ "เขียนเทส" ที่เผาเวลาไปหลายรอบ (alpha.65r):**
- **อย่าเรียกฟังก์ชันที่มีกล่องยืนยันในเทส** — `deleteToTrash()` มี `confirmBox` → เทสค้างรอคลิกตลอดกาล
  (อาการ: PASS หยุดนิ่งกลางทาง ไม่มี FAIL ไม่มี STOP) ใช้ `kapi.remove()` ตรง ๆ แทน
- **`kapi` เป็น frozen contextBridge** — monkey-patch (`kapi.listFiles = ...`) ทำ renderer ตายเงียบ ๆ ทั้งตัว
- **อย่าวัดผลทันทีหลังสั่งเปิด/วาดแผง** — หลายแผงวาดแบบ async (คลังรูป, แดชบอร์ด) ต้อง `until62(...)`/วนรอเงื่อนไขจริง
  ไม่ใช่ `setTimeout` เดาเวลา · เจอ 2 เคสที่ผ่านมาตลอดแล้วมาแตกตอนโค้ดรอบใหม่ทำให้ timing ขยับนิดเดียว
- **โหนดที่เก็บไว้ก่อนหน้าอาจหลุดจาก DOM** — ระบบแผงวาดใหม่ทั้งก้อนตอนพับ/คลี่ → `getComputedStyle()` คืนค่าว่าง
  ต้อง query สดหลังทุกการกระทำที่ทำให้ re-render
- **กล่อง dialog ค้างจากเทสก่อนหน้า** ทำให้ `document.querySelector('.k-dialog')` หยิบผิดตัว →
  ล้าง `.k-overlay` ก่อน แล้วใช้กล่อง**ล่าสุด** (`[...qsa].pop()`)

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
14. **Thai sort ทำ default map/section เลือกผิด**: `sortMaps` เรียงตามชื่อไทย → "เมือง"(เ) มาก่อน "โลก"(โ) → default currentId ผิด. **อย่าพึ่งชื่อ ใช้ `order` เป็นตัวเรียงหลัก** (Book Manager/Timeline/Maps ทุกตัวเก็บ order)
15. **view tool คืน [image] ว่างช่วงกลาง session** → PIL pixel-analysis แทน: color histogram (`Counter` สแกน crop) หา card-bg/accent-orange, หรือวัดความกว้างแถบสีกระดาษ (%ของจอ) เพื่อยืนยัน layout

### บทเรียน CSS/เลย์เอาต์ (alpha.65r — Planner)

16. **`position:absolute` + `top:` ฮาร์ดโค้ด คู่กับแถบที่ `flex-wrap`** = ระเบิดเวลา · แถบเครื่องมือขึ้นบรรทัดที่สอง
    เมื่อไหร่ canvas ที่ตรึง `top:84px` ก็คลุมทับปุ่มทันที ("กดอะไรไม่ได้เลย") → **แผงที่มีหลายแถบให้ใช้ flex column เสมอ**
17. **`:has(#id)` ทำให้ specificity พุ่ง** — `.k-panel:has(#planner-body) > .k-panel-body` = (1 ID, 2 class)
    **ชนะ** `.k-panel.k-collapsed > .k-panel-body` = (3 class) → พับแผงแล้วเนื้อไม่หาย
    กฎกลางที่ต้องชนะทุกกรณี (พับ/ซ่อน) **ต้องใส่ `!important`**
18. **`min-height` บนเนื้อแผง = แผงย่อไม่ลง** · ตั้ง `min-height:0` แล้วให้ตัวเนื้อ (canvas) หดตามได้จริง
    (พื้น 4px พอ ไม่ใช่ 120px) — ไม่งั้นผู้ใช้ลากขอบยังไงก็ไม่สุด

### บทเรียน fabric.js (alpha.65r — เจ็บหนักสุดในรอบนี้)

19. **`getBoundingRect(true)` / `aCoords` ไม่รวม matrix ของกลุ่ม** — คำนวณจาก `left/top` ของตัวเองล้วน ๆ
    พอวัตถุอยู่ใน `activeSelection` ค่านั้นเป็นพิกัด **เทียบจุดกึ่งกลางกล่องเลือก** ไม่ใช่ของกระดาน
    → เอาไปเขียนเป็นพิกัดจริง = การ์ดกระเด็นมั่วทันที · **ใช้ `qrDecompose(obj.calcTransformMatrix())` แทน**
    และ **ห้ามแตะ `left/top` ของสมาชิกกล่องเลือก** ปล่อยให้ fabric คืนพิกัดเองตอนยุบกล่อง
20. **กรอบของ `fabric.Group` = ขอบนอกสุดของลูกทุกตัว** (รวมเส้นขอบ 1px ที่ล้นข้างละครึ่ง) → อ่านขนาดกลับมาเพี้ยน
    **สะสมทุกครั้งที่ย่อ/ขยาย** (180 → 364 ในสองครั้ง) · แก้ด้วยการบังคับ `width/height` แล้วเลื่อนลูกชดเชยครึ่งส่วนต่าง
21. **fabric ทดสอบการชนด้วยกรอบสี่เหลี่ยม** (ถ้าไม่เปิด `perPixelTargetFind`) — เส้นทแยง/เส้นโค้งจึงกินพื้นที่
    ทั้งผืนระหว่างปลายทั้งสอง แย่งคลิกวัตถุข้าง ๆ · `perPixelTargetFind` ก็แพงมาก (render ทีละพิกเซลทุก hit-test)
    **ทางที่ถูก: เก็บเส้นเป็นชุดจุดแล้ววัดระยะเอง** (`sampleGeometry` + `distanceToPolyline`) — เร็วกว่าและแม่นกว่า
22. **`uniformScaling` ดีฟอลต์ = true** → ลากมุมล็อกสัดส่วนตลอด · ถ้าไปปิดปุ่มกลางขอบด้วยจะยืดด้านเดียวไม่ได้เลย
23. **`fireMiddleClick` ดีฟอลต์ = false** → fabric ไม่ยิงอีเวนต์ปุ่มกลางเลย ทำ pan ด้วยล้อกลางไม่ได้
    (`fireRightClick` เป็นคนละตัว ต้องเปิดแยก)
24. **`canvas._offset` ค้างเมื่อ canvas ถูกย้ายที่ใน DOM** (ปิด/เปิดแผง, ย้าย dock) → `getPointer()` เพี้ยนทั้งกระดาน
    กรอบนำตอนลากสร้างไปโผล่นอกจอ = ดูเหมือน "ไม่ทำงาน" · **เรียก `calcOffset()` ทุกครั้งที่กดเมาส์ + ทุกครั้งใน `fit()`**
    (ระวัง optimization แบบ "ขนาดเท่าเดิม → return" จะข้าม `calcOffset()` ไปด้วย — เคยพลาดมาแล้ว)
25. **`setWidth/setHeight` เขียน attribute ของ `<canvas>` = ล้างภาพทั้งผืน** · ผูกกับ ResizeObserver ที่ยิงถี่ = กะพริบรัว
    → ข้ามถ้าขนาดเท่าเดิม + รวบเป็นเฟรมเดียวด้วย rAF + `renderAll()` ทันทีในเฟรมเดียวกัน
26. **`strokeDashArray` ที่ถูก override ตอน "ถูกเลือก"** ทำให้ผู้ใช้กดเปลี่ยนลายเส้นแล้วไม่เห็นอะไรเปลี่ยน
    (เพราะตอนกดปุ่ม เส้นนั้นกำลังถูกเลือกอยู่พอดี) — บอกสถานะเลือกด้วยความหนา/เงาแทน
27. **`evented` ต้องเดินคู่ `visible` เสมอ** — วัตถุที่ซ่อนแต่ยัง `evented:true` จะดักคลิกแทนของที่อยู่ข้างใต้
28. **เครื่องมือวาดต้องปิด `evented` ของวัตถุเดิมทั้งกระดาน** ไม่งั้นเริ่มลากทับการ์ดไหน fabric ก็ไปลากการ์ดนั้นแทน
    (`selectable:false` อย่างเดียวไม่พอ)

### บทเรียน i18n (alpha.76 — ยกเครื่องระบบภาษา)

37. **ค่าคงที่ระดับโมดูลถูกคำนวณตอน import** — `const OPTS = [{label: T`ร่าง`}]` ที่ท็อปเลเวล
    ถ้าโหลดไฟล์ภาษาแบบ async ทีหลัง ค่าพวกนั้น**ค้างภาษาเดิมตลอดอายุโปรแกรม**
    → `src/i18n.js` โหลด CSV **แบบ synchronous** (`ipcRenderer.sendSync` ผ่าน `kapi.langSync`)
    ในบอดี้ของตัวเอง ซึ่ง esbuild วางไว้บนสุดของบันเดิล · **ห้ามเปลี่ยนเป็น async**
    · เปลี่ยนภาษาระหว่างรัน → ข้อความที่เรียก T`` ตอนวาดเปลี่ยนทันที แต่ค่าคงที่ต้องเริ่มโปรแกรมใหม่
      (กล่องตั้งค่าจึงถามว่าจะรีสตาร์ตไหม — ข้ามคำถามนี้ในโหมดเทส ไม่งั้นค้างรอคลิก)
38. **regex ใช้หา string literal ไม่ได้** — `/^```/` ใน md.js ถูกอ่านเป็นสตริงทันที · ต้องมีเลกเซอร์
    ที่รู้จักคอมเมนต์/regex literal/`${}` ซ้อนชั้น (`tools/js-lex.cjs`) ไม่งั้นโคดมอดทำซอร์สพัง
    · **โทเคนที่ซ้อนกัน**: `` `… ${x || 'ว่าง'}` `` เลกเซอร์คืนตัวในก่อนตัวนอก → เรียง edit ตามตำแหน่งเอง
      และ template ให้ **แทรก `T` ข้างหน้า** ไม่ใช่แทนที่ทั้งช่วง (ไม่งั้นทับ edit ของตัวข้างใน)
39. **ไฟล์ภาษาหลายชั้นต่อกันแล้วพาร์สทีเดียว → คีย์แรกต้องชนะ** (ของโปรเจกต์มาก่อนของโปรแกรม)
    และต้อง **กวาด BOM ทั้งข้อความ** ไม่ใช่แค่ตัวหน้า — BOM ของไฟล์ชั้นที่ 2 ไปติดหัวคีย์แรกของชั้นนั้น
40. **`require()` ในไฟล์ preload ล้มเสมอ** (sandbox เปิดโดยดีฟอลต์ตั้งแต่ Electron 20)
    — `require('./package.json').version` เงียบ ๆ ตกไปใช้ค่าสำรอง ทำให้กล่อง "เกี่ยวกับ" โชว์รุ่นผิดมานาน
    ต้องการค่าจาก main ให้ใช้ `ipcRenderer.sendSync`
41. **เทสที่รอเวลาตายตัวจะแตกเฉพาะตัว packaged** (บูตช้ากว่า dev เพราะอ่านจาก asar)
    — เจอ 2 จุดในรอบนี้: หน้าต่างแผงที่ฉีกออกมารายงานสภาพไม่ทัน 1400ms · กล่องยืนยันลบไม่ทัน 60ms
    แล้ว `await` ค้างตลอดกาล · **ยืนยัน dev ผ่านอย่างเดียวไม่พอ ต้องรัน `dist/win-unpacked` ด้วยเสมอ**
    · e2e สองรอบติดที่ผลต่างกันโดยโค้ดไม่เปลี่ยน = มี electron ค้างอยู่แย่งเครื่อง (`tasklist | grep -i electron`)

### บทเรียนอื่น

29. **`buildTree()` เดิมคืนทันทีถ้ามีงานสร้างค้างอยู่** → `await buildTree()` คืนก่อนต้นไม้มีของใหม่จริง
    โค้ดถัดไปเลยอ่านต้นไม้เวอร์ชันเก่า · แก้ให้คืน promise ที่ resolve หลังรอบถัดไปจบ
30. **ส่วนที่เพิ่มใหม่ใน `buildTree` ต้องมี try/catch ของตัวเอง** — พังตรงไหนก็ไม่ถึงบรรทัดสลับ buffer
    → ต้นไม้ค้างของเก่า **กดรีเฟรชยังไงก็ไม่ขยับ** (อาการหลอกมาก)
31. **`.gitignore` ที่ถูกต่อบรรทัดด้วย PowerShell อาจเป็น UTF-16** (ตัวอักษรคั่นด้วย NUL) → git อ่านบรรทัดนั้นไม่ออก
    เคยทำให้ `dist*/` ไม่ถูกละเว้น (เกือบ commit 486MB) · เช็คด้วย `grep` ว่ารายงานเป็น "Binary file"
32. **[alpha.75 · K-1 — ไล่อยู่ 4 วัน] คลาส CSS ที่ไม่ผูกกับที่อยู่ = ระเบิดเวลาข้ามฟีเจอร์**
   `.planner-dirty { opacity:0; transition:opacity .15s }` เป็น CSS ของ **จุด ● บนแถบเครื่องมือ Planner**
   (ซ่อนไว้เป็นค่าเริ่มต้น แล้ว `.planner-toolbar.is-dirty .planner-dirty { opacity:1 }` ค่อยโชว์)
   — **แถวใน Explorer ใช้ชื่อคลาสเดียวกันเพื่อบอก "ยังไม่บันทึก"** จึงรับ `opacity:0` ไปเต็ม ๆ
   ผลคือแถวค่อย ๆ **จางหายไปต่อหน้า** (มี transition ด้วย) ทั้งที่ยังอยู่ใน DOM ครบทุกอย่าง
   · **ทำไมไล่ไม่เจอนานขนาดนั้น** — ทุกเครื่องมือที่ติดไว้มองไม่เห็นปัญหาชนิดนี้เลย:
     `MutationObserver` ไม่มีอะไรให้จับ (ไม่มีใครถอด/ซ่อนแถว) · `auditPlannerRows()` ดูแค่ `display` ·
     e2e เช็ค `display !== 'none'` + ข้อความในแถว → **ผ่านหมดทั้งที่ผู้ใช้มองไม่เห็นแถว**
     · ไล่ผิดทางไป 5 รอบ (เขียนทับบรรทัดว่าง · กวาดทุกแถว · buildTree คืนก่อนเสร็จ · หมวดพัง · ตัวกรอง)
   · **สิ่งที่พาไปเจอคือคำอธิบายอาการของผู้ใช้**: "ก่อนหายมันเปลี่ยนเป็นสีส้ม" = จังหวะที่แถวได้คลาสนั้นพอดี
     → **ถามอาการก่อน-หลังเสมอ อย่าถามแค่ "หายตอนไหน"**
   · กฎที่ต้องถือ: **selector ของ widget ต้องผูกกับที่อยู่ของมันเสมอ** (`.planner-toolbar .planner-dirty`)
     และ **คลาสสถานะของแถวในต้นไม้ต้องมี prefix ของตัวเอง** (`k-row-open` / `k-row-unsaved`)
   · กฎเทส: **"มองเห็นไหม" ต้องวัด `opacity` + `visibility` + `getBoundingClientRect()` ไม่ใช่แค่ `display`**
     — เขียนเทสพิสูจน์กลไกไว้ด้วย (วาง element ที่มีคลาสนั้นนอกที่อยู่ของมัน แล้ววัด opacity)
     ย้อน CSS กลับเป็นแบบเดิมแล้วรันจริง → ได้ `opacity=0` ตามคาด = ยืนยันว่าเจอต้นตอ ไม่ใช่เดา
   · **ซ้ำรอยบทเรียนข้อ 10** (`.k-ok` ชนกันระหว่าง dialog กับปุ่มบันทึกของ Wiki) — ครั้งนั้นเสียเวลาน้อยกว่า
     เพราะอาการโผล่ทันที ครั้งนี้ซ่อนตัวได้นานเพราะ "มองไม่เห็น" ไม่เท่ากับ "ไม่มีอยู่"


---

## Build recipes (app ไม่ต้องมี node_modules ตอน runtime — main/preload ใช้แค่ electron+fs/path/url, bundle.js มี prosemirror ครบ)

Electron **43.1.1**. github (allowlist: github.com + release-assets.githubusercontent.com):
`https://github.com/electron/electron/releases/download/v43.1.1/electron-v43.1.1-<PLATFORM>.zip`
PLATFORM = `win32-x64` / `darwin-arm64` / `darwin-x64`

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

- **ตั้งค่า**: `settingsDialog()` แท็บ ทั่วไป/การเขียน/ปุ่มลัด → `project.khn.json` ผ่าน `saveProjectMeta()`. `DEFAULT_SETTINGS` = autoSaveMinutes/maxBackups/autoBackup/lineNumbers/uiFontSize/spellCheck/spellCheckDict/autoMention/recycleDays/shortcuts
- **ปุ่มลัดตั้งเอง**: `onShortcut()` วน `effectiveShortcuts()` = `SHORTCUTS` merge `settings.shortcuts[id]` (id=channel+args). แท็บ "ปุ่มลัด" อัดคีย์ (บังคับ Ctrl/⌘), `accelText` แสดง ⌘⇧ บน mac
- **ตรวจคำผิด**: 2 ชั้นผสมได้ — `spellCheck` (Chromium อังกฤษ) + `spellCheckDict` (spell.js ไทย+อังกฤษ, decoration `.k-spell-bad`). dict แยกไฟล์ (assets + `Plugins/dictionaries/*.txt` + `dictionary.json`). คลิกขวาคำแดง→เพิ่มคำ
- **SmartType บทหนัง** (Final Draft): `spSmartCheck` + `screenplayTerms(tab)` สแกน sp doc เก็บ character/location ที่พิมพ์ในบทเอง รวม SCENE_PREFIX/TIMES/TRANSITIONS
- **relationship**: `relationDialog` (target dropdown + role datalist) → `_syncInverse` เขียนฝั่งตรงข้าม (`invertRole` ใช้ `INV` cache, ต้อง `warmInverse()`) + คลิกชื่อ→`onOpenEntity`. `reloadIfExists()` รีเฟรชแท็บเปิดค้าง
- **Wiki images**: เพิ่มจากไฟล์ หรือ **เลือกจากคลัง** (`pickFromGallery`→pickImage). คลิกรูป→`imageLightbox`
- **Explorer**: `buildTree()` — sections→chapters→scenes(สี/สถานะ/⭐flag/#tags) + Memo + **กระดานวางแผน** + Wiki + คลังรูป + ถังขยะ. `#tree-search`→`filterTree(q)` (ชื่อ/แท็ก/สถานะ). scene มี `title` tooltip (hover) + `dataset.search`
  · สร้างแบบ double-buffer (ประกอบใน fragment แล้วสลับครั้งเดียว) + กัน re-entrant · **ใช้ `refreshTreeQueued()` เมื่อต้องการให้เข้าคิว**
  · `filterTree` ข้ามแถวที่มี `data-nofilter` และไม่เอา `treeScope` ไปใช้กับแถวกระดาน (ไม่มี chGuid)
- **Panel docking**: `makeFloatablePanel(panel, head, key)` — ⧉ ลอย/ผนึก, ลากหัวแผง (`makeDraggable`), resize มุมขวาล่าง, **snap** ลากชิดซ้าย(<70px)→ผนึก+`.k-dock-hint`. floatable: `#outline-panel`, `#tree-panel`
- **Floating format bar**: `setupFloatingFormatBar()` ย้ายปุ่มจัดรูปแบบ (id เดิม + #tb-source) เข้าแถบลอยใน #content. dblclick grip=reset. `syncFloatBarVisible()` ใน refreshToolbar
- **UI layout persist**: localStorage `k2-ui-layout` (ก้อนเดียว) ผ่าน `uiLayout()/saveUiLayout()`
- **สลับนิยาย↔บทหนัง**: `switchFormat()` — ใช้ `tab.body` verbatim ตอน !dirty (fountain round-trip ข้าม grammar ไม่ได้)
- **snapshot**: auto-backup ตอน saveTab → `Snapshots/` (ts เป็น ms กันชน), pruneSnapshots เก็บ maxBackups ที่ไม่มี label

### ระบบใหม่ (alpha.30–37 — Storyteller-inspired)

- **เวิร์กโฟลว์ส่งออก (compile)** — ไฟล์→ส่งออกด้วยเวิร์กโฟลว์ (Ctrl+Shift+E). `openCompileDialog()` ใช้ `buildDraftModel(dPath,title)` (แชร์กับ `compileDraftText`/`exportDraft`). พรีเซ็ต builtIn แก้ไม่ได้ (ต้อง clone). เก็บใน `project.khn.json→compileWorkflows`. ตรรกะอยู่ `compile.js` (`runWorkflow`)
- **หมวด Wiki สร้างเอง** — `wikiCats:[{key,label,icon}]` ใน project.khn.json. `BUILTIN_CATS`=[characters,locations,items,lore] ลบไม่ได้. `newWikiCat/editWikiCat/deleteWikiCat` (กันลบหมวดที่มีของ), `applyWikiCats()` ยัด label ไทยเข้า `CAT_TH`, `catLabel/catIcon`. buildTree + template manager รวมหมวดเอง
- **แดชบอร์ด analytics** — `renderDashboard` เก็บ byStatus + chapterWords, `statBars()` วาดแถบสัดส่วน (สถานะฉาก / Wiki ตามหมวด / ความยาวบท)
- **จัดการเล่ม (Book Manager)** — `openBookManager()` tab `::books::`. การ์ดต่อเล่ม: ปก(pickImage→`section.json→cover` เป็น `../Images/<f>`), ชื่อแก้ inline, สถานะ(`SECTION_STATUSES`), คำโปรย, สถิติ(`sectionStats()`), ลากสลับลำดับ(`reorderSections()`). helpers: `listSections()/saveSectionMeta()`. section.json มี title/order/status/cover/blurb
- **เส้นเวลา (Timeline)** — `openTimeline()` tab `::timeline::`. **2 มุมมอง สลับได้** (`state._tlView` cards/gantt): (1) การ์ด = เลนตาม track เรียงตามเวลา; (2) **Gantt** = แท่งตามช่วงเวลาบนแกน (`ganttData/ganttBar/ganttTicks` ใน timeline.js) ใช้ `whenEnd` เป็นจุดจบแท่ง. `sceneEventsFromProject()` ดึงฉากที่มี `storyDate` (ตั้งใน sceneProps ทั้ง dialog+panel) มาแสดงอัตโนมัติ. event เอง→`timeline.json`. `eventDialog()` (title/when/whenEnd/track/sort/desc). ตรรกะ `timeline.js`. **ระวัง: `mergeTimeline` ต้อง copy ทุก field ที่มุมมองใช้** (เคยลืม whenEnd → Gantt แท่งกลายเป็นจุดหมด)
- **แผนที่ (Maps)** — `openMaps()` = **แผง** `maps` (`mapsState_C.s` + `view` ใน maps-ui.js). หมุด 3 ชนิด entity/portal/note ·
  portal = world→city→room + breadcrumb · เก็บ `maps.json` v1.1
  · **[.70–.71]** ซูม (Ctrl+ล้อ · `.map-canvas` กว้างเป็น % ของกรอบ = ระดับซูม) · โอเวอร์เลย์ ▦🧭📏 ·
  ค้นหาหมุด · เลือกหลายหมุด (Ctrl+คลิก / Shift+ลากกรอบ) + copy-paste ข้ามแผนที่ · หมวดแผนที่ ·
  **เส้นทาง** (SVG viewBox 0–100 + `preserveAspectRatio=none` → **ต้องใส่ `vector-effect="non-scaling-stroke"`**
  และวาดเลขลำดับเป็น HTML ไม่ใช่ `<text>`) · ส่งออก PNG/พิมพ์ · **รูปประจำตัวบนหมุดเอนทิตี้** ·
  **โหมดเครื่องมือ** (👆 เปิด · ✎ แก้ไข · ✥ ย้าย — ลากได้เฉพาะโหมด ✥) · แถวแผนที่ใน Explorer
- **ผังแตกสาย (Branching)** — แผง `branch` · **[.73–.74] หลายแผนต่อโปรเจกต์** (`Branches/*.json`):
  แผนถือ **`plan.choices` ของตัวเอง** (เปิดแผนอยู่แล้วแก้ทางเลือก **ห้ามแตะ `scenes.json`**) +
  คุณสมบัติชุดเดียวกับฉาก (สถานะ/สี/แท็ก/เล่ม/โน้ต) + **⇋ เทียบสองแผน** ·
  ฉากที่แผนไม่พูดถึง = ไม่มีทางเลือก (**ห้าม fallback ไปของเดิม** ไม่งั้นลบทางเลือกออกจากแผนไม่ได้)
- **โหมดหน้ากระดาษ (paper mode)** — `togglePaper()` + `body.paper-mode` (ค่าเริ่มต้นเปิด, เก็บใน settings). กระดาษครีม `--paper:#f5f1e6` (ปรับได้), นิยาย+บทหนังใช้กรอบเดียวกัน. ปุ่ม 📄 `#tb-paper` (ไม่ disable ตอนไม่มี editor)
- **ซูมหน้ากระดาษ** — `pageZoom` (0.5–2.5), `applyZoomVars(off)` set `--ed-fs`/`--sp-fs`/`--page-zoom`; CSS `max-width:calc(940px*var(--page-zoom,1))`. slider ล่างขวาใน statusbar (`#zoom-slider/#zoom-label`) + Ctrl+ล้อ/=/-//Shift+0. **font preview ในตั้งค่าต้องเรียก `applyZoomVars(val)`** ไม่งั้นเมินซูม
- **จัดหน้า (align)** — attr `align` บน paragraph/heading (prose) + sp node. `cmd('align',dir)` ทั้ง 2 editor, ปุ่ม `#tb-align-*` + Ctrl+Shift+L/K/R/J. prose persist เป็น `<!--align:x-->` นำหน้าบล็อก (md.js, v1 เปิดได้). **บทหนัง align = session-only** (ไม่ persist กันพัง fountain round-trip)
- **screenplay indent** — margin sp element เป็น % (`.sp-character 38%`, dialogue 19%, parenthetical 29%) scale ตามซูม. `classify()` character auto-detect รับชื่อผสมพิมพ์เล็ก/ไทย (ไม่บังคับ ALL-CAPS)

---

## เวอร์ชัน (ล่าสุด **alpha.76** · e2e ALL OK **2,782** ทั้ง dev และตัว packaged · unit ทั้งชุดผ่าน · push ขึ้น GitHub แล้ว)

.13–.22 (v1→v2 พื้นฐาน): snapshot, line numbers, spellcheck ไทย+Chromium, ปุ่มลัดตั้งเอง, mac build, บทหนัง Ctrl+arrow, relationship sync, floating format bar, sidebar resize, SmartType Final Draft, wiki gallery/lightbox, explorer search+tags, panel docking, tree float+snap
.24 batch 8 (drag-move explorer, panel snap, split compare, version tracking, scene lock, screenplay Final Draft look, screenplay images, wiki links) · .25–.27 **Planner board** (fabric.js) · .28 **floating windows** · .29 memo-in-chapter + scoped search
.30 **compile workflows** + **หมวด Wiki สร้างเอง** + **dashboard analytics** · .31 section mgmt + wiki field-linking + explorer flicker fix + ctrl-wheel zoom + page align + screenplay smart-type fix · .32 **Book Manager** · .33 **paper mode** · .34 กระดาษครีม + unified display + wiki-link ทุก sp block · .35 real page-zoom + zoom slider + screenplay indent fix · .36 **Timeline** · .37 **Maps** (world→city→room) · .38 **Gantt view** ในเส้นเวลา
.39 **Phase 1** (save-all/log system+viewer/explorer accordion/dirty badge/floating-bar reorder) + **แยก app.js → core.js + 11 feature modules** (มี AGENTS.md ให้ opencode) + **3 เอนจินบริสุทธิ์ใหม่**: full-text **search-engine** (inverted index, ค้น 1k ไฟล์ ~16ms) · **Panel System** docking (panel-layout/store) · **Split View** (split-layout) — logic+unit test เสร็จ, UI ส่ง opencode ทำต่อ

.40–.64 (ไม่ได้จดละเอียดในสกิลนี้): Kanban · Story Network 3D/2D · AI (วิเคราะห์/ผู้ช่วยเขียน/ลงมือทำเองได้ 15 คำสั่ง) ·
บทหนังชุดใหญ่ (validator/reports/export/title page/CONTINUED) · คลังรูป+อัลบั้ม+กระดานอารมณ์ · i18n · PDF generator
**.65 + .65r–.65r8 — ยกเครื่อง Planner เป็นกระดานแบบ Miro** (ดู [CHANGELOG.md](../../CHANGELOG.md) ในรีโป — ละเอียดกว่า)
- .65 เขียนใหม่ทั้ง 5 ชั้น · v4.0 schema · เครื่องมือครบ · กริด · หลายกระดาน · แผงคุณสมบัติ
- .65r–.65r3 รอบเก็บบั๊กจากผู้ใช้ 3 รอบ (19 ข้อ) — ส่วนใหญ่เป็นกับดักของ fabric (ดูบทเรียนข้อ 19–28)
- .65r4–.65r8 log system + วินิจฉัยแถวกระดานใน Explorer + แผงย่อได้สุด + ตัวกรองไม่กลืนแถว

**.66–.69r** — ยกเครื่องระบบแผง (scroll/ขนาด/drop zone/เวิร์กสเปซ/กลุ่มลอย) · **Tear-off** ฉีกแผงเป็นหน้าต่าง OS จริง
(เฟส 2 + `panel-sync.js` ส่ง state.active ข้ามหน้าต่าง) · แผงใหม่ 📚 สารานุกรม · 🕘 ประวัติการทำงาน · 🗒 บันทึกประจำวัน
· **บทเรียน**: เมนู native เป็นจุดบอดของ e2e → เมนูแผงต้องสร้างจาก `MENU_PANELS` ก้อนเดียว + ช่อง `menu:panelIds` ให้เทียบกับ `PANEL_DEFS`

**.70–.74 — 5 รุ่นรวด (แผนที่ · รูปประจำตัว/เทมเพลต · log/งานค้าง · Story Network · แผนผังแตกสาย)**
- **.70 แผนที่ทั้งชุด (11 ข้อ)** — ต้นตอ: ระบบแผนที่ทำงาน **ทางเดียว** (ผังพื้นที่เขียน `sc.mapId/pinId` ได้
  แต่ไม่มีใครอ่านกลับ) → ปุ่ม "🗺 ดูบนแผนที่" ในคุณสมบัติฉาก **ทั้งกล่องและแผง** · ป้ายจำนวนฉากบนหมุด ·
  ซูม · โอเวอร์เลย์กริด/เข็มทิศ/มาตราส่วน · ส่งออก PNG/พิมพ์ · เลือกหลายหมุด + copy-paste ข้ามแผนที่ ·
  ค้นหาหมุด · หมวดแผนที่ · **เส้นทาง (routes)** · แถวแผนที่ใน Explorer · `maps.json` v1.1 (+`migrateMaps`)
- **.71 รูปประจำตัว + เทมเพลต Wiki** — ต้นตอ 1: `loadAllEntities()` ส่ง `image:''` **ตายตัว** → โค้ดวาดรูปใน
  Story Network ไม่มีทางทำงาน · ซ้ำด้วย preload ที่ตั้ง `img.src` แล้วคืนทันทีไม่รอ `onload`
  · ต้นตอ 2: หัวการ์ด Wiki อยู่ใต้ `if (entityTypeKey === 'characters')` + อ่าน `fields.Role/Status`
  ด้วยชื่อที่เขียนตายในโค้ด (เทมเพลตไม่เคยมี field `Status` ด้วยซ้ำ)
- **.72 กฎงานค้าง + log** — ดูหัวข้อ "กฎถาวรจากผู้ใช้" ด้านล่าง
- **.73 Story Network + แผนผังแตกสาย + minW** — ตำแหน่งโหนด · ปุ่มเมาส์/สีที่เคยฮาร์ดโค้ด · X/Y/Z ·
  `Branches/*.json` · `minW` ใน `PANEL_DEFS`
- **.74 ปิดเคส K-1** + แผนผังแตกสายเก็บทางเลือกของตัวเอง (ดูด้านล่าง)

**.76 — 🌐 ยกเครื่องระบบภาษา: ทุกข้อความออกจากโค้ดไปอยู่ใน CSV**
- **ต้นตอ**: ระบบภาษาเดิมมีแค่ 718 คีย์ ขณะที่ไทยฮาร์ดโค้ดในซอร์ส **8,259 จุด** → แปลได้ ~8% ของหน้าจอ
- ยกออกมา **4,553 จุดใน 128 ไฟล์** ด้วยโคดมอด (`tools/i18n-extract.cjs` + `tools/js-lex.cjs`)
  · ไม่แตะ: บล็อกเทส 3,713 · ค่าที่เขียนลงไฟล์งาน 43 · คีย์ object 37 · args ของ split/replace 7 ·
    console 6 · ตัวเปรียบเทียบ 4
  · 3 ด่านก่อนเขียนทับไฟล์: ค่าจริงของ literal ทุกตัวต้องเท่าเดิม · esbuild พาร์สผ่าน · import ครบ
- **ไฟล์ภาษา = `languages/k2_<code>.csv`** (2 คอลัมน์ `key,text` + BOM) — **รหัสอ่านจากชื่อไฟล์**
  วาง `k2_ja.csv` เพิ่มแล้วเปิดใหม่ก็มีเลย · ค้นหา: โปรเจกต์ → ข้าง exe → userData → resources → appDir
  (คีย์แรกที่เจอชนะ) · **ลบ `languages/*.json` ทิ้งแล้ว** — เหลือทางอ่านไว้เผื่อโปรเจกต์เก่าเท่านั้น
- เมนู OS แปลด้วย (main เป็น CJS มี `T` ตัวเล็กอ่าน CSV ก้อนเดียวกัน · `lang:set` → สร้างเมนูใหม่)
- ตั้งค่า → 🌐 ภาษา: รายชื่อจากผลสแกนไฟล์จริง + ส่งออกตารางแปล (`key,th,<lang>`) · เปิดโฟลเดอร์ · โหลดใหม่
- **กล่อง "เกี่ยวกับ" มีเครดิตแล้ว** — `CREDITS` ใน app.js เป็นแหล่งเดียว (Claude/Claude Code ·
  DeepSeek/opencode · Electron · ProseMirror · Fabric · pdf-lib · JSZip · Fuse.js · ฟอนต์ + สัญญาอนุญาต)
- **สถานะการแปล**: ไทย 100% (ภาษาต้นฉบับ) · อังกฤษ 712 จาก 4,241 คีย์ — ที่เหลือช่องว่าง = ตกกลับเป็นไทย

### ⚠️ กฎถาวรที่ผู้ใช้กำหนด (ห้ามฝ่าฝืน — เขียนไว้ใน AGENTS.md ด้วย)

0. **« ห้ามฮาร์ดโค้ดข้อความไทย — ทุกข้อความที่ผู้ใช้เห็นต้องแปลได้จาก CSV โดยไม่ต้อง build »** (.76)
   → ห่อด้วย ``T`…` `` จาก `src/i18n.js` (`setStatus(T`บันทึกแล้ว`)` · ``T`บทที่ ${n}` ``)
   · **ค่าที่เขียนลงไฟล์งานห้ามห่อ** (สถานะฉาก · คำนำหน้าหัวฉาก fountain · ชนิดความสัมพันธ์ · แท็ก ·
     คีย์ของ object) — เก็บเป็นไทยเสมอ แล้วแปลตอนแสดงผลด้วย `dataLabel(v)` จาก core.js
   · ตรวจด้วย `npm run i18n` (เหลือกี่จุด ที่ไหน) · ห่อให้อัตโนมัติด้วย `npm run i18n:apply`
   · ยกเว้นไฟล์/ช่วงบรรทัดได้ที่ `SKIP_FILES`/`SKIP_RANGES` ใน `tools/i18n-extract.cjs` **พร้อมเหตุผล**


1. **« อะไรที่มีการทิ้งเมื่อปิด หรือ update ตอนปิดโปรแกรม ต้องขึ้น list ทุกครั้ง »** (.72)
   → `src/dirty-registry.js` · `registerDirtySource(id,{label,list,save})` ใน `registerDirtySources()` ของ app.js
   กล่อง "บันทึกทั้งหมด"/"ปิดโปรแกรม" อ่านจากทะเบียนตัวเดียว **ห้ามไปแก้กล่องบันทึกทีละที่**
   · ลงทะเบียนแล้ว: แท็บ · กระดานวางแผน · แผนผังแตกสาย · **บันทึกไม่สำเร็จ = ไม่ปิดโปรแกรม**
   · คู่กัน: **ปิด "แผง" ≠ ทิ้งงาน** — แผงที่ยังถือสถานะในหน่วยความจำห้ามตั้ง `setPanelCloseGuard` ให้ถามบันทึก
2. **« เทมเพลต Wiki ห้ามฮาร์ดโค้ด ต้องดึงจาก JSON เท่านั้น »** (.71)
   → `src/wiki-profile.js` + บล็อก `profile` ใน `templates.json` (`subtitleField`/`statusField`/`badgeFields`/`statusWords`)
   ไม่มีบล็อก = โชว์แค่รูป+ชื่อ (**ห้ามเดาชื่อ field ในโค้ด**) · รูปประจำตัวเป็นของ `entity.images` จึงมี **ทุกหมวด**
   · โปรเจกต์เก่า: `mergeBuiltInTemplateMeta()` ก็อปคีย์ที่ขาดจาก templates.json ที่แถมมา (ห้ามทับของที่ผู้ใช้แก้)
3. **« ห้ามฮาร์ดโค้ดปุ่มเมาส์ / สี — ต้องตั้งได้ และ tooltip ต้อง sync กับค่าที่ตั้ง »** (.73)
   → `settings.netControls` (ปุ่มหมุน 3D · ค่าเริ่มต้น = **ปุ่มกลาง**) + `src/network-theme.js` (`NET_COLOR_DEFS`)
   นิยามสีที่เดียว — กล่องตั้งค่าสร้างช่องเอง · ชิปแถบเครื่องมือ + ตัววาดอ่านจากตัวเดียวกัน
   **unit test กวาด `network.js` หาเลข hex ที่หลุด** — มีเมื่อไหร่เทสแดงทันที
4. **« ห้ามใช้สัญลักษณ์บอกสถานะบนแถว Explorer — ใช้ตัวหนา/สีแทน »** (.74)
   → `markPlannerRow`/`markBranchPlanRow` แตะแค่ `class` **ห้ามเขียนทับ `textContent`** ของแถวเด็ดขาด

### ✅ K-1 ปิดเคสจริงแล้ว (.75) — แถวไม่ได้ "หาย" แต่ถูกทำให้ **โปร่งใส**

**ต้นตอ: ชื่อคลาสชนกัน (บทเรียนข้อ 10 ซ้ำรอย)**

```css
/* CSS ของ "จุด ● บนแถบเครื่องมือ Planner" — ซ่อนไว้เป็นค่าเริ่มต้น */
.planner-dirty { color:var(--accent); opacity:0; transition:opacity .15s; }
.planner-toolbar.is-dirty .planner-dirty { opacity:1; }
```

แถวใน Explorer ใช้ชื่อคลาสเดียวกัน → พอกระดาน "ยังไม่บันทึก" แถวก็รับ `opacity:0`
ไปด้วย + มี `transition` → **เปลี่ยนเป็นสีส้มแล้วค่อย ๆ จางหาย** (เบาะแสของผู้ใช้ชี้ขาด)

ทำไมเครื่องมือที่ติดไว้จับไม่ได้เลย: แถวยังอยู่ใน DOM ครบ · `display` ปกติ · ข้อความครบ
→ `MutationObserver` ไม่มีอะไรให้จับ · `auditPlannerRows()` บอกว่าปกติ · e2e เช็คแต่ `display` จึงผ่านตลอด

**แก้**: แถวมีคลาสของตัวเอง `k-row-open` / `k-row-unsaved` · จุด ● ผูกกับ `.planner-toolbar` ·
ตาข่าย `#tree .scene { opacity:1; visibility:visible; }`

**กฎที่ต้องจำ (สำคัญกว่าตัวบั๊ก)**:
1. **ชื่อคลาสของ widget ต้องผูกกับที่อยู่เสมอ** (`.planner-toolbar .planner-dirty` ไม่ใช่ `.planner-dirty` ลอย ๆ)
2. **เทสที่ถามว่า "มองเห็นไหม" ต้องดู `opacity`/`visibility`/ขนาดจริงด้วย ไม่ใช่แค่ `display`**
3. มีเทสกวาดทุกแถวใน Explorer + เทสพิสูจน์กลไก (วาง probe นอกแถบเครื่องมือแล้ววัด opacity)
   — ย้อน CSS กลับเป็นแบบเดิมแล้วรันจริง **ได้ `opacity=0` ตามคาด** (ยืนยันว่าเจอต้นตอ ไม่ใช่เดา)

**ยังเหลือ (ไม่ใช่ Storyteller)**: **UI ของ 3 เอนจินใหม่** (search panel, panel-ui docking, split-ui) + **wire เข้า app.js** (search-engine/panels/split ยังเป็น orphan module ยังไม่ถูก import — opencode/รอบ integration ต่อ UI + เพิ่ม selftest ใน app.js) · multiple-drafts-per-book UI (โครงรองรับแล้ว), screenplay align persistence, Campaign/D&D mode, electron-builder + code signing, .icns/.ico icon, native arm64 build. Top เคยบอก paper/indent "อาจต้องปรับปรุง ไว้ก่อน"

**นิสัยผู้ใช้ (Top)**: พูด "เริ่มเลย"/"continue"/"ทำต่อ"/"เอาให้จบ" = ให้ลงมือทำเลย **อย่าถามย้ำ scope** (เคยโดนบ่น "เช็คอะไรละ"). ชอบทำหลายฟีเจอร์รวดเดียวแล้วแก้บั๊กทีเดียว. ส่งสกรีนช็อตบั๊ก = pixel-verify คือเทสจริง. มักจบ session ด้วย "update skill"

---

## วิธีทำงาน

reproduce → แก้ root cause → **เพิ่ม selftest ถาวร** → `npm run i18n` (ข้อความใหม่ต้องห่อ T`` ครบ) →
build+e2e ALL OK → (ถ้า UI) pixel-check →
bump version + **CHANGELOG.md** + README → **บนเครื่องจริง: `npm run dist` แล้วรัน e2e กับ `dist/win-unpacked` ซ้ำอีกรอบ**
→ ส่งไฟล์ด้วย SendUserFile · (บนแซนด์บ็อกซ์: rm+rezip + verify จากไฟล์แตกใหม่ → outputs + present)
งานใหญ่แยก phase + สื่อสารว่าอะไรเหลือ

**เขียนสรุปยังไงให้ผู้ใช้ชอบ** (ดูจากรอบ alpha.65 ที่ได้ผลดี): บอก**ต้นตอจริง**ของบั๊กเป็นประโยคเดียวก่อน
แล้วค่อยบอกว่าแก้ยังไง — ผู้ใช้สนใจ "ทำไมมันพัง" มากกว่ารายการสิ่งที่ทำ · ตารางบั๊ก/ต้นตอ/แก้แล้ว อ่านง่ายที่สุด
· **ถ้ายังหาต้นตอไม่เจอ ให้พูดตรง ๆ ว่ายังไม่เจอ** แล้วบอกว่าติดเครื่องมืออะไรไว้ให้ไล่ต่อ อย่าเดาแล้วเคลมว่าแก้แล้ว
· ถ้า agent/ผู้ใช้วิเคราะห์มาให้ ให้**ตรวจทีละข้อแล้วบอกว่าข้อไหนจริงข้อไหนไม่ตรง** อย่ารับมาทั้งดุ้น
