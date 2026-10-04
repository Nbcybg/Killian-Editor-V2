// fp-shot.js — "ข้อเท็จจริงของช็อต" จากผังพื้นที่ + คำขอให้ AI เขียน prompt ภาพนิ่ง/วิดีโอ + shot list
// บริสุทธิ์ 100% (ไม่แตะ DOM/ไฟล์/เน็ต · ข้อความที่คนอ่านรับเข้ามาเป็นพารามิเตอร์) — unit `fp-shot`
//
// ผู้ใช้: "เพิ่ม prompt generate ได้มั้ย โดยอิงจากบท กับ floor plan" → ภาพนิ่ง + วิดีโอ · AI เขียน · อังกฤษ
//
// ผังรู้ "เรขาคณิต" ทั้งหมดของช็อต — ตัวนี้แปลงเป็นข้อมูลที่ AI ใช้ได้ตรง ๆ (ไม่ต้องให้ AI เดาจากพิกัด):
//   ขนาดภาพ (จากระยะ + มุมรับภาพแนวตั้งของเซนเซอร์) · ตำแหน่งในเฟรม (ซ้าย/กลาง/ขวา) · ทิศที่ตัวละครหันเทียบกล้อง ·
//   ทิศของไฟเทียบกล้อง/ตัวแบบ (หน้า/ข้าง/หลัง) · อุ่น/เย็นตาม K · การเคลื่อนของคน/กล้องไปจังหวะถัดไป (สำหรับวิดีโอ)
// ค่าในผลเป็นรหัสภาษาอังกฤษ (ข้อมูล ไม่ใช่ข้อความบนจอ) — ส่งให้ AI เป็น JSON
import { num, hashText } from '../num.js';
import { bodyOf, bodyName, lightTypeOf, supportOf, gelShift } from './fp-gear.js';
import { posesAt, objById, activeCamId, cameraFov, sensorWOf, equivFF, inCone, normAngle, coneOf, worldPts } from './fp-data.js';

const DEG = Math.PI / 180;
const PERSON_H = 1.7;                     // ความสูงคนโดยประมาณ (ม.) — ใช้ประเมินขนาดภาพ
const r1 = (v) => Math.round(v * 10) / 10;
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) / DEG;

/** มุมรับภาพแนวตั้ง (องศา) — ความสูงเซนเซอร์จากบอดี้ (ตั้งเอง = 2:3 ของความกว้าง) */
export function verticalFov(cam) {
  const b = bodyOf(cam && cam.body);
  const sh = b && b.id !== 'custom' ? b.sh : sensorWOf(cam) * (2 / 3);
  const f = num(cam && cam.lens, 35);
  return f > 0 ? (2 * Math.atan(sh / (2 * f))) / DEG : 0;
}

/**
 * ขนาดภาพโดยประมาณ จากความสูงของภาพ ณ ระยะตัวแบบ เทียบความสูงคน
 * @returns 'ews'|'ws'|'fs'|'ms'|'mcu'|'cu'|'ecu'
 */
export function estimateShotSize(cam, dist) {
  const h = 2 * Math.max(0.05, num(dist, 3)) * Math.tan((verticalFov(cam) / 2) * DEG);
  const k = h / PERSON_H;
  if (k >= 6) return 'ews';
  if (k >= 2.2) return 'ws';
  if (k >= 1.15) return 'fs';
  if (k >= 0.6) return 'ms';
  if (k >= 0.38) return 'mcu';
  if (k >= 0.2) return 'cu';
  return 'ecu';
}

/** ตำแหน่งในเฟรม: มุมเบี่ยงจากแกนกล้อง (องศา · บวก = ขวาของภาพ) เทียบครึ่งมุมรับภาพ */
export function frameSide(offsetDeg, fov) {
  const k = offsetDeg / Math.max(1, fov / 2);
  return k < -0.34 ? 'left' : k > 0.34 ? 'right' : 'center';
}

/** ทิศที่ตัวแบบหันเทียบกล้อง: rel = ทิศตัวแบบ − ทิศกล้อง (0 = หันไปทางเดียวกับกล้อง = หันหลังให้กล้อง) */
export function facingToCamera(subjectRot, camRot) {
  const rel = normAngle(subjectRot - camRot);
  const a = Math.abs(rel);
  if (a >= 157.5) return 'toward camera';
  if (a <= 22.5) return 'back to camera';
  const side = rel > 0 ? 'right' : 'left';           // หันไปทางขวา/ซ้ายของภาพ
  if (a >= 112.5) return 'three-quarter toward camera, facing frame ' + side;
  if (a <= 67.5) return 'three-quarter away, facing frame ' + side;
  return 'profile, facing frame ' + side;
}

