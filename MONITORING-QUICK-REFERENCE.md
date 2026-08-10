# 🚀 善缘监控系统 - 快速参考指南
> Quick Reference for Monitoring & Operations

**打印这个文件放在办公室!**

---

## ⚡ 秒速启动

### 我想...

#### 🔍 检查服务是否正常运行
```bash
bash /opt/shenyuan/scripts/health-check.sh
# 或本地执行
bash /Users/karen/projects/shenyuan/scripts/health-check.sh
```
**预期**: 所有检查通过 (绿色✅)

---

#### 🔧 验证部署是否就绪
```bash
bash /opt/shenyuan/scripts/verify-deploy.sh
# 需要远程SSH: 
ssh root@47.242.80.65 'bash /opt/shenyuan/scripts/verify-deploy.sh'
```
**预期**: 12项检查全部通过

---

#### 📊 查看实时监控数据
```bash
# 本地打开
open /Users/karen/projects/shenyuan/monitoring-dashboard.html

# 或访问服务器版本
curl http://47.242.80.65:3007/metrics | jq .
```

---

#### 📤 手动发送测试告警
```bash
# 测试支付告警
curl -X POST http://localhost:3007/alert/payment \
  -H "Content-Type: application/json" \
  -d '{"type":"success","amount":99.9,"orderId":"test-001","userId":"test-user"}'

# 测试邀请告警
curl -X POST http://localhost:3007/alert/invite \
  -H "Content-Type: application/json" \
  -d '{"referrer":"user1","invitee":"user2","activated":true}'
```
**验证**: Slack #shenyuan-alerts 应收到通知

---

#### 💾 手动备份数据
```bash
# SSH到服务器
ssh root@47.242.80.65

# 执行备份
cp /opt/shenyuan/data.json /opt/shenyuan/data.json.bak-$(date +%Y%m%d-%H%M%S)

# 验证备份
ls -lh /opt/shenyuan/data.json.bak-* | tail -3
```

---

#### 🔄 从备份恢复数据
```bash
# 1. 停止服务 (可选但推荐)
ssh root@47.242.80.65 'pm2 stop shenyuan'

# 2. 备份当前数据 (以防万一)
ssh root@47.242.80.65 'cp /opt/shenyuan/data.json /opt/shenyuan/data.json.corrupted-$(date +%s)'

# 3. 选择备份文件 (例如今天14:00的)
ssh root@47.242.80.65 'cp /opt/shenyuan/data.json.bak-20260810-140000 /opt/shenyuan/data.json'

# 4. 重启服务
ssh root@47.242.80.65 'pm2 restart shenyuan'

# 5. 验证
curl http://47.242.80.65:3021/api/health | jq .
```

---

#### 🚨 服务宕机急救
```bash
# 1. 检查发生了什么
ssh root@47.242.80.65 'pm2 logs shenyuan --lines 50'

# 2. 尝试重启
ssh root@47.242.80.65 'pm2 restart shenyuan'

# 3. 等5秒再检查
sleep 5
curl http://47.242.80.65:3021/api/health

# 4. 如果还是坏,恢复昨天的备份
ssh root@47.242.80.65 'cp /opt/shenyuan/data.json.bak-20260809-000000 /opt/shenyuan/data.json && pm2 restart shenyuan'
```

---

#### 🔓 查看最近的错误日志
```bash
# 最后20条错误
ssh root@47.242.80.65 'pm2 logs shenyuan | grep -i error | tail -20'

# 或查看支付相关错误
ssh root@47.242.80.65 'grep -i "stripe\|payment" /var/log/shenyuan/*.log 2>/dev/null | tail -20'
```

---

## 📚 关键文件位置

### 本地 (你的电脑)
```
/Users/karen/projects/shenyuan/
├── health-check.sh                    ← 基础健康检查
├── monitoring-dashboard.html          ← 监控仪表板
├── scripts/
│   ├── health-check.sh               ← 详细健康检查
│   ├── verify-deploy.sh              ← 部署验证 ⭐ 新增
│   ├── slack-alerts.js               ← 告警系统
│   ├── slack-alerts-config.json      ← 告警规则
│   └── monitoring-setup.sh           ← 一键部署
└── docs/
    ├── BACKUP-RECOVERY-SOP.md        ← 备份恢复指南 ⭐ 新增
    ├── MONITORING-OPERATIONS-CHECKLIST.md  ← 运维清单 ⭐ 新增
    └── VERIFICATION-SUMMARY-0810.md  ← 验证报告 ⭐ 新增
```

