// test/smart-keys.test.cjs — [alpha.159 · M14] รายการคำเดา (SmartType) ต้องไม่แย่งปุ่มที่มีตัวกดร่วม
// Ctrl/⌘+Tab · Ctrl+↑/↓ = สลับ element ของบท · Shift+Tab = ถอย element — เดิมรายการเดายืนยันคำทับหมด
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-smart-keys.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'src', 'smart.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
const { SmartType } = require(tmp);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
function fake() {
  const f = { visible: true, items: ['ทอร่า', 'ทอม'], sel: 0, accepted: 0, hidden: 0,
              _accept() { this.accepted++; }, render() {}, hide() { this.hidden++; this.visible = false; } };
  return f;
}
const key = (k, m = {}) => ({ key: k, ctrlKey: !!m.ctrl, metaKey: !!m.meta, altKey: !!m.alt, shiftKey: !!m.shift });
const on = (f, ev) => SmartType.prototype.onKey.call(f, ev);

{ const f = fake(); check('Tab เปล่า = ยืนยันคำเดา', on(f, key('Tab')) === true && f.accepted === 1); }
{ const f = fake(); check('★ Ctrl+Tab ไม่ยืนยันคำ (ปล่อยให้สลับ element)', on(f, key('Tab', { ctrl: true })) === false && f.accepted === 0); }
{ const f = fake(); check('★ ⌘+Tab ไม่ยืนยันคำ', on(f, key('Tab', { meta: true })) === false && f.accepted === 0); }
{ const f = fake(); check('★ Alt+Tab ไม่ยืนยันคำ', on(f, key('Tab', { alt: true })) === false && f.accepted === 0); }
{ const f = fake(); check('★ Shift+Tab ไม่ยืนยันคำ (ถอย element)', on(f, key('Tab', { shift: true })) === false && f.accepted === 0); }
{ const f = fake(); check('↓ เปล่า = เลื่อนแถบเลือก', on(f, key('ArrowDown')) === true && f.sel === 1); }
{ const f = fake(); check('★ Ctrl+↓ ไม่ไปเลื่อนแถบเลือก', on(f, key('ArrowDown', { ctrl: true })) === false && f.sel === 0); }
{ const f = fake(); check('★ Ctrl+↑ ไม่ไปเลื่อนแถบเลือก', on(f, key('ArrowUp', { ctrl: true })) === false && f.sel === 0); }
{ const f = fake(); check('Enter = ปิดรายการแล้วปล่อยให้ขึ้นบรรทัด', on(f, key('Enter')) === false && f.hidden === 1); }
{ const f = fake(); f.visible = false; check('รายการไม่โผล่ = ไม่ยุ่งกับปุ่มไหนเลย', on(f, key('Tab')) === false && f.accepted === 0); }
console.log(`\nsmart-keys: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
