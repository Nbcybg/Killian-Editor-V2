// test/tag-tree.test.cjs — [alpha.159 · M35] ต้นไม้แท็กลำดับชั้น: ตัวแม่ต้องได้ผลรวมของลูกหลาน
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-tagtree-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'tag-tree.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const T = require(tmp);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const tr = T.buildTagTree({ 'a:b:c': 3, 'a:b:d': 1, 'a:e': 2, 'x': 5, 'a': 1 });
check('★ a:b:c → ตัวแม่ a และ a:b มี count > 0', tr.a.count > 0 && tr.a.children['a:b'].count > 0);
check('★ a:b = ผลรวมของ c + d', tr.a.children['a:b'].count === 4, tr.a.children['a:b'].count);
check('★ a = ของตัวเอง (1) + ลูกหลานทั้งหมด (3+1+2)', tr.a.count === 7 && tr.a.own === 1, JSON.stringify([tr.a.count, tr.a.own]));
check('ใบเก็บค่าของตัวเอง', tr.a.children['a:b'].children['a:b:c'].count === 3 && tr.a.children['a:b'].children['a:b:c'].own === 3);
const top = T.sortedTagEntries(tr).map((e) => e[0]);
check('★ เรียงมาก→น้อย: a (7) มาก่อน x (5) — ตัวแม่ไม่ห้อยท้ายอีก', top.join() === 'a,x', top.join());
const kids = T.sortedTagEntries(tr.a.children).map((e) => e[0]);
check('ลูกเรียงมาก→น้อย: a:b (4) ก่อน a:e (2)', kids.join() === 'a:b,a:e', kids.join());
check('แท็กว่าง/ส่วนว่าง ไม่พัง', Object.keys(T.buildTagTree({ '': 3, 'p::q': 1 })).join() === 'p');
check('ไม่มีข้อมูล = ต้นไม้ว่าง', Object.keys(T.buildTagTree(null)).length === 0);
console.log(`\ntag-tree: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
