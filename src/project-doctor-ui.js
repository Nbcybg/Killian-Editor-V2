// project-doctor-ui.js — [alpha.156] กล่อง "ตรวจสุขภาพโปรเจกต์" + ตัวลงมือซ่อม
//
// ตัววินิจฉัยเป็นโมดูลบริสุทธิ์ (project-doctor.js) · ที่นี่: อ่านดิสก์ → ภาพถ่าย → กล่อง → ซ่อม
// การซ่อมทุกอย่างเขียนผ่าน kapi (มีประวัติการทำงานให้ย้อนกลับ) และ `mutateJson` (ไม่ทับงานอื่น)
import { t, tf } from './i18n.js';
import { el, state, setStatus, log, logAction, withBusy } from './core.js';
import { confirmBox, escClose } from './ui.js';
import { parseMdFile, dumpMdFile, repairFrontmatter } from './md.js';
import { diagnoseDraft, newSceneRow, newChapterEntry, summarize } from './project-doctor.js';
import { mutateJson } from './json-store.js';
import { tabHandle } from './tab-bridge.js';
import { gi } from './icons.js';

// คีย์เต็มเสมอ — ประตูกันพลาด i18n-keys ตรวจคีย์ที่ประกอบด้วยการต่อสตริงไม่ได้
const TYPE_KEY = {
  'bad-json': 'ui.doctor.tBadJson', 'missing-file': 'ui.doctor.tMissingFile', 'duplicate-ref': 'ui.doctor.tDuplicateRef',
  'rows-without-chapter': 'ui.doctor.tRowsWithoutChapter', 'ghost-folder': 'ui.doctor.tGhostFolder',
  'orphan-file': 'ui.doctor.tOrphanFile', 'frontmatter': 'ui.doctor.tFrontmatter', 'missing-folder': 'ui.doctor.tMissingFolder',
};
const FIX_KEY = {
  'mkdir': 'ui.doctor.fixMkdir', 'create-file': 'ui.doctor.fixCreateFile', 'split-copy': 'ui.doctor.fixSplitCopy',
  'register-chapter': 'ui.doctor.fixRegisterChapter', 'attach-row': 'ui.doctor.fixAttachRow',
  'repair-frontmatter': 'ui.doctor.fixRepairFrontmatter',
};
const nextOrder = (list) => Math.max(0, ...(list || []).map((x) => x.order || 0)) + 1;

/** ข้อความหนึ่งบรรทัดของปัญหา (ข้อมูลของผู้ใช้ถูกแทรกเป็นค่า ไม่ใช่ HTML) */
export function describeIssue(it) {
  const k = TYPE_KEY[it.type] || TYPE_KEY['bad-json'];
  switch (it.type) {
    case 'bad-json': return tf(k, it.file);
    case 'missing-file': return tf(k, it.title, it.file);
    case 'duplicate-ref': return tf(k, it.title, it.other, it.file);
    case 'rows-without-chapter': return tf(k, it.count);
    case 'ghost-folder': return tf(k, it.folder, it.count);
    case 'orphan-file': return tf(k, it.file, it.title);
    case 'frontmatter': return tf(k, it.file, (it.keys || []).join(', '));
    case 'missing-folder': return tf(k, it.title, it.folder);
    default: return String(it.type);
  }
}

/** อ่านทุกฉบับร่างของโปรเจกต์ → รายการปัญหา */
export async function scanProject() {
  if (!state.root) return [];
  const A = await import('./app.js');
  const issues = [];
  for (const d of await A.listDrafts()) {
    const readOr = async (name, empty) => {
      const p = await kapi.join(d.dPath, name);
      if (!(await kapi.exists(p))) return empty;          // ฉบับร่างใหม่ที่ยังไม่มีไฟล์ = ว่าง ไม่ใช่ "เสีย"
      try { return await kapi.readJson(p); } catch { return null; }
    };
    const snap = { dPath: d.dPath, label: d.label, folders: [], files: {}, texts: {},
                   draft: await readOr('draft.json', { chapters: [] }),
                   scenes: await readOr('scenes.json', { chapters: {} }) };
    const chDir = await kapi.join(d.dPath, 'Chapters');
    if (await kapi.exists(chDir)) {
      snap.folders = await kapi.listDirs(chDir).catch(() => []);
      for (const f of snap.folders) {
        const dir = await kapi.join(chDir, f);
        const files = await kapi.listFiles(dir, '.md').catch(() => []);
        snap.files[f] = files;
        for (const fn of files) {
          try { snap.texts[f + '/' + fn] = await kapi.readFile(await kapi.join(dir, fn)); } catch {}
        }
      }
    }
    issues.push(...diagnoseDraft(snap));
  }
  return issues;
}

