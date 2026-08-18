"use strict";
// Runae · Western Astrology Engine (Tropical Zodiac)
// Real astronomical calculation via celestine (VSOP87/Meeus) — NO Lahiri ayanamsa correction.
// Western astrology = tropical zodiac: longitude 0° = vernal equinox. Use directly.
//
// Key difference from vedic-engine: zero ayanamsa correction — tropical IS the zodiac.
//
// Computes:
//   - Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
//   - Ascendant (Rising sign) — requires birth time + lat/lng
//   - 12 houses (Placidus; whole-sign fallback)
//   - Major aspects: conjunction, opposition, square, trine, sextile
//
// LLM only interprets — NEVER fabricates positions.

// Resolve celestine: try the local vendor path first (production server).
// In git worktrees, untracked build artifacts (dist/) are absent — fall back to
// the main project checkout at /Users/karen/projects/shenyuan.
let celestine;
(function resolveCelestine() {
  const path = require("path");
  const candidates = [
    // 1. standard path when running from the real server/ tree
    path.join(__dirname, "../vedic-engine/vendor/celestine/dist/index.cjs"),
    // 2. main project checkout (always present on this machine)
    "/Users/karen/projects/shenyuan/server/lib/vedic-engine/vendor/celestine/dist/index.cjs",
    // 3. liuyao-engine vendor copy (also on main checkout)
    "/Users/karen/projects/shenyuan/server/lib/liuyao-engine/vendor/node_modules/celestine/dist/index.cjs",
  ];
  for (const c of candidates) {
    try { celestine = require(c); return; } catch (_) {}
  }
  // 加载失败不在此 throw —— 否则会拖垮整个后端 boot（本模块被 index.js 顶层 require）。
  // 保持 celestine=undefined，改由 computeWesternChart 在真正被调用时才报错。
  console.warn("[western-astro-engine] celestine dist 未找到，西方占星功能不可用（其余功能正常）");
})();

// Western 12 signs (tropical), index 0 = Aries (0°-30°)
const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

// Symbol glyphs for display
const SIGN_SYMBOLS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

const PLANET_SYMBOLS = {
  Sun: "☀️", Moon: "🌙", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "⛢", Neptune: "♆", Pluto: "♇",
};

// Core planets for Western chart (ordered by traditional then modern)
const CORE_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars",
                      "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

// Aspect definitions: name, angle, orb
const ASPECT_DEFS = [
  { name: "conjunct",   angle: 0,   orb: 8  },
  { name: "opposition", angle: 180, orb: 8  },
  { name: "square",     angle: 90,  orb: 8  },
  { name: "trine",      angle: 120, orb: 8  },
  { name: "sextile",    angle: 60,  orb: 6  },
];

const ASPECT_SYMBOLS = {
  conjunct: "☌", opposition: "☍", square: "□", trine: "△", sextile: "⚹",
};

/** Normalize longitude to [0, 360). */
function norm360(x) {
  return ((x % 360) + 360) % 360;
}

/** Map tropical longitude → zodiac sign info. */
function toZodiacSign(tropLon) {
  const lon = norm360(tropLon);
  const idx = Math.floor(lon / 30) % 12;
  const degInSign = lon - idx * 30;
  const d = Math.floor(degInSign);
  const m = Math.floor((degInSign - d) * 60);
  return {
    longitude: +lon.toFixed(4),
    signIndex: idx,
    sign: SIGNS[idx],
    symbol: SIGN_SYMBOLS[idx],
    degreeInSign: +degInSign.toFixed(4),
    formatted: `${d}°${String(m).padStart(2, "0")}' ${SIGNS[idx]}`,
  };
}

/**
 * Compute complete Western tropical chart.
 *
 * @param {Object} opts
 * @param {number} opts.year
 * @param {number} opts.month   1-12
 * @param {number} opts.day
 * @param {number} [opts.hour]     local hour (0-23) — optional; omit/null → Sun-only mode
 * @param {number} [opts.minute=0]
 * @param {number} [opts.latitude]  birth latitude — required for Ascendant/houses
 * @param {number} [opts.longitude] birth longitude
 * @param {number} [opts.timezone]  UTC offset in hours (e.g. -5 for EST)
 * @returns {Object} { meta, planets[], ascendant, houses[], aspects[], hasFullChart }
 */
