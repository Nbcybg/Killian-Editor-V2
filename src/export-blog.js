// export-blog.js — ส่งออกเป็น HTML สำหรับบล็อก (Medium/WordPress) · Ctrl+Shift+B
// เดิมยัด markdown ดิบ (รวม frontmatter) ลง <div> → บล็อกได้ตัวอักษร # ** ติดไปด้วย
// รอบนี้: เลือกธีม/หัวบท/หัวฉากได้ + ฝังรูปเป็น data URI (อัปโหลดที่เดียวจบ ไม่ต้องแนบรูปแยก)
import { el, state, setStatus, log, setBusy, clearBusy } from './core.js';
import { mdToHtmlBody, escapeHtml, stripComments, stripMentions } from './compile.js';
import { parseMdFile } from './md.js';

const SKIP_SECTIONS = ['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', '.k2history', 'Backups', 'Plugins', 'Research'];

export const BLOG_THEMES = {
  medium: { label: 'Medium (การ์ดครีม)', css: `
body{max-width:720px;margin:40px auto;padding:0 20px;font:16px/1.8 Georgia,serif;color:#333;background:#fff}
h1{font-size:2em;border-bottom:2px solid #eee;padding-bottom:8px}
h2{font-size:1.5em;margin:32px 0 12px;color:#555}
h3{font-size:1.2em;color:#777}
article{margin:0 0 32px;padding:16px;background:#fafafa;border-radius:8px}
blockquote{border-left:3px solid #ccc;margin:1em 0;padding-left:1em;color:#666}
img{max-width:100%}
@media(prefers-color-scheme:dark){body{color:#e8e6df;background:#1a1a1a}h1{border-color:#333}h2{color:#aaa}article{background:#222}}` },
  minimal: { label: 'เรียบ (ไม่มีกรอบ)', css: `
body{max-width:680px;margin:48px auto;padding:0 20px;font:17px/1.9 -apple-system,"Segoe UI",Tahoma,sans-serif;color:#222;background:#fff}
h1{font-size:1.9em;font-weight:600}
h2{font-size:1.35em;margin:40px 0 8px;font-weight:600}
h3{font-size:1.1em;color:#666;font-weight:600}
article{margin:0 0 28px}
blockquote{border-left:2px solid #ddd;margin:1em 0;padding-left:1em;color:#555}
img{max-width:100%}
@media(prefers-color-scheme:dark){body{color:#e6e6e6;background:#141414}h3{color:#9a9a9a}blockquote{border-color:#444;color:#aaa}}` },
  dark: { label: 'มืด (อ่านกลางคืน)', css: `
body{max-width:720px;margin:40px auto;padding:0 20px;font:16px/1.85 Georgia,serif;color:#e8e6df;background:#16171a}
h1{font-size:2em;border-bottom:2px solid #2c2e33;padding-bottom:8px}
h2{font-size:1.5em;margin:32px 0 12px;color:#d97757}
h3{font-size:1.15em;color:#9aa0a6}
article{margin:0 0 32px;padding:16px;background:#1d1f23;border-radius:8px}
blockquote{border-left:3px solid #d97757;margin:1em 0;padding-left:1em;color:#b8b5ad}
img{max-width:100%}` },
};

const DEFAULT_OPTS = { theme: 'medium', chapterHeads: true, sceneHeads: true, embedImages: false };

