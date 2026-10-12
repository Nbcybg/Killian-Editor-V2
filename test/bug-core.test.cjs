// test/bug-core.test.cjs — [alpha.170] รายงานบั๊ก + สถานะบั๊ก (ตรรกะล้วน)
//
// ผู้ใช้: *"pop up ตรวจสอบสถานะ bug โดยวางเป็น list ดังนี้ bug id - รายละเอียด bug - สถานะ - พบใน version ไหน -
//          วันที่ report - และแก้ไขใน version ไหน อย่าลืมเรื่องภาษาด้วยนะ อย่า hard code และต้องมีครบ และมี filter ด้วย"*
//
// ตรวจ: ที่อยู่มาจากรีโปเดียวกับระบบอัปเดต · Issue ดิบ → แถว (สถานะ/รุ่นที่พบ/รุ่นที่แก้) · ตัวกรอง · การเรียง ·
//       รายงาน (บรรทัดกำกับอ่านกลับได้ · ลิงก์ไม่ยาวเกิน) · แคช · คีย์ภาษาครบทุกไฟล์ · โค้ดไม่มีข้อความไทย/ลิงก์ฝัง
const fs = require('fs');
const os = require('os');
const path = require('path');
const { lexCsv } = require('../tools/csv-lite.cjs');
const { stripComments } = require('../tools/js-lex.cjs');

const ROOT = path.join(__dirname, '..');
const out = path.join(os.tmpdir(), '_bugcore170.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/bugs/bug-core.js')], outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const B = require(out);
const load = (rel, name) => { const o = path.join(os.tmpdir(), name); require('esbuild').buildSync({ entryPoints: [path.join(ROOT, rel)], outfile: o, format: 'cjs', bundle: true, logLevel: 'silent' }); return require(o); };
const W = load('tools/bug-relay/worker.js', '_bugrelay170.cjs');
const C = load('src/bugs/bug-config.js', '_bugconfig170.cjs');

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

const REPO = 'Nbcybg/Killian-Editor-V2';
const issue = (o) => ({ number: 1, title: 'x', state: 'open', labels: [], created_at: '2026-10-01T08:00:00Z', body: '', author_association: 'OWNER', ...o });

// ═══════════ ที่อยู่ — รีโปเดียวกับระบบอัปเดต ═══════════
{
  check('หน้า Issues / API อยู่ในรีโปของโปรแกรม · ไม่มีลิงก์เปิด Issue จากเว็บในโปรแกรมแล้ว',
        B.BUG_LIST_URL === `https://github.com/${REPO}/issues` && !('BUG_NEW_URL' in B) && !('buildIssueUrl' in B)
        && B.bugApiUrl(1).startsWith(`https://api.github.com/repos/${REPO}/issues?`), B.bugApiUrl(1));
  check('API ขอทั้งเปิดและปิด หน้าละ 100', /state=all/.test(B.bugApiUrl(1)) && /per_page=100/.test(B.bugApiUrl(1)) && /&page=1$/.test(B.bugApiUrl(1)));
  check('เลขหน้าถูกหนีบ (ค่าเสีย = 1 · เกินเพดาน = เพดาน)',
        /&page=1$/.test(B.bugApiUrl('x')) && /&page=1$/.test(B.bugApiUrl(-3)) && B.bugApiUrl(99).endsWith('&page=' + B.BUG_MAX_PAGES));
  check('ลิงก์ของบั๊กประกอบจากเลข', B.bugUrl(12) === `https://github.com/${REPO}/issues/12`);
  check('★ เลขเสีย = หน้ารายการ (ไม่ต่อข้อความแปลกลงลิงก์)',
        B.bugUrl('12/../../evil') === `https://github.com/${REPO}/issues/12` && B.bugUrl('x') === B.BUG_LIST_URL && B.bugUrl(0) === B.BUG_LIST_URL);
  const core = stripComments(fs.readFileSync(path.join(ROOT, 'src/bugs/bug-core.js'), 'utf8'));
  const ui = stripComments(fs.readFileSync(path.join(ROOT, 'src/bugs/bug-ui.js'), 'utf8'));
  check('★★ ไม่มีที่อยู่ GitHub เขียนซ้ำในโมดูลบั๊ก (มาจาก update-check.js ที่เดียว)',
        !/github\.com|githubusercontent/.test(core) && !/github\.com|githubusercontent/.test(ui));
  check('★ ชั้น UI ไม่ใช้ลิงก์ที่ API ส่งมา (html_url)', !/html_url/.test(ui) && !/html_url/.test(core));
}

// ═══════════ สถานะ ═══════════
{
  const st = (o) => B.statusOf(issue(o));
  check('เปิด ไม่มีป้าย = รอตรวจสอบ', st({}) === 'new');
  check('ป้าย bug / confirmed = ยืนยันแล้ว', st({ labels: [{ name: 'bug' }] }) === 'confirmed' && st({ labels: ['Confirmed'] }) === 'confirmed');
  check('ป้าย in progress (เว้นวรรค/ขีด/ตัวพิมพ์) = กำลังแก้ไข',
        st({ labels: [{ name: 'In Progress' }] }) === 'progress' && st({ labels: [{ name: 'in-progress' }, { name: 'bug' }] }) === 'progress');
  check('ป้าย need info = ขอข้อมูลเพิ่ม', st({ labels: [{ name: 'need info' }] }) === 'needinfo' && st({ labels: [{ name: 'question' }] }) === 'needinfo');
  check('ปิด (completed) = แก้ไขแล้ว', st({ state: 'closed', state_reason: 'completed' }) === 'fixed' && st({ state: 'closed' }) === 'fixed');
  check('ปิดแบบ not planned / ป้าย wontfix = ไม่แก้ไข',
        st({ state: 'closed', state_reason: 'not_planned' }) === 'wontfix' && st({ state: 'closed', labels: [{ name: 'wontfix' }] }) === 'wontfix');
  check('ป้าย duplicate ชนะทุกอย่าง (ทั้งเปิดและปิด)',
        st({ labels: [{ name: 'duplicate' }, { name: 'bug' }] }) === 'duplicate' && st({ state: 'closed', state_reason: 'duplicate' }) === 'duplicate');
  check('ทุกสถานะมีคีย์ภาษาเต็ม', B.BUG_STATUSES.every((s) => /^ui\.bug\.st[A-Z]\w+$/.test(B.BUG_STATUS_KEYS[s])) && B.BUG_STATUSES.length === 7);
  check('สถานะยังไม่จบ = 4 ตัวแรก', B.BUG_STATUSES.filter(B.isOpenStatus).join() === 'new,confirmed,progress,needinfo');
}

