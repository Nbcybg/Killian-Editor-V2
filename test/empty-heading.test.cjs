// test/empty-heading.test.cjs — [alpha.83 ข้อ 1] "หัวข้อว่าง" ต้องเป็นบรรทัดว่าง ไม่ใช่ข้อความ `###`
//
// ต้นตอของบั๊ก: md.js เขียนหัวข้อที่ไม่มีข้อความออกมาเป็น `"### "` (มีวรรคท้าย) ซึ่ง *ดูเหมือน*
// บรรทัดว่างในตัวแก้ไข แต่ทุกตัวที่อ่านไฟล์กลับ (mdToProseBlocks / mdToHtmlBody) ตัดวรรคท้ายทิ้ง
// ก่อนเทียบกฎ `#{1,6}\s+` → ไม่แมตช์ → กลายเป็น **ย่อหน้าที่มีข้อความ `###`** โผล่กลางเรื่อง
// ทั้งใน PDF และมาร์กดาวน์ · ไฟล์นี้ล็อกทุกทางเข้า-ออกไว้พร้อมกัน
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
};
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
const PF = build('prose-format.js', 'k2-eh-prose.cjs');
const CP = build('compile.js', 'k2-eh-compile.cjs');
const FT = build('fountain.js', 'k2-eh-fountain.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── 1) md.js: หัวข้อว่าง ⇄ บรรทัดว่าง ──
const emptyH = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'ก่อน' }] },
  { type: 'heading', attrs: { level: 3 } },
  { type: 'paragraph', content: [{ type: 'text', text: 'หลัง' }] }] };
check('[83-1] docToMd: หัวข้อว่าง → บรรทัดว่าง (ไม่ใช่ "### ")',
  MD.docToMd(emptyH) === 'ก่อน\n\nหลัง', JSON.stringify(MD.docToMd(emptyH)));
check('[83-1] docToMd: หัวข้อที่มีข้อความยังเขียนปกติ',
  MD.docToMd({ type: 'doc', content: [{ type: 'heading', attrs: { level: 3 },
    content: [{ type: 'text', text: 'บทที่ 1' }] }] }) === '### บทที่ 1');
for (const raw of ['###', '### ', '#', '######  ']) {
  const d = MD.mdToDoc(raw);
  check('[83-1] mdToDoc: ' + JSON.stringify(raw) + ' → ย่อหน้าว่าง ไม่ใช่ข้อความ',
    d.content.length === 1 && d.content[0].type === 'paragraph' && !d.content[0].content,
    JSON.stringify(d.content));
  check('[83-1] …และเขียนกลับเป็นบรรทัดว่าง (ไฟล์หายขาดจาก ### ถาวร)',
    MD.docToMd(d) === '', JSON.stringify(MD.docToMd(d)));
}
check('[83-1] `#hashtag` ไม่ใช่หัวข้อ — ยังเป็นข้อความปกติ',
  MD.docToMd(MD.mdToDoc('#hashtag')) === '#hashtag');

// ── 2) mdToProseBlocks (ตัวจัดหน้า/ตัวอย่าง PDF ของนิยาย) ──
const blk = PF.mdToProseBlocks('ก่อน\n### \nหลัง');
check('[83-1] mdToProseBlocks: ไม่มีบล็อกที่มีข้อความ "###"',
  !blk.some((b) => String(b.text).trim() === '###'), JSON.stringify(blk.map((b) => b.type + ':' + b.text)));
// [alpha.132r] หัวข้อว่างยังเป็น "บรรทัดว่าง" เหมือนเดิม — แต่บรรทัดว่าง **เป็นบล็อกแล้ว**
// (ย่อหน้าว่างต้องกินที่จริงในตัวอย่าง ไม่งั้นตัวอย่างตัดหน้าคนละที่กับไฟล์ PDF จริง)
check('[83-1] mdToProseBlocks: ได้ย่อหน้าจริงสองก้อน + ย่อหน้าว่างตรงกลาง',
  blk.length === 3 && blk.every((b) => b.type === 'p')
    && blk[0].text === 'ก่อน' && blk[1].text === '' && blk[2].text === 'หลัง',
  JSON.stringify(blk.map((b) => b.type + ':' + b.text)));
