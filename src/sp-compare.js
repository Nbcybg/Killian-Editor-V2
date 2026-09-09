// sp-compare.js — [alpha.60 ข้อ 74] เปรียบเทียบบทภาพยนตร์ 2 ฉบับ
// LCS diff + color-coded HTML output (deleted=แดง, added=เขียว, context=ขาว, change=เหลือง)
import { t, tf } from './i18n.js';
import { parseScript, SP_ELEMS } from './fountain.js';
import { escClose } from './ui.js';

// [74] เปรียบเทียบบท 2 ชุด → diffs แบบมีสี
export function compareScripts(oldText, newText) {
  const oldBlocks = parseScript(oldText);
  const newBlocks = parseScript(newText);

  // สร้าง array ของข้อความ (รวม blank ด้วย)
  const oldLines = oldBlocks.map(b => b.el === 'blank' ? '' : (SP_PREFIX[b.el] || '') + b.text);
  const newLines = newBlocks.map(b => b.el === 'blank' ? '' : (SP_PREFIX[b.el] || '') + b.text);

  // LCS diff algorithm
  const diffs = lineDiff(oldLines, newLines);

  return diffs;
}

// [74] สร้าง HTML สำหรับแสดงผลเปรียบเทียบ
export function renderComparisonHtml(diffs, labels = {}) {
  const leftLabel = labels.old || t('ui.spCompare.edition');
  const rightLabel = labels.new || t('ui.spCompare.editionNew');

  let html = `<div class="k-compare-wrap">
<style>
.k-compare-wrap { font-family: 'Courier Prime', 'Courier New', monospace, 'Thonburi', 'Leelawadee UI', 'TH Sarabun New', 'Sarabun', 'Noto Sans Thai'; font-size:12px;
  line-height:1.6; max-width:100%; overflow-x:auto; }
.k-compare-header { display:flex; border-bottom:2px solid #666; margin-bottom:8px; }
.k-compare-hdr-left, .k-compare-hdr-right { flex:1; padding:4px 8px; font-weight:bold; text-align:center; }
.k-compare-hdr-left { background:#fff5f5; color:#b00; }
.k-compare-hdr-right { background:#f5fff5; color:#070; }
.k-compare-row { display:flex; border-bottom:1px solid #eee; min-height:20px; }
.k-compare-cell { padding:1px 8px; white-space:pre-wrap; word-break:break-all; flex:1; }
.k-cmp-del { background:#ffe0e0; color:#b00; }
.k-cmp-add { background:#e0ffe0; color:#070; }
.k-cmp-eq  { background:#fff; color:#333; }
.k-cmp-chg { background:#ffffd0; }
.k-cmp-chg .k-cmp-add { background:#e0ffe0; }
.k-cmp-chg .k-cmp-del { background:#ffe0e0; }
.k-compare-sep { height:4px; background:#ccc; margin:2px 0; }
.k-compare-empty { color:#aaa; font-style:italic; }
</style>
<div class="k-compare-header">
  <div class="k-compare-hdr-left">${escHtml(leftLabel)}</div>
  <div class="k-compare-hdr-right">${escHtml(rightLabel)}</div>
</div>`;

  for (const d of diffs) {
    const leftCls = d.type === 'delete' ? 'k-cmp-del' : d.type === 'equal' ? 'k-cmp-eq' : 'k-cmp-chg';
    const rightCls = d.type === 'insert' ? 'k-cmp-add' : d.type === 'equal' ? 'k-cmp-eq' : 'k-cmp-chg';
    const leftText = d.old != null ? escHtml(d.old) : '<span class="k-compare-empty">—</span>';
    const rightText = d.new != null ? escHtml(d.new) : '<span class="k-compare-empty">—</span>';

    if (d.type === 'change') {
      html += `<div class="k-compare-row" style="background:#ffffd0">
  <div class="k-compare-cell k-cmp-del">${escHtml(d.old || '')}</div>
  <div class="k-compare-cell k-cmp-add">${escHtml(d.new || '')}</div>
</div>`;
    } else if (d.type === 'equal') {
      html += `<div class="k-compare-row">
  <div class="k-compare-cell k-cmp-eq">${leftText}</div>
  <div class="k-compare-cell k-cmp-eq">${rightText}</div>
</div>`;
    } else if (d.type === 'delete') {
      html += `<div class="k-compare-row">
  <div class="k-compare-cell k-cmp-del">${leftText}</div>
  <div class="k-compare-cell k-cmp-eq">&nbsp;</div>
</div>`;
    } else if (d.type === 'insert') {
      html += `<div class="k-compare-row">
  <div class="k-compare-cell k-cmp-eq">&nbsp;</div>
  <div class="k-compare-cell k-cmp-add">${rightText}</div>
</div>`;
    }
  }

  html += `</div>`;
  return html;
}

