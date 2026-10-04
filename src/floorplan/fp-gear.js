// fp-gear.js — คลังอุปกรณ์ของผังพื้นที่ (บริสุทธิ์ 100% · ไม่ import อะไรเลย)
//
// ผู้ใช้: "มีไฟ ชนิดไฟ การตั้งค่าไฟ เลนส์กล้อง ชนิดกล้อง เช่น red komodo sony fx3 fuji xt5 ความสูง
//          การตั้ง เช่น jimmy tripod monopod มีใส่ราง dolly นะ"
//
// ตารางที่นี่เป็น "ข้อมูล" — ชื่อรุ่นกล้องเป็นชื่อเฉพาะ (ไม่แปล) · ป้ายของชนิด/ขาตั้ง/ไฟเก็บเป็น **คีย์ภาษา**
// แล้วแปลตอนวาด (`labelKey`) — ห้ามแปลตอน import (ค้างภาษาเดิม · บทเรียน 37)

/**
 * บอดี้กล้อง: ขนาดเซนเซอร์เป็นมม. (กว้าง × สูง ของโหมดถ่ายวิดีโอเต็มเซนเซอร์)
 * มุมรับภาพคำนวณจากความกว้างเซนเซอร์กับความยาวโฟกัส → เลนส์ 35mm บน FX3 (ฟูลเฟรม) กว้างกว่าบน Komodo (S35)
 */
