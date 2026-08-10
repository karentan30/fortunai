# 善缘反馈系统集成指南

## 系统概述

完整的用户反馈系统包括：
- **前端**：5星评分弹窗 + 问题分类 + 文本反馈
- **后端**：反馈数据存储 + 管理接口
- **管理后台**：评分统计 + 问题分析 + 反馈查看

## 架构

```
pages/report.html                    # 报告页面（示例）
├── assets/js/feedback-modal.js     # 反馈弹窗组件（独立）
└── POST /api/feedback              # 反馈提交API

pages/admin-feedback.html            # 管理后台
├── GET /api/feedback/stats         # 获取统计数据
├── GET /api/feedback/:id           # 获取反馈详情
└── DELETE /api/feedback/:id        # 删除反馈

server/routes/daily.js              # 后端路由
├── POST /api/feedback              # 提交反馈（新版含评分）
├── GET /api/feedback/stats         # 管理统计
├── GET /api/feedback/:id           # 获取反馈
└── DELETE /api/feedback/:id        # 删除反馈
```

## 使用方式

### 1. 在报告页面集成反馈弹窗

在任何报告页面（report.html、report-en.html 等）的末尾，在 `</body>` 前添加：

```html
<!-- 反馈弹窗脚本 -->
<script src="/assets/js/feedback-modal.js"></script>

<!-- 报告生成完成后，触发反馈弹窗 -->
<script>
  // 当报告完全加载后，自动显示反馈弹窗（可选）
  function showFeedbackAfterReport() {
    // 延迟2秒，让用户先看报告内容
    setTimeout(() => {
      FeedbackModal.show({
        readingType: 'bazi',    // 占算类型：bazi, tarot, ziwei 等
        lang: 'zh',              // 语言：zh, en, kr
        onSuccess: function(data) {
          console.log('反馈已提交，ID:', data.feedbackId);
          // 可选：成功后的额外处理（如跳转、埋点等）
        },
        onClose: function() {
          console.log('反馈弹窗已关闭');
        }
      });
    }, 2000);
  }

  // 报告DOM完全加载后调用
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showFeedbackAfterReport);
  } else {
    showFeedbackAfterReport();
  }
</script>
```

### 2. 手动触发反馈弹窗

在页面任何位置可以通过以下方式手动打开反馈弹窗：

```javascript
// 最简单的调用
FeedbackModal.show();

// 指定占算类型
FeedbackModal.show({
  readingType: 'hehun',  // 合婚
  lang: 'en'
});

// 完整配置
FeedbackModal.show({
  readingType: 'bazi',
  lang: 'zh',
  apiEndpoint: '/api/feedback',  // 自定义API端点
  onSuccess: function(response) {
    console.log('提交成功', response);
  },
  onClose: function() {
    console.log('弹窗已关闭');
  }
});
```

### 3. 后端API文档

#### POST /api/feedback — 提交反馈

**请求**：
```json
{
  "name": "用户名",
  "email": "user@example.com",
  "message": "反馈内容",
  "rating": 5,
  "category": "quality",
  "readingType": "bazi",
  "lang": "zh"
}
```

**参数说明**：
- `name`（可选）：用户名，默认"匿名用户"
- `email`（可选）：邮箱
- `message`（必需）：反馈内容
- `rating`（可选）：1-5 星，0表示不评分
- `category`（可选）：问题分类
  - `quality`：准确度
  - `accuracy`：信息完整
  - `ui`：界面体验
  - `performance`：加载速度
  - `other`：其他问题
  - `general`：通用反馈（默认）
- `readingType`（可选）：占算类型（bazi, tarot, ziwei等）
- `lang`（可选）：语言代码（zh, en, kr）

**响应**：
```json
{
  "success": true,
  "message": "感谢您的反馈！您的意见对我们很重要",
  "feedbackId": 123
}
```

#### GET /api/feedback/stats — 获取统计数据

**权限**：需要管理员认证

**响应示例**：
```json
{
  "total": 120,
  "avgRating": "4.23",
  "byRating": {
    "1": 2,
    "2": 3,
    "3": 8,
    "4": 37,
    "5": 70
  },
  "byCategory": {
    "quality": 45,
    "ui": 32,
    "performance": 20,
    "general": 23
  },
  "byReadingType": {
    "bazi": 60,
    "tarot": 30,
    "ziwei": 30
  },
  "topIssues": [
    { "word": "准确", "count": 12 },
    { "word": "加载", "count": 8 }
  ],
  "recentFeedbacks": [...]
}
```

#### GET /api/feedback/:id — 获取反馈详情

**权限**：需要管理员认证

