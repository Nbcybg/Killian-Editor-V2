// i18n-keys.cjs — ตั้งชื่อคีย์ดอตพาธให้ข้อความไทย  `ลบทางเลือก` → `ui.branch.delChoice`
//
//   namespace  ← พาธไฟล์ (ตาราง NS ข้างล่าง) · ข้อความที่ใช้ ≥2 ไฟล์ → `ui.common.*`
//   ชื่อใบ     ← ตัดคำไทยด้วยพจนานุกรมของโปรแกรม แล้วแปลงทีละคำด้วย th-en-lexicon
//
// คีย์ต้อง **เสถียร**: รันซ้ำแล้วต้องได้ชื่อเดิมเสมอ → เรียงลำดับก่อนแจกชื่อ
// และถ้ามีคีย์เดิมอยู่แล้วในไฟล์ภาษา ให้ใช้ของเดิม (ห้ามเปลี่ยนคีย์ที่แปลไปแล้ว)

const path = require('path');
const { segment } = require('./th-seg.cjs');
const { lookup } = require('./th-en-lexicon.cjs');

const THAI = /[฀-๿]/;

// ── พาธไฟล์ → namespace ─────────────────────────────────────────────
// ตัวที่ไม่อยู่ในตารางจะถอดชื่อไฟล์เอง (`sp-reports.js` → `spReports`)
const NS = {
  'src/app.js': 'app', 'src/core.js': 'core', 'src/dialogs.js': 'dlg', 'src/ui.js': 'ui',
  'main.js': 'menu', 'src/editor.js': 'editor', 'src/screenplay.js': 'sp',
  'src/branching-ui.js': 'branch', 'src/branch-graph.js': 'branch', 'src/branch-plans.js': 'branch',
  'src/maps-ui.js': 'maps', 'src/maps.js': 'maps', 'src/floorplan-ui.js': 'floorplan',
  'src/timeline-ui.js': 'timeline', 'src/timeline.js': 'timeline',
  'src/wiki.js': 'wiki', 'src/wiki-ui.js': 'wiki', 'src/wiki-images.js': 'wiki',
  'src/wiki-profile.js': 'wiki', 'src/gallery.js': 'gallery',
  'src/dashboard.js': 'dash', 'src/books.js': 'books', 'src/drafts.js': 'drafts',
  'src/scene-ops.js': 'scene', 'src/scene-props.js': 'scene', 'src/scene-table.js': 'scene',
  'src/scene-meta.js': 'scene', 'src/sceneFilter.js': 'scene', 'src/section-ops.js': 'section',
  'src/recycle.js': 'trash', 'src/compile.js': 'compile', 'src/network.js': 'net',
  'src/network-theme.js': 'net', 'src/global-search.js': 'search', 'src/search.js': 'search',
  'src/quick-open.js': 'quickOpen', 'src/home-ui.js': 'home', 'src/project.js': 'project',
  'src/project-scan.js': 'project', 'src/session-notes.js': 'notes', 'src/scratchpad.js': 'notes',
  'src/custom-status.js': 'status', 'src/tag-pane.js': 'tags', 'src/visual-tags.js': 'tags',
  'src/thesaurus.js': 'thes', 'src/text-case.js': 'textCase', 'src/typewriter.js': 'typewriter',
  'src/typewriter-sound.js': 'typewriter', 'src/focus-mode.js': 'focus',
  'src/player-mode.js': 'player', 'src/player-choices.js': 'player',
  'src/pdf-ui.js': 'pdf', 'src/pdf-generator.js': 'pdf', 'src/backup.js': 'backup',
  'src/lang-fonts.js': 'fonts', 'src/margin-presets.js': 'margin', 'src/log-core.js': 'log',
  'src/dirty-registry.js': 'dirty', 'src/roster-ui.js': 'roster', 'src/nav.js': 'nav',
  'src/centralize-ui.js': 'central', 'src/relationship-types.js': 'relation',
  'src/sensory-profile.js': 'sensory', 'src/word-history.js': 'wordHistory',
  'src/smart.js': 'smart', 'src/smart-terms.js': 'smart', 'src/template-vars.js': 'tmplVars',
  'src/prose-format.js': 'prose', 'src/prose-view.js': 'prose',
  'src/markdown-code-toggle.js': 'md', 'src/import-sp.js': 'importSp',
  'src/export-blog.js': 'exportBlog', 'src/export-zip.js': 'exportZip',
  'src/export-fdx.js': 'exportFdx', 'src/export-rtf.js': 'exportRtf',
  'src/export-watermark.js': 'watermark', 'src/page-break-plugin.js': 'pageBreak',
  'src/ai-analyzer-ui.js': 'aia', 'src/ai-settings.js': 'aiSet', 'src/ai-summary.js': 'aiSum',
  'src/ai-synopsis.js': 'aiSyn',
};
// โฟลเดอร์ย่อย → คำนำหน้า
const DIR_NS = {
  'src/ai': 'ai', 'src/planner': 'planner', 'src/panels': 'panel', 'src/layout': 'layout',
  'src/gallery': 'gallery', 'src/kanban': 'kanban', 'src/codex': 'codex',
  'src/comments': 'cmt', 'src/history': 'hist', 'src/record': 'rec', 'src/import': 'imp',
  'src/world-story': 'world', 'src/auto-task': 'autoTask', 'src/tools': 'tools',
};

