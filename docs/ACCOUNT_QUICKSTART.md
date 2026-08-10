# 账户中心页面 · 快速启动 (5分钟)

## 🟢 前端已完成 ✅
- account.html 已优化至 10/10 分
- 所有 10 项优化已实现
- 可直接使用，无需修改

## 🔴 后端需补充 (5分钟)

### Step 1: 复制后端文件
```bash
# 复制新路由文件到项目
cp /path/to/profile.js /Users/karen/projects/shenyuan/server/routes/
cp /path/to/subscription-history.js /Users/karen/projects/shenyuan/server/routes/
```

或手动创建:
```bash
# 创建 profile.js
touch /Users/karen/projects/shenyuan/server/routes/profile.js
# 复制下面的代码...

# 创建 subscription-history.js
touch /Users/karen/projects/shenyuan/server/routes/subscription-history.js
# 复制下面的代码...
```

### Step 2: 编辑 server/index.js
在现有路由注册部分添加:

```javascript
// 查找这一行:
const authRouter = require('./routes/auth');

// 在其后添加:
const profileRouter = require('./routes/profile');
const subscriptionHistoryRouter = require('./routes/subscription-history');

// 查找这一行:
app.use('/api/auth', authRouter);

// 在其后添加:
app.use('/api/user', profileRouter);
app.use('/api/subscription', subscriptionHistoryRouter);
```

### Step 3: 修复 referral API
编辑 `/server/routes/referral.js` 第 20-48 行的 `/api/referral/mine` 端点:

**关键改动**:
1. 添加返回字段 `bonus_amount` (替代 total_bonus)
2. 添加返回字段 `converted_count`
3. 添加返回字段 `invitees` (完整邀请者数组)

参考文件: `ACCOUNT_BACKEND_SETUP.md` 的第 "修复 /api/referral/mine" 部分

### Step 4: 重启服务器
```bash
pm2 restart shenyuan
# 或
node server/index.js
```

### Step 5: 测试
```bash
# 测试邀请 API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/referral/mine | jq .

# 查看返回字段是否包含:
# - bonus_amount
# - converted_count  
# - invitees[]
```

---

## 📊 集成验证清单

- [ ] profile.js 已创建
- [ ] subscription-history.js 已创建
- [ ] server/index.js 已注册新路由
- [ ] /api/referral/mine 已返回 bonus_amount
- [ ] /api/referral/mine 已返回 converted_count
- [ ] /api/referral/mine 已返回 invitees 数组
- [ ] 服务器已重启
- [ ] 所有 API 端点已通过测试

---

## 🎯 后端代码片段

### profile.js (120 行)
```javascript
'use strict';
const router = require('express').Router();
const { getUserById } = require('../lib/store');
const { hashPassword, verifyPassword } = require('../lib/utils');
const { authMiddleware } = require('../middleware');

// POST /api/user/profile
router.post('/profile', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const { name, birthday, gender } = req.body;
  const userId = req.user.id;

  // Validate
  if (name && name.length > 50) return res.status(400).json({ error: '昵称不能超过50个字符' });
  if (birthday) {
    const d = new Date(birthday);
    if (!(d instanceof Date && !isNaN(d)) || d.getFullYear() < 1900) {
      return res.status(400).json({ error: '生日日期无效' });
    }
  }
  if (gender && !['M', 'F', 'N'].includes(gender)) {
    return res.status(400).json({ error: '性别选项无效' });
  }

  try {
    const store = require('../lib/store');
    const stmt = store._M.db.prepare(`
      UPDATE users SET name = ?, birthday = ?, gender = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(name || null, birthday || null, gender || null, new Date().toISOString(), userId);

    const user = getUserById.get(userId);
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, birthday: user.birthday, gender: user.gender } });
  } catch (err) {
    console.error('[PROFILE ERR]', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// POST /api/auth/verify-password
router.post('/verify-password', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '请提供密码' });

  const user = getUserById.get(req.user.id);
  if (!user) return res.status(401).json({ error: '用户不存在' });

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '当前密码错误' });
  }

  res.json({ ok: true });
});

