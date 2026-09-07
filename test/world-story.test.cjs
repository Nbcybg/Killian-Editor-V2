// test/world-story.test.cjs — ทดสอบ auto-link (ข้อ 86) ด้วย node
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_wsl.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/world-story/auto-link.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const WS = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

const E = [
  { id: 'characters/cat.json', name: 'ยัยแมวเก้าชีวิต', aliases: ['แมวดำ'] },
  { id: 'characters/tora.json', name: 'โทระ', aliases: [] },
  { id: 'locations/market.json', name: 'ตลาดเก่า', aliases: [] },
  { id: 'characters/cat2.json', name: 'Cat', aliases: [] },
  { id: 'items/x.json', name: 'ก', aliases: [] },              // สั้นเกิน → ต้องถูกข้าม
];
const ids = (r) => r.map((x) => x.entityId).sort().join();

// ── stripMeta ──
check('stripMeta ตัด front-matter', WS.stripMeta('---\ntitle: โทระ\n---\n\nเนื้อเรื่อง').trim() === 'เนื้อเรื่อง',
  JSON.stringify(WS.stripMeta('---\ntitle: โทระ\n---\n\nเนื้อเรื่อง')));
check('stripMeta ตัดบล็อกโค้ด', !WS.stripMeta('ก่อน\n```\nโทระ\n```\nหลัง').includes('โทระ'));
check('stripMeta ตัดโค้ดในบรรทัด', !WS.stripMeta('พิมพ์ `โทระ` ไว้').includes('โทระ'));
check('ชื่อใน front-matter ไม่นับเป็นการกล่าวถึง',
  WS.extractLinks('---\ntitle: โทระ\n---\n\nไม่มีใครอยู่', E).length === 0);

// ── entityTerms ──
const terms = WS.entityTerms(E[0]);
check('entityTerms: name + alias', terms.length === 2 && terms[0].via === 'name');
check('entityTerms เรียงยาวก่อนสั้น', terms[0].term.length >= terms[1].term.length);
check('entityTerms ข้ามชื่อสั้นกว่า 2 ตัวอักษร', WS.entityTerms(E[4]).length === 0);

// ── extractLinks: ยาวก่อนสั้น + ไม่ทับซ้อน ──
let r = WS.extractLinks('วันนั้น ยัยแมวเก้าชีวิต เดินมาเจอ โทระ ที่ ตลาดเก่า', E);
check('เจอ 3 เอนทิตี้', ids(r) === 'characters/cat.json,characters/tora.json,locations/market.json', ids(r));
check('ชื่อสั้น "ก" ไม่ถูกจับ', !r.some((x) => x.entityId === 'items/x.json'));

// ชื่อสั้นซ้อนอยู่ในชื่อยาว → ตัวยาวต้องชนะ และตัวสั้นต้องไม่ถูกนับซ้ำที่เดียวกัน
const E2 = [{ id: 'long', name: 'ยัยแมวเก้าชีวิต' }, { id: 'short', name: 'แมว' }];
const ov = WS.extractLinks('ยัยแมวเก้าชีวิต ยืนอยู่', E2);
check('ยาวก่อนสั้น: จับ "ยัยแมวเก้าชีวิต" ตัวเดียว', ov.length === 1 && ov[0].entityId === 'long', JSON.stringify(ov));
const ov2 = WS.extractLinks('ยัยแมวเก้าชีวิต กับ แมว ตัวอื่น', E2);
check('ชื่อสั้นยังจับได้เมื่ออยู่นอกช่วงที่ถูกจอง', ov2.length === 2 && ov2.find((x) => x.entityId === 'short').count === 1, JSON.stringify(ov2));

r = WS.extractLinks('โทระ พูดกับ โทระ อีกครั้ง แล้ว โทระ ก็ไป', E);
check('นับจำนวนครั้งถูก (3)', r[0].count === 3 && r[0].via === 'name', JSON.stringify(r));

r = WS.extractLinks('แมวดำ เดินผ่าน', E);
check('จับจาก alias ได้ (via=alias)', r.length === 1 && r[0].via === 'alias');

