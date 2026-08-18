// test/dialogue-builder.test.cjs — [alpha.82] เอนจินห้องซ้อมบท
// กฎเลือกคนพูดกับการประกอบ prompt ผิดแล้วมองไม่เห็นด้วยตา (มันไปโผล่ที่คุณภาพบทพูด)
// → เทสตัวนี้คือที่เดียวที่พิสูจน์ได้ว่าตัวละครเห็นอะไรบ้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_dlgbuilder.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/dialogue/builder-core.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const B = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// คณะทดสอบมาตรฐาน — 3 ตัว (ครอบทั้งเคสปิงปองและเคสวง)
function mkSession(n = 3, patch = {}) {
  B._resetIds();
  const names = ['โทระ', 'แคสซี่', 'ลูน่า', 'นาซาเรน่า', 'ไคลี'];
  const s = B.newSession({ situation: 'นั่งดื่มที่ลานเบียร์หลังเลิกงาน', ...patch });
  for (let i = 0; i < n; i++) B.addCast(s, { name: names[i], blurb: 'คำโปรย' + i });
  return s;
}
const ids = (s) => s.cast.map((c) => c.id);

// ═══════════ โครงข้อมูล ═══════════
{
  const s = mkSession(3);
  check('สร้างคณะได้ 3 ตัว', s.cast.length === 3);
  check('id ไม่ซ้ำ', new Set(ids(s)).size === 3);
  check('เวอร์ชันติดมากับเซสชัน', s.v === B.BUILDER_VERSION);

  const s5 = mkSession(5);
  check('ครบ 5 ตัวได้', s5.cast.length === 5);
  check('เกิน 5 ไม่ได้ (คืน null)', B.addCast(s5, { name: 'เกิน' }) === null && s5.cast.length === 5);

  const [a, b] = ids(s);
  B.setRel(s, a, b, { how: 'แฟนใหม่', callThem: 'เธอ' });
  check('ตั้งความสัมพันธ์ได้', B.relOf(s, a, b).how === 'แฟนใหม่');
  check('ความสัมพันธ์มีทิศทาง — ฝั่งกลับยังว่าง', B.relOf(s, b, a) === null);
  B.setRel(s, a, b, { how: '', callThem: '' });
  check('ล้างค่าว่างทั้งคู่ = ลบแถวทิ้ง ไม่เก็บแถวเปล่า', B.relOf(s, a, b) === null && s.rels.length === 0);

  B.setRel(s, a, b, { how: 'เพื่อน' });
  B.setRel(s, b, a, { how: 'เพื่อน' });
  B.removeCast(s, b);
  check('ถอดคนออก → คณะเหลือ 2', s.cast.length === 2);
  check('ถอดคนออก → ความสัมพันธ์ที่อ้างถึงเขาหายหมด', s.rels.length === 0);
  check('ถอดคนที่ไม่มี = false', B.removeCast(s, 'ไม่มีตัวนี้') === false);
}

// ═══════════ session แยกขาดจาก preset (ข้อ 3 ของหลักคิด) ═══════════
{
  B._resetIds();
  const p = B.newPreset({ name: 'คณะลานเบียร์' });
  B.addCast(p, { name: 'โทระ', persona: 'ใบเดิม' });
  const s = B.sessionFromPreset(p, { situation: 'ทดสอบ' });
  check('สำเนา cast ลง session', s.cast.length === 1 && s.cast[0].persona === 'ใบเดิม');
  check('จำที่มาไว้เป็นชื่อ ไม่ใช่การผูก', s.presetName === 'คณะลานเบียร์');
  p.cast[0].persona = 'ใบใหม่';
  check('แก้ preset ทีหลังไม่ย้อนไปเปลี่ยน session', s.cast[0].persona === 'ใบเดิม');
}

