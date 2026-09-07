# ข้อ 74 — AI Dialogue Generator (Spec)

ไฟล์: `src/ai/ai-dialogue.js`

---

## 1. อ่านบุคลิกจาก Wiki

`characterProfile(entity)` แปลงหน้า Wiki (ตั้งชื่อฟิลด์อย่างไรก็ได้) เป็นโปรไฟล์มาตรฐาน
รองรับทั้งคีย์ไทยและอังกฤษ (ฟิลด์ Wiki ที่ผู้ใช้สร้างเองมักเป็นไทย):

| ช่อง | คีย์ที่รับ |
|---|---|
| `role` | role · บทบาท · ตำแหน่ง |
| `age` | age · อายุ |
| `personality` | personality · บุคลิก · นิสัย · traits |
| `speech` | speech · speechStyle · การพูด · สำนวน · น้ำเสียง |
| `background` | background · ภูมิหลัง · ประวัติ · bio |
| `goal` | goal · เป้าหมาย · motivation · แรงจูงใจ |
| `fear` | fear · ความกลัว · จุดอ่อน · weakness |
| `quirk` | quirk · ลักษณะเฉพาะ · ติดปาก |

`relationships[]` จากระบบ relationship เดิม (`targetName` + `role`) ถูกแนบไปด้วย

## 2. Prompt

- ใส่โปรไฟล์ทั้งสองฝั่งแยกบล็อก + **สั่งตรง ๆ ว่า "ห้ามให้ทั้งคู่พูดเหมือนกัน"**
- บริบทฉาก: `situation · place · time · goal · conflict · mood · before` (ข้อความก่อนหน้า → เขียนต่อได้กลมกลืน)
- `temperature: 0.85` (งานสร้างสรรค์)
- รูปแบบผลลัพธ์สั่งเป็น **fountain ของ K2 โดยตรง**:
  ```
  @ชื่อตัวละคร
  (อารมณ์)
  บทพูด
  ```

## 3. Output

```js
{ ok, text,                       // ข้อความพร้อมวางลงบทหนัง (fountain) หรือร้อยแก้ว
  lines: [{ speaker, paren, text }],
  speakers: ['โทระ','ยัยแมว'],
  format: 'screenplay'|'prose', prompt, usage, cost }
```

`parseDialogue` รับได้ทั้ง 3 แบบที่โมเดลชอบตอบ แล้วทำให้เป็นรูปแบบเดียว:
1. `@ชื่อ` + บรรทัดถัดไป (ที่สั่งไป)
2. `ชื่อ: บทพูด` (โมเดลชอบตอบแบบนี้)
3. ห่อด้วย ``` fence

แปลงต่อได้ด้วย `toScreenplay(lines)` / `toProse(lines)`

## 4. API

```js
generateDialogue(characterA, characterB, context, options)
// characterA/B = หน้า Wiki ดิบ หรือ profile ก็ได้
// options: { client, format:'screenplay'|'prose', lines=8, tone, model, temperature, maxTokens, stream, onChunk }
// → { ok, text, lines, speakers, format, prompt, usage, cost, error? }

characterProfile(entity) · profileBlock(profile)     // pure
buildDialoguePrompt(a, b, context, opts)             // pure
parseDialogue(raw, { format }) · toScreenplay · toProse   // pure
```

## 5. Unit test
`node test/ai-features.test.cjs` — อ่านฟิลด์ไทย/อังกฤษ · prompt ครบทั้งสองตัวละคร · แยก @ชื่อ/(วงเล็บ)/บทพูด ·
รองรับ "ชื่อ: บทพูด" · ตัด fence · แปลงกลับเป็น fountain · ขาดตัวละคร/ไม่มี client → ไม่ throw
