# 善缘 Stripe · 快速参考卡

**打印版**：保存到手机或打印贴在桌边  
**用途**：快速查询支付流程、Price IDs、关键字段

---

## 🎯 三种支付流程一览

### 1️⃣ 一次性购买 (One-Time Payment)

```
用户点击"购买" 
    ↓
POST /api/create-checkout
  product: "bazi_full"
  region: "us" | "kr" | (自动检测 CN)
    ↓
返回 Stripe Checkout URL
    ↓
用户完成支付
    ↓
🔔 checkout.session.completed
    ├─ order.payment_status = "completed"
    ├─ order.stripe_session_id = "cs_live_xxx"
    └─ order.expires_at = null (无过期时间)
    ↓
✅ hasFullAccess() = true (永久有效)
```

**Price ID 选择**（payment.js 第 157-172）：
```javascript
const isSubscription = ['member_monthly','member_yearly','member_quarterly','member_3year','member_daily'].includes(product);

if (isSubscription) mode = 'subscription';  // ← 递归计费
else mode = 'payment';                       // ← 一次性
```

---

### 2️⃣ 订阅支付 (Recurring Subscription)

```
用户点击"订阅"
    ↓
POST /api/create-checkout
  product: "member_monthly"
  mode: "subscription"
    ↓
返回 Stripe Checkout URL (订阅模式)
    ↓
用户完成支付 + 授权自动续费
    ↓
🔔 checkout.session.completed
  subscription: "sub_1TzAjKEAXrE2Ygcr9999"
    ├─ order.payment_status = "completed"
    ├─ order.stripe_subscription_id = "sub_xxx"
    └─ order.expires_at = "2026-09-08T14:00:00Z"
    ↓
🔔 customer.subscription.created
    ├─ record subscription in _M.subs
    └─ order.expires_at = next billing date
    ↓
✅ hasFullAccess() = true (直到 expires_at)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[30 天后/1 年后]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓
🔔 invoice.payment_succeeded (续费成功)
    ├─ order.expires_at = next period end
    ├─ 邮件通知："续费成功"
    └─ ✅ 权限继续有效
    
    或
    
🔔 invoice.payment_failed (续费失败)
    ├─ order.expires_at = now() (立即过期)
    ├─ 邮件通知："续费失败，请更新支付方式"
    └─ ❌ hasFullAccess() = false (失权)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[用户主动取消]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓
🔔 customer.subscription.deleted
    ├─ order.payment_status = "cancelled"
    └─ order.expires_at = now() (立即过期)
    ↓
❌ hasFullAccess() = false (失权)
```

---

## 💳 定价矩阵 (CN/EN/KR)

### 一次性产品

| Product | USD | CNY | KRW | Price ID (USD) |
|---------|-----|-----|-----|----------------|
| bazi_basic | $9.90 | ¥19.90 | ₩29,900 | price_XXXXX |
| bazi_full | $19.90 | ¥99.90 | ₩29,900 | price_1TzAj... |
| bazi_vip | $39.90 | ¥199.90 | ₩49,900 | price_XXXXX |
| saju_kr_full | $19.90 | - | ₩29,900 | price_1TzrG... |
| hehun | $14.99 | ¥99.90 | ₩49,900 | price_XXXXX |

### 订阅产品

| Product | USD/mo | CNY/mo | KRW/mo | Billing | Price ID (USD) |
|---------|--------|--------|--------|---------|----------------|
| member_monthly | $6.90 | ¥19.90 | ₩12,900 | monthly | price_1TzAj... |
| member_quarterly | $14.99 | ¥69.90 | ₩49,900 | 3-month | price_1U0Bw... |
| member_yearly | $39.90 | ¥199.90 | ₩129,900 | yearly | price_1TzAjQ... |
| member_3year | $99.90 | ¥399.90 | ₩349,900 | 3-year | price_XXXXX |

**汇率参考**: 1 USD ≈ 7.2 CNY ≈ 1,300 KRW

---

## 🔑 Price IDs 快速查询

### ✅ 已创建（生产就绪）

