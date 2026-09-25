// drop-kit.js — [alpha.167] "หยิบใส่": ภาษากลางของการลากของในโปรแกรมไปวางที่ไหนก็ได้
//
// ผู้ใช้: *"enities สามารถลากจาก explorer มาใส่ที่ไหนก็ได้ ... ถ้าฉากสามารถลากมาได้ เช่น เข้ามาใน
//          editor เป็นการเปิด ลากมาในจุดไหนก็ได้ คำนวนเลยว่า สามารถลากอะไรได้บ้าง ... เรียกว่า หยิบใส่"*
//
// ก่อนรุ่นนี้ทุกแผงอ่าน `dataTransfer` เอง คนละชนิดคนละรูปแบบ (text/k2-scene เป็น JSON ·
// text/k2-book เป็นทางเปล่า · text/k2-gal-image เป็น {paths}) แผงไหนไม่รู้จักชนิดไหนก็ลากใส่ไม่ได้เงียบ ๆ
// → โมดูลนี้แปลงทุกชนิดเป็น "ของชิ้นเดียว" รูปเดียว แล้วทุกปลายทางตัดสินจากตรงนี้
//
// ส่วนบนของไฟล์บริสุทธิ์ 100% (รับของที่หน้าตาเหมือน DataTransfer — unit test ด้วย object ปลอมได้)
// ส่วนล่าง (`bindDropTarget`) แตะ DOM แต่ไม่ import อะไรของแอป

/** ชนิดของที่ลากได้ในโปรแกรม → mime ของมัน (ลำดับ = ลำดับความสำคัญเมื่อมีหลายชนิดในการลากครั้งเดียว) */
export const DROP_MIME = {
  scene:   'text/k2-scene',
  memo:    'text/k2-memo',
  chapter: 'text/k2-chapter',
  entity:  'text/k2-entity',
  gallery: 'text/k2-gal-image',
  image:   'text/k2-image',
  book:    'text/k2-book',
  tab:     'text/k2-tab',
  map:     'text/k2-map',
};
export const DROP_KINDS = Object.keys(DROP_MIME);
const MIME_KIND = Object.fromEntries(Object.entries(DROP_MIME).map(([k, v]) => [v, k]));

/** ชนิดที่นับเป็น "เอกสาร" (เปิดเป็นแท็บได้) */
export const DOC_KINDS = new Set(['scene', 'memo', 'entity', 'tab']);

const typesOf = (dt) => [...((dt && dt.types) || [])];

/** การลากครั้งนี้มีของของโปรแกรมไหม (อ่านได้ตอน dragover — ตอนนั้นเบราว์เซอร์ให้ดูแค่ชนิด ไม่ให้ดูข้อมูล) */
export function dragKinds(dt) {
  const ty = typesOf(dt);
  const out = [];
  for (const k of DROP_KINDS) if (ty.includes(DROP_MIME[k])) out.push(k);
  if (!out.length) {
    if (ty.includes('text/uri-list')) out.push('url');
    else if (ty.includes('Files')) out.push('files');
  }
  return out;
}
export function hasDrag(dt, accept) {
  const ks = dragKinds(dt);
  if (!accept) return ks.length > 0;
  return ks.some((k) => accept.includes(k));
}

function parseJson(s) { try { return JSON.parse(s); } catch { return null; } }
const baseName = (p) => String(p || '').split(/[\\/]/).pop().replace(/\.(md|json)$/i, '');

/**
 * อ่านของที่ถูกวาง → `{ kind, items:[{path, title, ...}] }` · ไม่รู้จัก = null
 * @param accept ชนิดที่ปลายทางรับ (ไม่ส่ง = รับทุกชนิด) — เลือกชนิดแรกตามลำดับของ DROP_MIME ที่ปลายทางรับ
 */
export function readDrop(dt, accept) {
  if (!dt || typeof dt.getData !== 'function') return null;
  const kinds = dragKinds(dt).filter((k) => !accept || accept.includes(k));
  for (const kind of kinds) {
    const got = readKind(dt, kind);
    if (got && got.items.length) return got;
  }
  return null;
}