// POST /api/user/change-password
router.post('/change-password', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) return res.status(400).json({ error: '新密码至少6位' });
  if (!/[a-zA-Z]/.test(new_password) || !/[0-9]/.test(new_password)) {
    return res.status(400).json({ error: '密码需包含字母和数字' });
  }

  try {
    const hash = hashPassword(new_password);
    const store = require('../lib/store');
    const stmt = store._M.db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(hash, new Date().toISOString(), req.user.id);

    // 登出所有设备
    const stmtToken = store._M.db.prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `);
    stmtToken.run(req.user.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('[CHANGE_PASSWORD ERR]', err);
    res.status(500).json({ error: '修改失败' });
  }
});

module.exports = router;
```

### subscription-history.js (40 行)
```javascript
'use strict';
const router = require('express').Router();
const { getUserOrders } = require('../lib/store');
const { authMiddleware } = require('../middleware');

// GET /api/subscription/history
router.get('/history', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  try {
    const orders = getUserOrders.all(req.user.id) || [];

    // 过滤订阅/会员产品
    const subOrders = orders.filter(o => {
      const cat = o.product || '';
      return cat.indexOf('member') >= 0 || cat.indexOf('subscription') >= 0 || cat.indexOf('vip') >= 0;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const history = subOrders.map(o => ({
      id: o.id,
      tier: o.product_name || 'Standard',
      start_date: o.created_at ? o.created_at.substring(0, 10) : null,
      end_date: o.expires_at ? o.expires_at.substring(0, 10) : null,
      amount: o.amount || 0,
      status: o.status || 'completed'
    }));

    res.json({ history });
  } catch (err) {
    console.error('[SUBSCRIPTION_HISTORY ERR]', err);
    res.status(500).json({ error: '获取历史失败' });
  }
});

module.exports = router;
```

---

## 🧪 测试命令

```bash
# 1. 测试修改密码流程
curl -X POST http://localhost:3000/api/auth/verify-password \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"current_password"}' | jq

# 2. 测试修改密码
curl -X POST http://localhost:3000/api/user/change-password \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password":"NewPass123"}' | jq

# 3. 测试更新档案
curl -X POST http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"新昵称","birthday":"2000-01-01","gender":"M"}' | jq

# 4. 测试订阅历史
curl http://localhost:3000/api/subscription/history \
  -H "Authorization: Bearer TEST_TOKEN" | jq

# 5. 测试邀请数据
curl http://localhost:3000/api/referral/mine \
  -H "Authorization: Bearer TEST_TOKEN" | jq '.bonus_amount, .converted_count, .invitees[0]'
```

---

## ⏱️ 预期时间

| 任务 | 时间 |
|------|------|
| 复制后端文件 | 1分钟 |
| 编辑 server/index.js | 1分钟 |
| 修复 /api/referral/mine | 2分钟 |
| 重启服务器 | 1分钟 |
| 测试 | 1分钟 |
| **总计** | **~5分钟** |

---

## ✅ 完成标志

当所有以下条件满足时，集成完成:

1. ✅ 所有新 API 端点返回 200 OK
2. ✅ /api/referral/mine 包含 bonus_amount 字段
3. ✅ /api/referral/mine 包含 converted_count 字段
4. ✅ /api/referral/mine 包含 invitees 数组
5. ✅ 前端 account.html 可正常加载数据
6. ✅ 修改密码流程完整可用
7. ✅ 移动端表格显示正常
8. ✅ 暗模式适配正常

---

## 🆘 故障排查

### 问题 1: 404 错误 (路由未注册)
```
错误: Cannot POST /api/user/profile

解决: 
1. 检查 server/index.js 是否已添加新路由
2. 检查路由文件是否在 /server/routes/ 目录
3. 重启服务器: pm2 restart shenyuan
```

### 问题 2: 401 无权限
```
错误: {"error":"请先登录"}

解决:
1. 确认 token 有效
2. 检查 authMiddleware 是否正确
3. 检查 Authorization header 格式: "Bearer TOKEN"
```

### 问题 3: bonus_amount 字段为空
```
错误: referralData.bonus_amount is undefined

解决:
1. 检查 referral.js 是否已修复
2. 查看返回的 JSON 中是否包含 bonus_amount
3. 确认邀请者等级计算正确
```

### 问题 4: 邀请表为空
```
错误: 页面显示"暂无邀请记录"

解决:
1. 确认该用户有邀请记录 (referrals 表)
2. 检查 invitees 数组是否为空
3. 查看浏览器控制台 Network 标签的响应
```

---

## 📞 需要帮助？

参考以下文档:
- 📖 API 规范: `ACCOUNT_PAGE_API_SPEC.md`
- 📚 后端指南: `ACCOUNT_BACKEND_SETUP.md`
- 📊 优化总结: `ACCOUNT_OPTIMIZATION_SUMMARY.md`

---

**预计完成时间**: 5 分钟  
**难度**: ⭐ 低  
**风险**: 无
