// test/export-flat.test.cjs — [alpha.169 · bug hunt] ปลายทาง "ข้อความล้วน" (.txt) และ RTF ของนิยาย
//
// ที่มา: ลองส่งออกทุกปลายทางบนแอปจริงแล้วเปิดไฟล์ดู
//   · .txt ยังมี `^ยก^` `~ห้อย~` `<span style="color:…">` และ `\` ท้ายบรรทัด (regex ถอดมาร์กดาวน์ชุดที่สอง)
//   · .rtf ของนิยายถูกอ่านเป็นบทภาพยนตร์ (ย่อหน้าสั้นกลายเป็นชื่อตัวละคร + บทพูด · รูปแบบตัวอักษรหายหมด)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(name) {
  const tmp = path.join(os.tmpdir(), 'k2-' + name + '-flat-test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', name + '.js')],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const C = load('compile');
const RTF = load('export-rtf');
const XF = load('export-formats');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const MD = [
  '# หัวข้อใหญ่',
  'ปกติ **หนา** *เอียง* _ขีดใต้_ ~~ฆ่า~~ x^2^ H~2~O <span style="color:#c0392b">แดง</span> [[โทระ]] [[ป้าแม้น|ป้า]]',
  '<!--align:center-->กึ่งกลาง',
  '- ข้อหนึ่ง',
  '- ข้อสอง',
  '3. สาม',
  '4. สี่',
  '> ยกมา',
  'บรรทัดแรก\\',
  'บรรทัดสอง',
  '',
  '<!--pagebreak-->',
  '![คำบรรยายรูป](Images/a.png "w=60%")',
  'ลิงก์ [ข้อความ](https://example.com) และ `โค้ด`',
  '---',
].join('\n');

// ═════════ stripMarkdown ═════════
{
  const out = C.stripMarkdown(MD);
  const L = out.split('\n');
  check('[txt] หัวข้อไม่มี #', L[0] === 'หัวข้อใหญ่', L[0]);
  check('[txt] ★ ไม่มีเครื่องหมาย ^ ~ * _ และไม่มีแท็ก span/วงเล็บเอนทิตี้เหลือ',
        L[1] === 'ปกติ หนา เอียง ขีดใต้ ฆ่า x2 H2O แดง โทระ ป้า', L[1]);
  check('[txt] คอมเมนต์จัดหน้าไม่หลุดเป็นตัวหนังสือ', L[2] === 'กึ่งกลาง', L[2]);
  check('[txt] รายการจุดนำมีจุดนำ', L[3] === '• ข้อหนึ่ง' && L[4] === '• ข้อสอง', L[3] + '|' + L[4]);
  check('[txt] ★ รายการเรียงลำดับคงเลขเดิม (เริ่มที่ 3)', L[5] === '3. สาม' && L[6] === '4. สี่', L[5] + '|' + L[6]);
  check('[txt] คำพูดยกมาไม่มี >', L[7] === 'ยกมา', L[7]);
  check('[txt] ★ ขึ้นบรรทัดในย่อหน้า (Shift+Enter) ไม่มีแบ็กสแลชค้าง', L[8] === 'บรรทัดแรก' && L[9] === 'บรรทัดสอง', JSON.stringify(L.slice(8, 10)));
  check('[txt] บรรทัดว่างของผู้เขียนยังอยู่', L[10] === '', JSON.stringify(L[10]));
  check('[txt] ขึ้นหน้าใหม่ด้วยมือยังเป็นตัวคั่น (ขั้นสุดท้ายแปลงต่อ)', L[11] === '<!--pagebreak-->', L[11]);
  check('[txt] รูปทั้งบรรทัดเหลือคำบรรยาย', L[12] === 'คำบรรยายรูป', L[12]);
  check('[txt] ลิงก์/โค้ดในบรรทัดเหลือข้อความ', L[13] === 'ลิงก์ ข้อความ และ โค้ด', L[13]);
  check('[txt] เส้นคั่นเป็นบรรทัดว่าง', L[14] === '', JSON.stringify(L[14]));
  check('[txt] จำนวนบรรทัดเท่าเดิม (หนึ่งบรรทัด = หนึ่งบล็อก)', L.length === MD.split('\n').length, L.length + ' vs ' + MD.split('\n').length);
  check('[txt] ค่าว่าง/null ไม่พัง', C.stripMarkdown('') === '' && C.stripMarkdown(null) === '');
  // เดินผ่านเวิร์กโฟลว์ "ข้อความล้วน" ตัวจริง
  const model = { title: 'เรื่อง', author: '', chapters: [{ title: 'บทหนึ่ง', scenes: [{ title: 'ฉาก', body: MD, format: 'prose', type: 'scene' }] }] };
  const wf = XF.workflowForFormat(XF.defaultWorkflowFor('txt', undefined, 'prose'), 'txt');
  const r = C.runWorkflow(model, wf, {});
  check('[txt] ★ ไฟล์ .txt ทั้งไฟล์ไม่มี * ^ ~ < > \\ ของมาร์กดาวน์เหลือ',
        !/[*^~<>\\]/.test(r.text.replace(/\f/g, '')), r.text);
  check('[txt] ขึ้นหน้าใหม่ด้วยมือกลายเป็น form-feed ในไฟล์แบน', r.text.includes('\f') && !/pagebreak/.test(r.text));
}

