// test/template-vars.test.cjs — [alpha.126] `src/template-vars.js`
//
// ตัวแปร `{{ชื่อตัวละคร}}` / `{{ชื่อ.ช่อง}}` ในเวิร์กโฟลว์ส่งออก · โมดูลบริสุทธิ์
// (รับ `api` แบบ kapi เข้ามา ไม่แตะ fs/DOM เอง) แต่ยังไม่เคยมีเทสตรง
//
// จุดที่ต้องมีคนคุม: **กฎกันชื่อกำกวม** — ช่องชื่อเดียวกันที่โผล่ในหลายเอนทิตี้ต้องถูกตัดทิ้ง
// ไม่งั้น `{{age}}` จะได้อายุของใครก็ไม่รู้ (แล้วแต่ลำดับไฟล์ที่ระบบปฏิบัติการคืนมา)
require('./_lang.cjs');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_tplvars.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/template-vars.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const { buildVarContext, resolveVars } = require(out);

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

/** api ปลอมจากผังไฟล์ในหน่วยความจำ: { 'Wiki/characters/a.json': {...} } */
const mkApi = (tree) => ({
  join: async (...a) => a.join('/'),
  exists: async (p) => Object.keys(tree).some((k) => k === p || k.startsWith(p + '/')),
  listDirs: async (p) => [...new Set(Object.keys(tree)
    .filter((k) => k.startsWith(p + '/'))
    .map((k) => k.slice(p.length + 1).split('/')[0])
    .filter((n) => Object.keys(tree).some((k) => k.startsWith(p + '/' + n + '/'))))],
  listFiles: async (p, ext = '') => Object.keys(tree)
    .filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'))
    .map((k) => k.slice(p.length + 1))
    .filter((n) => !ext || n.endsWith(ext)),
  readJson: async (p) => { if (!(p in tree)) throw new Error('ENOENT'); return tree[p]; },
});

