# การลงนามตัวโปรแกรม (code signing / notarize) — คู่มือผู้ดูแล

> [alpha.170 · ข้อ 4 ของผลสำรวจผู้ใช้] "ตัวติดตั้งไม่ได้ลงนาม ขึ้นคำเตือน" (~80 คน · คนใช้คอมที่ทำงานติดมากเป็นพิเศษ)
> ไฟล์ที่เกี่ยว: `.github/workflows/release.yml` · `build/electron-builder.config.cjs` (ค่าของ electron-builder ล้วน) · `build/signing.cjs` (ตัดสินว่าลงนามระบบไหน) · `build/entitlements.mac.plist` · unit `signing-config`

## สถานะตอนนี้

- release workflow **พร้อมลงนามแล้ว** แต่จะลงนามก็ต่อเมื่อรีโปมี secrets ของระบบนั้นครบ — ไม่มี = ไม่ลงนาม เหมือนรุ่นก่อนทุกอย่าง
- ทุก release แนบไฟล์ `SHA256SUMS-Windows.txt` · `SHA256SUMS-macOS.txt` · `SHA256SUMS-Linux.txt` ให้ผู้ใช้ตรวจไฟล์ที่โหลด
- บันทึกของ Actions มีขั้น **Signature status** บอกผลลายเซ็นของทุกไฟล์ (ไม่ลงนาม = `NotSigned` / `not signed` · ไม่ทำให้ workflow ล้ม)
- ⚠️ ทางที่ลงนามจริงยังไม่เคยรันกับใบรับรองจริง (ยังไม่มีใบรับรอง) — release แรกที่ตั้ง secrets ให้เปิดบันทึกขั้น Package / Sign with SignPath / Signature status ดูทุกบรรทัด

ตั้ง secrets ที่ **Settings → Secrets and variables → Actions** ของรีโป · "secret" = ค่าลับ (แท็บ Secrets) · "var" = ค่าธรรมดา (แท็บ Variables)

## macOS — Developer ID + notarize

ใช้ได้กับบุคคลธรรมดาในประเทศไทย ผ่าน Apple Developer Program (ค่าสมาชิกรายปี — ดูราคาปัจจุบันที่ developer.apple.com)

1. สมัคร Apple Developer Program
2. สร้างใบรับรอง **Developer ID Application** (Xcode → Settings → Accounts → Manage Certificates หรือหน้า Certificates บนเว็บ) แล้ว export จาก Keychain Access เป็นไฟล์ `.p12` พร้อมรหัสผ่าน
3. แปลงเป็น base64: `base64 -i DeveloperID.p12 | pbcopy`
4. สร้าง app-specific password ที่ appleid.apple.com → Sign-In and Security → App-Specific Passwords
5. ตั้งค่าในรีโป:

| ชื่อ | ชนิด | ค่า |
|---|---|---|
| `MAC_CERT_P12_BASE64` | secret | ผลจากข้อ 3 |
| `MAC_CERT_PASSWORD` | secret | รหัสผ่านของไฟล์ `.p12` |
| `APPLE_ID` | secret | อีเมลบัญชี Apple Developer |
| `APPLE_APP_SPECIFIC_PASSWORD` | secret | ผลจากข้อ 4 |
| `APPLE_TEAM_ID` | secret | Team ID (หน้า Membership บน developer.apple.com) |

มีใบรับรองแต่ไม่มีสามค่าล่าง = ลงนามแต่ไม่ notarize (Gatekeeper ยังเตือนบน macOS รุ่นใหม่) · ใช้ App Store Connect API key แทน Apple ID ได้ (ตั้ง `APPLE_API_KEY` · `APPLE_API_KEY_ID` · `APPLE_API_ISSUER` แล้วเพิ่มบรรทัดใน env ของขั้น Package)

หลังลงนาม + notarize แล้ว ผู้ใช้ macOS เปิดได้ด้วยดับเบิลคลิกตามปกติ ไม่ต้องคลิกขวา → Open หรือใช้ `xattr` อีก

## Windows — เลือกหนึ่งทาง

### ทาง A: SignPath Foundation (ฟรีสำหรับโอเพนซอร์ส — แนะนำ)

ใบรับรองออกในชื่อ "SignPath Foundation" และลงนามหลังจากตรวจว่าไฟล์มาจาก build ของรีโปสาธารณะนี้จริง เงื่อนไขหลัก (ตรวจฉบับล่าสุดที่ signpath.org ก่อนสมัคร):
ไลเซนส์ที่ OSI รับรอง (โปรเจกต์นี้ใช้ ISC ✓) · รีโปสาธารณะ · ดาวน์โหลดฟรี · ยังพัฒนาอยู่ · มีหน้าดาวน์โหลด · ต้องให้เครดิต SignPath ใน README

