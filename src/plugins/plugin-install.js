// plugin-install.js — [alpha.80] ติดตั้ง/ถอนปลั๊กอินจากลิงก์ GitHub (บริสุทธิ์ 100% · มี unit test)
//
// ผู้ใช้แปะลิงก์ repo แล้วกดติดตั้ง — ไม่ต้องรู้จัก zip / โฟลเดอร์ / branch
// ไฟล์นี้ถือ **ตรรกะล้วน ๆ**: แปลงลิงก์เป็น URL ของ zip · หาว่าปลั๊กอินอยู่โฟลเดอร์ไหนในซิป ·
// ตัดสินชื่อโฟลเดอร์ปลายทาง — ส่วนที่โหลด/แตกซิปจริงอยู่ใน main (ต้องใช้ fs + JSZip)
//
// ═══ ทำไมต้องลองหลาย URL ═══
// GitHub ไม่มี API บอก default branch โดยไม่ยิง API (ซึ่งมีลิมิต 60 ครั้ง/ชม. สำหรับคนไม่ล็อกอิน)
// → ลอง `main` ก่อนแล้วค่อย `master` ตรง ๆ ผ่าน codeload ซึ่งไม่กินโควตา API

/** ที่มาที่รองรับ */
export const SRC_GITHUB = 'github';
export const SRC_ZIP = 'zip';

/** ชื่อ branch ที่ลองตามลำดับเมื่อผู้ใช้ไม่ได้ระบุ */
export const DEFAULT_REFS = ['main', 'master'];

/**
 * แปลงสิ่งที่ผู้ใช้แปะมาเป็นที่มาที่เข้าใจได้
 *
 * รองรับ:
 *   `https://github.com/user/repo`                      · `github.com/user/repo`
 *   `https://github.com/user/repo/tree/dev`             (ระบุ branch)
 *   `https://github.com/user/repo/tree/dev/plugins/abc` (โฟลเดอร์ย่อยในรีโป)
 *   `user/repo`                                          (ทางลัด)
 *   `https://.../anything.zip`                           (ซิปตรง ๆ)
 * @returns {{kind:string, owner?:string, repo?:string, ref?:string, sub?:string, url?:string,
 *            ok:boolean, reason?:string}}
 */
