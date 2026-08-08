# 善缘 Stripe 支付集成 · 完整指南

**最后更新**: 2026-08-08  
**状态**: ✅ 设计完成，准备部署  
**总文档数**: 3 份 + 本文件

---

## 📚 文档导航

本目录包含善缘 Stripe 完整支付方案的所有文档：

### 1. **STRIPE-CONFIGURATION-COMPLETE.md** (主文档)
   - **长度**: 3,500+ 行
   - **用途**: 完整的配置与部署指南
   - **包含内容**:
     - Phase 1-3 完整定价清单
     - Stripe 账户配置步骤
     - 后端代码验证
     - 前端集成示例 (HTML/JS)
     - 5 个完整的测试场景 (可直接用 curl 测试)
     - 生产部署的 5 个步骤
     - 监控指标与 KPIs
     - 常见问题 Q&A
     - 上线前的 60+ 项检查清单
   - **适合人群**: Engineering Team, DevOps, Product Manager
   - **建议阅读时间**: 60 分钟

### 2. **STRIPE-PRICE-IDS-REFERENCE.json** (配置文件)
   - **长度**: 500+ 行 JSON
   - **用途**: 所有 Price ID 的权威参考
   - **包含内容**:
     - USD/CNY/KRW 三币种的完整价格表
     - 已验证 vs 待创建的 Price IDs 区分
     - Phase 1-3 完整产品列表
     - Stripe Dashboard 创建清单
     - 环境变量模板
     - 代码集成参考
   - **适合人群**: Financial Team, Engineering
   - **建议使用**: 作为 Price ID 的唯一真实来源
   - **重要**: 部署前必须验证所有 ID 与 Stripe Dashboard 一致

### 3. **STRIPE-DEPLOYMENT-CHECKLIST.md** (执行清单)
   - **长度**: 2,000+ 行
   - **用途**: 可打印/可签字的部署检查清单
   - **包含内容**:
     - 8 个红线项 (上线拦截标准)
     - 15 个功能验收清单 (绿色清单)
     - 5 个代码审查项
     - 6 个性能基线指标
     - 3 个安全审计检查点
     - 多端验证 (桌面/iOS/Android)
     - 上线前 30 分钟检查
     - 上线后 Day 2 监控
     - 6 角色签字页
   - **适合人群**: QA Team, Engineering Lead, CFO
   - **建议**: 打印后贴在工位，按步骤逐项勾选
   - **重要**: 所有红线项必须 100% 完成才能上线

### 4. **README-STRIPE-SETUP.md** (本文件)
   - 导航与快速查询
   - 关键链接与联系方式

---

## 🚀 快速开始 (5 分钟)

### 情景 1: 我是产品经理，想了解定价策略
**阅读顺序**:
1. 本文件的"定价总结"部分 (下面)
2. STRIPE-CONFIGURATION-COMPLETE.md 的"Phase 1 定价清单"表格 (第 50-80 行)
3. STRIPE-PRICE-IDS-REFERENCE.json 的 Phase 1 部分

**时间**: 15 分钟

### 情景 2: 我是工程师，负责集成与部署
**阅读顺序**:
1. STRIPE-CONFIGURATION-COMPLETE.md 的"现有代码验证"章节 (验证后端已就位)
2. STRIPE-CONFIGURATION-COMPLETE.md 的"部署步骤"章节 (Step 1-5)
3. STRIPE-DEPLOYMENT-CHECKLIST.md (逐项检查)
4. STRIPE-PRICE-IDS-REFERENCE.json (部署前验证所有 IDs)

**时间**: 2-3 小时

### 情景 3: 我是 CFO，需要上线授权
**阅读顺序**:
1. 本文件的"业务总结"部分 (下面)
2. STRIPE-CONFIGURATION-COMPLETE.md 的"收入预测"部分 (确认 ROI)
3. STRIPE-DEPLOYMENT-CHECKLIST.md 的"上线拦截标准"表格 (Go/No-Go 决策)
4. STRIPE-DEPLOYMENT-CHECKLIST.md 的"签字页" (第 350+ 行)

**时间**: 30 分钟

