// test/sp-continued.test.cjs — unit test ระบบต่อเนื่อง (ข้อ 55 + 56)
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
const CT = build('sp-continued.js', 'k2-spcont-test.cjs');
const SF = build('sp-format.js', 'k2-spcont-fmt-test.cjs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── ค่าเริ่มต้น ──
check('CONTINUED_DEFAULTS เปิดใช้งานมาแต่แรก',
  CT.CONTINUED_DEFAULTS.enabled === true && CT.CONTINUED_DEFAULTS.scene === true &&
  CT.CONTINUED_DEFAULTS.dialogue === true);
check('มีสวิตช์เลขกำกับ CONTINUED: (2)', CT.CONTINUED_DEFAULTS.number === true);
check('ระยะ (MORE) เท่าแนวชื่อตัวละคร (3.7 นิ้ว)', CT.CONTINUED_DEFAULTS.indent === 3.7);
check('ชนิดเครื่องหมายครบ 4 อย่าง', CT.CONTINUED_TYPES.length === 4 &&
  CT.CONTINUED_TYPES.every((t) => CT.CONTINUED_CLASS[t] && Number.isFinite(CT.CONTINUED_SIDE[t])));
check('ของท้ายหน้าอยู่ก่อนเส้นคั่นหน้า (side < -1)',
  CT.CONTINUED_SIDE.more < -1 && CT.CONTINUED_SIDE['continued-bottom'] < -1);
check('ของต้นหน้าอยู่หลังเส้นคั่นหน้า (side > -1)',
  CT.CONTINUED_SIDE['continued-top'] > -1 && CT.CONTINUED_SIDE.contd > -1);
check('(MORE) อยู่ก่อน (CONTINUED) ท้ายหน้า',
  CT.CONTINUED_SIDE.more < CT.CONTINUED_SIDE['continued-bottom']);
check('CONTINUED: อยู่ก่อนชื่อ+(cont\'d) ต้นหน้า',
  CT.CONTINUED_SIDE['continued-top'] < CT.CONTINUED_SIDE.contd);

// ── ฉากข้ามหน้า ──
const withPos = (arr) => arr.map((b, i) => ({ ...b, pos: (i + 1) * 10, idx: i }));
// [alpha.83 ข้อ 6] CONTINUED ใช้กับ "บล็อกที่ถูกหั่นคร่อมหน้า" เท่านั้น (กฎที่ผู้ใช้สั่ง)
// — บรรยายก้อนสั้น ๆ 40 ก้อนที่รอยต่ออยู่ระหว่างก้อน **ไม่ใช่** เคสของ CONTINUED อีกต่อไป
const longScene = withPos([{ el: 'scene', text: 'INT. ห้องนอน - กลางคืน' },
  ...Array.from({ length: 12 }, (_, i) => ({ el: 'action', text: 'บรรยาย ' + i })),
  { el: 'action', text: 'บรรยายยาวมาก '.repeat(400) }]);
const pagesA = SF.paginate(longScene, { lines: 20 });
const marksA = CT.computeContinueds(pagesA, SF.mergeSpFormat());
// [alpha.86] ★ (CONTINUED)/CONTINUED: **ไม่อยู่ใน marks อีกแล้ว** — มันถูกวาดเป็นโอเวอร์เลย์
// ในระยะขอบบนตัว widget เส้นคั่นหน้า (เหมือนที่ pdf-generator.js ทำมาตลอด) จึงไม่กินบรรทัด
// ตัวข้อความยังคำนวณโดย annotateContinued() และอยู่ที่ `page.continuedTop/continuedBottom`
check('[86] marks มีแต่เครื่องหมายที่เป็นเนื้อบทจริง (more/contd) เท่านั้น',
  marksA.every((m) => m.type === 'more' || m.type === 'contd'),
  marksA.map((m) => m.type).join(','));
check('[86] (CONTINUED) ท้ายหน้า อยู่ที่หน้า ไม่ใช่ที่ marks',
  pagesA.pages.some((p) => p.continuedBottom === '(CONTINUED)'));
check('[86] CONTINUED: ต้นหน้า อยู่ที่หน้า',
  pagesA.pages.some((p) => String(p.continuedTop || '').startsWith('CONTINUED:')));
check('ทุกเครื่องหมายมีตำแหน่งจริงในเอกสาร',
  marksA.every((m) => Number.isFinite(m.pos) && m.pos > 0));
check('ทุกเครื่องหมายมีคลาส CSS', marksA.every((m) => !!m.cls));
check('ข้ามหลายหน้า → มีเลขกำกับอย่างน้อยหนึ่งอัน',
  pagesA.count < 3 || pagesA.pages.some((p) => /CONTINUED: \(\d+\)/.test(p.continuedTop || '')),
  pagesA.pages.map((p) => p.continuedTop || '-').join(' / '));
check('เลขกำกับเริ่มที่ (2) ไม่ใช่ (1)',
  !pagesA.pages.some((p) => p.continuedTop === 'CONTINUED: (1)'));

// ── ไม่มีหัวฉาก = ไม่มีเครื่องหมายฉาก ──
const noScene = withPos([...Array.from({ length: 12 }, (_, i) => ({ el: 'action', text: 'บรรยาย ' + i })),
  { el: 'action', text: 'บรรยายยาวมาก '.repeat(400) }]);
const pagesN = SF.paginate(noScene, { lines: 20 });
check('ไม่มีหัวฉาก → ไม่มี (CONTINUED)/CONTINUED:',
  pagesN.pages.every((p) => !p.continuedTop && !p.continuedBottom));

// ── บทพูดข้ามหน้า ──
const dlg = withPos([{ el: 'scene', text: 'INT. ครัว - เช้า' },
  ...Array.from({ length: 6 }, (_, i) => ({ el: 'action', text: 'บรรยาย ' + i })),
  { el: 'character', text: 'ทอร่า' },
  { el: 'dialogue', text: 'พูดยาวมาก '.repeat(60) }]);
const pagesD = SF.paginate(dlg, { lines: 20 });
const marksD = CT.computeContinueds(pagesD, SF.mergeSpFormat());
check('บทพูดถูกตัด → มี (MORE)', marksD.some((m) => m.type === 'more' && m.text === '(MORE)'),
  marksD.map((m) => m.type).join(','));
check('บทพูดต่อหน้าใหม่ → ทวนชื่อ + (cont\'d)',
  marksD.some((m) => m.type === 'contd' && m.text.includes('ทอร่า') && m.text.includes("(cont'd)")),
  marksD.filter((m) => m.type === 'contd').map((m) => m.text).join(','));

// ── สวิตช์ปิด ──
const offAll = SF.mergeSpFormat({ continued: { enabled: false } });
check('ปิดทั้งระบบ → ไม่มีเครื่องหมายเลย',
  CT.computeContinueds(SF.paginate(longScene, { lines: 20, fmt: offAll }), offAll).length === 0);
const offScene = SF.mergeSpFormat({ continued: { scene: false } });
check('ปิดเฉพาะฉาก → ไม่มี CONTINUED แต่ยังตัดหน้าปกติ',
  !CT.computeContinueds(SF.paginate(longScene, { lines: 20, fmt: offScene }), offScene)
    .some((m) => m.type === 'continued-top'));
const offDlg = SF.mergeSpFormat({ continued: { dialogue: false } });
check('ปิดเฉพาะบทพูด → ไม่มี (MORE)',
  !CT.computeContinueds(SF.paginate(dlg, { lines: 20, fmt: offDlg }), offDlg)
    .some((m) => m.type === 'more'));
const noNum = SF.mergeSpFormat({ continued: { number: false } });
check('ปิดเลขกำกับ → ไม่มีวงเล็บตัวเลข',
  SF.paginate(longScene, { lines: 20, fmt: noNum })
    .pages.every((p) => !/CONTINUED: \(\d+\)/.test(p.continuedTop || '')));

// ── ข้อความที่ผู้ใช้ตั้งเอง (ข้อ 92) ──
const thai = SF.mergeSpFormat({ strings: { continuedBottom: '(ต่อหน้าถัดไป)', continuedTop: 'ต่อจากหน้าก่อน:' } });
const pagesTH = SF.paginate(longScene, { lines: 20, fmt: thai });
check('ใช้ข้อความไทยที่ผู้ใช้ตั้งได้',
  pagesTH.pages.some((p) => p.continuedBottom === '(ต่อหน้าถัดไป)') &&
  pagesTH.pages.some((p) => String(p.continuedTop || '').startsWith('ต่อจากหน้าก่อน:')));

// ── ตัวช่วยอื่น ──
check('continuedsFromBlocks ให้ผลเท่ากับเรียกสองขั้น',
  CT.continuedsFromBlocks(longScene, { lines: 20 }).length === marksA.length);
// [alpha.86] สรุปต้องรับ `pages` ด้วย เพราะเครื่องหมายฉากอยู่ที่หน้า ไม่ได้อยู่ใน marks
const sum = CT.continuedSummary(marksA, pagesA);
check('continuedSummary นับครบทั้งสองแหล่ง (marks + pages)',
  sum.total > marksA.length && sum['continued-top'] > 0, JSON.stringify(sum));
check('continuedSummary ไม่ส่ง pages ก็ยังนับ marks ได้',
  CT.continuedSummary(marksA).total === marksA.length);
check('continuedStatusText อ่านรู้เรื่อง', /ต่อเนื่อง/.test(CT.continuedStatusText(marksA, pagesA)));
check('continuedStatusText ตอนไม่มีอะไร', CT.continuedStatusText([]) === 'ต่อเนื่อง: ไม่มี');
check('pageAnchor คืนตำแหน่งบล็อกจริงตัวแรก',
  CT.pageAnchor(pagesA.pages[1]) === (pagesA.pages[1].blocks.find((b) => Number.isFinite(b.pos)) || {}).pos);
check('pageAnchor หน้าว่าง → null', CT.pageAnchor({ blocks: [] }) === null);

// ── หน้าที่พร้อมพิมพ์ (ส่งออก) ──
const withMarks = CT.pagesWithContinueds(pagesA, SF.mergeSpFormat());
// [alpha.83 ข้อ 6] หน้าที่ได้ CONTINUED ไม่ใช่หน้าแรกเสมอไปแล้ว — หาหน้าที่มีจริง
const iBot = pagesA.pages.findIndex((p) => p.continuedBottom);
const iTop = pagesA.pages.findIndex((p) => p.continuedTop);
check('pagesWithContinueds ใส่ CONTINUED: เป็นบล็อกจริงต้นหน้าที่ต่อจากฉากเดิม',
  iTop > 0 && withMarks[iTop].blocks[0].el === 'continued-top', iTop);
check('pagesWithContinueds ใส่ (CONTINUED) ท้ายหน้าที่ยังไม่จบบล็อก',
  iBot >= 0 && withMarks[iBot].blocks[withMarks[iBot].blocks.length - 1].el === 'continued-bottom',
  iBot);
check('pagesWithContinueds ไม่ทำลายบล็อกเดิม',
  withMarks[0].blocks.filter((b) => b.el === 'action').length ===
  pagesA.pages[0].blocks.filter((b) => b.el === 'action').length);
check('continuedPlainText มีข้อความต่อเนื่องอยู่ในนั้น',
  CT.continuedPlainText(pagesA, SF.mergeSpFormat()).includes('CONTINUED:'));

// ── CSS ที่ spCss สร้างให้ ──
const css = SF.spCss(SF.mergeSpFormat());
check('spCss สร้างกฎ .sp-more', /\.sp\.sp-more\{/.test(css));
check('spCss สร้างกฎ CONTINUED บน/ล่าง',
  /\.sp-continued-top/.test(css) && /\.sp-continued-bottom/.test(css));
check('(CONTINUED) ชิดขวา', /\.sp-continued-bottom[^}]*text-align:right/.test(css));
check('CONTINUED: ชิดซ้าย', /\.sp-continued-top[^}]*text-align:left/.test(css));