/** การเคลื่อนที่ในภาพ (เวกเตอร์ในโลก → แกนของกล้อง) */
function moveInFrame(from, to, camRot) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return null;
  const fwd = dx * Math.cos(camRot * DEG) + dy * Math.sin(camRot * DEG);    // + = ห่างกล้อง
  const lat = -dx * Math.sin(camRot * DEG) + dy * Math.cos(camRot * DEG);   // + = ขวาของภาพ
  const parts = [];
  if (Math.abs(fwd) >= 0.25 * d) parts.push(fwd < 0 ? 'toward camera' : 'away from camera');
  if (Math.abs(lat) >= 0.25 * d) parts.push(lat > 0 ? 'to frame right' : 'to frame left');
  return { meters: r1(d), dir: parts.join(' and ') || 'across' };
}

/** การเคลื่อนกล้องจากจังหวะนี้ไปจังหวะถัดไป */
function cameraMove(cam, a, b) {
  if (!a || !b) return { kind: 'static' };
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const turn = normAngle(b.rot - a.rot);
  const out = [];
  if (d >= 0.05) {
    const fwd = (b.x - a.x) * Math.cos(a.rot * DEG) + (b.y - a.y) * Math.sin(a.rot * DEG);
    const lat = -(b.x - a.x) * Math.sin(a.rot * DEG) + (b.y - a.y) * Math.cos(a.rot * DEG);
    const rig = cam.support;
    const verb = rig === 'dolly' || rig === 'slider' ? 'dolly' : rig === 'crane' || rig === 'jib' ? 'crane' : rig === 'drone' ? 'drone move'
      : rig === 'handheld' || rig === 'shoulder' || rig === 'steadicam' || rig === 'gimbal' ? 'follow' : 'move';
    if (Math.abs(fwd) >= Math.abs(lat)) out.push(verb + (fwd > 0 ? ' in' : ' out'));
    else out.push((verb === 'dolly' ? 'truck' : verb) + (lat > 0 ? ' right' : ' left'));
    out.push(r1(d) + 'm');
  }
  if (Math.abs(turn) >= 3) out.push('pan ' + (turn > 0 ? 'right' : 'left') + ' ' + Math.round(Math.abs(turn)) + 'deg');
  return out.length ? { kind: out.join(', ') } : { kind: 'static' };
}

/**
 * ข้อเท็จจริงของช็อตในจังหวะ i (จากกล้องที่ใช้ในจังหวะนั้น)
 * @param names (entityFile) → ชื่อ — ใช้ชื่อจาก Wiki ปัจจุบัน
 * @returns null ถ้ายังไม่มีกล้อง
 */