// ═══════════ กฎเลือกคนพูด ═══════════
{
  const s = mkSession(2);
  const [A, C] = ids(s);
  check('ยังไม่มีเทิร์น → คนแรกพูดกับคนที่สอง',
        JSON.stringify(B.nextPair(s)) === JSON.stringify({ speaker: A, listener: C }));

  s.turns.push(B.newTurn({ speaker: A, listener: C, text: 'สวัสดี' }));
  const p1 = B.nextPair(s);
  check('ปิงปอง: A→B แล้วเด้งเป็น B→A', p1.speaker === C && p1.listener === A);

  s.turns.push(B.newTurn({ speaker: C, listener: A, text: 'ว่าไง' }));
  const p2 = B.nextPair(s);
  check('ปิงปองต่อ: กลับมา A→B', p2.speaker === A && p2.listener === C);
}
{
  // เคสที่พังถ้าไม่ดัก — A พูดกับทุกคน แล้วใครสวน
  const s2 = mkSession(2);
  const [A2, B2] = ids(s2);
  s2.turns.push(B.newTurn({ speaker: A2, listener: B.ALL_LISTEN, text: 'เฮ้ยทุกคน' }));
  const q = B.nextPair(s2);
  check('2 คน + พูดกับทุกคน → อีกคนสวน (ไม่ต้องใช้ AI)', q.speaker === B2 && q.listener === A2);

  const s5 = mkSession(4);
  const idsA = ids(s5);
  s5.turns.push(B.newTurn({ speaker: idsA[0], listener: B.ALL_LISTEN, text: 'เฮ้ยทุกคน' }));
  const q5 = B.nextPair(s5);
  check('วงใหญ่ + พูดกับทุกคน → ให้ AI เลือกคนสวน', q5.speaker === B.AI_PICK && q5.listener === idsA[0]);
}
{
  const s = mkSession(3, { policy: 'round' });
  const [A, C, D] = ids(s);
  s.turns.push(B.newTurn({ speaker: A, listener: B.ALL_LISTEN, text: 'x' }));
  check('วนตามลำดับ: A → คนถัดไป', B.nextPair(s).speaker === C);
  s.turns.push(B.newTurn({ speaker: D, listener: B.ALL_LISTEN, text: 'y' }));
  check('วนตามลำดับ: คนสุดท้าย → วนกลับคนแรก', B.nextPair(s).speaker === A);
  check('วนตามลำดับ: ผู้ฟัง = ทุกคน', B.nextPair(s).listener === B.ALL_LISTEN);
}
{
  const s = mkSession(3, { policy: 'random' });
  s.turns.push(B.newTurn({ speaker: ids(s)[0], listener: ids(s)[1], text: 'x' }));
  check('โหมดสุ่ม → ช่องคนพูดเป็นค่าสุ่ม', B.nextPair(s).speaker === B.ANY_RANDOM);

  const s2 = mkSession(3, { policy: 'ai' });
  s2.turns.push(B.newTurn({ speaker: ids(s2)[0], listener: ids(s2)[1], text: 'x' }));
  check('โหมด AI → ช่องคนพูดเป็นค่าให้ AI เลือก', B.nextPair(s2).speaker === B.AI_PICK);

  const s3 = mkSession(3, { policy: 'manual', next: { speaker: 'zz', listener: 'yy' } });
  s3.turns.push(B.newTurn({ speaker: ids(s3)[0], listener: ids(s3)[1], text: 'x' }));
  check('โหมดกำหนดเอง → ไม่เด้ง คงคู่เดิมในช่อง', B.nextPair(s3).speaker === 'zz');
}

// ═══════════ resolvePair — สุ่มต้องคาดเดาได้ในเทส ═══════════
{
  const s = mkSession(3);
  const [A, C, D] = ids(s);
  s.turns.push(B.newTurn({ speaker: A, listener: C, text: 'x' }));

  const r0 = B.resolvePair(s, { speaker: B.ANY_RANDOM, listener: A }, () => 0);
  check('สุ่มไม่ซ้ำคนที่เพิ่งพูด', r0.speaker !== A && [C, D].includes(r0.speaker), r0.speaker);
  const r1 = B.resolvePair(s, { speaker: B.ANY_RANDOM, listener: A }, () => 0.99);
  check('rnd สูงสุดยังอยู่ในช่วง (ไม่หลุด undefined)', [C, D].includes(r1.speaker), r1.speaker);

  const r2 = B.resolvePair(s, { speaker: A, listener: B.ANY_RANDOM }, () => 0);
  check('ผู้ฟังสุ่มไม่ตรงกับคนพูด', r2.listener !== A);

  const r3 = B.resolvePair(s, { speaker: B.AI_PICK, listener: A });
  check('ค่าให้ AI เลือก → ติดธง needAi', r3.needAi === true);
  const r4 = B.resolvePair(s, { speaker: C, listener: A });
  check('ค่าปกติ → ไม่ติดธง needAi', r4.needAi === false && r4.speaker === C);
}

