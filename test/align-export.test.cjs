// test/align-export.test.cjs — [alpha.132 · X-1] "การจัดหน้าต้องรอดไปถึงไฟล์ที่ส่งออก"
//
// ต้นตอของเคส X-1: แผนที่ align เก็บใน **frontmatter** ของ .md (alpha.58r ตั้งใจให้ไฟล์สะอาด)
// แต่สายส่งออกหยิบไปแค่ `body` แล้ว `mdToHtmlBody` ก็ไม่รู้จัก `<!--align:x-->` อยู่ดี
// → เอกสารที่จัดกึ่งกลางไว้ ออกมาเป็นชิดซ้ายทั้งเล่ม
//
// สัญญาที่ผูกไว้ถาวร:
//   · md ↔ doc ไป-กลับได้ครบ **รวมข้อในรายการและย่อหน้าในคำพูดยกมา** (เดิมมีแต่ย่อหน้าบนสุด)
//   · โหมด "ไฟล์สะอาด" (alignComments:false) ต้องไม่มีคอมเมนต์หลุดลงไฟล์งานแม้แต่ตัวเดียว
//   · ขั้นตอน "ตัดคอมเมนต์" ต้องไม่กลืน **คอมเมนต์ที่เป็นรูปแบบ** (align / pagebreak)
//   · ปลายทางที่ไม่ใช่ HTML ต้องไม่มี `<!--align:…-->` โผล่ให้ผู้อ่านเห็น
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-alignexport-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'compile.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const C = require(tmp);
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── md ↔ doc: คอมเมนต์ align ครอบคลุมทุกชนิดบล็อก ─────────
const SRC = [
  '<!--align:center-->ย่อหน้ากลาง',
  '<!--align:center-->## หัวข้อกลาง',
  '<!--align:right-->- ข้อชิดขวา',
  '- ข้อธรรมดา',
  '<!--align:center-->1. ข้อเลขกลาง',
  '<!--align:right-->> ยกมาชิดขวา',
].join('\n');

const doc = MD.mdToDoc(SRC);
check('★★ md → doc → md ไป-กลับได้ตรงเป๊ะ (รวมข้อในรายการ/คำพูดยกมา)',
      MD.docToMd(doc, { alignComments: true }) === SRC,
      JSON.stringify(MD.docToMd(doc, { alignComments: true })));
{
  const map = MD.collectAlign(doc);
  check('★ แผนที่ align เก็บข้อในรายการและย่อหน้าในคำพูดยกมาด้วย',
        Object.values(map).filter((v) => v === 'right').length === 2
          && Object.values(map).filter((v) => v === 'center').length === 3,
        JSON.stringify(map));
}
check('★★ โหมดไฟล์สะอาดไม่มีคอมเมนต์หลุดลงไฟล์งานเลย',
      !/<!--align/.test(MD.docToMd(doc, { alignComments: false })),
      MD.docToMd(doc, { alignComments: false }));
{
  // เอกสารที่ไม่ได้จัดหน้าเลย ต้องเขียนกลับได้เหมือนเดิมทุกตัวอักษร (ไม่มีผลข้างเคียง)
  const plain = 'ย่อหน้า\n- ข้อ\n1. เลข\n> ยกมา\n## หัวข้อ';
  check('เอกสารที่ไม่มี align เขียนกลับได้เหมือนเดิมทุกตัวอักษร',
        MD.docToMd(MD.mdToDoc(plain), { alignComments: false }) === plain,
        JSON.stringify(MD.docToMd(MD.mdToDoc(plain), { alignComments: false })));
}
{
  // อ่านจาก frontmatter (ทางที่โปรแกรมใช้จริง) แล้วเขียนออกเป็นคอมเมนต์ = ทางของตัวส่งออก
  const map = MD.alignFromString(MD.alignToString(MD.collectAlign(doc)));
  const viaMap = MD.docToMd(MD.mdToDoc(MD.docToMd(doc, { alignComments: false }), map),
                            { alignComments: true });
  check('★★ เส้นทางจริงของตัวส่งออก (frontmatter → คอมเมนต์) ให้ผลเท่าต้นฉบับ',
        viaMap === SRC, JSON.stringify(viaMap));
}

// ───────── ตัดคอมเมนต์: ต้องเว้นคอมเมนต์ที่เป็นรูปแบบ ─────────
{
  const r = C.stripComments('ก <!--โน้ต--> ข <!--align:center--> ค <!--pagebreak--> ง %%ซ่อน%%');
  check('★★ ตัดคอมเมนต์ของนักเขียนออก แต่เว้น align/pagebreak ไว้',
        !r.includes('โน้ต') && !r.includes('ซ่อน')
          && r.includes('<!--align:center-->') && r.includes('<!--pagebreak-->'), r);
  check('★ ค่าที่ไม่ใช่ทิศทางจริงไม่ถูกเว้น (กันสตริงแปลกหลุดเข้าไปใน style)',
        !C.stripComments('<!--align:evil-->').includes('align'),
        C.stripComments('<!--align:evil-->'));
}

