// test/plugin-core.test.cjs — [alpha.79] ระบบปลั๊กอิน (แผงจัดการ)
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_plugcore.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/plugins/plugin-core.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const P = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ versionAtLeast ═══════════
{
  check('เท่ากัน = ผ่าน', P.versionAtLeast('2.0.0', '2.0.0') === true);
  check('ใหม่กว่า = ผ่าน', P.versionAtLeast('2.1.0', '2.0.9') === true);
  check('เก่ากว่า = ไม่ผ่าน', P.versionAtLeast('1.9.9', '2.0.0') === false);
  check('ตัดส่วน -alpha ทิ้ง', P.versionAtLeast('2.0.0-alpha.79', '2.0.0') === true);
  check('จำนวนหลักไม่เท่ากัน', P.versionAtLeast('2.1', '2.1.0') === true
        && P.versionAtLeast('2.0', '2.0.1') === false);
  check('ค่าว่าง/ไม่ใช่เวอร์ชัน ไม่พัง',
        P.versionAtLeast('', '') === true && P.versionAtLeast(null, undefined) === true);
}

// ═══════════ parseManifest ═══════════
{
  const m = P.parseManifest({ name: 'ตัวนับคำ', version: '1.2.3', author: 'ท็อป',
                              description: 'นับคำ', minAppVersion: '2.0.0' }, 'wordcount');
  check('อ่านครบทุกช่อง',
        m.name === 'ตัวนับคำ' && m.version === '1.2.3' && m.author === 'ท็อป' && m.ok, JSON.stringify(m));
  check('entry ค่าเริ่มต้น = main.js', m.entry === 'main.js');
  check('จำโฟลเดอร์ไว้ด้วย', m.folder === 'wordcount');

  check('ไม่มีชื่อ → ใช้ชื่อโฟลเดอร์', P.parseManifest({}, 'myplug').name === 'myplug');
  check('ไม่มีทั้งชื่อและโฟลเดอร์ → ไม่ผ่าน', (() => {
    const x = P.parseManifest({}, '');
    return x.ok === false && x.reason === 'ui.plug.errNoName';
  })());
  check('ไฟล์เสีย/ไม่ใช่ object ไม่พัง',
        P.parseManifest(null, 'f').name === 'f' && P.parseManifest('ขยะ', 'f').ok === true);
  check('entry ที่ชี้ออกนอกโฟลเดอร์ = ไม่ผ่าน', (() => {
    const x = P.parseManifest({ entry: '../../main.js' }, 'f');
    return x.ok === false && x.reason === 'ui.plug.errBadEntry';
  })());
  check('entry แบบ absolute = ไม่ผ่าน', P.parseManifest({ entry: '/etc/passwd' }, 'f').ok === false);
  check('entry ในโฟลเดอร์ย่อยใช้ได้', P.parseManifest({ entry: 'lib/main.js' }, 'f').ok === true);
  check('ตัดช่องว่างหัวท้าย', P.parseManifest({ name: '  ชื่อ  ' }, 'f').name === 'ชื่อ');
}

// ═══════════ สถานะ ═══════════
{
  check('ปกติ = ok', P.pluginStatus({}, { appVersion: '2.0.0' }) === P.ST_OK);
  check('ผู้ใช้ปิด = off', P.pluginStatus({}, { disabled: true }) === P.ST_OFF);
  check('โหลดพัง = err', P.pluginStatus({}, { failed: true }) === P.ST_ERR);
  check('ต้องใช้รุ่นใหม่กว่า = old',
        P.pluginStatus({ minAppVersion: '9.0.0' }, { appVersion: '2.0.0' }) === P.ST_OLD);
  check('รุ่นไม่พอ ชนะทุกสถานะอื่น (บอกสาเหตุจริง)',
        P.pluginStatus({ minAppVersion: '9.0.0' }, { appVersion: '2.0.0', disabled: true }) === P.ST_OLD);
}

