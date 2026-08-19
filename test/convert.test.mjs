// test/convert.test.mjs — แปลงเอกสารข้ามโหมด นิยาย ↔ บทหนัง (alpha.87)
//
// สิ่งที่ต้องกันไม่ให้กลับมาอีก: สลับโหมดแล้วบันทึก = งานเสียถาวร
//   `> ยกคำพูด` → `>> ยกคำพูด`   ·   `- ข้อหนึ่ง` → `@- ข้อหนึ่ง`
// เทสนี้เรียกเอนจินจริงทั้งหมด (md.js + fountain.js) ไม่มี stub

import { convertBody, lossReport, rleEncode, rleDecode, FWD, REV,
         proseBlocks, scriptBlocks, kindLabel } from '../src/convert.js';
import { parseScript, blocksToMd } from '../src/fountain.js';

/** รูปมาตรฐานที่ "บันทึกเฉย ๆ" ในโหมดบทจะได้ — สลับโหมดต้องไม่เปลี่ยนอะไรเกินกว่านี้ */
const canonical = (s) => blocksToMd(parseScript(s).map((b) => ({ el: b.el, text: b.text })));

let pass = 0, fail = 0;
const check = (n, c, extra) => {
  if (c) { pass++; console.log('PASS ' + n); }
  else { fail++; console.log('FAIL ' + n + (extra !== undefined ? '\n     | ' + extra : '')); }
};
const eq = (n, got, want) => check(n, got === want, 'ได้ ' + JSON.stringify(got) + '\n     | ควรเป็น ' + JSON.stringify(want));

// ───────── RLE ─────────
eq('RLE เข้ารหัส', rleEncode(['S', 'A', 'A', 'A', 'C', 'D']), 'SA3CD');
eq('RLE ถอดรหัสกลับได้เท่าเดิม', rleDecode('SA3CD').join(''), 'SAAACD');
eq('RLE ว่าง', rleEncode([]), '');
check('RLE ไป-กลับปิดวงกับชุดยาว', (() => {
  const src = 'SAAACDPDAACDTZZZS'.split('');
  return rleDecode(rleEncode(src)).join('') === src.join('');
})());
check('spMap ของฉาก 60 บล็อกอยู่ในหลักร้อยไบต์', (() => {
  const codes = Array.from({ length: 60 }, (_, i) => 'SACDPT'[i % 6]);
  return rleEncode(codes).length <= 120;
})(), rleEncode(Array.from({ length: 60 }, (_, i) => 'SACDPT'[i % 6])).length + ' ไบต์');

// ───────── ตารางแมป ─────────
eq('h3 → หัวฉาก', FWD.h3, 'scene');
eq('ยกคำพูด → บรรยาย (ไม่ใช่ทรานซิชัน)', FWD.quote, 'action');
eq('รายการ → บรรยาย', FWD.ul, 'action');
eq('`---` → ขึ้นหน้าใหม่', FWD.hr, 'page-break');
eq('โค้ด → raw', FWD.code, 'raw');
eq('หัวฉาก → h3', REV.scene, 'h3');
eq('ฉากย่อย → h3', REV.subheader, 'h3');
eq('ช็อต → h3', REV.shot, 'h3');
eq('ตอน → h2', REV['act-break'], 'h2');
eq('ชื่อตัวละคร → ย่อหน้าหนา', REV.character, 'pbold');
eq('ย่อหน้าหนา → ชื่อตัวละคร (ไปทั้งสองทิศ)', FWD.pbold, 'character');
eq('ย่อหน้าเอียง → บรรยาย (ขาไป — วงเล็บทำให้ข้อความเพี้ยน)', FWD.pitalic, 'action');
eq('วงเล็บ → ย่อหน้าเอียง', REV.parenthetical, 'pitalic');
eq('บทพูด → ย่อหน้า', REV.dialogue, 'p');
eq('บรรยาย → ย่อหน้า', REV.action, 'p');
eq('ทรานซิชัน → ย่อหน้าชิดขวา', REV.transition, 'pright');
eq('ขึ้นหน้าใหม่ → เส้นคั่น', REV['page-break'], 'hr');
check('ทุกชนิดของบทมีทางกลับ', Object.keys(REV).length >= 20, Object.keys(REV).length);
check('ป้ายไทยมีครบทั้งสองฝั่ง',
      kindLabel('h3') === 'หัวข้อ 3' && kindLabel('scene') === 'หัวฉาก');

// ───────── นิยาย → บท → นิยาย : ต้องได้ไบต์เดิมเป๊ะ ─────────
const prose = [
  '# ตอนที่ 1',
  '',
  '### ฉากแรก',
  '',
  '> "ผมไม่เคยลืมเลย" เขาพูด',
  '',
  'ย่อหน้าธรรมดา **หนา** *เอียง* และ _ขีดเส้นใต้_',
  '',
  '- ข้อหนึ่ง',
  '- ข้อสอง',
  '',
  '1. เลขหนึ่ง',
  '',
  'ส่งอีเมลถึง @somchai ด่วน',
  '',
  '**สมชาย**',
  '*กระซิบ*',
  '',
  '---',
  '',
  '![รูป](a.png)',
  '',
  '#### หัวข้อย่อย',
].join('\n');

