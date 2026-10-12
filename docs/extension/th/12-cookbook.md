# 12. ตำรับ (Cookbook)

**ภาษา:** ไทย · [English](../en/12-cookbook.md)

[← 11. ดีบักและทดสอบ](11-debugging-testing.md) · [ภาพรวม](README.md)

---

โค้ดสั้นที่ตัดไปวางได้ — ทุกตำรับใช้เฉพาะ API ใน [บทที่ 3](03-sdk-reference.md) และตรงกับรุ่น **alpha.169** · ตำรับที่แตะตัวแก้ไข (หมวด ก) กับตำรับไฟล์/ค่าตั้ง (หมวด ค และ ง) ถูกรันกับโปรแกรมจริง — หมวด ก ทั้งในฉากนิยายและฉากบทภาพยนตร์

ตัวช่วยที่ทุกตำรับสมมติว่ามี (วางไว้หัวไฟล์ปลั๊กอิน — ที่มา: [4.3](04-hooks-lifecycle.md#แบบแผนที่แนะนำ-ลงคู่กันทุกครั้ง)):

```js
const NS = 'k2p-' + k2.pluginName;                       // คำนำหน้าคลาส CSS / คีย์ / ชื่อเหตุการณ์
const cleanup = [];
const track = (fn) => { cleanup.push(fn); return fn; };
k2.onUnload(() => { for (const fn of cleanup.splice(0).reverse()) { try { fn(); } catch (e) { k2.log('cleanup', e && e.message); } } });
const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); track(() => target.removeEventListener(type, fn, opts)); };
const every = (ms, fn) => { const id = setInterval(fn, ms); track(() => clearInterval(id)); return id; };
const mount = (el, parent = document.body) => { parent.appendChild(el); track(() => el.remove()); return el; };
```

| หมวด | ตำรับ |
|---|---|
| [ก. ตัวแก้ไข](#ก-ตัวแก้ไข) | ก1 ข้อความที่เลือก · ก2 ครอบช่วงที่เลือก · ก3 แทรกหลายย่อหน้า · ก4 แทนที่ทั้งเอกสาร · ก5 กระโดดไปตำแหน่ง · ก6 รู้ว่าเป็นนิยายหรือบท · ก7 นับตามธาตุของบท · ก8 แทรกวันที่ |
| [ข. แผง](#ข-แผง) | ข1 แผงที่ตามแท็บ · ข2 ฟอร์มค่าตั้งในแผง · ข3 รายการที่กดได้ด้วยคีย์บอร์ด · ข4 สถานะว่าง/กำลังโหลด/ผิดพลาด |
| [ค. ไฟล์และข้อมูล](#ค-ไฟล์และข้อมูล) | ค1 อ่าน JSON อย่างปลอดภัย · ค2 เขียนรายงาน · ค3 ส่งออก CSV · ค4 ข้อมูลของปลั๊กอินเป็นไฟล์ · ค5 งานทั้งผลงานที่ยกเลิกได้ |
| [ง. ค่าตั้ง](#ง-ค่าตั้ง) | ง1 ค่าเริ่มต้น + ย้ายรุ่น · ง2 ค่าระดับผู้ใช้ · ง3 คีย์ API ของผู้ใช้ |
| [จ. เหตุการณ์](#จ-เหตุการณ์) | จ1 เป้าหมายรายวัน · จ2 ทำงานเมื่อเปลี่ยนผลงาน · จ3 คุยกับปลั๊กอินอื่น · จ4 ตรวจการเลือกข้อความ |
| [ฉ. หน้าจอ](#ฉ-หน้าจอ) | ฉ1 ฉีด CSS · ฉ2 เมนูจากปุ่ม · ฉ3 ถามหลายขั้น · ฉ4 ป้ายลอยที่เก็บกวาดได้ · ฉ5 หลายภาษา |
| [ช. เครือข่าย](#ช-เครือข่าย) | ช1 เรียก JSON API · ช2 ลองใหม่แบบถอยรอ · ช3 แคชคำตอบ |

---

## ก. ตัวแก้ไข

### ก1 ข้อความที่เลือกอยู่

```js
/** ข้อความที่เลือก · '' = ไม่ได้เลือก · null = ไม่มีตัวแก้ไข */
function selectedText() {
  const view = k2.getEditorView();
  if (!view) return null;
  const { from, to } = view.state.selection;
  return view.state.doc.textBetween(from, to, '\n');      // '\n' = ตัวคั่นระหว่างบล็อก
}

k2.registerCommand('นับคำที่เลือก', () => {
  const s = selectedText();
  if (s == null) return k2.setStatus('เปิดฉากก่อน');
  if (!s) return k2.setStatus('ยังไม่ได้เลือกข้อความ');
  const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
  let n = 0; for (const w of seg.segment(s)) if (w.isWordLike) n++;
  k2.setStatus('เลือกอยู่ ' + n.toLocaleString() + ' คำ · ' + s.length.toLocaleString() + ' ตัวอักษร');
});
```

`Intl.Segmenter` ตัดคำไทยได้ (ใช้พจนานุกรมของ ICU) — ผลใกล้เคียงแต่ไม่จำเป็นต้องเท่ากับตัวนับคำของโปรแกรม

### ก2 ครอบช่วงที่เลือกด้วยเครื่องหมาย

```js
function wrapSelection(open, close) {
  const view = k2.getEditorView();
  if (!view) return false;
  const { from, to, empty } = view.state.selection;
  if (empty) return false;
  const text = view.state.doc.textBetween(from, to, '\n');
  if (text.includes('\n')) { k2.setStatus('เลือกภายในย่อหน้าเดียว'); return false; }      // ข้ามบล็อก = โครงเอกสารเปลี่ยน
  view.dispatch(view.state.tr.insertText(open + text + close, from, to));               // หนึ่งขั้นของ undo
  view.focus();
  return true;
}
k2.registerCommand('ครอบด้วยอัญประกาศ', () => wrapSelection('“', '”'));
```

- `insertText` แทนช่วงด้วย **ข้อความล้วน** — รูปแบบที่ต่างกันภายในช่วง (หนาบางคำ) จะกลายเป็นรูปแบบเดียวตามจุดเริ่ม
- ต้องการคงรูปแบบ: แทรกสองครั้งใน transaction เดียว **จากท้ายไปหัว** (ตำแหน่งข้างหน้าจะไม่เลื่อน)

  ```js
  view.dispatch(view.state.tr.insertText(close, to).insertText(open, from));
  ```

### ก3 แทรกหลายย่อหน้า (ฉากนิยาย)

`k2.insertText('a\nb')` ไม่สร้างย่อหน้าใหม่ — สร้างโหนดเอง:

```js
/** แทรกย่อหน้าใหม่ต่อจากบล็อกที่เคอร์เซอร์อยู่ · คืน false ถ้าเอกสารไม่ใช่นิยาย */
function insertParagraphs(lines) {
  const view = k2.getEditorView();
  if (!view) return false;
  const { schema, selection } = view.state;
  const para = schema.nodes.paragraph;
  if (!para) return false;                                  // บทภาพยนตร์ไม่มีโหนด paragraph
  const nodes = lines.map((t) => para.create(null, t ? schema.text(t) : null));     // schema.text('') โยน error — ย่อหน้าว่างส่ง null
  const $to = selection.$to;
  const pos = $to.depth >= 1 ? $to.after(1) : $to.pos;      // หลังบล็อกชั้นบนสุดที่เคอร์เซอร์อยู่
  view.dispatch(view.state.tr.insert(pos, nodes).scrollIntoView());
  view.focus();
  return true;
}

k2.registerCommand('แทรกโครงฉาก', () => {
  if (!insertParagraphs(['เป้าหมาย:', 'อุปสรรค:', 'ผลลัพธ์:'])) k2.setStatus('ใช้ได้ในฉากนิยาย');
});
```

เคอร์เซอร์อยู่ในรายการ/คำพูดยกมา → ย่อหน้าใหม่ไปอยู่ **หลังทั้งรายการ** (ชั้นบนสุด) ซึ่งมักเป็นสิ่งที่ผู้ใช้คาด

### ก4 แทนที่ทุกแห่งในเอกสารที่เปิดอยู่ (ขั้น undo เดียว)

```js
/** คืนจำนวนที่แทน · จับเฉพาะคำที่อยู่ในช่วงรูปแบบเดียวกัน (ดูหมายเหตุ) */
function replaceAll(find, repl) {
  const view = k2.getEditorView();
  if (!view || !find) return 0;
  const hits = [];
  view.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (let i = node.text.indexOf(find); i !== -1; i = node.text.indexOf(find, i + find.length)) hits.push(pos + i);
  });
  if (!hits.length) return 0;
  let tr = view.state.tr;
  for (const from of hits.reverse()) tr = tr.insertText(repl, from, from + find.length);    // ท้าย → หัว: ตำแหน่งที่เหลือไม่เลื่อน
  view.dispatch(tr);
  return hits.length;
}

k2.registerCommand('แทนที่ในฉากนี้…', async () => {
  const find = await k2.ask('หาคำว่า');
  if (find == null) return;
  const repl = await k2.ask('แทนด้วย', { allowEmpty: true });
  if (repl == null) return;
  const n = replaceAll(find, repl);
  k2.setStatus(n ? 'แทน ' + n + ' แห่ง — Ctrl+Z ย้อนได้ในครั้งเดียว' : 'ไม่พบ "' + find + '"');
});
```

- เอกสารเก็บข้อความเป็น **ช่วงตามรูปแบบ** — คำที่ครึ่งหนึ่งเป็นตัวหนาอยู่คนละโหนด ตำรับนี้จะไม่เจอ (ตัวค้นหาของโปรแกรม `Ctrl+H` จัดการกรณีนี้ได้ ใช้ตัวนั้นถ้าต้องการครบ)
- `repl = ''` = ลบ
- ทำกับ **เอกสารที่เปิดอยู่เท่านั้น** — อย่าทำแบบเดียวกันกับไฟล์ฉากบนดิสก์ ([6.3](06-data-and-files.md#63-ไฟล์ที่ห้ามเขียนทับ))

### ก5 เลื่อนเคอร์เซอร์ไปตำแหน่งหนึ่ง

```js
function gotoPos(pos) {
  const view = k2.getEditorView();
  if (!view) return false;
  const doc = view.state.doc;
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  const Sel = view.state.selection.constructor;            // คลาส Selection ของ ProseMirror (ไม่มีให้ import)
  view.dispatch(view.state.tr.setSelection(Sel.near($pos)).scrollIntoView());
  view.focus();
  return true;
}

/** ตำแหน่งแรกที่เจอข้อความ · -1 = ไม่เจอ */
function findText(needle) {
  const view = k2.getEditorView();
  let at = -1;
  if (view) view.state.doc.descendants((node, pos) => {
    if (at !== -1) return false;
    if (node.isText) { const i = node.text.indexOf(needle); if (i !== -1) at = pos + i; }
  });
  return at;
}

k2.registerCommand('ไปที่ TODO แรก', () => {
  const at = findText('TODO');
  if (at === -1) k2.setStatus('ไม่มี TODO ในฉากนี้'); else gotoPos(at);
});
```

มุมมองหน้ากระดาษแบบครอบทีละหน้าแสดงสำเนาของเอกสาร — การเลื่อนอาจไม่เห็นผลจนกว่าผู้ใช้กลับมุมมองปกติ

### ก6 เอกสารนี้เป็นนิยายหรือบทภาพยนตร์

```js
/** 'prose' | 'screenplay' | null (ไม่มีตัวแก้ไข) */
function docKind() {
  const view = k2.getEditorView();
  if (!view) return null;
  return view.state.schema.nodes.sp ? 'screenplay' : 'prose';
}
```

รุ่น alpha.169: เอกสารบทภาพยนตร์มีโหนดบล็อกชนิดเดียวคือ `sp` (ธาตุอยู่ที่ `attrs.el`) · นิยายมี `paragraph` `heading` `blockquote` `bullet_list` `ordered_list` `figure` ฯลฯ — **ชื่อเหล่านี้เป็นของภายใน เปลี่ยนได้ทุกรุ่น** ตรวจด้วยการมีอยู่ของโหนด (`schema.nodes.x`) แล้วมีทางถอยเสมอ · ทางที่ไม่พึ่ง schema: ดู `kind` ในเหตุการณ์ `tab:activate` ([4.1](04-hooks-lifecycle.md#tabactivate))

### ก7 นับบรรทัดตามธาตุของบทภาพยนตร์

```js
function screenplayStats() {
  const view = k2.getEditorView();
  if (!view || !view.state.schema.nodes.sp) return null;
  const count = {};
  const speakers = {};
  let last = null;
  view.state.doc.forEach((node) => {
    const el = node.attrs && node.attrs.el;
    if (!el || !node.textContent.trim()) return;             // บรรทัดว่างก็เป็นบล็อก (ธาตุ action) — ไม่นับ
    count[el] = (count[el] || 0) + 1;
    if (el === 'character') last = node.textContent.replace(/\s*\(.*\)\s*$/, '').trim();      // ตัด (V.O.) / (CONT'D)
    else if (el === 'dialogue' && last) speakers[last] = (speakers[last] || 0) + 1;
  });
  return { count, speakers };
}
```

ทางที่ทนการเปลี่ยนรุ่นกว่า: อ่าน `k2.getMarkdown()` แล้วดูรหัสนำหน้าบรรทัด (`### ` = หัวฉาก · `@` = ตัวละคร …) ตาม [ภาคผนวก D ของคู่มือผู้ใช้](../../manual/th/D-file-formats.md) — รูปแบบไฟล์เปลี่ยนยากกว่าชื่อโหนด

### ก8 แทรกวันที่/เวลา พร้อมคีย์ลัด

```js
function stamp() {
  const d = new Date();
  const text = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (!k2.insertText(text)) k2.setStatus('เปิดฉากก่อน');
}
k2.registerCommand('แทรกวันที่และเวลา', stamp);
k2.registerShortcut('stamp', 'F7', true, true, stamp);          // Ctrl+Shift+F7 · มีคำสั่งคู่กันเสมอ
```

---

## ข. แผง

### ข1 แผงที่อัปเดตตามแท็บที่เปิด

```js
let host = null;
let info = { title: '', chars: 0 };

function draw() {
  if (!host) return;
  const box = document.createElement('div');
  box.className = NS + '-box';
  const h = document.createElement('div'); h.className = NS + '-title'; h.textContent = info.title || 'ยังไม่ได้เปิดฉาก';
  const n = document.createElement('div'); n.textContent = info.chars.toLocaleString() + ' ตัวอักษร';
  box.append(h, n);
  host.replaceChildren(box);
}
function refresh(title) {
  info = { title: title == null ? info.title : title, chars: k2.getMarkdown().length };
  draw();
}

k2.registerPanel('info', { title: 'ข้อมูลฉาก', icon: 'chart', render: (h) => { host = h; draw(); } });
k2.registerCommand('เปิดแผงข้อมูลฉาก', () => { refresh(); k2.showPanel('info'); });
k2.on('tab:activate', (e) => setTimeout(() => refresh(e.title), 0));      // ออกจากจังหวะของเหตุการณ์ก่อนทำงาน
k2.on('tab:save', (e) => refresh(e.title));
k2.on('project:close', () => { info = { title: '', chars: 0 }; draw(); });
```

แผงไม่ได้อัปเดตระหว่างพิมพ์ (ไม่มีเหตุการณ์ "พิมพ์") — ถ้าจำเป็น ดู [จ4](#จ4-ตรวจการเลือกข้อความเมื่อไม่มีเหตุการณ์)

### ข2 ฟอร์มค่าตั้งในแผง

```js
const DEFAULTS = { minutes: 25, sound: true, label: '' };
const opts = () => ({ ...DEFAULTS, ...k2.getSettings() });

function field(labelText, input) {
  const row = document.createElement('label'); row.className = NS + '-row';
  const span = document.createElement('span'); span.textContent = labelText;
  row.append(span, input);
  return row;
}
function renderSettings(h) {
  const o = opts();
  const num = Object.assign(document.createElement('input'), { type: 'number', min: 1, max: 180, value: o.minutes });
  num.onchange = () => {
    const v = Math.round(Number(num.value));
    if (!Number.isFinite(v) || v < 1 || v > 180) { num.value = opts().minutes; return; }      // ค่าเสีย = คืนค่าเดิม
    k2.setSettings('minutes', v);
  };
  const chk = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!o.sound });
  chk.onchange = () => k2.setSettings('sound', chk.checked);
  const txt = Object.assign(document.createElement('input'), { type: 'text', value: o.label, placeholder: 'เช่น รอบเช้า' });
  txt.onchange = () => k2.setSettings('label', txt.value.trim());
  const form = document.createElement('div'); form.className = NS + '-form';
  form.append(field('นาทีต่อรอบ', num), field('เล่นเสียงเมื่อครบ', chk), field('ชื่อรอบ', txt));
  h.replaceChildren(form);
}
k2.registerPanel('settings', { title: 'ตั้งค่าจับเวลา', icon: 'cog', render: renderSettings });
```

- ผูกกับ `change` ไม่ใช่ `input` — ไม่เขียนไฟล์ผลงานทุกตัวอักษร
- ตรวจค่าก่อนเก็บเสมอ: ไฟล์ผลงานถูกแก้มือ/มาจากรุ่นอื่นของปลั๊กอินได้
- `<label>` ครอบทั้งป้ายและช่อง = คลิกป้ายแล้วโฟกัสช่อง + โปรแกรมอ่านจออ่านชื่อช่องให้

### ข3 รายการที่กดได้ด้วยคีย์บอร์ด

```js
function renderList(h, items, onPick) {
  const list = document.createElement('div');
  list.className = NS + '-list';
  list.setAttribute('role', 'listbox');
  items.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = NS + '-item';
    row.setAttribute('role', 'option');
    row.tabIndex = i === 0 ? 0 : -1;                       // roving tabindex: Tab เข้ามาที่แถวเดียว
    row.textContent = it.title;                            // textContent เสมอ — ชื่อมาจากไฟล์ของผู้ใช้
    row.onclick = () => onPick(it);
    list.appendChild(row);
  });
  list.onkeydown = (e) => {
    const rows = [...list.children];
    const at = rows.indexOf(document.activeElement);
    if (at < 0) return;
    const go = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[e.key];
    if (go !== undefined) {
      e.preventDefault();
      const to = rows[Math.max(0, Math.min(rows.length - 1, go))];
      rows[at].tabIndex = -1; to.tabIndex = 0; to.focus();
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(items[at]); }
  };
  h.replaceChildren(list);
}
```

### ข4 สถานะว่าง · กำลังโหลด · ผิดพลาด

```js
let host = null;
let view = { state: 'empty', rows: [], error: '' };          // สภาพอยู่ในตัวแปร ไม่ใช่ใน DOM

function message(text, actionLabel, onAction) {
  const box = document.createElement('div'); box.className = NS + '-empty';
  const p = document.createElement('p'); p.textContent = text; box.appendChild(p);
  if (actionLabel) { const b = document.createElement('button'); b.type = 'button'; b.textContent = actionLabel; b.onclick = onAction; box.appendChild(b); }
  return box;
}
function draw() {
  if (!host) return;
  if (view.state === 'empty') host.replaceChildren(message('ยังไม่มีรายงาน', 'สร้างรายงาน', run));
  else if (view.state === 'loading') host.replaceChildren(message('กำลังอ่านฉาก…'));
  else if (view.state === 'error') host.replaceChildren(message('ทำไม่สำเร็จ: ' + view.error, 'ลองใหม่', run));
  else renderRows(host, view.rows);
}
let job = 0;
async function run() {
  const mine = ++job;                                        // กดซ้ำ = งานเก่าถูกทิ้ง
  view = { state: 'loading', rows: [], error: '' }; draw();
  try {
    const rows = await collect();
    if (mine !== job) return;
    view = rows.length ? { state: 'ready', rows, error: '' } : { state: 'empty', rows: [], error: '' };
  } catch (e) {
    if (mine !== job) return;
    view = { state: 'error', rows: [], error: String(e && e.message || e) };
  }
  draw();
}
track(() => { job++; });                                     // ถูกถอดกลางงาน = ผลที่กลับมาถูกทิ้ง
```

---

## ค. ไฟล์และข้อมูล

### ค1 อ่าน JSON โดยไม่ทำให้ Log แดง

```js
async function hasFile(rel) {
  const i = rel.lastIndexOf('/');
  const names = await k2.listFiles(i < 0 ? '.' : rel.slice(0, i));
  return names.includes(i < 0 ? rel : rel.slice(i + 1));
}
/** null = ไม่มีไฟล์ / อ่านไม่ออก / ไม่มีผลงานเปิด */
async function readJson(rel) {
  if (!(await hasFile(rel))) return null;
  let txt;
  try { txt = await k2.readFile(rel); } catch { return null; }      // ไฟล์หายระหว่างทาง
  if (txt == null) return null;
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);             // BOM (ไฟล์ที่แก้ด้วยโปรแกรมอื่น)
  try { return JSON.parse(txt); } catch { return null; }
}
```

> **อ่านไม่ออก ≠ ไม่มี** — ถ้าปลั๊กอินจะ *เขียนกลับ* ไฟล์เดิม ต้องแยกสองกรณีนี้ ([ค4](#ค4-ข้อมูลของปลั๊กอินเป็นไฟล์ของตัวเอง)) ไม่อย่างนั้นไฟล์ที่เสียชั่วคราวจะถูกเขียนทับด้วยของว่าง

### ค2 เขียนรายงานเป็น Markdown

```js
async function writeReport(title, lines) {
  if (!k2.projectRoot()) { k2.setStatus('เปิดผลงานก่อน'); return null; }
  const rel = 'Reports/' + k2.pluginName + '.md';
  const body = ['# ' + title, '', 'สร้างเมื่อ ' + new Date().toLocaleString(), '', ...lines, ''].join('\n');
  const ok = await k2.writeFile(rel, body);
  k2.setStatus(ok ? 'เขียนรายงานที่ ' + rel : 'เขียนรายงานไม่สำเร็จ');
  return ok ? rel : null;
}
```

- ชื่อไฟล์คงที่ = เขียนทับของรอบก่อน (ผู้ใช้ย้อนได้จากแผงประวัติการทำงาน) · อยากเก็บทุกรอบ ต่อวันที่: `new Date().toISOString().slice(0, 10)`
- บอกทางสัมพัทธ์ในข้อความ — ไม่มี API เปิดไฟล์ให้ผู้ใช้ ([3.10](03-sdk-reference.md#310-สิ่งที่-k2-ไม่มี-ในรุ่นนี้))

### ค3 ส่งออก CSV ที่ Excel เปิดแล้วไทยไม่เพี้ยน

```js
function toCsv(rows, columns) {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;                 // กันสูตรฝัง (CSV injection) — ชื่อฉากขึ้นต้นด้วย = ได้
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c.key])).join(','));
  return String.fromCharCode(0xFEFF) + lines.join('\r\n') + '\r\n';      // BOM = Excel บน Windows อ่านเป็น UTF-8
}

async function exportCsv(rows) {
  const csv = toCsv(rows, [
    { key: 'book', label: 'เล่ม' }, { key: 'chapter', label: 'บท' },
    { key: 'title', label: 'ฉาก' }, { key: 'status', label: 'สถานะ' }, { key: 'words', label: 'คำ' },
  ]);
  const ok = await k2.writeFile('Reports/scenes.csv', csv);
  k2.setStatus(ok ? 'ส่งออก ' + rows.length + ' แถวที่ Reports/scenes.csv' : 'ส่งออกไม่สำเร็จ');
}
```

รายการ `rows` ได้จาก `readOutline()` ใน [6.2](06-data-and-files.md#62-อ่านโครงของผลงาน)

### ค4 ข้อมูลของปลั๊กอินเป็นไฟล์ของตัวเอง

เมื่อข้อมูลใหญ่เกินจะอยู่ใน `setSettings` (ประวัติ · ดัชนี · แคช):

```js
const DATA = 'PluginData/' + k2.pluginName + '/log.json';

/** { ok, data } — ok:false = ไฟล์มีแต่อ่านไม่ออก (ห้ามเขียนทับ) */
async function loadData() {
  const names = await k2.listFiles('PluginData/' + k2.pluginName);
  if (!names.includes('log.json')) return { ok: true, data: { v: 1, days: {} } };      // ยังไม่มี = เริ่มใหม่ได้
  try {
    let txt = await k2.readFile(DATA);
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
    const data = JSON.parse(txt);
    if (!data || typeof data !== 'object' || typeof data.days !== 'object') throw new Error('shape');
    return { ok: true, data };
  } catch (e) {
    k2.log('data unreadable', e && e.message);
    return { ok: false, data: null };
  }
}

let saving = Promise.resolve();
/** อ่าน-แก้-เขียน ทีละงาน (สองเหตุการณ์ติดกันไม่เขียนทับกัน) */
function updateData(fn) {
  saving = saving.then(async () => {
    const cur = await loadData();
    if (!cur.ok) { k2.setStatus('ไฟล์ข้อมูลของปลั๊กอินเสีย — ไม่ได้เขียนทับ ดูที่ ' + DATA); return false; }
    if (fn(cur.data) === false) return false;                // fn คืน false = ไม่มีอะไรเปลี่ยน ไม่ต้องเขียน
    return k2.writeFile(DATA, JSON.stringify(cur.data, null, 1));
  }).catch((e) => { k2.log('data write', e && e.message); return false; });
  return saving;
}
```

โฟลเดอร์ `PluginData/<ชื่อปลั๊กอิน>/` เป็นข้อเสนอของคู่มือนี้ ([6.4](06-data-and-files.md#64-ปลั๊กอินควรเขียนไฟล์ที่ไหน)) — โปรแกรมไม่ได้กำหนด

### ค5 งานทั้งผลงานที่ยกเลิกได้และไม่ทำให้โปรแกรมค้าง

```js
let running = null;                                           // { cancelled }

async function scanAll(scenes, onEach) {
  if (running) { running.cancelled = true; }
  const me = running = { cancelled: false };
  const root = k2.projectRoot();
  let done = 0, last = 0;
  for (const sc of scenes) {
    if (me.cancelled || k2.projectRoot() !== root) return { done, cancelled: true };     // ผู้ใช้เปลี่ยนผลงานกลางทาง
    let text = null;
    try { text = await k2.readFile(sc.rel); } catch { /* ไฟล์หาย: ข้าม */ }
    if (text != null) onEach(sc, text);
    done++;
    const now = Date.now();
    if (now - last > 400) { last = now; k2.setStatus('อ่านแล้ว ' + done + '/' + scenes.length); }      // ไม่ถี่กว่า ~2 ครั้ง/วินาที
    if (done % 25 === 0) await new Promise((r) => setTimeout(r, 0));                     // คืนจังหวะให้หน้าจอ
  }
  if (running === me) running = null;
  return { done, cancelled: false };
}
k2.registerCommand('หยุดการสแกน', () => { if (running) { running.cancelled = true; k2.setStatus('หยุดแล้ว'); } });
k2.on('project:close', () => { if (running) running.cancelled = true; });
track(() => { if (running) running.cancelled = true; });
```

อ่านทีละไฟล์ตามลำดับ (ไม่ `Promise.all` ทั้งผลงาน) — ผลงานหลายร้อยฉากอ่านพร้อมกันทำให้ดิสก์และตัวโปรแกรมสะดุด

---

## ง. ค่าตั้ง

### ง1 ค่าเริ่มต้น + ย้ายค่าของรุ่นเก่า

```js
const SETTINGS_V = 2;
const DEFAULTS = { v: SETTINGS_V, minutes: 25, sound: true };

function loadSettings() {
  const raw = k2.getSettings() || {};
  const s = { ...DEFAULTS, ...raw };
  if ((raw.v || 1) < 2 && typeof raw.seconds === 'number') {       // รุ่น 1 เก็บเป็นวินาที
    s.minutes = Math.max(1, Math.round(raw.seconds / 60));
  }
  s.minutes = Number.isFinite(+s.minutes) ? Math.min(180, Math.max(1, Math.round(+s.minutes))) : DEFAULTS.minutes;
  s.sound = !!s.sound;
  s.v = SETTINGS_V;
  return s;
}
let settings = loadSettings();
k2.on('project:open', () => { settings = loadSettings(); });        // ผลงานใหม่ = ค่าตั้งชุดใหม่
```

- อ่านใหม่ทุกครั้งที่ผลงานเปลี่ยน — ค่าตั้งเป็นของผลงาน และปลั๊กอินของผู้ใช้ **ไม่ถูกรันใหม่** เมื่อสลับผลงาน
- อย่าเขียนค่ากลับตอนโหลด (แค่เปิดผลงานแล้วไฟล์ผลงานเปลี่ยน = รบกวนคนใช้ Git/ซิงก์) — เขียนเมื่อผู้ใช้เปลี่ยนค่าเท่านั้น

### ง2 ค่าระดับผู้ใช้ (ตามไปทุกผลงาน)

```js
const PREF_KEY = 'k2-plugin-' + k2.pluginName + ':prefs';
function getPrefs() {
  try { const o = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
  catch { return {}; }                                              // ค่าเสีย / ที่เก็บถูกปิด
}
function setPref(key, value) {
  const p = getPrefs(); p[key] = value;
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
```

ถอนปลั๊กอินแล้วคีย์นี้ยังอยู่ — ถ้าเก็บของใหญ่ ให้มีคำสั่ง "ล้างข้อมูลของปลั๊กอิน" (`localStorage.removeItem(PREF_KEY)`)

### ง3 คีย์ API ที่ผู้ใช้กรอกให้ปลั๊กอิน

```js
const SECRET_KEY = 'k2-plugin-' + k2.pluginName + ':token';
const getToken = () => { try { return localStorage.getItem(SECRET_KEY) || ''; } catch { return ''; } };

k2.registerCommand('ตั้งคีย์ของบริการ…', async () => {
  const cur = getToken();
  const v = await k2.ask(cur ? 'คีย์ใหม่ (เว้นว่าง = ลบคีย์ที่เก็บไว้)' : 'วางคีย์ของบริการ', { allowEmpty: true, placeholder: 'sk-…' });
  if (v == null) return;
  try { if (v) localStorage.setItem(SECRET_KEY, v); else localStorage.removeItem(SECRET_KEY); } catch { return k2.setStatus('เก็บคีย์ไม่ได้'); }
  k2.setStatus(v ? 'เก็บคีย์แล้ว (เฉพาะเครื่องนี้)' : 'ลบคีย์แล้ว');
});
```

- **ห้าม `k2.setSettings` กับความลับ** — ไฟล์ผลงานถูกส่งต่อ สำรอง และเข้า Git
- `localStorage` **ไม่ได้เข้ารหัส** และปลั๊กอินอื่นอ่านได้ ([บทที่ 7](07-security.md)) — เขียนข้อนี้ใน README ของปลั๊กอิน และแนะนำให้ผู้ใช้ออกคีย์ที่จำกัดสิทธิ์/วงเงิน
- กล่อง `k2.ask` แสดงสิ่งที่พิมพ์เป็นตัวอักษรปกติ (ไม่มีช่องแบบรหัสผ่าน) — อย่าแสดงคีย์เดิมเป็นค่าตั้งต้นของช่อง
- อย่า `k2.log` คีย์ หรือ URL ที่มีคีย์อยู่ใน query

---

## จ. เหตุการณ์

### จ1 เป้าหมายจำนวนตัวอักษรรายวัน

```js
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const lastChars = new Map();                                  // ไฟล์ → จำนวนตัวอักษรตอนบันทึกครั้งก่อน (ในรอบโปรแกรมนี้)

k2.on('tab:save', (e) => {
  const prev = lastChars.get(e.file);
  lastChars.set(e.file, e.chars);
  if (prev === undefined) return;                             // ครั้งแรกที่เห็นไฟล์นี้: ยังไม่มีฐานเทียบ
  const delta = e.chars - prev;
  if (delta <= 0) return;                                     // ลบ/ไม่เปลี่ยน ไม่นับ
  const day = today();
  const log = { ...(k2.getSettings('days') || {}) };
  log[day] = (log[day] || 0) + delta;
  for (const k of Object.keys(log).sort().slice(0, -60)) delete log[k];      // เก็บ 60 วันล่าสุด — ค่าตั้งต้องเล็ก
  k2.setSettings('days', log);
  const goal = k2.getSettings('goal', 2000);
  if (log[day] >= goal && log[day] - delta < goal) setTimeout(() => k2.setStatus('ถึงเป้าวันนี้แล้ว: ' + log[day].toLocaleString() + ' ตัวอักษร'), 1500);
});
k2.on('project:close', () => lastChars.clear());
```

- `e.file` เป็นทางเต็มของเครื่อง — ใช้เป็นกุญแจ **ในหน่วยความจำ** ได้ แต่ห้ามเก็บลงไฟล์
- `setTimeout` ก่อน `setStatus`: ข้อความ "บันทึกแล้ว" ของโปรแกรมมาทีหลังตัวรับ จะทับข้อความที่เขียนทันที
- `tab:save` เกิดทุกครั้งที่บันทึกอัตโนมัติด้วย — ตัวรับต้องเบา

### จ2 ทำงานหนึ่งครั้งต่อผลงาน (รวมผลงานที่เปิดอยู่แล้วตอนปลั๊กอินโหลด)

```js
let currentRoot = null;
function onProject() {
  const root = k2.projectRoot();
  if (root === currentRoot) return;
  currentRoot = root;
  if (root) setup(); else teardown();
}
k2.on('project:open', onProject);
k2.on('project:close', () => { currentRoot = null; teardown(); });
onProject();                                                  // ปลั๊กอินถูกโหลด *หลัง* ผลงานเปิดแล้ว — ไม่มีเหตุการณ์ project:open ย้อนหลัง
```

ลืมบรรทัดสุดท้าย = ปลั๊กอินทำงานถูกเฉพาะเมื่อผู้ใช้สลับผลงาน แต่ไม่ทำงานหลังติดตั้ง/โหลดใหม่ (บั๊กที่พบบ่อยที่สุดของตัวรับ `project:open`)

### จ3 ให้ปลั๊กอินอื่นต่อยอดได้

```js
// ปลั๊กอิน focus-timer ประกาศเหตุการณ์ของตัวเอง (เขียนไว้ใน README ว่ามีอะไรบ้าง)
k2.emit('focus-timer:start', { minutes: 25 });
k2.emit('focus-timer:done', { minutes: 25, at: Date.now() });

// ปลั๊กอินอื่น
k2.on('focus-timer:done', (e) => {
  if (!e || typeof e.minutes !== 'number') return;            // ข้อมูลจากปลั๊กอินอื่น = ตรวจรูปก่อนใช้
  addSession(e.minutes);
});
```

- รู้ว่าปลั๊กอินไหนทำงานอยู่ได้จาก `e.loaded` ของเหตุการณ์ `plugins:loaded` (ชื่อโฟลเดอร์ — ผู้ใช้ติดตั้งในชื่ออื่นได้) → ออกแบบให้ทำงานได้เองเสมอเมื่อไม่มีใครส่ง/รับ
- ถาม-ตอบ: ผู้ถาม `emit('x:ping', { reply: 'y:pong' })` · ผู้ตอบ `emit(e.reply, {...})` — `emit` ทำงานซิงก์ ตัวรับตอบได้ในจังหวะเดียวกัน
- เปลี่ยนรูปของ payload = การเปลี่ยนที่ทำลายความเข้ากันได้ → ขึ้นเลขหลักของรุ่นปลั๊กอิน ([8.4](08-packaging-distribution.md#84-เลขรุ่น))

### จ4 ตรวจการเลือกข้อความเมื่อไม่มีเหตุการณ์

```js
let lastSel = '';
every(700, () => {
  if (document.hidden || !host || !host.isConnected) return;      // หน้าต่างถูกซ่อน / แผงไม่ได้เปิด = ไม่ทำงาน
  const view = k2.getEditorView();
  const key = view ? view.state.selection.from + ':' + view.state.selection.to : '';
  if (key === lastSel) return;                                    // ไม่เปลี่ยน = ไม่วาด
  lastSel = key;
  draw();
});
```

- ตรวจ `selection.from/to` (ตัวเลขสองตัว) — **อย่าเรียก `getMarkdown()` ในลูป**
- ทำงานเฉพาะตอนแผงของคุณเปิดอยู่ · ช่วงไม่ถี่กว่า ~500 มิลลิวินาที
- `every()` เก็บกวาดให้เมื่อปลั๊กอินถูกถอด

---

## ฉ. หน้าจอ

### ฉ1 ฉีด CSS ของปลั๊กอิน

```js
const css = `
.${NS}-box   { padding: 12px; color: var(--fg); font-size: calc(13px * var(--ui-scale, 1)); }
.${NS}-title { font-weight: 600; margin-bottom: 6px; }
.${NS}-row   { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.${NS}-row > span { flex: 1; color: var(--dim); }
.${NS}-item  { padding: 6px 10px; border-radius: 6px; cursor: default; }
.${NS}-item:hover, .${NS}-item:focus-visible { background: var(--hover); outline: none; }
.${NS}-empty { padding: 24px 12px; text-align: center; color: var(--dim); }
`;
const style = document.createElement('style');
style.dataset.plugin = k2.pluginName;
style.textContent = css;
mount(style, document.head);                                     // ถูกถอดเมื่อปลั๊กอินถูกถอด
```

ทุกตัวเลือกขึ้นต้นด้วยคลาสของปลั๊กอิน — ห้ามมีกฎที่จับ element ของโปรแกรม ([5.7](05-ui-guidelines.md#57-css-ของปลั๊กอิน)) · ชื่อตัวแปรสีทั้งหมดที่ [5.2](05-ui-guidelines.md#52-ตัวแปรสีของธีม)

### ฉ2 เมนูที่เปิดจากปุ่มในแผง

```js
function menuButton(labelText, buildItems) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = labelText;
  b.setAttribute('aria-haspopup', 'menu');
  b.onclick = () => { const r = b.getBoundingClientRect(); k2.menuPopup(buildItems(), r.left, r.bottom + 4); };
  return b;
}

const sortBtn = menuButton('เรียงตาม', () => [
  { text: 'ลำดับในเรื่อง', checked: sort === 'order', click: () => setSort('order') },
  { text: 'จำนวนคำ', checked: sort === 'words', click: () => setSort('words') },
  '-',
  { text: 'ตัวละคร', sub: () => names.map((n) => ({ text: n, click: () => filterBy(n) })) },     // text = ข้อความล้วน
]);
```

### ฉ3 ถามหลายขั้นโดยยกเลิกได้ทุกขั้น

```js
k2.registerCommand('สร้างรายการตรวจ…', async () => {
  const title = await k2.ask('ชื่อรายการ', { placeholder: 'เช่น ตรวจก่อนส่ง บก.' });
  if (title == null) return;
  const raw = await k2.ask('ข้อละบรรทัด', { multiline: true, placeholder: 'ตรวจชื่อตัวละคร\nตรวจลำดับเวลา' });
  if (raw == null) return;
  const items = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!items.length) return k2.setStatus('ไม่มีข้อให้บันทึก');
  const rel = 'Reports/checklist.md';
  if ((await k2.listFiles('Reports')).includes('checklist.md')
      && !(await k2.confirmBox('มี ' + rel + ' อยู่แล้ว\nเขียนทับ?', 'เขียนทับ'))) return;
  const ok = await k2.writeFile(rel, '# ' + title + '\n\n' + items.map((s) => '- [ ] ' + s).join('\n') + '\n');
  k2.setStatus(ok ? 'บันทึกที่ ' + rel : 'บันทึกไม่สำเร็จ');
});
```

ถามก่อนเขียนทับเสมอ และตั้งป้ายปุ่มยืนยันให้ตรงกับสิ่งที่จะเกิด

### ฉ4 ป้ายลอยที่เก็บกวาดได้

```js
const badge = document.createElement('div');
badge.className = NS + '-badge';
badge.setAttribute('role', 'status');
badge.hidden = true;
mount(badge);

function showBadge(text) { badge.textContent = text; badge.hidden = false; }
function hideBadge() { badge.hidden = true; }
```

```css
/* ต่อท้าย css ของ ฉ1 */
.k2p-NAME-badge {
  position: fixed; right: 16px; bottom: 44px; z-index: 40;      /* เหนือแถบสถานะ · ต่ำกว่ากล่องโต้ตอบ/เมนู */
  padding: 4px 10px; border-radius: 999px;
  background: var(--chip); color: var(--fg); border: 1px solid var(--border);
  pointer-events: none;                                          /* ไม่กินคลิกของผู้ใช้ */
}
@media print { .k2p-NAME-badge { display: none; } }
```

- ของลอยต้อง **ไม่บังพื้นที่เขียน** และไม่รับเมาส์ถ้าไม่จำเป็น — ผู้ใช้ Killian 2 ไม่ชอบของลอยที่โผล่เอง: ให้โผล่เฉพาะตอนผู้ใช้เริ่มอะไรบางอย่าง (เช่น กดเริ่มจับเวลา)
- อย่าวางใน 36px บนสุดของหน้าต่าง (แถบชื่อเป็นเขตลากหน้าต่าง — คลิกไม่ถึง)
- ซ่อนตอนพิมพ์เสมอ

### ฉ5 ข้อความหลายภาษา

```js
const STR = {
  th: { count: 'นับคำฉากนี้', none: 'เปิดฉากก่อน', words: (n) => n.toLocaleString() + ' คำ' },
  en: { count: 'Count words in this scene', none: 'Open a scene first', words: (n) => n.toLocaleString() + (n === 1 ? ' word' : ' words') },
};
const lang = () => (document.documentElement.lang || 'th').slice(0, 2).toLowerCase();
const T = (key, ...a) => {
  const v = (STR[lang()] || STR.en)[key] ?? STR.en[key] ?? key;
  return typeof v === 'function' ? v(...a) : v;
};

k2.registerCommand(T('count'), () => k2.setStatus(k2.getEditorView() ? T('words', countWords(k2.getMarkdown())) : T('none')));
```

- ภาษาของหน้าจออ่านจาก `<html lang>` (โปรแกรมตั้งให้หลังโหลดไฟล์ภาษา)
- ชื่อคำสั่ง/แผงถูกกำหนดตอนลงทะเบียน — ผู้ใช้เปลี่ยนภาษาแล้วโปรแกรมให้เริ่มใหม่ ซึ่งรันปลั๊กอินใหม่ด้วย ป้ายจึงตามทัน
- ภาษาที่ไม่มีในตาราง → อังกฤษ (ไม่ใช่ไทย — ผู้ใช้ที่ไม่ได้เลือกไทยอ่านอังกฤษได้มากกว่า)

---

## ช. เครือข่าย

### ช1 เรียก JSON API

```js
/** { ok:true, data } | { ok:false, message } — ไม่โยน error */
async function getJson(url, init) {
  const r = await k2.fetch(url, init);
  if (r.netError) return { ok: false, message: r.timedOut ? 'หมดเวลา' : 'ต่อเครือข่ายไม่ได้' };
  if (!r.ok) {
    const hint = { 401: 'คีย์ไม่ถูกต้อง', 403: 'ไม่มีสิทธิ์', 404: 'ไม่พบ', 429: 'เรียกถี่เกินไป' }[r.status];
    return { ok: false, message: hint || 'เซิร์ฟเวอร์ตอบ ' + r.status };
  }
  try { return { ok: true, data: JSON.parse(r.body) }; }
  catch { return { ok: false, message: 'คำตอบไม่ใช่ JSON' }; }
}

k2.registerCommand('หาคำพ้อง (อังกฤษ)…', async () => {
  const word = await k2.ask('คำภาษาอังกฤษ');
  if (word == null) return;
  const res = await getJson('https://api.datamuse.com/words?max=8&rel_syn=' + encodeURIComponent(word));
  if (!res.ok) return k2.setStatus('หาไม่สำเร็จ: ' + res.message);
  const list = Array.isArray(res.data) ? res.data.map((x) => String(x.word || '')).filter(Boolean) : [];
  k2.setStatus(list.length ? list.join(' · ') : 'ไม่พบคำพ้องของ "' + word + '"');
});
```

- `encodeURIComponent` กับทุกค่าที่ใส่ใน URL
- ตรวจรูปของคำตอบก่อนใช้ — เซิร์ฟเวอร์เปลี่ยนได้ ล่มได้ และคำตอบเป็นข้อมูลที่ไม่น่าไว้ใจ (ใช้ `textContent` เสมอเมื่อแสดง)
- ตัวอย่างนี้ส่ง **คำที่ผู้ใช้พิมพ์** ออกไปยังบริการภายนอก — ต้องเขียนไว้ใน README ([7.5](07-security.md#75-สิ่งที่ผู้เขียนควรบอกผู้ใช้-ใน-readme))

### ช2 ลองใหม่แบบถอยรอ

```js
async function fetchRetry(url, init, tries = 3) {
  let r;
  for (let n = 0; n < tries; n++) {
    r = await k2.fetch(url, init);
    const retryable = r.netError || r.status === 429 || (r.status >= 500 && r.status < 600);
    if (!retryable) return r;
    if (n < tries - 1) await new Promise((res) => setTimeout(res, Math.min(8000, 500 * 2 ** n)));      // 0.5s · 1s · 2s …
  }
  return r;
}
```

อย่าลองใหม่กับ 4xx อื่น (คำขอผิด ลองกี่ครั้งก็ผิด) · อย่าลองใหม่กับคำขอที่ **ไม่ idempotent** (POST ที่สร้างของ) โดยไม่มีกุญแจกันซ้ำ

### ช3 แคชคำตอบในหน่วยความจำ

```js
const cache = new Map();                                       // url → { at, value }
const TTL = 10 * 60 * 1000;

async function cachedJson(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const res = await getJson(url);
  if (res.ok) {
    cache.set(url, { at: Date.now(), value: res });
    if (cache.size > 200) cache.delete(cache.keys().next().value);      // เพดาน: ทิ้งตัวเก่าสุด
  }
  return res;
}
track(() => cache.clear());
```

แคชเฉพาะคำตอบที่สำเร็จ · มีเพดานเสมอ (โปรแกรมเปิดค้างได้เป็นวัน)

---

## ตำรับที่ทำไม่ได้ในรุ่นนี้

เพื่อไม่ให้เสียเวลาหา — สิ่งเหล่านี้ **ไม่มีทางทำผ่าน `k2`** ใน alpha.169 ([3.10](03-sdk-reference.md#310-สิ่งที่-k2-ไม่มี-ในรุ่นนี้) · [4.7](04-hooks-lifecycle.md#47-สิ่งที่ตะขอทำไม่ได้-ในรุ่นนี้)):

| อยากทำ | เหตุ |
|---|---|
| ไฮไลต์/ขีดเส้นใต้ข้อความในเอกสาร | ต้องใช้ decoration ของ ProseMirror ซึ่งต้องลงปลั๊กอินของ ProseMirror — ไม่มี API · การแปะคลาสบน DOM ของตัวแก้ไขถูกห้ามและหายเอง |
| เปิดฉาก/ไฟล์เป็นแท็บ · เปิดแผงในตัว | ไม่มี API |
| รันงานตอนผู้ใช้พิมพ์ทุกตัวอักษร | ไม่มีเหตุการณ์ (ใช้ [จ4](#จ4-ตรวจการเลือกข้อความเมื่อไม่มีเหตุการณ์) แบบเบา ๆ) |
| ขวางการบันทึก / แก้เนื้อหาก่อนบันทึก | เหตุการณ์เป็นการแจ้งหลังเกิดเท่านั้น |
| เพิ่มรูปแบบส่งออกในศูนย์รวมการส่งออก | ไม่มี API — เขียนไฟล์เอง หรือใช้ขั้น JavaScript ของเวิร์กโฟลว์ ([4.5](04-hooks-lifecycle.md#45-ตะขออื่นนอกปลั๊กอิน)) |
| อ่าน/เขียนรูป หรือไฟล์ไบนารี | API ไฟล์และ `fetch` เป็นข้อความเท่านั้น |

ต้องการ API เพิ่ม: เสนอผ่าน **ช่วยเหลือ → รายงานบั๊ก…** พร้อมกรณีใช้งานจริง

---

[← 11. ดีบักและทดสอบ](11-debugging-testing.md) · [ภาพรวม](README.md) · [ตัวอย่างปลั๊กอินเต็ม](../examples/README.th.md)
