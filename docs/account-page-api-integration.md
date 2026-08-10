# 善缘账户中心 (Account Page) — API 集成指南

## 概览

account.html 是完整的用户个人中心页面，包含5个功能模块：
1. **报告历史** (P0) - 已购报告列表
2. **邀请管理** (P0) - 5渠道邀请码 + 统计
3. **订阅管理** (P0) - 会员续费
4. **账户设置** (P1) - 个人资料编辑
5. **分享卡片** (P1) - Canvas生成邀请卡 (UI预留)

---

## API 端点完整清单

### 🔐 认证 (已有)
```
GET /api/auth/me
Headers: { Authorization: Bearer <token> }
Response: {
  user: { id, email, name, ref_code, birthday, gender },
  membership: { isMember: boolean, expiresAt: ISO8601 }
}
```

### 📋 报告历史
```
GET /api/orders/mine
Headers: { Authorization: Bearer <token> }
Response: {
  orders: [
    {
      id: number,
      product_name: string,
      product: string,
      amount: number,
      created_at: ISO8601,
      expires_at: ISO8601 (optional),
      payment_status: "completed" | "pending" | "failed"
    },
    ...
  ]
}
```

**说明**：
- 前端筛选包含 "报告", "八字", "合婚", "读" 等关键词的产品
- 排序：latest first (按 created_at DESC)
- 支持下载PDF (future feature - 需单独实现)

### 🎯 邀请管理 (已部分实现)
```
GET /api/referral/mine
Headers: { Authorization: Bearer <token> }
Response: {
  ref_codes: {
    tiktok: "ABC123_TK",
    xiaohongshu: "DEF456_XH",
    youtube: "GHI789_YT",
    wechat: "JKL012_WX",
    organic: "MNO345_ORG"
  },
  channel_urls: {
    tiktok: "https://shenyuan.mylumee.cn?ref=ABC123_TK",
    ...
  },
  invited_count: 25,
  converted_count: 12,    // NEW: 需后端补充
  current_tier: "Premium",
  next_tier_at: 50,
  total_bonus: 600,      // NEW: 需后端补充
  invitees: [           // NEW: 需后端补充
    {
      id: number,
      invitee_email: string,
      channel: string,
      created_at: ISO8601,
      converted: boolean,
      bonus: number
    },
    ...
  ],
  invitees_by_channel: { // NEW: 需后端补充
    tiktok: [...],
    xiaohongshu: [...],
    ...
  }
}
```

**后端缺失字段**：需在 routes/referral.js 补充
- `converted_count` - 已转化邀请数
- `total_bonus` - 累计奖励金额
- `invitees` - 详细邀请记录表 (每个邀请者信息)
- `invitees_by_channel` - 按渠道统计

### 💳 订阅管理
```
GET /api/auth/me
（已包含在认证端点中）

Response membership 字段:
{
  isMember: boolean,
  expiresAt: ISO8601,
  tier: "Standard" | "Premium" | "Yearly",  // NEW: 需补充
  price: "¥39/月" | "¥99/年",             // NEW: 需补充
}
```

### 👤 账户设置
```
POST /api/user/profile
Headers: { 
  Authorization: Bearer <token>,
  Content-Type: application/json
}
Body: {
  name: string,
  birthday: "YYYY-MM-DD",
  gender: "M" | "F" | "N"
}
Response: {
  ok: boolean,
  user: { id, email, name, birthday, gender }
}
```

---

## 后端实现检查清单

### ✅ 已实现
- [x] GET /api/auth/me
- [x] GET /api/orders/mine
- [x] GET /api/referral/mine (基础)
- [x] /api/referral/claim (认领邀请码)

### ❌ 需新增 / 补充

#### 1. 补充 GET /api/referral/mine 响应字段
在 `server/routes/referral.js` 中添加：

