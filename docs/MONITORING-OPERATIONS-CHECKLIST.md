# 善缘监控与运维完整检查清单
> Monitoring & Operations Comprehensive Checklist

**版本**: 1.0  
**最后更新**: 2026-08-10  
**目的**: 确保所有监控和运维工具就位，系统可靠运行

---

## ✅ 监控系统完整性检查清单

### 1️⃣ 健康检查脚本 (Health Check)

#### 脚本位置验证
- [ ] `/Users/karen/projects/shenyuan/health-check.sh` 存在 (本地版本)
- [ ] `/Users/karen/projects/shenyuan/scripts/health-check.sh` 存在 (改进版本，带Slack集成)

#### 脚本功能验证
- [ ] PM2服务状态检查 (`pm2 status shenyuan | grep online`)
- [ ] API健康检查 (`curl -s http://localhost:3021/api/health`)
- [ ] 支付连接验证 (Stripe/Alipay)
- [ ] 数据文件检查 (`test -f /opt/shenyuan/data.json && [ -s ... ]`)
- [ ] 备份文件验证 (最少3个.bak文件)
- [ ] 磁盘空间检查 (`df` 使用率 < 80%)
- [ ] 错误日志扫描
- [ ] Webhook端点验证

#### 脚本执行测试
- [ ] 本地执行测试: `bash ./health-check.sh`
- [ ] 远程执行成功: `ssh root@47.242.80.65 'bash /opt/shenyuan/scripts/health-check.sh'`
- [ ] 输出包含所有检查项
- [ ] Slack通知已配置 (可选)

#### Cron定时配置
- [ ] 定时任务已配置 (每日早8:00)
- [ ] 日志输出位置 (`~/.pm2/logs/` 或指定位置)
- [ ] 定时任务正常运行: `crontab -l | grep health-check`

---

### 2️⃣ 监控告警系统 (Alert System)

#### 告警系统启动验证
- [ ] Slack webhook已配置到环境变量: `echo $SLACK_WEBHOOK_ALERTS`
- [ ] 告警系统PM2进程运行: `pm2 status shenyuan-alerts | grep online`
- [ ] 告警系统监听端口 (3007): `curl -s http://localhost:3007/health`
- [ ] 告警系统日志无错误: `pm2 logs shenyuan-alerts --lines 20`

#### Slack webhook配置
- [ ] `SLACK_WEBHOOK_ALERTS` - 主告警频道
- [ ] `SLACK_WEBHOOK_PAYMENT` - 支付通知频道
- [ ] `SLACK_WEBHOOK_INVITES` - 邀请通知频道
- [ ] `SLACK_WEBHOOK_INFRA` - 基础设施告警频道

#### 告警规则验证
- [ ] `/Users/karen/projects/shenyuan/scripts/slack-alerts-config.json` 存在
- [ ] 包含支付失败告警 (阈值 > 5%)
- [ ] 包含服务离线告警 (PM2状态)
- [ ] 包含错误率告警 (> 2%)
- [ ] 包含磁盘满告警 (> 85%)
- [ ] 包含邀请系统告警
- [ ] 告警去重配置 (防止重复告警)
- [ ] 安静时间配置 (22:00-08:00)

#### 测试告警端点
- [ ] `POST /alert/payment` 端点工作: 
  ```bash
  curl -X POST http://localhost:3007/alert/payment \
    -H "Content-Type: application/json" \
    -d '{"type":"success","amount":99.9,"orderId":"test-001"}'
  ```
- [ ] `POST /alert/invite` 端点工作
- [ ] `POST /alert/server` 端点工作
- [ ] `GET /metrics` 端点返回指标
- [ ] `GET /health` 端点返回健康状态

#### Slack通知验证
- [ ] 在Slack收到测试支付通知
- [ ] 在Slack收到测试邀请通知
- [ ] 在Slack收到测试基础设施告警
- [ ] 通知包含时间戳
- [ ] 通知包含具体数值/错误信息

---

