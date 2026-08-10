# 善缘 Phase 2 · 工程实现清单

**面向**: 后端/前端工程师  
**进度追踪**: Checkbox ☐ 初始状态  
**完成标准**: ✅ 全部打勾 + PR merged + 测试通过  

---

## 📋 总览 (10 个交付物)

| # | 交付物 | 优先级 | 工程量 | 完成期限 | 状态 |
|---|--------|--------|--------|---------|------|
| 1 | legal-*.html 补全 | P0 | 2h | Aug 22 | ⏳ |
| 2 | Stripe 三币种验证 | P0 | 3h | Aug 25 | ⏳ |
| 3 | Webhook 数据库 | P0 | 1h | Aug 20 | ⏳ |
| 4 | Stripe webhook 实现 | P0 | 4h | Aug 28 | ⏳ |
| 5 | Toss webhook 实现 | P1 | 3h | Sep 05 | ⏳ |
| 6 | Kakao webhook 实现 | P1 | 3h | Sep 10 | ⏳ |
| 7 | 每日对账 Job | P0 | 4h | Sep 08 | ⏳ |
| 8 | 幂等性测试 | P0 | 3h | Sep 12 | ⏳ |
| 9 | 前端多币种 UI | P1 | 6h | Sep 18 | ⏳ |
| 10 | 生产部署 + 烟雾测试 | P0 | 4h | Sep 25 | ⏳ |

**总工程量**: ~33h (4-5 天满时间工作)

---

## 🔴 Phase 2a：法律与验证 (Week 1-2)

### Task 1: 补全 legal-CN/EN/KR.html

**状态**: ⏳ 等待 Karen 提供公司信息

**清单**:

```markdown
### legal-CN.html (中文版)

- [ ] 从 Karen 接收真实公司信息
- [ ] 在 line 170-177 meta-block 填入:
  ├─ 香港商业登记号 (CR #)
  ├─ 法定代表人名字
  ├─ 财务负责人邮箱
  └─ PIPL 数据保护官邮箱
- [ ] 新增第四章：PIPA 合规声明 (line 362 前)
- [ ] 在隐私政策插入"PIPA 用户权利"段
- [ ] 通读检查无占位符残留
- [ ] 本地浏览器测试链接有效
- [ ] 提交 PR: feat/legal-cn-complete

### legal-en.html (英文版)

- [ ] 在 Privacy Policy 第 3.1 节加 GDPR 合规声明
- [ ] 第 5 节更新为四管辖区 (GDPR/CCPA/PIPL/PIPA)
- [ ] 在 Refund Policy 加 GDPR 退款延伸条款
- [ ] 本地化检查 (no 中文 fallback)
- [ ] 提交 PR: feat/legal-en-gdpr-ccpa

### legal-kr.html (韩文版)

- [ ] 术语检查："데이터 컨트롤러" 改 "개인정보 처리자"
- [ ] 加 PIPA § 31-36 조 (用户权利)
- [ ] 만세력 (万세力) 说明加强 (line 258)
- [ ] 신구 PIPA 버전 구분 (2024-03-16 개정)
- [ ] 提交 PR: feat/legal-kr-pipa

**验收标准**:
- ✓ 所有占位符替换为真实信息
- ✓ 3 个版本无内容矛盾
- ✓ 法律术语精确 (尤其 PIPL/PIPA/GDPR)
- ✓ 链接有效 (support@shenyuan.app 等)
- ✓ 手机 responsive 测试通过

---

### Task 2: Stripe 三币种验证

**状态**: ⏳ 需验证 API keys

**清单**:

```markdown
### 2.1 USD 支付验证 (已线上)

- [ ] 检查 Stripe 账户:
  ├─ Dashboard 登录 https://dashboard.stripe.com
  ├─ Settings → API Keys
  ├─ 确认 Live mode 密钥有效
  └─ 权限范围包含 'create_payment_intent'
- [ ] 测试支付流程:
  ├─ Test card: 4242 4242 4242 4242 (Stripe 标准测试卡)
  ├─ POST /checkout { product: 'bazi-report', currency: 'usd', amount: 0.01 }
  ├─ 获得 clientSecret
  ├─ 前端完成支付
  └─ Webhook 收到 payment_intent.succeeded
