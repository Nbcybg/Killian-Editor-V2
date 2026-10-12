# 6. ทำงานกับไฟล์และข้อมูลของผลงาน

**ภาษา:** ไทย · [English](../en/06-data-and-files.md)

[← 5. หน้าตาและการใช้งาน](05-ui-guidelines.md) · [ภาพรวม](README.md) · ถัดไป: [7. ความปลอดภัยและความไว้วางใจ →](07-security.md)

---

ผลงานของ Killian เป็นโฟลเดอร์ของไฟล์ข้อความ — ปลั๊กอินอ่านได้ทั้งหมดผ่าน `k2.readFile` / `listDirs` / `listFiles` และเขียนไฟล์ใหม่ได้ด้วย `k2.writeFile`
บทนี้บอกว่า **อะไรอยู่ที่ไหน · อ่านยังไงให้ถูก · เขียนอะไรได้/ไม่ได้ · เก็บข้อมูลของปลั๊กอินที่ไหน**

รูปแบบไฟล์ฉบับเต็ม: [ภาคผนวก D ของคู่มือผู้ใช้](../../manual/th/D-file-formats.md)

## 6.1 แผนที่ของผลงาน (มุมมองของปลั๊กอิน)

ทางทั้งหมดเป็นทางสัมพัทธ์จากรากผลงาน:

```
project.khn.json                                  ⚠ อ่านได้ · ห้ามเขียน
templates.json · dictionary.json · maps.json · timeline.json
<เล่ม>/section.json                               ⚠ อ่านได้ · ห้ามเขียน
<เล่ม>/roster.json
<เล่ม>/Draft/<ร่าง>/draft.json                     ⚠ อ่านได้ · ห้ามเขียน
<เล่ม>/Draft/<ร่าง>/scenes.json                    ⚠ อ่านได้ · ห้ามเขียน
<เล่ม>/Draft/<ร่าง>/Chapters/<โฟลเดอร์บท>/<ฉาก>.md   ⚠ อ่านได้ · ห้ามเขียนทับ
Memos/*.md
Wiki/<หมวด>/<ชื่อ>.json
Images/ · Fonts/ · Models/                         ไบนารี — อ่านผ่าน k2 ไม่ได้
Planners/ · Branches/ · FloorPlans/ · OnSet/ · Starters/ · Sessions/ · Skills/ · References/
Snapshots/ · .k2history/ · Recycle/ · Backups/     ของระบบ — อย่าแตะ
Plugins/<ชื่อ>/                                    ปลั๊กอินของผลงาน
ai-key.json                                       ⚠ ความลับของผู้ใช้ — ห้ามอ่าน
```

**เล่ม** คือโฟลเดอร์ชั้นบนที่มีไฟล์ `section.json` (ชื่อโฟลเดอร์อะไรก็ได้ที่ไม่ใช่ชื่อสงวนของโปรแกรม)

## 6.2 อ่านโครงของผลงาน

ลำดับและชื่อของ เล่ม → บท → ฉาก อยู่ในไฟล์ทะเบียน **ไม่ได้อยู่ในชื่อไฟล์/ลำดับของโฟลเดอร์**:

