# 善缘客服系统 - 快速启用

## 1分钟启用客服Widget

### 步骤1：在页面中添加 Widget

在你的页面 HTML（任何现有的 `.html` 文件）的 `</body>` 前添加：

```html
<!-- 善缘 AI 客服 Widget -->
<link rel="stylesheet" href="/pages/support-widget.html">
<script>
  // 动态加载 Widget
  fetch('/pages/support-widget.html')
    .then(r => r.text())
    .then(html => {
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container.firstElementChild);
    });
</script>
```

**或者更简单的方式（iframe）：**

```html
<iframe 
  src="/pages/support-widget.html" 
  style="position:fixed;bottom:20px;right:20px;width:380px;height:600px;border:none;border-radius:12px;z-index:99999;box-shadow:0 5px 40px rgba(0,0,0,0.16)">
</iframe>
```

### 步骤2：验证后端配置

确保以下环境变量已设置：

```bash
# .env 文件中
DEEPSEEK_API_KEY=sk-xxxxx  # AI回复必需
RESEND_API_KEY=re-xxxxx    # 邮件通知必需
```

### 步骤3：测试

打开页面，右下角应该出现 💬 浮球。点击试用。

---

## 完整配置清单

### 后端环境

```bash
# 1. 检查路由挂载
grep -n "require('./routes/support')" /server/index.js
# 应该看到类似：const supportRouter = require('./routes/support');

# 2. 检查数据目录
ls -la /www/lumee/data/
# 应该有 support_tickets.jsonl 文件（可以为空）

# 3. 验证 API 端点
curl http://localhost:3021/api/support-stats
# 应该返回统计数据
```

### 前端集成检查

```html
<!-- 在浏览器开发者工具中输入 -->
<script>
  // 检查 Widget 是否正确加载
  console.log('Widget loaded:', window.supportWidget ? '✓' : '✗');
  
  // 检查 localStorage
  console.log('Messages:', localStorage.getItem('shenyuan_support_messages') ? '✓' : '✗');
  console.log('State:', localStorage.getItem('shenyuan_support_open') ? '✓' : '✗');
</script>
```

---

## 使用场景

### 场景1：在登陆页添加客服
```html
<!-- lp-bazi-cn/en.html 等落地页 -->
<script src="/pages/support-widget.html"></script>
```

### 场景2：在仪表板添加客服
```html
<!-- order.html, account.html 等 -->
<!-- 支持用户查询订单、预约状态等 -->
<iframe src="/pages/support-widget.html" ...></iframe>
```

### 场景3：独立客服页面
```
https://shenyuan.app/pages/support-widget.html
```
直接分享给用户

---

## 后台管理员操作流程

### 日常工作

1. **打开管理后台**
   ```
   https://shenyuan.app/pages/admin-support.html
   ```

2. **查看新工单**
   - "新工单" 统计卡显示未处理数
   - 表格中按 "时间" 排序，最新的在最上面

3. **处理工单**
   - 点击 "查看" 按钮查看完整对话
   - 阅读用户初始问题和 AI 对话记录
   - 决定是否需要人工介入

4. **回复用户**
   - 点击 "回复" 按钮，用邮件客户端发送回复
   - 或在 modal 中修改状态后保存

5. **归档工单**
   - 改状态为 "已解决"
   - 点击保存

### 每周报告

运行以下 curl 命令获取统计：

```bash
# 获取工单统计
curl http://shenyuan.app:3021/api/support-stats | jq .

# 示例输出
{
  "ok": true,
  "stats": {
    "total": 156,
    "new": 5,      ← 待处理
    "open": 12,    ← 进行中
    "resolved": 139,
    "byProduct": {
      "shenyuan": 78,
      "lumee": 45,
      "slim": 28,
      "wujing": 5
    }
  }
}
```

---

## 常见问题

### Q1: Widget 的紫色主题色能改吗？

**A:** 可以。编辑 `/pages/support-widget.html`，在 `<style>` 中修改：

```css
:root {
  --primary: #9b6ba8;       /* 改这个 */
  --primary-light: #c9a8d4; /* 和这个 */
}
```

### Q2: AI 回复的系统提示词在哪里？

**A:** 在 `/server/routes/support.js` 中的 `SYSTEM_PROMPTS` 对象，按产品分类。

示例：
```javascript
const SYSTEM_PROMPTS = {
  shenyuan: `你是善缘的客服助手...`,
  lumee: `你是鹿觅的客服助手...`,
  // ...
};
```

### Q3: 为什么工单邮件没有收到？

**A:** 检查清单：
1. 确认 `RESEND_API_KEY` 已设置
2. 检查邮件是否在垃圾邮件
3. 查看服务器日志：`grep "email sent" /var/log/shenyuan.log`
4. 重新提交工单测试

### Q4: 如何清除所有工单？

**A:** 在服务器上：
```bash
rm /www/lumee/data/support_tickets.jsonl
touch /www/lumee/data/support_tickets.jsonl
```

### Q5: 能否集成微信/钉钉通知？

**A:** 目前仅支持邮件。可后续集成：
- 钉钉 webhook（`/api/support-ticket` 添加通知逻辑）
- 企业微信（同上）
- Slack（MCP 集成）

### Q6: Widget 是否支持多语言？

**A:** 目前仅中文。英文版本待开发。

---

## 部署清单

### 本地开发（localhost:3021）

```bash
# 1. 启动服务器
cd /server && npm start

# 2. 打开测试页面
open http://localhost:3021/pages/support-widget.html

# 3. 测试 API
curl http://localhost:3021/api/support-stats
```

### HK 服务器（47.242.80.65:3021）

```bash
# 1. SSH 登陆
ssh ubuntu@47.242.80.65

# 2. 检查服务状态
systemctl status shenyuan

# 3. 查看日志
tail -f /var/log/shenyuan.log | grep support

# 4. 重启（如修改代码）
systemctl restart shenyuan
```

### Vercel（生产环境）

```bash
# 1. 确保代码已提交
git add .
git commit -m "Add support widget"
git push origin main

# 2. Vercel 自动部署
# → 打开 https://shenyuan.vercel.app/pages/support-widget.html

# 3. 验证 API
curl https://shenyuan.vercel.app/api/support-stats
```

---

## 监控和告警

### 自动告警规则

当满足以下条件时，应该告警：

| 指标 | 阈值 | 告警 |
|------|------|------|
| 新工单 | > 10 条 | 立即通知 |
| 回复时间 | > 24h | 每日检查 |
| API 错误率 | > 5% | 立即通知 |

### 手动检查

每周一早上：
```bash
curl https://shenyuan.app/api/support-stats | jq .stats.new
# 如果 > 10，要求立即处理
```

---

## 更新日志

### v1.0（当前版本）
- ✅ AI 客服对话
- ✅ 工单提交和管理
- ✅ 邮件通知
- ✅ 消息本地存储
- ✅ 后台管理界面

### v1.1（计划中）
- [ ] 多语言支持
- [ ] 钉钉/企业微信通知
- [ ] 文件上传
- [ ] 客服评分系统

---

## 支持

有问题？检查：
1. `/docs/SUPPORT-WIDGET-INTEGRATION.md` - 详细文档
2. `/server/routes/support.js` - 后端代码
3. `/pages/support-widget.html` - 前端代码
4. 服务器日志 - 错误信息

---

**最后更新：2026-08-11**
