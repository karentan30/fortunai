# PRD — 报告分章按需生成（Runae / 善缘）

> 版本 v1.0 · 2026-08-18 · 作者：全栈架构师+PM
> 状态：待评审 → 开工
> 目标读者：负责 `server/routes/divination.js` 与 `pages/bazi.html` 的工程师
> 关联记忆：`reference_runae_report_render_pipeline`、`project_shenyuan`、`feedback_verify_generate_before_handing`

---

## 0. 一句话与背景

**把"一次 LLM 出整篇 42 秒报告"改成"分章·按需·流式·预取"：进报告先秒出命盘图/五行/时间轴（纯代码渲染），文字章节点开哪章生成哪章（每章 3-6 秒），读时后台预取下一章 → 秒开；付费才出全 10 章 + PDF 珍藏版。**

### 现状（已核对代码，2026-08-18）

| 项 | 现状 | 文件:行 |
|---|---|---|
| 主流式端点 | `POST /api/bazi/stream`，**单次 LLM 调用**出整篇，SSE 事件 `meta/chunk/done/error` | `divination.js` 前端 `bazi.html:876` |
| 章节分隔 | LLM 输出里用 emoji 标题分章（📜🌊🌟💰💕💼📅🔮🎯💌），前端 `bazi.html:1315` 靠 emoji 白名单切章 | `bazi.html:1315,1978` |
| 免费/付费门 | `gateReportAccess(req, ['bazi','사주','八字']).full`；免费加 `freeSuffix`（只出前3章 + `---LOCKED---` + 锁章预告），付费出全10章 | `divination.js:351/357`，`store.js:367` |
| maxTokens | 免费 3500、full 16384 | `divination.js:382` |
| 真引擎注入 | `buildBaziBlock()` / `baziChartBlock()` / `calcBazi()` 把真排盘写进 sysPrompt/userPrompt，并回传 `pillars` | `divination.js:164,379,396` |
| 多语言 | **en/pt/th/es/zh/ko/in 各复制一份 sysPrompt+userPrompt+freeSuffix+章节清单**（≈7 份手抄），改一处要改七处 | `divination.js:309,359,425,452,479,506,715` |
| 前端渲染 | `fetch + getReader()` 读 SSE；命盘图/五行雷达/大运时间轴/首字下沉/章节封面卡(`/samples/caijing/art-*.png`)/付费墙 blur 覆盖层；**锁定内容不进 DOM** | `bazi.html:865,1358,1607,2045` |

### 痛点（本 PRD 要消灭的）

1. **42 秒整篇** → 撞前端 30s 超时 = 之前"网络异常/failed to generate"根因（见 `feedback_verify_generate_before_handing`）。
2. **免费烧满 3500 token**（≈6677 字，本该 1500）→ 免费成本翻 4 倍 + 被白嫖。
3. **首屏空白 42 秒**：命盘图本可代码瞬出，却陪着 LLM 一起等。
4. **多语言 7 份手抄** = 维护噩梦，改章节清单/字数要动 7 处、极易漏。

### 设计原则（继承 `reference_runae_report_render_pipeline` Karen 0818 拍板）

- **视觉优先**：首屏永远是"视觉卡"（命盘图+五行条形图+短卡），LLM 长文折叠成"点击展开/按需章"。别把长文一次倒出来。
- **锁定内容绝不进 DOM**（防白嫖，保持现状铁律）。
- **免费只烧点开的章**；付费才出全文 + PDF。
- **不对用户暴露用哪个模型**（`feedback_dont_expose_model_to_users`）。

---

## 1. 端点契约

### 1.1 新增：单章按需端点 `POST /api/bazi/chapter`

SSE 流式，一次只出**一章**。

**请求体**
```jsonc
{
  "birthYear": 1994, "birthMonth": 8, "birthDay": 18,
  "birthHour": 14,            // 可空=时辰不详
  "gender": "female",
  "lang": "zh",              // zh|en|pt|th|es|ko|in，缺省 zh
  "chapterId": "wealth",     // 见 1.3 枚举
  "token": "…",              // 或 Authorization: Bearer（沿用现有取 token 逻辑）
  "order_no": "…"            // 可选，单笔订单解锁（沿用 baziEnglishHandler:352 逻辑）
}
```

