// disk-names.js — [alpha.170] "ชื่อบนดิสก์" ของ เล่ม · บท · ฉาก (บริสุทธิ์ 100% — ไม่ import อะไรเลย)
//
// ══ โมเดล ══
//   ตัวตน   = guid/id ใน JSON            (section.json · draft.json · scenes.json)
//   ลำดับ   = `order` ใน JSON            (ชื่อไฟล์/โฟลเดอร์ **ไม่มีเลขกำกับ** — ผู้ใช้อยากใส่ก็พิมพ์เองในชื่อ)
//   ชื่อ    = `title` ใน JSON            (ข้อความที่ผู้ใช้พิมพ์ — มี : ? / ได้)
//   บนดิสก์ = `folderName` / `fileName`  = diskBase(title) (+ " 2" " 3" เมื่อชื่อชน)
//
// ══ เปลี่ยนชื่อจากนอกโปรแกรม (Explorer/Finder) ══
// JSON ยังชี้ชื่อเก่า → บนดิสก์ "ของที่ทะเบียนชี้หาย" คู่กับ "ของที่ไม่มีใครชี้โผล่" ·
// `pairSceneRenames` / `pairChapterRenames` จับคู่สองฝั่งนี้ แล้วผู้เรียกเขียนชื่อใหม่ลง JSON
// (ชื่อเรื่อง := ชื่อใหม่บนดิสก์ — ผู้ใช้ตั้งใจเปลี่ยนเอง) · จับคู่ไม่ได้ = ปล่อยให้ "ตรวจสุขภาพโปรเจกต์" รายงาน
// ⚠ การตรวจ "ถูกเปลี่ยนชื่อ" ดูจาก **ของหาย + ของโผล่** เท่านั้น ไม่ดูว่าชื่อไฟล์ตรงกับชื่อเรื่องไหม —
//   โปรเจกต์เก่ามี `scene-01.md` ที่ชื่อเรื่องเป็นอย่างอื่นอยู่เต็มไปหมด (ถูกต้อง ไม่ใช่การเปลี่ยนชื่อ)

/** ความยาวสูงสุดของชื่อ (ตัวอักษร) — ทางเต็มมีห้าชั้น ต้องเหลือที่ให้ MAX_PATH ของ Windows */
export const DISK_NAME_MAX = 80;
/** ชื่อเล่มเริ่มต้น — เป็น **ชื่อโฟลเดอร์** จึงเป็นอังกฤษเสมอ ไม่ตามภาษาของหน้าจอ (ผู้ใช้กำหนด) */
export const DEFAULT_BOOK = 'Book';
/** โฟลเดอร์ชั้นบนของโปรเจกต์ที่โปรแกรมใช้เอง — เล่มใช้ชื่อพวกนี้ไม่ได้ (แม้ยังไม่ถูกสร้าง) */
export const RESERVED_ROOT = ['Wiki', 'Bible', 'Images', 'Memos', 'Research', 'Snapshots', '.k2history', 'Plugins',
  'Recycle', 'Sessions', 'Starters', 'Planners', 'Branches', 'FloorPlans', 'OnSet', 'References', 'Models',
  'Backups', 'Draft', 'languages', 'Analysis', 'Dialogues', 'Fonts', 'Skills', '.git'];
/** ชื่อนี้เป็นโฟลเดอร์ของโปรแกรมไหม (ไม่สนตัวพิมพ์) */
export const isReservedRoot = (name) => RESERVED_ROOT.some((r) => nameKey(r) === nameKey(name));

const BAD_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const nfc = (s) => { const v = String(s == null ? '' : s); try { return v.normalize('NFC'); } catch { return v; } };
/** กุญแจเทียบชื่อ — ไม่สนตัวพิมพ์ (Windows/macOS) และรูปแบบ Unicode (macOS คืนชื่อแบบแตกตัว) */
export const nameKey = (s) => nfc(s).toLowerCase();
/** ชื่อเดียวกันเป๊ะไหม (สนตัวพิมพ์ · ไม่สนรูปแบบ Unicode) */
export const sameName = (a, b) => nfc(a) === nfc(b);

/**
 * ชื่อเรื่อง → ชื่อที่ระบบไฟล์รับได้ (กฎของ Windows ชุดเดียวทุกระบบ — โปรเจกต์ย้ายเครื่องได้)
 * อักขระต้องห้ามกลายเป็นวรรค ("บทที่ 1: เริ่ม" → "บทที่ 1 เริ่ม") · จุด/วรรคท้ายชื่อถูกตัด · ชื่อที่ระบบสงวนได้ `_` ต่อท้าย
 */
