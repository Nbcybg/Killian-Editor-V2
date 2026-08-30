// test/ai-hub.test.cjs — [alpha.116 ข้อ 3] ทะเบียนของแผง AI Hub
//
// Hub ไม่มีตรรกะของตัวเอง มันแค่ "ชี้ไปคำสั่งที่มีอยู่แล้ว" — ความผิดพลาดที่เป็นไปได้จริง
// จึงมีอยู่สองแบบ และทั้งคู่มองไม่เห็นด้วยตาจนกว่าจะกดปุ่มนั้น:
//   1. ชี้ไปคำสั่งที่ไม่มีใน `handleCommand` → กดแล้วเงียบ
//   2. ชี้ไปแผงที่ไม่มีใน `PANEL_DEFS` → ป้าย "เปิดอยู่" ไม่มีวันขึ้น
// เทสนี้อ่านซอร์สจริงของทั้งสองที่มาเทียบ
require('./_lang.cjs').installLang('th');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const out = path.join(require('os').tmpdir(), '_aihubdef.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/ai/ai-hub-def.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const H = require(out);

// panel-ui.js ลากเอา core.js (ซึ่งสร้าง SmartType ที่แตะ DOM ตอน import) เข้ามาด้วย →
// บน node ต้องมีของปลอมพอให้ผ่าน · ตัวทะเบียนแผงเองไม่แตะ DOM เลย จึงอ่านได้ตรง ๆ หลังใส่ stub
// (ท่าเดียวกับ test/shortcuts.test.cjs)
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {}, append() {}, remove() {}, setAttribute() {}, addEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], firstChild: null, dataset: {} });
globalThis.document = { createElement: stubEl, body: stubEl(), documentElement: stubEl(),
  addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
globalThis.window = { addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
globalThis.localStorage = globalThis.window.localStorage;

const outPanel = path.join(require('os').tmpdir(), '_aihubpanels.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/panels/panel-ui.js')],
  outfile: outPanel, format: 'cjs', bundle: true, logLevel: 'silent' });
const P = require(outPanel);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ โครงทะเบียน ═══════════
{
  check('มีความสามารถอย่างน้อย 10 ตัว', H.AI_HUB_ITEMS.length >= 10, H.AI_HUB_ITEMS.length);
  check('id ไม่ซ้ำ', new Set(H.AI_HUB_ITEMS.map((x) => x.id)).size === H.AI_HUB_ITEMS.length);
  check('ทุกตัวมีคำสั่ง', H.AI_HUB_ITEMS.every((x) => typeof x.cmd === 'string' && x.cmd));
  check('ทุกตัวอยู่ในกลุ่มที่ประกาศไว้',
        H.AI_HUB_ITEMS.every((x) => H.AI_HUB_GROUPS.some((g) => g.key === x.group)),
        H.AI_HUB_ITEMS.filter((x) => !H.AI_HUB_GROUPS.some((g) => g.key === x.group))
          .map((x) => x.id).join(','));
  check('ทุกกลุ่มมีของอย่างน้อยหนึ่งชิ้น (ไม่มีหัวข้อว่าง)',
        H.AI_HUB_GROUPS.every((g) => H.aiHubItemsOf(g.key).length > 0),
        H.AI_HUB_GROUPS.filter((g) => !H.aiHubItemsOf(g.key).length).map((g) => g.key).join(','));
  check('ชื่อ/คำอธิบายเป็นคำแปลจริง ไม่ใช่ตัวคีย์',
        H.AI_HUB_ITEMS.every((x) => x.label && x.desc && !x.label.startsWith('ui.')
                                 && !x.desc.startsWith('ui.')),
        H.AI_HUB_ITEMS.filter((x) => !x.label || x.label.startsWith('ui.')).map((x) => x.id).join(','));
  check('ชื่อกลุ่มเป็นคำแปลจริง',
        H.AI_HUB_GROUPS.every((g) => g.label && !g.label.startsWith('ui.')));
  check('aiHubItem หาเจอ', H.aiHubItem('chat') && H.aiHubItem('chat').cmd === 'ai-chat-toggle');
  check('aiHubItem ไม่เจอ → null', H.aiHubItem('ไม่มีตัวนี้') === null);
}

// ═══════════ ★ ทุกคำสั่งต้องมีจริงใน handleCommand ═══════════
{
  const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const cases = new Set();
  const RE = /case\s+'([^']+)'\s*:/g;
  let m;
  while ((m = RE.exec(app))) cases.add(m[1]);
  const ghost = [...new Set(H.AI_HUB_ITEMS.map((x) => x.cmd))].filter((c) => !cases.has(c));
  check('★ ทุกการ์ดชี้ไปคำสั่งที่มีจริงใน handleCommand', ghost.length === 0, ghost.join(' · '));
}

// ═══════════ ★ แผงที่อ้างต้องมีจริง ═══════════
{
  const panels = new Set(P.PANEL_DEFS.map((d) => d.id));
  const ghost = H.AI_HUB_ITEMS.filter((x) => x.panel && !panels.has(x.panel)).map((x) => x.panel);
  check('★ ทุกการ์ดที่อ้างแผง อ้างแผงที่มีจริง', ghost.length === 0, ghost.join(' · '));
  check('แผง ai-hub เองมีอยู่ในทะเบียนแผงแล้ว', panels.has('ai-hub'));
  const hub = P.PANEL_DEFS.find((d) => d.id === 'ai-hub');
  check('แผง ai-hub ผูกกับ element ใน index.html', hub && hub.adopt === '#ai-hub-panel');
  const html = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
  check('index.html มี element เจ้าบ้านของ Hub จริง',
        html.includes('id="ai-hub-panel"') && html.includes('id="ai-hub-body"'));
  // Hub ยิงเข้า handleCommand ของหน้าต่างหลัก → ฉีกออกไปหน้าต่างแยกไม่ได้
  check('Hub ไม่ถูกใส่ในรายการแผงที่ฉีกออกเป็นหน้าต่างได้', !P.TEAROFF_PANELS.has('ai-hub'));
}

// ═══════════ ข้อความสถานะที่หัวแผง ═══════════
{
  const warn = H.hubStatus({ configured: false, why: 'ยังไม่ได้ใส่คีย์' });
  check('ยังตั้งค่าไม่ครบ → เตือน พร้อมบอกเหตุผลจริง',
        warn.tone === 'warn' && warn.text === 'ยังไม่ได้ใส่คีย์', JSON.stringify(warn));
  check('ไม่มีเหตุผล → ยังต้องมีข้อความ ไม่ใช่ค่าว่าง',
        H.hubStatus({ configured: false }).text.length > 0);
  const ok = H.hubStatus({ configured: true, providerName: 'OpenRouter', model: 'x/y' });
  check('ตั้งค่าครบ → บอกเจ้าและรุ่น',
        ok.tone === 'ok' && ok.text === 'OpenRouter · x/y', JSON.stringify(ok));
  check('ครบแต่ไม่มีรุ่น → บอกแค่ชื่อเจ้า',
        H.hubStatus({ configured: true, providerName: 'Ollama' }).text === 'Ollama');
  // ★ "ok แต่ไม่รู้ว่าใคร" = ยังใช้ไม่ได้จริง ห้ามขึ้นไฟเขียว
  check('★ ครบแต่ไม่รู้ว่าเจ้าไหน → ยังถือว่าเตือน',
        H.hubStatus({ configured: true }).tone === 'warn');
  check('ไม่ส่งอะไรมาเลยก็ไม่พัง', typeof H.hubStatus().text === 'string');
}

console.log(`ai-hub: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
