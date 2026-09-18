// test/frontmatter.test.cjs — [alpha.156] ค่าหลายบรรทัดใน frontmatter ต้องไป-กลับได้ครบ
// บั๊ก: เรื่องย่อหลายบรรทัด → อ่านกลับได้แค่บรรทัดแรก · บรรทัด `---` ในเรื่องย่อ → คีย์ที่เหลือไหลลงเนื้อฉาก
const { parseMdFile, dumpMdFile } = require('../src/md.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const round = (meta, body = 'เนื้อฉาก') => parseMdFile(dumpMdFile(meta, body));

{
  const syn = 'บรรทัดแรก\nบรรทัดสอง\n---\nnote: แทรกคีย์';
  const r = round({ title: 'ฉาก', synopsis: syn, pov: 'มานี' });
  check('เรื่องย่อหลายบรรทัดกลับมาครบ', r.meta.synopsis === syn, JSON.stringify(r.meta.synopsis));
  check('บรรทัด --- ในเรื่องย่อไม่ตัดหัวไฟล์', r.meta.pov === 'มานี', JSON.stringify(r.meta));
  check('ไม่มีคีย์ปลอมจากเนื้อเรื่องย่อ', !('note' in r.meta));
  check('เนื้อฉากไม่ปนเมทาดาทา', r.body === 'เนื้อฉาก', JSON.stringify(r.body));
}
{
  const r = round({ synopsis: '[ร่าง] ยังไม่เสร็จ', note: '[ร่าง]', q: '"คำพูด" ของเขา', sp: '  เว้นหน้า' });
  check('ขึ้นต้น [ แต่ไม่ได้จบ ] = สตริงเดิม', r.meta.synopsis === '[ร่าง] ยังไม่เสร็จ');
  check('รูป [..] ที่เป็นสตริงไม่กลายเป็นลิสต์', r.meta.note === '[ร่าง]', JSON.stringify(r.meta.note));
  check('ขึ้นต้นด้วยเครื่องหมายคำพูดกลับมาครบ', r.meta.q === '"คำพูด" ของเขา', JSON.stringify(r.meta.q));
  check('ช่องว่างนำหน้าไม่ถูกตัด', r.meta.sp === '  เว้นหน้า', JSON.stringify(r.meta.sp));
}
{
  const f = dumpMdFile({ title: 'ท', type: 'scene', tags: ['a', 'b'] }, 'abc');
  check('ค่าธรรมดาเขียนเหมือนเดิมทุกไบต์', f === '---\ntitle: ท\ntype: scene\ntags: [a, b]\n---\nabc', JSON.stringify(f));
  const r = parseMdFile(f);
  check('ลิสต์ยังอ่านเป็นลิสต์', Array.isArray(r.meta.tags) && r.meta.tags.join('|') === 'a|b');
}
{
  // ไฟล์เก่า (เขียนมือ/v1) ที่มีเครื่องหมายคำพูดไม่ครบ JSON ต้องได้ค่าตรงตัว
  const r = parseMdFile('---\ntitle: "ครึ่ง\\ ไม่ใช่ JSON\\"\n---\nx');
  check('สตริงที่ไม่ใช่ JSON อ่านตรงตัว', typeof r.meta.title === 'string' && r.meta.title.startsWith('"'));
  const r2 = round({ tags: ['มี\nบรรทัด', 'ปกติ'] });
  check('แท็กที่มีขึ้นบรรทัดไม่ทำหัวไฟล์พัง', r2.body === 'เนื้อฉาก' && r2.meta.tags.length === 2, JSON.stringify(r2));
  const r3 = round({ synopsis: 'a\r\nb' });
  check('\\r\\n ในค่าไป-กลับได้', r3.meta.synopsis === 'a\r\nb', JSON.stringify(r3.meta.synopsis));
}

// ── [alpha.159 · M31] ไฟล์รุ่นเก่าที่เขียนค่าหลายบรรทัดดิบ ๆ ต้องอ่านได้ครบ (ไม่ตัดทิ้งตอนเปิด) ──
{
  const legacy = '---\ntitle: ฉากเก่า\nsynopsis: บรรทัดแรก\nบรรทัดสอง\nบรรทัดสาม\npov: มานี\n---\n\nเนื้อ';
  const r = parseMdFile(legacy);
  check('[159-M31] ★ ค่าหลายบรรทัดรุ่นเก่าอ่านครบทุกบรรทัด', r.meta.synopsis === 'บรรทัดแรก\nบรรทัดสอง\nบรรทัดสาม', JSON.stringify(r.meta.synopsis));
  check('[159-M31] คีย์ถัดไปไม่ปนกับบรรทัดต่อ + เนื้อไม่เปลี่ยน', r.meta.pov === 'มานี' && r.body === 'เนื้อ', JSON.stringify(r));
  const back = parseMdFile(dumpMdFile(r.meta, r.body));
  check('[159-M31] ★ บันทึกกลับแล้วอ่านซ้ำได้ครบ (เขียนแบบใหม่ที่ escape แล้ว)', back.meta.synopsis === r.meta.synopsis && back.meta.pov === 'มานี');
  check('[159-M31] ไฟล์ปกติไม่เปลี่ยนพฤติกรรม', parseMdFile('---\ntitle: ก\ntags: [a, b]\n---\nx').meta.tags.join() === 'a,b');
}

console.log(`\nfrontmatter: ${pass} ผ่าน · ${fail} ไม่ผ่าน`);
if (fail) process.exit(1);
