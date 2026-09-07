# ข้อ 72 — AI Writing Assistant (Spec)

ไฟล์: `src/ai/ai-core.js` (แกน: provider · ความปลอดภัย · RAG · ต้นทุน) · `src/ai/ai-assistant.js` (API ที่ UI เรียก)

**หลักการ:** โมดูลไม่แตะ DOM/fs/network เอง — ทุกอย่างฉีดเข้ามา (`http`, `io`, `now`)
→ เทสด้วย fake client ได้ครบทุกเส้นทาง ไม่ต้องยิง API จริงและไม่เสียเงินตอนเทส

---

## 1. ผู้ให้บริการ (Provider)

| provider | endpoint | คีย์ | หมายเหตุ |
|---|---|---|---|
| `openai` | `/v1/chat/completions` · `/v1/embeddings` | `Authorization: Bearer` | ค่าเริ่มต้น |
| `claude` | `/v1/messages` | `x-api-key` + `anthropic-version` | ไม่มี embeddings API → ใช้ local |
| `ollama` | `/api/chat` · `/api/embeddings` | ไม่ต้องใช้ | รันเครื่องตัวเอง ฟรี |

```js
buildRequest(provider, { model, system, messages, temperature, maxTokens, stream, apiKey, baseUrl })
  → { url, headers, body }              // body เป็น object (ผู้เรียก stringify เอง)
parseResponse(provider, json)  → { text, usage:{ input, output, total }, raw }
parseStreamChunk(provider, line) → { text?, done? }|null      // SSE ทีละบรรทัด
```
เพิ่ม provider ใหม่ = เพิ่ม entry ใน `PROVIDERS` ตัวเดียว (ทั้ง 3 ฟังก์ชันอยู่ที่เดียวกัน)

## 2. ความปลอดภัย

- **API key อยู่นอก project.khn.json เสมอ** — เก็บที่ `<root>/ai-key.json` (โครงเดิมของ `ai-settings.js`)
  `KeyStore` มี `load/save/clear/mask` · `mask('sk-abc…xyz')` → `sk-…xyz` สำหรับแสดงบนจอ/ลง log
- **ห้าม log คีย์** — `redact(obj)` ลบ `authorization`/`x-api-key`/`apiKey` ออกก่อนส่งเข้าระบบ log
- **Rate limiting** — `RateLimiter` แบบ token bucket: `rpm` (ครั้ง/นาที) + `concurrent` (พร้อมกัน)
  เกิน → รอคิว (ไม่ทิ้งงาน) · `check()` บอกได้ว่าต้องรอกี่ ms
- เรียกผ่าน main process (`kapi.httpFetch`) เสมอ — renderer เป็น `file://` โดน CORS

## 3. ต้นทุน (Cost Tracking)

```js
estimateTokens(text)                    // ไทย ~3 ตัวอักษร/token · อังกฤษ ~4
PRICES[provider][model] = { in, out }   // USD ต่อ 1M tokens (ollama = 0)
estimateCost(provider, model, usage)    // → { usd, in, out }
CostTracker                             // .record() → meta.ai.usage[] (cap 500) · .summary() · .today()
```
`usage` แถวเดียวกับของเดิม: `{ date, tokens, provider, model }` + เพิ่ม `in/out/usd/feature`

## 4. RAG Pipeline

```
scenes + wiki ──chunk──▶ embed ──▶ VectorIndex ──retrieve(query,k)──▶ context ──▶ generate
```

- `chunkText(text, { maxTokens=400, overlap=40 })` — ตัดตามย่อหน้าก่อน แล้วค่อยตามความยาว
- `embed(texts, opts)` — เลือกได้ 3 ทาง
  1. `openai` (`text-embedding-3-small`)
  2. `ollama` (`nomic-embed-text` / `all-minilm`)
  3. **`local`** — ไม่ต้องต่อเน็ต: hashing bag-of-words 256 มิติ + tokenizer ไทยจาก `search-engine.js`
     (คุณภาพต่ำกว่า แต่ทำงานออฟไลน์ 100% และเป็นค่า fallback เมื่อไม่มีคีย์)
