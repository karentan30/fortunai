# 善缘视频通话 - 支付集成指南

> 将实时视频通话与支付系统集成，实现「预付订单 → 咨询师接入 → 用户加入 → 计费结算」的完整流程

## 支付流程概览

```
用户选择咨询师 → 创建订单 → 扫码支付 → 获得 sessionId
                                    ↓
咨询师接到通知 → 发起通话 → 用户加入 → 实时通话
                                    ↓
通话结束 → 上报时长 → 对账结算 → 生成收据
```

---

## 1. 产品定义

### 在 `server/lib/store.js` 中添加视频通话产品

```javascript
const PRODUCTS = {
  // ... 既有产品 ...
  
  // 新增：视频通话产品（按时长定价）
  'video_call_30min': {
    id: 'video_call_30min',
    name: '30分钟实时咨询',
    description: '与命理师进行30分钟实时音视频通话',
    amountCny: 9900,      // ¥99
    amountUsd: 1390,      // $13.90
    duration: 1800,       // 秒数
    type: 'video-call',
    category: 'consultation'
  },
  
  'video_call_1hour': {
    id: 'video_call_1hour',
    name: '1小时实时咨询',
    description: '与命理师进行1小时实时音视频通话',
    amountCny: 19900,     // ¥199
    amountUsd: 2790,      // $27.90
    duration: 3600,       // 秒数
    type: 'video-call',
    category: 'consultation'
  },
  
  'video_call_90min': {
    id: 'video_call_90min',
    name: '90分钟实时咨询',
    description: '与命理师进行90分钟实时音视频通话',
    amountCny: 29900,     // ¥299
    amountUsd: 4190,      // $41.90
    duration: 5400,       // 秒数
    type: 'video-call',
    category: 'consultation'
  }
};
```

### 更新支付 API 响应

在 `server/routes/payment.js` 的 `GET /api/products` 端点中，这些产品会自动包含在响应中：

```bash
curl http://localhost:3021/api/products
```

---

## 2. 订单创建流程

### 2.1 创建视频通话订单

**Endpoint:** `POST /api/create-checkout`（现有端点）

咨询师应该支持创建视频通话订单。修改现有逻辑以支持 `video_call_*` 产品：

**请求：**
```json
{
  "product": "video_call_1hour",
  "consultantId": 456,
  "consultantName": "李师傅",
  "email": "user@example.com",
  "region": "CN",
  "currency": "cny"
}
```

**预期响应（国内用户）：**
```json
{
  "channel": "cn",
  "product": "video_call_1hour",
  "amountCny": 19900,
  "message": "国内用户请使用微信支付或支付宝"
}
```

### 2.2 创建数据库订单记录

在 `server/lib/store.js` 中添加视频通话订单类型：

```javascript
// 扩展现有的 insertOrder 函数
const insertOrder = {
  run(type, productId, userId, amount, metadata = {}) {
    const id = _M._id.o++;
    const order = {
      id,
      type,           // 'divination' | 'product' | 'video-call'
      productId,
      userId,
      amount,
      status: 'pending',  // pending → completed → refunded
      paidAt: null,
      consultantId: metadata.consultantId || null,
      consultantName: metadata.consultantName || null,
      sessionId: metadata.sessionId || null,  // 通话 session ID
      durationSeconds: metadata.durationSeconds || 0,
      createdAt: new Date().toISOString()
    };
    _M.orders.push(order);
    _persist();
    return { id, ...order };
  }
};
```

---

## 3. 支付完成后的流程

### 3.1 Stripe Webhook 处理

修改 `server/routes/payment.js` 中的 Stripe webhook 处理器，支持视频通话订单：

```javascript
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // ... 现有验证逻辑 ...
  
  if (event.type === 'charge.succeeded' || event.type === 'payment_intent.succeeded') {
    const charge = event.data.object;
    const orderId = charge.metadata?.orderId;
    const order = findOrder(orderId);
    
    if (order && order.type === 'video-call') {
      // 视频通话订单完成支付
      order.status = 'completed';
      order.paidAt = new Date().toISOString();
      
      // 创建通话会话（待咨询师接入）
      const session = createVideoCallSession({
        orderId,
        consultantId: order.consultantId,
        userId: order.userId,
        consultantName: order.consultantName,
        userEmail: charge.billing_details.email,
        duration: getProductDuration(order.productId)  // 从产品表获取时长
      });
      
      order.sessionId = session.id;
      _persist();
      
      // 发送通知给咨询师
      notifyConsultantIncoming(order.consultantId, {
        clientName: charge.billing_details.name,
        clientEmail: charge.billing_details.email,
        sessionId: session.id,
        duration: getProductDuration(order.productId) / 60,  // 分钟数
        actionUrl: `${FRONTEND_URL}/pages/video-call.html?mode=consultant&sessionId=${session.id}`
      });
    }
  }
});
```

### 3.2 微信支付完成处理

修改 `server/routes/payment.js` 中的微信支付通知处理器：

