# 善缘 AI 客服系统

完整的 AI 客服解决方案，包括实时对话、工单管理、后台管理界面。

## 📦 系统组成

### 前端组件
```
pages/
├── support-widget.html       # 客服 Widget（右下角浮窗）
└── admin-support.html        # 后台管理界面
```

### 后端逻辑
```
server/
└── routes/
    └── support.js            # 客服路由（AI+工单+统计）
```

### 文档和测试
```
docs/
├── SUPPORT-WIDGET-INTEGRATION.md  # 详细集成文档
├── SUPPORT-QUICK-START.md         # 快速启用指南
└── ...

server/
└── test-support.js           # 自动化测试脚本
```

---

## 🚀 快速启用

### 1. 配置环境变量

```bash
# .env 文件中添加（已存在则跳过）
DEEPSEEK_API_KEY=sk-xxxxx    # AI 回复（从 https://www.deepseek.com/ 获取）
RESEND_API_KEY=re-xxxxx      # 邮件通知（从 https://resend.com/ 获取）
```

### 2. 后端已自动集成

检查 `/server/index.js` 第 175 行，已自动挂载：

```javascript
const supportRouter = require('./routes/support');
app.use('/api', supportRouter);
```

### 3. 在页面中嵌入 Widget

**方式 A：iframe（推荐，隔离最好）**

```html
<iframe 
  src="/pages/support-widget.html" 
  style="position:fixed;bottom:20px;right:20px;width:380px;height:600px;border:none;border-radius:12px;z-index:99999">
</iframe>
```

**方式 B：动态加载**

```html
<script>
  fetch('/pages/support-widget.html')
    .then(r => r.text())
    .then(html => {
      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div.firstElementChild);
    });
</script>
```

### 4. 验证安装

```bash
# 启动服务器
cd /server && npm start

# 新开终端，运行测试
node /server/test-support.js
```

预期输出：
```
✓ 通过: 7
✗ 失败: 0

总体通过率: 100%

🎉 所有测试通过！
```

---

## 📋 API 端点

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/support-chat` | AI 对话 |
| POST | `/api/support-ticket` | 提交工单 |
| GET | `/api/support-tickets` | 工单列表（后台） |
| POST | `/api/support-ticket/:id/status` | 更新工单状态 |
| GET | `/api/support-messages/:email` | 查询消息历史 |
| GET | `/api/support-stats` | 统计信息 |

详见 `/docs/SUPPORT-WIDGET-INTEGRATION.md`

---

## 🎨 用户界面

### 客服 Widget
- 位置：右下角浮球（💬）
- 特性：
  - 实时 AI 对话
  - 消息本地保存（localStorage）
  - 快捷菜单（FAQ）
  - 升级人工客服
  - 移动端完全适配

### 管理后台
- 访问：`https://shenyuan.app/pages/admin-support.html`
- 功能：
  - 工单列表和搜索
  - 查看完整对话记录
  - 状态管理（新/进行中/已解决）
  - 统计仪表板
  - 一键回复邮件

---

## 📊 工单工作流

```
用户提问
  ↓
AI 快速回复（DeepSeek）
  ↓
问题解决？ ──是→ 完成
  ↓否
用户要求人工处理
  ↓
填邮箱 + 问题 → 提交工单
  ↓
后台邮件通知（Resend）
  ↓
客服查看工单 (admin-support.html)
  ↓
回复邮件或修改状态
  ↓
用户邮件通知 → 完成
```

---

## 💾 数据存储

### 工单存储
- 格式：JSONL（一行一条记录）
- 位置：`/www/lumee/data/support_tickets.jsonl`
- 备份：自动保存，可手动备份

### 消息本地存储
- 方式：浏览器 localStorage
- Key：`shenyuan_support_messages`
- 大小：最多 50 条消息
- 生命周期：用户清除浏览器缓存后丢失

---

## ⚙️ 配置

### 改变 Widget 主题色

编辑 `/pages/support-widget.html`：

```css
:root {
  --primary: #9b6ba8;          /* 主色改这里 */
  --primary-light: #c9a8d4;    /* 浅色改这里 */
}
```

### 改变 AI 系统提示词

编辑 `/server/routes/support.js` 的 `SYSTEM_PROMPTS` 对象。

当前支持的产品：
- `shenyuan`：善缘（八字、代烧）
- `lumee`：鹿觅（声音克隆）
- `slim`：Slim（减脂助手）
- `wujing`：舞镜（舞蹈分析）

### 改变通知邮箱

编辑 `/server/routes/support.js` 第 8 行：

```javascript
const NOTIFY_EMAIL = 'tan42204@gmail.com'; // 改这里
```

---

## 🧪 测试和调试

### 自动化测试
```bash
node /server/test-support.js
```

涵盖以下场景：
- ✓ 健康检查
- ✓ AI 对话
- ✓ 工单提交
- ✓ 工单查询
- ✓ 状态更新
- ✓ 消息历史
- ✓ 统计数据

