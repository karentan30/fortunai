# 🚨 善缘监控告警系统

**版本**: 1.0 | **状态**: 生产就绪 | **最后更新**: 2026-08-08

完整的生产级监控告警系统,实时监控支付、邀请、服务器健康,自动发送 Slack 通知。

```
┌─────────────────┐
│  后端服务        │
│  (支付/邀请)     │
└────────┬────────┘
         │ POST /alert/{type}
         ▼
┌─────────────────────────────┐
│   slack-alerts.js           │
│   (告警系统核心)            │
│  ├─ 指标计算                │
│  ├─ 阈值判断                │
│  ├─ 告警去重                │
│  └─ Slack 通知              │
└────────┬────────────────────┘
         │ Webhook URL
         ▼
┌─────────────────────────────┐
│   Slack 频道                │
│  #shenyuan-alerts           │
│  #shenyuan-payments         │
│  #shenyuan-invites          │
│  #shenyuan-infra            │
└─────────────────────────────┘
```

---

## 📦 包含内容

| 文件 | 说明 |
|------|------|
| **slack-alerts.js** | 核心告警系统(Node.js,pm2托管) |
| **monitoring-dashboard.html** | 实时KPI看板(每60秒自刷新) |
| **slack-webhook-template.json** | Slack配置模板 + 文档 |
| **scripts/monitoring-setup.sh** | 一键部署脚本 |
| **docs/alert-rules.md** | 告警规则详细配置 |
| **docs/MONITORING-INTEGRATION-GUIDE.md** | 后端集成步骤 |
| **logs/alerts-*.log** | 告警系统日志 |

---

## 🚀 五分钟快速开始

### 1. 配置 Slack Webhook

访问 https://api.slack.com/apps 创建 Incoming Webhook:
- 新建 App → 选择 "From scratch"
- 命名为 "ShenYuan Alerts"
- 左菜单 → "Incoming Webhooks" → 打开
- 为每个频道创建 webhook (alerts/payments/invites/infra)

### 2. 运行部署脚本

```bash
cd /Users/karen/projects/shenyuan
bash scripts/monitoring-setup.sh
```

脚本会自动:
- ✅ 验证 Node.js 和 pm2
- ✅ 配置 Slack webhook 到 ~/.env.production
- ✅ 启动告警系统
- ✅ 配置定时服务器监控
- ✅ 验证系统可用性

### 3. 查看监控看板

```bash
# 方式1: 直接打开HTML文件
open monitoring-dashboard.html

# 方式2: 使用HTTP服务
cd /Users/karen/projects/shenyuan
python3 -m http.server 8000
# 访问 http://localhost:8000/monitoring-dashboard.html
```

### 4. 发送测试告警

```bash
# 测试支付成功通知
curl -X POST http://localhost:3007/alert/payment \
  -H "Content-Type: application/json" \
  -d '{
    "type": "success",
    "amount": 99.9,
    "orderId": "test-001",
    "userId": "user-123",
    "processingTime": 1200
  }'

# 查看Slack #shenyuan-payments 频道是否收到通知
```

### 5. 集成到后端

在支付/邀请处理逻辑中添加调用:

```javascript
// 支付成功
await fetch('http://localhost:3007/alert/payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'success',
    amount: order.amount,
    orderId: order.id,
    userId: order.userId,
    processingTime: Date.now() - startTime,
  }),
});

// 邀请激活
await fetch('http://localhost:3007/alert/invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    referrer: invite.referrerId,
    invitee: newUserId,
    activated: true,
    activatedAt: new Date().toISOString(),
    reward: 50,
  }),
});
```

详见 [MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md)

---

## 📊 系统架构

### 数据流

```
┌─ 支付事件 ──────┐
│                  │
├─ 邀请事件 ──► slack-alerts.js ──► 指标更新
│                  │
└─ 服务器指标 ──┘
                   │
                   ├─ 检查阈值
                   │
                   ├─ 超过时 ───► Slack webhook
                   │
                   └─ 实时指标 ──► GET /metrics
```

### 4个 Slack 频道

| 频道 | 用途 | 成员 |
|------|------|------|
| **#shenyuan-alerts** | 系统级告警、错误异常 | @on-call-engineer, @product-lead |
| **#shenyuan-payments** | 支付成功/失败详细记录(财务审计) | @finance, @ceo, @cto |
| **#shenyuan-invites** | 邀请激活转化漏斗监控 | @growth-team, @product-lead |
| **#shenyuan-infra** | 服务器健康、部署、故障转移 | @devops, @on-call-sre |

### 告警阈值(可调)

