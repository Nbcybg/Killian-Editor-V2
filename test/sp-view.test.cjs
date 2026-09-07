// test/sp-view.test.cjs — unit test โหมดมุมมองบท + ไปยังหน้า/ฉาก (ข้อ 57, 59, 60, 78)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-spview-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'sp-view.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const SV = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── รายการโหมด ──
// [alpha.99 ข้อ 1+2] มุมมอง "จัดหน้า" กลับมา — ตัด **สวิตช์โหมดหน้ากระดาษ** ทิ้งแทน
// (สองอย่างนี้ทำเรื่องเดียวกัน เหลือไว้อย่างเดียวคือมุมมอง ซึ่งเป็นที่ที่ผู้ใช้มองหาอยู่แล้ว)
check('มี 6 โหมด: ปกติ/จัดหน้า/ร่าง/เรียงหน้า/ภาพรวม 2 ระดับ',
  SV.SP_VIEWS.length === 6 && SV.SP_VIEWS.includes('layout'), SV.SP_VIEWS.join(','));
check('[99-1] โหมดจัดหน้ายังพิมพ์ได้ (ไม่ใช่มุมมองอ่านอย่างเดียว)',
  SV.isValidView('layout') && SV.isEditView('layout') && !SV.isPageView('layout'));
check('[99-1] คลาสของโหมดจัดหน้าอยู่ในรายการที่ล้างได้',
  SV.ALL_VIEW_CLASSES.includes('sp-view-layout')
  && !SV.ALL_VIEW_CLASSES.includes('sp-view-paper'));
check('ทุกโหมดมีป้ายชื่อภาษาไทย', SV.SP_VIEWS.every((m) => (SV.SP_VIEW_LABELS[m] || '').length > 2));
check('ทุกโหมดมีคลาส CSS กำกับ (normal = ว่าง)',
  SV.SP_VIEW_CLASS.normal === '' && SV.SP_VIEWS.slice(1).every((m) => SV.SP_VIEW_CLASS[m].length > 3));
check('คลาสทุกตัวที่ใช้อยู่ใน ALL_VIEW_CLASSES (ล้างได้หมด)',
  SV.SP_VIEWS.every((m) => SV.SP_VIEW_CLASS[m].split(' ').filter(Boolean)
    .every((c) => SV.ALL_VIEW_CLASSES.includes(c))));
check('isPageView: side/overview = จริง · normal/draft = เท็จ',
  SV.isPageView('side') && SV.isPageView('overview1') && SV.isPageView('overview4') &&
  !SV.isPageView('normal') && !SV.isPageView('draft'));
check('isValidView กันชื่อโหมดมั่ว', SV.isValidView('draft') && !SV.isValidView('zzz'));

// ── 59 fitScale ──
{
  const pw = 8.5 * 96;   // 816px
  const one = SV.fitScale(900, pw, 20);
  check('กว้าง 900px → 2 หน้าต่อแถว (ครึ่งหน้าขึ้นไปยังอ่านได้)', one.perRow === 2, JSON.stringify(one));
  check('กว้าง 900px → ไม่ขยายเกิน 1 เท่า', one.scale <= 1, one.scale);
  check('ไม่ยัดหน้าจนเล็กกว่าครึ่ง (minScale 0.5)', one.scale >= 0.5, one.scale);
  const two = SV.fitScale(1400, pw, 20);
  check('กว้าง 1400px → 3 หน้าต่อแถว', two.perRow === 3, JSON.stringify(two));
  check('หน้าต่อแถวมากขึ้นแล้วต้องย่อลง (<1)', two.scale < 1 && two.scale >= 0.5, two.scale);
  check('หน้าที่ย่อแล้วรวมกันไม่ล้นความกว้าง',
    two.perRow * pw * two.scale + 20 * (two.perRow + 1) <= 1400 + 1,
    two.perRow * pw * two.scale + 80);
  const wide = SV.fitScale(4000, pw, 20);
  check('จอกว้างมาก → ไม่เกิน 4 หน้าต่อแถว (ค่าเริ่มต้น)', wide.perRow === 4, JSON.stringify(wide));
  const tiny = SV.fitScale(200, pw, 20);
  check('พื้นที่แคบมาก → ยังได้ 1 หน้า และสเกลไม่ติดลบ',
    tiny.perRow === 1 && tiny.scale > 0 && tiny.scale < 0.35, JSON.stringify(tiny));
  check('containerW ผิดรูป (0/NaN) ไม่ทำให้พัง', SV.fitScale(0, pw).scale > 0 && SV.fitScale(NaN, pw).perRow === 1);
  const cap = SV.fitScale(4000, pw, 20, { maxPerRow: 2 });
  check('ตั้ง maxPerRow เองได้', cap.perRow === 2, JSON.stringify(cap));
}