### 情景 4: 我是 QA，需要测试支付
**阅读顺序**:
1. STRIPE-CONFIGURATION-COMPLETE.md 的"测试计划"章节 (5 个测试场景)
2. STRIPE-DEPLOYMENT-CHECKLIST.md 的"功能验收"表格 (10 个支付流程)
3. STRIPE-DEPLOYMENT-CHECKLIST.md 的"多端验证清单" (桌面/iOS/Android)

**时间**: 1-2 小时

---

## 📊 业务总结

### Phase 1 定价方案（Day 1 必上）

| 产品 | 规格 | USD | CNY | KRW | 类型 |
|------|------|-----|-----|-----|------|
| 完整命盤 | 六维+十年大运+流月 | $19.90 | ¥99.90 | ₩29,900 | 一次性 |
| 月度會員 | 无限查阅+自动续费 | $6.90/mo | ¥19.90/mo | ₩12,900/mo | 订阅 |
| 年度會員 | 全年+合婚报告+水晶 | $39.90/yr | ¥399.90/yr | ₩129,900/yr | 订阅 |
| 韓國사주 | 完全分析+大运 | $19.90 | N/A | ₩29,900 | 一次性 |

**期望 KPIs (Month 1)**:
- 注册用户: 500+
- 付费转化率: 5-8%
- MRR: $600-800
- 毛利率: 85%+

**期望 KPIs (Month 6)**:
- 订阅用户: 100+
- 续费率: 70%+
- MRR: $2,400+
- 年化收入: $30,000+

### 成本结构
- Stripe 手续费: 2.9-3.9% + $0.30/交易
- 服务器成本: $100-200/月
- AI API 成本: $50-100/月
- **净毛利**: 80%+

### 风险缓解
- Webhook 验签已实现 → 0 风险
- 订单落盘 → 防丢单
- 地理自动路由 → CN/US/KR 无混乱
- 自动续费 → 被动收入

---

## 🔑 关键文件位置

```
/Users/karen/projects/shenyuan/
├── docs/
│   ├── STRIPE-CONFIGURATION-COMPLETE.md      ← 主文档 (3.5k 行)
│   ├── STRIPE-PRICE-IDS-REFERENCE.json       ← Price ID 参考
│   ├── STRIPE-DEPLOYMENT-CHECKLIST.md        ← 执行清单 (可签字)
│   └── README-STRIPE-SETUP.md                ← 本文件 (导航)
├── server/
│   ├── routes/payment.js                     ← ✅ 已实现 (支付路由)
│   ├── lib/store.js                          ← ✅ 已实现 (产品定义)
│   └── .env.example                          ← ⚠️ 需更新 (API Keys)
└── pages/
    ├── pricing.html                          ← 定价页面 (待集成)
    └── [success].html                        ← 支付成功页 (已实现)
```

---

## ✅ 现有代码状态

### 后端: ✅ 已完整实现

**文件**: `/server/routes/payment.js`
- ✅ Stripe Checkout 创建 (第 112-194 行)
- ✅ Webhook 处理 (第 199-302 行)
- ✅ 微信支付集成 (第 409-494 行)
- ✅ 支付宝集成 (第 496-562 行)
- ✅ 支付成功页 (第 304-377 行)
- **现有 Price IDs**: 7 个 (KRW + Member)
- **缺少**: USD/CNY 的 5 个 Price IDs (需在 Stripe Dashboard 创建)

**文件**: `/server/lib/store.js`
- ✅ PRODUCTS 对象: 25+ 个产品已定义
- ✅ UNLOCK_BY_CATEGORY: 完整的解锁逻辑
- ✅ SUBSCRIBE_PRODUCTS: 6 个订阅类产品
- ✅ hasFullAccess(): 支付墙判断逻辑

### 前端: ⏳ 部分实现

**文件**: 各报告页面 (jyotish.html, maya.html, 等)
- ⏳ 支付按钮集成 (需要 initPayment() JS)
- ✅ 成功页回调已预留

---

## 🚀 Day 1 执行路线