### 3️⃣ 数据备份系统 (Backup Strategy)

#### 备份脚本配置
- [ ] `/opt/shenyuan/scripts/backup-data.sh` 存在
- [ ] 备份脚本可执行: `ls -la | grep backup-data.sh`
- [ ] 脚本包含源文件检查
- [ ] 脚本包含错误处理
- [ ] 脚本包含旧备份清理逻辑 (7天保留策略)

#### 备份文件验证
- [ ] 备份文件位置: `/opt/shenyuan/data.json.bak-*`
- [ ] 备份文件数量 >= 3个
- [ ] 备份文件大小合理 (1-20 MB)
- [ ] 最新备份时间 < 6小时前
- [ ] 备份文件JSON格式有效: `jq . data.json.bak-* > /dev/null`
- [ ] 备份文件包含用户数据
- [ ] 备份文件包含订阅信息

#### 备份自动化配置
- [ ] Cron任务已配置: `crontab -l | grep backup`
- [ ] 执行频率: 每6小时 (0, 6, 12, 18点)
- [ ] 或使用PM2定时任务配置

#### 备份监控
- [ ] 备份日志可访问: `tail -f /opt/shenyuan/logs/backup.log`
- [ ] 日志包含备份时间、大小、状态
- [ ] 失败备份有错误记录
- [ ] 告警系统监控备份状态

---

### 4️⃣ 恢复能力验证 (Recovery Capability)

#### 恢复脚本准备
- [ ] 恢复脚本已编写或有操作指南
- [ ] 恢复流程文档完整: `docs/BACKUP-RECOVERY-SOP.md`
- [ ] 包含全量恢复步骤
- [ ] 包含部分恢复步骤
- [ ] 包含恢复验证检查清单

#### 恢复演练
- [ ] 进行过恢复测试 (在测试环境或备用数据)
- [ ] 已验证恢复耗时 (< 10分钟)
- [ ] 已验证恢复后数据完整性
- [ ] 已验证恢复后服务正常运行
- [ ] 恢复演练结果已文档化

#### 数据冗余性
- [ ] 是否配置了云备份 (AWS S3/Aliyun OSS)?
  - [ ] 是: 配置在 `docs/BACKUP-RECOVERY-SOP.md` 附录
  - [ ] 否: 记录为待办项
- [ ] 是否配置了数据库备份?
  - [ ] 是: 数据库备份独立于文件备份
  - [ ] 否: 确认应用数据完全存储在 data.json 中

---

### 5️⃣ 部署验证脚本 (Deployment Verification)

#### 脚本位置
- [ ] `/Users/karen/projects/shenyuan/scripts/verify-deploy.sh` 存在
- [ ] 脚本可执行: `chmod +x verify-deploy.sh`

#### 脚本包含检查项
- [ ] SSH连接性验证
- [ ] PM2服务状态检查
- [ ] API健康检查 (HTTP状态码)
- [ ] 数据文件验证
- [ ] 备份文件验证
- [ ] 磁盘空间检查
- [ ] 错误日志扫描
- [ ] Stripe/支付连接验证
- [ ] Webhook端点验证
- [ ] 系统资源监控 (内存/CPU)
- [ ] 安全性基础检查
- [ ] 最终验证报告

#### 脚本执行测试
- [ ] 本地执行无错误: `bash verify-deploy.sh`
- [ ] 所有检查项通过 (✅ > 10个)
- [ ] 失败项 = 0
- [ ] 警告项在可接受范围内
- [ ] 输出包含快速修复建议

---

### 6️⃣ 日志管理系统 (Log Management)

#### 日志位置配置
- [ ] PM2日志: `~/.pm2/logs/shenyuan*.log`
- [ ] 应用日志: `/opt/shenyuan/logs/`
- [ ] 备份日志: `/opt/shenyuan/logs/backup.log`
- [ ] 告警日志: `/opt/shenyuan/logs/alerts*.log`
- [ ] 错误日志: `/opt/shenyuan/logs/errors.log`

