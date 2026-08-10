# 排行榜功能测试指南

## 快速启动

### 1. 启动开发服务
```bash
cd /Users/karen/projects/shenyuan/server
node index.js
# 或使用pm2
pm2 start index.js --name shenyuan
```

### 2. 访问排行榜
- **中文版**：http://localhost:3000/pages/leaderboard.html
- **英文版**：http://localhost:3000/pages/leaderboard-en.html

## 测试场景

### 测试1：未登录用户访问排行榜

**预期结果**：
- ✓ 排行表显示Top 10
- ✓ 个人成绩卡显示"请先登录..."提示
- ✓ 无法看到邀请码和个人数据

**操作步骤**：
```bash
# 清空本地存储（模拟未登录）
# 在浏览器console执行：
localStorage.removeItem('sy_token');
localStorage.removeItem('auth_token');

# 刷新页面
```

### 测试2：登录用户访问排行榜

**前置条件**：
- 需要一个已登录的测试账户
- 该账户应至少有1条邀请记录

**预期结果**：
- ✓ 个人成绩卡显示邀请数、等级、进度条
- ✓ 5个渠道邀请码都正确显示
- ✓ 等级进度条准确显示距离下一等级的距离

**操作步骤**：
```bash
# 1. 登录bazi.html获得token
# 2. 访问排行榜
# 3. 检查个人卡数据
# 4. 打开console验证：
fetch('/api/referral/mine', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
}).then(r => r.json()).then(console.log);
```

### 测试3：API端点功能测试

#### 3.1 测试排行榜API
```bash
# 获取Top 10排行
curl http://localhost:3000/api/referral/leaderboard

# 预期返回格式（示例）：
# [
#   {
#     "user_id": "uid_1",
#     "name": "Alice",
#     "email": "alice@example.com",
#     "invited_count": 150,
#     "converted_count": 45,
#     "tier": "premium",
#     "reward_amount": 50,
#     "channels": {"tiktok": 80, "xiaohongshu": 50, ...}
#   },
#   ...
# ]
```

#### 3.2 测试个人信息API
```bash
# 替换 TOKEN 为实际值
TOKEN=$(cat ~/.config/shenyuan-token.txt)
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/referral/mine

# 预期返回格式：
# {
#   "ref_codes": {
#     "tiktok": "ABC123_TK",
#     "xiaohongshu": "ABC123_XH",
#     ...
#   },
#   "invited_count": 25,
#   "current_tier": "basic",
#   "next_tier_at": 101,
#   ...
# }
```

### 测试4：前端功能测试

#### 4.1 邀请码复制
```javascript
// 在浏览器console测试
// 1. 点击任意邀请码渠道框
// 2. 应看到 "✓" 符号出现
// 3. 验证复制内容
navigator.clipboard.readText().then(text => {
  console.log('Copied:', text);
  // 应输出邀请码，如 "ABC123_TK"
});
```

#### 4.2 分享卡生成
```javascript
// 在浏览器console测试
// 1. 点击 "生成分享卡" 按钮
// 2. 应看到Canvas绘制的卡片
// 3. Canvas中应包含：
//    - 你的排名
//    - 邀请数
//    - 等级标签
//    - 邀请码

// 验证Canvas内容
const canvas = document.getElementById('shareCanvas');
console.log('Canvas size:', canvas.width, canvas.height);
console.log('Canvas URL:', canvas.toDataURL().substring(0, 100) + '...');
```

#### 4.3 下载PNG
```javascript
// 1. 生成分享卡后，点击 "下载卡片 PNG"
// 2. 检查浏览器下载文件夹
// 3. 应有文件 "shenyuan-share-[timestamp].png"
// 4. 用图片查看器打开验证内容
```

#### 4.4 实时刷新
```javascript
// 在浏览器console观察
// 1. 打开排行榜
// 2. 等待5秒
// 3. console应无错误
// 4. 排行数据应更新（可通过network tab观察API调用）

// 手动触发刷新
fetchLeaderboard();  // 更新排行
fetchMyData();       // 更新个人数据
```

#### 4.5 语言切换
```javascript
// 中文版 → 英文版
// 1. 在leaderboard.html顶右角点击 "EN"
// 2. 跳转到 leaderboard-en.html
// 3. 页面应完全英文化

// 英文版 → 中文版
// 1. 在leaderboard-en.html顶右角点击 "中文"
// 2. 跳转到 leaderboard.html
// 3. 页面应完全中文化
```

### 测试5：数据准确性测试

#### 5.1 邀请数准确性
```javascript
// 验证邀请数计算是否准确
// 1. 在后端查询该用户的邀请记录
// 2. 计算总数
// 3. 与排行榜显示的数字对比

// 查询示例（后端或admin工具）：
const uid = 'user_id_1';
const count = _M.referrals.filter(r => r.inviter_id === uid).length;
console.log(`User ${uid} has ${count} referrals`);
```

#### 5.2 等级计算准确性
```javascript
// 验证等级是否根据邀请数正确分配
const invited = 75;
const tier = REWARD_TIERS.find(t => 
  invited >= t.min && (t.max < 0 || invited <= t.max)
);
console.log(`${invited} invites → ${tier.level} (¥${tier.amount}/person)`);

// 应输出：75 invites → premium (¥50/person)
```

### 测试6：边界情况测试

