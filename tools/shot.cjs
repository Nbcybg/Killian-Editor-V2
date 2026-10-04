#!/usr/bin/env node
// tools/shot.cjs — ถ่ายภาพหน้าจอของโปรแกรมจริงเพื่อตรวจ UI (นักพัฒนาใช้ ไม่ใช่ e2e)
//
//   node test/fixture.js /tmp/k2proj
//   xvfb-run -a --server-args="-screen 0 1500x950x24" node tools/shot.cjs /tmp/k2proj <โฟลเดอร์ภาพ> <สคริปต์.cjs>
//   (ต้องมี playwright — ไม่อยู่ใน dependencies ของโปรเจกต์: ติดตั้งทั่วเครื่องแล้วชี้ด้วย NODE_PATH=$(npm root -g))
//
// <สคริปต์.cjs> = module.exports = async ({ page, shot, dev, wait }) => { … }
//   dev(fn, arg)  เรียก fn(window.__k2dev, arg) ในหน้าต่าง (loadProject · handleCommand · state · resetPanels)
//   shot(name)    บันทึก <โฟลเดอร์ภาพ>/<name>.png
// เปิดด้วย KILLIAN_TEST=1 + KILLIAN_TEST_NORUN=1 (โหมดเทสแต่ไม่รันชุด e2e) · userData แยกไว้ใน /tmp
const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright');

(async () => {
  const [proj, outDir, script] = process.argv.slice(2);
  if (!proj || !outDir || !script) { console.error('usage: shot.cjs <project> <outdir> <script.cjs>'); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });
  const root = path.join(__dirname, '..');
  const exe = require(path.join(root, 'node_modules', 'electron'));
  const app = await electron.launch({
    executablePath: exe,
    args: [root, '--no-sandbox', '--disable-gpu'],
    env: { ...process.env, KILLIAN_TEST: '1', KILLIAN_TEST_NORUN: '1', KILLIAN_NO_SPLASH: '1',
           KILLIAN_USERDATA: path.join(os.tmpdir(), 'k2shot-userdata') },
  });
  const page = await app.firstWindow();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.waitForFunction(() => !!window.__k2dev, null, { timeout: 30000 });
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const dev = (fn, arg) => page.evaluate(([src, a]) => (0, eval)('(' + src + ')')(window.__k2dev, a), [fn.toString(), arg]);
  const shot = async (name) => { await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('shot', name); };
  await dev(async (d, p) => { await d.loadProject(p); d.resetPanels(); }, proj);
  await wait(800);
  try { await require(path.resolve(script))({ page, shot, dev, wait, app }); }
  catch (e) { console.error('script error:', e); }
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
