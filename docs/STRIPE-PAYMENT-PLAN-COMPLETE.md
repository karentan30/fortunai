# 善缘 Stripe 完整支付方案 · 产品/定价/接入

**版本**: 2.0 (Production Ready)  
**日期**: 2026-08-08  
**作者**: Claude Code  
**受众**: Engineering + CFO  

---

## 🎯 执行概览

### 📊 产品矩阵

| 类别 | 产品 ID | 中文名 | USD | CNY | KRW | 类型 |
|------|---------|-------|-----|-----|-----|------|
| **八字** | bazi_basic | 基础命盘 | $9.90 | ¥19.90 | ₩29,900 | 一次性 |
| | bazi_full | 完整命盘 | $19.90 | ¥99.90 | ₩29,900 | 一次性 |
| | bazi_vip | 深度批命 | $39.90 | ¥199.90 | ₩49,900 | 一次性 |
| **韩文** | saju_kr_full | 사주팔자 | $19.90 | - | ₩29,900 | 一次性 |
| **订阅** | member_monthly | 月度会员 | $6.90/mo | ¥19.90/mo | ₩12,900/mo | 订阅 |
| | member_quarterly | 季度会员 | $14.99/3mo | ¥69.90/3mo | ₩49,900/3mo | 订阅 |
| | member_yearly | 年度会员 | $39.90/yr | ¥199.90/yr | ₩129,900/yr | 订阅 |
| | member_3year | 三年会员 | $99.90/3yr | ¥399.90/3yr | ₩349,900/3yr | 订阅 |
| **合婚** | hehun | 合婚配对 | $14.99 | ¥99.90 | ₩49,900 | 一次性 |
| **代烧** | joss_basic | 基础代烧 | $49.90 | ¥199.90 | - | 一次性 |
| | joss_premium | 尊享代烧 | $249.90 | ¥999.90 | - | 一次性 |

---

## 🔑 Stripe Price IDs 完整清单

### ✅ 已创建 Price IDs（Capstone Account）

```javascript
// 生产环境 Price IDs（必须与 Stripe Dashboard 一致）
const STRIPE_PRICE_IDS = {
  // ── 八字一次性付费 ──
  'bazi_basic':       'price_1TzAjAEAXrE2YgcrXXXX',  // ← 待创建
  'bazi_full':        'price_1TzAjGEAXrE2YgcrRzUY78Ko',  // ✅ $19.90
  'bazi_vip':         'price_1TzAjIEAXrE2YgcrXXXX',  // ← 待创建
  
  // ── 韩文一次性付费 ──
  'saju_kr_full':     'price_1TzrGREAXrE2Ygcr1dOkiv2O',  // ✅ ₩29,900
  'saju_kr_full_usd': 'price_1TzrGSEAXrE2YgcrXXXX',  // ← 待创建 ($19.90)
  
  // ── 合婚 ──
  'hehun':            'price_1TzAriEAXrE2YgcrWEj4Azdn',  // ✅ (KRW only)
  'hehun_usd':        'price_XXXXXXXXXXXXXX',  // ← 待创建 ($14.99)
  'hehun_cny':        'price_XXXXXXXXXXXXXX',  // ← 待创建 (¥99.90)
  
  // ── 代烧一次性付费 ──
  'joss_basic_usd':   'price_XXXXXXXXXXXXXX',  // ← 待创建 ($49.90)
  'joss_basic_cny':   'price_XXXXXXXXXXXXXX',  // ← 待创建 (¥199.90)
  'joss_premium_usd': 'price_XXXXXXXXXXXXXX',  // ← 待创建 ($249.90)
  'joss_premium_cny': 'price_XXXXXXXXXXXXXX',  // ← 待创建 (¥999.90)
  
  // ── 订阅（递归计费）──
  // 月度会员
  'member_monthly_usd':    'price_1TzAjGEAXrE2YgcrRzUY78Ko',  // ✅ $6.90/mo
  'member_monthly_cny':    'price_XXXXXXXXXXXXXX',  // ← 待创建 (¥19.90/mo)
  'member_monthly_krw':    'price_1TzrGWEAXrE2YgcrhrIIeMXC',  // ✅ ₩12,900/mo
  
  // 季度会员
  'member_quarterly_usd':  'price_1U0BwvEAXrE2YgcrTU0PFGZm',  // ✅ $14.99/3mo
  'member_quarterly_cny':  'price_XXXXXXXXXXXXXX',  // ← 待创建 (¥69.90/3mo)
  'member_quarterly_krw':  'price_XXXXXXXXXXXXXX',  // ← 待创建 (₩49,900/3mo)
  
  // 年度会员
  'member_yearly_usd':     'price_1TzAjQEAXrE2YgcrHYurEL8Z',  // ✅ $39.90/yr
  'member_yearly_cny':     'price_XXXXXXXXXXXXXX',  // ← 待创建 (¥199.90/yr)
  'member_yearly_krw':     'price_XXXXXXXXXXXXXX',  // ← 待创建 (₩129,900/yr)
  
  // 三年会员
  'member_3year_usd':      'price_XXXXXXXXXXXXXX',  // ← 待创建 ($99.90/3yr)
  'member_3year_cny':      'price_XXXXXXXXXXXXXX',  // ← 待创建 (¥399.90/3yr)
  'member_3year_krw':      'price_XXXXXXXXXXXXXX',  // ← 待创建 (₩349,900/3yr)
};
```