1. สมัครที่ signpath.org/apply (ใช้ข้อมูลรีโป `Nbcybg/Killian-Editor-V2`)
2. หลังอนุมัติ ในหน้า SignPath ตั้ง: Trusted Build System = GitHub · Artifact configuration = ไฟล์ zip ที่มี `*.exe` แล้วลงนาม `*.exe` ข้างใน · Signing policy (เช่น `release-signing`)
3. ตั้งค่าในรีโป:

| ชื่อ | ชนิด | ค่า |
|---|---|---|
| `SIGNPATH_API_TOKEN` | secret | API token ของ CI user ใน SignPath |
| `SIGNPATH_ORGANIZATION_ID` | var | Organization ID |
| `SIGNPATH_PROJECT_SLUG` | var | slug ของโปรเจกต์ |
| `SIGNPATH_POLICY_SLUG` | var | slug ของ signing policy |
| `SIGNPATH_ARTIFACT_CONFIG` | var | slug ของ artifact configuration (เว้นว่าง = ค่าเริ่มต้นของโปรเจกต์) |

ขั้นตอนใน workflow: build ไฟล์ปกติ → อัปโหลดเป็น artifact → `signpath/github-action-submit-signing-request` ส่งไปลงนามแล้วรอ → เอาไฟล์ที่ลงนามแล้วทับใน `dist/` → แนบเข้า Release
นโยบายของ SignPath อาจต้องให้คนกดอนุมัติแต่ละคำขอ (workflow จะรอจนอนุมัติ)

### ทาง B: Azure Artifact Signing (เดิมชื่อ Trusted Signing)

ราคาถูก ไม่ต้องมี token แต่ **บุคคลธรรมดาสมัครได้เฉพาะสหรัฐฯ/แคนาดา** (องค์กร: สหรัฐฯ แคนาดา EU UK) — ณ ต.ค. 2026 ผู้ดูแลที่เป็นบุคคลในไทยยังใช้ไม่ได้ ถ้าวันหนึ่งจดเป็นบริษัทในประเทศที่รับ:

| ชื่อ | ชนิด | ค่า |
|---|---|---|
| `AZURE_TENANT_ID` · `AZURE_CLIENT_ID` · `AZURE_CLIENT_SECRET` | secret | app registration ที่ได้บทบาท "ผู้ลงนามของ certificate profile" (ชื่อบทบาทล่าสุดดูในเอกสารของ Microsoft) |
| `K2_AZURE_ENDPOINT` | var | เช่น `https://wus2.codesigning.azure.net` |
| `K2_AZURE_ACCOUNT` | var | ชื่อ signing account |
| `K2_AZURE_PROFILE` | var | ชื่อ certificate profile |
| `K2_AZURE_PUBLISHER` | var | ชื่อผู้เผยแพร่ ต้องตรงกับชื่อที่ผ่านการยืนยันตัวตน |

ทางนี้ลงนามระหว่าง build ผ่าน `win.azureSignOptions` ของ electron-builder (ตั้งให้ใน `build/electron-builder.config.cjs` เมื่อค่าครบเจ็ดตัว)

### ทางที่ไม่ได้ต่อไว้: ใบรับรอง OV/EV แบบซื้อจาก CA

ตั้งแต่ปี 2023 กุญแจของใบรับรองแบบนี้ต้องอยู่ในฮาร์ดแวร์ (USB token / HSM บนคลาวด์) export เป็นไฟล์ `.pfx` ไม่ได้แล้ว จึงต่อกับ GitHub Actions ตรง ๆ ไม่ได้ ต้องใช้บริการลงนามบนคลาวด์ของ CA นั้น ถ้าเลือกทางนี้ค่อยเพิ่มขั้นลงนามใน workflow ตามเอกสารของผู้ให้บริการ

### เรื่องที่ควรรู้

- ลงนามแล้ว SmartScreen อาจยังเตือนในช่วงแรกจนใบรับรองมี "ชื่อเสียง" พอ (ยิ่งมีคนโหลดมาก คำเตือนยิ่งหายเร็ว) — แต่คำเตือนจะบอกชื่อผู้เผยแพร่แทน "Unknown publisher"
- Linux (AppImage) ไม่มีระบบลงนามที่ OS ตรวจ — ใช้ `SHA256SUMS-Linux.txt`
- ตัวอัปเดตในโปรแกรมเลือกไฟล์จากชื่อ (`ASSET_RULES` ใน `src/update/update-check.js`) — ไฟล์ `SHA256SUMS-*.txt` ไม่ตรงกฎใด จึงไม่ถูกหยิบผิด

## หลังตั้งค่าเสร็จ

1. push tag ของรุ่นใหม่ตามปกติ (กฎถาวร alpha.release.1)
2. เปิดบันทึกของงาน build แต่ละระบบ → ขั้น **Signature status** ต้องเห็น `Valid` (Windows) / `Authority=Developer ID Application …` + `accepted` (macOS)
3. แก้ข้อความใน README (ตาราง Download + หัวข้อ macOS in detail) และคู่มือบท 1 ให้เลิกบอกวิธีข้ามคำเตือนของระบบที่ลงนามแล้ว
