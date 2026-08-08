# 善缘 应急响应 SOP - 快速查询版

**最后更新**: 2026-08-08 | **版本**: v1.0

---

## 5大风险速查表（谁处理/怎么处理/预计时间）

### 1️⃣ 支付失败 (P1) — Payment Eng 负责

**症状**:
- 用户充值后余额未增加
- Webhook 返回错误
- 支付端点返回 5xx/404
- 订单状态不更新

**处理流程**:
```
发现 (0 min)
  ↓ 通知 Payment Eng (即时 Slack)
  ↓ 检查支付服务是否启动 (2 min) — bash QUICK-FIX-COMMANDS.sh 1
  ↓ 检查密钥配置是否正确 (3 min) — bash QUICK-FIX-COMMANDS.sh 2
  ↓ 检查微信/支付宝回调 (5 min) — bash QUICK-FIX-COMMANDS.sh 3
  ↓ 测试端到端支付流程 (5 min)
  ↓ 补偿失败订单 (10 min) — bash QUICK-FIX-COMMANDS.sh 4
恢复完成 (15 min 预期)
```

**关键命令**:
```bash
# 快速检查
ssh root@47.242.80.65
pm2 status | grep payment
curl -X POST http://47.242.80.65/api/health

# 查看支付日志
tail -f /opt/shenyuan/server/logs/payment.log

# 重启支付服务
pm2 restart shenyuan-payment
```

**恢复验证**:
- [ ] 支付端点返回 200
- [ ] 新订单可正常提交
- [ ] Webhook 被正确触发
- [ ] 用户余额正确更新

**需通知**:
- CFO (金钱相关，需确认损失)
- CMO (若影响用户体验)

---

### 2️⃣ 服务宕机 (P0) — DevOps Lead 负责

**症状**:
- 网站返回 502/503
- PM2 显示服务 stopped
- CPU 占用 100%
- 内存 OOM (Out of Memory)

**处理流程**:
```
发现 (0 min) ⚠️ 立即行动，无延迟
  ↓ 检查服务状态 (1 min) — pm2 status
  ↓ 自动恢复开始 (2 min) — PM2 + systemd 应自动重启
  ↓ 若仍未恢复，手工重启 (3 min) — bash QUICK-FIX-COMMANDS.sh 6
  ↓ 检查磁盘/内存 (2 min) — bash QUICK-FIX-COMMANDS.sh 7
  ↓ 启用限流保护 (2 min) — bash QUICK-FIX-COMMANDS.sh 10
  ↓ 验证恢复 (2 min) — curl + PostHog 检查
恢复完成 (10 min 预期)
```

**关键命令**:
```bash
# 快速检查与恢复
ssh root@47.242.80.65
pm2 status
pm2 logs shenyuan-api --lines 50

# 如服务未启动
pm2 start /opt/shenyuan/ecosystem.config.js --only shenyuan-api
pm2 save

# 检查资源占用
free -h  # 内存
df -h    # 磁盘
top -b -n1 | head -20  # CPU
```

**恢复验证**:
- [ ] `pm2 status` 显示 online
- [ ] `curl http://47.242.80.65/api/health` 返回 200
- [ ] 网站可正常访问
- [ ] PostHog 显示 QPS 恢复正常 (<100)

**需通知**:
- CMO (服务不可用)
- 可选: 在 Slack 发通知 "服务已恢复"

**自动恢复机制**:
- PM2 配置了 `autorestart: true` + `max_memory_restart`
- systemd 监听 PM2 进程，自动拉起
- 无需手工干预的情况占 95%

---

### 3️⃣ 邀请链接失效 (P2) — Backend Eng 负责

**症状**:
- 邀请码返回 404
- 配对建立失败
- 链接看起来正常但点不开
- 前端报错 "invalid token"

**处理流程**:
```
发现 (0 min)
  ↓ 通知 Backend Eng (Slack)
  ↓ 检查数据库连接 (3 min) — bash QUICK-FIX-COMMANDS.sh 12
  ↓ 重新生成邀请码 (5 min) — bash QUICK-FIX-COMMANDS.sh 13
  ↓ 清理过期邀请 (5 min) — bash QUICK-FIX-COMMANDS.sh 13
  ↓ 测试新邀请链接 (5 min)
  ↓ 若用户影响，补偿其他功能配额 (10 min)
恢复完成 (30 min 预期)
```

**关键命令**:
```bash
ssh root@47.242.80.65

# 检查邀请表
sqlite3 /opt/shenyuan/server/data.db "SELECT COUNT(*) FROM invites"

# 重新生成邀请码
node -e "
const db = require('/opt/shenyuan/server/lib/db');
const code = db.generateInviteCode();
console.log('New invite code:', code);
"

# 测试邀请链接
curl "http://47.242.80.65/api/invite/validate?code=XYZ123"
```

**恢复验证**:
- [ ] 新邀请码可通过验证
- [ ] 配对建立成功
- [ ] 前端收到正确的配对信息

**需通知**:
- 可选: 受影响用户补偿

---

### 4️⃣ 数据泄露 (P0) ⚠️ 最严重 — DevOps Lead + CFO + 法务

**症状**:
- `.env` 或密钥文件在公网可见
- 敏感数据在 GitHub 被搜到
- 用户邮箱/电话在某论坛泄露
- 黑客在 Slack 或邮件要挟

**处理流程**:
```
发现 (0 min) ⚠️ P0 最高级别，立即升级
  ↓ 通知 Karen (电话) + CFO + 法务 (2 min)
  ↓ 隔离服务器防泄露扩大 (5 min) — bash QUICK-FIX-COMMANDS.sh (手工)
  ↓ 保存审计日志 (5 min)
  ↓ 确定泄露范围 (10 min)
  ↓ 重置所有密钥 (15 min) — bash QUICK-FIX-COMMANDS.sh (手工)
  ↓ 恢复干净备份 (10 min)
  ↓ 通知监管部门/用户 (外包给法务，1-2h)
恢复完成 (24h 预期，其中技术部分 30 min)
```

