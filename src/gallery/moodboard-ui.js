// moodboard-ui.js — กระดานอารมณ์เป็น "แผงของตัวเอง" (alpha.63r)
//
// ทำไมแยกออกมาจากแท็บในคลังรูป: กระดานต้องรับ **การลากรูปมาวาง** แต่ตอนเป็นแท็บ
// ตารางรูปกับกระดานอยู่คนละแท็บ → ลากจากตารางไปกระดานไม่ได้เลยแม้แต่ทางเดียว
// และพื้นที่ที่เหลือหลังหัวแผง+แถบเครื่องมือก็แคบเกินกว่าจะจัดวางอะไรได้จริง
// → ตอนนี้เป็นแผงเต็มตัว: เปิดคู่กับตาราง (ผนึกคนละฝั่ง/ลอย/เต็มจอ) แล้วลากข้ามได้ตามปกติ
//
// รูปบนกระดาน **ไม่ถูกครอบตัด** — `object-fit:contain` เสมอ และตอนวางครั้งแรก
// ความสูงคิดจากสัดส่วนจริงของไฟล์ (`sizeForAspect`)

import { T } from '../i18n.js';
import { ask, confirmBox, popupMenu } from '../ui.js';
import { imageLightbox } from '../wiki.js';
import { iconHtml } from '../icons.js';
import { el, setStatus } from '../core.js';
import * as AC from './album-core.js';
import * as MB from './moodboard.js';
import { boardAlbum, currentAlbum, setCurrentAlbum, onAlbumChange, onBoardChange, notifyBoardChanged } from './gallery-bus.js';

const stopEv = (e) => { e.preventDefault(); e.stopPropagation(); };

/** path ของชิ้นบนกระดาน — เก็บได้ทั้ง "ชื่อไฟล์ในอัลบั้มนี้" (แบบเดิม) และ "path ข้ามอัลบั้ม" */
export function itemPath(albumId, file) {
  const f = String(file || '');
  if (f.includes('/')) return f;                 // ข้ามอัลบั้ม — เก็บเป็น path เต็มจาก Images/
  const rel = AC.albumRel(albumId);
  return rel ? rel + '/' + f : f;
}

async function urlOf(root, relPath) {
  return kapi.toFileURL(await kapi.join(root, AC.IMAGES_DIR, ...String(relPath).split('/')));
}

/** ขนาดจริงของไฟล์รูป (แคชไว้ — ใช้ตั้งความสูงตามสัดส่วน) */
const dims = new Map();
function naturalSize(url) {
  if (dims.has(url)) return Promise.resolve(dims.get(url));
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => { const d = { w: im.naturalWidth || 1, h: im.naturalHeight || 1 }; dims.set(url, d); resolve(d); };
    im.onerror = () => resolve({ w: 1, h: 1 });
    im.src = url;
  });
}

export class MoodBoard {
  constructor(host, root, opts = {}) {
    this.host = host;
    this.root = root;
    this.opts = opts;
    this.view = { zoom: 1, panX: 40, panY: 40 };
    this.albumId = boardAlbum();
    this._gen = 0;
    this._off = [
      onAlbumChange(() => { this.albumId = boardAlbum(); this.render(); }),
      onBoardChange((id) => { if (id === this.albumId) this.drawBoard(); }),
    ];
    this.render();
  }

  destroy() { this._gen++; for (const off of this._off) off(); }

  async albums() { return AC.listAlbums(kapi, this.root); }

  async render() {
    const gen = ++this._gen;
    const list = await this.albums();
    if (gen !== this._gen) return;
    this.host.innerHTML = '';
    const wrap = el('div', 'gal2 mb2');
    this.host.append(wrap);
    wrap.append(this.buildBar(list));
    const board = el('div', 'gal2-board');
    const canvas = el('div', 'gal2-canvas');
    board.append(canvas);
    wrap.append(board);
    this._board = board;
    this._canvas = canvas;
    this.bindBoard(board);
    await this.drawBoard();
  }

