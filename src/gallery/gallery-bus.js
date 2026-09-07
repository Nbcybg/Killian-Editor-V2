// gallery-bus.js — สถานะที่ "คลังรูป" กับ "กระดานอารมณ์" ใช้ร่วมกัน (alpha.63r)
//
// สองแผงนี้ต้องรู้จักอัลบั้มเดียวกัน แต่ต่างคนต่างวาด และห้าม import หากันไป-มา
// (ตารางเปิดคู่กับกระดานได้ · เลือกอัลบั้มฝั่งไหนอีกฝั่งตามทันที)
// → ตัวกลางเล็ก ๆ ก้อนนี้เก็บ "อัลบั้มที่กำลังดู" + คิวผู้ฟัง เท่านั้น

import { ROOT_ALBUM, ALL_ALBUM } from './album-core.js';

let current = ALL_ALBUM;
const listeners = new Set();

export function currentAlbum() { return current; }

/** อัลบั้มที่ใช้เก็บกระดาน — มุมมอง "รูปทั้งหมด" ไม่มีกระดานของตัวเอง ใช้ของอัลบั้มราก */
export function boardAlbum() { return current === ALL_ALBUM ? ROOT_ALBUM : current; }

export function setCurrentAlbum(id, from) {
  if (!id || id === current) return current;
  current = id;
  for (const fn of [...listeners]) { try { fn(current, from); } catch {} }
  return current;
}

/** คืนฟังก์ชันถอดผู้ฟัง (แผงเรียกตอน destroy) */
export function onAlbumChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// กระดานถูกแก้ (เพิ่ม/ลบ/ย้ายชิ้น) → ให้แผงกระดานที่เปิดค้างวาดใหม่
const boardListeners = new Set();
export function onBoardChange(fn) { boardListeners.add(fn); return () => boardListeners.delete(fn); }
export function notifyBoardChanged(albumId) {
  for (const fn of [...boardListeners]) { try { fn(albumId); } catch {} }
}
