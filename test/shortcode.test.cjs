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

// ═══════════ [alpha.121] โค้ดใหม่ — ฉาก/บท/สถิติ/เวลา ═══════════
{
  const now = new Date(2026, 7, 30, 9, 5);   // อาทิตย์ 30 ส.ค. 2026 09:05
  const ctx = S.sceneContext({
    model: { title: 'ดาบเจ็ดสี', author: 'ท็อป', language: 'th', appVersion: '2.0.0-alpha.121' },
    chapter: { title: 'บทเปิด', status: 'กำลังเขียน', act: 'I', date: '2026-01-01', isFavorite: true },
    scene: { title: 'ตลาดยามเช้า', status: 'Outline', emotion: 'หวาดกลัว', conflict: 'พ่อค้าโกง',
              note: 'จำ', futureNote: 'อย่าลืม', storyDate: 'ปีที่ 3', color: '#ff0000',
              flag: true, locked: false, wordCount: 500 },
    chapterNo: 1, sceneNo: 1, now,
    stats: { totalWords: 12000, totalScenes: 40, totalChapters: 8, totalBooks: 2,
             totalCharacters: 6, totalLocations: 3, dailyGoal: 500, projectGoal: 50000, commentCount: 4 },
  });
  check('language/appversion', S.expandShortcodes('[language]/[appversion]', ctx) === 'th/2.0.0-alpha.121');
  check('★ สถานะ "Outline" (ยังไม่ตั้ง) ไม่โผล่เป็นตัวหนังสือ',
        S.expandShortcodes('[status]', ctx) === '', JSON.stringify(ctx.status));
  check('chapterstatus/chapteract/chapterdate ของบท',
        S.expandShortcodes('[chapterstatus]|[chapteract]|[chapterdate]', ctx) === 'กำลังเขียน|I|2026-01-01');
  check('chapterflag แปลเป็นใช่/ไม่ใช่', S.expandShortcodes('[chapterflag]', ctx) === 'ใช่');
  check('emotion/conflict/note/futurenote/storydate/color',
        S.expandShortcodes('[emotion]/[conflict]/[note]/[futurenote]/[storydate]/[color]', ctx)
        === 'หวาดกลัว/พ่อค้าโกง/จำ/อย่าลืม/ปีที่ 3/#ff0000');
  check('flag/locked แปลเป็นใช่/ไม่ใช่', S.expandShortcodes('[flag]|[locked]', ctx) === 'ใช่|ไม่ใช่');
  check('words อ่านจาก wordCount ได้เมื่อไม่มี words',
        S.expandShortcodes('[words]', ctx) === '500', ctx.words);
  check('★ สถิติรวมทั้งโปรเจกต์', S.expandShortcodes(
        '[totalwords]/[totalscenes]/[totalchapters]/[totalbooks]/[totalcharacters]/[totallocations]', ctx)
        === '12000/40/8/2/6/3', JSON.stringify(ctx));
  check('เป้าหมาย + ความคืบหน้าคำนวณถูก (12000/50000=24%)',
        S.expandShortcodes('[dailygoal]/[projectgoal]/[progress]', ctx) === '500/50000/24');
  check('commentcount', S.expandShortcodes('[commentcount]', ctx) === '4');
  check('★ เวลา: time/year/weekday อ่านจาก now', S.expandShortcodes('[time]|[year]', ctx) === '09:05|2026');
  check('weekday ไม่ระเบิด (ค่าขึ้นกับ locale ของเครื่องเทส จึงเช็คแค่ว่าไม่ใช่ค่าว่าง)',
        S.expandShortcodes('[weekday]', ctx).length > 0);
  check('sceneContext ไม่ส่ง stats มา → เลขว่างเปล่า ไม่ใช่ NaN/undefined',
        S.expandShortcodes('[totalwords][progress]', S.sceneContext({})) === '');
}

// ═══════════ [alpha.121] entityContext — บริบทของเอนทิตี้ Wiki ═══════════
{
  const entity = {
    name: 'โทระ', summary: 'นักดาบเร่ร่อน', tags: ['พระเอก', 'หัวร้อน'],
    fields: { อายุ: '20', อาชีพ: 'นักดาบ' }, customProperties: { สี: 'แดง' },
    relationships: [{ target: 'คัสซี่', role: 'คู่รัก' }, { target: 'ลูน่า', role: 'เพื่อน' },
                    { target: 'นาซารีน่า', role: 'เพื่อน' }],
  };
  const ctx = S.entityContext({
    model: { title: 'ดาบเจ็ดสี', author: 'ท็อป' },
    entity, cat: 'characters', catLabel: 'ตัวละคร',
    vars: { 'โทระ.อายุ': '20' }, stats: { totalCharacters: 6 },
  });
  check('★ entity/entitycat/entitysummary/entitytags',
        S.expandShortcodes('[entity]|[entitycat]|[entitysummary]|[entitytags]', ctx)
        === 'โทระ|ตัวละคร|นักดาบเร่ร่อน|พระเอก, หัวร้อน', JSON.stringify(ctx));
  check('★★ field: อ่านฟิลด์ของเอนทิตี้ตัวเอง (รวม customProperties)',
        S.expandShortcodes('[field:อายุ] / [field:อาชีพ] / [field:สี]', ctx) === '20 / นักดาบ / แดง');
  check('field: ไม่พบ = คืนค่าว่าง (ไม่ใช่ undefined)', S.expandShortcodes('[field:ไม่มีจริง]', ctx) === '');
  check('★★ relation: รวมทุกชื่อที่ผูกด้วยบทบาทเดียวกัน',
        S.expandShortcodes('[relation:เพื่อน]', ctx) === 'ลูน่า, นาซารีน่า');
  check('relation: บทบาทเดียว', S.expandShortcodes('[relation:คู่รัก]', ctx) === 'คัสซี่');
  check('relation: บทบาทที่ไม่มี = ว่าง', S.expandShortcodes('[relation:ศัตรู]', ctx) === '');
  check('title/author ยังใช้ได้จาก entityContext (workContext ใช้ร่วมกัน)',
        S.expandShortcodes('[title] โดย [author]', ctx) === 'ดาบเจ็ดสี โดย ท็อป');
  check('★ wiki:/var: ยังใช้งานข้ามเอนทิตี้ได้ในบริบทนี้ (ตาราง vars เดียวกันทั้งแอป)',
        S.expandShortcodes('[wiki:โทระ.อายุ]', ctx) === '20');
  check('entityContext ไม่ส่งอะไรมาก็ไม่พัง (เอนทิตี้ว่าง)',
        S.expandShortcodes('[entity][field:x]', S.entityContext({})) === '');
  check('ทุกฟิลด์ของ SHORTCODES ที่กลุ่ม wiki ครอบคลุมทั้ง Wiki-lookup และ entity-lookup',
        S.SHORTCODES.filter((s) => s.group === 'wiki').map((s) => s.name).sort().join(',')
        === ['entity', 'entitycat', 'entitysummary', 'entitytags', 'field', 'relation', 'var', 'wiki'].sort().join(','));
}

console.log(`shortcode: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
