---
name: killian-2
description: Build, maintain, extend, and debug Killian 2 (คิเลียน / Killian Editor v2 / K2) — a portable Electron 43 + ProseMirror desktop app for writing novels + screenplays, Thai-first, storing everything as Markdown + JSON (100% file-compatible with the old Python v1). Use whenever the user asks to add a feature, fix a bug, change the UI, adjust the Wiki/screenplay/explorer/spellcheck/panel systems, or ship a new build for this writing app. Triggers on "คิเลียน", "Killian", "Killian 2", "K2", "โปรแกรมเขียน", "บทหนัง/บทภาพยนตร์", "screenplay editor", "ProseMirror", "SmartType", "wiki", "story network", "explorer", "scenes.json", "draft.json", "templates.json", "ตรวจคำผิด", "spell check", "panel docking", "floating bar", "e2e/selftest", "ถังขยะ", "คลังรูป", "เวิร์กโฟลว์ส่งออก/compile", "จัดการเล่ม/book manager", "เส้นเวลา/timeline", "แผนที่/maps", "โหมดหน้ากระดาษ/paper mode", "ซูม/zoom", "จัดหน้า/align", "หมวด wiki", and any request about this novel/screenplay app — even a pasted stack trace or a bare "แก้บั๊ก".
---

# Killian 2 (คิเลียน อีดิเตอร์ v2)

โปรแกรมเขียนนิยาย + บทภาพยนตร์ของ Top — **Electron 43 + ProseMirror**, พกพาได้, ไทยเป็นหลัก
เขียนใหม่จาก v1 (Python/Tkinter) แต่ **ไฟล์งานเข้ากันได้ 100%** (.md + .json เหมือนเดิม)

**คุยกับผู้ใช้เป็นภาษาไทย กระชับ ตรงไปตรงมา** ผู้ใช้ = Top (นักออกแบบ/dev, กรุงเทพฯ)

---

## เริ่มงานทุกครั้ง: ซอร์สอยู่ในเครื่อง Top แล้ว

**ไม่ต้องขอ zip อีกแล้ว** — ทำงานบนรีโปจริงในเครื่อง (mac Intel · รัน/บิลด์/เทสได้ครบ)

```bash
cd "/Users/kaipleng/Desktop/Killian_Editor-master 2"   # ← ที่ทำงานหลัก (มี node_modules ครบ)
git log --oneline -1        # ล่าสุด: alpha.69r (tear-off เฟส 2 + Codex/History/Record)
```

