// ai-hub-def.js — [alpha.116 ข้อ 3] **ทะเบียนของ AI Hub** (บริสุทธิ์ 100% · มี unit test)
//
// ผู้ใช้: *"ทำ panel ที่เป็น AI Hub"*
//
// ═══ ปัญหาที่ Hub แก้ ═══
// ความสามารถ AI ของโปรแกรมโตขึ้นทีละตัวจนกระจายอยู่ **สี่ที่ที่ไม่รู้จักกัน**:
//   · แผงของตัวเอง 4 ตัว (ผู้ช่วยเขียน · วิเคราะห์ · ห้องซ้อมบท · Story Starter)
//   · กล่องโต้ตอบในเมนู 5 ตัว (ตรวจพล็อต · บทสนทนา · ความสอดคล้อง · สร้างโลก · ผู้ช่วยเขียน)
//   · คำสั่งเบ็ดเตล็ด (สรุปเรื่อง · แนะนำชื่อ)
//   · กล่องตั้งค่าผู้ให้บริการ
// คนที่เพิ่งเปิดโปรแกรมไม่มีทางรู้ว่ามีอะไรบ้าง และไม่รู้ว่า "ตั้งค่าแล้วหรือยัง"
//
// ═══ ทำไมทะเบียนเป็นไฟล์บริสุทธิ์แยก ═══
// ทุกแถวชี้ไปที่ **ช่องคำสั่งเดิมของโปรแกรม** (`handleCommand(cmd, ...args)`) เท่านั้น —
// Hub ไม่มีตรรกะของตัวเองเลยแม้แต่บรรทัดเดียว · เพิ่มความสามารถ AI ใหม่ = เพิ่มหนึ่งแถวที่นี่
// และเทสก็ยืนยันได้ว่าไม่มีแถวไหนชี้ไปคำสั่งที่ไม่มีจริง (เดียวกับที่ FAB ทำใน fab-config.js)

import { t } from '../i18n.js';

/** กลุ่มในหน้า Hub — เรียงตามลำดับที่จะโชว์ */
export const AI_HUB_GROUPS = [
  { key: 'talk',    label: t('ui.aiHub.grpTalk'),    hint: t('ui.aiHub.grpTalkHint') },
  { key: 'write',   label: t('ui.aiHub.grpWrite'),   hint: t('ui.aiHub.grpWriteHint') },
  { key: 'check',   label: t('ui.aiHub.grpCheck'),   hint: t('ui.aiHub.grpCheckHint') },
  { key: 'build',   label: t('ui.aiHub.grpBuild'),   hint: t('ui.aiHub.grpBuildHint') },
  { key: 'setting', label: t('ui.aiHub.grpSetting'), hint: t('ui.aiHub.grpSettingHint') },
];

/**
 * ความสามารถ AI ทุกตัวของโปรแกรม
 * `cmd`/`args` = ช่องคำสั่งของ `handleCommand` · `panel` = ถ้าเป็นแผง จะได้ป้าย "เปิดอยู่"
 * `needsScene` = ต้องมีฉากเปิดอยู่ถึงจะกดได้ (ปุ่มจะถูกหรี่พร้อมบอกเหตุผล)
 */
export const AI_HUB_ITEMS = [
  // ── คุยกับ AI ──
  { id: 'chat', group: 'talk', cmd: 'ai-chat-toggle', panel: 'ai-chat', icon: 'chat',
    label: t('ui.aiHub.iChat'), desc: t('ui.aiHub.iChatDesc') },
  { id: 'dlgb', group: 'talk', cmd: 'toggle-panel', args: ['dlgb'], panel: 'dlgb', icon: 'chat',
    label: t('ui.aiHub.iDlgb'), desc: t('ui.aiHub.iDlgbDesc') },
  { id: 'starter', group: 'talk', cmd: 'toggle-panel', args: ['starter'], panel: 'starter',
    icon: 'book-content', label: t('ui.aiHub.iStarter'), desc: t('ui.aiHub.iStarterDesc') },

  // ── ช่วยเขียน ──
  { id: 'assistant', group: 'write', cmd: 'ai-assistant', icon: 'edit', needsScene: true,
    label: t('ui.aiHub.iAssistant'), desc: t('ui.aiHub.iAssistantDesc') },
  { id: 'dialogue', group: 'write', cmd: 'ai-dialogue', icon: 'chat', needsScene: true,
    label: t('ui.aiHub.iDialogue'), desc: t('ui.aiHub.iDialogueDesc') },
  { id: 'summary', group: 'write', cmd: 'ai-summary', icon: 'clipboard', needsScene: true,
    label: t('ui.aiHub.iSummary'), desc: t('ui.aiHub.iSummaryDesc') },
  { id: 'title', group: 'write', cmd: 'ai-title', icon: 'star',
    label: t('ui.aiHub.iTitle'), desc: t('ui.aiHub.iTitleDesc') },

  // ── ตรวจงาน ──
  { id: 'analyzer', group: 'check', cmd: 'ai-analyzer', panel: 'ai-analyzer', icon: 'brain',
    label: t('ui.aiHub.iAnalyzer'), desc: t('ui.aiHub.iAnalyzerDesc') },
  { id: 'plot', group: 'check', cmd: 'ai-plot', icon: 'search',
    label: t('ui.aiHub.iPlot'), desc: t('ui.aiHub.iPlotDesc') },
  { id: 'consistency', group: 'check', cmd: 'ai-consistency', icon: 'check', needsScene: true,
    label: t('ui.aiHub.iConsistency'), desc: t('ui.aiHub.iConsistencyDesc') },

  // ── สร้างโลก ──
  { id: 'world', group: 'build', cmd: 'ai-world', icon: 'globe',
    label: t('ui.aiHub.iWorld'), desc: t('ui.aiHub.iWorldDesc') },

  // ── ตั้งค่า ──
  { id: 'settings', group: 'setting', cmd: 'ai-settings', icon: 'cog',
    label: t('ui.aiHub.iSettings'), desc: t('ui.aiHub.iSettingsDesc') },
];

export const aiHubItem = (id) => AI_HUB_ITEMS.find((x) => x.id === id) || null;
/** รายการในกลุ่มหนึ่ง (เรียงตามที่ประกาศไว้) */
export const aiHubItemsOf = (group) => AI_HUB_ITEMS.filter((x) => x.group === group);

/**
 * ข้อความสรุปสถานะการเชื่อมต่อที่หัว Hub
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพราะ "ตั้งค่าครบแล้วแต่ยังใช้ไม่ได้" มีหลายเคสที่สับสนง่าย
 * @param {object} o `{configured, why, providerName, model}`
 * @returns {{tone:'ok'|'warn', text:string}}
 */
export function hubStatus(o = {}) {
  if (!o.configured) return { tone: 'warn', text: o.why || t('ui.aiHub.notReady') };
  const name = String(o.providerName || '').trim();
  const model = String(o.model || '').trim();
  if (!name) return { tone: 'warn', text: t('ui.aiHub.notReady') };
  return { tone: 'ok', text: model ? name + ' · ' + model : name };
}
