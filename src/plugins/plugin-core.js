// plugin-core.js — [alpha.79] ตรรกะของระบบปลั๊กอิน (บริสุทธิ์ 100% · มี unit test)
//
// ระบบปลั๊กอินมีมาตั้งแต่ .60r3 แต่ **ไม่มีหน้าจอ** — ผู้ใช้มองไม่เห็นว่ามีอะไรติดตั้งอยู่
// ตัวไหนพัง ตัวไหนถูกปิด เปิดกลับยังไง · รอบนี้ทำแผงจัดการจริง ตรรกะทั้งหมดอยู่ที่นี่
//
// ที่อยู่ปลั๊กอิน 2 แห่ง (ชื่อซ้ำ → ของโปรเจกต์ชนะ):
//   · `<โปรเจกต์>/Plugins/<ชื่อ>/`         ติดมากับผลงาน
//   · `<userData>/Plugins/<ชื่อ>/`          ของผู้ใช้ ใช้ได้ทุกโปรเจกต์

/** สถานะที่แผงแสดง */
export const ST_OK = 'ok';                 // โหลดสำเร็จ ทำงานอยู่
export const ST_OFF = 'off';               // ผู้ใช้ปิดเอง
export const ST_OLD = 'old';               // ต้องใช้โปรแกรมรุ่นใหม่กว่า
export const ST_ERR = 'err';               // โหลดแล้วพัง (ถูกปิดอัตโนมัติ)

/** ที่มา */
export const ORIGIN_USER = 'user';
export const ORIGIN_PROJECT = 'project';

/** เทียบเวอร์ชันแบบ semver อย่างง่าย — a >= b ? */
export function versionAtLeast(a, b) {
  const num = (s) => String(s == null ? '0' : s).split('-')[0].split('.').map((x) => parseInt(x, 10) || 0);
  const A = num(a), B = num(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d > 0;
  }
  return true;
}

/**
 * manifest (`plugin.json`) → รูปร่างมาตรฐาน
 * ไฟล์เสีย/ขาดช่อง = ไม่พัง แต่ `ok:false` พร้อมเหตุผลเป็นคีย์ภาษา (UI เป็นคนแปล)
 */
export function parseManifest(raw, folderName = '') {
  const m = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const name = str(m.name) || String(folderName || '');
  const entry = str(m.entry) || 'main.js';
  const out = {
    name, folder: String(folderName || ''), entry,
    version: str(m.version), author: str(m.author),
    description: str(m.description), minAppVersion: str(m.minAppVersion),
    homepage: str(m.homepage),
    ok: true, reason: '',
  };
  if (!name) { out.ok = false; out.reason = 'ui.plug.errNoName'; return out; }
  // กัน entry ที่ชี้ออกนอกโฟลเดอร์ปลั๊กอิน
  const clean = entry.replace(/\\/g, '/');
  if (clean.startsWith('/') || clean.split('/').includes('..')) {
    out.ok = false; out.reason = 'ui.plug.errBadEntry';
  }
  return out;
}

/** สถานะของปลั๊กอินหนึ่งตัว */
export function pluginStatus(p, { appVersion = '0', disabled = false, failed = false } = {}) {
  if (p && p.minAppVersion && !versionAtLeast(appVersion, p.minAppVersion)) return ST_OLD;
  if (failed) return ST_ERR;
  if (disabled) return ST_OFF;
  return ST_OK;
}

/**
 * รวมรายชื่อที่โหลดสำเร็จ + ที่ล้มเหลว เป็นรายการเดียวที่แผงเอาไปวาดได้เลย
 * ชื่อซ้ำ (มีทั้งของผู้ใช้และของโปรเจกต์) → เก็บของโปรเจกต์ ติดธง `shadowed`
 */
export function mergePluginList(loaded = [], failed = [], opts = {}) {
  const app = opts.appVersion || '0';
  const isDisabled = typeof opts.disabled === 'function' ? opts.disabled : () => false;
  const byName = new Map();
  const push = (p, failedFlag, error) => {
    if (!p || !p.name) return;
    const prev = byName.get(p.name);
    const row = {
      ...p,
      failed: !!failedFlag,
      error: error || p.error || '',
      status: pluginStatus(p, { appVersion: app, disabled: isDisabled(p.name), failed: failedFlag }),
      shadowed: false,
    };
    if (!prev) { byName.set(p.name, row); return; }
    // ของโปรเจกต์ชนะเสมอ
    if (row.origin === ORIGIN_PROJECT || prev.origin !== ORIGIN_PROJECT) {
      row.shadowed = true; byName.set(p.name, row);
    } else prev.shadowed = true;
  };
  for (const p of (loaded || [])) push(p, false, '');
  // `skipped` = ถูกข้ามเพราะผู้ใช้ปิดไว้ ไม่ใช่ "พัง" → สถานะต้องเป็น "ปิดอยู่" ไม่ใช่ "มีปัญหา"
  for (const p of (failed || [])) push(p, !(p && p.skipped), p && p.error);
  return sortPlugins([...byName.values()]);
}