| 指标 | 阈值 | 触发级别 |
|------|------|---------|
| 支付失败率 | > 5% | 🟡 WARNING |
| 邀请流失率 | > 30% | 🟡 WARNING |
| 内存占用 | > 80% | 🟡 WARNING / > 95% 🔴 CRITICAL |
| 磁盘占用 | > 85% | 🟡 WARNING / > 95% 🔴 CRITICAL |
| API错误率 | > 2% | 🟡 WARNING |
| 支付延迟 | > 5秒 | 🟡 WARNING |

详见 [docs/alert-rules.md](docs/alert-rules.md)

---

## 🔧 常用命令

### 系统管理

```bash
# 查看系统状态
pm2 list

# 查看日志
pm2 logs shenyuan-alerts

# 实时监控
pm2 monit

# 重启系统
pm2 restart shenyuan-alerts

# 停止系统
pm2 stop shenyuan-alerts

# 启动系统
pm2 start slack-alerts.js -i 1 --name shenyuan-alerts --env production
```

### API 调用

```bash
# 健康检查
curl http://localhost:3007/health

# 查询当前指标
curl http://localhost:3007/metrics | jq

# 发送支付通知
curl -X POST http://localhost:3007/alert/payment \
  -H 'Content-Type: application/json' \
  -d '{"type":"success","amount":99.9,"orderId":"test","userId":"user1","processingTime":1200}'

# 发送邀请通知
curl -X POST http://localhost:3007/alert/invite \
  -H 'Content-Type: application/json' \
  -d '{"referrer":"user1","invitee":"user2","activated":true,"activatedAt":"2026-08-08T12:00:00Z","reward":50}'

# 发送服务器指标
curl -X POST http://localhost:3007/alert/server \
  -H 'Content-Type: application/json' \
  -d '{"memory":75,"disk":80,"cpu":45,"errors":3,"requests":250}'
```

### 日志查询

```bash
# 查看最近100行日志
pm2 logs shenyuan-alerts --lines 100

# 实时跟踪日志
pm2 logs shenyuan-alerts

# 查看特定类型告警
pm2 logs shenyuan-alerts | grep "payment-error"
pm2 logs shenyuan-alerts | grep "server-memory"
```

---

## 📈 监控看板功能

打开 `monitoring-dashboard.html` 查看:

### 关键指标卡

- 💳 **支付成功率** - 实时成功率 + 平均处理时间
- 🚀 **邀请激活率** - 激活数 + 流失率
- 🧠 **服务器内存** - 占用率 + 健康状态
- 💾 **服务器磁盘** - 占用率 + 健康状态
- ⚠️ **API错误率** - 错误数 + 总请求数
- ⏱️ **系统运行时间** - 上次重启时间

### 详细统计

- 支付统计表 (成功/失败/平均时间)
- 邀请统计表 (激活/待激活/流失率)
- 服务器健康表 (CPU/内存/磁盘/PID)
- 最近告警列表 (最多显示5条)

### 自动刷新

- 每60秒自动从 `http://localhost:3007/metrics` 拉取数据
- 实时更新所有指标
- 自动判断告警状态(正常/异常/错误)

---

## 🚨 告警触发与处理

### 支付失败率告警流程

```
支付失败率 > 5%
    ↓
发送 🟡 WARNING 到 #shenyuan-alerts
    ↓
@on-call-engineer 收到通知
    ↓
检查 Stripe Dashboard → 查看错误类型
    ↓
处理 (等待恢复/人工操作)
    ↓
在Slack回复 ✅ 已解决
    ↓
告警系统停止告警(5分钟缓冲期后)
```

### SLA 响应时间

| 级别 | 响应时间 | 更新频率 |
|------|---------|---------|
| 🔴 CRITICAL | 5分钟 | 15分钟 |
| 🟡 WARNING | 15分钟 | 30分钟 |
| 🔵 INFO | 1小时 | 无需实时 |

### 告警升级规则

```
未解决15分钟 → 升级为WARNING
未解决60分钟 → 升级为CRITICAL (通知@ceo)
未解决24小时 → P0事件 (全公司standby)
```

---

## 🔐 安全性

### Webhook 保护

- Webhook URL 包含密钥,仅通过环境变量传递
- ✅ 不在代码中硬编码
- ✅ 不提交到 Git (添加到 .gitignore)
- ✅ 仅 HTTPS 传输

### IP 限制

```nginx
# nginx 配置示例
location /alert/ {
  allow 127.0.0.1;      # 仅允许localhost
  allow 10.0.0.0/8;     # 内网IP(可选)
  deny all;
}
```

### 速率限制

