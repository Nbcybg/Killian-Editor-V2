// SmartType — เดาชื่อจาก Wiki ขณะพิมพ์ (ยกพฤติกรรมจาก v1)
// พิมพ์ตัวอักษรต้นของชื่อ (≥2 ตัว) → popup รายชื่อ · ↑↓ เลือก · **Tab** ยืนยัน · Esc ปิด
// (Enter ปล่อยให้ตัวแก้ไขขึ้นบรรทัดใหม่ตามปกติ — ดู onKey ท้ายไฟล์)
//
// กฎข้อ 26 ของ AGENTS.md: ไฟล์นี้ใช้ `t` เป็นชื่อพารามิเตอร์อยู่แล้ว (บรรทัด startsWith)
// → นำเข้าฟังก์ชันแปลภาษาในชื่อ `tr` เท่านั้น ห้ามใช้ `t`
import { t as tr } from './i18n.js';

export class SmartType {
  constructor() {
    this.names = [];
    this.items = [];
    this.sel = 0;
    this.prefixLen = 0;
    this.box = document.createElement('div');
    this.box.className = 'smart-pop';
    this.box.style.display = 'none';
    document.body.appendChild(this.box);
  }

  async loadNames(root) {
    // ชื่อจาก Wiki ทุกที่ + จำหมวดและไฟล์ต้นทาง (ให้คลิกชื่อแล้วเปิด Wiki ได้)
    const names = new Set();
    this.byCat = {};
    this.fileOf = {};
    this.titles = [];
    const scanWiki = async (wikiDir) => {
      if (!(await kapi.exists(wikiDir))) return;
      for (const cat of await kapi.listDirs(wikiDir)) {
        const catDir = await kapi.join(wikiDir, cat);
        for (const f of await kapi.listFiles(catDir, '.json')) {
          try {
            const p = await kapi.join(catDir, f);
            const e = await kapi.readJson(p);
            const extra = [...(Array.isArray(e.aliases) ? e.aliases : []),
                           ...(Array.isArray(e.aka) ? e.aka : [])];
            if (e.name && !this.titles.includes(e.name)) this.titles.push(e.name);
            for (const n of [e.name, ...extra]) {
              if (!n) continue;
              names.add(n);
              this.fileOf[n] = p;
              (this.byCat[cat] = this.byCat[cat] || []).push(n);
            }
          } catch {}
        }
      }
    };
    await scanWiki(await kapi.join(root, 'Wiki'));
    await scanWiki(await kapi.join(root, 'Bible'));      // ชื่อเดิมของ v1
    for (const sec of await kapi.listDirs(root)) {
      await scanWiki(await kapi.join(root, sec, 'Wiki'));
      await scanWiki(await kapi.join(root, sec, 'Bible'));
    }
    this.names = [...names];
  }

  get visible() { return this.box.style.display !== 'none'; }

  // เรียกหลังทุกการพิมพ์: ดูข้อความก่อนเคอร์เซอร์ หาชื่อที่ขึ้นต้นตรงกัน
  // opts.minLen = จำนวนอักษรขั้นต่ำที่เริ่มเดา (บทหนังแบบ Final Draft = 1: พิมพ์ e → EXT.)
  // opts.ci = จับคู่โดยไม่สนตัวพิมพ์เล็กใหญ่ (หัวฉาก/ทรานซิชัน)
  check(view, list, opts = {}) {
    return this._check(view, list || this.names, opts);
  }

  _check(view, NAMES, opts = {}) {
    const minLen = opts.minLen || 2;
    const ci = !!opts.ci;
    const eq = ci ? (a, b) => a.toLowerCase() === b.toLowerCase() : (a, b) => a === b;
    const starts = ci
      ? (n, t) => n.toLowerCase().startsWith(t.toLowerCase())
      : (n, t) => n.startsWith(t);
    const { $from, empty } = view.state.selection;
    if (!empty || !$from.parent.isTextblock) return this.hide();
    const before = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - 24), $from.parentOffset, '\n');
    let best = [];
    let bestLen = 0;
    for (let k = Math.min(before.length, 18); k >= minLen; k--) {
      const tail = before.slice(-k);
      if (/\s/.test(tail[0]) && k > minLen) continue;
      const hit = NAMES.filter((n) => starts(n, tail) && !eq(n, tail));
      if (hit.length) { best = hit.slice(0, 8); bestLen = k; break; }
    }
    if (!best.length) return this.hide();
    this.items = best; this.sel = 0; this.prefixLen = bestLen;
    this.render();
    const c = view.coordsAtPos(view.state.selection.from);
    this.place(c);
  }

