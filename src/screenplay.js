// บทหนัง WYSIWYG — element แบบ Final Draft (ยกพฤติกรรมจาก v1)
// Tab = วน element · Enter = ไป element ถัดไปตามครรลอง · ไฟล์เก็บเป็นกติกา v1 เป๊ะ
import { Schema, Fragment, Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, chainCommands } from 'prosemirror-commands';
import { parseScript, lineFor, SP_ELEMS, TAB_CYCLE, NEXT_ELEM,
         splitCharacter, withExtension, blockIsBlank,
         guessNamesForBlocks } from './fountain.js';
import { state, DEFAULT_SP_CYCLE, spCycleKeys, spKeyMatch } from './core.js';
// [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ (โมดูลบริสุทธิ์ — ไม่ import prosemirror)
import { caseTransform } from './text-case.js';

const marks = {
  strong: { parseDOM: [{ tag: 'strong' }], toDOM: () => ['strong', 0] },
  em: { parseDOM: [{ tag: 'em' }], toDOM: () => ['em', 0] },
  underline: { parseDOM: [{ tag: 'u' }], toDOM: () => ['u', 0] },
  strike: { parseDOM: [{ tag: 's' }], toDOM: () => ['s', 0] },
};

export const spSchema = new Schema({
  nodes: {
    doc: { content: '(sp|spimage)+' },
    sp: {
      content: 'inline*',
      attrs: { el: { default: 'action' }, align: { default: null } },
      parseDOM: [{ tag: 'div[data-el]', getAttrs: (d) => ({ el: d.getAttribute('data-el'),
                   align: d.style.textAlign || null }) }],
      // [alpha.60r3a] `page-break` ต้องได้คลาส `sp-page-break-el` ไม่ใช่ `sp-page-break`
      // — ชื่อหลังเป็นของ "เส้นคั่นหน้าอัตโนมัติ" ที่ paginate() วาดให้ ถ้าใช้ชื่อเดียวกันจะทับสไตล์กัน
      toDOM: (n) => ['div', { 'data-el': n.attrs.el,
                     class: 'sp sp-' + (n.attrs.el === 'page-break' ? 'page-break-el' : n.attrs.el),
                     ...(n.attrs.align ? { style: 'text-align:' + n.attrs.align } : {}) }, 0],
    },
    // รูปในบทหนัง — atom (แก้ text ไม่ได้ · ลากได้) เก็บ md เดิมเป๊ะ ไม่กลายเป็นข้อความ
    spimage: {
      group: 'block', atom: true, draggable: true, selectable: true,
      attrs: { src: {}, alt: { default: '' }, md: { default: '' }, resolved: { default: '' } },
      parseDOM: [{ tag: 'figure[data-md]', getAttrs: (d) => ({
        src: d.getAttribute('data-src') || '', alt: d.getAttribute('data-alt') || '',
        md: d.getAttribute('data-md') || '', resolved: '' }) }],
      toDOM: (n) => ['figure', { 'data-md': n.attrs.md, 'data-src': n.attrs.src,
                                 'data-alt': n.attrs.alt, class: 'sp sp-image',
                                 title: n.attrs.alt || '' },
                     ['img', { src: n.attrs.resolved || n.attrs.src,
                               alt: n.attrs.alt, draggable: 'false' }]],
    },
    text: { group: 'inline' },
  },
  marks,
});

// inline **หนา** ฯลฯ — ชุดเดียวกับ md.js (import ตรงจะวนกันเอง จึงรับผ่านพารามิเตอร์)
import { mdToDoc, docToMd } from './md.js';
import { spellPlugin, mentionPlugin, refreshMentions, focusLinePlugin, commentAnchorPlugin,
         keepScroll } from './editor.js';
// [61] แสดงรูปแบบ + [57] เส้นคั่นหน้าในตัวแก้ไข
import { spFormatGuidePlugin, spPageBreakPlugin, spSceneNumberPlugin, spContinuedPlugin,
         refreshFormatGuide, refreshPageBreaks, refreshSceneNumbers,
         refreshContinueds } from './sp-format-guide.js';
