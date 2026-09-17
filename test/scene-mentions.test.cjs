// test/scene-mentions.test.cjs — [alpha.157] ฉากนี้กล่าวถึงอะไรบ้าง (แบ่งตามหมวด Wiki)
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_scenementions.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/scene-mentions.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const M = require(out);
let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (i !== '' ? ' | ' + i : '')); } };

const byCat = {
  characters: ['สมชาย', 'ชาย', 'สม', 'Al', 'Alice'],
  locations: ['ตลาดเก่า', 'ตลาด'],
  items: ['ดาบ'],
};
const fileOf = { 'สมชาย': 'c/somchai.json', 'ชาย': 'c/somchai.json', 'สม': 'c/som.json', Al: 'c/al.json', Alice: 'c/alice.json',
  'ตลาดเก่า': 'l/old.json', 'ตลาด': 'l/market.json', 'ดาบ': 'i/sword.json' };
const text = 'สมชายเดินเข้าตลาดเก่า ชายหนุ่มถือดาบ Alice also met Al. สมกลับบ้าน <!-- ดาบ -->';
const g = M.sceneMentions(text, byCat, fileOf, { titles: ['สมชาย', 'Alice', 'Al', 'สม', 'ตลาดเก่า', 'ตลาด', 'ดาบ'], order: ['characters', 'locations', 'items'] });
const cat = (c) => (g.find((x) => x.cat === c) || { items: [] }).items;
check('แบ่งตามหมวดตามลำดับที่ให้', g.map((x) => x.cat).join() === 'characters,locations,items', g.map((x) => x.cat).join());
const somchai = cat('characters').find((x) => x.file === 'c/somchai.json');
check('ชื่อเล่นรวมกับชื่อจริงของไฟล์เดียวกัน · ป้าย = ชื่อหลัก', !!somchai && somchai.count === 2 && somchai.name === 'สมชาย', JSON.stringify(somchai));
check('ชื่อสั้นไม่ถูกนับซ้อนในชื่อยาว ("สม" ใน "สมชาย")', cat('characters').find((x) => x.file === 'c/som.json').count === 1);
check('"ตลาด" ไม่ถูกนับซ้อนใน "ตลาดเก่า"', !cat('locations').some((x) => x.file === 'l/market.json'));
check('อังกฤษต้องไม่ติดคำอื่น (Al ≠ also / Alice)', cat('characters').find((x) => x.file === 'c/al.json').count === 1);
check('ไม่นับในคอมเมนต์', cat('items')[0].count === 1);
check('ข้อความว่าง = []', M.sceneMentions('', byCat, fileOf).length === 0);
check('ไม่มีใครถูกเอ่ยถึง = []', M.sceneMentions('ฝนตก', byCat, fileOf).length === 0);
console.log(`\nscene-mentions: ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