export function getBlogOptions() {
  return { ...DEFAULT_OPTS, ...((state.meta && state.meta.blogExport) || {}) };
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
               webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif' };

// รูปในเนื้อฉากอ้างแบบ ../Images/<ชื่อไฟล์> → ฝังเป็น data URI
// ไบนารีต้องผ่าน readBytes เท่านั้น (readFile เป็น utf-8 → ไบต์ ≥0x80 บวม ไฟล์เสีย)
async function embedImages(html, cache) {
  const srcs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  for (const src of new Set(srcs)) {
    if (/^(data:|https?:)/i.test(src)) continue;
    if (cache.has(src)) { html = html.split(`src="${src}"`).join(`src="${cache.get(src)}"`); continue; }
    try {
      const base = src.split(/[\\/]/).pop();
      const fp = await kapi.join(state.root, 'Images', base);
      if (!(await kapi.exists(fp))) { cache.set(src, src); continue; }
      const bytes = await kapi.readBytes(fp);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192)
        bin += String.fromCharCode.apply(null, bytes.slice(i, i + 8192));
      const mime = MIME[(base.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
      const uri = `data:${mime};base64,${btoa(bin)}`;
      cache.set(src, uri);
      html = html.split(`src="${src}"`).join(`src="${uri}"`);
    } catch (e) { log('warn', 'export-blog: ฝังรูปไม่ได้ ' + src, e); cache.set(src, src); }
  }
  return html;
}

/**
 * สร้าง HTML ทั้งหน้า — แยกจากขั้นตอนเลือกไฟล์เพื่อให้ selftest เรียกตรง ๆ ได้
 * คืน { html, nScenes, nImages }
 */
export async function buildBlogHtml(opts = {}) {
  const o = { ...getBlogOptions(), ...opts };
  const imgCache = new Map();
  let body = '';
  let nScenes = 0;
  for (const sec of await kapi.listDirs(state.root)) {
    if (SKIP_SECTIONS.includes(sec)) continue;
    const sp = await kapi.join(state.root, sec);
    if (!(await kapi.exists(await kapi.join(sp, 'section.json')))) continue;
    const dr = await kapi.join(sp, 'Draft');
    if (!(await kapi.exists(dr))) continue;
    for (const dn of await kapi.listDirs(dr)) {
      const dp = await kapi.join(dr, dn);
      const dj = await kapi.join(dp, 'draft.json');
      if (!(await kapi.exists(dj))) continue;
      const draft = await kapi.readJson(dj);
      const scData = await kapi.readJson(await kapi.join(dp, 'scenes.json')).catch(() => ({}));
      const chMap = scData.chapters || {};
      for (const ch of (draft.chapters || [])) {
        if (o.chapterHeads) body += `<h2>${escapeHtml(ch.title || '')}</h2>\n`;
        for (const sc of (chMap[ch.guid] || [])) {
          if (sc.type === 'memo') continue;
          const fp = await kapi.join(dp, 'Chapters', ch.folderName, sc.fileName);
          try {
            const raw = await kapi.readFile(fp);
            const { body: md } = parseMdFile(raw);            // ตัด frontmatter ออก
            const clean = stripMentions(stripComments(md));    // เอา %%โน้ต%% / [[ลิงก์]] ออก
            let inner = mdToHtmlBody(clean);
            if (o.embedImages) inner = await embedImages(inner, imgCache);
            const head = o.sceneHeads ? `<h3>${escapeHtml(sc.title || '')}</h3>\n` : '';
            body += `<article>\n${head}${inner}\n</article>\n`;
            nScenes++;
          } catch (e) { log('warn', 'export-blog: ข้ามฉาก ' + fp, e); }
        }
      }
    }
  }

  const title = escapeHtml(state.title || 'Blog Export');
  const css = (BLOG_THEMES[o.theme] || BLOG_THEMES.medium).css;
  const html = `<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${css}
</style></head><body>
<h1>${title}</h1>
${body}<p style="color:#999;font-size:12px;margin-top:40px">ส่งออกจาก Killian 2</p>
</body></html>`;
  const nImages = [...imgCache.values()].filter((v) => v.startsWith('data:')).length;
  return { html, nScenes, nImages };
}

// ---- กล่องตัวเลือก (จำค่าไว้ใน project.khn.json → ครั้งหน้าไม่ต้องตั้งใหม่) ----
function optionsDialog() {
  return new Promise((resolve) => {
    const o = getBlogOptions();
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-blog-opts');
    box.append(el('div', 'k-dlg-title', '🌐 ส่งออกเป็น HTML สำหรับบล็อก'));

    const mkRow = (label) => { const r = el('div', 'wiki-row'); r.append(el('label', null, label)); box.append(r); return r; };
    const themeRow = mkRow('ธีม');
    const themeSel = el('select', 'wiki-input k-dlg-select');
    for (const [k, v] of Object.entries(BLOG_THEMES)) {
      const opt = el('option', null, v.label); opt.value = k; themeSel.append(opt);
    }
    themeSel.value = o.theme;
    themeRow.append(themeSel);

    const mkChk = (label, val, hint) => {
      const r = mkRow(label);
      const c = el('input'); c.type = 'checkbox'; c.checked = val;
      r.append(c);
      if (hint) { const h = el('div', 'dim', hint); h.style.cssText = 'font-size:11px;margin:-4px 0 6px'; box.append(h); }
      return c;
    };
    const chCh = mkChk('ใส่ชื่อบท (H2)', o.chapterHeads);
    const chSc = mkChk('ใส่ชื่อฉาก (H3)', o.sceneHeads);
    const chImg = mkChk('ฝังรูปในไฟล์ (base64)', o.embedImages,
                        'ไฟล์ใหญ่ขึ้นมาก แต่ก๊อปไปวางที่ไหนก็เห็นรูป ไม่ต้องอัปโหลดแยก');

    const btns = el('div', 'k-dlg-btns');
    const cB = el('button', 'k-cancel', 'ยกเลิก');
    const okB = el('button', 'k-ok', 'ส่งออก…');
    btns.append(cB, okB);
    box.append(btns);
    ov.append(box);
    document.body.append(ov);

    const close = (val) => { ov.remove(); resolve(val); };
    cB.onclick = () => close(null);
    ov.onclick = (e) => { if (e.target === ov) close(null); };
    okB.onclick = () => close({ theme: themeSel.value, chapterHeads: chCh.checked,
                               sceneHeads: chSc.checked, embedImages: chImg.checked });
  });
}

export async function exportBlogHTML(preset) {
  if (!state.root) { setStatus('ยังไม่ได้เปิดโปรเจกต์'); return false; }
  const o = preset || await optionsDialog();
  if (!o) return false;
  setBusy('กำลังสร้าง HTML…');                       // [alpha.62 บั๊ก 10] ฝังรูปทำให้ช้าได้เป็นนาที
  try {
    // จำตัวเลือกไว้ใช้ครั้งหน้า
    state.meta.blogExport = o;
    const { html, nScenes, nImages } = await buildBlogHtml(o);
    clearBusy();                                     // เคลียร์ก่อนเปิดกล่องบันทึกเสมอ
    const dest = await kapi.saveAsDialog((state.title || 'blog') + '-blog.html', 'html');
    if (!dest) return false;
    setBusy('กำลังเขียนไฟล์ HTML…');
    await kapi.writeFile(dest, html);
    try { const { saveProjectMeta } = await import('./app.js'); await saveProjectMeta(); } catch {}
    setStatus(`ส่งออก HTML สำหรับบล็อกแล้ว (${nScenes} ฉาก${nImages ? ` · ฝังรูป ${nImages} ไฟล์` : ''}): ` + dest);
    return true;
  } catch (e) {
    log('error', 'export-blog failed', e);
    setStatus('ส่งออก HTML ล้มเหลว');
    return false;
  } finally { clearBusy(); }
}
