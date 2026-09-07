// test/vis-core.test.cjs — unit test แกน "เล่าด้วยภาพ" (Visual telling)
// โมดูลบริสุทธิ์ 100% → เทสได้ตรง ๆ ไม่ต้องเปิด electron
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-viscore-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'visual', 'vis-core.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const V = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── ชื่อไฟล์ sidecar ─────────
check('ชื่อไฟล์: .md → _vis.csv', V.visFileName('scene_01.md') === 'scene_01_vis.csv');
check('ชื่อไฟล์: ชื่อไทยก็ได้', V.visFileName('ฉากที่ 1.md') === 'ฉากที่ 1_vis.csv');
check('ชื่อไฟล์: ไม่มีนามสกุลก็ต่อให้', V.visFileName('scene_01') === 'scene_01_vis.csv');
check('ชื่อไฟล์: ว่าง → ว่าง', V.visFileName('') === '');
check('ย้อนกลับ: _vis.csv → .md', V.sceneFileOfVis('scene_01_vis.csv') === 'scene_01.md');
check('ย้อนกลับ: ไฟล์อื่นคืนว่าง', V.sceneFileOfVis('scene_01.md') === '');

// ───────── ลายนิ้วมือ ─────────
check('normText ยุบช่องว่าง', V.normText('  ก   ข \n ค ') === 'ก ข ค');
check('hash เท่ากันเมื่อต่างแค่ช่องว่าง', V.lineHash('ก ข') === V.lineHash('  ก    ข  '));
check('hash ต่างกันเมื่อข้อความต่าง', V.lineHash('ก ข') !== V.lineHash('ก ค'));
check('ref ไป-กลับ', V.parseRef(V.makeRef(3, 'สวัสดี')).idx === 3
      && V.parseRef(V.makeRef(3, 'สวัสดี')).hash === V.lineHash('สวัสดี'));
check('ref ว่าง = แถวอิสระ', V.parseRef('').hash === '' && V.parseRef('').idx === -1);

// ───────── ความคล้าย ─────────
check('similarity: เหมือนเป๊ะ = 1', V.similarity('ฝนตกหนักมากในคืนนั้น', 'ฝนตกหนักมากในคืนนั้น') === 1);
check('similarity: แก้นิดเดียวยังสูง',
      V.similarity('ฝนตกหนักมากในคืนนั้น', 'ฝนตกหนักมากในคืนนี้') >= V.SIMILAR_MIN);
check('similarity: คนละเรื่อง = ต่ำ',
      V.similarity('ฝนตกหนักมากในคืนนั้น', 'เขาเดินเข้าไปในร้านกาแฟ') < V.SIMILAR_MIN);

// ───────── แตกบรรทัด ─────────
const PROSE = 'ย่อหน้าแรกของฉาก\n\nย่อหน้าที่สอง\nยังเป็นย่อหน้าเดียวกัน\n\n\nย่อหน้าที่สาม\n';
const pl = V.splitLines(PROSE, 'prose');
check('นิยาย: คั่นด้วยบรรทัดว่าง ได้ 3 ย่อหน้า', pl.length === 3, pl.length);
check('นิยาย: ย่อหน้าที่สองรวมสองบรรทัด', pl[1].text.includes('\n'));
check('นิยาย: ทิ้งย่อหน้าว่าง', pl.every((l) => l.text.trim() !== ''));
check('นิยาย: index ต่อเนื่อง', pl.every((l, i) => l.i === i));
const SP = 'INT. ห้องนอน - กลางคืน\n\nโต้ง\nฉันไม่ไป\n\nCUT TO:';
const sl = V.splitLines(SP, 'screenplay');
check('บทหนัง: หนึ่งบรรทัด = หนึ่งแถว (ทิ้งบรรทัดว่าง)', sl.length === 4, sl.length);
check('บทหนัง: หัวฉากเป็นบรรทัดแรก', sl[0].text === 'INT. ห้องนอน - กลางคืน');
check('นิยาย: ตัด <!--align--> ทิ้ง',
      V.splitLines('<!--align:center-->กลางหน้า', 'prose')[0].text === 'กลางหน้า');

