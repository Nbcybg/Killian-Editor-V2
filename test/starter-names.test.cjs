// test/starter-names.test.cjs — [alpha.116 ข้อ 10] เดาชื่อตัวละครจากเรื่องย่อ
//
// ตัวเดานี้ **ยอมพลาดได้ แต่ห้ามมั่ว** — ชิปที่แนะนำ "โทระเดิน" หรือ "ชื่อ" ให้ผู้ใช้กด
// แย่กว่าไม่แนะนำอะไรเลย เพราะมันสร้างตัวละครชื่อผิดขึ้นมาจริง ๆ ในโปรเจกต์
// เทสนี้จึงเน้นสองอย่าง: จับของที่ควรจับได้ · และ **ไม่จับของที่ไม่ใช่ชื่อ**
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_starternames.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/starter/starter-names.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const N = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };
const names = (text, o) => N.suggestNames(text, o).map((r) => r.name);

// ═══════════ ถอด HTML ═══════════
{
  check('ถอดแท็กออก', N.stripHtml('<p>สวัสดี <b>โลก</b></p>') === 'สวัสดี โลก');
  check('<br> กลายเป็นขึ้นบรรทัด', N.stripHtml('ก<br>ข').includes('ก'));
  check('คืนค่าว่างเมื่อไม่มีอะไร', N.stripHtml('') === '' && N.stripHtml(null) === '');
  check('แปลง entity กลับ', N.stripHtml('&quot;ก&quot;') === '"ก"');
}

// ═══════════ ด่านที่ 1 — เครื่องหมายคำพูด ═══════════
{
  check('ชื่อในอัญประกาศคู่', names('เรื่องของ “โทระ” กับเพื่อน').includes('โทระ'));
  check('ชื่อในวงเล็บมุม', names('มี 「แคสซี่」 อยู่ด้วย').includes('แคสซี่'));
  check('ประโยคยาวในอัญประกาศไม่ถูกนับเป็นชื่อ',
        !names('เขาพูดว่า “วันนี้อากาศดีมากเลยนะเธอรู้ไหมว่าฉันคิดถึง”').length,
        JSON.stringify(names('เขาพูดว่า “วันนี้อากาศดีมากเลยนะเธอรู้ไหมว่าฉันคิดถึง”')));
}

// ═══════════ ด่านที่ 2 — คำนำหน้าชื่อ ═══════════
{
  check('ชื่อว่า…', names('ชายหนุ่มชื่อว่าโทระ เดินเข้ามา').includes('โทระ'),
        JSON.stringify(names('ชายหนุ่มชื่อว่าโทระ เดินเข้ามา')));
  check('นางสาว… (คำนำหน้ายาวชนะคำสั้น)',
        names('นางสาวแคสซี่ ยืนรออยู่').includes('แคสซี่'),
        JSON.stringify(names('นางสาวแคสซี่ ยืนรออยู่')));
  check('เจ้าหญิง…', names('เจ้าหญิงลูน่า หายตัวไป').includes('ลูน่า'),
        JSON.stringify(names('เจ้าหญิงลูน่า หายตัวไป')));
  check('ชื่อฝรั่งหลังคำนำหน้าไทย', names('ชายคนหนึ่งชื่อ Tora มาจากตะวันออก').includes('Tora'));
  // ★ ไม่จับคำที่ตามหลังคำนำหน้าแต่ไม่ใช่ชื่อคน
  check('★ "ชื่อเรื่อง" ไม่กลายเป็นตัวละครชื่อ "เรื่อง"',
        !names('ชื่อเรื่องนี้ยังไม่ได้ตั้ง').includes('เรื่อง'),
        JSON.stringify(names('ชื่อเรื่องนี้ยังไม่ได้ตั้ง')));
  check('★ "คุณผู้อ่าน" ไม่ถูกนับเป็นชื่อคน',
        !names('คุณของเขาหายไป').includes('ของ'));
}

