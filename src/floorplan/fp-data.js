// fp-data.js — ตรรกะของผังพื้นที่ (floor plan แบบ Shot Designer) · บริสุทธิ์ 100% (ไม่แตะ DOM/ไฟล์)
//
// ผู้ใช้: "floor plan จะ drag drop enitites ลงไป จากนั้น ก็จะตั้งกล้อง ... entities จะมีระยะสายตา
//          บอกการหันหน้าไปทางไหน มีระบบ timeline ... ให้ดูว่า floor plan นี้ คือจุดไหนของหนัง"
//
// ผังหนึ่งใบ = ไฟล์หนึ่งไฟล์ (`FloorPlans/<id>.json`) ผูกกับฉากได้หนึ่งฉาก (ฉากหนึ่งมีได้หลายผัง)
// หน่วยของโลก = **เมตร** (x ไปขวา · y ลงล่าง · มุมเป็นองศา 0 = หันไปทางขวา หมุนตามเข็มนาฬิกา)
//
// ── จังหวะ (beat) ──
// จังหวะหนึ่ง = ช่วงหนึ่งของหนัง (อ้างอิงบรรทัดของฉาก หรือพิมพ์เอง) + ตำแหน่ง/ทิศของทุกชิ้น ณ ตอนนั้น
// **ไม่คัดลอกทุกชิ้นซ้ำทุกจังหวะ** (ไฟล์บวมตามจำนวนจังหวะ × ชิ้น) — เก็บแบบ "สืบทอดต่อ":
//   ตำแหน่งตั้งต้นอยู่ที่ตัวชิ้นเอง (`obj.x/y/rot`) = จังหวะแรก
//   จังหวะที่ 2 เป็นต้นไปเก็บเฉพาะ "สิ่งที่เปลี่ยน" (`beat.keys[objId] = {x?,y?,rot?,hidden?}`)
//   ตำแหน่งในจังหวะ i = ตั้งต้น + ทุก keys ตั้งแต่จังหวะ 1..i (ของจังหวะหลังทับของจังหวะก่อน)
// → ขยับคนในจังหวะ 3 แล้วจังหวะ 4, 5 ตามไปด้วย (จนกว่าจังหวะนั้นจะมีตำแหน่งของตัวเอง)
// · ลบ/สลับจังหวะ = ถอดเป็นตำแหน่งเต็มทุกจังหวะก่อน แล้วคิด keys ใหม่ (`bakeKeys`) — ตำแหน่งที่เห็นไม่เพี้ยน
import { num, numClamp } from '../num.js';
import { bodyOf, DEFAULT_BODY, lightTypeOf, supportOf, POLY_KINDS } from './fp-gear.js';

export const FP_VERSION = 1;
export const FP_KIND = 'k2-floorplan';
export const FP_DIR = 'FloorPlans';
export const FP_INDEX = 'index.json';
/** ค่าที่ขยับได้ต่อจังหวะ (นอกนั้นเป็นคุณสมบัติคงที่ของชิ้น) */
export const ANIM_KEYS = ['x', 'y', 'rot', 'hidden'];
export const OBJ_TYPES = ['entity', 'camera', 'light', 'shape', 'track'];
/** พิกัดกันค่าเสีย (±5 กม.) — ผืนไม่มีขอบ แต่ค่าหลุดไปไกลขนาดนั้น = ไฟล์เสีย */
const W_LIM = 5000;

let _seq = 0;
export function uid(prefix = 'o') {
  _seq = (_seq + 1) % 1296;
  return prefix + '-' + Date.now().toString(36) + _seq.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 4);
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const wv = (v, d = 0) => r3(numClamp(v, d, -W_LIM, W_LIM));
/** มุมเป็นช่วง (-180, 180] */
export function normAngle(a) {
  let x = num(a, 0) % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return r3(x);
}

// ═══════════════════════ สร้าง ═══════════════════════
export function newBeat(o = {}) {
  return {
    id: uid('b'),
    ref: normRef(o.ref),
    cam: String(o.cam || ''),
    shot: String(o.shot || ''),
    note: String(o.note || ''),
    keys: {},
    prompt: normPrompt(o.prompt),
  };
}
/** prompt ที่ AI เขียนให้จังหวะนี้ (ภาพนิ่ง/วิดีโอ · ผู้ใช้แก้ต่อได้) · hash = ลายนิ้วมือของผัง+บทตอนสร้าง */
function normPrompt(p) {
  if (!p || typeof p !== 'object') return null;
  const image = String(p.image || '').slice(0, 8000), video = String(p.video || '').slice(0, 8000);
  if (!image && !video) return null;
  return { image, video, hash: String(p.hash || ''), at: String(p.at || '') };
}
function normRef(r) {
  if (!r || typeof r !== 'object') return { kind: 'text', text: '' };
  const kind = r.kind === 'scene' ? 'scene' : 'text';
  const out = { kind, text: String(r.text || '').slice(0, 400) };
  if (kind === 'scene') out.nth = Math.max(0, Math.floor(num(r.nth, 0)));
  return out;
}

