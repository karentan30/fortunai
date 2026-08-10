# 善缘邮件系统集成指南

## 概览

完成的邮件系统包含：
- **9 个响应式 HTML 邮件模板**（中/英/韩三语言）
- **1 个邮件服务库** (`server/lib/email-service.js`)
- **3 个新 API 端点** + 1 个测试端点
- **完整的集成文档**

## 快速开始（3 分钟）

### 1. 设置环境变量

在 `server/.env` 中添加：
```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
```

获取 API Key：访问 https://resend.com → 注册 → 获取 API Key

### 2. 验证安装

所有文件已在以下位置创建：
```
server/
├── email/
│   ├── templates/          ← 9 个邮件模板
│   └── README.md
├── lib/
│   └── email-service.js    ← 邮件服务库
└── routes/
    └── email.js            ← API 路由（已更新）
```

### 3. 测试端点

```bash
# 测试订单确认邮件
curl -X POST http://localhost:3000/api/email/send-order-confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "orderNo": "sy_20260810_test",
    "product": "八字年运报告",
    "amount": 9900,
    "expiresAt": "2027-08-10T00:00:00Z",
    "lang": "cn"
  }'
```

## 集成位置

### A. 支付系统集成

**文件**：`server/pay.js` 或支付 webhook 处理器

**代码示例**：
```javascript
// 在支付成功的回调中
const emailService = require('../lib/email-service');

async function handleWechatNotify(params) {
  // ... 订单处理
  
  // 发送确认邮件
  await emailService.sendOrderConfirmation(
    userEmail,
    {
      orderNo: params.out_trade_no,
      product: '八字年运报告',
      amount: params.total_fee,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    },
    userLanguage || 'cn'
  );
}
```

### B. 续费提醒集成

**文件**：`server/index.js` 或独立 cron 任务

**代码示例**：
```javascript
const cron = require('node-cron');
const emailService = require('./lib/email-service');

// 每天凌晨 2 点检查
cron.schedule('0 2 * * *', async () => {
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  // 从数据库查询即将到期的订阅
  const subscriptions = await db.query(
    `SELECT email, plan_name, expires_at, language 
     FROM subscriptions 
     WHERE expires_at <= $1 AND reminder_sent = false`,
    [sevenDaysLater]
  );
  
  for (const sub of subscriptions) {
    const sent = await emailService.sendRenewalReminder(
      sub.email,
      {
        planName: sub.plan_name,
        expiresAt: sub.expires_at,
        renewalPrice: 9900  // 从产品表获取
      },
      sub.language || 'cn'
    );
    
    if (sent) {
      // 标记已发送，避免重复
      await db.query(
        'UPDATE subscriptions SET reminder_sent = true WHERE id = $1',
        [sub.id]
      );
    }
  }
});
```

### C. 邀请系统集成

**文件**：`server/routes/invite.js` 或邀请处理器

**代码示例**：
```javascript
const emailService = require('../lib/email-service');

router.post('/invite/verify', async (req, res) => {
  const { code, email } = req.body;
  
  // 验证邀请码
  const referrer = await getReferrerByCode(code);
  if (!referrer) return res.status(400).json({ error: 'invalid code' });
  
  // 注册新用户
  const newUser = await createUser(email);
  
  // 增加推荐者的邀请计数
  await incrementReferralCount(referrer.id);
  
  // 获取推荐者的最新统计
  const stats = await getReferrerStats(referrer.id);
  
  // 发送成功邮件给推荐者
  const reward = 1000;  // ¥10
  await emailService.sendReferralSuccess(
    referrer.email,
    {
      inviteeName: email,
      reward: reward,
      currentLevel: stats.current_level,
      nextLevelRequired: Math.max(0, stats.next_level_threshold - stats.referral_count)
    },
    referrer.language || 'cn'
  );
  
  // 记录邀请历史
  await logReferral(referrer.id, newUser.id, reward);
  
  res.json({ ok: true });
});
```

## API 参考

### 三个主要端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/email/send-order-confirmation` | POST | 发送订单确认 |
| `/api/email/send-renewal-reminder` | POST | 发送续费提醒 |
| `/api/email/send-referral-success` | POST | 发送邀请成功 |

### 请求/响应格式

#### 1. 订单确认

**请求**：
```json
{
  "to": "user@example.com",
  "orderNo": "sy_20260810_001",
  "product": "八字年运报告",
  "amount": 9900,
  "expiresAt": "2027-08-10T00:00:00Z",
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

#### 2. 续费提醒

**请求**：
```json
{
  "to": "user@example.com",
  "planName": "年度会员",
  "expiresAt": "2026-08-17T00:00:00Z",
  "renewalPrice": 9900,
  "lang": "cn"
}
```

#### 3. 邀请成功

**请求**：
```json
{
  "to": "referrer@example.com",
  "inviteeName": "张三",
  "reward": 1000,
  "currentLevel": "青铜",
  "nextLevelRequired": 3,
  "lang": "cn"
}
```

## 邮件模板预览

### 中文版本

所有模板都已创建在 `server/email/templates/` 下：

- ✅ `order_confirmation-cn.html` - 订单确认（中文）
  - 金色主题，品牌统一
  - 包含有效期提示
  - 立即查看报告 CTA

- ✅ `renewal_reminder-cn.html` - 续费提醒（中文）
  - 7 天倒计时突出
  - 断点续约保障强调
  - 权益列表展示

- ✅ `referral_success-cn.html` - 邀请成功（中文）
  - 庆祝动画头部
  - 等级进度条
  - 排行榜链接

### 英文/韩文版本

完全相同的结构和设计，仅语言不同：
- `order_confirmation-en/kr.html`
- `renewal_reminder-en/kr.html`
- `referral_success-en/kr.html`

## 技术细节

### 邮件服务库接口

```javascript
// server/lib/email-service.js

