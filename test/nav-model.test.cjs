// test/nav-model.test.cjs — [alpha.140] แกนของแผง Navigation (ตัวกรอง · แบ่งหน้า · สถานะจุด · คีย์เครื่องหมาย)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
// [alpha.77] t() ไม่ตกกลับภาษาอื่นแล้ว — ต้องมีตารางคำแปลจริงก่อน require บันเดิล
require('./_lang.cjs').installLang('th');
const tmp = (f) => path.join(os.tmpdir(), f);
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/nav-model.js')],
                    outfile: tmp('_navmodel.cjs'), format: 'cjs', bundle: true, logLevel: 'silent' });
const N = require(tmp('_navmodel.cjs'));
// nav.js = ตัวพาร์สโครงเรื่องจากข้อความดิบ (ต้องคืน `kind` ชุดเดียวกับที่ nav-model รู้จัก)
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/nav.js')],
                    outfile: tmp('_nav.cjs'), format: 'cjs', bundle: true, logLevel: 'silent' });
const NAV = require(tmp('_nav.cjs'));

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ── กลุ่มของชนิด ──
check('หัวข้อนิยายอยู่กลุ่ม head', N.navGroupOf('heading') === 'head');
check('โครงบทหนังอยู่กลุ่ม head', N.navGroupOf('outline') === 'head');
check('หัวฉากอยู่กลุ่ม scene', N.navGroupOf('sceneHeading') === 'scene');
check('แถวฉากอยู่กลุ่ม scene', N.navGroupOf('scene') === 'scene');
check('ตัวละครอยู่กลุ่ม dialog', N.navGroupOf('character') === 'dialog');
check('ทรานซิชันอยู่กลุ่ม trans', N.navGroupOf('transition') === 'trans');
check('สรุป/ยกคำพูดอยู่กลุ่ม note',
      N.navGroupOf('summary') === 'note' && N.navGroupOf('quote') === 'note');
check('ย่อหน้าอยู่กลุ่ม beat', N.navGroupOf('beat') === 'beat');
check('ชนิดที่ไม่รู้จักตกกลุ่ม beat (ไม่หายไปเงียบ ๆ)', N.navGroupOf('อะไรก็ไม่รู้') === 'beat');
check('ทุกกลุ่มมีป้ายภาษาและไอคอน',
      N.NAV_GROUPS.every((g) => N.NAV_GROUP_KEYS[g] && N.NAV_GROUP_ICON[g]));
// ★ ประตูกันพลาด: ชนิดทุกตัวที่ `nav.js` คืนได้จริง ต้องมีที่อยู่ในตารางกลุ่ม
{
  const proseKinds = new Set(NAV.parseProse('# หัว\n\nย่อหน้า\n\n> ยกคำพูด').map((r) => r.kind));
  const spKinds = new Set(NAV.parseScreenplay(
    '# องก์\n.ตลาด - เย็น\n@โทระ\n> CUT TO:\n= สรุปฉาก\n$act หนึ่ง').map((r) => r.kind));
  const all = [...proseKinds, ...spKinds, 'scene'];
  check('ชนิดทุกตัวจาก nav.js มีในตารางกลุ่ม',
        all.every((k) => N.NAV_KIND_GROUP[k]), all.filter((k) => !N.NAV_KIND_GROUP[k]).join(','));
}

// ── สถานะของจุด (flags) ──
check('ฉากมีทางเลือก → choice', N.navFlags({ label: 'ฉากหนึ่ง', choices: 2 }).includes('choice'));
check('ไม่มีทางเลือก → ไม่มี choice', !N.navFlags({ label: 'ฉากหนึ่ง', choices: 0 }).includes('choice'));
check('ติดดาว → star', N.navFlags({ label: 'x', star: true }).includes('star'));
check('มีสี → color', N.navFlags({ label: 'x', color: 'ส้ม' }).includes('color'));
check('TODO ในข้อความ → todo', N.navFlags({ label: 'ยังไม่จบ TODO ต่อพรุ่งนี้' }).includes('todo'));
check('??? ในข้อความ → todo', N.navFlags({ label: 'เขาพูดว่าอะไรนะ ???' }).includes('todo'));
check('(ยังไม่เขียน) → todo', N.navFlags({ label: 'ฉากรบ (ยังไม่เขียน)' }).includes('todo'));
check('ข้อความปกติไม่ติด todo', !N.navFlags({ label: 'เขาเดินเข้ามาในตลาด' }).includes('todo'));
check('ข้อความว่าง → empty', N.navFlags({ label: '   ' }).includes('empty'));
check('ธง empty ที่ผู้เรียกใส่มาเองก็นับ', N.navFlags({ label: 'ฉากหนึ่ง', empty: true }).includes('empty'));
check('ล็อก → locked', N.navFlags({ label: 'x', locked: true }).includes('locked'));
check('มีคอมเมนต์ → comment', N.navFlags({ label: 'x', comments: 1 }).includes('comment'));
check('ขึ้นหน้าใหม่ → break', N.navFlags({ label: 'x', pageBreak: true }).includes('break'));
check('ธงเรียงตามลำดับที่ประกาศไว้เสมอ',
      N.navFlags({ label: 'TODO', star: true, choices: 1 }).join() === 'choice,star,todo',
      N.navFlags({ label: 'TODO', star: true, choices: 1 }).join());
