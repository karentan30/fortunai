# qimen-engine — 善缘奇门遁甲(Qimen Dunjia)排盘引擎 (vendored)

vendored 自 **mingyu-core**(MIT·npm `mingyu-core@0.1.29`)的 `divination/qimen`。
拆补/置闰定局、阴阳遁局数、值符值使、九宫格、三奇六仪八门九星八神、驿马、空亡、格局。

> ⚠️ mingyu-core 为 **ESM**，CJS 后端通过 file-URL 动态 `import()` 加载，
> 因此 `computeQimen` 为 **async**(返回 Promise)。

## 调用

```js
const { computeQimen } = require('./lib/qimen-engine'); // 从 server/ 下

const q = await computeQimen({
  date: new Date(),          // 默认当前时刻
  method: 'zhuanpan',        // 转盘(默认) | 'feipan' 飞盘
  scope: 'hour',             // 时家(默认) | year|month|day
  juMethod: 'chaibu',        // 拆补(默认) | 'zhirun'置闰 | 'maoshan'
});
```

### 输出字段(节选)
`juShu`(局数1-9) `isYangDun`(阴阳遁) `zhiFu`(值符星) `zhiShi`(值使门)
`jiuGongGe`(九宫格) `patternTags`/`patternDetails`(格局) `horseStar`(驿马 `{branch,palace,name}`)
`voidBranches`/`voidPalaces`(空亡/空宫) `directions`(方位吉凶) `timeInfo`(节气/元/定局法)
`ganzhi`(年月日时干支) `stemRelations` `classicPatterns` `yingQi`(应期)

## 依赖
无需 `npm i`。`mingyu-core` + `tyme4ts` + `celestine`(均 MIT/ISC)已 vendor 到
`vendor/node_modules/`(已剔除本模块不用的 `astronomy-engine`/`@soul-atelier`，并删 `.map`/`.d.ts`)。
`index.js` 用 file-URL import 指向 `vendor/node_modules/mingyu-core/dist/.../qimen/index.js`。
未改动 `server/package.json` / `server/node_modules`。

## 测试
`node server/lib/qimen-engine/__test.js` —— 2 组时刻(芒种/冬至)，校验局数(1-9)/阴阳遁/
值符值使/九宫格/格局标签。`exit 0`。

## `prompt-block.js`
`await buildQimenBlock(input)` → 生成「禁止自行起局」的局盘文本喂给 LLM。异常返回空串自动降级。