```
bazi_full USD:            price_1TzAjGEAXrE2YgcrRzUY78Ko
member_monthly USD:       price_1TzAjGEAXrE2YgcrRzUY78Ko
member_yearly USD:        price_1TzAjQEAXrE2YgcrHYurEL8Z
member_quarterly USD:     price_1U0BwvEAXrE2YgcrTU0PFGZm
saju_kr_full KRW:         price_1TzrGREAXrE2Ygcr1dOkiv2O
member_monthly_krw:       price_1TzrGWEAXrE2YgcrhrIIeMXC
```

### ⏳ 待创建（需在 Stripe Dashboard 创建）

```
bazi_basic (USD/CNY/KRW)
bazi_vip (USD/CNY/KRW)
hehun (USD/CNY/KRW)
member_quarterly (CNY/KRW)
member_yearly (CNY/KRW)
member_3year (USD/CNY/KRW)
saju_kr_full_usd
joss_basic (USD/CNY)
joss_premium (USD/CNY)
```

**创建命令**（Stripe CLI）：
```bash
stripe prices create \
  --unit-amount=1990 \
  --currency=cny \
  --product-data.name="基础命盤"
```

---

## 📍 地理位置 → 货币路由

| IP Country | Currency | Payment Method | Price ID Suffix | Channel |
|-----------|----------|-----------------|------------------|---------|
| CN | CNY | 微信/支付宝 | _cny | cn |
| KR | KRW | Stripe Card | _krw | stripe |
| Other | USD | Stripe Card | (none) | stripe |

**自动检测代码**（payment.js 第 129-144）：
```javascript
var ipCountry = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '';

if (ipCountry === 'CN') {
  return res.json({ channel: 'cn', amountCny: ... });
}

const isKR = req.body.region === 'kr';
const payCurrency = isKR ? 'krw' : 'usd';
```

---

## 🔔 Webhook 事件处理速查

| Event | Trigger | Action | Key Update |
|-------|---------|--------|-----------|
| `checkout.session.completed` | 支付完成 | `_updOrder('completed')` | `payment_status` |
| `customer.subscription.created` | 订阅创建 | `_insSub()`, `_setOrExtendSub()` | `expires_at` |
| `invoice.payment_succeeded` | 续费成功 | `_setOrExtendSub()` | `expires_at` = 新周期 |
| `invoice.payment_failed` | 续费失败 | `_setOrExtendSub()`, email | `expires_at` = now() |
| `customer.subscription.deleted` | 取消订阅 | `_updOrder('cancelled')` | `expires_at` = now() |
| `checkout.session.expired` | 支付链接过期 | `_updOrder('expired')` | `payment_status` |

**全部都需要验证 Webhook 签名**：
```javascript
event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
```

---

## ✅ hasFullAccess() 判断逻辑

**位置**: `server/lib/store.js` 第 175-200

```javascript
function hasFullAccess(req, productKeys) {
  // Step 1: 解析 token
  const token = extractToken(req);
  if (!token) return false;
  
  // Step 2: 获取用户所有已支付订单
  const orders = getUserOrders.all(userId);
  
  // Step 3: 逐个检查订单
  return orders.some(order => {
    // 🔴 关键：检查是否过期
    if (_isExpired(order)) return false;
    
    // 🟢 检查产品是否在白名单中
    return productKeys.some(key =>
      UNLOCK_BY_CATEGORY[key]?.includes(order.product)
    );
  });
}

function _isExpired(order) {
  if (!order.expires_at) return false;  // 一次性购买无过期
  return Date.parse(order.expires_at) < Date.now();  // 订阅过期?
}
```

**关键点**：
- ✅ 订阅过期 → 自动失权（无需手动操作）
- ✅ 每次访问报告时实时检查
- ✅ 续费失败 → `expires_at = now()` → 立即失权

---

## 🚨 常见问题速解

### Q1: Webhook 返回 403?
**A**: `STRIPE_WEBHOOK_SECRET` 错误或未设置
```bash
ssh root@47.242.80.65
grep STRIPE_WEBHOOK_SECRET /www/shenyuan/server/.env
# 必须是 whsec_live_xxx (不能是测试的 whsec_test_xxx)
```

### Q2: 支付页显示"支付系统暂未开通"?
**A**: `STRIPE_PAY_SECRET_KEY` 未配置
```bash
ssh root@47.242.80.65
nano /www/shenyuan/server/.env
# 添加: STRIPE_PAY_SECRET_KEY=sk_live_xxxxx
pm2 restart shenyuan
```

