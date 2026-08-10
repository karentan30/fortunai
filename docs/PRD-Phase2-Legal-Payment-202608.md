# 善缘 Phase 2 PRD：法律合规 + 三币种支付系统

**版本**: 1.0  
**日期**: 2026-08-10  
**负责人**: Karen (CEO) / 工程团队  
**状态**: 待审批  
**目标上线**: 2026-09-30

---

## 📋 Executive Summary

ShenYuan Phase 2 的核心目标是**构建企业级法律合规框架与全球三币种支付系统**，支撑未来的商业扩张与监管要求。

| 阶段 | 交付物 | 状态 | 目标完成 |
|------|--------|------|---------|
| **法律文件** | 中/英/韩 legal docs | ✓ 已草稿 | 2026-08-31 (法务审查) |
| **Stripe 三币种** | USD/CNY/KRW 支付流程 | 📋 PR设计中 | 2026-08-20 |
| **韩国支付本地化** | Toss/Kakao/Naver 集成 | 📋 Phase 1 | 2026-09-30 |
| **支付回调策略** | Webhook + DB reconciliation | 📋 架构定稿 | 2026-09-15 |

---

## Part I：法律文件补全（Legal Compliance）

### I.1 现状评估

#### 现有文件
- ✅ **legal-CN.html** (中文): 完整度 95% — 条款清晰，需补真实公司信息
- ✅ **legal-en.html** (英文): 完整度 90% — 结构明确，需 GDPR/CCPA 微调
- ✅ **legal-kr.html** (韩文): 完整度 85% — 术语韩式化待审，缺 PIPA 细节

#### 缺口清单
| 项目 | 中文 | 英文 | 韩文 | 优先级 |
|------|------|------|------|--------|
| 运营主体信息 | ⚠️ 占位 | ⚠️ 占位 | ⚠️ 占位 | P0 |
| 商业登记号 | ⚠️ "待Karen提供" | ✓ 已补 | ⚠️ 占位 | P0 |
| 法定代表人 | ⚠️ 占位 | ✓ 隐匿 | ⚠️ 占位 | P0 |
| GDPR 隐私权 | ✓ 含 | ⚠️ 简略 | ❌ 缺 | P1 |
| CCPA（加州）| ✓ 参考 | ✓ 含 | ❌ 缺 | P1 |
| PIPA（韩国） | ❌ 缺 | ❌ 缺 | ⚠️ 简略 | P0 |
| AI 生成标识 | ✓ 明确 | ✓ 明确 | ✓ 明确 | ✓ |
| 退款明确期限 | ✓ 详细 | ✓ 详细 | ✓ 详细 | ✓ |

---

### I.2 补全方案

#### 需 Karen 提供的真实信息
```
【必填 · P0】
├─ 公司法定名称 (中文正式名)
├─ 英文法律主体名 
├─ 香港商业登记号 (CR # from Companies Registry)
├─ 法定代表人姓名 + 身份证号后4位
├─ 实际运营地址 (不仅仅是申报地址)
├─ 财务负责人邮箱 (用于税务对接)
└─ 韩国子公司情况 (如已成立)
   ├─ 韩国法人登记号 (사업자번호)
   └─ 韩国实名代表人

【参考 · 法务需求】
├─ 外商代理商资格 (PIPA 合规商)
├─ ISO 27001 或类似数据安全认证
└─ 第三方隐私合规审查报告 (可选但增强信任)
```

#### 中文版补全清单

**位置**: `legal-CN.html` line 170-177 (meta-block)

**现状**:
```html
<div class="row"><b>香港商业登记号</b>：待Karen提供</div>
<div class="row"><b>法定代表人</b>：待Karen提供</div>
```

**修正后**:
```html
<div class="row"><b>运营主体</b>：Capstone IQ Group Limited（香港注册）</div>
<div class="row"><b>香港商业登记号</b>：[CR 编号，8 位数]</div>
<div class="row"><b>公司地址</b>：香港九龙旺角亚皆老街 111 号（已有，确保准确）</div>
<div class="row"><b>法定代表人</b>：[姓名]（身份验证私密化处理）</div>
<div class="row"><b>财务负责人</b>：[邮箱地址]（内部财务对接）</div>
<div class="row"><b>PIPL 数据保护官</b>：support@shenyuan.app（同时为隐私权益联系方）</div>
```

**新增第四章：PIPA 合规声明（仅中文版，因面向大陆用户）**

在隐私政策第三章后（line 362 前）插入：

