// tag-pane.js — แท็บ "แท็ก" แสดงรายการแท็กทั้งหมด + จำนวน + กรอง + tag cloud
import { T } from './i18n.js';
import { $, el, state, setStatus, log } from './core.js';
import { activate, closeTab } from './app.js';

// เก็บสถานะโหมดแสดงผล (list | cloud)
let _tagView = 'list';

// เปิดแท็บแท็ก
export async function openTagPane() {
  const key = '::tags::';
  if (state.tabs.has(key)) {
    activate(key);
    return renderTagList(state.tabs.get(key).pane);
  }
  const pane = el('div', 'pane');
  $('#panes').append(pane);
  const tabBtn = el('div', 'tab');
  tabBtn.append(el('span', 'tab-title', T`🏷 แท็ก`));
  const x = el('span', 'tab-x', '×'); tabBtn.append(x);
  $('#tabs').append(tabBtn);
  const tab = { file: key, title: T`แท็ก`, pane, tabBtn, dirty: false,
                editor: null, plain: null, wiki: null, gal: null, dash: true };
  tabBtn.onclick = (e) => { if (e.target !== x) activate(key); };
  x.onclick = () => closeTab(key);
  state.tabs.set(key, tab);
  activate(key);
  renderTagList(pane);
}

// วาดรายการแท็ก
export async function renderTagList(pane) {
  pane.innerHTML = '';
  const wrap = el('div', 'tag-wrap');
  
  // หัว + toggle
  const head = el('div', 'tag-head');
  head.append(el('div', 'tag-title', T`🏷 แท็กทั้งหมด`));
  
  const toggles = el('div', 'tag-toggles');
  const listBtn = el('button', 'tag-mode-btn' + (_tagView === 'list' ? ' on' : ''), T`📋 รายการ`);
  const cloudBtn = el('button', 'tag-mode-btn' + (_tagView === 'cloud' ? ' on' : ''), T`☁️ เมฆแท็ก`);
  listBtn.onclick = () => { _tagView = 'list'; renderTagList(pane); };
  cloudBtn.onclick = () => { _tagView = 'cloud'; renderTagList(pane); };
  toggles.append(listBtn, cloudBtn);
  head.append(toggles);
  
  // จำนวนแท็กรวม
  const counts = await getTagCounts();
  const info = el('div', 'tag-info', Object.keys(counts).length + T` แท็ก`);
  head.append(info);
  wrap.append(head);
  
  // ส่วนเนื้อหา
  const body = el('div', 'tag-body');
  if (_tagView === 'cloud') {
    renderTagCloud(body, counts);
  } else {
    renderTagTree(body, counts);
  }
  wrap.append(body);
  pane.append(wrap);
}

// อ่านแท็กทั้งหมดจากทุกฉาก + Wiki entities
export async function getTagCounts() {
  const counts = {};
  if (!state.root) return counts;
  
  try {
    // --- อ่านจาก scenes.json ทุกเล่ม/ฉบับร่าง ---
    for (const secName of await kapi.listDirs(state.root)) {
      if (['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', 'Plugins', 'Research'].includes(secName)) continue;
      const secPath = await kapi.join(state.root, secName);
      if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
      const draftRoot = await kapi.join(secPath, 'Draft');
      if (!(await kapi.exists(draftRoot))) continue;
      for (const dn of await kapi.listDirs(draftRoot)) {
        const dPath = await kapi.join(draftRoot, dn);
        const sf = await kapi.join(dPath, 'scenes.json');
        if (!(await kapi.exists(sf))) continue;
        const scData = await kapi.readJson(sf);
        const chs = scData.chapters || {};
        for (const chGuid of Object.keys(chs)) {
          for (const sc of (chs[chGuid] || [])) {
            for (const tag of (sc.tags || [])) {
              if (!tag) continue;
              counts[tag] = (counts[tag] || 0) + 1;
            }
          }
        }
      }
    }
    
    // --- อ่านจาก Wiki entities ---
    for (const wbase of ['Wiki', 'Bible']) {
      const wikiRoot = await kapi.join(state.root, wbase);
      if (!(await kapi.exists(wikiRoot))) continue;
      for (const cat of await kapi.listDirs(wikiRoot)) {
        const catDir = await kapi.join(wikiRoot, cat);
        for (const f of await kapi.listFiles(catDir, '.json')) {
          try {
            const ent = await kapi.readJson(await kapi.join(catDir, f));
            for (const tag of (ent.tags || [])) {
              if (!tag) continue;
              counts[tag] = (counts[tag] || 0) + 1;
            }
          } catch {}
        }
      }
    }
    
    // --- อ่านจากฉากใน Wiki แต่ละเซกชัน ---
    for (const secName of await kapi.listDirs(state.root)) {
      if (['Wiki', 'Bible', 'Images', 'Memos', 'Recycle', 'Snapshots', 'Plugins', 'Research'].includes(secName)) continue;
      const secPath = await kapi.join(state.root, secName);
      if (!(await kapi.exists(await kapi.join(secPath, 'section.json')))) continue;
      for (const wbase of ['Wiki', 'Bible']) {
        const wikiRoot = await kapi.join(secPath, wbase);
        if (!(await kapi.exists(wikiRoot))) continue;
        for (const cat of await kapi.listDirs(wikiRoot)) {
          const catDir = await kapi.join(wikiRoot, cat);
          for (const f of await kapi.listFiles(catDir, '.json')) {
            try {
              const ent = await kapi.readJson(await kapi.join(catDir, f));
              for (const tag of (ent.tags || [])) {
                if (!tag) continue;
                counts[tag] = (counts[tag] || 0) + 1;
              }
            } catch {}
          }
        }
      }
    }
  } catch (e) {
    log('warn', T`tag-pane: อ่านแท็กล้มเหลว`, e);
  }
  
  return counts;
}