### 服务器 (47.242.80.65)
```
/opt/shenyuan/
├── data.json                         ← 当前数据文件
├── data.json.bak-*                   ← 备份文件 (最新7个)
├── scripts/
│   ├── health-check.sh
│   ├── verify-deploy.sh
│   └── backup-data.sh               ← 备份脚本
├── server/
│   └── index.js                     ← 主应用
└── logs/
    ├── backup.log                    ← 备份日志
    ├── health-check.log              ← 健康检查日志
    └── ...
```

---

## 🎯 日常运维时间表

### 📅 每天 8:00
```bash
# 查看健康检查结果
tail -f /opt/shenyuan/logs/health-check.log

# 或本地执行
bash /Users/karen/projects/shenyuan/scripts/health-check.sh
```

### 📅 每周一 9:00
```bash
# 审查本周告警
ssh root@47.242.80.65 'pm2 logs shenyuan-alerts | grep alert | tail -50'

# 检查备份成功率
ssh root@47.242.80.65 'ls -lrt /opt/shenyuan/data.json.bak-* | tail -10'
```

### 📅 每月初 (1号)
```bash
# 运行部署验证
bash /opt/shenyuan/scripts/verify-deploy.sh

# 做一次小型恢复演练 (测试环境)
# - 下载一个备份文件到本地
# - 验证JSON有效性
# - 检查数据完整性

# 清理旧备份 (保留30天)
ssh root@47.242.80.65 'find /opt/shenyuan -name "data.json.bak-*" -mtime +30 -delete'
```

---

## 🚨 故障排查树

```
发现问题
│
├─ 服务在线吗?
│  ├─ NO  → pm2 restart shenyuan
│  └─ YES → 继续
│
├─ API响应吗?
│  ├─ NO  → 查看日志 (pm2 logs)
│  └─ YES → 继续
│
├─ 数据正常吗?
│  ├─ NO  → 恢复备份 (参考 BACKUP-RECOVERY-SOP.md)
│  └─ YES → 继续
│
├─ 支付工作吗?
│  ├─ NO  → 检查Stripe连接
│  └─ YES → 系统正常!
```

---

## 📞 快速电话簿

### 紧急情况
- 服务宕机: SSH登录 + 重启
- 数据损坏: 恢复最新备份
- 磁盘满: 清理日志/旧备份
- Slack故障: 检查webhook URL

### 关键链接
- 后端API: `http://47.242.80.65:3021/`
- 健康检查: `http://47.242.80.65:3021/api/health`
- 告警系统: `http://47.242.80.65:3007/health`
- Slack Webhook: (需Karen提供)

### 文档链接
- 备份恢复: `/docs/BACKUP-RECOVERY-SOP.md`
- 运维检查: `/docs/MONITORING-OPERATIONS-CHECKLIST.md`
- 监控集成: `/docs/MONITORING-INTEGRATION-GUIDE.md`

---

## ✅ 工作清单

### 上班第一件事
- [ ] 检查Slack是否有告警
- [ ] 运行 `health-check.sh` 验证服务
- [ ] 查看监控仪表板

### 发现问题时
- [ ] 立即记录问题时间和现象
- [ ] 查看日志找根因
- [ ] 参考故障排查树修复
- [ ] 修复后验证服务恢复

### 每周五下班前
- [ ] 检查周内有无重大告警
- [ ] 确认备份成功 (7个以上)
- [ ] 验证没有频繁错误日志

---

## 🔐 重要提醒

### 不要做
❌ 不要直接修改 data.json (会破坏数据)  
❌ 不要删除 data.json.bak-* 备份文件  
❌ 不要关闭 PM2 进程  
❌ 不要忽视磁盘满告警  

### 一定要做
✅ 始终备份后再操作  
✅ 操作前检查数据有效性  
✅ 定期检查备份文件大小  
✅ 出问题时联系技术团队  
✅ 文档记录每次操作  

---

## 🌟 性能基准

| 指标 | 正常范围 | 警告范围 | 严重范围 |
|-----|---------|---------|---------|
| API响应 | < 1s | 1-3s | > 3s |
| 支付成功率 | > 95% | 90-95% | < 90% |
| CPU使用率 | < 30% | 30-60% | > 60% |
| 内存使用率 | < 60% | 60-80% | > 80% |
| 磁盘使用率 | < 70% | 70-85% | > 85% |
| 错误率 | < 0.5% | 0.5-2% | > 2% |

---

## 📝 本周关键任务

- [ ] 配置Slack webhook (Karen操作)
- [ ] 第一次运行 verify-deploy.sh
- [ ] 进行恢复演练 (测试环境)
- [ ] 调整告警规则阈值
- [ ] 团队培训

---

**打印并贴在办公室!** 📌  
**最后更新**: 2026-08-10  
**维护者**: DevOps Team  
**有问题?** 查看详细文档或联系Karen