// ───────── ข้อความสำหรับอ่าน (ตัดสัญลักษณ์มาร์กดาวน์) ─────────
check('display: ตัวหนา', V.displayText('เขา **วิ่ง** ไป') === 'เขา วิ่ง ไป');
check('display: ตัวเอียง', V.displayText('เขา *วิ่ง* ไป') === 'เขา วิ่ง ไป');
check('display: ตัวเอียงขีดล่าง', V.displayText('เขา _วิ่ง_ ไป') === 'เขา วิ่ง ไป');
check('display: ขีดฆ่า', V.displayText('เขา ~~วิ่ง~~ ไป') === 'เขา วิ่ง ไป');
check('display: หัวข้อ', V.displayText('# บทที่หนึ่ง') === 'บทที่หนึ่ง');
check('display: ยกคำพูด', V.displayText('> คำคม') === 'คำคม');
check('display: รายการไม่มีลำดับ', V.displayText('- ข้าวสาร') === 'ข้าวสาร');
check('display: รายการมีลำดับ', V.displayText('1. ไปหายัยแมว') === 'ไปหายัยแมว');
check('display: รูป → เหลือคำบรรยาย', V.displayText('![ภาพตลาด](../Images/a.png)') === 'ภาพตลาด');
check('display: ลิงก์ → เหลือข้อความ', V.displayText('[ตลาดเก่า](wiki://x)') === 'ตลาดเก่า');
check('display: ผสมหลายชั้น',
      V.displayText('ค่ำวันนั้น **โทระ** เดินพร้อม *ความลับ* ที่ _ไม่มีใครรู้_ และ ~~ความกลัว~~')
      === 'ค่ำวันนั้น โทระ เดินพร้อม ความลับ ที่ ไม่มีใครรู้ และ ความกลัว');
check('display: บทหนังไม่ถูกแตะ', V.displayText('INT. ห้องนอน - กลางคืน') === 'INT. ห้องนอน - กลางคืน');
check('display: ค่าว่าง', V.displayText('') === '' && V.displayText(null) === '');
check('★ display ไม่แตะข้อความดิบที่ใช้ผูกสมอ',
      V.lineHash('เขา **วิ่ง** ไป') !== V.lineHash(V.displayText('เขา **วิ่ง** ไป')));

// ───────── แถว: เพิ่ม/ลบ/ย้าย/เลขลำดับ ─────────
let rows = pl.map((l) => V.rowFromLines([l]));
V.renumber(rows);
check('เลขลำดับเริ่มที่ 1', rows[0].no === 1 && rows[2].no === 3);
check('แถวใหม่พกสำเนาข้อความมาด้วย', rows[0].text === pl[0].text);
const moved = V.moveRow(rows, 0, 1);
check('ย้ายลง: index ใหม่ = 1', moved === 1);
check('ย้ายลง: สลับตัวจริง', rows[0].text === pl[1].text && rows[1].text === pl[0].text);
check('ย้ายลง: เลขลำดับเขียนใหม่', rows[0].no === 1 && rows[1].no === 2);
check('ย้ายขึ้นจากแถวบนสุด = ไม่ขยับ', V.moveRow(rows, 0, -1) === 0 && rows[0].text === pl[1].text);
check('ย้ายลงจากแถวล่างสุด = ไม่ขยับ', V.moveRow(rows, rows.length - 1, 1) === rows.length - 1);
check('ย้าย index นอกช่วง = ไม่พัง', V.moveRow(rows, 99, 1) === 99 && rows.length === 3);
const freeRow = V.makeRow({ image: 'a.png', remark: 'ภาพเปิดเรื่อง' });
V.insertRow(rows, 0, freeRow);
check('แทรกหัวตาราง', rows[0] === freeRow && rows[0].no === 1 && rows.length === 4);
check('แทรก index -1 = ต่อท้าย', V.insertRow(rows, -1, V.makeRow({ remark: 'ท้าย' })) === 4);
check('ลบแถวคืนตัวที่ลบ', V.removeRow(rows, 4).remark === 'ท้าย');
check('ลบแล้วเลขลำดับต่อเนื่อง', rows.every((r, i) => r.no === i + 1));
check('ลบ index นอกช่วงคืน null', V.removeRow(rows, 99) === null);

// ───────── จับคู่กับเนื้อฉาก (สมอหนึ่งตัว) ─────────
const bound = V.rowFromLines([pl[1]]);
check('ok: ย่อหน้าอยู่ที่เดิม', V.resolveRow(bound, pl).status === 'ok');
const shifted = V.splitLines('ย่อหน้าแทรกใหม่\n\n' + PROSE, 'prose');
const rs = V.resolveRow(bound, shifted);
check('ok: ย่อหน้าถูกดันลงไป ยังหาเจอ', rs.status === 'ok' && rs.live[0].idx === 2,
      rs.status + '/' + (rs.live[0] || {}).idx);
