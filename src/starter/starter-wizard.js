// starter-wizard.js — ตัวเดินขั้นของ wizard (สเปกข้อ 1 + 8)
//
// **ไฟล์นี้ไม่รู้จักขั้นไหนเป็นพิเศษเลย** — รู้แค่ว่ามีทะเบียนขั้น (starter-steps-def.js)
// และมีตารางตัววาด (starter-steps.js) · เพิ่มขั้นใหม่จึงไม่ต้องแตะไฟล์นี้
//
// หน้าที่: หัวเรื่อง + แถบขั้น + ปุ่มก่อนหน้า/ถัดไป/เสร็จสิ้น + ผูกบันทึกอัตโนมัติ
// ผู้ใช้ย้อนกลับไปแก้ขั้นไหนก็ได้ตลอดเวลา (สเปกข้อ 8) จึงไม่มีการ "ล็อกขั้น"
// ขั้นที่ยังไม่ครบแค่ถูกทำเครื่องหมายไว้ ไม่ได้ห้ามเดินผ่าน

import { el, setStatus } from '../core.js';
import { t, tf } from '../i18n.js';
import { STEPS, clampStep, isFirstStep, isLastStep, stepIndex } from './starter-steps-def.js';
import {
  starterProgress, stepFilled, starterReady, missingSteps, MODES, normMode,
} from './starter-model.js';
import { STEP_RENDERERS } from './starter-steps.js';
import { resetCastEditor } from './starter-cast.js';

/**
 * @param {HTMLElement} host
 * @param {object} ctx
 *   - starter   ตัวข้อมูล (แก้ในที่ได้ แล้วเรียก ctx.save())
 *   - save()    บันทึกอัตโนมัติ (หน่วงรวบให้แล้ว)
 *   - rerender() วาดหน้าปัจจุบันใหม่
 *   - goHome()  ไปหน้าเรื่องนี้ (รายการตอน)
 *   - goList()  กลับหน้ารวม starter
 */
