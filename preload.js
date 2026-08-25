const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
// [alpha.67] ทุกคำสั่งที่ "เปลี่ยนไฟล์" ต้องบอกหน้าต่างอื่นให้รู้ (tear-off = หลายหน้าต่างดูโปรเจกต์เดียวกัน)
// ดักที่นี่ทีเดียวแทนการไล่แปะตามจุดเรียกนับร้อยแห่งใน renderer — จุดใหม่ที่เพิ่มทีหลังก็ได้ไปด้วยฟรี ๆ
// (main เป็นคนหน่วงรวบก่อนกระจาย จึงเขียนรัว ๆ ตอน autosave ได้โดยไม่ท่วม)
const callW = (ch) => (...a) => ipcRenderer.invoke(ch, ...a).then((r) => {
  try { ipcRenderer.invoke('panel:fileChanged', a[0]); } catch {}
  return r;
});
// preload ทำงานในโหมด sandbox → `require('./package.json')` ล้มเสมอ และตกมาที่ '2.0.0'
// (กล่อง "เกี่ยวกับ" จึงโชว์เลขรุ่นผิดมาตลอด) — ถามจาก main แบบ sync แทน แล้วค่อยตกกลับของเดิม
let _appVersion = '2.0.0';
try { _appVersion = ipcRenderer.sendSync('app:versionSync') || _appVersion; } catch {}
if (_appVersion === '2.0.0') { try { _appVersion = require('./package.json').version || _appVersion; } catch {} }
contextBridge.exposeInMainWorld('kapi', {
  appVersion: _appVersion,
  appDir: call('app:dir'),                 // โฟลเดอร์แอป — ใช้หาไฟล์ภาษา/ทรัพยากรที่มากับโปรแกรม (preload sandbox ไม่มี __dirname)
  // [alpha.76] ไฟล์ภาษา CSV — langSync เป็น **synchronous** ตั้งใจ: ต้องได้ตารางคำแปล
  // ก่อน bundle.js เริ่ม import โมดูล ไม่งั้นค่าคงที่ระดับโมดูลค้างเป็นภาษาเดิม (ดูหัวไฟล์ src/i18n.js)
  langSync: (want) => ipcRenderer.sendSync('lang:sync', want),
  langList: call('lang:list'), langRead: call('lang:read'), langDirs: call('lang:dirs'),
  langSet: call('lang:set'),               // บอก main ให้สร้างเมนู OS ใหม่ตามภาษาที่เลือก
  langReload: call('lang:reload'),         // ทิ้งแคชไฟล์ภาษาใน main (ผู้ใช้แก้ CSV นอกโปรแกรม)
  openExternal: call('shell:openExternal'),// เปิดลิงก์ในเบราว์เซอร์ของเครื่อง (เครดิตในกล่อง "เกี่ยวกับ")
  readFile: call('fs:readFile'), writeFile: callW('fs:writeFile'),
  readJson: call('fs:readJson'), exists: call('fs:exists'), listDirs: call('fs:listDirs'),
  listFiles: call('fs:listFiles'), mkdir: call('fs:mkdir'), move: callW('fs:move'), remove: callW('fs:remove'), isDir: call('fs:isDir'), mtime: call('fs:mtime'),
  stat: call('fs:stat'),                   // [alpha.63] {size, mtimeMs, birthtimeMs, isDir} — คลังรูปใช้
  copyInto: callW('fs:copyInto'), writeImageData: callW('fs:writeImageData'),
  // [alpha.97 ข้อ 12] ชื่อวงศ์ฟอนต์ที่ลงไว้ในเครื่อง (อ่านจากโฟลเดอร์ฟอนต์ของระบบ)
  listFonts: call('fonts:list'),
  writeBytes: callW('fs:writeBytes'), readBytes: call('fs:readBytes'), copyFile: callW('fs:copyFile'),
  spellBase: call('spell:base'), spellExtra: call('spell:extra'),
  spellAddWord: call('spell:addWord'), spellDownload: call('spell:download'), spellHasBase: call('spell:hasBase'),
  join: call('path:join'), resolve: call('path:resolve'),
  relative: call('path:relative'), toFileURL: call('path:toFileURL'),
  openProjectDialog: call('dialog:openProject'), openImageDialog: call('dialog:openImage'),
  saveAsDialog: call('dialog:saveAs'), savePdfDialog: call('dialog:savePdf'),
  openFileDialog: call('dialog:openFile'),   // เลือกไฟล์เดียว (นำเข้าสถานะฉาก ฯลฯ)
  openDirDialog: call('dialog:openDir'),     // [70] เลือกโฟลเดอร์ปลายทางของ PDF ลายน้ำ
  openScreenplayFile: call('dialog:openScreenplay'), // [alpha.60 ข้อ 62-66] เลือกไฟล์บททุกฟอร์แมต
  // [alpha.60r3 ข้อ 7] ปลั๊กอินระดับผู้ใช้ (%APPDATA%/Killian2/Plugins/) — คืน path ให้ใช้ fs:* ต่อ
  globalPluginsDir: call('plugins:globalDir'),
  listGlobalPlugins: call('plugins:listGlobal'),
  // [alpha.80] ติดตั้ง/ถอนปลั๊กอินจากลิงก์ GitHub — โหลด+แตกซิปต้องทำใน main
  // (http:fetch คืนเป็นข้อความล้วน ใช้กับไฟล์ไบนารีไม่ได้)
  pluginFetchZip: call('plugins:fetchZip'),
  pluginExtract: call('plugins:extract'),
  pluginUninstall: call('plugins:uninstall'),
  readGlobalSettings: call('settings:readGlobal'),    // [alpha.60 ข้อ 94] อ่าน global settings จาก userData
  writeGlobalSettings: call('settings:writeGlobal'),  // [alpha.60 ข้อ 94] เขียน global settings ไป userData
  print: call('win:print'), printToPdf: call('win:printToPdf'),
  pdfFromHtml: call('pdf:fromHtml'),         // [70] สร้าง PDF จาก HTML (หน้าต่างซ่อน)
  pdfHtmlToBytes: call('pdf:htmlToBytes'),   // [alpha.81r2] เหมือนกันแต่คืนไบต์ (เอาไปต่อ/ประทับเลขหน้า)
  pushRecent: call('recent:push'), listRecent: call('recent:list'),
  // [alpha.79] เซสชัน "จำทุกอย่างล่าสุด" — เก็บเป็นไฟล์จริง ไม่ใช่ localStorage
  // (localStorage เขียนลงดิสก์แบบหน่วงเวลา → force quit ทีไรก็หายทุกที)
  sessionRead: call('session:read'), sessionWrite: call('session:write'),
  sessionClear: call('session:clear'),
  winBounds: call('win:bounds'), winSetBounds: call('win:setBounds'),
  testShot: call('test:shot'), testShotTearOff: call('test:shotTearOff'), revealInOS: call('shell:reveal'),
  // [alpha.62 บั๊ก 3] คลิปบอร์ดผ่าน main — เชื่อถือได้กว่า navigator.clipboard ในหน้าต่างไร้ขอบ
  clipboardWrite: call('clipboard:write'), clipboardRead: call('clipboard:read'),
  winMin: call('win:minimize'), winMax: call('win:maximize'), winClose: call('win:close'),
  quitNow: call('win:quitNow'), menuPopup: call('menu:popup'),
  menuToggles: call('menu:toggles'),        // แจ้งสถานะสวิตช์ให้เมนู native ติ๊กถูกให้ตรง
  // [alpha.69] รายการแผงที่อยู่ในเมนู มุมมอง → แผง (เมนู native สร้างในฝั่ง main — renderer มองไม่เห็น)
  // มีไว้ให้ e2e เทียบกับ PANEL_DEFS: เพิ่มแผงใหม่แล้วลืมใส่เมนู = เทสแดงทันที
  menuPanelIds: call('menu:panelIds'),
  httpFetch: call('http:fetch'),
  httpAbort: call('http:abort'),        // [alpha.96] ยกเลิกคำขอ AI ที่กำลังวิ่ง
  httpInflight: call('http:inflight'),
  // สตรีมทีละบรรทัด — main ส่งกลับทาง channel เฉพาะคำขอ แล้วถอด listener เมื่อจบ
  httpStream: (url, options, onLine) => {
    const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const ch = 'http:stream:' + id;
    const h = (e, line) => { try { onLine(line); } catch {} };
    ipcRenderer.on(ch, h);
    return ipcRenderer.invoke('http:stream', url, options, id)
      .finally(() => ipcRenderer.removeListener(ch, h));
  },
  logWrite: call('log:write'), logRead: call('log:read'), logPath: call('log:path'), logReveal: call('log:reveal'),
  onMenu: (cb) => ipcRenderer.on('menu', (e, ch, ...a) => cb(ch, ...a)),
  // ---- [alpha.67] Tear-off: แผงเป็นหน้าต่าง OS จริง (หลายจอ) ----
  tearOff: call('panel:tearOff'),                 // {id,title,root,x,y,w,h} → เปิดหน้าต่างแผง
  tearOffClose: call('panel:tearOffClose'),        // ปิดหน้าต่างแผงตาม id
  tearOffList: call('panel:tearOffList'),          // id ของแผงที่ถูกฉีกออกอยู่ตอนนี้
  broadcast: call('panel:broadcast'),              // ส่งข้อความถึงหน้าต่างอื่นทุกบาน (ไม่ย้อนกลับหาผู้ส่ง)
  onSync: (cb) => ipcRenderer.on('k2:sync', (e, msg) => cb(msg || {})),
  // ---- [alpha.69] สมุดประวัติการทำงาน (History) ----
  // main เป็นคนจดเอง (ดักที่ handler ของ fs) — renderer แค่บอกว่าโปรเจกต์ไหน/เก็บกี่ครั้ง แล้วอ่าน/สั่งย้อน
  historyConfig: call('history:config'),           // {root, limit, enabled} → เปิด/ปิดการจด
  historyList: call('history:list'),               // สมุดทั้งเล่ม
  historyRevert: call('history:revert'),           // ย้อนกลับไปหลังบันทึกหมายเลข seq
  historyClear: call('history:clear'),             // ล้างประวัติทั้งหมด
});
