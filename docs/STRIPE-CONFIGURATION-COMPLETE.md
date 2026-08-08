# 善缘 Stripe 完整配置方案 · Phase 1-3

**版本**: 1.0  
**日期**: 2026-08-08  
**受众**: Engineering Team + CFO  
**执行时间**: 2-3 工作日（包括测试）

---

## 📋 执行清单（按优先级）

### ✅ Phase 1: Day 1 必上（MVP）
- [ ] 创建/验证 Stripe 账户（Capstone + Personal）
- [ ] 配置所有 Price IDs（CNY/USD/KRW）
- [ ] 生成 webhook secret 和 API keys
- [ ] 更新 `.env` 文件
- [ ] 部署支付路由测试
- [ ] 灰度测试（10 用户）

### ⏳ Phase 2: Week 2-3（功能扩展）
- [ ] 添加 Phase 2 产品（合盘/AI 对话/年订阅）
- [ ] 集成订阅生命周期管理
- [ ] 邮件通知系统
- [ ] 完整回归测试

### 🚀 Phase 3: Month 2-3（高端线）
- [ ] 代烧服务产品化
- [ ] 水晶/法器电商线
- [ ] 真人咨询预约系统

---

## 💰 Phase 1 定价清单（Day 1 必需）

### 中文产品（Simplified Chinese）

| 产品 ID | 名称 | 描述 | USD | CNY | KRW | Stripe Price ID |
|---------|------|------|-----|-----|-----|-----------------|
| **bazi_full** | 完整命盘 | 六维+十年大运+流月 | $19.90 | ¥99.90 | ₩29,900 | price_1TzAjGEAXrE2YgcrRzUY78Ko |
| **member_monthly** | 月度会员 | 全部AI占算无限次 | $6.90/mo | ¥19.90/mo | ₩12,900/mo | 待创建 |
| **member_yearly** | 年度会员 | 全年畅用 + 合婚报告 | $39.90/yr | ¥99.90/yr | ₩129,900/yr | price_1TzAjQEAXrE2YgcrHYurEL8Z |

### 英文产品（English）

| 产品 ID | 名称 | 描述 | USD | Price ID |
|---------|------|------|-----|----------|
| **bazi_full** | Complete BaZi Chart | 6D chart + 10yr luck cycles | $19.90 | 同中文 |
| **member_monthly** | Monthly Membership | Unlimited readings | $6.90/mo | 待创建 |
| **member_yearly** | Yearly Membership | Full year access | $39.90/yr | price_1TzAjQEAXrE2YgcrHYurEL8Z |

### 韩文产品（Korean 사주）

| 产品 ID | 名称 | 설명 | KRW | Stripe Price ID |
|---------|------|------|-----|-----------------|
| **saju_kr_full** | 사주팔자 완전 분석 | 천간지지 + 대운 + 유년 | ₩29,900 | price_1TzrGREAXrE2Ygcr1dOkiv2O |
| **member_monthly_kr** | 월간 회원 | 무제한 사주 조회 | ₩12,900/mo | 待创建 |

---

## 🔑 Stripe 账户配置

### 1. 商户账户（使用中）
- **账户名**: ShenYuan Capstone (美国)
- **Account ID**: `acct_1TzAj...` (实际从 dashboard 获取)
- **状态**: ✅ 已激活（Onboarding 完成）
- **支付方式**: Visa/Mastercard/Apple Pay/Google Pay

### 2. API Keys（必须安全保管）

```bash
# 测试环境 (sandbox)
STRIPE_TEST_SECRET_KEY = sk_test_xxx
STRIPE_TEST_PUBLISHABLE_KEY = pk_test_xxx

# 生产环境 (production)
STRIPE_PAY_SECRET_KEY = sk_live_xxx          # 后端专用
STRIPE_PUBLISHABLE_KEY = pk_live_xxx         # 前端可暴露
STRIPE_WEBHOOK_SECRET = whsec_xxx            # Webhook 验签
```

### 3. Webhook 配置

**Endpoint URL**: `https://shenyuan.mylumee.cn/api/stripe-webhook`

**订阅事件**:
- ✅ `checkout.session.completed` — 一次性支付/订阅完成
- ✅ `checkout.session.expired` — 支付链接过期
- ✅ `customer.subscription.created` — 订阅创建
- ✅ `invoice.payment_succeeded` — 续费成功
- ✅ `invoice.payment_failed` — 续费失败
- ✅ `customer.subscription.deleted` — 订阅取消