**响应（SSE，沿用现有事件格式）**
```
data: {"type":"meta","chapterId":"wealth","tier":"paid","locked":false,"free":false}
data: {"type":"chunk","content":"…"}          // 多条
data: {"type":"done","chapterId":"wealth","words":612,"tier":"paid"}
```
- 若该章是**付费章**且用户**无权限** → 不产文，直接：
  ```
  data: {"type":"locked","chapterId":"wealth","teaser":"财运格局 · 完整解读见付费版"}
  ```
  （HTTP 仍 200；**正文一个字都不产**，从源头省 token + 防白嫖。teaser 由 config 提供，是静态短句不调 LLM。）
- 错误：`data: {"type":"error","message":"…"}`（现有兜底一致）。

**关键实现点**
- 每章**都注入真引擎数据**：`chapterHandler` 内先算一次 `calcBazi()` + `buildBaziBlock()`，把 baziBlock 拼进该章 sysPrompt（每章独立请求，不能靠上一章上下文）。为省重复计算，可在同一 birth 参数下做进程内 LRU 缓存（key=birth+lang，TTL 10 分钟，仅缓存**引擎排盘结果**不缓存 LLM 文本）。
- **maxTokens 按章配额**（见 config §2）：单章 800-1500 tokens，而非整篇 16384。单章耗时降到 3-6 秒。
- gate：`gateReportAccess(req, ['bazi','사주','八字'])` 复用（§4）。
- 落库：单章不必每章 `insertReading`；**付费全量生成时**（§5）落一条完整 reading 即可。单章可轻量记录（可选 `insertChapterCache`）。

### 1.2 与现有 `/api/bazi/stream` 的并存策略

**并存，不删**。灰度开关控制前端走哪条：
- `/api/bazi/stream` 保留原样（整篇），作为**回滚兜底**和"一次全出"路径（付费 PDF 生成也复用它，见 §5）。
- 新增 `/api/bazi/chapter` 承接分章按需。
- 前端 `bazi.html` 由开关 `window.__RUNAE_CHAPTERED__`（或后端下发的 `/api/config` flag）决定：true → 走分章；false → 走老 `/stream`。**MVP 阶段默认 false，灰度放量到 true**（§7）。

### 1.3 章节 ID 枚举（八字，与现有 emoji 对齐）

| chapterId | emoji | 标题(zh) | 免费? | 目标字数 | maxTokens |
|---|---|---|---|---|---|
| `pillars` | 📜 | 四柱命盘 | ✅免费 | 400 | 900 |
| `elements` | 🌊 | 五行能量 | ✅免费 | 400 | 900 |
| `year` | 🌟 | 今年运势 | ✅免费 | 350 | 800 |
| `wealth` | 💰 | 财运格局 | 🔒付费 | 500 | 1200 |
| `love` | 💕 | 感情姻缘 | 🔒付费 | 500 | 1200 |
| `career` | 💼 | 事业格局 | 🔒付费 | 500 | 1200 |
| `luck` | 📅 | 大运周期 | 🔒付费 | 700 | 1600 |
| `forecast` | 🔮 | 流年预测 | 🔒付费 | 600 | 1400 |
| `remedy` | 🎯 | 开运锦囊 | 🔒付费 | 350 | 800 |
| `message` | 💌 | 寄语 | 🔒付费 | 300 | 700 |

> 免费 3 章合计 ≈1150 字 / ≈2600 tokens（vs 现在整篇免费烧 3500 且实际吐 6677 字）。**免费单用户若只点前 3 章 = 一次省约省下 60% token；只点 1 章 = 省 90%**。

---

## 2. 5+ 语言不重复：章节定义抽成 config

### 2.1 目标

现在 7 份手抄 sysPrompt/userPrompt/freeSuffix/章节清单 → **一处定义章节结构 + 模板参数化 + 每语言只存"文案词典"**。改章节字数/维度只动一处。

### 2.2 数据结构（新建 `server/lib/report-config/bazi.js`）

