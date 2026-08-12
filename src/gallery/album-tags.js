// album-tags.js — ระบบแท็กของคลังรูป (alpha.63 · บริสุทธิ์ 100%)
//
// แท็กเก็บใน `album.json` → `images[<ไฟล์>].tags = ['#ฉาก', '@เอกราช', '~ฉากที่ 3']`
// **3 ชนิด แยกกันด้วยตัวนำหน้า** (เก็บตัวนำหน้าไว้ในสตริงเสมอ — อ่านไฟล์แล้วรู้ชนิดทันที)
//   `#` ทั่วไป   — แท็กอิสระ ผู้ใช้ตั้งเอง
//   `@` เอนทิตี้ — ผูกกับหน้า Wiki (คลิกแล้วเปิดหน้านั้น)
//   `~` ฉาก      — ผูกกับฉาก/ไฟล์ในโปรเจกต์
//
// กติกา: พิมพ์เปล่า ๆ ไม่ใส่ตัวนำหน้า = แท็กทั่วไป (`#`)

import { T } from '../i18n.js';
import { normalizeAlbumDoc, setImageMeta } from './album-core.js';

export const TAG_KINDS = {
  '#': { key: 'plain',  label: T`ทั่วไป`,   icon: 'bookmark' },
  '@': { key: 'entity', label: T`เอนทิตี้`, icon: 'user' },
  '~': { key: 'scene',  label: T`ฉาก`,      icon: 'film' },
};
export const TAG_PREFIXES = Object.keys(TAG_KINDS);

/** ตัวนำหน้าของแท็ก ('#' ถ้าไม่มี) */
export function tagPrefix(tag) {
  const s = String(tag || '');
  return TAG_KINDS[s[0]] ? s[0] : '#';
}

/** ชนิดเป็นคำ ('plain' | 'entity' | 'scene') */
export function tagKind(tag) { return TAG_KINDS[tagPrefix(tag)].key; }

/** ชื่อแท็กโดยไม่มีตัวนำหน้า */
export function tagName(tag) {
  const s = String(tag || '');
  return TAG_KINDS[s[0]] ? s.slice(1) : s;
}

/**
 * ทำให้แท็กอยู่ในรูปมาตรฐาน — คืน '' เมื่อใช้ไม่ได้
 * ตัดช่องว่างหัวท้าย · ยุบช่องว่างซ้ำ · ห้ามมีตัวนำหน้าซ้อน (`##ก` → `#ก`)
 */
export function normalizeTag(raw, defaultPrefix = '#') {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  let pre = TAG_KINDS[defaultPrefix] ? defaultPrefix : '#';
  while (s && TAG_KINDS[s[0]]) { pre = s[0]; s = s.slice(1).trim(); }
  s = s.replace(/\s+/g, ' ').replace(/[,\n\r\t]/g, '').trim();
  if (!s) return '';
  return pre + s.slice(0, 60);
}

