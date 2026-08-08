# 善缘 Stripe 上线实施清单 · Quick Start

**目标**：Day 1 将 Stripe 完整支付系统部署到生产  
**时间**：3-4 小时（包括测试）  
**负责**：Engineering Lead + CFO

---

## ⚡ 5 分钟速查

### 必填的 Stripe Price IDs（从 Dashboard 复制）

```javascript
// server/routes/payment.js 第 64-120 行

const STRIPE_PRICE_IDS = {
  // 一次性购买
  'bazi_full':        'price_1TzAjGEAXrE2YgcrRzUY78Ko',   // 生产USD $19.90
  'bazi_full_krw':    'price_1TzrGREAXrE2Ygcr1dOkiv2O',   // 生产KRW ₩29,900
  
  // 订阅（递归计费）
  'member_monthly':        'price_1TzAjGEAXrE2YgcrRzUY78Ko',     // USD $6.90/mo
  'member_monthly_krw':    'price_1TzrGWEAXrE2YgcrhrIIeMXC',    // KRW ₩12,900/mo
  'member_yearly':         'price_1TzAjQEAXrE2YgcrHYurEL8Z',    // USD $39.90/yr
};

// ⚠️ 其他 CNY/KRW/3year Price IDs 需要在 Stripe Dashboard 创建
```

### 必填的环境变量

```bash
# 登录服务器
ssh -i ~/.ssh/key.pem root@47.242.80.65

# 编辑配置
nano /www/shenyuan/server/.env

# 复制粘贴
STRIPE_PAY_SECRET_KEY=sk_live_xxxxx         # ← 从 Stripe Dashboard 获取
STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx     # ← Webhook signing secret
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx       # ← 前端可用
FRONTEND_URL=https://shenyuan.mylumee.cn   # ← 已有
```

---

## 📋 完整任务清单

### Phase A：Stripe 账户配置（20 min）

- [ ] **A1** 登录 Stripe Dashboard（https://dashboard.stripe.com）
- [ ] **A2** 切换到 **Live mode**（右上角红色/蓝色切换）
- [ ] **A3** 导航到 **Developers** → **API keys**
  - [ ] 复制 **Secret key**（sk_live_...）→ 记到临时文件
  - [ ] 复制 **Publishable key**（pk_live_...）→ 记到临时文件
- [ ] **A4** 导航到 **Developers** → **Webhooks**
  - [ ] 点 **Add an endpoint**
  - [ ] URL: `https://shenyuan.mylumee.cn/api/stripe-webhook`
  - [ ] 选择事件（见下表）
  - [ ] 复制 **Signing secret**（whsec_live_...）→ 记到临时文件

**Webhook 事件选择**（6 个）：
- ✅ `checkout.session.completed`
- ✅ `checkout.session.expired`
- ✅ `customer.subscription.created`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.deleted`

---

### Phase B：Price IDs 创建（30 min）

**现状**：部分 Price IDs 已存在（bazi_full, member_monthly/yearly 等）

**待创建清单**：

```bash
# 登录 Stripe CLI 或进入 Dashboard → Products

# 1. CNY 定价（如无）
stripe prices create \
  --unit-amount=1990 \
  --currency=cny \
  --product-data.name="基础命盤" \
  --metadata.lang=zh-CN

# 2. member_quarterly_cny （季度会员，3个月）
stripe prices create \
  --unit-amount=6990 \
  --currency=cny \
  --recurring.interval=month \
  --recurring.interval-count=3 \
  --product-data.name="季會員" \
  --metadata.lang=zh-CN

# 3. member_quarterly_krw
stripe prices create \
  --unit-amount=49900 \
  --currency=krw \
  --recurring.interval=month \
  --recurring.interval-count=3 \
  --product-data.name="계절 회원"

# 4. member_3year_xxx （三年会员）
# （按上述格式创建 USD/CNY/KRW 三个版本）