check('[83-1] mdToProseBlocks: หัวข้อที่มีข้อความยังเป็นหัวข้อ',
  PF.mdToProseBlocks('### บทที่ 1')[0].type === 'h3');

// ── 3) mdToHtmlBody (ทางส่งออก HTML / PDF ผ่าน HTML) ──
const html = CP.mdToHtmlBody('ก่อน\n### \nหลัง');
check('[83-1] mdToHtmlBody: ไม่มี <p>###</p>', !/>\s*#{2,6}\s*</.test(html), html);
check('[83-1] mdToHtmlBody: ไม่มี <h3></h3> เปล่า', !/<h\d><\/h\d>/.test(html), html);
check('[83-1] mdToHtmlBody: หัวข้อที่มีข้อความยังออกเป็น <h3>',
  CP.mdToHtmlBody('### บทที่ 1') === '<h3>บทที่ 1</h3>');

// ── 4) fountain lineFor: บล็อกเปล่าทุกชนิด = บรรทัดว่าง ──
// ต้นทางที่ทำให้ `"### "` ไปอยู่ในไฟล์ตั้งแต่แรก: เอกสารบทที่เพิ่งสร้างมีบล็อก `scene` เปล่า
for (const el of ['scene', 'character', 'transition', 'subheader', 'outline1', 'note', 'action']) {
  check('[83-1] lineFor: ' + el + ' ที่ไม่มีข้อความ = บรรทัดว่าง',
    FT.lineFor(el, '') === '', JSON.stringify(FT.lineFor(el, '')));
}
check('[83-1] lineFor: page-break ยังเป็นคำสั่ง `---` (ไม่ใช่บรรทัดว่าง)',
  FT.lineFor('page-break', '') === '---');
check('[83-1] lineFor: หัวฉากที่มีข้อความยังเขียนเป็น `### `',
  FT.lineFor('scene', 'INT. ครัว - เช้า') === '### INT. ครัว - เช้า');
// [alpha.83r] ฝั่งบทภาพยนตร์ก็ต้องเห็น `###` ล้วน ๆ เป็นบรรทัดว่างเหมือนกัน
// (ไฟล์ของผู้ใช้ที่มี `### ` ค้างอยู่ เปิดในโหมดบทแล้วเคยโผล่เป็นบรรยาย `###`)
for (const raw of ['###', '#', '######', '  ###  ']) {
  check('[83r-1] classify: ' + JSON.stringify(raw) + ' = บรรทัดว่างในโหมดบท',
    FT.classify(raw)[0] === 'blank', FT.classify(raw).join('/'));
}
check('[83r-1] classify: `### INT. ครัว` ยังเป็นหัวฉากตามเดิม',
  FT.classify('### INT. ครัว')[0] === 'scene');
// `#hashtag` มีเนื้อหาต่อท้าย จึงไม่ใช่หัวข้อว่าง — ยังเป็นข้อความของผู้ใช้เหมือนเดิม
// (จะถูกตีเป็นชนิดไหนขึ้นกับบริบท แต่ต้องไม่กลายเป็นบรรทัดว่าง)
check('[83r-1] classify: `#hashtag` ไม่ใช่บรรทัดว่าง (ข้อความไม่หาย)',
  FT.classify('#hashtag')[0] !== 'blank' && FT.classify('#hashtag')[1].includes('#hashtag'),
  FT.classify('#hashtag').join('/'));

check('[83-1] blockIsBlank: บล็อกเปล่าทุกชนิดนับเป็นบรรทัดว่าง',
  ['scene', 'character', 'action'].every((el) => FT.blockIsBlank({ el, text: '' })) &&
  !FT.blockIsBlank({ el: 'page-break', text: '' }));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
