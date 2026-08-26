const { mdToDoc, docToMd, parseMdFile, dumpMdFile } = require('../src/md.js');
const cases = [
  "ธรรมดา",
  "# หัวข้อใหญ่",
  "### หัวสาม",
  "นี่ **หนา** และ *เอียง* กับ _ขีด_ และ ~~ฆ่า~~",
  "ผสม ***หนาเอียง*** จ้า",
  "ซ้อน **หนา _ขีดใน_ ต่อ**",
  "> คำพูดยกมา",
  "> สองบรรทัดติดกัน",
  "- รายการหนึ่ง",
  "- รายการ **หนา**",
  "1. ข้อแรก",
  "2. ข้อสอง",
  "",
  "บรรทัดว่างด้านบน",
  "![ภาพ](../../../Images/t.png)",
  "[[ลิงก์วิกิ]] และ ((โน้ต))",
  "ดาวเดี่ยว ** ค้าง",
  "5. เริ่มนับที่ห้า",
  // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย — ต้องไป-กลับได้และห้ามไปชนกับ ~~ขีดฆ่า~~
  "สูตร H~2~O กับ x^2^ ปนกัน",
  "~ห้อย~ ต้นบรรทัด และ ^ยก^ ด้วย",
  "~~ฆ่า~~ อยู่กับ ~ห้อย~ ในบรรทัดเดียว",
  // [alpha.61 ข้อ 3] Shift+Enter = hard break (แบ็กสแลชท้ายบรรทัด · ย่อหน้าเดียวกัน)
  "บรรทัดบน\\",
  "บรรทัดล่างในย่อหน้าเดียวกัน",
  // [alpha.61 ข้อ 3] Ctrl+Enter = ขึ้นหน้าใหม่ด้วยมือ
  "<!--pagebreak-->",
  "หลังขึ้นหน้าใหม่",
  // [alpha.61 ข้อ 3] Tab = อักขระแท็บจริงในเนื้อความ
  "\tเยื้องด้วยแท็บ",
];
const md = cases.join("\n");
const back = docToMd(mdToDoc(md));
if (back !== md) {
  const a = back.split("\n"), b = md.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    console.log(a[i] === b[i] ? "  " : "!!", JSON.stringify(a[i]), "|", JSON.stringify(b[i]));
  throw new Error("round-trip mismatch");
}
console.log("round-trip OK (" + cases.length + " lines)");
const f = "---\ntitle: ทดสอบ\nformat: prose\ntags: [a, b]\n---\n\nเนื้อหา **หนา**";
const { meta, body } = parseMdFile(f);
if (meta.title !== "ทดสอบ" || meta.tags.join() !== "a,b" || body !== "เนื้อหา **หนา**") throw new Error("fm");
const again = parseMdFile(dumpMdFile(meta, body));
if (again.body !== body || again.meta.title !== meta.title) throw new Error("fm round-trip");
console.log("frontmatter OK");
const doc2 = { type: "doc", content: [{ type: "paragraph", content: [
  { type: "text", text: "aa ", marks: [{type:"strong"}]},
  { type: "text", text: "bb", marks: [{type:"strong"},{type:"underline"}]},
  { type: "text", text: " cc", marks: [{type:"underline"}]},
  { type: "text", text: " dd" }]}]};
const one = docToMd(doc2), two = docToMd(mdToDoc(one));
if (one !== two) throw new Error("overlap unstable: " + one + " / " + two);
console.log("overlap stable:", one);

// ── [alpha.61 ข้อ 3] hard break / page break / tab — ตรวจ "โครงสร้าง" ไม่ใช่แค่ round-trip ──
{
  const d = mdToDoc("บน\\\nล่าง");
  if (d.content.length !== 1) throw new Error("hard break: ต้องเป็นย่อหน้าเดียว ได้ " + d.content.length);
  const types = d.content[0].content.map((n) => n.type);
  if (JSON.stringify(types) !== JSON.stringify(["text", "hard_break", "text"]))
    throw new Error("hard break: โครงผิด " + JSON.stringify(types));
  if (docToMd(d) !== "บน\\\nล่าง") throw new Error("hard break: เขียนกลับไม่ตรง " + JSON.stringify(docToMd(d)));

  // แบ็กสแลชคู่ (`\\`) = แบ็กสแลชจริง ไม่ใช่ hard break → ต้องยังเป็นคนละย่อหน้า
  const d2 = mdToDoc("จริง\\\\\nแยกย่อหน้า");
  if (d2.content.length !== 2) throw new Error("escaped backslash ไม่ควรเป็น hard break");

  const d3 = mdToDoc("ก่อน\n<!--pagebreak-->\nหลัง");
  if (d3.content.map((n) => n.type).join(",") !== "paragraph,page_break,paragraph")
    throw new Error("page break: โครงผิด " + d3.content.map((n) => n.type).join(","));
  if (docToMd(d3) !== "ก่อน\n<!--pagebreak-->\nหลัง") throw new Error("page break: เขียนกลับไม่ตรง");

  const d4 = mdToDoc("\tเยื้อง");
  if (d4.content[0].content[0].text !== "\tเยื้อง") throw new Error("tab หายระหว่างอ่าน");
  if (docToMd(d4) !== "\tเยื้อง") throw new Error("tab หายระหว่างเขียน");

  // hard break ต้องปิดเครื่องหมายรูปแบบก่อนขึ้นบรรทัด ไม่งั้นอ่านกลับไม่ได้
  const d5 = { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "หนา", marks: [{ type: "strong" }] },
    { type: "hard_break" },
    { type: "text", text: "ต่อ", marks: [{ type: "strong" }] }] }] };
  const md5 = docToMd(d5);
  if (md5 !== "**หนา**\\\n**ต่อ**") throw new Error("hard break + mark: " + JSON.stringify(md5));
  if (docToMd(mdToDoc(md5)) !== md5) throw new Error("hard break + mark ไม่นิ่ง");
}
console.log("alpha.61 hard break / page break / tab OK");

