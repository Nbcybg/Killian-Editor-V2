// word-history.js + streak.js — สถิติคำรายวัน + การนับวันเขียนติดต่อ
import { state, log } from './core.js';
import { parseMdFile, countWords } from './md.js';

// ---- Word History (ข้อ 58) ----
export function getWordHistory() {
  if (!state.meta) return [];
  return state.meta.wordHistory || [];
}

// บันทึกจำนวนคำวันนี้ (เรียกตอน autosave หรือก่อนปิดโปรแกรม)
export async function recordDailyWords(totalWords) {
  if (!state.meta || !state.root) return;
  const today = new Date().toISOString().slice(0, 10);
  const hist = getWordHistory();
  // อัปเดตวันนี้ หรือเพิ่มใหม่
  const idx = hist.findIndex((h) => h.date === today);
  if (idx >= 0) {
    hist[idx].words = totalWords;
  } else {
    hist.push({ date: today, words: totalWords });
    // เก็บแค่ 180 วัน
    if (hist.length > 180) hist.shift();
  }
  state.meta.wordHistory = hist;
  try {
    const { saveProjectMeta } = await import('./app.js');
    await saveProjectMeta();
  } catch {}
}

// คำนวณจำนวนคำรวมจากทุกฉากในโปรเจกต์
//
// [แก้บั๊ก] เดิมบรรทัด `if (stale()) return out;` หลุดมาจาก `rebuildWordCounts` ทั้งที่ตัวนี้
// ไม่เคยประกาศ `stale`/`out` เลย → โยน ReferenceError ตั้งแต่ร่างแรก แล้วถูก `catch` ข้างล่าง
// กลืนเป็น WARN → **คืน 0 เสมอ** ทุกโปรเจกต์ที่มีฉบับร่าง (เห็นในบันทึกจริงทุกครั้งที่เปิดโปรแกรม:
// `WARN countProjectWords failed | ReferenceError: stale is not defined`)
// ผลคือ `recordDailyWords(0)` → ประวัติจำนวนคำรายวัน + วันเขียนติดต่อกัน เป็นศูนย์ตลอด
// คงเจตนาเดิมของยามไว้ (เลิกทำเมื่อผู้ใช้สลับ/ปิดโปรเจกต์กลางลูป — เหมือน rebuildWordCounts)
export async function countProjectWords() {
  const root = state.root;
  if (!root) return 0;
  const stale = () => state.root !== root;
  let total = 0;
  try {
    for (const sec of await kapi.listDirs(root)) {
      if (stale()) return total;
      const secP = await kapi.join(root, sec);
      if (!(await kapi.exists(await kapi.join(secP, 'section.json')))) continue;
      const dr = await kapi.join(secP, 'Draft');
      if (!(await kapi.exists(dr))) continue;
      for (const dn of await kapi.listDirs(dr)) {
        if (stale()) return total;
        const dp = await kapi.join(dr, dn);
        const sf = await kapi.join(dp, 'scenes.json');
        if (!(await kapi.exists(sf))) continue;
        const d = await kapi.readJson(sf);
        for (const cg of Object.keys(d.chapters || {})) {
          for (const sc of (d.chapters[cg] || [])) {
            if (sc.type !== 'memo') total += sc.wordCount || 0;
          }
        }
      }
    }
  } catch (e) { log('warn', 'countProjectWords failed', e); }
  return total;
}

// ═══════════ [alpha.124 ข้อ 23] ★ ซ่อมจำนวนคำใน scenes.json ═══════════
//
// ★ ต้นตอที่ทำให้ **6 หน้าจอโชว์เลขไม่ตรงกัน**: `sc.wordCount` ถูกเขียนครั้งเดียวตอน
//   *สร้างฉาก* ด้วยค่า `0` แล้วไม่มีใครอัปเดตอีกเลยตลอดอายุโปรเจกต์ — `saveTab()`
//   เขียนแต่ไฟล์ .md ไม่เคยแตะ scenes.json
//   → ทุกจอที่อ่านจาก scenes.json (ป้ายในต้นไม้ · ตารางฉาก · เรียงตามจำนวนคำ · หน้าแรก ·
//     แดชบอร์ด · สถิติวันเขียนติดต่อกัน) ได้ 0 ตลอด ขณะที่แถบสถานะซึ่งนับสดจากเอกสารได้เลขจริง
//
// ทางแก้มีสองครึ่ง: (ก) `saveTab` เขียนค่าใหม่ทุกครั้งที่บันทึก (อยู่ใน app.js)
//                  (ข) ตัวนี้ — ไล่เก็บของเก่าที่สะสมค่า 0 ไว้แล้วให้ครบรอบเดียว
//
// **นับด้วย `countWords` ตัวเดียวกับแถบสถานะ** (md.js) — ตัวเลขทุกจอจึงตรงกันจริง ไม่ใช่ใกล้เคียง

