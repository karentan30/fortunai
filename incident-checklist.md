# 事件管理清单 - 完整流程

**用途**: 从事件发现到事后总结的完整检查清单  
**时间**: 约 60 分钟（含事后总结）  
**所有人员**都应该了解这个流程

---

## 阶段 0: 预防（日常）

### 监控与告警
- [ ] 已配置 PM2 监控 (每 1 分钟检查一次)
- [ ] 已配置 Caddy 日志收集 (nginx 格式，每日轮换)
- [ ] 已配置 PostHog 实时监控 (QPS/错误率/响应时间)
- [ ] 已配置数据库备份 (每 6 小时一次，自动上传 OSS)
- [ ] 已配置密钥轮换日程 (每 90 天轮换一次)

### 缓存与限流
- [ ] 已启用 Redis 缓存 (TTL 1h)
- [ ] 已启用速率限制中间件 (100req/min per IP)
- [ ] 已启用数据库连接池 (max 20 connections)
- [ ] 已启用 Gzip 压缩 (所有响应)

### 文档与培训
- [ ] 所有工程师都已阅读本清单
- [ ] 新人已完成 on-call 培训
- [ ] 联系方式已更新
- [ ] 应急命令已提前测试

---

## 阶段 1: 发现 (T+0:00)

### 1.1 确认事件存在 (1-2 min)

**症状识别** — 选择最接近的症状：