// ═══════════ ตัวเลือกในช่อง ═══════════
{
  const s2 = mkSession(2);
  check('2 คน: ช่องคนพูดไม่มี "ให้ AI เลือก" (ไม่มีอะไรให้เลือก)',
        !B.speakerOptions(s2).some((o) => o.id === B.AI_PICK));
  const s3 = mkSession(3);
  check('3 คน: ช่องคนพูดมี "ให้ AI เลือก"',
        B.speakerOptions(s3).some((o) => o.id === B.AI_PICK));
  check('ช่องคนพูดไม่มี "ทุกคน"', !B.speakerOptions(s3).some((o) => o.id === B.ALL_LISTEN));
  check('ช่องผู้ฟังมี "ทุกคน"', B.listenerOptions(s3).some((o) => o.id === B.ALL_LISTEN));
}

// ═══════════ prompt: ตัวละครเห็นอะไรบ้าง (หัวใจของฟีเจอร์) ═══════════
{
  const s = mkSession(3);
  const [A, C, D] = ids(s);
  s.cast[0].persona = 'คุณคือโทระ พูดสั้น ตัดบท';
  s.cast[0].selfPronoun = 'ผม';
  s.cast[1].persona = 'ความลับของแคสซี่คือเธอเป็นสายลับ';
  s.cast[1].blurb = 'เพื่อนร่วมงาน';
  B.setRel(s, A, C, { how: 'แฟนใหม่ กำลังหวานกัน', callThem: 'คุณ' });

  const sys = B.buildSystem(s, A);
  check('ใบของตัวเองอยู่ใน prompt', sys.includes('พูดสั้น ตัดบท'));
  check('★ ความลับของคนอื่นไม่รั่วเข้า prompt', !sys.includes('สายลับ'));
  check('เห็นการ์ดสาธารณะของคนอื่น', sys.includes('เพื่อนร่วมงาน'));
  check('เห็นความสัมพันธ์ที่ตัวเองมองเขา', sys.includes('แฟนใหม่ กำลังหวานกัน'));
  check('สรรพนามเรียกตัวเองอยู่ใน prompt', sys.includes('ผม'));
  check('สรรพนามเรียกอีกฝ่ายอยู่ใน prompt', sys.includes('คุณ'));
  check('สถานการณ์อยู่ใน prompt', sys.includes('ลานเบียร์'));
  check('ไม่มีชื่อตัวเองในรายการ "คนอื่น"',
        sys.split('\n').filter((l) => l.startsWith('- ')).every((l) => !l.includes('โทระ')));

  check('ตัวละครที่ไม่มีในคณะ → ไม่มี prompt', B.buildSystem(s, 'ไม่มี') === '');
  check('ตัวไม่มีใบเขียนเอง ยังได้ prompt ตั้งต้น', B.buildSystem(s, D).includes('ลูน่า'));
}

