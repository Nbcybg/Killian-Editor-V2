// test/search-engine.test.cjs — ทดสอบ search-engine ด้วย node (ไม่ต้องเปิด electron)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// วิธีรัน:  node test/search-engine.test.cjs
// แปลง ES module → CommonJS ด้วย esbuild ชั่วคราว แล้ว require (เพราะ root ไม่ใช่ type:module)
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_se.cjs');     // '/tmp' ตายตัวรันบน Windows ไม่ได้
require('esbuild').buildSync({
  entryPoints: [path.join(__dirname, '../src/search-engine.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent',
});
const SE = require(out);
const { SearchIndex, tokenize, parseQuery } = SE;

let pass = 0, fail = 0;
function check(name, cond, info = '') {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗ FAIL:', name, info ? '::' + info : ''); }
}

// ── เอกสารตัวอย่าง (ไทยล้วน/ผสม) ──
const docs = [
  { id: 's1', path: 'ch1/s1.md', title: 'ทอร่าอบเค้ก', tags: ['ทอร่า', 'เบเกอรี่'], status: 'เขียนเสร็จ',
    body: 'ทอร่าตื่นเช้ามาอบเค้กช็อกโกแลตในร้านเบเกอรี่ กลิ่นหอมฟุ้งไปทั่ว\nคาสซี่เดินเข้ามาทักทาย' },
  { id: 's2', path: 'ch1/s2.md', title: 'คาสซี่กับเวทมนตร์', tags: ['คาสซี่'], status: 'กำลังเขียน',
    body: 'คาสซี่ร่ายเวทมนตร์เพื่อช่วยทอร่าทำเค้กวันเกิด แต่เวทมนตร์ผิดพลาด' },
  { id: 's3', path: 'ch2/s3.md', title: 'ร้านปิด', tags: ['เบเกอรี่'], status: 'โครงร่าง',
    body: 'The bakery closed early today because Tora was sick. Cassie helped clean up.' },
];
const idx = new SearchIndex().build(docs);

// ── 1. tokenizer ──
const tk = tokenize('ทอร่าอบเค้ก');
check('tokenize ไทยได้คำ (ไม่ว่าง)', tk.length >= 1, 'tokens=' + tk.length);
check('tokenize เก็บตำแหน่ง', tk.every((t) => typeof t.pos === 'number'));
const tkEn = tokenize('The bakery closed');
check('tokenize อังกฤษ (lowercase)', tkEn.some((t) => t.word === 'bakery'));

// ── 2. ค้นคำเดียว ──
let r = idx.search('เค้ก');
check('ค้นคำเดียว "เค้ก" เจอ s1+s2', r.length === 2 && r.some((x) => x.id === 's1') && r.some((x) => x.id === 's2'), 'n=' + r.length);
r = idx.search('เวทมนตร์');
check('ค้นคำเดียว "เวทมนตร์" เจอเฉพาะ s2', r.length === 1 && r[0].id === 's2', 'n=' + r.length);

// ── 3. หลายคำ = AND ──
r = idx.search('ทอร่า เค้ก');
check('AND โดยปริยาย "ทอร่า เค้ก" → s1,s2 (ทั้งคู่มี)', r.length === 2, 'n=' + r.length + ' ids=' + r.map((x) => x.id));
r = idx.search('คาสซี่ เวทมนตร์');
check('AND "คาสซี่ เวทมนตร์" → s2', r.length === 1 && r[0].id === 's2', 'n=' + r.length);

// ── 4. OR ──
r = idx.search('เวทมนตร์ OR ช็อกโกแลต');
check('OR → s1(ช็อกโกแลต)+s2(เวทมนตร์)', r.length === 2, 'n=' + r.length);

// ── 5. NOT ──
r = idx.search('เค้ก NOT เวทมนตร์');
check('NOT "เค้ก NOT เวทมนตร์" → s1 เท่านั้น', r.length === 1 && r[0].id === 's1', 'n=' + r.length + ' ids=' + r.map((x) => x.id));

// ── 6. field search ──
r = idx.search('status:เขียนเสร็จ');
check('field status:เขียนเสร็จ → s1', r.length === 1 && r[0].id === 's1', 'n=' + r.length);
r = idx.search('tags:เบเกอรี่');
check('field tags:เบเกอรี่ → s1+s3', r.length === 2, 'n=' + r.length + ' ids=' + r.map((x) => x.id));
r = idx.search('title:คาสซี่');
check('field title:คาสซี่ → s2', r.length === 1 && r[0].id === 's2', 'n=' + r.length);

// ── 7. field + term ผสม ──
r = idx.search('status:เขียนเสร็จ เค้ก');
check('field + term "status:เขียนเสร็จ เค้ก" → s1', r.length === 1 && r[0].id === 's1', 'n=' + r.length);

// ── 8. snippet + line number ──
r = idx.search('คาสซี่');
const s1hit = r.find((x) => x.id === 's1');
check('s1 มี snippet รอบ "คาสซี่"', s1hit && s1hit.matches.length >= 1 && /คาสซี่/.test(s1hit.matches[0].snippet), s1hit && s1hit.matches[0] && s1hit.matches[0].snippet);
check('s1 line number = 2 (คาสซี่อยู่บรรทัด 2)', s1hit && s1hit.matches[0].line === 2, s1hit && 'line=' + s1hit.matches[0].line);

// ── 9. score ranking: ชื่อเรื่องตรง → คะแนนสูงกว่า ──
r = idx.search('ทอร่า');
check('ranking: s1 (มีทอร่าในชื่อ) มาก่อน', r.length >= 1 && r[0].id === 's1', 'อันดับ=' + r.map((x) => x.id));

// ── 10. อังกฤษ ──
r = idx.search('bakery');
check('ค้นอังกฤษ "bakery" → s3 (และ s1 ไม่มีคำนี้)', r.some((x) => x.id === 's3'), 'ids=' + r.map((x) => x.id));

// ── 11. parseQuery AST ──
const ast = parseQuery('a AND b OR c');
check('parseQuery คืน AST', ast && ast.type === 'or');

// ── 12. คิวรีว่าง ──
check('คิวรีว่าง → []', idx.search('').length === 0 && idx.search('   ').length === 0);

// ── 13. Performance: 1,000 ไฟล์ ──
const big = [];
const words = ['ทอร่า', 'คาสซี่', 'เค้ก', 'เวทมนตร์', 'เบเกอรี่', 'ช็อกโกแลต', 'ร้าน', 'วันเกิด', 'ขนมปัง', 'กลิ่นหอม'];
for (let i = 0; i < 1000; i++) {
  let body = '';
  for (let j = 0; j < 40; j++) body += words[(i + j) % words.length] + (j % 8 === 7 ? '\n' : ' ');
  big.push({ id: 'd' + i, path: 'f/' + i + '.md', title: 'ฉาก ' + i, tags: [words[i % 10]], status: 'โครงร่าง', body });
}
let t0 = Date.now();
const bigIdx = new SearchIndex().build(big);       // สร้าง index ครั้งเดียว (cache ใน memory)
const buildMs = Date.now() - t0;
// วัดเวลา "ค้นหา" เฉลี่ยจากหลายคิวรี (นี่คือสิ่งที่ผู้ใช้สัมผัส — spec target < 500ms)
const queries = ['ทอร่า เค้ก', 'เวทมนตร์ OR ช็อกโกแลต', 'เบเกอรี่ NOT ร้าน', 'tags:คาสซี่', 'ขนมปัง'];
t0 = Date.now();
let totalHits = 0;
for (const q of queries) totalHits += bigIdx.search(q).length;
const searchMs = Date.now() - t0;
const avgMs = searchMs / queries.length;
check('perf: ค้นหาบน 1,000 ไฟล์ < 500ms', searchMs < 500, `${queries.length} คิวรี รวม ${searchMs}ms (เฉลี่ย ${avgMs.toFixed(1)}ms/คิวรี)`);
check('perf: index 1,000 ไฟล์ (ทำครั้งเดียว) < 2s', buildMs < 2000, `build=${buildMs}ms`);
check('perf: ผลค้นถูกต้องบน 1,000 ไฟล์', totalHits > 0);

console.log(`\nsearch-engine: ${pass} ผ่าน, ${fail} ล้มเหลว  [build ${buildMs}ms · search ${searchMs}ms]`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
