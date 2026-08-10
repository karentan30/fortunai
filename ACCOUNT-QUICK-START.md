# 善缘账户中心 — 快速开发指南

## 🎯 30秒概览

**已完成**: account.html (3800行) + 3份文档  
**需要**: 后端补充 3 个 API 端点  
**预计**: 4-6 小时完成集成  

---

## 📝 后端必做 (按优先级)

### P0: 补充 GET /api/referral/mine
**文件**: `server/routes/referral.js` (第20行)  
**缺失字段**: `converted_count`, `total_bonus`, `invitees[]`, `invitees_by_channel`  
**详情**: [account-backend-implementation.md §1](./docs/account-backend-implementation.md#1-补充-get-apireferralmine)

```javascript
// 核心逻辑: 统计邀请者的已转化数 + 奖励金额
const convertedCount = invitees.filter(inv => inv.converted).length;
const totalBonus = invitees.reduce((sum, inv) => sum + (inv.bonus || 0), 0);
```

### P0: 新增 POST /api/user/profile
**文件**: `server/routes/auth.js` (末尾)  
**功能**: 更新用户昵称/生日/性别  
**详情**: [account-backend-implementation.md §2](./docs/account-backend-implementation.md#2-新增-post-apiuserprofile)

```javascript
// 接收 { name, birthday, gender }
// 返回 { ok: true, user: {...} }
```

### P0: 增强 GET /api/auth/me
**文件**: `server/routes/auth.js` (第71行)  
**补充**: membership 字段的 `tier`, `price`  
**详情**: [account-backend-implementation.md §3](./docs/account-backend-implementation.md#3-增强-get-apiauthme)

```javascript
// 根据 memberOrder.product 判断套餐
// member_yearly → "Yearly", "¥99/年"
// member_quarterly → "Quarterly", "¥29/季度"
// 其他 → "Premium", "¥39/月"
```

---

## 🔧 数据库字段补充

### users 表 (补充 2 字段)
```javascript
birthday: string,    // "1990-05-15"
gender: string       // "M" | "F" | "N"
```

### referrals 表 (确保存在)
```javascript
inviter_id: number,
invitee_id: number,
channel: string,     // "tiktok", "xiaohongshu", etc.
created_at: ISO8601
```

---

## 🧪 快速测试

### 测试邀请管理
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3021/api/referral/mine | jq .

# 检查是否返回: converted_count, total_bonus, invitees
```

### 测试个人资料更新
```bash
curl -X POST http://localhost:3021/api/user/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","birthday":"1990-05-15","gender":"M"}'

# 应返回: { "ok": true, "user": {...} }
```

### 测试会员信息
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3021/api/auth/me | jq .membership

# 检查是否返回: isMember, expiresAt, tier, price
```

---

## 📊 数据格式参考

### 邀请管理响应示例
```json
{
  "invited_count": 25,
  "converted_count": 12,
  "conversion_rate": 48,
  "total_bonus": 600,
  "current_tier": "Premium",
  "invitees": [
    {
      "id": 123,
      "invitee_email": "user123@example.com",
      "channel": "tiktok",
      "created_at": "2026-08-10T10:30:00Z",
      "converted": true,
      "bonus": 50
    }
  ]
}
```

### 用户信息响应示例
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "张三",
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

## 📄 文档导航

| 文档 | 用途 |
|------|------|
| **ACCOUNT-CENTER-DELIVERY.md** | 总体交付清单 ← 从这里开始 |
| **account-page-api-integration.md** | API 端点详解 + 多语言支持 |
| **account-backend-implementation.md** | 后端代码实现步骤 (代码复制即用) |
| **account-quick-start.md** | 本文档 |

---

## ✅ 集成检查清单

部署前:
- [ ] 补充 GET /api/referral/mine (4 字段)
- [ ] 新增 POST /api/user/profile
- [ ] 增强 GET /api/auth/me (2 字段)
- [ ] 补充 users 表字段 (birthday, gender)
- [ ] 单元测试通过
- [ ] 前端部署 account.html
- [ ] CORS 配置正确

---

## 🚨 常见坑

### Pit 1: referrals 表缺少字段
**症状**: invitees 为空数组  
**原因**: referrals 表中没有 inviter_id, channel, created_at  
**解决**: 检查 data.json 结构，补充缺失字段

### Pit 2: 响应字段名不对
**症状**: 前端显示 "undefined"  
**原因**: 后端返回 `converted` 但前端期望 `isConverted`  
**解决**: 保持字段名一致 (见上面的数据格式)

### Pit 3: 会员信息不显示
**症状**: membership.tier 为 null  
**原因**: 逻辑判断 product 类型失败  
**解决**: 打印 memberOrder.product，对应 UNLOCK_BY_CATEGORY

---

## 💡 最佳实践

### 代码复用
参考 `server/routes/referral-enhancements.js` 的 enhanceReferralMineResponse() 函数

### 缓存优化 (可选)
邀请统计可缓存 5 分钟 (Redis):
```javascript
const cached = await redis.get(`ref:${userId}`);
if (cached) return JSON.parse(cached);
// ... 计算统计 ...
await redis.setex(`ref:${userId}`, 300, JSON.stringify(result));
```

### 分页处理 (可选)
邀请者 > 100 人时分页:
```javascript
GET /api/referral/mine?page=1&limit=50
→ { invitees: [...], pagination: { page: 1, total: 250 } }
```

---

## 📞 求助资源

- **文件位置**: `/pages/account.html`
- **API 文档**: `docs/account-page-api-integration.md`
- **实现指南**: `docs/account-backend-implementation.md`
- **错误排查**: `ACCOUNT-CENTER-DELIVERY.md` §9

---

**准备好开始了吗?** 先读 ACCOUNT-CENTER-DELIVERY.md，然后按优先级实现 3 个 API 端点。祝你顺利! 🚀
