// onset-plugin.js — [alpha.164] ปลั๊กอิน ProseMirror ของ "ฉากมีปัญหา" (ระบบเทียบฉบับหน้ากองถ่าย)
//
// ติดตั้งอยู่ในตัวแก้ไขทั้งสองชนิดเสมอ (KEditor + SPEditor) แต่ **เฉยจนกว่าจะถูกสั่ง** —
// ฉากที่ไม่ได้ติดธงไม่เสียอะไรเลย (ไม่มี state · ไม่มี decoration · ไม่ไล่เทียบ)
//
// สั่งผ่าน `setOnsetCompare(view, cfg)`:
//   cfg = { other: string[] (คีย์บล็อกของอีกฉบับ), side: 'revised'|'original', lock: boolean }
//   · side='revised'  = บนจอคือฉบับแก้ไข (ของจริง แก้ได้) เทียบกับฉบับเดิม
//   · side='original' = บนจอคือฉบับเดิม (อ่านอย่างเดียว · lock=true ปฏิเสธทุกธุรกรรมที่แก้เนื้อ)
//
// จอวาดสองอย่างต่อบล็อกที่ต่าง: แถบสี (node decoration `.k-onset-line`) + ไอคอน ! หน้าบรรทัด
// (widget `.k-onset-bang` วางแบบ absolute ในร่องซ้าย → ไม่กินที่ ไม่กระทบการจัดหน้า/นับบรรทัด)
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { t } from './i18n.js';
import { blockKey, diffBlocks } from './onset-diff.js';

export const onsetKey = new PluginKey('k2onset');

// ค่าตั้งของแต่ละ view อยู่นอก state — `setMarkdown()` ของ KEditor สร้าง state ใหม่ทั้งก้อน
// (ปลั๊กอินชุดใหม่) · ตัว plugin view ของรอบใหม่มาอ่านค่านี้แล้วติดตั้งกลับเอง = ไม่หลุดเงียบ ๆ
const CFG = new WeakMap();

/** บล็อกที่เทียบกันได้ของเอกสาร: textblock ทุกตัว (รวมที่อยู่ในรายการ/คำพูดยกมา) + บล็อกอะตอม (รูป/ตัดหน้า) */
export function docBlocks(doc) {
  const out = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock || (node.isBlock && node.isLeaf)) {
      const a = node.attrs || {};
      const sub = a.el != null ? a.el : a.level != null ? a.level : (a.src || '');
      out.push({ pos, node, key: blockKey(node.type.name, sub, node.textContent) });
      return false;
    }
    return true;
  });
  return out;
}
export const docKeys = (doc) => docBlocks(doc).map((b) => b.key);

// คีย์เต็มทุกตัว (ห้ามประกอบคีย์จากชิ้นส่วน — ตัวตรวจไฟล์ภาษามองไม่เห็น)
const TIP = {
  revised: { changed: 'ui.onset.tip.revised.changed', added: 'ui.onset.tip.revised.added', gap: 'ui.onset.tip.revised.gap' },
  original: { changed: 'ui.onset.tip.original.changed', added: 'ui.onset.tip.original.added', gap: 'ui.onset.tip.original.gap' },
};
function bang(kind, side) {
  const s = document.createElement('span');
  s.className = 'k-onset-bang k-onset-' + kind;
  s.contentEditable = 'false';
  s.setAttribute('aria-hidden', 'true');
  s.textContent = '!';
  s.title = t((TIP[side] || TIP.revised)[kind] || TIP.revised.changed);
  return s;
}