---

## 📦 JSON 配置文件（生成 Price IDs）

### 方案 A：使用现有 Price IDs（推荐）

```json
{
  "stripe_configuration": {
    "account_country": "US",
    "default_currency": "usd",
    "test_mode": false,
    "webhook_secret": "whsec_xxx",
    
    "products": [
      {
        "id": "prod_bazi_full",
        "name": "Complete BaZi Chart",
        "name_zh": "完整命盘",
        "name_ko": "사주팔자 완전 분석",
        "description": "Six-dimensional chart with 10-year luck cycles",
        "type": "one_time",
        "category": "divination",
        "active": true,
        
        "prices": [
          {
            "id": "price_1TzAjGEAXrE2YgcrRzUY78Ko",
            "currency": "usd",
            "amount": 1990,
            "recurring": false,
            "billing_period": null,
            "metadata": {
              "lang": "en",
              "display": "$19.90"
            }
          },
          {
            "id": "price_1TzAjGEAXrE2YgcrCNY",
            "currency": "cny",
            "amount": 9990,
            "recurring": false,
            "billing_period": null,
            "metadata": {
              "lang": "zh-CN",
              "display": "¥99.90"
            }
          },
          {
            "id": "price_1TzrGREAXrE2Ygcr1dOkiv2O",
            "currency": "krw",
            "amount": 29900,
            "recurring": false,
            "billing_period": null,
            "metadata": {
              "lang": "ko",
              "display": "₩29,900"
            }
          }
        ]
      },
      
      {
        "id": "prod_member_monthly",
        "name": "Monthly Membership",
        "name_zh": "月度会员",
        "name_ko": "월간 회원",
        "description": "Unlimited AI divination for one month",
        "type": "recurring",
        "category": "subscription",
        "active": true,
        "billing_interval": "month",
        
        "prices": [
          {
            "id": "price_member_monthly_usd",
            "currency": "usd",
            "amount": 690,
            "recurring": true,
            "billing_interval": "month",
            "trial_days": 0,
            "metadata": {
              "lang": "en",
              "display": "$6.90/mo"
            }
          },
          {
            "id": "price_member_monthly_cny",
            "currency": "cny",
            "amount": 1990,
            "recurring": true,
            "billing_interval": "month",
            "trial_days": 0,
            "metadata": {
              "lang": "zh-CN",
              "display": "¥19.90/月"
            }
          },
          {
            "id": "price_member_monthly_krw",
            "currency": "krw",
            "amount": 12900,
            "recurring": true,
            "billing_interval": "month",
            "trial_days": 0,
            "metadata": {
              "lang": "ko",
              "display": "₩12,900/월"
            }
          }
        ]
      },
      
      {
        "id": "prod_member_yearly",
        "name": "Yearly Membership",
        "name_zh": "年度会员",
        "name_ko": "연간 회원",
        "description": "Unlimited access for 12 months + compatibility report",
        "type": "recurring",
        "category": "subscription",
        "active": true,
        "billing_interval": "year",
        
        "prices": [
          {
            "id": "price_1TzAjQEAXrE2YgcrHYurEL8Z",
            "currency": "usd",
            "amount": 39900,
            "recurring": true,
            "billing_interval": "year",
            "trial_days": 0,
            "metadata": {
              "lang": "en",
              "display": "$39.90/yr"
            }
          },
          {
            "id": "price_member_yearly_cny",
            "currency": "cny",
            "amount": 99900,
            "recurring": true,
            "billing_interval": "year",
            "trial_days": 0,
            "metadata": {
              "lang": "zh-CN",
              "display": "¥399.90/年"
            }
          },
          {
            "id": "price_member_yearly_krw",
            "currency": "krw",
            "amount": 129900,
            "recurring": true,
            "billing_interval": "year",
            "trial_days": 0,
            "metadata": {
              "lang": "ko",
              "display": "₩129,900/년"
            }
          }
        ]
      },
      
      {
        "id": "prod_saju_kr_full",
        "name": "Complete Saju Analysis",
        "name_zh": "韩国四柱八字完全分析",
        "name_ko": "사주팔자 완전 분석",
        "description": "Full saju analysis with fortune cycles",
        "type": "one_time",
        "category": "divination",
        "active": true,
        "regions": ["kr", "south_korea"],
        
        "prices": [
          {
            "id": "price_1TzrGREAXrE2Ygcr1dOkiv2O",
            "currency": "krw",
            "amount": 29900,
            "recurring": false,
            "billing_period": null,
            "metadata": {
              "lang": "ko",
              "display": "₩29,900"
            }
          },
          {
            "id": "price_saju_kr_usd",
            "currency": "usd",
            "amount": 1990,
            "recurring": false,
            "billing_period": null,
            "metadata": {
              "lang": "en",
              "display": "$19.90"
            }
          }
        ]
      }
    ],
    
    "payment_methods": {
      "us_international": ["card"],
      "cn": ["wechat", "alipay"],
      "kr": ["card", "korean_local_payment"],
      "default": ["card"]
    },
    
    "fraud_protection": {
      "3d_secure": "automatic",
      "radar": "enabled",
      "velocity_limits": {
        "max_transactions_per_hour": 10,
        "max_amount_per_transaction": 99900
      }
    }
  }
}
```

