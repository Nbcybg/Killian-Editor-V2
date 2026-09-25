// src/net3d/model-render.js — [alpha.166] ตัววาดโมเดล 3 มิติของ Story Network (บันเดิลแยก renderer/net3d.js)
//
// three.js ใหญ่ (~1MB) และผู้ใช้ส่วนใหญ่ไม่เคยใส่โมเดลเลย → ไม่ฝังลง bundle.js หลัก
// (AGENTS: "JS ห้ามบวม") · build.js สร้างไฟล์นี้เป็น IIFE ของตัวเอง แล้ว network-models.js โหลดเมื่อใช้ครั้งแรก
//
// หลักการ: ผังยังเป็น canvas 2D ตัวเดิม (ตัวเลือก/ลาก/ป้าย/ฉากหลังทำงานเหมือนเดิมหมด)
// โมเดลถูกวาดลง WebGL นอกจอ "ทีละโหนด" ตามมุมกล้องปัจจุบัน แล้วคืนเป็นภาพให้ canvas 2D วาดแทนวงกลม
// → หมุนกล้อง 3D แล้วโมเดลหมุนตามจริง · 2D = มุม 0 (มองตรงหน้า)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

let renderer = null, scene = null, camera = null, holder = null;

function ensureRenderer() {
  if (renderer) return renderer;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(-3, 1, -2); scene.add(rim);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);
  camera.lookAt(0, 0, 0);
  holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  scene.add(holder);
  return renderer;
}

/** จัดโมเดลให้อยู่กลาง (0,0,0) และพอดีทรงกลมรัศมี 1 — โมเดลจากต่างแหล่งมีหน่วยต่างกันเป็นพันเท่า */
function normalize(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return obj;
  const c = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const k = sphere.radius > 0 ? 1 / sphere.radius : 1;
  const g = new THREE.Group();
  obj.position.sub(c);
  g.add(obj);
  g.scale.setScalar(k);
  return g;
}

function tintMaterial(color) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color || '#cccccc'), roughness: 0.55, metalness: 0.1 });
}

/**
 * อ่านไบต์ของไฟล์เป็นโมเดล
 * @param {'glb'|'gltf'|'obj'|'stl'} kind
 * @param {ArrayBuffer} buf
 * @param {{color?:string, baseUrl?:string}} opts  สีสำหรับไฟล์ที่ไม่มีวัสดุ (OBJ/STL) · baseUrl = โฟลเดอร์ของ .gltf
 * @returns {Promise<THREE.Object3D>}
 */
export async function parseModel(kind, buf, opts = {}) {
  if (kind === 'glb' || kind === 'gltf') {
    const loader = new GLTFLoader();
    const data = kind === 'gltf' ? new TextDecoder().decode(new Uint8Array(buf)) : buf;
    const gltf = await new Promise((res, rej) => loader.parse(data, opts.baseUrl || '', res, rej));
    return normalize(gltf.scene || gltf.scenes[0]);
  }
  if (kind === 'obj') {
    const obj = new OBJLoader().parse(new TextDecoder().decode(new Uint8Array(buf)));
    obj.traverse((m) => { if (m.isMesh && (!m.material || !m.material.map)) m.material = tintMaterial(opts.color); });
    return normalize(obj);
  }
  if (kind === 'stl') {
    const geo = new STLLoader().parse(buf);
    geo.computeVertexNormals();
    return normalize(new THREE.Mesh(geo, tintMaterial(opts.color)));
  }
  throw new Error('unsupported model: ' + kind);
}

const _m = { S: null, A: null };
/**
 * วาดโมเดลตามมุมกล้องของผัง → canvas ใหม่ (ภาพนิ่ง ใช้เป็นสไปรต์)
 * แกนของผัง: x ขวา · y ลง · z ลึกออกจากจอ · โมเดลมาตรฐาน: y ขึ้น · หน้าหันหาผู้ชม (+z)
 *   โลก = A·local (A = diag(1,-1,-1))  ·  จอ = R·โลก  ·  แกนกล้องของ three = S·จอ (S = diag(1,-1,-1))
 *   ที่มุม 0: S·A = I → โมเดลตั้งตรง หันหน้าเข้าหาผู้ชม
 */
export function renderModel(model, { rx = 0, ry = 0, yaw = 0, stand = 0, size = 128 } = {}) {
  ensureRenderer();
  const px = Math.max(32, Math.min(512, size | 0));
  if (renderer.domElement.width !== px) renderer.setSize(px, px, false);
  if (!_m.S) { _m.S = new THREE.Matrix4().makeScale(1, -1, -1); _m.A = new THREE.Matrix4().makeScale(1, -1, -1); }
  const R = new THREE.Matrix4().makeRotationX(rx).multiply(new THREE.Matrix4().makeRotationY(ry));
  const Y = new THREE.Matrix4().makeRotationY(yaw);                 // หมุนตัวโมเดลเอง (หันหน้า) ในแกนของมัน
  // [รอบ 2] ท่าของโมเดล: 2D (stand=0) = หันหน้าเข้าหาผู้ชมเหมือนไอคอน · 3D (stand=1) = ยืนบนระนาบของผัง
  // (แกนขึ้นของโมเดล = แนวตั้งฉากของโต๊ะ −z) — ระหว่างสลับโหมดไล่ไปพร้อมมุมกล้อง ไม่กระโดด
  const Pt = new THREE.Matrix4().makeRotationX((Math.PI / 2) * Math.max(0, Math.min(1, stand)));
  holder.matrix.copy(_m.S).multiply(R).multiply(Pt).multiply(_m.A).multiply(Y);
  holder.matrixWorldNeedsUpdate = true;
  holder.clear();
  holder.add(model);
  renderer.render(scene, camera);
  holder.remove(model);
  const out = document.createElement('canvas');
  out.width = out.height = px;
  out.getContext('2d').drawImage(renderer.domElement, 0, 0);
  return out;
}

export function disposeModel(model) {
  try {
    model.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mt of mats) { for (const k of Object.keys(mt)) { const v = mt[k]; if (v && v.isTexture) v.dispose(); } mt.dispose(); }
    });
  } catch { /* ของเสียแล้ว */ }
}

// ส่งออกเป็นตัวแปรระดับหน้าต่าง — bundle.js หลักโหลดไฟล์นี้ด้วย <script> แล้วเรียกผ่าน window.K2Net3D
window.K2Net3D = { parseModel, renderModel, disposeModel, version: THREE.REVISION };