```html
<h3>四之一、韩国个人信息保护法 (PIPA) 合规</h3>
<p>若用户位于韩国或使用韩国 IP，本平台遵守《个人信息保护法（PIPA）》。所有个人信息处理由 Capstone IQ Group Limited 或其授权韓国代理商作为个人信息处理者负责。用户享有 PIPA 第 35-39 条规定的权利，包括：</p>
<ul>
  <li>信息接近权：要求查阅本平台持有的其个人信息；</li>
  <li>更正/删除权：更正不准确信息，或要求删除；</li>
  <li>处理停止权：可在任何时刻要求停止处理个人信息。</li>
</ul>
<p>用户可向 <strong>support@shenyuan.app</strong> 提交权利申请，我们将在 10 日内回复。如对我们的处理有异议，可向韩国个人信息保护委员会投诉。</p>
```

#### 英文版补全清单

**位置**: `legal-en.html` line 91-96 (meta-block)

**补充内容**：

1. **GDPR 加强** (line 180 Privacy Policy 第 3 节后添加):
```html
<h3>3.1 GDPR Compliance (EU/UK Users)</h3>
<p>For users located in the European Union or United Kingdom, we process personal data in accordance with Regulation (EU) 2016/679 (GDPR). Your legal basis for processing is "legitimate interest" (contract performance for paid services). You have the right to:</p>
<ul>
  <li><b>Data Access:</b> Request a portable copy of your data in machine-readable format</li>
  <li><b>Erasure:</b> Request deletion ("right to be forgotten") within 30 days, subject to legal retention obligations</li>
  <li><b>Withdraw Consent:</b> Opt out of processing at any time (retroactive withdrawal does not affect prior lawful processing)</li>
</ul>
<p>To exercise these rights, email support@shenyuan.app with "GDPR Request" in the subject. We will respond within 30 calendar days.</p>
```

2. **CCPA 强化** (line 191 更新为):
```html
<h3>5. Your Rights (GDPR / CCPA / PIPL)</h3>
<p>Depending on your jurisdiction:</p>

<b>🇪🇺 GDPR (EU/UK):</b><br>
<ul>
  <li>Data Portability: Receive your data in CSV/JSON</li>
  <li>Erasure: "Right to be forgotten" within statutory periods</li>
  <li>Withdrawal: Revoke consent (does not retroactively invalidate past processing)</li>
</ul>

<b>🇺🇸 CCPA (California):</b><br>
<ul>
  <li>Know: Disclosure of personal information collected</li>
  <li>Delete: Request deletion (with exceptions for legal compliance)</li>
  <li>Opt-Out: Do Not Sell My Personal Information (we do not sell data)</li>
  <li>Non-Discrimination: No penalty for exercising rights</li>
</ul>

<b>🇨🇳 PIPL (Mainland China):</b><br>
<ul>
  <li>Cross-Border Consent: Separate confirmation for data transferred outside China</li>
  <li>Withdrawal: May revoke consent prospectively</li>
  <li>Complaint: File with CAC (Cyberspace Administration of China)</li>
</ul>

<b>🇰🇷 PIPA (South Korea):</b><br>
<ul>
  <li>Access & Correction: View and modify your personal information</li>
  <li>Erasure: Request deletion from our systems</li>
  <li>Complaint: File with Korea Personal Information Protection Commission</li>
</ul>
```

#### 韩文版补全清单

**位置**: `legal-kr.html` 整体韩式术语调整

**P0 补正**：

1. **PIPA 용어 정확화** (line 228-245):
   - "데이터 컨트롤러" → "개인정보 처리자" (한국식)
   - "개인정보 보호 담당자" 추가: KISA 등록 필수
   - PIPA § 31-36 조 명시 (권리 조항)

2. **만세력 명확화** (line 258 탭에서):
   ```html
   <tr>
      <td><strong>출생 년월일시 (만세력 기준)</strong></td>
      <td>필수 (사주 계산 기반)</td>
      <td>한국 만세력(만세주)에 따른 정확한 사주 계산, 서양 열대 황도와 무관</td>
   </tr>
   ```

3. **신구 PIPA 구분** (line 245 추가):
   ```html
   <p>본 정책은 2024년 3월 16일 개정 PIPA를 기준으로 합니다. 이전 버전 정책을 참고하시려면 support@shenyuan.app으로 문의하세요.</p>
   ```

---

### I.3 法务审查清单

**交付前必过**（需 Karen 自行或雇外部法务）：

| 检查项 | 优先级 | 验收标准 |
|--------|--------|---------|
| **商业主体真实性** | P0 | CR # 在香港公司注册处可查，地址可验证 |
| **PIPL 第三章符合性** | P0 | 敏感信息(出生日期)有单独同意机制 |
| **PIPA (韩国版) 准确性** | P0 | 用语符合韩国个인정보보호법·위원회指南 |
| **GDPR 适配** | P1 | 覆盖 28 EU 国家 + UK |
| **CCPA 免责准确** | P1 | 加州特殊条款（退款、DNSMPI）不违州法 |
| **AI 生成标识合规** | P0 | 符合 EU AI Act / 中国《生成式AI服务管理暂行办法》 |
| **退款流程可执行** | P0 | 标明 24h/72h 期限不违当地消保法 |
| **第三方转移披露** | P0 | DeepSeek/Stripe 信息处理协议已签 |