```javascript
router.get('/mine', authMiddleware, (req, res) => {
  // ... 现有代码 ...

  // 统计已转化邀请数 (有订单的邀请者)
  const invitees = require('../lib/store')._M.referrals
    .filter(ref => ref.inviter_id === req.user.id);
  
  const convertedInvitees = [];
  invitees.forEach(ref => {
    const inviteeOrders = require('../lib/store')._M.orders
      .filter(o => o.user_id === ref.invitee_id);
    convertedInvitees.push({
      id: ref.invitee_id,
      invitee_email: ref.invitee_email,
      channel: ref.channel,
      created_at: ref.created_at,
      converted: inviteeOrders.length > 0,
      bonus: ref.bonus || 0
    });
  });

  // 按渠道统计
  const inviteesByChannel = {};
  CHANNELS.forEach(ch => {
    inviteesByChannel[ch] = convertedInvitees.filter(inv => inv.channel === ch);
  });

  // 计算总奖励
  const totalBonus = convertedInvitees.reduce((sum, inv) => sum + (inv.bonus || 0), 0);

  res.json({
    ref_codes: ref_codes,
    channel_urls: channel_urls,
    invited_count: invited,
    converted_count: convertedInvitees.filter(inv => inv.converted).length,
    current_tier: tier?.level || 'pending',
    next_tier_at: tier?.max < 0 ? null : tier?.max + 1,
    total_bonus: totalBonus,
    invitees: convertedInvitees,
    invitees_by_channel: inviteesByChannel
  });
});
```

#### 2. 新增 POST /api/user/profile
在 `server/routes/auth.js` 中添加：

```javascript
router.post('/profile', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未登录' });

  const { name, birthday, gender } = req.body;
  const user = getUserById.get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  // 更新用户信息
  const idx = require('../lib/store')._M.users.findIndex(u => u.id === req.user.id);
  if (idx >= 0) {
    if (name !== undefined) require('../lib/store')._M.users[idx].name = name;
    if (birthday !== undefined) require('../lib/store')._M.users[idx].birthday = birthday;
    if (gender !== undefined) require('../lib/store')._M.users[idx].gender = gender;
    require('../lib/store')._persist();
  }

  res.json({
    ok: true,
    user: {
      id: req.user.id,
      email: user.email,
      name: name || user.name,
      birthday: birthday || '',
      gender: gender || ''
    }
  });
});
```

#### 3. 补充 membership 字段
在 `server/routes/auth.js` 的 GET /api/auth/me 中修改：

```javascript
router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未登录' });
  
  const u = getUserById.get(req.user.id);
  const orders = getUserOrders.all(req.user.id) || [];
  
  // 找到最新的会员订单
  const memberOrder = orders.find(function(o) {
    return UNLOCK_BY_CATEGORY['member'].indexOf(String(o.product || '')) >= 0 && !_isExpired(o);
  });
  
  const isMember = !!memberOrder;

  // 决定套餐名称和价格
  let tier = 'Basic';
  let price = '免费';
  if (memberOrder) {
    if (memberOrder.product === 'member_yearly') {
      tier = 'Yearly';
      price = '¥99/年';
    } else if (memberOrder.product === 'member_quarterly') {
      tier = 'Quarterly';
      price = '¥29/季度';
    } else {
      tier = 'Premium';
      price = '¥39/月';
    }
  }

  res.json({
    user: { 
      id: req.user.id, 
      email: req.user.email, 
      name: u?.name || '', 
      ref_code: u?.ref_code || null,
      birthday: u?.birthday || '',
      gender: u?.gender || ''
    },
    membership: {
      isMember: isMember,
      expiresAt: memberOrder?.expires_at || null,
      tier: tier,
      price: price
    }
  });
});
```

#### 4. 新增 GET /api/user/account (整合端点 - 可选)
一次请求获取所有账户数据（性能优化）：

```javascript
router.get('/account', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未登录' });

  const u = getUserById.get(req.user.id);
  const orders = getUserOrders.all(req.user.id) || [];
  const refData = /* 从 /referral/mine 逻辑提取 */;

  res.json({
    profile: { id: req.user.id, email: req.user.email, name: u?.name },
    reports: orders.filter(o => o.product_name?.includes('报告')),
    referral: refData,
    subscription: /* 会员信息 */
  });
});
```

---

## 前端实现细节

### 数据流
1. 用户访问 /pages/account.html
2. 前端检查 localStorage 的 sy_token
3. 未登录 → 重定向到 login.html
4. 已登录 → 加载用户信息 + 对应模块数据

### Tab 切换
```javascript
switchTab(tabName) {
  // tabName: 'reports' | 'referrals' | 'subscription' | 'settings'
  // 显示对应的 section-content，触发数据加载
}
```

### 缓存策略
- 首次进页面：自动加载报告 (reports tab)
- 用户点击 tab 时：才加载对应数据 (lazy load)
- 防止闭包泄露：每个 fetch 独立作用域

