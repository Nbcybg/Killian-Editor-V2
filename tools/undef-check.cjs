#!/usr/bin/env node
// undef-check.cjs — หา "ชื่อที่ถูกเรียกใช้แต่ไม่มีที่ประกาศ" ทั้ง src/ + main.js + preload.js
//
// ══ ทำไมต้องมีเครื่องมือตัวนี้ ══
// กฎเหล็กข้อ 1 ของโปรเจกต์: esbuild **ปล่อย identifier ที่ไม่รู้จักผ่านไปเป็น global ตอนรัน**
// → `node build.js` ขึ้น "bundle OK" แล้วโปรแกรมพังตอนกดปุ่มจริงเท่านั้น
// และถ้าจุดนั้นอยู่ใน `try/catch` หรือ callback async ที่ไม่มีใครจับ = **เงียบสนิท ไม่มีใครรู้**
//
// ของจริงที่เจอด้วยเครื่องมือนี้ (alpha.128):
//   · `stale()` ใน countProjectWords  → จำนวนคำทั้งโปรเจกต์เป็น 0 มาหลายสิบรุ่น (WARN ในบันทึกเท่านั้น)
//   · `getSpellchecker` / `resolvePath` / `openWikiEntity` ใน revertTab → กด Revert บนบทหนัง = แท็บว่าง
//   · `createNewScene` ในทางนำเข้าบทภาพยนตร์ → นำเข้าแล้วไม่มีอะไรเกิดขึ้น
//   · `BG_FALLBACK` / `GRID_FALLBACK` ใน network.draw() → ระเบิดเวลา (ยัง short-circuit รอดอยู่)
//
//   node tools/undef-check.cjs           รายงาน (exit 1 ถ้าเจอ)
//   node tools/undef-check.cjs --list    พิมพ์รายชื่อ global ที่ยอมรับ
//
// วิธีตรวจ: เก็บ "ชื่อที่ประกาศที่ไหนก็ได้ในไฟล์" (import/var/let/const/function/class/พารามิเตอร์/
// destructuring/catch) แล้วดูว่ามีชื่อไหนถูกอ้างถึงโดยไม่อยู่ในชุดนั้นและไม่ใช่ global ของเบราว์เซอร์
// **จงใจไม่ไล่สโคป** — over-approximate ฝั่งประกาศ เพื่อให้ไม่มี false positive เลย
// (การบังชื่อข้ามสโคปมี `tools/i18n-shadow.cjs` ดูแลอยู่แล้ว)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const acorn = require('acorn');
const walk = require('acorn-walk');

// global ที่รันจริงมีให้ (เบราว์เซอร์ + ES + สะพานของโปรเจกต์)
const GLOBALS = new Set(`
window document navigator location history screen console alert confirm prompt
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame queueMicrotask
fetch Headers Request Response FormData URL URLSearchParams Blob File FileReader XMLHttpRequest WebSocket
localStorage sessionStorage indexedDB crypto performance atob btoa structuredClone reportError
Image Audio Video Option Element HTMLElement HTMLCanvasElement HTMLImageElement HTMLInputElement
Node NodeList NodeFilter Text Range DocumentFragment DOMParser XMLSerializer TreeWalker
Event CustomEvent MouseEvent KeyboardEvent DragEvent InputEvent WheelEvent PointerEvent TouchEvent
ClipboardEvent DataTransfer FocusEvent
MutationObserver ResizeObserver IntersectionObserver AbortController AbortSignal
CanvasRenderingContext2D Path2D OffscreenCanvas ImageData createImageBitmap SVGElement
Object Array String Number Boolean Symbol BigInt Function Math JSON Date RegExp
Error TypeError RangeError SyntaxError ReferenceError EvalError URIError AggregateError
Map Set WeakMap WeakSet WeakRef Promise Proxy Reflect Intl FinalizationRegistry
ArrayBuffer SharedArrayBuffer DataView Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array
Int32Array Uint32Array Float32Array Float64Array BigInt64Array BigUint64Array
parseInt parseFloat isNaN isFinite encodeURI encodeURIComponent decodeURI decodeURIComponent escape unescape
undefined NaN Infinity globalThis eval require module exports process Buffer __dirname __filename arguments
getComputedStyle matchMedia scrollTo scrollBy open close print focus blur
CSS getSelection speechSynthesis SpeechSynthesisUtterance
devicePixelRatio innerWidth innerHeight outerWidth outerHeight scrollX scrollY pageXOffset pageYOffset
addEventListener removeEventListener dispatchEvent postMessage MessageChannel BroadcastChannel
TextEncoder TextDecoder ReadableStream WritableStream TransformStream
customElements ShadowRoot MediaQueryList Notification Worker
kapi fabric
`.split(/\s+/).filter(Boolean));