/** @param scene {id, title, file?} ฉากที่ผังนี้เป็นของ (null = ยังไม่ผูก) */
export function newPlan(name, scene = null) {
  return {
    version: FP_VERSION, kind: FP_KIND,
    id: uid('fp'), name: String(name || ''),
    scene: normScene(scene),
    grid: { on: true, size: 1 },
    bg: null,
    style: '',
    objects: [],
    beats: [newBeat()],
    updated: '',
  };
}
function normScene(s) {
  if (!s || typeof s !== 'object' || !s.id) return null;
  return { id: String(s.id), title: String(s.title || ''), file: String(s.file || '') };
}

const COLORS = ['#d9575e', '#5f9fd9', '#6fae6f', '#d9b757', '#a97fd0', '#d97757', '#7fb8b0'];
/** สีถัดไปที่ยังไม่มีใครใช้ในชนิดนั้น (ตัวละครสองคนไม่ควรสีเดียวกันตั้งแต่ต้น) */
export function nextColor(plan, type) {
  const used = new Set((plan && plan.objects || []).filter((o) => o.type === type).map((o) => o.color));
  return COLORS.find((c) => !used.has(c)) || COLORS[((plan && plan.objects || []).length) % COLORS.length];
}

/** ชื่อกล้องถัดไป A, B, C … (ไม่ซ้ำกับที่มี) */
export function nextCameraLabel(plan) {
  const used = new Set((plan && plan.objects || []).filter((o) => o.type === 'camera').map((o) => o.label));
  for (let i = 0; i < 26; i++) { const c = String.fromCharCode(65 + i); if (!used.has(c)) return c; }
  return 'Z' + ((plan.objects || []).length);
}

/**
 * ชิ้นใหม่ตามชนิด — ค่าตั้งต้นที่ใช้ได้ทันที (กล้อง = FX3 + 35mm บนขาตั้ง · ไฟ = fresnel · ตัวละคร = มองกว้าง 120° ไกล 3 ม.)
 * @param type 'entity'|'camera'|'light'|'shape'|'track'
 */
export function newObject(type, o = {}) {
  const base = { id: uid(type[0]), type, x: wv(o.x), y: wv(o.y), rot: normAngle(o.rot != null ? o.rot : defaultRot(type)),
                 label: String(o.label || ''), color: String(o.color || '') };
  if (type === 'entity') {
    return { ...base, entityFile: String(o.entityFile || ''), cat: String(o.cat || ''), size: num(o.size, 0.35),
             sight: { on: o.sight ? o.sight.on !== false : true, fov: num(o.sight && o.sight.fov, 120), range: num(o.sight && o.sight.range, 3) } };
  }
  if (type === 'camera') {
    const sup = supportOf(o.support || 'tripod');
    return { ...base, body: String(o.body || DEFAULT_BODY), sensorW: num(o.sensorW, 36), lens: num(o.lens, 35),
             range: num(o.range, 8), height: num(o.height, sup.h), angle: String(o.angle || 'eye'),
             support: sup.id, trackId: String(o.trackId || '') };
  }
  if (type === 'light') {
    const lt = lightTypeOf(o.kind || 'fresnel');
    return { ...base, kind: lt.id, watts: num(o.watts, lt.watts), cct: num(o.cct, lt.cct), intensity: num(o.intensity, 100),
             beam: num(o.beam, lt.beam), range: num(o.range, lt.range), height: num(o.height, 2.2),
             diffusion: String(o.diffusion || 'none'), gel: String(o.gel || 'none'), gelColor: String(o.gelColor || '') };
  }
  if (type === 'track') {
    return { ...base, pts: normPts(o.pts && o.pts.length ? o.pts : [{ x: 0, y: 0 }, { x: 3, y: 0 }]) };
  }
  // shape
  const kind = String(o.kind || 'rect');
  const s = { ...base, kind, w: num(o.w, kind === 'door' ? 0.9 : kind === 'window' ? 1.2 : kind === 'text' ? 2 : 1),
              h: num(o.h, kind === 'door' || kind === 'window' ? 0.12 : kind === 'text' ? 0.5 : 1),
              fill: String(o.fill || ''), stroke: String(o.stroke || ''), opacity: numClamp(o.opacity, 1, 0.05, 1),
              text: String(o.text || '') };
  if (POLY_KINDS.has(kind)) { s.pts = normPts(o.pts && o.pts.length ? o.pts : [{ x: 0, y: 0 }, { x: 2, y: 0 }]); s.thick = num(o.thick, kind === 'wall' ? 0.15 : 0.04); }
  return s;
}
function defaultRot(type) { return type === 'camera' ? -90 : type === 'entity' ? 90 : type === 'light' ? -90 : 0; }
function normPts(pts) {
  return (Array.isArray(pts) ? pts : []).filter((p) => p && Number.isFinite(+p.x) && Number.isFinite(+p.y))
    .slice(0, 400).map((p) => ({ x: wv(p.x), y: wv(p.y) }));
}

