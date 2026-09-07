// auto-link.js — เชื่อมโลก (Wiki) เข้ากับเรื่อง (ฉาก) อัตโนมัติ (ข้อ 86)
// pure logic ล้วน (ไม่แตะ DOM/fs) · การอ่านไฟล์อยู่ใน collectEntities/collectScenes ที่รับ io adapter
// spec: docs/86-world-story.md
//
// ดัชนีในหน่วยความจำ:
//   { backlinks:{ entityId:[sceneId…] }, forward:{ sceneId:[entityId…] },
//     hits:{ entityId:{ sceneId:{count,via} } }, builtAt }
// ที่บันทึกถาวร: project.khn.json → backlinks:{ entityId:[sceneIds] }  (ตามข้อกำหนด)

const MIN_TERM = 2;                       // ข้ามชื่อสั้นกว่านี้ — ไทยไม่มีช่องว่าง ชื่อพยางค์เดียวจะแมตช์ลามทั้งเรื่อง
const VIA_RANK = { link: 3, name: 2, alias: 1, stored: 0 };

// ───────── เตรียมข้อความก่อนสแกน ─────────
/** Strip YAML front-matter and code blocks — names in metadata are not mentions. */
export function stripMeta(text) {
  if (!text) return '';
  let t = String(text).replace(/^﻿/, '');
  t = t.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '');   // front-matter หัวไฟล์
  t = t.replace(/```[\s\S]*?```/g, ' ');                        // บล็อกโค้ด
  t = t.replace(/`[^`\n]*`/g, ' ');                             // โค้ดในบรรทัด
  return t;
}

// ───────── คำที่ใช้จับคู่ของเอนทิตี้หนึ่งตัว ─────────
/** @returns {Array<{term:string, via:'name'|'alias'}>} longest first, de-duplicated */
export function entityTerms(entity) {
  if (!entity) return [];
  const seen = new Set();
  const out = [];
  const add = (raw, via) => {
    const term = String(raw || '').trim();
    if (term.length < MIN_TERM) return;                         // สั้นไป → ข้าม
    const k = norm(term);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ term, via });
  };
  add(entity.name, 'name');
  for (const a of entity.aliases || []) add(a, 'alias');
  return out.sort((a, b) => b.term.length - a.term.length);     // ยาวก่อนสั้น
}
const norm = (s) => String(s).trim().toLowerCase();
const isAscii = (s) => /^[\x20-\x7f]+$/.test(s);
const WORD = /[A-Za-z0-9_]/;

// ───────── หาเอนทิตี้ที่ถูกกล่าวถึงในข้อความหนึ่งชิ้น ─────────
/**
 * @param {string} text      raw scene markdown
 * @param {Array}  entities  [{ id, name, aliases }]
 * @returns {Array<{entityId:string, count:number, via:string}>} sorted by count desc
 */
export function extractLinks(text, entities) {
  const body = stripMeta(text);
  if (!body || !entities || !entities.length) return [];
  const used = new Uint8Array(body.length);                     // จองพื้นที่ที่แมตช์แล้ว — กันซ้อนทับ
  const hits = new Map();
  const bump = (id, via) => {
    const cur = hits.get(id);
    if (!cur) hits.set(id, { count: 1, via });
    else { cur.count++; if (VIA_RANK[via] > VIA_RANK[cur.via]) cur.via = via; }
  };
  const free = (a, b) => { for (let i = a; i < b; i++) if (used[i]) return false; return true; };
  const take = (a, b) => { for (let i = a; i < b; i++) used[i] = 1; };

  // 1) ลิงก์ชัดเจน [[ชื่อ]] หรือ [[ชื่อ|ข้อความที่แสดง]] — น้ำหนักสูงสุด
  const byTerm = new Map();
  for (const e of entities) for (const t of entityTerms(e)) if (!byTerm.has(norm(t.term))) byTerm.set(norm(t.term), e.id);
  const linkRx = /\[\[([^\]\n]{1,120})\]\]/g;
  let m;
  while ((m = linkRx.exec(body))) {
    take(m.index, m.index + m[0].length);                       // จองทั้งก้อน ไม่ให้รอบสองนับซ้ำ
    const id = byTerm.get(norm(m[1].split('|')[0]));
    if (id) bump(id, 'link');
  }

  // 2) ชื่อ/นามแฝงที่พิมพ์ตรง ๆ — ยาวก่อนสั้น ไม่ทับซ้อน
  const all = [];
  for (const e of entities) for (const t of entityTerms(e)) all.push({ ...t, id: e.id });
  all.sort((a, b) => b.term.length - a.term.length);
  for (const t of all) {
    const ascii = isAscii(t.term);
    let from = 0, idx;
    while ((idx = body.indexOf(t.term, from)) >= 0) {
      const end = idx + t.term.length;
      from = idx + 1;
      if (!free(idx, end)) continue;
      // อังกฤษเช็คขอบคำ (กัน "cat" ไปโดนใน "category") · ไทยไม่มีช่องว่าง จึงเช็คไม่ได้
      if (ascii && ((idx > 0 && WORD.test(body[idx - 1])) || (end < body.length && WORD.test(body[end])))) continue;
      take(idx, end);
      bump(t.id, t.via);
    }
  }
  return [...hits.entries()].map(([entityId, v]) => ({ entityId, ...v }))
    .sort((a, b) => b.count - a.count || a.entityId.localeCompare(b.entityId));
}

// ───────── ดัชนี ─────────
export function emptyIndex() { return { backlinks: {}, forward: {}, hits: {}, builtAt: 0 }; }

/**
 * Build the whole index.
 * @param {Array} entities [{id,name,aliases}]
 * @param {Array} scenes   [{id,title,chapterId,text}]
 */
export function buildIndex(entities, scenes, now = 0) {
  const idx = emptyIndex();
  for (const s of scenes || []) applyScene(idx, s, entities);
  idx.builtAt = now;
  return idx;
}
/** Re-scan a single scene and patch it into the index (called on every save — O(1) per save). */
export function updateScene(index, scene, entities) {
  const idx = cloneIndex(index);
  removeSceneIn(idx, scene.id);
  applyScene(idx, scene, entities);
  return idx;
}
export function removeScene(index, sceneId) {
  const idx = cloneIndex(index);
  removeSceneIn(idx, sceneId);
  return idx;
}
export function removeEntity(index, entityId) {
  const idx = cloneIndex(index);
  delete idx.backlinks[entityId];
  delete idx.hits[entityId];
  for (const sid of Object.keys(idx.forward)) {
    idx.forward[sid] = idx.forward[sid].filter((e) => e !== entityId);
    if (!idx.forward[sid].length) delete idx.forward[sid];
  }
  return idx;
}
function applyScene(idx, scene, entities) {
  const found = extractLinks(scene.text, entities);
  if (!found.length) return;
  idx.forward[scene.id] = found.map((f) => f.entityId);
  for (const f of found) {
    (idx.backlinks[f.entityId] = idx.backlinks[f.entityId] || []).push(scene.id);
    (idx.hits[f.entityId] = idx.hits[f.entityId] || {})[scene.id] = { count: f.count, via: f.via };
  }
}
function removeSceneIn(idx, sceneId) {
  const prev = idx.forward[sceneId] || [];
  for (const eid of prev) {
    idx.backlinks[eid] = (idx.backlinks[eid] || []).filter((s) => s !== sceneId);
    if (!idx.backlinks[eid].length) delete idx.backlinks[eid];
    if (idx.hits[eid]) { delete idx.hits[eid][sceneId]; if (!Object.keys(idx.hits[eid]).length) delete idx.hits[eid]; }
  }
  delete idx.forward[sceneId];
}

// ───────── แปลงไป-กลับกับ project.khn.json ─────────
/** @returns {{[entityId:string]: string[]}} — the shape stored in project.khn.json */
export function toBacklinks(index) {
  const out = {};
  for (const eid of Object.keys(index.backlinks).sort()) {
    const hits = index.hits[eid] || {};
    out[eid] = [...index.backlinks[eid]].sort(
      (a, b) => ((hits[b] && hits[b].count) || 0) - ((hits[a] && hits[a].count) || 0) || a.localeCompare(b));
  }
  return out;
}
/** Rebuild an index from stored backlinks (counts are unknown → 1, via 'stored'). */
export function fromBacklinks(obj) {
  const idx = emptyIndex();
  for (const eid of Object.keys(obj || {})) {
    const list = [...new Set(obj[eid] || [])];
    if (!list.length) continue;
    idx.backlinks[eid] = list;
    idx.hits[eid] = {};
    for (const sid of list) {
      idx.hits[eid][sid] = { count: 1, via: 'stored' };
      (idx.forward[sid] = idx.forward[sid] || []).push(eid);
    }
  }
  return idx;
}

// ────────────────────────────────────────────────────────────────
// AutoLink — ตัวที่ UI เรียก (จำชื่อฉาก/เอนทิตี้ไว้ตอบกลับพร้อมข้อมูลแสดงผล)
//   const al = new AutoLink({ meta: state.meta });
//   al.build(entities, scenes);
//   al.getBacklinks('characters/cat.json')      → ['sc1','sc7']
//   al.getRelatedScenes('characters/cat.json')  → [{sceneId,count,via,title,chapterId}]
// ────────────────────────────────────────────────────────────────
export class AutoLink {
  constructor({ meta = null, now = () => 0 } = {}) {
    this.meta = meta;
    this.now = now;
    this.index = emptyIndex();
    this.entities = new Map();            // id → entity
    this.scenes = new Map();              // id → { id, title, chapterId }
  }
  build(entities = [], scenes = []) {
    this.entities = new Map(entities.map((e) => [e.id, e]));
    this.scenes = new Map(scenes.map((s) => [s.id, { id: s.id, title: s.title || '', chapterId: s.chapterId || '' }]));
    this.index = buildIndex(entities, scenes, this.now());
    return this.index;
  }
  entityList() { return [...this.entities.values()]; }

  /** Scene ids that mention this entity (the API required by the spec). */
  getBacklinks(entityId) {
    const hits = this.index.hits[entityId] || {};
    return [...(this.index.backlinks[entityId] || [])]
      .sort((a, b) => ((hits[b] && hits[b].count) || 0) - ((hits[a] && hits[a].count) || 0) || a.localeCompare(b));
  }
  /** Same, enriched with scene title/chapter + mention count — what the panel renders. */
  getRelatedScenes(entityId) {
    const hits = this.index.hits[entityId] || {};
    return this.getBacklinks(entityId).map((sceneId) => {
      const s = this.scenes.get(sceneId) || {};
      const h = hits[sceneId] || { count: 0, via: 'stored' };
      return { sceneId, count: h.count, via: h.via, title: s.title || '', chapterId: s.chapterId || '' };
    });
  }
  /** Reverse direction: which entities appear in this scene. */
  getEntitiesInScene(sceneId) { return [...(this.index.forward[sceneId] || [])]; }
  /** Entities that keep showing up in the same scenes (relationship hints). */
  coOccurring(entityId) {
    const mine = new Set(this.index.backlinks[entityId] || []);
    const score = new Map();
    for (const sid of mine) {
      for (const other of this.index.forward[sid] || []) {
        if (other === entityId) continue;
        score.set(other, (score.get(other) || 0) + 1);
      }
    }
    return [...score.entries()].map(([id, shared]) => ({ entityId: id, shared }))
      .sort((a, b) => b.shared - a.shared || a.entityId.localeCompare(b.entityId));
  }

  // ---- อัปเดตทีละชิ้น (ผูกกับคิวงาน ข้อ 88) ----
  updateScene(scene) {
    this.scenes.set(scene.id, { id: scene.id, title: scene.title || '', chapterId: scene.chapterId || '' });
    this.index = updateScene(this.index, scene, this.entityList());
    return this.index;
  }
  removeScene(sceneId) { this.scenes.delete(sceneId); this.index = removeScene(this.index, sceneId); return this.index; }
  removeEntity(entityId) { this.entities.delete(entityId); this.index = removeEntity(this.index, entityId); return this.index; }
  addEntity(entity) { this.entities.set(entity.id, entity); return this.entities.size; }

  // ---- persist ลง project.khn.json (ผู้เรียกค่อย saveProjectMeta()) ----
  persist(meta = this.meta) {
    if (!meta) return null;
    meta.backlinks = toBacklinks(this.index);
    return meta.backlinks;
  }
  load(meta = this.meta) {
    if (!meta || !meta.backlinks) return false;
    this.index = fromBacklinks(meta.backlinks);
    return true;
  }
  stats() {
    const links = Object.values(this.index.hits).reduce((n, m) => n + Object.keys(m).length, 0);
    return { entities: Object.keys(this.index.backlinks).length, scenes: Object.keys(this.index.forward).length, links };
  }
}

// ────────────────────────────────────────────────────────────────
// ตัวช่วยรวบรวมข้อมูลจากโปรเจกต์จริง (io adapter เดียวกับ Kanban)
//   io = { join, readJson, readFile, listDirs, listFiles }  ← ส่ง kapi เข้าไปได้เลย
// ────────────────────────────────────────────────────────────────
const SKIP_DIRS = new Set(['Wiki', 'Bible', 'Images', 'Memos', 'Snapshots', 'Recycle', 'Plugins', 'Trash', '.git']);

/** Read every Wiki/Bible entity. id = "<category>/<file.json>" */
export async function collectEntities(io, root) {
  const out = [];
  for (const base of ['Wiki', 'Bible']) {
    for (const cat of await dirs(io, io.join(root, base))) {
      for (const f of await files(io, io.join(root, base, cat))) {
        if (!f.endsWith('.json')) continue;
        const j = await safe(() => io.readJson(io.join(root, base, cat, f)));
        if (!j) continue;
        out.push({
          id: `${cat}/${f}`, name: j.name || f.replace(/\.json$/, ''),
          aliases: Array.isArray(j.aliases) ? j.aliases : [],
          entityTypeKey: j.entityTypeKey || cat, path: io.join(root, base, cat, f),
        });
      }
    }
  }
  return out;
}
/** Read every scene of every draft: [{ id, title, chapterId, path, text }] */
export async function collectScenes(io, root) {
  const out = [];
  for (const sec of await dirs(io, root)) {
    if (SKIP_DIRS.has(sec)) continue;
    const draftRoot = io.join(root, sec, 'Draft');
    for (const dr of await dirs(io, draftRoot)) {
      const dPath = io.join(draftRoot, dr);
      const draft = await safe(() => io.readJson(io.join(dPath, 'draft.json')));
      const scenes = await safe(() => io.readJson(io.join(dPath, 'scenes.json')));
      if (!scenes || !scenes.chapters) continue;
      const folder = {};
      for (const c of (draft && draft.chapters) || []) folder[c.guid] = c.folderName || c.title || '';
      for (const chapterId of Object.keys(scenes.chapters)) {
        for (const row of scenes.chapters[chapterId] || []) {
          const p = io.join(dPath, 'Chapters', folder[chapterId] || chapterId, row.fileName || `${row.id}.md`);
          const text = await safe(() => io.readFile(p));
          if (text == null) continue;
          out.push({ id: row.id, title: row.title || '', chapterId, path: p, text });
        }
      }
    }
  }
  return out;
}
async function dirs(io, p) { return (await safe(() => io.listDirs(p))) || []; }
async function files(io, p) { return (await safe(() => io.listFiles(p))) || []; }
async function safe(fn) { try { return await fn(); } catch { return null; } }

function cloneIndex(i) { return JSON.parse(JSON.stringify(i || emptyIndex())); }
