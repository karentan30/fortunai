"use strict";
// 善缘八字排盘引擎 (vendored from bazi-ziwei/calculator)
// 纯函数入口: 无 CLI / 无文件 IO / 无 process.argv
//
// 用法:
//   const { computeBaziChart } = require('./lib/bazi-engine');
//   const { bazi, ziwei } = computeBaziChart({ year:1990, month:6, day:15, hour:10, minute:0, gender:'male' });
//
// 计算逻辑与源引擎 `node dist/run-chart.js` 完全一致 (见 __test.js 对比证据)。

const { createChart } = require("./yiqi-core/index");
const { getZhiCangGanFull } = require("./yiqi-core/bazi");
const { enrichBazi } = require("./bazi-enrich/enrich");

/**
 * 计算完整八字命盘 (含富对象补层)。
 *
 * @param {Object} opts
 * @param {number} opts.year   出生年 (阳历, 若 isLunar=true 则为农历年)
 * @param {number} opts.month  出生月
 * @param {number} opts.day    出生日
 * @param {number} opts.hour   出生时 (0-23)
 * @param {number} [opts.minute=0] 出生分
 * @param {('male'|'female'|'男'|'女')} opts.gender 性别
 * @param {boolean} [opts.isLunar=false] 是否农历输入
 * @param {number} [opts.timeZone=8] 时区 (默认东八区)
 * @param {boolean} [opts.includeZiwei=true] 是否在返回值中保留紫微盘
 * @returns {{ bazi: Object, ziwei?: Object }} 顶层结构同源引擎 run-chart.js
 */
function computeBaziChart(opts) {
  if (!opts || typeof opts !== "object") {
    throw new Error("computeBaziChart: opts is required");
  }
  const required = ["year", "month", "day", "hour", "gender"];
  for (const k of required) {
    if (opts[k] === undefined || opts[k] === null || opts[k] === "") {
      throw new Error(`computeBaziChart: missing required field '${k}'`);
    }
  }

  const gender =
    opts.gender === "male" || opts.gender === "female"
      ? opts.gender
      : opts.gender === "男"
        ? "male"
        : "female";

  const birthInfo = {
    year: +opts.year,
    month: +opts.month,
    day: +opts.day,
    hour: +opts.hour,
    minute: opts.minute !== undefined && opts.minute !== null ? +opts.minute : 0,
    isLunar: opts.isLunar === true || opts.isLunar === "true",
    gender: gender,
    timeZone: opts.timeZone !== undefined ? +opts.timeZone : 8,
  };

  // Step 1: Yiqi 算法层 — 四柱 + 紫微 + 大运 + 流年
  const chart = createChart(birthInfo);

  // 附加地支藏干 (含十神)
  const dm = chart.bazi.dayMaster;
  const z = chart.bazi.siZhu;
  chart.bazi.cangGan = {
    year: getZhiCangGanFull(z.year.zhi, dm),
    month: getZhiCangGanFull(z.month.zhi, dm),
    day: getZhiCangGanFull(z.day.zhi, dm),
    hour: getZhiCangGanFull(z.hour.zhi, dm),
  };

  // 补 endAge 字段 (Yiqi 只给了 startAge, 下游脚本会查 endAge)
  if (chart.bazi.dayun && Array.isArray(chart.bazi.dayun)) {
    for (const d of chart.bazi.dayun) {
      if (d.startAge !== undefined && d.endAge === undefined) {
        d.endAge = d.startAge + 9;
      }
    }
  }

  // Step 2: enrichBazi 补层 — 格局 / 旺衰 / 调候 / 刑冲合害 / 盖头
  const siZhuForEnrich = {
    年: chart.bazi.siZhu.year,
    月: chart.bazi.siZhu.month,
    日: chart.bazi.siZhu.day,
    时: chart.bazi.siZhu.hour,
  };
  chart.bazi.enrichment = enrichBazi(siZhuForEnrich);

  const includeZiwei = opts.includeZiwei !== false;
  if (!includeZiwei) {
    delete chart.ziwei;
  }

  return chart;
}

module.exports = { computeBaziChart };
