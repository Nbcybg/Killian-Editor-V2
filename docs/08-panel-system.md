# ข้อ 8 — Panel System + Docking (Spec)

ไฟล์: `src/panels/panel-layout.js` (ต้นไม้เลย์เอาต์ · pure) · `src/panels/panel-store.js` (บันทึก + ตัวจัดการ API)

UI (DeepSeek ทำต่อ): `src/panels/panel-ui.js` — โมดูลสองไฟล์นี้ **ไม่แตะ DOM เลย** จึงเทสด้วย node ได้ตรง ๆ

---

## 1. โครงข้อมูล (Data Structure)

### 1.1 ต้นไม้เลย์เอาต์ (`root`)

โหนด 3 ชนิด ซ้อนกันได้ไม่จำกัดชั้น:

```js
{ type:'panel', id, title, collapsed?:boolean }              // ใบ — panel เดี่ยว
{ type:'tabs',  id, children:[panel…], active:number }       // กลุ่มแท็บ
{ type:'dock',  id, dir:'row'|'col', children:[…], sizes:[…] } // ผนึกแนวนอน/ตั้ง
```

- `sizes` = สัดส่วน 0..1 รวมกัน = 1 (ปรับด้วย `resizeDock`)
- `collapsed:true` = ปุ่ม ▾ ย่อแล้ว (UI แสดงเฉพาะหัวแผง แต่โหนดยังอยู่ในต้นไม้)
- `id` ของ panel = คีย์ที่ลงทะเบียนไว้ (`registerPanel`) — ต้องไม่ซ้ำทั้งต้นไม้

### 1.2 แผงลอย (`floats`) — เก็บนอกต้นไม้

```js
{ id:'f…', panel:{type:'panel',id,title}, x, y, w, h }
```

### 1.3 ทะเบียนแผง (`registry`) — **ไม่บันทึกลง localStorage**

```js
{ id, title, icon, render, closable, floatable, defaultSide, defaultSize }
```
`render` เป็นฟังก์ชัน serialize ไม่ได้ → ทะเบียนสร้างใหม่ทุกครั้งที่เปิดโปรแกรม
แล้วค่อย `load()` เลย์เอาต์มาสวมทับ (เลย์เอาต์เก็บแค่ id + โครง)

### 1.4 รูปแบบที่บันทึก (localStorage key `k2-panel-layout`)

```json
{ "version": 1, "root": {…}, "floats": [ … ] }
```
`deserializeLayout` มี `migrate()` — schema เก่าที่ไม่มี `version` ถือเป็น v0 แล้วอัปเป็น v1 ให้
เวอร์ชันที่สูงกว่าที่รู้จัก → คืน `null` (ทิ้งเลย์เอาต์ ปลอดภัยกว่าอ่านมั่ว)

---

## 2. พฤติกรรม

### 2.1 ลากไปขอบ → ผนึก (snap)

`snapZone(px, py, rect, edge=0.25)` → `'left'|'right'|'top'|'bottom'|'center'|null`

- อยู่นอกกรอบ → `null`
- ระยะถึงขอบที่ใกล้ที่สุด > `edge` → `'center'` (= ทิ้งกลาง = รวมเป็นแท็บ)
- ไม่งั้น → ชื่อขอบที่ใกล้สุด

### 2.2 ผนึก (dock)

`dockPanel(root, targetId, side, newPanel)`
- `side='center'` → เรียก `addAsTab`
- ถ้า parent เป็น `dock` ทิศเดียวกันอยู่แล้ว → **แทรกเป็นพี่น้อง** (ไม่ซ้อน dock เกินจำเป็น)
- ไม่งั้นห่อ target เป็น dock ใหม่

### 2.3 กลุ่มแท็บ

