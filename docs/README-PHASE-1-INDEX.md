# ShenYuan Phase 1 文档索引

**项目**：三语报告页对齐（CN/EN/KR）  
**状态**：✋ 等待 Karen 批准启动  
**创建日期**：2026-08-10

---

## 🎯 我应该读哪个文档？

### 👑 我是 Karen（CEO/Product Owner）

**快速理解** → 5 分钟
- 📄 **[EXEC-SUMMARY-FOR-KAREN.md](./EXEC-SUMMARY-FOR-KAREN.md)**
  - 一句话总结 + 三个决策点 + 商业回报
  - 包含 Prompt 类型选择 & 支付通道决策

**全面理解** → 15 分钟
- 📄 **[PRD-Phase-1-一页纸版.md](./PRD-Phase-1-一页纸版.md)**
  - 为什么现在做 + 核心交付 + 技术亮点 + 时间轴

### 👨‍💻 我是 CTO/Tech Lead

**项目全景** → 30 分钟
- 📋 **[PRD-Phase-1-报告页对齐-完整版.md](./PRD-Phase-1-报告页对齐-完整版.md)**
  - 概述 + 需求分析 + 功能清单 + 技术实现 + 质量标准 + 时间表
  - **包含详细 API 设计、数据库 schema、前端架构**

**技术评审意见** → 15 分钟 ⭐ **先读这个**
- 🔍 **[TECHNICAL-REVIEW-ASSESSMENT.md](./TECHNICAL-REVIEW-ASSESSMENT.md)**
  - 综合评分 8.1/10 + Top 3 强项 + Top 3 缺陷 + Top 3 可优化
  - **包含补充清单（向后兼容 + DeepSeek 限流 + 数据库回滚）**
  - 启动前必读

**立即启动** → 2 小时
- ✅ **[TECHNICAL-IMPLEMENTATION-CHECKLIST.md](./TECHNICAL-IMPLEMENTATION-CHECKLIST.md)**
  - 逐步任务清单，每完成一个打勾
  - **包含 curl 命令、代码框架、测试用例**
  - 6 个 Phase（前置准备 → API 开发 → 前端开发 → 测试 → 部署准备 → 上线）

### 👥 我是 Design/UX

**设计规范** → 10 分钟
- 📄 PRD 第 3.1 节 → 0.4 CSS 统一方案（见完整版 PRD）
- 📄 PRD 第 4.1 节 → UI/UX 质量门禁（对比度/触控/响应式）

**Figma 参考**
- 中文：复用现有 bazi.html 设计
- 英文：字号/间距微调（for English typography）
- 韩文：复用现有 saju-report-KR.html 设计

### 🧪 我是 QA/测试

**测试计划** → 20 分钟
- 📄 PRD 第 4.2 节 → 测试矩阵（30+ 场景）（见完整版 PRD）
- ✅ TECHNICAL-IMPLEMENTATION-CHECKLIST.md Phase 1.3 → 具体测试步骤

**工作流**
1. Phase 1.3：功能测试（QA 手测 30+ 场景）
2. Phase 1.4：性能测试（Lighthouse + backend profiling）
3. Phase 1.5：Staging 验收 & Beta 用户测试（50 人）

### 📊 我是 Product Manager/Analytics

**变现设计** → 10 分钟
- 📄 PRD 第 3.1.0.1 → 报告分级逻辑
- 📄 EXEC-SUMMARY → 商业回报估算（$950/月 + $2k 季节峰）

**上线后监控指标**
- 转化率：生成报告 → 付费
- 支付成功率：按语言/支付方式分解
- NPS：用户满意度追踪
- MRR：按语言分解，看季节性波动

---

## 📋 文档详细说明

| 文档 | 大小 | 读者 | 时间 | 关键内容 |
|------|------|------|------|----------|
| **EXEC-SUMMARY-FOR-KAREN.md** | 4KB | Karen | 5 min | 决策点 + ROI + 下一步 |
| **PRD-Phase-1-一页纸版.md** | 3KB | 全部 | 10 min | 快速参考 + 时间轴 |
| **PRD-Phase-1-报告页对齐-完整版.md** | 15KB | CTO/PM | 30 min | 完整需求 + 技术设计 + 质量标准 |
| **TECHNICAL-REVIEW-ASSESSMENT.md** ⭐ | 8KB | CTO/Dev | 15 min | 评分 8.1/10 + 3 缺陷 + 补充清单 |
| **TECHNICAL-IMPLEMENTATION-CHECKLIST.md** | 12KB | Dev/QA | 2 hrs | 逐步任务清单 + 代码框架 |
| **README-PHASE-1-INDEX.md** | 这份 | 全部 | 5 min | 文档导航（你在这儿） |

---

## 🚀 快速启动（3 步）

### Step 1：Karen 审批（今天）
```
📧 Karen 读 EXEC-SUMMARY-FOR-KAREN.md
→ 回复 3 个决策：
  1. 支付通道（A: Stripe / B: Kakao / C: PG）
  2. 英文用户类型（A: 海外华人 / B: 学生 / C: Gen Z）
  3. 同意启动（✅ Approved）
```

### Step 2：CTO/Tech Lead 启动（W1 周一）
```
🔍 先读 TECHNICAL-REVIEW-ASSESSMENT.md（15 min）
→ 了解评分 8.1/10 + 3 个关键缺陷

📋 打开 TECHNICAL-IMPLEMENTATION-CHECKLIST.md
→ 执行 Phase 1.0（前置准备）
  • 检查 DeepSeek API 配额
  • 确认环境变量
  • 拉设计资产
  • ⭐ 补充向后兼容测试
  • ⭐ 补充 DeepSeek 限流实现
  • ⭐ 补充数据库回滚脚本
→ 分配团队角色
```

