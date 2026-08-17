"use strict";
// 善缘六爻(Liuyao / I-Ching)排盘引擎 (vendored from mingyu-core, MIT)
// 京房八宫法：本卦/变卦/互卦、六神、六亲、纳甲地支、世应、空亡、卦宫、动爻。
// 纯函数入口：无 CLI / 无文件 IO / 无 process.argv / 无 server 依赖。
// 依赖(mingyu-core + tyme4ts + celestine)已 vendor 到 ./vendor/node_modules，
// 未改动 server/package.json / server/node_modules。
//
// mingyu-core 为 ESM，本入口用 file-URL 动态 import 加载(CJS 后端可 require)。
// 因此 compute 为 async。
//
// 用法:
//   const { computeLiuyao } = require('./lib/liuyao-engine');
//   const chart = await computeLiuyao({ date: new Date(), yaoArray:[7,8,9,6,7,8] });

const path = require("path");
const { pathToFileURL } = require("url");

const LIUYAO_DIST = path.join(
  __dirname,
  "vendor/node_modules/mingyu-core/dist/divination/algorithms/liuyao.js"
);

let _mod = null;
async function loadMod() {
  if (!_mod) _mod = await import(pathToFileURL(LIUYAO_DIST).href);
  return _mod;
}

/**
 * 六爻排盘。
 *
 * @param {Object} [opts]
 * @param {Date|string|number} [opts.date=now] 起卦时间 (默认当前时刻)。
 * @param {number[]} [opts.yaoArray] 六爻手动起卦爻值(自下而上,初爻在前)：
 *        6=老阴(动) 7=少阳 8=少阴 9=老阳(动)。不传则按时间自动起卦。
 * @param {Array<{coins:number[],total:number}>} [opts.coinThrows] 三枚铜钱摇卦记录(每枚 2 或 3)。
 * @param {Object} [opts.options] 透传给 mingyu generateLiuyao 的其余选项。
 * @returns {Promise<Object>} 完整卦象：originalName(本卦)/changedName(变卦)/
 *        interName(互卦)/changingYaos(动爻)/sixGods/sixRelatives/najiaDizhi/
 *        worldAndResponse(世应)/voidBranches(空亡)/palace(卦宫)/ganzhi/...
 */
async function computeLiuyao(opts) {
  const o = opts || {};
  const { generateLiuyao } = await loadMod();
  const date = o.date != null ? new Date(o.date) : new Date();

  const options = Object.assign({}, o.options);
  if (Array.isArray(o.yaoArray)) {
    if (o.yaoArray.length !== 6) {
      throw new Error("computeLiuyao: yaoArray 必须为 6 个爻值(6/7/8/9)");
    }
    // mingyu 手工起卦: method='manual' + yaos[]
    options.method = "manual";
    options.yaos = o.yaoArray;
  } else if (Array.isArray(o.coinThrows)) {
    // 三枚铜钱摇卦: method='coins' + coinThrows[]
    options.method = "coins";
    options.coinThrows = o.coinThrows;
  }
  // 否则默认按时间起卦 (method 由 mingyu 依据无 yaos 推断为 'time')

  const chart = generateLiuyao(date, options);
  return chart;
}

module.exports = { computeLiuyao };
