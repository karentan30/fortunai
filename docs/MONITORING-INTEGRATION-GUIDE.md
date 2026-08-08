# 监控告警系统 - 后端集成指南

## 📖 简介

本文档说明如何在善缘后端服务中集成监控告警系统,以实时监控支付、邀请、服务器健康等关键指标。

**核心原理**:
```
后端事件 (支付/邀请/监控)
    ↓
HTTP POST 到 http://localhost:3007/alert/{type}
    ↓
告警系统验证 + 指标更新 + 阈值判断
    ↓
超过阈值时自动发送 Slack 通知
```

---

## 🚀 快速开始

### 前置条件

1. 告警系统已启动: `pm2 start slack-alerts.js`
2. 能访问 `http://localhost:3007/health` 返回 `{"status": "healthy"}`
3. 后端服务能通过 localhost:3007 访问

### 最简集成 (支付事件)

在支付处理逻辑中添加:

```javascript
// backend/services/payment.js

async function handlePaymentSuccess(order) {
  // 1. 处理支付...
  const paymentResult = await stripe.charges.create({...});

  // 2. 发送告警通知
  const alertResponse = await fetch('http://localhost:3007/alert/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'success',
      amount: order.amount,
      orderId: order.id,
      userId: order.userId,
      processingTime: Date.now() - startTime,
    }),
  });

  // 3. 处理响应(可选)
  if (!alertResponse.ok) {
    console.warn('告警系统响应异常:', alertResponse.status);
    // 不影响主流程,告警系统故障不应中断支付
  }

  return paymentResult;
}
```

---

## 📊 集成点详细说明

### 1. 支付事件集成

**文件**: `backend/services/payment.js` 或 `backend/routes/payments.js`

#### 支付成功

```javascript
// 在 Stripe webhook 处理成功事件后
async function onPaymentSuccess(event) {
  const charge = event.data.object;

  try {
    // 数据库操作...
    await Order.update(charge.metadata.orderId, { 
      status: 'paid',
      stripeChargeId: charge.id,
    });

    // 发送告警
    await alertSystem.payment({
      type: 'success',
      amount: charge.amount / 100, // Stripe使用分
      orderId: charge.metadata.orderId,
      userId: charge.metadata.userId,
      processingTime: charge.created * 1000 - parseFloat(charge.metadata.createdAt),
    });

  } catch (error) {
    console.error('支付成功处理失败:', error);
  }
}
```

#### 支付失败

```javascript
// 在 Stripe webhook 处理失败事件后
async function onPaymentFailure(event) {
  const charge = event.data.object;

  // 发送告警(包含失败原因)
  await alertSystem.payment({
    type: 'failure',
    amount: charge.amount / 100,
    orderId: charge.metadata.orderId,
    userId: charge.metadata.userId,
    error: charge.failure_message || 'Unknown error',
    processingTime: Date.now() - parseFloat(charge.metadata.createdAt),
  });

  // 发送邮件给用户
  await email.send({
    to: charge.billing_details.email,
    template: 'payment-failed',
    data: {
      orderId: charge.metadata.orderId,
      reason: charge.failure_message,
      retryUrl: `/checkout/${charge.metadata.orderId}/retry`,
    },
  });
}
```

#### 支付异常处理

```javascript
// Stripe 捕获特定错误类型
async function handleStripeError(error) {
  // 映射Stripe错误到告警系统
  const errorTypeMap = {
    'card_declined': 'card_declined',
    'insufficient_funds': 'insufficient_funds',
    'authentication_failed': 'authentication_failed',
    'rate_limit': 'rate_limit_exceeded',
    'service_error': 'api_error',
  };

  const alertError = errorTypeMap[error.type] || error.type;

  await alertSystem.payment({
    type: 'failure',
    amount: error.amount || 0,
    orderId: error.orderId,
    userId: error.userId,
    error: `${alertError}: ${error.message}`,
    processingTime: error.processingTime || 0,
  });

  // Sentry 异常追踪
  Sentry.captureException(error, {
    tags: { service: 'payment', alert: alertError },
  });
}
```

---

### 2. 邀请激活集成

**文件**: `backend/services/invite.js` 或 `backend/routes/invites.js`

#### 邀请发送

```javascript
async function sendInvite(referrerId, recipientEmail) {
  const invite = await Invite.create({
    referrerId,
    recipientEmail,
    code: generateInviteCode(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天
  });

  // 发送邮件
  const inviteLink = `${process.env.BASE_URL}/join?code=${invite.code}`;
  await email.send({
    to: recipientEmail,
    template: 'invite-email',
    data: { referrerName: referrerId, inviteLink },
  });

  // 发送告警(用于监控邀请发送流量)
  await alertSystem.invite({
    referrer: referrerId,
    invitee: 'unknown', // 尚未激活,暂不知道
    activated: false,
    activatedAt: null,
    reward: null,
  });

  return invite;
}
```

#### 用户激活邀请