// ── 60 overviewScale ──
{
  check('1px/ตัวอักษร ≈ สเกล 0.1042 (9.6px ต่อตัว)',
    Math.abs(SV.overviewScale(1) - 1 / 9.6) < 0.001, SV.overviewScale(1));
  check('4px/ตัวอักษร = 4 เท่าของ 1px',
    Math.abs(SV.overviewScale(4) - SV.overviewScale(1) * 4) < 0.001, SV.overviewScale(4));
  check('ตาราง OVERVIEW_PX ตรงกับชื่อโหมด', SV.OVERVIEW_PX.overview1 === 1 && SV.OVERVIEW_PX.overview4 === 4);
  check('viewScale โหมดภาพรวมไม่สนความกว้างหน้าต่าง',
    SV.viewScale('overview1', 400, 816).scale === SV.viewScale('overview1', 4000, 816).scale);
  check('viewScale โหมด side คำนวณตามความกว้าง',
    SV.viewScale('side', 1400, 816).perRow === 3 && SV.viewScale('side', 700, 816).perRow === 1,
    JSON.stringify(SV.viewScale('side', 1400, 816)));
}

// ── 61 ชนิดการจบบรรทัด ──
check('ข้อความสั้น = hard', SV.lineEndingType('สั้น', 3.5) === 'hard');
check('ข้อความยาวจนตัดบรรทัด = soft', SV.lineEndingType('word '.repeat(40), 3.5) === 'soft');
check('มีสัญลักษณ์ประจำแต่ละชนิด', !!SV.LINE_MARK.hard && !!SV.LINE_MARK.soft);

// ── blocksFromDoc (จำลอง doc ของ ProseMirror) ──
{
  const mkDoc = (nodes) => ({
    forEach(fn) { let off = 0; for (const n of nodes) { fn(n, off); off += n.nodeSize; } },
  });
  const node = (el, text) => ({ type: { name: 'sp' }, attrs: { el }, textContent: text, nodeSize: text.length + 2 });
  const img = { type: { name: 'spimage' }, attrs: { alt: 'ภาพ' }, nodeSize: 1 };
  const doc = mkDoc([node('scene', 'INT. ห้อง'), node('action', ''), node('character', 'ทอร่า'), img]);
  const blocks = SV.blocksFromDoc(doc);
  check('blocksFromDoc คืนครบทุกบล็อก', blocks.length === 4, blocks.length);
  check('บล็อกบรรยายที่ไม่มีข้อความ → el = blank', blocks[1].el === 'blank', blocks[1].el);
  check('spimage → el = image พร้อม alt', blocks[3].el === 'image' && blocks[3].text === 'ภาพ');
  check('ทุกบล็อกมี pos และ idx', blocks.every((b) => Number.isFinite(b.pos) && Number.isFinite(b.idx)));
  check('pos ของบล็อกที่ 2 = ขนาดบล็อกแรก', blocks[1].pos === blocks[0].text.length + 2, blocks[1].pos);
  check('doc ที่ไม่ถูกต้องคืน array ว่าง', SV.blocksFromDoc(null).length === 0);
}

