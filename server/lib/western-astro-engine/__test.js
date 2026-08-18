"use strict";
// Test: Nov 15 1990, 2:30pm, New York (lat=40.7128, lng=-74.006, tz=-5)
// Expected: Sun in Scorpio

const { computeWesternChart } = require("./index");
const { buildWesternBlock }   = require("./prompt-block");

const opts = {
  year: 1990, month: 11, day: 15,
  hour: 14, minute: 30,
  latitude: 40.7128, longitude: -74.006, timezone: -5,
};

console.log("=== computeWesternChart test ===");
const chart = computeWesternChart(opts);

// Verify Sun in Scorpio
const sun = chart.planets.find(p => p.name === "Sun");
if (!sun) { console.error("FAIL: Sun not found"); process.exit(1); }
if (sun.sign !== "Scorpio") { console.error(`FAIL: Sun expected Scorpio, got ${sun.sign}`); process.exit(1); }
console.log(`PASS: Sun in ${sun.sign} (${sun.formatted})`);

// Verify Moon exists
const moon = chart.planets.find(p => p.name === "Moon");
console.log(`Moon: ${moon ? moon.formatted : "missing"}`);

// Verify Ascendant computed
if (!chart.ascendant) { console.error("FAIL: Ascendant missing"); process.exit(1); }
console.log(`PASS: Ascendant: ${chart.ascendant.formatted}`);

// Verify houses
if (chart.houses.length !== 12) { console.error(`FAIL: Expected 12 houses, got ${chart.houses.length}`); process.exit(1); }
console.log(`PASS: ${chart.houses.length} houses computed (Placidus)`);

// Verify aspects
if (chart.aspects.length === 0) { console.error("FAIL: No aspects computed"); process.exit(1); }
console.log(`PASS: ${chart.aspects.length} major aspects (core planets)`);
console.log("Top 3 aspects:");
for (const a of chart.aspects.slice(0, 3)) {
  console.log(`  ${a.planet1} ${a.type} ${a.planet2} (orb ${a.orb}°)`);
}

// All planets present
const expected = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
const missing = expected.filter(n => !chart.planets.find(p => p.name === n));
if (missing.length) { console.error("FAIL: Missing planets:", missing.join(", ")); process.exit(1); }
console.log(`PASS: All ${expected.length} core planets present`);

console.log("\n=== Full planet list ===");
for (const p of chart.planets) {
  const h = p.house ? ` H${p.house}` : "";
  const r = p.retrograde ? " ℞" : "";
  console.log(`  ${p.name.padEnd(8)} ${p.formatted}${h}${r}`);
}

console.log("\n=== buildWesternBlock output ===");
const block = buildWesternBlock({
  birthYear: 1990, birthMonth: 11, birthDay: 15,
  birthHour: 14, birthMinute: 30,
  lat: 40.7128, lng: -74.006, tz: -5,
});
console.log(block);

console.log("\n=== ALL TESTS PASSED ===");
