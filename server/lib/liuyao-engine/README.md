# liuyao-engine — 善缘六爻(Liuyao / I-Ching)排盘引擎 (vendored)

vendored 自 **mingyu-core**(MIT·npm `mingyu-core@0.1.29`)的 `divination/liuyao`。
京房八宫法：本卦/变卦/互卦、六神、六亲、纳甲地支、世应、空亡、卦宫、动爻。

> ⚠️ mingyu-core 为 **ESM**，CJS 后端通过 file-URL 动态 `import()` 加载，
> 因此 `computeLiuyao` 为 **async**(返回 Promise)。

## 调用

```js
const { computeLiuyao } = require('./lib/liuyao-engine'); // 从 server/ 下

// 1) 时间起卦(默认当前时刻)
const c = await computeLiuyao({ date: new Date() });

// 2) 手工起卦(六爻值，自下而上初爻在前；6老阴动/7少阳/8少阴/9老阳动)
const c2 = await computeLiuyao({ yaoArray:[7,8,9,6,7,8] });

// 3) 三枚铜钱摇卦
const c3 = await computeLiuyao({ coinThrows:[{coins:[2,3,3],total:8}, ...] });
```

### 输出字段(节选)
`originalName`(本卦) `changedName`(变卦) `interName`(互卦) `changingYaos`(动爻)
`sixGods`(六神) `sixRelatives`(六亲) `najiaDizhi`(纳甲地支) `wuxing`(五行)
`worldAndResponse`(世应标记数组) `voidBranches`(空亡) `palace`(卦宫 `{name,wuxing}`)
`ganzhi`(年月日时干支) `hiddenSpirits`(伏神) `hexagramRelations` `guaShen`(卦身) `yaosDetail`

## 依赖
无需 `npm i`。`mingyu-core` + `tyme4ts` + `celestine`(均 MIT/ISC)已 vendor 到
`vendor/node_modules/`(已剔除本模块不用的 `astronomy-engine`/`@soul-atelier`，并删 `.map`/`.d.ts`)。
`index.js` 用 file-URL import 指向 `vendor/node_modules/mingyu-core/dist/.../liuyao.js`，
其 sibling 依赖从 vendor 树内解析。未改动 `server/package.json` / `server/node_modules`。

## 测试
`node server/lib/liuyao-engine/__test.js` —— 时间起卦 + 手工静卦([7×6]=乾为天无动爻) +
手工动卦([9,7,7,7,7,7]=乾初爻动→天风姤)，校验本卦/变卦/世应/六亲/纳甲。`exit 0`。

## `prompt-block.js`
`await buildLiuyaoBlock(input)` → 生成「禁止自行起卦」的卦象文本喂给 LLM。异常返回空串自动降级。