// ═══════════ transcript จากมุมของแต่ละตัว ═══════════
{
  const s = mkSession(3);
  const [A, C] = ids(s);
  s.turns.push(B.newTurn({ speaker: A, listener: C, text: 'ว่าไง' }));
  s.turns.push(B.newTurn({ speaker: C, listener: A, text: 'ก็ดี', paren: 'ยิ้ม' }));
  s.turns.push(B.newTurn({ speaker: A, listener: C, text: 'เหรอ' }));

  const mA = B.buildMessages(s, A);
  check('★ บรรทัดของตัวเอง = assistant',
        mA.filter((m) => m.role === 'assistant').length === 2, JSON.stringify(mA));
  check('★ บรรทัดของคนอื่น = user ที่มีชื่อนำหน้า',
        mA.some((m) => m.role === 'user' && m.content.startsWith('แคสซี่:')));
  check('วงเล็บอารมณ์ติดไปด้วย', mA.some((m) => m.content.includes('(ยิ้ม)')));

  const mC = B.buildMessages(s, C);
  check('มุมของอีกคน: assistant/user สลับกัน',
        mC.filter((m) => m.role === 'assistant').length === 1);
  check('ข้อความแรกต้องเป็น user เสมอ', mC[0].role === 'user');
}
{
  // เทิร์นของคนอื่นติดกันต้องถูกรวมเป็นก้อนเดียว (หลายเจ้าไม่รับ user ติดกัน)
  const s = mkSession(3);
  const [A, C, D] = ids(s);
  s.turns.push(B.newTurn({ speaker: C, listener: B.ALL_LISTEN, text: 'หนึ่ง' }));
  s.turns.push(B.newTurn({ speaker: D, listener: B.ALL_LISTEN, text: 'สอง' }));
  const m = B.buildMessages(s, A);
  check('★ user ติดกันถูกรวมเป็นก้อนเดียว', m.length === 1 && m[0].role === 'user');
  check('รวมแล้วยังแยกบรรทัดได้', m[0].content.includes('หนึ่ง') && m[0].content.includes('สอง'));

  s.turns.push(B.newTurn({ kind: B.KIND_DIRECTOR, text: 'ไฟดับ' }));
  const m2 = B.buildMessages(s, A);
  check('คำสั่งผู้กำกับเข้า transcript ของทุกคน', m2[0].content.includes('ไฟดับ'));
}
{
  // ตัดตามงบ token — ต้องเก็บของใหม่ ทิ้งของเก่า
  const s = mkSession(2);
  const [A, C] = ids(s);
  for (let i = 0; i < 40; i++) {
    s.turns.push(B.newTurn({ speaker: i % 2 ? A : C, listener: i % 2 ? C : A,
                             text: 'ประโยคทดสอบที่ยาวพอสมควรลำดับที่ ' + i }));
  }
  const full = B.buildMessages(s, A, { maxTokens: 100000 });
  const cut = B.buildMessages(s, A, { maxTokens: 60 });
  check('งบน้อย → ตัดสั้นลงจริง', cut.length < full.length, `${cut.length}/${full.length}`);
  check('★ ตัดแล้วเก็บเทิร์นใหม่ ไม่ใช่เทิร์นเก่า',
        JSON.stringify(cut[cut.length - 1]) === JSON.stringify(full[full.length - 1]));
  check('ตัดแล้วยังขึ้นต้นด้วย user', !cut.length || cut[0].role === 'user');
}

// ═══════════ คำขอครบชุด ═══════════
{
  const s = mkSession(3);
  const [A, C] = ids(s);
  const req = B.buildTurnRequest(s, A, C);
  check('คำขอมี system + messages', !!req.system && Array.isArray(req.messages));
  check('ท้าย messages คือคำสั่ง "ตาคุณพูด"', req.messages[req.messages.length - 1].role === 'user');
  check('บอกด้วยว่าพูดกับใคร', req.messages[req.messages.length - 1].content.includes('แคสซี่'));
  check('งบคำตอบมาจากความยาวที่ตั้งไว้', req.maxTokens === B.lengthDef(s.len).maxTokens);
  check('ส่งข้อมูลตัวละครกลับมาด้วย (ใช้เลือกโมเดล)', req.cast.id === A);
  check('คนพูดไม่อยู่ในคณะ → null', B.buildTurnRequest(s, 'ผี', C) === null);

  s.len = 'short';
  check('ความยาวสั้น → งบน้อยลง', B.buildTurnRequest(s, A, C).maxTokens < req.maxTokens);
}
{
  const s = mkSession(3);
  s.cast[1].persona = 'ความลับของแคสซี่คือเธอเป็นสายลับ';
  const bat = B.buildBatchRequest(s, 6);
  const joined = bat.messages.map((m) => m.content).join('\n');
  check('โหมดรวดเดียว: ทุกตัวอยู่ใน prompt เดียว',
        joined.includes('โทระ') && joined.includes('แคสซี่') && joined.includes('ลูน่า'));
  check('โหมดรวดเดียวยอมให้ทุกใบอยู่ด้วยกัน (ผู้ใช้เลือกเอง)', joined.includes('สายลับ'));
  check('งบคำตอบโตตามจำนวนบรรทัด', bat.maxTokens > B.lengthDef(s.len).maxTokens);
  B._resetIds();
  check('คณะว่าง → null', B.buildBatchRequest(B.newSession()) === null);
}

