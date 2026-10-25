// test/docx-comments.test.cjs — [alpha.170 · คอมเมนต์ไปกลับกับ Word] ผลสำรวจผู้ใช้ข้อ 6
// ส่งออก DOCX พร้อมคอมเมนต์ (หัว · คำตอบ · ปิดแล้ว · ผูกข้อความ) → Word แก้/ตอบ → นำกลับเข้าฉาก (รวมกับของเดิม ไม่ซ้ำ)
// ★ ขาออกผ่าน `buildDocx` ตัวจริง แล้วอ่านกลับด้วย `readDocxComments` = พิสูจน์ว่าไฟล์ที่ส่งไปอ่านกลับได้ครบ
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

function load(rel, tag) {
  const tmp = path.join(os.tmpdir(), 'k2-' + tag + '-dxc-test.cjs');
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', rel)], outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  return require(tmp);
}
const D = load('comments/docx-comments.js', 'dc');
const E = load('export-ebook.js', 'eb');
const C = load('comments/comment-core.js', 'cc');
const IM = load('import/import-manuscript.js', 'im');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); }
}
const cm = (text, quote, o = {}) => ({ ...C.makeComment({ text, author: o.author || 'นักเขียน', position: quote ? { start: o.start || 0, end: (o.start || 0) + quote.length, quote } : null, now: Date.UTC(2026, 9, 1), id: o.id }),
  resolved: !!o.resolved, replies: o.replies || [] });

// ── 1) เครื่องหมาย ──
{
  const body = '# ร้านเบเกอรี่\nโทระเปิดร้าน **แต่เช้า** ทุกวัน\nฝนตกหนักมาก\n* * *\nจบ';
  const th = [];
  const md = D.markSceneComments(body, [cm('เช้าไปไหม', 'แต่เช้า'), cm('ทั้งฉากยาวไป', ''), cm('ปิดแล้ว', 'ฝน', { resolved: true }), cm('ไม่เจอ', 'ไม่มีคำนี้')], th, { scene: 's1' });
  check('[dc-1] เฉพาะคอมเมนต์ที่ยังเปิด (ปิดแล้วไม่ส่ง)', th.length === 3, th.length);
  check('[dc-1] ข้อความที่ผูกถูกล้อมด้วยเครื่องหมายในที่เดิม (ในตัวหนาก็ได้)', md.includes('**' + D.MK_START + '0' + D.MK_CLOSE + 'แต่เช้า' + D.MK_END + '0' + D.MK_CLOSE + '**'), md);
  check('[dc-1] คอมเมนต์ที่ไม่ผูก/หาไม่เจอ = ต้นย่อหน้าข้อความแรก หลัง `# `', md.startsWith('# ' + D.MK_START + '1' + D.MK_CLOSE + D.MK_END + '1' + D.MK_CLOSE + D.MK_START + '2'), md.slice(0, 40));
  check('[dc-1] ถอดเครื่องหมายแล้วได้เนื้อเดิมทุกตัวอักษร', D.stripMarks(md) === body);
  check('[dc-1] ตัวคั่นฉาก * * * ไม่ถูกแตะ', md.includes('\n* * *\n'));
  check('[dc-1] สถานะ anchored', th[0].anchored === true && th[1].anchored === false && th[2].anchored === false);
  check('[dc-1] splitMarks', JSON.stringify(D.splitMarks('ก' + D.MK_START + '3' + D.MK_CLOSE + 'ข' + D.MK_END + '3' + D.MK_CLOSE)) === JSON.stringify([{ text: 'ก' }, { start: 3 }, { text: 'ข' }, { end: 3 }]));
  const th2 = [];
  D.markSceneComments('ก', [cm('a', '')], th2, { includeResolved: true });
  check('[dc-1] เธรดว่าง ๆ (ไม่มีข้อความ) ไม่ส่ง', D.markSceneComments('ก', [cm('  ', '')], [], {}) === 'ก');
}