const toSp = convertBody(prose, 'screenplay', {});
eq('นิยาย→บท ใช้ตารางแปลง (ยังไม่เคยจดอะไรไว้)', toSp.mode, 'table');
check('ยกคำพูดไม่กลายเป็นทรานซิชัน `>>`', !/^>>/m.test(toSp.body), toSp.body);
check('รายการไม่กลายเป็นชื่อตัวละคร `@-`', !/^@-/m.test(toSp.body), toSp.body);
check('`@somchai` กลางย่อหน้าไม่ทำให้ทั้งย่อหน้ากลายเป็นชื่อตัวละคร',
      !/^@ส่งอีเมล/m.test(toSp.body), toSp.body);
check('บันทึก spMap ไว้ (รหัสตัวเล็ก = ชนิดนิยาย)',
      !!toSp.spMap && toSp.spMap === toSp.spMap.replace(/[A-Z]/g, ''), toSp.spMap);
check('spMap ไม่ใช่สำเนาเนื้อหา (สั้นกว่าเนื้อหามาก)',
      toSp.spMap.length < prose.length / 4, toSp.spMap.length + ' vs ' + prose.length);

const spBlocks = scriptBlocks(toSp.body);
eq('หัวฉากถูกอ่านเป็นหัวฉากจริงในโหมดบท',
   spBlocks.filter((b) => b.kind === 'scene').map((b) => b.text).join('|'), 'ฉากแรก');
check('ย่อหน้าหนากลายเป็นชื่อตัวละคร',
      spBlocks.some((b) => b.kind === 'character' && b.text === 'สมชาย'),
      JSON.stringify(spBlocks.map((b) => b.kind + ':' + b.text)));
// เอียงไปเป็นวงเล็บไม่ได้ — วัดแล้วเสียข้อความ (ลอย ๆ = โน้ต · ใต้ตัวละคร = ได้วงเล็บติดข้อความ)
// จึงเป็นบรรยายที่เก็บ `*` ไว้ · ขากลับยังคืนวงเล็บเป็นย่อหน้าเอียงครบ (เทสข้างล่าง)
check('ย่อหน้าเอียงยังเป็นบรรยาย และมาร์กเอียงไม่หาย',
      spBlocks.some((b) => b.kind === 'action' && b.text === '*กระซิบ*'));
check('มาร์กกลางย่อหน้าไม่หาย',
      spBlocks.some((b) => b.text.includes('**หนา**') && b.text.includes('*เอียง*')));
check('`---` กลายเป็นขึ้นหน้าใหม่', spBlocks.some((b) => b.kind === 'page-break'));

const back = convertBody(toSp.body, 'prose', { spMap: toSp.spMap, spHash: toSp.spHash });
eq('บท→นิยาย เมื่อยังไม่มีใครแก้ = ชั้น 1 (คืนเป๊ะ)', back.mode, 'exact');
eq('**เนื้อหากลับมาเหมือนเดิมทุกไบต์**', back.body, prose);

// ───────── ชั้น 2 : แก้เนื้อความแล้ว แต่จำนวนบล็อกเท่าเดิม ─────────
const edited = toSp.body.replace('ฉากแรก', 'ฉากแรกที่แก้แล้ว');
check('การแก้ทดสอบเปลี่ยนเนื้อจริง', edited !== toSp.body);
const back2 = convertBody(edited, 'prose', { spMap: toSp.spMap, spHash: toSp.spHash });
eq('แก้แล้วแต่โครงเท่าเดิม = ชั้น 2', back2.mode, 'map');
eq('ชั้น 2 คืนชนิดถูกและเก็บข้อความที่แก้ไว้',
   back2.body, prose.replace('ฉากแรก', 'ฉากแรกที่แก้แล้ว'));

// ───────── ชั้น 3 : โครงเปลี่ยน (เพิ่มบล็อก) ─────────
const grown = toSp.body + '\n\n@โทระ\nสวัสดีครับ';
const back3 = convertBody(grown, 'prose', { spMap: toSp.spMap, spHash: toSp.spHash });
eq('เพิ่มบล็อกจนโครงเปลี่ยน = ชั้น 3', back3.mode, 'table');
check('ชั้น 3 ยังได้ข้อความใหม่ครบ',
      back3.body.includes('**โทระ**') && back3.body.includes('สวัสดีครับ'), back3.body);
check('ชั้น 3 ไม่ทำข้อความเดิมหาย',
      back3.body.includes('"ผมไม่เคยลืมเลย" เขาพูด') && back3.body.includes('- ข้อสอง'));

// ───────── บท → นิยาย → บท ─────────
const script = [
  '### INT. ห้องนอน - กลางคืน',
  '',
  '!โทระนั่งอยู่ริมหน้าต่าง',
  '',
  '@โทระ',
  '((กระซิบ))',
  'ผมไม่เคยลืมเลย',
  '',
  '>> CUT TO:',
  '',
  '#### หน้าบ้าน',
  '',
  '! มุมกว้างเห็นทั้งซอย',
  '',
  '$act องก์สอง',
  '',
  '---',
].join('\n');

