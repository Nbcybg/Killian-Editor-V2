// test/timeline-board.test.cjs — [alpha.167] บอร์ดเส้นเวลา (ภาพอ้างอิง 1) + ส่งออก — ตรรกะใน timeline.js
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_tlb.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/timeline.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const TL = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ── eventSpan ──
check('eventSpan: จุดเดียว', JSON.stringify(TL.eventSpan({ when: 'ปีที่ 5' })) === '{"start":5,"end":5}');
check('eventSpan: มีช่วง', JSON.stringify(TL.eventSpan({ when: 'ปีที่ 5', whenEnd: 'ปีที่ 9' })) === '{"start":5,"end":9}');
check('eventSpan: จบก่อนเริ่ม = จุดเดียว', TL.eventSpan({ when: '10', whenEnd: '3' }).end === 10);
check('eventSpan: sort ชนะข้อความ', TL.eventSpan({ when: 'ปีที่ 1', sort: 40 }).start === 40);
check('eventSpan: ไม่มีเลข = null', TL.eventSpan({ when: 'เช้าวันหนึ่ง' }) === null);

// ── replaceNum: ลากการ์ดแล้วรูปแบบที่ผู้ใช้พิมพ์ต้องอยู่ครบ ──
check('replaceNum คงคำนำหน้า/ต่อท้าย', TL.replaceNum('ปีที่ 1,024 ฤดูฝน', 1030) === 'ปีที่ 1030 ฤดูฝน');
check('replaceNum ติดลบได้', TL.replaceNum('ปีที่ 5', -3) === 'ปีที่ -3');
check('replaceNum ไม่มีเลข = เลขเปล่า', TL.replaceNum('เช้า', 7) === '7');
check('replaceNum ปัดทศนิยมยาว', TL.replaceNum('วัน 1', 2.00000001) === 'วัน 2');

// ── timeUnitLabel ──
check('หน่วยที่ใช้บ่อยสุด', TL.timeUnitLabel([{ when: 'ปีที่ 3' }, { when: 'ปีที่ 5' }, { when: 'วัน 1' }]) === 'ปีที่');
check('ไม่มีหน่วย = ว่าง', TL.timeUnitLabel([{ when: '3' }]) === '');

// ── packRows: การ์ดไม่ทับกัน ──
{
  const pk = TL.packRows([{ id: 'a', x: 0, w: 100 }, { id: 'b', x: 50, w: 100 }, { id: 'c', x: 120, w: 50 }]);
  check('packRows: ทับกัน → คนละแถว', pk.get('a') !== pk.get('b'));
  check('packRows: ว่างแล้วใช้แถวเดิมซ้ำ', pk.get('c') === pk.get('a'));
  const pk2 = TL.packRows([{ id: 'a', x: 0, w: 100 }, { id: 'b', x: 105, w: 10 }], 12);
  check('packRows: ห่างไม่ถึง gap = ขึ้นแถวใหม่', pk2.get('b') === 1);
}

// ── fitPxPerUnit / boardTicks ──
check('fitPxPerUnit: 100 หน่วยในกว้าง 1080 (pad 40) = 10px/หน่วย', TL.fitPxPerUnit(0, 100, 1080, 40) === 10);
check('fitPxPerUnit: ช่วงศูนย์ไม่หารศูนย์', Number.isFinite(TL.fitPxPerUnit(5, 5, 800)));
check('boardTicks: มีขีดอย่างน้อยสองขีด', TL.boardTicks(0, 100, 900).length >= 2);

