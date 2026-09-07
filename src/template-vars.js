// template-vars.js — build variable context จาก Wiki entities สำหรับ compile workflow
// ไม่แตะ DOM — pure async function

/**
 * โหลด Wiki entities ทั้งหมดจากโปรเจกต์ สร้าง context object สำหรับ resolve ตัวแปร
 * @param {string} root — project root path
 * @param {object} api  — kapi-like interface { join, exists, listDirs, listFiles, readJson }
 * @returns {Promise<object>} context เช่น { 'ตัวละครA': 'ชื่อตัวละคร', 'ตัวละครA.age': '25', age: '25' }
 */
export async function buildVarContext(root, api) {
  const wikiRoot = await api.join(root, 'Wiki');
  if (!(await api.exists(wikiRoot))) return {};

  const ctx = {};
  const fieldCount = {};

  for (const cat of await api.listDirs(wikiRoot)) {
    const catDir = await api.join(wikiRoot, cat);
    try {
      const files = await api.listFiles(catDir, '.json');
      for (const f of files) {
        const file = await api.join(catDir, f);
        let entity;
        try { entity = await api.readJson(file); } catch { continue; }
        if (!entity || !entity.name) continue;

        ctx[entity.name] = entity.name;
        fieldCount[entity.name] = (fieldCount[entity.name] || 0) + 1;

        for (const [k, v] of Object.entries(entity.fields || {})) {
          const dk = `${entity.name}.${k}`;
          ctx[dk] = String(v ?? '');
          fieldCount[dk] = 1;

          if (k in ctx) {
            fieldCount[k] = (fieldCount[k] || 1) + 1;
          } else {
            ctx[k] = String(v ?? '');
            fieldCount[k] = 1;
          }
        }
      }
    } catch {}
  }

  // remove ambiguous keys (existed in multiple entities)
  for (const [k, count] of Object.entries(fieldCount)) {
    if (count > 1) delete ctx[k];
  }

  return ctx;
}

/**
 * Resolve {{...}} variables ใน string ด้วย context
 * @param {string} text — ข้อความที่อาจมี {{key}}
 * @param {object} ctx — context จาก buildVarContext() + model metadata
 * @returns {string}
 */
export function resolveVars(text, ctx = {}) {
  if (!text) return '';
  return String(text).replace(/\{\{([\w.\u0E00-\u0E7F]+)\}\}/g, (_, k) => {
    const key = k.trim();
    return (key in ctx && ctx[key] != null) ? String(ctx[key]) : _;
  });
}