export function diskBase(title, fallback = 'untitled') {
  let s = nfc(title).replace(BAD_CHARS, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^\.+/, '').replace(/[. ]+$/, '').trim();
  const chars = Array.from(s);
  if (chars.length > DISK_NAME_MAX) s = chars.slice(0, DISK_NAME_MAX).join('').replace(/[. ]+$/, '');
  if (WIN_RESERVED.test(s)) s += '_';
  return s || fallback;
}

/**
 * ชื่อที่ว่างจริง: `base` → `base 2` → `base 3` … (เทียบแบบไม่สนตัวพิมพ์)
 * @param {string} base ชื่อไม่มีนามสกุล · @param {Iterable<string>} taken ชื่อที่ถูกใช้แล้ว (มีนามสกุล) · @param {string} [ext] เช่น '.md'
 */
export function freeName(base, taken, ext = '') {
  const used = new Set();
  for (const n of taken || []) used.add(nameKey(n));
  for (let n = 1; n < 10000; n++) {
    const name = (n === 1 ? base : `${base} ${n}`) + ext;
    if (!used.has(nameKey(name))) return name;
  }
  return base + ' ' + Date.now().toString(36) + ext;
}

/** ชื่อไฟล์ → ชื่อไม่มีนามสกุล */
export const stripExt = (name, ext = '.md') => {
  const s = String(name || '');
  return ext && s.toLowerCase().endsWith(ext.toLowerCase()) ? s.slice(0, -ext.length) : s;
};

/**
 * ชื่อบนดิสก์ "ตรงกับ" ชื่อเรื่องไหม — ตรงเป๊ะ หรือเป็นชื่อเดียวกันที่ต่อเลขกันชน (`ชื่อ 2`)
 * ใช้บอกว่าของเก่า (`scene-01.md` · `01 - บทที่หนึ่ง`) ยังไม่ถูกปรับชื่อ — **ไม่ใช้** ตรวจการเปลี่ยนชื่อจากภายนอก
 */
export function nameFits(title, diskName, ext = '') {
  const want = nameKey(diskBase(title));
  const have = nameKey(stripExt(diskName, ext));
  if (have === want) return true;
  return have.startsWith(want + ' ') && /^\d+$/.test(have.slice(want.length + 1));
}

/**
 * ชื่อเรื่องหลังพบว่าของถูกเปลี่ยนชื่อจากนอกโปรแกรม = **ชื่อใหม่บนดิสก์** (ผู้ใช้ตั้งใจเปลี่ยนเอง)
 * ยกเว้นชื่อแบบเครื่องตั้งของรุ่นเก่าที่ไม่ได้บอกชื่อเรื่อง — คงชื่อเรื่องเดิมไว้:
 *   · ฉาก `scene-05` / `memo-02` (เปลี่ยนแค่เลข)   · บท `02 - <ชื่อเรื่องเดิม>` (เปลี่ยนแค่เลขนำ)
 * @param {'book'|'chapter'|'scene'} kind · @param {string} newBase ชื่อใหม่ (ไม่มีนามสกุล) · @param {string} oldTitle
 */
export function titleAfterRename(kind, newBase, oldTitle) {
  const nb = nfc(newBase);
  const old = String(oldTitle || '');
  if (!old) return nb;
  if (kind === 'scene' && /^(scene|memo)-\d+(-\d+)?$/i.test(nb)) return old;
  if (kind === 'chapter') {
    const m = /^\d+\s*-\s*(.+)$/.exec(nb);
    if (m && nameKey(m[1]) === nameKey(diskBase(old))) return old;
  }
  // ชื่อเรื่องเดิมมีอักขระที่ดิสก์รับไม่ได้ ("บทที่ 1: เริ่ม") แล้วชื่อใหม่ยังเป็นรูปที่ถอดแล้วของมัน = ไม่ได้เปลี่ยนชื่อจริง
  if (nameKey(diskBase(old)) === nameKey(nb) && !sameName(diskBase(old), old)) return old;
  return nb;
}

/** ชื่อเล่มเริ่มต้นที่ยังว่าง: Book 1 · Book 2 · … */
export function defaultBookName(taken) {
  const used = new Set();
  for (const n of taken || []) used.add(nameKey(n));
  for (let n = 1; n < 10000; n++) {
    const name = `${DEFAULT_BOOK} ${n}`;
    if (!used.has(nameKey(name))) return name;
  }
  return DEFAULT_BOOK + ' ' + Date.now().toString(36);
}

/** ชื่อโฟลเดอร์เล่มนี้ใช้ได้ไหม (ไม่ชนโฟลเดอร์อื่นในรากโปรเจกต์ · ไม่ชนโฟลเดอร์ของโปรแกรม) */
export function bookNameTaken(name, rootDirs, selfName = '') {
  const k = nameKey(name);
  if (selfName && k === nameKey(selfName)) return false;
  if (RESERVED_ROOT.some((r) => nameKey(r) === k)) return true;
  return (rootDirs || []).some((d) => nameKey(d) === k);
}