export function shotFacts(plan, i, names = () => '') {
  const camId = activeCamId(plan, i);
  const cam = objById(plan, camId);
  if (!cam) return null;
  const P = posesAt(plan, i);
  const Pn = i + 1 < plan.beats.length ? posesAt(plan, i + 1) : null;
  const cp = P.get(cam.id);
  const fov = cameraFov(cam), range = num(cam.range, 8);
  const beat = plan.beats[i] || {};
  const body = bodyOf(cam.body);
  const nameOf = (o) => (o.entityFile && names(o.entityFile)) || o.label || '';
  const subjects = [], offscreen = [];
  for (const o of plan.objects) {
    if (o.type !== 'entity') continue;
    const p = P.get(o.id);
    if (!p || p.hidden) continue;
    const name = nameOf(o);
    if (!inCone(p, cp, fov, range)) {
      if (name) offscreen.push(name);
      continue;
    }
    const dist = Math.hypot(p.x - cp.x, p.y - cp.y);
    const off = normAngle(angTo(cp, p) - cp.rot);
    const s = { name, cat: o.cat || '', entityFile: o.entityFile || '', distance: r1(dist),
                size: estimateShotSize(cam, dist), frame: frameSide(off, fov), facing: facingToCamera(p.rot, cp.rot) };
    const q = Pn && Pn.get(o.id);
    if (q) {
      if (q.hidden) s.next = 'exits';
      else {
        const m = moveInFrame(p, q, cp.rot);
        if (m) s.next = 'moves ' + m.meters + 'm ' + m.dir;
        const turn = normAngle(q.rot - p.rot);
        if (Math.abs(turn) >= 20) s.next = (s.next ? s.next + ', ' : '') + 'turns ' + (turn > 0 ? 'right' : 'left');
      }
    }
    subjects.push(s);
  }
  subjects.sort((a, b) => a.distance - b.distance);
  // คนที่จะเข้าฉากในจังหวะถัดไป (ตอนนี้ซ่อนอยู่ แต่จังหวะหน้าอยู่ในภาพ)
  const enters = [];
  if (Pn) {
    const cn = Pn.get(cam.id) || cp;
    for (const o of plan.objects) {
      if (o.type !== 'entity') continue;
      const p = P.get(o.id), q = Pn.get(o.id);
      if (p && p.hidden && q && !q.hidden && inCone(q, cn, fov, range)) enters.push(nameOf(o));
    }
  }
  const key = subjects[0] ? plan.objects.find((o) => o.type === 'entity' && P.get(o.id) && nameOf(o) === subjects[0].name) : null;
  const kp = key ? P.get(key.id) : null;
  const lights = [];
  for (const o of plan.objects) {
    if (o.type !== 'light') continue;
    const p = P.get(o.id);
    if (!p || p.hidden) continue;
    const lt = lightTypeOf(o.kind);
    const k = num(o.cct, lt.cct) + gelShift(o.gel);
    const l = { type: o.kind, label: o.label || '', cct: Math.round(k), tone: k < 4000 ? 'warm' : k > 6200 ? 'cool' : 'neutral',
                intensity: Math.round(num(o.intensity, 100)), diffusion: o.diffusion || 'none', gel: o.gel || 'none',
                inFrame: inCone(p, cp, fov, range) };
    if (o.gel === 'color' && o.gelColor) l.color = o.gelColor;
    if (kp) {
      // ทิศแสงเทียบตัวแบบหลัก: มุมระหว่าง (ตัวแบบ→ไฟ) กับ (ตัวแบบ→กล้อง)
      const a = normAngle(angTo(kp, p) - angTo(kp, cp));
      const off = normAngle(angTo(cp, p) - cp.rot);
      const side = off > 0 ? 'frame right' : 'frame left';
      l.direction = Math.abs(a) < 40 ? 'front' : Math.abs(a) > 130 ? 'back/rim from ' + side : 'side from ' + side;
      const c = coneOf(o);
      l.reachesSubject = !!c && inCone(kp, p, c.fov, c.range);
    }
    lights.push(l);
  }
  const setPieces = [];
  for (const o of plan.objects) {
    if (o.type !== 'shape') continue;
    const p = P.get(o.id);
    if (!p || p.hidden) continue;
    const pts = o.pts ? worldPts(o, p) : [p];
    if (!pts.some((q) => inCone(q, cp, fov, range))) continue;
    const what = o.kind === 'text' ? (o.text || o.label) : (o.label || o.kind);
    if (what && !setPieces.includes(what)) setPieces.push(what);
  }
  const ca = P.get(cam.id), cb = Pn && Pn.get(cam.id);
  return {
    beat: i + 1,
    reference: beat.ref && beat.ref.text ? beat.ref.text : '',
    note: beat.note || '',
    shotSize: beat.shot || (subjects[0] ? subjects[0].size : 'ws'),
    shotSizeSetBy: beat.shot ? 'director' : 'estimated',
    camera: {
      label: cam.label || '', body: body && body.id !== 'custom' ? bodyName(body) : 'custom sensor ' + r1(sensorWOf(cam)) + 'mm',
      format: body && body.fmt ? body.fmt : '', lensMm: num(cam.lens, 35), fullFrameEquivalentMm: equivFF(cam),
      horizontalFovDeg: r1(fov), heightM: r1(num(cam.height, 1.5)), angle: cam.angle || 'eye',
      support: supportOf(cam.support).id, moveToNextBeat: cameraMove(cam, ca, cb).kind,
    },
    subjects, offscreen, entersNextBeat: enters, lights, setPieces,
  };
}

/** ลายนิ้วมือของข้อเท็จจริง (+ บริบทจากบท) — ต่างจากตอนสร้าง prompt = prompt ล้าสมัย */
export function factsHash(facts, extra = '') { return hashText(JSON.stringify(facts || null) + '\n' + extra); }

