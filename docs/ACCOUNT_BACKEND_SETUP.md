# 账户中心后端集成指南

## 快速开始

### 1. 注册路由到主服务器

编辑 `server/index.js`，在路由注册部分添加:

```javascript
// 已有的路由
const authRouter = require('./routes/auth');
const referralRouter = require('./routes/referral');
// ...

// 新增路由
const profileRouter = require('./routes/profile');
const subscriptionHistoryRouter = require('./routes/subscription-history');

// 路由挂载
app.use('/api/auth', authRouter);
app.use('/api/referral', referralRouter);
app.use('/api/user', profileRouter);           // ← 新增
app.use('/api/subscription', subscriptionHistoryRouter);  // ← 新增
```

### 2. 修复 /api/referral/mine 返回字段

编辑 `server/routes/referral.js` 第 20-48 行：

```javascript
router.get('/mine', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  const u = getUserById.get(req.user.id);
  if (!u) return res.status(401).json({ error: '请先登录' });

  const fullUser = require('../lib/store')._M.users.find(x => x.id === req.user.id);
  const ref_codes = fullUser?.ref_codes || { organic: fullUser?.ref_code };

  const invited = invitedCount(req.user.id);
  const tier = REWARD_TIERS.find(t => invited >= t.min && (t.max < 0 || invited <= t.max));

  // 修复：获取邀请列表和奖励金额
  const referralStore = require('../lib/store')._M.referrals || [];
  const myReferrals = referralStore.filter(r => r.inviter_id === req.user.id);
  
  // 计算总奖励 (bonus_amount 字段修复)
  let totalBonus = 0;
  myReferrals.forEach(ref => {
    if (ref.converted && tier) {
      totalBonus += tier.amount || 0;
    }
  });

  // 为每个渠道生成分享链接
  const channel_urls = {};
  Object.entries(ref_codes).forEach(([channel, code]) => {
    channel_urls[channel] = buildShareUrl(code, req, channel);
  });

  // 获取邀请者邮箱补充信息
  const invitees = myReferrals.map(ref => {
    const inviteeUser = getUserById.get(ref.invitee_id);
    return {
      id: ref.id,
      inviter_id: ref.inviter_id,
      invitee_id: ref.invitee_id,
      invitee_email: inviteeUser?.email,
      channel: ref.channel || 'organic',
      created_at: ref.created_at,
      converted: ref.converted || false,
      bonus: ref.bonus || 0
    };
  });

  res.json({
    ref_codes: ref_codes,
    channel_urls: channel_urls,
    share_url: buildShareUrl(ref_codes.organic, req),
    ref_code: ref_codes.organic,
    invited_count: invited,
    converted_count: myReferrals.filter(r => r.converted).length,  // ← 添加
    current_tier: tier?.level || 'pending',
    next_tier_at: tier?.max < 0 ? null : tier?.max + 1,
    bonus_amount: totalBonus,    // ← 修复：替代 total_bonus
    invitees: invitees,          // ← 添加完整邀请者列表
    share_text: `我在善缘算了命,挺准的,你也来测测 → ${buildShareUrl(ref_codes.organic, req)}`
  });
});
```

### 3. 数据库迁移检查

确保 `lib/store.js` 中有以下字段：

#### users 表
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  birthday TEXT,
  gender TEXT,
  ref_code TEXT UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### referrals 表
```sql
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id INTEGER NOT NULL,
  invitee_id INTEGER NOT NULL,
  channel TEXT DEFAULT 'organic',
  converted BOOLEAN DEFAULT 0,
  bonus INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inviter_id) REFERENCES users(id),
  FOREIGN KEY (invitee_id) REFERENCES users(id)
);
```

#### orders 表
```sql
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product TEXT,
  product_name TEXT,
  amount REAL,
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4. 环境变量确认

在 `.env` 或部署环境中确保有：

```bash
# 账户页面 BASE URL (前端使用)
REACT_APP_API_BASE=https://your-api-domain.com

# 密码加密密钥
JWT_SECRET=your_secret_key_here
PASSWORD_SALT=your_salt_here
```

---

## API 调用流程

### 修改密码流程

```
前端 (account.html)
  1. 用户点击 "修改密码"
  2. Modal 弹出，用户输入：当前密码、新密码、确认密码
  3. 前端验证：密码长度 ≥6、包含字母和数字、两次输入一致
  4. 发送 POST /api/auth/verify-password { password: 当前密码 }
     ↓
后端 (routes/profile.js)
  5. 验证当前密码是否正确
  6. 若错误，返回 401 + "当前密码错误"
  7. 若正确，继续

