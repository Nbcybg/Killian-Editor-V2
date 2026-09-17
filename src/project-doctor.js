// project-doctor.js — [alpha.156] "ตรวจสุขภาพโปรเจกต์": หาความไม่ตรงกันระหว่างทะเบียนกับไฟล์จริง
//
// ทำไมต้องมี: ข้อมูลของฉากอยู่สองที่ (ทะเบียน `draft.json`/`scenes.json` + ไฟล์ `.md` ในโฟลเดอร์บท)
// บั๊กรุ่นก่อน ๆ ทิ้งร่องรอยไว้ในโปรเจกต์ของผู้ใช้แล้ว และแก้ด้วยการอัปเดตโปรแกรมอย่างเดียวไม่ได้:
//   · เพิ่มฉากทับไฟล์เดิม → สองแถวชี้ไฟล์เดียวกัน          (duplicate-ref)
//   · แผงคุณสมบัติ/Kanban เขียนทะเบียนเก่าทับ → ไฟล์ไม่มีใครอ้าง  (orphan-file)
//   · ลบบทขณะแท็บเปิดอยู่ → โฟลเดอร์ผีเกิดใหม่             (ghost-folder)
//   · เรื่องย่อหลายบรรทัด → frontmatter พัง                  (frontmatter)
//   · ไฟล์ถูกลบ/ย้ายนอกโปรแกรม                              (missing-file · missing-folder)
//
// ไฟล์นี้ **บริสุทธิ์**: รับ "ภาพถ่าย" ของฉบับร่างที่ UI อ่านมาจากดิสก์ → คืนรายการปัญหา + วิธีซ่อม
// ตัวลงมือซ่อมจริงอยู่ที่ project-doctor-ui.js
import { parseMdFile, repairFrontmatter } from './md.js';

/** ลำดับความรุนแรง (น้อย = ร้ายแรงกว่า) — ใช้เรียงรายการในกล่อง */
export const DOCTOR_TYPES = ['bad-json', 'missing-file', 'duplicate-ref', 'rows-without-chapter',
  'ghost-folder', 'orphan-file', 'frontmatter', 'missing-folder'];

const chapterTitleFromFolder = (f) => String(f || '').replace(/^\d+\s*-\s*/, '').trim() || String(f || '');

/**
 * @typedef {{dPath:string, label?:string, draft:object|null, scenes:object|null,
 *   folders:string[], files:Object<string,string[]>, texts?:Object<string,string>}} DraftSnapshot
 *   files = โฟลเดอร์บท → ชื่อไฟล์ .md · texts = "โฟลเดอร์/ไฟล์" → เนื้อไฟล์ทั้งหมด
 */

/**
 * @param {DraftSnapshot} s
 * @returns {Array<object>} ปัญหา — `fix` = null แปลว่ารายงานอย่างเดียว ซ่อมอัตโนมัติไม่ได้
 */
