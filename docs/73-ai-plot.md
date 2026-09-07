# ข้อ 73 — AI Plot Hole Detector (Spec)

ไฟล์: `src/ai/ai-plot.js` · ใช้ `ai-core.js` (client/extractJson/validate/token)

---

## 1. ชนิดปัญหา + ระดับ

```js
HOLE_TYPES = {
  'character-continuity': 'ความต่อเนื่องของตัวละคร',
  'timeline-conflict':    'เวลาขัดกัน',
  'motivation-gap':       'แรงจูงใจขาดหาย',
  'world-rule':           'กฎของโลกขัดกัน',
  'plot-thread':          'ปมที่ทิ้งค้าง',
  'pacing':               'จังหวะการเล่าเรื่อง',
}
SEVERITY = { critical:'ร้ายแรง', major:'สำคัญ', minor:'เล็กน้อย' }
```

## 2. Output (ตามข้อกำหนด)

```js
{
  type, severity, description,                 // ← 3 ตัวตาม spec
  location: { sceneId, title, relatedSceneId },// ← location
  sceneId, relatedSceneId, evidence, suggestion,
  typeLabel, severityLabel,                    // ป้ายภาษาไทยให้ UI ใช้ตรง ๆ
  source: 'ai' | 'local',
}
```
เรียงจาก `critical → minor` แล้วตามด้วย sceneId

## 3. Prompt Engineering (หัวใจของข้อนี้)

สิ่งที่ทำให้ prompt นี้ได้ผลจริง — ทุกข้อมีเทสคุม:

1. **ติดป้าย `[sceneId: sc1]` หน้าทุกฉาก** แล้วบังคับให้อ้าง id กลับมา → map ผลกลับไปยังฉากได้แน่นอน
2. **แนบเมทาดาทาที่ตรวจไม่ได้จากตัวอักษร** (เวลาในเรื่อง · มุมมอง · ตัวละครในฉาก · ชื่อบท)
3. **สั่งชัดว่า "ห้ามเดาสิ่งที่ไม่ได้เขียน" และ "ถ้าไม่พบให้ตอบ `[]`"** — กันโมเดลแต่งปัญหาให้ครบโควตา
4. **บังคับหลักฐาน (`evidence`)** = ยกข้อความจริงจากฉาก → ตรวจสอบย้อนได้ว่าไม่ได้มโน
5. **`temperature: 0.2`** — งานตรวจสอบไม่ต้องการความสร้างสรรค์
6. **สั่งรูปแบบ JSON พร้อมตัวอย่างจริง** แล้วให้ `extractJson` กู้เวลาโมเดลห่อ ```json

## 4. สองชั้น: ออฟไลน์ก่อน แล้วค่อย AI

`localChecks(scenes)` — ไม่ใช้โมเดล ไม่เสียเงิน ผลแม่นแน่นอน:
- **เวลาย้อนกลับ**: ฉากที่ `storyDate` น้อยกว่าฉากก่อนหน้า (ถอดเลขแบบเดียวกับ `timeline.js` — "ปีที่ 1,024" → 1024)
- **มุมมองลอย**: `pov` ไม่อยู่ในรายชื่อตัวละครของฉาก

ผลจากสองชั้นถูกรวมและ dedupe ก่อนคืน (`source` บอกว่ามาจากไหน)

## 5. API

```js
detectPlotHoles(sceneIds, options)
// options: { client, scenes, types, focus, maxTokensPerBatch=6000, includeLocal=true,
//            model, temperature=0.2, maxTokens=1500 }
// → { ok, holes:[…], batches, failedBatches, usage, cost, error? }

buildPlotPrompt(scenes, opts)   // pure → { system, prompt, tokens, sceneIds }
parsePlotHoles(text, opts)      // pure → rows (ตัด sceneId ปลอม, เติม label, เรียง, dedupe)
localChecks(scenes)             // pure → rows (ไม่ใช้ AI)
batchScenes(scenes, maxTokens)  // pure → แบ่งกลุ่มตามงบ token
```

## 6. เรื่องยาวเกิน context

`batchScenes` แบ่งฉากเป็นกลุ่มตามงบ token · **ฉากเดียวที่ยาวเกินงบจะถูกตัดเนื้อ ไม่ใช่ถูกทิ้ง**
แต่ละกลุ่มเรียก 1 ครั้ง → รวมผล + dedupe · **กลุ่มหนึ่งล้มเหลวไม่ทำให้ทั้งชุดล้ม** (`failedBatches`)

> ข้อจำกัดที่ต้องรู้: ปัญหาที่กินข้ามกลุ่ม (ฉาก 1 ขัดกับฉาก 50) อาจไม่ถูกจับถ้าสองฉากอยู่คนละ batch
> ทางแก้: ตั้ง `maxTokensPerBatch` ให้ใหญ่ขึ้นเมื่อใช้โมเดล context ยาว หรือเลือกฉากเองด้วย `sceneIds`

## 7. Unit test
`node test/ai-features.test.cjs` — prompt ครบ / ตัด sceneId ปลอม / ค่าปริยายเมื่อ enum ผิด / เรียงตามความรุนแรง /
ตอบไม่เป็น JSON → [] / batch / AI ล้มยังได้ผลออฟไลน์ / ตรวจเวลาย้อนกลับ + pov ลอย
