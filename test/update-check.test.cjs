// test/update-check.test.cjs — [alpha.135] ระบบอัปเดต (ตรรกะล้วน)
//
// สิ่งที่ต้องกันไม่ให้พลาดที่สุดคือ **ที่มา**: ผู้ใช้สั่งว่าอัปเดตมาจาก
// https://github.com/Nbcybg/Killian-Editor-V2.git ที่เดียวเท่านั้น
// → เทสตรึงทั้งค่าคงที่และด่านตรวจลิงก์ไว้ตรงนี้ ใครแก้ที่อยู่รีโปเมื่อไหร่เทสแดงทันที
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_updcheck.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/update/update-check.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const U = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => {
  if (c) { pass++; } else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); }
};

// ═══════════ ที่มา — รีโปเดียวเท่านั้น ═══════════
{
  check('เจ้าของ/ชื่อรีโปตรงกับที่ผู้ใช้กำหนด',
        U.UPDATE_OWNER === 'Nbcybg' && U.UPDATE_REPO === 'Killian-Editor-V2',
        U.UPDATE_OWNER + '/' + U.UPDATE_REPO);
  check('ลิงก์ git ตรงกับที่ผู้ใช้สั่ง',
        U.UPDATE_GIT_URL === 'https://github.com/Nbcybg/Killian-Editor-V2.git', U.UPDATE_GIT_URL);
  check('URL ทุกเส้นสร้างจากรีโปเดียวกัน',
        [U.UPDATE_HOME_URL, U.UPDATE_RELEASES_URL, U.UPDATE_API_URL, U.UPDATE_MANIFEST_URL,
         U.UPDATE_ASSET_PREFIX].every((u) => u.includes('Nbcybg/Killian-Editor-V2')));
  check('ทุก URL เป็น https', [U.UPDATE_GIT_URL, U.UPDATE_HOME_URL, U.UPDATE_RELEASES_URL,
        U.UPDATE_API_URL, U.UPDATE_MANIFEST_URL, U.UPDATE_ASSET_PREFIX].every((u) => u.startsWith('https://')));
}

// ═══════════ ด่านตรวจลิงก์ดาวน์โหลด ═══════════
{
  const ok = 'https://github.com/Nbcybg/Killian-Editor-V2/releases/download/v2.0.0-alpha.135/Killian2.exe';
  check('ยอมรับไฟล์แนบของรีโปที่กำหนด', U.isAllowedAssetUrl(ok) === true);
  check('ปฏิเสธรีโปอื่น',
        U.isAllowedAssetUrl('https://github.com/evil/repo/releases/download/v1/x.exe') === false);
  check('ปฏิเสธเจ้าของอื่นที่ชื่อรีโปเหมือนกัน',
        U.isAllowedAssetUrl('https://github.com/evil/Killian-Editor-V2/releases/download/v1/x.exe') === false);
  check('ปฏิเสธโดเมนที่แค่ขึ้นต้นคล้ายกัน',
        U.isAllowedAssetUrl('https://github.com.evil.net/Nbcybg/Killian-Editor-V2/releases/download/v1/x.exe') === false);
  check('ปฏิเสธ http ธรรมดา',
        U.isAllowedAssetUrl('http://github.com/Nbcybg/Killian-Editor-V2/releases/download/v1/x.exe') === false);
  check('ปฏิเสธคำนำหน้าเปล่า ๆ (ไม่มีชื่อไฟล์)', U.isAllowedAssetUrl(U.UPDATE_ASSET_PREFIX) === false);
  check('ปฏิเสธลิงก์ที่มีช่องว่าง/เครื่องหมายคำพูดแทรก',
        U.isAllowedAssetUrl(U.UPDATE_ASSET_PREFIX + 'a b.exe') === false &&
        U.isAllowedAssetUrl(U.UPDATE_ASSET_PREFIX + 'a"b.exe') === false);
  check('ปฏิเสธค่าว่าง/null', U.isAllowedAssetUrl('') === false && U.isAllowedAssetUrl(null) === false);
}

