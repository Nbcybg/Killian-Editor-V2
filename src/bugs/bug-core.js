// src/bugs/bug-core.js — [alpha.170] ตรรกะของ "รายงานบั๊ก" + "สถานะบั๊ก" (บริสุทธิ์ 100% · unit `bug-core`)
//
// ผู้ใช้: *"เพิ่มปุ่ม bug report … ที่ user สามารถดูได้ และ report ได้ · pop up ตรวจสอบสถานะ bug โดยวางเป็น list
//          bug id - รายละเอียด bug - สถานะ - พบใน version ไหน - วันที่ report - และแก้ไขใน version ไหน · มี filter"*
//
// ที่เก็บ = **GitHub Issues ของรีโปเดียวกับที่โปรแกรมอัปเดต** (ที่อยู่มาจาก update-check.js ที่เดียว)
//   · ดู: ทุกคน (ผู้ใช้และคนนอก) เปิดดูได้โดยไม่ต้องมีบัญชี — โปรแกรมอ่าน API สาธารณะ · หน้า Issues ของรีโปก็เปิดดูได้
//   · รายงาน: **จากโปรแกรมโดยตรง** (ผ่านตัวกลางของผู้ดูแล — ดูหัวข้อ "ส่งรายงานผ่านตัวกลาง" ท้ายไฟล์) หรือทางที่ผู้ดูแลกำหนด
//     คนที่ไม่ใช้โปรแกรมรายงานไม่ได้: Issue ที่คนนอกเปิดเองบนเว็บไม่ถูกนับ (`isTrustedAuthor`)
//   · ในโปรแกรมไม่มีโทเคน/คีย์ใด ๆ — โทเคนอยู่ที่ตัวกลางเท่านั้น
//
// ข้อตกลงของข้อมูล (ผู้ดูแลรีโปทำตามนี้ แล้วทุกคอลัมน์ในโปรแกรมขึ้นเอง):
//   สถานะ          = เปิด/ปิดของ Issue + ป้าย: `confirmed`/`bug` · `in progress` · `need info` · `duplicate` · `wontfix`/`invalid`
//   พบในรุ่น        = บรรทัดกำกับที่ตัวรายงานในโปรแกรมใส่ให้ (`<!-- k2-report version=… -->`) · หรือป้าย `found:alpha.169`
//   แก้ไขในรุ่น      = Milestone ของ Issue · หรือป้าย `fixed:alpha.170`
//
// ไฟล์นี้ไม่แตะเน็ต/DOM/ไฟล์ภาษา — รับข้อมูลดิบของ GitHub เข้ามา คืนแถวที่วาดได้เลย
import { BUG_CACHE_MS } from '../timing.js';
import { UPDATE_ISSUES_URL, UPDATE_ISSUES_API_URL, cmpVersion, normalizeTag } from '../update/update-check.js';

const BOM_RE = new RegExp('^' + String.fromCharCode(0xFEFF));

export const BUG_LIST_URL = UPDATE_ISSUES_URL;
/** หน้าละ 100 รายการ (เพดานของ GitHub) · อ่านไม่เกิน `BUG_MAX_PAGES` หน้า */
export const BUG_PAGE_SIZE = 100;
export const BUG_MAX_PAGES = 5;
export function bugApiUrl(page = 1) {
  const p = Math.max(1, Math.min(BUG_MAX_PAGES, parseInt(page, 10) || 1));
  return UPDATE_ISSUES_API_URL + '&page=' + p;
}
/** ลิงก์ของบั๊กหนึ่งตัว — ประกอบเองจากเลข **ไม่ใช้ลิงก์ที่ API ส่งมา** (ข้อมูลจากเน็ตห้ามพาไปเปิดที่อื่น) */
export function bugUrl(num) {
  const n = parseInt(num, 10);
  return Number.isInteger(n) && n > 0 ? BUG_LIST_URL + '/' + n : BUG_LIST_URL;
}

// ───────────────────────── สถานะ ─────────────────────────

