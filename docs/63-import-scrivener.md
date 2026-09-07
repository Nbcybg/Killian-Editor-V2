# ข้อ 63 — Import from Scrivener (Spec)

ไฟล์: `src/import/import-scrivener.js`

---

## 1. โครง .scriv ที่ต้องอ่าน

```
<ชื่อ>.scriv/
  <ชื่อ>.scrivx                  ← XML: ต้นไม้ binder
  Files/Data/<UUID>/content.rtf  ← Scrivener 3
  Files/Docs/<id>.rtf            ← Scrivener 2
```
รองรับทั้ง 2 เวอร์ชัน (ลองเส้นทางไฟล์ตามลำดับ)

> `.scriv` เป็น**โฟลเดอร์** ไม่ใช่ zip — ผู้ใช้ชี้ไปที่โฟลเดอร์ ถ้าเป็นไฟล์ zip ให้แตกก่อน
> (แตก zip ด้วย jszip ที่โปรเจกต์มีอยู่แล้วได้ แต่ตัวโมดูลนี้รับเฉพาะ "โฟลเดอร์ผ่าน io adapter")

## 2. ตัวแปลง (pure — เทสได้ตรง ๆ)

### 2.1 XML
`parseXml(xml)` — parser เล็ก ๆ พอสำหรับ .scrivx (node ไม่มี DOMParser)
รองรับแท็กซ้อน · self-closing · attribute · **decode entity** (`&amp;` `&#x0E01;`)
`parseBinder(xml)` → `[{ id, type, title, include, children }]`
- `type`: `DraftFolder` · `Folder` · `Text` · `ResearchFolder` …
- `include` = ค่า `MetaData > IncludeInCompile` (ใช้กับ `onlyCompiled`)

### 2.2 RTF → ข้อความ
`rtfToText(rtf)` — จุดสำคัญคือ **ภาษาไทยใน RTF เป็น `\uNNNN` ทั้งหมด**
- `\uNNNN` → ตัวอักษรจริง + ข้ามไบต์สำรองตาม `\ucN`
- `\'xx` → ตัวอักษร ANSI (อังกฤษ)
- `\par`/`\line` → ขึ้นบรรทัด · `\tab` → แท็บ
- ข้ามกลุ่ม `fonttbl` `colortbl` `stylesheet` `info` `pict` และ `{\*\…}` ทั้งก้อน
- control word อื่น = การจัดรูปแบบ → ทิ้ง (Killian เก็บเนื้อหาเป็น markdown)

## 3. การแปลงโครง

| Scrivener | Killian |
|---|---|
| Draft/Manuscript folder | `<Section>/` (ค่าเริ่มต้น "เล่มหนึ่ง") |
| Folder | บท (`draft.json → chapters[]` + โฟลเดอร์ `NN - ชื่อบท`) |
| Document (Text) | ฉาก (`scenes.json` + `scene-NN.md`) |
| เอกสารที่อยู่นอกโฟลเดอร์ | บท "(ไม่มีบท)" (ไม่ทิ้งของ) |
| Research / นอก Draft | **ไม่นำเข้า** (ตั้ง `draftOnly:false` ถ้าต้องการ) |

ผลลัพธ์เป็นโครง Killian มาตรฐาน 100% (เปิดด้วย v1 ได้):
```
project.khn.json
เล่มหนึ่ง/section.json
เล่มหนึ่ง/Draft/default/{draft.json, scenes.json, Chapters/01 - บทที่หนึ่ง/scene-01.md}
```
ฉากทุกไฟล์มี front-matter `title/type: scene/format: prose`

## 4. API

```js
importScrivener(filePath, options)
// options: { io, dest, title, dryRun, sectionTitle, draftOnly=true, onlyCompiled, looseTitle, onProgress }
// io = { join, exists, listFiles, listDirs, readFile, writeFile, mkdir }   ← ส่ง kapi ได้เลย
// → { ok, plan, counts:{chapters,scenes}, warnings, written, title, dest, error?, code? }

parseXml · findAll · parseBinder · rtfToText · mapBinder · buildPlan   // pure ทั้งหมด
```

- **`dryRun: true`** → คืน `plan.files[]` (path + เนื้อหา) โดยไม่เขียนอะไรเลย → UI เอาไปทำหน้าพรีวิว "จะได้กี่บท/กี่ฉาก"
- `warnings[]` = เอกสารที่หา `.rtf` ไม่เจอ (นำเข้าเป็นฉากว่าง ไม่ทิ้ง)
- error codes: `no-io` · `no-scrivx` · `bad-binder` · `no-dest`

## 5. Unit test
`node test/tools.test.cjs` — XML ไทย+entity · binder ซ้อนชั้น · IncludeInCompile · RTF ไทย `\uNNNN` ·
`\'xx` · ข้าม fonttbl/`{\*\}` · โฟลเดอร์→บท เอกสาร→ฉาก · เอกสารลอย · ข้าม Research · dryRun ไม่เขียนไฟล์ ·
เขียนครบตาม plan · scenes.json/draft.json ตรงโครงเดิม · Scrivener 2 · error code ครบ