check('ทุกธงมีคำอธิบายภาษา', N.NAV_FLAG_DEFS.every((f) => f.id && f.mark && f.key));
check('รายชื่อธงตรงกับนิยาม', N.NAV_FLAG_IDS.length === N.NAV_FLAG_DEFS.length);

// ── คีย์เครื่องหมาย (ต้องรอด "แก้ย่อหน้าอื่น") ──
{
  const mk = () => ([
    { sceneId: 's1', kind: 'heading', label: 'บทที่หนึ่ง' },
    { sceneId: 's1', kind: 'beat', label: 'เขาเดินเข้ามา' },
    { sceneId: 's1', kind: 'beat', label: 'เขาเดินเข้ามา' },   // ข้อความซ้ำ
  ]);
  const a = N.withNavKeys(mk());
  check('ข้อความซ้ำได้คนละคีย์', a[1].key !== a[2].key);
  check('ลำดับซ้ำนับจาก 0', a[1].ord === 0 && a[2].ord === 1);
  // แทรกย่อหน้าใหม่ไว้ "ข้างบน" — คีย์ของแถวเดิมต้องไม่ขยับ
  const b = N.withNavKeys([{ sceneId: 's1', kind: 'beat', label: 'ย่อหน้าใหม่' }, ...mk()]);
  check('แทรกแถวข้างบนแล้วคีย์เดิมไม่เปลี่ยน',
        b[1].key === a[0].key && b[2].key === a[1].key, b[2].key + ' vs ' + a[1].key);
  check('คนละฉากได้คนละคีย์',
        N.navKey('s1', 'beat', 'x', 0) !== N.navKey('s2', 'beat', 'x', 0));
  check('ช่องว่างซ้ำไม่ทำให้คีย์เพี้ยน',
        N.navKey('s1', 'beat', ' a   b ', 0) === N.navKey('s1', 'beat', 'a b', 0));
}

// ── ค้นหา + กรอง ──
{
  const rows = N.withNavKeys([
    { sceneId: 's', kind: 'heading', label: 'บทที่หนึ่ง' },
    { sceneId: 's', kind: 'beat', label: 'เขาเดินเข้ามาในตลาด', color: 'ส้ม' },
    { sceneId: 's', kind: 'beat', label: 'ฟ้ามืดแล้ว TODO', star: true },
    { sceneId: 's', kind: 'sceneHeading', label: 'INT. ตลาด - เย็น' },
    { sceneId: 's', kind: 'character', label: 'โทระ' },
  ]);
  check('ไม่กรองอะไรเลย = ได้ครบ', N.filterNav(rows, {}).length === 5);
  check('ค้นข้อความ', N.filterNav(rows, { q: 'ตลาด' }).length === 2);
  check('ค้นไม่สนตัวพิมพ์', N.filterNav(rows, { q: 'int.' }).length === 1);
  check('ค้นไม่เจอ = ว่าง', N.filterNav(rows, { q: 'ไม่มีคำนี้' }).length === 0);
  check('กรองกลุ่ม head', N.filterNav(rows, { groups: ['head'] }).map((r) => r.label).join() === 'บทที่หนึ่ง');
  check('กรองสองกลุ่มพร้อมกัน', N.filterNav(rows, { groups: ['head', 'dialog'] }).length === 2);
  check('กรองสี', N.filterNav(rows, { colors: ['ส้ม'] }).length === 1);
  check('กรองดาว', N.filterNav(rows, { star: true }).length === 1);
  check('กรองสถานะ todo', N.filterNav(rows, { flags: ['todo'] }).length === 1);
  check('กรองซ้อนกัน (กลุ่ม + คำค้น)',
        N.filterNav(rows, { groups: ['beat'], q: 'ตลาด' }).length === 1);
  check('รับ Set ได้เหมือน Array',
        N.filterNav(rows, { groups: new Set(['head']) }).length === 1);
}