// ── [[ลิงก์]] ──
r = WS.extractLinks('เมื่อ [[โทระ]] มาถึง', E);
check('[[ชื่อ]] → via=link', r.length === 1 && r[0].via === 'link' && r[0].count === 1, JSON.stringify(r));
r = WS.extractLinks('[[โทระ|เขา]] เดินเข้ามา', E);
check('[[ชื่อ|ข้อความ]] รองรับ', r.length === 1 && r[0].entityId === 'characters/tora.json');
r = WS.extractLinks('[[โทระ]] และ โทระ', E);
check('ลิงก์ + ชื่อธรรมดา นับรวมไม่ซ้ำซ้อน (2 ครั้ง)', r[0].count === 2 && r[0].via === 'link', JSON.stringify(r));
check('[[ไม่รู้จัก]] → ไม่พัง ไม่นับ', WS.extractLinks('[[ใครก็ไม่รู้]]', E).length === 0);

// ── ขอบคำภาษาอังกฤษ ──
check('อังกฤษเช็คขอบคำ: "category" ไม่โดนจับเป็น Cat', WS.extractLinks('the category list', E).length === 0);
check('อังกฤษจับได้เมื่อเป็นคำเดี่ยว', WS.extractLinks('a Cat walked in', E)[0].entityId === 'characters/cat2.json');

// ── buildIndex / backlinks ──
const scenes = [
  { id: 'sc1', title: 'ตลาดเก่า', chapterId: 'c1', text: 'โทระ เจอ ยัยแมวเก้าชีวิต ที่ ตลาดเก่า' },
  { id: 'sc2', title: 'บ้านเก่า', chapterId: 'c1', text: 'โทระ นั่งอยู่คนเดียว โทระ คิดถึงเธอ' },
  { id: 'sc3', title: 'ว่างเปล่า', chapterId: 'c2', text: 'ไม่มีใครในฉากนี้' },
];
const idx = WS.buildIndex(E, scenes);
check('backlinks ของ โทระ = 2 ฉาก', idx.backlinks['characters/tora.json'].sort().join() === 'sc1,sc2');
check('forward ของ sc1 = 3 เอนทิตี้', idx.forward.sc1.length === 3, JSON.stringify(idx.forward.sc1));
check('ฉากที่ไม่มีใคร → ไม่อยู่ใน forward', !('sc3' in idx.forward));
check('hits เก็บจำนวนครั้ง', idx.hits['characters/tora.json'].sc2.count === 2);

// ── AutoLink API ──
const al = new WS.AutoLink({});
al.build(E, scenes);
check('getBacklinks คืน sceneIds', al.getBacklinks('characters/tora.json').join() === 'sc2,sc1',
  al.getBacklinks('characters/tora.json').join());
check('getBacklinks เรียงตามความถี่ (sc2 มี 2 ครั้ง มาก่อน)', al.getBacklinks('characters/tora.json')[0] === 'sc2');
check('getBacklinks ของที่ไม่มี → []', al.getBacklinks('ไม่มีจริง').length === 0);
const rel = al.getRelatedScenes('characters/tora.json');
check('getRelatedScenes พก title/chapterId/count', rel[0].title === 'บ้านเก่า' && rel[0].chapterId === 'c1' && rel[0].count === 2,
  JSON.stringify(rel[0]));
check('getEntitiesInScene (ทางกลับ)', al.getEntitiesInScene('sc1').length === 3);
check('coOccurring: แมว+ตลาด โผล่ฉากเดียวกับโทระ', al.coOccurring('characters/tora.json').map((c) => c.shared).join() === '1,1');
check('stats นับได้', al.stats().scenes === 2 && al.stats().entities === 3, JSON.stringify(al.stats()));

// ── ปะรายฉาก (updateScene / removeScene / removeEntity) ──
al.updateScene({ id: 'sc2', title: 'บ้านเก่า', chapterId: 'c1', text: 'ไม่มีใครแล้ว' });
check('updateScene: ลบการเชื่อมเก่าของฉากนั้นทิ้ง', al.getBacklinks('characters/tora.json').join() === 'sc1');
al.updateScene({ id: 'sc4', title: 'ใหม่', chapterId: 'c2', text: 'แมวดำ กลับมา' });
check('updateScene: ฉากใหม่เข้าดัชนี', al.getBacklinks('characters/cat.json').sort().join() === 'sc1,sc4');
check('updateScene: title ฉากใหม่ถูกจำ', al.getRelatedScenes('characters/cat.json').some((s) => s.title === 'ใหม่'));
al.removeScene('sc1');
check('removeScene ถอดออกทุกที่', al.getBacklinks('locations/market.json').length === 0 && al.getEntitiesInScene('sc1').length === 0);
al.removeEntity('characters/cat.json');
check('removeEntity ถอดออกทุกที่', al.getBacklinks('characters/cat.json').length === 0 && al.getEntitiesInScene('sc4').length === 0);

