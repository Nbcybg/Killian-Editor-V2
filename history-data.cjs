var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/history/history-data.js
var history_data_exports = {};
__export(history_data_exports, {
  BLOB_DIR: () => BLOB_DIR,
  DEFAULT_HISTORY_LIMIT: () => DEFAULT_HISTORY_LIMIT,
  HISTORY_DIR: () => HISTORY_DIR,
  HISTORY_FILE: () => HISTORY_FILE,
  HISTORY_LIMIT_MAX: () => HISTORY_LIMIT_MAX,
  HISTORY_LIMIT_MIN: () => HISTORY_LIMIT_MIN,
  HISTORY_SCHEMA: () => HISTORY_SCHEMA,
  addRecord: () => addRecord,
  afterRevert: () => afterRevert,
  clampLimit: () => clampLimit,
  describe: () => describe,
  kindLabel: () => kindLabel,
  migrate: () => migrate,
  newJournal: () => newJournal,
  planRevert: () => planRevert,
  prune: () => prune,
  referencedBlobs: () => referencedBlobs,
  relPath: () => relPath,
  timeline: () => timeline
});
module.exports = __toCommonJS(history_data_exports);
var HISTORY_SCHEMA = 1;
var HISTORY_DIR = ".k2history";
var HISTORY_FILE = "history.json";
var BLOB_DIR = "blobs";
var DEFAULT_HISTORY_LIMIT = 32;
var HISTORY_LIMIT_MIN = 4;
var HISTORY_LIMIT_MAX = 500;
function clampLimit(n) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return DEFAULT_HISTORY_LIMIT;
  return Math.min(HISTORY_LIMIT_MAX, Math.max(HISTORY_LIMIT_MIN, v));
}
function newJournal() {
  return { schema: HISTORY_SCHEMA, seq: 0, entries: [] };
}
function migrate(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const entries = (Array.isArray(d.entries) ? d.entries : []).filter((e) => e && typeof e === "object" && Number.isFinite(Number(e.seq))).map((e) => ({
    seq: Number(e.seq),
    at: e.at || "",
    kind: e.kind || "write",
    label: e.label || "",
    files: (Array.isArray(e.files) ? e.files : []).map((f) => ({
      path: String(f && f.path || ""),
      before: f && f.before ? String(f.before) : null,
      wasDir: !!(f && f.wasDir)
    })).filter((f) => f.path)
  })).sort((a, b) => a.seq - b.seq);
  const maxSeq = entries.length ? entries[entries.length - 1].seq : 0;
  return { schema: HISTORY_SCHEMA, seq: Math.max(Number(d.seq) || 0, maxSeq), entries };
}
function addRecord(journal, rec, limit = DEFAULT_HISTORY_LIMIT) {
  const j = migrate(journal);
  const files = (rec && rec.files || []).filter((f) => f && f.path);
  if (!files.length) return { journal: j, dropped: [] };
  j.seq += 1;
  j.entries.push({
    seq: j.seq,
    at: rec.at || "",
    kind: rec.kind || "write",
    label: rec.label || "",
    files: files.map((f) => ({ path: f.path, before: f.before || null, wasDir: !!f.wasDir }))
  });
  return prune(j, limit);
}
function prune(journal, limit = DEFAULT_HISTORY_LIMIT) {
  const j = migrate(journal);
  const max = clampLimit(limit);
  if (j.entries.length <= max) return { journal: j, dropped: [] };
  const cut = j.entries.slice(0, j.entries.length - max);
  const keep = j.entries.slice(j.entries.length - max);
  const live = referencedBlobs({ entries: keep });
  const dropped = [];
  for (const e of cut) for (const f of e.files) {
    if (f.before && !live.has(f.before) && !dropped.includes(f.before)) dropped.push(f.before);
  }
  j.entries = keep;
  return { journal: j, dropped };
}
function referencedBlobs(journal) {
  const s = /* @__PURE__ */ new Set();
  for (const e of journal && journal.entries || []) for (const f of e.files || []) {
    if (f.before) s.add(f.before);
  }
  return s;
}
function planRevert(journal, seq) {
  const j = migrate(journal);
  const target = Number(seq) || 0;
  const rollback = j.entries.filter((e) => e.seq > target);
  const byPath = /* @__PURE__ */ new Map();
  for (const e of rollback) {
    for (const f of e.files) {
      if (!byPath.has(f.path)) byPath.set(f.path, f);
    }
  }
  const ops = [];
  for (const [path, f] of byPath) {
    ops.push(f.before ? { op: "restore", path, blob: f.before } : { op: "delete", path, blob: null, wasDir: !!f.wasDir });
  }
  ops.sort((a, b) => a.op === b.op ? 0 : a.op === "delete" ? -1 : 1);
  return { ops, undone: rollback.map((e) => e.seq), entries: rollback };
}
function afterRevert(journal, seq) {
  const j = migrate(journal);
  const target = Number(seq) || 0;
  const keep = j.entries.filter((e) => e.seq <= target);
  const live = referencedBlobs({ entries: keep });
  const dropped = [];
  for (const e of j.entries) {
    if (e.seq <= target) continue;
    for (const f of e.files) if (f.before && !live.has(f.before) && !dropped.includes(f.before)) dropped.push(f.before);
  }
  return { journal: { ...j, entries: keep }, dropped };
}
var KIND_LABEL = {
  write: "\u0E41\u0E01\u0E49\u0E44\u0E02",
  create: "\u0E2A\u0E23\u0E49\u0E32\u0E07",
  remove: "\u0E25\u0E1A",
  move: "\u0E22\u0E49\u0E32\u0E22/\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E0A\u0E37\u0E48\u0E2D",
  copy: "\u0E04\u0E31\u0E14\u0E25\u0E2D\u0E01\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32",
  image: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E23\u0E39\u0E1B"
};
var kindLabel = (k) => KIND_LABEL[k] || "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E41\u0E1B\u0E25\u0E07";
function relPath(p, root) {
  const norm = (s) => String(s || "").replace(/\\/g, "/");
  const a = norm(p), b = norm(root).replace(/\/+$/, "");
  return b && a.toLowerCase().startsWith(b.toLowerCase() + "/") ? a.slice(b.length + 1) : a;
}
function describe(entry, root) {
  if (!entry) return "";
  const files = entry.files || [];
  const head = entry.label || kindLabel(entry.kind);
  if (!files.length) return head;
  const first = relPath(files[0].path, root);
  return files.length === 1 ? `${head} \xB7 ${first}` : `${head} \xB7 ${first} +${files.length - 1}`;
}
function timeline(journal, root) {
  const j = migrate(journal);
  return j.entries.slice().reverse().map((e) => ({
    seq: e.seq,
    at: e.at,
    kind: e.kind,
    text: describe(e, root),
    files: (e.files || []).map((f) => relPath(f.path, root)),
    count: (e.files || []).length
  }));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BLOB_DIR,
  DEFAULT_HISTORY_LIMIT,
  HISTORY_DIR,
  HISTORY_FILE,
  HISTORY_LIMIT_MAX,
  HISTORY_LIMIT_MIN,
  HISTORY_SCHEMA,
  addRecord,
  afterRevert,
  clampLimit,
  describe,
  kindLabel,
  migrate,
  newJournal,
  planRevert,
  prune,
  referencedBlobs,
  relPath,
  timeline
});
