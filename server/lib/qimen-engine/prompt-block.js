"use strict";
// 善缘 · 奇门遁甲精确排盘 → LLM prompt 注入块 (async, 因 mingyu 为 ESM 动态加载)
const { computeQimen } = require("./index");

// 输入: { date?, method?, scope?, juMethod? }
// 返回 Promise<string>；异常返回空串(降级 LLM 自排)。
async function buildQimenBlock(input) {
  try {
    const q = await computeQimen(input || {});
    const tags = (q.patternTags || []).slice(0, 6).join("；");
    const horse = q.horseStar && q.horseStar.branch ? `${q.horseStar.branch}(${q.horseStar.name || "宫" + q.horseStar.palace})` : "—";
    return `【奇门遁甲精确排盘(拆补定局·转盘·以下局盘请严格使用，禁止自行起局/改盘)】
局：${q.isYangDun ? "阳" : "阴"}遁${q.juShu}局　节气：${q.timeInfo.solarTerm}(${q.timeInfo.epoch})
值符星：${q.zhiFu}　值使门：${q.zhiShi}
干支：年${q.ganzhi.year} 月${q.ganzhi.month} 日${q.ganzhi.day} 时${q.ganzhi.hour}
空亡：${(q.voidBranches || []).join("")}　驿马：${horse}
格局：${tags || "—"}`;
  } catch (err) {
    console.warn("[qimen-engine] buildQimenBlock 失败，降级为AI自排:", err && err.message);
    return "";
  }
}

module.exports = { buildQimenBlock };