// ═══════════ เทียบเวอร์ชัน ═══════════
{
  check('อ่านเลขรุ่นปกติ', JSON.stringify(U.parseVersion('2.0.0').nums) === '[2,0,0]');
  check('อ่านรุ่นทดลอง',
        JSON.stringify(U.parseVersion('2.0.0-alpha.134').pre) === '["alpha",134]');
  check('ตัด v นำหน้า', U.normalizeTag('v2.0.0-alpha.135') === '2.0.0-alpha.135');
  check('ไม่ตัด v ที่เป็นส่วนของชื่อ', U.normalizeTag('version-x') === 'version-x');
  check('อ่านไม่ออกคืน null', U.parseVersion('รุ่นล่าสุด') === null && U.parseVersion('') === null);

  check('alpha.135 ใหม่กว่า alpha.134', U.cmpVersion('2.0.0-alpha.135', '2.0.0-alpha.134') === 1);
  check('เลขในรุ่นทดลองเทียบเป็นตัวเลข ไม่ใช่ข้อความ (9 < 10)',
        U.cmpVersion('2.0.0-alpha.9', '2.0.0-alpha.10') === -1);
  check('รุ่นจริงใหม่กว่ารุ่นทดลองเสมอ', U.cmpVersion('2.0.0', '2.0.0-alpha.999') === 1);
  check('เท่ากันคืน 0', U.cmpVersion('2.0.0-alpha.134', 'v2.0.0-alpha.134') === 0);
  check('เลขหลักใหญ่ชนะ', U.cmpVersion('3.0.0', '2.9.9') === 1);
  check('รุ่นย่อยที่ยาวกว่า = ใหม่กว่า', U.cmpVersion('2.0.0-alpha.1.1', '2.0.0-alpha.1') === 1);
  check('ตัวเลขมาก่อนตัวอักษรในรุ่นย่อย', U.cmpVersion('2.0.0-1', '2.0.0-alpha') === -1);
  check('อ่านไม่ออก = ไม่ตัดสิน (0) ไม่ใช่เดาว่าใหม่กว่า',
        U.cmpVersion('เลขอะไรไม่รู้', '2.0.0') === 0);
  check('isNewer ใช้ผลเดียวกับ cmpVersion',
        U.isNewer('2.0.1', '2.0.0') === true && U.isNewer('2.0.0', '2.0.1') === false);
}

// ═══════════ เลือกรุ่น ═══════════
const REL = (tag, extra = {}) => ({ tag_name: tag, name: tag, body: 'note ' + tag,
  html_url: 'https://github.com/Nbcybg/Killian-Editor-V2/releases/tag/' + tag,
  assets: [], ...extra });
const ASSET = (name) => ({ name, size: 123,
  browser_download_url: U.UPDATE_ASSET_PREFIX + 'v2.0.0-alpha.140/' + name });
{
  const list = [REL('v2.0.0-alpha.130'), REL('v2.0.0-alpha.140'), REL('v2.0.0-alpha.99')];
  check('เลือกรุ่นใหม่ที่สุด ไม่ใช่ตัวแรกในรายการ',
        U.releaseVersion(U.pickRelease(list)) === '2.0.0-alpha.140');
  check('ข้ามฉบับร่าง',
        U.releaseVersion(U.pickRelease([...list, REL('v9.9.9', { draft: true })])) === '2.0.0-alpha.140');
  check('รับรุ่นทดลองเป็นค่าเริ่มต้น (ตัวโปรแกรมเองยังเป็น alpha)',
        U.releaseVersion(U.pickRelease([REL('v2.0.0-alpha.150', { prerelease: true })])) === '2.0.0-alpha.150');
  check('ปิดรุ่นทดลองได้',
        U.pickRelease([REL('v2.0.0-alpha.150', { prerelease: true })], { allowPrerelease: false }) === null);
  check('ข้ามแท็กที่อ่านเลขรุ่นไม่ออก',
        U.pickRelease([{ tag_name: 'nightly', name: 'nightly' }]) === null);
  check('ไม่มีรุ่นเลยคืน null', U.pickRelease([]) === null && U.pickRelease(null) === null);
  check('ใช้ชื่อรุ่นเมื่อแท็กอ่านไม่ออก',
        U.releaseVersion({ tag_name: 'release', name: '2.0.0-alpha.141' }) === '2.0.0-alpha.141');
}