// ── บันทึกลง project.khn.json + โหลดกลับ ──
const meta = { title: 'ทดสอบ' };
const al2 = new WS.AutoLink({ meta });
al2.build(E, scenes);
const stored = al2.persist();
check('persist เขียน meta.backlinks', meta.backlinks && Array.isArray(meta.backlinks['characters/tora.json']));
check('รูปแบบตรง spec { entityId: [sceneIds] }',
  JSON.stringify(stored['characters/tora.json']) === JSON.stringify(['sc2', 'sc1']), JSON.stringify(stored));
check('persist เขียนได้เมื่อ meta = null → null', new WS.AutoLink({}).persist() === null);
const al3 = new WS.AutoLink({ meta });
check('load อ่านกลับจาก meta', al3.load() && al3.getBacklinks('characters/tora.json').sort().join() === 'sc1,sc2');
check('load สร้าง forward กลับให้ด้วย', al3.getEntitiesInScene('sc1').length === 3, JSON.stringify(al3.getEntitiesInScene('sc1')));
check('round-trip: backlinks เท่าเดิม', JSON.stringify(WS.toBacklinks(WS.fromBacklinks(stored))) === JSON.stringify(
  Object.fromEntries(Object.keys(stored).sort().map((k) => [k, [...stored[k]].sort()]))), JSON.stringify(WS.toBacklinks(WS.fromBacklinks(stored))));

// ── collectEntities / collectScenes ด้วย mock io ──
const FS = {
  dirs: {
    'R': ['เล่มหนึ่ง', 'Wiki', 'Images'],
    'R/Wiki': ['characters', 'locations'],
    'R/เล่มหนึ่ง/Draft': ['default'],
  },
  files: {
    'R/Wiki/characters': ['cat.json', 'note.txt'],
    'R/Wiki/locations': ['market.json'],
  },
  json: {
    'R/Wiki/characters/cat.json': { name: 'ยัยแมวเก้าชีวิต', aliases: ['แมวดำ'], entityTypeKey: 'characters' },
    'R/Wiki/locations/market.json': { name: 'ตลาดเก่า' },
    'R/เล่มหนึ่ง/Draft/default/draft.json': { chapters: [{ guid: 'c1', folderName: '01 - บทที่หนึ่ง' }] },
    'R/เล่มหนึ่ง/Draft/default/scenes.json': { chapters: { c1: [{ id: 'sc1', title: 'ตลาดเก่า', fileName: 'scene-01.md' }] } },
  },
  text: { 'R/เล่มหนึ่ง/Draft/default/Chapters/01 - บทที่หนึ่ง/scene-01.md': '---\ntitle: ตลาดเก่า\n---\n\nโทระ เจอ แมวดำ' },
};
const io = {
  join: (...p) => p.join('/'),
  listDirs: async (p) => { if (!(p in FS.dirs)) throw new Error('ENOENT ' + p); return FS.dirs[p]; },
  listFiles: async (p) => FS.files[p] || [],
  readJson: async (p) => FS.json[p] || null,
  readFile: async (p) => (p in FS.text ? FS.text[p] : null),
};
(async () => {
  const ents = await WS.collectEntities(io, 'R');
  check('collectEntities อ่าน Wiki ครบ 2 หมวด', ents.length === 2, JSON.stringify(ents.map((e) => e.id)));
  check('collectEntities: id = หมวด/ไฟล์', ents[0].id === 'characters/cat.json' && ents[0].aliases.join() === 'แมวดำ');
  check('collectEntities ข้ามไฟล์ที่ไม่ใช่ .json', !ents.some((e) => e.id.endsWith('.txt')));
  check('Bible/ ไม่มี (listDirs throw) → ข้ามเงียบ ๆ ได้ของครบ', ents.some((e) => e.name === 'ตลาดเก่า'));

  const scs = await WS.collectScenes(io, 'R');
  check('collectScenes อ่านฉากจาก Chapters/<folderName>', scs.length === 1 && scs[0].id === 'sc1', JSON.stringify(scs.map((s) => s.id)));
  check('collectScenes ได้เนื้อไฟล์มาด้วย', scs[0].text.includes('โทระ'));

  const al4 = new WS.AutoLink({});
  al4.build(ents, scs);
  check('ต่อกันครบวงจร: สแกนโปรเจกต์จริง → backlinks', al4.getBacklinks('characters/cat.json').join() === 'sc1',
    JSON.stringify(al4.index.backlinks));

  console.log(`\nworld-story: ${pass} ผ่าน, ${fail} ล้มเหลว`);
  console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})();