/**
 * เล่ม: โฟลเดอร์ถูกเปลี่ยนชื่อจากนอกโปรแกรมไหม — section.json อยู่ **ในโฟลเดอร์** จึงตามไปเอง
 * เทียบชื่อจริงกับ `folderName` ที่จดไว้ครั้งก่อน · ไม่เคยจด (โปรเจกต์เก่า) = จดอย่างเดียว ไม่แตะชื่อเล่ม
 * @returns {{record:boolean, renamed:boolean, title:string}}
 */
export function sectionSync(meta, actualName) {
  const rec = meta && meta.folderName;
  if (!rec) return { record: true, renamed: false, title: (meta && meta.title) || actualName };
  if (sameName(rec, actualName)) return { record: false, renamed: false, title: meta.title || actualName };
  return { record: true, renamed: true, title: nfc(actualName) };
}

/**
 * ฉากในโฟลเดอร์บทเดียว: จับคู่ "แถวที่ไฟล์หาย" กับ "ไฟล์ที่ไม่มีแถวชี้"
 * ลำดับ: (0) ชื่อเดิมแต่ตัวพิมพ์เปลี่ยน → (1) `title` ใน frontmatter ตรงกับชื่อแถว (หนึ่งต่อหนึ่ง) → (2) เหลือฝั่งละหนึ่ง
 * @param {Array<{id:string,title?:string,fileName?:string}>} rows
 * @param {string[]} files ชื่อไฟล์ .md ที่มีจริงในโฟลเดอร์
 * @param {(file:string) => ({title?:string}|null)} [metaOf] frontmatter ของไฟล์ (ถูกถามเฉพาะไฟล์ที่ไม่มีแถวชี้)
 * @returns {{pairs:Array<{id:string, from:string, to:string, by:string}>, missing:object[], orphans:string[]}}
 */
export function pairSceneRenames(rows, files, metaOf = () => null) {
  const pairs = [];
  const byKey = new Map();
  for (const f of files || []) byKey.set(nameKey(f), f);
  const claimed = new Set();
  let missing = [];
  for (const r of rows || []) {
    if (!r || !r.fileName) continue;
    const k = nameKey(r.fileName);
    const actual = byKey.get(k);
    if (actual === undefined) { missing.push(r); continue; }
    if (claimed.has(k)) continue;                       // สองแถวชี้ไฟล์เดียวกัน — เรื่องของตัวตรวจสุขภาพ
    claimed.add(k);
    if (!sameName(actual, r.fileName)) pairs.push({ id: r.id, from: r.fileName, to: actual, by: 'case' });
  }
  let orphans = (files || []).filter((f) => !claimed.has(nameKey(f)));
  if (missing.length && orphans.length) {
    const titleOf = new Map();
    for (const f of orphans) { let m = null; try { m = metaOf(f); } catch { m = null; } titleOf.set(f, m && m.title != null ? String(m.title) : ''); }
    const count = (arr, fn) => { const c = new Map(); for (const x of arr) { const k = fn(x); if (k) c.set(k, (c.get(k) || 0) + 1); } return c; };
    const rowT = count(missing, (r) => String(r.title || ''));
    const fileT = count(orphans, (f) => titleOf.get(f));
    for (const r of [...missing]) {
      const tl = String(r.title || '');
      if (!tl || rowT.get(tl) !== 1 || fileT.get(tl) !== 1) continue;
      const f = orphans.find((x) => titleOf.get(x) === tl);
      pairs.push({ id: r.id, from: r.fileName, to: f, by: 'title' });
      missing = missing.filter((x) => x !== r);
      orphans = orphans.filter((x) => x !== f);
    }
    if (missing.length === 1 && orphans.length === 1) {
      pairs.push({ id: missing[0].id, from: missing[0].fileName, to: orphans[0], by: 'single' });
      missing = []; orphans = [];
    }
  }
  return { pairs, missing, orphans };
}

/**
 * ฉากที่ถูกย้ายข้ามโฟลเดอร์บทจากนอกโปรแกรม: แถวที่ไฟล์หาย (ทุกบท) ↔ ไฟล์ที่ไม่มีแถวชี้ (ทุกบท)
 * จับคู่ด้วย `title` ใน frontmatter เท่านั้น และต้องหนึ่งต่อหนึ่งทั้งฉบับร่าง (ข้ามบทเดาไม่ได้)
 * @param {Array<{chGuid:string, row:object}>} missing · @param {Array<{chGuid:string, file:string, title:string}>} orphans
 * @returns {Array<{id:string, fromCh:string, toCh:string, from:string, to:string}>}
 */
