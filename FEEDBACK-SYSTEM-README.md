# 善缘反馈系统 - 完整实现文档

## 项目交付清单

本次实现完成了善缘的完整反馈/评分系统，包括：

### ✅ 已交付组件

#### 1. 后端路由升级 (`server/routes/daily.js`)
- **POST /api/feedback** - 增强的反馈提交（支持评分、分类）
- **GET /api/feedback/stats** - 统计数据API（管理员）
- **GET /api/feedback/:id** - 单条反馈详情（管理员）
- **DELETE /api/feedback/:id** - 删除反馈（管理员）

#### 2. 前端组件 (`assets/js/feedback-modal.js`)
- 独立的反馈弹窗组件
- 5星评分界面
- 问题分类下拉菜单
- 文本反馈输入
- 支持中文/英文/韩文三语言
- 完全可重用的JS模块

#### 3. 管理后台 (`pages/admin-feedback.html`)
- 📊 实时统计仪表板
- 📈 评分分布柱状图
- 📋 问题分类统计
- 🔮 占算类型分析
- ⚠️ 高频关键词提取
- 💬 反馈列表查看/删除
- 分页功能

#### 4. 文档与示例
- `FEEDBACK-INTEGRATION.md` - 完整集成指南
- `FEEDBACK-INTEGRATION-EXAMPLES.html` - 代码示例
- `FEEDBACK-SYSTEM-README.md` - 本文档

---

## 核心功能

### 功能1：用户反馈弹窗

**触发时机**：报告生成后自动显示或用户手动点击

**包含内容**：
- 5星评分选择（完全交互式）
- 问题分类（6种预设分类）
- 反馈文本框
- 可选的用户名/邮箱

**本地化**：
```javascript
FeedbackModal.show({
  lang: 'zh',  // 中文
  lang: 'en',  // 英文
  lang: 'kr'   // 韩文
});
```

### 功能2：反馈数据收集

**收集字段**：
```json
{
  "id": 123,                    // 反馈ID
  "name": "用户名",             // 用户名（可选）
  "email": "user@example.com",  // 邮箱（可选）
  "message": "反馈内容",         // 反馈文本（必需）
  "rating": 5,                  // 1-5星评分
  "category": "quality",        // 问题分类
  "readingType": "bazi",        // 占算类型
  "lang": "zh",                 // 语言
  "ip": "192.168.1.1",          // IP地址
  "userAgent": "Mozilla/5.0...", // 浏览器
  "created_at": "2026-08-11T..."  // 创建时间
}
```

### 功能3：统计分析

**实时生成统计指标**：
- 总反馈数
- 平均评分（支持小数）
- 各评分等级分布（1-5星）
- 问题分类分布
- 占算类型分布
- 高频关键词（TOP 10）

**数据示例**：
```json
{
  "total": 120,
  "avgRating": "4.23",
  "byRating": {
    "5": 70,
    "4": 37,
    "3": 8,
    "2": 3,
    "1": 2
  },
  "topIssues": [
    { "word": "准确", "count": 12 },
    { "word": "加载", "count": 8 }
  ]
}
```

### 功能4：管理后台

**权限控制**：仅管理员可访问（基于token认证）

**主要页面**：
- 📊 统计卡片（4个核心指标）
- 📈 评分分布图（5个等级柱状图）
- 📋 问题分类表（实时统计）
- 🔮 占算类型表（按访问量排序）
- ⚠️ TOP 10问题词汇
- 💬 反馈列表（支持筛选、分页）

**操作功能**：
- 按评分筛选（全部/5星/4星/3星/1-2星）
- 查看反馈详情（用户信息、内容、时间戳）
- 删除不当反馈
- 分页浏览

---

## 快速开始

### 步骤1：文件已就位

系统实现的文件已创建在以下位置：