// ═══════════ ให้ AI เลือกคนพูด ═══════════
{
  const s = mkSession(3);
  const [A, C, D] = ids(s);
  s.turns.push(B.newTurn({ speaker: A, listener: B.ALL_LISTEN, text: 'เฮ้ย' }));
  const pk = B.buildPickerRequest(s);
  check('คำขอเลือกคนพูดมีรายชื่อครบ', pk.messages[0].content.includes('แคสซี่'));
  check('คำขอเลือกคนพูดสั้นมาก (ถูก)', pk.maxTokens <= 32);
  check('มีบทสนทนาล่าสุดให้ตัดสิน', pk.messages[0].content.includes('เฮ้ย'));

  check('อ่านชื่อกลับเป็น id ได้', B.parsePickedSpeaker(s, 'แคสซี่') === C);
  check('มีข้อความเกินก็ยังจับได้', B.parsePickedSpeaker(s, 'ผมคิดว่า ลูน่า ควรพูดต่อ') === D);
  check('จับไม่ได้คืนค่าว่าง', B.parsePickedSpeaker(s, 'ไม่รู้จักใครเลย') === '');
  check('ค่าว่างไม่พัง', B.parsePickedSpeaker(s, '') === '' && B.parsePickedSpeaker(s, null) === '');

  // ชื่อยาวชนะชื่อสั้นที่เป็นส่วนหนึ่ง (ไทยไม่มีช่องว่างคั่น)
  B._resetIds();
  const s2 = B.newSession();
  B.addCast(s2, { name: 'สม' }); B.addCast(s2, { name: 'สมชาย' });
  check('★ ชื่อยาวชนะชื่อสั้นที่เป็นส่วนหนึ่ง',
        B.parsePickedSpeaker(s2, 'สมชาย') === s2.cast[1].id);

  check('คณะเดียว → ไม่ต้องเลือก', B.buildPickerRequest(mkSession(1)) === null);
}

