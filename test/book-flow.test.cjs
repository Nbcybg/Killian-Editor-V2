// test/book-flow.test.cjs — [alpha.141] สายหน้าของทั้งเล่ม (ลำดับส่วน · ปกนับเป็นหน้า · ไล่เลขต่อเนื่อง)
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
require('./_lang.cjs').installLang('th');
const tmp = (f) => path.join(os.tmpdir(), f);
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/book-flow.js')],
                    outfile: tmp('_bookflow.cjs'), format: 'cjs', bundle: true, logLevel: 'silent' });
const B = require(tmp('_bookflow.cjs'));

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ───────── ค่าหน้าปก ─────────
check('บทที่ไม่เคยตั้งปก = ปิด', B.normChapterCover({}).on === false);
check('บทที่ไม่เคยตั้งปก คืนสตริงว่าง ไม่ใช่ undefined',
      B.normChapterCover({}).image === '' && B.normChapterCover({}).text === '');
check('ติ๊กใช้ปกบท', B.normChapterCover({ cover: { on: true, image: 'Images/a.png' } }).on === true);
check('ปกบทเป็นข้อความล้วนก็ได้',
      B.normChapterCover({ cover: { on: true, text: 'บทที่หนึ่ง' } }).text === 'บทที่หนึ่ง');
check('เล่มมีหน้าปกเป็นค่าเริ่มต้น', B.normBookCover({}).on === true);
check('สั่งปิดหน้าปกเล่มได้', B.normBookCover({ coverOn: false }).on === false);
check('หน้าปกเล่มใช้รูปจาก section.json → cover',
      B.normBookCover({ cover: '../Images/ปก.png' }).image === '../Images/ปก.png');

// ───────── ลำดับส่วนของหนึ่งเล่ม ─────────
const book = {
  key: 'b1', title: 'เล่มหนึ่ง', author: 'ท็อป', meta: { cover: '../Images/ปก.png' },
  chapters: [
    { guid: 'c1', title: 'บทที่ 1', cover: { on: true, image: 'Images/c1.png' },
      scenes: [{ id: 's1', file: 'f1.md', title: 'ฉาก 1', body: 'ก' },
               { id: 's2', file: 'f2.md', title: 'ฉาก 2', body: 'ข' }] },
    { guid: 'c2', title: 'บทที่ 2',
      scenes: [{ id: 's3', file: 'f3.md', title: 'ฉาก 3', body: 'ค' },
               { id: 'm1', file: 'm1.md', title: 'บันทึก', body: 'ง', type: 'memo' }] },
  ],
};
const parts = B.bookParts(book);
check('ส่วนแรกคือหน้าปกเล่ม', parts[0].kind === 'bookCover', parts[0] && parts[0].kind);
check('หน้าปกเล่มพาชื่อเรื่อง+ผู้เขียนไปด้วย',
      parts[0].title === 'เล่มหนึ่ง' && parts[0].subtitle === 'ท็อป');
check('บทที่ติ๊กปก ได้ส่วน chapterCover', parts[1].kind === 'chapterCover');
check('บทที่ไม่ติ๊กปก ยังได้หัวบท (ขึ้นหน้าใหม่)',
      parts.find((p) => p.guid === 'c2').kind === 'chapterHead');
check('บันทึกช่วยจำไม่ถูกนับเป็นเนื้อเรื่อง', !parts.some((p) => p.id === 'm1'));
check('จำนวนส่วนทั้งหมด = ปกเล่ม + ปกบท + 2 ฉาก + หัวบท + 1 ฉาก', parts.length === 6, parts.length);
check('ฉากพา file ไปด้วย (ตัวเชื่อมกับแท็บที่เปิดอยู่)',
      parts.filter((p) => p.kind === 'scene').map((p) => p.file).join(',') === 'f1.md,f2.md,f3.md');
check('สั่งไม่เอาปก = ไม่มีทั้งปกเล่มและปกบท',
      !B.bookParts(book, { covers: false }).some((p) => B.isCoverPart(p)));
check('สั่งไม่เอาปก แต่หัวบทยังอยู่ (บทต้องขึ้นหน้าใหม่เสมอ)',
      B.bookParts(book, { covers: false }).filter((p) => p.kind === 'chapterHead').length === 2);

// ───────── หลายเล่มต่อกัน ─────────
{
  const all = B.projectParts([book, { key: 'b2', title: 'เล่มสอง', meta: {}, chapters: [] }]);
  check('ทั้งโปรเจกต์ = ทุกเล่มต่อกันตามลำดับ', all.length === parts.length + 1);
  check('เล่มที่สองเริ่มด้วยหน้าปกของตัวเอง',
        all[all.length - 1].kind === 'bookCover' && all[all.length - 1].book === 'b2');
}

