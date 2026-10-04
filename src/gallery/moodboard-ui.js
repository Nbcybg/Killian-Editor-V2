// moodboard-ui.js — กระดานอารมณ์เป็น "แผงของตัวเอง" (alpha.63r)
//
// ทำไมแยกออกมาจากแท็บในคลังรูป: กระดานต้องรับ **การลากรูปมาวาง** แต่ตอนเป็นแท็บ
// ตารางรูปกับกระดานอยู่คนละแท็บ → ลากจากตารางไปกระดานไม่ได้เลยแม้แต่ทางเดียว
//
// [alpha.167] กระดานรับ "การ์ด" ด้วย — ตัวละคร/สถานที่ (Wiki) · ฉาก · โน้ต · บท · อ้างอิง (ลิงก์/ข้อความ)
//
// [alpha.168] ยกเครื่องตามภาพกระดานอ้างอิงของผู้ใช้ — "drag and drop มันไม่วางตรง cursor · entities มีรูปแล้ว
//   ยังไม่โชว์เป็น card · card ชอบดีดออกเวลาปรับขนาด · ปรับ background ได้ · ย้าย card ทับบน ทับล่าง · ของเราโคตร basic"
//   ต้นตอ "ดีด/วางมั่ว": กฎ `.k-card{position:relative}` อยู่หลัง `.gal2-bitem{position:absolute}` ในไฟล์ CSS
//     → การ์ดถูกจัดวางแบบไหลต่อกัน (left/top กลายเป็นระยะเยื้องจากตำแหน่งไหล) ปรับขนาดใบหนึ่ง = ใบอื่นถูกดันไปด้วย
//   ต้นตอ "การ์ดหาย": `syncAlbumDoc` ตัดชิ้นที่ไม่มีไฟล์รูปทิ้ง = การ์ดทุกใบ (แก้ใน album-core)
//   ของใหม่: วางตรงเคอร์เซอร์ (กึ่งกลาง) · การ์ดตัวละครเป็นรูปใหญ่ + ชื่อใต้รูป · โน้ต · แถบสี · กรอบกลุ่มมีหัวข้อ ·
//   เลือก (คลิก/Shift/ลากกรอบ) + แถบลอยเลื่อนชั้น/ทำสำเนา/เอาออก · ฉากหลัง (สี · รูป · เบลอ · หรี่) · ล้อ = ซูม
//
// รูปบนกระดาน **ไม่ถูกครอบตัด** — `object-fit:contain` เสมอ และตอนวางครั้งแรกความสูงคิดจากสัดส่วนจริงของไฟล์

import { t, tf } from '../i18n.js';
import { gi } from '../icons.js';
import { ask, confirmBox, popupMenu, toast } from '../ui.js';
import { imageLightbox } from '../wiki.js';
import { el, setStatus, setStatusError, log } from '../core.js';
import { bindDropTarget } from '../drop-kit.js';
import { escCancelDrag } from '../drag-cancel.js';
import { failText } from '../err-text.js';
import { pickImage } from '../gallery.js';
import * as AC from './album-core.js';
import * as MB from './moodboard.js';
import { boardAlbum, setCurrentAlbum, onAlbumChange, onBoardChange, notifyBoardChanged } from './gallery-bus.js';

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

const PALETTE_DEFAULT = ['#1e1250', '#452f5e', '#ff6640', '#ffc55c', '#f4efe2'];
const UNDO_MAX = 60;
const NOTE_COLORS = ['#f2c14e', '#9fd3c7', '#f4a6a6', '#b8c1ec', '#e8e8e8'];

export class MoodBoard {
  constructor(host, root, opts = {}) {
    this.host = host;
    this.root = root;
    this.opts = opts;
    this.view = { zoom: 1, panX: 40, panY: 40 };
    this.albumId = boardAlbum();
    this.sel = new Set();
    // [alpha.168 · bug hunt] ประวัติย้อนกลับของกระดาน — เดิมย้าย/ย่อขยาย/จัดเรียง/ล้างกระดาน ย้อนไม่ได้เลย
    this._undo = []; this._redo = [];
    this._gen = 0;
    this._off = [
      onAlbumChange(() => { this.albumId = boardAlbum(); this.sel.clear(); this.render(); }),
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
    const bg = el('div', 'gal2-board-bg');
    const canvas = el('div', 'gal2-canvas');
    const selbar = el('div', 'gal2-selbar');
    board.append(bg, canvas, selbar);
    board.tabIndex = 0;
    wrap.append(board);
    this._board = board;
    this._bg = bg;
    this._canvas = canvas;
    this._selbar = selbar;
    this.bindBoard(board);
    await this.drawBoard();
  }

  buildBar(list) {
    const bar = el('div', 'gal2-bar gal2-boardbar');
    const sel = el('select', 'wiki-input k-dlg-select gal2-board-sel');
    sel.title = t('ui.galleryMoodboard.boardAlbum');
    for (const a of list) {
      const o = el('option', null, a.id === AC.ROOT_ALBUM ? AC.ROOT_ALBUM_NAME : a.id);
      o.value = a.id;
      if (a.id === this.albumId) o.selected = true;
      sel.append(o);
    }
    sel.onchange = () => { setCurrentAlbum(sel.value, 'board'); };
    const mk = (label, fn, title, cls = '') => {
      const b = el('button', 'cmp-mini' + (cls ? ' ' + cls : ''), label);
      if (title) b.title = title;
      b.onclick = fn;
      return b;
    };
    const center = () => { const r = this._board ? this._board.getBoundingClientRect() : { width: 600, height: 400 };
      return MB.toBoard(this.view, r.width / 2, r.height / 2); };
    const addB = mk(gi('plus') + ' ' + t('ui.galleryMoodboard.add'), (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      popupMenu(r.left, r.bottom + 4, this.addMenuItems(center()));
    }, t('ui.galleryMoodboard.addTip'), 'mb-add');
    const refB = mk(gi('bookmark') + ' ' + t('ui.galleryMoodboard.addRef'), () => this.addRefDialog(), t('ui.galleryMoodboard.addRefTip'));
    const bgB = mk(gi('palette') + ' ' + t('ui.galleryMoodboard.bg'), (e) => this.bgPopover(e.currentTarget), t('ui.galleryMoodboard.bgTip'), 'mb-bg-btn');
    const expB = mk(gi('download') + ' ' + t('ui.galleryMoodboard.export'), (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      popupMenu(r.left, r.bottom + 4, [
        { label: t('ui.galleryMoodboard.exportPng'), click: () => this.exportBoard() },
        { label: t('ui.galleryMoodboard.exportHtml'), click: () => this.exportHtml() },
      ]);
    }, t('ui.galleryMoodboard.exportTip'));
    const more = mk(gi('more'), (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      popupMenu(r.left, r.bottom + 4, [
        { label: t('ui.galleryMoodboard.arrangeAuto'), click: () => this.tidy() },
        { label: t('ui.galleryMoodboard.adjustAllItemAt2'), click: () => this.fixAllRatios() },
        '-',
        { label: t('ui.galleryMoodboard.clearBoardNotDel'), danger: true, click: () => this.clear() },
      ]);
    }, t('ui.galleryMoodboard.cmdAddFillBoard'));
    const fitB = mk(gi('fit-screen'), () => this.fit(), t('ui.galleryMoodboard.fitTip'));
    fitB.setAttribute('aria-label', t('ui.common.fitScreen'));
    bar.append(sel, addB, refB, el('span', 'gal2-bar-sp'), bgB, fitB, expB, more);
    return bar;
  }

  /** รายการ "เพิ่ม" (ใช้ทั้งปุ่มบนแถบและคลิกขวาที่ว่าง) */
  addMenuItems(at) {
    return [
      { label: gi('note') + ' ' + t('ui.galleryMoodboard.addNote'), click: () => this.addKind('note', at) },
      { label: gi('palette') + ' ' + t('ui.galleryMoodboard.addPalette'), click: () => this.addKind('palette', at) },
      { label: gi('frame') + ' ' + t('ui.galleryMoodboard.addGroup'), click: () => this.addKind('group', at) },
      { label: gi('bookmark') + ' ' + t('ui.galleryMoodboard.addRef'), click: () => this.addRefDialog(null, at) },
      { label: gi('image') + ' ' + t('ui.galleryMoodboard.addImage'), click: async () => {
        const it = await pickImage(this.root); if (it) await this.add([it.file], at, { center: true }); } },
    ];
  }

  // ═══════════ มุมมอง · ลาก · หยิบใส่ ═══════════
  bindBoard(board) {
    // ล้อ = ซูมยึดเคอร์เซอร์ (แบบแผนที่/กระดานวางแผน) · Shift+ล้อ = เลื่อนแนวนอน
    board.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.shiftKey) { this.view.panX -= e.deltaY || e.deltaX; this.applyTransform(); return; }
      const r = board.getBoundingClientRect();
      this.view = MB.zoomAt(this.view, e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
      this.applyTransform();
    }, { passive: false });