---

## 🔧 后端集成（验证现状）

### 1. 环境变量配置（`.env.production`）

```bash
# Stripe Keys (从 Stripe Dashboard 获取)
STRIPE_PAY_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# 前端 URL（用于 success/cancel redirect）
FRONTEND_URL=https://shenyuan.mylumee.cn

# 支付通道启用
PAYMENT_CHANNELS=stripe,wechat,alipay

# 汇率（如果使用实时汇率，留空则用硬编码）
# EXCHANGE_RATE_USD_CNY=7.25
# EXCHANGE_RATE_USD_KRW=1300
```

### 2. 现有代码验证 ✅

**文件**: `/server/routes/payment.js`  
**状态**: ✅ Stripe 集成已完成

```javascript
// 现有 Stripe Price IDs（第 64-73 行）
const STRIPE_PRICE_IDS = {
  'member_monthly':      'price_1TzAjGEAXrE2YgcrRzUY78Ko',
  'member_yearly':       'price_1TzAjQEAXrE2YgcrHYurEL8Z',
  'member_quarterly':    'price_1U0BwvEAXrE2YgcrTU0PFGZm',
  'bazi_full_krw':       'price_1TzrGREAXrE2Ygcr1dOkiv2O',
  'bazi_vip_krw':        'price_1TzrGUEAXrE2YgcrTAXjFt9M',
  'hehun_krw':           'price_1TzAriEAXrE2YgcrWEj4Azdn',
  'member_monthly_krw':  'price_1TzrGWEAXrE2YgcrhrIIeMXC',
};
```

**需要补充**: 中文 CNY 价格 IDs

---

## 📲 前端集成（支付页面）

### 完整支付流程

```html
<!-- 1. 前端触发支付 -->
<script>
async function initPayment(productId, region = 'en') {
  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: productId,
      region: region, // 'us', 'cn', 'kr'
      email: userEmail,
      successUrl: `${window.location.origin}/api/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/pages/pricing.html`
    })
  });

  const { url, channel } = await response.json();
  
  if (channel === 'cn') {
    // 国内用户：微信/支付宝（走 Lumee Hub）
    showCnPaymentMethods(productId);
  } else {
    // 国际用户：Stripe Checkout
    window.location.href = url;
  }
}
</script>
```

### 国内支付集成（微信/支付宝）

**现有实现** ✅ `/server/routes/payment.js` 第 407-563 行

- ✅ 微信支付 NATIVE 二维码
- ✅ 支付宝当面付
- ✅ 支付状态查询 + 通知回调
- ✅ 订单落盘 + 防丢单

---

## 🧪 测试计划（Day 1-2）

### 测试场景 1: 一次性购买（USD）

```bash
# 1. 创建 Checkout Session
curl -X POST https://shenyuan.mylumee.cn/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi_full",
    "email": "test@example.com",
    "region": "us"
  }'

# 预期响应
{
  "url": "https://checkout.stripe.com/pay/cs_test_xxx",
  "sessionId": "cs_test_xxx",
  "orderNo": "SY-xxx"
}

# 2. 访问 Checkout URL → Stripe 支付页
# 3. 完成支付 → Webhook 触发 → order.payment_status = 'completed'
# 4. 验证用户能访问报告
```

### 测试场景 2: 订阅支付（月度，USD）

```bash
curl -X POST https://shenyuan.mylumee.cn/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "member_monthly",
    "email": "test2@example.com",
    "region": "us"
  }'

# 预期：订阅创建 → 每月自动续费
```

### 测试场景 3: 中文支付（微信，CNY）

```bash
curl -X POST https://shenyuan.mylumee.cn/api/pay/wechat/create \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi_full",
    "channel": "wechat"
  }'

# 预期：返回微信二维码，扫码支付
```