export const CAMERA_BODIES = [
  { id: 'red-komodo',     brand: 'RED',       model: 'Komodo 6K',          sw: 27.03, sh: 14.26, fmt: 'S35' },
  { id: 'red-komodo-x',   brand: 'RED',       model: 'Komodo-X 6K',        sw: 27.03, sh: 14.26, fmt: 'S35' },
  { id: 'red-v-raptor',   brand: 'RED',       model: 'V-Raptor 8K VV',     sw: 40.96, sh: 21.60, fmt: 'VV' },
  { id: 'arri-alexa-35',  brand: 'ARRI',      model: 'Alexa 35',           sw: 27.99, sh: 19.22, fmt: 'S35' },
  { id: 'arri-mini-lf',   brand: 'ARRI',      model: 'Alexa Mini LF',      sw: 36.70, sh: 25.54, fmt: 'LF' },
  { id: 'arri-mini',      brand: 'ARRI',      model: 'Alexa Mini',         sw: 28.25, sh: 18.17, fmt: 'S35' },
  { id: 'sony-venice-2',  brand: 'Sony',      model: 'Venice 2',           sw: 35.90, sh: 24.00, fmt: 'FF' },
  { id: 'sony-fx9',       brand: 'Sony',      model: 'FX9',                sw: 35.70, sh: 18.80, fmt: 'FF' },
  { id: 'sony-fx6',       brand: 'Sony',      model: 'FX6',                sw: 35.70, sh: 18.80, fmt: 'FF' },
  { id: 'sony-fx3',       brand: 'Sony',      model: 'FX3',                sw: 35.60, sh: 23.80, fmt: 'FF' },
  { id: 'sony-fx30',      brand: 'Sony',      model: 'FX30',               sw: 23.30, sh: 15.50, fmt: 'APS-C' },
  { id: 'sony-a7s3',      brand: 'Sony',      model: 'A7S III',            sw: 35.60, sh: 23.80, fmt: 'FF' },
  { id: 'canon-c70',      brand: 'Canon',     model: 'EOS C70',            sw: 26.20, sh: 13.80, fmt: 'S35' },
  { id: 'canon-c300-3',   brand: 'Canon',     model: 'EOS C300 Mark III',  sw: 26.20, sh: 13.80, fmt: 'S35' },
  { id: 'canon-r5c',      brand: 'Canon',     model: 'EOS R5 C',           sw: 36.00, sh: 24.00, fmt: 'FF' },
  { id: 'bm-pocket-6k',   brand: 'Blackmagic', model: 'Pocket 6K',         sw: 23.10, sh: 12.99, fmt: 'S35' },
  { id: 'bm-pocket-4k',   brand: 'Blackmagic', model: 'Pocket 4K',         sw: 18.96, sh: 10.00, fmt: 'MFT' },
  { id: 'bm-cinema-6k',   brand: 'Blackmagic', model: 'Cinema Camera 6K',  sw: 36.00, sh: 24.00, fmt: 'FF' },
  { id: 'bm-ursa-12k',    brand: 'Blackmagic', model: 'URSA Mini Pro 12K', sw: 27.03, sh: 14.25, fmt: 'S35' },
  { id: 'fuji-xt5',       brand: 'Fujifilm',  model: 'X-T5',               sw: 23.50, sh: 15.60, fmt: 'APS-C' },
  { id: 'fuji-xh2s',      brand: 'Fujifilm',  model: 'X-H2S',              sw: 23.50, sh: 15.60, fmt: 'APS-C' },
  { id: 'fuji-gfx100-2',  brand: 'Fujifilm',  model: 'GFX100 II',          sw: 43.80, sh: 32.90, fmt: 'GF' },
  { id: 'pana-gh6',       brand: 'Panasonic', model: 'Lumix GH6',          sw: 17.30, sh: 13.00, fmt: 'MFT' },
  { id: 'pana-s5-2',      brand: 'Panasonic', model: 'Lumix S5 II',        sw: 35.60, sh: 23.80, fmt: 'FF' },
  { id: 'nikon-z8',       brand: 'Nikon',     model: 'Z8',                 sw: 35.90, sh: 23.90, fmt: 'FF' },
  { id: 'dji-mavic-3',    brand: 'DJI',       model: 'Mavic 3',            sw: 17.30, sh: 13.00, fmt: 'MFT' },
  { id: 'dji-ronin-4d',   brand: 'DJI',       model: 'Ronin 4D 6K',        sw: 35.60, sh: 23.80, fmt: 'FF' },
  { id: 'gopro-12',       brand: 'GoPro',     model: 'HERO12',             sw: 6.17,  sh: 4.55,  fmt: '1/1.9"' },
  { id: 'iphone-15-pro',  brand: 'Apple',     model: 'iPhone 15 Pro',      sw: 9.80,  sh: 7.30,  fmt: '1/1.28"' },
  // ตั้งเอง — ความกว้างเซนเซอร์อยู่ที่ช่อง sensorW ของกล้องตัวนั้น
  { id: 'custom',         brand: '',          model: '',                   sw: 36.00, sh: 24.00, fmt: '' },
];
export const DEFAULT_BODY = 'sony-fx3';
export function bodyOf(id) { return CAMERA_BODIES.find((b) => b.id === id) || null; }
/** ชื่อที่แสดงของบอดี้ (ชื่อเฉพาะ — ไม่ผ่านไฟล์ภาษา) · `custom` = '' (ผู้เรียกใส่ป้าย "ตั้งเอง" เอง) */
export function bodyName(b) { return b && b.brand ? b.brand + ' ' + b.model : ''; }

/** เลนส์ไพรม์ที่ใช้บ่อย (มม.) — ช่องเลนส์รับค่าใดก็ได้ ตารางนี้เป็นแค่ตัวเลือกด่วน */
export const LENS_PRESETS = [12, 14, 16, 18, 21, 24, 25, 28, 32, 35, 40, 50, 65, 75, 85, 100, 135, 200];

/** ขาตั้ง/อุปกรณ์ยึดกล้อง — ความสูงตั้งต้น (ม.) + ใช้กับรางได้ไหม */
export const SUPPORTS = [
  { id: 'tripod',    h: 1.5, rail: false },
  { id: 'monopod',   h: 1.6, rail: false },
  { id: 'handheld',  h: 1.5, rail: false },
  { id: 'shoulder',  h: 1.6, rail: false },
  { id: 'gimbal',    h: 1.3, rail: false },
  { id: 'steadicam', h: 1.3, rail: false },
  { id: 'highhat',   h: 0.3, rail: false },
  { id: 'slider',    h: 1.2, rail: true },
  { id: 'dolly',     h: 1.4, rail: true },
  { id: 'jib',       h: 2.5, rail: false },
  { id: 'crane',     h: 4.0, rail: false },
  { id: 'car',       h: 1.2, rail: false },
  { id: 'drone',     h: 10,  rail: false },
];
export function supportOf(id) { return SUPPORTS.find((s) => s.id === id) || SUPPORTS[0]; }