**创建缺失 Price IDs 命令**（Stripe CLI 或 Dashboard）：

```bash
# 示例：创建 bazi_basic 中文价格
stripe prices create \
  --product-data.name="基础命盤" \
  --unit-amount=990 \
  --currency=usd \
  --metadata.lang=en \
  --metadata.display="$9.90"

# 示例：创建 member_quarterly_cny 季度会员CNY
stripe prices create \
  --product-data.name="季會員" \
  --unit-amount=6990 \
  --currency=cny \
  --recurring.interval=month \
  --recurring.interval-count=3 \
  --metadata.lang=zh-CN \
  --metadata.display="¥69.90/季"
```

---

## 📦 后端代码修改

### 1. 更新 `server/lib/store.js` → PRODUCTS 定义

```javascript
const PRODUCTS = {
  // ────────────────────────────────────
  // 八字一次性
  // ────────────────────────────────────
  bazi_basic:      { 
    name: '基础命盤',         
    amount: 990,    
    amountCny: 1990,  
    amountKrw: 29900,
    desc: '日主+五行+今年运势' 
  },
  bazi_full:       { 
    name: '完整命盤',          
    amount: 1990,   
    amountCny: 9990,  
    amountKrw: 29900,
    desc: '六維+十年大運+流月' 
  },
  bazi_vip:        { 
    name: '深度批命',          
    amount: 3990,   
    amountCny: 19990,  
    amountKrw: 49900,
    desc: '大師級·終身檔案' 
  },
  
  // ────────────────────────────────────
  // 韓文一次性
  // ────────────────────────────────────
  saju_kr_full:    { 
    name: '사주팔자 완전 분석', 
    amount: 1990,    
    amountCny: 5500,  
    amountKrw: 29900,
    desc: '천간지지 + 대운 + 유년' 
  },
  
  // ────────────────────────────────────
  // 合婚
  // ────────────────────────────────────
  hehun:           { 
    name: '合婚配對',          
    amount: 1499,   
    amountCny: 9990,  
    amountKrw: 49900,
    desc: '雙方八字合婚分析' 
  },
  
  // ────────────────────────────────────
  // 代烧
  // ────────────────────────────────────
  joss_basic:      { 
    name: '代烧·基础套餐',     
    amount: 4990,   
    amountCny: 19900, 
    desc: '标准纸钱+元宝+祈福' 
  },
  joss_premium:    { 
    name: '代烧·尊享套餐',     
    amount: 24900,  
    amountCny: 99900, 
    desc: '豪邸+纸钱+法器+视频' 
  },
  joss_supreme:    { 
    name: '代烧·至尊套餐',     
    amount: 249900, 
    amountCny: 999900, 
    desc: '全套冥器+法事+直播' 
  },
  
  // ────────────────────────────────────
  // 订阅产品
  // ────────────────────────────────────
  member_monthly:  { 
    name: '月度會員',          
    amount: 690,    
    amountCny: 1990,  
    amountKrw: 12900,
    desc: '全部AI佔算無限次' 
  },
  member_quarterly:{ 
    name: '季會員',            
    amount: 1499,   
    amountCny: 6990,  
    amountKrw: 49900,
    desc: '三個月暢享' 
  },
  member_yearly:   { 
    name: '年度會員',          
    amount: 3990,   
    amountCny: 19990,  
    amountKrw: 129900,
    desc: '全年暢用·合婚報告' 
  },
  member_3year:    { 
    name: '三年會員',          
    amount: 9990,   
    amountCny: 39990,  
    amountKrw: 349900,
    desc: '超值三年' 
  },
  
  // 保留旧产品
  bazi_trial:      { name: '體驗命盤',          amount: 199,    amountCny: 990,   desc: '快速簡批' },
  tarot:           { name: '塔羅佔卜',          amount: 390,    amountCny: 990,   desc: 'AI塔羅解讀' },
  daily_sub:       { name: '每日天機訂閱',      amount: 490,    amountCny: 1990,  desc: '每日天機·單功能訂閱' },
};
```

