# 善缘监控告警规则详细配置

## 📋 文档版本

- **版本**: 1.0
- **最后更新**: 2026-08-08
- **维护人**: DevOps / Infrastructure Team
- **状态**: 生产环境

---

## 🎯 告警系统架构

```
后端服务 (支付/邀请/服务器监控)
    ↓
POST /alert/{payment|invite|server}
    ↓
slack-alerts.js (Node进程)
    ├─ 数据验证
    ├─ 指标更新
    ├─ 告警判断
    └─ Slack通知 (webhook)
    ↓
Slack 频道 (#shenyuan-alerts/payments/invites/infra)
```

---

## 📊 核心告警规则

### 1. 支付相关告警

#### 1.1 支付失败率过高

| 字段 | 值 |
|------|-----|
| **告警ID** | `payment-error-rate` |
| **告警级别** | 🟡 WARNING |
| **触发条件** | 支付失败率 > 5% |
| **计算公式** | `failedOrders / totalOrders > 0.05` |
| **检查频率** | 实时 (每次支付后) |
| **缓冲时间** | 300秒 (5分钟内同类告警仅发一次) |
| **通知渠道** | `#shenyuan-alerts` |
| **处理人** | `@on-call-engineer` `@product-lead` |

**触发场景**:
- 支付网关故障 (Stripe连接超时)
- 用户支付信息错误 (卡被拒绝)
- 网络问题导致支付中断

**处理流程**:
1. 收到告警立即检查 Stripe Dashboard
2. 查看最近失败订单的错误信息
3. 如果是网关问题,等待自动恢复;人工问题需个性化处理
4. 更新 `INCIDENT-RESPONSE-README.md` 事件日志
5. 当恢复后,在 Slack 回复 ✅ 已解决

**示例通知**:
```
⚠️ 支付失败率超过阈值
失败率: 7.50% (阈值: 5.00%)
总交易: 40 | 失败: 3
```

---

#### 1.2 支付处理延迟

| 字段 | 值 |
|------|-----|
| **告警ID** | `payment-delay` |
| **告警级别** | 🟡 WARNING |
| **触发条件** | 单笔订单处理时间 > 5秒 |
| **计算公式** | `processingTime > 5000ms` |
| **检查频率** | 实时 (每次支付后) |
| **缓冲时间** | 300秒 |
| **通知渠道** | `#shenyuan-alerts` |
| **处理人** | `@on-call-engineer` |

**触发场景**:
- Stripe API响应缓慢
- 服务器IO阻塞
- 数据库查询超时

**处理流程**:
1. 检查 Stripe API 状态页 (status.stripe.com)
2. 查看服务器日志: `pm2 logs shenyuan-backend`
3. 检查数据库连接数: `mysql -u root -p -e "SHOW PROCESSLIST"`
4. 如果是数据库问题,考虑优化查询或扩展连接池

**阈值调整历史**:
- 2026-08-01: 初始设置 5000ms (用户感知可接受延迟)

---

#### 1.3 支付异常错误

| 字段 | 值 |
|------|-----|
| **告警ID** | `payment-error` |
| **告警级别** | 🔴 CRITICAL |
| **触发条件** | 收到特定错误代码 (见下表) |
| **检查频率** | 实时 |
| **缓冲时间** | 60秒 (关键告警缓冲短) |
| **通知渠道** | `#shenyuan-alerts` `@ceo` |
| **处理人** | `@cto` `@on-call-sre` |

**关键错误代码**:

| 错误代码 | 说明 | 处理优先级 | 行动 |
|---------|------|---------|------|
| `card_declined` | 用户卡被拒绝 | 低 | 提示用户更换卡 |
| `insufficient_funds` | 余额不足 | 低 | 提示用户充值 |
| `authentication_failed` | 3D认证失败 | 中 | 提示用户重试 |
| `authentication_required` | 需要3D认证 | 中 | 返回认证链接 |
| `rate_limit_exceeded` | Stripe限流 | 高 | 实现重试机制 |
| `invalid_request_error` | 请求参数错误 | 高 | 检查代码,可能需要紧急部署 |
| `api_connection_error` | 网络连接失败 | 高 | 检查网络/防火墙 |
| `api_error` | Stripe服务故障 | 高 | 等待Stripe恢复 |

---

### 2. 邀请激活相关告警

#### 2.1 邀请激活流失率过高

| 字段 | 值 |
|------|-----|
| **告警ID** | `invite-dropoff` |
| **告警级别** | 🟡 WARNING |
| **触发条件** | 激活流失率 > 30% |
| **计算公式** | `(totalInvites - activatedCount) / totalInvites > 0.30` |
| **检查频率** | 实时 (每次激活后) |
| **缓冲时间** | 300秒 |
| **通知渠道** | `#shenyuan-alerts` `#shenyuan-invites` |
| **处理人** | `@growth-team` `@product-lead` |