- `addAsTab` — เพิ่ม panel เข้ากลุ่มของ target (ห่อเป็น `tabs` ให้ถ้ายังไม่ใช่) แล้วตั้ง active = ตัวใหม่
- `moveTab(root, tabsId, from, to)` — สลับลำดับในกลุ่ม
- `setActiveTab(root, tabsId, index)` — เปลี่ยนแท็บที่แสดง
- `splitTab(root, panelId, side)` — แยกออกจากกลุ่มไป dock ด้านที่ระบุ (`side=null` → คืน `detached` ให้ไปทำเป็นแผงลอย)
- `groupPanels(root, ids)` — รวมหลาย panel เป็นกลุ่มเดียว โดยยึดตำแหน่งของ `ids[0]`

### 2.4 ปิด / ย่อ / ลอย (ปุ่มบนหัวแผง)

| ปุ่ม | ความหมาย | ฟังก์ชัน |
|---|---|---|
| `✕` | ปิด | `removePanel(root,id)` → ยุบ container ที่เหลือลูกเดียว/ว่างอัตโนมัติ |
| `▾` | ย่อ/ขยาย | `collapsePanel(root,id,on)` → toggle `collapsed` |
| `⧉` | ลอย ↔ ผนึก | `PanelManager.toggleFloat(id)` |

ค่าคงที่ `PANEL_BUTTONS` ใน panel-layout.js ให้ UI เอาไปวาด (ไอคอน + title ไทย + action)

### 2.5 ปรับขนาด

`resizeDock(root, dockId, index, ratio)` — แบ่งสัดส่วนคู่ที่ติดกัน (`index`, `index+1`)
clamp 0.05–0.95 กันแผงหายไปเลย

---

## 3. API (ตัวจัดการระดับสูง — `PanelManager` ใน panel-store.js)

```js
const pm = new PanelManager();                 // ใช้ localStorage โดยปริยาย (node → in-memory)

pm.registerPanel(id, { title, icon, render, closable, floatable, defaultSide, defaultSize })
pm.showPanel(id, { side='left', targetId })    // ยังไม่มี → dock เข้า · มีแล้ว → เลื่อนมาหน้า + คลาย collapse
pm.hidePanel(id)                               // = ปุ่ม ✕ (เอาออกจากทั้งต้นไม้และแผงลอย)
pm.dockPanel(id, side, targetId)               // ลอยอยู่ → ผนึกกลับ · อยู่แล้ว → ย้ายที่
pm.floatPanel(id, { x, y, w, h })              // ผนึกอยู่ → ดึงออกมาลอย
pm.toggleFloat(id)                             // ปุ่ม ⧉
pm.collapsePanel(id, on)                       // ปุ่ม ▾ (on ไม่ส่ง = toggle)
pm.groupPanels(ids)                            // รวมเป็น Tab Group
pm.activatePanel(id)                           // เลือกแท็บนั้นในกลุ่ม
pm.resize(dockId, index, ratio)
pm.isOpen(id) / pm.isFloating(id) / pm.openIds()
pm.save() / pm.load() / pm.reset()
pm.onChange(fn)                                // fn(root, floats) — UI subscribe เพื่อ re-render
```

**ทุกเมธอดที่เปลี่ยนเลย์เอาต์ บันทึก localStorage + ยิง `onChange` ให้อัตโนมัติ**

`load()` จะตัด panel ที่ไม่ได้ลงทะเบียนไว้ทิ้ง (กันเลย์เอาต์เก่าอ้างแผงที่ถอดออกไปแล้ว)
→ ต้อง `registerPanel` ให้ครบ **ก่อน** เรียก `load()`

---

## 4. จุดเชื่อมกับระบบอื่น

- **Split View (ข้อ 40)** — `leaf.tabId` ใน split tree อ้าง id เดียวกับ panel id → ลากแท็บข้ามได้
- **UI เดิม** (`makeFloatablePanel` ใน app.js) ยังอยู่เหมือนเดิม ไม่ถูกแทนที่จนกว่า panel-ui.js จะพร้อม
- localStorage คนละคีย์กับ `k2-ui-layout` เดิม → ไม่ชนกัน

---

## 5. Unit test

`node test/panel.test.cjs` — snap / dock / tab group / collapse / resize / store+migrate / PanelManager
