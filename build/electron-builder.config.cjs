// build/electron-builder.config.cjs — [alpha.170 · ข้อ 4] ลงนามตัวโปรแกรม "เมื่อมีใบรับรอง" เท่านั้น
//
// ใช้เฉพาะใน .github/workflows/release.yml (`electron-builder --config build/electron-builder.config.cjs`)
// ค่าพื้นฐานมาจาก `package.json → build` ตัวเดียว (ชื่อไฟล์ · เป้าหมาย · ไอคอน) — ไฟล์นี้แค่ "เปิดการลงนาม" ทับ
// ตามตัวแปรสภาพแวดล้อมที่ workflow ส่งมาจาก secrets ของรีโป:
//
//   macOS (Developer ID + notarize):  CSC_LINK (.p12 แบบ base64) · CSC_KEY_PASSWORD
//                                     + APPLE_ID · APPLE_APP_SPECIFIC_PASSWORD · APPLE_TEAM_ID  (หรือ APPLE_API_KEY · APPLE_API_KEY_ID · APPLE_API_ISSUER)
//   Windows (Azure Artifact Signing): AZURE_TENANT_ID · AZURE_CLIENT_ID · AZURE_CLIENT_SECRET
//                                     + K2_AZURE_ENDPOINT · K2_AZURE_ACCOUNT · K2_AZURE_PROFILE · K2_AZURE_PUBLISHER
//   (Windows ทาง SignPath ลงนามหลัง build ใน workflow เอง — ไม่ผ่านไฟล์นี้)
//
// ตรรกะอยู่ build/signing.cjs · ไฟล์นี้ต้อง export "ค่าของ electron-builder ล้วน" เท่านั้น (ห้ามแนบฟังก์ชัน — schema ไม่รับ)
// ไม่มีตัวแปรชุดไหน = ระบบนั้นยังไม่ลงนาม เหมือนเดิมทุกอย่าง (build ในเครื่องด้วย `npm run dist*` ก็ไม่ลงนามเสมอ)
// วิธีสมัคร/ตั้งค่า: docs/signing.md

const path = require('path');
const { signingConfig } = require('./signing.cjs');

module.exports = signingConfig(require(path.join(__dirname, '..', 'package.json')).build, process.env);
