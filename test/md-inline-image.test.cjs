// test/md-inline-image.test.cjs — [alpha.164 · IMG-IN-A] รูปกลางย่อหน้า `abc ![](x.png) def`
//
// สัญญาที่ผูกไว้ (docs/inline-image-plan.md รอบ A):
//   · รูปทั้งบรรทัดยังเป็น `figure` ระดับบล็อกเหมือนเดิม
//   · รูปกลางบรรทัด = โหนด inline `image` (src/alt/h/md) · ห้อมด้วยตัวหนา/สีได้
//   · ★ ไฟล์เก่าไป-กลับผ่านตัวแก้ไขแล้ว **ไม่เปลี่ยนสักไบต์** (เขียนข้อความดิบกลับทั้งดุ้นเมื่อค่าไม่เปลี่ยน)
//   · ตัวที่กินแต่ข้อความ (inlinePlainText · inlineDisplayText · countWords) ได้ผลเท่าเดิม
//   · บทภาพยนตร์ไม่มีโหนดนี้ → เปิดได้ไม่พัง และคืนเป็นข้อความดิบ
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

// schema ต้องมาจากบันเดิลก้อนเดียวกับ editor.js (บทเรียน .134 — prosemirror-model สองชุด)
const tmp = path.join(os.tmpdir(), 'k2-md-inline-image.cjs');
esbuild.buildSync({
  stdin: {
    contents: "export * from './src/editor.js';"
      + "export * as MDX from './src/md.js';"
    + "export { mdToHtmlBody } from './src/compile.js';"
    + "export { proseBlocksFromDoc, mdToProseBlocks, proseExportCss } from './src/prose-format.js';",
    resolveDir: path.join(__dirname, '..'), loader: 'js',
  },
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const ED = require(tmp);
const MD = ED.MDX;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

/** md → doc ของ schema ตัวแก้ไขจริง → md (ทางเดียวกับเปิดไฟล์แล้วบันทึก) */
const roundTrip = (md) => MD.docToMd(ED.schema.nodeFromJSON(MD.mdToDoc(md)).toJSON());
const paraContent = (md) => (MD.mdToDoc(md).content[0].content || []);

// ── 1. รูปทั้งบรรทัดยังเป็น figure ──
{
  const d = MD.mdToDoc('![รูป](../Images/a.png)');
  check('รูปทั้งบรรทัด = figure (เหมือนเดิม)', d.content[0].type === 'figure', d.content[0].type);
  const d2 = MD.mdToDoc('![รูป](a.png "fit=page")  ');
  check('รูปทั้งบรรทัด + วรรคท้าย = figure', d2.content[0].type === 'figure');
}

// ── 2. รูปกลางบรรทัด = โหนด inline ──
{
  const c = paraContent('abc ![รูป](x.png) def');
  check('กลางบรรทัด: ได้ 3 โหนด text/image/text', c.length === 3
    && c[0].type === 'text' && c[1].type === 'image' && c[2].type === 'text', JSON.stringify(c));
  check('แอตทริบิวต์ src/alt/h', c[1].attrs.src === 'x.png' && c[1].attrs.alt === 'รูป' && c[1].attrs.h === 1,
    JSON.stringify(c[1].attrs));
  check('md = ข้อความดิบ', c[1].attrs.md === '![รูป](x.png)');
  const c2 = paraContent('ก ![a](x.png "h=2") ข');
  check('h=2 จากชื่อกำกับ', c2[1].attrs.h === 2 && c2[1].attrs.src === 'x.png', JSON.stringify(c2[1].attrs));
  check('h ถูกหนีบ 1–3', paraContent('ก ![a](x.png "h=9") ข')[1].attrs.h === 3
    && paraContent('ก ![a](x.png "h=0") ข')[1].attrs.h === 1);
  const c3 = paraContent('ก ![a](my pic.png) ข');
  check('ชื่อไฟล์มีวรรค (กติกาเดียวกับรูปบล็อก)', c3[1] && c3[1].type === 'image' && c3[1].attrs.src === 'my pic.png',
    JSON.stringify(c3));
  const c4 = paraContent('![a](x.png) ![b](y.png)');
  check('สองรูปในบรรทัดเดียว = รูปในบรรทัดสองใบ', c4.filter((n) => n.type === 'image').length === 2,
    JSON.stringify(c4));
  const b = paraContent('**หนา ![a](x.png) ต่อ**');
  check('รูปในตัวหนาได้มาร์ก strong', b[1].type === 'image' && (b[1].marks || []).some((m) => m.type === 'strong'),
    JSON.stringify(b));
  const u = paraContent('ดู ![a](_x_.png) นะ');
  check('`_` ในชื่อไฟล์ไม่ถูกอ่านเป็นขีดเส้นใต้', u[1] && u[1].type === 'image' && u[1].attrs.src === '_x_.png',
    JSON.stringify(u));
  const e = paraContent('ไม่ใช่รูป ![a]() และ ![b](x.png');
  check('ไวยากรณ์ไม่ครบ = ข้อความ', e.every((n) => n.type === 'text'), JSON.stringify(e));
  const li = MD.mdToDoc('- ข้อ ![a](x.png) หนึ่ง').content[0];
  check('ในรายการ', li.type === 'bullet_list'
    && li.content[0].content[0].content.some((n) => n.type === 'image'));
}

// ── 3. ★ ไฟล์เก่าไป-กลับไม่เปลี่ยนสักไบต์ ──
const SAMPLES = [
  'abc ![a](x.png) def',
  'ก ![รูป](../Images/ภาพ 1.png) ข',
  '![a](x.png) ![b](y.png)',
  '**abc ![a](x.png) def**',
  '*เอียง ![a](x.png)* ปกติ',
  '<span style="color:#b03030">แดง ![a](x.png) แดง</span> ต่อ',
  'ดู ![a](_x_.png) นะ',
  'ดู ![a](x.png "h=2 fit=page w=40%") นะ',
  'ดู ![a](x.png  "h=2") วรรคสองตัว',
  '- ข้อ ![a](x.png) หนึ่ง\n- ข้อสอง',
  '1. ข้อ ![a](x.png)\n2. สอง',
  '> ยกมา ![a](x.png) ต่อ',
  '# หัวข้อ ![a](x.png)',
  'บรรทัด ![a](x.png)\\\nต่อ ![b](y.png) ท้าย',
  'ไม่ใช่รูป ![a]() และ ![b](x.png',
  '![รูป](a.png)\n\nย่อหน้า ![b](b.png) ต่อ\n\n![c](c.png "fit=page")',
];
for (const s of SAMPLES) {
  const out = roundTrip(s);
  check('ไป-กลับไม่เปลี่ยน: ' + JSON.stringify(s), out === s, JSON.stringify(out));
}

// ── 4. แก้ความสูง → เขียนใหม่ · ค่าเดิม → ข้อความดิบเดิม ──
{
  check('inlineImgMd: ค่าตรง md = คืน md เดิม',
    MD.inlineImgMd({ src: 'x.png', alt: 'a', h: 1, md: '![a](x.png   )' }) === '![a](x.png   )');
  check('inlineImgMd: เปลี่ยน h = ประกอบใหม่',
    MD.inlineImgMd({ src: 'x.png', alt: 'a', h: 3, md: '![a](x.png)' }) === '![a](x.png "h=3")');
  check('inlineImgMd: h=1 ไม่มีชื่อกำกับ',
    MD.inlineImgMd({ src: 'x.png', alt: 'a', h: 1, md: '' }) === '![a](x.png)');
  check('inlineImgMd: เปลี่ยน src = ประกอบใหม่',
    MD.inlineImgMd({ src: 'y.png', alt: 'a', h: 2, md: '![a](x.png "h=2")' }) === '![a](y.png "h=2")');
  const doc = ED.schema.nodeFromJSON(MD.mdToDoc('ก ![a](x.png) ข')).toJSON();
  doc.content[0].content[1].attrs.h = 2;
  check('โหนดที่ถูกปรับ h เขียนลงไฟล์ถูก', MD.docToMd(doc) === 'ก ![a](x.png "h=2") ข', MD.docToMd(doc));
  const back = MD.mdToDoc(MD.docToMd(doc)).content[0].content[1];
  check('อ่านกลับได้ h=2', back.type === 'image' && back.attrs.h === 2);
}

// ── 5. ตัวที่กินแต่ข้อความได้ผลเท่าเดิม ──
{
  check('inlinePlainText ถอดเหลือคำบรรยาย', MD.inlinePlainText('ก ![รูป](x.png) ข') === 'ก รูป ข',
    MD.inlinePlainText('ก ![รูป](x.png) ข'));
  check('[IMG-IN-B] inlineDisplayText ไม่โชว์ไวยากรณ์รูป (ตรงกับ textContent ของเอกสาร)',
    MD.inlineDisplayText('ก ![รูป](x.png) ข') === 'ก  ข', MD.inlineDisplayText('ก ![รูป](x.png) ข'));
  const h = MD.inlineHtml('ดู ![a](_x_.png) นะ');
  check('inlineHtml: รูปที่มี `_` ในชื่อไฟล์ออกเป็น <img> ครบ (เดิมหักกลาง)',
    h.includes('src="_x_.png"') && !h.includes('<u>'), h);
  const h2 = MD.inlineHtml('ก ![a" onerror="x](y.png) ข');
  check('inlineHtml: ยัง escape เครื่องหมายคำพูด (H6)', !/onerror="/.test(h2), h2);
}

// ── 6. schema ตัวแก้ไข ──
{
  const node = ED.schema.nodeFromJSON(MD.mdToDoc('ก ![a](x.png "h=2") ข'));
  const img = node.firstChild.child(1);
  check('schema มีโหนด image แบบ inline atom', img.type.name === 'image' && img.isInline && img.isAtom);
  check('textContent ของย่อหน้าไม่รวมรูป', node.firstChild.textContent === 'ก  ข', node.firstChild.textContent);
  const dom = ED.schema.nodes.image.spec.toDOM(img);
  check('toDOM: img.k-inline-img + --k-img-h', dom[0] === 'img' && dom[1].class === 'k-inline-img'
    && dom[1].style === '--k-img-h:2' && dom[1]['data-src'] === 'x.png', JSON.stringify(dom));
  check('toDOM: ไม่ให้ลาก (ลากเลือกข้อความข้ามรูปได้)', dom[1].draggable === 'false');
}

// ── 7. บทภาพยนตร์ไม่มีโหนด image → inlineImagesAsText คืนข้อความดิบ (มาร์กติดไปด้วย) ──
// (ทางเต็มของบท — spDocFromMarkdown → spDocToMarkdown — อยู่ที่ screenplay-marks.test.cjs ซึ่งใช้ jsdom)
{
  const c = MD.inlineImagesAsText(paraContent('**เดิน ![a](x.png "h=2") นั่ง**'));
  check('บท: ไม่มีโหนด image เหลือ', c.every((n) => n.type === 'text'), JSON.stringify(c));
  check('บท: ข้อความดิบครบ', c.map((n) => n.text).join('') === 'เดิน ![a](x.png "h=2") นั่ง',
    c.map((n) => n.text).join(''));
  check('บท: มาร์กติดไปด้วย', c.every((n) => (n.marks || []).some((m) => m.type === 'strong')));
  const para = { type: 'doc', content: [{ type: 'paragraph', content: c }] };
  check('บท: เขียนกลับได้ข้อความเดิม', MD.docToMd(para) === '**เดิน ![a](x.png "h=2") นั่ง**', MD.docToMd(para));
}

// ── 8. [IMG-IN-B] ตัวแปลงหน้ากระดาษสองตัว + CSS คู่แฝด ──
{
  const html = ED.mdToHtmlBody('ก ![a](../Images/x.png "h=2") ข', { imgSrc: (u) => 'file:///P/' + u.replace(/^\.\.\//, '') });
  check('[IMG-IN-B] ★ ไฟล์ส่งออก: รูปในบรรทัดผ่านตัวแปลงที่อยู่รูป (เดิมไม่ผ่าน = รูปแตกใน PDF)',
    html.includes('src="file:///P/Images/x.png"'), html);
  check('[IMG-IN-B] ไฟล์ส่งออก: คลาส + ความสูงหน่วยบรรทัด (แท็กเดียวกับ toDOM)',
    /<img class="k-inline-img" alt="a" src="[^"]*" style="--k-img-h:2">/.test(html), html);
  check('[IMG-IN-B] ไฟล์ส่งออก: รูปทั้งบรรทัดยังเป็น <figure>',
    /<figure><img alt="b" src="y.png"><\/figure>/.test(ED.mdToHtmlBody('![b](y.png)')));
  const css = ED.proseExportCss({}, { width: 6, height: 9 }, { top: 1, bottom: 1, left: 1, right: 1 });
  check('[IMG-IN-B] ★ CSS ส่งออกมีกฎคู่แฝดของรูปในบรรทัด (1lh × --k-img-h · ชิดล่าง)',
    /img\.k-inline-img\{height:calc\(var\(--k-img-h, 1\) \* 1lh\)[^}]*vertical-align:bottom/.test(css));
  const md = 'ย่อหน้า ![a](x.png) ต่อ\n\n- ข้อ ![b](y.png)\n\n> ยก ![c](z.png) มา';
  const fromMd = ED.mdToProseBlocks(md, { breakMarker: '' }).filter((b) => !(b.type === 'p' && !b.text)).map((b) => b.type + ':' + b.text);
  const fromDoc = ED.proseBlocksFromDoc(ED.schema.nodeFromJSON(MD.mdToDoc(md)))
    .filter((b) => !(b.type === 'p' && !b.text)).map((b) => b.type + ':' + b.text);
  check('[IMG-IN-B] ★ ตัวอย่างสำรอง = ตัวประมาณของตัวแก้ไข (ข้อความเดียวกัน ไม่มี `![`)',
    fromMd.join('|') === fromDoc.join('|') && !fromMd.join('').includes('!['),
    fromMd.join('|') + '  ||  ' + fromDoc.join('|'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
