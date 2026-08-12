// export-zip.js — ส่งออกโปรเจกต์ทั้งหมดเป็น .zip (รูปภาพต้องไม่เสีย → อ่าน/เขียนเป็นไบต์เท่านั้น)
import { T } from './i18n.js';
import { state, setStatus, log, setBusy, clearBusy } from './core.js';
import JSZip from 'jszip';

const SKIP_DIRS = ['Snapshots', '.k2history', 'Backups', 'Recycle'];
// นามสกุลที่ต้องอ่านเป็นไบต์ (ถ้าอ่านเป็น utf-8 ไฟล์จะเสีย)
const BIN_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|pdf|zip|mp3|mp4|wav|ttf|otf|woff2?)$/i;

export async function exportProjectZip() {
  if (!state.root) { setStatus(T`ยังไม่ได้เปิดโปรเจกต์`); return false; }
  // [alpha.62 บั๊ก 10] บอกความคืบหน้าที่แถบล่าง — โปรเจกต์ใหญ่ ๆ ใช้เวลาหลายวินาที
  setBusy(T`กำลังแพ็ค ZIP…`);
  try {
    const zip = new JSZip();
    let nFiles = 0;
    const addDir = async (dir, prefix = '') => {
      for (const f of await kapi.listFiles(dir, '').catch(() => [])) {
        const full = await kapi.join(dir, f);
        try {
          if (BIN_EXT.test(f)) {
            const bytes = await kapi.readBytes(full);       // ไบต์ดิบ — รูปไม่เสีย
            zip.file(prefix + f, new Uint8Array(bytes));
          } else {
            zip.file(prefix + f, await kapi.readFile(full));
          }
          nFiles++;
          if (nFiles % 20 === 0) setBusy(T`กำลังแพ็ค ZIP… (${nFiles} ไฟล์)`);
        } catch (e) { log('warn', T`export-zip: ข้ามไฟล์ ` + full, e); }
      }
      for (const d of await kapi.listDirs(dir).catch(() => [])) {
        if (SKIP_DIRS.includes(d)) continue;
        await addDir(await kapi.join(dir, d), prefix + d + '/');
      }
    };
    await addDir(state.root);

    // เคลียร์ก่อนเปิดกล่องบันทึกเสมอ — ห้ามมีสปินเนอร์หมุนค้างตอนรอผู้ใช้ตอบ (บทเรียนจากบั๊ก 9)
    clearBusy();
    const dest = await kapi.saveAsDialog((state.title || 'project') + '.zip');
    if (!dest) return false;
    setBusy(T`กำลังบีบอัดและเขียนไฟล์ ZIP…`);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    // ส่งเป็น byte array ผ่าน IPC — ห้ามแปลงเป็น string (utf-8 จะบวมไฟล์เสีย)
    await kapi.writeBytes(dest, Array.from(bytes));
    setStatus(T`ส่งออก ZIP แล้ว (${nFiles} ไฟล์): ` + dest);
    log('info', 'export-zip: done ' + nFiles + ' files');
    return true;
  } catch (e) {
    log('error', 'export-zip failed', e);
    setStatus(T`ส่งออก ZIP ล้มเหลว: ` + e.message);
    return false;
  } finally { clearBusy(); }
}

/**
 * [alpha.60r3 ข้อ 9] นำเข้าโปรเจกต์จากไฟล์ .zip ที่ `exportProjectZip()` สร้างไว้
 *
 * ขั้นตอน: เลือกไฟล์ .zip → เลือกโฟลเดอร์ปลายทาง → แตกลงโฟลเดอร์ย่อยชื่อเดียวกับไฟล์ → เปิดโปรเจกต์
 *
 * เรื่องที่ต้องระวัง:
 *   · **ไบนารีต้องผ่าน `writeBytes`** — `writeFile` เขียน utf-8 แล้วรูป/ฟอนต์บวมเสียหมด (บทเรียน 14d)
 *   · **zip slip** — path ใน zip ที่มี `..` ต้องถูกทิ้ง ไม่งั้นเขียนไฟล์นอกโฟลเดอร์ปลายทางได้
 *   · zip บางไฟล์ห่อทุกอย่างไว้ในโฟลเดอร์ชั้นเดียว → ตรวจแล้วปอกออกให้ ไม่งั้นได้ path ซ้อนสองชั้น
 * @param {string} [srcZip] ข้ามกล่องเลือกไฟล์ (ใช้ในเทส)
 * @param {string} [dstParent] ข้ามกล่องเลือกโฟลเดอร์ (ใช้ในเทส)
 * @returns {Promise<string|false>} path ของโปรเจกต์ที่แตกออกมา
 */
