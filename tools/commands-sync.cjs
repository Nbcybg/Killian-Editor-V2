// tools/commands-sync.cjs — [alpha.147] เติม/อัปเดต icons/commands.csv ให้ครบ "ทุกคำสั่ง" จากโค้ด
//
//   node tools/commands-sync.cjs          # เขียน icons/commands.csv
//   node tools/commands-sync.cjs --check  # ไม่เขียน · exit 1 ถ้ามีคำสั่งในโค้ดที่ยังไม่มีแถว
//
// ช่องที่ "ผู้ใช้เป็นเจ้าของ" — **ไม่ถูกทับ** ถ้าแถวมีอยู่แล้ว:
//   icon · shortcut · shortcut_note
// ช่องที่เหลือเป็นข้อมูลอ่านอย่างเดียว (สร้างใหม่ทุกครั้ง): ป้ายชื่อ · อยู่ตรงไหน · handler · หมายเหตุ
//
// คำสั่งมาจากไหนบ้าง (ต้องครบทุกทาง ไม่งั้นมีคำสั่งหลุดจากทะเบียน):
//   1. `case` ของ `handleCommand()` ใน app.js            — ตัวจริงของ "คำสั่ง"
//   2. เมนูระบบใน main.js (`send()` / `cmd()`)             — รวมรายการที่สร้างจากอาร์เรย์ (แผง · รายงาน)
//   3. ตาราง SHORTCUTS / SHORTCUT_LABELS / SHORTCUT_CATS   — core.js
//   4. ปุ่มลอย FAB (fab-config.js) · แผง (PANEL_DEFS)
//   5. ปุ่มใน index.html (`data-command` · หรือเดาจากตัวผูก onclick) — ปุ่มที่ไม่ผ่าน handleCommand = `ui:<id>`
//   6. `handleCommand('…')` ที่เรียกตรงจากโค้ด renderer
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const { parseCsv } = require('./csv-lite.cjs');
const { shortcutText, readCsvObjects } = require('./commands-data.cjs');

const ROOT = path.join(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const CSV = R('icons/commands.csv');
const COLUMNS = ['command_id', 'label_th', 'icon', 'shortcut', 'svg', 'category', 'kind', 'label_en',
  'where', 'i18n_keys', 'handler', 'shortcut_note', 'note'];
const OWNED = ['icon', 'shortcut', 'shortcut_note'];

// ───────── helpers ─────────
const esc = (v) => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
function parse(file) {
  const code = fs.readFileSync(R(file), 'utf8');
  for (const sourceType of ['module', 'script']) {
    try {
      const comments = [];
      const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType, locations: true, allowHashBang: true, allowReturnOutsideFunction: true, onComment: comments });
      return { code, ast, comments };
    } catch {}
  }
  throw new Error('parse ไม่ผ่าน: ' + file);
}
const TR_FNS = new Set(['t', 'tt', 'ttf', 'tf', 'tKey']);
function lit(n) {
  if (!n) return undefined;
  switch (n.type) {
    case 'Literal': return n.value;
    case 'TemplateLiteral': return n.expressions.length ? undefined : n.quasis[0].value.cooked;
    case 'ArrayExpression': return n.elements.map(lit);
    case 'ObjectExpression': { const o = {}; for (const p of n.properties) if (p.type === 'Property') o[p.key.name ?? p.key.value] = lit(p.value); return o; }
    case 'CallExpression':
      if (TR_FNS.has(n.callee.name) && n.arguments[0] && n.arguments[0].type === 'Literal')
        return { i18n: n.arguments[0].value, args: n.arguments.slice(1).map((a) => a.name ?? lit(a)) };
      return undefined;
    case 'ConditionalExpression': return lit(n.alternate);
    default: return undefined;
  }
}
function decls(ast) {
  const out = {};
  walk.simple(ast, { VariableDeclarator(d) { if (d.id.type === 'Identifier' && d.init) out[d.id.name] = d.init; } });
  return out;
}
const srcFiles = [];
(function rec(d) { for (const f of fs.readdirSync(R(d), { withFileTypes: true })) {
  const p = path.join(d, f.name);
  if (f.isDirectory()) { if (f.name !== 'generated') rec(p); } else if (/\.m?js$/.test(f.name)) srcFiles.push(p);
} })('src');