const edited = V.splitLines('ย่อหน้าแรกของฉาก\n\nย่อหน้าที่สอง\nยังเป็นย่อหน้าเดียวกันนะ\n\nย่อหน้าที่สาม', 'prose');
const re = V.resolveRow(bound, edited);
check('changed: ข้อความถูกแก้ → แจ้ง ไม่ใช่เขียนทับ', re.status === 'changed' && re.live[0].idx === 1,
      re.status);
check('changed: มีข้อความใหม่ให้ดู', re.live[0].text === edited[1].text);
const gone = V.splitLines('เขียนใหม่หมดทั้งฉากไม่เหลือของเดิม', 'prose');
const rlost = V.resolveRow(bound, gone);
check('lost: หาไม่เจอแล้ว', rlost.status === 'lost');
check('lost: ไม่มีอะไรให้แสดง (แต่แถวยังอยู่)', rlost.live.length === 0 && rlost.parts.length === 1);
check('lost: ไม่แตะสำเนาในแถว', bound.text === pl[1].text);
check('free: แถวไม่มี ref', V.resolveRow(freeRow, pl).status === 'free');
check('resolveAll คืนครบทุกแถว', V.resolveAll(rows, pl).length === rows.length);

const synced = V.syncRow({ ...bound }, re);
check('syncRow รับข้อความใหม่', synced.text === edited[1].text);
check('syncRow ผูกสมอใหม่', V.parseRef(synced.ref).hash === V.lineHash(edited[1].text));
check('syncRow กับแถวที่ไม่มีสมอ = ไม่แตะ',
      V.syncRow({ ...freeRow }, V.resolveRow(freeRow, pl)).text === freeRow.text);

// ───────── ผูกได้หลายบรรทัดต่อหนึ่งแถว (ข้อ 1) ─────────
const multi = V.rowFromLines([pl[0], pl[2]]);
check('หลายบรรทัด: ref เก็บสองสมอ', V.parseRefs(multi.ref).length === 2, multi.ref);
check('หลายบรรทัด: สำเนาคั่นด้วยบรรทัดว่าง', V.splitSnaps(multi.text).length === 2);
const rm = V.resolveRow(multi, pl);
check('หลายบรรทัด: หาเจอครบทั้งสอง', rm.status === 'ok' && rm.live.length === 2);
check('หลายบรรทัด: เรียงตามที่ผูก', rm.live[0].idx === 0 && rm.live[1].idx === 2);
check('หลายบรรทัด: liveText ต่อกันด้วยบรรทัดว่าง',
      V.liveText(rm) === pl[0].text + '\n\n' + pl[2].text);
check('หลายบรรทัด: เลขบรรทัดนับจาก 1', V.liveLineNos(rm).join(',') === '1,3');
check('CSV ไป-กลับ สมอหลายตัวไม่เพี้ยน',
      V.parseVis(V.dumpVis([multi]))[0].ref === multi.ref
      && V.parseVis(V.dumpVis([multi]))[0].text === multi.text);

// บรรทัดหนึ่งในนั้นถูกลบ → **แค่ไม่แสดง ไม่ลบแถว** (คำสั่งผู้ใช้)
const half = V.splitLines('ย่อหน้าแรกของฉาก\n\nย่อหน้าที่สอง\nยังเป็นย่อหน้าเดียวกัน', 'prose');
const rh = V.resolveRow(multi, half);
check('★ บรรทัดที่ผูกถูกลบ → หายไปจากช่อง', rh.live.length === 1 && rh.live[0].idx === 0);
check('★ แต่แถวยังอยู่ และสมอเดิมยังอยู่ในไฟล์', rh.parts.length === 2 && rh.status === 'ok');
check('บรรทัดที่ถูกลบมีสถานะ lost', rh.parts[1].status === 'lost');
const keptRow = V.syncRow({ ...multi }, rh);
check('★ syncRow ไม่ทิ้งสมอที่หายไป (เผื่อผู้เขียนกู้ข้อความคืน)',
      V.parseRefs(keptRow.ref).length === 2, keptRow.ref);
check('sync แล้วเอาไปใช้กับฉากเดิมได้เหมือนเดิม',
      V.resolveRow(keptRow, pl).live.length === 2);

