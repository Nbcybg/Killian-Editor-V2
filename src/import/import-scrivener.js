// import-scrivener.js — นำเข้าโปรเจกต์จาก Scrivener (.scriv) (ข้อ 63)
// pure parser (XML + RTF) + ตัวเขียนไฟล์ผ่าน io adapter → เทสด้วย mock fs ได้ทั้งหมด
// spec: docs/63-import-scrivener.md
//
// โครง .scriv (โฟลเดอร์):
//   <ชื่อ>.scriv/
//     <ชื่อ>.scrivx            ← XML: ต้นไม้ binder (โฟลเดอร์/เอกสาร)
//     Files/Data/<UUID>/content.rtf     ← Scrivener 3
//     Files/Docs/<id>.rtf               ← Scrivener 2

// ────────────────────────────────────────────────────────────────
// 1) XML เล็ก ๆ พอสำหรับ .scrivx (ไม่มี DOMParser ใน node → เขียนเอง)
// ────────────────────────────────────────────────────────────────
import { T } from '../i18n.js';
/**
 * Minimal XML → tree. Good enough for .scrivx (no namespaces, no CDATA nesting).
 * @returns {{tag, attrs, children, text}}
 */
export function parseXml(xml) {
  const src = String(xml || '').replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const root = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<\s*(\/)?\s*([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/)?\s*>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const [, close, tag, attrStr, selfClose, textRun] = m;
    const top = stack[stack.length - 1];
    if (textRun != null) { top.text += decodeEntities(textRun); continue; }
    if (close) { if (stack.length > 1 && stack[stack.length - 1].tag === tag) stack.pop(); continue; }
    const node = { tag, attrs: parseAttrs(attrStr), children: [], text: '' };
    top.children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}
function parseAttrs(s) {
  const out = {};
  for (const m of String(s || '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1]] = decodeEntities(m[2] != null ? m[2] : m[3]);
  }
  return out;
}
function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-f]+|\w+);/gi, (all, e) => {
    if (e[0] === '#') return String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()] ?? all;
  });
}
export function findAll(node, tag, out = []) {
  for (const c of node.children || []) { if (c.tag === tag) out.push(c); findAll(c, tag, out); }
  return out;
}
function firstChild(node, tag) { return (node.children || []).find((c) => c.tag === tag) || null; }

// ────────────────────────────────────────────────────────────────
// 2) RTF → ข้อความ (ต้องรองรับ \uNNNN เพราะภาษาไทยใน RTF เป็น escape ทั้งหมด)
// ────────────────────────────────────────────────────────────────
const SKIP_GROUPS = /^(fonttbl|colortbl|stylesheet|info|pict|\*|listtable|listoverridetable|rsidtbl|generator|xmlnstbl)/;
export function rtfToText(rtf) {
  const src = String(rtf || '');
  let out = '';
  let i = 0;
  let skipDepth = 0;      // ความลึกของกลุ่มที่ต้องข้าม (ตาราง font/สี/รูป)
  let depth = 0;
  let ucSkip = 1;         // จำนวนไบต์สำรองหลัง \uN ที่ต้องข้าม (\ucN)
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; if (skipDepth && depth < skipDepth) skipDepth = 0; i++; continue; }
    if (ch === '\\') {
      const ctrl = /^\\([a-zA-Z]+)(-?\d+)?[ ]?/.exec(src.slice(i));
      if (ctrl) {
        const word = ctrl[1], arg = ctrl[2] ? parseInt(ctrl[2], 10) : null;
        i += ctrl[0].length;
        if (word === 'u' && arg != null) {                       // ตัวอักษร unicode (ไทย)
          if (!skipDepth) out += String.fromCharCode(arg < 0 ? arg + 65536 : arg);
          let skipped = 0;                                        // ข้ามตัวสำรอง ANSI ที่ตามมา
          while (skipped < ucSkip && i < src.length) {
            if (src[i] === '\\' && src[i + 1] === "'") { i += 4; skipped++; continue; }
            if (src[i] === '{' || src[i] === '}' || src[i] === '\\') break;
            i++; skipped++;
          }
          continue;
        }
        if (word === 'uc') { ucSkip = arg == null ? 1 : arg; continue; }
        if (word === 'par' || word === 'line') { if (!skipDepth) out += '\n'; continue; }
        if (word === 'tab') { if (!skipDepth) out += '\t'; continue; }
        if (SKIP_GROUPS.test(word) && !skipDepth) { skipDepth = depth; continue; }
        continue;                                                 // control word อื่น ๆ = จัดรูปแบบ → ทิ้ง
      }
      const esc = src[i + 1];
      if (esc === "'") {                                          // \'xx = ไบต์ ANSI (ภาษาอังกฤษ)
        const hex = src.slice(i + 2, i + 4);
        if (!skipDepth) { const code = parseInt(hex, 16); if (code >= 32) out += String.fromCharCode(code); }
        i += 4; continue;
      }
      if (esc === '*') { skipDepth = depth; i += 2; continue; }   // {\*\...} = กลุ่มที่ข้ามได้
      if (!skipDepth && (esc === '\\' || esc === '{' || esc === '}')) out += esc;
      i += 2; continue;
    }
    if (!skipDepth) out += ch;
    i++;
  }
  return out.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ────────────────────────────────────────────────────────────────