```js
// 章节定义：结构与语言无关，一处定义
const CHAPTERS = [
  { id: 'pillars',  emoji: '📜', free: true,  maxTokens: 900,
    // 每章"要写什么"的维度（语言无关的语义骨架）
    dims: ['four_pillars_display', 'day_master', 'chart_pattern', 'useful_god'],
    words: 400 },
  { id: 'wealth',   emoji: '💰', free: false, maxTokens: 1200,
    dims: ['wealth_star', 'peak_years:3', 'best_industries:5'], words: 500 },
  // … 其余 8 章
];

// 语言词典：每语言只填"文案片段"，不重复结构
// server/lib/report-config/i18n/bazi.zh.js / .en.js / .pt.js …
const I18N = {
  zh: {
    persona: '你是精通八字命理的命理师，语言温暖白话，绝不制造焦虑。',
    disclaimer: '（仅供文化娱乐参考）',
    chapterTitle: { pillars: '四柱命盘', wealth: '财运格局', /* … */ },
    dimLabel: { four_pillars_display: '四柱展示', wealth_star: '正偏财', /* … */ },
    lockedTeaser: { wealth: '💰 财运格局 · 完整解读见付费版', /* … */ },
    userLead: (b) => `请为以下命主生成【${b.chapterTitle}】章节…出生:${b.dateStr} 性别:${b.gender}`,
  },
  en: { persona: 'You are a master BaZi reader…', /* 同结构 */ },
  // pt / th / es / ko / in …
};
```

### 2.3 Prompt 组装器（新建 `buildChapterPrompt`）

```js
// 输入: chapterId, lang, birth, baziBlock, full
// 输出: { sysPrompt, userPrompt, maxTokens }
function buildChapterPrompt({ chapterId, lang, birth, baziBlock }) {
  const ch = CHAPTERS.find(c => c.id === chapterId);
  const t = I18N[lang] || I18N.zh;                // 语言回落到 zh
  const dims = ch.dims.map(d => t.dimLabel[d.split(':')[0]] + (d.includes(':') ? '×'+d.split(':')[1] : '')).join('、');
  const sysPrompt = [
    t.persona, HEALTH_SOFT[lang] || '', t.disclaimer,
    baziBlock ? CHART_STRICT_HINT[lang] + baziBlock : ''   // 真引擎数据强约束
  ].join('\n');
  const userPrompt =
    t.userLead({ chapterTitle: t.chapterTitle[chapterId], dateStr: fmtDate(birth, lang), gender: fmtGender(birth.gender, lang) }) +
    `\n本章须覆盖维度：${dims}\n目标约 ${ch.words} 字。仅输出本章正文，标题以「${ch.emoji} ${t.chapterTitle[chapterId]}」开头。`;
  return { sysPrompt, userPrompt, maxTokens: ch.maxTokens };
}
```

**收益**：新增语言 = 复制一份 `bazi.<lang>.js` 词典（纯文案）；改章节维度/字数 = 只改 `CHAPTERS`。**7 份手抄 → 1 份结构 + N 份纯词典**。

> ⚠️ 迁移风险控制：先把**现有 7 份 prompt 的文案原样搬进词典**（不改语气/合规话术，尤其 `HEALTH_SOFT`、免责、"避免 Chinese 字样"这类已过合规的措辞），保证输出质量不回退。词典搬迁后跑一次多语言 smoke（§8）对比新旧输出质量。

---

## 3. 前端按需 + 预取（`pages/bazi.html`）

### 3.1 新交互流

```
用户提交生辰
  → [瞬出] 首屏视觉卡：命盘图(pillars from calcBazi 回传) + 五行条形图 + 大运时间轴SVG + 章节目录(TOC)
     (这些不等 LLM；pillars 已由端点/本地引擎给出)
  → [自动] 拉免费首章 pillars 文字（按需 /chapter）
  → 用户往下读 → 命中"读到第 N 章"→ 后台预取第 N+1 章
  → 免费 3 章读完 → 付费章显示"锁定卡"（不产文）
  → 用户付费 → 解锁：逐章按需拉 OR 一次全量（触发 PDF，§5）
```

### 3.2 目录 + 按需拉取状态机

每章一个状态：`idle | loading | streaming | done | locked | error`。

- 首屏渲染 TOC（10 章标题+emoji，来自 config 下发或前端硬编码同一份枚举）。
- 章节卡懒渲染：进入视口(IntersectionObserver) 或用户点"展开" → 若 `idle` → 触发 `fetchChapter(id)`。
- `fetchChapter` 复用现有 `fetch + getReader()` SSE 解析（`bazi.html:885`），把 `chunk` 累加进**该章**容器，`done` 置 `done`，`locked` 渲染锁定卡。

### 3.3 预取策略

