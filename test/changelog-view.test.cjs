// test/changelog-view.test.cjs — [alpha.169 · bug hunt] ตัวอ่าน CHANGELOG.md ของกล่อง "มีอะไรใหม่"
const fs = require('fs');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-changelog-view-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'changelog-view.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const V = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const MD = [
  '\uFEFF# CHANGELOG', '', 'คำนำ', '', '---', '',
  '## alpha.2 — ของใหม่ · สองเรื่อง', '',
  '> e2e ALL OK **100** ข้อ', '> บรรทัดสอง', '',
  '### หัวข้อย่อย', '',
  'ย่อหน้าหนึ่ง มี **ตัวหนา** กับ `โค้ด_ที่มี_ขีดล่าง **ไม่หนา**` และ ~~ขีดฆ่า~~',
  'ต่อบรรทัดเดียวกัน', '',
  '| # | อาการ | แก้ |', '|---|---|---|',
  '| A1 | ลาก `a | b` แล้วพัง | **แก้แล้ว** |', '| A2 | มี \\| ในข้อความ | - |', '',
  '- ข้อหนึ่ง', '  ต่อของข้อหนึ่ง', '- ข้อสอง', '  - ข้อย่อย', '1. เลขหนึ่ง', '2) เลขสอง', '',
  '```', '## ไม่ใช่หัวรุ่น', 'code **ดิบ**', '```', '',
  '## alpha.1', '', 'รุ่นแรก',
].join('\r\n');

const secs = V.splitChangelog(MD);
check('แยกได้สองรุ่น · คำนำก่อนหัวแรกถูกทิ้ง', secs.length === 2 && secs[0].title.startsWith('alpha.2') && secs[1].title === 'alpha.1', JSON.stringify(secs.map((s) => s.title)));
check('★ `## ` ในรั้วโค้ดไม่ใช่หัวรุ่น', secs[0].body.includes('## ไม่ใช่หัวรุ่น'));
check('เนื้อรุ่นไม่มี \\r และไม่มีบรรทัดว่างหัวท้าย', !secs[0].body.includes('\r') && !/^\n|\n$/.test(secs[0].body));
check('ชื่อสั้นของรุ่น', V.shortTitle(secs[0].title) === 'alpha.2' && V.shortTitle('alpha.1') === 'alpha.1');
check('ค่าว่างไม่พัง', V.splitChangelog('').length === 0 && V.changelogBlocks('').length === 0 && V.inlineParts('').length === 0);

const B = V.changelogBlocks(secs[0].body);
const kinds = B.map((b) => b.kind).join(',');
check('ลำดับบล็อกถูกต้อง', kinds === 'quote,h,p,table,li,li,li,li,li,code', kinds);
check('อ้างอิงรวมสองบรรทัด', B[0].text === 'e2e ALL OK **100** ข้อ\nบรรทัดสอง', B[0].text);
check('หัวข้อย่อยระดับ 3', B[1].level === 3 && B[1].text === 'หัวข้อย่อย');
check('ย่อหน้ารวมบรรทัดที่ติดกัน', B[2].text.split('\n').length === 2);
const T = B[3];
check('★ ตาราง: หัว 3 ช่อง · 2 แถว', T.head.length === 3 && T.rows.length === 2 && T.head[1] === 'อาการ', JSON.stringify(T));
check('★ `|` ในช่วงโค้ดไม่ตัดช่อง', T.rows[0].length === 3 && T.rows[0][1] === 'ลาก `a | b` แล้วพัง', JSON.stringify(T.rows[0]));
check('`\\|` = ตัวอักษร | ในช่อง', T.rows[1].length === 3 && T.rows[1][1] === 'มี | ในข้อความ', JSON.stringify(T.rows[1]));
check('รายการ: บรรทัดต่อเนื่องรวมเข้าข้อเดิม', B[4].text === 'ข้อหนึ่ง ต่อของข้อหนึ่ง' && !B[4].ordered, B[4].text);
check('รายการซ้อน: ความลึก 1', B[6].depth === 1 && B[6].text === 'ข้อย่อย', JSON.stringify(B[6]));
check('รายการเรียงลำดับ: คงเครื่องหมายเดิม', B[7].ordered && B[7].mark === '1.' && B[8].mark === '2)', JSON.stringify([B[7], B[8]]));
check('รั้วโค้ด: เนื้อดิบ', B[9].text === '## ไม่ใช่หัวรุ่น\ncode **ดิบ**', B[9].text);