// ───────── md → HTML ─────────
{
  const html = C.mdToHtmlBody(SRC);
  check('★★ ย่อหน้าที่จัดกึ่งกลางออกมาเป็น HTML ที่จัดกึ่งกลางจริง',
        html.includes('<p style="text-align:center" data-align="center">ย่อหน้ากลาง</p>'), html);
  check('★ หัวข้อก็พาการจัดหน้าไปด้วย',
        /<h2 style="text-align:center" data-align="center">/.test(html), html);
  check('★★ ข้อในรายการห่อด้วย <p> ที่ถือ align เอง (ตรงกับสคีมาของตัวแก้ไข)',
        html.includes('<li><p style="text-align:right" data-align="right">ข้อชิดขวา</p></li>'),
        html);
  check('★ ข้อที่ไม่ได้จัดหน้าไม่มีแอตทริบิวต์ติดมา',
        html.includes('<li><p>ข้อธรรมดา</p></li>'), html);
  // [alpha.133 · Y-1] คำพูดยกมาที่ติดกันถูกห่อด้วย <blockquote> **ก้อนเดียว** เหมือนในตัวแก้ไข
  // (ของเดิมห่อทีละบรรทัด → ได้กรอบซ้อนกันหลายอันพร้อมระยะเว้นของตัวเองในไฟล์ที่ส่งออก)
  check('★ คำพูดยกมาก็พาการจัดหน้าไปด้วย',
        !/text-align:center"[^>]*>ยกมา/.test(html)
          && /<blockquote>\s*<p style="text-align:right"/.test(html), html);
  check('รายการยังถูกห่อด้วย <ul>/<ol> ตามเดิม',
        html.includes('<ul>') && html.includes('</ul>') && html.includes('<ol>'), html);
  check('★ ไม่มีคอมเมนต์ align หลงเหลือใน HTML', !/<!--align/.test(html), html);
}
{
  // ไม่มี align เลย = HTML เหมือนเดิมทุกตัวอักษร (กันการเปลี่ยนรูปโดยไม่ตั้งใจ)
  check('เอกสารที่ไม่มี align ให้ HTML เหมือนเดิม',
        C.mdToHtmlBody('ก\n\nข') === '<p>ก</p>\n<p class="k-blank"><br></p>\n<p>ข</p>',
        C.mdToHtmlBody('ก\n\nข'));
}

// ───────── CSS ที่ส่งออกต้องมีกฎจุดนำชุดเดียวกับตัวแก้ไข ─────────
{
  const PF = require(makeBundle('prose-format.js', 'k2-alignexport-pf.cjs'));
  const css = PF.proseExportCss(PF.mergeProseFormat(null));
  check('★★ CSS ที่ส่งออกปิด marker ของเบราว์เซอร์เมื่อข้อถูกจัดกึ่งกลาง/ชิดขวา',
        css.includes('li:has(> p[data-align="center"]:first-child)'), '');
  // ★★ [alpha.132r3] สัญญากลับด้านจาก alpha.132: จุดนำเป็น **ตัวอักษร** ทั้งสองทาง
  // (ผู้ใช้: "bullet และ ตัวเลข ต้องเป็นตัวอักษรด้วย … ต้องปรับรูปแบบ สี และอื่น ๆ ได้")
  // ขนาดเท่ากันโดยโครงสร้าง เพราะบังคับ `content` ของ ::marker ให้เป็นกลีฟตัวเดียวกัน
  check('★★ จุดนำเป็นอักขระเดียวกันทั้งชิดซ้าย (::marker) และกึ่งกลาง/ชิดขวา (::before)',
        css.includes('ul > li::marker{content:"•  "}')
          && css.includes('ul > li > p[data-align="right"]:first-child::before'
                          + '{content:"•  "}'),
        (css.match(/ul > li::marker[^}]*}/) || [''])[0]);
  check('★★ หมายเลขข้อก็ใช้กฎเดียวกันทั้งสองทาง',
        css.includes('ol > li::marker{content:counter(list-item) ".  "}'), '');
  check('★★ จุดนำรับรูปแบบจากตัวแปรที่ <li> ถือไว้ (สี/หนา/เอียง ปรับได้)',
        css.includes('--k-mk-color, currentColor')
          && css.includes('--k-mk-weight, inherit')
          && css.includes('--k-mk-style, inherit'), '');
  check('★ ไม่เหลือวงกลมที่วาดด้วย CSS (ซึ่งปรับฟอนต์/ตัวหนาไม่ได้)',
        !css.includes('border-radius:50%;background:currentColor'), '');
  check('★ ย่อหน้าในข้อไม่มีระยะย่อหน้าของตัวเอง (ไม่งั้นข้อสูงกว่าย่อหน้าปกติ)',
        css.includes('li>p{margin:0;text-indent:0}'), '');
  // ★★ [alpha.132r4] `content` ที่บังคับไว้ชนะ `list-style-type` → ต้องปิด ::marker ด้วย
  // ไม่งั้นจัดกึ่งกลางแล้วได้จุดนำ **สองอัน** (ของเบราว์เซอร์ที่ขอบซ้าย + ของเราที่กลางบรรทัด)
  check('★★ จัดกึ่งกลาง/ชิดขวา = ปิด ::marker ด้วย (กันจุดนำซ้ำที่ขอบซ้าย)',
        css.includes('li:has(> p[data-align="center"]:first-child)::marker')
          && /::marker\{content:none\}/.test(css.replace(/\s*\{\s*/g, '{')), '');
}

// ───────── [alpha.132r4] ข้อที่ว่างเปล่าต้องรอดไปถึงไฟล์ ─────────
{
  const NL = String.fromCharCode(10);
  const h = C.mdToHtmlBody(['1. ก', '2.', '3. ข'].join(NL));
  check('★★ ข้อว่างในรายการยังเป็น <li> (ไม่กลายเป็นย่อหน้าที่มีข้อความ "2.")',
        (h.match(/<li>/g) || []).length === 3 && !h.includes('<p>2.</p>'), h);
  check('★★ ข้อว่างมีกล่องบรรทัดจริง (<br>) ไม่งั้นสูง 0 แล้วหายไปจากหน้า',
        h.includes('<li><p><br></p></li>'), h);
}

function makeBundle(file, out) {
  const o = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: o, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return o;
}

console.log('\nalign-export: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
