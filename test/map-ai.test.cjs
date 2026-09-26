// test/map-ai.test.cjs — [alpha.167 · รอบต่อ] ตำแหน่งบนแผนที่ → AI ("ใครอยู่ใกล้ใคร")
// mapDigest / whereIs (maps.js) · entityNamer (maps.js) · mapDigestText / whereText (map-text.js)
// · คำสั่ง map.where อยู่ในทะเบียนของ AI (ai-tools.js) และคำอธิบายแปลตอนอ่าน ไม่แช่ตอน import
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const build = (entry, name) => {
  const out = path.join(os.tmpdir(), name);
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src', entry)], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
  return require(out);
};
const M = build('maps.js', '_mapai_maps.cjs');
const X = build('map-text.js', '_mapai_text.cjs');
const T = build('ai/ai-tools.js', '_mapai_tools.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i === '' ? '' : ':: ' + i); } };

// โลก: สเกล x10→x20 = 100 ม. (สัดส่วนภาพ 1) · เมือง: ยังไม่ตั้งสเกล · ประตูจากโลกไปเมือง
const E = { tora: '/p/Wiki/characters/tora-abc.json', cassie: '/p/Wiki/characters/cassie-def.json', forest: '/p/Wiki/locations/forest-x1.json' };
const world = { id: 'w', name: 'โลก', order: 0, aspect: 1,
  geo: { scale: { a: { x: 10, y: 50 }, b: { x: 20, y: 50 }, meters: 100 }, ref: { x: 10, y: 50, lat: 13.75, lon: 100.5 } },
  pins: [
    { id: 'p1', kind: 'entity', entityFile: E.tora, label: '', x: 10, y: 50 },
    { id: 'p2', kind: 'entity', entityFile: E.cassie, label: '', x: 30, y: 50 },
    { id: 'p3', kind: 'note', label: 'บ่อน้ำ', x: 12, y: 50 },
    { id: 'p4', kind: 'portal', toMap: 'c', label: '', x: 80, y: 80 },
    { id: 'p5', kind: 'note', label: '', x: 5, y: 5 },                 // ไม่มีชื่อ = ไม่นับ
  ],
  zones: [{ id: 'z1', name: '', entityFile: E.forest, points: [{ x: 0, y: 40 }, { x: 40, y: 40 }, { x: 40, y: 60 }, { x: 0, y: 60 }] }] };
const city = { id: 'c', name: 'เมือง', order: 1, pins: [
  { id: 'q1', kind: 'note', label: 'ตลาด', x: 10, y: 10 },
  { id: 'q2', kind: 'note', label: 'วัง', x: 90, y: 90 },
  { id: 'q3', kind: 'note', label: 'ท่าเรือ', x: 20, y: 10 },
] };
const empty = { id: 'e', name: 'ว่าง', order: 2, pins: [] };
const maps = [world, city, empty];
const names = { [E.tora]: 'ทอร่า', [E.cassie]: 'แคสซี่', [E.forest]: 'ป่าลึก' };
const nameOf = (f) => names[f] || '';

const d = M.mapDigest(maps, { nameOf });
check('digest: แผนที่ว่างไม่ถูกนับ', d.length === 2 && d.every((m) => m.id !== 'e'), d.map((m) => m.id).join(','));
const dw = d.find((m) => m.id === 'w'), dc = d.find((m) => m.id === 'c');
check('digest: หมุดเอนทิตี้ใช้ชื่อปัจจุบันใน Wiki แม้ป้ายเก่าค้าง',
      M.mapDigest([{ id: 'r', name: 'R', pins: [{ kind: 'entity', entityFile: E.tora, label: 'ชื่อเก่า', x: 1, y: 1 }] }], { nameOf })[0].places[0].name === 'ทอร่า');
check('digest: ชื่อหมุดเอนทิตี้มาจากชื่อใน Wiki', dw.places.some((p) => p.name === 'ทอร่า') && dw.places.some((p) => p.name === 'แคสซี่'));
check('digest: ประตูใช้ชื่อแผนที่ปลายทาง', dw.places.some((p) => p.name === 'เมือง' && p.kind === 'portal'));
check('digest: หมุดไม่มีชื่อถูกข้าม', dw.places.length === 4, dw.places.length);
check('digest: เขตใช้ชื่อเอนทิตี้เจ้าของ + มีพื้นที่จริง', dw.zones[0].name === 'ป่าลึก' && Math.abs(dw.zones[0].areaM2 - 400 * 200) < 1, JSON.stringify(dw.zones));
check('digest: หมุดรู้ว่าตัวเองอยู่ในเขตไหน', dw.places.find((p) => p.name === 'ทอร่า').zone === 'ป่าลึก');
check('digest: มีละติจูด/ลองจิจูดเมื่อตั้งพิกัดครบ', !!dw.places[0].latlon && dw.geo && dw.scaled);
check('digest: แผนที่ลูกรู้แม่', dc.parent === 'โลก' && !dc.scaled && !dc.geo);
{
  const pair = dw.near.find((n) => (n.a === 'ทอร่า' && n.b === 'บ่อน้ำ') || (n.b === 'ทอร่า' && n.a === 'บ่อน้ำ'));
  check('digest: คู่ใกล้สุด ทอร่า–บ่อน้ำ = 20 ม.', pair && Math.abs(pair.meters - 20) < 1e-6, JSON.stringify(dw.near));
  check('digest: คู่ไม่ซ้ำ', new Set(dw.near.map((n) => [n.a, n.b].sort().join('|'))).size === dw.near.length);
  check('digest: เรียงใกล้ไปไกล', dw.near.every((n, i) => !i || dw.near[i - 1].rel <= n.rel));
  check('digest: ไม่มีสเกล = ระยะเป็น null แต่ยังมีค่าสัมพัทธ์', dc.near.every((n) => n.meters === null && n.rel > 0));
}

// whereIs
{
  const w = M.whereIs(maps, 'ทอร่า', { nameOf });
  check('whereIs: เจอบนแผนที่โลก', w.length === 1 && w[0].map === 'โลก' && w[0].place.name === 'ทอร่า');
  check('whereIs: รอบตัวเรียงใกล้ไปไกล + ใกล้สุด = บ่อน้ำ 20 ม.',
        w[0].around[0].name === 'บ่อน้ำ' && Math.abs(w[0].around[0].meters - 20) < 1e-6 && w[0].around[1].name === 'แคสซี่');
  check('whereIs: ไม่สนตัวพิมพ์/ช่องว่าง', M.whereIs([{ id: 'x', name: 'X', pins: [{ kind: 'note', label: 'Tavern', x: 1, y: 1 }] }], '  tavern ').length === 1);
  const z = M.whereIs(maps, 'ป่าลึก', { nameOf });
  check('whereIs: ชื่อที่เป็นเขตอย่างเดียว = คืนเขต', z.length === 1 && !z[0].place && z[0].zone.name === 'ป่าลึก');
  check('whereIs: ไม่มีชื่อนี้ = []', M.whereIs(maps, 'ไม่มีใคร', { nameOf }).length === 0 && M.whereIs(maps, '', { nameOf }).length === 0);
}

// entityNamer — ย้ายโปรเจกต์แล้วทางเต็มเปลี่ยน ยังหาชื่อเจอด้วยชื่อไฟล์
{
  const nm = M.entityNamer([{ name: 'ทอร่า', path: 'C:\\Old\\Wiki\\characters\\tora-abc.json' }]);
  check('entityNamer: ทางตรง (แบ็กสแลช ↔ สแลช)', nm('C:/Old/Wiki/characters/tora-abc.json') === 'ทอร่า');
  check('entityNamer: ย้ายโฟลเดอร์ = จับด้วยชื่อไฟล์', nm('/home/me/New/Wiki/characters/tora-abc.json') === 'ทอร่า');
  check('entityNamer: ไม่รู้จัก = ""', nm('/x/unknown.json') === '' && nm('') === '');
}

// rebaseEntityFiles — เปิดโปรเจกต์จากเครื่อง/โฟลเดอร์อื่น
{
  const data = { maps: [{ id: 'w', pins: [
    { kind: 'entity', entityFile: 'C:\\Users\\me\\Proj\\Wiki\\characters\\tora-abc.json' },
    { kind: 'entity', entityFile: '/Users/me/Proj/Wiki/characters/cassie-def.json' },
    { kind: 'entity', entityFile: '/gone/Wiki/characters/nobody-zzz.json' },
    { kind: 'note', entityFile: '/old/x/tora-abc.json' },
  ], zones: [{ entityFile: 'D:/old/Wiki/locations/forest-x1.json', points: [] }] }] };
  const ents = [{ path: '/home/p/Wiki/characters/tora-abc.json' }, { path: '/home/p/Wiki/characters/cassie-def.json' },
                { path: '/home/p/Wiki/locations/forest-x1.json' }];
  const n = M.rebaseEntityFiles(data, ents);
  const pins = data.maps[0].pins;
  check('rebase: หมุดเอนทิตี้ชี้ไฟล์ของโปรเจกต์นี้ (Windows + Mac)', n === 3 && pins[0].entityFile === ents[0].path && pins[1].entityFile === ents[1].path, n);
  check('rebase: โซนก็ถูกเปลี่ยน', data.maps[0].zones[0].entityFile === ents[2].path);
  check('rebase: ไม่รู้จัก = คงเดิม (ไม่เดา)', pins[2].entityFile === '/gone/Wiki/characters/nobody-zzz.json');
  check('rebase: หมุดที่ไม่ใช่เอนทิตี้ไม่ถูกแตะ', pins[3].entityFile === '/old/x/tora-abc.json');
  check('rebase: ทำซ้ำ = ไม่เปลี่ยนอีก (idempotent)', M.rebaseEntityFiles(data, ents) === 0);
  const dup = { maps: [{ pins: [{ kind: 'entity', entityFile: '/x/a.json' }] }] };
  check('rebase: ชื่อไฟล์ซ้ำสองที่ = ไม่เดา', M.rebaseEntityFiles(dup, [{ path: '/p/1/a.json' }, { path: '/p/2/a.json' }]) === 0);
}

// ข้อความ
{
  const txt = X.mapDigestText(d);
  check('ข้อความ: มีหัวข้อ + ชื่อแผนที่ + แม่', txt.includes('ตำแหน่งบนแผนที่') && txt.includes('"เมือง"') && txt.includes('"โลก"'), txt.slice(0, 200));
  check('ข้อความ: บอกระยะจริง + เวลาเดินเท้า', /ทอร่า — บ่อน้ำ: 20 ม\./.test(txt) || /บ่อน้ำ — ทอร่า: 20 ม\./.test(txt), txt);
  check('ข้อความ: แผนที่ไม่มีสเกลบอกว่าเป็นค่าสัมพัทธ์', txt.includes('ระยะสัมพัทธ์'));
  check('ข้อความ: เขตพร้อมพื้นที่', txt.includes('ป่าลึก (') && txt.includes('ตร.'), txt);
  check('ข้อความ: ไม่มีข้อมูล = ""', X.mapDigestText([]) === '' && X.mapDigestText(null) === '');
  const short = X.mapDigestText(d, { maxChars: 120 });
  check('ข้อความ: เพดานตัดท้ายพร้อมบอก', short.length <= 220 && short.includes('map.where'), short);
  const wt = X.whereText('ทอร่า', M.whereIs(maps, 'ทอร่า', { nameOf }));
  check('whereText: บอกแผนที่ + รายการรอบตัว', wt.includes('"ทอร่า" อยู่บนแผนที่ "โลก"') && wt.includes('บ่อน้ำ: 20 ม.'), wt);
  check('whereText: ไม่เจอ = บอกว่ายังไม่ถูกปัก', X.whereText('ใคร', []).includes('"ใคร"'));
  check('ข้อความ AI ไม่มีอักขระไอคอน (Private Use)', !/[\uE000-\uF8FF]/.test(txt + wt));
}

// ทะเบียนคำสั่งของ AI
{
  const tool = T.toolByName('map.where');
  check('ai-tools: มี map.where (อ่านอย่างเดียว · name ไม่บังคับ)', tool && tool.cap === T.CAP_READ && !tool.need.length && tool.opt.includes('name'));
  check('ai-tools: คำอธิบายแปลแล้ว (ไม่ใช่คีย์)', tool && tool.desc && !tool.desc.startsWith('ui.'), tool && tool.desc);
  check('ai-tools: ทุกคำสั่งมีคำอธิบายจริง', T.TOOLS.every((x) => typeof x.desc === 'string' && x.desc && !x.desc.startsWith('ui.')));
  check('ai-tools: โหมดอ่านอย่างเดียวเห็น map.where ใน system prompt', T.toolsSystemPrompt(T.CAP_READ).includes('map.where'));
  const dc2 = T.describeCall({ tool: 'map.where', args: { name: 'ทอร่า' } });
  check('ai-tools: describeCall มีชื่อ', dc2.includes('ทอร่า'), dc2);
  check('ai-tools: describeCall ไม่มีชื่อ = สรุปทั้งหมด', T.describeCall({ tool: 'map.where', args: {} }) !== 'map.where');
  check('ai-tools: validate ผ่านโดยไม่ต้องมี name', T.validateCall({ tool: 'map.where', args: {} }, T.CAP_READ).ok !== false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
