// starter-prompt.js — คำสั่งทุกตัวที่ Story Starter ส่งให้ AI (โมดูลบริสุทธิ์)
//
// ทำไมต้องแยกไฟล์: prompt คือส่วนที่ **เปลี่ยนบ่อยที่สุด** ของฟีเจอร์ AI
// ถ้าปนอยู่ในตัววาด UI ทุกครั้งที่อยากลองสำนวนใหม่ต้องไปแก้กลางโค้ดหน้าจอ
// แยกออกมาแล้ว: ลองของใหม่ = แก้ไฟล์เดียว · เทียบผลได้ · เขียน unit test ให้ prompt ได้
//
// `PROMPT_VERSION` มีไว้เพื่อวันหลังจะได้รู้ว่าบทที่บันทึกไว้เกิดจาก prompt รุ่นไหน
// (ขึ้นเลขเมื่อแก้จนผลลัพธ์เปลี่ยนสำนวนอย่างมีนัยสำคัญ ไม่ใช่ทุกครั้งที่ขยับคำ)
//
// ไม่แตะ DOM/fs/network → unit test ได้ตรง ๆ

import { t, tf } from '../i18n.js';
import { genderLabel, introText, openerText } from './starter-model.js';
import { filledW } from './starter-steps-def.js';
import { choiceInstruction } from './starter-choices.js';
import { expandMentions, promptsText, mentionToken, MENTION_ANY, MENTION_USER }
  from '../entity-mention.js';

// 1 → 2 = [alpha.122] ใบตัวละครมีตัวอย่างคำพูด/แท็ก/ช่อง Prompt · GM ได้เป้าหมาย+เงื่อนไขจบ
// 2 → 3 = [alpha.123] โทเคน `{{…}}` + คำสงวน user/character · GM ได้ Mood & Tone
export const PROMPT_VERSION = 3;

/**
 * บริบทของการคลายโค้ดสั้น — คำสงวนต้องมีคำแปลกำกับ (โมดูล entity-mention บริสุทธิ์ ไม่รู้จัก i18n)
 * @param {object} s   starter
 * @param {object} sc  scenario (ใช้หาว่า `{{user}}` คือใคร)
 */
export function mentionCtx(s, sc, userChars) {
  const cast = (s && s.cast) || [];
  // ผู้เรียกบางที่รู้ว่าผู้เล่นสวมบทใครดีกว่าตัว `sc` เอง (gmSystem รับมาทาง opts) — ให้ตัวนั้นชนะ
  const mine = new Set(Array.isArray(userChars) ? userChars : ((sc && sc.userChars) || []));
  const owned = cast.filter((c) => mine.has(c.id)).map((c) => c.name).filter(Boolean);
  return {
    // ผู้เล่นคุมหลายตัว = บอกทั้งหมด · ไม่ได้คุมใครเลย = คำสำรอง "ผู้เล่น"
    user: owned.join(' / '),
    userLabel: t('ui.starter.mentionUser'),
    anyLabel: t('ui.starter.mentionAny'),
  };
}

/** ตัดข้อความยาวให้พอดีบริบท โดยไม่ตัดกลางคำ */
export function clip(text, max = 1200) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim() + '…';
}

// ───────────────────────── ก้อนข้อมูลที่ใช้ร่วมกันทุก prompt ─────────────────────────

export function tagLine(s) {
  const tags = (s && s.tags) || [];
  return tags.length ? t('ui.starter.pTags') + tags.join(', ') : '';
}

/**
 * ใบตัวละคร
 * @param {object} s
 * @param {object} opts  full=true ใส่คำบรรยายเต็ม · false ใส่แค่บรรทัดเดียว (ประหยัด token)
 */
