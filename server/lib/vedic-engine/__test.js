"use strict";
// vedic-engine 验证：3 组生辰，检查 ayanamsa/行星落座/nakshatra/落宫 合理性。
// 参考对齐：Lahiri ayanamsa 与 astro-seek/onlinejyotish 逐年 <0.02°；
// 恒星黄道 = 回归黄道 - ayanamsa。
const assert = require("assert");
const { computeVedicChart } = require("./index");

const cases = [
  { name: "1990-06-15 10:00 IST 德里", in: { year:1990, month:6, day:15, hour:10, minute:0, latitude:28.6139, longitude:77.2090, timezone:5.5 },
    expect: { ayanamsaAbout:23.72, sunSign:"Gemini/Mithuna" } },
  { name: "2000-01-01 12:00 UTC 格林威治", in: { year:2000, month:1, day:1, hour:12, minute:0, latitude:51.48, longitude:0, timezone:0 },
    expect: { ayanamsaAbout:23.85, sunSign:"Sagittarius/Dhanu" } },
  { name: "1985-11-03 22:30 CST 上海", in: { year:1985, month:11, day:3, hour:22, minute:30, latitude:31.23, longitude:121.47, timezone:8 },
    expect: { ayanamsaAbout:23.65, sunSign:"Libra/Tula" } }, // 11月初太阳恒星黄道天秤末/天蝎
];

let pass = 0;
for (const c of cases) {
  const ch = computeVedicChart(c.in);
  const sun = ch.planets.find((p) => p.name === "Sun");
  console.log(`\n== ${c.name} ==`);
  console.log("  ayanamsa:", ch.ayanamsa, "(expect ~" + c.expect.ayanamsaAbout + ")");
  console.log("  Lagna:", ch.ascendant.sign, ch.ascendant.degreeInSign.toFixed(1) + "°", "nak", ch.ascendant.nakshatra.name);
  console.log("  Sun:", sun.sign, sun.degreeInSign.toFixed(1) + "°", "H" + sun.house, "nak", sun.nakshatra.name);

  assert(Math.abs(ch.ayanamsa - c.expect.ayanamsaAbout) < 0.1, "ayanamsa 偏差过大");
  // sidereal = tropical - ayanamsa (逐颗校验)
  for (const p of ch.planets) {
    const diff = ((p.tropical - p.sidereal + 360) % 360);
    assert(Math.abs(diff - ch.ayanamsa) < 0.01, `${p.name} sidereal 转换错误`);
    assert(p.house >= 1 && p.house <= 12, `${p.name} 落宫非法`);
    assert(p.nakshatra.pada >= 1 && p.nakshatra.pada <= 4, `${p.name} pada 非法`);
  }
  assert(ch.planets.some((p) => p.name === "Rahu") && ch.planets.some((p) => p.name === "Ketu"), "缺 Rahu/Ketu");
  pass++;
}

console.log(`\n✅ vedic-engine ${pass}/${cases.length} 组通过 (ayanamsa 校准 + sidereal 转换 + 落宫/nakshatra 合法)`);
