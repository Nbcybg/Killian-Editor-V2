// test/trial-fixes.test.cjs — [alpha.170 · ลองใช้โปรแกรมจริง] ของที่แก้หลังรอบ "ใช้แบบผู้ใช้ ไม่ใช่ e2e"
//
// ที่มา: เปิดแอปจริง (โปรไฟล์แยก + CDP) สร้างผลงาน เขียนนิยาย/บทภาพยนตร์ ใช้ AI ทุกเมนูกับผู้ให้บริการจริง
// ส่งออกทุกรูปแบบแล้วเปิดอ่าน — ไม่มี error ของ JavaScript สักตัว แต่ของพังอยู่ในที่ที่เทสอัตโนมัติมองไม่เห็น:
//   · ฉากที่ AI เขียนมีย่อหน้าว่างคั่นทุกย่อหน้า · AI วิเคราะห์โชว์ "[]" ดิบ
//   · ปุ่มลอย + ทับปุ่ม "ส่ง" ของแผงที่ผนึกฝั่งขวา · ตรวจ Plot Hole ส่งทั้งเรื่องโดยไม่ถามขอบเขต
//   · พิมพ์ "ภายใน ห้อง…" ไม่ถูกจับเป็นหัวฉาก · คำตอบ AI ที่ล้มทั้งก้อนค้างเป็นฟองว่างและกดลองใหม่ไม่ได้
//   · หน้า Wiki ไม่ถูกกู้หลังเปิดโปรแกรมใหม่ · โฟลเดอร์ของ Story Starter ชื่อ "ยังไม่ได้ตั้งชื่อ" ตลอดไป
// (PDF ภาษาไทย → pdf-thai-shape · คำตอบว่างของโมเดลที่คิดก่อนตอบ → ai-thinking)
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const { parseCsv } = require('../tools/csv-lite.cjs');

function load(name) {
  const tmp = path.join(os.tmpdir(), 'k2-' + name.replace(/[\\/]/g, '-') + '-trial-test.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', name + '.js')],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
}
const src = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ───────── ร้อยแก้วที่ AI เขียน ─────────
{
  const P = load('ai/ai-prose');
  check('★ บรรทัดว่างหนึ่งบรรทัดระหว่างย่อหน้า = ตัวคั่น (ตัดทิ้ง)', P.aiProseText('ก\n\nข\n\nค') === 'ก\nข\nค', JSON.stringify(P.aiProseText('ก\n\nข\n\nค')));
  check('สองบรรทัดว่างขึ้นไป = ตั้งใจเว้น (เหลือหนึ่ง)', P.aiProseText('ก\n\n\nข\n\n\n\n\nค') === 'ก\n\nข\n\nค');
  check('CRLF + ช่องว่างท้ายบรรทัดไม่ทำให้นับพลาด', P.aiProseText('ก  \r\n\r\nข\t\r\n') === 'ก\nข');
  check('ตัดบรรทัดว่างหัว/ท้าย', P.aiProseText('\n\nก\nข\n\n') === 'ก\nข');
  check('ย่อหน้าที่ติดกันอยู่แล้วไม่ถูกแตะ', P.aiProseText('ก\nข') === 'ก\nข');
  check('null/undefined ไม่พัง', P.aiProseText(null) === '' && P.aiProseText(undefined) === '');
  check('★ ต่อท้ายฉาก = ขึ้นย่อหน้าใหม่ ไม่มีย่อหน้าว่างคั่น', P.appendProse('เดิม\n', 'ใหม่หนึ่ง\n\nใหม่สอง') === 'เดิม\nใหม่หนึ่ง\nใหม่สอง');
  check('ฉากว่าง + ข้อความใหม่ = ข้อความใหม่ล้วน', P.appendProse('', 'ก\n\nข') === 'ก\nข' && P.appendProse('  \n', 'ก') === 'ก');
  check('ไม่มีอะไรจะต่อ = เนื้อเดิม (ไม่มีบรรทัดว่างงอก)', P.appendProse('เดิม\n\n', '') === 'เดิม');

  check('★ "[]" = ไม่มีข้อสังเกต (ไม่ใช่ข้อความให้โชว์)', P.isEmptyJsonReply('[]') && P.isEmptyJsonReply(' [ ] ') && P.isEmptyJsonReply('{}'));
  check('JSON ว่างในรั้วโค้ดก็นับ', P.isEmptyJsonReply('```json\n[]\n```') && P.isEmptyJsonReply('```\n{ }\n```'));
  check('มีเนื้อ = ไม่ใช่', !P.isEmptyJsonReply('[{"a":1}]') && !P.isEmptyJsonReply('ไม่มีอะไรผิดปกติ') && !P.isEmptyJsonReply(''));
}

