# docs/ — Spec ของ Core Infrastructure (Killian 2)

Spec เขียนก่อนโค้ดเสมอ · โมดูลในรอบนี้ทั้งหมดเป็น **pure logic ไม่แตะ DOM/fs** (ต่อ fs ผ่าน `io` adapter)
→ ทดสอบด้วย `node` ได้ตรง ๆ · UI ทำต่อทีหลัง

| ข้อ | เรื่อง | Spec | โค้ด | Unit test |
|---|---|---|---|---|
| 8 | Panel System + Docking | [08-panel-system.md](08-panel-system.md) | `src/panels/panel-layout.js`, `panel-store.js` | `test/panel.test.cjs` |
| 40 | Split View | [40-split-view.md](40-split-view.md) | `src/layout/split-layout.js` | `test/split.test.cjs` |
| 12 | Kanban Board | [12-kanban.md](12-kanban.md) | `src/kanban/kanban-core.js` | `test/kanban.test.cjs` |
| 86 | World-Story Connection | [86-world-story.md](86-world-story.md) | `src/world-story/auto-link.js` | `test/world-story.test.cjs` |
| 88 | Automate Perfunctory Tasks | [88-auto-task.md](88-auto-task.md) | `src/auto-task/event-queue.js` | `test/auto-task.test.cjs` |

## รอบที่ 2 — AI & Advanced Features

| ข้อ | เรื่อง | Spec | โค้ด | Unit test |
|---|---|---|---|---|
| 72 | AI Writing Assistant (แกน AI ทั้งหมด) | [72-ai-core.md](72-ai-core.md) | `src/ai/ai-core.js`, `ai-assistant.js` | `test/ai-core.test.cjs` |
| 73 | AI Plot Hole Detector | [73-ai-plot.md](73-ai-plot.md) | `src/ai/ai-plot.js` | `test/ai-features.test.cjs` |
| 74 | AI Dialogue Generator | [74-ai-dialogue.md](74-ai-dialogue.md) | `src/ai/ai-dialogue.js` | `test/ai-features.test.cjs` |
| 75 | AI Character Consistency | [75-ai-character.md](75-ai-character.md) | `src/ai/ai-character.js` | `test/ai-features.test.cjs` |
| 76 | AI Worldbuilding Generator | [76-ai-world.md](76-ai-world.md) | `src/ai/ai-world.js` | `test/ai-features.test.cjs` |
| 79 | AI Query (Chat with Story) | [79-ai-chat.md](79-ai-chat.md) | `src/ai/ai-chat.js` | `test/ai-features.test.cjs` |
| 67 | Thesaurus / Dictionary | [67-thesaurus.md](67-thesaurus.md) | `src/tools/thesaurus.js` | `test/tools.test.cjs` |
| 63 | Import from Scrivener | [63-import-scrivener.md](63-import-scrivener.md) | `src/import/import-scrivener.js` | `test/tools.test.cjs` |
| 64 | Comments / Annotations | [64-comments.md](64-comments.md) | `src/comments/comment-core.js` | `test/tools.test.cjs` |

```bash
npm run test:unit      # รัน unit test ทั้งหมด
```

## กฎของโมดูล AI

1. **ไม่ยิงเน็ตเองสักบรรทัด** — ทุกโมดูลรับ `client` (`AIClient`) หรือ `http` adapter เข้ามา
   → เทสทั้งหมดใช้ client ปลอม ไม่เสียเงินและไม่ต้องมีคีย์
2. **ไม่ throw** — ทุก API คืน `{ ok:false, error, code }` พร้อมข้อความไทยที่แสดงบนจอได้เลย
3. **prompt กับ parser เป็น pure function เสมอ** (`buildXPrompt` / `parseX`) → เทสได้ว่าคำสั่งครบและทนคำตอบเพี้ยน
4. **API key อยู่ที่ `<root>/ai-key.json` เท่านั้น** ไม่ปนกับ `project.khn.json` ที่แชร์กัน · `redact()` ก่อนลง log
5. **ฟีเจอร์ตรวจสอบมีชั้นออฟไลน์ก่อนเสมอ** (ข้อ 73/75) — ไม่มีคีย์ก็ยังได้ประโยชน์

## `io` adapter (ใช้ร่วมกันทั้ง Kanban / World-Story / Auto-task)

```js
{ join(...parts), readJson(path), readFile(path), writeFile(path, text), exists(path), listFiles(dir) }
```
โปรดักชันส่ง `kapi` เข้าไปได้เลย · เทสส่ง mock in-memory
**`kapi` ไม่มี `writeJson`** → เขียน JSON ด้วย `writeFile(path, JSON.stringify(obj, null, 2))` เสมอ

## ข้อตกลงร่วม

1. ES Module ทุกไฟล์ (test เป็น `.cjs` ที่ esbuild แปลงชั่วคราว — root ไม่ใช่ `type:module`)
2. ฟังก์ชันคืนของใหม่ ไม่กลายพันธุ์อาร์กิวเมนต์ (immutable-ish) เว้นแต่เป็นเมธอดของคลาสตัวจัดการ
3. คอมเมนต์: **API เป็นอังกฤษ · ตรรกะเป็นไทย**
4. localStorage แยกคีย์ต่อระบบ (`k2-panel-layout` / `k2-split-layout` / `k2-kanban-layout`) ไม่ยุ่งกับ `k2-ui-layout` เดิม
5. ข้อมูลถาวรลงไฟล์เดิมของโปรเจกต์: `scenes.json` (สถานะฉาก) · `project.khn.json` (`backlinks`, `taskLog`, `customStatuses`)
