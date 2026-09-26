// map-text.js — [alpha.167 · รอบต่อ] ข้อความของระยะ/พื้นที่/เวลาเดินทาง + สรุปแผนที่ให้ AI
//
// บริสุทธิ์ (i18n + maps.js เท่านั้น) — แผงแผนที่ (maps-ui) กับฝั่ง AI (ai-actions · แชท) ใช้ถ้อยคำชุดเดียวกัน
// ผู้ใช้: "ส่งพิกัดตัวละครให้ AI ใช้เป็นบริบท เช่น ใครอยู่ใกล้ใคร" → `mapDigestText()` / `whereText()`
import { t, tf } from './i18n.js';
import { niceDistance, niceArea, splitHours, travelHours, TRAVEL_MODES, formatLatLon } from './maps.js';

export function distText(d) {
  if (!d) return '';
  return tf(d.unit === 'km' ? 'ui.maps.unitKm' : 'ui.maps.unitM', d.value);
}
export function areaText(a) {
  if (!a) return '';
  return tf(a.unit === 'km2' ? 'ui.maps.unitKm2' : 'ui.maps.unitM2', a.value);
}
export const MODE_KEYS = { walk: 'ui.maps.travelWalk', horse: 'ui.maps.travelHorse', cart: 'ui.maps.travelCart', ship: 'ui.maps.travelShip', car: 'ui.maps.travelCar' };
export function hoursText(h) {
  const s = splitHours(h);
  if (!s) return '';
  if (s.d) return tf('ui.maps.timeDH', s.d, s.h);
  if (s.h) return tf('ui.maps.timeHM', s.h, s.m);
  return tf('ui.maps.timeM', Math.max(1, s.m));
}
/** เวลาเดินทาง: เดินเท้าเสมอ (+ ทุกพาหนะเมื่อ all) */
export function travelText(meters, all = false) {
  const modes = all ? TRAVEL_MODES : TRAVEL_MODES.slice(0, 1);
  return modes.map((m) => t(MODE_KEYS[m.id]) + ' ' + hoursText(travelHours(meters, m.kmh))).join(' · ');
}
/** ระยะของคู่หนึ่ง — จริง (+ เวลาเดินเท้า) เมื่อตั้งมาตราส่วนแล้ว · ไม่งั้นระยะสัมพัทธ์ */
function gapText(meters, rel) {
  if (meters != null) return distText(niceDistance(meters)) + ' (' + travelText(meters) + ')';
  return tf('ui.mapAi.relDist', rel);
}
function placeLine(p) {
  const bits = [p.name];
  if (p.zone && p.zone !== p.name) bits.push(tf('ui.mapAi.inZone', p.zone));
  if (p.latlon) bits.push(formatLatLon(p.latlon, 4));
  return '- ' + bits.join(' · ');
}

/**
 * สรุปทุกแผนที่เป็นข้อความสำหรับบริบทของ AI
 * @param digest ผลของ `mapDigest()` · @param maxChars เพดาน (ตัดท้าย ไม่ตัดกลางบรรทัด)
 */
export function mapDigestText(digest, { maxChars = 3000, maxNear = 12 } = {}) {
  if (!digest || !digest.length) return '';
  const lines = [t('ui.mapAi.head')];
  for (const m of digest) {
    lines.push('', m.parent ? tf('ui.mapAi.mapIn', m.name, m.parent) : tf('ui.mapAi.map', m.name));
    if (!m.scaled) lines.push(t('ui.mapAi.noScale'));
    for (const p of m.places) lines.push(placeLine(p));
    const zs = m.zones.map((z) => z.name + (z.areaM2 != null ? ' (' + areaText(niceArea(z.areaM2)) + ')' : ''));
    if (zs.length) lines.push(tf('ui.mapAi.zones', zs.join(', ')));
    if (m.near.length) {
      lines.push(t('ui.mapAi.nearHead'));
      for (const n of m.near.slice(0, maxNear)) lines.push('- ' + n.a + ' — ' + n.b + ': ' + gapText(n.meters, n.rel));
    }
  }
  let out = '';
  for (const l of lines) {
    if ((out + l + '\n').length > maxChars) { out += t('ui.mapAi.cut') + '\n'; break; }
    out += l + '\n';
  }
  return out.trimEnd();
}

/** ผลของ `whereIs()` เป็นข้อความ (คำตอบของคำสั่ง map.where) */
export function whereText(name, rows) {
  if (!rows || !rows.length) return tf('ui.mapAi.notOnMap', name);
  const lines = [];
  for (const r of rows) {
    if (r.place) {
      lines.push(tf('ui.mapAi.isOn', r.place.name, r.map));
      lines.push(placeLine(r.place));
    } else {
      lines.push(tf('ui.mapAi.zoneOn', r.zone.name, r.map));
    }
    if (r.zone && r.zone.areaM2 != null) lines.push(tf('ui.mapAi.zoneArea', areaText(niceArea(r.zone.areaM2))));
    if (r.around.length) {
      lines.push(t('ui.mapAi.aroundHead'));
      for (const a of r.around) lines.push('- ' + a.name + ': ' + gapText(a.meters, a.rel));
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