// ───────── ปุ่มลอย + เกาะพื้นที่เอกสาร ─────────
{
  const F = load('toolbar/fmtbar-pos');
  check('★ มีแผงผนึกฝั่งขวา 440px → ปุ่มขยับเข้ามาอยู่ในพื้นที่เอกสาร',
        F.fabHomeRight({ left: 300, right: 1000 }, 1440) === 440 + 28, String(F.fabHomeRight({ left: 300, right: 1000 }, 1440)));
  check('พื้นที่เอกสารชิดขอบขวาหน้าต่าง = ใช้ค่าของ CSS', F.fabHomeRight({ left: 300, right: 1440 }, 1440) === null
        && F.fabHomeRight({ left: 300, right: 1437 }, 1440) === null);
  check('วัดไม่ได้ = ใช้ค่าของ CSS', F.fabHomeRight(null, 1440) === null && F.fabHomeRight({ left: 5, right: 5 }, 1440) === null
        && F.fabHomeRight({ left: 0, right: 100 }, 0) === null);
  const narrow = F.fabHomeRight({ left: 900, right: 980 }, 1440);       // พื้นที่เอกสารกว้าง 80 < 52 + 56
  check('พื้นที่เอกสารแคบ: ปุ่มยังอยู่ข้างใน (ไม่ทับแผงขวา)', narrow >= 460 + 4 && narrow + 52 <= 1440 - 900, String(narrow));
}

// ───────── ขอบเขตของเครื่องมือ AI ─────────
{
  const S = load('ai/ai-scope');
  const all = [
    { path: 'C:\\p\\B1\\Draft\\d\\Chapters\\c1\\a.md', section: 'B1', chapterId: 'c1', text: 'หนึ่ง' },
    { path: 'C:\\p\\B1\\Draft\\d\\Chapters\\c1\\b.md', section: 'B1', chapterId: 'c1', text: 'สอง' },
    { path: 'C:\\p\\B1\\Draft\\d\\Chapters\\c2\\c.md', section: 'B1', chapterId: 'c2', text: 'สาม' },
    { path: 'C:\\p\\B2\\Draft\\d\\Chapters\\c1\\d.md', section: 'B2', chapterId: 'c1', text: 'สี่' },
    { path: 'C:\\p\\B2\\Draft\\d\\Chapters\\c1\\e.md', section: 'B2', chapterId: 'c1', text: '   ' },
  ];
  const here = 'c:/p/B1/Draft/d/Chapters/c1/a.md';            // คนละตัวคั่น คนละตัวพิมพ์กับในรายการ
  const n = (scope, at) => S.scopeScenes(all, scope, at).map((s) => s.text).join(',');
  check('ทั้งโปรเจกต์ = ทุกฉากที่มีเนื้อ (ฉากว่างไม่ส่ง)', n('project', here) === 'หนึ่ง,สอง,สาม,สี่');
  check('★ เฉพาะเล่ม = ฉากของเล่มที่แท็บอยู่', n('book', here) === 'หนึ่ง,สอง,สาม');
  check('★ เฉพาะบท = เล่มเดียวกัน + บทเดียวกัน (บทชื่อ c1 ของเล่มอื่นไม่ติดมา)', n('chapter', here) === 'หนึ่ง,สอง');
  check('★ เฉพาะฉาก = ฉากของแท็บ', n('scene', here) === 'หนึ่ง');
  check('★ ไม่มีแท็บฉากเปิดอยู่: ขอบเขตที่ต้องมีแท็บได้รายการว่าง ไม่ใช่ทั้งโปรเจกต์',
        n('book', '') === '' && n('chapter', '') === '' && n('scene', 'C:/p/Wiki/characters/x.json') === '');
  check('รายการเสีย/ว่างไม่พัง', S.scopeScenes(null, 'project', '').length === 0 && S.scopeScenes([], 'scene', here).length === 0);
}