async function fixOne(it, A, freeSceneFileName) {
  const chDir = await kapi.join(it.dPath, 'Chapters');
  const sf = await kapi.join(it.dPath, 'scenes.json');
  const df = await kapi.join(it.dPath, 'draft.json');
  switch (it.fix && it.fix.kind) {
    case 'mkdir':
      await kapi.mkdir(await kapi.join(chDir, it.folder));
      return true;
    case 'create-file': {
      const p = await kapi.join(chDir, it.folder, it.file);
      if (await kapi.exists(p)) return false;
      await kapi.mkdir(await kapi.join(chDir, it.folder));
      await kapi.writeFile(p, dumpMdFile({ title: it.title || it.file.replace(/\.md$/i, ''), type: 'scene', format: 'prose' }, ''));
      return true;
    }
    case 'attach-row': {
      const r = await mutateJson(kapi, sf, (d) => {
        d.chapters = d.chapters || {};
        const rows = d.chapters[it.chGuid] || [];
        if (rows.some((x) => x.fileName === it.file)) return false;
        rows.push(newSceneRow({ id: A.guid(), title: it.title, fileName: it.file, chGuid: it.chGuid, order: nextOrder(rows) }));
        d.chapters[it.chGuid] = rows;
      }, { fallback: { chapters: {} } });
      return r.changed;
    }
    case 'split-copy': {
      const d0 = await kapi.readJson(sf);
      const rows0 = ((d0.chapters || {})[it.chGuid]) || [];
      const row0 = rows0.find((x) => x.id === it.rowId);
      if (!row0 || row0.fileName !== it.file) return false;
      const name = await freeSceneFileName(it.dPath, it.folder, row0.order || nextOrder(rows0),
                                           new Set(rows0.map((x) => x.fileName)));
      let text = '';
      try { text = await kapi.readFile(await kapi.join(chDir, it.folder, it.file)); } catch {}
      const { meta, body } = parseMdFile(text);
      if (row0.title) meta.title = row0.title;
      await kapi.writeFile(await kapi.join(chDir, it.folder, name), dumpMdFile(meta, body));
      const r = await mutateJson(kapi, sf, (d) => {
        const row = (((d.chapters || {})[it.chGuid]) || []).find((x) => x.id === it.rowId);
        if (!row) return false;
        row.fileName = name;
      });
      return r.changed;
    }
    case 'register-chapter': {
      const guid0 = it.fix.chGuid || A.guid();
      await mutateJson(kapi, df, (d) => {
        d.chapters = d.chapters || [];
        if (d.chapters.some((c) => c.folderName === it.folder)) return false;
        d.chapters.push(newChapterEntry({ guid: guid0, title: it.fix.title, folderName: it.folder, order: nextOrder(d.chapters) }));
      }, { fallback: { chapters: [] } });
      const dir = await kapi.join(chDir, it.folder);
      const files = await kapi.listFiles(dir, '.md').catch(() => []);
      const titles = {};
      for (const f of files) {
        try { titles[f] = parseMdFile(await kapi.readFile(await kapi.join(dir, f))).meta.title || ''; } catch {}
      }
      await mutateJson(kapi, sf, (d) => {
        d.chapters = d.chapters || {};
        const rows = d.chapters[guid0] || [];
        let n = 0;
        for (const f of files) {
          if (rows.some((x) => x.fileName === f)) continue;
          rows.push(newSceneRow({ id: A.guid(), title: titles[f], fileName: f, chGuid: guid0, order: nextOrder(rows) }));
          n++;
        }
        d.chapters[guid0] = rows;
        if (!n) return false;
      }, { fallback: { chapters: {} } });
      return true;
    }
    case 'repair-frontmatter': {
      const p = await kapi.join(chDir, it.folder, it.file);
      const r = repairFrontmatter(await kapi.readFile(p));
      if (!r.changed) return false;
      await kapi.writeFile(p, r.text);
      // แท็บที่เปิดไฟล์นี้อยู่ต้องเห็นค่าที่กู้ ไม่งั้นบันทึกครั้งถัดไปเขียนของเสียกลับ
      const h = tabHandle(p);
      if (h && !h.dirty) await h.reloadFromDisk();
      else if (h) await A.syncOpenTabMeta(p);
      return true;
    }
    default: return false;
  }
}

