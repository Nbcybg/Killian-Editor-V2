# ข้อ 79 — AI Query / Chat with Story (Spec)

ไฟล์: `src/ai/ai-chat.js` (RAG อยู่ใน `ai-core.js`)

---

## 1. แหล่งข้อมูล (context ตามข้อกำหนด)

`collectDocs({ scenes, entities, timeline })` → เอกสารสำหรับทำดัชนี

| ชนิด | id | meta |
|---|---|---|
| ฉาก | `scene:<sceneId>` | `kind:'scene'`, title, sceneId, chapterId, storyDate |
| หน้า Wiki (ตัวละคร/สถานที่/ของ/ตำนาน) | `wiki:<entityId>` | `kind:'wiki'`, title, entityId, category |
| เหตุการณ์ในเส้นเวลา | `event:<id>` | `kind:'timeline'`, title, when, track |

## 2. Vector DB — เลือกอะไร และทำไม

ข้อกำหนดเสนอ Chroma / LanceDB / SQLite-vec — **ทั้งสามตัวเป็น native module** ซึ่งชนกับหลักของโปรเจกต์นี้
(“พกพาได้ ไม่ต้องติดตั้ง” · แอปตอนรันไม่มี `node_modules`) จึงเลือก:

> **`VectorIndex` ใน `ai-core.js`** — เก็บเวกเตอร์ในหน่วยความจำ + แคชลงไฟล์ `<root>/.ai-index.json`
> โปรเจกต์นิยายทั่วไป ~1,000 ก้อน × 256 มิติ → ค้นเชิงเส้นเร็วกว่ามิลลิวินาที ไม่ต้องพึ่ง native

`ChatSession` ใช้ `RagPipeline` เท่านั้น → **สลับไปใช้ vector DB จริงได้ทีหลัง** โดยเปลี่ยน object ที่มี
`add(id,text,vector,meta)` / `search(vector,k)` / `toJSON` / `fromJSON` (ทั้งไฟล์นี้ไม่รู้จักโครงสร้างข้างใน)

**Embedding**: OpenAI `text-embedding-3-small` · Ollama `nomic-embed-text` · **local** (hashing 256 มิติ + tokenizer ไทย)
ไม่มีคีย์/เน็ตล่ม → ตกไป local อัตโนมัติ (คุณภาพต่ำกว่าแต่ยังใช้ได้และไม่ส่งข้อมูลออกเครื่อง)

## 3. Streaming

```js
await chat(query, history, { client, rag, onChunk: (t) => …, stream: true })
```
- ถ้า transport มี `http.stream` → สตรีมจริง (แปลง SSE ด้วย `parseStreamChunk` ของแต่ละเจ้า)
- ถ้าไม่มี → เรียกปกติแล้วส่งข้อความทั้งก้อนผ่าน `onChunk` ครั้งเดียว → **UI เขียนแบบเดียวใช้ได้ทั้งสองทาง**

> ตอนนี้ `kapi.httpFetch` (main.js) คืน body ทีเดียว → ยังเป็นโหมด fallback
> ถ้าจะเปิดสตรีมจริง: เพิ่ม IPC `http:stream` ใน main.js ที่ `res.body` แล้วส่งทีละบรรทัดผ่าน event
> จากนั้น `httpFromKapi(kapi)` จะเห็น `kapi.httpStream` เองโดยไม่ต้องแก้โมดูลนี้

## 4. ประวัติการสนทนา

`trimHistory(history, maxTokens=2000)` — เก็บของใหม่ล่าสุดที่ยังอยู่ในงบ (ตัดจากหัว)
บริบทที่ดึงมาถูกใส่ใน **ข้อความล่าสุดของผู้ใช้** ไม่ใช่ system → ประวัติไม่บวมตามรอบ

## 5. API

```js
chat(query, history, options)
// options: { client, rag, hits, k=6, onChunk, stream, model, temperature=0.4,
//            maxTokens=1000, maxContextTokens=2000, maxHistoryTokens=2000 }
// → { ok, text, sources:[{id,title,kind,sceneId,score}], history, contextTokens, usage, cost, error? }

class ChatSession { build(src) · add(src) · updateScene(scene) · ask(query, opts)
                    save() · load() · reset() · index · size }
collectDocs(src) · trimHistory(history, max) · buildChatMessages(query, history, hits, opts)   // pure
```

- **อ้างอิงที่มาเสมอ** — `sources[]` ให้ UI ทำปุ่มกระโดดไปฉากนั้นได้ (`sceneId`)
- system prompt สั่งว่า **"ถ้าข้อมูลไม่พอให้บอกตรง ๆ ว่าไม่พบในเรื่อง อย่าเดาแทนผู้เขียน"**
- `updateScene(scene)` ลบก้อนเก่าของฉากนั้นแล้วทำดัชนีใหม่เฉพาะฉาก (ผูกกับคิวงานข้อ 88 ได้)

## 6. Unit test
`node test/ai-features.test.cjs` — รวม 3 แหล่งเป็นเอกสาร · trimHistory ตามงบ · ประกอบ messages ·
ค้นแล้วอ้างอิงถูกฉาก · ประวัติสะสม/รีเซ็ต · สตรีมผ่าน onChunk · save/load `.ai-index.json` · updateScene ไม่ทิ้งก้อนเก่า