// ── แบ่งหน้า ──
check('หนีบจำนวนต่อหน้าต่ำสุด', N.clampPerPage(1) === N.NAV_PER_PAGE_MIN);
check('หนีบจำนวนต่อหน้าสูงสุด', N.clampPerPage(9999) === N.NAV_PER_PAGE_MAX);
check('ค่าเพี้ยน = ค่าเริ่มต้น', N.clampPerPage('abc') === N.NAV_PER_PAGE_DEFAULT);
check('ค่าปกติผ่านตรง ๆ', N.clampPerPage(20) === 20);
check('รายการว่างยังนับเป็น 1 หน้า', N.navPageCount(0, 10) === 1);
check('25 แถว หน้าละ 10 = 3 หน้า', N.navPageCount(25, 10) === 3);
{
  const list = Array.from({ length: 25 }, (_, i) => ({ label: 'r' + i }));
  const p0 = N.navSlice(list, 0, 10);
  check('หน้าแรกได้ 10 แถว', p0.rows.length === 10 && p0.rows[0].label === 'r0');
  const p2 = N.navSlice(list, 2, 10);
  check('หน้าสุดท้ายได้เศษ', p2.rows.length === 5 && p2.rows[0].label === 'r20');
  const over = N.navSlice(list, 99, 10);
  check('หน้าเกินขอบถูกหนีบมาหน้าสุดท้าย', over.page === 2 && over.rows.length === 5);
  const neg = N.navSlice(list, -5, 10);
  check('หน้าติดลบถูกหนีบมาหน้าแรก', neg.page === 0);
  check('จำนวนหน้าถูกรายงานกลับมาด้วย', p0.pages === 3);
}

// ── คอลัมน์ที่อยู่ ──
check('มีทั้งบรรทัดและหน้า', N.navLocText({ line: 11, page: 3 }).startsWith('12 · '));
check('บรรทัดนับจาก 1 บนจอ', N.navLocText({ line: 0 }) === '1');
check('มีแต่หน้า', N.navLocText({ page: 2 }).includes('2'));
check('ไม่มีอะไรเลย = ขีด', N.navLocText({}) === '–');

// ── เลขหน้าจากตำแหน่ง ──
{
  const brk = [{ pos: 100, page: 2 }, { pos: 250, page: 3 }];
  check('ก่อนเส้นคั่นแรก = หน้าแรก', N.pageOfPos(brk, 10) === 1);
  check('ตรงเส้นคั่นพอดี = หน้าถัดไป', N.pageOfPos(brk, 100) === 2);
  check('หลังเส้นคั่นที่สอง', N.pageOfPos(brk, 900) === 3);
  check('เคารพเลขหน้าเริ่มต้นของบท', N.pageOfPos([], 10, 7) === 7);
  check('ไม่มีเส้นคั่น = หน้า 1', N.pageOfPos(null, 999) === 1);
}

// ── บรรทัด .md ↔ ลำดับบล็อก (ต้นตอของ "มุมมองทั้งเล่มกดแล้วไม่กระโดด") ──
// ★ `mdLineCounts()` คืนหนึ่งค่าต่อบล็อกระดับบน และ **บรรทัดว่างในไฟล์เป็นย่อหน้าว่าง
//   ที่เป็นบล็อกของตัวเอง** (ค่า 1) — ห้ามบวกตัวคั่นเพิ่มเอง (เทสรอบแรกแดงเพราะข้อนี้)
{
  const counts = [1, 1, 1, 1, 3, 1, 1];   // หัวข้อ · ว่าง · ย่อหน้า · ว่าง · รายการ 3 บรรทัด · ว่าง · ย่อหน้า
  check('บล็อกแรกอยู่บรรทัด 0', N.mdLineOfBlock(counts, 0) === 0);
  check('ย่อหน้าว่างกินหนึ่งบรรทัด', N.mdLineOfBlock(counts, 1) === 1);
  check('ย่อหน้าถัดจากหัวข้ออยู่บรรทัด 2', N.mdLineOfBlock(counts, 2) === 2);
  check('รายการเริ่มบรรทัด 4', N.mdLineOfBlock(counts, 4) === 4);
  check('★ บล็อกหลังรายการ 3 บรรทัด กระโดดไป 7 ไม่ใช่ 5',
        N.mdLineOfBlock(counts, 5) === 7, N.mdLineOfBlock(counts, 5));
  check('★ บรรทัด ≠ ลำดับบล็อก — คือบั๊กที่ทำให้ไม่กระโดด',
        N.mdLineOfBlock(counts, 6) !== 6);
  for (let b = 0; b < counts.length; b++)
    check('ไป-กลับตรงกัน (บล็อก ' + b + ')', N.blockOfMdLine(counts, N.mdLineOfBlock(counts, b)) === b);
  check('บรรทัดกลางรายการยังชี้บล็อกเดิม', N.blockOfMdLine(counts, 5) === 4);
  check('บรรทัดเกินท้ายไฟล์ = บล็อกสุดท้าย', N.blockOfMdLine(counts, 999) === 6);
  // ★★ ผูกกับของจริง: ผลรวมของ counts ต้องเท่ากับจำนวนบรรทัดของไฟล์ที่ docToMd เขียนออกมา
  const total = counts.reduce((a, b) => a + b, 0);
  check('ผลรวม counts = จำนวนบรรทัดทั้งไฟล์', N.mdLineOfBlock(counts, counts.length) === total);
}

