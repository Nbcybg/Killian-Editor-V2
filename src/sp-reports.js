// sp-reports.js — รายงานของบทภาพยนตร์ (ข้อ 71 · 72 · 73)
//
//   71 รายงานสถานที่   → จัดกลุ่มฉากตามสถานที่ · นับฉาก/หน้า/ตัวละครในแต่ละที่
//   72 รายงานตัวละคร   → นับบทพูดต่อคน (บรรทัด/ฉาก/หน้าแรก-หน้าสุดท้าย)
//   73 กราฟบทพูด       → สัดส่วน บรรยาย/บทพูด ต่อหน้า + ความหนาแน่นของตัวละคร
//
// บริสุทธิ์ 100% : ไม่แตะ DOM / kapi / state → ทดสอบด้วย node ได้ (test/sp-reports.test.cjs)
// รับ blocks ชุดเดียวกับ sp-format/sp-view (`{el, text, pos?, idx?}`)

import { T } from './i18n.js';
import { mergeSpFormat, paginate, wrapLines, linesPerPage, formatLines } from './sp-format.js';
import { SCENE_PREFIX, splitCharacter } from './fountain.js';

// ───────── ตัวช่วยอ่านหัวฉาก ─────────
const INT_EXT = [
  { re: /^\s*(int\.?\/ext\.?|i\/e\.?)\s*/i, kind: 'INT/EXT' },
  { re: /^\s*int\.?\s*/i,                   kind: 'INT' },
  { re: /^\s*ext\.?\s*/i,                   kind: 'EXT' },
  { re: /^\s*est\.?\s*/i,                   kind: 'EST' },
  { re: /^\s*ฉากภายใน\s*/,                  kind: 'INT' },
  { re: /^\s*ฉากภายนอก\s*/,                 kind: 'EXT' },
  { re: /^\s*ฉาก\s*/,                       kind: '' },
];

/**
 * แยกหัวฉากเป็นส่วน ๆ — "INT. ห้องนอน - กลางคืน" → {intExt:'INT', location:'ห้องนอน', time:'กลางคืน'}
 * รองรับตัวคั่นทั้ง " - " " – " และ " — " (ผู้ใช้ไทยพิมพ์ปนกันบ่อย)
 */
export function parseHeading(text) {
  const raw = String(text ?? '').trim();
  let rest = raw, intExt = '';
  for (const p of INT_EXT) {
    if (p.re.test(rest)) { intExt = p.kind; rest = rest.replace(p.re, ''); break; }
  }
  if (!intExt) {
    // เผื่อผู้ใช้เขียนคำนำหน้าเองแบบอื่น — ตัดคำนำหน้าที่รู้จักออกให้เหลือชื่อสถานที่
    for (const p of SCENE_PREFIX) {
      const pf = p.trim();
      if (rest.toUpperCase().startsWith(pf.toUpperCase())) { rest = rest.slice(pf.length); break; }
    }
  }
  const parts = rest.split(/\s+[-–—]\s+|\s+[-–—]$/);
  const location = (parts[0] || '').trim().replace(/[-–—]\s*$/, '').trim();
  const time = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';
  return { raw, intExt, location, time };
}

/** ชื่อตัวละครล้วน — ตัดส่วนเสริม (V.O.)/(cont'd) และช่องว่างเกินออก */
export function cleanCharacterName(text) {
  const { name } = splitCharacter(String(text ?? ''));
  return name.replace(/\s+/g, ' ').trim();
}

// ───────── โครงสร้างกลาง: แจกแจงฉาก ─────────
/**
 * แจกแจงบททั้งเรื่องเป็นรายฉาก พร้อมเลขหน้าที่ฉากนั้นเริ่ม
 * @param {Array} blocks
 * @param {object} opts { fmt, lines, startPage }
 * @returns {{scenes:Array, pages:object, totalPages:number}}
 */