// ═══════════ อะไรนับเป็นบั๊ก ═══════════
{
  check('pull request ไม่ใช่บั๊ก', B.isReportIssue(issue({ pull_request: { url: 'x' } })) === false);
  check('งานเอกสารไม่นับ', !B.isReportIssue(issue({ labels: [{ name: 'documentation' }] })));
  // [alpha.170 · ขอฟีเจอร์] ผู้ใช้: "ปรับปรุง bug report ให้มี request feature เพิ่มเข้ามา"
  const kd = (o) => B.kindOf(issue(o));
  check('★★ คำขอฟีเจอร์นับเป็นรายการ (เดิมถูกกรองทิ้ง) · เอกสารที่ติดป้ายฟีเจอร์ด้วยก็นับ',
        B.isReportIssue(issue({ labels: [{ name: 'enhancement' }] })) && B.isReportIssue(issue({ labels: ['Feature Request'] }))
        && B.isReportIssue(issue({ labels: [{ name: 'documentation' }, { name: 'feature' }] })));
  check('★ ชนิดจากป้าย: enhancement/feature/feature-request = ขอฟีเจอร์ · ไม่มีป้าย = บั๊ก',
        kd({ labels: [{ name: 'enhancement' }] }) === 'feature' && kd({ labels: ['Feature'] }) === 'feature' && kd({ labels: ['feature request'] }) === 'feature' && kd({}) === 'bug');
  check('★ ป้าย bug ชนะป้ายฟีเจอร์และบรรทัดกำกับ (ผู้ดูแลย้ายชนิดได้ด้วยป้าย)',
        kd({ labels: [{ name: 'enhancement' }, { name: 'bug' }] }) === 'bug' && kd({ labels: ['bug'], body: '<!-- k2-report version=1.0 kind=feature -->' }) === 'bug');
  check('★★ ไม่มีป้าย (ตัวกลางรุ่นเก่า) = อ่านชนิดจากบรรทัดกำกับ · ค่าแปลก = บั๊ก',
        kd({ body: 'x\n<!-- k2-report version=2.0.0-alpha.169 lang=en kind=feature -->' }) === 'feature'
        && kd({ body: '<!-- k2-report version=1.0 kind=evil -->' }) === 'bug' && kd({ body: '<!-- k2-report version=1.0 -->' }) === 'bug');
  check('ชนิดติดไปกับแถว', B.issueToBug(issue({ labels: ['enhancement'] })).kind === 'feature' && B.issueToBug(issue({})).kind === 'bug');
  check('คำขอที่รับไว้ (accepted/planned/confirmed) = สถานะยืนยันแล้ว · มีแค่ป้ายฟีเจอร์ = รอตรวจสอบ',
        B.statusOf(issue({ labels: ['enhancement', 'accepted'] })) === 'confirmed' && B.statusOf(issue({ labels: ['enhancement', 'planned'] })) === 'confirmed'
        && B.statusOf(issue({ labels: ['enhancement'] })) === 'new');
  check('★ สถานะของคำขอฟีเจอร์มีชื่อของตัวเองสี่ตัว (คีย์เต็ม) · ที่เหลือใช้ร่วมกับบั๊ก',
        B.statusKey('fixed', 'feature') === 'ui.bug.stAdded' && B.statusKey('confirmed', 'feature') === 'ui.bug.stPlanned' && B.statusKey('progress', 'feature') === 'ui.bug.stBuilding'
        && B.statusKey('wontfix', 'feature') === 'ui.bug.stDeclined' && B.statusKey('new', 'feature') === B.BUG_STATUS_KEYS.new
        && B.statusKey('fixed', 'bug') === 'ui.bug.stFixed' && B.statusKey('fixed') === 'ui.bug.stFixed' && B.statusKey('zzz', 'feature') === 'ui.bug.stNew'
        && B.BUG_STATUSES.every((st) => /^ui\.bug\.st[A-Z]\w+$/.test(B.FEATURE_STATUS_KEYS[st])));
  check('ไม่มีป้าย = บั๊ก (รายงานใหม่ยังไม่มีใครติดป้าย)', B.isReportIssue(issue({})));
  check('ของเสีย (ไม่มีเลข/ไม่ใช่วัตถุ) = ไม่รับ', !B.isReportIssue(null) && !B.isReportIssue('x') && !B.isReportIssue({ title: 'a' }));
}

// ═══════════ รุ่น ═══════════
{
  check('ย่อรุ่นทดลอง', B.shortVersion('2.0.0-alpha.169') === 'alpha.169' && B.shortVersion('v2.0.0-alpha.169') === 'alpha.169');
  check('รุ่นจริงคงเดิม · ค่าว่าง = ว่าง', B.shortVersion('2.1.0') === '2.1.0' && B.shortVersion('') === '' && B.shortVersion(null) === '');
  check('ข้อความที่ไม่ใช่รุ่นคงเดิม', B.shortVersion('alpha.170') === 'alpha.170' && B.shortVersion('Next') === 'Next');
  check('★ เรียงรุ่นเป็นตัวเลข (alpha.99 < alpha.100) ไม่ใช่ตัวอักษร', B.cmpBugVersion('alpha.99', 'alpha.100') < 0 && B.cmpBugVersion('2.0.0-alpha.170', 'alpha.169') > 0);
  check('ว่าง = เก่าสุด · เท่ากัน = 0', B.cmpBugVersion('', 'alpha.1') < 0 && B.cmpBugVersion('alpha.1', '') > 0 && B.cmpBugVersion('', '') === 0 && B.cmpBugVersion('alpha.5', '2.0.0-alpha.5') === 0);

  const body = B.buildReportBody({ what: 'ก', env: { version: '2.0.0-alpha.169', platform: 'win32', lang: 'th' }, labels: { what: 'W', steps: 'S', expected: 'E', env: 'ENV' } });
  check('★★ รุ่นที่พบอ่านกลับจากรายงานที่โปรแกรมเขียนเอง', B.foundVersion(issue({ body })) === 'alpha.169', B.foundVersion(issue({ body })));
  check('บรรทัดกำกับอ่านได้ครบ', JSON.stringify(B.parseReportMark(body)) === JSON.stringify({ version: '2.0.0-alpha.169', platform: 'win32', lang: 'th', kind: '' }));
  check('ป้าย found: ชนะเนื้อรายงาน (ผู้ดูแลแก้ได้)', B.foundVersion(issue({ body, labels: [{ name: 'found:alpha.160' }] })) === 'alpha.160');
  check('บรรทัด Version: ที่คนพิมพ์เองก็อ่านได้', B.foundVersion(issue({ body: 'hello\n**Version:** 2.0.0-alpha.150\nbye' })) === 'alpha.150'
        && B.foundVersion(issue({ body: 'App version: v2.0.0-alpha.151' })) === 'alpha.151');
  check('ไม่มีข้อมูลรุ่น = ว่าง', B.foundVersion(issue({ body: 'no info' })) === '' && B.foundVersion(issue({ body: null })) === '');
  check('★ บรรทัดกำกับถูกกรองอักขระ (ไม่ปล่อยของแปลกเข้าตาราง)',
        B.parseReportMark('<!-- k2-report version=1.0"x;y platform=a(b) -->').version === '1.0xy'
        && B.parseReportMark('<!-- k2-report version=1.0<script> -->').version === '');
  check('รุ่นที่แก้ = Milestone', B.fixedVersion(issue({ milestone: { title: '2.0.0-alpha.170' } })) === 'alpha.170');
  check('ไม่มี Milestone = ป้าย fixed:', B.fixedVersion(issue({ labels: [{ name: 'fixed:alpha.171' }] })) === 'alpha.171'
        && B.fixedVersion(issue({ labels: [{ name: 'Fixed-in: v2.0.0-alpha.172' }] })) === 'alpha.172');
  check('ยังไม่ระบุ = ว่าง', B.fixedVersion(issue({})) === '' && B.fixedVersion(issue({ milestone: { title: '  ' } })) === '');
}