// ── 78 หาตำแหน่งหน้า/ฉาก ──
{
  const pages = { pages: [
    { index: 1, blocks: [{ el: 'scene', text: 'a', pos: 0 }, { el: 'action', text: 'b', pos: 10 }] },
    { index: 2, blocks: [{ el: 'more', text: '(MORE)' }, { el: 'character', text: 'ทอร่า', pos: 50 }] },
    { index: 3, blocks: [{ el: 'action', text: 'c', pos: 90 }] },
  ] };
  const starts = SV.pageStartPositions(pages);
  check('pageStartPositions คืนตำแหน่งละหน้า', starts.length === 3, JSON.stringify(starts));
  check('ข้ามบล็อกสังเคราะห์ (MORE) ที่ไม่มี pos', starts[1] === 50, starts[1]);
  check('findPageStart หน้า 1 = ต้นเอกสาร', SV.findPageStart(pages, 1) === 0);
  check('findPageStart หน้า 3', SV.findPageStart(pages, 3) === 90);
  check('findPageStart เกินจำนวนหน้า → null', SV.findPageStart(pages, 9) === null);
  check('findPageStart รับ array ของ pages ตรง ๆ ได้', SV.findPageStart(pages.pages, 2) === 50);

  const blocks = [
    { el: 'scene', text: 'INT. ห้อง - วัน', pos: 0, idx: 0 },
    { el: 'action', text: 'x', pos: 20, idx: 1 },
    { el: 'scene', text: 'EXT. สวน - คืน', pos: 30, idx: 2 },
  ];
  const scenes = SV.scenePositions(blocks);
  check('scenePositions นับเฉพาะหัวฉาก', scenes.length === 2, scenes.length);
  check('เลขฉากเริ่มที่ 1', scenes[0].n === 1 && scenes[1].n === 2);
  check('เก็บข้อความหัวฉากไว้ให้เลือกในกล่อง', scenes[1].text.includes('สวน'));
  check('findNthScene ฉากที่ 2', SV.findNthScene(blocks, 2) === 30);
  check('findNthScene เกินจำนวน → null', SV.findNthScene(blocks, 5) === null);
}

// ── pagesOf ใช้เอนจิน paginate จริง ──
{
  const blocks = [];
  for (let i = 0; i < 200; i++) blocks.push({ el: 'action', text: 'บรรทัดที่ ' + i, pos: i * 10, idx: i });
  const pg = SV.pagesOf(blocks);
  check('pagesOf แบ่งบทยาวเป็นหลายหน้า', pg.count > 1, pg.count);
  check('ทุกหน้ามีบล็อกที่ยังมี pos ติดไปด้วย (สำหรับ goto)',
    SV.pageStartPositions(pg).every((p) => Number.isFinite(p)));
}

// ── ข้อความแถบสถานะ ──
check('viewStatusText บอกชื่อโหมด + จำนวนหน้า',
  SV.viewStatusText('side', 12).includes('12 หน้า') && SV.viewStatusText('side', 12).includes('Side-by-Side'),
  SV.viewStatusText('side', 12));
check('viewStatusText ไม่มีจำนวนหน้าก็ยังใช้ได้', SV.viewStatusText('draft').includes('Draft'));

// ── [58] Layout View — มาตรวัดหน้ากระดาษ ──
const mt = SV.pageMetrics();
check('[58] Letter = 54 บรรทัด/หน้า', mt.linesPerPage === 54, mt.linesPerPage);
check('[58] พื้นที่พิมพ์ 6 นิ้ว = 60 ตัวอักษร/บรรทัด', mt.charsPerLine === 60, mt.charsPerLine);
check('[58] กระดาษ 8.5×11 นิ้ว = 816×1056 px', mt.pageWidthPx === 816 && mt.pageHeightPx === 1056,
  mt.pageWidthPx + 'x' + mt.pageHeightPx);
check('[58] ความสูงเนื้อหน้า = 9 นิ้ว = 864px', mt.bodyHeightPx === 864, mt.bodyHeightPx);
check('[58] 1 บรรทัด = 16px (6 บรรทัด/นิ้ว)', mt.lineHeightPx === 16, mt.lineHeightPx);
check('[58] 54 บรรทัด × 16px = ความสูงเนื้อหน้าพอดี',
  mt.linesPerPage * mt.lineHeightPx === mt.bodyHeightPx);
const a4 = SV.pageMetrics({ paperSize: 'a4' });
check('[58] A4 สูงกว่า → บรรทัดมากกว่า Letter', a4.linesPerPage > mt.linesPerPage, a4.linesPerPage);
check('[58] A4 แคบกว่า → ตัวอักษรต่อบรรทัดน้อยกว่า', a4.charsPerLine < mt.charsPerLine, a4.charsPerLine);
const vars = SV.layoutCssVars();
check('[58] layoutCssVars ให้ตัวแปร CSS ครบ',
  vars['--sp-body-h'] === '864px' && vars['--sp-line-h'] === '16px' && /px$/.test(vars['--sp-page-gap']),
  JSON.stringify(vars));