// ───────── หัวฉากที่พิมพ์เป็นภาษาไทย ─────────
{
  const F = load('fountain');
  const yes = ['INT. ห้องครัว - กลางวัน', 'ext. ถนน', 'INT./EXT. รถ', 'I/E. รถ', 'EST. เมือง', 'ฉาก 1 ห้องนอน',
               'ภายใน ห้องนั่งเล่น - กลางคืน', 'ภายนอก สะพานพุทธ - เช้า', 'ฉากภายใน บ้าน', 'ฉากภายนอก ตลาด'];
  const no = ['ภายใน', 'ภายใน ', 'ภายในบ้านเงียบสนิท', 'ฉากนี้สำคัญ', 'internal affairs', 'เขาเดินเข้ามาภายใน ห้อง', '', 'INT.'];
  check('★ พิมพ์ขึ้นต้นแบบหัวฉาก (อังกฤษ + ไทย) = หัวฉาก', yes.every((x) => F.typedSceneHeading(x)), yes.filter((x) => !F.typedSceneHeading(x)).join(' | '));
  check('★ ประโยคธรรมดา/ยังพิมพ์ไม่ถึงชื่อสถานที่ = ไม่ใช่', no.every((x) => !F.typedSceneHeading(x)), no.filter((x) => F.typedSceneHeading(x)).join(' | '));
  check('กฎการอ่านไฟล์ไม่ถูกขยาย (SCENE_PREFIX เท่าเดิม — ไฟล์ที่มีอยู่ไม่ถูกตีความใหม่)',
        !F.SCENE_PREFIX.includes('ภายใน ') && !F.SCENE_PREFIX.includes('ภายนอก ') && F.SCENE_PREFIX.length === 8, F.SCENE_PREFIX.join('|'));
  const sp = src('src/screenplay.js');
  check('ตัวแก้ไขบทใช้ตัวตัดสินตัวเดียวกัน (ไม่มี regex หัวฉากชุดที่สอง)',
        /typedSceneHeading\(text\)/.test(sp) && !/\^\(int\\\.\|ext\\\./.test(sp));
  check('★ เปลี่ยนชนิดบล็อกที่ยังว่าง → ปรับบรรทัดว่างนำตามชนิดใหม่ (ธุรกรรมเดียว)',
        /_fitLeadBlanks\(tr, b, el\)/.test(sp) && /lead\.length !== had/.test(sp));
}

// ───────── แชท AI: คำตอบที่ล้มทั้งก้อน ─────────
{
  const A = load('ai/ai-session');
  const u = { id: 'u1', role: 'user', text: 'ถาม' };
  const bad = { id: 'a1', role: 'assistant', text: '', error: 'HTTP 400' };
  const part = { id: 'a2', role: 'assistant', text: 'ครึ่ง', error: 'หมดเวลา', partial: true };
  const sess = (...m) => ({ id: 's', messages: m });
  check('★ ล้มทั้งก้อน + เป็นข้อความล่าสุด = ลองใหม่ได้', A.canRetry(sess(u, bad), bad) === true);
  check('มีข้อความมาบ้างแล้ว = ใช้ปุ่ม "ต่อ" ไม่ใช่ลองใหม่', A.canRetry(sess(u, part), part) === false && A.canContinue(sess(u, part), part) === true);
  check('ไม่ใช่ข้อความล่าสุด = ลองใหม่ไม่ได้', A.canRetry(sess(u, bad, { id: 'u2', role: 'user', text: 'ถามใหม่' }), bad) === false);
  check('ผลคำสั่งที่ป้อนกลับไม่นับเป็น "ข้อความล่าสุด"',
        A.canRetry(sess(u, bad, { id: 't', role: 'user', text: 'ผล', toolResult: true }), bad) === true);
  check('คำตอบปกติ/ของผู้ใช้ = ลองใหม่ไม่ได้', !A.canRetry(sess(u, { id: 'a', role: 'assistant', text: 'ตอบ' }), { id: 'a', role: 'assistant', text: 'ตอบ' })
        && !A.canRetry(sess(u), u) && !A.canRetry(null, bad));
  const dropped = A.dropMessage(sess(u, bad), 'a1');
  check('ถอดข้อความที่ล้ม = เหลือคำถามเดิม (ไม่แก้เซสชันเดิม)', dropped.messages.length === 1 && dropped.messages[0].id === 'u1');
  const hist = A.buildChatMessages(sess(u, bad, { id: 'u2', role: 'user', text: 'อีกที' }), { maxTokens: 1e9 });
  check('★ คำตอบว่างที่ล้มไม่ถูกส่งกลับเป็น "ผู้ช่วยตอบว่าง" (ผู้ให้บริการหลายเจ้าปฏิเสธด้วย 400)',
        hist.messages.length === 2 && hist.messages.every((m) => m.role === 'user' && m.content), JSON.stringify(hist.messages));
  const panel = src('src/ai/ai-chat-panel.js');
  check('แผงแชท: ไม่มีฟองว่างเหนือข้อความผิดพลาด + มีปุ่มลองใหม่',
        /if \(!shown && m\.error\) \{ txt\.remove\(\)/.test(panel) && /canRetry\(sess, m\)/.test(panel) && /export async function retryReply/.test(panel));
  check('แผงแชท: โปรเจกต์ที่ยังไม่มีเซสชันเปิดมามีช่องพิมพ์ทันที — ครั้งเดียวต่อโปรเจกต์',
        /!S\.sessions\.length && S\.autoRoot !== state\.root/.test(panel));
}

// ───────── Story Starter ─────────
{
  const M = load('starter/starter-model');
  const T = load('starter/starter-tags');
  const D = load('starter/starter-steps-def');
  const PH = ['ยังไม่ได้ตั้งชื่อ'];
  check('ชื่อโฟลเดอร์ชั่วคราว (รวมตัวที่ต่อเลขเพราะชน)', M.isPlaceholderSlug('ยังไม่ได้ตั้งชื่อ', PH) && M.isPlaceholderSlug('ยังไม่ได้ตั้งชื่อ-3', PH)
        && M.isPlaceholderSlug('starter', PH) && M.isPlaceholderSlug('starter-2', PH));
  check('ชื่อจริงไม่ใช่ชื่อชั่วคราว', !M.isPlaceholderSlug('เงาจันทร์', PH) && !M.isPlaceholderSlug('เงาจันทร์-2', PH) && !M.isPlaceholderSlug('', PH));
  check('★ ตั้งชื่อครั้งแรก = ย้ายโฟลเดอร์ตามชื่อ', M.shouldAdoptName({ slug: 'ยังไม่ได้ตั้งชื่อ-2', name: 'เงาจันทร์', done: false }, PH) === true);
  check('★ โฟลเดอร์มีชื่อจริงแล้ว = เปลี่ยนชื่อเรื่องทีหลังไม่ย้าย (กติกาเดิม)', M.shouldAdoptName({ slug: 'เงาจันทร์', name: 'ชื่อใหม่' }, PH) === false);
  check('★ เรื่องที่ทำ wizard เสร็จแล้วไม่ย้าย (มีของข้างนอกอ้างชื่อโฟลเดอร์)', M.shouldAdoptName({ slug: 'ยังไม่ได้ตั้งชื่อ', name: 'เงาจันทร์', done: true }, PH) === false);
  check('ยังไม่ตั้งชื่อ/ชื่อเป็นคำชั่วคราวเอง = ไม่ย้าย', !M.shouldAdoptName({ slug: 'ยังไม่ได้ตั้งชื่อ', name: '  ' }, PH)
        && !M.shouldAdoptName({ slug: 'ยังไม่ได้ตั้งชื่อ-2', name: 'ยังไม่ได้ตั้งชื่อ' }, PH) && !M.shouldAdoptName(null, PH));

  const tags = D.presetTags();
  check('★ แท็กสำเร็จรูปทุกตัวมีป้ายในตาราง', tags.length >= 30 && tags.every((x) => T.TAG_LABEL_KEYS[x]), tags.filter((x) => !T.TAG_LABEL_KEYS[x]).join(','));
  check('ตารางไม่มีแท็กที่ไม่มีอยู่จริง', Object.keys(T.TAG_LABEL_KEYS).every((x) => tags.includes(x)));
  check('★ ป้ายเป็นภาษาของหน้าจอ · ค่าของแท็กไม่ถูกแตะ', T.tagLabel('fantasy') === 'แฟนตาซี' && T.tagLabel('Slice of Life') === 'ชีวิตประจำวัน');
  check('แท็กที่ผู้ใช้พิมพ์เอง = โชว์ตามที่พิมพ์', T.tagLabel('แมวเหมียว') === 'แมวเหมียว' && T.tagLabel('') === '' && T.tagLabel(null) === '');
  check('สรุปบนการ์ดใช้ป้ายเดียวกัน', M.starterSummary({ cast: [], tags: ['fantasy', 'dark'] }).includes('แฟนตาซี · มืดหม่น'), M.starterSummary({ cast: [], tags: ['fantasy', 'dark'] }));
}

// ───────── ไฟล์ภาษา: คีย์ของรอบนี้ครบทุกภาษา และไม่มีไทยค้างในภาษาอื่น ─────────
{
  const dir = path.join(__dirname, '..', 'languages');
  const files = fs.readdirSync(dir).filter((f) => /^k2_[a-z]+\.csv$/.test(f));
  const NEED = ['ui.common.discardChangesAsk', 'ui.xhub.needScriptHint', 'ui.panel.layoutRestored',
    'ui.ai.replaceSelection', 'ui.ai.stop', 'ui.ai.runAgain', 'ui.ai.startCheck', 'ui.ai.scopeLabel', 'ui.ai.scopeProject',
    'ui.ai.scopeBook', 'ui.ai.scopeChapter', 'ui.ai.scopeScene', 'ui.ai.scopeSummary', 'ui.ai.scopeEmpty', 'ui.ai.checkedScenes',
    'ui.ai.pickCharacter', 'ui.ai.noCharacters', 'ui.ai.wikiProfileUsed', 'ui.ai.replyCut', 'ui.ai.replyUnreadable',
    'ui.aiProvider.emptyReply', 'ui.aiProvider.testChatOk', 'ui.aiProvider.testChatFail', 'ui.aiProvider.apiKind',
    'ui.aiProvider.preset', 'ui.aiProvider.saveCredential', 'ui.aiProvider.showKey', 'ui.aiProvider.hideKey',
    'ui.aiError.missingHeader', 'ui.aiError.wrongProtocol',
    ...Object.values(load('starter/starter-tags').TAG_LABEL_KEYS)];
  const THAI = /[\u0E00-\u0E7F]/;
  const missing = [], thaiLeft = [];
  for (const f of files) {
    const rows = new Map(parseCsv(fs.readFileSync(path.join(dir, f), 'utf8')).map((r) => [String(r[0] || ''), String(r[1] || '')]));
    for (const k of NEED) {
      if (!rows.get(k)) missing.push(f + ':' + k);
      else if (f !== 'k2_th.csv' && THAI.test(rows.get(k))) thaiLeft.push(f + ':' + k);
    }
  }
  check('★ คีย์ของรอบนี้มีครบทุกไฟล์ภาษา (' + files.length + ' ภาษา)', files.length >= 7 && missing.length === 0, missing.slice(0, 8).join(' '));
  check('★ ภาษาอื่นไม่มีข้อความไทยค้างในคีย์ของรอบนี้', thaiLeft.length === 0, thaiLeft.slice(0, 8).join(' '));
  const th = new Map(parseCsv(fs.readFileSync(path.join(dir, 'k2_th.csv'), 'utf8')).map((r) => [String(r[0] || ''), String(r[1] || '')]));
  check('คำอธิบายเทมเพลตฉบับไทยไม่มีอังกฤษปน', ['ui.project.novelFantasyWorldbuilding', 'ui.project.novelInvestigateCharacterSuspect', 'ui.project.structureChapterFilmAct']
        .every((k) => th.get(k) && !/[A-Za-z]{4,}/.test(th.get(k))));
  check('คำใบ้ฟอนต์บทภาพยนตร์ตรงกับค่าเริ่มต้นจริง (Courier Prime)', /Courier Prime/.test(th.get('ui.settings.spFontFamilyHint')) && !/Courier New/.test(th.get('ui.settings.spFontFamilyHint')));
  const en = new Map(parseCsv(fs.readFileSync(path.join(dir, 'k2_en.csv'), 'utf8')).map((r) => [String(r[0] || ''), String(r[1] || '')]));
  check('อังกฤษ: ไม่มี "item are unsaved" / ปุ่ม "Staying"', !/\} are unsaved/.test(en.get('ui.app.closeAppHasList')) && en.get('ui.app.notOutDone') !== 'Staying',
        en.get('ui.app.closeAppHasList') + ' | ' + en.get('ui.app.notOutDone'));
}

// ───────── กวาดซอร์ส: ของที่ต้องไม่ย้อนกลับ ─────────
{
  const app = src('src/app.js');
  check('★ แท็บที่จำข้ามรอบรวมหน้า Wiki (ทั้งเซสชันและรายการในไฟล์โปรเจกต์ใช้ตัวเดียวกัน)',
        /function sessionTabKeys\(\)/.test(app) && /s\.tabs\.open = sessionTabKeys\(\);/.test(app) && /const tabs = sessionTabKeys\(\);/.test(app)
        && !/s\.tabs\.open = \[\.\.\.state\.tabs\.keys\(\)\]/.test(app));
  check('จำนวนฉากบนแถบสถานะตามทะเบียนฉาก (ไม่ใช่เฉพาะตอนเปิดโปรเจกต์)', /endsWith\('scenes\.json'\)\) scheduleSceneCount\(\)/.test(app) && /watchSceneCount\(\);/.test(app));
  check('สลับโหมดเอกสารแล้วป้ายโหมดบนแถบสถานะตามทันที', /refreshModeBtn\(\); scheduleCount\(\); scheduleOutline\(\);\s+updateSaveStatus\(\);/.test(app));
  check('รีเซ็ตการจัดวางแผงจากเมนู = มีทางย้อนกลับ', /case 'reset-panels': resetPanelsWithUndo\(\);/.test(app)
        && /export function resetPanelsWithUndo/.test(src('src/panels/panel-ui.js')));
  check('กล่องปิดแท็บที่ยังไม่บันทึก: ปุ่มหลักอยู่ขวาสุด (ยกเลิก · ไม่บันทึก · บันทึก)',
        /closeTabDirtyAsk[\s\S]{0,200}ui\.common\.cancel[\s\S]{0,120}closeTabDiscard[\s\S]{0,120}closeTabSave/.test(app));
  const ui = src('src/ui.js');
  check('★ choose(): มีปุ่มหลักในชุด = ปุ่มอันตรายไม่ติด k-ok (Enter ต้องไม่ตกที่ "ไม่บันทึก")',
        /hasPrimary \? 'k-danger k-discard' : 'k-ok k-danger'/.test(ui));
  check('สถานะว่างของพื้นที่เอกสาร: แดชบอร์ดเปิดอยู่แล้ว = ไม่มีปุ่มเปิดแดชบอร์ดซ้ำ', /if \(!dashOpen\) acts\.append\(btn\('cmp-mini', tt\('ui\.app\.docsEmptyDashboard'\)/.test(app));

  const main = src('main.js'), html = src('renderer/index.html');
  check('★ เมนู AI มาก่อน "ช่วยเหลือ" — เมนูระบบ', main.indexOf("{ id: 'AI', label: 'AI'") > 0 && main.indexOf("{ id: 'AI', label: 'AI'") < main.indexOf("{ id: 'Help',"));
  check('★ เมนู AI มาก่อน "ช่วยเหลือ" — แถบชื่อ (ลำดับเดียวกับเมนูระบบ)', html.indexOf('data-m="AI"') > 0 && html.indexOf('data-m="AI"') < html.indexOf('data-m="Help"'));

  const hub = src('src/export-hub.js');
  check('ศูนย์ส่งออก: ปลายทางที่ใช้ไม่ได้ = ปุ่มส่งออกกดไม่ได้ + เหตุผลอยู่ในกล่อง', /bGo\.disabled = bad;/.test(hub) && /ui\.xhub\.needScriptHint/.test(hub) && /sayIn\(tt\('ui\.xhub\.exportFail'\)/.test(hub));
  const dlg = src('src/dialogs.js');
  check('กล่องตั้งค่า: คลิกนอกกล่องตอนมีค่าที่แก้ค้าง = ถามก่อน', /ui\.common\.discardChangesAsk/.test(dlg));
  const prov = src('src/ai/ai-provider-ui.js');
  check('ตั้งค่า AI: ปิดกล่องตอนมีค่าที่แก้ค้าง = ถามก่อน · ผู้ให้บริการถูกบันทึกทันทีที่เพิ่ม/แก้/ลบ', /ui\.common\.discardChangesAsk/.test(prov) && /saveRows/.test(prov));
  const dlgb = src('src/dialogue/builder-ui.js');
  check('ห้องซ้อมบท: แวะสร้างคณะแล้วกลับมากล่องเซสชันเดิมพร้อมของที่กรอกไว้', /presetManager\(\(\) => newSessionFlow\(back\)\)/.test(dlgb) && /btns\.append\(cancel, ok\)/.test(dlgb));
  check('ห้องซ้อมบท: ชื่อหมวดของ Wiki เป็นภาษาของหน้าจอ (ไม่ใช่ชื่อโฟลเดอร์ดิบ)', /CAT_TH\[r\.cat\] \|\| r\.cat/.test(dlgb));
  const ana = src('src/ai-analyzer-ui.js'), doc = src('src/ai-doctor-ui.js');
  check('AI วิเคราะห์: แถบของคะแนนที่มีสเกลตายตัววาดเทียบเพดานสเกล', /opts\.max > 0 \? opts\.max/.test(ana) && /\{ max: 10 \}/.test(ana) && /\{ max: 100 \}/.test(doc));

  const css = src('renderer/style.css');
  check('ไฮไลต์คำค้นบนกระดาษผสมจากสีกระดาษ (ไม่ใช้สีของธีมมืดทับหมึกดำ)',
        /body\.paper-mode \.pane\.k-paper:not\(\.wiki-pane\) \.ProseMirror \.find-hit\s*\{\s*background:color-mix\(in srgb, var\(--st-warn\) \d+%, var\(--paper\)\)/.test(css));
  check('กล่องเครื่องมือ AI กว้างคงที่ (ไม่กระโดดตามเนื้อ)', /\.k-dialog\.k-ai-dlg/.test(css) && /\.k-dialog\.k-ai-summary \{ width:min\(/.test(css));
}

console.log('\ntrial-fixes: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