- [ ] 检查生产 webhook:
  ├─ Stripe Dashboard → Webhooks
  ├─ Endpoint: https://shenyuan.mylumee.cn/api/webhook
  └─ Events: payment_intent.succeeded, payment_intent.payment_failed
- [ ] 记录验证日期 & API key 轮换计划
- [ ] 文档: docs/Stripe-USD-Verification-Report.md

### 2.2 CNY 备选路由 (暂不启用)

- [ ] 编写 initStripeCNY() 函数:
  ├─ 文件: /server/api/stripe-cny.js
  ├─ 逻辑: currency === 'cny' → stripe.paymentIntents.create(currency='cny')
  ├─ Fallback: 如失败则 return { fallback: 'wechat' }
  └─ 不部署，仅代码 review
- [ ] PR: feat/stripe-cny-optional (非阻塞)

### 2.3 KRW 临时方案 (Phase 2b 启用)

- [ ] 编写 initStripeKRW() 函数:
  ├─ 文件: /server/api/stripe-krw.js
  ├─ 参数: { amount, currency: 'krw', customer_id }
  ├─ 注意: KRW 不除以 100 (stripe.js 文档: "No decimal")
  └─ 暂不部署，仅备用
- [ ] 注释: "仅在 Toss/Kakao 尚未就绪时启用"
- [ ] PR: feat/stripe-krw-fallback

**验收标准**:
- ✓ USD 真实支付成功率 100% (连测 5 次)
- ✓ Webhook 收到 + webhook_confirmed_at 记录
- ✓ CNY/KRW 代码编写完毕（可选部署）
- ✓ 所有路由 code review 通过

---

## 🟡 Phase 2b：支付回调系统 (Week 2-4)

### Task 3: Webhook 数据库设计

**状态**: ⏳ SQL 编写中

**清单**:

```markdown
### 3.1 数据库表创建

- [ ] 审查 SQL 设计 (docs/PRD-Phase2-Legal-Payment.md Part III.3)
- [ ] 创建 orders 表:
  ├─ CREATE TABLE orders (...)
  ├─ 字段检查清单:
  │  ├─ id (UUID)
  │  ├─ user_id, customer_email
  │  ├─ product_id, product_name
  │  ├─ amount, currency (CNY/USD/KRW)
  │  ├─ payment_provider (stripe/toss/kakao/wechat/alipay)
  │  ├─ payment_status (pending/processing/completed/failed)
  │  ├─ transaction_id, payment_intent_id
  │  ├─ webhook_received_at, webhook_confirmed_at
  │  ├─ reconciliation_status
  │  └─ metadata (JSON)
  ├─ INDEX on: user_id, payment_status, webhook_confirmed_at
  └─ 测试: SELECT * FROM orders LIMIT 1 (返回 0 rows ✓)

- [ ] 创建 webhook_events 表:
  ├─ CREATE TABLE webhook_events (...)
  ├─ 字段: id, provider, event_type, event_id, order_id
  ├─ raw_payload (LONGTEXT), processed_at
  ├─ signature_valid, idempotency_check_passed
  └─ UNIQUE KEY on (provider, event_id)

- [ ] 创建 settlement_reconciliation 表:
  ├─ CREATE TABLE settlement_reconciliation (...)
  ├─ 字段: id, reconciliation_date, payment_provider
  ├─ total_transactions, confirmed_count, mismatch_count
  ├─ status ('completed'/'with_warnings'/'with_errors')
  └─ UNIQUE KEY on (reconciliation_date, payment_provider)

### 3.2 数据库备份策略

- [ ] 在 Supabase / Aiven 配置 automated backups
  ├─ 频率: 每 6 小时
  ├─ 保留: 30 天
  └─ 位置: 与生产数据库不同 AZ
- [ ] 文档: Backup recovery procedures

**验收标准**:
- ✓ 3 个表创建成功
- ✓ 所有 INDEX 建立
- ✓ 无数据类型错误 (DECIMAL, TIMESTAMP, JSON)
- ✓ 备份策略配置完毕
```

---

### Task 4: Stripe Webhook 实现

**状态**: ⏳ 代码编写中