    // ลากที่ว่าง = เลื่อนกระดาน · Shift+ลาก = ลากกรอบเลือก · คลิกที่ว่าง = ยกเลิกการเลือก
    board.addEventListener('mousedown', (e) => {
      if (e.target !== board && e.target !== this._canvas && e.target !== this._bg) return;
      if (e.button !== 0 && e.button !== 1) return;
      board.focus({ preventScroll: true });
      if (e.button === 0 && e.shiftKey) return this.rubberSelect(e);
      const s = { x: e.clientX, y: e.clientY, panX: this.view.panX, panY: this.view.panY };
      let moved = false;
      const mv = (ev) => {
        if (!moved && Math.abs(ev.clientX - s.x) + Math.abs(ev.clientY - s.y) < 3) return;
        moved = true; board.classList.add('panning');
        this.view.panX = s.panX + (ev.clientX - s.x);
        this.view.panY = s.panY + (ev.clientY - s.y);
        this.applyTransform();
      };
      const offEsc = escCancelDrag(() => {
        board.classList.remove('panning');
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        this.view.panX = s.panX; this.view.panY = s.panY; this.applyTransform();
      });
      const up = () => {
        offEsc();
        board.classList.remove('panning');
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        if (!moved && this.sel.size) { this.sel.clear(); this.paintSelection(); }
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
    // ดับเบิลคลิกที่ว่าง = โน้ตใหม่ตรงนั้น · คลิกขวาที่ว่าง = เมนูเพิ่มของ
    board.addEventListener('dblclick', (e) => {
      if (e.target !== board && e.target !== this._canvas && e.target !== this._bg) return;
      const r = board.getBoundingClientRect();
      this.addKind('note', MB.toBoard(this.view, e.clientX - r.left, e.clientY - r.top));
    });
    board.addEventListener('contextmenu', (e) => {
      if (e.target !== board && e.target !== this._canvas && e.target !== this._bg) return;
      e.preventDefault();
      const r = board.getBoundingClientRect();
      const at = MB.toBoard(this.view, e.clientX - r.left, e.clientY - r.top);
      popupMenu(e.clientX, e.clientY, [...this.addMenuItems(at), '-',
        { label: t('ui.galleryMoodboard.bg'), click: () => this.bgPopover(this._board.parentElement.querySelector('.mb-bg-btn')) },
        { label: t('ui.common.fitScreen'), click: () => this.fit() }]);
    });
    // คีย์บอร์ด: Delete = เอาออกจากกระดาน · Esc = ยกเลิกการเลือก · Ctrl+D = ทำสำเนา · ] [ = เลื่อนชั้น
    board.addEventListener('keydown', async (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      // [alpha.168] ย้อนกลับ/ทำซ้ำ — ปุ่มกายภาพ (e.code) · แผงนี้เป็นเจ้าของ Ctrl+Z ตอนถูกเลือก (setPanelOwnsKeys)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault(); e.stopPropagation();
        const redo = e.code === 'KeyY' || e.shiftKey;
        if (!(await this.stepHistory(redo ? 1 : -1))) setStatus(t(redo ? 'ui.galleryMoodboard.redoNone' : 'ui.galleryMoodboard.undoNone'));
        return;
      }
      if (!this.sel.size) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); await this.removeSel(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.sel.clear(); this.paintSelection(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') { e.preventDefault(); await this.duplicateSel(); }
      else if (e.code === 'BracketRight') { e.preventDefault(); await this.layer(e.shiftKey ? 'front' : 1); }
      else if (e.code === 'BracketLeft') { e.preventDefault(); await this.layer(e.shiftKey ? 'back' : -1); }
    });

    // หยิบใส่: รูปจากคลังรูป = รูป · ตัวละคร/ฉาก/โน้ต/บท = การ์ด · ลิงก์จากเบราว์เซอร์ = การ์ดอ้างอิง — วางตรงเคอร์เซอร์
    bindDropTarget(board, {
      accept: ['gallery', 'image', 'entity', 'scene', 'memo', 'chapter', 'url', 'book'],
      hoverClass: 'drop',
      onDrop: async (payload, e) => {
        const r = board.getBoundingClientRect();
        const at = MB.toBoard(this.view, e.clientX - r.left, e.clientY - r.top);
        await this.dropPayload(payload, at, { center: true });
      },
      onError: (err) => { log('error', 'moodboard: drop failed', err); setStatusError(failText(t('ui.galleryMoodboard.dropFail'), err)); },
    });
  }

  rubberSelect(e) {
    const board = this._board, r = board.getBoundingClientRect();
    const box = el('div', 'gal2-rubber');
    board.append(box);
    const x0 = e.clientX, y0 = e.clientY;
    const paint = (ev) => {
      box.style.left = (Math.min(x0, ev.clientX) - r.left) + 'px'; box.style.top = (Math.min(y0, ev.clientY) - r.top) + 'px';
      box.style.width = Math.abs(ev.clientX - x0) + 'px'; box.style.height = Math.abs(ev.clientY - y0) + 'px';
    };
    paint(e);
    const done = async (ev, cancel) => {
      document.removeEventListener('mousemove', paint); document.removeEventListener('mouseup', upH);
      box.remove();
      if (cancel || !ev) return;
      const a = MB.toBoard(this.view, Math.min(x0, ev.clientX) - r.left, Math.min(y0, ev.clientY) - r.top);
      const b = MB.toBoard(this.view, Math.max(x0, ev.clientX) - r.left, Math.max(y0, ev.clientY) - r.top);
      for (const it of this._items || []) if (it.x < b.x && it.x + it.w > a.x && it.y < b.y && it.y + it.h > a.y && it.kind !== 'group') this.sel.add(it.id);
      this.paintSelection();
    };
    const offEsc = escCancelDrag(() => done(null, true));
    const upH = (ev) => { offEsc(); done(ev, false); };
    document.addEventListener('mousemove', paint); document.addEventListener('mouseup', upH);
  }

  applyTransform() {
    if (!this._canvas) return;
    const v = this.view;
    this._canvas.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
    this._canvas.style.setProperty('--mbz', String(v.zoom));
    this.placeSelbar();
  }

  async doc() { return AC.readAlbumDoc(kapi, this.root, this.albumId); }

  /** @param o.noHistory ไม่จดประวัติ (ใช้ตอนย้อนกลับ/ทำซ้ำเอง) */
  async saveBoard(board, o = {}) {
    const d = await this.doc();
    const next = MB.normalizeBoard(board);
    if (!o.noHistory) {
      const was = JSON.stringify(MB.normalizeBoard(d.moodBoard)), now = JSON.stringify(next);
      if (was !== now) {
        this._undo.push({ album: this.albumId, board: was });
        if (this._undo.length > UNDO_MAX) this._undo.shift();
        this._redo = [];
      }
    }
    await AC.writeAlbumDoc(kapi, this.root, this.albumId, { ...d, moodBoard: next });
    notifyBoardChanged(this.albumId);
  }
  /** ย้อนกลับ/ทำซ้ำการแก้กระดานของอัลบั้มนี้ (ประวัติของอัลบั้มอื่นถูกข้าม) → true = มีอะไรให้ย้อน */
  async stepHistory(dir) {
    const from = dir < 0 ? this._undo : this._redo, to = dir < 0 ? this._redo : this._undo;
    let h = null;
    while (from.length) { const x = from.pop(); if (x.album === this.albumId) { h = x; break; } }
    if (!h) return false;
    to.push({ album: this.albumId, board: JSON.stringify(MB.normalizeBoard((await this.doc()).moodBoard)) });
    this.sel.clear();
    await this.saveBoard(JSON.parse(h.board), { noHistory: true });
    return true;
  }

  // ═══════════ ฉากหลัง ═══════════
  paintBg(bgRaw) {
    const bg = MB.normalizeBoardBg(bgRaw);
    const host = this._bg, board = this._board;
    if (!host) return;
    board.classList.toggle('gal2-board-custom', !!(bg.color || bg.image));
    board.style.setProperty('--mb-bg', bg.color || '');
    if (bg.image) {
      urlOf(this.root, bg.image).then((u) => {
        host.style.backgroundImage = `url("${String(u).replace(/"/g, '%22')}")`;
      }).catch(() => {});
      host.style.filter = bg.blur ? `blur(${bg.blur}px)` : '';
      host.style.inset = bg.blur ? (-Math.ceil(bg.blur * 2.5)) + 'px' : '0';
      host.style.setProperty('--mb-dim', String(bg.dim));
      host.classList.add('on');
    } else { host.style.backgroundImage = 'none'; host.style.filter = ''; host.classList.remove('on'); }
  }
  async saveBg(patch) {
    const d = await this.doc();
    const next = MB.normalizeBoardBg({ ...(d.moodBoardBg || {}), ...patch });
    await AC.writeAlbumDoc(kapi, this.root, this.albumId, { ...d, moodBoardBg: next });
    this.paintBg(next);
    return next;
  }
  async bgPopover(anchor) {
    const old = document.querySelector('.mb-bg-pop');
    if (old) { old.remove(); return; }
    const d = await this.doc();
    const bg = MB.normalizeBoardBg(d.moodBoardBg);
    const pop = el('div', 'mb-bg-pop k-hud-pop');
    const row = (label, ...kids) => { const r = el('label', 'mb-bg-row'); r.append(el('span', null, label), ...kids); pop.append(r); return r; };
    const col = el('input', 'mb-bg-color'); col.type = 'color'; col.value = bg.color || '#1b1d21';
    col.oninput = () => this.paintBg({ ...bg, color: col.value });
    col.onchange = async () => { bg.color = col.value; await this.saveBg({ color: col.value }); };
    const colReset = el('button', 'cmp-mini', t('ui.galleryMoodboard.bgTheme'));
    colReset.title = t('ui.galleryMoodboard.bgThemeTip');
    colReset.onclick = async (e) => { e.preventDefault(); bg.color = ''; await this.saveBg({ color: '' }); };
    row(t('ui.galleryMoodboard.bgColor'), col, colReset);
    const imgB = el('button', 'cmp-mini', bg.image ? t('ui.galleryMoodboard.bgImageChange') : t('ui.galleryMoodboard.bgImagePick'));
    imgB.onclick = async (e) => { e.preventDefault(); const it = await pickImage(this.root); if (!it) return;
      bg.image = it.file; await this.saveBg({ image: it.file }); imgB.textContent = t('ui.galleryMoodboard.bgImageChange'); };
    const imgX = el('button', 'cmp-mini', gi('x'));
    imgX.title = t('ui.galleryMoodboard.bgImageRemove');
    imgX.onclick = async (e) => { e.preventDefault(); bg.image = ''; await this.saveBg({ image: '' }); };
    row(t('ui.galleryMoodboard.bgImage'), imgB, imgX);
    const blur = el('input', 'mb-bg-blur'); blur.type = 'range'; blur.min = '0'; blur.max = '40'; blur.value = String(bg.blur);
    blur.oninput = () => this.paintBg({ ...bg, blur: +blur.value });
    blur.onchange = async () => { bg.blur = +blur.value; await this.saveBg({ blur: bg.blur }); };
    row(t('ui.galleryMoodboard.bgBlur'), blur);
    const dim = el('input', 'mb-bg-dim'); dim.type = 'range'; dim.min = '0'; dim.max = '90'; dim.value = String(Math.round(bg.dim * 100));
    dim.oninput = () => this.paintBg({ ...bg, dim: +dim.value / 100 });
    dim.onchange = async () => { bg.dim = +dim.value / 100; await this.saveBg({ dim: bg.dim }); };
    row(t('ui.galleryMoodboard.bgDim'), dim);
    document.body.append(pop);
    const r = anchor ? anchor.getBoundingClientRect() : { left: 200, bottom: 200 };
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 290, r.left)) + 'px';
    pop.style.top = (r.bottom + 6) + 'px';
    const off = (ev) => { if (!pop.contains(ev.target) && ev.target !== anchor) { pop.remove(); document.removeEventListener('mousedown', off, true); } };
    setTimeout(() => document.addEventListener('mousedown', off, true), 0);
    return pop;
  }

