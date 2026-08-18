"use strict";
// 善缘吠陀(Vedic/Jyotish)排盘引擎 (vendored)
// 真天文计算：celestine(MIT·零依赖·VSOP87/Meeus·对齐 NASA/JPL/Swiss Ephemeris)
// + Lahiri ayanamsa 恒星黄道转换层(本地 lahiri.js·已对参考值校验 <0.01°)。
// 纯函数入口：无 CLI / 无文件 IO / 无 process.argv / 无外部 npm 依赖。
//
// 用法:
//   const { computeVedicChart } = require('./lib/vedic-engine');
//   const chart = computeVedicChart({ year:1990, month:6, day:15, hour:10, minute:0,
//                                     latitude:28.6139, longitude:77.2090, timezone:5.5 });
//
// LLM 只做解读、不做排盘：行星落宫/落座与 nakshatra 全部由本引擎精确给出。

const celestine = require("./vendor/celestine/dist/index.cjs");
const { toJulianDayUT, lahiriAyanamsa, toSidereal, norm360 } = require("./lahiri");
const { computeVimshottari } = require("./vimshottari");

// 吠陀 12 星座 (Rashi)，索引 0=白羊
const RASHIS = [
  "Aries/Mesha", "Taurus/Vrishabha", "Gemini/Mithuna", "Cancer/Karka",
  "Leo/Simha", "Virgo/Kanya", "Libra/Tula", "Scorpio/Vrishchika",
  "Sagittarius/Dhanu", "Capricorn/Makara", "Aquarius/Kumbha", "Pisces/Meena",
];
const RASHIS_ZH = [
  "白羊(牡羊)", "金牛", "双子", "巨蟹", "狮子", "处女", "天秤",
  "天蝎", "射手(人马)", "摩羯", "水瓶", "双鱼",
];

// 27 nakshatra (月宿)，每宿 13°20'
const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

const NAK_SIZE = 360 / 27; // 13.3333...

function siderealToRashi(lon) {
  const idx = Math.floor(norm360(lon) / 30) % 12;
  const degInSign = norm360(lon) - idx * 30;
  return { signIndex: idx, sign: RASHIS[idx], signZh: RASHIS_ZH[idx], degreeInSign: +degInSign.toFixed(4) };
}

function siderealToNakshatra(lon) {
  const l = norm360(lon);
  const idx = Math.floor(l / NAK_SIZE) % 27;
  const within = l - idx * NAK_SIZE;
  const pada = Math.floor(within / (NAK_SIZE / 4)) + 1; // 每宿 4 pada
  return { index: idx, name: NAKSHATRAS[idx], pada };
}

/**
 * 计算完整吠陀命盘 (sidereal, Lahiri, 默认整宫制 whole-sign)。
 *
 * @param {Object} opts
 * @param {number} opts.year
 * @param {number} opts.month  1-12
 * @param {number} opts.day
 * @param {number} opts.hour   0-23 (本地钟点)
 * @param {number} [opts.minute=0]
 * @param {number} opts.latitude   出生地纬度 (北正)
 * @param {number} opts.longitude  出生地经度 (东正)
 * @param {number} opts.timezone   时区偏移小时 (如印度 5.5, 中国 8)
 * @param {string} [opts.houseSystem='whole-sign']
 * @returns {Object} { meta, ayanamsa, ascendant, planets[], houses, angles }
 */
function computeVedicChart(opts) {
  if (!opts || typeof opts !== "object") {
    throw new Error("computeVedicChart: opts is required");
  }
  const required = ["year", "month", "day", "hour", "latitude", "longitude", "timezone"];
  for (const k of required) {
    if (opts[k] === undefined || opts[k] === null || opts[k] === "") {
      throw new Error(`computeVedicChart: missing required field '${k}'`);
    }
  }

  const birth = {
    year: +opts.year,
    month: +opts.month,
    day: +opts.day,
    hour: +opts.hour,
    minute: opts.minute != null ? +opts.minute : 0,
    latitude: +opts.latitude,
    longitude: +opts.longitude,
    timezone: +opts.timezone,
  };

  // celestine: 精确 tropical(回归)行星/交点/宫始/上升点
  const houseSystem = opts.houseSystem || "whole-sign";
  const tChart = celestine.calculateChart(birth, { houseSystem });

  // 儒略日(UT) 用于 ayanamsa
  const utHour = birth.hour - birth.timezone;
  const jd = toJulianDayUT(birth.year, birth.month, birth.day, utHour, birth.minute, 0);
  const ayan = lahiriAyanamsa(jd);

  const conv = (tropLon) => {
    const sid = toSidereal(tropLon, jd);
    return { tropical: +norm360(tropLon).toFixed(4), sidereal: +sid.toFixed(4), ...siderealToRashi(sid), nakshatra: siderealToNakshatra(sid) };
  };

  // 行星 (含 Rahu/Ketu = 北/南交点)
  const planets = [];
  for (const p of tChart.planets || []) {
    planets.push({
      name: p.name,
      retrograde: !!p.isRetrograde,
      ...conv(p.longitude),
    });
  }
  for (const n of tChart.nodes || []) {
    const vedicName = n.name === "North Node" ? "Rahu" : n.name === "South Node" ? "Ketu" : n.name;
    planets.push({ name: vedicName, retrograde: true, ...conv(n.longitude) });
  }

  // 上升点 Lagna / 中天
  const asc = tChart.angles && tChart.angles.ascendant;
  const mc = tChart.angles && tChart.angles.midheaven;
  const ascendant = asc ? conv(asc.longitude) : null;
  const midheaven = mc ? conv(mc.longitude) : null;

  // 吠陀宫位：以 Lagna 所在 rashi 为第1宫(整宫制)，逐行星判落宫
  const lagnaSignIndex = ascendant ? ascendant.signIndex : 0;
  for (const pl of planets) {
    pl.house = ((pl.signIndex - lagnaSignIndex + 12) % 12) + 1;
  }

  // Vimshottari Mahadasha — 由 Moon 恒星黄经起算 (真实大运, 非随机)
  let dasha = null;
  try {
    const moon = planets.find((p) => p.name === "Moon");
    if (moon) {
      dasha = computeVimshottari(moon.sidereal, {
        year: birth.year, month: birth.month, day: birth.day,
        hour: birth.hour, minute: birth.minute,
      });
    }
  } catch (e) {
    dasha = null; // 大运失败不阻断整盘
  }

  return {
    meta: {
      engine: "vedic-engine (celestine + Lahiri)",
      houseSystem,
      julianDayUT: +jd.toFixed(6),
      ayanamsaName: "Lahiri (Chitrapaksha)",
    },
    ayanamsa: +ayan.toFixed(4),
    ascendant,   // Lagna
    midheaven,
    planets,     // 每颗含 sidereal 经度/rashi/nakshatra/落宫/逆行
    lagnaSign: ascendant ? { index: lagnaSignIndex, sign: RASHIS[lagnaSignIndex], signZh: RASHIS_ZH[lagnaSignIndex] } : null,
    dasha,       // Vimshottari 大运 (由 Moon nakshatra 起算 · 当前 Maha/Antar + 起止年)
  };
}

module.exports = { computeVedicChart };
