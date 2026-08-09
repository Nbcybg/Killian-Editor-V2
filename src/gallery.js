// gallery.js — คลังรูปภาพ (alpha.63: ยกเครื่องเป็นระบบอัลบั้ม)
//
// เดิมเป็น "โฟลเดอร์แบน" — รูปทุกใบกองรวมใน Images/ มีแค่ caption
// ตอนนี้: อัลบั้มซ้อนชั้น (โฟลเดอร์จริง) · แท็ก 3 ชนิด · กระดานอารมณ์ · ตัวติดตามการใช้งาน ·
//        เลือกหลายใบ/สั่งเป็นชุด · ค้นหา/เรียง · เมทาดาทา · ส่งออก · AI ช่วยตั้งชื่อ/แท็ก
//
// เอนจินทั้งหมดอยู่ใน `src/gallery/*` (บริสุทธิ์ + unit test) — ไฟล์นี้คือ **ตัววาดอย่างเดียว**
// ตัวเชื่อมกับที่อื่น (แทรกลงฉาก/เปิดไฟล์/เปิดหน้า Wiki) รับเข้ามาเป็น callback ตอนสร้าง
// เพื่อไม่ให้ import วนกลับไปหา app.js

import { ask, confirmBox, popupMenu, choose } from './ui.js';
import { imageLightbox } from './wiki.js';
import { iconHtml } from './icons.js';
import { el, setStatus, withBusy } from './core.js';
import * as AC from './gallery/album-core.js';
import * as TG from './gallery/album-tags.js';
import * as UI from './gallery/usage-index.js';
import * as IH from './gallery/image-hash.js';
import { currentAlbum, setCurrentAlbum, onAlbumChange } from './gallery/gallery-bus.js';
import { dropOnBoard } from './gallery/moodboard-ui.js';

const { ROOT_ALBUM, ALL_ALBUM, ROOT_ALBUM_NAME } = AC;

// ───────────────────────── helper ระดับไฟล์ ─────────────────────────

/** path เต็มของรูปจาก path สัมพัทธ์กับ Images/ */
async function absOf(root, relPath) {
  return kapi.join(root, AC.IMAGES_DIR, ...String(relPath).split('/'));
}

const urlCache = new Map();
export function clearGalleryCache() { urlCache.clear(); }

async function fileURL(root, relPath) {
  const key = root + '||' + relPath;
  if (urlCache.has(key)) return urlCache.get(key);
  const u = await kapi.toFileURL(await absOf(root, relPath));
  urlCache.set(key, u);
  return u;
}

/** ขนาดไฟล์ + เวลาแก้ไข (kapi.stat เป็นของใหม่ใน alpha.63 — รุ่นเก่าตกไปใช้ mtime) */
async function statOf(root, relPath) {
  const p = await absOf(root, relPath);
  try {
    if (kapi.stat) return await kapi.stat(p);
    return { size: 0, mtimeMs: await kapi.mtime(p), birthtimeMs: 0 };
  } catch { return { size: 0, mtimeMs: 0, birthtimeMs: 0 }; }
}

/** โหลดรูปแล้ววัดขนาดจริง (ครั้งเดียวต่อ URL) */
const dimCache = new Map();
function measure(url) {
  if (dimCache.has(url)) return Promise.resolve(dimCache.get(url));
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => { const d = { w: im.naturalWidth, h: im.naturalHeight }; dimCache.set(url, d); resolve(d); };
    im.onerror = () => resolve({ w: 0, h: 0 });
    im.src = url;
  });
}

/** แฮชรูปสำหรับ "หารูปคล้าย" — ย่อลง 8×8 บน canvas แล้วอ่านพิกเซล */
const hashCache = new Map();
async function hashOf(url) {
  if (hashCache.has(url)) return hashCache.get(url);
  const h = await new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = IH.HASH_SIZE; c.height = IH.HASH_SIZE;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0, IH.HASH_SIZE, IH.HASH_SIZE);
        resolve(IH.aHash(g.getImageData(0, 0, IH.HASH_SIZE, IH.HASH_SIZE).data));
      } catch { resolve(''); }
    };
    im.onerror = () => resolve('');
    im.src = url;
  });
  hashCache.set(url, h);
  return h;
}

const stopEv = (e) => { e.preventDefault(); e.stopPropagation(); };

/** มุมมองของตาราง — ผู้ใช้เลือกเองว่าจะให้ครอบตัดหรือเห็นเต็มรูป */
export const CELL_MODES = [
  ['thumb', 'ย่อ',     'grid',   'ภาพย่อขนาดเท่ากัน (ครอบตัดให้เต็มกรอบ)'],
  ['fit',   'เต็มรูป',  'image',  'เห็นทั้งรูปตามสัดส่วนจริง ไม่ครอบตัด'],
  ['list',  'รายการ',   'list-ul', 'แถวละรูป — เห็นชื่อ คำบรรยาย แท็ก ขนาด และการใช้งานพร้อมกัน'],
];

// ───────────────────────── ตัวคลังรูปหลัก ─────────────────────────

export class Gallery {
  /**
   * @param {HTMLElement} pane   กล่องที่จะวาดลงไป (แผง `#gal-body`)
   * @param {string} root        รากโปรเจกต์
   * @param {object} opts        onChanged · onInsert(path,caption) · onOpenFile(file) ·
   *                             entityNames() · onOpenEntity(name)
   */
  constructor(pane, root, opts = {}) {
    this.pane = pane;
    this.root = root;
    this.opts = opts;
    this.title = 'คลังรูปภาพ';
    this.dirty = false;
    this.state = {
      album: currentAlbum(),
      cell: localStorage.getItem('k2-gal-cell') || 'thumb',   // thumb | fit | list
      q: '',
      sort: 'manual',
      use: 'all',
      tags: [],
      tagMode: 'and',
      sel: new Set(),
      lastSel: '',
    };
    // อัลบั้มใช้ร่วมกับแผงกระดานอารมณ์ — เลือกฝั่งไหนอีกฝั่งตามทันที
    this._offAlbum = onAlbumChange((id, from) => {
      if (from === 'gallery' || id === this.state.album) return;
      this.state.album = id;
      this.state.sel.clear();
      this.render();
    });
    this.albums = [];
    this.items = [];
    this.usage = new Map();
    this._gen = 0;                      // กัน render ซ้อน (บทเรียน 21)
    this.render();
  }

  // ---------- ข้อมูล ----------

