// docs-view.js — [alpha.170] คู่มือผู้ใช้ + คู่มือส่วนขยาย "ในโปรแกรม" (บริสุทธิ์ 100% · unit `docs-view`)
//
// ผู้ใช้: *"เราทำ คู่มือ และ Extension guide แล้ว check ว่าถูกใส่และเรียกใช้ใน app กับ readme มั้ย default เป็นภาษาอังกฤษนะ"*
// ของเดิม: docs/manual + docs/extension มีลิงก์ใน README แต่ไม่ถูกแพ็กไปกับตัวโปรแกรม และไม่มีทางเปิดจากในโปรแกรมเลย
//
// ที่นี่มีแค่ตรรกะ: เล่มไหนอยู่ที่ไหน · ภาษาไหน (ตั้งต้น = อังกฤษ) · ลิงก์ในหน้าชี้ไปไหน · สารบัญ · สมอของหัวข้อ ·
// แตกตัวอักษรในบรรทัด (ต่อยอด `inlineParts` ของ changelog-view ด้วยลิงก์/รูป) — ตัววาดอยู่ที่ docs-ui.js
//
// ★ ไฟล์คู่มือเป็นมาร์กดาวน์แบบ GitHub ไม่ใช่ไวยากรณ์ของไฟล์งาน → ใช้ตัวอ่านของ changelog-view (ไม่ใช่ md.js)
// ★ ไม่ import อะไรนอกจากโมดูลบริสุทธิ์ด้วยกัน — ที่อยู่ของรีโปรับเข้ามาเป็นพารามิเตอร์ (กฎถาวร alpha.135)
import { changelogBlocks, inlineParts } from './changelog-view.js';

/** รากของคู่มือ — ทางสัมพัทธ์จากรากของตัวโปรแกรม (ต้องอยู่ใน package.json → build.files · unit ตรวจ) */
export const DOCS_ROOT = 'docs';
/** เล่มที่เปิดในโปรแกรมได้ · `titleKey` = คีย์ภาษาของชื่อเล่ม (ตารางคีย์เต็ม) */
export const DOC_BOOKS = {
  manual: { dir: 'docs/manual', titleKey: 'ui.docs.bookManual' },
  extension: { dir: 'docs/extension', titleKey: 'ui.docs.bookExtension' },
};
/** ภาษาที่คู่มือมี — ตัวแรก = ภาษาตั้งต้น (ผู้ใช้: "default เป็นภาษาอังกฤษ") · ชื่อภาษาเป็นชื่อเฉพาะ ไม่ผ่านไฟล์ภาษา */
export const DOC_LANGS = ['en', 'th'];
/* i18n-skip: ชื่อของภาษาในภาษาของตัวเอง (ชื่อเฉพาะ — เหมือน meta.nativeName ของไฟล์ภาษา) */
export const DOC_LANG_NAMES = { en: 'English', th: 'ภาษาไทย' };
/* /i18n-skip */

/**
 * ภาษาของคู่มือที่จะเปิด: ผู้ใช้เลือกไว้ = ตามนั้น · หน้าจอเป็นภาษาที่คู่มือมี = ภาษานั้น · นอกนั้น = อังกฤษ
 * @param {string} uiLang รหัสภาษาของหน้าจอ  @param {string} [picked] ภาษาที่ผู้ใช้เลือกในตัวอ่านครั้งก่อน
 */
export function docLang(uiLang, picked) {
  const p = String(picked || '').toLowerCase();
  if (DOC_LANGS.includes(p)) return p;
  const u = String(uiLang || '').toLowerCase().split(/[-_]/)[0];
  return DOC_LANGS.includes(u) ? u : DOC_LANGS[0];
}

/** หน้าแรกของเล่มในภาษาหนึ่ง */
export function docHome(book, lang) {
  const b = DOC_BOOKS[book] || DOC_BOOKS.manual;
  return b.dir + '/' + docLang('', lang) + '/README.md';
}

/**
 * ไฟล์ของคู่มือที่ตัวแพ็ก (electron-builder) **ตัดทิ้งเสมอ** ตามนามสกุล (`*.d.ts` อยู่ในรายการตัดตายตัวของมัน — ตั้งค่าให้รวมไม่ได้)
 * → build.js ก๊อปเป็นสำเนาใน renderer/ (ชื่อที่ไม่ถูกตัด) แล้วตัวอ่านลองสำเนาเมื่ออ่านไฟล์จริงไม่ได้ (= กำลังรันจากตัวแพ็ก)
 * unit `docs-view` ตรวจ: สำเนาตรงกับต้นฉบับ · ไม่มีไฟล์อื่นในคู่มือที่จะถูกตัดโดยไม่มีสำเนา · รายการตรงกับของ build.js
 */
