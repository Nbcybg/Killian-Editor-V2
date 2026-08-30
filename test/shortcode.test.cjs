// test/shortcode.test.cjs — [alpha.116 ข้อ 8] เอนจินโค้ดสั้น `[title]`
//
// สามเรื่องที่พลาดแล้วเห็นตอนส่งออกจริงเท่านั้น จึงต้องล็อกไว้ที่นี่:
//   1. ข้อความของผู้ใช้ที่มีวงเล็บเหลี่ยม **ต้องไม่ถูกกิน**
//   2. โค้ดที่ไม่รู้จัก **ต้องคงอยู่** (ไม่หายเงียบ — กฎเดียวกับ "ไม่มี fallback" ของระบบภาษา)
//   3. ค่าที่แทนเข้าไปแล้วต้องไม่ถูกสแกนซ้ำ (ไม่งั้นเนื้อเรื่องกลายเป็นโค้ดโดยไม่ตั้งใจ)
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_shortcode.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/shortcode.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const S = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const CTX = {
  title: 'ดาบเจ็ดสี', author: 'ท็อป', project: 'โปรเจกต์ทดสอบ', book: 'เล่มหนึ่ง',
  chapter: 'บทเปิด', scene: 'ตลาดยามเช้า', chapterNo: 2, sceneNo: 5,
  status: 'เขียนแล้ว', pov: 'โทระ', synopsis: 'เขาเดินเข้าตลาด',
  tags: ['ผจญภัย', 'เปิดเรื่อง'], words: 1234, chars: 5678, pages: 9,
  vars: { 'โทระ.อายุ': '17', 'อายุ': '17' },
  now: new Date(2026, 7, 30, 9, 5),
};

// ═══════════ พาร์เซอร์อาร์กิวเมนต์ ═══════════
{
  check('ไม่มีอาร์กิวเมนต์', JSON.stringify(S.parseArgs('')) === JSON.stringify({ arg: '', opts: {} }));
  check('เป้าหมายหลัง :', S.parseArgs(':โทระ.อายุ').arg === 'โทระ.อายุ');
  check('คีย์=ค่า', S.parseArgs(' fmt=iso').opts.fmt === 'iso');
  check('ค่ามีช่องว่างต้องครอบด้วยเครื่องหมายคำพูด',
        S.parseArgs(' sep=" · "').opts.sep === ' · ', JSON.stringify(S.parseArgs(' sep=" · "')));
  check('เป้าหมาย + คีย์=ค่า พร้อมกัน', (() => {
    const r = S.parseArgs(':โทระ fmt=iso');
    return r.arg === 'โทระ' && r.opts.fmt === 'iso';
  })());
}

// ═══════════ แทนค่าพื้นฐาน ═══════════
{
  check('[title]', S.expandShortcodes('เรื่อง [title] จบ', CTX) === 'เรื่อง ดาบเจ็ดสี จบ');
  check('หลายตัวในบรรทัดเดียว',
        S.expandShortcodes('[chapter] — [scene]', CTX) === 'บทเปิด — ตลาดยามเช้า');
  check('ชื่อโค้ดไม่สนตัวพิมพ์', S.expandShortcodes('[TITLE]', CTX) === 'ดาบเจ็ดสี');
  check('ลำดับบท/ฉาก', S.expandShortcodes('[chapterno].[sceneno]', CTX) === '2.5');
  check('ตัวเลข', S.expandShortcodes('[words]/[chars]/[pages]', CTX) === '1234/5678/9');
  check('สถานะ/มุมมอง/เรื่องย่อ',
        S.expandShortcodes('[status]|[pov]|[synopsis]', CTX) === 'เขียนแล้ว|โทระ|เขาเดินเข้าตลาด');
  check('แท็ก', S.expandShortcodes('[tags]', CTX) === 'ผจญภัย, เปิดเรื่อง');
  check('แท็กเปลี่ยนตัวคั่นได้', S.expandShortcodes('[tags sep=" · "]', CTX) === 'ผจญภัย · เปิดเรื่อง');
  check('ค่าที่ไม่มีในบริบท → ว่าง ไม่ใช่ undefined',
        S.expandShortcodes('[title]', {}) === '');
}

// ═══════════ วันที่ ═══════════
{
  check('[date fmt=iso]', S.expandShortcodes('[date fmt=iso]', CTX) === '2026-08-30');
  check('[date:iso] เขียนย่อได้', S.expandShortcodes('[date:iso]', CTX) === '2026-08-30');
  check('[date fmt=year]', S.expandShortcodes('[date fmt=year]', CTX) === '2026');
  check('[date fmt=time]', S.expandShortcodes('[date fmt=time]', CTX) === '09:05');
  check('ไม่มีวันที่ในบริบท → ว่าง', S.expandShortcodes('[date fmt=iso]', {}) === '');
}

// ═══════════ Wiki ═══════════
{
  check('[wiki:ชื่อ.ฟิลด์]', S.expandShortcodes('อายุ [wiki:โทระ.อายุ] ปี', CTX) === 'อายุ 17 ปี');
  check('[var:คีย์] ใช้ตารางเดียวกัน', S.expandShortcodes('[var:อายุ]', CTX) === '17');
  check('ชื่อที่ไม่มีในตาราง → ว่าง (ไม่ใช่ชื่อคีย์)',
        S.expandShortcodes('[wiki:ไม่มีตัวนี้]', CTX) === '');
}