  async reload({ rescan = false } = {}) {
    const gen = ++this._gen;
    await AC.migrateFromFlat(kapi, this.root);
    const albums = await AC.listAlbums(kapi, this.root);
    if (gen !== this._gen) return false;
    this.albums = albums;
    if (this.state.album !== ALL_ALBUM && !albums.some((a) => a.id === this.state.album)) {
      this.state.album = ALL_ALBUM;
    }
    // ประกาศอัลบั้มที่กำลังดูทุกครั้งที่โหลด — ไม่ใช่เฉพาะตอนคลิกใน sidebar
    // (คำสั่งจากเมนู/เทส/โค้ดอื่นตั้ง state.album ตรง ๆ ได้ แผงกระดานต้องตามทันเหมือนกัน)
    setCurrentAlbum(this.state.album, 'gallery');
    const items = this.state.album === ALL_ALBUM
      ? await AC.allImages(kapi, this.root, albums)
      : await AC.getAlbumImages(kapi, this.root, this.state.album);
    if (gen !== this._gen) return false;
    if (rescan || !this.usage.size) await this.rescanUsage();
    if (gen !== this._gen) return false;
    const withUse = UI.attachUsage(items, this.usage);
    // เดิมยิง stat ทีละใบแล้วรอทีละอัน = IPC หนึ่งรอบต่อรูป — อัลบั้มหลักร้อยใบทำให้แผงค้างไปหลายวินาที
    // ยิงเป็นชุดแทน (ชุดละ 32 เพื่อไม่ถล่ม IPC ทีเดียว) + เช็ค gen ระหว่างชุดเพื่อยกเลิกได้ไว
    const CHUNK = 32;
    for (let i = 0; i < withUse.length; i += CHUNK) {
      if (gen !== this._gen) return false;
      await Promise.all(withUse.slice(i, i + CHUNK).map(async (it) => {
        const st = await statOf(this.root, it.path);
        it.size = st.size || 0;
        if (!it.added) it.added = st.birthtimeMs || st.mtimeMs || 0;
      }));
    }
    if (gen !== this._gen) return false;
    this.items = withUse;
    await AC.syncFlatIndex(kapi, this.root,
      this.state.album === ALL_ALBUM ? items : await AC.allImages(kapi, this.root, albums));
    return gen === this._gen;
  }

  async rescanUsage() {
    const r = await UI.scanUsage(kapi, this.root, {
      titleOf: (p) => p.split(/[\\/]/).pop().replace(/\.md$/i, ''),
    });
    this.usage = r.index;
    return r;
  }

  /** รายการที่ผ่านตัวกรองทั้งหมดแล้ว (ค้นหา → แท็ก → การใช้งาน → เรียง) */
  visibleItems() {
    let arr = AC.searchImages(this.items, this.state.q);
    arr = TG.filterByTags(arr, this.state.tags, this.state.tagMode);
    arr = UI.filterByUsage(arr, this.state.use);
    return AC.sortImages(arr, this.state.sort);
  }

  albumOf(path) {
    const it = this.items.find((x) => x.path === path);
    return it ? it.album : this.state.album;
  }

  // ---------- วาด ----------

  async render() {
    const ok = await this.reload();
    if (!ok) return;
    this.draw();
  }

  draw() {
    const p = this.pane;
    p.innerHTML = '';
    const wrap = el('div', 'gal2');
    p.append(wrap);
    wrap.append(this.buildHead(), this.buildMain(), this.buildBatchBar());
    this.syncBatchBar();
  }

  buildHead() {
    const head = el('div', 'gal2-head');
    // มุมมองของตาราง — ครอบตัด / เต็มรูปไม่ครอบ / รายการ
    const tabs = el('div', 'gal2-tabs');
    for (const [key, label, icon, tip] of CELL_MODES) {
      const b = el('button', 'gal2-tab' + (this.state.cell === key ? ' on' : ''));
      b.innerHTML = iconHtml(icon, 14) + ' <span>' + label + '</span>';
      b.dataset.cell = key;
      b.title = tip;
      b.onclick = () => {
        this.state.cell = key;
        try { localStorage.setItem('k2-gal-cell', key); } catch {}
        this.draw();
      };
      tabs.append(b);
    }
    const stats = el('div', 'gal2-stats');
    const st = AC.galleryStats(this.items, this.albums);
    stats.textContent = `${st.total} รูป · ยังไม่ถูกใช้ ${st.unused} · ${st.bytesText}`;
    stats.title = `อัลบั้ม ${st.albums} · แท็ก ${st.tags} · ใช้แล้ว ${st.used}`;

    const btns = el('div', 'gal2-head-btns');
    const add = el('button', 'k-ok gal2-add', '＋ เพิ่มรูป…');
    add.onclick = () => this.addImages();
    const refresh = el('button', 'cmp-mini gal2-refresh');
    refresh.innerHTML = iconHtml('reset', 13);
    refresh.title = 'สแกนใหม่ (ไฟล์/การใช้งาน)';
    refresh.onclick = async () => {
      await withBusy('สแกนคลังรูป…', async () => { await this.reload({ rescan: true }); });
      this.draw(); setStatus('สแกนคลังรูปใหม่แล้ว');
    };
    const board = el('button', 'cmp-mini gal2-openboard');
    board.innerHTML = iconHtml('layout', 13);
    board.title = 'เปิดแผงกระดานอารมณ์ (ผนึกไว้ข้าง ๆ แล้วลากรูปจากตารางไปวางได้)';
    board.onclick = () => this.opts.onOpenBoard && this.opts.onOpenBoard();
    const more = el('button', 'cmp-mini gal2-more', '⋯');
    more.title = 'คำสั่งเพิ่มเติม';
    more.onclick = (e) => this.moreMenu(e);
    btns.append(add, board, refresh, more);
    head.append(tabs, stats, btns);
    return head;
  }

  buildMain() {
    const main = el('div', 'gal2-main');
    main.append(this.buildSide());
    const body = el('div', 'gal2-body');
    body.append(this.buildBar(), this.buildGrid());
    main.append(body);
    return main;
  }

  // ---- sidebar: ต้นไม้อัลบั้ม + ตัวกรองแท็ก ----

  buildSide() {
    const side = el('div', 'gal2-side');
    const h = el('div', 'gal2-side-head');
    h.append(el('span', null, 'อัลบั้ม'));
    const plus = el('span', 'row-add');
    plus.innerHTML = iconHtml('plus', 13);
    plus.title = 'สร้างอัลบั้มใหม่';
    plus.onclick = () => this.newAlbum('');
    h.append(plus);
    side.append(h);

    const tree = el('div', 'gal2-tree');
    tree.append(this.albumRow({ id: ALL_ALBUM, name: 'รูปทั้งหมด' }, 0, this.items.length));
    const counts = this.albumCounts();
    for (const node of AC.albumTree(this.albums)) this.appendAlbumNode(tree, node, 0, counts);
    side.append(tree);

    // ตัวกรองแท็ก
    const tags = TG.getAllTags(this.items);
    const tf = el('div', 'gal2-tagfilter');
    const th = el('div', 'gal2-side-head');
    th.append(el('span', null, 'แท็ก'));
    const mode = el('button', 'gal2-tagmode', this.state.tagMode === 'and' ? 'ทั้งหมด (AND)' : 'อย่างน้อยหนึ่ง (OR)');
    mode.title = 'สลับเงื่อนไขการกรอง';
    mode.onclick = () => { this.state.tagMode = this.state.tagMode === 'and' ? 'or' : 'and'; this.draw(); };
    th.append(mode);
    tf.append(th);
    const chips = el('div', 'gal2-chips');
    if (!tags.length) chips.append(el('div', 'dim gal2-empty-note', '(ยังไม่มีแท็ก — คลิกขวาที่รูปเพื่อติดแท็ก)'));
    for (const t of tags) {
      const c = el('span', 'gal2-chip k-tag-' + t.kind + (this.state.tags.includes(t.tag) ? ' on' : ''));
      c.textContent = t.tag + ' ' + t.count;
      c.title = TG.TAG_KINDS[t.tag[0]] ? TG.TAG_KINDS[t.tag[0]].label : 'ทั่วไป';
      c.onclick = () => {
        const i = this.state.tags.indexOf(t.tag);
        if (i < 0) this.state.tags.push(t.tag); else this.state.tags.splice(i, 1);
        this.draw();
      };
      c.oncontextmenu = (e) => {
        e.preventDefault();
        popupMenu(e.clientX, e.clientY, [
          { label: '✏️ เปลี่ยนชื่อแท็กนี้ทั้งคลัง', click: () => this.renameTag(t.tag) },
          { label: '🗑 ถอดแท็กนี้ออกจากทุกรูป', danger: true, click: () => this.dropTag(t.tag) },
        ]);
      };
      chips.append(c);
    }
    tf.append(chips);
    if (this.state.tags.length) {
      const clr = el('button', 'cmp-mini', '✕ ล้างตัวกรองแท็ก');
      clr.onclick = () => { this.state.tags = []; this.draw(); };
      tf.append(clr);
    }
    side.append(tf);
    return side;
  }

