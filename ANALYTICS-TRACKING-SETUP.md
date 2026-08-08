# 善缘投放数据追踪配置 (2026-08-09 start)

> **用途**: 投放后的全链路数据追踪  
> **工具**: PostHog + Google Analytics + 自建统计  
> **目标**: 实时掌握 DAU/转化/邀请/ROI

---

## 埋点方案

### 1️⃣ 前端埋点 (pages/*.html)

#### 关键事件埋点表

| 事件 | 触发条件 | 参数 | 优先级 |
|------|---------|------|--------|
| page_view | 页面加载 | url, source, ref_code | P0 |
| report_generated | 命盘生成 | bazi_type, duration | P0 |
| product_clicked | 点击购买 | product, price, position | P0 |
| checkout_started | 进入支付 | product, amount, currency | P0 |
| payment_completed | 支付成功 | product, amount, currency, method | P0 |
| payment_failed | 支付失败 | product, error_code, error_msg | P0 |
| share_clicked | 点击分享 | share_type, channel | P1 |
| referral_link_copied | 复制邀请链接 | ref_code | P1 |
| referral_link_clicked | 点击邀请链接 | ref_code, source | P0 |

#### PostHog埋点代码示例

```javascript
// 在pages/bazi.html中加入以下代码

// 初始化PostHog
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]]=t[o[0]]||{}),t[o.pop()]=i}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src="https://cdn.posthog.com/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r),e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

posthog.init('phc_YOUR_API_KEY_HERE', {
  api_host: 'https://us.posthog.com'
});

// 埋点事件
function trackEvent(eventName, properties) {
  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
    page_url: window.location.href,
    user_token: localStorage.getItem('token') || 'anonymous'
  });
}

// 使用示例
// 报告生成时
trackEvent('report_generated', {
  bazi_type: 'basic',
  duration_ms: 2500,
  ref_code: getReferralCode()
});

// 支付成功时
trackEvent('payment_completed', {
  product: 'bazi_full',
  amount: 19.90,
  currency: 'USD',
  method: 'stripe'
});
```

### 2️⃣ 后端埋点 (server/*.js)

#### 关键业务事件

```javascript
// routes/payment.js中加入埋点

function logPaymentEvent(eventType, data) {
  _M.events = _M.events || [];
  _M.events.push({
    event_type: eventType,
    user_id: data.user_id,
    order_id: data.order_id,
    product: data.product,
    amount: data.amount,
    currency: data.currency,
    timestamp: new Date().toISOString(),
    metadata: data.metadata || {}
  });
  _persist();
}

// Webhook中记录
router.post('/stripe-webhook', (req, res) => {
  const event = req.body;
  
  if (event.type === 'charge.succeeded') {
    logPaymentEvent('payment_completed', {
      user_id: order.user_id,
      order_id: order.id,
      product: order.product,
      amount: order.amount,
      currency: order.currency,
      metadata: { stripe_id: event.id }
    });
  }
});

// 邀请事件
function logReferralEvent(eventType, data) {
  _M.referral_events = _M.referral_events || [];
  _M.referral_events.push({
    event_type: eventType, // referral_link_shared / referral_completed
    referrer_id: data.referrer_id,
    referee_id: data.referee_id,
    reward_amount: data.reward_amount,
    timestamp: new Date().toISOString()
  });
  _persist();
}
```

---

## Google Analytics 配置

### GA4 设置

```javascript
// 在index.html <head>中加入

<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR_GA4_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-YOUR_GA4_ID', {
    'page_path': window.location.pathname,
    'custom_map': {
      'dimension1': 'ref_code',
      'dimension2': 'product_type',
      'dimension3': 'user_segment',
      'metric1': 'report_generation_time'
    }
  });
</script>
```

### GA4 事件配置

```javascript
// 支付事件
gtag('event', 'purchase', {
  transaction_id: order.id,
  value: order.amount,
  currency: order.currency,
  items: [{
    item_name: order.product,
    price: order.amount
  }]
});

// 邀请事件
gtag('event', 'referral_completed', {
  referrer: getReferralCode(),
  value: referral_reward,
  content_type: 'invitation'
});

// 自定义事件
gtag('event', 'report_generated', {
  event_category: 'engagement',
  event_label: 'bazi_report',
  value: report_generation_time_ms
});
```

---

## 数据导出 & 分析

### Daily Report 查询

```bash
# SSH到服务器
ssh root@47.242.80.65

# 查询昨天的数据
cd /opt/shenyuan
node -e "
const data = require('fs').readFileSync('data.json', 'utf8');
const store = JSON.parse(data);

const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

const orders = store.orders.filter(o => 
  o.created_at.startsWith(yesterday) && o.payment_status === 'completed'
);

const revenue = orders.reduce((sum, o) => sum + o.amount, 0);
const count = orders.length;

console.log(\`\n📊 Yesterday Report (\${yesterday})\`);
console.log(\`Orders: \${count}\`);
console.log(\`Revenue: \${revenue} (in cents)\`);
console.log(\`Avg: \${revenue/count}\`);
console.log(\`Products:\`, 
  orders.map(o => o.product).reduce((a,b) => ({...a, [b]: (a[b]||0)+1}), {})
);
"
```

### Weekly Analysis Sheet

