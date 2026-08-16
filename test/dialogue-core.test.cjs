// test/dialogue-core.test.cjs — [alpha.79] เอนจินรวมบทพูด
// แก้บทพูดแล้วเขียนกลับ = แตะเนื้อเรื่องจริง พลาดไม่ได้ → เทสตัวนี้คือประตูกันพลาด
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_dlgcore.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/dialogue/dialogue-core.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const D = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const NAMES = ['สมชาย', 'สมหญิง', 'สม', 'กมล', 'Alice'];

// ═══════════ findQuotes ═══════════
{
  const q = D.findQuotes('เขาพูดว่า "สวัสดี" แล้วเดินจากไป');
  check('เจอคำพูดหนึ่งชุด', q.length === 1, JSON.stringify(q));
  check('ข้อความในเครื่องหมายถูกต้อง', q[0].text === 'สวัสดี', q[0] && q[0].text);
  check('ปิดครบ', q[0].closed === true);

  const q2 = D.findQuotes('"หนึ่ง" กับ "สอง"');
  check('สองชุดในบรรทัดเดียว', q2.length === 2 && q2[1].text === 'สอง');

  const q3 = D.findQuotes('“ไทยเปิดปิดคนละตัว”');
  check('เครื่องหมายไทย/อังกฤษโค้ง', q3.length === 1 && q3[0].text === 'ไทยเปิดปิดคนละตัว');

  const q4 = D.findQuotes('เขาเริ่ม "พูดค้างไว้');
  check('ไม่ปิด = ยังนับ แต่ติดธง', q4.length === 1 && q4[0].closed === false && q4[0].close === -1);
  check('ไม่ปิด → เก็บถึงท้ายบรรทัด', q4[0].text === 'พูดค้างไว้');

  check('ไม่มีคำพูด = ว่าง', D.findQuotes('บรรยายเฉย ๆ ไม่มีใครพูด').length === 0);
  check('ค่าว่าง/null ไม่พัง', D.findQuotes(null).length === 0 && D.findQuotes('').length === 0);
  check('«ฝรั่งเศส»', D.findQuotes('«bonjour»')[0].text === 'bonjour');
  check('「ญี่ปุ่น」', D.findQuotes('「こんにちは」')[0].text === 'こんにちは');
}

// ═══════════ nameNear — ภาษาไทยไม่มีช่องว่าง ═══════════
{
  check('เจอชื่อด้านหน้า', D.nameNear('สมชายพูดว่า', NAMES, 'end') === 'สมชาย');
  check('ชื่อยาวชนะชื่อสั้นที่เป็นส่วนหนึ่ง', D.nameNear('สมชาย', NAMES, 'end') === 'สมชาย');
  check('เลือกชื่อที่ชิดเครื่องหมายที่สุด',
        D.nameNear('สมหญิงมองหน้าสมชายแล้วบอกว่า', NAMES, 'end') === 'สมชาย');
  check('ด้านหลังเอาตัวที่มาก่อน',
        D.nameNear(' สมชายกล่าวกับสมหญิง', NAMES, 'start') === 'สมชาย');
  check('ไม่มีชื่อ = ว่าง', D.nameNear('เสียงหนึ่งดังขึ้น', NAMES, 'end') === '');
  check('ไม่มีรายชื่อ = ว่าง', D.nameNear('สมชาย', [], 'end') === '');
  check('ชื่ออังกฤษก็ได้', D.nameNear('Alice said', NAMES, 'end') === 'Alice');
}