  albumCounts() {
    const m = new Map();
    for (const it of this.items) m.set(it.album, (m.get(it.album) || 0) + 1);
    return m;
  }

  appendAlbumNode(host, node, depth, counts) {
    host.append(this.albumRow(node, depth, counts.get(node.id) || 0));
    for (const c of node.children || []) this.appendAlbumNode(host, c, depth + 1, counts);
  }

  albumRow(a, depth, count) {
    const row = el('div', 'gal2-album' + (this.state.album === a.id ? ' on' : ''));
    row.style.paddingLeft = 8 + depth * 14 + 'px';
    row.dataset.album = a.id;
    const ic = a.id === ALL_ALBUM ? 'image' : a.id === ROOT_ALBUM ? 'archive' : 'folder';
    row.innerHTML = iconHtml(ic, 14);
    row.append(el('span', 'gal2-album-name', a.id === ROOT_ALBUM ? ROOT_ALBUM_NAME : a.name));
    row.append(el('span', 'gal2-album-n', String(count)));
    row.onclick = () => {
      if (this.state.album === a.id) return;
      this.state.album = a.id;
      this.state.sel.clear();
      setCurrentAlbum(a.id, 'gallery');      // แผงกระดานอารมณ์ตามไปด้วย
      this.render();
    };
    if (a.id !== ALL_ALBUM) {
      row.oncontextmenu = (e) => { e.preventDefault(); this.albumMenu(e, a); };
      // ลากรูปมาวาง = ย้ายเข้าอัลบั้มนี้
      row.addEventListener('dragover', (e) => {
        if (![...e.dataTransfer.types].includes('text/k2-gal-image')) return;
        stopEv(e); e.dataTransfer.dropEffect = 'move'; row.classList.add('drop');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop'));
      row.addEventListener('drop', async (e) => {
        row.classList.remove('drop');
        const raw = e.dataTransfer.getData('text/k2-gal-image');
        if (!raw) return;
        stopEv(e);
        let paths = [];
        try { paths = JSON.parse(raw).paths || []; } catch {}
        await this.moveImages(paths, a.id);
      });
    }
    return row;
  }

  // ---- แถบเครื่องมือของตาราง ----

  buildBar() {
    const bar = el('div', 'gal2-bar');
    const q = el('input', 'wiki-input gal2-search');
    q.placeholder = '🔍 ค้นชื่อไฟล์ / คำบรรยาย / แท็ก';
    q.value = this.state.q;
    q.oninput = () => {
      this.state.q = q.value;
      this.refreshGrid();
    };
    const sort = el('select', 'wiki-input k-dlg-select gal2-sort');
    for (const m of AC.SORT_MODES) {
      const o = el('option', null, m.label); o.value = m.key;
      if (m.key === this.state.sort) o.selected = true;
      sort.append(o);
    }
    sort.title = 'เรียงตาม';
    sort.onchange = () => { this.state.sort = sort.value; this.refreshGrid(); };
    const use = el('select', 'wiki-input k-dlg-select gal2-use');
    for (const f of UI.USE_FILTERS) {
      const o = el('option', null, f.label); o.value = f.key;
      if (f.key === this.state.use) o.selected = true;
      use.append(o);
    }
    use.title = 'กรองตามการใช้งานจริงในต้นฉบับ';
    use.onchange = () => { this.state.use = use.value; this.refreshGrid(); };
    bar.append(q, sort, use);
    return bar;
  }

  refreshGrid() {
    const old = this.pane.querySelector('.gal2-grid');
    if (!old) { this.draw(); return; }
    const fresh = this.buildGrid();
    old.replaceWith(fresh);
    this.syncBatchBar();
  }

  // ---- ตารางรูป ----

  buildGrid() {
    const grid = el('div', 'gal2-grid mode-' + this.state.cell);
    const items = this.visibleItems();
    if (!items.length) {
      const d = el('div', 'gal-empty');
      d.append(el('div', 'gal-empty-icon', '🖼'));
      d.append(el('div', null, this.items.length
        ? 'ไม่มีรูปที่ตรงกับตัวกรอง'
        : 'ยังไม่มีรูปในอัลบั้มนี้ — กด "เพิ่มรูป…" หรือลากไฟล์มาวางตรงนี้'));
      grid.append(d);
    }
    for (const it of items) grid.append(this.buildCell(it));

    // ลากไฟล์จากนอกโปรแกรมมาวาง = เพิ่มเข้าอัลบั้มที่เลือกอยู่
    grid.addEventListener('dragover', (e) => {
      if ([...e.dataTransfer.types].includes('Files')) { stopEv(e); grid.classList.add('drop'); }
    });
    grid.addEventListener('dragleave', () => grid.classList.remove('drop'));
    grid.addEventListener('drop', async (e) => {
      grid.classList.remove('drop');
      const files = [...(e.dataTransfer.files || [])].filter((f) => AC.isImageFile(f.name));
      if (!files.length) return;
      stopEv(e);
      await this.importDropped(files);
    });
    grid.onclick = (e) => { if (e.target === grid) { this.state.sel.clear(); this.syncSelection(); } };
    return grid;
  }

  /** ผูกอีเวนต์ที่การ์ดกับแถวใช้เหมือนกัน (เลือก/ลาก/เมนู/ดูภาพเต็ม) */
  bindItemEvents(node, it) {
    node.dataset.path = it.path;
    node.onclick = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.ctrlKey || e.metaKey) { this.toggleSel(it.path, true); return; }
      if (e.shiftKey) { this.selectRange(it.path); return; }
      this.state.sel = new Set([it.path]);
      this.state.lastSel = it.path;
      this.syncSelection();
    };
    node.ondblclick = async () => imageLightbox(await fileURL(this.root, it.path), it.caption || it.file);
    node.oncontextmenu = (e) => { e.preventDefault(); this.cellMenu(e, it); };
    node.draggable = true;
    node.addEventListener('dragstart', (e) => {
      const paths = this.state.sel.has(it.path) ? [...this.state.sel] : [it.path];
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/k2-gal-image', JSON.stringify({ paths }));
      e.dataTransfer.setData('text/plain', `![${it.caption || ''}](${it.file})`);
      absOf(this.root, it.path).then((abs) => {
        try { e.dataTransfer.setData('text/k2-image', JSON.stringify({ path: abs, name: it.file })); } catch {}
      });
    });
    return node;
  }

