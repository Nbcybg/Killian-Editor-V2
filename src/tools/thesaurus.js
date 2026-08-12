// tools/thesaurus.js — เอนจินคำพ้อง/คำตรงข้าม (ข้อ 67)
// pure logic + adapter: ไม่แตะ DOM · เน็ตผ่าน http ที่ฉีดเข้ามา · แคชผ่าน storage ที่ฉีดเข้ามา
// spec: docs/67-thesaurus.md · UI เดิม (src/thesaurus.js) เปลี่ยนมาเรียกตัวนี้ได้เลย
//
// ลำดับการหา: แคช → คลังในตัว (ออฟไลน์) → Datamuse/WordNet (อังกฤษ, ต้องเปิดใช้เอง)
// ไทยไม่มี API ฟรีที่ใช้ได้ → ใช้คลังในตัวที่ดูแลเองเท่านั้น (ไม่ส่งคำออกอินเทอร์เน็ต)

import { T } from '../i18n.js';
export const CACHE_KEY = 'k2-thes-cache';
export const CACHE_TTL = 30 * 24 * 3600 * 1000;      // 30 วัน — คำพ้องไม่เปลี่ยนบ่อย
export const CACHE_MAX = 500;

// ───────── คลังในตัว (ออฟไลน์เสมอ) ─────────
// เล็กแต่ใช้ได้จริงกับคำที่นักเขียนไทยใช้ซ้ำบ่อย — เพิ่มเองได้ที่ Plugins/thesaurus.json
export const TH_SYNONYMS = {
  'สวย': ['งาม', 'งดงาม', 'เลอโฉม', 'ตระการตา'],
  'เดิน': ['ก้าว', 'ย่าง', 'ดำเนิน', 'ย่างเท้า'],
  'พูด': ['กล่าว', 'เอ่ย', 'บอก', 'เปรย', 'ปริปาก'],
  'มอง': ['จ้อง', 'เพ่ง', 'ชายตา', 'ทอดสายตา'],
  'กลัว': ['หวาดกลัว', 'ขยาด', 'พรั่นพรึง', 'ครั่นคร้าม'],
  'โกรธ': ['เดือดดาล', 'ขุ่นเคือง', 'ฉุนเฉียว', 'เกรี้ยวกราด'],
  'เศร้า': ['โศก', 'หม่นหมอง', 'ระทม', 'เสียใจ'],
  'ดีใจ': ['ยินดี', 'ปลาบปลื้ม', 'ปีติ', 'เบิกบาน'],
  'เร็ว': ['ไว', 'ฉับไว', 'รวดเร็ว', 'พลัน'],
  'ใหญ่': ['มหึมา', 'มโหฬาร', 'โต', 'กว้างขวาง'],
  'เล็ก': ['จิ๋ว', 'กระจิริด', 'น้อย', 'เล็กจ้อย'],
  'มืด': ['มืดมิด', 'สลัว', 'อับแสง', 'ทมิฬ'],
  'เงียบ': ['สงบ', 'เงียบสงัด', 'ปราศจากเสียง', 'สงัด'],
  'ตาย': ['สิ้นใจ', 'ดับสูญ', 'ล่วงลับ', 'วายชนม์'],
  'บ้าน': ['เรือน', 'ที่พัก', 'ที่อยู่อาศัย', 'คฤหาสน์'],
};
export const TH_ANTONYMS = {
  'สวย': ['ขี้เหร่', 'อัปลักษณ์'], 'ใหญ่': ['เล็ก', 'จิ๋ว'], 'เล็ก': ['ใหญ่', 'มหึมา'],
  'มืด': ['สว่าง', 'กระจ่าง'], 'เงียบ': ['ดัง', 'อึกทึก'], 'เร็ว': ['ช้า', 'เชื่องช้า'],
  'ดีใจ': ['เศร้า', 'เสียใจ'], 'เศร้า': ['ดีใจ', 'ยินดี'], 'กลัว': ['กล้า', 'ห้าวหาญ'],
};
export const EN_SYNONYMS = {
  big: ['large', 'huge', 'massive', 'enormous'], small: ['little', 'tiny', 'compact', 'minor'],
  walk: ['stroll', 'stride', 'wander', 'pace'], say: ['tell', 'state', 'utter', 'remark'],
  look: ['gaze', 'stare', 'glance', 'watch'], happy: ['glad', 'joyful', 'cheerful', 'content'],
  sad: ['unhappy', 'sorrowful', 'gloomy', 'downcast'], fast: ['quick', 'rapid', 'swift', 'speedy'],
  dark: ['dim', 'gloomy', 'shadowy', 'murky'], quiet: ['silent', 'still', 'hushed', 'calm'],
};
export const EN_ANTONYMS = {
  big: ['small', 'tiny'], small: ['big', 'large'], happy: ['sad', 'miserable'], sad: ['happy', 'glad'],
  fast: ['slow'], dark: ['bright', 'light'], quiet: ['loud', 'noisy'],
};

