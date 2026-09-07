# ข้อ 86 — World-Story Connection (Spec)

ไฟล์: `src/world-story/auto-link.js` (pure + adapter) · UI ต่อทีหลัง (แผง "ฉากที่กล่าวถึง")

เชื่อม **Wiki (โลก)** ↔ **ฉาก (เรื่อง)** อัตโนมัติ: เอนทิตี้ตัวหนึ่งถูกพูดถึงในฉากไหนบ้าง

---

## 1. โครงข้อมูล

### 1.1 เอนทิตี้ (จาก `Wiki/<cat>/*.json` เดิม)

```js
{ id:'characters/cat.json', name:'ยัยแมวเก้าชีวิต', aliases:['แมวดำ'],
  entityTypeKey:'characters' }
```
`id` = path สัมพัทธ์จาก `Wiki/` (คีย์เดียวกับที่ explorer/network ใช้อ้างไฟล์)

### 1.2 ฉาก

```js
{ id:'sc1', title:'ตลาดเก่า', chapterId:'c1', path:'…/scene-01.md', text:'…เนื้อฉาก…' }
```

### 1.3 ดัชนี (ในหน่วยความจำ)

```js
{
  backlinks: { 'characters/cat.json': ['sc1','sc7'] },        // entity → scenes
  forward:   { 'sc1': ['characters/cat.json'] },              // scene  → entities
  hits:      { 'characters/cat.json': { sc1:{ count:3, via:'name' } } },
  builtAt:   1730000000000
}
```

### 1.4 ที่บันทึกถาวร — `project.khn.json`

```json
{ "backlinks": { "characters/cat.json": ["sc1","sc7"] } }
```
**เก็บเฉพาะ `backlinks`** (entity → sceneIds) ตามข้อกำหนด · `forward`/`hits` คำนวณกลับได้ ไม่เปลืองไฟล์

---

## 2. เอนจิน Auto-link

### 2.1 กติกาการจับคู่ (ตามที่ `mentionPlugin` ใน editor.js ใช้อยู่ — พฤติกรรมเดียวกัน)

1. ลิงก์ชัดเจน `[[ชื่อ]]` — น้ำหนักสูงสุด (`via:'link'`)
2. ชื่อจริง (`name`) ปรากฏตรงตัว — `via:'name'`
3. ชื่อเล่น/นามแฝง (`aliases[]`) — `via:'alias'`

- ข้ามชื่อสั้นกว่า **2 ตัวอักษร** (ภาษาไทยไม่มีช่องว่าง — ชื่อพยางค์เดียวจะแมตช์ลามทั้งเรื่อง)
- จับคู่แบบ **ยาวก่อนสั้น** (`ยัยแมวเก้าชีวิต` ต้องชนะ `แมว`) และ **ไม่ทับซ้อน**
- ตัด front-matter (`---…---`) กับบล็อกโค้ดออกก่อนสแกน — ไม่งั้นชื่อใน metadata นับเป็นการกล่าวถึง
- อังกฤษเช็คขอบคำ (`\b`) · ไทยไม่เช็ค (ไม่มีช่องว่าง)

### 2.2 การอัปเดต

- **สร้างใหม่ทั้งดัชนี** (`buildIndex`) ตอนเปิดโปรเจกต์ / กด "สร้างดัชนีใหม่"
- **รายฉาก** (`updateScene`) ตอนบันทึกฉาก — คำนวณเฉพาะฉากนั้นแล้วปะเข้าดัชนี (O(1) ต่อการบันทึก)
- **รายเอนทิตี้** (`removeEntity` / เปลี่ยนชื่อ) — ผูกกับคิวงาน (ข้อ 88)

---

## 3. API

### 3.1 ฟังก์ชันบริสุทธิ์

```js
entityTerms(entity)                       // → [{ term, via }] เรียงยาว→สั้น
extractLinks(text, entities)              // → [{ entityId, count, via }]
buildIndex(entities, scenes)              // → index (ตาม 1.3)
updateScene(index, scene, entities)       // → index ใหม่ (ปะเฉพาะฉากเดียว)
removeScene(index, sceneId)
removeEntity(index, entityId)
toBacklinks(index)                        // → { entityId:[sceneIds] } สำหรับเขียน project.khn.json
fromBacklinks(obj)                        // → index (โหลดกลับ · forward สร้างใหม่จาก backlinks)
stripMeta(text)                           // ตัด front-matter + code fence
```

### 3.2 คลาส `AutoLink` (ตัวที่ UI เรียก)

```js
const al = new AutoLink({ meta });        // meta = state.meta (project.khn.json ที่โหลดไว้)
al.build(entities, scenes)                // สร้างดัชนีใหม่ทั้งก้อน
al.getBacklinks(entityId)                 // → ['sc1','sc7']          ← ตามข้อกำหนด
al.getRelatedScenes(entityId)             // → [{ sceneId,count,via,title,chapterId }] เรียงตามความถี่
al.getEntitiesInScene(sceneId)            // → [entityId…]  (ทางกลับ)
al.coOccurring(entityId)                  // → [{ entityId, shared }] เอนทิตี้ที่โผล่ฉากเดียวกันบ่อย
al.updateScene(scene) · al.removeScene(id) · al.removeEntity(id)
al.persist()                              // เขียน meta.backlinks (ผู้เรียกค่อย saveProjectMeta())
al.load()                                 // อ่าน meta.backlinks กลับเป็นดัชนี
al.stats()                                // → { entities, scenes, links }
```

`AutoLink` **ไม่แตะ fs เอง** — ผู้เรียกป้อน `entities`/`scenes` ที่อ่านมาแล้ว
(ตัวช่วยรวบรวมอยู่ใน `collectSources(io, root)` ซึ่งรับ adapter เดียวกับ Kanban)

---

## 4. จุดเชื่อม

- **ข้อ 88 (คิวงาน)** — เหตุการณ์ `scene:saved` / `entity:renamed` เข้าคิว → `al.updateScene` / rebuild
- **Wiki UI** — แผง "ฉากที่กล่าวถึง" ใต้หน้าเอนทิตี้ ใช้ `getRelatedScenes`
- **Story Network** — `coOccurring` ใช้เป็นน้ำหนักเส้นได้

---

## 5. Unit test

`node test/world-story.test.cjs` — ยาวก่อนสั้น/ไม่ทับซ้อน/ชื่อสั้นถูกข้าม/`[[ลิงก์]]`/ตัด front-matter/alias/ปะรายฉาก/round-trip backlinks
