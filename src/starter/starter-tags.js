// starter-tags.js — ป้ายของแท็กสำเร็จรูปใน Story Starter (alpha.170)
//
// ค่าของแท็ก (`fantasy` · `slice of life` …) เป็น **ข้อมูล**: เขียนลง starter.json และส่งเข้า prompt ของ AI
// จึงไม่แปล (กฎ: ค่าที่เขียนลงไฟล์งานห้ามแปล) — แปลเฉพาะตอนวาดด้วย `tagLabel()` เหมือน `dataLabel()` ของ core
// เดิมหน้าจอภาษาไทยขึ้นแท็กเป็นอังกฤษทั้งชุด ปนกับหัวกลุ่มที่เป็นไทย ("แนว: fantasy · sci-fi · …")
//
// ตารางคีย์เต็ม (ห้ามประกอบคีย์จากชิ้นส่วน — ตัวตรวจไฟล์ภาษามองไม่เห็น) · แท็กที่ผู้ใช้พิมพ์เองไม่มีในตาราง = โชว์ตามที่พิมพ์
import { t } from '../i18n.js';

export const TAG_LABEL_KEYS = {
  'fantasy': 'ui.starterTag.fantasy',
  'sci-fi': 'ui.starterTag.sciFi',
  'isekai': 'ui.starterTag.isekai',
  'romance': 'ui.starterTag.romance',
  'harem': 'ui.starterTag.harem',
  'action': 'ui.starterTag.action',
  'mystery': 'ui.starterTag.mystery',
  'horror': 'ui.starterTag.horror',
  'slice of life': 'ui.starterTag.sliceOfLife',
  'comedy': 'ui.starterTag.comedy',
  'drama': 'ui.starterTag.drama',
  'thriller': 'ui.starterTag.thriller',
  'historical': 'ui.starterTag.historical',
  'dark': 'ui.starterTag.dark',
  'lighthearted': 'ui.starterTag.lighthearted',
  'bittersweet': 'ui.starterTag.bittersweet',
  'epic': 'ui.starterTag.epic',
  'gritty': 'ui.starterTag.gritty',
  'wholesome': 'ui.starterTag.wholesome',
  'satirical': 'ui.starterTag.satirical',
  'modern': 'ui.starterTag.modern',
  'medieval': 'ui.starterTag.medieval',
  'cyberpunk': 'ui.starterTag.cyberpunk',
  'post-apocalyptic': 'ui.starterTag.postApocalyptic',
  'school': 'ui.starterTag.school',
  'space': 'ui.starterTag.space',
  'urban fantasy': 'ui.starterTag.urbanFantasy',
  'steampunk': 'ui.starterTag.steampunk',
  'all ages': 'ui.starterTag.allAges',
  'teen': 'ui.starterTag.teen',
  'mature': 'ui.starterTag.mature',
};

/** ป้ายของแท็กในภาษาของหน้าจอ — แท็กที่ไม่อยู่ในตาราง (ผู้ใช้พิมพ์เอง) คืนตามเดิม */
export function tagLabel(tag) {
  const raw = String(tag == null ? '' : tag);
  const key = TAG_LABEL_KEYS[raw.toLowerCase()];
  if (!key) return raw;
  const s = t(key);
  return s && s !== key ? s : raw;
}