/** ลำดับ = ลำดับในช่องกรอง + ลำดับเรียงของคอลัมน์สถานะ (ยังไม่จบมาก่อน) */
export const BUG_STATUSES = ['new', 'confirmed', 'progress', 'needinfo', 'fixed', 'wontfix', 'duplicate'];
/** ตารางคีย์เต็ม — ห้ามประกอบคีย์จากชิ้นส่วน (ตัวตรวจไฟล์ภาษามองไม่เห็น) */
export const BUG_STATUS_KEYS = {
  new: 'ui.bug.stNew',
  confirmed: 'ui.bug.stConfirmed',
  progress: 'ui.bug.stProgress',
  needinfo: 'ui.bug.stNeedInfo',
  fixed: 'ui.bug.stFixed',
  wontfix: 'ui.bug.stWontfix',
  duplicate: 'ui.bug.stDuplicate',
};
/** สถานะที่ "ยังไม่จบ" — ตัวกรอง `open` */
export const BUG_OPEN_STATUSES = ['new', 'confirmed', 'progress', 'needinfo'];
export function isOpenStatus(st) { return BUG_OPEN_STATUSES.includes(st); }

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/[\s_]+/g, '-');
function labelNames(issue) {
  const ls = (issue && Array.isArray(issue.labels)) ? issue.labels : [];
  return ls.map((l) => norm(typeof l === 'string' ? l : (l && l.name))).filter(Boolean);
}
const has = (ls, ...names) => names.some((n) => ls.includes(n));

/** สถานะของ Issue หนึ่งตัวตามข้อตกลงหัวไฟล์ */
export function statusOf(issue) {
  const ls = labelNames(issue);
  const closed = String(issue && issue.state).toLowerCase() === 'closed';
  const reason = norm(issue && issue.state_reason);
  if (has(ls, 'duplicate') || reason === 'duplicate') return 'duplicate';
  if (closed) return (reason === 'not-planned' || has(ls, 'wontfix', 'invalid', 'not-a-bug')) ? 'wontfix' : 'fixed';
  if (has(ls, 'in-progress', 'wip', 'fixing')) return 'progress';
  if (has(ls, 'need-info', 'needs-info', 'more-info', 'question')) return 'needinfo';
  if (has(ls, 'confirmed', 'bug')) return 'confirmed';
  return 'new';
}

/**
 * Issue ของใครที่นับ — เฉพาะที่ผู้ดูแลรีโปเป็นคนเปิด (ตัวกลางเปิดด้วยบัญชีผู้ดูแล · รายงานที่ได้ทางอีเมล ผู้ดูแลลงเอง)
 * ของที่คนนอกเปิดเองบนเว็บไม่ขึ้นในโปรแกรม — ผู้ใช้: *"คนที่ไม่ใช้ app จะรายงานไม่ได้"*
 */
export const TRUSTED_AUTHORS = ['OWNER', 'MEMBER', 'COLLABORATOR'];
export function isTrustedAuthor(issue) {
  return TRUSTED_AUTHORS.includes(String(issue && issue.author_association).toUpperCase());
}

/**
 * ป้ายที่ผู้ดูแลติดเพื่อ "เอาออกจากรายการในโปรแกรม" โดยไม่ต้องลบ Issue — รายงานทดสอบ · สแปมที่ยิงเข้าตัวกลาง
 * (รายงานจากตัวกลางขึ้นในโปรแกรมของทุกคนทันทีในสถานะรอตรวจสอบ — ต้องมีทางซ่อนที่เร็วกว่าการลบ)
 */
export const HIDDEN_LABELS = ['hidden', 'spam', 'test'];