/**
 * อ่านไฟล์ผังอย่างปลอดภัย — ค่าที่ขาดเติมให้ · ค่าเสียทิ้ง · idempotent (เรียกซ้ำได้ผลเท่าเดิม)
 * คีย์ของจังหวะที่ชี้ชิ้นที่ไม่มีแล้วถูกลบทิ้ง · คีย์ของจังหวะแรกถูกพับเข้าตำแหน่งตั้งต้น
 */
export function normalizePlan(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const out = {
    version: FP_VERSION, kind: FP_KIND,
    id: String(p.id || uid('fp')), name: String(p.name || ''),
    scene: normScene(p.scene),
    grid: { on: !p.grid || p.grid.on !== false, size: numClamp(p.grid && p.grid.size, 1, 0.1, 50) },
    bg: normBg(p.bg),
    style: String(p.style || '').slice(0, 1000),
    objects: [],
    beats: [],
    updated: String(p.updated || ''),
  };
  const seen = new Set();
  for (const o of Array.isArray(p.objects) ? p.objects : []) {
    if (!o || !OBJ_TYPES.includes(o.type) || !o.id || seen.has(String(o.id))) continue;
    const n = newObject(o.type, o);
    n.id = String(o.id);
    if (o.hidden === true) n.hidden = true;
    seen.add(n.id);
    out.objects.push(n);
  }
  const beats = Array.isArray(p.beats) && p.beats.length ? p.beats : [{}];
  for (const b of beats) {
    const nb = newBeat(b);
    if (b && b.id) nb.id = String(b.id);
    for (const [id, k] of Object.entries((b && b.keys) || {})) {
      if (!seen.has(id) || !k || typeof k !== 'object') continue;
      const kk = cleanKey(k);
      if (Object.keys(kk).length) nb.keys[id] = kk;
    }
    out.beats.push(nb);
  }
  // จังหวะแรกไม่มี keys (ตำแหน่งตั้งต้น = ของตัวชิ้น) — ไฟล์ที่แก้มือ/รุ่นอื่นอาจใส่มา → พับเข้าตัวชิ้น
  for (const [id, k] of Object.entries(out.beats[0].keys)) {
    const o = out.objects.find((x) => x.id === id);
    if (o) Object.assign(o, k);
    if (o && o.hidden === false) delete o.hidden;
  }
  out.beats[0].keys = {};
  return out;
}
function cleanKey(k) {
  const o = {};
  if (k.x != null && Number.isFinite(+k.x)) o.x = wv(k.x);
  if (k.y != null && Number.isFinite(+k.y)) o.y = wv(k.y);
  if (k.rot != null && Number.isFinite(+k.rot)) o.rot = normAngle(k.rot);
  if (typeof k.hidden === 'boolean') o.hidden = k.hidden;
  return o;
}
function normBg(b) {
  if (!b || typeof b !== 'object' || !b.image) return null;
  return { image: String(b.image), x: wv(b.x), y: wv(b.y), w: numClamp(b.w, 10, 0.1, W_LIM),
           rot: normAngle(b.rot), opacity: numClamp(b.opacity, 0.7, 0.05, 1), aspect: numClamp(b.aspect, 0, 0, 100) };
}

// ═══════════════════════ ทางไฟล์เอนทิตี้ (ย้ายเครื่อง/ย้ายโฟลเดอร์แล้วต้องยังชี้ถูก) ═══════════════════════
// [alpha.168 · bug hunt] ผังเคยจด `entityFile` เป็นทางเต็มของเครื่อง (`C:\Users\…\Wiki\characters\cat.json`)
// → ย้ายโฟลเดอร์/ซิงก์ Windows ↔ Mac แล้วเปิดหน้า Wiki ไม่ได้ · AI ไม่ได้ข้อมูลตัวละคร · ทางเต็มของเครื่องผู้ใช้
//   ติดไปในคำขอถึง AI ด้วย (บั๊กเดียวกับหมุดแผนที่ที่แก้ใน alpha.167)
// ตอนนี้จดเป็นทางสัมพัทธ์จากรากโปรเจกต์ (`Wiki/characters/cat.json`) · ไฟล์เก่าถูกชี้กลับตอนเปิด (`relinkPlanEntities`)
const fwd = (p) => String(p || '').split('\\').join('/');
export function isAbsPath(p) { return /^([a-zA-Z]:\/|\/)/.test(fwd(p)); }
/** ทางของเอนทิตี้ → ทางสัมพัทธ์จากรากโปรเจกต์ (อยู่นอกโปรเจกต์ = คืนทางเดิมแบบ `/`) */
export function entityRel(file, root) {
  const f = fwd(file), r = fwd(root).replace(/\/+$/, '');
  if (!f) return '';
  if (r && f.toLowerCase().startsWith(r.toLowerCase() + '/')) return f.slice(r.length + 1);
  return f;
}
/**
 * ชี้ทางของเอนทิตี้กลับเข้าโปรเจกต์นี้ — ในโปรเจกต์ = สัมพัทธ์ · นอกโปรเจกต์ (ไฟล์จากเครื่องอื่น) = จับหาง
 * `Wiki|Bible/…` ก่อน แล้วจึงชื่อไฟล์ที่ไม่ซ้ำ · หาไม่เจอ/กำกวม = คืนทางเดิม (ไม่เดา)
 * @param knownRels ทางสัมพัทธ์ของเอนทิตี้ทั้งโปรเจกต์
 */
