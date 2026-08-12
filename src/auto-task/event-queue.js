// event-queue.js — สถาปัตยกรรมแบบเหตุการณ์ + คิวงานเบื้องหลัง (ข้อ 88)
// pure logic ล้วน (ไม่แตะ DOM/fs · io ฉีดเข้ามา) · spec: docs/88-auto-task.md
//
//   emit('entity:renamed', …) ──▶ listener (ทันที)
//                            └──▶ rule → enqueue → processQueue() → handler (เบื้องหลัง)
//                                                        └──▶ taskLog[] ใน project.khn.json

import { T } from '../i18n.js';
export const TASK_LOG_MAX = 200;                 // เก็บ log ล่าสุดเท่านี้ — ไฟล์โปรเจกต์จะได้ไม่บวม

// ───────── EventBus: ยิงเหตุการณ์แบบซิงโครนัส ─────────
export class EventBus {
  constructor({ onError } = {}) { this.map = new Map(); this.onError = onError || null; }
  /** @returns {function} unsubscribe */
  on(event, handler) {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event).add(handler);
    return () => this.off(event, handler);
  }
  once(event, handler) {
    const un = this.on(event, (...a) => { un(); handler(...a); });
    return un;
  }
  off(event, handler) {
    const s = this.map.get(event);
    if (s) { s.delete(handler); if (!s.size) this.map.delete(event); }
    return this;
  }
  listeners(event) { return [...(this.map.get(event) || [])]; }
  /** Fire listeners for `event` plus wildcard '*' listeners. */
  emit(event, payload) {
    let n = 0;
    for (const fn of this.listeners(event)) { n += this._call(fn, payload, event); }
    for (const fn of this.listeners('*')) { n += this._call(fn, payload, event); }
    return n;
  }
  _call(fn, payload, event) {
    // listener ตัวหนึ่งพังต้องไม่ลากตัวอื่นตาย (UI refresh หลายตัวผูกกับเหตุการณ์เดียวกัน)
    try { fn(payload, event); return 1; } catch (e) { if (this.onError) this.onError(e, event); return 0; }
  }
  clear() { this.map.clear(); }
}

// ───────── AutoTaskEngine: EventBus + คิวงาน + บันทึกลง project.khn.json ─────────
export class AutoTaskEngine {
  /**
   * @param {object} opts { meta, now, onLog, onError, logMax }
   *        meta = project.khn.json ที่โหลดไว้ (จะเขียน taskLog ลงตรงนี้)
   *        now  = ฟังก์ชันคืนเวลา (ฉีดเข้ามาได้ → เทสไม่พึ่งนาฬิกาจริง)
   */
  constructor({ meta = null, now = () => Date.now(), onLog = null, onError = null, logMax = TASK_LOG_MAX } = {}) {
    this.meta = meta;
    this.now = now;
    this.onLog = onLog;
    this.onError = onError;
    this.logMax = logMax;
    this.bus = new EventBus({ onError });
    this.handlers = new Map();                   // type → fn(payload, ctx)
    this.rules = [];                             // { event, type, map, opts }
    this.queue = [];
    this.running = false;
    this.timer = null;
    this._seq = 0;
    this.counters = { queued: 0, done: 0, error: 0, skipped: 0 };
  }

  // ---- เหตุการณ์ ----
  on(event, handler) { return this.bus.on(event, handler); }
  once(event, handler) { return this.bus.once(event, handler); }
  off(event, handler) { this.bus.off(event, handler); return this; }
  /** Fire an event: listeners run now, matching rules queue background work. */
  emit(event, payload = {}) {
    const called = this.bus.emit(event, payload);
    const queued = [];
    for (const r of this.rules) {
      if (r.event !== event) continue;
      const p = r.map ? r.map(payload, event) : payload;
      if (p === null || p === false) continue;   // map คืน null = ข้ามงานนี้
      queued.push(this.enqueue(r.type, p, typeof r.opts === 'function' ? r.opts(payload) : r.opts));
    }
    return { called, queued };
  }

  // ---- ทะเบียนงาน + กฎ ----
  /** @param {string} type @param {function} fn async (payload, ctx) => any */
  registerTask(type, fn) { this.handlers.set(type, fn); return this; }
  /** Bind an event to a task type. `map` transforms the payload (return null to skip). */
  rule(event, type, map = null, opts = {}) { this.rules.push({ event, type, map, opts }); return this; }