**法务反馈周期**: 预计 7-10 个工作日

---

## Part II：Stripe 三币种支付系统

### II.1 现状与需求

#### 当前支付现状
```
【已上线】
├─ Stripe Card (USD) · 全球信用卡 ✓
├─ WeChat Pay (CNY) · 中国微信 ✓
└─ Alipay (CNY) · 中国支付宝 ✓

【待集成】
├─ Stripe (CNY) · 中国银联 — 考虑
└─ Stripe (KRW) · 韩国 — 临时方案，长期用 Toss/Kakao
```

#### 三币种需求背景
- **USD**: 海外英文用户（北美/欧洲/澳洲）
- **CNY**: 中国大陆用户（已通过微信/支付宝）
- **KRW**: 韩国新市场（$3.7B 四柱命理市场）

#### Stripe 的角色定位
| 币种 | 当前方案 | Stripe 角色 | 用途 |
|------|---------|-----------|------|
| USD | Stripe Card | 主力 | 国际卡支付（唯一选择） |
| CNY | WeChat/Alipay | 备选 | Stripe 中国支付仍在试验，非 GA |
| KRW | Toss/Kakao/Naver | 主力 | 韩国本地化支付（Stripe KRW 成本高）|

---

### II.2 Stripe 三币种完整方案

#### 2.2.1 USD（国际信用卡）— 已实现，验证逻辑

**现有集成**:
```javascript
// /server/api/checkout (existing)
POST /checkout {
  product: 'bazi-deep-report',
  amount: 4.99,           // USD
  currency: 'usd',
  customer: { email, name },
  paymentMethod: 'card'   // Stripe default
}

Response: {
  clientSecret: 'pi_xxx#secret_xxx',
  publicKey: 'pk_live_xxx'
}
```

**验证清单**:
- ✅ Stripe 美国账户已活跃（可查 Dashboard）
- ✅ Webhook 已注册 `https://shenyuan.mylumee.cn/api/webhook`
- ❓ 需验证：Live mode API keys 有效期 & 权限范围

**完整性检查**:
```bash
# Test USD payment flow
curl -X POST https://shenyuan.mylumee.cn/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi-report",
    "amount": 0.01,
    "currency": "usd",
    "customer": { "email": "test@example.com" }
  }'

# Expected: clientSecret returned, payment_intent created in Stripe Dashboard
```

---

#### 2.2.2 CNY（中国银联）— 验证 Stripe 可行性

**方案选择**:

| 方案 | 成本 | 实现度 | 备注 |
|------|------|--------|------|
| **A. 保持 WeChat/Alipay** | 3-5% 手续费 | ✓ 完整 | 推荐 · 用户体验最佳 |
| **B. Stripe China CNY** | 3.9% | ⚠️ Beta | Stripe 官方不推荐生产环境 |
| **C. UnionPay (银联直连)** | 2-3% | ❌ 需新集成 | 中国仅支持有 ICP 备案的企业 |
| **D. 混合（推荐）** | 3-5% | ✓ 最优 | WeChat/Alipay 主力 + Stripe CNY 作备选 |

**建议方案 D 实施**:
```javascript
// /server/api/checkout 逻辑扩展
if (currency === 'cny') {
  // 主路由：WeChat/Alipay（通过现有网关）
  if (paymentMethod === 'wechat') {
    return initWeChatPayment(params);  // 现有
  } else if (paymentMethod === 'alipay') {
    return initAlipayment(params);     // 现有
  }
  
  // 备选路由：Stripe CNY（仅海外用户）
  if (paymentMethod === 'stripe_cny') {
    return initStripeCNY(params);      // NEW
  }
}

// initStripeCNY implementation
async function initStripeCNY({ amount, customerId }) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),  // cents
      currency: 'cny',
      customer: customerId,
      payment_method_types: ['card'],
      metadata: { product: 'bazi-report' }
    });
    return { clientSecret: paymentIntent.client_secret };
  } catch (err) {
    console.error('[stripe/cny] error:', err);
    // Fallback: redirect to WeChat/Alipay
    return { fallback: 'wechat' };
  }
}
```

**集成优先度**: **P2（可后续添加）** — 目前 WeChat/Alipay 足够

---

#### 2.2.3 KRW（韩国元）— 长期策略

**方案对比**:

| 方案 | 成本 | 覆盖市场 | 实施周期 | 优先度 |
|------|------|---------|---------|--------|
| **Stripe Korea (KRW)** | 3.9% + 补充费 | 10% | 2 周 | P2 临时 |
| **Toss (사모핸) Payments** | 2.2-2.8% | 18% | 3-5 天 | **P1 快速** |
| **Kakao Pay** | 3.2% | 32% | 1-2 周 | **P1 扩张** |
| **Naver Pay** | 3.0% | 28% | 1-2 周 | **P1 补完** |
| **混合（推荐）** | 平均 2.8% | 78%+ | 4 周 | **推荐** |

