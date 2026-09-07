// test/wiki-profile.test.cjs — หัวการ์ดโปรไฟล์ Wiki ต้องมาจาก templates.json เท่านั้น (alpha.71 ข้อ 4)
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// จุดที่ต้องกันไม่ให้กลับไปพัง: ห้ามมีชื่อ field ('Role'/'Status') เขียนตายในโค้ด
// และรูปประจำตัวต้องใช้ได้ทุกหมวด ไม่ใช่เฉพาะ characters
const path = require('path');
const fs = require('fs');
const out = path.join(require('os').tmpdir(), '_wprof.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/wiki-profile.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const W = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? '::' + i : ''); } };

// ═══════════ entityPortrait — ทุกหมวดต้องใช้ได้เหมือนกัน ═══════════
{
  const char = { entityTypeKey: 'characters', name: 'ทอร่า', images: ['tora.png', 'x.png'] };
  const loc = { entityTypeKey: 'locations', name: 'เมืองใต้', images: [{ file: 'city.png', caption: 'ยามค่ำ', alt: 'เมือง' }] };
  const item = { entityTypeKey: 'items', name: 'ดาบ', images: [] };
  const custom = { entityTypeKey: 'องค์กรลับ', name: 'กลุ่มเงา', images: ['logo.png'] };

  check('รูปประจำตัว: ตัวละคร (images เป็น string[] แบบเก่า)', W.entityPortrait(char).file === 'tora.png');
  check('รูปประจำตัว: สถานที่ก็มีได้ (เดิมโค้ดกันไว้เฉพาะ characters)',
        W.entityPortrait(loc).file === 'city.png', JSON.stringify(W.entityPortrait(loc)));
  check('รูปประจำตัว: หมวดที่ผู้ใช้สร้างเองก็มีได้', W.entityPortrait(custom).file === 'logo.png');
  check('รูปประจำตัว: ยังไม่มีรูป → null', W.entityPortrait(item) === null);
  check('รูปประจำตัว: entity ว่าง/null ไม่พัง', W.entityPortrait(null) === null && W.entityPortrait({}) === null);
  check('รูปประจำตัว: เอา caption/alt มาด้วย',
        W.entityPortrait(loc).caption === 'ยามค่ำ' && W.entityPortrait(loc).alt === 'เมือง');
  check('รูปประจำตัว = ใบแรกเสมอ (makePrimary ย้ายใบที่เลือกมาไว้หน้าสุด)',
        W.entityPortrait({ images: ['b.png', 'a.png'] }).file === 'b.png');
}

// ═══════════ templateProfile — อ่านจาก JSON เท่านั้น ═══════════
{
  check('เทมเพลตไม่มีบล็อก profile → ว่างหมด (ไม่เดาชื่อ field)',
        JSON.stringify(W.templateProfile({})) === JSON.stringify(W.EMPTY_PROFILE),
        JSON.stringify(W.templateProfile({})));
  check('เทมเพลต null/undefined ไม่พัง',
        W.templateProfile(null).subtitleField === '' && W.templateProfile(undefined).badgeFields.length === 0);
  const t = { profile: { subtitleField: ' Role ', statusField: 'Status', badgeFields: ['Gender', '', null, 'Age'] } };
  const p = W.templateProfile(t);
  check('ตัดช่องว่างหัวท้ายของชื่อ field', p.subtitleField === 'Role');
  check('badgeFields: ทิ้งค่าว่าง/null', p.badgeFields.join() === 'Gender,Age', p.badgeFields.join());
  check('badgeFields ที่ไม่ใช่ array → ว่าง', W.templateProfile({ profile: { badgeFields: 'Gender' } }).badgeFields.length === 0);
}

// ═══════════ fieldValue — ดูทั้ง fields และ customProperties ═══════════
{
  const e = { fields: { Role: 'พระเอก', Age: 0, Empty: '' }, customProperties: { 'อาวุธ': 'ดาบสั้น' } };
  check('อ่านจาก fields', W.fieldValue(e, 'Role') === 'พระเอก');
  check('อ่านจาก customProperties ที่ผู้ใช้เพิ่มเอง', W.fieldValue(e, 'อาวุธ') === 'ดาบสั้น');
  check('ค่าเป็นเลข 0 → คืน "0" ไม่ใช่ค่าว่าง', W.fieldValue(e, 'Age') === '0');
  check('field ที่ไม่มี → ว่าง', W.fieldValue(e, 'ไม่มีจริง') === '');
  check('entity/key ว่าง ไม่พัง', W.fieldValue(null, 'Role') === '' && W.fieldValue(e, '') === '');
}

// ═══════════ profileData — ประกอบจาก entity + template + labels ═══════════
{
  const tpl = { profile: { subtitleField: 'Role', statusField: 'Status', badgeFields: ['Gender', 'Age'] } };
  const labels = { Role: 'บทบาท', Status: 'สถานะ', Gender: 'เพศ', Age: 'อายุ' };
  const e = { name: 'ทอร่า', aliases: ['เจ้าหญิงเงา', ''], images: ['t.png'],
              fields: { Role: 'พระเอก', Status: 'มีชีวิต', Gender: 'หญิง', Age: '' } };
  const d = W.profileData(e, tpl, labels);
  check('ชื่อ + ชื่ออื่น (ทิ้งค่าว่าง)', d.name === 'ทอร่า' && d.aliases.join() === 'เจ้าหญิงเงา');
  check('บรรทัดรอง มาจาก subtitleField ของเทมเพลต', d.subtitle === 'พระเอก' && d.subtitleLabel === 'บทบาท');
  check('สถานะ มาจาก statusField ของเทมเพลต', d.status === 'มีชีวิต');
  check('ป้าย: เอาเฉพาะที่มีค่า (Age ว่าง → ไม่ขึ้น)',
        d.badges.length === 1 && d.badges[0].label === 'เพศ' && d.badges[0].value === 'หญิง',
        JSON.stringify(d.badges));
  check('มีรูปประจำตัวติดมาด้วย', d.portrait.file === 't.png');

  // เทมเพลตที่ไม่ประกาศ profile → หัวการ์ดเหลือแค่รูป+ชื่อ (พิสูจน์ว่าไม่มีการเดาในโค้ด)
  const bare = W.profileData(e, {}, labels);
  check('ไม่มีบล็อก profile → ไม่โชว์บทบาท/สถานะ/ป้ายเลย',
        bare.subtitle === '' && bare.status === '' && bare.badges.length === 0);
  check('ไม่มีบล็อก profile → รูป/ชื่อยังอยู่ (เป็นของ entity ไม่ใช่เทมเพลต)',
        bare.portrait.file === 't.png' && bare.name === 'ทอร่า');

  // ผู้ใช้เปลี่ยนชื่อ field ในเทมเพลตเอง → หัวการ์ดต้องตามไปด้วย (จุดตายของโค้ดเดิม)
  const thaiTpl = { profile: { subtitleField: 'ตำแหน่ง', badgeFields: ['สังกัด'] } };
  const thaiE = { name: 'คาสซี่', fields: { 'ตำแหน่ง': 'ผู้ช่วย' }, customProperties: { 'สังกัด': 'ร้านขนม' } };
  const td = W.profileData(thaiE, thaiTpl, {});
  check('เทมเพลตตั้งชื่อ field เป็นไทยเอง หัวการ์ดก็ตามได้',
        td.subtitle === 'ผู้ช่วย' && td.badges[0].value === 'ร้านขนม', JSON.stringify(td));
  check('ไม่มี labels → ใช้คีย์เป็นป้ายชื่อ', td.subtitleLabel === 'ตำแหน่ง');

  // สถานที่/สิ่งของก็ได้หัวการ์ดเต็มรูปแบบเหมือนกัน
  const locTpl = { profile: { subtitleField: 'Type', badgeFields: ['Region'] } };
  const loc = { name: 'ท่าเรือ', images: ['p.png'], fields: { Type: 'เมืองท่า', Region: 'ใต้' } };
  const ld = W.profileData(loc, locTpl, { Type: 'ประเภท', Region: 'ภูมิภาค' });
  check('สถานที่ได้หัวการ์ดครบเหมือนตัวละคร',
        ld.portrait.file === 'p.png' && ld.subtitle === 'เมืองท่า' && ld.badges[0].value === 'ใต้');
}

// ═══════════ statusTone — คำที่ใช้เทียบมาจากเทมเพลต ═══════════
{
  const tpl = { profile: { statusField: 'Status',
    statusWords: { deceased: ['เสียชีวิต', 'dead'], unknown: ['ไม่ทราบ'], living: ['มีชีวิต'] } } };
  check('สถานะ "เสียชีวิตแล้ว" → deceased', W.statusTone(tpl, 'เสียชีวิตแล้ว') === 'deceased');
  check('สถานะภาษาอังกฤษไม่สนตัวพิมพ์', W.statusTone(tpl, 'DEAD') === 'deceased');
  check('สถานะ "มีชีวิต" → living', W.statusTone(tpl, 'มีชีวิต') === 'living');
  check('คำที่ไม่ตรงรายการ → plain', W.statusTone(tpl, 'หายสาบสูญ') === 'plain');
  check('เทมเพลตไม่ประกาศ statusWords → plain (ไม่เดาคำในโค้ด)',
        W.statusTone({ profile: {} }, 'เสียชีวิต') === 'plain');
  check('ค่าว่าง/เทมเพลต null ไม่พัง', W.statusTone(tpl, '') === 'plain' && W.statusTone(null, 'x') === 'plain');
}

// ═══════════ mergeBuiltInTemplateMeta — โปรเจกต์เก่าต้องได้บล็อก profile ═══════════
{
  const shipped = [
    { id: 'A', entityTypeKey: 'characters', name: 'ตัวละคร — ค่าเริ่มต้น', builtIn: true,
      profile: { subtitleField: 'Role', badgeFields: ['Gender'] } },
    { id: 'B', entityTypeKey: 'locations', name: 'สถานที่ — ค่าเริ่มต้น', builtIn: true,
      profile: { subtitleField: 'Type', badgeFields: [] } },
  ];
  // โปรเจกต์เก่า: ไม่มี profile เลย
  const old = [
    { id: 'A', entityTypeKey: 'characters', name: 'ตัวละคร — ค่าเริ่มต้น', builtIn: true, fields: [] },
    { id: 'B', entityTypeKey: 'locations', name: 'สถานที่ — ค่าเริ่มต้น', builtIn: true, fields: [] },
    { id: 'MINE', entityTypeKey: 'characters', name: 'ของฉัน', fields: [] },
  ];
  const r = W.mergeBuiltInTemplateMeta(old, shipped);
  check('เติม profile ให้เทมเพลต builtIn ของโปรเจกต์เก่า',
        r.changed === true && r.templates[0].profile.subtitleField === 'Role');
  check('เติมครบทุกหมวด ไม่ใช่แค่ตัวละคร', r.templates[1].profile.subtitleField === 'Type');
  check('เทมเพลตที่ผู้ใช้สร้างเอง (ไม่ builtIn) ไม่ถูกแตะ', r.templates[2].profile === undefined);
  check('ไม่แก้ array เดิม', old[0].profile === undefined);

  // รันซ้ำต้องไม่เปลี่ยนอะไร + ห้ามทับค่าที่ผู้ใช้แก้เอง
  const r2 = W.mergeBuiltInTemplateMeta(r.templates, shipped);
  check('รันซ้ำ → changed=false (ไม่เขียนไฟล์ฟรี ๆ ทุกครั้งที่เปิดโปรเจกต์)', r2.changed === false);
  const edited = [{ id: 'A', entityTypeKey: 'characters', name: 'ตัวละคร — ค่าเริ่มต้น', builtIn: true,
                    profile: { subtitleField: 'ตำแหน่งของฉัน' } }];
  const r3 = W.mergeBuiltInTemplateMeta(edited, shipped);
  check('ผู้ใช้แก้ profile เองแล้ว → ห้ามทับ',
        r3.templates[0].profile.subtitleField === 'ตำแหน่งของฉัน' && r3.changed === false);

  // id เปลี่ยน (โปรเจกต์เก่ามาก) → ถอยไปจับคู่ด้วย entityTypeKey + name
  const noId = [{ id: 'ZZZ', entityTypeKey: 'locations', name: 'สถานที่ — ค่าเริ่มต้น', builtIn: true }];
  check('id ไม่ตรง → จับคู่ด้วยหมวด+ชื่อแทน',
        W.mergeBuiltInTemplateMeta(noId, shipped).templates[0].profile.subtitleField === 'Type');
  check('ไม่มีคู่ในของที่แถมมา → ปล่อยไว้เฉย ๆ ไม่พัง',
        W.mergeBuiltInTemplateMeta([{ id: 'X', entityTypeKey: 'zzz', name: 'zz', builtIn: true }], shipped)
          .templates[0].profile === undefined);
  check('อินพุตไม่ใช่ array ไม่พัง',
        W.mergeBuiltInTemplateMeta(null, shipped).templates.length === 0 &&
        W.mergeBuiltInTemplateMeta(old, null).changed === false);
}

// ═══════════ templates.json ที่แถมมากับโปรแกรม ต้องมี profile ครบ ═══════════
{
  const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '../renderer/templates.json'), 'utf8'));
  const tpls = doc.templates || [];
  check('templates.json: ทุกเทมเพลตมีบล็อก profile', tpls.every((t) => !!t.profile),
        tpls.filter((t) => !t.profile).map((t) => t.name).join());
  check('templates.json: field ที่ profile อ้าง ต้องมีอยู่จริงในเทมเพลตนั้น',
        tpls.every((t) => {
          const have = new Set((t.fields || []).map((f) => f.key));
          const p = W.templateProfile(t);
          return (!p.subtitleField || have.has(p.subtitleField))
              && (!p.statusField || have.has(p.statusField))
              && p.badgeFields.every((k) => have.has(k));
        }),
        tpls.map((t) => t.entityTypeKey + ':' + JSON.stringify(t.profile)).join(' | '));
  check('templates.json: ตัวละครมี field สถานะจริง (ของเดิมอ่าน fields.Status ที่ไม่เคยมี)',
        tpls.filter((t) => t.entityTypeKey === 'characters')
            .every((t) => (t.fields || []).some((f) => f.key === 'Status')));
  check('templates.json: ทุกหมวดหลักมีบรรทัดรอง (subtitleField)',
        ['characters', 'locations', 'items', 'lore'].every((c) =>
          tpls.filter((t) => t.entityTypeKey === c).every((t) => W.templateProfile(t).subtitleField)));
}

console.log(`wiki-profile: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
