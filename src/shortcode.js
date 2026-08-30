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

/** วันที่ในรูปแบบที่ขอ — `iso` (2026-08-30) · `year` · ไม่ระบุ = ตามเครื่อง */
export function formatDate(d, fmt) {
  // ไม่ได้ส่งวันที่มา = ไม่มีวันที่ **ไม่ใช่** 1 ม.ค. 1970 (`new Date(0)`) — เคยพลาดตรงนี้ในเทส
  if (d === undefined || d === null || d === '') return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return '';
  const p2 = (n) => String(n).padStart(2, '0');
  if (fmt === 'iso') return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
  if (fmt === 'year') return String(dt.getFullYear());
  if (fmt === 'time') return `${p2(dt.getHours())}:${p2(dt.getMinutes())}`;
  try { return dt.toLocaleDateString(); } catch { return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`; }
}

// **คำอธิบายเขียนเป็น `t('คีย์ตรง ๆ')` ในตาราง ห้ามต่อสตริง** — ประตูกันพลาดของระบบภาษา
// (`test/i18n-keys.test.cjs`) กวาดหา `t('…')` ด้วย regex · `t('ui.shortcode.d' + name)`
// จะถูกอ่านเป็นคีย์ `ui.shortcode.d` แล้วเทสแดงทันทีทั้งที่คีย์จริงมีครบ
export const SHORTCODES = [
  // ── งาน ──
  { name: 'title',    group: 'work', label: t('ui.shortcode.dtitle'),   get: (c) => str(c.title) },
  { name: 'author',   group: 'work', label: t('ui.shortcode.dauthor'),  get: (c) => str(c.author) },
  { name: 'project',  group: 'work', label: t('ui.shortcode.dproject'), get: (c) => str(c.project) },
  { name: 'book',     group: 'work', label: t('ui.shortcode.dbook'),    get: (c) => str(c.book) },
  // ── ที่ที่โค้ดนี้ยืนอยู่ ──
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
  // ── ตัวเลข ──
  { name: 'words',    group: 'num', label: t('ui.shortcode.dwords'), get: (c) => str(c.words) },
  { name: 'chars',    group: 'num', label: t('ui.shortcode.dchars'), get: (c) => str(c.chars) },
  { name: 'pages',    group: 'num', label: t('ui.shortcode.dpages'), get: (c) => str(c.pages) },
  // ── เวลา ──
  { name: 'date',     group: 'time', label: t('ui.shortcode.ddate'),
    get: (c, sc) => formatDate(c.now, sc.opts.fmt || sc.arg) },
  // ── ข้อมูลจาก Wiki (ใช้ตารางเดียวกับ {{ตัวแปร}} — ไม่มีแหล่งข้อมูลซ้อน) ──
  { name: 'wiki',     group: 'wiki', label: t('ui.shortcode.dwiki'),
    get: (c, sc) => str((c.vars || {})[sc.arg]) },
  { name: 'var',      group: 'wiki', label: t('ui.shortcode.dvar'),
    get: (c, sc) => str((c.vars || {})[sc.arg]) },
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

/**
 * บริบทของ "ฉากหนึ่งฉากในเล่มหนึ่งเล่ม" — จุดเดียวที่รู้ว่าโมเดลส่งออกหน้าตาแบบไหน
 * แยกออกมาเป็นฟังก์ชันเพื่อให้ทั้งเวิร์กโฟลว์ส่งออกและเมนูแทรกในตัวแก้ไขใช้ตัวเดียวกัน
 */
export function sceneContext({ model = {}, chapter = null, scene = null,
                               chapterNo = 0, sceneNo = 0, vars = {}, now = null } = {}) {
  const sc = scene || {};
  const ch = chapter || {};
  return {
    title: model.title || '', author: model.author || '', project: model.project || model.title || '',
    book: model.book || ch.book || '',
    chapter: ch.title || '', chapterNo: chapterNo || '',
    scene: sc.title || '', sceneNo: sceneNo || '',
    status: sc.status || '', pov: sc.pov || '', synopsis: sc.synopsis || '',
    tags: sc.tags || [],
    words: sc.words || 0, chars: sc.chars || 0, pages: model.pages || 0,
    vars: vars || {}, now: now || null,
  };
}