// ═══════════ Issue → แถว ═══════════
const RAW = [
  issue({ number: 7, title: '  บันทึกแล้ว\nค้าง  ', labels: [{ name: 'bug' }], created_at: '2026-10-05T03:00:00Z', body: '<!-- k2-report version=2.0.0-alpha.169 -->' }),
  issue({ number: 5, title: 'Export PDF blank', state: 'closed', state_reason: 'completed', created_at: '2026-09-20T03:00:00Z',
          body: 'Version: 2.0.0-alpha.167', milestone: { title: '2.0.0-alpha.168' } }),
  issue({ number: 6, title: 'fix a typo in the manual', labels: [{ name: 'documentation' }] }),
  issue({ number: 4, title: 'PR', pull_request: {} }),
  issue({ number: 3, title: 'ซ้ำ', labels: [{ name: 'duplicate' }], created_at: '2026-09-01T00:00:00Z' }),
  issue({ number: 2, title: 'crash on open', labels: [{ name: 'in progress' }], created_at: '2026-08-15T00:00:00Z', body: '<!-- k2-report version=2.0.0-alpha.99 -->' }),
];
{
  const b = B.issueToBug(RAW[0]);
  check('แถวมีครบหกคอลัมน์ที่ผู้ใช้กำหนด',
        b.id === '#7' && b.title === 'บันทึกแล้ว ค้าง' && b.status === 'confirmed' && b.foundIn === 'alpha.169'
        && b.reported === '2026-10-05T03:00:00Z' && b.fixedIn === '' && b.url === B.bugUrl(7), JSON.stringify(b));
  const r = B.readIssuesResponse({ status: 200, ok: true, body: JSON.stringify(RAW) });
  check('อ่านคำตอบ: กรอง PR/งานเอกสารออก เหลือ 4 บั๊ก', r.ok && r.bugs.length === 4 && r.bugs.map((x) => x.num).join() === '7,5,3,2', r.ok ? r.bugs.map((x) => x.num).join() : r.code);
  check('หน้าไม่เต็ม = ไม่มีหน้าถัดไป', r.more === false);
  const full = B.readIssuesResponse({ status: 200, ok: true, body: JSON.stringify(Array.from({ length: 100 }, (_, i) => issue({ number: i + 1 }))) });
  check('หน้าเต็ม 100 = อาจมีหน้าถัดไป', full.ok && full.more === true && full.bugs.length === 100);
  check('★ คำตอบมี BOM นำหน้าก็อ่านได้', B.readIssuesResponse({ status: 200, ok: true, body: String.fromCharCode(0xFEFF) + '[]' }).ok === true);
  check('เน็ตล้ม = net', B.readIssuesResponse({ status: 0, ok: false, netError: true, error: 'ENOTFOUND' }).code === 'net'
        && B.readIssuesResponse(null).code === 'net' && B.readIssuesResponse({ status: 0, aborted: true }).code === 'net');
  check('★ เกินโควตา = rate (403 พร้อมข้อความ · 429)',
        B.readIssuesResponse({ status: 403, ok: false, body: '{"message":"API rate limit exceeded"}' }).code === 'rate'
        && B.readIssuesResponse({ status: 429, ok: false, body: '' }).code === 'rate');
  check('403 อื่น / 500 = http พร้อมรหัส', B.readIssuesResponse({ status: 403, ok: false, body: 'forbidden' }).code === 'http'
        && B.readIssuesResponse({ status: 500, ok: false, body: '' }).status === 500);
  check('ไม่ใช่ JSON / ไม่ใช่อาร์เรย์ = parse', B.readIssuesResponse({ status: 200, ok: true, body: '<html>' }).code === 'parse'
        && B.readIssuesResponse({ status: 200, ok: true, body: '{"a":1}' }).code === 'parse');
  const m = B.mergeBugs([{ num: 1 }, { num: 2 }], [{ num: 2, dup: true }, { num: 3 }], null);
  check('รวมหลายหน้า: เลขซ้ำเก็บตัวแรก', m.length === 3 && !m[1].dup);
}

// ═══════════ กรอง / เรียง / นับ ═══════════
{
  const list = B.readIssuesResponse({ status: 200, ok: true, body: JSON.stringify(RAW) }).bugs;
  const nums = (l) => l.map((x) => x.num).join();
  check('ไม่กรอง = ทั้งหมด', nums(B.filterBugs(list, {})) === '7,5,3,2' && nums(B.filterBugs(list)) === '7,5,3,2');
  check('กรอง "ยังไม่ปิด"', nums(B.filterBugs(list, { status: 'open' })) === '7,2');
  check('กรอง "ปิดแล้ว" (แก้แล้ว + ซ้ำ)', nums(B.filterBugs(list, { status: 'closed' })) === '5,3');
  check('กรองสถานะตัวเดียว', nums(B.filterBugs(list, { status: 'fixed' })) === '5' && nums(B.filterBugs(list, { status: 'progress' })) === '2');
  check('กรองรุ่นที่พบ', nums(B.filterBugs(list, { found: 'alpha.169' })) === '7' && nums(B.filterBugs(list, { found: 'alpha.1' })) === '');
  check('กรองรุ่นที่แก้ + "ยังไม่ระบุ"', nums(B.filterBugs(list, { fixed: 'alpha.168' })) === '5' && nums(B.filterBugs(list, { fixed: 'none' })) === '7,3,2');
  check('คำค้น: เลขบั๊ก (#7 / 7)', nums(B.filterBugs(list, { q: '#7' })) === '7' && nums(B.filterBugs(list, { q: '7' })).split(',').includes('7'));
  check('คำค้น: รายละเอียด ไม่สนตัวพิมพ์ · ภาษาไทย', nums(B.filterBugs(list, { q: 'EXPORT pdf' })) === '5' && nums(B.filterBugs(list, { q: 'ค้าง' })) === '7');
  check('คำค้น: รุ่น', nums(B.filterBugs(list, { q: 'alpha.167' })) === '5');
  check('คำค้นหลายคำ = ต้องเจอทุกคำ', nums(B.filterBugs(list, { q: 'export crash' })) === '');
  check('ตัวกรองซ้อนกัน', nums(B.filterBugs(list, { status: 'open', q: 'crash' })) === '2' && nums(B.filterBugs(list, { status: 'open', found: 'alpha.169', q: 'crash' })) === '');

  check('เรียงตั้งต้น = เลขบั๊กใหม่ก่อน', nums(B.sortBugs(list)) === '7,5,3,2' && nums(B.sortBugs(list, 'id', 'asc')) === '2,3,5,7');
  check('เรียงตามวันที่รายงาน', nums(B.sortBugs(list, 'reported', 'asc')) === '2,3,5,7');
  check('เรียงตามสถานะ = ลำดับของตาราง (ยังไม่จบก่อน)', nums(B.sortBugs(list, 'status', 'asc')) === '7,2,5,3', nums(B.sortBugs(list, 'status', 'asc')));
  check('★ เรียงตามรุ่นที่พบ: alpha.99 < alpha.167 < alpha.169 · ว่างเก่าสุด', nums(B.sortBugs(list, 'foundIn', 'asc')) === '3,2,5,7', nums(B.sortBugs(list, 'foundIn', 'asc')));
  check('เรียงตามรุ่นที่แก้: ค่าเท่ากัน (ว่าง) = เลขบั๊กใหม่ก่อน', nums(B.sortBugs(list, 'fixedIn', 'desc')) === '5,7,3,2', nums(B.sortBugs(list, 'fixedIn', 'desc')));
  check('เรียงตามรายละเอียดใช้ตัวเทียบที่ส่งมา', nums(B.sortBugs(list, 'title', 'asc', (a, b) => a.length - b.length)) === nums([...list].sort((a, b) => (a.title.length - b.title.length) || (b.num - a.num))));
  check('คีย์เรียงที่ไม่รู้จัก = เลขบั๊ก · ไม่แก้อาร์เรย์เดิม', nums(B.sortBugs(list, 'zzz', 'asc')) === '2,3,5,7' && nums(list) === '7,5,3,2');
  check('คอลัมน์ที่เรียงได้ = หกคอลัมน์ของผู้ใช้', B.BUG_SORT_KEYS.join() === 'id,title,status,foundIn,reported,fixedIn');

  const n = B.countByStatus(list);
  check('นับต่อสถานะ', n.all === 4 && n.open === 2 && n.closed === 2 && n.confirmed === 1 && n.progress === 1 && n.fixed === 1 && n.duplicate === 1 && n.new === 0);
  check('รายชื่อรุ่นในช่องกรอง: ใหม่ → เก่า ไม่ซ้ำ ไม่มีค่าว่าง', B.bugVersions(list, 'foundIn').join() === 'alpha.169,alpha.167,alpha.99' && B.bugVersions(list, 'fixedIn').join() === 'alpha.168');
  const mixed = [{ num: 1, title: 'a', status: 'new', kind: 'bug' }, { num: 2, title: 'b', status: 'fixed', kind: 'feature' }, { num: 3, title: 'c', status: 'new' }];
  check('★★ กรองตามชนิด: ทั้งหมด / บั๊ก / ขอฟีเจอร์ (แถวที่ไม่มีชนิด = บั๊ก — รายการที่จำไว้จากรุ่นก่อน)',
        nums(B.filterBugs(mixed, {})) === '1,2,3' && nums(B.filterBugs(mixed, { kind: 'bug' })) === '1,3' && nums(B.filterBugs(mixed, { kind: 'feature' })) === '2'
        && nums(B.filterBugs(mixed, { kind: 'feature', status: 'open' })) === '');
  const withReq = B.readIssuesResponse({ status: 200, ok: true, body: JSON.stringify([...RAW, issue({ number: 1, title: 'add dark mode', labels: [{ name: 'enhancement' }] })]) }).bugs;
  check('★★ อ่านคำตอบ: คำขอฟีเจอร์อยู่ในรายการพร้อมชนิด (กรองชนิด "บั๊ก" = รายการเดิม)',
        nums(withReq) === '7,5,3,2,1' && withReq[4].kind === 'feature' && nums(B.filterBugs(withReq, { kind: 'bug' })) === '7,5,3,2' && nums(B.filterBugs(withReq, { kind: 'feature' })) === '1');
  const nk = B.countByKind(mixed);
  check('นับต่อชนิด', nk.all === 3 && nk.bug === 2 && nk.feature === 1 && B.countByKind(null).all === 0);
  check('รายการว่าง/ค่าเสียไม่พัง', B.filterBugs(null, { q: 'a' }).length === 0 && B.sortBugs(null).length === 0 && B.countByStatus(null).all === 0 && B.bugVersions(null).length === 0);
}