**清单**:

```markdown
### 4.1 Webhook 验证与处理

- [ ] 在 /server/routes/webhook.js 实现 handleStripeWebhook():
  ├─ 使用 stripe.webhooks.constructEvent() 验证签名
  ├─ 检查 req.headers['stripe-signature']
  ├─ 必须用 req.rawBody (不能用解析后的 JSON)
  ├─ 过滤事件类型: 仅处理 'payment_intent.succeeded'
  ├─ 提取: amount, currency, id, metadata
  └─ 错误处理: catch → logger.error() → return 200 OK
- [ ] 幂等性逻辑:
  ├─ INSERT INTO orders (...)
  ├─ ON DUPLICATE KEY UPDATE
  │  ├─ webhook_received_at = IFNULL(webhook_received_at, NOW())
  │  ├─ webhook_confirmed_at = NOW()
  │  ├─ payment_status = 'completed'
  │  └─ webhook_retry_count ++
  ├─ 使用 UNIQUE KEY on (payment_provider, transaction_id)
  └─ 测试: 同一 event_id 推送 3 次 → 仅插入 1 条记录
- [ ] Webhook 事件日志:
  ├─ INSERT INTO webhook_events (provider='stripe', event_id, raw_payload)
  ├─ 记录 signature_valid=TRUE, processed_at=NOW()
  └─ 用于 debugging & compliance
- [ ] 错误处理:
  ├─ signature 验证失败 → logger.warn → return 400 (Stripe 停止重试)
  ├─ order not found → 新建 order (幽灵单据修复)
  ├─ DB 写入失败 → logger.error → return 200 (让 Stripe 重试)
  └─ 所有异常都返回 200 给 Stripe (防止丢事件)

### 4.2 测试

- [ ] 单元测试:
  ├─ test/webhook-stripe.test.js
  ├─ Test 1: 正常支付成功 → order.payment_status='completed'
  ├─ Test 2: 重复 webhook → webhook_retry_count 增加，order 不变
  ├─ Test 3: 签名无效 → return 400
  ├─ Test 4: 数据库故障 → return 200 (幂等重试)
  └─ 覆盖率 >80%
- [ ] 集成测试 (staging):
  ├─ 使用 Stripe test mode + test API key
  ├─ 创建真实 payment_intent
  ├─ 验证 webhook 到达
  ├─ 检查 orders 表记录
  ├─ 检查 webhook_events 表日志
  └─ 对比时间戳

### 4.3 部署前检查

- [ ] Stripe webhook endpoint 在生产环境已注册:
  ├─ https://shenyuan.mylumee.cn/api/webhook (或子路径)
  ├─ Event types: payment_intent.succeeded, payment_intent.payment_failed
  ├─ Signing secret 已保存到 .env
  └─ 不要硬编码密钥！
- [ ] 日志聚合配置:
  ├─ 所有 webhook 日志写到 stdout (PM2 捕获)
  ├─ grep webhook_confirmed_at /var/log/shenyuan.log
  └─ 用于监控与对账
- [ ] 性能测试:
  ├─ webhook_confirmed_at - webhook_received_at < 2000ms
  ├─ 并发 webhook (100 req/s) 不应导致 duplicate orders
  └─ DB connection pool 配置 >= 10

**验收标准**:
- ✓ Stripe webhook 验证通过
- ✓ 幂等性测试: 3 次重复 → 仅 1 条 order
- ✓ 错误恢复: DB 故障 → webhook 重试成功
- ✓ <2s 处理延迟
- ✓ 单元测试覆盖率 >80%
```

---

### Task 5-6: Toss & Kakao Webhook 实现

**状态**: ⏳ Phase 2b (Sep 5-10)

**清单** (类似 Stripe，但针对 Toss/Kakao 特殊性):