export function rebaseEntityRel(file, root, knownRels) {
  const rel = entityRel(file, root);
  if (!rel || !isAbsPath(rel)) return rel;
  const known = knownRels || [];
  const tail = /\/((?:Wiki|Bible)\/.+)$/i.exec(rel);
  if (tail) { const hit = known.find((k) => k.toLowerCase() === tail[1].toLowerCase()); if (hit) return hit; }
  const base = rel.split('/').pop().toLowerCase();
  const same = known.filter((k) => k.split('/').pop().toLowerCase() === base);
  return same.length === 1 ? same[0] : rel;
}
/** แปลง `entityFile` ของทุกชิ้นในผังเป็นทางสัมพัทธ์ → จำนวนที่เปลี่ยน (ไม่เปลี่ยนอะไร = ผังเดิมทุกไบต์) */
export function relinkPlanEntities(plan, root, knownRels) {
  let n = 0;
  for (const o of (plan && plan.objects) || []) {
    if (o.type !== 'entity' || !o.entityFile) continue;
    const r = rebaseEntityRel(o.entityFile, root, knownRels);
    if (r !== o.entityFile) { o.entityFile = r; n++; }
  }
  return n;
}

export function objById(plan, id) { return (plan && plan.objects || []).find((o) => o.id === id) || null; }

// ═══════════════════════ ตำแหน่งตามจังหวะ ═══════════════════════
export function basePose(o) { return { x: num(o.x, 0), y: num(o.y, 0), rot: num(o.rot, 0), hidden: !!o.hidden }; }

/** ตำแหน่งของทุกชิ้นในจังหวะ i → Map(id → pose) */
export function posesAt(plan, i) {
  const m = new Map();
  for (const o of plan.objects || []) m.set(o.id, basePose(o));
  const last = Math.min(Math.max(0, Math.floor(num(i, 0))), (plan.beats || []).length - 1);
  for (let b = 1; b <= last; b++) {
    for (const [id, k] of Object.entries(plan.beats[b].keys || {})) {
      const cur = m.get(id);
      if (cur) m.set(id, { ...cur, ...k });
    }
  }
  return m;
}
export function poseAt(plan, id, i) { return posesAt(plan, i).get(id) || null; }
/** ตำแหน่งเต็มของทุกจังหวะ (ใช้ตอนลบ/สลับจังหวะ) */
export function allPoses(plan) {
  const out = [];
  const m = new Map();
  for (const o of plan.objects || []) m.set(o.id, basePose(o));
  (plan.beats || []).forEach((b, i) => {
    if (i > 0) for (const [id, k] of Object.entries(b.keys || {})) { const c = m.get(id); if (c) m.set(id, { ...c, ...k }); }
    out.push(new Map([...m].map(([id, p]) => [id, { ...p }])));
  });
  return out;
}
const sameV = (a, b) => (typeof a === 'boolean' || typeof b === 'boolean') ? !!a === !!b : Math.abs(num(a, 0) - num(b, 0)) < 1e-6;

/**
 * คิด keys ใหม่จากตำแหน่งเต็มของทุกจังหวะ (ตัวกลับของ allPoses) — จังหวะแรก = ตำแหน่งตั้งต้นของตัวชิ้น
 * @param abs Map[] ยาวเท่า plan.beats
 */
export function bakeKeys(plan, abs) {
  if (!abs.length) return plan;
  for (const o of plan.objects) {
    const p0 = abs[0].get(o.id);
    if (!p0) continue;
    o.x = wv(p0.x); o.y = wv(p0.y); o.rot = normAngle(p0.rot);
    if (p0.hidden) o.hidden = true; else delete o.hidden;
  }
  plan.beats.forEach((b, i) => {
    b.keys = {};
    if (i === 0) return;
    for (const o of plan.objects) {
      const a = abs[i - 1].get(o.id), c = abs[i].get(o.id);
      if (!a || !c) continue;
      const k = {};
      for (const f of ANIM_KEYS) if (!sameV(a[f], c[f])) k[f] = f === 'hidden' ? !!c[f] : (f === 'rot' ? normAngle(c[f]) : wv(c[f]));
      if (Object.keys(k).length) b.keys[o.id] = k;
    }
  });
  return plan;
}