**触发场景**:
- 邀请链接过期或失效
- 激活流程过于复杂
- 用户没有收到邀请邮件 (邮件服务故障)
- 激活奖励不足以吸引用户

**处理流程**:
1. 收到告警后,查看最近邀请的转化漏斗
2. 分析流失发生在哪一步 (接收邀请 → 点击 → 注册 → 完成激活)
3. 如果是邮件问题,检查 Sendgrid 或 Resend 的投递日志
4. 如果是激活流程问题,在 #shenyuan-invites 讨论优化方案
5. 如果是奖励问题,咨询 Karen 是否调整报酬金额

**目标指标**:
- 流失率 < 30% (当前)
- 流失率 < 20% (长期目标,需优化)

---

#### 2.2 邀请无效 (异常激活)

| 字段 | 值 |
|------|-----|
| **告警ID** | `invite-invalid` |
| **告警级别** | 🟡 WARNING |
| **触发条件** | 单个邀请链接被滥用 (>10次尝试激活) 或 重复激活同一user |
| **检查频率** | 实时 |
| **缓冲时间** | 300秒 |
| **通知渠道** | `#shenyuan-alerts` |
| **处理人** | `@security-team` |

**处理流程**:
1. 检查异常激活的来源IP和设备ID
2. 判断是否为欺诈或测试账户
3. 如果是欺诈,禁用邀请链接并删除虚假激活
4. 如果是测试,直接验证不需要处理

---

### 3. 服务器资源相关告警

#### 3.1 内存占用过高

| 字段 | 值 |
|------|-----|
| **告警ID** | `server-memory` |
| **告警级别** | 🟡 WARNING (>80%) / 🔴 CRITICAL (>95%) |
| **触发条件** | 内存使用率 > 80% |
| **检查频率** | 每5分钟一次 (cron job) |
| **缓冲时间** | 300秒 (普通) / 60秒 (关键) |
| **通知渠道** | `#shenyuan-infra` |
| **处理人** | `@devops-team` `@on-call-sre` |

**触发场景**:
- 内存泄漏 (Node.js进程未释放内存)
- 数据库缓存过大
- 高并发请求导致内存爆增

**处理流程**:
1. 登录服务器: `ssh root@47.242.80.65`
2. 查看内存占用: `free -h`
3. 查看进程内存: `ps aux --sort=-%mem | head -20`
4. 查看Node进程: `pm2 monit`
5. 如果某个进程泄漏,重启: `pm2 restart shenyuan-backend`
6. 如果重启无效,检查是否需要扩容或优化代码

**自动恢复机制**:
```bash
#!/bin/bash
# /usr/local/bin/memory-watchdog.sh
THRESHOLD=85
MEMORY=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ $MEMORY -gt $THRESHOLD ]; then
  echo "内存占用 $MEMORY% 超过阈值" | mail -s "内存告警" admin@shenyuan.com
  pm2 restart all  # 重启所有进程
fi
```

**内存优化建议**:
- Node.js 堆内存限制: `NODE_OPTIONS=--max-old-space-size=1024`
- 定期清理缓存: `Redis FLUSHDB`
- 使用 `clinic.js` 检测内存泄漏

---

#### 3.2 磁盘占用过高

| 字段 | 值 |
|------|-----|
| **告警ID** | `server-disk` |
| **告警级别** | 🟡 WARNING (>85%) / 🔴 CRITICAL (>95%) |
| **触发条件** | 磁盘使用率 > 85% |
| **检查频率** | 每小时一次 |
| **缓冲时间** | 300秒 (普通) / 60秒 (关键) |
| **通知渠道** | `#shenyuan-infra` |
| **处理人** | `@devops-team` |

**触发场景**:
- 日志文件过大 (pm2/nginx日志)
- 数据库备份堆积
- 视频/图片缓存未清理
- 临时文件未删除

**处理流程**:
1. 检查磁盘使用: `df -h`
2. 找出大文件: `du -sh /* | sort -rh | head -10`
3. 清理日志:
   ```bash
   pm2 logs --lines 0  # 清空pm2日志
   tail -n 1000000 /var/log/nginx/access.log > temp.log && mv temp.log /var/log/nginx/access.log
   ```
4. 清理缓存:
   ```bash
   rm -rf /tmp/*
   docker system prune -a  # 如果使用容器
   ```
5. 归档备份:
   ```bash
   tar -czf backup-$(date +%Y%m%d).tar.gz /data/backups/*
   # 上传到阿里云OSS
   ```