```javascript
// 在 /join?code=xxx 端点,用户注册时触发
async function activateInviteCode(code, newUserId) {
  const invite = await Invite.findOne({ code });

  if (!invite || invite.expiresAt < new Date()) {
    throw new Error('邀请链接已过期');
  }

  // 标记邀请为已激活
  await invite.update({
    activatedAt: new Date(),
    activatedUserId: newUserId,
  });

  // 计算报酬
  const reward = calculateReward(invite.referrerId, newUserId);
  await RewardTransaction.create({
    userId: invite.referrerId,
    amount: reward,
    type: 'invite_activation',
    description: `邀请 ${newUserId} 激活`,
  });

  // 发送告警
  await alertSystem.invite({
    referrer: invite.referrerId,
    invitee: newUserId,
    activated: true,
    activatedAt: invite.activatedAt.toISOString(),
    reward,
  });

  // 发送庆祝邮件给referrer
  await email.send({
    to: `${invite.referrerId}@shenyuan.com`,
    template: 'invite-successful',
    data: { reward },
  });

  return invite;
}
```

---

### 3. 服务器监控集成

**文件**: `backend/middleware/metrics.js` 或 `backend/health-check.js`

#### 请求计数(拦截器)

```javascript
// Express中间件统计请求和错误
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    // 记录到内存指标
    global.metrics = global.metrics || { requests: 0, errors: 0 };
    global.metrics.requests++;
    if (status >= 400) {
      global.metrics.errors++;
    }

    // 定期上报(见下方定时任务)
  });

  next();
};

// 在 app.js 中使用
app.use(metricsMiddleware);
```

#### 定时上报服务器指标

```javascript
// backend/tasks/server-metrics-reporter.js

import os from 'os';
import si from 'systeminformation'; // npm install systeminformation

export async function reportServerMetrics() {
  try {
    // 获取系统指标
    const cpuLoad = os.loadavg()[0];
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    // 获取磁盘使用(linux)
    const disks = await si.fsSize();
    const diskUsage = disks[0]; // 主分区
    const diskUsagePercent = (diskUsage.used / diskUsage.size) * 100;

    // 获取CPU使用率
    const cpuUsage = await si.currentLoad();

    // 获取本地指标
    const errors = global.metrics?.errors || 0;
    const requests = global.metrics?.requests || 1;

    // 上报到告警系统
    const response = await fetch('http://localhost:3007/alert/server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memory: Math.round(memoryUsagePercent),
        disk: Math.round(diskUsagePercent),
        cpu: Math.round(cpuUsage.currentLoad),
        errors,
        requests,
      }),
    });

    if (!response.ok) {
      console.warn('服务器指标上报失败:', response.status);
    }

    // 重置计数器
    global.metrics = { requests: 0, errors: 0 };

  } catch (error) {
    console.error('获取服务器指标失败:', error);
  }
}

// 在 app.js 启动时注册定时任务
import cron from 'node-cron';

// 每5分钟执行一次
cron.schedule('*/5 * * * *', reportServerMetrics);
```

---

## 🔧 工具类封装 (推荐)

创建 `backend/services/alert-system.js` 方便调用:

```javascript
/**
 * 告警系统客户端
 * 负责与监控系统通信
 */

class AlertSystem {
  constructor(baseUrl = 'http://localhost:3007') {
    this.baseUrl = baseUrl;
    this.timeout = 5000; // 5秒超时
  }

  /**
   * 支付事件通知
   */
  async payment({ type, amount, orderId, userId, error, processingTime }) {
    try {
      const response = await this._fetch('/alert/payment', {
        type,
        amount,
        orderId,
        userId,
        error,
        processingTime,
      });

      return response;
    } catch (err) {
      // 告警系统故障不应影响主流程
      console.error('[ALERT] 支付事件发送失败:', err.message);
      return null;
    }
  }

  /**
   * 邀请事件通知
   */
  async invite({ referrer, invitee, activated, activatedAt, reward }) {
    try {
      const response = await this._fetch('/alert/invite', {
        referrer,
        invitee,
        activated,
        activatedAt,
        reward,
      });

      return response;
    } catch (err) {
      console.error('[ALERT] 邀请事件发送失败:', err.message);
      return null;
    }
  }

  /**
   * 查询当前指标(仅用于debug)
   */
  async getMetrics() {
    try {
      const response = await fetch(`${this.baseUrl}/metrics`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('[ALERT] 获取指标失败:', err.message);
      return null;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 内部方法: 发送HTTP请求
   */
  async _fetch(endpoint, data) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// 导出单例
export const alertSystem = new AlertSystem(
  process.env.ALERT_SYSTEM_URL || 'http://localhost:3007'
);
```

**使用示例**:

```javascript
import { alertSystem } from './alert-system.js';

// 在支付成功处理中
await alertSystem.payment({
  type: 'success',
  amount: 99.9,
  orderId: 'order-123',
  userId: 'user-456',
  processingTime: 1200,
});

// 在邀请激活中
await alertSystem.invite({
  referrer: 'user-123',
  invitee: 'user-789',
  activated: true,
  activatedAt: new Date().toISOString(),
  reward: 50,
});

// 健康检查(可选)
const isHealthy = await alertSystem.healthCheck();
if (!isHealthy) {
  console.warn('告警系统不可用,告警将不会发送');
}
```

---

## 🛡️ 错误处理最佳实践

