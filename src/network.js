// Story Network — alpha.63r4 · Canvas 2D/3D with full feature set
import { T } from './i18n.js';
import { visualTagFor } from './visual-tags.js';
import { REL_COLOR, REL_TYPES, categorizeRole } from './relationship-types.js';
import { resolveNetColors, resolveNetControls, controlsHint, buttonIndex,
         netColorDefsOf, viewCenter, zoomAtCenter, axisVectors } from './network-theme.js';
import { state } from './core.js';
import { seedLayout, forceLayout, loadPositions, savePositions, clearPositions, nodeKey } from './network-layout.js';
import { ensureAutoLink, getBacklinksFor } from './world-story/auto-link-ui.js';

const CAT_ARR = ['characters','locations','items','lore','scene','chapter','book'];
// [alpha.73 ข้อ 3] **ห้ามมีเลขสีในไฟล์นี้อีก** — ทุกสีมาจาก network-theme.js ที่เดียว
// (เทส network-theme.test.cjs คอยกวาดไฟล์นี้หาเลข hex ที่หลุดมา)
export function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}
/** สีชุดปัจจุบัน — ตั้งใหม่ทุกครั้งที่ readColors() ทำงาน */
let THEME = resolveNetColors(null, cssVar);
const WIKI_CATS = new Set(['characters','locations','items','lore']);

// คีย์เส้นเชื่อม — ต้องอิง nodeKey ไม่ใช่ชื่อล้วน ไม่งั้นชื่อซ้ำข้ามหมวดทำให้เส้นหายไปเงียบ ๆ
const EDGE_SEP = String.fromCharCode(1);
function edgeKey(a, b) { const x = nodeKey(a), y = nodeKey(b); return x < y ? x + EDGE_SEP + y : y + EDGE_SEP + x; }

// [alpha.71 ข้อ 3] โหมดเครื่องมือของผัง — แทน "ดับเบิลคลิกเท่านั้น" + "ลากได้ตลอดเวลา" แบบเดิม
export const NET_TOOLS = [
  { id: 'open', icon: '👆', label: T`เปิด/ดู`, hint: T`คลิกโหนด = เปิดหน้านั้น · ลากพื้นที่ว่างหรือลากทับโหนด = เลื่อนผัง (โหนดไม่ขยับ)` },
  { id: 'edit', icon: '✎', label: T`แก้ไข`, hint: T`คลิกโหนด = เปิดหน้านั้นไปแก้ไข` },
  { id: 'move', icon: '✥', label: T`ย้ายตำแหน่ง`, hint: T`ลากโหนดเพื่อย้ายตำแหน่ง` },
];

function tagStyle(n) { for(const t of n.tags||[]){const v=visualTagFor(t);if(v)return v;} return null; }
function isStruct(n){return n.cat==='scene'||n.cat==='chapter'||n.cat==='book'||n.cat==='section';}
function hexToRgba(hex, alpha){const h=hex.replace('#','');const r=parseInt(h.substring(0,2),16);const g=parseInt(h.substring(2,4),16);const b=parseInt(h.substring(4,6),16);return`rgba(${r},${g},${b},${alpha})`;}

// ── toolbar ──
function buildToolbar(pane, cb) {
  const bar=document.createElement('div');bar.className='net-toolbar';
  const tg=document.createElement('button');tg.className='net-tbar-toggle';tg.textContent='▼';tg.title=T`ซ่อน`;
  const bd=document.createElement('div');bd.className='net-tbar-body';let col=false;
  tg.onclick=()=>{col=!col;bd.style.display=col?'none':'';tg.textContent=col?'▶':'▼';};
  const ca=new Set(CAT_ARR.slice(0,4)),tf=new Set([...REL_TYPES.map(t=>t.key),'co-occur','scene-link','ent-scene']);
  const cr=document.createElement('div');cr.className='net-tbar-row';
  // ชิปหมวด: ชื่อ/คีย์มาจาก network-theme.js · สีถูกทาทีหลังโดย _paintToolbarColors()
  netColorDefsOf('nodes').filter(d=>CAT_ARR.slice(0,4).includes(d.id)).forEach(x=>{const b=document.createElement('button');b.className='net-tcat';b.dataset.cat=x.id;b.title=x.label;b.dataset.active='1';b.classList.add('on');b.textContent=x.label;b.onclick=()=>{const a=b.dataset.active==='1';b.dataset.active=a?'0':'1';if(a)b.classList.remove('on');else b.classList.add('on');if(a)ca.delete(x.id);else ca.add(x.id);cb.filter(ca,tf);};cr.appendChild(b);});
  const tr=document.createElement('div');tr.className='net-tbar-row net-tbar-types';
  REL_TYPES.forEach(t=>{const b=document.createElement('button');b.className='net-ttype';b.dataset.type=t.key;b.title=t.label;b.dataset.active='1';b.classList.add('on');b.onclick=()=>{const a=b.dataset.active==='1';b.dataset.active=a?'0':'1';if(a)b.classList.remove('on');else b.classList.add('on');if(a)tf.delete(t.key);else tf.add(t.key);cb.filter(ca,tf);};tr.appendChild(b);});
  (()=>{const b=document.createElement('button');b.className='net-ttype net-ttype-co';b.dataset.type='co-occur';b.title=T`ปรากฏร่วม`;b.dataset.active='1';b.classList.add('on');b.onclick=()=>{const a=b.dataset.active==='1';b.dataset.active=a?'0':'1';if(a)b.classList.remove('on');else b.classList.add('on');if(a)tf.delete('co-occur');else tf.add('co-occur');cb.filter(ca,tf);};tr.appendChild(b);})();
  (()=>{const b=document.createElement('button');b.className='net-ttype net-ttype-sc';b.dataset.type='scene-link';b.title=T`ลิงก์ฉาก`;b.dataset.active='1';b.classList.add('on');b.onclick=()=>{const a=b.dataset.active==='1';b.dataset.active=a?'0':'1';if(a)b.classList.remove('on');else b.classList.add('on');if(a)tf.delete('scene-link');else tf.add('scene-link');cb.filter(ca,tf);};tr.appendChild(b);})();
  (()=>{const b=document.createElement('button');b.className='net-ttype net-ttype-es';b.dataset.type='ent-scene';b.title=T`เอนทิตี้↔ฉาก`;b.dataset.active='1';b.classList.add('on');b.onclick=()=>{const a=b.dataset.active==='1';b.dataset.active=a?'0':'1';if(a)b.classList.remove('on');else b.classList.add('on');if(a)tf.delete('ent-scene');else tf.add('ent-scene');cb.filter(ca,tf);};tr.appendChild(b);})();
  const sw=document.createElement('div');sw.className='net-tbar-search';
  const si=document.createElement('input');si.type='text';si.className='net-tbar-input';si.placeholder=T`🔍 ค้นหา…`;
  let tm;si.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>cb.search(si.value.trim()),200);};si.onkeydown=e=>{if(e.key==='Enter')cb.search(si.value.trim());};sw.appendChild(si);
  const gridRow=document.createElement('div');gridRow.className='net-tbar-row';
  const gridBtn=document.createElement('button');gridBtn.className='net-tbar-btn net-tog on';gridBtn.textContent='📐';gridBtn.title=T`แสดง grid`;
  const gridSize=document.createElement('input');gridSize.type='range';gridSize.className='net-grid-slider';gridSize.min='20';gridSize.max='120';gridSize.value='60';gridSize.title=T`ขนาด grid: 60px`;
  gridBtn.onclick=()=>{cb.toggleGrid();gridBtn.classList.toggle('on');};
  gridSize.oninput=()=>{cb.setGridPx(Number(gridSize.value));gridSize.title=T`ขนาด grid: `+gridSize.value+'px';};
  const gridAlpha=document.createElement('input');gridAlpha.type='range';gridAlpha.className='net-grid-slider';gridAlpha.min='1';gridAlpha.max='100';gridAlpha.value='12';gridAlpha.title=T`โปร่งใส grid: 12%`;
  gridAlpha.oninput=()=>{cb.setGridAlpha(Number(gridAlpha.value)/100);gridAlpha.title=T`โปร่งใส grid: `+gridAlpha.value+'%';};
  gridRow.append(gridBtn,gridSize,gridAlpha);
  // ── [alpha.71 ข้อ 3] แถวเครื่องมือ: แสดงตัวหนังสือ · เปิด/แก้ไข/ย้าย · ขยาย-ย่อโหนด ──
  // เดิมคลิกโหนดไม่ทำอะไร (ต้องดับเบิลคลิก) และลากได้ตลอดเวลา → เผลอลากทั้งผังโดยไม่ตั้งใจบ่อย
  const toolRow=document.createElement('div');toolRow.className='net-tbar-row net-tbar-tools';
  const lblBtn=document.createElement('button');
  lblBtn.className='net-tbar-btn net-tog on net-lbl-btn';lblBtn.textContent='🔤';lblBtn.title=T`แสดงตัวหนังสือ (ชื่อใต้โหนด)`;
  lblBtn.onclick=()=>{lblBtn.classList.toggle('on');cb.toggleLabels();};
  toolRow.appendChild(lblBtn);
  const sep=document.createElement('span');sep.className='net-tbar-sep';toolRow.appendChild(sep);
  const toolBtns=[];
  for(const x of NET_TOOLS){
    const b=document.createElement('button');
    b.className='net-tbar-btn net-tool-btn'+(x.id==='open'?' on':'');
    b.dataset.tool=x.id;b.textContent=x.icon;b.title=x.label+' — '+x.hint;
    b.onclick=()=>{for(const o of toolBtns)o.classList.toggle('on',o===b);cb.setTool(x.id);};
    toolBtns.push(b);toolRow.appendChild(b);
  }
  const sep2=document.createElement('span');sep2.className='net-tbar-sep';toolRow.appendChild(sep2);
  const szLbl=document.createElement('span');szLbl.className='net-tbar-lbl';szLbl.textContent='⦿';szLbl.title=T`ขนาดโหนด`;
  const size=document.createElement('input');size.type='range';size.className='net-grid-slider net-size-slider';
  size.min='50';size.max='250';size.value='100';size.title=T`ขนาดโหนด: 100%`;
  size.oninput=()=>{cb.setNodeScale(Number(size.value)/100);size.title=T`ขนาดโหนด: `+size.value+'%';};
  toolRow.append(szLbl,size);

  const btns=document.createElement('div');btns.className='net-tbar-actions';
  [{t:'🔄',ti:T`รีเฟรช`,f:cb.refresh},{t:'📌',ti:T`ปลดหมุดทุกโหนด แล้วจัดผังใหม่`,f:cb.relayout},{t:'🖼',ti:T`แสดงรูปย่อ`,f:cb.toggleImages,cl:'net-tog on'},{t:'🗺',ti:'Minimap',f:cb.toggleMinimap,cl:'net-tog'},{t:'3D',ti:T`สลับ 2D/3D`,f:cb.toggle3D,cl:'net-tog'},{t:'📥',ti:T`ส่งออก`,f:cb.export},{t:'⤾',ti:T`รีเซ็ต`,f:cb.reset,cl:'net-reset'}].forEach(x=>{const b=document.createElement('button');b.className='net-tbar-btn'+(x.cl?' '+x.cl:'');b.textContent=x.t;b.title=x.ti;b.onclick=()=>{if(x.cl==='net-tog'){b.classList.toggle('on');}else if(x.cl==='net-tog on'){b.classList.toggle('on');}x.f();};btns.appendChild(b);});
  bd.append(cr,tr,toolRow,gridRow,sw,btns);bar.append(tg,bd);pane.appendChild(bar);
  return {bar,btns,toolRow,destroy:()=>bar.remove()};
}

