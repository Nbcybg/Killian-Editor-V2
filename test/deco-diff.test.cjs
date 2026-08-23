// unit test ของ src/deco-diff.js — ส่วนต่าง decoration (บริสุทธิ์ ไม่ต้องเปิด electron)
require('./_lang.cjs');
const path = require('path');
const esbuild = require('esbuild');

const out = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'deco-diff.js')],
  bundle: true, format: 'cjs', write: false, platform: 'node',
});
const mod = {};
// eslint-disable-next-line no-new-func
new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, (mod.exports = {}), require);
const { attrsKey, decoKey, diffByKey } = mod.exports;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra === undefined ? '' : ' :: ' + extra)); }
}

// ── decoration ปลอมที่มีหน้าตาเหมือนของ ProseMirror พอให้ decoKey อ่านได้ ──
const D = (from, to, cls, spec) => ({ from, to, type: { attrs: { class: cls } }, spec });
const keys = (list) => list.map((d) => d.from + ':' + d.to + ':' + d.type.attrs.class).join(',');

// ---------- attrsKey ----------
check('attrsKey: ไม่มี attrs = คีย์ว่าง', attrsKey(null) === '' && attrsKey(undefined) === '');
check('attrsKey: ลำดับคีย์ไม่มีผล',
  attrsKey({ a: '1', b: '2' }) === attrsKey({ b: '2', a: '1' }));
check('attrsKey: ค่าต่างกัน คีย์ต้องต่างกัน',
  attrsKey({ class: 'a' }) !== attrsKey({ class: 'b' }));
// ★ กับดักคลาสสิก: ไม่มีตัวคั่นแล้ว {ab:'c'} กับ {a:'bc'} จะได้คีย์เดียวกัน
check('attrsKey: มีตัวคั่น — {ab:c} ไม่ชนกับ {a:bc}',
  attrsKey({ ab: 'c' }) !== attrsKey({ a: 'bc' }),
  attrsKey({ ab: 'c' }) + ' vs ' + attrsKey({ a: 'bc' }));

// ---------- decoKey ----------
check('decoKey: ตำแหน่ง+คลาสเท่ากัน = คีย์เท่ากัน',
  decoKey(D(1, 5, 'k-spell-bad')) === decoKey(D(1, 5, 'k-spell-bad')));
check('decoKey: ตำแหน่งต่าง = คีย์ต่าง',
  decoKey(D(1, 5, 'k-spell-bad')) !== decoKey(D(2, 5, 'k-spell-bad')));
check('decoKey: คลาสต่าง = คีย์ต่าง',
  decoKey(D(1, 5, 'k-spell-bad')) !== decoKey(D(1, 5, 'k-mention')));
check('decoKey: spec ต่าง = คีย์ต่าง (PM เทียบ spec ด้วย)',
  decoKey(D(1, 5, 'x', { id: 1 })) !== decoKey(D(1, 5, 'x', { id: 2 })));
// widget/ชนิดที่เทียบด้วย .eq ไม่ได้ → ต้องได้คีย์ที่ไม่ซ้ำ (ตกกลับไปถอด+ใส่ใหม่ = ถูกเสมอ)
const w = { from: 3, to: 3, type: {} };
check('decoKey: ชนิดที่ไม่มี attrs ได้คีย์ไม่ซ้ำเสมอ', decoKey(w) !== decoKey(w));

// ---------- diffByKey: กรณีพื้นฐาน ----------
{
  const same = [D(1, 4, 'a'), D(9, 12, 'a')];
  const { remove, add } = diffByKey(same, [D(1, 4, 'a'), D(9, 12, 'a')]);
  check('เหมือนกันทุกตัว → ไม่ต้องถอด ไม่ต้องใส่', remove.length === 0 && add.length === 0,
    remove.length + '/' + add.length);
}
{
  const { remove, add } = diffByKey([], [D(1, 4, 'a')]);
  check('ของเดิมว่าง → ใส่ทั้งหมด', remove.length === 0 && add.length === 1);
}
{
  const { remove, add } = diffByKey([D(1, 4, 'a')], []);
  check('ของใหม่ว่าง → ถอดทั้งหมด', remove.length === 1 && add.length === 0);
}
{
  const { remove, add } = diffByKey([], []);
  check('ว่างทั้งคู่ → ไม่ทำอะไร', remove.length === 0 && add.length === 0);
}

