// test/speech-split.test.cjs — แยกบทพูดออกจากคำบรรยาย (alpha.123)
//
// กติกาที่สำคัญที่สุดคือข้อ 1: **ต่อกันแล้วต้องได้ข้อความเดิมเป๊ะ**
// ถ้าพลาด = ตัวอักษรหายจากหน้าจอโดยไม่มีใครสังเกต จนกว่าจะมีคนอ่านทวนทั้งบท
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(rel, out) {
  const file = path.join(os.tmpdir(), out);
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', rel)], outfile: file,
                      format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(file);
}
const S = load('src/speech-split.js', '_speech_split.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  x FAIL:', n, i ? ':: ' + i : ''); } };

/** กติกาข้อ 1 — ใช้กับทุกเคสในไฟล์นี้ */
const joins = (txt) => S.splitSpeech(txt).map((p) => p.text).join('') === String(txt || '');

// ═══════════ 1. พื้นฐาน ═══════════
{
  const txt = 'เขาหันมา "สวัสดีครับ" แล้วก้มหัว';
  const parts = S.splitSpeech(txt);
  check('แยกเป็นสามก้อน', parts.length === 3, JSON.stringify(parts));
  check('ก้อนกลางคือบทพูด',
        parts[1].kind === S.KIND_SPEECH && parts[1].text === '"สวัสดีครับ"');
  check('ก้อนหัว-ท้ายคือคำบรรยาย',
        parts[0].kind === S.KIND_NARRATION && parts[2].kind === S.KIND_NARRATION);
  check('★ ต่อกันแล้วได้ข้อความเดิมเป๊ะ', joins(txt));
  check('รู้ว่ามีบทพูด', S.hasSpeech(txt) === true);
  check('ไม่มีเครื่องหมายคำพูด = ไม่มีบทพูด', S.hasSpeech('เดินไปเรื่อย ๆ') === false);
}

// ═══════════ 2. เครื่องหมายหลายชุด ═══════════
{
  check('โค้งอังกฤษ', S.splitSpeech('ก “สวัสดี” ข')[1].text === '“สวัสดี”');
  check('ญี่ปุ่น', S.splitSpeech('ก 「สวัสดี」 ข')[1].text === '「สวัสดี」');
  check('ฝรั่งเศส', S.splitSpeech('ก «สวัสดี» ข')[1].text === '«สวัสดี»');
  // จงใจไม่รองรับ single quote — ไม่งั้น apostrophe ทำให้ครึ่งประโยคกลายเป็นบทพูด
  const apo = "He didn't say Kai's name";
  check('★ apostrophe ไม่กลายเป็นบทพูด', S.hasSpeech(apo) === false, JSON.stringify(S.splitSpeech(apo)));
  check('★ ต่อกันแล้วได้เดิม (หลายชุด)', joins('ก “ข” ค 「ง」 จ «ฉ» ช'));
}

// ═══════════ 3. เคสที่พังง่าย ═══════════
{
  // กติกาข้อ 2 — เปิดแล้วไม่ปิด ห้ามลากยาวกลายเป็นตัวเอียงทั้งบท
  const open = 'เขาพูดว่า "ยังไม่ปิดเลย และเล่าต่อไปอีกยาว';
  check('★ เปิดค้างไม่ถือเป็นบทพูด', S.hasSpeech(open) === false);
  check('★ เปิดค้างแล้วข้อความยังครบ', joins(open));

  // คำพูดข้ามบรรทัด = มักแปลว่าลืมปิด ไม่ใช่ประโยคยาว
  const multi = 'เขาพูดว่า "บรรทัดแรก\nบรรทัดสอง" จบ';
  check('★ ไม่ลากข้ามบรรทัด', S.hasSpeech(multi) === false, JSON.stringify(S.splitSpeech(multi)));
  check('★ ข้ามบรรทัดแล้วข้อความยังครบ', joins(multi));

  check('บทพูดติดกันหลายอัน',
        S.splitSpeech('"ก" "ข"').filter((p) => p.kind === S.KIND_SPEECH).length === 2);
  check('บทพูดล้วนไม่มีคำบรรยาย', S.splitSpeech('"ก"').length === 1);
  check('เครื่องหมายเปล่า ๆ ก็ยังไม่ล้ม', joins('""') && joins('"'));
  check('ว่าง/นัลล์ = ไม่มีอะไร',
        S.splitSpeech('').length === 0 && S.splitSpeech(null).length === 0);
  check('ข้อความยาวไม่มีคำพูด = ก้อนเดียว', S.splitSpeech('ก'.repeat(500)).length === 1);
}

// ═══════════ 4. เตรียมข้อมูลให้ระบบเสียง ═══════════
{
  check('ถอดเครื่องหมายออกได้', S.stripQuotes({ text: '"สวัสดี"' }) === 'สวัสดี');
  check('ถอดของญี่ปุ่นได้', S.stripQuotes({ text: '「สวัสดี」' }) === 'สวัสดี');
  check('ไม่มีเครื่องหมาย = คืนเดิม', S.stripQuotes({ text: 'สวัสดี' }) === 'สวัสดี');
  check('รับสตริงตรง ๆ ก็ได้', S.stripQuotes('"ก"') === 'ก');

  const parts = S.speechParts('เขาหันมา "สวัสดีครับ" แล้วก้มหัว');
  check('ก้อนพูดพก say ที่ถอดเครื่องหมายแล้ว',
        parts.find((p) => p.kind === S.KIND_SPEECH).say === 'สวัสดีครับ');
  check('ก้อนบรรยาย say = ข้อความที่ตัดช่องว่างแล้ว',
        parts[0].say === 'เขาหันมา');
  check('ก้อนที่เหลือแต่ช่องว่างถูกตัดทิ้ง',
        S.speechParts('  "ก"  ').length === 1);
}

console.log(fail ? `FAIL ${fail} / PASS ${pass}` : `ALL OK (${pass})`);
process.exit(fail ? 1 : 0);