// 1. 发送订单确认
sendOrderConfirmation(email, order, lang)
// @param email: 收件人
// @param order: {orderNo, product, amount, expiresAt}
// @param lang: 'cn'|'en'|'kr'
// @returns Promise<boolean>

// 2. 发送续费提醒
sendRenewalReminder(email, subscription, lang)
// @param subscription: {planName, expiresAt, renewalPrice}

// 3. 发送邀请成功
sendReferralSuccess(email, referral, lang)
// @param referral: {inviteeName, reward, currentLevel, nextLevelRequired}

// 4. 手动发送邮件
sendEmail(to, subject, html)
// 原始发送函数，用于自定义邮件

// 5. 编译模板
compileTemplate(templateName, lang, variables)
// 加载并编译邮件模板
```

### 变量替换机制

所有模板使用简单的正则替换：
```javascript
// 格式：{{variableName}}
const placeholder = new RegExp('{{\\s*' + key + '\\s*}}', 'g');
template = template.replace(placeholder, value);
```

### 多语言回退

如果请求的语言模板不存在，自动回退到英文：
```javascript
if (lang !== 'en') {
  return compileTemplate(templateName, 'en', variables);
}
```

## 价格 & 成本

### Resend 定价

| 套餐 | 月费 | 邮件数 | 推荐场景 |
|------|------|--------|---------|
| 免费 | $0 | 100/天 | 测试、小规模 |
| Pro | $20 | 无限制 | 中等规模（<100K/月） |
| Enterprise | 自定价 | 无限制 | 大规模（>1M/月） |

### 成本估算（月度）

- 100 个用户：100 封确认 + 100 封续费 = 200 封 → **$0（免费版）**
- 1,000 个用户：1K 确认 + 1K 续费 + 邀请 = ~3K 封 → **$20/月**
- 10,000 个用户：10K 确认 + 10K 续费 + 邀请 = ~30K 封 → **$20/月**

> 使用 Resend 的优势：始终费率透明，无隐藏费用。

## 监控 & 日志

### 查看邮件发送日志

所有邮件发送事件都记录在 server 日志中：

```
[email-service] sent to user@example.com id: mail_xxxxx
[email-service] resend error: invalid_email
[email] send-order-confirmation error: RESEND_API_KEY not set
```

### Resend 仪表板

登录 https://resend.com → Emails 标签查看：
- 邮件发送历史
- 打开率/点击率
- 退件和投诉

## 故障排除

### 问题：收不到邮件

**检查项**：
1. ✅ `RESEND_API_KEY` 已在 `server/.env` 中设置
2. ✅ API Key 有效（登录 Resend 验证）
3. ✅ 邮件地址格式正确
4. ✅ 检查 server logs 中的错误消息

**常见错误**：
```
[error] RESEND_API_KEY not set, skip send
→ 解决：添加环境变量并重启服务器

[error] invalid_email
→ 解决：检查邮件地址是否包含 @，避免测试账户

[error] template not found: order_confirmation-es.html
→ 解决：使用支持的语言（cn/en/kr），不存在时回退到 en
```

### 问题：邮件内容显示错误

**检查项**：
1. ✅ 所有 HTML 文件都在 `server/email/templates/` 下
2. ✅ 文件名格式正确：`{name}-{lang}.html`
3. ✅ 没有使用不支持的变量
4. ✅ 邮件客户端兼容性

## 后续增强

### 第二阶段（可选）

- [ ] 邮件模板版本管理（Git）
- [ ] A/B 测试支持（多个模板变体）
- [ ] 邮件发送队列（处理高并发）
- [ ] 打开率/点击率追踪（Resend webhooks）
- [ ] 重试机制（发送失败自动重试）
- [ ] 批量发送 API

### 第三阶段（长期）

- [ ] 用户邮件偏好管理
- [ ] 个性化邮件内容（动态数据）
- [ ] 更多语言支持（日文/西班牙文等）
- [ ] 邮件分析仪表板
- [ ] SMS + 邮件组合通知

## 部署检查清单

在上线前，确保已完成以下步骤：

- [ ] ✅ `RESEND_API_KEY` 已设置且有效
- [ ] ✅ 所有 9 个邮件模板都存在
- [ ] ✅ `server/lib/email-service.js` 已创建
- [ ] ✅ `server/routes/email.js` 已更新（新端点）
- [ ] ✅ 支付系统已集成 `sendOrderConfirmation()`
- [ ] ✅ Cron 任务已配置（续费提醒）
- [ ] ✅ 邀请系统已集成 `sendReferralSuccess()`
- [ ] ✅ 在生产环境测试发送（非 test@example.com）
- [ ] ✅ 监控日志，确保没有发送错误

## 文件清单

所有创建/修改的文件：

```
✅ server/email/templates/
   ✅ order_confirmation-cn.html
   ✅ order_confirmation-en.html
   ✅ order_confirmation-kr.html
   ✅ renewal_reminder-cn.html
   ✅ renewal_reminder-en.html
   ✅ renewal_reminder-kr.html
   ✅ referral_success-cn.html
   ✅ referral_success-en.html
   ✅ referral_success-kr.html
   ✅ README.md

✅ server/lib/
   ✅ email-service.js (新建)

✅ server/routes/
   ✅ email.js (已更新，添加 3 个新端点)

✅ docs/
   ✅ INTEGRATION-GUIDE-EMAIL.md (本文档)
```

---

**创建时间**：2026-08-10
**版本**：1.0
**状态**：✅ 生产就绪

如有任何问题或需要调整，请联系开发团队。