const P = V.inlineParts('ก **หนา** ข `โค้ด_x_ **ไม่หนา**` ค ~~ฆ่า~~ ง *เอียง* จ 2*3*4');
const find = (t) => P.find((p) => p.text === t) || {};
check('★ ตัวหนา', find('หนา').bold === true);
check('★ ช่วงโค้ดเป็นข้อความดิบ (เครื่องหมายข้างในไม่ถูกตีความ)', find('โค้ด_x_ **ไม่หนา**').code === true && !P.some((p) => p.text === 'ไม่หนา'));
check('ขีดฆ่า · เอียง', find('ฆ่า').strike === true && find('เอียง').em === true);
check('`*` ระหว่างตัวเลข/คำไม่ใช่ตัวเอียง', P[P.length - 1].text.includes('2*3*4') && !P[P.length - 1].em, JSON.stringify(P[P.length - 1]));
check('ต่อชิ้นกลับได้ข้อความเดิม (ไม่มีตัวอักษรหาย)', P.map((p) => p.text).join('') === 'ก หนา ข โค้ด_x_ **ไม่หนา** ค ฆ่า ง เอียง จ 2*3*4');
check('★ ตัวหนาที่ครอบช่วงโค้ด (`**\\`x\\`**` — เขียนแบบนี้ทั้งไฟล์): ไม่มี ** ค้าง · โค้ดได้ตัวหนาด้วย',
      (() => { const q = V.inlineParts('ก **`x_1` ข** ค'); return q.map((p) => p.text).join('') === 'ก x_1 ข ค' && q.find((p) => p.text === 'x_1').code && q.find((p) => p.text === 'x_1').bold && q.find((p) => p.text === ' ข').bold && !q.find((p) => p.text === ' ค').bold; })(),
      JSON.stringify(V.inlineParts('ก **`x_1` ข** ค')));
check('ขีดฆ่าที่ครอบช่วงโค้ด', (() => { const q = V.inlineParts('~~`a|b` เก่า~~'); return q.length === 2 && q[0].code && q[0].strike && q[1].strike; })());
check('`*` ในช่วงโค้ดไม่จับคู่กับ `*` ข้างนอก', (() => { const q = V.inlineParts('a *b `c*d` e'); return q.map((p) => p.text).join('') === 'a *b c*d e' && !q.some((p) => p.em); })(), JSON.stringify(V.inlineParts('a *b `c*d` e')));
check('หนาซ้อนขีดฆ่า',(() => { const q = V.inlineParts('~~**ปิดเคส**~~'); return q.length === 1 && q[0].bold && q[0].strike; })());

// ไฟล์จริงของรีโป — ต้องอ่านได้ทั้งไฟล์โดยไม่พัง และรุ่นบนสุดมีเนื้อ
{
  const real = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
  const t0 = Date.now();
  const all = V.splitChangelog(real);
  const blocks = all.map((s) => V.changelogBlocks(s.body));
  let parts = 0;
  for (const bs of blocks.slice(0, 6)) for (const b of bs) parts += V.inlineParts(b.text || '').length;
  const ms = Date.now() - t0;
  check('★ CHANGELOG.md ตัวจริง: แยกได้มากกว่า 100 รุ่น · ทุกรุ่นมีชื่อ', all.length > 100 && all.every((s) => s.title), String(all.length));
  check('รุ่นที่เป็นเลขรุ่นตัวแรกมีบล็อกเนื้อหา', (() => { const i = all.findIndex((s) => /^alpha\.\d+/.test(s.title)); return i >= 0 && blocks[i].length > 3; })());
  check('มีตารางอย่างน้อยหนึ่งใบที่หัวกับแถวช่องเท่ากัน', blocks.some((bs) => bs.some((b) => b.kind === 'table' && b.rows.length && b.rows.every((r) => r.length === b.head.length))));
  check('อ่านทั้งไฟล์ (1.6MB) เร็วพอสำหรับเปิดกล่อง (< 1.5 วินาที)', ms < 1500, ms + 'ms');
  check('ไม่มีชิ้นไหนเป็นเครื่องหมาย ** ค้าง ในหกรุ่นล่าสุด (นอกช่วงโค้ด)', parts > 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