// 3) binder → โครง Killian
// ────────────────────────────────────────────────────────────────
export const SCRIV_TEXT = new Set(['Text', 'Document']);       // ชนิดที่ถือว่าเป็น "ฉาก"
export const SCRIV_FOLDER = new Set(['Folder', 'DraftFolder']);

/** Parse a .scrivx into a binder tree: [{ id, type, title, children }] */
export function parseBinder(xml) {
  const doc = parseXml(xml);
  const binder = findAll(doc, 'Binder')[0] || doc;
  const walk = (node) => (node.children || []).filter((c) => c.tag === 'BinderItem').map((item) => {
    const titleNode = firstChild(item, 'Title');
    const kids = firstChild(item, 'Children');
    const meta = firstChild(item, 'MetaData');
    const inc = meta ? firstChild(meta, 'IncludeInCompile') : null;
    return {
      id: item.attrs.UUID || item.attrs.ID || '',
      type: item.attrs.Type || 'Text',
      title: (titleNode ? titleNode.text : '').trim(),
      include: inc ? !/^no$/i.test(inc.text.trim()) : true,     // ติ๊ก "Include in Compile" ไว้ไหม
      children: kids ? walk(kids) : [],
    };
  });
  return walk(binder);
}

/**
 * Map a binder tree onto Killian's structure.
 * โฟลเดอร์ → บท · เอกสาร → ฉาก · เอกสารที่อยู่นอกโฟลเดอร์ → บท "(ไม่มีบท)"
 * @returns {{ sections:[{title, chapters:[{title, scenes:[{id,title,srcId}]}]}], counts }}
 */
export function mapBinder(binder, opts = {}) {
  const draftOnly = opts.draftOnly !== false;
  const roots = draftOnly
    ? pickDraft(binder)
    : binder;
  const chapters = [];
  let loose = null;
  const pushScene = (chapter, item) => chapter.scenes.push({ srcId: item.id, title: item.title || T`(ไม่มีชื่อ)` });
  const visit = (items, chapter) => {
    for (const it of items) {
      if (opts.onlyCompiled && it.include === false) continue;   // เคารพ "Include in Compile" ถ้าผู้ใช้สั่ง
      if (SCRIV_FOLDER.has(it.type) || (it.children && it.children.length)) {
        const ch = { title: it.title || T`(ไม่มีชื่อ)`, scenes: [] };
        chapters.push(ch);
        visit(it.children || [], ch);
        if (!ch.scenes.length && SCRIV_TEXT.has(it.type)) pushScene(ch, it);   // โฟลเดอร์ที่มีเนื้อหาเองด้วย
      } else if (SCRIV_TEXT.has(it.type)) {
        if (!chapter) { loose = loose || { title: opts.looseTitle || T`(ไม่มีบท)`, scenes: [] }; pushScene(loose, it); }
        else pushScene(chapter, it);
      }
    }
  };
  visit(roots, null);
  if (loose) chapters.unshift(loose);
  const kept = chapters.filter((c) => c.scenes.length);
  return {
    sections: [{ title: opts.sectionTitle || T`เล่มหนึ่ง`, chapters: kept }],
    counts: { chapters: kept.length, scenes: kept.reduce((n, c) => n + c.scenes.length, 0) },
  };
}
function pickDraft(binder) {
  const draft = binder.find((b) => b.type === 'DraftFolder' || /^(draft|manuscript|ต้นฉบับ)$/i.test(b.title));
  return draft ? draft.children : binder;
}

// ────────────────────────────────────────────────────────────────
// 4) API หลัก
// ────────────────────────────────────────────────────────────────
const safeName = (s, fallback) => String(s || fallback).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60) || fallback;

/**
 * Import a .scriv project folder into Killian's structure.
 * @param {string} filePath  path to the .scriv folder
 * @param {object} options   { io, dest, title, dryRun, sectionTitle, draftOnly, onProgress }
 *        io = { join, exists, listFiles, listDirs, readFile, readJson, writeFile, mkdir }
 * @returns {Promise<{ok, plan, written, counts, warnings, error?}>}
 */
