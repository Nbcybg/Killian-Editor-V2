// test/export-hub.test.cjs — [alpha.81 ข้อ 8+9] ศูนย์รวมการส่งออก (ส่วนบริสุทธิ์)
//
// สิ่งที่พังแล้วผู้ใช้เจ็บที่สุดไม่ใช่หน้าตากล่อง แต่คือ **การเลือกตัวสร้าง PDF ผิด**
// (บทหนังไปเข้าทาง HTML หรือ นิยายไปเข้าทาง pdf-lib ที่จัดหน้าแบบสคริปต์) และ
// **ขั้นตอน to-html ที่เปิด/ปิดไม่ตรงปลายทาง** ซึ่งทำให้ได้ .txt เต็มไปด้วยแท็ก
// ทั้งสองอย่างเป็นตรรกะล้วน จึงทดสอบด้วย node ตรง ๆ ที่นี่
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_xhub.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/export-formats.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const T = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ ตารางรูปแบบ ═══════════
{
  check('มีรูปแบบปลายทางอย่างน้อย 9 ตัว', T.EXPORT_FORMATS.length >= 9, T.EXPORT_FORMATS.length);
  const keys = T.EXPORT_FORMATS.map((f) => f.key);
  check('key ไม่ซ้ำ', new Set(keys).size === keys.length, keys.join(','));
  check('ทุกตัวมีนามสกุล', T.EXPORT_FORMATS.every((f) => /^[a-z]{2,4}$/.test(f.ext)));
  check('ทุกตัวมีคีย์ภาษาชื่อ+คำอธิบาย',
        T.EXPORT_FORMATS.every((f) => /^ui\./.test(f.labelKey) && /^ui\./.test(f.descKey)));
  check('PDF เขียนแบบไบนารี (กฎ 10)', T.formatDef('pdf').binary === true);
  check('ปลายทางข้อความไม่ถูกทำเครื่องหมายไบนารี',
        ['md', 'txt', 'html', 'rtf', 'fdx'].every((k) => !T.formatDef(k).binary));
  check('formatDef ที่ไม่รู้จักตกไปตัวแรก', T.formatDef('ไม่มีจริง').key === 'pdf');
  // คีย์ภาษาของตารางนี้ถูกอ้างเป็น "ข้อมูล" — test/i18n-keys กวาดไม่เจอ ต้องตรวจที่นี่
  {
    const fs = require('fs');
    const { lexCsv } = require('../tools/csv-lite.cjs');
    const dir = path.join(__dirname, '..', 'languages');
    for (const f of fs.readdirSync(dir).filter((x) => /^k2_.+\.csv$/.test(x))) {
      const tbl = lexCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
      const miss = T.EXPORT_FORMATS.flatMap((x) => [x.labelKey, x.descKey]).filter((k) => !tbl[k]);
      check(f + ': มีคีย์ชื่อรูปแบบครบ', miss.length === 0, miss.join(' · '));
    }
  }
}

// ═══════════ ชนิดเอกสาร → ตัวสร้าง PDF ═══════════
{
  const mk = (fmts) => ({ chapters: [{ scenes: fmts.map((f) => ({ format: f, type: 'scene' })) }] });
  check('ฉากบทหนังล้วน → screenplay', T.docKind(mk(['screenplay', 'screenplay'])) === 'screenplay');
  check('ฉากนิยายล้วน → prose', T.docKind(mk(['prose', 'prose'])) === 'prose');
  check('ปนกัน เอาข้างมาก', T.docKind(mk(['screenplay', 'screenplay', 'prose'])) === 'screenplay');
  check('เสมอกัน → prose (ค่าเริ่มต้นของไฟล์ใหม่)', T.docKind(mk(['screenplay', 'prose'])) === 'prose');
  check('โมเดลว่าง → prose', T.docKind({ chapters: [] }) === 'prose');
  check('ไม่มีโมเดลเลยก็ไม่ throw', T.docKind(null) === 'prose');
  // โน้ตต้องไม่มีสิทธิ์โหวต — ฉบับร่างที่มีโน้ตเยอะกว่าฉากจริงจะตัดสินผิดทันที
  const withMemo = { chapters: [{ scenes: [
    { format: 'screenplay', type: 'scene' },
    { format: 'prose', type: 'memo' }, { format: 'prose', type: 'memo' },
  ] }] };
  check('โน้ต (memo) ไม่นับในการตัดสินชนิด', T.docKind(withMemo) === 'screenplay');

  check('บทหนัง → pdf-lib', T.pdfEngine('screenplay') === 'pdflib');
  check('นิยาย → HTML→PDF', T.pdfEngine('prose') === 'html');
  // ไม่มีทางไหนคืนค่าที่แปลว่า "ผ่านเครื่องพิมพ์ของระบบ" — นั่นคือทางที่ให้ PDF เป็นภาพ
  check('ไม่มีทางที่ผ่านเครื่องพิมพ์ของระบบ',
        ['screenplay', 'prose', 'อื่น'].every((k) => ['pdflib', 'html'].includes(T.pdfEngine(k))));
}

