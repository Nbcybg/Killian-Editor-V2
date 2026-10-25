// test/import-manuscript.test.cjs — [alpha.170 · นำเข้าต้นฉบับ] DOCX / Markdown / ข้อความ → เล่มใหม่
// ที่มา: ผลสำรวจผู้ใช้ข้อ 3 "ย้ายงานเก่าเข้ามาไม่ได้" — ตัวอ่าน DOCX · ตัดบท/ฉาก · แผนไฟล์ของเล่มใหม่
// ★ ไปกลับกับตัวส่งออก DOCX ของโปรแกรมเอง (`buildDocx`) = พิสูจน์ว่าอ่าน Word ที่มีหัวข้อ/รายการ/รูปแบบตัวอักษรได้จริง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const fs = require('fs');
const esbuild = require('esbuild');

function load(rel, tag) {
  const tmp = path.join(os.tmpdir(), 'k2-' + tag + '-impm-test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', rel)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const M = load('import/import-manuscript.js', 'im');
const E = load('export-ebook.js', 'eb');
const MD = require('../src/md.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); }
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const doc = (body) => `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`;
const p = (text, ppr = '', rpr = '') => `<w:p>${ppr ? '<w:pPr>' + ppr + '</w:pPr>' : ''}<w:r>${rpr ? '<w:rPr>' + rpr + '</w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const STYLES = `<w:styles ${W}>
<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="a1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="a2"><w:name w:val="heading 2"/></w:style>
<w:style w:type="paragraph" w:styleId="MyChap"><w:name w:val="บทของฉัน"/><w:basedOn w:val="a1"/></w:style>
<w:style w:type="paragraph" w:styleId="Q"><w:name w:val="Quote"/></w:style>
<w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/></w:style>
</w:styles>`;

// ── 1) สไตล์: ชื่อมาตรฐาน · outlineLvl · basedOn (styleId ภาษาท้องถิ่น) ──
{
  const st = M.docxStyles(STYLES);
  check('[im-1] heading 1 ที่ styleId ไม่ใช่ "Heading1" = หัวข้อระดับ 1', st.get('a1').level === 1);
  check('[im-1] heading 2 = ระดับ 2', st.get('a2').level === 2);
  check('[im-1] สไตล์ที่สืบจากหัวข้อ = หัวข้อระดับเดียวกัน', st.get('MyChap').level === 1);
  check('[im-1] Quote = คำพูดยกมา', st.get('Q').quote === true && st.get('Q').level === 0);
  check('[im-1] Normal ไม่ใช่หัวข้อ', st.get('Normal').level === 0);
  check('[im-1] styles ว่าง = ไม่พัง', M.docxStyles('').size === 0);
}

// ── 2) ย่อหน้า + รูปแบบตัวอักษร ──
{
  const r = M.docxToDoc({ styles: STYLES, document: doc(
    p('ตอนที่ 1', '<w:pStyle w:val="a1"/>')
    + '<w:p><w:r><w:t xml:space="preserve">ฝนตก </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">หนัก </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>มาก</w:t></w:r><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>.</w:t></w:r></w:p>'
    + p('กึ่งกลาง', '<w:jc w:val="center"/>')
    + '<w:p><w:r><w:t>บรรทัดหนึ่ง</w:t><w:br/><w:t>บรรทัดสอง</w:t></w:r></w:p>'
    + p('ยกมา', '<w:pStyle w:val="Q"/>')
    + '<w:p><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>ขีดเส้น</w:t></w:r><w:r><w:rPr><w:strike/></w:rPr><w:t>ฆ่า</w:t></w:r></w:p>'
    + '<w:p><w:del><w:r><w:delText>ลบแล้ว</w:delText></w:r></w:del><w:ins><w:r><w:t>แทรก</w:t></w:r></w:ins></w:p>'
    + '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>7</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'
    + '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>XE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t>หลังฟิลด์</w:t></w:r></w:p>'
  ) });
  const md = M.sceneMd(r.content);
  const lines = md.split('\n');
  check('[im-2] หัวข้อ → # ', lines[0] === '# ตอนที่ 1', lines[0]);
  check('[im-2] ตัวหนา/เอียง · ช่องว่างอยู่นอกเครื่องหมาย', lines[1] === 'ฝนตก **หนัก** *มาก*.', lines[1]);
  check('[im-2] จัดกึ่งกลางติดไปด้วย', lines[2] === '<!--align:center-->กึ่งกลาง', lines[2]);
  check('[im-2] ขึ้นบรรทัดในย่อหน้า = `\\` ท้ายบรรทัด', lines[3] === 'บรรทัดหนึ่ง\\' && lines[4] === 'บรรทัดสอง', lines.slice(3, 5));
  check('[im-2] Quote → > ', lines[5] === '> ยกมา', lines[5]);
  check('[im-2] ขีดเส้นใต้/ขีดฆ่า', lines[6] === '_ขีดเส้น_~~ฆ่า~~', lines[6]);
  check('[im-2] ติดตามการแก้ไข: ข้อความที่ลบไม่มา · ที่แทรกมา', lines[7] === 'แทรก', lines[7]);
  check('[im-2] ฟิลด์: เก็บผลที่แสดง ไม่เก็บรหัส', lines[8] === '7', lines[8]);
  check('[im-2] ฟิลด์ที่ไม่มี separate ไม่กลืนข้อความหลังมัน', lines[9] === 'หลังฟิลด์', lines[9]);
  check('[im-2] สถิติ', r.stats.headings === 1 && r.stats.paragraphs === 9, r.stats);
  // อ่านกลับด้วยตัวอ่านของโปรแกรมแล้วได้โครงที่ตั้งใจ
  const back = MD.mdToDoc(md).content;
  check('[im-2] ไฟล์ที่ได้อ่านกลับเป็นหัวข้อ + ย่อหน้า (ไม่มีย่อหน้าว่างแทรก)', back[0].type === 'heading' && back.filter((n) => n.type === 'paragraph' && !(n.content || []).length).length === 0,
    back.map((n) => n.type));
}

// ── 3) รายการ (numbering.xml) · ตาราง · ย่อหน้าว่างที่ใช้เว้นระยะ ──
{
  const NUM = `<w:numbering ${W}>
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="thaiNumbers"/></w:lvl></w:abstractNum>
<w:num w:numId="5"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="6"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const li = (t, id) => p(t, `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${id}"/></w:numPr>`);
  const r = M.docxToDoc({ numbering: NUM, document: doc(li('ก', 5) + li('ข', 5) + li('หนึ่ง', 6) + li('สอง', 6)
    + '<w:tbl><w:tr><w:tc>' + p('ช่อง 1') + '</w:tc><w:tc>' + p('ช่อง 2') + '</w:tc></w:tr></w:tbl>') });
  const md = M.sceneMd(r.content);
  check('[im-3] bullet / ตัวเลขไทย = รายการเลข · คนละรายการเมื่อ numId ต่างกัน', md === '- ก\n- ข\n1. หนึ่ง\n2. สอง\nช่อง 1\nช่อง 2', md);
  check('[im-3] นับตาราง', r.stats.tables === 1);

  // ทุกย่อหน้ามีย่อหน้าว่างคั่น = ระยะห่าง ไม่ใช่เนื้อหา → ตัดทิ้ง · ว่างติดกันสองย่อหน้า = ผู้เขียนตั้งใจ (เหลือหนึ่ง)
  const blank = '<w:p/>';
  const spaced = M.docxToDoc({ document: doc(blank + p('ก') + blank + p('ข') + blank + p('ค') + blank + blank + p('ง') + blank + p('จ') + blank) });
  check('[im-3] ย่อหน้าว่างที่คั่นทุกย่อหน้า = ตัวคั่น (ตัดทิ้ง)', M.sceneMd(spaced.content) === 'ก\nข\nค\n\nง\nจ', M.sceneMd(spaced.content));
  const sparse = M.docxToDoc({ document: doc(p('ก') + p('ข') + blank + p('ค') + p('ง') + p('จ')) });
  check('[im-3] ย่อหน้าว่างนาน ๆ ที = ของผู้เขียน (คงไว้)', M.sceneMd(sparse.content) === 'ก\nข\n\nค\nง\nจ', M.sceneMd(sparse.content));
}

// ── 4) รูป: rels → key · page break ──
{
  const RELS = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="x/image" Target="media/pic.png"/><Relationship Id="rL" Type="x/hyperlink" Target="https://a" TargetMode="External"/></Relationships>';
  const img = '<w:p><w:r><w:drawing><wp:inline xmlns:wp="x"><wp:docPr id="1" name="p" descr="ภาพปก"/><a:graphic xmlns:a="y"><a:graphicData><pic:pic xmlns:pic="z"><pic:blipFill><a:blip r:embed="rId9"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  const r = M.docxToDoc({ rels: RELS, document: doc(p('ก่อน') + img + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + p('หลัง')) });
  check('[im-4] รูปได้ key + ทางในแพ็กเกจ', r.images.length === 1 && r.images[0].path === 'word/media/pic.png' && r.images[0].alt === 'ภาพปก', r.images);
  check('[im-4] ลำดับ: ย่อหน้า · รูป · ขึ้นหน้าใหม่ · ย่อหน้า', r.content.map((n) => n.type).join() === 'paragraph,figure,page_break,paragraph', r.content.map((n) => n.type));
  check('[im-4] rels ข้ามลิงก์ภายนอก', M.docxRels(RELS).size === 1);
  const plan = M.buildBookPlan(M.splitManuscript([{ name: 'a.docx', content: r.content }]),
    { bookTitle: 'เล่มนำเข้า', bookFolder: 'เล่มนำเข้า', order: 2, images: new Map([['k2img:1', { ext: 'png', name: 'ภาพปก' }]]) });
  const imgFile = plan.files.find((f) => f.image);
  check('[im-4] รูปลงอัลบั้มของเล่ม', imgFile && imgFile.path.join('/') === 'Images/เล่มนำเข้า/ภาพปก.png' && imgFile.image === 'k2img:1', imgFile);
  const scene = plan.files.find((f) => /\.md$/.test(f.path[f.path.length - 1]));
  check('[im-4] ฉากอ้างรูปด้วยทางสัมพัทธ์ถึงรากโปรเจกต์', scene.content.includes('](../../../../../Images/เล่มนำเข้า/ภาพปก.png)'), scene.content);
  check('[im-4] ตัวขึ้นหน้าใหม่ติดไปด้วย', scene.content.includes('<!-- pagebreak -->') || scene.content.includes('<!--pagebreak-->'), scene.content);
  check('[im-4] ทางสัมพัทธ์ = จำนวนชั้นของโฟลเดอร์ฉากจริง', M.SCENE_TO_ROOT.split('../').length - 1 === scene.path.length - 1, scene.path);
}

// ── 5) หัวบท/ตัวคั่นฉากที่พิมพ์มือ ──
{
  for (const s of ['ตอนที่ 12', 'ตอนที่ 3: กลับบ้าน', 'บทที่ ๕ ฝน', 'Chapter 7 - Rain', 'EP.3', 'บทนำ', 'อารัมภบท', 'ตอนพิเศษ : วันเกิด', 'Prologue'])
    check('[im-5] หัวบทแบบพิมพ์: ' + s, M.isChapterLine(s));
  for (const s of ['ตอนนั้นเขายังเด็ก', 'บทที่เขาเล่นได้ดีที่สุด', 'ตอนที่ 3 ของชีวิตเขาเริ่มขึ้นในวันที่ฝนตกหนักที่สุดของปีนั้นและไม่มีใครรู้เลยว่ามันจะจบอย่างไร ไม่มีเลยจริง ๆ', 'Chapterhouse', ''])
    check('[im-5] ไม่ใช่หัวบท: ' + s.slice(0, 20), !M.isChapterLine(s));
  for (const s of ['***', '* * *', '---', '◇◇◇', '＊＊＊', '#']) check('[im-5] ตัวคั่นฉาก: ' + s, M.isSceneBreakLine(s));
  check('[im-5] ข้อความปกติไม่ใช่ตัวคั่นฉาก', !M.isSceneBreakLine('ก***'));
}

// ── 6) ข้อความที่วาง (นิยายเว็บ) → บท/ฉาก ──
{
  const txt = 'คำนำผู้แต่ง\n\nตอนที่ 1 เริ่มต้น\n\nย่อหน้าแรก\n\nย่อหน้าสอง\n\n***\n\nฉากต่อมา\n\n\n\nตอนที่ 2 ต่อ\n\nเนื้อตอนสอง\n';
  const d = M.textToImportDoc(txt);
  const s = M.splitManuscript([{ name: 'วาง', title: 'นิยายของฉัน', content: d.content }]);
  check('[im-6] ไฟล์เดียว auto = ตัดตามหัวข้อ', s.mode === 'headings');
  check('[im-6] ได้สามบท (คำนำ + ตอน 1 + ตอน 2)', s.chapters.map((c) => c.title).join('|') === 'นิยายของฉัน|ตอนที่ 1 เริ่มต้น|ตอนที่ 2 ต่อ', s.chapters.map((c) => c.title));
  const ch1 = M.sceneMd(s.chapters[1].scenes[0].content);
  check('[im-6] บรรทัดว่างคั่นย่อหน้าหายไป · *** → * * * กึ่งกลาง', ch1 === 'ย่อหน้าแรก\nย่อหน้าสอง\n<!--align:center-->* * *\nฉากต่อมา', ch1);
  check('[im-6] ฉากของบทที่ไม่มีหัวข้อฉาก = ชื่อเดียวกับบท', s.chapters[2].scenes[0].title === 'ตอนที่ 2 ต่อ');
  check('[im-6] ข้อความล้วนไม่ถูกตีความเป็นมาร์กดาวน์', M.sceneMd(M.textToImportDoc('# ไม่ใช่หัวข้อ\n- ไม่ใช่รายการ').content) === '# ไม่ใช่หัวข้อ\n- ไม่ใช่รายการ'.split('\n').join('\n')
    && M.textToImportDoc('# ไม่ใช่หัวข้อ').content[0].type === 'paragraph');
  const none = M.splitManuscript([{ name: 'x.txt', content: M.textToImportDoc('ก\nข').content }]);
  check('[im-6] ไม่มีหัวข้อเลย = เตือน noHeadings (บทเดียวฉากเดียว)', none.warnings.some((w) => w.code === 'noHeadings') && none.counts.scenes === 1, none);
  const off = M.splitManuscript([{ name: 'x', content: d.content }], { detect: false });
  check('[im-6] ปิดการจับหัวบท = ไม่ตัด', off.chapters.length === 1, off.chapters.length);
}

// ── 7) หลายไฟล์: ไฟล์ละบท · ไฟล์ละฉาก · หัวข้อในไฟล์ ──
{
  const mk = (md) => M.mdToImportDoc(md).content;
  const docs = [
    { name: '01 - ฝนแรก.md', content: mk('# ฝนแรก\n\nเนื้อหนึ่ง\n\n## ฉากร้าน\n\nเนื้อร้าน') },
    { name: '02 - กลับบ้าน.md', content: mk('ไม่มีหัวข้อ\n\nย่อหน้าสอง') },
    { name: 'ว่าง.md', content: mk('\n\n') },
  ];
  const s = M.splitManuscript(docs, { mode: 'file-chapter' });
  check('[im-7] ไฟล์ละบท: ชื่อบทจากหัวข้อแรก/ชื่อไฟล์ (ตัดเลขนำ)', s.chapters.map((c) => c.title).join('|') === 'ฝนแรก|กลับบ้าน', s.chapters.map((c) => c.title));
  check('[im-7] หัวข้อย่อยในไฟล์ = ฉาก', s.chapters[0].scenes.map((x) => x.title).join('|') === 'ฝนแรก|ฉากร้าน', s.chapters[0].scenes.map((x) => x.title));
  check('[im-7] ไฟล์ว่าง = เตือน ไม่สร้างบทเปล่า', s.warnings.some((w) => w.code === 'empty' && w.name === 'ว่าง.md') && s.counts.chapters === 2);
  check('[im-7] markdown: บรรทัดว่างคั่นย่อหน้าหาย', M.sceneMd(s.chapters[1].scenes[0].content) === 'ไม่มีหัวข้อ\nย่อหน้าสอง');
  const fs2 = M.splitManuscript(docs, { mode: 'file-scene', chapterTitle: 'บทที่หนึ่ง' });
  check('[im-7] ไฟล์ละฉาก: บทเดียว สองฉาก', fs2.chapters.length === 1 && fs2.chapters[0].title === 'บทที่หนึ่ง' && fs2.chapters[0].scenes.map((x) => x.title).join('|') === 'ฝนแรก|กลับบ้าน', fs2.chapters);
  check('[im-7] auto + หลายไฟล์ = ไฟล์ละบท', M.splitManuscript(docs).mode === 'file-chapter');
  const fm = M.mdToImportDoc('---\ntitle: จาก Obsidian\ntags: [a]\n---\n\nเนื้อ [[มีนา]] ไปตลาด');
  check('[im-7] frontmatter ถูกตัด · title ใช้เป็นชื่อ · ลิงก์ [[…]] คงไว้', fm.title === 'จาก Obsidian' && M.sceneMd(fm.content) === 'เนื้อ [[มีนา]] ไปตลาด', [fm.title, M.sceneMd(fm.content)]);
  check('[im-7] เรียงไฟล์แบบคนอ่าน', ['ตอน 10.docx', 'ตอน 2.docx', 'ตอน 1.docx'].sort(M.naturalCompare).join() === 'ตอน 1.docx,ตอน 2.docx,ตอน 10.docx');
  check('[im-7] ชื่อไฟล์ที่เป็นหัวบทคงไว้ทั้งชื่อ', M.titleFromFileName('C:\\x\\ตอนที่ 3.docx') === 'ตอนที่ 3' && M.titleFromFileName('03_ทาง_กลับ.docx') === 'ทาง กลับ');
}

// ── 8) แผนไฟล์: ทะเบียนตรงกับไฟล์ · ชื่อชนกัน · อ่านกลับได้ ──
{
  const s = M.splitManuscript([{ name: 'a', content: M.textToImportDoc('ตอนที่ 1\nก\nตอนที่ 1\nข\nตอนที่ 2: ทาง/ไกล\nค').content }]);
  const plan = M.buildBookPlan(s, { bookTitle: 'Imported', bookFolder: 'Imported', order: 3, now: '2026-10-23' });
  const get = (tail) => plan.files.find((f) => f.path.join('/').endsWith(tail));
  const sec = JSON.parse(get('section.json').content);
  check('[im-8] section.json: ชื่อ = โฟลเดอร์ · ลำดับ', sec.title === 'Imported' && sec.folderName === 'Imported' && sec.order === 3);
  const draft = JSON.parse(get('draft.json').content);
  check('[im-8] บทชื่อซ้ำ = โฟลเดอร์ต่อเลข · ชื่ออักขระต้องห้ามถูกแทน', draft.chapters.map((c) => c.folderName).join('|') === 'ตอนที่ 1|ตอนที่ 1 2|ตอนที่ 2 ทาง ไกล', draft.chapters.map((c) => c.folderName));
  const sj = JSON.parse(get('scenes.json').content);
  let ok = true;
  for (const ch of draft.chapters) {
    for (const row of sj.chapters[ch.guid]) {
      const f = get(['Chapters', ch.folderName, row.fileName].join('/'));
      if (!f) { ok = false; continue; }
      const pm = MD.parseMdFile(f.content);
      if (pm.meta.title !== row.title || pm.meta.type !== 'scene' || row.chapterGuid !== ch.guid || !(row.wordCount > 0)) ok = false;
    }
  }
  check('[im-8] ทุกแถวใน scenes.json ชี้ไฟล์ที่มีจริง · frontmatter ตรง · นับคำแล้ว', ok);
  check('[im-8] ไม่มีเลขลำดับในชื่อไฟล์ (ลำดับอยู่ใน order)', !plan.files.some((f) => /scene-\d/.test(f.path.join('/'))));
  const sf = get('ตอนที่ 2 ทาง ไกล/ตอนที่ 2 ทาง ไกล.md');
  check('[im-8] ชื่อเรื่องใน frontmatter เก็บอักขระเดิม (/)', sf && MD.parseMdFile(sf.content).meta.title === 'ตอนที่ 2: ทาง/ไกล', sf && sf.content);
}

// ── 9) ไปกลับกับตัวส่งออก DOCX ของโปรแกรม ──
{
  const src = '# ตอนที่ 1\n## ร้านเบเกอรี่\nโทระเปิดร้านแต่เช้า **หนักมาก** และ *เงียบ*\n- แป้ง\n- เนย\n1. นวด\n2. อบ\n> ยกมา\n## กลางคืน\nเนื้อฉากสอง\n# ตอนที่ 2\nเนื้อตอนสอง';
  const pkg = E.buildDocx(src, { title: 't' });
  const get = (pth) => { const f = pkg.files.find((x) => x.path === pth); return f ? String(f.data) : ''; };
  const r = M.docxToDoc({ document: get('word/document.xml'), styles: get('word/styles.xml'), numbering: get('word/numbering.xml'), rels: get('word/_rels/document.xml.rels') });
  const s = M.splitManuscript([{ name: 'export.docx', content: r.content }]);
  check('[im-9] DOCX ของโปรแกรมเอง: สองบท', s.chapters.map((c) => c.title).join('|') === 'ตอนที่ 1|ตอนที่ 2', s.chapters.map((c) => c.title));
  check('[im-9] หัวข้อระดับ 2 = ฉาก', s.chapters[0].scenes.map((x) => x.title).join('|') === 'ร้านเบเกอรี่|กลางคืน', s.chapters[0].scenes.map((x) => x.title));
  const b = M.sceneMd(s.chapters[0].scenes[0].content);
  check('[im-9] เนื้อฉากกลับมาครบ (ตัวหนา/เอียง/รายการ/ยกมา)', b === 'โทระเปิดร้านแต่เช้า **หนักมาก** และ *เงียบ*\n- แป้ง\n- เนย\n1. นวด\n2. อบ\n> ยกมา', b);
}

// ── 10) ไฟล์ .docx จริงในเครื่อง (ถ้ามี JSZip) — แตกแพ็กเกจที่ buildDocx สร้างเหมือนตอนรันจริง ──
(async () => {
  try {
    const JSZip = require('jszip');
    const pkg = E.buildDocx('# บท\nเนื้อ', {});
    const zip = new JSZip();
    for (const f of pkg.files) zip.file(f.path, f.data);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const z2 = await JSZip.loadAsync(bytes);
    const r = M.docxToDoc({ document: await z2.file('word/document.xml').async('string'), styles: await z2.file('word/styles.xml').async('string') });
    check('[im-10] แตก .docx จริงแล้วอ่านได้', M.sceneMd(r.content) === '# บท\nเนื้อ', M.sceneMd(r.content));
  } catch (e) { check('[im-10] แตก .docx จริง', false, String(e)); }
  check('[im-10] นามสกุลรูป: emf ไม่รับ', M.imageExtOf('word/media/x.emf') === null && M.imageExtOf('word/media/x.JPEG') === 'jpeg');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