  /** มุมมองรายการ — เห็นชื่อ/คำบรรยาย/แท็ก/ขนาด/การใช้งาน ครบในแถวเดียว */
  buildRow(it) {
    const row = el('div', 'gal2-row' + (this.state.sel.has(it.path) ? ' sel' : ''));
    const th = el('div', 'gal2-row-thumb');
    const im = el('img');
    im.alt = it.caption || it.file;
    im.loading = 'lazy';
    fileURL(this.root, it.path).then((u) => { im.src = u; });
    im.onerror = () => { th.classList.add('miss'); th.textContent = '⚠'; };
    th.append(im);
    const main = el('div', 'gal2-row-main');
    const name = el('div', 'gal2-row-name', it.file);
    if (this.state.album === ALL_ALBUM && it.album !== ROOT_ALBUM) {
      name.append(el('span', 'gal2-row-album', it.album));
    }
    const cap = el('input', 'wiki-input gal2-row-cap');
    cap.value = it.caption || '';
    cap.placeholder = 'คำบรรยาย…';
    cap.onclick = (e) => e.stopPropagation();
    cap.addEventListener('change', async () => {
      await AC.updateImage(kapi, this.root, it.album, it.file, { caption: cap.value });
      it.caption = cap.value;
      await AC.syncFlatIndex(kapi, this.root);
      this.changed();
      setStatus('บันทึกคำบรรยายแล้ว');
    });
    main.append(name, cap);
    if (it.tags && it.tags.length) {
      const tw = el('div', 'gal2-cell-tags');
      for (const t of it.tags) {
        const c = el('span', 'gal2-chip sm k-tag-' + TG.tagKind(t), t);
        c.onclick = (e) => {
          stopEv(e);
          if (TG.tagKind(t) === 'entity' && this.opts.onOpenEntity) this.opts.onOpenEntity(TG.tagName(t));
          else { this.state.tags = [t]; this.draw(); }
        };
        tw.append(c);
      }
      main.append(tw);
    }
    const side = el('div', 'gal2-row-side');
    side.append(el('div', 'gal2-row-size', AC.formatBytes(it.size)));
    const use = el('div', 'gal2-badge ' + (it.uses ? 'used' : 'unused'),
                   it.uses ? 'ใช้ ' + it.uses : 'ยังไม่ถูกใช้');
    if (it.uses) {
      use.title = UI.usageLabel(this.usage, it.file, 6);
      use.onclick = (e) => { stopEv(e); this.usageMenu(e, it); };
    }
    side.append(use);
    row.append(th, main, side);
    return this.bindItemEvents(row, it);
  }

  buildCell(it) {
    if (this.state.cell === 'list') return this.buildRow(it);
    const cell = el('div', 'gal2-cell' + (this.state.sel.has(it.path) ? ' sel' : ''));
    cell.dataset.path = it.path;
    const box = el('div', 'gal2-thumb');
    const im = el('img');
    im.alt = it.caption || it.file;
    im.loading = 'lazy';
    fileURL(this.root, it.path).then((u) => { im.src = u; });
    im.onerror = () => { box.classList.add('miss'); box.textContent = '⚠ เปิดรูปไม่ได้'; };
    box.append(im);

    const mark = el('span', 'gal2-check');
    mark.innerHTML = iconHtml('check', 12);
    mark.title = 'เลือก/ไม่เลือก';
    mark.onclick = (e) => { stopEv(e); this.toggleSel(it.path, true); };
    box.append(mark);

    if (!it.uses) {
      const b = el('span', 'gal2-badge unused', 'ยังไม่ถูกใช้');
      box.append(b);
    } else {
      const b = el('span', 'gal2-badge used', 'ใช้ ' + it.uses);
      b.title = UI.usageLabel(this.usage, it.file, 6);
      b.onclick = (e) => { stopEv(e); this.usageMenu(e, it); };
      box.append(b);
    }
    cell.append(box);

    const cap = el('input', 'wiki-input gal-cap');
    cap.value = it.caption || '';
    cap.placeholder = it.file;
    cap.title = 'คำบรรยาย — แก้แล้วบันทึกอัตโนมัติ';
    cap.onclick = (e) => e.stopPropagation();
    cap.addEventListener('change', async () => {
      await AC.updateImage(kapi, this.root, it.album, it.file, { caption: cap.value });
      it.caption = cap.value;
      await AC.syncFlatIndex(kapi, this.root);
      this.changed();
      setStatus('บันทึกคำบรรยายแล้ว');
    });
    cell.append(cap);

    if (it.tags && it.tags.length) {
      const tw = el('div', 'gal2-cell-tags');
      for (const t of it.tags) {
        const c = el('span', 'gal2-chip sm k-tag-' + TG.tagKind(t), t);
        c.onclick = (e) => {
          stopEv(e);
          if (TG.tagKind(t) === 'entity' && this.opts.onOpenEntity) this.opts.onOpenEntity(TG.tagName(t));
          else { this.state.tags = [t]; this.draw(); }
        };
        tw.append(c);
      }
      cell.append(tw);
    }

    const meta = el('div', 'gal2-cell-meta');
    meta.textContent = AC.formatBytes(it.size);
    if (this.state.album === ALL_ALBUM && it.album !== ROOT_ALBUM) meta.textContent += ' · ' + it.album;
    cell.append(meta);

    return this.bindItemEvents(cell, it);
  }

  // ---- เลือกหลายใบ ----

  toggleSel(path, additive) {
    if (!additive) this.state.sel.clear();
    if (this.state.sel.has(path)) this.state.sel.delete(path);
    else { this.state.sel.add(path); this.state.lastSel = path; }
    this.syncSelection();
  }