// ═══════════ extractDialogue — นิยาย ═══════════
{
  const md = [
    'เช้าวันนั้นอากาศดี',
    'สมชายพูดว่า "สวัสดีตอนเช้า"',
    '"ไปไหนมา" สมหญิงถามกลับ',
    '"ไม่มีใครรู้ว่าใครพูด"',
    '',
    'จบฉาก',
  ].join('\n');
  const rows = D.extractDialogue(md, { names: NAMES });
  check('ได้ 3 บทพูด', rows.length === 3, rows.length);
  check('ชื่อหน้าเครื่องหมาย = คนพูด',
        rows[0].speaker === 'สมชาย' && rows[0].where === D.WHERE_FRONT, JSON.stringify(rows[0]));
  check('ไม่มีชื่อหน้า → ดูด้านหลัง',
        rows[1].speaker === 'สมหญิง' && rows[1].where === D.WHERE_BACK, JSON.stringify(rows[1]));
  check('ไม่เจอทั้งสองฝั่ง = ไม่ระบุ',
        rows[2].speaker === '' && rows[2].where === D.WHERE_NONE);
  check('เลขบรรทัดถูก (นับจาก 0)', rows[0].line === 1 && rows[1].line === 2 && rows[2].line === 3);
  check('ตำแหน่งคอลัมน์ของเครื่องหมายเปิดถูก',
        'สมชายพูดว่า "สวัสดีตอนเช้า"'.indexOf('"') === rows[0].open);
  check('ที่มา = นิยาย', rows.every((r) => r.source === D.SRC_PROSE));

  const off = D.extractDialogue(md, { names: NAMES, backTag: false });
  check('ปิดการหาชื่อด้านหลังได้', off[1].speaker === '');
}

// ═══════════ extractDialogue — บทภาพยนตร์ ═══════════
{
  const sp = [
    '### INT. ห้องครัว - กลางวัน',
    'สมชายยืนอยู่ริมหน้าต่าง',
    '@สมชาย',
    '((กระซิบ))',
    'เราต้องไปเดี๋ยวนี้',
    '',
    '@สมหญิง (V.O.)',
    'ฉันรู้แล้ว',
    '',
    '>> CUT TO:',
  ].join('\n');
  const rows = D.extractDialogue(sp, { names: NAMES });
  check('บทหนัง: ได้ 2 บทพูด', rows.length === 2, JSON.stringify(rows.map((r) => r.text)));
  check('บทพูดมาจากรหัส @',
        rows[0].speaker === 'สมชาย' && rows[0].where === D.WHERE_TAG && rows[0].source === D.SRC_SCRIPT);
  check('ตัด (V.O.) ออกจากชื่อ', rows[1].speaker === 'สมหญิง', rows[1].speaker);
  check('เนื้อบทพูด = ทั้งบรรทัด', rows[0].text === 'เราต้องไปเดี๋ยวนี้');
  check('บรรยาย/หัวฉาก/ทรานซิชัน ไม่ถูกนับ',
        !rows.some((r) => /หน้าต่าง|CUT TO/.test(r.text)));
  check('characterFromTag ตัดวงเล็บ', D.characterFromTag('@สมชาย (O.S.)') === 'สมชาย');
  check('บรรทัดที่ไม่ใช่ @ คืนค่าว่าง', D.characterFromTag('สมชาย') === '');

  // บทพูดในบทหนังที่ใส่เครื่องหมายคำพูดด้วย → ชื่อยังมาจากรหัส @
  const sp2 = ['@กมล', '"เอาน่า"'].join('\n');
  const r2 = D.extractDialogue(sp2, { names: NAMES });
  check('มีเครื่องหมายคำพูดใต้ @ → ยังเป็นของตัวละครนั้น',
        r2.length === 1 && r2[0].speaker === 'กมล' && r2[0].text === 'เอาน่า');
}

