// ai-analyzer-ui.js — แผง "🧠 AI วิเคราะห์" (alpha.60r3 ข้อ 5)
//
// **สถานะ: ตัวอย่างหน้าตา (mockup)** — วางโครง UI ของงานวิเคราะห์ 5 ชนิดไว้ก่อน
// การ์ดแต่ละใบบอกว่าจะวิเคราะห์อะไร แสดงตัวเลขจริงเท่าที่อ่านได้จากดัชนีในเครื่อง
// (จำนวนฉาก/บท/คำ) แล้วปิดท้ายด้วยแถบ "ยังไม่เปิดใช้งาน" ให้ชัดว่าเป็นของที่ยังไม่ต่อ AI
//
// เจตนา: ผู้ใช้เห็นแผนของฟีเจอร์และกดสำรวจได้ โดยไม่หลอกว่าผลลัพธ์เป็นของจริง
// (บทเรียน 14b — โมดูลที่ไม่มีจุดเรียกเท่ากับไม่มีอยู่ · แผงนี้จึงมีทั้งปุ่ม toolbar เมนู และคำสั่ง)
import { el, setStatus, state, t as tr } from './core.js';
import { iconHtml } from './icons.js';

/** การ์ดตัวอย่างทั้ง 5 ใบ — ข้อความไทยล้วนตามสเปก */
export const ANALYZER_CARDS = [
  { id: 'pacing',    icon: '📊', title: 'วิเคราะห์จังหวะเรื่อง',
    desc: 'ดูว่าฉากไหนยืดไป ฉากไหนรวบรัดเกิน เทียบความยาว·ความหนาแน่นของบทพูดตลอดทั้งเล่ม',
    bullets: ['กราฟความยาวฉากเรียงตามลำดับเรื่อง', 'จุดที่จังหวะตกติดกันหลายฉาก',
              'สัดส่วนบรรยาย : บทสนทนา ต่อบท'] },
  { id: 'arc',       icon: '👤', title: 'ส่วนโค้งตัวละคร',
    desc: 'ติดตามว่าตัวละครแต่ละตัวปรากฏช่วงไหนของเรื่อง และหายไปนานเกินไปหรือเปล่า',
    bullets: ['แผนภาพการปรากฏตัวตลอดเรื่อง', 'ตัวละครที่หายไปเกิน N บท',
              'ตัวละครที่ถูกกล่าวถึงแต่ไม่เคยออกฉาก'] },
  { id: 'words',     icon: '📝', title: 'คำที่ใช้บ่อย',
    desc: 'หาคำและวลีที่ซ้ำจนสะดุดตา แยกตามบทและตามตัวละครผู้พูด',
    bullets: ['คำซ้ำในระยะใกล้ (ย่อหน้าเดียวกัน)', 'คำติดปากของนักเขียน',
              'ความหลากหลายของคำศัพท์ต่อบท'] },
  { id: 'conflict',  icon: '🔍', title: 'ความขัดแย้ง',
    desc: 'ตรวจว่าแต่ละฉากมีแรงต้านหรือไม่ ฉากที่ไม่มีความขัดแย้งเลยมักเป็นฉากที่ตัดได้',
    bullets: ['ฉากที่ยังไม่ได้ระบุความขัดแย้ง', 'ความขัดแย้งที่ค้างไม่ถูกคลี่คลาย',
              'จุดพลิกของเรื่องเทียบโครงสร้าง 3 องก์'] },
  { id: 'length',    icon: '⏱️', title: 'ความยาวฉาก',
    desc: 'เทียบความยาวฉากกับค่ากลางของทั้งเล่ม ชี้ฉากที่ผิดปกติทั้งสั้นและยาว',
    bullets: ['ฉากยาวกว่าค่ากลาง 2 เท่าขึ้นไป', 'ฉากสั้นกว่า 150 คำ',
              'ประมาณเวลาอ่าน / จำนวนหน้าบท'] },
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
       + 'ตอนนี้แสดงเป็นตัวอย่างหน้าตาเพื่อให้เห็นว่าแต่ละหัวข้อจะบอกอะไรบ้าง')));

  // แถบสถิติจริง — บอกว่าจะเอาอะไรไปวิเคราะห์
  const stats = await analyzerStats();
  const bar = el('div', 'aia-stats');
  for (const [label, val] of [
    ['เล่ม', stats.sections], ['บท', stats.chapters], ['ฉาก', stats.scenes],
    ['คำ', stats.words.toLocaleString()], ['เอนทิตี้ Wiki', stats.entities],
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
    btn.onclick = () => setStatus('🧠 “' + c.title + '” ยังเป็นตัวอย่างหน้าตา — ยังไม่ได้ต่อกับ AI');
    card.append(btn);
    grid.append(card);
  }
  wrap.append(grid);

  wrap.append(el('div', 'aia-foot',
    tr('aia.foot', 'ระหว่างนี้ใช้ของที่ทำงานจริงได้แล้ว: '
       + 'เครื่องมือ → ตรวจหาคำซ้ำ · AI → ตรวจ Plot Hole · AI → ตรวจความสอดคล้อง')));

  h.append(wrap);
  return wrap;
}
