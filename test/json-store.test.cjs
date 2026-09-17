// test/json-store.test.cjs — [alpha.156] อ่าน-แก้-เขียน JSON แบบเข้าคิว (ไม่ทับของคนอื่น)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-json-store-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'json-store.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const J = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** io จำลองที่อ่าน/เขียนช้า (ให้ซ้อนกันได้จริง) */
function slowIo(files, delay = 5) {
  return {
    readJson: async (p) => { await sleep(delay); if (!(p in files)) throw new Error('ENOENT ' + p); return JSON.parse(files[p]); },
    writeFile: async (p, s) => { await sleep(delay); files[p] = s; },
  };
}

(async () => {
  check('fileKey ไม่สนตัวคั่น/ตัวพิมพ์', J.fileKey('C:\\A\\b.json') === J.fileKey('c:/a/B.JSON'));

  // ── บั๊กเดิม: อ่านพร้อมกัน ต่างคนต่างเขียน → ของคนแรกหาย ──
  {
    const files = { 'D/scenes.json': JSON.stringify({ chapters: { c1: [{ id: 'a', wordCount: 0 }, { id: 'b', synopsis: '' }] } }) };
    const io = slowIo(files);
    const naive = async (fn) => { const d = await io.readJson('D/scenes.json'); fn(d); await io.writeFile('D/scenes.json', JSON.stringify(d)); };
    await Promise.all([
      naive((d) => { d.chapters.c1[0].wordCount = 42; }),
      naive((d) => { d.chapters.c1[1].synopsis = 'ย่อ'; }),
    ]);
    const bad = JSON.parse(files['D/scenes.json']).chapters.c1;
    check('(ยืนยันบั๊กเดิม) เขียนแบบไม่เข้าคิวทำค่าหนึ่งหาย', !(bad[0].wordCount === 42 && bad[1].synopsis === 'ย่อ'), JSON.stringify(bad));
  }
  {
    const files = { 'D/scenes.json': JSON.stringify({ chapters: { c1: [{ id: 'a', wordCount: 0 }, { id: 'b', synopsis: '' }] } }) };
    const io = slowIo(files);
    await Promise.all([
      J.mutateJson(io, 'D/scenes.json', (d) => { d.chapters.c1[0].wordCount = 42; }),
      J.mutateJson(io, 'D/scenes.json', (d) => { d.chapters.c1[1].synopsis = 'ย่อ'; }),
      J.mutateJson(io, 'D/scenes.json', (d) => { d.chapters.c1.push({ id: 'c' }); }),
    ]);
    const good = JSON.parse(files['D/scenes.json']).chapters.c1;
    check('mutateJson: งานซ้อนกันได้ครบทุกค่า', good[0].wordCount === 42 && good[1].synopsis === 'ย่อ' && good.length === 3, JSON.stringify(good));
  }
  // ── คืน false = ไม่เขียน ──
  {
    const files = { f: '{"a":1}' }; let writes = 0;
    const io = { readJson: async (p) => JSON.parse(files[p]), writeFile: async (p, s) => { writes++; files[p] = s; } };
    const r = await J.mutateJson(io, 'f', () => false);
    check('คืน false = ไม่แตะดิสก์', writes === 0 && r.changed === false);
    const r2 = await J.mutateJson(io, 'f', (d) => { d.a = 2; return 'ok'; });
    check('คืนค่าอื่น = เขียน + ส่ง result', writes === 1 && r2.result === 'ok' && JSON.parse(files.f).a === 2);
  }
  // ── fallback ──
  {
    const files = {};
    const io = slowIo(files, 0);
    let threw = false;
    try { await J.mutateJson(io, 'none.json', () => {}); } catch { threw = true; }
    check('ไม่มีไฟล์ + ไม่มี fallback = โยน error', threw);
    await J.mutateJson(io, 'none.json', (d) => { d.chapters.x = []; }, { fallback: { chapters: {} } });
    check('fallback ใช้ได้และถูกเขียน', JSON.parse(files['none.json']).chapters.x.length === 0);
    const fb = { chapters: {} };
    await J.mutateJson(io, 'none2.json', (d) => { d.chapters.y = 1; }, { fallback: fb });
    check('fallback ถูกคัดลอก ไม่แก้ของผู้เรียก', !('y' in fb.chapters));
  }
  // ── งานล้มไม่ขวางคิว ──
  {
    const files = { f: '{"n":0}' };
    const io = slowIo(files, 1);
    const p1 = J.mutateJson(io, 'f', () => { throw new Error('boom'); }).catch((e) => e.message);
    const p2 = J.mutateJson(io, 'f', (d) => { d.n = 5; });
    const [m] = await Promise.all([p1, p2]);
    check('งานที่ล้มส่ง error ให้ผู้เรียก', m === 'boom');
    check('งานถัดไปยังทำงานได้', JSON.parse(files.f).n === 5);
  }
  // ── ลำดับ + คิวไม่รั่ว ──
  {
    const order = [];
    await Promise.all([1, 2, 3].map((i) => J.withFileLock('q', async () => { await sleep(4 - i); order.push(i); })));
    check('withFileLock เรียงตามลำดับที่ขอ', order.join(',') === '1,2,3', order.join(','));
    const o2 = [];
    await Promise.all([
      J.withFileLock('C:\\P\\scenes.json', async () => { await sleep(6); o2.push('a'); }),
      J.withFileLock('c:/p/SCENES.json', async () => { o2.push('b'); }),
    ]);
    check('path สะกดต่างกัน = คิวเดียวกัน', o2.join('') === 'ab', o2.join(''));
    await sleep(5);
    check('คิวว่างหลังงานจบ (ไม่รั่ว)', J.pendingLocks() === 0, J.pendingLocks());
  }

  console.log(`\njson-store: ${pass} ผ่าน · ${fail} ไม่ผ่าน`);
  if (fail) process.exit(1);
})();
