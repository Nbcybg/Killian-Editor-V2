# ข้อ 76 — AI Worldbuilding Generator (Spec)

ไฟล์: `src/ai/ai-world.js`

---

## 1. เทมเพลต + schema

`WORLD_TEMPLATES` — แต่ละประเภทมี `fields` (ค่าเดี่ยว) และ `sections` (เนื้อหายาว)

| type | label | หมวด Wiki | fields |
|---|---|---|---|
| `magic` | ระบบเวทมนตร์ | lore | source · cost · limits · whoCanUse · rarity |
| `city` | เมือง | locations | population · geography · government · economy · landmark |
| `culture` | วัฒนธรรม | lore | values · language · taboo · ritual · hierarchy |
| `economy` | เศรษฐกิจ | lore | currency · mainTrade · scarcity · powerHolders · blackMarket |
| `religion` | ศาสนา/ความเชื่อ | lore | deity · doctrine · clergy · symbol · heresy |
| `faction` | กลุ่ม/องค์กร | lore | goal · leader · members · methods · enemy |

ทุกเทมเพลตปิดท้ายด้วยหัวข้อ **"ปมที่เอาไปเขียนต่อได้"** — โลกที่สร้างมาต้องใช้เขียนฉากได้จริง

เพิ่มประเภทใหม่ = เพิ่ม entry เดียวใน `WORLD_TEMPLATES` (prompt/parse/validate ใช้โครงเดียวกันหมด)

## 2. Output (structured data ตามข้อกำหนด)

```js
{
  type, template,                       // 'city' · 'เมือง'
  name: 'ท่าเรือเก่า',
  fields: { population:'สองหมื่น', geography:'…', … },   // คีย์ตามเทมเพลตเป๊ะ
  sections: [{ title:'ภาพรวมและบรรยากาศ', body:'…' }, …],
  tags: ['ท่าเรือ','พ่อค้า'],
  missing: ['ย่านสำคัญ'],               // หัวข้อ/ฟิลด์ที่โมเดลตกไป — UI เตือนให้เติมได้
  ok: true
}
```

**ทนคำตอบเพี้ยน**: โมเดลชอบวางฟิลด์ไว้ระดับบนสุดแทนที่จะอยู่ใน `fields` → parser รับทั้งสองแบบ ·
section ที่ไม่มี `body` ถูกตัดทิ้ง · `ok:false` เมื่อไม่มีทั้งชื่อและหัวข้อ → `generateWorld` ลองใหม่อีก 1 ครั้ง

## 3. ต่อเข้าโปรเจกต์

```js
toWikiEntity(world, { category })   // → { name, entityTypeKey, tags, fields, notes, createdBy:'ai-world' }
toMarkdown(world)                   // → พรีวิว/วางลงฉากได้
```
`notes` = หัวข้อทั้งหมดต่อกันเป็น markdown (`## หัวข้อ`) — โครงเดียวกับหน้า Wiki เดิม
หมวดปลายทางมาจากเทมเพลต (city → `locations`, ที่เหลือ → `lore`) เปลี่ยนได้ด้วย `options.category`

## 4. API

```js
generateWorld(type, prompt, options)
// options: { client, context, existing, tone, model, temperature=0.9, maxTokens=1800, retryOnMissing=true }
// → { ok, world, prompt, usage, cost, raw, error?, types? }

getTemplate(type) · buildWorldPrompt(type, prompt, opts) · parseWorld(type, text)   // pure
```
`options.existing` = เนื้อหาโลกที่มีอยู่แล้ว → prompt สั่ง **"ห้ามขัดกัน"** (กัน AI สร้างของที่ชนกฎเดิม)

## 5. Unit test
`node test/ai-features.test.cjs` — prompt แจงฟิลด์/หัวข้อครบ · existing → ห้ามขัดกัน · ประเภทผิด → null/บอกรายการที่มี ·
parse ฟิลด์ที่วางผิดที่ · ตัด section ว่าง · บอกหัวข้อที่ขาด · ตอบมั่ว → retry 1 ครั้ง → ยังมั่ว → `bad-shape` · แปลงเป็น Wiki entity
