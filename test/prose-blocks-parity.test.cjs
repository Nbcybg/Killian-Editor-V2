// test/prose-blocks-parity.test.cjs — [alpha.159 · M7/M8] ตัวแปลง md → หน้ากระดาษ ต้องเห็นบล็อกชุดเดียวกัน
//   · mdToHtmlBody (ไฟล์จริง) · mdToProseBlocks (ช่องตัวอย่าง) · proseBlocksFromDoc (ตัวประมาณหน้าของตัวแก้ไข)
// กฎ AGENTS: "สองตัวแปลงต้องแก้คู่กัน" — เดิม mdToProseBlocks ไม่รู้จักตัวคั่นหน้าระหว่างฉาก (โชว์คอมเมนต์เป็นย่อหน้า)
// และทิ้งตัวเลือกของรูป · proseBlocksFromDoc ยุบรายการ/คำพูดยกมาทั้งก้อนเป็นบล็อกเดียว + ทิ้ง hard break
require('./_lang.cjs').installLang('th');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');
const tmp = path.join(os.tmpdir(), 'k2-pbparity.cjs');
esbuild.buildSync({
  stdin: { contents: "export * from './src/prose-format.js'; export { mdToHtmlBody, PAGE_BREAK } from './src/compile.js';"
         + "export { schema } from './src/editor.js';",
           resolveDir: path.join(__dirname, '..'), loader: 'js' },
  outfile: tmp, bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent',
});
const P = require(tmp);
const MD = require(path.join(__dirname, '..', 'src', 'md.js'));
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' | ' + extra : '')); }
}
const md = ['ย่อหน้าแรก', '', P.PAGE_BREAK, '', '> ยกหนึ่ง', '> ยกสอง', '', '![รูป](a.png "w=50%")', '',
            '- ข้อหนึ่ง', '- ข้อสอง', '- ข้อสาม', '', '## หัวข้อ', '', '<!--pagebreak-->', '', 'ท้าย'].join('\n');
const blocks = P.mdToProseBlocks(md);
const html = P.mdToHtmlBody(md);
const kinds = blocks.filter((b) => !(b.type === 'p' && !b.text)).map((b) => b.type);
// ชนิดบล็อกฝั่ง HTML ตามลำดับ (ย่อหน้าว่าง k-blank ไม่นับ · <p> ใน blockquote/li นับเป็นของมัน)
const htmlKinds = [];
let ctx = '';
for (const m of html.matchAll(/<(\/?)(blockquote|ul|ol|li|p|h[1-6]|figure|div)\b([^>]*)>/g)) {
  const [, close, tag, attrs] = m;
  if (tag === 'blockquote' || tag === 'ul' || tag === 'ol') { ctx = close ? '' : (tag === 'blockquote' ? 'blockquote' : 'li'); continue; }
  if (close || tag === 'li') continue;
  if (tag === 'div' && /class="pb"/.test(attrs)) { htmlKinds.push('pagebreak'); continue; }
  if (tag === 'p' && /k-blank/.test(attrs)) continue;
  if (tag === 'p') { htmlKinds.push(ctx || 'p'); continue; }
  if (tag === 'figure') { htmlKinds.push('figure'); continue; }
  if (/^h[1-6]$/.test(tag)) htmlKinds.push(tag);
}
check('[159-M7] ★★ ช่องตัวอย่างกับไฟล์จริงเห็นบล็อกชุดเดียวกัน (ชนิด+ลำดับ)', kinds.join() === htmlKinds.join(),
      kinds.join() + '  ||  ' + htmlKinds.join());
check('[159-M7] ★ ตัวคั่นหน้าระหว่างฉากเป็น pagebreak ไม่ใช่ข้อความคอมเมนต์', !blocks.some((b) => /<!--/.test(b.text || ''))
      && blocks.filter((b) => b.type === 'pagebreak').length === 2, JSON.stringify(blocks.filter((b) => /<!--|pagebreak/.test(b.text + b.type))));
const fig = blocks.find((b) => b.type === 'figure');
check('[159-M7] ★ รูปพาตัวเลือก (w=50%) ไปด้วย', !!fig && !!fig.imgOpts && /50/.test(JSON.stringify(fig.imgOpts)), JSON.stringify(fig));

// ── M8: เอกสาร ProseMirror จริง ──
const doc = P.schema.nodeFromJSON(MD.mdToDoc(['ย่อหน้า', '', '> ยกหนึ่ง', '> ยกสอง', '', '- ข้อหนึ่ง', '- ข้อสอง', '', 'บรรทัดหนึ่ง\\', 'บรรทัดสอง'].join('\n')));
const fb = P.proseBlocksFromDoc(doc);
const fk = fb.filter((b) => !(b.type === 'p' && !b.text));
check('[159-M8] ★ รายการ = หนึ่งบล็อกต่อข้อ (ไม่ยุบทั้งรายการ)', fk.filter((b) => b.type === 'li').map((b) => b.text).join('|') === 'ข้อหนึ่ง|ข้อสอง',
      JSON.stringify(fk));
check('[159-M8] ★ คำพูดยกมา = หนึ่งบล็อกต่อย่อหน้า', fk.filter((b) => b.type === 'blockquote').map((b) => b.text).join('|') === 'ยกหนึ่ง|ยกสอง',
      JSON.stringify(fk));
const hb = fk.find((b) => b.text.includes('บรรทัดหนึ่ง'));
check('[159-M8] ★ hard break = ขึ้นบรรทัดในข้อความ (ตัวประมาณนับบรรทัดถูก)', !!hb && hb.text === 'บรรทัดหนึ่ง\nบรรทัดสอง', JSON.stringify(hb));
check('[159-M8] ตำแหน่งของข้อในรายการชี้บล็อกข้อความจริงในเอกสาร', fk.filter((b) => b.type === 'li')
      .every((b) => doc.nodeAt(b.pos) && doc.nodeAt(b.pos).isTextblock && doc.nodeAt(b.pos).textContent === b.text));
const md8 = MD.docToMd(doc.toJSON());
const mk8 = P.mdToProseBlocks(md8).filter((b) => !(b.type === 'p' && !b.text)).map((b) => b.type).join();
check('[159-M8] ★★ ตัวประมาณของตัวแก้ไขกับช่องตัวอย่างเห็นชนิดบล็อกตรงกัน', fk.map((b) => b.type).join() === mk8,
      fk.map((b) => b.type).join() + ' || ' + mk8);
console.log(`\nprose-blocks-parity: ${pass} ผ่าน, ${fail} ล้มเหลว`);
process.exit(fail ? 1 : 0);
