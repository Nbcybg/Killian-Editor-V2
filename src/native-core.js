// native-core.js — [alpha.169 · native] ตรรกะของ "พฤติกรรมแบบโปรแกรมจริง" ฝั่งหน้าจอ (บริสุทธิ์ 100% · unit `native-shell`)
//
// ผู้ใช้: *"มีอะไรที่ยังดูแล้ว เหมือนห่อด้วย web · เราอยากได้ app ที่ native เลย"*
// ไฟล์นี้ไม่แตะ DOM/kapi — ตัวผูกกับหน้าจออยู่ที่ native-shell-ui.js

/** 'rgb(25, 24, 22)' · 'rgba(25,24,22,1)' · '#abc' · '#aabbcc' → '#rrggbb' · อ่านไม่ออก/โปร่งใส = '' */
export function rgbToHex(v) {
  const s = String(v || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return '#' + m[1].split('').map((c) => c + c).join('').toLowerCase();
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return '#' + m[1].toLowerCase();
  m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (!m) return '';
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return '';
  const h = (n) => Math.max(0, Math.min(255, Math.round(+n))).toString(16).padStart(2, '0');
  return '#' + h(m[1]) + h(m[2]) + h(m[3]);
}

/**
 * ตัวจับ "แตะ Alt ครั้งเดียว" (ท่ามาตรฐานของ Windows สำหรับเข้าแถบเมนูด้วยคีย์บอร์ด)
 * นับเป็นการแตะเมื่อ: กด Alt ลง (ไม่มี Ctrl/Shift/Meta) → ปล่อย โดยไม่มีคีย์อื่น/เมาส์แทรก
 * AltGr ของแป้นยุโรปมาเป็น Ctrl+Alt จึงไม่นับ · ค้าง Alt แล้วกดตัวอื่น (Alt+F4 ฯลฯ) ไม่นับ
 */
export function createAltTap() {
  let armed = false;
  return {
    /** @returns {void} */
    down(e) {
      if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.code !== 'AltRight') {
        if (!e.repeat) armed = true;
      } else armed = false;
    },
    /** @returns {boolean} true = เป็นการแตะ Alt ที่สะอาด */
    up(e) {
      const hit = armed && e.key === 'Alt';
      armed = false;
      return hit;
    },
    /** เมาส์/หน้าต่างเสียโฟกัส ระหว่างค้าง Alt = ไม่ใช่การแตะ */
    cancel() { armed = false; },
    get armed() { return armed; },
  };
}

/** เดินในแถบเมนูด้วยลูกศร: คืนดัชนีถัดไป (วนรอบ) · คีย์อื่น = -1 */
export function menubarStep(count, i, key) {
  if (!(count > 0)) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight') return (i + 1 + count) % count;
  if (key === 'ArrowLeft') return (i - 1 + count) % count;
  return -1;
}

/**
 * ของที่ลากมาจากนอกโปรแกรม (Explorer ของ Windows / Finder) = ทำอะไร
 * @param {{name:string, path?:string, isDir?:boolean, projectRoot?:string}[]} entries
 *        projectRoot = รากโปรเจกต์ที่ผู้เรียกหาให้แล้ว (โฟลเดอร์ที่มี project.khn.json / ไฟล์ project.khn.json เอง)
 * @param {{isImage:(n:string)=>boolean, isScreenplay:(n:string)=>boolean}} is
 * @returns {{kind:'project', root:string} | {kind:'images', items:object[]} | {kind:'screenplay', item:object} | {kind:'none'}}
 */
export function classifyOsDrop(entries, is) {
  const list = (entries || []).filter((e) => e && e.name);
  if (!list.length) return { kind: 'none' };
  const proj = list.find((e) => e.projectRoot);
  if (proj) return { kind: 'project', root: proj.projectRoot };
  const imgs = list.filter((e) => !e.isDir && is.isImage(e.name));
  if (imgs.length) return { kind: 'images', items: imgs };
  const sp = list.find((e) => !e.isDir && is.isScreenplay(e.name));
  if (sp) return { kind: 'screenplay', item: sp };
  return { kind: 'none' };
}

/** นามสกุลไฟล์บทภาพยนตร์ที่ตัวนำเข้ารู้จัก (ชุดเดียวกับตัวกรองของกล่องเปิดไฟล์ — unit เทียบกับ import-sp.js) */
export const SCREENPLAY_EXT = ['fountain', 'fdx', 'celtx', 'astx', 'fadein'];
export function isScreenplayFile(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  return !!m && SCREENPLAY_EXT.includes(m[1].toLowerCase());
}

/** ชื่อไฟล์ที่ไม่ชนกับของที่มีอยู่ (รูปที่ลากมาวาง): a.png → a-2.png → a-3.png */
export function freeFileName(name, taken) {
  const has = new Set([...(taken || [])].map((x) => String(x).toLowerCase()));
  const n = String(name || 'image.png');
  if (!has.has(n.toLowerCase())) return n;
  const dot = n.lastIndexOf('.');
  const base = dot > 0 ? n.slice(0, dot) : n, ext = dot > 0 ? n.slice(dot) : '';
  for (let i = 2; i < 10000; i++) {
    const c = base + '-' + i + ext;
    if (!has.has(c.toLowerCase())) return c;
  }
  return base + '-' + Date.now() + ext;
}

/** งานยาวจบแล้วควรเรียกความสนใจไหม: นานพอ และผู้ใช้ไม่ได้อยู่ที่หน้าต่าง */
export function shouldCallAttention(elapsedMs, focused, minMs) {
  return !focused && elapsedMs >= minMs;
}