// แก้การผูก: เพิ่ม / ลบ
const eRow = V.rowFromLines([pl[0]]);
V.bindRow(eRow, pl, [0, 1, 2]);
check('bindRow: เพิ่มบรรทัดได้', V.resolveRow(eRow, pl).live.length === 3);
V.bindRow(eRow, pl, [2]);
check('bindRow: ลบบรรทัดออกได้', V.resolveRow(eRow, pl).live.length === 1);
check('bindRow: เหลือตัวที่เลือกจริง', V.resolveRow(eRow, pl).live[0].idx === 2);
V.bindRow(eRow, pl, []);
check('bindRow: ติ๊กออกหมด = แถวว่าง (แถวไม่หาย)',
      V.resolveRow(eRow, pl).status === 'free' && eRow.ref === '');
V.bindRow(eRow, pl, [1, 0]);
check('bindRow: เรียงตามลำดับในฉากเสมอ', V.resolveRow(eRow, pl).live.map((p) => p.idx).join() === '0,1');
V.bindRow(eRow, pl, [0, 0, 99]);
check('bindRow: ทิ้งตัวซ้ำและตัวที่ไม่มีจริง', V.parseRefs(eRow.ref).length === 1);

check('boundIdxs คืนบรรทัดที่ผูกอยู่', V.boundIdxs(multi, pl).join() === '0,2');
const usage = V.lineUsage([multi, V.rowFromLines([pl[1]])], pl);
check('lineUsage นับทุกแถว', usage.get(0) === 1 && usage.get(1) === 1 && usage.get(2) === 1);
check('unusedLines กับสมอหลายตัว', V.unusedLines([multi], pl).map((l) => l.i).join() === '1');
check('unusedLines: ไม่มีแถวเลย = ครบทุกบรรทัด', V.unusedLines([], pl).length === 3);

// ───────── ตัวละคร/สถานที่ในบรรทัด (ข้อ 2) ─────────
const NAMES = ['โทระ', 'ยัยแมวเก้าชีวิต', 'แมว', 'ตลาดเก่า'];
check('entities: เจอชื่อที่โผล่', V.entitiesIn('ค่ำวันนั้น โทระ เดินเข้ามา', NAMES).join() === 'โทระ');
check('entities: ไม่เจอ = ว่าง', V.entitiesIn('ฝนตกหนัก', NAMES).length === 0);
check('★ entities: ชื่อยาวชนะชื่อสั้นที่ซ้อนกัน',
      V.entitiesIn('ยัยแมวเก้าชีวิตเดินมา', NAMES).join() === 'ยัยแมวเก้าชีวิต',
      V.entitiesIn('ยัยแมวเก้าชีวิตเดินมา', NAMES).join());
check('entities: เรียงตามตำแหน่งที่โผล่',
      V.entitiesIn('ตลาดเก่ามี โทระ ยืนอยู่', NAMES).join() === 'ตลาดเก่า,โทระ');
check('entities: ไม่ซ้ำแม้โผล่หลายครั้ง',
      V.entitiesIn('โทระ กับ โทระ', NAMES).join() === 'โทระ');
check('entities: มองผ่านสัญลักษณ์มาร์กดาวน์',
      V.entitiesIn('ค่ำวันนั้น **โทระ** เดินมา', NAMES).join() === 'โทระ');
check('entities: ไม่มีรายชื่อ = ว่าง', V.entitiesIn('โทระ', []).length === 0);
check('entities: ข้อความว่าง = ว่าง', V.entitiesIn('', NAMES).length === 0);

// ───────── คอมเมนต์ → แถว ─────────
const cms = [
  { id: 'c1', text: 'ตรงนี้ยาวไป', anchor: { start: 0, end: 5, quote: 'ย่อหน้าที่สอง' } },
  { id: 'c2', text: 'ชอบ', anchor: { start: 0, end: 5, quote: 'ย่อหน้าที่สาม' } },
  { id: 'c3', text: 'ลอย ๆ', anchor: null },
];
check('คอมเมนต์เข้าแถวที่มีข้อความนั้น',
      V.commentsForText(pl[1].text, cms).map((c) => c.id).join() === 'c1');
check('คอมเมนต์ที่ไม่มีสมอไม่เข้าแถวไหน',
      V.commentsForText(pl[0].text, cms).length === 0);
check('ข้อความว่าง = ไม่มีคอมเมนต์', V.commentsForText('', cms).length === 0);

