# ข้อ 67 — Thesaurus / Dictionary (Spec)

ไฟล์: `src/tools/thesaurus.js` (เอนจิน) · UI เดิม `src/thesaurus.js` เปลี่ยนมาเรียกตัวนี้ได้

---

## 1. ลำดับการหา

```
แคช → provider ในเครื่อง (WordNet ถ้ามี) → Datamuse (อังกฤษ, ต้องเปิดเอง) → คลังในตัว
```
ทุกชั้นที่ล้มเหลว **ตกลงชั้นถัดไปเงียบ ๆ ไม่ throw** — ผู้ใช้ได้คำเสมอถ้ามีในคลัง

## 2. ความเป็นส่วนตัว (ค่าเริ่มต้นสำคัญ)

- `online: false` เป็นค่าเริ่มต้น — **การค้นออนไลน์คือการส่งคำที่ผู้ใช้เลือกออกอินเทอร์เน็ต** ต้องเลือกเปิดเอง
- คำภาษาไทย **ไม่ยิงเน็ตเด็ดขาด** (Datamuse ไม่มีข้อมูลไทยอยู่แล้ว) → ใช้คลังในตัวเท่านั้น

## 3. คลังในตัว (offline fallback)

- `TH_SYNONYMS` / `TH_ANTONYMS` — คำที่นักเขียนไทยใช้ซ้ำบ่อย (สวย เดิน พูด มอง กลัว โกรธ เศร้า …)
- `EN_SYNONYMS` / `EN_ANTONYMS` — ชุดเล็กสำหรับตอนออฟไลน์
- **ค้นย้อนกลับ**: ถ้า "งดงาม" อยู่ในรายการคำพ้องของ "สวย" → ค้น "งดงาม" ก็เจอ "สวย" และคำพี่น้องด้วย
- ผู้ใช้เพิ่มเองได้ที่ `<root>/Plugins/thesaurus.json` → `loadExtra(io, root)` → `setExtra()`
  ```json
  { "synonyms": { "กระบี่": ["ดาบ", "พระขรรค์"] }, "antonyms": { "สว่าง": ["มืด"] } }
  ```

## 4. แคช

`ThesaurusCache` — localStorage คีย์ `k2-thes-cache`
- TTL 30 วัน (หมดอายุ → ทิ้งแล้วหาใหม่)
- เก็บสูงสุด 500 คำ · เกินโควตา → ทิ้งของเก่าสุดก่อน (LRU ตามเวลาเขียน)
- เขียนไม่สำเร็จ (โควตา localStorage เต็ม) → ข้ามเงียบ ๆ ไม่ทำให้ค้นพัง
- แยกคีย์ระหว่างคำพ้อง (`syn:`) กับคำตรงข้าม (`ant:`)

> IndexedDB ไม่จำเป็นสำหรับข้อมูลระดับนี้ (500 คำ ≈ ไม่กี่สิบ KB) — ถ้าจะเปลี่ยนภายหลัง
> เปลี่ยนแค่ `storage` adapter ที่ส่งเข้ามา (มี `getItem/setItem/removeItem`)

## 5. API

```js
const t = new Thesaurus({ http, storage, online:false, extra, providers:[], max:15 });
await t.getSynonyms(word)   // → string[]      ← ตามข้อกำหนด
await t.getAntonyms(word)   // → string[]      ← ตามข้อกำหนด
await t.lookup(word, kind)  // → { words, source:'cache'|'local'|'datamuse'|<provider>|'none', word }
t.clearCache()

// ระดับโมดูล (instance เดียวทั้งแอป)
configure(opts) · shared() · getSynonyms(w) · getAntonyms(w)

// pure
isEnglish · isThai · normalizeWord · localLookup(word, kind, extra)
datamuseUrl(word, kind, max) · parseDatamuse(body, word)
loadExtra(io, root)
```

**provider** = ตัวหาเพิ่มที่ทำงานในเครื่อง (เช่น WordNet ที่ผู้ใช้ติดตั้งเอง):
```js
{ name: 'wordnet', lookup: async (word, kind) => ['hound', 'canine'] }
```
provider ที่ throw จะถูกข้าม ไม่ล้มทั้งระบบ

## 6. Unit test
`node test/tools.test.cjs` — คลังไทย/อังกฤษ · ค้นย้อนกลับ · ไม่คืนคำตัวเอง · datamuse url/parse ·
แคช TTL/โควตา/ข้ามรอบ · ค่าเริ่มต้นไม่ยิงเน็ต · ไทยไม่ยิงเน็ต · เน็ตล่ม → คลังในตัว · provider · คลังเสริมจาก Plugins
