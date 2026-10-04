// test/fp-shot.test.cjs — ข้อเท็จจริงของช็อตจากผังพื้นที่ + คำขอ/คำตอบ prompt ของ AI + shot list (src/floorplan/fp-shot.js)
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_fpshot.cjs');
require('esbuild').buildSync({
  stdin: { contents: "export * from './src/floorplan/fp-shot.js'; export * as F from './src/floorplan/fp-data.js';",
           resolveDir: path.join(__dirname, '..'), loader: 'js' },
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent',
});
const S = require(out);
const F = S.F;

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ผังตัวอย่าง: กล้อง A ที่ (0,5) หันขึ้น · Tora ตรงหน้า (0,1) หันเข้ากล้อง · Cassie ด้านขวา (1.2,1) หันซ้าย · Luna หลังกล้อง
function mk() {
  const p = F.newPlan('t');
  const cam = F.newObject('camera', { x: 0, y: 5, rot: -90, lens: 24, range: 10, body: 'sony-fx3', label: 'A', support: 'dolly' });
  const tora = F.newObject('entity', { x: 0, y: 1, rot: 90, entityFile: 'W/tora.json', label: 'Tora' });
  const cas = F.newObject('entity', { x: 1.2, y: 1, rot: 180, label: 'Cassie' });
  const luna = F.newObject('entity', { x: 0, y: 8, label: 'Luna' });
  const key = F.newObject('light', { x: 3, y: 1, kind: 'fresnel', rot: 180 });
  const lamp = F.newObject('light', { x: -1, y: 0, kind: 'practical' });
  const door = F.newObject('shape', { x: 0, y: -1, kind: 'door', label: 'ประตูหลังร้าน' });
  p.objects.push(cam, tora, cas, luna, key, lamp, door);
  return { p, cam, tora, cas, luna, key, lamp, door };
}

