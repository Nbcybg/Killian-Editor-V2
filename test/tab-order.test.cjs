// test/tab-order.test.cjs — [alpha.161 · K2] ลำดับแท็บ: เพื่อนบ้านหลังปิด · วนแท็บ · ลากสลับ · tooltip
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-taborder-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'tab-order.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const T = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const K = ['a', 'b', 'c', 'd'];
// ── neighborAfterClose ──
check('★ ปิดแท็บกลางที่เลือกอยู่ → ไปเพื่อนบ้านขวา (ไม่ใช่ท้ายแถว)', T.neighborAfterClose(K, 'b', 'b') === 'c');
check('ปิดแท็บขวาสุดที่เลือกอยู่ → ไปซ้าย', T.neighborAfterClose(K, 'd', 'd') === 'c');
check('ปิดแท็บซ้ายสุดที่เลือกอยู่ → ไปขวา', T.neighborAfterClose(K, 'a', 'a') === 'b');
check('★ ปิดแท็บที่ไม่ได้เลือก → แท็บที่เลือกอยู่ไม่เปลี่ยน', T.neighborAfterClose(K, 'b', 'd') === 'd');
check('ปิดแท็บสุดท้าย → null', T.neighborAfterClose(['a'], 'a', 'a') === null);
check('ไม่มีแท็บที่เลือก → เพื่อนบ้านของตัวที่ปิด', T.neighborAfterClose(K, 'c', null) === 'd');
check('ปิดแท็บที่ไม่รู้จัก → ตัวท้าย', T.neighborAfterClose(K, 'x', null) === 'd');
check('รับค่าเพี้ยนได้ไม่ throw', T.neighborAfterClose(null, 'a', 'a') === null);
// ── cycleTab ──
check('Ctrl+Tab → ถัดไป', T.cycleTab(K, 'b', 1) === 'c');
check('★ Ctrl+Tab ที่ตัวท้าย → วนกลับตัวแรก', T.cycleTab(K, 'd', 1) === 'a');
check('Ctrl+Shift+Tab → ก่อนหน้า', T.cycleTab(K, 'c', -1) === 'b');
check('★ Ctrl+Shift+Tab ที่ตัวแรก → วนไปตัวท้าย', T.cycleTab(K, 'a', -1) === 'd');
check('แท็บเดียว → ตัวเดิม', T.cycleTab(['a'], 'a', 1) === 'a');
check('ไม่มีแท็บที่เลือก → ตัวแรก/ตัวท้ายตามทิศ', T.cycleTab(K, null, 1) === 'a' && T.cycleTab(K, null, -1) === 'd');
check('ไม่มีแท็บเลย → null', T.cycleTab([], 'a', 1) === null);
// ── moveTabBefore ──
check('★ ลากไปไว้ก่อนแท็บอื่น', T.moveTabBefore(K, 'd', 'b').join('') === 'adbc');
check('ลากไปท้ายแถว (null)', T.moveTabBefore(K, 'a', null).join('') === 'bcda');
check('ลากไปขวา (ก่อนตัวถัดจากตัวถัดไป)', T.moveTabBefore(K, 'a', 'c').join('') === 'bacd');
check('ลากทับตัวเอง = ลำดับเดิม', T.moveTabBefore(K, 'b', 'b').join('') === 'abcd');
check('ไม่แก้อาร์เรย์เดิม', T.moveTabBefore(K, 'd', 'a') !== K && K.join('') === 'abcd');
check('แท็บไม่รู้จัก = ลำดับเดิม', T.moveTabBefore(K, 'x', 'a').join('') === 'abcd');
// ── tabsRightOf ──
check('แท็บทางขวา', T.tabsRightOf(K, 'b').join('') === 'cd' && T.tabsRightOf(K, 'd').length === 0 && T.tabsRightOf(K, 'x').length === 0);
// ── tabPathParts ──
const pp = T.tabPathParts('C:\\p\\ร้าน', 'C:\\p\\ร้าน\\เล่ม1\\Draft\\หลัก\\Chapters\\01 - เปิดร้าน\\scene-01.md');
check('★ tooltip: ทางสัมพัทธ์ + เล่ม + บท (Windows)', pp.rel === 'เล่ม1/Draft/หลัก/Chapters/01 - เปิดร้าน/scene-01.md'
      && pp.book === 'เล่ม1' && pp.chapter === '01 - เปิดร้าน', JSON.stringify(pp));