/**
 * ขยับ/หมุน/ซ่อนชิ้นหนึ่ง ณ จังหวะ i — จังหวะแรก (หรือไม่มีจังหวะ) = แก้ตำแหน่งตั้งต้น
 * จังหวะหลังจากนั้นที่ไม่มีตำแหน่งของตัวเองตามไปด้วย (สืบทอด) · ค่าที่เท่ากับจังหวะก่อนหน้าไม่ถูกเก็บ
 */
export function setPose(plan, id, i, patch) {
  const o = objById(plan, id);
  if (!o) return false;
  const k = cleanKey(patch || {});
  if (!Object.keys(k).length) return false;
  const bi = Math.min(Math.max(0, Math.floor(num(i, 0))), (plan.beats || []).length - 1);
  if (bi <= 0) {
    Object.assign(o, k);
    if (o.hidden === false) delete o.hidden;
    return true;
  }
  const prev = poseAt(plan, id, bi - 1);
  const b = plan.beats[bi];
  const cur = { ...(b.keys[id] || {}), ...k };
  for (const f of Object.keys(cur)) if (sameV(cur[f], prev[f])) delete cur[f];
  if (Object.keys(cur).length) b.keys[id] = cur; else delete b.keys[id];
  return true;
}

/** ล้างตำแหน่งเฉพาะจังหวะของชิ้นนี้ (กลับไปสืบทอดจากจังหวะก่อน) */
export function clearPoseKey(plan, id, i) {
  const b = (plan.beats || [])[i];
  if (!b || !b.keys[id]) return false;
  delete b.keys[id];
  return true;
}
export function hasKey(plan, id, i) { const b = (plan.beats || [])[i]; return !!(b && b.keys && b.keys[id]); }

/** แทรกจังหวะใหม่ต่อจาก `after` (ตำแหน่งเท่าจังหวะนั้น · กล้องตัวเดิม) → คืนดัชนีของจังหวะใหม่ */
export function insertBeat(plan, after, o = {}) {
  const at = Math.min(Math.max(-1, Math.floor(num(after, plan.beats.length - 1))), plan.beats.length - 1) + 1;
  const abs = allPoses(plan);
  const b = newBeat({ cam: activeCamId(plan, Math.max(0, at - 1)), ...o });
  plan.beats.splice(at, 0, b);
  abs.splice(at, 0, new Map([...(abs[Math.max(0, at - 1)] || new Map())].map(([id, p]) => [id, { ...p }])));
  bakeKeys(plan, abs);
  return at;
}
/** ลบจังหวะ (เหลืออย่างน้อยหนึ่ง) — ตำแหน่งของจังหวะอื่นไม่เปลี่ยน */
export function deleteBeat(plan, i) {
  if ((plan.beats || []).length <= 1 || i < 0 || i >= plan.beats.length) return false;
  const abs = allPoses(plan);
  plan.beats.splice(i, 1);
  abs.splice(i, 1);
  bakeKeys(plan, abs);
  return true;
}
/** สลับจังหวะ i กับจังหวะข้าง ๆ (dir = -1 | 1) → คืนดัชนีใหม่ */
export function moveBeat(plan, i, dir) {
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || i >= plan.beats.length || j >= plan.beats.length) return i;
  const abs = allPoses(plan);
  [plan.beats[i], plan.beats[j]] = [plan.beats[j], plan.beats[i]];
  [abs[i], abs[j]] = [abs[j], abs[i]];
  bakeKeys(plan, abs);
  return j;
}

/** กล้องที่ใช้ในจังหวะ i — จังหวะที่ไม่ได้ระบุใช้ตัวของจังหวะก่อนหน้า (ไม่มีเลย = กล้องตัวแรก) */
export function activeCamId(plan, i) {
  const cams = (plan.objects || []).filter((o) => o.type === 'camera');
  if (!cams.length) return '';
  for (let b = Math.min(i, (plan.beats || []).length - 1); b >= 0; b--) {
    const c = plan.beats[b] && plan.beats[b].cam;
    if (c && cams.some((x) => x.id === c)) return c;
  }
  return cams[0].id;
}

/** ชิ้นที่ขยับระหว่างจังหวะ i-1 → i (ไว้วาดเส้นประบอกการเคลื่อนที่) */
export function movesInto(plan, i) {
  if (i <= 0 || i >= (plan.beats || []).length) return [];
  const a = posesAt(plan, i - 1), b = posesAt(plan, i);
  const out = [];
  for (const o of plan.objects) {
    const p = a.get(o.id), q = b.get(o.id);
    if (!p || !q) continue;
    const moved = Math.hypot(q.x - p.x, q.y - p.y) > 1e-3;
    const turned = Math.abs(normAngle(q.rot - p.rot)) > 0.5;
    if (moved || turned) out.push({ id: o.id, from: p, to: q, moved, turned });
  }
  return out;
}