#### 日志轮转配置
- [ ] PM2 logrotate已配置 (防止磁盘爆满)
- [ ] 日志文件大小限制 (单个 < 100MB)
- [ ] 日志保留期 (7-30天)
- [ ] 日志压缩配置 (可选)

#### 日志查询能力
- [ ] 可查看最近日志: `pm2 logs shenyuan --lines 100`
- [ ] 可按错误类型筛选: `pm2 logs | grep ERROR`
- [ ] 可查看特定时间段日志
- [ ] 可导出日志供分析

#### 错误追踪集成
- [ ] Sentry/错误追踪系统是否已集成?
  - [ ] 是: 验证错误上报链路正常
  - [ ] 否: 记录为待办项

---

### 7️⃣ 监控仪表板 (Monitoring Dashboard)

#### 仪表板文件
- [ ] `health-check-dashboard.html` 存在
- [ ] `monitoring-dashboard.html` 存在
- [ ] 仪表板可在浏览器打开

#### 仪表板功能
- [ ] 实时显示服务状态
- [ ] 显示支付成功率
- [ ] 显示API错误率
- [ ] 显示服务器资源使用 (内存/磁盘)
- [ ] 显示邀请系统指标
- [ ] 自动刷新 (间隔可配)

#### 仪表板访问
- [ ] 本地访问: `file:///Users/karen/projects/shenyuan/monitoring-dashboard.html`
- [ ] HTTP访问: 如已部署,验证可通过HTTP访问
- [ ] 实时数据更新正常

---

### 8️⃣ 指标收集与存储 (Metrics Collection)

#### 支付指标
- [ ] 支付成功率: 应 > 95%
- [ ] 支付失败次数: 每日监控
- [ ] 平均处理时间: 应 < 5秒
- [ ] 异常支付告警: 已配置

#### 业务指标
- [ ] 日活用户数 (DAU): 每日统计
- [ ] 转化率: 实时监控
- [ ] 邀请激活率: > 70%
- [ ] 订阅转化: 按周统计

#### 基础设施指标
- [ ] CPU使用率: < 50%正常
- [ ] 内存使用率: < 80%正常
- [ ] 磁盘使用率: < 85%正常
- [ ] 网络I/O: 正常范围
- [ ] API响应时间: < 2秒

#### 指标存储
- [ ] 指标数据格式 (JSON/时间序列)
- [ ] 指标存储位置 (`/opt/shenyuan/metrics/`)
- [ ] 指标保留策略 (30天)
- [ ] 指标查询接口: `GET /metrics`

---

### 9️⃣ 告警配置完整性

#### 关键告警规则
- [ ] PM2服务离线 (严重) → 立即通知
- [ ] API错误率 > 5% (严重) → 立即通知
- [ ] 支付失败 > 3次/小时 (严重) → 立即通知
- [ ] 磁盘使用 > 85% (警告) → 定时通知
- [ ] 内存使用 > 80% (警告) → 定时通知
- [ ] 邀请激活率 < 30% (警告) → 每天报告

#### 告警去重
- [ ] 同类告警 > 300秒才重新发送
- [ ] 严重告警 > 60秒才重新发送
- [ ] 安静时间 22:00-08:00 (仅关键告警)

#### 告警响应机制
- [ ] 有明确的告警处理人
- [ ] 告警处理流程已文档化
- [ ] 告警应答时间: < 15分钟
- [ ] 告警升级机制: 无人应答->通知主管

---

### 🔟 操作手册完整性

#### 文档清单
- [ ] README: 系统总体介绍
- [ ] MONITORING-INTEGRATION-GUIDE.md: 后端集成指南
- [ ] BACKUP-RECOVERY-SOP.md: 备份恢复操作程序
- [ ] MONITORING-OPERATIONS-CHECKLIST.md: 本清单
- [ ] 故障排查指南: 常见问题解决方案
- [ ] 部署清单: 上线前检查项