  // ═══════════ วาด ═══════════
  async drawBoard() {
    const gen = this._gen;
    // วาดซ้อนกันสองรอบ (วางสองชิ้นติดกัน) = ประกอบนอกจอ แล้วสลับเข้าเฉพาะรอบล่าสุด
    const seq = this._drawSeq = (this._drawSeq || 0) + 1;
    const canvas = this._canvas;
    if (!canvas) return;
    const d = await this.doc();
    if (gen !== this._gen || seq !== this._drawSeq) return;
    this.paintBg(d.moodBoardBg);
    const board = MB.normalizeBoard(d.moodBoard);
    this._items = board;
    for (const id of [...this.sel]) if (!board.some((it) => it.id === id)) this.sel.delete(id);
    const frag = document.createDocumentFragment();
    // [alpha.168] คำแนะนำตอนกระดานว่างอยู่บน "จอ" (ตัวกระดาน) ไม่ใช่บนผืนที่ซูม/เลื่อน — ผืนกว้าง 0 ทำให้ข้อความถูกบีบเป็นคอลัมน์แคบ
    if (this._board) this._board.querySelectorAll(':scope > .gal2-board-hint').forEach((h) => h.remove());
    if (!board.length) {
      const hint = el('div', 'gal2-board-hint');
      hint.append(el('div', 'gal2-hint-ic', gi('image-add')),
        el('b', null, t('ui.galleryMoodboard.emptyTitle')),
        el('div', null, t('ui.galleryMoodboard.boardEmptyOpenPanel') + t('ui.galleryMoodboard.pickImageLibraryDone')));
      (this._board || canvas).append(hint);
    } else {
      for (const it of MB.boardOrder(board)) {
        const node = await this.itemEl(it);
        if (gen !== this._gen || seq !== this._drawSeq) return;
        frag.append(node);
      }
    }
    canvas.replaceChildren(frag);
    this.applyTransform();
    this.paintSelection();
  }