// ═══════════ mergePluginList ═══════════
{
  const loaded = [
    { name: 'ก', origin: P.ORIGIN_USER, version: '1.0.0' },
    { name: 'ข', origin: P.ORIGIN_PROJECT },
  ];
  const failed = [{ name: 'ค', origin: P.ORIGIN_USER, error: 'พังตอนโหลด' }];
  const list = P.mergePluginList(loaded, failed, { appVersion: '2.0.0' });
  check('รวมทั้งที่สำเร็จและล้มเหลว', list.length === 3, list.length);
  check('ตัวที่พังขึ้นก่อน (ผู้ใช้ต้องเห็นปัญหาก่อน)', list[0].name === 'ค' && list[0].status === P.ST_ERR);
  check('เก็บข้อความ error ไว้', list[0].error === 'พังตอนโหลด');

  const off = P.mergePluginList(loaded, [], { appVersion: '2.0.0', disabled: (n) => n === 'ก' });
  check('อ่านสถานะปิดจาก callback', off.find((x) => x.name === 'ก').status === P.ST_OFF);
  check('ตัวที่ปิดไว้ไปอยู่ท้ายสุด', off[off.length - 1].name === 'ก', JSON.stringify(off.map((x) => x.name)));

  // ชื่อซ้ำ: ของโปรเจกต์ชนะ
  const dup = P.mergePluginList([
    { name: 'ซ้ำ', origin: P.ORIGIN_USER, version: '1.0.0' },
    { name: 'ซ้ำ', origin: P.ORIGIN_PROJECT, version: '2.0.0' },
  ], [], { appVersion: '2.0.0' });
  check('ชื่อซ้ำเหลือตัวเดียว', dup.length === 1);
  check('ของโปรเจกต์ชนะ', dup[0].origin === P.ORIGIN_PROJECT && dup[0].version === '2.0.0');
  check('ติดธงว่ามีตัวถูกบัง', dup[0].shadowed === true);

  // "ผู้ใช้ปิดเอง" กับ "โหลดแล้วพัง" ลงกอง failed เหมือนกัน แต่ต้องแสดงคนละสถานะ
  {
    const skipped = P.mergePluginList([], [{ name: 'ปิดไว้', origin: P.ORIGIN_USER,
                                             skipped: true, error: 'ปิดไว้' }],
                                      { appVersion: '2.0.0', disabled: (n) => n === 'ปิดไว้' });
    check('ถูกข้ามเพราะผู้ใช้ปิดเอง → สถานะ "ปิดอยู่" ไม่ใช่ "มีปัญหา"',
          skipped[0].status === P.ST_OFF, skipped[0].status);
    const crashed = P.mergePluginList([], [{ name: 'พัง', origin: P.ORIGIN_USER, error: 'boom' }],
                                      { appVersion: '2.0.0', disabled: () => true });
    check('พังจริง (ถูกปิดอัตโนมัติ) → ยังขึ้น "มีปัญหา" พร้อมข้อความ',
          crashed[0].status === P.ST_ERR && crashed[0].error === 'boom', crashed[0].status);
  }

  check('รายการว่างไม่พัง', P.mergePluginList().length === 0
        && P.mergePluginList(null, null, {}).length === 0);
  check('รายการที่ไม่มีชื่อถูกข้าม', P.mergePluginList([{ version: '1' }], []).length === 0);

  const c = P.pluginCounts(off);
  check('นับตามสถานะ', c.total === 2 && c.off === 1 && c.ok === 1, JSON.stringify(c));
  check('นับรายการว่าง', P.pluginCounts(null).total === 0);
}

