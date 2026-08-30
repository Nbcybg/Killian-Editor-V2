// shortcode.js — [alpha.116 ข้อ 8] **โค้ดสั้น** แบบ `[title]` (บริสุทธิ์ 100% · มี unit test)
//
// ผู้ใช้: *"เตรียมตัวทำ shortcode หน่อย แบบ [title] เพื่อให้สะดวกในการเอาไปต่อยอด"*
//
// ═══ ทำไมต้องมีอีกระบบ ทั้งที่มี {{ตัวแปร}} อยู่แล้ว ═══
// `template-vars.js` แก้ปัญหาคนละข้อ — มันคือ "ชื่อ/ฟิลด์จาก Wiki" ล้วน ๆ (`{{โทระ.อายุ}}`)
// ไม่มีที่ว่างให้ค่าของ **บริบทที่กำลังส่งออกอยู่** (ชื่อเรื่อง · บทที่ · ฉาก · จำนวนคำ · วันที่)
// และไม่มีอาร์กิวเมนต์ · ระบบนี้จึงเป็นชั้นบนที่ต่อยอดได้: เพิ่มโค้ดใหม่ = เพิ่มหนึ่งแถวใน
// `SHORTCODES` แล้วใช้ได้ทันทีทั้งในเวิร์กโฟลว์ส่งออก เมนูแทรก และตัวตรวจ
//
// ═══ กฎที่ตัดสินรูปแบบไวยากรณ์ ═══
//  1) **ไม่รู้จัก = ไม่แตะ** — โค้ดที่ไม่มีในทะเบียนถูกปล่อยไว้เป็นข้อความเดิมเป๊ะ
//     (เดียวกับกฎ "ไม่มี fallback" ของระบบภาษา: เห็นของที่ผิดดีกว่าข้อความหายเงียบ ๆ)
//  2) **`[[title]]` = ตัวอักษรจริง** — คนเขียนนิยายใช้วงเล็บเหลี่ยมในเนื้อเรื่องได้ปกติ
//     ต้องมีทางพิมพ์ `[title]` แบบไม่ให้ถูกแทน
//  3) **ห้ามซ้อนชั้น** — โค้ดหนึ่งตัวจบใน `[...]` เดียว ไม่มี `[a [b]]` (พาร์เซอร์เรียบง่าย
//     อ่านออกด้วยตา และไม่มีวันวนไม่รู้จบตอนค่าที่แทนมามีวงเล็บเหลี่ยมติดมาด้วย)
//  4) **แทนรอบเดียว** — ค่าที่แทนเข้าไปแล้วจะไม่ถูกสแกนซ้ำ (กันลูปและกันเนื้อหาของผู้ใช้
//     ถูกตีความเป็นโค้ดโดยไม่ตั้งใจ)
//
// ไฟล์นี้ไม่แตะ DOM/fs/เวลา — วันที่รับผ่าน `ctx.now` เพื่อให้เทสคาดเดาผลได้
//
// ═══ [alpha.121] ขยายให้ครอบคลุม Wiki/เอนทิตี้/แชท AI/คอมเมนต์ ═══
// ผู้ใช้: *"ทำ shortcode ให้เยอะและละเอียดที่สุด ครอบคลุมทุกหัวข้อ ทั้ง wiki ทั้ง entities
//         ทั้ง ai chat ทั้ง comment"*
// เดิมทะเบียนมี 16 ตัว ใช้ได้จริงแค่ในเวิร์กโฟลว์ส่งออก (sceneContext) — Wiki/แชท/คอมเมนต์
// ไม่มีทางเข้าถึงเลย เพิ่มรอบนี้:
//   - โค้ดใหม่ 33 ตัว (สถานะ/องก์/วันที่ของบท · อารมณ์/ขัดแย้ง/โน้ต/สี/ปักหมุด/ล็อกของฉาก ·
//     สถิติโปรเจกต์รวม · เวลา/วัน/ปี · ฟิลด์-หมวด-เรื่องย่อ-แท็ก-ความสัมพันธ์ของเอนทิตี้ Wiki)
//   - `entityContext()` คู่ขนานกับ `sceneContext()` — บริบทของเอนทิตี้ Wiki หนึ่งใบ
//   - จุดเชื่อมกับ UI จริง (แผง Wiki/แชท AI/คอมเมนต์) อยู่ที่ `liveShortcodeContext()`
//     ใน app.js (ไฟล์นี้ยังบริสุทธิ์ 100% เหมือนเดิม ไม่แตะ DOM/kapi)