// [74] แสดงผลเปรียบเทียบใน dialog — ใช้ได้กับทั้งนิยายและบท
export function showComparisonDialog(oldText, newText, labels) {
  const diffs = compareScripts(oldText, newText);
  const html = renderComparisonHtml(diffs, labels);

  const ov = document.createElement('div');
  ov.className = 'k-overlay';
  ov.innerHTML = tf('ui.spCompare.compareClose', html);
  document.body.appendChild(ov);

  const stats = diffStats(diffs);
  const el = ov.querySelector('.k-dlg-title');
  if (el) {
    el.innerHTML += tf('ui.spCompare.msg', stats.equal, stats.inserted, stats.deleted, stats.changed);
  }

  ov.querySelector('.k-ok').onclick = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  escClose(ov, () => ov.remove());            // [alpha.124 ข้อ 15]
}

// [74] สถิติการเปรียบเทียบ
export function diffStats(diffs) {
  let equal = 0, inserted = 0, deleted = 0, changed = 0;
  for (const d of diffs) {
    if (d.type === 'equal') equal++;
    else if (d.type === 'insert') inserted++;
    else if (d.type === 'delete') deleted++;
    else if (d.type === 'change') changed++;
  }
  return { equal, inserted, deleted, changed, total: diffs.length };
}

// ===================== LCS Diff Algorithm =====================
// [74] standard LCS → backtrack → generate diff operations
function lineDiff(oldLines, newLines) {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diffs
  const diffs = [];
  let i = m, j = n;

  // เก็บ equal มาช้าที่สุดเพื่อจับคู่ change
  const result = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // equal — ลองเช็คว่ามี delete+insert ก่อนหน้านี้ที่ควรเป็น change ไหม
      result.unshift({ type: 'equal', old: oldLines[i - 1], new: newLines[j - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'insert', new: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'delete', old: oldLines[i - 1] });
      i--;
    }
  }

  // Post-process: merge consecutive delete+insert pairs into "change"
  const merged = [];
  let delBuf = [], insBuf = [];
  for (const r of result) {
    if (r.type === 'delete') {
      if (insBuf.length) {
        if (delBuf.length) merged.push(...delBuf.map(d => ({ type: 'delete', old: d })));
        merged.push(...insBuf.map(d => ({ type: 'insert', new: d })));
        insBuf = [];
      }
      delBuf.push(r.old);
    } else if (r.type === 'insert') {
      insBuf.push(r.new);
    } else {
      // equal — flush pending
      if (delBuf.length && insBuf.length) {
        // pair them up as changes
        const maxLen = Math.max(delBuf.length, insBuf.length);
        for (let k = 0; k < maxLen; k++) {
          const old = k < delBuf.length ? delBuf[k] : '';
          const nw = k < insBuf.length ? insBuf[k] : '';
          if (old && nw) merged.push({ type: 'change', old, new: nw });
          else if (old) merged.push({ type: 'delete', old });
          else if (nw) merged.push({ type: 'insert', new: nw });
        }
      } else if (delBuf.length) {
        merged.push(...delBuf.map(d => ({ type: 'delete', old: d })));
      } else if (insBuf.length) {
        merged.push(...insBuf.map(d => ({ type: 'insert', new: d })));
      }
      delBuf = []; insBuf = [];
      merged.push(r);
    }
  }
  // flush remaining at end
  if (delBuf.length || insBuf.length) {
    if (delBuf.length && insBuf.length) {
      const maxLen = Math.max(delBuf.length, insBuf.length);
      for (let k = 0; k < maxLen; k++) {
        const old = k < delBuf.length ? delBuf[k] : '';
        const nw = k < insBuf.length ? insBuf[k] : '';
        if (old && nw) merged.push({ type: 'change', old, new: nw });
        else if (old) merged.push({ type: 'delete', old });
        else if (nw) merged.push({ type: 'insert', new: nw });
      }
    } else if (delBuf.length) {
      merged.push(...delBuf.map(d => ({ type: 'delete', old: d })));
    } else if (insBuf.length) {
      merged.push(...insBuf.map(d => ({ type: 'insert', new: d })));
    }
  }

  return merged;
}

// ===================== helpers =====================
// prefix ของแต่ละ element — ดึงจาก SP_ELEMS (fountain.js) ซึ่งเป็นแหล่งความจริงเดียว
// (เดิมคัดลอกตารางมาไว้ที่นี่ → เปลี่ยน prefix ที่ fountain.js แล้วการเทียบบทเพี้ยนเงียบ ๆ)
// element ที่ "ไม่มี prefix ตอนเขียนไฟล์" (บทพูด/วงเล็บ/รูป/raw) ต้องคงเป็นค่าว่างเหมือนเดิม
const NO_PREFIX = new Set(['dialogue', 'parenthetical', 'image', 'raw', 'blank']);
const SP_PREFIX = Object.fromEntries(Object.entries(SP_ELEMS).map(([k, v]) => {
  if (NO_PREFIX.has(k)) return [k, ''];
  const p = String(v.prefix || '');
  // prefix ที่เป็นสัญลักษณ์ตัวเดียว (. ! @ > (() เขียนติดข้อความในไฟล์ แต่ตอน "เทียบบท"
  // เว้นวรรคให้อ่านง่ายกว่า — ขอแค่สองฝั่งใช้กติกาเดียวกัน
  return [k, p && !p.endsWith(' ') ? p + ' ' : p];
}));


function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
