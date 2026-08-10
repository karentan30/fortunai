# 善缘 Phase 2 工程执行清单 (修订版 v1.1)

**版本**: 1.1 (三维度评审修订)  
**总工程量**: 42h (vs 原 33h, +27% 用于部署检查 & UX 改进)  
**工程师数**: 2 人 (1 后端 + 1 前端)  
**目标完成**: 2026-09-30  

---

## 📊 工作量分布

```
后端 (27h):
  ├─ Stripe 验证 & CNY/KRW 编码 (6h)
  ├─ Webhook 逻辑 + 事务隔离 (8h) ← +2h (事务隔离新增)
  ├─ Toss/Kakao handler + API polling (6h) ← +2h (API polling 新增)
  ├─ 每日对账 Job (4h)
  └─ 生产部署检查 & 性能测试 (3h) ← 新增

前端 (15h):
  ├─ 多币种支付 UI (5h)
  ├─ 支付重试进度条 & 状态流程图 (4h) ← 新增
  ├─ 汇率实时显示 (3h) ← 新增
  └─ 法律页面 Accordion + 地区动态 (3h) ← 新增

合计: 42h
```

---

## 🔧 Task 1: Stripe 三币种验证 & 编码

**负责人**: 后端  
**工程量**: 6h  
**截止**: 2026-08-20  

### 子任务

#### 1.1 USD 支付验证 (已上线，确认)
```bash
# 测试脚本
curl -X POST https://shenyuan.mylumee.cn/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi-report",
    "amount": 0.01,
    "currency": "usd",
    "customer": { "email": "test@example.com" }
  }'

# 验收标准:
# ✓ clientSecret 返回
# ✓ Stripe Dashboard 中可查询到 payment_intent
# ✓ Webhook 收到 payment_intent.succeeded
# ✓ 数据库 orders 表创建订单记录
```

**交付**: webhook 成功日志截图

---

#### 1.2 CNY (WeChat/Alipay) 维持 & Stripe CNY 备选
```javascript
// /server/api/checkout.js
if (currency === 'cny') {
  if (paymentMethod === 'wechat') {
    return initWeChatPayment(params);      // 现有
  } else if (paymentMethod === 'alipay') {
    return initAlipayment(params);          // 现有
  } else if (paymentMethod === 'stripe_cny') {
    return initStripeCNY(params);           // 新增 (备选)
  }
}

async function initStripeCNY(params) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(params.amount * 100),
    currency: 'cny',
    payment_method_types: ['card']
  });
  return { clientSecret: paymentIntent.client_secret };
}
```

**验收标准**:
- ✓ CNY 货币代码映射正确
- ✓ 金额单位转换无误 (¥ 对应 * 100)
- ✓ 支付方法选择逻辑清晰 (WeChat > Alipay > Stripe)

**交付**: 代码 PR + 测试日志

---

#### 1.3 KRW (Stripe 临时方案)
```javascript
// /server/api/checkout.js - KRW 分支
if (currency === 'krw') {
  // 临时: 仅用 Stripe (成本高，覆盖率 <2%)
  return initStripeKRW(params);
  
  // 长期: Toss/Kakao (Task 3 实现)
}

async function initStripeKRW(params) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amount,  // KRW 无需 /100
    currency: 'krw',
    payment_method_types: ['card']  // 仅国际卡
  });
  return { clientSecret: paymentIntent.client_secret };
}
```

**验收标准**:
- ✓ KRW 金额无需 /100 (vs USD/CNY)
- ✓ 仅支持国际卡，无本地支付 (正确表示临时)
- ✓ 前端显示 "₩6,500" (货币符号)

**交付**: 代码 + 测试日志

---

#### 1.4 API Keys 有效性验证
```bash
# 验收检查清单
- [ ] Stripe Live mode keys 有效期 > 30 days
- [ ] API Key 权限范围: create_payment_intent, read_payment_intent (最小权限)
- [ ] Webhook 端点已注册: https://shenyuan.mylumee.cn/api/webhooks/stripe
- [ ] 测试密钥 (pk_test_xxx) 能成功创建 payment_intent
- [ ] 生产密钥 (pk_live_xxx) 能成功创建 payment_intent
```

**交付**: 密钥检查截图 + 权限清单

---

## 🔧 Task 2: Webhook 核心逻辑 + 事务隔离

**负责人**: 后端  
**工程量**: 8h (vs 原 6h, +2h 事务隔离新增)  
**截止**: 2026-08-25  

