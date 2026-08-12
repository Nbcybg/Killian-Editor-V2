// test/dirty-registry.test.cjs — ทะเบียนงานค้าง (alpha.72 ข้อ 4)
// กฎ: อะไรที่ทิ้ง/อัปเดตตอนปิดโปรแกรม ต้องขึ้น list ทุกครั้ง
const path = require('path');
const out = path.join(require('os').tmpdir(), '_dirtyreg.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/dirty-registry.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const D = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };
const run = async () => {

// ═══════════ ลงทะเบียน / รวมรายการ ═══════════
{
  const R = D.createDirtyRegistry();
  check('เริ่มต้นว่าง', R.count() === 0 && R.collect().length === 0);
  R.register('tabs', { label: 'ไฟล์ที่เปิดอยู่', list: () => [{ key: 'a.md', title: 'ฉาก ก', file: 'a.md' }] });
  R.register('planner', { label: 'กระดานวางแผน', list: () => [{ key: 'b.json', title: 'กระดานหลัก' }] });
  const all = R.collect();
  check('รวมรายการจากทุกแหล่ง', all.length === 2);
  check('ติดป้ายว่ามาจากแหล่งไหน',
        all[0].source === 'tabs' && all[1].sourceLabel === 'กระดานวางแผน', JSON.stringify(all[1]));
  check('ไม่มี title → ใช้ key แทน',
        D.createDirtyRegistry().register && (() => { const r = D.createDirtyRegistry();
          r.register('x', { list: () => [{ key: 'k1' }] }); return r.collect()[0].title === 'k1'; })());
  check('รายการที่ไม่มี key ถูกข้าม (ไม่ทำรายการเพี้ยน)',
        (() => { const r = D.createDirtyRegistry();
          r.register('x', { list: () => [{ title: 'ไม่มีคีย์' }, { key: 'ok' }] });
          return r.collect().length === 1; })());
  check('ids() บอกว่ามีแหล่งอะไรบ้าง', R.ids().join() === 'tabs,planner');
  check('has()', R.has('planner') === true && R.has('zzz') === false);
  R.unregister('planner');
  check('ถอนทะเบียนได้', R.count() === 1 && !R.has('planner'));
}

// ═══════════ ทนต่อ provider ที่พัง ═══════════
{
  const R = D.createDirtyRegistry();
  R.register('boom', { list: () => { throw new Error('พัง'); } });
  R.register('ok', { list: () => [{ key: 'k' }] });
  check('provider ที่ throw ถูกข้าม ไม่ลากทั้งกล่องล้ม', R.collect().length === 1);
  R.register('null', { list: () => null });
  check('list คืน null ไม่พัง', R.collect().length === 1);
  let threw = false;
  try { R.register('bad', {}); } catch { threw = true; }
  check('ลงทะเบียนโดยไม่มี list() → error ทันที (จับพลาดตั้งแต่ตอนเขียนโค้ด)', threw);
}

// ═══════════ บันทึกตามคีย์ที่เลือก ═══════════
{
  const R = D.createDirtyRegistry();
  const savedKeys = [];
  R.register('tabs', { label: 'ไฟล์', list: () => [{ key: 'a' }, { key: 'b' }],
                       save: async (k) => { savedKeys.push(k); return true; } });
  R.register('planner', { label: 'กระดาน', list: () => [{ key: 'p1' }],
                          save: async (k) => { savedKeys.push(k); return true; } });
  const r = await R.saveKeys(['a', 'p1']);
  check('บันทึกเฉพาะที่เลือก', savedKeys.join() === 'a,p1', savedKeys.join());
  check('รายงานจำนวนที่สำเร็จ', r.saved === 2 && r.failed.length === 0);

  const R2 = D.createDirtyRegistry();
  const done = [];
  R2.register('x', { list: () => [{ key: '1' }, { key: '2' }, { key: '3' }],
    save: async (k) => { if (k === '2') throw new Error('เขียนไม่ได้'); done.push(k); return true; } });
  const r2 = await R2.saveKeys(['1', '2', '3']);
  check('รายการหนึ่งพัง → ที่เหลือยังถูกบันทึกจนครบ', done.join() === '1,3', done.join());
  check('รายงานตัวที่พังพร้อมเหตุผล',
        r2.saved === 2 && r2.failed.length === 1 && r2.failed[0].key === '2' &&
        r2.failed[0].error.includes('เขียนไม่ได้'), JSON.stringify(r2.failed));

  const R3 = D.createDirtyRegistry();
  R3.register('nosave', { list: () => [{ key: 'z' }] });        // ไม่มี save()
  const r3 = await R3.saveKeys(['z']);
  check('แหล่งที่ไม่มีตัวบันทึก → รายงานว่าบันทึกไม่ได้ ไม่เงียบหาย',
        r3.saved === 0 && r3.failed[0].error === 'ไม่มีตัวบันทึก');
  check('คีย์ที่ไม่มีอยู่จริง → ไม่พัง', (await R3.saveKeys(['ไม่มี'])).saved === 0);
  check('ส่ง null เข้ามา → ไม่พัง', (await R3.saveKeys(null)).saved === 0);
}

// ═══════════ รายการเปลี่ยนตามสถานะจริงตลอดเวลา ═══════════
{
  const R = D.createDirtyRegistry();
  let dirty = true;
  R.register('planner', { label: 'กระดาน', list: () => (dirty ? [{ key: 'b1', title: 'กระดานหลัก' }] : []) });
  check('ตอนยังไม่บันทึก → ขึ้นรายการ', R.count() === 1);
  dirty = false;
  check('บันทึกแล้ว → หายจากรายการทันที (list ถูกเรียกสดทุกครั้ง)', R.count() === 0);
}

// ═══════════ ทะเบียนกลางของโปรแกรม ═══════════
{
  check('มีทะเบียนกลาง + ฟังก์ชันย่อ',
        !!D.dirtyRegistry && typeof D.registerDirtySource === 'function' && typeof D.collectDirty === 'function');
  const un = D.registerDirtySource('__t', { label: 'ทดสอบ', list: () => [{ key: 'tk' }] });
  check('registerDirtySource เขียนลงทะเบียนกลางจริง', D.collectDirty().some((x) => x.key === 'tk'));
  un();
  check('ค่าที่คืนมาใช้ถอนทะเบียนได้', !D.collectDirty().some((x) => x.key === 'tk'));
}

console.log(`dirty-registry: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
};
run();
