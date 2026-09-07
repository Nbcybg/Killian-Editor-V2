// test/toolbar-config.test.cjs — [alpha.79] เอาปุ่มเข้า-ออกจากแถบเครื่องมือ
// จุดที่พังง่ายที่สุดคือ "เส้นคั่นลอย" ตอนซ่อนทั้งกลุ่ม → layoutToolbar คือหัวใจของเทสนี้
require('./_lang.cjs').installLang('th');
const path = require('path');
const out = path.join(require('os').tmpdir(), '_tbcfg.cjs');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/toolbar/toolbar-config.js')],
  outfile: out, format: 'cjs', bundle: true, logLevel: 'silent' });
const T = require(out);

let pass = 0, fail = 0;
const check = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', n, i ? ':: ' + i : ''); } };

// ═══════════ นิยามกลุ่ม ═══════════
{
  check('มีกลุ่มอย่างน้อย 8 กลุ่ม', T.TOOLBAR_GROUPS.length >= 8, T.TOOLBAR_GROUPS.length);
  const ids = T.allButtonIds();
  check('มีปุ่มอย่างน้อย 35 ปุ่ม', ids.length >= 35, ids.length);
  check('ไม่มี id ซ้ำข้ามกลุ่ม', new Set(ids).size === ids.length,
        ids.filter((x, i) => ids.indexOf(x) !== i).join(','));
  check('ทุกกลุ่มมีคีย์ภาษา', T.TOOLBAR_GROUPS.every((g) => /^ui\./.test(g.labelKey)));
  // คีย์ที่ถูกอ้างเป็น "ข้อมูล" (labelKey) ไม่ถูกกวาดโดย test/i18n-keys — ต้องตรวจที่นี่แทน
  // ไม่งั้นชื่อกลุ่มจะโผล่เป็น `ui.tbcfg.grpView` บนหน้าจอโดยไม่มีเทสไหนจับได้
  {
    const fs = require('fs');
    const path = require('path');
    const { lexCsv } = require('../tools/csv-lite.cjs');
    const dir = path.join(__dirname, '..', 'languages');
    for (const f of fs.readdirSync(dir).filter((x) => /^k2_.+\.csv$/.test(x))) {
      const tbl = lexCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
      const miss = T.TOOLBAR_GROUPS.map((g) => g.labelKey).filter((k) => !tbl[k]);
      check(`${f}: ชื่อกลุ่มมีคำแปลครบ`, miss.length === 0, miss.join(' · '));
    }
  }
  check('ทุก id ขึ้นต้นด้วย tb- หรือเป็น select ที่รู้จัก',
        ids.every((x) => /^tb-/.test(x)), ids.filter((x) => !/^tb-/.test(x)).join(','));
  check('ปุ่มที่โปรแกรมคุมเอง ตั้งค่าไม่ได้',
        T.LOCKED_BUTTONS.every((x) => T.isConfigurable(x) === false));
  check('ปุ่มที่โปรแกรมคุมเอง ไม่อยู่ในรายการกลุ่ม',
        T.LOCKED_BUTTONS.every((x) => !ids.includes(x)));
  check('ปุ่มที่ไม่รู้จัก = ตั้งค่าไม่ได้', T.isConfigurable('tb-ไม่มีจริง') === false);
  check('groupOf บอกกลุ่มถูก', T.groupOf('tb-bold') === 'style' && T.groupOf('tb-ai') === 'ai');
  check('groupOf ปุ่มที่ไม่รู้จัก = ว่าง', T.groupOf('zzz') === '');
  check('แผงบทพูดกับแผงปลั๊กอินอยู่ในรายการแล้ว',
        ids.includes('tb-dialogue') && ids.includes('tb-plugins'));
}