**Stripe KRW 作为临时方案**（如韩国支付审批延期）:

```javascript
// Fallback: Stripe KRW when Toss not ready
POST /checkout {
  product: 'saju-deep-report',
  amount: 9900,           // ₩
  currency: 'krw',
  paymentMethod: 'stripe'
}

// Server-side implementation
async function initStripeKRW(params) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amount,  // KRW (no division)
    currency: 'krw',
    customer: params.customerId,
    payment_method_types: ['card'],  // Only international cards
  });
  return { clientSecret: paymentIntent.client_secret };
}
```

**限制**: Stripe KRW 仅支持国际卡，无本地支付方式 → 转化率预期 <2%

---

### II.3 Stripe 集成检查清单

**必完成项** (Phase 2 交付前):

| 检查项 | 验收标准 | 负责人 | 完成日期 |
|--------|---------|--------|---------|
| **API Keys 有效性** | Live mode keys 有 create_payment_intent 权限 | 工程 | 2026-08-15 |
| **USD 支付端到端** | 测试卡成功计费 + webhook 收到确认 | 工程 | 2026-08-15 |
| **CNY 备选路由** | WeChat/Alipay 存量流程验证 | 工程 | 2026-08-18 |
| **KRW 临时方案** | Stripe KRW endpoint 编码完成（暂不启用） | 工程 | 2026-08-20 |
| **Webhook 防重复** | 同一 payment_intent 重复 webhook 幂等性 | 工程 | 2026-08-22 |
| **多币种错误处理** | 汇率异常、支付超时、重复扣款 recovery | 工程 | 2026-08-25 |
| **用户前端本地化** | 选币种界面、价格显示、收据货币符号 | 前端 | 2026-08-28 |

---

## Part III：支付回调策略（Payment Webhook Architecture）

### III.1 核心设计原则

#### 问题陈述
支付完成后，从支付网关（Stripe/Toss/Kakao）到我们后端订单系统需要**可靠、幂等、可审计**的数据同步机制。

#### 设计目标
1. **可靠性**: 即使 webhook 丢失/延迟，订单最终一致性有保证
2. **幂等性**: 重复 webhook 不会导致订单重复计费
3. **可审计**: 所有支付事件有完整日志，便于对账
4. **低延迟**: 支付后 <2s 内用户获得内容访问权限

---

### III.2 推荐架构：Webhook + DB Reconciliation

#### 整体流程

```
User Payment Flow
├─ 1. User 提交支付 (前端 → Stripe/Toss)
│  └─ POST /checkout { product, amount, currency }
│
├─ 2. 支付网关返回 clientSecret / orderId
│  └─ 前端保存 transactionId
│
├─ 3. 支付完成（用户在支付网关确认）
│  ├─ Webhook 异步推送 (Payment Success Event)
│  │  └─ POST /webhook/[provider]/payment.success
│  │     ├─ 验证签名
│  │     ├─ 幂等性检查 (INSERT OR UPDATE orders)
│  │     ├─ 记录 webhook_confirmed_at
│  │     └─ Response 200 OK
│  │
│  └─ [可选] 前端 polling /api/status/[transactionId]
│     └─ 快速反馈（<2s）
│
├─ 4. 每日对账 (Reconciliation Job)
│  ├─ 查询 Stripe/Toss API 获取当日所有完成交易
│  ├─ 对比本地 DB orders 表
│  ├─ 发现幽灵单据（支付方有，本地无）→ 插入补救
│  ├─ 发现孤立单据（本地有，支付方无）→ 告警
│  └─ 生成对账报告 (settlement_reconciliation 表)
│
└─ 5. 用户获得内容访问权限
   └─ 根据 orders.webhook_confirmed_at IS NOT NULL 解锁
```

---

### III.3 数据库设计

#### 订单表 (orders)

```sql
CREATE TABLE orders (
  id VARCHAR(36) PRIMARY KEY,  -- UUID4
  
  -- 用户信息
  user_id VARCHAR(36) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  
  -- 商品信息
  product_id VARCHAR(100) NOT NULL,
  product_name VARCHAR(200),
  
  -- 支付信息
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,  -- 'usd','cny','krw'
  payment_provider VARCHAR(50),  -- 'stripe','toss','kakao','wechat','alipay'
  payment_status VARCHAR(50),    -- 'pending','processing','completed','failed','refunded'
  
  -- 交易标识
  transaction_id VARCHAR(255),   -- Stripe pi_xxx, Toss orderId
  payment_intent_id VARCHAR(255), -- Stripe PI ID (用于 webhook 验证)
  payment_method VARCHAR(100),    -- 'card','wechat','alipay','toss_card'
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Webhook 记录
  webhook_received_at TIMESTAMP NULL,  -- 首次 webhook 到达时间
  webhook_confirmed_at TIMESTAMP NULL, -- webhook 验签+处理成功时间
  webhook_retry_count INT DEFAULT 0,   -- webhook 重试次数
  
  -- 对账标记
  reconciliation_status VARCHAR(50),   -- 'pending','confirmed','mismatch'
  reconciliation_checked_at TIMESTAMP NULL,
  
  -- 元数据
  metadata JSON,  -- 额外字段：user_agent, ip_addr, 优惠码等
  
  UNIQUE KEY uk_transaction_id (payment_provider, transaction_id),
  INDEX idx_user_id (user_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_webhook_confirmed (webhook_confirmed_at)
);
```

