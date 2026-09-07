// test/log-core.test.cjs — แกนระบบ log (alpha.72 ข้อ 5)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_logcore.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/log-core.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const L = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };
const TS = '2026-08-12T10:20:30.000Z';

// ═══════════ ระดับ ═══════════
check('ระดับที่รู้จักผ่านตรง ๆ', L.normLevel('error') === 'error' && L.normLevel('WARN') === 'warn');
check('ระดับแปลก ๆ → info', L.normLevel('zzz') === 'info' && L.normLevel(null) === 'info' && L.normLevel() === 'info');
check('LEVELS เรียงตามความสำคัญ', L.LEVELS.join() === 'error,warn,info,debug');
check('ทุกระดับมีไอคอน+ชื่อไทย', L.LEVELS.every((k) => L.LEVEL_META[k].icon && L.LEVEL_META[k].label));

// ═══════════ splitSource — ได้ "ที่มา" ฟรีจากรูปแบบที่โค้ดใช้อยู่แล้ว ═══════════
{
  check('ถอดที่มาจาก "floorplan: ..."',
        L.splitSource('floorplan: อ่านฉากไม่ได้').source === 'floorplan' &&
        L.splitSource('floorplan: อ่านฉากไม่ได้').msg === 'อ่านฉากไม่ได้');
  check('ที่มามีจุด/ขีด/ทับได้', L.splitSource('planner/tree: สร้างหมวด').source === 'planner/tree');
  check('ที่มาสองคำได้', L.splitSource('save all: เสร็จ').source === 'save all');
  // `\w` ของ JS ไม่นับตัวอักษรไทย — ต้องใช้ \p{L} + ธง u ไม่งั้นที่มาภาษาไทยหลุดหมด
  check('ที่มาภาษาไทยใช้ได้', L.splitSource('แผนที่: โหลดไม่สำเร็จ').source === 'แผนที่',
        L.splitSource('แผนที่: โหลดไม่สำเร็จ').source);
  check('ที่มาไทยปนเลข/อังกฤษ', L.splitSource('ทดสอบ72: ข้อความ').source === 'ทดสอบ72');
  check('ไม่มี ":" → ไม่มีที่มา', L.splitSource('เริ่มโปรแกรม').source === '');
  check('ประโยคยาวที่บังเอิญมี ":" ไม่ถูกตัดเป็นที่มา',
        L.splitSource('เปิดไฟล์ไม่ได้ เพราะสิทธิ์ไม่พอ: ลองใหม่').source === '',
        L.splitSource('เปิดไฟล์ไม่ได้ เพราะสิทธิ์ไม่พอ: ลองใหม่').source);
  check('":" ตัวแรกอยู่หน้าสุด → ไม่ใช่ที่มา', L.splitSource(': ว่าง').source === '');
  check('ค่า null/undefined ไม่พัง', L.splitSource(null).msg === '' && L.splitSource(undefined).msg === '');
  check('ที่มายาวเกิน 24 ตัว → ไม่ถือเป็นที่มา',
        L.splitSource('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: x').source === '');
}

// ═══════════ detailText ═══════════
{
  const err = new Error('พัง');
  check('Error → มี stack', L.detailText(err).includes('พัง'));
  check('string → ตัวเดิม', L.detailText('abc') === 'abc');
  check('object → JSON อ่านออก', L.detailText({ a: 1 }).includes('"a": 1'));
  check('undefined/null → ว่าง', L.detailText(undefined) === '' && L.detailText(null) === '');
  const circ = { n: 1 }; circ.self = circ;
  check('object วนซ้ำไม่ทำโปรแกรมพัง', L.detailText(circ).includes('วนซ้ำ'), L.detailText(circ));
  check('Error ที่ซ่อนใน object ก็ยังอ่านออก',
        L.detailText({ e: new Error('ข้างใน') }).includes('ข้างใน'));
  check('ฟังก์ชันใน object ไม่ทำ JSON พัง', L.detailText({ f: () => 1 }).includes('function'));
}

