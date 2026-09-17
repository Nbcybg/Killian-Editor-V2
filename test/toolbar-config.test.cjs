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

  // ★★ [alpha.150] ประตูกันพลาดเดิม (.139) คือ "รายการที่เขียนมือใน app.js ต้องตรงกับ FMTBAR_IDS"
  // — ตอนนี้ **ไม่มีรายการที่เขียนมือแล้ว**: `setupFloatingFormatBar()` วนจาก `fmtbarSequence()`
  // ซึ่งสร้างจาก `FMTBAR_GROUPS` ก้อนเดียวกับที่หน้าตั้งค่าใช้ · เทสจึงเปลี่ยนไปตรวจสิ่งที่ยัง
  // ผิดพลาดได้จริง: app.js ต้องเดินผ่านแหล่งเดียวนั้น และลำดับ/เส้นคั่นที่ได้ต้องถูกต้อง
  {
    const src = require('fs').readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    check('★ setupFloatingFormatBar() ประกอบแถบจาก fmtbarSequence() (ไม่มีรายการเขียนมือคู่ขนาน)',
          /for \(const id of fmtbarSequence\(\)\)/.test(src));
    check('★ ไม่มีรายการปุ่มเขียนมือหลงเหลือใน app.js', src.indexOf("['#tb-sp-elem'") < 0);
    const seq = T.fmtbarSequence();
    check('★ ลำดับปุ่มในแถบ (ตัดเส้นคั่น) ตรงกับ FMTBAR_IDS เป๊ะ',
          seq.filter((x) => x !== 'sep').join(',') === ids.join(','), seq.join(','));
    check('★ มีเส้นคั่นหนึ่งเส้นต่อรอยต่อหมวด',
          seq.filter((x) => x === 'sep').length === T.FMTBAR_GROUPS.length - 1);
    check('★ ไม่มีเส้นคั่นสองเส้นติดกัน และไม่มีเส้นคั่นหัว/ท้าย',
          seq[0] !== 'sep' && seq[seq.length - 1] !== 'sep'
          && !seq.some((x, i) => x === 'sep' && seq[i + 1] === 'sep'));
    check('★ ปุ่มส่วนเสริมท้ายชื่อตัวละครอยู่บนแถบลอย (ไม่ใช่แถบเครื่องมือ) — alpha.139',
          ids.includes('tb-sp-ext'));
    // [alpha.150 ข้อ 1] หมวดที่ผู้ใช้สั่งมาต้องอยู่ครบและเรียงตามที่สั่ง
    check('★ หมวดของแถบลอยเรียงตามที่ผู้ใช้สั่ง',
          T.FMTBAR_GROUPS.map((g) => g.key).join(',')
            === 'history,doc,block,font,color,list,align,insert,view,find',
          T.FMTBAR_GROUPS.map((g) => g.key).join(','));
    check('★ undo/redo เป็นหมวดแรกสุด', ids[0] === 'tb-undo' && ids[1] === 'tb-redo');
    check('★ ค้นในเอกสาร/ค้นทั้งผลงาน เป็นหมวดสุดท้าย',
          ids.slice(-2).join(',') === 'tb-find,tb-gsearch', ids.slice(-2).join(','));
  }

  // ── [alpha.150 ข้อ 1] ปุ่มจัดแนวตั้ง = ของกระดานวางแผนเท่านั้น ──
  {
    // [alpha.151 ข้อ 1+3] ปุ่มจัดแนวตั้งย้ายไปอยู่บนแถบของกระดานแล้ว — ไม่อยู่บนแถบตัวแก้ไขอีก
    check('★★ [151-3] ปุ่มจัดแนวตั้งไม่อยู่บนแถบของตัวแก้ไขแล้ว',
          !T.FMTBAR_IDS.includes('tb-valign-top') && !T.allButtonIds().includes('tb-valign-top'));
    check('★★ [151-3] ย้ายไปอยู่บนแถบของกระดานครบสามตัว',
          ['pb-valign-top', 'pb-valign-middle', 'pb-valign-bottom']
            .every((x) => T.PLANNER_BAR_IDS.includes(x)));
    // [alpha.151 ข้อ 6] ปุ่มที่โหมดนี้ใช้ไม่ได้ **ไม่โผล่เลย** — ไม่ใช่โผล่แบบสีเทา
    const seq2 = ['tb-bold', 'tb-sp-cont'];
    const onProse = T.layoutFmtbar(seq2, null, 'prose');
    check('★★ [151-6] ปุ่มที่โหมดนี้ใช้ไม่ได้ ไม่โผล่เลย', onProse.show[1] === false);
    check('★ ปุ่มที่ใช้ได้ยังโผล่ตามปกติ', onProse.show[0] === true);
    const forced = T.layoutFmtbar(seq2, T.setFmtbarForceShown(null, 'prose', 'tb-sp-cont', true), 'prose');
    check('★★ [151-6] ผู้ใช้ติ๊กในตั้งค่า → โผล่กลับมา (แต่ยังเป็นสีเทาเพราะกดไม่ได้จริง)',
          forced.show[1] === true && forced.grey[1] === true);
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

  // ── [alpha.151 ข้อ 1] สี่โหมด: นิยาย · บท · ทุกที่ · กระดาน ──
  check('★ โหมดมีสี่โหมด', T.FMT_MODES.join(',') === 'prose,screenplay,all,planner',
        T.FMT_MODES.join(','));
  check('★ แถบของตัวแก้ไขใช้สามโหมด (กระดานมีแถบของตัวเอง)',
        T.EDITOR_FMT_MODES.join(',') === 'prose,screenplay,all');
  check('โหมดที่ไม่รู้จักตกเป็นนิยาย',
        T.fmtMode('wiki') === 'prose' && T.fmtMode(undefined) === 'prose');
  check('★ โหมดที่รู้จักไม่ถูกยุบทิ้งอีกแล้ว',
        T.fmtMode('screenplay') === 'screenplay' && T.fmtMode('all') === 'all'
        && T.fmtMode('planner') === 'planner');

  // ── [alpha.151 ข้อ 3] แถบของกระดานเป็นคนละอัน ──
  {
    const pseq = T.plannerBarSequence();
    const pids = pseq.filter((x) => x !== 'sep');
    check('★★ แถบกระดานมีปุ่มของตัวเอง (ไม่ใช่ปุ่มชุดเดียวกับตัวแก้ไข)',
          pids.length >= 20 && pids.every((x) => x.startsWith('pb-')), pids.length);
    check('★ ไม่มีปุ่มไหนอยู่ทั้งสองแถบ',
          pids.every((x) => !T.FMTBAR_IDS.includes(x)));
    check('★ เส้นคั่นหนึ่งเส้นต่อรอยต่อหมวด',
          pseq.filter((x) => x === 'sep').length === T.PLANNER_BAR_GROUPS.length - 1);
    check('★ ปุ่มจัดข้อความในการ์ดครบหกทิศ',
          ['pb-align-left', 'pb-align-center', 'pb-align-right',
           'pb-valign-top', 'pb-valign-middle', 'pb-valign-bottom'].every((x) => pids.includes(x)));
    check('★ มีปุ่มแทรกรูปในการ์ด', pids.includes('pb-image'));
    // ซ่อน/แสดงได้จากหน้าตั้งค่าเหมือนแถบอีกอัน
    const c0 = T.setFmtbarVisible(null, 'planner', 'pb-image', false);
    check('★★ ปิดปุ่มของแถบกระดานแล้วถูกซ่อนจริง', T.plannerBarHidden(c0, 'pb-image') === true);
    const lay = T.layoutPlannerBar(c0);
    check('★★ ปุ่มที่ถูกซ่อน **ไม่ถูกวาดเลย** (ข้อ 6 — ไม่ใช่ทำเป็นสีเทา)',
          lay.show[lay.seq.indexOf('pb-image')] === false);
    check('★ เปิดกลับ → โผล่กลับมา (สองทาง)',
          T.plannerBarHidden(T.setFmtbarVisible(c0, 'planner', 'pb-image', true), 'pb-image') === false);
    check('★ ตั้งค่าแถบกระดานไม่กระทบแถบตัวแก้ไข',
          T.fmtbarHidden(c0, 'prose', 'tb-bold') === false);
    check('หมวดของแถบกระดานมีป้ายชื่อครบ',
          T.plannerBarGroups().every((g) => g.labelKey && g.buttons.length));
  }

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
    check('★ [151-6] ปุ่มที่ใช้ไม่ได้ในบท ถูกตัดออกจากแถบ ไม่ใช่ทำเป็นสีเทา',
          r.grey[3] === true && r.grey[4] === true && r.show[3] === false && r.show[4] === false);
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
