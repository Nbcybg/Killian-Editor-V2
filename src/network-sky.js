// network-sky.js — [alpha.167] ฉากหลังแบบ skybox ของ Story Network ในโหมด 3D (บริสุทธิ์ 100% · unit `network-sky`)
//
// ผู้ใช้: *"Background แบบที่เป็นแผ่น ไม่ค่อย work มันต้องเป็นแบบ skybox"*
//
// ต้นตอ: alpha.166 วางฉากหลังทุกชนิดเป็น "แผ่น" บนระนาบ z = 0 ของโลก แล้วเอียงตามกล้อง
//   → หมุน 3D แล้วเห็นขอบแผ่น · รูปถูกยืดเป็นสี่เหลี่ยมคางหมู · อวกาศเลื่อนตามแพนเหมือนติดอยู่กับโต๊ะ
// skybox = ฉากที่อยู่ "ไกลไม่สิ้นสุด" รอบตัวกล้อง: หมุนกล้องแล้วฟ้าหมุนตาม · แพน/ซูมแล้วฟ้าอยู่กับที่
//   ทุกพิกเซลบนจอคือ "ทิศทาง" หนึ่งในโลก → สีของพิกเซล = สีของฟ้าในทิศนั้น
//
// แกน: ทิศ "บน" ของฟ้า = −y ของโลก (ขอบบนของจอตอนเป็น 2D) — หมุนซ้ายขวา (ry) แล้วเส้นขอบฟ้ายังนิ่ง
//      เหมือนโปรแกรม 3D ทั่วไป · ก้ม/เงย (rx) แล้วเส้นขอบฟ้าเลื่อนขึ้นลง
import { unrot3, rot3 } from './network-camera.js';
import { seededRandom } from './network-scene.js';

/** ระยะโฟกัสของ skybox เป็นพิกเซล (มุมมองกว้างราว 60° ตามด้านยาวของจอ) — ไม่ขึ้นกับซูมของผัง */
export function skyFocal(w, h) { return 0.9 * Math.max(w || 1, h || 1); }

/** พิกเซลบนจอ → ทิศทางในโลก (เวกเตอร์หนึ่งหน่วย) */
export function skyDir(X, Y, w, h, rot, f) {
  const fp = f || skyFocal(w, h);
  const v = { x: (X - w / 2) / fp, y: (Y - h / 2) / fp, z: 1 };
  const d = unrot3(v, rot ? rot.rx : 0, rot ? rot.ry : 0);
  const L = Math.hypot(d.x, d.y, d.z) || 1;
  return { x: d.x / L, y: d.y / L, z: d.z / L };
}

/** ทิศทางในโลก → พิกเซลบนจอ (null = อยู่ข้างหลังกล้อง) */
export function skyProject(d, w, h, rot, f) {
  const fp = f || skyFocal(w, h);
  const v = rot3(d, rot ? rot.rx : 0, rot ? rot.ry : 0);
  if (v.z <= 1e-3) return null;
  return { x: w / 2 + fp * v.x / v.z, y: h / 2 + fp * v.y / v.z };
}

/**
 * ทิศทาง → พิกัดของภาพพาโนรามา 360° แบบ equirectangular (u,v ช่วง 0..1)
 * u = ลองจิจูด (รอบแกนบน) · v = ละติจูด (0 = ฟ้าบนสุด · 1 = ใต้เท้า)
 */
export function equirectUV(d) {
  const lon = Math.atan2(d.x, d.z);
  const lat = Math.asin(Math.max(-1, Math.min(1, -d.y)));
  return { u: 0.5 + lon / (2 * Math.PI), v: 0.5 - lat / Math.PI };
}

/** ความสูงของทิศเหนือเส้นขอบฟ้า (−1 = ใต้เท้า · 0 = ขอบฟ้า · 1 = ฟ้าบนสุด) */
export function skyElevation(d) { return -d.y; }

/**
 * ดาวบนทรงกลม — กระจายเท่ากันทุกทิศ (สุ่มแบบกำหนดผลได้ ดาวอยู่ที่เดิมทุกเฟรม)
 * @returns {{x,y,z,r,a,tint}[]}  r = รัศมีพิกเซล · a = ความสว่าง · tint 0..1 (อุ่น/เย็น)
 */