// ═══════════ replaceDialogue — เขียนกลับ ═══════════
{
  const md = ['บรรทัดแรก', 'สมชายพูดว่า "สวัสดี" แล้วยิ้ม', 'ท้าย'].join('\n');
  const rows = D.extractDialogue(md, { names: NAMES });
  const next = D.replaceDialogue(md, rows[0], 'ราตรีสวัสดิ์');
  check('เขียนกลับได้',
        next === ['บรรทัดแรก', 'สมชายพูดว่า "ราตรีสวัสดิ์" แล้วยิ้ม', 'ท้าย'].join('\n'), JSON.stringify(next));
  check('บรรทัดอื่นไม่ถูกแตะ', next.split('\n')[0] === 'บรรทัดแรก' && next.split('\n')[2] === 'ท้าย');

  // ข้อความเดิมไม่ตรง = ไฟล์เปลี่ยนไปแล้ว → ห้ามเขียนทับ
  const stale = { ...rows[0], text: 'ข้อความที่ไม่มีอยู่จริง' };
  check('ข้อความเดิมไม่ตรง → คืน null', D.replaceDialogue(md, stale, 'x') === null);
  check('เลขบรรทัดเกินไฟล์ → คืน null',
        D.replaceDialogue(md, { ...rows[0], line: 99 }, 'x') === null);
  check('row ว่าง → คืน null', D.replaceDialogue(md, null, 'x') === null);

  // ขึ้นบรรทัดใหม่ในข้อความใหม่ต้องไม่ทำให้ไฟล์เพี้ยน
  const nl = D.replaceDialogue(md, rows[0], 'ก\nข');
  check('ตัดขึ้นบรรทัดใหม่ออก (ไฟล์ไม่เพี้ยน)', nl.split('\n').length === 3 && /ก ข/.test(nl));

  // บทภาพยนตร์: แทนทั้งบรรทัด
  const sp = ['@กมล', 'ประโยคเดิม', ''].join('\n');
  const spRows = D.extractDialogue(sp, { names: NAMES });
  const sp2 = D.replaceDialogue(sp, spRows[0], 'ประโยคใหม่');
  check('บทหนัง: แทนทั้งบรรทัด', sp2 === ['@กมล', 'ประโยคใหม่', ''].join('\n'), JSON.stringify(sp2));

  // คำพูดที่ไม่ปิด — เขียนกลับแล้วต้อง "ปิดให้"
  const openMd = 'เขาบอก "ค้างไว้';
  const openRows = D.extractDialogue(openMd, { names: NAMES });
  check('คำพูดไม่ปิด: เขียนกลับแล้วปิดให้',
        D.replaceDialogue(openMd, openRows[0], 'เสร็จแล้ว') === 'เขาบอก "เสร็จแล้ว"');

  // เครื่องหมายโค้ง
  const cur = 'สมชายว่า “อย่างนั้นหรือ”';
  const curRows = D.extractDialogue(cur, { names: NAMES });
  check('เครื่องหมายโค้ง: เขียนกลับคงเครื่องหมายเดิม',
        D.replaceDialogue(cur, curRows[0], 'จริงหรือ') === 'สมชายว่า “จริงหรือ”');

  // สองชุดในบรรทัดเดียว — แก้ตัวหลังต้องไม่ทำตัวหน้าเพี้ยน
  const two = '"หนึ่ง" และ "สอง"';
  const twoRows = D.extractDialogue(two, { names: NAMES });
  check('สองชุด: แก้ตัวที่สองได้ถูกตำแหน่ง',
        D.replaceDialogue(two, twoRows[1], 'สาม') === '"หนึ่ง" และ "สาม"');
}