import { t } from './i18n.js';

/**
 * ตัวจับโทเคน
 *   กลุ่ม 1 = `[[...]]` (หนีการแทน)
 *   กลุ่ม 2 = ชื่อโค้ด · กลุ่ม 3 = ส่วนที่เหลือดิบ ๆ (`:เป้าหมาย` และ/หรือ `คีย์=ค่า`)
 * ชื่อเป็นอังกฤษ/ตัวเลข/`-`/`_` เท่านั้น — วงเล็บเหลี่ยมที่มีข้อความไทยข้างในจึงไม่โดนแตะ
 */
const TOKEN = /\[\[([^[\]]*)\]\]|\[([A-Za-z][A-Za-z0-9_-]*)((?::|\s)[^[\]]*)?\]/g;

/** อ่านส่วนอาร์กิวเมนต์ → `{arg, opts}` (`arg` = ค่าหลังเครื่องหมาย `:`) */
export function parseArgs(rest) {
  const out = { arg: '', opts: {} };
  let s = String(rest || '');
  if (s.startsWith(':')) {
    // ทุกอย่างจนถึงช่องว่างแรกคือเป้าหมาย — ชื่อ Wiki ภาษาไทยไม่มีช่องว่างอยู่แล้ว
    const m = s.slice(1).match(/^(\S*)([\s\S]*)$/);
    out.arg = (m && m[1]) || '';
    s = (m && m[2]) || '';
  }
  const KV = /(\w+)=("([^"]*)"|'([^']*)'|[^\s]*)/g;
  let m;
  while ((m = KV.exec(s))) {
    out.opts[m[1]] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[2]);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// ทะเบียนโค้ดสั้น — **เพิ่มที่นี่ที่เดียว** แล้วใช้ได้ทุกทาง
// `group` ใช้จัดเมนูแทรก · `get(ctx, sc)` ต้องคืนสตริงเสมอ (ไม่มีค่า = คืน '')
// ────────────────────────────────────────────────────────────────
const str = (v) => (v === undefined || v === null ? '' : String(v));