export function sceneBreakdown(blocks, opts = {}) {
  const fmt = opts.fmt && opts.fmt.elements ? opts.fmt : mergeSpFormat(opts.fmt);
  const lines = opts.lines || formatLines(fmt);
  const startPage = Math.max(1, Math.round(+opts.startPage || 1));
  const pages = paginate(blocks, { fmt, lines });

  // แผนที่ "บล็อกที่เท่าไร → อยู่หน้าไหน" (ใช้ idx ที่ blocksFromDoc ใส่มา · fallback เป็นลำดับ)
  const pageOf = new Map();
  for (const pg of pages.pages) {
    for (const b of pg.blocks || []) {
      if (Number.isFinite(b.idx) && !pageOf.has(b.idx)) pageOf.set(b.idx, pg.index);
    }
  }
  const dlgW = (fmt.elements.dialogue || {}).width || 3.5;
  const actW = (fmt.elements.action || {}).width || 6;

  const scenes = [];
  let cur = null, curChar = '';
  let seq = 0;
  const list = (blocks || []).filter((b) => b && b.el !== 'blank');
  for (const b of list) {
    const page = (Number.isFinite(b.idx) && pageOf.get(b.idx)) || (cur ? cur.page : 1);
    if (b.el === 'scene') {
      const h = parseHeading(b.text);
      cur = {
        n: ++seq, heading: h.raw, location: h.location || T`(ไม่ระบุสถานที่)`,
        intExt: h.intExt, time: h.time,
        page: page + startPage - 1, endPage: page + startPage - 1,
        pos: Number.isFinite(b.pos) ? b.pos : null,
        characters: [], charSet: new Set(),
        actionLines: 0, dialogueLines: 0, totalLines: 0,
      };
      scenes.push(cur);
      curChar = '';
      continue;
    }
    if (!cur) {
      // เนื้อหาก่อนหัวฉากแรก — เก็บเป็น "ฉากนำ" เพื่อไม่ให้บทพูดหาย
      cur = { n: ++seq, heading: T`(ก่อนหัวฉากแรก)`, location: T`(ไม่ระบุสถานที่)`,
              intExt: '', time: '', page: page + startPage - 1, endPage: page + startPage - 1,
              pos: Number.isFinite(b.pos) ? b.pos : null,
              characters: [], charSet: new Set(),
              actionLines: 0, dialogueLines: 0, totalLines: 0 };
      scenes.push(cur);
    }
    cur.endPage = Math.max(cur.endPage, page + startPage - 1);
    if (b.el === 'character') {
      curChar = cleanCharacterName(b.text);
      if (curChar && !cur.charSet.has(curChar)) { cur.charSet.add(curChar); cur.characters.push(curChar); }
    } else if (b.el === 'dialogue') {
      const n = wrapLines(b.text, dlgW);
      cur.dialogueLines += n; cur.totalLines += n;
    } else if (b.el === 'action') {
      const n = wrapLines(b.text, actW);
      cur.actionLines += n; cur.totalLines += n;
    } else {
      cur.totalLines += wrapLines(b.text, actW);
    }
  }
  for (const s of scenes) { delete s.charSet; s.pages = Math.max(1, s.endPage - s.page + 1); }
  return { scenes, pages, totalPages: pages.count };
}

// ───────── 71. รายงานสถานที่ ─────────
/**
 * จัดกลุ่มฉากตามสถานที่
 * @param {Array} blocks
 * @param {object} opts { fmt, lines, startPage, groups }
 *        groups = { 'ชื่อกลุ่มที่ผู้ใช้ตั้ง': ['สถานที่ก', 'สถานที่ข'] } — ไม่ส่งมา = กลุ่มตามชื่อดิบ
 */
export function generateLocationReport(blocks, opts = {}) {
  const { scenes, totalPages } = sceneBreakdown(blocks, opts);
  const groups = opts.groups || null;
  const nameOf = (loc) => {
    if (!groups) return loc;
    for (const g of Object.keys(groups)) {
      const arr = groups[g] || [];
      if (arr.some((x) => String(x).trim() === loc)) return g;
    }
    return loc;
  };
  const map = new Map();
  for (const s of scenes) {
    const key = nameOf(s.location);
    if (!map.has(key)) {
      map.set(key, { location: key, sceneCount: 0, pages: 0, intExt: new Set(),
                     characters: [], charSet: new Set(), scenes: [] });
    }
    const g = map.get(key);
    g.sceneCount++;
    g.pages += s.pages;
    if (s.intExt) g.intExt.add(s.intExt);
    for (const c of s.characters) if (!g.charSet.has(c)) { g.charSet.add(c); g.characters.push(c); }
    g.scenes.push({ n: s.n, heading: s.heading, page: s.page, time: s.time,
                    characters: s.characters, pos: s.pos });
  }
  const out = [...map.values()].map((g) => ({
    location: g.location, sceneCount: g.sceneCount, pages: g.pages,
    intExt: [...g.intExt].sort(), characters: g.characters, scenes: g.scenes,
  }));
  // เรียงตามจำนวนฉากมาก→น้อย · เท่ากันเรียงตามชื่อ (ภาษาไทยด้วย localeCompare)
  out.sort((a, b) => b.sceneCount - a.sceneCount || a.location.localeCompare(b.location, 'th'));
  return { locations: out, totalScenes: scenes.length, totalPages };
}