```
08:00 - 获取 Stripe 生产 API Keys (30 min)
        │
09:00 - 创建 5 个 Price IDs (60 min)
        │
11:00 - 配置服务器环境变量 (30 min)
        │
12:00 - 部署代码 (60 min)
        │
13:00 - 功能测试 (60 min)
        │
14:00 - E2E 灰度测试 × 10 用户 (120 min)
        │
16:00 - 最后检查 + 授权 (60 min)
        │
17:00 ✅ 上线！
```

**详细步骤**: 见 STRIPE-CONFIGURATION-COMPLETE.md 第 140-200 行

---

## 🔐 安全检查清单

部署前必须验证:

- [ ] API Keys 不在前端代码中
- [ ] `.env` 文件在 `.gitignore`
- [ ] Webhook 有签名验证 (不接受无签名请求)
- [ ] 用户支付信息不存储本地 (全部由 Stripe 托管)
- [ ] HTTPS 已启用 (所有支付 URL)
- [ ] `/api/orders` 需要 admin token
- [ ] `/api/create-checkout` 有 rate limit

**详细检查清单**: 见 STRIPE-DEPLOYMENT-CHECKLIST.md 第 200+ 行

---

## 📈 成功指标

### Day 1 (上线)
- [ ] 支付成功率 >99%
- [ ] Webhook 成功率 100%
- [ ] API 响应 <2s (p95)
- [ ] 0 个支付问题

### Week 1
- [ ] 注册 500+ 用户
- [ ] 转化率 5-8%
- [ ] 留存率 >80% (Day 7)

### Month 1
- [ ] MRR $600-800
- [ ] 续费率 70%+
- [ ] 毛利率 85%+

---

## 🆘 常见问题

### Q: 如果支付失败怎么办？
**A**: 
1. 检查 API Keys 是否正确 (STRIPE_PAY_SECRET_KEY)
2. 检查 Webhook Secret 是否匹配 (STRIPE_WEBHOOK_SECRET)
3. 查看日志: `pm2 logs shenyuan | grep -i error`
4. 详见 STRIPE-CONFIGURATION-COMPLETE.md 的"常见问题"章节

### Q: 如何测试支付而不真正扣费？
**A**: 使用 Stripe 的测试卡号:
- 成功: `4242 4242 4242 4242`
- 失败: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 0003`

在 Stripe Dashboard 切换到 "Test mode" 即可使用

### Q: 订阅自动续费什么时候发生？
**A**: 在用户的订阅周期结束时。例如:
- 月度订阅: 每月 30 天后自动续费
- 年度订阅: 每年 365 天后自动续费
- Stripe 会在续费失败时重试 3 次，并发送邮件通知用户

### Q: 我如何区分 Stripe/微信/支付宝 的订单？
**A**: 查看 order 表的 `payment_method` 字段:
- `stripe` → Stripe Checkout
- `wechat` → 微信支付
- `alipay` → 支付宝
- `member_*` → 订阅类产品

### Q: 为什么中国用户看不到 Stripe Checkout？
**A**: 这是正常的。系统根据 IP 地址自动路由:
- 中国 IP → 微信/支付宝
- 其他 IP → Stripe

如需手动测试，修改 `region` 参数: `/api/create-checkout?region=us`

**更多 Q&A**: 见 STRIPE-CONFIGURATION-COMPLETE.md 第 500+ 行

---

## 📞 技术支持

### 内部联系
- **Engineering**: Claude Code (本文档作者)
- **Product**: Karen (CEO)
- **Finance**: CFO

### 外部资源
- **Stripe 文档**: https://stripe.com/docs
- **Stripe 支持**: https://support.stripe.com
- **Stripe CLI**: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

---

## 📋 文档版本

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v1.0 | 2026-08-08 | 初始版本，Phase 1 完整方案 |

---

## ✨ 提示

1. **打印清单**: 建议打印 STRIPE-DEPLOYMENT-CHECKLIST.md，贴在工位，部署时逐项勾选
2. **保存 Price IDs**: 完成后将所有 Price IDs 保存到 STRIPE-PRICE-IDS-REFERENCE.json 的实际值中
3. **监控告警**: 配置 Stripe webhook 失败告警，第一时间发现问题
4. **团队培训**: 部署完成后，与 QA/Support 团队同步支付流程

---

**最后**: 祝部署顺利! 如有任何问题，参考对应文件或联系 Engineering Lead。

