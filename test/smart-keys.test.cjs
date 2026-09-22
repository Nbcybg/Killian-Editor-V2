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
// ── [alpha.160 · P1-13] แยกจอ: รายการคำเดาต้องแทรกลงเอกสาร "ที่พิมพ์อยู่" ไม่ใช่ตัวที่ bindView ไว้ล่าสุด ──
{
  function fakeView(text) {
    const v = { ins: [], dispatched: 0, focus() {}, coordsAtPos: () => ({ left: 0, top: 0, bottom: 0 }) };
    const tr = { insertText(n, a, b) { v.ins.push([n, a, b]); return tr; } };
    const parent = { isTextblock: true, textBetween: (a, b) => text.slice(a, b) };
    v.state = { selection: { empty: true, from: text.length + 1, $from: { parent, parentOffset: text.length } }, tr };
    v.dispatch = () => { v.dispatched++; };
    return v;
  }
  const A = fakeView('ข้อความแผงซ้าย'), B = fakeView('แล้วทอ');
  const st = Object.create(SmartType.prototype);
  Object.assign(st, { items: [], sel: 0, box: { style: {} }, render() {}, place() {}, hide() { this.items = []; } });
  st.bindView(A);                                   // แท็บที่ active ตามระบบ = แผงซ้าย
  st._check(B, ['ทอร่า'], {});                       // แต่ผู้ใช้พิมพ์อยู่ในแผงขวา
  check('[160-P1-13] เดาคำจากแผงที่พิมพ์อยู่', st.items.join() === 'ทอร่า', st.items.join());
  st._accept();
  check('[160-P1-13] ★★ กด Tab แล้วคำลงแผงที่พิมพ์อยู่ (B) — ไม่ลงแผงที่ bindView ไว้ (A)',
        B.dispatched === 1 && A.dispatched === 0 && B.ins[0][0] === 'ทอร่า', JSON.stringify([A.dispatched, B.dispatched]));
}
console.log(`\nsmart-keys: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