# 命令完成后，记下每个返回的 price_id，填入 STRIPE_PRICE_IDS
```

**验证**：Stripe Dashboard → Products，确认所有 price 都存在且金额正确

---

### Phase C：代码修改（30 min）

#### C1：更新 `server/lib/store.js` - PRODUCTS

**找到第 336-366 行**，验证所有产品都有 amountCny/amountKrw：

```javascript
const PRODUCTS = {
  bazi_basic:       { name: '基础命盤', amount: 990, amountCny: 1990, amountKrw: 29900, ... },
  bazi_full:        { name: '完整命盤', amount: 1990, amountCny: 9990, amountKrw: 29900, ... },
  bazi_vip:         { name: '深度批命', amount: 3990, amountCny: 19990, amountKrw: 49900, ... },
  member_monthly:   { name: '月度會員', amount: 690, amountCny: 1990, amountKrw: 12900, ... },
  member_quarterly: { name: '季會員', amount: 1499, amountCny: 6990, amountKrw: 49900, ... },
  member_yearly:    { name: '年度會員', amount: 3990, amountCny: 19990, amountKrw: 129900, ... },
  // ...其他产品
};
```

**检查清单**：
- [ ] 每个产品都有 `amount`（USD，单位分）
- [ ] 订阅产品都有 `amountCny` 和 `amountKrw`
- [ ] 汇率合理（1 USD ≈ 7.2 CNY, ≈ 1300 KRW）

#### C2：更新 `server/routes/payment.js` - STRIPE_PRICE_IDS

**找到第 64-120 行**，填入所有 Price IDs：

```javascript
const STRIPE_PRICE_IDS = {
  'bazi_basic':           'price_XXXXX',  // ← 填入新创建的 ID
  'bazi_basic_cny':       'price_XXXXX',
  'bazi_basic_krw':       'price_XXXXX',
  
  'bazi_full':            'price_1TzAjGEAXrE2YgcrRzUY78Ko',  // ✅ 已有
  'bazi_full_krw':        'price_1TzrGREAXrE2Ygcr1dOkiv2O',  // ✅ 已有
  
  'member_monthly':       'price_1TzAjGEAXrE2YgcrRzUY78Ko',  // ✅ 已有
  'member_monthly_cny':   'price_XXXXX',  // ← 待填
  'member_monthly_krw':   'price_1TzrGWEAXrE2YgcrhrIIeMXC',  // ✅ 已有
  
  'member_quarterly':     'price_XXXXX',  // ← 待填
  'member_quarterly_cny': 'price_XXXXX',  // ← 待填
  'member_quarterly_krw': 'price_XXXXX',  // ← 待填
  
  'member_yearly':        'price_1TzAjQEAXrE2YgcrHYurEL8Z',  // ✅ 已有
  'member_yearly_cny':    'price_XXXXX',  // ← 待填
  'member_yearly_krw':    'price_XXXXX',  // ← 待填
  
  'member_3year':         'price_XXXXX',  // ← 待创建 + 填
  'member_3year_cny':     'price_XXXXX',
  'member_3year_krw':     'price_XXXXX',
  
  // 其他产品...
};
```

**验证逻辑**（payment.js 第 157-172 行已正确，无需修改）：
```javascript
const isSubscription = [
  'daily_sub','member_monthly','member_yearly','member_quarterly','member_3year','member_daily'
].includes(product);

// ✅ 自动识别订阅产品，设置 recurring 计费
```

---

### Phase D：服务器部署（30 min）

#### D1：提交代码

```bash
cd /Users/karen/projects/shenyuan

git add server/lib/store.js server/routes/payment.js
git commit -m "stripe: add complete pricing for USD/CNY/KRW, fix subscription products"
git push origin main
```

#### D2：服务器拉取 + 重启

```bash
ssh -i ~/.ssh/key.pem root@47.242.80.65

# 进入项目目录
cd /www/shenyuan

# 拉取最新代码
git pull origin main

# 安装依赖（如有新 npm 包）
npm install

# 更新环境变量（参见 Phase A）
nano .env
# 粘贴：STRIPE_PAY_SECRET_KEY=sk_live_...
# 粘贴：STRIPE_WEBHOOK_SECRET=whsec_live_...
# 粘贴：STRIPE_PUBLISHABLE_KEY=pk_live_...

# 保存并重启应用
pm2 restart shenyuan

# 验证重启成功
pm2 logs shenyuan --lines 20 | grep "Stripe"
```

**预期日志输出**：
```
✓ Stripe initialized
[CHECKOUT] SY-xxx — 完整命盤 $19.90
```

---

### Phase E：测试验证（30 min）

#### E1：一次性购买测试（USD）

```bash
# 1. 从浏览器访问
https://shenyuan.mylumee.cn/pages/pricing.html  # 或主页购买按钮

# 2. 选择 bazi_full → 点"立即购买"
# 3. 预期：Stripe Checkout 页面加载
# 4. 使用测试卡号（切换到 Test mode 才能用）：
#    4242 4242 4242 4242 / 任意未来日期 / 任意 CVC
# 5. 支付后：返回成功页面，显示"功德圆满"

# ✅ 验证指标
pm2 logs shenyuan --lines 5 | grep "CHECKOUT.*completed"
```

#### E2：订阅支付测试（USD）

```bash
# 1. 购买 member_monthly
# 2. Stripe Checkout → 选择月度订阅
# 3. 支付成功
# 4. 验证后端日志

