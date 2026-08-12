// test/sp-reports.test.cjs — unit test รายงานบท (ข้อ 71 · 72 · 73)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-spreports-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'sp-reports.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const R = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── parseHeading ──
const h1 = R.parseHeading('INT. ห้องนอน - กลางคืน');
check('parseHeading: INT.', h1.intExt === 'INT' && h1.location === 'ห้องนอน' && h1.time === 'กลางคืน');
const h2 = R.parseHeading('EXT. ถนนสุขุมวิท – DAY');
check('parseHeading: EXT. + ขีดยาว', h2.intExt === 'EXT' && h2.location === 'ถนนสุขุมวิท' && h2.time === 'DAY');
check('parseHeading: INT./EXT.', R.parseHeading('INT./EXT. รถตู้ - เช้า').intExt === 'INT/EXT');
check('parseHeading: I/E.', R.parseHeading('I/E. เรือ - บ่าย').intExt === 'INT/EXT');
check('parseHeading: EST.', R.parseHeading('EST. โรงเรียน - เช้า').intExt === 'EST');
const h3 = R.parseHeading('ฉากภายใน บ้านยาย - เย็น');
check('parseHeading: คำนำหน้าไทย', h3.intExt === 'INT' && h3.location === 'บ้านยาย', JSON.stringify(h3));
check('parseHeading: ไม่มีเวลา', R.parseHeading('INT. ห้องครัว').time === '');
check('parseHeading: ว่าง → ไม่พัง', R.parseHeading('').location === '');
check('parseHeading: หลายขีด → เวลาเก็บครบ',
  R.parseHeading('INT. ห้อง - กลางคืน - ต่อเนื่อง').time === 'กลางคืน - ต่อเนื่อง');

// ── cleanCharacterName ──
check('ตัดส่วนเสริมออกจากชื่อ', R.cleanCharacterName('ทอร่า (V.O.)') === 'ทอร่า');
check("ตัด (cont'd) ออก", R.cleanCharacterName("ทอร่า (cont'd)") === 'ทอร่า');
check('ชื่อธรรมดาไม่เปลี่ยน', R.cleanCharacterName('แคสซี่') === 'แคสซี่');

// ── บทตัวอย่าง ──
const script = [
  { el: 'scene', text: 'INT. ห้องนอน - กลางคืน' },
  { el: 'action', text: 'ทอร่านั่งอยู่ริมเตียง' },
  { el: 'character', text: 'ทอร่า' },
  { el: 'dialogue', text: 'ฉันไม่อยากไป' },
  { el: 'character', text: 'แคสซี่' },
  { el: 'dialogue', text: 'ก็ไม่ต้องไปสิ ' + 'พูดต่ออีกยาว '.repeat(12) },
  { el: 'blank', text: '' },
  { el: 'scene', text: 'EXT. สวนหลังบ้าน - เช้า' },
  { el: 'action', text: 'แสงแดดส่องผ่านใบไม้' },
  { el: 'character', text: 'ทอร่า (V.O.)' },
  { el: 'dialogue', text: 'เช้าวันนั้นทุกอย่างเปลี่ยนไป' },
  { el: 'scene', text: 'INT. ห้องนอน - เช้า' },
  { el: 'action', text: 'เตียงว่างเปล่า' },
].map((b, i) => ({ ...b, idx: i, pos: (i + 1) * 10 }));

// ── sceneBreakdown ──
const bd = R.sceneBreakdown(script);
check('แจกแจงได้ 3 ฉาก', bd.scenes.length === 3, bd.scenes.length);
check('ฉากแรกมีตัวละคร 2 คน', bd.scenes[0].characters.length === 2, JSON.stringify(bd.scenes[0].characters));
check('ฉากแรกอ่านสถานที่ถูก', bd.scenes[0].location === 'ห้องนอน');
check('ฉากสองอ่านสถานที่ถูก', bd.scenes[1].location === 'สวนหลังบ้าน');
check('ฉากมีเลขหน้า', bd.scenes.every((s) => s.page >= 1));
check('ฉากเก็บตำแหน่งในเอกสารไว้ให้คลิกเปิดได้', bd.scenes.every((s) => Number.isFinite(s.pos)));
check('นับบรรทัดบทพูด/บรรยายแยกกัน', bd.scenes[0].dialogueLines > 0 && bd.scenes[0].actionLines > 0);
check('เริ่มนับหน้าที่ startPage ได้', R.sceneBreakdown(script, { startPage: 10 }).scenes[0].page === 10);
check('บล็อกว่างไม่กลายเป็นฉาก', !bd.scenes.some((s) => s.heading === ''));
const orphan = R.sceneBreakdown([{ el: 'action', text: 'ไม่มีหัวฉาก', idx: 0, pos: 1 }]);
check('เนื้อหาก่อนหัวฉากแรกไม่หาย', orphan.scenes.length === 1 && orphan.scenes[0].actionLines > 0);
check('บทว่าง → ไม่มีฉาก ไม่พัง', R.sceneBreakdown([]).scenes.length === 0);

// ── 71 รายงานสถานที่ ──
const loc = R.generateLocationReport(script);
check('[71] จัดกลุ่มเหลือ 2 สถานที่', loc.locations.length === 2,
  loc.locations.map((l) => l.location).join(','));
