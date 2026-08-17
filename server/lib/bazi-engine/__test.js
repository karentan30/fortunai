"use strict";
// 对比测试: computeBaziChart (vendored) vs 源引擎 dist/run-chart.js CLI
// 运行: node server/lib/bazi-engine/__test.js
// 三组生辰, 核对四柱 / 十神 / 大运 / 格局 / 旺衰 完全一致。

const { execFileSync } = require("child_process");
const path = require("path");
const { computeBaziChart } = require("./index");

const SRC_CLI = path.join(
  require("os").homedir(),
  ".claude/skills/bazi-ziwei/calculator/dist/run-chart.js"
);

const CASES = [
  { year: 1990, month: 6, day: 15, hour: 10, minute: 0, gender: "male" },
  { year: 1985, month: 11, day: 3, hour: 22, minute: 30, gender: "female" },
  { year: 2001, month: 2, day: 28, hour: 5, minute: 0, gender: "male" },
];

function cliChart(c) {
  const out = execFileSync("node", [
    SRC_CLI,
    `--year=${c.year}`,
    `--month=${c.month}`,
    `--day=${c.day}`,
    `--hour=${c.hour}`,
    `--minute=${c.minute}`,
    `--gender=${c.gender}`,
  ]);
  return JSON.parse(out.toString());
}

function pillars(bazi) {
  const z = bazi.siZhu;
  return {
    year: z.year.gan + z.year.zhi,
    month: z.month.gan + z.month.zhi,
    day: z.day.gan + z.day.zhi,
    hour: z.hour.gan + z.hour.zhi,
  };
}

let allPass = true;
for (const c of CASES) {
  const mine = computeBaziChart(c);
  const src = cliChart(c);

  // 深度对比整个 bazi 对象
  const mineJson = JSON.stringify(mine.bazi);
  const srcJson = JSON.stringify(src.bazi);
  const fullMatch = mineJson === srcJson;

  const p = pillars(mine.bazi);
  const label = `${c.year}-${c.month}-${c.day} ${c.hour}:${String(c.minute).padStart(2, "0")} ${c.gender}`;

  console.log(`\n=== ${label} ===`);
  console.log(
    `四柱   : 年${p.year} 月${p.month} 日${p.day} 时${p.hour}`
  );
  console.log(`日主   : ${mine.bazi.dayMaster}`);
  console.log(
    `十神   : 年${mine.bazi.shiShen.year} 月${mine.bazi.shiShen.month} 时${mine.bazi.shiShen.hour}`
  );
  const d0 = mine.bazi.dayun && mine.bazi.dayun[0];
  console.log(
    `大运起 : ${d0 ? d0.ganZhi.gan + d0.ganZhi.zhi + " @" + d0.startAge + "岁 (起运年" + d0.startYear + ")" : "n/a"}`
  );
  const en = mine.bazi.enrichment || {};
  console.log(
    `格局   : ${en["格局"] ? en["格局"].primary + " (" + en["格局"].confidence + ")" : "n/a"}`
  );
  console.log(
    `旺衰   : ${en["旺衰"] ? en["旺衰"].verdict + " score=" + en["旺衰"].score : "n/a"}`
  );
  console.log(`全 bazi 深度一致: ${fullMatch ? "✅ PASS" : "❌ FAIL"}`);

  if (!fullMatch) {
    allPass = false;
    // 找出第一个差异字段
    for (const k of Object.keys(src.bazi)) {
      if (JSON.stringify(mine.bazi[k]) !== JSON.stringify(src.bazi[k])) {
        console.log(`  差异字段: ${k}`);
      }
    }
  }
}

console.log(`\n========================================`);
console.log(allPass ? "全部 3 组与源引擎完全一致 ✅" : "存在差异 ❌");
process.exit(allPass ? 0 : 1);
