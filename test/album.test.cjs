// test/album.test.cjs — unit test ระบบคลังรูปใหม่ (alpha.63)
//   album-core (ทั้งส่วนบริสุทธิ์และ CRUD บนดิสก์จริงผ่าน kapi ปลอม) · album-tags ·
//   usage-index · moodboard · image-hash
const fs = require('fs');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(rel, name) {
  const tmp = path.join(os.tmpdir(), 'k2-' + name + '-test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', rel)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const A = load('gallery/album-core.js', 'album');
const T = load('gallery/album-tags.js', 'albumtags');
const U = load('gallery/usage-index.js', 'usage');
const M = load('gallery/moodboard.js', 'moodboard');
const H = load('gallery/image-hash.js', 'imghash');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ═══════════ kapi ปลอม (fs จริงบนโฟลเดอร์ชั่วคราว — async เหมือน IPC ของจริง) ═══════════
const api = {
  join: async (...a) => path.join(...a),
  exists: async (p) => fs.existsSync(p),
  readFile: async (p) => fs.readFileSync(p, 'utf-8'),
  writeFile: async (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, d, 'utf-8'); return true; },
  readJson: async (p) => JSON.parse(fs.readFileSync(p, 'utf-8')),
  mkdir: async (p) => { fs.mkdirSync(p, { recursive: true }); return true; },
  move: async (s, d) => { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.renameSync(s, d); return true; },
  remove: async (p) => { fs.rmSync(p, { recursive: true, force: true }); return true; },
  listDirs: async (p) => (fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []),
  listFiles: async (p, ext) => (fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true })
    .filter((d) => d.isFile() && (!ext || d.name.endsWith(ext))).map((d) => d.name) : []),
  copyInto: async (src, dstDir) => {
    fs.mkdirSync(dstDir, { recursive: true });
    let name = path.basename(src), n = 1;
    while (fs.existsSync(path.join(dstDir, name))) {
      const e = path.extname(src); name = path.basename(src, e) + '-' + n++ + e;
    }
    fs.copyFileSync(src, path.join(dstDir, name));
    return name;
  },
};

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'k2-album-'));
const IMG = path.join(ROOT, 'Images');
const touch = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data || 'x'); };

