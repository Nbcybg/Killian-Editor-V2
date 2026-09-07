// รันด้วย: node test/nav-filter.test.mjs   (ไม่ต้อง build / ไม่ต้อง electron)
import { buildNavigation, parseProse, parseScreenplay, statusLabel } from '../src/nav.js';
import { sceneMatchesQuery, parseQuery } from '../src/sceneFilter.js';

let pass = 0;
const A = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } pass++; };

const scenes = [
  { id: 's1', title: 'เปิดเรื่อง', status: 'กำลังเขียน', tags: ['action', 'เมือง'],
    pov: 'ท็อป', emotion: 'ตื่นเต้น', synopsis: 'พระเอกตื่นมาในเมืองแปลกหน้า', flag: true,
    body: '# บทนำ\nเช้าวันหนึ่งเขาตื่นมาในห้องเช่า\n\n## ตอนเช้า\nเขาเดินออกไปหากาแฟ\n\n![รูป](a.png)' },
  { id: 's2', title: 'ฉากบู๊', status: 'เขียนเสร็จ', format: 'screenplay', tags: ['บู๊'],
    body: '.INT. โกดังร้าง - กลางคืน\n@ท็อป\nหยุดนะ!\n(กระซิบ)\nอย่าขยับ\n>CUT TO:' },
  { id: 's3', title: 'ฉากเงียบ', status: 'Outline', tags: [], body: 'ยังไม่ได้เขียน' },
];

// ---------- navigation ----------
const nav = buildNavigation(scenes, { mode: 'auto', showBeats: true });
A(nav.filter((n) => n.kind === 'scene').length === 3, '3 scene nodes');
A(nav.some((n) => n.kind === 'heading' && n.label === 'บทนำ'), 'จับหัวข้อนิยาย (#)');
A(nav.some((n) => n.kind === 'heading' && n.label === 'ตอนเช้า' && n.level === 2), 'จับหัวข้อระดับ 2');
A(nav.some((n) => n.kind === 'beat' && n.label.startsWith('เช้าวันหนึ่ง')), 'จับย่อหน้าเป็น beat');
A(!nav.some((n) => n.kind === 'beat' && n.label.includes('![')), 'บรรทัดรูปไม่กลายเป็น beat');
A(nav.some((n) => n.kind === 'sceneHeading' && n.label.startsWith('INT.')), 'จับหัวฉากบทหนัง (.INT.)');
A(nav.some((n) => n.kind === 'character' && n.label === 'ท็อป'), 'จับตัวละครบทหนัง (@)');
A(nav.some((n) => n.kind === 'transition' && n.label.startsWith('CUT')), 'จับทรานซิชัน (>)');

const s1 = nav.find((n) => n.kind === 'scene' && n.id === 's1');
A(s1.status === 'กำลังเขียน' && s1.flag === true, 'scene node พก status+flag');
A(statusLabel('Outline') === '' && statusLabel('กำลังเขียน') === 'กำลังเขียน', 'statusLabel แปลง Outline→ว่าง');

const navNoBeat = buildNavigation(scenes, { showBeats: false });
A(navNoBeat.every((n) => n.kind !== 'beat'), 'showBeats=false ตัด beat ในโหมดนิยาย');
A(navNoBeat.some((n) => n.kind === 'sceneHeading'), 'showBeats=false ยังเก็บหัวฉากบทหนัง');

// ---------- filter (ทุกฟิลด์) ----------
A(sceneMatchesQuery(scenes[0], 'เปิด'), 'ค้นจากชื่อ');
A(sceneMatchesQuery(scenes[0], 'action'), 'ค้นจากแท็ก (อิสระ)');
A(sceneMatchesQuery(scenes[0], 'แปลกหน้า'), 'ค้นจากเรื่องย่อ');
A(sceneMatchesQuery(scenes[0], 'ตื่นเต้น'), 'ค้นจากอารมณ์');
A(sceneMatchesQuery(scenes[0], 'status:กำลังเขียน'), 'ค้นสถานะเจาะจง (ไทย)');
A(!sceneMatchesQuery(scenes[0], 'status:เขียนเสร็จ'), 'สถานะไม่ตรง = ไม่ match');
A(sceneMatchesQuery(scenes[0], 'pov:ท็อป'), 'ค้นมุมมองเจาะจง');
A(sceneMatchesQuery(scenes[1], 'tag:บู๊'), 'ค้นแท็กเจาะจง');
A(sceneMatchesQuery(scenes[0], 'flag:1'), 'ค้นปักหมุด (flag:1)');
A(!sceneMatchesQuery(scenes[1], 'flag:1'), 'ฉากไม่ปักหมุด = flag:1 ไม่ match');
A(sceneMatchesQuery(scenes[0], 'ท็อป action'), 'หลายเทอม = AND');
A(!sceneMatchesQuery(scenes[0], 'zzzไม่มีจริง'), 'คำมั่ว = ไม่ match');
A(sceneMatchesQuery(scenes[0], ''), 'query ว่าง = ผ่านหมด');
A(!sceneMatchesQuery(scenes[2], 'status:กำลังเขียน'), "ฉากสถานะ 'Outline' ไม่ match สถานะจริง");
A(parseQuery('status:x #บู๊ ชื่อ').length === 3, 'parseQuery แยก 3 เทอม');

// ---------- fountain vocab (item 7) ----------
const F = await import('../src/fountain.js');
A(Array.isArray(F.PARENTHETICALS) && F.PARENTHETICALS.includes('(beat)'), 'มีคลัง parenthetical');
A(F.PARENTHETICALS.some((x) => x.includes('กระซิบ')), 'parenthetical มีภาษาไทย');
A(Array.isArray(F.CHAR_EXTENSIONS) && F.CHAR_EXTENSIONS.includes('(V.O.)'), 'มีส่วนขยายชื่อตัวละคร');
A(F.SCENE_PREFIX.includes('I/E. '), 'SCENE_PREFIX เพิ่ม I/E.');
A(F.classify('.INT. ห้อง')[0] === 'scene', 'fountain classify หัวฉากยังทำงาน');
console.log('ALL OK —', pass, 'checks');