function readKind(dt, kind) {
  if (kind === 'url') {
    const raw = String(dt.getData('text/uri-list') || '').split(/\r?\n/).map((s) => s.trim())
      .filter((s) => s && !s.startsWith('#'));
    const title = String(dt.getData('text/plain') || '').trim();
    return { kind, items: raw.map((url) => ({ url, title: raw.length === 1 && title && title !== url ? title : url })) };
  }
  if (kind === 'files') {
    const fl = [...((dt.files) || [])];
    return { kind, items: fl.map((f) => ({ path: f.path || '', title: f.name || baseName(f.path) })) };
  }
  const raw = dt.getData(DROP_MIME[kind]);
  if (!raw) return null;
  const j = parseJson(raw);
  if (kind === 'gallery') {
    const paths = (j && Array.isArray(j.paths)) ? j.paths : [];
    return { kind, items: paths.filter(Boolean).map((p) => ({ path: p, rel: p, title: baseName(p) })) };
  }
  if (kind === 'book' || kind === 'tab') {
    const p = j && typeof j === 'object' ? (j.path || j.file) : raw;
    return { kind, items: p ? [{ path: String(p), title: (j && j.title) || baseName(p) }] : [] };
  }
  if (kind === 'map') {
    return { kind, items: j && j.id ? [{ id: j.id, title: j.name || j.title || '' }] : [] };
  }
  if (!j || typeof j !== 'object') return { kind, items: [] };
  // ของชนิดอื่นส่งมาเป็นชิ้นเดียว — ต่อเติมให้ครบรูป (path + title) เสมอ
  const path = j.path || j.file || '';
  const item = { ...j, path, title: j.title || j.name || baseName(path) };
  if (kind === 'image') item.title = j.name || item.title;
  return { kind, items: (path || kind === 'chapter') ? [item] : [] };
}

/** ตั้งข้อมูลการลาก (ทุกแหล่งใหม่ใช้ตัวนี้) — ใส่ text/plain ด้วยเสมอ เพื่อให้ช่องข้อความทั่วไปรับชื่อได้ */
export function setDrag(dt, kind, item, { plain } = {}) {
  if (!dt || !DROP_MIME[kind]) return false;
  dt.setData(DROP_MIME[kind], JSON.stringify(item || {}));
  const text = plain != null ? plain : (item && (item.title || item.name)) || '';
  if (text) { try { dt.setData('text/plain', String(text)); } catch { /* บางชนิดห้ามตั้ง */ } }
  return true;
}

/** ข้อความสั้น ๆ ที่ใช้แทนของชิ้นนี้ในช่องข้อความ (แชท · โน้ต · ค้นหา) */
export function dropText(payload) {
  if (!payload || !payload.items) return '';
  return payload.items.map((it) => it.title || it.url || baseName(it.path)).filter(Boolean).join(', ');
}

// ───────── ส่วนที่แตะ DOM ─────────

/**
 * ผูกปลายทางการวางแบบมาตรฐาน: ไฮไลต์ตอนลากผ่าน · อ่านของเป็นรูปกลาง · เรียก onDrop
 * @param el       กล่องที่รับ
 * @param opts.accept   ชนิดที่รับ (ไม่ส่ง = ทุกชนิดของโปรแกรม)
 * @param opts.onDrop   (payload, event) → ค่าอะไรก็ได้ (async ได้)
 * @param opts.hoverClass คลาสไฮไลต์ (ค่าเริ่มต้น 'k-drop-hot')
 * @param opts.capture  ผูกระยะ capture (ใช้เมื่อข้างในมีตัวรับของตัวเองที่ต้องแย่งก่อน เช่น ProseMirror)
 * คืนฟังก์ชันถอด
 */
export function bindDropTarget(el, opts = {}) {
  if (!el) return () => {};
  const accept = opts.accept || null;
  const hot = opts.hoverClass || 'k-drop-hot';
  const cap = !!opts.capture;
  const ok = (e) => hasDrag(e.dataTransfer, accept) && (!opts.when || opts.when(e));
  const over = (e) => {
    if (!ok(e)) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = opts.effect || 'copy'; } catch {}
    el.classList.add(hot);
  };
  const leave = (e) => { if (!e.relatedTarget || !el.contains(e.relatedTarget)) el.classList.remove(hot); };
  const drop = async (e) => {
    el.classList.remove(hot);
    if (!ok(e)) return;
    const payload = readDrop(e.dataTransfer, accept);
    if (!payload) return;
    e.preventDefault();
    e.stopPropagation();
    try { await opts.onDrop(payload, e); } catch (err) { if (opts.onError) opts.onError(err); }
  };
  el.addEventListener('dragover', over, cap);
  el.addEventListener('dragleave', leave, cap);
  el.addEventListener('drop', drop, cap);
  return () => {
    el.removeEventListener('dragover', over, cap);
    el.removeEventListener('dragleave', leave, cap);
    el.removeEventListener('drop', drop, cap);
  };
}

/** ตำแหน่งการวางเทียบกับกล่อง (0–1) — ใช้กับแผนที่/กระดาน */
export function dropFrac(el, e) {
  const r = el.getBoundingClientRect();
  return { x: r.width ? (e.clientX - r.left) / r.width : 0, y: r.height ? (e.clientY - r.top) / r.height : 0 };
}