check('[58] ช่องว่างคั่นหน้าไม่แคบเกินจนมองไม่เห็น',
  parseInt(SV.layoutCssVars(null, 0)['--sp-page-gap'], 10) >= 8);
check('[58] โหมดจัดหน้ายังพิมพ์ได้ (ไม่ใช่ page view)',
  SV.isEditView('normal') && !SV.isPageView('normal'));
check('[58] โหมดเรียงหน้า/ภาพรวม = อ่านอย่างเดียว',
  !SV.isEditView('side') && !SV.isEditView('overview4'));
check('[58] โหมดจัดหน้ามีคลาส CSS ของตัวเอง',
  SV.SP_VIEW_CLASS.layout.split(' ').includes('sp-view-layout'));
// ── [alpha.100 ข้อ 1] `k-paper` = "มุมมองนี้มีแผ่นกระดาษจริง" ──
// กฎกระดาษทั้งชุดใน style.css ผูกกับคลาสนี้ · มุมมองปกติต้อง **ไม่มี** ไม่งั้นได้แผ่นครีมกลับมา
check('[100-1] ★ มุมมองปกติไม่มีคลาสกระดาษ (ไม่แสดงแผ่น)',
  SV.SP_VIEW_CLASS.normal === '' && !SV.isPaperView('normal'));
check('[100-1] ★ มุมมองจัดหน้ามีคลาสกระดาษ',
  SV.SP_VIEW_CLASS.layout.split(' ').includes('k-paper') && SV.isPaperView('layout'));
check('[100-1] โหมดร่าง/หน้าคู่/ภาพรวม ไม่มีคลาสกระดาษ (วาดแผ่นเองคนละทาง)',
  ['draft', 'side', 'overview1', 'overview4']
    .every((m) => !SV.SP_VIEW_CLASS[m].split(' ').includes('k-paper') && !SV.isPaperView(m)));
check('[100-1] k-paper ถูกล้างตอนสลับมุมมอง (อยู่ใน ALL_VIEW_CLASSES)',
  SV.ALL_VIEW_CLASSES.includes('k-paper'));
check('[58] ALL_VIEW_CLASSES ครอบคลุมทุกโหมด (ล้างคลาสได้หมด)',
  SV.SP_VIEWS.filter((m) => m !== 'normal')
    .every((m) => SV.SP_VIEW_CLASS[m].split(' ').every((c) => SV.ALL_VIEW_CLASSES.includes(c))));

// ── [alpha.87 ข้อ 1–4] ตำแหน่งของ CONTINUED — ต้องอยู่ "ในระยะขอบ" เท่านั้น ──
// paginate() ไม่จองบรรทัดให้สองตัวนี้ ถ้ามันไปยืนในสายเนื้อหน้าเมื่อไหร่
// เนื้อหน้าจะเกินความจุแล้วกระดาษยืด = เรนเดอร์ไม่เท่ากัน + ล้นขอบ
{
  const F = (over = {}) => ({ paper: { width: 8.5, height: 11 },
    margins: { top: 1, bottom: 1, left: 1.5, right: 1 }, lineHeight: 1, ...over });
  const b = SV.continuedBox(F());
  check('[87] CONTINUED ชิดแนวขอบซ้ายของพื้นที่พิมพ์ (x = mgL เหมือน pdf-generator)',
    b.left === 1.5, JSON.stringify(b));
  check('[87] กว้างเท่าพื้นที่พิมพ์ (ตัวขวาจึงชิดขอบขวาพอดี)', b.width === 6, b.width);
  check('[87] ตัวบนอยู่ "หนึ่งบรรทัดเหนือเนื้อหน้า" = baseline(-1) ของ PDF',
    Math.abs(b.topIn - (1 - 1 / 6)) < 1e-4, b.topIn);
  check('[87] ตัวล่างอยู่ "หนึ่งบรรทัดใต้เนื้อหน้า" = baseline(bodyLines) ของ PDF',
    Math.abs(b.bottomIn - (1 - 1 / 6)) < 1e-4, b.bottomIn);
  check('[87] ยังอยู่ในระยะขอบ ไม่ล้ำเข้าพื้นที่พิมพ์',
    b.topIn >= 0 && b.topIn < 1 && b.bottomIn >= 0 && b.bottomIn < 1);

  // ผู้ใช้ตั้งช่วงบรรทัดกว้างขึ้น → บรรทัดสูงขึ้น → ต้องถอยห่างขอบมากขึ้นตาม
  const b15 = SV.continuedBox(F({ lineHeight: 1.5 }));
  check('[87] ช่วงบรรทัด 1.5 → หนึ่งบรรทัด = 0.25in และตำแหน่งขยับตาม',
    Math.abs(b15.lineIn - 0.25) < 1e-6 && Math.abs(b15.topIn - 0.75) < 1e-4,
    b15.lineIn + ' / ' + b15.topIn);
  check('[87] ช่วงบรรทัดกว้างขึ้นแล้วต้องไม่หลุดออกนอกกระดาษ', b15.topIn >= 0);

  // ระยะขอบแคบกว่าหนึ่งบรรทัด — ห้ามได้ค่าติดลบ (จะหลุดออกนอกแผ่น)
  const bTight = SV.continuedBox(F({ margins: { top: 0.1, bottom: 0.1, left: 1.5, right: 1 } }));
  check('[87] ระยะขอบแคบกว่าหนึ่งบรรทัด → หนีบที่ 0 ไม่ติดลบ',
    bTight.topIn === 0 && bTight.bottomIn === 0, JSON.stringify(bTight));

  // ระยะขอบซ้ายที่ผู้ใช้ตั้งเองต้องถูกเคารพ (ข้อ 3 ของผู้ใช้: โหมดจัดหน้าเคยวาดชิดขอบกระดาษ)
  const bWide = SV.continuedBox(F({ margins: { top: 1, bottom: 1, left: 2, right: 1.25 } }));
  check('[87] เปลี่ยนระยะขอบซ้าย/ขวา แล้วกล่องขยับตามจริง',
    bWide.left === 2 && Math.abs(bWide.width - 5.25) < 1e-4,
    bWide.left + ' / ' + bWide.width);
}

