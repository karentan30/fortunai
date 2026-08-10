# 善缘 AI 客服系统集成指南

## 概览

完整的 AI 客服系统包含：
1. **客服 Widget**（右下角浮窗）- `/pages/support-widget.html`
2. **后端路由**（AI回复 + 工单存储）- `/server/routes/support.js`
3. **管理后台**（查看和管理工单）- `/pages/admin-support.html`

---

## 一、前端集成

### 方式1：在 HTML 页面中嵌入 Widget

在任何需要客服功能的页面 `<head>` 或 `</body>` 前添加：

```html
<!-- 善缘客服 Widget -->
<script src="/pages/support-widget.html" type="module"></script>
```

或在单独的 HTML 页面中直接打开：

```html
<iframe src="/pages/support-widget.html" width="400" height="600" style="border:none;border-radius:12px"></iframe>
```

### 方式2：作为独立页面

用户可以访问完整的客服页面：
- URL: `https://shenyuan.app/pages/support-widget.html`

---

## 二、后端路由

### API 端点

#### 1. AI 回复（实时对话）
```
POST /api/support-chat
```

**请求参数：**
```json
{
  "product": "shenyuan",     // 产品标识：shenyuan | lumee | slim | wujing
  "message": "你好，怎么预约代烧",   // 用户消息
  "history": [               // 对话历史（可选）
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**返回：**
```json
{
  "reply": "我来帮你解答代烧的具体流程..."
}
```

**示例请求：**
```javascript
const response = await fetch('/api/support-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    product: 'shenyuan',
    message: '怎样才能看八字命盘？',
    history: []
  })
});
const data = await response.json();
console.log(data.reply);
```

---

#### 2. 提交工单（升级人工客服）
```
POST /api/support-ticket
```

**请求参数：**
```json
{
  "product": "shenyuan",
  "email": "user@example.com",
  "question": "我的订阅问题...",
  "conversation": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**返回：**
```json
{
  "ok": true,
  "message": "已收到，我们会在24小时内回复你的邮箱"
}
```

---

#### 3. 查询工单列表（后台）
```
GET /api/support-tickets
```

**返回：**
```json
{
  "ok": true,
  "tickets": [
    {
      "id": "tk_1723145232123",
      "product": "shenyuan",
      "email": "user@example.com",
      "question": "八字如何查看",
      "conversation": [...],
      "status": "new",  // new | open | resolved
      "ts": "2024-08-10T12:34:56.789Z",
      "ip": "1.2.3.4"
    }
  ],
  "count": 42
}
```

---

#### 4. 更新工单状态
```
POST /api/support-ticket/:id/status
```

**请求参数：**
```json
{
  "status": "open"  // new | open | resolved
}
```

**返回：**
```json
{
  "ok": true,
  "message": "状态已更新"
}
```

---

#### 5. 消息历史（获取特定邮箱的对话记录）
```
GET /api/support-messages/:email
```

**返回：**
```json
{
  "ok": true,
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

---

#### 6. 统计信息
```
GET /api/support-stats
```

**返回：**
```json
{
  "ok": true,
  "stats": {
    "total": 156,
    "new": 12,
    "open": 34,
    "resolved": 110,
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

## 三、管理后台

### 访问地址
```
https://shenyuan.app/pages/admin-support.html
```

### 功能

#### 1. 工单列表
- 显示所有工单（新/进行中/已解决）
- 支持按邮箱、产品、状态筛选
- 搜索问题关键词

#### 2. 工单详情
- 查看完整对话记录
- 查看用户IP和提交时间
- 修改工单状态
- 一键发送回复邮件

#### 3. 统计仪表板
- 新工单数、进行中数、已解决数
- 按产品统计

### 后台工作流

1. **新工单到达** → 邮件通知（Resend）
2. **客服查看** → admin-support.html 中查看详情
3. **分类处理**
   - 简单问题：直接状态改为 "已解决"
   - 需要跟进：状态改为 "进行中"，点击"回复"发邮件
4. **标记完成** → 状态改为 "已解决"

---

## 四、AI 系统提示词

### 善缘客服
```
你是善缘的客服助手，用温和体贴的中文帮用户解决问题。

【关于善缘】
善缘提供八字命理分析和代烧祭祀服务，服务海外华人及国内用户。

【你能回答的问题】
- 八字命理：输入出生年月日时，可以查看命盘分析、运势、感情、事业方向
- 代烧服务：由专业法师代为进行祭祀，全程直播见证，结束后提供存档
- 预约流程：在网站选择日期→填写信息→付款→等待确认
- 祭品：可以在预约时备注特殊需求

【边界】
- 涉及具体仪式安排、付款、退款，引导联系人工
- 不要对命理结果做任何保证
- 如被问到你是什么AI，回答「我是善缘客服，有什么可以帮你？」
```

根据产品修改对应部分即可。

---

## 五、数据存储

### 工单存储格式

工单存储在 `/www/lumee/data/support_tickets.jsonl`（JSONL 格式，一行一条）：

```jsonl
{"ts":"2024-08-10T12:34:56.789Z","id":"tk_1723145232123","product":"shenyuan","email":"user@example.com","question":"如何查八字","conversation":[{"role":"user","content":"怎样查八字"},{"role":"assistant","content":"请输入..."}],"status":"new","ip":"1.2.3.4"}
```

### 消息本地存储

Widget 自动保存对话记录到浏览器 `localStorage`：
- Key: `shenyuan_support_messages`
- 最多保存 50 条消息
- 用户关闭浏览器后仍保留

---

## 六、自定义配置

### Widget 样式调整

在 `support-widget.html` 中修改 CSS 变量：

```css
:root {
  --primary: #9b6ba8;          /* 主色（紫色） */
  --primary-light: #c9a8d4;    /* 浅紫色 */
  --border: #e5dce6;           /* 边框颜色 */
}
```

### 快速菜单自定义

在 HTML 中修改菜单项：

```html
<button class="support-widget-menu-item" data-action="faq-custom">自定义问题</button>
```

然后在 JavaScript 中处理：

```javascript
if (action === 'faq-custom') {
  this.messageInput.value = '自定义问题内容';
  this.messageInput.focus();
}
```

---

## 七、环保最佳实践

### 性能优化

1. **延迟加载 Widget**
   ```javascript
   // 只在需要时加载
   if (user.isLoggedIn) {
     loadScript('/pages/support-widget.html');
   }
   ```

2. **消息限制**
   - Widget 最多保留 50 条消息
   - 自动删除 7 天前的本地记录

3. **请求节流**
   - 避免连续快速发送
   - 管理后台每 30 秒自动刷新

### 安全防护

1. **输入验证**
   - 邮箱格式检查
   - 消息长度限制

2. **CORS 配置**
   - 只允许指定域名访问
   - 生产环境配置在 `index.js` 中

3. **敏感信息**
   - 不存储密码或支付信息
   - 工单包含IP追踪用于防滥用

---

## 八、故障排除

### Widget 不显示

**检查清单：**
1. 检查浏览器控制台是否有 JS 错误
2. 确认 `/pages/support-widget.html` 文件存在
3. 检查 CORS 配置（生产环境）
4. 检查是否被 adblocker 阻止

### AI 回复异常

**检查清单：**
1. 确认 `DEEPSEEK_API_KEY` 环境变量已设置
2. 查看服务器日志：`[support-chat]` 错误
3. 检查网络连接
4. 确认 API 配额未超限

### 工单未收到

**检查清单：**
1. 确认 `RESEND_API_KEY` 环境变量已设置
2. 检查邮箱是否在垃圾邮件
3. 查看服务器日志：`[support-ticket] email sent`
4. 确认文件写权限：`/www/lumee/data/`

---

## 九、监控和报告

### 日志位置

**服务器日志关键词：**
- `[support-chat]` - AI 对话日志
- `[support-ticket]` - 工单提交日志
- `[support-tickets]` - 后台查询日志

**查看方式：**
```bash
# HK 服务器
ssh ubuntu@47.242.80.65
tail -f /var/log/shenyuan.log | grep support
```

### 监控指标

1. **响应时间**：AI 平均回复时间 < 3s
2. **成功率**：工单成功率 > 95%
3. **邮件送达**：Resend 送达率 > 98%

---

## 十、后续功能规划

- [ ] 实时客服转接（WebSocket）
- [ ] 工单标签和优先级
- [ ] 客服绩效统计
- [ ] 多语言支持（EN/KR）
- [ ] 文件上传（证明材料）
- [ ] 自动化回复规则（如特定关键词）

---

## 联系支持

技术问题？查看日志或检查：
- 后端代码：`/server/routes/support.js`
- 前端代码：`/pages/support-widget.html`、`/pages/admin-support.html`
- 本文档定期更新，最后修改：2026-08-11
