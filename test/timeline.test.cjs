// test/timeline.test.cjs — ทดสอบเอนจินเส้นเวลา (timeline.js) ด้วย node
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// เน้นจุดที่เคยพลาด: mergeTimeline ต้อง copy ทุก field ที่ UI ใช้ (whenEnd, refs)
const path = require('path');
const out = path.join(require('os').tmpdir(), '_tl.cjs');   // '/tmp' ใช้บน Windows ไม่ได้
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/timeline.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const TL = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ── extractNum: ถอดเลขจากข้อความไทย ──
check('ถอดเลขจาก "ปีที่ 1,024"', TL.extractNum('ปีที่ 1,024') === 1024);
check('ถอดเลขจาก "วันที่ 3"', TL.extractNum('วันที่ 3') === 3);
check('ถอดเลขทศนิยม', TL.extractNum('ชั่วโมงที่ 2.5') === 2.5);
check('ไม่มีเลข → null', TL.extractNum('เช้าวันจันทร์') === null);
check('null/undefined ไม่พัง', TL.extractNum(null) === null && TL.extractNum(undefined) === null);

// ── sortEvents ──
{
  const s = TL.sortEvents([
    { id: 'c', when: 'ปีที่ 300' }, { id: 'a', when: 'ปีที่ 5' },
    { id: 'x', when: 'เช้าวันหนึ่ง' }, { id: 'b', when: 'ปีที่ 40' },
  ]);
  check('เรียงตามตัวเลขในข้อความ', s.slice(0, 3).map((e) => e.id).join() === 'a,b,c', s.map((e) => e.id).join());
  check('เหตุการณ์ไม่มีเลขไปท้ายสุด', s[3].id === 'x');
  // q ถ้าอ่านจาก when จะได้ 1 (มาก่อน p=3) — แต่ sort:5 ต้องชนะ ทำให้ p มาก่อน
  check('sort (ตัวเลข) ชนะการถอดเลขจาก when',
        TL.sortEvents([{ id: 'q', when: 'ปีที่ 1', sort: 5 }, { id: 'p', when: 'ปีที่ 3' }])[0].id === 'p');
}

// ── mergeTimeline: ต้องไม่ทำ field หาย ──
{
  const ev = { id: 'e1', title: 'สงคราม', when: 'ปีที่ 10', whenEnd: 'ปีที่ 12',
               track: 'หลัก', sort: 10, order: 2, color: '#f00', tags: ['ศึก'],
               desc: 'รบกัน', refs: [{ kind: 'scene', path: 'A/Draft/d/Chapters/c/s.md', title: 'ฉากรบ' }] };
  const sc = { id: 'sc:1', title: 'ฉากหนึ่ง', when: 'ปีที่ 11', track: 'หลัก',
               file: 'C:/p/a.md', color: '#0f0', synopsis: 'ย่อ' };
  const m = TL.mergeTimeline([ev], [sc]);
  const got = m.find((x) => x.id === 'e1');
  check('mergeTimeline คง whenEnd (เคยลืม → Gantt กลายเป็นจุด)', got.whenEnd === 'ปีที่ 12', got.whenEnd);
  check('mergeTimeline คง refs (ข้อ 5)', got.refs.length === 1 && got.refs[0].title === 'ฉากรบ');
  check('mergeTimeline คง sort/order/color/tags/desc',
        got.sort === 10 && got.order === 2 && got.color === '#f00' &&
        got.tags.join() === 'ศึก' && got.desc === 'รบกัน');
  const gs = m.find((x) => x.id === 'sc:1');
  check('ฉากถูกแปลงเป็นเหตุการณ์ kind=scene พร้อม file', gs.kind === 'scene' && gs.file === 'C:/p/a.md');
  check('ฉากใช้ synopsis เป็นรายละเอียด', gs.desc === 'ย่อ');
  check('ฉากได้ refs เป็น [] ไม่ใช่ undefined', Array.isArray(gs.refs) && gs.refs.length === 0);
  check('เหตุการณ์ที่ไม่มี refs ได้ [] (ไฟล์เก่าไม่มี field นี้)',
        TL.mergeTimeline([{ id: 'z', when: 'ปีที่ 1' }], [])[0].refs.length === 0);
}