/** เรียง: ทำงานอยู่ก่อน → มีปัญหา → ปิดไว้ · ในกลุ่มเดียวกันเรียงตามชื่อ */
export function sortPlugins(list) {
  const rank = { [ST_ERR]: 0, [ST_OLD]: 1, [ST_OK]: 2, [ST_OFF]: 3 };
  return [...(list || [])].sort((a, b) => {
    const d = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    return d || String(a.name).localeCompare(String(b.name), 'th');
  });
}

/** นับตามสถานะ — ใช้บนหัวแผง */
export function pluginCounts(list) {
  const c = { total: 0, ok: 0, off: 0, err: 0, old: 0 };
  for (const p of (list || [])) {
    c.total++;
    if (p.status === ST_OK) c.ok++;
    else if (p.status === ST_OFF) c.off++;
    else if (p.status === ST_OLD) c.old++;
    else if (p.status === ST_ERR) c.err++;
  }
  return c;
}

/** ชื่อโฟลเดอร์ที่ปลอดภัย จากชื่อที่ผู้ใช้พิมพ์ */
export function safePluginFolder(name) {
  return String(name || '').trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/^\.+/, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'plugin';
}

/**
 * ไฟล์ของ "ปลั๊กอินตัวอย่าง" — ปุ่มเดียวแล้วได้ปลั๊กอินที่ทำงานจริงทันที
 * (พิสูจน์ว่าระบบใช้ได้จริง และเป็นแบบให้ผู้ใช้ก๊อปไปแก้)
 * @param {string} name ชื่อปลั๊กอิน
 * @param {string} appVersion รุ่นโปรแกรมตอนนี้ (ใส่ลง minAppVersion)
 */
export function samplePluginFiles(name, appVersion = '') {
  const n = String(name || 'ตัวอย่าง');
  const manifest = {
    name: n,
    entry: 'main.js',
    version: '1.0.0',
    author: '',
    description: 'ปลั๊กอินตัวอย่าง — นับคำในฉากที่เปิดอยู่',
    minAppVersion: String(appVersion || ''),
  };
  const main = [
    '// ปลั๊กอินตัวอย่างของ Killian 2',
    '// ทุกอย่างที่ปลั๊กอินทำได้อยู่ในตัวแปร k2 (ดูรายการเต็มในแผง "ปลั๊กอิน" → ปุ่ม ?)',
    '',
    'k2.registerCommand("นับคำในฉากนี้", () => {',
    '  const md = k2.getMarkdown();',
    '  const words = (md.match(/[^\\s]+/g) || []).length;',
    '  k2.setStatus("ฉากนี้มี " + words + " คำ");',
    '});',
    '',
    'k2.registerPanel("hello", {',
    '  title: "สวัสดีจากปลั๊กอิน",',
    '  render: (host) => {',
    '    host.innerHTML = "";',
    '    const d = document.createElement("div");',
    '    d.style.padding = "12px";',
    '    d.textContent = "แผงนี้มาจากปลั๊กอิน — แก้ไฟล์ main.js แล้วกดโหลดใหม่ได้เลย";',
    '    host.appendChild(d);',
    '  },',
    '});',
    '',
  ].join('\n');
  return { 'plugin.json': JSON.stringify(manifest, null, 2), 'main.js': main };
}

/**
 * รายการความสามารถของ `k2` ที่แผงเอาไปแสดงเป็นเอกสารในตัว
 * เก็บเป็น "ชื่อ + คีย์คำอธิบาย" — ข้อความจริงอยู่ในไฟล์ภาษา
 */
export const PLUGIN_API_DOC = [
  { sig: 'k2.registerCommand(label, fn)', key: 'ui.plug.apiCommand' },
  { sig: 'k2.registerPanel(id, opts)', key: 'ui.plug.apiPanel' },
  { sig: 'k2.registerShortcut(id, code, ctrl, shift, fn)', key: 'ui.plug.apiShortcut' },
  { sig: 'k2.showPanel(id) / k2.hidePanel(id)', key: 'ui.plug.apiShowPanel' },
  { sig: 'k2.getMarkdown() / k2.insertText(s)', key: 'ui.plug.apiText' },
  { sig: 'k2.getEditorView()', key: 'ui.plug.apiView' },
  { sig: 'k2.on / k2.off / k2.emit', key: 'ui.plug.apiEvents' },
  { sig: 'k2.readFile / writeFile / listFiles / listDirs', key: 'ui.plug.apiFiles' },
  { sig: 'k2.getSettings(key, def) / k2.setSettings(key, val)', key: 'ui.plug.apiSettings' },
  { sig: 'k2.menuPopup(items, x, y)', key: 'ui.plug.apiMenu' },
  { sig: 'k2.setStatus / ask / confirmBox / alertBox', key: 'ui.plug.apiUi' },
  { sig: 'k2.fetch(url, options)', key: 'ui.plug.apiFetch' },
  { sig: 'k2.log(...)', key: 'ui.plug.apiLog' },
  { sig: 'k2.projectRoot() / k2.appVersion', key: 'ui.plug.apiInfo' },
];