/** มุมกล้อง (ระดับ) — คำอธิบายของความสูง */
export const CAM_ANGLES = ['eye', 'low', 'high', 'overhead', 'ground', 'dutch'];

/** ขนาดภาพ — ช่วยจดว่ากล้องตัวนี้ในจังหวะนี้ถ่ายแบบไหน */
export const SHOT_SIZES = ['ews', 'ws', 'fs', 'ms', 'mcu', 'cu', 'ecu', 'ots', 'pov', 'insert'];

/**
 * ชนิดไฟ — มุมลำแสง (องศา · 360 = ส่องรอบตัว) · กำลัง (วัตต์) · อุณหภูมิสี (K) ตั้งต้น
 * ระยะส่องตั้งต้น (ม.) ใช้วาดกรวยแสง
 */
export const LIGHT_TYPES = [
  { id: 'fresnel',   beam: 30,  watts: 650,  cct: 3200, range: 6 },
  { id: 'ledPanel',  beam: 60,  watts: 100,  cct: 5600, range: 4 },
  { id: 'cob',       beam: 55,  watts: 300,  cct: 5600, range: 6 },
  { id: 'softbox',   beam: 90,  watts: 300,  cct: 5600, range: 4 },
  { id: 'hmi',       beam: 20,  watts: 1800, cct: 5600, range: 12 },
  { id: 'spot',      beam: 26,  watts: 750,  cct: 3200, range: 8 },
  { id: 'tube',      beam: 120, watts: 30,   cct: 5600, range: 3 },
  { id: 'practical', beam: 360, watts: 60,   cct: 2700, range: 2.5 },
  { id: 'chinaBall', beam: 360, watts: 150,  cct: 3200, range: 3 },
  { id: 'sun',       beam: 40,  watts: 0,    cct: 5600, range: 15 },
  { id: 'bounce',    beam: 90,  watts: 0,    cct: 5600, range: 3 },
];
export function lightTypeOf(id) { return LIGHT_TYPES.find((l) => l.id === id) || LIGHT_TYPES[0]; }

export const DIFFUSIONS = ['none', 'quarter', 'half', 'full', 'grid'];
export const GELS = ['none', 'ctoQuarter', 'ctoHalf', 'ctoFull', 'ctbQuarter', 'ctbHalf', 'ctbFull', 'plusGreen', 'minusGreen', 'color'];
/** ผลของเจลต่ออุณหภูมิสี (K ที่บวก/ลบ — ประมาณการแบบที่ช่างไฟใช้คิดในหัว) */
const GEL_SHIFT = { ctoQuarter: -600, ctoHalf: -1200, ctoFull: -2300, ctbQuarter: 700, ctbHalf: 1500, ctbFull: 3000 };
export function gelShift(gel) { return GEL_SHIFT[gel] || 0; }

/** รูปทรงแบบ Visio — ฉาก/ผนัง/ประตู/ของประกอบที่วาดเอง */
export const SHAPE_KINDS = ['rect', 'rounded', 'ellipse', 'triangle', 'wall', 'door', 'window', 'stairs', 'line', 'arrow', 'text', 'flag'];
/** รูปทรงที่เป็น "เส้นหลายจุด" (วาดด้วยการคลิกทีละจุด) */
export const POLY_KINDS = new Set(['wall', 'line', 'arrow']);

/**
 * ป้ายของค่าในตาราง → คีย์ภาษา (แปลตอนวาด) — **คีย์เต็มทุกตัว** (ห้ามประกอบคีย์จากชิ้นส่วน:
 * ตัวตรวจไฟล์ภาษามองไม่เห็น · แบบ REASON_KEYS ของ ai-doctor)
 */