const EN_WORD = /^[a-zA-Z][a-zA-Z'-]{1,30}$/;
export const isEnglish = (w) => EN_WORD.test(String(w || '').trim());
export const isThai = (w) => /[฀-๿]/.test(String(w || ''));
export function normalizeWord(w) { return String(w || '').trim().replace(/[.,!?"'()[\]{}…]/g, '').toLowerCase(); }

/** Look a word up in the built-in offline lists. */
export function localLookup(word, kind = 'syn', extra = null) {
  const w = String(word || '').trim();
  const lower = w.toLowerCase();
  const banks = kind === 'ant'
    ? [extra && extra.antonyms, TH_ANTONYMS, EN_ANTONYMS]
    : [extra && extra.synonyms, TH_SYNONYMS, EN_SYNONYMS];
  const out = [];
  for (const bank of banks) {
    if (!bank) continue;
    for (const key of [w, lower]) if (bank[key]) out.push(...bank[key]);
  }
  // ค้นย้อนกลับ: ถ้าคำที่หาปรากฏเป็นคำพ้องของคำอื่น คำนั้นก็เป็นคำพ้องของมันเช่นกัน
  if (kind === 'syn') {
    for (const bank of [extra && extra.synonyms, TH_SYNONYMS, EN_SYNONYMS]) {
      if (!bank) continue;
      for (const [key, list] of Object.entries(bank)) {
        if (list.includes(w) || list.includes(lower)) out.push(key, ...list.filter((x) => x !== w && x !== lower));
      }
    }
  }
  return uniq(out).filter((x) => x !== w && x !== lower);
}
const uniq = (a) => [...new Set(a.filter(Boolean))];

// ───────── Datamuse (อังกฤษ) ─────────
export const DATAMUSE = 'https://api.datamuse.com/words';
export function datamuseUrl(word, kind = 'syn', max = 15) {
  const rel = kind === 'ant' ? 'rel_ant' : 'ml';
  return `${DATAMUSE}?${rel}=${encodeURIComponent(word)}&max=${max}`;
}
/** Parse a Datamuse reply body (string or array) → word list. */
export function parseDatamuse(body, word = '') {
  let rows;
  try { rows = typeof body === 'string' ? JSON.parse(body) : body; } catch { return []; }
  if (!Array.isArray(rows)) return [];
  return uniq(rows.map((r) => r && r.word).filter((w) => w && w !== word));
}

// ───────── แคช ─────────
function defaultStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map();
  return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
}
export class ThesaurusCache {
  constructor({ storage = defaultStorage(), key = CACHE_KEY, ttl = CACHE_TTL, max = CACHE_MAX, now = () => Date.now() } = {}) {
    this.storage = storage; this.key = key; this.ttl = ttl; this.max = max; this.now = now;
    this.map = this._read();
  }
  _read() {
    try { const o = JSON.parse(this.storage.getItem(this.key) || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch { return {}; }
  }
  get(word, kind) {
    const row = this.map[`${kind}:${word}`];
    if (!row) return null;
    if (this.now() - row.t > this.ttl) { delete this.map[`${kind}:${word}`]; return null; }   // หมดอายุ
    return row.w;
  }
  set(word, kind, words) {
    this.map[`${kind}:${word}`] = { w: words, t: this.now() };
    const keys = Object.keys(this.map);
    if (keys.length > this.max) {                       // เกินโควตา → ทิ้งของเก่าสุดก่อน
      keys.sort((a, b) => this.map[a].t - this.map[b].t).slice(0, keys.length - this.max).forEach((k) => delete this.map[k]);
    }
    this.save();
    return words;
  }
  save() { try { this.storage.setItem(this.key, JSON.stringify(this.map)); } catch { /* โควตาเต็ม = ข้าม */ } }
  clear() { this.map = {}; this.storage.removeItem(this.key); }
  get size() { return Object.keys(this.map).length; }
}

// ───────── เอนจินหลัก ─────────
export class Thesaurus {
  /**
   * @param {object} o { http, storage, online, extra, providers, now }
   *        online   = อนุญาตให้ยิงเน็ตไหม (ค่าเริ่มต้น false — ส่งคำผู้ใช้ออกเน็ตต้องเลือกเอง)
   *        extra    = { synonyms, antonyms } คลังเพิ่มจาก Plugins/thesaurus.json
   *        providers= ตัวหาเพิ่ม เช่น WordNet ในเครื่อง: [{ name, lookup(word,kind) → string[] }]
   */
  constructor({ http = null, storage, online = false, extra = null, providers = [], now = () => Date.now(), max = 15 } = {}) {
    this.http = http; this.online = online; this.extra = extra; this.providers = providers; this.max = max;
    this.cache = new ThesaurusCache({ storage, now });
  }
  setExtra(extra) { this.extra = extra; }

  async lookup(word, kind = 'syn') {
    const w = normalizeWord(word);
    if (!w) return { words: [], source: 'none', word: w };
    const cached = this.cache.get(w, kind);
    if (cached) return { words: cached, source: 'cache', word: w };

    const localWords = localLookup(word, kind, this.extra);
    for (const p of this.providers) {                   // WordNet ในเครื่อง ฯลฯ
      try {
        const got = await p.lookup(w, kind);
        if (got && got.length) {
          const words = uniq([...localWords, ...got]).slice(0, this.max);
          this.cache.set(w, kind, words);
          return { words, source: p.name || 'provider', word: w };
        }
      } catch { /* provider พังต้องไม่ล้มทั้งระบบ */ }
    }
    if (this.online && this.http && isEnglish(w)) {
      try {
        const res = await this.http.fetch(datamuseUrl(w, kind, this.max), { method: 'GET' });
        if (res && res.ok) {
          const got = parseDatamuse(res.body, w);
          if (got.length) {
            const words = uniq([...localWords, ...got]).slice(0, this.max);
            this.cache.set(w, kind, words);
            return { words, source: 'datamuse', word: w };
          }
        }
      } catch { /* เน็ตล่ม → ตกไปใช้คลังในตัว */ }
    }
    if (localWords.length) {
      this.cache.set(w, kind, localWords.slice(0, this.max));
      return { words: localWords.slice(0, this.max), source: 'local', word: w };
    }
    return { words: [], source: 'none', word: w };
  }

  /** @returns {Promise<string[]>} — the API required by the spec */
  async getSynonyms(word) { return (await this.lookup(word, 'syn')).words; }
  /** @returns {Promise<string[]>} */
  async getAntonyms(word) { return (await this.lookup(word, 'ant')).words; }
  clearCache() { this.cache.clear(); }
}

// ───────── ตัวช่วยระดับโมดูล (ใช้ instance เดียวร่วมกันทั้งแอป) ─────────
let _shared = null;
export function configure(opts) { _shared = new Thesaurus(opts); return _shared; }
export function shared() { return _shared || (_shared = new Thesaurus({})); }
export function getSynonyms(word) { return shared().getSynonyms(word); }
export function getAntonyms(word) { return shared().getAntonyms(word); }

/** Load user-supplied word lists from <root>/Plugins/thesaurus.json (optional). */
export async function loadExtra(io, root) {
  try {
    const p = io.join(root, 'Plugins', 'thesaurus.json');
    if (!(await io.exists(p))) return null;
    const j = await io.readJson(p);
    if (!j) return null;
    return { synonyms: j.synonyms || {}, antonyms: j.antonyms || {} };
  } catch { return null; }
}