import { IMG_RE } from './fountain.js';
function inlineContent(text) {
  const doc = mdToDoc(text);
  const p = (doc.content || [])[0] || {};
  return (p.type === 'paragraph' ? p.content : null) || (text ? [{ type: 'text', text }] : []);
}
function inlineToMd(content) {
  return docToMd({ type: 'doc', content: [{ type: 'paragraph', content }] });
}

/** แปลง markdown ของบท → doc ของ spSchema (ใช้ทั้งตอนสร้างตัวแก้ไขและตอน setMarkdown) */
export function spDocFromMarkdown(markdown, resolveSrc = (p) => p) {
  const blocks = parseScript(markdown || '').map((b) => {
    if (b.el === 'image') {
      const m = IMG_RE.exec(b.text) || [];
      return { type: 'spimage', attrs: { alt: m[1] || '', src: m[2] || '',
               md: b.text, resolved: resolveSrc(m[2] || '') } };
    }
    return {
      type: 'sp',
      attrs: { el: b.el === 'blank' ? 'action' : b.el },
      content: b.el === 'raw'
        ? (b.text ? [{ type: 'text', text: b.text }] : [])
        : inlineContent(b.text),
    };
  });
  if (!blocks.length) blocks.push({ type: 'sp', attrs: { el: 'scene' } });
  return spSchema.nodeFromJSON({ type: 'doc', content: blocks });
}

