// test/export-name.test.cjs — unit test "ชื่อไฟล์ส่งออกที่ตั้งเองได้" (alpha.132 ข้อ 6)
//
// สัญญาที่ผูกไว้ถาวร:
//   · ค่าเริ่มต้น = พฤติกรรมเดิมเป๊ะ (`<ชื่อเรื่อง>.<นามสกุล>`) — อัปเกรดแล้วต้องไม่มีอะไรเปลี่ยน
//   · ชื่อที่ออกมา **เขียนลงดิสก์ได้จริงทุกระบบ** (ใช้กฎเข้มของ Windows ชุดเดียวทุกแพลตฟอร์ม
//     ไม่งั้นไฟล์ที่สร้างบนแมคย้ายมาเปิดบนวินโดวส์ไม่ได้ ซึ่งผิดหลัก "พกพาได้")
//   · โค้ดสั้นที่ไม่รู้จัก **ไม่หายเงียบ ๆ** — โผล่ในช่องตัวอย่างให้ผู้ใช้เห็นว่าพิมพ์ผิด
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-exportname-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'export-name.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const N = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const CTX = {
  title: 'ดาวเหนือฟ้ากว้าง', author: 'ท็อป', book: 'เล่มหนึ่ง', chapter: 'บทที่ 3',
  words: 1234, now: new Date(2026, 8, 4),
};

// ───────── ค่าเริ่มต้นต้องเท่าของเดิม ─────────
check('★★ ค่าเริ่มต้นให้ผลเท่าพฤติกรรมเดิม (ชื่อเรื่อง + นามสกุล)',
      N.buildExportName(N.DEFAULT_EXPORT_NAME, CTX, 'pdf') === 'ดาวเหนือฟ้ากว้าง.pdf',
      N.buildExportName(N.DEFAULT_EXPORT_NAME, CTX, 'pdf'));
check('เทมเพลตว่าง = ตกไปใช้ค่าเริ่มต้น ไม่ใช่ชื่อไฟล์ว่าง',
      N.buildExportName('', CTX, 'pdf') === 'ดาวเหนือฟ้ากว้าง.pdf',
      N.buildExportName('', CTX, 'pdf'));
check('นามสกุลที่มีจุดนำหน้าก็รับได้ (ไม่ได้จุดสองอัน)',
      N.buildExportName('[title]', CTX, '.md') === 'ดาวเหนือฟ้ากว้าง.md',
      N.buildExportName('[title]', CTX, '.md'));

// ───────── โค้ดสั้น ─────────
check('★ ใช้โค้ดสั้นหลายตัวรวมกันได้',
      N.buildExportName('[title] - [book] - [author]', CTX, 'pdf')
        === 'ดาวเหนือฟ้ากว้าง - เล่มหนึ่ง - ท็อป.pdf',
      N.buildExportName('[title] - [book] - [author]', CTX, 'pdf'));
check('★ วันที่แบบ iso ใช้ได้ (ตัวหลักที่ผู้ใช้ต้องการตอนส่งงานหลายรอบ)',
      N.buildExportName('[title] [date:iso]', CTX, 'pdf') === 'ดาวเหนือฟ้ากว้าง 2026-09-04.pdf',
      N.buildExportName('[title] [date:iso]', CTX, 'pdf'));
check('จำนวนคำก็ใส่ในชื่อไฟล์ได้',
      N.buildExportName('[title] [words]w', CTX, 'txt') === 'ดาวเหนือฟ้ากว้าง 1234w.txt');
check('★★ โค้ดที่ไม่รู้จักโผล่ให้เห็น ไม่หายเงียบ ๆ (กฎ "ไม่มี fallback")',
      N.buildExportName('[title] [titel]', CTX, 'pdf').includes('[titel]'),
      N.buildExportName('[title] [titel]', CTX, 'pdf'));

// ───────── กรองอักขระต้องห้าม ─────────
check('★★ อักขระต้องห้ามของ Windows ถูกแทนด้วย _ (ท่าเดิมของ suggestName)',
      N.sanitizeFileBase('a/b\\c:d*e?f"g<h>i|j') === 'a_b_c_d_e_f_g_h_i_j',
      N.sanitizeFileBase('a/b\\c:d*e?f"g<h>i|j'));
check('ขีดกลางกับช่องว่างยังอยู่ (พรีเซ็ตที่แถมมาใช้ทั้งสองตัว)',
      N.sanitizeFileBase('ชื่อ - เล่ม') === 'ชื่อ - เล่ม', N.sanitizeFileBase('ชื่อ - เล่ม'));
check('ช่องว่างซ้อนถูกยุบเหลือช่องเดียว', N.sanitizeFileBase('a    b') === 'a b');
check('★ จุด/ช่องว่างท้ายชื่อถูกตัด (Windows ตัดทิ้งเงียบ ๆ อยู่แล้ว — ตัวอย่างต้องตรงกับของจริง)',
      N.sanitizeFileBase('ชื่อไฟล์...  ') === 'ชื่อไฟล์', N.sanitizeFileBase('ชื่อไฟล์...  '));
check('★ ชื่อที่ Windows สงวนไว้ถูกเติมท้ายให้ใช้ได้',
      N.sanitizeFileBase('CON') === 'CON_' && N.sanitizeFileBase('nul') === 'nul_');
