// fmtbar-pos.js — [alpha.111] "เรียกแถบรูปแบบมาหาเคอร์เซอร์" **บริสุทธิ์ 100% · มี unit test**
//
// ผู้ใช้: *"format bar มีปุ่มที่กดแล้วย้ายไปยังจุดที่ mouse pointer อยู่ — ถ้าเมาส์อยู่นอกที่เขียน
//         ให้ไปกลางจอ ต่ำกว่ากลางประมาณ 200-300px · ย้ายแบบ tween"*
//
// สองเรื่องที่คำนวณผิดง่ายและไม่ต้องมีจอก็เทสได้ จึงอยู่ที่นี่ทั้งคู่:
//   1. **พิกัดปลายทาง** — แถบเป็น `position:absolute` ใน `#content` แต่เมาส์เป็นพิกัดหน้าต่าง
//      ต้องหักมุมของ host ออก แล้วหนีบไม่ให้ครึ่งแถบหลุดขอบ (โดยเฉพาะตอนแถบกว้างกว่าที่ว่าง)
//   2. **เส้นโค้งของการเคลื่อน** — tween จริงต้องออกช้า-เร่งกลาง-เบรกท้าย ไม่ใช่วิ่งเป็นเส้นตรง

/** ระยะที่ต่ำกว่ากึ่งกลางจอ เมื่อเมาส์ไม่ได้อยู่ในพื้นที่เขียน (ผู้ใช้ขอ 200–300px) */
export const FMTBAR_DROP = 250;

/** เวลาเคลื่อนที่ (ms) */
export const FMTBAR_TWEEN_MS = 420;

/** ระยะจากเคอร์เซอร์ลงมา — ให้แถบอยู่ใต้จุดที่พิมพ์ ไม่บังบรรทัดที่กำลังเขียน */
export const FMTBAR_CURSOR_GAP = 26;