#### Webhook 事件日志表

```sql
CREATE TABLE webhook_events (
  id VARCHAR(36) PRIMARY KEY,
  
  -- Webhook 元信息
  provider VARCHAR(50),           -- 'stripe','toss','kakao'
  event_type VARCHAR(100),        -- 'payment.success','payment.failed'
  event_id VARCHAR(255),          -- 支付方的事件 ID（用于去重）
  
  -- 相关订单
  order_id VARCHAR(36),
  transaction_id VARCHAR(255),
  
  -- 内容
  raw_payload LONGTEXT,           -- 原始 JSON (用于调查)
  processed_at TIMESTAMP NULL,
  error_message TEXT,
  
  -- 验证结果
  signature_valid BOOLEAN DEFAULT FALSE,
  idempotency_check_passed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_event_id (provider, event_id),
  INDEX idx_order_id (order_id),
  INDEX idx_processed (processed_at)
);
```

#### 对账报告表

```sql
CREATE TABLE settlement_reconciliation (
  id VARCHAR(36) PRIMARY KEY,
  
  reconciliation_date DATE NOT NULL,
  payment_provider VARCHAR(50),
  
  -- 数字
  total_transactions INT,
  confirmed_count INT,
  pending_count INT,
  mismatch_count INT,
  
  -- 金额
  total_amount DECIMAL(12,2),
  total_currency VARCHAR(3),
  
  -- 状态
  status VARCHAR(50),  -- 'completed', 'with_warnings', 'with_errors'
  report_summary JSON,  -- { "mismatches": [...], "alerts": [...] }
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_date_provider (reconciliation_date, payment_provider)
);
```

---

### III.4 Webhook 处理逻辑

#### Stripe Webhook Handler

```javascript
// /server/routes/webhook.js
const crypto = require('crypto');
const { db, logger } = require('../utils');

// POST /webhook/stripe/payment
async function handleStripeWebhook(req, res) {
  try {
    // 1. 验证签名
    const signature = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      req.rawBody,  // 必须是 raw buffer，不能是解析后的 JSON
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    logger.info('[stripe/webhook] event received', {
      eventId: event.id,
      type: event.type
    });

    // 2. 只处理支付成功事件
    if (event.type !== 'payment_intent.succeeded') {
      return res.status(200).json({ received: true });
    }

    const paymentIntent = event.data.object;
    const { amount, currency, id: paymentIntentId, metadata } = paymentIntent;

    // 3. 幂等性检查 & 插入订单
    const [inserted, order] = await db.query(`
      INSERT INTO orders (
        id, user_id, customer_email, product_id,
        amount, currency, payment_provider,
        payment_status, transaction_id, payment_intent_id,
        webhook_received_at, webhook_confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        webhook_received_at = IFNULL(webhook_received_at, NOW()),
        webhook_confirmed_at = NOW(),
        payment_status = 'completed',
        webhook_retry_count = webhook_retry_count + 1
    `, [
      generateUUID(),
      metadata.userId,
      paymentIntent.receipt_email || metadata.email,
      metadata.product_id,
      amount / 100,  // Stripe 以分为单位
      currency,
      'stripe',
      'completed',
      paymentIntentId,
      paymentIntentId,
      new Date(),
      new Date()
    ]);

    // 4. 记录 webhook 事件
    await db.query(`
      INSERT INTO webhook_events (
        id, provider, event_type, event_id,
        order_id, transaction_id, raw_payload,
        signature_valid, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateUUID(),
      'stripe',
      'payment.success',
      event.id,
      order.id,
      paymentIntentId,
      JSON.stringify(paymentIntent),
      true,
      new Date()
    ]);

    logger.info('[stripe/webhook] order processed', {
      orderId: order.id,
      amount: amount / 100,
      currency: currency
    });

    return res.status(200).json({ received: true });

  } catch (err) {
    logger.error('[stripe/webhook] error', err);
    
    // Stripe 需要 2xx 响应，否则重试。
    // 不返回 error details 给 Stripe（隐私考虑）
    return res.status(200).json({ received: true });
  }
}

