# BUILD — Killian 2 · 2.0.0-alpha.129 · macOS Intel (x64)

| | |
|---|---|
| ไฟล์ | `dist/Killian2-2.0.0-alpha.129-mac-intel.dmg` |
| ขนาด | 128 MB |
| SHA-256 | `08a52e41d78ed6139d9056b19158863f4903c330bd3c4d8aae89b370c108d696` |
| สร้างเมื่อ | 2026-09-04 16:23 (เครื่อง Top · macOS 24.6.0) |
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
| unit | **87 ไฟล์ · 5,573 ข้อ · ผ่านครบ** |
| e2e (`KILLIAN_TEST=1`) | **4,262 ข้อ · `ALL OK`** |
| smoke test | เปิด `.app` จริง · มีครบทั้ง `--type=renderer` / `gpu` / `utility` · log ไม่มี error/unhandled |
| ยืนยันโค้ดใหม่อยู่ในบิลด์ | `grep -ac buildChatMessages app.asar` = 10 · `grep -ac ai-md-pre app.asar` = 9 |

## มีอะไรใหม่

รอบนี้แก้แชท AI ทั้งชุด — ดู [CHANGELOG.md](CHANGELOG.md) หัวข้อ alpha.129

- AI **จำบทสนทนาได้จริง** (เดิมส่งเซสชันก้อนเก่าเข้าไปทุกครั้ง โมเดลไม่เคยเห็นแชทก่อนหน้า)
- สลับมุมมอง/โหมด/ระดับการเข้าถึง **แล้วแชทไม่หาย** (เดิมเขียนทับไฟล์เซสชันจนหายถาวร)
- งบประวัติแชท 6,000 → 32,000 token · ตั้งเองได้ที่ **ตั้งค่า AI → งบประวัติแชท**
- คำตอบขึ้นเป็น **Markdown จริง** พร้อมโค้ดบล็อก + ปุ่มคัดลอก
- ปุ่มไม่ค้างถาวรเมื่อมีอะไรพังกลางทาง (แชท + กล่อง AI อีก 3 ตัว)

## สร้างซ้ำ

```bash
cd "/Users/kaipleng/Desktop/Killian_Editor-master 2"
npm run dist:mac
git checkout HEAD -- package.json    # electron-builder เขียนทับ package.json — ต้องคืนทุกครั้ง
```