{
  const { p } = mk();
  const f = S.shotFacts(p, 0, (file) => (file === 'W/tora.json' ? 'ทอร่า' : ''));
  check('shotFacts: มีกล้อง = ได้ข้อเท็จจริง', !!f && f.camera.label === 'A' && f.camera.body === 'Sony FX3' && f.camera.lensMm === 24);
  check('ชื่อจาก Wiki ชนะป้ายในผัง', f.subjects[0].name === 'ทอร่า', f.subjects.map((s) => s.name).join());
  check('ในภาพ 2 คน เรียงใกล้→ไกล · คนหลังกล้องอยู่นอกภาพ', f.subjects.length === 2 && f.offscreen.includes('Luna'), JSON.stringify(f.offscreen));
  check('Tora อยู่กลางภาพ · หันเข้ากล้อง', f.subjects.find((s) => s.name === 'ทอร่า').frame === 'center'
        && f.subjects.find((s) => s.name === 'ทอร่า').facing === 'toward camera');
  const c = f.subjects.find((s) => s.name === 'Cassie');
  check('Cassie อยู่ขวาของภาพ · หันข้างไปทางซ้ายของภาพ', c.frame === 'right' && /profile, facing frame left/.test(c.facing), c.frame + ' / ' + c.facing);
  check('ขนาดภาพประเมินจากระยะ + มุมรับภาพแนวตั้ง', ['ws', 'fs', 'ms'].includes(f.shotSize) && f.shotSizeSetBy === 'estimated', f.shotSize);
  const fres = f.lights.find((l) => l.type === 'fresnel');
  check('ไฟ fresnel อยู่ขวา = ไฟข้างจากขวาของภาพ · 3200K = อุ่น', /side from frame right/.test(fres.direction) && fres.tone === 'warm', JSON.stringify(fres));
  check('ไฟ practical อยู่ในภาพ', f.lights.find((l) => l.type === 'practical').inFrame === true);
  check('ของประกอบในภาพ (ป้ายชื่อ)', f.setPieces.includes('ประตูหลังร้าน'));
  check('ไม่มีจังหวะถัดไป = กล้องนิ่ง', f.camera.moveToNextBeat === 'static');
}
{
  // จังหวะ 2: Tora เดินเข้าหากล้อง · Cassie ออกจากฉาก · กล้อง dolly in · Luna เข้ามาในภาพ
  const { p, cam, tora, cas, luna } = mk();
  F.setPose(p, luna.id, 0, { hidden: true });
  F.insertBeat(p, 0);
  F.setPose(p, tora.id, 1, { y: 3 });
  F.setPose(p, cas.id, 1, { hidden: true });
  F.setPose(p, cam.id, 1, { y: 4 });
  F.setPose(p, luna.id, 1, { hidden: false, x: -0.5, y: 2 });
  const f = S.shotFacts(p, 0);
  const t = f.subjects.find((s) => s.name === 'Tora');
  check('วิดีโอ: Tora เดิน 2 ม. เข้าหากล้อง', /moves 2m toward camera/.test(t.next || ''), t.next);
  check('วิดีโอ: Cassie ออกจากฉาก', f.subjects.find((s) => s.name === 'Cassie').next === 'exits');
  check('วิดีโอ: กล้องบน dolly เคลื่อนเข้า 1 ม.', /dolly in, 1m/.test(f.camera.moveToNextBeat), f.camera.moveToNextBeat);
  check('วิดีโอ: Luna เข้ามาในภาพจังหวะถัดไป', f.entersNextBeat.includes('Luna'), JSON.stringify(f.entersNextBeat));
  check('ผู้กำกับตั้งขนาดภาพเอง = ใช้ค่าที่ตั้ง', (() => { p.beats[0].shot = 'cu'; const g = S.shotFacts(p, 0); return g.shotSize === 'cu' && g.shotSizeSetBy === 'director'; })());
  F.setPose(p, cam.id, 1, { rot: -60 });
  check('กล้องหมุน = pan ขวา', /pan right 30deg/.test(S.shotFacts(p, 0).camera.moveToNextBeat), S.shotFacts(p, 0).camera.moveToNextBeat);
}
{
  const p = F.newPlan('x');
  check('ไม่มีกล้อง = null', S.shotFacts(p, 0) === null);
  check('frameSide', S.frameSide(-20, 50) === 'left' && S.frameSide(0, 50) === 'center' && S.frameSide(20, 50) === 'right');
  check('facingToCamera: หันหลัง', S.facingToCamera(-90, -90) === 'back to camera');
  check('facingToCamera: สามส่วนสี่', /three-quarter toward camera/.test(S.facingToCamera(45, -90)));
  const cam = F.newObject('camera', { lens: 50, body: 'sony-fx3' });
  check('estimateShotSize: ใกล้มาก = CU/ECU · ไกล = WS/EWS', ['cu', 'ecu'].includes(S.estimateShotSize(cam, 0.6)) && ['ws', 'ews'].includes(S.estimateShotSize(cam, 15)));
  check('verticalFov: FX3 50mm ≈ 26.8°', Math.abs(S.verticalFov(cam) - 26.8) < 0.3, S.verticalFov(cam));
  check('factsHash: เปลี่ยนเมื่อข้อมูลเปลี่ยน', S.factsHash({ a: 1 }) !== S.factsHash({ a: 2 }) && S.factsHash({ a: 1 }, 'x') !== S.factsHash({ a: 1 }));
}
{
  const L = { system: 'SYS', facts: 'FACTS', excerpt: 'EXC', characters: 'CHAR', style: 'STYLE', previous: 'PREV', sceneInfo: 'INFO' };
  const r = S.buildShotPromptRequest({ facts: { beat: 1 }, excerpt: 'บรรทัด', characters: [{ name: 'ทอร่า', text: 'ผมสีส้ม' }], style: '35mm film', previous: 'prev', sceneInfo: 'INT. ร้าน' }, L);
  check('buildShotPromptRequest: system จากไฟล์ภาษา', r.system === 'SYS');
  check('buildShotPromptRequest: ข้อเท็จจริงเป็น JSON + บท + ตัวละคร + สไตล์ + ต่อเนื่อง', /```json[\s\S]*"beat": 1/.test(r.prompt) && r.prompt.includes('บรรทัด')
        && r.prompt.includes('- ทอร่า: ผมสีส้ม') && r.prompt.includes('35mm film') && r.prompt.includes('PREV\nprev') && r.prompt.includes('INFO\nINT. ร้าน'));
  check('buildShotPromptRequest: ไม่มีส่วนเสริม = ไม่ใส่หัวข้อว่าง', !S.buildShotPromptRequest({ facts: {} }, L).prompt.includes('STYLE'));
  check('parse: JSON ตรง ๆ', S.parseShotPrompts('{"image":"a","video":"b"}').image === 'a');
  check('parse: ห่อด้วย ```json + ข้อความนำ', S.parseShotPrompts('Here:\n```json\n{"image":"x","video":"y"}\n```').video === 'y');
  check('parse: มีปีกกาในข้อความ', S.parseShotPrompts('ok {"image":"x"} thanks').image === 'x');
  check('parse: ไม่ใช่ JSON = ok false', S.parseShotPrompts('just text').ok === false && S.parseShotPrompts('').ok === false);
  check('entityBrief: ชื่ออื่น + ช่องข้อมูล + หัวข้อ · ตัดยาว', (() => {
    const b = S.entityBrief({ aliases: ['แมวดำ'], fields: { Hair: 'ดำ', Age: '' }, sections: [{ title: 'ประวัติ', content: 'x'.repeat(900) }] }, 100);
    return b.startsWith('แมวดำ · Hair: ดำ · ประวัติ:') && b.length === 100 && !b.includes('Age');
  })());
  const lines = ['a', 'b', 'c', 'dup', 'e', 'dup', 'g'].map((text, k, arr) => ({ text, nth: arr.slice(0, k).filter((x) => x === text).length }));
  const ex = S.excerptAround(lines, { text: 'dup', nth: 1 }, 1, 1);
  check('excerptAround: ชี้บรรทัดอ้างอิงด้วย >> (บรรทัดซ้ำนับลำดับถูก)', ex === 'e\n>> dup\ng', JSON.stringify(ex));
  check('excerptAround: ไม่มีอ้างอิง = ต้นฉาก', S.excerptAround(lines, null, 1, 1) === 'a\nb\nc');
}
{
  const { p } = mk();
  F.insertBeat(p, 0);
  p.beats[0].ref = { kind: 'scene', text: 'ทอร่าเปิดประตู', nth: 0 };
  p.beats[0].prompt = { image: 'img, "quoted"', video: 'vid' };
  const facts = [S.shotFacts(p, 0), S.shotFacts(p, 1)];
  const rows = S.shotListRows(p, facts, (g, id) => g + ':' + id);
  check('shotListRows: หนึ่งจังหวะหนึ่งแถว', rows.length === 2 && rows[0].reference === 'ทอร่าเปิดประตู' && rows[0].lens === '24mm');
  check('shotListRows: ป้ายผ่านตัวแปล', rows[0].support === 'support:dolly' && rows[0].shot.startsWith('shot:'));
  check('shotListRows: ใครอยู่ในภาพ + ตำแหน่ง', /Tora \(center\)/.test(rows[0].inFrame));
  const heads = S.SHOT_LIST_COLS.map((k) => 'H_' + k);
  const csv = S.shotListCsv(rows, heads);
  check('CSV: มี BOM + หัวคอลัมน์ + escape เครื่องหมายคำพูด', csv.charCodeAt(0) === 0xFEFF && csv.includes('H_beat,H_reference') && csv.includes('"img, ""quoted"""'));
  check('CSV: จำนวนบรรทัด = หัว + แถว', csv.trim().split('\r\n').length === 3);
  const md = S.shotListMarkdown('ผัง', rows, heads);
  check('Markdown: หัวเรื่อง + หัวข้อต่อจังหวะ + prompt ในบล็อกโค้ด', md.startsWith('# ผัง') && md.includes('## H_beat 1 — ทอร่าเปิดประตู') && md.includes('```\nimg, "quoted"\n```'));
  check('F.normalizePlan เก็บ prompt ของจังหวะ + สไตล์', (() => {
    p.style = 'anamorphic'; const n = F.normalizePlan(JSON.parse(JSON.stringify(p)));
    return n.beats[0].prompt.image === 'img, "quoted"' && n.style === 'anamorphic' && n.beats[1].prompt === null;
  })());
}

// ═══════════ [alpha.168 · bug hunt] กระโดดไปบรรทัดอ้างอิง: ลำดับของ "ข้อความย่อย" ไม่ใช่ของ "บรรทัดที่เหมือนกัน" ═══════════
{
  const L = ['ทอร่าเปิดประตู', 'ครับ ผมมาแล้วครับ', 'ครับ', 'เงียบ', 'ครับ', 'ทอร่าเปิดประตูอีกครั้ง'].map((text) => ({ text }));
  check('[bh] บรรทัดที่ไม่ซ้ำ = 0', S.refSearchNth(L, { text: 'ทอร่าเปิดประตู', nth: 0 }) === 0);
  check('[bh] ★ "ครับ" บรรทัดแรก: มี 2 ครั้งในบรรทัดก่อนหน้า → ลำดับ 2 (เดิมส่ง 0 = ไปผิดบรรทัด)', S.refSearchNth(L, { text: 'ครับ', nth: 0 }) === 2, String(S.refSearchNth(L, { text: 'ครับ', nth: 0 })));
  check('[bh] ★ "ครับ" บรรทัดที่สอง → ลำดับ 3', S.refSearchNth(L, { text: 'ครับ', nth: 1 }) === 3);
  check('[bh] คำค้นถูกตัดสั้น (term) นับตาม term', S.refSearchNth(L, { text: 'ทอร่าเปิดประตูอีกครั้ง', nth: 0 }, 'ทอร่าเปิดประตู') === 1);
  check('[bh] หาไม่เจอ (บทถูกแก้) = ค่าเดิมของ nth', S.refSearchNth(L, { text: 'ไม่มีบรรทัดนี้', nth: 2 }) === 2);
  check('[bh] ไม่มีอ้างอิง = 0', S.refSearchNth(L, null) === 0 && S.refSearchNth([], { text: 'x' }) === 0);
}
console.log(`fp-shot: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
