// starter-pack.js — ส่งออก/นำเข้า starter เป็นไฟล์ .zip (เฟส 5)
//
// นี่คือผลพลอยได้ของการตัดสินใจข้อ 9 (starter = โฟลเดอร์เดียวที่พกพาได้)
// พอทุกอย่างอยู่ในโฟลเดอร์เดียวจริง ๆ การแจกก็เหลือแค่ "บีบโฟลเดอร์นั้น"
// ไม่ต้องไปไล่เก็บของจากที่อื่นในโปรเจกต์เลย
//
// **รูปต้องผ่าน `readBytes`/`writeBytes`** — `readFile` อ่านเป็น utf-8 แล้วไฟล์ภาพเสียหมด
// (บทเรียนเดียวกับ export-zip.js — เสียเวลาไปแล้วครั้งหนึ่ง อย่าซ้ำ)

import JSZip from 'jszip';
import { state, setStatus, setBusy, clearBusy, log } from '../core.js';
import { t, tf } from '../i18n.js';
import { uniqueSlug, migrateStarter } from './starter-model.js';
import { starterDir, listStarters, readStarter } from './starter-store.js';

const BIN_EXT = /\.(png|jpe?g|jfif|gif|webp|svg|avif|bmp|ico|tiff?|heic|heif|apng|ttf|otf|woff2?)$/i;

/** ทุกไฟล์ในโฟลเดอร์ (ลงลึกทุกชั้น) → ใส่ zip */
async function addDir(zip, dir, prefix = '') {
  for (const f of await kapi.listFiles(dir, '').catch(() => [])) {
    const full = await kapi.join(dir, f);
    try {
      if (BIN_EXT.test(f)) zip.file(prefix + f, new Uint8Array(await kapi.readBytes(full)));
      else zip.file(prefix + f, await kapi.readFile(full));
    } catch (e) { log('warn', t('ui.starter.packSkip') + full, e); }
  }
  for (const d of await kapi.listDirs(dir).catch(() => [])) {
    await addDir(zip, await kapi.join(dir, d), prefix + d + '/');
  }
}

/**
 * บีบโฟลเดอร์ของ starter เป็นไบต์ — **ไม่ถามที่เก็บ ไม่แตะกล่องโต้ตอบ**
 * แยกออกมาเพื่อให้เทสรันครบวง (บีบ → แตก → เทียบ) โดยไม่ต้องมีคนกดเลือกไฟล์
 * @returns {Promise<Uint8Array|null>}
 */
export async function packStarter(slug) {
  const dir = await starterDir(slug);
  if (!slug || !(await kapi.exists(dir))) return null;
  const zip = new JSZip();
  await addDir(zip, dir, '');
  return zip.generateAsync({ type: 'uint8array' });
}

/**
 * ส่งออก starter หนึ่งตัวเป็น .zip (ถามที่เก็บ)
 * @returns {Promise<string>} path ปลายทาง ('' = ยกเลิก/ล้มเหลว)
 */
export async function exportStarterZip(s) {
  if (!s || !s.slug) return '';
  const dir = await starterDir(s.slug);
  if (!(await kapi.exists(dir))) { setStatus(t('ui.starter.packNoDir')); return ''; }
  setBusy(t('ui.starter.packBusy'));
  try {
    const bytes = await packStarter(s.slug);
    clearBusy();      // ห้ามให้สปินเนอร์หมุนค้างระหว่างรอผู้ใช้ตอบกล่องบันทึก
    if (!bytes) { setStatus(t('ui.starter.packNoDir')); return ''; }
    const dest = await kapi.saveAsDialog((s.slug || 'starter') + '.zip', 'zip');
    if (!dest) return '';
    setBusy(t('ui.starter.packWriting'));
    await kapi.writeBytes(dest, Array.from(bytes));
    setStatus(t('ui.starter.packDone') + dest);
    return dest;
  } catch (e) {
    log('error', 'starter pack', e);
    setStatus(t('ui.starter.packFail'));
    return '';
  } finally { clearBusy(); }
}

/**
 * นำเข้า .zip เป็น starter ตัวใหม่ในโปรเจกต์ปัจจุบัน
 *
 * ชื่อโฟลเดอร์ถูกตั้งใหม่เสมอให้ไม่ชนของเดิม — นำเข้าไฟล์เดิมซ้ำได้ ได้คนละตัว
 * (ตั้งใจ: บางคนอยากมีสองสาขาจาก starter เดียวกัน)
 *
 * @returns {Promise<object|null>} starter ที่นำเข้ามา
 */
export async function importStarterZip() {
  if (!state.root) { setStatus(t('ui.common.cantOpenProject')); return null; }
  const src = await kapi.openFileDialog('zip');
  if (!src) return null;
  return unpackStarter(new Uint8Array(await kapi.readBytes(src)));
}

/**
 * แตกไบต์ .zip เป็น starter ตัวใหม่ — คู่กับ `packStarter` และไม่แตะกล่องโต้ตอบ
 * @param {Uint8Array} bytes
 */
export async function unpackStarter(bytes) {
  if (!state.root) { setStatus(t('ui.common.cantOpenProject')); return null; }
  setBusy(t('ui.starter.packReading'));
  try {
    const zip = await JSZip.loadAsync(bytes);

    // หา starter.json ในซิป — ยอมรับทั้งแบบบีบเนื้อในตรง ๆ และแบบมีโฟลเดอร์ครอบหนึ่งชั้น
    let base = '';
    const names = Object.keys(zip.files);
    const hit = names.find((n) => n === 'starter.json' || n.endsWith('/starter.json'));
    if (!hit) { setStatus(t('ui.starter.packNotStarter')); return null; }
    base = hit.slice(0, hit.length - 'starter.json'.length);

    const rawText = await zip.file(hit).async('string');
    let raw = null;
    try { raw = JSON.parse(rawText); } catch { setStatus(t('ui.starter.packBadJson')); return null; }
    const s = migrateStarter(raw);

    const taken = (await listStarters()).map((x) => x.slug);
    s.slug = uniqueSlug(s.name || 'starter', taken);
    const dst = await starterDir(s.slug);
    await kapi.mkdir(dst);

    let n = 0;
    for (const name of names) {
      const f = zip.files[name];
      if (f.dir) continue;
      if (base && !name.startsWith(base)) continue;
      const rel = name.slice(base.length);
      if (!rel || rel.startsWith('..')) continue;         // กัน path หลุดออกนอกโฟลเดอร์
      const parts = rel.split('/').filter(Boolean);
      if (!parts.length) continue;
      const out = await kapi.join(dst, ...parts);
      if (parts.length > 1) await kapi.mkdir(await kapi.join(dst, ...parts.slice(0, -1)));
      if (BIN_EXT.test(rel)) {
        const buf = await f.async('uint8array');
        await kapi.writeBytes(out, Array.from(buf));
      } else {
        await kapi.writeFile(out, await f.async('string'));
      }
      n++;
    }

    // เขียน starter.json ทับด้วยตัวที่ผ่าน migrate แล้ว (ไฟล์เก่ารุ่นก่อนจึงเปิดได้)
    const body = { ...s };
    delete body.slug;
    await kapi.writeFile(await kapi.join(dst, 'starter.json'), JSON.stringify(body, null, 2));

    setStatus(tf('ui.starter.packImported', s.name || s.slug, n));
    return await readStarter(s.slug);
  } catch (e) {
    log('error', 'starter unpack', e);
    setStatus(t('ui.starter.packFail'));
    return null;
  } finally { clearBusy(); }
}