export function castBlock(s, { full = true, exclude = '' } = {}) {
  const all = (s && s.cast) || [];
  const rows = all.filter((c) => c && c.name && c.id !== exclude);
  if (!rows.length) return '';
  const lines = [t('ui.starter.pCastHead')];
  for (const c of rows) {
    const head = '- ' + c.name
      + (c.gender ? ' (' + genderLabel(c.gender) + ')' : '')
      + (c.selfPronoun ? ' · ' + t('ui.starter.pSelfPronoun') + c.selfPronoun : '');
    lines.push(head);
    const body = full ? (c.persona || c.blurb) : (c.blurb || c.persona);
    if (String(body || '').trim()) lines.push('  ' + clip(body, full ? 900 : 200).replace(/\n+/g, ' '));
    // ── [alpha.122] ของจากโหมดขั้นสูง ──
    // ส่งเฉพาะตอน full — ใบย่อมีไว้ประหยัดโทเคน ยัดตัวอย่างคำพูดเข้าไปก็ไม่ย่อแล้ว
    if ((c.tags || []).length) lines.push('  ' + t('ui.starter.pCharTags') + c.tags.join(', '));
    if (!full) continue;
    const dlg = String(c.dialogue || '').trim();
    if (dlg) {
      lines.push('  ' + t('ui.starter.pCharDialogue'));
      // โค้ดสั้นต้องคลายเป็นชื่อจริงก่อนถึงโมเดล — โมเดลไม่รู้จัก `{{…}}`
      for (const ln of clip(expandMentions(dlg, all), 900).split(/\r?\n/)) {
        if (ln.trim()) lines.push('    ' + ln.trim());
      }
    }
    const pr = promptsText(c.prompts, all);
    if (pr) for (const ln of clip(pr, 900).split(/\r?\n/)) { if (ln.trim()) lines.push('  · ' + ln.trim()); }
  }
  return lines.join('\n');
}

export function wBlock(s) {
  const rows = filledW(s);
  if (!rows.length) return '';
  return [t('ui.starter.pWHead'), ...rows.map((r) => '- ' + r.label + ': ' + clip(r.value, 300))]
    .join('\n');
}

/**
 * ก้อนข้อมูล starter ทั้งชุด — ทุก prompt เริ่มจากตรงนี้
 * `parts` ให้เลือกได้ว่าจะใส่อะไรบ้าง (บาง prompt ไม่ต้องการ cast เต็ม ๆ)
 */
export function starterBlock(s, { cast = true, full = true, intro = true } = {}) {
  const out = [];
  if (s && s.name) out.push(t('ui.starter.pTitle') + s.name);
  const tl = tagLine(s); if (tl) out.push(tl);
  if (intro) {
    // [alpha.96] คำบรรยายเก็บเป็น HTML แล้ว — ห้ามส่งแท็กดิบเข้าโมเดล
    const body = introText(s);
    if (body) { out.push(t('ui.starter.pIntroHead')); out.push(clip(body, 1500)); }
  }
  const w = wBlock(s); if (w) out.push(w);
  if (cast) { const c = castBlock(s, { full }); if (c) out.push(c); }
  return out.join('\n\n');
}

// ───────────────────────── ขั้นที่ 2: ชื่อเรื่อง + เรื่องย่อ ─────────────────────────

export const SYS_WRITER = () => t('ui.starter.sysWriter');

/** แนะนำชื่อเรื่อง — คืนเป็นรายการให้ผู้ใช้เลือก */
export function namePrompt(s) {
  const body = introText(s);
  return [
    t('ui.starter.pNameTask'),
    tagLine(s),
    body ? t('ui.starter.pIntroHead') + '\n' + clip(body, 800) : '',
    t('ui.starter.pNameRule'),
  ].filter(Boolean).join('\n\n');
}

/** เรื่องย่อ 1 ย่อหน้า (สเปกข้อ 5) */
export function introPrompt(s) {
  return [
    t('ui.starter.pIntroTask'),
    tagLine(s),
    (s && s.name) ? t('ui.starter.pTitle') + s.name : '',
    wBlock(s),
    t('ui.starter.pIntroRule'),
  ].filter(Boolean).join('\n\n');
}

// ───────────────────────── ขั้นที่ 3: คำบรรยายตัวละคร ─────────────────────────

/**
 * คำบรรยายตัวละครแบบละเอียด — ดึงบริบทจาก intro + แท็ก + เพื่อนร่วมเรื่อง (สเปกข้อ 6)
 * ตัวละครที่กำลังเขียนถูกกันออกจาก castBlock เพื่อไม่ให้โมเดลลอกของเดิมมาตอบ
 */
