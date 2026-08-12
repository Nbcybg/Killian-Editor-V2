// test/tools.test.cjs — ทดสอบ thesaurus (ข้อ 67) · import-scrivener (ข้อ 63) · comment-core (ข้อ 64)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const build = (src, name) => {
  const out = path.join(os.tmpdir(), name);
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/' + src)], outfile: out,
    format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const TH = build('tools/thesaurus.js', '_thes.cjs');
const SC = build('import/import-scrivener.js', '_scriv.cjs');
const CM = build('comments/comment-core.js', '_cmt.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };
const memStorage = () => { const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

// ════════ ข้อ 67: Thesaurus ════════
check('thes: แยกคำอังกฤษ/ไทย', TH.isEnglish('happy') && !TH.isEnglish('ดีใจ') && TH.isThai('ดีใจ'));
check('thes: normalize ตัดเครื่องหมาย', TH.normalizeWord('  Happy!  ') === 'happy');
check('thes: คลังไทยในตัว', TH.localLookup('สวย').includes('งดงาม'));
check('thes: คำตรงข้ามไทย', TH.localLookup('ใหญ่', 'ant').includes('เล็ก'));
check('thes: คลังอังกฤษในตัว', TH.localLookup('big').includes('huge'));
check('thes: ค้นย้อนกลับ (คำที่เป็นคำพ้องของคำอื่น)', TH.localLookup('งดงาม').includes('สวย'), JSON.stringify(TH.localLookup('งดงาม')));
check('thes: ไม่คืนคำตัวเอง', !TH.localLookup('สวย').includes('สวย'));
check('thes: คำที่ไม่มีในคลัง → []', TH.localLookup('คำแปลกประหลาดที่ไม่มีจริง').length === 0);
check('thes: คลังเสริมจากผู้ใช้', TH.localLookup('ดาบ', 'syn', { synonyms: { 'ดาบ': ['กระบี่'] } }).includes('กระบี่'));

check('thes: datamuseUrl ถูก (คำพ้อง)', TH.datamuseUrl('happy').includes('ml=happy'));
check('thes: datamuseUrl ถูก (คำตรงข้าม)', TH.datamuseUrl('happy', 'ant').includes('rel_ant=happy'));
check('thes: parseDatamuse', TH.parseDatamuse('[{"word":"glad"},{"word":"joyful"}]').join() === 'glad,joyful');
check('thes: parseDatamuse ตัดคำตัวเอง', TH.parseDatamuse('[{"word":"happy"},{"word":"glad"}]', 'happy').join() === 'glad');
check('thes: parseDatamuse ของพัง → []', TH.parseDatamuse('ไม่ใช่ json').length === 0 && TH.parseDatamuse(null).length === 0);

let clock = 1000;
const cache = new TH.ThesaurusCache({ storage: memStorage(), ttl: 100, max: 2, now: () => clock });
cache.set('a', 'syn', ['x']);
check('cache: get คืนของที่เก็บ', cache.get('a', 'syn').join() === 'x');
clock += 200;
check('cache: หมดอายุ → null', cache.get('a', 'syn') === null);
clock = 1000;
cache.set('a', 'syn', ['1']); clock++; cache.set('b', 'syn', ['2']); clock++; cache.set('c', 'syn', ['3']);
check('cache: เกินโควตา → ทิ้งของเก่าสุด', cache.size === 2 && cache.get('a', 'syn') === null && cache.get('c', 'syn'), 'size=' + cache.size);
const st = memStorage();
new TH.ThesaurusCache({ storage: st, now: () => clock }).set('k', 'syn', ['v']);
check('cache: อยู่ข้ามรอบ (localStorage)', new TH.ThesaurusCache({ storage: st, now: () => clock }).get('k', 'syn').join() === 'v');

(async () => {
  // ออฟไลน์ล้วน (ค่าเริ่มต้น: ไม่ยิงเน็ต)
  let hits = 0;
  const http = { fetch: async () => { hits++; return { ok: true, body: '[{"word":"glad"}]' }; } };
  let t = new TH.Thesaurus({ http, storage: memStorage() });
  check('thes: ค่าเริ่มต้นไม่ยิงเน็ต', (await t.getSynonyms('happy')).length > 0 && hits === 0);
  check('thes: คำไทยไม่ยิงเน็ตเด็ดขาด', (await t.getSynonyms('สวย')).includes('งดงาม') && hits === 0);

  t = new TH.Thesaurus({ http, storage: memStorage(), online: true });
  let syn = await t.getSynonyms('happy');
  check('thes: เปิด online → ใช้ Datamuse', hits === 1 && syn.includes('glad'), JSON.stringify(syn));
  check('thes: ผสมคลังในตัวกับผลออนไลน์', syn.includes('joyful') || syn.includes('glad'));
  await t.getSynonyms('happy');
  check('thes: ครั้งที่สองใช้แคช ไม่ยิงซ้ำ', hits === 1);
  check('thes: lookup บอกที่มา', (await t.lookup('happy')).source === 'cache');

  const deadHttp = { fetch: async () => { throw new Error('เน็ตล่ม'); } };
  t = new TH.Thesaurus({ http: deadHttp, storage: memStorage(), online: true });
  syn = await t.getSynonyms('big');
  check('thes: เน็ตล่ม → ตกไปคลังในตัว ไม่ throw', syn.includes('huge'));
  check('thes: คำที่ไม่มีเลย → [] + source none', (await t.lookup('zzzqqq')).source === 'none');

  t = new TH.Thesaurus({ storage: memStorage(), providers: [{ name: 'wordnet', lookup: async (w) => (w === 'dog' ? ['hound', 'canine'] : []) }] });
  check('thes: provider ในเครื่อง (WordNet) ถูกใช้ก่อนเน็ต', (await t.getSynonyms('dog')).includes('hound'));
  t = new TH.Thesaurus({ storage: memStorage(), providers: [{ name: 'พัง', lookup: async () => { throw new Error('x'); } }] });
  check('thes: provider พัง → ไม่ล้มทั้งระบบ', (await t.getSynonyms('big')).includes('huge'));
  check('thes: getAntonyms', (await new TH.Thesaurus({ storage: memStorage() }).getAntonyms('สวย')).includes('ขี้เหร่'));

  const io0 = { join: (...a) => a.join('/'), exists: async (p) => p === 'R/Plugins/thesaurus.json',
    readJson: async () => ({ synonyms: { 'กระบี่': ['ดาบ'] } }) };
  const extra = await TH.loadExtra(io0, 'R');
  check('thes: โหลดคลังเสริมจาก Plugins/thesaurus.json', extra.synonyms['กระบี่'].join() === 'ดาบ');
  check('thes: ไม่มีไฟล์เสริม → null ไม่ throw', (await TH.loadExtra(io0, 'ว่าง')) === null);

  // ════════ ข้อ 63: Scrivener ════════
  const xml = `<?xml version="1.0"?>
<ScrivenerProject>
 <Binder>
  <BinderItem UUID="D1" Type="DraftFolder">
   <Title>Draft</Title>
   <Children>
    <BinderItem UUID="C1" Type="Folder">
     <Title>บทที่หนึ่ง</Title>
     <Children>
      <BinderItem UUID="S1" Type="Text"><Title>ตลาดเก่า</Title>
        <MetaData><IncludeInCompile>Yes</IncludeInCompile></MetaData></BinderItem>
      <BinderItem UUID="S2" Type="Text"><Title>ร้านชำ &amp; ของเก่า</Title>
        <MetaData><IncludeInCompile>No</IncludeInCompile></MetaData></BinderItem>
     </Children>
    </BinderItem>
    <BinderItem UUID="S3" Type="Text"><Title>ฉากลอย</Title></BinderItem>
   </Children>
  </BinderItem>
  <BinderItem UUID="R1" Type="ResearchFolder"><Title>Research</Title></BinderItem>
 </Binder>
</ScrivenerProject>`;
  const binder = SC.parseBinder(xml);
  check('scriv: อ่าน binder ได้', binder.length === 2 && binder[0].type === 'DraftFolder');
  check('scriv: ชื่อไทยถูกต้อง', binder[0].children[0].title === 'บทที่หนึ่ง');
  check('scriv: decode entity (&amp;)', binder[0].children[0].children[1].title === 'ร้านชำ & ของเก่า');
  check('scriv: อ่าน IncludeInCompile', binder[0].children[0].children[0].include === true && binder[0].children[0].children[1].include === false);
  check('scriv: XML พัง → ไม่ throw', Array.isArray(SC.parseBinder('<Binder><BinderItem')));

  let mapped = SC.mapBinder(binder, {});
  check('scriv: โฟลเดอร์ → บท, เอกสาร → ฉาก', mapped.counts.chapters === 2 && mapped.counts.scenes === 3, JSON.stringify(mapped.counts));
  check('scriv: เอกสารนอกโฟลเดอร์ไปอยู่บท "(ไม่มีบท)"', mapped.sections[0].chapters.some((c) => c.title === '(ไม่มีบท)'));
  check('scriv: ข้าม Research (นอก Draft)', !JSON.stringify(mapped).includes('Research'));
  mapped = SC.mapBinder(binder, { onlyCompiled: true });
  check('scriv: onlyCompiled ตัดเอกสารที่ไม่ติ๊ก compile', mapped.counts.scenes === 2);

  // RTF → ข้อความ (ไทยเป็น \uNNNN ทั้งหมด)
  // ไทยใน RTF เป็น \uNNNN ล้วน: 3605=ต 3621=ล 3634=า 3604=ด · 3648=เ 3636=ิ 3609=น
  const rtfThai = '{\\rtf1\\ansi\\uc1{\\fonttbl{\\f0 Arial;}}\\f0 \\u3605 ?\\u3621 ?\\u3634 ?\\u3604 ?\\par \\u3648 ?\\u3604 ?\\u3636 ?\\u3609 ?\\tab X\\par}';
  const text = SC.rtfToText(rtfThai);
  check('scriv: RTF ไทย \\uNNNN → ข้อความจริง', text.includes('ตลาด') && text.includes('เดิน'), JSON.stringify(text));
  check('scriv: \\par → ขึ้นบรรทัดใหม่', text.split('\n').length === 2, JSON.stringify(text));
  check('scriv: ข้าม fonttbl', !text.includes('Arial'));
  check('scriv: \\tab → แท็บ', text.includes('\t'));
  check('scriv: \\\'xx (ANSI) → ตัวอักษร', SC.rtfToText("{\\rtf1 h\\'65llo}").includes('hello'));
  check('scriv: {\\*\\ignore} ถูกข้าม', !SC.rtfToText('{\\rtf1 A{\\*\\bkmkstart zzz}B}').includes('zzz'));
  check('scriv: RTF ว่าง → สตริงว่าง', SC.rtfToText('') === '' && SC.rtfToText(null) === '');

  // นำเข้าเต็มรูปแบบด้วย mock fs
  const files = {
    'P/หนังสือ.scrivx': xml,
    'P/Files/Data/S1/content.rtf': '{\\rtf1\\ansi\\uc1 \\u3605 ?\\u3621 ?\\u3634 ?\\u3604 ?\\par}',
    'P/Files/Docs/S3.rtf': '{\\rtf1\\ansi hello loose}',
  };
  const written = {};
  const io = {
    join: (...a) => a.filter(Boolean).join('/'),
    exists: async (p) => p in files,
    listFiles: async (p) => Object.keys(files).filter((f) => f.startsWith(p + '/') && !f.slice(p.length + 1).includes('/')).map((f) => f.slice(p.length + 1)),
    readFile: async (p) => files[p],
    writeFile: async (p, t) => { written[p] = t; },
    mkdir: async () => true,
  };
  let res = await SC.importScrivener('P', { io, dryRun: true });
  check('scriv: dryRun ไม่เขียนไฟล์', res.ok && Object.keys(written).length === 0);
  check('scriv: plan มี project.khn.json + section.json + draft/scenes', ['project.khn.json', 'section.json', 'draft.json', 'scenes.json'].every((f) => res.plan.files.some((x) => x.path.join('/').endsWith(f))));
  check('scriv: เตือนเอกสารที่หาเนื้อหาไม่เจอ', res.warnings.length === 1 && res.warnings[0].includes('ร้านชำ'), JSON.stringify(res.warnings));

  res = await SC.importScrivener('P', { io, dest: 'OUT' });
  check('scriv: เขียนไฟล์จริงครบตาม plan', res.ok && res.written === res.plan.files.length);
  const sceneFile = Object.keys(written).find((p) => p.includes('scene-01.md') && p.includes('บทที่หนึ่ง'));
  check('scriv: ฉากเป็น .md พร้อม front-matter', !!sceneFile && written[sceneFile].startsWith('---\ntitle: ตลาดเก่า'), sceneFile);
  check('scriv: เนื้อหาไทยแปลงถูก', written[sceneFile].includes('ตลาด'), JSON.stringify(written[sceneFile]));
  const scenesJson = JSON.parse(written[Object.keys(written).find((p) => p.endsWith('scenes.json'))]);
  check('scriv: scenes.json ใช้โครงเดิมของ Killian', !!scenesJson.chapters && Object.values(scenesJson.chapters)[0][0].fileName === 'scene-01.md');
  const draftJson = JSON.parse(written[Object.keys(written).find((p) => p.endsWith('draft.json'))]);
  check('scriv: draft.json มี folderName ตรงกับโฟลเดอร์จริง', draftJson.chapters.some((c) => written[`OUT/เล่มหนึ่ง/Draft/default/Chapters/${c.folderName}/scene-01.md`]));
  check('scriv: Scrivener 2 (Files/Docs/<id>.rtf) ก็อ่านได้', JSON.stringify(written).includes('hello loose'));

  res = await SC.importScrivener('ว่าง', { io });
  check('scriv: ไม่มี .scrivx → บอกชัด ไม่ throw', !res.ok && res.code === 'no-scrivx');
  res = await SC.importScrivener('P', { io });
  check('scriv: ไม่ระบุปลายทาง → ไม่เขียน + บอกชัด', !res.ok && res.code === 'no-dest');
  res = await SC.importScrivener('P', {});
  check('scriv: ไม่มี io → บอกชัด', !res.ok && res.code === 'no-io');

  // ════════ ข้อ 64: Comments ════════
  const body = 'โทระ เดินเข้าไปในตลาดเก่า\n\nแล้วเขาก็เจอยัยแมว';
  let r = CM.addComment([], { text: 'ประโยคนี้ยาวไป', author: 'Top', position: { start: 0, end: 5, quote: 'โทระ ' }, now: 1000 });
  check('cmt: สร้างคอมเมนต์ครบฟิลด์ตาม spec', ['id', 'author', 'text', 'timestamp', 'resolved'].every((k) => k in r.comment));
  check('cmt: resolved เริ่มต้น false', r.comment.resolved === false);
  check('cmt: timestamp เป็น ISO', r.comment.timestamp === new Date(1000).toISOString());
  let list = r.comments;

  r = CM.replyTo(list, list[0].id, { text: 'เห็นด้วย', author: 'Cat', now: 2000 });
  check('cmt: ตอบกลับเข้าเธรด', r.ok && r.comments[0].replies.length === 1 && r.comments[0].replies[0].text === 'เห็นด้วย');
  list = r.comments;
  r = CM.replyTo(list, list[0].replies[0].id, { text: 'ซ้อนอีกชั้น', now: 3000 });
  check('cmt: เธรดซ้อนหลายชั้น', r.comments[0].replies[0].replies.length === 1);
  list = r.comments;
  check('cmt: replyTo id ที่ไม่มี → ok:false', CM.replyTo(list, 'ไม่มี', { text: 'x' }).ok === false);
  check('cmt: countComments นับทั้งเธรด', CM.countComments(list) === 3);

  r = CM.resolveComment(list, list[0].id);
  check('cmt: resolveComment', r.ok && r.comments[0].resolved === true);
  check('cmt: openComments กรองที่ปิดแล้วออก', CM.openComments(r.comments).length === 0);
  check('cmt: เปิดกลับได้', CM.resolveComment(r.comments, list[0].id, false).comments[0].resolved === false);
  check('cmt: editComment', CM.editComment(list, list[0].id, 'แก้แล้ว').comments[0].text === 'แก้แล้ว');
  check('cmt: findComment หาในเธรดลึกได้', CM.findComment(list, list[0].replies[0].id).text === 'เห็นด้วย');
  r = CM.deleteComment(list, list[0].replies[0].id);
  check('cmt: ลบทั้งเธรดย่อย', r.ok && r.comments[0].replies.length === 0);
  check('cmt: ลบ id ที่ไม่มี → ok:false', CM.deleteComment(list, 'ไม่มี').ok === false);

  // เก็บใน .md
  const md = CM.mergeComments(body, list);
  check('cmt: ฝังเป็น HTML comment ท้ายไฟล์', md.includes(CM.BLOCK_START) && md.trim().endsWith('-->'));
  check('cmt: เนื้อหาเดิมไม่ถูกแตะ', md.startsWith(body));
  check('cmt: parseComments อ่านกลับครบ', CM.parseComments(md).length === list.length && CM.parseComments(md)[0].replies.length === 1);
  check('cmt: stripComments คืนเนื้อล้วน', CM.stripComments(md) === body);
  check('cmt: ไฟล์ที่ไม่มีคอมเมนต์ → []', CM.parseComments(body).length === 0 && CM.stripComments(body) === body);
  check('cmt: บล็อกเสีย → [] ไม่ throw', CM.parseComments(body + '\n<!-- k2-comments\n{พัง\n-->').length === 0);
  check('cmt: ไม่มีคอมเมนต์ → ไม่ฝังบล็อกเปล่า', !CM.mergeComments(body, []).includes('k2-comments'));
  check('cmt: merge ซ้ำไม่ซ้อนบล็อก', (CM.mergeComments(md, list).match(/k2-comments/g) || []).length === 1);

  // anchor
  const anch = { start: 0, end: 5, quote: 'โทระ ' };
  const moved = 'คืนนั้น โทระ เดินเข้าไปในตลาดเก่า';
  check('cmt: reanchor ตามข้อความที่ขยับ', CM.reanchor(moved, anch).start === moved.indexOf('โทระ '), JSON.stringify(CM.reanchor(moved, anch)));
  check('cmt: ข้อความยังอยู่ที่เดิม → ไม่ขยับ', CM.reanchor(body, anch).start === 0);
  check('cmt: ข้อความถูกลบ → lost', CM.reanchor('ไม่มีใครเลย', anch).lost === true);
  check('cmt: ไม่มี quote → clamp ตามความยาว', CM.reanchor('สั้น', { start: 100, end: 200, quote: '' }).start === 4);
  const dup = 'โทระ ก. โทระ ข.';
  check('cmt: ข้อความซ้ำ → เลือกที่ใกล้ตำแหน่งเดิมสุด', CM.reanchor(dup, { start: 8, end: 13, quote: 'โทระ ' }).start === 8);

  // CommentStore + mock io
  const disk = { 'S/scene-01.md': body };
  const cio = { readFile: async (p) => disk[p], writeFile: async (p, t) => { disk[p] = t; }, exists: async (p) => p in disk };
  let stamp = 5000;
  const store = new CM.CommentStore({ io: cio, now: () => stamp++, author: 'Top' });
  const c1 = await store.add('S/scene-01.md', { start: 0, end: 4 }, 'ชื่อซ้ำ');
  check('store: add เขียนลงไฟล์ .md', disk['S/scene-01.md'].includes('ชื่อซ้ำ') && disk['S/scene-01.md'].startsWith(body));
  check('store: เก็บ quote ให้อัตโนมัติ', c1.anchor.quote === 'โทระ', JSON.stringify(c1.anchor));
  check('store: ใส่ผู้เขียนให้', c1.author === 'Top');
  await store.reply('S/scene-01.md', c1.id, 'จะแก้ให้');
  check('store: reply เขียนลงไฟล์', (await store.list('S/scene-01.md'))[0].replies.length === 1);
  await store.resolve('S/scene-01.md', c1.id);
  check('store: resolve บันทึกจริง', (await store.list('S/scene-01.md'))[0].resolved === true);
  check('store: openOnly กรองได้', (await store.list('S/scene-01.md', { openOnly: true })).length === 0);
  await store.saveBody('S/scene-01.md', 'คืนนั้น ' + body);
  const after = await store.list('S/scene-01.md');
  check('store: saveBody เก็บคอมเมนต์ไว้ + ขยับ anchor', after.length === 1 && after[0].anchor.start === 8, JSON.stringify(after[0].anchor));
  check('store: เนื้อไฟล์ใหม่ถูกบันทึก', CM.stripComments(disk['S/scene-01.md']).startsWith('คืนนั้น'));
  await store.remove('S/scene-01.md', c1.id);
  check('store: remove ลบออกจากไฟล์', (await store.list('S/scene-01.md')).length === 0 && !disk['S/scene-01.md'].includes('k2-comments'));
  check('store: ไฟล์ไม่มีจริง → [] ไม่ throw', (await store.list('ไม่มีไฟล์.md')).length === 0);

  const old = { chapters: { c1: [{ id: 'sc1', comments: [{ id: 'x', text: 'เก่า', date: '2024-01-01T00:00:00.000Z' }] }, { id: 'sc2' }] } };
  const migrated = CM.fromScenesJson(old);
  check('cmt: ย้ายคอมเมนต์เก่าจาก scenes.json', migrated.sc1.length === 1 && migrated.sc1[0].text === 'เก่า' && !('sc2' in migrated));

  // ── บั๊ก #25: md.js ต้องตัดบล็อกคอมเมนต์ออกจากเนื้อ ไม่งั้นโผล่ในตัวแก้ไข/ส่งออก/นับคำ ──
  const MD = build('md.js', '_md.cjs');
  const withCm = MD.dumpMdFile({ title: 'ท', format: 'prose' }, 'เนื้อฉาก **หนา**') +
                 '\n\n<!-- k2-comments\n[{"id":"a","text":"หมายเหตุ","replies":[],"anchor":null}]\n-->\n';
  const pm = MD.parseMdFile(withCm);
  check('md: parseMdFile ตัดบล็อกคอมเมนต์ทิ้ง', pm.body === 'เนื้อฉาก **หนา**', JSON.stringify(pm.body));
  check('md: frontmatter ยังอ่านได้ครบตอนมีคอมเมนต์', pm.meta.title === 'ท' && pm.meta.format === 'prose');
  check('md: ไฟล์ที่ไม่มีคอมเมนต์ยังพาร์สเหมือนเดิม',
        MD.parseMdFile(MD.dumpMdFile({ title: 'ท' }, 'เนื้อ')).body === 'เนื้อ');
  check('md: นับคำไม่รวมข้อความในคอมเมนต์', MD.countWords(pm.body) === MD.countWords('เนื้อฉาก **หนา**'));
  // dump→parse ที่มีคอมเมนต์ท้ายไฟล์ ต้อง round-trip ได้ (บันทึกซ้ำแล้วเนื้อไม่เพี้ยน)
  check('md: mergeComments → parseMdFile → เนื้อเท่าเดิม',
        MD.parseMdFile(CM.mergeComments(MD.dumpMdFile({ title: 'ท' }, 'เนื้อฉาก'), list)).body === 'เนื้อฉาก');

  console.log(`\ntools: ${pass} ผ่าน, ${fail} ล้มเหลว`);
  console.log(fail === 0 ? 'ALL OK' : 'HAS FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})();
