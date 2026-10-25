// build/signing.cjs — [alpha.170 · ข้อ 4] ตัดสินว่าจะลงนามระบบไหน (บริสุทธิ์ · unit `signing-config`)
// แยกจาก electron-builder.config.cjs เพราะ electron-builder ตรวจ schema ของค่าที่ไฟล์นั้น export —
// ฟังก์ชันที่ติดไปกับค่า (`module.exports.x = fn`) = "configuration has an unknown property" แล้ว build ล้ม

const path = require('path');

/** ค่าที่ว่าง/ช่องว่างล้วน = ไม่มี (secrets ที่ไม่ได้ตั้งถูกส่งมาเป็นสตริงว่าง) */
const has = (env, k) => typeof env[k] === 'string' && env[k].trim() !== '';

/** ระบบไหนลงนามได้ตามตัวแปรที่มี */
function signingPlan(env = {}) {
  const macCert = has(env, 'CSC_LINK') && has(env, 'CSC_KEY_PASSWORD');
  const notaryId = has(env, 'APPLE_ID') && has(env, 'APPLE_APP_SPECIFIC_PASSWORD') && has(env, 'APPLE_TEAM_ID');
  const notaryKey = has(env, 'APPLE_API_KEY') && has(env, 'APPLE_API_KEY_ID') && has(env, 'APPLE_API_ISSUER');
  const azure = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET',
    'K2_AZURE_ENDPOINT', 'K2_AZURE_ACCOUNT', 'K2_AZURE_PROFILE', 'K2_AZURE_PUBLISHER'].every((k) => has(env, k));
  return { mac: macCert, notarize: macCert && (notaryId || notaryKey), azure };
}

/**
 * @param {object} base `package.json → build`
 * @param {object} env  ตัวแปรสภาพแวดล้อม
 * @returns {object} ค่าของ electron-builder (สำเนาใหม่ — ไม่แก้ base)
 */
function signingConfig(base, env = {}) {
  const plan = signingPlan(env);
  const cfg = JSON.parse(JSON.stringify(base || {}));
  cfg.mac = cfg.mac || {};
  if (plan.mac) {
    // `identity: null` ใน package.json = ปิดการลงนาม → ถอดออกให้ electron-builder หาใบรับรองจาก CSC_LINK เอง
    delete cfg.mac.identity;
    cfg.mac.hardenedRuntime = true;           // notarize บังคับ
    cfg.mac.gatekeeperAssess = false;
    cfg.mac.entitlements = path.join('build', 'entitlements.mac.plist');
    cfg.mac.entitlementsInherit = path.join('build', 'entitlements.mac.plist');
    cfg.mac.notarize = plan.notarize;
  } else {
    cfg.mac.identity = null;                  // ไม่มีใบรับรอง = ไม่ลงนาม (อย่าหยิบใบรับรองอื่นในเครื่องมาเอง)
  }
  if (plan.azure) {
    cfg.win = cfg.win || {};
    cfg.win.azureSignOptions = {
      publisherName: env.K2_AZURE_PUBLISHER,
      endpoint: env.K2_AZURE_ENDPOINT,
      codeSigningAccountName: env.K2_AZURE_ACCOUNT,
      certificateProfileName: env.K2_AZURE_PROFILE,
    };
  }
  return cfg;
}

module.exports = { signingPlan, signingConfig };