/**
 * ไล่คำนวณ `wordCount` ของทุกฉากใหม่จากไฟล์ .md จริง แล้วเขียนกลับ scenes.json
 * @param {{force?: boolean}} opts force = คำนวณใหม่ทั้งหมด (ปกติทำเฉพาะแถวที่ยังเป็น 0/ไม่มีค่า)
 * @returns {Promise<{scanned:number, fixed:number, words:number, done:boolean}>}
 *          `done` = ไล่จนจบจริง (false = เลิกกลางทางเพราะเปลี่ยนโปรเจกต์/อ่านไม่ได้ → อย่าเพิ่งปักธงว่าซ่อมแล้ว)
 */
export async function rebuildWordCounts({ force = false } = {}) {
  const out = { scanned: 0, fixed: 0, words: 0, done: false };
  // ⚠ ตัวนี้ทำงานเบื้องหลังหลังเปิดโปรเจกต์และกินเวลาหลายวินาทีในโปรเจกต์ใหญ่
  // ระหว่างนั้นผู้ใช้ปิด/สลับโปรเจกต์ได้ → `state.root` กลายเป็น null กลางลูป แล้ว
  // `kapi.join(null, …)` โยน (เจอจริงในบันทึกของ e2e: `[null , Recycle]`)
  // จับภาพรากไว้ตั้งแต่ต้น แล้วเลิกทำทันทีที่รู้ว่าโปรเจกต์เปลี่ยน — ห้ามเขียนทับของโปรเจกต์ใหม่
  const root = state.root;
  if (!root) return out;
  const stale = () => state.root !== root;
  try {
    for (const sec of await kapi.listDirs(root)) {
      if (stale()) return out;
      const secP = await kapi.join(root, sec);
      if (!(await kapi.exists(await kapi.join(secP, 'section.json')))) continue;
      const dr = await kapi.join(secP, 'Draft');
      if (!(await kapi.exists(dr))) continue;
      for (const dn of await kapi.listDirs(dr)) {
        const dp = await kapi.join(dr, dn);
        const sf = await kapi.join(dp, 'scenes.json');
        if (!(await kapi.exists(sf))) continue;
        const d = await kapi.readJson(sf);
        const draft = await kapi.readJson(await kapi.join(dp, 'draft.json')).catch(() => ({}));
        const folderOf = {};
        for (const ch of (draft.chapters || [])) folderOf[ch.guid] = ch.folderName;
        let dirty = false;
        for (const cg of Object.keys(d.chapters || {})) {
          for (const sc of (d.chapters[cg] || [])) {
            if (sc.type === 'memo') continue;
            out.scanned++;
            const cur = sc.wordCount || 0;
            if (!force && cur > 0) { out.words += cur; continue; }
            const folder = folderOf[cg];
            if (!folder || !sc.fileName) continue;
            let body = '';
            try {
              const raw = await kapi.readFile(await kapi.join(dp, 'Chapters', folder, sc.fileName));
              body = parseMdFile(raw).body || '';
            } catch { continue; }          // ไฟล์หาย = ข้าม ไม่ใช่เขียนทับด้วย 0
            const n = countWords(body);
            out.words += n;
            if (n !== cur) { sc.wordCount = n; dirty = true; out.fixed++; }
          }
        }
        if (dirty) await kapi.writeFile(sf, JSON.stringify(d, null, 2));
      }
    }
    out.done = true;
  } catch (e) { log('warn', 'rebuildWordCounts failed', e); }
  return out;
}

// ---- Writing Streak (ข้อ 59) ----
export function calcStreak(wordHistory) {
  const hist = wordHistory || getWordHistory();
  if (!hist.length) return 0;
  // เรียงวันที่ใหม่สุดก่อน
  const sorted = [...hist].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  // เช็ค: วันนี้เขียนหรือยัง (มีคำ > 0)
  const todayEntry = sorted.find((h) => h.date === today);
  if (!todayEntry || todayEntry.words <= 0) {
    // วันนี้ยังไม่ได้เขียน → เช็คเมื่อวาน
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const yesterdayEntry = sorted.find((h) => h.date === yesterday);
    if (!yesterdayEntry || yesterdayEntry.words <= 0) return 0;
    // เริ่มนับจากเมื่อวาน
    streak = 1;
    for (let i = sorted.indexOf(yesterdayEntry) + 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date);
      const cur = new Date(sorted[i].date);
      const diff = Math.abs(prev - cur) / 86400000;
      if (diff <= 1.5 && sorted[i].words > 0) streak++;
      else break;
    }
    return streak;
  }
  // วันนี้เขียนแล้ว
  streak = 1;
  for (let i = sorted.indexOf(todayEntry) + 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const cur = new Date(sorted[i].date);
    const diff = Math.abs(prev - cur) / 86400000;
    if (diff <= 1.5 && sorted[i].words > 0) streak++;
    else break;
  }
  return streak;
}
