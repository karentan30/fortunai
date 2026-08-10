# 善缘邀请排行榜 — 集成说明

## 概况

已为善缘项目设计并实现完整的邀请排行榜系统，包括：
- 实时Top 10排行榜前端页面（中英文双版本）
- 排行榜数据后端API
- 个人邀请成绩卡
- 分享卡Canvas生成功能
- 多渠道邀请码管理
- 奖励等级系统可视化

## 部署文件清单

### 新增文件

#### 前端页面
- **`pages/leaderboard.html`** — 中文版排行榜页面
  - 完整样式对标bazi.html暖色系设计
  - 5渠道邀请码（TikTok/小红书/WeChat/YouTube/Other）
  - 个人成绩卡：排名/邀请数/转化数/等级/进度条
  - 实时Top 10排行表
  - Canvas分享卡生成+下载PNG
  - 每5秒自动刷新数据

- **`pages/leaderboard-en.html`** — 英文版排行榜页面
  - 完全对应中文版功能，英文文案

#### 后端API
- **`server/routes/referral.js`** — 已更新
  - 新增 `GET /api/referral/leaderboard` 端点（无需认证）
  - 返回Top 10排行数据：排名/邀请数/转化数/等级/渠道分布

### 修改文件

#### 导航链接
- **`pages/bazi.html`**
  - 在back-btn旁添加"邀请排行"导航链接

- **`pages/bazi-en.html`**
  - 在back-btn旁添加"Leaderboard"导航链接

## API 接口说明

### GET /api/referral/leaderboard

**说明**：获取邀请排行榜数据（Top 10）

**请求**：无需认证，无参数
```bash
curl http://localhost:3000/api/referral/leaderboard
```

**响应格式**：
```json
[
  {
    "user_id": "uid_1",
    "name": "张三",
    "email": "user@example.com",
    "invited_count": 150,
    "converted_count": 45,
    "tier": "premium",
    "reward_amount": 50,
    "channels": {
      "tiktok": 80,
      "xiaohongshu": 50,
      "wechat": 20
    }
  },
  ...
]
```

**字段说明**：
- `invited_count`: 邀请总人数
- `converted_count`: 已转化（有订单）的人数
- `tier`: 奖励等级（premium/standard/basic）
- `reward_amount`: 每邀请1人的奖励金额（单位¥）
- `channels`: 各渠道邀请分布

## 前端功能详解

### 1. 个人成绩卡（需登录）
- 显示排名、邀请数、转化数、当前等级
- 等级进度条：实时显示距离下一等级还需邀请数
- 点击等级条查看奖励详情

### 2. 5渠道邀请码
每个用户在登录后可看到5个独立的邀请码：
- **TikTok** — 短视频平台
- **小红书** — 中国社交电商
- **WeChat** — 微信私域
- **YouTube** — 视频平台
- **其他** — 通用邀请码

点击任一渠道可一键复制邀请码。

### 3. 分享功能
- **生成分享卡** — Canvas绘制精美邀请卡（含排名/昵称/邀请数/等级）
- **下载PNG** — 导出图片本地保存
- **分享链接** — 一键分享到微信/系统分享
- **自动刷新** — 每5秒拉取最新排行和个人数据

### 4. 奖励等级体系

| 等级 | 邀请数 | 每人奖励 | 权益 |
|------|------|--------|------|
| **Premium** | 1-100 | ¥50 | 解锁高级功能与专属权益 |
| **Standard** | 101-200 | ¥30 | 合作伙伴特殊权益 |
| **Basic** | 201+ | ¥10 | API与联盟计划对接 |

## 后端实现细节

### 排行榜数据计算逻辑

```javascript
// 1. 统计邀请数 — 从 _M.referrals 中按 inviter_id 分组
const referrerStats = {};
_M.referrals.forEach(ref => {
  if (!referrerStats[ref.inviter_id]) {
    referrerStats[ref.inviter_id] = { invited_count: 0, converted_count: 0, channels: {} };
  }
  referrerStats[ref.inviter_id].invited_count++;
  referrerStats[ref.inviter_id].channels[ref.channel]++;
});

// 2. 统计转化 — 匹配 _M.orders 中有user_id的订单
const orderUserIds = new Set(_M.orders.map(o => o.user_id).filter(Boolean));
Object.keys(referrerStats).forEach(uid => {
  if (orderUserIds.has(uid)) {
    referrerStats[uid].converted_count++;
  }
});

// 3. 计算等级 — 基于 REWARD_TIERS
const tier = REWARD_TIERS.find(t => 
  invited_count >= t.min && (t.max < 0 || invited_count <= t.max)
);

// 4. 排序并取Top 10
const leaderboard = Object.entries(referrerStats)
  .sort((a, b) => b.invited_count - a.invited_count)
  .slice(0, 10);
```

## 集成步骤

### 1. 验证文件已部署
```bash
# 检查前端文件
ls -la /Users/karen/projects/shenyuan/pages/leaderboard*.html

# 检查后端API更新
grep -n "leaderboard" /Users/karen/projects/shenyuan/server/routes/referral.js
```

