// test/ai-actions.test.cjs — [alpha.125 ข้อ E] ตัวลงมือทำจริงของคำสั่งที่ AI สั่ง
//
// เดิมมีเทสแค่ฝั่ง **แกะคำสั่ง** (`ai-tools.js` — parser/validator) ส่วนตัวที่ *เขียนไฟล์จริง*
// (`ai-actions.js` · 15 คำสั่ง · สร้าง/ลบเล่ม-บท-ฉาก-เอนทิตี้) ไม่มีอะไรคุมเลย
// ทั้งที่มันคือชิ้นเดียวในระบบ AI ที่ **แก้งานเขียนของผู้ใช้บนดิสก์ได้จริง**
//
// เทสนี้ยัด `kapi` ปลอมที่เป็นระบบไฟล์ในหน่วยความจำ — ทางเดินโค้ดเป็นของจริงทุกบรรทัด
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ── ระบบไฟล์ปลอม (in-memory) ────────────────────────────────────────────
const FS = new Map();          // path → เนื้อไฟล์ (string)
const DIRS = new Set();
const norm = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '');
const parentOf = (p) => norm(p).split('/').slice(0, -1).join('/');
function mkdirp(p) {
  const parts = norm(p).split('/');
  for (let i = 1; i <= parts.length; i++) DIRS.add(parts.slice(0, i).join('/'));
}
const fakeKapi = {
  join: async (...a) => {
    const bad = a.findIndex((x) => typeof x !== 'string');
    if (bad >= 0) throw new Error('kapi.join: arg ' + bad + ' ไม่ใช่ข้อความ');
    return norm(a.join('/'));
  },
  exists: async (p) => FS.has(norm(p)) || DIRS.has(norm(p)),
  isDir: async (p) => DIRS.has(norm(p)),
  mkdir: async (p) => { mkdirp(p); return true; },
  readFile: async (p) => {
    if (!FS.has(norm(p))) throw new Error('ENOENT ' + p);
    return FS.get(norm(p));
  },
  writeFile: async (p, c) => { mkdirp(parentOf(p)); FS.set(norm(p), String(c)); return true; },
  readJson: async (p) => JSON.parse(await fakeKapi.readFile(p)),
  remove: async (p) => {
    const q = norm(p);
    FS.delete(q); DIRS.delete(q);
    for (const k of [...FS.keys()]) if (k.startsWith(q + '/')) FS.delete(k);
    for (const k of [...DIRS]) if (k.startsWith(q + '/')) DIRS.delete(k);
    return true;
  },
  move: async (a, b) => {
    const src = norm(a);
    if (FS.has(src)) { await fakeKapi.writeFile(b, FS.get(src)); FS.delete(src); return true; }
    for (const k of [...FS.keys()]) if (k.startsWith(src + '/'))
      { await fakeKapi.writeFile(norm(b) + k.slice(src.length), FS.get(k)); FS.delete(k); }
    DIRS.delete(src); mkdirp(b);
    return true;
  },
  listDirs: async (p) => {
    const q = norm(p) + '/';
    const out = new Set();
    for (const k of [...DIRS, ...FS.keys()]) {
      if (!k.startsWith(q)) continue;
      const rest = k.slice(q.length);
      if (!rest.includes('/')) { if (DIRS.has(k)) out.add(rest); }
      else out.add(rest.split('/')[0]);
    }
    return [...out].filter((n) => DIRS.has(q + n)).sort();
  },
  listFiles: async (p, ext = '') => {
    const q = norm(p) + '/';
    const out = [];
    for (const k of FS.keys()) {
      if (!k.startsWith(q)) continue;
      const rest = k.slice(q.length);
      if (rest.includes('/')) continue;
      if (ext && !rest.toLowerCase().endsWith(ext.toLowerCase())) continue;
      out.push(rest);
    }
    return out.sort();
  },
  mtime: async () => Date.now(),
};
globalThis.kapi = Object.assign(globalThis.kapi || {}, fakeKapi);

