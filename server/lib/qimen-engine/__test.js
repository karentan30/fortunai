"use strict";
// qimen-engine 验证：2 组时刻，检查局数/阴阳遁/值符值使/九宫格/格局 合理。
const assert = require("assert");
const { computeQimen } = require("./index");

(async () => {
  let pass = 0;
  const cases = [
    { name: "1990-06-15 10:00 (芒种·夏)", date: "1990-06-15T10:00:00+08:00", expectYang: true },
    { name: "2000-01-01 12:00 (冬至后·冬)", date: "2000-01-01T12:00:00+08:00", expectYang: true },
  ];

  for (const c of cases) {
    const q = await computeQimen({ date: new Date(c.date), method: "zhuanpan", scope: "hour", juMethod: "chaibu" });
    console.log(`\n== ${c.name} ==`);
    console.log("  局:", (q.isYangDun ? "阳" : "阴") + "遁" + q.juShu + "局", "| 值符:", q.zhiFu, "值使:", q.zhiShi);
    console.log("  节气:", q.timeInfo.solarTerm, q.timeInfo.epoch, "| 干支时:", q.ganzhi.hour);
    console.log("  格局(前3):", (q.patternTags || []).slice(0, 3).join(" / "));

    assert(typeof q.isYangDun === "boolean", "缺阴阳遁");
    assert(q.juShu >= 1 && q.juShu <= 9, "局数非法: " + q.juShu);
    assert(q.zhiFu && q.zhiShi, "缺值符/值使");
    assert(q.jiuGongGe, "缺九宫格");
    assert(q.timeInfo && q.ganzhi && q.ganzhi.hour, "缺时间/干支信息");
    assert(Array.isArray(q.patternTags), "缺格局标签");
    pass++;
  }

  console.log(`\n✅ qimen-engine ${pass}/${cases.length} 组通过 (局数/值符值使/九宫格/格局)`);
})().catch((e) => { console.error("❌ qimen-engine FAIL:", e); process.exit(1); });
