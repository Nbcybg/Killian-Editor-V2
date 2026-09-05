// src/update/update-check.js — [alpha.135] ตรรกะของระบบอัปเดต (บริสุทธิ์ 100% · มี unit test)
//
// **กฎข้อเดียวที่สำคัญที่สุดของไฟล์นี้**: อัปเดตมาจากรีโปเดียวเท่านั้น
// (`UPDATE_OWNER`/`UPDATE_REPO` ข้างล่าง) — ทุก URL ในระบบสร้างจากสองค่านี้ ไม่มีที่อื่นเขียน URL เอง
// และก่อนดาวน์โหลดทุกครั้ง main จะถาม `isAllowedAssetUrl()` ซ้ำอีกชั้น
//
// ไฟล์นี้ **ไม่แตะเน็ต ไม่แตะดิสก์ ไม่แตะ DOM** — รับข้อมูลดิบจาก GitHub เข้ามาแล้วตอบว่า
// "ควรทำอะไรต่อ" · ฝั่ง main ทำเรื่องเน็ต/ดิสก์ · ฝั่ง renderer ทำกล่องถาม
// build.js แปลงไฟล์นี้เป็น `update-check.cjs` ให้ main.js require (ห้ามคัดลอกตรรกะไปไว้สองที่)

export const UPDATE_OWNER = 'Nbcybg';
export const UPDATE_REPO = 'Killian-Editor-V2';

const R = `${UPDATE_OWNER}/${UPDATE_REPO}`;
/** ลิงก์ที่ผู้ใช้กำหนดไว้ในคำสั่ง — โชว์ในหน้าตั้งค่าให้เห็นกับตาว่ามาจากที่นี่ */
export const UPDATE_GIT_URL = `https://github.com/${R}.git`;
export const UPDATE_HOME_URL = `https://github.com/${R}`;
export const UPDATE_RELEASES_URL = `https://github.com/${R}/releases`;
/** รายชื่อรุ่นที่เผยแพร่ */
export const UPDATE_API_URL = `https://api.github.com/repos/${R}/releases?per_page=30`;
/** package.json บนกิ่งหลัก — ใช้ตอบให้ได้ว่า "รีโปไปถึงรุ่นไหนแล้ว" แม้ยังไม่มี Release */
export const UPDATE_MANIFEST_URL = `https://raw.githubusercontent.com/${R}/HEAD/package.json`;
/** คำนำหน้าของไฟล์แนบที่ยอมดาวน์โหลด — อย่างอื่นปฏิเสธหมด */
export const UPDATE_ASSET_PREFIX = `https://github.com/${R}/releases/download/`;

// ───────────────────────── เวอร์ชัน ─────────────────────────

/** ตัด `v` นำหน้า/ช่องว่างออกจากชื่อแท็ก — `v2.0.0-alpha.135` → `2.0.0-alpha.135` */
export function normalizeTag(tag) {
  return String(tag == null ? '' : tag).trim().replace(/^[vV](?=\d)/, '');
}

/**
 * แยกเวอร์ชันแบบ semver — คืน null เมื่ออ่านไม่ออก
 * @returns {{nums:number[], pre:Array<string|number>}|null}
 */
export function parseVersion(v) {
  const s = normalizeTag(v);
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(s);
  if (!m) return null;
  const nums = [+m[1], +(m[2] || 0), +(m[3] || 0)];
  const pre = m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? +p : p)) : [];
  return { nums, pre };
}

/**
 * เทียบสองเวอร์ชันตามกติกา semver (รุ่นทดลองมาก่อนรุ่นจริงเสมอ: 2.0.0-alpha.1 < 2.0.0)
 * @returns {number} -1 = a เก่ากว่า · 0 = เท่ากัน · 1 = a ใหม่กว่า · อ่านไม่ออก = 0
 */