export class SPEditor {
  constructor(mount, { markdown = '', onChange = null, onKeyDown = null,
                       onElement = null, getChecker = null, resolveSrc = (p) => p,
                       getNames = null, onMention = null, editable = null } = {}) {
    this.onChange = onChange; this.onElement = onElement;
    this.getChecker = getChecker; this.resolveSrc = resolveSrc;
    this.getNames = getNames;
    const doc = spDocFromMarkdown(markdown, resolveSrc);
    const self = this;
    this.view = new EditorView(mount, {
      editable: editable ? () => editable() : undefined,
      state: EditorState.create({
        doc, schema: spSchema,
        plugins: [
          ...(getNames ? [mentionPlugin(getNames)] : []),
          // [แก้ไข feature 1] ปุ่มควบคุม element ย้ายไปที่ handleKeyDown ทั้งหมด
          // (ผู้ใช้ตั้งปุ่มเองได้ + ปิดระบบได้ → ผูกกับ keymap ที่เป็นชื่อปุ่มตายตัวไม่ได้)
          // ที่เหลือไว้กัน Tab ย้ายโฟกัสออกจากตัวแก้ไขเมื่อผู้ใช้ย้ายคำสั่งไปปุ่มอื่น
          keymap({
            // [alpha.61 ข้อ 3] Tab ที่ไม่ถูกผูกกับ "เลือกหมวด" ต้องเยื้องข้อความจริง
            // (เดิม `() => true` กลืนทิ้งเฉย ๆ → โหมดบทหนังไม่มี Tab ใช้เลย)
            Tab: (st, dispatch) => {
              if (!st.selection.$from.parent.inlineContent) return true;
              if (dispatch) dispatch(st.tr.insertText('\t').scrollIntoView());
              return true;
            },
            'Shift-Tab': (st, dispatch) => {
              const { $from, empty } = st.selection;
              const off = $from.parentOffset;
              if (empty && off > 0 && $from.parent.textBetween(off - 1, off) === '\t') {
                if (dispatch) dispatch(st.tr.delete($from.start() + off - 1, $from.start() + off));
              }
              return true;
            },
            // [alpha.61 ข้อ 3] Ctrl/⌘+Enter = ขึ้นหน้าใหม่ (element `page-break` = `---` ในไฟล์)
            'Mod-Enter': () => { self.insertPageBreak(); return true; },
            'Mod-ArrowDown': () => { self.cycle(1); return true; },   // สลับรูปแบบถัดไป
            'Mod-ArrowUp': () => { self.cycle(-1); return true; },    // สลับรูปแบบก่อนหน้า
          }),
          keymap(baseKeymap),
          history(),
          ...(getChecker ? [spellPlugin(getChecker)] : []),
          focusLinePlugin(),
          commentAnchorPlugin(),
          spFormatGuidePlugin(),      // [61] เส้นขอบ element + เครื่องหมายจบบรรทัด
          spPageBreakPlugin(),        // [57] เส้นคั่นหน้า (ตำแหน่งมาจาก paginate ใน app.js)
          spSceneNumberPlugin(),      // [alpha.57a] เลขฉากสองฝั่งหัวฉาก
          spContinuedPlugin(),        // [alpha.58 · 55–56] (CONTINUED)/CONTINUED:/(MORE)/(cont'd)
        ],
      }),
      handleKeyDown(view, ev) {
        // [53] Parenthetical auto-wrap: กด ( ในบทพูด "ที่ยังว่าง" → กลายเป็นวงเล็บ
        //
        // [alpha.60r3a บั๊ก] เดิมครอบ `character` ด้วย → พิมพ์ `@dave` แล้วเคาะ ` (V.O.)`
        // บรรทัดชื่อตัวละครกลายเป็น parenthetical ทันทีที่กด `(` — ผิดสองชั้น:
        //   (ก) วงเล็บท้ายชื่อตัวละครคือ **ส่วนเสริม** (V.O./O.S./cont'd) ไม่ใช่วงเล็บบอกอารมณ์
        //   (ข) มาตรฐานกำหนดว่า **วงเล็บต้องอยู่บรรทัดใต้ตัวละครเท่านั้น**
        // และเดิมยังเปลี่ยนบทพูดที่พิมพ์ไปแล้วครึ่งประโยคด้วย — วงเล็บกลางประโยคเป็นเครื่องหมายวรรคตอนปกติ
        // → ตอนนี้แปลงเฉพาะ "บทพูดที่ยังไม่มีข้อความ" เท่านั้น
        if (ev.key === '(' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          const el = self.curElement();
          const cur = self.curBlock();
          if (el === 'dialogue' && cur && cur.node.content.size === 0) {
            ev.preventDefault();
            const { node, pos } = cur;
            const from = view.state.selection.from;
            let tr = view.state.tr;
            tr = tr.setNodeMarkup(pos, null, { el: 'parenthetical', align: node.attrs.align || null });
            tr = tr.insertText('()', from);
            tr = tr.setSelection(TextSelection.create(tr.doc, from + 1));
            view.dispatch(tr);
            if (self.onElement) self.onElement('parenthetical');
            return true;
          }
        }
        // [77] Non-breaking space — Ctrl+Shift+Space
        if (ev.code === 'Space' && (ev.ctrlKey || ev.metaKey) && ev.shiftKey) {
          ev.preventDefault();
          view.dispatch(view.state.tr.insertText('\u00A0'));
          return true;
        }
        // [แก้ไข feature 1] ปุ่มสลับ element — ค่าเริ่มต้น Tab / Shift+Tab / Enter แต่ผู้ใช้เปลี่ยนได้
        // และปิดทั้งระบบได้ (spCycleEnabled=false → Enter ขึ้นบรรทัดใหม่ชนิดเดิมเท่านั้น)
        const cycleOn = state.settings?.spCycleEnabled !== false;
        const K = spCycleKeys(state.settings);
        for (const dir of ['shiftTab', 'tab', 'enter']) {
          if (!spKeyMatch(K[dir], ev)) continue;
          // SmartType มาก่อนเสมอ (ปุ่มยืนยันคำเดา = Tab · บั๊ก #1 ห้ามใช้ Enter)
          if (onKeyDown && onKeyDown(ev)) { ev.preventDefault(); return true; }
          if (!cycleOn) {
            if (dir !== 'enter') return false;
            ev.preventDefault(); return self.enter(true);   // ปิดระบบ = ขึ้นบรรทัดใหม่ชนิดเดิม
          }
          ev.preventDefault();
          return dir === 'enter' ? self.enter() : self._tabCycle(dir);
        }
        return onKeyDown ? onKeyDown(ev) : false;
      },
      // [93] Auto-capitalize: ขึ้นต้นประโยคด้วยตัวใหญ่ + i→I
      handleTextInput(view, from, to, text) {
        if (text.length > 20) return false;  // กัน paste ใหญ่ ๆ
        return self._handleAutoText(view, from, to, text);
      },
      handleDOMEvents: {
        // Ctrl/Cmd+คลิก หรือคลิกกลาง บนชื่อ Wiki → เปิดหน้า Wiki (เหมือนโหมดนิยาย)
        mousedown(view, ev) {
          if (!onMention || !(ev.ctrlKey || ev.metaKey)) return false;
          const t = ev.target && ev.target.closest && ev.target.closest('.k-mention');
          if (!t) return false;
          ev.preventDefault(); onMention(t.textContent.replace(/^\[\[|\]\]$/g, '')); return true;
        },
        auxclick(view, ev) {
          if (!onMention || ev.button !== 1) return false;
          const t = ev.target && ev.target.closest && ev.target.closest('.k-mention');
          if (!t) return false;
          ev.preventDefault(); onMention(t.textContent.replace(/^\[\[|\]\]$/g, '')); return true;
        },
      },
      dispatchTransaction(tr) {
        const st = self.view.state.apply(tr);
        self.view.updateState(st);
        if (tr.docChanged) {
          if (self.onChange) self.onChange();
          // [52] Auto-detect INT./EXT. → switch to scene
          self._autoDetect();
        }
        if (self.onElement) self.onElement(self.curElement());
      },
    });
  }
  refreshMentions() { refreshMentions(this.view); }

