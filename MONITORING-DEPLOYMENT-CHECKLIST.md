# 📋 监控告警系统 - 部署清单

**项目**: 善缘命理平台  
**版本**: 1.0  
**日期**: 2026-08-08  
**检查人**: _______________  
**完成日期**: _______________

---

## ✅ 前置准备

### 环境要求

- [ ] Node.js v14+ 已安装: `node --version`
- [ ] npm v6+ 已安装: `npm --version`
- [ ] pm2 已安装: `npm install -g pm2`
- [ ] 能访问 Slack API: https://api.slack.com/apps
- [ ] HK服务器已启动: 47.242.80.65 可连接
- [ ] 服务器 port 3007 未被占用: `lsof -i :3007`

### 文件检查

- [ ] slack-alerts.js 存在: `/Users/karen/projects/shenyuan/scripts/slack-alerts.js`
- [ ] monitoring-dashboard.html 存在: `/Users/karen/projects/shenyuan/monitoring-dashboard.html`
- [ ] slack-webhook-template.json 存在: `/Users/karen/projects/shenyuan/scripts/slack-webhook-template.json`
- [ ] monitoring-setup.sh 存在且可执行: `ls -la scripts/monitoring-setup.sh`
- [ ] alert-rules.md 存在: `/Users/karen/projects/shenyuan/docs/alert-rules.md`

---

## 🔧 第一步: Slack 配置

### 创建 Slack App

- [ ] 访问 https://api.slack.com/apps
- [ ] 点击 "Create New App" → 选择 "From scratch"
- [ ] 应用名称: `ShenYuan Alerts`
- [ ] 选择工作区: [你的工作区]
- [ ] 点击 "Create App"

### 配置 Incoming Webhooks

对于每个频道 (alerts/payments/invites/infra),执行以下步骤:

#### 创建 #shenyuan-alerts Webhook

- [ ] 左菜单 → "Incoming Webhooks" → 打开
- [ ] 点击 "Add New Webhook to Workspace"
- [ ] 选择频道: `#shenyuan-alerts` (如不存在则先创建)
- [ ] 点击 "Allow"
- [ ] 复制 Webhook URL
- [ ] 保存到文本编辑器(临时)

**Webhook URL**: `https://hooks.slack.com/services/T.../B.../XXX`

验证:
```bash
curl -X POST "https://hooks.slack.com/services/..." \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test from terminal"}'
# 应在 Slack 看到消息
```

- [ ] 验证成功

#### 创建 #shenyuan-payments Webhook

重复上述步骤,选择 `#shenyuan-payments` 频道

- [ ] Webhook URL: `https://hooks.slack.com/services/T.../B.../XXX`
- [ ] 验证成功

#### 创建 #shenyuan-invites Webhook

重复上述步骤,选择 `#shenyuan-invites` 频道

- [ ] Webhook URL: `https://hooks.slack.com/services/T.../B.../XXX`
- [ ] 验证成功

#### 创建 #shenyuan-infra Webhook

重复上述步骤,选择 `#shenyuan-infra` 频道

- [ ] Webhook URL: `https://hooks.slack.com/services/T.../B.../XXX`
- [ ] 验证成功

### Slack Bot 权限设置

- [ ] 点击 "Bot Token Scopes"
- [ ] 添加权限: `chat:write` (基本权限)
- [ ] 在每个频道设置中,验证 bot 已加入:
  - [ ] #shenyuan-alerts: 频道 → 设置 → 应用 → 检查 ShenYuan Alerts
  - [ ] #shenyuan-payments
  - [ ] #shenyuan-invites
  - [ ] #shenyuan-infra

---

## 🚀 第二步: 部署告警系统

### 配置环境变量

```bash
# 编辑 ~/.env.production (新建或追加)
nano ~/.env.production
```

添加以下内容:

```
# 善缘Slack告警系统
SLACK_WEBHOOK_ALERTS=https://hooks.slack.com/services/[从上方复制]
SLACK_WEBHOOK_PAYMENT=https://hooks.slack.com/services/[从上方复制]
SLACK_WEBHOOK_INVITES=https://hooks.slack.com/services/[从上方复制]
SLACK_WEBHOOK_INFRA=https://hooks.slack.com/services/[从上方复制]
ALERT_SERVER_PORT=3007
```

验证:
```bash
source ~/.env.production
echo $SLACK_WEBHOOK_ALERTS
# 应输出 webhook URL
```

- [ ] 环境变量已配置
- [ ] 权限设置为 600: `chmod 600 ~/.env.production`
- [ ] .gitignore 已包含 .env.production

### 运行部署脚本

