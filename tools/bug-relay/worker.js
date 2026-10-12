// tools/bug-relay/worker.js — ตัวกลางรับรายงานบั๊กจากโปรแกรม Killian 2 (Cloudflare Worker · ไม่มี dependency)
//
// โปรแกรม → POST <ที่อยู่ของ Worker>/report → Worker ตรวจคำขอ → เปิด Issue ในรีโปด้วยโทเคนของผู้ดูแล → ตอบเลข Issue
//
// ทำไมต้องมีตัวกลาง: ผู้ใช้ต้องรายงานได้ "ตรงจากโปรแกรม" โดยไม่มีบัญชี GitHub และรีโปเป็นสาธารณะ
// จึงฝังโทเคนในโปรแกรมไม่ได้ — โทเคนอยู่ที่นี่ที่เดียว (ตัวแปรลับของ Worker)
//
// ค่าที่ต้องตั้ง (ดู README.md ในโฟลเดอร์นี้):
//   GITHUB_TOKEN  (secret)  โทเคนแบบ fine-grained ของรีโปเดียว สิทธิ์ Issues: Read and write เท่านั้น
//   GITHUB_REPO   (var)     "เจ้าของ/ชื่อรีโป"
//   RATE          (binding · ไม่บังคับ) ตัวจำกัดจำนวนครั้งของ Cloudflare — มีแล้วจำกัดต่อ IP
//
// ⚠ ตัวนี้กัน "การใช้ผิดแบบทั่วไป" (ขนาด · รูปแบบ · ความถี่ · การแท็กคนอื่น) ไม่ได้พิสูจน์ว่าคำขอมาจากโปรแกรมจริง —
//   ซอร์สของโปรแกรมเป็นสาธารณะ ของลับที่ฝังไว้จึงไม่ลับ · ทุกรายงานเข้ามาในสถานะ "รอตรวจสอบ" ให้ผู้ดูแลคัดเอง
//
// รูปของคำขอ/คำตอบต้องตรงกับ src/bugs/bug-core.js (buildRelayRequest / readRelayResponse)
// — unit `bug-core` ส่งคำขอของโปรแกรมเข้า validateReport() ของไฟล์นี้จริง

export const CLIENT = 'killian2';
export const LIMITS = { title: 200, body: 20000, bytes: 64 * 1024, maxAgeMs: 15 * 60 * 1000 };
/** ป้ายที่ติดให้ทุกรายงานจากโปรแกรม (ไม่มีป้ายนี้ในรีโป GitHub จะสร้างให้เอง) */
export const LABELS = ['from-app'];
/** ชนิดของรายงาน — ไม่ส่งมา = บั๊ก (โปรแกรมรุ่นก่อน alpha.170 ไม่มีช่องนี้ และต้องส่งได้ตามเดิม) */
export const KINDS = ['bug', 'feature'];
/** ป้ายที่ติดเพิ่มให้คำขอฟีเจอร์ — โปรแกรมอ่านชนิดจากป้ายนี้ (ผู้ดูแลเปลี่ยนป้ายเพื่อย้ายชนิดได้) */
export const KIND_LABELS = { bug: [], feature: ['enhancement'] };

const RE_VERSION = /^\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.]+)?$/;
const RE_MARK = /<!--\s*k2-report\b[^>]*-->/gi;
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const ZWSP = String.fromCharCode(0x200B);

const fail = (status, code) => ({ ok: false, status, code });

/**
 * ตรวจรายงานที่โปรแกรมส่งมา — บริสุทธิ์ (unit test ได้)
 * @param {any} input วัตถุที่ถอดจาก JSON แล้ว
 * @param {number} now เวลาปัจจุบัน (ms)
 * @returns {{ok:true,title:string,body:string,version:string,kind:string}|{ok:false,status:number,code:string}}
 */