module.exports = { handleStripeWebhook };
```

#### Toss Webhook Handler (韩国支付)

```javascript
// POST /webhook/toss/payment
async function handleTossWebhook(req, res) {
  try {
    const { orderId, orderName, approvedAt, totalAmount, method, paymentKey } = req.body;
    
    // 1. Toss 不提供签名验证，仅检查 IP 白名单（需 nginx 配置）
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    const validIps = process.env.TOSS_WEBHOOK_IPS?.split(',') || [];
    
    if (!validIps.includes(clientIp)) {
      logger.warn('[toss/webhook] invalid IP', { clientIp });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 2. 查询本地订单确认金额
    const [order] = await db.query(
      'SELECT * FROM orders WHERE transaction_id = ?',
      [orderId]
    );

    if (!order) {
      logger.error('[toss/webhook] order not found', { orderId });
      return res.status(404).json({ error: 'Order not found' });
    }

    // 3. 金额验证（防止篡改）
    if (order.amount !== totalAmount / 100) {
      logger.error('[toss/webhook] amount mismatch', {
        orderId,
        expected: order.amount,
        received: totalAmount / 100
      });
      return res.status(400).json({ error: 'Amount mismatch' });
    }

    // 4. 更新订单为已确认
    await db.query(`
      UPDATE orders SET
        payment_status = 'completed',
        webhook_confirmed_at = NOW(),
        payment_method = ?,
        metadata = JSON_SET(metadata, '$.toss_payment_key', ?)
      WHERE id = ?
    `, [method, paymentKey, order.id]);

    // 5. 记录事件
    await db.query(`
      INSERT INTO webhook_events (
        id, provider, event_type, event_id,
        order_id, transaction_id, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      generateUUID(),
      'toss',
      'payment.success',
      `${orderId}:${approvedAt}`,  // Toss 无唯一事件 ID，用订单 + 时间
      order.id,
      orderId,
      new Date()
    ]);

    logger.info('[toss/webhook] order confirmed', { orderId, amount: order.amount });
    return res.status(200).json({ success: true });

  } catch (err) {
    logger.error('[toss/webhook] error', err);
    return res.status(200).json({ success: true });  // 返回 200 让 Toss 停止重试
  }
}
```

---

### III.5 每日对账 Job

#### Cron 配置 (PM2)

```json
{
  "apps": [{
    "name": "shenyuan",
    "script": "server/index.js",
    "cron_restart": "0 2 * * *",  // 每天凌晨 2 点重启（不需要，用 job 触发）
    "instances": 1,
    "env": {
      "NODE_ENV": "production"
    }
  }]
}
```

#### 对账任务 (Scheduled Job)

```javascript
// /server/jobs/reconcile-payments.js
const cron = require('node-cron');
const { db, logger, stripe } = require('../utils');

async function reconcilePaymentsDaily() {
  logger.info('[reconcile] starting daily reconciliation');
  
  const today = new Date().toISOString().split('T')[0];
  const startOfDay = new Date(today + 'T00:00:00Z');
  const endOfDay = new Date(today + 'T23:59:59Z');

  try {
    // 1. 从 Stripe 拉取当日已结算交易
    const stripeTransactions = await stripe.charges.list({
      created: {
        gte: Math.floor(startOfDay / 1000),
        lte: Math.floor(endOfDay / 1000)
      },
      limit: 100
    });

    logger.info('[reconcile/stripe] fetched transactions', {
      count: stripeTransactions.data.length
    });

    // 2. 查询本地订单
    const [localOrders] = await db.query(`
      SELECT 
        id, transaction_id, amount, currency, 
        payment_status, webhook_confirmed_at
      FROM orders
      WHERE DATE(created_at) = ?
        AND payment_provider = 'stripe'
    `, [today]);

    logger.info('[reconcile/local] fetched orders', {
      count: localOrders.length
    });

    // 3. 对比：发现幽灵单据
    const processedTxIds = new Set(localOrders.map(o => o.transaction_id));
    let ghostOrders = 0;

    for (const charge of stripeTransactions.data) {
      if (!processedTxIds.has(charge.payment_intent)) {
        ghostOrders++;
        logger.warn('[reconcile/ghost] unprocessed stripe charge detected', {
          chargeId: charge.id,
          paymentIntentId: charge.payment_intent,
          amount: charge.amount / 100
        });

        // 插入修复
        await db.query(`
          INSERT INTO orders (
            id, customer_email, amount, currency,
            payment_provider, payment_status,
            transaction_id, payment_intent_id,
            webhook_confirmed_at, reconciliation_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          generateUUID(),
          charge.billing_details?.email || 'unknown@stripe.local',
          charge.amount / 100,
          charge.currency,
          'stripe',
          'completed',
          charge.payment_intent,
          charge.payment_intent,
          new Date(),
          'mismatch'  // 标记为通过对账发现
        ]);
      }
    }

    // 4. 对比：发现孤立单据
    let orphanOrders = 0;
    for (const order of localOrders) {
      const stripeMatch = stripeTransactions.data.find(
        c => c.payment_intent === order.transaction_id
      );
      if (!stripeMatch) {
        orphanOrders++;
        logger.warn('[reconcile/orphan] local order missing in stripe', {
          orderId: order.id,
          transaction_id: order.transaction_id
        });
        
        // 可能原因：
        // 1. 网络延迟（Stripe 尚未结算）
        // 2. 退款
        // 3. 订单假数据
        // 留待人工审查
      }
    }

    // 5. 生成对账报告
    const report = {
      date: today,
      total_stripe_transactions: stripeTransactions.data.length,
      total_local_orders: localOrders.length,
      ghost_orders: ghostOrders,
      orphan_orders: orphanOrders,
      status: ghostOrders > 0 || orphanOrders > 5 ? 'with_warnings' : 'completed'
    };

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
      stripeTransactions.data.length,
      localOrders.length - orphanOrders,
      ghostOrders,
      report.status,
      JSON.stringify(report)
    ]);

    logger.info('[reconcile] completed', report);

  } catch (err) {
    logger.error('[reconcile] error', err);
    // 发送告警给 Karen
    await sendAlert({
      subject: '[ShenYuan] Reconciliation Failed',
      body: `Daily payment reconciliation failed: ${err.message}`
    });
  }
}