(async () => {
  // ───────── resolveVars: ตัวแทนที่ ─────────
  ck('แทนค่าตัวแปรที่รู้จัก', resolveVars('สวัสดี {{ทอร่า}}', { 'ทอร่า': 'ทอร่า' }) === 'สวัสดี ทอร่า');
  ck('★ ตัวแปรที่ไม่รู้จักคงไว้เหมือนเดิม (ไม่กลายเป็นช่องว่างเงียบ ๆ)',
     resolveVars('{{ไม่มีคนนี้}}', {}) === '{{ไม่มีคนนี้}}');
  ck('แทนหลายตัวในบรรทัดเดียว',
     resolveVars('{{a}} กับ {{b}}', { a: '1', b: '2' }) === '1 กับ 2');
  ck('รองรับชื่อไทย', resolveVars('{{ตัวละคร}}', { 'ตัวละคร': 'ก' }) === 'ก');
  ck('รองรับชื่อแบบมีจุด (ชื่อ.ช่อง)', resolveVars('{{ทอร่า.อายุ}}', { 'ทอร่า.อายุ': '25' }) === '25');
  ck('★ ค่า null ในบริบท = ถือว่าไม่มี (คงข้อความเดิม ไม่พิมพ์คำว่า null)',
     resolveVars('{{x}}', { x: null }) === '{{x}}');
  ck('ค่าเป็นเลข 0 ต้องแทนได้ (ไม่ใช่ falsy แล้วข้าม)', resolveVars('{{n}}', { n: 0 }) === '0');
  ck('ข้อความว่าง/undefined คืนสตริงว่าง', resolveVars('') === '' && resolveVars(undefined) === '');
  ck('ไม่มีตัวแปรเลยก็คืนข้อความเดิม', resolveVars('ข้อความธรรมดา', {}) === 'ข้อความธรรมดา');
  ck('วงเล็บปีกกาชั้นเดียวไม่ถูกแตะ', resolveVars('{x}', { x: '1' }) === '{x}');

  // ───────── buildVarContext ─────────
  {
    const ctx = await buildVarContext('/p', mkApi({
      '/p/Wiki/characters/tora.json': { name: 'ทอร่า', fields: { อายุ: 25, อาชีพ: 'คนทำขนม' } },
      '/p/Wiki/locations/shop.json': { name: 'ร้านเบเกอรี่', fields: { เมือง: 'เชียงใหม่' } },
    }));
    ck('ชื่อเอนทิตี้กลายเป็นตัวแปร', ctx['ทอร่า'] === 'ทอร่า' && ctx['ร้านเบเกอรี่'] === 'ร้านเบเกอรี่');
    ck('ช่องเข้าถึงแบบ ชื่อ.ช่อง ได้', ctx['ทอร่า.อายุ'] === '25', JSON.stringify(ctx['ทอร่า.อายุ']));
    ck('★ ค่าที่ไม่ใช่สตริงถูกแปลงเป็นสตริง', typeof ctx['ทอร่า.อายุ'] === 'string');
    ck('★ ชื่อช่องที่ไม่ซ้ำใครใช้แบบสั้นได้', ctx['อาชีพ'] === 'คนทำขนม' && ctx['เมือง'] === 'เชียงใหม่');
    ck('ข้ามหมวดได้ (อ่านทุกโฟลเดอร์ใน Wiki)', 'ร้านเบเกอรี่' in ctx);
  }
  {
    // ★ กฎกันกำกวม: 'อายุ' อยู่ในสองเอนทิตี้ → ต้องหายไป เหลือแต่แบบเต็ม
    const ctx = await buildVarContext('/p', mkApi({
      '/p/Wiki/characters/a.json': { name: 'ก', fields: { อายุ: 20 } },
      '/p/Wiki/characters/b.json': { name: 'ข', fields: { อายุ: 30 } },
    }));
    ck('★★ ชื่อช่องที่ซ้ำกันหลายเอนทิตี้ถูกตัดทิ้ง (กัน {{อายุ}} ได้ค่าของใครก็ไม่รู้)',
       !('อายุ' in ctx), JSON.stringify(ctx));
    ck('แต่แบบเต็มยังใช้ได้ทั้งคู่', ctx['ก.อายุ'] === '20' && ctx['ข.อายุ'] === '30');
  }
  {
    const ctx = await buildVarContext('/p', mkApi({
      '/p/Wiki/characters/ok.json': { name: 'ดี', fields: { x: '1' } },
      '/p/Wiki/characters/noname.json': { fields: { y: '2' } },       // ไม่มีชื่อ → ข้าม
      '/p/Wiki/characters/empty.json': null,                           // อ่านได้แต่ว่าง → ข้าม
    }));
    ck('★ เอนทิตี้ที่ไม่มีชื่อถูกข้าม ไม่ทำให้ทั้งชุดพัง', ctx['ดี'] === 'ดี' && !('y' in ctx),
       JSON.stringify(ctx));
  }
  {
    ck('ไม่มีโฟลเดอร์ Wiki = ได้บริบทว่าง (ไม่ throw)',
       Object.keys(await buildVarContext('/p', mkApi({ '/p/other.txt': 1 }))).length === 0);
  }
  {
    // ไฟล์พังหนึ่งใบต้องไม่ทำให้ทั้งชุดหาย
    const api = mkApi({ '/p/Wiki/characters/good.json': { name: 'ดี' } });
    const orig = api.readJson;
    api.readJson = async (p) => (p.includes('good') ? orig(p) : (() => { throw new Error('พัง'); })());
    api.listFiles = async () => ['bad.json', 'good.json'];
    const ctx = await buildVarContext('/p', api);
    ck('★ ไฟล์เอนทิตี้พังหนึ่งใบ ตัวอื่นยังใช้ได้', ctx['ดี'] === 'ดี', JSON.stringify(ctx));
  }

  // ───────── ต่อกันทั้งเส้น ─────────
  {
    const ctx = await buildVarContext('/p', mkApi({
      '/p/Wiki/characters/t.json': { name: 'ทอร่า', fields: { อาชีพ: 'คนทำขนม' } },
    }));
    ck('★ ใช้จริง: สร้างบริบทแล้วแทนค่าในข้อความได้ครบวง',
       resolveVars('{{ทอร่า}} เป็น {{ทอร่า.อาชีพ}}', ctx) === 'ทอร่า เป็น คนทำขนม',
       resolveVars('{{ทอร่า}} เป็น {{ทอร่า.อาชีพ}}', ctx));
  }

  console.log(`\ntemplate-vars: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
