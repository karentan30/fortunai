# bazi-engine — 善缘八字排盘引擎 (vendored)

专业八字排盘引擎，内联自 `~/.claude/skills/bazi-ziwei/calculator`。
纯 CommonJS，**无文件 IO、无 `process.argv`、无外部 npm 依赖**（`lunar-typescript` 已 vendor 进 `vendor/`）。
计算结果与源引擎 CLI `node dist/run-chart.js` **逐字段完全一致**（见下方测试证据）。

## 调用

```js
const { computeBaziChart } = require('./lib/bazi-engine'); // 从 server/ 下

const chart = computeBaziChart({
  year: 1990, month: 6, day: 15,
  hour: 10, minute: 0,          // minute 默认 0
  gender: 'male',              // 'male'|'female'|'男'|'女'
  isLunar: false,              // 默认 false (阳历输入)
  timeZone: 8,                 // 默认东八区
  includeZiwei: true,          // 默认 true, 传 false 则不返回 ziwei
});

chart.bazi   // 富对象 (见下)
chart.ziwei  // 紫微盘 (可选)
```

### 签名

```
computeBaziChart({ year, month, day, hour, minute=0, gender, isLunar=false, timeZone=8, includeZiwei=true })
  → { bazi: {...}, ziwei?: {...} }
```

必填：`year, month, day, hour, gender`。缺任一抛 `Error`。

## `bazi` 输出字段

| 字段 | 说明 |
|------|------|
| `siZhu` | 四柱，各含 `{gan, zhi}`（`year/month/day/hour`）|
| `dayMaster` | 日主（日干）|
| `shiShen` | 逐柱十神 `{year, month, hour}`（日柱为日主本身）|
| `zhangSheng` | 逐柱十二长生 |
| `naYin` | 逐柱纳音 |
| `dayunStart` | 起运信息 |
| `dayun` | 大运数组：`{ganZhi:{gan,zhi}, startAge, endAge, startYear, endYear, ganShiShen, zhiShiShen, liuNian[]}` |
| `cangGan` | 逐柱地支藏干（含十神），`year/month/day/hour` |
| `enrichment` | 补层，键为中文：`自坐 / 五行旺相 / 五行统计 / 调候用神 / 格局 / 旺衰 / 天干关系 / 地支关系 / 整柱` |

`enrichment.格局` = `{primary, basis, 透干, confidence, notes}`
`enrichment.旺衰` = `{score, verdict, confidence, breakdown}`

## 依赖

**无需任何 `npm i`。** 唯一运行时依赖 `lunar-typescript@1.8.6`（零依赖纯 JS）已 vendor 到
`vendor/lunar-typescript/`，`yiqi-core/{bazi,ziwei-standard}.js` 的 require 已改指向本地相对路径。
未改动 `server/package.json` / `server/node_modules`。

> 若日后 shenyuan `server/node_modules` 自行装了 `lunar-typescript`，可选择删除 `vendor/`
> 并把那两处 require 改回 `require("lunar-typescript")`——非必需。

## 目录结构

```
bazi-engine/
├── index.js              # 入口，导出 computeBaziChart（本文件手写）
├── __test.js             # 对比测试脚本
├── README.md
├── yiqi-core/            # Yiqi 算法层（四柱/紫微/大运/流年/纳音/长生）
├── bazi-enrich/          # 补层（格局/旺衰/五行/调候/天干地支关系/自坐）
└── vendor/
    └── lunar-typescript/ # vendored 农历/万年历库（1.8.6）
```

## 已测通证据

`node server/lib/bazi-engine/__test.js` —— 对 3 组生辰调用本模块，与源引擎 CLI 输出做**整个 `bazi` 对象深度 JSON 比对**，全部一致：

| 生辰 | 四柱（年月日时）| 大运起 | 格局 | 旺衰 | 深度比对 |
|------|----------------|--------|------|------|----------|
| 1990-06-15 10:00 男 | 庚午 壬午 辛亥 癸巳 | 癸未 @8岁 | 七杀格(高) | 偏弱 -2.7 | ✅ |
| 1985-11-03 22:30 女 | 乙丑 丙戌 丙午 己亥 | 丁亥 @3岁 | 食神格(中) | 中和 -1.3 | ✅ |
| 2001-02-28 05:00 男 | 辛巳 庚寅 壬戌 癸卯 | 己丑 @9岁 | 食神格(中) | 中和 -0.6 | ✅ |

四柱 / 十神 / 大运 / 藏干 / 格局 / 旺衰 / 五行 全字段一致，`exit 0`。

## 备注

- 源引擎 `bazi.js` 里两行 `🔍 八字计算结果` 调试日志已在 vendored 副本注释掉，本模块调用**完全静默**（保留了合法的 error/warn 诊断日志）。
- 未复制 CLI/渲染文件（`run-chart.js` / `dump-text.js` / `render.js`），它们是 `fs` IO 入口，不需要。