- **触发**：当第 N 章进入"正在阅读"（章标题滚过视口顶部）→ 预取 N+1（若 `idle` 且用户有权限/该章免费）。
- **并发控制**：全局并发上限 **2**（1 个当前可见章 streaming + 1 个预取）。超过则排队。避免 DeepSeek 并发打满 + 移动端多路 SSE 卡顿。
- **预取只预取"下一章"**（不贪心预取全部），省免费用户 token；付费用户可放宽到预取 N+1、N+2。
- **付费章不预取**（无权限时预取只会拿到 `locked`，浪费一次请求）→ 预取前先查本地 `hasAccess` 标志。

### 3.4 错误重试 + 加载态

- **加载态**（铁律 `feedback_lumee_loading_states`）：章卡骨架屏 + 转圈；按钮禁用防重复点击。
- **重试**：`error` → 章卡显示"重新生成"按钮；自动重试 1 次（指数退避 1s），仍失败才暴露按钮。
- **超时**：单章前端超时设 **20s**（单章 3-6s，20s 足够冗余，且远低于老整篇 42s → 不再撞超时）。
- **断流续接**：SSE 中断 → 该章标 `error` 可重试；**不影响其他章**（分章天然隔离，这是相对整篇的核心优势）。

### 3.5 复用现有精装

命盘图/五行雷达/大运时间轴/首字下沉/章节封面卡(`art-*.png`)/付费墙 blur——**全部保留**，只是从"整篇切章"改为"每章独立容器渲染"。现有 emoji 切章逻辑（`bazi.html:1315,1978`）在分章模式下**不再需要切**（每章已经是独立流），可简化为直接渲染单章。

---

## 4. 付费墙兼容（单章 gate）

- 单章端点入口：`const acc = gateReportAccess(req, ['bazi','사주','八字'])`（复用，`store.js:367`）。
- 判定：
  - 该章 `free:true` → 无论权限都产文。
  - 该章 `free:false` 且 `acc.full` → 产文。
  - 该章 `free:false` 且 `!acc.full` → **发 `locked` 事件，正文一字不产**（源头省 token + 防白嫖）。
- **锁定内容绝不进 DOM**：付费章无权限时后端根本不产文，前端只渲染 config 里的静态 `teaser` 短句 + 解锁 CTA（沿用 `bazi.html:2045` 付费墙）。比现在"整篇里 blur 遮住"更彻底——**遮不住的问题从根上没有了**（DOM 里压根没有付费正文）。
- 月会员 credit：`gateReportAccess` 里 `viaCredit` 逻辑复用。⚠️**注意**：分章模式下**不能每点一章消费一次 credit**。规则：月会员点第一个付费章时消费 **1 个报告 credit**，之后**本报告所有付费章免费解锁**（用 `birth+lang` 指纹 + 会话内 `unlocked` 标志判定同一报告）。失败回滚 `_refundCreditOnFail` 复用。
- `order_no` 单笔解锁：沿用 `baziEnglishHandler:352-355` 逻辑。

---

## 5. PDF 触发（珍藏版）

### 5.1 触发时机

**仅付费解锁完整版时**触发（免费用户永不生成 PDF）。触发点 = 支付成功回调后 / 用户点"下载珍藏版 PDF"按钮。

### 5.2 流程（复用 `reference_runae_report_render_pipeline`）

```
付费成功
  → 后端一次性全量生成全 10 章（复用老 /api/bazi/stream 的 full 分支，maxTokens 16384，一次调用出全篇；PDF 场景不在乎 42s，异步跑）
  → 落库完整 reading（insertReading）
  → HTML 排版(命盘视觉卡 + 全章折叠展开，build_bazi_visual 那套) → Chrome --headless --screenshot → PIL 合多页 PDF
  → 存 samples/ 或对象存储 → 回写下载链接到订单/用户
  → 前端"珍藏版 PDF 已就绪 ↓"
```

### 5.3 同步 or 异步

**异步**（PDF 渲染含 Chrome 无头 + PIL，秒级到十几秒，不能卡住支付响应）：
- 支付回调**立即返回成功**（用户马上能在线读全章）。
- PDF 生成进后台队列（简单实现：`setImmediate` + 内存队列 / 或落一个 `pdf_pending` 状态轮询）。
- 前端轮询 `GET /api/bazi/pdf-status?order_no=` → `pending|ready|failed`。

### 5.4 失败兜底

- PDF 生成失败**不影响在线阅读**（用户已能读全章，PDF 是加值）。
- 失败 → 标 `failed` + 后台重试 1 次；仍失败 → 前端显示"珍藏版生成中，稍后到账/或联系客服补发"，**不报错吓用户**。
- Chrome/ComfyUI 依赖缺失是已知坑（`reference_shenyuan_hk_infra_landmines`：vendor/dist 被 gitignore 漏）→ 部署 checklist 必含 PDF 渲染依赖 smoke。