// ── เส้นเชื่อม ──
{
  const sc = { kind: 'scene', id: 'sc:/p/Draft/a:s1' };
  check('linkKey ฉาก = scene:<id> (ไม่ผูกทางบนดิสก์)', TL.linkKey(sc) === 'scene:s1');
  check('linkKey เหตุการณ์ = id', TL.linkKey({ kind: 'event', id: 'ev-1' }) === 'ev-1');
  let L = TL.addLink([], 'a', 'b');
  check('addLink เพิ่มได้', L.length === 1 && L[0].from === 'a');
  check('addLink ซ้ำ/กลับทิศ = ไม่เพิ่ม', TL.addLink(L, 'a', 'b').length === 1 && TL.addLink(L, 'b', 'a').length === 1);
  check('addLink ชี้ตัวเอง = ไม่เพิ่ม', TL.addLink(L, 'a', 'a').length === 1);
  check('removeLink', TL.removeLink(L, 'a', 'b').length === 0);
  check('normalizeLinks ทิ้งขยะ', TL.normalizeLinks([null, { from: 'x' }, { from: 'a', to: 'a' }, { from: 'a', to: 'b' }, { from: 'a', to: 'b' }]).length === 1);
  const items = [{ kind: 'event', id: 'a', when: 'ปี 10' }, { kind: 'event', id: 'b', when: 'ปี 3' }];
  check('liveLinks ทิ้งเส้นที่ปลายหาย', TL.liveLinks([{ from: 'a', to: 'b' }, { from: 'a', to: 'zz' }], items).length === 1);
  check('backwardLinks จับเส้นย้อนเวลา', TL.backwardLinks([{ from: 'a', to: 'b' }], items).length === 1);
  check('backwardLinks เส้นปกติไม่นับ', TL.backwardLinks([{ from: 'b', to: 'a' }], items).length === 0);
  check('elbowPath ไปข้างหน้า = หักมุมโค้ง', /^M0,0 .*Q.* L200,60$/.test(TL.elbowPath({ x: 0, y: 0 }, { x: 200, y: 60 })));
  check('elbowPath ระดับเดียวกัน = เส้นตรง', TL.elbowPath({ x: 0, y: 5 }, { x: 200, y: 5 }) === 'M0,5 L200,5');
  check('elbowPath ย้อนกลับ = อ้อมใต้การ์ด', TL.elbowPath({ x: 300, y: 10 }, { x: 100, y: 10 }).includes('L318,44'));
}

// ── ส่งออก ──
{
  const items = TL.mergeTimeline([
    { id: 'e1', title: 'สงคราม, ครั้งแรก', when: 'ปีที่ 1', whenEnd: 'ปีที่ 4', track: 'หลัก', refs: [{ kind: 'entity', path: 'Wiki/characters/a.json', title: 'อลิส' }] },
    { id: 'e2', title: 'สงบ "ศึก"', when: 'ปีที่ 5', track: 'หลัก' },
    { id: 'e3', title: 'ไม่มีเวลา', when: 'สักวัน' },
  ], []);
  const csv = TL.timelineCsv(items, ['ชื่อ', 'เริ่ม', 'จบ', 'เส้น', 'ชนิด', 'รายละเอียด', 'อ้างอิง']);
  check('CSV มี BOM', csv.charCodeAt(0) === 0xFEFF);
  check('CSV ครอบเครื่องหมายคำพูด/จุลภาค', csv.includes('"สงคราม, ครั้งแรก"') && csv.includes('"สงบ ""ศึก"""'));
  check('CSV ใส่อ้างอิง', csv.includes('อลิส'));
  const md = TL.timelineMarkdown(items, [{ from: 'e1', to: 'e2' }], { title: 'เส้นเวลา', links: 'เส้นเชื่อม' });
  check('Markdown มีหัวเรื่อง + หัวเลน', md.startsWith('# เส้นเวลา') && md.includes('## หลัก'));
  check('Markdown มีช่วงเวลา', md.includes('**ปีที่ 1 → ปีที่ 4**'));
  check('Markdown มีเส้นเชื่อม', md.includes('สงคราม, ครั้งแรก → สงบ "ศึก"'));
  const html = TL.timelineHtml(items, [{ from: 'e1', to: 'e2' }], { title: 'เส้น<เวลา>' });
  check('HTML escape ข้อความผู้ใช้', html.includes('เส้น&lt;เวลา&gt;') && html.includes('สงบ &quot;ศึก&quot;'));
  check('HTML วาดการ์ด + เส้นเชื่อม', (html.match(/class="card"/g) || []).length === 2 && /<path d="M/.test(html));
  check('HTML มีรายการที่ไม่มีเวลา', html.includes('ไม่มีเวลา'));
  check('normalizeRefs รับชนิด entity', TL.normalizeRefs([{ kind: 'entity', path: 'a.json' }])[0].kind === 'entity');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