### 多语言支持
当前仅实现中文 (zh)。扩展方案：
```html
<!-- account-en.html (英文版) -->
<!-- account-kr.html (韩文版) -->

在页面顶级添加语言标识，后端 /api/* 根据 Accept-Language 返回对应文案
```

---

## 入口链接配置

### 添加到现有页面
```html
<!-- bazi.html / bazi-en.html / saju-landing-KR.html -->
<!-- 登录后显示 "个人中心" 链接 -->
<a href="/pages/account.html" class="nav-link">个人中心</a>
```

### 导航栏集成
在 common.js 或 header 组件中：
```javascript
if (isLoggedIn) {
  showAccountCenterLink();
}
```

---

## 数据保护 & 隐私红线

### 邀请码安全
- ✅ 邀请码仅本人登录后可见
- ✅ 不暴露他人的邀请码
- ✅ 排行榜隐藏详细排名（仅显示自己）

### 个人信息
- 邮箱显示为 disabled (只读)
- 生日/性别可选（为空时提示"未设置"）
- 支持匿名（不显示排行榜）

### 支付记录
- 仅显示已完成的订单 (`payment_status = 'completed'`)
- 隐藏内部产品ID，仅显示用户友好的名称
- 敏感信息（如支付方式）不显示

---

## 扩展功能 (Future)

### 分享卡片生成 (P1)
```javascript
// 使用 Canvas API 生成邀请卡
function generateShareCard(userData) {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  
  // 绘制背景
  ctx.fillStyle = '#8b1a1a';
  ctx.fillRect(0, 0, 400, 300);
  
  // 绘制文案
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px "Noto Serif SC"';
  ctx.fillText(`我已邀请${userData.invited_count}人`, 50, 100);
  ctx.fillText(`获得${userData.current_tier}等级`, 50, 140);
  
  // 转换为图片下载
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shenyuan-referral-card.png';
    a.click();
  });
}
```

### 订阅历史详情
```
GET /api/subscription/history
Response: [{
  startDate, endDate, tier, amount, autoRenew
}]
```

### 个人信息验证
```
POST /api/user/verify-email (发送验证码)
POST /api/user/confirm-email (验证邮箱)
```

---

## 测试清单

### 功能测试
- [ ] 未登录用户重定向到 login.html
- [ ] 已登录用户显示邮箱和昵称
- [ ] Tab 切换正常工作
- [ ] 报告列表正确渲染（包括图标、日期、过期状态）
- [ ] 邀请码显示 5 个渠道
- [ ] 邀请统计数字正确
- [ ] 邀请表格显示转化状态
- [ ] 订阅卡片显示正确的套餐和到期时间
- [ ] 账户设置表单能保存
- [ ] 复制邀请码成功提示

### 兼容性测试
- [ ] 移动端 (375px)
- [ ] 平板端 (768px)
- [ ] 桌面端 (1024px+)
- [ ] iOS Safari
- [ ] Android Chrome

### 性能测试
- [ ] 首屏加载 < 2s
- [ ] Tab 切换无卡顿
- [ ] 表格排序流畅 (>100条记录)

---

## 常见问题 (FAQ)

**Q: 如何处理网络错误?**
A: 所有 fetch 都有 .catch() 和 empty state 处理，显示友好的错误提示。

**Q: 邀请码过期了?**
A: 邀请码无过期时间，永久有效。但可根据业务需求添加过期逻辑。

**Q: 支持邀请自己的账户?**
A: 后端已防止 (inviter.id !== req.user.id)，前端隐藏自己的邀请码。

**Q: 报告可以删除吗?**
A: 当前不支持。数据落盘策略决定，建议保留所有历史记录。

---

## 部署注意事项

1. **环境变量**: 确保 BASE 为空串（前端和后端同源）
2. **Token 存储**: localStorage 的 sy_token，务必在 https 下使用 Secure flag
3. **CORS 配置**: 确保 account.html 所在域名在 ALLOWED_ORIGINS 中
4. **缓存策略**: account.html 设置 no-cache，让浏览器每次都验证

```javascript
// server/index.js 中
if (/\.html$/.test(filePath)) {
  res.setHeader('Cache-Control', 'no-cache');
}
```

---

## 联系信息

- 产品: 善缘 (ShenYuan) — 东方灵性平台
- 前端: /pages/account.html (Chinese/English/Korean versions)
- 后端: /server/routes/auth.js, referral.js, payment.js
- 部署: 47.242.80.65 (HK) + Vercel (海外)