/** ตำแหน่งระหว่างสองจังหวะ (เล่นภาพเคลื่อนไหว) — หมุนทางสั้น · ซ่อน/แสดงสลับตอนครึ่งทาง */
export function lerpPose(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k,
           rot: normAngle(a.rot + normAngle(b.rot - a.rot) * k), hidden: k < 0.5 ? !!a.hidden : !!b.hidden };
}
export function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// ═══════════════════════ กล้อง · มุมรับภาพ ═══════════════════════
/** มุมรับภาพแนวนอน (องศา) จากความกว้างเซนเซอร์ (มม.) กับความยาวโฟกัส (มม.) */
export function lensFov(sensorW, mm) {
  const w = num(sensorW, 36), f = num(mm, 35);
  if (!(w > 0) || !(f > 0)) return 0;
  return r3((2 * Math.atan(w / (2 * f)) * 180) / Math.PI);
}
export function sensorWOf(cam) {
  const b = bodyOf(cam && cam.body);
  return (b && b.id !== 'custom') ? b.sw : num(cam && cam.sensorW, 36);
}
export function cameraFov(cam) { return lensFov(sensorWOf(cam), cam && cam.lens); }
/** ความยาวโฟกัสที่ให้มุมรับภาพเท่านี้ (ตัวกลับของ lensFov) */
export function lensForFov(sensorW, fovDeg) {
  const a = (numClamp(fovDeg, 60, 1, 179) * Math.PI) / 360;
  return r3(num(sensorW, 36) / (2 * Math.tan(a)));
}
/** เลนส์เทียบฟูลเฟรม (มม.) — ครอปแฟกเตอร์คิดจากเส้นทแยงเซนเซอร์ */
export function equivFF(cam) {
  const b = bodyOf(cam && cam.body);
  const sw = sensorWOf(cam), sh = b && b.id !== 'custom' ? b.sh : sw * (2 / 3);
  const crop = Math.hypot(36, 24) / Math.hypot(sw, sh || sw * 0.667);
  return Math.round(num(cam && cam.lens, 35) * crop);
}

/** มุมรับภาพ/ระยะของชิ้นใด ๆ (กล้อง = เลนส์ · ไฟ = ลำแสง · ตัวละคร = ระยะสายตา) — ไม่มีกรวย = null */
export function coneOf(o) {
  if (!o) return null;
  if (o.type === 'camera') return { fov: cameraFov(o), range: num(o.range, 8) };
  if (o.type === 'light') return { fov: numClamp(o.beam, 30, 1, 360), range: num(o.range, 5) };
  if (o.type === 'entity' && o.sight && o.sight.on !== false) return { fov: numClamp(o.sight.fov, 120, 1, 360), range: num(o.sight.range, 3) };
  return null;
}

/** เส้นรอบกรวย (SVG path `d`) — มุมตั้งแต่ 359° ขึ้นไป = วงกลม */
export function conePath(x, y, rot, fov, range) {
  const R = Math.max(0, num(range, 0));
  if (!(R > 0)) return '';
  if (fov >= 359) return `M${r3(x - R)} ${r3(y)}a${r3(R)} ${r3(R)} 0 1 0 ${r3(2 * R)} 0a${r3(R)} ${r3(R)} 0 1 0 ${r3(-2 * R)} 0Z`;
  const a1 = ((rot - fov / 2) * Math.PI) / 180, a2 = ((rot + fov / 2) * Math.PI) / 180;
  const x1 = x + R * Math.cos(a1), y1 = y + R * Math.sin(a1);
  const x2 = x + R * Math.cos(a2), y2 = y + R * Math.sin(a2);
  const large = fov > 180 ? 1 : 0;
  return `M${r3(x)} ${r3(y)}L${r3(x1)} ${r3(y1)}A${r3(R)} ${r3(R)} 0 ${large} 1 ${r3(x2)} ${r3(y2)}Z`;
}

/** จุดอยู่ในกรวยไหม (ระยะไม่เกิน range และมุมไม่เกินครึ่งหนึ่งของ fov) */
export function inCone(pt, pose, fov, range) {
  const dx = pt.x - pose.x, dy = pt.y - pose.y;
  const d = Math.hypot(dx, dy);
  if (d > range + 1e-9) return false;
  if (d < 1e-9 || fov >= 359) return true;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Math.abs(normAngle(ang - pose.rot)) <= fov / 2 + 1e-9;
}

/**
 * ใครอยู่ในภาพของกล้องในจังหวะ i — ตัวละคร/ของจาก Wiki ที่ไม่ได้ซ่อน · เรียงจากใกล้ไปไกล
 * @returns [{id, dist}]
 */