const LABEL_KEYS = {
  support: {
    tripod: 'ui.fp.supTripod', monopod: 'ui.fp.supMonopod', handheld: 'ui.fp.supHandheld',
    shoulder: 'ui.fp.supShoulder', gimbal: 'ui.fp.supGimbal', steadicam: 'ui.fp.supSteadicam',
    highhat: 'ui.fp.supHighhat', slider: 'ui.fp.supSlider', dolly: 'ui.fp.supDolly',
    jib: 'ui.fp.supJib', crane: 'ui.fp.supCrane', car: 'ui.fp.supCar',
    drone: 'ui.fp.supDrone',
  },
  angle: {
    eye: 'ui.fp.angEye', low: 'ui.fp.angLow', high: 'ui.fp.angHigh',
    overhead: 'ui.fp.angOverhead', ground: 'ui.fp.angGround', dutch: 'ui.fp.angDutch',
  },
  shot: {
    ews: 'ui.fp.shotEws', ws: 'ui.fp.shotWs', fs: 'ui.fp.shotFs',
    ms: 'ui.fp.shotMs', mcu: 'ui.fp.shotMcu', cu: 'ui.fp.shotCu',
    ecu: 'ui.fp.shotEcu', ots: 'ui.fp.shotOts', pov: 'ui.fp.shotPov',
    insert: 'ui.fp.shotInsert',
  },
  light: {
    fresnel: 'ui.fp.ltFresnel', ledPanel: 'ui.fp.ltLedPanel', cob: 'ui.fp.ltCob',
    softbox: 'ui.fp.ltSoftbox', hmi: 'ui.fp.ltHmi', spot: 'ui.fp.ltSpot',
    tube: 'ui.fp.ltTube', practical: 'ui.fp.ltPractical', chinaBall: 'ui.fp.ltChinaBall',
    sun: 'ui.fp.ltSun', bounce: 'ui.fp.ltBounce',
  },
  diff: {
    none: 'ui.fp.diffNone', quarter: 'ui.fp.diffQuarter', half: 'ui.fp.diffHalf',
    full: 'ui.fp.diffFull', grid: 'ui.fp.diffGrid',
  },
  gel: {
    none: 'ui.fp.gelNone', ctoQuarter: 'ui.fp.gelCtoQuarter', ctoHalf: 'ui.fp.gelCtoHalf',
    ctoFull: 'ui.fp.gelCtoFull', ctbQuarter: 'ui.fp.gelCtbQuarter', ctbHalf: 'ui.fp.gelCtbHalf',
    ctbFull: 'ui.fp.gelCtbFull', plusGreen: 'ui.fp.gelPlusGreen', minusGreen: 'ui.fp.gelMinusGreen',
    color: 'ui.fp.gelColor',
  },
  shape: {
    rect: 'ui.fp.shpRect', rounded: 'ui.fp.shpRounded', ellipse: 'ui.fp.shpEllipse',
    triangle: 'ui.fp.shpTriangle', wall: 'ui.fp.shpWall', door: 'ui.fp.shpDoor',
    window: 'ui.fp.shpWindow', stairs: 'ui.fp.shpStairs', line: 'ui.fp.shpLine',
    arrow: 'ui.fp.shpArrow', text: 'ui.fp.shpText', flag: 'ui.fp.shpFlag',
  },
};
export function labelKey(group, id) {
  const g = LABEL_KEYS[group];
  return (g && g[id]) || (g && Object.values(g)[0]) || 'ui.common.notNamed';
}

/**
 * อุณหภูมิสี (K) → สี RGB โดยประมาณ (สูตรของ Tanner Helland) — ใช้ระบายกรวยแสงบนผัง
 * ไม่ใช่ค่าวัดทางวิทยาศาสตร์ แค่ให้ 2700K ออกส้ม · 5600K ออกขาว · 9000K ออกฟ้า
 */
export function cctToHex(k) {
  const t = Math.max(1000, Math.min(40000, Number(k) || 5600)) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const h = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
