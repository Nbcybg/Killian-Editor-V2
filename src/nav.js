// src/nav.js — Navigation (แทน Outline/Index เดิม)
// ดึงโครงเรื่องจาก "เนื้อหาฉาก" (.md/บทหนัง) เป็นรายการหัวข้อ/ย่อหน้า/หัวฉาก แบบ Final Draft
// ไม่พึ่ง ProseMirror → parse markdown/fountain ตรง ๆ จึง unit-test ด้วย node ได้
//
// กติกาสถานะฉากในโปรเจกต์นี้: เก็บเป็นคำไทย ('โครงร่าง'/'กำลังเขียน'/'เขียนเสร็จ'/'ตรวจแล้ว')
// ค่าว่าง = 'Outline' (ยังไม่ตั้ง) — statusLabel() แปลงให้เป็น '' เพื่อไม่โชว์

import { T } from './i18n.js';
export function statusLabel(status) {
  return (status && status !== 'Outline') ? status : '';
}

const truncate = (s, n = 42) => {
  s = String(s).trim().replace(/\s+/g, ' ');
  return s.length > n ? s.slice(0, n) + '…' : s;
};

// ---- โหมดนิยาย (markdown): หัวข้อ # ## ### + ย่อหน้า (beat) ----
export function parseProse(body) {
  const out = [];
  const lines = (body || '').split(/\r?\n/);
  let start = -1, buf = '';
  const flush = () => {
    if (buf.trim()) out.push({ kind: 'beat', level: 4, label: truncate(buf), line: start });
    buf = ''; start = -1;
  };
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { flush(); out.push({ kind: 'heading', level: h[1].length, label: h[2].trim(), line: i }); return; }
    if (!line.trim()) { flush(); return; }
    if (/^!\[.*\]\(.*\)\s*$/.test(line)) { flush(); return; }   // บรรทัดรูป ไม่นับเป็น beat
    if (/^>\s?/.test(line)) { flush(); out.push({ kind: 'quote', level: 4, label: truncate(line.replace(/^>\s?/, '')), line: i }); return; }
    if (start < 0) start = i;
    buf += (buf ? ' ' : '') + line;
  });
  flush();
  return out;
}

// ---- โหมดบทหนัง (fountain): หัวฉาก/ตัวละคร/ทรานซิชัน/โครง ----
export function parseScreenplay(body) {
  const out = [];
  const lines = (body || '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim(); if (!line) return; let m;
    if ((m = /^###\s+(.*)$/.exec(line))) { out.push({ kind: 'outline', level: 3, label: m[1].trim(), line: i }); return; }
    if ((m = /^##\s+(.*)$/.exec(line)))  { out.push({ kind: 'outline', level: 2, label: m[1].trim(), line: i }); return; }
    if ((m = /^#\s+(.*)$/.exec(line)))   { out.push({ kind: 'outline', level: 1, label: m[1].trim(), line: i }); return; }
    if ((m = /^=\s+(.*)$/.exec(line)))   { out.push({ kind: 'summary', level: 4, label: truncate(m[1].trim()), line: i }); return; }
    if ((m = /^\.(?!\.)(.+)/.exec(line))) { out.push({ kind: 'sceneHeading', level: 2, label: m[1].trim(), line: i }); return; }
    if (/^(int\.?|ext\.?|est\.?|i\/e|ฉาก)[\s.:]/i.test(line)) { out.push({ kind: 'sceneHeading', level: 2, label: line, line: i }); return; }
    if ((m = /^@(.+)/.exec(line)))       { out.push({ kind: 'character', level: 3, label: m[1].trim(), line: i }); return; }
    if ((m = /^>(.+)/.exec(line)))       { out.push({ kind: 'transition', level: 3, label: m[1].trim(), line: i }); return; }
    if ((m = /^\$(act|seq|endact)\b\s*(.*)$/i.exec(line))) { out.push({ kind: m[1].toLowerCase(), level: 1, label: m[2].trim() || m[1], line: i }); return; }
  });
  return out;
}

// scenes = [{ id, title, status, color|colorTag, wordCount, flag, format, body }]
// opts = { mode:'auto'|'prose'|'screenplay', showBeats:true }
export function buildNavigation(scenes, opts = {}) {
  const mode = opts.mode || 'auto';
  const showBeats = opts.showBeats !== false;
  const nodes = [];
  (scenes || []).forEach((sc) => {
    nodes.push({
      kind: 'scene', level: 0, id: sc.id, sceneId: sc.id,
      label: sc.title || T`(ไม่มีชื่อ)`,
      status: statusLabel(sc.status), color: sc.color || sc.colorTag || '',
      wordCount: sc.wordCount || 0, flag: !!sc.flag,
    });
    const fmt = mode === 'auto' ? (sc.format === 'screenplay' ? 'screenplay' : 'prose') : mode;
    let kids = fmt === 'screenplay' ? parseScreenplay(sc.body) : parseProse(sc.body);
    if (fmt !== 'screenplay' && !showBeats) kids = kids.filter((k) => k.kind === 'heading');
    kids.forEach((k) => nodes.push(Object.assign({ id: sc.id, sceneId: sc.id }, k)));
  });
  return nodes;
}
