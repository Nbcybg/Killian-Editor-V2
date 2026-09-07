# ข้อ 88 — Automate Perfunctory Tasks (Spec)

ไฟล์: `src/auto-task/event-queue.js` (pure + adapter)

งานจุกจิกที่ผู้ใช้ไม่ควรต้องทำเอง (เปลี่ยนชื่อตัวละคร → ไล่แก้ทุกไฟล์, สร้างดัชนีใหม่, สำรองไฟล์)
→ ทำเป็น **เหตุการณ์ + คิวเบื้องหลัง** ไม่บล็อกการพิมพ์

---

## 1. สถาปัตยกรรม

```
  โค้ดที่ไหนก็ได้ ──emit('scene:saved', payload)──▶ EventBus
                                                     │  (rule: event → task)
                                                     ▼
                                                  TaskQueue ──processQueue()──▶ handler
                                                     │                              │
                                                     └──────── taskLog[] ◀──────────┘
                                                          (project.khn.json)
```

- **EventBus** = ยิงเหตุการณ์แบบซิงโครนัส (listener ทำงานทันที — ใช้กับ UI refresh)
- **TaskQueue** = งานหนัก/ไอโอ ทำทีละงานเบื้องหลัง มี retry + dedupe
- **กฎ (rule)** = ตัวเชื่อม: เหตุการณ์ไหนควรสร้างงานอะไร

## 2. โครงข้อมูล

### 2.1 งานในคิว

```js
{ id:'t7', type:'reindex-links', payload:{…}, key:'reindex',
  priority:0, tries:0, maxTries:2, status:'queued'|'running'|'done'|'error'|'skipped',
  queuedAt, startedAt, endedAt, error }
```
- `key` = คีย์รวบงานซ้ำ (dedupe) — เข้าคิวซ้ำระหว่างที่ยังไม่ได้ทำ → ทับของเดิม ไม่สะสม
- `priority` มากกว่า = ทำก่อน · เท่ากันเรียงตามเวลาเข้าคิว (เสถียร)

### 2.2 บันทึกการทำงาน — `project.khn.json → taskLog[]`

```json
{ "taskLog": [
  { "ts": 1730000000000, "type": "rename-entity", "status": "done",
    "ms": 412, "detail": "โทระ → โทระ ยามาโมโตะ (12 ไฟล์)" } ] }
```
เก็บล่าสุด **200 รายการ** (`LOG_MAX`) — เก่ากว่านั้นตัดทิ้ง (ไฟล์โปรเจกต์ไม่บวม)

---

## 3. API

```js
const q = new AutoTaskEngine({ meta, now, onLog });

// ── เหตุการณ์ ──
q.on(event, handler)          // → คืนฟังก์ชัน unsubscribe · event '*' = ฟังทุกอย่าง
q.once(event, handler)
q.off(event, handler)
q.emit(event, payload)        // ยิง listener ทันที + ตรวจกฎ → เข้าคิวงานที่เกี่ยวข้อง

// ── คิว ──
q.registerTask(type, fn)      // fn(payload, ctx) — async ได้ · throw = error → retry
q.rule(event, type, mapPayload?, opts?)   // ผูกเหตุการณ์ → งาน
q.enqueue(type, payload, { key, priority, maxTries })
await q.processQueue()        // ทำจนคิวหมด (เรียกซ้อนได้ — ตัวที่สองคืนทันที)
q.start(schedule) / q.stop()  // ทำคิวอัตโนมัติ (ฉีด scheduler เข้ามา = เทสได้)
q.pending() · q.stats() · q.clear()

// ── log ──
q.taskLog()                   // → meta.taskLog (อ่านอย่างเดียว)
```

### 3.1 งานสำเร็จรูป: เปลี่ยนชื่อ → อัปเดตทุกไฟล์

```js
replaceName(text, oldName, newName)     // pure — แทน [[เก่า]] และชื่อตรงตัว (ยาวก่อนสั้น, ไม่ทับซ้อน)
renameEntityTask(io)                    // → handler สำหรับ registerTask('rename-entity', …)
```
`payload = { entityId, oldName, newName, files:[path…] }`
handler อ่าน-แทน-เขียนทีละไฟล์ **เฉพาะไฟล์ที่มีของจริง** แล้วคืน `{ changed:n, files:[…] }`
(อ่าน/เขียนผ่าน `io` adapter ตัวเดียวกับ Kanban → เทสด้วย mock fs ได้)

### 3.2 เหตุการณ์มาตรฐาน

| event | ยิงเมื่อ | งานที่ผูกไว้ |
|---|---|---|
| `scene:saved` | บันทึกฉาก | `reindex-scene` (ข้อ 86 `updateScene`) |
| `scene:status` | เปลี่ยนสถานะ | `save-scenes` (ข้อ 12) |
| `entity:renamed` | เปลี่ยนชื่อเอนทิตี้ | `rename-entity` + `reindex-links` |
| `entity:deleted` | ลบเอนทิตี้ | `reindex-links` |
| `project:opened` | เปิดโปรเจกต์ | `reindex-links` (ครั้งเดียว, priority ต่ำ) |

---

## 4. กฎย่อยที่ต้องระวัง

1. **handler ที่ throw ไม่ทำให้คิวตาย** — นับ `tries`, ครบ `maxTries` → `status:'error'` + ลง log แล้วไปงานถัดไป
2. **ห้ามยิงเหตุการณ์วนกลับ** — งานที่ emit เหตุการณ์เดิมของตัวเองจะโดน dedupe ด้วย `key` แต่ยังควรระวังในกฎ
3. `now` ฉีดเข้ามาได้ (เทสไม่ต้องพึ่งนาฬิกาจริง)
4. คิวอยู่ในหน่วยความจำ — ปิดโปรแกรมแล้วงานค้างหาย (ตั้งใจ: งานทั้งหมด idempotent สร้างใหม่ได้จากเหตุการณ์)

---

## 5. Unit test

`node test/auto-task.test.cjs` — on/off/once/wildcard/ลำดับ priority/dedupe/retry/error ไม่ทำให้คิวตาย/rule/taskLog cap/replaceName/renameEntityTask กับ mock io