// ═══════════ ล้างคำตอบ ═══════════
{
  const p = (raw, nm, o) => B.parseSpokenLine(raw, nm, o);
  check('ข้อความปกติผ่านตรง ๆ', p('ก็แค่เหนื่อย').text === 'ก็แค่เหนื่อย');
  check('ตัด "ชื่อ:" ที่โมเดลแถมมา', p('โทระ: ก็แค่เหนื่อย', 'โทระ').text === 'ก็แค่เหนื่อย');
  check('ตัด "@ชื่อ" แบบ fountain', p('@โทระ\nก็แค่เหนื่อย', 'โทระ').text === 'ก็แค่เหนื่อย');
  check('ตัดทั้งสองแบบพร้อมกัน', p('@โทระ\nโทระ: ก็แค่เหนื่อย', 'โทระ').text === 'ก็แค่เหนื่อย');
  check('แยกวงเล็บอารมณ์ออกมา',
        p('(ยิ้มเจื่อน) ก็แค่เหนื่อย').paren === 'ยิ้มเจื่อน' && p('(ยิ้มเจื่อน) ก็แค่เหนื่อย').text === 'ก็แค่เหนื่อย');
  check('ถอดเครื่องหมายคำพูดที่ครอบทั้งก้อน', p('"ก็แค่เหนื่อย"').text === 'ก็แค่เหนื่อย');
  check('เครื่องหมายคำพูดไทยก็ถอด', p('“ก็แค่เหนื่อย”').text === 'ก็แค่เหนื่อย');
  check('★ คำพูดซ้อนในประโยคไม่ถูกถอดผิด',
        p('เขาบอกว่า "ไปเลย" แล้วก็เดินออกไป').text === 'เขาบอกว่า "ไปเลย" แล้วก็เดินออกไป');
  check('ตัด code fence', p('```\nก็แค่เหนื่อย\n```').text === 'ก็แค่เหนื่อย');
  check('ค่าว่างไม่พัง', p('').text === '' && p(null).text === '');
  check('★ เวลาในประโยคไม่โดนตัดทิ้ง (18:30)',
        p('เจอกัน 18:30 นะ').text === 'เจอกัน 18:30 นะ');
  // เคยตัด "อะไรก็ได้ที่ตามด้วย : " แล้วมันกินบทพูดจริงทิ้ง — ตอนนี้ตัดเฉพาะชื่อที่รู้จัก
  check('★ บทพูดที่มี "คำ: " นำหน้าไม่ถูกกินทิ้ง',
        p('ฟังนะ: ฉันไม่ไป').text === 'ฟังนะ: ฉันไม่ไป', p('ฟังนะ: ฉันไม่ไป').text);
  check('★ ชื่อคนอื่นที่ไม่ได้ส่งเข้ามาก็ไม่ถูกตัด',
        p('แคสซี่: ว่าไง', 'โทระ').text === 'แคสซี่: ว่าไง');
  check('ชื่อเล่นที่ส่งมาใน aliases ถูกตัดด้วย',
        p('ยัยแมว: ว่าไง', 'โทระ', { aliases: ['ยัยแมว'] }).text === 'ว่าไง');
}

// ═══════════ อ่านคำตอบโหมดรวดเดียว ═══════════
{
  const s = mkSession(3);
  const [A, C] = ids(s);
  const rows = B.parseBatch(s, '@โทระ\n(เหนื่อย)\nก็แค่เหนื่อย\n\n@แคสซี่\nเหรอ ไม่เชื่อ');
  check('อ่านได้ 2 บรรทัด', rows.length === 2, JSON.stringify(rows));
  check('จับคนพูดถูก', rows[0].speaker === A && rows[1].speaker === C);
  check('จับวงเล็บอารมณ์', rows[0].paren === 'เหนื่อย');
  check('จับข้อความ', rows[1].text === 'เหรอ ไม่เชื่อ');

  const rows2 = B.parseBatch(s, 'โทระ: ก็แค่เหนื่อย\nแคสซี่: เหรอ');
  check('รูปแบบ "ชื่อ:" ก็อ่านได้', rows2.length === 2 && rows2[0].speaker === A);
  check('บรรทัดที่ไม่รู้ว่าใครพูด ถูกทิ้ง', B.parseBatch(s, 'ใครก็ไม่รู้: อะไรนะ').length === 0);
}

// ═══════════ แทรกลงบท — ต้องเป็นบทหนังเสมอ ═══════════
{
  const s = mkSession(2);
  const [A, C] = ids(s);
  const t1 = B.newTurn({ speaker: A, listener: C, text: 'ก็แค่เหนื่อย', paren: 'ยิ้ม' });
  check('★ แทรกเป็นรูปแบบบทหนัง @ชื่อ',
        B.turnToScreenplay(s, t1) === '@โทระ\n(ยิ้ม)\nก็แค่เหนื่อย', B.turnToScreenplay(s, t1));
  const t2 = B.newTurn({ speaker: A, text: 'สั้น ๆ' });
  check('ไม่มีวงเล็บก็ข้ามบรรทัดวงเล็บ', B.turnToScreenplay(s, t2) === '@โทระ\nสั้น ๆ');
  const t3 = B.newTurn({ kind: B.KIND_DIRECTOR, text: 'ไฟดับ' });
  check('คำสั่งผู้กำกับไม่มี @ (มันไม่ใช่คนพูด)', B.turnToScreenplay(s, t3) === 'ไฟดับ');
  check('เทิร์นว่าง = สตริงว่าง', B.turnToScreenplay(s, B.newTurn({})) === '');

  s.turns = [t1, t2];
  const all = B.sessionToScreenplay(s);
  check('ทั้งเซสชันคั่นด้วยบรรทัดว่าง', all === '@โทระ\n(ยิ้ม)\nก็แค่เหนื่อย\n\n@โทระ\nสั้น ๆ');
  check('เลือกเฉพาะบางเทิร์นได้', B.sessionToScreenplay(s, [t2]) === '@โทระ\nสั้น ๆ');
}

