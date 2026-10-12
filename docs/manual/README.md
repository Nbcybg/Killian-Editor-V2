# Killian 2 User Manual · คู่มือผู้ใช้ Killian 2

Choose a language · เลือกภาษา

| | |
|---|---|
| **English** | [en/README.md](en/README.md) — 16 chapters from first launch to troubleshooting, plus appendices listing every menu, shortcut, command, file format and term |
| **ภาษาไทย** | [th/README.md](th/README.md) — 16 บท ตั้งแต่เปิดโปรแกรมครั้งแรกถึงการแก้ปัญหา + ภาคผนวกทุกเมนู ทุกปุ่มลัด ทุกคำสั่ง รูปแบบไฟล์ และอภิธานศัพท์ |

Both editions cover Killian 2 **2.0.0-alpha.169** and have the same chapters under the same file names (`en/05-screenplay.md` ↔ `th/05-screenplay.md`). Every page has a link to the other language under its title.

ทั้งสองฉบับใช้กับ Killian 2 รุ่น **2.0.0-alpha.169** มีบทเดียวกันในชื่อไฟล์เดียวกัน ทุกหน้ามีลิงก์สลับภาษาใต้หัวเรื่อง

Writing plugins? See the [Extension Guide](../extension/README.md) · เขียนปลั๊กอิน: ดู [คู่มือส่วนขยาย](../extension/README.md)

---

**For maintainers** — each language is a folder (`en/`, `th/`) with its own `img/` (screenshots taken in that interface language). To add a language, copy `en/` to `<code>/`, translate, and retake the screenshots. Appendices A–C (menus · shortcuts · commands) are generated from the app's real menu and `icons/commands.csv` in each interface language; regenerate them for every language when a menu, shortcut or command changes, or the version number is bumped:

```bash
node tools/docs-appendix.cjs            # rewrite A–C for every language (launches the app once per language)
node tools/docs-appendix.cjs --check    # write nothing; exit code 1 when the appendices in the repo are out of date
```

Do not edit `A-menus.md`, `B-shortcuts.md` or `C-commands.md` by hand — they are overwritten. Their per-language wording lives in `tools/docs-appendix-text.cjs`; a new language needs a block there as well.