// ═════ 3D projection (pure world coordinates, no scale/center — canvas transform handles that) ═════
function project3D(x, y, z, rx, ry) {
  const cosX = Math.cos(rx), sinX = Math.sin(rx);
  const cosY = Math.cos(ry), sinY = Math.sin(ry);
  let px = x * cosY + z * sinY;
  let py = y * cosX - (x * -sinY + z * cosY) * sinX;
  return { x: px, y: py, zDepth: x * -sinY + z * cosY };
}

// ═════ draw rounded rect with dark background ═════
function drawLabelBox(c, text, cx, cy, fontSize) {
  c.font = fontSize + 'px "Segoe UI","Leelawadee UI",sans-serif';
  const m = c.measureText(text);
  const tw = m.width + 12, th = fontSize + 10;
  const x = cx - tw / 2, y = cy - th / 2, r = 6;
  c.fillStyle = 'rgba(0,0,0,0.82)';
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + tw - r, y);
  c.quadraticCurveTo(x + tw, y, x + tw, y + r);
  c.lineTo(x + tw, y + th - r);
  c.quadraticCurveTo(x + tw, y + th, x + tw - r, y + th);
  c.lineTo(x + r, y + th);
  c.quadraticCurveTo(x, y + th, x, y + th - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath(); c.fill();
  c.fillStyle = THEME.canvas.label; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, cx, cy + 1);
  return { w: tw + 4, h: th + 4 };
}

function drawEdgeLabel(c, text, x, y, fontSize) {
  c.font = fontSize + 'px "Segoe UI","Leelawadee UI",sans-serif';
  const m = c.measureText(text); const tw = m.width + 10, th = fontSize + 8;
  const bx = x - tw / 2, by = y - th / 2, r = 4;
  c.fillStyle = 'rgba(0,0,0,0.85)'; c.beginPath();
  c.moveTo(bx + r, by); c.lineTo(bx + tw - r, by);
  c.quadraticCurveTo(bx + tw, by, bx + tw, by + r);
  c.lineTo(bx + tw, by + th - r);
  c.quadraticCurveTo(bx + tw, by + th, bx + tw - r, by + th);
  c.lineTo(bx + r, by + th);
  c.quadraticCurveTo(bx, by + th, bx, by + th - r);
  c.lineTo(bx, by + r); c.quadraticCurveTo(bx, by, bx + r, by);
  c.closePath(); c.fill();
  c.fillStyle = THEME.canvas.label; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, x, y + 1);
}

function buildMinimap(pane) {
  const mc = document.createElement('canvas'); mc.className = 'net-minimap'; mc.width = 160; mc.height = 120;
  pane.appendChild(mc); return mc;
}
function buildStatusBar(pane) {
  const sb = document.createElement('div'); sb.className = 'net-status';
  pane.appendChild(sb); return sb;
}
function buildTipBar(pane) {
  const tb = document.createElement('div'); tb.className = 'net-tip';
  tb.textContent = T`🖱 ลากพื้น=เลื่อน · ล้อ=ซูม · ลากโหนด=ย้าย · Shift+คลิก=ผลัก · ดับเบิลคลิก=เปิด · คลิกขวา=เมนู`;
  pane.appendChild(tb); return tb;
}

