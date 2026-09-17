// test/export-ebook.test.cjs — [alpha.156] ส่งออก EPUB 3 + DOCX (ตัวประกอบแพ็กเกจ · บริสุทธิ์)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const JSZip = require('jszip');

const tmp = path.join(os.tmpdir(), 'k2-export-ebook-test.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'export-ebook.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const E = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + String(extra).slice(0, 300) : '')); }
}

/** ตรวจ XML ว่า "ปิดแท็กครบ · ไม่มี & ลอย" (พอจับบั๊กจริงที่ทำให้โปรแกรมอ่านอีบุ๊ก/Word เปิดไม่ขึ้น) */
function wellFormed(xml) {
  const s = String(xml).replace(/<\?xml[^>]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(s)) return 'bare &';
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  let m, last = 0;
  while ((m = re.exec(s))) {
    if (/[<>]/.test(s.slice(last, m.index))) return 'stray < or > near ' + s.slice(last, m.index).slice(0, 60);
    last = re.lastIndex;
    if (m[4]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) return 'mismatch </' + m[2] + '>'; }
    else stack.push(m[2]);
  }
  if (/[<>]/.test(s.slice(last))) return 'stray tail';
  return stack.length ? 'unclosed ' + stack.join(',') : '';
}

// รูป PNG 1×1 จริง + JPEG หัวไฟล์ขั้นต่ำ (ขนาด 40×20)
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const JPG = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x14, 0x00, 0x28, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

const MD = [
  '## บทที่ 1 เริ่มต้น', '',
  'ย่อหน้าแรก **หนา** และ _ขีดเส้นใต้_ กับ *เอียง* & สัญลักษณ์ <แท็ก> "คำพูด"', '',
  '<!--align:center-->กลางหน้า', '',
  '- ข้อหนึ่ง', '- ข้อสอง', '',
  '3. สาม', '4. สี่', '',
  '> คำพูดยกมา', '',
  '![ภาพปก](../Images/cover.png)', '',
  'บรรทัดหนึ่ง\\', 'บรรทัดสอง (hard break)', '',
  'มีรูปกลางย่อหน้า ![จุด](../Images/dot.jpg) ต่อท้าย', '',
  '---', '',
  '<!--pagebreak-->',
  '## บทที่ 2', '',
  '```', 'code <x> & y', '```', '',
  'ตัวควบคุมหลุดมา',
].join('\n');