// ═══════════ normalize / เปิด-ปิด ═══════════
{
  const empty = T.normalizeToolbar(null);
  check('ค่าเริ่มต้น = ไม่ซ่อนอะไรเลย', Object.keys(empty.hidden).length === 0);
  check('ค่าเริ่มต้น: ทุกปุ่มมองเห็น', T.allButtonIds().every((id) => T.isButtonVisible(null, id)));

  let cfg = T.setButtonVisible(null, 'tb-ai', false);
  check('ปิดปุ่มได้', T.isButtonVisible(cfg, 'tb-ai') === false);
  check('ปิดตัวหนึ่งไม่กระทบตัวอื่น', T.isButtonVisible(cfg, 'tb-bold') === true);
  cfg = T.setButtonVisible(cfg, 'tb-ai', true);
  check('เปิดกลับได้', T.isButtonVisible(cfg, 'tb-ai') === true);
  check('เปิดกลับแล้วไม่เหลือขยะใน hidden', !cfg.hidden['tb-ai']);

  check('ปุ่มที่โปรแกรมคุมเอง สั่งปิดไม่ได้',
        T.isButtonVisible(T.setButtonVisible(null, 'tb-mode', false), 'tb-mode') === true);
  check('setButtonVisible ไม่แก้ของเดิม', (() => {
    const a = { hidden: {} };
    T.setButtonVisible(a, 'tb-ai', false);
    return Object.keys(a.hidden).length === 0;
  })());
  check('คีย์ที่ไม่รู้จักในไฟล์ตั้งค่า ถูกทิ้ง',
        !T.normalizeToolbar({ hidden: { 'tb-ผี': true } }).hidden['tb-ผี']);
  check('ค่าที่ไม่ใช่ object ก็ไม่พัง',
        Object.keys(T.normalizeToolbar('ข้อความมั่ว').hidden).length === 0
        && Object.keys(T.normalizeToolbar(42).hidden).length === 0);

  const g = T.setGroupVisible(null, 'ai', false);
  check('ปิดทั้งกลุ่ม',
        (T.TOOLBAR_GROUPS.find((x) => x.key === 'ai') || { buttons: [] }).buttons
          .filter((b) => T.isConfigurable(b.id))
          .every((b) => !T.isButtonVisible(g, b.id)));
  check('ปิดกลุ่มหนึ่ง ไม่กระทบกลุ่มอื่น', T.isButtonVisible(g, 'tb-bold'));
  check('เปิดทั้งกลุ่มกลับ',
        ['tb-ai', 'tb-ai-chat'].every((id) => T.isButtonVisible(T.setGroupVisible(g, 'ai', true), id)));
  check('กลุ่มที่ไม่รู้จัก ไม่พัง', T.setGroupVisible(null, 'ไม่มี', false).hidden !== undefined);

  const c2 = T.toolbarCounts(g);
  // [alpha.94] เดิมฮาร์ดโค้ด "- 3" ตามจำนวนปุ่มในกลุ่ม ai ตอนนั้น → เพิ่มปุ่มเข้ากลุ่มไหนก็แดง
  // นับจากทะเบียนจริงแทน (บทเรียนข้อ 13: เทสที่พึ่งค่าคงที่พังทุกครั้งที่ฟีเจอร์โต)
  const aiGroupSize = (T.TOOLBAR_GROUPS.find((x) => x.key === 'ai') || { buttons: [] })
    .buttons.filter((b) => T.isConfigurable(b.id)).length;
  check('นับปุ่มที่เปิดอยู่ถูก',
        c2.total === T.allButtonIds().length && c2.on === c2.total - aiGroupSize,
        JSON.stringify(c2) + ' aiGroupSize=' + aiGroupSize);
  check('รีเซ็ตแล้วกลับมาเปิดหมด',
        T.toolbarCounts(T.resetToolbarConfig()).on === T.allButtonIds().length);
}