/** ไม่ใช่บั๊ก: pull request · ของที่คนนอกเปิดเองบนเว็บ · ของที่ผู้ดูแลซ่อน · ข้อเสนอฟีเจอร์/เอกสารที่ไม่ได้ติดป้าย bug */
export function isBugIssue(issue) {
  if (!issue || typeof issue !== 'object' || issue.pull_request) return false;
  if (!Number.isInteger(issue.number)) return false;
  if (!isTrustedAuthor(issue)) return false;
  const ls = labelNames(issue);
  if (has(ls, ...HIDDEN_LABELS)) return false;
  if (has(ls, 'bug', 'confirmed')) return true;
  return !has(ls, 'enhancement', 'feature', 'feature-request', 'documentation');
}

// ───────────────────────── รุ่น ─────────────────────────

/** `2.0.0-alpha.169` / `v2.0.0-alpha.169` → `alpha.169` · รุ่นจริง (`2.1.0`) คงเดิม · อ่านไม่ออก = ข้อความเดิมที่ตัดแล้ว */
export function shortVersion(v) {
  const s = normalizeTag(v);
  if (!s) return '';
  const m = /^\d+(?:\.\d+){0,2}-([0-9A-Za-z.-]+)$/.exec(s);
  return m ? m[1] : s;
}
/** เติมหัวรุ่นกลับเพื่อเทียบลำดับ — `alpha.169` กับ `2.0.0-alpha.169` ต้องเรียงด้วยกันได้ */
function versionKey(v) {
  const s = normalizeTag(v);
  return /^\d/.test(s) ? s : (s ? '0.0.0-' + s : '');
}
export function cmpBugVersion(a, b) {
  const A = versionKey(shortVersion(a)), B = versionKey(shortVersion(b));
  if (!A || !B) return A ? 1 : (B ? -1 : 0);          // ว่าง = เก่าสุด
  return cmpVersion(A, B) || (A < B ? -1 : (A > B ? 1 : 0));
}