  /** กรอบ + ที่จับของชิ้น (ใช้ร่วมทุกชนิด) */
  shell(it, cls) {
    const node = el('div', 'gal2-bitem ' + cls);
    node.dataset.id = it.id;
    if (it.kind) node.dataset.kind = it.kind;
    node.style.left = it.x + 'px'; node.style.top = it.y + 'px';
    node.style.width = it.w + 'px'; node.style.height = it.h + 'px';
    node.style.zIndex = String(100 + it.z);
    return node;
  }

  async itemEl(it) {
    if (MB.isCard(it)) return this.cardEl(it);
    const node = this.shell(it, 'gal2-img');
    const im = el('img');
    im.src = await urlOf(this.root, itemPath(this.albumId, it.file));
    im.draggable = false;
    im.alt = it.file;
    node.append(im);
    if (it.caption) node.append(el('span', 'gal2-caption', it.caption));
    node.append(el('span', 'gal2-bresize'));
    this.bindMove(node, it, node.querySelector('.gal2-bresize'), true);
    node.ondblclick = () => imageLightbox(im.src, it.caption || it.file);
    node.oncontextmenu = (e) => this.itemMenu(e, it, [
      { label: t('ui.common.viewImageFull'), click: () => imageLightbox(im.src, it.file) },
      { label: t('ui.galleryMoodboard.caption'), click: async () => {
        const v = await ask(t('ui.galleryMoodboard.caption'), { value: it.caption || '', placeholder: t('ui.galleryMoodboard.captionPh') });
        if (v == null) return; await this.patch(it.id, { caption: String(v).trim() }); } },
      { label: t('ui.galleryMoodboard.adjustAtRatioImage'), click: () => this.fixRatio(it) },
    ], it.file);
    return node;
  }

  // ═══════════ การ์ด ═══════════
  /** รูปประจำตัวของหน้า Wiki (อ่านครั้งเดียวต่อรอบวาด) */
  async portraits() {
    if (this._port && this._portGen === this._gen) return this._port;
    this._portGen = this._gen;
    this._port = new Map();
    try {
      const { loadAllEntities } = await import('../app.js');
      for (const e of await loadAllEntities({ entitiesOnly: true })) {
        if (!e.file || !/\.json$/i.test(e.file)) continue;
        const rel = (await kapi.relative(this.root, e.file)).replace(/\\/g, '/');
        this._port.set(rel, { image: e.image || '', cat: e.cat, name: e.name });
      }
    } catch (e) { log('warn', 'moodboard: portraits failed', e); }
    return this._port;
  }

  async cardEl(it) {
    if (it.kind === 'group') return this.groupEl(it);
    if (it.kind === 'note') return this.noteEl(it);
    if (it.kind === 'palette') return this.paletteEl(it);
    if (it.kind === 'entity') return this.entityEl(it);
    const node = this.shell(it, 'gal2-card k-card');
    const ICON = { scene: 'file', memo: 'note', chapter: 'book', ref: it.url ? 'link' : 'bookmark' };
    const av = el('span', 'k-card-av');
    av.textContent = gi(ICON[it.kind] || 'bookmark');
    const sub = it.kind === 'ref' ? (MB.urlHost(it.url) || t('ui.galleryMoodboard.cardRef'))
        : it.kind === 'memo' ? t('ui.galleryMoodboard.cardMemo')
        : it.kind === 'chapter' ? t('ui.galleryMoodboard.cardChapter')
        : t('ui.galleryMoodboard.cardScene');
    const main = el('div', 'k-card-main');
    main.append(el('div', 'k-card-title', it.title || it.url || t('ui.common.notNamed')));
    main.append(el('div', 'k-card-sub', sub));
    if (it.text) main.append(el('div', 'gal2-card-text', it.text));
    node.append(av, main, el('span', 'gal2-bresize'));
    if (it.color) node.style.setProperty('--k-c', it.color);
    node.title = [it.title, it.url, it.text].filter(Boolean).join('\n') + '\n' + t('ui.galleryMoodboard.cardTip');
    this.bindMove(node, it, node.querySelector('.gal2-bresize'), false);
    node.ondblclick = () => this.openCard(it);
    node.oncontextmenu = (e) => this.itemMenu(e, it, [
      { label: t('ui.galleryMoodboard.cardOpen'), click: () => this.openCard(it) },
      it.kind === 'ref' ? { label: t('ui.galleryMoodboard.cardEdit'), click: () => this.addRefDialog(it) } : null,
    ], it.title || it.url || '');
    return node;
  }