// ── ส่งออกผ่าน compile.js (ขั้นตอน sp-continued) ──
const CP = build('compile.js', 'k2-spcont-compile-test.cjs');
// [alpha.83 ข้อ 6] ต้องมี "บล็อกเดียวที่ยาวจนถูกหั่นคร่อมหน้า" ไม่งั้นไม่มี CONTINUED ตามกฎใหม่
const scriptText = ['.INT. ห้องนอน - กลางคืน',
  '!' + 'บรรยายยาวมากจนล้นหน้า '.repeat(400),
  ...Array.from({ length: 20 }, (_, i) => '!บรรยายฉากที่ ' + i)].join('\n');
const withCont = CP.insertContinueds(scriptText);
check('[compile] แทรก CONTINUED: ลงในข้อความส่งออก', withCont.includes('CONTINUED:'));
check('[compile] แทรก (CONTINUED) ท้ายหน้า', withCont.includes('(CONTINUED)'));
check('[compile] คั่นหน้าด้วยเครื่องหมายขึ้นหน้าใหม่', withCont.includes(CP.PAGE_BREAK));
check('[compile] เนื้อบทเดิมยังอยู่ครบ',
  withCont.includes('บรรยายฉากที่ 0') && withCont.includes('บรรยายฉากที่ 19'));
