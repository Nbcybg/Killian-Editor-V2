// test/ai-error.test.cjs — [alpha.145] "HTTP 0" ต้องกลายเป็นคำอธิบายที่ทำอะไรต่อได้
//
// ผู้ใช้: *"error ขึ้นแค่ ⚠ เรียกไม่สำเร็จ (HTTP 0) แต่ไม่รู้ว่าคืออะไรและแนวทางแก้ไข"*
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmp = path.join(os.tmpdir(), 'k2-aierror-test.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'ai', 'ai-error.js')],
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const E = require(tmp);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}

// ── ปิดบังความลับ (คีย์ห้ามโผล่บนจอ/ในบันทึก) ──
check('ซ่อนคีย์แบบ sk-…', !E.redactSecrets('key sk-abcdef123456 ok').includes('abcdef123456'),
  E.redactSecrets('key sk-abcdef123456 ok'));
check('ซ่อน Bearer', !E.redactSecrets('Authorization: Bearer abcdef1234567890').includes('abcdef1234567890'));
check('ซ่อนค่าใน JSON', !E.redactSecrets('{"api_key":"abcdef1234567890"}').includes('abcdef1234567890'));
check('ข้อความปกติไม่ถูกแตะ', E.redactSecrets('ต่อไม่ติด') === 'ต่อไม่ติด');

// ── อ่านข้อความของเซิร์ฟเวอร์จากทุกสำนวนที่ใช้กันจริง ──
check('OpenAI {error:{message}}',
  E.serverMessage('{"error":{"message":"model not found","code":"m404"}}') === 'model not found [m404]');
check('Ollama {error:"…"}', E.serverMessage('{"error":"model requires more memory"}') === 'model requires more memory');
check('{message}', E.serverMessage('{"message":"quota exceeded"}') === 'quota exceeded');
check('ข้อความเปล่า ๆ ผ่านตรง ๆ', E.serverMessage('Bad Gateway') === 'Bad Gateway');
check('HTML ถูกถอดแท็กออก',
  E.serverMessage('<html><body><h1>502 Bad Gateway</h1></body></html>') === '502 Bad Gateway');
check('ว่าง = คืนว่าง', E.serverMessage('') === '' && E.serverMessage(null) === '');

// ── HTTP 0 แต่ละแบบต้องได้เหตุผลคนละแบบ (นี่คือหัวใจของรอบนี้) ──
const refused = E.describeHttpError({ status: 0, body: 'ECONNREFUSED connect 127.0.0.1:1234',
  url: 'http://127.0.0.1:1234/v1/chat/completions', provider: 'LM Studio' });
check('★ ECONNREFUSED = "ปลายทางปฏิเสธ" ไม่ใช่ "HTTP 0" เฉย ๆ', refused.code === 'net-refused', refused.code);
check('ECONNREFUSED มีแนวทางแก้อย่างน้อย 1 ข้อ', refused.hints.length >= 1);
check('รายละเอียดบอกโฮสต์ปลายทาง', refused.detail.includes('127.0.0.1:1234'), refused.detail);
check('รายละเอียดบอกชื่อผู้ให้บริการ', refused.detail.includes('LM Studio'));

const dns = E.describeHttpError({ status: 0, body: 'getaddrinfo ENOTFOUND api.example.invalid' });
check('ENOTFOUND = ปัญหา DNS', dns.code === 'net-dns', dns.code);

const tls = E.describeHttpError({ status: 0, body: 'self-signed certificate in chain' });
check('certificate = ปัญหา TLS', tls.code === 'net-tls', tls.code);

const netdead = E.describeHttpError({ status: 0, body: 'fetch failed' });
check('fetch failed = ปัญหาเครือข่ายทั่วไป', netdead.code === 'net-net', netdead.code);

// ── หมดเวลา / ผู้ใช้กดหยุด — ต้องไม่ปนกับความผิดพลาดจริง ──
const to = E.describeHttpError({ status: 0, aborted: true, timedOut: true, body: 'timeout 60000ms' });
check('หมดเวลา = code timeout', to.code === 'timeout', to.code);
check('หมดเวลาแนะให้เพิ่ม Timeout', to.hints.join(' ').includes('Timeout'));
const ab = E.describeHttpError({ status: 0, aborted: true });
check('ผู้ใช้กดหยุด = code aborted และไม่มีแนวทางแก้', ab.code === 'aborted' && ab.hints.length === 0);

// ── รหัส HTTP ที่พบบ่อย ──
const k401 = E.describeHttpError({ status: 401, body: '{"error":{"message":"invalid api key"}}' });
check('401 พูดถึงกุญแจ (API key)', /key|กุญแจ/i.test(k401.reason), k401.reason);
check('401 แนบข้อความของเซิร์ฟเวอร์มาด้วย', k401.detail.includes('invalid api key'));
const k404 = E.describeHttpError({ status: 404 });
check('404 แนะเรื่อง /v1 หรือชื่อโมเดล', k404.hints.join(' ').includes('/v1'), k404.hints.join(' '));
const k429 = E.describeHttpError({ status: 429 });
check('429 พูดถึงโควตา/เครดิต', k429.hints.length >= 2);
const k400 = E.describeHttpError({ status: 400, body: '{"error":{"message":"max_tokens must be > 0"}}' });
check('400 บอกให้ดูข้อความเซิร์ฟเวอร์ + ชี้พารามิเตอร์ที่ผิดบ่อย',
  k400.hints.join(' ').includes('Max Tokens'), k400.hints.join(' '));
check('400 ยกข้อความจริงของเซิร์ฟเวอร์ขึ้นมา', k400.detail.includes('max_tokens must be > 0'));
const k500 = E.describeHttpError({ status: 503 });
check('5xx โยนให้ฝั่งผู้ให้บริการ', k500.code === 'http-503');

// ── คีย์ต้องไม่รั่วลงรายละเอียด/บันทึก ──
const leak = E.describeHttpError({ status: 401,
  body: '{"error":{"message":"bad key sk-SUPERSECRET12345"}}',
  url: 'https://api.example.com/v1/chat/completions?key=SUPERSECRET12345' });
check('★ คีย์ในเนื้อคำตอบไม่รั่วลงรายละเอียด', !leak.detail.includes('SUPERSECRET12345'), leak.detail);

// ── บรรทัดเดียวสำหรับแถบสถานะ/บันทึก ──
check('shortError ไม่มีการขึ้นบรรทัดใหม่', !E.shortError(k401).includes('\n'));
check('shortError มีทั้งเหตุผลและข้อความเซิร์ฟเวอร์', E.shortError(k401).includes('invalid api key'));

// ── รายละเอียดต้องมี "แนวทางแก้" เสมอเมื่อมี hints ──
check('รายละเอียดมีหัวข้อแนวทางแก้', refused.detail.includes('แนวทางแก้'));
check('รายละเอียดเรียงแนวทางเป็นข้อ ๆ', /\n1\. /.test(refused.detail), refused.detail);

// ── clip ──
check('clip ตัดข้อความยาว', E.clip('x'.repeat(900), 100).length <= 104);
check('clip ไม่แตะข้อความสั้น', E.clip('สั้น') === 'สั้น');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