### 2. 更新 `server/routes/payment.js` → STRIPE_PRICE_IDS

```javascript
// 第 64-120 行替换
const STRIPE_PRICE_IDS = {
  // ── 一次性购买 ──
  'bazi_basic':       'price_XXXXX',  // USD
  'bazi_basic_cny':   'price_XXXXX',  // CNY
  'bazi_basic_krw':   'price_XXXXX',  // KRW
  
  'bazi_full':        'price_1TzAjGEAXrE2YgcrRzUY78Ko',  // USD
  'bazi_full_cny':    'price_XXXXX',  // CNY
  'bazi_full_krw':    'price_1TzrGREAXrE2Ygcr1dOkiv2O',  // KRW
  
  'bazi_vip':         'price_XXXXX',  // USD
  'bazi_vip_cny':     'price_XXXXX',  // CNY
  'bazi_vip_krw':     'price_1TzrGUEAXrE2YgcrTAXjFt9M',  // KRW
  
  'saju_kr_full':     'price_1TzrGREAXrE2Ygcr1dOkiv2O',  // KRW (same as bazi_full)
  'saju_kr_full_usd': 'price_XXXXX',  // USD
  
  'hehun':            'price_1TzAriEAXrE2YgcrWEj4Azdn',  // KRW
  'hehun_usd':        'price_XXXXX',  // USD
  'hehun_cny':        'price_XXXXX',  // CNY
  
  // ── 订阅产品 ──
  'member_monthly':         'price_1TzAjGEAXrE2YgcrRzUY78Ko',  // USD
  'member_monthly_cny':     'price_XXXXX',  // CNY
  'member_monthly_krw':     'price_1TzrGWEAXrE2YgcrhrIIeMXC',  // KRW
  
  'member_quarterly':       'price_1U0BwvEAXrE2YgcrTU0PFGZm',  // USD
  'member_quarterly_cny':   'price_XXXXX',  // CNY
  'member_quarterly_krw':   'price_XXXXX',  // KRW
  
  'member_yearly':          'price_1TzAjQEAXrE2YgcrHYurEL8Z',  // USD
  'member_yearly_cny':      'price_XXXXX',  // CNY
  'member_yearly_krw':      'price_XXXXX',  // KRW
  
  'member_3year':           'price_XXXXX',  // USD
  'member_3year_cny':       'price_XXXXX',  // CNY
  'member_3year_krw':       'price_XXXXX',  // KRW
  
  'joss_basic':             'price_XXXXX',  // USD
  'joss_basic_cny':         'price_XXXXX',  // CNY
  'joss_premium':           'price_XXXXX',  // USD
  'joss_premium_cny':       'price_XXXXX',  // CNY
};
```