// ═══════════ filter / stats / group ═══════════
{
  const rows = [
    { section: 'เล่ม1', chapterId: 'c1', sceneId: 's1', sceneTitle: 'ฉากแรก', speaker: 'สมชาย', text: 'สวัสดี', source: 'prose' },
    { section: 'เล่ม1', chapterId: 'c1', sceneId: 's2', sceneTitle: 'ฉากสอง', speaker: 'สมหญิง', text: 'ไปไหน', source: 'prose' },
    { section: 'เล่ม2', chapterId: 'c9', sceneId: 's9', sceneTitle: 'ฉากเก้า', speaker: '', text: 'ใครก็ไม่รู้', source: 'script' },
    { section: 'เล่ม1', chapterId: 'c1', sceneId: 's1', sceneTitle: 'ฉากแรก', speaker: 'สมชาย', text: 'อีกครั้ง', source: 'prose' },
  ];
  check('กรองตามเล่ม', D.filterDialogue(rows, { section: 'เล่ม1' }).length === 3);
  check('กรองตามบท', D.filterDialogue(rows, { chapter: 'c9' }).length === 1);
  check('กรองตามฉาก', D.filterDialogue(rows, { scene: 's1' }).length === 2);
  check('กรองตามตัวละคร (หลายคน)',
        D.filterDialogue(rows, { speakers: ['สมชาย', 'สมหญิง'] }).length === 3);
  check('กรอง "ไม่ระบุ" ด้วยค่าว่าง', D.filterDialogue(rows, { speakers: [''] }).length === 1);
  check('กรองตามที่มา', D.filterDialogue(rows, { source: 'script' }).length === 1);
  check('ค้นข้อความ', D.filterDialogue(rows, { q: 'สวัสดี' }).length === 1);
  check('ค้นชื่อฉากก็เจอ', D.filterDialogue(rows, { q: 'ฉากเก้า' }).length === 1);
  check('ไม่ใส่ตัวกรอง = ได้ทั้งหมด', D.filterDialogue(rows, {}).length === 4);
  check('กรองหลายเงื่อนไขพร้อมกัน',
        D.filterDialogue(rows, { section: 'เล่ม1', speakers: ['สมชาย'] }).length === 2);

  const st = D.speakerStats(rows);
  check('สถิติ: เรียงมากไปน้อย', st[0].speaker === 'สมชาย' && st[0].count === 2, JSON.stringify(st));
  check('สถิติ: "ไม่ระบุ" อยู่ท้ายสุดเสมอ', st[st.length - 1].speaker === '');
  check('สถิติ: นับคำด้วย', st[0].words > 0);
  check('speakerList คืนเฉพาะชื่อ', D.speakerList(rows).length === st.length);

  const g = D.groupByScene(rows);
  check('จัดกลุ่มตามฉาก', g.length === 3, g.length);
  check('ฉากเดียวกันรวมกัน', g[0].rows.length === 2 && g[0].sceneId === 's1');
  check('คงลำดับเดิม', g[1].sceneId === 's2' && g[2].sceneId === 's9');
}

// ═══════════ ตัวช่วยเล็ก ๆ ═══════════
{
  check('countWords ไทย', D.countWords('สวัสดีครับ') >= 1);
  check('countWords ว่าง = 0', D.countWords('') === 0 && D.countWords(null) === 0);
  check('countWords อังกฤษนับช่องว่าง', D.countWords('one two three') === 3);
  check('preview ตัดยาว', D.preview('ก'.repeat(200), 20).length === 20);
  check('preview สั้นไม่ตัด', D.preview('สั้น') === 'สั้น');
  check('preview ยุบช่องว่าง', D.preview('  ก   ข  ') === 'ก ข');
  check('trimPrefix ตัดหาง', D.trimPrefix('สมชายพูดว่า ') === 'สมชายพูดว่า');
  check('isScriptCode รู้จักหัวฉาก', D.isScriptCode('### INT. ห้อง - วัน') === true);
  check('isScriptCode ไม่เหมาบรรยายเป็นรหัส', D.isScriptCode('เขาเดินเข้ามา') === false);
  // รหัสรุ่น v1 — ไฟล์เก่ายังใช้อยู่
  check('isScriptCode รู้จักหัวฉากแบบ v1 (.)', D.isScriptCode('. ตลาด - เย็น') === false
        && D.isScriptCode('.ตลาด - เย็น') === true);
  check('isScriptCode รู้จัก $shot / $sub ของ v1',
        D.isScriptCode('$shot CLOSE ON') === true && D.isScriptCode('$sub มุมห้อง') === true);
  check('isScriptCode ไม่เหมาจุดไข่ปลาเป็นรหัส', D.isScriptCode('...เงียบไปพักหนึ่ง') === false);
  // ไฟล์บทแบบ v1 เต็มรูป: หัวฉาก . + @ตัวละคร → ยังอ่านบทพูดได้ถูก
  {
    const v1 = ['.ตลาด - เย็น', '@โทระ', 'สวัสดีครับ', ''].join('\n');
    const r = D.extractDialogue(v1, { names: NAMES });
    check('ไฟล์บทรุ่น v1: อ่านบทพูดได้',
          r.length === 1 && r[0].speaker === 'โทระ' && r[0].text === 'สวัสดีครับ', JSON.stringify(r));
  }
}

console.log(`\ndialogue-core: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