// ── จับคู่แถวจากดิสก์ ↔ บล็อกในเอกสาร (ต้นตอ "มุมมองทั้งเล่มกดแล้วไม่กระโดด" ชั้นที่สอง) ──
{
  // ฝั่งเอกสาร = textContent ของ ProseMirror · ฝั่งดิสก์ = ข้อความ .md ดิบที่ nav.js อ่าน
  const doc = [
    { kind: 'heading', label: 'บทที่หนึ่ง', pos: 0 },
    { kind: 'beat', label: 'เขาเดินเข้ามาในตลาด', pos: 10 },
    { kind: 'quote', label: 'คนเราเลือกเกิดไม่ได้', pos: 30 },
    { kind: 'beat', label: 'ข้าวสารหนึ่งถุงปลาแห้ง อย่างดี', pos: 50 },   // รายการ: ไม่มีจุดนำ
    { kind: 'sceneHeading', label: 'ตลาด - เย็น', pos: 70 },
  ];
  check('จับคู่ตรงตัว', N.navMatchRow(doc, { kind: 'beat', label: 'เขาเดินเข้ามาในตลาด' }).pos === 10);
  check('ชนิดไม่ตรงก็ยังจับคู่จากข้อความได้',
        N.navMatchRow(doc, { kind: 'beat', label: 'คนเราเลือกเกิดไม่ได้' }).pos === 30);
  const li = N.navMatchRow(doc, { kind: 'beat', label: '- ข้าวสารหนึ่งถุง - ปลาแห้ง อย่างดี' });
  check('★ รายการ: ฝั่งดิสก์มีจุดนำ ฝั่งเอกสารไม่มี — ต้องจับคู่ติด',
        li && li.pos === 50, JSON.stringify(li));
  const li2 = N.navMatchRow([{ kind: 'beat', label: 'ไปหายัยแมวกลับก่อนฟ้ามืด', pos: 90 }],
                            { kind: 'beat', label: '1. ไปหายัยแมว 2. กลับก่อนฟ้ามืด' });
  check('★ รายการเลข: `1. ` / `2. ` ก็ต้องติด', li2 && li2.pos === 90, JSON.stringify(li2));
  check('★ หัวฉากบท: ฝั่งดิสก์มี `.` นำหน้า',
        N.navMatchRow(doc, { kind: 'sceneHeading', label: '.ตลาด - เย็น' }).pos === 70);
  check('★ ข้อความถูกตัดคนละจุด (…) ยังจับคู่จากส่วนต้นได้',
        N.navMatchRow(doc, { kind: 'beat', label: 'เขาเดินเข้ามาในตลาดแล้วก็เดินต่อไปอีกไกล…' }).pos === 10);
  check('ไม่มีอะไรใกล้เคียงเลย = null',
        N.navMatchRow(doc, { kind: 'beat', label: 'ไม่มีข้อความนี้ในเอกสารเลยจริง ๆ' }) === null);
  check('ป้ายว่าง = null', N.navMatchRow(doc, { kind: 'beat', label: '   ' }) === null);
  check('รายการว่าง = null', N.navMatchRow([], { kind: 'beat', label: 'x' }) === null);
  const dup = [{ kind: 'beat', label: 'ซ้ำ', pos: 1 }, { kind: 'beat', label: 'ซ้ำ', pos: 2 }];
  check('ข้อความซ้ำ: ord=0 ได้ตัวแรก', N.navMatchRow(dup, { kind: 'beat', label: 'ซ้ำ', ord: 0 }).pos === 1);
  check('ข้อความซ้ำ: ord=1 ได้ตัวที่สอง', N.navMatchRow(dup, { kind: 'beat', label: 'ซ้ำ', ord: 1 }).pos === 2);
  check('ตัวช่วยตัดเครื่องหมาย', N.navTightLabel('1. ก ข - ค') === 'กขค', N.navTightLabel('1. ก ข - ค'));
}

console.log(`\nnav-model: ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