### 测试场景 4: 韩文支付（KRW）

```bash
curl -X POST https://shenyuan.mylumee.cn/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "saju_kr_full",
    "region": "kr"
  }'

# 预期：使用 KRW 价格，Stripe Checkout 页显示 ₩29,900
```

### 测试场景 5: Webhook 验证

```bash
# Stripe CLI 本地测试
stripe listen --forward-to localhost:3000/api/stripe-webhook

# 另一个终端：触发测试事件
stripe trigger checkout.session.completed

# 预期：日志显示 webhook 已处理，订单状态更新
```

---

## 🚀 部署步骤（生产）

### Step 1: 获取生产 API Keys（Day 1 上午）

1. 登录 Stripe Dashboard: https://dashboard.stripe.com
2. 切换到 **Live mode** (右上角)
3. 导航到 **Developers** → **API keys**
4. 复制 **Secret key** (sk_live_...)
5. 复制 **Publishable key** (pk_live_...)
6. 复制 **Webhook signing secret** (whsec_...)

### Step 2: 配置 Webhook（Day 1 上午）

1. Stripe Dashboard → **Developers** → **Webhooks**
2. 点击 **Add an endpoint**
3. URL: `https://shenyuan.mylumee.cn/api/stripe-webhook`
4. 事件选择：
   - ✅ checkout.session.completed
   - ✅ checkout.session.expired
   - ✅ customer.subscription.created
   - ✅ invoice.payment_succeeded
   - ✅ invoice.payment_failed
   - ✅ customer.subscription.deleted
5. 复制 **Signing secret**

### Step 3: 更新环境变量（Day 1 下午）

```bash
# SSH 登录服务器
ssh -i ~/.ssh/key.pem root@47.242.80.65

# 编辑 .env.production
nano /www/shenyuan/server/.env

# 添加/修改以下内容
STRIPE_PAY_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
FRONTEND_URL=https://shenyuan.mylumee.cn
```

### Step 4: 部署代码（Day 1 下午）

```bash
# 在项目目录
cd /Users/karen/projects/shenyuan

# 确保已安装 stripe
npm install stripe

# 提交更新
git add server/routes/payment.js .env.example
git commit -m "stripe: add payment integration for phase-1 products"

# 推送到服务器
git push origin main

# SSH 登录服务器
ssh -i ~/.ssh/key.pem root@47.242.80.65

# 更新服务器代码
cd /www/shenyuan
git pull origin main
npm install

# 重启应用
pm2 restart shenyuan

# 验证日志
pm2 logs shenyuan --lines 20
```

### Step 5: 测试生产（Day 2）

```bash
# 从服务器日志查看 webhook 触发情况
pm2 logs shenyuan | grep -E "CHECKOUT|PAYMENT|STRIPE"

# 完整的 E2E 测试
# 1. 访问 https://shenyuan.mylumee.cn/pages/pricing.html
# 2. 选择产品 → 点击 "立即购买"
# 3. 完成 Stripe Checkout
# 4. 验证支付成功页
# 5. 验证用户能访问报告
```

---

## 📊 监控指标（Day 1 上线后）

### 关键指标

| 指标 | 目标 | 告警阈值 |
|------|------|---------|
| 支付成功率 | >95% | <90% |
| Webhook 成功率 | 100% | 任何失败 |
| 平均支付时长 | <30s | >60s |
| Stripe 可用性 | 99.9% | <99.5% |

### 监控命令

```bash
# 查看实时支付日志
pm2 logs shenyuan --lines 50 | grep PAYMENT

# 检查订单统计
curl -H "x-admin-token: $ADMIN_TOKEN" \
  https://shenyuan.mylumee.cn/api/orders | jq '.orders | length'

# 检查最近的错误
pm2 logs shenyuan --err --lines 30
```

---

## ⚠️ 常见问题与解决

### 问题 1: Webhook 返回 403

**原因**: `STRIPE_WEBHOOK_SECRET` 错误或未设置

**解决**:
```bash
# 验证 webhook secret（不能用测试环境的 secret）
echo $STRIPE_WEBHOOK_SECRET

# 确认是生产环境的 whsec_live_xxx
```

### 问题 2: 支付页显示错误货币

**原因**: 前端没有正确传递 `region` 参数

**解决**:
```javascript
// 前端代码确保传递
await fetch('/api/create-checkout', {
  body: JSON.stringify({
    product: 'bazi_full',
    region: 'kr'  // ← 确保正确
  })
})
```