// ───────── คอลัมน์ ─────────
let cols = V.normalizeCols(null);
check('คอลัมน์เริ่มต้นครบทุกคีย์', cols.length === V.VIS_COL_KEYS.length);
check('คอลัมน์ "ฉาก" ปิดไว้เป็นค่าเริ่มต้น', cols.find((c) => c.key === 'scene').on === false);
check('คอลัมน์อื่นเปิดไว้', cols.find((c) => c.key === 'image').on === true);
check('normalizeCols ทิ้งคีย์แปลกปลอม',
      V.normalizeCols([{ key: 'ไม่มีจริง', on: true }, { key: 'no', on: true }]).length === V.VIS_COL_KEYS.length);
check('normalizeCols ทิ้งคีย์ซ้ำ',
      V.normalizeCols(['no', 'no', 'text']).length === V.VIS_COL_KEYS.length);
check('normalizeCols รับรูปแบบสตริงล้วน (ไฟล์เก่า)',
      V.normalizeCols(['image', 'text'])[0].key === 'image');
check('ปิดหมดไม่ได้ — คืนค่าเปิดทั้งหมด',
      V.normalizeCols(V.VIS_COL_KEYS.map((k) => ({ key: k, on: false }))).every((c) => c.on));
cols = V.normalizeCols(null);
V.toggleCol(cols, 'remark');
check('toggleCol ปิดได้', cols.find((c) => c.key === 'remark').on === false);
V.toggleCol(cols, 'remark');
check('toggleCol เปิดกลับได้', cols.find((c) => c.key === 'remark').on === true);
const one = V.normalizeCols(V.VIS_COL_KEYS.map((k) => ({ key: k, on: k === 'text' })));
V.toggleCol(one, 'text');
check('ปิดคอลัมน์สุดท้ายไม่ได้', one.find((c) => c.key === 'text').on === true);
const before = cols[0].key, after = cols[1].key;
V.moveCol(cols, after, -1);
check('moveCol เลื่อนขึ้น', cols[0].key === after && cols[1].key === before);
V.moveCol(cols, cols[0].key, -1);
check('moveCol ที่ขอบ = ไม่ขยับ', cols[0].key === after);
V.moveCol(cols, cols[cols.length - 1].key, 1);
check('moveCol ขอบล่าง = ไม่ขยับ', cols.length === V.VIS_COL_KEYS.length);
check('visibleCols คืนเฉพาะที่เปิด', !V.visibleCols(V.normalizeCols(null)).includes('scene'));

// ความกว้างคอลัมน์ (ข้อ 3)
const wc = V.normalizeCols(null);
check('คอลัมน์มีความกว้างเริ่มต้น', wc.every((c) => c.w >= V.COL_W_MIN));
check('frame กว้างกว่า ลำดับ (สตอรีบอร์ดเน้นรูป)',
      wc.find((c) => c.key === 'image').w > wc.find((c) => c.key === 'no').w);
V.setColWidth(wc, 'image', 500);
check('ตั้งความกว้างได้', wc.find((c) => c.key === 'image').w === 500);
V.setColWidth(wc, 'image', 5);
check('แคบเกินไปถูกดันขึ้นขั้นต่ำ', wc.find((c) => c.key === 'image').w === V.COL_W_MIN);
V.setColWidth(wc, 'image', 99999);
check('กว้างเกินไปถูกตัดที่ขั้นสูง', wc.find((c) => c.key === 'image').w === V.COL_W_MAX);
V.setColWidth(wc, 'image', 'ไม่ใช่ตัวเลข');
check('ค่าพัง → คืนค่าเริ่มต้น', wc.find((c) => c.key === 'image').w === V.VIS_COL_W.image);
check('normalizeCols เก็บความกว้างที่บันทึกไว้',
      V.normalizeCols([{ key: 'image', on: true, w: 420 }]).find((c) => c.key === 'image').w === 420);
check('normalizeCols ซ่อมความกว้างที่พัง',
      V.normalizeCols([{ key: 'image', on: true, w: -5 }]).find((c) => c.key === 'image').w === V.COL_W_MIN);
check('มีคอลัมน์ตัวละคร/สถานที่', V.VIS_COL_KEYS.includes('entities'));
check('totalWidth รวมรางปุ่มหัว-ท้ายด้วย',
      V.totalWidth(V.normalizeCols(null))
      === V.normalizeCols(null).filter((c) => c.on).reduce((a, c) => a + c.w, 0) + V.VIS_FIXED_W);