// ═══════════ createLogStore ═══════════
{
  const s = L.createLogStore(100);
  s.push('info', 'app: เริ่มโปรแกรม', undefined, TS);
  s.push('error', 'maps: อ่านไฟล์ไม่ได้', new Error('boom'), TS);
  s.push('warn', 'ไม่มีที่มา', undefined, TS);
  check('เก็บระเบียนครบ', s.size() === 3);
  check('นับแยกระดับ', s.counts().error === 1 && s.counts().warn === 1 && s.counts().info === 1);
  check('รายชื่อที่มาไม่ซ้ำ + เรียง', s.sources().join() === 'app,maps', s.sources().join());
  check('seq เดินหน้าเรื่อย ๆ', s.lastSeq() === 3);
  check('ระเบียน error เก็บ stack ไว้ด้วย', s.all()[1].detail.includes('boom'));
  check('ระเบียนไม่มีที่มา → source ว่าง', s.all()[2].source === '');

  // ซ้ำติดกัน → นับรวม
  const r1 = s.push('warn', 'net: ช้า', undefined, TS);
  const r2 = s.push('warn', 'net: ช้า', undefined, TS);
  check('บรรทัดซ้ำติดกันถูกยุบเป็นระเบียนเดียว', r1 === r2 && r1.count === 2 && s.size() === 4);
  s.push('info', 'net: ปกติ', undefined, TS);
  s.push('warn', 'net: ช้า', undefined, TS);
  check('ซ้ำแต่ไม่ติดกัน = ระเบียนใหม่', s.size() === 6 && s.all()[5].count === 1);

  // ตัดของเก่าเมื่อเต็ม
  const small = L.createLogStore(50);          // ต่ำสุดถูกหนีบไว้ที่ 50
  for (let i = 0; i < 80; i++) small.push('info', 'x: บรรทัด ' + i, undefined, TS);
  check('บัฟเฟอร์เต็มแล้วตัดของเก่าทิ้ง', small.size() === 50, String(small.size()));
  check('ตัดแล้วยอดนับตามจริง ไม่ค้างค่าเก่า', small.counts().info === 50, String(small.counts().info));
  check('ของที่เหลือคือบรรทัดล่าสุด', small.all()[49].msg === 'บรรทัด 79');
  check('ขนาดต่ำกว่า 50 ถูกหนีบ', (() => { const t = L.createLogStore(1);
    for (let i = 0; i < 60; i++) t.push('info', 'a', undefined, TS); return t.size() === 1; })(),
    'บรรทัดซ้ำติดกันยุบเหลือ 1 อยู่แล้ว');
  s.clear();
  check('ล้างแล้วว่างจริง + ยอดนับเป็นศูนย์', s.size() === 0 && s.counts().error === 0);
}

// ═══════════ filterLogs ═══════════
{
  const s = L.createLogStore(100);
  s.push('error', 'maps: เปิดไฟล์ไม่ได้', 'ENOENT', TS);
  s.push('warn', 'maps: รูปหาย', undefined, TS);
  s.push('info', 'app: บันทึกฉากแล้ว', undefined, TS);
  s.push('debug', 'net: วาดผัง', undefined, TS);
  const all = s.all();
  check('ไม่ใส่เงื่อนไข = ได้ทั้งหมด', L.filterLogs(all).length === 4 && L.filterLogs(all, {}).length === 4);
  check('กรองระดับเดียว', L.filterLogs(all, { levels: ['error'] }).length === 1);
  check('กรองหลายระดับ (Set ก็ได้)', L.filterLogs(all, { levels: new Set(['error', 'warn']) }).length === 2);
  check('กรองตามที่มา', L.filterLogs(all, { source: 'maps' }).length === 2);
  check('ค้นข้อความ', L.filterLogs(all, { q: 'บันทึก' }).length === 1);
  check('ค้นในรายละเอียดด้วย (stack/โค้ดข้อผิดพลาด)', L.filterLogs(all, { q: 'enoent' }).length === 1);
  check('ค้นในที่มาด้วย', L.filterLogs(all, { q: 'net' }).length === 1);
  check('เงื่อนไขผสม', L.filterLogs(all, { levels: ['error', 'warn'], q: 'รูป' }).length === 1);
  check('ไม่เจอ → ว่าง', L.filterLogs(all, { q: 'ไม่มีจริง' }).length === 0);
  check('recs ว่าง/null ไม่พัง', L.filterLogs(null, { q: 'x' }).length === 0);
}

// ═══════════ รูปแบบข้อความ ═══════════
{
  const s = L.createLogStore(10);
  const r = s.push('error', 'maps: พัง', new Error('เหตุ'), TS);
  const line = L.formatLine(r);
  check('formatLine มีเวลา/ระดับ/ที่มา/ข้อความ',
        line.includes(TS) && line.includes('ERROR') && line.includes('maps:') && line.includes('พัง'), line);
  check('รายละเอียดถูกยุบเป็นบรรทัดเดียวในไฟล์ (ไม่ทำ log เละ)',
        !L.formatLine(r).slice(1).includes('\n'), JSON.stringify(line.slice(0, 90)));
  check('shortTime ตัดเหลือ HH:MM:SS', L.shortTime(TS) === '10:20:30', L.shortTime(TS));
  check('shortTime ค่าพังไม่ throw', typeof L.shortTime('') === 'string' && typeof L.shortTime(null) === 'string');
  check('summarize บอกยอดเฉพาะระดับที่มีจริง',
        L.summarize({ error: 2, warn: 0, info: 5 }) === '⛔ 2 · ℹ 5', L.summarize({ error: 2, warn: 0, info: 5 }));
  check('summarize ไม่มีอะไรเลย → ว่าง', L.summarize({}) === '' && L.summarize(null) === '');
  s.push('warn', 'a: ซ้ำ', undefined, TS); s.push('warn', 'a: ซ้ำ', undefined, TS);
  check('exportText บอกจำนวนครั้งที่ซ้ำ', L.exportText(s.all()).includes('ซ้ำ 2 ครั้ง'), L.exportText(s.all()));
  check('exportText ว่างไม่พัง', L.exportText(null) === '' && L.exportText([]) === '');
}

console.log(`log-core: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