```javascript
router.post('/pay/wechat/notify', (req, res) => {
  // ... 现有验证逻辑 ...
  
  if (result.result_code === 'SUCCESS') {
    const orderId = result.out_trade_no;
    const order = findOrder(orderId);
    
    if (order && order.type === 'video-call') {
      order.status = 'completed';
      order.paidAt = new Date().toISOString();
      
      // 创建通话会话
      const session = createVideoCallSession({
        orderId,
        consultantId: order.consultantId,
        userId: order.userId,
        consultantName: order.consultantName,
        userEmail: order.userEmail,
        duration: getProductDuration(order.productId)
      });
      
      order.sessionId = session.id;
      _persist();
      
      // 发送用户通知
      notifyUserOrderComplete(order.userId, {
        consultantName: order.consultantName,
        sessionId: session.id,
        joinUrl: `${FRONTEND_URL}/pages/video-call.html?sessionId=${session.id}`
      });
    }
  }
});
```

---

## 4. 咨询师端：接入通话

### 4.1 咨询师仪表板

创建 `pages/consultant-dashboard.html`：

```html
<div class="bookings-list">
  <!-- 待接入的通话 -->
  <div class="booking-card" data-session-id="session-id-123">
    <h3>用户名</h3>
    <p>时长：1小时</p>
    <p>费用：¥199</p>
    <button class="btn-primary" onclick="startCall(this)">接入通话</button>
  </div>
</div>

<script>
async function startCall(button) {
  const sessionId = button.closest('.booking-card').dataset.sessionId;
  
  // 调用后端 API 发起通话
  const res = await fetch('/api/video-call/start-session', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getConsultantToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId,
      consultantId: getCurrentConsultantId(),
      consultantName: getCurrentConsultantName()
    })
  });
  
  const data = await res.json();
  if (data.ok) {
    // 跳转到视频通话界面
    window.location.href = `/pages/video-call.html?sessionId=${sessionId}&mode=consultant&token=${data.session.token}`;
  }
}
</script>
```

### 4.2 发起通话 API

修改 `server/routes/video-call.js`：

```javascript
// POST /api/video-call/start-session
router.post('/start-session', authenticateConsultant, async (req, res) => {
  try {
    const { sessionId, consultantId, consultantName } = req.body;
    
    // 1. 验证 sessionId 对应的订单存在且已支付
    const order = _M.orders.find(o => o.sessionId === sessionId && o.type === 'video-call');
    if (!order || order.status !== 'completed') {
      return res.status(400).json({ error: '订单无效或未支付' });
    }
    
    // 2. 生成咨询师的 token
    const channelName = generateChannelName(consultantId, order.userId);
    const consultantToken = generateAgoraToken(
      channelName,
      consultantId,
      'publisher'
    );
    
    // 3. 更新会话状态
    const session = findSession(sessionId);
    session.channel = channelName;
    session.status = 'initiated';  // 等待用户加入
    _persist();
    
    res.json({
      ok: true,
      session: {
        id: sessionId,
        channel: channelName,
        appId: AGORA_APP_ID,
        uid: consultantId,
        token: consultantToken,
        role: 'consultant',
        expiresAt: calculateExpiry()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 5. 用户端：加入通话

### 5.1 支付完成后的用户流程

用户完成支付后，前端应显示「接听通话」按钮：

```html
<!-- 支付成功后的页面 -->
<div class="success-screen">
  <h2>支付成功！</h2>
  <p>您将于 <span id="appointmentTime">2026-08-11 15:00</span> 与李师傅通话</p>
  
  <!-- 如果咨询师已接入，显示此按钮 -->
  <button id="joinBtn" style="display:none;" onclick="joinCall()">
    接听通话
  </button>
  
  <!-- 轮询检查咨询师是否接入 -->
  <script>
    const sessionId = new URLSearchParams(location.search).get('sessionId');
    
    // 每 2 秒检查一次通话状态
    setInterval(async () => {
      const res = await fetch(`/api/video-call/session/${sessionId}`);
      const data = await res.json();
      
      if (data.session.status === 'initiated') {
        document.getElementById('joinBtn').style.display = 'block';
      }
    }, 2000);
    
    function joinCall() {
      window.location.href = `/pages/video-call.html?sessionId=${sessionId}`;
    }
  </script>