// ───────── 72. รายงานตัวละคร ─────────
export function generateCharacterReport(blocks, opts = {}) {
  const { scenes, totalPages } = sceneBreakdown(blocks, opts);
  const fmt = opts.fmt && opts.fmt.elements ? opts.fmt : mergeSpFormat(opts.fmt);
  const dlgW = (fmt.elements.dialogue || {}).width || 3.5;
  const startPage = Math.max(1, Math.round(+opts.startPage || 1));

  // นับบทพูดจริงต้องเดินซ้ำอีกรอบ (sceneBreakdown รวมยอดต่อฉาก ไม่ได้แยกต่อคน)
  const chars = new Map();
  const pageOf = new Map();
  const pages = paginate(blocks, { fmt, lines: opts.lines || formatLines(fmt) });
  for (const pg of pages.pages) {
    for (const b of pg.blocks || []) {
      if (Number.isFinite(b.idx) && !pageOf.has(b.idx)) pageOf.set(b.idx, pg.index);
    }
  }
  let sceneNo = 0, curChar = '';
  for (const b of (blocks || []).filter((x) => x && x.el !== 'blank')) {
    if (b.el === 'scene') { sceneNo++; curChar = ''; continue; }
    if (b.el === 'character') { curChar = cleanCharacterName(b.text); continue; }
    if (b.el !== 'dialogue' || !curChar) continue;
    if (!chars.has(curChar)) {
      chars.set(curChar, { name: curChar, totalLines: 0, speeches: 0,
                           scenes: [], sceneSet: new Set(), firstPage: null, lastPage: null });
    }
    const c = chars.get(curChar);
    const page = ((Number.isFinite(b.idx) && pageOf.get(b.idx)) || 1) + startPage - 1;
    const n = wrapLines(b.text, dlgW);
    c.totalLines += n; c.speeches++;
    c.firstPage = c.firstPage === null ? page : Math.min(c.firstPage, page);
    c.lastPage = c.lastPage === null ? page : Math.max(c.lastPage, page);
    if (!c.sceneSet.has(sceneNo)) {
      c.sceneSet.add(sceneNo);
      c.scenes.push({ scene: sceneNo, page, lines: n });
    } else {
      const row = c.scenes.find((x) => x.scene === sceneNo);
      if (row) row.lines += n;
    }
  }
  const out = [...chars.values()].map((c) => ({
    name: c.name, totalLines: c.totalLines, speeches: c.speeches,
    sceneCount: c.sceneSet.size, scenes: c.scenes,
    firstPage: c.firstPage ?? 0, lastPage: c.lastPage ?? 0,
    avgLines: c.sceneSet.size ? +(c.totalLines / c.sceneSet.size).toFixed(2) : 0,
  }));
  out.sort((a, b) => b.totalLines - a.totalLines || a.name.localeCompare(b.name, 'th'));
  const totalLines = out.reduce((s, c) => s + c.totalLines, 0);
  for (const c of out) c.share = totalLines ? +(c.totalLines / totalLines * 100).toFixed(1) : 0;
  return { characters: out, totalScenes: scenes.length, totalPages, totalLines };
}

// ───────── 73. กราฟบทพูดต่อหน้า ─────────
export const CHART_KINDS = ['action', 'dialogue', 'character', 'other'];
export const CHART_LABELS = { action: T`บรรยาย`, dialogue: T`บทพูด`,
                              character: T`ชื่อตัวละคร`, other: T`อื่น ๆ` };

/** จัดชนิด element ลง 4 กลุ่มของกราฟ */
export function chartKind(el) {
  if (el === 'action') return 'action';
  if (el === 'dialogue') return 'dialogue';
  if (el === 'character') return 'character';
  return 'other';
}

