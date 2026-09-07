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
 *   o.midMode  จุดตัดที่ตกกลางย่อหน้าจะวาดเป็นอะไร
 *              'inline' (ค่าเริ่มต้น · นิยาย) = <span> กว้าง/สูง 0 แล้ววาดเส้นด้วย ::before
 *                       — จำเป็นเพราะการจัดหน้าของนิยาย **วัดจาก DOM** กล่องที่กินที่จะทำให้วนไม่จบ
 *              'block'  (บทภาพยนตร์) = <div> จริงคั่นกลางย่อหน้า ดันเนื้อที่เหลือลงไปข้างล่าง
 *                       — ปลอดภัยเพราะบทวัดความกว้างจากฟอนต์ (text-width.js) ไม่ได้อ่าน DOM เลย
 */
export function createPageBreakPlugin({ key: keyName, cls, decoKey, label, midMode }) {
  const key = new PMKey(keyName);
  const text = label || ((page) => t('ui.common.page2') + (page || ''));
  let list = [];
  let sig = '';
  // [alpha.83 ข้อ 4] "เลขหน้าจริง" ของหน้าที่เริ่มตรงเส้นคั่นนี้ — วางเป็นโอเวอร์เลย์ที่มุมขวาบน
  // ของหน้าถัดไป (ตำแหน่งเดียวกับที่ PDF พิมพ์) · null = ปิดเลขหน้า
  // เดิมโหมดปกติ/จัดหน้ามีเลขแค่ **หน้าแรก** (ผ่าน `::before` ของ .ProseMirror) หน้า 2 เป็นต้นไป
  // มีแต่ป้าย "หน้า N" กลางแถบคั่น ผู้ใช้จึงเห็นว่า "เปิดเลขหน้าแล้วไม่ขึ้น"
  let numFn = null;
  /** ตั้งตัวทำป้ายเลขหน้า — คืน true เมื่อผลลัพธ์ที่ได้เปลี่ยนจริง (ผู้เรียกค่อย refresh) */
  function setNumberLabel(fn) {
    const before = numSig();
    numFn = typeof fn === 'function' ? fn : null;
    return numSig() !== before;
  }
  const numOf = (page) => {
    if (!numFn) return '';
    try { return String(numFn(page) ?? ''); } catch { return ''; }
  };
  const numSig = () => list.map((b) => numOf(b.page)).join(',');

  // [alpha.84 ข้อ 2] ลายเซ็นต้องรวม `ind` ด้วย — ย้ายจุดตัดไปอยู่ใน element ที่เยื้องต่างกัน
  // โดยตำแหน่งเท่าเดิมเป็นไปได้ (แก้ข้อความก่อนหน้า) ถ้าไม่รวมไว้ แถบคั่นจะค้างที่ระยะเดิม
  // [alpha.93 ข้อ 5] ★ **`pad` ห้ามอยู่ในลายเซ็นและห้ามอยู่ในคีย์ของ widget**
  // ที่ว่างท้ายหน้าเปลี่ยนได้ทุกครั้งที่พิมพ์ ถ้าเอาไปปนกับ "ตัวตน" ของเส้นคั่น ProseMirror
  // จะทิ้ง DOM เดิมแล้วสร้างใหม่ทั้งแถบทุกตัวอักษร = อาการกระพริบที่ alpha.85 เพิ่งแก้ไป
  // → pad ถูกทาลง DOM ตรง ๆ ทีหลังผ่าน `applyPads()` แทน (ไม่ผ่านการ diff ของ PM เลย)
  const sigOf = (l) => l.map((b) => [b.pos, b.page, b.ind ?? '',
                                    b.contTop || '', b.contBottom || ''].join(':')).join(',');

  /** ตั้งรายการเส้นคั่นหน้า — คืน true เมื่อเปลี่ยนจริง */
  function setBreaks(next) {
    const clean = (next || []).filter((b) => b && Number.isFinite(b.pos) && b.pos > 0);
    const s = sigOf(clean);
    if (s === sig) return false;
    sig = s;
    list = clean;
    return true;
  }

  /**
   * [alpha.85 ข้อ 2] ★ เลื่อนตำแหน่งที่จำไว้ตามการแก้ไข — **หัวใจของการแก้อาการกระพริบ**
   *
   * ของเดิม `apply()` เจอ `docChanged` แล้ว **สร้าง decoration ใหม่จาก `list` เดิม** ทันที
   * ซึ่ง `list` ยังเป็นตำแหน่งของ *ก่อน* แก้ไข → พิมพ์ 1 ตัวเหนือเส้นคั่น ตำแหน่งเดิมจึงตกไป
   * อยู่ "ท้ายย่อหน้าก่อนหน้า" แทนที่จะเป็นรอยต่อระหว่างย่อหน้า → widget พลิกจากระดับบล็อก
   * เป็นระดับ inline (คนละคีย์) → ProseMirror ทิ้ง DOM แล้วสร้างใหม่ · พอจัดหน้าเสร็จอีก 100ms
   * ตำแหน่งจริงมาถึง ก็พลิกกลับเป็นบล็อกอีกครั้ง = **สร้างใหม่สองรอบต่อการกดปุ่มหนึ่งครั้ง**
   * แถบคั่นแผ่นสูงราว 220px จึงหายแล้วโผล่ ๆ ตลอดเวลาที่พิมพ์
   *
   * ที่ถูกคือเลื่อนตำแหน่งตาม `tr.mapping` ไปเลย — ได้ทั้งความถูกต้องระหว่างรอจัดหน้ารอบใหม่
   * และเมื่อผลจัดหน้าออกมาตรงกับที่เลื่อนไว้ `setBreaks` ก็คืน false → ไม่ต้องวาดใหม่เลยสักครั้ง
   */
  function mapBreaks(mapping) {
    if (!list.length) return;
    list = list.map((b) => ({ ...b, pos: mapping.map(b.pos, -1) }))
               .filter((b) => Number.isFinite(b.pos) && b.pos > 0);
    sig = sigOf(list);
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

  /**
   * ══ [alpha.130 ข้อ 1] ★★ "ลายเซ็นรูปทรง" ของชุด decoration ที่วาดไว้จริง ══
   *
   * ผู้ใช้: *"Ctrl+A แล้วสั่งจัดหน้า ทำให้การตัดหน้าเละเลย"*
   *
   * ต้นตอ: ระบบนี้เดินสองขาแยกกัน — `list` (รายการเส้นคั่นของตัวจัดหน้า) กับ
   * `DecorationSet` (ของจริงที่วาดลง DOM) · ตอน `docChanged` แต่ละขาถูก map ด้วยคนละกลไก
   * (`mapBreaks(tr.mapping)` กับ `prev.map(tr.mapping, doc)`) แล้ว **เชื่อว่าผลจะตรงกันเสมอ**
   *
   * `cmd('align')` กับช่วงที่เลือกทั้งเอกสารยิง `setNodeMarkup` ทีละย่อหน้าใน transaction เดียว
   * = ReplaceAroundStep หลายสิบขั้นซ้อนกัน · widget ที่อยู่ **ตรงรอยต่อระหว่างบล็อกพอดี**
   * (เส้นคั่นระดับบล็อก) ถูก `DecorationSet.map` ตัดทิ้งไป แต่ `list` ยังครบ
   * → รอบจัดหน้าถัดมา `setBreaks()` เห็นลายเซ็นเดิม คืน `false` → **ไม่มีใครสั่งวาดใหม่เลย**
   * เส้นคั่นที่หายจึงหายถาวร (วัดจริง: โมเดลบอก 10 เส้น · บนจอเหลือ 7 · สั่งชิดซ้ายกลับก็ไม่คืน)
   * ผลบนจอ = สองหน้ากลายเป็นหน้าเดียว เนื้อไหลทะลุขอบกระดาษ = "เละ" ตรงตามที่ผู้ใช้เห็น
   *
   * ตาข่าย: จำ "รูปทรง" ที่ใช้วาดไว้ (ตำแหน่ง + เป็น inline หรือบล็อก) แล้วเทียบทุกรอบที่เอกสาร
   * เปลี่ยน — ไม่ตรงเมื่อไหร่ = วาดใหม่จาก `list` ซึ่งเป็นแหล่งความจริง
   * ได้ของแถมอีกข้อ: เส้นคั่นที่ **พลิกจาก inline เป็นบล็อก** (ย่อหน้าถูกผ่า/รวม) ก็ถูกวาดใหม่
   * ตามรูปทรงจริง จากเดิมที่ใช้ DOM ผิดชนิดค้างไปจนกว่าจะมีอะไรมากระตุกให้วาดใหม่
   */
  let shape = '';
  const shapeOf = (doc) => {
    if (!doc) return '';
    const max = doc.content.size;
    return list.filter((b) => b.pos <= max)
               .map((b) => b.pos + (isInline(doc, b.pos) ? 'i' : 'b')).join(',');
  };

  function decos(doc) {
    shape = shapeOf(doc);
    if (!list.length || !doc) return DecoSet.empty;
    const max = doc.content.size;
    const out = [];
    const asBlock = midMode === 'block';
    for (const b of list) {
      if (b.pos > max) continue;
      const mid = isInline(doc, b.pos);
      const inline = mid && !asBlock;
      const inBlock = mid && asBlock;
      out.push(Deco.widget(b.pos, () => {
        const d = document.createElement(inline ? 'span' : 'div');
        d.className = cls + (inline ? ' k-pb-inline' : inBlock ? ' k-pb-in-block' : '');
        d.dataset.page = String(b.page || '');
        // [alpha.84 ข้อ 2] อยู่ในบล็อกที่เยื้องมาแล้ว → บอก CSS ว่าต้องหักกลับกี่นิ้ว
        if (inBlock && Number.isFinite(b.ind)) d.style.setProperty('--k-pb-ind', b.ind + 'in');
        // [alpha.93 ข้อ 5] ที่ว่างท้ายหน้าที่เส้นนี้ปิด — CSS เอาไปกางเป็นก้นหน้าที่ยังว่าง
        if (Number.isFinite(b.pad) && b.pad > 0.5) d.style.setProperty('--k-pb-pad', b.pad + 'px');
        d.setAttribute('contenteditable', 'false');
        const lbl = document.createElement('span');
        lbl.className = 'sp-page-break-num';
        lbl.textContent = text(b.page);
        d.append(lbl);
        // [alpha.86] (CONTINUED) ท้ายหน้า / CONTINUED: ต้นหน้าใหม่ — **โอเวอร์เลย์ในระยะขอบ**
        // ไม่ใช่บล็อกในเนื้อหน้า จึงไม่กินโควตาบรรทัด (ตรงกับที่ pdf-generator.js วาดมาตลอด)
        // [alpha.87 ข้อ 1] บอก CSS ว่าเส้นคั่นเส้นนี้ **มีโอเวอร์เลย์มายืนด้วย** จึงต้องเปิด
        // ช่องว่างให้เท่าความสูงหนึ่งบรรทัดของฟอนต์บท — margin 14px เดิมเตี้ยกว่าตัวหนังสือ
        // แล้วโอเวอร์เลย์ล้นไปทับบรรทัดข้างเคียง (ดูกฎ .sp-page-break.k-pb-cont)
        if (b.contTop || b.contBottom) d.classList.add('k-pb-cont');
        for (const [key, cls] of [['contBottom', 'sp-cont-bottom'], ['contTop', 'sp-cont-top']]) {
          if (!b[key]) continue;
          const m = document.createElement('span');
          m.className = 'sp-cont-edge ' + cls;
          m.textContent = b[key];
          d.append(m);
        }
        const pn = numOf(b.page);
        if (pn) {
          const no = document.createElement('span');
          no.className = 'sp-page-no-next';
          no.textContent = pn;
          d.append(no);
        }
        return d;
      // [alpha.85 ข้อ 2] ★ **key ห้ามมี `pos`** — ไม่งั้นกดปุ่มทีเดียวก็เปลี่ยนคีย์ของเส้นคั่น
      // ทุกเส้นที่อยู่ใต้เคอร์เซอร์ (ตำแหน่งเลื่อนไป 1) ProseMirror จึง **ทิ้ง DOM เดิมแล้วสร้างใหม่**
      // ทั้งแถบ — แถบคั่นแผ่นสูงราว 220px หายไปแล้วโผล่กลับทุกครั้ง = อาการ "กด Enter แล้วกระพริบ"
      // คีย์ที่ผูกกับ "หน้าที่เท่าไร + รูปแบบที่วาด" คงที่ระหว่างพิมพ์ PM จึงแค่ย้ายตำแหน่งให้
      }, { side: -1,
           key: decoKey + b.page + (inline ? 'i' : inBlock ? 'b' : '') +
                '-' + (b.ind ?? '') + '-' + numOf(b.page) +
                '-' + (b.contTop || '') + '-' + (b.contBottom || '') }));
    }
    return DecoSet.create(doc, out);
  }

  function plugin() {
    return new PMPlugin({
      key,
      state: {
        init: (_c, st) => decos(st.doc),
        apply(tr, prev, _o, st) {
          if (tr.getMeta(key)) return decos(st.doc);      // มีรายการใหม่จากตัวจัดหน้า → วาดใหม่
          if (!tr.docChanged) return prev;                // ไม่มีอะไรขยับ → ใช้ของเดิมทั้งชุด
          mapBreaks(tr.mapping);
          // ส่งชุดเดิมผ่าน mapping — Decoration ตัวเดิมถูกใช้ซ้ำ ProseMirror จึงไม่แตะ DOM เลย
          const next = prev.map(tr.mapping, tr.doc);
          // ★ [alpha.130 ข้อ 1] แต่ต้องพิสูจน์ก่อนว่ามันยัง "ตรงกับรายการจริง" อยู่
          // (ดูคอมเมนต์ยาวที่ `shapeOf` — ไม่ตรงเมื่อไหร่ = เส้นคั่นหายถาวร)
          const want = shapeOf(tr.doc);
          if (want !== shape || next.find().length !== want.split(',').filter(Boolean).length) {
            return decos(tr.doc);
          }
          return next;
        },
      },
      props: { decorations(state) { return key.getState(state); } },
    });
  }

  function refresh(view) {
    if (view) view.dispatch(view.state.tr.setMeta(key, true));
  }

  /**
   * [alpha.93 ข้อ 5] ทา "ที่ว่างท้ายหน้า" ลงบนกล่องเส้นคั่นที่วาดไว้แล้ว — **ไม่ผ่าน ProseMirror**
   * widget ของ PM ถูก `ignoreMutation` อยู่แล้ว การแก้ style ตรง ๆ จึงไม่กวนการอ่าน DOM กลับ
   * และไม่ทำให้ DOM ถูกสร้างใหม่ (เงื่อนไขเดียวที่ทำให้แถบคั่นแผ่นกระพริบตอนพิมพ์)
   * @returns {number} จำนวนกล่องที่ทาได้ (0 = ยังวาดไม่ครบ)
   */
  function applyPads(dom) {
    if (!dom || !dom.querySelectorAll) return 0;
    const els = dom.querySelectorAll('.' + cls.split(' ').pop());
    if (els.length !== list.length) return 0;
    let n = 0;
    els.forEach((e, i) => {
      const pad = Number(list[i] && list[i].pad);
      e.style.setProperty('--k-pb-pad', (Number.isFinite(pad) && pad > 0.5 ? pad : 0) + 'px');
      n++;
    });
    return n;
  }

  return { key, setBreaks, breaks, setNumberLabel, plugin, refresh, applyPads };
}
