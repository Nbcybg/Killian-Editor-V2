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

// แสดงส่วน Auto-sync ใน settings dialog (สำรอง — settingsDialog มีช่องของตัวเองแล้ว)
export function renderAutoSyncSection(host) {
  const div = el('div');
  const lab = el('label');
  const cb = el('input'); cb.type = 'checkbox'; cb.id = 'st-autosync';
  cb.checked = isAutoSyncOn();
  cb.onchange = () => setAutoSync(cb.checked);
  lab.append(cb, document.createTextNode(t('ui.autoTaskEvent.openAutoSyncUpdate')));
  div.append(lab);
  host.appendChild(div);
  return div;
}