export function parseSource(input) {
  const raw = String(input == null ? '' : input).trim();
  if (!raw) return { kind: '', ok: false, reason: 'ui.plug.errNoUrl' };

  // ซิปตรง ๆ (ต้องเป็น http/https เท่านั้น — ห้ามไฟล์ในเครื่อง/โปรโตคอลอื่น)
  if (/^https?:\/\//i.test(raw) && /\.zip(\?.*)?$/i.test(raw)) {
    return { kind: SRC_ZIP, url: raw, ok: true };
  }

  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/tree\/([^/\s#?]+)((?:\/[^\s#?]+)?))?/i
    .exec(raw);
  if (m) {
    return {
      kind: SRC_GITHUB, ok: true,
      owner: m[1], repo: String(m[2]).replace(/\.git$/i, ''),
      ref: m[3] || '', sub: (m[4] || '').replace(/^\/+|\/+$/g, ''),
    };
  }
  // ทางลัด user/repo (ต้องมีขีดกลางเดียว และไม่ใช่ URL อย่างอื่น)
  const short = /^([\w.-]+)\/([\w.-]+)$/.exec(raw);
  if (short) {
    return { kind: SRC_GITHUB, ok: true, owner: short[1],
             repo: short[2].replace(/\.git$/i, ''), ref: '', sub: '' };
  }
  if (/^https?:\/\//i.test(raw)) return { kind: '', ok: false, reason: 'ui.plug.errNotZip' };
  return { kind: '', ok: false, reason: 'ui.plug.errBadUrl' };
}

/**
 * URL ของซิปที่ควรลองตามลำดับ
 * @returns {string[]}
 */
export function zipCandidates(src) {
  if (!src || !src.ok) return [];
  if (src.kind === SRC_ZIP) return [src.url];
  const refs = src.ref ? [src.ref] : DEFAULT_REFS;
  return refs.map((r) =>
    `https://codeload.github.com/${enc(src.owner)}/${enc(src.repo)}/zip/refs/heads/${enc(r)}`);
}

const enc = (s) => encodeURIComponent(String(s || '')).replace(/%2F/gi, '/');

/**
 * **หัวใจของไฟล์นี้** — หาว่า "ปลั๊กอินอยู่โฟลเดอร์ไหนในซิป"
 *
 * ซิปของ GitHub ห่อทุกอย่างไว้ในโฟลเดอร์ `repo-branch/` และปลั๊กอินอาจอยู่ลึกกว่านั้น
 * เกณฑ์: หา `plugin.json` ที่ **ตื้นที่สุด** · ถ้าผู้ใช้ระบุโฟลเดอร์ย่อยมา ให้จำกัดอยู่ในนั้น
 *
 * @param {string[]} paths รายชื่อไฟล์ทั้งหมดในซิป (ใช้ / เป็นตัวคั่น)
 * @param {string} [sub] โฟลเดอร์ย่อยที่ผู้ใช้ระบุ (ไม่รวมโฟลเดอร์ห่อของ GitHub)
 * @returns {{ok:boolean, root?:string, reason?:string}} `root` = คำนำหน้าที่ต้องตัดออก ('' = ราก)
 */
export function pickPluginRoot(paths, sub = '') {
  const list = (paths || []).map((p) => String(p || '').replace(/\\/g, '/')).filter(Boolean);
  const manifests = list.filter((p) => p === 'plugin.json' || p.endsWith('/plugin.json'));
  if (!manifests.length) return { ok: false, reason: 'ui.plug.errNoManifest' };

  const wanted = String(sub || '').replace(/^\/+|\/+$/g, '');
  const roots = manifests.map((p) => p.slice(0, Math.max(0, p.length - 'plugin.json'.length))
    .replace(/\/$/, ''));
  let pool = roots;
  if (wanted) {
    // เทียบแบบ "ลงท้ายด้วยโฟลเดอร์ที่ขอ" — ไม่ต้องรู้ชื่อโฟลเดอร์ห่อของ GitHub
    const hit = roots.filter((r) => r === wanted || r.endsWith('/' + wanted));
    if (!hit.length) return { ok: false, reason: 'ui.plug.errSubNotFound' };
    pool = hit;
  }
  pool = [...pool].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  return { ok: true, root: pool[0] };
}

/**
 * ไฟล์ที่ต้องเขียนลงเครื่อง: ตัดคำนำหน้าออก + คัดของที่ไม่ควรติดตั้งทิ้ง
 * @param {string[]} paths ทุก path ในซิป
 * @param {string} root คำนำหน้าจาก pickPluginRoot
 * @returns {Array<{from:string, to:string}>}
 */
export function filesToInstall(paths, root) {
  const pre = root ? root.replace(/\/$/, '') + '/' : '';
  const out = [];
  for (const raw of (paths || [])) {
    const p = String(raw || '').replace(/\\/g, '/');
    if (!p || p.endsWith('/')) continue;                 // โฟลเดอร์
    if (pre && !p.startsWith(pre)) continue;             // อยู่นอกโฟลเดอร์ปลั๊กอิน
    const rel = pre ? p.slice(pre.length) : p;
    if (!rel || !isSafeRel(rel)) continue;
    if (isJunk(rel)) continue;
    out.push({ from: p, to: rel });
  }
  return out;
}

/** path ปลอดภัยไหม — ห้ามหลุดออกนอกโฟลเดอร์ปลายทางเด็ดขาด (zip-slip) */
export function isSafeRel(rel) {
  const p = String(rel || '').replace(/\\/g, '/');
  if (!p || p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false;
  return !p.split('/').some((seg) => seg === '..' || seg === '' || seg === '.');
}

/** ของที่ไม่ควรติดตั้ง (ขยะของ VCS/ระบบปฏิบัติการ/ไฟล์ที่รันเองไม่ได้อยู่แล้ว) */
export function isJunk(rel) {
  const p = String(rel || '');
  return /(^|\/)(\.git|\.github|node_modules|__MACOSX)(\/|$)/.test(p)
      || /(^|\/)\.DS_Store$/.test(p)
      || /(^|\/)Thumbs\.db$/i.test(p);
}

/** เตือนก่อนติดตั้ง: ปลั๊กอินรันโค้ดได้เต็มที่ ผู้ใช้ต้องรู้ว่ากำลังเชื่อคนเขียน */
export const INSTALL_WARN_KEY = 'ui.plug.installWarn';

/** สรุปสิ่งที่จะติดตั้ง (โชว์ให้ผู้ใช้ยืนยันก่อนเขียนลงเครื่อง) */
export function installSummary(files) {
  const list = files || [];
  const bytes = list.reduce((n, f) => n + (f.size || 0), 0);
  return { count: list.length, bytes,
           hasCode: list.some((f) => /\.(js|mjs|cjs)$/i.test(f.to)) };
}