function build(doc, cfg) {
  if (!cfg || !Array.isArray(cfg.other)) return { deco: DecorationSet.empty, info: null };
  const blocks = docBlocks(doc);
  const d = diffBlocks(blocks.map((b) => b.key), cfg.other);
  const side = cfg.side === 'original' ? 'original' : 'revised';
  const decos = [];
  const gapSet = new Set(d.gaps);
  blocks.forEach((b, i) => {
    const kind = d.kinds[i];
    const gap = gapSet.has(i);
    if (!kind && !gap) return;
    const cls = 'k-onset-line' + (kind ? ' k-onset-' + kind : '') + (gap ? ' k-onset-gap' : '');
    decos.push(Decoration.node(b.pos, b.pos + b.node.nodeSize, { class: cls }));
    const at = b.node.isTextblock ? b.pos + 1 : b.pos;
    const k = kind || 'gap';
    decos.push(Decoration.widget(at, () => bang(k, side), { side: -1, ignoreSelection: true, key: 'onset-' + side + '-' + k }));
  });
  // ลบทิ้งที่ท้ายเอกสาร → ติดธงบล็อกสุดท้าย (ไม่มีบล็อกให้ติดข้างหน้า)
  if (gapSet.has(blocks.length) && blocks.length) {
    const b = blocks[blocks.length - 1];
    decos.push(Decoration.node(b.pos, b.pos + b.node.nodeSize, { class: 'k-onset-line k-onset-gap-end' }));
    if (!d.kinds[blocks.length - 1] && !gapSet.has(blocks.length - 1)) {
      const at = b.node.isTextblock ? b.pos + 1 : b.pos;
      decos.push(Decoration.widget(at, () => bang('gap', side), { side: -1, ignoreSelection: true, key: 'onset-' + side + '-end' }));
    }
  }
  return { deco: DecorationSet.create(doc, decos), info: { ...d.stats, side, lines: decos.length } };
}

export function onsetPlugin() {
  return new Plugin({
    key: onsetKey,
    state: {
      init: () => ({ cfg: null, deco: DecorationSet.empty, info: null }),
      apply(tr, prev, _old, st) {
        const meta = tr.getMeta(onsetKey);
        if (meta !== undefined) {
          const cfg = meta && meta.cfg ? meta.cfg : null;
          return { cfg, ...build(st.doc, cfg) };
        }
        if (!prev.cfg) return prev;
        if (tr.docChanged) return { cfg: prev.cfg, ...build(st.doc, prev.cfg) };
        return prev;
      },
    },
    props: {
      decorations(st) { return onsetKey.getState(st).deco; },
      attributes(st) {
        const s = onsetKey.getState(st);
        return s && s.cfg ? { class: 'k-onset-on k-onset-side-' + (s.cfg.side || 'revised') } : {};
      },
    },
    // ฉบับเดิมบนจอ = อ่านอย่างเดียว — ปฏิเสธทุกอย่างที่แก้เนื้อ (พิมพ์ · วาง · ค้นแล้วแทนที่ · ปลั๊กอินอื่น)
    filterTransaction(tr, st) {
      if (!tr.docChanged) return true;
      const s = onsetKey.getState(st);
      return !(s && s.cfg && s.cfg.lock);
    },
    view(v) {
      // state ใหม่ทั้งก้อน (KEditor.setMarkdown) = ปลั๊กอินรอบใหม่ว่างเปล่า → ติดตั้งค่าเดิมกลับ
      const want = CFG.get(v);
      const have = onsetKey.getState(v.state);
      if (want && have && !have.cfg) {
        Promise.resolve().then(() => {
          if (CFG.get(v) === want && !v.isDestroyed) v.dispatch(v.state.tr.setMeta(onsetKey, { cfg: want }));
        });
      }
      return {};
    },
  });
}

/** เปิด/ปิดการเทียบของ view · cfg=null = ปิด */
export function setOnsetCompare(view, cfg) {
  if (!view) return false;
  if (cfg) CFG.set(view, cfg); else CFG.delete(view);
  if (!onsetKey.getState(view.state)) return false;         // ตัวแก้ไขรุ่นที่ไม่มีปลั๊กอินนี้
  view.dispatch(view.state.tr.setMeta(onsetKey, { cfg: cfg || null }));
  return true;
}

/** สรุปของ view: {changed, added, removed, hunks, side, lines} · null = ไม่ได้เทียบ */
export function onsetInfo(view) {
  const s = view && onsetKey.getState(view.state);
  return s && s.info ? s.info : null;
}