// ---------- diffByKey: ★ หัวใจ — พิมพ์หนึ่งตัวกลางย่อหน้ายักษ์ ----------
{
  // จำลอง: 2,000 คำผิด · mapping เลื่อนตำแหน่งให้แล้ว จึงเหมือนเดิมทุกตัว
  // ยกเว้นคำเดียวตรงจุดที่พิมพ์ (คำเดิมหายไป เกิดคำใหม่ยาวขึ้น 1)
  const old = [], next = [];
  for (let i = 0; i < 2000; i++) { old.push(D(i * 10, i * 10 + 4, 'k-spell-bad')); }
  for (let i = 0; i < 2000; i++) {
    if (i === 900) next.push(D(i * 10, i * 10 + 5, 'k-spell-bad'));   // คำที่ถูกพิมพ์แทรก
    else next.push(D(i * 10, i * 10 + 4, 'k-spell-bad'));
  }
  const { remove, add } = diffByKey(old, next);
  check('★ พิมพ์หนึ่งตัวในย่อหน้า 2,000 คำ → ส่วนต่างมีแค่ 1 ตัว',
    remove.length === 1 && add.length === 1, remove.length + '/' + add.length);
  check('★ …และเป็นคำที่จุดพิมพ์จริง ๆ',
    remove[0].from === 9000 && remove[0].to === 9004 &&
    add[0].from === 9000 && add[0].to === 9005,
    keys(remove) + ' → ' + keys(add));
}

// ---------- diffByKey: ผลลัพธ์สุดท้ายต้องเท่ากับ "ถอดทั้งชุดแล้วใส่ทั้งชุด" ----------
{
  // จำลอง DecorationSet ด้วย multiset ของคีย์ แล้วพิสูจน์ว่าสองทางให้ผลเดียวกันเป๊ะ
  const bag = (list) => list.map(decoKey).sort();
  const cases = [
    [[D(1, 3, 'a'), D(5, 7, 'a')], [D(1, 3, 'a'), D(6, 9, 'a')]],
    [[D(1, 3, 'a'), D(1, 3, 'a')], [D(1, 3, 'a')]],               // ซ้ำคีย์ (multiset)
    [[D(1, 3, 'a')], [D(1, 3, 'a'), D(1, 3, 'a')]],
    [[D(2, 4, 'a'), D(8, 9, 'b')], [D(8, 9, 'b'), D(2, 4, 'a')]], // สลับลำดับ = ไม่มีส่วนต่าง
    [[], [D(1, 2, 'a')]],
    [[D(1, 2, 'a')], []],
  ];
  let ok = true, why = '';
  for (const [old, next] of cases) {
    const { remove, add } = diffByKey(old, next);
    // ทางเดิม: (moved − oldIn) ∪ next   → ที่นี่ moved = old ล้วน จึงเหลือ next
    const wantBag = bag(next).join(',');
    // ทางใหม่: (old − remove) ∪ add
    const left = old.slice();
    for (const d of remove) left.splice(left.indexOf(d), 1);
    const gotBag = bag(left.concat(add)).join(',');
    if (wantBag !== gotBag) { ok = false; why = wantBag + ' vs ' + gotBag; break; }
  }
  check('★ ผลสุดท้ายเท่ากับวิธีเดิมทุกกรณี (รวมกรณีคีย์ซ้ำ/สลับลำดับ)', ok, why);
}

// ---------- ไม่รั่วเมื่อทำซ้ำหลายรอบ ----------
{
  let cur = [];
  for (let i = 0; i < 60; i++) cur.push(D(i * 6, i * 6 + 3, 'k-spell-bad'));
  for (let step = 0; step < 200; step++) {
    const next = cur.map((d) => D(d.from, d.to, 'k-spell-bad'));   // ผลสแกนรอบใหม่ (เหมือนเดิม)
    const { remove, add } = diffByKey(cur, next);
    const left = cur.slice();
    for (const d of remove) left.splice(left.indexOf(d), 1);
    cur = left.concat(add);
  }
  check('★ วน 200 รอบแล้วจำนวน decoration คงที่ (ไม่รั่วสะสม)', cur.length === 60, cur.length);
}

console.log('');
console.log('--- RESULT ---');
console.log('PASS ' + pass + '  FAIL ' + fail);
if (fail) process.exit(1);