### 1. 不阻塞主流程

```javascript
// ❌ 错误: 支付因为告警系统故障而失败
async function processPayment() {
  await stripe.charge.create(...);
  await alertSystem.payment(...); // 如果这个失败会中断flow
}

// ✅ 正确: 告警系统故障不影响支付
async function processPayment() {
  const result = await stripe.charge.create(...);
  
  // 异步发送告警,不等待响应
  alertSystem.payment(...)
    .catch(err => {
      console.error('告警发送失败,继续处理');
      Sentry.captureException(err);
    });
  
  return result;
}
```

### 2. 实现重试机制

```javascript
async function sendAlertWithRetry(alertFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await alertFn();
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('告警发送最终失败:', error);
        return null;
      }
      // 指数退避重试
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}

// 使用
sendAlertWithRetry(() => alertSystem.payment(...));
```

### 3. 批量上报

```javascript
class BatchAlertQueue {
  constructor(batchSize = 10, flushInterval = 5000) {
    this.queue = [];
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.startFlushInterval();
  }

  add(alert) {
    this.queue.push(alert);
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    try {
      await Promise.all(batch.map(alert => alertSystem[alert.type](alert.data)));
    } catch (error) {
      console.error('批量上报失败:', error);
    }
  }

  startFlushInterval() {
    setInterval(() => this.flush(), this.flushInterval);
  }
}

const batchQueue = new BatchAlertQueue();

// 使用
batchQueue.add({
  type: 'payment',
  data: { type: 'success', amount: 99.9, ... },
});
```

---

## 📝 日志记录规范

### 支付事件日志格式

```javascript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  service: 'payment',
  action: 'charge_created',
  orderId: charge.metadata.orderId,
  status: 'success', // success/failure
  amount: charge.amount / 100,
  duration: Date.now() - startTime,
  provider: 'stripe',
  chargeId: charge.id,
}));
```

### 邀请事件日志格式

```javascript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  service: 'invites',
  action: 'invite_activated',
  referrerId: invite.referrerId,
  userId: newUserId,
  reward: rewardAmount,
  inviteCode: invite.code,
}));
```

---

## 🧪 测试

### 单元测试

```javascript
import { alertSystem } from '../alert-system.js';

describe('AlertSystem', () => {
  it('应该成功发送支付通知', async () => {
    const result = await alertSystem.payment({
      type: 'success',
      amount: 99.9,
      orderId: 'test-001',
      userId: 'user-123',
      processingTime: 1200,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('应该能处理网络错误', async () => {
    // 模拟告警系统故障
    const result = await alertSystem.payment({
      type: 'success',
      amount: 99.9,
      orderId: 'test-002',
      userId: 'user-456',
      processingTime: 5000, // 会导致超时
    });

    // 应该返回null而不是抛错
    expect(result).toBeNull();
  });
});
```

### 集成测试

```bash
# 1. 启动告警系统
pm2 start slack-alerts.js

# 2. 发送测试请求
curl -X POST http://localhost:3007/alert/payment \
  -H "Content-Type: application/json" \
  -d '{
    "type": "success",
    "amount": 99.9,
    "orderId": "integration-test-001",
    "userId": "test-user",
    "processingTime": 1200
  }'

# 3. 检查Slack通知
# 验证 #shenyuan-payments 频道收到通知

# 4. 查询指标
curl http://localhost:3007/metrics | jq .
```

---

## 📊 监控看板使用

打开 `monitoring-dashboard.html` 实时查看:

- **支付成功率**: 应该 > 95%
- **邀请激活率**: 应该 > 70%
- **服务器资源**: 内存 < 80%, 磁盘 < 85%
- **API错误率**: 应该 < 2%

**常见问题排查**:

| 指标 | 异常表现 | 检查项 |
|-----|---------|--------|
| 支付成功率 < 90% | 支付大量失败 | Stripe状态/API key/卡验证 |
| 邀请激活率 < 50% | 流失率过高 | 邮件投递/激活流程/奖励 |
| 内存 > 85% | 内存持续高占用 | 内存泄漏/缓存过大 |
| 错误率 > 5% | API错误突增 | 查看错误日志/数据库连接 |

---

## 🚀 部署清单

- [ ] 告警系统已启动并通过健康检查
- [ ] Slack webhook已配置到 `~/.env.production`
- [ ] 后端已导入 `alert-system.js`
- [ ] 支付处理逻辑已集成告警
- [ ] 邀请激活流程已集成告警
- [ ] 服务器监控定时任务已启动
- [ ] 告警规则已根据业务调整 (docs/alert-rules.md)
- [ ] 监控看板已部署并可访问
- [ ] Slack 频道已创建并配置权限
- [ ] 团队已培训告警处理流程

---

## 📞 支持

- **问题排查**: `pm2 logs shenyuan-alerts`
- **重启系统**: `pm2 restart shenyuan-alerts`
- **查看配置**: `cat ~/.env.production | grep SLACK`
- **规则文档**: `docs/alert-rules.md`
- **架构设计**: `scripts/slack-alerts.js`

---

**最后更新**: 2026-08-08  
**维护者**: DevOps Team