export function generateDialogueChart(blocks, opts = {}) {
  const fmt = opts.fmt && opts.fmt.elements ? opts.fmt : mergeSpFormat(opts.fmt);
  const lines = opts.lines || formatLines(fmt);
  const startPage = Math.max(1, Math.round(+opts.startPage || 1));
  const pages = paginate(blocks, { fmt, lines });
  const dlgW = (fmt.elements.dialogue || {}).width || 3.5;

  const out = pages.pages.map((pg) => {
    const stats = { action: 0, dialogue: 0, character: 0, other: 0 };
    const density = new Map();
    let curChar = '';
    for (const b of pg.blocks || []) {
      const n = b.lines || 1;
      stats[chartKind(b.el)] += n;
      if (b.el === 'character') curChar = cleanCharacterName(b.text);
      else if (b.el === 'dialogue' && curChar) {
        density.set(curChar, (density.get(curChar) || 0) + wrapLines(b.text, dlgW));
      }
    }
    const total = CHART_KINDS.reduce((s, k) => s + stats[k], 0) || 1;
    const pct = {};
    for (const k of CHART_KINDS) pct[k] = +(stats[k] / total * 100).toFixed(1);
    return {
      page: pg.index + startPage - 1,
      lines: stats, total, percentages: pct,
      charDensity: [...density.entries()]
        .map(([name, n]) => ({ name, lines: n }))
        .sort((a, b) => b.lines - a.lines),
    };
  });
  const sum = { action: 0, dialogue: 0, character: 0, other: 0 };
  for (const p of out) for (const k of CHART_KINDS) sum[k] += p.lines[k];
  const grand = CHART_KINDS.reduce((s, k) => s + sum[k], 0) || 1;
  const overall = {};
  for (const k of CHART_KINDS) overall[k] = +(sum[k] / grand * 100).toFixed(1);
  return { pages: out, totals: sum, overall, totalPages: pages.count };
}

// ───────── ส่งออกเป็นข้อความ (ใช้ทั้งคัดลอกและบันทึกเป็นไฟล์) ─────────
const pad = (s, n) => { s = String(s ?? ''); return s + ' '.repeat(Math.max(0, n - s.length)); };

export function locationReportText(rep) {
  const out = [T`รายงานสถานที่ — ${rep.locations.length} สถานที่ · ${rep.totalScenes} ฉาก · ${rep.totalPages} หน้า`, ''];
  for (const L of rep.locations) {
    out.push(T`${L.location}  [${L.intExt.join('/') || '—'}]  ${L.sceneCount} ฉาก · ~${L.pages} หน้า`);
    for (const s of L.scenes) {
      out.push(T`   ฉาก ${pad(s.n, 4)} หน้า ${pad(s.page, 4)} ${s.heading}` +
               (s.characters.length ? '   [' + s.characters.join(', ') + ']' : ''));
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}

export function characterReportText(rep) {
  const out = [T`รายงานตัวละคร — ${rep.characters.length} คน · ${rep.totalLines} บรรทัดบทพูด`, '',
               T`${pad(T`ตัวละคร`, 24)}${pad(T`ฉาก`, 6)}${pad(T`บทพูด`, 8)}${pad(T`บรรทัด`, 8)}${pad(T`เฉลี่ย/ฉาก`, 12)}สัดส่วน`];
  for (const c of rep.characters) {
    out.push(`${pad(c.name, 24)}${pad(c.sceneCount, 6)}${pad(c.speeches, 8)}` +
             `${pad(c.totalLines, 8)}${pad(c.avgLines, 12)}${c.share}%`);
  }
  return out.join('\n');
}

export function dialogueChartText(rep) {
  const out = [T`กราฟบทพูด — ${rep.totalPages} หน้า`,
               T`รวมทั้งเรื่อง: บรรยาย ${rep.overall.action}% · บทพูด ${rep.overall.dialogue}% · ` +
               T`ชื่อตัวละคร ${rep.overall.character}% · อื่น ๆ ${rep.overall.other}%`, ''];
  for (const p of rep.pages) {
    const bar = '█'.repeat(Math.round(p.percentages.dialogue / 5)) +
                '░'.repeat(Math.round(p.percentages.action / 5));
    out.push(T`หน้า ${pad(p.page, 5)} ${pad(bar, 22)} บทพูด ${p.percentages.dialogue}% · บรรยาย ${p.percentages.action}%`);
  }
  return out.join('\n');
}
