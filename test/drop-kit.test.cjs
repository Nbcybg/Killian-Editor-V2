// test/drop-kit.test.cjs — [alpha.167] "หยิบใส่": ภาษากลางของการลาก (drop-kit.js) ด้วย DataTransfer ปลอม
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_dropkit.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/drop-kit.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const D = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };
function fakeDT(data = {}, files) {
  const store = { ...data };
  return { get types() { return Object.keys(store).concat(files ? ['Files'] : []); },
           getData: (k) => store[k] || '', setData: (k, v) => { store[k] = v; }, files: files || [] };
}

// ── ชนิดของที่ลาก ──
check('ทุกชนิดมี mime ของตัวเอง', D.DROP_KINDS.every((k) => /^text\/k2-/.test(D.DROP_MIME[k])));
check('dragKinds อ่านจากชนิด', D.dragKinds(fakeDT({ 'text/k2-entity': '{}', 'text/plain': 'x' })).join() === 'entity');
check('dragKinds ลิงก์จากเบราว์เซอร์', D.dragKinds(fakeDT({ 'text/uri-list': 'https://a.b' })).join() === 'url');
check('dragKinds ไฟล์จากเครื่อง', D.dragKinds(fakeDT({}, [{ name: 'a.png', path: '/x/a.png' }])).join() === 'files');
check('hasDrag ตามที่ปลายทางรับ', D.hasDrag(fakeDT({ 'text/k2-scene': '{}' }), ['scene']) && !D.hasDrag(fakeDT({ 'text/k2-scene': '{}' }), ['entity']));

// ── setDrag / readDrop ไปกลับ ──
{
  const dt = fakeDT();
  D.setDrag(dt, 'entity', { path: '/p/Wiki/characters/alice.json', title: 'อลิส', cat: 'characters' });
  check('setDrag ใส่ text/plain = ชื่อ (ช่องพิมพ์/ตัวแก้ไขได้ชื่อไปฟรี)', dt.getData('text/plain') === 'อลิส');
  const r = D.readDrop(dt);
  check('readDrop คืนชนิด + ของชิ้นเดียว', r.kind === 'entity' && r.items.length === 1 && r.items[0].title === 'อลิส' && r.items[0].cat === 'characters');
  check('readDrop เคารพ accept', D.readDrop(dt, ['scene']) === null);
  check('dropText', D.dropText(r) === 'อลิส');
}
{
  // รูปแบบเดิมของ Explorer (ก่อน alpha.167) ต้องอ่านได้
  const scene = D.readDrop(fakeDT({ 'text/k2-scene': JSON.stringify({ draftDir: '/d', chGuid: 'g', id: 's1', file: '/d/Chapters/c/scene-01.md', title: 'ฉากแรก' }) }));
  check('ฉากรูปแบบเดิม: path มาจาก file', scene.items[0].path === '/d/Chapters/c/scene-01.md' && scene.items[0].id === 's1');
  const gal = D.readDrop(fakeDT({ 'text/k2-gal-image': JSON.stringify({ paths: ['a/1.png', 'b/2.jpg'] }) }));
  check('รูปจากคลังรูปหลายใบ', gal.kind === 'gallery' && gal.items.length === 2 && gal.items[1].title === '2.jpg');
  const book = D.readDrop(fakeDT({ 'text/k2-book': '/p/Book1' }));
  check('เล่ม (ทางเปล่า ไม่ใช่ JSON)', book.kind === 'book' && book.items[0].path === '/p/Book1' && book.items[0].title === 'Book1');
  const book2 = D.readDrop(fakeDT({ 'text/k2-book': '/p/Book1', 'text/plain': 'เล่มหนึ่ง' }));
  check('เล่ม: ชื่อที่คนอ่านมากับ text/plain', book2.items[0].title === 'เล่มหนึ่ง' && book2.items[0].path === '/p/Book1');
  const ch = D.readDrop(fakeDT({ 'text/k2-chapter': JSON.stringify({ draftDir: '/d', guid: 'g1' }) }));
  check('บท (ไม่มี path ก็ยังเป็นของชิ้นหนึ่ง)', ch.kind === 'chapter' && ch.items[0].guid === 'g1');
  const map = D.readDrop(fakeDT({ 'text/k2-map': JSON.stringify({ id: 'm1', name: 'โลก' }) }));
  check('แผนที่', map.kind === 'map' && map.items[0].id === 'm1' && map.items[0].title === 'โลก');
  const url = D.readDrop(fakeDT({ 'text/uri-list': '# comment\nhttps://ex.com/a', 'text/plain': 'ตัวอย่าง' }));
  check('ลิงก์: ข้ามบรรทัดคอมเมนต์ + ใช้ข้อความเป็นชื่อ', url.kind === 'url' && url.items.length === 1 && url.items[0].title === 'ตัวอย่าง');
  check('ข้อมูลเสีย = null ไม่พัง', D.readDrop(fakeDT({ 'text/k2-scene': '{เสีย' })) === null);
  check('ไม่มีอะไรเลย = null', D.readDrop(fakeDT({ 'text/plain': 'x' })) === null && D.readDrop(null) === null);
  // ลากหลายชนิดพร้อมกัน → เลือกตามลำดับความสำคัญ (ฉากก่อนรูป)
  const multi = D.readDrop(fakeDT({ 'text/k2-image': JSON.stringify({ path: '/i.png', name: 'i.png' }), 'text/k2-scene': JSON.stringify({ file: '/s.md', title: 'ส' }) }));
  check('หลายชนิด → ฉากชนะ', multi.kind === 'scene');
  check('หลายชนิด + accept รูป → รูป', D.readDrop(fakeDT({ 'text/k2-image': JSON.stringify({ path: '/i.png', name: 'i.png' }), 'text/k2-scene': JSON.stringify({ file: '/s.md' }) }), ['image']).kind === 'image');
}
check('setDrag ชนิดที่ไม่รู้จัก = false', D.setDrag(fakeDT(), 'nope', {}) === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
