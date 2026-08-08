# 📚 监控告警系统 - 文档索引

**版本**: 1.0 | **状态**: 生产就绪 | **最后更新**: 2026-08-08

快速导航所有监控系统文档和资源。

---

## 🚀 新手入门

### 第一次部署? 从这里开始

| 顺序 | 文档 | 说明 | 预计时间 |
|------|------|------|---------|
| 1️⃣ | [MONITORING-README.md](MONITORING-README.md) | 完整系统介绍,包括架构、功能、快速开始 | 10分钟 |
| 2️⃣ | [MONITORING-DEPLOYMENT-CHECKLIST.md](MONITORING-DEPLOYMENT-CHECKLIST.md) | 分步部署清单,含测试验证 | 30分钟 |
| 3️⃣ | [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) | 常用命令和故障排查速查表 | 5分钟 |

**部署只需三步:**
```bash
1. bash scripts/monitoring-setup.sh
2. open monitoring-dashboard.html
3. 查看 Slack 频道确认收到通知
```

---

## 📖 核心文档

### 系统管理员

| 文档 | 内容 | 用途 |
|------|------|------|
| **[MONITORING-README.md](MONITORING-README.md)** | 完整功能说明、架构图、常用命令 | 日常运维参考 |
| **[docs/alert-rules.md](docs/alert-rules.md)** | 详细告警规则、阈值、处理流程、SLA | 告警配置和维护 |
| **[MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt)** | 快速查询卡、常见问题、日常检查 | 日常速查手册 |
| **[MONITORING-DEPLOYMENT-CHECKLIST.md](MONITORING-DEPLOYMENT-CHECKLIST.md)** | 分步部署清单和验证步骤 | 初次部署和升级 |

### 后端开发

| 文档 | 内容 | 用途 |
|------|------|------|
| **[docs/MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md)** | 后端集成步骤、API调用示例、工具类设计 | 在后端服务中集成告警 |
| **[scripts/slack-alerts.js](scripts/slack-alerts.js)** | Node.js源代码,含详细注释 | 理解系统内部实现 |

### 产品和运营

| 文档 | 内容 | 用途 |
|------|------|------|
| **[MONITORING-README.md](MONITORING-README.md)** § 关键指标 | 支付/邀请/服务器/API指标解释 | 理解KPI含义 |
| **[docs/alert-rules.md](docs/alert-rules.md)** § 触发场景 | 各告警的原因和影响说明 | 理解业务影响 |
| **[monitoring-dashboard.html](monitoring-dashboard.html)** | 实时KPI看板 | 查看实时数据 |

---

## 🔧 系统文件

### 核心程序

| 文件 | 功能 | 说明 |
|------|------|------|
| **scripts/slack-alerts.js** | 告警系统核心 | Node.js服务,监听POST请求,触发Slack通知 |
| **monitoring-dashboard.html** | 实时看板 | 纯前端HTML,每60秒自刷新,显示关键指标 |
| **scripts/monitoring-setup.sh** | 部署脚本 | 一键配置和启动(自动化大部分步骤) |

### 配置和文档

