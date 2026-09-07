# -*- coding: utf-8 -*-
# [alpha.132r3 ข้อ 3] จุดนำ/หมายเลขข้อเป็น "ตัวอักษร" ที่ปรับรูปแบบ/สีได้
import io

# ═══════════ style.css ═══════════
p = 'renderer/style.css'
s = io.open(p, encoding='utf-8').read()

OLD = """/* ══ [alpha.132 ข้อ 8] ★ จุดนำต้อง "ขนาดเท่าเดิม" ตอนย้ายไปกึ่งกลาง/ชิดขวา ══"""
i = s.index(OLD)
j = s.index('.ProseMirror li + li > p {', i)
NEW = """/* ══ [alpha.132r3 ข้อ 3] ★★ จุดนำ/หมายเลขข้อ = **ตัวอักษร** ที่ปรับรูปแบบได้ ══

   ผู้ใช้: *"bullet และ ตัวเลข ต้องเป็นตัวอักษรด้วย ดังนั้นต้องปรับรูปแบบ สี และอื่น ๆ ได้
            ตอนนี้ปรับไม่ได้"*

   alpha.132 ข้อ 8 แก้เรื่อง "ขนาดไม่เท่ากัน" ด้วยการ **วาดวงกลมด้วย CSS** ซึ่งแก้ขนาดได้จริง
   แต่ทำให้จุดนำไม่ใช่ตัวอักษรอีกต่อไป — เปลี่ยนฟอนต์/ตัวหนา/ตัวเอียงไม่ได้เลย
   รอบนี้กลับมาเป็นตัวอักษรทั้งสองทาง แล้วแก้ปัญหาขนาดด้วยวิธีที่ถูกกว่าเดิม:

     **บังคับ `content` ของ `::marker` ให้เป็นอักขระตัวเดียวกับที่เราวาดเอง**

   เดิมฝั่งชิดซ้ายใช้ `list-style:disc` = รูปวงกลมที่เบราว์เซอร์ *วาด* (0.367em) ส่วนฝั่ง
   กึ่งกลาง/ชิดขวาใช้กลีฟ `•` (0.233em) → คนละสิ่งกันจึงคนละขนาด · พอทั้งสองฝั่งเป็น
   **กลีฟตัวเดียวกัน ฟอนต์เดียวกัน ขนาดเดียวกัน** ก็เท่ากันโดยโครงสร้าง ไม่ต้องจูนตัวเลข

   รูปแบบมาจาก **อักษรตัวแรกของข้อ** (กติกาเดียวกับ Word/Google Docs) ส่งมาเป็นตัวแปร CSS
   บน `<li>`: ตัวแก้ไขตั้งด้วยปลั๊กอิน `listMarkerPlugin` · ไฟล์ที่ส่งออกตั้งด้วย `markerVars()`
   — ตั้งบน `<li>` เท่านั้น **ไม่แตะสีของข้อความ** (ไม่งั้นทั้งข้อจะเปลี่ยนสีตามอักษรตัวแรก) */
.ProseMirror ul > li::marker { content: '\\2022\\00a0\\00a0'; }
.ProseMirror ol > li::marker { content: counter(list-item) '.\\00a0\\00a0'; }
.ProseMirror li::marker,
.ProseMirror li > p:first-child::before {
  color: var(--k-mk-color, currentColor);
  font-weight: var(--k-mk-weight, inherit);
  font-style: var(--k-mk-style, inherit);
}
/* จัดกึ่งกลาง/ชิดขวา = ปิด marker ของเบราว์เซอร์ แล้ววาดเองในบรรทัดแรกของข้อ
   (marker ของจริงอยู่นอกคอลัมน์เสมอ จึงไม่เดินทางไปกับข้อความ — ดู alpha.130 ข้อ 2) */
.ProseMirror li:has(> p[data-align="center"]:first-child),
.ProseMirror li:has(> p[data-align="right"]:first-child) { list-style:none; }
.ProseMirror ul > li > p[data-align="center"]:first-child::before,
.ProseMirror ul > li > p[data-align="right"]:first-child::before { content:'\\2022\\00a0\\00a0'; }
.ProseMirror ol > li > p[data-align="center"]:first-child::before,
.ProseMirror ol > li > p[data-align="right"]:first-child::before {
  content:counter(list-item) '.\\00a0\\00a0'; }
"""
s = s[:i] + NEW + s[j:]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('css ok')