```js
'use strict';

const stripBom = (t) => { const s = String(t == null ? '' : t); return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; };

/** มีไฟล์นี้ไหม — readFile โยน error เมื่อไฟล์ไม่มี จึงถามจากรายชื่อไฟล์ก่อน */
async function hasFile(rel) {
  const i = rel.lastIndexOf('/');
  return (await k2.listFiles(i < 0 ? '.' : rel.slice(0, i))).includes(i < 0 ? rel : rel.slice(i + 1));
}
async function readJson(rel) {
  if (!(await hasFile(rel))) return null;
  try { return JSON.parse(stripBom(await k2.readFile(rel))); } catch { return null; }
}
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

/** โครงของผลงาน: [{ dir, title, draft, chapters: [{ guid, title, folder, scenes: [{ id, title, status, rel }] }] }] */
async function readOutline() {
  if (!k2.projectRoot()) return [];
  const books = [];
  for (const dir of await k2.listDirs('.')) {
    const sec = await readJson(dir + '/section.json');
    if (!sec) continue;                                   // ไม่ใช่เล่ม (Wiki · Images · …)
    const drafts = await k2.listDirs(dir + '/Draft');
    const draft = drafts.includes(sec.primaryDraft) ? sec.primaryDraft : drafts[0];   // ร่างหลัก
    if (!draft) continue;
    const base = dir + '/Draft/' + draft;
    const dj = await readJson(base + '/draft.json');
    const sj = await readJson(base + '/scenes.json');
    if (!dj || !sj) continue;
    const chapters = [...(dj.chapters || [])].sort(byOrder).map((ch) => ({
      guid: ch.guid, title: ch.title, folder: ch.folderName,
      scenes: [...((sj.chapters || {})[ch.guid] || [])].sort(byOrder).map((row) => ({
        id: row.id, title: row.title, status: row.status || '',
        rel: base + '/Chapters/' + ch.folderName + '/' + row.fileName,
      })),
    }));
    books.push({ dir, title: sec.title || dir, order: sec.order || 0, draft, chapters });
  }
  return books.sort(byOrder);
}
```

ข้อควรจำ:

| เรื่อง | ทำ |
|---|---|
| ลำดับ | เรียงด้วยช่อง `order` เสมอ — ไม่ใช่ลำดับในอาร์เรย์หรือชื่อไฟล์ |
| ตัวตน | อ้างเล่ม/บท/ฉากด้วย `guid` / `guid` / `id` — ชื่อไฟล์และโฟลเดอร์ **เปลี่ยนได้** เมื่อผู้ใช้เปลี่ยนชื่อ |
| ฉบับร่าง | ใช้ **ร่างหลัก** (`section.json → primaryDraft`) เว้นแต่ตั้งใจดูร่างอื่น |
| ไฟล์ที่ทะเบียนชี้อาจไม่มีจริง | ตรวจด้วย `hasFile` ก่อนอ่าน (โปรเจกต์ที่ถูกแก้นอกโปรแกรม) |
| โปรเจกต์รุ่นเก่า | ชื่อไฟล์อาจเป็น `scene-01.md` · โฟลเดอร์บท `01 - ชื่อ` — ใช้ `fileName`/`folderName` จากทะเบียน อย่าประกอบชื่อเอง |
| ค่าสถานะ | เป็นข้อความที่ผู้ใช้ตั้ง (มักเป็นภาษาไทย) — อย่าเทียบกับค่าคงที่ของคุณเอง |
| ไฟล์ JSON เสีย | `readJson` ข้างบนคืน `null` — ข้ามอย่างสุภาพ **ห้ามเขียนไฟล์ "ซ่อม" ทับ** |

### อ่านไฟล์ฉาก

ไฟล์ฉากมี 3 ส่วน: หัวไฟล์ (`---`…`---`) · เนื้อเรื่อง · บล็อกคอมเมนต์ท้ายไฟล์ (`<!-- k2-comments … -->`)

```js
/** แยกไฟล์ฉาก → { meta: {คีย์: สตริงดิบ}, body } — ตัวแยกแบบเบา พอสำหรับ "อ่าน" */
function parseScene(text) {
  let s = stripBom(text);
  const meta = {};
  if (s.startsWith('---')) {
    const end = s.indexOf('\n---', 3);
    if (end > 0) {
      for (const line of s.slice(3, end).split('\n')) {
        const m = /^([A-Za-z][\w-]*):\s?(.*)$/.exec(line.trim());
        if (m) meta[m[1]] = m[2];
      }
      s = s.slice(s.indexOf('\n', end + 1) + 1);
    }
  }
  const c = s.indexOf('<!-- k2-comments');
  if (c >= 0) s = s.slice(0, c);
  return { meta, body: s };
}
```

