# Runae · Life K-Line / 人生K线 — PRD v1

> **一句话**：把用户一生的八字大运/流年画成"股票 K 线图"，一眼看出哪些年是牛市（运势旺）哪些是熊市（挑战期），标出关键转折年。可截图分享 → 病毒传播。
> **定位口号**："This isn't fortune-telling — it's your life's K-line chart."

---

## 1. 为什么做（增长逻辑）

- **视觉钩子极强**：命理内容大多是"一大段文字"，转化/分享率低。K 线图是**一张可截图的图**，天然适合 IG/TikTok/小红书传播（"我把我的一生画成了股票"）。
- **零教育成本**：全球用户都懂股票 K 线的牛熊概念，比"大运流年"好懂 100 倍。
- **承接算命基本盘**：看完大势曲线 → 想知道"具体每一年" → 引导会员逐年详批（MRR）。
- 复用现成 `bazi-engine`（真引擎排盘）+ `numerology.js` 的"脚本算·AI 解释"模式，开发成本低。

---

## 2. 核心机制：分数**规则算**，LLM **只点评**（红线）

> 铁律：**运势分绝不让 LLM 编**。每一年的 0–100 分由 JS 用确定的命理规则算，输入是**真引擎排出的真实大运/流年干支**。LLM 只拿到既定分数去**点评**关键期，禁止重算。

### 2.1 打分算法（`server/routes/life-kline.js`，纯确定性）

**Step 1 · 真引擎排盘**
`computeBaziChart()` → 日主、四柱、旺衰 verdict、调候用神、格局、**大运数组（每运含 10 个流年，各带干支）**。

**Step 2 · 推导喜忌（扶抑用神法则，规则确定不猜）**
以真引擎的 `enrichment.旺衰.verdict` 定身强弱：
- **身弱**（偏弱/弱）→ favorable = 印（生我）+ 比劫（同我）；unfavorable = 食伤/财/官杀
- **身旺**（偏旺/旺）→ favorable = 食伤/财/官杀（泄耗）；unfavorable = 印/比劫
- **中和** → favorable = 食伤/财（顺用生财）；官杀偏忌（温和权重，曲线更平）
- `enrichment.调候用神` 的对应五行额外 **+0.5** 加权（寒暖燥湿关键字）

**Step 3 · 逐干支打分 → 0–100**
每个大运 / 流年的干支：
- 天干五行 + 地支本气五行，各查 favorable(+1) / unfavorable(−1) / 调候(+0.5)
- 加权：`天干×0.55 + 地支×0.45`（干显、支根）
- **地支与命局四支相冲** → 该年"动荡/转折"，分数向中性(50)拉 30% 并标 `volatile`（K 线上金点，非好非坏）
- 归一：`score = 50 + raw×28`，**夹到 8–96**（永不给绝对 0/100 → 不制造"一定完蛋/一定发财"）
- 流年最终分 = `流年自身×0.7 + 所处大运底色×0.3`（大运定基调、流年定起伏）

**Step 4 · 找关键转折年**（给 LLM 点评 + 前端标注）
全局最高分年（peak/牛市顶）、最低分年（trough/熊市底）、最大跃升年（rise/翻身），jump≥8 才算。

**分档标签**：≥72 bull(牛) / ≥58 up / ≥43 neutral / ≥30 down / else bear(熊)。

**验证证据**（3 组生辰跑通，见 `router.__calc.computeKline`）：
| 生辰 | 日主/旺衰 | favorable | 年分区间 |
|---|---|---|---|
| 1990-06-15 男 | 金/偏弱 | 土+金 | 26–86 |
| 1985-11-03 女 | 火/中和 | 土+金 | 41–78（中和更平）|

> 五行/相生相克/六冲表是**标准命理常量定义**（非 LLM 生成），硬编码在路由内。

### 2.2 LLM 只做点评
`system prompt` 明确："scores were ALREADY computed by an exact rule engine — treat as fixed, NEVER recalculate/change"。LLM 拿到 decade 分数表 + 转折年表 → 输出：曲线整体形状 + 逐转折年一段 + 当前/未来大运。走现有 `deepseekChat`（Qwen/DeepSeek 自动切换）。

---

## 3. 可视化（`pages/life-kline.html`）

