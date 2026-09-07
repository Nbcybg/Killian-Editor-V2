// typewriter-sound.js — เสียงเครื่องพิมพ์ดีดขณะพิมพ์ (alpha.57a ข้อ 1)
//
// สังเคราะห์เสียงเองด้วย WebAudio ทั้งหมด — ไม่มีไฟล์เสียงแนบมาด้วย
//   · เคาะแป้น  = คลิก (noise burst ผ่าน bandpass) + "ตึ้ก" ของก้านตัวอักษรกระทบกระดาษ
//   · วรรค      = คลิกเบา ๆ ความถี่ต่ำกว่า
//   · ลบ        = คลิกสั้นแห้ง ๆ
//   · ขึ้นบรรทัด = กระดิ่ง (bell) + เสียงรูดแคร่กลับ
//
// ทุกฟังก์ชันปลอดภัยเมื่อไม่มี AudioContext (เช่นตอนรันเทสแบบไม่มีเสียง) — เงียบแล้วคืน false

let _ctx = null;                 // AudioContext (สร้างครั้งแรกที่จำเป็น)
let _master = null;              // GainNode หลัก (ระดับเสียงรวม)
let _noise = null;               // AudioBuffer ของ white noise (ใช้ซ้ำทุกครั้ง กันสร้างใหม่ถี่ ๆ)
let _on = false;
let _volume = 0.5;
let _lastAt = 0;                 // กันเสียงซ้อนกันเป็นพรืดเมื่อกดค้าง

export const TYPE_SOUND_KINDS = ['key', 'space', 'back', 'return'];

/** เสียงเปิดอยู่ไหม */
export function isTypeSound() { return _on; }
export function typeVolume() { return _volume; }

/** ระดับเสียง 0–1 */
export function setTypeVolume(v) {
  const n = Math.max(0, Math.min(1, Number(v)));
  _volume = Number.isFinite(n) ? n : 0.5;
  if (_master) _master.gain.value = _volume;
  return _volume;
}

/** เปิด/ปิดเสียง — คืนสถานะหลังเปลี่ยน */
export function setTypeSound(on) {
  _on = !!on;
  if (_on) ensureAudio();
  return _on;
}

function ensureAudio() {
  if (_ctx) {
    // Chromium พัก AudioContext เมื่อยังไม่มี user gesture — ปลุกทุกครั้งที่จะเล่น
    if (_ctx.state === 'suspended') { try { _ctx.resume(); } catch {} }
    return _ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    _ctx = new AC();
    _master = _ctx.createGain();
    _master.gain.value = _volume;
    _master.connect(_ctx.destination);
    // white noise 0.25 วินาที — ตัดมาใช้เป็นช่วงสั้น ๆ ต่อการเคาะหนึ่งครั้ง
    const n = Math.floor(_ctx.sampleRate * 0.25);
    _noise = _ctx.createBuffer(1, n, _ctx.sampleRate);
    const d = _noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch { _ctx = null; }
  return _ctx;
}

/** เคาะ = noise สั้น ๆ ผ่าน bandpass + envelope ตกเร็ว */
function clack(t0, { freq = 2200, q = 1.2, dur = 0.045, gain = 0.5 } = {}) {
  const src = _ctx.createBufferSource();
  src.buffer = _noise;
  src.playbackRate.value = 1;
  const bp = _ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = _ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  src.connect(bp); bp.connect(g); g.connect(_master);
  src.start(t0, Math.random() * 0.2, dur + 0.02);
  src.stop(t0 + dur + 0.02);
}

/** ก้านตัวอักษรกระทบกระดาษ — คลื่นสามเหลี่ยมความถี่ต่ำสั้นมาก */
function thock(t0, { freq = 170, dur = 0.05, gain = 0.28 } = {}) {
  const o = _ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), t0 + dur);
  const g = _ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(_master);
  o.start(t0); o.stop(t0 + dur + 0.01);
}

/** กระดิ่งท้ายบรรทัด — sine สองชั้นเสียงใส ดังนานกว่าเสียงเคาะ */
function bell(t0, gain = 0.16) {
  for (const [f, mul, dur] of [[1760, 1, 0.55], [2640, 0.5, 0.4]]) {
    const o = _ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f;
    const g = _ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain * mul, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g); g.connect(_master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
}

/** รูดแคร่กลับ — noise ยาวขึ้นพร้อมกวาด bandpass ลง */
function carriage(t0, dur = 0.22) {
  const src = _ctx.createBufferSource();
  src.buffer = _noise; src.loop = true;
  const bp = _ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 3;
  bp.frequency.setValueAtTime(3200, t0);
  bp.frequency.exponentialRampToValueAtTime(700, t0 + dur);
  const g = _ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.13, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0006, t0 + dur);
  src.connect(bp); bp.connect(g); g.connect(_master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

/**
 * เล่นเสียงหนึ่งครั้ง
 * @param {'key'|'space'|'back'|'return'} kind
 * @param {{force?:boolean}} opts force = เล่นแม้ปิดเสียงอยู่ (ปุ่ม "ลองฟัง" ในตั้งค่า)
 * @returns {boolean} เล่นจริงไหม
 */
export function playType(kind = 'key', opts = {}) {
  if (!_on && !opts.force) return false;
  if (!ensureAudio()) return false;
  const now = _ctx.currentTime;
  // กดค้างจนคีย์ซ้ำ (~30ms) จะได้เสียงพรืด — จำกัดไม่ให้ถี่กว่า 25ms
  if (now - _lastAt < 0.025) return false;
  _lastAt = now;
  const t0 = now + 0.001;
  // สุ่มความถี่เล็กน้อยทุกครั้ง ไม่งั้นฟังเป็นเสียงอิเล็กทรอนิกส์ซ้ำ ๆ
  const jitter = 0.9 + Math.random() * 0.2;
  try {
    if (kind === 'return') { carriage(t0); bell(t0 + 0.02); clack(t0 + 0.2, { freq: 1500, dur: 0.05, gain: 0.4 }); }
    else if (kind === 'space') { clack(t0, { freq: 1200 * jitter, dur: 0.04, gain: 0.32 }); thock(t0, { freq: 130, gain: 0.2 }); }
    else if (kind === 'back') { clack(t0, { freq: 3000 * jitter, dur: 0.03, gain: 0.3 }); }
    else { clack(t0, { freq: 2200 * jitter, dur: 0.045, gain: 0.5 }); thock(t0, { freq: 170 * jitter }); }
  } catch { return false; }
  return true;
}

/** แปลงอีเวนต์คีย์บอร์ดเป็นชนิดเสียง — คืน null เมื่อไม่ควรมีเสียง (ปุ่มควบคุม/คีย์ลัด) */
export function soundKindFor(ev) {
  if (!ev) return null;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return null;      // คีย์ลัดไม่ใช่การพิมพ์
  const k = ev.key;
  if (k === 'Enter') return 'return';
  if (k === ' ' || ev.code === 'Space') return 'space';
  if (k === 'Backspace' || k === 'Delete') return 'back';
  if (k === 'Tab') return 'key';
  if (typeof k === 'string' && k.length === 1) return 'key';    // ตัวอักษรจริง (ไทย/อังกฤษ/สัญลักษณ์)
  return null;                                                  // ลูกศร/Shift/F1…
}

/** อยู่ในช่องพิมพ์ข้อความไหม (ไม่เล่นเสียงตอนกดในกล่องค้นหา/เมนู) */
export function isEditorTarget(ev) {
  const t = ev && ev.target;
  if (!t || !t.closest) return false;
  return !!t.closest('.ProseMirror');
}
