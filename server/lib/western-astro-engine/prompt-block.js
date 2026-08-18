"use strict";
// Runae · Western Astrology chart → LLM prompt injection block
// Builds an honest, data-only text block for the LLM to interpret.
// LLM MUST NOT invent or change any planetary positions — all from the engine.

const { computeWesternChart } = require("./index");

/**
 * Build a Western astrology prompt block.
 *
 * @param {Object} p
 * @param {number} p.birthYear
 * @param {number} p.birthMonth
 * @param {number} p.birthDay
 * @param {number} [p.birthHour]
 * @param {number} [p.birthMinute]
 * @param {number} [p.lat]
 * @param {number} [p.lng]
 * @param {number} [p.tz]
 * @returns {string} Text block for LLM prompt injection
 */
function buildWesternBlock({ birthYear, birthMonth, birthDay,
                             birthHour, birthMinute, lat, lng, tz } = {}) {
  try {
    const chart = computeWesternChart({
      year:      birthYear,
      month:     birthMonth,
      day:       birthDay,
      hour:      birthHour,
      minute:    birthMinute,
      latitude:  lat,
      longitude: lng,
      timezone:  tz,
    });

    const lines = ["=== WESTERN ASTROLOGY CHART (Tropical Zodiac) ==="];

    // Planets
    for (const p of chart.planets) {
      const retro  = p.retrograde ? " ℞ (retrograde)" : "";
      const houseStr = p.house ? ` | House ${p.house}` : "";
      lines.push(`${p.name}: ${p.formatted}${houseStr}${retro}`);
    }

    // Ascendant & Midheaven
    if (chart.ascendant) {
      lines.push(`Ascendant (Rising): ${chart.ascendant.formatted}`);
    } else {
      lines.push("Ascendant (Rising): unavailable — birth time and location required");
    }
    if (chart.midheaven) {
      lines.push(`Midheaven (MC): ${chart.midheaven.formatted}`);
    }

    // Houses
    if (chart.houses.length) {
      lines.push("HOUSES (Placidus):");
      for (const h of chart.houses) {
        lines.push(`  House ${h.house}: ${h.formatted}`);
      }
    } else {
      lines.push("HOUSES: unavailable — birth time and location required");
    }

    // Aspects
    if (chart.aspects.length) {
      lines.push("MAJOR ASPECTS:");
      for (const a of chart.aspects) {
        const dir = a.isApplying ? "applying" : "separating";
        lines.push(`  ${a.planet1} ${a.type} ${a.planet2} (orb ${a.orb}° ${dir})`);
      }
    } else {
      lines.push("ASPECTS: (chart computed without full planetary data — unable to calculate)");
    }

    if (!chart.meta.hasFullChart) {
      lines.push(
        "NOTE: Birth time and/or location not provided. Ascendant, houses, and precise Moon position may be less accurate. Only Sun sign is guaranteed precise."
      );
    }

    lines.push("=== END CHART — DO NOT INVENT OR MODIFY ANY OF THE ABOVE ===");
    return lines.join("\n");
  } catch (err) {
    console.warn("[western-astro-engine] buildWesternBlock failed:", err && err.message);
    return "";
  }
}

module.exports = { buildWesternBlock };
