// ai-analyzer-ui.js — แผง "🧠 AI วิเคราะห์" (alpha.60r3 ข้อ 5)
//
// **สถานะ: ตัวอย่างหน้าตา (mockup)** — วางโครง UI ของงานวิเคราะห์ 5 ชนิดไว้ก่อน
// การ์ดแต่ละใบบอกว่าจะวิเคราะห์อะไร แสดงตัวเลขจริงเท่าที่อ่านได้จากดัชนีในเครื่อง
// (จำนวนฉาก/บท/คำ) แล้วปิดท้ายด้วยแถบ "ยังไม่เปิดใช้งาน" ให้ชัดว่าเป็นของที่ยังไม่ต่อ AI
//
// เจตนา: ผู้ใช้เห็นแผนของฟีเจอร์และกดสำรวจได้ โดยไม่หลอกว่าผลลัพธ์เป็นของจริง
// (บทเรียน 14b — โมดูลที่ไม่มีจุดเรียกเท่ากับไม่มีอยู่ · แผงนี้จึงมีทั้งปุ่ม toolbar เมนู และคำสั่ง)
import { t } from './i18n.js';
import { el, setStatus, state, t as tr } from './core.js';
import { iconHtml } from './icons.js';

/** การ์ดตัวอย่างทั้ง 5 ใบ — ข้อความไทยล้วนตามสเปก */
export const ANALYZER_CARDS = [
  { id: 'pacing',    icon: '📊', title: t('ui.aia.analyzePaceStory'),
    desc: t('ui.aia.viewSceneSceneCompare'),
    bullets: [t('ui.aia.graphLongSceneOrder'), t('ui.aia.dotPaceScene'),
              t('ui.aia.ratioActionDialogueNext')] },
  { id: 'arc',       icon: '👤', title: t('ui.aia.partCurveCharacter'),
    desc: t('ui.aia.characterEachItemAppear'),
    bullets: [t('ui.aia.planImageAppearItem'), t('ui.aia.characterFindNChapter'),
              t('ui.aia.characterMentionNotOut')] },
  { id: 'words',     icon: '📝', title: t('ui.aia.wordUse'),
    desc: t('ui.aia.findWordDupSplit'),
    bullets: [t('ui.aia.wordDupGapPara'), t('ui.aia.wordWriter'),
              t('ui.aia.dragWordNextChapter')] },
  { id: 'conflict',  icon: '🔍', title: t('ui.common.conflict'),
    desc: t('ui.aia.checkEachSceneHas'),
    bullets: [t('ui.aia.sceneCantSpecifyConflict'), t('ui.aia.conflictStuckNot'),
              t('ui.aia.dotStoryCompareStructure')] },
  { id: 'length',    icon: '⏱️', title: t('ui.aia.longScene'),
    desc: t('ui.aia.compareLongSceneValue'),
    bullets: [t('ui.aia.sceneLongValueCenter'), t('ui.aia.sceneShortWord'),
              t('ui.aia.timeReadCountPage')] },
];

/** ตัวเลขจริงที่อ่านได้จากดัชนีในเครื่อง (ไม่ยิง AI · ไม่เปิดไฟล์ทีละใบ) */
export async function analyzerStats(root = state.root) {
  const out = { scenes: 0, chapters: 0, sections: 0, words: 0, entities: 0 };
  if (!root) return out;
  const SKIP = ['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', '.k2history', 'Plugins', 'Research'];
  try {
    for (const sec of await kapi.listDirs(root)) {
      if (SKIP.includes(sec)) {
        if (sec === 'Wiki' || sec === 'Bible') {
          const wp = await kapi.join(root, sec);
          for (const cat of await kapi.listDirs(wp).catch(() => []))
            out.entities += (await kapi.listFiles(await kapi.join(wp, cat), '.json').catch(() => [])).length;
        }
        continue;
      }
      const secPath = await kapi.join(root, sec);
      if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
      out.sections++;
      const dr = await kapi.join(secPath, 'Draft');
      if (!(await kapi.exists(dr))) continue;
      for (const dn of await kapi.listDirs(dr).catch(() => [])) {
        const dp = await kapi.join(dr, dn);
        const df = await kapi.join(dp, 'draft.json');
        if (!(await kapi.exists(df))) continue;
        const chs = (await kapi.readJson(df).catch(() => ({}))).chapters || [];
        out.chapters += chs.length;
        const scAll = (await kapi.readJson(await kapi.join(dp, 'scenes.json')).catch(() => ({}))).chapters || {};
        for (const ch of chs) for (const sc of (scAll[ch.guid] || [])) {
          if (sc.type === 'memo') continue;
          out.scenes++;
          out.words += Number(sc.wordCount) || 0;
        }
      }
    }
  } catch { /* โปรเจกต์โครงแปลก ๆ → คืนเท่าที่นับได้ */ }
  return out;
}

/** วาดแผง (เรียกซ้ำได้ — ล้างของเดิมทุกครั้ง) */
export async function renderAIAnalyzerPanel(host) {
  const h = host || document.getElementById('ai-analyzer-body');
  if (!h) return null;
  h.replaceChildren();
  const wrap = el('div', 'aia-wrap');

  const head = el('div', 'aia-head');
  const title = el('div', 'aia-title');
  title.innerHTML = iconHtml('brain', 18) + ' ' + tr('panel.aiAnalyzerTitle', 'AI วิเคราะห์');
  head.append(title);
  head.append(el('div', 'aia-badge', tr('aia.mockup', 'ตัวอย่างหน้าตา — ยังไม่เปิดใช้งาน')));
  wrap.append(head);

  wrap.append(el('div', 'aia-lead',
    tr('aia.lead', 'ชุดเครื่องมือวิเคราะห์ต้นฉบับด้วย AI ที่กำลังจะมา '
       + t('ui.aia.nowShowSamplePage'))));

  // แถบสถิติจริง — บอกว่าจะเอาอะไรไปวิเคราะห์
  const stats = await analyzerStats();
  const bar = el('div', 'aia-stats');
  for (const [label, val] of [
    [t('ui.common.book'), stats.sections], [t('ui.common.chapter'), stats.chapters], [t('ui.common.scene2'), stats.scenes],
    [t('ui.common.word2'), stats.words.toLocaleString()], [t('ui.aia.wiki'), stats.entities],
  ]) {
    const b = el('div', 'aia-stat');
    b.append(el('div', 'aia-stat-val', String(val)), el('div', 'aia-stat-label', label));
    bar.append(b);
  }
  wrap.append(bar);

  const grid = el('div', 'aia-grid');
  for (const c of ANALYZER_CARDS) {
    const card = el('div', 'aia-card');
    card.dataset.card = c.id;
    card.append(el('div', 'aia-card-head', c.icon + ' ' + c.title));
    card.append(el('div', 'aia-card-desc', c.desc));
    const ul = el('ul', 'aia-card-list');
    for (const b of c.bullets) ul.append(el('li', null, b));
    card.append(ul);
    const btn = el('button', 'aia-run', tr('aia.run', 'วิเคราะห์'));
    btn.type = 'button';
    btn.onclick = () => setStatus('🧠 “' + c.title + t('ui.aia.samplePageCantNext'));
    card.append(btn);
    grid.append(card);
  }
  wrap.append(grid);

  wrap.append(el('div', 'aia-foot',
    tr('aia.foot', 'ระหว่างนี้ใช้ของที่ทำงานจริงได้แล้ว: '
       + t('ui.aia.toolCheckFindWord'))));

  h.append(wrap);
  return wrap;
}