### 子任务

#### 2.1 Stripe Webhook Handler (修订版，含事务隔离)

```javascript
// /server/routes/webhook.js
const crypto = require('crypto');
const { db, logger } = require('../utils');

// ⚠️ Express middleware 顺序 (CRITICAL)
// app.use(express.raw({ type: 'application/json', limit: '10mb' }));  // ← raw 必须在 json() 之前
// app.use(express.json());

async function handleStripeWebhook(req, res) {
  let db_conn = null;
  try {
    // 1. 验证签名（必须用 raw buffer）
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      logger.warn('[stripe/webhook] missing signature header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (signErr) {
      logger.error('[stripe/webhook] signature verification failed', signErr);
      return res.status(401).json({ error: 'Signature mismatch' });
    }

    // 2. 开启事务 (REPEATABLE_READ 隔离)
    db_conn = await db.getConnection();
    await db_conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await db_conn.beginTransaction();

    const paymentIntent = event.data.object;

    // 3. 幂等性插入 (IFNULL 防首次时间戳被覆盖)
    const [result] = await db_conn.query(`
      INSERT INTO orders (
        id, payment_intent_id, amount, currency,
        payment_provider, payment_status,
        webhook_received_at, webhook_confirmed_at, webhook_retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        webhook_received_at = IFNULL(webhook_received_at, NOW()),
        webhook_confirmed_at = CASE 
          WHEN webhook_confirmed_at IS NULL THEN NOW()
          ELSE webhook_confirmed_at
        END,
        payment_status = 'completed',
        webhook_retry_count = webhook_retry_count + 1
    `, [
      generateUUID(),
      paymentIntent.id,
      paymentIntent.amount / 100,
      paymentIntent.currency,
      'stripe',
      'completed',
      new Date(),
      new Date(),
      0
    ]);

    // 4. 记录事件
    await db_conn.query(`
      INSERT INTO webhook_events (id, provider, event_type, event_id, processed_at)
      VALUES (?, ?, ?, ?, ?)
    `, [generateUUID(), 'stripe', 'payment.success', event.id, new Date()]);

    // 5. 提交事务
    await db_conn.commit();

    logger.info('[stripe/webhook] success', { eventId: event.id });
    return res.status(200).json({ received: true });

  } catch (err) {
    if (db_conn) {
      try {
        await db_conn.rollback();
      } catch (rollbackErr) {
        logger.error('[stripe/webhook] rollback failed', rollbackErr);
      }
    }

    logger.error('[stripe/webhook] error', err);
    return res.status(200).json({ received: true });  // 总是 200

  } finally {
    if (db_conn) {
      await db_conn.release();
    }
  }
}

module.exports = { handleStripeWebhook };
```

**验收标准**:
- ✓ 100 并发 webhook，webhook_retry_count 精确
- ✓ 首次时间戳不被后续 webhook 覆盖
- ✓ 事务完全回滚 (DB 故障时)
- ✓ 无签名验证失败错误日志

**交付**: 单元测试 (并发测试) + 日志验证

---

#### 2.2 数据库设计 + 建表脚本

```sql
-- /database/migrations/003-payment-webhook.sql
CREATE TABLE orders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  customer_email VARCHAR(255),
  product_id VARCHAR(100),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  payment_provider VARCHAR(50),
  payment_status VARCHAR(50),
  transaction_id VARCHAR(255),
  payment_intent_id VARCHAR(255),
  
  webhook_received_at TIMESTAMP NULL,
  webhook_confirmed_at TIMESTAMP NULL,
  webhook_retry_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_transaction_id (payment_provider, transaction_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_webhook_confirmed (webhook_confirmed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE webhook_events (
  id VARCHAR(36) PRIMARY KEY,
  provider VARCHAR(50),
  event_type VARCHAR(100),
  event_id VARCHAR(255),
  order_id VARCHAR(36),
  transaction_id VARCHAR(255),
  raw_payload LONGTEXT,
  signature_valid BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_event_id (provider, event_id),
  INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE settlement_reconciliation (
  id VARCHAR(36) PRIMARY KEY,
  reconciliation_date DATE,
  payment_provider VARCHAR(50),
  total_transactions INT,
  confirmed_count INT,
  mismatch_count INT,
  status VARCHAR(50),
  report_summary JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_date_provider (reconciliation_date, payment_provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**验收标准**:
- ✓ 建表脚本可在生产环境成功执行
- ✓ 所有索引已建立
- ✓ 外键约束无冲突

**交付**: 建表脚本 + 表结构文档

---

#### 2.3 中间件顺序配置验证

```javascript
// /server/index.js (正确的顺序)
const express = require('express');
const app = express();

// ⚠️ CRITICAL: raw 必须在 json 之前
app.use(express.raw({ type: 'application/json', limit: '10mb' }));
app.use(express.json());

// 路由
app.post('/api/webhooks/stripe', handleStripeWebhook);
app.post('/api/webhooks/toss', handleTossWebhook);

// ... 其他路由
```

**验收标准**:
- ✓ Stripe 签名验证成功率 100%
- ✓ 无 "req.rawBody is undefined" 错误

**交付**: 代码审查截图

---

## 🔧 Task 3: Toss/Kakao Handler + API Polling

**负责人**: 后端  
**工程量**: 6h (vs 原 4h, +2h API polling 新增)  
**截止**: 2026-09-05  

### 子任务

#### 3.1 Toss Webhook Handler (含 IP 白名单 + API polling 备选)

```javascript
// /server/routes/webhook-toss.js
async function handleTossWebhook(req, res) {
  let db_conn = null;
  try {
    const { orderId, totalAmount, method, paymentKey } = req.body;

    // 1. IP 白名单检查
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    const validIps = (process.env.TOSS_WEBHOOK_IPS || '').split(',');

    if (validIps.length > 0 && !validIps.includes(clientIp)) {
      logger.warn('[toss/webhook] IP verification failed', { clientIp });
      // 不返回 403，而是插入待验证状态，后续用 API polling 确认
      await db.query(`
        INSERT INTO webhook_events (id, provider, event_type, error_message)
        VALUES (?, ?, ?, ?)
      `, [generateUUID(), 'toss', 'payment.verify_pending', 'IP verification failed']);

      return res.status(200).json({ received: true });
    }

    // 2. 无条件插入订单
    db_conn = await db.getConnection();
    await db_conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await db_conn.beginTransaction();

    const [result] = await db_conn.query(`
      INSERT INTO orders (
        id, transaction_id, amount, currency,
        payment_provider, payment_status,
        webhook_received_at, webhook_confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        webhook_received_at = IFNULL(webhook_received_at, NOW()),
        webhook_confirmed_at = CASE WHEN webhook_confirmed_at IS NULL THEN NOW() ELSE webhook_confirmed_at END,
        payment_status = 'completed',
        webhook_retry_count = webhook_retry_count + 1
    `, [
      generateUUID(),
      orderId,
      Math.round(totalAmount / 100),
      'krw',
      'toss',
      'processing',
      new Date(),
      null
    ]);

    // 3. 提交事务
    await db_conn.commit();

    logger.info('[toss/webhook] order inserted', { orderId });
    return res.status(200).json({ received: true });

  } catch (err) {
    if (db_conn) {
      try {
        await db_conn.rollback();
      } catch (rollbackErr) {
        logger.error('[toss/webhook] rollback failed', rollbackErr);
      }
    }

    logger.error('[toss/webhook] error', err);
    return res.status(200).json({ received: true });

  } finally {
    if (db_conn) {
      await db_conn.release();
    }
  }
}
```

**验收标准**:
- ✓ IP 白名单配置正确
- ✓ webhook 落地数据库正确

**交付**: 代码 + 测试日志

---

#### 3.2 Toss API Polling 备选方案

```javascript
// /server/jobs/verify-toss-payments.js
const cron = require('node-cron');
const { db, logger } = require('../utils');

// 每 6 小时检查一次待验证订单
cron.schedule('0 */6 * * *', async () => {
  try {
    // 查询 'processing' 状态的 Toss 订单
    const [pendingOrders] = await db.query(`
      SELECT id, transaction_id FROM orders
      WHERE payment_provider = 'toss' AND payment_status = 'processing'
      AND DATE(created_at) >= CURDATE() - INTERVAL 7 DAY
    `);

    for (const order of pendingOrders) {
      const paymentInfo = await verifyTossPaymentViaAPI(order.transaction_id);
      
      if (paymentInfo.status === 'DONE') {
        // API 确认成功，标记为 completed
        await db.query(
          'UPDATE orders SET payment_status = ?, webhook_confirmed_at = NOW() WHERE id = ?',
          ['completed', order.id]
        );
        logger.info('[toss/api-verify] payment confirmed', { orderId: order.id });
      } else if (paymentInfo.status === 'FAILED') {
        await db.query(
          'UPDATE orders SET payment_status = ? WHERE id = ?',
          ['failed', order.id]
        );
      }
      // 其他状态保持 processing，继续轮询
    }

    logger.info('[toss/api-verify] batch check completed', { checked: pendingOrders.length });

  } catch (err) {
    logger.error('[toss/api-verify] job failed', err);
  }
});

async function verifyTossPaymentViaAPI(orderId) {
  try {
    // Toss Payments API v1: GET /v1/payments/{orderId}
    const response = await fetch(
      `https://api.tosspayments.com/v1/payments/${orderId}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(
            process.env.TOSS_CLIENT_KEY + ':'
          ).toString('base64')}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Toss API error: ${response.status}`);
    }

    const payment = await response.json();
    return {
      status: payment.status,  // 'READY', 'DONE', 'FAILED', etc.
      totalAmount: payment.totalAmount
    };

  } catch (err) {
    logger.error('[toss/api-verify] error', err);
    return { status: 'ERROR' };
  }
}

