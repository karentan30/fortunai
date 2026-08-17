# vedic-engine — 善缘吠陀(Vedic/Jyotish)排盘引擎 (vendored)

真天文计算：**celestine**(MIT·零依赖·VSOP87/Meeus·对齐 NASA/JPL/Swiss Ephemeris)
+ **Lahiri ayanamsa 恒星黄道转换层**(本地 `lahiri.js`)。
纯 CommonJS·无文件 IO·无 `process.argv`·无外部 npm 依赖(celestine 已 vendor 进 `vendor/`)。

不让 LLM 猜盘：行星落座/落宫/nakshatra 全部由本引擎精确给出。

## 调用

```js
const { computeVedicChart } = require('./lib/vedic-engine'); // 从 server/ 下

const chart = computeVedicChart({
  year:1990, month:6, day:15, hour:10, minute:0,   // minute 默认 0
  latitude:28.6139, longitude:77.2090,             // 出生地(北纬正/东经正)
  timezone:5.5,                                    // 时区偏移小时(印度5.5/中国8)
  houseSystem:'whole-sign',                        // 默认整宫制(吠陀标准)
});
```

必填：`year, month, day, hour, latitude, longitude, timezone`。缺任一抛 `Error`。

### 输出字段
| 字段 | 说明 |
|------|------|
| `ayanamsa` | Lahiri ayanamsa(度) |
| `ascendant` | 上升点 Lagna(sidereal 经度/rashi/nakshatra) |
| `midheaven` | 中天 |
| `lagnaSign` | 命宫星座 |
| `planets[]` | 9 主星 + Rahu/Ketu + 小行星，各含 `{tropical, sidereal, sign, signZh, degreeInSign, nakshatra:{name,pada}, house, retrograde}` |

`sidereal = tropical - ayanamsa`。落宫按整宫制(Lagna 星座=第1宫)。

## Lahiri 精度
`lahiri.js` 多项式近似(J2000=23.853°, 岁差 1.3966°/世纪)与 Swiss Ephemeris `SE_SIDM_LAHIRI`
在 1900–2100 相差 **< 0.01°**。已对 1990/2000/2024 参考值校验(见 `__test.js`)。
若日后需 sub-arcsec 精度可换 `swisseph`(需原生编译 + 星历文件，非必需)。

## 依赖
无需 `npm i`。唯一运行时依赖 `celestine`(MIT·零依赖·纯 JS·CJS build)已 vendor 到
`vendor/celestine/`，`index.js` 直接 `require('./vendor/celestine/dist/index.cjs')`。
未改动 `server/package.json` / `server/node_modules`。

## 测试
`node server/lib/vedic-engine/__test.js` —— 3 组生辰，校验 ayanamsa 校准 + sidereal 逐颗转换 +
落宫/nakshatra 合法。Sun 落座与吠陀历一致(德里→双子/格林威治→射手/上海→天秤)，`exit 0`。

## `prompt-block.js`
`buildVedicBlock(input)` → 生成「禁止自行推算」的排盘文本喂给 LLM(同步)。异常返回空串自动降级。