  selectRange(path) {
    const vis = this.visibleItems().map((i) => i.path);
    const a = vis.indexOf(this.state.lastSel);
    const b = vis.indexOf(path);
    if (a < 0 || b < 0) { this.toggleSel(path, true); return; }
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) this.state.sel.add(vis[i]);
    this.syncSelection();
  }

  syncSelection() {
    for (const c of this.pane.querySelectorAll('.gal2-cell, .gal2-row')) {
      c.classList.toggle('sel', this.state.sel.has(c.dataset.path));
    }
    this.syncBatchBar();
  }

  buildBatchBar() {
    const bar = el('div', 'gal2-batch');
    this._batch = bar;
    const n = el('span', 'gal2-batch-n');
    bar.append(n);
    const mk = (label, fn, cls) => { const b = el('button', 'cmp-mini' + (cls ? ' ' + cls : ''), label); b.onclick = fn; bar.append(b); return b; };
    mk('📁 ย้ายไปอัลบั้ม', () => this.moveSelection());
    mk('🏷 ติดแท็ก', () => this.tagSelection());
    mk('📤 ส่งออกที่เลือก', () => this.exportSelection());
    mk('🗑 ลบ', () => this.deleteSelection(), 'k-danger');
    mk('✕', () => { this.state.sel.clear(); this.syncSelection(); });
    return bar;
  }

  syncBatchBar() {
    const bar = this._batch;
    if (!bar) return;
    const n = this.state.sel.size;
    bar.classList.toggle('on', n > 0);
    const label = bar.querySelector('.gal2-batch-n');
    if (label) label.textContent = `เลือกไว้ ${n} รูป`;
  }

  // ---------- คำสั่งเกี่ยวกับอัลบั้ม ----------

  albumMenu(e, a) {
    const items = [
      { label: '＋ อัลบั้มย่อยใหม่…', click: () => this.newAlbum(a.id) },
    ];
    if (a.id !== ROOT_ALBUM) {
      items.push(
        { label: '✏️ เปลี่ยนชื่อ…', click: () => this.renameAlbum(a.id) },
        { label: '📁 ย้ายไปอยู่ใต้…', click: () => this.moveAlbumTo(a.id) },
        '-',
        { label: '📤 ส่งออกอัลบั้มนี้…', click: () => this.exportAlbum(a.id) },
        { label: '📂 แสดงในโฟลเดอร์', click: async () => kapi.revealInOS(await AC.albumDir(kapi, this.root, a.id)) },
        '-',
        { label: '🗑 ลบอัลบั้ม (ย้ายไปถังขยะ)', danger: true, click: () => this.deleteAlbum(a.id) },
      );
    } else {
      items.push({ label: '📂 แสดงโฟลเดอร์ Images', click: async () => kapi.revealInOS(await AC.albumDir(kapi, this.root, ROOT_ALBUM)) });
    }
    popupMenu(e.clientX, e.clientY, items);
  }

  async newAlbum(parent) {
    const name = await ask('ชื่ออัลบั้มใหม่' + (parent && parent !== ROOT_ALBUM ? ` (อยู่ใต้ ${parent})` : ''),
                           { placeholder: 'เช่น ตัวละคร' });
    if (!name) return;
    try {
      const a = await AC.createAlbum(kapi, this.root, name, parent === ROOT_ALBUM ? '' : parent);
      this.state.album = a.id;
      await this.render();
      setStatus('สร้างอัลบั้ม: ' + a.id);
    } catch (err) { setStatus('สร้างอัลบั้มไม่สำเร็จ: ' + err.message); }
  }

  async renameAlbum(id) {
    const name = await ask('ชื่อใหม่ของอัลบั้ม', { value: AC.albumBaseName(id) });
    if (!name) return;
    try {
      const r = await AC.renameAlbum(kapi, this.root, id, name);
      await this.fixRefsAfterAlbumMove(r.moves);
      if (this.state.album === id) this.state.album = r.to;
      await this.render();
      setStatus('เปลี่ยนชื่ออัลบั้มแล้ว: ' + r.to);
    } catch (err) { setStatus('เปลี่ยนชื่อไม่สำเร็จ: ' + err.message); }
  }

  async moveAlbumTo(id) {
    const opts = [{ label: '(ชั้นบนสุด)', value: '' },
      ...this.albums.filter((a) => a.id !== ROOT_ALBUM && a.id !== id && !AC.descendantIds(this.albums, id).includes(a.id))
        .map((a) => ({ label: a.id, value: a.id }))];
    const dst = await choose('ย้ายอัลบั้ม "' + AC.albumBaseName(id) + '" ไปอยู่ใต้', opts);
    if (dst === null || dst === undefined) return;
    try {
      const r = await AC.moveAlbum(kapi, this.root, id, dst);
      await this.fixRefsAfterAlbumMove(r.moves);
      if (this.state.album === id) this.state.album = r.to;
      await this.render();
      setStatus('ย้ายอัลบั้มแล้ว: ' + r.to);
    } catch (err) { setStatus('ย้ายไม่สำเร็จ: ' + err.message); }
  }

  async deleteAlbum(id) {
    const imgs = await AC.getAlbumImages(kapi, this.root, id, { write: false });
    const used = imgs.filter((i) => UI.usageCount(this.usage, i.file) > 0).length;
    const warn = used ? `\n⚠ มี ${used} รูปที่ถูกใช้ในต้นฉบับอยู่` : '';
    if (!(await confirmBox(`ลบอัลบั้ม “${AC.albumBaseName(id)}” พร้อมรูป ${imgs.length} ใบ? (ย้ายไปถังขยะ)` + warn))) return;
    try {
      await AC.deleteAlbum(kapi, this.root, id);
      if (this.state.album === id) this.state.album = ALL_ALBUM;
      await this.render();
      this.changed();
      setStatus('ย้ายอัลบั้มไปถังขยะแล้ว');
    } catch (err) { setStatus('ลบไม่สำเร็จ: ' + err.message); }
  }

  /** อัลบั้มถูกเปลี่ยนชื่อ/ย้าย → ลิงก์ในไฟล์ .md ต้องตามไปด้วย */
  async fixRefsAfterAlbumMove(moves) {
    if (!moves || !moves.length) return 0;
    let n = 0;
    for (const mv of moves) {
      const files = await AC.listAlbumFiles(kapi, this.root, mv.to);
      for (const f of files) {
        n += await UI.applyRefRewrite(kapi, this.usage,
          (mv.from ? mv.from + '/' : '') + f, (mv.to ? mv.to + '/' : '') + f);
      }
    }
    if (n) { await this.rescanUsage(); setStatus(`อัปเดตลิงก์รูปใน ${n} ไฟล์`); }
    return n;
  }

  // ---------- คำสั่งเกี่ยวกับรูป ----------

  async addImages() {
    const src = await kapi.openImageDialog();
    if (!src) return;
    const album = this.state.album === ALL_ALBUM ? ROOT_ALBUM : this.state.album;
    const name = await AC.addImageFile(kapi, this.root, album, src);
    await AC.syncFlatIndex(kapi, this.root);
    urlCache.clear();
    await this.render();
    this.changed();
    setStatus('เพิ่มรูปแล้ว: ' + name);
  }

  /** ลากไฟล์จาก Finder/Explorer มาวางในตาราง */
  async importDropped(files) {
    const album = this.state.album === ALL_ALBUM ? ROOT_ALBUM : this.state.album;
    const dir = await AC.albumDir(kapi, this.root, album);
    await kapi.mkdir(dir);
    let n = 0;
    await withBusy('กำลังเพิ่มรูป…', async () => {
      for (const f of files) {
        try {
          const buf = new Uint8Array(await f.arrayBuffer());
          const base64 = btoa(Array.from(buf, (b) => String.fromCharCode(b)).join(''));
          await kapi.writeImageData(dir, f.name, base64);
          n++;
        } catch (err) { setStatus('เพิ่มรูปไม่สำเร็จ: ' + err.message); }
      }
    });
    if (!n) return;
    urlCache.clear();
    await this.render();
    this.changed();
    setStatus(`เพิ่มรูป ${n} ใบเข้าอัลบั้ม ${AC.albumBaseName(album)}`);
  }

  cellMenu(e, it) {
    const sel = this.state.sel.size > 1 && this.state.sel.has(it.path);
    const many = sel ? [...this.state.sel] : [it.path];
    popupMenu(e.clientX, e.clientY, [
      { label: `<b>${sel ? many.length + ' รูปที่เลือก' : it.file}</b>`, disabled: true },
      { label: '🔍 ดูภาพเต็ม', click: async () => imageLightbox(await fileURL(this.root, it.path), it.caption || it.file) },
      { label: '🖼 แทรกลงฉากที่เปิดอยู่', click: () => this.insert(many) },
      { label: '🎨 วางบนกระดานอารมณ์', click: () => this.addToBoard(many) },
      '-',
      { label: '🏷 แก้แท็ก…', click: () => this.tagSelection(many) },
      { label: '✏️ แก้คำบรรยาย…', click: () => this.editCaption(it) },
      { label: '📁 ย้ายไปอัลบั้ม…', click: () => this.moveSelection(many) },
      '-',
      { label: 'ℹ️ ข้อมูลรูป', click: () => this.infoDialog(it) },
      { label: '🔎 หารูปที่คล้ายกัน', click: () => this.findSimilar(it) },
      { label: '📂 แสดงในโฟลเดอร์', click: async () => kapi.revealInOS(await absOf(this.root, it.path)) },
      '-',
      { label: '🗑 ลบ (ย้ายไปถังขยะ)', danger: true, click: () => this.deleteSelection(many) },
    ]);
  }

  usageMenu(e, it) {
    const rows = UI.usageOf(this.usage, it.file);
    if (!rows.length) return;
    popupMenu(e.clientX, e.clientY, [
      { label: '<b>รูปนี้ถูกใช้ใน</b>', disabled: true },
      ...rows.map((r) => ({
        label: `${r.title} <span class="dim">(บรรทัด ${r.line})</span>`,
        click: () => this.opts.onOpenFile && this.opts.onOpenFile(r.file),
      })),
    ]);
  }

  async insert(paths) {
    if (!this.opts.onInsert) { setStatus('เปิดฉากก่อนจึงจะแทรกรูปได้'); return; }
    for (const p of paths) {
      const it = this.items.find((x) => x.path === p);
      await this.opts.onInsert(p, (it && it.caption) || '');
    }
  }

  async editCaption(it) {
    const v = await ask('คำบรรยายของ ' + it.file, { value: it.caption || '', allowEmpty: true });
    if (v === null) return;
    await AC.updateImage(kapi, this.root, it.album, it.file, { caption: v });
    await AC.syncFlatIndex(kapi, this.root);
    await this.render();
    this.changed();
  }

  async moveSelection(paths) {
    const list = paths || [...this.state.sel];
    if (!list.length) return;
    const opts = [{ label: ROOT_ALBUM_NAME, value: ROOT_ALBUM },
      ...this.albums.filter((a) => a.id !== ROOT_ALBUM).map((a) => ({ label: a.id, value: a.id }))];
    const dst = await choose(`ย้าย ${list.length} รูปไปอัลบั้มไหน`, opts);
    if (!dst) return;
    await this.moveImages(list, dst);
  }

  async moveImages(paths, dstAlbum) {
    if (!paths || !paths.length) return;
    const moved = [];
    await withBusy('กำลังย้ายรูป…', async () => {
      for (const p of paths) {
        const it = this.items.find((x) => x.path === p);
        if (!it || it.album === dstAlbum) continue;
        try {
          const r = await AC.moveImage(kapi, this.root, it.album, dstAlbum, it.file);
          if (r) moved.push(r);
        } catch (err) { setStatus('ย้ายไม่สำเร็จ: ' + err.message); }
      }
    });
    if (!moved.length) return;
    // ลิงก์ในต้นฉบับ: ถามก่อนแก้ (ไฟล์ของผู้ใช้ — ห้ามแก้เงียบ ๆ)
    const affected = moved.filter((m) => UI.usageCount(this.usage, m.file) > 0);
    if (affected.length) {
      const files = new Set();
      for (const m of affected) for (const r of UI.usageOf(this.usage, m.file)) files.add(r.file);
      const ok = await confirmBox(
        `รูปที่ย้าย ${affected.length} ใบถูกใช้อยู่ใน ${files.size} ไฟล์\nแก้ลิงก์ในไฟล์เหล่านั้นให้ตรงที่อยู่ใหม่เลยไหม?`,
        'แก้ลิงก์ให้เลย');
      if (ok) {
        let n = 0;
        for (const m of moved) n += await UI.applyRefRewrite(kapi, this.usage, m.oldPath, m.newPath);
        setStatus(`ย้าย ${moved.length} รูป · อัปเดตลิงก์ใน ${n} ไฟล์`);
      } else {
        setStatus(`ย้าย ${moved.length} รูปแล้ว (ยังไม่แก้ลิงก์ในต้นฉบับ)`);
      }
    } else {
      setStatus(`ย้าย ${moved.length} รูปแล้ว`);
    }
    this.state.sel.clear();
    urlCache.clear();
    await AC.syncFlatIndex(kapi, this.root);
    await this.reload({ rescan: true });
    this.draw();
    this.changed();
  }

  async deleteSelection(paths) {
    const list = paths || [...this.state.sel];
    if (!list.length) return;
    const used = list.filter((p) => {
      const it = this.items.find((x) => x.path === p);
      return it && it.uses > 0;
    }).length;
    const warn = used ? `\n⚠ มี ${used} ใบที่ยังถูกใช้ในต้นฉบับ` : '';
    if (!(await confirmBox(`ลบ ${list.length} รูป? (ย้ายไปถังขยะ)` + warn))) return;
    await withBusy('กำลังลบรูป…', async () => {
      for (const p of list) {
        const it = this.items.find((x) => x.path === p);
        if (!it) continue;
        try { await AC.deleteImage(kapi, this.root, it.album, it.file); }
        catch (err) { setStatus('ลบไม่สำเร็จ: ' + err.message); }
      }
    });
    this.state.sel.clear();
    urlCache.clear();
    await AC.syncFlatIndex(kapi, this.root);
    await this.render();
    this.changed();
    setStatus(`ลบ ${list.length} รูปแล้ว (อยู่ในถังขยะ)`);
  }

  async tagSelection(paths) {
    const list = paths || [...this.state.sel];
    if (!list.length) { setStatus('เลือกรูปก่อน'); return; }
    const cur = list.length === 1
      ? TG.tagsToText((this.items.find((x) => x.path === list[0]) || {}).tags || []) : '';
    const text = await ask(`แท็กของ ${list.length} รูป (คั่นด้วยช่องว่าง · @ = เอนทิตี้ Wiki · ~ = ฉาก)`,
                           { value: cur, placeholder: '#ฉาก @เอกราช ~ฉากที่ 3', allowEmpty: true });
    if (text === null) return;
    const tags = TG.parseTags(text);
    const byAlbum = new Map();
    for (const p of list) {
      const it = this.items.find((x) => x.path === p);
      if (!it) continue;
      if (!byAlbum.has(it.album)) byAlbum.set(it.album, []);
      byAlbum.get(it.album).push(it.file);
    }
    for (const [album, files] of byAlbum) {
      let doc = await AC.readAlbumDoc(kapi, this.root, album);
      for (const f of files) {
        doc = list.length === 1 ? TG.setTags(doc, f, tags)
          : tags.reduce((d, t) => TG.addTag(d, f, t), doc);
      }
      await AC.writeAlbumDoc(kapi, this.root, album, doc);
    }
    await AC.syncFlatIndex(kapi, this.root);
    await this.render();
    this.changed();
    setStatus(list.length === 1 ? 'บันทึกแท็กแล้ว' : `ติดแท็กให้ ${list.length} รูปแล้ว`);
  }

  async renameTag(tag) {
    const v = await ask('เปลี่ยนชื่อแท็ก ' + tag, { value: tag });
    if (!v || v === tag) return;
    for (const a of this.albums) {
      const doc = await AC.readAlbumDoc(kapi, this.root, a.id);
      const next = TG.renameTagIn(doc, tag, v);
      if (JSON.stringify(next.images) !== JSON.stringify(doc.images)) {
        await AC.writeAlbumDoc(kapi, this.root, a.id, next);
      }
    }
    this.state.tags = this.state.tags.map((t) => (t === tag ? TG.normalizeTag(v) : t));
    await this.render();
    setStatus('เปลี่ยนชื่อแท็กแล้ว');
  }

  async dropTag(tag) {
    if (!(await confirmBox(`ถอดแท็ก ${tag} ออกจากทุกรูป?`, 'ถอดออก'))) return;
    for (const a of this.albums) {
      const doc = await AC.readAlbumDoc(kapi, this.root, a.id);
      const files = Object.keys(doc.images);
      const next = TG.removeTagMany(doc, files, tag);
      if (JSON.stringify(next.images) !== JSON.stringify(doc.images)) {
        await AC.writeAlbumDoc(kapi, this.root, a.id, next);
      }
    }
    this.state.tags = this.state.tags.filter((t) => t !== tag);
    await this.render();
    setStatus('ถอดแท็กแล้ว');
  }

  // ---------- ข้อมูล / ค้นรูปคล้าย ----------

  async infoDialog(it) {
    const url = await fileURL(this.root, it.path);
    const dim = await measure(url);
    const st = await statOf(this.root, it.path);
    const rows = [
      ['ชื่อไฟล์', it.file],
      ['อัลบั้ม', it.album === ROOT_ALBUM ? ROOT_ALBUM_NAME : it.album],
      ['ที่อยู่ในคลัง', 'Images/' + it.path],
      ['ความละเอียด', dim.w ? `${dim.w} × ${dim.h} px` : '—'],
      ['ขนาดไฟล์', AC.formatBytes(st.size)],
      ['วันที่เพิ่ม', it.added ? new Date(it.added).toLocaleString('th-TH') : '—'],
      ['แก้ไขล่าสุด', st.mtimeMs ? new Date(st.mtimeMs).toLocaleString('th-TH') : '—'],
      ['จำนวนครั้งที่ใช้', String(it.uses || 0)],
      ['แท็ก', (it.tags || []).join(' ') || '—'],
    ];
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog gal2-info');
    box.append(el('div', 'k-dlg-title', 'ข้อมูลรูป'));
    const im = el('img', 'gal2-info-img'); im.src = url; box.append(im);
    const tbl = el('div', 'gal2-info-rows');
    for (const [k, v] of rows) {
      const r = el('div', 'gal2-info-row');
      r.append(el('span', 'gal2-info-k', k), el('span', 'gal2-info-v', v));
      tbl.append(r);
    }
    box.append(tbl);
    if ((it.usedIn || []).length) {
      const u = el('div', 'gal2-info-uses');
      u.append(el('div', 'gal2-info-k', 'ใช้ใน'));
      for (const r of it.usedIn) {
        const a = el('a', 'gal2-uselink', `${r.title} (บรรทัด ${r.line})`);
        a.onclick = () => { ov.remove(); this.opts.onOpenFile && this.opts.onOpenFile(r.file); };
        u.append(a);
      }
      box.append(u);
    }
    const btns = el('div', 'k-dlg-btns');
    const ok = el('button', 'k-ok', 'ปิด');
    ok.onclick = () => ov.remove();
    btns.append(ok); box.append(btns);
    ov.append(box); document.body.append(ov);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  }

  /** เตรียมแฮชของทุกใบ (ครั้งแรกอาจใช้เวลา — ทำใน withBusy) */
  async ensureHashes(items) {
    const list = items || this.items;
    for (const it of list) {
      if (it.hash) continue;
      it.hash = await hashOf(await fileURL(this.root, it.path));
    }
    return list;
  }

  async findSimilar(it) {
    await withBusy('กำลังเทียบรูป…', async () => {
      const all = this.state.album === ALL_ALBUM ? this.items : await AC.allImages(kapi, this.root, this.albums);
      const withHash = await this.ensureHashes(all);
      const target = withHash.find((x) => x.path === it.path) || { ...it, hash: await hashOf(await fileURL(this.root, it.path)) };
      const sim = IH.similarImages(withHash, target, { min: 0.8 });
      this.showSimilar(target, sim);
    });
  }

  async showSimilar(target, sim) {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide gal2-sim');
    box.append(el('div', 'k-dlg-title', 'รูปที่คล้ายกับ ' + target.file));
    const grid = el('div', 'gal-grid gal-pick');
    if (!sim.length) grid.append(el('div', 'dim', '(ไม่พบรูปที่คล้ายกันในคลัง)'));
    for (const s of sim) {
      const cell = el('div', 'gal-cell gal-choice');
      const im = el('img'); im.src = await fileURL(this.root, s.path);
      const cap = el('div', 'gal-cap-ro', `${s.file} · ${Math.round(s.score * 100)}%`);
      cell.append(im, cap);
      cell.onclick = () => { ov.remove(); imageLightbox(im.src, s.file); };
      grid.append(cell);
    }
    box.append(grid);
    const btns = el('div', 'k-dlg-btns');
    const ok = el('button', 'k-ok', 'ปิด'); ok.onclick = () => ov.remove();
    btns.append(ok); box.append(btns);
    ov.append(box); document.body.append(ov);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  }

  async findDuplicates() {
    await withBusy('กำลังหารูปซ้ำ…', async () => {
      const all = await AC.allImages(kapi, this.root, this.albums);
      const withHash = await this.ensureHashes(UI.attachUsage(all, this.usage));
      const dups = IH.findDuplicates(withHash, { min: 0.94 });
      const ov = el('div', 'k-overlay');
      const box = el('div', 'k-dialog k-wide gal2-sim');
      box.append(el('div', 'k-dlg-title', `รูปซ้ำ/เกือบซ้ำ — พบ ${dups.length} คู่`));
      const list = el('div', 'gal2-dups');
      if (!dups.length) list.append(el('div', 'dim', '(ไม่พบรูปซ้ำ)'));
      for (const d of dups.slice(0, 60)) {
        const row = el('div', 'gal2-dup-row');
        for (const side of [d.a, d.b]) {
          const c = el('div', 'gal2-dup-cell');
          const im = el('img'); im.src = await fileURL(this.root, side.path);
          c.append(im, el('div', 'gal-cap-ro', `${side.path}\nใช้ ${side.uses || 0} ครั้ง`));
          list.append(c);
          row.append(c);
        }
        row.append(el('div', 'gal2-dup-score', Math.round(d.score * 100) + '%'));
        list.append(row);
      }
      box.append(list);
      const btns = el('div', 'k-dlg-btns');
      const ok = el('button', 'k-ok', 'ปิด'); ok.onclick = () => ov.remove();
      btns.append(ok); box.append(btns);
      ov.append(box); document.body.append(ov);
      ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    });
  }

  // ---------- เมนู ⋯ ----------

  moreMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    popupMenu(r.left, r.bottom + 4, [
      { label: '🤖 AI: ตั้งคำบรรยายให้รูปที่เลือก', click: () => this.aiCaption() },
      { label: '🤖 AI: แนะนำแท็กให้รูปที่เลือก', click: () => this.aiTags() },
      '-',
      { label: '🔎 หารูปซ้ำในคลัง', click: () => this.findDuplicates() },
      { label: '🧹 แสดงเฉพาะรูปที่ยังไม่ถูกใช้', click: () => { this.state.use = 'unused'; this.state.album = ALL_ALBUM; this.render(); } },
      '-',
      { label: '📤 ส่งออกอัลบั้มที่เลือกอยู่…', click: () => this.exportAlbum(this.state.album) },
      { label: '📤 ส่งออกเฉพาะรูปที่ถูกใช้จริง…', click: () => this.exportUsed() },
      '-',
      { label: '🔄 สร้าง images.json ใหม่ (ดัชนี v1)', click: async () => {
        await AC.syncFlatIndex(kapi, this.root); setStatus('สร้างดัชนี images.json ใหม่แล้ว'); } },
      { label: '📂 แสดงโฟลเดอร์ Images', click: async () => kapi.revealInOS(await AC.albumDir(kapi, this.root, ROOT_ALBUM)) },
    ]);
  }

  // ---------- ส่งออก ----------

  async exportAlbum(id) {
    const { exportImages } = await import('./gallery/gallery-export.js');
    const items = id === ALL_ALBUM ? this.items : await AC.getAlbumImages(kapi, this.root, id, { write: false });
    await exportImages(this.root, items, {
      name: id === ALL_ALBUM ? 'ทุกอัลบั้ม' : AC.albumBaseName(id),
      usage: this.usage,
    });
  }

  async exportSelection() {
    const list = [...this.state.sel];
    if (!list.length) return;
    const { exportImages } = await import('./gallery/gallery-export.js');
    await exportImages(this.root, this.items.filter((i) => list.includes(i.path)),
                       { name: 'รูปที่เลือก', usage: this.usage });
  }

  async exportUsed() {
    const { exportImages } = await import('./gallery/gallery-export.js');
    const all = UI.attachUsage(await AC.allImages(kapi, this.root, this.albums), this.usage);
    const used = UI.usedImages(all);
    if (!used.length) { setStatus('ยังไม่มีรูปที่ถูกใช้ในต้นฉบับ'); return; }
    await exportImages(this.root, used, { name: 'รูปที่ใช้จริง', usage: this.usage });
  }

  // ---------- AI ----------

  async aiCaption() {
    const list = [...this.state.sel];
    if (!list.length) { setStatus('เลือกรูปก่อน แล้วสั่ง AI ตั้งคำบรรยาย'); return; }
    const { aiCaptionImages } = await import('./gallery/gallery-ai.js');
    const items = this.items.filter((i) => list.includes(i.path));
    const n = await aiCaptionImages(this.root, items, { usage: this.usage });
    if (n) { await this.render(); this.changed(); }
  }

  async aiTags() {
    const list = [...this.state.sel];
    if (!list.length) { setStatus('เลือกรูปก่อน แล้วสั่ง AI แนะนำแท็ก'); return; }
    const { aiTagImages } = await import('./gallery/gallery-ai.js');
    const items = this.items.filter((i) => list.includes(i.path));
    const n = await aiTagImages(this.root, items, {
      usage: this.usage,
      entities: this.opts.entityNames ? this.opts.entityNames() : [],
    });
    if (n) { await this.render(); this.changed(); }
  }

  // ---------- กระดานอารมณ์ (ย้ายไปเป็นแผงของตัวเองแล้ว — moodboard-ui.js) ----------
  /** วางรูปที่เลือกลงกระดาน แล้วเปิดแผงกระดานให้เห็นผลทันที */
  async addToBoard(paths) {
    const list = (paths || []).filter(Boolean);
    if (!list.length) { setStatus('เลือกรูปก่อน แล้วค่อยวางบนกระดาน'); return; }
    if (this.opts.onOpenBoard) await this.opts.onOpenBoard();
    await dropOnBoard(this.root, list);
  }


  // ---------- ระบบแผง ----------

  changed() { urlCache.clear(); this.opts.onChanged && this.opts.onChanged(); }
  focus() {}
  destroy() { this._gen++; if (this._offAlbum) this._offAlbum(); }
  save() { return true; }
}