export const DOC_PACKED_COPIES = { 'docs/extension/k2.d.ts': 'renderer/docs-copy/k2.d.ts.txt' };
/** ทางที่ตัวอ่านลองตามลำดับ: ไฟล์จริงก่อน แล้วสำเนาที่มากับตัวแพ็ก */
export function docReadPaths(path) {
  const p = normPath(path) || '';
  return DOC_PACKED_COPIES[p] ? [p, DOC_PACKED_COPIES[p]] : [p];
}

/** ยุบ `.` / `..` ของทาง — หลุดเหนือรากของตัวโปรแกรม = null */
export function normPath(p) {
  const out = [];
  for (const seg of String(p || '').replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { if (!out.length) return null; out.pop(); continue; }
    out.push(seg);
  }
  return out.join('/');
}

/** ทางนี้อยู่ในเล่มไหน ภาษาอะไร — ไม่อยู่ในคู่มือ = null · ไฟล์ที่ใช้ร่วมสองภาษา (k2.d.ts · examples/) = lang '' */
export function docInfo(path) {
  const p = normPath(path);
  if (!p) return null;
  for (const book of Object.keys(DOC_BOOKS)) {
    const dir = DOC_BOOKS[book].dir + '/';
    if (!p.startsWith(dir)) continue;
    const rest = p.slice(dir.length);
    const first = rest.split('/')[0];
    const lang = DOC_LANGS.includes(first) && rest.includes('/') ? first : '';
    return { book, lang, file: lang ? rest.slice(lang.length + 1) : rest };
  }
  return null;
}

/** หน้าเดียวกันในอีกภาษา (ชื่อไฟล์เหมือนกันทุกภาษา) — ไฟล์ที่ใช้ร่วมกัน = หน้าแรกของเล่มในภาษานั้น */
export function docInLang(path, lang) {
  const info = docInfo(path);
  if (!info) return docHome('manual', lang);
  return info.lang ? DOC_BOOKS[info.book].dir + '/' + docLang('', lang) + '/' + info.file : docHome(info.book, lang);
}

const TEXT_EXT = /\.(md|ts|js|cjs|mjs|json|txt|csv|css|html)$/i;
const IMG_EXT = /\.(webp|png|jpe?g|gif|svg)$/i;

/**
 * ลิงก์ในหน้าคู่มือชี้ไปไหน
 * @param {string} cur ทางของหน้าที่กำลังอ่าน (จากรากของตัวโปรแกรม)
 * @param {string} href ค่าในวงเล็บของลิงก์
 * @param {string} [repoUrl] หน้ารีโป — ของที่อยู่นอกคู่มือ (ไม่ได้มากับตัวโปรแกรม) เปิดที่นั่น
 * @returns {{kind:'doc', path:string, hash:string}|{kind:'file', path:string}|{kind:'hash', hash:string}
 *          |{kind:'web', url:string}|{kind:'none'}}
 *   doc = หน้ามาร์กดาวน์ในคู่มือ · file = ไฟล์ข้อความในคู่มือ (โชว์เป็นโค้ด) · web = เปิดในเบราว์เซอร์
 */