pm2 logs shenyuan --lines 10 | grep -E "PAYMENT|subscription"
```

**预期**：
```
[PAYMENT] SY-xxx — completed
[WEBHOOK] checkout.session.completed
[WEBHOOK] customer.subscription.created
```

#### E3：Webhook 验证

```bash
# 查看是否有 webhook 处理日志
pm2 logs shenyuan --lines 30 | grep "WEBHOOK"

# 预期显示
[WEBHOOK] checkout.session.completed event received
[WEBHOOK] subscription created subId=sub_xxx
```

#### E4：国内用户支付测试（CNY）

```bash
# 模拟国内 IP（通过 curl header）
curl -X POST https://shenyuan.mylumee.cn/api/create-checkout \
  -H "Content-Type: application/json" \
  -H "CF-IPCountry: CN" \
  -d '{
    "product": "bazi_full",
    "email": "test@example.com"
  }'

# 预期响应
{
  "channel": "cn",
  "product": "bazi_full",
  "amountCny": 9990,
  "message": "国内用户请使用微信支付或支付宝"
}
```

#### E5：韩国用户支付测试（KRW）

```bash
curl -X POST https://shenyuan.mylumee.cn/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "saju_kr_full",
    "region": "kr",
    "email": "test_kr@example.com"
  }'

# 预期响应
{
  "url": "https://checkout.stripe.com/pay/cs_live_xxx",
  "sessionId": "cs_live_xxx"
}

# 验证 Stripe Checkout 页面显示 KRW
```

---

### Phase F：监控部署（10 min）

#### F1：配置日志监控

```bash
# 实时查看支付日志
pm2 logs shenyuan | grep -E "PAYMENT|STRIPE|WEBHOOK"

# 或保存到文件（用于审计）
pm2 logs shenyuan > /var/log/shenyuan-payment.log 2>&1
```

#### F2：设置告警

```bash
# 检查 webhook 失败（需配置告警邮件/Sentry）
pm2 logs shenyuan | grep "WEBHOOK ERR"

# 检查支付失败率
pm2 logs shenyuan | grep -c "payment_failed"
```

---

## 🆘 故障排查快速指南

### 症状 1：Webhook 返回 403

**原因**：Webhook secret 错误  
**检查**：
```bash
# SSH 登录服务器
echo $STRIPE_WEBHOOK_SECRET  # 必须是 whsec_live_xxx

# 如果是空或错误，重新设置
nano /www/shenyuan/server/.env
# 更新 STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
pm2 restart shenyuan
```

### 症状 2：支付页显示"支付系统暂未开通"

**原因**：STRIPE_PAY_SECRET_KEY 未设置或错误  
**检查**：
```bash
ssh root@47.242.80.65
grep STRIPE_PAY_SECRET_KEY /www/shenyuan/server/.env

# 如果空，说明环境变量未设置
# 解决：nano /www/shenyuan/server/.env 添加
STRIPE_PAY_SECRET_KEY=sk_live_xxxxx
pm2 restart shenyuan
```

### 症状 3：支付成功但用户无法访问报告

**原因**：hasFullAccess() 检查失败  
**检查**：
```bash
# 查看用户订单记录
curl -H "x-admin-token: $ADMIN_TOKEN" \
  https://shenyuan.mylumee.cn/api/orders/mine

# 检查返回的订单是否有 payment_status='completed'
# 订阅产品还要检查 expires_at > now()
```

### 症状 4：订阅不自动续费

**原因**：通常是 invoice.payment_succeeded webhook 未触发  
**检查**：
```bash
# Stripe Dashboard → Invoices
# 查看是否有新的续费 invoice，状态是否为 paid

# 后端日志检查
pm2 logs shenyuan | grep "invoice.payment_succeeded"

# 如果没有，可能是：
# 1. Webhook endpoint 未配置正确
# 2. 用户支付方式已过期
# 3. Stripe Billing 未启用（通常默认启用）
```

---

## 📊 上线成功标志

✅ 完成所有 5 个 Phase（A-F）  
✅ 所有 E1-E5 测试通过  
✅ PM2 日志显示 Stripe 已初始化  
✅ 支付成功率 > 95%（基于第一批用户）  
✅ Webhook 100% 成功率  

---

## 📞 紧急联系

**Stripe 状态**：https://status.stripe.com  
**技术支持**：https://support.stripe.com  
**本地日志**：`pm2 logs shenyuan --lines 100`

---

**完成时间**：约 2-3 小时  
**回滚时间**：5 分钟（git revert + pm2 restart）