```markdown
### 5.1 Toss Webhook (POST /webhook/toss/payment)

- [ ] Toss 无签名验证，仅 IP 白名单:
  ├─ 配置 nginx 仅允许 Toss 服务器 IP
  ├─ 获取 Toss IP 白名单: https://docs.toss.tech/reference/webhook
  └─ 测试: curl -X POST http://localhost:3020/webhook/toss (无代理) → 403
- [ ] 实现处理逻辑:
  ├─ 提取: orderId, totalAmount, approvedAt, method
  ├─ 金额验证: order.amount === totalAmount / 100
  ├─ 更新 orders SET payment_status='completed'
  └─ 记录到 webhook_events
- [ ] 注意: Toss 无事件 ID，用 orderId:approvedAt 作去重
- [ ] 测试用例:
  ├─ 正常成功 → order.payment_status='completed'
  ├─ 金额不匹配 → return 400 (不更新)
  ├─ 订单不存在 → return 404 (告警 + 日志)
  └─ 重复 webhook (orderId + approvedAt 相同) → 幂等

### 6.1 Kakao Webhook (POST /webhook/kakao/payment)

- [ ] Kakao 亦无签名验证，仅 IP 白名单:
  ├─ 获取 Kakao IP 白名单: https://developers.kakao.com/
  ├─ 配置 nginx 防护
  └─ 处理逻辑与 Toss 相同
- [ ] Kakao 特殊字段:
  ├─ tid (거래 ID)
  ├─ order_id (우리 주문 ID)
  ├─ approval_url (영수증 링크)
  └─ mapping 到 orders

**验收标准**:
- ✓ Toss/Kakao webhook 均幂等
- ✓ IP 白名单配置正确（staging + prod）
- ✓ 金额验证有效（防篡改）
- ✓ 测试覆盖率 >70%
```

---

### Task 7: 每日对账 Job

**状态**: ⏳ Scheduled job 编写

**清单**:

```markdown
### 7.1 对账 Job 实现

- [ ] 在 /server/jobs/reconcile-payments.js 实现 reconcilePaymentsDaily():
  ├─ 时间: 每天 02:30 UTC (中国时间 10:30)
  ├─ 使用 node-cron 或 node-schedule
  └─ 不依赖外部 cron 服务 (PM2 内置)
  
- [ ] Stripe 对账逻辑:
  ├─ 从 stripe.charges.list() 拉今日已结算交易
  ├─ 对比本地 orders 表 (payment_provider='stripe')
  ├─ 发现幽灵单据 (Stripe 有，本地无):
  │  ├─ logger.warn('[reconcile/ghost] unprocessed charge')
  │  ├─ INSERT INTO orders (自动修复)
  │  └─ reconciliation_status='mismatch'
  ├─ 发现孤立单据 (本地有，Stripe 无):
  │  ├─ logger.warn('[reconcile/orphan] local order not in stripe')
  │  ├─ 可能原因: 网络延迟、部分退款、假数据
  │  └─ 人工审查清单
  └─ 生成对账报告 → settlement_reconciliation 表

- [ ] Toss/Kakao 对账:
  ├─ 调用 Toss/Kakao API 拉当日交易
  ├─ 逻辑与 Stripe 相同
  └─ 记录到分别的对账表 (按 payment_provider 过滤)

### 7.2 告警与报告

- [ ] 对账失败告警:
  ├─ 如 job 抛异常 → sendAlert({ subject: '[ShenYuan] Reconciliation Failed' })
  ├─ Email 收件人: support@shenyuan.app, Karen@xxx
  └─ 内容: 错误日志 + 手动修复指南

- [ ] 每月对账报告:
  ├─ 统计 settlement_reconciliation 表
  ├─ 汇总: 幽灵单据数、孤立单据数、总转化率
  ├─ 模板: docs/Reconciliation-Monthly-Report.md
  └─ 发送给 Karen + CFO

### 7.3 监控

- [ ] PM2 日志监控:
  ├─ pm2 logs shenyuan | grep reconcile
  ├─ 每个 reconciliation job 打印:
  │  ├─ [reconcile] starting daily reconciliation
  │  ├─ [reconcile/stripe] fetched 42 transactions
  │  ├─ [reconcile/ghost] 2 unprocessed charges detected
  │  └─ [reconcile] completed
  └─ 用于 debug & 审计

**验收标准**:
- ✓ Cron job 每日准时执行 (测试 3 天)
- ✓ 幽灵单据自动插入正确
- ✓ 对账报告准确性 (人工验证 1 次)
- ✓ 告警机制有效 (测试异常告警)
```