// ═══════════ ชื่อเซสชัน + ชื่อไฟล์ ═══════════
{
  check('ชื่อสั้นใช้ตรง ๆ', B.titleFromSituation('ทะเลาะกันที่ร้านกาแฟ') === 'ทะเลาะกันที่ร้านกาแฟ');
  check('ชื่อยาวถูกตัด + ใส่จุดไข่ปลา', B.titleFromSituation('ก'.repeat(80)).endsWith('…'));
  check('ชื่อยาวไม่เกินความยาวที่ตั้ง', B.titleFromSituation('ก'.repeat(80), 20).length <= 21);
  check('สถานการณ์ว่าง → มีชื่อสำรอง', B.titleFromSituation('').length > 0);

  const s = B.newSession({ title: 'ตกลงกันไม่ได้' });
  check('ชื่อไฟล์ตามชื่อเซสชัน', B.sessionFileName(s) === 'ตกลงกันไม่ได้.json');
  check('ชื่อซ้ำ → เติมเลข', B.sessionFileName(s, ['ตกลงกันไม่ได้.json']) === 'ตกลงกันไม่ได้ (2).json');
  check('ซ้ำสองชั้น → เลขถัดไป',
        B.sessionFileName(s, ['ตกลงกันไม่ได้.json', 'ตกลงกันไม่ได้ (2).json']) === 'ตกลงกันไม่ได้ (3).json');
  check('★ อักขระต้องห้ามในชื่อไฟล์ถูกแทน',
        B.sessionFileName(B.newSession({ title: 'a/b:c*d?e' })) === 'a_b_c_d_e.json');
  check('★ ไม่ชนไฟล์ presets.json',
        B.sessionFileName(B.newSession({ title: 'presets' })) !== 'presets.json');
}

// ═══════════ สถิติ + งานค้าง ═══════════
{
  const s = mkSession(2);
  const [A, C] = ids(s);
  s.turns.push(B.newTurn({ speaker: A, listener: C, text: 'x', usage: { input: 100, output: 20 }, ms: 500 }));
  s.turns.push(B.newTurn({ speaker: C, listener: A, text: 'y', usage: { input: 120, output: 30 }, ms: 400 }));
  s.turns.push(B.newTurn({ kind: B.KIND_DIRECTOR, text: 'ไฟดับ' }));
  const st = B.sessionStats(s);
  check('นับเทิร์นทั้งหมด', st.turns === 3);
  check('นับเฉพาะบทพูด (ไม่นับผู้กำกับ)', st.spoken === 2);
  check('นับจำนวนครั้งที่ยิงจริง', st.calls === 2);
  check('รวม token เข้า/ออก', st.input === 220 && st.output === 50 && st.total === 270);
  check('นับที่แทรกลงบทแล้ว = 0', st.inserted === 0);
  s.turns[0].inserted = { scene: 'x.md', at: 1 };
  check('แทรกแล้วนับเพิ่ม', B.sessionStats(s).inserted === 1);

  s.updated = 200;
  check('งานค้าง: แก้หลังบันทึก = ค้าง', B.sessionDirty(s, 100) === true);
  check('งานค้าง: บันทึกแล้วไม่ค้าง', B.sessionDirty(s, 300) === false);
}

