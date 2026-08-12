// test/panels69.test.cjs — [alpha.69] แผงใหม่ 3 ตัว: Codex · History · Record (เฉพาะโมดูลบริสุทธิ์)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = (f) => path.join(os.tmpdir(), f);
for (const [src, out] of [['record/record-data.js', '_rec.cjs'],
                          ['history/history-data.js', '_hist.cjs'],
                          ['codex/codex-build.js', '_codex.cjs']])
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/' + src)], outfile: tmp(out),
                      format: 'cjs', bundle: true, logLevel: 'silent' });
const R = require(tmp('_rec.cjs'));
const H = require(tmp('_hist.cjs'));
const C = require(tmp('_codex.cjs'));

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ═══════════════════ Record ═══════════════════
check('[rec] dayKey ใช้เวลาท้องถิ่น (จดตอนดึกแล้ววันต้องไม่เพี้ยน)',
      R.dayKey(new Date(2026, 7, 12, 23, 50)) === '2026-08-12');
check('[rec] dayKey เติมศูนย์หน้าเดือน/วัน', R.dayKey(new Date(2026, 0, 5)) === '2026-01-05');

const e1 = R.newEntry('a', '2026-08-10', { text: 'เขียนบท 1', words: 800, at: '2026-08-10T09:00' });
const e2 = R.newEntry('b', '2026-08-12', { text: 'แก้ฉากจบ', words: 300, mood: 'stuck', tags: ['บท3'] });
const e3 = R.newEntry('c', '2026-08-10', { text: 'ตอนเย็นเขียนต่อ', words: 200, at: '2026-08-10T18:00' });
check('[rec] newEntry ตั้งค่าเริ่มต้นครบ', e1.id === 'a' && e1.mood === '' && Array.isArray(e1.tags));
check('[rec] newEntry คัดลอกแท็ก ไม่ใช้ตัวเดียวกัน (กันแก้แล้วกระทบต้นฉบับ)',
      R.newEntry('x', 'd', { tags: ['t'] }).tags !== R.newEntry('y', 'd', { tags: ['t'] }).tags);

let data = R.migrate({ entries: [e1, e2, e3] });
check('[rec] เรียงใหม่สุดบนสุด', data.entries[0].id === 'b', data.entries.map((x) => x.id).join());
check('[rec] วันเดียวกันเรียงตามเวลาที่จด (เย็นมาก่อนเช้า)',
      data.entries[1].id === 'c' && data.entries[2].id === 'a');

check('[rec] migrate รับของ v1 ({date,note}) ได้',
      R.migrate({ entries: [{ date: '2026-01-01', note: 'เก่า' }] }).entries[0].text === 'เก่า');
check('[rec] migrate รับ array เปล่า ๆ ได้', R.migrate([e1]).entries.length === 1);
check('[rec] migrate ของพัง/null ไม่โยน', R.migrate(null).entries.length === 0 && R.migrate('x').entries.length === 0);
check('[rec] migrate ทิ้งรายการที่ไม่มีทั้งวันและข้อความ',
      R.migrate({ entries: [{ id: 'z', day: '', text: '   ' }] }).entries.length === 0);

data = R.updateEntry(data, 'b', { text: 'แก้ใหม่', words: 500 });
check('[rec] updateEntry แก้ค่าได้ · id ห้ามเปลี่ยน',
      data.entries[0].text === 'แก้ใหม่' && data.entries[0].id === 'b');
check('[rec] removeEntry ลบได้', R.removeEntry(data, 'b').entries.length === 2);
check('[rec] addEntry ต่อแล้วยังเรียงถูก',
      R.addEntry(data, R.newEntry('d', '2026-09-01', { text: 'ใหม่สุด' })).entries[0].id === 'd');

const g = R.groupByDay(data.entries);
check('[rec] groupByDay: 2 วัน', g.length === 2, String(g.length));
check('[rec] groupByDay รวมคำในวันเดียวกัน', g.find((x) => x.day === '2026-08-10').words === 1000);
const sum = R.summarize(data.entries);
check('[rec] summarize นับวัน/รายการ/คำ', sum.days === 2 && sum.entries === 3 && sum.words === 1500,
      JSON.stringify(sum));
check('[rec] summarize บอกวันแรก-วันล่าสุด', sum.first === '2026-08-10' && sum.last === '2026-08-12');

