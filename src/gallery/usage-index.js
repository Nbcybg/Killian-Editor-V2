// usage-index.js — "รูปใบนี้ถูกใช้ที่ไหนบ้าง" (alpha.63 · Phase 5)
//
// สแกนไฟล์ .md ทั้งโปรเจกต์หา `![คำบรรยาย](../../Images/xxx.png)` และ `<img src="…">`
// แล้วทำดัชนี **คีย์ด้วยชื่อไฟล์เปล่า** (basename) เพราะแต่ละฉากอ้างรูปด้วยจำนวนชั้น `../` ไม่เท่ากัน
// และรูปย้ายอัลบั้มได้ → path เต็มเชื่อถือไม่ได้ แต่ชื่อไฟล์นิ่งเสมอ (คลังรูปกันชื่อชนอยู่แล้ว)
//
// ส่วนบริสุทธิ์ทั้งหมด ยกเว้น `scanUsage()` ที่รับ `api` (kapi) เข้ามา

import { t, tf } from '../i18n.js';
/** `![alt](path)` — ไม่จับ `\!` ที่ถูก escape */
const MD_IMG = /!\[([^\]]*)\]\(\s*<?([^)>\s]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
const HTML_IMG = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

export const basename = (p) => String(p || '').split(/[\\/]/).pop();

/** ตัดพารามิเตอร์ท้าย URL + ถอด %xx ให้เทียบชื่อไฟล์ไทยได้ */
export function cleanRef(p) {
  let s = String(p || '').split('#')[0].split('?')[0].trim();
  try { s = decodeURIComponent(s); } catch {}
  return s;
}

/** รูปทุกใบที่ถูกอ้างในข้อความ → [{ raw, path, file, alt, line, index }] */
export function extractImageRefs(text) {
  const s = String(text || '');
  const out = [];
  const lineAt = (idx) => s.slice(0, idx).split('\n').length;
  let m;
  MD_IMG.lastIndex = 0;
  while ((m = MD_IMG.exec(s))) {
    if (m.index > 0 && s[m.index - 1] === '\\') continue;
    const path = cleanRef(m[2]);
    if (!path || /^(https?|data):/i.test(path)) continue;
    out.push({ raw: m[0], path, file: basename(path), alt: m[1] || '', line: lineAt(m.index), index: m.index });
  }
  HTML_IMG.lastIndex = 0;
  while ((m = HTML_IMG.exec(s))) {
    const path = cleanRef(m[1]);
    if (!path || /^(https?|data):/i.test(path)) continue;
    out.push({ raw: m[0], path, file: basename(path), alt: '', line: lineAt(m.index), index: m.index });
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * ดัชนีการใช้งาน จากรายการไฟล์ [{ file, title, text, kind }]
 * คืน Map<ชื่อไฟล์รูป, [{ file, title, kind, line, path }]>
 */
export function buildUsageIndex(docs) {
  const idx = new Map();
  for (const d of docs || []) {
    for (const ref of extractImageRefs(d.text)) {
      const key = ref.file;
      if (!idx.has(key)) idx.set(key, []);
      const rows = idx.get(key);
      // ไฟล์เดียวใช้รูปซ้ำหลายครั้ง = นับครั้งเดียวต่อบรรทัด
      if (rows.some((r) => r.file === d.file && r.line === ref.line)) continue;
      rows.push({ file: d.file, title: d.title || basename(d.file), kind: d.kind || 'scene',
                  line: ref.line, path: ref.path });
    }
  }
  return idx;
}

/** จำนวนครั้งที่รูปถูกใช้ */
export function usageCount(index, file) {
  const rows = index && index.get ? index.get(basename(file)) : null;
  return rows ? rows.length : 0;
}

export function usageOf(index, file) {
  const rows = index && index.get ? index.get(basename(file)) : null;
  return rows ? [...rows] : [];
}

/** ข้อความสรุป "ใช้ใน: ฉากที่ 3, ฉากที่ 7" (จำกัดจำนวนที่แสดง) */
export function usageLabel(index, file, max = 3) {
  const rows = usageOf(index, file);
  if (!rows.length) return t('ui.common.notUse');
  const names = [...new Set(rows.map((r) => r.title))];
  const head = names.slice(0, max).join(', ');
  return t('ui.common.use') + head + (names.length > max ? tf('ui.galleryUsageIndex.msg', names.length - max) : '');
}

/** ติดฟิลด์ `uses`/`usedIn` ให้รายการรูป (ตัวกรอง/ตัวเรียงใช้ต่อ) */
export function attachUsage(items, index) {
  return (items || []).map((it) => ({ ...it, uses: usageCount(index, it.file), usedIn: usageOf(index, it.file) }));
}

export function unusedImages(items) { return (items || []).filter((i) => !(i.uses > 0)); }
export function usedImages(items) { return (items || []).filter((i) => i.uses > 0); }

export const USE_FILTERS = [
  { key: 'all',    label: t('ui.common.all') },
  { key: 'used',   label: t('ui.galleryUsageIndex.useDone') },
  { key: 'unused', label: t('ui.common.notUse') },
];

export function filterByUsage(items, mode) {
  if (mode === 'used') return usedImages(items);
  if (mode === 'unused') return unusedImages(items);
  return [...(items || [])];
}

/**
 * แก้ลิงก์ในเนื้อไฟล์ .md เมื่อรูปย้ายอัลบั้ม
 * `oldPath`/`newPath` = path สัมพัทธ์กับ Images/ ('sunset.png' → 'ตัวละคร/sunset.png')
 * เราไม่รู้ว่าไฟล์นั้นอยู่ลึกกี่ชั้น จึงจับที่ **ส่วนท้ายของ path** แล้วต่อของใหม่บนชั้นเดิม
 * คืน { text, changed }
 */
export function rewriteImageRefs(text, oldPath, newPath) {
  const s = String(text || '');
  const oldFile = basename(oldPath);
  const newRel = String(newPath || '');
  if (!oldFile || !newRel) return { text: s, changed: 0 };
  let changed = 0;
  const swap = (p) => {
    const clean = cleanRef(p);
    if (basename(clean) !== oldFile) return null;
    const i = clean.toLowerCase().lastIndexOf('images/');
    if (i < 0) return null;                       // ไม่ได้ชี้เข้าคลังรูป → อย่าไปยุ่ง
    changed++;
    return clean.slice(0, i + 'images/'.length) + newRel;
  };
  let out = s.replace(MD_IMG, (m0, alt, p) => {
    const np = swap(p);
    return np == null ? m0 : `![${alt}](${np})`;
  });
  out = out.replace(HTML_IMG, (m0, p) => {
    const np = swap(p);
    return np == null ? m0 : m0.replace(p, np);
  });
  return { text: out, changed };
}

// ───────────────────────── ชั้นไฟล์ (รับ api = kapi) ─────────────────────────

export const SKIP_DIRS = new Set(['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots',
                                  'Backups', 'Plugins', 'Research', 'Sessions', 'languages', '.git']);

/**
 * ไล่อ่าน .md ทั้งโปรเจกต์แล้วสร้างดัชนีการใช้งาน
 * `titleOf(path, text)` = ตัวตั้งชื่อที่แสดง (ค่าเริ่มต้น = ชื่อไฟล์ไม่มีนามสกุล)
 */
export async function scanUsage(api, root, { titleOf = null, maxFiles = 4000 } = {}) {
  const docs = [];
  let count = 0;
  const walk = async (dir, depth) => {
    if (depth > 8 || count >= maxFiles) return;
    let files = [];
    try { files = (await api.listFiles(dir, '.md')) || []; } catch {}
    for (const f of files) {
      if (count >= maxFiles) return;
      const p = await api.join(dir, f);
      let text = '';
      try { text = await api.readFile(p); } catch { continue; }
      count++;
      docs.push({ file: p, title: titleOf ? titleOf(p, text) : f.replace(/\.md$/i, ''), text });
    }
    let subs = [];
    try { subs = (await api.listDirs(dir)) || []; } catch {}
    for (const s of subs) {
      if (SKIP_DIRS.has(s) || s.startsWith('.')) continue;
      await walk(await api.join(dir, s), depth + 1);
    }
  };
  await walk(root, 0);
  return { index: buildUsageIndex(docs), files: docs.length };
}

/** แก้ลิงก์ในทุกไฟล์ที่ใช้รูปใบนี้ (หลังย้ายอัลบั้ม) → จำนวนไฟล์ที่แก้จริง */
export async function applyRefRewrite(api, index, oldPath, newPath) {
  const rows = usageOf(index, oldPath);
  const files = [...new Set(rows.map((r) => r.file))];
  let n = 0;
  for (const f of files) {
    let text = '';
    try { text = await api.readFile(f); } catch { continue; }
    const r = rewriteImageRefs(text, oldPath, newPath);
    if (r.changed) { await api.writeFile(f, r.text); n++; }
  }
  return n;
}