// ═══════════ ด่านที่ 3 — อังกฤษตัวพิมพ์ใหญ่ ═══════════
{
  check('จับชื่อฝรั่ง', names('Kyleigh met Nazarena at dawn.').includes('Kyleigh'));
  check('★ คำขึ้นต้นประโยคทั่วไปไม่ถูกนับ (The/When/After)',
        !names('The story begins. When they met. After that.').length,
        JSON.stringify(names('The story begins. When they met. After that.')));
}

// ═══════════ จัดอันดับ + กรองซ้ำ ═══════════
{
  const text = 'เรื่องของ “โทระ” กับเพื่อนชื่อว่าแคสซี่ · โทระ ออกเดินทาง โทระ ไม่ยอมแพ้';
  const rows = N.suggestNames(text);
  check('อัญประกาศมาก่อนคำนำหน้า', rows[0] && rows[0].name === 'โทระ', JSON.stringify(rows));
  check('บอกจำนวนครั้งที่ถูกเอ่ยถึง', rows[0] && rows[0].hits >= 3, JSON.stringify(rows));
  check('บอกที่มาของชื่อ', rows[0] && rows[0].source === 'quote');

  check('★ ตัวที่มีในคณะแล้วไม่ถูกแนะนำซ้ำ',
        !names(text, { exclude: ['โทระ'] }).includes('โทระ'),
        JSON.stringify(names(text, { exclude: ['โทระ'] })));
  check('เทียบชื่อแบบไม่สนช่องว่าง/ตัวพิมพ์',
        !names('ชายคนหนึ่งชื่อ Tora มาถึง', { exclude: ['tora'] }).includes('Tora'));
  check('ไม่ซ้ำกันเองแม้เจอหลายด่าน', (() => {
    const r = names('“Tora” — ชื่อว่า Tora และ Tora อีกที');
    return r.filter((x) => x === 'Tora').length === 1;
  })());
  check('จำกัดจำนวนได้', N.suggestNames('A Bb Cc Dd Ee Ff Gg Hh Ii Jj', { limit: 3 }).length <= 3);
  check('ข้อความว่าง → ไม่มีอะไร', N.suggestNames('').length === 0 && N.suggestNames(null).length === 0);
  check('รับ HTML ตรง ๆ ได้', names('<p>ชื่อว่าโทระ นะ</p>').includes('โทระ'));
}

// ═══════════ นับการเอ่ยถึง + ป้ายที่มา ═══════════
{
  check('mentionCount นับซ้อนกันไม่พลาด', N.mentionCount('กกก', 'ก') === 3);
  check('mentionCount ชื่อว่าง → 0', N.mentionCount('กกก', '') === 0);
  check('ป้ายที่มาเป็นคำแปลจริง ไม่ใช่ตัวคีย์',
        ['quote', 'marker', 'caps'].every((x) => N.sourceLabel(x) && !N.sourceLabel(x).startsWith('ui.')));
}

// ═══════════ ข้อความที่เอามาสแกน ═══════════
{
  const s = { blurb: 'เรื่องของโทระ', intro: '<p>ชายหนุ่มชื่อว่าโทระ</p>',
              w: { what: 'ตามหาเจ้าหญิงลูน่า', when: '' } };
  const txt = N.starterText(s);
  check('รวมทั้งคำโปรย เรื่องย่อ และช่อง 4W',
        txt.includes('เรื่องของโทระ') && txt.includes('ชื่อว่าโทระ') && txt.includes('ลูน่า'), txt);
  check('เรื่องย่อถูกถอด HTML แล้ว', !txt.includes('<p>'), txt);
  check('เจอชื่อจากช่อง 4W ด้วย', names(txt).includes('ลูน่า'), JSON.stringify(names(txt)));
  check('starter ว่างเปล่าไม่พัง', N.starterText({}) === '' && typeof N.starterText() === 'string');
}

console.log(`starter-names: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