export function framedIds(plan, i, camId) {
  const cam = objById(plan, camId);
  if (!cam || cam.type !== 'camera') return [];
  const poses = posesAt(plan, i);
  const cp = poses.get(cam.id);
  if (!cp || cp.hidden) return [];
  const fov = cameraFov(cam), range = num(cam.range, 8);
  const out = [];
  for (const o of plan.objects) {
    if (o.type !== 'entity') continue;
    const p = poses.get(o.id);
    if (!p || p.hidden) continue;
    if (inCone(p, cp, fov, range)) out.push({ id: o.id, dist: r3(Math.hypot(p.x - cp.x, p.y - cp.y)) });
  }
  return out.sort((a, b) => a.dist - b.dist);
}

/** ใครเห็นใคร — ตัวละคร a มอง b อยู่ไหม (อยู่ในระยะสายตาของ a) */
export function sees(plan, i, aId, bId) {
  const a = objById(plan, aId), poses = posesAt(plan, i);
  const pa = poses.get(aId), pb = poses.get(bId);
  const c = coneOf(a);
  if (!c || !pa || !pb || pa.hidden || pb.hidden) return false;
  return inCone(pb, pa, c.fov, c.range);
}

// ═══════════════════════ เส้นหลายจุด · ราง ═══════════════════════
/** จุดของเส้น (ราง/ผนัง/เส้น) ในพิกัดโลก ณ ตำแหน่ง pose (เลื่อน + หมุนรอบจุดตั้ง) */
export function worldPts(o, pose) {
  const p = pose || basePose(o);
  const a = (num(p.rot, 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return (o.pts || []).map((q) => ({ x: r3(p.x + q.x * c - q.y * s), y: r3(p.y + q.x * s + q.y * c) }));
}
/** จุดบนเส้นที่ใกล้ p ที่สุด → {x, y, seg, t, dist, angle(องศาของช่วงนั้น)} */
export function nearestOnPolyline(pts, p) {
  let best = null;
  for (let i = 0; i + 1 < (pts || []).length; i++) {
    const a = pts[i], b = pts[i + 1];
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy;
    const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2)) : 0;
    const x = a.x + vx * t, y = a.y + vy * t, d = Math.hypot(p.x - x, p.y - y);
    if (!best || d < best.dist) best = { x: r3(x), y: r3(y), seg: i, t: r3(t), dist: r3(d), angle: r3((Math.atan2(vy, vx) * 180) / Math.PI) };
  }
  if (!best && pts && pts.length === 1) best = { x: pts[0].x, y: pts[0].y, seg: 0, t: 0, dist: r3(Math.hypot(p.x - pts[0].x, p.y - pts[0].y)), angle: 0 };
  return best;
}
export function polylineLength(pts) {
  let L = 0;
  for (let i = 0; i + 1 < (pts || []).length; i++) L += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return r3(L);
}
/** กล้องที่ติดราง: ตำแหน่งที่ขอ → จุดบนรางที่ใกล้ที่สุด (ไม่มีราง/รางหาย = ตำแหน่งเดิม) */
export function snapToTrack(plan, cam, want, i) {
  if (!cam || !cam.trackId) return want;
  const tr = objById(plan, cam.trackId);
  if (!tr || tr.type !== 'track') return want;
  const n = nearestOnPolyline(worldPts(tr, poseAt(plan, tr.id, i)), want);
  return n ? { x: n.x, y: n.y } : want;
}