export async function importProjectZip(srcZip, dstParent) {
  const src = srcZip || await kapi.openFileDialog('zip');
  if (!src) return false;
  const parent = dstParent || await kapi.openDirDialog();
  if (!parent) return false;
  setBusy(T`กำลังแตกไฟล์ ZIP…`);
  try {
    const bytes = await kapi.readBytes(src);
    const zip = await JSZip.loadAsync(new Uint8Array(bytes));
    const entries = Object.keys(zip.files).filter((k) => !zip.files[k].dir);
    if (!entries.length) { setStatus(T`ไฟล์ ZIP นี้ว่างเปล่า`); return false; }

    // zip ที่ห่อทุกอย่างไว้ในโฟลเดอร์เดียว → ปอกชั้นนอกออก
    const strip = commonPrefix(entries);
    const base = String(src).split(/[\\/]/).pop().replace(/\.zip$/i, '') || 'project';
    let dest = await kapi.join(parent, base);
    if (await kapi.exists(dest)) dest += '-' + Date.now().toString(36).slice(-4);
    await kapi.mkdir(dest);

    let n = 0;
    for (const name of entries) {
      const rel = safeRel(strip ? name.slice(strip.length) : name);
      if (!rel) continue;
      const parts = rel.split('/');
      const file = await kapi.join(dest, ...parts);
      if (parts.length > 1) await kapi.mkdir(await kapi.join(dest, ...parts.slice(0, -1)));
      if (BIN_EXT.test(rel)) {
        const buf = await zip.files[name].async('uint8array');
        await kapi.writeBytes(file, Array.from(buf));
      } else {
        await kapi.writeFile(file, await zip.files[name].async('string'));
      }
      n++;
      if (n % 20 === 0) setBusy(T`กำลังแตกไฟล์ ZIP… (${n}/${entries.length})`);
    }
    clearBusy();                                   // loadProject ข้างล่างตั้งข้อความของมันเอง
    if (!(await kapi.exists(await kapi.join(dest, 'project.khn.json')))) {
      setStatus(T`แตกไฟล์แล้ว (${n} ไฟล์) แต่ไม่พบ project.khn.json — ไม่ใช่โปรเจกต์ Killian`);
      log('warn', T`import-zip: ไม่มี project.khn.json ที่ ` + dest);
      return dest;
    }
    setStatus(T`นำเข้าโปรเจกต์แล้ว (${n} ไฟล์): ` + dest);
    log('info', 'import-zip: done ' + n + ' files → ' + dest);
    const { loadProject } = await import('./app.js');
    await loadProject(dest);
    return dest;
  } catch (e) {
    log('error', 'import-zip failed', e);
    setStatus(T`นำเข้า ZIP ล้มเหลว: ` + e.message);
    return false;
  } finally { clearBusy(); }
}

/** โฟลเดอร์ชั้นนอกที่ทุกไฟล์ใช้ร่วมกัน (คืน '' เมื่อไม่มี) */
export function commonPrefix(names) {
  if (!names.length) return '';
  const first = names[0];
  const slash = first.indexOf('/');
  if (slash < 0) return '';
  const p = first.slice(0, slash + 1);
  return names.every((n) => n.startsWith(p)) ? p : '';
}

/** ตัด path ที่หลุดออกนอกโฟลเดอร์ปลายทาง (zip slip) */
export function safeRel(name) {
  const clean = String(name || '').replace(/\\/g, '/').replace(/^[/]+/, '');
  if (!clean || clean.endsWith('/')) return '';
  const parts = clean.split('/').filter((x) => x && x !== '.');
  if (parts.includes('..')) return '';
  if (/^[a-zA-Z]:/.test(parts[0] || '')) return '';       // path แบบ C:\… ใน zip
  return parts.join('/');
}

// export-json — ส่งออกเมทาดาทาทั้งหมดเป็น JSON ก้อนเดียว
export async function exportProjectJson() {
  if (!state.root) { setStatus(T`ยังไม่ได้เปิดโปรเจกต์`); return false; }
  setBusy(T`กำลังรวบรวม JSON…`);
  try {
    const data = { project: state.meta, sections: [] };
    for (const sec of await kapi.listDirs(state.root)) {
      if (['Wiki','Bible','Images','Memos','Recycle','Snapshots', '.k2history','Backups','Plugins','Research'].includes(sec)) continue;
      const sp = await kapi.join(state.root, sec);
      const sj = await kapi.join(sp, 'section.json');
      if (!(await kapi.exists(sj))) continue;
      const secData = { name: sec, section: await kapi.readJson(sj), drafts: [] };
      const dr = await kapi.join(sp, 'Draft');
      if (await kapi.exists(dr)) {
        for (const dn of await kapi.listDirs(dr)) {
          const dp = await kapi.join(dr, dn);
          secData.drafts.push({
            name: dn,
            draft: await kapi.readJson(await kapi.join(dp, 'draft.json')).catch(() => ({})),
            scenes: await kapi.readJson(await kapi.join(dp, 'scenes.json')).catch(() => ({})),
          });
        }
      }
      data.sections.push(secData);
    }
    clearBusy();                                   // อย่าให้สปินเนอร์ค้างตอนรอผู้ใช้ตอบกล่องบันทึก
    const dest = await kapi.saveAsDialog((state.title || 'project') + '-export.json');
    if (!dest) return false;
    setBusy(T`กำลังเขียนไฟล์ JSON…`);
    await kapi.writeFile(dest, JSON.stringify(data, null, 2));
    setStatus(T`ส่งออก JSON แล้ว: ` + dest);
    return true;
  } catch (e) {
    log('error', 'export-json failed', e);
    setStatus(T`ส่งออก JSON ล้มเหลว`);
    return false;
  } finally { clearBusy(); }
}
