// test/compile-omit.test.cjs — unit test "ไม่รวม element ตามประเภท" (ข้อ 88)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const build = (file, out) => {
  const tmp = path.join(os.tmpdir(), out);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', file)],
    outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
  });
  return require(tmp);
};
const CP = build('compile.js', 'k2-omit-test.cjs');
const FT = build('fountain.js', 'k2-omit-fnt-test.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

const script = [
  '.INT. ห้องครัว - เช้า',
  '',
  'ทอร่ายืนมองเค้ก',
  '',
  '((โน้ต: ยังไม่แน่ใจตอนจบ))',
  '',
  '@ทอร่า',
  'ฉันจะกินคนเดียวนะ',
  '',
  '= สรุป: ทอร่าตัดสินใจ',
  '',
  '# โครงหนึ่ง',
  '## โครงสอง',
].join('\n');

// ── ขั้นตอนถูกลงทะเบียนไว้ ──
const def = CP.stepDef('omit-elements');
check('มีขั้นตอน omit-elements ใน STEP_DEFS', !!def);
check('อยู่ในช่วง model (ทำก่อนประกอบข้อความ)', def.stage === 'model');
check('ค่าเริ่มต้นตัดแค่ ((โน้ต)) — ไม่กินหัวข้อของนิยาย', def.opts.types === 'note');
check('มีสวิตช์วาดกรอบรอบโน้ต', def.opts.drawRectAroundNotes === false);
check('มีช่องกรอกให้ผู้ใช้ตั้งเอง 2 ช่อง', (def.fields || []).length === 2);
check('ช่องสวิตช์เป็นชนิด check (กล่องติ๊ก ไม่ใช่ช่องพิมพ์)',
  def.fields.find((f) => f.k === 'drawRectAroundNotes').type === 'check');
check('OMIT_CHOICES มีโน้ต/สรุป/โครง/รูป',
  ['note', 'summary', 'outline1', 'outline2', 'outline3', 'image']
    .every((k) => CP.OMIT_CHOICES.includes(k)));
check('OMIT_CHOICES ไม่มีเนื้อบทหลัก (กันตัดบทตัวเองทิ้ง)',
  ['scene', 'action', 'character', 'dialogue'].every((k) => !CP.OMIT_CHOICES.includes(k)));

// ── omitElements ──
check('ไม่ระบุประเภท → คืนข้อความเดิมเป๊ะ',
  CP.omitElements(script, '') === script && CP.omitElements(script, []) === script);
check('ข้อความว่าง → ไม่พัง', CP.omitElements('', 'note') === '' && CP.omitElements(null, 'note') === '');

const noNote = CP.omitElements(script, 'note');
check('ตัดโน้ตออกแล้ว', !noNote.includes('ยังไม่แน่ใจตอนจบ'));
check('เนื้อบทที่เหลืออยู่ครบ',
  noNote.includes('ห้องครัว') && noNote.includes('ทอร่ายืนมองเค้ก') &&
  noNote.includes('ฉันจะกินคนเดียวนะ'));
check('สรุป/โครงยังอยู่ (ไม่ได้สั่งตัด)',
  noNote.includes('สรุป: ทอร่าตัดสินใจ') && noNote.includes('โครงหนึ่ง'));
check('ไม่เหลือช่องว่างซ้อน 3 บรรทัด', !/\n{3}/.test(noNote), JSON.stringify(noNote));

const noMulti = CP.omitElements(script, 'note, summary , outline1');
check('รับหลายประเภทคั่นด้วยจุลภาค (ตัดช่องว่างรอบชื่อให้)',
  !noMulti.includes('ยังไม่แน่ใจ') && !noMulti.includes('ทอร่าตัดสินใจ') &&
  !noMulti.includes('โครงหนึ่ง'));
check('outline2 ที่ไม่ได้สั่งตัดยังอยู่', noMulti.includes('โครงสอง'));
check('รับเป็นอาร์เรย์ได้เหมือนกัน',
  CP.omitElements(script, ['note']) === noNote);
check('ประเภทที่ไม่มีในบท → ข้อความเดิม',
  CP.omitElements(script, 'transition') === script);

// ── round-trip: ผลลัพธ์ยังพาร์สกลับได้ประเภทเดิม ──
const back = FT.parseScript(noNote).filter((b) => b.el !== 'blank');
check('ผลลัพธ์ไม่มีบล็อกชนิด note เหลือ', back.every((b) => b.el !== 'note'));
check('หัวฉากยังเป็นหัวฉาก', back[0].el === 'scene');
check('บทพูดยังเป็นบทพูด ไม่กลายเป็นบรรยาย (ตัดโน้ตแล้วบริบทไม่เพี้ยน)',
  back.some((b) => b.el === 'dialogue' && b.text.includes('ฉันจะกินคนเดียว')),
  JSON.stringify(back.map((b) => b.el)));
check('ตัดทุกอย่างที่เลือกได้ → ยังคืนสตริง ไม่ throw',
  typeof CP.omitElements(script, CP.OMIT_CHOICES.join(',')) === 'string');

// ── ผ่านไปป์ไลน์จริง ──
const model = { title: 'ทดสอบ', chapters: [{ title: 'บทหนึ่ง', scenes: [
  { title: 'ฉากหนึ่ง', body: script, words: 20 }] }] };
const wfOn = { id: 'x', name: 'x', ext: 'txt',
  steps: [CP.mkStep('omit-elements', true, { types: 'note' })] };
const rOn = CP.runWorkflow(model, wfOn);
check('[ไปป์ไลน์] เปิดขั้นตอน → โน้ตหายจากผลลัพธ์', !rOn.text.includes('ยังไม่แน่ใจตอนจบ'));
check('[ไปป์ไลน์] ไม่มี warning', rOn.warnings.length === 0, rOn.warnings.join('|'));
const rOff = CP.runWorkflow(model, { ...wfOn, steps: [CP.mkStep('omit-elements', false)] });
check('[ไปป์ไลน์] ปิดขั้นตอน → โน้ตยังอยู่', rOff.text.includes('ยังไม่แน่ใจตอนจบ'));
check('[ไปป์ไลน์] ไม่แก้ model เดิมของผู้เรียก',
  model.chapters[0].scenes[0].body === script);
const rDefault = CP.runWorkflow(model,
  { ...wfOn, steps: [{ key: 'omit-elements', on: true, opts: {} }] });
check('[ไปป์ไลน์] ไม่ตั้ง types มาเลย → ใช้ค่าเริ่มต้น note',
  !rDefault.text.includes('ยังไม่แน่ใจตอนจบ'));

// ── พรีเซ็ต ──
const spPreset = CP.PRESETS.find((p) => p.id === 'screenplay');
check('พรีเซ็ตบทภาพยนตร์เปิด omit-elements ให้เลย',
  (spPreset.steps || []).some((s) => s.key === 'omit-elements' && s.on !== false));
check('พรีเซ็ตนิยายไม่เปิด omit-elements (# ## ในนิยาย = หัวข้อ)',
  CP.PRESETS.filter((p) => !p.id.startsWith('screenplay'))
    .every((p) => !(p.steps || []).some((s) => s.key === 'omit-elements' && s.on !== false)));
check('มีพรีเซ็ต PDF ของบทภาพยนตร์', !!CP.PRESETS.find((p) => p.ext === 'pdf'));
check('newWorkflow มีขั้นตอนใหม่อยู่ด้วย (ปิดไว้)', (() => {
  const s = CP.newWorkflow('x').steps.find((x) => x.key === 'omit-elements');
  return s && s.on === false;
})());
check('cloneWorkflow เติมขั้นตอนที่พรีเซ็ตไม่มีให้ครบ', (() => {
  const c = CP.cloneWorkflow(CP.PRESETS.find((p) => p.id === 'manuscript'));
  return c.steps.some((s) => s.key === 'omit-elements' && s.on === false);
})());

// ═══════ [alpha.81r ข้อ 6] "ส่งออกไม่ควรมีหัวเรื่อง ชื่อไฟล์ มานะ" ═══════
// เดิม runWorkflow ยัด `# <ชื่อเรื่อง>` ลงไปเสมอ แม้ไม่ได้เปิดขั้นตอน "หน้าปก"
// → ส่งออกฉากเดียวก็ได้ชื่อไฟล์เป็น h1 ติดมาทุกครั้ง และไม่มีทางปิด
{
  const model = { title: 'ชื่อไฟล์ของฉัน', author: '', chapters: [
    { title: '', scenes: [{ title: '', body: 'เนื้อเรื่องบรรทัดเดียว', type: 'scene', words: 3 }] }] };
  const wfBare = { id: 'w', name: 'w', ext: 'md', steps: [CP.mkStep('skip-memo')] };
  const bare = CP.runWorkflow(model, wfBare).text;
  check('ไม่เปิดหน้าปก → ไม่มีชื่อเรื่องโผล่ในผลลัพธ์', !bare.includes('ชื่อไฟล์ของฉัน'), bare.slice(0, 60));
  check('ไม่เปิดหน้าปก → ไม่มีหัวข้อ h1 เลย', !/^#\s/m.test(bare), bare.slice(0, 60));
  check('เนื้อเรื่องยังอยู่ครบ', bare.includes('เนื้อเรื่องบรรทัดเดียว'));

  const wfCover = { id: 'w2', name: 'w2', ext: 'md', steps: [CP.mkStep('cover')] };
  const cov = CP.runWorkflow(model, wfCover).text;
  check('เปิดหน้าปก → ชื่อเรื่องกลับมา (ชื่อเรื่องมาจากขั้นตอนนี้ที่เดียว)',
        cov.includes('# ชื่อไฟล์ของฉัน'), cov.slice(0, 60));

  // บท/ฉากที่ไม่มีชื่อ ต้องไม่ได้หัวข้อเปล่า `##` ลอย ๆ (เกิดกับขอบเขต "ฉากที่เปิดอยู่")
  const wfHead = { id: 'w3', name: 'w3', ext: 'md',
                   steps: [CP.mkStep('chapter-heading'), CP.mkStep('scene-heading')] };
  const head = CP.runWorkflow(model, wfHead).text;
  check('บทไม่มีชื่อ → ไม่มี `##` เปล่า', !/^##\s*$/m.test(head), JSON.stringify(head.slice(0, 40)));
  check('ฉากไม่มีชื่อ → ไม่มี `###` เปล่า', !/^###\s*$/m.test(head));

  const named = { ...model, chapters: [{ title: 'บทที่หนึ่ง', scenes: model.chapters[0].scenes }] };
  check('บทที่มีชื่อยังได้หัวข้อเหมือนเดิม',
        CP.runWorkflow(named, wfHead).text.includes('## บทที่หนึ่ง'));
}

// ══════════ [alpha.113] ★★ บรรทัดว่างในบทภาพยนตร์ต้องไม่ถูกยุบตอน compile ══════════
//
// ผู้ใช้: *"ใน markdown มี 41 บรรทัด แต่ใน pdf น่าจะแค่ 30 บรรทัด บรรทัดว่างถูกลบทิ้ง"*
// ต้นตอ: ไปป์ไลน์ compile ยุบ `\n{3,}` → `\n\n` (ถูกสำหรับนิยาย · **ทำลายบท**
// เพราะที่นั่นบรรทัดว่างเป็นเนื้อหาที่ paginate() นับเป็น 1 บรรทัดตั้งแต่ alpha.86)
{
  const SF = build('sp-format.js', 'k2-omit-spf-test.cjs');
  const SH = build('sp-headers.js', 'k2-omit-hdr-test.cjs');
  const EF = build('export-formats.js', 'k2-omit-ef-test.cjs');

  // ตัวชี้ชนิดเอกสารต้องตรงกับ docKind() เสมอ (คนละไฟล์ เพราะ import วนกลับไม่ได้)
  {
    const mk = (fmts) => ({ title: 'x', chapters: [{ title: 'c',
      scenes: fmts.map((f, i) => ({ title: 's' + i, format: f, body: 'x' })) }] });
    const cases = [['screenplay'], ['prose'], ['screenplay', 'screenplay', 'prose'],
                   ['prose', 'prose', 'screenplay'], ['screenplay', 'prose'], []];
    const bad = cases.filter((c) =>
      CP.modelIsScreenplay(mk(c)) !== (EF.docKind(mk(c)) === 'screenplay'));
    check('[113] modelIsScreenplay ตอบตรงกับ docKind() ทุกกรณี', bad.length === 0,
          JSON.stringify(bad));
    check('[113] ข้าม memo เหมือน docKind', (() => {
      const m = { title: 'x', chapters: [{ title: 'c', scenes: [
        { format: 'screenplay', body: 'a' }, { type: 'memo', format: 'prose', body: 'b' }] }] };
      return CP.modelIsScreenplay(m) === true;
    })());
  }

  // เอกสารที่มีช่วงบรรทัดว่างติดกันหลายแบบ (เลียนไฟล์จริงของผู้ใช้: ว่าง 3, 4 และ 7 บรรทัด)
  const body = ['บรรยายท่อนแรก', '', '', '', 'บรรยายท่อนสอง', '', '', '', '',
                'บรรยายท่อนสาม', '', '', '', '', '', '', '', 'บรรยายท่อนสี่'].join('\n');
  const nLines = (s) => s.split('\n').length;
  const mkModel = (format) => ({ title: 'ทดสอบ', author: '', chapters: [{ title: 'บทที่ 1',
    scenes: [{ title: 'ฉากหนึ่ง', format, body, words: 10 }] }] });
  const wfPdf = CP.PRESETS.find((p) => p.id === 'screenplay-pdf');
  check('[113] มีพรีเซ็ต screenplay-pdf ให้ทดสอบ', !!wfPdf);

  const sp = CP.runWorkflow(mkModel('screenplay'), wfPdf).text;
  const pr = CP.runWorkflow(mkModel('prose'), wfPdf).text;
  check('[113] ★★ บท: ช่วงบรรทัดว่างติดกันอยู่ครบ ไม่ถูกยุบ',
        /\n{4}/.test(sp) && nLines(sp) >= nLines(body) - 1,
        `compile ${nLines(sp)} บรรทัด · ต้นฉบับ ${nLines(body)}`);
  check('[113] ★ นิยาย: ยังยุบเหมือนเดิม (ไม่ทำ regression ให้ฝั่งนิยาย)',
        !/\n{3,}/.test(pr) && nLines(pr) < nLines(body),
        `compile ${nLines(pr)} บรรทัด · ต้นฉบับ ${nLines(body)}`);
  check('[113] เนื้อความยังครบทุกท่อนทั้งสองโหมด',
        ['แรก', 'สอง', 'สาม', 'สี่'].every((w) => sp.includes('บรรยายท่อน' + w) &&
                                                    pr.includes('บรรยายท่อน' + w)));

  // ★ หัวใจ: จำนวนหน้าที่ได้จากข้อความที่ compile ต้องเท่ากับที่ได้จากไฟล์ดิบ
  {
    const fmt = SF.mergeSpFormat({ paperSize: 'a4',
                                   margins: { top: 1, bottom: 1, left: 1, right: 1 } });
    const lines = SH.linesForBody(fmt, SH.mergeHeaders(null));
    const big = [];
    for (let i = 0; i < 20; i++) big.push('บรรยายฉากยาวพอควรสำหรับทดสอบการตัดหน้า ' + i, '', '', '');
    const raw = big.join('\n');
    const model = { title: 'ทดสอบ', author: '', chapters: [{ title: 'บทที่ 1',
      scenes: [{ title: 'ฉากหนึ่ง', format: 'screenplay', body: raw, words: 50 }] }] };
    const wfBare = { id: 'bare', name: 'bare', ext: 'pdf', steps: [] };  // ไม่มีหัวบท/หัวฉาก
    const compiled = CP.runWorkflow(model, wfBare).text;
    const pagesRaw = SF.paginate(FT.parseScript(raw), { fmt, lines }).count;
    const pagesCompiled = SF.paginate(FT.parseScript(compiled), { fmt, lines }).count;
    check('[113] ชุดทดสอบนี้ยาวเกินหนึ่งหน้าจริง', pagesRaw >= 2, String(pagesRaw));
    check('[113] ★★★ จำนวนหน้าจากข้อความที่ compile = จำนวนหน้าจากไฟล์ดิบ',
          pagesCompiled === pagesRaw, `compile ${pagesCompiled} vs ดิบ ${pagesRaw}`);
    // และต้องต่างจากตอนที่ยุบบรรทัดว่าง (พิสูจน์ว่าถ้าใครเอาโค้ดเก่ากลับมา เทสนี้จะแดง)
    const squashed = SF.paginate(FT.parseScript(raw.replace(/\n{3,}/g, '\n\n')), { fmt, lines }).count;
    check('[113] ★ และไม่เท่ากับตอนยุบบรรทัดว่าง (ย้อนโค้ดกลับ = แดงทันที)',
          pagesCompiled !== squashed, `compile ${pagesCompiled} vs ยุบ ${squashed}`);
  }

  // ★★ ฉบับร่างที่ **ปนนิยายกับบท** — ต้องตัดสินรายฉาก ไม่ใช่เสียงข้างมาก
  // (ฉบับร่างจริงของผู้ใช้: 7 ฉาก เป็นบทแค่ฉากเดียว → เสียงข้างมากบอก "นิยาย"
  //  แล้วฉากบทฉากนั้นเสียบรรทัดว่างไปทั้งฉาก = PDF ตัดหน้าไม่ตรงกับที่เห็นบนจอ)
  {
    const mixed = { title: 'ปนกัน', author: '', chapters: [{ title: 'บทที่ 1', scenes: [
      { title: 'ฉากบท', format: 'screenplay', body, words: 10 },
      { title: 'ฉากนิยาย 1', format: 'prose', body, words: 10 },
      { title: 'ฉากนิยาย 2', format: 'prose', body, words: 10 },
      { title: 'ฉากนิยาย 3', format: 'prose', body, words: 10 },
    ] }] };
    check('[113] ชุดปนกันนี้เสียงข้างมากคือ "นิยาย" จริง', CP.modelIsScreenplay(mixed) === false);
    check('[113] แต่ modelHasScreenplay จับได้ว่ามีฉากบทอยู่', CP.modelHasScreenplay(mixed) === true);
    const mx = CP.runWorkflow(mixed, { id: 'bare', name: 'bare', ext: 'pdf', steps: [] }).text;
    // ฉากบทอยู่ก้อนแรก → ต้องยังมีช่วงว่างยาว · ฉากนิยายที่เหลือต้องถูกยุบ
    const parts = mx.split('บรรยายท่อนสี่');
    check('[113] ★★★ ฉากบทเก็บช่องไฟไว้ครบ แม้อยู่ในฉบับร่างที่นิยายเป็นเสียงข้างมาก',
          /\n{4}/.test(parts[0]), JSON.stringify(parts[0]));
    check('[113] ★★ ฉากนิยายในเล่มเดียวกันยังถูกยุบตามปกติ',
          parts.slice(1).every((x) => !/\n{3,}/.test(x)),
          JSON.stringify(parts.slice(1).join('|')));
  }

  // omitElements: ตัดโน้ตแล้วช่องไฟของผู้เขียนต้องไม่หายไปด้วยในโหมดบท
  {
    const src = ['บรรยาย', '', '', '((โน้ตของนักเขียน))', '', '', 'บรรยายต่อ'].join('\n');
    const keep = CP.omitElements(src, 'note', { keepBlanks: true });
    const squash = CP.omitElements(src, 'note');
    check('[113] ★ omitElements: โหมดบทเก็บช่องไฟไว้ครบ',
          !keep.includes('โน้ตของนักเขียน') && /\n{3,}/.test(keep), JSON.stringify(keep));
    check('[113] omitElements: โหมดนิยายยังยุบเหมือนเดิม',
          !squash.includes('โน้ตของนักเขียน') && !/\n{3,}/.test(squash), JSON.stringify(squash));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