  buildBar(list) {
    const bar = el('div', 'gal2-bar gal2-boardbar');
    const sel = el('select', 'wiki-input k-dlg-select gal2-board-sel');
    sel.title = T`กระดานของอัลบั้มไหน`;
    for (const a of list) {
      const o = el('option', null, a.id === AC.ROOT_ALBUM ? AC.ROOT_ALBUM_NAME : a.id);
      o.value = a.id;
      if (a.id === this.albumId) o.selected = true;
      sel.append(o);
    }
    sel.onchange = () => { setCurrentAlbum(sel.value, 'board'); };
    const mk = (label, fn, title) => {
      const b = el('button', 'cmp-mini', label);
      if (title) b.title = title;
      b.onclick = fn;
      return b;
    };
    const more = mk('⋯', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      popupMenu(r.left, r.bottom + 4, [
        { label: T`▦ จัดเรียงอัตโนมัติ`, click: () => this.tidy() },
        { label: T`📐 ปรับทุกชิ้นให้ตรงสัดส่วนรูป`, click: () => this.fixAllRatios() },
        { label: T`📷 ส่งออกกระดานเป็นภาพ…`, click: () => this.exportBoard() },
        '-',
        { label: T`🗑 ล้างกระดาน (ไม่ลบไฟล์)`, danger: true, click: () => this.clear() },
      ]);
    }, T`คำสั่งเพิ่มเติมของกระดาน`);
    bar.append(sel, mk(T`⤢ พอดีจอ`, () => this.fit()), more);
    return bar;
  }

  bindBoard(board) {
    board.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) return;
      e.preventDefault();
      const r = board.getBoundingClientRect();
      this.view = MB.zoomAt(this.view, e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
      this.applyTransform();
    }, { passive: false });

    board.addEventListener('mousedown', (e) => {
      if (e.target !== board && e.target !== this._canvas) return;
      const s = { x: e.clientX, y: e.clientY, panX: this.view.panX, panY: this.view.panY };
      board.classList.add('panning');
      const mv = (ev) => {
        this.view.panX = s.panX + (ev.clientX - s.x);
        this.view.panY = s.panY + (ev.clientY - s.y);
        this.applyTransform();
      };
      const up = () => {
        board.classList.remove('panning');
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });

    // ลากรูปจากแผงคลังรูป (คนละแผงกัน — เป็นเอกสารเดียวกันจึงลากข้ามได้)
    board.addEventListener('dragover', (e) => {
      if (![...e.dataTransfer.types].includes('text/k2-gal-image')) return;
      stopEv(e);
      e.dataTransfer.dropEffect = 'copy';
      board.classList.add('drop');
    });
    board.addEventListener('dragleave', () => board.classList.remove('drop'));
    board.addEventListener('drop', async (e) => {
      board.classList.remove('drop');
      const raw = e.dataTransfer.getData('text/k2-gal-image');
      if (!raw) return;
      stopEv(e);
      let paths = [];
      try { paths = JSON.parse(raw).paths || []; } catch {}
      const r = board.getBoundingClientRect();
      const at = MB.toBoard(this.view, e.clientX - r.left, e.clientY - r.top);
      await this.add(paths, at);
    });
  }

  applyTransform() {
    if (!this._canvas) return;
    const v = this.view;
    this._canvas.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
  }

  async doc() { return AC.readAlbumDoc(kapi, this.root, this.albumId); }

  async saveBoard(board) {
    const d = await this.doc();
    await AC.writeAlbumDoc(kapi, this.root, this.albumId, { ...d, moodBoard: MB.normalizeBoard(board) });
    notifyBoardChanged(this.albumId);
  }

  async drawBoard() {
    const gen = this._gen;
    const canvas = this._canvas;
    if (!canvas) return;
    const d = await this.doc();
    if (gen !== this._gen) return;
    const board = MB.normalizeBoard(d.moodBoard);
    canvas.innerHTML = '';
    this.applyTransform();
    if (!board.length) {
      canvas.append(el('div', 'gal2-board-hint',
        T`กระดานยังว่าง — เปิดแผง "คลังรูปภาพ" ไว้ข้าง ๆ แล้ว **ลากรูปมาวางตรงนี้** ได้เลย ` +
        T`(หรือเลือกรูปในคลังแล้วกด "🎨 วางบนกระดาน")`));
      return;
    }
    for (const it of MB.boardOrder(board)) canvas.append(await this.itemEl(it));
  }

  async itemEl(it) {
    const node = el('div', 'gal2-bitem');
    node.style.left = it.x + 'px';
    node.style.top = it.y + 'px';
    node.style.width = it.w + 'px';
    node.style.height = it.h + 'px';
    node.style.zIndex = String(100 + it.z);
    node.dataset.id = it.id;
    const im = el('img');
    im.src = await urlOf(this.root, itemPath(this.albumId, it.file));
    im.draggable = false;
    im.alt = it.file;
    node.append(im, el('span', 'gal2-bresize'));
    const grip = node.querySelector('.gal2-bresize');

    const commit = async (patch) => {
      const d = await this.doc();
      await this.saveBoard(MB.updateBoardItem(d.moodBoard, it.id, patch));
    };

    // ลากย้าย — แก้ style สดระหว่างลาก แล้วบันทึกครั้งเดียวตอนปล่อย (บทเรียน 29)
    node.addEventListener('mousedown', (e) => {
      if (e.target === grip) return;
      e.stopPropagation();
      const z = this.view.zoom;
      const s = { x: e.clientX, y: e.clientY, ox: it.x, oy: it.y };
      let moved = false;
      const mv = (ev) => {
        moved = true;
        it.x = MB.snap(s.ox + (ev.clientX - s.x) / z);
        it.y = MB.snap(s.oy + (ev.clientY - s.y) / z);
        node.style.left = it.x + 'px'; node.style.top = it.y + 'px';
      };
      const up = async () => {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        if (moved) await commit({ x: it.x, y: it.y });
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });

    grip.addEventListener('mousedown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const z = this.view.zoom;
      const s = { x: e.clientX, y: e.clientY, w: it.w, h: it.h };
      const mv = (ev) => {
        // ค่าเริ่มต้น = คงสัดส่วน (กด Alt ถ้าอยากยืดอิสระ) — รูปไม่ถูกครอบตัดอยู่แล้ว
        const r = MB.resizeItem(it, s.w + (ev.clientX - s.x) / z, s.h + (ev.clientY - s.y) / z,
                                { keepRatio: !ev.altKey });
        it.w = r.w; it.h = r.h;
        node.style.width = it.w + 'px'; node.style.height = it.h + 'px';
      };
      const up = async () => {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        await commit({ w: it.w, h: it.h });
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });

    node.ondblclick = () => imageLightbox(im.src, it.file);
    node.oncontextmenu = (e) => {
      e.preventDefault();
      popupMenu(e.clientX, e.clientY, [
        { label: '<b>' + it.file + '</b>', disabled: true },
        { label: T`🔍 ดูภาพเต็ม`, click: () => imageLightbox(im.src, it.file) },
        { label: T`📐 ปรับให้ตรงสัดส่วนรูป`, click: () => this.fixRatio(it) },
        { label: T`⬆️ ขึ้นบนสุด`, click: async () => this.saveBoard(MB.moveToFront((await this.doc()).moodBoard, it.id)) },
        { label: T`⬇️ ลงล่างสุด`, click: async () => this.saveBoard(MB.moveToBack((await this.doc()).moodBoard, it.id)) },
        '-',
        { label: T`✕ เอาออกจากกระดาน (ไม่ลบไฟล์)`, click: async () =>
          this.saveBoard(MB.removeFromBoard((await this.doc()).moodBoard, it.id)) },
      ]);
    };
    return node;
  }

  /** วางรูปลงกระดาน — ความสูงคิดจากสัดส่วนจริงของไฟล์ (ไม่ครอบตัด ไม่บิด) */
  async add(paths, at) {
    const list = (paths || []).filter(Boolean);
    if (!list.length) { setStatus(T`เลือกรูปก่อน`); return 0; }
    const d = await this.doc();
    let board = d.moodBoard;
    let i = 0;
    const base = at ? { x: MB.snap(at.x), y: MB.snap(at.y) } : { x: 40, y: 40 };
    for (const p of list) {
      const nat = await naturalSize(await urlOf(this.root, p));
      const size = MB.sizeForAspect(MB.DEFAULT_SIZE, nat.w, nat.h);
      // เก็บเป็นชื่อไฟล์เปล่าเมื่ออยู่ในอัลบั้มเดียวกับกระดาน (รูปแบบเดิม) · ข้ามอัลบั้มเก็บ path เต็ม
      const rel = AC.albumRel(this.albumId);
      const file = rel && p.startsWith(rel + '/') ? p.slice(rel.length + 1) : (rel ? p : p);
      board = MB.addToBoard(board, file, {
        x: base.x + (i % 4) * 24, y: base.y + (i % 4) * 24, w: size.w, h: size.h,
      });
      i++;
    }
    await this.saveBoard(board);
    setStatus(T`วาง ${list.length} รูปบนกระดาน "${AC.albumBaseName(this.albumId)}" แล้ว`);
    return list.length;
  }

  async fixRatio(it) {
    const nat = await naturalSize(await urlOf(this.root, itemPath(this.albumId, it.file)));
    const size = MB.sizeForAspect(it.w, nat.w, nat.h);
    const d = await this.doc();
    await this.saveBoard(MB.updateBoardItem(d.moodBoard, it.id, { w: size.w, h: size.h }));
  }

  async fixAllRatios() {
    const d = await this.doc();
    let board = MB.normalizeBoard(d.moodBoard);
    for (const it of board) {
      const nat = await naturalSize(await urlOf(this.root, itemPath(this.albumId, it.file)));
      const size = MB.sizeForAspect(it.w, nat.w, nat.h);
      board = MB.updateBoardItem(board, it.id, { w: size.w, h: size.h });
    }
    await this.saveBoard(board);
    setStatus(T`ปรับทุกชิ้นให้ตรงสัดส่วนรูปแล้ว`);
  }

  async tidy() {
    const d = await this.doc();
    await this.saveBoard(MB.tidyBoard(d.moodBoard));
  }

  async clear() {
    if (!(await confirmBox(T`ล้างกระดานอารมณ์ของอัลบั้มนี้? (ไม่ลบไฟล์รูป)`, T`ล้าง`))) return;
    await this.saveBoard([]);
  }

  async fit() {
    const d = await this.doc();
    const r = this._board ? this._board.getBoundingClientRect() : { width: 800, height: 600 };
    this.view = MB.fitView(d.moodBoard, r.width, r.height, 40);
    this.applyTransform();
  }

  async exportBoard() {
    const { exportMoodBoard } = await import('./gallery-export.js');
    const d = await this.doc();
    await exportMoodBoard(this.root, this.albumId, d.moodBoard);
  }
}

