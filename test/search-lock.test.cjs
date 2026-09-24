// test/search-lock.test.cjs — [alpha.164 · บั๊ก] ค้นแล้วแทนที่ต้องไม่แก้ฉากที่ล็อก (view.editable === false)
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_searchlock.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '_search-entry.mjs')], outfile: out,
  format: 'cjs', bundle: true, logLevel: 'silent' });
const S = require(out);
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const schema = new S.Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*' }, text: {} } });
const mkView = (editable) => {
  const v = {
    editable,
    state: S.EditorState.create({ doc: schema.node('doc', null, [schema.node('paragraph', null, [schema.text('แมว แมว หมา')])]),
                                  plugins: [S.searchPlugin()] }),
    dispatch(tr) { v.state = v.state.apply(tr); v.dispatched++; },
    focus() {}, dispatched: 0,
  };
  S.setQuery(v, 'แมว');
  return v;
};
{
  const v = mkView(false);
  const n = S.replaceAll(v, 'เสือ');
  check('ล็อก: แทนที่ทั้งหมด = 0 และไม่ dispatch', n === 0 && v.dispatched === 1 && v.state.doc.textContent === 'แมว แมว หมา',
        n + ' / ' + v.state.doc.textContent);
  check('ล็อก: แทนที่ทีละตัว = false', S.replaceCurrent(v, 'เสือ') === false && v.state.doc.textContent === 'แมว แมว หมา');
  check('ไม่มี view = ไม่พัง', S.replaceAll(null, 'x') === 0 && S.replaceCurrent(undefined, 'x') === false);
}
{
  const v = mkView(true);
  const n = S.replaceAll(v, 'เสือ');
  check('แก้ได้: แทนที่ทั้งหมดทำงานตามเดิม', n === 2 && v.state.doc.textContent === 'เสือ เสือ หมา', n + ' / ' + v.state.doc.textContent);
}
console.log('--- RESULT ---');
console.log(`PASS ${pass}  FAIL ${fail}`);
process.exit(fail ? 1 : 0);