// ═══════════ ★ กฎที่ห้ามพัง ═══════════
{
  // 1) ข้อความของผู้ใช้ที่มีวงเล็บเหลี่ยม
  const prose = 'เขาหยิบกระดาษ [ลายมือเลอะ] ขึ้นมาอ่าน';
  check('★ วงเล็บเหลี่ยมที่มีข้อความไทยไม่ถูกแตะ', S.expandShortcodes(prose, CTX) === prose);
  const md = 'ดู [ลิงก์](http://x) และ [1] เชิงอรรถ';
  check('★ ลิงก์มาร์กดาวน์กับเลขเชิงอรรถไม่ถูกแตะ', S.expandShortcodes(md, CTX) === md);

  // 2) หนีการแทนด้วย [[...]]
  check('★ [[title]] ออกมาเป็นตัวอักษร [title]',
        S.expandShortcodes('พิมพ์ [[title]] แบบนี้', CTX) === 'พิมพ์ [title] แบบนี้');

  // 3) ไม่รู้จัก = ไม่แตะ
  const info = S.expandShortcodesInfo('[title] [nosuchcode]', CTX);
  check('★ โค้ดที่ไม่รู้จักคงอยู่เหมือนเดิม', info.text === 'ดาบเจ็ดสี [nosuchcode]', info.text);
  check('รายงานว่าตัวไหนไม่รู้จัก', info.unknown.join(',') === 'nosuchcode', info.unknown.join(','));
  check('รายงานว่าใช้โค้ดอะไรไปบ้าง', info.used.join(',') === 'title', info.used.join(','));
  check('สั่งให้ลบโค้ดที่ไม่รู้จักได้ถ้าต้องการ',
        S.expandShortcodes('[title] [nosuchcode]', CTX, { keepUnknown: false }) === 'ดาบเจ็ดสี ');

  // 4) แทนรอบเดียว — ค่าที่แทนมามีโค้ดปนก็ไม่ถูกสแกนซ้ำ
  const tricky = S.expandShortcodes('[title]', { title: '[author]', author: 'ท็อป' });
  check('★ ค่าที่แทนเข้าไปไม่ถูกสแกนซ้ำ', tricky === '[author]', tricky);

  check('ข้อความว่าง/null ไม่พัง',
        S.expandShortcodes('', CTX) === '' && S.expandShortcodes(null, CTX) === '');
  check('วงเล็บที่ไม่ปิดไม่ทำให้พัง', S.expandShortcodes('[title', CTX) === '[title');
}

// ═══════════ ตัวกวาด (สำหรับตัวตรวจ/ไฮไลต์) ═══════════
{
  const hits = S.scanShortcodes('ก [title] ข [nope] ค [[title]]');
  check('กวาดเจอครบ 3 โทเคน', hits.length === 3, JSON.stringify(hits.map((h) => h.raw)));
  check('บอกได้ว่าตัวไหนรู้จัก', hits[0].known === true && hits[1].known === false);
  check('บอกได้ว่าตัวไหนเป็นการหนีการแทน', hits[2].escaped === true);
  check('ตำแหน่งชี้กลับไปที่ข้อความเดิมได้จริง', (() => {
    const src = 'ก [title] ข';
    const h = S.scanShortcodes(src)[0];
    return src.slice(h.start, h.end) === '[title]';
  })());
}

// ═══════════ ทะเบียน + บริบท ═══════════
{
  check('มีโค้ดอย่างน้อย 15 ตัว', S.SHORTCODES.length >= 15, S.SHORTCODES.length);
  check('ชื่อไม่ซ้ำ', new Set(S.shortcodeNames()).size === S.SHORTCODES.length);
  check('ชื่อเป็นตัวพิมพ์เล็กล้วน', S.shortcodeNames().every((n) => n === n.toLowerCase()));
  check('ทุกตัวมีคำอธิบายที่ไม่ใช่ตัวคีย์',
        S.SHORTCODES.every((s) => s.label && !s.label.startsWith('ui.')),
        S.SHORTCODES.filter((s) => !s.label || s.label.startsWith('ui.')).map((s) => s.name).join(','));
  check('ทุกตัวอยู่ในกลุ่มที่ประกาศไว้',
        S.SHORTCODES.every((s) => S.SHORTCODE_GROUPS.some((g) => g.key === s.group)),
        S.SHORTCODES.filter((s) => !S.SHORTCODE_GROUPS.some((g) => g.key === s.group)).map((s) => s.name).join(','));
  check('ทุกกลุ่มมีชื่อที่ไม่ใช่ตัวคีย์',
        S.SHORTCODE_GROUPS.every((g) => g.label && !g.label.startsWith('ui.')));
  check('shortcodeLabel ของชื่อที่ไม่มี → คืนชื่อนั้นเอง', S.shortcodeLabel('zzz') === 'zzz');

  const ctx = S.sceneContext({
    model: { title: 'เรื่องเอก', author: 'ท็อป' },
    chapter: { title: 'บทหนึ่ง' }, scene: { title: 'ฉากแรก', status: 'ร่าง', words: 20 },
    chapterNo: 1, sceneNo: 3, vars: { a: 'b' },
  });
  check('sceneContext ประกอบค่าครบ',
        ctx.title === 'เรื่องเอก' && ctx.chapter === 'บทหนึ่ง' && ctx.scene === 'ฉากแรก'
        && ctx.sceneNo === 3 && ctx.status === 'ร่าง' && ctx.words === 20 && ctx.vars.a === 'b',
        JSON.stringify(ctx));
  check('sceneContext ไม่ส่งอะไรมาก็ไม่พัง', typeof S.sceneContext().title === 'string');
}

console.log(`shortcode: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
