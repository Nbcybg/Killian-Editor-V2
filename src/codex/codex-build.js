// codex-build.js — [alpha.69] แผง "Codex": สารานุกรมของโปรเจกต์ + ส่งออกเป็นเว็บแบบ Fandom/Wikia
//
// Codex ไม่ได้สร้างข้อมูลใหม่เลย — มันคือ "อีกมุมมองหนึ่ง" ของเอนทิตี้ Wiki ที่มีอยู่แล้ว
// (`listEntities()` คืน {path,name,aliases,cat,entity} ครบ) บวกกับดัชนี backlinks
// ที่บอกว่าเอนทิตี้นี้ถูกกล่าวถึงในฉากไหนบ้าง = ส่วน "Appearances" ของวิกิเกม/นิยายทั่วไป
//
// ไฟล์นี้ **บริสุทธิ์** (ไม่แตะ DOM/kapi/state) — รับข้อมูลที่อ่านมาแล้ว คืนเป็น "ไฟล์ที่ต้องเขียน"
// `[{name, text}]` ให้ผู้เรียกเอาไปเขียนลงโฟลเดอร์เอง → เทสด้วย node ได้ทั้งชุด
//
// ผลลัพธ์เป็นเว็บสถิตล้วน (ไม่มี build step ไม่มี CDN) เปิดจากไฟล์ก็ใช้ได้ ตามหลัก "offline 100%"

import { t as tt, tf as ttf, t, tf } from '../i18n.js';
export const CODEX_VERSION = 1;

/** หมวดมาตรฐาน → ชื่อไทย (หมวดที่ผู้ใช้สร้างเองใช้ชื่อของตัวเอง) */
const CAT_TH = {
  characters: tt('ui.common.character'), locations: tt('ui.common.place'), items: tt('ui.common.thing'), lore: tt('ui.common.legend2'),
};
export const catLabel = (c, labels) => (labels && labels[c]) || CAT_TH[c] || c;

/** หนีอักขระพิเศษของ HTML — ทุกอย่างที่มาจากงานเขียนของผู้ใช้ต้องผ่านตัวนี้ก่อนเสมอ */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** ชื่อไฟล์ปลอดภัยสำหรับหน้าเว็บ (กันชนกันด้วยลำดับที่ผู้เรียกส่งมา) */
export function slug(name, seq) {
  const base = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|#%{}]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'entry';
  return seq == null ? base : `${base}-${seq}`;
}

/**
 * ตั้งชื่อไฟล์ให้ทุกเอนทิตี้แบบไม่ชนกัน (ชื่อซ้ำ = ต่อเลขท้าย)
 * ต้องทำเป็นรอบเดียวก่อนสร้างหน้า เพราะลิงก์ข้ามหน้าต้องรู้ชื่อไฟล์ของปลายทาง
 * @returns {Map<string,string>} path ของเอนทิตี้ → ชื่อไฟล์ .html
 */
export function assignPages(entities) {
  const used = new Map();
  const out = new Map();
  for (const e of entities || []) {
    const base = slug(e.name);
    const n = (used.get(base.toLowerCase()) || 0) + 1;
    used.set(base.toLowerCase(), n);
    out.set(e.path, (n === 1 ? base : `${base}-${n}`) + '.html');
  }
  return out;
}

/** ค่าที่ควรโชว์ใน infobox — ตัดค่าว่างทิ้ง (ช่องว่างเปล่าในกล่องข้อมูลดูเหมือนของพัง) */
export function infoRows(entity) {
  const f = (entity && entity.fields) || {};
  const rows = [];
  for (const k of Object.keys(f)) {
    const v = f[k];
    const text = Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v == null ? '' : v);
    if (text.trim()) rows.push([k, text]);
  }
  return rows;
}

/** ความสัมพันธ์ที่ชี้ไปเอนทิตี้อื่น → ลิงก์ได้ถ้าปลายทางอยู่ในเล่มนี้ด้วย */
export function relationRows(entity, pages) {
  const rels = (entity && entity.relations) || [];
  const out = [];
  for (const r of rels) {
    if (!r) continue;
    const target = r.target || r.to || '';
    const role = r.role || r.type || '';
    if (!target && !role) continue;
    out.push({ role, target, page: (pages && pages.get(target)) || '' , name: r.name || r.targetName || '' });
  }
  return out;
}