- [ ] **网站打不开** (HTTP 502/503)
  - 立即跳转 → **[支付失败](#support-payment) 或 [服务宕机](#support-down)**

- [ ] **用户充值失败** (订单未入账)
  - 立即跳转 → **[支付失败](#support-payment)**

- [ ] **邀请链接不工作** (返回 404/invalid token)
  - 立即跳转 → **[邀请失效](#support-invite)**

- [ ] **怀疑数据泄露** (密钥/邮箱在公网可见)
  - 立即跳转 → **[数据泄露](#support-leak)** (P0 最高级别)

- [ ] **流量特别高** (QPS >1000 或响应时间 >5s)
  - 立即跳转 → **[流量暴增](#support-traffic)**

- [ ] **其他异常** (说不清的奇怪行为)
  - 先做"快速诊断"下面的步骤

### 1.2 快速诊断 (2-5 min)

运行一键诊断：
```bash
bash /opt/shenyuan/health-check.sh
```

输出应该包含：
```
✅ 服务运行中 (PID: 12345)
✅ 内存占用正常 (345MB/2GB)
✅ CPU 占用正常 (15%)
✅ 磁盘正常 (40GB/100GB)
❌ API 响应缓慢 (3.2s)  # ← 有问题
```

根据诊断结果，标记问题项：
- [ ] 服务未启动
- [ ] 内存占用过高 (>1GB)
- [ ] CPU 占用过高 (>80%)
- [ ] 磁盘空间不足 (<10GB)
- [ ] API 响应缓慢 (>1s)
- [ ] 数据库无法连接
- [ ] Redis 无法连接

### 1.3 通知关键人员 (立即)

**按事件优先级通知**：

**P0** (立即电话通知):
- [ ] Karen (DevOps Lead) — +852-XXXX-XXXX
- [ ] 在线的工程师

**P1** (Slack 通知):
- [ ] #incidents 频道（粘贴症状 + 诊断输出）
- [ ] 对应工程师 @mention

**P2** (邮件通知):
- [ ] 技术团队邮件列表

通知模板：
```
🚨 [P0/P1/P2] 事件: [症状简述]

时间: 2026-08-08 14:30 UTC+8
症状: [具体表现]
影响范围: [多少用户受影响]
诊断: [运行 health-check.sh 的输出]

推荐行动: [对应修复命令]
```

---

## 阶段 2: 隔离与修复 (T+0:05 - T+0:25)

### 2.1 选择对应的快速修复命令

**按事件类型执行**：

#### 支付失败 {#support-payment}

快速修复（预期 15 min）:
```bash
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 1  # 重启支付服务
# 等待 10s
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 2  # 验证密钥
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 5  # 重新注册 webhook
```

验证步骤：
- [ ] 支付端点返回 200
- [ ] 新订单可正常提交
- [ ] 用户余额已更新
- [ ] 没有新错误日志

若仍未恢复，深度诊断：
```bash
ssh root@47.242.80.65
tail -f /opt/shenyuan/server/logs/payment.log
curl -X POST http://47.242.80.65/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "amount": 0.01}'
```

#### 服务宕机 {#support-down}

快速修复（预期 10 min）:
```bash
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 6  # 重启服务
# 等待 10s
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 7  # 检查内存
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 10 # 启用限流
```

验证步骤：
- [ ] `pm2 status` 显示 online
- [ ] `curl http://47.242.80.65/api/health` 返回 200
- [ ] 网站可正常访问
- [ ] PostHog 显示 QPS 恢复 (<100)

#### 邀请失效 {#support-invite}

快速修复（预期 30 min）:
```bash
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 12 # 检查数据库
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 13 # 重新生成邀请码
```

验证步骤：
- [ ] 新邀请码可通过验证
- [ ] 配对建立成功
- [ ] 前端收到正确的配对信息

#### 流量暴增 {#support-traffic}

快速修复（预期 5 min）:
```bash
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 10 # 启用限流 + 集群模式
# 等待 30s，观察 QPS 是否下降
```

验证步骤：
- [ ] `pm2 status` 显示 >=4 个 online 进程
- [ ] PostHog 显示 QPS 回到 <100
- [ ] CPU 占用 <70%

#### 数据泄露 {#support-leak}

⚠️ **P0 最高级别，立即行动，无延迟**

立即执行（预期 5 min 隔离 + 24h 恢复）:

1. **隔离服务器**（防泄露扩大）:
```bash
ssh root@47.242.80.65
sudo iptables -A OUTPUT -j DROP
echo "服务器已隔离（断出站连接）"
```

2. **通知 Karen + CFO + 法务**（电话，不是 Slack）

3. **保存审计日志**（供法务调查）:
```bash
ssh root@47.242.80.65
mkdir -p /tmp/incident_$(date +%s)
pm2 logs shenyuan-api --lines 10000 > /tmp/incident_*/api.log
git -C /opt/shenyuan log --all --oneline > /tmp/incident_*/git.log
tar czf /tmp/incident.tar.gz /tmp/incident_*
# 交给 CFO/法务 保存
```

4. **重置所有密钥**（需要人工干预，不自动化）:
```bash
nano /opt/shenyuan/server/.env
# 修改: WECHAT_API_KEY, ALIPAY_PRIVATE_KEY, JWT_SECRET, DB_PASS
pm2 restart shenyuan-api
```

5. **恢复干净备份**:
```bash
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh 12  # 从备份恢复
```

验证步骤：
- [ ] 服务器已隔离（无法出站）
- [ ] 审计日志已保存（交给法务）
- [ ] 所有密钥已更换
- [ ] 系统已恢复干净备份
- [ ] 服务恢复在线

### 2.2 记录修复过程

在修复时，记录以下信息：

```
[修复开始时间] 2026-08-08 14:35

[执行的命令]
- bash quick-fixes.sh 1
- bash quick-fixes.sh 2
- ...

[观察到的输出]
✅ 支付服务已重启
⚠️ 发现 3 个失败订单

[临时修改]
(若手工修改了配置，记录下来)

[修复完成时间] 2026-08-08 14:50
[总耗时] 15 分钟
```

---

## 阶段 3: 验证恢复 (T+0:25 - T+0:30)

### 3.1 功能测试

每项都要测试，才能确认恢复：

**基础功能**:
- [ ] 网站可打开 (访问 https://shenyuan.run)
- [ ] 登录工作正常
- [ ] API 端点响应 <1s

**支付相关**:
- [ ] 可提交充值订单
- [ ] 余额实时更新
- [ ] 历史订单可查看

**邀请功能**:
- [ ] 可生成新邀请码
- [ ] 邀请码可验证
- [ ] 配对可建立

**监控指标**:
- [ ] PostHog QPS: 应 <100 (正常) 或 >100 (营销中，需确认)
- [ ] 错误率: 应 <1%
- [ ] 响应时间: 应 <500ms

### 3.2 回归测试

运行以下命令进行快速回归：
```bash
bash /opt/shenyuan/tests/regression-test.sh
```

应输出：
```
✅ 17 个测试通过
❌ 0 个测试失败
⏭️  0 个测试跳过
```

若有失败，查看详细日志：
```bash
cat /tmp/regression-test-results.log
```

### 3.3 用户反馈

- [ ] 通知已修复的信息给 CMO (用于外部沟通)
- [ ] 等待 5-10 min，看用户反馈
- [ ] 若用户仍反馈问题，回到"阶段 2"继续修复

---

## 阶段 4: 事后处理 (T+0:30 - T+1:00)

### 4.1 事故报告

在 `/opt/shenyuan/docs/incidents/` 下创建事故报告：

文件名: `[YYYY-MM-DD]-[type]-[name].md`  
例如: `2026-08-08-payment-webhook-failure-karen.md`

报告模板：
```markdown
# 事故报告: [事件标题]

**日期**: 2026-08-08  
**时间范围**: 14:30 - 14:50 UTC+8  
**总耗时**: 20 分钟  
**优先级**: P1  

## 事件摘要

[简述发生了什么，对用户的影响]
- 影响用户数: 约 50 人
- 影响订单数: 7 笔
- 收入损失: 约 ¥350

## 根本原因分析 (RCA)

[为什么会发生？]
- 支付宝 API 密钥过期
- 未配置监控告警
- 新人未知悉密钥轮换流程

## 时间线

| 时间 | 事件 |
|------|------|
| 14:30 | 用户报告充值失败 |
| 14:32 | 收到 Slack 通知，确认问题 |
| 14:35 | 开始修复 (重启支付服务) |
| 14:38 | 发现密钥问题，手工更新 |
| 14:50 | 服务恢复，验证成功 |

## 修复步骤

```bash
bash quick-fixes.sh 1  # 重启支付服务
bash quick-fixes.sh 2  # 检查密钥
bash quick-fixes.sh 5  # 重新注册 webhook
```

## 预防措施 (未来不再发生)

- [ ] 配置密钥轮换告警 (提前 30 天)
- [ ] 添加密钥有效期检查 (启动时验证)
- [ ] 定期演练支付系统故障 (每季度一次)

## 总结

**好的方面**:
- 快速发现并修复
- 用户影响时间短

**需要改进**:
- 缺少提前告警
- RCA 过程需时间

---

**报告人**: Karen  
**审核人**: [CFO/CMO]  
**最后更新**: 2026-08-08
```

### 4.2 客户补偿 (若有必要)

若事件影响用户体验，检查是否需要补偿：

- [ ] 支付失败 → 确认所有失败订单已恢复 + 用户已收到通知
- [ ] 服务宕机 >1h → 赠送 +1 天订阅（若有订阅制）
- [ ] 数据泄露 → 由法务决定

补偿处理：
```bash
# 示例：赠送 10 元余额给受影响用户
sqlite3 /opt/shenyuan/server/data.db << SQL
UPDATE users
SET balance = balance + 10, compensation_note = '2026-08-08 支付系统故障补偿'
WHERE id IN (SELECT user_id FROM orders WHERE failed_at = '2026-08-08');
SQL
```

### 4.3 知识库更新

- [ ] 若发现文档缺陷，立即补充到 EMERGENCY-INCIDENT-HANDBOOK.md
- [ ] 若发现新的修复方法，添加到 QUICK-FIX-COMMANDS.sh
- [ ] 若发现工具不可用，通知 DevOps 修复
- [ ] 季度汇总所有事件，更新应急文档

### 4.4 沟通与追踪

**内部沟通**:
```
[在 Slack #incidents 发送总结]

✅ 事件已解决

时间范围: 14:30 - 14:50
故障类型: 支付系统 webhook 失败
根本原因: API 密钥过期
影响用户: ~50 人
修复耗时: 20 分钟

详见事故报告: docs/incidents/2026-08-08-payment-...md
```

**外部沟通** (由 CMO 负责):
```
(可选，视事件严重程度)

"我们在 8 月 8 日下午 2:30 经历了短暂的支付系统故障，
影响了部分用户的充值体验。问题已在 20 分钟内解决。
感谢您的耐心。我们将继续优化系统稳定性。"
```

---

## 快速参考

### 常见事件的典型时间

| 事件 | 发现 | 修复 | 验证 | 总耗时 |
|------|------|------|------|--------|
| 支付失败 | 2 min | 10 min | 3 min | 15 min |
| 服务宕机 | 1 min | 5 min | 3 min | 9 min |
| 邀请失效 | 3 min | 15 min | 5 min | 23 min |
| 数据泄露 | 2 min | 30 min | 5 min | 37 min |
| 流量暴增 | 2 min | 3 min | 3 min | 8 min |

### 关键电话

- **Karen (DevOps)**: +852-XXXX-XXXX
- **CFO**: +852-XXXX-XXXX
- **CMO**: +852-XXXX-XXXX
- **法务**: +86-XXX-XXXX-XXXX

### 常用命令

```bash
# 一键诊断
bash /opt/shenyuan/health-check.sh

# 快速修复 (1-15)
bash /opt/shenyuan/QUICK-FIX-COMMANDS.sh [N]

# 查看实时监控
pm2 monit

# 查看日志
pm2 logs shenyuan-api --lines 50

# SSH 到服务器
ssh root@47.242.80.65
```

---

## 清单检查

在使用本清单前，确保：

```
☐ 已熟悉 5 大风险（见 EMERGENCY-RESPONSE.md）
☐ 已测试所有 quick-fixes.sh 命令
☐ 已获得生产服务器访问权限
☐ 已保存关键联系方式
☐ 已知道事故报告的位置 (/opt/shenyuan/docs/incidents/)
☐ 已告知团队成员此清单的位置
```

---

**最后更新**: 2026-08-08  
**下次审查**: 2026-11-08  
**维护者**: Karen (DevOps Lead)