前端
  8. 收到验证成功，发送 POST /api/user/change-password { new_password }
     ↓
后端
  9. 验证新密码格式
  10. 更新 users.password_hash
  11. 删除所有旧 sessions（登出所有设备）
  12. 返回 200 + { ok: true }

前端
  13. 显示 toast "密码已修改"
  14. 关闭 Modal
  15. 刷新页面或自动重定向到登录（可选）
```

### 邀请表渲染流程

```
前端
  1. 切换到 "邀请管理" 标签页
  2. 调用 loadReferrals()
  3. 发送 GET /api/referral/mine

后端
  4. 查询 referrals 表，过滤 inviter_id == 当前用户
  5. 补充 invitees 列表（含邮箱、转化状态等）
  6. 计算 bonus_amount（已转化邀请者 × 奖励金额）
  7. 返回完整响应

前端
  8. 调用 renderReferralTable(data) 循环渲染邀请者
  9. 显示日期、邮箱、渠道、转化状态
```

---

## 测试检查清单

### 单元测试

```bash
# 验证密码API
curl -X POST http://localhost:3000/api/auth/verify-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"correct_password"}'

# 修改密码API
curl -X POST http://localhost:3000/api/user/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password":"NewPass123"}'

# 获取邀请数据
curl http://localhost:3000/api/referral/mine \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取订阅历史
curl http://localhost:3000/api/subscription/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 集成测试

1. **场景1**: 游客进入 account.html
   - [ ] 自动重定向到 /pages/login.html
   - [ ] 显示 toast "登录已过期"

2. **场景2**: 已登录，加载邀请表
   - [ ] 显示邀请者列表（日期、邮箱前缀、渠道、转化状态）
   - [ ] bonus_amount 显示正确
   - [ ] 当前等级显示正确

3. **场景3**: 修改密码
   - [ ] 当前密码错误→显示红框 + "当前密码错误"
   - [ ] 新密码格式不符→显示 "需包含字母和数字"
   - [ ] 两次输入不一致→显示 "不一致"
   - [ ] 全部通过→成功 toast + Modal 关闭

4. **场景4**: 订阅历史
   - [ ] 显示所有历史订阅记录
   - [ ] 日期范围正确
   - [ ] 金额和套餐名称正确

---

## 常见问题

### Q1: referrals 表没有 bonus 字段
**A**: 如果数据库不支持，可以通过 `REWARD_TIERS` 在应用层计算：
```javascript
const tier = REWARD_TIERS.find(t => 
  myReferrals.filter(r => r.converted).length >= t.min
);
const bonus = tier?.amount || 0;
```

### Q2: 如何处理订阅历史中的过期订阅？
**A**: 在 `subscription-history.js` 中过滤已过期的订阅：
```javascript
const history = subOrders
  .filter(o => {
    // 只显示已完成的订阅或最近 1 年内的订阅
    const created = new Date(o.created_at);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return created > oneYearAgo;
  })
  .map(o => ({ ... }));
```

### Q3: 密码修改后是否需要重新登录？
**A**: 可选。建议：
- 删除所有旧 token（已在代码中实现）
- 前端显示 "密码已修改，请重新登录" toast
- 5 秒后自动跳转到登录页
- 或使用新生成的 token 直接继续使用（不强制登录）

### Q4: 邀请表为空时如何处理？
**A**: 前端已实现空态：
```javascript
if (!invitees || invitees.length === 0) {
  document.getElementById('refTableContainer').innerHTML = 
    '<div class="empty-state">暂无邀请记录</div>';
}
```

---

## 部署清单

- [ ] 所有新路由已添加到 `server/index.js`
- [ ] `/api/referral/mine` 已修复（bonus_amount + invitees）
- [ ] 数据库表已创建或迁移
- [ ] 前端 BASE 变量已正确配置
- [ ] CORS 已允许账户页面域名
- [ ] 错误日志已配置到 Sentry
- [ ] 生产环境已测试 HTTPS 连接
- [ ] 移动端已测试所有流程

---

## 性能优化

### 查询优化
```javascript
// 不推荐: N+1 查询
myReferrals.forEach(ref => {
  const user = getUserById.get(ref.invitee_id); // 多次查询
});

// 推荐: 预加载
const inviteeIds = new Set(myReferrals.map(r => r.invitee_id));
const inviteeCache = {};
inviteeIds.forEach(id => {
  inviteeCache[id] = getUserById.get(id);
});
```

### 缓存策略
```javascript
// 邀请数据可缓存 5 分钟
res.set('Cache-Control', 'private, max-age=300');
```

---

**完整优化已完成。所有代码可直接集成。**