**磁盘容量规划**:
- 当前: 100GB (77% 已用)
- 建议: 扩容到 200GB 或清理旧备份
- 定期检查: 每周一 09:00 UTC

---

#### 3.3 CPU占用过高

| 字段 | 值 |
|------|-----|
| **告警ID** | `server-cpu` |
| **告警级别** | 🟡 WARNING (>80%) |
| **触发条件** | CPU使用率 > 80% 持续 > 5分钟 |
| **检查频率** | 每5分钟一次 |
| **缓冲时间** | 300秒 |
| **通知渠道** | `#shenyuan-infra` |
| **处理人** | `@on-call-sre` |

**触发场景**:
- 高并发请求导致计算瓶颈
- 数据库查询未优化
- 后台任务 (视频转码/图片处理) 过多

**处理流程**:
1. 查看CPU占用: `top -b -n 1`
2. 查看进程: `ps aux --sort=-%cpu | head -20`
3. 检查网络连接数: `netstat -tnap | wc -l`
4. 如果是高并发,检查是否触发自动扩展或限流机制
5. 如果是单个进程,考虑重启或代码优化

---

### 4. API相关告警

#### 4.1 API错误率过高

| 字段 | 值 |
|------|-----|
| **告警ID** | `api-error-rate` |
| **告警级别** | 🟡 WARNING |
| **触发条件** | 错误率 > 2% |
| **计算公式** | `failedRequests / totalRequests > 0.02` |
| **检查频率** | 实时 (每次请求后) |
| **缓冲时间** | 300秒 |
| **通知渠道** | `#shenyuan-alerts` |
| **处理人** | `@on-call-engineer` |

**常见错误**:
- 500: 服务器内部错误 (代码bug/未捕获异常)
- 503: 服务不可用 (进程崩溃/资源耗尽)
- 429: 限流 (高并发)
- 401: 未授权 (token过期/无效)
- 404: 资源不存在 (前端请求错误URL)

**处理流程**:
1. 查看错误日志: `pm2 logs shenyuan-backend | grep ERROR`
2. 识别错误类型和频率
3. 如果是代码bug,快速修复并部署
4. 如果是资源问题,考虑扩容
5. 如果是限流,可能需要优化或升级限流策略

**错误率历史目标**:
- 当前: < 2%
- 目标: < 0.5% (生产级别)

---

#### 4.2 API响应时间过长

| 字段 | 值 |
|------|-----|
| **告警ID** | `api-slow` |
| **告警级别** | 🟡 WARNING |
| **触发条件** | p95 响应时间 > 3秒 |
| **检查频率** | 每5分钟统计一次 |
| **缓冲时间** | 300秒 |
| **通知渠道** | `#shenyuan-alerts` |
| **处理人** | `@on-call-engineer` |

**常见原因**:
- 数据库查询未优化 (缺少索引/复杂JOIN)
- 外部API调用超时 (Stripe/Ali)
- 大文件上传/下载
- 网络不稳定

**处理流程**:
1. 查看慢查询日志: `mysql -u root -p -e "SHOW PROCESSLIST"`
2. 分析最慢的API端点: `tail -f /var/log/shenyuan/api.log | grep "duration"`
3. 使用APM工具 (DataDog/NewRelic) 定位瓶颈
4. 优化: 添加缓存/索引/异步处理
5. 监控优化效果

---

### 5. 数据库相关告警

#### 5.1 数据库连接异常

| 字段 | 值 |
|------|-----|
| **告警ID** | `db-connection-error` |
| **告警级别** | 🔴 CRITICAL |
| **触发条件** | 数据库连接失败或超时 |
| **检查频率** | 实时 (每次查询) |
| **缓冲时间** | 60秒 |
| **通知渠道** | `#shenyuan-alerts` `#shenyuan-infra` |
| **处理人** | `@dba` `@on-call-sre` |

**处理流程**:
1. 登录数据库服务器
2. 检查MySQL状态: `mysql -u root -p -e "SHOW STATUS"`
3. 检查连接数: `mysql -u root -p -e "SHOW PROCESSLIST"`
4. 如果连接数超过限制,重启MySQL: `systemctl restart mysql`
5. 检查备份数据库是否可用 (主从切换)

---

## 📈 告警阈值配置表

