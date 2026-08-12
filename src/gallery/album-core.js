// album-core.js — แกนกลางของ "อัลบั้มรูป" (alpha.63)
//
// โครงไฟล์ใหม่ใน Images/
//   Images/
//   ├── albums.json          รายชื่ออัลบั้มทั้งหมด + เมทาดาทา (ลำดับ/ปก)
//   ├── album.json           เมทาดาทารูปของ "อัลบั้มราก" (= รูปที่วางไว้ใน Images/ ตรง ๆ)
//   ├── images.json          ดัชนีแบน v1 (auto-gen จากทุกอัลบั้ม — ห้ามลบ ให้ v1 อ่านได้)
//   ├── sunset.png           ← รูปเก่าที่อยู่ราก = อัลบั้ม `_uncategorized` (ยังไม่จัดกลุ่ม)
//   └── ตัวละคร/             ← อัลบั้ม = โฟลเดอร์จริง (ซ้อนกันได้ ตัวละคร/เอกราช/ref)
//       ├── album.json       { name, images:{<ไฟล์>:{caption,tags,order,added}}, moodBoard:[] }
//       └── ref-เอกราช.png
//
// **ทำไม `_uncategorized` ถึงไม่ใช่โฟลเดอร์จริง** (ตัดสินใจไว้ตรงนี้ อย่าเปลี่ยนโดยไม่อ่าน):
// ไฟล์ .md ทั้งโปรเจกต์อ้างรูปเป็น path สัมพัทธ์ (`![](../../../Images/sunset.png)`)
// ถ้า migrate แล้ว "ย้ายไฟล์เก่าทุกใบลง _uncategorized/" ลิงก์ในต้นฉบับพังทั้งโปรเจกต์ทันที
// และไฟล์ที่เปิดนอกโปรแกรม (v1 / โปรแกรมอ่าน md อื่น) ก็หารูปไม่เจอด้วย
// → อัลบั้ม `_uncategorized` จึง **ชี้ไปที่ Images/ เอง** · การย้ายไฟล์เกิดเฉพาะตอนผู้ใช้สั่งเอง
//   (แล้ว UI จะเสนอแก้ลิงก์ในไฟล์ .md ให้ตาม — ดู usage-index.js)
//
// โมดูลนี้ **ไม่แตะ DOM** และรับ `api` (kapi หรือของปลอมในเทส) เข้ามาทุกฟังก์ชันที่ยุ่งกับไฟล์
// → unit test รันด้วย node ได้ตรง ๆ

import { T } from '../i18n.js';
export const IMAGES_DIR = 'Images';
export const ALBUMS_JSON = 'albums.json';
export const ALBUM_META = 'album.json';
export const FLAT_JSON = 'images.json';
/** อัลบั้มเริ่มต้นของรูปที่ยังไม่จัดกลุ่ม — ชี้ไปที่ Images/ เอง (ไม่ใช่โฟลเดอร์จริง) */
export const ROOT_ALBUM = '_uncategorized';
export const ROOT_ALBUM_NAME = T`ยังไม่จัดกลุ่ม`;
/** id เทียมของมุมมอง "รูปทั้งหมด" — ไม่มีอยู่ใน albums.json */
export const ALL_ALBUM = '__all__';

export const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i;
export const isImageFile = (name) => IMAGE_RE.test(String(name || ''));

const RESERVED_JSON = new Set([ALBUMS_JSON, ALBUM_META, FLAT_JSON]);

/** นามสกุลไฟล์คู่ที่ถังขยะใช้จำว่าของชิ้นนี้เคยอยู่ไหน — ต้องตรงกับ recycle.js */
export const RESTORE_EXT = '.k2restore.json';

// ───────────────────────── ส่วนบริสุทธิ์: ชื่อ/รหัส/ต้นไม้ ─────────────────────────

