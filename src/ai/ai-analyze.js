// ai-analyze.js — เอนจินของแผง "🧠 AI วิเคราะห์" (alpha.89)
//
// เดิมแผงนี้เป็น **ตัวอย่างหน้าตาเปล่า ๆ** (การ์ด 5 ใบ กดแล้วขึ้นว่า "ยังไม่เปิดใช้งาน")
// รอบนี้เปิดใช้งานจริงทั้ง 11 ชนิด โดยแบ่งเป็นสองชั้นเสมอ:
//   1) ชั้นคำนวณเอง (local) — ฟรี เร็ว ผลเหมือนเดิมทุกครั้ง ไม่ต้องตั้งค่า AI ก็ใช้ได้
//   2) ชั้น AI — เอาตัวเลขจากชั้นแรกไปให้โมเดลอ่าน "ความหมาย" ต่อ (ไม่ให้โมเดลนับเลขเอง)
//
// ไฟล์นี้ **บริสุทธิ์ 100%** — ไม่แตะ DOM / fs / network เลย (unit test: test/ai-analyze.test.cjs)
// การอ่านไฟล์จริง + วาดหน้าจออยู่ที่ src/ai-analyzer-ui.js
import { t as tt, tf as ttf } from '../i18n.js';
import { tokenize } from '../search-engine.js';
import { extractJson, validate, estimateTokens, chunkText, estimateCost, SEVERITY, SEV_RANK } from './ai-core.js';

export { SEVERITY, SEV_RANK };

