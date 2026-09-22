// test/tab-guard.test.cjs — [alpha.160 · P0-2/P0-3] ด่านกันข้อมูลหายก่อนลบ/ย้ายไฟล์ที่เปิดเป็นแท็บ
// ของจริงที่ผูกกับ deleteToTrash · moveSceneToChapter · closeAllTabs · closeTabsUnderPath (โมดูลบริสุทธิ์)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-tabguard-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'tab-guard.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const G = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

(async () => {
  // ── flushTab: ตัวตัดสินว่า "ลบ/ย้ายต่อได้ไหม" ──
  let calls = 0;
  const okSave = async (t) => { calls++; t.dirty = false; };
  check('ไม่มีแท็บ = ไปต่อได้', await G.flushTab(null, okSave) === true);
  check('แท็บไม่ค้าง = ไปต่อได้ และไม่เรียกบันทึก', await G.flushTab({ dirty: false }, okSave) === true && calls === 0);
  check('แท็บค้าง + บันทึกผ่าน = ไปต่อได้', await G.flushTab({ dirty: true }, okSave) === true && calls === 1);
  // ★ ต้นตอ P0-2: saveTab คืน false (ผู้ใช้กดยกเลิกกล่อง "ไฟล์ถูกแก้นอกโปรแกรม") แต่ผู้เรียกกลืนค่าทิ้ง
  const tCancel = { dirty: true };
  check('★ บันทึกคืน false (ผู้ใช้ยกเลิก) = ห้ามลบ/ย้าย', await G.flushTab(tCancel, async () => false) === false);
  check('★ ยกเลิกแล้ว แท็บยังค้าง (ไม่ถูกตั้ง dirty=false ทิ้ง)', tCancel.dirty === true);
  check('★ บันทึก throw (เขียนไม่ได้) = ห้ามลบ/ย้าย',
    await G.flushTab({ dirty: true }, async () => { throw new Error('EPERM'); }) === false);
  // บันทึกผ่านแต่มีการพิมพ์แทรกระหว่างเขียน (alpha.148) → แท็บยัง dirty = ยังไม่ปลอดภัย
  check('บันทึกเสร็จแต่ยังค้าง (พิมพ์แทรกระหว่างเขียน) = ห้ามลบ/ย้าย',
    await G.flushTab({ dirty: true }, async () => undefined) === false);

  // ── closeResult: รูปผลของ closeTabsUnderPath ──
  const r0 = G.closeResult(3, 0), r1 = G.closeResult(2, 1);
  check('closeResult: ปิดครบ = ok', r0.ok === true && r0.closed === 3 && r0.skipped === 0);
  check('★ closeResult: มีแท็บค้าง = ไม่ ok (ผู้เรียกต้องยกเลิกการลบ/ย้าย)', r1.ok === false && r1.skipped === 1);
  check('closeResult: ค่าแปลก ๆ ไม่พัง', G.closeResult(undefined, NaN).ok === true);

  // ── tabsSafeToClose: คำสั่ง "ปิดทุกแท็บ" ──
  const tabs = [{ file: 'a', dirty: false }, { file: 'b', dirty: true }, { file: 'c', dirty: true }, { file: 'd', dirty: false }];
  // ผู้ใช้ติ๊กบันทึก b กับ c · b บันทึกไม่ผ่าน · c ไม่ได้ติ๊ก? → ในกรณีนี้ c ถูกติ๊กแต่ยังค้าง
  const s1 = G.tabsSafeToClose(tabs, new Set(['b']), new Set(['b']));
  check('★ ปิดทุกแท็บ: แท็บที่ติ๊กบันทึกแต่บันทึกไม่ผ่าน = ไม่ปิด', s1.keep.join() === 'b', JSON.stringify(s1));
  check('ปิดทุกแท็บ: แท็บที่ไม่ได้ติ๊ก = ผู้ใช้เลือกทิ้ง → ปิดได้', s1.close.includes('c'));
  check('ปิดทุกแท็บ: แท็บที่ไม่ค้าง ปิดได้', s1.close.includes('a') && s1.close.includes('d'));
  const s2 = G.tabsSafeToClose(tabs, null, new Set());
  check('ปิดทุกแท็บ: ผู้ใช้กด "ไม่บันทึก" = ปิดทั้งหมด', s2.close.length === 4 && !s2.keep.length);
  const s3 = G.tabsSafeToClose(tabs, new Set(['b', 'c']), new Set());
  check('ปิดทุกแท็บ: ติ๊กแต่ยัง dirty (บันทึกไม่จบ) = ไม่ปิด', s3.keep.join() === 'b,c', JSON.stringify(s3));

  // ── [alpha.160 · P1-3] liveBody: แท็บที่เปิดอยู่ชนะดิสก์ (ทุกทางที่ส่งเนื้อฉากให้ AI) ──
  const tmpB = path.join(os.tmpdir(), 'k2-tabbridge-test.cjs');
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'tab-bridge.js')],
    outfile: tmpB, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  const TB = require(tmpB);
  check('liveBody: ไม่มี bridge = เนื้อดิสก์', TB.liveBody('/p/a.md', 'ดิสก์') === 'ดิสก์');
  TB.setTabBridge({ find: (p) => (p === '/p/a.md' ? { kind: 'prose', getText: () => 'ในแท็บ (ยังไม่บันทึก)' }
                                  : p === '/p/w.json' ? { kind: 'wiki', getText: () => 'x' }
                                  : p === '/p/bad.md' ? { kind: 'prose', getText: () => { throw new Error('x'); } } : null) });
  check('★ liveBody: ฉากที่เปิดอยู่ = เนื้อในแท็บ (รวมส่วนที่ยังไม่บันทึก)', TB.liveBody('/p/a.md', 'ดิสก์') === 'ในแท็บ (ยังไม่บันทึก)');
  check('liveBody: ไฟล์ที่ไม่ได้เปิด = ดิสก์', TB.liveBody('/p/b.md', 'ดิสก์') === 'ดิสก์');
  check('liveBody: แท็บ Wiki ไม่ใช่เนื้อฉาก = ดิสก์', TB.liveBody('/p/w.json', 'ดิสก์') === 'ดิสก์');
  check('liveBody: แท็บพัง = ตกกลับดิสก์ ไม่ throw', TB.liveBody('/p/bad.md', 'ดิสก์') === 'ดิสก์');
  TB.setTabBridge(null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