---

## 🟢 Phase 2c：用户体验 & 部署 (Week 4-5)

### Task 8: 幂等性测试

**状态**: ⏳ 测试场景设计

**清单**:

```markdown
### 8.1 幂等性测试计划

**场景 1: 重复 Webhook**
- [ ] 发送相同 payment_intent.succeeded 事件 3 次
  ├─ Event ID 相同
  ├─ Timestamp 间隔 5s
  └─ 预期: orders 表仍只有 1 条记录
- [ ] 验证:
  ├─ SELECT COUNT(*) FROM orders WHERE transaction_id=? → 1
  ├─ webhook_retry_count = 3
  ├─ webhook_confirmed_at 是第一次的时间 (IFNULL 生效)
  └─ 无重复扣款日志

**场景 2: 并发 Webhook**
- [ ] 同时发送 10 个相同 event (并发)
  ├─ 使用 wrk 或 ab 压测
  ├─ wrk -t4 -c10 -d10s http://localhost:3020/webhook/stripe (POST)
  └─ 预期: orders 仍为 1 条（DB 锁保护）
- [ ] 验证: webhook_events 表 10 条记录，orders 表 1 条

**场景 3: Webhook 顺序错乱**
- [ ] 支付 A 的 webhook 先到，后到的是支付 B
  ├─ Event A: orderId=123, status=completed
  ├─ Event B: orderId=456, status=failed
  ├─ 顺序: B arrive 1st, A arrive 2nd
  └─ 预期: 两条订单分别记录，无串联
- [ ] 验证: orders.id 分别对应正确的 payment_intent_id

**场景 4: Webhook 延迟 >1h**
- [ ] 模拟 Stripe 重试延迟场景:
  ├─ 当前时间: 14:00
  ├─ Webhook 推送: 今天 14:05
  ├─ 模拟推送时间: 用 Stripe Event 中的 created timestamp
  └─ 预期: webhook_confirmed_at = 现在时间 (不是事件时间)
- [ ] 验证: 不会因为时间差导致对账失败

### 8.2 负面测试

- [ ] 错误的签名:
  ├─ 修改 webhook 请求体
  ├─ 保持签名不变
  └─ 预期: return 400 (reject)
- [ ] 大金额支付:
  ├─ amount = 9999.99 USD (异常值)
  ├─ 预期: 成功记录，无 amount overflow
  └─ 验证: DECIMAL(12,2) 无损精度
- [ ] 特殊字符/Unicode:
  ├─ metadata.customer_name = "李四李四李四" (CJK)
  ├─ 预期: 无编码错误

**验收标准**:
- ✓ 幂等性测试 100% 通过
- ✓ 并发测试无 duplicate orders
- ✓ 负面测试异常正确处理
- ✓ 所有测试记录在案 (test report)
```

---

### Task 9: 前端多币种 UI

**状态**: ⏳ UI 设计 & 编码

**清单**:

```markdown
### 9.1 支付选择界面

- [ ] 修改 /pages/bazi-en.html (或新建 checkout.html):
  ├─ 添加币种选择器:
  │  ├─ 单选按钮: USD / CNY / KRW
  │  ├─ 基于 IP 地理位置预选
  │  │  ├─ KR → KRW (default)
  │  │  ├─ CN → CNY (default)
  │  │  └─ Other → USD (default)
  │  └─ 用户可手动切换
  ├─ 实时价格显示:
  │  ├─ 基础报告:
  │  │  ├─ USD: $4.99
  │  │  ├─ CNY: ¥29.9
  │  │  └─ KRW: ₩6,500
  │  └─ 深度报告:
  │     ├─ USD: $4.99
  │     ├─ CNY: ¥29.9
  │     └─ KRW: ₩6,500
  └─ 货币符号正确 ($ ¥ ₩)

### 9.2 支付方式显示

- [ ] 基于币种动态显示支付方式:
  ├─ USD 只显示: Stripe (Card)
  ├─ CNY 显示: WeChat / Alipay / Stripe (Card, 备选)
  └─ KRW 显示: Toss / Kakao / Naver (Phase 2b 启用)
- [ ] 优雅降级:
  ├─ 如果 Toss 尚未就绪，显示: "Toss coming soon"
  └─ 仅显示已上线支付方式

### 9.3 收据与价格显示

- [ ] 支付后收据:
  ├─ 产品名: "深度命理报告 / Deep BaZi Report / 심층 사주 리포트"
  ├─ 金额: "USD $4.99 / CNY ¥29.9 / KRW ₩6,500"
  ├─ 交易 ID: payment_intent_id (Stripe) 或 orderId (Toss)
  └─ 交易时间: UTC timestamp
- [ ] 发票邮件:
  ├─ 从 orders.customer_email 获取
  ├─ 包含多币种金额
  └─ 3 种语言版本 (使用 i18n)

### 9.4 Error Handling

- [ ] 支付失败提示:
  ├─ 如果 payment_intent.status = 'requires_payment_method'
  ├─ 显示: "Payment failed. Please try again or contact support"
  └─ 多语言翻译
- [ ] 网络错误:
  ├─ POST /checkout 超时 > 10s
  ├─ 重试逻辑 (最多 3 次)
  └─ 显示: "Network error. Please check your connection"

### 9.5 无障碍 & 性能

- [ ] 无障碍 (A11y):
  ├─ label 关联 input
  ├─ ARIA 属性完整
  └─ 键盘导航支持
- [ ] 性能:
  ├─ 首屏加载 < 2s
  ├─ 支付按钮响应 < 100ms
  └─ Stripe.js 异步加载

**验收标准**:
- ✓ 币种选择器正确工作
- ✓ 价格实时同步 (3 币种)
- ✓ 支付方式动态显示
- ✓ 多语言文本正确
- ✓ 移动端 responsive
- ✓ 收据包含正确的货币信息
```

---

### Task 10: 生产部署 & 烟雾测试

**状态**: ⏳ Week 5 (Sep 25)

**清单**:

```markdown
### 10.1 生产部署

- [ ] 代码审查:
  ├─ 所有 PR merged 到 main
  ├─ CI/CD 管道绿灯 (tests pass)
  ├─ Code review 至少 2 人签字
  └─ 无 security warnings
- [ ] 部署步骤:
  ├─ 数据库迁移 (orders, webhook_events, settlement_reconciliation 表)
  ├─ 环境变量检查:
  │  ├─ STRIPE_LIVE_KEY (不是 test key!)
  │  ├─ STRIPE_WEBHOOK_SECRET
  │  ├─ TOSS_CLIENT_KEY, TOSS_SECRET_KEY (如启用)
  │  ├─ LOG_LEVEL=info (webhook 日志)
  │  └─ NODE_ENV=production
  ├─ 重启服务:
  │  ├─ pm2 restart shenyuan
  │  ├─ pm2 status shenyuan → online
  │  └─ pm2 logs shenyuan → 无错误
  └─ Nginx 配置检查:
     ├─ /api/webhook 路由配置正确
     ├─ client_max_body_size 足够 (Stripe webhook ~5KB)
     └─ SSL 证书有效

### 10.2 烟雾测试 (Smoke Test)

**测试场景 (按优先级)**:

1. ✅ **USD 支付全流程** (最重要)
   - [ ] 访问 https://shenyuan.mylumee.cn/pages/bazi-en.html
   - [ ] 选币种: USD
   - [ ] 选产品: 深度报告 ($4.99)
   - [ ] 支付方式: Stripe Card
   - [ ] 使用测试卡: 4242 4242 4242 4242 (Stripe 特定测试卡)
   - [ ] 完成支付
   - [ ] 检查:
     ├─ orders 表新增 1 条记录
     ├─ payment_status = 'completed'
     ├─ webhook_confirmed_at 非 NULL
     ├─ 用户收到确认邮件
     └─ 可访问报告内容 ✓

2. ⏳ **CNY 支付** (如启用 Stripe CNY)
   - [ ] 选币种: CNY
   - [ ] 支付方式: WeChat 或 Alipay
   - [ ] 完成支付
   - [ ] 检查: payment_status, webhook_confirmed_at

3. ⏳ **KRW 支付** (Phase 2b, Sep 30)
   - [ ] 选币种: KRW
   - [ ] 支付方式: Toss 或 Kakao
   - [ ] 完成支付
   - [ ] 检查: orders 记录正确

### 10.3 对账 Job 验证

- [ ] 触发每日对账 Job (手动):
  ├─ node -e "require('./server/jobs/reconcile-payments').reconcilePaymentsDaily()"
  ├─ 或在 cron 设定时间到达时观察日志
  └─ 预期: settlement_reconciliation 表新增 1 条记录
- [ ] 检查日志:
  ├─ pm2 logs shenyuan | grep reconcile
  ├─ [reconcile] starting daily reconciliation
  ├─ [reconcile/stripe] fetched N transactions
  ├─ [reconcile] completed ✓
  └─ 无错误日志

### 10.4 告警机制验证

- [ ] 模拟支付 webhook 处理失败:
  ├─ 临时关闭数据库连接
  ├─ 尝试支付 → webhook 处理失败
  ├─ 预期: 收到告警邮件 (如配置)
  └─ 恢复数据库 → webhook 重试成功
- [ ] 检查日志是否记录异常:
  ├─ grep ERROR /var/log/shenyuan.log
  └─ 无 critical errors

### 10.5 监控与指标

- [ ] Dashboard 配置:
  ├─ 监控 webhook 延迟: webhook_confirmed_at - webhook_received_at
  ├─ 支付成功率: successful_orders / total_orders
  ├─ 每日对账状态: settlement_reconciliation.status
  └─ 用时: <2s, 成功率: >98%, 对账完整率: 100%
- [ ] 告警规则:
  ├─ webhook_confirmed_at > 5s → warn
  ├─ payment success rate < 95% → alert
  ├─ reconciliation failed → critical
  └─ 收件人: engineering@xxx, Karen@xxx

**验收标准**:
- ✓ USD 完整支付链路正常
- ✓ Webhook 处理 <2s
- ✓ 每日对账准时执行
- ✓ 无重复计费日志
- ✓ 监控告警配置完毕
- ✓ 生产环境无异常日志
```