| 告警项 | 阈值 | 单位 | 变更说明 | 上次更新 |
|-------|------|------|---------|---------|
| 支付失败率 | 5% | % | 初始值(基于0.1%基线+50倍容差) | 2026-08-01 |
| 邀请流失率 | 30% | % | 初始值(行业平均20-40%) | 2026-08-01 |
| 服务器内存 | 80% | % | 初始值(留20%缓冲) | 2026-08-01 |
| 服务器磁盘 | 85% | % | 初始值(留15%缓冲) | 2026-08-01 |
| API错误率 | 2% | % | 初始值(行业标准1-5%) | 2026-08-01 |
| 支付延迟 | 5000 | ms | 初始值(基于用户感知) | 2026-08-01 |
| API响应时间 | 3000 | ms | p95目标(基于优化空间) | 2026-08-01 |

**阈值调整流程**:
1. 在 Slack #shenyuan-infra 提议新阈值,附上理由
2. 由 @cto 和 @ceo 确认
3. 在本文档中更新,并在 Git 提交
4. 部署新配置到 `slack-alerts.js` 的 `CONFIG.thresholds`
5. 重启告警系统: `pm2 restart shenyuan-alerts`
6. 监控1周效果,确认无告警误报或遗漏

---

## 🔧 告警缓冲机制 (Deduplication)

为避免告警风暴,系统实现了告警去重:

```javascript
// 同类型告警的缓冲时间
CONFIG.alertDelay = {
  same: 300,      // 5分钟内,同类型告警最多发一次
  critical: 60,   // 1分钟内,严重告警最多发一次
};
```

**示例**:
- 14:00:00 支付失败率突增 → 发送告警
- 14:01:30 支付失败率仍然高 → 不发送 (在缓冲期内)
- 14:05:30 支付失败率仍然高 → 发送告警 (5分钟已过)

**调整缓冲时间**:
```bash
# 编辑 slack-alerts.js,修改:
CONFIG.alertDelay.same = 600;      // 改为10分钟
CONFIG.alertDelay.critical = 120;  // 改为2分钟
# 重启
pm2 restart shenyuan-alerts
```

---

## 🚨 关键告警响应 SLA

| 告警级别 | 响应时间 | 首次处理 | 状态更新 |
|---------|---------|---------|---------|
| 🔴 CRITICAL | 5分钟 | 打电话确认 | 每15分钟更新一次Slack |
| 🟡 WARNING | 15分钟 | Slack确认 | 每30分钟更新一次 |
| 🔵 INFO | 1小时 | 检查后回复 | 无需实时更新 |

**关键告警列表**:
- `payment-error-rate` (支付失败率)
- `server-memory` (内存>95%)
- `server-disk` (磁盘>95%)
- `db-connection-error` (数据库连接失败)
- `api-error-rate` (错误率>5%)

---

## 📞 告警升级规则

如果1小时内问题未解决,自动升级:

```
普通告警 (15min未解决)
    ↓
升级为 WARNING (通知 @product-lead @on-call-engineer)
    ↓
关键告警 (60min未解决)
    ↓
升级为 CRITICAL (通知 @ceo @cto)
    ↓
P0 事件 (24小时未解决)
    ↓
启动事件指挥中心 (全公司standby)
```

---

## 📝 处理记录模板

每次处理告警后,在 Slack 线程中回复:

```
✅ 已处理 [告警ID]

根因: [分析原因,如支付网关超时]
影响: [影响范围,如1.2%订单延迟]
修复: [采取的行动,如切换到备用网关]
验证: [验证修复效果,如恢复至0.1%失败率]
预防: [长期改进计划,如添加网关冗余]

处理时间: [总耗时]
完成时间: [ISO 8601 timestamp]
```

---

## 🔄 定期审视计划

- **每周** (周一 14:00 UTC): 回顾本周告警频率和趋势
- **每月** (月末): 调整阈值,优化规则
- **每季度**: 审视告警系统的有效性,收集反馈

**下次定期审视**: 2026-09-08

---

## 📚 相关文档

- [EMERGENCY-INCIDENT-HANDBOOK.md](EMERGENCY-INCIDENT-HANDBOOK.md) - 事件处理手册
- [INCIDENT-RESPONSIBILITY-MATRIX.md](INCIDENT-RESPONSIBILITY-MATRIX.md) - 责任矩阵
- [../scripts/slack-alerts.js](../scripts/slack-alerts.js) - 告警脚本源码
- [../monitoring-dashboard.html](../monitoring-dashboard.html) - 实时看板

---

## 🎓 新员工入职清单

- [ ] 阅读本文档的前3个章节
- [ ] 加入 Slack #shenyuan-alerts #shenyuan-infra 频道
- [ ] 学习如何 SSH 登录服务器
- [ ] 体验一次告警处理流程 (导师指导)
- [ ] 签署 On-Call Duty 协议
- [ ] 配置手机 Slack 通知

---

**文档所有者**: DevOps Team  
**最后更新时间**: 2026-08-08 13:00 UTC  
**下一次审核**: 2026-09-08