</div>
```

---

## 6. 结算流程

### 6.1 通话结束时上报数据

前端调用 `POST /api/video-call/end-session`（已在 `video-call.html` 实现）

### 6.2 后端处理结算

修改 `server/routes/video-call.js` 中的结束通话处理：

```javascript
router.post('/end-session', async (req, res) => {
  try {
    const { sessionId, durationSeconds } = req.body;
    const session = findSession(sessionId);
    const order = _M.orders.find(o => o.sessionId === sessionId);
    
    if (!session || !order) {
      return res.status(404).json({ error: '会话或订单不存在' });
    }
    
    // 1. 更新会话记录
    session.status = 'ended';
    session.endTime = new Date().toISOString();
    session.durationSeconds = durationSeconds;
    
    // 2. 对账：比较实际时长与预付时长
    const bookedSeconds = getProductDuration(order.productId);
    const unusedSeconds = Math.max(0, bookedSeconds - durationSeconds);
    const refundAmount = Math.round((unusedSeconds / bookedSeconds) * order.amount);
    
    // 3. 如果有退款，处理退款
    if (refundAmount > 0) {
      await processRefund(order.id, refundAmount);
      order.refundAmount = refundAmount;
      order.refundStatus = 'processed';
    }
    
    // 4. 计算咨询师分成（假设 70% 分给咨询师）
    const consultantShare = Math.round((order.amount - refundAmount) * 0.7);
    const platformShare = order.amount - refundAmount - consultantShare;
    
    order.consultantShare = consultantShare;
    order.platformShare = platformShare;
    order.status = 'settled';
    order.settledAt = new Date().toISOString();
    
    _persist();
    
    res.json({
      ok: true,
      settlement: {
        totalCharged: order.amount,
        refunded: refundAmount,
        netCharged: order.amount - refundAmount,
        consultantShare,
        platformShare,
        durationSeconds,
        durationFormatted: formatDuration(durationSeconds)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 7. 咨询师提现

### 7.1 创建提现管理模块

在 `server/routes/` 中创建 `consultant-earnings.js`：

```javascript
const router = require('express').Router();

// GET /api/consultant/earnings
router.get('/earnings', authenticateConsultant, (req, res) => {
  const consultantId = req.user.id;
  
  // 汇总咨询师的所有分成
  const earnings = _M.orders
    .filter(o => o.type === 'video-call' && o.consultantId === consultantId && o.status === 'settled')
    .reduce((sum, o) => sum + (o.consultantShare || 0), 0);
  
  const withdrawn = _M.consultantWithdrawals
    .filter(w => w.consultantId === consultantId && w.status === 'success')
    .reduce((sum, w) => sum + w.amount, 0);
  
  const available = earnings - withdrawn;
  
  res.json({
    ok: true,
    earnings: {
      total: earnings,
      withdrawn,
      available,
      sessions: _M.orders.filter(o => o.type === 'video-call' && o.consultantId === consultantId).length
    }
  });
});

// POST /api/consultant/withdraw
router.post('/withdraw', authenticateConsultant, async (req, res) => {
  const { amount, bankAccount } = req.body;
  const consultantId = req.user.id;
  
  // 验证余额充足
  const available = calculateAvailableBalance(consultantId);
  if (amount > available) {
    return res.status(400).json({ error: '余额不足' });
  }
  
  // 创建提现记录（待支付宝/银行打款）
  const withdrawal = {
    id: generateId(),
    consultantId,
    amount,
    bankAccount,
    status: 'pending',  // pending → processing → success → failed
    createdAt: new Date().toISOString(),
    processedAt: null
  };
  
  _M.consultantWithdrawals.push(withdrawal);
  _persist();
  
  res.json({ ok: true, withdrawal });
});

module.exports = router;
```

---

## 8. 测试清单

### 支付流程测试

- [ ] Stripe 创建订单 → 支付成功 → 订单标记为 completed
- [ ] 微信支付 → 回调通知 → 订单状态更新
- [ ] 支付宝当面付 → 同步回调 → 订单创建成功

### 通话流程测试

- [ ] 咨询师接入 → sessionId 生成 → Agora token 获取
- [ ] 用户加入 → token 获取 → 远程视频可见
- [ ] 通话计时 → 时长记录准确
- [ ] 挂断 → 上报结束 → 后端处理结算

### 结算流程测试

- [ ] 通话时长 < 预付时长 → 自动退款
- [ ] 通话时长 > 预付时长 → 额外扣款（若有 card on file）
- [ ] 咨询师分成计算正确
- [ ] 提现审批流程正常

---

## 9. 监控与告警

### 关键指标

```bash
# 监控异常订单（支付完成但通话未发生）
SELECT * FROM orders 
WHERE type='video-call' 
  AND status='completed' 
  AND sessionId IS NULL 
  AND paidAt < NOW() - INTERVAL 1 HOUR;

# 监控异常通话（未完成的通话）
SELECT * FROM videoCallSessions 
WHERE status != 'ended' 
  AND startTime < NOW() - INTERVAL 2 HOUR;
```

### Sentry 集成

```javascript
// 在支付 webhook 和通话结束时发送监控事件
Sentry.captureEvent({
  level: 'info',
  message: 'Video call settlement',
  tags: {
    orderId,
    consultantId,
    status: 'settled'
  },
  extra: {
    amount: order.amount,
    consultantShare,
    durationSeconds
  }
});
```

---

## 相关文件

- `/server/lib/agora-integration.js` — Agora 核心库
- `/server/routes/video-call.js` — 通话 API
- `/server/routes/payment.js` — 支付 API（需要扩展）
- `/pages/video-call.html` — 通话 UI
- `/pages/consultant-dashboard.html` — 咨询师仪表板（待创建）
- `/docs/VIDEO-CALL-SETUP.md` — 部署指南

---

**最后更新：2026-08-11**