// ───────── ไล่เลขหน้า — ปกบทนับ · ปกเล่มไม่นับ ─────────
// [alpha.142 ข้อ 2] ผู้ใช้: "ปกเล่มต้องไม่ถูกนับเป็นหน้า ถ้ามีปกบท หน้าที่ 1 จะนับจากปกบท"
{
  const pagesOf = { 'f1.md': 3, 'f2.md': 2, 'f3.md': 4 };
  const withNo = B.assignStartPages(parts, (p) => pagesOf[p.file] || 1);
  const at = (k) => withNo.find((p) => p.file === k || p.guid === k || p.kind === k);
  check('หน้าปกเล่มกินแผ่นจริง (แผ่นที่ 1)', withNo[0].page === 1, withNo[0].page);
  check('★ หน้าปกเล่ม **ไม่มีเลขหน้า**', withNo[0].startPage === 0, withNo[0].startPage);
  check('★ หน้าปกบทเป็นหน้า 1 (นับจากปกบท ไม่ใช่ปกเล่ม)',
        withNo[1].startPage === 1 && withNo[1].page === 2,
        JSON.stringify([withNo[1].startPage, withNo[1].page]));
  check('ฉากแรกเริ่มหน้า 2 (ถัดจากปกบท)', at('f1.md').startPage === 2, at('f1.md').startPage);
  check('ฉากสองไล่ต่อจากฉากแรก (2+3)', at('f2.md').startPage === 5, at('f2.md').startPage);
  check('หัวบทที่ 2 ขึ้นหน้าใหม่ (5+2)', withNo[4].startPage === 7, withNo[4].startPage);
  check('★ ฉากแรกของบทอยู่หน้าเดียวกับหัวบท (หัวบทไม่ได้กินทั้งหน้า)',
        at('f3.md').startPage === 7, at('f3.md').startPage);
  check('แผ่นจริงยังนับปกเล่มด้วย (โหมดอ่านต้องเปิดไปถึงได้)', at('f3.md').page === 8, at('f3.md').page);
  check('หน้าปกกินหนึ่งแผ่นเสมอ ไม่ว่าใครจะบอกว่าเท่าไร',
        B.assignStartPages(parts, () => 99)[1].pages === 1);
  check('เริ่มเลขหน้าที่ค่าอื่นได้ (นับจากหน้าแรกของเนื้อเล่ม)',
        B.assignStartPages(parts, () => 1, 10)[1].startPage === 10);
  const map = B.startPageMap(withNo);
  check('ตารางไฟล์→เลขหน้า', map.get('f2.md') === 5 && map.get('f3.md') === 7,
        JSON.stringify([map.get('f2.md'), map.get('f3.md')]));
  check('ตารางไม่เก็บหน้าปก (ไม่มีไฟล์)', map.size === 3);
  check('coverPagesOf บอกแผ่นที่เป็นปกเล่ม', JSON.stringify(B.coverPagesOf(withNo)) === '[1]',
        JSON.stringify(B.coverPagesOf(withNo)));
  // ไม่มีปกเล่ม → หน้า 1 เริ่มที่ฉากเลย (อีกครึ่งของคำสั่งผู้ใช้)
  {
    const noCover = B.bookParts({ ...book, meta: { coverOn: false } });
    const w2 = B.assignStartPages(noCover, (p) => pagesOf[p.file] || 1);
    check('★ ปิดปกเล่ม + ไม่มีปกบท → ฉากแรกคือหน้า 1',
          B.assignStartPages(B.bookParts({ ...book, meta: { coverOn: false },
            chapters: book.chapters.map((c) => ({ ...c, cover: null })) }),
            (p) => pagesOf[p.file] || 1).find((p) => p.file === 'f1.md').startPage === 1);
    check('ปิดปกเล่ม → ปกบทยังเป็นหน้า 1', w2[0].startPage === 1 && w2[0].kind === 'chapterCover');
  }
}

// ───────── เลขที่พิมพ์จากแผ่นจริง (ทางที่โหมดอ่านใช้หลังวัดเสร็จ) ─────────
{
  check('แผ่นที่เป็นปกเล่ม = ไม่มีเลข', B.printedPageNumber([1], 1) === 0);
  check('แผ่นถัดจากปก = หน้า 1', B.printedPageNumber([1], 2) === 1);
  check('แผ่นที่ 10 เมื่อมีปกเล่มหนึ่งใบ = หน้า 9', B.printedPageNumber([1], 10) === 9);
  check('หลายเล่มต่อกัน — ปกสองใบ', B.printedPageNumber([1, 12], 20) === 18);
  check('แผ่นก่อนปกใบที่สองไม่โดนหัก', B.printedPageNumber([1, 12], 11) === 10);
  check('ไม่มีปกเลย = เลขตรงกับแผ่น', B.printedPageNumber([], 7) === 7);
  check('ค่าเพี้ยนไม่โยน', B.printedPageNumber(null, 0) === 1);
}

