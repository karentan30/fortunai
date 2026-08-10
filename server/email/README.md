# 善缘邮件系统 - Email Service

完整的邮件模板 + 发送系统，支持中/英/韩三语言。

## 系统组成

```
server/
├── email/
│   ├── templates/
│   │   ├── order_confirmation-cn.html      ✅ 订单确认 - 中文
│   │   ├── order_confirmation-en.html      ✅ 订单确认 - 英文
│   │   ├── order_confirmation-kr.html      ✅ 订单确认 - 韩文
│   │   ├── renewal_reminder-cn.html        ✅ 续费提醒 - 中文
│   │   ├── renewal_reminder-en.html        ✅ 续费提醒 - 英文
│   │   ├── renewal_reminder-kr.html        ✅ 续费提醒 - 韩文
│   │   ├── referral_success-cn.html        ✅ 邀请成功 - 中文
│   │   ├── referral_success-en.html        ✅ 邀请成功 - 英文
│   │   ├── referral_success-kr.html        ✅ 邀请成功 - 韩文
│   └── README.md                            📖 本文档
├── lib/
│   └── email-service.js                     🔧 邮件服务库（模板编译 + 发送）
└── routes/
    └── email.js                             🛣️ API 路由 + 新端点
```

## 核心功能

### 1️⃣ 支付确认邮件 (Order Confirmation)

**触发时机**：支付成功后，由支付 webhook 调用

**邮件内容**：
- 订单号（sy_ 前缀）
- 产品名称
- 支付金额
- 有效期至日期
- 立即查看报告的 CTA 按钮
- 可选的后续步骤提示

**模板特色**：
- Responsive 设计，兼容 Outlook/Gmail
- 金色主题色（品牌统一）
- 安全信息框（有效期提示）
- 特性列表展示

### 2️⃣ 续费提醒邮件 (Renewal Reminder)

**触发时机**：定时任务（cron），每天检查到期日期前 7 天

**邮件内容**：
- 倒计时：距到期还有多少天
- 当前套餐名称
- 续费价格
- "断点续约"保障说明
- 续费按钮
- 可继续享有的权益列表

**模板特色**：
- 警告框样式强调紧急性
- 绿色强调框（断点续约保障）
- 进度条等视觉设计
- 包含权益清单

### 3️⃣ 邀请成功邮件 (Referral Success)

**触发时机**：邀请转化完成后，由邀请系统调用

**邮件内容**：
- 被邀请人昵称
- 获得的现金奖励
- 当前邀请等级（青铜/白银/黄金等）
- 升级所需人数
- 排行榜链接
- 可解锁的下一等级权益

**模板特色**：
- 庆祝动画头部（🎉）
- 奖励金额突出显示
- 进度条展示等级升级进度
- 等级权益列表

## API 端点

### POST /api/email/send-order-confirmation

发送订单确认邮件。

**请求体**：
```json
{
  "to": "user@example.com",
  "orderNo": "sy_20260810_001",
  "product": "八字年运报告",
  "amount": 9900,                      // 单位：分（¥99.00）
  "expiresAt": "2027-08-10T00:00:00Z",
  "lang": "cn"                          // cn/en/kr，默认 cn
}
```

**响应**：
```json
{
  "ok": true,
  "email": "user@example.com"
}
```

---

### POST /api/email/send-renewal-reminder

发送续费提醒邮件。

**请求体**：
```json
{
  "to": "user@example.com",
  "planName": "年度会员",
  "expiresAt": "2026-08-17T00:00:00Z",  // 到期日期
  "renewalPrice": 9900,                  // 续费价格，单位：分
  "lang": "cn"
}
```

**响应**：
```json
{
  "ok": true,
  "email": "user@example.com"
}
```

---

### POST /api/email/send-referral-success

发送邀请成功邮件。

**请求体**：
```json
{
  "to": "referrer@example.com",
  "inviteeName": "张三",
  "reward": 1000,                        // 奖励金额，单位：分
  "currentLevel": "青铜",                 // 当前等级
  "nextLevelRequired": 3,                // 升级到下一等级还需邀请多少人
  "lang": "cn"
}
```

**响应**：
```json
{
  "ok": true,
  "email": "referrer@example.com"
}
```

---

### POST /api/admin/email/test-order

测试订单确认邮件（仅限 ADMIN_TOKEN）。

**请求头**：
```
X-Admin-Token: [ADMIN_TOKEN]
```

**响应**：
```json
{
  "ok": true,
  "message": "test email sent"
}
```

## 实现步骤

### 第一步：环境变量配置

在 `.env` 中设置 Resend API Key：

```bash
# .env 或 server/.env
RESEND_API_KEY=re_xxxxxxxxxxxx
```

Resend 免费额度为 **100 封/天**，企业版无限制。

### 第二步：集成到支付 webhook

在 `server/pay.js` 中的支付成功回调处理器中调用：

```javascript
const emailService = require('../lib/email-service');

// 支付成功后
async function handlePaymentSuccess(order) {
  // ... 订单处理逻辑
  
  // 发送确认邮件
  await emailService.sendOrderConfirmation(
    user.email,
    {
      orderNo: order.out_trade_no,
      product: '八字年运报告',
      amount: order.total_fee,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    },
    user.language || 'cn'  // 从用户偏好获取语言
  );
}
```

### 第三步：集成到续费检查（cron）

在 `server/index.js` 或独立的 cron 任务中添加：