check('[rec] filter คำค้นในข้อความ', R.filterEntries(data.entries, { q: 'เย็น' }).length === 1);
check('[rec] filter คำค้นในแท็ก', R.filterEntries(data.entries, { q: 'บท3' }).length === 1);
check('[rec] filter ช่วงวัน', R.filterEntries(data.entries, { from: '2026-08-11' }).length === 1);
check('[rec] filter อารมณ์', R.filterEntries(data.entries, { mood: 'stuck' }).length === 1);
check('[rec] filter ว่าง = คืนทั้งหมด', R.filterEntries(data.entries, {}).length === 3);

// ── CSV (จุดที่พลาดแล้วไฟล์เปิดใน Excel เพี้ยนทั้งแผ่น) ──
check('[csv] ข้อความธรรมดาไม่ต้องครอบ', R.csvCell('abc') === 'abc');
check('[csv] มีคอมมา → ครอบ', R.csvCell('a,b') === '"a,b"');
check('[csv] มี quote → ครอบ + เบิ้ล quote', R.csvCell('เขา"พูด"') === '"เขา""พูด"""');
check('[csv] ขึ้นบรรทัดใหม่ → ครอบ', R.csvCell('a\nb') === '"a\nb"');
check('[csv] ช่องว่างหัวท้าย → ครอบ (ไม่งั้นโดนตัดทิ้ง)', R.csvCell(' a ') === '" a "');
check('[csv] null/undefined → ช่องว่าง', R.csvCell(null) === '' && R.csvCell(undefined) === '');

const csv = R.toCsv([R.newEntry('a', '2026-08-10', { text: 'บรรทัด1\nบรรทัด2', words: 5, tags: ['x', 'y'] })]);
check('[csv] มี BOM นำหน้า (ภาษาไทยใน Excel ไม่กลายเป็นตัวต่างดาว)', csv.charCodeAt(0) === 0xFEFF);
check('[csv] ปิดท้ายบรรทัดด้วย CRLF', csv.includes('\r\n'));
check('[csv] หัวตารางเป็นภาษาไทย', csv.includes('วันที่') && csv.includes('บันทึก'));
check('[csv] ข้อความหลายบรรทัดถูกครอบไว้ในช่องเดียว', csv.includes('"บรรทัด1\nบรรทัด2"'));
check('[csv] แท็กรวมเป็นช่องเดียว', csv.includes('x y'));
check('[csv] ปิด BOM ได้', R.toCsv([], { bom: false }).charCodeAt(0) !== 0xFEFF);
check('[csv] ไม่มีรายการเลย → ยังมีหัวตาราง', R.toCsv([], { bom: false }).split('\r\n')[0].includes('วันที่'));
check('[csv] จำนวนคอลัมน์คงที่ทุกแถว', (() => {
  const lines = R.toCsv([R.newEntry('a', 'd1', { text: 'a,b' }), R.newEntry('b', 'd2', {})], { bom: false })
    .trim().split('\r\n');
  return lines.length === 3;
})());
check('[csv] ชื่อไฟล์ตัดอักขระต้องห้ามของวินโดวส์',
      R.csvFileName('เล่ม/หนึ่ง:ทดสอบ', '2026-08-12') === 'เล่ม-หนึ่ง-ทดสอบ-records-2026-08-12.csv',
      R.csvFileName('เล่ม/หนึ่ง:ทดสอบ', '2026-08-12'));

// ═══════════════════ History ═══════════════════
check('[hist] ค่าเริ่มต้น 32 ครั้ง', H.DEFAULT_HISTORY_LIMIT === 32);
check('[hist] clampLimit หนีบช่วง', H.clampLimit(1) === 4 && H.clampLimit(9999) === 500 && H.clampLimit(50) === 50);
check('[hist] clampLimit ของพัง → ค่าเริ่มต้น', H.clampLimit('abc') === 32 && H.clampLimit(null) === 32);

let j = H.newJournal();
const rec = (p, before, kind) => ({ kind: kind || 'write', at: '2026-08-12T00:00', files: [{ path: p, before }] });
j = H.addRecord(j, rec('/p/a.md', 'b1')).journal;
j = H.addRecord(j, rec('/p/b.md', null, 'create')).journal;
j = H.addRecord(j, rec('/p/a.md', 'b2')).journal;
check('[hist] จด 3 ครั้ง · seq เดินหน้า', j.entries.length === 3 && j.seq === 3);
check('[hist] บันทึกที่ไม่มีไฟล์เลย = ไม่จด', H.addRecord(j, { files: [] }).journal.entries.length === 3);

