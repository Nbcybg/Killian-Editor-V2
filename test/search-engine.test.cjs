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

// ── [alpha.161 · C3] indexProject: โฟลเดอร์สำเนา (ถังขยะ/ประวัติ/สำรอง) ต้องไม่ถูกนับ ──
(async () => {
  const P = (...x) => x.join('/');
  const tree = {
    '/r': { dirs: ['Book', 'Recycle', 'snapshots', 'Backups'], files: ['note.md'] },
    '/r/Book': { dirs: ['Recycle'], files: ['a.md', 'b.json'] },
    '/r/Book/Recycle': { dirs: [], files: ['inner.md'] },            // ชื่อซ้ำแต่อยู่ลึก = ไม่ใช่ถังขยะของโปรเจกต์
    '/r/Recycle': { dirs: [], files: ['ghost.md'] },
    '/r/snapshots': { dirs: [], files: ['old.md'] },
    '/r/Backups': { dirs: [], files: ['bak.md'] },
  };
  const fakeKapi = {
    listDirs: async (d) => (tree[d] || { dirs: [] }).dirs,
    listFiles: async (d) => (tree[d] || { files: [] }).files,
    join: async (...x) => P(...x),
    readFile: async (f) => 'เนื้อ ' + f.split('/').pop(),
  };
  const parse = (raw) => ({ meta: {}, body: raw });
  const all = await SE.indexProject('/r', fakeKapi, parse, {});
  check('indexProject: ไม่ระบุ skipDirs = เข้าทุกโฟลเดอร์ (พฤติกรรมเดิม)', all.stats().documents === 6, all.stats().documents);
  const cut = await SE.indexProject('/r', fakeKapi, parse, { skipDirs: ['Recycle', 'Snapshots', 'Backups'] });
  const ids = cut.search('เนื้อ').map((r) => r.path).sort();
  check('★ indexProject: ข้ามถังขยะ/Snapshots/Backups ชั้นบน (ไม่สนตัวพิมพ์)',
        !ids.some((x) => /\/r\/(Recycle|snapshots|Backups)\//.test(x)), ids.join(','));
  check('indexProject: โฟลเดอร์ชื่อซ้ำที่อยู่ลึกยังถูกนับ', ids.includes('/r/Book/Recycle/inner.md'), ids.join(','));
  check('indexProject: ไฟล์งานปกติยังอยู่ครบ', ids.includes('/r/note.md') && ids.includes('/r/Book/a.md') && cut.stats().documents === 3,
        cut.stats().documents);
  // [alpha.162 · W5 ข้อ 2] ยกเลิกได้ + ความคืบหน้า
  {
    let err = null;
    try { await SE.indexProject('/r', fakeKapi, parse, { signal: { aborted: true } }); } catch (e) { err = e; }
    check('★ [162-W5] indexProject: signal ถูกยกเลิก → โยน error ยกเลิก (ไม่ได้ดัชนีครึ่ง ๆ)', !!err && err.k2Cancelled === true, String(err));
    const sig = { aborted: false };
    let n = 0;
    const slowKapi = { ...fakeKapi, readFile: async (f) => { n++; if (n === 2) sig.aborted = true; return 'x ' + f; } };
    let err2 = null;
    try { await SE.indexProject('/r', slowKapi, parse, { signal: sig }); } catch (e) { err2 = e; }
    check('★ [162-W5] indexProject: ยกเลิกกลางทาง = หยุดก่อนอ่านไฟล์ถัดไป', !!err2 && err2.k2Cancelled === true && n === 2, 'อ่านไป ' + n);
    const big = {};
    big['/b'] = { dirs: [], files: Array.from({ length: 25 }, (_, i) => 'f' + i + '.md') };
    const bigKapi = { ...fakeKapi, listDirs: async (d) => (big[d] || { dirs: [] }).dirs, listFiles: async (d) => (big[d] || { files: [] }).files };
    const seen = [];
    await SE.indexProject('/b', bigKapi, parse, { onProgress: (k) => seen.push(k) });
    check('[162-W5] indexProject: บอกจำนวนไฟล์ที่อ่านแล้วทุก 10 ไฟล์', seen.join(',') === '10,20', seen.join(','));
    let ok = true;
    try { await SE.indexProject('/b', bigKapi, parse, { onProgress: () => { throw new Error('ui พัง'); } }); } catch { ok = false; }
    check('[162-W5] ตัวรายงานความคืบหน้าพัง ไม่ทำให้การสร้างดัชนีล้ม', ok);
  }
  const withJson = await SE.indexProject('/r', fakeKapi, parse, { includeJson: true, skipDirs: ['Recycle'] });
  check('indexProject: includeJson + skipDirs ใช้ร่วมกันได้', withJson.stats().documents === 6, withJson.stats().documents);

  // ── searchPathMatters: ตัวตัดสินว่าการเขียน/ย้าย/ลบไฟล์นี้ต้องล้างดัชนีไหม ──
  const M = SE.searchPathMatters;
  check('matters: ฉาก .md ใต้โปรเจกต์', M('C:\\p', 'C:\\p\\Book\\Draft\\x\\Chapters\\01\\s.md') === true);
  check('matters: Wiki .json ใต้โปรเจกต์ (ทับ/ต่างตัวคั่นได้)', M('C:/p/', 'C:\\p\\Bible\\characters\\a.json') === true);
  check('matters: ไม่สนตัวพิมพ์ของราก (Windows)', M('C:/P', 'c:/p/Memos/m.MD') === true);
  check('matters: ไฟล์ในถังขยะ/Snapshots/Backups = ไม่ต้องล้าง', !M('/p', '/p/Recycle/x.md') && !M('/p', '/p/snapshots/a__b/1.md') && !M('/p', '/p/Backups/2026/a.json'));
  check('matters: ไฟล์ที่ไม่ใช่ .md/.json (รูป · csv) = ไม่ต้องล้าง', !M('/p', '/p/Images/a.png') && !M('/p', '/p/x/s_vis.csv'));
  check('matters: นอกโปรเจกต์ / โปรเจกต์ชื่อขึ้นต้นเหมือนกัน = ไม่ต้องล้าง', !M('/p', '/other/a.md') && !M('/p', '/p2/a.md'));
  check('matters: ไม่มีราก/ไม่มี path = false', !M('', '/p/a.md') && !M('/p', ''));
  check('SEARCH_SKIP_DIRS มีครบโฟลเดอร์สำเนา (+ OnSet alpha.164)', ['Recycle', 'Snapshots', 'Backups', 'OnSet'].every((d) => SE.SEARCH_SKIP_DIRS.includes(d)));

  // ── [alpha.161 · S] highlightTerms / splitHighlight / matchDetail ──
  const HT = SE.highlightTerms;
  check('highlightTerms: คำเดียว', JSON.stringify(HT('ทอร่า')) === '["ทอร่า"]');
  check('highlightTerms: AND/OR เอาทุกคำฝั่งบวก เรียงยาวก่อน', JSON.stringify(HT('เค้ก OR ช็อกโกแลต ร้าน')) === '["ช็อกโกแลต","เค้ก","ร้าน"]', JSON.stringify(HT('เค้ก OR ช็อกโกแลต ร้าน')));
  check('highlightTerms: ไม่เอาคำใต้ NOT', JSON.stringify(HT('เบเกอรี่ NOT ร้าน')) === '["เบเกอรี่"]', JSON.stringify(HT('เบเกอรี่ NOT ร้าน')));
  check('highlightTerms: ไม่เอาค่าของ field:', JSON.stringify(HT('tags:คาสซี่ ขนม')) === '["ขนม"]', JSON.stringify(HT('tags:คาสซี่ ขนม')));
  check('highlightTerms: วลีในเครื่องหมายคำพูดเป็นก้อนเดียว', HT('"ร้าน เค้ก"').includes('ร้าน เค้ก'));
  check('highlightTerms: ซ้ำไม่สนตัวพิมพ์ = ตัวเดียว · ว่าง = []', HT('Cake cake').length === 1 && HT('').length === 0);

  const SH = SE.splitHighlight;
  const sh1 = SH('ทอร่าไปร้าน ทอร่ากลับ', ['ทอร่า']);
  check('splitHighlight: ครอบทุกจุดที่เจอ', sh1.filter((x) => x.hl).length === 2 && sh1.map((x) => x.text).join('') === 'ทอร่าไปร้าน ทอร่ากลับ', JSON.stringify(sh1));
  const sh2 = SH('Cake and CAKE', ['cake']);
  check('splitHighlight: ไม่สนตัวพิมพ์ + คงตัวพิมพ์เดิม', sh2.filter((x) => x.hl).map((x) => x.text).join(',') === 'Cake,CAKE', JSON.stringify(sh2));
  const sh3 = SH('ช็อกโกแลตร้อน', ['ช็อก', 'ช็อกโกแลต']);
  check('splitHighlight: คำยาวชนะคำสั้นที่ซ้อนกัน', sh3[0].hl && sh3[0].text === 'ช็อกโกแลต', JSON.stringify(sh3));
  check('splitHighlight: ไม่มีคำ = ช่วงเดียวไม่ไฮไลต์', JSON.stringify(SH('abc', [])) === '[{"text":"abc","hl":false}]');
  check('splitHighlight: ข้อความที่มีแท็ก HTML คืนเป็นตัวอักษรตามจริง (ไม่ตีความ)', SH('<b>x</b>', ['x']).map((x) => x.text).join('') === '<b>x</b>');

  const MD = SE.matchDetail;
  const body = 'บรรทัดแรก\n\nทอร่าเดินไป\nแล้วทอร่าก็กลับ';
  const p2 = body.indexOf('ทอร่า', 15);
  const d2 = MD(body, p2 + 1, 2, ['ทอร่า']);      // token ไทยเป็นแค่ส่วนกลางของคำ
  check('matchDetail: คืนคำค้นเต็มที่ครอบ token', d2.term === 'ทอร่า' && d2.start === p2, JSON.stringify(d2));
  check('matchDetail: nth = ครั้งที่เท่าไรใน body (0-based)', d2.nth === 1, d2.nth);
  check('matchDetail: เลขบรรทัด + ข้อความบรรทัด', d2.line === 4 && d2.lineText === 'แล้วทอร่าก็กลับ', JSON.stringify(d2));
  const d1 = MD(body, body.indexOf('ทอร่า'), 5, ['ทอร่า']);
  check('matchDetail: ครั้งแรก nth=0 · บรรทัด 3', d1.nth === 0 && d1.line === 3, JSON.stringify(d1));
  const d3 = MD('Hello WORLD world', 12, 5, []);
  check('matchDetail: ไม่มีคำค้น = ใช้ token ที่เจอ · nth ไม่สนตัวพิมพ์', d3.term === 'world' && d3.nth === 1, JSON.stringify(d3));
  // ═══════════ [alpha.162 · W1-1] indexMatches — ดัชนี/งานที่วิ่งอยู่ ใช้กับคำขอนี้ได้ไหม ═══════════
  {
    const IM = SE.indexMatches;
    const A = { root: 'C:/proj-a', json: false, stale: false };
    check('W1-1: โปรเจกต์+ขอบเขตตรง และไม่ล้าสมัย = ใช้ได้', IM(A, { root: 'C:/proj-a', json: false }) === true);
    check('W1-1: ★★ คนละโปรเจกต์ = ใช้ไม่ได้ (สลับโปรเจกต์ระหว่างสร้างดัชนี)',
          IM(A, { root: 'C:/proj-b', json: false }) === false);
    check('W1-1: ★★ ขอรวม .json แต่ของที่มีไม่รวม = ใช้ไม่ได้ (เดิมคืนไปแล้วค้นไฟล์ .json ไม่เจอ)',
          IM(A, { root: 'C:/proj-a', json: true }) === false);
    check('W1-1: ของที่รวม .json ใช้ตอบคำขอที่ไม่รวมไม่ได้ (ขอบเขตต้องตรงกัน)',
          IM({ root: 'C:/proj-a', json: true, stale: false }, { root: 'C:/proj-a', json: false }) === false);
    check('W1-1: ล้าสมัยแล้ว = ใช้ไม่ได้แม้ตรงทุกช่อง',
          IM({ ...A, stale: true }, { root: 'C:/proj-a', json: false }) === false);
    check('W1-1: ไม่มีของถืออยู่ = ใช้ไม่ได้', IM(null, { root: 'C:/proj-a', json: false }) === false);
    check('W1-1: json ที่เป็น undefined เทียบเท่า false', IM({ root: 'C:/p', stale: false }, { root: 'C:/p', json: false }) === true);
  }

  const idxS = new SearchIndex().build([{ id: 'a', path: 'a.md', title: 'x', body: 'หนึ่ง\nสอง qqz\nqqz สาม' }]);
  const mS = idxS.search('qqz')[0].matches[0];
  check('search: match มี len ของ token ที่เจอ', mS.len === 3 && mS.line === 2, JSON.stringify(mS));

  console.log(`\nsearch-engine: ${pass} ผ่าน, ${fail} ล้มเหลว  [build ${buildMs}ms · search ${searchMs}ms]`);
  console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})();
