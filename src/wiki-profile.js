// wiki-profile.js — หัวการ์ดโปรไฟล์ของ Wiki entity (alpha.71 · ข้อ 4)
// โมดูลบริสุทธิ์ ไม่แตะ DOM/kapi — unit test แยกที่ test/wiki-profile.test.cjs
//
// ═══ ทำไมต้องมีไฟล์นี้ ═══
// เดิมหัวการ์ด (รูปประจำตัว + ชื่อ + บทบาท + สถานะ) ถูก **ฮาร์ดโค้ด** ไว้ใน wiki.js สองชั้น:
//   1) `if (this.e.entityTypeKey === 'characters')` → สถานที่/สิ่งของ/ตำนาน/หมวดที่ผู้ใช้สร้างเอง
//      **ไม่มีรูปประจำตัวเลย** ทั้งที่โครงข้อมูล (entity.images[]) รองรับมาตลอด
//   2) อ่านค่าด้วย **ชื่อ field ที่เขียนตายในโค้ด** (`fields.Role` / `fields.Status`) — เทมเพลตมาตรฐาน
//      ไม่มี field ชื่อ `Status` ด้วยซ้ำ ป้ายสถานะจึงเป็นโค้ดตายมาตลอด และผู้ใช้ที่เปลี่ยนชื่อ field
//      ในเทมเพลตเองก็ทำให้หัวการ์ดว่างเปล่าโดยไม่รู้สาเหตุ
//
// กติกาใหม่: **ทุกอย่างมาจาก templates.json เท่านั้น**
//   - รูปประจำตัว = `entity.images[0]` — เป็นของโครงข้อมูล entity ไม่ใช่ของเทมเพลต → **ทุกหมวดมีเหมือนกันหมด**
//   - จะโชว์ field ไหนใต้ชื่อ อ่านจาก `template.profile` ในไฟล์ JSON
//   - เทมเพลตที่ไม่ประกาศ `profile` → โชว์แค่รูป+ชื่อ+ชื่ออื่น (ไม่มีการเดาชื่อ field ในโค้ด)

import { migrateImages, imageAlt } from './wiki-images.js';

/** คีย์ที่เทมเพลตประกาศได้ในบล็อก profile (ทั้งหมดไม่บังคับ) */
export const PROFILE_KEYS = ['subtitleField', 'statusField', 'badgeFields'];

/** ค่าเริ่มต้น = ไม่โชว์อะไรเพิ่มนอกจากรูป/ชื่อ/ชื่ออื่น (ห้ามเดาชื่อ field ในโค้ด) */
export const EMPTY_PROFILE = { subtitleField: '', statusField: '', badgeFields: [] };

/** อ่านบล็อก profile ของเทมเพลตแบบปลอดภัย — เทมเพลตเก่า/ไม่มีบล็อกนี้ก็ไม่พัง */
export function templateProfile(tpl) {
  const p = (tpl && tpl.profile) || {};
  const badges = Array.isArray(p.badgeFields)
    ? p.badgeFields.map((k) => String(k || '').trim()).filter(Boolean)
    : [];
  return {
    subtitleField: String(p.subtitleField || '').trim(),
    statusField: String(p.statusField || '').trim(),
    badgeFields: badges,
  };
}

/** รูปประจำตัว (ใบแรกของ images[]) — คืน null เมื่อยังไม่มีรูป · ใช้ได้กับ **ทุกหมวด** */
export function entityPortrait(entity) {
  const list = migrateImages(entity && entity.images);
  if (!list.length) return null;
  const im = list[0];
  return { file: im.file, alt: imageAlt(im), caption: im.caption || '' };
}

/** ค่าของ field หนึ่งตัวจาก entity — ดูทั้ง fields และ customProperties (ผู้ใช้เพิ่มเองก็ใช้ได้) */
export function fieldValue(entity, key) {
  if (!entity || !key) return '';
  const f = entity.fields || {}, c = entity.customProperties || {};
  const v = (key in f) ? f[key] : (key in c) ? c[key] : '';
  return v == null ? '' : String(v).trim();
}