export function charDescPrompt(s, ch) {
  const who = [
    t('ui.starter.pCharName') + (ch.name || t('ui.starter.pCharNoName')),
    ch.gender ? t('ui.starter.pCharGender') + genderLabel(ch.gender) : '',
    String(ch.persona || '').trim() ? t('ui.starter.pCharSoFar') + clip(ch.persona, 400) : '',
  ].filter(Boolean).join('\n');
  return [
    t('ui.starter.pCharTask'),
    starterBlock(s, { cast: false }),
    castBlock(s, { full: false, exclude: ch.id }),
    who,
    t('ui.starter.pCharRule'),
  ].filter(Boolean).join('\n\n');
}

// ───────────────────────── Scenario: ชื่อ + เรื่องย่อ ─────────────────────────

/**
 * เรื่องย่อของ scenario (สเปกข้อ 11)
 * @param {object} prev  scenario ก่อนหน้าที่ผู้ใช้เลือกเชื่อม (อาจเป็น null)
 *
 * ส่งเฉพาะ **บทย่อ** ของตอนก่อน ไม่ใช่บทสนทนาเต็ม — ไม่งั้นพอถึงตอนที่ 3 บริบทบวมจนใช้ไม่ได้
 */
export function synopsisPrompt(s, sc, prev) {
  return [
    t('ui.starter.pScTask'),
    starterBlock(s, { full: false }),
    prev ? t('ui.starter.pScPrev') + (prev.title || '') + '\n' + clip(prev.synopsis || prev.recap || '', 700) : '',
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    t('ui.starter.pScRule'),
  ].filter(Boolean).join('\n\n');
}

/** ชื่อ scenario จากเรื่องย่อที่มีอยู่ */
export function scenarioNamePrompt(s, sc) {
  return [
    t('ui.starter.pScNameTask'),
    tagLine(s),
    String((sc && sc.synopsis) || '').trim() ? clip(sc.synopsis, 700) : '',
    t('ui.starter.pNameRule'),
  ].filter(Boolean).join('\n\n');
}

// ───────────────────────── Game Master ─────────────────────────

/**
 * system prompt ของ GM — ดึงข้อมูล starter ทั้งหมดตามสเปกข้อ 13
 *
 * @param {object} s        starter
 * @param {object} sc       scenario
 * @param {object} opts
 *   - prev      scenario ก่อนหน้า (บทย่อเท่านั้น)
 *   - userChars ไอดีตัวละครที่ "ผู้เล่นเป็นคนสวมบท" — GM ห้ามพูดแทน
 *   - len       ความยาวต่อรอบ ('short'|'medium'|'long')
 */
export function gmSystem(s, sc, { prev = null, userChars = [], len = 'medium' } = {}) {
  const cast = (s && s.cast) || [];
  const mine = new Set(userChars || []);
  const owned = cast.filter((c) => mine.has(c.id)).map((c) => c.name).filter(Boolean);
  const lenRule = { short: t('ui.starter.pGmLenShort'),
                    medium: t('ui.starter.pGmLenMedium'),
                    long: t('ui.starter.pGmLenLong') }[len] || t('ui.starter.pGmLenMedium');
  const mc = mentionCtx(s, sc, userChars);
  const ex = (v, max) => {
    const body = String(v || '').trim();
    return body ? clip(expandMentions(body, cast, mc), max) : '';
  };
  const desc = ex(sc && sc.desc, 1200);
  const mood = ex(sc && sc.mood, 400);
  const goal = ex(sc && sc.goal, 400);
  const cond = ex(sc && sc.conditions, 600);
  return [
    t('ui.starter.pGmRole'),
    starterBlock(s, { full: true }),
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    String((sc && sc.synopsis) || '').trim() ? t('ui.starter.pScSynopsis') + '\n' + clip(sc.synopsis, 900) : '',
    // [alpha.122] ช่องขั้นสูงของตอน — GM ต้องรู้ทั้งฉาก เป้าหมาย และ "จบยังไงถึงเรียกว่าสำเร็จ"
    desc ? t('ui.starter.pScDesc') + '\n' + desc : '',
    // [alpha.123] โทน = สำนวนและจังหวะการเล่า · แยกจากคำอธิบายซึ่งเป็นข้อเท็จจริงของฉาก
    mood ? t('ui.starter.pScMood') + '\n' + mood + '\n' + t('ui.starter.pScMoodRule') : '',
    goal ? t('ui.starter.pScGoal') + '\n' + goal : '',
    cond ? t('ui.starter.pScCond') + '\n' + cond + '\n' + t('ui.starter.pScCondRule') : '',
    prev ? t('ui.starter.pScPrev') + (prev.title || '') + '\n' + clip(prev.synopsis || '', 600) : '',
    owned.length ? tf('ui.starter.pGmUserChars', owned.join(', ')) : '',
    t('ui.starter.pGmRules'),
    lenRule,
    choiceInstruction(),
  ].filter(Boolean).join('\n\n');
}