// ───────── ปกเต็มหน้า + hint ขนาดรูป ─────────
{
  check('ปกบท: ใช้ภาพเต็มหน้าเป็นค่าเริ่มต้น', B.normChapterCover({ cover: { on: true } }).full === true);
  check('ปกบท: ปิดภาพเต็มหน้าได้', B.normChapterCover({ cover: { on: true, full: false } }).full === false);
  check('ปกเล่ม: ใช้ภาพเต็มหน้าเป็นค่าเริ่มต้น', B.normBookCover({}).full === true);
  check('ปกเล่ม: ปิดภาพเต็มหน้าได้', B.normBookCover({ coverFull: false }).full === false);
  // [alpha.142r] ปกเต็มหน้าชนขอบกระดาษ → ขนาดที่แนะนำต้องเป็น **แผ่นเต็มใบ** ไม่ใช่พื้นที่พิมพ์
  // (บอกพื้นที่พิมพ์ = ผู้ใช้เตรียมรูปเล็กกว่าที่ใช้จริง แล้วโดนขยายจนแตก)
  const h = B.coverImageHint({ width: 6, height: 9 }, { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 });
  check('hint: อ้างขนาดแผ่นกระดาษเต็มใบ (ระยะขอบไม่เกี่ยว)', h.wIn === 6 && h.hIn === 9,
        JSON.stringify([h.wIn, h.hIn]));
  check('hint: พิกเซลที่ 300 dpi', h.wPx === 1800 && h.hPx === 2700, JSON.stringify([h.wPx, h.hPx]));
  check('hint: อัตราส่วน', h.ratio === 0.667, h.ratio);
  check('hint: เปลี่ยน dpi ได้', B.coverImageHint({ width: 6, height: 9 }, null, 150).wPx === 900);
  check('hint: ไม่ส่งอะไรมาก็ไม่พัง', B.coverImageHint().wPx > 0);
  // ★ ธง full ต้อง **เดินทางไปกับส่วนของปก** ไม่งั้นตัววาดไม่มีทางรู้ (บั๊กที่ e2e จับได้รอบนี้)
  {
    const pf = B.bookParts({ key: 'b', title: 'ก', meta: { cover: 'x.png', coverFull: false },
      chapters: [{ guid: 'c', title: 'บท', cover: { on: true, image: 'y.png', full: false }, scenes: [] }] });
    check('bookParts พา full ของปกเล่มไปด้วย', pf[0].full === false, JSON.stringify(pf[0]));
    check('bookParts พา full ของปกบทไปด้วย', pf[1].full === false, JSON.stringify(pf[1]));
    const pt = B.bookParts({ key: 'b', title: 'ก', meta: { cover: 'x.png' },
      chapters: [{ guid: 'c', title: 'บท', cover: { on: true, image: 'y.png' }, scenes: [] }] });
    check('ไม่ได้ตั้ง = เต็มหน้า (ค่าเริ่มต้น)', pt[0].full === true && pt[1].full === true);
  }
}

// ───────── ผลวัดจริง → เลขหน้า ─────────
{
  const pages = [{ start: 0, end: 100 }, { start: 100, end: 200 }, { start: 200, end: 260 }];
  check('y=0 → หน้า 1', B.pageIndexOfY(pages, 0) === 1);
  check('y=99 → หน้า 1', B.pageIndexOfY(pages, 99) === 1);
  check('y=100 → หน้า 2', B.pageIndexOfY(pages, 100) === 2);
  check('y=205 → หน้า 3', B.pageIndexOfY(pages, 205) === 3);
  check('y เกินท้ายเล่ม → หน้าสุดท้าย', B.pageIndexOfY(pages, 9999) === 3);
  check('y ติดลบ → หน้า 1 (ไม่โยน)', B.pageIndexOfY(pages, -5) === 1);
  check('ไม่มีหน้าเลย → 1', B.pageIndexOfY([], 10) === 1);
  // ปัดเศษครึ่งพิกเซล — ผลวัดจริงไม่เคยเป็นจำนวนเต็ม
  check('y=99.7 (เศษจากการวัด) ยังนับเป็นหน้า 2', B.pageIndexOfY(pages, 99.7) === 2);
}

// ───────── ธงของฉาก ─────────
check('ฉากที่สั่งไล่เลขต่อเนื่อง', B.isPageFlowContinue({ pageFlow: 'continue' }) === true);
check('ฉากธรรมดาไม่ไล่ต่อ', B.isPageFlowContinue({}) === false);
check('ไม่มีแถวก็ไม่พัง', B.isPageFlowContinue(null) === false);
check('ปกกับหัวบทบังคับขึ้นหน้าใหม่ ฉากไม่บังคับ',
      B.startsNewPage({ kind: 'chapterHead' }) && B.startsNewPage({ kind: 'bookCover' })
      && !B.startsNewPage({ kind: 'scene' }));

console.log(`\nbook-flow: ${pass} ผ่าน, ${fail} ล้มเหลว`);
console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