```
/Users/karen/projects/shenyuan/
├── assets/js/
│   └── feedback-modal.js                    # 前端弹窗组件（新建）
├── pages/
│   └── admin-feedback.html                  # 管理后台（新建）
├── server/routes/
│   └── daily.js                             # 后端路由（已更新）
├── FEEDBACK-INTEGRATION.md                  # 集成指南（新建）
├── FEEDBACK-INTEGRATION-EXAMPLES.html       # 代码示例（新建）
└── FEEDBACK-SYSTEM-README.md                # 本文档（新建）
```

### 步骤2：在报告页面集成反馈弹窗

在 `pages/report.html` 末尾（`</body>` 前）添加：

```html
<script src="/assets/js/feedback-modal.js"></script>
<script>
(function() {
  setTimeout(function() {
    FeedbackModal.show({
      readingType: 'bazi',
      lang: 'zh'
    });
  }, 2000);
})();
</script>
```

对其他报告页面（report-en.html、report-kr.html 等）执行相同操作，修改对应的 `lang` 参数。

### 步骤3：测试反馈系统

**本地测试**：
1. 打开报告页面 (http://localhost:3021/pages/report.html)
2. 等待2秒，反馈弹窗自动显示
3. 选择评分、分类、填写反馈
4. 点击"提交反馈"

**查看数据**：
1. 以管理员身份登录 (http://localhost:3021/pages/admin-feedback.html)
2. 查看统计仪表板
3. 浏览最近反馈列表

---

## API 文档

### POST /api/feedback

**提交用户反馈**

```bash
curl -X POST http://localhost:3021/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "name": "小王",
    "email": "wang@example.com",
    "message": "报告很准确！",
    "rating": 5,
    "category": "quality",
    "readingType": "bazi",
    "lang": "zh"
  }'
```

**响应**：
```json
{
  "success": true,
  "message": "感谢您的反馈！您的意见对我们很重要",
  "feedbackId": 123
}
```

### GET /api/feedback/stats

**获取统计数据（仅管理员）**

```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3021/api/feedback/stats
```

**响应**：见上面的"功能3"部分

### GET /api/feedback/:id

**获取单条反馈详情（仅管理员）**

```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3021/api/feedback/123
```

### DELETE /api/feedback/:id

**删除反馈（仅管理员）**

```bash
curl -X DELETE \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3021/api/feedback/123
```

---

## 问题分类清单

| 分类代码 | 中文标签 | 英文标签 | 用途 |
|---------|---------|---------|------|
| `quality` | 准确度 | Accuracy | 报告内容准确性反馈 |
| `accuracy` | 信息完整 | Completeness | 报告信息是否完整 |
| `ui` | 界面体验 | UI/UX | 页面设计与交互反馈 |
| `performance` | 加载速度 | Performance | 页面加载、报告生成速度 |
| `other` | 其他问题 | Other | 其他未分类问题 |
| `general` | 通用反馈 | General Feedback | 一般性反馈 |

---

## 占算类型支持

系统支持以下占算类型（可扩展）：

```
bazi        - 八字命理
tarot       - 塔罗占卜
ziwei       - 紫微斗数
mianxiang   - 面相手相
hehun       - 合婚配对
daily       - 每日运势
xingming    - 姓名学
astrology   - 西方占星
liuyao      - 六爻占卜
lingqian    - 求神灵签
daliuren    - 大六壬
qimen       - 奇门遁甲
fengshui    - 风水评测
geo_fortune - 地理命理
```

---

## 前端集成示例

### 基础集成
```javascript
FeedbackModal.show({
  readingType: 'bazi',
  lang: 'zh'
});
```

### 带回调
```javascript
FeedbackModal.show({
  readingType: 'bazi',
  lang: 'zh',
  onSuccess: function(response) {
    console.log('反馈已提交，ID:', response.feedbackId);
  },
  onClose: function() {
    console.log('弹窗已关闭');
  }
});
```

### 手动触发
```html
<button onclick="FeedbackModal.show()">💬 反馈</button>
```

### 条件显示（仅首次）
```javascript
const sessionKey = 'feedback_shown_' + new Date().toISOString().slice(0, 10);
if (!sessionStorage.getItem(sessionKey)) {
  setTimeout(() => {
    FeedbackModal.show({ readingType: 'bazi', lang: 'zh' });
    sessionStorage.setItem(sessionKey, '1');
  }, 2000);
}
```

---

## 数据存储

### 内存结构
```javascript
_M.feedbacks = [
  {
    id: 123,
    name: '小王',
    email: 'wang@example.com',
    message: '报告很准确！',
    rating: 5,
    category: 'quality',
    readingType: 'bazi',
    lang: 'zh',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    created_at: '2026-08-11T10:30:00Z'
  },
  // ... 更多反馈
]
```

### 持久化
每次添加/删除反馈后，自动调用 `_persist()` 将数据保存到 `server/data.json`。

### 导出反馈数据
```bash
# 通过API导出统计
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3021/api/feedback/stats > feedback-stats.json

# 或直接读取JSON文件
cat server/data.json | jq '.feedbacks'
```

---

## 生产部署建议

### 1. 权限管理
- 确保管理后台接口受到认证保护
- 仅允许管理员访问 `/api/feedback/stats` 等敏感端点

### 2. 数据备份
- 定期导出 `server/data.json`
- 建议配置自动备份策略（如S3、OSS等）

### 3. 监控告警
- 建议对低分反馈（≤2星）配置自动告警
- 通过飞书/邮件通知管理员

### 4. 性能优化
- 若反馈数量过多（>10000），考虑迁移到数据库
- 可使用Redis缓存热点统计数据

### 5. 国际化
- 系统已支持中文、英文、韩文
- 可根据需要添加更多语言

---

## 已知限制 & 未来优化

### 当前限制
- 反馈数据存储在内存+文件（适合<10K量级）
- 管理后台分页固定每页10条
- 高频关键词分析基于简单word split

### 后续优化方向
- [ ] 迁移到数据库（MySQL/PostgreSQL）
- [ ] 邮件通知系统（低分反馈告警）
- [ ] NLP分析（自动提取反馈主题）
- [ ] 反馈趋势分析（按日期展示评分变化）
- [ ] 管理员回复功能（反馈与用户交互）
- [ ] 高级搜索过滤（按日期、分类、评分范围）
- [ ] 数据导出功能（CSV/Excel）
- [ ] A/B测试对比（不同报告版本的反馈对比）

---

## 故障排查

### 问题：反馈弹窗不显示
**原因**：
- 脚本加载失败
- JS错误阻止执行
- 浏览器控制台错误

**解决**：
```javascript
console.log('FeedbackModal:', typeof FeedbackModal);  // 检查是否加载
FeedbackModal.show();  // 手动触发测试
```

### 问题：反馈提交失败（网络错误）
**原因**：
- API端点不可访问
- CORS 配置问题
- 服务器返回非200状态码

**解决**：
```bash
# 测试API可访问性
curl -X POST http://localhost:3021/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### 问题：管理后台显示"权限不足"
**原因**：
- localStorage 中无有效token
- 管理员认证失败

**解决**：
- 检查 localStorage 中是否存在 `sy_admin_token`
- 重新登录管理员账号

---

## 代码统计

### 新增代码量
- `feedback-modal.js`: ~520行（含注释和样式）
- `admin-feedback.html`: ~540行（含HTML、CSS、JS）
- `daily.js` 更新: ~140行（新增4个API端点）
- 文档: ~1200行

**总计**: 约2400行代码 + 完整文档

---

## 支持与反馈

如在集成过程中遇到问题，请参考：
1. `FEEDBACK-INTEGRATION.md` - 详细集成指南
2. `FEEDBACK-INTEGRATION-EXAMPLES.html` - 代码示例
3. 浏览器控制台 - 查看JavaScript错误

---

## 许可证

善缘项目 © 2026