export function resolveDocLink(cur, href, repoUrl = '') {
  const raw = String(href == null ? '' : href).trim();
  if (!raw) return { kind: 'none' };
  if (/^https?:\/\//i.test(raw)) return { kind: 'web', url: raw };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return { kind: 'none' };          // mailto: · javascript: · file: — ไม่เปิดจากคู่มือ
  let hash = '', target = raw;
  const i = raw.indexOf('#');
  if (i >= 0) { hash = raw.slice(i + 1); target = raw.slice(0, i); }
  try { hash = decodeURIComponent(hash); } catch { /* ใช้ค่าดิบ */ }
  if (!target) return hash ? { kind: 'hash', hash } : { kind: 'none' };
  try { target = decodeURIComponent(target); } catch { /* ใช้ค่าดิบ */ }
  const base = String(cur || '').split('/').slice(0, -1).join('/');
  let p = normPath(target.startsWith('/') ? target : base + '/' + target);
  if (p == null) return { kind: 'none' };
  const repo = String(repoUrl || '').replace(/\/+$/, '');
  const onRepo = (view) => (/^https:\/\//i.test(repo) ? { kind: 'web', url: repo + '/' + view + '/HEAD/' + p.split('/').map(encodeURIComponent).join('/') } : { kind: 'none' });
  // ลิงก์ชี้โฟลเดอร์ (โฟลเดอร์ของปลั๊กอินตัวอย่าง) — ตัวอ่านแสดงรายการไฟล์ไม่ได้ เปิดโฟลเดอร์นั้นบนรีโป
  if (/\/$/.test(target) || !/\.[A-Za-z0-9]+$/.test(p)) return onRepo('tree');
  if (docInfo(p)) {
    if (/\.md$/i.test(p)) return { kind: 'doc', path: p, hash };
    if (TEXT_EXT.test(p)) return { kind: 'file', path: p };
    return { kind: 'none' };
  }
  // นอกคู่มือ (AGENTS.md · CHANGELOG.md · docs/plugin-dev.md …) — ไม่ได้แพ็กมา เปิดหน้าไฟล์นั้นในรีโป
  return onRepo('blob');
}

/** รูปในหน้าคู่มือ → ทางของไฟล์รูปในคู่มือ (รูปนอกคู่มือ/รูปจากเว็บ = '' ไม่โหลด) */
export function resolveDocImage(cur, src) {
  const raw = String(src == null ? '' : src).trim().split(/\s+/)[0];
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
  const base = String(cur || '').split('/').slice(0, -1).join('/');
  const p = normPath(base + '/' + raw);
  return p && docInfo(p) && IMG_EXT.test(p) ? p : '';
}

// ───────────────────────── ตัวอักษรในบรรทัด: ลิงก์ + รูป ─────────────────────────

const L_OPEN = String.fromCharCode(0xE002), L_CLOSE = String.fromCharCode(0xE003);
const RE_LINK_HOLD = new RegExp(L_OPEN + '(\\d+)' + L_CLOSE, 'g');
// รูป `![alt](src "title")` · ลิงก์ `[label](href)` (label มีวงเล็บเหลี่ยมซ้อนหนึ่งชั้นได้) · ลิงก์อัตโนมัติ `<https://…>`
const RE_LINK = /(!?)\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:\s+"[^"]*")?\)|<(https?:\/\/[^<>\s]+)>/g;

/**
 * ตัวอักษรในบรรทัด → ชิ้น — เหมือน `inlineParts` + `href` (ลิงก์) / `image` (รูป: `src` + `alt`)
 * ลิงก์/รูปในช่วงโค้ด (แบ็กทิก) ไม่ถูกตีความ · รูปแบบที่ครอบลิงก์ (`**[x](y)**`) และในป้ายลิงก์ (`` [`a`](b) ``) อยู่ครบ
 * @returns {Array<{text:string, code?:boolean, bold?:boolean, em?:boolean, strike?:boolean, href?:string, image?:boolean, src?:string, alt?:string}>}
 */
export function docInlineParts(text) {
  const src = String(text == null ? '' : text).split(L_OPEN).join('').split(L_CLOSE).join('');
  const links = [];
  // ช่วงโค้ดของบรรทัด — ลิงก์ที่ "เริ่ม" ในช่วงโค้ดไม่ถูกตีความ (ลิงก์ที่มีโค้ดอยู่ในป้ายเริ่มก่อนช่วงโค้ด จึงยังเป็นลิงก์)
  const codeAt = [];
  const reCode = /(`+)[\s\S]*?\1/g;
  let k;
  while ((k = reCode.exec(src))) codeAt.push([k.index, k.index + k[0].length]);
  const inCode = (i) => codeAt.some(([a, b]) => i >= a && i < b);
  const held = src.replace(RE_LINK, (m, bang, label, href, auto, at) => {
    if (inCode(at)) return m;
    links.push(auto ? { label: auto, href: auto } : bang ? { image: true, alt: label, src: href } : { label, href });
    return L_OPEN + (links.length - 1) + L_CLOSE;
  });
  const out = [];
  for (const part of inlineParts(held)) {
    if (part.code) { out.push(part); continue; }
    const { text: s, ...st } = part;
    let at = 0, m;
    RE_LINK_HOLD.lastIndex = 0;
    while ((m = RE_LINK_HOLD.exec(s))) {
      if (m.index > at) out.push({ ...st, text: s.slice(at, m.index) });
      const l = links[+m[1]];
      if (l.image) out.push({ image: true, src: l.src, alt: l.alt, text: l.alt || ' ' });
      else for (const lp of inlineParts(l.label)) out.push({ ...st, ...lp, href: l.href });
      at = m.index + m[0].length;
    }
    if (at < s.length) out.push({ ...st, text: s.slice(at) });
  }
  return out.filter((p) => p.image || p.text !== '');
}

/** ข้อความล้วนของบรรทัด (ไม่มีเครื่องหมาย) — ใช้ทำสมอของหัวข้อและชื่อบทในสารบัญ */
export function docPlainText(text) {
  return docInlineParts(text).map((p) => (p.image ? '' : p.text)).join('');
}

// ───────────────────────── หัวข้อ · สมอ · สารบัญ ─────────────────────────

/** สมอของหัวข้อแบบที่ GitHub สร้าง: ตัวเล็ก · ตัดเครื่องหมาย · ช่องว่าง = ขีด (อักษรไทยและสระ/วรรณยุกต์อยู่ครบ) */
export function docSlug(text) {
  return docPlainText(text).trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * เนื้อของหน้า → บล็อก (ของ changelog-view) + สมอของหัวข้อ (`id` · หัวข้อซ้ำได้ -1 -2 แบบ GitHub)
 * @returns {{title:string, blocks:object[]}} title = หัวระดับ 1 ตัวแรก (ข้อความล้วน)
 */
export function docBlocks(md) {
  const text = String(md == null ? '' : md).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const blocks = changelogBlocks(text);
  const seen = new Map();
  let title = '';
  for (const b of blocks) {
    if (b.kind !== 'h') continue;
    const base = docSlug(b.text);
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    b.id = n ? base + '-' + n : base;
    if (!title && b.level === 1) title = docPlainText(b.text);
  }
  return { title, blocks };
}

/**
 * สารบัญของเล่ม — อ่านจากหน้าแรก (README.md) ของภาษานั้น: ลิงก์ไปไฟล์ .md ในโฟลเดอร์เดียวกัน ตามลำดับที่ปรากฏ ไม่ซ้ำ
 * (ไม่มีรายชื่อบทในโค้ด — เพิ่ม/เปลี่ยนชื่อบทแล้วแก้ README ของคู่มือที่เดียว)
 * @param {string} homePath ทางของหน้าแรก  @param {string} md เนื้อของหน้าแรก
 * @returns {Array<{path:string, title:string}>} ตัวแรก = หน้าแรกเอง
 */
export function docToc(homePath, md) {
  const home = normPath(homePath) || '';
  const dir = home.split('/').slice(0, -1).join('/');
  const { title, blocks } = docBlocks(md);
  const out = [{ path: home, title }];
  const seen = new Set([home]);
  const scan = (text) => {
    for (const p of docInlineParts(text)) {
      if (!p.href) continue;
      const r = resolveDocLink(home, p.href);
      if (r.kind !== 'doc' || seen.has(r.path)) continue;
      if (r.path.split('/').slice(0, -1).join('/') !== dir) continue;      // เฉพาะบทของเล่มนี้ ภาษานี้
      seen.add(r.path);
      out.push({ path: r.path, title: '' });
    }
  };
  // ชื่อบท = ข้อความของลิงก์ตัวแรกที่ชี้ไปบทนั้น (ลิงก์เดียวกันอาจมีหลายชิ้นเมื่อป้ายมีรูปแบบ → ต่อกัน)
  const label = new Map();
  const collect = (text) => {
    const done = new Set();
    for (const p of docInlineParts(text)) {
      if (!p.href) continue;
      const r = resolveDocLink(home, p.href);
      if (r.kind !== 'doc') continue;
      if (label.has(r.path) && !done.has(r.path)) continue;
      done.add(r.path);
      label.set(r.path, (label.get(r.path) || '') + p.text);
    }
  };
  for (const b of blocks) {
    // สารบัญของคู่มืออยู่ในรายการ (`1. [ชื่อ](ไฟล์)` / `- [ชื่อ](ไฟล์)`) — ลิงก์ในตาราง/ย่อหน้าเป็นทางลัด ไม่ใช่ลำดับบท
    if (b.kind === 'li') { collect(b.text); scan(b.text); }
  }
  for (const row of out) if (!row.title) row.title = (label.get(row.path) || '').trim() || row.path.split('/').pop();
  return out;
}