/**
 * คำขอถึง AI (ไม่ยิงเน็ตเอง — ผู้เรียกส่งต่อให้ client)
 * @param L ข้อความจากไฟล์ภาษา { system, facts, excerpt, characters, style, previous, sceneInfo }
 * @param o { facts, excerpt, sceneInfo, characters:[{name, text}], style, previous }
 */
export function buildShotPromptRequest(o, L) {
  const parts = [];
  parts.push(L.facts + '\n```json\n' + JSON.stringify(o.facts, null, 1) + '\n```');
  if (o.sceneInfo) parts.push(L.sceneInfo + '\n' + o.sceneInfo);
  if (o.excerpt) parts.push(L.excerpt + '\n"""\n' + o.excerpt + '\n"""');
  if (o.characters && o.characters.length) {
    parts.push(L.characters + '\n' + o.characters.map((c) => '- ' + c.name + ': ' + (c.text || '')).join('\n'));
  }
  if (o.style) parts.push(L.style + '\n' + o.style);
  if (o.previous) parts.push(L.previous + '\n' + o.previous);
  return { system: L.system, prompt: parts.join('\n\n') };
}

/**
 * อ่านคำตอบ: JSON `{"image": "...", "video": "..."}` (อาจห่อด้วย ```json · มีข้อความนำหน้า)
 * @returns {{ok:boolean, image:string, video:string}}
 */
export function parseShotPrompts(text) {
  const s = String(text || '');
  const tryParse = (x) => { try { const j = JSON.parse(x); return j && typeof j === 'object' ? j : null; } catch { return null; } };
  let j = tryParse(s.trim());
  if (!j) { const m = /```(?:json)?\s*([\s\S]*?)```/i.exec(s); if (m) j = tryParse(m[1].trim()); }
  if (!j) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) j = tryParse(s.slice(a, b + 1)); }
  const clean = (v) => String(v == null ? '' : v).replace(/\s+\n/g, '\n').trim();
  const image = j ? clean(j.image || j.still || j.image_prompt) : '';
  const video = j ? clean(j.video || j.video_prompt) : '';
  return { ok: !!(image || video), image, video };
}

