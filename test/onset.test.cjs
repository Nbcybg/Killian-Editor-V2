// test/onset.test.cjs — [alpha.164] "ฉากมีปัญหา" · การเทียบทีละบล็อก + บันทึกฉบับเดิม + ปลั๊กอิน (ไม่ต้องเปิด electron)
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esb = require('esbuild');
const build = (entry, name) => {
  const out = path.join(os.tmpdir(), name);
  esb.buildSync({ entryPoints: [path.join(__dirname, '..', entry)], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const D = build('src/onset-diff.js', '_onsetdiff.cjs');
// ปลั๊กอิน + prosemirror ในบันเดิลเดียว (แยกบันเดิล = คนละสำเนาของ prosemirror)
const P = build('test/_onset-entry.mjs', '_onsetplugin.cjs');
const PM = P;

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════ บันทึกฉบับเดิม ═══════
const rec = D.newOnsetRecord({ sceneId: 'k2-ab', file: 'เล่ม/Draft/x.md', title: 'ตลาด', baseline: 'ก\n\nข', color: 'red', now: 0 });
check('บันทึก: รูปครบ + รุ่น', rec.v === 1 && rec.sceneId === 'k2-ab' && rec.baseline === 'ก\n\nข' && rec.format === 'prose');
check('บันทึก: สีมั่ว → แดงเริ่มต้น (ไม่ยัดสตริงดิบลง style)', rec.color === D.ONSET_DEFAULT_COLOR);
check('บันทึก: สีถูกต้องผ่าน + ตัวเล็ก', D.normColor('#30A46C') === '#30a46c' && D.normColor('#abc') === '#abc');
check('บันทึก: สีที่มี css ปน → ตกไปค่าเริ่มต้น', D.normColor('#fff;background:url(x)') === D.ONSET_DEFAULT_COLOR);
check('บันทึก: normalize ไฟล์พัง/ไม่มี sceneId = null', D.normalizeOnsetRecord(null) === null && D.normalizeOnsetRecord({ baseline: 'x' }) === null);
check('บันทึก: normalize ของที่แก้มือ (ขาดช่อง) ยังใช้ได้', D.normalizeOnsetRecord({ sceneId: 's1' }).baseline === '');
check('บันทึก: บทภาพยนตร์จำโหมดไว้', D.newOnsetRecord({ sceneId: 's', format: 'screenplay' }).format === 'screenplay');
check('ชื่อไฟล์: ตัวอักษรต้องห้ามถูกแทน', D.onsetFileName('a/b:c d') === 'a-b-c-d.json', D.onsetFileName('a/b:c d'));
check('โฟลเดอร์: OnSet', D.ONSET_DIR === 'OnSet');

// ═══════ การเทียบ ═══════
const k = (arr) => arr.map((x) => D.blockKey('p', '', x));
{
  const d = D.diffBlocks(k(['ก', 'ข', 'ค']), k(['ก', 'ข', 'ค']));
  check('เทียบ: เหมือนกันทุกบรรทัด = ไม่มีจุดที่แก้', d.kinds.every((x) => !x) && !d.gaps.length && d.stats.hunks === 0);
}
{
  const d = D.diffBlocks(k(['ก', 'ขใหม่', 'ค']), k(['ก', 'ข', 'ค']));
  check('เทียบ: แก้บรรทัดกลาง = changed ที่บรรทัดนั้นบรรทัดเดียว', d.kinds.join() === ',changed,' && d.stats.changed === 1 && d.stats.hunks === 1, d.kinds.join());
}
{
  const d = D.diffBlocks(k(['ก', 'ข', 'เพิ่ม', 'ค']), k(['ก', 'ข', 'ค']));
  check('เทียบ: เพิ่มบรรทัด = added', d.kinds.join() === ',,added,' && d.stats.added === 1, d.kinds.join());
}
{
  const d = D.diffBlocks(k(['ก', 'ค']), k(['ก', 'ข', 'ค']));
  check('เทียบ: ลบบรรทัด = gap ก่อนบรรทัดถัดไป', d.kinds.every((x) => !x) && d.gaps.join() === '1' && d.stats.removed === 1, JSON.stringify(d));
}
{
  const d = D.diffBlocks(k(['ก', 'ข']), k(['ก', 'ข', 'ค', 'ง']));
  check('เทียบ: ลบท้ายเอกสาร = gap ที่ own.length', d.gaps.join() === '2' && d.stats.removed === 2, JSON.stringify(d));
}
{
  const d = D.diffBlocks([], k(['ก']));
  check('เทียบ: ฉบับบนจอว่าง', d.gaps.join() === '0' && d.stats.removed === 1);
  const d2 = D.diffBlocks(k(['ก']), []);
  check('เทียบ: อีกฉบับว่าง = ทุกบรรทัด added', d2.kinds.join() === 'added');
}
{
  // สองจุดห่างกัน = 2 ก้อน · บรรทัดซ้ำ (บรรทัดว่างของบท) ไม่ทำให้จับคู่ผิด
  const d = D.diffBlocks(k(['', 'ก', '', 'X', '', 'ค', '', 'Y']), k(['', 'ก', '', 'ข', '', 'ค', '', 'ง']));
  check('เทียบ: สองจุด = 2 ก้อน ตรงตำแหน่ง', d.kinds.join() === ',,,changed,,,,changed' && d.stats.hunks === 2, d.kinds.join());
}
{
  // ชนิด element ต่างกัน = ต่างกัน (ตัวละคร→บรรยาย ข้อความเดิม)
  const d = D.diffBlocks([D.blockKey('sp', 'action', 'โทระ')], [D.blockKey('sp', 'character', 'โทระ')]);
  check('เทียบ: เปลี่ยนชนิด element นับเป็นการแก้', d.kinds[0] === 'changed');
  check('เทียบ: ช่องว่างท้ายบรรทัดไม่นับ', D.blockKey('p', '', 'ก  ') === D.blockKey('p', '', 'ก'));
}
{
  // เอกสารใหญ่ (เกินเพดาน DP) ต้องไม่ค้าง และยังเจอจุดที่แก้
  const big = Array.from({ length: 3000 }, (_, i) => 'บรรทัด' + (i % 7 === 0 ? i : ''));
  const bigB = big.slice(); bigB[1500] = 'แก้แล้ว'; bigB.splice(10, 1);
  const t0 = Date.now();
  const d = D.diffBlocks(k(bigB), k(big));
  check('เทียบ: 3,000 บรรทัด < 1.5 วินาที', Date.now() - t0 < 1500, (Date.now() - t0) + 'ms');
  check('เทียบ: เอกสารใหญ่ยังเจอบรรทัดที่แก้', d.kinds.filter(Boolean).length >= 1 && d.stats.removed >= 1, JSON.stringify(d.stats));
}
{
  // matchBlocks ต้องเรียงตามลำดับเสมอ (ไม่ไขว้)
  const a = k(['a', 'b', 'c', 'd', 'e']), b = k(['c', 'a', 'b', 'e', 'd']);
  const m = D.matchBlocks(a, b).filter((x) => x >= 0);
  check('จับคู่: ลำดับไม่ไขว้', m.every((x, i) => i === 0 || x > m[i - 1]), m.join());
}

// ═══════ ปลั๊กอิน (state จริงของ ProseMirror) ═══════
{
  const { Schema, EditorState } = PM;
  const schema = new Schema({ nodes: { doc: { content: 'block+' }, paragraph: { group: 'block', content: 'text*' },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 1 } } }, text: {} } });
  const mk = (lines) => schema.node('doc', null, lines.map((x) => schema.node('paragraph', null, x ? [schema.text(x)] : [])));
  const base = mk(['ก', 'ข', 'ค']);
  let st = EditorState.create({ doc: mk(['ก', 'ขแก้', 'ค']), plugins: [P.onsetPlugin()] });
  check('ปลั๊กอิน: ยังไม่สั่ง = ไม่มี decoration', P.onsetKey.getState(st).deco.find().length === 0);
  const other = P.docKeys(base);
  check('ปลั๊กอิน: docKeys ใช้ชนิดโหนด+ข้อความ', other[1] === D.blockKey('paragraph', '', 'ข'), other[1]);
  st = st.apply(st.tr.setMeta(P.onsetKey, { cfg: { other, side: 'revised', lock: false } }));
  const decos = P.onsetKey.getState(st).deco.find();
  check('ปลั๊กอิน: บรรทัดที่แก้ได้แถบ + ! (2 decoration)', decos.length === 2, decos.length);
  check('ปลั๊กอิน: แถบอยู่ที่บรรทัดที่ 2', decos.some((d) => d.from === 3 && d.type.attrs && /k-onset-changed/.test(d.type.attrs.class)),
        JSON.stringify(decos.map((d) => [d.from, d.to])));
  check('ปลั๊กอิน: สรุปจุดที่แก้ 1 ก้อน', P.onsetKey.getState(st).info.hunks === 1);
  // พิมพ์แก้กลับให้เหมือนเดิม → แถบหาย
  const tr = st.tr.insertText('ข', 4, 4 + 'ขแก้'.length);
  st = st.apply(tr);
  check('ปลั๊กอิน: แก้กลับเหมือนฉบับเดิม = แถบหายเอง', P.onsetKey.getState(st).deco.find().length === 0, st.doc.textContent);
  // ล็อก (ดูฉบับเดิม) = ปฏิเสธธุรกรรมที่แก้เนื้อ
  st = st.apply(st.tr.setMeta(P.onsetKey, { cfg: { other, side: 'original', lock: true } }));
  const before = st.doc.textContent;
  const after = st.apply(st.tr.insertText('X', 1)).doc.textContent;
  check('ปลั๊กอิน: ฉบับเดิม = อ่านอย่างเดียวจริง (ธุรกรรมถูกปฏิเสธ)', after === before, after);
  // ปิดการเทียบ
  st = st.apply(st.tr.setMeta(P.onsetKey, { cfg: null }));
  check('ปลั๊กอิน: ปิดการเทียบ = decoration หมด + ปลดล็อก',
        P.onsetKey.getState(st).deco.find().length === 0 && st.apply(st.tr.insertText('X', 1)).doc.textContent !== st.doc.textContent);
  // ลบบรรทัดกลาง → gap
  let st2 = EditorState.create({ doc: mk(['ก', 'ค']), plugins: [P.onsetPlugin()] });
  st2 = st2.apply(st2.tr.setMeta(P.onsetKey, { cfg: { other, side: 'revised' } }));
  const g = P.onsetKey.getState(st2).deco.find();
  check('ปลั๊กอิน: บรรทัดถูกลบ = ขีดบอกตำแหน่งที่บรรทัดถัดไป', g.some((d) => d.type.attrs && /k-onset-gap/.test(d.type.attrs.class)),
        JSON.stringify(g.map((d) => d.type.attrs)));
  // หัวข้อระดับต่างกัน = ต่างกัน
  const h1 = schema.node('doc', null, [schema.node('heading', { level: 1 }, [schema.text('ก')])]);
  const h2 = schema.node('doc', null, [schema.node('heading', { level: 2 }, [schema.text('ก')])]);
  check('ปลั๊กอิน: ระดับหัวข้อเป็นส่วนของคีย์', P.docKeys(h1)[0] !== P.docKeys(h2)[0]);
}

console.log('--- RESULT ---');
console.log(`PASS ${pass}  FAIL ${fail}`);
process.exit(fail ? 1 : 0);