// 每天 02:30 UTC 执行（中国时间 10:30）
cron.schedule('30 2 * * *', reconcilePaymentsDaily, {
  timezone: 'UTC'
});

module.exports = { reconcilePaymentsDaily };
```

---

### III.6 回调策略清单

| 策略 | Stripe | Toss | Kakao | 说明 |
|------|--------|------|-------|------|
| **Webhook 签名验证** | ✓ HMAC SHA-256 | ✗ IP 白名单 | ✗ IP 白名单 | Stripe 最安全 |
| **支付确认延迟** | <100ms | 1-3s | 1-5s | 越短用户体验越好 |
| **幂等性保证** | DB UNIQUE KEY | 同左 | 同左 | 防止重复计费 |
| **每日对账** | ✓ 自动 | ✓ 自动 | ✓ 自动 | 发现幽灵单据 |
| **失败重试** | Stripe 自动重试 5 次 | 手动或依赖网关 | 手动或依赖网关 | 我们需要主动 poll |
| **用户前端 poll** | 可选（webhook 已覆盖） | 推荐 | 推荐 | 快速反馈，不阻塞 |

---

## Part IV：实施时间表

### 4.1 关键路径

```
Week 1-2 (Aug 10-25)
├─ 法律文件补全 + 外部法务审查 (5-7 days)
├─ Stripe 验证 + 三币种编码 (5 days)
└─ Webhook 数据库设计完成 (3 days)

Week 3-4 (Aug 26-Sep 8)
├─ Webhook 逻辑实现 (Stripe/Toss/Kakao) (6 days)
├─ 每日对账 Job 完成 (2 days)
└─ 全链路测试 (3 days)

Week 5-6 (Sep 9-22)
├─ 韩国支付 (Toss/Kakao) 申请 & 集成 (10 days, 平行)
└─ 前端多币种 UI 完成 (5 days)