  /** แทนที่เนื้อหาทั้งเอกสารด้วย markdown ใหม่ (เก็บ undo history ไว้) */
  setMarkdown(md) {
    const v = this.view;
    const doc = spDocFromMarkdown(md, this.resolveSrc);
    v.dispatch(v.state.tr.replaceWith(0, v.state.doc.content.size, doc.content));
    return true;
  }

  /**
   * [alpha.82] แทรกบทฉบับ fountain ตรงเคอร์เซอร์ — `@ชื่อ` กลายเป็น element "ตัวละคร" จริง
   *
   * แทรกเป็นข้อความเปล่าไม่ได้: doc ของบทเป็นลำดับโหนด `sp` ที่มี attr `el` กำกับชนิดอยู่
   * ยัด `@โทระ` ลงไปดื้อ ๆ จะได้บรรทัด action ที่หน้าตาเหมือนชื่อตัวละครแต่จัดหน้า/ส่งออกผิดหมด
   * @returns {boolean}
   */
  insertScript(md) {
    const v = this.view;
    const text = String(md ?? '').trim();
    if (!v || !text) return false;
    const doc = spDocFromMarkdown(text, this.resolveSrc);
    const nodes = [];
    doc.content.forEach((n) => nodes.push(n));
    if (!nodes.length) return false;
    // openStart/openEnd = 0 → แต่ละ element เป็นบล็อกของตัวเอง ไม่ไปเชื่อมกับบล็อกที่เคอร์เซอร์อยู่
    // (ต่างจากนิยาย — ที่นั่นเชื่อมกลางย่อหน้าได้ ที่นี่เชื่อมแล้วชนิด element เพี้ยน)
    v.dispatch(v.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0))
      .scrollIntoView());
    v.focus();
    return true;
  }

  // [61][57] วาด decoration ของ "แสดงรูปแบบ" / เส้นคั่นหน้าใหม่ (เรียกหลังเปลี่ยนค่าตั้ง)
  refreshGuides() {
    refreshFormatGuide(this.view); refreshPageBreaks(this.view); refreshSceneNumbers(this.view);
    refreshContinueds(this.view);
  }

  /** [alpha.57a ข้อ 2] ใส่/ถอด "ส่วนเสริม" ท้ายชื่อตัวละคร — เว้นจากชื่อ 1 วรรคเสมอ */
  setExtension(ext) {
    const b = this.curBlock();
    if (!b || b.node.attrs.el !== 'character') return false;
    const { node, pos } = b;
    const next = withExtension(node.textContent || '', ext);
    const v = this.view;
    const from = pos + 1, to = pos + 1 + node.content.size;
    let tr = next ? v.state.tr.insertText(next, from, to) : v.state.tr.delete(from, to);
    tr = tr.setSelection(TextSelection.create(tr.doc, from + next.length));
    v.dispatch(tr);
    v.focus();
    return true;
  }
  /** ส่วนเสริมของบล็อกตัวละครที่เคอร์เซอร์อยู่ ('' = ไม่มี) */
  curExtension() {
    const b = this.curBlock();
    if (!b || b.node.attrs.el !== 'character') return '';
    return splitCharacter(b.node.textContent || '').ext;
  }

  /** [78] ย้ายเคอร์เซอร์ไปตำแหน่ง pos แล้วเลื่อนจอให้เห็น */
  gotoPos(pos) {
    const v = this.view;
    const max = v.state.doc.content.size;
    const p = Math.max(0, Math.min(Number(pos) || 0, max));
    const $p = v.state.doc.resolve(p);
    const sel = TextSelection.near($p, 1);
    v.dispatch(v.state.tr.setSelection(sel).scrollIntoView());
    v.focus();
    return true;
  }

  /**
   * บล็อก sp ที่เคอร์เซอร์อยู่ — **คืน `null` ได้** เมื่อ selection ไม่ได้อยู่ในบล็อก sp
   *
   * [alpha.78] เดิมคืน `{ node: $f.node(1), pos: $f.before(1) }` ดื้อ ๆ
   * เอกสารบทหนังเป็น `(sp|spimage)+` — เลือกรูป (atom) อยู่ = NodeSelection ระดับบนสุด
   * `$f.depth` เป็น 0 → `node` เป็น undefined · ผู้เรียกที่ไม่ได้กันไว้ก็ throw
   * และถ้า throw ใน `dispatchTransaction` (เช่น `_autoDetect` หลัง insertImage) **renderer ตายทั้งตัว**
   * → ย้ายการกันมาไว้ที่ต้นทางที่เดียว ผู้เรียกเช็ค null พอ
   */
  curBlock() {
    const $f = this.view.state.selection.$from;
    if ($f.depth < 1) return null;
    const node = $f.node(1);
    if (!node || node.type !== spSchema.nodes.sp) return null;
    return { node, pos: $f.before(1) };
  }
  curElement() { const b = this.curBlock(); return b ? b.node.attrs.el : 'action'; }

  setElement(el) {
    const b = this.curBlock();
    if (!b) return false;                      // เลือกรูปอยู่ = ไม่มีบล็อกให้เปลี่ยนชนิด
    this.view.dispatch(this.view.state.tr.setNodeMarkup(b.pos, null,
      { el, align: b.node.attrs.align || null }));
    this.view.focus();
    if (this.onElement) this.onElement(el);
    return true;
  }

  // จัดหน้าบล็อกบทหนังในช่วงเลือก (arg: 'left'|'center'|'right'|'justify')
  setAlign(align) {
    const v = this.view;
    const val = align === 'left' ? null : align;
    const { from, to } = v.state.selection;
    let tr = v.state.tr, changed = false;
    v.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === spSchema.nodes.sp) {
        tr = tr.setNodeMarkup(pos, null, { ...node.attrs, align: val }); changed = true;
      }
    });
    if (changed) v.dispatch(tr);
    v.focus();
  }
  curAlign() { const b = this.curBlock(); return (b && b.node.attrs.align) || 'left'; }

  cycle(dir) {
    const cur = this.curElement();
    const i = TAB_CYCLE.indexOf(cur);
    const next = TAB_CYCLE[(i === -1 ? 0 : i + dir + TAB_CYCLE.length) % TAB_CYCLE.length];
    this.setElement(next);
  }

  // [95] Per-element switch — Ctrl+1..9
  switchTo(el) { this.setElement(el); }

  // [51] Tab/Shift-Tab cycle ตาม spCycle
  _tabCycle(dir) {
    const cur = this.curElement();
    const spCycle = state.settings?.spCycle || DEFAULT_SP_CYCLE;
    const cfg = spCycle[cur];
    if (!cfg) return true;
    const nextEl = cfg[dir];
    if (nextEl) this.setElement(nextEl);
    return true;
  }

  // [52] Auto-detect INT./EXT. — ตรวจหลังพิมพ์ทุกครั้ง
  _autoDetect() {
    const el = this.curElement();
    if (el === 'scene') return;
    // เลือกรูปอยู่ = ไม่มีบล็อกให้ตรวจ · ห้าม throw เด็ดขาด — ตรงนี้ถูกเรียกใน dispatchTransaction
    // ถ้า throw ที่นี่ renderer ตายทั้งตัว ไม่ใช่แค่คำสั่งนั้นล้ม (เจอจริงตอน insertImage)
    const cur = this.curBlock();
    if (!cur) return;
    const text = cur.node.textContent.trim();
    if (/^(int\.|ext\.|int\/ext\.|i\/e\.|est\.|ฉาก)\s/i.test(text)) {
      const { node, pos } = cur;
      this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, {
        el: 'scene', align: node.attrs.align || null
      }));
      if (this.onElement) this.onElement('scene');
    }
  }

  // [79] เลือกทั้งฉาก (ทุกบรรทัดระหว่างหัวฉาก) + กดซ้ำ = select all
  selectScene() {
    const v = this.view;
    const curPos = v.state.selection.$from.before(1);
    let start = curPos + 1, end = v.state.doc.content.size;
    // หาหัวฉากก่อนหน้า (รวมบล็อกปัจจุบันถ้าเป็น scene)
    let lastScene = 0;
    v.state.doc.forEach((node, pos) => {
      if (pos > curPos) return false;
      if (node.type.name === 'sp' && node.attrs.el === 'scene') lastScene = pos;
    });
    if (lastScene > 0) start = lastScene + 1;
    // หาหัวฉากถัดไป (หลัง curPos) — จบที่ก่อนบล็อกถัดไป
    v.state.doc.forEach((node, pos) => {
      if (pos <= curPos) return;
      if (node.type.name === 'sp' && node.attrs.el === 'scene') { end = pos; return false; }
    });
    // กดซ้ำ = select all
    const sel = v.state.selection;
    if (sel.from === start && sel.to === end && start > 1 && end !== v.state.doc.content.size) {
      // เลือกทั้งเอกสาร: เริ่มหลัง doc โหนด, จบท้ายสุด
      const firstPos = v.state.doc.firstChild ? 2 : 0;
      start = firstPos; end = v.state.doc.content.size;
    }
    v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, start, end)));
    v.focus();
  }

  /**
   * [alpha.61 ข้อ 3] Ctrl+Enter — ขึ้นหน้าใหม่ด้วยมือ
   * แทรก element `page-break` (เขียนลงไฟล์เป็น `---`) ต่อท้ายบล็อกปัจจุบัน
   * แล้วต่อด้วยบล็อก `action` ว่างให้พิมพ์ต่อ — ไม่แปลงบล็อกเดิมทิ้ง
   */
  insertPageBreak() {
    const v = this.view;
    const { $from } = v.state.selection;
    const at = $from.after(1);
    const pb = spSchema.nodes.sp.create({ el: 'page-break' });
    const next = spSchema.nodes.sp.create({ el: 'action' });
    let tr = v.state.tr.insert(at, [pb, next]);
    tr = tr.setSelection(TextSelection.create(tr.doc, at + pb.nodeSize + 1));
    v.dispatch(tr.scrollIntoView());
    if (this.onElement) this.onElement('action');
    return true;
  }

  // sameEl = true → ขึ้นบรรทัดใหม่ชนิดเดิม (ใช้ตอนผู้ใช้ปิดระบบปุ่มสลับ element)
  //
  // [alpha.78] **Enter กลางบล็อกต้องผ่าบล็อกจริง**
  // เดิมทำอย่างเดียวคือ `insert($from.after(1))` = แทรกบล็อกเปล่าต่อท้ายเสมอ
  // → เคอร์เซอร์อยู่กลางประโยคแล้วกด Enter ข้อความ**ไม่ถูกแบ่ง** ได้แค่บล็อกว่างงอกข้างล่าง
  //   (และถ้าเลือกข้อความไว้ ตัวที่เลือกก็ไม่ถูกลบ) — พิมพ์แทรกกลางฉากที่เขียนไว้แล้วไม่ได้เลย
  //
  // กติกา:
  //   · เคอร์เซอร์ท้ายบล็อก **หรือต้นบล็อก** → เหมือนเดิมเป๊ะ: บล็อกใหม่ว่าง ชนิด "ถัดไปตามครรลอง"
  //     (ท้ายบล็อก = ทางที่ใช้บ่อยสุด พิมพ์หัวฉากจบแล้ว Enter ได้บรรยายต่อ · ต้นบล็อกคงไว้
  //      ตามกติกา "Enter = ไป element ถัดไป" ที่ตั้งใจออกแบบไว้ — มีเทส [51] คุมอยู่)
  //   · **มีข้อความทั้งสองฝั่งของเคอร์เซอร์** → ผ่าบล็อก และ **ท่อนหลังคงชนิดเดิม** ไม่ใช่ "ชนิดถัดไป"
  //     เพราะท่อนหลังคือเนื้อเดียวกับท่อนหน้า (ผ่ากลางบทพูดต้องได้บทพูด ไม่ใช่บรรยาย)
  enter(sameEl) {
    const v = this.view;
    const cur = this.curElement();
    const spCycle = state.settings?.spCycle || DEFAULT_SP_CYCLE;
    const nextEl = sameEl ? cur : ((spCycle[cur]?.enter) || NEXT_ELEM[cur] || 'action');

    let tr = v.state.tr;
    // เลือกข้อความ **ในบล็อก sp เดียวกัน** ไว้แล้วกด Enter = ทับของที่เลือก แล้วค่อยผ่า
    // จำกัดไว้แค่กรณีนี้เท่านั้น — ถ้าเลือก "รูป" อยู่ (NodeSelection) แล้วเผลอ deleteSelection
    // รูปจะหายไปหนึ่งใบ แล้วบล็อกใหม่มาแทน = จำนวนบล็อกเท่าเดิม (Enter กลายเป็นลบรูป)
    {
      const s = tr.selection;
      const inOneSp = s.$from.depth >= 1 && s.$from.parent.type === spSchema.nodes.sp &&
                      s.$to.parent === s.$from.parent;
      if (!s.empty && inOneSp) tr = tr.deleteSelection();
    }
    const $f = tr.selection.$from;

    // รูป (spimage) เป็น atom ไม่มี inline ให้ผ่า → ใช้ทางเดิม (แทรกบล็อกใหม่ต่อท้าย)
    // ผ่าเฉพาะตอน "มีข้อความทั้งสองฝั่ง" — ต้นบล็อก/ท้ายบล็อกไม่มีอะไรให้ผ่าอยู่แล้ว
    const midway = $f.parent.type === spSchema.nodes.sp &&
                   $f.parentOffset > 0 && $f.parentOffset < $f.parent.content.size;

    if (midway) {
      const tailEl = $f.parent.attrs.el;
      tr = tr.split($f.pos, 1, [{ type: spSchema.nodes.sp,
                                  attrs: { el: tailEl, align: $f.parent.attrs.align || null } }]);
      // เคอร์เซอร์ไปต้นท่อนหลัง (split ดันตำแหน่งเดิมออกมานอกบล็อกแรก)
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map($f.pos)), 1));
      v.dispatch(tr.scrollIntoView());
      if (this.onElement) this.onElement(tailEl);
      return true;
    }

    const sp = spSchema.nodes.sp.create({ el: nextEl });
    // เลือกรูปอยู่ (NodeSelection ระดับบนสุด · depth 0) → `$f.after(1)` throw
    // ใช้ปลายของ selection แทน = แทรกบล็อกใหม่ต่อจากรูป
    const insertAt = $f.depth >= 1 ? $f.after(1) : tr.selection.to;
    tr = tr.insert(insertAt, sp);
    tr = tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
    v.dispatch(tr.scrollIntoView());
    if (this.onElement) this.onElement(nextEl);
    return true;
  }

  // [alpha.78] ล็อกตำแหน่งเลื่อนหน้าถ้าช่วงที่เลือกยังเห็นอยู่ (ดู keepScroll ใน editor.js)
  cmd(name, arg) { return keepScroll(this.view, () => this._cmd(name, arg)); }

  _cmd(name, arg) {
    const v = this.view;
    const run = (c) => { c(v.state, v.dispatch, v); v.focus(); };
    const mk = { bold: 'strong', italic: 'em', underline: 'underline', strike: 'strike' }[name];
    if (mk) return run(toggleMark(spSchema.marks[mk]));
    if (name === 'undo') return run(undo);
    if (name === 'redo') return run(redo);
    if (name === 'align') return this.setAlign(arg);
    // [alpha.60r2 ข้อ 2] สลับรูปตัวพิมพ์ของช่วงที่เลือก — ใช้ตัวเดียวกับโหมดนิยาย
    if (name === 'case') {
      const tr = caseTransform(v.state, arg);
      if (tr) v.dispatch(tr.scrollIntoView());
      v.focus();
      return !!tr;
    }
  }

  getMarkdown() {
    const lines = [];
    // เก็บโหนดเป็นอาร์เรย์ก่อน — lineFor ต้องรู้ว่า "บล็อกถัดไปว่างไหม" (ตัวจับชื่อตัวละคร
    // อัตโนมัติใน classify บังคับให้ตัวละครมีบทพูดตามมาติด ๆ) ไม่งั้นบรรยายสั้น ๆ ที่ตามด้วย
    // บรรทัดว่างจะถูกเติม `!` นำหน้าโดยไม่จำเป็น
    const nodes = [];
    this.view.state.doc.forEach((node) => { nodes.push(node); });
    const asBlock = (node) => node.type.name === 'spimage'
      ? { el: 'image', text: node.attrs.md || `![${node.attrs.alt || ''}](${node.attrs.src || ''})` }
      : { el: node.attrs.el,
          text: node.attrs.el === 'raw' ? node.textContent : inlineToMd(node.toJSON().content || []) };
    // เอกสารมีบล็อกตัวละครอยู่ = ไฟล์จะมี `@` แน่นอน → ตอนอ่านกลับตัวเดาชื่อจะถูกปิด
    // ตรงนี้ต้องปิดตามให้ตรงกัน ไม่งั้นเขียนกันเหนียวด้วย `!` ทั้งที่ไม่จำเป็น
    const guessNames = guessNamesForBlocks(nodes.map(asBlock));
    let prevBlank = true, prevType = 'action';
    nodes.forEach((node, i) => {
      const { el, text } = asBlock(node);
      const nextBlank = i + 1 >= nodes.length || blockIsBlank(asBlock(nodes[i + 1]));
      const line = lineFor(el, text, prevBlank, prevType, nextBlank, guessNames);
      lines.push(line);
      if (line.trim() === '') prevBlank = true;
      else { prevBlank = false; prevType = el; }
    });
    return lines.join('\n');
  }

  // แทรกรูปในบทหนัง (เรียกจาก insertImage ของ app.js)
  insertImage(src, alt, md) {
    const node = spSchema.nodes.spimage.create({ src, alt, md, resolved: this.resolveSrc(src) });
    this.view.dispatch(this.view.state.tr.replaceSelectionWith(node).scrollIntoView());
    this.view.focus();
  }

  // [93] Auto-capitalize sentences + i→I ในบทหนัง
  _handleAutoText(view, from, to, text) {
    const s = state.settings;
    if (!s.spAutoCapitalize && !s.spAutoCorrectI) return false;
    let modified = text;
    if (s.spAutoCapitalize) {
      const $from = view.state.doc.resolve(from);
      // ขึ้นต้นบล็อก → ตัวใหญ่
      if ($from.parentOffset === 0) {
        modified = modified.replace(/^[a-z]/, (c) => c.toUpperCase());
      } else if ($from.parentOffset >= 2) {
        const before = $from.parent.textBetween($from.parentOffset - 2, $from.parentOffset);
        if (/[.!?]\s$/.test(before)) {
          modified = modified.replace(/^[a-z]/, (c) => c.toUpperCase());
        }
      }
    }
    if (s.spAutoCorrectI && modified.length <= 2) {
      const $from = view.state.doc.resolve(from);
      const solo = $from.parentOffset === 0 || $from.parent.textBetween($from.parentOffset - 1, $from.parentOffset).endsWith(' ');
      if (solo && /^i$/i.test(modified.trim())) {
        modified = 'I' + modified.slice(1);
      }
    }
    if (modified !== text) {
      view.dispatch(view.state.tr.insertText(modified, from, to));
      return true;
    }
    return false;
  }

  getText() { return this.view.state.doc.textBetween(0, this.view.state.doc.content.size, '\n'); }
  focus() { this.view.focus(); }
  destroy() { this.view.destroy(); }
}