  // ---- คิว ----
  enqueue(type, payload = {}, opts = {}) {
    const key = opts.key || null;
    if (key) {                                   // งานซ้ำที่ยังไม่ได้ทำ → ทับของเดิม ไม่สะสม
      const old = this.queue.find((t) => t.key === key && t.status === 'queued');
      if (old) {
        old.payload = payload;
        old.priority = Math.max(old.priority, opts.priority || 0);
        return old;
      }
    }
    const task = {
      id: 't' + (++this._seq), type, payload, key,
      priority: opts.priority || 0, tries: 0, maxTries: opts.maxTries == null ? 2 : opts.maxTries,
      status: 'queued', queuedAt: this.now(), startedAt: 0, endedAt: 0, error: null, result: null,
    };
    this.queue.push(task);
    this.counters.queued++;
    return task;
  }
  pending() { return this.queue.filter((t) => t.status === 'queued'); }
  /** Run the queue until empty. Safe to call while already running (returns immediately). */
  async processQueue() {
    if (this.running) return { skipped: true };
    this.running = true;
    const done = [];
    try {
      let task, guard = 0;
      while ((task = this._next())) {
        await this._run(task);
        done.push(task);
        if (++guard > 5000) break;               // กันงานที่ปั่นงานใหม่ใส่ตัวเองไม่รู้จบ
      }
    } finally {
      this.running = false;
      this.queue = this.queue.filter((t) => t.status === 'queued');   // เก็บกวาดงานที่จบแล้ว
    }
    return { processed: done.length, tasks: done };
  }
  _next() {                                      // priority มากก่อน · เท่ากันเรียงตามเวลาเข้าคิว (เสถียร)
    const q = this.pending();
    if (!q.length) return null;
    return q.reduce((best, t) => (t.priority > best.priority ? t : best), q[0]);
  }
  async _run(task) {
    const fn = this.handlers.get(task.type);
    if (!fn) {                                   // ไม่มีคนทำงานชนิดนี้ → ข้าม (ไม่ใช่ error)
      task.status = 'skipped';
      this.counters.skipped++;
      this._log(task, 'skipped', T`ไม่มี handler ของงานชนิดนี้`);
      return task;
    }
    task.status = 'running';
    task.startedAt = this.now();
    for (;;) {
      task.tries++;
      try {
        task.result = await fn(task.payload, { engine: this, task });
        task.status = 'done';
        task.endedAt = this.now();
        this.counters.done++;
        this._log(task, 'done', detailOf(task.result));
        return task;
      } catch (e) {
        task.error = (e && e.message) || String(e);
        if (task.tries >= task.maxTries) {       // handler พังต้องไม่ทำให้คิวทั้งชุดตาย
          task.status = 'error';
          task.endedAt = this.now();
          this.counters.error++;
          this._log(task, 'error', task.error);
          if (this.onError) this.onError(e, task.type);
          return task;
        }
      }
    }
  }
  /** Auto-process using an injected scheduler: schedule(fn) → handle (e.g. setInterval). */
  start(schedule) {
    if (this.timer) return this.timer;
    const tick = () => { if (this.pending().length) this.processQueue(); };
    this.timer = schedule ? schedule(tick) : setInterval(tick, 800);
    return this.timer;
  }
  stop(cancel) {
    if (!this.timer) return false;
    if (cancel) cancel(this.timer); else clearInterval(this.timer);
    this.timer = null;
    return true;
  }
  clear() { this.queue = []; return this; }
  stats() { return { ...this.counters, pending: this.pending().length }; }

  // ---- taskLog[] ใน project.khn.json ----
  _log(task, status, detail) {
    const row = {
      ts: task.endedAt || this.now(), type: task.type, status,
      ms: task.endedAt && task.startedAt ? task.endedAt - task.startedAt : 0,
      detail: detail == null ? '' : String(detail).slice(0, 300),
    };
    if (this.meta) {
      if (!Array.isArray(this.meta.taskLog)) this.meta.taskLog = [];
      this.meta.taskLog.push(row);
      if (this.meta.taskLog.length > this.logMax) this.meta.taskLog.splice(0, this.meta.taskLog.length - this.logMax);
    }
    if (this.onLog) this.onLog(row);
    this.bus.emit('task:logged', row);
    return row;
  }
  taskLog() { return (this.meta && this.meta.taskLog) || []; }
}
function detailOf(result) {
  if (result == null) return '';
  if (typeof result === 'string') return result;
  if (typeof result === 'object' && result.detail) return result.detail;
  try { return JSON.stringify(result); } catch { return ''; }
}