/** ชื่ออัลบั้มที่ปลอดภัยกับระบบไฟล์ (คืน '' = ใช้ไม่ได้) */
export function sanitizeAlbumName(name) {
  let s = String(name == null ? '' : name).replace(/[\\/:*?"<>|]/g, '').trim();
  s = s.replace(/^\.+/, '').replace(/\.+$/, '').trim();   // '.' '..' และจุดท้ายชื่อ (Windows)
  if (s === ROOT_ALBUM) return '';
  return s.slice(0, 80);
}

/** id ของอัลบั้ม = path สัมพัทธ์กับ Images/ ('ตัวละคร/เอกราช') · parent ว่าง = ชั้นบนสุด */
export function albumId(parent, name) {
  const p = String(parent || '');
  return p && p !== ROOT_ALBUM ? p + '/' + name : name;
}

export const isRootAlbum = (id) => !id || id === ROOT_ALBUM;

/** path สัมพัทธ์กับ Images/ ของอัลบั้ม — อัลบั้มรากคืน '' (= Images/ เอง) */
export function albumRel(id) { return isRootAlbum(id) || id === ALL_ALBUM ? '' : String(id); }

/** ชื่อที่แสดง (ชั้นสุดท้ายของ id) */
export function albumBaseName(id) {
  if (isRootAlbum(id)) return ROOT_ALBUM_NAME;
  return String(id).split('/').pop();
}

export function albumDepth(id) { return isRootAlbum(id) ? 0 : String(id).split('/').length; }

export function parentOf(id) {
  if (isRootAlbum(id)) return '';
  const parts = String(id).split('/');
  parts.pop();
  return parts.join('/');
}

/** เติมค่าที่ขาดให้เรกคอร์ดอัลบั้ม */
export function normalizeAlbum(a, i = 0) {
  const id = String((a && a.id) || '').replace(/^\/+|\/+$/g, '');
  return {
    id,
    name: String((a && a.name) || albumBaseName(id) || ''),
    parent: a && a.parent != null ? String(a.parent) : parentOf(id),
    order: Number.isFinite(+(a && a.order)) ? +a.order : i,
    cover: (a && a.cover) || '',
    created: +(a && a.created) || 0,
  };
}

/** อ่าน albums.json → อาร์เรย์ที่สะอาด (มีอัลบั้มรากเสมอ · ไม่ซ้ำ · parent ตรงกับ id) */
export function normalizeAlbums(doc) {
  const raw = Array.isArray(doc) ? doc : (doc && Array.isArray(doc.albums) ? doc.albums : []);
  const seen = new Set([ROOT_ALBUM]);
  const out = [{ id: ROOT_ALBUM, name: ROOT_ALBUM_NAME, parent: '', order: -1, cover:
    (raw.find((x) => x && x.id === ROOT_ALBUM) || {}).cover || '', created: 0 }];
  raw.forEach((a, i) => {
    const n = normalizeAlbum(a, i);
    if (!n.id || n.id === ROOT_ALBUM || seen.has(n.id)) return;
    seen.add(n.id);
    out.push(n);
  });
  // อัลบั้มลูกที่ไม่มีพ่อ (ไฟล์ถูกแก้มือ) → ยกขึ้นชั้นบนสุด
  return out.map((a) => (a.parent && !seen.has(a.parent) ? { ...a, parent: '' } : a));
}

/** เรียงพี่น้อง: order ก่อน แล้วค่อยชื่อ (บทเรียน 15 — ห้ามพึ่งชื่อไทยอย่างเดียว) */
export function sortAlbums(list) {
  return [...list].sort((a, b) => {
    if (a.id === ROOT_ALBUM) return -1;
    if (b.id === ROOT_ALBUM) return 1;
    if (a.order !== b.order) return a.order - b.order;
    return String(a.name).localeCompare(String(b.name), 'th');
  });
}

export function childrenOf(list, id) {
  const pid = id === ROOT_ALBUM ? '' : String(id || '');
  return sortAlbums(list.filter((a) => a.id !== ROOT_ALBUM && (a.parent || '') === pid));
}

/** ต้นไม้ [{...album, children:[…]}] เรียงพร้อมใช้วาด sidebar */
export function albumTree(list) {
  const build = (pid) => childrenOf(list, pid).map((a) => ({ ...a, children: build(a.id) }));
  const root = list.find((a) => a.id === ROOT_ALBUM) || normalizeAlbums([])[0];
  return [{ ...root, children: [] }, ...build('')];
}

/** ทุกอัลบั้มใต้ id (ไม่รวมตัวมันเอง) */
export function descendantIds(list, id) {
  if (isRootAlbum(id)) return [];
  const pre = id + '/';
  return list.filter((a) => a.id !== ROOT_ALBUM && a.id.startsWith(pre)).map((a) => a.id);
}

/** เส้นทาง ['ตัวละคร','เอกราช','ref'] สำหรับ breadcrumb */
export function albumBreadcrumb(list, id) {
  if (isRootAlbum(id)) return [{ id: ROOT_ALBUM, name: ROOT_ALBUM_NAME }];
  const parts = String(id).split('/');
  return parts.map((_, i) => {
    const pid = parts.slice(0, i + 1).join('/');
    const a = list.find((x) => x.id === pid);
    return { id: pid, name: (a && a.name) || parts[i] };
  });
}

/** เปลี่ยนชื่ออัลบั้ม (บริสุทธิ์) → { albums, from, to, moves } · moves = คู่ id เก่า→ใหม่ทุกชั้น */
export function renameAlbumIn(list, id, newName) {
  const name = sanitizeAlbumName(newName);
  if (!name || isRootAlbum(id)) return { albums: list, from: id, to: id, moves: [], error: T`ชื่อไม่ถูกต้อง` };
  const cur = list.find((a) => a.id === id);
  if (!cur) return { albums: list, from: id, to: id, moves: [], error: T`ไม่พบอัลบั้ม` };
  const to = albumId(cur.parent, name);
  if (to !== id && list.some((a) => a.id === to)) {
    return { albums: list, from: id, to, moves: [], error: T`มีอัลบั้มชื่อนี้อยู่แล้ว` };
  }
  return { ...retargetIds(list, id, to), from: id, to };
}

/** ย้ายอัลบั้มไปอยู่ใต้อัลบั้มอื่น (บริสุทธิ์) — กันย้ายเข้าไปในลูกตัวเอง */
export function moveAlbumIn(list, id, newParent) {
  const np = newParent === ROOT_ALBUM ? '' : String(newParent || '');
  if (isRootAlbum(id)) return { albums: list, from: id, to: id, moves: [], error: T`ย้ายอัลบั้มรากไม่ได้` };
  if (np === id || descendantIds(list, id).includes(np)) {
    return { albums: list, from: id, to: id, moves: [], error: T`ย้ายเข้าไปในอัลบั้มลูกของตัวเองไม่ได้` };
  }
  const cur = list.find((a) => a.id === id);
  if (!cur) return { albums: list, from: id, to: id, moves: [], error: T`ไม่พบอัลบั้ม` };
  if ((cur.parent || '') === np) return { albums: list, from: id, to: id, moves: [] };
  const to = albumId(np, cur.name);
  if (list.some((a) => a.id === to)) {
    return { albums: list, from: id, to, moves: [], error: T`ปลายทางมีอัลบั้มชื่อนี้อยู่แล้ว` };
  }
  return { ...retargetIds(list, id, to), from: id, to };
}

/** เปลี่ยน id ของอัลบั้ม + ลูกหลานทั้งสาย (ใช้ร่วมกันโดย rename/move) */
function retargetIds(list, from, to) {
  const moves = [{ from, to }];
  const albums = list.map((a) => {
    if (a.id === from) {
      return { ...a, id: to, name: albumBaseName(to), parent: parentOf(to) };
    }
    if (a.id.startsWith(from + '/')) {
      const nid = to + a.id.slice(from.length);
      moves.push({ from: a.id, to: nid });
      return { ...a, id: nid, parent: parentOf(nid) };
    }
    return a;
  });
  return { albums, moves };
}

/** ลบอัลบั้มออกจากรายการ (พร้อมลูกหลาน) → { albums, removed } */
export function removeAlbumIn(list, id) {
  if (isRootAlbum(id)) return { albums: list, removed: [], error: T`ลบอัลบั้มรากไม่ได้` };
  const removed = [id, ...descendantIds(list, id)];
  return { albums: list.filter((a) => !removed.includes(a.id)), removed };
}

/** จัดลำดับพี่น้องใหม่ (ลากสลับใน sidebar) */
export function reorderAlbums(list, id, toIndex) {
  const cur = list.find((a) => a.id === id);
  if (!cur || isRootAlbum(id)) return list;
  const sibs = childrenOf(list, cur.parent || '');
  const from = sibs.findIndex((a) => a.id === id);
  if (from < 0) return list;
  const arr = [...sibs];
  arr.splice(toIndex < 0 ? 0 : Math.min(toIndex, arr.length - 1), 0, arr.splice(from, 1)[0]);
  const order = new Map(arr.map((a, i) => [a.id, i]));
  return list.map((a) => (order.has(a.id) ? { ...a, order: order.get(a.id) } : a));
}

// ───────────────────────── ส่วนบริสุทธิ์: เมทาดาทารูปในอัลบั้ม ─────────────────────────

export function newAlbumDoc(name) {
  return { version: 1, name: String(name || ''), images: {}, moodBoard: [] };
}

/** อ่านเอกสาร album.json ให้อยู่ในรูปมาตรฐานเสมอ (รับของเก่า/ของพัง) */
export function normalizeAlbumDoc(doc, name) {
  const d = doc && typeof doc === 'object' ? doc : {};
  const images = {};
  const src = d.images && typeof d.images === 'object' && !Array.isArray(d.images) ? d.images : {};
  for (const [file, v] of Object.entries(src)) {
    if (!file || RESERVED_JSON.has(file)) continue;
    const m = v && typeof v === 'object' ? v : { caption: String(v || '') };
    images[file] = {
      caption: String(m.caption || ''),
      tags: Array.isArray(m.tags) ? m.tags.map(String).filter(Boolean) : [],
      order: Number.isFinite(+m.order) ? +m.order : 0,
      added: +m.added || 0,
    };
  }
  // รูปแบบอาร์เรย์ (เผื่อผู้ใช้แก้ไฟล์เอง): [{file, caption, tags}]
  if (Array.isArray(d.images)) {
    d.images.forEach((it, i) => {
      if (!it || !it.file) return;
      images[it.file] = { caption: String(it.caption || ''), tags: Array.isArray(it.tags) ? it.tags.map(String) : [],
                          order: Number.isFinite(+it.order) ? +it.order : i, added: +it.added || 0 };
    });
  }
  return {
    version: 1,
    name: String(d.name || name || ''),
    images,
    moodBoard: Array.isArray(d.moodBoard) ? d.moodBoard : [],
  };
}

/** เติมรูปที่มีอยู่จริงบนดิสก์เข้า doc + ตัดรายการที่ไฟล์หายไปแล้ว (คืน doc ใหม่เสมอ) */
export function syncAlbumDoc(doc, filesOnDisk, now = Date.now()) {
  const d = normalizeAlbumDoc(doc);
  const files = (filesOnDisk || []).filter(isImageFile);
  const known = new Set(Object.keys(d.images));
  let order = Object.values(d.images).reduce((m, x) => Math.max(m, x.order || 0), -1);
  const images = {};
  for (const f of files) {
    images[f] = known.has(f) ? d.images[f]
      : { caption: f.replace(/\.[^.]+$/, ''), tags: [], order: ++order, added: now };
  }
  // ชิ้นบนกระดานที่เป็น path (มี '/') = รูปจากอัลบั้มอื่น — ไม่อยู่ในรายชื่อไฟล์ของอัลบั้มนี้
  // จึงต้องเก็บไว้เสมอ (ตัดทิ้งเฉพาะรูปในอัลบั้มนี้เองที่ไฟล์หายไปแล้ว)
  const set = new Set(files);
  const moodBoard = d.moodBoard.filter((it) =>
    it && it.file && (String(it.file).includes('/') || set.has(it.file)));
  return { ...d, images, moodBoard };
}

/** แถวรูปพร้อมใช้ (path = path สัมพัทธ์กับ Images/) */
export function albumEntries(id, doc) {
  const d = normalizeAlbumDoc(doc);
  const rel = albumRel(id);
  return Object.entries(d.images).map(([file, m]) => ({
    file,
    album: isRootAlbum(id) ? ROOT_ALBUM : id,
    path: rel ? rel + '/' + file : file,
    caption: m.caption,
    tags: [...m.tags],
    order: m.order,
    added: m.added,
  })).sort((a, b) => a.order - b.order);
}

export function setImageMeta(doc, file, patch) {
  const d = normalizeAlbumDoc(doc);
  const cur = d.images[file] || { caption: '', tags: [], order: 0, added: 0 };
  return { ...d, images: { ...d.images, [file]: { ...cur, ...patch } } };
}

export function removeImageMeta(doc, file) {
  const d = normalizeAlbumDoc(doc);
  const images = { ...d.images };
  delete images[file];
  return { ...d, images, moodBoard: d.moodBoard.filter((it) => it.file !== file) };
}

/** จัดลำดับรูปเอง (ลากสลับใน grid) — คืน doc ใหม่ที่ order เรียง 0..n-1 ตามรายการที่ส่งมา */
export function reorderImages(doc, files) {
  const d = normalizeAlbumDoc(doc);
  const images = { ...d.images };
  files.forEach((f, i) => { if (images[f]) images[f] = { ...images[f], order: i }; });
  return { ...d, images };
}

// ───────────────────────── ส่วนบริสุทธิ์: ดัชนีแบน v1 ─────────────────────────

/**
 * สร้างเนื้อ images.json จากรายการรูปทุกอัลบั้ม
 * รูปในอัลบั้มรากยังเขียน `file` เป็น "ชื่อไฟล์เปล่า" เหมือน v1 เป๊ะ
 * รูปในอัลบั้มย่อยเขียนเป็น path สัมพัทธ์ + ฟิลด์ `album` (v1 เมินฟิลด์ที่ไม่รู้จัก)
 */
export function flatIndexFrom(entries) {
  return {
    images: entries.map((e) => {
      const row = { file: e.path, caption: e.caption || '' };
      if (e.album && e.album !== ROOT_ALBUM) row.album = e.album;
      if (e.tags && e.tags.length) row.tags = [...e.tags];
      return row;
    }),
  };
}

/** อ่าน images.json เก่า → แผนที่ ชื่อไฟล์ → caption (ใช้ตอน migrate) */
export function captionsFromFlat(doc) {
  const out = {};
  const arr = (doc && Array.isArray(doc.images) ? doc.images : []);
  for (const it of arr) {
    if (!it) continue;
    const f = String(it.file || '');
    if (!f) continue;
    out[f] = String(it.caption || '');
  }
  return out;
}

// ───────────────────────── ส่วนบริสุทธิ์: เรียง / ค้นหา / สถิติ ─────────────────────────

export const SORT_MODES = [
  { key: 'manual', label: T`ลำดับที่จัดเอง` },
  { key: 'name',   label: T`ชื่อไฟล์` },
  { key: 'date',   label: T`วันที่เพิ่ม (ใหม่สุดก่อน)` },
  { key: 'size',   label: T`ขนาดไฟล์ (ใหญ่สุดก่อน)` },
  { key: 'usage',  label: T`จำนวนการใช้งาน` },
];

export function sortImages(items, mode) {
  const arr = [...items];
  const byName = (a, b) => String(a.file).localeCompare(String(b.file), 'th');
  switch (mode) {
    case 'name': return arr.sort(byName);
    case 'date': return arr.sort((a, b) => (b.added || 0) - (a.added || 0) || byName(a, b));
    case 'size': return arr.sort((a, b) => (b.size || 0) - (a.size || 0) || byName(a, b));
    case 'usage': return arr.sort((a, b) => (b.uses || 0) - (a.uses || 0) || byName(a, b));
    default: return arr.sort((a, b) => (a.order || 0) - (b.order || 0) || byName(a, b));
  }
}

/** ค้นจากชื่อไฟล์ / คำบรรยาย / แท็ก / ชื่ออัลบั้ม */
export function searchImages(items, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return [...items];
  return items.filter((it) => {
    const hay = [it.file, it.caption, it.album, ...(it.tags || [])].join(' ').toLowerCase();
    return hay.includes(s);
  });
}

export function formatBytes(n) {
  const b = +n || 0;
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB';
  return (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
}

/** สถิติสำหรับแดชบอร์ด/แถบล่างของคลังรูป */
export function galleryStats(items, albums = []) {
  const total = items.length;
  const used = items.filter((i) => (i.uses || 0) > 0).length;
  const bytes = items.reduce((s, i) => s + (+i.size || 0), 0);
  const tags = new Set();
  for (const i of items) for (const t of i.tags || []) tags.add(t);
  return {
    total,
    used,
    unused: total - used,
    bytes,
    bytesText: formatBytes(bytes),
    albums: Math.max(0, albums.filter((a) => a.id !== ROOT_ALBUM).length),
    tags: tags.size,
  };
}

// ───────────────────────── ชั้นไฟล์ (รับ api = kapi หรือของปลอมในเทส) ─────────────────────────

const J = (api, ...p) => api.join(...p);

export async function imagesDir(api, root) { return J(api, root, IMAGES_DIR); }

/** path เต็มของโฟลเดอร์อัลบั้ม (อัลบั้มราก = Images/ เอง) */
export async function albumDir(api, root, id) {
  const dir = await imagesDir(api, root);
  const rel = albumRel(id);
  if (!rel) return dir;
  return J(api, dir, ...rel.split('/'));
}

async function readJsonSafe(api, file, fallback) {
  try {
    if (!(await api.exists(file))) return fallback;
    return await api.readJson(file);
  } catch { return fallback; }
}

async function writeJson(api, file, data) {
  await api.writeFile(file, JSON.stringify(data, null, 2));
}

/**
 * รายชื่ออัลบั้มทั้งหมด — รวม "โฟลเดอร์ที่ผู้ใช้สร้างเองในดิสก์" ที่ยังไม่มีใน albums.json
 * (หลักของโปรเจกต์: ไฟล์แก้นอกโปรแกรมได้ → ดิสก์เป็นความจริงเสมอ)
 */
export async function listAlbums(api, root) {
  const dir = await imagesDir(api, root);
  const doc = await readJsonSafe(api, await J(api, dir, ALBUMS_JSON), null);
  let albums = normalizeAlbums(doc);
  const known = new Set(albums.map((a) => a.id));
  const walk = async (relParts) => {
    const abs = relParts.length ? await J(api, dir, ...relParts) : dir;
    let subs = [];
    try { subs = (await api.listDirs(abs)) || []; } catch { subs = []; }
    for (const name of [...subs].sort()) {
      if (name.startsWith('.') || name === ROOT_ALBUM) continue;
      const parts = [...relParts, name];
      const id = parts.join('/');
      if (!known.has(id)) {
        known.add(id);
        albums.push(normalizeAlbum({ id, name, parent: parts.slice(0, -1).join('/'), order: albums.length }));
      }
      await walk(parts);
    }
  };
  await walk([]);
  // อัลบั้มที่อยู่ใน albums.json แต่โฟลเดอร์หายไปแล้ว → ตัดทิ้ง (ยกเว้นอัลบั้มราก)
  const alive = [];
  for (const a of albums) {
    if (a.id === ROOT_ALBUM) { alive.push(a); continue; }
    const d = await albumDir(api, root, a.id);
    if (await api.exists(d)) alive.push(a);
  }
  return sortAlbums(alive);
}

export async function saveAlbums(api, root, albums) {
  const dir = await imagesDir(api, root);
  await api.mkdir(dir);
  await writeJson(api, await J(api, dir, ALBUMS_JSON), { version: 1, albums: albums.filter((a) => a.id !== ROOT_ALBUM || a.cover) });
  return albums;
}

export async function readAlbumDoc(api, root, id) {
  const dir = await albumDir(api, root, id);
  const doc = await readJsonSafe(api, await J(api, dir, ALBUM_META), null);
  return normalizeAlbumDoc(doc, albumBaseName(id));
}

export async function writeAlbumDoc(api, root, id, doc) {
  const dir = await albumDir(api, root, id);
  await api.mkdir(dir);
  await writeJson(api, await J(api, dir, ALBUM_META), normalizeAlbumDoc(doc, albumBaseName(id)));
  return doc;
}

/** ไฟล์รูปที่อยู่จริงในโฟลเดอร์อัลบั้ม (ไม่ลงไปในอัลบั้มลูก) */
export async function listAlbumFiles(api, root, id) {
  const dir = await albumDir(api, root, id);
  if (!(await api.exists(dir))) return [];
  const files = (await api.listFiles(dir, '')) || [];
  return files.filter(isImageFile).sort((a, b) => a.localeCompare(b, 'th'));
}

/** รูปในอัลบั้มเดียว (ซิงก์ดิสก์↔album.json ให้อัตโนมัติ แล้วเขียนกลับถ้าเปลี่ยน) */
export async function getAlbumImages(api, root, id, { write = true } = {}) {
  const files = await listAlbumFiles(api, root, id);
  const doc = await readAlbumDoc(api, root, id);
  const synced = syncAlbumDoc(doc, files);
  if (write && JSON.stringify(synced.images) !== JSON.stringify(doc.images)) {
    await writeAlbumDoc(api, root, id, synced);
  }
  return albumEntries(id, synced);
}

/** รูปทั้งโปรเจกต์ (ทุกอัลบั้ม) — ใช้กับมุมมอง "รูปทั้งหมด" และ syncFlatIndex */
export async function allImages(api, root, albums) {
  const list = albums || (await listAlbums(api, root));
  const out = [];
  for (const a of list) out.push(...(await getAlbumImages(api, root, a.id)));
  return out;
}

/** สร้าง images.json ใหม่จากทุกอัลบั้ม (ดัชนีแบน v1) */
export async function syncFlatIndex(api, root, entries) {
  const items = entries || (await allImages(api, root));
  const dir = await imagesDir(api, root);
  await api.mkdir(dir);
  await writeJson(api, await J(api, dir, FLAT_JSON), flatIndexFrom(items));
  return items;
}

/**
 * ย้ายรูปเก่าใน Images/ เข้าอัลบั้ม `_uncategorized` — **ไม่ย้ายไฟล์**
 * (แค่รับรูปที่ยังไม่มีใน album.json เข้าทะเบียน + ดึง caption จาก images.json เดิมมาใช้)
 * คืน { adopted, captions } · เรียกซ้ำได้ ไม่ทำอะไรเพิ่มถ้าเรียบร้อยแล้ว
 */
export async function migrateFromFlat(api, root) {
  const dir = await imagesDir(api, root);
  if (!(await api.exists(dir))) { await api.mkdir(dir); return { adopted: 0, captions: 0 }; }
  const flat = await readJsonSafe(api, await J(api, dir, FLAT_JSON), null);
  const caps = captionsFromFlat(flat);
  const files = await listAlbumFiles(api, root, ROOT_ALBUM);
  const doc = await readAlbumDoc(api, root, ROOT_ALBUM);
  const before = Object.keys(doc.images).length;
  let synced = syncAlbumDoc(doc, files);
  let capsUsed = 0;
  for (const [f, cap] of Object.entries(caps)) {
    const base = f.split('/').pop();
    if (synced.images[base] && cap && !doc.images[base]) {
      synced = setImageMeta(synced, base, { caption: cap });
      capsUsed++;
    }
  }
  synced.name = ROOT_ALBUM_NAME;
  await writeAlbumDoc(api, root, ROOT_ALBUM, synced);
  return { adopted: Object.keys(synced.images).length - before, captions: capsUsed };
}

// ───────────────────────── CRUD อัลบั้ม (แตะไฟล์จริง) ─────────────────────────

export async function createAlbum(api, root, name, parent = '') {
  const clean = sanitizeAlbumName(name);
  if (!clean) throw new Error(T`ชื่ออัลบั้มใช้ไม่ได้`);
  const albums = await listAlbums(api, root);
  const id = albumId(parent, clean);
  if (albums.some((a) => a.id === id)) throw new Error(T`มีอัลบั้มชื่อนี้อยู่แล้ว`);
  const dir = await albumDir(api, root, id);
  await api.mkdir(dir);
  const rec = normalizeAlbum({ id, name: clean, parent: parent === ROOT_ALBUM ? '' : parent,
                               order: childrenOf(albums, parent).length, created: Date.now() });
  const next = [...albums, rec];
  await writeAlbumDoc(api, root, id, newAlbumDoc(clean));
  await saveAlbums(api, root, next);
  return rec;
}

export async function renameAlbum(api, root, id, newName) {
  const albums = await listAlbums(api, root);
  const r = renameAlbumIn(albums, id, newName);
  if (r.error) throw new Error(r.error);
  if (r.to === r.from) return r;
  const from = await albumDir(api, root, r.from);
  const to = await albumDir(api, root, r.to);
  await api.move(from, to);
  const doc = await readAlbumDoc(api, root, r.to);
  await writeAlbumDoc(api, root, r.to, { ...doc, name: albumBaseName(r.to) });
  await saveAlbums(api, root, r.albums);
  return r;
}

export async function moveAlbum(api, root, id, newParent) {
  const albums = await listAlbums(api, root);
  const r = moveAlbumIn(albums, id, newParent);
  if (r.error) throw new Error(r.error);
  if (r.to === r.from) return r;
  await api.move(await albumDir(api, root, r.from), await albumDir(api, root, r.to));
  await saveAlbums(api, root, r.albums);
  return r;
}

/** ลบอัลบั้ม — ย้ายทั้งโฟลเดอร์ไปถังขยะ (ไม่ลบถาวร) */
export async function deleteAlbum(api, root, id, { recycleDir = 'Recycle' } = {}) {
  const albums = await listAlbums(api, root);
  const r = removeAlbumIn(albums, id);
  if (r.error) throw new Error(r.error);
  const src = await albumDir(api, root, id);
  const stamp = Date.now().toString(36);
  const dst = await J(api, root, recycleDir, stamp + '-' + albumBaseName(id));
  if (await api.exists(src)) await api.move(src, dst);
  await saveAlbums(api, root, r.albums);
  // sidecar สำคัญมาก: ถ้าไม่มี ถังขยะจะเดาชนิดไม่ออกแล้วโยนโฟลเดอร์รูปไปกองที่ Memos/
  await writeJson(api, dst + RESTORE_EXT, {
    kind: 'album', root, id,
    albums: albums.filter((a) => r.removed.includes(a.id)),
  });
  return { ...r, movedTo: dst };
}

// ───────────────────────── CRUD รูป (แตะไฟล์จริง) ─────────────────────────

/** เพิ่มไฟล์จากนอกโปรเจกต์เข้าอัลบั้ม → คืนชื่อไฟล์จริงที่ได้ (อาจถูกเติมเลขกันชน) */
export async function addImageFile(api, root, id, srcPath) {
  const dir = await albumDir(api, root, id);
  await api.mkdir(dir);
  const name = await api.copyInto(srcPath, dir);
  let doc = await readAlbumDoc(api, root, id);
  doc = syncAlbumDoc(doc, [...Object.keys(doc.images), name]);
  await writeAlbumDoc(api, root, id, doc);
  return name;
}

/**
 * ย้ายรูปข้ามอัลบั้ม (ย้ายไฟล์จริง + ย้ายเมทาดาทาไปด้วย)
 * คืน { file, oldPath, newPath } — path เป็น path สัมพัทธ์กับ Images/ (ใช้แก้ลิงก์ใน .md ต่อ)
 */
export async function moveImage(api, root, srcAlbum, dstAlbum, file) {
  if (srcAlbum === dstAlbum) return null;
  const sDir = await albumDir(api, root, srcAlbum);
  const dDir = await albumDir(api, root, dstAlbum);
  await api.mkdir(dDir);
  // กันชื่อชนที่ปลายทาง
  let name = file;
  const ext = (file.match(/\.[^.]+$/) || [''])[0];
  const stem = ext ? file.slice(0, -ext.length) : file;
  let n = 1;
  while (await api.exists(await J(api, dDir, name))) name = stem + '-' + n++ + ext;
  await api.move(await J(api, sDir, file), await J(api, dDir, name));

  let sDoc = await readAlbumDoc(api, root, srcAlbum);
  const meta = sDoc.images[file] || { caption: file.replace(/\.[^.]+$/, ''), tags: [], order: 0, added: Date.now() };
  sDoc = removeImageMeta(sDoc, file);
  await writeAlbumDoc(api, root, srcAlbum, sDoc);

  let dDoc = await readAlbumDoc(api, root, dstAlbum);
  const maxOrder = Object.values(dDoc.images).reduce((m, x) => Math.max(m, x.order || 0), -1);
  dDoc = setImageMeta(dDoc, name, { ...meta, order: maxOrder + 1 });
  await writeAlbumDoc(api, root, dstAlbum, dDoc);

  const sRel = albumRel(srcAlbum), dRel = albumRel(dstAlbum);
  return {
    file: name,
    oldPath: sRel ? sRel + '/' + file : file,
    newPath: dRel ? dRel + '/' + name : name,
  };
}

/** ลบรูป — ย้ายไปถังขยะ + ถอนออกจาก album.json */
export async function deleteImage(api, root, id, file, { recycleDir = 'Recycle' } = {}) {
  const dir = await albumDir(api, root, id);
  const src = await J(api, dir, file);
  const dst = await J(api, root, recycleDir, Date.now().toString(36) + '-' + file);
  if (await api.exists(src)) await api.move(src, dst);
  const doc = await readAlbumDoc(api, root, id);
  const meta = (doc && doc.images && doc.images[file]) || null;
  await writeAlbumDoc(api, root, id, removeImageMeta(doc, file));
  // เก็บ caption/แท็ก/ลำดับไว้ด้วย — กู้คืนแล้วต้องได้ของเดิมกลับมา ไม่ใช่แค่ไฟล์เปล่า
  await writeJson(api, dst + RESTORE_EXT, { kind: 'image', root, album: id, file, meta });
  return dst;
}

/**
 * กู้คืนอัลบั้ม/รูปจากถังขยะ — recycle.js เรียกเมื่ออ่าน sidecar แล้วเจอ kind album/image
 * คืน { kind, ... } ที่กู้คืนสำเร็จ หรือ null ถ้าไม่รู้จักชนิด
 */
export async function restoreFromRecycle(api, root, trashPath, info) {
  if (!info) return null;
  if (info.kind === 'album') {
    const parent = parentOf(info.id);
    if (parent) await api.mkdir(await albumDir(api, root, parent));  // อัลบั้มแม่อาจถูกลบไปด้วย
    else await api.mkdir(await imagesDir(api, root));
    await api.move(trashPath, await albumDir(api, root, info.id));
    const cur = await listAlbums(api, root);
    const known = new Set(cur.map((a) => a.id));
    const back = (info.albums || []).filter((a) => a && !known.has(a.id));
    if (back.length) await saveAlbums(api, root, [...cur, ...back]);
    return { kind: 'album', id: info.id };
  }
  if (info.kind === 'image') {
    // อัลบั้มเดิมอาจถูกลบไปแล้ว → คืนลงอัลบั้มราก ดีกว่าโยนทิ้ง
    const albums = await listAlbums(api, root);
    const album = (info.album && albums.some((a) => a.id === info.album)) ? info.album : ROOT_ALBUM;
    const dir = await albumDir(api, root, album);
    await api.mkdir(dir);
    let name = info.file;
    const ext = (name.match(/\.[^.]+$/) || [''])[0];
    const stem = ext ? name.slice(0, -ext.length) : name;
    let n = 1;
    while (await api.exists(await J(api, dir, name))) name = stem + '-' + n++ + ext;
    await api.move(trashPath, await J(api, dir, name));
    const doc = await readAlbumDoc(api, root, album);
    await writeAlbumDoc(api, root, album, setImageMeta(doc, name, info.meta || {}));
    return { kind: 'image', album, file: name };
  }
  return null;
}

/** แก้คำบรรยาย/แท็ก/ลำดับของรูป */
export async function updateImage(api, root, id, file, patch) {
  const doc = await readAlbumDoc(api, root, id);
  const next = setImageMeta(doc, file, patch);
  await writeAlbumDoc(api, root, id, next);
  return next;
}

/** หา path สัมพัทธ์กับ Images/ ของไฟล์ชื่อนี้ (ใช้ตอนไฟล์ .md อ้างชื่อเปล่าแต่รูปย้ายเข้าอัลบั้มแล้ว) */
export async function findImagePath(api, root, fileName, albums) {
  const base = String(fileName || '').split('/').pop();
  const list = albums || (await listAlbums(api, root));
  for (const a of list) {
    const files = await listAlbumFiles(api, root, a.id);
    if (files.includes(base)) {
      const rel = albumRel(a.id);
      return rel ? rel + '/' + base : base;
    }
  }
  return '';
}