/** ออกช้า เร่งกลาง เบรกท้าย — เส้นโค้งมาตรฐานของการย้ายวัตถุใน UI */
export function easeInOutCubic(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** ค่าระหว่างทางของ tween ณ สัดส่วนเวลา t (0..1) */
export function tweenAt(from, to, t) {
  return from + (to - from) * easeInOutCubic(t);
}

/**
 * พิกัดปลายทางของแถบรูปแบบ — **สัมพัทธ์กับ host** (`#content`)
 *
 * @param {object} o
 *   `pointer` {x,y} พิกัดหน้าต่างของเมาส์ (null = ไม่รู้ตำแหน่ง)
 *   `inEditor` boolean เมาส์อยู่ในพื้นที่เขียนไหม
 *   `host` {left,top,width,height} กรอบของ `#content`
 *   `bar` {width,height} ขนาดแถบ
 *   `viewport` {width,height}
 *   `pad` ระยะกันชิดขอบ (ค่าเริ่มต้น 8)
 * @returns {{left:number, top:number, fallback:boolean}}
 */
export function fmtBarTarget(o = {}) {
  const host = o.host || { left: 0, top: 0, width: 0, height: 0 };
  const bar = o.bar || { width: 0, height: 0 };
  const vp = o.viewport || { width: 0, height: 0 };
  const pad = Number.isFinite(o.pad) ? o.pad : 8;
  const useCursor = !!(o.pointer && o.inEditor
    && Number.isFinite(o.pointer.x) && Number.isFinite(o.pointer.y));

  // จุดที่อยากให้ "กึ่งกลางแนวนอนของแถบ" กับ "ขอบบนของแถบ" ไปอยู่ (พิกัดหน้าต่าง)
  const cx = useCursor ? o.pointer.x : vp.width / 2;
  const top0 = useCursor ? o.pointer.y + FMTBAR_CURSOR_GAP : vp.height / 2 + FMTBAR_DROP;

  let left = cx - bar.width / 2 - host.left;
  let top = top0 - host.top;

  // หนีบเข้ากรอบ — ที่ว่างแคบกว่าตัวแถบเมื่อไหร่ให้ชิดซ้าย/บนไว้ก่อน (ดีกว่าค่าติดลบ)
  const maxL = host.width - bar.width - pad;
  const maxT = host.height - bar.height - pad;
  left = maxL < pad ? pad : Math.min(Math.max(pad, left), maxL);
  top = maxT < pad ? pad : Math.min(Math.max(pad, top), maxT);
  return { left: Math.round(left), top: Math.round(top), fallback: !useCursor };
}

// ═══════ [alpha.116 ข้อ 5] จำตำแหน่งข้ามการ "ย่อ/ขยาย" หน้าต่าง ═══════
//
// ผู้ใช้: *"ตัว floating bar ยังไม่มี save ตำแหน่ง เมื่อกดย่อ ขยาย"*
//
// ต้นตอ: ตำแหน่งถูกบันทึก **เฉพาะตอนปล่อยเมาส์หลังลาก** (`makeDraggable`) และไม่มีใคร
// ตรวจซ้ำเมื่อพื้นที่เปลี่ยนขนาด · กดขยายหน้าต่างแล้วย่อกลับ = `#content` แคบลง
// แต่แถบยังถือ `left` เดิมซึ่งตอนนี้อยู่นอกกรอบ → แถบหายไปนอกจอ ผู้ใช้เห็นว่า "ไม่ได้จำ"
// (ค่าที่จำไว้ยังอยู่ครบ — มันแค่ชี้ไปที่ที่มองไม่เห็นแล้ว)
//
// ตัวหนีบอยู่ที่นี่เพราะเป็นเลขล้วน เทสได้โดยไม่ต้องมีจอ · ฝั่ง DOM แค่เอาค่าไปแปะแล้วบันทึก

/**
 * หนีบตำแหน่งของแถบ/ปุ่มลอยให้อยู่ในกรอบเสมอ
 * @param {{left:number,top:number}} pos ตำแหน่งที่จำไว้
 * @param {{width:number,height:number}} bar ขนาดของตัวแถบ
 * @param {{width:number,height:number}} host ขนาดของกรอบที่มันลอยอยู่
 * @param {number} [pad] ระยะกันชิดขอบ
 * @returns {{left:number, top:number, moved:boolean}} `moved` = ถูกหนีบจริง (ต้องบันทึกทับ)
 */
export function clampBarPos(pos, bar, host, pad = 4) {
  const hw = Math.max(0, (host && host.width) || 0);
  const hh = Math.max(0, (host && host.height) || 0);
  return clampBarInBox(pos, bar, { left: 0, top: 0, right: hw, bottom: hh }, pad);
}

/**
 * [alpha.119] ตัวหนีบตัวจริง — กรอบที่ยอมให้อยู่ **ไม่จำเป็นต้องเริ่มที่ (0,0)**
 *
 * `clampBarPos` เดิมสมมติว่า host ทั้งก้อนมองเห็นได้ — จริง ๆ `#content` ถูกดันขึ้นเหนือขอบจอ
 * หรือยาวเลยขอบล่างหน้าต่างได้ (โหมดโฟกัส/เต็มจอ/แถบสถานะ) — หนีบเข้า host อย่างเดียวจึงยังหลุดจอได้
 * @param {{left:number,top:number}} pos
 * @param {{width:number,height:number}} bar
 * @param {{left:number,top:number,right:number,bottom:number}} box กรอบที่ยอมให้อยู่ (พิกัดเดียวกับ `pos`)
 * @param {number} [pad]
 * @returns {{left:number, top:number, moved:boolean}}
 */
export function clampBarInBox(pos, bar, box, pad = 4) {
  const p = pos || {};
  const b = box || {};
  const bw = Math.max(0, (bar && bar.width) || 0);
  const bh = Math.max(0, (bar && bar.height) || 0);
  const bl = Number.isFinite(b.left) ? b.left : 0;
  const bt = Number.isFinite(b.top) ? b.top : 0;
  const br = Number.isFinite(b.right) ? b.right : bl;
  const bb = Number.isFinite(b.bottom) ? b.bottom : bt;
  const l0 = Number.isFinite(p.left) ? p.left : 0;
  const t0 = Number.isFinite(p.top) ? p.top : 0;
  // ที่ว่างแคบกว่าตัวแถบ → ชิดขอบซ้าย/บนไว้ก่อน ดีกว่าปล่อยให้ค่าติดลบ (บทเรียนข้อ 5)
  const minL = bl + pad, minT = bt + pad;
  const maxL = br - bw - pad;
  const maxT = bb - bh - pad;
  const left = Math.round(maxL < minL ? minL : Math.min(Math.max(minL, l0), maxL));
  const top = Math.round(maxT < minT ? minT : Math.min(Math.max(minT, t0), maxT));
  return { left, top, moved: left !== Math.round(l0) || top !== Math.round(t0) };
}

/**
 * [alpha.119] ส่วนของ host ที่ **มองเห็นได้จริง** — คืนมาเป็นพิกัดสัมพัทธ์กับ host
 *
 * ใช้คู่กับ `clampBarInBox` — กันเคสที่ host ใหญ่กว่าหน้าต่าง หรือโผล่พ้นขอบจอไป
 * (หนีบเข้า host เฉย ๆ แปลว่า "อยู่ใน host" แต่ยังมองไม่เห็นอยู่ดี)
 * @param {{left:number,top:number,width:number,height:number}} hostRect กรอบ host ในพิกัดหน้าต่าง
 * @param {{width:number,height:number}} viewport ขนาดหน้าต่างที่มองเห็น
 * @returns {{left:number,top:number,right:number,bottom:number}}
 */
export function visibleHostBox(hostRect, viewport) {
  const hr = hostRect || {};
  const vp = viewport || {};
  const hl = Number.isFinite(hr.left) ? hr.left : 0;
  const ht = Number.isFinite(hr.top) ? hr.top : 0;
  const hw = Math.max(0, hr.width || 0);
  const hh = Math.max(0, hr.height || 0);
  // ไม่รู้ขนาดหน้าต่าง = เชื่อ host ทั้งก้อนไปก่อน (พฤติกรรมเดิมของ clampBarPos)
  const vw = Number.isFinite(vp.width) && vp.width > 0 ? vp.width : hl + hw;
  const vh = Number.isFinite(vp.height) && vp.height > 0 ? vp.height : ht + hh;
  const left = Math.max(0, Math.min(hw, -hl));
  const top = Math.max(0, Math.min(hh, -ht));
  const right = Math.max(left, Math.min(hw, vw - hl));
  const bottom = Math.max(top, Math.min(hh, vh - ht));
  return { left, top, right, bottom };
}

// ═══════ [alpha.117] จาง · ชิดขอบ · ล็อก — สามอย่างที่แทน "ปุ่มย่อ" ═══════
//
// ผู้ใช้: *"floating bar เราไม่อยากให้ย่อ · เอา opacity 3 ระดับ 5% 50% 100% ดีกว่า
//         คือไม่หายหมด · reset กลับ 100% ได้ · align ไปขอบบน/ล่างง่าย ๆ · lock ไม่ให้ขยับ"*
//
// ทำไม "จาง" ดีกว่า "ย่อ": แถบที่ย่อแล้ว **หายไปทั้งแถบ** ต้องจำว่ากดปุ่มไหนเพื่อเรียกคืน
// ส่วนแถบที่จาง 5% ยังอยู่ที่เดิม ยังเห็นเงา ๆ ว่าอยู่ตรงไหน และ **เลื่อนเมาส์ไปโดนก็กลับมาชัดเอง**
// (กฎ hover อยู่ฝั่ง CSS) — ไม่มีสถานะ "หายไปแล้วหาไม่เจอ" ให้เกิดขึ้นได้เลย
//
// ทั้งสามอย่างเป็นค่าล้วน ๆ จึงอยู่ที่นี่ทั้งชุด ฝั่ง DOM แค่เอาไปแปะแล้วบันทึก

/** ระดับความทึบที่วนได้ — เรียงตามลำดับที่กดวน (ชัดสุดก่อน) */
export const FMTBAR_OPACITIES = [1, 0.5, 0.05];
/** ค่าเริ่มต้น = ชัดเต็ม (และเป็นปลายทางของ "รีเซ็ต") */
export const FMTBAR_OPACITY_DEFAULT = 1;

/** ค่าที่อ่านมาจากที่จำไว้ → ระดับที่ใกล้ที่สุดในตาราง (ค่าพังหรือไม่มี = ชัดเต็ม) */
export function normalizeOpacity(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return FMTBAR_OPACITY_DEFAULT;
  let best = FMTBAR_OPACITIES[0];
  for (const lv of FMTBAR_OPACITIES) if (Math.abs(lv - n) < Math.abs(best - n)) best = lv;
  return best;
}

/** ระดับถัดไปเมื่อกดวน — ครบรอบแล้วกลับมาชัดเต็มเสมอ (นี่คือทาง "รีเซ็ต" ที่กดได้เรื่อย ๆ) */
export function nextOpacity(cur) {
  const i = FMTBAR_OPACITIES.indexOf(normalizeOpacity(cur));
  return FMTBAR_OPACITIES[(i + 1) % FMTBAR_OPACITIES.length];
}

/** ตัวเลขเปอร์เซ็นต์สำหรับป้าย (0.05 → 5) */
export function opacityPercent(v) { return Math.round(normalizeOpacity(v) * 100); }

// ───────── ชิดขอบบน/ล่าง ─────────
export const FMTBAR_ALIGNS = ['top', 'bottom'];
// [alpha.118] ผู้ใช้: *"default ควรอยู่ขอบล่าง ตรงกลางของ editor ตอนนี้มันอยู่ตำแหน่งบน เยื้องไปซ้าย"*
// เดิม 'top' — เปลี่ยนเป็น 'bottom' ให้ตรงกับตำแหน่งเริ่มต้นใหม่ (ดู defaultBarPos ด้านล่าง)
// มีผลเฉพาะ "ค่าเริ่มต้น/รีเซ็ต" — ตำแหน่งที่ผู้ใช้ลากเองอยู่แล้วไม่ถูกย้ายตาม
export const FMTBAR_ALIGN_DEFAULT = 'bottom';
export function normalizeAlign(a) {
  return FMTBAR_ALIGNS.includes(a) ? a : FMTBAR_ALIGN_DEFAULT;
}
/** สลับบน↔ล่าง (ปุ่มลัดตัวเดียวพอ — มีแค่สองที่) */
export function nextAlign(cur) {
  return normalizeAlign(cur) === 'top' ? 'bottom' : 'top';
}

/**
 * ตำแหน่งเมื่อสั่ง "ชิดขอบบน/ล่าง"
 *
 * **แนวนอนไม่ขยับเลย — ไม่แม้แต่ถูกหนีบ** (★ e2e ของ alpha.117 จับได้)
 *
 * รอบแรกเขียนให้ผ่าน `clampBarPos` ทั้งก้อน ซึ่งดูปลอดภัยดี — แต่ตัวหนีบมีกฎว่า
 * "ที่ว่างแคบกว่าตัวแถบ → ชิดซ้ายไว้ก่อน" และ **แถบรูปแบบกว้างเกือบเท่าพื้นที่เขียนอยู่แล้ว**
 * (ปุ่มยี่สิบกว่าตัว + กล่องเลือกสองใบ) → สั่ง "ชิดขอบล่าง" ทีไร มันดีดไปชิดซ้ายด้วยทุกครั้ง
 * ซึ่งขัดกับสิ่งเดียวที่ผู้ใช้ขอตรง ๆ ว่าไม่ต้องขยับ
 *
 * ตอนนี้หนีบ **แกนตั้งอย่างเดียว** · การกันหลุดขอบแนวนอนเป็นหน้าที่ของ `clampBarPos`
 * ตอนหน้าต่างเปลี่ยนขนาด (ตาข่ายนิรภัย) ไม่ใช่ของคำสั่งที่ผู้ใช้ตั้งใจกด
 * @returns {{left:number, top:number}}
 */
export function alignBarPos(align, pos, bar, host, pad = 4) {
  const hh = Math.max(0, (host && host.height) || 0);
  const bh = Math.max(0, (bar && bar.height) || 0);
  const want = normalizeAlign(align) === 'top' ? pad : hh - bh - pad;
  const maxT = hh - bh - pad;
  const top = Math.round(maxT < pad ? pad : Math.min(Math.max(pad, want), maxT));
  const l = pos && Number.isFinite(pos.left) ? pos.left : 0;
  return { left: Math.round(l), top };
}

/**
 * สภาพของแถบที่ถูกจำไว้ — จุดเดียวที่รู้ว่า "ค่าที่อ่านจากดิสก์แปลว่าอะไร"
 * ไฟล์เลย์เอาต์เก่าไม่มีสามช่องนี้ → ได้ค่าเริ่มต้นที่ปลอดภัยทั้งหมด (ชัดเต็ม · ขอบล่าง · ไม่ล็อก)
 */
export function normalizeBarState(saved) {
  const s = saved || {};
  return {
    opacity: normalizeOpacity(s.opacity),
    align: normalizeAlign(s.align),
    locked: !!s.locked,
  };
}

/** สภาพหลัง "รีเซ็ต" — ชัดเต็ม ปลดล็อก ขอบล่าง (ตำแหน่งเป็นหน้าที่ของ makeDraggable) */
export function resetBarState() {
  return { opacity: FMTBAR_OPACITY_DEFAULT, align: FMTBAR_ALIGN_DEFAULT, locked: false };
}

// ═══════ [alpha.118] ตำแหน่งเริ่มต้น — กึ่งกลางแนวนอน ชิดขอบล่าง ═══════
//
// ผู้ใช้: *"แถบ float bar ตำแหน่ง default ควรอยู่ขอบล่าง ตรงกลางของ editor
//         ตอนนี้มันอยู่ตำแหน่งบน เยื้องไปซ้าย"*
//
// เดิม defaultPos เป็นค่าตายตัว `{left:24, top:12}` (มุมบนซ้าย) ตั้งแต่วันแรกที่ยังไม่มีปุ่มเยอะ
// ขนาดจริงของแถบไม่เคยถูกเอามาคิดเลย — พอมีปุ่มมากขึ้นเรื่อย ๆ ก็ยิ่งเห็นชัดว่าเยื้องซ้าย
// ไม่ได้อยู่กลางอะไรทั้งนั้น ตอนนี้คำนวณจากขนาดแถบจริง + ขนาดพื้นที่เขียนจริงทุกครั้งที่ตั้งค่าเริ่มต้น
//
// **มีผลเฉพาะ "ครั้งแรกที่ไม่เคยมีตำแหน่งจำไว้" กับตอนกด "รีเซ็ต" เท่านั้น** — ตำแหน่งที่ผู้ใช้
// ลากเองแล้วไม่ถูกแตะ (สอดคล้องกับหลักการเดิม: ตำแหน่งเป็นของผู้ใช้ ค่าเริ่มต้นเป็นแค่จุดตั้งต้น)
/**
 * @param {{width:number,height:number}} bar ขนาดของตัวแถบ
 * @param {{width:number,height:number}} host ขนาดของกรอบที่มันลอยอยู่ (`#content`)
 * @param {number} [pad] ระยะกันชิดขอบ
 * @returns {{left:number, top:number}}
 */
export function defaultBarPos(bar, host, pad = 16) {
  const bw = Math.max(0, (bar && bar.width) || 0);
  const bh = Math.max(0, (bar && bar.height) || 0);
  const hw = Math.max(0, (host && host.width) || 0);
  const hh = Math.max(0, (host && host.height) || 0);
  const left = Math.round(Math.max(pad, (hw - bw) / 2));
  const top = Math.round(Math.max(pad, hh - bh - pad));
  return { left, top };
}