/**
   * [alpha.124 ข้อ 34] วางกล่องเดาชื่อโดย **ไม่ล้นจอ**
   *
   * เดิมเซ็ต `left = c.left` / `top = c.bottom + 6` ตรง ๆ → พิมพ์ใกล้ขอบล่างของจอ
   * กล่องจะโผล่ใต้เคอร์เซอร์แล้วทะลุออกนอกหน้าต่าง (มองไม่เห็นเลยว่ามีตัวเลือกอะไร)
   * และพิมพ์ชิดขอบขวาก็โดนตัดข้าง ๆ เหมือนกัน
   *
   * กติกา: ล่างไม่พอ → **พลิกขึ้นไปอยู่เหนือบรรทัด** · ขวาไม่พอ → เลื่อนซ้ายให้พอดีขอบ
   * ต้องวัดหลังจากกล่องแสดงผลแล้วเท่านั้น (ตอนซ่อนอยู่ `offsetHeight` = 0)
   */
  place(c) {
    const box = this.box;
    box.style.display = 'block';
    box.style.left = '0px'; box.style.top = '0px';       // รีเซ็ตก่อนวัด ไม่งั้นค่าที่ได้เพี้ยนตามรอบก่อน
    const w = box.offsetWidth, h = box.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    const GAP = 6, PAD = 8;
    let left = c.left;
    if (left + w > vw - PAD) left = Math.max(PAD, vw - w - PAD);
    let top = c.bottom + GAP;
    // ล่างไม่พอ และข้างบนมีที่มากกว่า → พลิกขึ้น
    if (top + h > vh - PAD && c.top - GAP - h > PAD) top = c.top - GAP - h;
    else if (top + h > vh - PAD) top = Math.max(PAD, vh - h - PAD);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  }

  render() {
    this.box.innerHTML = '';
    this.items.forEach((n, i) => {
      const d = document.createElement('div');
      d.className = 'smart-item' + (i === this.sel ? ' on' : '');
      d.textContent = n;
      d.onmousedown = (e) => { e.preventDefault(); this.sel = i; this._accept(); };
      // [alpha.57a ข้อ 4] คลิกขวาที่คำเดา = สั่งไม่ให้จำคำนั้นอีก (app.js ผูก onIgnore ให้)
      d.oncontextmenu = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (typeof this.onIgnore === 'function') this.onIgnore(n);
        this.hide();
      };
      this.box.appendChild(d);
    });
    // [alpha.124 ข้อ 34] คำใบ้ว่ากดอะไร — เดิมต้องเดาเอาเองว่า Tab คือปุ่มรับคำ
    // (ผู้ใช้ใหม่มักกด Enter แล้วได้ขึ้นบรรทัดใหม่ทับคำที่กำลังจะเติม)
    const hint = document.createElement('div');
    hint.className = 'smart-hint';
    hint.textContent = tr('ui.smart.acceptHint');
    this.box.appendChild(hint);
  }

  hide() { this.box.style.display = 'none'; this.items = []; }

  bindView(view) { this._view = view; }

  _accept() {
    const view = this._view;
    if (!view || !this.items.length) return;
    const name = this.items[this.sel];
    const to = view.state.selection.from;
    view.dispatch(view.state.tr.insertText(name, to - this.prefixLen, to));
    this.hide(); view.focus();
  }

  // คืน true = กิน key แล้ว
  // บั๊ก #1: เดิม Enter ก็ยืนยันคำเดา → ในบล็อก "ตัวละคร" ของบทหนัง พิมพ์อะไรก็ตามแล้ว SmartType เด้ง
  //   กด Enter จึงกลายเป็นเติมคำแทนขึ้นบรรทัดใหม่ → วนไม่จบ
  //   กติกาใหม่: **ยืนยันด้วย Tab อย่างเดียว** · Enter = ปิด popup แล้วขึ้นบรรทัดใหม่ตามปกติ
  onKey(ev) {
    if (!this.visible) return false;
    if (ev.key === 'ArrowDown') { this.sel = (this.sel + 1) % this.items.length; this.render(); return true; }
    if (ev.key === 'ArrowUp') { this.sel = (this.sel - 1 + this.items.length) % this.items.length; this.render(); return true; }
    if (ev.key === 'Tab') { this._accept(); return true; }
    if (ev.key === 'Enter') { this.hide(); return false; }   // ปล่อยให้ตัวแก้ไขขึ้นบรรทัดใหม่
    if (ev.key === 'Escape') { this.hide(); return true; }
    return false;
  }
}