```javascript
const emailService = require('./lib/email-service');
const db = require('./lib/store');

// 每日凌晨 2 点运行
async function checkRenewalDue() {
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  // 查询所有即将到期的订阅
  const dueSubs = await db.query(
    'SELECT email, plan_name, expires_at, language FROM subscriptions WHERE expires_at <= $1',
    [sevenDaysLater]
  );
  
  for (const sub of dueSubs) {
    await emailService.sendRenewalReminder(
      sub.email,
      {
        planName: sub.plan_name,
        expiresAt: sub.expires_at,
        renewalPrice: 9900  // 从产品表获取
      },
      sub.language || 'cn'
    );
  }
}

// 注册 cron 任务
const cron = require('node-cron');
cron.schedule('0 2 * * *', checkRenewalDue);  // 每天 2:00
```

### 第四步：集成到邀请系统

在 `server/routes/invite.js` 中调用：

```javascript
const emailService = require('../lib/email-service');

router.post('/invite/accept', async (req, res) => {
  const { referralCode, email } = req.body;
  
  // ... 邀请处理逻辑
  
  // 发送邀请成功邮件给推荐者
  const referrer = await getReferrerByCode(referralCode);
  const stats = await getReferrerStats(referrer.id);
  
  await emailService.sendReferralSuccess(
    referrer.email,
    {
      inviteeName: email,
      reward: 1000,
      currentLevel: stats.level,
      nextLevelRequired: stats.nextLevelThreshold - stats.count
    },
    referrer.language || 'cn'
  );
  
  res.json({ ok: true });
});
```

## 模板变量说明

所有模板使用 `{{variable}}` 格式的变量替换。支持的变量：

### order_confirmation（订单确认）

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{orderNo}}` | 订单号 | sy_20260810_001 |
| `{{product}}` | 产品名 | 八字年运报告 |
| `{{amount}}` | 格式化后的金额 | ¥99.00 |
| `{{expiryDate}}` | 有效期至日期 | 2027年8月10日 |
| `{{reportUrl}}` | 查看报告的链接 | https://... |
| `{{theme}}` | 主题 CSS（JSON） | {...} |

### renewal_reminder（续费提醒）

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{planName}}` | 套餐名称 | 年度会员 |
| `{{expiryDate}}` | 到期日期 | 2026年8月17日 |
| `{{daysLeft}}` | 剩余天数 | 7 |
| `{{renewalPrice}}` | 续费价格 | ¥99.00 |
| `{{renewUrl}}` | 续费链接 | https://... |

### referral_success（邀请成功）

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{inviteeName}}` | 被邀请人名字 | 张三 |
| `{{reward}}` | 奖励金额 | ¥10.00 |
| `{{currentLevel}}` | 当前等级 | 青铜 |
| `{{nextLevelRequired}}` | 升级还需 | 3 |
| `{{leaderboardUrl}}` | 排行榜链接 | https://... |

## 测试方法

### 快速测试（使用测试端点）

```bash
# 使用管理员 token 测试
curl -X POST http://localhost:3000/api/admin/email/test-order \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json"
```

### 完整测试（使用 Postman）

**请求 1：订单确认**
```
POST http://localhost:3000/api/email/send-order-confirmation
Content-Type: application/json

{
  "to": "test@example.com",
  "orderNo": "sy_test_001",
  "product": "八字年运报告",
  "amount": 9900,
  "expiresAt": "2027-08-10T00:00:00Z",
  "lang": "cn"
}
```

**请求 2：续费提醒**
```
POST http://localhost:3000/api/email/send-renewal-reminder
Content-Type: application/json

{
  "to": "test@example.com",
  "planName": "年度会员",
  "expiresAt": "2026-08-17T00:00:00Z",
  "renewalPrice": 9900,
  "lang": "cn"
}
```

**请求 3：邀请成功**
```
POST http://localhost:3000/api/email/send-referral-success
Content-Type: application/json

{
  "to": "test@example.com",
  "inviteeName": "张三",
  "reward": 1000,
  "currentLevel": "青铜",
  "nextLevelRequired": 3,
  "lang": "cn"
}
```

## 故障排除

### 问题：邮件发不出去

**检查清单**：
1. ✅ `RESEND_API_KEY` 已设置且有效
2. ✅ 邮箱地址格式正确（包含 @）
3. ✅ 模板文件存在于 `server/email/templates/`
4. ✅ 查看 server logs 中的错误信息

### 问题：模板格式错误

**检查清单**：
1. ✅ 所有 HTML 文件都在 `server/email/templates/` 目录
2. ✅ 文件名格式：`{template_name}-{lang}.html`（如 `order_confirmation-cn.html`）
3. ✅ 所有变量使用 `{{varName}}` 格式

### 问题：特定语言没有回退

系统会自动回退到英文（en），如果请求的语言模板不存在。

## 成本估算

| 提供商 | 定价 | 月度成本（10K用户） |
|-------|------|------------------|
| Resend | 免费 100/天，企业$20-100/月 | $0-100（小于 10K）|
| SendGrid | $9.95-299/月 | 取决于邮件量 |
| AWS SES | $0.10/1000 邮件 | ~$1/月 |

> 推荐：使用 Resend 免费版本直到日均邮件数超过 100 封，然后升级到企业版。

## 后续扩展

- [ ] 邮件模板版本管理（A/B 测试）
- [ ] 邮件发送日志 + 重试机制
- [ ] 邮件打开率/点击率追踪（webhook）
- [ ] 批量邮件发送 API
- [ ] 个性化邮件内容（基于用户偏好）
- [ ] 邮件队列系统（高并发）
- [ ] 日文/西班牙文等语言支持

## 文件位置汇总

```
/Users/karen/projects/shenyuan/
├── server/
│   ├── email/
│   │   ├── templates/      ← 9 个 HTML 模板
│   │   └── README.md       ← 本文档
│   ├── lib/
│   │   └── email-service.js ← 核心服务库
│   └── routes/
│       └── email.js        ← API 路由（含新端点）
```

---

**最后更新**：2026-08-10
**维护者**：Karen & Claude Code
**状态**：✅ 生产就绪
