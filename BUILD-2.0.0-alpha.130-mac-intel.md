# BUILD — Killian 2 · 2.0.0-alpha.130 · macOS Intel (x64)

| | |
|---|---|
| ไฟล์ | `dist/Killian2-2.0.0-alpha.130-mac-intel.dmg` |
| ขนาด | 128 MB |
| SHA-256 | `e5e87488c0c93bceb16f675d627d5c71874b6c209bfac68c4615417c62f39918` |
| สร้างเมื่อ | 2026-09-04 17:14 (เครื่อง Top · macOS 24.6.0) |
| Electron | 43.2.0 · electron-builder |
| สถาปัตยกรรม | x64 (Intel) · ลายเซ็น: ไม่มี (`identity: null`) · ไม่มีไอคอน `.icns` |

> ⚠️ `.dmg` 128 MB เกินขีดจำกัด 100 MB/ไฟล์ ของ GitHub push — **ห้าม commit ลงสาขา**

---

## วิธีเปิดครั้งแรก (macOS)

**คลิกขวาที่ `Killian 2.app` → Open** (ไม่ใช่ดับเบิลคลิก) · ถ้ายังไม่ผ่าน:

```bash
xattr -cr "/Applications/Killian 2.app"
```

---

## ผลการทดสอบก่อนปล่อย

| ชุด | ผล |
|---|---|
| unit | **87 ไฟล์ · 5,573 ข้อ · ผ่านครบ** (`pdf-generator` 139 ข้อ) |
| e2e (`KILLIAN_TEST=1`) | **4,293 ข้อ · `ALL OK`** |
| smoke test | เปิด `.app` จริง · ครบทั้ง `--type=renderer` / `gpu` / `utility` · log ไม่มี error/unhandled |
| ยืนยันโค้ดใหม่อยู่ในบิลด์ | `shapeOf` 3 · `PDF_ELEMENT_COLORS` 5 · `onSelectAllKey` 3 |

## มีอะไรใหม่ — แก้บั๊กที่ผู้ใช้รายงาน 5 ข้อ

ดู [CHANGELOG.md](CHANGELOG.md) หัวข้อ alpha.130

1. **Ctrl+A → สั่งจัดหน้า แล้วการตัดหน้าเละ** — เส้นคั่นหน้าหายจากจอถาวร (โมเดล 11 · จอ 7)
2. **จุดนำ/หมายเลขข้อไม่ตามการจัดหน้า** — marker เคยไปกางเป็นบรรทัดของตัวเอง
3. **เลือกทั้งหมดแล้วปุ่มจัดหน้าไม่ติดไฟ** — และตอนนี้กดปุ่มเดิมซ้ำ = สลับกลับ
4. **Ctrl+A เลือกข้อความทั้งแอป** — มีขอบเขตแล้ว
5. **ส่งออก PDF** — แยกสวิตช์เลขฉาก/เลขหน้า + เพิ่มโหมดสี (ค่าเริ่มต้นยังขาวดำ)

> **ยังค้าง (P-1)**: ระยะระหว่างเส้นคั่นหน้ายังไม่เท่ากันเป๊ะ (1112/1056/1084 วนซ้ำ)
> — คนละเรื่องกับข้อ 1 · เป็นแบบนี้มาก่อนแล้ว · เบาะแสอยู่ในตาราง Known issues ของ CHANGELOG

## สร้างซ้ำ

```bash
cd "/Users/kaipleng/Desktop/Killian_Editor-master 2"
npm run dist:mac
git checkout HEAD -- package.json    # electron-builder เขียนทับ package.json — ต้องคืนทุกครั้ง
```