// ═══════════ layoutToolbar — เส้นคั่น ═══════════
{
  const L = T.layoutToolbar;
  const all = () => true;
  const none = () => false;

  check('ทุกปุ่มเปิด: เส้นคั่นกลางแสดง',
        JSON.stringify(L(['a', 'sep', 'b'], all)) === JSON.stringify([true, true, true]));
  check('เส้นคั่นหน้าสุดไม่แสดง',
        JSON.stringify(L(['sep', 'a'], all)) === JSON.stringify([false, true]));
  check('เส้นคั่นท้ายสุดไม่แสดง',
        JSON.stringify(L(['a', 'sep'], all)) === JSON.stringify([true, false]));
  check('ปิดหมด = ไม่เหลืออะไรเลย',
        L(['a', 'sep', 'b', 'sep', 'c'], none).every((x) => x === false));

  // ซ่อนทั้งกลุ่มกลาง → ต้องเหลือเส้นคั่นเดียว ไม่ใช่สองอันติดกัน
  const seq = ['a', 'sep', 'b1', 'b2', 'sep', 'c'];
  const hideB = (id) => !/^b/.test(id);
  const r = L(seq, hideB);
  check('ซ่อนกลุ่มกลาง: เหลือเส้นคั่นอันเดียว',
        r.filter((x, i) => seq[i] === 'sep' && x).length === 1, JSON.stringify(r));
  check('ซ่อนกลุ่มกลาง: ปุ่มหัว-ท้ายยังอยู่', r[0] === true && r[5] === true);
  check('ซ่อนกลุ่มกลาง: เส้นคั่นที่แสดงคืออันที่สอง (อยู่ระหว่าง a กับ c)',
        r[1] === false && r[4] === true, JSON.stringify(r));

  // ซ่อนปุ่มแรกทั้งหมด → เส้นคั่นแรกต้องหาย
  const r2 = L(['a', 'sep', 'b', 'sep', 'c'], (id) => id !== 'a');
  check('ซ่อนปุ่มแรก: เส้นคั่นแรกหาย', r2[1] === false && r2[3] === true, JSON.stringify(r2));

  // เส้นคั่นสองอันติดกันในซอร์ส
  const r3 = L(['a', 'sep', 'sep', 'b'], all);
  check('เส้นคั่นสองอันติดกัน → แสดงอันเดียว',
        r3[1] === false && r3[2] === true, JSON.stringify(r3));

  check('รายการว่างไม่พัง', L([], all).length === 0 && L(null, all).length === 0);
  check('ไม่มีเส้นคั่นเลยก็ได้',
        JSON.stringify(L(['a', 'b'], all)) === JSON.stringify([true, true]));
}

