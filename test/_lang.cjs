// test/_lang.cjs — ให้ unit test บน node มีตารางคำแปลจริง
//
// ตั้งแต่ alpha.77 `t()` **ไม่มีการตกกลับเป็นภาษาอื่น** — ไม่มีตาราง = คืนตัวคีย์
// เทสที่ตรวจ "ข้อความที่ผู้ใช้เห็น" จึงต้องโหลดไฟล์ภาษาจริงก่อน ไม่งั้นได้คีย์มาเทียบ
//
// วิธี: ปลอม `globalThis.kapi.langSync` ให้เหมือนฝั่ง renderer — `src/i18n.js` จะโหลดเองตอน import
// (เดินทางเดียวกับของจริงเป๊ะ ไม่ได้ยัดตารางเข้าไปทางลัด) · **ต้องเรียกก่อน require บันเดิล**
const fs = require('fs');
const path = require('path');

function installLang(code = 'th') {
  const file = path.join(__dirname, '..', 'languages', 'k2_' + code + '.csv');
  const csv = fs.readFileSync(file, 'utf8');
  globalThis.kapi = Object.assign(globalThis.kapi || {}, {
    langSync: () => ({ code, csv, catalog: [{ code, file, name: code, nativeName: code }] }),
  });
  return csv;
}

module.exports = { installLang };
