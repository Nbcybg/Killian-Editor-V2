# ข้อ 12 — Kanban Board (Spec)

ไฟล์: `src/kanban/kanban-core.js` (pure logic + adapter) · UI ต่อทีหลัง: `src/kanban/kanban-ui.js`

---

## 1. แหล่งข้อมูล

อ่านจาก `<Section>/Draft/<name>/scenes.json` — **โครงเดิม ไม่เปลี่ยน** (เข้ากับ v1 ได้ 100%)

```json
{ "chapters": {
    "c1": [ { "id":"sc1", "title":"ตลาดเก่า", "order":1, "fileName":"scene-01.md",
              "status":"กำลังเขียน", "color":"#d97757", "tags":["ย้อนอดีต"],
              "synopsis":"…", "pov":"โทระ", "storyDate":"…", "kbOrder":0 } ] } }
```

ฟิลด์ที่ Kanban ใช้:

| ฟิลด์ | ใช้ทำอะไร | เพิ่มใหม่? |
|---|---|---|
| `status` | จัดกลุ่มเป็นคอลัมน์ | เดิม |
| `kbOrder` | ลำดับการ์ดภายในคอลัมน์ | **ใหม่** (ไม่มี = ใช้ `order` แทน) |
| `order` `title` `color` `tags` `synopsis` `pov` | แสดงบนการ์ด | เดิม |

> `kbOrder` เป็น optional — v1 และไฟล์เก่าที่ไม่มีฟิลด์นี้เปิดได้ปกติ

## 2. คอลัมน์

```js
{ key:'กำลังเขียน', label:'กำลังเขียน', wip:0, hidden:false, custom:false }
```

- คอลัมน์มาตรฐาน = `SCENE_STATUSES` + สถานะที่ผู้ใช้เพิ่มเอง (`custom-status.js → allStatuses()`)
- `UNSET` (`key='__unset__'`, label `'ยังไม่กำหนด'`) — ฉากที่ยังไม่มี `status` (เปิด/ปิดด้วย `includeUnset`)
- คอลัมน์ที่เพิ่มจากกระดาน (`addColumn`) = `custom:true` และถูกบันทึกเป็น **สถานะฉาก** ใน
  `project.khn.json → customStatuses[]` (คอลัมน์ = สถานะ ตัวเดียวกันเสมอ ไม่แยกสองแหล่ง)

เลย์เอาต์กระดาน (ลำดับ/ซ่อน/WIP/ยุบ) เก็บ **localStorage** คีย์ `k2-kanban-layout`:

```json
{ "version": 1, "order": ["โครงร่าง","กำลังเขียน"], "hidden": ["เก็บถาวร"],
  "wip": { "กำลังเขียน": 3 }, "collapsed": [], "groupBy": "status" }
```

---

## 3. API

### 3.1 ฟังก์ชันบริสุทธิ์ (ทดสอบได้ตรง ๆ)

```js
getKanbanData(scenes, { statuses, layout, chapters, filter, includeUnset })
// → { columns:[{ key,label,cards:[card…],count,wip,over }], total, byStatus }

updateSceneStatus(scenes, sceneId, status, { index })  // → { scenes, changed, from, to }
moveCard(scenes, sceneId, toStatus, toIndex)           // = updateSceneStatus + จัดลำดับใหม่
addColumn(layout, key, { label, at })                  // → layout ใหม่
removeColumn(layout, key)                              // → layout ใหม่ (ซ่อน/ลบคอลัมน์)
reorderColumns(layout, from, to)
setWip(layout, key, n) · toggleHidden(layout, key)
cardsOf(scenes) · findScene(scenes, sceneId)
normalizeKbOrder(scenes)                               // เขียน kbOrder ให้ครบทุกใบ
```

**ทุกฟังก์ชันคืนของใหม่ ไม่กลายพันธุ์ของเดิม** (`scenes` ที่ส่งเข้าไปไม่ถูกแก้)

### 3.2 คลาสผูกไฟล์ (`KanbanBoard`) — อัปเดต scenes.json อัตโนมัติ

```js
const kb = new KanbanBoard({ io, draftPath, statuses, storage });
await kb.load();                    // อ่าน scenes.json + layout จาก localStorage
kb.data()                           // → ผลของ getKanbanData
await kb.updateSceneStatus(id, st)  // แก้ใน memory → เขียน scenes.json ทันที
await kb.moveCard(id, st, index)
await kb.addColumn(key,label) / await kb.removeColumn(key)
kb.onChange(fn)
```

`io` = adapter (ฉีดเข้ามาเพื่อเทสด้วย mock ได้):
```js
{ join(...p), readJson(path), writeFile(path, text), exists(path) }
```
โปรดักชันส่ง `kapi` เข้าไปได้เลย — **`kapi` ไม่มี `writeJson`** ตัว adapter จึงใช้
`writeFile(path, JSON.stringify(obj, null, 2))` เสมอ (ตรงกับที่ทั้งแอปทำ)

การเขียนใช้ **write-through + debounce ได้** (`{ autoSave:false }` แล้วเรียก `kb.flush()` เอง)

---

## 4. กฎย่อยที่ต้องระวัง

1. `status` ที่ไม่อยู่ในรายการคอลัมน์ (ไฟล์จากเครื่องอื่น/สถานะที่ถูกลบ) → สร้างคอลัมน์ `custom` ให้อัตโนมัติ ไม่ทิ้งการ์ด
2. ลบคอลัมน์ที่ยังมีการ์ด → ต้องส่ง `moveTo` ไม่งั้นคืน `{ ok:false, reason:'not-empty' }`
3. เรียงการ์ด: `kbOrder` → ถ้าเท่ากัน/ไม่มี ใช้ `order` → ถ้ายังเท่า ใช้ลำดับที่พบในไฟล์ (เสถียร)
4. ฉากอยู่ในบท (`chapters[chapterId]`) — การย้ายคอลัมน์ **ไม่ย้ายบท** เปลี่ยนแค่ `status`

---

## 5. Unit test

`node test/kanban.test.cjs` — จัดกลุ่ม/เรียง/ย้ายการ์ด/immutability/เพิ่ม-ลบคอลัมน์/WIP/สถานะแปลกปลอม/บันทึกลง mock io + store
