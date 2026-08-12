// test/ai-tools.test.cjs — [alpha.63r4] โปรโตคอลคำสั่งที่ AI สั่งให้แอปลงมือทำ
// [alpha.77] t() ไม่ตกกลับภาษาอื่น — ต้องมีตารางคำแปลจริงก่อน require บันเดิลที่ esbuild สร้าง
require('./_lang.cjs').installLang('th');
// คุมจุดที่พลาดแล้วอันตราย: แกะคำสั่งผิด · โหมดอ่านอย่างเดียวหลุดไปเขียนไฟล์ · ลบโดยไม่ผ่านการตรวจ
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), 'k2-aitools-test.cjs');
require('esbuild').buildSync({
  entryPoints: [path.join(__dirname, '../src/ai/ai-tools.js')],
  outfile: out, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const T = require(out);

const outS = path.join(os.tmpdir(), 'k2-aisession-test.cjs');
require('esbuild').buildSync({
  entryPoints: [path.join(__dirname, '../src/ai/ai-session.js')],
  outfile: outS, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const S = require(outS);

let pass = 0, fail = 0;
const check = (n, c, extra) => {
  if (c) { pass++; } else { fail++; console.log('FAIL ' + n + (extra !== undefined ? ' | ' + extra : '')); }
};

// ═══════════ แกะคำสั่งจากคำตอบของโมเดล ═══════════
{
  const text = [
    'ได้เลย เดี๋ยวผมเขียนต่อให้',
    '```k2',
    '{"tool":"scene.write","args":{"title":"ฉากแรก","mode":"append","text":"เนื้อหา"}}',
    '```',
    'แล้วก็สร้างตัวละครใหม่ด้วย',
    '```k2',
    '{"tool":"entity.create","args":{"cat":"characters","name":"โทระ"}}',
    '```',
  ].join('\n');
  const calls = T.parseToolCalls(text);
  check('แกะได้ครบทุกบล็อก', calls.length === 2, calls.length);
  check('อ่านชื่อคำสั่งถูก', calls[0].tool === 'scene.write' && calls[1].tool === 'entity.create');
  check('อ่านอาร์กิวเมนต์ถูก', calls[0].args.title === 'ฉากแรก' && calls[0].args.mode === 'append');
  const stripped = T.stripToolCalls(text);
  check('stripToolCalls เอาบล็อกออกหมด', !stripped.includes('scene.write') && !stripped.includes('```'));
  check('stripToolCalls เก็บข้อความคนอ่านไว้', stripped.includes('ได้เลย') && stripped.includes('สร้างตัวละครใหม่'));
}
{
  const calls = T.parseToolCalls('```k2\n[{"tool":"project.tree"},{"tool":"entity.read","args":{"name":"ก"}}]\n```');
  check('บล็อกเดียวสั่งหลายคำสั่งเป็น array ได้', calls.length === 2 && calls[1].args.name === 'ก');
}
{
  const calls = T.parseToolCalls('```k2\n{ไม่ใช่ json}\n```');
  check('JSON พังใน k2 → รายงานเป็น error ไม่ใช่เงียบ', calls.length === 1 && !!calls[0].error);
}
{
  // ```json ที่เป็นตัวอย่างข้อมูลเฉย ๆ ต้องไม่ถูกนับเป็นคำสั่ง
  const calls = T.parseToolCalls('ตัวอย่างข้อมูล:\n```json\n{"name":"โทระ","age":17}\n```');
  check('บล็อก json ธรรมดาไม่ถูกนับเป็นคำสั่ง', calls.length === 0, JSON.stringify(calls));
  const calls2 = T.parseToolCalls('```json\n{"tool":"project.tree","args":{}}\n```');
  check('บล็อก json ที่เป็นคำสั่งจริงยังใช้ได้', calls2.length === 1 && calls2[0].tool === 'project.tree');
  const calls3 = T.parseToolCalls('```json\n{"tool":"ไม่มีคำสั่งนี้"}\n```');
  check('บล็อก json ที่ tool ไม่มีจริง → เมิน', calls3.length === 0);
}
{
  check('ไม่มีบล็อกเลย → ไม่มีคำสั่ง', T.parseToolCalls('คุยเฉย ๆ ไม่สั่งอะไร').length === 0);
  check('ข้อความว่างไม่พัง', T.parseToolCalls('').length === 0 && T.parseToolCalls(null).length === 0);
}

// ═══════════ สิทธิ์ตามโหมด ═══════════
{
  check('read < write < full', T.capAllows('full', 'write') && T.capAllows('write', 'read')
    && !T.capAllows('read', 'write') && !T.capAllows('write', 'full'));

  const write = { tool: 'scene.write', args: { title: 'ฉาก', text: 'x' } };
  check('โหมดอ่านอย่างเดียวเขียนไฟล์ไม่ได้', !T.validateCall(write, 'read').ok);
  check('โหมดช่วยเขียนเขียนได้', T.validateCall(write, 'write').ok);

  const del = { tool: 'scene.delete', args: { title: 'ฉาก' } };
  check('โหมดช่วยเขียนลบไม่ได้', !T.validateCall(del, 'write').ok);
  check('โหมดปลดล็อกเต็มที่ลบได้', T.validateCall(del, 'full').ok);
}
{
  check('ขาดอาร์กิวเมนต์ที่จำเป็น → ไม่ผ่าน',
    !T.validateCall({ tool: 'scene.write', args: { title: 'ฉาก' } }, 'full').ok);
  check('อาร์กิวเมนต์เป็นช่องว่างล้วนถือว่าขาด',
    !T.validateCall({ tool: 'entity.create', args: { cat: 'characters', name: '   ' } }, 'full').ok);
  check('คำสั่งที่ไม่รู้จัก → ไม่ผ่าน', !T.validateCall({ tool: 'rm -rf', args: {} }, 'full').ok);
  check('คำสั่งที่แกะไม่ออก → ไม่ผ่าน', !T.validateCall({ tool: '', args: {}, error: 'พัง' }, 'full').ok);
}
{
  const dels = [{ tool: 'scene.create', args: {} }, { tool: 'book.delete', args: { title: 'ก' } }];
  check('hasDestructive จับคำสั่งลบเจอ', T.hasDestructive(dels));
  check('hasDestructive ไม่ตื่นตูม', !T.hasDestructive([{ tool: 'scene.create', args: {} }]));
}

// ═══════════ system prompt ═══════════
{
  const readP = T.toolsSystemPrompt('read');
  const fullP = T.toolsSystemPrompt('full');
  check('prompt โหมดอ่านไม่โฆษณาคำสั่งเขียน', !readP.includes('scene.write') && readP.includes('scene.read'));
  check('prompt โหมดเต็มมีคำสั่งลบ', fullP.includes('scene.delete') && fullP.includes('book.delete'));
  check('prompt บอกรูปแบบบล็อก k2', readP.includes('```k2'));
  check('toolsFor นับตามสิทธิ์', T.toolsFor('read').length < T.toolsFor('write').length
    && T.toolsFor('write').length < T.toolsFor('full').length);
}

// ═══════════ คำอธิบายที่มนุษย์อ่าน (ใช้ในกล่องยืนยัน — ห้ามว่าง) ═══════════
{
  for (const t of T.TOOLS) {
    const args = {};
    for (const k of t.need) args[k] = 'ค่า-' + k;
    const d = T.describeCall({ tool: t.name, args });
    check('describeCall มีข้อความสำหรับ ' + t.name, typeof d === 'string' && d.length > 0 && d !== t.name, d);
  }
}

// ═══════════ ผลคำสั่งที่ป้อนกลับให้โมเดล ═══════════
{
  const msg = T.resultsMessage([
    { tool: 'scene.write', ok: true, message: 'เขียนต่อแล้ว' },
    { tool: 'scene.delete', ok: false, error: 'ไม่พบฉาก' },
  ]);
  check('resultsMessage บอกทั้งสำเร็จและล้มเหลว',
    msg.includes('สำเร็จ') && msg.includes('ล้มเหลว') && msg.includes('ไม่พบฉาก'));
  const big = T.resultsMessage([{ tool: 'scene.read', ok: true, data: 'ก'.repeat(20000) }]);
  check('resultsMessage ตัดข้อมูลยาวไม่ให้ระเบิดบริบท', big.length < 9000, big.length);
}

// ═══════════ โหมดแชท ↔ สิทธิ์ ═══════════
{
  check('โหมด plan = อ่านอย่างเดียว', S.modeCap('plan') === 'read');
  check('โหมด write = เขียนได้', S.modeCap('write') === 'write');
  check('โหมด agent = เต็มที่', S.modeCap('agent') === 'full');
  check('โหมดที่ไม่รู้จักตกไปที่อ่านอย่างเดียว', S.modeCap('มั่ว') === 'read');
  check('มีครบ 3 โหมด', S.CHAT_MODES.length === 3);
}

// ═══════════ เซสชัน: บันทึกเมื่อเริ่มคุย + หัวข้อ ═══════════
{
  const s = S.newSession();
  check('เซสชันใหม่ยังไม่มีบทสนทนา', !S.hasConversation(s));
  const s2 = S.addMessage(s, S.newMessage('user', 'ช่วยเขียนฉากเปิดเรื่องให้หน่อย'));
  check('มีข้อความแล้วถือว่าเริ่มคุย', S.hasConversation(s2));
  check('หัวข้อถูกตั้งจากข้อความแรก', s2.title === 'ช่วยเขียนฉากเปิดเรื่องให้หน่อย', s2.title);
}
{
  // ผลคำสั่งที่ป้อนกลับให้โมเดลก็ role user — ห้ามแย่งไปเป็นชื่อเซสชัน
  const s = S.addMessage(S.newSession(), S.newMessage('user', 'ผลของคำสั่ง…', { toolResult: true }));
  check('ผลคำสั่งไม่ถูกเอาไปตั้งเป็นชื่อเซสชัน', s.title === 'เซสชันใหม่', s.title);
}
{
  // บั๊กเดิม: newSession() ไม่ขน titleSet กลับมา ชื่อที่ผู้ใช้ตั้งเองเลยโดนทับหลังเปิดโปรแกรมใหม่
  const named = S.renameSession(S.newSession(), 'ชื่อที่ตั้งเอง');
  check('renameSession ติดธง titleSet', named.titleSet === true);
  const reloaded = S.newSession(JSON.parse(JSON.stringify(named)));
  check('โหลดกลับจากไฟล์แล้ว titleSet ยังอยู่', reloaded.titleSet === true);
  const after = S.addMessage(reloaded, S.newMessage('user', 'ข้อความใหม่ที่ไม่ควรกลายเป็นชื่อ'));
  check('ชื่อที่ผู้ใช้ตั้งเองไม่ถูกทับ', after.title === 'ชื่อที่ตั้งเอง', after.title);
  const cleared = S.clearMessages(reloaded);
  check('กด "เริ่มใหม่" แล้วชื่อที่ตั้งเองยังอยู่', cleared.title === 'ชื่อที่ตั้งเอง', cleared.title);
}
{
  const auto = S.addMessage(S.newSession(), S.newMessage('user', 'คำถามแรก'));
  check('ชื่ออัตโนมัติถูกคืนค่าเมื่อกดเริ่มใหม่', S.clearMessages(auto).title === 'เซสชันใหม่');
}
{
  const s = S.newSession();
  check('ค่าเริ่มต้น: มุมมองปกติ', s.view === 'normal');
  check('ค่าเริ่มต้น: ทำเองได้', s.autoRun === true);
  check('ค่าเริ่มต้น: ถามก่อนลบ', s.confirmDestructive === true);
  check('ปิดการถามก่อนลบแล้วขนกลับมาได้',
    S.newSession({ ...s, confirmDestructive: false }).confirmDestructive === false);
  check('มุมมอง 4 แบบครบ', S.TRANSCRIPT_VIEWS.length === 4
    && S.TRANSCRIPT_VIEWS.map((v) => v.id).join() === 'normal,thinking,verbose,summary');
  check('viewDef ตกไปที่ปกติเมื่อไม่รู้จัก', S.viewDef('มั่ว').id === 'normal');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