export function cmpVersion(a, b) {
  const A = parseVersion(a), B = parseVersion(b);
  if (!A || !B) return 0;
  for (let i = 0; i < 3; i++) { if (A.nums[i] !== B.nums[i]) return A.nums[i] > B.nums[i] ? 1 : -1; }
  if (!A.pre.length && !B.pre.length) return 0;
  if (!A.pre.length) return 1;              // 2.0.0 ใหม่กว่า 2.0.0-alpha.1
  if (!B.pre.length) return -1;
  const n = Math.max(A.pre.length, B.pre.length);
  for (let i = 0; i < n; i++) {
    const x = A.pre[i], y = B.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const nx = typeof x === 'number', ny = typeof y === 'number';
    if (nx && ny) return x > y ? 1 : -1;
    if (nx !== ny) return nx ? -1 : 1;       // ตัวเลขมาก่อนตัวอักษร
    return String(x) > String(y) ? 1 : -1;
  }
  return 0;
}

/** `a` ใหม่กว่า `b` ไหม */
export function isNewer(a, b) { return cmpVersion(a, b) > 0; }

// ───────────────────────── รุ่นที่เผยแพร่ ─────────────────────────

/** เลขรุ่นของ release ก้อนหนึ่ง (ใช้ tag เป็นหลัก · ตกมาที่ชื่อรุ่น) */
export function releaseVersion(rel) {
  if (!rel) return '';
  const tag = normalizeTag(rel.tag_name || rel.tag || '');
  if (parseVersion(tag)) return tag;
  const nm = normalizeTag(rel.name || '');
  return parseVersion(nm) ? nm : tag;
}

/**
 * รุ่นที่ใหม่ที่สุดในรายการ (ข้ามฉบับร่าง · รุ่นทดลองนับด้วยเพราะตัวโปรแกรมเองยังเป็น alpha)
 * @param {Array} releases ผลดิบจาก GitHub API
 * @returns {object|null}
 */
export function pickRelease(releases, { allowPrerelease = true } = {}) {
  let best = null;
  for (const rel of (releases || [])) {
    if (!rel || rel.draft) continue;
    if (rel.prerelease && !allowPrerelease) continue;
    if (!parseVersion(releaseVersion(rel))) continue;
    if (!best || isNewer(releaseVersion(rel), releaseVersion(best))) best = rel;
  }
  return best;
}

/** ระบบปฏิบัติการที่ใช้เลือกไฟล์แนบ */
export function platformKey(p) {
  const s = String(p || '').toLowerCase();
  if (s === 'win32' || s === 'win' || s === 'windows') return 'win';
  if (s === 'darwin' || s === 'mac' || s === 'macos') return 'mac';
  return 'linux';
}

const ASSET_RULES = {
  win: [/portable.*\.exe$/i, /\.exe$/i, /win.*\.zip$/i],
  mac: [/\.dmg$/i, /mac.*\.zip$/i, /darwin.*\.zip$/i],
  linux: [/\.appimage$/i, /linux.*\.zip$/i, /\.tar\.gz$/i],
};

/**
 * ไฟล์แนบที่ตรงกับระบบนี้ที่สุด — ไล่ตามลำดับกฎ ตัวแรกที่เจอชนะ
 * @returns {object|null} asset ดิบจาก GitHub
 */
export function pickAsset(assets, plat) {
  const list = (assets || []).filter((a) => a && a.name && isAllowedAssetUrl(a.browser_download_url));
  for (const re of (ASSET_RULES[platformKey(plat)] || [])) {
    const hit = list.find((a) => re.test(String(a.name)));
    if (hit) return hit;
  }
  return null;
}

/**
 * **ด่านความปลอดภัย** — ลิงก์ดาวน์โหลดต้องเป็นไฟล์แนบของรีโปที่กำหนดเท่านั้น
 * (main เรียกซ้ำอีกรอบก่อนยิงจริง — renderer ส่งอะไรมาก็ไม่มีผล)
 */
