// starter-export.js — แปลงตอนที่เล่นแล้วเป็นฉากจริงในต้นฉบับ (สเปกข้อ 14)
//
// ปลายทางตามที่ตกลงไว้: **เล่ม "Story Starter" → บท = ชื่อเรื่อง → ฉาก = ชื่อตอน**
// แปลงซ้ำได้ = ได้ฉากใหม่ต่อท้ายเสมอ ไม่ทับของเดิม (ผู้ใช้เทียบสองเวอร์ชันแล้วลบตัวที่ไม่เอาเอง)
//
// สองอย่างที่ทำให้ไฟล์นี้ไม่ใช่แค่ "ยิง AI แล้วเขียนไฟล์":
//   1. **บทยาวเกินบริบท** — แบ่งก้อนตัดตรงรอยต่อจังหวะเรื่อง แล้วต่อกลับ (starter-render-prose.js)
//   2. **ทางแยกต้องไหลเข้าระบบเรื่องแตกสาย** — เขียน `choices` ลง scenes.json ด้วยชื่อฟิลด์
//      ที่ `buildGraph` อ่านได้จริง คู่กับมาร์กเกอร์ `[ข้อความ]` ในเนื้อฉาก
//      (ระบบแตกสายเทียบสองฝั่งนี้กันเอง — มีแต่ข้างเดียวจะขึ้นเตือนว่า "กำพร้า")

import { el, state, setStatus, log } from '../core.js';
import { t, tf } from '../i18n.js';
import { listSections, addSection } from '../section-ops.js';
import { addChapter, addScene } from '../scene-ops.js';
import { buildTree } from '../app.js';
import { openChoices, transcriptText, charById } from './starter-model.js';
import { choiceRows } from './starter-choices.js';
import {
  chunkTurns, prosePrompt, proseBody, stitch, tailOf,
} from './starter-render-prose.js';
import { spPrompt, spBody } from './starter-render-sp.js';
import { writeScenario } from './starter-store.js';

/** ชื่อเล่มปลายทาง — **เป็นข้อมูลบนดิสก์ ไม่ใช่ข้อความ UI** จึงไม่แปลตามภาษา */
export const EXPORT_BOOK = 'Story Starter';

export const FORMATS = [
  { id: 'prose', label: t('ui.starter.cvProse'), icon: '📖' },
  { id: 'screenplay', label: t('ui.starter.cvSp'), icon: '🎬' },
];

// ───────────────────────── หาที่ลง ─────────────────────────

/** เล่ม "Story Starter" — มีอยู่แล้วใช้ของเดิม ไม่มีก็สร้าง */
async function ensureBook() {
  const secs = await listSections();
  const hit = secs.find((x) => (x.meta && x.meta.title) === EXPORT_BOOK);
  if (hit) return hit.secPath;
  const dir = await addSection(EXPORT_BOOK);
  return dir || '';
}

/** ฉบับร่างแรกของเล่ม (โปรเจกต์นี้ใช้ `Draft/<ชื่อ>/`) */
async function firstDraft(secPath) {
  const root = await kapi.join(secPath, 'Draft');
  if (!(await kapi.exists(root))) return '';
  const dirs = await kapi.listDirs(root);
  return dirs.length ? kapi.join(root, dirs[0]) : '';
}

/** บทชื่อเดียวกับเรื่อง — มีอยู่แล้วใช้ของเดิม */
async function ensureChapter(dPath, title) {
  const df = await kapi.join(dPath, 'draft.json');
  const d = await kapi.readJson(df);
  const hit = (d.chapters || []).find((c) => c.title === title);
  if (hit) return hit;
  return addChapter(dPath, title);
}

/**
 * เขียน `choices` ลงแถวฉากใน scenes.json
 * แยกออกมาเพราะ `addScene` ไม่รู้จักเรื่องทางแยก และไม่ควรต้องรู้
 */
async function setSceneChoices(dPath, chGuid, sceneId, rows) {
  if (!rows.length) return false;
  const sf = await kapi.join(dPath, 'scenes.json');
  const d = await kapi.readJson(sf);
  const list = (d.chapters || {})[chGuid] || [];
  const row = list.find((x) => x.id === sceneId);
  if (!row) return false;
  row.choices = rows;
  await kapi.writeFile(sf, JSON.stringify(d, null, 2));
  return true;
}