# ═══════════ prose-format.js — กฎเดียวกันในไฟล์ที่ส่งออก ═══════════
p = 'src/prose-format.js'
s = io.open(p, encoding='utf-8').read()
o = """  out.push('li:has(> p[data-align="center"]:first-child),' +
           'li:has(> p[data-align="right"]:first-child){list-style:none}');
  out.push('ul > li > p[data-align="center"]:first-child::before,' +
           'ul > li > p[data-align="right"]:first-child::before{content:"";' +
           'display:inline-block;vertical-align:.1em;width:.36em;height:.36em;' +
           'border-radius:50%;background:currentColor;margin-right:.55em}');
  out.push('ol > li > p[data-align="center"]:first-child::before,' +
           'ol > li > p[data-align="right"]:first-child::before' +
           '{content:counter(list-item) ".\\u00a0\\u00a0"}');"""
n = """  // [alpha.132r3 ข้อ 3] จุดนำ/หมายเลขข้อเป็น **ตัวอักษร** ทั้งสองทาง และรับรูปแบบจากตัวแปร
  // ที่ `<li>` ถือไว้ (มาจากอักษรตัวแรกของข้อ) — กฎชุดเดียวกับ style.css ของตัวแก้ไขเป๊ะ
  out.push('ul > li::marker{content:"\\u2022\\u00a0\\u00a0"}');
  out.push('ol > li::marker{content:counter(list-item) ".\\u00a0\\u00a0"}');
  out.push('li::marker,li > p:first-child::before{color:var(--k-mk-color, currentColor);' +
           'font-weight:var(--k-mk-weight, inherit);font-style:var(--k-mk-style, inherit)}');
  out.push('li:has(> p[data-align="center"]:first-child),' +
           'li:has(> p[data-align="right"]:first-child){list-style:none}');
  out.push('ul > li > p[data-align="center"]:first-child::before,' +
           'ul > li > p[data-align="right"]:first-child::before' +
           '{content:"\\u2022\\u00a0\\u00a0"}');
  out.push('ol > li > p[data-align="center"]:first-child::before,' +
           'ol > li > p[data-align="right"]:first-child::before' +
           '{content:counter(list-item) ".\\u00a0\\u00a0"}');"""
assert o in s
s = s.replace(o, n, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('prose-format ok')

# ═══════════ compile.js — <li> พกตัวแปรรูปแบบไปด้วย ═══════════
p = 'src/compile.js'
s = io.open(p, encoding='utf-8').read()
o = """      // ย่อหน้าใน <li> ถือ align เอง (ตรงกับสคีมาของตัวแก้ไข ที่ลูกของ li เป็น <p>)
      out.push(`<li><p${attrOf(al)}>${inline((ul || ol)[1], mono)}</p></li>`); continue;"""
n = """      // ย่อหน้าใน <li> ถือ align เอง (ตรงกับสคีมาของตัวแก้ไข ที่ลูกของ li เป็น <p>)
      // [alpha.132r3 ข้อ 3] `<li>` พก "รูปแบบของจุดนำ" ไปด้วย — มาจากอักษรตัวแรกของข้อ
      // (โหมดขาวดำไม่ต้องพกสี เพราะ CSS บังคับดำทั้งแผ่นอยู่แล้ว)
      const mv = mono ? '' : markerVars((ul || ol)[1]);
      out.push(`<li${mv ? ` style="${mv}"` : ''}><p${attrOf(al)}>`
               + `${inline((ul || ol)[1], mono)}</p></li>`); continue;"""
assert o in s
s = s.replace(o, n, 1)
o2 = "import { stripAlign, stripMentions as mdStripMentions } from './md.js';"
n2 = "import { stripAlign, stripMentions as mdStripMentions, markerVars } from './md.js';"
assert o2 in s
s = s.replace(o2, n2, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('compile ok')
