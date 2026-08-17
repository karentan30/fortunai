# Runae 命理排盘引擎 vendor 交付 — 六爻 / 奇门 / 吠陀

**目标**：给六爻(Liuyao)、奇门遁甲(Qimen)、吠陀(Vedic/Jyotish)找开源真排盘引擎，
照 `bazi-engine` 同样方式 vendor 进 `server/lib/`，不让 LLM 猜盘。
**约束**：只新增 `server/lib/` 下纯函数 lib，未 mount 路由、未改现有 backend、未动 `server/package.json`。

---

## 一、研究结论(每系统有没有好开源)

| 系统 | 选用 | License | 依赖 | 备注 |
|------|------|---------|------|------|
| **吠陀 Vedic** | **celestine + 自写 Lahiri 层** | MIT | 零(纯 JS) | ✅ 真天文·无需原生编译 |
| **六爻 Liuyao** | **mingyu-core** `/divination/liuyao` | MIT | tyme4ts+celestine | ✅ 京房八宫·专业完整 |
| **奇门 Qimen** | **mingyu-core** `/divination/qimen` | MIT | tyme4ts+celestine | ✅ 拆补定局·九宫格·格局 |

调研过的其它候选(为何没选)：
- **吠陀** — `swisseph-v2`/`sweph`(ISC/AGPL)：精度最高但**需原生 C 编译(node-gyp)+ 星历数据文件**，
  部署重、不符「纯 JS vendor」；`vedic-calc`(**UNLICENSED**，不可 vendor)；`astrosk-wasm`/`@aulunarcana/ephemeris`(WASM，
  非商用/需申请授权)。→ 选 **celestine**(MIT·零依赖·VSOP87/Meeus·官方对齐 NASA/JPL/Swiss Ephemeris)做回归黄道，
  自写 **Lahiri ayanamsa 层**转恒星黄道。这是真天文，不是 LLM 猜。
- **六爻/奇门** — `Johnson-Jia/liuyao-divination`(Python·需另起进程)、`kentang2017/kinqimen`(Python)、
  `3metaJun/3meta`/`anthonylee1994/qimen`(JS/TS·较简)。→ **mingyu-core** 一个 MIT npm 包同时覆盖六爻+奇门(+八字/紫微/梅花/六壬/塔罗)，
  纯库无路由、字段最完整(纳甲/世应/空亡/格局/驿马)，故一包覆盖两系统。

**没找到「更好」开源、诚实标注的点**：
- 吠陀若要 **sub-arcsec 官方精度**(打「NASA 级」硬广)，仍需 `swisseph` 原生库；当前 Lahiri 近似与
  Swiss Ephemeris 差 **<0.01°(~0.6 弧分)**，定星座/宫位/nakshatra 完全够用，但不是逐秒级。
- 吠陀 **Vimshottari dasha(大运)/varga 分盘(D9 等)** mingyu/celestine 未直接给，需后续自算(公式明确)。
- 奇门 **飞盘 feipan** 已支持但未在测试覆盖(只验了转盘 zhuanpan)。

---

## 二、vendor 了哪几个 + 怎么调

三个新目录，均纯函数、无路由。**六爻/奇门为 async**(mingyu 是 ESM，CJS 后端用 file-URL 动态 import 加载)。

### `server/lib/vedic-engine/` — 同步
```js
const { computeVedicChart } = require('./lib/vedic-engine');
const chart = computeVedicChart({ year, month, day, hour, minute, latitude, longitude, timezone, houseSystem });
// → { ayanamsa, ascendant(Lagna), midheaven, lagnaSign, planets:[{name,sidereal,sign,degreeInSign,nakshatra:{name,pada},house,retrograde}] }
```

### `server/lib/liuyao-engine/` — async
```js
const { computeLiuyao } = require('./lib/liuyao-engine');
await computeLiuyao({ date });                        // 时间起卦
await computeLiuyao({ yaoArray:[7,8,9,6,7,8] });      // 手工(6老阴动/7少阳/8少阴/9老阳动，初爻在前)
await computeLiuyao({ coinThrows:[{coins:[2,3,3],total:8},...] }); // 三钱摇卦
// → { originalName(本卦), changedName(变卦), interName(互卦), changingYaos(动爻),
//     sixGods, sixRelatives, najiaDizhi, worldAndResponse, voidBranches, palace, ganzhi, ... }
```