/** ซ่อมรายการที่ส่งมา (ข้ามรายการที่ไม่มีวิธีซ่อม) → {ok, failed} */
export async function applyDoctorFixes(list) {
  const A = await import('./app.js');
  const { freeSceneFileName } = await import('./scene-ops.js');
  let ok = 0, failed = 0;
  for (const it of list || []) {
    if (!it || !it.fix) continue;
    try { if (await fixOne(it, A, freeSceneFileName)) ok++; }
    catch (e) { failed++; log('error', t('ui.doctor.fixFail') + it.type, e); }
  }
  logAction('doctor', tf('ui.doctor.fixedN', ok, failed),
            (list || []).map((x) => ({ type: x.type, folder: x.folder || '', file: x.file || '' })));
  try { await A.buildTree(); A.refreshNetwork(); } catch {}
  refreshDoctorBadge().catch(() => {});        // [alpha.159 · QoL] ซ่อมแล้วป้ายต้องอัปเดตทันที (ไม่รอรอบหน่วง)
  return { ok, failed };
}

// ══ [alpha.159 · QoL] ป้ายจำนวนปัญหาบนแถบสถานะ — เห็นก่อนที่ปัญหาจะกลายเป็นงานหาย ══
// สแกนเบื้องหลังแบบหน่วงรวบ (หลังเปิดโปรเจกต์ / หลังโครงเปลี่ยน) · 0 ปัญหา = ป้ายว่าง (ซ่อนด้วย CSS :empty)
// สแกนอ่านทุกไฟล์ฉากของโปรเจกต์ → โปรเจกต์ใหญ่หนักจริง · จึงหน่วงรวบ + เว้นอย่างน้อย MIN_GAP ระหว่างรอบ
// (buildTree ถูกเรียกถี่มากระหว่างใช้งาน — ห้ามให้ทุกครั้งกลายเป็นการสแกนทั้งโปรเจกต์)
const BADGE = { job: null, seq: 0, lastAt: 0, root: '' };
const BADGE_MIN_GAP = 30000;
export function scheduleDoctorBadge(ms = 4000) {
  clearTimeout(BADGE.job);
  // เปลี่ยนโปรเจกต์ = สแกนใหม่ได้ทันที (ป้ายของโปรเจกต์เก่าต้องไม่ค้าง)
  const sameRoot = BADGE.root === (state.root || '');
  const wait = sameRoot ? Math.max(ms, BADGE.lastAt + BADGE_MIN_GAP - Date.now()) : ms;
  BADGE.job = setTimeout(() => { refreshDoctorBadge().catch(() => {}); }, wait);
}
/** @returns {Promise<number>} จำนวนปัญหาที่พบ (-1 = ไม่ได้สแกน) */
export async function refreshDoctorBadge() {
  const b = document.getElementById('status-doctor');
  if (!b) return -1;
  if (!state.root) { b.textContent = ''; b.title = ''; return -1; }
  const seq = ++BADGE.seq;
  BADGE.lastAt = Date.now(); BADGE.root = state.root;
  let n = 0;
  try { n = (await scanProject()).length; } catch { return -1; }
  if (seq !== BADGE.seq) return -1;                  // มีรอบใหม่กว่าแล้ว — ทิ้งผลรอบนี้
  b.textContent = n ? gi('checklist') + ' ' + n : '';
  b.title = n ? tf('ui.doctor.badgeTip', n) : '';
  b.onclick = n ? () => { openProjectDoctor(); } : null;
  return n;
}