module.exports = { verifyTossPaymentsJob };
```

**验收标准**:
- ✓ Toss API 调用成功率 >95%
- ✓ 待验证订单 24h 内确认成功率 >90%

**交付**: 代码 + Job 执行日志

---

#### 3.3 Kakao Pay Handler (类似 Toss)

```javascript
// /server/routes/webhook-kakao.js
async function handleKakaoWebhook(req, res) {
  // 类似 Toss 的逻辑，IP 白名单 + 无条件插入 + 事务隔离
  // 代码与 Toss 90% 相同，仅改参数
}
```

**交付**: 代码

---

## 🔧 Task 4: 每日对账 Job

**负责人**: 后端  
**工程量**: 4h  
**截止**: 2026-09-10  

### 子任务

#### 4.1 Stripe 对账 Job

```javascript
// /server/jobs/reconcile-stripe.js
const cron = require('node-cron');
const { db, logger, stripe } = require('../utils');

// 每天 02:30 UTC 执行 (中国时间 10:30)
cron.schedule('30 2 * * *', reconcileStripeDaily, {
  timezone: 'UTC'
});

async function reconcileStripeDaily() {
  logger.info('[reconcile/stripe] starting daily reconciliation');

  const today = new Date().toISOString().split('T')[0];
  const startOfDay = Math.floor(new Date(today + 'T00:00:00Z') / 1000);
  const endOfDay = Math.floor(new Date(today + 'T23:59:59Z') / 1000);

  try {
    // 1. 拉取当日 Stripe 交易
    const stripeCharges = await stripe.charges.list({
      created: { gte: startOfDay, lte: endOfDay },
      limit: 100
    });

    // 2. 查询本地订单
    const [localOrders] = await db.query(`
      SELECT transaction_id, amount FROM orders
      WHERE DATE(created_at) = ? AND payment_provider = 'stripe'
    `, [today]);

    // 3. 对比：发现幽灵单据
    const localTxIds = new Set(localOrders.map(o => o.transaction_id));
    let ghostCount = 0;

    for (const charge of stripeCharges.data) {
      if (!localTxIds.has(charge.payment_intent)) {
        ghostCount++;
        logger.warn('[reconcile/ghost] unprocessed charge', {
          paymentIntentId: charge.payment_intent,
          amount: charge.amount / 100
        });

        // 插入补救
        await db.query(`
          INSERT INTO orders (
            id, payment_provider, transaction_id, amount,
            payment_status, webhook_confirmed_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          generateUUID(),
          'stripe',
          charge.payment_intent,
          charge.amount / 100,
          'completed',
          new Date()
        ]);
      }
    }

    // 4. 生成报告
    await db.query(`
      INSERT INTO settlement_reconciliation (
        id, reconciliation_date, payment_provider,
        total_transactions, confirmed_count, mismatch_count,
        status, report_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateUUID(),
      today,
      'stripe',
      stripeCharges.data.length,
      localOrders.length - ghostCount,
      ghostCount,
      ghostCount > 0 ? 'with_warnings' : 'completed',
      JSON.stringify({
        stripe_charges: stripeCharges.data.length,
        local_orders: localOrders.length,
        ghosts: ghostCount
      })
    ]);

    logger.info('[reconcile/stripe] completed', {
      charges: stripeCharges.data.length,
      ghosts: ghostCount
    });

  } catch (err) {
    logger.error('[reconcile/stripe] error', err);
    await sendAlert('Stripe Reconciliation Failed', err.message);
  }
}

module.exports = { reconcileStripeDaily };
```

**验收标准**:
- ✓ Job 每日 UTC 02:30 执行
- ✓ 发现幽灵单据并自动插入
- ✓ 生成对账报告存入 DB

**交付**: Job 执行日志 + 报告记录

---

## 🔧 Task 5: 生产部署检查 & 性能测试

**负责人**: 后端 + 运维  
**工程量**: 3h  
**截止**: 2026-09-23 (上线前 72h)  

### 子任务

#### 5.1 Webhook 端点 HTTPS 验证

```bash
#!/bin/bash
# /scripts/pre-launch-check.sh

echo "=== Webhook 域名 HTTPS 检查 ==="
curl -I https://shenyuan.mylumee.cn/api/webhooks/stripe
# 预期: HTTP/2 200

echo "=== SSL 证书有效期检查 ==="
openssl s_client -connect shenyuan.mylumee.cn:443 -showcerts < /dev/null | grep -A5 "validity"
# 预期: notAfter 日期 >= 30 天后

echo "=== Express Middleware 验证 ==="
grep -A3 "express.raw" /server/index.js
# 预期: raw 在 json 之前
```

**交付**: 脚本 + 检查结果

---

#### 5.2 数据库连接池配置验证

```javascript
// /server/config/database.js
const pool = mysql.createPool({
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// 验收: 可支持 100 并发 webhook
```

**交付**: 配置文件

---

#### 5.3 性能测试 (Apache Bench)

```bash
#!/bin/bash
# /scripts/load-test.sh

ENDPOINT="https://shenyuan.mylumee.cn/api/webhooks/stripe"
SIGNATURE="t=1691608000,v1=xxx"  # 有效 Stripe 签名

# 100 并发，1000 请求
ab -n 1000 -c 100 \
  -H "stripe-signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -p webhook-payload.json \
  "$ENDPOINT"

# 预期结果:
# Requests per second: > 100/s
# Time per request: < 20ms (mean)
# Failed requests: 0
```

**交付**: 性能测试报告 (p50/p90/p99 延迟 <2s)

---

#### 5.4 数据库故障演练

```sql
-- 模拟 DB 故障
FLUSH TABLES WITH READ LOCK;

-- 观察应用日志:
# [stripe/webhook] error: Lock wait timeout exceeded
# webhook 应返回 503 (或 200 已幂等处理)

UNLOCK TABLES;

-- 恢复后验证:
SELECT COUNT(*) FROM orders WHERE webhook_confirmed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
-- 预期: 订单被自动补救
```

**交付**: 故障演练日志 + 恢复验证

---

## 👨‍💻 Task 6: 支付重试进度条 & 状态流程图

**负责人**: 前端  
**工程量**: 4h  
**截止**: 2026-09-15  

### 子任务

#### 6.1 支付重试进度条

```html
<!-- /client/components/payment-retry.html -->
<div class="payment-retry-progress">
  <p id="retry-message">重试中 (1/3)...</p>
  <progress id="retry-bar" value="1" max="3"></progress>
  
  <div id="fallback-options" style="display:none;">
    <p>支付暂时失败，请尝试：</p>
    <button onclick="switchPaymentMethod('wechat')">用微信支付</button>
    <button onclick="switchPaymentMethod('alipay')">用支付宝</button>
    <button onclick="contactSupport()">联系客服</button>
  </div>
</div>

<script>
async function attemptPayment(maxRetries = 3) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      document.getElementById('retry-message').textContent = `重试中 (${i}/${maxRetries})...`;
      document.getElementById('retry-bar').value = i;
      
      const result = await processPayment();
      if (result.success) return result;
    } catch (err) {
      if (i === maxRetries) {
        // 显示降级选项
        document.getElementById('fallback-options').style.display = 'block';
        throw err;
      }
      // 指数退避重试
      await new Promise(r => setTimeout(r, 1000 * i));
    }
  }
}
</script>
```

**验收标准**:
- ✓ 进度条显示准确
- ✓ 第 3 次失败时显示降级选项
- ✓ UI 美观，符合现有设计风格

**交付**: 代码 + 截图

---

#### 6.2 支付状态流程图

```html
<!-- /client/components/payment-status-flow.html -->
<div class="payment-status-flow">
  <div class="step active" data-step="1">
    <span class="dot">1</span>
    <span class="label">提交支付</span>
  </div>
  <div class="step" data-step="2">
    <span class="dot spinner">2</span>
    <span class="label">交易确认中...</span>
  </div>
  <div class="step" data-step="3">
    <span class="dot">3</span>
    <span class="label">生成报告</span>
  </div>
</div>

<script>
async function pollPaymentStatus(orderId) {
  updateStep(2);
  
  while (true) {
    const response = await fetch(`/api/orders/${orderId}/status`);
    const { status } = await response.json();
    
    if (status === 'completed') {
      updateStep(3);
      showSuccessMessage();
      return;
    }
    
    if (status === 'failed') {
      showPaymentFailed();
      return;
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
}

function updateStep(stepNum) {
  document.querySelectorAll('.step').forEach(step => {
    const currentStep = parseInt(step.dataset.step);
    if (currentStep < stepNum) {
      step.classList.add('completed');
      step.classList.remove('active');
    } else if (currentStep === stepNum) {
      step.classList.add('active');
    }
  });
}
</script>
```

**验收标准**:
- ✓ 步骤 2 显示 spinner
- ✓ 支付成功时流程完成
- ✓ 支付失败时显示错误提示

**交付**: 代码 + 动画效果截图

---

## 👨‍💻 Task 7: 汇率实时显示 & 定价 UI

**负责人**: 前端  
**工程量**: 3h  
**截止**: 2026-09-18  

### 子任务

#### 7.1 汇率实时获取 & 显示

```html
<!-- /client/components/pricing.html -->
<div class="pricing-display">
  <div class="price-item">
    <strong>深度八字报告</strong>
    <p>
      <span id="price-display">¥29.9</span>
      <span id="exchange-rate">(汇率: 1 USD = 6.45 CNY, 更新于 2026-08-10)</span>
    </p>
  </div>
</div>

<script>
async function getPricingRates() {
  try {
    const response = await fetch('/api/pricing/rates', {
      method: 'POST',
      body: JSON.stringify({
        currency: 'cny',
        date: new Date().toISOString().split('T')[0]
      })
    });
    
    const { price, rate, updateDate } = await response.json();
    
    document.getElementById('price-display').textContent = `¥${price.toFixed(2)}`;
    document.getElementById('exchange-rate').textContent = 
      `(汇率: 1 USD = ${rate.toFixed(2)} CNY, 更新于 ${updateDate})`;
    
  } catch (err) {
    console.error('Failed to fetch pricing rates:', err);
    // 降级到静态定价
  }
}

// 页面加载时调用
document.addEventListener('DOMContentLoaded', getPricingRates);
</script>
```

**验收标准**:
- ✓ 汇率每日更新
- ✓ 显示结果精确到小数点 2 位
- ✓ 网络故障时降级到静态定价

**交付**: 代码 + API 端点

---

#### 7.2 多币种选择 & 价格联动

```javascript
// /server/api/pricing.js
app.post('/api/pricing/rates', async (req, res) => {
  const { currency, date } = req.body;
  
  // 缓存 5 分钟
  const cacheKey = `pricing:${currency}:${date}`;
  let data = cache.get(cacheKey);
  
  if (!data) {
    // 从 DB 或 Exchange Rates API 获取
    const rate = await getExchangeRate(currency, date);
    const basePrice = PRODUCT_BASE_PRICES['bazi-deep'];  // USD
    
    data = {
      price: (basePrice * rate).toFixed(2),
      rate: rate.toFixed(2),
      updateDate: date
    };
    
    cache.set(cacheKey, data, 300);  // 5 分钟
  }
  
  res.json(data);
});
```

**交付**: 代码 + API 文档

---

## 👨‍💻 Task 8: 法律页面 Accordion + 地区动态

**负责人**: 前端  
**工程量**: 3h  
**截止**: 2026-09-18  

### 子任务

#### 8.1 Accordion 折叠式 FAQ

```html
<!-- /client/pages/legal-faq.html -->
<section class="legal-faq">
  <h2>你可能关心的 5 个问题</h2>
  <div class="accordion">
    <details open>
      <summary>❓ 你们能把我的生日卖给别人吗？</summary>
      <p>不能。我们不出售或转移任何个人信息。你的生日仅用于算命计算，存储在加密数据库中。</p>
      <p><a href="#section-privacy">→ 查看完整隐私政策</a></p>
    </details>

    <details>
      <summary>🔙 多久能退款？</summary>
      <p><b>中国用户 (¥)</b>: 7 天 / <b>海外用户 ($)</b>: 14 天 / <b>韩国用户 (₩)</b>: 7 天</p>
      <p><a href="#section-refund">→ 查看完整退款政策</a></p>
    </details>

    <details>
      <summary>🤖 我的数据会被 AI 训练吗？</summary>
      <p>不会。你的生日、姓名仅用于个性化算命结果，不用于 AI 模型训练。</p>
    </details>

    <details>
      <summary>🔒 支付安全吗？</summary>
      <p>是的。所有支付通过 Stripe、WeChat Pay 等官方网关，我们不存储信用卡信息。</p>
    </details>

    <details>
      <summary>🗑️ 能永久删除账户吗？</summary>
      <p>可以。发邮件至 support@shenyuan.app，我们会在 30 天内删除你的所有数据。</p>
    </details>
  </div>
</section>
```

**CSS** (简单 accordion 样式):
```css
.accordion details {
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 10px;
  padding: 10px;
}

.accordion summary {
  cursor: pointer;
  font-weight: bold;
}

.accordion details[open] summary {
  color: #007bff;
}
```

**验收标准**:
- ✓ FAQ 五问清晰易懂
- ✓ 点击展开/收起流畅

**交付**: 代码 + 截图

---

#### 8.2 地区动态显示条款

```html
<!-- /client/pages/legal-terms.html -->
<section class="legal-by-region" id="section-privacy">
  <h2>隐私政策</h2>
  
  <div id="privacy-sections">
    <div class="region-block" data-region="CN">
      <h3>🇨🇳 中国用户 - 个人信息保护法 (PIPL)</h3>
      <p>若你位于中国大陆，本平台遵守《个人信息保护法》...</p>
    </div>

    <div class="region-block" data-region="KR">
      <h3>🇰🇷 韩国用户 - 개인정보보호법 (PIPA)</h3>
      <p>한국 사용자의 경우, 본 플랫폼은 PIPA를 준수합니다...</p>
    </div>

    <div class="region-block" data-region="EU">
      <h3>🇪🇺 欧盟/英国用户 - GDPR</h3>
      <p>If you are located in the EU or UK...</p>
    </div>
  </div>
</section>

<script>
(async function() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const { country_code } = await response.json();
    
    const regionMap = {
      'CN': 'CN', 'KR': 'KR', 'US': 'US',
      'DE': 'EU', 'FR': 'EU', 'GB': 'EU'
    };
    
    const region = regionMap[country_code] || 'OTHER';
    
    // 隐藏不相关条款
    document.querySelectorAll('.region-block').forEach(block => {
      block.style.display = block.dataset.region === region ? 'block' : 'none';
    });
    
    localStorage.setItem('userRegion', region);
  } catch (err) {
    console.warn('Geo-detection failed');
  }
})();
</script>
```

**验收标准**:
- ✓ 地理位置检测准确
- ✓ 仅显示相关条款
- ✓ 支持手动切换地区查看

**交付**: 代码 + 地区测试截图

---

## ✅ 完整交付清单

| Task | 工程量 | 交付物 | 截止 |
|------|--------|--------|------|
| 1. Stripe 三币种 | 6h | 代码 + 验证日志 | Aug 20 |
| 2. Webhook + 事务隔离 | 8h | 代码 + 并发测试 | Aug 25 |
| 3. Toss/Kakao + API polling | 6h | 代码 + Job 日志 | Sep 05 |
| 4. 每日对账 Job | 4h | 代码 + 报告 | Sep 10 |
| 5. 生产检查 & 性能测试 | 3h | 脚本 + 测试报告 | Sep 23 |
| 6. 支付重试 UI | 4h | 代码 + 截图 | Sep 15 |
| 7. 汇率显示 & 定价 | 3h | 代码 + API | Sep 18 |
| 8. 法律页面 UX | 3h | 代码 + 截图 | Sep 18 |
| **合计** | **42h** | — | **Sep 30** |

---

**清单版本**: 1.1 (修订版)  
**最后更新**: 2026-08-10  
**下一阶段**: Karen 签批后工程启动