- GitHub: `JabCrossHook/Killian_Editor` · สาขาหลัก `master` · สำรองก่อนรอบแผง: `backup/master-alpha66r-2026-08-11`
- `dist/` ถูก gitignore (ไฟล์ .dmg ไม่ขึ้น repo) · `renderer/bundle.js` **ถูก commit** (ต้อง `node build.js` ก่อน commit เสมอ)
- **ผู้ใช้ยังมี SKILL.md ฉบับเต็มในรีโป** (285KB — บทเรียน/ประวัติครบทุกรุ่น) เปิดอ่านเมื่อต้องขุดของเก่า

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
  - **`core.js`** — แกนกลางที่ทุกโมดูลใช้ร่วม: `$`,`el`,`state`,`smart`,`log`,`setStatus` + ค่าคงที่ (`DEFAULT_SETTINGS`,`SCENE_STATUSES`,`SCENE_COLORS`,`BUILTIN_CATS`,`CAT_ICON`,`BASE_ED_FS`,`ZOOM_*`) — **ทุกไฟล์ใหม่ import จากนี่**
  - `app.js` (~5,300 บรรทัด: bootstrap/explorer(buildTree)/tabs/toolbar(floatBar)/zoom(pageZoom)/commands/shortcuts/**selftest**) — orchestrator
  - **แยกจาก app.js แล้ว (alpha.39, feature modules):** `dashboard.js` · `books.js` · `timeline-ui.js` · `maps-ui.js` · `wiki-ui.js` · `scene-ops.js` · `section-ops.js` · `scene-props.js` · `dialogs.js` · `recycle.js` — จุดที่ feature ใหม่มาต่อยอด (ดู **AGENTS.md** สำหรับกฎ import/circular/CommonJS ก่อนแก้)
  - **`search-engine.js`** (alpha.39, บริสุทธิ์) — ค้นหาเต็มข้อความทั้งโปรเจกต์: tokenizer ไทย (`Intl.Segmenter('th')`+bigram fallback) → inverted index → `SearchIndex.build/search` (คำเดียว/AND/OR/NOT/`field:`) → snippet+line+score. `indexProject(root,kapi,parseMd)` เป็น integration layer. **unit test แยก · ค้น 1,000 ไฟล์ ~16ms/คิวรี**
  - **`panels/`** — **Panel System แบบ Photoshop (ใช้งานจริงเต็มตัวตั้งแต่ alpha.46 · ยกเครื่องยาวถึง 66r12)**
    · `panel-layout.js` (บริสุทธิ์) = layout tree: `snapZone`/`edgeZone`/`dockPanel`/`addAsTab`/`resizeDockPair`/`removePanel`
      \+ **โมเดลขนาด**: `pxW/pxH` = โหมดผนึก · `fW/fH` = โหมดลอย (แยกกัน ติดตัวโหนด)
      **กฎเหล็ก: ขนาดอยู่ที่ "ลูกของ dock" ซึ่งเป็น `tabs`/`dock` ได้ ไม่ใช่แค่ `panel`**
      → `nodePxDeep` (อ่านทะลุคอนเทนเนอร์) · `dockChildOf` (ไต่ขึ้นไปหาก้อนที่ต้องตรึง) ·
      `collapse()` ต้องส่งต่อ px ให้ตัวที่รอด · `nodeFloatBox` อ่านแยกแกน
    · `panel-store.js` = `PanelStore` (serialize/migrate/workspaces) + `PanelManager` (API ที่ UI เรียกทั้งหมด)
    · `panel-renderer.js` / `panel-drag.js` / `panel-ui.js` = DOM จริง · `panel-export.js` = ส่งออกเลย์เอาต์เป็น JSON
      (มุมมอง → แผง → 📤 · **ให้ผู้ใช้ส่งไฟล์นี้มาเวลารายงานบั๊กเรื่องแผง — มีทั้งต้นไม้ ขนาดจริงบนจอ และผลวินิจฉัย**)
  - **`layout/split-layout.js`** (alpha.39, บริสุทธิ์) — recursive split tree: `splitPane`(ลากขอบ→row/col),`resizeSplit`(+snap 50%),`removeLeaf`(+collapse), `leaf.tabId` เชื่อมกับ Panel System · store: `serializeSplit`/`SplitStore` · UI ต่อแล้วที่ `split-ui.js` (60 unit checks)
  - `compile.js` — **เอนจินเวิร์กโฟลว์ส่งออก** (บริสุทธิ์ ไม่แตะ DOM/fs): `STEP_DEFS` 3 stage (model/render/text), `PRESETS`×7, `runWorkflow(model,wf)`, `mdToHtml`, strip helpers — มี unit test แยก
  - `timeline.js` — **เอนจินเส้นเวลา + Gantt** (บริสุทธิ์): `extractNum` (ถอดเลขจากข้อความไทย "ปีที่ 1,024"→1024), `sortEvents`, `mergeTimeline(events,sceneEvents)` (**ต้อง copy ทุก field ที่ UI ใช้ รวม whenEnd**), `groupByTrack`, `findClashes`, `ganttData/ganttBar/ganttTicks`, `newEvent`
  - `maps.js` — **เอนจินแผนที่** (บริสุทธิ์): `newMap/newPin`, `breadcrumb` (ลำดับชั้น world→city→room ตาม portal), `rootMaps`, `pinStats`, `deleteMap` (ล้าง portal ค้าง), `PIN_COLORS/PIN_KIND`
- **build**: `node build.js` (esbuild bundle src/app.js) — dict แยกไฟล์ไม่ฝัง bundle

โครงโปรเจกต์: `<root>/{project.khn.json, <Section>/{section.json (มี title/order/status/cover/blurb), Draft/<name>/{draft.json, scenes.json, Chapters/<folder>/*.md}}, Wiki|Bible/{characters,locations,items,lore,<หมวดเอง>}/*.json, Images/, Memos/, Snapshots/, Recycle/, timeline.json, maps.json, dictionary.json, Plugins/dictionaries/*.txt}`
- `project.khn.json` เก็บ settings + `compileWorkflows[]` (เวิร์กโฟลว์ผู้ใช้) + `wikiCats[{key,label,icon}]` (หมวด Wiki สร้างเอง)
- `scenes.json` แต่ละ scene row มี `storyDate` (เวลาในเรื่อง สำหรับเส้นเวลา) เพิ่มจากเดิม

---

## E2E test workflow (สำคัญ — ทำทุกครั้งก่อนเชื่อว่าแก้สำเร็จ)

Selftest ใน `app.js` (`check(name, cond, extra)` เขียน PASS/FAIL แล้ว throw ตอน fail). ปัจจุบัน **2,526 checks** (alpha.69r) target `ALL OK`. เพิ่มฟีเจอร์ = เพิ่ม check เสมอ (ห้ามลด). โมดูลบริสุทธิ์ (compile/timeline/maps/search-engine/panels/split) มี unit test แยกรันด้วย node ก่อน แล้วค่อยเทส UI ใน e2e

**Unit test โมดูลบริสุทธิ์ (alpha.39, รันเร็ว ไม่ต้องเปิด electron):**
```bash
npm run test:unit                  # รันชุดบริสุทธิ์ทั้งหมด (36 ไฟล์) — ควรรันตัวนี้ก่อนเสมอ
node test/panel.test.cjs           # 264 checks — dock/tab/resize/store + px ลึก/กลุ่มลอย/ส่งออก
node test/search-engine.test.cjs   # 22 checks · node test/split.test.cjs  # 60 checks
```
เทคนิค: ไฟล์ src เป็น ES module แต่ root ไม่ใช่ `type:module` → test เป็น `.cjs` ที่ `esbuild.buildSync({format:'cjs'})` แปลงชั่วคราวแล้ว `require`. โมดูลบริสุทธิ์ (ไม่ import DOM/kapi) จึงเทสได้ตรง ๆ — เพิ่ม unit test ทุกครั้งที่เพิ่ม logic ในไฟล์เหล่านี้

**รันบน macOS จริง (ไม่มี xvfb · หน้าต่างเด้งขึ้นมา ~4 นาที) — แยกทีละคำสั่ง อย่าต่อกันเป็นชุดเดียว**
```bash
# 1) ฆ่า zombie — ⚠ macOS ไม่มี `xargs -r` (GNU only) ใช้แล้วคำสั่งตายกลางทาง
for p in $(ps aux | grep "[e]lectron" | awk '{print $2}'); do kill -9 "$p" 2>/dev/null || true; done
ps aux | grep "[e]lectron" | wc -l          # ต้อง 0 ก่อนไปต่อ
# 2) build + เตรียมโปรเจกต์ทดสอบ (เทสฮาร์ดโค้ด path นี้)
node build.js                                # ต้องเห็น "bundle OK"
rm -f /tmp/k2result.txt && node test/fixture.js /tmp/k2proj >/dev/null 2>&1
# 3) รัน (คำสั่งแยกของตัวเอง)
KILLIAN_TEST=1 KILLIAN_TEST_PROJECT=/tmp/k2proj nohup ./node_modules/.bin/electron . >/tmp/k2elec.log 2>&1 &
# 4) รอจนจบจริง แล้วค่อยอ่าน (background + until — อย่า sleep เดา)
until [ "$(tail -1 /tmp/k2result.txt | cut -c1-6)" = "ALL OK" ] || grep -q "^STOP" /tmp/k2result.txt; do sleep 3; done
grep -c PASS /tmp/k2result.txt; grep -E "FAIL|STOP" /tmp/k2result.txt | head -3
```
**⚠ ยืนยันว่า "รอบใหม่รันจริง" ก่อนอ่านผล** — เผาไป 2 รอบใน .66r12: คำสั่งชุดเดียวตายกลางทาง
แล้ว `/tmp/k2result.txt` ยังเป็นของรอบเก่า · เช็คด้วย **เนื้อหา**: `grep -c "<ป้ายเช็คใหม่>" /tmp/k2result.txt`

- `kapi.testShot('/tmp/x.png')` = สกรีนช็อต · **view tool คืน [image] อ่านไม่ได้** → PIL pixel-check crop แทน
- ผลสตรีมทีละบรรทัด — **อย่าอ่านก่อนจบ** (รอ ALL OK / sleep ครบ)
- เพิ่มเทสในบล็อกที่ tab นั้น active สดๆ อยู่แล้ว (ดูบทเรียน matchesNode)

---

## บทเรียน env/บั๊ก (เจ็บมาแล้ว — อย่าซ้ำ)

0. **[macOS · alpha.66r12] อ่านผล e2e ของ "รอบที่ไม่ได้รัน"** (เผา 2 รอบ) — `xargs -r` ไม่มีบน macOS
   (GNU only) → คำสั่งชุดเดียวที่ต่อกันด้วย `;`/`&&` ตายกลางทาง แล้ว `rm -f /tmp/k2result.txt` ไม่ได้รัน
   → อ่านไฟล์ผลของรอบเก่าแล้วสรุปผิดว่า "แก้ไม่ติด" · **แยกรันทีละคำสั่ง + ยืนยันจากเนื้อหา**
   (`grep -c "<ป้ายเช็คใหม่>"`) และ **ห้าม grep ข้อความไทยในบันเดิล** — esbuild escape เป็น `\uXXXX`
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

---

## Build recipes (app ไม่ต้องมี node_modules ตอน runtime — main/preload ใช้แค่ electron+fs/path/url, bundle.js มี prosemirror ครบ)

**macOS Intel DMG — ทางหลักตอนนี้ (ทำบนเครื่อง Top ได้เลย ~3 นาที)**
```bash
npm run dist:mac                     # = node build.js && electron-builder --mac dmg --x64
git checkout HEAD -- package.json    # ⚠ ต้องทำทุกครั้งหลัง build (ดูกับดักข้างล่าง)
# ได้ dist/Killian2-<version>-mac-intel.dmg (~127MB) + dist/mac/Killian 2.app
open "dist/mac/Killian 2.app"        # smoke test — ต้องเปิดขึ้นและไม่ crash
```
> ⚠ **กับดัก: `electron-builder` เขียนทับ `package.json` แล้วลบ `scripts`/`devDependencies`/`build` ทิ้ง**
> (เกิดตอน `@electron/rebuild` รัน npm install ใน appDir) → `npm run test:unit`/`dist:mac` รอบถัดไปพังทันที
> · commit ก่อน build แล้ว `git checkout HEAD -- package.json` หลัง build = ปลอดภัยที่สุด
> · ยังไม่เซ็นใบรับรอง (`identity:null`) → ผู้ใช้ต้อง **คลิกขวา → Open** ครั้งแรก · ยังไม่มีไอคอน `.icns`
> · ตรวจว่าโค้ดใหม่อยู่ในบิลด์จริง: `grep -ac "<ชื่อฟังก์ชันใหม่>" "dist/mac/Killian 2.app/Contents/Resources/app.asar"`
>   (ต้องใช้ `-a` เพราะ asar เป็นไบนารี · **ข้อความไทยหาไม่เจอ** — esbuild escape เป็น `\uXXXX`)

Electron **43.1.1** (dev ใช้ 43.2.0). สำหรับบิลด์ platform อื่นด้วยมือ:
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
- **Explorer**: `buildTree()` — sections→chapters→scenes(สี/สถานะ/⭐flag/#tags) + Memo + Wiki + ถังขยะ. `#tree-search`→`filterTree(q)` (ชื่อ/แท็ก/สถานะ). scene มี `title` tooltip (hover) + `dataset.search`
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
- **แผนที่ (Maps)** — `openMaps()` tab `::maps::` (state ใน `mapsState`). รูปเป็นแผนที่, คลิกปักหมุด (พิกัด %), หมุด 3 ชนิด entity/portal/note, ลากย้ายได้. portal = ลำดับชั้น world→city→room + breadcrumb. `pinDialog()`. เก็บ `maps.json`. ตรรกะ `maps.js`
- **โหมดหน้ากระดาษ (paper mode)** — `togglePaper()` + `body.paper-mode` (ค่าเริ่มต้นเปิด, เก็บใน settings). กระดาษครีม `--paper:#f5f1e6` (ปรับได้), นิยาย+บทหนังใช้กรอบเดียวกัน. ปุ่ม 📄 `#tb-paper` (ไม่ disable ตอนไม่มี editor)
- **ซูมหน้ากระดาษ** — `pageZoom` (0.5–2.5), `applyZoomVars(off)` set `--ed-fs`/`--sp-fs`/`--page-zoom`; CSS `max-width:calc(940px*var(--page-zoom,1))`. slider ล่างขวาใน statusbar (`#zoom-slider/#zoom-label`) + Ctrl+ล้อ/=/-//Shift+0. **font preview ในตั้งค่าต้องเรียก `applyZoomVars(val)`** ไม่งั้นเมินซูม
- **จัดหน้า (align)** — attr `align` บน paragraph/heading (prose) + sp node. `cmd('align',dir)` ทั้ง 2 editor, ปุ่ม `#tb-align-*` + Ctrl+Shift+L/K/R/J. prose persist เป็น `<!--align:x-->` นำหน้าบล็อก (md.js, v1 เปิดได้). **บทหนัง align = session-only** (ไม่ persist กันพัง fountain round-trip)
- **screenplay indent** — margin sp element เป็น % (`.sp-character 38%`, dialogue 19%, parenthetical 29%) scale ตามซูม. `classify()` character auto-detect รับชื่อผสมพิมพ์เล็ก/ไทย (ไม่บังคับ ALL-CAPS)

---

## เวอร์ชัน (ล่าสุด **alpha.69r** · e2e ALL OK 2,526 · unit panel 286 + panel-sync 67 + panels69 102)

**.67–.68** Tear-off: ฉีกแผงออกเป็นหน้าต่าง OS จริง — .68 เปิดครบถึงแผงที่ผูกกับ "ฉากที่เปิดอยู่"
ผ่าน `panels/panel-sync.js` (หน้าต่างหลักประกาศฉาก → ลูกประกอบ **แท็บจำลอง** วางที่ `state.active`
โค้ดเดิม ~890 จุดใช้ได้ทันที) · **.68r** กลุ่มแท็บที่ผนึกอยู่ เหลือแท็บเดียวแล้วต้องเลิกเป็นกลุ่ม
(บั๊กเก่าตั้งแต่ .62: ปิดแผง = ติดธง `hidden` แต่ `collapse()` นับจาก `children.length` ซึ่งไม่ลด)

**.69** แผงใหม่ 3 ตัว: **Codex** (สารานุกรม + ส่งออกเว็บแบบ Fandom) · **History**
(copy-on-write ที่ `H('fs:*')` ใน main → ย้อนกลับได้จริง · เก็บ 32 ครั้ง) · **Record** (จดรายวัน + CSV)
· **.69r** ทำเสร็จแล้วผู้ใช้หาไม่เจอ เพราะเมนู native เป็นรายการเขียนมือใน main.js —
แก้เป็น `MENU_PANELS` ก้อนเดียว + เปิดช่อง `menu:panelIds` ให้ e2e เทียบกับ `PANEL_DEFS` ทุกรอบ

## เวอร์ชัน (alpha.66r12 · e2e ALL OK 2,421 · commit `5afcc47` บน master)

.13–.22 (v1→v2 พื้นฐาน): snapshot, line numbers, spellcheck ไทย+Chromium, ปุ่มลัดตั้งเอง, mac build, บทหนัง Ctrl+arrow, relationship sync, floating format bar, sidebar resize, SmartType Final Draft, wiki gallery/lightbox, explorer search+tags, panel docking, tree float+snap
.24 batch 8 (drag-move explorer, panel snap, split compare, version tracking, scene lock, screenplay Final Draft look, screenplay images, wiki links) · .25–.27 **Planner board** (fabric.js) · .28 **floating windows** · .29 memo-in-chapter + scoped search
.30 **compile workflows** + **หมวด Wiki สร้างเอง** + **dashboard analytics** · .31 section mgmt + wiki field-linking + explorer flicker fix + ctrl-wheel zoom + page align + screenplay smart-type fix · .32 **Book Manager** · .33 **paper mode** · .34 กระดาษครีม + unified display + wiki-link ทุก sp block · .35 real page-zoom + zoom slider + screenplay indent fix · .36 **Timeline** · .37 **Maps** (world→city→room) · .38 **Gantt view** ในเส้นเวลา
.39 **Phase 1** + **แยก app.js → core.js + 11 feature modules** (มี AGENTS.md) + 3 เอนจินบริสุทธิ์: search-engine · Panel System · Split View
.40–.65 ฟีเจอร์ใหญ่ต่อเนื่อง: **Panel System UI จริง (.46)** · แผงลอย/กลุ่ม/เวิร์กสเปซ · AI (แชท/วิเคราะห์/เครื่องมือ) · คลังรูป+กระดานอารมณ์ · PDF/FDX/RTF export · Kanban · ผังพื้นที่ · Planner แบบ Miro (.65)
.66 **เรื่องแบบแตกสาย (Non-linear)** — ผังแตกสาย + โหมดทดลองเล่น
**.66r2–r12 = ยกเครื่องระบบแผงทั้งชุด** (ดู CHANGELOG.md ในรีโปสำหรับรายละเอียดทีละรุ่น):
  · r2–r4 ตำแหน่งเลื่อน/ช่องว่างค้าง · **โมเดลลูกผสม px + สัดส่วน** (แผงข้างคงที่ พื้นที่เขียนดูดส่วนต่าง)
  · r5–r7 กฎการลาก · ขนาดแยกโหมดลอย/ผนึก · **เปิดแผงใหม่ = ลอยกลางจอ** · กฎกลุ่ม · กลุ่มลอย
  · r8 แยกช่องทับแผงในกลุ่ม = แยกทั้งกลุ่ม · รีเซ็ต = ประทับค่าอ้างอิง
  · **r9 "canvas เปล่า"**: ขนาดถูกเก็บที่ `panel` แต่ลูกของ dock เป็น **กลุ่มแท็บ** → ตัววาดอ่านไม่เจอ
    (`nodePxDeep`/`dockChildOf`) · `dockAtEdge` เลิกแบ่งครึ่งจอ · **ใหม่: ส่งออกเลย์เอาต์เป็น JSON**
  · **r10** ยุบกลุ่มแล้วตัวที่รอดต้องยึดขนาดของกลุ่ม · กลุ่มลอย ดึงออก/ปิด/พับ/สลับลำดับได้จริง
  · **r11** กลุ่มลอยจำได้ว่าใครอยู่กลุ่มไหน + รอดการโหลดใหม่ (`_prune` เคยลบทิ้งทั้งก้อน) · ผนึกทั้งกลุ่มที่ขอบจอ
  · **r12** ความสูงตอนลอยหายไปแกนเดียว (`nodeFloatBox` ต้องครบคู่) · ปล่อยกล่องแล้วผนึกไม่สำเร็จ = ย้ายกล่อง

**Storyteller Suite ครบแล้ว**: compile workflows · custom wiki categories · analytics · book manager · timeline (การ์ด+Gantt) · maps (portals)

**ยังเหลือ**: `search-engine.js` ยังเป็น orphan (Global Search ยังสแกนไฟล์ตรง ๆ ควรสลับมาใช้ inverted index) ·
Tear-off แผงเป็นหน้าต่าง OS จริง (multi-display) · multiple-drafts-per-book UI · screenplay align persistence ·
Campaign/D&D mode · **code signing + ไอคอน `.icns`/`.ico`** · native arm64 build ·
บั๊กค้าง **K-1** (แถวไฟล์กระดานหายจาก Explorer — ทำซ้ำไม่ได้ มีเครื่องมือวินิจฉัยติดไว้แล้ว ดู CHANGELOG)
Top เคยบอก paper/indent "อาจต้องปรับปรุง ไว้ก่อน"

**นิสัยผู้ใช้ (Top)**: พูด "เริ่มเลย"/"continue"/"ทำต่อ"/"เอาให้จบ" = ให้ลงมือทำเลย **อย่าถามย้ำ scope** (เคยโดนบ่น "เช็คอะไรละ"). ชอบทำหลายฟีเจอร์รวดเดียวแล้วแก้บั๊กทีเดียว. ส่งสกรีนช็อตบั๊ก = pixel-verify คือเทสจริง. มักจบ session ด้วย "update skill"

---

## วิธีทำงาน

reproduce (เขียนสคริปต์เรียกเอนจินจริงก่อนเดา) → แก้ root cause → **เพิ่ม unit + e2e ถาวร** →
`npm run test:unit` + e2e ALL OK → bump version + CHANGELOG + README → `npm run dist:mac` → smoke test →
commit + push. บอกข้อจำกัดตรง ๆ (บนเครื่อง Top: **mac Intel รัน/บิลด์/เทสจริงได้** · win/arm64 ยังทดสอบจริงไม่ได้)

**บทเรียนเทสจากรอบแผง (.66r10–r12) — สำคัญมาก:**
· **e2e ที่เรียกฟังก์ชันตรง ๆ ผ่านหลอกได้** — บั๊กกลุ่มลอยทั้งชุด "คืน `true` แต่ไม่ทำอะไรเลย"
  → เทสของ UI ต้อง **กดปุ่มจริง / ส่ง mouse event จริง / วัด `getBoundingClientRect()` จริง**
· ผู้ใช้ส่ง **ไฟล์เลย์เอาต์ที่ส่งออกจากโปรแกรม** มาได้ — ใช้เป็นตัวตั้งของสคริปต์ทำซ้ำได้ทันที (แม่นกว่าเดา)
· เจอ 1 บั๊ก มักมีพ่วง 2–3 ตัวที่ต้นตอเดียวกัน — ไล่ให้ครบก่อนปิดรอบ
