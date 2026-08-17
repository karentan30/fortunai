"use strict";
// liuyao-engine 验证：时间起卦 + 手工起卦，检查本卦/变卦/世应/六亲/纳甲/动爻 合理。
const assert = require("assert");
const { computeLiuyao } = require("./index");

(async () => {
  let pass = 0;

  // 1) 时间起卦 (固定时刻确定性)
  const t = await computeLiuyao({ date: new Date("1990-06-15T10:00:00+08:00") });
  console.log("\n== 时间起卦 1990-06-15 10:00 ==");
  console.log("  本卦:", t.originalName, "变卦:", t.changedName, "互卦:", t.interName);
  console.log("  六亲:", t.sixRelatives.join(""), "| 纳甲:", t.najiaDizhi.join(""));
  console.log("  动爻:", (t.changingYaos || []).map((y) => y.position + y.type).join(",") || "无");
  assert(t.originalName && t.changedName, "缺本卦/变卦");
  assert(Array.isArray(t.yaoArray) && t.yaoArray.length === 6, "yaoArray 非 6 爻");
  assert(Array.isArray(t.sixRelatives) && t.sixRelatives.length === 6, "六亲非 6");
  assert(Array.isArray(t.najiaDizhi) && t.najiaDizhi.length === 6, "纳甲非 6");
  assert(t.worldAndResponse, "缺世应");
  pass++;

  // 2) 手工起卦：全少阳=乾为天，无动爻 -> 变卦应=本卦
  const manualStatic = await computeLiuyao({ yaoArray: [7, 7, 7, 7, 7, 7] });
  console.log("\n== 手工起卦 [7,7,7,7,7,7] (乾) ==");
  console.log("  本卦:", manualStatic.originalName, "变卦:", manualStatic.changedName);
  assert(manualStatic.originalName.includes("乾") || manualStatic.originalName === "乾为天", "全阳应为乾卦, got " + manualStatic.originalName);
  assert((manualStatic.changingYaos || []).length === 0, "全少阳不应有动爻");
  pass++;

  // 3) 手工起卦带动爻：初爻老阳(9)动 -> 有 1 个动爻，本卦≠变卦
  const manualDyn = await computeLiuyao({ yaoArray: [9, 7, 7, 7, 7, 7] });
  console.log("\n== 手工起卦 [9,7,7,7,7,7] (乾·初爻动) ==");
  console.log("  本卦:", manualDyn.originalName, "变卦:", manualDyn.changedName, "动爻数:", (manualDyn.changingYaos || []).length);
  assert((manualDyn.changingYaos || []).length === 1, "应有 1 个动爻");
  assert(manualDyn.originalName !== manualDyn.changedName, "有动爻则本卦≠变卦");
  pass++;

  console.log(`\n✅ liuyao-engine ${pass}/3 组通过 (时间起卦 + 手工静卦 + 手工动卦)`);
})().catch((e) => { console.error("❌ liuyao-engine FAIL:", e); process.exit(1); });
