// event-ui.js — UI/การต่อสายของ Auto-task / Event Queue (ข้อ 88)
// เปิด/ปิด auto-sync ใน settings + ผูกงาน rename-entity เข้ากับเอนจินจริง
import { tf } from '../i18n.js';
import { el, setStatus, state, log, t } from '../core.js';
import { AutoTaskEngine, installDefaultRules, renameEntityTask } from '../auto-task/event-queue.js';

let engine = null;
let ticker = null;

const SKIP_DIRS = ['Wiki', 'Bible', 'Images', 'Recycle', 'Snapshots', 'Backups', 'Plugins', 'Research'];

// รวมไฟล์ข้อความทั้งโปรเจกต์ (ฉาก + memo) ที่งาน rename ต้องไล่แก้
export async function listTextFiles(root) {
  const out = [];
  if (!root) return out;
  try {
    for (const sec of await kapi.listDirs(root)) {
      if (SKIP_DIRS.includes(sec)) continue;
      const dr = await kapi.join(await kapi.join(root, sec), 'Draft');
      if (!(await kapi.exists(dr))) continue;
      for (const dn of await kapi.listDirs(dr)) {
        const chRoot = await kapi.join(await kapi.join(dr, dn), 'Chapters');
        if (!(await kapi.exists(chRoot))) continue;
        for (const ch of await kapi.listDirs(chRoot)) {
          const cd = await kapi.join(chRoot, ch);
          for (const f of await kapi.listFiles(cd, '.md')) out.push(await kapi.join(cd, f));
        }
      }
    }
  } catch (e) { log('warn', t('ui.autoTaskEvent.autoTaskFileNot'), e); }
  return out;
}

export function getTaskEngine() {
  if (!engine) {
    engine = new AutoTaskEngine({
      meta: state.meta,
      onLog: (entry) => log('info', 'auto-task: ' + entry.type, entry),
      onError: (e, type) => log('error', t('ui.task.jobFailed') + type + t('ui.task.failedSuffix'), { error: e && e.message }),
    });
    installDefaultRules(engine);
    // งานจริงที่ทำได้ตอนนี้: เปลี่ยนชื่อเอนทิตี้ → ไล่แก้ทุกไฟล์
    engine.registerTask('rename-entity', async (payload, ctx) => {
      const files = payload.files && payload.files.length ? payload.files : await listTextFiles(state.root);
      const run = renameEntityTask({
        readFile: (p) => kapi.readFile(p).catch(() => null),
        writeFile: (p, c) => kapi.writeFile(p, c),
      });
      const r = await run({ ...payload, files });
      if (r.changed) setStatus(tf('ui.autoTaskEvent.autoSyncUpdateName', r.files.length));
      return r;
    });
  }
  return engine;
}

// เปิด/ปิด auto-sync
export function setAutoSync(on) {
  const eng = getTaskEngine();
  if (on) {
    if (!ticker) ticker = eng.start((tick) => setInterval(tick, 3000));
    log('info', t('ui.autoTaskEvent.autoTaskAutoSync2'));
  } else {
    if (ticker) { eng.stop((h) => clearInterval(h)); ticker = null; }
    log('info', t('ui.autoTaskEvent.autoTaskAutoSync'));
  }
}

export function isAutoSyncOn() { return ticker != null; }

// แจ้งเปลี่ยนชื่อเอนทิตี้ → เข้าคิว rename ทุกไฟล์ (ทำงานเมื่อ auto-sync เปิด)
export function notifyEntityRenamed(entityId, oldName, newName) {
  if (!isAutoSyncOn() || !oldName || oldName === newName) return null;
  return getTaskEngine().emit('entity:renamed', { id: entityId, entityId, oldName, newName });
}

// ล้างเมื่อเปลี่ยนโปรเจกต์
export function resetTaskEngine() {
  if (engine && ticker) engine.stop((h) => clearInterval(h));
  ticker = null;
  engine = null;
}

// ═══════════ [alpha.125 ข้อ C] ★ เปลี่ยนชื่อเอนทิตี้แล้วต้องไม่ทิ้งการอ้างถึงไว้เงียบ ๆ ═══════════
//
// `renderAutoSyncSection()` ถูกถอดออกแล้ว: มันสร้าง `<input id="st-autosync">` อีกตัว
// ทั้งที่กล่องตั้งค่ามีช่องนั้นอยู่แล้วจริง ๆ (dialogs.js อ่าน/เขียน `#st-autosync`)
// → mount เมื่อไหร่ได้ **id ซ้ำ** ทันที แล้ว `querySelector` จะไปเจอตัวผิด (บั๊กแน่นอน)
// ช่องโหว่ตัวจริงไม่ใช่ "ไม่มีหน้าตา" แต่คือ **ปิด auto-sync ไว้แล้วเปลี่ยนชื่อ = ไม่มีอะไรเกิดขึ้นเลย**
// ผู้ใช้เปลี่ยน "ทอร่า" → "โทระ" แล้วชื่อเก่าค้างอยู่ในทุกฉากโดยไม่มีอะไรบอก
//
// ตอนนี้: เปิด auto-sync = ทำให้เงียบ ๆ เหมือนเดิม · ปิดอยู่ = **ถามครั้งเดียวว่าจะไล่แก้ให้ไหม**

/**
 * ไล่แก้ชื่อที่ถูกอ้างถึงในทุกไฟล์ข้อความของโปรเจกต์
 * @returns {Promise<{changed:boolean, files:string[]}>}
 */
export async function renameAcrossProject(oldName, newName) {
  const files = await listTextFiles(state.root);
  const run = renameEntityTask({
    readFile: (p) => kapi.readFile(p).catch(() => null),
    writeFile: (p, c) => kapi.writeFile(p, c),
  });
  return run({ oldName, newName, files });
}

/**
 * เปลี่ยนชื่อเอนทิตี้แล้วจัดการการอ้างถึงให้ครบ
 * เปิด auto-sync → เข้าคิวเงียบ ๆ (พฤติกรรมเดิม) · ปิดอยู่ → ถามก่อนแก้
 * @returns {Promise<'queued'|'renamed'|'skipped'|'none'>} ผลที่เกิดจริง (เทสใช้ยืนยัน)
 */
export async function handleEntityRenamed(entityId, oldName, newName) {
  if (!oldName || !newName || oldName === newName || !state.root) return 'none';
  if (isAutoSyncOn()) { notifyEntityRenamed(entityId, oldName, newName); return 'queued'; }
  const { confirmBox } = await import('../ui.js');
  if (!(await confirmBox(tf('ui.autoTaskEvent.renameAsk', oldName, newName),
                         t('ui.autoTaskEvent.renameGo')))) {
    setStatus(t('ui.autoTaskEvent.renameSkipped'));
    return 'skipped';
  }
  const r = await renameAcrossProject(oldName, newName);
  setStatus(r.changed ? tf('ui.autoTaskEvent.autoSyncUpdateName', r.files.length)
                      : t('ui.autoTaskEvent.renameNoHit'));
  return 'renamed';
}