// ── 2) DOCX ทั้งก้อน: อ่านกลับได้ครบ ──
const body = 'โทระเปิดร้านแต่เช้า\nฝนตกหนักมาก';
const original = [
  cm('เช้าไปไหม', 'แต่เช้า', { id: 'c1', replies: [C.makeComment({ text: 'ตั้งใจครับ', author: 'นักเขียน', now: Date.UTC(2026, 9, 2), id: 'r1' })] }),
  cm('ฝนหนักไป', 'ฝนตก', { id: 'c2' }),
];
const threads = [];
const md = D.markSceneComments(body, original, threads, { scene: 'A' });
const pkg = E.buildDocx(md, { title: 'T', author: 'นักเขียน', comments: threads });
const part = (p) => { const f = pkg.files.find((x) => x.path === p); return f ? String(f.data) : ''; };
{
  check('[dc-2] มี comments.xml + commentsExtended.xml', !!part('word/comments.xml') && !!part('word/commentsExtended.xml'));
  check('[dc-2] rels + content types ครบ', part('word/_rels/document.xml.rels').includes('Target="comments.xml"')
        && part('[Content_Types].xml').includes('/word/comments.xml') && part('[Content_Types].xml').includes('/word/commentsExtended.xml'));
  check('[dc-2] เอกสารไม่มีเครื่องหมายหลุด (PUA)', ![D.MK_START, D.MK_END, D.MK_CLOSE].some((ch) => part('word/document.xml').includes(ch)));
  check('[dc-2] ช่วงคอมเมนต์ครบคู่ (3 คอมเมนต์ = หัวสอง + คำตอบหนึ่ง)', (part('word/document.xml').match(/commentRangeStart/g) || []).length === 3
        && (part('word/document.xml').match(/commentReference/g) || []).length === 3, pkg.comments);
  check('[dc-2] นับคอมเมนต์', pkg.comments === 3);
  const back = D.readDocxComments({ document: part('word/document.xml'), comments: part('word/comments.xml'), commentsExtended: part('word/commentsExtended.xml') });
  check('[dc-2] อ่านกลับ: สองเธรดตามลำดับในเอกสาร', back.map((b) => b.text).join('|') === 'เช้าไปไหม|ฝนหนักไป', back.map((b) => b.text));
  check('[dc-2] ข้อความที่ผูก + บริบทย่อหน้า', back[0].quote === 'แต่เช้า' && back[0].context === 'โทระเปิดร้านแต่เช้า' && back[1].quote === 'ฝนตก', back.map((b) => [b.quote, b.context]));
  check('[dc-2] คำตอบอยู่ใต้หัวเธรด', back[0].replies.length === 1 && back[0].replies[0].text === 'ตั้งใจครับ' && back[1].replies.length === 0);
  check('[dc-2] ผู้เขียน/วันที่', back[0].author === 'นักเขียน' && /^2026-10-01T/.test(back[0].date), [back[0].author, back[0].date]);
  // ตัวนำเข้าต้นฉบับ (import-manuscript) อ่าน DOCX ที่มีคอมเมนต์แล้วได้เนื้อปกติ ไม่มีของคอมเมนต์ปน
  const doc = IM.docxToDoc({ document: part('word/document.xml'), styles: part('word/styles.xml') });
  check('[dc-2] นำเข้าต้นฉบับจาก DOCX ที่มีคอมเมนต์ = เนื้อสะอาด', IM.sceneMd(doc.content) === body, IM.sceneMd(doc.content));
  // ไม่มีเธรด = ไฟล์เหมือนเดิมทุกไบต์ (ไม่มีส่วนคอมเมนต์)
  const plain = E.buildDocx(body, { title: 'T', created: '2026-01-01T00:00:00Z' });
  const plain2 = E.buildDocx(body, { title: 'T', created: '2026-01-01T00:00:00Z', comments: [] });
  check('[dc-2] ไม่มีคอมเมนต์ = แพ็กเกจเดิม (ไม่มี comments.xml)', !plain.files.some((f) => /comments/.test(f.path))
        && JSON.stringify(plain.files) === JSON.stringify(plain2.files));
}