### 手动测试

**测试 AI 对话：**
```bash
curl -X POST http://localhost:3021/api/support-chat \
  -H "Content-Type: application/json" \
  -d '{
    "product": "shenyuan",
    "message": "怎样查看八字命盘？",
    "history": []
  }'
```

**测试工单提交：**
```bash
curl -X POST http://localhost:3021/api/support-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "product": "shenyuan",
    "email": "test@example.com",
    "question": "测试工单",
    "conversation": []
  }'
```

**查看统计：**
```bash
curl http://localhost:3021/api/support-stats | jq .
```

### 查看日志

```bash
# 实时日志
tail -f /var/log/shenyuan.log | grep support

# 查找特定日期的日志
grep "2024-08-10" /var/log/shenyuan.log | grep support
```

---

## 🔒 安全考虑

### 输入验证
- ✓ 邮箱格式检查
- ✓ 消息长度限制（max 1000 字）
- ✓ SQL 注入防护（使用 JSON 存储）

### 隐私保护
- ✓ 工单包含用户 IP（防滥用）
- ✓ 不存储密码或支付信息
- ✓ 消息本地加密（localStorage）

### 访问控制
- ✓ 后台管理页面需要手动认证（可增强）
- ✓ 工单 API 无认证（仅后台自用）
- ✓ CORS 配置白名单

### 建议增强
- [ ] 给后台管理页面添加密码认证
- [ ] 工单 API 添加 Bearer Token
- [ ] 支持更多的通知渠道（钉钉、企业微信）

---

## 📈 监控和维护

### 关键指标
| 指标 | 目标 | 监控频率 |
|------|------|---------|
| AI 回复时间 | < 3s | 实时 |
| 工单积压 | < 10 条 | 每天 |
| 邮件送达率 | > 98% | 每周 |
| 数据库大小 | < 100MB | 每月 |

### 日常维护
```bash
# 每天检查
curl http://shenyuan.app/api/support-stats | jq .stats.new
# 如果 > 10，通知客服立即处理

# 每周备份
tar -czf support_backup_$(date +%Y%m%d).tar.gz /www/lumee/data/support_tickets.jsonl

# 每月清理（可选，删除 90 天前的已解决工单）
# 脚本待补充
```

### 故障排除

**Widget 不显示**
- 检查浏览器控制台错误
- 确认 `/pages/support-widget.html` 文件存在
- 检查是否被 adblocker 或内容安全策略阻止

**AI 无回应**
- 检查 `DEEPSEEK_API_KEY` 是否设置
- 查看日志：`grep "support-chat" /var/log/shenyuan.log`
- 检查 API 配额是否用尽

**邮件未送达**
- 检查 `RESEND_API_KEY` 是否设置
- 检查垃圾邮件文件夹
- 查看日志：`grep "email sent\|email failed" /var/log/shenyuan.log`

---

## 📚 相关文档

| 文档 | 内容 |
|------|------|
| `/docs/SUPPORT-WIDGET-INTEGRATION.md` | API 详细文档、自定义指南 |
| `/docs/SUPPORT-QUICK-START.md` | 1 分钟启用、常见问题 |
| `/server/routes/support.js` | 后端实现代码 |
| `/pages/support-widget.html` | 前端 Widget 代码 |
| `/pages/admin-support.html` | 后台管理代码 |
| `/server/test-support.js` | 自动化测试代码 |

---

## 🗺️ 功能地图

### ✅ 已实现
- [x] AI 客服对话（DeepSeek）
- [x] 工单提交和管理
- [x] 邮件通知（Resend）
- [x] 消息本地存储
- [x] 后台管理界面
- [x] 工单搜索和筛选
- [x] 统计仪表板
- [x] 移动端适配

### 🚧 计划中
- [ ] 多语言支持（EN/KR）
- [ ] 钉钉/企业微信通知
- [ ] 文件上传（证明材料）
- [ ] 实时客服转接（WebSocket）
- [ ] 客服绩效统计
- [ ] 自动化回复规则
- [ ] 工单优先级和标签

---

## 📞 技术支持

### 版本信息
- 版本：v1.0
- 发布日期：2026-08-11
- 维护者：Karen
- 所有产品通用

### 获取帮助

1. **快速查询**
   - `/docs/SUPPORT-QUICK-START.md` - 常见问题
   - `/docs/SUPPORT-WIDGET-INTEGRATION.md` - API 文档

2. **运行测试**
   ```bash
   node /server/test-support.js
   ```

3. **查看日志**
   ```bash
   tail -f /var/log/shenyuan.log | grep support
   ```

4. **提交 Issue**
   - 描述问题
   - 附加日志输出
   - 提供重现步骤

---

## 📄 许可证

内部系统，无外部许可。

---

**最后更新：2026-08-11**
**下一次审查：2026-09-11**
