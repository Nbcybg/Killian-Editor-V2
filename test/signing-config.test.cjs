// test/signing-config.test.cjs — [alpha.170 · ข้อ 4] ลงนามตัวโปรแกรมเมื่อมีใบรับรองเท่านั้น
// build/electron-builder.config.cjs + .github/workflows/release.yml
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'build', 'signing.cjs'));
const DEFAULT = require(path.join(ROOT, 'build', 'electron-builder.config.cjs'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).build;
const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); }
}

// ── ไม่มีอะไรตั้งไว้ = เหมือน package.json ทุกอย่าง (ไม่ลงนาม) ──
{
  const cfg = C.signingConfig(base, {});
  check('[sg-1] ไม่มี secrets = ไม่ลงนาม mac (identity null)', cfg.mac.identity === null && cfg.mac.hardenedRuntime === false && !cfg.mac.notarize);
  check('[sg-1] ไม่มี secrets = ไม่มี azureSignOptions', !cfg.win.azureSignOptions);
  check('[sg-1] ชื่อไฟล์/เป้าหมายเหมือน package.json (README · ตัวอัปเดตชี้ชื่อเหล่านี้)', cfg.portable.artifactName === base.portable.artifactName
        && cfg.mac.artifactName === base.mac.artifactName && cfg.linux.artifactName === base.linux.artifactName
        && JSON.stringify(cfg.files) === JSON.stringify(base.files));
  check('[sg-1] secrets ที่ไม่ได้ตั้ง (สตริงว่าง) = ไม่มี', JSON.stringify(C.signingPlan({ CSC_LINK: '', CSC_KEY_PASSWORD: ' ', APPLE_ID: '' })) === JSON.stringify({ mac: false, notarize: false, azure: false }));
  check('[sg-1] ตัวที่ export เป็นค่าเริ่มต้นใช้ได้กับ electron-builder (มี appId/files)', !!DEFAULT.appId === !!base.appId && Array.isArray(DEFAULT.files));
  check('[sg-1] ไฟล์ config ไม่แนบฟังก์ชัน/คีย์นอก package.json (schema ของ electron-builder ไม่รับ — build ล้ม)', Object.keys(DEFAULT).every((k) => k in base && typeof DEFAULT[k] !== 'function'), Object.keys(DEFAULT).filter((k) => !(k in base)));
  check('[sg-1] ไม่แก้ package.json ในหน่วยความจำ', base.mac.identity === null);
}

// ── macOS ──
{
  const env = { CSC_LINK: 'MIIK...', CSC_KEY_PASSWORD: 'x' };
  const signOnly = C.signingConfig(base, env);
  check('[sg-2] มีใบรับรอง = ลงนาม (ถอด identity:null) + Hardened Runtime + entitlements', !('identity' in signOnly.mac) && signOnly.mac.hardenedRuntime === true
        && /entitlements\.mac\.plist$/.test(signOnly.mac.entitlements) && signOnly.mac.notarize === false);
  const notary = C.signingConfig(base, { ...env, APPLE_ID: 'a@b', APPLE_APP_SPECIFIC_PASSWORD: 'p', APPLE_TEAM_ID: 'T' });
  check('[sg-2] + Apple ID ครบสามค่า = notarize', notary.mac.notarize === true);
  const key = C.signingConfig(base, { ...env, APPLE_API_KEY: 'k.p8', APPLE_API_KEY_ID: 'K', APPLE_API_ISSUER: 'I' });
  check('[sg-2] + API key ครบสามค่า = notarize', key.mac.notarize === true);
  check('[sg-2] notarize โดยไม่มีใบรับรอง = ไม่ทำ', C.signingConfig(base, { APPLE_ID: 'a', APPLE_APP_SPECIFIC_PASSWORD: 'p', APPLE_TEAM_ID: 'T' }).mac.notarize !== true);
  const ent = fs.readFileSync(path.join(ROOT, 'build', 'entitlements.mac.plist'), 'utf8');
  check('[sg-2] entitlements ของ Electron (JIT)', ent.includes('com.apple.security.cs.allow-jit') && ent.includes('allow-unsigned-executable-memory'));
}

// ── Windows (Azure Artifact Signing) ──
{
  const az = { AZURE_TENANT_ID: 't', AZURE_CLIENT_ID: 'c', AZURE_CLIENT_SECRET: 's', K2_AZURE_ENDPOINT: 'https://x.codesigning.azure.net', K2_AZURE_ACCOUNT: 'acc', K2_AZURE_PROFILE: 'prof', K2_AZURE_PUBLISHER: 'Noobcyborg Studio' };
  const cfg = C.signingConfig(base, az);
  check('[sg-3] Azure ครบ = azureSignOptions', cfg.win.azureSignOptions && cfg.win.azureSignOptions.publisherName === 'Noobcyborg Studio' && cfg.win.azureSignOptions.certificateProfileName === 'prof');
  check('[sg-3] Azure ขาดค่าเดียว = ไม่ลงนาม', !C.signingConfig(base, { ...az, K2_AZURE_PROFILE: '' }).win.azureSignOptions);
}

// ── workflow ──
{
  check('[sg-4] workflow ใช้ไฟล์ config นี้', yml.includes('--config build/electron-builder.config.cjs'));
  check('[sg-4] ใบรับรอง mac ส่งเฉพาะงานของ macOS', /CSC_LINK: \$\{\{ runner\.os == 'macOS' && secrets\.MAC_CERT_P12_BASE64 \|\| '' \}\}/.test(yml));
  check('[sg-4] SignPath ทำงานเฉพาะเมื่อมี secret', yml.includes("HAS_SIGNPATH: ${{ secrets.SIGNPATH_API_TOKEN != '' }}") && (yml.match(/env\.HAS_SIGNPATH == 'true'/g) || []).length === 3);
  check('[sg-4] แนบ SHA256SUMS ทุกระบบ', yml.includes('SHA256SUMS-${RUNNER_OS}.txt') && yml.includes('dist/SHA256SUMS-*.txt'));
  check('[sg-4] ไม่พิมพ์ secrets ลงบันทึก', !/echo[^\n]*secrets\./.test(yml));
  check('[sg-4] ไม่มีข้อความจากผู้ใช้ (issue/PR) ถูกนำไปรัน', !/github\.event\.(issue|pull_request|comment)/.test(yml));
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'signing.md'), 'utf8');
  const names = ['MAC_CERT_P12_BASE64', 'MAC_CERT_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID',
    'SIGNPATH_API_TOKEN', 'SIGNPATH_ORGANIZATION_ID', 'SIGNPATH_PROJECT_SLUG', 'SIGNPATH_POLICY_SLUG', 'SIGNPATH_ARTIFACT_CONFIG',
    'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'K2_AZURE_ENDPOINT', 'K2_AZURE_ACCOUNT', 'K2_AZURE_PROFILE', 'K2_AZURE_PUBLISHER'];
  const missing = names.filter((n) => !yml.includes(n) || !doc.includes(n));
  check('[sg-4] ทุก secret/var ที่ workflow ใช้มีอยู่ในคู่มือ docs/signing.md (และกลับกัน)', missing.length === 0, missing);
}

console.log(`\nsigning-config: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