- `VectorIndex` — `add(id, text, vector, meta)` · `search(vector, k)` (cosine) · `toJSON/fromJSON`
  เก็บที่ `<root>/.ai-index.json` (ไฟล์แคช สร้างใหม่ได้เสมอ ไม่ใช่ข้อมูลงานเขียน)
- `buildContext(hits, { maxTokens })` — เรียงตามคะแนน ตัดตามงบ token แล้วประกอบเป็นบล็อกอ้างอิงพร้อมที่มา

## 5. `AIClient`

```js
const client = new AIClient({ http, settings, keyStore, tracker, limiter, now });
await client.complete({ prompt, system, messages, temperature, maxTokens, feature })
  → { ok, text, usage, cost, error }        // ไม่ throw — คืน { ok:false, error } เสมอ
await client.stream({ … }, onChunk)         // ใช้ http.stream ถ้ามี · ไม่มี → เรียกปกติแล้วส่งเป็นก้อนเดียว
await client.embed(texts, { model })        // → number[][]
client.ready()                              // มีคีย์แล้วหรือยัง (ollama = true เสมอ)
```
- **retry** อัตโนมัติเมื่อ HTTP 429/5xx (ถอยแบบ exponential, `maxRetries` ค่าเริ่มต้น 2)
- **ไม่ throw** — ทุกความล้มเหลวคืน `{ ok:false, error, status }` (UI แสดงข้อความไทยได้เลย)

## 6. Output ที่เป็นโครงสร้าง (ใช้ร่วมทุกฟีเจอร์ AI)

```js
extractJson(text)     // ดึง JSON ออกจากคำตอบที่มี ```json fence / ข้อความห่อหน้า-หลัง
coerceArray(value)    // อะไรก็ตาม → array (โมเดลชอบคืน object เดี่ยวเวลาเจอผลลัพธ์เดียว)
validate(rows, schema)// คัดแถวที่ field ไม่ครบ/ค่าไม่อยู่ใน enum ทิ้ง + เติมค่าปริยาย
```
โมเดลตอบไม่เป็น JSON เป็นเรื่องปกติ — **ตัวแปลงต้องพยายามกู้ก่อนยอมแพ้** และห้าม throw

## 7. API ของ `ai-assistant.js`

```js
aiAssistant(prompt, context, options)   // ← API หลักตามข้อกำหนด
  context = { text, scene, entities, retrieved, project }
  options = { task, tone, length, language='th', model, temperature, stream, onChunk, client }
  → { ok, text, usage, cost, prompt }   // prompt ติดกลับมาด้วยเพื่อ debug/แสดงให้ผู้ใช้ดู

expand(text, opts)        // ขยายความ (เพิ่มรายละเอียด ไม่เปลี่ยนใจความ)
summarize(text, opts)     // สรุป (opts.length: 'short'|'medium'|'long')
rewrite(text, opts)       // เขียนใหม่ (opts.instruction = สิ่งที่อยากให้เปลี่ยน)
changeTone(text, tone)    // เปลี่ยนโทน — TONES: ทางการ/กันเอง/ตลก/มืดหม่น/โรแมนติก/ระทึก/กระชับ/บรรยายละเอียด
```
ทุกฟังก์ชันสร้าง prompt ผ่าน `buildPrompt(task, …)` ที่ **แยกออกมาเป็น pure function** → เทสได้ว่าคำสั่งครบ

---

## 8. Unit test

`node test/ai-core.test.cjs` — buildRequest ทั้ง 3 provider / parseResponse / SSE / estimateTokens ไทย-อังกฤษ /
cost / rate limit / key mask+redact / chunk / local embed + cosine / VectorIndex / extractJson ที่ตอบมั่ว ๆ /
retry 429 / ไม่ throw เมื่อเน็ตล่ม / prompt ของ expand-summarize-rewrite-changeTone
