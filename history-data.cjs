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

// src/i18n-csv.js
function parseCsv(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", inQ = false, i = 0;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      endCell();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      endRow();
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}

// src/i18n.js
var TABLE = /* @__PURE__ */ Object.create(null);
var langInfo = { code: "", name: "", nativeName: "", version: "", author: "", file: "" };
var langCatalog = [];
var FALLBACK_NAMES = {
  th: "\u0E44\u0E17\u0E22",
  en: "English",
  ja: "\u65E5\u672C\u8A9E",
  zh: "\u4E2D\u6587",
  ko: "\uD55C\uAD6D\uC5B4",
  fr: "Fran\xE7ais",
  de: "Deutsch",
  es: "Espa\xF1ol",
  pt: "Portugu\xEAs",
  ru: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439",
  vi: "Ti\u1EBFng Vi\u1EC7t",
  id: "Bahasa Indonesia",
  it: "Italiano",
  ar: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
  hi: "\u0939\u093F\u0928\u094D\u0926\u0940",
  my: "\u1019\u103C\u1014\u103A\u1019\u102C"
};
function fallbackLangName(code) {
  const c = String(code || "").toLowerCase();
  return FALLBACK_NAMES[c] || FALLBACK_NAMES[c.split("-")[0]] || code || "";
}
function csvToTable(text, pick) {
  const rows = parseCsv(String(text || "").replace(/﻿/g, ""));
  const out = /* @__PURE__ */ Object.create(null);
  if (!rows.length) return out;
  const head = rows[0].map((c) => String(c).trim().toLowerCase());
  const isHeader = head[0] === "key";
  let vi = 1;
  if (isHeader && pick) {
    const i = head.indexOf(String(pick).toLowerCase());
    if (i > 0) vi = i;
  } else if (isHeader) {
    const i = head.findIndex((h, n) => n > 0 && (h === "text" || h === "value"));
    if (i > 0) vi = i;
  }
  for (const r of isHeader ? rows.slice(1) : rows) {
    const k = r[0] == null ? "" : String(r[0]);
    if (!k || k.startsWith("#")) continue;
    const v = r[vi] == null ? "" : String(r[vi]);
    if (v !== "" && !(k in out)) out[k] = v;
  }
  return out;
}
function setTable(table, code) {
  TABLE = Object.assign(/* @__PURE__ */ Object.create(null), table || {});
  _memo = /* @__PURE__ */ new WeakMap();
  langInfo.code = code || TABLE["meta.code"] || "";
  langInfo.name = TABLE["meta.name"] || "";
  langInfo.nativeName = TABLE["meta.nativeName"] || fallbackLangName(langInfo.code);
  langInfo.version = TABLE["meta.version"] || "";
  langInfo.author = TABLE["meta.author"] || "";
  return TABLE;
}
function setCatalog(list) {
  langCatalog = Array.isArray(list) ? list : [];
  return langCatalog;
}
function lookup(key) {
  if (typeof key !== "string" || !key) return void 0;
  const v = TABLE[key];
  if (typeof v === "string" && v !== "") return v;
  const u = TABLE["ui." + key];
  if (typeof u === "string" && u !== "") return u;
  return void 0;
}
function t(key) {
  if (typeof key !== "string" || !key) return "";
  const v = lookup(key);
  return formatMsg(v != null ? v : String(key), []);
}
function formatMsg(tpl, vals) {
  if (!vals || !vals.length) return String(tpl).replace(/\{\{|\}\}/g, (m) => m[0]);
  return String(tpl).replace(/\{\{|\}\}|\{(\d+)\}/g, (m, d) => {
    if (m === "{{" || m === "}}") return m[0];
    const v = vals[+d];
    return v == null ? "" : String(v);
  });
}
var _memo = /* @__PURE__ */ new WeakMap();
var LANG_LS_KEY = "k2-lang";
function initSyncFromHost() {
  try {
    const api = typeof globalThis !== "undefined" && globalThis.kapi || null;
    if (!api || typeof api.langSync !== "function") return false;
    let want = "";
    try {
      want = globalThis.localStorage?.getItem(LANG_LS_KEY) || "";
    } catch {
    }
    const res = api.langSync(want);
    if (!res) return false;
    if (Array.isArray(res.catalog)) setCatalog(res.catalog);
    if (res.csv) {
      setTable(csvToTable(res.csv), res.code);
      return true;
    }
  } catch {
  }
  return false;
}
initSyncFromHost();

// src/history/history-data.js
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
  write: t("ui.common.edit"),
  create: t("ui.common.new"),
  remove: t("ui.common.del"),
  move: t("ui.histOry.moveChangeName"),
  copy: t("ui.histOry.copyIn"),
  image: t("ui.histOry.addImage")
};
var kindLabel = (k) => KIND_LABEL[k] || t("ui.histOry.change");
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
