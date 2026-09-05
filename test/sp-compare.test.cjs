// test/sp-compare.test.cjs — [alpha.126] `src/sp-compare.js` (เทียบบท 2 ฉบับด้วย LCS)
//
// เครื่องมือ "เปรียบเทียบบท" ใช้ตัดสินว่าอะไรเพิ่ม/หาย/เปลี่ยนระหว่างสองฉบับ —
// ถ้ามันผิด ผู้ใช้จะเชื่อว่าตัวเองไม่ได้แก้อะไรทั้งที่แก้ไปแล้ว · ตัวอัลกอริทึม (LCS + backtrack)
// เป็นตรรกะบริสุทธิ์ แต่ยังไม่เคยมีเทสตรง
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), '_spcmp.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/sp-compare.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const C = require(out);

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };
const kinds = (d) => d.map((x) => x.type).join(',');

// ───────── ไม่มีอะไรเปลี่ยน ─────────
{
  const s = 'INT. ห้องครัว - กลางวัน\n\nทอร่านั่งอยู่';
  const d = C.compareScripts(s, s);
  ck('★ ไฟล์เหมือนกันเป๊ะ = ไม่มีอะไรถูกทำเครื่องหมายว่าเปลี่ยน',
     d.every((x) => x.type === 'equal'), kinds(d));
  const st = C.diffStats(d);
  ck('สถิติ: เท่ากันทั้งหมด', st.inserted === 0 && st.deleted === 0 && st.changed === 0, JSON.stringify(st));
  ck('รวมเท่ากับจำนวนแถวทั้งหมด', st.total === d.length);
}

// ───────── เพิ่มบรรทัด ─────────
{
  const a = 'INT. ห้องครัว - กลางวัน\n\nทอร่านั่งอยู่';
  const b = 'INT. ห้องครัว - กลางวัน\n\nทอร่านั่งอยู่\n\nฝนเริ่มตก';
  const st = C.diffStats(C.compareScripts(a, b));
  ck('★ เพิ่มเนื้อหา → นับเป็น "เพิ่ม" ไม่ใช่ "เปลี่ยน"', st.inserted > 0, JSON.stringify(st));
  ck('ไม่มีอะไรถูกนับว่าหาย', st.deleted === 0, JSON.stringify(st));
}

// ───────── ลบบรรทัด ─────────
{
  const a = 'INT. ห้องครัว - กลางวัน\n\nทอร่านั่งอยู่\n\nฝนเริ่มตก';
  const b = 'INT. ห้องครัว - กลางวัน\n\nทอร่านั่งอยู่';
  const st = C.diffStats(C.compareScripts(a, b));
  ck('★ ลบเนื้อหา → นับเป็น "หาย"', st.deleted > 0, JSON.stringify(st));
  ck('ไม่มีอะไรถูกนับว่าเพิ่ม', st.inserted === 0, JSON.stringify(st));
}

// ───────── แก้บรรทัดเดิม ─────────
{
  const a = 'INT. ห้องครัว - กลางวัน\n\nทอร่านั่งอยู่';
  const b = 'INT. ห้องครัว - กลางคืน\n\nทอร่านั่งอยู่';
  const d = C.compareScripts(a, b);
  const st = C.diffStats(d);
  ck('★ แก้ข้อความในบรรทัดเดิม = ต้องมีการเปลี่ยนแปลงถูกจับได้',
     st.changed + st.inserted + st.deleted > 0, JSON.stringify(st));
  ck('บรรทัดที่ไม่ได้แตะยังเป็น equal', st.equal > 0, JSON.stringify(st));
}

// ───────── กรณีขอบ ─────────
{
  ck('ไฟล์ว่างทั้งคู่ไม่พัง', Array.isArray(C.compareScripts('', '')));
  const onlyNew = C.diffStats(C.compareScripts('', 'INT. ที่ไหนสักแห่ง - เช้า'));
  ck('★ ของเก่าว่าง = ทุกอย่างเป็นของใหม่', onlyNew.deleted === 0 && onlyNew.inserted > 0,
     JSON.stringify(onlyNew));
  const onlyOld = C.diffStats(C.compareScripts('INT. ที่ไหนสักแห่ง - เช้า', ''));
  ck('★ ของใหม่ว่าง = ทุกอย่างหายหมด', onlyOld.inserted === 0 && onlyOld.deleted > 0,
     JSON.stringify(onlyOld));
  ck('สถิติของอาร์เรย์ว่าง = ศูนย์ทุกช่อง',
     JSON.stringify(C.diffStats([])) === JSON.stringify({ equal: 0, inserted: 0, deleted: 0, changed: 0, total: 0 }));
}

// ───────── สลับลำดับ (LCS ต้องหาส่วนที่ตรงกันให้ได้ ไม่ใช่บอกว่าเปลี่ยนหมด) ─────────
{
  const a = 'ฉาก ก\n\nฉาก ข\n\nฉาก ค';
  const b = 'ฉาก ก\n\nฉาก ค';
  const st = C.diffStats(C.compareScripts(a, b));
  ck('★★ ลบตรงกลางแล้วส่วนที่เหลือยังถูกจับว่า "เหมือนเดิม" (LCS ทำงานจริง)',
     st.equal >= 2, JSON.stringify(st));
}

// ───────── HTML ที่แสดงผล ─────────
{
  const d = C.compareScripts('ฉาก ก', 'ฉาก ข');
  const html = C.renderComparisonHtml(d, { old: 'เก่า', new: 'ใหม่' });
  ck('สร้าง HTML ได้', typeof html === 'string' && html.length > 0);
  ck('ป้ายที่ส่งเข้าไปโผล่ใน HTML', html.includes('เก่า') && html.includes('ใหม่'));
  ck('★ ข้อความในบทถูก escape (ไม่ปล่อย HTML ของผู้ใช้ทะลุ)',
     !C.renderComparisonHtml(C.compareScripts('<script>x</script>', 'ข'), {}).includes('<script>'),
     'พบแท็กดิบใน output');
}

console.log(`\nsp-compare: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
