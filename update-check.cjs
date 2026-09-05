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

// src/update/update-check.js
var update_check_exports = {};
__export(update_check_exports, {
  OLD_SUFFIX: () => OLD_SUFFIX,
  UPDATE_API_URL: () => UPDATE_API_URL,
  UPDATE_ASSET_PREFIX: () => UPDATE_ASSET_PREFIX,
  UPDATE_GIT_URL: () => UPDATE_GIT_URL,
  UPDATE_HOME_URL: () => UPDATE_HOME_URL,
  UPDATE_MANIFEST_URL: () => UPDATE_MANIFEST_URL,
  UPDATE_OWNER: () => UPDATE_OWNER,
  UPDATE_RELEASES_URL: () => UPDATE_RELEASES_URL,
  UPDATE_REPO: () => UPDATE_REPO,
  backupPath: () => backupPath,
  cmpVersion: () => cmpVersion,
  decideUpdate: () => decideUpdate,
  isAllowedAssetUrl: () => isAllowedAssetUrl,
  isLeftover: () => isLeftover,
  isNewer: () => isNewer,
  looksLikeExe: () => looksLikeExe,
  normalizeTag: () => normalizeTag,
  parseVersion: () => parseVersion,
  pickAsset: () => pickAsset,
  pickRelease: () => pickRelease,
  platformKey: () => platformKey,
  progressText: () => progressText,
  releaseVersion: () => releaseVersion,
  safeAssetName: () => safeAssetName,
  shouldNotify: () => shouldNotify
});
module.exports = __toCommonJS(update_check_exports);
var UPDATE_OWNER = "Nbcybg";
var UPDATE_REPO = "Killian-Editor-V2";
var R = `${UPDATE_OWNER}/${UPDATE_REPO}`;
var UPDATE_GIT_URL = `https://github.com/${R}.git`;
var UPDATE_HOME_URL = `https://github.com/${R}`;
var UPDATE_RELEASES_URL = `https://github.com/${R}/releases`;
var UPDATE_API_URL = `https://api.github.com/repos/${R}/releases?per_page=30`;
var UPDATE_MANIFEST_URL = `https://raw.githubusercontent.com/${R}/HEAD/package.json`;
var UPDATE_ASSET_PREFIX = `https://github.com/${R}/releases/download/`;
function normalizeTag(tag) {
  return String(tag == null ? "" : tag).trim().replace(/^[vV](?=\d)/, "");
}
function parseVersion(v) {
  const s = normalizeTag(v);
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(s);
  if (!m) return null;
  const nums = [+m[1], +(m[2] || 0), +(m[3] || 0)];
  const pre = m[4] ? m[4].split(".").map((p) => /^\d+$/.test(p) ? +p : p) : [];
  return { nums, pre };
}
function cmpVersion(a, b) {
  const A = parseVersion(a), B = parseVersion(b);
  if (!A || !B) return 0;
  for (let i = 0; i < 3; i++) {
    if (A.nums[i] !== B.nums[i]) return A.nums[i] > B.nums[i] ? 1 : -1;
  }
  if (!A.pre.length && !B.pre.length) return 0;
  if (!A.pre.length) return 1;
  if (!B.pre.length) return -1;
  const n = Math.max(A.pre.length, B.pre.length);
  for (let i = 0; i < n; i++) {
    const x = A.pre[i], y = B.pre[i];
    if (x === void 0) return -1;
    if (y === void 0) return 1;
    if (x === y) continue;
    const nx = typeof x === "number", ny = typeof y === "number";
    if (nx && ny) return x > y ? 1 : -1;
    if (nx !== ny) return nx ? -1 : 1;
    return String(x) > String(y) ? 1 : -1;
  }
  return 0;
}
function isNewer(a, b) {
  return cmpVersion(a, b) > 0;
}
function releaseVersion(rel) {
  if (!rel) return "";
  const tag = normalizeTag(rel.tag_name || rel.tag || "");
  if (parseVersion(tag)) return tag;
  const nm = normalizeTag(rel.name || "");
  return parseVersion(nm) ? nm : tag;
}
function pickRelease(releases, { allowPrerelease = true } = {}) {
  let best = null;
  for (const rel of releases || []) {
    if (!rel || rel.draft) continue;
    if (rel.prerelease && !allowPrerelease) continue;
    if (!parseVersion(releaseVersion(rel))) continue;
    if (!best || isNewer(releaseVersion(rel), releaseVersion(best))) best = rel;
  }
  return best;
}
function platformKey(p) {
  const s = String(p || "").toLowerCase();
  if (s === "win32" || s === "win" || s === "windows") return "win";
  if (s === "darwin" || s === "mac" || s === "macos") return "mac";
  return "linux";
}
var ASSET_RULES = {
  win: [/portable.*\.exe$/i, /\.exe$/i, /win.*\.zip$/i],
  mac: [/\.dmg$/i, /mac.*\.zip$/i, /darwin.*\.zip$/i],
  linux: [/\.appimage$/i, /linux.*\.zip$/i, /\.tar\.gz$/i]
};
function pickAsset(assets, plat) {
  const list = (assets || []).filter((a) => a && a.name && isAllowedAssetUrl(a.browser_download_url));
  for (const re of ASSET_RULES[platformKey(plat)] || []) {
    const hit = list.find((a) => re.test(String(a.name)));
    if (hit) return hit;
  }
  return null;
}
function isAllowedAssetUrl(url) {
  const s = String(url == null ? "" : url).trim();
  if (!s.startsWith(UPDATE_ASSET_PREFIX)) return false;
  if (s.length <= UPDATE_ASSET_PREFIX.length) return false;
  return !/[\s"'<>\\]/.test(s);
}
function decideUpdate({
  current,
  releases,
  manifestVersion = "",
  skip = "",
  platform = "win32",
  allowPrerelease = true
} = {}) {
  const rel = pickRelease(releases, { allowPrerelease });
  const version = rel ? releaseVersion(rel) : "";
  const base = {
    current: normalizeTag(current),
    version,
    release: rel || null,
    asset: null,
    assetUrl: "",
    assetName: "",
    assetSize: 0,
    url: rel && rel.html_url ? rel.html_url : UPDATE_RELEASES_URL,
    notes: rel && rel.body ? String(rel.body) : ""
  };
  if (rel && isNewer(version, current)) {
    if (skip && cmpVersion(skip, version) === 0) return { ...base, status: "skipped" };
    const asset = pickAsset(rel.assets, platform);
    if (asset) {
      return {
        ...base,
        status: "update",
        asset,
        assetUrl: asset.browser_download_url,
        assetName: asset.name,
        assetSize: asset.size || 0
      };
    }
    return { ...base, status: "noAsset" };
  }
  if (manifestVersion && isNewer(manifestVersion, current)) {
    return {
      ...base,
      status: "repoOnly",
      version: normalizeTag(manifestVersion),
      url: UPDATE_HOME_URL,
      notes: ""
    };
  }
  if (!rel) return { ...base, status: "none", url: UPDATE_RELEASES_URL };
  return { ...base, status: "latest" };
}
function shouldNotify(info) {
  return !!info && (info.status === "update" || info.status === "noAsset");
}
var OLD_SUFFIX = ".k2old";
function backupPath(exePath) {
  return String(exePath || "") + OLD_SUFFIX;
}
function isLeftover(name) {
  return String(name || "").endsWith(OLD_SUFFIX);
}
function safeAssetName(name, fallback = "killian2-update.bin") {
  const base = String(name || "").split(/[\\/]/).pop().trim();
  if (!base || base === "." || base === "..") return fallback;
  const clean = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
  return clean || fallback;
}
function looksLikeExe(bytes) {
  if (!bytes || bytes.length < 2) return false;
  return bytes[0] === 77 && bytes[1] === 90;
}
function progressText(received, total) {
  const mb = (n) => (Number(n) / 1048576).toFixed(1);
  if (!total) return mb(received) + " MB";
  return mb(received) + " / " + mb(total) + " MB";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OLD_SUFFIX,
  UPDATE_API_URL,
  UPDATE_ASSET_PREFIX,
  UPDATE_GIT_URL,
  UPDATE_HOME_URL,
  UPDATE_MANIFEST_URL,
  UPDATE_OWNER,
  UPDATE_RELEASES_URL,
  UPDATE_REPO,
  backupPath,
  cmpVersion,
  decideUpdate,
  isAllowedAssetUrl,
  isLeftover,
  isNewer,
  looksLikeExe,
  normalizeTag,
  parseVersion,
  pickAsset,
  pickRelease,
  platformKey,
  progressText,
  releaseVersion,
  safeAssetName,
  shouldNotify
});
