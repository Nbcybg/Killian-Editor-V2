# icons/svg — ไฟล์ทับไอคอน (ไม่บังคับ)

ตั้งแต่ alpha.166 ไอคอนทั้งโปรแกรมมาจาก **Nerd Fonts** ชุดเดียว (`icons/glyphs.csv` ช่อง `nf`)
— รูป svg และตัวอักษรบนจอสร้างจากฟอนต์ `renderer/assets/fonts/k2-icons.ttf` ตอน `node build.js`

อยากได้รูปของตัวเองสำหรับชื่อไหน: วาง `<ชื่อ>.svg` ไว้ในโฟลเดอร์นี้ (ชื่อเดียวกับแถวใน `glyphs.csv`)
แล้ว `node build.js` — ไฟล์ในโฟลเดอร์นี้ชนะรูปจากฟอนต์เสมอ (ตัวอักษรในข้อความ `gi()` ยังเป็นของฟอนต์)

เปลี่ยนไอคอนแบบง่ายกว่า: เปิด https://www.nerdfonts.com/cheat-sheet หาไอคอนที่ชอบ
แล้วคัดลอกชื่อ (เช่น `nf-md-book_open_outline`) ไปใส่ช่อง `nf` ของแถวนั้นใน `icons/glyphs.csv`