// เรนเดอร์แบบ Tree (hierarchical tags)
function renderTagTree(container, counts) {
  container.innerHTML = '';
  
  // เรียงตามจำนวน (มาก→น้อย)
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  
  if (!sorted.length) {
    container.append(el('div', 'tag-empty', T`ยังไม่มีแท็ก — ใส่แท็กในคุณสมบัติฉากหรือ Wiki`));
    return;
  }
  
  // จัดกลุ่มตาม prefix (hierarchical: location:city:bangkok)
  const tree = {};
  for (const [tag, count] of sorted) {
    const parts = tag.split(':');
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(0, i + 1).join(':');
      if (!node[key]) node[key] = { count: 0, children: {} };
      if (i === parts.length - 1) node[key].count = count; // ใบ
      node = node[key].children;
    }
  }
  
  // เรนเดอร์ tree
  const renderNode = (obj, depth = 0) => {
    const entries = Object.entries(obj).sort((a, b) => b[1].count - a[1].count);
    for (const [key, node] of entries) {
      const row = el('div', 'tag-item');
      row.style.paddingLeft = (16 + depth * 20) + 'px';
      
      const name = el('span', 'tag-name', key);
      row.append(name);
      
      const badge = el('span', 'tag-count', String(node.count));
      row.append(badge);
      
      // คลิกเพื่อกรอง Explorer
      row.onclick = () => filterByTag(key);
      row.title = T`คลิกเพื่อกรอง Explorer → แสดงเฉพาะฉากที่มีแท็ก: ` + key;
      
      container.append(row);
      
      // รีเคอร์ซีฟ children
      if (Object.keys(node.children).length) {
        renderNode(node.children, depth + 1);
      }
    }
  };
  
  renderNode(tree);
}

// เรนเดอร์แบบ Tag Cloud
function renderTagCloud(container, counts) {
  container.innerHTML = '';
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  
  if (!sorted.length) {
    container.append(el('div', 'tag-empty', T`ยังไม่มีแท็ก — ใส่แท็กในคุณสมบัติฉากหรือ Wiki`));
    return;
  }
  
  const maxCount = sorted[0]?.[1] || 1;
  const cloud = el('div', 'tag-cloud');
  
  for (const [tag, count] of sorted) {
    const pill = el('span', 'tag-pill', tag + ' (' + count + ')');
    // ขนาดฟอนต์ตามสัดส่วน (min 12px, max 28px)
    const ratio = count / maxCount;
    const fontSize = 12 + Math.round(ratio * 16);
    pill.style.fontSize = fontSize + 'px';
    pill.style.opacity = 0.6 + ratio * 0.4;
    pill.onclick = () => filterByTag(tag);
    pill.title = T`คลิกเพื่อกรอง Explorer → แสดงเฉพาะฉากที่มีแท็ก: ` + tag;
    cloud.append(pill);
  }
  
  container.append(cloud);
}

// กรอง Explorer ตามแท็ก
export async function filterByTag(tag) {
  if (!state.root) { setStatus(T`ยังไม่ได้เปิดโปรเจกต์`); return; }
  
  const searchInput = $('#tree-search');
  if (searchInput) {
    searchInput.value = 'tag:' + tag;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  setStatus(T`กรองด้วยแท็ก: ` + tag + T` — Explorer แสดงเฉพาะฉากที่มีแท็กนี้`);
}
