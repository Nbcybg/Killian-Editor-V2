// moodboard-ui.js — กระดานอารมณ์เป็น "แผงของตัวเอง" (alpha.63r)
//
// ทำไมแยกออกมาจากแท็บในคลังรูป: กระดานต้องรับ **การลากรูปมาวาง** แต่ตอนเป็นแท็บ
// ตารางรูปกับกระดานอยู่คนละแท็บ → ลากจากตารางไปกระดานไม่ได้เลยแม้แต่ทางเดียว
// และพื้นที่ที่เหลือหลังหัวแผง+แถบเครื่องมือก็แคบเกินกว่าจะจัดวางอะไรได้จริง
// → ตอนนี้เป็นแผงเต็มตัว: เปิดคู่กับตาราง (ผนึกคนละฝั่ง/ลอย/เต็มจอ) แล้วลากข้ามได้ตามปกติ
//
// [alpha.167] กระดานรับ "การ์ด" ด้วย — ตัวละคร/สถานที่ (Wiki) · ฉาก · โน้ต · บท · อ้างอิง (ลิงก์/ข้อความ)
//   หยิบใส่ได้จากทุกที่ (Explorer · แถบซ้ายของแผนที่ · ลิงก์จากเบราว์เซอร์) · ส่งออก PNG/HTML จากปุ่มบนแถบ
//
// รูปบนกระดาน **ไม่ถูกครอบตัด** — `object-fit:contain` เสมอ และตอนวางครั้งแรก
// ความสูงคิดจากสัดส่วนจริงของไฟล์ (`sizeForAspect`)