/**
 * ข้อมูลที่หัวการ์ดต้องวาด — ประกอบจาก entity + เทมเพลต + ตารางป้ายชื่อ field
 * คืน { portrait, name, aliases[], subtitle, status, badges:[{key,label,value}] }
 * ทุกส่วนที่ "ไม่มีข้อมูล" จะเป็นค่าว่าง — ฝั่ง UI แค่ข้ามไป ไม่ต้องรู้เรื่องเทมเพลต
 */
export function profileData(entity, tpl, labels = {}) {
  const prof = templateProfile(tpl);
  const lbl = (k) => (labels && labels[k]) || k;
  const badges = [];
  for (const k of prof.badgeFields) {
    const v = fieldValue(entity, k);
    if (v) badges.push({ key: k, label: lbl(k), value: v });
  }
  return {
    portrait: entityPortrait(entity),
    name: String((entity && entity.name) || '').trim(),
    aliases: Array.isArray(entity && entity.aliases) ? entity.aliases.filter(Boolean) : [],
    subtitle: prof.subtitleField ? fieldValue(entity, prof.subtitleField) : '',
    subtitleLabel: prof.subtitleField ? lbl(prof.subtitleField) : '',
    status: prof.statusField ? fieldValue(entity, prof.statusField) : '',
    statusLabel: prof.statusField ? lbl(prof.statusField) : '',
    badges,
  };
}

/**
 * จัดกลุ่มสถานะเป็นสีเดียวกับของเดิม (มีชีวิต/เสียชีวิต/ไม่ทราบ) — คำที่ใช้เทียบมาจากเทมเพลต
 * ถ้าเทมเพลตไม่ได้ประกาศ `statusWords` ก็คืน 'plain' (ไม่เดาคำในโค้ด)
 */
export function statusTone(tpl, value) {
  const words = (tpl && tpl.profile && tpl.profile.statusWords) || null;
  if (!words || !value) return 'plain';
  const v = String(value).toLowerCase();
  for (const tone of Object.keys(words)) {
    const list = Array.isArray(words[tone]) ? words[tone] : [];
    if (list.some((w) => w && v.includes(String(w).toLowerCase()))) return tone;
  }
  return 'plain';
}

/**
 * ซ่อมเทมเพลตในโปรเจกต์ให้ได้คีย์ใหม่ของรุ่นถัดมา — **โดยไม่ทับค่าที่ผู้ใช้แก้เอง**
 *
 * โปรเจกต์เก่ามี templates.json ที่คัดลอกไปตั้งแต่ตอนสร้าง จึงไม่มีบล็อก `profile`
 * ถ้าไม่เติมให้ หัวการ์ดของโปรเจกต์เก่าจะว่างเปล่าตลอดกาล
 * แต่ห้ามเขียนค่าเหล่านั้นตายในโค้ด → **ก็อปมาจาก templates.json ที่แถมมากับโปรแกรม** แทน
 * เงื่อนไข: เฉพาะเทมเพลต `builtIn` และเฉพาะคีย์ที่ **ยังไม่มี** ในของโปรเจกต์
 *
 * คืน { templates, changed } — changed=true เมื่อมีการเติมจริง (ฝั่งเรียกค่อยเขียนไฟล์)
 */
export function mergeBuiltInTemplateMeta(projectTpls, shippedTpls, keys = ['profile']) {
  const out = Array.isArray(projectTpls) ? projectTpls.map((t) => ({ ...t })) : [];
  const shipped = Array.isArray(shippedTpls) ? shippedTpls : [];
  // จับคู่ด้วย id ก่อน (แน่นอนที่สุด) แล้วค่อยถอยไปใช้ entityTypeKey+name
  const byId = new Map(shipped.filter((t) => t.id).map((t) => [t.id, t]));
  const byName = new Map(shipped.map((t) => [t.entityTypeKey + '' + t.name, t]));
  let changed = false;
  for (const t of out) {
    if (!t || !t.builtIn) continue;
    const src = byId.get(t.id) || byName.get(t.entityTypeKey + '' + t.name);
    if (!src) continue;
    for (const k of keys) {
      if (src[k] !== undefined && t[k] === undefined) { t[k] = src[k]; changed = true; }
    }
  }
  return { templates: out, changed };
}