export function skyStars(density = 1, seed = 17) {
  const rnd = seededRandom(seed);
  const n = Math.round(1600 * Math.max(0, Math.min(3, density)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    const big = rnd();
    out.push({ x: s * Math.cos(t), y: z, z: s * Math.sin(t),
               r: big > 0.985 ? 1.6 + rnd() * 1.2 : big > 0.9 ? 0.9 + rnd() * 0.5 : 0.45 + rnd() * 0.4,
               a: 0.3 + rnd() * 0.7, tint: rnd() });
  }
  return out;
}

const hex3 = (h, d) => {
  const s = String(h || '');
  if (!/^#[0-9a-f]{6}$/i.test(s)) return d;
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** สว่างขึ้น/มืดลงแบบคงสีเดิม (k > 0 = เข้าหาขาว · k < 0 = เข้าหาดำ) */
function shade(c, k) { return k >= 0 ? mix(c, [255, 255, 255], k) : mix(c, [0, 0, 0], -k); }

/**
 * กลุ่มก้อนเนบิวลาบนทรงกลม (ตำแหน่ง/ขนาด/น้ำหนักสี) — สร้างครั้งเดียวต่อ seed
 * สองสี: สีที่ผู้ใช้เลือก (c2) + สีคู่ตรงข้ามอ่อน ๆ ให้ฟ้าไม่แบนเป็นสีเดียว
 */
export function nebulaBlobs(seed = 5) {
  const rnd = seededRandom(seed);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const z = rnd() * 1.6 - 0.8, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    out.push({ x: s * Math.cos(t), y: z, z: s * Math.sin(t), w: 0.14 + rnd() * 0.3, k: 0.45 + rnd() * 0.55, alt: rnd() < 0.3 });
  }
  return out;
}
const BAND = (() => { const L = Math.hypot(0.35, 1, 0.2); return { x: 0.35 / L, y: 1 / L, z: 0.2 / L }; })();

/**
 * ตัวสร้างสีของฟ้าตามชนิดฉากหลัง → ฟังก์ชัน (ทิศ) → [r,g,b]
 * ภาพของผู้ใช้ (พาโนรามา) ไม่อยู่ที่นี่ — ตัววาดอ่านพิกเซลของภาพเอง
 * @param {{kind:string,c1:string,c2:string}} bg  ค่าฉากหลังที่ normalize แล้ว
 * @param {string} themeBg  สีพื้นของธีม (ชนิด 'theme')
 */
export function domeShader(bg, themeBg) {
  const base = hex3(themeBg, [20, 20, 28]);
  const c1 = hex3(bg.c1, base), c2 = hex3(bg.c2, c1);
  switch (bg.kind) {
    case 'space': {
      const blobs = nebulaBlobs(5);
      const alt = [c2[2] * 0.8, c2[0] * 0.5 + 40, c2[1] * 0.7 + 60].map((x) => Math.min(255, x));
      return (d) => {
        let col = c1.slice();
        // ทางช้างเผือก: แถบสว่างรอบวงใหญ่วงหนึ่ง
        const bd = d.x * BAND.x + d.y * BAND.y + d.z * BAND.z;
        const band = Math.exp(-(bd * bd) / 0.02) * 0.34;
        col = mix(col, shade(c2, 0.35), band);
        for (const b of blobs) {
          const dot = d.x * b.x + d.y * b.y + d.z * b.z;
          const g = Math.exp(-(1 - dot) / b.w) * b.k * 0.85;
          if (g > 0.004) col = mix(col, b.alt ? alt : c2, clamp01(g));
        }
        return col;
      };
    }
    case 'solid': return () => c1;
    case 'theme': {
      // พื้นธีม: เหนือขอบฟ้าสว่างขึ้นนิด ใต้เท้ามืดลงนิด — เห็นว่ากำลังหมุนโดยไม่แย่งสายตาจากผัง
      const top = shade(base, 0.07), bot = shade(base, -0.25), hz = shade(base, 0.16);
      return (d) => { const e = skyElevation(d); return e >= 0 ? mix(hz, top, Math.pow(e, 0.6)) : mix(hz, bot, Math.pow(-e, 0.5)); };
    }
    case 'blueprint': {
      // โดมพิมพ์เขียว: ไล่สี + เส้นละติจูด/ลองจิจูดบาง ๆ (เหมือนห้องจำลองของนักออกแบบ)
      const line = shade(c1, 0.35);
      return (d) => {
        const e = skyElevation(d);
        let col = mix(c2, c1, clamp01(0.5 + e * 0.8));
        const { u, v } = equirectUV(d);
        const gu = Math.abs(((u * 36) % 1) - 0.5), gv = Math.abs(((v * 18) % 1) - 0.5);
        const L = Math.max(clamp01((gu - 0.44) * 12), clamp01((gv - 0.44) * 12));
        if (L > 0) col = mix(col, line, L * 0.55 * (1 - Math.abs(e) * 0.6));
        return col;
      };
    }
    case 'wargame': {
      // ฟ้าหม่นเหนือสนามรบ + พื้นหญ้าไกล ๆ ใต้ขอบฟ้า
      const sky = shade(c1, -0.55), haze = shade(c1, 0.25), ground = c2;
      return (d) => { const e = skyElevation(d); return e >= 0 ? mix(haze, sky, Math.pow(e, 0.55)) : mix(haze, ground, Math.pow(-e, 0.35)); };
    }
    case 'parchment': {
      // ห้องสีกระดาษเก่า: กลางสว่าง ขอบ (บน/ล่าง) เข้มแบบวิกเนตต์
      return (d) => { const e = Math.abs(skyElevation(d)); return mix(c1, c2, Math.pow(e, 0.8)); };
    }
    case 'gradient':
    case 'image':
    default:
      return (d) => { const e = skyElevation(d); return mix(c2, c1, clamp01(0.5 + e * 0.9)); };
  }
}