// [alpha.60r3a] มาตรฐานรหัสใหม่: หัวฉากเขียนออกเป็น `### ` (H3) — รับรหัสเดิม (`.` / INT.) ด้วย
check('[compile] หัวฉากยัง round-trip ได้ (### / จุด / INT.)',
  /(^|\n)(### |\.|INT\.)/.test(withCont),
  withCont.split('\n').slice(0, 3).join(' | '));
check('[compile] มีขั้นตอน sp-continued ให้เลือกในเวิร์กโฟลว์',
  !!CP.stepDef('sp-continued') && CP.stepDef('sp-continued').stage === 'text');
// [alpha.58r บั๊ก 13] พรีเซ็ตนิยายยังต้องไม่เปิด — แต่ต้องมีพรีเซ็ต "บทภาพยนตร์" ที่เปิดให้
const spOn = (p) => (p.steps || []).some((s) => s.key === 'sp-continued' && s.on !== false);
check('[compile] พรีเซ็ตของนิยายไม่เปิดขั้นตอนนี้',
  CP.PRESETS.filter((p) => p.id !== 'screenplay').every((p) => !spOn(p)));
check('[compile] มีพรีเซ็ตบทภาพยนตร์ที่เปิด sp-continued ให้เลย (บั๊ก 13)',
  !!CP.PRESETS.find((p) => p.id === 'screenplay' && spOn(p)));
check('[compile] ข้อความว่าง → ไม่พัง', typeof CP.insertContinueds('') === 'string');

// ═══ [alpha.84 ข้อ 2] จุดตัดต้องเป็น "บรรทัดที่ถูกหั่น" ไม่ใช่หัวย่อหน้า ═══
// อาการเดิม: โหมดปกติ/จัดหน้าเอาเส้นคั่นหน้า + (MORE) + ชื่อ+(cont'd) ไปกองไว้ที่ต้นบทพูด
// ทั้งก้อน (เพราะท่อนหางถือ `pos` ของบล็อกเดิม) — มุมมองหน้าคู่ถูกอยู่แล้วเพราะมันวาดจาก
// ผล paginate ตรง ๆ ไม่ต้องแปลงกลับเป็นตำแหน่งในเอกสาร
{
  const fmt = SF.mergeSpFormat({});
  const long = Array.from({ length: 140 }, (_, i) => 'บทพูดยาวมากบรรทัดที่' + i + ' ').join('');
  let at = 0;
  const mk = (el, text) => { const b = { el, text, pos: at }; at += text.length + 2; return b; };
  const blocks = [mk('scene', 'INT. ROOM - DAY'), mk('character', 'TORA'), mk('dialogue', long)];
  const dlgPos = blocks[2].pos;
  const pg = SF.paginate(blocks, { fmt });
  check('[84-2] บทพูดยาวถูกหั่นข้ามหน้าจริง', pg.count >= 2, String(pg.count));

  const tail = pg.pages[1].blocks.find((b) => b.split === 'tail');
  check('[84-2] ท่อนหางจำระยะตัวอักษรของจุดตัดไว้ (cut)',
    !!tail && Number.isFinite(tail.cut) && tail.cut > 0, tail && tail.cut);
  check('[84-2] ท่อนหางคือข้อความส่วนที่เหลือจริง ๆ ตามระยะ cut',
    !!tail && long.slice(tail.cut) === tail.text);
  check('[84-2] ท่อนหางยังถือ pos ของบล็อกเดิม (มันคือย่อหน้าเดียวกัน)',
    !!tail && tail.pos === dlgPos);

  check('[84-2] blockDocPos: บล็อกปกติ = ตำแหน่งของโหนด',
    SF.blockDocPos({ el: 'action', pos: 42 }) === 42);
  check('[84-2] blockDocPos: ท่อนหาง = pos + 1 + cut (ตำแหน่งในเนื้อข้อความ)',
    SF.blockDocPos({ el: 'dialogue', pos: 42, cut: 7 }) === 50);
  check('[84-2] blockDocPos: บล็อกสังเคราะห์ (ไม่มี pos) → null',
    SF.blockDocPos({ el: 'more', text: '(MORE)' }) === null);
  check('[84-2] isMidBlock บอกได้ว่าอยู่กลางย่อหน้าไหม',
    SF.isMidBlock(tail) === true && SF.isMidBlock(blocks[0]) === false);
  check('[84-2] elementIndentIn: บทพูด 2.5" − ขอบซ้าย 1.5" = 1"',
    SF.elementIndentIn(fmt, 'dialogue') === 1 && SF.elementIndentIn(fmt, 'action') === 0);

  const anchor = CT.pageAnchor(pg.pages[1]);
  check('[84-2] pageAnchor ไม่ใช่หัวบล็อกอีกแล้ว', anchor !== dlgPos, `${anchor} vs ${dlgPos}`);
  check('[84-2] pageAnchor = ตำแหน่งของบรรทัดที่ถูกหั่นจริง',
    anchor === dlgPos + 1 + tail.cut, `${anchor} vs ${dlgPos + 1 + tail.cut}`);

  const marks = CT.computeContinueds(pg, fmt);
  check('[84-2] เครื่องหมายทุกตัวย้ายไปจุดตัดพร้อมกัน (ไม่กระจัดกระจาย)',
    marks.length > 0 && marks.every((m) => m.pos === anchor), JSON.stringify(marks.map((m) => m.pos)));
  check('[84-2] เครื่องหมายรู้ว่าตัวเองถูกวาดในบล็อก + ระยะที่ต้องหักคืน',
    marks.every((m) => m.mid === true && m.off === 1),
    JSON.stringify(marks.map((m) => [m.type, m.mid, m.off])));
  check("[84-2] ชุดเครื่องหมายยังครบเหมือนเดิม ((MORE) + ชื่อ+(cont'd))",
    marks.some((m) => m.type === 'more') && marks.some((m) => m.type === 'contd'));

  // รอยต่อ *ระหว่างบล็อก* ต้องไม่เปลี่ยนพฤติกรรมเดิมเลย
  const plain = Array.from({ length: 80 }, (_, i) => ({ el: 'action', text: 'บรรยาย ' + i, pos: i * 12 }));
  const pgP = SF.paginate(plain, { fmt, lines: 20 });
  const mP = CT.computeContinueds(pgP, fmt);
  check('[84-2] รอยต่อระหว่างบล็อกยังเป็นตำแหน่งระดับบล็อกเหมือนเดิม',
    mP.every((m) => m.mid === false && m.off === 0));
}

// ═══ [alpha.85 ข้อ 1] หนึ่งรอยต่อ = เครื่องหมายชุดเดียว + บัญชีบรรทัดต้องลงตัว ═══
// กฎที่ผู้ใช้กำหนด: หน้าละ 20 บรรทัด → เนื้อ 19 + เครื่องหมาย 1 เสมอ
// บทพูดถูกหั่น = (MORE) ท้ายหน้า · ชื่อ (CONT'D) ต้นหน้าใหม่ · **ห้ามมี CONTINUED**
{
  const fmt = SF.mergeSpFormat({});
  const LINES = 20;
  // ผลรวมบรรทัดที่หน้าหนึ่งกินจริง = บรรทัดของบล็อก + ระยะเว้นนำหน้าของบล็อกที่ไม่ใช่ตัวแรก
  // บล็อกสังเคราะห์ ((MORE) · ชื่อ+(cont'd)) ถูกจองไว้เป็น 1 บรรทัดตรง ๆ ไม่มีระยะเว้นนำหน้า
  const usedLines = (pg) => (pg.blocks || []).reduce((a, b, i) => {
    if (b.more || b.contd) return a + 1;
    const c = fmt.elements[b.el] || fmt.elements.action;
    const before = i && b.split !== 'tail' ? Math.round((c.linesBefore ?? 10) / 10) : 0;
    return a + before + (b.lines || 1);
  }, 0);
  const has = (pg, k) => (pg.blocks || []).some((b) => b[k] === true);

  // — บทพูดยาวถูกหั่นกลาง —
  const dlg = SF.paginate([{ el: 'scene', text: 'INT. ROOM - DAY' },
                           { el: 'character', text: 'TORA' },
                           { el: 'dialogue', text: 'พูดยาว '.repeat(200) }],
                          { fmt, lines: LINES });
  check('[85-1] บทพูดยาวถูกหั่นข้ามหน้า', dlg.count >= 2, String(dlg.count));
  check('[85-1] ท้ายหน้าแรกมี (MORE)', has(dlg.pages[0], 'more'));
  check("[85-1] ต้นหน้าที่สองเป็นชื่อตัวละคร + (cont'd)",
    dlg.pages[1].blocks[0].contd === true &&
    dlg.pages[1].blocks[0].text.includes('TORA') &&
    dlg.pages[1].blocks[0].text.includes("cont'd"), JSON.stringify(dlg.pages[1].blocks[0]));
  check('[85-1] ★ บทพูดถูกหั่น = ห้ามมี (CONTINUED) ท้ายหน้า',
    !dlg.pages[0].continuedBottom, dlg.pages[0].continuedBottom);
  check('[85-1] ★ บทพูดถูกหั่น = ห้ามมี CONTINUED: ต้นหน้า',
    !dlg.pages[1].continuedTop, dlg.pages[1].continuedTop);
  check('[85-1] ★ หน้าแรกใช้ครบ 20 บรรทัดพอดี (เนื้อ 19 + MORE 1)',
    usedLines(dlg.pages[0]) === LINES, usedLines(dlg.pages[0]));
  check('[85-1] ไม่มีหน้าไหนล้นโควตา',
    dlg.pages.every((p) => usedLines(p) <= LINES),
    JSON.stringify(dlg.pages.map(usedLines)));
  check('[85-1] computeContinueds คืนเฉพาะ more + contd (CONTINUED อยู่ที่หน้า)',
    CT.computeContinueds(dlg, fmt).every((m) => m.type === 'more' || m.type === 'contd'),
    JSON.stringify(CT.computeContinueds(dlg, fmt).map((m) => m.type)));

  // — บรรยายยาวถูกหั่น (ฉากข้ามหน้าแบบไม่ใช่บทพูด) —
  const act = SF.paginate([{ el: 'scene', text: 'INT. ROOM - DAY' },
                           { el: 'action', text: 'บรรยายยาว '.repeat(200) }],
                          { fmt, lines: LINES });
  check('[85-1] บรรยายถูกหั่น → มี (CONTINUED) ท้ายหน้า',
    act.pages[0].continuedBottom === '(CONTINUED)', act.pages[0].continuedBottom);
  check('[85-1] บรรยายถูกหั่น → มี CONTINUED: ต้นหน้าใหม่',
    /^CONTINUED:/.test(act.pages[1].continuedTop || ''), act.pages[1].continuedTop);
  check('[85-1] ★ บรรยายถูกหั่น = ห้ามมี (MORE)',
    !has(act.pages[0], 'more') && !has(act.pages[1], 'contd'));
  // [alpha.86] CONTINUED ไปอยู่ในระยะขอบแล้ว → เนื้อหน้าใช้โควตาได้เต็ม 20 ไม่ต้องเจียดให้
  check('[85-1] ★ หน้าแรกใช้โควตาเต็ม 20 บรรทัด (CONTINUED ไม่กินที่)',
    usedLines(act.pages[0]) === LINES, usedLines(act.pages[0]));
  check('[85-1] ไม่มีหน้าไหนล้นโควตา',
    act.pages.every((p) => usedLines(p) <= LINES),
    JSON.stringify(act.pages.map(usedLines)));

  // — ไม่มีหน้าไหนได้ทั้งสองระบบพร้อมกัน ไม่ว่าเนื้อหาแบบไหน —
  const mixed = SF.paginate([{ el: 'scene', text: 'INT. A - DAY' },
                             { el: 'action', text: 'บรรยาย '.repeat(120) },
                             { el: 'character', text: 'CASSIE' },
                             { el: 'dialogue', text: 'พูด '.repeat(300) },
                             { el: 'action', text: 'จบ' }], { fmt, lines: LINES });
  check('[85-1] ★ ไม่มีหน้าไหนมีทั้ง (MORE) และ (CONTINUED) พร้อมกัน',
    mixed.pages.every((p) => !(has(p, 'more') && p.continuedBottom)),
    JSON.stringify(mixed.pages.map((p) => [has(p, 'more'), !!p.continuedBottom])));
  check("[85-1] ★ ไม่มีหน้าไหนขึ้นทั้ง CONTINUED: และ ชื่อ (cont'd)",
    mixed.pages.every((p) => !(has(p, 'contd') && p.continuedTop)),
    JSON.stringify(mixed.pages.map((p) => [has(p, 'contd'), !!p.continuedTop])));
  check('[85-1] ทุกหน้าอยู่ในโควตา 20 บรรทัด',
    mixed.pages.every((p) => usedLines(p) <= LINES),
    JSON.stringify(mixed.pages.map(usedLines)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