| 文件 | 用途 |
|------|------|
| **scripts/slack-webhook-template.json** | Slack webhook配置模板和详解 |
| **docs/alert-rules.md** | 告警规则详细说明 |
| **docs/MONITORING-INTEGRATION-GUIDE.md** | 后端集成指南 |
| **logs/** | 日志目录(由pm2管理) |

---

## 🎯 常见任务

### "我需要..."

| 任务 | 查看文档 | 步骤概览 |
|------|---------|---------|
| 快速启动系统 | [MONITORING-DEPLOYMENT-CHECKLIST.md](MONITORING-DEPLOYMENT-CHECKLIST.md) § 第二步 | bash monitoring-setup.sh |
| 配置Slack webhook | [MONITORING-DEPLOYMENT-CHECKLIST.md](MONITORING-DEPLOYMENT-CHECKLIST.md) § 第一步 | 访问 api.slack.com 创建webhook |
| 查看实时数据 | [MONITORING-README.md](MONITORING-README.md) § 监控看板功能 | open monitoring-dashboard.html |
| 在后端集成告警 | [docs/MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md) | 复制示例代码到后端 |
| 调整告警阈值 | [docs/alert-rules.md](docs/alert-rules.md) § 告警阈值配置表 | 编辑rules.md和slack-alerts.js |
| 处理告警 | [docs/alert-rules.md](docs/alert-rules.md) § 关键告警响应SLA | 按SLA时间响应,在Slack回复 |
| 故障排查 | [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) § 常见问题排查 | 查表后按步骤排查 |
| 查看日志 | [MONITORING-README.md](MONITORING-README.md) § 常用命令 | pm2 logs shenyuan-alerts |
| 重启系统 | [MONITORING-README.md](MONITORING-README.md) § 常用命令 | pm2 restart shenyuan-alerts |
| 升级系统 | [MONITORING-DEPLOYMENT-CHECKLIST.md](MONITORING-DEPLOYMENT-CHECKLIST.md) | 重新运行deploy脚本 |

---

## 🔐 安全相关

### 必读

| 主题 | 文档位置 | 内容 |
|------|---------|------|
| Webhook安全 | MONITORING-README.md § 安全性 | 如何保护webhook URL |
| IP限制 | MONITORING-README.md § 安全性 | 配置nginx防护 |
| 环境变量 | docs/MONITORING-INTEGRATION-GUIDE.md § 错误处理 | 环境变量配置规范 |
| 定期轮换 | MONITORING-DEPLOYMENT-CHECKLIST.md § 第七步 | webhook URL轮换计划 |

---

## 📊 API 参考

### 系统端点

| 端点 | 方法 | 说明 | 使用场景 |
|------|------|------|---------|
| `/alert/payment` | POST | 支付事件通知 | 支付成功/失败时调用 |
| `/alert/invite` | POST | 邀请事件通知 | 用户激活邀请时调用 |
| `/alert/server` | POST | 服务器指标上报 | 定时任务上报系统健康 |
| `/metrics` | GET | 查询当前指标 | 看板数据刷新时调用 |
| `/health` | GET | 健康检查 | 监控系统本身是否正常 |

详细API说明见: [docs/MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md) § API 端点说明

---

## ⚠️ 告警类型速查

### 所有告警列表

| 告警ID | 级别 | 触发条件 | 通知频道 | 处理人 |
|--------|------|---------|---------|--------|
| `payment-error-rate` | 🟡 | 失败率 > 5% | #alerts | @engineer |
| `payment-delay` | 🟡 | 延迟 > 5秒 | #alerts | @engineer |
| `invite-dropoff` | 🟡 | 流失率 > 30% | #invites | @growth |
| `server-memory` | 🟡/🔴 | 占用 > 80% | #infra | @devops |
| `server-disk` | 🟡/🔴 | 占用 > 85% | #infra | @devops |
| `api-error-rate` | 🟡 | 错误率 > 2% | #alerts | @engineer |

完整列表和详解: [docs/alert-rules.md](docs/alert-rules.md) § 核心告警规则

---

## 🛠️ 维护计划

### 日常任务 (Daily)

- [ ] 08:00 UTC: 检查告警系统运行状态
  - 命令: `pm2 list | grep shenyuan-alerts`
  - 查看日志: `pm2 logs shenyuan-alerts --lines 50`

### 周任务 (Weekly)

- [ ] 周一 14:00 UTC: 告警审视
  - 文档: [docs/alert-rules.md](docs/alert-rules.md) § 定期审视计划
  - 检查内容: 告警频率、误报、遗漏

### 月任务 (Monthly)

- [ ] 月末: 调整告警阈值 + 清理日志
  - 文档: [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) § 日常维护
  - 更新: alert-rules.md

### 季度任务 (Quarterly)

- [ ] 季度末: 完整系统审计
  - 检查: 所有文件、权限、依赖
  - 更新: 所有文档

---

## 📞 获取帮助

### 按问题类型查找

| 问题 | 查看 |
|------|------|
| 系统启动失败 | [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) § 常见问题排查 → "系统不启动" |
| Slack收不到通知 | [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) § 常见问题排查 → "Slack收不到通知" |
| 指标不更新 | [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) § 常见问题排查 → "指标不更新" |
| 内存占用过高 | [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) § 常见问题排查 → "内存占用过高" |
| 想调整告警阈值 | [docs/alert-rules.md](docs/alert-rules.md) § 阈值调整流程 |
| 想添加新告警规则 | [docs/alert-rules.md](docs/alert-rules.md) § 核心告警规则 (参考格式) |
| 想集成到后端 | [docs/MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md) |
| 想理解系统架构 | [MONITORING-README.md](MONITORING-README.md) § 系统架构 |

### 联系方式

- **技术问题**: #shenyuan-infra on Slack
- **业务问题**: #shenyuan-alerts on Slack
- **紧急**: @on-call-engineer

---

## 📚 推荐阅读顺序

### 针对 DevOps / SRE

1. [MONITORING-README.md](MONITORING-README.md) - 了解全貌
2. [MONITORING-DEPLOYMENT-CHECKLIST.md](MONITORING-DEPLOYMENT-CHECKLIST.md) - 部署系统
3. [docs/alert-rules.md](docs/alert-rules.md) - 学习告警规则
4. [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) - 日常参考

### 针对后端工程师

1. [MONITORING-README.md](MONITORING-README.md) § 快速开始 - 了解概念
2. [docs/MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md) - 学习集成
3. [scripts/slack-alerts.js](scripts/slack-alerts.js) - 理解实现
4. [docs/alert-rules.md](docs/alert-rules.md) § 支付相关告警 - 学习业务逻辑

### 针对产品/运营

1. [MONITORING-README.md](MONITORING-README.md) § 关键指标 - 理解指标
2. [docs/alert-rules.md](docs/alert-rules.md) § 触发场景 - 了解告警原因
3. [monitoring-dashboard.html](monitoring-dashboard.html) - 查看实时数据

---

## 🔄 版本历史

| 版本 | 日期 | 改动 | 状态 |
|------|------|------|------|
| 1.0 | 2026-08-08 | 初始版本,支付/邀请/服务器监控 | ✅ 生产 |

---

## 📝 文档维护

- **所有者**: DevOps Team
- **最后更新**: 2026-08-08
- **下次审核**: 2026-09-08
- **更新流程**: 
  1. 在 Git 修改文档
  2. 提交 PR
  3. @cto 审核通过
  4. 合并并重新启动系统

---

## 🚀 快速链接

| 资源 | 链接 |
|------|------|
| Slack API Apps | https://api.slack.com/apps |
| 监控看板 | file:///Users/karen/projects/shenyuan/monitoring-dashboard.html |
| 部署脚本 | /Users/karen/projects/shenyuan/scripts/monitoring-setup.sh |
| HK服务器 | ssh root@47.242.80.65 |

---

**想快速开始? 👉 打开 [MONITORING-DEPLOYMENT-CHECKLIST.md](MONITORING-DEPLOYMENT-CHECKLIST.md)**

**遇到问题? 👉 查看 [MONITORING-QUICK-REFERENCE.txt](MONITORING-QUICK-REFERENCE.txt) 故障排查**

**需要集成? 👉 阅读 [docs/MONITORING-INTEGRATION-GUIDE.md](docs/MONITORING-INTEGRATION-GUIDE.md)**