// ───────── [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย ─────────
{
  const marksOf = (doc, i, j) => (doc.content[i].content[j].marks || []).map((m) => m.type).sort();
  const dSup = mdToDoc("x^2^");
  if (marksOf(dSup, 0, 1).join(",") !== "sup") throw new Error("sup: mark ผิด " + JSON.stringify(dSup.content[0].content));
  const dSub = mdToDoc("H~2~O");
  if (marksOf(dSub, 0, 1).join(",") !== "sub") throw new Error("sub: mark ผิด " + JSON.stringify(dSub.content[0].content));
  // `~` เดี่ยวต้องไม่ไปแย่งแมตช์ใน `~~ขีดฆ่า~~`
  const dStr = mdToDoc("~~ฆ่า~~");
  if (marksOf(dStr, 0, 0).join(",") !== "strike") throw new Error("strike ถูก sub แย่งไป");
  // ซ้อนกับตัวหนาแล้วยังไป-กลับได้
  const mixed = "**หนา ^ยก^ ต่อ**";
  if (docToMd(mdToDoc(mixed)) !== mixed) throw new Error("sup ซ้อน strong ไม่นิ่ง: " + docToMd(mdToDoc(mixed)));
  // sup กับ sub อยู่ตัวเดียวกันไม่ได้ (schema กันไว้) — แต่ md ต้องเขียนสองก้อนติดกันได้
  const two = "^ยก^~ห้อย~";
  if (docToMd(mdToDoc(two)) !== two) throw new Error("sup+sub ติดกันไม่นิ่ง: " + docToMd(mdToDoc(two)));
}
console.log("alpha.97 superscript / subscript OK");

// ══ [alpha.103 ข้อ 2] ★ แผนที่การจัดหน้าต้องครอบคลุมย่อหน้าใน "รายการ / คำพูดยกมา" ══
// ผู้ใช้: *"เมื่อใช้หัวข้อหรือ bullet จะถูกจัดชิดซ้ายเสมอ และปรับเปลี่ยนไม่ได้"*
// ครึ่งหนึ่งของต้นตอ: collectAlign เดิมเก็บเฉพาะบล็อกระดับบนสุด → ข้อในรายการไม่เคยถูกบันทึก
{
  const { collectAlign, alignToString, alignFromString } = require('../src/md.js');
  const doc = mdToDoc('# หัว\n\n- หนึ่ง\n- สอง\n\n> ยกมา');
  // ตั้ง align ให้: หัวข้อ (บนสุด) · ข้อที่สองของรายการ · ย่อหน้าในคำพูดยกมา
  doc.content[0].attrs = { ...(doc.content[0].attrs || {}), align: 'center' };
  const list = doc.content.find((n) => n.type === 'bullet_list');
  list.content[1].content[0].attrs = { align: 'right' };
  const quote = doc.content.find((n) => n.type === 'blockquote');
  quote.content[0].attrs = { align: 'justify' };

  const map = collectAlign(doc);
  const li = doc.content.indexOf(list), qi = doc.content.indexOf(quote);
  if (map['0'] !== 'center') throw new Error('align หัวข้อระดับบนหาย: ' + JSON.stringify(map));
  if (map[li + '.1.0'] !== 'right') throw new Error('align ของข้อในรายการหาย: ' + JSON.stringify(map));
  if (map[qi + '.0'] !== 'justify') throw new Error('align ในคำพูดยกมาหาย: ' + JSON.stringify(map));

  // ไป-กลับผ่าน frontmatter แล้วต้องได้ค่าเดิมครบทุกชั้น
  const back = alignFromString(alignToString(map));
  if (JSON.stringify(back) !== JSON.stringify(map)) {
    throw new Error('align ไป-กลับไม่ตรง: ' + alignToString(map) + ' → ' + JSON.stringify(back));
  }
  const doc2 = mdToDoc('# หัว\n\n- หนึ่ง\n- สอง\n\n> ยกมา', back);
  const list2 = doc2.content.find((n) => n.type === 'bullet_list');
  const quote2 = doc2.content.find((n) => n.type === 'blockquote');
  if (doc2.content[0].attrs.align !== 'center') throw new Error('โหลดกลับ: หัวข้อไม่ได้ align');
  if (list2.content[1].content[0].attrs.align !== 'right') throw new Error('โหลดกลับ: ข้อในรายการไม่ได้ align');
  if (quote2.content[0].attrs.align !== 'justify') throw new Error('โหลดกลับ: คำพูดยกมาไม่ได้ align');
  if (list2.content[0].content[0].attrs && list2.content[0].content[0].attrs.align) {
    throw new Error('โหลดกลับ: ข้อที่ไม่ได้ตั้งกลับมีค่า');
  }
  // เรียงคีย์แบบพาธ: 2 ต้องมาก่อน 2.1.0 และ 2.1.0 ต้องมาก่อน 10
  const sorted = alignToString({ '10': 'center', '2.1.0': 'right', '2': 'center' });
  if (sorted !== '2:center, 2.1.0:right, 10:center') throw new Error('เรียงคีย์พาธผิด: ' + sorted);
  // คีย์เก่า (เลขตัวเดียว) ยังอ่านได้เหมือนเดิม
  if (alignFromString('3:center')['3'] !== 'center') throw new Error('คีย์เก่าอ่านไม่ได้');
}
console.log('alpha.103 align map (list / quote) OK');
