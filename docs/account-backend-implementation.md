# 善缘账户中心 — 后端实现指南

## 概述

这份文档指导后端团队实现账户中心所需的 API 端点补充和数据字段扩展。

**关键改动**:
1. 补充 `GET /api/referral/mine` 的缺失字段
2. 新增 `POST /api/user/profile` (更新个人资料)
3. 增强 `GET /api/auth/me` 的 membership 字段

---

## 1. 补充 GET /api/referral/mine

### 文件位置
`server/routes/referral.js` (第20行左右)

### 需补充字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `converted_count` | number | 已有成单的邀请数 |
| `total_bonus` | number | 累计奖励金额 (¥) |
| `invitees` | array | 详细邀请记录 |
| `invitees_by_channel` | object | 按渠道分组的邀请者 |

### 完整实现

```javascript
// routes/referral.js - GET /api/referral/mine

router.get('/mine', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  const u = getUserById.get(req.user.id);
  if (!u) return res.status(401).json({ error: '请先登录' });

  // 原有逻辑 (保留)
  const fullUser = require('../lib/store')._M.users.find(x => x.id === req.user.id);
  const ref_codes = fullUser?.ref_codes || { organic: fullUser?.ref_code };

  const invited = invitedCount(req.user.id);
  const tier = REWARD_TIERS.find(t => invited >= t.min && (t.max < 0 || invited <= t.max));

  const channel_urls = {};
  Object.entries(ref_codes).forEach(([channel, code]) => {
    channel_urls[channel] = buildShareUrl(code, req, channel);
  });

  // ★ NEW: 补充以下内容 ★

  // 获取所有邀请记录
  const store = require('../lib/store');
  const myInvitations = (store._M.referrals || [])
    .filter(ref => ref.inviter_id === req.user.id);

  // 构建详细邀请记录 + 判断转化状态
  const invitees = myInvitations.map(ref => {
    // 查询被邀请者是否有已完成的订单
    const inviteeOrders = (store._M.orders || [])
      .filter(o => o.user_id === ref.invitee_id && o.payment_status === 'completed');
    const converted = inviteeOrders.length > 0;

    // 获取被邀请者邮箱
    const inviteeUser = store._M.users.find(u => u.id === ref.invitee_id);
    const invitee_email = inviteeUser?.email || `user_${ref.invitee_id}`;

    return {
      id: ref.invitee_id,
      invitee_email: invitee_email,
      channel: ref.channel || 'organic',
      created_at: ref.created_at,
      converted: converted,
      converted_at: converted ? (inviteeOrders[0]?.created_at || null) : null,
      bonus: ref.bonus || 0,
      order_count: inviteeOrders.length
    };
  });

  // 按渠道分组
  const inviteesByChannel = {};
  CHANNELS.forEach(ch => {
    inviteesByChannel[ch] = invitees.filter(inv => inv.channel === ch);
  });

  // 统计已转化数 + 总奖励
  const convertedCount = invitees.filter(inv => inv.converted).length;
  const totalBonus = invitees.reduce((sum, inv) => sum + (inv.bonus || 0), 0);

  // ★ END NEW ★

  res.json({
    ref_codes: ref_codes,
    channel_urls: channel_urls,
    share_url: buildShareUrl(ref_codes.organic, req),
    ref_code: ref_codes.organic,
    invited_count: invited,
    converted_count: convertedCount,        // ★ NEW
    conversion_rate: invited > 0 
      ? Math.round((convertedCount / invited) * 100)
      : 0,                                  // ★ NEW
    current_tier: tier?.level || 'pending',
    next_tier_at: tier?.max < 0 ? null : tier?.max + 1,
    total_bonus: totalBonus,                // ★ NEW
    invitees: invitees,                     // ★ NEW
    invitees_by_channel: inviteesByChannel, // ★ NEW
    share_text: `我在善缘算了命,挺准的,你也来测测 → ${buildShareUrl(ref_codes.organic, req)}`
  });
});
```

### 数据格式示例

```json
{
  "ref_codes": {
    "tiktok": "ABC123_TK",
    "xiaohongshu": "DEF456_XH",
    "youtube": "GHI789_YT",
    "wechat": "JKL012_WX",
    "organic": "MNO345_ORG"
  },
  "invited_count": 25,
  "converted_count": 12,
  "conversion_rate": 48,
  "current_tier": "Premium",
  "total_bonus": 600,
  "invitees": [
    {
      "id": 123,
      "invitee_email": "user123@example.com",
      "channel": "tiktok",
      "created_at": "2026-08-10T10:30:00Z",
      "converted": true,
      "converted_at": "2026-08-11T14:22:00Z",
      "bonus": 50,
      "order_count": 1
    }
  ],
  "invitees_by_channel": {
    "tiktok": [{ ... }, { ... }],
    "xiaohongshu": [{ ... }],
    "youtube": [],
    "wechat": [{ ... }, { ... }, { ... }],
    "organic": [{ ... }]
  }
}
```