- **绿玉设计系统**（照 `home-en.html`：`--jade / --gold / cream`），移动端 max-width 440，英文。
- **牛熊配色**：bull=玉绿 `#3d9e82`、bear=暖陶土 `#c67a4e`（不用红涨绿跌，走东方审美不撞西方股市红绿）。
- **图形**：内联 SVG（零依赖），横轴=年龄/年份、纵轴=运势分。
  - 每年一根"蜡烛柱"（相对 50 中线，向上玉绿/向下陶土）
  - 一条渐变趋势折线连各年顶点
  - 中线虚线（score 50）
  - 转折年白心圆点 + 年份标注；`volatile` 冲年标金点
  - 大运起始年龄刻度
- 图下方：**关键转折年卡片**（年份大字 + 牛/熊 pill + 一句非宿命点评）+ AI 全文点评。
- **分享**：`navigator.share` / 复制链接，文案"I turned my whole life into a stock K-line 📈…"。"Draw another"重置。

---

## 4. 免费 / 付费门

| | 免费（每天 1 次） | 会员 $9.90/mo |
|---|---|---|
| K 线图（整条曲线，逐流年点） | ✅ 全给（截图要完整才 viral） | ✅ |
| 大运趋势 + 3 个关键转折年点评 | ✅ | ✅ |
| **逐年（每个流年）详批** | 🔒 paywall | ✅ 每年主题 + 该季最优动作 |

- **门在"深读文字"，不在"图"**：图完整给（分享才有料），付费墙锁的是逐年文字详批。
- 配额 key 独立 `_lifeKlineUsage`，游客按 session/IP，会员 `memberTier` 无限。免费用尽 → `upgrade:true` + 引导词。
- `GET /api/life-kline/quota` 查剩余。

---

## 5. 裂变

- 一张完整 K 线图 = 天然分享物（对比八字文字报告，图的转发率高数倍）。
- 分享文案钩"这不是算命，是我人生的 K 线"→ 好奇心驱动新用户来画自己的。
- 可扩展：截图卡自动加 Runae 水印 + 二维码（P2，本期先用 `navigator.share`）。

---

## 6. 合规红线（全部已落地在代码）

- **零编造**：分数纯规则算，LLM 只点评；prompt 明令不许重算。
- **反宿命**：分数夹 8–96 永不绝对；"trends not guarantees"；bull=顺风 / bear=蓄力，非"会发生"。
- **禁具体断言**：prompt 明列 NEVER say "go broke / get rich / lose job / get sick / 任何具体事件"；NEVER name diseases。
- **Eastern 不用 Chinese**：文案统一 "Eastern Four Pillars"，无 Chinese 标签。
- **AI 标识**：顶部 `🤖 …scored by a real engine and read by AI`。
- **娱乐参考免责**：页脚 + prompt 均含 "self-reflection and entertainment only — not medical, legal, or financial advice"；结尾必回"这是你人生的天气，不是命运"。

---

## 7. 接口

```
POST /api/life-kline
  body: { year, month, day, hour?(0-23,默认午时12), gender?(male/female), 或 birthdate:"YYYY-MM-DD", token? }
  → { reading, chart:{ dayMaster, dayMasterElement, verdict, geju, favorable[], unfavorable[],
        span:{fromYear,toYear,fromAge,toAge}, decades[], years[], turningPoints[] },
      full, remaining, isMember }
GET /api/life-kline/quota → { isMember, tier, remaining, limit }
```

---

## 8. 上线坑 / 待办

- ⚠️ **路由未 mount**：`server/routes/life-kline.js` 已建但**没挂**。需 Karen 在 `server/index.js` 统一加：
  `app.use('/api', require('./routes/life-kline'));`
- `pages/life-kline.html` 的 paywall CTA 指向 `/pricing-en.html`（若定价页路径不同需改）。
- `home-en.html` / 导航加入口卡片（本期未碰现有页，Karen 决定后加）。
- 分享水印卡（截图自动带 logo+二维码）留 P2。
- 未知时辰默认午时 12，影响时柱 → 曲线仍成立（大运主要由年月柱起），文案已提示"hour sharpens but not required"。

---

## 9. 文件清单

| 文件 | 说明 |
|---|---|
| `server/routes/life-kline.js` | 后端：真引擎排盘 + 规则打分 + LLM 点评（建了未 mount）|
| `pages/life-kline.html` | 前端：输生辰 → SVG K 线 + 转折卡 + AI 点评（绿玉/英文/移动）|
| `docs/product/runae-life-kline.md` | 本 PRD |