// ───────────────────────── ตัวแปลง ─────────────────────────

/**
 * แปลงหนึ่งตอน
 * @param {object} s     starter
 * @param {object} sc    scenario
 * @param {object} opts  format: 'prose'|'screenplay' · onProgress(done,total)
 * @returns {Promise<{path:string, chunks:number}|null>}
 */
export async function convertScenario(s, sc, { format = 'prose', onProgress = null, ai = null } = {}) {
  const turns = (sc.turns || []).filter((r) => String(r.text || '').trim());
  if (!turns.length) { setStatus(t('ui.starter.cvNothing')); return null; }

  // `ai` เป็นช่องให้เทสยิงตัวปลอมเข้ามาแทนโมเดลจริง — ทางเดินไฟล์ทั้งเส้นจึงทดสอบได้
  // โดยไม่ต้องมีอินเทอร์เน็ตหรือคีย์ (ท่าเดียวกับ `importScreenplayDialog(injectFn)`)
  const callAI = ai || (await import('../ai-settings.js')).callAI;
  const nameOf = (id) => { const c = charById(s, id); return (c && c.name) || ''; };
  const names = (s.cast || []).map((c) => c.name).filter(Boolean);
  const chunks = chunkTurns(turns);
  const parts = [];
  let tail = '';

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i, chunks.length);
    const build = format === 'screenplay' ? spPrompt : prosePrompt;
    const prompt = build(s, sc, chunks[i],
      { part: i + 1, total: chunks.length, tail, nameOf });
    const out = await callAI(prompt, t('ui.starter.sysWriter'));
    if (!out) {
      // ล้มกลางทาง: เก็บสิ่งที่แปลงได้แล้วไว้ ดีกว่าทิ้งทั้งหมด
      if (!parts.length) { setStatus(t('ui.starter.cvFail')); return null; }
      setStatus(tf('ui.starter.cvPartial', i, chunks.length));
      break;
    }
    parts.push(out);
    tail = tailOf(out);
  }
  if (onProgress) onProgress(chunks.length, chunks.length);

  const open = openChoices(sc);
  const body = format === 'screenplay'
    ? spBody(stitch(parts), open, names)
    : proseBody(stitch(parts), open);

  // ── ลงที่ปลายทาง ──
  const secPath = await ensureBook();
  if (!secPath) { setStatus(t('ui.starter.cvNoBook')); return null; }
  const dPath = await firstDraft(secPath);
  if (!dPath) { setStatus(t('ui.starter.cvNoDraft')); return null; }
  const ch = await ensureChapter(dPath, s.name || s.slug);
  if (!ch) { setStatus(t('ui.starter.cvNoChapter')); return null; }

  const title = sc.title || t('ui.starter.scUntitled');
  const row = await addScene(dPath, ch, title, {
    silent: true,
    body,
    meta: {
      format: format === 'screenplay' ? 'screenplay' : 'prose',
      // ตามรอยกลับได้ว่าฉากนี้มาจากตอนไหน — เผื่อวันหลังอยากทำ "แปลงทับของเดิม"
      starter: s.slug,
      scenario: sc.id,
      synopsis: (sc.synopsis || '').replace(/\s+/g, ' ').slice(0, 200),
    },
  });
  if (!row) { setStatus(t('ui.starter.cvNoScene')); return null; }

  await setSceneChoices(dPath, ch.guid, row.id, choiceRows(open));

  // จำไว้ว่าตอนนี้แปลงไปแล้วกี่ครั้ง/ล่าสุดไปลงที่ไหน
  sc.exports = [...(sc.exports || []), { at: Date.now(), format, path: row.path }];
  await writeScenario(s.slug, sc);
  await buildTree();
  return { path: row.path, chunks: parts.length };
}

// ───────────────────────── กล่องสั่งแปลง ─────────────────────────

