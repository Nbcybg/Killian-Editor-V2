# ข้อ 75 — AI Character Consistency (Spec)

ไฟล์: `src/ai/ai-character.js` (ใช้ `characterProfile` ร่วมกับข้อ 74)

---

## 1. หาฉากที่ตัวละครปรากฏ

เรียงลำดับความน่าเชื่อถือ:
1. `options.sceneIds` — ผู้เรียกระบุเอง
2. `options.backlinks[characterId]` — **ดัชนีจากข้อ 86 (`world-story/auto-link.js`)** ← ทางหลัก
3. ค้นชื่อ/นามแฝงในเนื้อฉากตรง ๆ (ช้ากว่า แต่ไม่ต้องมีดัชนี)

## 2. สองชั้น

### 2.1 ออฟไลน์ — `localConsistency(appearances, name)`
ภาษาไทยมีสัญญาณที่ตรวจได้ด้วยกฎล้วน ๆ:
- **คำลงท้าย**: ครับ · ค่ะ · คะ · จ้ะ · จ้า · ฮะ · ขอรับ · เจ้าค่ะ
- **สรรพนามบุรุษที่ 1**: ผม · ฉัน · ดิฉัน · กระผม · หนู · ข้า · กู · เรา · ข้าพเจ้า · อั๊ว

ดึงเฉพาะ**บทพูดของตัวละครนั้น** (บรรทัดใต้ `@ชื่อ` ในบทหนัง + ข้อความใน `"…"` ในร้อยแก้ว)
แล้วหา "ตัวหลัก" ของทั้งเรื่อง → ฉากไหนไม่ใช้ตัวหลักเลย = แจ้งเตือน (`severity: minor`)
ต้องมีอย่างน้อย 2 ฉากที่มีข้อมูลจึงจะสรุป (`minScenes`) — กันเตือนมั่วตอนข้อมูลน้อย

### 2.2 AI — ประเด็นที่กฎตรวจไม่ได้
`ASPECTS` = `speech` · `personality` · `knowledge` (รู้ในสิ่งที่ยังไม่ควรรู้) · `ability` · `appearance` · `relationship`

## 3. Output (ตามข้อกำหนด)

```js
{ sceneId, issue, suggestion,          // ← 3 ตัวตาม spec
  aspect, severity, evidence,
  sceneTitle, aspectLabel, severityLabel, source:'ai'|'local' }
```
เรียงตามความรุนแรง · ตัดข้อที่ `sceneId` ไม่อยู่ในชุดที่ส่งไป · dedupe

## 4. API

```js
checkConsistency(characterId, options)
// options: { client, entity, scenes, sceneIds, backlinks, aspects,
//            includeLocal=true, model, temperature=0.2, maxTokens=1500 }
// → { ok, issues:[…], appearances, usage, cost, prompt, error? }

buildConsistencyPrompt(profile, appearances, opts)   // pure
parseConsistency(text, { sceneIds, titles })          // pure
localConsistency(appearances, name, opts)             // pure — ไม่ใช้ AI
speechStats(appearances, name)                        // pure — สถิติดิบให้ UI ทำกราฟได้
```

**AI ล้มเหลว → ยังคืนผลออฟไลน์เสมอ** (ผู้ใช้ที่ไม่มีคีย์ก็ได้ประโยชน์)

## 5. Unit test
`node test/ai-features.test.cjs` — นับคำลงท้าย/สรรพนามรายฉาก · จับฉากที่หลุด · ฉากสม่ำเสมอไม่ถูกแจ้ง ·
ข้อมูลน้อยไม่เตือนมั่ว · prompt แนบทุก sceneId · ตัดข้อที่ sceneId ผิด · รวมผลออฟไลน์+AI · ไม่มีเอนทิตี้/ฉาก → ไม่ throw