### 2. 测试API端点
```bash
# 本地测试
curl http://localhost:3000/api/referral/leaderboard

# 生产环境测试
curl https://shenyuan.app/api/referral/leaderboard
```

### 3. 验证导航链接
- 打开 `bazi.html` 或 `bazi-en.html`
- 顶部right应显示"邀请排行"或"Leaderboard"链接
- 点击跳转到排行榜页面

### 4. 功能自测

**登录用户**：
1. 登录后查看个人成绩卡，确认显示正确的邀请码和统计数据
2. 点击生成分享卡，检查Canvas质量
3. 点击"分享链接"测试系统分享功能
4. 刷新页面确认5秒自动更新工作正常

**未登录用户**：
1. 不登录访问排行榜，个人卡应显示登录提示
2. 排行表应仍显示Top 10

## 数据依赖

### 必须存在的集合
- **`_M.referrals`** — 邀请记录（已有）
  ```javascript
  {
    inviter_id: "uid_1",
    invitee_id: "uid_2",
    channel: "tiktok",
    created_at: "2026-08-10T12:00:00Z"
  }
  ```

- **`_M.orders`** — 订单记录（已有）
  ```javascript
  {
    user_id: "uid_2",
    product: "bazi_reading",
    amount: 9.9,
    created_at: "2026-08-10T12:00:00Z"
  }
  ```

- **`_M.users`** — 用户信息（已有）
  ```javascript
  {
    id: "uid_1",
    email: "user@example.com",
    name: "张三",
    ref_codes: {
      tiktok: "ABC123_TK",
      xiaohongshu: "ABC123_XH",
      wechat: "ABC123_WX",
      youtube: "ABC123_YT",
      organic: "ABC123"
    }
  }
  ```

## 配置修改

### 1. 如需调整自动刷新频率
编辑 `leaderboard.html` 或 `leaderboard-en.html`：
```javascript
// 第 ~390 行，修改刷新间隔（单位ms，默认5000 = 5秒）
refreshTimer = setInterval(() => {
  fetchLeaderboard();
  if (myData) fetchMyData();
}, 5000);  // ← 改这里
```

### 2. 如需调整显示的排行数量
编辑后端 `server/routes/referral.js` 的 `leaderboard` 端点：
```javascript
.slice(0, 10)  // ← 改成你想要的数字
```

### 3. 如需调整奖励等级
编辑 `server/lib/store.js` 中的 `REWARD_TIERS`：
```javascript
const REWARD_TIERS = [
  { min: 1, max: 100, level: 'premium', bonus_type: 'referral_premium', amount: 50 },
  { min: 101, max: 200, level: 'standard', bonus_type: 'referral_standard', amount: 30 },
  { min: 201, max: -1, level: 'basic', bonus_type: 'referral_basic', amount: 10 }
];
```

## 样式定制

排行榜完全采用bazi.html的暖色系设计：

**主色彩**：
- 金色：`#c9a84c` (--gold)
- 玉色：`#5bbfa0` (--jade)
- 背景：`#faf8f5` (--bg)
- 卡片：`#ffffff` (--card)

如需调整，编辑页面顶部的 `:root` CSS变量。

## 已知限制

1. **排行榜数据无实时性** — 基于内存中的 `_M.referrals`，需后端主动更新
2. **转化数未自动计算** — 目前按"是否有订单"简单统计，未区分订阅/一次性购买
3. **渠道分布展示** — 排行表未显示各渠道明细，仅在后端返回供扩展使用
4. **排名变化动画** — 当前无排名变化提示，可后续添加

## 下一步改进方向

1. **实时排名变化通知** — WebSocket推送排名变化
2. **邀请成功确认页** — 邀请者邀请码被使用时的实时反馈
3. **邀请数据看板** — 按日期/渠道展示邀请趋势
4. **预期收益计算** — 基于tier和invited_count展示预期月收益
5. **排行榜排序定制** — 按邀请数/转化率/收益排序

## 故障排查

### 问题1：排行榜显示为空
**可能原因**：
- `_M.referrals` 数据为空
- API返回错误

**排查方法**：
```bash
# 检查数据是否存在
curl http://localhost:3000/api/referral/leaderboard | jq '.'

# 查看后端日志是否有错误
tail -f /path/to/pm2/logs
```

### 问题2：个人邀请码显示为"—"
**可能原因**：
- 用户未登录
- 用户对象缺少 `ref_codes` 字段

**排查方法**：
```javascript
// 在浏览器console中
console.log(localStorage.getItem('auth_token'));  // 检查token
fetch('/api/referral/mine', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
}).then(r => r.json()).then(console.log);  // 查看接口返回
```

### 问题3：分享卡Canvas中文乱码
**可能原因**：
- Canvas未加载字体

**排查方法**：
- 检查页面顶部是否正确加载 `Noto Serif SC` 字体
- 或在Canvas初始化前等待字体加载完成

## 联系支持

如有问题，请查阅：
- 后端API文档：`docs/API.md` 的 `/api/referral/*` 部分
- 前端组件：`pages/leaderboard*.html` 源代码注释
- 样式参考：`pages/bazi.html` CSS规范