// ───────────────────────── กล่องเลือกรูป (ใช้ตอนแทรก/ตั้งปก/ตั้งรูป Wiki) ─────────────────────────

/**
 * เลือกรูปจากคลัง — รองรับอัลบั้ม
 * คืน `{ file, caption, album, name }` โดย **`file` = path สัมพัทธ์กับ Images/**
 * (ผู้เรียกทุกที่ต่อ path เอง เช่น `'../Images/' + it.file` → ใช้ได้กับอัลบั้มย่อยทันที)
 */
export function pickImage(root, { album = null } = {}) {
  return new Promise(async (resolve) => {
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide gal2-pick');
    box.append(el('div', 'k-dlg-title', 'เลือกรูปจากคลัง'));
    const body = el('div', 'gal2-pick-body');
    const side = el('div', 'gal2-pick-side');
    const right = el('div', 'gal2-pick-right');
    const search = el('input', 'wiki-input gal2-search');
    search.placeholder = '🔍 ค้นชื่อไฟล์ / คำบรรยาย / แท็ก';
    const grid = el('div', 'gal-grid gal-pick');
    right.append(search, grid);
    body.append(side, right);
    box.append(body);
    const btns = el('div', 'k-dlg-btns');
    const addB = el('button', null, '＋ เพิ่มรูปใหม่…');
    const cancel = el('button', null, 'ยกเลิก');
    btns.append(addB, cancel);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);

    const done = (v) => { ov.remove(); resolve(v); };
    cancel.onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };

    await AC.migrateFromFlat(kapi, root);
    let albums = await AC.listAlbums(kapi, root);
    let cur = album || ALL_ALBUM;
    let items = [];

    const loadItems = async () => {
      items = cur === ALL_ALBUM ? await AC.allImages(kapi, root, albums)
                                : await AC.getAlbumImages(kapi, root, cur);
    };
    const drawSide = () => {
      side.innerHTML = '';
      const row = (id, name, depth) => {
        const r = el('div', 'gal2-album' + (cur === id ? ' on' : ''));
        r.style.paddingLeft = 8 + depth * 14 + 'px';
        r.innerHTML = iconHtml(id === ALL_ALBUM ? 'image' : id === ROOT_ALBUM ? 'archive' : 'folder', 13);
        r.append(el('span', 'gal2-album-name', name));
        r.onclick = async () => { cur = id; await loadItems(); drawSide(); drawGrid(); };
        side.append(r);
      };
      row(ALL_ALBUM, 'รูปทั้งหมด', 0);
      const walk = (nodes, depth) => {
        for (const n of nodes) {
          row(n.id, n.id === ROOT_ALBUM ? ROOT_ALBUM_NAME : n.name, depth);
          walk(n.children || [], depth + 1);
        }
      };
      walk(AC.albumTree(albums), 0);
    };
    const drawGrid = async () => {
      grid.innerHTML = '';
      const list = AC.searchImages(items, search.value);
      if (!list.length) {
        grid.append(el('div', 'dim', items.length ? '(ไม่มีรูปที่ตรงกับคำค้น)' : '(อัลบั้มนี้ยังว่าง)'));
        return;
      }
      for (const it of list) {
        const cell = el('div', 'gal-cell gal-choice');
        const im = el('img');
        im.src = await fileURL(root, it.path);
        const cap = el('div', 'gal-cap-ro', it.caption || it.file);
        cell.append(im, cap);
        cell.title = 'Images/' + it.path;
        cell.onclick = () => done({ file: it.path, name: it.file, caption: it.caption, album: it.album });
        grid.append(cell);
      }
    };
    search.oninput = () => drawGrid();
    addB.onclick = async () => {
      const src = await kapi.openImageDialog();
      if (!src) return;
      const target = cur === ALL_ALBUM ? ROOT_ALBUM : cur;
      const name = await AC.addImageFile(kapi, root, target, src);
      await AC.syncFlatIndex(kapi, root);
      urlCache.clear();
      albums = await AC.listAlbums(kapi, root);
      await loadItems();
      drawSide(); drawGrid();
      setStatus('เพิ่มรูปแล้ว: ' + name);
    };

    await loadItems();
    drawSide();
    await drawGrid();
  });
}