- Slack webhook 限流: ~1请求/秒
- 系统已实现缓冲去重规避限流
- 同类告警300秒内最多发一次

---

## 🐛 故障排查

### 告警系统不启动

```bash
# 查看错误信息
pm2 logs shenyuan-alerts

# 常见原因:
# 1. port 3007 已被占用
lsof -i :3007

# 2. Node内存不足
NODE_OPTIONS=--max-old-space-size=1024 pm2 start slack-alerts.js

# 3. 检查webhook配置
echo $SLACK_WEBHOOK_ALERTS
```

### Slack 收不到通知

```bash
# 1. 检查webhook URL是否有效
curl -X POST $SLACK_WEBHOOK_ALERTS \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test message"}'

# 2. 检查bot是否加入了对应频道
# 在Slack: 频道 → 设置 → 应用 → 检查 ShenYuan Alerts

# 3. 查看告警系统日志
pm2 logs shenyuan-alerts | grep -i webhook
```

### 指标不更新

```bash
# 1. 检查后端是否正常POST
curl -X POST http://localhost:3007/alert/payment \
  -H 'Content-Type: application/json' \
  -d '{"type":"success","amount":1,"orderId":"test","userId":"test","processingTime":1}'

# 2. 查看指标端点
curl http://localhost:3007/metrics

# 3. 检查看板是否连接
打开浏览器控制台 (F12 → Console)
查看是否有网络错误
```

### 内存占用过高

```bash
# 1. 查看进程内存
pm2 monit

# 2. 可能是内存泄漏,重启
pm2 restart shenyuan-alerts

# 3. 限制内存
pm2 start slack-alerts.js --max-memory-restart 512M

# 4. 使用clinic.js诊断
npx clinic doctor -- node slack-alerts.js
```

---

## 📚 详细文档

| 文档 | 内容 |
|------|------|
| **[alert-rules.md](docs/alert-rules.md)** | 详细的告警规则+阈值+处理流程 |
| **[MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md)** | 后端集成步骤+代码示例 |
| **[slack-webhook-template.json](scripts/slack-webhook-template.json)** | Slack配置详解 |
| **[slack-alerts.js](scripts/slack-alerts.js)** | 源码注释 |

---

## 🎓 核心概念

### 告警去重 (Deduplication)

防止告警风暴:
```javascript
CONFIG.alertDelay = {
  same: 300,      // 同类告警5分钟仅发一次
  critical: 60,   // 关键告警1分钟仅发一次
};
```

### 指标计算

实时计算的指标:
- **支付成功率** = success_count / total_count
- **邀请流失率** = (total - activated) / total
- **API错误率** = error_count / request_count

### 阈值判断

触发条件示例:
```javascript
if (failureRate > 0.05) {
  // 支付失败率超过5% → 发送WARNING
  await sendToSlack(...);
}
```

---

## 🚀 后续优化方向

- [ ] 添加告警静音功能 (值班期间自动静音)
- [ ] 集成 DataDog/NewRelic APM
- [ ] 配置自动故障转移 (数据库主从切换)
- [ ] 支持钉钉/企业微信通知
- [ ] 实现告警分级处理 (P0-P4)
- [ ] 添加告警历史回溯分析
- [ ] 支持自定义告警规则 UI

---

## 📞 支持和反馈

- **问题**: 查看 [故障排查](#-故障排查) 章节
- **改进建议**: 在 Slack #shenyuan-infra 讨论
- **紧急故障**: 直接联系 @on-call-engineer
- **文档更新**: 提交 PR 到 `docs/alert-rules.md`

---

## 📋 检查清单

部署后请确认:

- [ ] pm2 中告警系统运行中: `pm2 list`
- [ ] Slack webhook 已配置: `echo $SLACK_WEBHOOK_ALERTS`
- [ ] 健康检查通过: `curl http://localhost:3007/health`
- [ ] 测试告警已收到: 查看 Slack 频道
- [ ] 监控看板可访问: 打开 HTML 文件
- [ ] 后端已集成告警调用
- [ ] 团队已加入 Slack 频道
- [ ] 告警规则已审阅: [alert-rules.md](docs/alert-rules.md)

---

**版本信息**
- **发布日期**: 2026-08-08
- **维护者**: DevOps Team
- **支持**: 生产环境 (HK 47.242.80.65)
- **下次审核**: 2026-09-08

**快速链接**
- 🔗 Slack API: https://api.slack.com/apps
- 🔗 告警规则: [docs/alert-rules.md](docs/alert-rules.md)
- 🔗 集成指南: [docs/MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md)
- 🔗 Webhook配置: [scripts/slack-webhook-template.json](scripts/slack-webhook-template.json)