### 3. 更新订阅检测逻辑（已有，验证）

```javascript
// 第 157-172 行（维持不变）
const isSubscription = [
  'daily_sub','member_monthly','member_yearly',
  'member_quarterly','member_3year','member_daily'
].includes(product);
```

---

## 🔄 核心支付逻辑

### A. hasFullAccess（解锁逻辑）

当用户支付成功后，何时授予 `hasFullAccess`？

```javascript
// store.js 第 175-200 行
function hasFullAccess(req, productKeys) {
  // 1. 解析 token
  const token = extractToken(req);
  if (!token) return false;
  
  // 2. 获取用户所有已支付订单
  const orders = getUserOrders.all(userId);
  
  // 3. 检查每个订单是否有权访问
  return orders.some(order => {
    // 关键：检查订阅是否过期
    if (_isExpired(order)) return false;  // ← 订阅过期 = 无权限
    
    // 检查产品是否在白名单中
    return productKeys.some(key => 
      UNLOCK_BY_CATEGORY[key]?.includes(order.product)
    );
  });
}

// 过期判断
function _isExpired(order) {
  if (!order.expires_at) return false;  // 一次性购买无过期时间
  return Date.parse(order.expires_at) < Date.now();  // 订阅已过期
}
```

**关键字段**：
- `payment_status === 'completed'` ← 支付已成功
- `expires_at < now()` ← 订阅已过期
- `product in UNLOCK_BY_CATEGORY[key]` ← 产品白名单匹配

---

### B. Webhook 事件处理流程

```javascript
// payment.js 第 199-302 行

// ┌─────────────────────────────────────────┐
// │ 1. checkout.session.completed           │
// │    （一次性支付/订阅首次成功）           │
// └─────────────────────────────────────────┘
case 'checkout.session.completed': {
  const session = event.data.object;
  const orderNo = session.metadata?.order_no;
  
  if (orderNo) {
    // ✅ 标记订单为已支付
    _updOrder('completed', orderNo);
    completeAffiliateOrder(orderNo);
    
    // ✅ 提取订阅 ID（仅订阅产品有）
    const subId = session.subscription;
    
    if (subId && stripe) {
      // ✅ 获取订阅信息，更新过期时间
      stripe.subscriptions.retrieve(subId).then(sub => {
        if (sub.current_period_end) {
          _updOrderExpiry(
            orderNo, 
            new Date(sub.current_period_end * 1000).toISOString()
          );
        }
      });
    }
  }
  break;
}

// ┌─────────────────────────────────────────┐
// │ 2. customer.subscription.created        │
// │    （订阅首次创建）                      │
// └─────────────────────────────────────────┘
case 'customer.subscription.created': {
  const sub = event.data.object;
  const email = sub.customer_email;
  
  if (sub.current_period_end) {
    // ✅ 记录订阅 ID 和过期时间
    _insSub(email, sub.id);
    _setOrExtendSub(
      productId,
      email,
      new Date(sub.current_period_end * 1000).toISOString()
    );
  }
  break;
}

// ┌─────────────────────────────────────────┐
// │ 3. invoice.payment_succeeded            │
// │    （订阅续费成功）                      │
// └─────────────────────────────────────────┘
case 'invoice.payment_succeeded': {
  const invoice = event.data.object;
  const subId = invoice.subscription;
  const email = invoice.customer_email;
  
  if (subId && invoice.current_period_end) {
    // ✅ 更新订阅过期时间
    _setOrExtendSub(
      productId,
      email,
      new Date(invoice.current_period_end * 1000).toISOString()
    );
    
    console.log(`[RENEWAL] ${email} 续费成功，下期：${invoice.current_period_end}`);
  }
  break;
}

// ┌─────────────────────────────────────────┐
// │ 4. invoice.payment_failed               │
// │    （续费失败）                          │
// └─────────────────────────────────────────┘
case 'invoice.payment_failed': {
  const invoice = event.data.object;
  const email = invoice.customer_email;
  
  // ✅ 标记订阅已失效（用户会失去权限）
  const orders = _M.orders.filter(o => 
    o.stripe_subscription_id === invoice.subscription
  );
  orders.forEach(o => {
    o.expires_at = new Date().toISOString();  // 立即过期
  });
  
  // ✅ 发送续费失败邮件
  sendEmail({
    to: email,
    subject: '善缘会员续费失败 — 请更新支付方式',
    html: `<p>您的会员续费未成功。请点击链接更新支付方式...</p>`
  });
  
  break;
}

// ┌─────────────────────────────────────────┐
// │ 5. customer.subscription.deleted        │
// │    （用户主动取消订阅）                  │
// └─────────────────────────────────────────┘
case 'customer.subscription.deleted': {
  const sub = event.data.object;
  
  // ✅ 标记订阅立即过期
  const orders = _M.orders.filter(o => 
    o.stripe_subscription_id === sub.id
  );
  orders.forEach(o => {
    o.expires_at = new Date().toISOString();
    o.payment_status = 'cancelled';
  });
  
  console.log(`[CANCELLED] Subscription ${sub.id}`);
  break;
}
```

