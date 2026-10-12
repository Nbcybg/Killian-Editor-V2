// Focus timer — an example from the Killian 2 Extension Guide (docs/extension/)
// Shows: things a plugin creates ITSELF, outside k2 (setInterval · an element on <body> · a <style> · a window listener)
//        and cleaning all of them up in k2.onUnload — the condition for declaring "hotReload": true
//
// The app only removes what was registered through k2 (commands · shortcuts · panels · event handlers).
// Everything in this file that did not go through k2 therefore has a matching "undo" in onUnload below.

const NS = 'k2-plugin-' + k2.pluginName;             // a prefix so nothing collides with another plugin
const LS_MIN = NS + ':minutes';                      // a user-level value → localStorage (shared by every project)

// Text in two languages, chosen from <html lang>. Anything else falls back to English.
const STR = {
  en: {
    start: 'Start the focus timer', stop: 'Stop the focus timer', set: 'Set the number of minutes…',
    started: (m) => 'Focus timer started: ' + m + (m === 1 ? ' minute' : ' minutes'),
    stopped: 'Focus timer stopped',
    done: "Time's up", doneMsg: (m) => m + (m === 1 ? ' minute is' : ' minutes are') + ' up — rest your eyes for a moment',
    ask: 'How many minutes? (1–180)', bad: 'Enter a number from 1 to 180', ok: 'OK',
    setTo: (m) => 'Focus time set to ' + m + (m === 1 ? ' minute' : ' minutes'),
  },
  th: {
    start: 'เริ่มจับเวลาโฟกัส', stop: 'หยุดจับเวลาโฟกัส', set: 'ตั้งจำนวนนาที…',
    started: (m) => 'เริ่มจับเวลา ' + m + ' นาที',
    stopped: 'หยุดจับเวลาแล้ว',
    done: 'ครบเวลา', doneMsg: (m) => 'ครบ ' + m + ' นาทีแล้ว — พักสายตาสักครู่',
    ask: 'จับเวลากี่นาที (1–180)', bad: 'ใส่ตัวเลข 1–180', ok: 'ตกลง',
    setTo: (m) => 'ตั้งเวลาโฟกัสเป็น ' + m + ' นาที',
  },
};
const T = STR[(document.documentElement.lang || 'en').slice(0, 2)] || STR.en;

let minutes = Number(localStorage.getItem(LS_MIN)) || 25;
let endAt = 0;                                       // end time (ms) · 0 = not running
let timer = null;

// ── 1) A style: injected into <head> by us → removed by us ──
const style = document.createElement('style');
style.textContent = `
  .ft-chip { position:fixed; right:calc(16px * var(--ui-scale, 1)); top:calc(96px * var(--ui-scale, 1)); z-index:60;
    padding:4px 10px; border-radius:999px; pointer-events:none;
    background:var(--bar); color:var(--fg); border:1px solid var(--border);
    font-size:calc(12px * var(--ui-scale, 1)); font-variant-numeric:tabular-nums; }
  .ft-chip[data-done="1"] { background:var(--accent); color:var(--on-accent); }
  @media print { .ft-chip { display:none; } }
  @media (prefers-reduced-motion: no-preference) { .ft-chip { transition:background .2s; } }
`;
document.head.append(style);

// ── 2) An element: appended to <body> by us → removed by us ──
// Never put anything inside .ProseMirror (the paginator measures the real DOM) — overlays are children of <body>.
const chip = document.createElement('div');
chip.className = 'ft-chip';
chip.setAttribute('aria-hidden', 'true');            // decoration only — the message that matters goes to the status bar (a live region)
chip.hidden = true;
document.body.append(chip);

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function tick() {
  if (!endAt) return;
  const left = endAt - Date.now();
  chip.textContent = fmt(left);
  if (left <= 0) {
    stop(false);
    chip.hidden = false; chip.dataset.done = '1'; chip.textContent = T.done;
    k2.setStatus(T.doneMsg(minutes));
    k2.emit(k2.pluginName + ':done', { minutes });   // this plugin's own event (other plugins can listen)
  }
}

function start() {
  endAt = Date.now() + minutes * 60000;
  chip.hidden = false; delete chip.dataset.done;
  clearInterval(timer);
  timer = setInterval(tick, 500);                    // ── 3) A timer → cleared by us ──
  tick();
  k2.setStatus(T.started(minutes));
}

function stop(hide = true) {
  endAt = 0;
  clearInterval(timer); timer = null;
  if (hide) chip.hidden = true;
}

// ── 4) A window listener → removed by us ──
// Keys that do not depend on the keyboard layout (Escape, Enter, arrows) can be read from either e.code or e.key;
// for letters and symbols always use e.code (the physical key), because e.key is a Thai letter on a Thai layout.
const onKey = (e) => {
  if (e.code === 'Escape' && chip.dataset.done === '1') chip.hidden = true;
};
window.addEventListener('keydown', onKey);

// ── Registered through k2 — the app removes these for us ──
k2.registerCommand(T.start, start);
k2.registerCommand(T.stop, () => { stop(); k2.setStatus(T.stopped); });
k2.registerCommand(T.set, async () => {
  const v = await k2.ask(T.ask, { value: String(minutes) });
  if (v == null) return;                             // the user cancelled
  const n = Math.round(Number(v));
  // k2.alertBox has an oddly labelled button in alpha.169, so a confirmBox with our own label is used instead
  if (!Number.isFinite(n) || n < 1 || n > 180) { await k2.confirmBox(T.bad, T.ok); return; }
  minutes = n;
  localStorage.setItem(LS_MIN, String(n));
  k2.setStatus(T.setTo(n));
});
k2.registerShortcut('toggle', 'F9', true, true, () => (endAt ? stop() : start()));   // Ctrl+Shift+F9

// ── Cleanup: called when the plugin is disabled ('remove') or about to be replaced by a newer file ('reload') ──
// Throwing in here = the app assumes the cleanup was incomplete and tells the user to restart, hotReload or not.
k2.onUnload((why) => {
  clearInterval(timer);
  window.removeEventListener('keydown', onKey);
  chip.remove();
  style.remove();
  k2.log('unloaded (' + why + ')');
});
