// ⚠️ ไฟล์นี้สร้างอัตโนมัติจาก renderer/themes/themes.json ด้วย tools/theme-build.cjs — ห้ามแก้มือ
// เพิ่ม/แก้ธีม = แก้ themes.json แล้วรัน `node build.js`

/** รายชื่อธีมตามลำดับในเมนู (ตัวแรก = ค่าเริ่มต้นเมื่อค่าที่บันทึกไว้ใช้ไม่ได้) */
export const THEMES = ["k2","k2-light","sakura-mist","plum-wine","lagoon","neon-pop","tropical","claude","opencode","kimi","vscode","word","excel","powerpoint","macintosh","gundam","dva","fruit","flower","rainbow"];
/** ธีม → คีย์ป้ายชื่อในไฟล์ภาษา */
export const THEME_LABEL_KEYS = {
  "k2": "ui.settings.themeK2",
  "k2-light": "ui.settings.themeK2Light",
  "sakura-mist": "ui.themes.sakuraMist",
  "plum-wine": "ui.themes.plumWine",
  "lagoon": "ui.themes.lagoon",
  "neon-pop": "ui.themes.neonPop",
  "tropical": "ui.themes.tropical",
  "claude": "ui.themes.claude",
  "opencode": "ui.themes.opencode",
  "kimi": "ui.themes.kimi",
  "vscode": "ui.themes.vscode",
  "word": "ui.themes.word",
  "excel": "ui.themes.excel",
  "powerpoint": "ui.themes.powerpoint",
  "macintosh": "ui.themes.macintosh",
  "gundam": "ui.themes.gundam",
  "dva": "ui.themes.dva",
  "fruit": "ui.themes.fruit",
  "flower": "ui.themes.flower",
  "rainbow": "ui.themes.rainbow"
};
/** ธีม → dark | light */
export const THEME_MODES = {
  "k2": "dark",
  "k2-light": "light",
  "sakura-mist": "light",
  "plum-wine": "dark",
  "lagoon": "light",
  "neon-pop": "dark",
  "tropical": "light",
  "claude": "dark",
  "opencode": "dark",
  "kimi": "dark",
  "vscode": "dark",
  "word": "light",
  "excel": "light",
  "powerpoint": "light",
  "macintosh": "light",
  "gundam": "dark",
  "dva": "dark",
  "fruit": "light",
  "flower": "light",
  "rainbow": "dark"
};