check('★ ตารางเริ่มต้นกว้างเกิน 1000px → ต้องมีแถบเลื่อนแนวนอน (ข้อ 4)',
      V.totalWidth(null) > 1000, V.totalWidth(null));

// ───────── CSV ─────────
check('csvCell ครอบเมื่อมีคอมมา', V.csvCell('ก, ข') === '"ก, ข"');
check('csvCell escape เครื่องหมายคำพูด', V.csvCell('เขาว่า "ไป"') === '"เขาว่า ""ไป"""');
check('csvCell ธรรมดาไม่ครอบ', V.csvCell('สวัสดี') === 'สวัสดี');
check('csvCell ครอบเมื่อมีขึ้นบรรทัด', V.csvCell('ก\nข') === '"ก\nข"');
const t1 = V.parseCsv('a,b\n1,"x, y"\n');
check('parseCsv แถว/คอลัมน์ถูก', t1.length === 2 && t1[1][1] === 'x, y');
check('parseCsv รับ CRLF', V.parseCsv('a,b\r\n1,2\r\n').length === 2);
check('parseCsv ตัด BOM', V.parseCsv('﻿a,b\n1,2')[0][0] === 'a');
check('parseCsv ค่าที่มีขึ้นบรรทัดในเครื่องหมายคำพูด',
      V.parseCsv('a\n"บรรทัด1\nบรรทัด2"\n')[1][0] === 'บรรทัด1\nบรรทัด2');
check('parseCsv ไฟล์ว่าง = ไม่มีแถว', V.parseCsv('').length === 0);

const rt = [V.makeRow({ ref: '0|abc', image: '../Images/a.png', text: 'เขาว่า "ไป", แล้วก็ไป', remark: 'โคลสอัพ' })];
const csv = V.dumpVis(rt);
check('dumpVis มี BOM', csv.charCodeAt(0) === 0xFEFF);
check('dumpVis มีหัวตาราง', csv.includes('no,ref,image,text,remark'));
check('dumpVis ใช้ CRLF', csv.includes('\r\n'));
const back = V.parseVis(csv);
check('CSV ไป-กลับ: จำนวนแถว', back.length === 1);
check('CSV ไป-กลับ: ข้อความมีคอมมา+คำพูดครบ', back[0].text === rt[0].text, back[0].text);
check('CSV ไป-กลับ: รูป', back[0].image === '../Images/a.png');
check('CSV ไป-กลับ: remark', back[0].remark === 'โคลสอัพ');
check('CSV ไป-กลับ: ref', back[0].ref === '0|abc');
check('parseVis เขียนเลขลำดับให้เอง', back[0].no === 1);
check('parseVis ไฟล์ว่าง = ไม่มีแถว ไม่ throw', V.parseVis('').length === 0);
check('parseVis ไฟล์พัง = ไม่ throw', Array.isArray(V.parseVis(']]]not,csv"')));
check('parseVis ไฟล์ไม่มีหัวตาราง (คนแก้มือ)',
      V.parseVis('1,,a.png,ข้อความ,หมายเหตุ')[0].image === 'a.png');
check('parseVis สลับลำดับคอลัมน์ตามหัวตาราง',
      V.parseVis('remark,text,image,ref,no\nรีมาร์ก,ข้อความ,รูป.png,0|z,1')[0].remark === 'รีมาร์ก');
const big = [];
for (let i = 0; i < 200; i++) big.push(V.makeRow({ ref: V.makeRef(i, 'บรรทัด ' + i), text: 'บรรทัด ' + i }));
check('CSV ไป-กลับ 200 แถวครบ', V.parseVis(V.dumpVis(big)).length === 200);
check('CSV ไป-กลับ 200 แถวเรียงเหมือนเดิม', V.parseVis(V.dumpVis(big))[199].text === 'บรรทัด 199');
const twoLine = V.makeRow({ ref: '0|a;1|b', text: 'ย่อหน้าแรก\n\nย่อหน้าสอง, มีคอมมา' });
const rtb = V.parseVis(V.dumpVis([twoLine]))[0];
check('★ CSV ไป-กลับ: สำเนาหลายย่อหน้า + คอมมา ไม่เพี้ยน', rtb.text === twoLine.text, JSON.stringify(rtb.text));
check('CSV ไป-กลับ: แยกสำเนากลับได้ 2 ตัว', V.splitSnaps(rtb.text).length === 2);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