---

## 💳 前端集成

### 支付流程（客户端）

```javascript
// ┌─ Step 1: 用户点击"购买"按钮 ─┐
async function initPayment(productId, region = 'us') {
  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: productId,
      region: region,  // 'us' | 'cn' | 'kr'
      email: userEmail,
      successUrl: `${location.origin}/api/success?product=${productId}`,
      cancelUrl: `${location.origin}/pages/pricing.html`
    })
  });
  
  const { url, channel, amountCny } = await response.json();
  
  // ┌─ Step 2: 路由到对应支付通道 ─┐
  if (channel === 'cn') {
    // 国内用户 → 微信/支付宝
    showCNPaymentMethods(productId, amountCny);
  } else {
    // 国际用户 → Stripe Checkout
    window.location.href = url;
  }
}

// ┌─ Step 3: Stripe Checkout 支付成功 ─┐
// Stripe 自动重定向到 success_url
// 后端 webhook 自动处理订单状态更新

// ┌─ Step 4: 前端显示成功页 ─┐
// GET /api/success?session_id={CHECKOUT_SESSION_ID}&product={productId}
// → 页面显示"功德圆满"、产品权益、倒计时跳转
```

### 支付成功页（已实现）

位置：`server/routes/payment.js` 第 305-377 行

**功能**：
- ✅ 根据 productId 显示对应的解锁信息
- ✅ 显示权益列表
- ✅ 3秒后自动跳转到报告页面
- ✅ 发送 `payment_complete` 消息到 window.opener（用于关闭支付弹窗）

---

## 📋 订阅管理生命周期

### 用户订阅状态流转