const I18N = {};
for (const lang of ['th', 'en']) {
  I18N[lang] = {};
  for (const r of parseCsv(fs.readFileSync(R(`languages/k2_${lang}.csv`), 'utf8'))) if (r[0]) I18N[lang][r[0]] = r[1] ?? '';
}
const tx = (lang, key) => (key ? I18N[lang][key] || I18N[lang]['ui.' + key] || '' : '');
// ป้ายชื่อที่อ่านง่าย — ตัดอีโมจินำหน้า/คีย์ลัดท้ายวงเล็บ (ของเก่าที่ยังค้างในไฟล์ภาษา) ออกให้
const LEAD_GLYPH = /^\s*(?:\p{Extended_Pictographic}|[←-⇿⌀-⏿▀-◿☀-➿⤀-⥿⬀-⯿\u{1F100}-\u{1F1FF}])️?\s*/u;
const SC_PAREN_END = /\s*\([^()]*?(?:Ctrl|Shift|Alt|⌘|⇧|⌥|\{\d\})\+[^()]*\)\s*$/;
const cleanLabel = (s) => String(s || '').replace(LEAD_GLYPH, '').replace(SC_PAREN_END, '').replace(/\{sc:[^}]+\}/g, '').trim();
const leadGlyph = (s) => { const m = String(s || '').match(LEAD_GLYPH); return m ? m[0].trim().replace(/️/g, '') : ''; };
const GLYPH_NAME = {};
if (fs.existsSync(R('icons/icons.csv'))) {
  for (const r of readCsvObjects(R('icons/icons.csv'))) if (r.glyph && r.name && r.status !== 'keep_text') GLYPH_NAME[r.glyph] = r.name;
}

// ───────── ตัวรวบรวม ─────────
const CMDS = new Map();
const cmd = (id) => {
  if (!CMDS.has(id)) CMDS.set(id, { id, labels: [], icons: [], shortcuts: [], scNotes: [], where: new Set(), notes: new Set(), cat: '' });
  return CMDS.get(id);
};
const idOf = (ch, args) => [ch, ...(args || [])].join(':');

// 1) handleCommand
const app = parse('src/app.js');
const HANDLED = new Map();
const CASE_CALLS = {};
walk.simple(app.ast, { FunctionDeclaration(fn) {
  if (fn.id?.name !== 'handleCommand') return;
  const param = fn.params[0].name;
  walk.simple(fn.body, { SwitchStatement(sw) {
    if (sw.discriminant.type !== 'Identifier' || sw.discriminant.name !== param) return;
    let pending = [];
    for (const c of sw.cases) {
      if (c.test && c.test.type === 'Literal') { pending.push(c.test.value); HANDLED.set(c.test.value, c.loc.start.line); }
      if (c.consequent.length) {
        for (const st of c.consequent) walk.simple(st, { CallExpression(ce) {
          if (ce.callee.type === 'Identifier') for (const ch of pending) (CASE_CALLS[ce.callee.name] ??= new Set()).add(ch);
        } });
        pending = [];
      }
    }
  } });
} });
for (const ch of HANDLED.keys()) cmd(ch);