// ───────── งานสำเร็จรูป: เปลี่ยนชื่อ → อัปเดตทุกไฟล์ ─────────
/**
 * Replace an entity name everywhere in one document: [[old]] links first, then plain text.
 * ยาวก่อนสั้น + ไม่ทับซ้อน (กติกาเดียวกับ auto-link.js) · อังกฤษเช็คขอบคำ ไทยไม่เช็ค
 */
export function replaceName(text, oldName, newName) {
  if (!text || !oldName || oldName === newName) return { text: text || '', changed: 0 };
  const src = String(text);
  const term = String(oldName);
  const ascii = /^[\x20-\x7f]+$/.test(term);
  const WORD = /[A-Za-z0-9_]/;
  let out = '';
  let i = 0, changed = 0;
  while (i < src.length) {
    // [[ชื่อเก่า]] / [[ชื่อเก่า|ข้อความ]] → เปลี่ยนเฉพาะส่วนชื่อ
    if (src.startsWith('[[', i)) {
      const close = src.indexOf(']]', i);
      if (close > 0 && close - i < 130) {
        const inner = src.slice(i + 2, close);
        const bar = inner.indexOf('|');
        const target = bar >= 0 ? inner.slice(0, bar) : inner;
        if (target.trim() === term) {
          out += '[[' + newName + (bar >= 0 ? inner.slice(bar) : '') + ']]';
          i = close + 2; changed++;
          continue;
        }
      }
    }
    if (src.startsWith(term, i)) {
      const before = i > 0 ? src[i - 1] : '';
      const after = src[i + term.length] || '';
      const okWord = !ascii || (!WORD.test(before) && !WORD.test(after));
      if (okWord) { out += newName; i += term.length; changed++; continue; }
    }
    out += src[i++];
  }
  return { text: out, changed };
}

/**
 * Build the 'rename-entity' handler.
 * payload = { entityId, oldName, newName, files:[path…] }
 * io      = { readFile, writeFile }
 */
export function renameEntityTask(io) {
  return async (payload) => {
    const { oldName, newName, files = [] } = payload || {};
    if (!oldName || !newName || oldName === newName) return { changed: 0, files: [], detail: T`ไม่มีอะไรต้องแก้` };
    const touched = [];
    let total = 0;
    for (const p of files) {
      const text = await io.readFile(p);
      if (text == null) continue;
      const r = replaceName(text, oldName, newName);
      if (!r.changed) continue;                  // เขียนเฉพาะไฟล์ที่มีของจริง — ไม่ไปแตะ mtime ไฟล์อื่น
      await io.writeFile(p, r.text);
      touched.push(p);
      total += r.changed;
    }
    return { changed: total, files: touched, detail: T`${oldName} → ${newName} (${touched.length} ไฟล์)` };
  };
}

// ───────── ชุดกฎมาตรฐาน (ผูกเหตุการณ์ ↔ งาน) ─────────
// ผู้เรียกลงทะเบียน handler ของ reindex-scene / reindex-links / save-scenes เอง
// (ต่อกับ AutoLink ข้อ 86 และ KanbanBoard ข้อ 12)
export function installDefaultRules(engine) {
  engine
    .rule('scene:saved', 'reindex-scene', (p) => p, (p) => ({ key: 'reindex-scene:' + (p && p.id), priority: 1 }))
    .rule('scene:status', 'save-scenes', (p) => p, { key: 'save-scenes', priority: 2 })
    .rule('entity:renamed', 'rename-entity', (p) => p, { priority: 1 })
    .rule('entity:renamed', 'reindex-links', () => ({ reason: 'renamed' }), { key: 'reindex-links' })
    .rule('entity:deleted', 'reindex-links', () => ({ reason: 'deleted' }), { key: 'reindex-links' })
    .rule('project:opened', 'reindex-links', () => ({ reason: 'opened' }), { key: 'reindex-links', priority: -1 });
  return engine;
}
