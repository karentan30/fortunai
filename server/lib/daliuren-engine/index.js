"use strict";
// 善缘大六壬排盘引擎 (vendored from mingyu-core via liuyao-engine vendor, MIT)
// ESM 动态 import 包装，同 qimen-engine/index.js 模式。
const path = require("path");
const { pathToFileURL } = require("url");

const LIUREN_DIST = path.join(
  __dirname,
  "../liuyao-engine/vendor/node_modules/mingyu-core/dist/divination/algorithms/liuren/index.js"
);

let _mod = null;
async function loadMod() {
  if (!_mod) _mod = await import(pathToFileURL(LIUREN_DIST).href);
  return _mod;
}

async function computeDaLiuRen(opts) {
  const o = opts || {};
  const { generateLiuren } = await loadMod();
  const date = o.date != null ? new Date(o.date) : new Date();
  return generateLiuren(date);
}

module.exports = { computeDaLiuRen };