const pw = T.tabPathParts('/p', '/p/Bible/characters/a.json');
check('ไฟล์นอกเล่ม (Wiki) = ไม่มีเล่ม/บท', pw.rel === 'Bible/characters/a.json' && !pw.book && !pw.chapter, JSON.stringify(pw));
check('แท็บพิเศษ (::) = ว่าง', T.tabPathParts('/p', '::dashboard::').rel === '');
check('ไม่สนตัวพิมพ์ของราก', T.tabPathParts('C:/P', 'c:/p/Memos/m.md').rel === 'Memos/m.md');

// ══ [alpha.162 · W4 ข้อ 11] เปิดแท็บที่เพิ่งปิด · ปักหมุด ══
{
  let st = [];
  st = T.pushClosed(st, '/p/a.md', '/p');
  st = T.pushClosed(st, '/p/b.md', '/p');
  st = T.pushClosed(st, '::snap::x', '/p');
  check('[162-W4] แท็บพิเศษ (::) ไม่เข้ากองแท็บที่ปิด', st.length === 2, JSON.stringify(st));
  st = T.pushClosed(st, '/p/a.md', '/p');
  check('[162-W4] ปิดไฟล์เดิมซ้ำ = ย้ายขึ้นบนสุด ไม่ซ้ำสองแถว', st.length === 2 && st[1].file === '/p/a.md');
  let r = T.takeReopen(st, '/p', []);
  check('[162-W4] ★ เปิดคืน = ตัวที่ปิดล่าสุดก่อน', r.file === '/p/a.md' && r.rest.length === 1, JSON.stringify(r));
  r = T.takeReopen(r.rest, '/p', []);
  check('[162-W4] กดซ้ำ = ย้อนไปอีกตัว', r.file === '/p/b.md' && r.rest.length === 0);
  check('[162-W4] กองว่าง = null', T.takeReopen(r.rest, '/p', []).file === null);
  let s2 = T.pushClosed(T.pushClosed([], '/q/x.md', '/q'), '/p/y.md', '/p');
  check('[162-W4] ★ ไม่เปิดไฟล์ของโปรเจกต์อื่นคืน', T.takeReopen(s2, '/q', []).file === '/q/x.md'
        && T.takeReopen([{ file: '/q/x.md', root: '/q' }], '/p', []).file === null);
  s2 = T.pushClosed(T.pushClosed([], '/p/a.md', '/p'), '/p/b.md', '/p');
  check('[162-W4] ตัวที่เปิดอยู่แล้วถูกข้าม', T.takeReopen(s2, '/p', ['/p/b.md']).file === '/p/a.md');
  let big = [];
  for (let i = 0; i < 30; i++) big = T.pushClosed(big, '/p/' + i, '/p');
  check('[162-W4] กองจำกัดขนาด (ใหม่สุดอยู่)', big.length === 20 && big[19].file === '/p/29');
  check('[162-W4] ★ หมุดอยู่หน้าแถวเสมอ ลำดับในกลุ่มคงเดิม',
        JSON.stringify(T.pinnedFirst(['a', 'b', 'c', 'd'], ['c', 'a'])) === JSON.stringify(['a', 'c', 'b', 'd']));
  check('[162-W4] ไม่มีหมุด = ลำดับเดิม', JSON.stringify(T.pinnedFirst(K, [])) === JSON.stringify(K));
  check('[162-W4] ★ ปิดแท็บอื่น/ทางขวา ไม่แตะแท็บที่ปักหมุด',
        JSON.stringify(T.closableOf(['a', 'b', 'c'], new Set(['b']))) === JSON.stringify(['a', 'c']));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
