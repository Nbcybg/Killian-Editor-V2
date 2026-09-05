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
fs.writeFileSync(entry, `export * from '${src}/ai/ai-actions.js';\nexport { state } from '${src}/core.js';\n`);
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

  console.log(`\nai-actions: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
