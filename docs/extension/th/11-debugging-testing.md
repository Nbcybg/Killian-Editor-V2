# 11. ดีบักและทดสอบ

**ภาษา:** ไทย · [English](../en/11-debugging-testing.md)

[← 10. จุดต่อขยายอื่นนอกปลั๊กอิน](10-other-extension-points.md) · [ภาพรวม](README.md) · ถัดไป: [12. ตำรับ (Cookbook) →](12-cookbook.md)

---

## 11.1 วงจรพัฒนา

```
แก้ main.js  →  บันทึก  →  แผงปลั๊กอิน: "โหลดใหม่"  →  ลอง  →  ดู Log / DevTools
```

- พัฒนาใน **โฟลเดอร์ปลั๊กอินของผู้ใช้** — ไม่ต้องกดอนุญาตซ้ำทุกครั้งที่แก้ไฟล์ (ปลั๊กอินในโฟลเดอร์ผลงานต้องอนุญาตใหม่ทุกครั้งที่ไฟล์เปลี่ยน)
- **โหลดใหม่** รันเฉพาะปลั๊กอินที่ไฟล์เปลี่ยน: ตัวเก่าถูกถอด (`onUnload('reload')`) แล้วตัวใหม่รันทันที
- ยังไม่ประกาศ `hotReload` → ทุกครั้งที่โหลดใหม่ แผงจะขึ้นแถบ "ต้องเริ่มโปรแกรมใหม่" — ระหว่างพัฒนาเพิกเฉยได้ **ถ้าคุณรู้ว่าของเก่าค้างอะไรไว้** · ถ้าพฤติกรรมแปลก (ทำงานสองรอบ · ของซ้อน) ให้เริ่มโปรแกรมใหม่ก่อนสรุปว่าเป็นบั๊ก
- ปลั๊กอินที่โยน error ตอนรันถูก **ปิดอัตโนมัติ** — หลังแก้ต้องกด **เปิดใช้** บนการ์ด (โหลดใหม่อย่างเดียวจะเห็นเป็น "ปิดอยู่")
- ใช้ build แบบ watch ([8.3](08-packaging-distribution.md#83-หลายไฟล์--typescript-bundle-เป็นไฟล์เดียว)): ตั้งปลายทางของ build ให้ชี้เข้าโฟลเดอร์ปลั๊กอินของผู้ใช้

## 11.2 เครื่องมือดูปัญหา

### แผงบันทึก (Log) — เริ่มที่นี่

`Ctrl+Alt+9` · **ช่วยเหลือ → สำหรับนักพัฒนา → บันทึกการทำงานของโปรแกรม (Log)…**

| สิ่งที่เห็น | มาจาก |
|---|---|
| `[plugin <ชื่อ>] …` | `k2.log(...)` ของคุณ |
| ข้อผิดพลาดตอนโหลดปลั๊กอิน (พร้อมชื่อปลั๊กอิน) | โค้ดโยน error ตอนรัน · `plugin.json` เสีย |
| `plugin event <ชื่อเหตุการณ์>` | ตัวรับเหตุการณ์ของคุณโยน error |
| `plugin panel <id>` | `render` ของแผงโยน error |
| `plugin unload <ชื่อ>` | ตัวเก็บกวาดโยน error (→ ต้องเริ่มโปรแกรมใหม่) |
| `plugin: unloaded { name, why, restart }` | ปลั๊กอินถูกถอด — ดู `why` · `restart: true` = ตัวนี้ทำให้ต้องเริ่มโปรแกรมใหม่ |
| `plugin panel unregister <id>` | ถอนแผงของปลั๊กอินไม่สำเร็จ |
| ข้อผิดพลาดของ `fs:readFile` ฯลฯ | เรียก `k2.readFile` กับไฟล์ที่ไม่มี |

กรองระดับ "ผิดพลาด"/"เตือน" · คัดลอกบรรทัดที่กรองได้ · ไฟล์ Log รายวันอยู่ที่ `<ข้อมูลผู้ใช้>/logs/`

```js
k2.log('state', JSON.stringify(state));        // object ต้อง stringify เอง
```

### DevTools ของ Chromium — ดีบักจริงจัง

เมนู **ช่วยเหลือ → สำหรับนักพัฒนา → เปิด DevTools ของ Chromium** มีเมื่อโปรแกรมอยู่ในโหมดนักพัฒนา:

| รันแบบไหน | เปิดโหมดนักพัฒนายังไง |
|---|---|
| จากซอร์ส (`npm start`) | มีอยู่แล้ว |
| ตัวที่แจก (portable `.exe` / `.dmg`) | ตั้งตัวแปรสภาพแวดล้อม `KILLIAN_DEV=1` ก่อนเปิดโปรแกรม |

```powershell
# Windows PowerShell
$env:KILLIAN_DEV = '1'; & "D:\Apps\Killian 2.exe"
```

```bash
# macOS / Linux
KILLIAN_DEV=1 /Applications/Killian\ 2.app/Contents/MacOS/Killian\ 2
```

ใน DevTools:

- **Console** — error ที่ไม่ถูกจับ · `console.log` ของคุณ (ใช้ระหว่างพัฒนาได้ เอาออกก่อนปล่อย)
- **Sources** — โค้ดของปลั๊กอินรันผ่าน `new Function` จึงขึ้นเป็นสคริปต์นิรนาม ตั้งชื่อให้ด้วยบรรทัดสุดท้ายของไฟล์:

  ```js
  //# sourceURL=k2-plugin-word-count.js
  ```

  แล้วจะเห็นไฟล์ชื่อนั้นใน Sources วาง breakpoint ได้ และ stack trace ชี้ชื่อนี้
- คำสั่ง `debugger;` ในโค้ด = หยุดตรงนั้นเมื่อ DevTools เปิดอยู่
- **Elements** — ดู element/สไตล์ของแผงคุณ · ตรวจค่าตัวแปรธีม
- **Performance** — ดูว่างานของคุณกินเวลาเฟรมไหม

### คอนโซลนักพัฒนาของโปรแกรม

`Ctrl+Shift+\`` — กล่องรันคำสั่งในตัวโปรแกรม (มีทุกตัวที่แจก ไม่ต้องเปิดโหมดนักพัฒนา) · `Ctrl+Enter` รัน · `Ctrl+↑` คำสั่งก่อนหน้า

> ⚠ ในคอนโซลนี้มีตัวแปรชื่อ **`k2` เหมือนกัน แต่เป็นคนละตัว** กับ `k2` ของปลั๊กอิน — เป็นชุดเครื่องมือตรวจสภาพภายในของโปรแกรมสำหรับไล่บั๊ก (เช่น `k2.md()` · `k2.doc()` · `k2.cssVar('--bg')` · `k2.version`) **ไม่ใช่ API ของปลั๊กอิน ไม่มีสัญญาความเสถียร และมีอยู่เฉพาะในคอนโซล** — ใช้ดูสภาพระหว่างดีบักได้ แต่อย่าเขียนปลั๊กอินให้พึ่ง

ประโยชน์สำหรับผู้เขียนปลั๊กอิน:

```js
k2.cssVar('--accent')                          // ค่าตัวแปรของธีมปัจจุบัน
k2.md().length                                 // ความยาวมาร์กดาวน์ของแท็บที่เปิดอยู่
document.querySelectorAll('[class^="wcs-"]').length    // element ของปลั๊กอินที่ยังอยู่ในหน้า
```

ต้องการเรียก API ของปลั๊กอินตัวเองจากคอนโซลระหว่างพัฒนา: แขวนไว้ชั่วคราว

```js
// ในปลั๊กอิน (เอาออกก่อนปล่อย)
window.__myplug = { k2, state, redraw };
k2.onUnload(() => { delete window.__myplug; });
```

## 11.3 ตรวจว่าเก็บกวาดครบ

ก่อนประกาศ `"hotReload": true` ทำตามนี้ทุกข้อ:

1. เปิดโปรแกรมใหม่ (สภาพสะอาด) → ใช้ทุกฟีเจอร์ของปลั๊กอินให้ครบ (เปิดแผง · รันทุกคำสั่ง · ให้ตัวจับเวลาเริ่ม)
2. แผงปลั๊กอิน → **ปิด** ปลั๊กอิน
3. ตรวจใน DevTools Console:

   ```js
   // (ก) element ของปลั๊กอินต้องไม่เหลือ
   document.querySelectorAll('[class*="wcs-"], [data-plugin="word-count"]').length;        // → 0

   // (ข) สไตล์ที่ฉีดต้องไม่เหลือ
   [...document.querySelectorAll('style')].filter((s) => s.textContent.includes('.wcs-')).length;   // → 0

   // (ค) ตัวฟังบน window/document ต้องกลับไปเท่ากับก่อนเปิดปลั๊กอิน
   //     (getEventListeners เป็นคำสั่งของ DevTools Console)
   Object.fromEntries(Object.entries(getEventListeners(window)).map(([k, v]) => [k, v.length]));

   // (ง) ตัวแปรบน window
   Object.keys(window).filter((k) => /myplug|wcs/i.test(k));                                  // → []
   ```

4. ตัวจับเวลา: ไม่มีทางแจกแจงจากภายนอก — ใส่ `k2.log` ใน callback ระหว่างทดสอบ แล้วดูว่าหลังปิดไม่มีบรรทัดใหม่ขึ้นใน Log อีก
5. กด **เปิดใช้** กลับ → ใช้งานอีกรอบ → ทุกอย่างต้องมี **ชุดเดียว** (คำสั่งไม่ซ้ำ · แผงไม่ซ้อน · เหตุการณ์ถูกเรียกครั้งเดียวต่อครั้ง)
6. แก้ไฟล์หนึ่งตัวอักษร → **โหลดใหม่** → ตรวจข้อ 3 และ 5 อีกครั้ง (ทาง `'reload'`)
7. แผงปลั๊กอินต้อง **ไม่ขึ้น** แถบ "ต้องเริ่มโปรแกรมใหม่" ตลอดขั้นตอนนี้ (ถ้าขึ้นทั้งที่ประกาศ `hotReload` = ตัวเก็บกวาดโยน error — ดู Log)

เทคนิคนับของที่ลืมเก็บ: ระหว่างพัฒนาใช้ตัวช่วย `track()` จาก [4.3](04-hooks-lifecycle.md#แบบแผนที่แนะนำ-ลงคู่กันทุกครั้ง) กับ **ทุก** ของที่สร้างนอก `k2` — ถ้าทุกอย่างผ่าน `listen()` / `every()` / `mount()` ก็ไม่มีอะไรหลุด

## 11.4 โปรไฟล์ทดสอบที่แยกจากของจริง

ทดสอบการติดตั้ง/ถอน/ค่าเริ่มต้น บน **ข้อมูลผู้ใช้ชุดแยก** เพื่อไม่ให้กระทบค่าตั้งและปลั๊กอินที่คุณใช้จริง — ตั้งตัวแปรสภาพแวดล้อม `KILLIAN_USERDATA` ชี้โฟลเดอร์ว่าง:

```powershell
# Windows PowerShell — โปรไฟล์สะอาดที่ C:\k2-test-profile
$env:KILLIAN_USERDATA = 'C:\k2-test-profile'; $env:KILLIAN_DEV = '1'; & "D:\Apps\Killian 2.exe"
```

```bash
# macOS / Linux
KILLIAN_USERDATA=/tmp/k2-test-profile KILLIAN_DEV=1 npm start
```

- โฟลเดอร์นั้นจะได้ `settings.json` · `Plugins/` · `sessions/` · `logs/` ของตัวเอง — ลบทิ้งทั้งโฟลเดอร์เพื่อเริ่มใหม่
- ใช้คู่กับ **ผลงานทดสอบ** (อย่าทดสอบปลั๊กอินที่เขียนไฟล์กับต้นฉบับจริง) — สร้างจากเทมเพลตในโปรแกรม หรือถ้ามีซอร์ส: `node tools/demo-project.cjs <โฟลเดอร์>` ได้ผลงานตัวอย่างที่มีฉาก · Wiki · ความสัมพันธ์ · ทางเลือก
- ทดสอบ "ผู้ใช้ใหม่ติดตั้งจากลิงก์": โปรไฟล์สะอาด → เปิดผลงานทดสอบ → แผงปลั๊กอิน → ติดตั้งจากลิงก์รีโปของคุณ

## 11.5 ทดสอบตรรกะนอกโปรแกรม

แยกโค้ดเป็นสองชั้น:

```
src/
├─ count.js      ← ตรรกะล้วน: รับข้อมูล คืนผล — ไม่แตะ k2 / DOM  → ทดสอบด้วย Node ได้
└─ index.js      ← กาว: เรียก k2 · วาด DOM · ลงทะเบียน            → ทดสอบในโปรแกรม
```

```js
// src/count.js
export function countWords(md) {
  const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
  let n = 0;
  for (const s of seg.segment(String(md || ''))) if (s.isWordLike) n++;
  return n;
}
```

```js
// test/count.test.mjs — node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords } from '../src/count.js';

test('นับคำไทยและอังกฤษ', () => {
  assert.equal(countWords('hello world'), 2);
  assert.ok(countWords('โทระเดินเข้าตลาด') >= 3);
  assert.equal(countWords(''), 0);
});
```

### `k2` จำลอง — ทดสอบชั้นกาวโดยไม่เปิดโปรแกรม

```js
// test/mock-k2.mjs
export function mockK2(files = {}) {
  const calls = { status: [], log: [], commands: [], panels: [], written: {} };
  const handlers = new Map();
  const settings = {};
  const k2 = {
    pluginName: 'test-plugin', appVersion: '2.0.0-alpha.169',
    projectRoot: () => '/project',
    registerCommand: (label, fn) => { calls.commands.push({ label, fn }); return true; },
    addMenuItem: (label, fn) => k2.registerCommand(label, fn),
    registerShortcut: (id) => 'plugin:test-plugin:' + id,
    registerPanel: (id, opts) => { calls.panels.push({ id, opts }); return 'plugin-test-plugin-' + id; },
    showPanel() {}, hidePanel() {},
    getMarkdown: () => files.__active || '', insertText: () => true, getEditorView: () => null,
    on: (ev, fn) => { (handlers.get(ev) || handlers.set(ev, new Set()).get(ev)).add(fn); return () => handlers.get(ev).delete(fn); },
    off: (ev, fn) => handlers.get(ev)?.delete(fn),
    emit: (ev, data) => { let n = 0; for (const fn of handlers.get(ev) || []) { fn(data, ev); n++; } return n; },
    onUnload: () => true,
    readFile: async (rel) => { if (!(rel in files)) throw new Error('ENOENT ' + rel); return files[rel]; },   // เหมือนของจริง: ไฟล์ไม่มี = reject
    writeFile: async (rel, text) => { calls.written[rel] = String(text); files[rel] = String(text); return true; },
    listFiles: async (dir, ext = '') => names(files, dir).files.filter((n) => n.endsWith(ext)),
    listDirs: async (dir) => names(files, dir).dirs,
    getSettings: (k, d) => (k === undefined ? { ...settings } : (k in settings ? settings[k] : d)),
    setSettings: (k, v) => { if (typeof k === 'object') Object.assign(settings, k); else settings[k] = v; return true; },
    setStatus: (t) => calls.status.push(t),
    ask: async () => null, confirmBox: async () => true, alertBox: async () => true, menuPopup() {},
    fetch: async () => ({ ok: false, status: 0, body: '', netError: true, error: 'mock' }),
    log: (...a) => calls.log.push(a.join(' ')),
  };
  return { k2, calls };
}
function names(files, dir) {
  const pre = dir === '.' || !dir ? '' : dir.replace(/\/+$/, '') + '/';
  const f = new Set(), d = new Set();
  for (const p of Object.keys(files)) {
    if (p.startsWith('__') || !p.startsWith(pre)) continue;
    const rest = p.slice(pre.length).split('/');
    (rest.length === 1 ? f : d).add(rest[0]);
  }
  return { files: [...f], dirs: [...d] };
}
```

```js
// ทดสอบว่าปลั๊กอิน (ไฟล์ที่ build แล้ว) ลงทะเบียนของครบ และทำงานกับ k2 ได้
import fs from 'node:fs';
import { mockK2 } from './mock-k2.mjs';

const code = fs.readFileSync('word-count/main.js', 'utf8');
const { k2, calls } = mockK2({ __active: 'hello world' });
new Function('k2', code)(k2);                       // รันแบบเดียวกับที่โปรแกรมรัน
assert.ok(calls.commands.some((c) => c.label.includes('นับคำ')));
```

`k2` จำลองช่วยจับความผิดพลาดของตรรกะและการต่อสาย — **ไม่แทนการทดสอบในโปรแกรมจริง** (ธีม · แผง · วงจรชีวิต · เวลา)

## 11.6 ตารางทดสอบในโปรแกรมจริง

| สถานการณ์ | คาดหวัง |
|---|---|
| เปิดผลงาน (ปลั๊กอินถูกโหลด) | ไม่มีอะไรโผล่เอง · ไม่มี error ใน Log |
| ไม่มีเอกสารเปิด → รันทุกคำสั่ง | ข้อความบอกผู้ใช้ ไม่ใช่ error |
| แท็บเป็นหน้า Wiki → รันทุกคำสั่ง | เช่นกัน (`getMarkdown()` = `''` · `getEditorView()` = `null`) |
| ฉากนิยาย / ฉากบทภาพยนตร์ | ถูกทั้งสองโหมด (บทมีรหัสนำหน้าบรรทัด) |
| ฉากที่ล็อก | ไม่พยายามแก้ |
| ฉากยาวมาก (หลายหมื่นคำ) | ไม่ค้าง |
| ผลงานใหญ่ (หลายร้อยฉาก) | งานทั้งผลงานยังตอบสนอง · ยกเลิกได้ |
| เปลี่ยนไปผลงานอื่น | ข้อมูลของผลงานเก่าไม่ค้างในแผง · ค่าตั้งเป็นของผลงานใหม่ |
| บันทึก · บันทึกทั้งหมด · บันทึกอัตโนมัติ | ตัวรับ `tab:save` ถูกเรียกถูกจำนวนครั้ง ไม่หน่วง |
| สลับแท็บถี่ ๆ | ไม่กระตุก |
| ปิด → เปิดใช้ · โหลดใหม่หลังแก้ไฟล์ | ชุดเดียว ไม่ซ้อน ([11.3](#113-ตรวจว่าเก็บกวาดครบ)) |
| ถอน → ติดตั้งใหม่ | ทำงานเหมือนใหม่ · ค่าเดิมยังอ่านได้ |
| ธีมสว่าง · คอนทราสต์สูง · ขนาด UI 200% | อ่านออก ไม่ล้น |
| แผงผนึกแคบ · ลอย · ฉีกเป็นหน้าต่าง | วาดถูกทุกแบบ (`render` ถูกเรียกซ้ำ) |
| ภาษาอังกฤษ | ข้อความของปลั๊กอินเปลี่ยนตาม (ถ้ารองรับ) |
| ไม่มีเน็ต (ถ้าใช้ `k2.fetch`) | บอกผู้ใช้ ไม่ค้าง |
| แป้นพิมพ์ภาษาไทย | คีย์ลัดยังทำงาน (ใช้ `code` ไม่ใช่ตัวอักษร) |

## 11.7 อาการและสาเหตุที่พบบ่อย

| อาการ | สาเหตุที่น่าจะเป็น |
|---|---|
| การ์ด "มีปัญหา": `Unexpected token` | ไฟล์มี `import`/`export` (ยังไม่ได้ bundle) · ไวยากรณ์ผิด · `plugin.json` มีจุลภาคเกิน/คอมเมนต์ |
| `k2 is not defined` | เรียก `k2` จากโค้ดที่รันนอกฟังก์ชันของปลั๊กอิน (เช่น `<script>` ที่สร้างเอง · Worker) — ส่งค่าที่ต้องใช้เข้าไปเอง |
| `Cannot read properties of null` ตอนเรียก `getEditorView()` | ไม่มีเอกสารเปิด — ตรวจ `null` ก่อน |
| คำสั่ง/แผง/เหตุการณ์ทำงานสองครั้ง | ปลั๊กอินที่ไม่ `hotReload` ถูกโหลดใหม่และของเก่าค้าง · หรือมีสองโฟลเดอร์ (ชื่อต่างกัน) ของปลั๊กอินเดียวกัน |
| คีย์ลัดไม่ทำงาน | ชนกับคีย์ของโปรแกรม · ส่ง `ctrl = false` · ใช้ร่วมกับ Alt · `code` ผิด (ต้องเป็น `'KeyK'` ไม่ใช่ `'k'`) |
| `k2.setStatus` ใน `tab:save` ไม่ขึ้น | ถูกข้อความ "บันทึกแล้ว" ของโปรแกรมทับ — หน่วงด้วย `setTimeout` หรือแสดงในแผง |
| `readFile` โยน error | ไฟล์ไม่มี — ถามด้วย `listFiles` ก่อน |
| `readFile` / `listFiles` คืน `null` / `[]` ทั้งที่ไฟล์มี | ทางมี `..` · เป็นทางเต็ม · ไม่มีผลงานเปิด |
| ค่าที่ `setSettings` หายเมื่อเปิดผลงานอื่น | ค่าตั้งเป็นของผลงาน — ใช้ `localStorage` สำหรับค่าของผู้ใช้ |
| แผงว่างหลังย้าย/พับ | `render` ไม่ได้วาดใหม่จากสภาพ (เก็บสภาพใน DOM) · ใช้ `host` ตัวเก่า |
| สีผิดในบางธีม | สีตายตัว · จับคู่พื้น/ตัวหนังสือผิด (`--accent` ต้องคู่ `--on-accent`) |
| โปรแกรมหน่วงเมื่อเปิดปลั๊กอิน | `MutationObserver`/ตัวจับเวลาถี่ · งานซิงก์ยาวในตัวรับเหตุการณ์ · `getMarkdown()` ทุกเฟรม |
| ผู้ใช้ต้องอนุญาตซ้ำบ่อย | ปลั๊กอินอยู่ในโฟลเดอร์ผลงานและไฟล์เปลี่ยน (ซิงก์ · build ทับ) |
| ติดตั้งจากลิงก์แล้วได้ชื่อโฟลเดอร์แปลก (`repo-dev` · `plugin`) | ชื่อมาจากโฟลเดอร์ห่อของ zip — ดู [8.1](08-packaging-distribution.md#81-สิ่งที่ตัวติดตั้งของโปรแกรมทำ) |

---

ถัดไป: [12. ตำรับ (Cookbook) →](12-cookbook.md)