const bed = loc.locations.find((l) => l.location === 'ห้องนอน');
check('[71] ห้องนอนมี 2 ฉาก', bed && bed.sceneCount === 2, bed && bed.sceneCount);
check('[71] เก็บ INT/EXT ของสถานที่', bed && bed.intExt.includes('INT'));
check('[71] รวมตัวละครในสถานที่นั้น', bed && bed.characters.includes('ทอร่า'));
check('[71] เรียงจากฉากมากไปน้อย',
  loc.locations.every((l, i) => i === 0 || loc.locations[i - 1].sceneCount >= l.sceneCount));
check('[71] รายชื่อฉากในแต่ละที่ครบ', bed && bed.scenes.length === bed.sceneCount);
check('[71] บอกจำนวนฉาก/หน้ารวม', loc.totalScenes === 3 && loc.totalPages >= 1);
const grouped = R.generateLocationReport(script, { groups: { 'บ้านทอร่า': ['ห้องนอน', 'สวนหลังบ้าน'] } });
check('[71] จัดกลุ่มเองแล้วยุบเหลือกลุ่มเดียว',
  grouped.locations.length === 1 && grouped.locations[0].location === 'บ้านทอร่า');
check('[71] กลุ่มเองรวมจำนวนฉากถูก', grouped.locations[0].sceneCount === 3);

// ── 72 รายงานตัวละคร ──
const ch = R.generateCharacterReport(script);
check('[72] ได้ 2 ตัวละคร', ch.characters.length === 2, ch.characters.map((c) => c.name).join(','));
check('[72] (V.O.) ถือเป็นคนเดียวกัน', ch.characters.some((c) => c.name === 'ทอร่า' && c.sceneCount === 2),
  JSON.stringify(ch.characters.map((c) => [c.name, c.sceneCount])));
check('[72] เรียงตามบรรทัดบทพูดมาก→น้อย',
  ch.characters.every((c, i) => i === 0 || ch.characters[i - 1].totalLines >= c.totalLines));
check('[72] แคสซี่พูดยาวกว่า → มาก่อน', ch.characters[0].name === 'แคสซี่', ch.characters[0].name);
check('[72] นับจำนวนครั้งที่พูด', ch.characters.every((c) => c.speeches > 0));
check('[72] มีค่าเฉลี่ยต่อฉาก', ch.characters.every((c) => c.avgLines > 0));
check('[72] มีสัดส่วน % รวมกันได้ ~100',
  Math.abs(ch.characters.reduce((s, c) => s + c.share, 0) - 100) < 1.5,
  ch.characters.map((c) => c.share).join('+'));
check('[72] บอกหน้าแรก/หน้าสุดท้ายที่ปรากฏ',
  ch.characters.every((c) => c.firstPage >= 1 && c.lastPage >= c.firstPage));
check('[72] บทที่ไม่มีบทพูด → รายชื่อว่าง',
  R.generateCharacterReport([{ el: 'action', text: 'เงียบ', idx: 0 }]).characters.length === 0);

// ── 73 กราฟบทพูด ──
const chart = R.generateDialogueChart(script);
check('[73] มีข้อมูลครบทุกหน้า', chart.pages.length === chart.totalPages && chart.pages.length >= 1);
check('[73] เปอร์เซ็นต์ต่อหน้ารวม ~100',
  chart.pages.every((p) => Math.abs(R.CHART_KINDS.reduce((s, k) => s + p.percentages[k], 0) - 100) < 1.5),
  JSON.stringify(chart.pages[0].percentages));
check('[73] มีทั้งบรรยายและบทพูดในหน้าแรก',
  chart.pages[0].percentages.action > 0 && chart.pages[0].percentages.dialogue > 0);
check('[73] ความหนาแน่นตัวละครเรียงจากมากไปน้อย',
  chart.pages.every((p) => p.charDensity.every((d, i) => i === 0 || p.charDensity[i - 1].lines >= d.lines)));
check('[73] มีสรุปทั้งเรื่อง',
  Math.abs(R.CHART_KINDS.reduce((s, k) => s + chart.overall[k], 0) - 100) < 1.5);
check('[73] chartKind จัดกลุ่มถูก',
  R.chartKind('action') === 'action' && R.chartKind('dialogue') === 'dialogue' &&
  R.chartKind('character') === 'character' && R.chartKind('scene') === 'other');
check('[73] ทุกกลุ่มมีป้ายไทย', R.CHART_KINDS.every((k) => (R.CHART_LABELS[k] || '').length > 1));
check('[73] เลขหน้าเริ่มตาม startPage',
  R.generateDialogueChart(script, { startPage: 7 }).pages[0].page === 7);
check('[73] บทว่าง → 1 หน้า ไม่พัง', R.generateDialogueChart([]).pages.length === 1);

// ── ส่งออกเป็นข้อความ ──
check('ข้อความรายงานสถานที่มีชื่อสถานที่', R.locationReportText(loc).includes('ห้องนอน'));
check('ข้อความรายงานตัวละครมีชื่อคน', R.characterReportText(ch).includes('แคสซี่'));
check('ข้อความกราฟมีคำว่า หน้า', R.dialogueChartText(chart).includes('หน้า'));
check('ข้อความรายงานไม่ว่าง',
  R.locationReportText(loc).length > 30 && R.characterReportText(ch).length > 30);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