// 2) SHORTCUTS (ถ้ายังเป็นตารางตัวอักษรใน core.js — หลัง alpha.147 ย้ายไป CSV แล้วจะข้ามส่วนนี้)
const core = parse('src/core.js'); const cd = decls(core.ast);
if (cd.SHORTCUTS && cd.SHORTCUTS.type === 'ArrayExpression') {
  const lines = core.code.split('\n');
  for (const el of cd.SHORTCUTS.elements) {
    const [code, ctrl, shift, ch, ...args] = lit(el);
    const c = cmd(idOf(ch, args)); c.shortcuts.push(shortcutText(code, ctrl, shift));
    // คอมเมนต์ที่อธิบายคีย์นี้: ท้ายบรรทัดเดียวกัน + บล็อก // ที่ติดอยู่ข้างบน
    const ln = el.loc.start.line;
    const own = core.comments.filter((k) => k.type === 'Line' && k.loc.start.line === ln).map((k) => k.value.trim());
    const above = [];
    for (let i = ln - 2; i >= 0 && /^\s*\/\//.test(lines[i]); i--) above.unshift(lines[i].replace(/^\s*\/\/\s?/, '').trim());
    const note = [...above, ...own].join(' ').replace(/[═─★]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (note) c.scNotes.push(note);
  }
}
for (const [id, key] of Object.entries(lit(cd.SHORTCUT_LABELS) || {})) cmd(id).labels.push({ key, from: 'SHORTCUT_LABELS' });
for (const cat of lit(cd.SHORTCUT_CATS) || []) for (const id of cat.ids) cmd(id).cat = cat.key;
const panelSkip = lit(cd.SHORTCUT_PANEL_SKIP) || {};

// 3) FAB
for (const a of lit(decls(parse('src/toolbar/fab-config.js').ast).FAB_ACTIONS) || []) {
  const c = cmd(idOf(a.cmd, a.args)); c.where.add('ปุ่มลอย FAB');
  if (a.icon) c.icons.push({ name: a.icon, from: 'FAB' });
  if (a.labelKey) c.labels.push({ key: a.labelKey, from: 'FAB' });
  if (!c.cat) c.cat = a.grp;
}

// 4) แผง
const PANEL_IDS = new Set();
for (const p of lit(decls(parse('src/panels/panel-ui.js').ast).PANEL_DEFS) || []) {
  if (!p || !p.id) continue;
  PANEL_IDS.add(p.id);
  if (p.fixed || p.closable === false) continue;
  const c = cmd(`toggle-panel:${p.id}`); c.where.add('แผง');
  if (p.icon) c.icons.push({ name: p.icon, from: 'PANEL_DEFS' });
  if (p.title && p.title.i18n) c.labels.push({ key: p.title.i18n, from: 'PANEL_DEFS' });
  if (!c.cat) c.cat = 'panels';
}

// 5) เมนูระบบ main.js
const main = parse('main.js'); const md = decls(main.ast);
const SEND_FNS = new Set(['send', 'cmd']);
function menuPath(anc) {
  const parts = [];
  for (const a of anc) if (a.type === 'ObjectExpression') {
    const props = Object.fromEntries(a.properties.filter((p) => p.type === 'Property').map((p) => [p.key.name ?? p.key.value, p.value]));
    if (props.submenu && props.label) { const l = lit(props.label); if (l && l.i18n) parts.push(cleanLabel(tx('th', l.i18n))); }
  }
  return parts.join(' › ');
}
function sendsIn(node) {
  const out = [];
  walk.simple(node, { CallExpression(ce) {
    if (ce.callee.type === 'Identifier' && SEND_FNS.has(ce.callee.name) && ce.arguments[0]?.type === 'Literal')
      out.push({ ch: ce.arguments[0].value, args: ce.arguments.slice(1) });
  } });
  return out;
}
function resolveDynamic(argNode, anc) {
  if (argNode.type !== 'MemberExpression') return null;
  const prop = argNode.property.name;
  const mapCall = [...anc].reverse().find((a) => a.type === 'CallExpression' && a.callee.type === 'MemberExpression' && a.callee.property.name === 'map');
  if (!mapCall) return null;
  const srcTxt = main.code.slice(mapCall.callee.object.start, mapCall.callee.object.end);
  const name = Object.keys(md).find((n) => new RegExp(`\\b${n}\\b`).test(srcTxt) && md[n].type === 'ArrayExpression');
  if (!name) return null;
  return lit(md[name]).filter((o) => o && o[prop] != null).map((o) => ({ arg: o[prop], label: o.key ? { i18n: o.key } : o.label }));
}
// `-1` ใน AST เป็น UnaryExpression ไม่ใช่ Literal — ต้องนับเป็นค่าคงที่ด้วย (ซูมออก = zoom:-1)
const isConst = (a) => a.type === 'Literal' || (a.type === 'UnaryExpression' && a.operator === '-' && a.argument.type === 'Literal');
const constVal = (a) => (a.type === 'Literal' ? a.value : -a.argument.value);
function addMenuItem(labelNode, fnNode, anc, line) {
  const label = lit(labelNode);
  const mp = menuPath(anc);
  const where = mp ? `เมนู: ${mp}` : `เมนูคลิกขวา (main.js:${line})`;
  for (const s of sendsIn(fnNode)) {
    const dyn = s.args.findIndex((a) => !isConst(a));
    if (dyn < 0) {
      const c = cmd(idOf(s.ch, s.args.map(constVal))); c.where.add(where);
      if (label && label.i18n) c.labels.push({ key: label.i18n, from: 'เมนู' });
    } else {
      const vs = resolveDynamic(s.args[dyn], anc);
      if (vs && vs.length) for (const v of vs) {
        const c = cmd(idOf(s.ch, [v.arg])); c.where.add(where);
        if (v.label && v.label.i18n) c.labels.push({ key: v.label.i18n, from: 'เมนู' });
      } else { const c = cmd(s.ch); c.where.add(where); c.notes.add('เมนูส่ง argument แบบไดนามิก (รายการเปลี่ยนตามข้อมูล)'); }
    }
  }
}
walk.fullAncestor(main.ast, (n, _s, anc) => {
  if (n.type === 'ObjectExpression') {
    const props = Object.fromEntries(n.properties.filter((p) => p.type === 'Property').map((p) => [p.key.name ?? p.key.value, p.value]));
    if (props.click) addMenuItem(props.label, props.click, anc.slice(0, -1), n.loc.start.line);
  } else if (n.type === 'CallExpression' && n.callee.name === 'chk' && n.arguments[2]) {
    addMenuItem(n.arguments[0], n.arguments[2], anc.slice(0, -1), n.loc.start.line);
  }
});

// 6) ปุ่มใน index.html
const html = fs.readFileSync(R('renderer/index.html'), 'utf8');
const BUTTONS = [];
for (const m of html.matchAll(/<button\b([^>]*)>/g)) {
  const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
  if (a.id) BUTTONS.push({ id: a.id, command: a['data-command'] || '', icon: a['data-icon'] || '', key: a['data-i18n-title'] || a['data-i18n'] || '' });
}
const HANDLERS = {};
for (const f of srcFiles) {
  const { ast } = parse(f);
  const selOf = (n) => (n && n.type === 'CallExpression' && n.callee.name === '$' && n.arguments[0]?.type === 'Literal' && /^#[\w-]+$/.test(n.arguments[0].value) ? n.arguments[0].value.slice(1) : null);
  const onBtn = (sel, fnNode) => {
    const h = (HANDLERS[sel] ??= { cmds: new Set(), fns: new Set() });
    if (fnNode.type === 'Identifier') { h.fns.add(fnNode.name); return; }
    walk.simple(fnNode, { CallExpression(ce) {
      if (ce.callee.name === 'handleCommand' && ce.arguments[0]?.type === 'Literal' && ce.arguments.slice(1).every((x) => x.type === 'Literal'))
        h.cmds.add(idOf(ce.arguments[0].value, ce.arguments.slice(1).map((x) => x.value)));
      else if (ce.callee.type === 'Identifier') h.fns.add(ce.callee.name);
    } });
  };
  walk.simple(ast, {
    AssignmentExpression(n) {
      if (n.left.type === 'MemberExpression' && n.left.property.name === 'onclick') { const s = selOf(n.left.object); if (s) onBtn(s, n.right); }
    },
    CallExpression(n) {
      if (n.callee.name === 'handleCommand' && n.arguments[0]?.type === 'Literal' && n.arguments.slice(1).every((x) => x.type === 'Literal'))
        cmd(idOf(n.arguments[0].value, n.arguments.slice(1).map((x) => x.value))).where.add('เรียกในโค้ด');
      if (n.callee.type === 'MemberExpression' && n.callee.property.name === 'addEventListener' && n.arguments[0]?.value === 'click') {
        const s = selOf(n.callee.object); if (s && n.arguments[1]) onBtn(s, n.arguments[1]);
      }
    },
  });
}
const TB_SC_MAP = lit(decls(app.ast).TB_SC_MAP) || {};
for (const b of BUTTONS) {
  const h = HANDLERS[b.id] || { cmds: new Set(), fns: new Set() };
  let target = b.command || TB_SC_MAP[b.id] || null, guessed = '';
  if (!target && h.cmds.size === 1) target = [...h.cmds][0];
  if (!target) {
    const chans = new Set([...h.fns].flatMap((fn) => [...(CASE_CALLS[fn] || [])]));
    if (chans.size === 1) { target = [...chans][0]; guessed = 'ฟังก์ชันเดียวกับ handleCommand'; }
  }
  if (!target) {
    const base = b.id.replace(/^tb-/, '').replace(/-panel$/, '');
    if (PANEL_IDS.has(base) && CMDS.has(`toggle-panel:${base}`)) { target = `toggle-panel:${base}`; guessed = 'ชื่อแผง'; }
  }
  // ปุ่มที่ไม่ผ่าน handleCommand ยังเป็น "คำสั่ง" ในสายตาผู้ใช้ → ลงทะเบียนเป็น ui:<id>
  const c = cmd(target || `ui:${b.id}`);
  c.where.add(`แถบเครื่องมือ #${b.id}`);
  if (b.icon) c.icons.push({ name: b.icon, from: `#${b.id}` });
  if (b.key) c.labels.push({ key: b.key, from: `#${b.id}` });
  if (guessed && !b.command) c.notes.add(`ผูกปุ่ม #${b.id} โดยเดาจาก${guessed} — ใส่ data-command ให้ชัด`);
  if (!target) c.notes.add(h.fns.size ? `ปุ่มเรียกฟังก์ชันตรง: ${[...h.fns].slice(0, 3).join(', ')}` : 'ไม่พบตัวผูก onclick ในซอร์ส');
}

// ───────── รวมกับ CSV เดิม ─────────
// ไฟล์รุ่นแรก (ก่อนเดินสาย) ใช้ id ปุ่มแบบ `ui:#tb-x` — ย้ายเป็น `ui:tb-x` โดยคงไอคอนที่ผู้ใช้ตั้งไว้
const base = new Map(readCsvObjects(CSV).map((r) => [r.command_id.replace(/^ui:#/, 'ui:'), { ...r, command_id: r.command_id.replace(/^ui:#/, 'ui:') }]));
const svgOk = (n) => n && fs.existsSync(R(`icons/svg/${n}.svg`));
const glyphOk = new Set(readCsvObjects(R('icons/glyphs.csv')).map((r) => r.name));
const rows = [];
const missingInCsv = [];
for (const c of CMDS.values()) {
  const old = base.get(c.id);
  if (!old) missingInCsv.push(c.id);
  const ch = c.id.split(':')[0];
  const kind = c.id.startsWith('ui:') ? 'ปุ่ม UI' : 'คำสั่ง';
  if (kind === 'คำสั่ง' && !HANDLED.has(ch)) c.notes.add('ไม่มี case ใน handleCommand');
  const order = ['SHORTCUT_LABELS', 'เมนู', 'FAB', 'PANEL_DEFS'];
  const lab = [...c.labels].filter((l) => tx('th', l.key))
    .sort((a, b) => ((order.indexOf(a.from) + 1) || 9) - ((order.indexOf(b.from) + 1) || 9))[0];
  // ไอคอน/คีย์ลัด: แถวเดิมชนะเสมอ · แถวใหม่เดาจากโค้ด
  let icon = old ? old.icon : '';
  if (!old) {
    const prio = (f) => (f.startsWith('#') ? 0 : f === 'FAB' ? 1 : f === 'PANEL_DEFS' ? 2 : 3);
    const ic = [...c.icons].sort((a, b) => prio(a.from) - prio(b.from))[0];
    if (ic) icon = ic.name;
    else for (const l of c.labels) { const g = leadGlyph(tx('th', l.key)); if (GLYPH_NAME[g]) { icon = GLYPH_NAME[g]; break; } }
  }
  const shortcut = old ? old.shortcut : [...new Set(c.shortcuts)].join(' / ');
  const scNote = old && old.shortcut_note ? old.shortcut_note : c.scNotes.join(' · ');
  if (icon && !svgOk(icon)) c.notes.add(glyphOk.has(icon) ? `ยังไม่มี svg/${icon}.svg (ใช้ตัวสำรองใน glyphs.csv)` : `ไม่มีทั้ง svg/${icon}.svg และตัวสำรอง`);
  if (kind === 'คำสั่ง' && c.id.startsWith('toggle-panel:') && !shortcut && !panelSkip[c.id.slice(13)]) c.notes.add('แผงนี้ไม่มีคีย์ลัด');
  if (!lab) c.notes.add('ไม่มีป้ายชื่อ (คำสั่งภายใน / รายการไดนามิก)');
  rows.push({
    command_id: c.id, label_th: lab ? cleanLabel(tx('th', lab.key)) : '', icon, shortcut,
    svg: icon ? (svgOk(icon) ? 'มี' : 'ยังไม่มี') : '', category: c.cat, kind, label_en: lab ? cleanLabel(tx('en', lab.key)) : '',
    where: [...c.where].join(' | '), i18n_keys: [...new Set(c.labels.map((l) => l.key))].join(' '),
    handler: HANDLED.has(ch) ? `src/app.js:${HANDLED.get(ch)}` : '', shortcut_note: scNote, note: [...c.notes].join(' · '),
  });
}
// แถวที่ผู้ใช้มีแต่โค้ดไม่มีแล้ว — เก็บไว้ (ไม่ลบข้อมูลของผู้ใช้เงียบ ๆ)
for (const [id, old] of base) if (!CMDS.has(id)) rows.push({ ...old, note: 'ไม่พบคำสั่งนี้ในโค้ดแล้ว — ลบแถวได้ถ้าเลิกใช้จริง' });
rows.sort((a, b) => (a.category || 'zz').localeCompare(b.category || 'zz') || a.command_id.localeCompare(b.command_id));

const text = '﻿' + [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((k) => esc(r[k])).join(','))].join('\n') + '\n';
if (process.argv.includes('--check')) {
  if (missingInCsv.length) { console.log('คำสั่งที่ยังไม่มีแถวใน icons/commands.csv:\n  ' + missingInCsv.join('\n  ') + '\n→ รัน node tools/commands-sync.cjs'); process.exit(1); }
  console.log(`commands.csv ครบ · ${rows.length} แถว`);
} else {
  fs.writeFileSync(CSV, text);
  console.log(`เขียน icons/commands.csv · ${rows.length} แถว · เพิ่มใหม่ ${base.size ? missingInCsv.length : rows.length}`);
}
module.exports = { rows, missingInCsv, HANDLED };