let inst = null;
/** ตัววาดของแผง `gallery-board` (app.js เรียกผ่าน FEATURE_PANELS) */
export function renderMoodBoardPanel(host, root) {
  if (!host) return null;
  if (!root) { host.innerHTML = ''; host.append(el('div', 'dim', T`เปิดโปรเจกต์ก่อน`)); return null; }
  if (inst) inst.destroy();
  host.innerHTML = '';
  inst = new MoodBoard(host, root);
  return inst;
}
export function moodBoardInstance() { return inst; }
/** วางรูปลงกระดานจากที่อื่น (ปุ่มในคลังรูป/เมนูคลิกขวา) — คืนจำนวนที่วางจริง */
export async function dropOnBoard(root, paths) {
  if (inst) return inst.add(paths);
  // แผงยังไม่เปิด → เขียนลงไฟล์ตรง ๆ ให้ก่อน แล้วค่อยเปิดแผง
  const albumId = boardAlbum();
  const d = await AC.readAlbumDoc(kapi, root, albumId);
  let board = d.moodBoard;
  for (const p of paths || []) {
    const rel = AC.albumRel(albumId);
    const file = rel && p.startsWith(rel + '/') ? p.slice(rel.length + 1) : p;
    const nat = await naturalSize(await urlOf(root, p));
    const size = MB.sizeForAspect(MB.DEFAULT_SIZE, nat.w, nat.h);
    board = MB.addToBoard(board, file, { x: 40, y: 40, w: size.w, h: size.h });
  }
  await AC.writeAlbumDoc(kapi, root, albumId, { ...d, moodBoard: MB.normalizeBoard(board) });
  notifyBoardChanged(albumId);
  return (paths || []).length;
}
