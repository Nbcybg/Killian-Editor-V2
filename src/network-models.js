// network-models.js — [alpha.166] โมเดล 3 มิติแทนโหนดใน Story Network (ฝั่ง bundle หลัก)
//
// หน้าที่: โหลด renderer/net3d.js (three.js) ครั้งแรกที่ต้องใช้ · อ่านไฟล์โมเดลของโปรเจกต์ (kapi.readBytes)
// · เก็บภาพของโมเดลตามมุมกล้อง (แคช) · บอกตัววาดให้วาดใหม่เมื่อโหลดเสร็จ
// ตัววาด (network.js) ถามแค่ `modelSprite(ref, opts)` — ได้ canvas = วาดแทนวงกลม · null = ยังไม่พร้อม (วาดวงกลมไปก่อน)
import { modelKind } from './network-scene.js';

let _libP = null;
/** โหลดบันเดิล three.js (ครั้งเดียวทั้งหน้าต่าง) */
export function loadNet3D() {
  if (window.K2Net3D) return Promise.resolve(window.K2Net3D);
  if (_libP) return _libP;
  _libP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'net3d.js';
    s.onload = () => (window.K2Net3D ? res(window.K2Net3D) : rej(new Error('net3d: no export')));
    s.onerror = () => { _libP = null; rej(new Error('net3d: load failed')); };
    document.head.appendChild(s);
  });
  return _libP;
}

const _models = new Map();          // abs path → { state:'loading'|'ready'|'error', model, err, p }
const _sprites = new Map();         // key → canvas (LRU แบบง่าย)
const SPRITE_MAX = 240;
let _onReady = null;

/** ตัววาดลงทะเบียนว่า "โหลดเสร็จแล้วให้วาดใหม่" */
export function onModelReady(fn) { _onReady = fn; }

/** สถานะของไฟล์โมเดล: '' (ยังไม่เคยขอ) | loading | ready | error */
export function modelState(abs) { const m = _models.get(abs); return m ? m.state : ''; }
export function modelError(abs) { const m = _models.get(abs); return m && m.err ? String(m.err.message || m.err) : ''; }

/**
 * เริ่มโหลดโมเดล (ไม่ต้องรอ) — ไฟล์เดียวใช้ร่วมทุกโหนด
 * @param {string} abs  ทางเต็มของไฟล์
 * @param {{color?:string}} opts
 */
export function requestModel(abs, opts = {}) {
  if (!abs) return null;
  const cur = _models.get(abs);
  if (cur) return cur.p;
  const kind = modelKind(abs);
  const rec = { state: 'loading', model: null, err: null, p: null };
  _models.set(abs, rec);
  rec.p = (async () => {
    try {
      if (!kind) throw new Error('unsupported');
      const lib = await loadNet3D();
      const bytes = await window.kapi.readBytes(abs);
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      if (!u8.length) throw new Error('empty file');
      let baseUrl = '';
      if (kind === 'gltf') {
        try { const dir = abs.replace(/[\\/][^\\/]*$/, ''); baseUrl = (await window.kapi.toFileURL(dir)) + '/'; } catch {}
      }
      rec.model = await lib.parseModel(kind, u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength),
                                       { color: opts.color, baseUrl });
      rec.state = 'ready';
    } catch (e) {
      rec.state = 'error'; rec.err = e;
    }
    try { _onReady && _onReady(abs, rec.state); } catch {}
    return rec.state;
  })();
  return rec.p;
}

/** มุมถูกปัดเป็นขั้น 4° — หมุนกล้องช้า ๆ ไม่ต้องวาดโมเดลใหม่ทุกพิกเซลที่ลาก */
const STEP = Math.PI / 45;
const q = (a) => Math.round((a || 0) / STEP);
/** ขนาดภาพปัดเป็นขั้นกำลังสอง (32 · 64 · 128 · 256 · 512) */
function bucket(px) { let b = 32; while (b < px && b < 512) b *= 2; return b; }

/**
 * ภาพของโมเดลที่มุมกล้องนี้ — null = ยังไม่พร้อม (สั่งโหลดให้แล้ว)
 * @param {string} abs
 * @param {{rx:number, ry:number, yaw?:number, px:number, color?:string}} o  px = ขนาดบนจอ (พิกเซลจริง)
 */
export function modelSprite(abs, o) {
  const rec = _models.get(abs);
  if (!rec) { requestModel(abs, o); return null; }
  if (rec.state !== 'ready' || !window.K2Net3D) return null;
  const size = bucket(o.px || 64);
  const st = Math.round((o.stand || 0) * 12) / 12;             // ท่ายืน 0..1 (ขั้นละ 1/12)
  const key = abs + '|' + q(o.rx) + '|' + q(o.ry) + '|' + q(o.yaw) + '|' + st + '|' + size;
  let c = _sprites.get(key);
  if (c) { _sprites.delete(key); _sprites.set(key, c); return c; }      // ใช้ล่าสุด = ไปท้ายคิว
  try {
    c = window.K2Net3D.renderModel(rec.model, { rx: q(o.rx) * STEP, ry: q(o.ry) * STEP, yaw: q(o.yaw) * STEP, stand: st, size });
  } catch (e) { rec.state = 'error'; rec.err = e; return null; }
  _sprites.set(key, c);
  if (_sprites.size > SPRITE_MAX) _sprites.delete(_sprites.keys().next().value);
  return c;
}

/** ลืมโมเดล (ผู้ใช้เปลี่ยน/ลบ หรือไฟล์ถูกแก้) */
export function forgetModel(abs) {
  const rec = _models.get(abs);
  if (rec && rec.model && window.K2Net3D) { try { window.K2Net3D.disposeModel(rec.model); } catch {} }
  _models.delete(abs);
  for (const k of [..._sprites.keys()]) if (k.startsWith(abs + '|')) _sprites.delete(k);
}