// ═══════════ ค้นหา/เรียง ═══════════
{
  B._resetIds();
  const a = B.newSession({ title: 'ร้านกาแฟ', updated: 100 });
  const b = B.newSession({ title: 'ลานเบียร์', updated: 300, situation: 'ดื่มกัน' });
  const c = B.newSession({ title: 'เก่าเก็บ', updated: 200, archived: true });
  B.addCast(b, { name: 'โทระ' });
  const rows = [a, b, c];
  check('เรียงใหม่สุดขึ้นก่อน', B.sortSessions(rows)[0].title === 'ลานเบียร์');
  check('ไม่โชว์ที่จัดเก็บแล้ว', B.searchSessions(rows, '').length === 2);
  check('เปิดโหมดจัดเก็บแล้วเห็นครบ', B.searchSessions(rows, '', { includeArchived: true }).length === 3);
  check('ค้นจากชื่อ', B.searchSessions(rows, 'กาแฟ').length === 1);
  check('ค้นจากสถานการณ์', B.searchSessions(rows, 'ดื่ม').length === 1);
  check('★ ค้นจากชื่อตัวละครในคณะ', B.searchSessions(rows, 'โทระ')[0].title === 'ลานเบียร์');
}

// ═══════════ ใบบทบาทจาก Wiki ═══════════
{
  const ent = { name: 'โทระ', fields: { personality: 'เงียบ ขี้อาย', speech: 'พูดสั้น' },
                desc: 'บาริสต้าประจำร้าน', relationships: [{ targetName: 'แคสซี่', role: 'เจ้านาย' }] };
  const per = B.personaFromEntity(ent);
  check('ใบบทบาทขึ้นต้นด้วย "คุณคือ<ชื่อ>"', per.includes('โทระ'));
  check('ดึงบุคลิกจาก fields', per.includes('เงียบ ขี้อาย'));
  check('ดึงวิธีพูด', per.includes('พูดสั้น'));
  check('ดึงคำอธิบายท้ายใบ', per.includes('บาริสต้า'));
  check('entity ว่างไม่พัง', typeof B.personaFromEntity(null, 'ก') === 'string');

  check('คำโปรยเป็นบรรทัดเดียว', B.blurbFromEntity(ent) === 'บาริสต้าประจำร้าน');
  check('คำโปรยไม่ยาวเกิน 80', B.blurbFromEntity({ desc: 'ก'.repeat(200) }).length <= 80);

  B._resetIds();
  const s = B.newSession();
  B.addCast(s, { name: 'โทระ' }); B.addCast(s, { name: 'แคสซี่' });
  const rels = B.relsFromEntities(s.cast, { 'โทระ': ent });
  check('ดึงความสัมพันธ์ตั้งต้นจาก Wiki', rels.length === 1 && rels[0].how === 'เจ้านาย');
  check('ความสัมพันธ์ชี้ไปคนที่อยู่ในคณะเท่านั้น', rels[0].to === s.cast[1].id);
  check('คนนอกคณะถูกข้าม',
        B.relsFromEntities(s.cast, { 'โทระ': { relationships: [{ targetName: 'คนนอก', role: 'x' }] } }).length === 0);
}

// ═══════════ ตารางค่าคงที่ ═══════════
{
  check('โหมดคิวครบ 5 แบบ', B.TURN_POLICIES.length === 5);
  check('policyDef ค่าผิด → ตกกลับตัวแรก', B.policyDef('ไม่มี').id === 'pingpong');
  check('โหมดยิงมี 2 แบบ', B.SEND_MODES.length === 2);
  check('โหมดทีละคน override รายตัวได้', B.sendModeDef('each').perChar === true);
  check('โหมดรวดเดียว override รายตัวไม่ได้', B.sendModeDef('batch').perChar === false);
  check('ความยาว 3 ระดับ เรียงจากน้อยไปมาก',
        B.TURN_LENGTHS[0].maxTokens < B.TURN_LENGTHS[1].maxTokens
        && B.TURN_LENGTHS[1].maxTokens < B.TURN_LENGTHS[2].maxTokens);
  check('เพดานคณะ = 5 ตามที่ผู้ใช้กำหนด', B.MAX_CAST === 5);
  check('ค่าพิเศษไม่ชนกับ id จริง (ขึ้นต้น __)',
        [B.ANY_RANDOM, B.ALL_LISTEN, B.AI_PICK].every((x) => x.startsWith('__')));
}

console.log(`dialogue-builder: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