/** ข้อความสั้นของหน้าตาตัวละครจากไฟล์ Wiki (ชื่อ · ชื่ออื่น · ช่องข้อมูล · หัวข้อ) — ตัดยาวเกิน */
export function entityBrief(e, max = 600) {
  if (!e || typeof e !== 'object') return '';
  const bits = [];
  if (Array.isArray(e.aliases) && e.aliases.length) bits.push(e.aliases.join(', '));
  for (const [k, v] of Object.entries(e.fields || {})) {
    const s = typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : '';
    if (s && s.trim()) bits.push(k + ': ' + s.trim());
  }
  if (e.desc) bits.push(String(e.desc));
  for (const sec of e.sections || []) if (sec && sec.content) bits.push((sec.title ? sec.title + ': ' : '') + sec.content);
  const t = bits.join(' · ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** บรรทัดของบทรอบบรรทัดที่อ้างอิง (ข้อความล้วนจาก sceneLines) — ไม่มีอ้างอิง = ต้นฉาก */
export function excerptAround(lines, ref, before = 4, after = 6, maxChars = 2400) {
  const L = lines || [];
  if (!L.length) return '';
  let at = -1;
  if (ref && ref.text) {
    let seen = 0;
    for (let k = 0; k < L.length; k++) {
      if (L[k].text === ref.text) { if (seen === (ref.nth || 0)) { at = k; break; } seen++; }
    }
    if (at < 0) at = L.findIndex((x) => x.text.includes(ref.text.slice(0, 20)));
  }
  const from = at < 0 ? 0 : Math.max(0, at - before), to = at < 0 ? Math.min(L.length, before + after + 1) : Math.min(L.length, at + after + 1);
  const out = L.slice(from, to).map((x, k) => (from + k === at ? '>> ' : '') + x.text).join('\n');
  return out.length > maxChars ? out.slice(0, maxChars) : out;
}

/**
 * [alpha.168 · bug hunt] ลำดับที่ต้องส่งให้ตัวค้นของตัวแก้ไข (`gotoSearchMatch` → `nthTextPos`) เพื่อไปถึงบรรทัดอ้างอิง
 * ตัวค้นนับ "ข้อความย่อย" ที่เจอในทั้งฉาก (ซ้อนทับได้) — ส่วน `ref.nth` นับ "บรรทัดที่ข้อความเหมือนกันทั้งบรรทัด"
 * สองหน่วยนี้ไม่เท่ากัน: บรรทัดสั้น ๆ อย่าง "ครับ" ที่เป็นส่วนหนึ่งของบรรทัดก่อนหน้า เดิมกระโดดไปผิดที่
 * → หาบรรทัดเป้าหมายก่อน แล้วนับจำนวนครั้งที่ `term` ปรากฏในบรรทัดก่อนหน้าทั้งหมด
 * @param lines [{text}] จาก sceneLines · term = คำที่จะส่งให้ตัวค้น (ปกติคือ 80 อักขระแรกของ ref.text)
 */
export function refSearchNth(lines, ref, term) {
  const L = lines || [];
  const w = String(term || (ref && ref.text) || '').toLowerCase();
  if (!w || !ref || !ref.text) return 0;
  let at = -1, seen = 0;
  for (let k = 0; k < L.length; k++) {
    if (L[k].text === ref.text) { if (seen === (ref.nth || 0)) { at = k; break; } seen++; }
  }
  if (at < 0) return Math.max(0, Math.floor(Number(ref.nth) || 0));      // บทถูกแก้จนหาไม่เจอ — ใช้ค่าเดิม
  let n = 0;
  for (let k = 0; k < at; k++) {
    const s = String(L[k].text || '').toLowerCase();
    for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) n++;
  }
  return n;
}

// ═══════════════ shot list ═══════════════
/**
 * แถวของ shot list (หนึ่งจังหวะ = หนึ่งแถว)
 * @param label (group, id) → ข้อความที่คนอ่าน (แผงส่งตัวแปลภาษาเข้ามา)
 */
export function shotListRows(plan, factsList, label = (g, id) => id) {
  return plan.beats.map((b, i) => {
    const f = factsList[i];
    const c = f && f.camera;
    return {
      beat: String(i + 1),
      reference: (b.ref && b.ref.text) || '',
      camera: c ? c.label : '',
      body: c ? c.body : '',
      lens: c ? c.lensMm + 'mm' : '',
      fov: c ? c.horizontalFovDeg + '°' : '',
      height: c ? c.heightM + 'm' : '',
      angle: c ? label('angle', c.angle) : '',
      support: c ? label('support', c.support) : '',
      shot: f ? label('shot', f.shotSize) : (b.shot ? label('shot', b.shot) : ''),
      move: c ? c.moveToNextBeat : '',
      inFrame: f ? f.subjects.map((s) => s.name + ' (' + s.frame + ')').join(', ') : '',
      lights: f ? f.lights.map((l) => label('light', l.type) + ' ' + l.cct + 'K' + (l.direction ? ' ' + l.direction : '')).join(', ') : '',
      note: b.note || '',
      image: (b.prompt && b.prompt.image) || '',
      video: (b.prompt && b.prompt.video) || '',
    };
  });
}
export const SHOT_LIST_COLS = ['beat', 'reference', 'camera', 'body', 'lens', 'fov', 'height', 'angle', 'support', 'shot', 'move', 'inFrame', 'lights', 'note', 'image', 'video'];
const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/** CSV (มี BOM ให้ Excel อ่านไทยถูก) · heads = หัวคอลัมน์ที่แปลแล้ว เรียงตาม SHOT_LIST_COLS */
export function shotListCsv(rows, heads) {
  const lines = [heads.map(csvCell).join(',')];
  for (const r of rows) lines.push(SHOT_LIST_COLS.map((k) => csvCell(r[k])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
/** Markdown: หัวเรื่อง + แต่ละจังหวะเป็นหัวข้อย่อย (prompt ยาวเกินจะใส่ตาราง) */
export function shotListMarkdown(title, rows, heads) {
  const H = Object.fromEntries(SHOT_LIST_COLS.map((k, i) => [k, heads[i]]));
  const out = ['# ' + title, ''];
  for (const r of rows) {
    out.push('## ' + H.beat + ' ' + r.beat + (r.reference ? ' — ' + r.reference : ''), '');
    for (const k of ['camera', 'body', 'lens', 'fov', 'height', 'angle', 'support', 'shot', 'move', 'inFrame', 'lights', 'note']) {
      if (r[k]) out.push('- **' + H[k] + ':** ' + r[k]);
    }
    if (r.image) out.push('', '**' + H.image + '**', '', '```', r.image, '```');
    if (r.video) out.push('', '**' + H.video + '**', '', '```', r.video, '```');
    out.push('');
  }
  return out.join('\n');
}