const toProse = convertBody(script, 'prose', {});
eq('บท→นิยาย ใช้ตารางแปลง', toProse.mode, 'table');
check('บันทึก spMap ไว้ (รหัสตัวใหญ่ = ชนิดบท)',
      !!toProse.spMap && toProse.spMap === toProse.spMap.replace(/[a-z]/g, ''), toProse.spMap);
check('หัวฉากกลายเป็น h3', /^### INT\. ห้องนอน - กลางคืน$/m.test(toProse.body), toProse.body);
check('ชื่อตัวละครกลายเป็นย่อหน้าหนา', /^\*\*โทระ\*\*$/m.test(toProse.body), toProse.body);
check('วงเล็บกลายเป็นย่อหน้าเอียง', /^\*\(กระซิบ\)\*$/m.test(toProse.body), toProse.body);
check('ฉากย่อยกลายเป็น h3', /^### หน้าบ้าน$/m.test(toProse.body), toProse.body);
check('ช็อตกลายเป็น h3', /^### มุมกว้างเห็นทั้งซอย$/m.test(toProse.body), toProse.body);
check('ตอนกลายเป็น h2', /^## องก์สอง$/m.test(toProse.body), toProse.body);
check('ขึ้นหน้าใหม่กลายเป็น `---`', /^---$/m.test(toProse.body), toProse.body);
check('ทรานซิชันเป็นย่อหน้าธรรมดา + จดชิดขวาไว้ใน align',
      /^CUT TO:$/m.test(toProse.body) && Object.values(toProse.align || {}).includes('right'),
      toProse.body + '\n' + JSON.stringify(toProse.align));

const backSp = convertBody(toProse.body, 'screenplay', { spMap: toProse.spMap, spHash: toProse.spHash });
eq('บท→นิยาย→บท เมื่อยังไม่มีใครแก้ = ชั้น 1', backSp.mode, 'exact');
eq('**บทกลับมาเหมือนเดิมทุกไบต์** (เท่ากับที่การบันทึกธรรมดาจะเขียน)',
   backSp.body, canonical(script));
eq('สลับไป-กลับไม่เปลี่ยนชนิดของบล็อกสักตัว',
   scriptBlocks(backSp.body).map((b) => b.kind).join(','),
   scriptBlocks(script).map((b) => b.kind).join(','));
eq('สลับไป-กลับไม่เปลี่ยนข้อความสักตัว',
   scriptBlocks(backSp.body).map((b) => b.text).join('|'),
   scriptBlocks(script).map((b) => b.text).join('|'));

// ───────── จำนวนบล็อกต้องไม่หายระหว่างทาง ─────────
eq('นิยาย→บท จำนวนบล็อกเท่าเดิม',
   scriptBlocks(toSp.body).length, proseBlocks(prose).length);
eq('บท→นิยาย จำนวนบล็อกเท่าเดิม',
   proseBlocks(toProse.body).length, scriptBlocks(script).length);

// ───────── รายงานสิ่งที่จะเสีย (กล่องยืนยันชั้น 3) ─────────
const lost = lossReport(prose, 'screenplay');
check('รายงานบอกว่ายกคำพูดจะกลายเป็นย่อหน้า',
      lost.some((x) => x.from === 'quote' && x.to === 'p'), JSON.stringify(lost));
check('รายงานบอกว่ารายการจะกลายเป็นย่อหน้า',
      lost.some((x) => x.from === 'ul' && x.to === 'p'), JSON.stringify(lost));
check('รายงานบอกว่า h1 จะกลายเป็น h2', lost.some((x) => x.from === 'h1' && x.to === 'h2'));
check('รายงานไม่บ่นถึงชนิดที่กลับได้ครบ',
      !lost.some((x) => x.from === 'h3' || x.from === 'p' || x.from === 'blank'),
      JSON.stringify(lost));
check('รายงานเรียงจากมากไปน้อย',
      lost.every((x, i) => i === 0 || lost[i - 1].n >= x.n));
check('เอกสารที่แปลงได้ครบไม่มีรายการเสีย',
      lossReport('### ฉาก\n\nย่อหน้า\n', 'screenplay').length === 0,
      JSON.stringify(lossReport('### ฉาก\n\nย่อหน้า\n', 'screenplay')));

// ───────── ขอบ ─────────
eq('เอกสารว่างไม่พัง', convertBody('', 'screenplay', {}).body, '');
check('spMap ที่ผิดคำศัพท์ (ตัวพิมพ์ผิดฝั่ง) ถูกปฏิเสธ ไม่เอามาใช้มั่ว',
      convertBody(toSp.body, 'prose', { spMap: 'a3b', spHash: 'x' }).mode === 'table');
check('spMap ที่ยาวไม่ตรงจำนวนบล็อกถูกปฏิเสธ',
      convertBody(toSp.body, 'prose', { spMap: 'S2', spHash: 'x' }).mode === 'table');

console.log(`\nconvert: ${pass} ผ่าน · ${fail} ไม่ผ่าน`);
if (fail) process.exit(1);