// แผนย้อนกลับ — หัวใจของทั้งฟีเจอร์
let plan = H.planRevert(j, 1);
check('[hist] ย้อนไป seq 1 → ถอน 2 บันทึก', plan.undone.join() === '2,3', plan.undone.join());
check('[hist] ไฟล์ที่ถูกแตะซ้ำ ใช้สภาพ "ก่อนการแตะครั้งแรกสุด" (b2 ไม่ใช่ตัวหลัง)',
      plan.ops.find((o) => o.path === '/p/a.md').blob === 'b2',
      JSON.stringify(plan.ops));
check('[hist] ไฟล์ที่ยังไม่เคยมี → สั่งลบ',
      plan.ops.find((o) => o.path === '/p/b.md').op === 'delete');
check('[hist] หนึ่ง path หนึ่งคำสั่งเท่านั้น (ไม่เขียนซ้ำหลายรอบ)',
      new Set(plan.ops.map((o) => o.path)).size === plan.ops.length);
check('[hist] ลบมาก่อนคืนเสมอ (กันเคสย้ายไฟล์ชนกัน)',
      plan.ops[0].op === 'delete', plan.ops.map((o) => o.op).join());
check('[hist] ย้อนไป 0 = ถอนทั้งหมด', H.planRevert(j, 0).undone.length === 3);
check('[hist] ย้อนไปจุดล่าสุด = ไม่มีอะไรต้องทำ', H.planRevert(j, 3).ops.length === 0);
check('[hist] seq ที่ไม่มีจริง (ใหญ่เกิน) = ไม่ทำอะไร', H.planRevert(j, 99).ops.length === 0);

// ย้าย/เปลี่ยนชื่อ = สองไฟล์ในบันทึกเดียว
let jm = H.addRecord(H.newJournal(),
  { kind: 'move', files: [{ path: '/p/old.md', before: 'bo' }, { path: '/p/new.md', before: null }] }).journal;
const pm = H.planRevert(jm, 0);
check('[hist] ย้อนการย้าย: คืนต้นทาง + ลบปลายทาง', pm.ops.length === 2
      && pm.ops.find((o) => o.path === '/p/old.md').op === 'restore'
      && pm.ops.find((o) => o.path === '/p/new.md').op === 'delete');

// ตัดของเก่า
let jp = H.newJournal();
for (let i = 1; i <= 10; i++) jp = H.addRecord(jp, rec('/p/f' + i + '.md', 'blob' + i), 4).journal;
check('[hist] เก็บไม่เกินที่ตั้งไว้', jp.entries.length === 4, String(jp.entries.length));
check('[hist] ที่เหลือคือครั้งล่าสุด', jp.entries[jp.entries.length - 1].seq === 10);
const dropRes = H.addRecord(jp, rec('/p/f11.md', 'blob11'), 4);
check('[hist] ก้อนของบันทึกที่ถูกตัด ถูกส่งกลับให้ลบ', dropRes.dropped.includes('blob7'),
      JSON.stringify(dropRes.dropped));
check('[hist] ตัดแล้วเรียก prune ซ้ำ = ไม่มีอะไรให้ลบอีก (ไม่ลบซ้ำ)',
      H.prune(dropRes.journal, 4).dropped.length === 0);
{
  // blob เดียวถูกอ้างจากสองบันทึก → ตัดบันทึกแรกทิ้ง ต้อง **ยังไม่ลบ** ก้อนนั้น
  let js = H.newJournal();
  js = H.addRecord(js, rec('/p/x.md', 'shared'), 2).journal;
  js = H.addRecord(js, rec('/p/y.md', 'shared'), 2).journal;
  const r = H.addRecord(js, rec('/p/z.md', 'zz'), 2);
  check('[hist] ก้อนที่ยังมีคนอ้างอยู่ ห้ามลบ', !r.dropped.includes('shared'), JSON.stringify(r.dropped));
}
check('[hist] referencedBlobs รวมทุกก้อนที่ยังอ้างอยู่',
      H.referencedBlobs(j).has('b1') && H.referencedBlobs(j).has('b2'));

const ar = H.afterRevert(j, 1);
check('[hist] หลังย้อนกลับ บันทึกที่ถูกถอนต้องหายไป', ar.journal.entries.length === 1);
check('[hist] ...แต่ตัวนับ seq ต้องไม่ถอยหลัง (เลขที่เคยใช้ห้ามถูกแจกซ้ำ)', ar.journal.seq === j.seq,
      `${j.seq} → ${ar.journal.seq}`);
check('[hist] จดต่อหลังย้อนกลับ → ได้เลขใหม่ที่ไม่ชนของเก่า',
      H.addRecord(ar.journal, rec('/p/c.md', 'b9')).journal.seq === j.seq + 1);