// ── normalizeRefs (ข้อ 5) ──
{
  const r = TL.normalizeRefs([
    { kind: 'scene', path: 'A\\Draft\\d\\Chapters\\c\\s.md', title: 'ฉาก' },
    { kind: 'scene', path: 'A/Draft/d/Chapters/c/s.md' },      // ซ้ำ (คนละ separator)
    { kind: 'memo', path: 'Memos/n.md' },
    { path: 'Memos/x.md' },                                     // ไม่ระบุ kind
    { kind: 'scene' },                                          // ไม่มี path → ทิ้ง
    null,
  ]);
  check('normalizeRefs แปลง \\ เป็น / แล้วยุบซ้ำ', r.length === 3, JSON.stringify(r.map((x) => x.path)));
  check('normalizeRefs เก็บ title เดิม', r[0].title === 'ฉาก');
  check('normalizeRefs เดา title จากชื่อไฟล์ถ้าไม่ให้มา', r[1].title === 'n.md');
  check('normalizeRefs ค่า kind ที่ไม่รู้จัก → scene', r[2].kind === 'scene');
  check('normalizeRefs ทิ้งรายการที่ไม่มี path / เป็น null', !r.some((x) => !x || !x.path));
  check('normalizeRefs รับค่าที่ไม่ใช่อาร์เรย์ได้', TL.normalizeRefs(undefined).length === 0);
  check('newEvent มี refs เป็น [] ตั้งแต่ต้น', Array.isArray(TL.newEvent().refs));
}

// ── groupByTrack / trackNames / findClashes ──
{
  const items = [{ id: '1', track: 'หลัก', when: 'ปีที่ 1' }, { id: '2', when: 'ปีที่ 2' },
                 { id: '3', track: 'หลัก', when: 'ปีที่ 1' }];
  const gr = TL.groupByTrack(items);
  check('จัดกลุ่มตาม track คงลำดับที่พบก่อน', gr[0].name === 'หลัก' && gr[1].name === 'ทั่วไป');
  check('เลนว่างใช้ชื่อ default', gr[1].items.length === 1);
  check('trackNames รวมจากทั้ง 2 แหล่ง',
        TL.trackNames([{ track: 'a' }], [{ track: 'b' }]).sort().join() === 'a,b');
  const cl = TL.findClashes(items);
  check('ตรวจเวลาชนกันใน track เดียวกัน', cl.length === 1 && cl[0].length === 2);
}

// ── Gantt ──
{
  const g = TL.ganttData([
    { id: 'a', when: 'ปีที่ 10', whenEnd: 'ปีที่ 20' },
    { id: 'b', when: 'ปีที่ 15' },
    { id: 'c', when: 'ไม่มีเลข' },
  ]);
  check('ganttData ตัดเหตุการณ์ที่ไม่มีเลขออก', g.rows.length === 2 && g.undated.length === 1);
  check('ganttData หา min/max ถูก', g.min === 10 && g.max === 20, `${g.min}-${g.max}`);
  check('เหตุการณ์จุดเดียว _end = _start', g.rows[1]._start === 15 && g.rows[1]._end === 15);
  const bar = TL.ganttBar(g.rows[0], g.min, g.span);
  check('ganttBar เริ่มที่ 0% เมื่อเป็นตัวแรกสุด', bar.left === 0 && bar.width === 100);
  check('แท่งจุดเดียวยังมีความกว้างขั้นต่ำ', TL.ganttBar(g.rows[1], g.min, g.span).width >= 1.2);
  check('ganttTicks คืนขีดอย่างน้อย 1 อัน', TL.ganttTicks(10, 20, 6).length >= 1);
  check('ganttTicks กรณี min=max ไม่พัง', TL.ganttTicks(5, 5).length === 1);
  check('ganttData กับอาร์เรย์ว่างไม่พัง', TL.ganttData([]).rows.length === 0);
}

console.log(`timeline: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
