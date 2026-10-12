# BUILD — Killian 2 · 2.0.0-alpha.169 · macOS Intel (x64)

| | |
|---|---|
| ไฟล์ | `dist/Killian2-2.0.0-alpha.169-mac-intel.dmg` |
| ขนาด | 143 MB (142,528,079 ไบต์) · `Killian 2.app` 333 MB |
| SHA-256 | `bf08d1a29f1d12ed4f9d89172dd35e726759d2fe78bb0cf2660213563a63fda8` |
| สร้างเมื่อ | 2026-10-12 17:14 (MacBook Pro 15 นิ้ว ปี 2019 · Intel Core i9 · macOS 15.7.4) |
| Electron | 43.2.0 · electron-builder |
| สถาปัตยกรรม | x64 (Intel) · ลายเซ็น: ไม่มี (`identity: null`) · ไอคอน: `icon.icns` (จาก `build/icon.png`) |
| macOS ขั้นต่ำ | 12.0 (`LSMinimumSystemVersion`) · Apple Silicon รันผ่าน Rosetta 2 |
| ลิขสิทธิ์ในตัวแอป | Copyright © 2026 Noobcyborg Studio |

> ⚠️ `.dmg` เกินขีดจำกัด 100 MB/ไฟล์ ของ GitHub push — **ห้าม commit ลงสาขา** (แจกทาง GitHub Release)

---

## สเปกที่วัดจากตัวแพ็กนี้

| | |
|---|---|
| หน่วยความจำ | ~400 MB (`footprint` รวม 4 โปรเซส · เปิดโปรเจกต์ตัวอย่างขนาดเล็กทิ้งไว้ 25 วินาที): renderer ~170 · GPU ~130 · main ~95 · utility ~11 |
| เวลาเปิด | ~2 วินาทีจนโปรเจกต์พร้อมใช้ (ครั้งแรกสุดหลัง build/ติดตั้ง ~5 วินาที) |
| ในตัวแพ็ก | คู่มือผู้ใช้ + คู่มือส่วนขยาย (`docs/manual` · `docs/extension` · สองภาษา พร้อมรูป) — เปิดจาก ช่วยเหลือ ได้โดยไม่ต่อเน็ต |

วิธีวัดซ้ำ: เปิดตัวแพ็กด้วย `--user-data-dir=<โฟลเดอร์ชั่วคราว>` ที่มี `settings.json {"openLastProject":true}` + `recent.json` ชี้โปรเจกต์จาก `node test/fixture.js`
จับเวลาจนชื่อหน้าต่างมีชื่อโปรเจกต์ แล้ว `footprint -p <pid ของทุกโปรเซส>`

## วิธีเปิดครั้งแรก (macOS)

**คลิกขวาที่ `Killian 2.app` → Open → Open** (ไม่ใช่ดับเบิลคลิก) · ถ้ายังไม่ผ่าน:

```bash
xattr -cr "/Applications/Killian 2.app"
```

---

## ผลการทดสอบก่อนปล่อย

| ชุด | ผล |
|---|---|
| unit | **173 ไฟล์ · 12,456 ข้อ · ผ่านครบ** |
| e2e (`KILLIAN_TEST=1` · รันจากซอร์ส) | **6,497 ข้อ · `ALL OK`** (รอบเต็ม ~55 นาทีบนเครื่องนี้) |
| ตัวแพ็ก | เปิด `.app` จริงผ่าน CDP: โปรเจกต์เปิด · คู่มือผู้ใช้เปิดจากใน `app.asar` (22 บท · รูปโหลด) · ไฟล์ `k2.d.ts` เปิดได้ · กล่อง "เกี่ยวกับ" แสดงรุ่น + ลิขสิทธิ์ |
| ไฟล์ในตัวแพ็ก | `npx asar list`: `docs/` 197 รายการ + `renderer/docs-copy/k2.d.ts.txt` |

**ยังไม่ได้ทดสอบ**: เครื่อง Apple Silicon จริง (Rosetta 2) · macOS 12–14 (ทดสอบบน 15.7 เครื่องเดียว) · การติดตั้งจาก `.dmg` ผ่าน Gatekeeper บนเครื่องอื่น

## มีอะไรใหม่

ดู [CHANGELOG.md](CHANGELOG.md) หัวข้อ alpha.169 → "รอบต่อ 4": ขอฟีเจอร์ในกล่องรายงานบั๊ก · คู่มือในโปรแกรม · ลิงก์สนับสนุน · ลิขสิทธิ์ Noobcyborg Studio ·
ไอคอนของตัว macOS (เดิมเป็นไอคอน Electron ตั้งต้น) · กล่องโต้ตอบไม่เด้งซ้ำหลังลาก
"รอบต่อ 5": กล่อง "เกี่ยวกับ" ไม่เอ่ยถึง Killian v1 · เครดิตตรงกับของจริง · Story Starter ไม่มีช่องภาพแบบ setup wizard

## สร้างซ้ำ

```bash
npm ci
node node_modules/electron/install.js     # ครั้งแรกเท่านั้น (postinstall ของ electron ไม่รันเอง)
cp package.json /tmp/package.json.bak     # โฟลเดอร์นี้ไม่ใช่ git repo — สำรองไว้เทียบหลัง build
npm run dist:mac
diff /tmp/package.json.bak package.json   # ต้องไม่ต่าง
shasum -a 256 dist/Killian2-2.0.0-alpha.169-mac-intel.dmg
```