check('★ ไม่เหลือตัวอักษรจริงเลย = ชื่อสำรอง ไม่ใช่ไฟล์ชื่อ "___"',
      N.sanitizeFileBase('///') === 'export' && N.sanitizeFileBase('') === 'export'
        && N.sanitizeFileBase('   ') === 'export',
      N.sanitizeFileBase('///'));
check('ชื่อยาวเกินถูกตัดตามขีดจำกัด',
      N.sanitizeFileBase('ก'.repeat(400)).length === N.NAME_MAX,
      N.sanitizeFileBase('ก'.repeat(400)).length);
check('★ ชื่อเรื่องที่มี / ในตัว ไม่ทำให้ได้เส้นทางโฟลเดอร์ใหม่',
      N.buildExportName('[title]', { title: 'ภาค 1/2' }, 'pdf') === 'ภาค 1_2.pdf',
      N.buildExportName('[title]', { title: 'ภาค 1/2' }, 'pdf'));

// ───────── พรีเซ็ตที่แถมมา ─────────
check('มีพรีเซ็ตแถมมาอย่างน้อย 5 แบบ', N.BUILTIN_NAME_PRESETS.length >= 5);
check('★ พรีเซ็ตแถมมาทุกตัวสร้างชื่อไฟล์ที่ใช้ได้จริง (ไม่มีตัวไหนคืน export ล้วน)',
      N.BUILTIN_NAME_PRESETS.every((p) => {
        const n = N.buildExportName(p.template, CTX, 'pdf');
        return n.endsWith('.pdf') && n !== 'export.pdf' && !/[\\/:*?"<>|]/.test(n);
      }),
      N.BUILTIN_NAME_PRESETS.map((p) => N.buildExportName(p.template, CTX, 'pdf')).join(' · '));
check('พรีเซ็ตแถมมาทุกตัวมีคีย์ป้ายชื่อและ id ไม่ซ้ำ',
      N.BUILTIN_NAME_PRESETS.every((p) => p.id && p.labelKey && p.template)
        && new Set(N.BUILTIN_NAME_PRESETS.map((p) => p.id)).size === N.BUILTIN_NAME_PRESETS.length);

// ───────── พรีเซ็ตของผู้ใช้ ─────────
check('normalizeExportName: ไม่เคยตั้งค่า = ได้ค่าเริ่มต้น',
      JSON.stringify(N.normalizeExportName(undefined))
        === JSON.stringify({ template: N.DEFAULT_EXPORT_NAME, presets: [], openAfter: false }),
      JSON.stringify(N.normalizeExportName(undefined)));
// ★ [alpha.132r3] "เปิดไฟล์เมื่อส่งออกเสร็จ" — ค่าเริ่มต้นต้อง **ปิด** (ไม่เด้งอะไรโดยไม่ได้ขอ)
check('★ เปิดไฟล์เมื่อเสร็จ: ค่าเริ่มต้นปิด · ต้องเป็น true เป๊ะเท่านั้นถึงจะเปิด',
      N.normalizeExportName({}).openAfter === false
        && N.normalizeExportName({ openAfter: true }).openAfter === true
        && N.normalizeExportName({ openAfter: 'yes' }).openAfter === false,
      JSON.stringify(N.normalizeExportName({ openAfter: 'yes' })));
check('★ บันทึกเทมเพลตแล้วค่า "เปิดไฟล์เมื่อเสร็จ" ไม่หายไปด้วย',
      N.normalizeExportName({ ...N.normalizeExportName({ openAfter: true }), template: '[book]' })
        .openAfter === true);
check('normalizeExportName: แถวขยะถูกโยนทิ้ง',
      JSON.stringify(N.normalizeExportName({ presets: [{ name: 'a', template: '[title]' },
                                                       { name: '', template: 'x' }, null, 5] }).presets)
        === JSON.stringify([{ name: 'a', template: '[title]' }]));
check('normalizeExportName: ชื่อซ้ำเหลือตัวเดียว',
      N.normalizeExportName({ presets: [{ name: 'a', template: '1' }, { name: 'a', template: '2' }] })
        .presets.length === 1);
check('บันทึกพรีเซ็ต: ชื่อใหม่ = เพิ่มแถว',
      N.saveNamePreset([], 'ส่งบก.', '[title] [date:iso]').length === 1);
check('★ บันทึกพรีเซ็ต: ชื่อซ้ำ = เขียนทับ ไม่เพิ่มแถวใหม่',
      (() => { const r = N.saveNamePreset([{ name: 'a', template: '1' }], 'a', '2');
               return r.length === 1 && r[0].template === '2'; })());
check('บันทึกพรีเซ็ต: ชื่อหรือเทมเพลตว่าง = ไม่เพิ่ม',
      N.saveNamePreset([], '', '[title]').length === 0
        && N.saveNamePreset([], 'a', '  ').length === 0);
check('ลบพรีเซ็ตตามชื่อได้',
      N.deleteNamePreset([{ name: 'a', template: '1' }, { name: 'b', template: '2' }], 'a')
        .map((p) => p.name).join() === 'b');
check('บันทึกพรีเซ็ตเกินขีดจำกัดไม่ได้',
      N.saveNamePreset(Array.from({ length: N.NAME_PRESET_MAX },
                                  (_, i) => ({ name: 'p' + i, template: '[title]' })),
                       'ตัวใหม่', '[title]').length === N.NAME_PRESET_MAX);

console.log('\nexport-name: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
