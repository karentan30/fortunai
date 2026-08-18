# Phase1 执行计划 — 多体系交叉验证
> 基于 PRD v2 可动工版 · 2026-08-18

---

## Phase1 范围一句话
**四体系同时排盘（八字+紫微+奇门+六爻）→ 命盘/卦象两组独立比对 → SSE 流式输出 + 免费钩子**；不含支付、报告异步、Western Astro，这些留 P2/P3。

---

## 做什么 / 不做什么

| 做（P1 交付） | 不做（留后期） |
|---|---|
| 4 体系排盘 + 独立 LLM 分析（并行） | Stripe 支付接入（P2） |
| 两个独立 gauge（命盘组 / 卦象组） | 报告异步队列 + 邮件通知（P3） |
| SSE 流式进度条 `/api/cross-check/stream` | Western Astro 入问事（需出生地，P2+） |
| 比对层硬编码诚实禁令 | DaLiuRen 第5体系（P2+） |
| overallConsensus 枚举后端校验 | 合婚 × 交叉（P2+） |
| synthesisAdvice 固定模板 | 流年预警季度推送（P3+） |
| 免费钩子（最强共识维度 1 句话 verdict） | |
| AI 标识规范（每个 verdict 旁） | |
| 娱乐免责在表单提交前可见 | |
| requireEntitlement 占位，默认拒绝防烧钱 | |

---

## 文件级设计

### 新建文件（仅此 Phase1，不改任何现有文件）

```
server/lib/cross-validation/
├── index.js          统一出口 — 导出 streamRouter + 各子模块
├── systems.js        体系登记表 — 四体系定义 + DIMENSIONS + GROUP 常量
├── systemAnalysis.js 各体系独立分析层 — buildBlock → LLM → dims JSON
├── crossCompare.js   交叉比对层 — 两组 gauge + synthesisAdvice 模板
└── streamRoute.js    SSE 路由骨架 — POST /stream

docs/
└── PRD-多体系-Phase1-执行计划.md  (本文件)
```

### 复用现有引擎（不修改）

| 引擎 | 复用接口 | 用于 |
|---|---|---|
| `server/lib/bazi-engine` | `computeBaziChart(opts)` | 八字 + 紫微同源排盘 |
| `server/lib/qimen-engine` | `computeQimen({ date })` + `buildQimenBlock()` | 奇门遁甲排盘文本 |
| `server/lib/liuyao-engine` | `computeLiuyao({ date })` + `buildLiuyaoBlock()` | 六爻排盘文本 |
| `server/lib/llm.js` | `deepseekChat(messages, opts)` + `deepseekStream(messages, opts)` | LLM 分析 + SSE 流式 |
| `server/routes/cross-check.js` | 参考 SYSTEMS[bazi/ziwei] 的 buildBlock 逻辑 | 迁移八字/紫微排盘文本构建 |

---

## 数据流

```
用户输入
{ year, month, day, hour, minute, gender, isLunar }
        │
        ▼
┌─────────────────────────────────────────────┐
│  Step 1: 真引擎排盘（同步·1次）               │
│  computeBaziChart(birthOpts)                │
│  → { bazi, ziwei }  命盘，两体系共用         │
│  queryDate = new Date()  当前时刻，卦象体系用 │
└─────────────────────────────────────────────┘
        │
        ▼  并行（Promise.all）
┌─── GROUP_BIRTH ─────────┐  ┌─── GROUP_MOMENT ────────┐
│ bazi.buildBlock(chart)  │  │ qimen.buildBlock(date)  │
│ → LLM → { career,      │  │ → LLM → { career,       │
│           wealth, love, │  │           wealth, love,  │
│           health }      │  │           health }       │
│ ziwei.buildBlock(chart) │  │ iching.buildBlock(date) │
│ → LLM → { ... }        │  │ → LLM → { ... }         │
└─────────────────────────┘  └─────────────────────────┘
        │                              │
        └──────────── perSystem ───────┘
                          │
                          ▼  并行（Promise.all）
              ┌─────────────────────────┐
              │  crossCompare Layer     │
              │  birth  → LLM → birthGauge  │
              │  moment → LLM → momentGauge │
              └─────────────────────────┘
                          │
                          ▼
              synthesisAdvice（逐维度固定模板）
                  "从命盘看X·从时机看Y·两者一致/不一致"
                          │
                          ▼
                   SSE 推送最终结果
```

**LLM 调用次数：3次并行**
- 命盘组分析（bazi + ziwei 合一次）
- 卦象组分析（qimen + iching 合一次）
- 比对合成（birth 比对 + moment 比对 合一次）

目标总耗时：**25-35 秒**（PRD 要求）

---

## 交叉验证算法设计

### 两个独立 gauge（铁律：绝不合并）

```
birthGauge  = 命盘类共识分（八字 vs 紫微）
              论：人生底色、先天格局
momentGauge = 卦象类共识分（奇门 vs 六爻）
              论：当下时机、行动窗口
```

前端必须渲染为两个**完全独立**的进度条/仪表组件。
组件不接受 `combinedScore` prop（工程红线 ③）。

### overallConsensus 枚举（后端校验）

| 值 | 含义 |
|---|---|
| `STRONG_CONSENSUS` | ≥ 3/4 体系对该组维度一致 |
| `PARTIAL` | 2/4 一致，偏向一方 |
| `SPLIT` | 2v2 正面对立 |
| `DIVERGENT` | 体系间几乎无共识 |

非法值：后端 `validateConsensus()` 降级为 `DIVERGENT` + 重试一次。

### 比对层硬编码禁令（prompt 中必须原样保留）