// ═══ [alpha.87 ข้อ B] ★ "บล็อกว่าง = บรรทัดว่าง" ต้องเป็นจริงกับ **ทุกชนิด** ═══
// อาการที่ผู้ใช้เจอ: กด Enter ค้างในบล็อกตัวละคร → หน้าสั้นผิดปกติ (ใช้กระดาษแค่ครึ่งแผ่น)
// ต้นตอ: `blocksFromDoc` เขียนว่า `el === 'action' && !text.trim()` → ตัวละคร/หัวฉากว่าง
// ยังถูกนับเป็นบล็อกจริง = linesBefore + 1 บรรทัด ขณะที่ CSS ตัดระยะเว้นของบล็อกว่างทุกชนิดทิ้ง
// → จอนับ 1 บรรทัด โมเดลนับ 2 · โมเดลจึงคิดว่าหน้าเต็มทั้งที่จอเพิ่งใช้ไปครึ่งแผ่น
{
  const fakeDoc = (els) => ({ forEach(cb) {
    let off = 0;
    for (const [el, text] of els) {
      cb({ type: { name: 'sp' }, attrs: { el }, textContent: text }, off);
      off += (text.length || 0) + 2;
    }
  } });
  for (const el of ['character', 'scene', 'transition', 'dialogue', 'parenthetical', 'action']) {
    const b = SV.blocksFromDoc(fakeDoc([[el, '']]))[0];
    check('[87-B] ★ ' + el + ' ที่ยังไม่พิมพ์ข้อความ = บรรทัดว่าง', b.el === 'blank', b.el);
  }
  // มีข้อความแล้วต้องเป็นชนิดของตัวเอง
  const filled = SV.blocksFromDoc(fakeDoc([['character', 'โทระ'], ['scene', 'INT. บ้าน - เย็น']]));
  check('[87-B] มีข้อความแล้วยังเป็นชนิดเดิม',
    filled[0].el === 'character' && filled[1].el === 'scene',
    filled.map((x) => x.el).join(','));
  // `page-break` เป็น *คำสั่ง* ที่ไม่มีข้อความอยู่แล้ว — ห้ามกลายเป็นบรรทัดว่าง
  const pb = SV.blocksFromDoc(fakeDoc([['page-break', '']]))[0];
  check('[87-B] ขึ้นหน้าใหม่ยังเป็นคำสั่ง ไม่ใช่บรรทัดว่าง', pb.el === 'page-break', pb.el);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