---

## 2. 新增 POST /api/user/profile

### 文件位置
`server/routes/auth.js` (在文件末尾添加)

### 实现代码

```javascript
// routes/auth.js - POST /api/user/profile

router.post('/profile', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未登录' });

  const { name, birthday, gender } = req.body;

  try {
    // 查找并更新用户
    const store = require('../lib/store');
    const idx = store._M.users.findIndex(u => u.id === req.user.id);

    if (idx < 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = store._M.users[idx];

    // 更新字段 (仅更新非 undefined 的字段)
    if (name !== undefined && name !== null) {
      user.name = String(name).trim();
    }
    if (birthday !== undefined && birthday !== null) {
      user.birthday = String(birthday).trim();
    }
    if (gender !== undefined && gender !== null) {
      const validGenders = ['M', 'F', 'N'];
      if (validGenders.includes(String(gender))) {
        user.gender = String(gender);
      }
    }

    // 触发持久化
    store._persist();

    // 返回更新后的用户信息
    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        birthday: user.birthday || '',
        gender: user.gender || ''
      }
    });

  } catch (err) {
    console.error('[PROFILE]', err);
    res.status(500).json({ error: '更新失败，请稍后重试' });
  }
});
```

### 请求示例

```bash
POST /api/user/profile HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "张三",
  "birthday": "1990-05-15",
  "gender": "M"
}
```

### 响应示例

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "张三",
    "birthday": "1990-05-15",
    "gender": "M"
  }
}
```

---

## 3. 增强 GET /api/auth/me

### 文件位置
`server/routes/auth.js` (第71行左右)

### 修改内容

在现有的 `GET /api/auth/me` 中补充 membership 字段细节：

```javascript
// routes/auth.js - GET /api/auth/me (修改部分)

router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未登录' });

  const u = getUserById.get(req.user.id);
  const orders = getUserOrders.all(req.user.id) || [];

  // 查找最新的会员订单
  const memberOrder = orders.find(function(o) {
    return UNLOCK_BY_CATEGORY['member'].indexOf(String(o.product || '')) >= 0 && !_isExpired(o);
  });

  const isMember = !!memberOrder;

  // ★ NEW: 确定套餐级别和价格 ★
  let tier = 'Basic';
  let price = '免费';
  
  if (memberOrder) {
    // 根据产品ID判断套餐
    if (memberOrder.product === 'member_yearly') {
      tier = 'Yearly';
      price = '¥99/年';
    } else if (memberOrder.product === 'member_quarterly') {
      tier = 'Quarterly';
      price = '¥29/季度';
    } else if (memberOrder.product === 'member_3year') {
      tier = 'LifeTime';
      price = '¥299/三年';
    } else {
      // 默认月卡
      tier = 'Premium';
      price = '¥39/月';
    }
  }
  // ★ END NEW ★

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
      tier: tier,      // ★ NEW
      price: price     // ★ NEW
    }
  });
});
```

### 响应格式

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "张三",
    "ref_code": "ABC123_ORG",
    "birthday": "1990-05-15",
    "gender": "M"
  },
  "membership": {
    "isMember": true,
    "expiresAt": "2026-09-10T23:59:59Z",
    "tier": "Premium",
    "price": "¥39/月"
  }
}
```

---

## 4. 数据库字段检查清单

### users 表
需要以下字段 (若不存在需补充):

```javascript
{
  id: number,
  email: string,
  password_hash: string,
  name: string,              // ✓ 需确保存在
  birthday: string,          // ★ 需新增
  gender: string,            // ★ 需新增 (M/F/N)
  ref_code: string,
  ref_codes: object,         // { tiktok: '...', xiaohongshu: '...', ... }
  created_at: ISO8601
}
```

### referrals 表
需要以下字段 (若不存在需补充):

```javascript
{
  id: number,
  inviter_id: number,
  invitee_id: number,
  channel: string,           // ✓ 需确保存在
  created_at: ISO8601,       // ✓ 需确保存在
  invitee_email: string,     // ? 可选，若无则从 users 查询
  bonus: number,             // ? 可选，默认 0
  converted: boolean         // ? 不存在字段表，通过 orders 判断
}
```

### 数据迁移 (如需添加新字段)

```javascript
// 在 lib/store.js 的初始化逻辑中补充

// 为现有用户补充默认值
_M.users.forEach(u => {
  if (!u.birthday) u.birthday = '';
  if (!u.gender) u.gender = 'N';  // default: not disclosed
});

_persist();
```

---

## 5. 测试场景