#### 6.1 邀请数为0的用户
```javascript
// 1. 找一个没有任何邀请的用户
// 2. 访问排行榜（该用户应不出现）
// 3. 该用户登录，个人卡应显示邀请数：0
```

#### 6.2 转化率为0的邀请者
```javascript
// 1. 找一个有邀请但没转化的用户
// 2. 排行表应正常显示，但转化数为0
```

#### 6.3 排行跨度测试
```javascript
// 1. 创建一个邀请数为99的虚拟用户（Basic → Premium边界）
// 2. 增加1次邀请到100（Premium边界）
// 3. 验证等级从basic跳到premium

// 测试代码示例（需要后端权限）：
_M.referrals.push({
  inviter_id: 'test_user',
  invitee_id: 'new_user_' + Date.now(),
  channel: 'organic',
  created_at: new Date()
});
```

### 测试7：性能测试

#### 7.1 大数据量排行榜
```javascript
// 测试场景：排行榜有1000+用户
// 预期：
// - 页面加载<3秒
// - 列表滚动平稳（FPS > 30）
// - 搜索响应<100ms

// 在DevTools Performance tab测试
performance.mark('lb-load-start');
fetchLeaderboard();
performance.mark('lb-load-end');
performance.measure('leaderboard-load', 'lb-load-start', 'lb-load-end');
console.log(performance.getEntriesByName('leaderboard-load')[0]);
```

#### 7.2 内存泄漏检测
```javascript
// 1. 打开排行榜
// 2. 在DevTools → Memory中拍摄堆快照
// 3. 点击"生成分享卡"多次（>10次）
// 4. 再拍摄一次快照
// 5. 比较：内存应回到接近初始大小（如有泄漏会不断增长）
```

## 数据准备

### 创建测试邀请记录

```javascript
// 在后端console或admin面板执行
// 创建10条邀请记录用于排行榜测试

const _M = require('./lib/store')._M;

// 创建虚拟邀请者
for (let i = 1; i <= 10; i++) {
  const inviterId = `referrer_${i}`;
  const inviteCount = Math.floor(Math.random() * 200) + 1;
  
  // 确保用户存在
  if (!_M.users.find(u => u.id === inviterId)) {
    _M.users.push({
      id: inviterId,
      email: `referrer${i}@example.com`,
      name: `推荐人${i}`,
      ref_codes: {
        tiktok: `CODE${i}_TK`,
        xiaohongshu: `CODE${i}_XH`,
        wechat: `CODE${i}_WX`,
        youtube: `CODE${i}_YT`,
        organic: `CODE${i}`
      }
    });
  }
  
  // 创建邀请记录
  for (let j = 0; j < inviteCount; j++) {
    _M.referrals.push({
      inviter_id: inviterId,
      invitee_id: `invitee_${i}_${j}`,
      channel: ['tiktok', 'xiaohongshu', 'wechat', 'youtube', 'organic'][j % 5],
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
    });
  }
}

// 持久化存储
require('./lib/store')._persist();
```

## 测试清单 (Checklist)

### 功能完整性
- [ ] 未登录用户能看到排行表
- [ ] 登录用户能看到个人成绩卡
- [ ] 5个渠道邀请码都正确显示
- [ ] 等级进度条准确计算
- [ ] 分享卡能正常生成
- [ ] 分享卡能下载为PNG
- [ ] 自动刷新每5秒执行一次
- [ ] 中英文版本都能正确显示

### API正确性
- [ ] `/api/referral/leaderboard` 返回Top 10
- [ ] `/api/referral/mine` 返回个人信息（已登录）
- [ ] 邀请数统计准确
- [ ] 等级计算准确
- [ ] 频道分布统计准确

### UI/UX
- [ ] 页面在手机上显示正常（390px宽度）
- [ ] 颜色对比度满足WCAG AA级
- [ ] 字体大小在13px以上
- [ ] 按钮可点击区域>=44px
- [ ] 无布局抖动或闪烁

### 性能
- [ ] 首屏加载<3秒
- [ ] 列表滚动帧率>30fps
- [ ] 无明显内存泄漏

## 常见问题排查

### Q1: 排行榜显示"加载排行榜中..."
**A**: 检查后端是否启动，API是否返回正确数据
```bash
curl http://localhost:3000/api/referral/leaderboard
```

### Q2: 个人邀请码显示"—"
**A**: 检查用户是否登录，ref_codes是否存在
```javascript
// console中检查
fetch('/api/referral/mine', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
}).then(r => r.json()).then(d => {
  console.log('ref_codes:', d.ref_codes);
  console.log('invited:', d.invited_count);
});
```

### Q3: Canvas分享卡显示中文乱码
**A**: 字体未加载，等待Font Ready
```javascript
// 检查字体加载状态
document.fonts.ready.then(() => {
  console.log('Fonts loaded');
  generateShareCard();  // 再生成
});
```

### Q4: 刷新后排行排序不对
**A**: API排序逻辑正确，可能是缓存问题
```bash
# 清除浏览器缓存或使用隐身模式测试
# 或使用硬刷新：Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
```

## 完成标志

✅ 当所有以下条件满足时，排行榜功能可认为完成：

1. 排行表显示正确的Top 10数据
2. 个人成绩卡在登录时显示准确的邀请数和等级
3. 分享卡能正常生成并下载
4. 前后端API通信无错误
5. 手机/桌面显示正常
6. 中英文版本功能对等
7. 自动刷新工作正常
8. 无明显性能问题