/** วันที่ในรูปแบบที่ขอ — `iso` (2026-08-30) · `year` · `time` · `weekday` · ไม่ระบุ = ตามเครื่อง */
export function formatDate(d, fmt) {
  // ไม่ได้ส่งวันที่มา = ไม่มีวันที่ **ไม่ใช่** 1 ม.ค. 1970 (`new Date(0)`) — เคยพลาดตรงนี้ในเทส
  if (d === undefined || d === null || d === '') return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return '';
  const p2 = (n) => String(n).padStart(2, '0');
  if (fmt === 'iso') return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
  if (fmt === 'year') return String(dt.getFullYear());
  if (fmt === 'time') return `${p2(dt.getHours())}:${p2(dt.getMinutes())}`;
  if (fmt === 'weekday') { try { return dt.toLocaleDateString(undefined, { weekday: 'long' }); } catch { return ''; } }
  try { return dt.toLocaleDateString(); } catch { return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`; }
}

/** boolean → ป้ายที่แปลแล้ว (ใช่/ไม่ใช่) — ใช้กับ flag/locked/chapterflag */
const yn = (v) => (v ? t('ui.shortcode.yes') : t('ui.shortcode.no'));

// **คำอธิบายเขียนเป็น `t('คีย์ตรง ๆ')` ในตาราง ห้ามต่อสตริง** — ประตูกันพลาดของระบบภาษา
// (`test/i18n-keys.test.cjs`) กวาดหา `t('…')` ด้วย regex · `t('ui.shortcode.d' + name)`
// จะถูกอ่านเป็นคีย์ `ui.shortcode.d` แล้วเทสแดงทันทีทั้งที่คีย์จริงมีครบ
export const SHORTCODES = [
  // ── งาน ──
  { name: 'title',    group: 'work', label: t('ui.shortcode.dtitle'),   get: (c) => str(c.title) },
  { name: 'author',   group: 'work', label: t('ui.shortcode.dauthor'),  get: (c) => str(c.author) },
  { name: 'project',  group: 'work', label: t('ui.shortcode.dproject'), get: (c) => str(c.project) },
  { name: 'book',     group: 'work', label: t('ui.shortcode.dbook'),    get: (c) => str(c.book) },
  { name: 'language',  group: 'work', label: t('ui.shortcode.dlanguage'),  get: (c) => str(c.language) },
  { name: 'appversion', group: 'work', label: t('ui.shortcode.dappversion'), get: (c) => str(c.appVersion) },
  // ── ที่ที่โค้ดนี้ยืนอยู่ (บท/ฉาก) ──
  { name: 'chapter',  group: 'place', label: t('ui.shortcode.dchapter'),   get: (c) => str(c.chapter) },
  { name: 'scene',    group: 'place', label: t('ui.shortcode.dscene'),     get: (c) => str(c.scene) },
  { name: 'sceneno',  group: 'place', label: t('ui.shortcode.dsceneno'),   get: (c) => str(c.sceneNo) },
  { name: 'chapterno', group: 'place', label: t('ui.shortcode.dchapterno'), get: (c) => str(c.chapterNo) },
  { name: 'status',   group: 'place', label: t('ui.shortcode.dstatus'),    get: (c) => str(c.status) },
  { name: 'pov',      group: 'place', label: t('ui.shortcode.dpov'),       get: (c) => str(c.pov) },
  { name: 'synopsis', group: 'place', label: t('ui.shortcode.dsynopsis'),  get: (c) => str(c.synopsis) },
  { name: 'tags',     group: 'place', label: t('ui.shortcode.dtags'),
    get: (c, sc) => (Array.isArray(c.tags) ? c.tags : String(c.tags || '').split(','))
      .map((x) => String(x).trim()).filter(Boolean).join(sc.opts.sep || ', ') },
  { name: 'emotion',   group: 'place', label: t('ui.shortcode.demotion'),   get: (c) => str(c.emotion) },
  { name: 'conflict',  group: 'place', label: t('ui.shortcode.dconflict'),  get: (c) => str(c.conflict) },
  { name: 'note',      group: 'place', label: t('ui.shortcode.dnote'),      get: (c) => str(c.note) },
  { name: 'futurenote', group: 'place', label: t('ui.shortcode.dfuturenote'), get: (c) => str(c.futureNote) },
  { name: 'storydate', group: 'place', label: t('ui.shortcode.dstorydate'), get: (c) => str(c.storyDate) },
  { name: 'color',     group: 'place', label: t('ui.shortcode.dcolor'),     get: (c) => str(c.color) },
  { name: 'flag',      group: 'place', label: t('ui.shortcode.dflag'),      get: (c) => str(c.flag) },
  { name: 'locked',    group: 'place', label: t('ui.shortcode.dlocked'),    get: (c) => str(c.locked) },
  { name: 'chapterstatus', group: 'place', label: t('ui.shortcode.dchapterstatus'), get: (c) => str(c.chapterStatus) },
  { name: 'chapteract',    group: 'place', label: t('ui.shortcode.dchapteract'),    get: (c) => str(c.chapterAct) },
  { name: 'chapterdate',   group: 'place', label: t('ui.shortcode.dchapterdate'),   get: (c) => str(c.chapterDate) },
  { name: 'chapterflag',   group: 'place', label: t('ui.shortcode.dchapterflag'),   get: (c) => str(c.chapterFlag) },
  // ── ตัวเลข (ฉากปัจจุบัน + สถิติรวมทั้งโปรเจกต์) ──
  { name: 'words',    group: 'num', label: t('ui.shortcode.dwords'), get: (c) => str(c.words) },
  { name: 'chars',    group: 'num', label: t('ui.shortcode.dchars'), get: (c) => str(c.chars) },
  { name: 'pages',    group: 'num', label: t('ui.shortcode.dpages'), get: (c) => str(c.pages) },
  { name: 'totalwords',      group: 'num', label: t('ui.shortcode.dtotalwords'),      get: (c) => str(c.totalWords) },
  { name: 'totalscenes',     group: 'num', label: t('ui.shortcode.dtotalscenes'),     get: (c) => str(c.totalScenes) },
  { name: 'totalchapters',   group: 'num', label: t('ui.shortcode.dtotalchapters'),   get: (c) => str(c.totalChapters) },
  { name: 'totalbooks',      group: 'num', label: t('ui.shortcode.dtotalbooks'),      get: (c) => str(c.totalBooks) },
  { name: 'totalcharacters', group: 'num', label: t('ui.shortcode.dtotalcharacters'), get: (c) => str(c.totalCharacters) },
  { name: 'totallocations',  group: 'num', label: t('ui.shortcode.dtotallocations'),  get: (c) => str(c.totalLocations) },
  { name: 'dailygoal',       group: 'num', label: t('ui.shortcode.ddailygoal'),       get: (c) => str(c.dailyGoal) },
  { name: 'projectgoal',     group: 'num', label: t('ui.shortcode.dprojectgoal'),     get: (c) => str(c.projectGoal) },
  { name: 'progress',        group: 'num', label: t('ui.shortcode.dprogress'),        get: (c) => str(c.progress) },
  { name: 'commentcount',    group: 'num', label: t('ui.shortcode.dcommentcount'),    get: (c) => str(c.commentCount) },
  // ── เวลา ──
  { name: 'date',     group: 'time', label: t('ui.shortcode.ddate'),
    get: (c, sc) => formatDate(c.now, sc.opts.fmt || sc.arg) },
  { name: 'time',     group: 'time', label: t('ui.shortcode.dtime'),    get: (c) => formatDate(c.now, 'time') },
  { name: 'year',     group: 'time', label: t('ui.shortcode.dyear'),    get: (c) => formatDate(c.now, 'year') },
  { name: 'weekday',  group: 'time', label: t('ui.shortcode.dweekday'), get: (c) => formatDate(c.now, 'weekday') },
  // ── ข้อมูลจาก Wiki / เอนทิตี้ (ใช้ตารางเดียวกับ {{ตัวแปร}} — ไม่มีแหล่งข้อมูลซ้อน) ──
  // `needsArg: true` = ต้องมีเป้าหมายถึงมีความหมาย (เมนู "แทรกค่าจริงทันที" ของ app.js
  // ใช้ธงนี้ตัดสินว่าต้องถามชื่อ/บทบาทก่อนค่อยแทน ไม่ใช่แทรกค่าว่างเงียบ ๆ)
  { name: 'wiki',     group: 'wiki', label: t('ui.shortcode.dwiki'), needsArg: true,
    get: (c, sc) => str((c.vars || {})[sc.arg]) },
  { name: 'var',      group: 'wiki', label: t('ui.shortcode.dvar'), needsArg: true,
    get: (c, sc) => str((c.vars || {})[sc.arg]) },
  // ค่าฟิลด์ของ "เอนทิตี้ที่กำลังแก้อยู่เอง" — ไม่ต้องพิมพ์ชื่อนำหน้าเหมือน [wiki:ชื่อ.ฟิลด์]
  { name: 'field',    group: 'wiki', label: t('ui.shortcode.dfield'), needsArg: true,
    get: (c, sc) => {
      const f = c.entityFields || {};
      if (sc.arg in f) return str(f[sc.arg]);
      const want = String(sc.arg || '').trim().toLowerCase();
      for (const k of Object.keys(f)) if (k.toLowerCase() === want) return str(f[k]);
      return '';
    } },
  { name: 'entity',        group: 'wiki', label: t('ui.shortcode.dentity'),        get: (c) => str(c.entity) },
  { name: 'entitycat',     group: 'wiki', label: t('ui.shortcode.dentitycat'),     get: (c) => str(c.entityCat) },
  { name: 'entitysummary', group: 'wiki', label: t('ui.shortcode.dentitysummary'), get: (c) => str(c.entitySummary) },
  { name: 'entitytags',    group: 'wiki', label: t('ui.shortcode.dentitytags'),    get: (c) => str(c.entityTags) },
  // ความสัมพันธ์ตามบทบาท — `[relation:พ่อ]` คืนชื่อทุกคนที่ผูกไว้ด้วยบทบาทนั้น คั่นด้วยจุลภาค
  { name: 'relation', group: 'wiki', label: t('ui.shortcode.drelation'), needsArg: true,
    get: (c, sc) => ((c.entityRelations || {})[String(sc.arg || '').trim().toLowerCase()] || []).join(', ') },
];

export const shortcodeDef = (name) =>
  SHORTCODES.find((s) => s.name === String(name || '').toLowerCase()) || null;
/** คำอธิบายของโค้ดหนึ่งตัว (ไม่รู้จัก = คืนชื่อโค้ดเอง ไม่คืนค่าว่าง) */
export const shortcodeLabel = (name) => (shortcodeDef(name) || {}).label || String(name || '');
/** ชื่อโค้ดทั้งหมด (เมนูแทรก · ตัวเติมคำ · เทส) */
export const shortcodeNames = () => SHORTCODES.map((s) => s.name);

/** กลุ่มในเมนูแทรก — เรียงตามลำดับที่จะโชว์ */
export const SHORTCODE_GROUPS = [
  { key: 'work',  label: t('ui.shortcode.grpWork') },
  { key: 'place', label: t('ui.shortcode.grpPlace') },
  { key: 'num',   label: t('ui.shortcode.grpNum') },
  { key: 'time',  label: t('ui.shortcode.grpTime') },
  { key: 'wiki',  label: t('ui.shortcode.grpWiki') },
];

/**
 * กวาดหาโค้ดสั้นทั้งหมดในข้อความ (ไม่แทนค่า) — ใช้ทำตัวตรวจ/ไฮไลต์/รายงาน
 * @returns {Array<{name,arg,opts,raw,start,end,known,escaped}>}
 */
export function scanShortcodes(text) {
  const out = [];
  const s = String(text || '');
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(s))) {
    if (m[1] !== undefined) {
      out.push({ name: '', arg: '', opts: {}, raw: m[0], start: m.index,
                 end: m.index + m[0].length, known: false, escaped: true });
      continue;
    }
    const name = m[2].toLowerCase();
    const { arg, opts } = parseArgs(m[3]);
    out.push({ name, arg, opts, raw: m[0], start: m.index, end: m.index + m[0].length,
               known: !!shortcodeDef(name), escaped: false });
  }
  return out;
}

/**
 * แทนค่าโค้ดสั้นในข้อความ
 * @param {string} text
 * @param {object} ctx บริบท — `{title, author, chapter, scene, words, vars:{}, now}`
 * @param {object} [o] `{keepUnknown}` — ไม่รู้จักแล้วทำอะไร (ค่าเริ่มต้น: คงข้อความเดิมไว้)
 * @returns {string}
 */
export function expandShortcodes(text, ctx = {}, o = {}) {
  return expandShortcodesInfo(text, ctx, o).text;
}

/** เหมือน `expandShortcodes` แต่บอกด้วยว่าใช้โค้ดอะไรไปบ้าง/ตัวไหนไม่รู้จัก */
export function expandShortcodesInfo(text, ctx = {}, o = {}) {
  const keepUnknown = o.keepUnknown !== false;
  const used = [];
  const unknown = [];
  const src = String(text || '');
  TOKEN.lastIndex = 0;
  const out = src.replace(TOKEN, (raw, esc, name, rest) => {
    if (esc !== undefined) return '[' + esc + ']';        // กฎข้อ 2 — วงเล็บจริง
    const key = String(name).toLowerCase();
    const def = shortcodeDef(key);
    if (!def) {
      if (!unknown.includes(key)) unknown.push(key);
      return keepUnknown ? raw : '';                       // กฎข้อ 1 — ไม่รู้จัก = ไม่แตะ
    }
    const sc = parseArgs(rest);
    if (!used.includes(key)) used.push(key);
    let v = '';
    try { v = def.get(ctx || {}, sc); } catch { v = ''; }
    return v === undefined || v === null ? '' : String(v);
  });
  return { text: out, used, unknown };
}

// 'Outline' = สถานะเริ่มต้นที่ยังไม่ได้ตั้งจริง (ตรงกับความหมายเดียวกันทั่วทั้งแอป —
// filterTree/buildTree/updateSummaryBar ก็ปฏิบัติกับค่านี้เหมือนกัน "ยังไม่ตั้ง") → ไม่ควรโผล่
// เป็นข้อความ "Outline" ตรง ๆ ในเอกสารที่ส่งออก
const statusOf = (s) => (s && s !== 'Outline') ? String(s) : '';

/** ส่วนร่วมของทุกบริบท — ข้อมูลระดับ "งาน" ที่มีความหมายไม่ว่าจะยืนอยู่ตรงไหน */
function workContext(model = {}, now = null) {
  return {
    title: model.title || '', author: model.author || '',
    project: model.project || model.title || '', book: model.book || '',
    language: model.language || '', appVersion: model.appVersion || '',
    now: now || null,
  };
}

/** ส่วนร่วมของทุกบริบท — สถิติรวมทั้งโปรเจกต์ (ผู้เรียกส่งมา ไฟล์นี้ไม่แตะดิสก์เอง) */
function statsContext(stats = {}) {
  const total = stats.totalWords, goal = stats.projectGoal;
  return {
    totalWords: stats.totalWords ?? '', totalScenes: stats.totalScenes ?? '',
    totalChapters: stats.totalChapters ?? '', totalBooks: stats.totalBooks ?? '',
    totalCharacters: stats.totalCharacters ?? '', totalLocations: stats.totalLocations ?? '',
    dailyGoal: stats.dailyGoal ?? '', projectGoal: stats.projectGoal ?? '',
    progress: (Number.isFinite(total) && goal) ? String(Math.min(100, Math.round(total / goal * 100))) : '',
    commentCount: stats.commentCount ?? '',
  };
}

/**
 * บริบทของ "ฉากหนึ่งฉากในเล่มหนึ่งเล่ม" — จุดเดียวที่รู้ว่าโมเดลส่งออกหน้าตาแบบไหน
 * แยกออกมาเป็นฟังก์ชันเพื่อให้ทั้งเวิร์กโฟลว์ส่งออกและเมนูแทรกในตัวแก้ไขใช้ตัวเดียวกัน
 * `stats` (ถ้ามี) = สถิติรวมทั้งโปรเจกต์ — ดู `statsContext()`
 */
export function sceneContext({ model = {}, chapter = null, scene = null,
                               chapterNo = 0, sceneNo = 0, vars = {}, now = null, stats = {} } = {}) {
  const sc = scene || {};
  const ch = chapter || {};
  return {
    ...workContext(model, now),
    book: model.book || ch.book || '',
    chapter: ch.title || '', chapterNo: chapterNo || '',
    chapterStatus: statusOf(ch.status), chapterAct: ch.act || '', chapterDate: ch.date || '',
    chapterFlag: yn(ch.isFavorite),
    scene: sc.title || '', sceneNo: sceneNo || '',
    status: statusOf(sc.status), pov: sc.pov || '', synopsis: sc.synopsis || '',
    tags: sc.tags || [],
    emotion: sc.emotion || '', conflict: sc.conflict || '', note: sc.note || '',
    futureNote: sc.futureNote || '', storyDate: sc.storyDate || '',
    color: sc.color || '', flag: yn(sc.flag), locked: yn(sc.locked),
    // scenes.json เก็บจำนวนคำเป็น `wordCount` · โมเดลตอนคอมไพล์คำนวณสดเป็น `words` — รับได้ทั้งคู่
    words: sc.words ?? sc.wordCount ?? 0, chars: sc.chars || 0, pages: model.pages || 0,
    vars: vars || {},
    ...statsContext(stats),
  };
}

/**
 * บริบทของ "เอนทิตี้ Wiki หนึ่งใบ" — คู่ขนานกับ `sceneContext()` แต่สำหรับหน้า Wiki/entity
 * `entity` = JSON ของเอนทิตี้ (`{name, fields, customProperties, relationships, tags, summary}`)
 * `catLabel` = ป้ายหมวดที่แปลแล้ว — ไฟล์นี้ไม่รู้จักตาราง i18n ของหมวด ผู้เรียกต้องส่งมาเอง
 */
export function entityContext({ model = {}, entity = null, cat = '', catLabel = '',
                                vars = {}, stats = {}, now = null } = {}) {
  const e = entity || {};
  const fields = { ...(e.fields || {}), ...(e.customProperties || {}) };
  const relations = {};
  for (const r of e.relationships || []) {
    const role = String(r.role || '').trim().toLowerCase();
    if (!role) continue;
    (relations[role] = relations[role] || []).push(r.target || '');
  }
  return {
    ...workContext(model, now),
    vars: vars || {},
    entity: e.name || '', entityCat: catLabel || cat || '',
    entitySummary: e.summary || '',
    entityTags: Array.isArray(e.tags) ? e.tags.filter(Boolean).join(', ') : '',
    entityFields: fields, entityRelations: relations,
    ...statsContext(stats),
  };
}