function computeWesternChart(opts) {
  if (!celestine) throw new Error("western-astro-engine: celestine 天文库不可用（服务器缺 vendor/celestine/dist）");
  if (!opts || typeof opts !== "object") throw new Error("computeWesternChart: opts required");

  const year  = +opts.year;
  const month = +opts.month;
  const day   = +opts.day;
  if (!year || !month || !day) throw new Error("computeWesternChart: year/month/day required");

  const hasTime  = opts.hour !== undefined && opts.hour !== null && opts.hour !== "";
  const hasPlace = opts.latitude  !== undefined && opts.latitude  !== null &&
                   opts.longitude !== undefined && opts.longitude !== null &&
                   opts.timezone  !== undefined && opts.timezone  !== null;
  const hasFullChart = hasTime && hasPlace;

  const hour      = hasTime  ? +opts.hour      : 12; // noon default for Sun-only
  const minute    = opts.minute != null ? +opts.minute : 0;
  const latitude  = hasPlace ? +opts.latitude  : 0;
  const longitude = hasPlace ? +opts.longitude : 0;
  const timezone  = hasPlace ? +opts.timezone  : 0;

  const birth = { year, month, day, hour, minute, latitude, longitude, timezone };

  // celestine calculates tropical positions (no ayanamsa) — exactly what Western needs
  const houseSystem = hasFullChart ? "placidus" : "whole-sign";
  const tChart = celestine.calculateChart(birth, { houseSystem });

  // --- Planets ---
  const planets = [];
  for (const name of CORE_PLANETS) {
    const p = (tChart.planets || []).find(x => x.name === name);
    if (!p) continue;
    const zodiac = toZodiacSign(p.longitude);
    planets.push({
      name,
      symbol: PLANET_SYMBOLS[name] || "",
      retrograde: !!p.isRetrograde,
      house: hasFullChart ? (p.house || null) : null,
      ...zodiac,
    });
  }

  // --- Ascendant & Midheaven ---
  let ascendant = null;
  let midheaven = null;
  if (hasFullChart && tChart.angles) {
    const asc = tChart.angles.ascendant;
    const mc  = tChart.angles.midheaven;
    if (asc) ascendant = { ...toZodiacSign(asc.longitude), label: "Ascendant (Rising)" };
    if (mc)  midheaven = { ...toZodiacSign(mc.longitude),  label: "Midheaven (MC)" };
  }

  // --- Houses ---
  let houses = [];
  if (hasFullChart && tChart.houses && tChart.houses.cusps) {
    houses = tChart.houses.cusps.map(c => ({
      house: c.house,
      ...toZodiacSign(c.longitude),
    }));
  }

  // --- Aspects (core planets only, from celestine pre-computed set) ---
  const aspects = [];
  if (tChart.aspects && tChart.aspects.all) {
    for (const asp of tChart.aspects.all) {
      // only include if both bodies are core planets
      if (!CORE_PLANETS.includes(asp.body1) || !CORE_PLANETS.includes(asp.body2)) continue;
      // map celestine's "conjunction" to our "conjunct"
      const typeName = asp.type === "conjunction" ? "conjunct" : asp.type;
      if (!ASPECT_DEFS.find(d => d.name === typeName)) continue;
      const orb = +asp.deviation.toFixed(2);
      aspects.push({
        planet1: asp.body1,
        planet2: asp.body2,
        type: typeName,
        symbol: ASPECT_SYMBOLS[typeName] || "",
        angle: asp.angle,
        orb,
        isApplying: asp.isApplying,
      });
    }
    // Sort by tightness (smaller orb = stronger)
    aspects.sort((a, b) => a.orb - b.orb);
  }

  return {
    meta: {
      engine: "western-astro-engine (celestine tropical)",
      zodiac: "Tropical (Western)",
      houseSystem,
      hasFullChart,
    },
    planets,
    ascendant,
    midheaven,
    houses,
    aspects,
  };
}

module.exports = { computeWesternChart, SIGNS, SIGN_SYMBOLS, PLANET_SYMBOLS };