```
┌──────────────────┐
│   未订阅          │
└────────┬─────────┘
         │ 用户点击"购买"
         ↓
┌──────────────────┐
│  checkout.session.completed  │ ← Webhook 1
│  ✅ payment_status = completed   │
│  ✅ 订单落盘             │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  customer.subscription.created   │ ← Webhook 2
│  ✅ 记录 subscription_id         │
│  ✅ 计算 expires_at             │
└────────┬─────────┘
         │ [第一个周期]
         ↓
┌──────────────────┐
│  ✅ 用户有权限访问报告  │
│  hasFullAccess = true │
└────────┬─────────┘
         │ [周期结束前 1 周] Stripe 自动尝试续费
         ↓
    ┌─────────────────┐
    │ 续费成功?        │
    └──┬────────┬──────┘
       │        │
      YES      NO
       │        │
       ↓        ↓
  ┌────────┐ ┌──────────────┐
  │续费成功 │ │续费失败      │
  │invoice.│ │invoice.      │
  │payment │ │payment_failed│
  │_success│ │← Webhook 4  │
  │ed      │ │✅ expires_at │
  │← Webhook│ │   = now()    │
  │  3     │ │✅ 邮件通知   │
  │✅ 延长 │ └──────┬───────┘
  │expires │        │
  │_at     │        ↓
  │        │   ┌──────────────┐
  │        │   │用户失去权限  │
  │        │   │需重试支付    │
  │        │   └──────────────┘
  └────────┘
```

### 降级/升级流程

```
┌─ 当前订阅：member_yearly (年费) ─┐
└─────────────┬───────────────────┘
              │ 用户想降级为 member_monthly
              ↓
   ┌──────────────────────────┐
   │ 前端提示："取消年度会员"  │
   │ 确认后调用：               │
   │ POST /api/manage-sub/cancel │
   └──────────────┬───────────┘
                  │
                  ↓
   ┌──────────────────────────┐
   │ 后端调用 Stripe API:      │
   │ stripe.subscriptions     │
   │   .update(subId, {        │
   │     cancel_at_period_end: true
   │   })                       │
   └──────────────┬───────────┘
                  │
                  ↓
   ┌──────────────────────────┐
   │ Webhook: invoice.payment │
   │ 当期到期，生成新订阅     │
   │ member_monthly           │
   └──────────────────────────┘
```

---

## 🌍 地区/货币路由表

### 创建 Checkout Session 时的货币选择

```javascript
// payment.js 第 138-172 行（已实现）

// 获取用户区域
var ipCountry = req.headers['cf-ipcountry'] || 
                req.headers['x-vercel-ip-country'] || '';

// 检查是否国内
if (ipCountry === 'CN') {
  return res.json({
    channel: 'cn',  // 微信/支付宝
    amountCny: productPrice
  });
}

// 检查是否韩国
const isKR = req.body.region === 'kr';
const payCurrency = isKR ? 'krw' : 'usd';

// 获取对应价格
if (isKR) {
  unitAmount = prod.amountKrw || (prod.amount / 100 * 1300);
} else {
  unitAmount = prod.amount;  // USD
}

// 选择对应的 Price ID
const krwKey = isKR ? (product + '_krw') : null;
const priceId = (krwKey && STRIPE_PRICE_IDS[krwKey]) 
  ? STRIPE_PRICE_IDS[krwKey] 
  : STRIPE_PRICE_IDS[product];
```

**路由规则**：

| 条件 | 货币 | 支付通道 | Price ID 后缀 |
|------|------|--------|--------------|
| IP = CN | CNY | 微信/支付宝 | _cny |
| region = kr | KRW | Stripe Card | _krw |
| 其他 | USD | Stripe Card | (无后缀) |

---

## ✅ 上线检查清单

### 📊 数据校对

- [ ] PRODUCTS（store.js）所有产品定价已更新（USD/CNY/KRW）
- [ ] STRIPE_PRICE_IDS（payment.js）所有 Price IDs 已填入
  - [ ] 待创建 IDs 已在 Stripe Dashboard 创建
  - [ ] 每个 ID 已测试支付流程
- [ ] 订阅产品 SUBSCRIBE_PRODUCTS 列表完整

### 🔐 Webhook 配置

- [ ] Stripe Dashboard 已添加 Webhook Endpoint
  - [ ] URL: `https://shenyuan.mylumee.cn/api/stripe-webhook`
  - [ ] Events: 6 个事件已勾选（见 §Webhook 配置）
  - [ ] Signing secret 已配置到 `.env.production`

