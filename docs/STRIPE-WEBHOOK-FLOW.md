# 善缘 Stripe Webhook 完整流程文档

**目标**：理解支付成功、续费、失败、取消的完整事件链  
**使用者**：Backend Engineer，用于调试和监控

---

## 📊 Webhook 事件全景图

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                   用户支付流程 + Webhook 事件链                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

客户端                          Stripe 服务器                        我们的后端
  │                                 │                                   │
  ├─ 1. 点击"购买"按钮               │                                   │
  │     POST /api/create-checkout   │                                   │
  ├─────────────────────────────────>│                                   │
  │                                 │  2. 创建 Checkout Session        │
  │                                 ├──────────────────────────────────>│
  │                                 │   insertOrder('SY-xxx', 'pending') │
  │                                 │                                   │
  │   3. 返回 Stripe Checkout URL  │<──────────────────────────────────┤
  │<─────────────────────────────────┤                                   │
  │                                 │                                   │
  ├─ 4. 跳转到支付页面               │                                   │
  ├─────────────────────────────────>│                                   │
  │                                 │ 5. 用户填写卡号、确认支付         │
  │                                 │                                   │
  │   6. 支付成功/失败               │                                   │
  │<─────────────────────────────────┤                                   │
  │                                 │                                   │
  │                                 │ 7. [WEBHOOK] checkout.session.   │
  │                                 │    completed 事件触发             │
  │                                 ├──────────────────────────────────>│
  │                                 │                                   │
  │                                 │    ✅ _updOrder('completed')      │
  │                                 │    ✅ order.payment_status =     │
  │                                 │       'completed'                 │
  │   8. 重定向到成功页              │    ✅ 落盘到 data.json           │
  │<─────────────────────────────────┤                                   │
  │                                 │                                   │
  │ 9. 显示"功德圆满"页面             │                                   │
  │                                 │ 10. [WEBHOOK] (订阅产品时)       │
  │    user.hasFullAccess() = ✅    │     customer.subscription.created│
  │                                 ├──────────────────────────────────>│
  │                                 │                                   │
  │                                 │    ✅ _insSub(email, sub_id)      │
  │                                 │    ✅ _setOrExtendSub(           │
  │                                 │       product,                    │
  │                                 │       email,                      │
  │                                 │       expires_at)                 │
  │                                 │                                   │
  │                                 │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
  │                                 │  [30 天后] 自动续费开始            │
  │                                 │                                   │
  │                                 │ 11. [WEBHOOK] invoice.payment_  │
  │                                 │     succeeded (续费成功)           │
  │                                 ├──────────────────────────────────>│
  │                                 │                                   │
  │                                 │    ✅ _setOrExtendSub(            │
  │                                 │       expires_at = 下个周期结束时间│
  │                                 │                                   │
  │                                 │ 邮件通知："续费成功"               │
  │                                 │                                   │
  │  [如果续费失败]                  │                                   │
  │                                 │ 12. [WEBHOOK] invoice.payment_  │
  │                                 │     failed (续费失败)             │
  │                                 ├──────────────────────────────────>│
  │                                 │                                   │
  │                                 │    ✅ order.expires_at = now()   │
  │                                 │    ✅ 用户失去权限                │
  │                                 │                                   │
  │                                 │ 邮件通知："续费失败，请更新支付  │
  │                                 │           方式"                   │
```

---

## 🔄 Event 1：一次性购买流程

### 事件序列

```javascript
// ┌─────────────────────────────────────────────────┐
// │ 事件 1.1: checkout.session.completed            │
// │ （一次性购买 / 订阅首次）                        │
// └─────────────────────────────────────────────────┘

event.type = 'checkout.session.completed'
event.data.object = {
  id: 'cs_live_xxx',
  payment_intent: 'pi_live_xxx',
  subscription: 'sub_xxx',  // ← 仅订阅产品有
  mode: 'payment' | 'subscription',
  amount_total: 1990,
  currency: 'usd',
  customer_email: 'user@example.com',
  metadata: {
    order_no: 'SY-1691234567-abc123',
    product: 'bazi_full',
    donor_name: '',
    contact: ''
  }
}

// ↓ 后端处理（payment.js 第 216-238 行）

_updOrder('completed', orderNo);  // ← 标记订单已支付
completeAffiliateOrder(orderNo);  // ← 佣金处理

// 如果是订阅产品，获取订阅详情
if (subId && stripe) {
  stripe.subscriptions.retrieve(subId).then(sub => {
    // 提取续费周期
    const periodEnd = sub.current_period_end * 1000;  // Unix时间戳 → ms
    _updOrderExpiry(orderNo, new Date(periodEnd).toISOString());
  });
}

console.log(`[PAYMENT] ${orderNo} — completed`);
```

**关键数据库变化**：
```json
{
  "order_no": "SY-1691234567-abc123",
  "product": "bazi_full",
  "payment_status": "completed",  // ← "pending" → "completed"
  "stripe_session_id": "cs_live_xxx",
  "expires_at": "2026-09-08T12:34:56Z"  // ← 仅订阅产品有
}
```

---

## 🔄 Event 2-3：订阅创建与扩展

### 事件序列

```javascript
// ┌──────────────────────────────────────────────────────┐
// │ 事件 2: customer.subscription.created                │
// │ （新订阅创建，Stripe 首次发送）                       │
// └──────────────────────────────────────────────────────┘

event.type = 'customer.subscription.created'
event.data.object = {
  id: 'sub_1TzAjKEAXrE2Ygcr9999',  // ← 订阅 ID
  customer: 'cus_xxx',
  customer_email: 'user@example.com',
  status: 'active',
  current_period_start: 1691234567,    // ← Unix 时间戳
  current_period_end: 1693912967,      // ← 下个续费日期
  items: {
    data: [{
      price: { id: 'price_1TzAjGEAXrE2YgcrRzUY78Ko' },
      quantity: 1
    }]
  }
}

// ↓ 后端处理（payment.js 第 246-271 行）

_insSub(email, subId);  // ← 记录订阅关系

_setOrExtendSub(
  productId,  // 通过 product name 反推
  email,
  new Date(current_period_end * 1000).toISOString()
);

console.log('[SUB] created subId=' + subId);

// ┌──────────────────────────────────────────────────────┐
// │ 事件 3: invoice.payment_succeeded                    │
// │ （续费成功，每月/年自动触发）                         │
// └──────────────────────────────────────────────────────┘

event.type = 'invoice.payment_succeeded'
event.data.object = {
  id: 'in_1TzAjKEAXrE2YgcrXXXX',
  subscription: 'sub_1TzAjKEAXrE2Ygcr9999',
  customer_email: 'user@example.com',
  amount_paid: 690,  // USD cents
  currency: 'usd',
  current_period_end: 1696591367,  // ← 新的续费周期结束时间
  paid: true,
  status: 'paid'
}

// ↓ 后端处理

_setOrExtendSub(
  productId,
  email,
  new Date(current_period_end * 1000).toISOString()
);

console.log(`[RENEWAL] ${email} 续费成功，下期：${current_period_end}`);

// 可选：发送续费成功邮件
sendEmail({
  to: email,
  subject: '善缘会员续费成功',
  html: `<p>感谢您继续支持善缘。</p>`
});
```

**关键数据库变化（续费）**：
```json
{
  "order_no": "SY-SUB-xxx",
  "product": "member_monthly",
  "payment_status": "completed",
  "contact": "user@example.com",
  "expires_at": "2026-09-08T12:34:56Z"  // ← 更新为新周期结束时间
}
```

---

## 🚨 Event 4-5：支付失败与订阅取消

### 失败场景 A：续费失败

```javascript
// ┌──────────────────────────────────────────────────────┐
// │ 事件 4: invoice.payment_failed                       │
// │ （续费失败，用户卡被拒/余额不足等）                   │
// └──────────────────────────────────────────────────────┘

event.type = 'invoice.payment_failed'
event.data.object = {
  id: 'in_1TzAjKEAXrE2YgcrYYYY',
  subscription: 'sub_1TzAjKEAXrE2Ygcr9999',
  customer_email: 'user@example.com',
  amount_due: 690,
  currency: 'usd',
  reason: 'card_declined',  // 卡被拒
  status: 'open'
}

// ↓ 后端处理（payment.js 第 274-295 行）

// 查找关联的订单，标记为已过期（失效）
const orders = _M.orders.filter(o =>
  o.stripe_subscription_id === subId
);

orders.forEach(o => {
  o.expires_at = new Date().toISOString();  // ← 立即过期
  o.payment_status = 'completed';  // ← 保留为 completed（以便追踪）
});

_persist();

// 发送续费失败邮件
sendEmail({
  to: email,
  subject: '善缘会员续费失败 — 请更新支付方式',
  html: `
    <div style="font-family:serif;max-width:480px;margin:0 auto">
      <h2>善缘 · 续费提醒</h2>
      <p>您好，您的善缘会员订阅续费未能成功处理。</p>
      <p>为避免会员权益中断，请点击下方按钮更新支付方式：</p>
      <a href="https://shenyuan.mylumee.cn/pages/member.html">
        更新支付方式 →
      </a>
      <p style="font-size:11px;color:#999">
        如您已取消订阅，请忽略此邮件。
      </p>
    </div>
  `
});

console.log('[PAYMENT FAILED]', {
  email,
  reason: 'card_declined',
  expires_at: new Date().toISOString()
});
```

**关键数据库变化（失败）**：
```json
{
  "order_no": "SY-SUB-xxx",
  "payment_status": "completed",  // ← 保留以追踪历史
  "expires_at": "2026-08-08T13:25:34Z"  // ← 立即设为现在（失效）
}
```

**用户权限检查**：
```javascript
function hasFullAccess(req, productKeys) {
  // ...
  return orders.some(order => {
    // 检查是否过期
    if (_isExpired(order)) return false;  // ← 续费失败后无权限
    
    // 检查产品白名单
    return productKeys.some(key =>
      UNLOCK_BY_CATEGORY[key]?.includes(order.product)
    );
  });
}

function _isExpired(order) {
  if (!order.expires_at) return false;
  return Date.parse(order.expires_at) < Date.now();  // ← True 表示已过期
}
```

---

### 失败场景 B：用户主动取消订阅

```javascript
// ┌──────────────────────────────────────────────────────┐
// │ 事件 5: customer.subscription.deleted                │
// │ （用户/管理员取消订阅）                               │
// └──────────────────────────────────────────────────────┘

event.type = 'customer.subscription.deleted'
event.data.object = {
  id: 'sub_1TzAjKEAXrE2Ygcr9999',
  customer_email: 'user@example.com',
  canceled_at: 1691234567,
  ended_at: 1691234567,  // ← 立即生效，或在 cancel_at_period_end 时生效
  status: 'canceled'
}

// ↓ 后端处理（payment.js 第 273-295 行）

const orders = _M.orders.filter(o =>
  o.stripe_subscription_id === subId
);

orders.forEach(o => {
  o.expires_at = new Date().toISOString();  // ← 立即过期
  o.payment_status = 'cancelled';  // ← 标记为已取消
});

_persist();

console.log(`[CANCELLED] Subscription ${subId}`);
```

**关键数据库变化（取消）**：
```json
{
  "order_no": "SY-SUB-xxx",
  "payment_status": "cancelled",  // ← "completed" → "cancelled"
  "expires_at": "2026-08-08T13:25:34Z"
}
```

---

## ⏱️ 时间线示例

### 场景：用户订阅年度会员

```
Day 1 (订阅首日)
  ├─ 14:00 用户点击"立即购买"
  ├─ 14:01 POST /api/create-checkout → 插入订单（payment_status='pending'）
  ├─ 14:02 用户完成支付
  ├─ 14:03 [WEBHOOK] checkout.session.completed
  │   └─ _updOrder('completed')
  │   └─ order.payment_status = 'completed'
  ├─ 14:04 [WEBHOOK] customer.subscription.created
  │   └─ _setOrExtendSub(..., expires_at='2027-08-08T14:00:00Z')
  ├─ 14:05 用户访问报告
  │   └─ hasFullAccess() → True（检查 expires_at 未过期）
  │   └─ 报告解锁显示

Day 365 (自动续费)
  ├─ 约 08-08 14:00 Stripe 尝试续费
  ├─ 14:01 [WEBHOOK] invoice.payment_succeeded（续费成功）
  │   └─ _setOrExtendSub(..., expires_at='2028-08-08T14:00:00Z')
  │   └─ order.expires_at 更新为 1 年后
  ├─ 14:02 邮件通知："续费成功"
  ├─ 14:03 用户继续享受权益

Day 380 (用户主动取消)
  ├─ 用户访问会员页 → 点"取消订阅"
  ├─ 前端调用 POST /api/manage-sub/cancel
  ├─ 后端调用 stripe.subscriptions.update(subId, {cancel_at_period_end: true})
  ├─ Stripe 标记订阅在周期结束时取消
  │
  └─ Day 365（周期结束）
    ├─ 08-08 14:00 Stripe 触发 customer.subscription.deleted
    ├─ [WEBHOOK] customer.subscription.deleted
    │   └─ _updOrder('cancelled')
    │   └─ order.expires_at = now()
    ├─ 邮件通知："订阅已取消"
    ├─ 用户访问报告
    │   └─ hasFullAccess() → False（expires_at 已过期）
    │   └─ 报告锁定
```

---

## 🔍 调试命令

### 查看 webhook 日志

```bash
# 实时查看
pm2 logs shenyuan | grep -E "WEBHOOK|PAYMENT"

# 保存到文件
pm2 logs shenyuan > /tmp/shenyuan.log 2>&1

# 搜索特定 order
grep "SY-1691234567" /tmp/shenyuan.log

# 查看错误
pm2 logs shenyuan --err | grep -E "WEBHOOK|STRIPE"
```

### 验证订阅状态（Stripe CLI）

```bash
# 查看订阅信息
stripe subscriptions retrieve sub_1TzAjKEAXrE2Ygcr9999

# 查看 invoice 历史
stripe invoices list --subscription sub_1TzAjKEAXrE2Ygcr9999 --limit 10

# 查看客户信息
stripe customers retrieve cus_xxx
```

### 验证数据库订单

```bash
# SSH 登录服务器
ssh root@47.242.80.65

# 查看订单
cat /www/shenyuan/server/data.json | jq '.orders | map(select(.order_no == "SY-xxx"))'

# 检查过期时间
cat /www/shenyuan/server/data.json | jq '.orders | map(select(.expires_at != null))'
```

---

## ✅ Webhook 处理检查清单

当接收到 webhook 事件时，确保：

- [ ] **签名验证**：调用 `stripe.webhooks.constructEvent()` 验证 `stripe-signature` header
- [ ] **错误处理**：Try-catch 包装所有数据库操作
- [ ] **幂等性**：同一事件多次接收不会重复处理（使用 event.id 去重）
- [ ] **原子性**：订单更新 + 落盘必须在同一事务内完成（使用 `_persist()`）
- [ ] **日志记录**：记录所有重要状态转换（payment_status, expires_at）
- [ ] **邮件通知**：订阅/续费/失败时发送对应邮件
- [ ] **监控告警**：Sentry/告警系统捕获处理异常

---

## 📊 关键字段映射

| Stripe 字段 | 本地字段 | 说明 |
|----------|--------|------|
| `checkout.session.id` | `stripe_session_id` | 支付会话 ID |
| `subscription.id` | `stripe_subscription_id` | 订阅 ID（仅订阅产品） |
| `current_period_end` | `expires_at` | 下个续费日期（Unix → ISO 8601） |
| `payment_status` | `payment_status` | pending → completed → cancelled |
| `customer_email` | `contact` | 用户邮箱（用于唯一标识订阅） |

---

**版本**：1.0 (2026-08-08)
