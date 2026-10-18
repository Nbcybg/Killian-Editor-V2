// tools/docs-appendix-text.cjs — ข้อความรายภาษาของภาคผนวก A–C ในคู่มือผู้ใช้ (docs/manual/<ภาษา>/)
// ตัวสร้างอยู่ที่ tools/docs-appendix.cjs · เพิ่มภาษา = เพิ่มก้อนใหม่ในตารางนี้ (โครงเดียวกับ `en`)
//
// ค่าที่ต้อง "ตรงกับหน้าจอของภาษานั้นเป๊ะ" (ตัวสร้างหยุดพร้อมบอกเหตุเมื่อหาไม่เจอ):
//   recentPath   ชื่อเมนู ไฟล์ → โปรเจกต์ล่าสุด          (รายการข้างใต้เป็นทางของเครื่อง จึงแทนด้วยคำอธิบาย)
//   cheatClose   ป้ายปุ่มปิดของกล่อง "ปุ่มลัดทั้งหมด"
//   cheatCats    ชื่อหมวดในกล่อง "ปุ่มลัดทั้งหมด" ตามลำดับที่กล่องแสดง
//   langWord/selfName/linkName  บรรทัดสลับภาษาใต้หัวเรื่อง: "**<langWord>:** <selfName> · [<linkName ของภาษาอื่น>](…)"
//   cheatOdd     แถวในกล่องนั้นที่ไม่ใช่คำสั่ง (ข้อความสถานะของซูมที่หลุดเข้ามา — alpha.169)
/* i18n-skip: ข้อความของเอกสาร ไม่ใช่ข้อความ UI ของโปรแกรม */
const TEXT = {
  th: {
    langWord: 'ภาษา', selfName: 'ไทย', linkName: 'ภาษาไทย',
    head: (version) => ''
      + '> สร้างจากข้อมูลของโปรแกรมรุ่น **' + version + '** (ภาษาไทย · ค่าเริ่มต้น) — ชื่อเมนูและคีย์ลัดบนเครื่องของคุณอาจต่างไปตามภาษาที่เลือกและคีย์ลัดที่ตั้งเอง\n'
      + '> บน macOS: `Ctrl` = `⌘` · `Alt` = `⌥`\n\n'
      + '[← กลับสารบัญคู่มือ](README.md)\n\n',

    aTitle: 'ภาคผนวก A — ผังเมนูทั้งหมด',
    aIntro: [
      'แถบเมนูอยู่บนสุดของหน้าต่าง (บน macOS อยู่บนแถบเมนูของระบบ) · แตะ `Alt` หรือ `F10` เพื่อเข้าแถบเมนูด้วยคีย์บอร์ด แล้วใช้ `←` `→` เดิน · `Enter`/`↓` เปิด · `Esc` ออก',
      'รายการที่ลงท้ายด้วย `…` เปิดกล่องโต้ตอบ · รายการในเมนู **บทภาพยนตร์** บางรายการกดได้เฉพาะเมื่อแท็บที่เปิดอยู่เป็นบทภาพยนตร์',
    ],
    menuHeading: (name) => 'เมนู ' + name,
    menuRename: {},
    menuNote: {},
    recentPath: ['ไฟล์', 'โปรเจกต์ล่าสุด'],
    recentNote: '*(รายการโฟลเดอร์โปรเจกต์ที่เพิ่งเปิด — โฟลเดอร์ที่หาไม่เจอแล้วมีเครื่องหมาย ⚠ นำหน้า)*',
    devToolsNote: '*(มีเฉพาะตัวที่รันจากซอร์ส/โหมดนักพัฒนา)*',
    aSeeAlso: 'ดูต่อ: [ภาคผนวก B — คีย์ลัด](B-shortcuts.md) · [ภาคผนวก C — คำสั่งทั้งหมด](C-commands.md)',

    bTitle: 'ภาคผนวก B — คีย์ลัดทั้งหมด (ค่าเริ่มต้น)',
    bIntro: [
      '- คีย์ลัดจับที่ **ปุ่มกายภาพ** ไม่ใช่ตัวอักษร — ใช้ได้เหมือนเดิมแม้แป้นพิมพ์อยู่ภาษาไทย',
      '- ดูรายการตามค่าที่ตั้งไว้จริงบนเครื่องของคุณ: เมนู **ช่วยเหลือ → ปุ่มลัดทั้งหมด…** (`Ctrl+Alt+/`)',
      '- เปลี่ยนคีย์ลัด: **ตั้งค่า → ปุ่มลัด** → กด **แก้** แล้วกดปุ่มชุดใหม่ (ต้องมี `Ctrl`/`⌘`) · ปุ่มที่ซ้ำกันจะถูกเตือน · ปุ่มรีเซ็ตคืนค่าเริ่มต้นรายตัว',
      '- คำสั่งที่มีสองปุ่ม เขียนคั่นด้วย `/`',
    ],
    cheatClose: 'ปิด',
    cheatCats: ['ไฟล์และผลงาน', 'แก้ไขและค้นหา', 'รูปแบบข้อความ', 'บทภาพยนตร์', 'มุมมองและพื้นที่ทำงาน', 'สร้างของใหม่', 'แผง', 'อื่น ๆ'],
    cheatOdd: ['ซูม +', 'ซูม', 'รีเซ็ตซูมแล้ว'],
    bHeader: ['ทำอะไร', 'คีย์ลัด', 'หมายเหตุ'],
    bFixedTitle: 'คีย์ที่ไม่ได้อยู่ในตารางปุ่มลัด (ตายตัว)',
    bFixedHeader: ['ที่ไหน', 'คีย์', 'ทำอะไร'],
    bFixed: [
      ['ทุกที่', '`Esc`', 'ปิดกล่อง/เมนู · ยกเลิกการลากที่กำลังทำอยู่ · ออกจากโหมดอ่าน'],
      ['ทุกที่', '`Alt` (แตะแล้วปล่อย) / `F10`', 'เข้าแถบเมนู'],
      ['กล่องโต้ตอบ', '`Enter` / `Esc`', 'ปุ่มหลัก / ยกเลิก · `Tab` วนอยู่ในกล่อง'],
      ['Explorer', '`↑` `↓` `Home` `End`', 'เดินระหว่างแถว'],
      ['Explorer', '`Enter`', 'เปิดแถวที่เลือก'],
      ['Explorer', '`F2`', 'เปลี่ยนชื่อในแถว'],
      ['Explorer', '`Shift+F10`', 'เปิดเมนูคลิกขวาของแถว'],
      ['ตัวแก้ไข', '`Ctrl+ล้อเมาส์`', 'ซูมหน้ากระดาษ'],
      ['ตัวแก้ไข', '`Shift+Enter`', 'ขึ้นบรรทัดใหม่ในย่อหน้าเดิม'],
      ['บทภาพยนตร์', '`Enter`', 'ไป element ถัดไปตามตาราง (ตั้งได้ที่ ตั้งค่า → ปุ่มบทหนัง)'],
      ['บทภาพยนตร์', '`Ctrl+Tab` / `Ctrl+Shift+Tab`', 'วนชนิด element (ที่อื่นคีย์นี้สลับแท็บ)'],
      ['บทภาพยนตร์', '`Ctrl+↑` / `Ctrl+↓`', 'สลับชนิด element'],
      ['เปิดไฟล์ด่วน', '`↑` `↓` `Enter` `Esc` · `Ctrl+R`', 'เลือก · เปิด · ปิด · สแกนใหม่'],
      ['โหมดอ่านทั้งเล่ม', '`←` `→` `PageUp` `PageDown` `Space` `Home` `End`', 'เปลี่ยนหน้า · หน้าแรก/สุดท้าย'],
      ['แชท AI', '`Enter` / `Shift+Enter`', 'ส่ง / ขึ้นบรรทัด (สลับได้ในแผงแชท)'],
      ['คอนโซลนักพัฒนา', '`Ctrl+Enter` · `Ctrl+↑`', 'รัน · เรียกคำสั่งก่อนหน้า'],
    ],
    bSeeAlso: 'ดูต่อ: [ภาคผนวก A — ผังเมนู](A-menus.md) · [ภาคผนวก C — คำสั่งทั้งหมด](C-commands.md)',

    cTitle: 'ภาคผนวก C — คำสั่งทั้งหมด',
    cIntro: [
      'ทุกอย่างที่กดได้ในโปรแกรม (เมนู · ปุ่ม · คีย์ลัด · ปุ่มลอย) เรียก "คำสั่ง" ตัวเดียวกัน ตารางนี้คือทะเบียนคำสั่งทั้งหมดพร้อมคำอธิบายที่โปรแกรมแสดงในทูลทิป',
      '',
      '- **รหัสคำสั่ง** คือชื่อภายในของคำสั่ง — เห็นได้ในบันทึกการทำงาน (Log) บรรทัด `cmd:` และใช้อ้างอิงเวลารายงานบั๊ก',
      '- รหัสที่มี `:` คือคำสั่งพร้อมค่า เช่น `zoom:1` = ซูมเข้าหนึ่งขั้น · `toggle-panel:kanban` = เปิด/ปิดแผง Kanban',
      '- คำสั่งที่ช่องคีย์ลัดว่าง = ไม่มีคีย์ลัดตั้งต้น (เรียกจากเมนูหรือปุ่ม)',
      '- รหัสขึ้นต้น `ui:` คือปุ่มบนแถบที่ไม่มีรายการในเมนู',
    ],
    cGroups: {
      create: 'สร้างของใหม่', file: 'ไฟล์ · โปรเจกต์ · แท็บ', io: 'ส่งออก · นำเข้า · พิมพ์', edit: 'แก้ไข · ค้นหา · นำทาง',
      format: 'รูปแบบข้อความ', screenplay: 'บทภาพยนตร์', view: 'มุมมอง · ซูม · โหมด', panels: 'แผงและพื้นที่ทำงาน',
      ai: 'AI', a11y: 'การช่วยการเข้าถึง', help: 'ช่วยเหลือ · ระบบ',
    },
    cHeader: ['รหัสคำสั่ง', 'คีย์ลัดตั้งต้น', 'ทำอะไร'],
    cSeeAlso: 'ดูต่อ: [ภาคผนวก A — ผังเมนู](A-menus.md) · [ภาคผนวก B — คีย์ลัด](B-shortcuts.md)',
  },

  en: {
    langWord: 'Language', selfName: 'English', linkName: 'English',
    head: (version) => ''
      + '> Generated from the app itself, version **' + version + '** (English · default settings). Menu names and shortcuts on your machine may differ with the language you chose and the shortcuts you rebound.\n'
      + '> On macOS: `Ctrl` = `⌘` · `Alt` = `⌥`\n\n'
      + '[← Back to the manual contents](README.md)\n\n',

    aTitle: 'Appendix A — Every menu',
    aIntro: [
      'The menu bar sits at the top of the window (on macOS it is in the system menu bar). Tap `Alt` or press `F10` to enter the menu bar from the keyboard, then `←` `→` to move, `Enter`/`↓` to open, `Esc` to leave.',
      'Items ending in `…` open a dialog. Some items in the **Script** menu are only enabled while the open tab is a screenplay.',
    ],
    menuHeading: (name) => name + ' menu',
    // alpha.169: แถบชื่อเรียกเมนูบทภาพยนตร์ว่า "Script" แต่ป้ายของเมนูระบบในภาษาอังกฤษเป็น "Chapter"
    // [alpha.170 · รอบต่อ 7] เมนูระบบใช้คีย์ของตัวเอง (`ui.menu.script`) แล้ว — เดิมยืมคีย์ของคำว่า chapter ป้ายอังกฤษจึงเป็น "Chapter"
    menuRename: {},
    menuNote: { Script: '*(Screenplay tools.)*' },
    recentPath: ['File', 'Recent projects'],
    recentNote: '*(the project folders you opened recently — a folder that can no longer be found is marked ⚠)*',
    devToolsNote: '*(only when running from source / in developer mode)*',
    aSeeAlso: 'See also: [Appendix B — Shortcuts](B-shortcuts.md) · [Appendix C — Every command](C-commands.md)',

    bTitle: 'Appendix B — Every shortcut (defaults)',
    bIntro: [
      '- Shortcuts bind to the **physical key**, not the character it types — they keep working when your keyboard layout is Thai, Japanese, or anything else.',
      '- To see the list as it is actually bound on your machine: **Help → All Shortcuts…** (`Ctrl+Alt+/`).',
      '- To change a shortcut: **Settings → Shortcuts** → press **Edit**, then press the new combination (it must include `Ctrl`/`⌘`). Clashes are flagged, and each row has a reset button.',
      '- A command with two shortcuts shows them separated by `/`.',
    ],
    cheatClose: 'Close',
    cheatCats: ['File & project', 'Edit & search', 'Text formatting', 'Screenplay', 'View & workspace', 'Create', 'Panels', 'Other'],
    cheatOdd: ['Zoom +', 'Zoom', 'Zoom reset to 100%'],
    bHeader: ['Action', 'Shortcut', 'Note'],
    bFixedTitle: 'Fixed keys that are not in the shortcut table',
    bFixedHeader: ['Where', 'Key', 'What it does'],
    bFixed: [
      ['Anywhere', '`Esc`', 'Close the dialog/menu · cancel a drag in progress · leave reading mode'],
      ['Anywhere', '`Alt` (tap and release) / `F10`', 'Enter the menu bar'],
      ['Dialogs', '`Enter` / `Esc`', 'Primary button / cancel · `Tab` cycles inside the dialog'],
      ['Explorer', '`↑` `↓` `Home` `End`', 'Move between rows'],
      ['Explorer', '`Enter`', 'Open the selected row'],
      ['Explorer', '`F2`', 'Rename in place'],
      ['Explorer', '`Shift+F10`', 'Open the row’s context menu'],
      ['Editor', '`Ctrl+mouse wheel`', 'Zoom the page'],
      ['Editor', '`Shift+Enter`', 'New line inside the same paragraph'],
      ['Screenplay', '`Enter`', 'Go to the next element per the table (set in Settings → Screenplay keys)'],
      ['Screenplay', '`Ctrl+Tab` / `Ctrl+Shift+Tab`', 'Cycle the element type (elsewhere this switches tabs)'],
      ['Screenplay', '`Ctrl+↑` / `Ctrl+↓`', 'Switch the element type'],
      ['Quick Open', '`↑` `↓` `Enter` `Esc` · `Ctrl+R`', 'Choose · open · close · rescan'],
      ['Read whole book', '`←` `→` `PageUp` `PageDown` `Space` `Home` `End`', 'Turn pages · first/last page'],
      ['AI chat', '`Enter` / `Shift+Enter`', 'Send / new line (can be swapped in the chat panel)'],
      ['Developer console', '`Ctrl+Enter` · `Ctrl+↑`', 'Run · recall the previous command'],
    ],
    bSeeAlso: 'See also: [Appendix A — Menus](A-menus.md) · [Appendix C — Every command](C-commands.md)',

    cTitle: 'Appendix C — Every command',
    cIntro: [
      'Everything you can trigger in the app (menu items, buttons, shortcuts, the floating button) runs the same "command". This table is the full command registry, with the description the app shows in tooltips.',
      '',
      '- The **command id** is the command’s internal name. You see it in the activity log on `cmd:` lines, and it is handy to quote in a bug report.',
      '- An id containing `:` is a command with a value, e.g. `zoom:1` = zoom in one step · `toggle-panel:kanban` = show/hide the Kanban panel.',
      '- An empty shortcut cell means there is no default shortcut (use the menu or a button).',
      '- Ids starting with `ui:` are toolbar buttons that have no menu item.',
    ],
    cGroups: {
      create: 'Create', file: 'File · project · tabs', io: 'Export · import · print', edit: 'Edit · search · navigate',
      format: 'Text formatting', screenplay: 'Screenplay', view: 'View · zoom · modes', panels: 'Panels and workspaces',
      ai: 'AI', a11y: 'Accessibility', help: 'Help · system',
    },
    cHeader: ['Command id', 'Default shortcut', 'What it does'],
    cSeeAlso: 'See also: [Appendix A — Menus](A-menus.md) · [Appendix B — Shortcuts](B-shortcuts.md)',
  },
};
/* /i18n-skip */

module.exports = { TEXT };