### Q3: 用户支付后无法访问报告?
**A**: hasFullAccess() 返回 false（token 问题或过期）
```bash
# 检查订单记录
curl -H "x-admin-token: $ADMIN_TOKEN" \
  https://shenyuan.mylumee.cn/api/orders/mine

# 检查 payment_status 是否为 'completed'
# 订阅还要检查 expires_at > now()
```

### Q4: 订阅不自动续费?
**A**: invoice.payment_succeeded webhook 未处理
```bash
pm2 logs shenyuan | grep "invoice.payment_succeeded"

# 如果没有，检查：
# 1. Webhook 是否配置正确 (Dashboard → Webhooks)
# 2. 用户支付方式是否过期
# 3. Stripe Billing 是否启用 (默认启用)
```

---

## 📊 数据库订单字段速查

```json
{
  "id": 1,
  "order_no": "SY-1691234567-abc123",
  "product": "member_monthly",           // 产品 ID
  "amount": 690,                        // 金额（分）
  "currency": "usd",                    // 货币
  "user_id": 42,                        // 用户 ID（可为 null）
  "payment_status": "completed",        // pending | completed | cancelled | expired
  "stripe_session_id": "cs_live_xxx",   // Checkout Session ID
  "stripe_subscription_id": "sub_xxx",  // 订阅 ID（仅订阅产品）
  "expires_at": "2026-09-08T14:00:00Z", // 过期时间（仅订阅）
  "created_at": "2026-08-08T14:00:00Z", // 创建时间
  "paid_at": "2026-08-08T14:01:00Z"     // 支付时间
}
```

**关键字段说明**：
- `payment_status = 'completed'` → 支付已成功
- `expires_at = null` → 一次性购买（永不过期）
- `expires_at < now()` → 订阅已过期（无权限）

---

## 🔗 环境变量清单

```bash
# 生产环境必需 (.env.production)
STRIPE_PAY_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
FRONTEND_URL=https://shenyuan.mylumee.cn

# 可选
STRIPE_TEST_SECRET_KEY=sk_test_xxxxx    (测试用)
STRIPE_TEST_WEBHOOK_SECRET=whsec_test_xxx
```

**验证命令**：
```bash
# SSH 登录
ssh root@47.242.80.65
cat /www/shenyuan/server/.env | grep STRIPE
```

---

## 📱 常用命令

```bash
# 查看实时支付日志
pm2 logs shenyuan | grep -E "PAYMENT|WEBHOOK"

# 查看特定订单
grep "SY-1691234567" /www/shenyuan/server/data.json | jq .

# 查看过期订阅
cat /www/shenyuan/server/data.json | jq '.orders[] | select(.expires_at != null)'

# 检查错误
pm2 logs shenyuan --err

# 重启应用
pm2 restart shenyuan

# Stripe CLI：查看订阅
stripe subscriptions retrieve sub_1TzAjKEAXrE2Ygcr9999
```

---

## 📞 快速链接

| Resource | URL |
|----------|-----|
| Stripe Dashboard | https://dashboard.stripe.com |
| Stripe Docs | https://stripe.com/docs |
| Webhook Test | https://stripe.com/docs/webhooks/test |
| Error Codes | https://stripe.com/docs/error-codes |
| Price API | https://stripe.com/docs/api/prices |

---

## 🎯 上线前最后检查

- [ ] STRIPE_PRICE_IDS 所有 ID 已填入
- [ ] PRODUCTS 所有产品已有 amountCny/amountKrw
- [ ] STRIPE_PAY_SECRET_KEY/WEBHOOK_SECRET 已设置
- [ ] Webhook endpoint 已在 Dashboard 配置 (6 个事件)
- [ ] 一次性购买测试通过 (USD)
- [ ] 订阅支付测试通过 (3-month billing cycle)
- [ ] 国内用户路由测试 (IP = CN)
- [ ] 韩国用户路由测试 (region = kr)
- [ ] Webhook 日志正常（pm2 logs shenyuan | grep WEBHOOK）

**成功标志**：✅ 所有复选框都打勾

---

**最后更新**: 2026-08-08  
**维护者**: Claude Code  
**打印版**: A4 横向，保存为 PDF