// ═══════════════ คลังคำภาษาไทย (ข้อมูลภาษา ไม่ใช่ข้อความ UI — ห้ามแปล) ═══════════════
// แปลตามภาษาหน้าจอเมื่อไหร่ = วิเคราะห์ต้นฉบับภาษาไทยไม่ได้ทันที
// (เหตุผลเดียวกับ src/tools/thesaurus.js และสรรพนามใน ai-character.js)
export const TH_STOPWORDS = new Set([
  'ที่', 'และ', 'ของ', 'ใน', 'เป็น', 'ไม่', 'ให้', 'มี', 'ได้', 'ว่า', 'จะ', 'การ', 'ความ', 'กับ',
  'แต่', 'ก็', 'มา', 'ไป', 'อยู่', 'แล้ว', 'นี้', 'นั้น', 'เขา', 'เธอ', 'มัน', 'ฉัน', 'ผม', 'คุณ',
  'เรา', 'ต้อง', 'จาก', 'ยัง', 'ถึง', 'เมื่อ', 'อย่าง', 'หนึ่ง', 'คน', 'ทำ', 'ด้วย', 'เพราะ', 'ซึ่ง',
  'หรือ', 'ถ้า', 'ตัว', 'เพื่อ', 'โดย', 'บน', 'ต่อ', 'พอ', 'ครับ', 'ค่ะ', 'คะ', 'นะ', 'สิ', 'ล่ะ',
  'อีก', 'ทั้ง', 'กัน', 'เอง', 'ไว้', 'มาก', 'น้อย', 'จน', 'จริง', 'เลย', 'ๆ', 'ๆๆ',
]);
export const EN_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'is', 'was', 'were', 'be',
  'been', 'are', 'it', 'its', 'he', 'she', 'they', 'his', 'her', 'him', 'them', 'that', 'this',
  'with', 'for', 'as', 'by', 'from', 'not', 'no', 'so', 'if', 'then', 'had', 'has', 'have',
  'i', 'you', 'we', 'me', 'my', 'your', 'our', 'do', 'did', 'does', 'up', 'out', 'about',
]);
// ร่องรอยของความขัดแย้งในฉาก (ใช้ตรวจแบบไม่ง้อ AI)
export const CONFLICT_WORDS = [
  'ทะเลาะ', 'ขัดแย้ง', 'ปฏิเสธ', 'โกรธ', 'เถียง', 'ต่อสู้', 'สู้', 'แย่ง', 'ขู่', 'ตะโกน', 'ด่า',
  'ฆ่า', 'หนี', 'ไล่', 'บังคับ', 'ห้าม', 'ขัดขวาง', 'ต่อต้าน', 'ทรยศ', 'โกหก', 'หลอก', 'แค้น',
  'เกลียด', 'ท้าทาย', 'ต่อรอง', 'ตัดสินใจ', 'เลือก', 'เสียใจ', 'กลัว', 'สงสัย', 'ระเบิด', 'ยิง',
];
// ร่องรอยของสายสัมพันธ์เชิงรัก (ใช้ให้คะแนนคู่จิ้น)
export const ROMANCE_WORDS = [
  'รัก', 'ชอบ', 'คิดถึง', 'กอด', 'จูบ', 'หัวใจ', 'ใจสั่น', 'แก้มแดง', 'เขิน', 'อาย', 'หวง',
  'ห่วง', 'จับมือ', 'สบตา', 'ยิ้ม', 'อบอุ่น', 'คู่', 'แต่งงาน', 'สารภาพ', 'หึง', 'ทน', 'คิด',
];
// จุดจบประโยคไทย/อังกฤษ (ภาษาไทยไม่มีจุด → ใช้ช่องว่างยาว/ขึ้นบรรทัดเป็นตัวคั่นด้วย)
const SENT_SPLIT = /[.!?]+[\s"'”)\]]*|\n+|\s{2,}/;

// ═══════════════ ขอบเขตการวิเคราะห์ ═══════════════
export const SCOPE_KINDS = ['project', 'book', 'chapter', 'scene'];
export const SCOPE_LABELS = {
  project: tt('ui.aia.scopeProject'),
  book: tt('ui.aia.scopeBook'),
  chapter: tt('ui.aia.scopeChapter'),
  scene: tt('ui.aia.scopeScene'),
};

/**
 * กรองฉากตามขอบเขต — บริสุทธิ์
 * @param {Array} scenes  [{ id, sectionKey, chapterId, ... }]
 * @param {{kind, sectionKey, chapterId, sceneId}} scope
 */
export function filterScope(scenes, scope = {}) {
  const kind = SCOPE_KINDS.includes(scope.kind) ? scope.kind : 'project';
  const all = Array.isArray(scenes) ? scenes : [];
  if (kind === 'book') return scope.sectionKey ? all.filter((s) => s.sectionKey === scope.sectionKey) : all.slice();
  if (kind === 'chapter') return scope.chapterId ? all.filter((s) => s.chapterId === scope.chapterId) : all.slice();
  if (kind === 'scene') return scope.sceneId ? all.filter((s) => s.id === scope.sceneId) : [];
  return all.slice();
}

/** ข้อความบอกขอบเขตที่เลือก เช่น "เล่ม: ภาคหนึ่ง (12 ฉาก)" */
export function describeScope(scope = {}, scenes = []) {
  const kind = SCOPE_KINDS.includes(scope.kind) ? scope.kind : 'project';
  const picked = filterScope(scenes, scope);
  let name = '';
  if (kind === 'book') name = (picked[0] && picked[0].sectionTitle) || scope.sectionKey || '';
  else if (kind === 'chapter') name = (picked[0] && picked[0].chapterTitle) || scope.chapterId || '';
  else if (kind === 'scene') name = (picked[0] && picked[0].title) || scope.sceneId || '';
  return { kind, name, count: picked.length,
           text: SCOPE_LABELS[kind] + (name ? ': ' + name : '') + ttf('ui.aia.nScene', picked.length) };
}

// ═══════════════ เครื่องมือนับข้อความ ═══════════════
/** ถอดมาร์กดาวน์/คอมเมนต์ออกให้เหลือข้อความที่ผู้อ่านเห็นจริง */
export function plainText(md) {
  return String(md || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')          // คอมเมนต์ align/meta ของ md.js
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // รูป
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // ลิงก์ → เหลือข้อความ
    .replace(/^#{1,6}\s+/gm, '')               // หัวข้อ
    .replace(/[*_`~>]/g, '')
    .replace(/\r/g, '')
    .trim();
}

/** คำจริง (ตัดคำไทยด้วยตัวเดียวกับระบบค้นหา) */
export function wordsOf(text) {
  return tokenize(plainText(text)).map((x) => x.word);
}
export function countWords(text) { return wordsOf(text).length; }

export function isStopword(w) {
  return TH_STOPWORDS.has(w) || EN_STOPWORDS.has(String(w).toLowerCase())
    || w.length < 2 || /^\d+$/.test(w);
}

/** สัดส่วนบทสนทนา 0–1 (อักขระในเครื่องหมายคำพูด ÷ อักขระทั้งหมด) */
export function dialogueRatio(text) {
  const s = plainText(text);
  if (!s) return 0;
  let inside = 0;
  for (const m of s.matchAll(/[“"„«](.*?)[”"»]/gs)) inside += m[1].length;
  for (const m of s.matchAll(/^\s*[—–-]\s*(.+)$/gm)) inside += m[1].length;   // บทพูดแบบขีดนำ
  return Math.min(1, inside / s.length);
}

export function splitSentences(text) {
  return plainText(text).split(SENT_SPLIT).map((x) => x.trim()).filter(Boolean);
}

export function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
export function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct = (v, total) => (total ? +(100 * v / total).toFixed(1) : 0);

/** ชื่อ+ฉายาของตัวละครทุกตัว → ตารางค้นหา */
function nameForms(c) {
  return [c.name, ...(c.aliases || [])].filter((x) => x && String(x).trim()).map(String);
}
/** นับจำนวนครั้งที่ชื่อ (หรือฉายา) โผล่ในข้อความ */
export function countMentions(text, character) {
  const s = plainText(text);
  let n = 0;
  for (const form of nameForms(character)) {
    if (!form) continue;
    let i = 0;
    while ((i = s.indexOf(form, i)) !== -1) { n++; i += form.length; }
  }
  return n;
}

// ═══════════════ 1) จังหวะเรื่อง ═══════════════
/**
 * ให้คะแนนจังหวะรายฉาก 0–100 (สูง = เร็ว/กระชับ)
 * สูตร: บทสนทนามาก + ประโยคสั้น + ฉากไม่ยืดยาว = เร็ว
 */
export function analyzePacing(scenes = []) {
  const rows = scenes.map((s) => {
    const text = plainText(s.text);
    const w = countWords(text);
    const dr = dialogueRatio(text);
    const sents = splitSentences(text);
    const avgSent = sents.length ? w / sents.length : 0;
    const tempo = Math.round(100 * (
      0.45 * dr
      + 0.35 * (1 - clamp((avgSent - 6) / 30, 0, 1))
      + 0.20 * (1 - clamp((w - 300) / 1500, 0, 1))
    ));
    return { id: s.id, title: s.title, chapterTitle: s.chapterTitle || '', words: w,
             dialogue: +(dr * 100).toFixed(1), avgSentence: +avgSent.toFixed(1),
             tempo: clamp(tempo, 0, 100) };
  });
  const temps = rows.map((r) => r.tempo);
  const avg = +mean(temps).toFixed(1), sd = +stdev(temps).toFixed(1);
  const slowRuns = findRuns(rows, (r) => r.tempo < avg - sd * 0.5);
  const fastRuns = findRuns(rows, (r) => r.tempo > avg + sd * 0.5);
  return {
    rows, avg, sd, slowRuns, fastRuns,
    stats: [
      { label: tt('ui.aia.stTempoAvg'), value: avg },
      { label: tt('ui.aia.stDialogueAvg'), value: +mean(rows.map((r) => r.dialogue)).toFixed(1) + '%' },
      { label: tt('ui.aia.stSlowRun'), value: slowRuns.length },
      { label: tt('ui.aia.stFastRun'), value: fastRuns.length },
    ],
  };
}
/** ช่วงที่ติดกันตั้งแต่ 2 ฉากขึ้นไปและเข้าเงื่อนไข (ใช้หา "ช่วงอืด"/"ช่วงรัว") */
export function findRuns(rows, testFn, minLen = 2) {
  const out = [];
  let cur = [];
  for (const r of rows) {
    if (testFn(r)) cur.push(r);
    else { if (cur.length >= minLen) out.push(cur); cur = []; }
  }
  if (cur.length >= minLen) out.push(cur);
  return out.map((g) => ({ from: g[0].title || g[0].id, to: g[g.length - 1].title || g[g.length - 1].id,
                           count: g.length, sceneId: g[0].id }));
}

// ═══════════════ 2) เส้นโค้งตัวละคร ═══════════════
export function analyzeArc(scenes = [], characters = []) {
  const chapters = chapterOrder(scenes);
  const chars = characters.map((c) => {
    const perScene = scenes.map((s) => ({ id: s.id, title: s.title, chapterId: s.chapterId,
                                          count: countMentions(s.text, c) }));
    const perChapter = chapters.map((ch) => ({
      chapterId: ch.chapterId, chapterTitle: ch.chapterTitle,
      count: perScene.filter((x) => x.chapterId === ch.chapterId).reduce((a, b) => a + b.count, 0),
    }));
    const seen = perScene.filter((x) => x.count > 0);
    const gaps = gapRuns(perChapter);
    return {
      name: c.name, total: perScene.reduce((a, b) => a + b.count, 0),
      scenes: seen.length, perChapter, perScene,
      first: seen[0] ? seen[0].title : '', last: seen.length ? seen[seen.length - 1].title : '',
      firstSceneId: seen[0] ? seen[0].id : '', gaps,
    };
  }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  return {
    chapters, chars,
    stats: [
      { label: tt('ui.aia.stCharAppear'), value: chars.length },
      { label: tt('ui.aia.stChapter'), value: chapters.length },
      { label: tt('ui.aia.stCharGap'), value: chars.filter((c) => c.gaps.length).length },
    ],
  };
}
/** บทที่หายไปติดกันตั้งแต่ 2 บท (ตัวละคร "หายไปนาน") */
function gapRuns(perChapter) {
  const out = [];
  let start = -1;
  const firstSeen = perChapter.findIndex((c) => c.count > 0);
  const lastSeen = perChapter.map((c) => c.count > 0).lastIndexOf(true);
  if (firstSeen < 0) return out;
  for (let i = firstSeen; i <= lastSeen; i++) {
    if (perChapter[i].count === 0) { if (start < 0) start = i; }
    else { if (start >= 0 && i - start >= 2) out.push({ from: perChapter[start].chapterTitle, to: perChapter[i - 1].chapterTitle, count: i - start }); start = -1; }
  }
  return out;
}
export function chapterOrder(scenes = []) {
  const seen = new Map();
  for (const s of scenes) if (!seen.has(s.chapterId)) seen.set(s.chapterId, { chapterId: s.chapterId, chapterTitle: s.chapterTitle || s.chapterId });
  return [...seen.values()];
}

// ═══════════════ 3) คำที่ใช้บ่อย ═══════════════
export function analyzeWords(scenes = [], opts = {}) {
  const top = opts.top || 40;
  const skipNames = new Set((opts.characters || []).flatMap(nameForms));
  const counts = new Map();
  let total = 0;
  for (const s of scenes) {
    for (const w of wordsOf(s.text)) {
      total++;
      if (isStopword(w) || skipNames.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  const rows = [...counts.entries()]
    .map(([word, count]) => ({ word, count, per10k: total ? +(10000 * count / total).toFixed(1) : 0 }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, top);
  return {
    rows, total, unique: counts.size,
    stats: [
      { label: tt('ui.common.word2'), value: total.toLocaleString() },
      { label: tt('ui.aia.stUniqueWord'), value: counts.size.toLocaleString() },
      { label: tt('ui.aia.stRichWord'), value: total ? +(100 * counts.size / total).toFixed(1) + '%' : '0%' },
    ],
  };
}

// ═══════════════ 4) ความขัดแย้ง ═══════════════
export function analyzeConflict(scenes = []) {
  const rows = scenes.map((s) => {
    const text = plainText(s.text);
    const hits = [];
    for (const w of CONFLICT_WORDS) {
      let n = 0, i = 0;
      while ((i = text.indexOf(w, i)) !== -1) { n++; i += w.length; }
      if (n) hits.push({ word: w, count: n });
    }
    hits.sort((a, b) => b.count - a.count);
    const words = countWords(text);
    const total = hits.reduce((a, b) => a + b.count, 0);
    return { id: s.id, title: s.title, chapterTitle: s.chapterTitle || '', words, hits: hits.slice(0, 6),
             score: total, density: words ? +(1000 * total / words).toFixed(1) : 0 };
  });
  const empty = rows.filter((r) => r.score === 0 && r.words > 40);
  return {
    rows, empty,
    coverage: rows.length ? pct(rows.length - empty.length, rows.length) : 0,
    stats: [
      { label: tt('ui.aia.stSceneHasConflict'), value: rows.length - empty.length + '/' + rows.length },
      { label: tt('ui.aia.stNoConflict'), value: empty.length },
      { label: tt('ui.aia.stConflictDensity'), value: +mean(rows.map((r) => r.density)).toFixed(1) },
    ],
  };
}

// ═══════════════ 5) ความยาวฉาก ═══════════════
export const WORDS_PER_MIN = 220;         // ความเร็วอ่านเฉลี่ย (คำ/นาที)
export function analyzeLength(scenes = []) {
  const rows = scenes.map((s) => {
    const w = countWords(s.text);
    return { id: s.id, title: s.title, chapterTitle: s.chapterTitle || '', words: w,
             minutes: +(w / WORDS_PER_MIN).toFixed(1), pages: +(w / 250).toFixed(1) };
  });
  const ws = rows.map((r) => r.words);
  const avg = +mean(ws).toFixed(0), med = +median(ws).toFixed(0), sd = stdev(ws);
  const long = rows.filter((r) => sd > 0 && r.words > avg + 2 * sd);
  const short = rows.filter((r) => sd > 0 && r.words < avg - 2 * sd);
  const total = ws.reduce((a, b) => a + b, 0);
  return {
    rows, avg, median: med, sd: +sd.toFixed(0), long, short, total,
    stats: [
      { label: tt('ui.aia.stAvgWordScene'), value: avg.toLocaleString() },
      { label: tt('ui.aia.stMedian'), value: med.toLocaleString() },
      { label: tt('ui.aia.stTooLong'), value: long.length },
      { label: tt('ui.aia.stReadTime'), value: Math.round(total / WORDS_PER_MIN) + tt('ui.aia.unitMin') },
    ],
  };
}

// ═══════════════ 8) คำซ้ำในระยะใกล้ ═══════════════
/**
 * คำเดียวกันโผล่ซ้ำภายในระยะ window คำ — ต้นเหตุของ "อ่านแล้วสะดุด"
 * @param {object} opts { window=60, minCount=2, top=60, characters }
 */
export function analyzeRepeats(scenes = [], opts = {}) {
  const win = opts.window || 60, minCount = opts.minCount || 2, top = opts.top || 60;
  const skipNames = new Set((opts.characters || []).flatMap(nameForms));
  const rows = [];
  for (const s of scenes) {
    const ws = wordsOf(s.text);
    const last = new Map();
    const cluster = new Map();
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (isStopword(w) || skipNames.has(w)) continue;
      const prev = last.get(w);
      if (prev != null && i - prev <= win) {
        const c = cluster.get(w) || { word: w, count: 1, closest: Infinity };
        c.count++;
        c.closest = Math.min(c.closest, i - prev);
        cluster.set(w, c);
      }
      last.set(w, i);
    }
    for (const c of cluster.values()) {
      if (c.count >= minCount) rows.push({ ...c, id: s.id, title: s.title, chapterTitle: s.chapterTitle || '' });
    }
  }
  rows.sort((a, b) => b.count - a.count || a.closest - b.closest);
  return {
    rows: rows.slice(0, top), totalFound: rows.length, window: win,
    stats: [
      { label: tt('ui.aia.stRepeatFound'), value: rows.length },
      { label: tt('ui.aia.stSceneAffected'), value: new Set(rows.map((r) => r.id)).size },
      { label: tt('ui.aia.stWindow'), value: win + tt('ui.aia.unitWord') },
    ],
  };
}

// ═══════════════ 9) คู่จิ้น / เส้นความสัมพันธ์ ═══════════════
export function analyzeShipping(scenes = [], characters = []) {
  const present = scenes.map((s) => {
    const text = plainText(s.text);
    const hits = characters.map((c) => ({ c, n: countMentions(text, c) })).filter((x) => x.n > 0);
    let heat = 0;
    for (const w of ROMANCE_WORDS) { let i = 0; while ((i = text.indexOf(w, i)) !== -1) { heat++; i += w.length; } }
    return { scene: s, hits, heat, words: countWords(text) };
  });
  const pairs = new Map();
  for (const p of present) {
    for (let i = 0; i < p.hits.length; i++) for (let j = i + 1; j < p.hits.length; j++) {
      const [a, b] = [p.hits[i].c.name, p.hits[j].c.name].sort((x, y) => x.localeCompare(y));
      const k = a + '|' + b;
      const row = pairs.get(k) || { a, b, scenes: 0, mentions: 0, heat: 0, words: 0, sceneIds: [] };
      row.scenes++;
      row.mentions += p.hits[i].n + p.hits[j].n;
      row.heat += p.heat;
      row.words += p.words;
      row.sceneIds.push(p.scene.id);
      pairs.set(k, row);
    }
  }
  const rows = [...pairs.values()].map((r) => ({
    ...r,
    // คะแนน = ได้อยู่ด้วยกันบ่อย + ถูกพูดถึงเยอะ + ฉากที่อยู่ด้วยกันมีคำเชิงรักหนาแน่น
    score: +(r.scenes * 2 + Math.sqrt(r.mentions) + (r.words ? 300 * r.heat / r.words : 0)).toFixed(1),
  })).sort((x, y) => y.score - x.score);
  return {
    rows: rows.slice(0, 30), totalPairs: rows.length,
    stats: [
      { label: tt('ui.aia.stPairFound'), value: rows.length },
      { label: tt('ui.aia.stTopPair'), value: rows[0] ? rows[0].a + ' × ' + rows[0].b : '—' },
      { label: tt('ui.aia.stRomanceWord'), value: present.reduce((a, b) => a + b.heat, 0) },
    ],
  };
}

// ═══════════════ 11) Screentime / น้ำหนักตัวละคร ═══════════════
export function analyzeScreentime(scenes = [], characters = []) {
  const totalWords = scenes.reduce((a, s) => a + countWords(s.text), 0);
  const rows = characters.map((c) => {
    let inScenes = 0, mentions = 0, words = 0;
    const sceneIds = [];
    for (const s of scenes) {
      const n = countMentions(s.text, c);
      if (n > 0) { inScenes++; mentions += n; words += countWords(s.text); sceneIds.push(s.id); }
    }
    return { name: c.name, cat: c.cat || '', scenes: inScenes, mentions, words,
             share: pct(words, totalWords), sceneIds: sceneIds.slice(0, 40) };
  }).filter((r) => r.mentions > 0).sort((a, b) => b.words - a.words || b.mentions - a.mentions);
  const lead = rows[0];
  return {
    rows, totalWords,
    stats: [
      { label: tt('ui.aia.stCharAppear'), value: rows.length },
      { label: tt('ui.aia.stLead'), value: lead ? lead.name : '—' },
      { label: tt('ui.aia.stLeadShare'), value: lead ? lead.share + '%' : '0%' },
      { label: tt('ui.aia.stSilentChar'), value: characters.length - rows.length },
    ],
  };
}

// ═══════════════ 10) ให้คะแนน (ชั้นคำนวณเอง) ═══════════════
/**
 * คะแนนสุขภาพต้นฉบับจากตัวเลขล้วน ๆ 0–10 ต่อหัวข้อ — ไม่ใช่คะแนน "ความดีงามของเรื่อง"
 * (ชั้น AI ต่างหากที่ให้คะแนนเชิงศิลป์ · แยกกันชัดเพื่อไม่ให้ผู้ใช้เข้าใจผิด)
 */
export function analyzeScoreLocal(scenes = [], characters = []) {
  const pace = analyzePacing(scenes);
  const len = analyzeLength(scenes);
  const con = analyzeConflict(scenes);
  const rep = analyzeRepeats(scenes, { characters });
  const st = analyzeScreentime(scenes, characters);
  const words = len.total;
  const balance = st.rows.length > 1 ? 10 - clamp((st.rows[0].share - 100 / st.rows.length) / 8, 0, 10) : 5;
  const criteria = [
    { key: 'pacing', label: tt('ui.aia.crPacing'), score: round1(clamp(10 - Math.abs(pace.avg - 55) / 5, 0, 10)),
      note: ttf('ui.aia.crPacingNote', pace.avg, pace.slowRuns.length) },
    { key: 'dialogue', label: tt('ui.aia.crDialogue'), score: round1(clamp(10 - Math.abs(mean(pace.rows.map((r) => r.dialogue)) - 35) / 4, 0, 10)),
      note: ttf('ui.aia.crDialogueNote', +mean(pace.rows.map((r) => r.dialogue)).toFixed(1)) },
    { key: 'conflict', label: tt('ui.aia.crConflict'), score: round1(con.coverage / 10),
      note: ttf('ui.aia.crConflictNote', con.empty.length) },
    { key: 'consistency', label: tt('ui.aia.crSceneLen'), score: round1(clamp(10 - (len.avg ? 10 * len.sd / len.avg : 0), 0, 10)),
      note: ttf('ui.aia.crSceneLenNote', len.avg, len.sd) },
    { key: 'language', label: tt('ui.aia.crLanguage'), score: round1(clamp(10 - (words ? 400 * rep.totalFound / words : 0), 0, 10)),
      note: ttf('ui.aia.crLanguageNote', rep.totalFound) },
    { key: 'cast', label: tt('ui.aia.crCast'), score: round1(clamp(balance, 0, 10)),
      note: ttf('ui.aia.crCastNote', st.rows.length, st.rows[0] ? st.rows[0].share : 0) },
  ];
  const total = round1(mean(criteria.map((c) => c.score)));
  return {
    criteria, total, source: 'local',
    stats: [
      { label: tt('ui.aia.stScoreLocal'), value: total + '/10' },
      { label: tt('ui.common.scene2'), value: scenes.length },
      { label: tt('ui.common.word2'), value: words.toLocaleString() },
    ],
  };
}
function round1(v) { return +(Number(v) || 0).toFixed(1); }

// ═══════════════ ทะเบียนการวิเคราะห์ทั้ง 11 ชนิด ═══════════════
// order = ลำดับที่ผู้ใช้สั่งมา (1–11)
export const ANALYSES = [
  { id: 'pacing',     icon: '📊', ai: 'assist', title: tt('ui.aia.analyzePaceStory'),  desc: tt('ui.aia.dPacing') },
  { id: 'arc',        icon: '👤', ai: 'assist', title: tt('ui.aia.partCurveCharacter'), desc: tt('ui.aia.dArc'), needsChars: true },
  { id: 'words',      icon: '📝', ai: 'assist', title: tt('ui.aia.wordUse'),           desc: tt('ui.aia.dWords') },
  { id: 'conflict',   icon: '⚔️', ai: 'assist', title: tt('ui.common.conflict'),        desc: tt('ui.aia.dConflict') },
  { id: 'length',     icon: '⏱️', ai: 'assist', title: tt('ui.aia.longScene'),          desc: tt('ui.aia.dLength') },
  { id: 'plothole',   icon: '🕳️', ai: 'core',   title: tt('ui.aia.tPlotHole'),          desc: tt('ui.aia.dPlotHole') },
  { id: 'continuity', icon: '🔗', ai: 'core',   title: tt('ui.aia.tContinuity'),        desc: tt('ui.aia.dContinuity'), needsChars: true },
  { id: 'repeat',     icon: '🔁', ai: 'assist', title: tt('ui.aia.tRepeat'),            desc: tt('ui.aia.dRepeat') },
  { id: 'shipping',   icon: '💞', ai: 'assist', title: tt('ui.aia.tShipping'),          desc: tt('ui.aia.dShipping'), needsChars: true },
  { id: 'score',      icon: '⭐', ai: 'core',   title: tt('ui.aia.tScore'),             desc: tt('ui.aia.dScore') },
  { id: 'screentime', icon: '🎬', ai: 'assist', title: tt('ui.aia.tScreentime'),        desc: tt('ui.aia.dScreentime'), needsChars: true },
];
export const ANALYSIS_IDS = ANALYSES.map((a) => a.id);
export function analysisById(id) { return ANALYSES.find((a) => a.id === id) || null; }

/**
 * ชั้นคำนวณเอง — เรียกตัววิเคราะห์ให้ตรงชนิด
 * @returns {{stats:Array, ...}} รูปร่างต่างกันตามชนิด แต่มี `stats` เสมอ
 */
export function runLocal(id, scenes = [], characters = [], opts = {}) {
  switch (id) {
    case 'pacing':     return analyzePacing(scenes);
    case 'arc':        return analyzeArc(scenes, characters);
    case 'words':      return analyzeWords(scenes, { ...opts, characters });
    case 'conflict':   return analyzeConflict(scenes);
    case 'length':     return analyzeLength(scenes);
    case 'repeat':     return analyzeRepeats(scenes, { ...opts, characters });
    case 'shipping':   return analyzeShipping(scenes, characters);
    case 'screentime': return analyzeScreentime(scenes, characters);
    case 'score':      return analyzeScoreLocal(scenes, characters);
    case 'plothole':   return localPlotSummary(scenes);
    case 'continuity': return localContinuity(scenes, characters);
    default:           return { stats: [] };
  }
}

/** ข้อมูลพื้นฐานที่ช่วยให้ผู้ใช้เห็นอะไรก่อนยิง AI (Plot Hole ที่แท้จริงต้องใช้โมเดล) */
function localPlotSummary(scenes = []) {
  const dated = scenes.filter((s) => s.storyDate);
  const noPov = scenes.filter((s) => !s.pov && countWords(s.text) > 40);
  return {
    stats: [
      { label: tt('ui.common.scene2'), value: scenes.length },
      { label: tt('ui.aia.stHasStoryDate'), value: dated.length },
      { label: tt('ui.aia.stNoPov'), value: noPov.length },
    ],
    rows: noPov.map((s) => ({ id: s.id, title: s.title, note: tt('ui.aia.noteNoPov') })),
  };
}
/** ตัวละครที่โผล่แต่ไม่มีใน Wiki = จุดเสี่ยงเรื่องความสอดคล้อง (ตรวจได้โดยไม่ใช้ AI) */
function localContinuity(scenes = [], characters = []) {
  const st = analyzeScreentime(scenes, characters);
  const thin = st.rows.filter((r) => r.scenes === 1 && r.mentions === 1);
  return {
    stats: [
      { label: tt('ui.aia.stCharAppear'), value: st.rows.length },
      { label: tt('ui.aia.stCharOnce'), value: thin.length },
      { label: tt('ui.common.scene2'), value: scenes.length },
    ],
    rows: thin.map((r) => ({ id: r.sceneIds[0] || '', title: r.name, note: tt('ui.aia.noteCharOnce') })),
  };
}

// ═══════════════ ชั้น AI ═══════════════
export const AI_SYSTEM = tt('ui.aia.sysEditor');
/** คำสั่งเฉพาะของแต่ละชนิด (เก็บใน CSV — เปลี่ยนภาษาแล้ว prompt เปลี่ยนตาม) */
export const AI_TASK_KEYS = {
  pacing: 'ui.aia.taskPacing', arc: 'ui.aia.taskArc', words: 'ui.aia.taskWords',
  conflict: 'ui.aia.taskConflict', length: 'ui.aia.taskLength', plothole: 'ui.aia.taskPlotHole',
  continuity: 'ui.aia.taskContinuity', repeat: 'ui.aia.taskRepeat', shipping: 'ui.aia.taskShipping',
  score: 'ui.aia.taskScore', screentime: 'ui.aia.taskScreentime',
};

/** ย่อผลชั้นคำนวณเองให้เป็นข้อความสั้น ๆ ป้อนโมเดล (ไม่ให้โมเดลนับเลขเอง) */
export function localDigest(id, local = {}) {
  const lines = [];
  for (const s of (local.stats || [])) lines.push(`- ${s.label}: ${s.value}`);
  const takeRows = (rows, fmt, n = 12) => (rows || []).slice(0, n).forEach((r) => lines.push('- ' + fmt(r)));
  if (id === 'pacing') takeRows(local.rows, (r) => ttf('ui.aia.dgPacing', r.title, r.id, r.tempo, r.dialogue, r.words), 20);
  if (id === 'arc') takeRows(local.chars, (c) => ttf('ui.aia.dgArc', c.name, c.total, c.scenes)
    + (c.gaps.length ? ttf('ui.aia.dgArcGap', c.gaps.map((g) => g.from + '→' + g.to).join(', ')) : ''));
  if (id === 'words') takeRows(local.rows, (r) => ttf('ui.aia.dgWords', r.word, r.count, r.per10k), 30);
  if (id === 'conflict') takeRows(local.empty, (r) => ttf('ui.aia.dgConflict', r.title, r.id), 20);
  if (id === 'length') takeRows(local.rows, (r) => ttf('ui.aia.dgLength', r.title, r.id, r.words, r.minutes), 25);
  if (id === 'repeat') takeRows(local.rows, (r) => ttf('ui.aia.dgRepeat', r.word, r.count, r.title, r.id, r.closest), 25);
  if (id === 'shipping') takeRows(local.rows, (r) => ttf('ui.aia.dgShipping', r.a, r.b, r.scenes, r.score), 15);
  if (id === 'screentime') takeRows(local.rows, (r) => ttf('ui.aia.dgScreentime', r.name, r.scenes, r.mentions, r.share), 20);
  if (id === 'score') takeRows(local.criteria, (c) => ttf('ui.aia.dgScore', c.label, c.score, c.note), 10);
  if (id === 'plothole' || id === 'continuity') takeRows(local.rows, (r) => ttf('ui.aia.dgNote', r.title, r.id, r.note), 20);
  return lines.join('\n');
}

/** เนื้อฉากที่จะแนบไปกับ prompt (ตัดตามงบโทเคน — ฉากยาวถูกตัด ไม่ถูกทิ้ง) */
export function sceneBlocks(scenes = [], budget = 6000) {
  const out = [];
  let used = 0;
  for (const s of scenes) {
    let text = plainText(s.text);
    const head = [`[sceneId: ${s.id}]`, s.title || tt('ui.common.notNamed')];
    if (s.chapterTitle) head.push(tt('ui.common.chapter2') + s.chapterTitle);
    if (s.pov) head.push(tt('ui.common.view2') + s.pov);
    if (s.storyDate) head.push(tt('ui.aiPlot.timeStory') + s.storyDate);
    let cost = estimateTokens(text) + 40;
    if (used + cost > budget) {
      const left = budget - used - 40;
      if (left < 120) break;
      text = chunkText(text, { maxTokens: left })[0] || text.slice(0, left * 3);
      cost = estimateTokens(text) + 40;
    }
    out.push(head.join(' · ') + '\n' + text);
    used += cost;
    if (used >= budget) break;
  }
  return { blocks: out, tokens: used, truncated: out.length < scenes.length };
}

/**
 * ประกอบ prompt ของการวิเคราะห์ชนิดหนึ่ง — บริสุทธิ์ ไม่ยิงเน็ต
 * @returns {{system, prompt, tokens, sceneIds, truncated}}
 */
export function buildAnalysisPrompt(id, { scenes = [], local = {}, scope = {}, focus = '', budget = 6000 } = {}) {
  const def = analysisById(id);
  const task = tt(AI_TASK_KEYS[id] || '');
  const sc = describeScope(scope, scenes);
  const { blocks, tokens, truncated } = sceneBlocks(scenes, budget);
  const lines = [];
  lines.push(tt('ui.aia.pHeadScope') + sc.text);
  lines.push('');
  lines.push(tt('ui.aia.pHeadTask') + (def ? def.title : id));
  lines.push(task);
  lines.push('');
  const digest = localDigest(id, local);
  if (digest) {
    lines.push(tt('ui.aia.pHeadNumbers'));
    lines.push(digest);
    lines.push('');
  }
  lines.push(tt('ui.aia.pRules'));
  if (focus) lines.push(tt('ui.aiPlot.important') + focus);
  lines.push('');
  lines.push(id === 'score' ? tt('ui.aia.pFormatScore') : tt('ui.aia.pFormatFindings'));
  lines.push('');
  if (blocks.length) {
    lines.push(tt('ui.aia.pHeadScenes') + (truncated ? tt('ui.aia.pTruncated') : ''));
    lines.push(blocks.join('\n\n'));
  }
  const prompt = lines.join('\n');
  return { system: AI_SYSTEM, prompt, tokens: estimateTokens(prompt) + tokens,
           sceneIds: scenes.map((s) => s.id), truncated };
}

const FINDING_SCHEMA = {
  title: { required: true, type: 'string' },
  detail: { type: 'string', default: '' },
  severity: { type: 'string', enum: Object.keys(SEVERITY), default: 'minor' },
  sceneId: { type: 'string', default: '' },
  suggestion: { type: 'string', default: '' },
};
const SCORE_SCHEMA = {
  label: { required: true, type: 'string' },
  score: { required: true, type: 'number' },
  note: { type: 'string', default: '' },
};

/**
 * แปลงคำตอบของโมเดลเป็นโครงสร้าง — บริสุทธิ์
 * @returns {{kind:'findings'|'score', rows:Array, total?:number, raw:string}}
 */
export function parseAnalysisReply(id, text, opts = {}) {
  const raw = String(text || '');
  if (id === 'score') {
    const data = extractJson(raw);
    const arr = (data && (data.criteria || data.scores || data.items)) || data;
    const rows = validate(arr, SCORE_SCHEMA)
      .map((r) => ({ ...r, score: clamp(round1(r.score), 0, 10) }));
    const given = data && typeof data === 'object' && !Array.isArray(data) && Number(data.total);
    const total = isFinite(given) && given > 0 ? clamp(round1(given), 0, 10)
                                              : round1(mean(rows.map((r) => r.score)));
    return { kind: 'score', rows, total, summary: (data && data.summary) || '', raw };
  }
  const valid = opts.sceneIds ? new Set(opts.sceneIds) : null;
  const rows = validate(extractJson(raw), FINDING_SCHEMA)
    .filter((r) => !valid || !r.sceneId || valid.has(r.sceneId))
    .map((r) => ({ ...r, severityLabel: SEVERITY[r.severity] || r.severity }))
    .sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0));
  return { kind: 'findings', rows, raw };
}

/**
 * วิเคราะห์หนึ่งชนิดแบบครบวงจร: คำนวณเอง → (ถ้ามี client) ถาม AI ต่อ
 * @param {string} id
 * @param {{scenes, characters, scope, client, focus, budget, useAI}} o
 * @returns {Promise<{id, local, ai, scope, error?}>}
 */
export async function analyze(id, o = {}) {
  const def = analysisById(id);
  if (!def) return { id, error: tt('ui.aia.errUnknownKind'), local: { stats: [] }, ai: null };
  const scenes = filterScope(o.scenes || [], o.scope || {});
  if (!scenes.length) return { id, error: tt('ui.aia.errNoScene'), local: { stats: [] }, ai: null, scope: describeScope(o.scope, o.scenes || []) };
  const local = runLocal(id, scenes, o.characters || [], o);
  const scope = describeScope(o.scope, o.scenes || []);
  if (o.useAI === false || !o.client) return { id, local, ai: null, scope, scenes: scenes.length };
  const built = buildAnalysisPrompt(id, { scenes, local, scope: o.scope, focus: o.focus, budget: o.budget || 6000 });
  const res = await o.client.complete({
    prompt: built.prompt, system: built.system, feature: 'analyze:' + id,
    temperature: o.temperature ?? 0.3, maxTokens: o.maxTokens || 1200,
  });
  if (!res || !res.ok) return { id, local, ai: { ok: false, error: (res && res.error) || tt('ui.aia.errAiFail') }, scope, scenes: scenes.length };
  const parsed = parseAnalysisReply(id, res.text, { sceneIds: built.sceneIds });
  return { id, local, scope, scenes: scenes.length, truncated: built.truncated,
           ai: { ok: true, ...parsed, usage: res.usage, cost: res.cost } };
}

// ═══════════════ ประมาณโทเคน "ก่อน" ยิง AI ═══════════════
// ผู้ใช้ต้องรู้ว่ากดปุ่มนี้แล้วจะเสียเท่าไร **ก่อน** จะเสีย — ไม่ใช่มารู้ทีหลัง
// แยกเป็นสองขั้นเพื่อไม่ให้ช้า: นับโทเคนของเนื้อฉากครั้งเดียวต่อขอบเขต แล้วบวกส่วนที่ต่างกัน
// ของแต่ละชนิดทีหลัง (ถ้าเรียก sceneBlocks ใหม่ทั้ง 11 ใบ = อ่านข้อความทั้งเล่ม 11 รอบ)

/** โทเคนของเนื้อฉากในขอบเขตที่เลือก — คิดครั้งเดียวแล้วเอาไปใช้ได้ทุกชนิด */
export function scopeTokens(scenes = [], scope = {}, budget = 6000) {
  const picked = filterScope(scenes, scope);
  const { tokens, truncated } = sceneBlocks(picked, budget);
  return { scenes: picked.length, sceneTokens: tokens, truncated };
}

/** โทเคนที่จะใช้จริงของชนิดหนึ่ง = เนื้อฉาก + คำสั่ง + ตัวเลขที่ย่อไป + เพดานคำตอบ */
export function estimateAnalysis(id, base = {}, maxOut = 0) {
  const overhead = estimateTokens(AI_SYSTEM) + estimateTokens(tt(AI_TASK_KEYS[id] || '')) + 240;
  const digest = Math.min(900, 40 + (base.scenes || 0) * 14);   // ~14 โทเคนต่อฉากในสรุปตัวเลข
  const input = (base.sceneTokens || 0) + overhead + digest;
  const output = maxOut || (id === 'score' ? 900 : 1200);
  return { id, scenes: base.scenes || 0, input, output, total: input + output, truncated: !!base.truncated };
}

/** รวมทุกชนิดที่จะสั่ง (ใช้กับปุ่ม "วิเคราะห์ทั้งหมด") */
export function estimateTotal(ids = ANALYSIS_IDS, base = {}) {
  let input = 0, output = 0;
  for (const id of ids) { const e = estimateAnalysis(id, base); input += e.input; output += e.output; }
  return { input, output, total: input + output, count: ids.length };
}

/** ราคาโดยประมาณของค่าที่ estimateAnalysis คืนมา (ollama = 0) */
export function estimateUsd(provider, model, est = {}) {
  return estimateCost(provider || 'openai', model || '', { input: est.input || 0, output: est.output || 0 }).usd;
}

/** โทเคน/ราคาที่ **ใช้ไปจริง** จากผลที่เก็บไว้ (หลังใช้งาน) */
export function usageOfResults(results = {}) {
  let tokens = 0, usd = 0, calls = 0;
  for (const r of Object.values(results || {})) {
    const ai = r && r.ai;
    if (!ai || !ai.ok) continue;
    calls++;
    tokens += (ai.usage && (ai.usage.total || ((ai.usage.input || 0) + (ai.usage.output || 0)))) || 0;
    usd += (ai.cost && ai.cost.usd) || 0;
  }
  return { tokens, usd: +usd.toFixed(6), calls };
}

// ═══════════════ เซสชันการวิเคราะห์ (เก็บในโปรเจกต์) ═══════════════
// เก็บเป็นไฟล์ละเซสชันใน `<โปรเจกต์>/Analysis/*.json` — แนวเดียวกับ Planners/ และ Branches/
// เหตุผลที่ไม่รวมเป็นไฟล์เดียว: ผลของทั้งโปรเจกต์ก้อนหนึ่งใหญ่พอสมควร และผู้ใช้ลบทีละอันได้ตรง ๆ
export const ANALYSIS_SESSION_VERSION = 1;
export const SESSION_DIR = 'Analysis';

export function newAnalysisSession(o = {}) {
  const now = o.now || Date.now();
  return {
    v: ANALYSIS_SESSION_VERSION,
    id: o.id || ('ana-' + now),
    name: String(o.name || '').trim(),
    created: o.created || new Date(now).toISOString(),
    project: o.project || '',
    scope: { kind: 'project', sectionKey: '', chapterId: '', sceneId: '', ...(o.scope || {}) },
    scopeText: o.scopeText || '',
    useAI: o.useAI !== false,
    usage: o.usage || usageOfResults(o.results || {}),
    results: o.results || {},
  };
}

/** อ่านไฟล์เซสชันที่อาจเก่า/พัง → คืนรูปที่โค้ดปัจจุบันใช้ได้เสมอ (ไม่เคย throw) */
export function migrateAnalysisSession(raw) {
  const r = (raw && typeof raw === 'object') ? raw : {};
  const results = {};
  for (const [k, v] of Object.entries(r.results || {})) {
    if (!ANALYSIS_IDS.includes(k) || !v || typeof v !== 'object') continue;   // ชนิดที่ถูกถอดออกไปแล้ว
    results[k] = { id: k, local: v.local || { stats: [] }, ai: v.ai || null,
                   scope: v.scope || null, scenes: Number(v.scenes) || 0, error: v.error || undefined };
  }
  return newAnalysisSession({ ...r, results, usage: r.usage || usageOfResults(results) });
}

export function sessionSummary(s = {}) {
  const u = s.usage || { tokens: 0, usd: 0 };
  return {
    id: s.id || '', name: s.name || s.id || '',
    created: s.created || '', scopeText: s.scopeText || '',
    kinds: Object.keys(s.results || {}).length,
    tokens: u.tokens || 0, usd: u.usd || 0,
  };
}

/** ชื่อไฟล์ที่ปลอดภัยของเซสชัน (ผู้ใช้ตั้งชื่อไทยได้ · ตัวอักษรต้องห้ามของ Windows ถูกแทนที่) */
export function sessionFileName(s = {}) {
  const base = String(s.name || s.id || 'analysis').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80);
  return (base || String(s.id || 'analysis')) + '.json';
}

// ═══════════════ ส่งออก CSV ═══════════════
export function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function csvJoin(rows = []) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

/** ตารางของชั้นคำนวณเอง: [หัวตาราง, ...แถว] — คืน null ถ้าชนิดนั้นไม่มีตาราง */
export function localTable(id, local = {}) {
  const L = local || {};
  const H = (...a) => a;
  if (id === 'pacing' && L.rows) return [H(tt('ui.aia.csScene'), tt('ui.aia.csChapter'), tt('ui.aia.csWords'), tt('ui.aia.csDialogue'), tt('ui.aia.csAvgSent'), tt('ui.aia.csTempo')),
    ...L.rows.map((r) => [r.title, r.chapterTitle, r.words, r.dialogue, r.avgSentence, r.tempo])];
  if (id === 'arc' && L.chars) {
    const rows = [H(tt('ui.aia.csCharacter'), tt('ui.aia.csChapter'), tt('ui.aia.csCount'))];
    for (const c of L.chars) for (const ch of c.perChapter) rows.push([c.name, ch.chapterTitle, ch.count]);
    return rows;
  }
  if (id === 'words' && L.rows) return [H(tt('ui.aia.csWord'), tt('ui.aia.csCount'), tt('ui.aia.csPer10k')),
    ...L.rows.map((r) => [r.word, r.count, r.per10k])];
  if (id === 'conflict' && L.rows) return [H(tt('ui.aia.csScene'), tt('ui.aia.csChapter'), tt('ui.aia.csWords'), tt('ui.aia.csScore'), tt('ui.aia.csDensity'), tt('ui.aia.csMarkers')),
    ...L.rows.map((r) => [r.title, r.chapterTitle, r.words, r.score, r.density, r.hits.map((h) => h.word + '×' + h.count).join(' ')])];
  if (id === 'length' && L.rows) return [H(tt('ui.aia.csScene'), tt('ui.aia.csChapter'), tt('ui.aia.csWords'), tt('ui.aia.csMinutes'), tt('ui.aia.csPages')),
    ...L.rows.map((r) => [r.title, r.chapterTitle, r.words, r.minutes, r.pages])];
  if (id === 'repeat' && L.rows) return [H(tt('ui.aia.csWord'), tt('ui.aia.csCount'), tt('ui.aia.csClosest'), tt('ui.aia.csScene'), tt('ui.aia.csChapter')),
    ...L.rows.map((r) => [r.word, r.count, r.closest, r.title, r.chapterTitle])];
  if (id === 'shipping' && L.rows) return [H(tt('ui.aia.csSideA'), tt('ui.aia.csSideB'), tt('ui.aia.csSharedScenes'), tt('ui.aia.csMentions'), tt('ui.aia.csScore')),
    ...L.rows.map((r) => [r.a, r.b, r.scenes, r.mentions, r.score])];
  if (id === 'screentime' && L.rows) return [H(tt('ui.aia.csCharacter'), tt('ui.common.scene2'), tt('ui.aia.csMentions'), tt('ui.aia.csWords'), tt('ui.aia.csShare')),
    ...L.rows.map((r) => [r.name, r.scenes, r.mentions, r.words, r.share])];
  if (id === 'score' && L.criteria) return [H(tt('ui.aia.csCriterion'), tt('ui.aia.csScore'), tt('ui.aia.csNote')),
    ...L.criteria.map((c) => [c.label, c.score, c.note])];
  if (L.rows && L.rows.length) return [H(tt('ui.aia.csTitle'), tt('ui.aia.csNote')), ...L.rows.map((r) => [r.title, r.note || ''])];
  return null;
}

/** CSV ของผลชนิดเดียว: สถิติ → ตารางของชั้นคำนวณเอง → สิ่งที่ AI พบ */
export function resultCsv(id, res = {}) {
  const def = analysisById(id);
  const rows = [];
  rows.push([tt('ui.aia.csAnalysis'), def ? def.title : id]);
  if (res.scope && res.scope.text) rows.push([tt('ui.aia.csScope'), res.scope.text]);
  rows.push([]);
  const stats = (res.local && res.local.stats) || [];
  if (stats.length) {
    rows.push([tt('ui.aia.csStat'), tt('ui.aia.csValue')]);
    for (const s of stats) rows.push([s.label, s.value]);
    rows.push([]);
  }
  const tbl = localTable(id, res.local);
  if (tbl) { rows.push(...tbl); rows.push([]); }
  const ai = res.ai;
  if (ai && ai.ok && ai.kind === 'score' && ai.rows && ai.rows.length) {
    rows.push([tt('ui.aia.scoreAiHead'), String(ai.total)]);
    rows.push([tt('ui.aia.csCriterion'), tt('ui.aia.csScore'), tt('ui.aia.csNote')]);
    for (const r of ai.rows) rows.push([r.label, r.score, r.note]);
    if (ai.summary) rows.push([tt('ui.aia.csSummary'), ai.summary]);
    rows.push([]);
  } else if (ai && ai.ok && ai.rows && ai.rows.length) {
    rows.push([tt('ui.aia.aiHead')]);
    rows.push([tt('ui.aia.csSeverity'), tt('ui.aia.csTitle'), tt('ui.aia.csDetail'), tt('ui.aia.csSuggestion'), tt('ui.aia.csScene')]);
    for (const r of ai.rows) rows.push([r.severityLabel || r.severity, r.title, r.detail, r.suggestion, r.sceneId]);
    rows.push([]);
  }
  if (ai && ai.ok && ai.usage) {
    rows.push([tt('ui.aia.csTokenUsed'), ai.usage.total || 0, tt('ui.aia.csCostUsd'), (ai.cost && ai.cost.usd) || 0]);
  }
  return csvJoin(rows);
}

/** CSV ของทั้งเซสชัน — ทุกชนิดต่อกัน คั่นด้วยบรรทัดว่าง (เปิดใน Excel/Sheets ได้ตรง ๆ) */
export function sessionCsv(session = {}) {
  const parts = [];
  const head = [[tt('ui.aia.csSession'), session.name || session.id || ''],
                [tt('ui.aia.csCreated'), session.created || ''],
                [tt('ui.aia.csScope'), session.scopeText || ''],
                [tt('ui.aia.csTokenUsed'), (session.usage && session.usage.tokens) || 0,
                 tt('ui.aia.csCostUsd'), (session.usage && session.usage.usd) || 0], []];
  parts.push(csvJoin(head));
  for (const id of ANALYSIS_IDS) {
    const r = (session.results || {})[id];
    if (!r) continue;
    parts.push(resultCsv(id, r));
  }
  // BOM เสมอ — Excel บน Windows อ่านไทยเป็นตัวยึกยือถ้าไม่มี (กติกาเดียวกับ i18n-csv.js)
  return '﻿' + parts.join('\r\n');
}