(async () => {
  // ── ตัวช่วย ──
  check('imageSize PNG', JSON.stringify(E.imageSize(PNG)) === JSON.stringify({ w: 1, h: 1, type: 'png' }), JSON.stringify(E.imageSize(PNG)));
  check('imageSize JPEG', JSON.stringify(E.imageSize(JPG)) === JSON.stringify({ w: 40, h: 20, type: 'jpeg' }), JSON.stringify(E.imageSize(JPG)));
  check('imageSize ไฟล์เสีย = null', E.imageSize(new Uint8Array([1, 2, 3])) === null);
  const srcs = E.collectImageSrcs(MD);
  check('collectImageSrcs เจอรูปทั้งบรรทัดและกลางย่อหน้า',
    srcs.includes('../Images/cover.png') && srcs.includes('../Images/dot.jpg') && srcs.length === 2, srcs.join(','));
  check('xmlEsc กันอักขระควบคุม + เครื่องหมายคำพูด', E.xmlEsc('a"&') === 'a&quot;&amp;');

  // ── EPUB ──
  const images = new Map([['../Images/cover.png', PNG], ['../Images/dot.jpg', JPG]]);
  const ep = E.buildEpub(MD, { title: 'เรื่อง & ทดสอบ', author: 'ผู้เขียน', language: 'th',
    identifier: 'urn:uuid:11111111-2222-4333-8444-555555555555', modified: '2026-09-14T10:00:00.000Z', images });
  check('EPUB: ไฟล์แรกคือ mimetype แบบไม่บีบอัด', ep.files[0].path === 'mimetype' && ep.files[0].store && ep.files[0].data === 'application/epub+zip');
  const byPath = Object.fromEntries(ep.files.map((f) => [f.path, f.data]));
  check('EPUB: มี container.xml + content.opf + nav', !!byPath['META-INF/container.xml'] && !!byPath['OEBPS/content.opf'] && !!byPath['OEBPS/nav.xhtml']);
  check('EPUB: แยกสองส่วนที่หัวข้อ ##', ep.sections === 2, ep.sections);
  check('EPUB: ฝังรูปครบสองรูป', ep.images === 2 && !!byPath['OEBPS/images/img1.png'] && !!byPath['OEBPS/images/img2.jpeg'], Object.keys(byPath).join(','));
  for (const f of ep.files) {
    if (typeof f.data !== 'string' || !/\.(xhtml|opf|ncx|xml)$/.test(f.path)) continue;
    const err = wellFormed(f.data);
    check('EPUB: XML ถูกรูป ' + f.path, !err, err);
  }
  const s1 = byPath['OEBPS/text/s001.xhtml'];
  check('EPUB: ตัวหนา/ขีดเส้นใต้/เอียง', /<strong>หนา<\/strong>/.test(s1) && /<u>ขีดเส้นใต้<\/u>/.test(s1) && /<em>เอียง<\/em>/.test(s1), s1);
  check('EPUB: escape & < > " ในเนื้อ', s1.includes('&amp; สัญลักษณ์ &lt;แท็ก&gt; &quot;คำพูด&quot;'));
  check('EPUB: จัดกึ่งกลางติดไปด้วย', /<p style="text-align:center">กลางหน้า<\/p>/.test(s1));
  check('EPUB: รายการ ul + ol ที่เริ่มที่ 3', /<ul><li>ข้อหนึ่ง<\/li><li>ข้อสอง<\/li><\/ul>/.test(s1) && /<ol start="3">/.test(s1), s1);
  check('EPUB: hard break เป็น <br/>', s1.includes('บรรทัดหนึ่ง<br/>บรรทัดสอง'));
  check('EPUB: รูปทั้งบรรทัดชี้ไฟล์ในแพ็กเกจ', s1.includes('src="../images/img1.png"'));
  check('EPUB: รูปกลางย่อหน้าชี้ไฟล์ในแพ็กเกจ', s1.includes('src="../images/img2.jpeg"'));
  const s2 = byPath['OEBPS/text/s002.xhtml'];
  check('EPUB: โค้ดถูก escape', s2.includes('<pre><code>code &lt;x&gt; &amp; y</code></pre>'), s2);
  check('EPUB: อักขระควบคุมถูกตัดทิ้ง', !//.test(s2));
  check('EPUB: สารบัญมีสองบท', (byPath['OEBPS/nav.xhtml'].match(/<li>/g) || []).length === 2);
  check('EPUB: metadata ชื่อ/ผู้แต่ง/ภาษา/modified', /<dc:title>เรื่อง &amp; ทดสอบ<\/dc:title>/.test(byPath['OEBPS/content.opf'])
    && /<dc:creator>ผู้เขียน<\/dc:creator>/.test(byPath['OEBPS/content.opf'])
    && /dcterms:modified">2026-09-14T10:00:00Z</.test(byPath['OEBPS/content.opf']));
  check('EPUB: spine มีหน้าชื่อเรื่อง + สองบท', (byPath['OEBPS/content.opf'].match(/<itemref /g) || []).length === 3);
  // รูปที่ไม่มีไบต์ → เหลือคำบรรยาย ไม่มีลิงก์เสีย
  const epNoImg = E.buildEpub(MD, { title: 'x' });
  const t0 = epNoImg.files.find((f) => f.path === 'OEBPS/text/s001.xhtml').data;
  check('EPUB: ไม่มีไบต์รูป = ไม่มี <img> ลิงก์เสีย', !/<img/.test(t0) && t0.includes('ภาพปก'), t0);
  // อัดซิปจริง
  {
    const zip = new JSZip();
    for (const f of ep.files) zip.file(f.path, f.data, f.store ? { compression: 'STORE' } : {});
    const buf = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const back = await JSZip.loadAsync(buf);
    check('EPUB: ซิปอ่านกลับได้ และ mimetype เป็นรายการแรก', Object.keys(back.files)[0] === 'mimetype');
    check('EPUB: ไบต์ mimetype อยู่ offset 38 ตรงตามสเปก', Buffer.from(buf.slice(30, 38)).toString() === 'mimetype'
      && Buffer.from(buf.slice(38, 58)).toString() === 'application/epub+zip');
  }
  const epEmpty = E.buildEpub('', { title: 'ว่าง' });
  check('EPUB: เนื้อว่างก็ยังได้แพ็กเกจที่ถูกต้อง', epEmpty.files.some((f) => f.path === 'OEBPS/text/s001.xhtml')
    && !wellFormed(epEmpty.files.find((f) => f.path === 'OEBPS/content.opf').data));

  // ── DOCX ──
  const dx = E.buildDocx(MD, { title: 'เรื่อง', author: 'ผู้เขียน', font: 'TH Sarabun New', fontPt: 16,
    paper: { width: 8.5, height: 11 }, margins: { top: 1, right: 1, bottom: 1, left: 1.5 }, images });
  const dp = Object.fromEntries(dx.files.map((f) => [f.path, f.data]));
  for (const p of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml']) {
    check('DOCX: มี ' + p, typeof dp[p] === 'string');
    const err = wellFormed(dp[p] || '');
    check('DOCX: XML ถูกรูป ' + p, !err, err);
  }
  const doc = dp['word/document.xml'];
  check('DOCX: ตัวหนามีทั้ง b และ bCs (อักษรไทย)', /<w:b\/><w:bCs\/>[\s\S]*?หนา/.test(doc));
  check('DOCX: ขีดเส้นใต้', /<w:u w:val="single"\/>[^]*?ขีดเส้นใต้/.test(doc));
  check('DOCX: จัดกึ่งกลาง', /<w:jc w:val="center"\/><\/w:pPr><w:r><w:t xml:space="preserve">กลางหน้า/.test(doc), doc.slice(0, 2000));
  check('DOCX: หัวข้อใช้สไตล์ Heading2', /<w:pStyle w:val="Heading2"\/>/.test(doc));
  check('DOCX: ขึ้นหน้าใหม่', doc.includes('<w:br w:type="page"/>'));
  check('DOCX: hard break', doc.includes('<w:r><w:br/></w:r>'));
  check('DOCX: รายการเลขเริ่มที่ 3', /<w:startOverride w:val="3"\/>/.test(dp['word/numbering.xml']));
  check('DOCX: รายการจุดกับรายการเลขใช้ numId ต่างกัน', /<w:numId w:val="1"\/>/.test(doc) && /<w:numId w:val="2"\/>/.test(doc));
  check('DOCX: ขนาดกระดาษ Letter + ขอบซ้าย 1.5 นิ้ว', doc.includes('w:w="12240" w:h="15840"') && doc.includes('w:left="2160"'));
  check('DOCX: ฟอนต์ไทยตั้งทั้ง ascii และ cs', /w:cs="TH Sarabun New"/.test(dp['word/styles.xml']) && /<w:sz w:val="32"\/>/.test(dp['word/styles.xml']));
  check('DOCX: ฝังรูปสองรูป + ความสัมพันธ์ครบ', dx.images === 2 && !!dp['word/media/image1.png'] && !!dp['word/media/image2.jpeg']
    && /Target="media\/image1.png"/.test(dp['word/_rels/document.xml.rels']));
  check('DOCX: content type ของรูป', /Extension="png"/.test(dp['[Content_Types].xml']) && /Extension="jpeg"/.test(dp['[Content_Types].xml']));
  check('DOCX: รูปกว้างไม่เกินพื้นที่เนื้อหา', (() => {
    const cx = Math.max(...[...doc.matchAll(/<wp:extent cx="(\d+)"/g)].map((m) => +m[1]));
    return cx <= Math.round((8.5 - 2.5) * 914400);
  })());
  check('DOCX: โค้ดถูก escape', doc.includes('code &lt;x&gt; &amp; y'));
  const dxNoImg = E.buildDocx(MD, { title: 'x' });
  check('DOCX: ไม่มีไบต์รูป = ใช้คำบรรยายแทน ไม่มี r:embed เสีย', !/r:embed/.test(dxNoImg.files.find((f) => f.path === 'word/document.xml').data));
  {
    const zip = new JSZip();
    for (const f of dx.files) zip.file(f.path, f.data);
    const back = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
    check('DOCX: ซิปอ่านกลับได้', !!back.file('word/document.xml'));
  }

  console.log(`\nexport-ebook: ${pass} ผ่าน · ${fail} ไม่ผ่าน`);
  if (fail) process.exit(1);
})();