export function diagnoseDraft(s) {
  const issues = [];
  const dPath = s.dPath;
  const add = (o) => issues.push({ dPath, label: s.label || '', ...o });
  if (!s.draft) add({ type: 'bad-json', file: 'draft.json', fix: null });
  if (!s.scenes) add({ type: 'bad-json', file: 'scenes.json', fix: null });
  const chapters = (s.draft && Array.isArray(s.draft.chapters)) ? s.draft.chapters : [];
  const rowsBy = (s.scenes && s.scenes.chapters && typeof s.scenes.chapters === 'object') ? s.scenes.chapters : {};
  const folders = new Set(s.folders || []);
  const filesOf = (f) => new Set((s.files || {})[f] || []);
  const known = new Set(chapters.map((c) => c.folderName));
  const guids = new Set(chapters.map((c) => c.guid));

  // แถวของบทที่ไม่มีใน draft.json — ถ้าเจอโฟลเดอร์ผีที่มีไฟล์ของแถวพวกนี้ครบ = "บทที่หลุดจากทะเบียน"
  const strayGroups = Object.keys(rowsBy).filter((g) => !guids.has(g) && (rowsBy[g] || []).length);
  const claimed = new Set();
  for (const f of folders) {
    if (known.has(f)) continue;
    const have = filesOf(f);
    const g = strayGroups.find((gg) => !claimed.has(gg)
      && (rowsBy[gg] || []).every((r) => r.fileName && have.has(r.fileName)));
    if (g) claimed.add(g);
    add({ type: 'ghost-folder', folder: f, count: have.size, chGuid: g || '',
          fix: { kind: 'register-chapter', title: chapterTitleFromFolder(f), chGuid: g || '' } });
  }
  for (const g of strayGroups) {
    if (claimed.has(g)) continue;
    add({ type: 'rows-without-chapter', chGuid: g, count: rowsBy[g].length, fix: null });
  }

  for (const c of chapters) {
    const folderOk = !!c.folderName && folders.has(c.folderName);
    if (c.folderName && !folderOk) {
      add({ type: 'missing-folder', chGuid: c.guid, folder: c.folderName, title: c.title || '', fix: { kind: 'mkdir' } });
    }
    const rows = rowsBy[c.guid] || [];
    const have = filesOf(c.folderName);
    const seen = new Map();
    for (const r of rows) {
      if (!r || !r.fileName) continue;
      if (seen.has(r.fileName)) {
        add({ type: 'duplicate-ref', chGuid: c.guid, folder: c.folderName, file: r.fileName,
              rowId: r.id, title: r.title || '', other: seen.get(r.fileName).title || '',
              fix: { kind: 'split-copy' } });
        continue;
      }
      seen.set(r.fileName, r);
      if (!have.has(r.fileName)) {
        add({ type: 'missing-file', chGuid: c.guid, folder: c.folderName, file: r.fileName,
              rowId: r.id, title: r.title || '', fix: { kind: 'create-file' } });
      }
    }
    for (const f of have) {
      if (seen.has(f)) continue;
      let title = '';
      try { title = parseMdFile((s.texts || {})[c.folderName + '/' + f] || '').meta.title || ''; } catch {}
      add({ type: 'orphan-file', chGuid: c.guid, folder: c.folderName, file: f,
            title: String(title || f.replace(/\.md$/i, '')), fix: { kind: 'attach-row' } });
    }
  }

  for (const [key, text] of Object.entries(s.texts || {})) {
    const r = repairFrontmatter(text);
    if (!r.changed) continue;
    const i = key.lastIndexOf('/');
    add({ type: 'frontmatter', folder: key.slice(0, i), file: key.slice(i + 1),
          keys: r.recovered, fix: { kind: 'repair-frontmatter' } });
  }

  const rank = (t) => { const i = DOCTOR_TYPES.indexOf(t); return i < 0 ? 99 : i; };
  return issues.sort((a, b) => rank(a.type) - rank(b.type));
}

/** แถวฉากใหม่สำหรับไฟล์ที่ต้องผูกกลับเข้าทะเบียน (โครงเดียวกับ addScene) */
export function newSceneRow({ id, title, fileName, chGuid, order }) {
  return { id, title: String(title || fileName.replace(/\.md$/i, '')), order, fileName,
           chapterGuid: chGuid, date: '', isFavorite: false, wordCount: 0, synopsis: '' };
}

/** แถวบทใหม่สำหรับโฟลเดอร์ผี (โครงเดียวกับ addChapter) */
export function newChapterEntry({ guid, title, folderName, order }) {
  return { guid, title: String(title || folderName), order, status: 'Outline', act: 'I', date: '',
           isFavorite: false, folderName };
}

/** จำนวนปัญหาแยกตามชนิด (สรุปหัวกล่อง) */
export function summarize(issues) {
  const out = {};
  for (const it of issues || []) out[it.type] = (out[it.type] || 0) + 1;
  return out;
}