#### 文档内容
- [ ] 每个脚本都有使用说明
- [ ] 每个操作都有步骤说明
- [ ] 包含常见问题Q&A
- [ ] 包含紧急处理流程
- [ ] 包含联系人信息

#### 文档维护
- [ ] 文档更新频率 (每月审查)
- [ ] 版本控制: Git追踪
- [ ] 最后修改时间戳
- [ ] 维护者信息

---

## 🔧 工具与环境验证

### Node.js与NPM环境
- [ ] Node.js版本: `node -v` (推荐 v18+)
- [ ] npm版本: `npm -v` (推荐 v9+)
- [ ] PM2全局安装: `pm2 -v`
- [ ] 必要依赖: `npm list` (在项目目录)

### 远程连接工具
- [ ] SSH密钥配置: `ls ~/.ssh/id_rsa`
- [ ] SSH连接测试: `ssh -o ConnectTimeout=5 root@47.242.80.65 'echo OK'`
- [ ] SCP文件传输测试
- [ ] SSH无密码登录已配置 (可选,方便自动化)

### 系统依赖
- [ ] curl: `which curl`
- [ ] jq (JSON解析): `which jq`
- [ ] grep, awk, sed等标准工具

---

## 📊 定期维护任务

### 每日任务 (Daily)
- [ ] 查看每日健康检查结果
- [ ] 确认没有critical告警
- [ ] 检查支付成功率
- [ ] 验证邀请系统运作正常

### 每周任务 (Weekly)
- [ ] 审查本周错误日志 (是否有新错误模式)
- [ ] 检查数据备份成功率 (应 100%)
- [ ] 审查告警历史 (是否有频繁误告警)
- [ ] 更新监控仪表板
- [ ] 性能基准测试 (可选)

### 每月任务 (Monthly)
- [ ] 恢复演练 (在测试环境验证恢复流程)
- [ ] 审查监控规则,是否需要调整阈值
- [ ] 清理过期日志和数据
- [ ] 安全审计 (访问权限、密钥轮换)
- [ ] 文档更新和归档
- [ ] 团队培训: 讲解新告警规则或工具

### 季度任务 (Quarterly)
- [ ] 容量规划 (磁盘、内存、CPU是否需要扩容)
- [ ] 灾备演练 (完整的服务恢复模拟)
- [ ] 架构审查 (监控系统本身是否需要优化)
- [ ] 业务指标分析 (付费率、留存率等)

---

## 🚨 紧急操作速查表

### 服务宕机
```bash
# 1. 检查状态
ssh root@47.242.80.65 'pm2 status shenyuan'

# 2. 查看日志
ssh root@47.242.80.65 'pm2 logs shenyuan --lines 50'

# 3. 重启服务
ssh root@47.242.80.65 'pm2 restart shenyuan'

# 4. 如重启无效,强制停止后重启
ssh root@47.242.80.65 'pm2 kill && pm2 start /opt/shenyuan/server/index.js'

# 5. 验证恢复
curl http://47.242.80.65:3021/api/health
```

### 支付系统故障
```bash
# 1. 检查Stripe连接
curl http://47.242.80.65:3021/api/stripe/health

# 2. 检查告警系统
curl http://47.242.80.65:3007/health

# 3. 查看支付错误日志
ssh root@47.242.80.65 'grep -i "stripe\|payment" /var/log/shenyuan/*.log | tail -20'

# 4. 临时禁用支付(如已配置)
ssh root@47.242.80.65 'touch /opt/shenyuan/DISABLE_PAYMENTS'

# 5. 恢复支付
ssh root@47.242.80.65 'rm /opt/shenyuan/DISABLE_PAYMENTS'
```

### 磁盘满
```bash
# 1. 检查磁盘使用
ssh root@47.242.80.65 'df -h /opt/shenyuan'

# 2. 查看大文件
ssh root@47.242.80.65 'du -sh /opt/shenyuan/* | sort -h | tail -10'

# 3. 清理日志
ssh root@47.242.80.65 'rm -f ~/.pm2/logs/*.log'

# 4. 清理旧备份
ssh root@47.242.80.65 'find /opt/shenyuan -name "*.bak-*" -mtime +14 -delete'

# 5. 验证清理结果
ssh root@47.242.80.65 'df -h /opt/shenyuan'
```

