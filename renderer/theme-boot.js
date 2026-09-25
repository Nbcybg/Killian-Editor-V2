// renderer/theme-boot.js — [alpha.166] ★ ทาธีมก่อนเฟรมแรก
// ผู้ใช้: "ฉีก panel ดู จะมีสี theme เก่าอยู่เสี้ยววินาทีนึง"
// ต้นตอ: คลาส body.theme-<id> ถูกใส่ตอน applyTheme() ซึ่งรอโหลดตั้งค่า/โปรเจกต์ก่อน → ระหว่างนั้น
// body ไม่มีคลาสธีม = ตัวแปรของ themes/base.css (เทาอุ่นของธีมรุ่นแรก) + พื้นหน้าต่าง #262624 ของ main
// ไฟล์นี้โหลดเป็นสคริปต์แรกใต้ <body> (ก่อน bundle.js) — อ่านธีมจาก ?theme= (หน้าต่างแผงที่ฉีก)
// หรือค่าที่ applyTheme() จำไว้รอบก่อน (localStorage ก้อนเดียวกันทุกหน้าต่าง · origin file://)
(function () {
  try {
    var q = new URLSearchParams(location.search).get('theme');
    var id = q || localStorage.getItem('k2-boot-theme');
    if (id && /^[a-z0-9-]+$/.test(id)) { document.body.classList.add('theme-' + id); window.__k2bootTheme = id; }
    var mode = localStorage.getItem('k2-boot-mode');
    if (mode === 'light' || mode === 'dark') document.documentElement.style.colorScheme = mode;
  } catch (e) { /* ไม่มี localStorage (หน้าต่างพิเศษ) = ปล่อยให้ applyTheme() ทำตามปกติ */ }
})();
