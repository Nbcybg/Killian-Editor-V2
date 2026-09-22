// glyph-upgrade.js — [alpha.157r] วางไอคอนเส้นทับอีโมจิสีในหน้าจอ (ส่วน DOM ของ glyph-icons.js)
//
// ทำงานแบบ "ตามเก็บ": MutationObserver ดูทุกอย่างที่ถูกวาดใหม่ แล้วแปลงเป็นรอบต่อเฟรม
//   ข้อความ "📄 ตลาดเก่า"  →  <span class="k-gl"><svg/></span><span class="k-gl-t">📄</span> ตลาดเก่า
// อักขระเดิมยังอยู่ใน `.k-gl-t` (ซ่อนด้วย clip — ไม่ใช่ display:none) → `textContent` เหมือนเดิมทุกไบต์
// โค้ด/เทสที่อ่านป้ายด้วย textContent จึงไม่เปลี่ยน
//
// ★ ไม่แตะ "เนื้อหาของผู้ใช้": ตัวแก้ไข (.ProseMirror / contenteditable) · ช่องกรอก · <option> · <svg>/<canvas>
//   (อีโมจิที่นักเขียนพิมพ์ในเรื่องต้องเป็นอีโมจิของเขา) · ไม่แตะ `title` (ทูลทิปเป็นข้อความล้วน)
import { splitGlyphs, glyphSvg } from './glyph-icons.js';

const SKIP_SEL = '.ProseMirror, [contenteditable="true"], textarea, input, select, option, svg, canvas, script, style, '
  + '.k-gl, .k-gl-t, .k-no-glyph, .sp, .wiki-body, .k-dev-dlg pre, .aichat-msg, .k-log-list';
const S = { obs: null, pending: new Set(), raf: 0, to: 0, count: 0 };

function upgradeText(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP_SEL)) return 0;
  const parts = splitGlyphs(node.nodeValue);
  if (!parts) return 0;
  const frag = document.createDocumentFragment();
  let n = 0;
  for (const p of parts) {
    if (p.text != null) { frag.append(document.createTextNode(p.text)); continue; }
    const svg = glyphSvg(p.glyph) || glyphSvg(p.glyph.replace(/️/g, ''));
    if (!svg) { frag.append(document.createTextNode(p.glyph)); continue; }
    const ic = document.createElement('span');
    ic.className = 'k-gl' + (p.tint ? ' k-gl-' + p.tint : '');
    ic.setAttribute('aria-hidden', 'true');
    ic.innerHTML = svg;
    const keep = document.createElement('span');
    keep.className = 'k-gl-t';
    keep.textContent = p.glyph;
    frag.append(ic, keep);
    n++;
  }
  if (n) node.replaceWith(frag);
  return n;
}

/** แปลงทั้งกิ่ง (เรียกตรงได้ — เทสใช้) · คืนจำนวนไอคอนที่วาง */
export function upgradeGlyphs(root) {
  if (!root) return 0;
  if (root.nodeType === 3) return upgradeText(root);
  if (root.nodeType !== 1 || root.closest(SKIP_SEL)) return 0;
  const texts = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (t) => (t.nodeValue && /[⌀-➿⬀-⯿\uD83C-\uD83E]/.test(t.nodeValue)
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let t = w.nextNode(); t; t = w.nextNode()) texts.push(t);
  let n = 0;
  for (const t of texts) n += upgradeText(t);
  S.count += n;
  return n;
}

function flush() {
  if (S.raf) cancelAnimationFrame(S.raf);
  clearTimeout(S.to);
  S.raf = 0; S.to = 0;
  const list = [...S.pending];
  S.pending.clear();
  for (const node of list) { if (node.isConnected) upgradeGlyphs(node); }
}

/** เริ่มเฝ้าทั้งหน้า (เรียกครั้งเดียวตอนบูต) */
export function startGlyphUpgrade(root = document.body) {
  if (S.obs || !root || typeof MutationObserver === 'undefined') return false;
  upgradeGlyphs(root);
  S.obs = new MutationObserver((recs) => {
    for (const r of recs) {
      const t = r.target;
      const host = t.nodeType === 1 ? t : t.parentElement;
      if (!host || host.closest('.ProseMirror')) continue;   // พิมพ์ในตัวแก้ไข = ไม่ต้องทำอะไรเลย (เร็ว)
      if (r.type === 'characterData') { S.pending.add(t); continue; }
      for (const a of r.addedNodes) if (a.nodeType === 1 || a.nodeType === 3) S.pending.add(a);
    }
    // rAF หยุดเดินเมื่อหน้าต่างถูกบังทั้งบาน (macOS occlusion) → มี timeout สำรอง อันไหนมาก่อนทำก่อน
    if (S.pending.size && !S.raf) { S.raf = requestAnimationFrame(flush); S.to = setTimeout(flush, 50); }
  });
  S.obs.observe(root, { childList: true, subtree: true, characterData: true });
  return true;
}
export function glyphUpgradeCount() { return S.count; }
