"use strict";
// 善缘 · 六爻精确排盘 → LLM prompt 注入块 (async, 因 mingyu 为 ESM 动态加载)
const { computeLiuyao } = require("./index");

// 输入: { date?, yaoArray?, coinThrows? }
// 返回 Promise<string>；异常返回空串(降级 LLM 自排)。
async function buildLiuyaoBlock(input) {
  try {
    const c = await computeLiuyao(input || {});
    const moving = (c.changingYaos || []).map((y) => `${y.position}爻${y.type}`).join("、") || "无(静卦)";
    const wr = Array.isArray(c.worldAndResponse) ? c.worldAndResponse : [];
    const worldPos = wr.indexOf("世") + 1;
    const respPos = wr.indexOf("应") + 1;
    const palaceName = c.palace && c.palace.name ? `${c.palace.name}(${c.palace.wuxing || ""})` : c.palace;
    return `【六爻精确排盘(京房八宫法·纳甲装卦·以下卦象请严格使用，禁止自行起卦/改爻)】
本卦：${c.originalName}　变卦：${c.changedName}　互卦：${c.interName}
六亲(初→上)：${c.sixRelatives.join(" ")}
纳甲地支：${c.najiaDizhi.join(" ")}　六神：${(c.sixGods || []).join(" ")}
世应：世${worldPos}爻 应${respPos}爻　空亡：${(c.voidBranches || []).join("")}
卦宫：${palaceName}　动爻：${moving}
干支：年${c.ganzhi.year} 月${c.ganzhi.month} 日${c.ganzhi.day} 时${c.ganzhi.hour}`;
  } catch (err) {
    console.warn("[liuyao-engine] buildLiuyaoBlock 失败，降级为AI自排:", err && err.message);
    return "";
  }
}

module.exports = { buildLiuyaoBlock };
