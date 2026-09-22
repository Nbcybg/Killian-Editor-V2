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

// src/timing.js
var timing_exports = {};
__export(timing_exports, {
  RETRY_BASE_MS: () => RETRY_BASE_MS,
  RETRY_MAX_MS: () => RETRY_MAX_MS,
  SCRATCH_SAVE_DELAY_MS: () => SCRATCH_SAVE_DELAY_MS,
  SPLASH_MAX_MS: () => SPLASH_MAX_MS,
  UPDATE_FETCH_TIMEOUT_MS: () => UPDATE_FETCH_TIMEOUT_MS,
  retryBackoff: () => retryBackoff
});
module.exports = __toCommonJS(timing_exports);
var SPLASH_MAX_MS = 3e4;
var UPDATE_FETCH_TIMEOUT_MS = 2e4;
var SCRATCH_SAVE_DELAY_MS = 3e3;
var RETRY_BASE_MS = 500;
var RETRY_MAX_MS = 8e3;
function retryBackoff(n) {
  const k = Number.isFinite(+n) && +n > 0 ? Math.floor(+n) : 0;
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, k));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  SCRATCH_SAVE_DELAY_MS,
  SPLASH_MAX_MS,
  UPDATE_FETCH_TIMEOUT_MS,
  retryBackoff
});