### Step 3：团队执行（W1-W7）
```
✅ 每完成一个任务，在 checklist 中打勾
→ 保持 7 周发布节奏
→ W7 正式上线三语版本
```

---

## 📞 常见问题

### Q1：这个项目为什么优先级这么高？

**A**：符合收入战略第一梯队
- 中文：基本盘 50-55%（稳定 MRR）
- 英文/韩文：新市场扩张
- 时间：韩国春节峰（12-2 月）正好 W7 上线

### Q2：为什么是 7 周而不是更快？

**A**：
- W1：设计 + Prompt（不能跳）
- W2：开发完成（代码质量优于速度）
- W3：QA + 性能优化（不测试打不了生产）
- W4：Staging 验收（50 人 beta 验证）
- W5：部署准备（监控/文档/应急预案）
- W6-7：灰度上线（10%→50%→100% 风险管理）

**全可压缩，但风险倍增（bug 多、用户流失）**

### Q3：英文 Prompt 怎么写？

**A**：见 PRD 第 3.1 B.2 + 附录 10.2

关键是：
- 不是简单中译英，要"西方占星对标"
- 不是机翻，要母语校对（你决定用户类型后，由独立 agent 评审）
- 4000+ 词，讲述要赋能不是宿命

### Q4：支付那块怎么选？

**A**：见 EXEC-SUMMARY「决策 1」

**推荐 A**（先 Stripe，后加 Kakao）：
- 不阻塞 W1 启动
- KakaoPay 可 Phase 1.5 迭代
- 韩国用户可用 USD 支付（虽然跨汇率）

### Q5：真机测试为什么一定是 Karen 做？

**A**：因为只有你能操作：
- Stripe 美国个人账户（你的银行卡）
- Kakao 韩国测试账户（需你配置）
- Webhook 回调验证（需看真实后端日志）

其他人看不到这些。W4 Staging 时预留 1 小时。

### Q6：万一 W3 发现大 bug 怎么办？

**A**：有 buffer
- W3 完成 → W4 Staging 还有 1 周 buffer
- 允许改小 bug（不允许改架构）
- 如果改架构，就延期到 W5（但会错过春节峰）

### Q7：上线后出问题怎么办？

**A**：有灰度保护
- W6 先上 10%（中文），如果崩溃，快速回滚
- 监控 Sentry + Grafana 24/7 告警
- 运维 on-call（部署工程师待命）
- 应急预案：`git revert + pm2 restart + 通知用户`

---

## 📊 项目进度看板

打印或链接到团队 wiki：

```
┌─────────────────────────────────────────┐
│         Phase 1 进度跟踪（实时）        │
├─────────────────────────────────────────┤
│ W1: 🔵🔵🔵⚪ (50%)  设计 + Prompt      │
│ W2: ⚪⚪⚪⚪ (0%)   开发中...           │
│ W3: ⚪⚪⚪⚪ (0%)   测试计划            │
│ W4: ⚪⚪⚪⚪ (0%)   Staging             │
│ W5: ⚪⚪⚪⚪ (0%)   部署准备            │
│ W6: ⚪⚪⚪⚪ (0%)   灰度上线            │
│ W7: ⚪⚪⚪⚪ (0%)   全量上线 🚀          │
├─────────────────────────────────────────┤
│ 关键卡点：                              │
│ 🔴 Prompt 英文质量评审 (W2)             │
│ 🟡 KakaoPay 支付集成 (W2-3)            │
│ 🟢 Staging 验收 (W4)                    │
└─────────────────────────────────────────┘
```

---

## 📚 补充资料

### 现有文档参考（复用）
- `pages/bazi.html` — 中文报告参考设计
- `pages/bazi-en.html` — 英文报告参考框架（80% 重复，Phase 1 删除）
- `docs/saju-report-KR.html` — 韩文样张（9.6/10，质量参考）
- `docs/PRD-韩国MVP-0730.md` — 韩国市场背景

### 相关项目（架构借鉴）
- `../lumee/` — 军师引擎、i18n 系统、支付架构（可复用）
- `../slim/` — 前端 React + 支付墙实现（参考）

### 外部资源
- DeepSeek API docs: https://platform.deepseek.com/docs
- Stripe Webhooks: https://stripe.com/docs/webhooks
- KakaoPay Integration: https://developers.kakao.com/ (需注册)

---

## ✍️ 审批署名

| 角色 | 姓名 | 审批 | 日期 |
|-----|------|------|------|
| CEO / Product | Karen | ✅ / ❌ | ____ |
| CTO / Tech Lead | — | ✅ / ⏳ | ____ |
| Design Lead | — | ✅ / ⏳ | ____ |
| QA Lead | — | ✅ / ⏳ | ____ |

---

## 📞 联系人

- **项目 PM**：Claude Code
- **CTO 接收**：等待 Karen 指定
- **设计提交**：等待 Karen 指定
- **开发分配**：等待 Karen 指定

---

## 🎬 立即行动

**Karen，现在就做这三件事**：

1. ✅ 读 **EXEC-SUMMARY-FOR-KAREN.md**（5 min）
2. 📧 回复三个决策（支付/英文用户/批准启动）
3. 📅 把 W4 的"真机测试"写到日程里

**然后转发给 CTO**：
> "Phase 1 approved. 打开 TECHNICAL-IMPLEMENTATION-CHECKLIST.md，W1 周一启动。"

---

**Last updated**: 2026-08-10  
**Next review**: 2026-08-17 (W1 周五设计定稿)