| 日期 | DAU | 新用户 | 付费 | 订阅 | 邀请 | 邀请转化 | 收入(元) | ROI |
|------|-----|--------|------|------|------|----------|---------|-----|
| 08-09 | 50 | 45 | 8 | 2 | 6 | 25% | ¥198 | - |
| 08-10 | 62 | 35 | 10 | 2 | 8 | 28% | ¥245 | +24% |
| 08-11 | 78 | 45 | 12 | 3 | 11 | 30% | ¥284 | +16% |
| 08-12 | 95 | 52 | 14 | 4 | 14 | 32% | ¥318 | +12% |
| 08-13 | 120 | 62 | 18 | 5 | 18 | 33% | ¥385 | +21% |
| 08-14 | 145 | 70 | 22 | 6 | 23 | 35% | ¥462 | +20% |
| 08-15 | 180 | 85 | 26 | 7 | 28 | 36% | ¥548 | +19% |

---

## 监控告警配置

### 健康检查脚本

```bash
#!/bin/bash
# health-check.sh - 每小时运行一次

SERVER="47.242.80.65"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# 检查服务
STATUS=$(ssh root@$SERVER "pm2 status shenyuan | grep online" | wc -l)
if [ $STATUS -eq 0 ]; then
  curl -X POST $SLACK_WEBHOOK \
    -d '{"text":"🚨 Shenyuan服务离线!"}' \
    -H 'Content-Type: application/json'
fi

# 检查支付失败率
FAILURES=$(ssh root@$SERVER "node -e \"const d = require('fs').readFileSync('/opt/shenyuan/data.json'); const s = JSON.parse(d); console.log(s.orders.filter(o => o.payment_status === 'failed').length);\"")
if [ $FAILURES -gt 5 ]; then
  curl -X POST $SLACK_WEBHOOK \
    -d "{\"text\":\"⚠️  支付失败数: $FAILURES\"}" \
    -H 'Content-Type: application/json'
fi

# 检查数据落盘
BACKUP=$(ssh root@$SERVER "ls -lrt /opt/shenyuan/data.json* | tail -1")
echo "✅ 最后备份: $BACKUP"
```

### Alerting Rules

| 告警 | 阈值 | 行动 |
|------|------|------|
| 支付成功率 | <95% | 立刻Slack通知 + 检查webhook |
| 服务宕机 | 任何时刻 | SMS+Slack+邮件 + 自动重启 |
| 邀请链接失效 | >5%转化失败 | Slack通知 + 排查IP限制 |
| 数据未落盘 | >30分钟 | Slack + 检查磁盘空间 |

---

## 投放ROI追踪

### 计算方式

```
ROI = 收入 / 支出

Day 1:
├─ 收入: ¥1200 (8单×¥150 avg)
├─ 支出: 人力(¥200) + 邀请返佣(¥100) + 服务器(¥50) = ¥350
└─ ROI: 1200/350 = 3.4x ✅

Week 1:
├─ 收入: ¥8000 (平均日¥1200)
├─ 支出: 人力(¥2000) + 邀请返佣(¥800) + 服务器(¥350) + 营销(¥1000) = ¥4150
└─ ROI: 8000/4150 = 1.9x ⚠️ (需增加付费用户)

Month 1:
├─ 收入: ¥50000+ (目标)
├─ 支出: 人力(¥10000) + 邀请返佣(¥5000) + 服务器(¥2000) + 营销(¥10000) = ¥27000
└─ ROI: 50000/27000 = 1.85x (breakeven + 小利润)
```

### CAC & LTV追踪

```
CAC (Customer Acquisition Cost) = 营销支出 / 新用户数
├─ Week 1 CAC: ¥1000投放 / 100新用户 = ¥10/user
├─ 通过邀请CAC: ¥500返佣 / 80邀请新用户 = ¥6.25/user (更便宜)

LTV (Lifetime Value) = 平均订单值 × 购买频次 × 保留期
├─ 一次性报告LTV: ¥99 × 1 = ¥99
├─ 订阅会员LTV: ¥19.9 × 12 = ¥238.8 (年)
├─ 邀请官LTV: ¥99 + ¥500返佣 = ¥599 (第一年)

LTV/CAC比:
├─ 通过邀请: ¥599 / ¥6.25 = 96x ✅ (极好)
├─ 通过投放: ¥99 / ¥10 = 9.9x (好)
```

---

## 数据分享模板

### 每周Share给Karen

```markdown
## 投放周报 (2026-08-09 ~ 08-15)

📊 核心数字:
- DAU: 180 (+260% Week 1)
- 付费用户: 26 (-3% from yesterday)
- 收入: ¥548 (+19% week-over-week)
- 邀请占比: 28% (+5% from start)

🎯 成功指标:
✅ DAU 50→180 (超目标3.6倍)
✅ 转化率 5.2% (目标5-8%)
✅ 邀请转化 36% (目标20-30%)
✅ 服务可用性 99.97% (目标99.9%)

⚠️ 待改进:
❌ Week 2 付费用户环比下降 (需要新的投放刺激)
❌ 邀请排行榜实时性差 (缓存未更新)
❌ 支付失败率 0.3% (webhook日志排查中)

🚀 下周计划:
- 启动第二轮KOL合作
- 推出合婚双人测产品
- 优化邀请排行榜查询
```

---

*维护此文档,确保投放数据完全可见*

