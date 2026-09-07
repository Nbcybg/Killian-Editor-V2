// test/sp-title-pages.test.cjs — unit test หน้าปกหลายหน้า (ข้อ 90)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
};
const TP = build('sp-title-pages.js', 'k2-tp-test.cjs');
const SF = build('sp-format.js', 'k2-tp-fmt-test.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const fmt = SF.mergeSpFormat();

// ── ค่าเริ่มต้นของสตริง ──
const s0 = TP.newTitleString();
check('newTitleString มีคีย์ครบ',
  s0.text === '' && s0.size === 12 && s0.align === 'left' &&
  s0.bold === false && s0.width === 0);
check('หน่วยเป็นนิ้ว (x/y เริ่มที่ค่าในช่วงกระดาษ)', s0.x === 1.5 && s0.y === 4.5);
check('รับ patch ทับได้', TP.newTitleString({ text: 'ก', size: 24 }).size === 24);
check('มีการจัดหน้า 3 แบบ', TP.TITLE_ALIGNS.join() === 'left,center,right');
check('newTitlePage ว่าง = ไม่มีสตริง', TP.newTitlePage().strings.length === 0);

// ── normalize ──
check('normalize(null) = []', TP.normalizeTitlePages(null).length === 0);
check('normalize รับทั้ง array และ {pages:[…]}',
  TP.normalizeTitlePages({ pages: [{ strings: [{ text: 'a' }] }] }).length === 1);
const nz = TP.normalizeTitlePages([{ strings: [{ text: 'a', x: 'ไม่ใช่เลข', size: 999, align: 'x' }] }]);
check('ค่าที่ไม่ใช่เลข → ค่าเริ่มต้น', nz[0].strings[0].x === 1.5, nz[0].strings[0].x);
check('ขนาดถูกหนีบไม่เกิน 96pt', nz[0].strings[0].size === 96, nz[0].strings[0].size);
check('align ที่ไม่รู้จัก → left', nz[0].strings[0].align === 'left');
check('normalize ไม่ทำ boolean หลุด',
  nz[0].strings[0].bold === false && nz[0].strings[0].underline === false);
check('normalize หน้าที่ไม่มี strings ก็ยังเป็นหน้าเปล่าที่ใช้ได้',
  TP.normalizeTitlePages([{}])[0].strings.length === 0);

// ── หน้าปกมาตรฐาน ──
const meta = { title: 'ยามเมื่อฟ้าสาง', author: 'ท็อป', screenplayBy: 'บทโดย',
               basedOn: 'นิยายชื่อเดียวกัน', contact: 'top@example.com', copyright: '© 2026',
               draft: 'ร่างที่สอง' };
const def = TP.defaultTitlePages(meta, fmt);
check('หน้าปกมาตรฐาน = 1 หน้า', def.length === 1);
check('มีชื่อเรื่องอยู่ในหน้าปก', def[0].strings.some((s) => s.text === meta.title));
check('ชื่อเรื่องจัดกลางและตัวหนา',
  def[0].strings.some((s) => s.text === meta.title && s.align === 'center' && s.bold === true));
check('มีชื่อผู้เขียน / ที่มา / ติดต่อ / ลิขสิทธิ์ / ฉบับ',
  ['ท็อป', 'นิยายชื่อเดียวกัน', 'top@example.com', '© 2026', 'ร่างที่สอง']
    .every((t) => def[0].strings.some((s) => s.text.includes(t))));
check('ข้อมูลติดต่อ/ฉบับอยู่ครึ่งล่างของกระดาษ',
  def[0].strings.filter((s) => s.text.includes('@') || s.text === 'ร่างที่สอง')
    .every((s) => s.y > fmt.paper.height / 2));
check('ทุกชิ้นอยู่ในกระดาษ (ไม่ล้นขอบล่าง)',
  def[0].strings.every((s) => s.y < fmt.paper.height && s.y >= 0));
check('meta ว่าง → ยังได้หน้าปกที่ใช้ได้ (ไม่พัง)', (() => {
  const d = TP.defaultTitlePages({}, null);
  return d.length === 1 && d[0].strings.length >= 1 && d[0].strings[0].text.trim() !== '';
})());
check('A4 → ตำแหน่งล่างขยับตามความสูงกระดาษ', (() => {
  const a4 = TP.defaultTitlePages(meta, SF.mergeSpFormat({ paperSize: 'a4' }));
  const y1 = def[0].strings.find((s) => s.text.includes('@')).y;
  const y2 = a4[0].strings.find((s) => s.text.includes('@')).y;
  return Math.abs(y2 - y1) > 0.5;
})());

// ── TitlePageEditor ──
const ed = new TP.TitlePageEditor(def);
check('editor โหลดหน้าปกเข้ามา', ed.count === 1);
const at = ed.addPage();
check('addPage ต่อท้าย', ed.count === 2 && at === 1);
check('addPage แทรกกลางได้', (() => { const e = new TP.TitlePageEditor([{ strings: [] }, { strings: [] }]);
  return e.addPage(1) === 1 && e.count === 3; })());
check('addPage ค่าเกินขอบถูกหนีบ', (() => { const e = new TP.TitlePageEditor([]);
  return e.addPage(99) === 0; })());
const si = ed.addString(1, { text: 'หน้าที่สอง', y: 2 });
check('addString คืน index', si === 0 && ed.strings(1).length === 1);
check('addString หน้าที่ไม่มี → -1', ed.addString(9, { text: 'x' }) === -1);
check('updateString แก้ค่าได้', ed.updateString(1, 0, { size: 18, bold: true }) &&
  ed.strings(1)[0].size === 18 && ed.strings(1)[0].bold === true);
check('updateString normalize ค่าที่ผิดชนิดให้ด้วย',
  ed.updateString(1, 0, { size: 'มั่ว' }) && ed.strings(1)[0].size === 12);
check('updateString ชิ้นที่ไม่มี → false', ed.updateString(1, 9, { size: 9 }) === false);
check('moveString สลับลำดับได้', (() => {
  ed.addString(1, { text: 'B' });
  const to = ed.moveString(1, 1, 0);
  return to === 0 && ed.strings(1)[0].text === 'B';
})());
check('moveString ไปที่เดิม = index เดิม', ed.moveString(1, 0, 0) === 0);
check('deleteString ลบได้', ed.deleteString(1, 0) && ed.strings(1).length === 1);
check('deleteString ชิ้นที่ไม่มี → false', ed.deleteString(1, 9) === false);
check('movePage ย้ายหน้าได้', (() => {
  const e = new TP.TitlePageEditor([{ strings: [{ text: 'A' }] }, { strings: [{ text: 'B' }] }]);
  return e.movePage(0, 1) === 1 && e.strings(0)[0].text === 'B';
})());
check('movePage หน้าที่ไม่มี → -1', ed.movePage(9, 0) === -1);
check('movePage ปลายทางเกินขอบถูกหนีบ', (() => {
  const e = new TP.TitlePageEditor([{ strings: [] }, { strings: [] }]);
  return e.movePage(0, 99) === 1;
})());
check('deletePage ลบได้', ed.deletePage(1) && ed.count === 1);
check('deletePage หน้าที่ไม่มี → false', ed.deletePage(9) === false);
check('ลบหน้าจนหมดได้ (ไม่มีหน้าปก = ไม่ใส่หน้าปก)', (() => {
  const e = new TP.TitlePageEditor([{ strings: [] }]);
  return e.deletePage(0) && e.count === 0;
})());
check('toJSON มีเลขรุ่นไว้ย้ายข้อมูลในอนาคต',
  ed.toJSON().version === TP.TITLE_PAGE_VERSION && Array.isArray(ed.toJSON().pages));
check('filled() ตัดชิ้นที่ข้อความว่างออก', (() => {
  const e = new TP.TitlePageEditor([{ strings: [{ text: 'ก' }, { text: '   ' }] }]);
  return e.filled()[0].strings.length === 1;
})());
check('page()/strings() ของ index ที่ไม่มี ไม่ throw',
  ed.page(42) === null && ed.strings(42).length === 0);

// ── HTML ──
const inner = TP.titlePageInnerHtml(def[0], fmt);
check('วางชิ้นแบบ absolute เป็นนิ้ว', inner.includes('position:absolute') && inner.includes('in;'));
check('มีชื่อเรื่องอยู่ใน HTML', inner.includes(meta.title));
check('ตัวหนาออกมาเป็น font-weight:700', inner.includes('font-weight:700'));
check('ขนาดออกมาเป็น pt', inner.includes('font-size:12pt'));
check('escape ข้อความผู้ใช้', (() => {
  const h = TP.titlePageInnerHtml({ strings: [TP.newTitleString({ text: '<script>x' })] }, fmt);
  return !h.includes('<script>') && h.includes('&lt;script&gt;');
})());
check('ชิ้นที่ข้อความว่างไม่ถูกวาด',
  TP.titlePageInnerHtml({ strings: [TP.newTitleString({ text: '  ' })] }, fmt) === '');
check('renderToHtml ของ editor = ชิ้นส่วนหน้านั้น',
  new TP.TitlePageEditor(def).renderToHtml(0, fmt) === inner);
check('renderToHtml หน้าที่ไม่มี → ว่าง', new TP.TitlePageEditor(def).renderToHtml(9, fmt) === '');

const full = TP.titlePagesHtml([...def, { strings: [{ text: 'สอง' }] }], fmt);
check('titlePagesHtml ได้ section ต่อหน้า',
  (full.match(/class="pg pg-title"/g) || []).length === 2);
const tcss = TP.titlePagesCss(fmt);
check('CSS หน้าปก = กระดาษเต็มใบ ไม่มีระยะขอบ',
  tcss.includes('width:8.5in') && tcss.includes('height:11in') && tcss.includes('padding:0'));
check('CSS หน้าปกขึ้นหน้าใหม่ทุกใบ', tcss.includes('break-after:page'));
check('cssFamily ใส่อัญประกาศและกัน ; { } หลุด',
  TP.cssFamily('My Font') === '"My Font",monospace' &&
  !TP.cssFamily('a;}body{x').includes(';'));
check('cssFamily ว่าง = ไม่เขียนกฎ', TP.cssFamily('') === '' && TP.cssFamily(null) === '');

// ── ข้อความล้วน ──
const txt = TP.titlePagesText(def, fmt);
check('titlePagesText มีชื่อเรื่อง', txt.includes(meta.title));
check('titlePagesText จัดกลางด้วยช่องว่างนำหน้า',
  txt.split('\n').some((l) => /^\s+/.test(l) && l.includes(meta.title)));
check('titlePagesText เรียงตาม y (ชื่อเรื่องมาก่อนลิขสิทธิ์)',
  txt.indexOf(meta.title) < txt.indexOf('© 2026'));
check('titlePagesText หลายหน้า → คั่นด้วยบรรทัดว่าง',
  TP.titlePagesText([{ strings: [{ text: 'A' }] }, { strings: [{ text: 'B' }] }], fmt)
    .includes('A\n\n\nB'));
check('titlePagesText ว่าง = สตริงว่าง', TP.titlePagesText([], fmt) === '');
check('titlePageCount นับหน้าเปล่าด้วย (ยังเป็นกระดาษ 1 แผ่น)',
  TP.titlePageCount([{ strings: [] }, { strings: [] }]) === 2);
check('titlePageCount(null) = 0', TP.titlePageCount(null) === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