Week 7 (Sep 23-30)
├─ 生产环境部署 + 烟雾测试 (3 days)
├─ Karen 签字放行 (1 day)
└─ **上线** (1 day)
```

### 4.2 可交付物清单

| 交付物 | 完成日期 | 验收方 | 状态 |
|--------|---------|--------|------|
| **legal-CN.html** (更新版) | 2026-08-31 | 法务 + Karen | ⏳ |
| **legal-en.html** (GDPR/CCPA 加强) | 2026-08-31 | 法务 + Karen | ⏳ |
| **legal-kr.html** (PIPA + 术语) | 2026-08-31 | 法务 + Karen | ⏳ |
| **Stripe 三币种验证报告** | 2026-08-25 | 工程 | ⏳ |
| **Webhook 架构文档** | 2026-08-22 | 工程 | ⏳ |
| **支付回调代码** (Stripe/Toss/Kakao) | 2026-09-08 | 工程 | ⏳ |
| **每日对账 Job** | 2026-09-10 | 工程 | ⏳ |
| **多币种前端 UI** | 2026-09-20 | 前端 | ⏳ |
| **生产环保烟雾测试报告** | 2026-09-25 | QA | ⏳ |

---

## Part V：成本与 ROI

### 5.1 投资 

| 项目 | 成本 | 备注 |
|------|------|------|
| 外部法务审查（3 国） | $500-1000 | 可选，补全文件后自行审 |
| Stripe API 成本 | $0 | 按交易金额 % 扣 |
| 韩国支付开户费 | ₩0 (Toss 免费) | 各 PG 免费申请 |
| **总投资** | **~$1000** | — |

### 5.2 预期收入提升

| 市场 | 当前 | Phase 2 后 | 增幅 |
|------|------|-----------|------|
| 大陆（CNY） | ¥600K/年 | ¥600K/年 | 0% (维持) |
| 海外（USD） | $50K/年 | $80K/年 | +60% (更好的支付流程) |
| 韩国（KRW） | ₩0/年 | ₩8.6M/年 | +新市场 |
| **合计** | **~$70K/年** | **~$180K/年** | **+156%** |

---

## Part VI：风险管理

### 6.1 关键风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| **Kakao 审批被拒** | 5% | 韩国收入 -32% | 改用 Toss + Naver (覆盖 46%) |
| **法务审查延期** | 10% | 推迟 2 周上线 | 并行开发，最后补文件 |
| **支付 webhook 丢包** | 2% | 用户报怨，订单漏记 | DB 对账 job 补救 |
| **Stripe KRW 成本高** | 100% | 用户会选本地支付 | 优先上线 Toss/Kakao |
| **汇率波动** | 100% | 收入浮动 | 固定定价，月底结算调整 |

### 6.2 应急方案

- **支付全链路故障** → 降级到银行转账（后端配置）
- **Webhook 持续失败** → 启动手动对账 + 客服补发内容
- **法务审查不通过** → 外聘专业律师（预算 $2K）

---

## Part VII：成功指标 (KPIs)

### 上线后 30 天

| KPI | 目标 | 验收标准 |
|-----|------|---------|
| **支付成功率** | >98% | Stripe/Toss/Kakao 总成功率 |
| **Webhook 处理延迟** | <2s | webhook_confirmed_at - webhook_received_at |
| **每日对账准确率** | 100% | 幽灵单据 = 0, 孤立单据 < 1 |
| **用户反馈** | 0 重复计费投诉 | 24h 内解决 |
| **多币种转化** | CNY 40%, KRW 30%, USD 30% | 基于实际支付数据 |

---

## 附录 A：三币种定价表参考

### A.1 建议零售价（中国用户 = ¥基准）

| 产品 | 中国(¥) | 海外(USD) | 韩国(₩) | 换算汇率 |
|------|---------|----------|--------|---------|
| 基础报告 | ¥9.9 | $1.49 | ₩2,200 | 1 USD = 1305₩ / 1 ¥ = 0.15 USD |
| 深度报告 | ¥29.9 | $4.99 | ₩6,500 | 同上 |
| 合婚报告 | ¥19.9 | $2.99 | ₩3,900 | 同上 |
| 月度订阅 | ¥39 | $5.99 | ₩7,800 | 同上 |

> **说明**: 使用固定汇率避免每日波动，月底对账时调整。

---

## 附录 B：法律文件检查清单

### 上线前必过

- [ ] 商业主体信息已填（CR #、地址、法代）
- [ ] 中英韩版本一致性审查
- [ ] PIPL/PIPA/GDPR 条款法务认可
- [ ] 退款政策可在后端执行（无矛盾）
- [ ] AI 生成标识遵守《生成式 AI 管理暂行办法》
- [ ] 第三方信息处理协议已签（DeepSeek/Stripe）
- [ ] 所有链接（contact email, 隐私投诉等）有效

---

## 附录 C：支付网关对比总结

| 指标 | Stripe | WeChat | Alipay | Toss | Kakao | Naver |
|------|--------|--------|--------|------|-------|-------|
| **支持币种** | USD/CNY/KRW | CNY | CNY | KRW | KRW | KRW |
| **手续费** | 2.9% | 1% | 1% | 2.2% | 3.2% | 3.0% |
| **结算周期** | T+2 | T+1 | T+1 | T+1 | T+1 | T+1 |
| **Webhook** | ✓ 签名验证 | ✓ 签名验证 | ✓ 签名验证 | ✗ IP白名单 | ✗ IP白名单 | ✗ IP白名单 |
| **用户覆盖** | 全球 | 国内 | 国内 | 韩国 18% | 韩国 32% | 韩国 28% |
| **集成复杂度** | 低 | 中 | 中 | 中 | 中 | 中 |
| **推荐优先度** | 1 (国际) | 1 (国内) | 1 (国内) | 1 (韩国快速) | 2 (韩国扩张) | 2 (韩国完整) |

---

## 批准与签字

### Karen (CEO)

**审批** Phase 2 PRD 并同意以下内容：

- [ ] 法律文件补全方案（需提供真实公司信息）
- [ ] Stripe 三币种架构（USD 验证 + CNY 备选 + KRW 临时）
- [ ] Webhook + DB 对账策略
- [ ] 2026-09-30 上线目标
- [ ] ~$1000 法务审查预算

**签字**:
```
姓名: ________________________

日期: ________________________

签名: ________________________
```

---

**文档版本**: 1.0  
**最后更新**: 2026-08-10  
**下一次审查**: 2026-09-01
