"use strict";
// 善缘 · 吠陀精确排盘 → LLM prompt 注入块
// 用真天文引擎(celestine VSOP87 + Lahiri ayanamsa)预排盘, 生成「不得自行推算」文本, LLM 只解读。
// 真实 Lagna(出生时刻+经纬度+恒星时) / 月亮 Rashi+Nakshatra / 九曜落座 / Vimshottari 当前大运。
// 任何异常返回空串(降级为 LLM 自排, 不阻断出报告)。
const { computeVedicChart } = require("./index");

// 输入(与 computeVedicChart 一致):
//   { year, month, day, hour, minute, latitude, longitude, timezone, houseSystem? }
function buildVedicBlock(input) {
  try {
    const c = computeVedicChart(input);
    if (!c || !c.ascendant) return "";

    const line = (p) =>
      `${p.name}: ${p.sign} ${p.degreeInSign.toFixed(1)}° 第${p.house}宫 (${p.nakshatra.name} pada${p.nakshatra.pada})${p.retrograde ? " 逆行℞" : ""}`;

    const core = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"]
      .map((n) => c.planets.find((p) => p.name === n))
      .filter(Boolean)
      .map(line)
      .join("\n");

    const moon = c.planets.find((p) => p.name === "Moon");
    const moonLine = moon
      ? `月亮星座(Rashi/Janma Rashi)：${moon.sign} ${moon.degreeInSign.toFixed(1)}°  出生宿(Janma Nakshatra)：${moon.nakshatra.name} pada${moon.nakshatra.pada}`
      : "";

    // Vimshottari 大运(真实, 由 Moon nakshatra 起算)
    let dashaBlock = "";
    if (c.dasha && c.dasha.current && c.dasha.current.maha) {
      const m = c.dasha.current.maha;
      const a = c.dasha.current.antar;
      const fmtYear = (y) => Math.floor(y); // 展示整数年
      const mahaStr = `${m.planet}(${m.planetZh})大运  约 ${fmtYear(m.startYear)}–${fmtYear(m.endYear)} 年`;
      const antarStr = a
        ? `  ·  当前次运(Antardasha/Bhukti)：${a.planet}(${a.planetZh})  约 ${fmtYear(a.startYear)}–${fmtYear(a.endYear)} 年`
        : "";
      dashaBlock = `当前大运(Vimshottari Mahadasha)：${mahaStr}${antarStr}`;
    }

    return `【吠陀精确排盘(Vedic/Jyotish · 恒星黄道 · Lahiri ayanamsa ${c.ayanamsa}° · 真天文计算 · 以下数据请严格使用, 禁止自行推算行星落座/落宫/大运)】
上升(Lagna/Ascendant)：${c.ascendant.sign} ${c.ascendant.degreeInSign.toFixed(1)}° (${c.ascendant.nakshatra.name} pada${c.ascendant.nakshatra.pada})
${moonLine}
九曜落座(sidereal)：
${core}${dashaBlock ? "\n" + dashaBlock : ""}
房宫制：整宫制(whole-sign), 以 Lagna 所在星座为第1宫。
【以上为引擎精确排盘, 严禁篡改或凭空生成任何行星位置/大运】`;
  } catch (err) {
    console.warn("[vedic-engine] buildVedicBlock 失败, 降级为AI自排:", err && err.message);
    return "";
  }
}

module.exports = { buildVedicBlock };