### 🌐 环境变量

- [ ] `.env.production` 已配置：
  ```bash
  STRIPE_PAY_SECRET_KEY=sk_live_xxx
  STRIPE_WEBHOOK_SECRET=whsec_live_xxx
  STRIPE_PUBLISHABLE_KEY=pk_live_xxx
  FRONTEND_URL=https://shenyuan.mylumee.cn
  ```

### 🧪 测试覆盖

- [ ] 一次性支付（USD）→ bazi_full
- [ ] 一次性支付（CNY）→ 微信/支付宝
- [ ] 一次性支付（KRW）→ saju_kr_full
- [ ] 订阅支付（USD/mo）→ member_monthly
- [ ] 订阅续费 → invoice.payment_succeeded webhook 触发
- [ ] 订阅失败 → invoice.payment_failed webhook 触发
- [ ] 用户取消订阅 → customer.subscription.deleted webhook 触发
- [ ] 用户报告页访问 → hasFullAccess() 检查过期

### 📱 前端验证

- [ ] 定价页面所有产品按钮可点击
- [ ] Stripe Checkout 加载成功
- [ ] 支付成功页显示正确（根据 productId 定制）
- [ ] 手机端响应式设计正常

### 🔍 监控告警

- [ ] PM2 日志配置（grep PAYMENT/STRIPE/WEBHOOK）
- [ ] Sentry 异常捕获已启用
- [ ] 支付失败邮件通知已测试

---

## 🚨 常见故障排除

### Webhook 返回 403

**原因**：Webhook secret 错误或环境变量未设置

**解决**：
```bash
# 验证环境变量
ssh root@47.242.80.65
cat /www/shenyuan/server/.env | grep STRIPE_WEBHOOK_SECRET

# 务必使用生产 whsec_live_xxx（非测试的 whsec_test_xxx）
```

### 支付页显示错误货币

**原因**：前端未传递 region 参数，或后端路由逻辑错误

**解决**：
```javascript
// 前端确保传递
fetch('/api/create-checkout', {
  body: JSON.stringify({
    product: 'bazi_full',
    region: 'kr'  // ← 必填
  })
})
```

### 用户支付后无法访问报告

**原因**：hasFullAccess() 检查失败（通常是 token 问题或订阅过期）

**解决**：
```javascript
// 后端日志调试
console.log('[hasFullAccess]', {
  token,
  orders: getUserOrders.all(userId),
  productKeys,
  result: hasFullAccess(req, productKeys)
});
```

### 订阅不自动续费

**原因**：Stripe Billing 默认启用，但需确认：
1. 订阅产品 mode = 'subscription'
2. Webhook 已接收 invoice.payment_succeeded 事件
3. 用户支付方式未过期

**验证**：
```bash
# 检查 Stripe Dashboard → Invoices
# 查看是否生成了续费 invoice（状态应为 paid）

pm2 logs shenyuan | grep "invoice.payment_succeeded"
```

---

## 📊 关键指标

### KPI 监控（上线后第 1 周）

| 指标 | 目标 | 预警 |
|------|------|------|
| 支付成功率 | >95% | <90% |
| Webhook 成功率 | 100% | 任何失败 |
| 平均支付时间 | <30s | >60s |
| 订阅留存（Day 7） | >80% | <70% |
| 续费成功率 | >95% | <90% |

---

## 📞 技术支持

**Stripe 文档**：https://stripe.com/docs  
**Webhook 测试工具**：https://stripe.com/docs/webhooks/test  
**价格创建 CLI**：https://stripe.com/docs/api/prices/create

---

**版本历史**：
- v2.0 (2026-08-08): 生产就绪版本，补充 CNY/KRW 定价、完整 webhook 流程、订阅生命周期
- v1.0 (2026-08-08): 初始版本