// ═══════════ ขั้นตอน to-html ต้องตรงปลายทางเสมอ ═══════════
{
  const base = { id: 'x', name: 'x', ext: 'md', steps: [
    { key: 'skip-memo', on: true, opts: {} }, { key: 'to-html', on: false, opts: {} },
  ] };
  const html = T.workflowForFormat(base, 'html');
  check('ปลายทาง HTML → เปิด to-html',
        html.steps.find((s) => s.key === 'to-html').on === true);
  check('ปลายทาง HTML → ext เป็น html', html.ext === 'html');
  const txt = T.workflowForFormat({ ...base, steps: [{ key: 'to-html', on: true, opts: {} }] }, 'txt');
  check('ปลายทาง .txt → ปิด to-html', txt.steps.find((s) => s.key === 'to-html').on === false);
  check('ปลายทาง .txt → ext เป็น txt', txt.ext === 'txt');
  const noStep = T.workflowForFormat({ id: 'y', name: 'y', ext: 'md', steps: [] }, 'html');
  check('เวิร์กโฟลว์ที่ไม่มี to-html เลย → เติมให้', !!noStep.steps.find((s) => s.key === 'to-html' && s.on));
  check('ไม่แก้ของเดิม (คัดลอกก่อนแก้เสมอ)',
        base.steps.find((s) => s.key === 'to-html').on === false);
  check('PDF ก็ต้องไม่เปิด to-html (ตัวสร้าง PDF อ่านข้อความ ไม่ใช่ HTML)',
        T.workflowForFormat(base, 'pdf').steps.find((s) => s.key === 'to-html').on === false);
}

// ═══════════ เวิร์กโฟลว์เริ่มต้นต่อรูปแบบ ═══════════
{
  for (const [f, ext] of [['pdf', 'pdf'], ['html', 'html'], ['txt', 'txt'], ['md', 'md']]) {
    const w = T.defaultWorkflowFor(f);
    check('รูปแบบ ' + f + ' มีเวิร์กโฟลว์เริ่มต้น', !!w);
    check('รูปแบบ ' + f + ' ได้เวิร์กโฟลว์ ext=' + ext, w && w.ext === ext, w && w.ext);
  }
  check('rtf/fdx ใช้ทางข้อความล้วน',
        T.defaultWorkflowFor('rtf').ext === 'txt' && T.defaultWorkflowFor('fdx').ext === 'txt');
  check('รูปแบบแปลก ๆ ก็ยังได้เวิร์กโฟลว์ ไม่คืน null', !!T.defaultWorkflowFor('ไม่มีจริง'));
}