```bash
cd /Users/karen/projects/shenyuan
bash scripts/monitoring-setup.sh
```

脚本会自动:
- [ ] 验证 Node.js 和 pm2
- [ ] 启动告警系统
- [ ] 配置定时服务器监控(可选)
- [ ] 设置开机自启(可选)

### 验证系统启动

```bash
# 查看进程
pm2 list | grep shenyuan-alerts
```

预期输出:
```
│ shenyuan-alerts │ node slack-alerts.js │ 1 │ online │ 0s │ 0% │ XX.X MB │
```

- [ ] 进程状态: online
- [ ] 内存占用 < 100MB
- [ ] CPU占用 < 5%

### 健康检查

```bash
# 方法1: curl
curl http://localhost:3007/health
# 预期: {"status": "healthy", "pid": xxxx}

# 方法2: 查看日志
pm2 logs shenyuan-alerts --lines 10
# 应看到: [START] 善缘告警系统启动
```

- [ ] 健康检查通过
- [ ] 日志中无错误信息

---

## 📊 第三步: 监控看板配置

### 部署看板

```bash
# 看板文件位置
ls -la monitoring-dashboard.html

# 本地测试(方式1: 直接打开)
open monitoring-dashboard.html

# 或使用HTTP服务(方式2: 测试刷新功能)
cd /Users/karen/projects/shenyuan
python3 -m http.server 8000
# 访问 http://localhost:8000/monitoring-dashboard.html
```

- [ ] 看板可在浏览器打开
- [ ] 能看到初始化状态

### 验证数据连接

打开浏览器,访问 `http://localhost:8000/monitoring-dashboard.html`

- [ ] 看板成功加载
- [ ] 能看到"系统正常"或"连接失败"状态
- [ ] 点击F12打开控制台,无红色错误信息

---

## 🧪 第四步: 发送测试告警

### 测试 1: 支付成功通知

```bash
curl -X POST http://localhost:3007/alert/payment \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "success",
    "amount": 99.9,
    "orderId": "test-payment-001",
    "userId": "test-user-001",
    "processingTime": 1200
  }'
```

预期:
- [ ] curl 返回: `{"success":true}`
- [ ] Slack #shenyuan-payments 收到消息
- [ ] 消息包含: 💳 支付事件通知 / 金额: ¥99.9

### 测试 2: 支付失败通知

```bash
curl -X POST http://localhost:3007/alert/payment \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "failure",
    "amount": 50.0,
    "orderId": "test-payment-002",
    "userId": "test-user-002",
    "error": "Card declined",
    "processingTime": 5200
  }'
```

预期:
- [ ] Slack #shenyuan-payments 收到消息
- [ ] 消息包含: ⚠️ 支付失败 / 错误信息: Card declined

### 测试 3: 邀请激活通知

```bash
curl -X POST http://localhost:3007/alert/invite \
  -H 'Content-Type: application/json' \
  -d '{
    "referrer": "test-referrer",
    "invitee": "test-invitee-001",
    "activated": true,
    "activatedAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "reward": 50
  }'
```

预期:
- [ ] Slack #shenyuan-invites 收到消息
- [ ] 消息包含: 🚀 邀请激活事件 / 报酬: ¥50

### 测试 4: 服务器指标告警

```bash
# 发送内存占用过高的测试
curl -X POST http://localhost:3007/alert/server \
  -H 'Content-Type: application/json' \
  -d '{
    "memory": 85,
    "disk": 80,
    "cpu": 45,
    "errors": 3,
    "requests": 150
  }'
```

预期:
- [ ] Slack #shenyuan-infra 收到内存告警消息
- [ ] 消息包含: 内存占用过高 / 85%

### 测试 5: 查询指标

```bash
curl http://localhost:3007/metrics | jq .
```

预期:
- [ ] 返回 JSON 格式的指标数据
- [ ] 包含 payment/invites/server/api 的统计数据
- [ ] 支付统计: success, failed, total, avgTime
- [ ] 邀请统计: sent, activated, total

- [ ] 所有4个测试告警已收到
- [ ] 指标端点返回正确数据

---

## 🔌 第五步: 后端集成

### 创建告警客户端工具类

在后端项目中创建: `backend/services/alert-system.js`

参考: [docs/MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md) § 工具类封装

- [ ] alert-system.js 已创建
- [ ] 包含 payment(), invite(), getMetrics() 方法
- [ ] 错误处理已实现(不阻塞主流程)

### 集成支付模块

在支付处理逻辑中添加:

```javascript
import { alertSystem } from './alert-system.js';

async function handlePaymentSuccess(order) {
  const result = await stripe.charges.create({...});
  
  // 发送告警
  alertSystem.payment({
    type: 'success',
    amount: order.amount,
    orderId: order.id,
    userId: order.userId,
    processingTime: Date.now() - startTime,
  }).catch(err => console.error('[ALERT] 发送失败:', err));
  
  return result;
}
```

- [ ] 支付成功处理已集成告警
- [ ] 支付失败处理已集成告警
- [ ] 支付异常捕获已集成告警

### 集成邀请模块

在邀请激活逻辑中添加:

```javascript
async function activateInviteCode(code, newUserId) {
  const invite = await Invite.findOne({ code });
  await invite.update({ activatedAt: new Date(), activatedUserId: newUserId });
  
  // 计算报酬
  const reward = calculateReward(invite.referrerId, newUserId);
  
  // 发送告警
  alertSystem.invite({
    referrer: invite.referrerId,
    invitee: newUserId,
    activated: true,
    activatedAt: invite.activatedAt.toISOString(),
    reward,
  }).catch(err => console.error('[ALERT] 发送失败:', err));
}
```

- [ ] 邀请发送已集成告警(可选)
- [ ] 邀请激活已集成告警
- [ ] 邀请异常已集成告警

### 集成服务器监控

在后端启动时添加定时任务:

```javascript
import cron from 'node-cron';

// 每5分钟报告一次
cron.schedule('*/5 * * * *', async () => {
  const metrics = await getServerMetrics();
  await alertSystem.serverMetrics(metrics);
});
```

- [ ] 服务器监控定时任务已添加
- [ ] 每5分钟自动上报一次

### 测试集成

```bash
# 在后端日志中验证:
# [ALERT] 告警已发送 / 支付成功 / orderId: xxx

# 在Slack中验证:
# 检查 #shenyuan-payments 是否收到真实订单通知
```

- [ ] 后端集成完成
- [ ] 实际支付可触发告警

---

## 📚 第六步: 文档配置

### 告警规则审阅

打开: `docs/alert-rules.md`

- [ ] 阅读 "核心告警规则" 章节
- [ ] 根据业务调整阈值 (如需要)
- [ ] 确认告警处理流程清晰
- [ ] 更新 "处理人" 字段(谁负责处理)

示例: 如果支付失败率阈值需要调整
```bash
# 编辑 alert-rules.md
支付失败率: 5% → 改为 3% (更敏感)

# 编辑 scripts/slack-alerts.js
CONFIG.thresholds.paymentError = 0.03

# 重启
pm2 restart shenyuan-alerts
```

- [ ] 告警阈值已根据业务调整
- [ ] 处理人已确认
- [ ] 文档已更新

### 团队培训

- [ ] 将文档分享给团队:
  - MONITORING-README.md (概览)
  - MONITORING-QUICK-REFERENCE.txt (快速参考)
  - docs/alert-rules.md (详细规则)

- [ ] 在 Slack 发布:
  ```
  👋 监控告警系统已部署!
  
  📊 看板: file:///.../monitoring-dashboard.html
  📖 文档: MONITORING-README.md
  ⚡ 快速参考: MONITORING-QUICK-REFERENCE.txt
  
  有问题? 👉 查看 #shenyuan-infra 置顶信息
  ```

- [ ] 团队成员已加入 Slack 频道:
  - [ ] #shenyuan-alerts
  - [ ] #shenyuan-payments (财务/CEO)
  - [ ] #shenyuan-invites (增长/运营)
  - [ ] #shenyuan-infra (DevOps/SRE)

- [ ] 团队已进行一次模拟告警处理演练

---

## 🔐 第七步: 安全加固

### 环境变量保护

- [ ] ~/.env.production 权限: `chmod 600 ~/.env.production`
- [ ] .gitignore 已包含:
  ```
  .env
  .env.production
  .env.local
  *.log
  ```

- [ ] Git 历史中无webhook URL:
  ```bash
  git log -S "hooks.slack.com" --all
  # 应无结果
  ```

### 网络隔离