// ═══════════ [alpha.111] แถบรูปแบบลอย: ตั้งค่าแยกนิยาย / บทภาพยนตร์ ═══════════
{
  const ids = T.FMTBAR_IDS;
  check('รายการปุ่มบนแถบลอยมีอย่างน้อย 20 ตัว', ids.length >= 20, ids.length);
  check('ไม่มี id ซ้ำในรายการแถบลอย', new Set(ids).size === ids.length);
  check('ทุกตัวบนแถบลอยรู้จักในระบบตั้งค่า (ไม่มีตัวหลงมา)',
        ids.every((x) => T.isConfigurable(x) || T.LOCKED_BUTTONS.includes(x)),
        ids.filter((x) => !T.isConfigurable(x) && !T.LOCKED_BUTTONS.includes(x)).join(','));
  check('isFmtbarButton แยกได้ว่าปุ่มไหนอยู่แถบไหน',
        T.isFmtbarButton('tb-bold') === true && T.isFmtbarButton('tb-kanban') === false);

  // ★★ [alpha.139] ประตูกันพลาด: `FMTBAR_IDS` ต้องตรงกับรายการจริงใน `setupFloatingFormatBar()`
  // (คอมเมนต์บอกไว้ว่า "ต้องตรงกัน" มาตั้งแต่ .111 แต่ไม่เคยมีใครตรวจ — ย้ายปุ่มเข้า/ออกทีไร
  //  ก็มีโอกาสหลุดข้างเดียว แล้วปุ่มนั้นกลายเป็นปุ่มที่ตั้งค่าไม่ได้/ซ่อนไม่ได้เงียบ ๆ)
  {
    const src = require('fs').readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    const i0 = src.indexOf("['#tb-sp-elem'");
    const i1 = src.indexOf('].forEach((sel)', i0);
    check('หาอ่านรายการปุ่มใน setupFloatingFormatBar() ได้', i0 > 0 && i1 > i0);
    const moved = [...src.slice(i0, i1).matchAll(/'#([\w-]+)'/g)].map((m) => m[1]);
    check('★ ลำดับปุ่มบนแถบลอยตรงกับ FMTBAR_IDS เป๊ะ',
          moved.join(',') === ids.join(','),
          'app.js[' + moved.join(',') + '] cfg[' + ids.join(',') + ']');
    check('★ ปุ่มส่วนเสริมท้ายชื่อตัวละครอยู่บนแถบลอย (ไม่ใช่แถบเครื่องมือ) — alpha.139',
          moved.includes('tb-sp-ext'));
  }

  // ★ กติกาข้อสำคัญที่สุด: ปุ่มเดียวห้ามมีสวิตช์สองที่
  const main = T.mainbarGroups().flatMap((g) => g.buttons.map((b) => b.id));
  const fmt = T.fmtbarGroups().flatMap((g) => g.buttons.map((b) => b.id));
  check('★ ไม่มีปุ่มไหนโผล่ทั้งหน้าแถบเครื่องมือและหน้าแถบรูปแบบ',
        main.every((x) => !fmt.includes(x)), main.filter((x) => fmt.includes(x)).join(','));
  check('รวมสองหน้าแล้วยังครบทุกปุ่มที่ตั้งค่าได้',
        T.allButtonIds().filter((x) => T.isConfigurable(x)).length === main.length + fmt.length,
        `${main.length}+${fmt.length}`);
  check('หน้าแถบเครื่องมือไม่เหลือกลุ่มว่าง', T.mainbarGroups().every((g) => g.buttons.length > 0));
  check('นับปุ่มของแถบหลักไม่รวมปุ่มบนแถบลอย',
        T.mainbarCounts(null).total === main.length, T.mainbarCounts(null).total);

  check('โหมดมีสองโหมด', T.FMT_MODES.join(',') === 'prose,screenplay');
  check('โหมดที่ไม่รู้จักตกเป็นนิยาย',
        T.fmtMode('wiki') === 'prose' && T.fmtMode(undefined) === 'prose'
        && T.fmtMode('screenplay') === 'screenplay');

  // ── ปุ่มที่โหมดนั้นใช้ไม่ได้ ──
  check('บทภาพยนตร์: ช่องหัวข้อ/ยกคำพูด/ตัวยก/ตัวห้อย ใช้ไม่ได้',
        ['tb-style', 'tb-quote', 'tb-sup', 'tb-sub'].every((x) => !T.fmtSupported('screenplay', x)));
  check('★ หัวข้อย่อย/ตัวเลข ใช้ได้ในบท (คำนำหน้าในข้อความ ตั้งแต่ alpha.98)',
        T.fmtSupported('screenplay', 'tb-ul') && T.fmtSupported('screenplay', 'tb-ol'));
  check('นิยาย: ตัวหนา/ยกคำพูด/หัวข้อ ใช้ได้หมด',
        ['tb-bold', 'tb-quote', 'tb-style', 'tb-sup'].every((x) => T.fmtSupported('prose', x)));
  check('นิยาย: ปุ่มเฉพาะบทใช้ไม่ได้', !T.fmtSupported('prose', 'tb-sp-cont'));
  check('ทุกตัวใน FMT_UNSUPPORTED มีอยู่จริงบนแถบลอย',
        Object.values(T.FMT_UNSUPPORTED).flat().every((x) => T.FMTBAR_IDS.includes(x)),
        Object.values(T.FMT_UNSUPPORTED).flat().filter((x) => !T.FMTBAR_IDS.includes(x)).join(','));

  // ── เปิด/ปิดทีละตัว แยกโหมดจริงไหม ──
  {
    let c = T.setFmtbarVisible(null, 'screenplay', 'tb-bold', false);
    check('★ ซ่อนในบท ไม่กระทบนิยาย',
          T.fmtbarHidden(c, 'screenplay', 'tb-bold') === true
          && T.fmtbarHidden(c, 'prose', 'tb-bold') === false);
    c = T.setFmtbarVisible(c, 'screenplay', 'tb-bold', true);
    check('เปิดกลับได้', T.fmtbarHidden(c, 'screenplay', 'tb-bold') === false);
    check('ปุ่มที่โปรแกรมคุมเอง ซ่อนไม่ได้',
          T.fmtbarHidden(T.setFmtbarVisible(null, 'prose', 'tb-mode', false), 'prose', 'tb-mode') === false);
    check('ปุ่มที่ไม่ได้อยู่บนแถบลอย ไม่ถูกนับว่าซ่อน',
          T.fmtbarHidden(null, 'prose', 'tb-kanban') === false);
  }
  {
    const c = T.setFmtbarGroupVisible(null, 'prose', 'align', false);
    check('ปิดทั้งกลุ่มได้',
          ['tb-align-left', 'tb-align-center', 'tb-align-right', 'tb-align-justify']
            .every((x) => T.fmtbarHidden(c, 'prose', x)));
    check('ปิดกลุ่มในนิยาย ไม่กระทบบท', !T.fmtbarHidden(c, 'screenplay', 'tb-align-left'));
    const c2 = T.setFmtbarGroupVisibleAll(c, 'prose');
    check('แสดงทุกปุ่มของโหมดเดียวได้', !T.fmtbarHidden(c2, 'prose', 'tb-align-left'));
    const c3 = T.setFmtbarGroupVisible(c, 'prose', 'ไม่มีกลุ่มนี้', false);
    check('กลุ่มที่ไม่มีจริงไม่พัง', !!c3.prose && !!c3.screenplay);
  }
  check('นับจำนวนที่เปิดอยู่ถูก',
        T.fmtbarCounts(T.setFmtbarVisible(null, 'prose', 'tb-bold', false), 'prose').on
          === T.fmtbarCounts(null, 'prose').on - 1);
  check('รีเซ็ตแล้วเปิดหมดทั้งสองโหมด', (() => {
    const r = T.resetFmtbarConfig();
    return T.FMT_MODES.every((m) => Object.keys(r[m].hidden).length === 0);
  })());

  // ── สืบทอดค่าเก่าจาก settings.toolbar ──
  {
    const legacy = { hidden: { 'tb-bold': true, 'tb-kanban': true } };
    const c = T.normalizeFmtbar(null, legacy);
    check('★ ยังไม่เคยตั้งค่าแถบลอย → สืบทอดตัวที่เคยซ่อนไว้มาทั้งสองโหมด',
          c.prose.hidden['tb-bold'] === true && c.screenplay.hidden['tb-bold'] === true);
    check('ตัวที่ไม่ได้อยู่บนแถบลอย ไม่ถูกสืบทอดมา', !c.prose.hidden['tb-kanban']);
    const c2 = T.normalizeFmtbar({ prose: { hidden: {} }, screenplay: { hidden: {} } }, legacy);
    check('ตั้งค่าเองแล้ว = ไม่สืบทอดทับอีก', !c2.prose.hidden['tb-bold']);
  }
  check('ค่าขยะไม่พัง', (() => {
    const c = T.normalizeFmtbar({ prose: { hidden: { 'ไม่มีปุ่มนี้': true } } });
    return Object.keys(c.prose.hidden).length === 0 && !!c.screenplay;
  })());

  // ── แผนการแสดงผลทั้งแถบ ──
  {
    const seq = [null, 'tb-bold', 'sep', 'tb-style', 'tb-quote'];   // null = ที่จับลากของแถบ
    const r = T.layoutFmtbar(seq, null, 'screenplay');
    check('layoutFmtbar คืนสองชุดยาวเท่าลำดับที่ส่งไป',
          r.show.length === seq.length && r.grey.length === seq.length);
    check('ปุ่มที่ใช้ไม่ได้ในบท ถูกทำเครื่องหมายเทา (แต่ยังแสดง)',
          r.grey[3] === true && r.grey[4] === true && r.show[3] === true && r.show[4] === true);
    check('ปุ่มที่ใช้ได้ ไม่โดนเทา', r.grey[1] === false);
    check('ที่จับลากของแถบไม่เคยโดนเทา/ซ่อน', r.grey[0] === false && r.show[0] === true);
    const r2 = T.layoutFmtbar(seq, null, 'prose');
    check('โหมดนิยาย ไม่มีปุ่มไหนเทาในชุดนี้', r2.grey.every((x) => x === false));
    const r3 = T.layoutFmtbar(T.FMTBAR_IDS.map((x) => x), T.setFmtbarVisible(null, 'prose', 'tb-bold', false), 'prose');
    check('ปุ่มที่ซ่อนไว้ไม่แสดง', r3.show[T.FMTBAR_IDS.indexOf('tb-bold')] === false);
    check('ลำดับว่างไม่พัง', T.layoutFmtbar(null, null, 'prose').show.length === 0);
  }
}

console.log(`\ntoolbar-config: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