- `meta.format` = `'prose'` หรือ `'screenplay'` · `meta.type` = `'scene'` หรือ `'memo'`
- ค่าในหัวไฟล์ที่ยาวหลายบรรทัดถูกโปรแกรมเข้ารหัสไว้ — ตัวแยกแบบเบานี้ใช้ได้กับการอ่านค่าบรรทัดเดียว (ชื่อ · สถานะ · ผู้เล่า · แท็ก) ถ้าต้องตีความทุกค่าให้ครบ ทดสอบกับไฟล์จริงหลายแบบ
- เนื้อของบทภาพยนตร์มีรหัสนำหน้าบรรทัด (`### ` `@` `((` `>> ` `! ` …) — ตาราง[ที่นี่](../../manual/th/D-file-formats.md#เนื้อเรื่อง--โหมดบทภาพยนตร์)

### ไฟล์บนดิสก์ กับ สิ่งที่ผู้ใช้เห็นในแท็บ

`k2.readFile` อ่าน **ไฟล์บนดิสก์** — ถ้าฉากนั้นเปิดอยู่และยังไม่บันทึก เนื้อในแท็บใหม่กว่า

| ต้องการ | ใช้ |
|---|---|
| เนื้อล่าสุดของฉากที่ **เปิดอยู่** | `k2.getMarkdown()` |
| เนื้อของฉากอื่น ๆ | `k2.readFile(rel)` (ฉบับที่บันทึกล่าสุด) |
| ทำงานหลังบันทึกเสมอ | ฟัง `tab:save` |

รายงาน/สถิติทั้งเล่ม: บอกผู้ใช้ว่านับจากฉบับที่บันทึกแล้ว หรือแนะนำให้ **บันทึกทั้งหมด** ก่อน

### อ่าน Wiki

```js
async function readEntities(cat) {                        // cat = 'characters' | 'locations' | 'items' | 'lore' | หมวดที่ตั้งเอง
  const out = [];
  for (const f of await k2.listFiles('Wiki/' + cat, '.json')) {
    const e = await readJson('Wiki/' + cat + '/' + f);
    if (e && e.name) out.push(e);
  }
  return out;
}
const cats = await k2.listDirs('Wiki');                   // หมวดทั้งหมดของผลงานนี้
```

ช่องที่พึ่งได้: `name` · `entityTypeKey` · `aliases[]` · `tags[]` · `fields{}` · `relationships[{ targetName, role, type }]`

## 6.3 ไฟล์ที่ห้ามเขียนทับ

`k2.writeFile` **เขียนทับทั้งไฟล์** โดยไม่ผ่านกลไกของโปรแกรม ไฟล์ต่อไปนี้มีเจ้าของอยู่แล้ว:

| ไฟล์ | ทำไมห้าม |
|---|---|
| ฉาก/Memo `.md` | (1) ฉากที่เปิดเป็นแท็บ: โปรแกรมจะเห็นว่า "ไฟล์ถูกแก้จากนอกโปรแกรม" แล้วถามผู้ใช้ หรือเขียนของในแท็บทับของคุณตอนบันทึก (2) เขียนไม่ครบรูป = **ลบคุณสมบัติฉากและเธรดคอมเมนต์** ที่อยู่ในไฟล์เดียวกัน |
| `scenes.json` · `draft.json` · `section.json` | โปรแกรมแก้ผ่านคิวที่อ่านค่าล่าสุดก่อนเขียน — ปลั๊กอินเขียนก้อนที่อ่านไว้ก่อนหน้า = ทับการแก้ของผู้ใช้ที่เกิดระหว่างนั้น (ฉากหาย · ลำดับเพี้ยน) |
| `project.khn.json` | ค่าตั้งทั้งผลงาน — ใช้ `k2.setSettings` สำหรับของปลั๊กอินเอง |
| `Wiki/**.json` | หน้าที่เปิดเป็นแท็บถือค่าเก่าแล้วเขียนทับตอนบันทึก |
| `ai-key.json` | ความลับของผู้ใช้ — ห้ามอ่านและห้ามเขียน |
| `Snapshots/` `.k2history/` `Recycle/` `Backups/` | ตาข่ายกันงานหายของผู้ใช้ |
| `Plugins/<ตัวอื่น>/` | ของปลั๊กอินอื่น — และการแก้ไฟล์ในชุดปลั๊กอินของผลงานทำให้ต้องขออนุญาตใหม่ |

**ต้องการแก้เนื้อของฉาก?** ทำได้ทางเดียวที่ปลอดภัย: ฉากนั้นต้อง **เปิดเป็นแท็บที่เลือกอยู่** แล้วแก้ผ่าน `k2.insertText` หรือ `k2.getEditorView().dispatch(tr)` — ผู้ใช้เห็นการแก้ ย้อนได้ด้วย `Ctrl+Z` และตัดสินใจบันทึกเอง

ต้องการแก้หลายฉากรวดเดียว: ยังไม่มีทางที่ปลอดภัยผ่าน `k2` — ทำเป็น "รายงานสิ่งที่ควรแก้" ให้ผู้ใช้ทำเอง หรือให้ผู้ใช้ใช้ **แทนที่ทั้งโปรเจกต์** ของโปรแกรม

## 6.4 ปลั๊กอินควรเขียนไฟล์ที่ไหน

| ข้อมูล | เขียนที่ | หมายเหตุ |
|---|---|---|
| ค่าตั้งเล็ก ๆ ต่อผลงาน | `k2.setSettings` | อยู่ใน `project.khn.json` |
| ค่าตั้งของผู้ใช้ (ทุกผลงาน) | `localStorage` คีย์ `k2-plugin-<ชื่อ>:…` | อยู่ในเครื่องนั้น |
| ข้อมูลก้อนใหญ่ของปลั๊กอิน (แคช · ดัชนี · สถานะ) | โฟลเดอร์ของตัวเองในผลงาน เช่น `PluginData/<ชื่อปลั๊กอิน>/data.json` | ไปกับผลงาน · ผู้ใช้เห็นและลบได้ |
| ผลลัพธ์ที่ผู้ใช้จะเปิดอ่าน (รายงาน · ไฟล์ส่งออก) | โฟลเดอร์ที่ชื่อบอกความหมาย เช่น `Reports/` | บอกผู้ใช้ทุกครั้งว่าเขียนไฟล์ไหน |
| ความลับ (คีย์ API ของปลั๊กอิน) | `localStorage` เท่านั้น | **ห้าม** ลงไฟล์ในผลงานหรือ `setSettings` |

กติกาของการตั้งชื่อ:

- **อย่าใช้ชื่อโฟลเดอร์ชั้นบนที่โปรแกรมสงวน**: `Wiki` `Bible` `Images` `Memos` `Research` `Snapshots` `.k2history` `Plugins` `Recycle` `Sessions` `Starters` `Planners` `Branches` `FloorPlans` `OnSet` `References` `Models` `Backups` `Draft` `languages` `Analysis` `Dialogues` `Fonts` `Skills` `.git`
- **อย่าวาง `section.json` ในโฟลเดอร์ของคุณ** — โปรแกรมจะเห็นโฟลเดอร์นั้นเป็น "เล่ม"
- โฟลเดอร์ชั้นบนที่ไม่มี `section.json` ไม่ถูกแสดงใน Explorer แต่ถูกรวมใน **ชุดสำรองและ ZIP** ของผลงาน — เก็บให้เล็ก
- ไฟล์ `.md` ในโฟลเดอร์ของคุณ **ถูกดัชนีค้นหาทั้งโปรเจกต์เห็น** (ผู้ใช้ค้นแล้วเจอรายงานของคุณ) — ถ้าไม่ต้องการ ใช้นามสกุลอื่น (`.txt` · `.json`)
- ใช้ `/` คั่นทาง · ชื่อไฟล์เลี่ยงอักขระ `\ / : * ? " < > |` และชื่อสงวนของ Windows (`con` `nul` `aux` …) เพื่อให้ผลงานย้ายเครื่องได้
- เขียน JSON แบบอ่านได้ (`JSON.stringify(data, null, 2)`) — ผู้ใช้ใช้ Git diff

### เขียนแล้วเกิดอะไรบ้าง

- เขียนแบบ atomic · สร้างโฟลเดอร์ที่ขาดให้
- ถูกจดใน **แผงประวัติการทำงาน** ของผลงาน — ผู้ใช้เห็นว่าปลั๊กอินเขียนอะไร และย้อนกลับได้
- ทำให้ดัชนีค้นหาของโปรแกรมถูกสร้างใหม่ (ถ้าเป็นไฟล์ที่ถูกค้น) — **อย่าเขียนถี่ ๆ** (เช่น ทุกวินาที) หน่วงแล้วเขียนครั้งเดียว

```js
// เขียนแบบหน่วง: หลายการเปลี่ยนในช่วงสั้น ๆ = เขียนครั้งเดียว
let pending = null, timer = 0;
function saveSoon(data) {
  pending = data;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
async function flush() {
  if (pending == null) return;
  const data = pending; pending = null;
  try { await k2.writeFile('PluginData/' + k2.pluginName + '/data.json', JSON.stringify(data, null, 2)); }
  catch (e) { k2.log('save failed: ' + e.message); }
}
k2.on('project:close', () => { clearTimeout(timer); flush(); });   // พยายามเขียนที่ค้าง (โปรแกรมไม่รอ — ถือเป็นทางสำรอง)
k2.onUnload(() => clearTimeout(timer));
```

## 6.5 ทางเต็ม กับ ทางสัมพัทธ์

| ได้ทางเต็มจาก | ต้องทำ |
|---|---|
| `k2.projectRoot()` · `e.file` · `e.root` ของเหตุการณ์ | แปลงเป็นทางสัมพัทธ์ก่อนใช้กับ `k2.readFile` หรือก่อนเก็บ |

```js
function relPath(full) {
  const root = String(k2.projectRoot() || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const p = String(full || '').replace(/\\/g, '/');
  return root && p.startsWith(root + '/') ? p.slice(root.length + 1) : null;
}
```

**ห้ามจดทางเต็มลงไฟล์ของผลงาน** (`setSettings` · ไฟล์ข้อมูล · รายงาน): ผลงานถูกย้ายเครื่อง/ซิงก์/ส่งต่อ ทางเต็มจะผิดทันที และเผยชื่อผู้ใช้ของเครื่อง (`C:\Users\<ชื่อ>\…`)

## 6.6 ประสิทธิภาพกับผลงานขนาดใหญ่

ผลงานจริงมีได้หลายร้อยฉาก — ทุก `readFile` คือหนึ่งรอบ IPC:

- **อ่านเมื่อผู้ใช้สั่ง** ไม่ใช่ตอนโหลดปลั๊กอินหรือทุกครั้งที่บันทึก
- อ่านทะเบียน (`draft.json` / `scenes.json`) ก่อน — มี `wordCount` · `status` · `title` อยู่แล้ว หลายงานไม่ต้องเปิดไฟล์ฉากเลย
- แคชผลไว้ในหน่วยความจำ และล้างเมื่อ `project:open` / เมื่อ `tab:save` ของไฟล์ที่เกี่ยว
- งานยาว: `await` ทีละไฟล์ (ไม่ต้อง `Promise.all` ทั้งร้อยไฟล์พร้อมกัน) · บอกความคืบหน้าในแผงของคุณ · ให้ยกเลิกได้ · เช็ค `alive` และ `k2.projectRoot()` หลังทุก `await` ([4.6](04-hooks-lifecycle.md#งานที่ต้องรู้ว่ายังอยู่ไหมหลัง-await))
- อย่าเดินเข้า `Backups/` `Snapshots/` `.k2history/` `Recycle/` — เป็นสำเนาของทั้งผลงานหลายชุด

---

ถัดไป: [7. ความปลอดภัยและความไว้วางใจ →](07-security.md)