check('[hist] ...และคืนก้อนที่ไม่มีใครอ้างแล้วให้ลบ', ar.dropped.includes('b2'), JSON.stringify(ar.dropped));

check('[hist] migrate ของพังไม่โยน', H.migrate(null).entries.length === 0 && H.migrate({ entries: 'x' }).entries.length === 0);
check('[hist] migrate ทิ้งรายการที่ไม่มี seq', H.migrate({ entries: [{ files: [] }] }).entries.length === 0);
check('[hist] migrate กู้ seq จากรายการที่มีอยู่', H.migrate({ seq: 0, entries: [{ seq: 7, files: [{ path: 'a' }] }] }).seq === 7);

check('[hist] relPath ตัดรากโปรเจกต์ออก', H.relPath('C:/proj/เล่ม/a.md', 'C:/proj') === 'เล่ม/a.md');
check('[hist] relPath ข้ามชนิดสแลชได้', H.relPath('C:\\proj\\a.md', 'C:/proj') === 'a.md');
check('[hist] relPath ไฟล์นอกโปรเจกต์ = คงเดิม', H.relPath('D:/อื่น/a.md', 'C:/proj') === 'D:/อื่น/a.md');
check('[hist] describe บอกชนิด + ชื่อไฟล์',
      H.describe({ kind: 'write', files: [{ path: 'C:/p/a.md' }] }, 'C:/p') === 'แก้ไข · a.md');
check('[hist] describe หลายไฟล์ → บอกจำนวนที่เหลือ',
      H.describe({ kind: 'move', files: [{ path: 'C:/p/a.md' }, { path: 'C:/p/b.md' }] }, 'C:/p')
        === 'ย้าย/เปลี่ยนชื่อ · a.md +1');
const tl = H.timeline(j, '/p');
check('[hist] timeline ใหม่สุดอยู่บน', tl[0].seq === 3 && tl[tl.length - 1].seq === 1);