export function validateReport(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(400, 'shape');
  const title = String(input.title == null ? '' : input.title).replace(CTRL, '').replace(/\s+/g, ' ').trim();
  const body = String(input.body == null ? '' : input.body).replace(/\r\n?/g, '\n').replace(CTRL, '').trim();
  const version = String(input.version == null ? '' : input.version).trim();
  const ts = Number(input.ts);
  const kind = input.kind == null ? 'bug' : String(input.kind);
  if (!KINDS.includes(kind)) return fail(400, 'kind');
  if (!title || title.length > LIMITS.title) return fail(400, 'title');
  if (!body || body.length > LIMITS.body) return fail(400, 'body');
  if (!RE_VERSION.test(version) || version.length > 40) return fail(400, 'version');
  // นาฬิกาเครื่องผู้ใช้คลาดได้ — ยอม ±15 นาที (กันคำขอเก่าที่ถูกเก็บไว้ยิงซ้ำทีหลัง)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > LIMITS.maxAgeMs) return fail(400, 'ts');
  // บรรทัดกำกับรุ่นต้องมีหนึ่งบรรทัดและตรงกับรุ่นที่แจ้ง (โปรแกรมใส่ให้เสมอ — กล่องสถานะอ่าน "พบในรุ่น" จากบรรทัดนี้)
  const marks = body.match(RE_MARK) || [];
  // เทียบทั้งค่า ไม่ใช่ "ขึ้นต้นด้วย" (alpha.1 ต้องไม่ผ่านด่านของ alpha.169)
  const marked = marks.length === 1 ? (/\bversion=(\S+)/.exec(marks[0]) || [])[1] : '';
  if (marked !== version) return fail(400, 'mark');
  return { ok: true, title, body, version, kind };
}

/** ไม่ให้รายงานแท็กใครบน GitHub (@ชื่อ) — แทรกช่องว่างกว้างศูนย์หลัง @ */
export function defang(text) { return String(text).replace(/@(?=[A-Za-z0-9])/g, '@' + ZWSP); }

/** เนื้อของคำขอเปิด Issue */
export function issuePayload(v) {
  return { title: defang(v.title), body: defang(v.body), labels: [...LABELS, ...(KIND_LABELS[v.kind] || [])] };
}

const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export default {
  /** @param {Request} request @param {{GITHUB_TOKEN?:string, GITHUB_REPO?:string, RATE?:{limit:Function}}} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return json(200, { ok: true, service: 'k2-bug-relay' });
    if (url.pathname !== '/report') return json(404, { ok: false, code: 'path' });
    if (request.method !== 'POST') return json(405, { ok: false, code: 'method' });
    if (request.headers.get('X-K2-Client') !== CLIENT) return json(403, { ok: false, code: 'client' });
    if (!env || !env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(String(env.GITHUB_REPO || ''))) return json(503, { ok: false, code: 'config' });

    if (env.RATE && typeof env.RATE.limit === 'function') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      let allowed = true;
      try { allowed = (await env.RATE.limit({ key: ip })).success !== false; } catch { allowed = true; }
      if (!allowed) return json(429, { ok: false, code: 'rate' });
    }

    let raw = '';
    try { raw = await request.text(); } catch { return json(400, { ok: false, code: 'read' }); }
    if (raw.length > LIMITS.bytes) return json(413, { ok: false, code: 'size' });
    let input = null;
    try { input = JSON.parse(raw); } catch { return json(400, { ok: false, code: 'json' }); }
    const v = validateReport(input, Date.now());
    if (!v.ok) return json(v.status, { ok: false, code: v.code });

    let res = null;
    try {
      res = await fetch('https://api.github.com/repos/' + env.GITHUB_REPO + '/issues', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + env.GITHUB_TOKEN,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'k2-bug-relay',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(issuePayload(v)),
      });
    } catch { return json(502, { ok: false, code: 'github-net' }); }
    // ไม่ส่งรายละเอียดของ GitHub กลับไป (อาจมีข้อมูลของโทเคน/รีโป) — แค่รหัสให้ผู้ดูแลไล่ต่อจาก log ของ Worker
    if (res.status !== 201) {
      console.log('github answered', res.status);
      return json(502, { ok: false, code: 'github', status: res.status });
    }
    let made = null;
    try { made = await res.json(); } catch { made = null; }
    const number = made && Number.isInteger(made.number) ? made.number : 0;
    if (!number) return json(502, { ok: false, code: 'github-shape' });
    return json(201, { ok: true, number });
  },
};
