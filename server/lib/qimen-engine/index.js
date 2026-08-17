"use strict";
// 善缘奇门遁甲(Qimen Dunjia)排盘引擎 (vendored from mingyu-core, MIT)
// 拆补/置闰定局、值符值使、九宫格、三奇六仪八门九星八神、驿马、空亡、格局。
// 纯函数入口：无 CLI / 无文件 IO / 无 process.argv / 无 server 依赖。
// 依赖(mingyu-core + tyme4ts + celestine)已 vendor 到 ./vendor/node_modules，
// 未改动 server/package.json / server/node_modules。
//
// mingyu-core 为 ESM，本入口用 file-URL 动态 import 加载(CJS 后端可 require)。
// 因此 compute 为 async。
//
// 用法:
//   const { computeQimen } = require('./lib/qimen-engine');
//   const chart = await computeQimen({ date: new Date(), method:'zhuanpan', scope:'hour' });

const path = require("path");
const { pathToFileURL } = require("url");

const QIMEN_DIST = path.join(
  __dirname,
  "vendor/node_modules/mingyu-core/dist/divination/algorithms/qimen/index.js"
);

let _mod = null;
async function loadMod() {
  if (!_mod) _mod = await import(pathToFileURL(QIMEN_DIST).href);
  return _mod;
}

/**
 * 奇门遁甲排盘。
 *
 * @param {Object} [opts]
 * @param {Date|string|number} [opts.date=now] 起局时间 (默认当前时刻)。
 * @param {('zhuanpan'|'feipan')} [opts.method='zhuanpan'] 转盘 / 飞盘。
 * @param {('year'|'month'|'day'|'hour')} [opts.scope='hour'] 起局层级(常用时家 hour)。
 * @param {('chaibu'|'zhirun'|'maoshan')} [opts.juMethod='chaibu'] 定局法(拆补/置闰)。
 * @returns {Promise<Object>} 完整局盘：juShu(局数)/isYangDun(阴阳遁)/zhiFu(值符)/
 *        zhiShi(值使)/jiuGongGe(九宫格)/patternTags(格局)/horseStar(驿马)/
 *        voidPalaces(空宫)/directions(方位吉凶)/timeInfo/ganzhi/...
 */
async function computeQimen(opts) {
  const o = opts || {};
  const { generateQimen } = await loadMod();
  const date = o.date != null ? new Date(o.date) : new Date();
  const method = o.method || "zhuanpan";
  const scope = o.scope || "hour";
  const juMethod = o.juMethod || "chaibu";
  return generateQimen(date, method, scope, juMethod);
}

module.exports = { computeQimen };