// ชื่อที่ยอมให้ "ไม่มีที่ประกาศ" ได้ เพราะถูกใช้ในบริบทที่ปลอดภัยจริง ๆ
// (`typeof X === 'undefined'` ไม่โยน ReferenceError — เทสข้อ 80-5 ใช้พิสูจน์ว่าโมดูลถูกลบไปแล้ว)
const ALLOW = new Set(['openCentralizeUI']);

function patNames(p, out) {
  if (!p) return;
  switch (p.type) {
    case 'Identifier': out.add(p.name); break;
    case 'ObjectPattern': p.properties.forEach((pr) => patNames(pr.type === 'RestElement' ? pr.argument : pr.value, out)); break;
    case 'ArrayPattern': p.elements.forEach((e) => patNames(e, out)); break;
    case 'RestElement': patNames(p.argument, out); break;
    case 'AssignmentPattern': patNames(p.left, out); break;
    case 'Property': patNames(p.value, out); break;
    default: break;
  }
}

/** @returns {{rel:string, name:string, lines:number[]}[]} */
function scanFile(abs, rel) {
  const src = fs.readFileSync(abs, 'utf8');
  const isCjs = /\.cjs$/.test(abs) || rel === 'main.js' || rel === 'preload.js';
  let ast;
  try {
    ast = acorn.parse(src, { sourceType: isCjs ? 'script' : 'module', ecmaVersion: 'latest', locations: true });
  } catch (e) { return [{ rel, name: 'PARSE ERROR: ' + e.message, lines: [] }]; }

  const declared = new Set();
  walk.full(ast, (n) => {
    if (n.type === 'VariableDeclarator') patNames(n.id, declared);
    else if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
      if (n.id) declared.add(n.id.name);
      n.params.forEach((p) => patNames(p, declared));
    } else if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') { if (n.id) declared.add(n.id.name); }
    else if (n.type === 'CatchClause') patNames(n.param, declared);
    else if (n.type === 'ImportDefaultSpecifier' || n.type === 'ImportNamespaceSpecifier' || n.type === 'ImportSpecifier') declared.add(n.local.name);
    else if (n.type === 'LabeledStatement') declared.add(n.label.name);
  });

  // ตำแหน่งที่ Identifier ไม่ได้หมายถึงตัวแปร (ชื่อพร็อพเพอร์ตี้ · ป้าย · คีย์ของ import/export)
  const skip = new Set();
  walk.full(ast, (n) => {
    if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier') skip.add(n.property);
    if (n.type === 'Property' && !n.computed && n.key.type === 'Identifier') skip.add(n.key);
    if (n.type === 'PropertyDefinition' && !n.computed && n.key && n.key.type === 'Identifier') skip.add(n.key);
    if (n.type === 'MethodDefinition' && !n.computed && n.key.type === 'Identifier') skip.add(n.key);
    if (n.type === 'ExportSpecifier') skip.add(n.exported);
    if (n.type === 'ImportSpecifier') skip.add(n.imported);
    if ((n.type === 'BreakStatement' || n.type === 'ContinueStatement') && n.label) skip.add(n.label);
    if (n.type === 'LabeledStatement') skip.add(n.label);
  });

  const hits = new Map();
  walk.full(ast, (n) => {
    if (n.type !== 'Identifier' || skip.has(n)) return;
    if (declared.has(n.name) || GLOBALS.has(n.name) || ALLOW.has(n.name)) return;
    if (!hits.has(n.name)) hits.set(n.name, []);
    hits.get(n.name).push(n.loc.start.line);
  });
  return [...hits].map(([name, lines]) => ({ rel, name, lines }));
}

function list(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') list(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** ใช้จากเทส: คืนรายการที่เจอ (ว่าง = ผ่าน) */
function findUndefined() {
  const files = list(path.join(ROOT, 'src')).concat([path.join(ROOT, 'main.js'), path.join(ROOT, 'preload.js')]);
  const out = [];
  for (const abs of files) out.push(...scanFile(abs, path.relative(ROOT, abs).replace(/\\/g, '/')));
  return out;
}

module.exports = { findUndefined, GLOBALS, ALLOW };

if (require.main === module) {
  if (process.argv.includes('--list')) { console.log([...GLOBALS].sort().join('\n')); process.exit(0); }
  const hits = findUndefined();
  for (const h of hits) console.log('  ' + h.rel + '  ' + h.name + '  บรรทัด ' + h.lines.slice(0, 5).join(','));
  console.log(hits.length ? '\n✗ พบชื่อที่ไม่มีที่ประกาศ ' + hits.length + ' จุด' : '\n✓ ไม่มีชื่อที่หาที่ประกาศไม่เจอ');
  process.exit(hits.length ? 1 : 0);
}
