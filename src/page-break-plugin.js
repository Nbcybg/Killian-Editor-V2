// page-break-plugin.js — โรงงานสร้าง "ปลั๊กอินเส้นคั่นหน้า" ของ ProseMirror
//
// เดิมโค้ดชุดนี้ถูกคัดลอกไว้สองที่ (`sp-format-guide.js` สำหรับบทภาพยนตร์ ·
// `prose-view.js` สำหรับนิยาย) เหมือนกันทุกบรรทัด ต่างแค่ PluginKey กับคลาส CSS
// → รวมเป็นโรงงานตัวเดียว แต่ยัง "แยกสถานะกันคนละชุด" เพราะ KEditor กับ SPEditor
//   เปิดพร้อมกันคนละแท็บได้ (ถ้าใช้ตัวแปรร่วมกัน เส้นคั่นของบทจะไปโผล่ในนิยาย)
//
// บทเรียน 44: `setBreaks()` คืน true เฉพาะเมื่อ "ลายเซ็นเปลี่ยนจริง" — ผู้เรียกจึง
// dispatch transaction เฉพาะตอนนั้น ไม่ใช่ทุก 300ms ตามจังหวะ debounce

import { t } from './i18n.js';
import { Plugin as PMPlugin, PluginKey as PMKey } from 'prosemirror-state';
import { Decoration as Deco, DecorationSet as DecoSet } from 'prosemirror-view';

/**
 * @param {object} o
 *   o.key      ชื่อ PluginKey (ต้องไม่ซ้ำกับปลั๊กอินอื่นในเอกสารเดียวกัน)
 *   o.cls      คลาส CSS ของเส้น (คั่นหลายคลาสด้วยช่องว่างได้)
 *   o.decoKey  คำนำหน้า key ของ widget decoration (กัน ProseMirror ใช้ widget ซ้ำผิดตัว)
 *   o.label    ฟังก์ชันทำข้อความบนป้าย — ไม่ใส่ = "หน้า N"
 */
export function createPageBreakPlugin({ key: keyName, cls, decoKey, label }) {
  const key = new PMKey(keyName);
  const text = label || ((page) => t('ui.common.page2') + (page || ''));
  let list = [];
  let sig = '';

  /** ตั้งรายการเส้นคั่นหน้า — คืน true เมื่อเปลี่ยนจริง */
  function setBreaks(next) {
    const clean = (next || []).filter((b) => b && Number.isFinite(b.pos) && b.pos > 0);
    const s = clean.map((b) => b.pos + ':' + b.page).join(',');
    if (s === sig) return false;
    sig = s;
    list = clean;
    return true;
  }
  function breaks() { return list.slice(); }

  /**
   * [alpha.82] เส้นคั่นหน้าอยู่กลางย่อหน้าได้แล้ว (การจัดหน้าจริงตัดตาม "บรรทัด" ไม่ใช่ย่อหน้า)
   * ตำแหน่งที่อยู่ใน textblock ต้องวาดด้วย element ระดับ inline ไม่งั้น <div> ใน <p>
   * จะฉีกกล่องบรรทัดของย่อหน้าและดันข้อความเลื่อน → การวัดรอบถัดไปเพี้ยนตาม
   * ตัวแปร inline จึงกว้าง/สูงเป็นศูนย์ แล้ววาดเส้นด้วย ::before แบบ absolute (ไม่กินที่เลย)
   */
  function isInline(doc, pos) {
    try { return !!doc.resolve(pos).parent.isTextblock; } catch { return false; }
  }

  function decos(doc) {
    if (!list.length || !doc) return DecoSet.empty;
    const max = doc.content.size;
    const out = [];
    for (const b of list) {
      if (b.pos > max) continue;
      const inline = isInline(doc, b.pos);
      out.push(Deco.widget(b.pos, () => {
        const d = document.createElement(inline ? 'span' : 'div');
        d.className = cls + (inline ? ' k-pb-inline' : '');
        d.dataset.page = String(b.page || '');
        d.setAttribute('contenteditable', 'false');
        const lbl = document.createElement('span');
        lbl.className = 'sp-page-break-num';
        lbl.textContent = text(b.page);
        d.append(lbl);
        return d;
      }, { side: -1, key: decoKey + b.pos + '-' + b.page + (inline ? 'i' : '') }));
    }
    return DecoSet.create(doc, out);
  }

  function plugin() {
    return new PMPlugin({
      key,
      state: {
        init: (_c, st) => decos(st.doc),
        apply(tr, prev, _o, st) {
          if (!tr.docChanged && !tr.getMeta(key)) return prev.map(tr.mapping, tr.doc);
          return decos(st.doc);
        },
      },
      props: { decorations(state) { return key.getState(state); } },
    });
  }

  function refresh(view) {
    if (view) view.dispatch(view.state.tr.setMeta(key, true));
  }

  return { key, setBreaks, breaks, plugin, refresh };
}