// ───────── หน้าเว็บ ─────────
const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--ink:#1c1e21;--dim:#65686c;--line:#dcdfe3;--accent:#2f6feb;--accent2:#eaf1ff}
@media (prefers-color-scheme:dark){:root{--bg:#17181a;--card:#1f2124;--ink:#e6e8ea;--dim:#9aa0a6;--line:#33363b;--accent:#7aa7ff;--accent2:#22293a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "Sarabun","Noto Sans Thai",system-ui,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header.top{background:var(--card);border-bottom:1px solid var(--line);padding:14px 20px;position:sticky;top:0;z-index:5;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
header.top h1{font-size:19px;margin:0}
header.top nav{display:flex;gap:12px;flex-wrap:wrap;font-size:14px}
.wrap{max-width:1080px;margin:0 auto;padding:24px 20px 64px}
.layout{display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start}
@media (max-width:820px){.layout{grid-template-columns:1fr}}
article{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:22px 26px}
article h1{margin:0 0 4px;font-size:30px}
.aka{color:var(--dim);font-size:14px;margin-bottom:14px}
.cat-pill{display:inline-block;background:var(--accent2);color:var(--accent);border-radius:999px;padding:2px 10px;font-size:12.5px;margin-bottom:14px}
.infobox{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.infobox h2{margin:0;padding:11px 14px;background:var(--accent2);color:var(--accent);font-size:15px}
.infobox img{width:100%;display:block}
.infobox table{width:100%;border-collapse:collapse;font-size:14px}
.infobox th{text-align:left;color:var(--dim);font-weight:600;width:38%;vertical-align:top;padding:7px 14px;border-top:1px solid var(--line)}
.infobox td{padding:7px 14px;border-top:1px solid var(--line)}
.sec{margin-top:26px}
.sec h2{font-size:18px;border-bottom:2px solid var(--line);padding-bottom:6px;margin:0 0 12px}
.body p{margin:0 0 12px}
ul.plain{list-style:none;padding:0;margin:0}
ul.plain li{padding:6px 0;border-bottom:1px solid var(--line)}
ul.plain li:last-child{border-bottom:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.card .n{font-weight:600;font-size:16px}
.card .d{color:var(--dim);font-size:13.5px;margin-top:4px}
.q{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;margin-bottom:18px}
footer{color:var(--dim);font-size:13px;text-align:center;padding:28px 0 0}
.empty{color:var(--dim);font-style:italic}
`;

function page(title, siteTitle, bodyHtml, opts = {}) {
  const depth = opts.home || 'index.html';
  return ttf('ui.codexBuild.newKillianCodex', esc(title), esc(siteTitle), CSS, depth, esc(siteTitle), (opts.nav || []).map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join(''), bodyHtml);
}

/** ย่อหน้าเนื้อหาแบบง่าย (ข้อความล้วน → &lt;p&gt;) — ไม่ตีความ markdown เพื่อไม่ให้ตีความผิด */
export function paragraphs(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  return t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
}

/** หนึ่งหน้าเอนทิตี้ */
export function entityPage(e, ctx) {
  const { pages, siteTitle, nav, labels, mentions } = ctx;
  const ent = e.entity || {};
  const rows = infoRows(ent);
  const rels = relationRows(ent, pages);
  const seen = (mentions && mentions[e.path]) || [];
  const img = ent.image || ent.portrait || (Array.isArray(ent.images) && ent.images[0]) || '';

  const info = `<aside class="infobox">
<h2>${esc(e.name)}</h2>
${img ? `<img src="${esc(img)}" alt="${esc(e.name)}">` : ''}
${rows.length ? `<table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
</aside>`;

  const relSec = rels.length ? ttf('ui.codexBuild.relation', rels.map((r) => {
      const label = esc(r.name || r.target.split(/[\\/]/).pop().replace(/\.json$/i, ''));
      const link = r.page ? `<a href="${esc(r.page)}">${label}</a>` : label;
      return `<li>${esc(r.role || tt('ui.codexBuild.item'))} — ${link}</li>`;
    }).join('')) : '';

  const seenSec = seen.length ? ttf('ui.codexBuild.appearScene', seen.map((s) => `<li>${esc(s)}</li>`).join('')) : '';

  const bodyText = ent.body || ent.description || ent.desc || '';
  const main = `<article>
<span class="cat-pill">${esc(catLabel(e.cat, labels))}</span>
<h1>${esc(e.name)}</h1>
${(e.aliases || []).length ? ttf('ui.codexBuild.knownName', esc((e.aliases || []).join(' · '))) : ''}
<div class="body">${paragraphs(bodyText) || tt('ui.codexBuild.notHasDesc')}</div>
${relSec}${seenSec}
</article>`;

  return page(e.name, siteTitle, `<div class="layout">${main}${info}</div>`, { nav });
}

/** หน้าแรก — ค้นหาได้จริงด้วย JS ไม่กี่บรรทัด (ไม่มีไลบรารีภายนอก) */
export function indexPage(entities, ctx) {
  const { pages, siteTitle, nav, labels } = ctx;
  const cards = entities.map((e) => `<a class="card" href="${esc(pages.get(e.path))}" data-n="${
    esc((e.name + ' ' + (e.aliases || []).join(' ') + ' ' + catLabel(e.cat, labels)).toLowerCase())}">
<div class="n">${esc(e.name)}</div><div class="d">${esc(catLabel(e.cat, labels))}</div></a>`).join('\n');
  const body = ttf('ui.codexBuild.varQDocumentGetElementById', entities.length, cards);
  return page(tt('ui.common.pageFirst'), siteTitle, body, { nav });
}

/** หน้าหมวด */
export function categoryPage(cat, entities, ctx) {
  const { pages, siteTitle, nav, labels } = ctx;
  const label = catLabel(cat, labels);
  const list = entities.length
    ? `<div class="grid">${entities.map((e) => `<a class="card" href="${esc(pages.get(e.path))}">
<div class="n">${esc(e.name)}</div><div class="d">${esc((e.aliases || []).join(' · '))}</div></a>`).join('')}</div>`
    : tt('ui.codexBuild.notHasListCat');
  return page(label, siteTitle, ttf('ui.codexBuild.list', esc(label), entities.length, list), { nav });
}

/**
 * สร้างเว็บทั้งชุด
 * @param {Array} entities  ผลจาก listEntities()
 * @param {object} opts     {siteTitle, labels, mentions:{[path]:[ชื่อฉาก]}}
 * @returns {Array<{name:string,text:string}>} ไฟล์ที่ต้องเขียน (ผู้เรียกเขียนลงโฟลเดอร์เอง)
 */
export function buildCodexSite(entities, opts = {}) {
  const list = (entities || []).filter((e) => e && e.name)
    .slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'th'));
  const pages = assignPages(list);
  const cats = [...new Set(list.map((e) => e.cat))];
  const labels = opts.labels || {};
  const nav = [{ href: 'index.html', label: tt('ui.common.pageFirst') },
               ...cats.map((c) => ({ href: 'cat-' + slug(c) + '.html', label: catLabel(c, labels) }))];
  const ctx = { pages, siteTitle: opts.siteTitle || 'Codex', nav, labels, mentions: opts.mentions || {} };

  const files = [{ name: 'index.html', text: indexPage(list, ctx) }];
  for (const c of cats) {
    files.push({ name: 'cat-' + slug(c) + '.html',
                 text: categoryPage(c, list.filter((e) => e.cat === c), ctx) });
  }
  for (const e of list) files.push({ name: pages.get(e.path), text: entityPage(e, ctx) });
  return files;
}

/** สรุปสำหรับแถบหัวแผง */
export function codexStats(entities) {
  const list = (entities || []).filter((e) => e && e.name);
  const byCat = {};
  for (const e of list) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
  return { total: list.length, cats: Object.keys(byCat).length, byCat };
}