// core.js แตะ DOM ตอน import — ของปลอมเท่าที่พอให้ผ่าน (ตัว ai-actions เองไม่แตะ DOM เลย)
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {}, append() {}, remove() {}, setAttribute() {}, addEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], firstChild: null, dataset: {}, children: [] });
globalThis.document = { createElement: stubEl, createTextNode: () => ({}), body: stubEl(),
  documentElement: stubEl(), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
globalThis.window = { addEventListener() {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  requestAnimationFrame: (f) => setTimeout(f, 0), matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.localStorage = globalThis.window.localStorage;
Object.defineProperty(globalThis, 'navigator', { value: { platform: 'Win32' }, configurable: true, writable: true });

// ai-actions กับ core ต้องใช้ `state` **ก้อนเดียวกัน** → บันเดิลรวมทีเดียวผ่านไฟล์ทางเข้าชั่วคราว
const entry = path.join(os.tmpdir(), '_aiact-entry.mjs');
const src = path.join(__dirname, '..', 'src').replace(/\\/g, '/');
fs.writeFileSync(entry, `export * from '${src}/ai/ai-actions.js';\nexport { state } from '${src}/core.js';\n` + `export { setTabBridge, pathKey } from '${src}/tab-bridge.js';\n`
  + `export { copyDraftContents } from '${src}/drafts.js';\n`);   // [alpha.160 · P0-5]
const out = path.join(os.tmpdir(), '_aiactions.cjs');
require('esbuild').buildSync({ entryPoints: [entry], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const A = require(out);

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };
const run = (tool, args) => A.runToolCall({ tool, args });

// ── โปรเจกต์ทดสอบ ──────────────────────────────────────────────────────
const ROOT = '/mem/proj';
function seed() {
  FS.clear(); DIRS.clear();
  mkdirp(ROOT);
  mkdirp(ROOT + '/เล่ม 1/Draft/default/Chapters');
  FS.set(ROOT + '/เล่ม 1/section.json', JSON.stringify({ title: 'เล่ม 1', order: 1 }));
  FS.set(ROOT + '/เล่ม 1/Draft/default/draft.json', JSON.stringify({ chapters: [] }));
  FS.set(ROOT + '/เล่ม 1/Draft/default/scenes.json', JSON.stringify({ chapters: {} }));
  A.state.root = ROOT;
  A.state.meta = { title: 'เรื่องทดสอบ' };
}
seed();

(async () => {
  // ───────── ด่านกันพลาดพื้นฐาน ─────────
  {
    const r = await run('ไม่มีคำสั่งนี้', {});
    ck('คำสั่งที่ไม่รู้จัก = ไม่สำเร็จ และมีข้อความบอก', r.ok === false && !!r.error);
    const keep = A.state.root;
    A.state.root = '';
    const r2 = await run('project.tree', {});
    ck('★ ไม่มีโปรเจกต์เปิดอยู่ = ปฏิเสธทุกคำสั่ง (ห้ามเขียนไฟล์ลอย ๆ)', r2.ok === false);
    A.state.root = keep;
  }

  // ───────── บท ─────────
  {
    const r = await run('chapter.create', { title: 'บทที่ 1' });
    ck('สร้างบทได้', r.ok === true, r.error);
    const d = JSON.parse(FS.get(ROOT + '/เล่ม 1/Draft/default/draft.json'));
    ck('บทถูกเขียนลง draft.json จริง', (d.chapters || []).some((c) => c.title === 'บทที่ 1'),
       JSON.stringify(d));
    ck('★ บทมี guid (ทะเบียนฉากอ้างด้วยคีย์นี้)', !!(d.chapters[0] || {}).guid);
    const folders = await fakeKapi.listDirs(ROOT + '/เล่ม 1/Draft/default/Chapters');
    ck('สร้างโฟลเดอร์ของบทบนดิสก์ด้วย', folders.length === 1, JSON.stringify(folders));

    const rn = await run('chapter.rename', { title: 'บทที่ 1', newTitle: 'บทเปิดเรื่อง' });
    ck('เปลี่ยนชื่อบทได้', rn.ok === true, rn.error);
    const d2 = JSON.parse(FS.get(ROOT + '/เล่ม 1/Draft/default/draft.json'));
    ck('ชื่อใหม่ลง draft.json', d2.chapters[0].title === 'บทเปิดเรื่อง', JSON.stringify(d2.chapters[0]));
    ck('★ guid ต้องไม่เปลี่ยนตอนเปลี่ยนชื่อ (ไม่งั้นฉากทั้งบทกำพร้า)',
       d2.chapters[0].guid === d.chapters[0].guid);
  }

  // ───────── ฉาก ─────────
  {
    const r = await run('scene.create', { chapter: 'บทเปิดเรื่อง', title: 'ฉากแรก', text: 'ฝนตก' });
    ck('สร้างฉากได้', r.ok === true, r.error);
    const sj = JSON.parse(FS.get(ROOT + '/เล่ม 1/Draft/default/scenes.json'));
    const rows = Object.values(sj.chapters || {}).flat();
    ck('ฉากถูกลงทะเบียนใน scenes.json', rows.length === 1 && rows[0].title === 'ฉากแรก',
       JSON.stringify(sj));
    const mdPath = [...FS.keys()].find((k) => k.endsWith('.md'));
    ck('เขียนไฟล์ .md จริง', !!mdPath, [...FS.keys()].join('\n'));
    ck('★ ไฟล์ .md มี front-matter (v1 อ่านได้)', FS.get(mdPath).startsWith('---'),
       JSON.stringify(String(FS.get(mdPath)).slice(0, 60)));
    ck('เนื้อฉากอยู่ในไฟล์', FS.get(mdPath).includes('ฝนตก'));

    const rd = await run('scene.read', { title: 'ฉากแรก' });
    ck('อ่านฉากกลับมาได้', rd.ok === true && rd.data && rd.data.text.includes('ฝนตก'),
       JSON.stringify(rd).slice(0, 160));

    const wr = await run('scene.write', { title: 'ฉากแรก', text: 'ฟ้าเปิดแล้ว' });
    ck('เขียนทับเนื้อฉากได้', wr.ok === true, wr.error);
    ck('เนื้อใหม่ลงไฟล์จริง', FS.get(mdPath).includes('ฟ้าเปิดแล้ว'));
    ck('★ เขียนทับแล้ว front-matter ยังอยู่', FS.get(mdPath).startsWith('---'));

    const bad = await run('scene.read', { title: 'ฉากที่ไม่มีอยู่จริง' });
    ck('อ่านฉากที่ไม่มี = ไม่สำเร็จ ไม่ใช่ throw', bad.ok === false && !!bad.error);
  }

  // ───────── เอนทิตี้ ─────────
  {
    const r = await run('entity.create', { name: 'ทอร่า', cat: 'characters', description: 'คนทำขนม' });
    ck('สร้างเอนทิตี้ได้', r.ok === true, r.error);
    const ef = [...FS.keys()].find((k) => k.includes('/Wiki/characters/'));
    ck('เขียนไฟล์ลง Wiki/<หมวด>/', !!ef, [...FS.keys()].filter((k) => k.includes('Wiki')).join(','));
    const ent = JSON.parse(FS.get(ef));
    ck('เนื้อเป็น JSON ที่อ่านกลับได้', ent.name === 'ทอร่า');
    ck('★ โครงเอนทิตี้ครบตามรูปแบบของโปรแกรม (v1 เปิดได้)',
       !!ent.id && Array.isArray(ent.sections) && Array.isArray(ent.relationships)
       && ent.entityTypeKey === 'characters', JSON.stringify(Object.keys(ent)));
    ck('คำบรรยายลงเป็นหัวข้อแรก', String(ent.sections[0].content) === 'คนทำขนม',
       JSON.stringify(ent.sections));

    // `entity.update` รับ description/sections/fields/aliases/newName (ไม่ใช่ `summary`)
    const up = await run('entity.update', { name: 'ทอร่า', description: 'คนทำขนมที่กลัวความมืด' });
    ck('แก้เอนทิตี้ได้', up.ok === true, up.error);
    ck('ค่าที่แก้ลงไฟล์', String(FS.get(ef)).includes('กลัวความมืด'));
    ck('★ แก้แล้วหัวข้อไม่งอกซ้ำ (ทับหัวข้อชื่อเดียวกัน)',
       JSON.parse(FS.get(ef)).sections.length === 1, JSON.stringify(JSON.parse(FS.get(ef)).sections));
    const upMiss = await run('entity.update', { name: 'ไม่มีคนนี้', description: 'x' });
    ck('แก้เอนทิตี้ที่ไม่มี = ไม่สำเร็จ ไม่ใช่สร้างใหม่เงียบ ๆ', upMiss.ok === false);

    const rd = await run('entity.read', { name: 'ทอร่า' });
    ck('อ่านเอนทิตี้กลับมาได้', rd.ok === true && rd.data && rd.data.name === 'ทอร่า');
    const miss = await run('entity.read', { name: 'ไม่มีคนนี้' });
    ck('อ่านเอนทิตี้ที่ไม่มี = ไม่สำเร็จ', miss.ok === false);
  }

  // ───────── โครงสร้างทั้งโปรเจกต์ ─────────
  {
    const r = await run('project.tree', {});
    ck('อ่านโครงสร้างได้', r.ok === true, r.error);
    ck('เห็นเล่ม/บท/ฉากครบ',
       r.data.books[0].book === 'เล่ม 1'
       && r.data.books[0].chapters[0].chapter === 'บทเปิดเรื่อง'
       && r.data.books[0].chapters[0].scenes.includes('ฉากแรก'),
       JSON.stringify(r.data.books));
    ck('เห็นเอนทิตี้ด้วย', (r.data.entities || []).some((e) => e.name === 'ทอร่า'),
       JSON.stringify(r.data.entities));
  }

  // ───────── touchesProject: ตัดสินว่าต้องรีเฟรช UI ไหม ─────────
  {
    ck('อ่านอย่างเดียว = ไม่ต้องรีเฟรช',
       A.touchesProject([{ tool: 'project.tree', ok: true }, { tool: 'scene.read', ok: true },
                         { tool: 'entity.read', ok: true }]) === false);
    ck('★ มีคำสั่งที่เขียนไฟล์ = ต้องรีเฟรช',
       A.touchesProject([{ tool: 'scene.read', ok: true }, { tool: 'scene.write', ok: true }]) === true);
    ck('คำสั่งที่ล้มเหลวไม่นับว่าแตะไฟล์',
       A.touchesProject([{ tool: 'scene.write', ok: false }]) === false);
    ck('รายการว่าง/undefined ไม่พัง',
       A.touchesProject([]) === false && A.touchesProject() === false);
  }

  // ───────── [alpha.149] กันพลาด: หมวดเอนทิตี้ · ชื่อไฟล์ฉากชน · แท็บที่เปิดอยู่ ─────────
  {
    ck('[149] safeCat ปฏิเสธ ../', A.safeCat('../../evil') === '' && A.safeCat('..') === '');
    ck('[149] safeCat ปฏิเสธสแลช', A.safeCat('a/b') === '' && A.safeCat('a\\b') === '');
    ck('[149] safeCat ว่าง = characters · ชื่อไทยผ่าน', A.safeCat('') === 'characters' && A.safeCat('ตัวละครรอง') === 'ตัวละครรอง');
    const nBefore = FS.size;
    const bad = await run('entity.create', { name: 'ผี', cat: '../../../outside' });
    ck('[149] ★ entity.create หมวด ../ ถูกปฏิเสธ ไม่มีไฟล์หลุดออกนอกโปรเจกต์',
       bad.ok === false && FS.size === nBefore && ![...FS.keys()].some((k) => !k.startsWith(ROOT)),
       JSON.stringify(bad) + ' ' + [...FS.keys()].filter((k) => !k.startsWith(ROOT)).join(','));

    // scene.create: ไฟล์ scene-NN.md ที่มีอยู่แล้วแต่ไม่อยู่ใน scenes.json ห้ามถูกทับ
    const sj = JSON.parse(FS.get(ROOT + '/เล่ม 1/Draft/default/scenes.json'));
    const all = Object.values(sj.chapters || {}).flat();
    const nextOrder = Math.max(0, ...all.map((s) => s.order || 0)) + 1;
    const first = [...FS.keys()].find((k) => k.endsWith('.md') && !k.includes('/Recycle/'));
    const chDir = first.split('/').slice(0, -1).join('/');
    const orphan = chDir + '/scene-' + String(nextOrder).padStart(2, '0') + '.md';
    FS.set(orphan, 'ของเดิมที่ห้ามหาย');
    const cr = await run('scene.create', { chapter: 'บทเปิดเรื่อง', title: 'ฉากชนชื่อไฟล์', text: 'ใหม่' });
    ck('[149] สร้างฉากได้แม้ชื่อไฟล์ชน', cr.ok === true, cr.error);
    ck('[149] ★ ไฟล์เดิมที่ชื่อชนไม่ถูกเขียนทับ', FS.get(orphan) === 'ของเดิมที่ห้ามหาย', FS.get(orphan));
    const sj2 = JSON.parse(FS.get(ROOT + '/เล่ม 1/Draft/default/scenes.json'));
    const made = Object.values(sj2.chapters || {}).flat().find((s) => s.title === 'ฉากชนชื่อไฟล์');
    ck('[149] ฉากใหม่ได้ชื่อไฟล์ที่ไม่ซ้ำ และไฟล์มีอยู่จริง',
       !!made && made.fileName !== orphan.split('/').pop() && FS.has(chDir + '/' + made.fileName), made && made.fileName);
    await run('scene.delete', { title: 'ฉากชนชื่อไฟล์' });
    FS.delete(orphan);
    for (const k of [...FS.keys()]) if (k.includes('/Recycle/')) FS.delete(k);   // เทสลบข้างล่างนับไฟล์ .md ทั้งหมด

    // แท็บที่เปิดอยู่: ค้างการแก้ = ลงแท็บอย่างเดียว · ไม่ค้าง = เขียนดิสก์แล้วโหลดแท็บใหม่
    const scPath = [...FS.keys()].find((k) => k.endsWith('.md') && !k.includes('/Recycle/'));
    const log = [];
    const fake = { kind: 'prose', dirty: true, text: 'เนื้อในแท็บที่ยังไม่บันทึก',
      getText() { return this.text; },
      setText(b, o) { log.push(['set', o && o.keepAlign]); this.text = b; },
      async reloadFromDisk() { log.push(['reload']); },
      rename(t) { log.push(['rename', t]); }, close() { log.push(['close']); } };
    A.setTabBridge({ find: (p) => (A.pathKey(p) === A.pathKey(scPath) ? fake : null), closeUnder: () => 0 });
    const diskBefore = FS.get(scPath);
    const rd = await run('scene.read', { title: 'ฉากแรก' });
    ck('[149] ★ scene.read เห็นเนื้อในแท็บ (รวมที่ยังไม่บันทึก)', rd.ok && JSON.stringify(rd).includes('เนื้อในแท็บที่ยังไม่บันทึก'),
       JSON.stringify(rd).slice(0, 200));
    const w1 = await run('scene.write', { title: 'ฉากแรก', text: 'AI เขียนต่อ' });
    ck('[149] ★ แท็บค้างการแก้ → เขียนลงแท็บ ไม่แตะไฟล์', w1.ok && FS.get(scPath) === diskBefore
       && fake.text === 'เนื้อในแท็บที่ยังไม่บันทึก\n\nAI เขียนต่อ' && log.some((x) => x[0] === 'set' && x[1] === true),
       JSON.stringify(log) + ' ' + fake.text);
    fake.dirty = false; log.length = 0;
    const w2 = await run('scene.write', { title: 'ฉากแรก', text: 'รอบสอง' });
    ck('[149] ★ แท็บไม่ค้าง → เขียนดิสก์ แล้วสั่งแท็บโหลดใหม่', w2.ok && FS.get(scPath).includes('รอบสอง')
       && log.some((x) => x[0] === 'reload'), JSON.stringify(log));
    log.length = 0;
    const rn = await run('scene.rename', { title: 'ฉากแรก', newTitle: 'ฉากแรก' });
    ck('[149] scene.rename บอกแท็บให้เปลี่ยนชื่อด้วย', rn.ok && log.some((x) => x[0] === 'rename'), JSON.stringify(log));
    A.setTabBridge(null);
  }

  // ───────── [alpha.159] H5/H8/M3/M4 ─────────
  {
    // H8: ชื่อจากโมเดลที่เป็น "." ล้วน ห้ามพาไฟล์ออกนอกโปรเจกต์
    ck('[159-H8] safeName("..") ไม่ใช่ ".."', A.safeName('..') === 'untitled' && A.safeName('.') === 'untitled'
       && A.safeName('...') === 'untitled' && A.safeName('../x') === '..x' && A.safeName('เล่มใหม่') === 'เล่มใหม่');
    const nOut = () => [...FS.keys()].filter((k) => !k.startsWith(ROOT + '/')).length;
    const o0 = nOut();
    const bc = await run('book.create', { title: '..' });
    ck('[159-H8] ★ book.create ชื่อ ".." เขียนอยู่ใต้โปรเจกต์เท่านั้น', nOut() === o0 &&
       ![...FS.keys()].some((k) => k === '/mem/section.json'), JSON.stringify(bc) + ' ' + [...FS.keys()].filter((k) => !k.startsWith(ROOT + '/')).join(','));
    await run('book.delete', { title: '..' });
    const cc = await run('chapter.create', { title: '..' });
    ck('[159-H8] chapter.create ชื่อ ".." → โฟลเดอร์อยู่ใต้ Chapters', cc.ok && nOut() === o0, JSON.stringify(cc));
    await run('chapter.delete', { title: '..' });

    // M3: ชื่อไฟล์ฉากใหม่ต้องไม่ชน "ชื่อที่แถวอื่นจองไว้" (แถวที่ไฟล์หายไปแล้ว)
    const sfP = ROOT + '/เล่ม 1/Draft/default/scenes.json';
    const sjA = JSON.parse(FS.get(sfP));
    const chG = Object.keys(sjA.chapters)[0];
    const rowsA = sjA.chapters[chG];
    const nextO = Math.max(0, ...rowsA.map((s) => s.order || 0)) + 1;
    const reserved = 'scene-' + String(nextO).padStart(2, '0') + '.md';
    rowsA.push({ id: 'ghost', title: 'แถวผีจองชื่อ', order: 0, fileName: reserved });
    FS.set(sfP, JSON.stringify(sjA));
    const c3 = await run('scene.create', { chapter: 'บทเปิดเรื่อง', title: 'ฉาก M3', text: 'x' });
    const made3 = Object.values(JSON.parse(FS.get(sfP)).chapters).flat().find((s) => s.title === 'ฉาก M3');
    ck('[159-M3] ★ scene.create ใช้ freeSceneFileName — ไม่เอาชื่อที่แถวอื่นจองไว้',
       c3.ok && made3 && made3.fileName !== reserved, made3 && made3.fileName);
    const sjB = JSON.parse(FS.get(sfP));
    sjB.chapters[chG] = sjB.chapters[chG].filter((s) => s.id !== 'ghost');
    FS.set(sfP, JSON.stringify(sjB));

    // M4: scene.write / scene.rename ต้องพาเธรดคอมเมนต์ท้ายไฟล์ไปด้วย
    const scP = [...FS.keys()].find((k) => k.endsWith('/' + made3.fileName));
    FS.set(scP, FS.get(scP).replace(/\s*$/, '') + '\n\n<!-- k2-comments\n[{"id":"c1","text":"โน้ตของบรรณาธิการ","anchor":null}]\n-->\n');
    const w4 = await run('scene.write', { title: 'ฉาก M3', text: 'AI ต่อท้าย' });
    ck('[159-M4] ★ scene.write ไม่ลบบล็อก k2-comments', w4.ok && FS.get(scP).includes('k2-comments')
       && FS.get(scP).includes('โน้ตของบรรณาธิการ') && FS.get(scP).includes('AI ต่อท้าย'), FS.get(scP).slice(-200));
    ck('[159-M4] ข้อความใหม่อยู่ "ก่อน" บล็อกคอมเมนต์ (บล็อกต้องอยู่ท้ายไฟล์เสมอ)',
       FS.get(scP).indexOf('AI ต่อท้าย') < FS.get(scP).indexOf('k2-comments'));
    const r4 = await run('scene.rename', { title: 'ฉาก M3', newTitle: 'ฉาก M3b' });
    ck('[159-M4] ★ scene.rename ไม่ลบบล็อก k2-comments', r4.ok && FS.get(scP).includes('โน้ตของบรรณาธิการ')
       && /title: ฉาก M3b/.test(FS.get(scP)), FS.get(scP).slice(0, 120));

    // H5: ลบฉากที่เปิดค้างอยู่ → ต้อง "บันทึกก่อนปิด" ผ่าน bridge.closeUnder แล้ว **รอ** ให้เสร็จก่อนย้าย
    const order = [];
    let open = true;
    const fake5 = { kind: 'prose', dirty: true, getText: () => 'x', setText() {}, async reloadFromDisk() {}, rename() {}, close() { order.push('close-discard'); } };
    A.setTabBridge({
      find: (p) => (open && A.pathKey(p) === A.pathKey(scP) ? fake5 : null),
      closeUnder: async (p) => {
        await new Promise((r) => setTimeout(r, 20));
        FS.set(scP, FS.get(scP).replace('AI ต่อท้าย', 'งานที่พิมพ์ค้างไว้'));   // จำลอง saveTab
        order.push('save+close:' + (A.pathKey(p) === A.pathKey(scP)));
        open = false; return 1;
      },
    });
    const d5 = await run('scene.delete', { title: 'ฉาก M3b' });
    const trashed = [...FS.keys()].find((k) => k.includes('/Recycle/') && k.endsWith(made3.fileName));
    ck('[159-H5] ★ scene.delete ปิดแท็บผ่าน closeUnder (บันทึกก่อน) ไม่ใช่ close() แบบทิ้ง',
       d5.ok && order[0] === 'save+close:true' && !order.includes('close-discard'), JSON.stringify(order));
    ck('[159-H5] ★ ของในถังขยะคือฉบับที่บันทึกล่าสุด (รอ closeUnder เสร็จก่อนย้าย)',
       !!trashed && FS.get(trashed).includes('งานที่พิมพ์ค้างไว้'), trashed);
    // บันทึกไม่ผ่าน (แท็บยังเปิดอยู่หลัง closeUnder) = ไม่ลบ
    const c5 = await run('scene.create', { chapter: 'บทเปิดเรื่อง', title: 'ฉาก H5b', text: 'y' });
    const p5 = [...FS.keys()].find((k) => !k.includes('/Recycle/') && k.endsWith('.md') && FS.get(k).includes('title: ฉาก H5b'));
    A.setTabBridge({ find: (p) => (A.pathKey(p) === A.pathKey(p5) ? fake5 : null), closeUnder: async () => 0 });
    const d5b = await run('scene.delete', { title: 'ฉาก H5b' });
    ck('[159-H5] บันทึกไม่ผ่าน → ไม่ลบฉาก (ไฟล์ยังอยู่ แถวยังอยู่)', c5.ok && d5b.ok === false && FS.has(p5)
       && Object.values(JSON.parse(FS.get(sfP)).chapters).flat().some((s) => s.title === 'ฉาก H5b'), JSON.stringify(d5b));
    A.setTabBridge(null);
    await run('scene.delete', { title: 'ฉาก H5b' });
    for (const k of [...FS.keys()]) if (k.includes('/Recycle/')) FS.delete(k);
  }

  // ───────── ลบ (ต้องลงถังขยะ ไม่ใช่หายถาวร) ─────────
  {
    const before = [...FS.keys()].filter((k) => k.endsWith('.md')).length;
    const r = await run('scene.delete', { title: 'ฉากแรก' });
    ck('ลบฉากได้', r.ok === true, r.error);
    const sj = JSON.parse(FS.get(ROOT + '/เล่ม 1/Draft/default/scenes.json'));
    ck('ฉากถูกถอดออกจากทะเบียน', Object.values(sj.chapters || {}).flat().length === 0);
    const inTrash = [...FS.keys()].some((k) => k.includes('/Recycle/'));
    ck('★ ไฟล์ไปอยู่ถังขยะ ไม่ใช่ลบถาวร', inTrash, [...FS.keys()].join('\n'));
    ck('ไฟล์ไม่ได้อยู่ที่เดิมแล้ว',
       [...FS.keys()].filter((k) => k.endsWith('.md') && !k.includes('/Recycle/')).length === before - 1);
  }

  // ───────── [alpha.160 · P0-4] ฉากชื่อซ้ำสองเล่ม — ระบุเล่ม/บทที่หาไม่เจอ ต้องไม่ตกไปฉากอื่น ─────────
  {
    seed();
    await run('chapter.create', { title: 'บท A' });
    await run('book.create', { title: 'เล่ม 2' });
    await run('chapter.create', { book: 'เล่ม 2', title: 'บท B' });
    const c1 = await run('scene.create', { chapter: 'บท A', title: 'ฉากซ้ำ', text: 'เนื้อเล่มหนึ่ง' });
    const c2 = await run('scene.create', { book: 'เล่ม 2', chapter: 'บท B', title: 'ฉากซ้ำ', text: 'เนื้อเล่มสอง' });
    ck('[P0-4] สร้างฉากชื่อซ้ำได้ทั้งสองเล่ม', c1.ok && c2.ok, (c1.error || '') + (c2.error || ''));
    const mdOf = (needle) => [...FS.keys()].find((k) => k.endsWith('.md') && !k.includes('/Recycle/') && FS.get(k).includes(needle));
    const f1 = mdOf('เนื้อเล่มหนึ่ง'), f2 = mdOf('เนื้อเล่มสอง');
    ck('[P0-4] ไฟล์ของสองเล่มแยกกัน', !!f1 && !!f2 && f1 !== f2 && f2.includes('เล่ม 2'), f1 + ' | ' + f2);

    const wBad = await run('scene.write', { title: 'ฉากซ้ำ', book: 'ไม่มีเล่มนี้', text: 'ห้ามลงไฟล์ไหนเลย' });
    ck('[P0-4] ★ ระบุเล่มที่ไม่มี = error ไม่ใช่เขียนลงฉากชื่อเดียวกันในเล่มอื่น',
       wBad.ok === false && !FS.get(f1).includes('ห้ามลง') && !FS.get(f2).includes('ห้ามลง'), JSON.stringify(wBad));
    const wBadCh = await run('scene.write', { title: 'ฉากซ้ำ', chapter: 'ไม่มีบทนี้', text: 'ห้ามลงไฟล์ไหนเลย' });
    ck('[P0-4] ★ ระบุบทที่ไม่มี = error', wBadCh.ok === false && !FS.get(f1).includes('ห้ามลง') && !FS.get(f2).includes('ห้ามลง'));
    const wBadCh2 = await run('scene.write', { title: 'ฉากซ้ำ', book: 'เล่ม 2', chapter: 'บท A', text: 'ห้ามลงไฟล์ไหนเลย' });
    ck('[P0-4] บทมีจริงแต่อยู่คนละเล่ม = error', wBadCh2.ok === false && !FS.get(f1).includes('ห้ามลง'));

    const w2 = await run('scene.write', { title: 'ฉากซ้ำ', book: 'เล่ม 2', text: 'แก้เล่มสอง' });
    ck('[P0-4] ระบุเล่ม 2 → เขียนลงเล่ม 2 เท่านั้น',
       w2.ok && FS.get(f2).includes('แก้เล่มสอง') && FS.get(f1).includes('เนื้อเล่มหนึ่ง'), w2.error);
    const wA = await run('scene.write', { title: 'ฉากซ้ำ', chapter: 'บท A', text: 'แก้บทเอ' });
    ck('[P0-4] ระบุแค่บท (ไม่ระบุเล่ม) → หาบทนั้นทุกเล่ม และได้ฉากของบทนั้น',
       wA.ok && FS.get(f1).includes('แก้บทเอ') && !FS.get(f2).includes('แก้บทเอ'), wA.error);
    const wB = await run('scene.write', { title: 'ฉากซ้ำ', chapter: 'บท B', text: 'แก้บทบี' });
    ck('[P0-4] ระบุบทของเล่ม 2 โดยไม่ระบุเล่ม → ได้ฉากของเล่ม 2 (เดิมยึดเล่มแรกเสมอ)',
       wB.ok && FS.get(f2).includes('แก้บทบี') && !FS.get(f1).includes('แก้บทบี'), wB.error);

    // ───────── [alpha.160 · P0-3] AI ลบเล่ม/บท/เอนทิตี้ — มีแท็บที่บันทึกไม่ผ่าน = ไม่ลบ ─────────
    const stuck = { kind: 'prose', dirty: true, getText: () => 'x', setText() {}, async reloadFromDisk() {}, rename() {}, close() {} };
    A.setTabBridge({ find: (p) => (A.pathKey(p).includes('เล่ม 2') ? stuck : null),
                     closeUnder: async () => ({ closed: 0, skipped: 1, ok: false }) });
    const dCh = await run('chapter.delete', { book: 'เล่ม 2', title: 'บท B' });
    ck('[P0-3] ★ chapter.delete: แท็บบันทึกไม่ผ่าน → ไม่ลบบท (ไฟล์ยังอยู่)', dCh.ok === false && FS.has(f2), JSON.stringify(dCh));
    const dBk = await run('book.delete', { title: 'เล่ม 2' });
    ck('[P0-3] ★ book.delete: แท็บบันทึกไม่ผ่าน → ไม่ลบเล่ม', dBk.ok === false && FS.has(f2)
       && ![...FS.keys()].some((k) => k.includes('/Recycle/')), JSON.stringify(dBk));
    await run('entity.create', { name: 'แคสซี่', cat: 'characters', description: 'x' });
    const ef = [...FS.keys()].find((k) => k.includes('/Wiki/characters/'));
    A.setTabBridge({ find: (p) => (A.pathKey(p) === A.pathKey(ef) ? stuck : null),
                     closeUnder: async () => ({ closed: 0, skipped: 1, ok: false }) });
    const dEn = await run('entity.delete', { name: 'แคสซี่' });
    ck('[P0-3] ★ entity.delete: แท็บบันทึกไม่ผ่าน → ไม่ลบ', dEn.ok === false && FS.has(ef), JSON.stringify(dEn));
    // bridge รุ่นเก่าคืนตัวเลข + แท็บปิดแล้ว = ลบได้ตามปกติ
    A.setTabBridge({ find: () => null, closeUnder: async () => 1 });
    const dOk = await run('chapter.delete', { book: 'เล่ม 2', title: 'บท B' });
    ck('[P0-3] ปิดแท็บได้ครบ → ลบบทได้ตามปกติ', dOk.ok === true && !FS.has(f2), JSON.stringify(dOk));
    A.setTabBridge(null);
  }

  // ───────── [alpha.160 · P0-5] คัดลอกร่าง → guid/id ใหม่ทั้งชุด + ไฟล์คู่ข้างฉากตามไปด้วย ─────────
  {
    seed();
    const D = ROOT + '/เล่ม 1/Draft/default';
    FS.set(D + '/draft.json', JSON.stringify({ chapters: [{ guid: 'chA', title: 'บทหนึ่ง', order: 1, folderName: '01 - บทหนึ่ง' }] }));
    FS.set(D + '/scenes.json', JSON.stringify({ chapters: { chA: [
      { id: 's1', title: 'ฉาก 1', order: 1, fileName: 'scene-1.md', chapterGuid: 'chA', choices: [{ text: 'ไป', nextSceneId: 's2' }] },
      { id: 's2', title: 'ฉาก 2', order: 2, fileName: 'scene-2.md', chapterGuid: 'chA' }] } }));
    await fakeKapi.writeFile(D + '/Chapters/01 - บทหนึ่ง/scene-1.md', '---\ntitle: ฉาก 1\n---\nหนึ่ง');
    await fakeKapi.writeFile(D + '/Chapters/01 - บทหนึ่ง/scene-2.md', '---\ntitle: ฉาก 2\n---\nสอง');
    await fakeKapi.writeFile(D + '/Chapters/01 - บทหนึ่ง/scene-1_vis.csv', 'shot,desc\n1,กว้าง');
    let n = 0;
    await A.copyDraftContents(D, ROOT + '/เล่ม 1/Draft/สำเนา', () => 'new' + (++n));
    const d2 = JSON.parse(FS.get(ROOT + '/เล่ม 1/Draft/สำเนา/draft.json'));
    const s2 = JSON.parse(FS.get(ROOT + '/เล่ม 1/Draft/สำเนา/scenes.json'));
    const g2 = d2.chapters[0].guid, rows2 = s2.chapters[g2] || [];
    ck('[P0-5] ★ guid ของบทในร่างสำเนาเป็นของใหม่', g2 && g2 !== 'chA' && !('chA' in s2.chapters), JSON.stringify(d2));
    ck('[P0-5] ★ id ของฉากเป็นของใหม่ทั้งหมด', rows2.length === 2 && rows2.every((r) => r.id !== 's1' && r.id !== 's2'),
       JSON.stringify(rows2));
    ck('[P0-5] chapterGuid ของแถวชี้บทใหม่', rows2.every((r) => r.chapterGuid === g2));
    ck('[P0-5] ทางเลือกแตกสายชี้ฉากสำเนา ไม่ใช่ฉากต้นฉบับ',
       rows2[0].choices[0].nextSceneId === rows2[1].id, JSON.stringify(rows2[0].choices));
    ck('[P0-5] ร่างต้นฉบับไม่ถูกแตะ', JSON.parse(FS.get(D + '/draft.json')).chapters[0].guid === 'chA');
    ck('[P0-5] ไฟล์ .md ถูกคัดลอก', FS.has(ROOT + '/เล่ม 1/Draft/สำเนา/Chapters/01 - บทหนึ่ง/scene-2.md'));
    ck('[P0-5] ไฟล์คู่ _vis.csv ตามไปด้วย', FS.has(ROOT + '/เล่ม 1/Draft/สำเนา/Chapters/01 - บทหนึ่ง/scene-1_vis.csv'));
  }

  console.log(`\nai-actions: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
