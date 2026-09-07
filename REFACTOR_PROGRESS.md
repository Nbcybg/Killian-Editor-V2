# แยกไฟล์ JS — Progress Tracker (Phase R)

เป้าหมาย: แยก src/app.js (6,792 บรรทัด) → ~10 ไฟล์ตาม domain
กฎ: ตัวแปร `let` ที่ reassign ต้องอยู่ไฟล์เดียวกับฟังก์ชันที่แก้มัน
Build check (esbuild) ทุกก้าว · e2e จริงรวบทีเดียวตอนจบ (ตามที่ Top ขอ)
Baseline ก่อนแยก: 347 checks ALL OK

## แผนไฟล์
- [x] core.js  ✅ build OK       — $, el, state, smart, log, setStatus, constants ที่ share (ไม่ reassign)
- [ ] recycle.js    — ถังขยะ (coupling ต่ำ)
- [ ] exports.js    — export/compile draft
- [ ] scene-ops.js  — add/rename/delete/move scene
- [ ] section-ops.js— add/rename/delete section + chapter
- [ ] wiki-ui.js    — openEntity/addEntity/wiki cats
- [ ] dialogs.js    — settings/sceneProps/version/log viewer
- [x] dashboard.js ✅ (แยกจาก views) build OK · circular import จาก app.js      — dashboard/books/timeline-ui/maps-ui
- [ ] คงใน app.js   — bootstrap, explorer(buildTree+treeScope), tabs, toolbar(floatBar), zoom(pageZoom), commands, shortcuts, selftest

## สถานะ
R1 core.js ✅ · R2 constants→core ✅ · R3 dashboard.js ✅ (circular pattern) · กำลัง e2e checkpoint

## ✅ Checkpoint 1 ผ่าน (347 ALL OK) หลังยก core+constants+dashboard
app.js 6,792 → 6,580 บรรทัด · core.js 71 · dashboard.js 164

### บทเรียนสำคัญ (สำหรับยกโมดูลต่อ + opencode)
1. **import helper ให้ครบทุกตัว** — โดยเฉพาะ `$`, `el`, `state`, `setStatus`, `log`
   esbuild ปล่อย undefined global เป็น runtime lookup → **build ผ่านแต่ runtime พัง**
   จับได้เฉพาะตอน e2e → ต้อง e2e เป็น checkpoint ทุก ~2-3 โมดูล
2. **circular import (spoke → app.js) ใช้ได้** ถ้าเรียกตอน runtime (event handler/หลังโหลด)
   ต้อง `export` หน้า function ใน app.js ที่ spoke ต้องใช้
3. เช็ค signature จริงก่อนเติม export (`function` vs `async function`)

### เหลือยก (รอบต่อ ๆ ไป)
- books.js, timeline-ui.js, maps-ui.js (views ที่เหลือ)
- wiki-ui.js (openEntity/cats), scene-ops.js, section-ops.js
- dialogs.js (settings/sceneProps/version/log viewer)
- recycle.js
- คงใน app.js: bootstrap, explorer(buildTree/treeScope), tabs, toolbar(floatBar/pageZoom), commands, shortcuts, selftest

### ต้องทำก่อนส่ง opencode
- AGENTS.md: build (node build.js) · e2e (xvfb electron) · กฎ import/core · ต้องเพิ่ม selftest ทุกฟีเจอร์ · ห้ามลด check


## ✅✅ แยกเสร็จ — e2e 347 ALL OK
แยก 11 โมดูล: core dashboard recycle books dialogs wiki-ui scene-ops section-ops timeline-ui maps-ui scene-props
app.js 6792→5335 · AGENTS.md เขียนแล้ว
