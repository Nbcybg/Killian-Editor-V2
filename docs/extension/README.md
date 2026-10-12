# Killian 2 Extension Guide · คู่มือส่วนขยาย Killian 2

Choose a language · เลือกภาษา

| | |
|---|---|
| **English** | [en/README.md](en/README.md) — plugin anatomy · the `k2` SDK reference · hooks & lifecycle · UI guidelines · data & files · security · packaging & distribution · publishing · other extension points · debugging & testing · cookbook |
| **ภาษาไทย** | [th/README.md](th/README.md) — โครงสร้างปลั๊กอิน · อ้างอิง SDK (`k2`) · ตะขอและวงจรชีวิต · แนวทางหน้าตา · ข้อมูลและไฟล์ · ความปลอดภัย · บรรจุและแจกจ่าย · การเผยแพร่ · จุดต่อขยายอื่น · ดีบักและทดสอบ · ตำรับ |

Shared by both languages · ใช้ร่วมกันทั้งสองภาษา

| | |
|---|---|
| [`k2.d.ts`](k2.d.ts) | Type definitions for the plugin API (comments in English) · ไฟล์ชนิดข้อมูลของ API ปลั๊กอิน (คำอธิบายเป็นภาษาอังกฤษ) |
| [`examples/`](examples/README.md) | Three working plugins with English/Thai text ([ภาษาไทย](examples/README.th.md)) · ปลั๊กอินตัวอย่างสามตัวที่รันได้จริง มีข้อความสองภาษา |

Both editions cover Killian 2 **2.0.0-alpha.169 and later** and have the same chapters under the same file names. Every page has a link to the other language under its title.

ทั้งสองฉบับใช้กับ Killian 2 รุ่น **2.0.0-alpha.169 ขึ้นไป** มีบทเดียวกันในชื่อไฟล์เดียวกัน ทุกหน้ามีลิงก์สลับภาษาใต้หัวเรื่อง

Only installing plugins? See [chapter 14 of the User Manual](../manual/en/14-plugins.md) · แค่ติดตั้งปลั๊กอิน: ดู [คู่มือผู้ใช้ บทที่ 14](../manual/th/14-plugins.md)

---

**For maintainers** — when `pluginApi()` in `src/app.js` changes, update `k2.d.ts` and chapter 3 (SDK reference) **in every language** in the same commit; a new app event also needs a row in chapter 4. To add a language, copy `en/` to `<code>/` and translate.