```
"你是诚实比对器不是解释器
 3:1就说3:1分歧，禁止用'整体倾向'掩盖
 分歧是信息，不得平滑
 体系一致 ≠ 预测成立，只是多视角共识"
```

### synthesisAdvice 固定模板

```
"从命盘看（BaZi+ZiWei）：[birth dim summary]。
 从时机看（Qimen+IChing）：[moment dim summary]。
 两者[一致/分歧]的含义：[brief implication]。"
```

### 认识论诚实标注

- 命盘类（八字/紫微）：论先天格局 → 用 label "Natal Destiny Layer"
- 卦象类（奇门/六爻）：论当下时机 → 用 label "Current Timing Layer"
- 两类绝不互相解释对方

---

## API 端点设计

```
POST /api/cross-check/stream
Content-Type: application/json
```

**Request body:**
```json
{
  "year": 1990, "month": 6, "day": 15,
  "hour": 10, "minute": 0,
  "gender": "female",
  "isLunar": false
}
```

**SSE 事件流（按顺序）：**

```
data: {"type":"progress","step":"computing_charts","message":"Computing your natal charts..."}

data: {"type":"progress","step":"analyzing_systems","message":"Running 4 divination systems in parallel..."}

data: {"type":"system_result","systemId":"bazi","name":"BaZi (Four Pillars)","group":"birth_chart","dims":{...}}
data: {"type":"system_result","systemId":"ziwei",...}
data: {"type":"system_result","systemId":"qimen","group":"moment_oracle",...}
data: {"type":"system_result","systemId":"iching",...}

data: {"type":"progress","step":"comparing","message":"Cross-comparing systems..."}

data: {
  "type":"comparison_result",
  "systems":[...],
  "dimensions":[...],
  "perSystem":{...},
  "birthGauge":{"overallConsensus":"PARTIAL","dimensions":{...}},
  "momentGauge":{"overallConsensus":"STRONG_CONSENSUS","dimensions":{...}},
  "synthesisAdvice":{"career":"...","wealth":"...","love":"...","health":"..."},
  "disclaimer":"..."
}

data: {"type":"progress","step":"done","message":"Complete."}
```

**免费用户（仅返回 hook）：**
```
data: {"type":"system_result",...}  // 1条，最高共识体系
data: {"type":"hook","hookText":"...","upgrade":true,"upgradeReason":"..."}
```

**挂载方式（Phase1 完成后）：**
```js
// server/app.js 或 server/index.js（待 Karen 统一挂载）
const { streamRouter } = require('./lib/cross-validation');
app.use('/api/cross-check', streamRouter);
```

---

## 里程碑拆解

| 里程碑 | 任务 | 预估 | 负责 |
|---|---|---|---|
| M1 · 体系层打通 | `systems.js` 四个 `buildBlock` TODO 填肉；跑 `node __test.js` 验证排盘文本输出正确 | 1天 | |
| M2 · 分析层验证 | `systemAnalysis.analyzeAllSystems` 实现；本地 curl POST 验证 4 条 system_result 事件 | 0.5天 | |
| M3 · 比对层完成 | `crossCompare.runCrossCompare` 实现；`validateConsensus` 枚举校验通过；synthesisAdvice 模板正确 | 0.5天 | |
| M4 · SSE 路由完成 | `streamRoute.js` TODO 填肉；curl --no-buffer 全流程跑通；进度条事件顺序正确 | 0.5天 | |
| M5 · 免费钩子 | `buildFreeHook` 实现；未授权用户收到 hook 事件而非比对结果 | 0.5天 | |
| M6 · 前端接入 | SSE 消费 + 两个独立 gauge UI + AI 标识 + 娱乐免责展示 | 1.5天 | |
| M7 · QA + 上线 | 端到端 smoke；25-35s 耗时验证；专家评审 9 分；Karen 签字 | 0.5天 | |
| **P1 合计** | | **~5天** | |

---

## 依赖 & 风险

| 风险 | 概率 | 应对 |
|---|---|---|
| `buildQimenBlock` / `buildLiuyaoBlock` 输出格式与 LLM 分析 prompt 不匹配，维度结论质量差 | 中 | M1 先跑测试验证排盘文本，再调整 prompt |
| 奇门/六爻引擎是 async ESM（动态 import），在 Vercel/PM2 冷启动后首次调用慢（模块加载） | 中 | 预热：server 启动时 `computeQimen({ date: new Date() })` 一次静默触发 |
| 4 体系并行 LLM + 1 次比对 = 5 次调用，总耗时超 35s | 中 | 实测后若超时，命盘/卦象两组改 2 个批次调用；比对合成从 600 降到 400 token |
| `deepseekStream` 60s Vercel 超时（综合报告走异步是 P3）| 低 | P1 不做综合报告；stream 端点耗时控制在 40s 以内 |
| `requireEntitlement` 未接真实会员判断，上线前默认拒绝所有请求 | 已知 | 开发期设 `CROSS_CHECK_ALLOW_UNGATED=1`；P2 接权限闸再开放 |
| qimen/liuyao 引擎 vendor 在 server/lib/*/vendor，部署时可能被 .gitignore 漏掉 | 已知坑 | 参考 HK 服务器地雷记录：`git add -f server/lib/*/vendor` 后验证 |

---

## 工程红线（来自 PRD，不得违反）

1. 引擎算盘 / LLM 只解读，禁止 LLM 自排
2. `overallConsensus` 必须枚举，后端强校验
3. `birthGauge` / `momentGauge` 禁止合并（组件不接受合并分数 prop）
4. 综合报告必走异步（P3 才做，P1 不出报告）
5. 不暴露模型名（前端文案一律"our secure AI"）
6. 娱乐免责不可 `display:none`，表单提交前用户可见