### `server/lib/qimen-engine/` — async
```js
const { computeQimen } = require('./lib/qimen-engine');
await computeQimen({ date, method:'zhuanpan', scope:'hour', juMethod:'chaibu' });
// → { juShu(局数), isYangDun, zhiFu(值符), zhiShi(值使), jiuGongGe(九宫格),
//     patternTags(格局), horseStar(驿马), voidBranches, directions, timeInfo, ganzhi, ... }
```

### LLM 注入块(照 bazi-engine 的 `prompt-block.js`)
每个引擎带 `prompt-block.js`，生成「禁止自行推算/起卦/起局」的排盘文本喂给 LLM，只解读不排盘；
任何异常返回空串自动降级(不阻断出报告)。
- `buildVedicBlock(input)`(同步)
- `await buildLiuyaoBlock(input)` / `await buildQimenBlock(input)`(async)

---

## 三、测试验证(每引擎 `__test.js`，全 exit 0)

- **vedic 3/3** — Lahiri ayanamsa 对 1990/2000/2024 参考值 **<0.01°**；sidereal 逐颗 = tropical − ayanamsa；
  Sun 落座与吠陀历一致(德里→双子 Mithuna / 格林威治→射手 Dhanu / 上海→天秤 Tula)；含 Rahu/Ketu。
- **liuyao 3/3** — 时间起卦(水地比→水山蹇)；手工静卦 [7×6]=乾为天无动爻;
  手工动卦 [9,7,7,7,7,7]=乾初爻动→**天风姤**(传统正确)。
- **qimen 2/2** — 芒种→阳遁6局·值符天任·值使生门；冬至→阳遁7局·值符天冲·值使伤门；九宫格/格局标签齐。

跑法：`node server/lib/{vedic,liuyao,qimen}-engine/__test.js`

---

## 四、依赖与坑

- **零 `npm i`**：所有运行时依赖已 vendor 到各引擎 `vendor/`(vedic 用 celestine，六爻/奇门用
  mingyu-core+tyme4ts+celestine)。已剔除六爻/奇门不用的 `astronomy-engine`/`@soul-atelier`，
  删 `.map`/`.d.ts` 瘦身。三目录合计 ~17MB。**未改 `server/package.json` / `server/node_modules`**。
- **⚠️ ESM/async 坑**：mingyu-core 只导出 ESM(package `exports` 无 `require` 字段)，
  `require('mingyu-core/...')` 会 `ERR_PACKAGE_PATH_NOT_EXPORTED`。故 `index.js` 用
  `import(pathToFileURL(dist).href)` 动态加载 → **六爻/奇门 compute 必须 await**。file-URL 指向
  vendor 内 dist，其 sibling 依赖从 vendor 树内正常解析(已验证 Node 26)。celestine 有 CJS build
  (`dist/index.cjs`)，vedic 直接 `require`，**同步**。
- **吠陀地理输入必填**：`latitude/longitude/timezone` 缺一抛错(上升点/宫位依赖出生地)。八字类只需
  年月日时，吠陀多这三项，前端表单需补。
- **Lahiri 精度上限**：见上「诚实标注」——够定星座/宫位/nakshatra，要逐秒级需换 swisseph 原生。
- **路由**：**未 mount，由 Karen 统一 mount**。接线时 vedic 同步调、六爻/奇门记得 `await`。

---

## 五、还差哪些(后续可选)
1. 吠陀 **Vimshottari dasha(大运)** 与 **varga 分盘(D9/D10…)** — 公式明确，可在 vedic-engine 加算。
2. 吠陀若打「Swiss Ephemeris 级」硬广 → 评估引入 `sweph`(原生，需编译+星历文件)。
3. 六爻/奇门的 mingyu 输出字段极多，接报告时挑关键字段喂 LLM(prompt-block 已挑核心)。
4. 奇门飞盘(feipan)/年月日家 scope 未测试覆盖，用前先验一组。