**响应示例**：
```json
{
  "id": 123,
  "name": "小王",
  "email": "wang@example.com",
  "message": "报告很准确！",
  "rating": 5,
  "category": "quality",
  "readingType": "bazi",
  "lang": "zh",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "created_at": "2026-08-11T10:30:00Z"
}
```

#### DELETE /api/feedback/:id — 删除反馈

**权限**：需要管理员认证

**响应**：
```json
{
  "success": true
}
```

### 4. 管理后台

访问 `/pages/admin-feedback.html`（需要管理员登录）

**功能**：
- 📊 反馈统计：总数、平均评分、五星占比、低分占比
- 📈 评分分布：5个评分等级的柱状图
- 📋 问题分类：各类型反馈统计
- 🔮 占算类型：各占算方式的反馈数
- ⚠️ 高频关键词：TOP 10问题词汇
- 💬 反馈列表：可按评分过滤、查看详情、删除

## 反馈分类说明

| 分类代码 | 标签 | 中文 | 英文 | 韩文 |
|---------|------|------|------|------|
| `quality` | ⭐ | 准确度 | Accuracy | 정확도 |
| `accuracy` | 📝 | 信息完整 | Completeness | 정보 완성도 |
| `ui` | 🎨 | 界面体验 | UI/UX | 인터페이스 |
| `performance` | ⚡ | 加载速度 | Performance | 로딩 속도 |
| `other` | ❓ | 其他问题 | Other | 기타 문제 |
| `general` | 💬 | 通用反馈 | General Feedback | 피드백 |

## 占算类型代码

支持的占算类型（可扩展）：
- `bazi` - 八字命理
- `tarot` - 塔罗占卜
- `ziwei` - 紫微斗数
- `mianxiang` - 面相手相
- `hehun` - 合婚配对
- `daily` - 每日运势
- `xingming` - 姓名学
- `astrology` - 西方占星
- `liuyao` - 六爻占卜
- `lingqian` - 求神灵签
- `daliuren` - 大六壬
- `qimen` - 奇门遁甲
- `fengshui` - 风水评测
- `geo_fortune` - 地理命理

## 本地化支持

反馈系统支持三种语言：

### 中文 (zh)
```javascript
FeedbackModal.show({ lang: 'zh' });
```

### 英文 (en)
```javascript
FeedbackModal.show({ lang: 'en' });
```

### 韩文 (kr)
```javascript
FeedbackModal.show({ lang: 'kr' });
```

## 样式定制

### 修改主题色

在 `feedback-modal.js` 中找到颜色变量，可自定义：

```javascript
// 修改前
background: rgba(91,191,160,0.9);  // jade绿色

// 修改后
background: rgba(201,168,76,0.9);  // gold金色
```

### 自定义API端点

如果后端部署在不同位置：

```javascript
FedbackModal.show({
  apiEndpoint: 'https://api.example.com/feedback'
});
```

## 数据持久化

反馈数据存储在内存中（`_M.feedbacks` 数组），每次提交后通过 `_persist()` 落盘到 `data.json`。

### 导出反馈数据

```bash
# 通过API导出
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3021/api/feedback/stats > feedback-stats.json

# 或直接读取本地数据文件
cat server/data.json | jq '.feedbacks'
```

## 集成检查清单

- [ ] 在报告页面引入 `/assets/js/feedback-modal.js`
- [ ] 在报告加载完成后调用 `FeedbackModal.show()`
- [ ] 后端已添加管理接口（GET /api/feedback/stats等）
- [ ] 访问 `/pages/admin-feedback.html` 验证管理后台
- [ ] 测试反馈提交、查看、删除功能
- [ ] 验证各语言弹窗显示正确
- [ ] 确保管理员认证正常工作

## 常见问题

**Q: 用户关闭弹窗而不提交反馈会怎样？**  
A: 不会记录任何数据，用户下次访问时会再次看到弹窗。

**Q: 如何防止重复反馈？**  
A: 可在弹窗显示前检查 localStorage 中的时间戳，如超过N小时再显示。

**Q: 反馈数据如何备份？**  
A: 定期导出 `server/data.json` 或通过 API 导出统计数据。

**Q: 如何自动发送低分反馈通知？**  
A: 可在后端添加 webhook 或定时任务，当收到≤2星反馈时发送邮件/飞书提醒。

## 后续优化方向

1. **邮件通知**：管理员接收高优先级反馈提醒
2. **自动分析**：使用NLP提取反馈主题
3. **AB测试**：追踪不同报告版本的反馈对比
4. **反馈回复**：管理员可回复用户（需邮件基建）
5. **反馈趋势**：按日期展示评分变化
6. **多语言报告**：管理后台支持更多语言