**关键命令**:
```bash
# ⚠️ 仅在完全确认泄露时执行

ssh root@47.242.80.65

# 第1步：隔离服务器
sudo iptables -A OUTPUT -j DROP  # 断出站连接

# 第2步：保存审计日志
mkdir -p /tmp/incident_$(date +%s)
pm2 logs shenyuan-api --lines 10000 > /tmp/incident_*/api.log
git -C /opt/shenyuan log --all --oneline > /tmp/incident_*/git.log
grep -r "WECHAT_\|ALIPAY_\|JWT_" /opt/shenyuan/.env >> /tmp/incident_*/keys.log
tar czf /tmp/incident.tar.gz /tmp/incident_*

# 第3步：重置密钥 (手工修改，不自动化)
nano /opt/shenyuan/server/.env
# 修改: WECHAT_API_KEY, ALIPAY_PRIVATE_KEY, JWT_SECRET, DB_PASS

# 第4步：恢复干净备份
cp /opt/shenyuan/.backups/data-preincident.json /opt/shenyuan/server/data.json
pm2 restart shenyuan-api

# 第5步：验证系统干净
ps aux | grep node
netstat -tlnp | grep LISTEN
```

**恢复验证**:
- [ ] 服务已隔离（无法出站）
- [ ] 审计日志已保存（与法务共享）
- [ ] 密钥已全部更换
- [ ] 系统已恢复干净备份
- [ ] 法务已通知监管部门

**需通知**:
- Karen (DevOps Lead) — 立即电话
- CFO — 损失评估
- 法务 — 监管通知
- 可选: 公开声明 (1-2 天后)

**事后步骤**:
1. 深度安全审计 (与第三方合作，1-2 周)
2. 审查权限模型 (防止再次发生)
3. 生成事故报告 (交给 CFO + 法务)
4. 更新安全政策文档

---

### 5️⃣ 流量暴增宕机 (P0) — DevOps Lead 负责

**症状**:
- PostHog 显示 QPS 从 10 突增到 1000+
- 响应时间从 100ms 升到 5000ms+
- CPU 占用 90%+
- 网站开始 502/503

**处理流程**:
```
发现 (0 min) ⚠️ 立即行动
  ↓ 确认暴涨是正常流量还是 DDoS (2 min) — 检查请求来源
  ↓ 自动恢复: PM2 cluster 自动 fork 多进程 (2 min) — 自动触发
  ↓ 启用限流保护 (2 min) — bash QUICK-FIX-COMMANDS.sh 10
  ↓ 检查数据库连接池 (2 min) — bash QUICK-FIX-COMMANDS.sh 12
  ↓ 若仍未恢复，扩容 (30 min，但通常不需要)
  ↓ 验证恢复 (2 min)
恢复完成 (5 min 预期)
```

**关键命令**:
```bash
ssh root@47.242.80.65

# 检查当前进程数
pm2 status
ps aux | grep "node.*index.js" | wc -l  # 应该 ≥4 个

# 查看当前 QPS
curl -s http://47.242.80.65/api/metrics | jq .qps

# 启用限流 (若自动扩容不够)
bash QUICK-FIX-COMMANDS.sh 10

# 检查数据库连接数
sqlite3 /opt/shenyuan/server/data.db "SELECT COUNT(*) FROM connections"

# 查看慢查询
tail -f /opt/shenyuan/server/logs/slow-query.log
```

**恢复验证**:
- [ ] `pm2 status` 显示多个 online 进程
- [ ] QPS 恢复正常 (<100)
- [ ] 响应时间 <500ms
- [ ] CPU 占用 <70%

**需通知**:
- CMO (若涉及营销活动导致暴涨)
- 可选: Slack 通知 "流量已处理，服务恢复"

**预防措施**:
- 若是营销活动导致，提前通知 DevOps (48h 前)
- 配置自动扩容阈值 (PM2 集群模式)
- 定期压力测试，找到瓶颈

---

## 快速参考命令

```bash
# 所有快速修复命令
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh [1-15]

# 健康检查 (随时可跑)
bash /opt/shenyuan/health-check.sh

# 查看实时监控
pm2 monit

# 查看完整日志
pm2 logs shenyuan-api

# 查看资源使用
free -h && df -h && top -b -n1 | head -15
```

---

## 响应时间 SLA

| 风险 | 级别 | 发现→修复 | 发现→用户恢复 |
|------|------|---------|------------|
| 支付失败 | P1 | 15 min | 20 min |
| 服务宕机 | P0 | 10 min | 12 min |
| 邀请失效 | P2 | 30 min | 35 min |
| 数据泄露 | P0 | 5 min (隔离) | 24h (恢复) |
| 流量暴增 | P0 | 5 min | 7 min |

---

## 关键电话/联系

```
Karen (DevOps Lead):  +852-XXXX-XXXX
CFO (金钱相关):      +852-XXXX-XXXX
法务 (合规):        +86-XXX-XXXX-XXXX
微信商户支持:        4006008888 (工作时间)
支付宝支持:         95188 (7x24)
```

---

## 文档关联

- **详细排查**: EMERGENCY-INCIDENT-HANDBOOK.md
- **逐步清单**: EMERGENCY-CHECKLIST-PRINTABLE.txt
- **责任分工**: INCIDENT-RESPONSIBILITY-MATRIX.md
- **自动化命令**: QUICK-FIX-COMMANDS.sh
- **健康检查**: health-check-dashboard.html