// ═════════ defaultWorkflowFor ═════════
{
  const wP = XF.defaultWorkflowFor('rtf', undefined, 'prose');
  check('[rtf] ★ นิยาย: เวิร์กโฟลว์ตั้งต้นของ RTF ไม่มีขั้นตัดมาร์กดาวน์',
        !(wP.steps || []).some((s) => s.key === 'strip-markdown' && s.on !== false), wP.id);
  check('[rtf] บทภาพยนตร์: ยังใช้พรีเซ็ตของบท', XF.defaultWorkflowFor('rtf', undefined, 'screenplay').id === 'screenplay');
  check('[rtf] ไม่ระบุชนิด: ทางเดิม (พรีเซ็ตของบท)', XF.defaultWorkflowFor('rtf').id === 'screenplay');
}

// ═════════ generateProseRtf ═════════
{
  const rtf = RTF.generateProseRtf(MD, { title: 'เรื่อง {1}', author: 'ผู้เขียน', font: 'TH Sarabun New', fontPt: 16,
    paper: { width: 8.27, height: 11.69 }, margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  const th = (s) => RTF.escapeRtf(s);
  check('[rtf] ขึ้นต้น {\\rtf1 และปิดกลุ่มครบ', rtf.startsWith('{\\rtf1') && rtf.trimEnd().endsWith('}'));
  const depth = (() => { let d = 0, min = 0; for (let i = 0; i < rtf.length; i++) { const c = rtf[i]; if (c === '\\') { i++; continue; } if (c === '{') d++; else if (c === '}') { d--; if (d < min) min = d; } } return { d, min }; })();
  check('[rtf] ★ วงเล็บปีกกาสมดุล (ไฟล์ไม่เสีย)', depth.d === 0 && depth.min === 0, JSON.stringify(depth));
  check('[rtf] ไม่มีอักขระนอก ASCII (ไทยเป็น \\uNNNN?)', !/[^\x00-\x7F]/.test(rtf));
  check('[rtf] ฟอนต์ของนิยายอยู่ในตารางฟอนต์ ไม่ใช่ Courier ของบท', /\\fonttbl\{\\f0\\fnil\\fcharset0 TH Sarabun New;\}/.test(rtf), rtf.slice(0, 200));
  check('[rtf] ขนาดกระดาษ/ระยะขอบจากที่ตั้งไว้', rtf.includes('\\paperw11909') && rtf.includes('\\margl2160') && rtf.includes('\\margr1440'));
  check('[rtf] ขนาดฟอนต์ 16pt = \\fs32', rtf.includes('\\f0\\fs32\n'));
  check('[rtf] ★ ตัวหนา/เอียง/ขีดใต้/ขีดฆ่า เป็นคำสั่งของ RTF',
        rtf.includes('{\\b ' + th('หนา') + '}') && rtf.includes('{\\i ' + th('เอียง') + '}')
        && rtf.includes('{\\ul ' + th('ขีดใต้') + '}') && rtf.includes('{\\strike ' + th('ฆ่า') + '}'));
  check('[rtf] ตัวยก/ตัวห้อย', rtf.includes('{\\super 2}') && rtf.includes('{\\sub 2}'));
  check('[rtf] ★ สีตัวอักษร: ตารางสี + \\cf1', rtf.includes('{\\colortbl;\\red192\\green57\\blue43;}') && rtf.includes('{\\cf1 ' + th('แดง') + '}'));
  check('[rtf] ไม่มีเครื่องหมายมาร์กดาวน์ดิบ', !/\*\*|~~|\^|<span|\[\[|<!--/.test(rtf), rtf);
  check('[rtf] เอนทิตี้เหลือชื่อที่แสดง', rtf.includes(th('โทระ')) && rtf.includes(th('ป้า')) && !rtf.includes(th('ป้าแม้น')));
  check('[rtf] ★ ย่อหน้าจัดกึ่งกลาง = \\qc', new RegExp('\\\\qc ' + th('กึ่งกลาง').replace(/[\\?]/g, '\\$&') + '\\\\par').test(rtf));
  check('[rtf] หัวข้อ: ตัวหนา ใหญ่กว่าเนื้อ ติดกับย่อหน้าถัดไป', /\\fs64\\sb240\\sa120\\keepn\\b /.test(rtf));
  check('[rtf] รายการจุดนำ', (rtf.match(/\\li720\\fi-360\\sa60 \\bullet\\tab /g) || []).length === 2);
  check('[rtf] ★ รายการเรียงลำดับเริ่มที่เลขเดิมแล้วนับต่อ', rtf.includes(' 3.\\tab ') && rtf.includes(' 4.\\tab '));
  check('[rtf] คำพูดยกมาเยื้องสองข้าง + เอียง', rtf.includes('\\li720\\ri720\\sa120 {\\i ' + th('ยกมา') + '}'));
  check('[rtf] ★ Shift+Enter = \\line ในย่อหน้าเดียว', rtf.includes(th('บรรทัดแรก') + '\\line ' + th('บรรทัดสอง') + '\\par'));
  check('[rtf] ขึ้นหน้าใหม่ = \\page', rtf.split('\n').includes('\\page'));
  check('[rtf] รูปทั้งบรรทัด → คำบรรยาย (กึ่งกลาง)', rtf.includes('\\qc {\\i ' + th('คำบรรยายรูป') + '}'));
  check('[rtf] ข้อมูลเอกสาร: ชื่อเรื่องถูกหนีอักขระ', rtf.includes('{\\title ' + th('เรื่อง ') + '\\{1\\}}') && rtf.includes('{\\author ' + th('ผู้เขียน') + '}'));
  check('[rtf] ★ ไม่มีระยะเยื้องของ "ชื่อตัวละคร/บทพูด" ของบทภาพยนตร์', !/\\li3168|\\li1440\\ri2160/.test(rtf));
  // ตัวคั่นหน้าของเวิร์กโฟลว์
  const r2 = RTF.generateProseRtf('ก\n\n@@PB@@\n\nข', { breakMarker: '@@PB@@' });
  check('[rtf] ตัวคั่นหน้าของเวิร์กโฟลว์ = \\page (ไม่หลุดเป็นข้อความ)', r2.split('\n').includes('\\page') && !r2.includes('PB'));
  check('[rtf] ไม่มีสี = ตารางสีว่าง', r2.includes('{\\colortbl;}'));
  check('[rtf] ค่าว่างไม่พัง', RTF.generateProseRtf('', {}).startsWith('{\\rtf1'));
  check('[rtf] ชื่อฟอนต์ที่มีอักขระคุมกลุ่มถูกกรอง', RTF.generateProseRtf('ก', { font: 'A;B{C}' }).includes('\\fcharset0 ABC;'));
}

// ═════════ รหัส fountain ในปลายทางที่ไม่ผ่านตัวอ่านบท (.txt/.md/.html/.docx ของบทภาพยนตร์) ═════════
{
  const F = load('fountain');
  const sp = ['### INT. ร้าน - คืน', '', '@โทระ', '((กระซิบ))', '((มองซ้าย))', 'มีใครอยู่ไหม', '', '((โน้ตของ v1 ที่ไม่ได้อยู่ใต้ชื่อ))', '', 'ลมพัดผ่าน', '((ไม่ได้อยู่ใต้ @))', '', '>> CUT TO:'].join('\n');
  const L = F.stripFountainCodes(sp).split('\n');
  check('[sp] ★ วงเล็บใต้ชื่อตัวละครคงวงเล็บหนึ่งชั้น (ที่ผู้อ่านเห็นบนจอ)', L[3] === '(กระซิบ)', L[3]);
  check('[sp] วงเล็บซ้อนต่อกันใต้วงเล็บด้วยกัน', L[4] === '(มองซ้าย)', L[4]);
  check('[sp] ชื่อตัวละครไม่มี @', L[2] === 'โทระ', L[2]);
  check('[sp] โน้ตแบบ v1 (มีบรรทัดว่างคั่น) ไม่ถูกทำเป็นวงเล็บ', L[7] === 'โน้ตของ v1 ที่ไม่ได้อยู่ใต้ชื่อ', L[7]);
  check('[sp] `((…))` ใต้บรรยาย (ไม่มี @) = โน้ต ไม่ใช่วงเล็บ', L[10] === 'ไม่ได้อยู่ใต้ @', L[10]);
  check('[sp] ทรานซิชันไม่มี >>', L[12] === 'CUT TO:', L[12]);
  check('[sp] จำนวนบรรทัดเท่าเดิม', L.length === sp.split('\n').length);
  // ปลายทาง HTML: ต้องตัดรหัส **ก่อน** แปลงเป็นหน้าเว็บ (หลังแปลงแล้วตัดไม่ได้ — กินกฎ CSS ที่ขึ้นต้นด้วย @ / .)
  const model = { title: 'บท', author: '', chapters: [{ title: '', scenes: [{ title: '', body: sp, format: 'screenplay', type: 'scene' }] }] };
  const wfH = XF.workflowForFormat(XF.defaultWorkflowFor('html', undefined, 'screenplay'), 'html');
  const raw = C.runWorkflow(model, wfH, {});
  const cut = C.runWorkflow(model, wfH, { beforeHtml: F.stripFountainCodes });
  check('[sp] (ยืนยันอาการเดิม) ไม่ส่งตัวกรอง = รหัสหลุดในหน้า HTML', />@โทระ</.test(raw.text) && raw.ext === 'html');
  check('[sp] ★ ส่งตัวกรอง: หน้า HTML ไม่มี @ชื่อ / ((วงเล็บ)) / >> เหลือ',
        cut.ext === 'html' && />โทระ</.test(cut.text) && />\(กระซิบ\)</.test(cut.text) && />CUT TO:</.test(cut.text)
        && !/>@โทระ|\(\(กระซิบ|&gt;&gt; CUT/.test(cut.text), cut.text.slice(cut.text.indexOf('<body'), cut.text.indexOf('<body') + 400));
  check('[sp] ★ กฎ CSS ของหน้า (@page · .pb) ไม่ถูกตัวกรองกิน', /@page\s*\{/.test(cut.text) && /\.pb\s*\{/.test(cut.text));
  const wfT = XF.workflowForFormat(XF.defaultWorkflowFor('txt', undefined, 'screenplay'), 'txt');
  check('[sp] ปลายทางที่ไม่ใช่ HTML: ตัวกรองไม่ถูกเรียก (ผู้เรียกตัดเองหลังจบ)',
        C.runWorkflow(model, wfT, { beforeHtml: () => 'X' }).text !== 'X\n');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
