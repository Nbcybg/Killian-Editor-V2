// test/wysiwyg-parity.test.cjs — [alpha.133 · Y] "สามที่ต้องอ่านไฟล์เดียวกันได้ผลเดียวกัน"
//
// ═══ เคสที่ผู้ใช้ส่งมา ═══
// 1. การตัดหน้า   — preview ผิด (layout กับ export ตรงกัน)
// 2. แบบอักษร     — preview กับ export ผิด (มีแค่ editor ที่ถูก)
// 3. การจัดหน้า   — preview กับ export ผิด (มีแค่ layout ที่ถูก)
//
// ═══ ต้นตอ ═══
// ไฟล์ .md ก้อนเดียวถูกอ่านด้วยตัวแปลง **สามตัวที่ไม่รู้จักกัน**:
//   · `mdToDoc()`         → ตัวแก้ไข   (ครบทุกอย่าง)
//   · `mdToHtmlBody()`    → ไฟล์ที่ส่งออก (ไม่รู้จักรั้วโค้ด/hard break/ขึ้นหน้าใหม่/ตัวยก/ตัวห้อย/ขีดเส้นใต้)
//   · `mdToProseBlocks()` → ช่องตัวอย่าง (ไม่รู้จักทั้งหมดข้างบน + ไม่รู้จัก align)
//
// เทสนี้ผูกสัญญาว่าทั้งสามเดินผ่าน `mdBlocks()`/`inlineHtml()` ของ md.js ชุดเดียวกันตลอดไป
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function bundle(file, out) {
  const p = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: p, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(p);
}
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
const C = bundle('compile.js', 'k2-wys-compile.cjs');
const PF = bundle('prose-format.js', 'k2-wys-pf.cjs');
const XV = bundle('prose-export-view.js', 'k2-wys-xv.cjs');
const XF = bundle('export-formats.js', 'k2-wys-xf.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);

// ───────── เอกสารทดสอบ: ครบทุกอย่างที่ผู้ใช้ใช้จริงในภาพที่ส่งมา ─────────
const SRC = [
  '<!--align:center-->ย่อหน้ากลาง',
  'บรรทัดหนึ่ง' + BS,
  'บรรทัดสอง',
  '    เยื้องสี่ช่อง',
  '# **หนา**',
  '## *เอียง*',
  '### _ขีดเส้นใต้_',
  '#### ~~ขีดฆ่า~~',
  'x^2^ กับ H~2~O',
  '<!--pagebreak-->',
  '- ข้อหนึ่ง',
  '3. ข้อสาม',
  '> ยกมาหนึ่ง',
  '> ยกมาสอง',
  '---',
  '![รูป](a.png)',
  '```js',
  'const a = 1;',
  '```',
].join(NL);

// ───────── 1. mdBlocks ต้องจัดชนิดตรงกับ mdToDoc (ตัวแก้ไข) เป๊ะ ─────────
/** แบนเอกสารของตัวแก้ไขให้อยู่ในรูปเดียวกับ mdBlocks (หนึ่งบรรทัด .md = หนึ่งชิ้น) */
function docKinds(doc) {
  const out = [];
  for (const n of doc.content || []) {
    if (n.type === 'heading') out.push('h');
    else if (n.type === 'horizontal_rule') out.push('hr');
    else if (n.type === 'page_break') out.push('pagebreak');
    else if (n.type === 'figure') out.push('figure');
    else if (n.type === 'code_block') out.push('code');
    else if (n.type === 'blockquote') for (const _ of n.content || []) out.push('quote');
    else if (n.type === 'bullet_list' || n.type === 'ordered_list')
      for (const _ of n.content || []) out.push('li');
    else out.push('p');
  }
  return out;
}
{
  const a = MD.mdBlocks(SRC).map((b) => b.kind);
  const b = docKinds(MD.mdToDoc(SRC));
  check('★★ mdBlocks จัดชนิดบรรทัดตรงกับ mdToDoc (ตัวแก้ไข) ทุกบรรทัด',
        a.join(',') === b.join(','), a.join(',') + '  ≠  ' + b.join(','));
}
{
  const blocks = MD.mdBlocks(SRC);
  const byKind = (k) => blocks.filter((x) => x.kind === k);
  check('★ รั้วโค้ดเป็นบล็อกเดียว ไม่ใช่ย่อหน้าที่มีข้อความ ```',
        byKind('code').length === 1 && byKind('code')[0].text === 'const a = 1;'
          && byKind('code')[0].lang === 'js',
        JSON.stringify(byKind('code')));
  check('★★ hard break (`' + BS + '` ท้ายบรรทัด) รวมเป็นย่อหน้าเดียวสองบรรทัด',
        byKind('p').some((x) => (x.lines || []).length === 2
          && x.lines[0] === 'บรรทัดหนึ่ง' && x.lines[1] === 'บรรทัดสอง'),
        JSON.stringify(byKind('p')));
  check('★ ขึ้นหน้าใหม่ด้วยมือเป็นบล็อกของตัวเอง', byKind('pagebreak').length === 1);
  check('★ ลำดับเริ่มต้นของรายการเลขถูกเก็บไว้ (3. ต้องเริ่มที่ 3)',
        byKind('li').some((x) => x.ordered && x.num === 3), JSON.stringify(byKind('li')));
  check('★ ช่องว่างนำหน้าบรรทัดไม่ถูกกลืน',
        byKind('p').some((x) => x.text === '    เยื้องสี่ช่อง'));
  check('★ คอมเมนต์ align ถูกถอดออกมาเป็นค่า ไม่ใช่ข้อความ',
        blocks[0].align === 'center' && blocks[0].text === 'ย่อหน้ากลาง',
        JSON.stringify(blocks[0]));
  check('★ ตัวคั่นหน้าของเวิร์กโฟลว์ก็เป็นบล็อกขึ้นหน้าใหม่ (เมื่อบอกเครื่องหมายมาให้)',
        MD.mdBlocks('ก' + NL + C.PAGE_BREAK + NL + 'ข', { breakMarker: C.PAGE_BREAK })
          .map((b) => b.kind).join(',') === 'p,pagebreak,p');
}

// ───────── 2. inlineHtml ต้องใช้แท็กชุดเดียวกับสคีมาของตัวแก้ไข ─────────
{
  const cases = [
    ['**หนา**', '<strong>หนา</strong>'],
    ['*เอียง*', '<em>เอียง</em>'],
    ['_ขีดเส้นใต้_', '<u>ขีดเส้นใต้</u>'],           // ★ ของเดิมส่งออกเป็น <em> (ผิด)
    ['~~ขีดฆ่า~~', '<s>ขีดฆ่า</s>'],
    ['x^2^', 'x<sup>2</sup>'],                        // ★ ของเดิมพิมพ์ ^2^ ออกมาตรง ๆ
    ['H~2~O', 'H<sub>2</sub>O'],                      // ★ ของเดิมพิมพ์ ~2~ ออกมาตรง ๆ
    ['[[ตัวละคร|เขา]]', 'เขา'],                       // ★ ของเดิมพิมพ์วงเล็บให้ผู้อ่านเห็น
    ['<b>ดิบ</b>', '&lt;b&gt;ดิบ&lt;/b&gt;'],          // HTML ที่ผู้เขียนพิมพ์เองต้องไม่หลุด
  ];
  for (const [src, want] of cases)
    check('★ inlineHtml: ' + src + ' → ' + want, MD.inlineHtml(src) === want, MD.inlineHtml(src));
  check('★ สีตัวอักษรกลายเป็นสีจริง',
        MD.inlineHtml('<span style="color:#ff0000">แดง</span>')
          === '<span style="color:#ff0000">แดง</span>',
        MD.inlineHtml('<span style="color:#ff0000">แดง</span>'));
  check('★ โหมดขาวดำทิ้งสีแต่เก็บข้อความครบ',
        MD.inlineHtml('<span style="color:#ff0000">แดง</span>', { mono: true }) === 'แดง');
  // ── [alpha.150] สีเน้นข้อความ: ต้องเดินทางเดียวกับสีตัวอักษรทุกช่วง ──
  const HL = '<mark style="background:#fff3a3">เน้น</mark>';
  check('★ สีเน้นข้อความกลายเป็นพื้นสีจริง', MD.inlineHtml(HL) === HL, MD.inlineHtml(HL));
  check('★ โหมดขาวดำทิ้งสีเน้นแต่เก็บข้อความครบ',
        MD.inlineHtml(HL, { mono: true }) === 'เน้น');
  const HLC = '<mark style="background:#fff3a3"><span style="color:#ff0000">**ทั้งสาม**</span></mark>';
  check('★ สีเน้น + สีตัวอักษร + ตัวหนา ซ้อนกันได้ครบทั้งสามชั้น',
        MD.inlineHtml(HLC) === '<mark style="background:#fff3a3"><span style="color:#ff0000"><strong>ทั้งสาม</strong></span></mark>',
        MD.inlineHtml(HLC));
  // เขียนกลับแล้วต้องได้ไฟล์เดิมเป๊ะ (ไม่งั้นบันทึกสองรอบไฟล์ไม่เหมือนเดิม)
  check('★ สีเน้น: .md → doc → .md ได้ของเดิม',
        MD.docToMd(MD.mdToDoc(HLC)).trim() === HLC, MD.docToMd(MD.mdToDoc(HLC)).trim());
}

// ───────── 3. mdToHtmlBody: ทุกอย่างข้างบนต้องไปถึงไฟล์ที่ส่งออก ─────────
{
  const h = C.mdToHtmlBody(SRC);
  check('★★ hard break ออกมาเป็น <br> ไม่ใช่แบ็กสแลชโต้ง ๆ',
        h.includes('บรรทัดหนึ่ง<br>บรรทัดสอง') && !h.includes(BS), h);
  check('★★ ขีดเส้นใต้/ตัวยก/ตัวห้อย ใช้แท็กเดียวกับบนจอ',
        h.includes('<u>ขีดเส้นใต้</u>') && h.includes('<sup>2</sup>')
          && h.includes('<sub>2</sub>'), h);
  check('★★ ขึ้นหน้าใหม่ด้วยมือกลายเป็นจุดขึ้นหน้าจริง ไม่ใช่ข้อความคอมเมนต์',
        h.includes('<div class="pb"></div>') && !h.includes('pagebreak--'), h);
  check('★★ รั้วโค้ดออกมาเป็น <pre><code>', h.includes('<pre data-lang="js"><code>'), h);
  check('★ รายการเลขเริ่มนับที่เลขจริง', h.includes('<ol start="3">'), h);
  check('★ รูปทั้งบรรทัดออกมาเป็น <figure> (โครงเดียวกับโหนดของตัวแก้ไข)',
        h.includes('<figure><img alt="รูป" src="a.png"></figure>'), h);
  check('★ คำพูดยกมาที่ติดกันอยู่ใน <blockquote> ก้อนเดียว',
        (h.match(/<blockquote>/g) || []).length === 1, h);
  check('★ การจัดหน้ายังเดินทางมาถึง',
        h.includes('<p style="text-align:center" data-align="center">ย่อหน้ากลาง</p>'), h);
}

// ───────── 4. ช่องตัวอย่างต้องอ่านบรรทัดได้เหมือนกันเป๊ะ ─────────
{
  const pb = PF.mdToProseBlocks(SRC);
  const mb = MD.mdBlocks(SRC);
  const map = { p: 'p', h: 'h', li: 'li', quote: 'blockquote', hr: 'hr',
                figure: 'figure', code: 'code', pagebreak: 'pagebreak' };
  const want = mb.map((b) => (b.kind === 'h' ? 'h' + b.level : map[b.kind]));
  const got = pb.map((b) => (/^h[1-6]$/.test(b.type) ? 'h' : b.type))
    .map((x, i) => (want[i] && want[i].startsWith('h') ? 'h' : x));
  check('★★ ช่องตัวอย่างเห็นบล็อกชุดเดียวกับตัวแก้ไข/ไฟล์ที่ส่งออก',
        got.length === want.length
          && got.every((x, i) => x === (want[i].startsWith('h') ? 'h' : want[i])),
        got.join(',') + '  ≠  ' + want.join(','));
  check('★ ช่องตัวอย่างรู้จักการจัดหน้าแล้ว (เดิมไม่รู้จักเลย)',
        pb[0].align === 'center', JSON.stringify(pb[0]));
  check('★ ไม่มีคอมเมนต์รูปแบบโผล่เป็นตัวหนังสือกลางหน้ากระดาษ',
        !pb.some((b) => /<!--/.test(String(b.text || ''))),
        JSON.stringify(pb.map((b) => b.text)));
}

// ───────── 5. Y-3: PDF ของนิยายต้องได้มาร์กดาวน์ที่ยังมีรูปแบบครบ ─────────
{
  const model = { title: 'T', author: '', roster: '', chapters: [{ title: '', guid: 'g', scenes: [
    { title: '', file: 'f', body: SRC, synopsis: '', status: '', type: 'scene',
      format: 'prose', words: 0 }] }] };
  const wf = XF.workflowForFormat(XF.defaultWorkflowFor('pdf', C.PRESETS), 'pdf');
  const flat = C.runWorkflow(model, wf, {});
  const keep = C.runWorkflow(model, wf, { markdownOut: true });
  check('★★ ปลายทางข้อความแบน (.md/.txt) ยังไม่มีคอมเมนต์ align ให้ผู้อ่านเห็น',
        !/<!--align/.test(flat.text), flat.text);
  check('★★ ปลายทางที่ยังต้องแปลงต่อ (PDF ของนิยาย) เก็บการจัดหน้าไว้ครบ',
        /<!--align:center-->/.test(keep.text), keep.text);
  check('★★ และเก็บจุดขึ้นหน้าใหม่ไว้ด้วย',
        keep.text.includes('<!--pagebreak-->'), keep.text);
  check('★★ HTML ที่กลายเป็น PDF จึงมีทั้งการจัดหน้าและจุดขึ้นหน้าใหม่',
        C.mdToHtmlBody(keep.text).includes('text-align:center')
          && C.mdToHtmlBody(keep.text).includes('<div class="pb">'), '');
}

// ───────── 6. Y-4: ช่องว่างนำหน้าต้องรอดใน CSS ที่ส่งออก ─────────
{
  const css = PF.proseExportCss(PF.mergeProseFormat(null));
  check('★★ CSS ที่ส่งออกเก็บช่องว่างนำหน้าเหมือน .ProseMirror (เยื้องด้วยการเคาะวรรค)',
        // [alpha.159] กฎเดียวกันมี tab-size (ความกว้างแท็บตั้งได้) ต่อท้ายแล้ว
        /p,h1,h2,h3,h4,h5,h6\{white-space:break-spaces[;}]/.test(css), '');
  check('[159] ★ CSS ที่ส่งออกมีความกว้างแท็บเท่าบนจอ (ค่าเริ่มต้น 4)',
        css.includes('white-space:break-spaces;tab-size:4}'), '');
  check('★ ไม่ตั้ง white-space ที่ body/ul/blockquote (ขึ้นบรรทัดระหว่างแท็กจะกลายเป็นบรรทัดว่าง)',
        !/body\{[^}]*white-space/.test(css) && !/^ul[,{][^}]*white-space/m.test(css), '');
  check('★ รูปทั้งบรรทัดมีกฎ <figure> คู่กับตัวแก้ไข', css.includes('figure{margin:1em 0;'), '');
}

// ───────── 7. Y-6: scopeCss (ตัวจำกัดขอบเขต CSS ของช่องตัวอย่าง) ─────────
{
  const S = XV.scopeCss;
  check('★ กฎ body กลายเป็นกฎของตัวห่อ',
        S('body{font-size:12pt}', '.x') === '.x{font-size:12pt}', S('body{font-size:12pt}', '.x'));
  check('★ กฎที่ขึ้นต้นด้วย body ต่อท้ายได้ถูกต้อง',
        S('body > p:first-of-type{text-indent:0}', '.x')
          === '.x > p:first-of-type{text-indent:0}', S('body > p:first-of-type{a:b}', '.x'));
  check('★ กฎแท็กเปล่าถูกจำกัดขอบเขต ไม่รั่วไปทับทั้งแอป',
        S('p{margin:0}', '.x') === '.x p{margin:0}', S('p{margin:0}', '.x'));
  check('★ ตัวเลือกหลายตัวถูกจำกัดขอบเขตครบทุกตัว',
        S('h1,h2{a:b}', '.x') === '.x h1,.x h2{a:b}', S('h1,h2{a:b}', '.x'));
  check('★★ @page / @media print ถูกทิ้ง (ไม่มีความหมายบนจอ)',
        S('@page{size:8.5in 11in}p{a:b}@media print{body{margin:0}}', '.x') === '.x p{a:b}',
        S('@page{size:8.5in 11in}p{a:b}@media print{body{margin:0}}', '.x'));
  check('★ ตัวเลือกที่มีวงเล็บซ้อน (`:has()`) ไม่ถูกตัดผิดที่',
        S('li:has(> p[data-align="center"]:first-child){list-style:none}', '.x')
          === '.x li:has(> p[data-align="center"]:first-child){list-style:none}', '');
  // ★★ ของจริงทั้งก้อนต้องไม่มีกฎไหนหลุดขอบเขตเลยแม้แต่ข้อเดียว
  const scoped = S(PF.proseExportCss(PF.mergeProseFormat(null)), '.x');
  const heads = scoped.split(String.fromCharCode(10)).map((l) => l.split('{')[0]);
  check('★★ ทุกกฎของ CSS ส่งออกฉบับจริงถูกจำกัดขอบเขตหมด',
        heads.every((h) => !h || h.split(',').every((x) => x.trim().startsWith('.x'))),
        heads.filter((h) => h && !h.trim().startsWith('.x')).join(' | '));
}

// ───────── 8. [alpha.134 ข้อ 1] ย่อหน้าแรกของเอกสารต้องย่อเมื่อเปิดย่อหน้าอัตโนมัติ ─────────
//
// ผู้ใช้: *"เวลาเราใช้ย่อหน้าอัตโนมัติ บรรทัดแรก ต้องย่อหน้า"*
// ต้นตอ: `> p:first-child` ถูกเหมารวมไว้ใต้สวิตช์ "ย่อหน้าแรกหลังหัวข้อด้วย" ซึ่งเป็นคนละเรื่อง
{
  const f = PF.mergeProseFormat({ firstLineIndent: 0.5, indentAfterHeading: false });
  const screen = PF.proseCss(f, '.ED');
  const file = PF.proseExportCss(f);
  const lineWith = (css, needle) =>
    (css.split(NL).find((l) => l.includes(needle)) || '(ไม่มีกฎนั้นแล้ว)');
  check('★★ CSS บนจอไม่ล้างย่อหน้าของ "ย่อหน้าแรกของเอกสาร" อีกแล้ว',
        !/>\s*p:first-child\s*[,{]/.test(screen), lineWith(screen, 'first-child'));
  check('★★ CSS ที่ส่งออกก็เหมือนกัน (จอกับไฟล์ต้องมาจากกฎเดียวกัน)',
        !/body\s*>\s*p:first-child/.test(file), lineWith(file, 'first-child'));
  check('★ สวิตช์ยังคุม "ย่อหน้าแรกหลังหัวข้อ" ตามเดิม',
        /h1\+p/.test(screen) && /h1\+p/.test(file), '');
  const on = PF.proseExportCss(PF.mergeProseFormat({ firstLineIndent: 0.5,
                                                     indentAfterHeading: true }));
  check('★ ติ๊กสวิตช์แล้วย่อหน้าหลังหัวข้อก็ย่อด้วย (ไม่มีกฎล้างเหลืออยู่)',
        !/h1\+p[^{]*\{text-indent:0\}/.test(on.replace(/\s*\{\s*/g, '{')), '');
  check('★ ย่อหน้าปกติยังได้ระยะย่อตามที่ตั้ง',
        file.includes('text-indent:0.5in'), '');
}

// ───────── [alpha.149] ตัวแปลง path รูป (`imgSrc`) ─────────
// HTML ของนิยายถูกวางที่อื่นเสมอ (โหมดอ่าน · ช่องตัวอย่าง · ไฟล์ชั่วคราวของ PDF) — path สัมพัทธ์กับไฟล์ฉาก
// จึงชี้ผิดที่ · ผู้เรียกส่งตัวแปลงมาได้ แต่ **ไม่ส่ง = ผลเดิมทุกตัวอักษร**
{
  const md = '![รูป](../../../../../Images/sunset.png "w=60%")';
  const plain = C.mdToHtmlBody(md);
  check('[149] ไม่ส่ง imgSrc = src เดิมทุกตัวอักษร', plain.includes('src="../../../../../Images/sunset.png"'), plain);
  const hooked = C.mdToHtmlBody(md, { imgSrc: (s) => 'file:///R/Images/' + s.split('/').pop() });
  check('[149] ★ ส่ง imgSrc = src ผ่านตัวแปลงของผู้เรียก', hooked.includes('src="file:///R/Images/sunset.png"'), hooked);
  check('[149] ★ ตัวแปลงไม่แตะโครง figure (คลาส · สไตล์ · alt เดิม)',
        hooked.replace(/src="[^"]*"/, '') === plain.replace(/src="[^"]*"/, ''), hooked + ' vs ' + plain);
  const full = C.mdToHtml(md, 't', null, null, null, { imgSrc: () => 'X.png' });
  check('[149] mdToHtml ส่ง imgSrc ต่อถึงเนื้อเอกสาร', full.includes('src="X.png"'), '');
  let wfText = '';
  try {
    const wf = C.runWorkflow({ title: 't', author: '', chapters: [{ title: 'c', scenes: [
      { title: 's', body: md, type: 'scene', format: 'prose' }] }] },
      { ext: 'html', steps: [{ key: 'to-html', on: true }] }, { imgSrc: () => 'Y.png' });
    wfText = String(wf && wf.text);
  } catch (e) { wfText = 'THROW ' + e.message; }
  check('[149] ★ runWorkflow ขั้น to-html ใช้ imgSrc ที่ผู้เรียกส่งมา', wfText.includes('src="Y.png"'), wfText.slice(0, 300));
}

// ───────── [alpha.149] ระยะบรรทัดของหัวข้อ = กฎคู่แฝด จอ ↔ ไฟล์ ─────────
// ตัวแก้ไขได้ 1.3 จาก style.css แต่ไฟล์ไม่เคยตั้ง → รับ 1.75 ของเนื้อความ (H1 สูงกว่าจอ 14.4px)
// และช่องตัวอย่างวัดกับวาดคนละค่า → เส้นตัดหน้าเฉือนรูป/ตัวหนังสือ
{
  const fsx = require('fs');
  const css = fsx.readFileSync(path.join(__dirname, '..', 'renderer', 'style.css'), 'utf8');
  const m = css.match(/\.ProseMirror h1,\s*\.ProseMirror h2[^{]*\{[^}]*line-height:([0-9.]+)/);
  const want = PF.HEADING_LINE_HEIGHT;
  check('[149] ตัวแก้ไข (style.css) ตั้ง line-height ของหัวข้อ = HEADING_LINE_HEIGHT',
        !!m && +m[1] === want, m ? m[1] : 'ไม่เจอกฎ');
  const fmt = PF.mergeProseFormat({});
  const file = PF.proseExportCss(fmt);
  const screen = PF.proseCss(fmt, '.X');
  const lhOf = (src, lv, pre) => {
    // ไม่รับ "," นำหน้า — `p,h1,…,h6{white-space:…}` เป็นกฎรวม ไม่ใช่กฎของหัวข้อระดับนั้น
    const r = new RegExp('(^|[};\\s])' + pre + 'h' + lv + '\\{([^}]*)\\}');
    const g = src.match(r);
    const v = g && g[2].match(/line-height:([0-9.]+)/);
    return v ? +v[1] : null;
  };
  for (let lv = 1; lv <= 6; lv++) {
    check('[149] ★ h' + lv + ': ไฟล์ = จอ = ' + want,
          lhOf(file, lv, '') === want && lhOf(screen, lv, '\\.X ') === want,
          lhOf(file, lv, '') + ' / ' + lhOf(screen, lv, '\\.X '));
  }
  // กฎหน้ากระดาษของโปรแกรมต้องไม่ถึงเอกสารของช่องตัวอย่าง (ตัววัดอยู่นอกแผ่น กฎพวกนี้ไม่ถึง)
  const leak = css.split('}').filter((r) => /\.sp-pageview \.ed-page [^{]*(h1|blockquote|hr|\bp\b)/.test(r)
                                        && !/:not\(\.k-xpv-doc \*\)/.test(r));
  check('[149] ★ กฎ .sp-pageview .ed-page ของเนื้อหาไม่รั่วเข้าเอกสารตัวอย่าง (.k-xpv-doc)', leak.length === 0,
        leak.map((x) => x.trim().slice(0, 80)).join(' | '));
}

// ── [alpha.160 · P1-15] จัดหน้าของ "รูป" ต้องรอดการเปิด→บันทึกในตัวแก้ไข (ไฟล์ส่งออกรองรับอยู่แล้ว) ──
{
  const src = 'ย่อหน้าแรก' + NL + NL + '<!--align:right-->![ภาพ](Images/a.png)' + NL + NL + 'ท้าย';
  const doc = MD.mdToDoc(src);
  const fig = doc.content.find((n) => n.type === 'figure');
  check('[160-P1-15] ★ mdToDoc: รูปได้ align จากคอมเมนต์นำหน้า', !!fig && fig.attrs.align === 'right', JSON.stringify(fig && fig.attrs));
  const back = MD.docToMd(doc);
  check('[160-P1-15] ★★ docToMd: เขียน <!--align:right--> นำหน้ารูปกลับลงไฟล์ (ไป-กลับไม่หาย)',
        back.includes('<!--align:right-->![ภาพ](Images/a.png)'), JSON.stringify(back));
  // โหมด frontmatter (ค่าเริ่มต้นของโปรแกรม): แผนที่ align ต้องมีรูปด้วย แล้วโหลดกลับได้
  const map = MD.collectAlign(doc);
  const plain = MD.docToMd(doc, { alignComments: false });
  const again = MD.mdToDoc(plain, MD.alignToString(map));
  const fig2 = again.content.find((n) => n.type === 'figure');
  check('[160-P1-15] ★ แผนที่ align ใน frontmatter เก็บ/โหลดรูปได้', Object.values(map).includes('right')
        && !!fig2 && fig2.attrs.align === 'right', JSON.stringify(map));
  // ไฟล์ส่งออก (mdBlocks) กับตัวแก้ไข อ่านบรรทัดเดียวกันเป็น align เดียวกัน
  const blk = MD.mdBlocks(src).find((b) => b.kind === 'figure');
  check('[160-P1-15] ไฟล์ส่งออกกับตัวแก้ไขเห็น align ของรูปตรงกัน', blk && blk.align === fig.attrs.align);
  const noAl = MD.docToMd(MD.mdToDoc('![x](y.png)'));
  check('[160-P1-15] รูปที่ไม่ได้จัดหน้า = ไม่มีคอมเมนต์งอก', noAl === '![x](y.png)', JSON.stringify(noAl));
}

console.log(NL + 'wysiwyg-parity: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