在 Nginx 中限制 /alert/* 仅允许 localhost:

```nginx
location ~ ^/alert/ {
  allow 127.0.0.1;
  allow ::1;
  deny all;
}
```

- [ ] Nginx 配置已更新
- [ ] 重启 Nginx: `nginx -s reload`
- [ ] 验证: 外网无法访问 `http://server/alert/payment`

### 定期轮换

- [ ] Webhook URL 轮换计划已制定
  - 泄露时立即轮换
  - 定期轮换 (每季度)
  - 记录轮换日期

- [ ] 备份 Webhook URL 已保存到安全位置
  - [ ] 1Password/LastPass
  - [ ] 或 Karen 的本地密钥管理

---

## 📊 第八步: 监控看板验证

### 看板功能检查

打开 `monitoring-dashboard.html`,验证:

- [ ] 页面正常加载(无404/错误)
- [ ] 显示"系统正常"绿色指示器
- [ ] 所有KPI卡片正常显示:
  - [ ] 支付成功率
  - [ ] 邀请激活率
  - [ ] 服务器内存
  - [ ] 服务器磁盘
  - [ ] API错误率
  - [ ] 系统运行时间

- [ ] 详细统计表格显示数据

- [ ] 60秒后自动刷新

### 看板测试

```bash
# 1. 在另一个终端发送多个测试告警
for i in {1..5}; do
  curl -s -X POST http://localhost:3007/alert/payment \
    -H 'Content-Type: application/json' \
    -d '{"type":"success","amount":99.9,"orderId":"test-'$i'","userId":"user-'$i'","processingTime":'$((1000 + RANDOM % 2000))'}' &
done

# 2. 刷新看板(或等待60秒)
# 3. 验证指标已更新
```

- [ ] 支付成功率已更新
- [ ] 指标精度正确
- [ ] 没有NaN或错误值

---

## ✨ 第九步: 最终检查

### 系统运行检查

```bash
# 1. 所有进程
pm2 list
# 应看到: shenyuan-alerts | online

# 2. 最近日志
pm2 logs shenyuan-alerts --lines 20
# 应无 ERROR 信息

# 3. 内存占用
pm2 monit
# shenyuan-alerts 应 < 100MB

# 4. Slack 频道活跃度
# 检查各频道是否收到测试消息
```

- [ ] 告警系统运行正常
- [ ] 无内存泄漏迹象
- [ ] 日志无持续错误

### 文件完整性

```bash
cd /Users/karen/projects/shenyuan

# 检查核心文件
ls -l scripts/slack-alerts.js
ls -l monitoring-dashboard.html
ls -l docs/alert-rules.md
ls -l MONITORING-*.md
```

- [ ] 所有核心文件存在
- [ ] 文件权限正确
- [ ] 日志目录存在: `logs/`

### 备份和恢复

- [ ] 已备份 ~/.env.production
- [ ] 已记录所有 Webhook URL (安全保管)
- [ ] 恢复步骤已文档化 (在README中)

---

## 🚀 第十步: 上线

### 生产环境部署

```bash
# 1. 在HK服务器上部署
ssh root@47.242.80.65

# 2. 重复步骤 2-5 (部署+测试)
cd /path/to/shenyuan
bash scripts/monitoring-setup.sh

# 3. 验证连接
curl http://localhost:3007/health

# 4. 检查pm2
pm2 list

# 5. 设置开机自启
pm2 startup
pm2 save
```

- [ ] 生产环境告警系统已启动
- [ ] 能通过 localhost:3007 访问
- [ ] 所有4个Slack频道已连接
- [ ] 开机自启已配置

### 交接检查

- [ ] 所有相关人员已知晓系统部署
- [ ] 告警处理流程已培训
- [ ] 紧急联系方式已记录
- [ ] 文档已归档

**交接完成人**: _______________  
**交接完成时间**: _______________

---

## 📝 签字确认

本清单确认上述所有步骤已完成并通过验证。

| 角色 | 名字 | 签字 | 日期 |
|------|------|------|------|
| **部署** | _____ | ____ | ____ |
| **QA验证** | _____ | ____ | ____ |
| **产品确认** | _____ | ____ | ____ |
| **上线批准** | _____ | ____ | ____ |

---

## 🔔 后续计划

### 定期维护任务

- [ ] **每周** (周一 14:00 UTC): 审视告警频率
- [ ] **每月** (月末): 调整告警阈值 + 清理日志
- [ ] **每季度** (季度末): 完整系统审计 + 文档更新

### 优化方向

- [ ] [ ] 添加告警静音功能
- [ ] [ ] 集成 APM (DataDog/NewRelic)
- [ ] [ ] 支持钉钉/企业微信通知
- [ ] [ ] 实现自定义告警规则UI
- [ ] [ ] 添加告警历史回溯分析

---

**文档版本**: 1.0  
**最后更新**: 2026-08-08  
**维护者**: DevOps Team  
**下次审核**: 2026-09-08

---

**如有问题,请查阅:**
- 📖 完整说明: MONITORING-README.md
- ⚡ 快速参考: MONITORING-QUICK-REFERENCE.txt
- 📋 告警规则: docs/alert-rules.md
- 🔌 集成指南: docs/MONITORING-INTEGRATION-GUIDE.md
