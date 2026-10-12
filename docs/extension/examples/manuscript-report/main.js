// Manuscript report — an example from the Killian 2 Extension Guide (docs/extension/)
// Shows: k2.listDirs / listFiles / readFile / writeFile (paths relative to the project root) · confirmBox · a long async job
//
// It reads the project's structure from the registry files (read-only):
//   <book>/section.json                          { title, order, primaryDraft? }
//   <book>/Draft/<draft>/draft.json              { chapters: [{ guid, title, order, folderName }] }
//   <book>/Draft/<draft>/scenes.json             { chapters: { <guid>: [{ title, order, fileName, status }] } }
//   <book>/Draft/<draft>/Chapters/<folderName>/<fileName>   a scene file (.md with frontmatter)
// A plugin may READ these files but must NEVER overwrite them — the app has its own write queue and open tabs.
// This plugin therefore writes its result to a new file of its own (Reports/…).

const OUT = 'Reports/manuscript-report.md';

// Text in two languages, chosen from <html lang>. Anything else falls back to English.
const STR = {
  en: {
    cmd: 'Build manuscript report', needProject: 'Open a project first', reading: 'Reading the manuscript…',
    title: 'Manuscript report', generated: 'Generated ', head: '| Chapter | Scene | Status | Words |',
    bookTotal: (n) => '**This book: ' + n + ' words**',
    total: (n, s) => 'Whole project: **' + n + ' words** · ' + s + (s === 1 ? ' scene' : ' scenes'),
    overwriteAsk: (f) => f + ' already exists.\nOverwrite it?', overwrite: 'Overwrite',
    done: (f, n, s) => 'Wrote ' + f + ' — ' + n + ' words · ' + s + (s === 1 ? ' scene' : ' scenes'),
    fail: 'Could not build the report — see the Log panel',
  },
  th: {
    cmd: 'สร้างรายงานต้นฉบับ', needProject: 'เปิดผลงานก่อน', reading: 'กำลังอ่านต้นฉบับ…',
    title: 'รายงานต้นฉบับ', generated: 'สร้างเมื่อ ', head: '| บท | ฉาก | สถานะ | คำ |',
    bookTotal: (n) => '**รวมเล่มนี้ ' + n + ' คำ**',
    total: (n, s) => 'รวมทั้งผลงาน **' + n + ' คำ** · ' + s + ' ฉาก',
    overwriteAsk: (f) => 'เขียนทับ ' + f + ' ที่มีอยู่?', overwrite: 'เขียนทับ',
    done: (f, n, s) => 'เขียน ' + f + ' แล้ว — ' + n + ' คำ · ' + s + ' ฉาก',
    fail: 'สร้างรายงานไม่สำเร็จ — ดูแผงบันทึก (Log)',
  },
};
const T = STR[(document.documentElement.lang || 'en').slice(0, 2)] || STR.en;

const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
const countWords = (t) => { let n = 0; for (const s of seg.segment(t)) if (s.isWordLike) n++; return n; };

/** Strip a BOM from the start of a file (files saved from Notepad often have one) */
const stripBom = (t) => { const s = String(t == null ? '' : t); return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; };

/** Drop the frontmatter (--- … ---) and the comments block at the end, leaving only the body text */
function bodyOf(md) {
  let s = stripBom(md);
  if (s.startsWith('---')) {
    const end = s.indexOf('\n---', 3);
    if (end > 0) s = s.slice(s.indexOf('\n', end + 1) + 1);
  }
  const c = s.indexOf('<!-- k2-comments');
  return c >= 0 ? s.slice(0, c) : s;
}

/** Does this file exist? k2.readFile throws when the file is missing (and that is logged), so ask the file list first. */
async function hasFile(rel) {
  const i = rel.lastIndexOf('/');
  const names = await k2.listFiles(i < 0 ? '.' : rel.slice(0, i));
  return names.includes(i < 0 ? rel : rel.slice(i + 1));
}

async function readJson(rel) {
  if (!(await hasFile(rel))) return null;
  try { return JSON.parse(stripBom(await k2.readFile(rel))); } catch { return null; }
}

async function buildReport() {
  if (!k2.projectRoot()) { k2.setStatus(T.needProject); return null; }
  const lines = ['# ' + T.title, '', T.generated + new Date().toLocaleString(), ''];
  let total = 0, scenes = 0;

  // A book = a top-level folder containing section.json (the app's own folders, such as Wiki/Images, have no such file)
  const books = [];
  for (const dir of await k2.listDirs('.')) {
    const sec = await readJson(dir + '/section.json');
    if (sec) books.push({ dir, title: sec.title || dir, order: sec.order || 0, draft: sec.primaryDraft || '' });
  }
  books.sort((a, b) => a.order - b.order);

  for (const book of books) {
    const drafts = await k2.listDirs(book.dir + '/Draft');
    const draft = drafts.includes(book.draft) ? book.draft : drafts[0];
    if (!draft) continue;
    const base = book.dir + '/Draft/' + draft;
    const dj = await readJson(base + '/draft.json');
    const sj = await readJson(base + '/scenes.json');
    if (!dj || !sj) continue;

    lines.push('## ' + book.title, '', T.head, '|---|---|---|---:|');
    let bookWords = 0;
    const chapters = [...(dj.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const ch of chapters) {
      const rows = [...((sj.chapters || {})[ch.guid] || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const row of rows) {
        const rel = base + '/Chapters/' + ch.folderName + '/' + row.fileName;
        const words = (await hasFile(rel)) ? countWords(bodyOf(await k2.readFile(rel))) : 0;
        bookWords += words; scenes++;
        // names come from the user's files → escape | so the table does not break
        const cell = (v) => String(v || '').replace(/\|/g, '\\|');
        lines.push('| ' + cell(ch.title) + ' | ' + cell(row.title) + ' | ' + cell(row.status) + ' | ' + words.toLocaleString() + ' |');
      }
    }
    total += bookWords;
    lines.push('', T.bookTotal(bookWords.toLocaleString()), '');
  }
  lines.push('---', '', T.total(total.toLocaleString(), scenes), '');
  return { text: lines.join('\n'), total, scenes };
}

k2.registerCommand(T.cmd, async () => {
  try {
    k2.setStatus(T.reading);
    const r = await buildReport();
    if (!r) return;
    if ((await hasFile(OUT)) && !(await k2.confirmBox(T.overwriteAsk(OUT), T.overwrite))) return;
    await k2.writeFile(OUT, r.text);                   // an atomic write · missing folders are created
    k2.setStatus(T.done(OUT, r.total.toLocaleString(), r.scenes));
  } catch (e) {
    k2.log('report failed: ' + (e && e.message));
    k2.setStatus(T.fail);
  }
});

k2.onUnload(() => {});                                 // nothing outside k2 to clean up