export function renderWizard(host, ctx) {
  const s = ctx.starter;
  const i = clampStep(s.step);
  const step = STEPS[i];
  // [alpha.122] ออกจากขั้นตัวละครเมื่อไหร่ ตัวแก้ไขที่ค้างอยู่ต้องปิด
  // ไม่งั้นกลับเข้ามาอีกทีเจอหน้าแก้ไขของคนเก่าแทนที่จะเป็นรายชื่อ (สถานะระดับโมดูลไม่รู้จักขั้น)
  if (step.id !== 'cast') resetCastEditor();
  host.innerHTML = '';
  const wrap = el('div', 'st-wizard');
  host.append(wrap);

  // ── หัว: ชื่อเรื่อง + ปุ่มออก ──────────────────────────────
  const head = el('div', 'st-wz-head');
  const back = el('button', 'st-back', '← ' + t('ui.starter.backToList'));
  back.onclick = () => ctx.goList();
  head.append(back);
  head.append(el('div', 'st-wz-title', s.name || t('ui.starter.untitled')));
  head.append(modeSwitch(ctx));
  const prog = starterProgress(s, STEPS);
  head.append(el('div', 'st-wz-prog', tf('ui.starter.progress', prog.done, prog.total)));
  wrap.append(head);

  // ── แถบขั้น: กดข้ามไปขั้นไหนก็ได้ ────────────────────────
  const chips = el('div', 'st-steps');
  STEPS.forEach((x, n) => {
    const c = el('button', 'st-chip' + (n === i ? ' on' : '') + (stepFilled(s, x) ? ' done' : ''));
    c.append(el('span', 'st-chip-ico', x.icon));
    c.append(el('span', 'st-chip-txt', x.title));
    if (x.required === false) c.append(el('span', 'st-chip-opt', t('ui.starter.optional')));
    c.title = x.desc;
    c.onclick = () => { s.step = n; ctx.save(); ctx.rerender(); };
    chips.append(c);
  });
  wrap.append(chips);

  // แถบความคืบหน้าแบบเส้น — อ่านเร็วกว่าตัวเลขตอนกวาดตา
  const bar = el('div', 'st-bar');
  const fill = el('div', 'st-bar-fill');
  fill.style.width = prog.pct + '%';
  bar.append(fill);
  wrap.append(bar);

  // ── เนื้อขั้น ────────────────────────────────────────────
  const body = el('div', 'st-wz-body');
  wrap.append(body);
  const head2 = el('div', 'st-step-head');
  head2.append(el('div', 'st-step-title', step.icon + ' ' + step.title));
  head2.append(el('div', 'st-step-desc', step.desc));
  body.append(head2);

  const pane = el('div', 'st-step-pane');
  body.append(pane);
  const draw = STEP_RENDERERS[step.id];
  if (draw) {
    // ตัววาดคืน Promise ได้ (บางขั้นต้องอ่านไฟล์รูปก่อน)
    Promise.resolve(draw(pane, ctx)).catch((e) => {
      pane.append(el('div', 'st-err', t('ui.starter.stepDrawFail')));
      // ไม่กลืนเงียบ — ขั้นที่วาดไม่ขึ้นต้องเห็นใน log ของแอป
      import('../core.js').then((m) => m.log('error', 'starter step ' + step.id, e));
    });
  } else {
    pane.append(el('div', 'st-err', tf('ui.starter.noRenderer', step.id)));
  }

  // ── ท้าย: ก่อนหน้า / ถัดไป / เสร็จสิ้น ───────────────────
  const foot = el('div', 'st-wz-foot');
  const prev = el('button', 'st-nav', '← ' + t('ui.starter.prevStep'));
  prev.disabled = isFirstStep(i);
  prev.onclick = () => { s.step = clampStep(i - 1); ctx.save(); ctx.rerender(); };
  foot.append(prev);

  const spacer = el('div', 'st-flex');
  foot.append(spacer);

  if (isLastStep(i)) {
    const miss = missingSteps(s, STEPS);
    const fin = el('button', 'k-ok st-finish', t('ui.starter.finish'));
    // [alpha.122] **ห้ามเป็นทางตัน** — ของเดิม `disabled` ไว้เฉย ๆ
    //
    // ผู้ใช้: *"กดแก้ไข ถ้าไม่แก้ไข จะกดเสร็จสิ้นไม่ได้"*
    // ต้นตอ: กด "+ เพิ่มตัวละคร" แล้วไม่พิมพ์ชื่อ → ในรายชื่อ **มีการ์ดโผล่มาแล้ว** แต่
    // `charReady` ยังเท็จ ขั้นตัวละครจึงนับว่ายังไม่ครบ · ปุ่มเสร็จสิ้นถูกปิดตายโดยที่หน้าจอ
    // ตรงหน้า (ขั้นปก) ไม่ได้บอกว่าปัญหาอยู่คนละขั้น — กดแล้วไม่มีอะไรเกิดขึ้น เหมือนโปรแกรมค้าง
    //
    // ตอนนี้: ปุ่มกดได้เสมอ · ยังไม่ครบ = พาไปที่ขั้นที่ขาดพร้อมบอกว่าขาดอะไร
    if (miss.length) {
      fin.classList.add('st-finish-warn');
      fin.title = t('ui.starter.finishBlocked') + miss.map((x) => x.title).join(', ');
      const note = el('div', 'st-miss', fin.title);
      const jump = el('button', 'st-linkbtn', t('ui.starter.finishGoFix'));
      jump.onclick = () => { s.step = Math.max(0, stepIndex(miss[0].id)); ctx.save(); ctx.rerender(); };
      note.append(jump);
      foot.append(note);
    }
    fin.onclick = async () => {
      if (!starterReady(s, STEPS)) {
        const now = missingSteps(s, STEPS);
        setStatus(t('ui.starter.finishBlocked') + now.map((x) => x.title).join(', '));
        s.step = Math.max(0, stepIndex(now[0].id));
        ctx.save(); ctx.rerender();
        return;
      }
      s.done = true;
      await ctx.save({ now: true });
      ctx.goHome();
    };
    foot.append(fin);
  } else {
    const next = el('button', 'k-ok st-nav', t('ui.starter.nextStep') + ' →');
    next.onclick = () => { s.step = clampStep(i + 1); ctx.save(); ctx.rerender(); };
    foot.append(next);
  }
  wrap.append(foot);

  // เข้าถึงเรื่องนี้ได้แม้ยังกรอกไม่ครบ — ผู้ใช้อาจอยากไปดูตอนที่เคยเล่นไว้ก่อน
  if (s.done) {
    const go = el('button', 'st-linkbtn', t('ui.starter.goScenarios'));
    go.onclick = () => ctx.goHome();
    foot.append(go);
  }
  return true;
}

/**
 * ปุ่มสลับโหมด พื้นฐาน ↔ ขั้นสูง (ผู้ใช้ข้อ 1)
 *
 * อยู่บน **หัวของ wizard** ไม่ใช่ในตั้งค่า — เพราะเป็นของเฉพาะเรื่อง ไม่ใช่ของทั้งโปรแกรม
 * และคนที่อยากเห็นช่องขั้นสูงมักรู้ตัวตอนกำลังกรอกอยู่ ไม่ใช่ตอนเปิดโปรแกรม
 */
export function modeSwitch(ctx) {
  const s = ctx.starter;
  const box = el('div', 'st-mode');
  box.title = t('ui.starter.modeHint');
  for (const m of MODES) {
    const on = normMode(s.mode) === m.id;
    const b = el('button', 'st-mode-btn' + (on ? ' on' : ''), m.icon + ' ' + m.label);
    b.dataset.mode = m.id;
    b.title = m.hint;
    b.onclick = () => {
      if (normMode(s.mode) === m.id) return;
      s.mode = m.id;
      ctx.save();
      setStatus(m.icon + ' ' + m.label);
      ctx.rerender();
    };
    box.append(b);
  }
  return box;
}