/**
 * ให้ผู้ใช้เลือกรูปแบบ + ตอนที่จะแปลง แล้วลงมือ
 * @param {object} s
 * @param {Array} rows  ตอนทั้งหมด
 * @param {object} [only]  ส่งมา = แปลงเฉพาะตอนนี้ (กดจากปุ่มบนการ์ด)
 */
export function convertDialog(s, rows, only = null, opts = {}) {
  return new Promise((resolve) => {
    const list = only ? [only] : (rows || []).filter((r) => (r.turns || []).length);
    const ov = el('div', 'k-overlay');
    const box = el('div', 'k-dialog k-wide st-cv');
    box.append(el('div', 'k-dlg-title', t('ui.starter.cvTitle')));
    const done = (v) => { ov.remove(); resolve(v); };

    if (!list.length) {
      box.append(el('div', 'st-empty', t('ui.starter.cvNoPlayed')));
    }

    // รูปแบบปลายทาง
    const fmtRow = el('div', 'st-field');
    fmtRow.append(el('label', null, t('ui.starter.cvFormat')));
    const fmtBox = el('div', 'st-tag-list');
    const fmt = { v: 'prose' };
    const fmtBtns = [];
    for (const f of FORMATS) {
      const b = el('button', 'st-tag' + (f.id === fmt.v ? ' on' : ''), f.icon + ' ' + f.label);
      b.onclick = () => { fmt.v = f.id; fmtBtns.forEach((x) => x.classList.toggle('on', x === b)); };
      fmtBtns.push(b); fmtBox.append(b);
    }
    fmtRow.append(fmtBox);
    box.append(fmtRow);

    // ตอนที่จะแปลง
    const pickRow = el('div', 'st-field');
    pickRow.append(el('label', null, t('ui.starter.cvWhich')));
    const picked = new Set(list.map((r) => r.id));
    const pickBox = el('div', 'st-tag-list');
    for (const r of list) {
      const b = el('button', 'st-tag on', r.title || t('ui.starter.scUntitled'));
      b.onclick = () => {
        if (picked.has(r.id)) picked.delete(r.id); else picked.add(r.id);
        b.classList.toggle('on');
      };
      pickBox.append(b);
    }
    pickRow.append(pickBox);
    box.append(pickRow);

    box.append(el('div', 'st-hint', tf('ui.starter.cvWhereHint', EXPORT_BOOK, s.name || s.slug)));
    box.append(el('div', 'st-hint', t('ui.starter.cvAgainHint')));

    const prog = el('div', 'st-cv-prog');
    box.append(prog);

    const foot = el('div', 'k-dlg-foot');
    const cancel = el('button', null, t('ui.common.cancel'));
    cancel.onclick = () => done(null);
    const go = el('button', 'k-ok', t('ui.starter.cvGo'));
    go.disabled = !list.length;
    go.onclick = async () => {
      const todo = list.filter((r) => picked.has(r.id));
      if (!todo.length) { setStatus(t('ui.starter.cvPickOne')); return; }
      go.disabled = true; cancel.disabled = true;
      const made = [];
      for (let i = 0; i < todo.length; i++) {
        const r = todo[i];
        prog.textContent = tf('ui.starter.cvWorking', r.title || '', i + 1, todo.length);
        try {
          const res = await convertScenario(s, r, {
            format: fmt.v,
            ai: opts.ai || null,
            onProgress: (a, b) => {
              prog.textContent = tf('ui.starter.cvWorkingChunk',
                r.title || '', i + 1, todo.length, a, b);
            },
          });
          if (res) made.push(res.path);
        } catch (e) {
          log('error', 'starter convert', e);
          setStatus(t('ui.starter.cvFail'));
        }
      }
      done(made);
      if (made.length) setStatus(tf('ui.starter.cvDone', made.length, EXPORT_BOOK));
    };
    foot.append(cancel, go);
    box.append(foot);
    ov.append(box);
    document.body.append(ov);
  });
}

/** บทสนทนาเป็นข้อความล้วน — ไว้ให้ผู้ใช้ก๊อปออกไปเองโดยไม่ต้องพึ่ง AI */
export function plainTranscript(s, sc) {
  return transcriptText(sc, (id) => { const c = charById(s, id); return (c && c.name) || ''; });
}
