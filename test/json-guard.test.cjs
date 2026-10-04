// test/json-guard.test.cjs — [alpha.168 · bug hunt] ไฟล์ JSON ที่อ่านไม่ออกต้องไม่ถูกมองเป็น "ไฟล์ว่าง" แล้วเขียนทับ
const path = require('path');
const fs = require('fs');
const os = require('os');
const out = path.join(os.tmpdir(), '_jsonguard.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/json-guard.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const G = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

/** io ปลอมบนหน่วยความจำ — readJson ตัด BOM เหมือน main.js ตัวจริง */
function fakeIo(files, o = {}) {
  const copies = [];
  return {
    files, copies,
    exists: async (p) => p in files,
    readJson: async (p) => JSON.parse(String(files[p]).replace(/^\uFEFF/, '')),
    copyFile: async (a, b) => { if (o.copyFails) throw new Error('EACCES'); files[b] = files[a]; copies.push(b); return true; },
    mtime: async (p) => (o.mtime ? o.mtime(p) : String(files[p]).length),
  };
}
const fb = () => ({ version: '1', maps: [] });

(async () => {
  // ── ชื่อไฟล์สำรอง ──
  const d = new Date(2026, 9, 4, 1, 5, 9);
  check('ชื่อสำรองอยู่โฟลเดอร์เดิม + นามสกุลเดิม', G.brokenBackupName('C:\\p\\maps.json', d) === 'C:\\p\\maps.unreadable-20261004-010509.json', G.brokenBackupName('C:\\p\\maps.json', d));
  check('ทางแบบ / ก็ได้', G.brokenBackupName('/p/q/timeline.json', d) === '/p/q/timeline.unreadable-20261004-010509.json');
  check('ไม่มีนามสกุล', G.brokenBackupName('/p/data', d) === '/p/data.unreadable-20261004-010509');

  // ── ไฟล์ไม่มี = ค่าว่าง เขียนได้ ──
  {
    G.resetJsonGuard();
    const io = fakeIo({});
    const r = await G.readJsonGuarded(io, '/p/maps.json', fb);
    check('ไม่มีไฟล์ = missing', r.state === 'missing' && r.writable && !r.fresh && r.data.maps.length === 0);
    check('ไม่มีไฟล์ = ไม่สำรองอะไร', io.copies.length === 0);
  }
  // ── ไฟล์ปกติ ──
  {
    G.resetJsonGuard();
    const io = fakeIo({ '/p/maps.json': '{"maps":[{"id":"a"}]}' });
    const r = await G.readJsonGuarded(io, '/p/maps.json', fb);
    check('อ่านได้ = ok', r.state === 'ok' && r.data.maps[0].id === 'a' && r.writable);
  }
  // ── ไฟล์มี BOM (Notepad) ต้องอ่านได้ ไม่ใช่กลายเป็นว่าง ──
  {
    G.resetJsonGuard();
    const io = fakeIo({ '/p/maps.json': '\uFEFF{"maps":[{"id":"a"},{"id":"b"}]}' });
    const r = await G.readJsonGuarded(io, '/p/maps.json', fb);
    check('★ ไฟล์มี BOM อ่านได้ครบ (เดิม = ว่าง แล้วถูกเขียนทับ)', r.state === 'ok' && r.data.maps.length === 2);
  }
  // ── ไฟล์เสีย: สำรองก่อน แล้วค่อยคืนค่าว่าง ──
  {
    G.resetJsonGuard();
    const io = fakeIo({ '/p/maps.json': '{"maps":[{"id":"a"},' });
    const r = await G.readJsonGuarded(io, '/p/maps.json', fb, { now: d });
    check('ไฟล์เสีย = broken + มีสำเนา', r.state === 'broken' && r.backup === '/p/maps.unreadable-20261004-010509.json');
    check('★ สำเนามีเนื้อเดิมครบ', io.files[r.backup] === '{"maps":[{"id":"a"},');
    check('สำรองแล้ว = เขียนต่อได้ + แจ้งครั้งแรก', r.writable && r.fresh && r.data.maps.length === 0);
    // โหลดซ้ำ (แผงวาดใหม่) — ห้ามปั๊มสำเนาเพิ่ม ห้ามแจ้งซ้ำ
    const r2 = await G.readJsonGuarded(io, '/p/maps.json', fb, { now: new Date(2026, 9, 4, 1, 6, 0) });
    check('★ โหลดซ้ำไม่สำรองซ้ำ', io.copies.length === 1 && r2.backup === r.backup && !r2.fresh && r2.state === 'broken');
    // ไฟล์เสียแบบใหม่ (เนื้อเปลี่ยน) = สำรองอีกใบ
    io.files['/p/maps.json'] = '{"maps":[{"id":"zz"';
    const r3 = await G.readJsonGuarded(io, '/p/maps.json', fb, { now: new Date(2026, 9, 4, 1, 7, 0) });
    check('เนื้อเสียแบบใหม่ = สำรองใหม่', io.copies.length === 2 && r3.fresh && r3.backup !== r.backup);
    // ผู้ใช้ซ่อมไฟล์แล้ว = กลับเป็นปกติ
    io.files['/p/maps.json'] = '{"maps":[]}';
    const r4 = await G.readJsonGuarded(io, '/p/maps.json', fb);
    check('ซ่อมแล้ว = ok', r4.state === 'ok' && r4.writable);
  }
  // ── สำรองไม่ได้ = ห้ามเขียนทับ ──
  {
    G.resetJsonGuard();
    const io = fakeIo({ '/p/timeline.json': 'not json' }, { copyFails: true });
    const r = await G.readJsonGuarded(io, '/p/timeline.json', () => ({ events: [] }));
    check('★ สำรองไม่ได้ = writable:false (ผู้เรียกต้องไม่เขียนทับ)', r.state === 'broken' && r.backup === '' && r.writable === false && r.fresh);
    const r2 = await G.readJsonGuarded(io, '/p/timeline.json', () => ({ events: [] }));
    check('สำรองไม่ได้ = ลองใหม่ทุกครั้ง ยังห้ามเขียน', r2.writable === false);
  }
  // ── ค่าที่ไม่ใช่วัตถุ (ไฟล์ถูกเขียนเป็น "null") = เสีย ──
  {
    G.resetJsonGuard();
    const io = fakeIo({ '/p/maps.json': 'null' });
    const r = await G.readJsonGuarded(io, '/p/maps.json', fb);
    check('null = broken (ไม่ใช่ ok แล้วไปล้มทีหลัง)', r.state === 'broken' && !!r.backup);
  }
  // ── main.js ตัวจริงต้องตัด BOM ──
  {
    const src = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    check('★ fs:readJson ใน main.js ตัด BOM ก่อน parse', /H\('fs:readJson'[^\n]*replace\(\/\^\\uFEFF\/, ''\)/.test(src));
  }
  // ── ผู้อ่านไฟล์ระดับโปรเจกต์ต้องผ่านตัวกัน (ห้ามกลับไปเป็น catch { return ว่าง }) ──
  {
    const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    const body = (name) => { const i = app.indexOf('export async function ' + name + '('); return i < 0 ? '' : app.slice(i, app.indexOf('\n}', i)); };
    check('★ loadMaps ใช้ readJsonGuarded', /readProjectJson\(|readJsonGuarded\(/.test(body('loadMaps')), body('loadMaps').slice(0, 200));
    check('★ loadTimeline ใช้ readJsonGuarded', /readProjectJson\(|readJsonGuarded\(/.test(body('loadTimeline')));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