// ═══════════ รายงาน ═══════════
{
  const labels = { what: 'เกิดอะไรขึ้น', steps: 'ขั้นตอน', expected: 'ที่ควรเป็น', env: 'สภาพแวดล้อม' };
  const env = { version: '2.0.0-alpha.169', platform: 'win32', os: 'Windows NT 10.0', lang: 'th', runtime: 'Electron 43.1.1' };
  const body = B.buildReportBody({ what: 'กดบันทึกแล้วค้าง\r\nบรรทัดสอง', steps: '1. เปิด', expected: '', env, labels });
  check('หัวข้อย่อยมาจากป้ายที่ส่งเข้ามา (ไฟล์ภาษา)', body.includes('### เกิดอะไรขึ้น\nกดบันทึกแล้วค้าง\nบรรทัดสอง') && body.includes('### ขั้นตอน\n1. เปิด'));
  check('ช่องที่ไม่ได้กรอกไม่มีหัวข้อเปล่า', !body.includes('### ที่ควรเป็น'));
  check('บรรทัดสภาพแวดล้อมครบ', body.includes('### สภาพแวดล้อม\nVersion: 2.0.0-alpha.169 · OS: win32 (Windows NT 10.0) · Language: th · Electron 43.1.1'), body);
  check('บรรทัดกำกับอยู่ท้ายสุด', body.trim().endsWith('<!-- k2-report version=2.0.0-alpha.169 platform=win32 lang=th -->'));
  check('★ รายงานไม่มีอักขระควบคุม', !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(B.buildReportBody({ what: 'a' + String.fromCharCode(1, 7) + 'b', env, labels })));
  check('ไม่มีข้อมูลรุ่น = "?" (ไม่ใช่ว่าง)', B.envLine({}) === 'Version: ?' && B.reportMark({}) === '<!-- k2-report version=? -->');
  check('หัวข้อ: บรรทัดเดียว ตัดช่องว่าง จำกัด 200', B.reportTitle('  a\n b  ') === 'a b' && B.reportTitle('x'.repeat(500)).length === 200 && B.reportTitle(null) === '');
  // ── ส่งผ่านตัวกลาง: คำขอของโปรแกรม ──
  const NOW = 1_800_000_000_000;
  const RELAY = 'https://k2-bug-relay.example.workers.dev';
  const req = B.buildRelayRequest({ relay: RELAY + '/', title: '  Save\n hangs ', body, env, now: NOW });
  check('★★ คำขอ: POST ไปที่ <ตัวกลาง>/report (ตัด / ท้ายที่อยู่) พร้อมหัวบอกว่าเป็นโปรแกรม',
        !!req && req.url === RELAY + '/report' && req.options.method === 'POST'
        && req.options.headers['X-K2-Client'] === B.RELAY_CLIENT && req.options.headers['Content-Type'] === 'application/json', req && req.url);
  const sent = JSON.parse(req.options.body);
  check('คำขอมีสี่ช่อง: หัวข้อ (บรรทัดเดียว) · เนื้อ · รุ่น · เวลา',
        Object.keys(sent).sort().join() === 'body,title,ts,version' && sent.title === 'Save hangs' && sent.body === body && sent.version === '2.0.0-alpha.169' && sent.ts === NOW);
  check('★★ คำขอไม่มีของลับ/ทางไฟล์ (ไม่มีโทเคน ไม่มี Authorization)',
        !/authorization|token|secret/i.test(JSON.stringify(req)) && !/[A-Za-z]:[\\/]|\/Users\//.test(req.options.body));
  check('★ ยังไม่ได้ตั้งตัวกลาง / ที่อยู่ไม่ใช่ https / ไม่มีหัวข้อ = ไม่มีคำขอ (null)',
        B.buildRelayRequest({ relay: '', title: 'a', body, env }) === null && B.buildRelayRequest({ relay: 'http://x.test', title: 'a', body, env }) === null
        && B.buildRelayRequest({ relay: RELAY, title: '   ', body, env }) === null);
  check('ที่อยู่ตัวกลาง: https เท่านั้น · ไม่มีชื่อผู้ใช้/รหัสผ่าน/คิวรี',
        B.isRelayUrl(RELAY) && B.isRelayUrl('https://a.b/c/') && !B.isRelayUrl('http://a.b') && !B.isRelayUrl('https://user:pw@a.b')
        && !B.isRelayUrl('https://a.b/?x=1') && !B.isRelayUrl('javascript:alert(1)') && !B.isRelayUrl('') && !B.isRelayUrl(null));
  check('เนื้อยาวเกินเพดานถูกตัดก่อนส่ง', JSON.parse(B.buildRelayRequest({ relay: RELAY, title: 'a', body: 'x'.repeat(50000), env }).options.body).body.length === B.RELAY_MAX_BODY);

  // ── คำตอบของตัวกลาง ──
  check('คำตอบสำเร็จ = เลขบั๊ก', JSON.stringify(B.readRelayResponse({ status: 201, ok: true, body: '{"ok":true,"number":42}' })) === '{"ok":true,"num":42}');
  check('เน็ตล้ม/หมดเวลา = net', B.readRelayResponse({ status: 0, netError: true }).code === 'net' && B.readRelayResponse(null).code === 'net' && B.readRelayResponse({ status: 0, aborted: true }).code === 'net');
  check('429 = rate · 4xx/5xx อื่น = http พร้อมรหัส', B.readRelayResponse({ status: 429, ok: false, body: '' }).code === 'rate'
        && B.readRelayResponse({ status: 502, ok: false, body: '{"ok":false}' }).status === 502 && B.readRelayResponse({ status: 400, ok: false }).code === 'http');
  check('★ ตอบ 200 แต่ไม่มีเลขบั๊ก/ไม่ใช่ JSON = parse (ไม่บอกผู้ใช้ว่าส่งแล้วทั้งที่ไม่รู้)',
        B.readRelayResponse({ status: 200, ok: true, body: '<html>' }).code === 'parse' && B.readRelayResponse({ status: 200, ok: true, body: '{"ok":true}' }).code === 'parse'
        && B.readRelayResponse({ status: 200, ok: true, body: '{"ok":false,"number":3}' }).code === 'parse' && B.readRelayResponse({ status: 200, ok: true, body: '{"ok":true,"number":-1}' }).code === 'parse');

  // [bug hunt] นาฬิกาเครื่องผู้ใช้คลาด → ตัวกลางตอบรหัส ts → โปรแกรมบอกเหตุจริง (ไม่ใช่ "ข้อผิดพลาด 400")
  check('★★ ตัวกลางปฏิเสธเพราะเวลาของคำขอ = clock (ผู้ใช้แก้ได้เอง) · รหัสอื่น/เนื้อไม่ใช่ JSON = http',
        B.readRelayResponse({ status: 400, ok: false, body: '{"ok":false,"code":"ts"}' }).code === 'clock'
        && B.readRelayResponse({ status: 400, ok: false, body: '{"ok":false,"code":"title"}' }).code === 'http'
        && B.readRelayResponse({ status: 400, ok: false, body: '<html>' }).code === 'http' && B.readRelayResponse({ status: 400, ok: false, body: 'null' }).code === 'http');
  check('รหัสที่ตัวกลางตอบเมื่อเวลาคลาดคือ ts จริง (สองฝั่งตรงกัน)', W.validateReport({ ...sent, ts: NOW - 3600000 }, NOW).code === 'ts');

  // [bug hunt] บั๊กที่เครื่องนี้เพิ่งส่ง ต้องเห็นในรายการแม้ GitHub ยังไม่ส่งมา
  const pd = B.pendingBug(77, '  เพิ่งส่ง\n ', '2.0.0-alpha.169', NOW);
  check('แถวชั่วคราว: รอตรวจสอบ · รุ่นย่อ · ลิงก์ประกอบจากเลข', pd.id === '#77' && pd.title === 'เพิ่งส่ง' && pd.status === 'new' && pd.foundIn === 'alpha.169'
        && pd.url === B.bugUrl(77) && pd.reported === new Date(NOW).toISOString() && B.pendingBug('x', 'a', '1') === null && B.pendingBug(0, 'a', '1') === null);
  const listed = [{ num: 5, id: '#5', title: 'เก่า', status: 'fixed' }];
  const merged = B.withPending(listed, [pd], NOW + 1000);
  check('★★ GitHub ยังไม่มีเลขนั้น = เติมไว้หน้ารายการ (ไม่มีช่อง ts หลุดไปถึงตาราง)', merged.map((b) => b.num).join() === '77,5' && !('ts' in merged[0]) && merged[0].status === 'new');
  check('★ GitHub มีเลขนั้นแล้ว = ใช้ของ GitHub (สถานะล่าสุด) ไม่ซ้ำสองแถว',
        B.withPending([{ num: 77, status: 'confirmed' }, ...listed], [pd], NOW + 1000).map((b) => b.num + b.status).join() === '77confirmed,5fixed');
  check('★ พ้นเวลาที่จำไว้ = เลิกเติม (ถูกลบ/ซ่อนบน GitHub แล้วต้องหายจากโปรแกรม)', B.withPending(listed, [pd], NOW + B.PENDING_MS).length === 1 && B.withPending(listed, [pd], NOW + B.PENDING_MS - 1).length === 2);
  check('ของที่จำไว้รูปเสีย/ซ้ำ/เวลาในอนาคต ถูกทิ้ง · ไม่เกินเพดาน · ไม่แก้รายการเดิม',
        B.prunePending([pd, { ...pd }, null, { num: 'x', ts: NOW }, { num: 9, ts: NOW + 99999 }, { num: 8 }], NOW).length === 1
        && B.prunePending(Array.from({ length: 50 }, (_, i) => B.pendingBug(i + 1, 't', '1.0', NOW - i)), NOW).length === B.PENDING_MAX
        && B.prunePending('nope', NOW).length === 0 && B.withPending(null, null, NOW).length === 0 && listed.length === 1);

  // ── ตัวกลาง (tools/bug-relay/worker.js) รับคำขอของโปรแกรมได้จริง ──
  const v = W.validateReport(sent, NOW + 1000);
  check('★★ ตัวกลางรับคำขอที่โปรแกรมสร้าง (สองฝั่งพูดภาษาเดียวกัน)', v.ok === true && v.title === 'Save hangs' && v.version === '2.0.0-alpha.169', JSON.stringify(v).slice(0, 120));
  check('ค่าที่สองฝั่งต้องตรงกัน: ชื่อโปรแกรม · เพดานเนื้อ · เพดานหัวข้อ', W.CLIENT === B.RELAY_CLIENT && W.LIMITS.body === B.RELAY_MAX_BODY && W.LIMITS.title === 200);
  const bad = (patch, t2 = NOW) => W.validateReport({ ...sent, ...patch }, t2);
  check('ตัวกลางปฏิเสธ: ไม่มีหัวข้อ · หัวข้อยาวเกิน · เนื้อว่าง · เนื้อยาวเกิน',
        bad({ title: ' ' }).code === 'title' && bad({ title: 'x'.repeat(201) }).code === 'title' && bad({ body: '' }).code === 'body' && bad({ body: 'x'.repeat(20001) }).code === 'body');
  check('ตัวกลางปฏิเสธ: รุ่นรูปแปลก · คำขอเก่า/จากอนาคตเกิน 15 นาที · เวลาเสีย',
        bad({ version: '1.0; rm -rf' }).code === 'version' && bad({ version: '' }).code === 'version' && bad({}, NOW + 16 * 60000).code === 'ts' && bad({}, NOW - 16 * 60000).code === 'ts' && bad({ ts: 'x' }).code === 'ts');
  check('★ ตัวกลางปฏิเสธ: ไม่มีบรรทัดกำกับ · มีสองบรรทัด · รุ่นในบรรทัดกำกับไม่ตรงกับที่แจ้ง',
        bad({ body: 'no mark' }).code === 'mark' && bad({ body: body + '\n<!-- k2-report version=2.0.0-alpha.169 -->' }).code === 'mark' && bad({ version: '2.0.0-alpha.1' }).code === 'mark');
  check('ตัวกลางปฏิเสธของที่ไม่ใช่วัตถุ', W.validateReport(null, NOW).code === 'shape' && W.validateReport([], NOW).code === 'shape' && W.validateReport('x', NOW).code === 'shape');
  const pay = W.issuePayload({ title: 'hi @octocat', body: 'cc @someone and a@b.c\n' + B.reportMark(env), version: 'x' });
  check('★ Issue ที่เปิด: ติดป้าย from-app · ตัด @ชื่อ ไม่ให้แท็กคนอื่น (เนื้อยังอ่านเหมือนเดิม)',
        pay.labels.join() === 'from-app' && !/@octocat/.test(pay.title) && !/@someone/.test(pay.body) && pay.title.replace(/[^\x20-\x7E]/g, '') === 'hi @octocat', JSON.stringify(pay.title));
  check('★★ บรรทัดกำกับรุ่นรอดถึง Issue → กล่องสถานะอ่าน "พบในรุ่น" ได้', B.foundVersion({ body: W.issuePayload(v).body, labels: [] }) === 'alpha.169');

  // ── [alpha.170 · ขอฟีเจอร์] ──
  const fLabels = { what: 'What you would like', steps: 'Why it would help', expected: 'How you manage today', env: 'Environment' };
  const fBody = B.buildReportBody({ what: 'Dark mode for exports', steps: 'Reading at night', expected: '', env, labels: fLabels, kind: 'feature' });
  check('★★ คำขอฟีเจอร์: หัวข้อย่อยของตัวเอง + บรรทัดกำกับบอกชนิด (อ่านกลับได้) · บรรทัดกำกับของบั๊กเหมือนเดิมทุกตัวอักษร',
        fBody.includes('### What you would like\nDark mode for exports') && fBody.includes('### Why it would help\nReading at night')
        && fBody.trim().endsWith('<!-- k2-report version=2.0.0-alpha.169 platform=win32 lang=th kind=feature -->')
        && B.parseReportMark(fBody).kind === 'feature' && B.parseReportMark(body).kind === '' && B.reportMark(env, 'zzz') === B.reportMark(env));
  const fReq = B.buildRelayRequest({ relay: RELAY, title: 'Dark exports', body: fBody, env, kind: 'feature', now: NOW });
  const fSent = JSON.parse(fReq.options.body);
  check('★ คำขอฟีเจอร์ส่งช่อง kind เพิ่มหนึ่งช่อง · รายงานบั๊กยังเป็นสี่ช่องเดิม (ตัวกลางรุ่นเก่ารับได้)',
        Object.keys(fSent).sort().join() === 'body,kind,title,ts,version' && fSent.kind === 'feature' && !('kind' in sent)
        && !('kind' in JSON.parse(B.buildRelayRequest({ relay: RELAY, title: 'a', body, env, kind: 'nope', now: NOW }).options.body)));
  const fv = W.validateReport(fSent, NOW + 1000);
  check('★★ ตัวกลางรับคำขอฟีเจอร์ที่โปรแกรมสร้าง แล้วติดป้าย enhancement เพิ่ม (โปรแกรมอ่านชนิดจากป้ายนี้)',
        fv.ok === true && fv.kind === 'feature' && W.issuePayload(fv).labels.join() === 'from-app,enhancement'
        && B.kindOf({ labels: W.issuePayload(fv).labels, body: W.issuePayload(fv).body }) === 'feature');
  check('★★ คำขอรูปเดิมของโปรแกรมรุ่นก่อน (ไม่มีช่อง kind) = บั๊ก ป้ายเดิม', v.kind === 'bug' && W.issuePayload(v).labels.join() === 'from-app');
  check('ตัวกลางปฏิเสธชนิดที่ไม่รู้จัก · รายชื่อชนิดสองฝั่งตรงกัน',
        bad({ kind: 'spam' }).code === 'kind' && bad({ kind: '' }).code === 'kind' && bad({ kind: 'bug' }).ok === true && W.KINDS.join() === B.REPORT_KINDS.join()
        && B.REPORT_KINDS.every((k) => Array.isArray(W.KIND_LABELS[k])) && W.KIND_LABELS.feature.every((l) => B.FEATURE_LABELS.includes(l)));
  const fp = B.pendingBug(78, 'Dark exports', '2.0.0-alpha.169', NOW, 'feature');
  check('คำขอที่เพิ่งส่ง: แถวชั่วคราวพกชนิด และรอดการคัดของที่จำไว้',
        fp.kind === 'feature' && pd.kind === 'bug' && B.prunePending([fp], NOW)[0].kind === 'feature' && B.withPending([], [fp], NOW)[0].kind === 'feature');

  // ── ค่าที่ผู้ดูแลตั้ง (bug-config.js) ──
  check('★ ที่อยู่ตัวกลางที่ตั้งไว้: ว่าง (ยังไม่เปิด) หรือ https ที่ใช้ได้', C.BUG_RELAY_URL === '' || B.isRelayUrl(C.BUG_RELAY_URL), C.BUG_RELAY_URL);
  check('ทางที่กำหนด: มี label/url เป็นข้อความ · url ว่างหรือ https', typeof C.BUG_CONTACT.label === 'string' && (C.BUG_CONTACT.url === '' || /^https:\/\//.test(C.BUG_CONTACT.url)));
  const cfgSrc = stripComments(fs.readFileSync(path.join(ROOT, 'src/bugs/bug-config.js'), 'utf8'));
  check('★★ ไฟล์ค่าของผู้ดูแลไม่มีโทเคน GitHub', !/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_/.test(cfgSrc));
  const wSrc = fs.readFileSync(path.join(ROOT, 'tools/bug-relay/worker.js'), 'utf8');
  const toml = fs.readFileSync(path.join(ROOT, 'tools/bug-relay/wrangler.toml'), 'utf8');
  check('★★ ตัวกลาง: โทเคนมาจากตัวแปรลับเท่านั้น (ไม่มีในซอร์ส/ไฟล์ตั้งค่า) · รีโปตรงกับของโปรแกรม',
        /env\.GITHUB_TOKEN/.test(wSrc) && !/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_/.test(wSrc + toml) && toml.includes('GITHUB_REPO = "' + REPO + '"'));
}

// ═══════════ คนนอกเปิด Issue จากเว็บ = ไม่นับ + ถูกปิดอัตโนมัติ ═══════════
{
  check('★★ Issue ของผู้ดูแล/ตัวกลางเท่านั้นที่ขึ้นในโปรแกรม',
        B.isReportIssue(issue({ author_association: 'OWNER' })) && B.isReportIssue(issue({ author_association: 'COLLABORATOR' })) && B.isReportIssue(issue({ author_association: 'member' }))
        && !B.isReportIssue(issue({ author_association: 'NONE' })) && !B.isReportIssue(issue({ author_association: 'CONTRIBUTOR' })) && !B.isReportIssue(issue({ author_association: undefined })));
  const copied = '# หัวข้อ\n\n' + B.buildReportBody({ what: 'ก', env: { version: '2.0.0-alpha.169', platform: 'win32', lang: 'th' }, labels: { what: 'W', steps: 'S', expected: 'E', env: 'ENV' } });
  check('★★ ของคนนอกไม่นับ — แม้ติดป้าย bug · แม้วางรายงานที่คัดลอกจากโปรแกรม (ทาง GitHub ถูกถอดแล้ว เหลืออีเมล)',
        !B.isReportIssue(issue({ author_association: 'NONE', labels: [{ name: 'bug' }] })) && !B.isReportIssue(issue({ author_association: 'NONE', body: copied })) && !('isAppReport' in B));
  check('★ ผู้ดูแลลงรายงานที่ได้ทางอีเมลเป็น Issue (วางทั้งก้อน) = นับ และอ่านรุ่นที่พบได้เอง',
        B.isReportIssue(issue({ author_association: 'OWNER', body: copied })) && B.foundVersion(issue({ body: copied })) === 'alpha.169');
  // [bug hunt] ผู้ดูแลซ่อนรายการได้ด้วยป้าย (รายงานทดสอบ · สแปมที่ยิงเข้าตัวกลาง) โดยไม่ต้องลบ Issue
  check('★★ ป้าย hidden / spam / test = ไม่ขึ้นในโปรแกรม (แม้เป็นของผู้ดูแล แม้ติดป้าย bug)',
        B.HIDDEN_LABELS.join() === 'hidden,spam,test' && B.HIDDEN_LABELS.every((l) => !B.isReportIssue(issue({ labels: [{ name: l }, { name: 'bug' }, { name: 'from-app' }] })))
        && !B.isReportIssue(issue({ labels: [{ name: 'Hidden' }] })) && B.isReportIssue(issue({ labels: [{ name: 'from-app' }] })));
  const gate = fs.readFileSync(path.join(ROOT, '.github/workflows/issue-gate.yml'), 'utf8');
  check('★ ตัวปิดอัตโนมัติใช้รายชื่อเดียวกับโปรแกรม + ปิดแล้วล็อก',
        B.TRUSTED_AUTHORS.every((a) => gate.includes('"' + a + '"')) && /types: \[opened, reopened\]/.test(gate)
        && /state: 'closed'/.test(gate) && /issues\.lock/.test(gate) && /permissions:\s*\n\s*issues: write/.test(gate));
  check('★ ตัวปิดอัตโนมัติไม่เอาข้อความของผู้เปิดไปรัน (ไม่มี run: · ไม่แทรก title/body ลงสคริปต์)',
        !/^\s*run:/m.test(gate) && !/\$\{\{\s*github\.event\.issue\.(title|body)/.test(gate));
  check('★★ ตัวปิดอัตโนมัติปิด Issue ของคนนอกทุกกรณี (ไม่มีทางผ่านด้วยเนื้อของ Issue) · ไม่มีแบบฟอร์มวางรายงานบนเว็บ',
        !/issue\.body/.test(gate) && !/k2-report/.test(gate) && !fs.existsSync(path.join(ROOT, '.github/ISSUE_TEMPLATE/from-app.md')));

  // ── ทางที่กำหนด = อีเมล ──
  check('ที่อยู่อีเมล: รูปปกติเท่านั้น', B.isEmail('bugs@example.com') && B.isEmail(' a.b+c@mail.example.co.th ') && !B.isEmail('bugs@example') && !B.isEmail('a b@example.com')
        && !B.isEmail('a@b.com?cc=x@y.z') && !B.isEmail('a@b.com,c@d.com') && !B.isEmail('') && !B.isEmail(null));
  check('ชนิดของช่องทาง: อีเมล · ลิงก์ https · ข้อความ · ไม่มี',
        B.contactKind({ label: 'bugs@example.com', url: '' }) === 'email' && B.contactKind({ label: 'เว็บ', url: 'https://x.test' }) === 'link'
        && B.contactKind({ label: 'เว็บ', url: 'javascript:alert(1)' }) === 'text' && B.contactKind({ label: '', url: 'https://x.test' }) === '' && B.contactKind(null) === '');
  const m1 = B.buildMailto('bugs@example.com', 'Save hangs & more');
  check('★ ลิงก์อีเมล: ถึงที่อยู่เดียว · มีแค่หัวเรื่อง (คำนำหน้าชื่อโปรแกรม + หัวข้อ) · ไม่มีเนื้อ/cc',
        m1 === 'mailto:bugs@example.com?subject=' + encodeURIComponent('[Killian 2] Save hangs & more') && !/[?&](body|cc|bcc|to)=/i.test(m1), m1);
  const m2 = B.buildMailto('bugs@example.com', 'ก'.repeat(200));
  check('★ หัวข้อไทยยาว = ตัดให้ลิงก์ไม่เกินเพดาน (ยังถอดรหัสได้)', m2.length <= 1900 && (() => { try { decodeURIComponent(m2.split('?subject=')[1]); return true; } catch { return false; } })(), m2.length);
  check('ไม่มีหัวข้อ = หัวเรื่องเป็นชื่อโปรแกรมอย่างเดียว · ที่อยู่ไม่ใช่อีเมล = ไม่มีลิงก์',
        B.buildMailto('bugs@example.com', '') === 'mailto:bugs@example.com?subject=%5BKillian%202%5D' && B.buildMailto('not-an-email', 'x') === '' && B.buildMailto('a@b.com?cc=z@z.zz', 'x') === '');
  // main ยอมเปิดเฉพาะ mailto รูปที่โปรแกรมสร้าง — ดึง regex จาก main.js มารันกับลิงก์จริง
  const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const mm = /const MAILTO_OK = \/(.+)\/;/.exec(mainSrc);
  const mailOk = mm ? new RegExp(mm[1]) : null;
  check('★★ main เปิดลิงก์อีเมลที่โปรแกรมสร้างได้ แต่ไม่ยอม cc/bcc/body/หลายที่อยู่/ไฟล์',
        !!mailOk && mailOk.test(m1) && mailOk.test(m2) && mailOk.test(B.buildMailto('bugs@example.com', ''))
        && !mailOk.test('mailto:a@b.com?subject=x&cc=evil@x.com') && !mailOk.test('mailto:a@b.com?body=x') && !mailOk.test('mailto:a@b.com,c@d.com')
        && !mailOk.test('mailto:a@b.com?subject=x&attach=C:/secret') && !mailOk.test('file:///C:/x') && !mailOk.test('mailto:'),
        mm ? 'ok' : 'ไม่พบ MAILTO_OK ใน main.js');
  check('ช่องทางที่ตั้งไว้ตอนนี้: ว่าง หรืออีเมล/ลิงก์ที่ใช้ได้ (ไม่ใช่ GitHub แล้ว)',
        ['', 'email', 'link'].includes(B.contactKind(C.BUG_CONTACT)) && !/github/i.test(C.BUG_CONTACT.label + C.BUG_CONTACT.url), JSON.stringify(C.BUG_CONTACT));
  const tplCfg = fs.readFileSync(path.join(ROOT, '.github/ISSUE_TEMPLATE/config.yml'), 'utf8');
  check('หน้า New issue ไม่มีแบบฟอร์มเปล่า', /blank_issues_enabled:\s*false/.test(tplCfg) && /contact_links:/.test(tplCfg));
}

// ═══════════ แคช ═══════════
{
  const now = 1_800_000_000_000;
  check('สด: อายุน้อยกว่าเพดาน', B.cacheFresh({ ts: now - 60_000, bugs: [] }, now) === true);
  check('ไม่สด: เก่าเกิน / เวลาในอนาคต / รูปผิด', !B.cacheFresh({ ts: now - 6 * 60_000, bugs: [] }, now) && !B.cacheFresh({ ts: now + 5000, bugs: [] }, now)
        && !B.cacheFresh(null, now) && !B.cacheFresh({ ts: now }, now));
  const c = B.parseCache(JSON.stringify({ ts: now, bugs: [
    { num: 9, title: 't', status: 'fixed', foundIn: 'alpha.1', reported: '2026-01-01', fixedIn: 'alpha.2', url: 'https://evil.example/x' },
    { num: 'x', title: 'bad', status: 'fixed' }, { num: 8, title: 'bad status', status: 'hacked' }, null] }));
  check('แคช: ชนิดของแถว (ของรุ่นก่อนไม่มีช่องนี้ = บั๊ก · ค่าแปลก = บั๊ก)',
        c.bugs[0].kind === 'bug' && B.parseCache(JSON.stringify({ ts: now, bugs: [{ num: 1, status: 'new', kind: 'feature' }, { num: 2, status: 'new', kind: 'x' }] })).bugs.map((b) => b.kind).join() === 'feature,bug');
  check('★ อ่านแคช: แถวเสียถูกทิ้ง · ลิงก์ประกอบใหม่จากเลข (ไม่เชื่อที่เก็บไว้)', c && c.bugs.length === 1 && c.bugs[0].url === B.bugUrl(9) && c.bugs[0].id === '#9');
  check('แคชรูปผิด = null', B.parseCache('nope') === null && B.parseCache('{"ts":"a","bugs":[]}') === null && B.parseCache('{"ts":1}') === null && B.parseCache('') === null);
}

// ═══════════ ภาษา — ครบทุกไฟล์ ไม่ฮาร์ดโค้ด ═══════════
{
  const uiSrc = fs.readFileSync(path.join(ROOT, 'src/bugs/bug-ui.js'), 'utf8');
  const coreSrc = fs.readFileSync(path.join(ROOT, 'src/bugs/bug-core.js'), 'utf8');
  const keys = new Set([...Object.values(B.BUG_STATUS_KEYS), ...Object.values(B.FEATURE_STATUS_KEYS)]);
  for (const m of stripComments(uiSrc).matchAll(/'(ui\.[\w.-]+)'/g)) keys.add(m[1]);
  for (const k of ['ui.sb.bugReport', 'ui.about.bugReport', 'ui.about.bugStatus', 'ui.menu.bugReport', 'ui.menu.bugStatus', 'ui.tip.bug-report', 'ui.tip.bug-status',
                   'ui.menu.featureRequest', 'ui.tip.feature-request']) keys.add(k);
  check('โมดูลใช้คีย์ภาษาอย่างน้อย 55 คีย์', keys.size >= 55, keys.size);
  const dir = path.join(ROOT, 'languages');
  const files = fs.readdirSync(dir).filter((f) => /^k2_.+\.csv$/.test(f));
  check('มีไฟล์ภาษาอย่างน้อย 2 ไฟล์', files.length >= 2, files.length);
  const th = lexCsv(fs.readFileSync(path.join(dir, 'k2_th.csv'), 'utf8'));
  for (const f of files) {
    const tbl = lexCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
    const miss = [...keys].filter((k) => !tbl[k] || !String(tbl[k]).trim());
    check(`${f}: ★★ คีย์ของรายงาน/สถานะบั๊กครบทุกคีย์`, miss.length === 0, miss.slice(0, 6).join(' · '));
    // ภาษาอื่นต้องเป็นคำแปลจริง — ห้ามเป็นข้อความไทยที่ใส่ไว้ก่อน
    if (f !== 'k2_th.csv') {
      const thai = [...keys].filter((k) => /[฀-๿]/.test(String(tbl[k] || '')));
      check(`${f}: ★ ไม่มีข้อความไทยค้างในคีย์ของบั๊ก`, thai.length === 0, thai.slice(0, 6).join(' · '));
    }
    // ที่แทรกค่าตรงกับภาษาไทยทุกคีย์
    const ph = (s) => [...new Set([...String(s || '').matchAll(/\{(\d+)/g)].map((m) => m[1]))].sort().join();
    const bad = [...keys].filter((k) => ph(tbl[k]) !== ph(th[k]));
    check(`${f}: ที่แทรกค่า ({0},{1}) ตรงกับภาษาไทย`, bad.length === 0, bad.join(' · '));
  }
  check('★★ โค้ดของโมดูลบั๊กไม่มีข้อความไทย (นอกคอมเมนต์)', !/[฀-๿]/.test(stripComments(uiSrc)) && !/[฀-๿]/.test(stripComments(coreSrc)));
  check('คอลัมน์ของตาราง = หกคอลัมน์ตามลำดับที่ผู้ใช้กำหนด',
        [...uiSrc.matchAll(/\{ key: '(\w+)',\s+label: '(ui\.bug\.col\w+)' \}/g)].map((m) => m[1]).join() === 'id,title,status,foundIn,reported,fixedIn');
}

// ═══════════ ทางเข้า — ปุ่มแถบสถานะ · เกี่ยวกับ · เมนู · คำสั่ง ═══════════
{
  const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
  const cmds = fs.readFileSync(path.join(ROOT, 'icons/commands.csv'), 'utf8');
  check('คำสั่ง bug-report / bug-status อยู่ใน handleCommand', /case 'bug-report': openBugReport\(\); break;/.test(app) && /case 'bug-status': openBugStatus\(\); break;/.test(app));
  check('★ ปุ่มรายงานบั๊กอยู่ถัดจากปุ่มหน้าแรกบนแถบสถานะ',
        /id="status-home"[^>]*><\/button>\s*(?:<!--[\s\S]*?-->\s*)?<button id="status-bug"/.test(html));
  check('★ กล่อง "เกี่ยวกับ" มีทั้งรายงานบั๊กและสถานะบั๊ก',
        /k-about-bug-report'[^\n]*ui\.about\.bugReport/.test(app) && /k-about-bug-status'[^\n]*ui\.about\.bugStatus/.test(app)
        && /handleCommand\('bug-report'\)/.test(app) && /handleCommand\('bug-status'\)/.test(app));
  check('★★ ขอฟีเจอร์: คำสั่ง feature-request เปิดกล่องเดียวกันในโหมดขอฟีเจอร์ · อยู่ในเมนูช่วยเหลือและทะเบียนคำสั่ง',
        /case 'feature-request': openBugReport\(\{ kind: 'feature' \}\); break;/.test(app) && /click: cmd\('feature-request'\)/.test(main)
        && /(^|\n)feature-request,[a-z-]+,/.test(cmds));
  check('เมนูช่วยเหลือมีสองรายการ (ผ่าน cmd())', /click: cmd\('bug-report'\)/.test(main) && /click: cmd\('bug-status'\)/.test(main));
  const uiSrc2 = stripComments(fs.readFileSync(path.join(ROOT, 'src/bugs/bug-ui.js'), 'utf8'));
  check('★★ กล่องรายงานส่งผ่านตัวกลาง (io.post) — ไม่เปิดหน้าเขียน Issue ในเบราว์เซอร์',
        /await io\.post\(req\.url, req\.options\)/.test(uiSrc2) && /buildRelayRequest\(/.test(uiSrc2) && !/issues\/new/.test(uiSrc2));
  check('★ ส่งไม่สำเร็จ = ร่างไม่ถูกล้าง (ล้างเฉพาะหลังตัวกลางตอบเลขบั๊ก)',
        uiSrc2.indexOf('saveDraft(null)') > uiSrc2.indexOf("log('info', 'bug: report sent'") && uiSrc2.split('saveDraft(null)').length === 2);
  check('ทะเบียนคำสั่งมีสองแถวพร้อมไอคอน', /(^|\n)bug-report,bug,/.test(cmds) && /(^|\n)bug-status,bug-check,/.test(cmds));
}

console.log(`\nbug-core: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