> ⚠️ **成本**：PDF 那次"全量 16384 tokens"就是付费用户唯一的大 token 开销——**它换来了 $9.9/$49 收入**，成本合理。免费用户永远走不到这一步。

---

## 6. 成本模型（token 估算）

| 用户类型 | 行为 | LLM token 消耗 | vs 现状 |
|---|---|---|---|
| 免费·只看首屏 | 命盘图秒出，一章文字都没点开 | **≈0**（命盘=纯引擎计算，不调 LLM） | 现状 3500 → **省 100%** |
| 免费·读完 3 免费章 | pillars+elements+year 各 ~900 | **≈2600 tokens** | 现状 3500（实吐 6677 字）→ **省 ~25% token，且不再超吐** |
| 免费·点满想解锁 | 3 免费章 + 撞付费墙(locked 不产文) | **≈2600 tokens** | 白嫖者拿不到付费正文 |
| 付费·在线读 | 全 10 章分章生成（若逐章）≈ 各章 maxTokens 合计 ≈10500 | **≈10500 tokens** | 现状 16384 → 省，但更贵的是下方 PDF |
| 付费·下载 PDF | 一次全量 16384（PDF 用） | **≈16384 tokens**（一次性） | 与现状 full 相当，但**只对已付费用户发生** |

**核心收益**：免费流量的 token 成本从"人人 3500"降到"点几章烧几章、不点几乎为 0"。按免费:付费 = 95:5、免费用户平均点 1.5 章估算，**免费侧总 token 成本降约 60-70%**，直接改善毛利与白嫖损耗。

> 免费首屏"命盘图秒出且 0 token"是最大杠杆——把最贵的整篇 LLM 从免费漏斗顶部彻底移走。

---

## 7. 兼容与回滚

- **不破坏现有**：`/api/bazi/stream` 原样保留（回滚兜底 + PDF 全量路径复用）。新端点独立文件/独立函数，不改老函数体。
- **灰度开关**：
  - 后端 env `BAZI_CHAPTERED=on|off`（或 `/api/config` 下发 flag）。
  - 前端读 flag 决定走 `/chapter` 还是 `/stream`。
  - 放量：内部 → 10% → 50% → 100%，每档看"failed to generate 率 / 首屏时间 / 免费 token 均值 / 付费转化率"四指标不劣化。
- **回滚**：flag 一键切回 `off` → 全站回老整篇路径，秒级回滚，零数据迁移。
- **先八字试点，再推其他 25 方法**：config 机制通用（`report-config/<method>.js` + `i18n/<method>.<lang>.js`），紫微/合婚/西占等按同一 `CHAPTERS + I18N` 模式接入 `/api/<method>/chapter`。**MVP 只做八字**，验证后再复制机制。

---

## 8. 分阶段与验收

### 阶段 1 — MVP：八字分章按需（不动多语言重构）

**范围**：新增 `/api/bazi/chapter`（先只支持 **zh + en** 两语言，直接硬编码 prompt，不上 config），前端 `bazi.html` 分章按需+预取，付费墙单章 gate，灰度开关。
**验收**：
- [ ] 首屏命盘图/五行/时间轴**瞬出**（<1s，0 LLM 调用）。
- [ ] 单章生成 **≤6s**（curl 实测 zh+en 各章），**不撞前端超时**。
- [ ] 免费用户只烧点开章的 token（日志验证免费均值 <3000）。
- [ ] 付费章无权限时**正文一字不进 DOM**（View Source 验证）。
- [ ] 灰度开关 on/off 均端到端出报告（`feedback_verify_generate_before_handing`：自己先 curl 200 出真报告 + 测耗时不撞守卫）。
- [ ] 老 `/stream` 仍可用（回滚验证）。

### 阶段 2 — config 化多语言

**范围**：抽 `report-config/bazi.js` + `i18n/bazi.<lang>.js`，`/chapter` 改走 `buildChapterPrompt`，覆盖 en/pt/th/es/zh/ko/in 全语言；老 `/stream` 也可选切到同一 config（降低两套 prompt 分叉）。
**验收**：
- [ ] 7 语言各章 smoke：输出语言正确、真引擎数据被采用、合规话术(HEALTH_SOFT/免责/避 "Chinese")未丢。
- [ ] 改一处章节字数 → 7 语言同时生效（改 `CHAPTERS.words` 验证）。
- [ ] 新旧 prompt 输出质量对比不回退（抽样人工过目 + 字数达标）。