/**
 * ข้อความเปิดฉาก — ใช้ตอนบทสนทนายังว่าง
 *
 * [alpha.122] ผู้ใช้เขียน **บทเปิดเอง** ได้แล้ว (Story Opener) · ถ้ามี ให้ต่อจากอันนั้น
 * ไม่ใช่แต่งใหม่ทับ — คนเขียนเองเสียเวลากับบทเปิดมากที่สุดเสมอ
 */
export function gmOpening(s, sc) {
  const own = openerText(sc, (s && s.cast) || [], mentionCtx(s, sc));
  if (own) {
    return [t('ui.starter.pGmOpenGiven'), clip(own, 1500), t('ui.starter.pGmOpenGivenRule')]
      .join('\n\n');
  }
  return [
    t('ui.starter.pGmOpenTask'),
    String((sc && sc.synopsis) || '').trim() ? clip(sc.synopsis, 600) : '',
    t('ui.starter.pGmOpenRule'),
  ].filter(Boolean).join('\n\n');
}

/**
 * เทิร์นของผู้เล่น
 * @param {string} text     สิ่งที่ผู้เล่นเลือกหรือพิมพ์เอง
 * @param {string} speaker  ชื่อตัวละครที่ผู้เล่นสวมบท ('' = ผู้เล่นพูดในฐานะตัวเอง)
 */
export function gmUserTurn(text, speaker = '') {
  const body = String(text || '').trim();
  return speaker ? tf('ui.starter.pGmAsChar', speaker, body) : body;
}

/** ขอบทย่อของ scenario ที่เล่นจบแล้ว — ไว้ส่งต่อให้ตอนถัดไป */
export function recapPrompt(s, sc, transcript) {
  return [
    t('ui.starter.pRecapTask'),
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    clip(transcript, 6000),
    t('ui.starter.pRecapRule'),
  ].filter(Boolean).join('\n\n');
}

// ───────────────────────── [alpha.96] ช่องที่เพิ่มมาทีหลัง ─────────────────────────

/**
 * ช่วยคิดทีละช่องของ 4W (ผู้ใช้ขอปุ่ม AI ในขั้นนี้ด้วย)
 * ส่งช่องที่กรอกแล้วไปเป็นบริบท เพื่อไม่ให้ตอบขัดกับที่เขียนไว้เอง
 * @param {object} field  หนึ่งแถวจาก W_FIELDS
 */
export function wFieldPrompt(s, field) {
  return [
    tf('ui.starter.pWTask', field.label),
    starterBlock(s, { cast: false }),
    field.hint ? t('ui.starter.pWHint') + field.hint : '',
    t('ui.starter.pWRule'),
  ].filter(Boolean).join('\n\n');
}

/** คำโปรยหนึ่งบรรทัดสำหรับการ์ดหน้าปก */
export function blurbPrompt(s) {
  return [
    t('ui.starter.pBlurbTask'),
    starterBlock(s, { cast: false }),
    t('ui.starter.pBlurbRule'),
  ].filter(Boolean).join('\n\n');
}

/**
 * คำบรรยายเรื่องแบบยาว (Story Description) — ตอบเป็น HTML ง่าย ๆ ได้เลย
 * เพราะช่องกรอกเป็นตัวแก้ไขแบบเห็นผลจริง ถ้าตอบเป็นข้อความล้วนจะได้ก้อนเดียวไม่มีย่อหน้า
 */