---

## 📊 进度追踪表

**周报格式** (每周五更新):

```markdown
## Week X (Aug 10-16) Progress

### Completed ✓
- [x] Task 1: legal-*.html 补全 (2/2)
  └─ PR #123 merged
- [x] Task 2: Stripe 验证 (3/3)
  └─ USD 支付成功率 100%

### In Progress 🔄
- [ ] Task 3: Webhook 数据库 (1/3)
  ├─ orders 表创建 ✓
  ├─ webhook_events 表创建 ⏳
  └─ settlement_reconciliation 表创建 ⏳

### Blocked 🚫
- [ ] Task 4: Stripe webhook 实现
  └─ Waiting: Karen 确认生产 API key

### Next Week
- Priority: 完成 Task 3 + 启动 Task 4
- Risks: 无
- Blockers: 需要生产环境 Stripe API key
```

---

## 🔔 Important Notes

### 必读事项

1. **API Keys 管理**:
   - ❌ 不要在代码中硬编码 API key
   - ✓ 使用环境变量 (.env)
   - ✓ 生产/预发分别配置
   - ✓ 定期轮换 (quarterly)

2. **Webhook 安全**:
   - ✓ Stripe: 必须验证签名 (HMAC-SHA256)
   - ✓ Toss/Kakao: 配置 IP 白名单 (nginx)
   - ✓ 所有 webhook 必须返回 200 (即使失败也要)
   - ❌ 不要在 webhook 内做长时间操作 (>5s)

3. **数据库**:
   - ✓ 备份: 每 6h 自动
   - ✓ 索引: 检查 slow query log
   - ✓ 容量: 每笔交易 ~500 bytes

4. **合规**:
   - ✓ Webhook 日志保留 90 天 (审计)
   - ✓ 订单记录保留 7 年 (税务)
   - ✓ PCI compliance: 不存储完整卡号

---

## 📞 联系与 Escalation

- **技术问题**: `#engineering` Slack channel
- **紧急问题**: Page 工程负责人
- **法律问题**: Karen + 外部法务
- **部署问题**: DevOps + 工程负责人

---

**版本**: 1.0  
**上次更新**: 2026-08-10  
**下次检查**: 周一 (Aug 13) standup