// ═══════════ เลือกไฟล์แนบตามระบบ ═══════════
{
  const assets = [ASSET('Killian2-2.0.0-alpha.140-portable.exe'), ASSET('Killian2-mac.dmg'),
                  ASSET('Killian2-linux.AppImage'), ASSET('source.zip')];
  check('วินโดว์ได้ไฟล์พกพา .exe',
        U.pickAsset(assets, 'win32').name.endsWith('portable.exe'));
  check('แมคได้ .dmg', U.pickAsset(assets, 'darwin').name === 'Killian2-mac.dmg');
  check('ลินุกซ์ได้ .AppImage', U.pickAsset(assets, 'linux').name === 'Killian2-linux.AppImage');
  check('ไม่มีไฟล์ของระบบนี้คืน null', U.pickAsset([ASSET('Killian2-mac.dmg')], 'win32') === null);
  check('ไฟล์แนบที่ลิงก์มาจากที่อื่นถูกตัดทิ้งตั้งแต่ตอนเลือก',
        U.pickAsset([{ name: 'x.exe', browser_download_url: 'https://evil.example/x.exe' }], 'win32') === null);
  check('.exe ธรรมดาใช้ได้เมื่อไม่มีตัวที่ชื่อ portable',
        U.pickAsset([ASSET('Killian2.exe')], 'win32').name === 'Killian2.exe');
  check('platformKey แปลงชื่อระบบถูก',
        U.platformKey('win32') === 'win' && U.platformKey('darwin') === 'mac' &&
        U.platformKey('freebsd') === 'linux');
}