### 阶段 3 — PDF 珍藏版 + 推广其他方法

**范围**：付费触发异步 PDF（§5）；用同一 config 机制接 2-3 个其他方法（如紫微/合婚）验证复用。
**验收**：
- [ ] 付费解锁 → 在线秒读全章 + 后台 PDF 异步到账；PDF 失败不影响阅读。
- [ ] 免费用户永不触发 PDF（日志/权限验证）。
- [ ] 至少 1 个其他方法用同一机制跑通（证明可推广到 25 方法）。

---

## 9. 风险与缓解（改核心变现路径）

| 风险 | 影响 | 缓解 |
|---|---|---|
| **分章后 LLM 丢失整篇上下文，章节间前后矛盾**（如财运章和事业章对同一大运判断打架） | 报告可信度掉、专业度露怯 | 每章都注入**同一份真引擎 baziBlock**（用神/喜忌/大运是引擎算的硬数据，不靠 LLM 记忆）→ 各章基于同一硬盘面，天然一致。sysPrompt 内固定"以上方精确排盘为准"。 |
| **免费转付费漏斗被改坏，转化率掉** | 直接砸收入（核心变现路径） | 灰度放量按"付费转化率不劣化"为放量门槛；付费墙 CTA/文案/位置保持现状；A/B 对比老路径。 |
| **多路 SSE 在弱网/移动端不稳，比整篇更容易"某章失败"** | 用户看到半截报告 | 并发上限 2 + 单章隔离（一章挂不拖垮全篇）+ 自动重试 1 次 + 章级"重新生成"。整体比"整篇 42s 一挂全没"更健壮。 |
| **config 迁移丢合规话术/语气回退** | 触碰合规红线(娱乐免责/避 Chinese/不吓人) | 阶段 2 先原样搬文案再重构；迁移后跑合规 grep + 人工抽审；老 `/stream` 兜底可回滚。 |
| **DeepSeek key 402 / 单 provider 挂**（历史事故） | 全线 failed | 沿用 `LLM_PRIORITY=qwen,deepseek,groq` 兜底链（`reference_shenyuan_hk_infra_landmines`）；分章使每次请求小、失败面小、重试便宜。 |
| **PDF 依赖(Chrome/ComfyUI/字体)生产缺失** | 珍藏版 500 | PDF 异步且失败不阻断阅读；部署 checklist 加 PDF 渲染 smoke；vendor/dist 用 `git add -f` 防 gitignore 漏。 |
| **月会员 credit 被"每章消费一次"误扣** | 用户投诉、退款 | §4：一份报告首个付费章扣 1 credit，之后同报告全解锁；失败 `_refundCreditOnFail` 回滚。 |

---

## 自评分与差距

**自评 9.3 / 10。**

到 10 分还差（需 Karen/工程师拍板的落地细节）：
1. **章节内容字数/维度需命理专家校准**：本 PRD 的 §1.3 字数与 `dims` 是按现有 prompt 平移估的，未经命理专家审"每章维度是否够专业、会不会因分章变薄"。建议阶段 1 出样章后过一遍命理专家（`feedback_expert_review_first`）。
2. **PDF 队列的具体实现选型**（内存队列 vs 落库轮询 vs 复用现有 job 机制）未定——取决于服务器现有基建，需读一遍现有 push/job 代码再定。
3. **同一报告"已解锁"指纹的持久化**（跨会话/换设备后付费章是否仍解锁）需和现有订单/token 体系对齐一次，避免付费用户换手机又被挡。

---

**报告文件**：`/Users/karen/projects/shenyuan/docs/PRD-报告分章按需生成.md`
**MVP 一句话**：八字新增 `POST /api/bazi/chapter`（SSE 单章·真引擎每章注入·免费 3 章按需/付费章无权限不产文）+ `bazi.html` 首屏命盘图秒出 + 逐章按需拉 + 读时预取下一章，灰度开关与老 `/stream` 并存可秒回滚。
**最大风险点**：改的是核心变现漏斗——分章可能①章节间前后矛盾（靠"每章注入同一真引擎硬数据"化解）②免费→付费转化率被改坏（靠灰度按转化率门槛放量 + 付费墙现状不动化解）。