  /** ตัวละคร/สถานที่ = การ์ดรูปใหญ่ + ชื่อใต้รูป (แบบภาพกระดานอ้างอิง) · ไม่มีรูป = ไอคอนหมวดตัวใหญ่ */
  async entityEl(it) {
    const node = this.shell(it, 'gal2-card gal2-ent');
    const info = (await this.portraits()).get(it.path);
    const pic = el('div', 'gal2-ent-pic');
    if (info && info.image) {
      const im = el('img'); im.draggable = false; im.alt = '';
      im.src = await kapi.toFileURL(await kapi.join(this.root, AC.IMAGES_DIR, ...String(info.image).split('/')));
      pic.append(im);
    } else pic.append(el('span', 'gal2-ent-ic', gi(it.cat === 'locations' || (info && info.cat === 'locations') ? 'map-pin' : 'user')));
    let sub = '';
    try { const { catLabel } = await import('../app.js'); sub = catLabel((info && info.cat) || it.cat || ''); } catch { sub = it.cat || ''; }
    const cap = el('div', 'gal2-ent-cap');
    cap.append(el('div', 'gal2-ent-name', (info && info.name) || it.title || t('ui.common.notNamed')), el('div', 'gal2-ent-sub', sub));
    node.append(pic, cap, el('span', 'gal2-bresize'));
    node.title = ((info && info.name) || it.title || '') + '\n' + t('ui.galleryMoodboard.cardTip');
    this.bindMove(node, it, node.querySelector('.gal2-bresize'), false);
    node.ondblclick = () => this.openCard(it);
    node.oncontextmenu = (e) => this.itemMenu(e, it, [
      { label: t('ui.galleryMoodboard.cardOpen'), click: () => this.openCard(it) },
    ], (info && info.name) || it.title || '');
    return node;
  }

