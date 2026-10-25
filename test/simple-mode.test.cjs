// test/simple-mode.test.cjs — [alpha.170 · ข้อ 8] โหมดเรียบง่าย (ผลสำรวจผู้ใช้ "ฟีเจอร์เยอะ ดูเรียนรู้ยาก")
const path = require('path');
const os = require('os');
const fs = require('fs');
const esbuild = require('esbuild');

function load(rel, tag) {
  const tmp = path.join(os.tmpdir(), 'k2-' + tag + '-simple-test.cjs');
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', rel)], outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
  return require(tmp);
}
const S = load('simple-mode.js', 'sm');
const TC = load('toolbar/toolbar-config.js', 'tc');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); }
}

// ── ทุกปุ่มในชุดเรียบง่ายมีอยู่จริง (ชื่อผิด = ปุ่มหายเงียบ) ──
const mainIds = new Set(TC.allButtonIds());
for (const id of S.SIMPLE_MAIN) check('[sm-1] ปุ่มแถบหลักมีจริง: ' + id, mainIds.has(id));
const fmtIds = new Set(TC.fmtbarConfigurableIds());
for (const id of S.SIMPLE_FMT) check('[sm-1] ปุ่มแถบรูปแบบมีจริง: ' + id, fmtIds.has(id));
check('[sm-1] ปุ่ม "เครื่องมือทั้งหมด" เป็นปุ่มที่โปรแกรมคุม (ซ่อนจากตั้งค่าไม่ได้)', TC.LOCKED_BUTTONS.includes('tb-simple-exit') && !TC.isConfigurable('tb-simple-exit'));

// ── ตัวกรองซ้อน ไม่แก้ค่าของผู้ใช้ ──
check('[sm-2] ปิดโหมด = ทุกปุ่มเห็นตามค่าของผู้ใช้', [...mainIds].every((id) => S.simpleMainVisible(false, id)));
check('[sm-2] เปิดโหมด = เห็นเฉพาะชุดเรียบง่าย', S.simpleMainVisible(true, 'tb-settings') && !S.simpleMainVisible(true, 'tb-kanban') && !S.simpleMainVisible(true, 'tb-ai-group'));
const user = TC.normalizeFmtbar({ prose: { hidden: { 'tb-italic': true } } });
const before = JSON.stringify(user);
const f = S.simpleFmtbar(user, TC.fmtbarConfigurableIds());
check('[sm-2] แถบรูปแบบ: ปุ่มนอกชุดถูกซ่อน', f.prose.hidden['tb-color'] === true && f.prose.hidden['tb-align-center'] === true && !f.prose.hidden['tb-bold']);
check('[sm-2] ปุ่มที่ผู้ใช้ซ่อนเองยังซ่อน (ในชุดเรียบง่ายก็ไม่บังคับให้โผล่)', f.prose.hidden['tb-italic'] === true);
check('[sm-2] ค่าของผู้ใช้ไม่ถูกแก้', JSON.stringify(user) === before);
check('[sm-2] ครบทุกโหมดของแถบ', TC.FMT_MODES.every((m) => !!f[m]));

// ── ผู้ใช้ใหม่เท่านั้น ──
check('[sm-3] ไฟล์ตั้งค่าว่าง/ไม่มี = ผู้ใช้ใหม่ → เปิดโหมด', S.simpleByDefault({}) && S.simpleByDefault(null));
check('[sm-3] ผู้ใช้เดิม (มีค่าใด ๆ อยู่แล้ว) = ไม่เปลี่ยนหน้าตาเอง', !S.simpleByDefault({ theme: 'k2' }) && !S.simpleByDefault({ languagePicked: true }));
check('[sm-3] เวิร์กสเปซที่จดไว้เป็นของภายใน', S.isInternalWorkspace(S.SIMPLE_WS) && !S.isInternalWorkspace('งานเขียน'));

// ── ค่าระดับผู้ใช้ประกาศใน GLOBAL_DEFAULTS (กฎ W3) + main รู้จักสวิตช์ในเมนู ──
const core = fs.readFileSync(path.join(__dirname, '..', 'src', 'core.js'), 'utf8');
check('[sm-4] simpleMode อยู่ใน GLOBAL_DEFAULTS', /simpleMode: false, simpleLayoutPending: false/.test(core));
const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
check('[sm-4] เมนู มุมมอง มีสวิตช์โหมดเรียบง่ายผ่าน cmd()', /view-simple-mode'[^\n]*cmd\('toggle-simple-mode'\)/.test(main));

// ── [alpha.170] หน้าแรกปิดเมื่อเปิดโปรเจกต์จากทางไหนก็ได้ (เมนู · ลากโฟลเดอร์) ──
const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const at = app.indexOf('async function loadProjectInner(');
const inner = app.slice(at, at + 6000);
check('[sm-5] loadProjectInner ปิดหน้าแรกที่ค้างอยู่หลังเปิดสำเร็จ', inner.includes('closeHomeDialogs()') && inner.indexOf('closeHomeDialogs') > inner.indexOf('state.root = root'));

console.log(`\nsimple-mode: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