### 数据损坏
```bash
# 1. 验证当前数据
ssh root@47.242.80.65 'cat /opt/shenyuan/data.json | jq . > /dev/null && echo OK || echo CORRUPTED'

# 2. 如损坏,列出可用备份
ssh root@47.242.80.65 'ls -lrt /opt/shenyuan/data.json.bak-* | tail -5'

# 3. 恢复 (参考 BACKUP-RECOVERY-SOP.md)
ssh root@47.242.80.65 'cp /opt/shenyuan/data.json.bak-20260810-000000 /opt/shenyuan/data.json && pm2 restart shenyuan'

# 4. 验证恢复
curl http://47.242.80.65:3021/api/health
```

---

## ✨ 最终检查清单

在声称"监控系统就位"前,确保✅所有项:

### 系统可靠性 (System Reliability)
- [ ] 正常运行时间 > 99.5%
- [ ] 平均故障恢复时间 < 10分钟
- [ ] 备份/恢复能力已验证
- [ ] 灾备方案已制定

### 可观测性 (Observability)
- [ ] 所有关键组件有健康检查
- [ ] 支付/邀请事件实时监控
- [ ] 系统资源使用可视化
- [ ] 错误和异常可追踪

### 告警与响应 (Alerting & Response)
- [ ] 关键告警已配置
- [ ] Slack通知已测试
- [ ] 告警响应流程已定义
- [ ] 团队已培训

### 文档与流程 (Documentation & Procedures)
- [ ] 所有操作程序已文档化
- [ ] 紧急处理指南已准备
- [ ] 故障排查指南已准备
- [ ] 定期维护计划已制定

### 自动化 (Automation)
- [ ] 备份已自动化
- [ ] 监控收集已自动化
- [ ] 告警通知已自动化
- [ ] 日志轮转已自动化

---

## 📞 联系信息与升级路径

### 关键联系人
- **产品负责人**: Karen
- **技术主管**: [待补充]
- **DevOps**: [待补充]
- **支持团队**: [待补充]

### 告警升级路径
```
1级告警 (INFO) → Slack通知 (#shenyuan-alerts)
2级告警 (WARN) → Slack + 邮件通知
3级告警 (CRITICAL) → Slack + 邮件 + 短信/电话通知
                     + 自动尝试修复 (如可行)
```

### 故障应急流程
1. **检测** (0-5分钟): 告警系统发现异常
2. **告知** (5-10分钟): Slack通知相关人员
3. **应答** (10-15分钟): 值班人员确认并采取行动
4. **修复** (15-45分钟): 根据故障类型,执行相应修复
5. **验证** (45-60分钟): 确认服务恢复正常
6. **总结** (24小时内): 分析根本原因并防止复发

---

## 🎯 下一步行动项

基于此检查清单,以下是建议的优先级:

### P0 (立即完成)
- [ ] 健康检查脚本完整运行
- [ ] Slack告警已测试
- [ ] 备份脚本每6小时自动执行
- [ ] 部署验证脚本运行通过

### P1 (本周完成)
- [ ] BACKUP-RECOVERY-SOP.md 完成并团队审查
- [ ] 恢复演练进行一次
- [ ] 定期监控任务已配置

### P2 (本月完成)
- [ ] 监控仪表板部署
- [ ] 告警规则根据实际数据调整
- [ ] 团队培训进行

### P3 (长期)
- [ ] 云备份集成
- [ ] 数据库备份配置
- [ ] 增量备份优化
- [ ] 容量规划与自动扩展

---

**检查清单最后审核**: 2026-08-10  
**下次审核时间**: 2026-09-10  
**维护者**: DevOps Team / Karen