// ═════ StoryNetwork ═════
export class StoryNetwork {
  constructor(pane, { loadEntities, onOpen=null, onOpenScene=null, onReveal=null,
                       onDeleteStruct=null, onRenameStruct=null, onDuplicateStruct=null, onAddChild=null }) {
    this.pane=pane; this.onOpen=onOpen; this.onOpenScene=onOpenScene; this.onReveal=onReveal;
    this.onDeleteStruct=onDeleteStruct; this.onRenameStruct=onRenameStruct;
    this.onDuplicateStruct=onDuplicateStruct; this.onAddChild=onAddChild;
    this.loadEntities=loadEntities;
    this.title='Story Network'; this.dirty=false;
    this.nodes=[];this.edges=[];this.drag=null;
    this._scale=1;this._cx=0;this._cy=0;
    this._hoverNode=null;
    this._catFilter=new Set(CAT_ARR.slice(0,4));
    this._typeFilter=new Set([...REL_TYPES.map(t=>t.key),'co-occur','scene-link','ent-scene']);
    this._searchQuery='';
    this._mode3D=false; this._rx=0.4; this._ry=-0.3;
    this._showImages=true; this._showMinimap=false;
    this._showGrid=true; this._gridPx=60; this._gridAlpha=0.12;
    this._orbitDrag=null;
    // [alpha.71 ข้อ 3] เครื่องมือ + ป้ายชื่อ + ขนาดโหนด
    this._tool='open'; this._showLabels=true; this._nodeScale=1;

    this.canvas=document.createElement('canvas');
    this.canvas.className='net-canvas';
    pane.appendChild(this.canvas);

    this.canvas.addEventListener('mousedown',e=>this._down(e));
    this.canvas.addEventListener('mousemove',e=>this._move(e));
    this._upDoc=e=>this._up(e);
    document.addEventListener('mouseup',this._upDoc);
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();this._zoom(e);});
    this.canvas.addEventListener('contextmenu',e=>{e.preventDefault();this._ctxMenu(e);});
    this.canvas.addEventListener('dblclick',e=>{e.preventDefault();const{node}=this._hit(e);if(!node)return;const st=isStruct(node);if(st&&this.onOpenScene)this.onOpenScene(node.file);else if(!st&&this.onOpen)this.onOpen(node);});

    this._resize=()=>{this._fit();this.draw();};
    window.addEventListener('resize',this._resize);
    if(typeof ResizeObserver!=='undefined'){
      this._ro=new ResizeObserver(()=>{try{this._fit();this.draw();this._updateMinimap();}catch{}});
      this._ro.observe(pane);
    }

    const self=this;
    this._tb=buildToolbar(pane,{
      // buildToolbar ส่ง Set ตัวเดิมกลับมาทุกครั้ง (แก้ในที่) → ต้องล้าง cache เอง
      filter(ca,tf){self._catFilter=ca;self._typeFilter=tf;self._vfCache=null;self.draw();},
      search(q){self._searchQuery=q;self.draw();},
      refresh(){self.refresh();},
      relayout(){self.relayout();},
      toggleImages(){self._showImages=!self._showImages;self.draw();},
      toggleLabels(){self._showLabels=!self._showLabels;self.draw();},
      setTool(id){self._tool=id;self.canvas.classList.toggle('net-move-mode',id==='move');self.draw();},
      setNodeScale(v){self._nodeScale=Math.max(0.5,Math.min(2.5,v||1));self.draw();},
      toggleMinimap(){self._showMinimap=!self._showMinimap;self._mm.style.display=self._showMinimap?'':'none';self._updateMinimap();},
      toggle3D(){self._mode3D=!self._mode3D;self._fit();self.draw();if(self._showMinimap)self._updateMinimap();},
      toggleGrid(){self._showGrid=!self._showGrid;self.draw();},
      setGridPx(v){self._gridPx=v;self.draw();},
      setGridAlpha(v){self._gridAlpha=v;self.draw();},
      export(){self.draw();const d=self.canvas.toDataURL('image/png');const a=document.createElement('a');a.download='story-network.png';a.href=d;document.body.appendChild(a);a.click();document.body.removeChild(a);},
      reset(){self._scale=1;self._cx=0;self._cy=0;self._rx=0.4;self._ry=-0.3;self.draw();if(self._showMinimap)self._updateMinimap();},
    });

    this._mm = buildMinimap(pane); this._mm.style.display = 'none';
    this._sb = buildStatusBar(pane);
    this._tip = buildTipBar(pane);

    this._fit(); this.readColors(); this.draw(); this.refresh();
  }

  readColors(){
    // [alpha.73 ข้อ 3] สีทุกสีมาจากนิยามกลางที่เดียว (network-theme.js)
    // รับค่ารูปแบบเก่า (netColors.cats/.edges) ได้เองผ่าน normalizeNetColors
    THEME = resolveNetColors(state.settings && state.settings.netColors, cssVar);
    this._catCol = THEME.node;
    this._edgeCol = THEME.edge;
    this._bg = THEME.canvas.bg;
    this._grid = THEME.canvas.grid;
    this._controls = resolveNetControls(state.settings && state.settings.netControls);
    this._vfCache=null;
    this._paintToolbarColors();
    this._syncTip();
  }

  /** คำอธิบายใต้ผัง — สร้างจากค่าที่ตั้งไว้จริง (ข้อ 2: tooltip ต้อง sync กับ setting) */
  _syncTip(){
    if(!this._tip)return;
    this._tip.textContent = controlsHint(this._controls, this._mode3D);
  }

  /**
   * [alpha.72 ข้อ 2] ทาสีปุ่มบนแถบเครื่องมือให้ตรงกับสีที่ตั้งไว้จริง
   * ของเดิม buildToolbar ฝังเลขสีไว้ในโค้ดอีกชุด → เปลี่ยนสีในตั้งค่าแล้วชิปยังเป็นสีเก่า
   * ผู้ใช้จึงเห็น "สีบนผังกับสีในแถบเครื่องมือไม่ตรงกัน"
   */
  _paintToolbarColors(){
    if(!this._tb||!this._tb.bar)return;
    for(const b of this._tb.bar.querySelectorAll('.net-tcat[data-cat]')){
      const col=this._catCol[b.dataset.cat];
      if(col)b.style.setProperty('--tcolor',col);
    }
    for(const b of this._tb.bar.querySelectorAll('.net-ttype[data-type]')){
      const col=this._edgeCol[b.dataset.type];
      if(col)b.style.setProperty('--tcolor',col);
    }
  }

  /** โปรเจกต์ที่ผังนี้เป็นของ — ใช้แยก localStorage ของตำแหน่งโหนด */
  _scope(){ return state.root || ''; }

  async refresh() {
    try {
      this._sb && (this._sb.textContent = T`กำลังโหลด…`);
      const ents=await this.loadEntities();
      if (!ents || !Array.isArray(ents)) { this._sb && (this._sb.textContent = T`โหลดผิดพลาด`); return; }
      if (!ents.length) { this._sb && (this._sb.textContent = T`ไม่พบเอนทิตี้ — สร้างตัวละคร/สถานที่ใน Wiki ก่อน`); this.draw(); this._updateStatus(); return; }
      const W=Math.max(600,this.pane.clientWidth||900);
      const H=Math.max(400,this.pane.clientHeight||600);
      const D = this._mode3D ? 400 : 0;
      const pos=loadPositions(this._scope());
      this.nodes = ents.map((e)=>({...e, x:0,y:0,z:0}));
      seedLayout(this.nodes,pos,{width:W,height:H,depth:D||400});
      // ความสัมพันธ์อ้างถึงกันด้วย "ชื่อ" → ถ้าชื่อซ้ำข้ามหมวด ให้เอนทิตี้ Wiki ชนะฉาก/บทเสมอ
      const byName={};
      for(const n of this.nodes){
        const cur=byName[n.name];
        if(!cur||(WIKI_CATS.has(n.cat)&&!WIKI_CATS.has(cur.cat)))byName[n.name]=n;
      }
      this.edges=[];const seen=new Set();
      for(const n of this.nodes){for(const r of n.relationships||[]){const t=byName[r.targetName||r.target];if(!t||t===n)continue;const k=edgeKey(n,t);if(seen.has(k))continue;seen.add(k);this.edges.push({a:n,b:t,role:r.role||'',type:r.type||categorizeRole(r.role)});}}
      await this._loadCoOccur(byName,seen);
      this._linkStructNodes(byName,seen);
      // [alpha.73 ข้อ 1] จัดผังเฉพาะ "โหนดที่ยังไม่เคยมีตำแหน่ง" (เอนทิตี้ที่เพิ่งสร้าง)
      // โหนดที่มีตำแหน่งบันทึกไว้แล้วถือว่าตรึงไว้หมด → กดรีเฟรชกี่ครั้งผังก็หน้าตาเดิม
      // (ของเดิมปล่อยให้ forceLayout ขยับทุกตัวที่ไม่ได้ถูกลาก = ผังเปลี่ยนทุกครั้งที่รีเฟรช)
      const fresh=this.nodes.filter(n=>n._fresh);
      if(fresh.length){
        const frozen=new Set(this.nodes.filter(n=>!n._fresh));
        forceLayout(this.nodes,this.edges,{width:W,height:H,depth:D||400,iters:280,pinned:frozen});
      }
      // บันทึกทุกครั้ง — ตำแหน่งของทุกโหนดต้องอยู่ถาวร ไม่ใช่เฉพาะตัวที่ลาก
      savePositions(this.nodes,this._scope());
      this._vfCache=null;
      this._fit();this.draw();this._updateMinimap();
    }catch(e){console.error('SN refresh error:',e?.message||e);}
  }

  async _loadCoOccur(byName,seen) {
    try {
      const root=state.root;if(!root)return;
      const bl=(state.meta&&state.meta.backlinks)||{};
      const hasBl=Object.keys(bl).length>0;
      if(hasBl){
        const byFile={};
        for(const n of this.nodes){let rel=n.file;if(rel.startsWith(root))rel=rel.slice(root.length);rel=rel.replace(/^[/\\]+/,'').replace(/\\/g,'/');byFile[rel]=n;const p=rel.split('/');if(p.length>=2&&(p[0]==='Wiki'||p[0]==='Bible')){const nr=p.slice(1).join('/');if(!byFile[nr])byFile[nr]=n;}}
        // เก็บโหนดคู่ไว้ตรง ๆ — ของเดิมต่อคีย์เป็นสตริงแล้ว split('|') ทีหลัง ซึ่งพังทันทีถ้าชื่อมี '|'
        const pairs=new Map();const keys=Object.keys(bl);
        for(let i=0;i<keys.length;i++){const a=byFile[keys[i]];if(!a)continue;const aS=new Set(bl[keys[i]]);
          for(let j=i+1;j<keys.length;j++){const b=byFile[keys[j]];if(!b||a===b)continue;const sh=bl[keys[j]].filter(s=>aS.has(s)).length;if(sh<2)continue;
            const k=edgeKey(a,b);if(seen.has(k))continue;
            const prev=pairs.get(k);if(!prev||sh>prev.count)pairs.set(k,{a,b,count:sh});}}
        for(const[k,{a,b,count}] of pairs){seen.add(k);this.edges.push({a,b,role:'co-occur '+count,type:'co-occur'});}
        const bySid={};
        for(const n of this.nodes){if(n.cat==='scene'&&n.sid){const s=String(n.sid).toLowerCase();if(!bySid[s])bySid[s]=[];bySid[s].push(n);}}
        if(Object.keys(bySid).length){
          for(const[k,scenes] of Object.entries(bl)){
            const ent=byFile[k];if(!ent||ent.cat==='scene'||ent.cat==='chapter'||ent.cat==='section')continue;
            const scArr=[];
            for(const scId of scenes){const sn=bySid[String(scId).toLowerCase()];if(sn)scArr.push(...sn);}
            for(const sn of scArr){
              const ek=edgeKey(ent,sn)+'+esc';if(seen.has(ek))continue;
              seen.add(ek);this.edges.push({a:ent,b:sn,role:T`กล่าวถึง`,type:'ent-scene'});
            }
          }
        }
      }
      await this._linkEntToScenes(byName,seen);
    }catch{}
  }

  async _linkEntToScenes(byName,seen){
    await ensureAutoLink();
    const ents=this.nodes.filter(n=>WIKI_CATS.has(n.cat||''));
    const scs=this.nodes.filter(n=>n.cat==='scene');
    if(!ents.length||!scs.length)return;
    const bySid={};
    for(const n of scs){
      if(n.sid){const s=String(n.sid).toLowerCase();if(!bySid[s])bySid[s]=[];bySid[s].push(n);}
    }
    for(const ent of ents){
      if(!ent.file)continue;
      const bks=getBacklinksFor(ent.file);
      if(!bks||!bks.length)continue;
      for(const bk of bks){
        const sns=bySid[String(bk.sceneId).toLowerCase()];
        if(!sns)continue;
        for(const sn of sns){
          const ek=edgeKey(ent,sn)+'+esc';
          if(seen.has(ek))continue;
          seen.add(ek);
          this.edges.push({a:ent,b:sn,role:T`กล่าวถึง`,type:'ent-scene'});
        }
      }
    }
  }

  _linkStructNodes(byName,seen) {
    const scs=this.nodes.filter(n=>n.cat==='scene');
    const chs=this.nodes.filter(n=>n.cat==='chapter');
    for(const s of scs){
      const chId=(s.chapterId||s.ch||'').toLowerCase();
      const ch=chs.find(c=>(c.name||'').toLowerCase()===chId||(c.chName||'').toLowerCase()===chId);
      if(!ch)continue;
      const k=edgeKey(s,ch);if(seen.has(k))continue;
      seen.add(k);this.edges.push({a:s,b:ch,role:T`อยู่ใน`,type:'scene-link'});
    }
    const secs=this.nodes.filter(n=>n.cat==='section');
    for(const ch of chs){
      if(!ch.sectionName)continue;
      const sec=secs.find(s=>(s.name||'').toLowerCase()===ch.sectionName.toLowerCase());
      if(!sec)continue;
      const k=edgeKey(ch,sec);if(seen.has(k))continue;
      seen.add(k);this.edges.push({a:ch,b:sec,role:T`อยู่ใน`,type:'scene-link'});
    }
  }

  /**
   * [alpha.72 ข้อ 1] ขนาดผืนวาดต้องเท่ากับกล่อง CSS "เป๊ะ ๆ"
   * ของเดิม `Math.max(300, r.width)` ตั้งพื้นไว้ที่ 300 → พอแผงแคบกว่านั้น (แผงข้างกว้าง ~200)
   * ผืนวาดภายในกว้าง 300 แต่ถูกยืดลงมาแสดงที่ 200 = **บีบแนวนอน 2/3 ทั้งผัง**
   * โหนดวงกลมจึงกลายเป็นวงรี และรูปประจำตัวหน้าแบนผิดสัดส่วน (เห็นชัดตอนรูปเริ่มขึ้นใน .71)
   * แผงที่ยังไม่มีขนาด (ซ่อนอยู่) = ข้ามไป ไม่ตั้งเป็น 0 (จะล้างภาพทิ้งเปล่า ๆ)
   */
  _fit() {
    const r=this.pane.getBoundingClientRect();
    const w=Math.round(r.width),h=Math.round(r.height);
    if(w<2||h<2)return;
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  }

  draw() {
    const c=this.canvas.getContext('2d');const w=this.canvas.width,h=this.canvas.height;
    if(!w||!h)return;
    c.clearRect(0,0,w,h);c.fillStyle=this._bg||BG_FALLBACK;c.fillRect(0,0,w,h);
    c.save();
    // unified transform: both 2D and 3D use same _cx,_cy,_scale
    c.translate(this._cx,this._cy);c.scale(this._scale,this._scale);

    if(!this.nodes.length){
      c.restore();c.fillStyle=THEME.canvas.axis;c.font='15px sans-serif';c.textAlign='center';
      c.fillText(T`ยังไม่มีเอนทิตี้ใน Wiki`,w/2,h/2-10);c.font='12px sans-serif';
      c.fillText(T`สร้างตัวละคร/สถานที่/ไอเทม/ตำนานใน Wiki`,w/2,h/2+14);
      this._updateStatus();return;
    }

    // grid — extent accounts for camera offset + scale
    if(this._showGrid){
      const viewW=w/this._scale,viewH=h/this._scale;
      const cx=-this._cx/this._scale,cy=-this._cy/this._scale;
      const ext=Math.max(viewW,viewH)*2+Math.max(Math.abs(cx),Math.abs(cy))*1.5;
      c.strokeStyle=this._grid||GRID_FALLBACK;c.lineWidth=0.4;c.globalAlpha=this._gridAlpha;c.beginPath();
      for(let x=-ext;x<=ext;x+=this._gridPx){c.moveTo(x,-ext);c.lineTo(x,ext);}
      for(let y=-ext;y<=ext;y+=this._gridPx){c.moveTo(-ext,y);c.lineTo(ext,y);}
      c.stroke();c.globalAlpha=1;
    }
    c.font='11px "Segoe UI","Leelawadee UI",sans-serif';

    const at=this._typeFilter.size===REL_TYPES.length+3;
    const {q,m,visible}=this._visFilter();

    const visNodes = []; const visSet = new Set();
    for(const n of this.nodes){
      if(!visible(n))continue;
      visNodes.push(n); visSet.add(n);
    }

    const proj = new Map();
    if(this._mode3D){
      for(const n of this.nodes){
        proj.set(n, project3D(n.x,n.y,n.z||0,this._rx,this._ry));
      }
    }

    const px=(n)=>{if(this._mode3D){const p=proj.get(n);return p?p.x:n.x;}return n.x;};
    const py=(n)=>{if(this._mode3D){const p=proj.get(n);return p?p.y:n.y;}return n.y;};
    const pz=(n)=>{if(this._mode3D){const p=proj.get(n);return p?p.zDepth:0;}return 0;};

    const sortedEdges=this._mode3D
      ?[...this.edges].sort((a,b)=>((pz(a.a)+pz(a.b))-(pz(b.a)+pz(b.b))))
      :this.edges;

    // edges
    for(const e of sortedEdges){
      const aVis=visSet.has(e.a),bVis=visSet.has(e.b);
      if(!aVis&&!bVis)continue;
      let alpha=at||this._typeFilter.has(e.type)?1:0.08;
      // สีมาจาก _edgeCol เท่านั้น — ของเดิมเขียนทับด้วยค่าคงที่ตรงนี้ สีที่ผู้ใช้ตั้งไว้เลยไม่เคยมีผล
      const color=this._edgeCol[e.type]||THEME.canvas.grid;let lw=2.0;
      if(e.type==='co-occur'){lw=1.2;if(alpha===1)alpha=0.5;c.setLineDash([4,3]);}
      else if(e.type==='scene-link'){lw=1.6;if(alpha===1)alpha=0.7;c.setLineDash([3,4]);}
      else if(e.type==='ent-scene'){lw=1.4;if(alpha===1)alpha=0.55;c.setLineDash([5,4,2,4]);}
      else c.setLineDash([]);
      const isHover=this._hoverNode&&(e.a===this._hoverNode||e.b===this._hoverNode);
      // สีเส้นเป็น hex → ต้องแปลงเป็น rgba ก่อน (ของเดิมต่อสตริงจนได้ค่าที่ Canvas อ่านไม่ออก เงาเลยไม่ขึ้น)
      if(isHover){lw=3.2;alpha=1;c.shadowColor=hexToRgba(color,0.55);c.shadowBlur=10;}
      c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=lw;
      c.beginPath();c.moveTo(px(e.a),py(e.a));c.lineTo(px(e.b),py(e.b));c.stroke();c.setLineDash([]);c.shadowBlur=0;
      if(e.role&&alpha>0.3){
        const mx=(px(e.a)+px(e.b))/2,my=(py(e.a)+py(e.b))/2;
        drawEdgeLabel(c,e.role,mx,my-10,isHover?11:9);
      }
      c.globalAlpha=1;
    }

    const sortedNodes=this._mode3D?[...visNodes].sort((a,b)=>pz(b)-pz(a)):visNodes;

    for(const n of sortedNodes){
      const vt=tagStyle(n);
      const isHov=n===this._hoverNode;
      const struct=isStruct(n);
      // [alpha.71 ข้อ 3] ขนาดโหนดคูณด้วยสเกลที่ผู้ใช้ตั้ง (ปุ่มขยาย/ย่อ entities)
      const ns=this._nodeScale||1;
      const baseR=(struct?10:14)*ns;
      const degree=this.edges.filter(e=>e.a===n||e.b===n).length;
      let r=Math.max(baseR,Math.min(28*ns,baseR+degree*0.6*ns));
      if(isHov)r+=4;

      const nx=px(n),ny=py(n);
      const col=this._catCol[n.cat]||THEME.edge['ent-scene'];

      // glow on hover — use node's own category color
      if(isHov){
        c.beginPath();c.arc(nx,ny,r+12,0,Math.PI*2);
        const glow=c.createRadialGradient(nx,ny,r,nx,ny,r+14);
        glow.addColorStop(0,hexToRgba(col,0.45));glow.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=glow;c.fill();
        c.shadowColor=hexToRgba(col,0.6);c.shadowBlur=14;
      }

      // [alpha.72 ข้อ 1] ลำดับการวาดของเดิมผิด: วาดรูปย่อก่อน แล้ว **เติมสีวงกลมทับลงไป**
      // ตอนที่รูปไม่เคยขึ้น (บั๊ก .71) เลยไม่มีใครเห็น — พอรูปมาจริงก็โดนกลบหมดทันที
      // ลำดับที่ถูก: พื้นวงกลม → รูป (ครอบวงกลม) → ขอบ · และวงแหวนป้ายกำกับต้องอยู่ "นอก" ตัวโหนด
      const hasImg=this._showImages&&n.image&&n._img&&!struct;
      if(vt){c.beginPath();c.fillStyle=vt.color;c.arc(nx,ny,r+3.5,0,Math.PI*2);c.fill();}

      if(struct){
        const sw2=r*1.6,sh2=r*1.4;
        c.fillStyle=col;c.fillRect(nx-sw2/2,ny-sh2/2,sw2,sh2);
        c.strokeStyle=isHov?THEME.canvas.hover:THEME.canvas.border;
        c.lineWidth=isHov?3:2;c.strokeRect(nx-sw2/2,ny-sh2/2,sw2,sh2);
      }else{
        c.beginPath();c.fillStyle=col;c.arc(nx,ny,r,0,Math.PI*2);c.fill();
        if(hasImg){
          // ครอบรูปให้พอดีวงกลม + คงสัดส่วน (ของเดิมยืดรูปสี่เหลี่ยมให้เป็นจัตุรัสจนหน้าเบี้ยว)
          const iw=n._img.naturalWidth||1, ih=n._img.naturalHeight||1;
          const side=Math.min(iw,ih);
          const sxi=(iw-side)/2, syi=(ih-side)/2;
          c.save();c.beginPath();c.arc(nx,ny,r-1,0,Math.PI*2);c.clip();
          c.drawImage(n._img,sxi,syi,side,side,nx-r+1,ny-r+1,(r-1)*2,(r-1)*2);
          c.restore();
        }
        // ขอบวาดหลังรูปเสมอ → รูปไม่ล้นออกนอกวง และขอบไม่ถูกรูปทับ
        c.beginPath();c.arc(nx,ny,r,0,Math.PI*2);
        c.strokeStyle=hasImg?col:(isHov?THEME.canvas.hover:THEME.canvas.border);
        c.lineWidth=hasImg?3:(isHov?3:2);c.stroke();
        if(hasImg&&isHov){c.beginPath();c.arc(nx,ny,r+2,0,Math.PI*2);
          c.strokeStyle=THEME.canvas.hover;c.lineWidth=2;c.stroke();}
      }
      c.shadowBlur=0;

      if(q&&m.has(n)&&!this._rafId){
        c.beginPath();c.strokeStyle=THEME.edge.ally;c.lineWidth=3;c.globalAlpha=0.5+Math.sin(performance.now()*0.005)*0.5;
        c.arc(nx,ny,r+6,0,Math.PI*2);c.stroke();c.globalAlpha=1;
      }

      // ป้ายชื่อ — ปิดได้ด้วยปุ่ม 🔤 (ผังใหญ่ ๆ ตัวหนังสือทับกันจนอ่านโครงไม่ออก)
      // ตอนชี้เมาส์ยังโชว์เสมอ ไม่งั้นปิดป้ายแล้วหาโหนดที่ต้องการไม่เจอเลย
      if(this._showLabels||isHov){
        const label=(vt&&vt.icon?vt.icon+' ':'')+(n.name.length>20?n.name.slice(0,19)+'…':n.name);
        drawLabelBox(c,label,nx,ny+r+12+4,isHov?11:9);
      }
    }

    c.restore();
    this._drawAxis(c);
    this._updateStatus();
    if(q&&m.size&&!this._rafId)this._rafId=requestAnimationFrame(()=>{this._rafId=null;this.draw();});
  }

  /**
   * [alpha.73 ข้อ 4] แกนบอกทิศที่มุมล่างซ้ายของผัง
   * เดิมมีแต่ตัวเลขบนแถบสถานะ ไม่มีอะไรบอกว่าแกนไหนชี้ไปทางไหน (โดยเฉพาะพอหมุน 3D)
   * ลูกศรหมุนตามมุมกล้องจริง ใช้สูตรฉายเดียวกับที่วาดโหนด (axisVectors)
   */
  _drawAxis(c){
    const w=this.canvas.width,h=this.canvas.height;
    if(w<160||h<120)return;                     // แผงแคบมาก ๆ ไม่ต้องวาดให้รก
    const ox=34,oy=h-34,len=22;
    const ax=axisVectors(this._rx,this._ry,this._mode3D);
    const axes=[['X',ax.x,THEME.node.characters],['Y',ax.y,THEME.node.items]];
    if(ax.z)axes.push(['Z',ax.z,THEME.node.locations]);
    c.save();
    c.globalAlpha=0.85;c.lineWidth=1.6;c.font='9px sans-serif';
    c.textAlign='center';c.textBaseline='middle';
    for(const [name,v,col] of axes){
      const ex=ox+v.x*len, ey=oy+v.y*len;
      c.strokeStyle=col;c.fillStyle=col;
      c.beginPath();c.moveTo(ox,oy);c.lineTo(ex,ey);c.stroke();
      c.beginPath();c.arc(ex,ey,2.2,0,Math.PI*2);c.fill();
      c.fillText(name,ox+v.x*(len+8),oy+v.y*(len+8));
    }
    c.fillStyle=THEME.canvas.axis;c.globalAlpha=0.6;
    c.beginPath();c.arc(ox,oy,2,0,Math.PI*2);c.fill();
    c.restore();
  }

  /**
   * [alpha.73 ข้อ 4] แถบสถานะเดิมโชว์ `_cx/_cy` = ระยะเลื่อนกล้องเป็น "พิกเซลบนจอ"
   * ไม่ใช่พิกัดของอะไรเลย (ซูมทีค่าก็เปลี่ยนทั้งที่ยังมองจุดเดิม) และเอามุมหมุนมาแปะป้ายว่า "Z"
   * ทั้งที่ Z คือแกนลึกของผัง ไม่ใช่องศา
   * ตอนนี้: X/Y/Z = **พิกัดโลกของจุดกึ่งกลางจอ** (ค่าเดียวกับที่โหนดใช้) · มุมหมุนแยกเป็น ↻
   */
  _updateStatus() {
    if(!this._sb)return;
    const structN=this.nodes.filter(n=>!WIKI_CATS.has(n.cat)).length;
    const st=structN?T` (+${structN} ฉาก/บท)`:'';
    const c=viewCenter({scale:this._scale,cx:this._cx,cy:this._cy},this.canvas.width,this.canvas.height);
    const zc=this._mode3D?this._viewZ():0;
    this._sb.textContent=T`⦿ ${this.nodes.length}${st} · ${this.edges.length} เส้น · `+
      `X ${Math.round(c.x)} · Y ${Math.round(c.y)} · Z ${Math.round(zc)}`+
      (this._mode3D?` · ↻ ${Math.round(this._rx*180/Math.PI)}°,${Math.round(this._ry*180/Math.PI)}°`:'')+
      T` · ซูม ${Math.round(this._scale*100)}%`;
  }

  /** ความลึกเฉลี่ยของโหนดที่มองเห็น — ใช้เป็นค่า Z ของกล้องในโหมด 3D */
  _viewZ(){
    if(!this.nodes.length)return 0;
    let sum=0,n=0;
    for(const nd of this.nodes){sum+=(nd.z||0);n++;}
    return n?sum/n:0;
  }

  _updateMinimap() {
    if(!this._showMinimap||!this._mm||this._mm.style.display==='none')return;
    const c=this._mm.getContext('2d');const mw=160,mh=120;
    c.clearRect(0,0,mw,mh);c.fillStyle='rgba(26,26,24,0.92)';c.fillRect(0,0,mw,mh);
    if(!this.nodes.length){c.strokeStyle=THEME.canvas.grid;c.strokeRect(0,0,mw,mh);return;}
    let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
    for(const n of this.nodes){if(n.x<mnx)mnx=n.x;if(n.y<mny)mny=n.y;if(n.x>mxx)mxx=n.x;if(n.y>mxy)mxy=n.y;}
    const pw=mxx-mnx||200,ph=mxy-mny||200;
    const sx=(mw-20)/pw,sy=(mh-20)/ph,s=Math.min(sx,sy);
    const ox=10+(mw-20-pw*s)/2,oy=10+(mh-20-ph*s)/2;
    for(const n of this.nodes){
      const nx=ox+(n.x-mnx)*s,ny=oy+(n.y-mny)*s;
      c.fillStyle=this._catCol[n.cat]||THEME.edge['ent-scene'];c.beginPath();c.arc(nx,ny,2.5,0,Math.PI*2);c.fill();
    }
    const vw=this.canvas.width/this._scale,vh=this.canvas.height/this._scale;
    const vx=ox+(-this._cx/this._scale-mnx)*s,vy=oy+(-this._cy/this._scale-mny)*s;
    c.strokeStyle=THEME.edge.ally;c.lineWidth=1.5;c.strokeRect(vx,vy,vw*s,vh*s);
  }

  // ── hit / mouse ──
  /** เงื่อนไข "โหนดนี้โผล่ไหม" ชุดเดียวที่ทั้ง draw() และ _hit() ใช้ร่วมกัน
   *  แยกกันเมื่อไหร่ = คลิก/ลากโดนโหนดที่ถูกกรองซ่อนอยู่ (บั๊กเดิม)
   *  cache ไว้เพราะ _hit ถูกเรียกทุก mousemove */
  _visFilter(){
    if(this._vfCache&&this._vfCache.q===this._searchQuery&&this._vfCache.cf===this._catFilter
       &&this._vfCache.len===this.nodes.length)return this._vfCache;
    const cf=this._catFilter;
    const ac=cf.size===4;
    const q=(this._searchQuery||'').toLowerCase();
    const m=new Set();
    if(q)for(const n of this.nodes)if((n.name||'').toLowerCase().includes(q))m.add(n);
    const visible=(n)=>!((!ac&&!cf.has(n.cat)&&!isStruct(n))||(q&&!m.has(n)));
    this._vfCache={q:this._searchQuery,cf,len:this.nodes.length,ac,m,visible};
    return this._vfCache;
  }

  _hit(e){
    const r=this.canvas.getBoundingClientRect();
    const sx=(e.clientX-r.left-this._cx)/this._scale;
    const sy=(e.clientY-r.top-this._cy)/this._scale;
    const {visible}=this._visFilter();
    if(this._mode3D){
      let best=null,bestD=400;
      for(const n of this.nodes){
        if(!visible(n))continue;
        const p=project3D(n.x,n.y,n.z||0,this._rx,this._ry);
        const d=(p.x-sx)**2+(p.y-sy)**2;
        if(d<bestD){bestD=d;best=n;}
      }
      return{x:sx,y:sy,node:bestD<400?best:null};
    }
    return{x:sx,y:sy,node:this.nodes.find(n=>visible(n)&&(n.x-sx)**2+(n.y-sy)**2<=400)||null};
  }

  _down(e){
    // [alpha.73 ข้อ 2] ปุ่มหมุน 3D มาจาก settings.netControls (ค่าเริ่มต้น = ปุ่มกลาง เหมือนรุ่นก่อน)
    // ของเดิมฮาร์ดโค้ด `e.button===2` (คลิกขวา) จึงไม่ตรงกับที่ผู้ใช้เคยใช้และแก้ไม่ได้
    const ctl=this._controls||resolveNetControls(null);
    const orbitBtn=buttonIndex(ctl.orbitButton), panBtn=buttonIndex(ctl.panButton);
    if(e.button===orbitBtn&&this._mode3D){
      e.preventDefault();                       // ปุ่มกลางของ Chromium = auto-scroll ต้องกันไว้
      this._orbitDrag={sx:e.clientX,sy:e.clientY,orx:this._rx,ory:this._ry};return;}
    if(e.button!==panBtn)return;
    const{x,y,node}=this._hit(e);
    // [alpha.73 ข้อ 1] ผลักแล้วต้องอยู่ถาวร — เดิมผลักเสร็จไม่ปักหมุด/ไม่บันทึก รอบ refresh ถัดไปเด้งกลับหมด
    if(node&&e.shiftKey){this._repel(node,x,y);savePositions(this.nodes,this._scope());this.draw();return;}
    // [alpha.71 ข้อ 3] ลากโหนดได้เฉพาะโหมด "ย้ายตำแหน่ง" — โหมดอื่นคลิกโดนโหนดแล้วให้แพนผังแทน
    if(node&&this._tool==='move'){this.drag={node,moved:false,ox:node.x-x,oy:node.y-y};return;}
    if(node){this._clickNode=node;}
    this.pan={sx:e.clientX,sy:e.clientY,cx:this._cx,cy:this._cy,moved:false};this.canvas.classList.add('net-panning');
  }

  _move(e){
    if(this._orbitDrag){
      this._rx=this._orbitDrag.orx+(e.clientY-this._orbitDrag.sy)*0.008;
      this._ry=this._orbitDrag.ory+(e.clientX-this._orbitDrag.sx)*0.008;
      this._rx=Math.max(-Math.PI/2.2,Math.min(Math.PI/2.2,this._rx));
      this.draw();if(this._showMinimap)this._updateMinimap();return;
    }
    if(this.pan){this._cx=this.pan.cx+(e.clientX-this.pan.sx);this._cy=this.pan.cy+(e.clientY-this.pan.sy);if(Math.abs(e.clientX-this.pan.sx)+Math.abs(e.clientY-this.pan.sy)>3)this.pan.moved=true;this.draw();if(this._showMinimap)this._updateMinimap();return;}
    if(!this.drag){const{node}=this._hit(e);if(this._hoverNode!==node){this._hoverNode=node;this.draw();}this.canvas.style.cursor=node?'pointer':'grab';return;}
    const{x}=this._hit(e);this.drag.node.x=x+this.drag.ox;this.drag.node.y=(e.clientY-this.canvas.getBoundingClientRect().top-this._cy)/this._scale+this.drag.oy;this.drag.moved=true;this.draw();if(this._showMinimap)this._updateMinimap();}

  _up(){
    const clicked=this._clickNode;this._clickNode=null;
    if(this._orbitDrag){this._orbitDrag=null;return;}
    if(this.pan){const moved=this.pan.moved;this.pan=null;this.canvas.classList.remove('net-panning');
      if(moved)return;}
    // ลากเอง = ปักหมุดโหนดนั้น (เฉพาะโหนดที่ปักหมุดเท่านั้นที่ถูกบันทึก)
    if(this.drag&&this.drag.moved){this.drag.node._pinned=true;savePositions(this.nodes,this._scope());}
    this.drag=null;
    // [alpha.71 ข้อ 3] โหมด เปิด/แก้ไข → คลิกเดียวเปิดได้เลย (เดิมต้องดับเบิลคลิกเท่านั้น)
    if(clicked&&(this._tool==='open'||this._tool==='edit'))this._openNode(clicked);
  }

  _openNode(node){
    if(!node)return;
    if(isStruct(node)){if(this.onOpenScene)this.onOpenScene(node.file);}
    else if(this.onOpen)this.onOpen(node);
  }

  /** ปลดหมุดทุกโหนด แล้วให้ force layout จัดผังใหม่ทั้งหมด */
  /** ปลดหมุดทุกโหนด + ลบตำแหน่งที่บันทึกไว้ → รอบถัดไปทุกโหนดเป็น "ของใหม่" จึงถูกจัดผังใหม่หมด */
  relayout(){
    clearPositions(this.nodes,this._scope());
    for(const n of this.nodes)n._fresh=true;
    this.refresh();
  }

  /** ปลดหมุดโหนดเดียว — รอบ refresh ถัดไป force layout จะขยับมันได้อีก */
  unpin(node){
    if(!node)return;
    node._pinned=false;
    savePositions(this.nodes,this._scope());
  }

  /**
   * [alpha.73 ข้อ 1] Shift+คลิก = "เคลียร์ที่ว่างรอบโหนดนี้"
   *
   * สูตรเดิมเป็นแรงผลักแบบ 1/d² (`f=180/(d*d*0.01+1)`) — ที่ระยะจริงบนผัง (หลายร้อยหน่วย)
   * ได้แรงราว 0.005 หน่วย = **ขยับไม่ถึงหนึ่งพิกเซล** ผู้ใช้จึงเห็นว่า "กดแล้วไม่มีอะไรเกิดขึ้น"
   *
   * ตอนนี้ดันเฉพาะโหนดที่อยู่ใกล้กว่ารัศมีเคลียร์ ให้ออกไปอยู่ที่ขอบรัศมีพอดี — เห็นผลทันทีและคาดเดาได้
   * โหนดที่ถูกดันถือว่า "ผู้ใช้จัดเอง" (ปักหมุด) จะได้ไม่ถูก forceLayout ดึงกลับ
   */
  _repel(node, hx, hy) {
    const R = 220 * (this._nodeScale || 1);
    // โหมด 2D ผู้ใช้เห็นแค่ระนาบ x/y — ถ้าเอา z มาคิดด้วย โหนดที่ "ลึก" ต่างกันจะดูเหมือนไม่ขยับ
    const use3D = !!this._mode3D;
    let moved = 0;
    for(const n of this.nodes){
      if(n===node)continue;
      let dx=n.x-node.x, dy=n.y-node.y, dz=use3D?((n.z||0)-(node.z||0)):0;
      let d=Math.sqrt(dx*dx+dy*dy+dz*dz);
      if(d>=R)continue;
      if(d<1){const a=Math.random()*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);dz=0;d=1;}
      const k=R/d;
      n.x=node.x+dx*k; n.y=node.y+dy*k; if(use3D)n.z=(node.z||0)+dz*k;
      n._pinned=true;
      moved++;
    }
    return moved;
  }


  /**
   * [alpha.73 ข้อ 4] ซูมยึด "จุดกึ่งกลางจอ"
   * ของเดิมยึดตำแหน่งเมาส์ → พิกัดกล้องที่โชว์บนแถบสถานะเปลี่ยนทุกครั้งที่ซูม
   * ทั้งที่ผู้ใช้ยังมองจุดเดิม (ดูเหมือน "ค่า x/y/z ไม่ยึดจากอะไรเลย")
   */
  _zoom(e){
    const f=e.deltaY<0?1.1:0.9;
    const cam=zoomAtCenter({scale:this._scale,cx:this._cx,cy:this._cy},
                           this.canvas.width,this.canvas.height,this._scale*f);
    this._scale=cam.scale;this._cx=cam.cx;this._cy=cam.cy;
    this.draw();if(this._showMinimap)this._updateMinimap();
  }

  _ctxMenu(e){
    if(this._orbitDrag)return;
    if(this._ctxMenus){for(const m of this._ctxMenus){try{m.remove();}catch{}}this._ctxMenus=[];}
    else this._ctxMenus=[];
    this._ctxCleanup=this._ctxCleanup||(ev=>{
      if(!this._ctxMenus||!this._ctxMenus.length)return;
      for(const m of[...this._ctxMenus]){try{if(!m.contains(ev.target)){if(m.parentNode)m.remove();this._ctxMenus=this._ctxMenus.filter(x=>x!==m);}}catch{}}
      if(!this._ctxMenus.length){document.removeEventListener('click',this._ctxCleanup);this._ctxListenerAdded=false;}
    });

    const{node}=this._hit(e);
    const menu=document.createElement('div');menu.className='k-menu net-ctx-menu';
    this._ctxMenus.push(menu);
    menu.style.cssText='position:fixed;left:'+e.clientX+'px;top:'+e.clientY+'px;z-index:80;background:var(--side);border:1px solid var(--border);border-radius:8px;padding:4px;box-shadow:0 6px 20px rgba(0,0,0,.4);min-width:160px;';
    const done=()=>{this._ctxMenus=this._ctxMenus.filter(x=>x!==menu);try{menu.remove();}catch{}};
    const addItem=(label,click,opts={})=>{const d=document.createElement('div');d.className='k-menu-item';d.textContent=label;if(opts.danger)d.style.color=THEME.edge.family;if(opts.dim)d.style.opacity='0.5';if(label==='-'){d.style.cssText='height:1px;background:var(--border);margin:2px 6px;padding:0;cursor:default;';d.onclick=()=>{};}else{d.onclick=()=>{click();done();}}menu.appendChild(d);};
    if(node){
      const struct=isStruct(node);
      if(struct){
        // structural node — copy from explorer
        if(node.cat==='scene'){
          addItem(T`📄 เปิด`,()=>{if(this.onOpenScene)this.onOpenScene(node.file);});
          if(this.onRenameStruct)addItem(T`✎ เปลี่ยนชื่อ…`,()=>this.onRenameStruct(node));
          if(this.onDuplicateStruct)addItem(T`📋 ทำซ้ำ`,()=>this.onDuplicateStruct(node));
          if(node.file&&this.onReveal)addItem(T`📂 หาในดิสก์`,()=>{try{this.onReveal(node.file);}catch{}});
          addItem('-',()=>{});
          if(this.onDeleteStruct)addItem(T`🗑 ลบ (ย้ายไปถังขยะ)`,()=>this.onDeleteStruct(node),{danger:true});
        }else if(node.cat==='chapter'){
          addItem(T`📂 เปิดบท`,()=>{if(this.onOpenScene&&node.file)this.onOpenScene(node.file);});
          if(this.onAddChild)addItem(T`＋ เพิ่มฉาก…`,()=>this.onAddChild(node));
          if(this.onRenameStruct)addItem(T`✎ เปลี่ยนชื่อบท…`,()=>this.onRenameStruct(node));
          addItem('-',()=>{});
          if(this.onDeleteStruct)addItem(T`🗑 ลบบททั้งบท`,()=>this.onDeleteStruct(node),{danger:true});
        }else if(node.cat==='section'){
          if(this.onOpenScene&&node.file)addItem(T`📂 เปิดเล่ม`,()=>this.onOpenScene(node.file));
          if(this.onAddChild)addItem(T`＋ เพิ่มเล่มใหม่…`,()=>this.onAddChild(node));
          if(this.onRenameStruct)addItem(T`✎ เปลี่ยนชื่อเล่ม…`,()=>this.onRenameStruct(node));
          addItem('-',()=>{});
          if(this.onDeleteStruct)addItem(T`🗑 ลบเล่มทั้งเล่ม`,()=>this.onDeleteStruct(node),{danger:true});
        }
      }else{
        // wiki entity — match explorer style
        addItem(T`📖 เปิด`,()=>{if(this.onOpen)this.onOpen(node);});
        if(node.file&&this.onReveal){
          addItem(T`📂 หาในดิสก์`,()=>{try{this.onReveal(node.file);}catch{}});
        }
        if(node.cat)addItem(T`🏷 หมวด: `+node.cat,()=>{},{dim:true});
        if(node.desc)addItem('📝 '+(node.desc.length>50?node.desc.slice(0,49)+'…':node.desc),()=>{},{dim:true});
        if(node.tags&&node.tags.length)addItem(T`🏷 แท็ก: `+node.tags.join(', '),()=>{},{dim:true});
        if(node.relationships&&node.relationships.length){
          addItem(T`🔗 ความสัมพันธ์ (`+node.relationships.length+')…',()=>{
            const sm=document.createElement('div');sm.className='k-menu net-ctx-menu';this._ctxMenus.push(sm);
            sm.style.cssText='position:fixed;left:'+(e.clientX+170)+'px;top:'+e.clientY+'px;z-index:81;background:var(--side);border:1px solid var(--border);border-radius:8px;padding:4px;box-shadow:0 6px 20px rgba(0,0,0,.4);';
            for(const r of node.relationships.slice(0,15)){
              const sd=document.createElement('div');sd.className='k-menu-item';
              sd.textContent=(this._edgeCol[r.type]?'⬤ ':'')+(r.targetName||r.target||'?')+' — '+(r.role||'');
              sd.style.color=this._edgeCol[r.type]||'inherit';
              sd.onclick=()=>{document.body.removeChild(sm);};
              sm.appendChild(sd);
            }
            document.body.appendChild(sm);
          });
        }
      }
      if(node._pinned){
        addItem('-',()=>{});
        addItem(T`📌 ปลดหมุดโหนดนี้`,()=>{this.unpin(node);this.draw();});
      }
    }else{
      addItem(T`⤾ รีเซ็ตมุมมอง`,()=>{this._scale=1;this._cx=0;this._cy=0;this._rx=0.4;this._ry=-0.3;this.draw();});
      addItem(T`🔄 รีเฟรช`,()=>this.refresh());
      addItem(T`📌 ปลดหมุดทุกโหนด แล้วจัดผังใหม่`,()=>this.relayout());
    }
    document.body.appendChild(menu);
    document.addEventListener('click',this._ctxCleanup);this._ctxListenerAdded=true;
  }

  focus(){this._fit();this.draw();}
  save(){return true;}
  destroy(){
    if(this._ctxCleanup){document.removeEventListener('click',this._ctxCleanup);this._ctxListenerAdded=false;}
    if(this._ctxMenus){for(const m of this._ctxMenus)try{m.remove();}catch{}this._ctxMenus=[];}
    if(this._rafId)cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize',this._resize);
    document.removeEventListener('mouseup',this._upDoc);
    if(this._ro)this._ro.disconnect();
    if(this._tb)this._tb.destroy();
    savePositions(this.nodes,this._scope());
  }
}