const RE_MARK = /<!--\s*k2-report\b([^>]*?)-->/i;
const RE_VER_LINE = /^[\s>*_-]*(?:app\s+)?version[*_\s]*[:：][*_\s]*([^\s*_`<]+)/im;
/** บรรทัดกำกับที่ตัวรายงานในโปรแกรมใส่ไว้ → `{version, platform, lang}` (ไม่มี = ช่องว่าง) */
export function parseReportMark(body) {
  const out = { version: '', platform: '', lang: '' };
  const m = RE_MARK.exec(String(body || ''));
  if (!m) return out;
  for (const kv of m[1].trim().split(/\s+/)) {
    const i = kv.indexOf('=');
    if (i < 1) continue;
    const k = kv.slice(0, i).toLowerCase();
    if (k in out) out[k] = kv.slice(i + 1).replace(/[^0-9A-Za-z.+_-]/g, '').slice(0, 40);
  }
  return out;
}
const labelValue = (ls, re) => { for (const l of ls) { const m = re.exec(l); if (m) return m[1]; } return ''; };

/** พบในรุ่นไหน: ป้าย `found:…` (ผู้ดูแลแก้ได้) ชนะบรรทัดกำกับ ชนะบรรทัด "Version: …" ที่คนพิมพ์เอง */
export function foundVersion(issue) {
  const ls = labelNames(issue);
  const fromLabel = labelValue(ls, /^found(?:-in)?[:=-]+v?(.+)$/);
  if (fromLabel) return shortVersion(fromLabel);
  const body = String((issue && issue.body) || '');
  const mark = parseReportMark(body).version;
  if (mark) return shortVersion(mark);
  const m = RE_VER_LINE.exec(body);
  return m ? shortVersion(m[1].slice(0, 40)) : '';
}
/** แก้ไขในรุ่นไหน: Milestone ของ Issue · ไม่มี = ป้าย `fixed:…` */
export function fixedVersion(issue) {
  const ms = issue && issue.milestone && issue.milestone.title;
  if (ms && String(ms).trim()) return shortVersion(String(ms).trim().slice(0, 40));
  return shortVersion(labelValue(labelNames(issue), /^fixed(?:-in)?[:=-]+v?(.+)$/));
}

// ───────────────────────── แถวของรายการ ─────────────────────────

/**
 * Issue ดิบ → แถวที่กล่องสถานะวาด
 * @returns {{num:number,id:string,title:string,status:string,foundIn:string,reported:string,fixedIn:string,url:string}}
 */
export function issueToBug(issue) {
  const num = issue.number;
  return {
    num,
    id: '#' + num,
    title: String(issue.title || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    status: statusOf(issue),
    foundIn: foundVersion(issue),
    reported: String(issue.created_at || ''),
    fixedIn: fixedVersion(issue),
    url: bugUrl(num),
  };
}

/**
 * คำตอบของ `kapi.httpFetch` → รายการบั๊ก
 * @returns {{ok:boolean, code?:'net'|'rate'|'http'|'parse', status?:number, detail?:string, bugs?:object[], more?:boolean}}
 *   `more` = หน้านี้เต็ม (อาจมีหน้าถัดไป)
 */
export function readIssuesResponse(res) {
  if (!res || res.netError || res.aborted || !res.status) {
    return { ok: false, code: 'net', detail: String((res && res.error) || '') };
  }
  // GitHub ตอบ 403/429 เมื่อเกินโควตาของผู้ไม่ล็อกอิน (60 ครั้ง/ชั่วโมงต่อ IP)
  if (res.status === 429 || (res.status === 403 && /rate limit/i.test(String(res.body || '')))) {
    return { ok: false, code: 'rate', status: res.status };
  }
  if (!res.ok) return { ok: false, code: 'http', status: res.status };
  let arr = null;
  try { arr = JSON.parse(String(res.body || '').replace(BOM_RE, '')); } catch { arr = null; }
  if (!Array.isArray(arr)) return { ok: false, code: 'parse', status: res.status };
  return { ok: true, bugs: arr.filter(isBugIssue).map(issueToBug), more: arr.length >= BUG_PAGE_SIZE };
}

/** รวมหลายหน้า — เลขซ้ำ (รายการขยับระหว่างอ่านสองหน้า) เก็บตัวแรก */
export function mergeBugs(...lists) {
  const seen = new Set(), out = [];
  for (const l of lists) for (const b of (l || [])) {
    if (!b || seen.has(b.num)) continue;
    seen.add(b.num); out.push(b);
  }
  return out;
}

// ───────────────────────── กรอง / เรียง ─────────────────────────

/** รุ่นที่ปรากฏในคอลัมน์หนึ่ง เรียงใหม่ → เก่า (ใช้เติมช่องกรอง) */
export function bugVersions(list, field = 'foundIn') {
  const set = new Set();
  for (const b of (list || [])) if (b && b[field]) set.add(b[field]);
  return [...set].sort((a, b) => cmpBugVersion(b, a));
}

/**
 * @param {object[]} list
 * @param {object} f
 * @param {string} [f.q] คำค้น — เลขบั๊ก (`#12`/`12`) · รายละเอียด · รุ่น (ทุกคำต้องเจอ)
 * @param {string} [f.status] `all` | `open` (ยังไม่จบ) | `closed` (จบแล้ว) | สถานะตัวใดตัวหนึ่ง
 * @param {string} [f.found] `all` | รุ่นที่พบ
 * @param {string} [f.fixed] `all` | `none` (ยังไม่ระบุรุ่นที่แก้) | รุ่นที่แก้
 */
export function filterBugs(list, f = {}) {
  const words = String(f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const st = f.status || 'all', found = f.found || 'all', fixed = f.fixed || 'all';
  return (list || []).filter((b) => {
    if (st === 'open' ? !isOpenStatus(b.status) : st === 'closed' ? isOpenStatus(b.status) : (st !== 'all' && b.status !== st)) return false;
    if (found !== 'all' && b.foundIn !== found) return false;
    if (fixed === 'none' ? !!b.fixedIn : (fixed !== 'all' && b.fixedIn !== fixed)) return false;
    if (!words.length) return true;
    const hay = (b.id + ' ' + b.num + ' ' + b.title + ' ' + b.foundIn + ' ' + b.fixedIn).toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export const BUG_SORT_KEYS = ['id', 'title', 'status', 'foundIn', 'reported', 'fixedIn'];
/**
 * เรียงตามคอลัมน์ — คืนอาร์เรย์ใหม่ (ไม่แก้ของเดิม) · ค่าเท่ากัน = เลขบั๊กใหม่ก่อน
 * @param {(a:string,b:string)=>number} [cmpTitle] ตัวเทียบข้อความตามภาษาของผู้ใช้ (ชั้น UI ส่ง `cmpText` มา)
 */
export function sortBugs(list, key = 'id', dir = 'desc', cmpTitle) {
  const sign = dir === 'asc' ? 1 : -1;
  const text = cmpTitle || ((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
  const by = {
    id: (a, b) => a.num - b.num,
    title: (a, b) => text(a.title, b.title),
    status: (a, b) => BUG_STATUSES.indexOf(a.status) - BUG_STATUSES.indexOf(b.status),
    foundIn: (a, b) => cmpBugVersion(a.foundIn, b.foundIn),
    reported: (a, b) => (a.reported < b.reported ? -1 : (a.reported > b.reported ? 1 : 0)),
    fixedIn: (a, b) => cmpBugVersion(a.fixedIn, b.fixedIn),
  }[BUG_SORT_KEYS.includes(key) ? key : 'id'];
  return [...(list || [])].sort((a, b) => (by(a, b) * sign) || (b.num - a.num));
}

/** จำนวนต่อสถานะ (ใช้เขียนตัวเลขในช่องกรอง) */
export function countByStatus(list) {
  const out = { all: 0, open: 0, closed: 0 };
  for (const s of BUG_STATUSES) out[s] = 0;
  for (const b of (list || [])) {
    out.all++;
    if (b.status in out) out[b.status]++;
    if (isOpenStatus(b.status)) out.open++; else out.closed++;
  }
  return out;
}

// ───────────────────────── เขียนรายงาน ─────────────────────────

const clean = (s, max) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const markVal = (s) => String(s == null ? '' : s).replace(/[^0-9A-Za-z.+_-]/g, '').slice(0, 40);

/** หัวข้อของ Issue (บรรทัดเดียว) */
export function reportTitle(title) { return clean(title, 200).replace(/\s+/g, ' '); }

/**
 * เนื้อรายงาน (มาร์กดาวน์) — หัวข้อย่อยมาจากไฟล์ภาษา (`labels`) · บรรทัดกำกับท้ายสุดเป็นรูปแบบตายตัวให้โปรแกรมอ่านกลับ
 * @param {object} r
 * @param {string} [r.what] เกิดอะไรขึ้น  @param {string} [r.steps] ขั้นตอนทำซ้ำ  @param {string} [r.expected] ที่ควรจะเป็น
 * @param {{version?:string, platform?:string, os?:string, lang?:string, runtime?:string}} [r.env]
 * @param {{what:string, steps:string, expected:string, env:string}} r.labels
 */
export function buildReportBody(r = {}) {
  const L = r.labels || {}, env = r.env || {};
  const parts = [];
  const sec = (head, text) => { const v = clean(text, 6000); if (v) parts.push('### ' + (head || '').trim() + '\n' + v); };
  sec(L.what, r.what);
  sec(L.steps, r.steps);
  sec(L.expected, r.expected);
  parts.push('### ' + String(L.env || '').trim() + '\n' + envLine(env));
  parts.push(reportMark(env));
  return parts.join('\n\n');
}
/** บรรทัดสภาพแวดล้อมที่คนอ่าน — ใช้คำว่า Version ตายตัว (ตัวอ่านกลับรู้จักคำนี้ทุกภาษา) */
export function envLine(env = {}) {
  const bits = ['Version: ' + (clean(env.version, 40) || '?')];
  if (env.platform) bits.push('OS: ' + clean(env.platform, 20) + (env.os ? ' (' + clean(env.os, 60) + ')' : ''));
  if (env.lang) bits.push('Language: ' + clean(env.lang, 12));
  if (env.runtime) bits.push(clean(env.runtime, 60));
  return bits.join(' · ');
}
export function reportMark(env = {}) {
  return '<!-- k2-report version=' + (markVal(env.version) || '?')
    + (env.platform ? ' platform=' + markVal(env.platform) : '')
    + (env.lang ? ' lang=' + markVal(env.lang) : '') + ' -->';
}

// ───────────────────────── ส่งรายงานผ่านตัวกลาง ─────────────────────────
//
// ผู้ใช้: *"เราจะให้รายงานได้คือ จาก app ตรง กับทางที่กำหนด ดังนั้นคนที่ไม่ใช้ app จะรายงานไม่ได้"*
// โปรแกรมส่งรายงานเข้า "ตัวกลาง" ของผู้ดูแล (tools/bug-relay — Cloudflare Worker) ซึ่งถือโทเคนลับแล้วเปิด Issue ให้
//   · ผู้ใช้ไม่ต้องมีบัญชีอะไร · ในโปรแกรมไม่มีโทเคน/คีย์ใด ๆ (รีโปเป็นสาธารณะ — ของลับฝังไม่ได้)
//   · Issue ที่ตัวกลางเปิดเป็นของบัญชีผู้ดูแล → กล่องสถานะแสดงเฉพาะ Issue ของผู้ดูแล (`TRUSTED_AUTHORS`)
//     ของที่คนนอกเปิดเองบนเว็บจึงไม่ขึ้นในโปรแกรม (และถูกปิดอัตโนมัติด้วย .github/workflows/issue-gate.yml)
// รูปของคำขอ/คำตอบต้องตรงกับ tools/bug-relay/worker.js — unit `bug-core` ส่งคำขอของฝั่งนี้เข้าตัวตรวจของฝั่งนั้นจริง

/** ชื่อที่โปรแกรมบอกตัวกลาง (หัวคำขอ `X-K2-Client`) · ทางของตัวรับ · เพดานขนาด (ตัวกลางตรวจซ้ำ) */
export const RELAY_CLIENT = 'killian2';
export const RELAY_PATH = '/report';
export const RELAY_MAX_BODY = 20000;

/** ที่อยู่ตัวกลางใช้ได้ไหม — https เท่านั้น · ไม่มีชื่อผู้ใช้/รหัสผ่านในลิงก์ */
export function isRelayUrl(u) {
  const s = String(u == null ? '' : u).trim();
  return /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?(\/[^\s?#@]*)?$/i.test(s);
}

/**
 * คำขอที่ส่งเข้าตัวกลาง — คืน null เมื่อยังไม่ได้ตั้งที่อยู่ตัวกลาง/ที่อยู่ใช้ไม่ได้/ไม่มีหัวข้อ
 * @returns {{url:string, options:{method:string, headers:object, body:string}}|null}
 */
export function buildRelayRequest({ relay = '', title = '', body = '', env = {}, now = Date.now() } = {}) {
  const ttl = reportTitle(title);
  if (!isRelayUrl(relay) || !ttl) return null;
  return {
    url: String(relay).trim().replace(/\/+$/, '') + RELAY_PATH,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-K2-Client': RELAY_CLIENT },
      body: JSON.stringify({ title: ttl, body: clean(body, RELAY_MAX_BODY), version: markVal(env.version), ts: now }),
    },
  };
}

/**
 * คำตอบของตัวกลาง → ผล
 * @returns {{ok:true, num:number}|{ok:false, code:'net'|'rate'|'clock'|'http'|'parse', status?:number}}
 */
export function readRelayResponse(res) {
  if (!res || res.netError || res.aborted || !res.status) return { ok: false, code: 'net' };
  if (res.status === 429) return { ok: false, code: 'rate', status: 429 };
  if (!res.ok) {
    // ตัวกลางบอกเหตุเป็นรหัสสั้น ๆ (`{"ok":false,"code":"ts"}`) — `ts` = เวลาของคำขอห่างจากเวลาจริงเกินที่ยอม = นาฬิกาเครื่องผู้ใช้คลาด
    let why = '';
    try { why = String((JSON.parse(String(res.body || '')) || {}).code || ''); } catch { why = ''; }
    return { ok: false, code: /^ts$/.test(why) ? 'clock' : 'http', status: res.status };
  }
  let d = null;
  try { d = JSON.parse(String(res.body || '').replace(BOM_RE, '')); } catch { d = null; }
  const num = d && d.ok === true ? parseInt(d.number, 10) : NaN;
  return Number.isInteger(num) && num > 0 ? { ok: true, num } : { ok: false, code: 'parse', status: res.status };
}

// ───────────────────────── รายงานที่เครื่องนี้เพิ่งส่ง ─────────────────────────
//
// [bug hunt] ส่งรายงานเสร็จแล้วกด "ดูสถานะบั๊ก" ทันที — คำตอบของ API สาธารณะถูกแคชฝั่ง GitHub ราวหนึ่งนาที
// (และโปรแกรมจำรายการไว้อีกห้านาที) บั๊กที่เพิ่งส่งจึงอาจยังไม่อยู่ในรายการ = ผู้ใช้เข้าใจว่าส่งไม่สำเร็จ
// → จำบั๊กที่เครื่องนี้ส่งไว้ชั่วคราว แล้วเติมเข้ารายการเมื่อรายการจาก GitHub ยังไม่มีเลขนั้น (มีแล้ว = ใช้ของ GitHub)

/** จำไว้นานเท่าไร — พ้นจากนี้ถ้ารายการจาก GitHub ยังไม่มี แปลว่าถูกลบ/ซ่อนแล้ว */
export const PENDING_MS = 60 * 60 * 1000;
export const PENDING_MAX = 20;

/** แถวชั่วคราวของบั๊กที่เพิ่งส่ง (สถานะรอตรวจสอบ) */
export function pendingBug(num, title, version, now = Date.now()) {
  const n = parseInt(num, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return { num: n, id: '#' + n, title: reportTitle(title), status: 'new', foundIn: shortVersion(markVal(version)),
           reported: new Date(now).toISOString(), fixedIn: '', url: bugUrl(n), ts: now };
}

/** รายการที่จำไว้ → ตัดของหมดอายุ/รูปเสีย · ใหม่สุดอยู่หน้า · ไม่เกิน PENDING_MAX */
export function prunePending(list, now = Date.now()) {
  const seen = new Set(), out = [];
  for (const p of (Array.isArray(list) ? list : [])) {
    if (!p || !Number.isInteger(p.num) || p.num <= 0 || seen.has(p.num)) continue;
    if (!Number.isFinite(p.ts) || now - p.ts < 0 || now - p.ts >= PENDING_MS) continue;
    seen.add(p.num);
    out.push(pendingBug(p.num, p.title, p.foundIn, p.ts));
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, PENDING_MAX);
}

/** เติมบั๊กที่เพิ่งส่งเข้ารายการจาก GitHub — เลขที่ GitHub มีแล้วใช้ของ GitHub (สถานะ/ชื่อล่าสุด) */
export function withPending(bugs, pending, now = Date.now()) {
  const have = new Set((bugs || []).map((b) => b.num));
  const extra = prunePending(pending, now).filter((p) => !have.has(p.num)).map(({ ts, ...row }) => row);
  return extra.length ? [...extra, ...(bugs || [])] : (bugs || []);
}

// ───────────────────────── ทางที่กำหนด (อีเมล) ─────────────────────────
//
// ผู้ใช้: *"ไม่เอา github ดีกว่า เพราะมันใช้ยาก เอาเป็น email ปกติ"* — ส่งจากโปรแกรมไม่ได้ = คัดลอกรายงานแล้วส่งอีเมลหาผู้ดูแล
// (ผู้ดูแลลงเป็น Issue เอง · วางรายงานทั้งก้อนลงไป บรรทัดกำกับรุ่นติดไปด้วย คอลัมน์ "พบในรุ่น" จึงขึ้นเอง)

/** ที่อยู่อีเมลรูปปกติ (ไม่มีช่องว่าง/เครื่องหมายที่ทำให้ลิงก์ mailto เพี้ยน) */
export function isEmail(s) {
  return /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(String(s == null ? '' : s).trim());
}

/**
 * ชนิดของช่องทางที่ผู้ดูแลตั้งไว้ (bug-config.js → BUG_CONTACT)
 * @returns {'email'|'link'|'text'|''} '' = ไม่มีช่องทาง (ไม่โชว์บรรทัดในกล่อง)
 */
export function contactKind(contact) {
  const label = String((contact && contact.label) || '').trim();
  if (!label) return '';
  if (isEmail(label)) return 'email';
  return /^https:\/\//i.test(String((contact && contact.url) || '')) ? 'link' : 'text';
}

/** คำนำหน้าหัวเรื่องอีเมล — ให้ผู้ดูแลกรองกล่องจดหมายได้ (เป็นชื่อโปรแกรม ไม่ใช่ข้อความของหน้าจอ) */
export const MAIL_SUBJECT_PREFIX = '[Killian 2] ';

/**
 * ลิงก์เปิดอีเมลใหม่ถึงผู้ดูแล — ใส่แค่หัวเรื่อง (เนื้อรายงานยาวเกินที่ลิงก์รับได้ → ชั้น UI คัดลอกไว้ให้วาง)
 * ลิงก์ยาวไม่เกิน `max` เสมอ (Windows เปิดลิงก์ยาวกว่า ~2,080 อักขระไม่ได้ · อักษรไทยหนึ่งตัว = เก้าอักขระ)
 * @returns {string} '' เมื่อที่อยู่ไม่ใช่อีเมล
 */
export function buildMailto(address, title = '', max = 1900) {
  const to = String(address == null ? '' : address).trim();
  if (!isEmail(to)) return '';
  const make = (tt) => 'mailto:' + to + '?subject=' + encodeURIComponent(MAIL_SUBJECT_PREFIX + tt);
  let chars = [...reportTitle(title)];
  while (chars.length && make(chars.join('')).length > max) chars = chars.slice(0, Math.max(0, chars.length - 8));
  return make(chars.join('')).replace(/%20$/, '');
}

// ───────────────────────── แคช ─────────────────────────

/** รายการยัง "สด" ไหม (อายุไม่เกิน `BUG_CACHE_MS` ของ timing.js) — สดอยู่ = เปิดกล่องซ้ำไม่ยิงเน็ต */
export function cacheFresh(cache, now = Date.now()) {
  return !!(cache && Number.isFinite(cache.ts) && Array.isArray(cache.bugs) && now - cache.ts >= 0 && now - cache.ts < BUG_CACHE_MS);
}
/** อ่านแคชจากข้อความ JSON — รูปผิด = null (ห้ามปล่อยของเสียเข้าไปวาด) */
export function parseCache(text) {
  let c = null;
  try { c = JSON.parse(String(text || '')); } catch { return null; }
  if (!c || !Number.isFinite(c.ts) || !Array.isArray(c.bugs)) return null;
  const bugs = c.bugs.filter((b) => b && Number.isInteger(b.num) && b.num > 0 && BUG_STATUSES.includes(b.status))
    .map((b) => ({ num: b.num, id: '#' + b.num, title: String(b.title || '').slice(0, 300), status: b.status,
                   foundIn: String(b.foundIn || '').slice(0, 40), reported: String(b.reported || '').slice(0, 40),
                   fixedIn: String(b.fixedIn || '').slice(0, 40), url: bugUrl(b.num) }));
  return { ts: c.ts, bugs };
}
