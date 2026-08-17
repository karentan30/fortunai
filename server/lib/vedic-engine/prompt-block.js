"use strict";
// 善缘 · 吠陀精确排盘 → LLM prompt 注入块
// 用真天文引擎(celestine + Lahiri)预排盘，生成「不得自行推算」文本，LLM 只解读。
const { computeVedicChart } = require("./index");

// 输入: { year, month, day, hour, minute, latitude, longitude, timezone }
// 返回排盘文本块；任何异常返回空串(降级为 LLM 自排，不阻断出报告)。
function buildVedicBlock(input) {
  try {
    const c = computeVedicChart(input);
    const line = (p) =>
      `${p.name}: ${p.sign} ${p.degreeInSign.toFixed(1)}° 第${p.house}宫 (${p.nakshatra.name} pada${p.nakshatra.pada})${p.retrograde ? " 逆行" : ""}`;
    const core = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"]
      .map((n) => c.planets.find((p) => p.name === n))
      .filter(Boolean)
      .map(line)
      .join("\n");
    return `【吠陀精确排盘(Vedic/Jyotish·恒星黄道·Lahiri ayanamsa ${c.ayanamsa}°·真天文计算·以下数据请严格使用，禁止自行推算行星落座/落宫)】
上升(Lagna)：${c.ascendant.sign} ${c.ascendant.degreeInSign.toFixed(1)}° (${c.ascendant.nakshatra.name})
${core}
房宫制：整宫制(whole-sign)，以 Lagna 所在星座为第1宫。`;
  } catch (err) {
    console.warn("[vedic-engine] buildVedicBlock 失败，降级为AI自排:", err && err.message);
    return "";
  }
}

module.exports = { buildVedicBlock };
