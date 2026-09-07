// starter-render-sp.js — แปลงบทสนทนาที่เล่นแล้ว → บทภาพยนตร์ (โมดูลบริสุทธิ์)
//
// ต่างจากฝั่งนิยายตรงที่ผลลัพธ์ต้อง **อ่านกลับเข้าโปรแกรมได้** ไม่ใช่แค่อ่านรู้เรื่อง
// บทหนังของ Killian เก็บเป็นมาร์กดาวน์ที่มีรหัสนำหน้าบรรทัด (`### หัวฉาก` · `@ตัวละคร` · `((อารมณ์))`)
// ถ้ารหัสผิด ไฟล์จะเปิดเป็นบรรยายล้วนทั้งฉาก
//
// **ไม่ไว้ใจให้โมเดลใส่รหัสเองอย่างเดียว** — สั่งไปด้วย แล้วยัง `normalizeFountain()` ซ้ำอีกชั้น
// เพราะโมเดลชอบเขียน "INT. ห้องนอน - คืน" เปล่า ๆ หรือใส่ชื่อตัวละครเป็น ALL CAPS ตามธรรมเนียมฝรั่ง
// ตัวนอร์มัลไลเซอร์เปลี่ยนของพวกนั้นให้เป็นรหัสของโปรแกรมก่อนเขียนลงไฟล์
//
// ไม่แตะ DOM/fs/network → unit test ได้ตรง ๆ

import { t } from '../i18n.js';
import { SCENE_PREFIX, TRANSITIONS } from '../fountain.js';
import { starterBlock, clip } from './starter-prompt.js';
import { chunkText, TAIL_CHARS } from './starter-render-prose.js';
import { choiceMarker } from './starter-choices.js';

/** บรรทัดนี้เป็นหัวฉากไหม (ยังไม่มีรหัส `### `) */
export function looksLikeSlug(line) {
  const s = String(line || '').trim();
  if (!s || s.length > 90) return false;
  return SCENE_PREFIX.some((p) => s.toUpperCase().startsWith(p.toUpperCase())
                                || s.startsWith(p));
}

export function looksLikeTransition(line) {
  const s = String(line || '').trim().toUpperCase();
  return TRANSITIONS.some((x) => s === x.toUpperCase());
}

/** `(อารมณ์)` ทั้งบรรทัด = วงเล็บบอกอารมณ์ */
export function looksLikeParen(line) {
  const s = String(line || '').trim();
  return s.length > 2 && s.startsWith('(') && s.endsWith(')') && !s.includes('((');
}

/**
 * บรรทัดนี้น่าจะเป็น "ชื่อตัวละคร" ไหม
 * ตัดสินจากรายชื่อจริงใน starter ก่อน แล้วค่อยตกไปที่รูปแบบ ALL CAPS ของฝรั่ง
 * (จงใจไม่เดามั่ว — เดาผิดแล้วบรรยายจะกลายเป็นชื่อคนพูด ซึ่งพังกว่าไม่เดาเลย)
 */
export function looksLikeCharacter(line, names = []) {
  const s = String(line || '').trim().replace(/\s*\((cont'd|ต่อ|V\.O\.|O\.S\.)\)\s*$/i, '');
  if (!s || s.length > 40) return false;
  const bare = s.replace(/[:：]\s*$/, '').trim();
  if (names.some((n) => n && bare === n)) return true;
  // ALL CAPS ล้วน (อังกฤษ) และไม่ใช่ทรานซิชัน
  return /^[A-Z][A-Z0-9 .'’-]{1,38}$/.test(bare) && !looksLikeTransition(bare);
}

/**
 * ใส่รหัสนำหน้าบรรทัดให้ถูกตามรูปแบบไฟล์บทของโปรแกรม
 * รับได้ทั้งข้อความที่โมเดลใส่รหัสมาแล้ว (ไม่แตะซ้ำ) และที่เขียนมาเปล่า ๆ
 * @param {string} text
 * @param {string[]} names  ชื่อตัวละครใน starter — ใช้ตัดสินบรรทัดชื่อผู้พูด
 */
export function normalizeFountain(text, names = []) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let prevWasCharacter = false;

  for (const raw of lines) {
    const s = raw.trim();
    if (!s) { out.push(''); prevWasCharacter = false; continue; }

    // มีรหัสของโปรแกรมอยู่แล้ว → ปล่อยผ่าน (แต่ยังต้องจำว่าเป็นบรรทัดตัวละครไหม)
    if (/^(#{3,5} |@|\(\(|>> |<< |\/\/\/ |! |\$)/.test(s)) {
      out.push(s);
      prevWasCharacter = s.startsWith('@');
      continue;
    }
    if (/^-{3,}$/.test(s)) { out.push(s); prevWasCharacter = false; continue; }

    if (looksLikeSlug(s)) { out.push('### ' + s); prevWasCharacter = false; continue; }
    if (looksLikeTransition(s)) { out.push('>> ' + s); prevWasCharacter = false; continue; }
    // วงเล็บอารมณ์นับเฉพาะใต้บรรทัดชื่อ — ที่อื่นเป็นบรรยายในวงเล็บตามปกติ
    if (prevWasCharacter && looksLikeParen(s)) { out.push('((' + s.slice(1, -1).trim() + '))'); continue; }
    if (!prevWasCharacter && looksLikeCharacter(s, names)) {
      out.push('@' + s.replace(/[:：]\s*$/, '').trim());
      prevWasCharacter = true;
      continue;
    }
    out.push(s);              // บรรยาย หรือบทพูด (ต่างกันที่ตำแหน่ง ไม่ใช่ที่รหัส)
    prevWasCharacter = false;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** คำสั่งแปลงหนึ่งก้อนเป็นบทภาพยนตร์ */
export function spPrompt(s, sc, chunk, { part = 1, total = 1, tail = '', nameOf } = {}) {
  const first = part === 1;
  const last = part === total;
  return [
    t('ui.starter.pCvTaskSp'),
    starterBlock(s, { full: false }),
    (sc && sc.title) ? t('ui.starter.pScTitle') + sc.title : '',
    total > 1 ? t('ui.starter.pCvPart').replace('{0}', String(part)).replace('{1}', String(total)) : '',
    tail ? t('ui.starter.pCvTail') + '\n' + clip(tail, TAIL_CHARS) : '',
    t('ui.starter.pCvSource'),
    chunkText(chunk, nameOf),
    t('ui.starter.pCvRuleSp'),
    first ? '' : t('ui.starter.pCvNoReopen'),
    last ? '' : t('ui.starter.pCvNoClose'),
  ].filter(Boolean).join('\n\n');
}

/**
 * เนื้อไฟล์ .md ของบท
 * ทางแยกที่ยังไม่ได้ตอบใส่เป็น **โน้ต** (`/// `) ไม่ใช่บรรยาย — ไม่งั้นมันจะถูกนับเป็นบทจริง
 * และไปกินบรรทัดของหน้ากระดาษ (บทหนังนับบรรทัดตายตัว 54 บรรทัด/หน้า)
 */
export function spBody(script, openChoices = [], names = []) {
  const body = normalizeFountain(script, names);
  const marks = (openChoices || []).map(choiceMarker).filter(Boolean);
  if (!marks.length) return body;
  return body + '\n\n' + marks.map((m) => '/// ' + m).join('\n') + '\n';
}