// ── 3) บก. แก้ใน Word: ตอบ · คอมเมนต์ใหม่ · Resolve → นำกลับ ──
{
  // จำลองสิ่งที่ Word เขียน: คำตอบใหม่ของ บก. ต่อเธรด c1 · คอมเมนต์ใหม่ที่ "ร้าน" · กด Resolve เธรด c2
  let docx = part('word/document.xml');
  let cx = part('word/comments.xml');
  let ext = part('word/commentsExtended.xml');
  const p0 = (cx.match(/<w:comment w:id="0"[\s\S]*?w14:paraId="([0-9A-F]+)"/) || [])[1];
  cx = cx.replace('</w:comments>', '<w:comment w:id="7" w:author="บก. สมศรี" w:date="2026-10-05T10:00:00Z" w:initials="สศ"><w:p w14:paraId="0AAA0001"><w:r><w:t>เช้าไปจริง ๆ ลองสายหน่อย</w:t></w:r></w:p></w:comment>'
    + '<w:comment w:id="8" w:author="บก. สมศรี" w:date="2026-10-05T10:05:00Z"><w:p w14:paraId="0AAA0002"><w:r><w:t>ร้านชื่ออะไร</w:t></w:r></w:p><w:p w14:paraId="0AAA0003"><w:r><w:t>บรรทัดสอง</w:t></w:r></w:p></w:comment></w:comments>');
  ext = ext.replace('</w15:commentsEx>', `<w15:commentEx w15:paraId="0AAA0001" w15:paraIdParent="${p0}" w15:done="0"/><w15:commentEx w15:paraId="0AAA0003" w15:done="0"/></w15:commentsEx>`);
  // Resolve เธรดที่สอง (id 2 = หัวของ c2 · id 1 = คำตอบ r1)
  ext = ext.replace(/(<w15:commentEx w15:paraId="[0-9A-F]+" w15:done=")0("\/>)(?![\s\S]*paraIdParent[\s\S]*<w15:commentEx w15:paraId="[0-9A-F]+" w15:done="0"\/>)/, '$11$2');
  const c2para = (cx.match(/<w:comment w:id="2"[\s\S]*?w14:paraId="([0-9A-F]+)"/) || [])[1];
  ext = ext.replace(new RegExp(`(w15:paraId="${c2para}"[^>]*w15:done=")0`), '$11');
  // ช่วงของคอมเมนต์ใหม่ล้อม "ร้าน" + คำตอบใหม่ใช้ช่วงเดียวกับหัว c1
  docx = docx.replace('โทระเปิด', 'โทระเปิด</w:t></w:r><w:commentRangeStart w:id="8"/><w:r><w:t xml:space="preserve">')
             .replace('ร้าน', 'ร้าน</w:t></w:r><w:commentRangeEnd w:id="8"/><w:r><w:commentReference w:id="8"/></w:r><w:r><w:t xml:space="preserve">');
  const threadsW = D.readDocxComments({ document: docx, comments: cx, commentsExtended: ext });
  check('[dc-3] อ่านไฟล์ที่ บก. แก้: สามเธรด', threadsW.length === 3, threadsW.map((x) => x.text));
  const tNew = threadsW.find((x) => x.text.startsWith('ร้านชื่ออะไร'));
  check('[dc-3] คอมเมนต์หลายย่อหน้าต่อด้วยขึ้นบรรทัด · ผูก "ร้าน"', tNew && tNew.text === 'ร้านชื่ออะไร\nบรรทัดสอง' && tNew.quote === 'ร้าน', tNew);
  const t1 = threadsW.find((x) => x.text === 'เช้าไปไหม');
  check('[dc-3] คำตอบใหม่ของ บก. อยู่ในเธรดเดิม (ต่อจากคำตอบเดิม)', t1 && t1.replies.map((r) => r.text).join('|') === 'ตั้งใจครับ|เช้าไปจริง ๆ ลองสายหน่อย', t1 && t1.replies);
  check('[dc-3] Resolve ใน Word = done', threadsW.find((x) => x.text === 'ฝนหนักไป').done === true);

  const raw = '---\ntitle: A\n---\n' + body + '\n';
  const scenes = [
    { key: 'A', raw, plain: body, comments: original },
    { key: 'B', raw: '---\ntitle: B\n---\nอีกฉากหนึ่ง\n', plain: 'อีกฉากหนึ่ง', comments: [] },
  ];
  const plan = D.planCommentImport(threadsW, scenes, { now: Date.UTC(2026, 9, 6) });
  check('[dc-3] สรุป: ใหม่ 1 · คำตอบใหม่ 1 · ปิด 1 · ของเดิม 2 · หาฉากไม่เจอ 0', JSON.stringify(plan.stats) === JSON.stringify({ added: 1, replies: 1, resolved: 1, same: 2, unmatched: 0 }), plan.stats);
  const after = plan.updates.get('A');
  check('[dc-3] เปลี่ยนเฉพาะฉาก A', plan.updates.size === 1 && !!after);
  check('[dc-3] คำตอบเดิมไม่ซ้ำ', after.find((c) => c.id === 'c1').replies.length === 2);
  const nw = after.find((c) => c.text.startsWith('ร้านชื่ออะไร'));
  check('[dc-3] คอมเมนต์ใหม่ผูก "ร้าน" ด้วยตำแหน่งในไฟล์จริง', nw && nw.anchor && nw.anchor.quote === 'ร้าน' && raw.slice(nw.anchor.start, nw.anchor.end) === 'ร้าน' && nw.author === 'บก. สมศรี', nw);
  check('[dc-3] ของเดิมในฉากไม่ถูกแก้ (สำเนาใหม่)', original[0].replies.length === 1 && !original[1].resolved);
  // นำเข้าซ้ำ = ไม่มีอะไรเปลี่ยน
  const again = D.planCommentImport(threadsW, [{ ...scenes[0], comments: after }, scenes[1]]);
  check('[dc-3] นำเข้าไฟล์เดิมซ้ำ = ไม่เพิ่มอะไร', again.updates.size === 0 && again.stats.added === 0 && again.stats.replies === 0, again.stats);
  // หาฉากไม่เจอ
  const lost = D.planCommentImport([{ id: '9', author: 'x', date: '', text: 'อะไร', done: false, quote: 'ไม่มีที่ไหน', context: 'ไม่มีที่ไหนเลย', replies: [] }], scenes);
  check('[dc-3] หาฉากไม่เจอ = รายงาน ไม่เดาลงฉากไหน', lost.updates.size === 0 && lost.stats.unmatched === 1 && lost.unmatched.length === 1);
  // ข้อความที่ผูกคร่อมตัวหนา: ใช้คำที่ยาวสุดที่เจอตรงตัว
  const bold = D.planCommentImport([{ id: '1', author: 'x', date: '', text: 'ดู', done: false, quote: 'หนัก มาก', context: 'ฝน หนัก มาก', replies: [] }],
    [{ key: 'K', raw: 'ฝน **หนัก** มาก', plain: 'ฝน หนัก มาก', comments: [] }]);
  const bc = bold.updates.get('K')[0];
  check('[dc-3] ข้อความที่ผูกคร่อมเครื่องหมายรูปแบบ → ผูกคำที่เจอตรงตัว', bc.anchor && ['หนัก', 'มาก'].includes(bc.anchor.quote), bc.anchor);
}

// ── 4) DOCX ที่ไม่มีคอมเมนต์ / ไม่มี commentsExtended (Word รุ่นเก่า) ──
{
  check('[dc-4] ไม่มี comments.xml = ไม่มีเธรด', D.readDocxComments({ document: part('word/document.xml') }).length === 0);
  const old = D.readDocxComments({ document: part('word/document.xml'), comments: part('word/comments.xml') });
  check('[dc-4] ไม่มี commentsExtended = ทุกคอมเมนต์เป็นหัวเธรด', old.length === 3 && old.every((x) => !x.replies.length), old.length);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
