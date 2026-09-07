# ข้อ 64 — Comments / Annotations (Spec)

ไฟล์: `src/comments/comment-core.js`
(ของเดิม `src/comments.js` เก็บคอมเมนต์ใน `scenes.json` — ตัวใหม่เก็บใน `.md` ตามข้อกำหนด + มีเธรด/สมอ/สถานะปิด)

---

## 1. โครงข้อมูล

```js
{
  id: 'c1a2b3',
  author: 'Top',
  text: 'ประโยคนี้ยาวไป',
  timestamp: '2026-07-28T10:00:00.000Z',
  resolved: false,
  replies: [ …คอมเมนต์ตัวเดียวกัน ซ้อนได้ไม่จำกัดชั้น… ],
  anchor: { start: 0, end: 5, quote: 'โทระ ' } | null
}
```

## 2. เก็บที่ไหน

**บล็อก HTML comment ท้ายไฟล์ .md** — มองไม่เห็นตอน render · แก้นอกโปรแกรมได้ · ไม่ต้องมีไฟล์คู่

```markdown
โทระ เดินเข้าไปในตลาดเก่า

<!-- k2-comments
[ { "id": "c1", "text": "…", "replies": [] } ]
-->
```

- **เนื้อหาเดิมไม่ถูกแตะแม้แต่ตัวเดียว** → v1 (Python) เปิดไฟล์ได้เหมือนเดิม (เห็นเป็นคอมเมนต์ท้ายไฟล์)
- `stripComments(md)` = สิ่งที่โหลดเข้าตัวแก้ไข · `mergeComments(body, comments)` = สิ่งที่เขียนกลับ
- บล็อกเสีย/JSON พัง → คืน `[]` (ห้ามทำให้เปิดไฟล์ไม่ได้)
- merge ซ้ำไม่ทำให้บล็อกซ้อนกัน (regex จับท้ายไฟล์ตัวเดียว)

> ทำไมไม่ใช้ frontmatter: `parseMdFile` ใน `md.js` อ่านค่าเป็นบรรทัดเดียว และค่าที่ขึ้นต้น `[` ถูกแปลงเป็น
> อาร์เรย์ด้วยการ split ด้วย comma → JSON ของคอมเมนต์จะพังทันที

## 3. สมอ (anchor) — คอมเมนต์ต้องตามข้อความให้ทัน

`reanchor(text, anchor)` — **เชื่อ `quote` มากกว่าเลขตำแหน่ง**
1. ข้อความที่ `[start,end)` ยังตรงกับ `quote` → ไม่ขยับ
2. ไม่ตรง → หา `quote` ในไฟล์ แล้วเลือกตำแหน่งที่**ใกล้ของเดิมที่สุด** (กรณีข้อความซ้ำหลายที่)
3. หาไม่เจอเลย → `lost: true` (UI แสดงเป็นคอมเมนต์ลอย ให้ผู้ใช้ตัดสินใจ)

`CommentStore.saveBody()` เรียก `reanchorAll` ให้อัตโนมัติทุกครั้งที่บันทึกฉาก

## 4. API

```js
// pure — คืนรายการใหม่เสมอ
addComment(comments, { text, author, position, now })     // position = number | {start,end,quote}
replyTo(comments, parentId, { text, author })             // → { comments, reply, ok }
resolveComment(comments, id, resolved=true)
editComment · deleteComment · findComment · countComments · openComments
parseComments(md) · stripComments(md) · mergeComments(md, comments) · serializeComments
reanchor(text, anchor) · reanchorAll(text, comments) · quoteAt(text, start, end)
fromScenesJson(scenesJson)          // ย้ายคอมเมนต์เก่าจาก scenes.json

// ผูกกับไฟล์จริง (io = { readFile, writeFile, exists } → ส่ง kapi ได้เลย)
const store = new CommentStore({ io, author: 'Top' });
await store.add(path, position, text)      // ← addComment(sceneId, position, text) ตามข้อกำหนด
await store.reply(path, parentId, text)
await store.resolve(path, id, true)        // ← resolveComment(id)
await store.edit(path, id, text) · store.remove(path, id)
await store.list(path, { openOnly, reanchor })
await store.saveBody(path, newBody)        // บันทึกเนื้อหาโดยไม่ทำคอมเมนต์หาย
```

> หมายเหตุเรื่อง signature: ข้อกำหนดเขียน `addComment(sceneId, position, text)` — ที่นี่ใช้ **path ของไฟล์ .md**
> แทน sceneId เพราะคอมเมนต์เก็บอยู่ในไฟล์นั้นโดยตรง · ผู้เรียกแปลง sceneId → path ด้วย `sceneCtx()` ที่มีอยู่แล้วใน app.js

## 5. Unit test
`node test/tools.test.cjs` — ฟิลด์ครบตาม spec · เธรดซ้อนชั้น · resolve/แก้/ลบ · ฝัง-ถอดจาก .md ·
เนื้อหาเดิมไม่ถูกแตะ · บล็อกเสีย → [] · merge ไม่ซ้อน · reanchor (ขยับ/ซ้ำ/หาย/clamp) ·
CommentStore กับ mock fs · saveBody เก็บคอมเมนต์ + ขยับ anchor · ย้ายของเก่าจาก scenes.json