/** กล่องตรวจสุขภาพโปรเจกต์ (เมนู เครื่องมือ) */
export async function openProjectDoctor() {
  if (!state.root) { setStatus(t('ui.common.cantOpenProject')); return null; }
  const A = await import('./app.js');
  // งานค้างต้องลงไฟล์ก่อน — ไม่งั้นตรวจเจอ "ไฟล์หาย" ของฉากที่ยังไม่เคยบันทึก และการซ่อมจะถูกทับทีหลัง
  try { await A.saveAllTabs(true); } catch {}

  const ov = el('div', 'k-overlay');
  const box = el('div', 'k-dialog k-wide k-doctor');
  box.append(el('div', 'k-dlg-title', t('ui.doctor.title')));
  box.append(el('div', 'k-hint', t('ui.doctor.hint')));
  const summary = el('div', 'k-doctor-summary');
  const list = el('div', 'k-doctor-list');
  box.append(summary, list);
  const btns = el('div', 'k-dlg-btns');
  const bScan = el('button', null, t('ui.doctor.rescan'));
  const bClose = el('button', 'k-cancel', t('ui.common.close'));
  const bFix = el('button', 'k-ok', t('ui.doctor.fixSelected'));
  btns.append(bScan, bClose, bFix);
  box.append(btns);
  ov.append(box); document.body.append(ov);
  const close = () => ov.remove();
  bClose.onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  escClose(ov, close);

  let issues = [];
  let boxes = [];
  const render = () => {
    list.replaceChildren(); boxes = [];
    if (!issues.length) {
      summary.textContent = t('ui.doctor.allGood');
      bFix.disabled = true;
      return;
    }
    const sum = summarize(issues);
    summary.textContent = tf('ui.doctor.summary', issues.length) + ' · '
      + Object.entries(sum).map(([k, n]) => k + ' ' + n).join(' · ');
    for (const it of issues) {
      const row = el('label', 'k-doctor-row' + (it.fix ? '' : ' k-doctor-nofix'));
      const c = el('input'); c.type = 'checkbox'; c.checked = !!it.fix; c.disabled = !it.fix;
      boxes.push(c);
      const mid = el('div', 'k-doctor-mid');
      mid.append(el('div', 'k-doctor-text', describeIssue(it)));
      const where = [it.label, [it.folder, it.file].filter(Boolean).join('/')].filter(Boolean).join(' · ');
      mid.append(el('div', 'dim k-doctor-where', where));
      mid.append(el('div', 'k-doctor-fix', it.fix ? t(FIX_KEY[it.fix.kind]) : t('ui.doctor.reportOnly')));
      row.append(c, mid);
      list.append(row);
    }
    bFix.disabled = !issues.some((x) => x.fix);
  };
  const scan = async () => {
    list.replaceChildren(el('div', 'dim', t('ui.doctor.scanning')));
    issues = await withBusy(t('ui.doctor.scanning'), () => scanProject());
    render();
    return issues;
  };
  bScan.onclick = () => scan();
  bFix.onclick = async () => {
    const picked = issues.filter((it, i) => it.fix && boxes[i] && boxes[i].checked);
    if (!picked.length) return;
    if (!(await confirmBox(tf('ui.doctor.confirmFix', picked.length)))) return;
    bFix.disabled = true;
    const res = await applyDoctorFixes(picked);
    setStatus(tf('ui.doctor.fixedN', res.ok, res.failed));
    await scan();
  };
  await scan();
  return { ov, scan, close, issues: () => issues };
}