// ═══════════════════════ กรอบ · พอดีจอ ═══════════════════════
/** กรอบของทุกอย่างในจังหวะ i (รวมรูปพื้นหลัง · กรวยของกล้อง) — ไม่มีอะไรเลย = กรอบ 10×6 ม. รอบจุดศูนย์ */
export function planBounds(plan, i = 0, { cones = true } = {}) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  const poses = posesAt(plan, i);
  for (const o of plan.objects || []) {
    const p = poses.get(o.id);
    if (!p) continue;
    if (o.pts) for (const q of worldPts(o, p)) add(q.x, q.y);
    else if (o.type === 'shape') { const r = Math.hypot(num(o.w, 1), num(o.h, 1)) / 2; add(p.x - r, p.y - r); add(p.x + r, p.y + r); }
    else add(p.x, p.y);
    if (cones && o.type === 'camera') {
      const c = coneOf(o);
      const a = (p.rot * Math.PI) / 180;
      add(p.x + Math.cos(a) * c.range * 0.6, p.y + Math.sin(a) * c.range * 0.6);
    }
  }
  const bg = plan.bg;
  if (bg && bg.aspect > 0) { add(bg.x, bg.y); add(bg.x + bg.w, bg.y + bg.w / bg.aspect); }
  if (!Number.isFinite(x0)) return { x0: -5, y0: -3, x1: 5, y1: 3 };
  const pad = Math.max(1, Math.max(x1 - x0, y1 - y0) * 0.08);
  return { x0: r3(x0 - pad), y0: r3(y0 - pad), x1: r3(x1 + pad), y1: r3(y1 + pad) };
}
/** กล้องมุมมอง (ซูม px/ม. + จุดกลาง) ที่เห็นกรอบนี้ทั้งหมดในช่องขนาด w×h */
export function fitView(b, w, h, { min = 4, max = 400 } = {}) {
  const bw = Math.max(0.5, b.x1 - b.x0), bh = Math.max(0.5, b.y1 - b.y0);
  const z = Math.max(min, Math.min(max, Math.min((w || 1) / bw, (h || 1) / bh)));
  return { z: r3(z), cx: r3((b.x0 + b.x1) / 2), cy: r3((b.y0 + b.y1) / 2) };
}
/** ซูมยึดจุดบนจอ (px) — จุดโลกใต้เคอร์เซอร์อยู่ที่เดิม */
export function zoomAt(view, z2, sx, sy, w, h) {
  const wx = view.cx + (sx - w / 2) / view.z, wy = view.cy + (sy - h / 2) / view.z;
  return { z: z2, cx: r3(wx - (sx - w / 2) / z2), cy: r3(wy - (sy - h / 2) / z2) };
}
export const FP_ZOOM_MIN = 4, FP_ZOOM_MAX = 400;
export function zoomStepFp(z, dir) { return Math.max(FP_ZOOM_MIN, Math.min(FP_ZOOM_MAX, r3(z * (dir > 0 ? 1.2 : 1 / 1.2)))); }
/** ระยะกริดที่อ่านง่ายตามซูม (ช่องไม่แคบกว่า ~14 px) */
export function gridStep(size, z) {
  let s = numClamp(size, 1, 0.1, 50);
  while (s * z < 14) s *= 2;
  return r3(s);
}

// ═══════════════════════ ดัชนี (ผังจำนวนมาก = อ่านไฟล์เต็มเฉพาะใบที่เปิด) ═══════════════════════
/** แถวในดัชนีของผังหนึ่งใบ — ข้อมูลพอแสดงรายการ/หาผังของฉาก โดยไม่ต้องเปิดไฟล์เต็ม */
export function indexEntry(plan) {
  return { name: String(plan.name || ''), sceneId: plan.scene ? plan.scene.id : '',
           sceneTitle: plan.scene ? plan.scene.title : '', beats: (plan.beats || []).length,
           objects: (plan.objects || []).length, updated: String(plan.updated || '') };
}
export function normalizeIndex(raw) {
  const out = { version: 1, plans: {} };
  const src = raw && raw.plans && typeof raw.plans === 'object' ? raw.plans : {};
  for (const [id, e] of Object.entries(src)) {
    if (!/^[\w-]{1,80}$/.test(id) || !e || typeof e !== 'object') continue;
    out.plans[id] = { name: String(e.name || ''), sceneId: String(e.sceneId || ''), sceneTitle: String(e.sceneTitle || ''),
                      beats: Math.max(0, Math.floor(num(e.beats, 0))), objects: Math.max(0, Math.floor(num(e.objects, 0))),
                      updated: String(e.updated || '') };
  }
  return out;
}
/**
 * เทียบดัชนีกับไฟล์ที่มีจริง (รายชื่อไฟล์อย่างเดียว — ไม่อ่านเนื้อ)
 * @returns {{ missing: string[], stale: string[] }} missing = มีไฟล์แต่ไม่มีในดัชนี (ต้องอ่าน) · stale = ในดัชนีแต่ไฟล์หายแล้ว
 */
export function reconcileIndex(index, fileIds) {
  const have = new Set(fileIds || []);
  const inIdx = new Set(Object.keys((index && index.plans) || {}));
  return { missing: [...have].filter((id) => !inIdx.has(id)), stale: [...inIdx].filter((id) => !have.has(id)) };
}
/** ผังในดัชนีเรียงสำหรับแสดง — ผังของฉาก `sceneId` ขึ้นก่อน แล้วตามชื่อ */
export function listPlans(index, sceneId = '', cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {
  return Object.entries((index && index.plans) || {}).map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => ((b.sceneId === sceneId && sceneId) ? 1 : 0) - ((a.sceneId === sceneId && sceneId) ? 1 : 0)
      || cmp(a.name, b.name) || cmp(a.id, b.id));
}
export function plansForScene(index, sceneId) {
  if (!sceneId) return [];
  return listPlans(index, sceneId).filter((e) => e.sceneId === sceneId);
}
/** ชื่อไฟล์ของผัง (id ผ่านตัวกรองแล้ว — ไม่มีทางหลุดออกนอกโฟลเดอร์) */
export function planFileName(id) { return String(id).replace(/[^\w-]/g, '') + '.json'; }
export function idFromFile(name) { const m = /^([\w-]{1,80})\.json$/i.exec(String(name || '')); return m && m[1].toLowerCase() !== 'index' ? m[1] : null; }