export async function importScrivener(filePath, options = {}) {
  const io = options.io;
  if (!io) return { ok: false, error: T`ต้องส่ง io adapter เข้ามา`, code: 'no-io' };
  const warnings = [];

  // 1. หาไฟล์ .scrivx
  let files = [];
  try { files = await io.listFiles(filePath); } catch { files = []; }
  const scrivx = files.find((f) => f.toLowerCase().endsWith('.scrivx'));
  if (!scrivx) return { ok: false, error: T`ไม่พบไฟล์ .scrivx ในโฟลเดอร์นี้ (ต้องชี้ไปที่โฟลเดอร์ .scriv)`, code: 'no-scrivx' };

  const xml = await io.readFile(io.join(filePath, scrivx));
  const binder = parseBinder(xml);
  if (!binder.length) return { ok: false, error: T`อ่านโครง binder ไม่ได้ (ไฟล์อาจเสียหาย)`, code: 'bad-binder' };

  const mapped = mapBinder(binder, options);
  const title = options.title || scrivx.replace(/\.scrivx$/i, '');

  // 2. อ่านเนื้อหาแต่ละเอกสาร (Scrivener 3 ก่อน แล้วค่อย 2)
  for (const sec of mapped.sections) {
    for (const ch of sec.chapters) {
      for (const sc of ch.scenes) {
        const rtf = await readDocRtf(io, filePath, sc.srcId);
        if (rtf == null) { warnings.push(T`ไม่พบเนื้อหาของ "${sc.title}" (${sc.srcId})`); sc.body = ''; continue; }
        sc.body = rtfToText(rtf);
      }
    }
  }

  const plan = buildPlan(mapped, title, options);
  if (options.dryRun) return { ok: true, plan, counts: mapped.counts, warnings, written: 0, title };

  // 3. เขียนโครงโปรเจกต์ Killian
  const dest = options.dest;
  if (!dest) return { ok: false, error: T`ยังไม่ได้เลือกโฟลเดอร์ปลายทาง`, code: 'no-dest', plan, counts: mapped.counts };
  let written = 0;
  for (const f of plan.files) {
    const full = io.join(dest, ...f.path);
    if (io.mkdir) await io.mkdir(dirOf(io, dest, f.path));
    await io.writeFile(full, f.content);
    written++;
    if (options.onProgress) options.onProgress(written, plan.files.length, f.path.join('/'));
  }
  return { ok: true, plan, counts: mapped.counts, warnings, written, title, dest };
}
function dirOf(io, dest, parts) { return io.join(dest, ...parts.slice(0, -1)); }

async function readDocRtf(io, root, id) {
  const candidates = [
    ['Files', 'Data', id, 'content.rtf'],          // Scrivener 3
    ['Files', 'Docs', id + '.rtf'],                // Scrivener 2
    ['Files', 'Docs', id, 'content.rtf'],
  ];
  for (const parts of candidates) {
    const p = io.join(root, ...parts);
    try { if (await io.exists(p)) return await io.readFile(p); } catch { /* ลองอันถัดไป */ }
  }
  return null;
}

/** Build the exact file list Killian needs (pure — used by dryRun preview too). */
export function buildPlan(mapped, title, opts = {}) {
  const files = [];
  files.push({ path: ['project.khn.json'], content: JSON.stringify({
    title, type: 'killian-project', importedFrom: 'scrivener', importedAt: opts.now || null,
  }, null, 2) });

  mapped.sections.forEach((sec, si) => {
    const secDir = safeName(sec.title, T`เล่มหนึ่ง`);
    files.push({ path: [secDir, 'section.json'], content: JSON.stringify({
      guid: 's' + (si + 1), title: sec.title, order: si + 1,
    }, null, 2) });

    const chapters = [];
    const scenesMap = {};
    sec.chapters.forEach((ch, ci) => {
      const guid = `c${si + 1}_${ci + 1}`;
      const folderName = `${String(ci + 1).padStart(2, '0')} - ${safeName(ch.title, T`บท`)}`;
      chapters.push({ guid, title: ch.title, order: ci + 1, folderName });
      scenesMap[guid] = ch.scenes.map((sc, i) => ({
        id: `${guid}_s${i + 1}`, title: sc.title, order: i + 1, fileName: `scene-${String(i + 1).padStart(2, '0')}.md`,
      }));
      ch.scenes.forEach((sc, i) => {
        files.push({
          path: [secDir, 'Draft', 'default', 'Chapters', folderName, `scene-${String(i + 1).padStart(2, '0')}.md`],
          content: `---\ntitle: ${sc.title}\ntype: scene\nformat: prose\n---\n\n${sc.body || ''}\n`,
        });
      });
    });
    files.push({ path: [secDir, 'Draft', 'default', 'draft.json'], content: JSON.stringify({ chapters }, null, 2) });
    files.push({ path: [secDir, 'Draft', 'default', 'scenes.json'], content: JSON.stringify({ chapters: scenesMap }, null, 2) });
  });
  return { files, count: files.length };
}