  noteEl(it) {
    const node = this.shell(it, 'gal2-card gal2-note');
    node.style.setProperty('--note', it.color || NOTE_COLORS[0]);
    if (it.title) node.append(el('div', 'gal2-note-title', it.title));
    const body = el('div', 'gal2-note-text', it.text || '');
    node.append(body, el('span', 'gal2-bresize'));
    this.bindMove(node, it, node.querySelector('.gal2-bresize'), false);
    // ดับเบิลคลิก = แก้ข้อความในที่ (ไม่เด้งกล่อง)
    node.ondblclick = (e) => { e.stopPropagation(); this.editNote(node, it); };
    node.oncontextmenu = (e) => this.itemMenu(e, it, [
      { label: t('ui.galleryMoodboard.noteEdit'), click: () => this.editNote(node, it) },
      { label: t('ui.galleryMoodboard.noteColor'), sub: () => NOTE_COLORS.map((c) => ({ text: c, swatch: c, click: () => this.patch(it.id, { color: c }) })) },
    ], (it.text || '').slice(0, 30));
    return node;
  }
  editNote(node, it) {
    const body = node.querySelector('.gal2-note-text');
    if (!body || node.querySelector('textarea')) return;
    const ta = el('textarea', 'gal2-note-edit');
    ta.value = it.text || '';
    body.replaceWith(ta);
    ta.focus();
    const done = async (keep) => {
      if (!ta.isConnected) return;
      const v = ta.value;
      if (keep && v !== (it.text || '')) await this.patch(it.id, { text: v });
      else this.drawBoard();
    };
    ta.onblur = () => done(true);
    ta.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); ta.onblur = null; done(false); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ta.blur(); }
    };
    ta.onmousedown = (e) => e.stopPropagation();
  }

  paletteEl(it) {
    const node = this.shell(it, 'gal2-card gal2-palette');
    const row = el('div', 'gal2-pal-row');
    for (const c of it.colors || []) {
      const sw = el('span', 'gal2-pal-sw');
      sw.style.background = c;
      sw.title = c + ' — ' + t('ui.galleryMoodboard.paletteCopy');
      sw.ondblclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(c).catch(() => {}); setStatus(tf('ui.galleryMoodboard.paletteCopied', c)); };
      row.append(sw);
    }
    node.append(row, el('span', 'gal2-bresize'));
    this.bindMove(node, it, node.querySelector('.gal2-bresize'), false);
    node.oncontextmenu = (e) => this.itemMenu(e, it, [
      { label: t('ui.galleryMoodboard.paletteEdit'), click: async () => {
        const v = await ask(t('ui.galleryMoodboard.paletteEdit'), { value: (it.colors || []).join(', '), placeholder: '#1e1250, #ff6640' });
        if (v == null) return;
        const colors = String(v).split(/[\s,]+/).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
        if (colors.length) await this.patch(it.id, { colors }); } },
    ], t('ui.galleryMoodboard.addPalette'));
    return node;
  }

  groupEl(it) {
    const node = this.shell(it, 'gal2-card gal2-group');
    if (it.color) node.style.setProperty('--grp', it.color);
    const head = el('div', 'gal2-group-title', it.title || t('ui.galleryMoodboard.groupUntitled'));
    node.append(head, el('span', 'gal2-bresize'));
    this.bindMove(node, it, node.querySelector('.gal2-bresize'), false);
    head.ondblclick = async (e) => {
      e.stopPropagation();
      const v = await ask(t('ui.galleryMoodboard.groupName'), { value: it.title || '' });
      if (v != null) await this.patch(it.id, { title: String(v).trim() });
    };
    node.oncontextmenu = (e) => this.itemMenu(e, it, [
      { label: t('ui.galleryMoodboard.groupName'), click: () => head.ondblclick(new MouseEvent('dblclick')) },
    ], it.title || t('ui.galleryMoodboard.groupUntitled'));
    return node;
  }

  /** เมนูคลิกขวาของชิ้น: รายการเฉพาะชนิด + ลำดับชั้น + ทำสำเนา + เอาออก */
  itemMenu(e, it, extra, head) {
    e.preventDefault(); e.stopPropagation();
    if (!this.sel.has(it.id)) { this.sel = new Set([it.id]); this.paintSelection(); }
    popupMenu(e.clientX, e.clientY, [
      head ? { text: head, disabled: true } : null,
      ...(extra || []).filter(Boolean),
      '-',
      { label: t('ui.galleryMoodboard.top'), click: () => this.layer('front') },
      { label: t('ui.galleryMoodboard.layerUp'), click: () => this.layer(1) },
      { label: t('ui.galleryMoodboard.layerDown'), click: () => this.layer(-1) },
      { label: t('ui.galleryMoodboard.bottomLast'), click: () => this.layer('back') },
      { label: t('ui.galleryMoodboard.duplicate'), click: () => this.duplicateSel() },
      '-',
      { label: MB.isCard(it) ? t('ui.galleryMoodboard.cardRemove') : t('ui.galleryMoodboard.exitBoardNotDel'), click: () => this.removeSel() },
    ].filter(Boolean));
  }

  // ═══════════ เลือก · แถบลอย ═══════════
  paintSelection() {
    if (!this._canvas) return;
    for (const n of this._canvas.querySelectorAll('.gal2-bitem')) n.classList.toggle('sel', this.sel.has(n.dataset.id));
    const bar = this._selbar;
    if (!bar) return;
    bar.replaceChildren();
    if (!this.sel.size) { bar.classList.remove('on'); return; }
    const b = (icon, tip, fn, cls = '') => { const x = el('button', 'cmp-mini gal2-sb' + (cls ? ' ' + cls : ''), gi(icon)); x.title = tip;
      x.setAttribute('aria-label', tip); x.onmousedown = (e) => e.stopPropagation(); x.onclick = fn; return x; };
    bar.append(el('span', 'gal2-sb-n', tf('ui.galleryMoodboard.selCount', this.sel.size)),
      b('arrange-bring-to-front', t('ui.galleryMoodboard.top'), () => this.layer('front')),
      b('arrow-up', t('ui.galleryMoodboard.layerUp'), () => this.layer(1)),
      b('arrow-down', t('ui.galleryMoodboard.layerDown'), () => this.layer(-1)),
      b('arrange-send-to-back', t('ui.galleryMoodboard.bottomLast'), () => this.layer('back')),
      b('duplicate', t('ui.galleryMoodboard.duplicate'), () => this.duplicateSel()),
      b('trash', t('ui.galleryMoodboard.exitBoardNotDel'), () => this.removeSel(), 'k-danger'));
    bar.classList.add('on');
    this.placeSelbar();
  }
  placeSelbar() {
    const bar = this._selbar;
    if (!bar || !bar.classList.contains('on') || !this._board) return;
    const nodes = [...this._canvas.querySelectorAll('.gal2-bitem.sel')];
    if (!nodes.length) return;
    const br = this._board.getBoundingClientRect();
    let l = Infinity, tp = Infinity, rr = -Infinity;
    for (const n of nodes) { const r = n.getBoundingClientRect(); l = Math.min(l, r.left); tp = Math.min(tp, r.top); rr = Math.max(rr, r.right); }
    const w = bar.offsetWidth || 240;
    let x = (l + rr) / 2 - br.left - w / 2, y = tp - br.top - (bar.offsetHeight || 34) - 10;
    x = Math.max(6, Math.min(br.width - w - 6, x));
    if (y < 6) y = 6;
    bar.style.left = x + 'px'; bar.style.top = y + 'px';
  }
  async layer(dir) {
    let board = (await this.doc()).moodBoard;
    for (const id of this.sel) {
      if (dir === 'front') board = MB.moveToFront(board, id);
      else if (dir === 'back') board = MB.moveToBack(board, id);
      else board = MB.stepLayer(board, id, dir);
    }
    await this.saveBoard(board);
  }
  async duplicateSel() {
    const before = new Set(MB.normalizeBoard((await this.doc()).moodBoard).map((x) => x.id));
    const board = MB.duplicateItems((await this.doc()).moodBoard, [...this.sel]);
    this.sel = new Set(board.filter((x) => !before.has(x.id)).map((x) => x.id));
    await this.saveBoard(board);
  }
  async removeSel() {
    const before = (await this.doc()).moodBoard;
    let board = before;
    const n = this.sel.size;
    for (const id of this.sel) board = MB.removeFromBoard(board, id);
    this.sel.clear();
    await this.saveBoard(board);
    // [alpha.168] ลบด้วยปุ่ม Delete ไม่มีกล่องยืนยัน → ให้ย้อนกลับได้จากข้อความแจ้ง (คืนกระดานก่อนลบทั้งชุด)
    if (n) toast(tf('ui.galleryMoodboard.removedN', n), { action: { label: t('ui.common.undoBtn'), onClick: () => this.saveBoard(before) } });
  }
  async patch(id, p) {
    const d = await this.doc();
    await this.saveBoard(MB.updateBoardItem(d.moodBoard, id, p));
  }

  /**
   * ลากย้าย/ปรับขนาดชิ้น (ใช้ทุกชนิด) — แก้ style สด บันทึกครั้งเดียวตอนปล่อย
   * คลิก = เลือก · Shift+คลิก = เลือกเพิ่ม · ลากชิ้นที่เลือกอยู่ = ย้ายทั้งชุด · ลากกรอบกลุ่ม = ของข้างในตามไป
   */
  bindMove(node, it, grip, keepRatioDefault) {
    node.addEventListener('mousedown', (e) => {
      if (e.target === grip || e.button !== 0) return;
      if (e.target.closest && e.target.closest('textarea')) return;
      e.stopPropagation();
      this._board && this._board.focus({ preventScroll: true });
      // Ctrl+คลิก = กระโดดไปของที่การ์ดชี้ (ทางสากลเดียวกับตัวแก้ไข/แผนที่/เส้นเวลา)
      if ((e.ctrlKey || e.metaKey) && MB.isCard(it) && !['note', 'palette', 'group'].includes(it.kind)) { e.preventDefault(); this.openCard(it); return; }
      if (e.shiftKey) { if (this.sel.has(it.id)) this.sel.delete(it.id); else this.sel.add(it.id); this.paintSelection(); return; }
      if (!this.sel.has(it.id)) { this.sel = new Set([it.id]); this.paintSelection(); }
      const z = this.view.zoom;
      // ชุดที่ลาก = ที่เลือก + ของข้างในกลุ่มที่เลือก
      const ids = new Set(this.sel);
      for (const g of (this._items || []).filter((x) => ids.has(x.id) && x.kind === 'group')) for (const inner of MB.itemsInGroup(this._items, g)) ids.add(inner.id);
      const start = new Map((this._items || []).filter((x) => ids.has(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]));
      const s0 = { x: e.clientX, y: e.clientY };
      let moved = false, dx = 0, dy = 0;
      const put = () => {
        for (const [id, p] of start) {
          const n = this._canvas.querySelector(`.gal2-bitem[data-id="${id}"]`);
          if (n) { n.style.left = (p.x + dx) + 'px'; n.style.top = (p.y + dy) + 'px'; }
        }
        this.placeSelbar();
      };
      const mv = (ev) => {
        if (!moved && Math.abs(ev.clientX - s0.x) + Math.abs(ev.clientY - s0.y) < 3) return;
        moved = true; node.classList.add('dragging');
        const p0 = start.get(it.id) || { x: it.x, y: it.y };
        dx = MB.snap(p0.x + (ev.clientX - s0.x) / z) - p0.x;
        dy = MB.snap(p0.y + (ev.clientY - s0.y) / z) - p0.y;
        put();
      };
      const offEsc = escCancelDrag(() => {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        node.classList.remove('dragging'); dx = 0; dy = 0; put();
      });
      const up = async () => {
        offEsc();
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        node.classList.remove('dragging');
        if (moved && (dx || dy)) {
          const d = await this.doc();
          await this.saveBoard(MB.moveItems(d.moodBoard, [...start.keys()], dx, dy));
        }
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
    grip.addEventListener('mousedown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const z = this.view.zoom;
      const s0 = { x: e.clientX, y: e.clientY, w: it.w, h: it.h };
      const ratio = it.w > 0 ? it.h / it.w : 1;
      let moved = false, w = it.w, h = it.h;
      const mv = (ev) => {
        moved = true;
        const keep = keepRatioDefault ? !ev.altKey : ev.altKey;
        w = MB.clamp(s0.w + (ev.clientX - s0.x) / z, MB.MIN_SIZE, MB.MAX_SIZE);
        h = keep ? MB.clamp(w * ratio, MB.MIN_SIZE, MB.MAX_SIZE) : MB.clamp(s0.h + (ev.clientY - s0.y) / z, MB.MIN_SIZE, MB.MAX_SIZE);
        node.style.width = w + 'px'; node.style.height = h + 'px';
        this.placeSelbar();
      };
      const offEsc = escCancelDrag(() => {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        node.style.width = s0.w + 'px'; node.style.height = s0.h + 'px';
      });
      const up = async () => {
        offEsc();
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        if (moved) await this.patch(it.id, { w: Math.round(w), h: Math.round(h) });   // คลิกที่จับเฉย ๆ ไม่ต้องเขียนไฟล์
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  /** เปิดของที่การ์ดชี้ (ทางเดียวกับคลิกใน Explorer) */
  async openCard(it) {
    if (it.kind === 'ref') {
      if (it.url && /^https?:\/\//i.test(it.url)) { kapi.openExternal(it.url); return true; }
      setStatus(it.text || it.title || '');
      return false;
    }
    if (it.kind === 'chapter') {
      const { openDropped } = await import('../panel-drop.js');
      return openDropped({ kind: 'chapter', items: [{ draftDir: it.draftDir, guid: it.guid }] });
    }
    if (!it.path) return false;
    const abs = await kapi.join(this.root, ...String(it.path).split('/'));
    if (!(await kapi.exists(abs))) { setStatus(t('ui.galleryMoodboard.cardMissing')); return false; }
    if (it.kind === 'entity') { const { openEntity } = await import('../wiki-ui.js'); openEntity(abs); return true; }
    const { openScene } = await import('../app.js');
    openScene(abs, it.title || '');
    return true;
  }

  /** เพิ่มชิ้นชนิดใหม่ (โน้ต · แถบสี · กลุ่ม) กึ่งกลางที่จุด at */
  async addKind(kind, at) {
    const [w, h] = MB.KIND_SIZE[kind] || [MB.CARD_W, MB.CARD_H];
    const p = at ? MB.centeredAt(at.x, at.y, w, h) : { x: 40, y: 40 };
    let board = (await this.doc()).moodBoard;
    const opts = { ...p, w, h };
    if (kind === 'palette') opts.colors = PALETTE_DEFAULT;
    if (kind === 'note') opts.color = NOTE_COLORS[0];
    if (kind === 'group') opts.title = t('ui.galleryMoodboard.groupUntitled');
    board = MB.addCardToBoard(board, kind, opts);
    const added = board[board.length - 1];
    if (kind === 'group') board = MB.moveToBack(board, added.id);        // กรอบกลุ่มอยู่ใต้ของอื่นเสมอ
    this.sel = new Set([added.id]);
    await this.saveBoard(board);
    if (kind === 'note') setTimeout(() => { const n = this._canvas && this._canvas.querySelector(`.gal2-bitem[data-id="${added.id}"]`); if (n) this.editNote(n, added); }, 60);
    return added;
  }

  /**
   * ของที่หยิบใส่กระดาน → รูป/การ์ด · คืนจำนวนชิ้นที่วาง (ส่งออกให้เทสเรียกตรงได้)
   * [alpha.168] { center:true } = กึ่งกลางชิ้นแรกอยู่ตรงจุดที่ปล่อย (ผู้ใช้: "มันไม่วางตรง cursor")
   */
  async dropPayload(payload, at, { center = false } = {}) {
    if (!payload || !payload.items.length) return 0;
    const base = at ? { x: MB.snap(at.x), y: MB.snap(at.y) } : { x: 40, y: 40 };
    if (payload.kind === 'gallery') return this.add(payload.items.map((i) => i.path), base, { center });
    if (payload.kind === 'image') {
      // รูปจาก Explorer (ทางเต็ม) → ทางใน Images/
      const imgRoot = await kapi.join(this.root, AC.IMAGES_DIR);
      const rels = [];
      for (const it of payload.items) {
        const rel = (await kapi.relative(imgRoot, it.path)).replace(/\\/g, '/');
        if (rel && !rel.startsWith('..')) rels.push(rel);
      }
      if (!rels.length) { setStatus(t('ui.galleryMoodboard.imageOutside')); return 0; }
      return this.add(rels, base, { center });
    }
    let board = (await this.doc()).moodBoard;
    let n = 0;
    for (const it of payload.items) {
      const kind = payload.kind === 'url' ? 'ref' : payload.kind === 'book' ? 'ref' : payload.kind;
      const [w, h] = MB.KIND_SIZE[kind] || [MB.CARD_W, MB.CARD_H];
      const p0 = center ? MB.centeredAt(base.x, base.y, w, h) : base;
      const opts = { x: p0.x + n * 24, y: p0.y + n * 24, title: it.title || '' };
      // เล่ม = การ์ดชื่อเล่ม (ไม่ใส่ทางเต็มของโฟลเดอร์ลงข้อความการ์ด)
      if (kind === 'ref') { if (it.url) opts.url = it.url; else if (payload.kind !== 'book') opts.text = it.path || ''; }
      else if (kind === 'chapter') { opts.draftDir = it.draftDir; opts.guid = it.guid; }
      else {
        opts.path = (await kapi.relative(this.root, it.path)).replace(/\\/g, '/');
        if (it.cat) opts.cat = it.cat;
      }
      const key = opts.path || opts.url || opts.guid;
      const ex = MB.findCard(board, kind, key);
      if (ex) board = MB.updateBoardItem(board, ex.id, { x: opts.x, y: opts.y });   // ของเดิมซ้ำ = ย้ายการ์ดเดิม
      else board = MB.addCardToBoard(board, kind, opts);
      n++;
    }
    await this.saveBoard(board);
    setStatus(tf('ui.galleryMoodboard.cardsAdded', n));
    return n;
  }

  /** กล่องเพิ่ม/แก้การ์ดอ้างอิง (ชื่อ · ลิงก์ · ข้อความ) */
  addRefDialog(it = null, at = null) {
    return new Promise((resolve) => {
      const ov = el('div', 'k-overlay');
      const box = el('div', 'k-dialog');
      box.append(el('div', 'k-dlg-title', it ? t('ui.galleryMoodboard.refEdit') : t('ui.galleryMoodboard.refNew')));
      const mkRow = (label, val, ph, tag = 'input') => {
        const r = el('div', 'wiki-row'); r.append(el('label', null, label));
        const i = el(tag, 'wiki-input'); i.value = val || ''; i.placeholder = ph; r.append(i); box.append(r); return i;
      };
      const iT = mkRow(t('ui.galleryMoodboard.refTitle'), it && it.title, t('ui.galleryMoodboard.refTitlePh'));
      const iU = mkRow(t('ui.galleryMoodboard.refUrl'), it && it.url, t('ui.galleryMoodboard.refUrlPh'));
      const iX = mkRow(t('ui.galleryMoodboard.refText'), it && it.text, t('ui.galleryMoodboard.refTextPh'), 'textarea');
      const btns = el('div', 'k-dlg-btns');
      const c = el('button', 'k-cancel', t('ui.common.cancel'));
      const ok = el('button', 'k-ok', t('ui.common.save'));
      btns.append(c, ok); box.append(btns); ov.append(box); document.body.append(ov);
      const close = (v) => { ov.remove(); resolve(v); };
      c.onclick = () => close(null);
      ok.onclick = async () => {
        const title = iT.value.trim(), url = iU.value.trim(), text = iX.value.trim();
        if (!title && !url && !text) { iT.focus(); return; }
        const d = await this.doc();
        let board = d.moodBoard;
        if (it) board = MB.updateBoardItem(board, it.id, { title, url, text });
        else {
          const r = this._board ? this._board.getBoundingClientRect() : { width: 600, height: 400 };
          const c0 = at || MB.toBoard(this.view, r.width / 2, r.height / 2);
          const p = MB.centeredAt(c0.x, c0.y, MB.CARD_W, MB.REF_H);
          board = MB.addCardToBoard(board, 'ref', { x: p.x, y: p.y, title, url, text });
        }
        await this.saveBoard(board);
        close(true);
      };
      iT.focus();
    });
  }

  /** ส่งออกเป็นหน้า HTML ไฟล์เดียว (รูปฝังในไฟล์ — ส่งต่อ/เปิดในเบราว์เซอร์ได้ทันที) */
  async exportHtml(outPath) {
    const { exportMoodBoardHtml } = await import('./gallery-export.js');
    const d = await this.doc();
    return exportMoodBoardHtml(this.root, this.albumId, d.moodBoard, { outPath, bg: d.moodBoardBg, portraits: await this.portraits() });
  }

  /**
   * วางรูปลงกระดาน — ความสูงคิดจากสัดส่วนจริงของไฟล์ (ไม่ครอบตัด ไม่บิด)
   * [alpha.168] { center:true } = รูปแรกกึ่งกลางอยู่ที่จุด at (วางตรงเคอร์เซอร์) · รูปถัดไปเยื้องทีละ 24
   */
  async add(paths, at, { center = false } = {}) {
    const list = (paths || []).filter(Boolean);
    if (!list.length) { setStatus(t('ui.common.pickImageBefore')); return 0; }
    const d = await this.doc();
    let board = d.moodBoard;
    let i = 0;
    const base = at ? { x: MB.snap(at.x), y: MB.snap(at.y) } : { x: 40, y: 40 };
    const added = [];
    for (const p of list) {
      const nat = await naturalSize(await urlOf(this.root, p));
      const size = MB.sizeForAspect(MB.DEFAULT_SIZE, nat.w, nat.h);
      // เก็บเป็นชื่อไฟล์เปล่าเมื่ออยู่ในอัลบั้มเดียวกับกระดาน (รูปแบบเดิม) · ข้ามอัลบั้มเก็บ path เต็ม
      const rel = AC.albumRel(this.albumId);
      const file = rel && p.startsWith(rel + '/') ? p.slice(rel.length + 1) : p;
      const p0 = center ? MB.centeredAt(base.x, base.y, size.w, size.h) : base;
      board = MB.addToBoard(board, file, { x: p0.x + i * 24, y: p0.y + i * 24, w: size.w, h: size.h });
      added.push(board[board.length - 1].id);
      i++;
    }
    this.sel = new Set(added);
    await this.saveBoard(board);
    setStatus(tf('ui.galleryMoodboard.pasteImageTopBoard', list.length, AC.albumBaseName(this.albumId)));
    return list.length;
  }

  async fixRatio(it) {
    const nat = await naturalSize(await urlOf(this.root, itemPath(this.albumId, it.file)));
    const size = MB.sizeForAspect(it.w, nat.w, nat.h);
    await this.patch(it.id, { w: size.w, h: size.h });
  }

  async fixAllRatios() {
    const d = await this.doc();
    let board = MB.normalizeBoard(d.moodBoard);
    for (const it of board) {
      if (MB.isCard(it)) continue;                       // การ์ดไม่มีไฟล์รูป
      const nat = await naturalSize(await urlOf(this.root, itemPath(this.albumId, it.file)));
      const size = MB.sizeForAspect(it.w, nat.w, nat.h);
      board = MB.updateBoardItem(board, it.id, { w: size.w, h: size.h });
    }
    await this.saveBoard(board);
    setStatus(t('ui.galleryMoodboard.adjustAllItemAt'));
  }

  async tidy() {
    const d = await this.doc();
    await this.saveBoard(MB.tidyBoard(d.moodBoard));
  }

  async clear() {
    if (!(await confirmBox(t('ui.galleryMoodboard.clearBoardMoodAlbum'), t('ui.common.clear')))) return;
    this.sel.clear();
    await this.saveBoard([]);
  }

  async fit() {
    const d = await this.doc();
    const r = this._board ? this._board.getBoundingClientRect() : { width: 800, height: 600 };
    this.view = MB.fitView(d.moodBoard, r.width, r.height, 40);
    this.applyTransform();
  }

  async exportBoard(outPath) {
    const { exportMoodBoard } = await import('./gallery-export.js');
    const d = await this.doc();
    return exportMoodBoard(this.root, this.albumId, d.moodBoard, { outPath, bgCfg: d.moodBoardBg, portraits: await this.portraits() });
  }
}

let inst = null;
/** ตัววาดของแผง `gallery-board` (app.js เรียกผ่าน FEATURE_PANELS) */
export function renderMoodBoardPanel(host, root) {
  if (!host) return null;
  if (!root) { host.innerHTML = ''; host.append(el('div', 'dim', t('ui.common.openProjectBefore'))); return null; }
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