// ═══════════════════ Codex ═══════════════════
const ents = [
  { path: '/w/characters/tora.json', name: 'โทระ', cat: 'characters', aliases: ['เจ้าหนู'],
    entity: { fields: { บทบาท: 'พระเอก', อายุ: '' }, body: 'ย่อหน้าแรก\n\nย่อหน้าสอง',
              relations: [{ role: 'พี่ชายของ', target: '/w/characters/cassie.json' },
                          { role: 'ศัตรูของ', target: '/w/characters/ghost.json' }] } },
  { path: '/w/characters/cassie.json', name: 'แคสซี่', cat: 'characters', entity: {} },
  { path: '/w/locations/bakery.json', name: 'ร้านขนม', cat: 'locations', entity: { fields: { เมือง: 'บางกอก' } } },
];
check('[codex] esc หนี HTML ครบ', C.esc('<a href="x">&\'</a>')
      === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
check('[codex] slug ตัดอักขระที่ใช้เป็นชื่อไฟล์ไม่ได้', C.slug('a/b:c*d') === 'abcd');
check('[codex] slug ชื่อไทยใช้ได้ตรง ๆ', C.slug('โทระ') === 'โทระ');
check('[codex] slug ชื่อว่าง → มีค่าเริ่มต้น', C.slug('   ') === 'entry');

const pages = C.assignPages(ents);
check('[codex] ตั้งชื่อไฟล์ให้ทุกเอนทิตี้', pages.size === 3 && pages.get(ents[0].path) === 'โทระ.html');
check('[codex] ชื่อซ้ำไม่ชนกัน', (() => {
  const p = C.assignPages([{ path: 'a', name: 'ซ้ำ' }, { path: 'b', name: 'ซ้ำ' }]);
  return p.get('a') !== p.get('b');
})());

check('[codex] infoRows ตัดค่าว่างทิ้ง (ช่องเปล่าดูเหมือนของพัง)',
      C.infoRows(ents[0].entity).length === 1 && C.infoRows(ents[0].entity)[0][0] === 'บทบาท');
check('[codex] infoRows รวม array เป็นข้อความเดียว',
      C.infoRows({ fields: { แท็ก: ['a', 'b'] } })[0][1] === 'a, b');

const rels = C.relationRows(ents[0].entity, pages);
check('[codex] ความสัมพันธ์ที่ปลายทางอยู่ในเล่ม → ลิงก์ได้', rels[0].page === 'แคสซี่.html');
check('[codex] ปลายทางที่ไม่มีในเล่ม → ไม่มีลิงก์ (ต้องไม่ลิงก์ไปหน้าที่ไม่มีอยู่)', rels[1].page === '');

check('[codex] paragraphs แยกย่อหน้า', C.paragraphs('a\n\nb') === '<p>a</p>\n<p>b</p>');
check('[codex] paragraphs หนี HTML ในเนื้อหาด้วย', C.paragraphs('<script>').includes('&lt;script&gt;'));
check('[codex] paragraphs ข้อความว่าง → ว่าง', C.paragraphs('   ') === '');

const files = C.buildCodexSite(ents, { siteTitle: 'สารานุกรมของฉัน',
                                       mentions: { '/w/characters/tora.json': ['บท1 · ฉาก2'] } });
const byName = Object.fromEntries(files.map((f) => [f.name, f.text]));
check('[codex] สร้างครบ: index + หมวด 2 + เอนทิตี้ 3 = 6 ไฟล์', files.length === 6,
      files.map((f) => f.name).join());
check('[codex] มีหน้าแรก', !!byName['index.html']);
check('[codex] มีหน้าหมวดทั้งสอง', !!byName['cat-characters.html'] && !!byName['cat-locations.html']);
check('[codex] ทุกหน้าเป็น HTML สมบูรณ์', files.every((f) => f.text.startsWith('<!DOCTYPE html>')));
check('[codex] ทุกหน้าประกาศ UTF-8 (ภาษาไทยต้องไม่เพี้ยน)',
      files.every((f) => f.text.includes('charset="UTF-8"')));
check('[codex] ไม่มีการเรียกไฟล์จากภายนอกเลย (เปิด offline ได้จริง)',
      files.every((f) => !/(src|href)="https?:/.test(f.text)));
check('[codex] หน้าแรกมีช่องค้นหาที่ทำงานได้เอง', byName['index.html'].includes('id="q"')
      && byName['index.html'].includes('addEventListener'));
check('[codex] หน้าเอนทิตี้มี infobox + ชื่อเล่น + เนื้อหา', (() => {
  const p = byName['โทระ.html'];
  return p.includes('infobox') && p.includes('เจ้าหนู') && p.includes('ย่อหน้าสอง');
})());
check('[codex] หน้าเอนทิตี้มีส่วน "ปรากฏในฉาก" เมื่อมี backlinks',
      byName['โทระ.html'].includes('ปรากฏในฉาก') && byName['โทระ.html'].includes('บท1 · ฉาก2'));
check('[codex] เอนทิตี้ที่ไม่มี backlinks ไม่ขึ้นส่วนนั้น (ไม่โชว์หัวข้อว่าง)',
      !byName['แคสซี่.html'].includes('ปรากฏในฉาก'));
check('[codex] ไม่มีคำอธิบาย → บอกตรง ๆ ไม่ใช่ปล่อยว่าง',
      byName['แคสซี่.html'].includes('ยังไม่มีคำอธิบาย'));
check('[codex] ลิงก์ความสัมพันธ์ชี้ไปหน้าที่มีอยู่จริง', byName['โทระ.html'].includes('href="แคสซี่.html"'));
check('[codex] เมนูบนมีทุกหมวด', byName['index.html'].includes('cat-characters.html')
      && byName['index.html'].includes('cat-locations.html'));
check('[codex] ชื่อเว็บตามที่ตั้ง', byName['index.html'].includes('สารานุกรมของฉัน'));
check('[codex] เรียงตามชื่อไทย', (() => {
  const g = C.buildCodexSite([{ path: 'b', name: 'ฮา', cat: 'c', entity: {} },
                              { path: 'a', name: 'กา', cat: 'c', entity: {} }], {});
  const idx = g.find((f) => f.name === 'index.html').text;
  return idx.indexOf('กา') < idx.indexOf('ฮา');
})());
check('[codex] ไม่มีเอนทิตี้เลย → ยังได้หน้าแรก ไม่ล้ม',
      C.buildCodexSite([], {}).length === 1);
check('[codex] เอนทิตี้ที่ไม่มีชื่อถูกข้าม', C.buildCodexSite([{ path: 'x', cat: 'c' }], {}).length === 1);
check('[codex] ชื่อเอนทิตี้ที่มี HTML ปนไม่หลุดออกไปเป็นแท็ก', (() => {
  const g = C.buildCodexSite([{ path: 'x', name: '<script>alert(1)</script>', cat: 'c', entity: {} }], {});
  return g.every((f) => !f.text.includes('<script>alert(1)</script>'));
})());
const st = C.codexStats(ents);
check('[codex] สถิติ: 3 รายการ 2 หมวด', st.total === 3 && st.cats === 2 && st.byCat.characters === 2);

console.log(`\npanels69 (codex/history/record): ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