export function descPrompt(s) {
  return [
    t('ui.starter.pDescTask'),
    tagLine(s),
    (s && s.name) ? t('ui.starter.pTitle') + s.name : '',
    wBlock(s),
    castBlock(s, { full: false }),
    t('ui.starter.pDescRule'),
  ].filter(Boolean).join('\n\n');
}

// ───────────────────────── [alpha.122] โหมดขั้นสูง ─────────────────────────

/**
 * ตัวอย่างคำพูดของตัวละคร (ผู้ใช้ข้อ 2.1)
 * ขอเป็น **บทพูดล้วน ๆ ไม่มีคำบรรยาย** — จุดประสงค์คือให้โมเดลจับสำเนียง ไม่ใช่จับเนื้อเรื่อง
 */
export function charDialoguePrompt(s, ch) {
  const who = [
    t('ui.starter.pCharName') + (ch.name || t('ui.starter.pCharNoName')),
    ch.gender ? t('ui.starter.pCharGender') + genderLabel(ch.gender) : '',
    String(ch.persona || '').trim() ? t('ui.starter.pCharSoFar') + clip(ch.persona, 700) : '',
    (ch.tags || []).length ? t('ui.starter.pCharTags') + ch.tags.join(', ') : '',
  ].filter(Boolean).join('\n');
  return [
    t('ui.starter.pDlgTask'),
    starterBlock(s, { cast: false }),
    castBlock(s, { full: false, exclude: ch.id }),
    who,
    t('ui.starter.pDlgRule'),
  ].filter(Boolean).join('\n\n');
}

/** บทเปิดเรื่องของตอน (Story Opener) */
export function openerPrompt(s, sc) {
  return [
    t('ui.starter.pOpenerTask'),
    starterBlock(s, { full: false }),
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    String((sc && sc.synopsis) || '').trim() ? clip(sc.synopsis, 800) : '',
    String((sc && sc.desc) || '').trim() ? t('ui.starter.pScDesc') + '\n' + clip(sc.desc, 800) : '',
    t('ui.starter.pOpenerRule'),
  ].filter(Boolean).join('\n\n');
}

/** เป้าหมายของตอน (Story Goal) */
export function goalPrompt(s, sc) {
  return [
    t('ui.starter.pGoalTask'),
    starterBlock(s, { full: false }),
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    String((sc && sc.synopsis) || '').trim() ? clip(sc.synopsis, 800) : '',
    t('ui.starter.pGoalRule'),
  ].filter(Boolean).join('\n\n');
}

/**
 * เงื่อนไขจบภารกิจ (Completion Conditions)
 * บอกโมเดลให้ **คงโค้ดสั้นไว้** — คำตอบจะถูกเก็บลงไฟล์ต่อ ถ้าคลายเป็นชื่อจริง
 * เปลี่ยนชื่อตัวละครทีหลังแล้วเงื่อนไขจะค้างอยู่กับชื่อเก่า
 */
export function conditionsPrompt(s, sc) {
  const sample = ((s && s.cast) || []).map((c) => c.name).filter(Boolean)[0] || MENTION_ANY;
  return [
    t('ui.starter.pCondTask'),
    starterBlock(s, { full: false }),
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    String((sc && sc.goal) || '').trim() ? t('ui.starter.pScGoal') + '\n' + clip(sc.goal, 400) : '',
    String((sc && sc.synopsis) || '').trim() ? clip(sc.synopsis, 600) : '',
    tf('ui.starter.pCondRule', mentionToken(sample),
       mentionToken(MENTION_ANY), mentionToken(MENTION_USER)),
  ].filter(Boolean).join('\n\n');
}

/** อารมณ์และโทนของตอน (Mood & Tone) */
export function moodPrompt(s, sc) {
  return [
    t('ui.starter.pMoodTask'),
    starterBlock(s, { full: false }),
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    String((sc && sc.synopsis) || '').trim() ? clip(sc.synopsis, 700) : '',
    String((sc && sc.desc) || '').trim() ? t('ui.starter.pScDesc') + '\n' + clip(sc.desc, 700) : '',
    t('ui.starter.pMoodRule'),
  ].filter(Boolean).join('\n\n');
}