export function isAllowedAssetUrl(url) {
  const s = String(url == null ? '' : url).trim();
  if (!s.startsWith(UPDATE_ASSET_PREFIX)) return false;
  if (s.length <= UPDATE_ASSET_PREFIX.length) return false;
  return !/[\s"'<>\\]/.test(s);
}

// ───────────────────────── ตัดสินใจ ─────────────────────────

/**
 * หัวใจของระบบ — เอาข้อมูลดิบทั้งหมดมาสรุปเป็น "สถานะเดียว" ที่ UI เอาไปวาดได้เลย
 *
 * สถานะที่เป็นไปได้:
 *   `update`   มีรุ่นใหม่ + มีไฟล์สำหรับระบบนี้ → แทนที่ได้เลย
 *   `noAsset`  มีรุ่นใหม่ แต่ยังไม่มีไฟล์สำหรับระบบนี้ → เปิดหน้ารุ่นให้โหลดเอง
 *   `skipped`  มีรุ่นใหม่ แต่ผู้ใช้เคยกด "ข้ามรุ่นนี้" ไว้
 *   `repoOnly` ยังไม่มี Release ที่ใหม่กว่า แต่ package.json บนรีโปเดินไปไกลกว่าแล้ว
 *   `latest`   ใช้รุ่นล่าสุดอยู่แล้ว
 *   `none`     รีโปยังไม่เผยแพร่รุ่นไหนเลย
 */
export function decideUpdate({ current, releases, manifestVersion = '', skip = '',
                               platform = 'win32', allowPrerelease = true } = {}) {
  const rel = pickRelease(releases, { allowPrerelease });
  const version = rel ? releaseVersion(rel) : '';
  const base = {
    current: normalizeTag(current), version, release: rel || null, asset: null,
    assetUrl: '', assetName: '', assetSize: 0,
    url: rel && rel.html_url ? rel.html_url : UPDATE_RELEASES_URL,
    notes: rel && rel.body ? String(rel.body) : '',
  };

  if (rel && isNewer(version, current)) {
    if (skip && cmpVersion(skip, version) === 0) return { ...base, status: 'skipped' };
    const asset = pickAsset(rel.assets, platform);
    if (asset) {
      return { ...base, status: 'update', asset, assetUrl: asset.browser_download_url,
               assetName: asset.name, assetSize: asset.size || 0 };
    }
    return { ...base, status: 'noAsset' };
  }
  if (manifestVersion && isNewer(manifestVersion, current)) {
    return { ...base, status: 'repoOnly', version: normalizeTag(manifestVersion),
             url: UPDATE_HOME_URL, notes: '' };
  }
  if (!rel) return { ...base, status: 'none', url: UPDATE_RELEASES_URL };
  return { ...base, status: 'latest' };
}

/** มีอะไรต้องบอกผู้ใช้ไหม (ตอนตรวจอัตโนมัติจะเงียบถ้าไม่มี) */
export function shouldNotify(info) {
  return !!info && (info.status === 'update' || info.status === 'noAsset');
}

// ───────────────────────── แทนที่ไฟล์โปรแกรม ─────────────────────────

/** นามสกุลที่ใช้เก็บไฟล์เดิมไว้ระหว่างแทนที่ (Windows เปลี่ยนชื่อไฟล์ที่กำลังรันได้ แต่ลบไม่ได้) */
export const OLD_SUFFIX = '.k2old';

/** ชื่อไฟล์สำรองของไฟล์โปรแกรมเดิม */
export function backupPath(exePath) { return String(exePath || '') + OLD_SUFFIX; }

/** ไฟล์นี้เป็นซากจากการอัปเดตครั้งก่อนที่ควรลบทิ้งไหม */
export function isLeftover(name) { return String(name || '').endsWith(OLD_SUFFIX); }

/** ชื่อไฟล์ที่ปลอดภัยพอจะเขียนลงดิสก์ (กัน `..`/เส้นทางที่แนบมากับชื่อไฟล์แนบ) */
export function safeAssetName(name, fallback = 'killian2-update.bin') {
  const base = String(name || '').split(/[\\/]/).pop().trim();
  if (!base || base === '.' || base === '..') return fallback;
  const clean = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  return clean || fallback;
}

/** ไฟล์ที่โหลดมาเป็นโปรแกรม Windows จริงไหม (`MZ` = หัวไฟล์ .exe) */
export function looksLikeExe(bytes) {
  if (!bytes || bytes.length < 2) return false;
  return bytes[0] === 0x4d && bytes[1] === 0x5a;
}

/** ข้อความความคืบหน้า — "12.4 / 89.1 MB" */
export function progressText(received, total) {
  const mb = (n) => (Number(n) / 1048576).toFixed(1);
  if (!total) return mb(received) + ' MB';
  return mb(received) + ' / ' + mb(total) + ' MB';
}