// ═══════════ ตัดสินใจ (หัวใจของระบบ) ═══════════
{
  const withAsset = REL('v2.0.0-alpha.140', { assets: [ASSET('Killian2-portable.exe')] });

  const up = U.decideUpdate({ current: '2.0.0-alpha.134', releases: [withAsset], platform: 'win32' });
  check('มีรุ่นใหม่ + มีไฟล์ = update', up.status === 'update', up.status);
  check('บอกเลขรุ่นทั้งสองฝั่ง', up.current === '2.0.0-alpha.134' && up.version === '2.0.0-alpha.140');
  check('ส่งลิงก์ไฟล์แนบที่ผ่านด่านแล้วออกไป', U.isAllowedAssetUrl(up.assetUrl));
  check('พก "สิ่งที่เปลี่ยน" มาด้วย', up.notes.includes('note'));

  const same = U.decideUpdate({ current: '2.0.0-alpha.140', releases: [withAsset] });
  check('รุ่นเท่ากัน = latest', same.status === 'latest', same.status);
  const older = U.decideUpdate({ current: '2.0.0-alpha.150', releases: [withAsset] });
  check('รุ่นในเครื่องใหม่กว่า = latest', older.status === 'latest', older.status);

  const skipped = U.decideUpdate({ current: '2.0.0-alpha.134', releases: [withAsset],
                                   skip: '2.0.0-alpha.140' });
  check('รุ่นที่ผู้ใช้กดข้ามไว้ = skipped', skipped.status === 'skipped', skipped.status);
  check('ข้ามรุ่นเก่าไม่บังรุ่นใหม่กว่า',
        U.decideUpdate({ current: '2.0.0-alpha.134', releases: [withAsset],
                         skip: '2.0.0-alpha.135' }).status === 'update');
  check('ข้ามด้วยแท็กที่มี v นำหน้าก็ถือว่ารุ่นเดียวกัน',
        U.decideUpdate({ current: '2.0.0-alpha.134', releases: [withAsset],
                         skip: 'v2.0.0-alpha.140' }).status === 'skipped');

  const noAsset = U.decideUpdate({ current: '2.0.0-alpha.134', releases: [REL('v2.0.0-alpha.140')],
                                   platform: 'win32' });
  check('มีรุ่นใหม่แต่ไม่มีไฟล์ = noAsset', noAsset.status === 'noAsset', noAsset.status);
  check('noAsset ยังบอกหน้ารุ่นให้เปิดเองได้', noAsset.url.includes('Nbcybg/Killian-Editor-V2'));

  const none = U.decideUpdate({ current: '2.0.0-alpha.134', releases: [] });
  check('ไม่มีรุ่นเผยแพร่เลย = none', none.status === 'none', none.status);
  check('none ชี้ไปหน้า releases ของรีโป', none.url === U.UPDATE_RELEASES_URL);

  const repoOnly = U.decideUpdate({ current: '2.0.0-alpha.134', releases: [],
                                    manifestVersion: '2.0.0-alpha.136' });
  check('ยังไม่มี Release แต่รีโปเดินไปไกลกว่า = repoOnly', repoOnly.status === 'repoOnly', repoOnly.status);
  check('repoOnly บอกเลขรุ่นจาก package.json', repoOnly.version === '2.0.0-alpha.136');
  check('package.json เก่ากว่า/เท่ากัน ไม่ปลุก repoOnly',
        U.decideUpdate({ current: '2.0.0-alpha.136', releases: [],
                         manifestVersion: '2.0.0-alpha.136' }).status === 'none');
  check('Release ที่ใหม่กว่าชนะ package.json',
        U.decideUpdate({ current: '2.0.0-alpha.134', releases: [withAsset],
                         manifestVersion: '2.0.0-alpha.999' }).status === 'update');
  check('เรียกเปล่า ๆ ไม่พัง', U.decideUpdate().status === 'none');

  check('เตือนเฉพาะตอนมีของให้ทำจริง',
        U.shouldNotify(up) === true && U.shouldNotify(noAsset) === true &&
        U.shouldNotify(same) === false && U.shouldNotify(skipped) === false &&
        U.shouldNotify(none) === false && U.shouldNotify(null) === false);
}

// ═══════════ แทนที่ไฟล์โปรแกรม ═══════════
{
  check('ชื่อไฟล์สำรองต่อท้ายด้วยนามสกุลของเราเอง',
        U.backupPath('C:\\K2\\Killian2.exe') === 'C:\\K2\\Killian2.exe' + U.OLD_SUFFIX);
  check('รู้จักซากไฟล์เก่า',
        U.isLeftover('Killian2.exe' + U.OLD_SUFFIX) === true && U.isLeftover('Killian2.exe') === false);
  check('ชื่อไฟล์แนบถูกล้างเส้นทางทิ้ง',
        U.safeAssetName('../../evil.exe') === 'evil.exe' &&
        U.safeAssetName('a/b/c/Killian2.exe') === 'Killian2.exe');
  check('ชื่อไฟล์ว่าง/อันตรายตกไปใช้ชื่อสำรอง',
        U.safeAssetName('') === 'killian2-update.bin' && U.safeAssetName('..') === 'killian2-update.bin');
  check('ชื่อไฟล์เก็บอักขระที่ปลอดภัยไว้ครบ',
        U.safeAssetName('Killian2-2.0.0-alpha.140-portable.exe') === 'Killian2-2.0.0-alpha.140-portable.exe');
  check('รู้จักหัวไฟล์ .exe (MZ)',
        U.looksLikeExe(Buffer.from([0x4d, 0x5a, 0x90])) === true &&
        U.looksLikeExe(Buffer.from([0x50, 0x4b])) === false && U.looksLikeExe(null) === false);
  check('ข้อความความคืบหน้าอ่านรู้เรื่อง',
        U.progressText(1048576, 10485760) === '1.0 / 10.0 MB' && U.progressText(1048576, 0) === '1.0 MB');
}

console.log(`update-check: PASS ${pass} FAIL ${fail}`);
if (fail) process.exit(1);