// ═══════════ ชื่อโฟลเดอร์ปลอดภัย ═══════════
{
  check('ตัดอักขระต้องห้ามของ Windows',
        !/[<>:"/\\|?*]/.test(P.safePluginFolder('a<b>c:d/e\\f|g?h*i')));
  check('ช่องว่าง → ขีด', P.safePluginFolder('ปลั๊กอิน ของ ฉัน') === 'ปลั๊กอิน-ของ-ฉัน');
  check('จุดนำหน้าถูกตัด (กันโฟลเดอร์ซ่อน/..)', !P.safePluginFolder('../ออก').startsWith('.'));
  check('ว่าง → ชื่อสำรอง', P.safePluginFolder('') === 'plugin' && P.safePluginFolder(null) === 'plugin');
  check('ยาวเกินถูกตัด', P.safePluginFolder('ก'.repeat(200)).length <= 60);
}

// ═══════════ ปลั๊กอินตัวอย่าง ═══════════
{
  const files = P.samplePluginFiles('ตัวอย่าง', '2.0.0-alpha.79');
  check('มี 2 ไฟล์', Object.keys(files).length === 2 && files['plugin.json'] && files['main.js']);
  const mf = JSON.parse(files['plugin.json']);
  check('manifest อ่านกลับเป็น JSON ได้', mf.name === 'ตัวอย่าง' && mf.entry === 'main.js');
  check('ใส่ minAppVersion เป็นรุ่นปัจจุบัน', mf.minAppVersion === '2.0.0-alpha.79');
  check('manifest ที่สร้างเอง ผ่าน parseManifest', P.parseManifest(mf, 'ตัวอย่าง').ok === true);
  check('โค้ดตัวอย่างเรียก API จริง',
        /k2\.registerCommand/.test(files['main.js']) && /k2\.registerPanel/.test(files['main.js']));
  // ต้องรันได้จริงในรูปแบบเดียวกับที่ loadPlugins ใช้ (new Function('k2', code))
  check('โค้ดตัวอย่างรันผ่าน new Function ได้', (() => {
    const calls = [];
    const k2 = { registerCommand: (l) => calls.push('cmd:' + l),
                 registerPanel: (id) => calls.push('panel:' + id),
                 setStatus: () => {}, getMarkdown: () => '' };
    try { new Function('k2', files['main.js'])(k2); } catch (e) { return false; }
    return calls.length === 2 && calls[1] === 'panel:hello';
  })());
}

// ═══════════ เอกสาร API ═══════════
{
  check('มีรายการ API อย่างน้อย 12 หัวข้อ', P.PLUGIN_API_DOC.length >= 12);
  check('ทุกหัวข้อมีลายเซ็นและคีย์ภาษา',
        P.PLUGIN_API_DOC.every((d) => d.sig && /^ui\.plug\./.test(d.key)));
  // คีย์ที่ถูกอ้างเป็นข้อมูล (ไม่ได้เขียน t('…') ตรง ๆ) หลุดจาก test/i18n-keys — ตรวจที่นี่
  {
    const fs = require('fs');
    const dir = path.join(__dirname, '..', 'languages');
    const { lexCsv } = require('../tools/csv-lite.cjs');
    const extra = ['ui.plug.errNoName', 'ui.plug.errBadEntry'];   // reason ของ parseManifest
    for (const f of fs.readdirSync(dir).filter((x) => /^k2_.+\.csv$/.test(x))) {
      const tbl = lexCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
      const miss = P.PLUGIN_API_DOC.map((d) => d.key).concat(extra).filter((k) => !tbl[k]);
      check(`${f}: คำอธิบาย API มีคำแปลครบ`, miss.length === 0, miss.join(' · '));
    }
  }
}

// ═══════════ [alpha.148] ปลั๊กอินของโปรเจกต์ต้องได้รับอนุญาตก่อนรัน ═══════════
{
  const a = [{ folder: 'demo', manifest: '{"name":"x"}', code: 'k2.registerCommand("a")' }];
  const fp = P.pluginFingerprint(a);
  check('ลายนิ้วมือไม่ว่างเมื่อมีปลั๊กอิน', !!fp && /^1:/.test(fp), fp);
  check('ไม่มีปลั๊กอิน = ลายนิ้วมือว่าง', P.pluginFingerprint([]) === '' && P.pluginFingerprint(null) === '');
  check('ลำดับโฟลเดอร์ไม่มีผล', P.pluginFingerprint([a[0], { folder: 'b', manifest: '', code: 'x' }])
        === P.pluginFingerprint([{ folder: 'b', manifest: '', code: 'x' }, a[0]]));
  check('★ แก้โค้ดแม้ตัวเดียว = ลายนิ้วมือเปลี่ยน',
        P.pluginFingerprint([{ ...a[0], code: a[0].code + ';fetch("evil")' }]) !== fp);
  check('★ เพิ่มปลั๊กอินตัวใหม่ = ลายนิ้วมือเปลี่ยน',
        P.pluginFingerprint([...a, { folder: 'new', manifest: '{}', code: '' }]) !== fp);
  check('แก้ manifest = ลายนิ้วมือเปลี่ยน', P.pluginFingerprint([{ ...a[0], manifest: '{"name":"y"}' }]) !== fp);
  check('hashText คงที่และยาว 8 หลัก', P.hashText('ทดสอบ') === P.hashText('ทดสอบ') && P.hashText('ทดสอบ').length === 8);

  const trust = { '/p/novel': fp };
  check('อนุญาตแล้ว = ผ่าน', P.isPluginSetTrusted(trust, '/p/novel', fp) === true);
  check('★ ยังไม่เคยอนุญาต = ไม่ผ่าน', P.isPluginSetTrusted({}, '/p/novel', fp) === false);
  check('★ อนุญาตโปรเจกต์อื่น ไม่นับ', P.isPluginSetTrusted(trust, '/p/other', fp) === false);
  check('★ อนุญาตไว้แต่ชุดปลั๊กอินเปลี่ยน = ถามใหม่', P.isPluginSetTrusted(trust, '/p/novel', fp + 'x') === false);
  check('ไม่มีปลั๊กอิน = ไม่ต้องถาม', P.isPluginSetTrusted(null, '/p/novel', '') === true);

  const list = P.mergePluginList(
    [{ name: 'ok1', origin: P.ORIGIN_USER }],
    [{ name: 'proj', origin: P.ORIGIN_PROJECT, untrusted: true, error: 'x' }]);
  const proj = list.find((p) => p.name === 'proj');
  check('รายการที่ยังไม่อนุญาตได้สถานะ untrusted ไม่ใช่ "พัง"',
        proj && proj.status === P.ST_UNTRUSTED && proj.failed === false, JSON.stringify(proj));
  check('รออนุญาตขึ้นก่อนเพื่อนในแผง', list[0].name === 'proj', list.map((p) => p.name).join(','));
  const cnt = P.pluginCounts(list);
  check('นับรออนุญาตแยก ไม่ปนกับทำงานอยู่', cnt.untrusted === 1 && cnt.ok === 1 && cnt.err === 0, JSON.stringify(cnt));
}

console.log(`\nplugin-core: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