### 场景 A: 查询用户邀请数据
```bash
# 未登录
curl http://localhost:3021/api/referral/mine
# 预期: 401 Unauthorized

# 已登录
curl -H "Authorization: Bearer <token>" http://localhost:3021/api/referral/mine
# 预期: 200 OK 含完整邀请统计
```

### 场景 B: 更新个人资料
```bash
curl -X POST http://localhost:3021/api/user/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "birthday": "1990-05-15", "gender": "M"}'
# 预期: 200 OK
```

### 场景 C: 获取用户信息含会员状态
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3021/api/auth/me
# 预期: 200 OK 含 membership.tier 和 membership.price
```

---

## 6. 性能优化建议

### 缓存策略
- `GET /api/referral/mine` 在转化统计上可用 5 分钟缓存 (Redis)
- `GET /api/auth/me` 在会员订单上缓存 10 分钟

```javascript
// 示例: Redis 缓存
const redis = require('redis');
const client = redis.createClient();

router.get('/mine', authMiddleware, async (req, res) => {
  const cacheKey = `ref:${req.user.id}`;
  const cached = await client.get(cacheKey);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // ... 计算邀请统计 ...
  
  await client.setex(cacheKey, 300, JSON.stringify(result)); // 5分钟
  res.json(result);
});
```

### 分页处理
当邀请者超过 100 人时:

```javascript
// 修改 invitees 返回逻辑
const PAGE_SIZE = 50;
const page = parseInt(req.query.page || 1);
const startIdx = (page - 1) * PAGE_SIZE;

const paginatedInvitees = invitees.slice(startIdx, startIdx + PAGE_SIZE);

res.json({
  ...response,
  invitees: paginatedInvitees,
  pagination: {
    page: page,
    limit: PAGE_SIZE,
    total: invitees.length,
    hasMore: startIdx + PAGE_SIZE < invitees.length
  }
});
```

---

## 7. 安全考虑

### 数据隐私
- ✓ 仅返回当前用户的邀请数据 (不暴露他人的邀请码)
- ✓ 邮箱显示时截取用户名部分 (保护隐私)
- ✓ 个人资料仅限本人编辑

### SQL 注入防护
所有输入使用参数化查询 (已通过内存存储规避):

```javascript
// ✓ 安全 (内存查询)
store._M.users.find(u => u.id === req.user.id)

// ✗ 危险 (如使用 SQL 数据库)
db.query(`SELECT * FROM users WHERE id = ${req.body.id}`)
```

### 速率限制
添加到关键端点:

```javascript
const rateLimit = require('express-rate-limit');

const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10,                    // 10次请求
  message: '操作过于频繁，请稍后重试'
});

router.post('/profile', profileLimiter, authMiddleware, (req, res) => {
  // ...
});
```

---

## 8. 部署检查清单

部署前确保以下项目 ✓:

- [ ] 所有新增字段已添加到 data.json schema
- [ ] 现有数据已迁移 (补充 birthday/gender 默认值)
- [ ] 密钥已配置 (如使用 Redis 缓存)
- [ ] CORS 已配置允许前端域名
- [ ] 日志已配置记录关键操作 (create/update/delete)
- [ ] 单元测试已通过
- [ ] 集成测试已通过
- [ ] 后端已部署到 HK 服务器 (47.242.80.65:3021)
- [ ] 前端已部署 (account.html)
- [ ] 生产环境监控已启用 (Sentry)

---

## 9. 常见错误排查

### Error: "未登录"
**原因**: Authorization header 缺失或 token 过期  
**解决**: 检查 sy_token 是否存在，如过期重新登录

### Error: "邀请码无效"
**原因**: ref_code 格式不对或不存在  
**解决**: 确认邀请码是否为 `ABC123_TK` 格式

### Error: "用户不存在"
**原因**: userId 在 store._M.users 中未找到  
**解决**: 检查 store 初始化是否正确加载

### Error: "更新失败"
**原因**: 磁盘写入失败或 _persist() 异常  
**解决**: 检查服务器磁盘空间和权限

---

## 10. 后续优化方向

- [ ] 邀请码二维码生成 (前端 QR.js)
- [ ] 邀请卡片下载功能 (html2canvas)
- [ ] 邀请排行榜 (GET /api/referral/leaderboard)
- [ ] 邀请成就徽章 (levels/achievements)
- [ ] 自动续费选项 (auto-renewal flags)
- [ ] 发票下载功能 (PDF 生成)
- [ ] 实时通知 (WebSocket)

---

## 联系方式

- **前端负责**: account.html 页面实现
- **后端负责**: API 端点和数据逻辑
- **DevOps 负责**: 部署、缓存、监控配置
- **文档**: docs/account-page-api-integration.md

如有疑问，请参考原始需求文档或联系产品经理。