/** แยกข้อความ "#ก, @ข ~ค" เป็นรายการแท็ก (ใช้ในช่องกรอกแท็ก) */
export function parseTags(text) {
  const out = [];
  for (const part of String(text || '').split(/[,\n]+/)) {
    for (const piece of part.split(/\s+(?=[#@~])/)) {
      const t = normalizeTag(piece);
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

export function tagsToText(tags) { return (tags || []).join(' '); }

// ───────────────────────── แก้แท็กใน album.json ─────────────────────────

export function addTag(doc, file, tag) {
  const t = normalizeTag(tag);
  if (!t) return normalizeAlbumDoc(doc);
  const d = normalizeAlbumDoc(doc);
  const cur = (d.images[file] && d.images[file].tags) || [];
  if (cur.includes(t)) return d;
  return setImageMeta(d, file, { tags: [...cur, t] });
}

export function removeTag(doc, file, tag) {
  const t = normalizeTag(tag);
  const d = normalizeAlbumDoc(doc);
  const cur = (d.images[file] && d.images[file].tags) || [];
  if (!cur.includes(t)) return d;
  return setImageMeta(d, file, { tags: cur.filter((x) => x !== t) });
}

export function setTags(doc, file, tags) {
  const clean = [];
  for (const raw of tags || []) {
    const t = normalizeTag(raw);
    if (t && !clean.includes(t)) clean.push(t);
  }
  return setImageMeta(normalizeAlbumDoc(doc), file, { tags: clean });
}

/** ติดแท็กเดียวกันให้หลายไฟล์ในอัลบั้มเดียว (batch) */
export function addTagMany(doc, files, tag) {
  let d = normalizeAlbumDoc(doc);
  for (const f of files || []) d = addTag(d, f, tag);
  return d;
}

export function removeTagMany(doc, files, tag) {
  let d = normalizeAlbumDoc(doc);
  for (const f of files || []) d = removeTag(d, f, tag);
  return d;
}

/** เปลี่ยนชื่อแท็กทั้งอัลบั้ม */
export function renameTagIn(doc, from, to) {
  const a = normalizeTag(from), b = normalizeTag(to);
  const d = normalizeAlbumDoc(doc);
  if (!a || !b || a === b) return d;
  let out = d;
  for (const [file, m] of Object.entries(d.images)) {
    if (!m.tags.includes(a)) continue;
    const tags = m.tags.map((t) => (t === a ? b : t)).filter((t, i, arr) => arr.indexOf(t) === i);
    out = setImageMeta(out, file, { tags });
  }
  return out;
}

// ───────────────────────── อ่าน/กรอง ─────────────────────────

/** แท็กทั้งหมดจากรายการรูป → [{tag, kind, count}] เรียงตามจำนวนแล้วชื่อ */
export function getAllTags(items) {
  const m = new Map();
  for (const it of items || []) {
    for (const raw of it.tags || []) {
      const t = normalizeTag(raw);
      if (!t) continue;
      m.set(t, (m.get(t) || 0) + 1);
    }
  }
  return [...m.entries()]
    .map(([tag, count]) => ({ tag, kind: tagKind(tag), name: tagName(tag), count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'th'));
}

/**
 * กรองรูปด้วยแท็ก
 * mode 'and' = ต้องมีครบทุกแท็ก · 'or' = มีสักตัวก็พอ · รายการว่าง = ไม่กรอง
 */
export function filterByTags(items, tags, mode = 'and') {
  const want = (tags || []).map((t) => normalizeTag(t)).filter(Boolean);
  if (!want.length) return [...(items || [])];
  const or = String(mode).toLowerCase() === 'or';
  return (items || []).filter((it) => {
    const has = new Set((it.tags || []).map((t) => normalizeTag(t)));
    return or ? want.some((t) => has.has(t)) : want.every((t) => has.has(t));
  });
}

/** รูปที่ผูกกับเอนทิตี้ Wiki ชื่อนี้ (แท็ก `@ชื่อ`) — หน้า Wiki เรียกใช้ */
export function imagesForEntity(items, entityName) {
  const want = normalizeTag(entityName, '@');
  if (!want) return [];
  return (items || []).filter((it) => (it.tags || []).some((t) => normalizeTag(t) === want));
}

/** รูปที่ผูกกับฉากนี้ (แท็ก `~ชื่อฉาก`) */
export function imagesForScene(items, sceneName) {
  const want = normalizeTag(sceneName, '~');
  if (!want) return [];
  return (items || []).filter((it) => (it.tags || []).some((t) => normalizeTag(t) === want));
}

/** แท็กแนะนำจากชื่อไฟล์ + ชื่ออัลบั้ม (ใช้เป็นค่าตั้งต้นให้ AI/ผู้ใช้) */
export function suggestTags(item, { entities = [] } = {}) {
  const out = [];
  const hay = [item.file || '', item.caption || ''].join(' ').toLowerCase();
  for (const name of entities) {
    if (name && hay.includes(String(name).toLowerCase())) {
      const t = normalizeTag(name, '@');
      if (t && !out.includes(t)) out.push(t);
    }
  }
  if (item.album && item.album !== '_uncategorized') {
    const t = normalizeTag(String(item.album).split('/').pop());
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