(async () => {
// ═══════════════════ 1. ส่วนบริสุทธิ์: ชื่อ/รหัส/ต้นไม้ ═══════════════════
check('sanitizeAlbumName ตัดอักขระต้องห้าม', A.sanitizeAlbumName('ตัว/ละคร:*?') === 'ตัวละคร',
  A.sanitizeAlbumName('ตัว/ละคร:*?'));
check('sanitizeAlbumName กัน "." และ ".."', A.sanitizeAlbumName('.') === '' && A.sanitizeAlbumName('..') === '');
check('sanitizeAlbumName กันชื่อชนอัลบั้มราก', A.sanitizeAlbumName('_uncategorized') === '');
check('sanitizeAlbumName ว่าง/ช่องว่างล้วน → ว่าง', A.sanitizeAlbumName('   ') === '' && A.sanitizeAlbumName(null) === '');
check('albumId ต่อ parent ให้ถูก', A.albumId('ตัวละคร', 'เอกราช') === 'ตัวละคร/เอกราช');
check('albumId จาก parent ว่าง = ชั้นบนสุด', A.albumId('', 'ตัวละคร') === 'ตัวละคร');
check('albumId จากอัลบั้มราก = ชั้นบนสุด (ไม่เอา _uncategorized มาต่อ)',
  A.albumId('_uncategorized', 'ฉาก') === 'ฉาก');
check('albumRel ของอัลบั้มราก = ว่าง (ชี้ Images/ เอง)',
  A.albumRel('_uncategorized') === '' && A.albumRel('') === '' && A.albumRel('ก/ข') === 'ก/ข');
check('parentOf', A.parentOf('ก/ข/ค') === 'ก/ข' && A.parentOf('ก') === '' && A.parentOf('_uncategorized') === '');
check('albumDepth', A.albumDepth('ก/ข/ค') === 3 && A.albumDepth('_uncategorized') === 0);
check('isImageFile รู้จักนามสกุลรูป',
  A.isImageFile('a.PNG') && A.isImageFile('b.jpeg') && A.isImageFile('c.webp') &&
  !A.isImageFile('album.json') && !A.isImageFile('d.txt'));

{
  const list = A.normalizeAlbums({ albums: [
    { id: 'ตัวละคร' }, { id: 'ตัวละคร/เอกราช' }, { id: 'สถานที่', order: 5 }, { id: 'ตัวละคร' },
  ] });
  check('normalizeAlbums ใส่อัลบั้มรากมาให้เสมอ', list[0].id === '_uncategorized');
  check('normalizeAlbums ตัด id ซ้ำ', list.filter((a) => a.id === 'ตัวละคร').length === 1);
  check('normalizeAlbums เดา parent จาก id', list.find((a) => a.id === 'ตัวละคร/เอกราช').parent === 'ตัวละคร');
  check('normalizeAlbums เดาชื่อจาก id', list.find((a) => a.id === 'ตัวละคร/เอกราช').name === 'เอกราช');

  const kids = A.childrenOf(list, '');
  check('childrenOf ชั้นบนสุดไม่รวมอัลบั้มราก/ลูก',
    kids.map((a) => a.id).join(',') === 'ตัวละคร,สถานที่', kids.map((a) => a.id).join(','));
  check('childrenOf ของอัลบั้มลูก', A.childrenOf(list, 'ตัวละคร').map((a) => a.id).join(',') === 'ตัวละคร/เอกราช');
  check('descendantIds', A.descendantIds(list, 'ตัวละคร').join(',') === 'ตัวละคร/เอกราช');
  check('descendantIds ของอัลบั้มราก = ว่าง (รากไม่มีลูกเชิงโครงสร้าง)',
    A.descendantIds(list, '_uncategorized').length === 0);

  const tree = A.albumTree(list);
  check('albumTree เอาอัลบั้มรากขึ้นก่อนเสมอ', tree[0].id === '_uncategorized');
  check('albumTree ซ้อนชั้นถูก', tree[1].id === 'ตัวละคร' && tree[1].children[0].id === 'ตัวละคร/เอกราช');

  const bc = A.albumBreadcrumb(list, 'ตัวละคร/เอกราช');
  check('albumBreadcrumb ไล่ชั้นครบ', bc.length === 2 && bc[1].name === 'เอกราช');

  // rename / move / remove — บริสุทธิ์
  const r1 = A.renameAlbumIn(list, 'ตัวละคร', 'ตัวละครหลัก');
  check('renameAlbumIn เปลี่ยน id ตัวเอง', r1.to === 'ตัวละครหลัก' && !r1.error);
  check('renameAlbumIn ลากลูกตามไปด้วย',
    r1.albums.some((a) => a.id === 'ตัวละครหลัก/เอกราช'), JSON.stringify(r1.moves));
  check('renameAlbumIn คืนคู่ย้ายครบทุกชั้น', r1.moves.length === 2);
  check('renameAlbumIn กันชื่อซ้ำ', !!A.renameAlbumIn(list, 'ตัวละคร', 'สถานที่').error);
  check('renameAlbumIn ห้ามเปลี่ยนชื่ออัลบั้มราก', !!A.renameAlbumIn(list, '_uncategorized', 'x').error);

  const r2 = A.moveAlbumIn(list, 'สถานที่', 'ตัวละคร');
  check('moveAlbumIn ย้ายเข้าใต้อัลบั้มอื่น', r2.to === 'ตัวละคร/สถานที่' && !r2.error);
  check('moveAlbumIn กันย้ายเข้าไปในลูกตัวเอง', !!A.moveAlbumIn(list, 'ตัวละคร', 'ตัวละคร/เอกราช').error);
  check('moveAlbumIn กันย้ายเข้าตัวเอง', !!A.moveAlbumIn(list, 'ตัวละคร', 'ตัวละคร').error);
  check('moveAlbumIn ย้ายขึ้นชั้นบนสุดได้',
    A.moveAlbumIn(list, 'ตัวละคร/เอกราช', '').to === 'เอกราช');

  const r3 = A.removeAlbumIn(list, 'ตัวละคร');
  check('removeAlbumIn ลบลูกหลานตามไปด้วย', r3.removed.length === 2 && r3.albums.length === list.length - 2);
  check('removeAlbumIn ห้ามลบอัลบั้มราก', !!A.removeAlbumIn(list, '_uncategorized').error);

  const ro = A.reorderAlbums(list, 'สถานที่', 0);
  check('reorderAlbums สลับลำดับพี่น้อง',
    A.childrenOf(ro, '').map((a) => a.id).join(',') === 'สถานที่,ตัวละคร',
    A.childrenOf(ro, '').map((a) => a.id).join(','));
}

// ═══════════════════ 2. เมทาดาทาในอัลบั้ม ═══════════════════
{
  const d0 = A.normalizeAlbumDoc({ images: { 'a.png': 'คำบรรยายแบบเก่า' } }, 'ก');
  check('normalizeAlbumDoc รับ caption แบบสตริง', d0.images['a.png'].caption === 'คำบรรยายแบบเก่า');
  check('normalizeAlbumDoc เติม tags/order/added', Array.isArray(d0.images['a.png'].tags));
  const d1 = A.normalizeAlbumDoc({ images: [{ file: 'b.png', caption: 'B', tags: ['#x'] }] });
  check('normalizeAlbumDoc รับรูปแบบอาร์เรย์ (ผู้ใช้แก้ไฟล์เอง)', d1.images['b.png'].caption === 'B');
  check('normalizeAlbumDoc ของพัง → โครงว่างที่ใช้ได้',
    A.normalizeAlbumDoc(null).images && Array.isArray(A.normalizeAlbumDoc(null).moodBoard));

  const s = A.syncAlbumDoc({ images: { 'gone.png': { caption: 'หายแล้ว' }, 'a.png': { caption: 'A', order: 3 } } },
                           ['a.png', 'new.png', 'album.json']);
  check('syncAlbumDoc ตัดรายการที่ไฟล์หายไป', !s.images['gone.png']);
  check('syncAlbumDoc เก็บเมทาดาทาของไฟล์ที่ยังอยู่', s.images['a.png'].caption === 'A' && s.images['a.png'].order === 3);
  check('syncAlbumDoc เพิ่มไฟล์ใหม่พร้อม caption จากชื่อไฟล์', s.images['new.png'].caption === 'new');
  check('syncAlbumDoc ไม่นับไฟล์ที่ไม่ใช่รูป', !s.images['album.json']);
  check('syncAlbumDoc ให้ order ต่อจากตัวสูงสุดเดิม', s.images['new.png'].order === 4, s.images['new.png'].order);
  // [alpha.63r] ชิ้นบนกระดานที่มาจากอัลบั้มอื่นเก็บเป็น path — ห้ามถูกตัดทิ้งตอนซิงก์
  {
    const withBoard = A.syncAlbumDoc(
      { images: { 'a.png': {} },
        moodBoard: [{ id: 'x', file: 'a.png' }, { id: 'y', file: 'ตัวละคร/ref.png' },
                    { id: 'z', file: 'หายไปแล้ว.png' }] },
      ['a.png']);
    check('syncAlbumDoc เก็บชิ้นกระดานที่เป็นรูปข้ามอัลบั้มไว้',
      withBoard.moodBoard.some((i) => i.file === 'ตัวละคร/ref.png'));
    check('syncAlbumDoc ตัดชิ้นกระดานที่ไฟล์ในอัลบั้มนี้หายไป',
      !withBoard.moodBoard.some((i) => i.file === 'หายไปแล้ว.png') && withBoard.moodBoard.length === 2);
  }

  const withMeta = A.setImageMeta(s, 'a.png', { caption: 'ใหม่' });
  check('setImageMeta ไม่แก้ของเดิม (immutable)', s.images['a.png'].caption === 'A' && withMeta.images['a.png'].caption === 'ใหม่');
  check('removeImageMeta ถอดรายการ', !A.removeImageMeta(s, 'a.png').images['a.png']);

  const ord = A.reorderImages(s, ['new.png', 'a.png']);
  check('reorderImages เขียน order ตามลำดับที่ส่งมา',
    ord.images['new.png'].order === 0 && ord.images['a.png'].order === 1);

  const ent = A.albumEntries('ตัวละคร', s);
  check('albumEntries ให้ path สัมพัทธ์กับ Images/', ent[0].path.startsWith('ตัวละคร/'), ent[0].path);
  check('albumEntries ของอัลบั้มราก = ชื่อไฟล์เปล่า', A.albumEntries('_uncategorized', s)[0].path.indexOf('/') < 0);
  check('albumEntries เรียงตาม order', A.albumEntries('ก', ord).map((e) => e.file).join(',') === 'new.png,a.png');
}

// ═══════════════════ 3. ดัชนีแบน v1 ═══════════════════
{
  const flat = A.flatIndexFrom([
    { file: 'a.png', path: 'a.png', album: '_uncategorized', caption: 'A', tags: [] },
    { file: 'b.png', path: 'ตัวละคร/b.png', album: 'ตัวละคร', caption: 'B', tags: ['#x'] },
  ]);
  check('flatIndexFrom: รูปรากยังเป็นชื่อไฟล์เปล่าเหมือน v1', flat.images[0].file === 'a.png' && !flat.images[0].album);
  check('flatIndexFrom: รูปในอัลบั้มเป็น path + ฟิลด์ album', flat.images[1].file === 'ตัวละคร/b.png' && flat.images[1].album === 'ตัวละคร');
  check('flatIndexFrom เก็บ caption ครบ', flat.images[1].caption === 'B');
  const caps = A.captionsFromFlat({ images: [{ file: 'a.png', caption: 'เก่า' }, null, { caption: 'ไม่มีไฟล์' }] });
  check('captionsFromFlat อ่าน caption เดิมได้ + ทนของพัง', caps['a.png'] === 'เก่า' && Object.keys(caps).length === 1);
}

// ═══════════════════ 4. เรียง / ค้นหา / สถิติ ═══════════════════
{
  const items = [
    { file: 'b.png', caption: 'พระอาทิตย์', tags: ['#ฉาก'], order: 1, added: 200, size: 50, uses: 0, album: 'ก' },
    { file: 'a.png', caption: 'เอกราช', tags: ['@เอกราช'], order: 0, added: 300, size: 10, uses: 3, album: 'ก' },
    { file: 'c.png', caption: '', tags: [], order: 2, added: 100, size: 900, uses: 1, album: 'ข' },
  ];
  check('sortImages manual ใช้ order', A.sortImages(items, 'manual').map((i) => i.file).join(',') === 'a.png,b.png,c.png');
  check('sortImages name', A.sortImages(items, 'name').map((i) => i.file).join(',') === 'a.png,b.png,c.png');
  check('sortImages date ใหม่สุดก่อน', A.sortImages(items, 'date')[0].file === 'a.png');
  check('sortImages size ใหญ่สุดก่อน', A.sortImages(items, 'size')[0].file === 'c.png');
  check('sortImages usage มากสุดก่อน', A.sortImages(items, 'usage')[0].file === 'a.png');
  check('sortImages ไม่แก้อาร์เรย์เดิม', items[0].file === 'b.png');
  check('searchImages ค้นจากคำบรรยาย', A.searchImages(items, 'พระอาทิตย์').length === 1);
  check('searchImages ค้นจากแท็ก', A.searchImages(items, '@เอกราช').length === 1);
  check('searchImages ค้นจากชื่ออัลบั้ม', A.searchImages(items, 'ข').length === 1);
  check('searchImages ว่าง = ทั้งหมด', A.searchImages(items, '  ').length === 3);
  check('formatBytes', A.formatBytes(512) === '512 B' && A.formatBytes(2048) === '2.0 KB' &&
    A.formatBytes(5 * 1048576) === '5.0 MB', A.formatBytes(2048));

  const st = A.galleryStats(items, [{ id: '_uncategorized' }, { id: 'ก' }, { id: 'ข' }]);
  check('galleryStats นับรวม/ใช้แล้ว/ยังไม่ใช้', st.total === 3 && st.used === 2 && st.unused === 1);
  check('galleryStats รวมขนาด', st.bytes === 960 && !!st.bytesText);
  check('galleryStats ไม่นับอัลบั้มรากเป็นอัลบั้ม', st.albums === 2);
  check('galleryStats นับแท็กไม่ซ้ำ', st.tags === 2);
}

// ═══════════════════ 5. CRUD บนดิสก์จริง ═══════════════════
// โปรเจกต์เก่าแบบ v1: รูปกองอยู่ใน Images/ + images.json มี caption
touch(path.join(IMG, 'sunset.png'), 'png1');
touch(path.join(IMG, 'market.png'), 'png2');
touch(path.join(IMG, 'notes.txt'), 'ไม่ใช่รูป');
fs.writeFileSync(path.join(IMG, 'images.json'),
  JSON.stringify({ images: [{ file: 'sunset.png', caption: 'ตลาดยามเย็น' }] }), 'utf-8');

{
  const mig = await A.migrateFromFlat(api, ROOT);
  check('migrateFromFlat รับรูปเก่าเข้าอัลบั้มราก', mig.adopted === 2, JSON.stringify(mig));
  check('migrateFromFlat ดึง caption เดิมจาก images.json', mig.captions === 1);
  check('migrateFromFlat ไม่ย้ายไฟล์ (ลิงก์ใน .md ไม่พัง)',
    fs.existsSync(path.join(IMG, 'sunset.png')) && !fs.existsSync(path.join(IMG, '_uncategorized')));
  const doc = await A.readAlbumDoc(api, ROOT, '_uncategorized');
  check('อัลบั้มรากเก็บ caption เดิมไว้', doc.images['sunset.png'].caption === 'ตลาดยามเย็น');
  check('ไฟล์ที่ไม่ใช่รูปไม่เข้าคลัง', !doc.images['notes.txt']);
  const mig2 = await A.migrateFromFlat(api, ROOT);
  check('migrateFromFlat เรียกซ้ำแล้วไม่เพิ่มอะไรอีก', mig2.adopted === 0);
}

{
  const a1 = await A.createAlbum(api, ROOT, 'ตัวละคร');
  const a2 = await A.createAlbum(api, ROOT, 'เอกราช', 'ตัวละคร');
  await A.createAlbum(api, ROOT, 'สถานที่');
  check('createAlbum สร้างโฟลเดอร์จริง', fs.existsSync(path.join(IMG, 'ตัวละคร', 'เอกราช')));
  check('createAlbum เขียน album.json', fs.existsSync(path.join(IMG, 'ตัวละคร', 'album.json')));
  check('createAlbum คืน id ซ้อนชั้น', a2.id === 'ตัวละคร/เอกราช' && a1.id === 'ตัวละคร');
  check('createAlbum เขียน albums.json', fs.existsSync(path.join(IMG, 'albums.json')));
  let dup = false;
  try { await A.createAlbum(api, ROOT, 'ตัวละคร'); } catch { dup = true; }
  check('createAlbum ชื่อซ้ำ → throw', dup);

  const list = await A.listAlbums(api, ROOT);
  check('listAlbums เห็นครบ + มีอัลบั้มราก', list.length === 4 && list[0].id === '_uncategorized',
    list.map((a) => a.id).join(','));

  // โฟลเดอร์ที่ผู้ใช้สร้างเองในดิสก์ (แก้ไฟล์นอกโปรแกรม) ต้องถูกรับเข้าคลังอัตโนมัติ
  fs.mkdirSync(path.join(IMG, 'ทำมือ'), { recursive: true });
  const list2 = await A.listAlbums(api, ROOT);
  check('listAlbums รับโฟลเดอร์ที่ผู้ใช้สร้างเองในดิสก์', list2.some((a) => a.id === 'ทำมือ'));
  fs.rmSync(path.join(IMG, 'ทำมือ'), { recursive: true, force: true });
  check('listAlbums ตัดอัลบั้มที่โฟลเดอร์หายไปแล้ว',
    !(await A.listAlbums(api, ROOT)).some((a) => a.id === 'ทำมือ'));
}

{
  // เพิ่มรูปเข้าอัลบั้ม + ย้ายข้ามอัลบั้ม
  const src = path.join(ROOT, 'ext-ref.png');
  touch(src, 'png3');
  const name = await A.addImageFile(api, ROOT, 'ตัวละคร/เอกราช', src);
  check('addImageFile ก๊อปไฟล์เข้าอัลบั้ม', name === 'ext-ref.png' &&
    fs.existsSync(path.join(IMG, 'ตัวละคร', 'เอกราช', 'ext-ref.png')));
  const imgs = await A.getAlbumImages(api, ROOT, 'ตัวละคร/เอกราช');
  check('getAlbumImages เห็นรูปที่เพิ่ง copy', imgs.length === 1 && imgs[0].file === 'ext-ref.png');
  check('getAlbumImages ให้ path พร้อมใช้', imgs[0].path === 'ตัวละคร/เอกราช/ext-ref.png');

  await A.updateImage(api, ROOT, 'ตัวละคร/เอกราช', 'ext-ref.png', { caption: 'ภาพอ้างอิงเอกราช' });
  check('updateImage เขียน caption ลง album.json',
    (await A.readAlbumDoc(api, ROOT, 'ตัวละคร/เอกราช')).images['ext-ref.png'].caption === 'ภาพอ้างอิงเอกราช');

  const mv = await A.moveImage(api, ROOT, '_uncategorized', 'ตัวละคร', 'sunset.png');
  check('moveImage ย้ายไฟล์จริง', !fs.existsSync(path.join(IMG, 'sunset.png')) &&
    fs.existsSync(path.join(IMG, 'ตัวละคร', 'sunset.png')));
  check('moveImage คืน path เก่า/ใหม่ (ไว้แก้ลิงก์ใน .md)',
    mv.oldPath === 'sunset.png' && mv.newPath === 'ตัวละคร/sunset.png', JSON.stringify(mv));
  check('moveImage พาเมทาดาทาไปด้วย',
    (await A.readAlbumDoc(api, ROOT, 'ตัวละคร')).images['sunset.png'].caption === 'ตลาดยามเย็น');
  check('moveImage ถอนออกจากอัลบั้มต้นทาง',
    !(await A.readAlbumDoc(api, ROOT, '_uncategorized')).images['sunset.png']);
  check('moveImage ปลายทางเดียวกับต้นทาง → ไม่ทำอะไร',
    (await A.moveImage(api, ROOT, 'ตัวละคร', 'ตัวละคร', 'sunset.png')) === null);

  // ชื่อชนที่ปลายทาง → ต้องเติมเลข ไม่ใช่ทับ
  touch(path.join(IMG, 'sunset.png'), 'อีกใบ');
  const mv2 = await A.moveImage(api, ROOT, '_uncategorized', 'ตัวละคร', 'sunset.png');
  check('moveImage ชื่อชน → เติมเลขกันทับ', mv2.file === 'sunset-1.png' &&
    fs.readFileSync(path.join(IMG, 'ตัวละคร', 'sunset.png'), 'utf-8') === 'png1', mv2.file);
}

{
  // เปลี่ยนชื่อ / ย้าย / ลบอัลบั้ม
  const r = await A.renameAlbum(api, ROOT, 'ตัวละคร', 'ตัวละครหลัก');
  check('renameAlbum ย้ายโฟลเดอร์จริง', fs.existsSync(path.join(IMG, 'ตัวละครหลัก', 'เอกราช')) &&
    !fs.existsSync(path.join(IMG, 'ตัวละคร')));
  check('renameAlbum อัปเดต id ลูกใน albums.json', r.albums.some((a) => a.id === 'ตัวละครหลัก/เอกราช'));

  await A.moveAlbum(api, ROOT, 'สถานที่', 'ตัวละครหลัก');
  check('moveAlbum ย้ายโฟลเดอร์เข้าใต้อัลบั้มอื่น', fs.existsSync(path.join(IMG, 'ตัวละครหลัก', 'สถานที่')));

  const del = await A.deleteAlbum(api, ROOT, 'ตัวละครหลัก/สถานที่');
  check('deleteAlbum ย้ายไปถังขยะ (ไม่ลบถาวร)',
    !fs.existsSync(path.join(IMG, 'ตัวละครหลัก', 'สถานที่')) && fs.existsSync(del.movedTo));
  check('deleteAlbum ถอดออกจาก albums.json', !del.albums.some((a) => a.id === 'ตัวละครหลัก/สถานที่'));

  // [alpha.63r4] ถังขยะต้องรู้ว่าอัลบั้มนี้เคยอยู่ไหน ไม่งั้นกดกู้คืนแล้วโฟลเดอร์ไปโผล่ที่ Memos/
  check('deleteAlbum เขียน sidecar กู้คืน', fs.existsSync(del.movedTo + A.RESTORE_EXT));
  {
    const info = JSON.parse(fs.readFileSync(del.movedTo + A.RESTORE_EXT, 'utf-8'));
    check('sidecar อัลบั้มจำ id เดิมไว้', info.kind === 'album' && info.id === 'ตัวละครหลัก/สถานที่', JSON.stringify(info.id));
    await A.restoreFromRecycle(api, ROOT, del.movedTo, info);
    check('restoreFromRecycle คืนอัลบั้มกลับที่เดิม', fs.existsSync(path.join(IMG, 'ตัวละครหลัก', 'สถานที่')));
    check('อัลบั้มที่กู้คืนกลับมาอยู่ในรายการ',
      (await A.listAlbums(api, ROOT)).some((a) => a.id === 'ตัวละครหลัก/สถานที่'));
    // เก็บกวาดให้เทสถัดไปเห็นสภาพเดิม
    await A.deleteAlbum(api, ROOT, 'ตัวละครหลัก/สถานที่');
  }

  await A.updateImage(api, ROOT, 'ตัวละครหลัก', 'sunset.png', { caption: 'พระอาทิตย์ตก', tags: ['#ref'] });
  const dst = await A.deleteImage(api, ROOT, 'ตัวละครหลัก', 'sunset.png');
  check('deleteImage ย้ายรูปไปถังขยะ', fs.existsSync(dst) && !fs.existsSync(path.join(IMG, 'ตัวละครหลัก', 'sunset.png')));
  check('deleteImage เขียน sidecar กู้คืน', fs.existsSync(dst + A.RESTORE_EXT));
  {
    const info = JSON.parse(fs.readFileSync(dst + A.RESTORE_EXT, 'utf-8'));
    check('sidecar รูปจำอัลบั้ม + caption/แท็ก',
      info.kind === 'image' && info.album === 'ตัวละครหลัก' && info.meta
      && info.meta.caption === 'พระอาทิตย์ตก' && (info.meta.tags || []).includes('#ref'),
      JSON.stringify(info.meta));
    const r = await A.restoreFromRecycle(api, ROOT, dst, info);
    check('restoreFromRecycle คืนรูปเข้าอัลบั้มเดิม (ไม่ใช่ Memos/)',
      fs.existsSync(path.join(IMG, 'ตัวละครหลัก', 'sunset.png')) && r.album === 'ตัวละครหลัก');
    const doc = await A.readAlbumDoc(api, ROOT, 'ตัวละครหลัก');
    check('กู้คืนรูปแล้วได้ caption/แท็กเดิมกลับมา',
      doc.images['sunset.png'] && doc.images['sunset.png'].caption === 'พระอาทิตย์ตก'
      && doc.images['sunset.png'].tags.includes('#ref'), JSON.stringify(doc.images['sunset.png']));
  }
  {
    // อัลบั้มต้นทางถูกลบไปแล้ว → รูปต้องตกลงอัลบั้มราก ไม่ใช่ throw หรือหายไป
    const orphan = path.join(ROOT, 'Recycle', 'zz-orphan.png');
    touch(orphan, 'x');
    const r = await A.restoreFromRecycle(api, ROOT, orphan,
      { kind: 'image', album: 'อัลบั้มที่ไม่มีแล้ว', file: 'orphan.png', meta: null });
    check('อัลบั้มเดิมหายแล้ว → คืนรูปลงอัลบั้มราก',
      r.album === A.ROOT_ALBUM && fs.existsSync(path.join(IMG, 'orphan.png')), JSON.stringify(r));
    await A.deleteImage(api, ROOT, A.ROOT_ALBUM, 'orphan.png');
  }
  await A.deleteImage(api, ROOT, 'ตัวละครหลัก', 'sunset.png');
}

{
  const all = await A.allImages(api, ROOT);
  check('allImages รวมทุกอัลบั้ม', all.length >= 3, all.map((i) => i.path).join(','));
  await A.syncFlatIndex(api, ROOT, all);
  const flat = JSON.parse(fs.readFileSync(path.join(IMG, 'images.json'), 'utf-8'));
  check('syncFlatIndex เขียน images.json ใหม่ครบทุกอัลบั้ม', flat.images.length === all.length);
  check('syncFlatIndex ยังมีคีย์ file/caption ให้ v1 อ่านได้',
    flat.images.every((r) => typeof r.file === 'string' && typeof r.caption === 'string'));
  const p = await A.findImagePath(api, ROOT, 'ext-ref.png');
  check('findImagePath หารูปที่ย้ายเข้าอัลบั้มแล้วเจอจากชื่อเปล่า', p === 'ตัวละครหลัก/เอกราช/ext-ref.png', p);
  check('findImagePath ไม่มีไฟล์ → ว่าง', (await A.findImagePath(api, ROOT, 'ไม่มีจริง.png')) === '');
}

// ═══════════════════ 6. แท็ก ═══════════════════
check('normalizeTag เติม # ให้แท็กเปล่า', T.normalizeTag('ฉาก') === '#ฉาก');
check('normalizeTag เก็บตัวนำหน้าที่ผู้ใช้พิมพ์', T.normalizeTag('@เอกราช') === '@เอกราช' && T.normalizeTag('~ฉาก 3') === '~ฉาก 3');
check('normalizeTag ตัดตัวนำหน้าซ้อน', T.normalizeTag('##ก') === '#ก' && T.normalizeTag('#@ก') === '@ก');
check('normalizeTag ว่าง → ว่าง', T.normalizeTag('#') === '' && T.normalizeTag('   ') === '' && T.normalizeTag(null) === '');
check('normalizeTag ยุบช่องว่างซ้ำ', T.normalizeTag('#ฉาก   กลางคืน') === '#ฉาก กลางคืน');
check('tagKind/tagName', T.tagKind('@ก') === 'entity' && T.tagKind('~ก') === 'scene' &&
  T.tagKind('#ก') === 'plain' && T.tagName('@ก') === 'ก');
check('tagKind ของสตริงไม่มีตัวนำหน้า = ทั่วไป', T.tagKind('ก') === 'plain');
check('parseTags แยกด้วยคอมมาและช่องว่างหน้าตัวนำหน้า',
  T.parseTags('#ฉาก, @เอกราช ~ฉากที่ 3').join('|') === '#ฉาก|@เอกราช|~ฉากที่ 3',
  T.parseTags('#ฉาก, @เอกราช ~ฉากที่ 3').join('|'));
check('parseTags ไม่ซ้ำ', T.parseTags('#ก #ก').length === 1);
check('tagsToText', T.tagsToText(['#ก', '@ข']) === '#ก @ข');

{
  let doc = A.normalizeAlbumDoc({ images: { 'a.png': { caption: 'A' }, 'b.png': { caption: 'B' } } });
  doc = T.addTag(doc, 'a.png', 'ฉาก');
  check('addTag เติมตัวนำหน้าให้', doc.images['a.png'].tags[0] === '#ฉาก');
  doc = T.addTag(doc, 'a.png', '#ฉาก');
  check('addTag ซ้ำ → ไม่เพิ่ม', doc.images['a.png'].tags.length === 1);
  doc = T.addTag(doc, 'a.png', '@เอกราช');
  check('addTag หลายชนิดในใบเดียว', doc.images['a.png'].tags.length === 2);
  const removed = T.removeTag(doc, 'a.png', 'ฉาก');
  check('removeTag ถอดออก', removed.images['a.png'].tags.join(',') === '@เอกราช');
  check('removeTag ไม่แก้ของเดิม', doc.images['a.png'].tags.length === 2);
  const many = T.addTagMany(doc, ['a.png', 'b.png'], '#รอบ2');
  check('addTagMany ติดพร้อมกันหลายใบ',
    many.images['a.png'].tags.includes('#รอบ2') && many.images['b.png'].tags.includes('#รอบ2'));
  check('removeTagMany ถอดพร้อมกัน',
    !T.removeTagMany(many, ['a.png', 'b.png'], '#รอบ2').images['b.png'].tags.includes('#รอบ2'));
  const rn = T.renameTagIn(many, '#รอบ2', '#รอบ3');
  check('renameTagIn เปลี่ยนทั้งอัลบั้ม',
    rn.images['a.png'].tags.includes('#รอบ3') && !rn.images['b.png'].tags.includes('#รอบ2'));
  const st = T.setTags(doc, 'b.png', ['x', '#x', '@y', '']);
  check('setTags ทำให้เป็นมาตรฐาน + ตัดซ้ำ/ว่าง', st.images['b.png'].tags.join(',') === '#x,@y');
}

{
  const items = [
    { file: 'a.png', tags: ['#ฉาก', '@เอกราช'] },
    { file: 'b.png', tags: ['#ฉาก'] },
    { file: 'c.png', tags: [] },
  ];
  const all = T.getAllTags(items);
  check('getAllTags นับจำนวนถูก', all[0].tag === '#ฉาก' && all[0].count === 2);
  check('getAllTags บอกชนิด', all.find((t) => t.tag === '@เอกราช').kind === 'entity');
  check('filterByTags AND', T.filterByTags(items, ['#ฉาก', '@เอกราช'], 'and').length === 1);
  check('filterByTags OR', T.filterByTags(items, ['#ฉาก', '@เอกราช'], 'or').length === 2);
  check('filterByTags ไม่มีแท็ก = ไม่กรอง', T.filterByTags(items, [], 'and').length === 3);
  check('filterByTags รับแท็กไม่มีตัวนำหน้า', T.filterByTags(items, ['ฉาก'], 'and').length === 2);
  check('imagesForEntity หา @ชื่อ ได้', T.imagesForEntity(items, 'เอกราช').length === 1);
  check('imagesForEntity ชื่อว่าง → ว่าง', T.imagesForEntity(items, '').length === 0);
  check('imagesForScene หา ~ชื่อ ได้',
    T.imagesForScene([{ file: 'x', tags: ['~ฉากที่ 3'] }], 'ฉากที่ 3').length === 1);
  const sug = T.suggestTags({ file: 'ref-เอกราช.png', caption: '', album: 'ตัวละคร' }, { entities: ['เอกราช', 'พิมพ์ดาว'] });
  check('suggestTags เดา @entity จากชื่อไฟล์ + #อัลบั้ม', sug.join(',') === '@เอกราช,#ตัวละคร', sug.join(','));
}

// ═══════════════════ 7. ดัชนีการใช้งาน ═══════════════════
{
  const md = `# ฉาก\n\n![ตลาด](../../Images/sunset.png)\n\nข้อความ\n\n<img src="../../Images/ตัวละคร/ref.png">\n` +
             `\n![นอก](https://example.com/x.png)\n![ซ้ำ](../../Images/sunset.png)\n`;
  const refs = U.extractImageRefs(md);
  check('extractImageRefs จับ markdown + html', refs.length === 3, JSON.stringify(refs.map((r) => r.file)));
  check('extractImageRefs ข้าม URL ภายนอก', !refs.some((r) => /^https?:/.test(r.path)));
  check('extractImageRefs บอกเลขบรรทัด', refs[0].line === 3, refs[0].line);
  check('extractImageRefs ให้ basename', refs[1].file === 'ref.png');
  check('extractImageRefs ถอด %20 ในชื่อไฟล์',
    U.extractImageRefs('![](../Images/a%20b.png)')[0].file === 'a b.png');
  check('extractImageRefs ข้าม data: URI', U.extractImageRefs('![](data:image/png;base64,AA)').length === 0);

  const index = U.buildUsageIndex([
    { file: '/p/ch1/s1.md', title: 'ฉากที่ 1', text: md },
    { file: '/p/ch1/s2.md', title: 'ฉากที่ 2', text: '![](../../Images/sunset.png)' },
    { file: '/p/ch1/s3.md', title: 'ฉากที่ 3', text: 'ไม่มีรูป' },
  ]);
  check('buildUsageIndex นับข้ามไฟล์', U.usageCount(index, 'sunset.png') === 3, U.usageCount(index, 'sunset.png'));
  check('usageCount รับ path เต็มก็ได้', U.usageCount(index, 'ตัวละคร/ref.png') === 1);
  check('usageCount รูปที่ไม่ถูกใช้ = 0', U.usageCount(index, 'ไม่มีใครใช้.png') === 0);
  check('usageLabel บอกชื่อฉาก', U.usageLabel(index, 'sunset.png').includes('ฉากที่ 1'));
  check('usageLabel รูปที่ไม่ถูกใช้', U.usageLabel(index, 'x.png') === 'ยังไม่ถูกใช้');
  check('usageOf คืนรายการที่คลิกเปิดฉากได้', U.usageOf(index, 'sunset.png')[0].file === '/p/ch1/s1.md');

  const items = U.attachUsage([{ file: 'sunset.png' }, { file: 'lonely.png' }], index);
  check('attachUsage ติดฟิลด์ uses', items[0].uses === 3 && items[1].uses === 0);
  check('filterByUsage unused', U.filterByUsage(items, 'unused').map((i) => i.file).join(',') === 'lonely.png');
  check('filterByUsage used', U.filterByUsage(items, 'used').length === 1);
  check('filterByUsage all', U.filterByUsage(items, 'all').length === 2);

  const rw = U.rewriteImageRefs(md, 'sunset.png', 'ตัวละคร/sunset.png');
  check('rewriteImageRefs แก้ทุกจุดในไฟล์', rw.changed === 2, rw.changed);
  check('rewriteImageRefs คงจำนวนชั้น ../ เดิมไว้',
    rw.text.includes('../../Images/ตัวละคร/sunset.png'), rw.text.split('\n')[2]);
  check('rewriteImageRefs ไม่แตะรูปอื่น', rw.text.includes('../../Images/ตัวละคร/ref.png'));
  check('rewriteImageRefs ไม่แตะ URL ภายนอก', rw.text.includes('https://example.com/x.png'));
  check('rewriteImageRefs คำบรรยายเดิมอยู่ครบ', rw.text.includes('![ตลาด]('));
  const rwHtml = U.rewriteImageRefs('<img src="../Images/ตัวละคร/ref.png" alt="a">', 'ref.png', 'ref.png');
  check('rewriteImageRefs กับ <img> ก็ได้', rwHtml.changed === 1);
  check('rewriteImageRefs path ที่ไม่ได้ชี้เข้า Images/ → ไม่แตะ',
    U.rewriteImageRefs('![](./local/sunset.png)', 'sunset.png', 'ก/sunset.png').changed === 0);
}

// ═══════════════════ 8. กระดานอารมณ์ ═══════════════════
{
  let b = M.addToBoard([], 'a.png', { x: 10, y: 20 });
  b = M.addToBoard(b, 'b.png', { x: 300, y: 20, w: 100, h: 100 });
  check('addToBoard ให้ id ไม่ซ้ำ', b[0].id !== b[1].id && b.length === 2);
  check('addToBoard ไล่ z ขึ้น', b[1].z > b[0].z);
  check('newBoardItem ใช้ขนาดเริ่มต้น', b[0].w === M.DEFAULT_SIZE);
  check('normalizeBoard ทิ้งรายการที่ไม่มี file', M.normalizeBoard([{ x: 1 }, { file: 'a.png' }]).length === 1);

  const up = M.updateBoardItem(b, b[0].id, { x: 50, w: 5 });
  check('updateBoardItem ย้ายตำแหน่ง', up[0].x === 50);
  check('updateBoardItem หนีบขนาดต่ำสุด', up[0].w === M.MIN_SIZE);
  check('updateBoardItem ไม่แก้ของเดิม', b[0].x === 10);
  check('moveToFront ดันขึ้นบนสุด', M.moveToFront(b, b[0].id)[0].z > b[1].z);
  check('moveToBack ดันลงล่างสุด', M.moveToBack(b, b[1].id)[1].z < b[0].z);
  check('removeFromBoard ลบเฉพาะชิ้นนั้น', M.removeFromBoard(b, b[0].id).length === 1);
  check('removeFileFromBoard ลบทุกชิ้นของไฟล์นั้น',
    M.removeFileFromBoard(M.addToBoard(b, 'a.png'), 'a.png').length === 1);

  const bounds = M.boardBounds(b);
  check('boardBounds ครอบทุกชิ้น', bounds.x === 10 && bounds.y === 20 && bounds.w === 390, JSON.stringify(bounds));
  check('boardBounds กระดานว่าง → ศูนย์', M.boardBounds([]).w === 0);
  check('boardItemAt เจอชิ้นที่จุดนั้น', M.boardItemAt(b, 320, 40).file === 'b.png');
  check('boardItemAt ที่ว่าง → null', M.boardItemAt(b, 2000, 2000) === null);
  check('boardItemAt ชิ้นทับกัน = ได้ตัวบนสุด',
    M.boardItemAt(M.addToBoard(b, 'top.png', { x: 10, y: 20 }), 20, 30).file === 'top.png');

  check('fitScale ไม่ขยายเกิน 1 เท่า', M.fitScale({ x: 0, y: 0, w: 10, h: 10 }, 800, 600) === 1);
  check('fitScale ย่อให้พอดีเมื่อกระดานใหญ่',
    Math.abs(M.fitScale({ x: 0, y: 0, w: 2000, h: 100 }, 1000, 600, 0) - 0.5) < 1e-9);
  const fv = M.fitView(b, 800, 600, 0);
  check('fitView จัดกึ่งกลาง', Math.abs((bounds.x * fv.zoom + fv.panX) + (bounds.w * fv.zoom) / 2 - 400) < 1e-6);

  const v0 = { zoom: 1, panX: 0, panY: 0 };
  const v1 = M.zoomAt(v0, 2, 100, 100);
  check('zoomAt ยึดจุดใต้เมาส์ไว้กับที่',
    Math.abs(M.toScreen(v1, ...Object.values(M.toBoard(v0, 100, 100))).x - 100) < 1e-6, JSON.stringify(v1));
  check('zoomAt หนีบขอบบน', M.zoomAt({ zoom: 4, panX: 0, panY: 0 }, 4, 0, 0).zoom === M.ZOOM_MAX);
  check('zoomAt หนีบขอบล่าง', M.zoomAt({ zoom: 0.2, panX: 0, panY: 0 }, 0.1, 0, 0).zoom === M.ZOOM_MIN);
  check('toBoard/toScreen กลับไปกลับมาได้', (() => {
    const p = M.toBoard({ zoom: 1.5, panX: 30, panY: -20 }, 200, 100);
    const s = M.toScreen({ zoom: 1.5, panX: 30, panY: -20 }, p.x, p.y);
    return Math.abs(s.x - 200) < 1e-9 && Math.abs(s.y - 100) < 1e-9;
  })());
  check('snap เข้ากริด', M.snap(23) === 20 && M.snap(26) === 30 && M.snap(23, 0) === 23);
  check('resizeItem คงสัดส่วนได้',
    M.resizeItem({ w: 100, h: 50, file: 'a' }, 200, 999, { keepRatio: true }).h === 100);
  const tidy = M.tidyBoard(b, { size: 100, perRow: 2, gap: 10 });
  check('tidyBoard จัดเป็นตาราง', tidy[0].x === 0 && tidy[1].x === 110);
  check('boardStats นับชิ้น/ไฟล์', M.boardStats(b).count === 2 && M.boardStats(b).files === 2);
  // [alpha.63r] ขนาดตอนวางต้องตรงสัดส่วนไฟล์จริง — ไม่งั้นรูปถูกครอบตัด/บิด
  const sq = M.sizeForAspect(240, 100, 100);
  check('sizeForAspect รูปจัตุรัส', sq.w === 240 && sq.h === 240, JSON.stringify(sq));
  const wide = M.sizeForAspect(240, 400, 200);
  check('sizeForAspect รูปแนวนอน = ด้านยาวเท่ากล่อง', wide.w === 240 && wide.h === 120, JSON.stringify(wide));
  const tall = M.sizeForAspect(240, 200, 400);
  check('sizeForAspect รูปแนวตั้ง', tall.w === 120 && tall.h === 240, JSON.stringify(tall));
  check('sizeForAspect ไม่รู้ขนาดจริง → จัตุรัส', M.sizeForAspect(240, 0, 0).h === 240);
  check('sizeForAspect หนีบขนาดต่ำสุด', M.sizeForAspect(240, 1000, 1).h === M.MIN_SIZE);
  const many = M.addManyToBoard([], ['a.png', 'b.png', 'c.png'], { perRow: 2, size: 100, gap: 0 });
  check('addManyToBoard วางเป็นตาราง', many.length === 3 && many[2].y === 100);
}

// ═══════════════════ 9. แฮชรูป / ค้นรูปคล้าย ═══════════════════
{
  const px = (fn) => {
    const out = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < 64; i++) {
      const v = fn(i % 8, Math.floor(i / 8));
      out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
    }
    return out;
  };
  const left = px((x) => (x < 4 ? 20 : 230));
  // ต่างกันแค่ช่องเดียว (มุมบนซ้ายสว่างขึ้นจนข้ามค่าเฉลี่ย) → แฮชต่างกัน 1 บิต
  const leftish = px((x, y) => (x === 0 && y === 0 ? 250 : (x < 4 ? 20 : 230)));
  const top = px((x, y) => (y < 4 ? 20 : 230));

  const h1 = H.aHash(left), h2 = H.aHash(leftish), h3 = H.aHash(top);
  check('aHash ยาว 16 ตัวอักษร (64 บิต)', h1.length === H.HASH_HEX_LEN, h1);
  check('aHash เหมือนกันเมื่อภาพเหมือนกัน', H.aHash(left) === h1);
  check('aHash ภาพต่างกัน → แฮชต่างกัน', h1 !== h3);
  check('aHash ข้อมูลไม่พอ → ว่าง', H.aHash(new Uint8ClampedArray(4)) === '');
  check('hamming ของแฮชเดียวกัน = 0', H.hamming(h1, h1) === 0);
  check('hamming ภาพซ้าย/บน ต่างกันมาก', H.hamming(h1, h3) >= 16, H.hamming(h1, h3));
  check('hamming ความยาวไม่ตรง → ค่าสูงสุด', H.hamming(h1, 'abc') === 64);
  check('similarity 1 เมื่อเหมือนกัน', H.similarity(h1, h1) === 1);
  check('similarity ภาพใกล้เคียงสูงกว่าภาพต่าง', H.similarity(h1, h2) > H.similarity(h1, h3));
  check('avgColor คำนวณสีเฉลี่ย', H.avgColor(px(() => 100)).hex === '#646464', H.avgColor(px(() => 100)).hex);
  check('avgColor รับข้อมูลว่างได้', H.avgColor(null).hex === '#000000');

  const items = [{ path: 'a', hash: h1 }, { path: 'b', hash: h2 }, { path: 'c', hash: h3 }, { path: 'd' }];
  const sim = H.similarImages(items, items[0], { min: 0.8 });
  check('similarImages ไม่รวมตัวเอง', !sim.some((i) => i.path === 'a'));
  check('similarImages เจอใบที่คล้าย', sim[0] && sim[0].path === 'b', JSON.stringify(sim.map((s) => s.path)));
  check('similarImages ข้ามใบที่ยังไม่มีแฮช', !sim.some((i) => i.path === 'd'));
  check('similarImages เกณฑ์สูง → ไม่เจอใคร', H.similarImages(items, items[0], { min: 0.999 }).length === 0);
  const dup = H.findDuplicates([{ path: 'a', hash: h1 }, { path: 'a2', hash: h1 }, { path: 'c', hash: h3 }]);
  check('findDuplicates จับคู่รูปซ้ำ', dup.length === 1 && dup[0].score === 1, JSON.stringify(dup.map((d) => d.score)));
}

fs.rmSync(ROOT, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