export function pairSceneMoves(missing, orphans) {
  const out = [];
  const cnt = (arr, fn) => { const c = new Map(); for (const x of arr) { const k = fn(x); if (k) c.set(k, (c.get(k) || 0) + 1); } return c; };
  const mT = cnt(missing || [], (m) => String((m.row && m.row.title) || ''));
  const oT = cnt(orphans || [], (o) => String(o.title || ''));
  for (const m of missing || []) {
    const tl = String((m.row && m.row.title) || '');
    if (!tl || mT.get(tl) !== 1 || oT.get(tl) !== 1) continue;
    const o = orphans.find((x) => String(x.title || '') === tl);
    if (!o || o.chGuid === m.chGuid) continue;
    out.push({ id: m.row.id, fromCh: m.chGuid, toCh: o.chGuid, from: m.row.fileName, to: o.file });
  }
  return out;
}

/**
 * บท: จับคู่ "บทที่โฟลเดอร์หาย" กับ "โฟลเดอร์ที่ไม่มีบทชี้" จากหลักฐานข้างใน
 * คะแนน = จำนวนฉากของบทที่ชื่อไฟล์อยู่ในโฟลเดอร์นั้น + จำนวนไฟล์ที่ `title` ตรงกับชื่อฉากของบท
 * ไม่มีหลักฐานเลย (บทว่าง/โฟลเดอร์ว่าง) → จับคู่ได้เฉพาะเมื่อเหลือฝั่งละหนึ่ง
 * @param {Array<{guid:string,title?:string,folderName?:string}>} chapters
 * @param {string[]} folders โฟลเดอร์ที่มีจริงใน Chapters/
 * @param {Object<string, Array<{title?:string,fileName?:string}>>} rowsBy guid → แถวฉาก
 * @param {(folder:string) => string[]} filesOf ชื่อไฟล์ .md ในโฟลเดอร์
 * @param {(folder:string, file:string) => ({title?:string}|null)} [metaOf]
 * @returns {{pairs:Array<{guid:string, from:string, to:string, by:string}>, missing:object[], orphans:string[]}}
 */
export function pairChapterRenames(chapters, folders, rowsBy, filesOf, metaOf = () => null) {
  const pairs = [];
  const byKey = new Map();
  for (const f of folders || []) byKey.set(nameKey(f), f);
  const claimed = new Set();
  let missing = [];
  for (const c of chapters || []) {
    if (!c || !c.folderName) continue;
    const k = nameKey(c.folderName);
    const actual = byKey.get(k);
    if (actual === undefined) { missing.push(c); continue; }
    if (claimed.has(k)) continue;
    claimed.add(k);
    if (!sameName(actual, c.folderName)) pairs.push({ guid: c.guid, from: c.folderName, to: actual, by: 'case' });
  }
  let orphans = (folders || []).filter((f) => !claimed.has(nameKey(f)));
  if (missing.length && orphans.length) {
    const scored = [];
    for (const c of missing) {
      const rows = (rowsBy && rowsBy[c.guid]) || [];
      const fileKeys = new Set(rows.map((r) => nameKey(r.fileName || '')).filter(Boolean));
      const titles = new Set(rows.map((r) => String(r.title || '')).filter(Boolean));
      for (const f of orphans) {
        let score = 0;
        for (const fn of filesOf(f) || []) {
          if (fileKeys.has(nameKey(fn))) { score += 2; continue; }
          let m = null; try { m = titles.size ? metaOf(f, fn) : null; } catch { m = null; }
          if (m && m.title != null && titles.has(String(m.title))) score += 1;
        }
        if (score > 0) scored.push({ c, f, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    for (const s of scored) {
      if (!missing.includes(s.c) || !orphans.includes(s.f)) continue;
      // คะแนนเท่ากันกับคู่อื่นของบทเดียวกัน/โฟลเดอร์เดียวกัน = กำกวม → ไม่เดา
      const tie = scored.some((o) => o !== s && o.score === s.score && (o.c === s.c || o.f === s.f)
        && missing.includes(o.c) && orphans.includes(o.f));
      if (tie) continue;
      pairs.push({ guid: s.c.guid, from: s.c.folderName, to: s.f, by: 'content' });
      missing = missing.filter((x) => x !== s.c);
      orphans = orphans.filter((x) => x !== s.f);
    }
    if (missing.length === 1 && orphans.length === 1) {
      const rows = (rowsBy && rowsBy[missing[0].guid]) || [];
      const files = filesOf(orphans[0]) || [];
      if (!rows.length || !files.length) {
        pairs.push({ guid: missing[0].guid, from: missing[0].folderName, to: orphans[0], by: 'single' });
        missing = []; orphans = [];
      }
    }
  }
  return { pairs, missing, orphans };
}