// ═══════════ ค่าที่จำไว้ ═══════════
{
  const d = T.defaultHubSettings();
  check('ค่าเริ่มต้นเป็น PDF ทั้งฉบับร่าง', d.format === 'pdf' && d.scope === 'draft');
  const n = T.normalizeHub(null);
  check('ไม่มีค่าเก่า → ได้ค่าเริ่มต้นครบ', n.format === 'pdf' && n.pdf && n.html && n.rtf);
  check('รูปแบบที่ไม่มีในตารางถูกโยนทิ้ง', T.normalizeHub({ format: 'exe' }).format === 'pdf');
  check('scope นอกรายการตกเป็น draft', T.normalizeHub({ scope: 'zzz' }).scope === 'draft');
  check('scope=tab เก็บไว้', T.normalizeHub({ scope: 'tab' }).scope === 'tab');
  // [alpha.81r ข้อ 3] "อยู่โหมดนิยายแล้วส่งออกเป็นหนัง ต้องได้รูปแบบหนังจริง ๆ"
  check('ค่าเริ่มต้นของชนิดเอกสาร = ตามไฟล์', d.kind === 'auto');
  check('บังคับเป็นบทภาพยนตร์ได้', T.normalizeHub({ kind: 'screenplay' }).kind === 'screenplay');
  check('บังคับเป็นนิยายได้', T.normalizeHub({ kind: 'prose' }).kind === 'prose');
  check('ชนิดนอกรายการตกเป็น auto', T.normalizeHub({ kind: 'comic' }).kind === 'auto');
  check('ค่าย่อยที่ผู้ใช้ตั้งไว้ไม่หาย',
        T.normalizeHub({ pdf: { toc: false } }).pdf.toc === false);
  check('ค่าย่อยที่ขาดถูกเติมจากค่าเริ่มต้น',
        T.normalizeHub({ pdf: { toc: false } }).pdf.titlePages === true);
  check('fontPt ที่เป็นข้อความถูกแปลงเป็นตัวเลข (กฎ 20)',
        T.normalizeHub({ rtf: { fontPt: '14' } }).rtf.fontPt === 14);
  check('fontPt ที่ใช้ไม่ได้ตกกลับ 12', T.normalizeHub({ rtf: { fontPt: 'x' } }).rtf.fontPt === 12);
  check('ลายน้ำเป็นสตริงเสมอ', typeof T.normalizeHub({ pdf: { watermark: 5 } }).pdf.watermark === 'string');
}

// ═══════════ [alpha.81r3] หน้าแรกของเนื้อเรื่องต้องมีเลขหน้า ═══════════
// ธรรมเนียม "หน้าแรกไม่ใส่เลข" ถูกต้องตอนหน้าแรกของไฟล์ = หน้าปก
// แต่กล่องนี้แยกหน้าปก/หน้ารายชื่อออกไปเป็นหน้าหน้าเล่มแล้ว หน้าที่เหลือหน้าแรกคือ "หน้า 1"
{
  const base = { paper: { width: 8.5, height: 11 },
                 pageNumbers: { show: true, right: 1, top: 0.5, suffix: '.', firstPage: false } };
  const out = T.exportPageNumberFmt(base);
  check('บังคับให้หน้าแรกมีเลขหน้า', out.pageNumbers.firstPage === true);
  check('ค่าอื่นของเลขหน้าไม่ถูกแตะ',
        out.pageNumbers.right === 1 && out.pageNumbers.top === 0.5 && out.pageNumbers.suffix === '.');
  check('ส่วนอื่นของรูปแบบยังอยู่ครบ', out.paper.width === 8.5 && out.paper.height === 11);
  check('ไม่แก้ของเดิม (คืนสำเนาเสมอ)', base.pageNumbers.firstPage === false);
  check('ปิดสวิตช์เลขหน้าไว้ก็ยังปิดอยู่ (ไม่ไปเปิดให้เอง)',
        T.exportPageNumberFmt({ pageNumbers: { show: false } }).pageNumbers.show === false);
  check('ไม่มี pageNumbers เลยก็ไม่พัง', T.exportPageNumberFmt({}).pageNumbers.firstPage === true);
  check('ค่าว่าง/undefined ไม่พัง', T.exportPageNumberFmt(null).pageNumbers.firstPage === true);
}

// ═══════════ ชื่อไฟล์ที่เสนอ ═══════════
{
  check('ต่อนามสกุลตามรูปแบบ', T.suggestName('เล่มหนึ่ง', 'pdf') === 'เล่มหนึ่ง.pdf');
  check('rtf ได้ .rtf', T.suggestName('a', 'rtf') === 'a.rtf');
  check('อักขระต้องห้ามของ Windows ถูกแทน',
        T.suggestName('a/b:c*d?e"f<g>h|i', 'txt') === 'a_b_c_d_e_f_g_h_i.txt');
  check('ชื่อว่างไม่ได้ไฟล์ชื่อ ".pdf"', T.suggestName('', 'pdf') === 'export.pdf');
  check('ชื่อที่มีแต่ช่องว่างก็ไม่ว่าง', T.suggestName('   ', 'pdf') === 'export.pdf');
}

console.log(`\nexport-hub: PASS ${pass}  FAIL ${fail}`);
if (fail) process.exit(1);