import { t, tf } from '../i18n.js';
import { gi } from '../icons.js';   // [alpha.162 · W6 ข้อ 1] ไอคอนจากทะเบียน
import { ask, confirmBox, popupMenu } from '../ui.js';
import { imageLightbox } from '../wiki.js';
import { iconHtml } from '../icons.js';
import { el, setStatus, setStatusError, log, state } from '../core.js';
import { bindDropTarget } from '../drop-kit.js';
import { failText } from '../err-text.js';
import * as AC from './album-core.js';
import * as MB from './moodboard.js';
import { boardAlbum, currentAlbum, setCurrentAlbum, onAlbumChange, onBoardChange, notifyBoardChanged } from './gallery-bus.js';


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

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
    sel.title = t('ui.galleryMoodboard.boardAlbum');
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
    const more = mk(gi('more'), (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      popupMenu(r.left, r.bottom + 4, [
        { label: t('ui.galleryMoodboard.arrangeAuto'), click: () => this.tidy() },
        { label: t('ui.galleryMoodboard.adjustAllItemAt2'), click: () => this.fixAllRatios() },
        { label: t('ui.galleryMoodboard.exportBoardImage'), click: () => this.exportBoard() },
        '-',
        { label: t('ui.galleryMoodboard.clearBoardNotDel'), danger: true, click: () => this.clear() },
      ]);
    }, t('ui.galleryMoodboard.cmdAddFillBoard'));
    const refB = mk(gi('bookmark') + ' ' + t('ui.galleryMoodboard.addRef'), () => this.addRefDialog(), t('ui.galleryMoodboard.addRefTip'));
    const expB = mk(gi('download') + ' ' + t('ui.galleryMoodboard.export'), (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      popupMenu(r.left, r.bottom + 4, [
        { label: t('ui.galleryMoodboard.exportPng'), click: () => this.exportBoard() },
        { label: t('ui.galleryMoodboard.exportHtml'), click: () => this.exportHtml() },
      ]);
    }, t('ui.galleryMoodboard.exportTip'));
    bar.append(sel, mk(t('ui.common.fitScreen'), () => this.fit(), t('ui.galleryMoodboard.fitTip')), refB, expB, more);
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

    // หยิบใส่ (alpha.167): รูปจากคลังรูป = รูป · ตัวละคร/ฉาก/โน้ต/บท = การ์ด · ลิงก์จากเบราว์เซอร์ = การ์ดอ้างอิง
    // (เดิมรับเฉพาะรูปจากคลังรูป — ลากของอย่างอื่นมาแล้วเงียบ)
    bindDropTarget(board, {
      accept: ['gallery', 'image', 'entity', 'scene', 'memo', 'chapter', 'url', 'book'],
      hoverClass: 'drop',
      onDrop: async (payload, e) => {
        const r = board.getBoundingClientRect();
        const at = MB.toBoard(this.view, e.clientX - r.left, e.clientY - r.top);
        await this.dropPayload(payload, at);
      },
      onError: (err) => { log('error', 'moodboard: drop failed', err); setStatusError(failText(t('ui.galleryMoodboard.dropFail'), err)); },
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
    // [alpha.167 · บั๊ก] วาดซ้อนกันสองรอบ (วางสองชิ้นติดกัน) = ทั้งคู่ล้างผืนแล้วเติมข้าม await → ชิ้นซ้ำ
    // → ประกอบนอกจอ แล้วสลับเข้าเฉพาะรอบล่าสุด
    const seq = this._drawSeq = (this._drawSeq || 0) + 1;
    const canvas = this._canvas;
    if (!canvas) return;
    const d = await this.doc();
    if (gen !== this._gen || seq !== this._drawSeq) return;
    const board = MB.normalizeBoard(d.moodBoard);
    const frag = document.createDocumentFragment();
    if (!board.length) {
      frag.append(el('div', 'gal2-board-hint',
        t('ui.galleryMoodboard.boardEmptyOpenPanel') +
        t('ui.galleryMoodboard.pickImageLibraryDone')));
    } else {
      for (const it of MB.boardOrder(board)) {
        const node = await this.itemEl(it);
        if (gen !== this._gen || seq !== this._drawSeq) return;
        frag.append(node);
      }
    }
    canvas.replaceChildren(frag);
    this.applyTransform();
  }

  async itemEl(it) {
    if (MB.isCard(it)) return this.cardEl(it);
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

    // ลากย้าย/ปรับขนาด — ตัวเดียวกับการ์ด (รูปคงสัดส่วนเป็นค่าเริ่มต้น · Alt = ยืดอิสระ)
    this.bindMove(node, it, grip, true);

    node.ondblclick = () => imageLightbox(im.src, it.file);
    node.oncontextmenu = (e) => {
      e.preventDefault();
      popupMenu(e.clientX, e.clientY, [
        { label: '<b>' + escHtml(it.file) + '</b>', disabled: true },   // [alpha.167 · บั๊ก] ชื่อไฟล์ของผู้ใช้ลง HTML ต้อง escape (กฎข้อ 11)
        { label: t('ui.common.viewImageFull'), click: () => imageLightbox(im.src, it.file) },
        { label: t('ui.galleryMoodboard.adjustAtRatioImage'), click: () => this.fixRatio(it) },
        { label: t('ui.galleryMoodboard.top'), click: async () => this.saveBoard(MB.moveToFront((await this.doc()).moodBoard, it.id)) },
        { label: t('ui.galleryMoodboard.bottomLast'), click: async () => this.saveBoard(MB.moveToBack((await this.doc()).moodBoard, it.id)) },
        '-',
        { label: t('ui.galleryMoodboard.exitBoardNotDel'), click: async () =>
          this.saveBoard(MB.removeFromBoard((await this.doc()).moodBoard, it.id)) },
      ]);
    };
    return node;
  }

  // ═══════════ [alpha.167] การ์ด ═══════════
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
    const node = el('div', 'gal2-bitem gal2-card k-card');
    node.dataset.id = it.id;
    node.dataset.kind = it.kind;
    node.style.left = it.x + 'px'; node.style.top = it.y + 'px';
    node.style.width = it.w + 'px'; node.style.height = it.h + 'px';
    node.style.zIndex = String(100 + it.z);
    const ICON = { entity: 'user', scene: 'file', memo: 'note', chapter: 'book', ref: it.url ? 'link' : 'bookmark' };
    const av = el('span', 'k-card-av');
    let sub = '';
    if (it.kind === 'entity') {
      const info = (await this.portraits()).get(it.path);
      if (info && info.image) {
        const im = el('img'); im.draggable = false; im.alt = '';
        im.src = await kapi.toFileURL(await kapi.join(this.root, AC.IMAGES_DIR, ...String(info.image).split('/')));
        av.append(im);
      } else av.textContent = gi(ICON.entity);
      try { const { catLabel } = await import('../app.js'); sub = catLabel((info && info.cat) || it.cat || ''); } catch { sub = it.cat || ''; }
    } else {
      av.textContent = gi(ICON[it.kind] || 'bookmark');
      sub = it.kind === 'ref' ? (MB.urlHost(it.url) || t('ui.galleryMoodboard.cardRef'))
          : it.kind === 'memo' ? t('ui.galleryMoodboard.cardMemo')
          : it.kind === 'chapter' ? t('ui.galleryMoodboard.cardChapter')
          : t('ui.galleryMoodboard.cardScene');
    }
    const main = el('div', 'k-card-main');
    main.append(el('div', 'k-card-title', it.title || it.url || t('ui.common.notNamed')));
    main.append(el('div', 'k-card-sub', sub));
    if (it.text) main.append(el('div', 'gal2-card-text', it.text));
    node.append(av, main, el('span', 'gal2-bresize'));
    if (it.color) node.style.setProperty('--k-c', it.color);
    node.title = [it.title, it.url, it.text].filter(Boolean).join('\n') + '\n' + t('ui.galleryMoodboard.cardTip');
    const grip = node.querySelector('.gal2-bresize');
    this.bindMove(node, it, grip, false);
    node.ondblclick = () => this.openCard(it);
    node.oncontextmenu = (e) => {
      e.preventDefault();
      popupMenu(e.clientX, e.clientY, [
        { label: '<b>' + escHtml(it.title || it.url || '') + '</b>', disabled: true },
        { label: t('ui.galleryMoodboard.cardOpen'), click: () => this.openCard(it) },
        it.kind === 'ref' ? { label: t('ui.galleryMoodboard.cardEdit'), click: () => this.addRefDialog(it) } : null,
        { label: t('ui.galleryMoodboard.top'), click: async () => this.saveBoard(MB.moveToFront((await this.doc()).moodBoard, it.id)) },
        { label: t('ui.galleryMoodboard.bottomLast'), click: async () => this.saveBoard(MB.moveToBack((await this.doc()).moodBoard, it.id)) },
        '-',
        { label: t('ui.galleryMoodboard.cardRemove'), click: async () =>
          this.saveBoard(MB.removeFromBoard((await this.doc()).moodBoard, it.id)) },
      ].filter(Boolean));
    };
    return node;
  }

  /** ลากย้าย/ปรับขนาดชิ้น (ใช้ทั้งรูปและการ์ด) — แก้ style สด บันทึกครั้งเดียวตอนปล่อย */
  bindMove(node, it, grip, keepRatioDefault) {
    const commit = async (patch) => {
      const d = await this.doc();
      await this.saveBoard(MB.updateBoardItem(d.moodBoard, it.id, patch));
    };
    node.addEventListener('mousedown', (e) => {
      if (e.target === grip || e.button !== 0) return;
      e.stopPropagation();
      // [alpha.167] Ctrl+คลิก = กระโดดไปของที่การ์ดชี้ (ทางสากลเดียวกับตัวแก้ไข/แผนที่/เส้นเวลา)
      if ((e.ctrlKey || e.metaKey) && MB.isCard(it)) { e.preventDefault(); this.openCard(it); return; }
      const z = this.view.zoom;
      const s0 = { x: e.clientX, y: e.clientY, ox: it.x, oy: it.y };
      let moved = false;
      const mv = (ev) => {
        moved = true;
        it.x = MB.snap(s0.ox + (ev.clientX - s0.x) / z);
        it.y = MB.snap(s0.oy + (ev.clientY - s0.y) / z);
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
      const s0 = { x: e.clientX, y: e.clientY, w: it.w, h: it.h };
      const mv = (ev) => {
        const keep = keepRatioDefault ? !ev.altKey : ev.altKey;
        const r = MB.resizeItem(it, s0.w + (ev.clientX - s0.x) / z, s0.h + (ev.clientY - s0.y) / z, { keepRatio: keep });
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

  /** ของที่หยิบใส่กระดาน → รูป/การ์ด · คืนจำนวนชิ้นที่วาง (ส่งออกให้เทสเรียกตรงได้) */
  async dropPayload(payload, at) {
    if (!payload || !payload.items.length) return 0;
    const base = at ? { x: MB.snap(at.x), y: MB.snap(at.y) } : { x: 40, y: 40 };
    if (payload.kind === 'gallery') return this.add(payload.items.map((i) => i.path), base);
    if (payload.kind === 'image') {
      // รูปจาก Explorer (ทางเต็ม) → ทางใน Images/
      const imgRoot = await kapi.join(this.root, AC.IMAGES_DIR);
      const rels = [];
      for (const it of payload.items) {
        const rel = (await kapi.relative(imgRoot, it.path)).replace(/\\/g, '/');
        if (rel && !rel.startsWith('..')) rels.push(rel);
      }
      if (!rels.length) { setStatus(t('ui.galleryMoodboard.imageOutside')); return 0; }
      return this.add(rels, base);
    }
    let board = (await this.doc()).moodBoard;
    let n = 0;
    for (const it of payload.items) {
      const kind = payload.kind === 'url' ? 'ref' : payload.kind === 'book' ? 'ref' : payload.kind;
      const opts = { x: base.x + n * 24, y: base.y + n * 24, title: it.title || '' };
      if (kind === 'ref') { if (it.url) opts.url = it.url; else opts.text = it.path || ''; }
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
  addRefDialog(it = null) {
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
          const at = MB.toBoard(this.view, r.width / 2 - MB.CARD_W / 2, r.height / 2 - MB.REF_H / 2);
          board = MB.addCardToBoard(board, 'ref', { x: MB.snap(at.x), y: MB.snap(at.y), title, url, text });
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
    return exportMoodBoardHtml(this.root, this.albumId, d.moodBoard, { outPath });
  }

  /** วางรูปลงกระดาน — ความสูงคิดจากสัดส่วนจริงของไฟล์ (ไม่ครอบตัด ไม่บิด) */
  async add(paths, at) {
    const list = (paths || []).filter(Boolean);
    if (!list.length) { setStatus(t('ui.common.pickImageBefore')); return 0; }
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
    setStatus(tf('ui.galleryMoodboard.pasteImageTopBoard', list.length, AC.albumBaseName(this.albumId)));
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
    return exportMoodBoard(this.root, this.albumId, d.moodBoard, { outPath });
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