function camel(parts) {
  const p = parts.filter(Boolean);
  if (!p.length) return '';
  return p[0][0].toLowerCase() + p[0].slice(1)
       + p.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

/** พาธไฟล์ → namespace (`ui.<ns>`) */
function nsOf(rel) {
  if (NS[rel]) return NS[rel];
  const dir = path.posix.dirname(rel);
  const base = path.posix.basename(rel, '.js');
  const stem = camel(base.replace(/-(ui|core|data)$/, '').split(/[-_.]/));
  if (DIR_NS[dir]) {
    const sub = stem.replace(new RegExp('^' + DIR_NS[dir], 'i'), '') || '';
    return DIR_NS[dir] + (sub ? sub[0].toUpperCase() + sub.slice(1) : '');
  }
  return stem || 'misc';
}

// ความยาวคีย์ที่ยาวที่สุดในพจนานุกรม — ใช้เป็นเพดานของ longest-match
const { LEX } = require('./th-en-lexicon.cjs');
const LEX_MAX = Object.keys(LEX).reduce((m, k) => Math.max(m, k.length), 1);

/**
 * ประโยคไทย → ชื่อใบของคีย์ (camelCase อังกฤษ) · คืน '' ถ้าแปลงไม่ได้เลย
 *
 * **จับคู่กับพจนานุกรมตรง ๆ แบบยาวสุดก่อน** ไม่ใช่ตัดคำด้วย dict ก่อนแล้วค่อยเปิดพจนานุกรม
 * เพราะ dict ของโปรแกรมตัด "คัดลอก" เป็น "คัด"+"ลอก" ซึ่งไม่มีในพจนานุกรมทั้งคู่ → ได้ชื่อว่าง
 * (ยาวสุดก่อนยังกัน "การ" ไปแย่งแมตช์ใน "การ์ด" ด้วย)
 */
function leafName(msgid, maxWords = 4) {
  const s = String(msgid)
    .replace(/\{\d+\}/g, ' ')                                  // ที่แทรกค่า
    .replace(/<[^>]*>/g, ' ')                                  // แท็ก HTML ในข้อความยาว
    .replace(/&[a-z]+;/gi, ' ');
  const out = [];
  let i = 0;
  while (i < s.length && out.length < maxWords) {
    const c = s[i];
    if (THAI.test(c)) {
      let hit = null, len = 0;
      for (let L = Math.min(LEX_MAX, s.length - i); L >= 1; L--) {
        const w = s.slice(i, i + L);
        const en = lookup(w);
        if (en !== null) { hit = en; len = L; break; }
      }
      if (hit !== null) { if (hit) out.push(hit); i += len; continue; }
      i++; continue;                                            // ไม่รู้จัก — ข้ามทีละอักษร
    }
    if (/[A-Za-z]/.test(c)) {                                   // ศัพท์อังกฤษในข้อความ (PDF/Wiki/AI)
      let j = i; while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++;
      const w = s.slice(i, j);
      if (!/^\d+$/.test(w)) out.push(w);
      i = j; continue;
    }
    i++;
  }
  let name = camel(out).slice(0, 32);
  name = name.replace(/[^A-Za-z0-9]/g, '');
  if (/^\d/.test(name)) name = 'n' + name;
  return name;
}

/**
 * แจกคีย์ให้ทุก msgid — เสถียรและไม่ชนกัน
 * @param {Array<{id:string, files:string[]}>} items
 * @param {Record<string,string>} [existing] msgid → คีย์เดิม (ห้ามเปลี่ยน)
 * @returns {Map<string,string>} msgid → คีย์เต็ม
 */
function assignKeys(items, existing = {}) {
  const out = new Map();
  const used = new Set(Object.values(existing));
  // เรียงตาม msgid ก่อนเสมอ → รันกี่ครั้งก็ได้ลำดับเดิม เลขต่อท้ายจึงไม่สลับ
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const it of sorted) {
    if (existing[it.id]) { out.set(it.id, existing[it.id]); continue; }
    const ns = it.files.length > 1 ? 'common' : nsOf(it.files[0]);
    let leaf = leafName(it.id) || 'msg';
    let full = 'ui.' + ns + '.' + leaf;
    if (used.has(full)) {
      let n = 2;
      while (used.has('ui.' + ns + '.' + leaf + n)) n++;
      full = 'ui.' + ns + '.' + leaf + n;
    }
    used.add(full);
    out.set(it.id, full);
  }
  return out;
}

module.exports = { nsOf, leafName, assignKeys, NS, DIR_NS };
