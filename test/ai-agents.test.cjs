// test/ai-agents.test.cjs — System prompt ของผู้ใช้ · ทะเบียน Agent · prompt ของ Rewrite this (src/ai/ai-agents.js)
const path = require('path');
const os = require('os');
const out = path.join(os.tmpdir(), 'k2-ai-agents-test.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/ai/ai-agents.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const A = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ── System prompt ของผู้ใช้ ──
{
  check('ไม่ตั้ง = ไม่แตะ system เลย', A.withUserSystem('SYS', {}) === 'SYS');
  check('ช่องว่างล้วน = ไม่ตั้ง', A.withUserSystem('SYS', { systemPrompt: '  \n ' }) === 'SYS');
  check('★ ตั้งไว้ = วางนำหน้า system ของฟีเจอร์', A.withUserSystem('SYS', { systemPrompt: 'USER' }) === 'USER\n\nSYS');
  check('system ของฟีเจอร์ว่าง = เหลือของผู้ใช้ล้วน', A.withUserSystem('', { systemPrompt: 'USER' }) === 'USER');
  check('undefined system ไม่กลายเป็นคำว่า "undefined"', A.withUserSystem(undefined, { systemPrompt: 'U' }) === 'U');
  check('★ ปิดสวิตช์ = ไม่ส่ง', A.withUserSystem('SYS', { systemPrompt: 'USER', systemPromptOn: false }) === 'SYS');
  check('ไม่มีธง = ถือว่าเปิด (ค่าเริ่มต้น)', A.userSystemPrompt({ systemPrompt: 'X' }) === 'X');
  const twice = A.withUserSystem(A.withUserSystem('SYS', { systemPrompt: 'USER' }), { systemPrompt: 'USER' });
  check('★ ผ่านสองชั้น (callAI → complete) ไม่ต่อซ้ำ', twice === 'USER\n\nSYS', twice);
  check('ai = null ไม่พัง', A.withUserSystem('S', null) === 'S');
}

// ── ทะเบียน Agent ──
{
  const a = A.newAgent({ name: '  นักเขียนมืด ', persona: 'โทนมืด', refs: [
    { kind: 'text', name: 'ตัวอย่าง', text: 'สำนวน' },
    { kind: 'text', text: '   ' },                       // ว่าง = ตัดทิ้ง
    { kind: 'file', path: 'References/a.txt' },
    { kind: 'file', path: '' },                          // ไม่มี path = ตัดทิ้ง
  ] });
  check('ชื่อถูกตัดช่องว่าง', a.name === 'นักเขียนมืด');
  check('มี id', /^agent-/.test(a.id));
  check('★ อ้างอิงว่างถูกตัดทิ้ง', a.refs.length === 2, JSON.stringify(a.refs));
  check('อ้างอิงไฟล์ไม่เก็บ text · อ้างอิงพิมพ์ไม่เก็บ path',
        a.refs[1].text === '' && a.refs[0].path === '');
  check('validate: ไม่มีชื่อ = ผิด', A.validateAgent(A.newAgent({})).includes('name'));
  check('validate: มีชื่อ = ผ่าน', A.validateAgent(a).length === 0);

  let rows = A.upsertAgent([], a);
  const b = A.newAgent({ name: 'B' });
  rows = A.upsertAgent(rows, b);
  check('upsert เพิ่มท้าย', rows.length === 2 && rows[1].id === b.id);
  rows = A.upsertAgent(rows, { ...a, name: 'ใหม่' });
  check('★ upsert id เดิม = แก้ที่เดิม ไม่เพิ่มแถว', rows.length === 2 && rows[0].name === 'ใหม่');
  const moved = A.moveAgent(rows, b.id, -1);
  check('moveAgent ขึ้น', moved[0].id === b.id && moved[1].id === a.id);
  check('moveAgent เกินขอบ = เหมือนเดิม', A.moveAgent(rows, a.id, -1)[0].id === a.id);
  check('removeAgent', A.removeAgent(rows, a.id).length === 1);
  check('listAgents ข้ามแถวเสีย', A.listAgents({ agents: [null, { name: 'x' }, { id: 'k', name: 'K' }] }).length === 1);
  check('listAgents ไม่มีทะเบียน = []', A.listAgents({}).length === 0 && A.listAgents(null).length === 0);
}

// ── ชื่อไฟล์อ้างอิง ──
{
  check('ตัด path ทิ้ง', A.safeRefFileName('/a/b/สำนวน.txt') === 'สำนวน.txt');
  check('Windows path', A.safeRefFileName('C:\\x\\y.txt') === 'y.txt');
  check('★ บังคับ .txt', A.safeRefFileName('notes.md') === 'notes.txt');
  check('อักขระต้องห้าม', !/[<>:"|?*]/.test(A.safeRefFileName('a<b>:c?.txt')));
  check('ชื่อว่าง', A.safeRefFileName('') === 'reference.txt');
}

// ── รวมข้อความอ้างอิงตามงบ ──
{
  const ag = A.newAgent({ name: 'x', refs: [
    { kind: 'text', name: 'หนึ่ง', text: 'AAAA' },
    { kind: 'file', name: 'สอง', path: 'References/b.txt' },
    { kind: 'file', name: 'หาย', path: 'References/missing.txt' },
  ] });
  const r = A.agentRefText(ag, { 'References/b.txt': 'BBBB\r\n' }, 1000);
  check('★ รวมทั้งแบบพิมพ์และแบบไฟล์ มีหัวชื่อ', r.text.includes('### หนึ่ง\nAAAA') && r.text.includes('### สอง\nBBBB'), r.text);
  check('★ ไฟล์อ่านไม่ได้ = รายงานใน missing ไม่พัง', r.missing.length === 1 && r.missing[0] === 'หาย');
  check('CRLF → LF', !r.text.includes('\r'));
  const small = A.agentRefText(ag, { 'References/b.txt': 'BBBB' }, 6);
  check('★ เกินงบ = ตัด + ธง truncated', small.truncated && small.text.includes('AAAA') && !small.text.includes('BBBB'), JSON.stringify(small));
  check('agent ว่าง', A.agentRefText(null).text === '');
}

// ── prompt ของ Rewrite this ──
{
  const L = { role: 'ROLE', rules: ['R1', 'R2'], persona: 'PERSONA', screenplay: 'SPRULE', refs: 'REFS',
              project: 'PROJ', before: 'BEFORE', after: 'AFTER', instruction: 'INSTR',
              defaultInstruction: 'DEFAULT', source: 'SRC', output: 'OUT' };
  const ag = A.newAgent({ name: 'Dark', persona: 'โทนมืด' });
  const p = A.buildRewritePrompt({ text: 'ต้นฉบับ', instruction: 'ให้ตึงขึ้น', agent: ag, refText: 'อ้างอิง',
                                   before: 'ก่อน', after: 'หลัง', project: 'บริบท' }, L);
  check('★ system มีบทบาท + บุคลิก agent + กฎ', p.system.includes('ROLE') && p.system.includes('PERSONA — Dark')
        && p.system.includes('โทนมืด') && p.system.includes('- R1') && p.system.includes('- R2'), p.system);
  check('นิยายไม่มีกฎบทหนัง', !p.system.includes('SPRULE'));
  check('★ prompt มีต้นฉบับครอบ <<< >>>', p.prompt.includes('<<<\nต้นฉบับ\n>>>'), p.prompt);
  check('prompt มีคำสั่งผู้ใช้', p.prompt.includes('## INSTR\nให้ตึงขึ้น'));
  check('prompt มีอ้างอิง/บริบท/ก่อน/หลัง', ['## REFS', '## PROJ', '## BEFORE', '## AFTER'].every((h) => p.prompt.includes(h)));
  check('ต้นฉบับอยู่ท้ายสุดก่อนคำสั่งผลลัพธ์', p.prompt.trim().endsWith('OUT') && p.prompt.indexOf('## SRC') > p.prompt.indexOf('## AFTER'));
  const q = A.buildRewritePrompt({ text: 'x', format: 'screenplay' }, L);
  check('★ ไม่มีคำสั่ง = ใช้คำสั่งมาตรฐาน', q.prompt.includes('## INSTR\nDEFAULT'));
  check('ไม่มี agent = ไม่มีบล็อกบุคลิก', !q.system.includes('PERSONA'));
  check('★ บทหนังมีกฎรักษา element', q.system.includes('SPRULE'));
  check('บล็อกว่างไม่ถูกใส่หัว', !q.prompt.includes('## REFS') && !q.prompt.includes('## BEFORE'));
  const long = A.buildRewritePrompt({ text: 'x', before: 'ก'.repeat(5000), after: 'ข'.repeat(5000) }, L);
  check('★ บริบทรอบข้างถูกตัดตามเพดาน (ก่อน = เก็บท้าย · หลัง = เก็บหัว)',
        !long.prompt.includes('ก'.repeat(A.AROUND_CHARS + 1)) && !long.prompt.includes('ข'.repeat(A.AROUND_CHARS + 1))
        && long.prompt.includes('…' + 'ก'.repeat(10)) && long.prompt.includes('ข'.repeat(10) + '…'));
}

// ── ทำความสะอาดคำตอบ ──
{
  check('ตัดช่องว่างหัวท้าย', A.cleanRewriteOutput('  abc \n') === 'abc');
  check('★ ตัด code fence', A.cleanRewriteOutput('```\nข้อความ\n```') === 'ข้อความ');
  check('ตัด code fence ที่มีภาษา', A.cleanRewriteOutput('```text\nข้อความ\nสอง\n```') === 'ข้อความ\nสอง');
  check('★ ตัดตัวคั่น <<< >>>', A.cleanRewriteOutput('<<<\nข้อความ\n>>>') === 'ข้อความ');
  check('★ ตัดเครื่องหมายคำพูดที่ครอบทั้งก้อน', A.cleanRewriteOutput('"ข้อความ"', 'เดิม') === 'ข้อความ');
  check('ต้นฉบับครอบด้วยคำพูด = คงไว้', A.cleanRewriteOutput('"ใหม่"', '"เดิม"') === '"ใหม่"');
  check('คำพูดสองท่อน = ไม่ตัด (ไม่ใช่ตัวครอบ)', A.cleanRewriteOutput('"ก" เขาว่า "ข"', 'x') === '"ก" เขาว่า "ข"');
  check('“ ” ไทย', A.cleanRewriteOutput('“ข้อความ”', 'x') === 'ข้อความ');
  check('CRLF', A.cleanRewriteOutput('a\r\nb') === 'a\nb');
  check('null', A.cleanRewriteOutput(null) === '');
}

// ── ตรวจช่วงก่อนแทนที่ ──
{
  const doc = 'สวัสดีโลกกว้าง';
  const at = (a, b) => doc.slice(a, b);
  check('★ ข้อความยังตรง = ได้ช่วงเดิม', JSON.stringify(A.resolveRange(at, 6, 9, 'โลก')) === '{"from":6,"to":9}');
  check('★ ข้อความถูกแก้ระหว่างรอ = null (ห้ามทับ)', A.resolveRange(at, 6, 9, 'ฟ้า') === null);
  check('ช่วงว่าง = null', A.resolveRange(at, 5, 5, '') === null);
  check('อ่านพัง = null', A.resolveRange(() => { throw new Error('x'); }, 0, 2, 'สว') === null);
}

console.log(`\nai-agents: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
