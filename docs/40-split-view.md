# ข้อ 40 — Split View (Spec)

ไฟล์: `src/layout/split-layout.js` (pure) · UI ต่อทีหลัง: `src/layout/split-ui.js`

---

## 1. โครงข้อมูล

```js
{ type:'leaf',  id, tabId }                                     // pane ที่แสดงเอกสาร/แท็บ 1 ตัว
{ type:'split', id, dir:'row'|'col', children:[…], sizes:[…] }  // row = ซ้าย-ขวา · col = บน-ล่าง
```

- `tabId` = id เดียวกับแท็บของ Panel System / แท็บเอกสารในแอป → **สองระบบอ้างของชิ้นเดียวกัน**
- `sizes` สัดส่วน 0..1 รวม = 1
- ซ้อนกี่ชั้นก็ได้ (recursive split) — split ในทิศเดียวกันติดกันจะถูก "แผ่" เป็นพี่น้องแทนการซ้อน

บันทึก localStorage คีย์ `k2-split-layout`:
```json
{ "version": 1, "root": {…} }
```

---

## 2. พฤติกรรม

### 2.1 ลากแท็บไปขอบ pane → split อัตโนมัติ

`dropZone(px, py, rect, edge=0.25)` → `'left'|'right'|'top'|'bottom'|'center'|null`
(กติกาเดียวกับ `snapZone` ของ Panel System — `center` = ทิ้งลงกลาง = แทนที่แท็บใน pane นั้น)

จากนั้น:
- แท็บ **ใหม่** (ยังไม่อยู่ในต้นไม้) → `splitPane(root, targetLeafId, side, tabId)`
- แท็บ **ที่เปิดอยู่ pane อื่น** → `moveTabToPane(root, tabId, targetLeafId, side)`
  (ถอด leaf เดิมออกก่อน แล้วค่อย split — กัน tabId ซ้ำสอง pane)
- `side='center'` → `setLeafTab(root, targetLeafId, tabId)`

### 2.2 Recursive split

`splitPane` แบ่งซ้ำได้ไม่จำกัด · ถ้า parent เป็น split ทิศเดียวกัน → แทรกเป็นพี่น้อง (ไม่ซ้อนชั้นเกิน)
`paneCount(root)` / `splitDepth(root)` ไว้ตรวจ/ทดสอบ

### 2.3 Drag handle ปรับขนาด

`resizeSplit(root, splitId, index, ratio, snapTol=0.03)`
- clamp 0.05–0.95
- **snap 50%** เมื่อเข้าใกล้กึ่งกลางในระยะ `snapTol`

### 2.4 ปิด pane

`removeLeaf(root, leafId)` → ยุบ split ที่เหลือลูกเดียวขึ้นมาแทน (ไม่มี pane ว่างค้าง)
`closeTab(root, tabId)` = หา leaf จาก tabId แล้ว removeLeaf

---

## 3. API

### 3.1 ฟังก์ชันบริสุทธิ์

```js
leaf(tabId, id?) · split(dir, children, sizes?, id?)
walk / leafIds / tabIds / paneCount / splitDepth
findLeafByTab(root, tabId) → leaf|null
dropZone(px, py, rect, edge?)
splitPane(root, targetLeafId, side, newTabId)
moveTabToPane(root, tabId, targetLeafId, side)
setLeafTab(root, leafId, tabId)
resizeSplit(root, splitId, index, ratio, snapTol?)
removeLeaf(root, leafId) · closeTab(root, tabId)
pruneTabs(root, validTabIds)         // ตัด pane ที่อ้างแท็บซึ่งถูกปิดไปแล้ว
serializeSplit / deserializeSplit
```

### 3.2 ตัวจัดการ (`SplitManager`)

```js
const sm = new SplitManager({ storage, key });
sm.open(tabId)                        // ยังไม่มี pane → เป็น root leaf · มีแล้ว → focus
sm.splitWith(tabId, side, targetLeafId?)   // ไม่ส่ง target = ใช้ pane ที่ focus อยู่
sm.moveTab(tabId, targetLeafId, side)
sm.close(tabId) · sm.closePane(leafId)
sm.focus(leafId) · sm.activeTabId()
sm.resize(splitId, index, ratio)
sm.syncWithPanels(panelManager)       // ตัด pane ที่แท็บถูกปิดจาก Panel System แล้ว
sm.load() / sm.save() / sm.reset() / sm.onChange(fn)
```

ทุกเมธอดที่เปลี่ยนโครง → บันทึก localStorage + ยิง `onChange(root, focusId)`

---

## 4. ทำงานร่วมกับ Panel System

| เรื่อง | วิธี |
|---|---|
| อ้างของชิ้นเดียวกัน | `leaf.tabId` === `panel.id` |
| ปิดแผงจาก Panel System | `sm.syncWithPanels(pm)` → `pruneTabs` ตัด pane ที่ค้าง |
| ลากแท็บออกจากกลุ่มแท็บไป split | `splitTab(root,…,null)` (panel) → `sm.splitWith(id, side)` |
| localStorage | คนละคีย์ (`k2-panel-layout` / `k2-split-layout`) เก็บ/กู้แยกอิสระ |

---

## 5. Unit test

`node test/split.test.cjs` — dropZone / split / recursive / resize+snap50 / move / prune / collapse / store / SplitManager