### 问题 3: 订阅不自动续费

**原因**: 未配置 Stripe Billing（自动续费）

**解决**: Stripe Dashboard → **Billing** 已默认启用，无需额外配置

### 问题 4: 国内用户被识别为国际

**原因**: IP 地址识别失败

**解决**: 检查请求头
```javascript
// 在 payment.js 中验证
var ipCountry = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'];
console.log('[IP Country]', ipCountry);  // 调试输出
```

---

## 📱 前端产品页示例

### 定价页面模板（`pages/pricing.html`）

```html
<section class="pricing">
  <div class="price-card">
    <h3>完整命盤</h3>
    <p class="price">$19.90</p>
    <p class="desc">六維命盤 + 十年大運</p>
    <button onclick="buyProduct('bazi_full')">立即購買</button>
  </div>
  
  <div class="price-card featured">
    <h3>年度會員</h3>
    <p class="price">$39.90/年</p>
    <p class="desc">全部報告無限查閱</p>
    <button onclick="buyProduct('member_yearly')">立即購買</button>
  </div>
  
  <div class="price-card">
    <h3>月度會員</h3>
    <p class="price">$6.90/月</p>
    <p class="desc">隨時暫停</p>
    <button onclick="buyProduct('member_monthly')">立即購買</button>
  </div>
</section>

<script>
async function buyProduct(productId) {
  const res = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: productId,
      email: getUserEmail(),
      region: getRegion() // 'us', 'cn', 'kr'
    })
  });
  
  const { url, channel } = await res.json();
  
  if (channel === 'cn') {
    showCNPayment(productId);
  } else {
    window.location.href = url; // Stripe Checkout
  }
}
</script>
```

---

## ✅ 上线前检查清单

### 支付配置
- [ ] Stripe 生产账户已激活
- [ ] API Keys 已配置到 `.env.production`
- [ ] Webhook endpoint 已在 Stripe Dashboard 注册
- [ ] Webhook signing secret 已配置

### 代码审计
- [ ] `/server/routes/payment.js` 已审查（Stripe集成）
- [ ] `/server/lib/store.js` 产品定义完整
- [ ] 所有 Price IDs 与 Stripe Dashboard 一致
- [ ] Error handling 完整（404, 500 等）

### 前端验证
- [ ] 所有产品购买按钮正常工作
- [ ] 支付成功页显示正确
- [ ] 用户报告解锁逻辑正确
- [ ] 移动端响应式设计正常

### 数据安全
- [ ] API Keys 不暴露在前端
- [ ] Webhook 签名验证已启用
- [ ] 订单数据已加密存储
- [ ] 用户密钥无明文日志

### 监控告警
- [ ] PM2 日志监控配置
- [ ] Stripe 异常通知
- [ ] 支付失败邮件通知
- [ ] Webhook 处理异常告警

### 灰度测试（Day 2）
- [ ] 邀请 5-10 种子用户测试
- [ ] 验证所有支付路径（US/CN/KR）
- [ ] 确认订阅续费逻辑
- [ ] 检查 webhook 事件日志

---

## 📈 Phase 1 KPIs（Week 1）

| KPI | 目标 | 实现 |
|-----|------|------|
| 订单成功率 | >95% | - |
| Webhook 成功率 | 100% | - |
| 平均支付转化率 | 5-8% | - |
| 订阅留存率（Day 7） | >80% | - |
| 平均订单金额 | $15-20 | - |

---

## 🎯 Phase 2 产品（Week 3+）

一旦 Phase 1 稳定（支付成功率 >95%），加入：

| 产品 ID | 名称 | 价格 | 优先级 |
|---------|------|------|--------|
| hehun | 合婚配对 | $14.99 | P1 |
| report_unlock_a | 深度报告解锁 | $2.99 | P1 |
| report_unlock_b | 完整报告解锁 | $4.99 | P1 |
| member_quarterly | 季度会员 | $14.99 | P2 |
| member_3year | 三年会员 | $99.00 | P2 |

---

## 📞 技术支持

**Stripe 文档**: https://stripe.com/docs  
**Webhook 测试**: https://stripe.com/docs/webhooks/test  
**错误代码**: https://stripe.com/docs/error-codes

**团队联系**:
- Engineering: Claude Code
- Product: Karen CEO
- Finance: CFO

---

**版本历史**:
- v1.0 (2026-08-08): 初始版本，Phase 1 完整方案

